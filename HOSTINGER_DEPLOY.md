# TriVanta – Hostinger Deployment Guide

> Complete step-by-step guide for deploying TriVanta on Hostinger.  
> Two paths: **hPanel Node.js** (shared/business/cloud plans) or **VPS** (full control).

---

## Which plan do you have?

| Hostinger Plan | Use This Path |
|---|---|
| Business / Cloud / Premium (hPanel) | [Path A — hPanel Node.js](#path-a--hpanel-nodejs-shared--cloud-hosting) |
| VPS (KVM) | [Path B — VPS](#path-b--hostinger-vps) |

---

## Demo Accounts (after seeding)

| Role | Email | Password |
|---|---|---|
| Managing Partner | partner@trivanta.com | Password123! |
| Attorney | attorney@trivanta.com | Password123! |
| Client | client@trivanta.com | Password123! |

---

---

# Path A — hPanel Node.js (Shared / Cloud Hosting)

### Prerequisites
- Hostinger Business, Cloud Startup, or higher plan
- A domain pointed to your Hostinger account
- Node.js 20.x available in hPanel (check under **Advanced → Node.js**)

---

## Step A1 — Build the deployment package (on your local machine)

```bash
# Clone or open your local project, then run:
bash hostinger-package.sh
```

This creates `trivanta-hostinger-YYYYMMDD-HHMM.zip` containing:
- `client/dist/` (pre-built React app)
- `server/` (API source)
- `ecosystem.config.js`, `deploy.sh`, `.env.example`
- No `node_modules` (installed on server), no `.env` (you set it in hPanel)

---

## Step A2 — Upload to Hostinger File Manager

1. Log in to **hPanel** → **Files → File Manager**
2. Navigate to `public_html/` (or create a subdirectory like `public_html/trivanta/`)
3. Click **Upload** → choose the zip → wait for upload
4. Right-click the zip → **Extract**
5. Verify these folders exist inside your target directory:
   ```
   client/dist/
   server/
   ecosystem.config.js
   .env.example
   deploy.sh
   ```

---

## Step A3 — Enable Node.js in hPanel

1. hPanel → **Websites** → click your domain → **Advanced**
2. Find **Node.js** and click **Enable** (or **Manage**)
3. Set these values:

   | Field | Value |
   |---|---|
   | **Node.js version** | 20.x (LTS) |
   | **Application root** | `public_html/trivanta` *(your upload folder)* |
   | **Application URL** | `yourdomain.com` |
   | **Application startup file** | `server/src/index.js` |

4. Click **Save** / **Create Application**

---

## Step A4 — Set environment variables in hPanel

In the **Node.js** panel → **Environment Variables** section, add:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` *(Hostinger assigns this internally — use 3000)* |
| `JWT_SECRET` | *(generate below)* |
| `JWT_EXPIRES_IN` | `7d` |
| `DB_PATH` | `/home/YOUR_USERNAME/public_html/trivanta/trivanta.db` |
| `CLIENT_URL` | `https://yourdomain.com` |
| `UPLOAD_DIR` | `/home/YOUR_USERNAME/public_html/trivanta/uploads` |
| `MAX_FILE_SIZE_MB` | `20` |

**Generate JWT_SECRET** — open the hPanel SSH Terminal and run:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Copy the output as the value for `JWT_SECRET`.

> **Important:** Replace `YOUR_USERNAME` with your actual Hostinger username (shown in hPanel → SSH Access).

---

## Step A5 — Install dependencies via SSH Terminal

1. hPanel → **Advanced → SSH Access** → **Open Terminal** (or connect via your SSH client)
2. Navigate to your app folder:
   ```bash
   cd ~/public_html/trivanta
   ```
3. Install server dependencies:
   ```bash
   npm install --prefix server --omit=dev
   ```
4. Create required directories:
   ```bash
   mkdir -p logs uploads
   ```

---

## Step A6 — Seed the database

Still in the SSH terminal:
```bash
cd ~/public_html/trivanta
node server/src/seed.js
```

You should see:
```
✅ Demo users created
✅ Matters, tasks, appointments, messages seeded
   Partner:  partner@trivanta.com  / Password123!
   Attorney: attorney@trivanta.com / Password123!
   Client:   client@trivanta.com   / Password123!
```

---

## Step A7 — Start the application

Back in hPanel **Node.js** panel → click **Restart** (or **Start**).

Then visit `https://yourdomain.com` — you should see the TriVanta login page.

> **If you see a 502/503:** wait 30 seconds and refresh. Node.js apps take a moment to boot.

---

---

# Path B — Hostinger VPS

### Prerequisites
- Hostinger KVM VPS (any size — 2GB RAM minimum recommended)
- Ubuntu 22.04 LTS
- SSH access with root or sudo user
- A domain with DNS A record pointing to your VPS IP

---

## Step B1 — Initial server setup

```bash
# Connect to your VPS
ssh root@YOUR_VPS_IP

# Update system
apt update && apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git nginx

# Install PM2 globally
npm install -g pm2

# Verify
node -v   # v20.x.x
npm -v    # 10.x.x
pm2 -v    # 5.x.x
```

---

## Step B2 — Create app user (security best practice)

```bash
# Create a dedicated user (do not run the app as root)
adduser trivanta --disabled-password --gecos ""
usermod -aG sudo trivanta
su - trivanta
```

---

## Step B3 — Upload the project

**Option A — Git (recommended):**
```bash
cd ~
git clone https://github.com/YOUR_ORG/lawsuit.git trivanta
cd trivanta
```

**Option B — Upload the zip:**
```bash
# On your local machine first:
bash hostinger-package.sh   # creates trivanta-hostinger-YYYYMMDD.zip

# Then upload to VPS:
scp trivanta-hostinger-*.zip trivanta@YOUR_VPS_IP:~/
# On VPS:
cd ~
unzip trivanta-hostinger-*.zip -d trivanta
cd trivanta
```

---

## Step B4 — Configure environment

```bash
cp .env.example .env
nano .env
```

Set these values:
```env
NODE_ENV=production
PORT=5000
JWT_SECRET=<run: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
JWT_EXPIRES_IN=7d
DB_PATH=/home/trivanta/trivanta/trivanta.db
CLIENT_URL=https://yourdomain.com
UPLOAD_DIR=/home/trivanta/trivanta/uploads
MAX_FILE_SIZE_MB=20
```

Save and close (`Ctrl+X → Y → Enter` in nano).

---

## Step B5 — Run the deployment script

```bash
bash deploy.sh
```

This installs deps, builds the React frontend, and seeds the database.

---

## Step B6 — Start with PM2

```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup   # copy and run the printed command to enable auto-start on reboot
```

Check it's running:
```bash
pm2 status
pm2 logs trivanta --lines 50
```

You should see: `🚀 TriVanta server running on port 5000 (production)`

---

## Step B7 — Configure Nginx reverse proxy

```bash
sudo nano /etc/nginx/sites-available/trivanta
```

Paste this config (replace `yourdomain.com`):
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Increase upload limit to match app setting
    client_max_body_size 25M;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }
}
```

Enable and test:
```bash
sudo ln -s /etc/nginx/sites-available/trivanta /etc/nginx/sites-enabled/
sudo nginx -t          # must say "test is successful"
sudo systemctl reload nginx
```

---

## Step B8 — SSL Certificate (HTTPS)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts. Certbot auto-renews — confirm with:
```bash
sudo certbot renew --dry-run
```

Your site is now live at `https://yourdomain.com` 🎉

---

---

# New User Registration

TriVanta supports self-registration for clients. Any visitor can:
1. Go to `https://yourdomain.com/register`
2. Fill in first name, last name, email, password
3. Their role defaults to `client`
4. They can immediately log in and submit an intake form

Attorneys and partners are created only via direct database seeding or an admin tool (no public signup for privileged roles by design).

---

# PWA — Install as Mobile App

TriVanta is a **Progressive Web App**. No app store needed.

**iOS (Safari):**
1. Open your domain in Safari
2. Tap the Share icon → **Add to Home Screen**
3. The app icon appears on your home screen

**Android (Chrome):**
1. Open your domain in Chrome
2. Tap the menu (⋮) → **Add to Home Screen** / **Install App**
3. Full-screen app experience

---

# Troubleshooting

**App not starting:**
```bash
pm2 logs trivanta --lines 100
# look for the actual error message
```

**Port conflict (VPS):**
```bash
pm2 delete trivanta
pm2 start ecosystem.config.js --env production
```

**Database issues:**
```bash
node server/src/seed.js   # re-runs seed (skips existing users)
```

**Nginx 502 Bad Gateway:**
```bash
pm2 status   # is the app running?
curl http://127.0.0.1:5000/api/health   # should return {"status":"ok"}
sudo nginx -t && sudo systemctl reload nginx
```

**Permission denied on uploads:**
```bash
chmod 755 uploads/
chown -R trivanta:trivanta uploads/
```

**Reset everything (clean start):**
```bash
pm2 delete trivanta
rm -f trivanta.db
node server/src/seed.js
pm2 start ecosystem.config.js --env production
```

---

# File Structure (production)

```
trivanta/
├── client/
│   └── dist/               ← built React app (served by Express)
├── server/
│   ├── src/
│   │   ├── index.js        ← Express entry point
│   │   ├── database.js
│   │   ├── seed.js
│   │   └── routes/
│   └── node_modules/       ← server deps (installed on server)
├── uploads/                ← document file storage
├── logs/                   ← PM2 logs
├── trivanta.db             ← SQLite database
├── .env                    ← YOUR CONFIG (never commit)
├── ecosystem.config.js     ← PM2 config
├── deploy.sh               ← one-command deploy
└── hostinger-package.sh    ← builds deployment zip
```
