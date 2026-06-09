# start.ps1 — Run the NFL Data Platform in production mode
# Serves both the API and the built React app from a single uvicorn process
# on http://localhost:8000

param(
    [int]$Port = 8000
)

$Root   = $PSScriptRoot
$Client = Join-Path $Root "client"
$Server = Join-Path $Root "server"
$Dist   = Join-Path $Client "dist"

# Build the frontend if dist is missing or stale
if (-not (Test-Path $Dist)) {
    Write-Host "Building frontend (first run)..." -ForegroundColor Cyan
    Push-Location $Client
    npm run build
    if ($LASTEXITCODE -ne 0) { Write-Error "npm build failed"; exit 1 }
    Pop-Location
}

Write-Host "Starting server on http://localhost:$Port" -ForegroundColor Green
Push-Location $Server
& ".\venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port $Port
Pop-Location
