#!/usr/bin/env pwsh
#
# Gatrix Post-Deploy Health Check Script
# Verifies that all services are running and responding correctly.
#
# Usage:
#   ./health-check.ps1 [options]
#
# Options:
#   -n, --stack <name>        Stack name (default: gatrix)
#   --timeout <seconds>       Max wait time for services (default: 120)
#   -h, --help                Show help

$ErrorActionPreference = "Stop"

$Stack = "gatrix"
$Timeout = 120

$i = 0
while ($i -lt $args.Count) {
    switch ($args[$i]) {
        { $_ -eq "-n" -or $_ -eq "--stack" } { $Stack = $args[$i + 1]; $i += 2 }
        "--timeout" { $Timeout = [int]$args[$i + 1]; $i += 2 }
        { $_ -eq "-h" -or $_ -eq "--help" } {
            Write-Host "Gatrix Post-Deploy Health Check Script"
            Write-Host ""
            Write-Host "Usage: ./health-check.ps1 [options]"
            Write-Host ""
            Write-Host "Options:"
            Write-Host "  -n, --stack <name>        Stack name (default: gatrix)"
            Write-Host "  --timeout <seconds>       Max wait for services (default: 120)"
            Write-Host "  -h, --help                Show help"
            exit 0
        }
        default { Write-Host "Unknown option: $($args[$i])" -ForegroundColor Red; exit 1 }
    }
}

$PassCount = 0
$FailCount = 0

function Check-Pass($msg) { $script:PassCount++; Write-Host "[PASS] $msg" -ForegroundColor Green }
function Check-Fail($msg) { $script:FailCount++; Write-Host "[FAIL] $msg" -ForegroundColor Red }
function Show-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Blue }
function Show-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }

Write-Host "========================================"
Write-Host "   Gatrix Post-Deploy Health Check"
Write-Host "========================================"
Write-Host ""

# 1. Check stack exists
Show-Info "Checking stack: $Stack..."
$stacks = docker stack ls --format '{{.Name}}'
if ($stacks -contains $Stack) {
    Check-Pass "Stack '$Stack' exists"
}
else {
    Check-Fail "Stack '$Stack' not found"
    Write-Host ""
    Write-Host "[FAIL] Stack not deployed. Run ./deploy.ps1 first." -ForegroundColor Red
    exit 1
}

# 2. Wait for replicas
Show-Info "Waiting for all services to reach desired replicas (timeout: ${Timeout}s)..."
$elapsed = 0
while ($elapsed -lt $Timeout) {
    $svcList = docker stack services $Stack --format '{{.Replicas}}'
    $notReady = $svcList | Where-Object { $_ -match "0/" }
    if (-not $notReady) {
        Check-Pass "All services have running replicas"
        break
    }
    Start-Sleep -Seconds 5
    $elapsed += 5
    Write-Host -NoNewline "."
}
Write-Host ""

if ($elapsed -ge $Timeout) {
    Check-Fail "Timeout waiting for services to be ready"
}

# 3. Check individual services
Show-Info "Checking individual service health..."
Write-Host ""

$services = docker stack services $Stack --format "{{.Name}}|{{.Replicas}}"
foreach ($svcInfo in ($services -split "`n" | Where-Object { $_ })) {
    $parts = $svcInfo -split '\|'
    $name = $parts[0]
    $replicas = $parts[1]
    $replicaParts = $replicas -split '/'
    $running = $replicaParts[0]
    $desired = $replicaParts[1]

    if ($running -eq $desired -and $desired -ne "0") {
        Check-Pass "$name ($replicas)"
    }
    elseif ([int]$running -gt 0) {
        Show-Warn "$name ($replicas) - partial"
        $script:FailCount++
    }
    else {
        Check-Fail "$name ($replicas) - no running tasks"
    }
}

# 4. HTTP endpoint checks (direct service ports)
Write-Host ""
Show-Info "Checking HTTP endpoints (direct ports)..."

# Load env for port overrides
$envFile = Join-Path $PSScriptRoot ".env"
$backendPort = "45000"
$frontendPort = "43000"
$httpPort = "80"
$nginxReplicas = "0"
if (Test-Path $envFile) {
    Get-Content $envFile | Where-Object { $_ -match "=" -and $_ -notmatch "^\s*#" } | ForEach-Object {
        $parts = $_ -split '=', 2
        $key = $parts[0].Trim()
        $val = $parts[1].Trim()
        switch ($key) {
            "BACKEND_PORT" { $backendPort = $val }
            "FRONTEND_PORT" { $frontendPort = $val }
            "HTTP_PORT" { $httpPort = $val }
            "NGINX_REPLICAS" { $nginxReplicas = $val }
        }
    }
}

# Backend API
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:${backendPort}/health" -TimeoutSec 10 -ErrorAction Stop
    if ($resp.StatusCode -eq 200) { Check-Pass "Backend API (http://localhost:${backendPort}/health)" }
    else { Check-Fail "Backend API returned $($resp.StatusCode)" }
}
catch { Check-Fail "Backend API (http://localhost:${backendPort}/health)" }

# Frontend
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:${frontendPort}/health" -TimeoutSec 5 -ErrorAction Stop
    if ($resp.StatusCode -eq 200) { Check-Pass "Frontend (http://localhost:${frontendPort}/health)" }
    else { Check-Fail "Frontend returned $($resp.StatusCode)" }
}
catch { Check-Fail "Frontend (http://localhost:${frontendPort}/health)" }

# Edge server (Cloud LB target)
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:3400/health" -TimeoutSec 5 -ErrorAction Stop
    if ($resp.StatusCode -eq 200) { Check-Pass "Edge server (http://localhost:3400/health)" }
    else { Check-Fail "Edge server returned $($resp.StatusCode)" }
}
catch { Check-Fail "Edge server (http://localhost:3400/health)" }

# Nginx (optional, only if NGINX_REPLICAS > 0)
if ([int]$nginxReplicas -gt 0) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:${httpPort}/health" -TimeoutSec 5 -ErrorAction Stop
        if ($resp.StatusCode -eq 200) { Check-Pass "Nginx gateway (http://localhost:${httpPort}/health)" }
        else { Check-Fail "Nginx gateway returned $($resp.StatusCode)" }
    }
    catch { Check-Fail "Nginx gateway (http://localhost:${httpPort}/health)" }
}

# 5. Summary
Write-Host ""
Write-Host "========================================"
$total = $PassCount + $FailCount
Write-Host "   Results: $PassCount/$total passed"
Write-Host "========================================"
Write-Host ""

if ($FailCount -eq 0) {
    Write-Host "[PASS] All health checks passed!" -ForegroundColor Green
    exit 0
}
else {
    Write-Host "[FAIL] $FailCount check(s) failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:"
    Write-Host "  ./status.ps1 --health            # Check service health"
    Write-Host "  ./status.ps1 -l backend          # Check backend logs"
    exit 1
}
