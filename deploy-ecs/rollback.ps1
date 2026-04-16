#!/usr/bin/env pwsh
#
# Gatrix ECS Rollback Script
#
# Usage:
#   ./rollback.ps1 [options]
#
# Options:
#   -s, --service <name>      Rollback specific service only
#   -a, --all                 Rollback all services
#   -p, --prefix <name>       Stack prefix (default: gatrix)
#   -h, --help                Show help

$ErrorActionPreference = "Stop"
$Service = ""
$All = $false
$Prefix = "gatrix"

function Show-Help {
    Write-Host "Gatrix ECS Rollback Script"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -s, --service <name>      Rollback specific service"
    Write-Host "  -a, --all                 Rollback all services"
    Write-Host "  -p, --prefix <name>       Stack prefix (default: gatrix)"
    Write-Host "  -h, --help                Show help"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  ./rollback.ps1 -s backend"
    Write-Host "  ./rollback.ps1 -a"
    exit 0
}

$i = 0
while ($i -lt $args.Count) {
    switch ($args[$i]) {
        { $_ -eq "-s" -or $_ -eq "--service" } { $Service = $args[$i + 1]; $i += 2 }
        { $_ -eq "-a" -or $_ -eq "--all" } { $All = $true; $i += 1 }
        { $_ -eq "-p" -or $_ -eq "--prefix" } { $Prefix = $args[$i + 1]; $i += 2 }
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
$ClusterName = "$Prefix-cluster"

function Show-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Blue }
function Show-Success($msg) { Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Show-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }

function Rollback-Service($svcName) {
    $ecsServiceName = "$Prefix-$svcName"
    $taskFamily = "$Prefix-$svcName"

    Show-Info "Rolling back service: $ecsServiceName"

    # Get current task definition
    $currentTaskDefArn = aws ecs describe-services --cluster $ClusterName --services $ecsServiceName --region $Region --query "services[0].taskDefinition" --output text
    $currentRevision = ($currentTaskDefArn -split ':')[-1]

    if ([int]$currentRevision -le 1) {
        Show-Warn "No previous revision to rollback to for $svcName"
        return
    }

    $prevRevision = [int]$currentRevision - 1
    $prevTaskDefArn = "$taskFamily`:$prevRevision"

    Show-Info "Current revision: $currentRevision -> Rolling back to: $prevRevision"

    # Get previous image
    $prevImage = aws ecs describe-task-definition --task-definition $prevTaskDefArn --region $Region --query "taskDefinition.containerDefinitions[0].image" --output text
    Show-Info "Previous image: $prevImage"

    aws ecs update-service --cluster $ClusterName --service $ecsServiceName --task-definition $prevTaskDefArn --region $Region | Out-Null
    Show-Success "Rollback initiated for: $svcName"
}

Write-Host "========================================"
Write-Host "   Gatrix ECS Rollback"
Write-Host "========================================"
Write-Host ""

$RollbackServices = @("backend", "frontend", "edge")

# Show current versions
Show-Info "Current service versions:"
foreach ($svc in $RollbackServices) {
    $ecsName = "$Prefix-$svc"
    $image = aws ecs describe-services --cluster $ClusterName --services $ecsName --region $Region --query "services[0].taskDefinition" --output text 2>$null
    if ($image) { Write-Host "  $svc : $image" }
}
Write-Host ""

if ($Service) {
    Rollback-Service $Service
} elseif ($All) {
    Show-Info "Rolling back all application services..."
    foreach ($svc in $RollbackServices) { Rollback-Service $svc }
} else {
    Write-Host "[ERROR] Please specify --service <name> or --all" -ForegroundColor Red
    exit 1
}

Write-Host ""
Show-Info "Waiting for rollback to complete..."
Start-Sleep -Seconds 10
Show-Success "Rollback completed!"
