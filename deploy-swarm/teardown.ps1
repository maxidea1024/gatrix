#!/usr/bin/env pwsh
#
# Gatrix Swarm Teardown Script
# Cleanly removes the entire stack and optionally cleans up volumes/secrets.
#
# Usage:
#   ./teardown.ps1 [options]
#
# Options:
#   -n, --stack <name>        Stack name (default: gatrix)
#   --volumes                 Also remove Docker volumes
#   --secrets                 Also remove Docker secrets
#   --all                     Remove everything (stack + volumes + secrets)
#   -y, --yes                 Skip confirmation prompt
#   -h, --help                Show help

$ErrorActionPreference = "Stop"

$Stack = "gatrix"
$RemoveVolumes = $false
$RemoveSecrets = $false
$SkipConfirm = $false

function Show-Help {
    Write-Host "Gatrix Swarm Teardown Script"
    Write-Host ""
    Write-Host "Usage: ./teardown.ps1 [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -n, --stack <name>        Stack name (default: gatrix)"
    Write-Host "  --volumes                 Also remove Docker volumes"
    Write-Host "  --secrets                 Also remove Docker secrets"
    Write-Host "  --all                     Remove everything (stack + volumes + secrets)"
    Write-Host "  -y, --yes                 Skip confirmation prompt"
    Write-Host "  -h, --help                Show help"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  ./teardown.ps1                    # Remove stack only"
    Write-Host "  ./teardown.ps1 --all              # Remove everything"
    Write-Host "  ./teardown.ps1 --all -y           # Remove everything without prompt"
    exit 0
}

$i = 0
while ($i -lt $args.Count) {
    switch ($args[$i]) {
        { $_ -eq "-n" -or $_ -eq "--stack" } { $Stack = $args[$i + 1]; $i += 2 }
        "--volumes" { $RemoveVolumes = $true; $i += 1 }
        "--secrets" { $RemoveSecrets = $true; $i += 1 }
        "--all" { $RemoveVolumes = $true; $RemoveSecrets = $true; $i += 1 }
        { $_ -eq "-y" -or $_ -eq "--yes" } { $SkipConfirm = $true; $i += 1 }
        { $_ -eq "-h" -or $_ -eq "--help" } { Show-Help }
        default { Write-Host "Unknown option: $($args[$i])" -ForegroundColor Red; exit 1 }
    }
}

function Show-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Blue }
function Show-Success($msg) { Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Show-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }

Write-Host "========================================"
Write-Host "   Gatrix Swarm Teardown"
Write-Host "========================================"
Write-Host ""

Show-Info "Stack: $Stack"
Show-Info "Remove volumes: $RemoveVolumes"
Show-Info "Remove secrets: $RemoveSecrets"
Write-Host ""

if (-not $SkipConfirm) {
    Write-Host "WARNING: This will remove the stack and all running services." -ForegroundColor Red
    $confirm = Read-Host "Are you sure? (y/N)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Host "Cancelled."
        exit 0
    }
}

# Remove stack
Show-Info "Removing stack: $Stack..."
$stackExists = docker stack ls --format '{{.Name}}' | Where-Object { $_ -eq $Stack }
if ($stackExists) {
    docker stack rm $Stack 2>&1 | Out-Null
    Show-Success "Stack removal initiated: $Stack"
} else {
    Write-Host "[WARN] Stack '$Stack' not found (already removed)" -ForegroundColor Yellow
}

Show-Info "Waiting for services to stop..."
Start-Sleep -Seconds 10

Show-Success "All services stopped"

# Remove volumes
if ($RemoveVolumes) {
    Show-Info "Removing Docker volumes..."
    $volumePrefix = "${Stack}_"
    $volumes = docker volume ls --filter "name=$volumePrefix" -q 2>$null
    if ($volumes) {
        foreach ($vol in ($volumes -split "`n" | Where-Object { $_ })) {
            docker volume rm $vol 2>$null
            Show-Success "Removed volume: $vol"
        }
    }
    else {
        Show-Info "No volumes found with prefix: $volumePrefix"
    }
}

# Remove secrets
if ($RemoveSecrets) {
    Show-Info "Removing Docker secrets..."
    $secretNames = @("jwt_secret", "jwt_refresh_secret", "session_secret", "api_secret", "edge_api_token", "grafana_password")
    foreach ($secret in $secretNames) {
        docker secret inspect $secret > $null 2>&1
        if ($LASTEXITCODE -eq 0) {
            docker secret rm $secret 2>$null
            Show-Success "Removed secret: $secret"
        }
    }
}

# Cleanup
Show-Info "Pruning unused networks..."
docker network prune -f 2>$null

Write-Host ""
Show-Success "Teardown completed!"
Write-Host ""
Write-Host "To verify clean state:"
Write-Host "  docker stack ls"
Write-Host "  docker service ls"
Write-Host "  docker volume ls"
Write-Host "  docker secret ls"
