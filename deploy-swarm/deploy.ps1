#!/usr/bin/env pwsh
#
# Gatrix Swarm Deployment Script (Cloud Infra Edition)
#
# Usage:
#   ./deploy.ps1 [options]
#
# Options:
#   -v, --version <version>   Version to deploy (default: latest)
#   -e, --env-file <file>     Environment file path (default: .env)
#   -n, --stack <name>        Stack name (default: gatrix)
#   -i, --init                Initialize swarm and create secrets
#   -u, --update              Update existing deployment (rolling update)
#   --prune                   Remove unused images after deployment
#   -h, --help                Show help

$ErrorActionPreference = "Stop"

# Default values
$Version = "latest"
$EnvFile = ".env"
$Stack = "gatrix"
$Init = $false
$Update = $false
$Prune = $false

# Show help function
function Show-Help {
    Write-Host "Gatrix Swarm Deployment Script (Cloud Infra Edition)"
    Write-Host ""
    Write-Host "Usage: ./deploy.ps1 [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -v, --version <version>   Version to deploy (default: latest)"
    Write-Host "  -e, --env-file <file>     Environment file path (default: .env)"
    Write-Host "  -n, --stack <name>        Stack name (default: gatrix)"
    Write-Host "  -i, --init                Initialize swarm and create secrets"
    Write-Host "  -u, --update              Update existing deployment (rolling update)"
    Write-Host "  --prune                   Remove unused images after deployment"
    Write-Host "  -h, --help                Show help"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  ./deploy.ps1 -v 1.0.0 -i          # First deploy (init swarm)"
    Write-Host "  ./deploy.ps1 -v 1.0.0 -u           # Update deployment"
    Write-Host "  ./deploy.ps1 --version 1.0.0 --init"
    exit 0
}

# Parse arguments
$i = 0
while ($i -lt $args.Count) {
    switch ($args[$i]) {
        { $_ -eq "-v" -or $_ -eq "--version" } {
            $Version = $args[$i + 1]
            $i += 2
        }
        { $_ -eq "-e" -or $_ -eq "--env-file" } {
            $EnvFile = $args[$i + 1]
            $i += 2
        }
        { $_ -eq "-n" -or $_ -eq "--stack" } {
            $Stack = $args[$i + 1]
            $i += 2
        }
        { $_ -eq "-i" -or $_ -eq "--init" } {
            $Init = $true
            $i += 1
        }
        { $_ -eq "-u" -or $_ -eq "--update" } {
            $Update = $true
            $i += 1
        }
        "--prune" {
            $Prune = $true
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

function Show-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Blue }
function Show-Success($msg) { Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Show-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Show-Error($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }

# Check Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Show-Error "Docker is not installed"
    exit 1
}

# Check Swarm
$swarmState = docker info --format '{{.Swarm.LocalNodeState}}'
if ($swarmState -ne "active") {
    if ($Init) {
        Show-Info "Initializing Docker Swarm..."
        docker swarm init
    }
    else {
        Show-Error "Docker Swarm is not initialized. Run with --init flag or run 'docker swarm init'"
        exit 1
    }
}

# Load Env
$envFilePath = Join-Path $PSScriptRoot $EnvFile
if (Test-Path $envFilePath) {
    Show-Info "Loading environment from $envFilePath"
    $envContent = Get-Content $envFilePath | Where-Object { $_ -notmatch '^\s*#' -and $_ -ne "" }
    foreach ($line in $envContent) {
        $parts = $line -split '=', 2
        if ($parts.Length -eq 2) {
            $name = $parts[0].Trim()
            $value = $parts[1].Trim()
            # Set process scope variable
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}
else {
    Show-Error "Environment file not found: $envFilePath"
    Show-Info "Copy .env.example to .env and configure it first:"
    Show-Info "  cp .env.example .env"
    exit 1
}
$env:GATRIX_VERSION = $Version

# Validate required environment variables
$requiredVars = @("DB_HOST", "DB_USER", "DB_PASSWORD", "REDIS_HOST", "EDGE_REDIS_HOST")
foreach ($var in $requiredVars) {
    $val = [Environment]::GetEnvironmentVariable($var, "Process")
    if (-not $val -or $val -match "^your-") {
        Show-Error "Required variable '$var' is not set or still has placeholder value in .env"
        exit 1
    }
}
Show-Success "Environment variables validated"

# Create Secrets
if ($Init) {
    Show-Info "Creating Docker secrets..."
    
    $secrets = @{
        "jwt_secret"         = $env:JWT_SECRET;
        "jwt_refresh_secret" = $env:JWT_REFRESH_SECRET;
        "session_secret"     = $env:SESSION_SECRET;
        "api_secret"         = $env:GATRIX_API_SECRET;
        "edge_api_token"     = $env:EDGE_API_TOKEN;
        "grafana_password"   = $env:GRAFANA_ADMIN_PASSWORD;
    }

    foreach ($key in $secrets.Keys) {
        $val = $secrets[$key]
        if (-not $val) { $val = "default_unsafe_value_change_me" } # Fallback if env missing

        $secretExists = $false
        try {
            $null = docker secret inspect $key 2>&1
            if ($LASTEXITCODE -eq 0) { $secretExists = $true }
        }
        catch {
            $secretExists = $false
        }

        if ($secretExists) {
            Show-Warn "Secret '$key' already exists, skipping..."
        }
        else {
            $val | docker secret create $key -
            Show-Success "Created secret: $key"
        }
    }
}

# Login Registry
$loginScript = Join-Path $PSScriptRoot "login-registry.ps1"
if (Test-Path $loginScript) {
    & $loginScript
}
else {
    Show-Warn "Login script not found at $loginScript"
}

# Pull Images
Show-Info "Pulling images for version: $Version"
$services = @("backend", "frontend", "edge")
foreach ($svc in $services) {
    $img = "uwocn.tencentcloudcr.com/uwocn/gatrix-$svc`:$Version"
    Show-Info "Pulling $img"
    docker pull $img
    if ($LASTEXITCODE -ne 0) {
        Show-Warn "Failed to pull $img, trying latest..."
        docker pull "uwocn.tencentcloudcr.com/uwocn/gatrix-$svc`:latest"
    }
}

# Deploy Stack
Show-Info "Deploying stack: $Stack (version: $Version)"
Push-Location $PSScriptRoot
try {
    if ($Update) { Show-Info "Performing rolling update..." }
    
    docker stack deploy -c docker-compose.swarm.yml --with-registry-auth $Stack
    Show-Success "Stack deployed successfully!"
}
finally {
    Pop-Location
}

# Wait for services
Show-Info "Waiting for services to be ready..."
$timeout = 300
$elapsed = 0

while ($elapsed -lt $timeout) {
    $svcList = docker stack services $Stack --format '{{.Replicas}}'
    
    $notReady = $svcList | Where-Object { $_ -match "0/" }
    
    if ($notReady) {
        Start-Sleep -Seconds 10
        $elapsed += 10
        Write-Host -NoNewline "."
    }
    else {
        Write-Host ""
        Show-Success "All services are ready!"
        break
    }
}

if ($elapsed -ge $timeout) {
    Show-Warn "Timeout waiting for services. Check service status manually."
}

# Prune
if ($Prune) {
    Show-Info "Pruning unused images..."
    docker image prune -f
}

# Show Status
Write-Host ""
Show-Info "Stack Status:"
docker stack services $Stack
Write-Host ""
Show-Info "Service Replicas:"
docker stack ps $Stack --filter "desired-state=running"

Write-Host ""
Show-Success "Deployment completed!"
Write-Host ""
Write-Host "Access your services:"
$fp = if ($env:FRONTEND_PORT) { $env:FRONTEND_PORT } else { "43000" }
$bp = if ($env:BACKEND_PORT) { $env:BACKEND_PORT } else { "45000" }
$gp = if ($env:GRAFANA_PORT) { $env:GRAFANA_PORT } else { "3000" }
$pp = if ($env:PROMETHEUS_PORT) { $env:PROMETHEUS_PORT } else { "9090" }
Write-Host "  - Frontend (Admin UI): http://localhost:$fp"
Write-Host "  - Backend API:         http://localhost:${bp}/health"
Write-Host "  - Edge server:         http://localhost:3400/health"
Write-Host "  - Grafana:             http://localhost:$gp"
Write-Host "  - Prometheus:          http://localhost:$pp"
Write-Host ""
Write-Host "Run ./health-check.ps1 for full service verification."
