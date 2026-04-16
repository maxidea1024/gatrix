#!/usr/bin/env pwsh
#
# Gatrix ECS Teardown Script
#
# Usage:
#   ./teardown.ps1 [options]

$ErrorActionPreference = "Stop"
$Prefix = "gatrix"
$RemoveSecrets = $false
$RemoveLogs = $false
$SkipConfirm = $false

function Show-Help {
    Write-Host "Gatrix ECS Teardown Script"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -p, --prefix <name>       Stack prefix (default: gatrix)"
    Write-Host "  --secrets                 Also remove Secrets Manager entries"
    Write-Host "  --logs                    Also remove CloudWatch Log Groups"
    Write-Host "  --all                     Remove everything"
    Write-Host "  -y, --yes                 Skip confirmation"
    Write-Host "  -h, --help                Show help"
    exit 0
}

$i = 0
while ($i -lt $args.Count) {
    switch ($args[$i]) {
        { $_ -eq "-p" -or $_ -eq "--prefix" } { $Prefix = $args[$i + 1]; $i += 2 }
        "--secrets" { $RemoveSecrets = $true; $i += 1 }
        "--logs" { $RemoveLogs = $true; $i += 1 }
        "--all" { $RemoveSecrets = $true; $RemoveLogs = $true; $i += 1 }
        { $_ -eq "-y" -or $_ -eq "--yes" } { $SkipConfirm = $true; $i += 1 }
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
}
$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { "ap-northeast-2" }

function Show-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Blue }
function Show-Success($msg) { Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Show-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Gatrix ECS Teardown" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Show-Info "Prefix: $Prefix"
Show-Info "Remove secrets: $RemoveSecrets"
Show-Info "Remove logs: $RemoveLogs"
Write-Host ""

if (-not $SkipConfirm) {
    Write-Host "WARNING: This will DELETE all CloudFormation stacks and associated resources." -ForegroundColor Red
    $confirm = Read-Host "Are you sure? (y/N)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Host "Cancelled."
        exit 0
    }
}

# Delete stacks in reverse order (last created = first deleted)
$stacks = @("s3-cdn", "monitoring", "ecs-services", "task-defs", "database", "service-discovery", "ecs-cluster", "alb", "sg", "vpc")
foreach ($stack in $stacks) {
    $fullName = "$Prefix-$stack"
    Show-Info "Deleting stack: $fullName..."
    try {
        aws cloudformation describe-stacks --stack-name $fullName --region $Region 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            aws cloudformation delete-stack --stack-name $fullName --region $Region
            Show-Info "Waiting for deletion: $fullName..."
            aws cloudformation wait stack-delete-complete --stack-name $fullName --region $Region
            Show-Success "Deleted: $fullName"
        }
    } catch {
        Show-Warn "Stack not found: $fullName"
    }
}

if ($RemoveSecrets) {
    Show-Info "Removing Secrets Manager entries..."
    $secretNames = @("$Prefix/jwt-secret", "$Prefix/jwt-refresh-secret", "$Prefix/session-secret")
    foreach ($secret in $secretNames) {
        try {
            aws secretsmanager delete-secret --secret-id $secret --force-delete-without-recovery --region $Region 2>$null
            Show-Success "Deleted secret: $secret"
        } catch {
            Show-Warn "Secret not found: $secret"
        }
    }
}

if ($RemoveLogs) {
    Show-Info "Removing CloudWatch Log Groups..."
    foreach ($svc in @("backend", "frontend", "edge", "prometheus", "grafana")) {
        $logGroup = "/ecs/$Prefix-$svc"
        try {
            aws logs delete-log-group --log-group-name $logGroup --region $Region 2>$null
            Show-Success "Deleted log group: $logGroup"
        } catch {
            Show-Warn "Log group not found: $logGroup"
        }
    }
}

Write-Host ""
Show-Success "Teardown completed!"
Write-Host ""
Write-Host "To verify clean state:"
Write-Host "  aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --region $Region"
