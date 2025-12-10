$count = 30
$startPort = 10030  # Start from port 10030 to avoid conflict with first batch
$serverSdkPath = "c:\github\admin-templates\gatrix\packages\sdks\server-sdk"

Write-Host "Starting $count idle-server instances (batch 2) with 2 second intervals..."

for ($i = 0; $i -lt $count; $i++) {
    $port = $startPort + $i
    $instanceName = "idle-server-test-$($i + 30)"  # Start naming from 30
    
    # Set environment variables for the new process
    $env:METRICS_PORT = $port
    $env:INSTANCE_NAME = $instanceName
    
    $tsNode = "$serverSdkPath\node_modules\.bin\ts-node.cmd"
    $scriptPath = "$serverSdkPath\test-servers\idle-server.ts"
    
    Write-Host "Launching $instanceName on port $port"
    
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c set METRICS_PORT=$port && set INSTANCE_NAME=$instanceName && $tsNode --transpile-only $scriptPath" -WindowStyle Minimized
    
    Start-Sleep -Seconds 2
}

Write-Host "All servers launched."
