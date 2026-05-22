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

    # Get raw JSON for container definitions (avoid PSCustomObject round-trip issues)
    $containerDefsJson = aws ecs describe-task-definition --task-definition $currentTaskDef --region $Region --query "taskDefinition.containerDefinitions" --output json
    $taskDefJson = aws ecs describe-task-definition --task-definition $currentTaskDef --region $Region --query "taskDefinition" --output json | ConvertFrom-Json

    # Replace image in raw JSON string (all container images point to this service)
    $oldImagePattern = [regex]::Escape("$EcrRegistry/gatrix-$svcName") + ':[^"]*'
    $updatedJson = ($containerDefsJson -join "`n") -replace $oldImagePattern, "$EcrRegistry/gatrix-$svcName`:$ver"

    # Write to temp file (UTF-8 without BOM)
    $tempFile = [System.IO.Path]::GetTempFileName()
    try {
        [System.IO.File]::WriteAllText($tempFile, $updatedJson, [System.Text.UTF8Encoding]::new($false))

        $registerArgs = @(
            "ecs", "register-task-definition",
            "--family", $taskDefJson.family,
            "--container-definitions", "file://$tempFile",
            "--cpu", "$($taskDefJson.cpu)",
            "--memory", "$($taskDefJson.memory)",
            "--network-mode", $taskDefJson.networkMode,
            "--requires-compatibilities", "FARGATE",
            "--execution-role-arn", $taskDefJson.executionRoleArn,
            "--task-role-arn", $taskDefJson.taskRoleArn,
            "--region", $Region,
            "--query", "taskDefinition.taskDefinitionArn",
            "--output", "text"
        )
        $newTaskDefArn = aws @registerArgs
        if ($LASTEXITCODE -ne 0) {
            Show-Error "Failed to register task definition for $svcName"
            return
        }
    } finally {
        Remove-Item $tempFile -ErrorAction SilentlyContinue
    }

    Show-Info "New task definition: $newTaskDefArn"

    # Update service
    $updateArgs = @(
        "ecs", "update-service",
        "--cluster", $ClusterName,
        "--service", $ecsServiceName,
        "--task-definition", $newTaskDefArn,
        "--region", $Region
    )
    if ($Force) { $updateArgs += "--force-new-deployment" }
    aws @updateArgs | Out-Null

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

# Temporarily allow stderr without terminating (aws ecs wait writes progress to stderr)
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = "Continue"
foreach ($svc in $waitServices) {
    Show-Info "Waiting for $svc..."
    aws ecs wait services-stable --cluster $ClusterName --services $svc --region $Region 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Show-Success "$svc is stable"
    } else {
        Show-Warn "$svc may not be fully stable yet (check ECS console)"
    }
}
$ErrorActionPreference = $prevEAP

Write-Host ""
Show-Info "Current service status:"
foreach ($svc in $waitServices) {
    $status = aws ecs describe-services --cluster $ClusterName --services $svc --region $Region --query "services[0].{Name:serviceName,Running:runningCount,Desired:desiredCount,Status:status}" --output table
    Write-Host $status
}

Show-Success "Update completed!"

