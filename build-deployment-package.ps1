# TriVanta — Production Deployment Package Builder for Hostinger
# Creates a deployable zip file with built frontend and server code

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  TriVanta Deployment Package Builder       " -ForegroundColor Cyan
Write-Host "  Production for Hostinger                 " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Build React frontend
Write-Host "Step 1/3 - Building React frontend..." -ForegroundColor Yellow
Push-Location "$root\client"
npm install --silent
npm run build
Pop-Location
Write-Host "  [OK] Frontend built successfully" -ForegroundColor Green

# 2. Create deployment zip
$date = Get-Date -Format "yyyyMMdd_HHmmss"
$zipName = "trivanta-prod-$date.zip"
$zipPath = "$root\$zipName"

Write-Host ""
Write-Host "Step 2/3 - Creating deployment package..." -ForegroundColor Yellow

# Create a temporary staging directory
$stagingDir = "$env:TEMP\trivanta_deploy_$([System.Guid]::NewGuid())"
New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

# Copy client dist
Copy-Item "$root\client\dist" "$stagingDir\client\dist" -Recurse -Force
Write-Host "  [OK] Client assets copied" -ForegroundColor Green

# Copy server source and config
Copy-Item "$root\server\src" "$stagingDir\server\src" -Recurse -Force
Copy-Item "$root\server\package.json" "$stagingDir\server\package.json" -Force
if (Test-Path "$root\server\package-lock.json") {
    Copy-Item "$root\server\package-lock.json" "$stagingDir\server\package-lock.json" -Force
}
Write-Host "  [OK] Server source copied" -ForegroundColor Green

# Copy root configuration files
$rootFiles = @(
    "package.json",
    ".env.example",
    "ecosystem.config.js",
    "deploy.sh",
    "startup.sh",
    "HOSTINGER_DEPLOY.md",
    "UPLOAD_TO_HOSTINGER.md"
)
foreach ($file in $rootFiles) {
    $filePath = "$root\$file"
    if (Test-Path $filePath) {
        Copy-Item $filePath "$stagingDir\$file" -Force
    }
}
Write-Host "  [OK] Configuration files copied" -ForegroundColor Green

# Create the zip file
Write-Host ""
Write-Host "Step 3/3 - Compressing to ZIP..." -ForegroundColor Yellow
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

[System.IO.Compression.ZipFile]::CreateFromDirectory($stagingDir, $zipPath)

$sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
Write-Host "  [OK] ZIP created successfully" -ForegroundColor Green

# Cleanup staging directory
if (Test-Path $stagingDir) {
    Remove-Item $stagingDir -Recurse -Force
}

# Display results
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT PACKAGE READY                " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Package: $zipName" -ForegroundColor White
Write-Host "Size: $sizeMB MB" -ForegroundColor White
Write-Host "Location: $zipPath" -ForegroundColor White
Write-Host ""
Write-Host "Deployment Instructions:" -ForegroundColor Cyan
Write-Host "  1. Upload $zipName to your Hostinger account" -ForegroundColor Gray
Write-Host "  2. Extract the ZIP in your public_html directory" -ForegroundColor Gray
Write-Host "  3. Configure .env file with database and API credentials" -ForegroundColor Gray
Write-Host "  4. Run: npm install && node server/src/index.js" -ForegroundColor Gray
Write-Host ""
Write-Host "See HOSTINGER_DEPLOY.md for detailed instructions" -ForegroundColor Cyan
Write-Host ""
Write-Host "Build completed successfully!" -ForegroundColor Green
Write-Host ""
