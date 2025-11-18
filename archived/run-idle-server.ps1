# Run 50 idle-server instances
$env:REDIS_PORT = "6379"
$env:REDIS_HOST = "localhost"
$env:GATRIX_URL = "http://localhost:55000"
$env:API_TOKEN = "gatrix-unsecured-server-api-token"

Set-Location "c:\github\admin-templates\gatrix\packages\sdks\server-sdk"

Write-Host "Starting 50 idle-server instances..." -ForegroundColor Green

# Array to store job objects
$jobs = @()

# Start 50 instances
for ($i = 1; $i -le 50; $i++) {
    $instanceName = "idle-server-$i"
    Write-Host "Starting $instanceName..." -ForegroundColor Cyan

    # Start each instance in a background job
    $job = Start-Job -ScriptBlock {
        param($redisPort, $redisHost, $gatrixUrl, $apiToken, $workDir, $instanceNum)

        $env:REDIS_PORT = $redisPort
        $env:REDIS_HOST = $redisHost
        $env:GATRIX_URL = $gatrixUrl
        $env:API_TOKEN = $apiToken
        $env:INSTANCE_NAME = "idle-server-$instanceNum"

        Set-Location $workDir
        npx ts-node test-servers/idle-server.ts
    } -ArgumentList $env:REDIS_PORT, $env:REDIS_HOST, $env:GATRIX_URL, $env:API_TOKEN, (Get-Location).Path, $i

    $jobs += $job

    # Small delay to avoid overwhelming the system
    Start-Sleep -Milliseconds 100
}

Write-Host "`nAll 50 instances started!" -ForegroundColor Green
Write-Host "Job IDs: $($jobs.Id -join ', ')" -ForegroundColor Yellow
Write-Host "`nTo view logs of a specific job, use: Receive-Job -Id <JobId> -Keep" -ForegroundColor Yellow
Write-Host "To stop all jobs, use: Get-Job | Stop-Job; Get-Job | Remove-Job" -ForegroundColor Yellow
Write-Host "`nMonitoring jobs (press Ctrl+C to exit monitoring)..." -ForegroundColor Cyan

# Monitor jobs
try {
    while ($true) {
        $running = ($jobs | Where-Object { $_.State -eq 'Running' }).Count
        $completed = ($jobs | Where-Object { $_.State -eq 'Completed' }).Count
        $failed = ($jobs | Where-Object { $_.State -eq 'Failed' }).Count

        Write-Host "`r[$(Get-Date -Format 'HH:mm:ss')] Running: $running | Completed: $completed | Failed: $failed" -NoNewline

        Start-Sleep -Seconds 2
    }
} finally {
    Write-Host "`n`nJobs are still running in the background." -ForegroundColor Green
    Write-Host "To stop all jobs: Get-Job | Stop-Job; Get-Job | Remove-Job" -ForegroundColor Yellow
}

