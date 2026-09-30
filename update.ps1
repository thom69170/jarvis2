$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
Set-Location $root

$repo = "thom69170/jarvis2"
$branch = "main"

$settingsPath = Join-Path $root "server\data\settings.json"
if (Test-Path $settingsPath) {
    try {
        $settings = Get-Content $settingsPath -Raw | ConvertFrom-Json
        if ($settings.update.repo) { $repo = $settings.update.repo }
        if ($settings.update.branch) { $branch = $settings.update.branch }
    } catch {
        Write-Host "Impossible de lire server\data\settings.json, utilisation du depot par defaut ($repo)." -ForegroundColor Yellow
    }
}

Write-Host "=== Mise a jour de Jarvis ===" -ForegroundColor Cyan
Write-Host "Depot : $repo (branche $branch)"
Write-Host ""

$zipUrl = "https://github.com/$repo/archive/refs/heads/$branch.zip"
$tempDir = Join-Path $env:TEMP ("jarvis-update-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tempDir | Out-Null
$zipPath = Join-Path $tempDir "update.zip"

Write-Host "Telechargement depuis GitHub..."
try {
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing
} catch {
    Write-Host "Echec du telechargement : $_" -ForegroundColor Red
    Write-Host "Verifie ta connexion internet, et que le depot/la branche configures dans /admin sont corrects (actuellement : $repo / $branch)." -ForegroundColor Red
    Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    Read-Host "Appuie sur Entree pour fermer"
    exit 1
}

Write-Host "Extraction..."
Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force

$extracted = Get-ChildItem -Path $tempDir -Directory | Where-Object { $_.Name -like "*-$branch" } | Select-Object -First 1
if (-not $extracted) {
    Write-Host "Dossier extrait introuvable, mise a jour annulee." -ForegroundColor Red
    Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    Read-Host "Appuie sur Entree pour fermer"
    exit 1
}

Write-Host "Copie des fichiers..."
Write-Host "(ta config dans server\data et les modeles Ollama deja telecharges ne sont pas touches)"
Copy-Item -Path (Join-Path $extracted.FullName "*") -Destination $root -Recurse -Force

Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""

# Cree par start-sans-docker.ps1 : signale que cette install tourne en
# Node.js natif plutot que Docker, pour reconstruire avec le bon outil.
$nativeMode = Test-Path (Join-Path $root ".native-mode")

if ($nativeMode) {
    Write-Host "Installation sans Docker detectee : reconstruction avec npm..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "npm install a echoue. Verifie ta connexion internet et reessaie." -ForegroundColor Red
        Read-Host "Appuie sur Entree pour fermer"
        exit 1
    }
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "La construction a echoue (voir le detail ci-dessus)." -ForegroundColor Red
        Read-Host "Appuie sur Entree pour fermer"
        exit 1
    }

    Write-Host ""
    Write-Host "=== Mise a jour terminee ! ===" -ForegroundColor Green
    Write-Host "Ferme la fenetre Jarvis actuelle (si elle tourne encore) puis"
    Write-Host "relance start-sans-docker.bat pour redemarrer avec le nouveau code."
    Read-Host "Appuie sur Entree pour fermer"
    exit 0
}

$dockerOk = $true
try {
    docker compose version | Out-Null
} catch {
    $dockerOk = $false
}

if (-not $dockerOk) {
    Write-Host "Code mis a jour, mais Docker n'a pas ete trouve (Docker Desktop est-il lance ?)." -ForegroundColor Yellow
    Write-Host "Lance Docker Desktop puis relance ce script, ou tape toi-meme :"
    Write-Host "  docker compose build" -ForegroundColor Cyan
    Write-Host "  docker compose up -d" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Des soucis recurrents avec Docker ? Lance start-sans-docker.bat a la place :" -ForegroundColor Yellow
    Write-Host "  ca fait tourner Jarvis sans Docker (Node.js + Ollama installes nativement)." -ForegroundColor Yellow
    Read-Host "Appuie sur Entree pour fermer"
    exit 0
}

Write-Host "Reconstruction des images Docker (peut prendre quelques minutes)..." -ForegroundColor Cyan
docker compose build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Le build Docker a echoue. Verifie que Docker Desktop est bien lance et reessaie." -ForegroundColor Red
    Read-Host "Appuie sur Entree pour fermer"
    exit 1
}

Write-Host "Redemarrage des conteneurs..." -ForegroundColor Cyan
docker compose up -d

Write-Host ""
Write-Host "=== Mise a jour terminee ! ===" -ForegroundColor Green
Write-Host "Va sur http://localhost:5173/admin pour verifier que tout tourne bien."
Read-Host "Appuie sur Entree pour fermer"
