#!/usr/bin/env pwsh
#
# Gatrix Registry Login Script
#
# Usage:
#   ./login_registry.ps1
#
# Description:
#   Logs in to the Docker registry using credentials from registry.env

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile = Join-Path $ScriptDir "registry.env"

if (Test-Path $EnvFile) {
    Get-Content $EnvFile | Where-Object { $_ -match "=" } | ForEach-Object {
        $parts = $_ -split "=", 2
        $key = $parts[0].Trim()
        $val = $parts[1].Trim()
        Set-Variable -Name $key -Value $val -Scope Script
    }
}
else {
    Write-Error "registry.env not found at $EnvFile"
    exit 1
}

Write-Host "Logging in to $REGISTRY_HOST..." -ForegroundColor Cyan
$REGISTRY_PASS | docker login $REGISTRY_HOST --username $REGISTRY_USER --password-stdin
if ($LASTEXITCODE -eq 0) {
    Write-Host "Login Succeeded" -ForegroundColor Green
}
else {
    Write-Host "Login Failed. Please check your credentials in registry.env" -ForegroundColor Red
    exit 1
}
