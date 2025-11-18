# Test etcd terminated service TTL behavior (graceful shutdown)

Write-Host "`n=== Testing etcd Terminated Service TTL (Graceful Shutdown) ===" -ForegroundColor Cyan

# Start an idle-server
Write-Host "`n1. Starting idle-server..." -ForegroundColor Yellow
$env:INSTANCE_NAME = "test-terminated-ttl"
$env:REDIS_HOST = "localhost"
$env:REDIS_PORT = "6379"
$env:GATRIX_URL = "http://localhost:55000"
$env:API_TOKEN = "gatrix-unsecured-server-api-token"

$serverProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd packages/sdks/server-sdk; npx ts-node test-servers/idle-server.ts" -PassThru -WindowStyle Minimized
Write-Host "   Server started with PID: $($serverProcess.Id)" -ForegroundColor Green

# Wait for registration
Write-Host "`n2. Waiting for service registration (10 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check if service is registered in etcd
Write-Host "`n3. Checking service registration in etcd..." -ForegroundColor Yellow
$etcdKeys = docker exec gatrix-etcd-dev etcdctl get --prefix "/services/idle" --keys-only
if ($etcdKeys) {
    Write-Host "   ✓ Service registered in etcd:" -ForegroundColor Green
    $etcdKeys -split "`n" | ForEach-Object { Write-Host "     $_" -ForegroundColor Gray }
} else {
    Write-Host "   ✗ Service NOT registered in etcd" -ForegroundColor Red
    Stop-Process -Id $serverProcess.Id -Force
    exit 1
}

# Get service details
$serviceKey = ($etcdKeys -split "`n")[0]
$serviceData = docker exec gatrix-etcd-dev etcdctl get $serviceKey --print-value-only | ConvertFrom-Json
Write-Host "`n   Service details:" -ForegroundColor Cyan
Write-Host "     Instance ID: $($serviceData.instanceId)" -ForegroundColor Gray
Write-Host "     Status: $($serviceData.status)" -ForegroundColor Gray
Write-Host "     Created: $($serviceData.createdAt)" -ForegroundColor Gray

# Send Ctrl+C to gracefully shutdown (this will trigger unregister)
Write-Host "`n4. Sending Ctrl+C to idle-server for graceful shutdown..." -ForegroundColor Yellow
# Find the PowerShell window and send Ctrl+C
Add-Type @"
    using System;
    using System.Runtime.InteropServices;
    public class Win32 {
        [DllImport("kernel32.dll", SetLastError=true)]
        public static extern bool GenerateConsoleCtrlEvent(uint dwCtrlEvent, uint dwProcessGroupId);
        [DllImport("kernel32.dll", SetLastError=true)]
        public static extern bool AttachConsole(uint dwProcessId);
        [DllImport("kernel32.dll", SetLastError=true)]
        public static extern bool FreeConsole();
        [DllImport("kernel32.dll", SetLastError=true)]
        public static extern bool SetConsoleCtrlHandler(IntPtr HandlerRoutine, bool Add);
    }
"@

# Try to send Ctrl+C
try {
    [Win32]::AttachConsole($serverProcess.Id)
    [Win32]::SetConsoleCtrlHandler([IntPtr]::Zero, $true)
    [Win32]::GenerateConsoleCtrlEvent(0, 0)
    Start-Sleep -Milliseconds 500
    [Win32]::FreeConsole()
    [Win32]::SetConsoleCtrlHandler([IntPtr]::Zero, $false)
    Write-Host "   ✓ Ctrl+C sent" -ForegroundColor Green
} catch {
    Write-Host "   ⚠ Failed to send Ctrl+C, killing process instead" -ForegroundColor Yellow
    Stop-Process -Id $serverProcess.Id -Force
}

# Wait a bit for graceful shutdown
Start-Sleep -Seconds 3

# Check if service status changed to 'terminated'
Write-Host "`n5. Checking if service status changed to 'terminated'..." -ForegroundColor Yellow
$serviceDataAfter = docker exec gatrix-etcd-dev etcdctl get $serviceKey --print-value-only | ConvertFrom-Json
if ($serviceDataAfter) {
    Write-Host "   Service status: $($serviceDataAfter.status)" -ForegroundColor $(if ($serviceDataAfter.status -eq 'terminated') { 'Green' } else { 'Yellow' })
    Write-Host "   Updated: $($serviceDataAfter.updatedAt)" -ForegroundColor Gray
} else {
    Write-Host "   ✗ Service not found in etcd" -ForegroundColor Red
}

# Wait for terminated TTL (300 seconds = 5 minutes)
Write-Host "`n6. Waiting for terminated TTL (300 seconds = 5 minutes)..." -ForegroundColor Yellow
Write-Host "   This will take a while. Checking every 30 seconds..." -ForegroundColor Gray

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

# Final check
Write-Host "`n7. Final check after 300 seconds..." -ForegroundColor Yellow
$finalData = docker exec gatrix-etcd-dev etcdctl get $serviceKey --print-value-only 2>$null
if ($finalData) {
    Write-Host "   ✗ Service still exists (should have expired)" -ForegroundColor Red
    $svc = $finalData | ConvertFrom-Json
    Write-Host "     Status: $($svc.status)" -ForegroundColor Gray
} else {
    Write-Host "   ✓ Service expired from etcd (terminated TTL worked)" -ForegroundColor Green
}

Write-Host "`n=== Test Summary ===" -ForegroundColor Cyan
Write-Host "Expected behavior:" -ForegroundColor Yellow
Write-Host "  1. Service registers in etcd with heartbeat TTL (30s)" -ForegroundColor Gray
Write-Host "  2. On graceful shutdown, unregister() is called" -ForegroundColor Gray
Write-Host "  3. Service status changes to 'terminated'" -ForegroundColor Gray
Write-Host "  4. New lease created with terminated TTL (300s)" -ForegroundColor Gray
Write-Host "  5. After 300s, service is deleted from etcd" -ForegroundColor Gray

