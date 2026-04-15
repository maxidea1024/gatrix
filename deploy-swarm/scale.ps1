#!/usr/bin/env pwsh
#
# Gatrix Swarm Scaling Script
# Scales services and persists the change to .env for redeployment.
# Use --no-persist to apply changes without updating .env (ephemeral).
#
# Usage:
#   ./scale.ps1 [options]
#
# Options:
#   -n, --stack <name>        Stack name (default: gatrix)
#   -s, --service <name>      Service to scale
#   -r, --replicas <count>    Number of replicas
#   --preset <name>           Use scaling preset (minimal, standard, high)
#   --no-persist              Do NOT update .env (ephemeral, reverts on redeploy)
#   --status                  Show current scaling status
#   -h, --help                Show help

$ErrorActionPreference = "Stop"

$Stack = "gatrix"
$Service = ""
$Replicas = 0
$Preset = ""
$Status = $false
$NoPersist = $false

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
    Write-Host "  --no-persist              Do NOT update .env (ephemeral, reverts on redeploy)"
    Write-Host "  --status                  Show current scaling status"
    Write-Host "  -h, --help                Show help"
    Write-Host ""
    Write-Host "Available services: backend, frontend, edge"
    Write-Host ""
    Write-Host "Presets:"
    Write-Host "  minimal   - backend:1  frontend:1  edge:1  (testing)"
    Write-Host "  standard  - backend:2  frontend:1  edge:2  (production)"
    Write-Host "  high      - backend:4  frontend:2  edge:8  (peak traffic)"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  ./scale.ps1 -s backend -r 4"
    Write-Host "  ./scale.ps1 --preset high"
    Write-Host "  ./scale.ps1 --preset minimal --no-persist"
    Write-Host "  ./scale.ps1 --status"
    Write-Host ""
    Write-Host "By default, changes are saved to .env so they persist across redeployments."
    Write-Host "Use --no-persist to make ephemeral changes only."
    exit 0
}

$i = 0
while ($i -lt $args.Count) {
    switch ($args[$i]) {
        { $_ -eq "-n" -or $_ -eq "--stack" } { $Stack = $args[$i + 1]; $i += 2 }
        { $_ -eq "-s" -or $_ -eq "--service" } { $Service = $args[$i + 1]; $i += 2 }
        { $_ -eq "-r" -or $_ -eq "--replicas" } { $Replicas = [int]$args[$i + 1]; $i += 2 }
        "--preset" { $Preset = $args[$i + 1]; $i += 2 }
        "--no-persist" { $NoPersist = $true; $i += 1 }
        "--status" { $Status = $true; $i += 1 }
        { $_ -eq "-h" -or $_ -eq "--help" } { Show-Help }
        default { Write-Host "Unknown option: $($args[$i])" -ForegroundColor Red; exit 1 }
    }
}

$ScalableServices = @("backend", "frontend", "edge")

function Show-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Blue }
function Show-Success($msg) { Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Show-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Show-Error($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }

# Update .env file with the new replica count
function Update-EnvReplicas($svcName, $count) {
    $varName = switch ($svcName) {
        "backend" { "BACKEND_REPLICAS" }
        "frontend" { "FRONTEND_REPLICAS" }
        "edge" { "EDGE_REPLICAS" }
        default { return }
    }

    $envPath = Join-Path $PSScriptRoot ".env"
    if (-not (Test-Path $envPath)) {
        Show-Warn ".env file not found, skipping persist"
        return
    }

    $content = Get-Content $envPath -Raw
    if ($content -match "(?m)^${varName}=") {
        $content = $content -replace "(?m)^${varName}=.*", "${varName}=${count}"
    } else {
        $content = $content.TrimEnd() + "`n${varName}=${count}`n"
    }
    Set-Content $envPath $content -NoNewline
    Show-Success "Saved to .env: ${varName}=${count}"
}

function Scale-Service($svcName, $count) {
    $fullServiceName = "$Stack`_$svcName"
    docker service inspect $fullServiceName > $null 2>&1
    if ($LASTEXITCODE -ne 0) {
        Show-Warn "Service not found: $fullServiceName"
        return
    }
    Show-Info "Scaling $svcName to $count replicas..."
    docker service scale "$fullServiceName=$count"
    Show-Success "Scaled $svcName to $count replicas"

    if (-not $NoPersist) {
        Update-EnvReplicas $svcName $count
    }
}

function Apply-Preset($name) {
    switch ($name) {
        "minimal" {
            Show-Info "Applying minimal preset..."
            Scale-Service "backend" 1
            Scale-Service "frontend" 1
            Scale-Service "edge" 1
        }
        "standard" {
            Show-Info "Applying standard preset..."
            Scale-Service "backend" 2
            Scale-Service "frontend" 1
            Scale-Service "edge" 2
        }
        "high" {
            Show-Info "Applying high traffic preset..."
            Scale-Service "backend" 4
            Scale-Service "frontend" 2
            Scale-Service "edge" 8
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

Write-Host "========================================"
Write-Host "   Gatrix Swarm Scaling"
Write-Host "========================================"
Write-Host ""

if ($NoPersist) {
    Show-Warn "Running in ephemeral mode (--no-persist). Changes will NOT be saved to .env."
}

if ($Status) { Show-CurrentStatus; exit 0 }

if ($Preset) { Apply-Preset $Preset }
elseif ($Service -and $Replicas -gt 0) { Scale-Service $Service $Replicas }
else { Show-Error "Please specify --service and --replicas, --preset, or --status"; exit 1 }

Write-Host ""
Show-CurrentStatus
Write-Host ""
Show-Success "Scaling completed!"
