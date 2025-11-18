# Start 50 idle-server instances
Write-Host "Starting 50 idle-server instances..." -ForegroundColor Green

# Set environment variables
$env:REDIS_PORT = "6379"
$env:REDIS_HOST = "localhost"
$env:GATRIX_URL = "http://localhost:55000"
$env:API_TOKEN = "gatrix-unsecured-server-api-token"

# Change to SDK directory
$sdkPath = "c:\github\admin-templates\gatrix\packages\sdks\server-sdk"
Set-Location $sdkPath

# Array to store processes
$processes = @()

# Start 50 instances
for ($i = 1; $i -le 50; $i++) {
    $instanceName = "idle-server-$i"
    Write-Host "Starting $instanceName..." -ForegroundColor Cyan
    
    # Create a new PowerShell process for each instance
    $process = Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "`$env:REDIS_PORT='6379'; `$env:REDIS_HOST='localhost'; `$env:GATRIX_URL='http://localhost:55000'; `$env:API_TOKEN='gatrix-unsecured-server-api-token'; `$env:INSTANCE_NAME='$instanceName'; Set-Location '$sdkPath'; npx ts-node test-servers/idle-server.ts"
    ) -PassThru -WindowStyle Minimized
    
    $processes += $process
    
    # Small delay to avoid overwhelming the system
    Start-Sleep -Milliseconds 200
}

Write-Host "`nAll 50 instances started!" -ForegroundColor Green
Write-Host "Process IDs: $($processes.Id -join ', ')" -ForegroundColor Yellow
Write-Host "`nTo stop all instances, run: Get-Process -Id $($processes.Id -join ',') | Stop-Process" -ForegroundColor Yellow

