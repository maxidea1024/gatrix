#!/usr/bin/env pwsh
#
# Gatrix ECR Login Script
#
# Usage:
#   ./login-registry.ps1

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile = Join-Path $ScriptDir ".env"

if (Test-Path $EnvFile) {
    Get-Content $EnvFile | Where-Object { $_ -match "=" -and $_ -notmatch "^\s*#" } | ForEach-Object {
        $parts = $_ -split "=", 2
        [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
    }
}

$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { "ap-northeast-2" }
$AccountId = $env:AWS_ACCOUNT_ID

if (-not $AccountId) {
    Write-Host "[ERROR] AWS_ACCOUNT_ID not set. Configure .env first." -ForegroundColor Red
    exit 1
}

$Registry = "$AccountId.dkr.ecr.$Region.amazonaws.com"

Write-Host "Logging in to ECR: $Registry ..." -ForegroundColor Cyan
aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin $Registry

if ($LASTEXITCODE -eq 0) {
    Write-Host "Login Succeeded" -ForegroundColor Green
} else {
    Write-Host "Login Failed. Check AWS credentials." -ForegroundColor Red
    exit 1
}
