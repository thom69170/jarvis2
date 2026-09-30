$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
Set-Location $root

Write-Host "=== J.A.R.V.I.S (mode sans Docker) ===" -ForegroundColor Cyan
Write-Host ""

function Test-Command($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

if (-not (Test-Command "node")) {
    Write-Host "Node.js n'est pas installe (ou pas dans le PATH)." -ForegroundColor Red
    Write-Host "Telecharge et installe la version LTS ici : https://nodejs.org/" -ForegroundColor Yellow
    Write-Host "Une fois installe, redemarre ton ordinateur puis relance ce script." -ForegroundColor Yellow
    Start-Process "https://nodejs.org/"
    Read-Host "Appuie sur Entree pour fermer"
    exit 1
}

if (-not (Test-Command "ollama")) {
    Write-Host "Ollama n'est pas installe (ou pas dans le PATH)." -ForegroundColor Yellow
    Write-Host "Sans lui, Jarvis ne pourra pas repondre a moins d'utiliser une cle API" -ForegroundColor Yellow
    Write-Host "(OpenAI / Anthropic / Gemini) a la place dans /admin." -ForegroundColor Yellow
    Write-Host "Pour l'installer (gratuit) : https://ollama.com/download" -ForegroundColor Yellow
    Write-Host ""
}

# Cree un marqueur (ignore par git) pour que update.ps1 sache qu'il doit
# reconstruire avec npm plutot que reconstruire des images Docker.
New-Item -ItemType File -Path (Join-Path $root ".native-mode") -Force | Out-Null

if (-not (Test-Path (Join-Path $root "node_modules"))) {
    Write-Host "Premiere installation : recuperation des dependances (peut prendre quelques minutes)..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "npm install a echoue. Verifie ta connexion internet et reessaie." -ForegroundColor Red
        Read-Host "Appuie sur Entree pour fermer"
        exit 1
    }
}

Write-Host "Construction de Jarvis..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "La construction a echoue (voir le detail ci-dessus)." -ForegroundColor Red
    Read-Host "Appuie sur Entree pour fermer"
    exit 1
}

Write-Host ""
Write-Host "=== Jarvis demarre sur http://localhost:4000 ===" -ForegroundColor Green
Write-Host "Laisse cette fenetre ouverte tant que tu veux utiliser Jarvis." -ForegroundColor Green
Write-Host "Pour l'arreter : ferme cette fenetre, ou Ctrl+C." -ForegroundColor Green
Write-Host ""
Write-Host "Panneau d'administration : http://localhost:4000/admin"
Write-Host "Fenetre Jarvis (test)     : http://localhost:4000/jarvis"
Write-Host "Vue OBS (source navigateur) : http://localhost:4000/overlay?transparent=1"
Write-Host ""

Start-Job -ScriptBlock {
    Start-Sleep -Seconds 2
    Start-Process "http://localhost:4000/admin"
} | Out-Null

npm start
