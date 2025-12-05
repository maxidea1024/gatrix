# Edge Server Stress Test Script
# Usage: .\edge-stress-test.ps1 [-Concurrent 10] [-Duration 30] [-EdgeUrl "http://localhost:51337"]

param(
    [int]$Concurrent = 10,        # Number of concurrent requests
    [int]$Duration = 30,          # Duration in seconds
    [string]$EdgeUrl = "http://localhost:51337"
)

$headers = @{
    "x-api-token" = "gatrix-unsecured-server-api-token"
    "x-application-name" = "stress-test"
    "x-environment-id" = "01KBP3PMDF4MJPKYVX7ER1VMSH"
}

# API endpoints to test
$endpoints = @(
    @{ Path = "/health"; Auth = $false },
    @{ Path = "/api/v1/client/game-worlds"; Auth = $false },
    @{ Path = "/api/v1/client/cache-stats"; Auth = $false },
    @{ Path = "/api/v1/client/test"; Auth = $true },
    @{ Path = "/api/v1/client/client-version?platform=android&version=latest"; Auth = $true },
    @{ Path = "/api/v1/client/banners"; Auth = $true },
    @{ Path = "/api/v1/client/versions"; Auth = $true },
    @{ Path = "/api/v1/client/notices"; Auth = $true }
)

# Statistics
$stats = @{
    Total = 0
    Success = 0
    Failed = 0
    ByEndpoint = @{}
    Latencies = [System.Collections.ArrayList]::new()
}

# Initialize endpoint stats
foreach ($ep in $endpoints) {
    $stats.ByEndpoint[$ep.Path] = @{ Success = 0; Failed = 0; Latencies = [System.Collections.ArrayList]::new() }
}

$lock = [System.Threading.Mutex]::new($false)

Write-Host "=== Edge Server Stress Test ===" -ForegroundColor Cyan
Write-Host "Target: $EdgeUrl" -ForegroundColor Yellow
Write-Host "Concurrent Workers: $Concurrent" -ForegroundColor Yellow
Write-Host "Duration: $Duration seconds" -ForegroundColor Yellow
Write-Host ""

$startTime = Get-Date
$endTime = $startTime.AddSeconds($Duration)

# Worker script block
$workerScript = {
    param($EdgeUrl, $headers, $endpoints, $endTime, $workerId)
    
    $localStats = @{
        Total = 0
        Success = 0
        Failed = 0
        ByEndpoint = @{}
        Latencies = [System.Collections.ArrayList]::new()
    }
    
    foreach ($ep in $endpoints) {
        $localStats.ByEndpoint[$ep.Path] = @{ Success = 0; Failed = 0; Latencies = [System.Collections.ArrayList]::new() }
    }
    
    while ((Get-Date) -lt $endTime) {
        # Pick random endpoint
        $ep = $endpoints | Get-Random
        $url = "$EdgeUrl$($ep.Path)"
        
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        try {
            if ($ep.Auth) {
                $null = Invoke-RestMethod -Uri $url -Headers $headers -TimeoutSec 5 -ErrorAction Stop
            } else {
                $null = Invoke-RestMethod -Uri $url -TimeoutSec 5 -ErrorAction Stop
            }
            $sw.Stop()
            $localStats.Success++
            $localStats.ByEndpoint[$ep.Path].Success++
            $null = $localStats.ByEndpoint[$ep.Path].Latencies.Add($sw.ElapsedMilliseconds)
        } catch {
            $sw.Stop()
            # 404 is expected for client-version without data
            if ($_.Exception.Response.StatusCode -eq 404) {
                $localStats.Success++
                $localStats.ByEndpoint[$ep.Path].Success++
            } else {
                $localStats.Failed++
                $localStats.ByEndpoint[$ep.Path].Failed++
            }
            $null = $localStats.ByEndpoint[$ep.Path].Latencies.Add($sw.ElapsedMilliseconds)
        }
        $localStats.Total++
        $null = $localStats.Latencies.Add($sw.ElapsedMilliseconds)
    }
    
    return $localStats
}

Write-Host "Starting $Concurrent workers..." -ForegroundColor Green

# Start jobs
$jobs = @()
for ($i = 1; $i -le $Concurrent; $i++) {
    $jobs += Start-Job -ScriptBlock $workerScript -ArgumentList $EdgeUrl, $headers, $endpoints, $endTime, $i
}

# Wait and show progress
Write-Host ""
$progressChars = @('|', '/', '-', '\')
$charIndex = 0
while ((Get-Date) -lt $endTime) {
    $remaining = [math]::Ceiling(($endTime - (Get-Date)).TotalSeconds)
    $char = $progressChars[$charIndex % 4]
    Write-Host "`r$char Running... $remaining seconds remaining " -NoNewline
    $charIndex++
    Start-Sleep -Milliseconds 250
}
Write-Host "`rTest completed!                    "

# Collect results
Write-Host "Collecting results..." -ForegroundColor Yellow
$jobs | Wait-Job | Out-Null

foreach ($job in $jobs) {
    $result = Receive-Job -Job $job
    $stats.Total += $result.Total
    $stats.Success += $result.Success
    $stats.Failed += $result.Failed
    $null = $stats.Latencies.AddRange($result.Latencies)
    
    foreach ($ep in $endpoints) {
        $path = $ep.Path
        $stats.ByEndpoint[$path].Success += $result.ByEndpoint[$path].Success
        $stats.ByEndpoint[$path].Failed += $result.ByEndpoint[$path].Failed
        $null = $stats.ByEndpoint[$path].Latencies.AddRange($result.ByEndpoint[$path].Latencies)
    }
}

$jobs | Remove-Job

# Calculate statistics
$actualDuration = ((Get-Date) - $startTime).TotalSeconds
$rps = [math]::Round($stats.Total / $actualDuration, 2)
$successRate = if ($stats.Total -gt 0) { [math]::Round(($stats.Success / $stats.Total) * 100, 2) } else { 0 }

$sortedLatencies = $stats.Latencies | Sort-Object
$avgLatency = if ($sortedLatencies.Count -gt 0) { [math]::Round(($sortedLatencies | Measure-Object -Average).Average, 2) } else { 0 }
$p50 = if ($sortedLatencies.Count -gt 0) { $sortedLatencies[[math]::Floor($sortedLatencies.Count * 0.5)] } else { 0 }
$p95 = if ($sortedLatencies.Count -gt 0) { $sortedLatencies[[math]::Floor($sortedLatencies.Count * 0.95)] } else { 0 }
$p99 = if ($sortedLatencies.Count -gt 0) { $sortedLatencies[[math]::Floor($sortedLatencies.Count * 0.99)] } else { 0 }

# Print results
Write-Host ""
Write-Host "=== Results ===" -ForegroundColor Cyan
Write-Host "Duration: $([math]::Round($actualDuration, 2)) seconds" -ForegroundColor White
Write-Host "Total Requests: $($stats.Total)" -ForegroundColor White
Write-Host "Successful: $($stats.Success)" -ForegroundColor Green
Write-Host "Failed: $($stats.Failed)" -ForegroundColor $(if ($stats.Failed -eq 0) { "Green" } else { "Red" })
Write-Host "Success Rate: $successRate%" -ForegroundColor $(if ($successRate -ge 99) { "Green" } elseif ($successRate -ge 95) { "Yellow" } else { "Red" })
Write-Host "Requests/sec: $rps" -ForegroundColor White
Write-Host ""
Write-Host "Latency (ms):" -ForegroundColor Yellow
Write-Host "  Avg: $avgLatency ms"
Write-Host "  P50: $p50 ms"
Write-Host "  P95: $p95 ms"
Write-Host "  P99: $p99 ms"

Write-Host ""
Write-Host "=== Per-Endpoint Stats ===" -ForegroundColor Cyan
foreach ($ep in $endpoints) {
    $path = $ep.Path
    $epStats = $stats.ByEndpoint[$path]
    $epTotal = $epStats.Success + $epStats.Failed
    $epRate = if ($epTotal -gt 0) { [math]::Round(($epStats.Success / $epTotal) * 100, 1) } else { 0 }
    $epAvg = if ($epStats.Latencies.Count -gt 0) { [math]::Round(($epStats.Latencies | Measure-Object -Average).Average, 1) } else { 0 }
    
    $shortPath = if ($path.Length -gt 50) { $path.Substring(0, 47) + "..." } else { $path }
    Write-Host ("  {0,-50} | {1,5} reqs | {2,5}% ok | {3,5} ms avg" -f $shortPath, $epTotal, $epRate, $epAvg)
}

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Green

