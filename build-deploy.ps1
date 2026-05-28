# TriVanta – Hostinger Deployment Package Builder (Windows / PowerShell)
# Usage: .\build-deploy.ps1
# Produces: trivanta-hostinger-YYYYMMDD-HHmm.zip  ready to upload to Hostinger File Manager

$ErrorActionPreference = 'Stop'

function ok($msg)   { Write-Host "OK  $msg" -ForegroundColor Green }
function warn($msg) { Write-Host "WRN $msg" -ForegroundColor Yellow }
function fail($msg) { Write-Host "ERR $msg" -ForegroundColor Red; exit 1 }

$timestamp   = Get-Date -Format 'yyyyMMdd-HHmm'
$packageName = "trivanta-hostinger-$timestamp.zip"

Write-Host ""
Write-Host "TriVanta - Hostinger Package Builder (PowerShell)" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verify Node.js
try { $nodeVer = (node -v 2>&1); ok "Node.js $nodeVer" }
catch { fail "Node.js not found. Install from https://nodejs.org" }

# 2. Install dependencies
Write-Host ""
Write-Host "Installing client dependencies..."
npm install --prefix client
if (-not $?) { fail "npm install (client) failed" }
ok "Client dependencies ready"

Write-Host "Installing server dependencies..."
npm install --prefix server
if (-not $?) { fail "npm install (server) failed" }
ok "Server dependencies ready"

# 3. Build React frontend
Write-Host ""
Write-Host "Building frontend..."
npm run build --prefix client
if (-not $?) { fail "Client build failed" }
ok "Frontend built -> client/dist/"

# 4. Create required directories
New-Item -ItemType Directory -Force -Path logs  | Out-Null
New-Item -ItemType Directory -Force -Path uploads | Out-Null
ok "Directories: logs/ uploads/"

# 5. Build zip (exclude dev / source-only folders)
Write-Host ""
Write-Host "Creating deployment package: $packageName ..."

$exclude = @(
  '.git', '.gitignore',
  'node_modules',
  'server\node_modules', 'server/node_modules',
  'client\node_modules', 'client/node_modules',
  'client\src',          'client/src',
  '.env',
  'uploads\*',           'uploads/*',
  'logs\*',              'logs/*',
  '*.log',
  'hostinger-package.sh',
  'build-deploy.ps1',
  'e2e-test.js',
  'e2e-extended.js',
  '.DS_Store',
  '*.bak'
)

# Collect all top-level items, then filter
$items = Get-ChildItem -Path . -Force | Where-Object {
  $name = $_.Name
  $skip = $false
  foreach ($ex in @('.git','node_modules','uploads','logs')) {
    if ($name -eq $ex) { $skip = $true; break }
  }
  -not $skip
}

# Use Compress-Archive on everything except excluded dirs/files
$filesToZip = @()
foreach ($item in $items) {
  $filesToZip += $item.FullName
}

Compress-Archive -Path $filesToZip -DestinationPath $packageName -Force
ok "Package created: $packageName"

# 6. Report size
$size = [math]::Round((Get-Item $packageName).Length / 1MB, 1)
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Package : $packageName  ($size MB)"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Upload $packageName to Hostinger File Manager -> public_html"
Write-Host "  2. Extract the zip there"
Write-Host "  3. SSH into the server and run:  bash startup.sh"
Write-Host "  4. In hPanel -> Node.js: set startup file = server/src/index.js, click Restart"
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
