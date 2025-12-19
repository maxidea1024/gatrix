<#
.SYNOPSIS
    Gatrix Swarm Rollback Script

.DESCRIPTION
    Script to rollback Gatrix services in a Docker Swarm.

.PARAMETER Stack
    Stack name (default: gatrix).

.PARAMETER Service
    Rollback specific service only.

.PARAMETER All
    Rollback all services.

.EXAMPLE
    .\rollback.ps1 -Service backend
    .\rollback.ps1 -All
#>

param(
    [string]$Stack = "gatrix",
    [string]$Service = "",
    [switch]$All = $false
)

$ErrorActionPreference = "Stop"

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
    Show-Error "Please specify -Service <name> or -All"
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
