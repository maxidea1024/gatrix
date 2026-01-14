#!/usr/bin/env pwsh
#
# Gatrix Swarm Scaling Script
#
# Usage:
#   ./scale.ps1 [options]
#
# Options:
#   -n, --stack <name>        Stack name (default: gatrix)
#   -s, --service <name>      Service to scale
#   -r, --replicas <count>    Number of replicas
#   --preset <name>           Use scaling preset (minimal, standard, high)
#   --status                  Show current scaling status
#   -h, --help                Show help

$ErrorActionPreference = "Stop"

# Default values
$Stack = "gatrix"
$Service = ""
$Replicas = 0
$Preset = ""
$Status = $false

# Show help function
function Show-Help {
    Write-Host "Gatrix Swarm Scaling Script"
    Write-Host ""
    Write-Host "Usage: ./scale.ps1 [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -n, --stack <name>        Stack name (default: gatrix)"
    Write-Host "  -s, --service <name>      Service to scale"
    Write-Host "  -r, --replicas <count>    Number of replicas"
    Write-Host "  --preset <name>           Use scaling preset (minimal, standard, high)"
    Write-Host "  --status                  Show current scaling status"
    Write-Host "  -h, --help                Show help"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  ./scale.ps1 -s backend -r 4"
    Write-Host "  ./scale.ps1 --service backend --replicas 4"
    Write-Host "  ./scale.ps1 --preset high"
    Write-Host "  ./scale.ps1 --status"
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
        { $_ -eq "-r" -or $_ -eq "--replicas" } {
            $Replicas = [int]$args[$i + 1]
            $i += 2
        }
        "--preset" {
            $Preset = $args[$i + 1]
            $i += 2
        }
        "--status" {
            $Status = $true
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
$ScalableServices = @("backend", "frontend", "event-lens", "event-lens-worker", "chat-server", "edge")

function Show-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Blue }
function Show-Success($msg) { Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Show-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Show-Error($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }

function Scale-Service($svcName, $count) {
    $fullServiceName = "$Stack`_$svcName"
    
    # Check if service exists
    # Simple check via docker service inspect
    docker service inspect $fullServiceName > $null 2>&1
    if ($LASTEXITCODE -ne 0) {
        Show-Warn "Service not found: $fullServiceName"
        return
    }

    Show-Info "Scaling $svcName to $count replicas..."
    docker service scale "$fullServiceName=$count"
    Show-Success "Scaled $svcName to $count replicas"
}

function Apply-Preset($name) {
    switch ($name) {
        "minimal" {
            Show-Info "Applying minimal preset..."
            Scale-Service "backend" 1
            Scale-Service "frontend" 1
            Scale-Service "event-lens" 1
            Scale-Service "event-lens-worker" 1
            Scale-Service "chat-server" 1
            Scale-Service "edge" 1
        }
        "standard" {
            Show-Info "Applying standard preset..."
            Scale-Service "backend" 2
            Scale-Service "frontend" 2
            Scale-Service "event-lens" 1
            Scale-Service "event-lens-worker" 2
            Scale-Service "chat-server" 2
            Scale-Service "edge" 2
        }
        "high" {
            Show-Info "Applying high traffic preset..."
            Scale-Service "backend" 4
            Scale-Service "frontend" 4
            Scale-Service "event-lens" 2
            Scale-Service "event-lens-worker" 4
            Scale-Service "chat-server" 4
            Scale-Service "edge" 4
        }
        Default {
            Show-Error "Unknown preset: $name"
            exit 1
        }
    }
}

function Show-CurrentStatus {
    Write-Host ""
    Show-Info "Current scaling status for stack: $Stack"
    Write-Host ""
    docker stack services $Stack --format "table {{.Name}}\t{{.Mode}}\t{{.Replicas}}\t{{.Image}}"
}

# Main Logic
Write-Host "========================================"
Write-Host "   Gatrix Swarm Scaling"
Write-Host "========================================"
Write-Host ""

if ($Status) {
    Show-CurrentStatus
    exit 0
}

if ($Preset) {
    Apply-Preset $Preset
}
elseif ($Service -and $Replicas -gt 0) {
    Scale-Service $Service $Replicas
}
else {
    Show-Error "Please specify --service and --replicas, --preset, or --status"
    exit 1
}

Write-Host ""
Show-CurrentStatus

Write-Host ""
Show-Success "Scaling completed!"
