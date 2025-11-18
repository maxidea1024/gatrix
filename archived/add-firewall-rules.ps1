# Add Windows Firewall rules for Gatrix services
# Run this script as Administrator

Write-Host "Adding Windows Firewall rules for Gatrix services..." -ForegroundColor Cyan

# Frontend (53000)
try {
    New-NetFirewallRule -DisplayName "Gatrix Frontend (53000)" `
        -Direction Inbound `
        -LocalPort 53000 `
        -Protocol TCP `
        -Action Allow `
        -Profile Any `
        -ErrorAction Stop
    Write-Host "✓ Added rule for Frontend (53000)" -ForegroundColor Green
} catch {
    if ($_.Exception.Message -like "*already exists*") {
        Write-Host "✓ Rule for Frontend (53000) already exists" -ForegroundColor Yellow
    } else {
        Write-Host "✗ Failed to add rule for Frontend (53000): $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Grafana (54000)
try {
    New-NetFirewallRule -DisplayName "Gatrix Grafana (54000)" `
        -Direction Inbound `
        -LocalPort 54000 `
        -Protocol TCP `
        -Action Allow `
        -Profile Any `
        -ErrorAction Stop
    Write-Host "✓ Added rule for Grafana (54000)" -ForegroundColor Green
} catch {
    if ($_.Exception.Message -like "*already exists*") {
        Write-Host "✓ Rule for Grafana (54000) already exists" -ForegroundColor Yellow
    } else {
        Write-Host "✗ Failed to add rule for Grafana (54000): $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Backend (55000)
try {
    New-NetFirewallRule -DisplayName "Gatrix Backend (55000)" `
        -Direction Inbound `
        -LocalPort 55000 `
        -Protocol TCP `
        -Action Allow `
        -Profile Any `
        -ErrorAction Stop
    Write-Host "✓ Added rule for Backend (55000)" -ForegroundColor Green
} catch {
    if ($_.Exception.Message -like "*already exists*") {
        Write-Host "✓ Rule for Backend (55000) already exists" -ForegroundColor Yellow
    } else {
        Write-Host "✗ Failed to add rule for Backend (55000): $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`nFirewall rules configuration completed!" -ForegroundColor Cyan
Write-Host "You can now access Gatrix from other computers on the network." -ForegroundColor Green

