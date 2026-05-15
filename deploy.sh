#!/bin/bash
set -e

echo "🚀 Trivanta Deployment Script"
echo "================================"

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Install Node.js 18+ first."
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Node.js 18+ required. Current: $(node -v)"
  exit 1
fi

echo "✅ Node.js $(node -v)"

# Create .env if not exists
if [ ! -f server/.env ]; then
  echo "Creating server/.env from example..."
  cp .env.example server/.env
  # Generate random JWT secret
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
  sed -i.bak "s/your-super-secret-jwt-key-change-this-in-production/$JWT_SECRET/" server/.env
  rm -f server/.env.bak
  echo "⚠️  Edit server/.env to set your configuration!"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install --prefix server --production
npm install --prefix client

# Build React frontend
echo ""
echo "🔨 Building React frontend..."
npm run build --prefix client

# Create logs directory
mkdir -p logs uploads

# Seed database (first run only)
if [ ! -f trivanta.db ]; then
  echo ""
  echo "🌱 Seeding database with demo data..."
  cd server && node src/seed.js && cd ..
fi

echo ""
echo "✅ Build complete!"
echo ""
echo "To start the server:"
echo "  NODE_ENV=production node server/src/index.js"
echo ""
echo "Or with PM2:"
echo "  pm2 start ecosystem.config.js --env production"
echo "  pm2 save && pm2 startup"
echo ""
echo "Demo accounts:"
echo "  Partner:  partner@trivanta.com / Password123!"
echo "  Attorney: attorney@trivanta.com / Password123!"
echo "  Client:   client@trivanta.com  / Password123!"
