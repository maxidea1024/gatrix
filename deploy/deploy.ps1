<#
.SYNOPSIS
    Gatrix Swarm Deployment Script

.DESCRIPTION
    Script to deploy Gatrix stack to Docker Swarm.

.PARAMETER Version
    Version to deploy (default: latest).

.PARAMETER EnvFile
    Environment file path (default: .env).

.PARAMETER Stack
    Stack name (default: gatrix).

.PARAMETER Init
    Initialize swarm and create secrets.

.PARAMETER Update
    Update existing deployment (rolling update).

.PARAMETER Prune
    Remove unused images after deployment.

.EXAMPLE
    .\deploy.ps1 -Version "1.0.0" -Init
#>

param(
    [string]$Version = "latest",
    [string]$EnvFile = ".env",
    [string]$Stack = "gatrix",
    [switch]$Init = $false,
    [switch]$Update = $false,
    [switch]$Prune = $false
)

$ErrorActionPreference = "Stop"

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
        Show-Error "Docker Swarm is not initialized. Run with -Init flag or run 'docker swarm init'"
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
    Show-Warn "Environment file not found: $EnvFile"
}
$env:GATRIX_VERSION = $Version

# Create Secrets
if ($Init) {
    Show-Info "Creating Docker secrets..."
    
    $secrets = @{
        "db_root_password"   = $env:DB_ROOT_PASSWORD;
        "db_password"        = $env:DB_PASSWORD;
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

        docker secret inspect $key > $null 2>&1
        if ($LASTEXITCODE -eq 0) {
            Show-Warn "Secret '$key' already exists, skipping..."
        }
        else {
            $val | docker secret create $key -
            Show-Success "Created secret: $key"
        }
    }
}

# Login Registry
$loginScript = Join-Path $PSScriptRoot "login_registry.ps1"
if (Test-Path $loginScript) {
    & $loginScript
}
else {
    Show-Warn "Login script not found at $loginScript"
}

# Pull Images
Show-Info "Pulling images for version: $Version"
$services = @("backend", "frontend", "event-lens", "chat-server", "edge")
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
    
    docker stack deploy -c docker-stack.yml --with-registry-auth $Stack
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
    # Check if there are services running with 0 replicas in ps, or desired != running
    # This logic mimics the bash script: check if any service has "0/" replicas running
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
Write-Host "  - Frontend: http://localhost:$($env:HTTP_PORT)"
Write-Host "  - API: http://localhost:$($env:HTTP_PORT)/api/v1"
Write-Host "  - Grafana: http://localhost:$($env:HTTP_PORT)/grafana"
