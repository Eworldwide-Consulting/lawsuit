# ─────────────────────────────────────────────────────────────────────────────
#  TriVanta — Hostinger Deployment Package Builder
#  Run from the project root:  .\build-for-hostinger.ps1
#  Output: trivanta-deploy-<timestamp>.zip  (ready to upload to hPanel)
# ─────────────────────────────────────────────────────────────────────────────

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ROOT      = Split-Path -Parent $MyInvocation.MyCommand.Path
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$ZIP_NAME  = "trivanta-deploy-$TIMESTAMP.zip"
$ZIP_PATH  = Join-Path $ROOT $ZIP_NAME
$STAGE     = Join-Path $env:TEMP "trivanta_stage_$TIMESTAMP"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TriVanta — Hostinger Package Builder" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Build React client ───────────────────────────────────────────────
Write-Host "[1/4] Building React client..." -ForegroundColor Yellow
Set-Location (Join-Path $ROOT "client")
npm install
if ($LASTEXITCODE -ne 0) { Write-Error "npm install (client) failed"; exit 1 }
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "React build failed"; exit 1 }
Set-Location $ROOT
Write-Host "      React build complete -> client/dist/" -ForegroundColor Green

# ── Step 2: Stage files ──────────────────────────────────────────────────────
Write-Host "[2/4] Staging deployment files..." -ForegroundColor Yellow

New-Item -ItemType Directory -Force -Path $STAGE | Out-Null

# Server source (no node_modules — installed on Linux host)
$serverStage = Join-Path $STAGE "server"
New-Item -ItemType Directory -Force -Path $serverStage | Out-Null
Copy-Item -Recurse -Force (Join-Path $ROOT "server\src")         (Join-Path $serverStage "src")
Copy-Item -Force           (Join-Path $ROOT "server\package.json") $serverStage
if (Test-Path (Join-Path $ROOT "server\package-lock.json")) {
    Copy-Item -Force (Join-Path $ROOT "server\package-lock.json") $serverStage
}

# React build output
$clientStage = Join-Path $STAGE "client"
New-Item -ItemType Directory -Force -Path $clientStage | Out-Null
Copy-Item -Recurse -Force (Join-Path $ROOT "client\dist") (Join-Path $clientStage "dist")

# Root config files
Copy-Item -Force (Join-Path $ROOT "package.json")        $STAGE
Copy-Item -Force (Join-Path $ROOT "ecosystem.config.js") $STAGE
Copy-Item -Force (Join-Path $ROOT ".env.example")        $STAGE

# Startup script
$startupSrc = Join-Path $ROOT "startup.sh"
if (Test-Path $startupSrc) { Copy-Item -Force $startupSrc $STAGE }

# Placeholder directories (Hostinger needs them to exist)
New-Item -ItemType Directory -Force -Path (Join-Path $STAGE "logs")    | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $STAGE "uploads") | Out-Null

Write-Host "      Staged to: $STAGE" -ForegroundColor Green

# ── Step 3: Zip ──────────────────────────────────────────────────────────────
Write-Host "[3/4] Creating zip archive..." -ForegroundColor Yellow
if (Test-Path $ZIP_PATH) { Remove-Item -Force $ZIP_PATH }
Compress-Archive -Path (Join-Path $STAGE "*") -DestinationPath $ZIP_PATH -CompressionLevel Optimal
Remove-Item -Recurse -Force $STAGE
Write-Host "      Archive: $ZIP_NAME" -ForegroundColor Green

# ── Step 4: Summary ──────────────────────────────────────────────────────────
$size = [math]::Round((Get-Item $ZIP_PATH).Length / 1MB, 2)
Write-Host ""
Write-Host "[4/4] Done!" -ForegroundColor Green
Write-Host ""
Write-Host "  File : $ZIP_NAME" -ForegroundColor White
Write-Host "  Size : $size MB"  -ForegroundColor White
Write-Host "  Path : $ZIP_PATH" -ForegroundColor White
Write-Host ""
Write-Host "  Next step: Upload this zip to Hostinger hPanel" -ForegroundColor Cyan
Write-Host "  See HOSTINGER_INSTALL.md for full installation steps." -ForegroundColor Cyan
Write-Host ""