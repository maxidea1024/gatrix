<#
.SYNOPSIS
    Gatrix Swarm Status Script

.DESCRIPTION
    Script to show status of Gatrix services in a Docker Swarm.

.PARAMETER Stack
    Stack name (default: gatrix).

.PARAMETER Services
    Show service list.

.PARAMETER Tasks
    Show running tasks.

.PARAMETER Logs
    Show logs for a service.

.PARAMETER Health
    Show health status.

.EXAMPLE
    .\status.ps1
    .\status.ps1 -Services
    .\status.ps1 -Logs backend
#>

param(
    [string]$Stack = "gatrix",
    [switch]$Services = $false,
    [switch]$Tasks = $false,
    [string]$Logs = "",
    [switch]$Health = $false
)

$ErrorActionPreference = "Stop"

function Show-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Blue }
function Show-Success($msg) { Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Show-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Show-Error($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }

function Show-ServicesList {
    Write-Host ""
    Show-Info "Services in stack: $Stack"
    Write-Host ""
    docker stack services $Stack --format "table {{.Name}}\t{{.Mode}}\t{{.Replicas}}\t{{.Image}}\t{{.Ports}}"
}

function Show-TasksList {
    Write-Host ""
    Show-Info "Running tasks in stack: $Stack"
    Write-Host ""
    docker stack ps $Stack --filter "desired-state=running" --format "table {{.Name}}\t{{.Image}}\t{{.Node}}\t{{.CurrentState}}"
}

function Show-ServiceLogs($svcName) {
    if (-not $svcName) { return }
    $fullServiceName = "$Stack`_$svcName"
    
    Show-Info "Logs for service: $fullServiceName"
    docker service logs $fullServiceName --tail 100 --follow
}

function Show-HealthStatus {
    Write-Host ""
    Show-Info "Health Status"
    Write-Host ""
    
    $services = docker stack services $Stack --format "{{.Name}}"
    # Split by newline
    $services = $services -split "`n" | Where-Object { $_ -ne "" }

    foreach ($service in $services) {
        # docker service inspect might return complex json, handle parsing
        $replicas = docker service inspect $service --format '{{.Spec.Mode.Replicated.Replicas}}'
        # On windows powerhsell $replicas might be an array or object if not careful, but format string returns string
        
        $runningCount = (docker service ps $service --filter "desired-state=running" --format "{{.ID}}").Count
        # Count is 0 if empty or null usually in PS depending on context, force int
        if ($null -eq $runningCount) { $runningCount = 0 }

        if ($runningCount -eq $replicas -and $replicas -gt 0) {
            Write-Host "  ✓ $service ($runningCount/$replicas)" -ForegroundColor Green
        }
        elseif ($runningCount -gt 0) {
            Write-Host "  ○ $service ($runningCount/$replicas)" -ForegroundColor Yellow
        }
        else {
            Write-Host "  ✗ $service ($runningCount/$replicas)" -ForegroundColor Red
        }
    }
}

function Show-All {
    Show-ServicesList
    Show-TasksList
    Show-HealthStatus
}

# Main Logic
Write-Host "========================================"
Write-Host "   Gatrix Swarm Status"
Write-Host "========================================"

if ($Logs) {
    Show-ServiceLogs $Logs
}
elseif ($Services) {
    Show-ServicesList
}
elseif ($Tasks) {
    Show-TasksList
}
elseif ($Health) {
    Show-HealthStatus
}
else {
    Show-All
}
