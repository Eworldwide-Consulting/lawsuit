# TriVanta -- Production Deployment Package Builder for Hostinger
# Usage: .\build-deployment-package.ps1
# Produces: trivanta-prod-YYYYMMDD_HHmmss.zip  ready to upload to Hostinger

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

function ok($msg)   { Write-Host "  [OK]  $msg" -ForegroundColor Green }
function warn($msg) { Write-Host "  [WRN] $msg" -ForegroundColor Yellow }
function fail($msg) { Write-Host "  [ERR] $msg" -ForegroundColor Red; exit 1 }
function step($msg) { Write-Host "" ; Write-Host ">> $msg" -ForegroundColor Cyan }

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  TriVanta Deployment Package Builder      " -ForegroundColor Cyan
Write-Host "  Target: Hostinger hPanel / VPS           " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# -- Pre-flight checks --------------------------------------------------------
step "Pre-flight checks"

try {
  $nodeVer = node -e "process.stdout.write(process.versions.node)"
  $nodeMajor = [int]($nodeVer -split '\.')[0]
  if ($nodeMajor -lt 18) { fail "Node.js 18+ required. Found: $nodeVer" }
  ok "Node.js $nodeVer"
} catch { fail "Node.js not found. Install from https://nodejs.org" }

try {
  $npmVer = npm --version
  ok "npm $npmVer"
} catch { fail "npm not found" }

if (-not (Test-Path "$root\client\package.json")) { fail "client/package.json not found" }
if (-not (Test-Path "$root\server\package.json")) { fail "server/package.json not found" }
ok "Project structure verified"

# -- Build React frontend -----------------------------------------------------
step "Building React frontend"

Push-Location "$root\client"
try {
  npm install --silent
  if (-not $?) { fail "npm install (client) failed" }
  npm run build
  if (-not $?) { fail "npm run build (client) failed" }
} finally {
  Pop-Location
}
if (-not (Test-Path "$root\client\dist\index.html")) {
  fail "Build produced no output (client/dist/index.html missing)"
}
ok "Frontend built -> client/dist/"

# -- Assemble staging directory -----------------------------------------------
step "Assembling deployment package"

$stagingDir = "$env:TEMP\trivanta_deploy_$([System.Guid]::NewGuid())"
New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

# client/dist -- pre-built static assets (no client/src)
Copy-Item "$root\client\dist" "$stagingDir\client\dist" -Recurse -Force
ok "client/dist copied"

# server/src -- application source (no node_modules)
Copy-Item "$root\server\src" "$stagingDir\server\src" -Recurse -Force
ok "server/src copied"

# package.json + package-lock.json at ROOT (required: Hostinger hPanel looks for
# package.json at Root directory "./" to run npm install before starting the app)
Copy-Item "$root\server\package.json" "$stagingDir\package.json" -Force
if (Test-Path "$root\server\package-lock.json") {
  Copy-Item "$root\server\package-lock.json" "$stagingDir\package-lock.json" -Force
  ok "package.json + package-lock.json at root (enables npm ci)"
} else {
  warn "server/package-lock.json not found -- run 'npm install --prefix server' locally first"
}

# Also keep a copy at server/ for VPS deployments that use startup.sh
Copy-Item "$root\server\package.json" "$stagingDir\server\package.json" -Force

# Root config files
$rootFiles = @(
  'ecosystem.config.js',
  'startup.sh',
  'deploy.sh',
  'healthcheck.sh',
  '.env.example',
  'HOSTINGER_DEPLOY.md',
  'supabase-schema.sql'
)
foreach ($f in $rootFiles) {
  $src = "$root\$f"
  if (Test-Path $src) {
    Copy-Item $src "$stagingDir\$f" -Force
  } else {
    warn "$f not found, skipping"
  }
}
ok "Root config files copied"

# Placeholder directories -- startup.sh creates them, but pre-create so paths
# exist immediately after the zip is extracted (avoids first-boot 500s).
New-Item -ItemType Directory -Force -Path "$stagingDir\logs"   | Out-Null
New-Item -ItemType Directory -Force -Path "$stagingDir\uploads" | Out-Null
Set-Content -Path "$stagingDir\logs\.gitkeep"   -Value ""
Set-Content -Path "$stagingDir\uploads\.gitkeep" -Value ""
ok "logs/ and uploads/ placeholder dirs created"

# Build metadata
$gitHash = 'unknown'
try { $gitHash = (git -C $root rev-parse --short HEAD 2>$null).Trim() } catch {}
if (-not $gitHash) { $gitHash = 'unknown' }

$buildObj = @{
  built_at     = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')
  node_version = $nodeVer
  git_commit   = $gitHash
}
$buildObj | ConvertTo-Json | Set-Content -Path "$stagingDir\BUILD_INFO.json"
ok "BUILD_INFO.json written (node=$nodeVer, git=$gitHash)"

# -- Create ZIP ---------------------------------------------------------------
step "Compressing to ZIP"

$date    = Get-Date -Format 'yyyyMMdd_HHmmss'
$zipName = "trivanta-prod-$date.zip"
$zipPath = "$root\$zipName"

if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($stagingDir, $zipPath)

if (Test-Path $stagingDir) { Remove-Item $stagingDir -Recurse -Force }

$sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
ok "ZIP created: $zipName  ($sizeMB MB)"

# -- Done ---------------------------------------------------------------------
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT PACKAGE READY                 " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  File : $zipName" -ForegroundColor White
Write-Host "  Size : $sizeMB MB" -ForegroundColor White
Write-Host "  Path : $zipPath" -ForegroundColor White
Write-Host ""
Write-Host "Next steps (Hostinger hPanel Node.js):" -ForegroundColor Cyan
Write-Host "  1. hPanel -> Node.js app -> Upload new files -> select $zipName"
Write-Host "     (hPanel auto-extracts and runs npm install)"
Write-Host "  2. Confirm env vars are set: DATABASE_URL, GOOGLE_CLIENT_SECRET"
Write-Host "  3. hPanel -> Node.js -> Entry file: server/src/index.js -> Restart"
Write-Host "  4. Verify: curl https://yourdomain.com/api/health"
Write-Host ""
Write-Host "Next steps (VPS with PM2):" -ForegroundColor Cyan
Write-Host "  1. scp $zipName user@YOUR_VPS_IP:~/"
Write-Host "  2. ssh user@YOUR_VPS_IP"
Write-Host "  3. unzip $zipName -d trivanta && cd trivanta"
Write-Host "  4. bash startup.sh"
Write-Host "  5. pm2 start ecosystem.config.js --env production"
Write-Host "  6. pm2 save && pm2 startup"
Write-Host "  7. crontab -e  -- add: */5 * * * * ~/trivanta/healthcheck.sh"
Write-Host ""
Write-Host "See HOSTINGER_DEPLOY.md for full instructions." -ForegroundColor Cyan
Write-Host ""
