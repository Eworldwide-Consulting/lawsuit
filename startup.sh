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
command -v node &>/dev/null || err "Node.js not found. Install Node.js 20.x first."
NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
[ "$NODE_VER" -ge 18 ] || err "Node.js 18+ required (found $(node -v))"
ok "Node.js $(node -v)"

# 2. Create .env from example
if [ ! -f .env ]; then
  cp .env.example .env

  # Auto-generate a strong JWT secret
  JWT=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
  sed -i "s|REPLACE_WITH_64_CHAR_RANDOM_HEX_STRING|$JWT|" .env
  ok ".env created with auto-generated JWT secret"
  warn "IMPORTANT: Open .env and set CLIENT_URL=https://yourdomain.com"
  warn "           Also set DB_PATH and UPLOAD_DIR to absolute paths."
  echo ""
  echo "  Example:"
  echo "  DB_PATH=/home/$(whoami)/public_html/trivanta/trivanta.db"
  echo "  UPLOAD_DIR=/home/$(whoami)/public_html/trivanta/uploads"
  echo "  CLIENT_URL=https://yourdomain.com"
  echo ""
  read -p "  Press Enter after editing .env to continue..." _
else
  ok ".env already exists"
fi

# 3. Install server production dependencies (compiles native modules for Linux)
echo ""
echo "📦 Installing server dependencies (this compiles native modules)..."
npm install --prefix server --omit=dev
ok "Server dependencies installed"

# 4. Create required directories
mkdir -p logs uploads
ok "Directories: logs/ uploads/"

# 5. Seed database
DB_FILE=$(node -e "require('dotenv').config(); console.log(process.env.DB_PATH || './trivanta.db')" 2>/dev/null || echo "./trivanta.db")
if [ ! -f "$DB_FILE" ]; then
  echo ""
  echo "🌱 Seeding database with demo data..."
  node server/src/seed.js
  ok "Database seeded: $DB_FILE"
else
  ok "Database already exists: $DB_FILE"
fi

# 6. Done — show next steps
echo ""
echo "========================================"
ok "Setup complete!"
echo ""
echo "Start options:"
echo ""
echo "  A) PM2 (recommended — keeps app alive):"
echo "     npm install -g pm2"
echo "     pm2 start ecosystem.config.js --env production"
echo "     pm2 save && pm2 startup"
echo ""
echo "  B) Hostinger hPanel Node.js:"
echo "     Set startup file to: server/src/index.js"
echo "     Click Restart in hPanel Node.js panel"
echo ""
echo "Demo accounts:"
echo "  Partner:  partner@trivanta.com  / Password123!"
echo "  Attorney: attorney@trivanta.com / Password123!"
echo "  Client:   client@trivanta.com   / Password123!"
echo "========================================"
