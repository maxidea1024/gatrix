# Test Redis TTL expiration and keyspace notification

Write-Host "=== Testing Redis Service Discovery TTL Expiration ===" -ForegroundColor Cyan

# Create test service instance
$instanceId = "test-ttl-$(Get-Date -Format 'HHmmss')"
$serviceType = "test"
$metaKey = "services:${serviceType}:meta:${instanceId}"
$statKey = "services:${serviceType}:stat:${instanceId}"

$meta = @{
    instanceId = $instanceId
    labels = @{
        service = $serviceType
        group = "test"
    }
    hostname = "test-host"
    internalAddress = "127.0.0.1"
    externalAddress = "127.0.0.1"
    ports = @{
        tcp = @()
        http = @()
    }
    createdAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
} | ConvertTo-Json -Compress -Depth 10

$stat = @{
    status = "ready"
    stats = @{}
    meta = @{}
    updatedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
} | ConvertTo-Json -Compress -Depth 10

# Escape quotes for Redis CLI
$meta = $meta -replace '"', '\"'
$stat = $stat -replace '"', '\"'

Write-Host "`n1. Creating test service: ${serviceType}:${instanceId}" -ForegroundColor Yellow

# Set meta key (no TTL)
docker exec gatrix-redis-dev redis-cli SET $metaKey "`"$meta`"" | Out-Null

# Set stat key with 10 second TTL
docker exec gatrix-redis-dev redis-cli SET $statKey "`"$stat`"" EX 10 | Out-Null

Write-Host "   ✓ Meta key created (no TTL): $metaKey" -ForegroundColor Green
Write-Host "   ✓ Stat key created (TTL=10s): $statKey" -ForegroundColor Green

# Verify keys exist
Write-Host "`n2. Verifying keys exist..." -ForegroundColor Yellow
$metaExists = docker exec gatrix-redis-dev redis-cli EXISTS $metaKey
$statExists = docker exec gatrix-redis-dev redis-cli EXISTS $statKey
$statTTL = docker exec gatrix-redis-dev redis-cli TTL $statKey

Write-Host "   Meta key exists: $metaExists" -ForegroundColor $(if ($metaExists -eq "1") { "Green" } else { "Red" })
Write-Host "   Stat key exists: $statExists (TTL: ${statTTL}s)" -ForegroundColor $(if ($statExists -eq "1") { "Green" } else { "Red" })

# Wait for TTL expiration
Write-Host "`n3. Waiting for stat key TTL to expire (10 seconds)..." -ForegroundColor Yellow
for ($i = 10; $i -gt 0; $i--) {
    Write-Host "   $i..." -NoNewline
    Start-Sleep -Seconds 1
}
Write-Host " Done!" -ForegroundColor Green

# Check if stat key expired
Write-Host "`n4. Checking if stat key expired..." -ForegroundColor Yellow
$statExistsAfter = docker exec gatrix-redis-dev redis-cli EXISTS $statKey
Write-Host "   Stat key exists: $statExistsAfter" -ForegroundColor $(if ($statExistsAfter -eq "0") { "Green" } else { "Red" })

# Wait a bit more for keyspace notification processing
Write-Host "`n5. Waiting for keyspace notification processing (5 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Check if meta key was deleted by keyspace notification handler
Write-Host "`n6. Checking if meta key was deleted by keyspace notification handler..." -ForegroundColor Yellow
$metaExistsAfter = docker exec gatrix-redis-dev redis-cli EXISTS $metaKey
Write-Host "   Meta key exists: $metaExistsAfter" -ForegroundColor $(if ($metaExistsAfter -eq "0") { "Green" } else { "Red" })

# Check inactive collection
Write-Host "`n7. Checking inactive collection..." -ForegroundColor Yellow
$inactiveCount = docker exec gatrix-redis-dev redis-cli HLEN "services:${serviceType}:inactive"
Write-Host "   Inactive collection count: $inactiveCount" -ForegroundColor $(if ($inactiveCount -gt 0) { "Green" } else { "Yellow" })

if ($inactiveCount -gt 0) {
    $inactiveEntry = docker exec gatrix-redis-dev redis-cli HGET "services:${serviceType}:inactive" $instanceId
    if ($inactiveEntry) {
        $inactiveData = $inactiveEntry | ConvertFrom-Json
        Write-Host "   Status: $($inactiveData.status)" -ForegroundColor Cyan
    }
}

# Check backend logs for keyspace notification
Write-Host "`n8. Checking backend logs for keyspace notification..." -ForegroundColor Yellow
$logs = docker logs gatrix-backend-dev --tail 50 2>&1 | Select-String -Pattern "pmessage.*$statKey|no-response.*$instanceId|terminated.*$instanceId"
if ($logs) {
    Write-Host "   ✓ Found keyspace notification logs:" -ForegroundColor Green
    $logs | ForEach-Object { Write-Host "     $_" -ForegroundColor Gray }
} else {
    Write-Host "   ✗ No keyspace notification logs found" -ForegroundColor Red
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan

# Summary
Write-Host "`nSummary:" -ForegroundColor Yellow
if ($statExistsAfter -eq "0") {
    Write-Host "  ✓ Stat key expired correctly" -ForegroundColor Green
} else {
    Write-Host "  ✗ Stat key did not expire" -ForegroundColor Red
}

if ($metaExistsAfter -eq "0") {
    Write-Host "  ✓ Meta key was deleted by keyspace notification handler" -ForegroundColor Green
} else {
    Write-Host "  ✗ Meta key was NOT deleted (keyspace notification may not be working)" -ForegroundColor Red
}

if ($inactiveCount -gt 0) {
    Write-Host "  ✓ Service was added to inactive collection" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Service was NOT added to inactive collection" -ForegroundColor Yellow
}

