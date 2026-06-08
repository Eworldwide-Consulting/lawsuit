#!/bin/bash
# TriVanta – First-Run Setup (run this ONCE after extracting the zip on Hostinger)
# Usage: bash startup.sh
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
err()  { echo -e "${RED}❌ $1${NC}"; exit 1; }

echo ""
echo "🚀 TriVanta – Hostinger First-Run Setup"
echo "========================================"
echo ""

# 1. Node.js check
command -v node &>/dev/null || err "Node.js not found. Install Node.js 22.x via hPanel → Node.js."
NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
[ "$NODE_VER" -ge 18 ] || err "Node.js 18+ required (found $(node -v))"
ok "Node.js $(node -v)"

# 2. Create .env from example (skip if already exists)
if [ ! -f .env ]; then
  cp .env.example .env

  # Auto-generate a 64-char JWT secret
  JWT=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
  sed -i "s|REPLACE_WITH_64_CHAR_RANDOM_HEX_STRING|$JWT|" .env

  ok ".env created with auto-generated JWT secret"
  warn "IMPORTANT: Open .env and fill in the required values before starting:"
  echo ""
  echo "  Required:"
  echo "  DATABASE_URL=mysql://USER:PASS@srv1619.hstgr.io:3306/u511005792_lawsuit"
  echo "  CLIENT_URL=https://gkasevault.io"
  echo "  SERVER_URL=https://gkasevault.io"
  echo "  SMTP_HOST / SMTP_USER / SMTP_PASS"
  echo ""
  echo "  Optional:"
  echo "  GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET"
  echo "  SEED_PASSWORD=<password for demo accounts>"
  echo ""
  read -p "  Press Enter after editing .env to continue..." _
else
  ok ".env already exists"
fi

# 3. Validate DATABASE_URL is set and is MySQL
DB_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2-)
if [[ -z "$DB_URL" || "$DB_URL" == mysql://USER* ]]; then
  err "DATABASE_URL is not set in .env — please add your MySQL connection string."
fi
ok "DATABASE_URL found"

# 4. Install server production dependencies (compiles native modules for Linux)
echo ""
echo "📦 Installing server dependencies..."
npm install --prefix server --omit=dev
ok "Server dependencies installed"

# 5. Build React frontend — SKIP if client/dist already exists (pre-built in zip)
echo ""
if [ -f "client/dist/index.html" ]; then
  ok "Frontend already built (client/dist/index.html exists) — skipping build"
else
  warn "client/dist not found — building frontend now (requires ~512MB RAM)..."
  npm install --prefix client
  npm run build --prefix client
  ok "Frontend built → client/dist/"
fi

# 6. Create required directories
mkdir -p logs uploads
chmod 755 uploads
ok "Directories: logs/ uploads/"

# 7. Seed MySQL with demo accounts (idempotent — safe to run again)
echo ""
read -p "  Seed demo accounts into MySQL? [y/N]: " DO_SEED
if [[ "$DO_SEED" =~ ^[Yy]$ ]]; then
  node server/src/seed.js
  ok "Database seeded with demo accounts"
  warn "Check SEED_PASSWORD in .env — that is the login password for demo accounts."
else
  ok "Skipped seed (existing data preserved)"
fi

# 8. Done
echo ""
echo "========================================"
ok "Setup complete!"
echo ""
echo "Start options:"
echo ""
echo "  A) Hostinger hPanel Node.js (recommended for shared/cloud hosting):"
echo "     → Go to hPanel → Node.js → set Entry file: server/src/index.js"
echo "     → Click Restart"
echo ""
echo "  B) PM2 (for VPS):"
echo "     npm install -g pm2"
echo "     pm2 start ecosystem.config.js --env production"
echo "     pm2 save && pm2 startup"
echo ""
echo "Demo accounts (password = SEED_PASSWORD value in .env):"
echo "  Partner:  partner@trivanta.com"
echo "  Attorney: attorney@trivanta.com"
echo "  Client:   client@trivanta.com"
echo "  IT:       itsupport@gkasevault.io"
echo "========================================"