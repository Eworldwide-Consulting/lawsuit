# TriVanta — Hostinger Manual Installation Guide

> **Target server:** `92.112.187.20` (u511005792)  
> **App path:** `/home/u511005792/domains/gkasevault.io/nodejs/`  
> **Live URL:** `https://gkasevault.io`

---

## Part A — Build the Zip on Your Windows Machine

Open PowerShell in the project root and run:

```powershell
.\build-for-hostinger.ps1
```

This will:
1. Run `npm run build` inside `client/` (compiles React → `client/dist/`)
2. Stage only the files needed in production (no `node_modules`, no `.env`, no source maps)
3. Create `trivanta-deploy-<timestamp>.zip` in the project root

---

## Part B — Upload to Hostinger

### Option 1 — hPanel File Manager (easiest, no extra tools)

1. Log in at **https://hpanel.hostinger.com**
2. Sidebar → **Files** → **File Manager**
3. Navigate to:  
   `/home/u511005792/domains/gkasevault.io/nodejs/`
4. Click **Upload** → select `trivanta-deploy-<timestamp>.zip`
5. After upload completes, right-click the zip → **Extract Here**
6. Delete the zip file after extraction

### Option 2 — Upload via SCP (faster for large zips)

Run in PowerShell (uses port 65002):

```powershell
scp -P 65002 trivanta-deploy-*.zip u511005792@92.112.187.20:/home/u511005792/domains/gkasevault.io/nodejs/
```

Then SSH in and extract:

```bash
ssh -p 65002 u511005792@92.112.187.20
cd /home/u511005792/domains/gkasevault.io/nodejs/
unzip trivanta-deploy-*.zip
rm trivanta-deploy-*.zip
```

---

## Part C — Create the `.env` File on the Server

After extraction, SSH into the server and create the environment file:

```bash
ssh -p 65002 u511005792@92.112.187.20
cd /home/u511005792/domains/gkasevault.io/nodejs/
```

Create `.env` (copy and fill in your real values):

```bash
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
JWT_SECRET=REPLACE_WITH_64_CHAR_HEX
JWT_EXPIRES_IN=7d
DATABASE_URL=mysql://u511005792_dbadmin:YOUR_DB_PASSWORD@127.0.0.1:3306/u511005792_lawsuit
MYSQL_SOCKET=/var/lib/mysql/mysql.sock
CLIENT_URL=https://gkasevault.io
SERVER_URL=https://gkasevault.io
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM=TriVanta Legal <your-gmail@gmail.com>
UPLOAD_DIR=/home/u511005792/domains/gkasevault.io/nodejs/uploads
MAX_FILE_SIZE_MB=20
EOF
```

Verify it loaded correctly:
```bash
grep -c "=" .env          # should print 16 or more
grep NODE_ENV .env         # should print: NODE_ENV=production
```

Generate a strong JWT_SECRET if you don't have one:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Part D — Install Server Dependencies

**Must run on Linux** (Windows binaries won't work on Hostinger):

```bash
cd /home/u511005792/domains/gkasevault.io/nodejs/
npm install --prefix server --omit=dev
```

Verify critical modules installed:
```bash
ls server/node_modules | grep -E "express|mysql2|bcryptjs|jsonwebtoken"
```

---

## Part E — Set File Permissions

```bash
cd /home/u511005792/domains/gkasevault.io/nodejs/
chmod 755 uploads
chmod 644 .env
mkdir -p logs && chmod 755 logs
```

---

## Part F — Start the Application

### Method 1 — hPanel Node.js Manager (recommended for Hostinger)

1. Go to **hPanel → Hosting → Node.js**
2. If the app is already listed as `trivanta`:
   - Click **Restart**
3. If not yet configured:
   - Click **Create Application**
   - **Node.js version:** 20
   - **Application root:** `/home/u511005792/domains/gkasevault.io/nodejs`
   - **Application URL:** `gkasevault.io`
   - **Application startup file:** `server/src/index.js`
   - Click **Create**

### Method 2 — PM2 via SSH (if PM2 is available)

```bash
cd /home/u511005792/domains/gkasevault.io/nodejs/

# First time
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup   # run the printed command to enable auto-start

# Subsequent deploys
pm2 restart trivanta
```

### Method 3 — hPanel touch trigger (simplest restart)

```bash
touch /home/u511005792/domains/gkasevault.io/nodejs/server/src/index.js
```

---

## Part G — Verify the Application is Running

Wait ~30 seconds after restart, then check the health endpoint:

```bash
# From the server (instant)
curl http://localhost:3000/api/health

# From your browser or terminal (through the domain)
curl https://gkasevault.io/api/health
```

Expected response:
```json
{
  "status": "ok",
  "db": "ok",
  "env": "production",
  "uptime": 45
}
```

If you see `"db": { "error": "..." }`, the database connection failed — check `DATABASE_URL` and `MYSQL_SOCKET` in `.env`.

---

## Part H — Run Database Seed (First Install Only)

Only needed on a **fresh** database with no data:

```bash
cd /home/u511005792/domains/gkasevault.io/nodejs/
node server/src/seed.js
```

This creates demo users, matter types, and checklist templates.

---

## Troubleshooting

| Symptom | Where to look | Fix |
|---------|--------------|-----|
| 503 on all pages | hPanel → Node.js → Logs | Check if process crashed on startup |
| App starts but API fails | `curl localhost:3000/api/health` | Check `db` field — likely bad DATABASE_URL |
| White screen, no assets | Check `client/dist/index.html` exists | Re-run build or re-upload zip |
| Login fails with 500 | Server logs | Missing JWT_SECRET in .env |
| Email not sending | Server logs | Check SMTP_USER / SMTP_PASS |

### View live logs via SSH

```bash
# hPanel-managed process
tail -f /home/u511005792/domains/gkasevault.io/nodejs/logs/out.log

# PM2 managed
pm2 logs trivanta --lines 100
```

---

## File Structure Inside the Zip

```
trivanta-deploy-<timestamp>.zip
├── server/
│   ├── src/              ← all Express.js server code
│   └── package.json      ← server dependencies
├── client/
│   └── dist/             ← pre-built React SPA (HTML + hashed JS/CSS)
├── package.json          ← root package (npm start → node server/src/index.js)
├── ecosystem.config.js   ← PM2 config
├── .env.example          ← template — copy to .env and fill in values
├── logs/                 ← empty placeholder
└── uploads/              ← empty placeholder
```

`node_modules/` is **intentionally excluded** — always install on the Linux server.  
`.env` is **intentionally excluded** — create it manually on the server (Step C).