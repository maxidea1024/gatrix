#!/usr/bin/env pwsh
#
# Gatrix Swarm Update Script (Rolling Update)
#
# Usage:
#   ./update.ps1 [options]
#
# Options:
#   -n, --stack <name>        Stack name (default: gatrix)
#   -v, --version <version>   Version to update to (required)
#   -s, --service <name>      Update specific service only
#   -a, --all                 Update all application services
#   -f, --force               Force update even with same image
#   -h, --help                Show help

$ErrorActionPreference = "Stop"

# Default values
$Stack = "gatrix"
$Version = ""
$Service = ""
$All = $false
$Force = $false

# Show help function
function Show-Help {
    Write-Host "Gatrix Swarm Update Script (Rolling Update)"
    Write-Host ""
    Write-Host "Usage: ./update.ps1 [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -n, --stack <name>        Stack name (default: gatrix)"
    Write-Host "  -v, --version <version>   Version to update to (required)"
    Write-Host "  -s, --service <name>      Update specific service only"
    Write-Host "  -a, --all                 Update all application services"
    Write-Host "  -f, --force               Force update even with same image"
    Write-Host "  -h, --help                Show help"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  ./update.ps1 -v 1.2.0 -a"
    Write-Host "  ./update.ps1 --version 1.2.0 --all"
    Write-Host "  ./update.ps1 -v 1.2.0 -s backend"
    Write-Host "  ./update.ps1 --version 1.2.0 --service backend"
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
        { $_ -eq "-v" -or $_ -eq "--version" } {
            $Version = $args[$i + 1]
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
        { $_ -eq "-f" -or $_ -eq "--force" } {
            $Force = $true
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
$UpdateServices = @("backend", "frontend", "event-lens", "event-lens-worker", "chat-server", "edge")

function Show-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Blue }
function Show-Success($msg) { Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Show-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Show-Error($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }

function Update-Service($svcName, $ver) {
    $fullServiceName = "$Stack`_$svcName"
    
    # Map service name to image name
    $imageService = $svcName
    if ($svcName -eq "event-lens-worker") {
        $imageService = "event-lens"
    }

    $newImage = "uwocn.tencentcloudcr.com/uwocn/gatrix-$imageService`:$ver"

    docker service inspect $fullServiceName > $null 2>&1
    if ($LASTEXITCODE -eq 0) {
        Show-Info "Updating $svcName to version $ver..."
        Show-Info "New image: $newImage"

        if ($Force) {
            docker service update --image $newImage --force $fullServiceName
        }
        else {
            docker service update --image $newImage $fullServiceName
        }
        Show-Success "Update initiated for: $svcName"
    }
    else {
        Show-Warn "Service not found: $fullServiceName"
    }
}

function Watch-Update($svcName) {
    if (-not $svcName) { return }
    $fullServiceName = "$Stack`_$svcName"
    Show-Info "Watching update progress for $svcName..."
    docker service ps $fullServiceName --format "table {{.Name}}\t{{.Image}}\t{{.CurrentState}}\t{{.Error}}"
}

# Main Logic
Write-Host "========================================"
Write-Host "   Gatrix Swarm Rolling Update"
Write-Host "========================================"
Write-Host ""

if (-not $Version) {
    Show-Error "Version is required. Use --version <version>"
    exit 1
}

Show-Info "Target version: $Version"
Write-Host ""

if ($Service) {
    Update-Service $Service $Version
    Start-Sleep -Seconds 5
    Watch-Update $Service
}
elseif ($All) {
    Show-Info "Updating all application services..."
    foreach ($svc in $UpdateServices) {
        Update-Service $svc $Version
        Start-Sleep -Seconds 2
    }
}
else {
    Show-Error "Please specify --service <name> or --all"
    exit 1
}

Write-Host ""
Show-Info "Service status after update:"
docker stack services $Stack

Write-Host ""
Show-Success "Update initiated! Use 'docker service ps <service>' to monitor progress."
