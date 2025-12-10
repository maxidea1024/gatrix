$count = 30
$startPort = 10000
$serverSdkPath = "c:\github\admin-templates\gatrix\packages\sdks\server-sdk"

Write-Host "Starting $count idle-server instances with 2 second intervals..."

for ($i = 0; $i -lt $count; $i++) {
    $port = $startPort + $i
    $instanceName = "idle-server-test-$i"
    
    # Set environment variables for the new process
    $env:METRICS_PORT = $port
    $env:INSTANCE_NAME = $instanceName
    
    # Using Start-Process to launch independent processes
    # We use -NoNewWindow to keep them in the same console or hide them, 
    # but for visibility let's use -WindowStyle Hidden or Minimized if we don't want 50 windows.
    # Actually, running them as background jobs might be better for management, 
    # but the user asked to "띄워줘" (launch them).
    
    # Using Start-Process with ts-node
    # Note: We need to pass environment variables. Start-Process -Environment is available in newer PS versions.
    # If not available, we can wrap the command in a script block or cmd /c.
    
    # Simpler approach: Launch 50 detached processes.
    
    $cmdArgs = "run test:servers:idle"
    # Wait, package.json doesn't have test:servers:idle. It has test:servers which runs orchestrator.
    # I should use ts-node directly.
    
    $tsNode = "$serverSdkPath\node_modules\.bin\ts-node.cmd"
    $scriptPath = "$serverSdkPath\test-servers\idle-server.ts"
    
    Write-Host "Launching $instanceName on port $port"
    
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c set METRICS_PORT=$port && set INSTANCE_NAME=$instanceName && $tsNode --transpile-only $scriptPath" -WindowStyle Minimized
    
    Start-Sleep -Seconds 2
}

Write-Host "All servers launched."
