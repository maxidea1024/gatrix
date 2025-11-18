# Test etcd no-response detection (short version - only detection, not full TTL)

Write-Host "`n=== Testing etcd No-Response Detection (Short) ===" -ForegroundColor Cyan

# 1. Start idle-server
Write-Host "`n1. Starting idle-server..." -ForegroundColor Yellow
$env:INSTANCE_NAME = "test-no-resp-short"
$env:REDIS_HOST = "localhost"
$env:REDIS_PORT = "6379"
$env:GATRIX_URL = "http://localhost:55000"
$env:API_TOKEN = "gatrix-unsecured-server-api-token"

$serverProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd packages/sdks/server-sdk; npx ts-node test-servers/idle-server.ts" -PassThru -WindowStyle Minimized
Write-Host "   Server started with PID: $($serverProcess.Id)" -ForegroundColor Green

# 2. Wait for registration
Write-Host "`n2. Waiting for service registration (10 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# 3. Check registration
Write-Host "`n3. Checking service registration..." -ForegroundColor Yellow
$etcdKeys = docker exec gatrix-etcd-dev etcdctl get --prefix "/services/idle" --keys-only
if (!$etcdKeys) {
    Write-Host "   ✗ Service NOT registered" -ForegroundColor Red
    Stop-Process -Id $serverProcess.Id -Force
    exit 1
}
Write-Host "   ✓ Service registered" -ForegroundColor Green

$serviceKey = ($etcdKeys -split "`n")[0]
$serviceData = docker exec gatrix-etcd-dev etcdctl get $serviceKey --print-value-only | ConvertFrom-Json
Write-Host "     Instance ID: $($serviceData.instanceId)" -ForegroundColor Gray
Write-Host "     Status: $($serviceData.status)" -ForegroundColor Gray

# 4. Kill the server process (simulate crash)
Write-Host "`n4. Killing idle-server process (simulating crash)..." -ForegroundColor Yellow
Stop-Process -Id $serverProcess.Id -Force
Start-Sleep -Seconds 1

# Kill node process
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue | Where-Object {
    $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine
    $cmd -like "*idle-server*"
}
if ($nodeProcesses) {
    foreach ($proc in $nodeProcesses) {
        Stop-Process -Id $proc.Id -Force
        Write-Host "   ✓ Node process killed (PID: $($proc.Id))" -ForegroundColor Green
    }
}

# 5. Wait for heartbeat timeout + auto-cleanup detection
Write-Host "`n5. Waiting for heartbeat timeout + auto-cleanup (40 seconds)..." -ForegroundColor Yellow
for ($i = 40; $i -gt 0; $i--) {
    Write-Host "   $i..." -NoNewline
    Start-Sleep -Seconds 1
    if ($i % 5 -eq 0) { Write-Host "" }
}
Write-Host " Done!" -ForegroundColor Green

# 6. Check if service status changed to 'no-response'
Write-Host "`n6. Checking if service status changed to 'no-response'..." -ForegroundColor Yellow
$serviceDataAfter = docker exec gatrix-etcd-dev etcdctl get $serviceKey --print-value-only 2>$null
if ($serviceDataAfter) {
    $svc = $serviceDataAfter | ConvertFrom-Json
    if ($svc.status -eq 'no-response') {
        Write-Host "   ✓ Service status changed to 'no-response'" -ForegroundColor Green
        Write-Host "     Updated: $($svc.updatedAt)" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Service status is '$($svc.status)' (expected 'no-response')" -ForegroundColor Red
    }
} else {
    Write-Host "   ✗ Service disappeared from etcd (should be marked as no-response)" -ForegroundColor Red
}

# 7. Check backend logs
Write-Host "`n7. Checking backend logs for no-response detection..." -ForegroundColor Yellow
$logs = docker logs gatrix-backend-dev --tail 100 2>&1 | Select-String -Pattern "no-response|test-no-resp-short|lease expired" | Select-Object -Last 10
if ($logs) {
    Write-Host "   ✓ Found relevant logs:" -ForegroundColor Green
    $logs | ForEach-Object { Write-Host "     $_" -ForegroundColor Gray }
} else {
    Write-Host "   ⚠ No relevant logs found" -ForegroundColor Yellow
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
Write-Host "Expected: Service should be marked as 'no-response' after lease expires" -ForegroundColor Yellow

