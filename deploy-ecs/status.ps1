#!/usr/bin/env pwsh
#
# Gatrix ECS Status Script
#
# Usage:
#   ./status.ps1 [options]

$ErrorActionPreference = "Stop"
$Prefix = "gatrix"
$ShowServices = $false
$ShowTasks = $false
$Logs = ""
$ShowHealth = $false

$i = 0
while ($i -lt $args.Count) {
    switch ($args[$i]) {
        { $_ -eq "-p" -or $_ -eq "--prefix" } { $Prefix = $args[$i + 1]; $i += 2 }
        { $_ -eq "-s" -or $_ -eq "--services" } { $ShowServices = $true; $i += 1 }
        { $_ -eq "-t" -or $_ -eq "--tasks" } { $ShowTasks = $true; $i += 1 }
        { $_ -eq "-l" -or $_ -eq "--logs" } { $Logs = $args[$i + 1]; $i += 2 }
        "--health" { $ShowHealth = $true; $i += 1 }
        { $_ -eq "-h" -or $_ -eq "--help" } {
            Write-Host "Gatrix ECS Status Script"
            Write-Host ""
            Write-Host "Options:"
            Write-Host "  -p, --prefix <name>       Stack prefix (default: gatrix)"
            Write-Host "  -s, --services            Show service list"
            Write-Host "  -t, --tasks               Show running tasks"
            Write-Host "  -l, --logs <service>      Show logs (CloudWatch)"
            Write-Host "  --health                  Show health status"
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

function Show-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Blue }

function Show-ServicesList {
    Show-Info "ECS Services in cluster: $ClusterName"
    Write-Host ""
    foreach ($svc in @("backend", "frontend", "edge", "prometheus", "grafana")) {
        $ecsName = "$Prefix-$svc"
        $info = aws ecs describe-services --cluster $ClusterName --services $ecsName --region $Region --query "services[0].{Status:status,Running:runningCount,Desired:desiredCount,TaskDef:taskDefinition}" --output json 2>$null | ConvertFrom-Json
        if ($info -and $info.Status) {
            $color = if ($info.Running -eq $info.Desired) { "Green" } else { "Yellow" }
            Write-Host "  $svc : $($info.Running)/$($info.Desired) [$($info.Status)] - $($info.TaskDef)" -ForegroundColor $color
        }
    }
}

function Show-TasksList {
    Show-Info "Running tasks in cluster: $ClusterName"
    Write-Host ""
    $taskArns = aws ecs list-tasks --cluster $ClusterName --region $Region --query "taskArns[]" --output json | ConvertFrom-Json
    if ($taskArns -and $taskArns.Count -gt 0) {
        aws ecs describe-tasks --cluster $ClusterName --tasks $taskArns --region $Region --query "tasks[*].{TaskId:taskArn,Group:group,Status:lastStatus,Health:healthStatus,StartedAt:startedAt}" --output table
    } else {
        Write-Host "  No running tasks"
    }
}

function Show-ServiceLogs($svcName) {
    $logGroup = "/ecs/$Prefix-$svcName"
    Show-Info "Tailing logs: $logGroup"
    aws logs tail $logGroup --region $Region --follow --since 5m
}

function Show-HealthStatus {
    Show-Info "Health Status"
    Write-Host ""
    foreach ($svc in @("backend", "frontend", "edge")) {
        $ecsName = "$Prefix-$svc"
        $info = aws ecs describe-services --cluster $ClusterName --services $ecsName --region $Region --query "services[0].{Running:runningCount,Desired:desiredCount}" --output json 2>$null | ConvertFrom-Json
        if ($info) {
            if ($info.Running -eq $info.Desired -and $info.Desired -gt 0) {
                Write-Host "  OK   $svc ($($info.Running)/$($info.Desired))" -ForegroundColor Green
            } elseif ($info.Running -gt 0) {
                Write-Host "  WARN $svc ($($info.Running)/$($info.Desired))" -ForegroundColor Yellow
            } else {
                Write-Host "  DOWN $svc ($($info.Running)/$($info.Desired))" -ForegroundColor Red
            }
        }
    }
}

Write-Host "========================================"
Write-Host "   Gatrix ECS Status"
Write-Host "========================================"

if ($Logs) { Show-ServiceLogs $Logs }
elseif ($ShowServices) { Show-ServicesList }
elseif ($ShowTasks) { Show-TasksList }
elseif ($ShowHealth) { Show-HealthStatus }
else { Show-ServicesList; Write-Host ""; Show-HealthStatus }
