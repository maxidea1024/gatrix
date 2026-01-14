#!/usr/bin/env pwsh
#
# Gatrix Lite Update Script
#
# Usage:
#   ./update-lite.ps1 [options]
#
# Options:
#   -t, --tag <tag>           Image tag to pull (default: latest)
#   -v, --volumes             Remove volumes before starting
#   -f, --file <file>         Compose file (default: docker-compose.lite.yml)
#   -h, --help                Show help

$ErrorActionPreference = "Stop"

# Default values
$Tag = "latest"
$RemoveVolumes = $false
$ComposeFile = "docker-compose.lite.yml"

function Show-Help {
    Write-Host "Gatrix Lite Update Script"
    Write-Host ""
    Write-Host "Usage: ./update-lite.ps1 [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -t, --tag <tag>           Image tag to pull (default: latest)"
    Write-Host "  -v, --volumes             Remove volumes before starting"
    Write-Host "  -f, --file <file>         Compose file (default: docker-compose.lite.yml)"
    Write-Host "  -h, --help                Show help"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  ./update-lite.ps1                     # Update with latest tag"
    Write-Host "  ./update-lite.ps1 -t v1.0.0           # Update with specific tag"
    Write-Host "  ./update-lite.ps1 -t v1.0.0 -v        # Update and remove old volumes"
    exit 0
}

# Parse arguments
$i = 0
while ($i -lt $args.Count) {
    switch ($args[$i]) {
        { $_ -eq "-t" -or $_ -eq "--tag" } {
            $Tag = $args[$i + 1]
            $i += 2
        }
        { $_ -eq "-v" -or $_ -eq "--volumes" } {
            $RemoveVolumes = $true
            $i += 1
        }
        { $_ -eq "-f" -or $_ -eq "--file" } {
            $ComposeFile = $args[$i + 1]
            $i += 2
        }
        { $_ -eq "-h" -or $_ -eq "--help" } {
            Show-Help
        }
        default {
            Write-Host "Unknown option: $($args[$i])" -ForegroundColor Red
            exit 1
        }
    }
}

# Find compose file
if (-not (Test-Path $ComposeFile)) {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $parentFile = Join-Path (Split-Path -Parent $scriptDir) $ComposeFile
    $localFile = Join-Path $scriptDir $ComposeFile
    
    if (Test-Path $parentFile) {
        $ComposeFile = $parentFile
    }
    elseif (Test-Path $localFile) {
        $ComposeFile = $localFile
    }
    else {
        Write-Host "[ERROR] Compose file not found: $ComposeFile" -ForegroundColor Red
        exit 1
    }
}

Write-Host "========================================"
Write-Host "   Gatrix Lite Update"
Write-Host "========================================"
Write-Host ""
Write-Host "[INFO] Compose file: $ComposeFile" -ForegroundColor Blue
Write-Host "[INFO] Image tag: $Tag" -ForegroundColor Blue
Write-Host "[INFO] Remove volumes: $RemoveVolumes" -ForegroundColor Blue
Write-Host ""

# Set environment variable for compose file
$env:GATRIX_VERSION = $Tag

# Stop services
Write-Host "[INFO] Stopping services..." -ForegroundColor Blue
if ($RemoveVolumes) {
    docker compose -f $ComposeFile down -v
    Write-Host "[SUCCESS] Services stopped and volumes removed." -ForegroundColor Green
}
else {
    docker compose -f $ComposeFile down
    Write-Host "[SUCCESS] Services stopped." -ForegroundColor Green
}

# Pull and start
Write-Host "[INFO] Pulling images with tag: $Tag..." -ForegroundColor Blue
docker compose -f $ComposeFile pull

Write-Host "[INFO] Starting services..." -ForegroundColor Blue
docker compose -f $ComposeFile up -d

Write-Host ""
Write-Host "[SUCCESS] Update completed!" -ForegroundColor Green
Write-Host ""
Write-Host "[INFO] Services status:" -ForegroundColor Blue
docker compose -f $ComposeFile ps
