#!/bin/bash
# TriVanta – Production Deployment Script
# Run from the project root: bash deploy.sh
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
err()  { echo -e "${RED}❌ $1${NC}"; exit 1; }

echo ""
echo "🚀 TriVanta Deployment Script"
echo "================================"
echo ""

# ── 1. Node.js version check ──────────────────────────────────────────────────
command -v node &>/dev/null || err "Node.js not found. Install Node.js 20+ first."
NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
[ "$NODE_VER" -ge 18 ] || err "Node.js 18+ required. Found: $(node -v)"
ok "Node.js $(node -v)"

# ── 2. Create .env at project root (where server reads it from) ───────────────
if [ ! -f .env ]; then
  warn ".env not found — generating from .env.example..."
  cp .env.example .env

  # Auto-generate a strong JWT secret
  JWT=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
  # Works on both Linux (sed -i) and macOS (sed -i '')
  sed -i.bak "s|REPLACE_WITH_64_CHAR_RANDOM_HEX_STRING|$JWT|" .env && rm -f .env.bak

  warn "Edit .env now to set CLIENT_URL=https://yourdomain.com then re-run."
  warn "Opening .env for editing in 3 seconds... (Ctrl+C to skip)"
  sleep 3
  ${EDITOR:-nano} .env || true
else
  ok ".env exists"
fi

# ── 3. Install dependencies ───────────────────────────────────────────────────
echo ""
echo "📦 Installing server dependencies..."
npm install --prefix server --omit=dev
ok "Server deps installed"

echo ""
echo "📦 Installing client dependencies..."
npm install --prefix client
ok "Client deps installed"

# ── 4. Build React frontend ───────────────────────────────────────────────────
echo ""
echo "🔨 Building React frontend..."
npm run build --prefix client
ok "Frontend built → client/dist/"

# ── 5. Create required directories ────────────────────────────────────────────
mkdir -p logs uploads
ok "Directories: logs/ uploads/"

# ── 6. Seed database (first run only) ────────────────────────────────────────
DB_FILE=$(node -e "require('dotenv').config(); console.log(process.env.DB_PATH || './trivanta.db')")
if [ ! -f "$DB_FILE" ]; then
  echo ""
  echo "🌱 Seeding database with demo data..."
  node server/src/seed.js
  ok "Database seeded: $DB_FILE"
else
  ok "Database exists: $DB_FILE (skipping seed)"
fi

# ── 7. Done ───────────────────────────────────────────────────────────────────
echo ""
echo "========================================"
ok "Build complete!"
echo ""
echo "Start with PM2 (recommended):"
echo "  pm2 start ecosystem.config.js --env production"
echo "  pm2 save && pm2 startup"
echo ""
echo "Or start directly:"
echo "  NODE_ENV=production node server/src/index.js"
echo ""
echo "Demo accounts (seed data):"
echo "  Partner:  partner@trivanta.com  / Password123!"
echo "  Attorney: attorney@trivanta.com / Password123!"
echo "  Client:   client@trivanta.com   / Password123!"
echo "========================================"
