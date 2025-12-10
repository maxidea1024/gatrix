$processes = Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -like "*idle-server.ts*" }
$count = $processes.Count

if ($count -gt 0) {
    Write-Host "Found $count idle-server processes. Stopping..."
    foreach ($proc in $processes) {
        try {
            Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
            Write-Host "Stopped process $($proc.ProcessId)"
        } catch {
            Write-Host "Failed to stop process $($proc.ProcessId): $_"
        }
    }
    Write-Host "Cleanup complete."
} else {
    Write-Host "No idle-server processes found."
}
