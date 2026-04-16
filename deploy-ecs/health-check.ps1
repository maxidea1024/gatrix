#!/usr/bin/env pwsh
#
# Gatrix ECS Health Check Script
#
# Usage:
#   ./health-check.ps1 [options]

$ErrorActionPreference = "Stop"
$Prefix = "gatrix"
$Timeout = 120

$i = 0
while ($i -lt $args.Count) {
    switch ($args[$i]) {
        { $_ -eq "-p" -or $_ -eq "--prefix" } { $Prefix = $args[$i + 1]; $i += 2 }
        "--timeout" { $Timeout = [int]$args[$i + 1]; $i += 2 }
        { $_ -eq "-h" -or $_ -eq "--help" } {
            Write-Host "Gatrix ECS Health Check Script"
            Write-Host ""
            Write-Host "Options:"
            Write-Host "  -p, --prefix <name>       Stack prefix (default: gatrix)"
            Write-Host "  --timeout <seconds>       Max wait (default: 120)"
            Write-Host "  -h, --help                Show help"
            exit 0
        }
        default { Write-Host "Unknown option: $($args[$i])" -ForegroundColor Red; exit 1 }
    }
}

$envPath = Join-Path $PSScriptRoot ".env"
if (Test-Path $envPath) {
    Get-Content $envPath | Where-Object { $_ -match "=" -and $_ -notmatch "^\s*#" } | ForEach-Object {
        $parts = $_ -split '=', 2
        [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
    }
}
$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { "ap-northeast-2" }
$ClusterName = "$Prefix-cluster"

$PassCount = 0
$FailCount = 0

function Check-Pass($msg) { $script:PassCount++; Write-Host "[PASS] $msg" -ForegroundColor Green }
function Check-Fail($msg) { $script:FailCount++; Write-Host "[FAIL] $msg" -ForegroundColor Red }
function Show-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Blue }

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Gatrix ECS Health Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check ECS cluster exists
Show-Info "Checking ECS cluster: $ClusterName..."
$clusterStatus = aws ecs describe-clusters --clusters $ClusterName --region $Region --query "clusters[0].status" --output text 2>$null
if ($clusterStatus -eq "ACTIVE") {
    Check-Pass "ECS Cluster '$ClusterName' is active"
} else {
    Check-Fail "ECS Cluster '$ClusterName' not found or inactive"
    exit 1
}

# 2. Check services
Show-Info "Checking ECS services..."
foreach ($svc in @("backend", "frontend", "edge")) {
    $ecsName = "$Prefix-$svc"
    $info = aws ecs describe-services --cluster $ClusterName --services $ecsName --region $Region --query "services[0].{Running:runningCount,Desired:desiredCount,Status:status}" --output json 2>$null | ConvertFrom-Json
    if ($info -and $info.Status -eq "ACTIVE") {
        if ($info.Running -eq $info.Desired -and $info.Desired -gt 0) {
            Check-Pass "$svc ($($info.Running)/$($info.Desired))"
        } elseif ($info.Running -gt 0) {
            Check-Fail "$svc ($($info.Running)/$($info.Desired)) - partial"
        } else {
            Check-Fail "$svc ($($info.Running)/$($info.Desired)) - no running tasks"
        }
    } else {
        Check-Fail "$svc - service not found"
    }
}

# 3. Check ALB health
Show-Info "Checking ALB endpoint..."
$albDns = aws cloudformation describe-stacks --stack-name "$Prefix-alb" --region $Region --query "Stacks[0].Outputs[?OutputKey=='ALBDnsName'].OutputValue" --output text 2>$null
if ($albDns) {
    # Backend health
    try {
        $resp = Invoke-WebRequest -Uri "http://${albDns}/health" -TimeoutSec 10 -ErrorAction Stop
        if ($resp.StatusCode -eq 200) { Check-Pass "Backend API (http://${albDns}/health)" }
        else { Check-Fail "Backend API returned $($resp.StatusCode)" }
    } catch { Check-Fail "Backend API (http://${albDns}/health)" }

    # Frontend health
    try {
        $resp = Invoke-WebRequest -Uri "http://${albDns}/" -TimeoutSec 5 -ErrorAction Stop
        if ($resp.StatusCode -eq 200) { Check-Pass "Frontend (http://${albDns}/)" }
        else { Check-Fail "Frontend returned $($resp.StatusCode)" }
    } catch { Check-Fail "Frontend (http://${albDns}/)" }
} else {
    Check-Fail "ALB DNS name not found"
}

# 4. Check Target Group health
Show-Info "Checking ALB Target Groups..."
foreach ($tgName in @("backend-tg", "frontend-tg", "edge-tg")) {
    $tgArn = aws cloudformation describe-stacks --stack-name "$Prefix-alb" --region $Region --query "Stacks[0].Outputs[?contains(OutputKey,'$(($tgName -replace '-tg','') | ForEach-Object { (Get-Culture).TextInfo.ToTitleCase($_) })TargetGroupArn')].OutputValue" --output text 2>$null
    if ($tgArn) {
        $healthyCount = (aws elbv2 describe-target-health --target-group-arn $tgArn --region $Region --query "TargetHealthDescriptions[?TargetHealth.State=='healthy']" --output json 2>$null | ConvertFrom-Json).Count
        if ($healthyCount -gt 0) {
            Check-Pass "Target Group $tgName ($healthyCount healthy targets)"
        } else {
            Check-Fail "Target Group $tgName (no healthy targets)"
        }
    }
}

# Summary
Write-Host ""
Write-Host "========================================"
$total = $PassCount + $FailCount
Write-Host "   Results: $PassCount/$total passed"
Write-Host "========================================"
Write-Host ""

if ($FailCount -eq 0) {
    Write-Host "[PASS] All health checks passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "[FAIL] $FailCount check(s) failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:"
    Write-Host "  ./status.ps1 --health            # Check service health"
    Write-Host "  ./status.ps1 -l backend          # Check backend logs"
    exit 1
}
