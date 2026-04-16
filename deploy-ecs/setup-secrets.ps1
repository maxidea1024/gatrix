#!/usr/bin/env pwsh
#
# Gatrix AWS Secrets Manager Setup Script
# Stores security secrets from .env into AWS Secrets Manager.
# Idempotent: skips secrets that already exist.
#
# Usage:
#   ./setup-secrets.ps1 [options]
#
# Options:
#   -p, --prefix <name>       Secret prefix (default: gatrix)
#   -f, --force               Overwrite existing secrets
#   -h, --help                Show help

$ErrorActionPreference = "Stop"
$Prefix = "gatrix"
$Force = $false

function Show-Help {
    Write-Host "Gatrix AWS Secrets Manager Setup"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -p, --prefix <name>       Secret prefix (default: gatrix)"
    Write-Host "  -f, --force               Overwrite existing secrets"
    Write-Host "  -h, --help                Show help"
    exit 0
}

$i = 0
while ($i -lt $args.Count) {
    switch ($args[$i]) {
        { $_ -eq "-p" -or $_ -eq "--prefix" } { $Prefix = $args[$i + 1]; $i += 2 }
        { $_ -eq "-f" -or $_ -eq "--force" } { $Force = $true; $i += 1 }
        { $_ -eq "-h" -or $_ -eq "--help" } { Show-Help }
        default { Write-Host "Unknown option: $($args[$i])" -ForegroundColor Red; exit 1 }
    }
}

$envPath = Join-Path $PSScriptRoot ".env"
if (Test-Path $envPath) {
    Get-Content $envPath | Where-Object { $_ -match "=" -and $_ -notmatch "^\s*#" } | ForEach-Object {
        $parts = $_ -split '=', 2
        [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
    }
} else {
    Write-Host "[ERROR] .env file not found. Run generate-secrets.ps1 --env first." -ForegroundColor Red
    exit 1
}

$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { "ap-northeast-2" }

function Show-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Blue }
function Show-Success($msg) { Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Show-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Gatrix Secrets Manager Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$secrets = @{
    "$Prefix/jwt-secret"         = $env:JWT_SECRET
    "$Prefix/jwt-refresh-secret" = $env:JWT_REFRESH_SECRET
    "$Prefix/session-secret"     = $env:SESSION_SECRET
}

foreach ($name in $secrets.Keys) {
    $value = $secrets[$name]
    if (-not $value -or $value -match "^change-this") {
        Show-Warn "Secret '$name' has placeholder value. Generate real secrets first: ./generate-secrets.ps1 --env"
        continue
    }

    # Check if secret exists
    $exists = $false
    try {
        aws secretsmanager describe-secret --secret-id $name --region $Region 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { $exists = $true }
    } catch { $exists = $false }

    if ($exists -and -not $Force) {
        Show-Warn "Secret '$name' already exists, skipping... (use --force to overwrite)"
    } elseif ($exists -and $Force) {
        Show-Info "Updating secret: $name"
        aws secretsmanager update-secret --secret-id $name --secret-string $value --region $Region | Out-Null
        Show-Success "Updated secret: $name"
    } else {
        Show-Info "Creating secret: $name"
        aws secretsmanager create-secret --name $name --secret-string $value --region $Region | Out-Null
        Show-Success "Created secret: $name"
    }
}

Write-Host ""
Show-Success "Secrets Manager setup completed!"
Write-Host ""
Write-Host "Secrets stored:" -ForegroundColor Cyan
foreach ($name in $secrets.Keys) {
    Write-Host "  arn:aws:secretsmanager:${Region}:*:secret:$name"
}
