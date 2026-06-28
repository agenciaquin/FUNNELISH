$ErrorActionPreference = "Stop"
Set-Location "C:\Users\Josue\OneDrive\Documentos\PROYECTO IA CONFIRMA YA\FUNNELISH"

Write-Host ""
Write-Host "=== CONFIRMAYA - Configuracion GitHub ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] Iniciando sesion en GitHub (se abrira el navegador)..." -ForegroundColor Yellow
gh auth login --hostname github.com --git-protocol https --web

Write-Host ""
Write-Host "[2/3] Inicializando repositorio git local..." -ForegroundColor Yellow
git init

Write-Host ""
Write-Host "[3/3] Creando repositorio privado FUNNELISH en GitHub..." -ForegroundColor Yellow
gh repo create FUNNELISH --private --source=. --remote=origin

Write-Host ""
Write-Host "Listo! Repositorio FUNNELISH creado y conectado en GitHub." -ForegroundColor Green
Write-Host ""
Read-Host "Presiona Enter para cerrar"
