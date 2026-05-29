# ─────────────────────────────────────────────────────────────────────────────
# PocketWallet — Android AAB Builder
# Double-click this file (or run in PowerShell) to build your Android AAB.
# ─────────────────────────────────────────────────────────────────────────────

Set-Location $PSScriptRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PocketWallet — Android AAB Builder" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Check Node ────────────────────────────────────────────────────────
Write-Host "[1/5] Checking Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "ERROR: Node.js is not installed." -ForegroundColor Red
    Write-Host "Download from https://nodejs.org and re-run this script." -ForegroundColor Red
    pause; exit 1
}
Write-Host "      Node $nodeVersion found." -ForegroundColor Green

# ── Step 2: Install / update EAS CLI ─────────────────────────────────────────
Write-Host ""
Write-Host "[2/5] Installing EAS CLI (latest)..." -ForegroundColor Yellow
npm install -g eas-cli 2>&1 | Out-Null
$easVersion = eas --version 2>$null
Write-Host "      EAS CLI $easVersion ready." -ForegroundColor Green

# ── Step 3: Login to Expo ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "[3/5] Logging in to Expo..." -ForegroundColor Yellow
Write-Host "      (Enter your expo.dev credentials when prompted)" -ForegroundColor Gray
eas login
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Login failed. Check credentials and try again." -ForegroundColor Red
    pause; exit 1
}
Write-Host "      Logged in." -ForegroundColor Green

# ── Step 4: Build Android AAB ─────────────────────────────────────────────────
Write-Host ""
Write-Host "[4/5] Starting Android production build (AAB)..." -ForegroundColor Yellow
Write-Host "      This runs in Expo's cloud — takes ~10-15 minutes." -ForegroundColor Gray
Write-Host "      Say YES when asked to create/manage the keystore." -ForegroundColor Gray
Write-Host ""
eas build --platform android --profile production --non-interactive
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Build failed or was cancelled." -ForegroundColor Red
    pause; exit 1
}

# ── Step 5: Open build dashboard ─────────────────────────────────────────────
Write-Host ""
Write-Host "[5/5] Build submitted! Opening your Expo dashboard..." -ForegroundColor Yellow
Start-Process "https://expo.dev/accounts/dharmatejapasala/projects/pocket-wallet/builds"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Done! Download your AAB from the" -ForegroundColor Green
Write-Host "  Expo dashboard link that just opened." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
pause
