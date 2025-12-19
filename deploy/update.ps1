<#
.SYNOPSIS
    Gatrix Swarm Update Script (Rolling Update)

.DESCRIPTION
    Script to perform a rolling update of Gatrix services in a Docker Swarm.

.PARAMETER Stack
    Stack name (default: gatrix).

.PARAMETER Version
    Version to update to (required).

.PARAMETER Service
    Update specific service only.

.PARAMETER All
    Update all application services.

.PARAMETER Force
    Force update even with same image.

.EXAMPLE
    .\update.ps1 -Version 1.2.0 -All
    .\update.ps1 -Version 1.2.0 -Service backend
#>

param(
    [string]$Stack = "gatrix",
    [string]$Version = "",
    [string]$Service = "",
    [switch]$All = $false,
    [switch]$Force = $false
)

$ErrorActionPreference = "Stop"

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
    Show-Error "Version is required. Use -Version <version>"
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
    Show-Error "Please specify -Service <name> or -All"
    exit 1
}

Write-Host ""
Show-Info "Service status after update:"
docker stack services $Stack

Write-Host ""
Show-Success "Update initiated! Use 'docker service ps <service>' to monitor progress."
