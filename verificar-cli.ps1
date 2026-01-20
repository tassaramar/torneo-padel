# Script de verificación del CLI de Supabase
# Ejecutar con: .\verificar-cli.ps1

Write-Host "`n=== Verificación de Supabase CLI ===" -ForegroundColor Cyan

# 1. Verificar CLI instalado
Write-Host "`n[1/4] Verificando instalación del CLI..." -ForegroundColor Yellow
try {
    $version = supabase --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ CLI instalado: $version" -ForegroundColor Green
    } else {
        Write-Host "❌ CLI no encontrado. Instalá con: npm install -g supabase" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ CLI no encontrado. Instalá con: npm install -g supabase" -ForegroundColor Red
    exit 1
}

# 2. Verificar login
Write-Host "`n[2/4] Verificando autenticación..." -ForegroundColor Yellow
$statusOutput = supabase status 2>&1
if ($statusOutput -match "STOPPED" -or $statusOutput -match "RUNNING" -or $statusOutput -match "not logged in" -or $statusOutput -match "logged in") {
    # Intentar un comando que requiere auth
    $linkStatus = supabase projects list 2>&1
    if ($linkStatus -match "not logged in") {
        Write-Host "⚠️  No estás logueado. Ejecutá: supabase login" -ForegroundColor Yellow
    } else {
        Write-Host "✅ Autenticado correctamente" -ForegroundColor Green
    }
}

# 3. Verificar migraciones locales
Write-Host "`n[3/4] Verificando migraciones locales..." -ForegroundColor Yellow
if (Test-Path ".\supabase\migrations\20260119140000_add_estado_partidos.sql") {
    Write-Host "✅ Migración encontrada: 20260119140000_add_estado_partidos.sql" -ForegroundColor Green
} else {
    Write-Host "❌ Migración no encontrada" -ForegroundColor Red
    exit 1
}

# 4. Verificar proyecto vinculado
Write-Host "`n[4/4] Verificando vinculación del proyecto..." -ForegroundColor Yellow
$remoteInfo = supabase db remote get 2>&1
if ($remoteInfo -match "Failed to run remote_get") {
    Write-Host "⚠️  Proyecto no vinculado. Necesitás ejecutar:" -ForegroundColor Yellow
    Write-Host "   supabase link --project-ref TU_REFERENCE_ID" -ForegroundColor Cyan
    Write-Host "`nObtenelo en: https://supabase.com/dashboard → Settings → General" -ForegroundColor Gray
} else {
    Write-Host "✅ Proyecto vinculado correctamente" -ForegroundColor Green
}

Write-Host "`n=== Próximos pasos ===" -ForegroundColor Cyan
Write-Host "1. Si no estás logueado: supabase login" -ForegroundColor White
Write-Host "2. Si no está vinculado: supabase link --project-ref TU_ID" -ForegroundColor White
Write-Host "3. Aplicar migración: supabase db push" -ForegroundColor White
Write-Host "`nVer guía completa en: GUIA-SUPABASE-CLI.md`n" -ForegroundColor Gray
