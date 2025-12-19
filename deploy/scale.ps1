<#
.SYNOPSIS
    Gatrix Swarm Scaling Script

.DESCRIPTION
    Script to scale Gatrix services in a Docker Swarm.

.PARAMETER Stack
    Stack name (default: gatrix).

.PARAMETER Service
    Service to scale.

.PARAMETER Replicas
    Number of replicas.

.PARAMETER Preset
    Use scaling preset (minimal, standard, high).

.PARAMETER Status
    Show current scaling status.

.EXAMPLE
    .\scale.ps1 -Service backend -Replicas 4
    .\scale.ps1 -Preset high
    .\scale.ps1 -Status
#>

param(
    [string]$Stack = "gatrix",
    [string]$Service = "",
    [int]$Replicas = 0,
    [string]$Preset = "",
    [switch]$Status = $false
)

$ErrorActionPreference = "Stop"

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
    Show-Error "Please specify -Service and -Replicas, -Preset, or -Status"
    exit 1
}

Write-Host ""
Show-CurrentStatus

Write-Host ""
Show-Success "Scaling completed!"
