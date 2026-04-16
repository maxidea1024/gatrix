#!/usr/bin/env pwsh
#
# Gatrix ECS Update Script (Rolling Update)
#
# Usage:
#   ./update.ps1 [options]
#
# Options:
#   -v, --version <version>   Version to update to (required)
#   -s, --service <name>      Update specific service only
#   -a, --all                 Update all application services
#   -f, --force               Force new deployment even with same image
#   -p, --prefix <name>       Stack prefix (default: gatrix)
#   -h, --help                Show help

$ErrorActionPreference = "Stop"

$Version = ""
$Service = ""
$All = $false
$Force = $false
$Prefix = "gatrix"

function Show-Help {
    Write-Host "Gatrix ECS Update Script (Rolling Update)"
    Write-Host ""
    Write-Host "Usage: ./update.ps1 [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -v, --version <version>   Version to update to (required)"
    Write-Host "  -s, --service <name>      Update specific service only"
    Write-Host "  -a, --all                 Update all services"
    Write-Host "  -f, --force               Force new deployment"
    Write-Host "  -p, --prefix <name>       Stack prefix (default: gatrix)"
    Write-Host "  -h, --help                Show help"
    Write-Host ""
    Write-Host "Available services: backend, frontend, edge"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  ./update.ps1 -v 1.2.0 -a"
    Write-Host "  ./update.ps1 -v 1.2.0 -s backend"
    Write-Host "  ./update.ps1 -v 1.2.0 -a -f"
    exit 0
}

$i = 0
while ($i -lt $args.Count) {
    switch ($args[$i]) {
        { $_ -eq "-v" -or $_ -eq "--version" } { $Version = $args[$i + 1]; $i += 2 }
        { $_ -eq "-s" -or $_ -eq "--service" } { $Service = $args[$i + 1]; $i += 2 }
        { $_ -eq "-a" -or $_ -eq "--all" } { $All = $true; $i += 1 }
        { $_ -eq "-f" -or $_ -eq "--force" } { $Force = $true; $i += 1 }
        { $_ -eq "-p" -or $_ -eq "--prefix" } { $Prefix = $args[$i + 1]; $i += 2 }
        { $_ -eq "-h" -or $_ -eq "--help" } { Show-Help }
        default { Write-Host "Unknown option: $($args[$i])" -ForegroundColor Red; exit 1 }
    }
}

# Load .env for defaults
$envPath = Join-Path $PSScriptRoot ".env"
if (Test-Path $envPath) {
    Get-Content $envPath | Where-Object { $_ -match "=" -and $_ -notmatch "^\s*#" } | ForEach-Object {
        $parts = $_ -split '=', 2
        [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
    }
}

$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { "ap-northeast-2" }
$AccountId = $env:AWS_ACCOUNT_ID
$EcrRegistry = "$AccountId.dkr.ecr.$Region.amazonaws.com"
$ClusterName = "$Prefix-cluster"

function Show-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Blue }
function Show-Success($msg) { Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Show-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Show-Error($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }

function Update-ECSService($svcName, $ver) {
    $ecsServiceName = "$Prefix-$svcName"
    $newImage = "$EcrRegistry/gatrix-$svcName`:$ver"

    Show-Info "Updating $svcName to version $ver..."
    Show-Info "New image: $newImage"

    # Get current task definition
    $currentTaskDef = aws ecs describe-services --cluster $ClusterName --services $ecsServiceName --region $Region --query "services[0].taskDefinition" --output text

    # Get task definition JSON, update image
    $taskDefJson = aws ecs describe-task-definition --task-definition $currentTaskDef --region $Region --query "taskDefinition" --output json | ConvertFrom-Json

    # Register new task definition with updated image
    $containerDefs = $taskDefJson.containerDefinitions | ForEach-Object {
        $_.image = $newImage
        $_
    }

    $newTaskDefArn = aws ecs register-task-definition `
        --family $taskDefJson.family `
        --container-definitions ($containerDefs | ConvertTo-Json -Depth 10 -Compress) `
        --cpu $taskDefJson.cpu `
        --memory $taskDefJson.memory `
        --network-mode $taskDefJson.networkMode `
        --requires-compatibilities FARGATE `
        --execution-role-arn $taskDefJson.executionRoleArn `
        --task-role-arn $taskDefJson.taskRoleArn `
        --region $Region `
        --query "taskDefinition.taskDefinitionArn" `
        --output text

    Show-Info "New task definition: $newTaskDefArn"

    # Update service
    $forceFlag = if ($Force) { "--force-new-deployment" } else { "" }
    aws ecs update-service --cluster $ClusterName --service $ecsServiceName --task-definition $newTaskDefArn $forceFlag --region $Region | Out-Null

    Show-Success "Update initiated for: $svcName"
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Gatrix ECS Rolling Update" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not $Version) {
    Show-Error "Version is required. Use --version <version>"
    exit 1
}
Show-Info "Target version: $Version"

if ($Service) {
    Update-ECSService $Service $Version
} elseif ($All) {
    Show-Info "Updating all application services..."
    foreach ($svc in @("backend", "frontend", "edge")) {
        Update-ECSService $svc $Version
    }
} else {
    Show-Error "Please specify --service <name> or --all"
    exit 1
}

Write-Host ""
Show-Info "Waiting for services to stabilize..."
$waitServices = if ($Service) { @("$Prefix-$Service") } else { @("$Prefix-backend", "$Prefix-frontend", "$Prefix-edge") }
foreach ($svc in $waitServices) {
    aws ecs wait services-stable --cluster $ClusterName --services $svc --region $Region 2>&1
}

Write-Host ""
Show-Info "Current service status:"
foreach ($svc in $waitServices) {
    $status = aws ecs describe-services --cluster $ClusterName --services $svc --region $Region --query "services[0].{Name:serviceName,Running:runningCount,Desired:desiredCount,Status:status}" --output table
    Write-Host $status
}

Show-Success "Update completed!"
