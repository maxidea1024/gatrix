# Test etcd no-response detection and TTL

Write-Host "`n=== Testing etcd No-Response Detection ===" -ForegroundColor Cyan

# 1. Start idle-server
Write-Host "`n1. Starting idle-server..." -ForegroundColor Yellow
$env:INSTANCE_NAME = "test-no-response"
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

# 7. Wait for terminated TTL (300 seconds)
Write-Host "`n7. Waiting for no-response TTL (300 seconds = 5 minutes)..." -ForegroundColor Yellow
Write-Host "   Checking every 30 seconds..." -ForegroundColor Gray

for ($i = 0; $i -lt 11; $i++) {
    $elapsed = $i * 30
    $remaining = 300 - $elapsed
    
    Write-Host "`n   [$elapsed/300s] Checking service..." -ForegroundColor Cyan
    $currentData = docker exec gatrix-etcd-dev etcdctl get $serviceKey --print-value-only 2>$null
    
    if ($currentData) {
        $svc = $currentData | ConvertFrom-Json
        Write-Host "     ✓ Service still exists: status=$($svc.status)" -ForegroundColor Green
        
        if ($i -lt 10) {
            Write-Host "     Waiting $remaining more seconds..." -ForegroundColor Gray
            Start-Sleep -Seconds 30
        }
    } else {
        Write-Host "     ✗ Service disappeared from etcd!" -ForegroundColor Red
        break
    }
}

# 8. Final check
Write-Host "`n8. Final check after 300 seconds..." -ForegroundColor Yellow
$finalData = docker exec gatrix-etcd-dev etcdctl get $serviceKey --print-value-only 2>$null
if ($finalData) {
    Write-Host "   ✗ Service still exists (should have expired)" -ForegroundColor Red
    $svc = $finalData | ConvertFrom-Json
    Write-Host "     Status: $($svc.status)" -ForegroundColor Gray
} else {
    Write-Host "   ✓ Service expired from etcd (no-response TTL worked)" -ForegroundColor Green
}

# 9. Check backend logs
Write-Host "`n9. Checking backend logs for no-response detection..." -ForegroundColor Yellow
$logs = docker logs gatrix-backend-dev --tail 100 2>&1 | Select-String -Pattern "no-response|test-no-response" | Select-Object -Last 10
if ($logs) {
    Write-Host "   ✓ Found relevant logs:" -ForegroundColor Green
    $logs | ForEach-Object { Write-Host "     $_" -ForegroundColor Gray }
} else {
    Write-Host "   ⚠ No relevant logs found" -ForegroundColor Yellow
}

Write-Host "`n=== Test Summary ===" -ForegroundColor Cyan
Write-Host "Expected behavior:" -ForegroundColor Yellow
Write-Host "  1. Service registers with heartbeat TTL (30s)" -ForegroundColor Gray
Write-Host "  2. Process crashes, heartbeat stops" -ForegroundColor Gray
Write-Host "  3. After 30s, lease expires" -ForegroundColor Gray
Write-Host "  4. Auto-cleanup detects expired lease (within 5s)" -ForegroundColor Gray
Write-Host "  5. Service status changed to 'no-response'" -ForegroundColor Gray
Write-Host "  6. New lease created with terminated TTL (300s)" -ForegroundColor Gray
Write-Host "  7. After 300s, service deleted from etcd" -ForegroundColor Gray

