# TriVanta — Windows Deployment Package Builder
# Run from the project root: .\build-deploy-package.ps1
# Creates trivanta-deploy-YYYYMMDD.zip ready to upload to Hostinger

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  TriVanta — Deployment Package Builder" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Build React frontend
Write-Host "Step 1/3 — Building React frontend..." -ForegroundColor Yellow
Push-Location "$root\client"
npm install --silent
npm run build
Pop-Location
Write-Host "  [OK] Frontend built -> client/dist/" -ForegroundColor Green

# 2. Prepare temp staging directory
$date     = Get-Date -Format "yyyyMMdd"
$zipName  = "trivanta-deploy-$date.zip"
$zipPath  = "$root\$zipName"
$temp     = "$root\__deploy_staging__"

Write-Host ""
Write-Host "Step 2/3 — Staging files..." -ForegroundColor Yellow

if (Test-Path $temp) { Remove-Item $temp -Recurse -Force }
New-Item -ItemType Directory -Path $temp | Out-Null

# client/dist
Copy-Item "$root\client\dist" "$temp\client\dist" -Recurse

# server (src + package files, no node_modules)
New-Item -ItemType Directory -Path "$temp\server\src" | Out-Null
Copy-Item "$root\server\src"  "$temp\server\src"  -Recurse -Force
Copy-Item "$root\server\package.json" "$temp\server\package.json"
if (Test-Path "$root\server\package-lock.json") {
    Copy-Item "$root\server\package-lock.json" "$temp\server\package-lock.json"
}

# root config & scripts
$rootFiles = @(
    "package.json",
    ".env.example",
    "ecosystem.config.js",
    "deploy.sh",
    "startup.sh",
    "HOSTINGER_DEPLOY.md",
    "UPLOAD_TO_HOSTINGER.md"
)
foreach ($f in $rootFiles) {
    if (Test-Path "$root\$f") {
        Copy-Item "$root\$f" "$temp\$f"
    }
}

Write-Host "  [OK] Files staged" -ForegroundColor Green

# 3. Create zip
Write-Host ""
Write-Host "Step 3/3 — Creating zip..." -ForegroundColor Yellow

if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Compress-Archive -Path "$temp\*" -DestinationPath $zipPath

# Cleanup temp
Remove-Item $temp -Recurse -Force

$sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host "  [OK] $zipName ($sizeMB MB)" -ForegroundColor Green

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  DONE!  Package ready:" -ForegroundColor Green
Write-Host "  $zipPath" -ForegroundColor White
Write-Host ""
Write-Host "  Upload this zip to Hostinger." -ForegroundColor Yellow
Write-Host "  Read UPLOAD_TO_HOSTINGER.md for steps." -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
