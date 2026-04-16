#!/usr/bin/env pwsh
#
# Gatrix ECS Scaling Script
#
# Usage:
#   ./scale.ps1 [options]
#
# Options:
#   -s, --service <name>      Service to scale
#   -r, --replicas <count>    Number of desired tasks
#   --preset <name>           Use scaling preset (minimal, standard, high)
#   --no-persist              Do NOT update .env
#   --status                  Show current scaling status
#   -p, --prefix <name>       Stack prefix (default: gatrix)
#   -h, --help                Show help

$ErrorActionPreference = "Stop"
$Service = ""
$Replicas = 0
$Preset = ""
$Status = $false
$NoPersist = $false
$Prefix = "gatrix"

function Show-Help {
    Write-Host "Gatrix ECS Scaling Script"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -s, --service <name>      Service to scale"
    Write-Host "  -r, --replicas <count>    Desired task count"
    Write-Host "  --preset <name>           Preset (minimal, standard, high)"
    Write-Host "  --no-persist              Don't update .env"
    Write-Host "  --status                  Show current status"
    Write-Host "  -p, --prefix <name>       Stack prefix (default: gatrix)"
    Write-Host ""
    Write-Host "Presets:"
    Write-Host "  minimal   - backend:1  frontend:1  edge:1"
    Write-Host "  standard  - backend:2  frontend:1  edge:2"
    Write-Host "  high      - backend:4  frontend:2  edge:8"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  ./scale.ps1 -s backend -r 4"
    Write-Host "  ./scale.ps1 --preset high"
    Write-Host "  ./scale.ps1 --status"
    exit 0
}

$i = 0
while ($i -lt $args.Count) {
    switch ($args[$i]) {
        { $_ -eq "-s" -or $_ -eq "--service" } { $Service = $args[$i + 1]; $i += 2 }
        { $_ -eq "-r" -or $_ -eq "--replicas" } { $Replicas = [int]$args[$i + 1]; $i += 2 }
        "--preset" { $Preset = $args[$i + 1]; $i += 2 }
        "--no-persist" { $NoPersist = $true; $i += 1 }
        "--status" { $Status = $true; $i += 1 }
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

function Update-EnvReplicas($svcName, $count) {
    $varName = switch ($svcName) {
        "backend" { "BACKEND_REPLICAS" }
        "frontend" { "FRONTEND_REPLICAS" }
        "edge" { "EDGE_REPLICAS" }
        default { return }
    }
    if (-not (Test-Path $envPath)) { return }
    $content = Get-Content $envPath -Raw
    if ($content -match "(?m)^${varName}=") {
        $content = $content -replace "(?m)^${varName}=.*", "${varName}=${count}"
    } else {
        $content = $content.TrimEnd() + "`n${varName}=${count}`n"
    }
    Set-Content $envPath $content -NoNewline
    Show-Success "Saved to .env: ${varName}=${count}"
}

function Scale-Service($svcName, $count) {
    $ecsServiceName = "$Prefix-$svcName"
    Show-Info "Scaling $svcName to $count tasks..."
    aws ecs update-service --cluster $ClusterName --service $ecsServiceName --desired-count $count --region $Region | Out-Null
    Show-Success "Scaled $svcName to $count tasks"
    if (-not $NoPersist) { Update-EnvReplicas $svcName $count }
}

function Show-CurrentStatus {
    Show-Info "Current scaling status for cluster: $ClusterName"
    Write-Host ""
    foreach ($svc in @("backend", "frontend", "edge")) {
        $ecsName = "$Prefix-$svc"
        $info = aws ecs describe-services --cluster $ClusterName --services $ecsName --region $Region --query "services[0].{Running:runningCount,Desired:desiredCount}" --output json 2>$null | ConvertFrom-Json
        if ($info) {
            Write-Host "  $svc : $($info.Running)/$($info.Desired)" -ForegroundColor $(if ($info.Running -eq $info.Desired) { "Green" } else { "Yellow" })
        }
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Gatrix ECS Scaling" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($Status) { Show-CurrentStatus; exit 0 }

if ($Preset) {
    switch ($Preset) {
        "minimal" { Scale-Service "backend" 1; Scale-Service "frontend" 1; Scale-Service "edge" 1 }
        "standard" { Scale-Service "backend" 2; Scale-Service "frontend" 1; Scale-Service "edge" 2 }
        "high" { Scale-Service "backend" 4; Scale-Service "frontend" 2; Scale-Service "edge" 8 }
        default { Write-Host "[ERROR] Unknown preset: $Preset" -ForegroundColor Red; exit 1 }
    }
} elseif ($Service -and $Replicas -gt 0) {
    Scale-Service $Service $Replicas
} else {
    Write-Host "[ERROR] Specify --service and --replicas, --preset, or --status" -ForegroundColor Red; exit 1
}

Write-Host ""
Show-CurrentStatus
Show-Success "Scaling completed!"
