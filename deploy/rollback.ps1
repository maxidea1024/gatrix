#!/usr/bin/env pwsh
#
# Gatrix Swarm Rollback Script
#
# Usage:
#   ./rollback.ps1 [options]
#
# Options:
#   -n, --stack <name>        Stack name (default: gatrix)
#   -s, --service <name>      Rollback specific service only
#   -a, --all                 Rollback all services
#   -h, --help                Show help

$ErrorActionPreference = "Stop"

# Default values
$Stack = "gatrix"
$Service = ""
$All = $false

# Show help function
function Show-Help {
    Write-Host "Gatrix Swarm Rollback Script"
    Write-Host ""
    Write-Host "Usage: ./rollback.ps1 [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -n, --stack <name>        Stack name (default: gatrix)"
    Write-Host "  -s, --service <name>      Rollback specific service only"
    Write-Host "  -a, --all                 Rollback all services"
    Write-Host "  -h, --help                Show help"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  ./rollback.ps1 -s backend"
    Write-Host "  ./rollback.ps1 --service backend"
    Write-Host "  ./rollback.ps1 -a"
    Write-Host "  ./rollback.ps1 --all"
    exit 0
}

# Parse arguments
$i = 0
while ($i -lt $args.Count) {
    switch ($args[$i]) {
        { $_ -eq "-n" -or $_ -eq "--stack" } {
            $Stack = $args[$i + 1]
            $i += 2
        }
        { $_ -eq "-s" -or $_ -eq "--service" } {
            $Service = $args[$i + 1]
            $i += 2
        }
        { $_ -eq "-a" -or $_ -eq "--all" } {
            $All = $true
            $i += 1
        }
        { $_ -eq "-h" -or $_ -eq "--help" } {
            Show-Help
        }
        default {
            Write-Host "Unknown option: $($args[$i])" -ForegroundColor Red
            Write-Host "Use --help for usage information"
            exit 1
        }
    }
}

# Configuration
$RollbackServices = @("backend", "frontend", "event-lens", "event-lens-worker", "chat-server", "edge")

function Show-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Blue }
function Show-Success($msg) { Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Show-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Show-Error($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }

function Rollback-Service($svcName) {
    $fullServiceName = "$Stack`_$svcName"
    
    Show-Info "Rolling back service: $fullServiceName"

    docker service inspect $fullServiceName > $null 2>&1
    if ($LASTEXITCODE -eq 0) {
        docker service rollback $fullServiceName
        Show-Success "Rollback initiated for: $fullServiceName"
    }
    else {
        Show-Warn "Service not found: $fullServiceName"
    }
}

function Show-Versions {
    Write-Host ""
    Show-Info "Current service versions:"
    
    foreach ($svc in $RollbackServices) {
        $fullName = "$Stack`_$svc"
        docker service inspect $fullName > $null 2>&1
        if ($LASTEXITCODE -eq 0) {
            $image = docker service inspect $fullName --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'
            Write-Host "  $svc : $image"
        }
    }
    Write-Host ""
}

# Main Logic
Write-Host "========================================"
Write-Host "   Gatrix Swarm Rollback"
Write-Host "========================================"
Write-Host ""

Show-Versions

if ($Service) {
    Rollback-Service $Service
}
elseif ($All) {
    Show-Info "Rolling back all application services..."
    foreach ($svc in $RollbackServices) {
        Rollback-Service $svc
    }
}
else {
    Show-Error "Please specify --service <name> or --all"
    Write-Host ""
    Write-Host "Available services: $($RollbackServices -join ', ')"
    exit 1
}

Write-Host ""
Show-Info "Waiting for rollback to complete..."
Start-Sleep -Seconds 10

Write-Host ""
Show-Info "Service status after rollback:"
docker stack services $Stack

Write-Host ""
Show-Success "Rollback completed!"
