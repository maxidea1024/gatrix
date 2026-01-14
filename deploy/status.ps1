#!/usr/bin/env pwsh
#
# Gatrix Swarm Status Script
#
# Usage:
#   ./status.ps1 [options]
#
# Options:
#   -n, --stack <name>        Stack name (default: gatrix)
#   -s, --services            Show service list
#   -t, --tasks               Show running tasks
#   -l, --logs <service>      Show logs for a service
#   --health                  Show health status
#   -h, --help                Show help

$ErrorActionPreference = "Stop"

# Default values
$Stack = "gatrix"
$ShowServices = $false
$ShowTasks = $false
$Logs = ""
$ShowHealth = $false

# Show help function
function Show-HelpText {
    Write-Host "Gatrix Swarm Status Script"
    Write-Host ""
    Write-Host "Usage: ./status.ps1 [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -n, --stack <name>        Stack name (default: gatrix)"
    Write-Host "  -s, --services            Show service list"
    Write-Host "  -t, --tasks               Show running tasks"
    Write-Host "  -l, --logs <service>      Show logs for a service"
    Write-Host "  --health                  Show health status"
    Write-Host "  -h, --help                Show help"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  ./status.ps1"
    Write-Host "  ./status.ps1 -s"
    Write-Host "  ./status.ps1 --services"
    Write-Host "  ./status.ps1 -l backend"
    Write-Host "  ./status.ps1 --logs backend"
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
        { $_ -eq "-s" -or $_ -eq "--services" } {
            $ShowServices = $true
            $i += 1
        }
        { $_ -eq "-t" -or $_ -eq "--tasks" } {
            $ShowTasks = $true
            $i += 1
        }
        { $_ -eq "-l" -or $_ -eq "--logs" } {
            $Logs = $args[$i + 1]
            $i += 2
        }
        "--health" {
            $ShowHealth = $true
            $i += 1
        }
        { $_ -eq "-h" -or $_ -eq "--help" } {
            Show-HelpText
        }
        default {
            Write-Host "Unknown option: $($args[$i])" -ForegroundColor Red
            Write-Host "Use --help for usage information"
            exit 1
        }
    }
}

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
            Write-Host "  ??$service ($runningCount/$replicas)" -ForegroundColor Green
        }
        elseif ($runningCount -gt 0) {
            Write-Host "  ??$service ($runningCount/$replicas)" -ForegroundColor Yellow
        }
        else {
            Write-Host "  ??$service ($runningCount/$replicas)" -ForegroundColor Red
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
elseif ($ShowServices) {
    Show-ServicesList
}
elseif ($ShowTasks) {
    Show-TasksList
}
elseif ($ShowHealth) {
    Show-HealthStatus
}
else {
    Show-All
}
