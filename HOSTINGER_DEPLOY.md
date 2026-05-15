# Trivanta – Hostinger Deployment Guide

## Requirements
- Hostinger VPS (Ubuntu 22.04 recommended) or Cloud Hosting with Node.js
- Node.js 18+
- PM2 (`npm install -g pm2`)

---

## Step 1 — Upload files to Hostinger

```bash
# Via SSH (recommended):
scp -r ./trivanta user@YOUR_VPS_IP:/home/user/
ssh user@YOUR_VPS_IP
cd trivanta
```

Or use Hostinger's File Manager to upload the project zip.

---

## Step 2 — Install Node.js (if needed)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # should be 18+
npm install -g pm2
```

---

## Step 3 — Configure environment

```bash
cp .env.example server/.env
nano server/.env
```

Set these values in `server/.env`:
```
NODE_ENV=production
PORT=5000
JWT_SECRET=<generate a strong random secret>
DB_PATH=./trivanta.db
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=20
```

Generate a JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Step 4 — Run the deployment script

```bash
bash deploy.sh
```

This will:
1. Install all dependencies
2. Build the React frontend
3. Seed the database with demo data

---

## Step 5 — Start with PM2

```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup   # follow the printed command to auto-start on reboot
```

Check status:
```bash
pm2 status
pm2 logs trivanta
```

---

## Step 6 — Configure Nginx (optional but recommended)

Install Nginx:
```bash
sudo apt install nginx -y
```

Create config at `/etc/nginx/sites-available/trivanta`:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Upload size
    client_max_body_size 25M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and start:
```bash
sudo ln -s /etc/nginx/sites-available/trivanta /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Step 7 — SSL Certificate (HTTPS)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## Mobile App (iOS & Android)

Trivanta is a **Progressive Web App (PWA)**. Users can install it:

**iOS (Safari):**
1. Open your domain in Safari
2. Tap the Share button
3. Tap "Add to Home Screen"
4. The app appears as a native-looking icon

**Android (Chrome):**
1. Open your domain in Chrome
2. Tap the menu (⋮)
3. Tap "Add to Home Screen" or "Install App"
4. App installs with full-screen mode

For native iOS/Android apps, use **Capacitor** to wrap the PWA:
```bash
npm install -g @capacitor/cli
npx cap init Trivanta com.trivanta.app
npx cap add ios
npx cap add android
cd client && npm run build
npx cap copy
npx cap open ios    # opens Xcode
npx cap open android # opens Android Studio
```

---

## Demo Accounts

After seeding:

| Role | Email | Password |
|------|-------|----------|
| Managing Partner | partner@trivanta.com | Password123! |
| Attorney | attorney@trivanta.com | Password123! |
| Client | client@trivanta.com | Password123! |

---

## File Structure

```
trivanta/
├── client/          # React PWA frontend
│   ├── dist/        # Built static files (after npm run build)
│   └── src/
├── server/          # Express API backend
│   ├── src/
│   └── .env         # Your config (never commit!)
├── uploads/         # Uploaded documents
├── trivanta.db    # SQLite database
├── ecosystem.config.js  # PM2 config
└── deploy.sh        # One-command deploy
```

## Troubleshooting

**Port already in use:**
```bash
pm2 delete trivanta
pm2 start ecosystem.config.js --env production
```

**Database issues:**
```bash
cd server && node src/seed.js
```

**Check logs:**
```bash
pm2 logs trivanta --lines 100
```
