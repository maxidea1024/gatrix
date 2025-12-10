$processes = Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -like "*idle-server.ts*" }
$count = $processes.Count

if ($count -gt 0) {
    Write-Host "Found $count idle-server processes. Stopping sequentially with 2 second intervals..."
    $index = 0
    foreach ($proc in $processes) {
        try {
            Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
            $index++
            Write-Host "[$index/$count] Stopped process $($proc.ProcessId)"
            
            # Wait 2 seconds before killing next server (except for the last one)
            if ($index -lt $count) {
                Start-Sleep -Seconds 2
            }
        }
        catch {
            Write-Host "Failed to stop process $($proc.ProcessId): $_"
        }
    }
    Write-Host "Cleanup complete."
}
else {
    Write-Host "No idle-server processes found."
}
