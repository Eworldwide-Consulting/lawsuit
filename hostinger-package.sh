#!/bin/bash
# TriVanta – Hostinger Deployment Package Builder
# Creates a production-ready zip to upload via Hostinger File Manager.
# Run from the project root: bash hostinger-package.sh
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }

PACKAGE_NAME="trivanta-hostinger-$(date +%Y%m%d-%H%M).zip"

echo ""
echo "📦 TriVanta – Hostinger Package Builder"
echo "========================================"
echo ""

# ── 1. Verify Node.js ─────────────────────────────────────────────────────────
command -v node &>/dev/null || { echo "❌ Node.js not found."; exit 1; }
ok "Node.js $(node -v)"

# ── 2. Install ALL deps (client needs devDeps for the build) ──────────────────
echo ""
echo "📦 Installing dependencies..."
npm install --prefix server
npm install --prefix client
ok "Dependencies ready"

# ── 3. Build React frontend ───────────────────────────────────────────────────
echo ""
echo "🔨 Building frontend..."
npm run build --prefix client
ok "Frontend built → client/dist/"

# ── 4. Create required dirs ───────────────────────────────────────────────────
mkdir -p logs uploads

# ── 5. Build zip (exclude dev files) ─────────────────────────────────────────
echo ""
echo "🗜  Creating deployment package: $PACKAGE_NAME"

zip -r "$PACKAGE_NAME" . \
  --exclude "*.git*" \
  --exclude "node_modules/*" \
  --exclude "server/node_modules/*" \
  --exclude "client/node_modules/*" \
  --exclude "client/src/*" \
  --exclude "*.env" \
  --exclude "trivanta.db" \
  --exclude "uploads/*" \
  --exclude "logs/*" \
  --exclude "*.log" \
  --exclude "hostinger-package.sh" \
  --exclude "e2e-test.js" \
  --exclude ".DS_Store" \
  --exclude "*.bak"

ok "Package created: $PACKAGE_NAME"

# ── 6. Summary ───────────────────────────────────────────────────────────────
SIZE=$(du -sh "$PACKAGE_NAME" | cut -f1)
echo ""
echo "========================================"
echo "📦 Package : $PACKAGE_NAME ($SIZE)"
echo ""
echo "Upload this zip to Hostinger File Manager"
echo "into your domain's public_html folder,"
echo "then extract it there."
echo ""
echo "Next: follow HOSTINGER_DEPLOY.md → hPanel steps."
echo "========================================"
