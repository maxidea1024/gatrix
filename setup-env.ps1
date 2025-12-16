<#
.SYNOPSIS
    Gatrix .env Setup Script for Windows PowerShell

.DESCRIPTION
    Automatically generates .env file during initial setup.
    Encryption keys are securely auto-generated, only host address is required as argument.

.PARAMETER HostAddress
    Server host address (localhost, IP, or domain)

.PARAMETER Environment
    Execution environment (development or production, default: development)

.PARAMETER DefaultLanguage
    Default language (ko, en, zh, etc., default: zh)

.PARAMETER AdminPassword
    Admin password (optional, default: admin123)

.PARAMETER Protocol
    Protocol (http or https, default: http for dev, https for prod)

.PARAMETER ServiceDiscoveryMode
    Service Discovery mode (etcd or redis, default: etcd)

.PARAMETER DataRoot
    Root path for Docker volume data (default: ./data/gatrix-storage-root for Windows, /data/gatrix-storage-root for Linux)

.PARAMETER Force
    Force overwrite existing .env file

.PARAMETER NoBackup
    Do not create backup file when overwriting

.EXAMPLE
    .\setup-env.ps1 -HostAddress localhost -Environment development
    .\setup-env.ps1 -HostAddress 192.168.1.100 -Environment production -Force
    .\setup-env.ps1 -HostAddress example.cn -Environment production -DefaultLanguage zh
    .\setup-env.ps1 -HostAddress localhost -Environment development -AdminPassword "MySecurePassword123"
    .\setup-env.ps1 -HostAddress localhost -Environment development -Force -NoBackup
    .\setup-env.ps1 -HostAddress localhost -Environment development -Protocol https
    .\setup-env.ps1 -HostAddress localhost -Environment development -ServiceDiscoveryMode redis
    .\setup-env.ps1 -HostAddress example.com -Environment production -DataRoot /data/gatrix

.NOTES
    Requires Windows PowerShell 5.0 or higher
#>

param(
    [Parameter(Mandatory = $true, HelpMessage = "Host address (localhost, IP, or domain)")]
    [string]$HostAddress,

    [Parameter(Mandatory = $false, HelpMessage = "Environment (development or production)")]
    [ValidateSet("development", "production")]
    [string]$Environment = "development",

    [Parameter(Mandatory = $false, HelpMessage = "Default language (ko, en, zh, etc.)")]
    [string]$DefaultLanguage = "zh",

    [Parameter(Mandatory = $false, HelpMessage = "Admin password (default: admin123)")]
    [string]$AdminPassword = "admin123",

    [Parameter(Mandatory = $false, HelpMessage = "Protocol (http or https, default: http for dev, https for prod)")]
    [ValidateSet("http", "https")]
    [string]$Protocol = "",

    [Parameter(Mandatory = $false, HelpMessage = "Service Discovery mode (etcd or redis, default: etcd)")]
    [ValidateSet("etcd", "redis")]
    [string]$ServiceDiscoveryMode = "etcd",

    [Parameter(Mandatory = $false, HelpMessage = "Root path for Docker volume data (default: ./data for dev, /data/gatrix for prod)")]
    [string]$DataRoot = "",

    [Parameter(Mandatory = $false, HelpMessage = "Force overwrite existing .env file")]
    [switch]$Force,

    [Parameter(Mandatory = $false, HelpMessage = "Do not create backup file when overwriting")]
    [switch]$NoBackup
)

# Set UTF-8 encoding for proper emoji and special character display
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Error handling
$ErrorActionPreference = "Stop"

# Script directory - handle both root and scripts folder execution
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ((Split-Path -Leaf $ScriptDir) -eq "scripts") {
    $ProjectRoot = Split-Path -Parent $ScriptDir
}
else {
    $ProjectRoot = $ScriptDir
}
$EnvFile = Join-Path $ProjectRoot ".env"
$EnvExample = Join-Path $ProjectRoot ".env.example"

################################################################################
# Functions
################################################################################

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

# Validate inputs
function Validate-Inputs {
    if ([string]::IsNullOrWhiteSpace($HostAddress)) {
        Write-Error-Custom "Host address is required."
        Write-Host ""
        Write-Host "Usage: .\scripts\setup-env.ps1 -HostAddress [HOST] -Environment [ENVIRONMENT]"
        Write-Host ""
        Write-Host "Examples:"
        Write-Host "  .\scripts\setup-env.ps1 -HostAddress localhost -Environment development"
        Write-Host "  .\scripts\setup-env.ps1 -HostAddress 192.168.1.100 -Environment production"
        Write-Host "  .\scripts\setup-env.ps1 -HostAddress example.com -Environment production"
        exit 1
    }

    if (-not (Test-Path $EnvExample)) {
        Write-Error-Custom ".env.example file not found: $EnvExample"
        exit 1
    }
}

# Generate random string using .NET
function Generate-RandomString {
    param([int]$Length)
    $bytes = New-Object byte[] $Length
    $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    return [Convert]::ToBase64String($bytes)
}

# Generate JWT Secret (32 characters)
function Generate-JwtSecret {
    $secret = Generate-RandomString -Length 24
    return $secret.Substring(0, [Math]::Min(32, $secret.Length))
}

# Generate Session Secret (20 characters)
function Generate-SessionSecret {
    $secret = Generate-RandomString -Length 15
    return $secret.Substring(0, [Math]::Min(20, $secret.Length))
}

# Generate JWT Refresh Secret (32 characters)
function Generate-JwtRefreshSecret {
    $secret = Generate-RandomString -Length 24
    return $secret.Substring(0, [Math]::Min(32, $secret.Length))
}

# Check if .env file exists and handle accordingly
function Check-ExistingEnv {
    if (Test-Path $EnvFile) {
        if (-not $Force) {
            Write-Host ""
            Write-Error-Custom ".env file already exists!"
            Write-Host ""
            Write-Host "To overwrite the existing .env file, use the -Force flag:"
            Write-Host "  .\setup-env.ps1 -HostAddress $HostAddress -Environment $Environment -Force"
            Write-Host ""
            exit 1
        }

        # Backup existing file before overwriting (unless -NoBackup is specified)
        if (-not $NoBackup) {
            $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
            $backupFile = "$ProjectRoot\.env.backup.$timestamp"
            Copy-Item $EnvFile $backupFile
            Write-Warning-Custom "Existing .env file backed up: $backupFile"
            return $backupFile
        }
        else {
            Write-Info "Skipping backup (-NoBackup flag used)"
            return $null
        }
    }
    return $null
}

# Create .env file
function Create-EnvFile {
    Write-Info "Generating .env file..."

    # Generate secrets
    $jwtSecret = Generate-JwtSecret
    $sessionSecret = Generate-SessionSecret
    $jwtRefreshSecret = Generate-JwtRefreshSecret

    # Copy .env.example to .env
    Copy-Item $EnvExample $EnvFile -Force

    # Read the file content line by line
    $lines = @(Get-Content $EnvFile)
    $newLines = @()

    foreach ($line in $lines) {
        if ($line -match "^NODE_ENV=") {
            $newLines += "NODE_ENV=$Environment"
        }
        elseif ($line -match "^DB_HOST=") {
            $newLines += "DB_HOST=mysql"
        }
        elseif ($line -match "^DB_PORT=") {
            $newLines += "DB_PORT=3306"
        }
        elseif ($line -match "^DB_NAME=") {
            $newLines += "DB_NAME=gatrix"
        }
        elseif ($line -match "^DB_USER=") {
            $newLines += "DB_USER=gatrix_user"
        }
        elseif ($line -match "^DB_PASSWORD=") {
            $newLines += "DB_PASSWORD=gatrix_password"
        }
        elseif ($line -match "^REDIS_HOST=") {
            $newLines += "REDIS_HOST=redis"
        }
        elseif ($line -match "^REDIS_PORT=") {
            # REDIS_PORT is the internal Docker port (6379), not the host port
            # Host port is configured separately in docker-compose.yml via REDIS_HOST_PORT
            $newLines += "REDIS_PORT=6379"
        }
        elseif ($line -match "^CORS_ORIGIN=") {
            # In production with standard ports (80/443), omit port number
            # In development, include port number and use HOST address (not localhost)
            if ($Environment -eq "development") {
                $newLines += "CORS_ORIGIN=$($script:ProtocolToUse)://$HostAddress`:43000"
            }
            else {
                $newLines += "CORS_ORIGIN=$($script:ProtocolToUse)://$HostAddress`:43000"
            }
        }
        elseif ($line -match "^FRONTEND_URL=") {
            # In production with standard ports (80/443), omit port number
            # In development, include port number and use HOST address (not localhost)
            if ($Environment -eq "development") {
                $newLines += "FRONTEND_URL=$($script:ProtocolToUse)://$HostAddress`:43000"
            }
            else {
                $newLines += "FRONTEND_URL=$($script:ProtocolToUse)://$HostAddress`:43000"
            }
        }
        elseif ($line -match "^CHAT_SERVER_URL=") {
            $newLines += "CHAT_SERVER_URL=http://chat-server:5100"
        }
        elseif ($line -match "^LOG_LEVEL=") {
            if ($Environment -eq "development") {
                $newLines += "LOG_LEVEL=debug"
            }
            else {
                $newLines += "LOG_LEVEL=info"
            }
        }
        elseif ($line -match "^JWT_SECRET=") {
            $newLines += "JWT_SECRET=$jwtSecret"
        }
        elseif ($line -match "^SESSION_SECRET=") {
            $newLines += "SESSION_SECRET=$sessionSecret"
        }
        elseif ($line -match "^JWT_REFRESH_SECRET=") {
            $newLines += "JWT_REFRESH_SECRET=$jwtRefreshSecret"
        }
        elseif ($line -match "^VITE_DEFAULT_LANGUAGE=") {
            $newLines += "VITE_DEFAULT_LANGUAGE=$DefaultLanguage"
        }
        elseif ($line -match "^DEFAULT_LANGUAGE=") {
            $newLines += "DEFAULT_LANGUAGE=$DefaultLanguage"
        }
        elseif ($line -match "^VITE_GRAFANA_URL=") {
            if ($Environment -eq "development") {
                # Development: include port number, use HOST address (not localhost)
                $newLines += "VITE_GRAFANA_URL=$($script:ProtocolToUse)://$HostAddress`:44000"
            }
            else {
                # Production: Grafana accessed via /grafana subpath (handled by load balancer)
                $newLines += "VITE_GRAFANA_URL=$($script:ProtocolToUse)://$HostAddress`:44000"
            }
        }
        elseif ($line -match "^VITE_BULL_BOARD_URL=") {
            if ($Environment -eq "development") {
                # Development: include port number, use HOST address (not localhost)
                $newLines += "VITE_BULL_BOARD_URL=$($script:ProtocolToUse)://$HostAddress`:43000/bull-board"
            }
            else {
                # Production: Bull Board accessed via /bull-board subpath
                $newLines += "VITE_BULL_BOARD_URL=$($script:ProtocolToUse)://$HostAddress`:43000/bull-board"
            }
        }
        elseif ($line -match "^VITE_EDGE_URL=") {
            # Edge server URL (for game client webview pages)
            $newLines += "VITE_EDGE_URL=$($script:ProtocolToUse)://$HostAddress`:3400"
        }
        elseif ($line -match "^EDGE_FORCE_HTTPS=") {
            # Set Edge HTTPS enforcement based on protocol
            if ($script:ProtocolToUse -eq "https") {
                $newLines += "EDGE_FORCE_HTTPS=true"
            } else {
                $newLines += "EDGE_FORCE_HTTPS=false"
            }
        }
        elseif ($line -match "^ADMIN_PASSWORD=") {
            $newLines += "ADMIN_PASSWORD=$AdminPassword"
        }
        elseif ($line -match "^SERVICE_DISCOVERY_MODE=") {
            $newLines += "SERVICE_DISCOVERY_MODE=$ServiceDiscoveryMode"
        }
        elseif ($line -match "^DATA_ROOT=") {
            $newLines += "DATA_ROOT=$($script:DataRootToUse)"
        }
        else {
            $newLines += $line
        }
    }

    # Write the file
    Set-Content $EnvFile $newLines -Encoding UTF8

    Write-Success ".env file generated successfully."
}

# Print summary
function Print-Summary {
    param([string]$BackupFile)

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "[OK] .env file generated successfully!" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "[CONFIGURATION]" -ForegroundColor Cyan
    Write-Host "  - HOST: $HostAddress"
    Write-Host "  - PROTOCOL: $($script:ProtocolToUse)"
    Write-Host "  - ENVIRONMENT: $Environment"
    Write-Host "  - NODE_ENV: $Environment"
    Write-Host "  - DEFAULT_LANGUAGE: $DefaultLanguage"
    Write-Host "  - ADMIN_PASSWORD: $AdminPassword"
    Write-Host "  - SERVICE_DISCOVERY_MODE: $ServiceDiscoveryMode"
    Write-Host "  - DATA_ROOT: $($script:DataRootToUse)"
    Write-Host "  - JWT_SECRET: [auto-generated] (32 chars)"
    Write-Host "  - SESSION_SECRET: [auto-generated] (20 chars)"
    Write-Host "  - JWT_REFRESH_SECRET: [auto-generated] (32 chars)"
    Write-Host "  - DB_HOST: mysql"
    Write-Host "  - DB_NAME: gatrix"
    Write-Host "  - DB_USER: gatrix_user"
    Write-Host "  - REDIS_HOST: redis"
    Write-Host "  - EDGE_URL: $($script:ProtocolToUse)://$HostAddress`:3400"
    Write-Host ""
    Write-Host "[FILE LOCATIONS]" -ForegroundColor Cyan
    Write-Host "  - .env: $EnvFile"
    if ($BackupFile) {
        Write-Host "  - Backup: $BackupFile"
    }
    Write-Host ""
    Write-Host "[IMPORTANT] Update these values for your environment:" -ForegroundColor Yellow
    Write-Host "  - GOOGLE_CLIENT_ID"
    Write-Host "  - GOOGLE_CLIENT_SECRET"
    Write-Host "  - GITHUB_CLIENT_ID"
    Write-Host "  - GITHUB_CLIENT_SECRET"
    Write-Host ""
    Write-Host "[NEXT STEPS]" -ForegroundColor Cyan
    Write-Host "  1. Review and update the .env file with your settings"

    if ($Environment -eq "development") {
        Write-Host "  2. Start Docker services: docker-compose -f docker-compose.dev.yml up -d"
        Write-Host "  3. Access the application: $($script:ProtocolToUse)://$HostAddress`:43000"
    }
    else {
        Write-Host "  2. Start Docker services: docker-compose -f docker-compose.yml up -d"
        Write-Host "  3. Access the application: $($script:ProtocolToUse)://$HostAddress"
        Write-Host "  4. Configure your load balancer to forward:"
        Write-Host "     - HTTPS 443 -> 43000 (Frontend)"
        Write-Host "     - HTTPS 443/grafana -> 44000 (Grafana, optional)"
    }
    Write-Host ""
}

################################################################################
# Main
################################################################################

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Gatrix .env Auto-Generation Script" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Set default protocol based on environment if not specified
if ([string]::IsNullOrWhiteSpace($Protocol)) {
    if ($Environment -eq "development") {
        $script:ProtocolToUse = "http"
    }
    else {
        $script:ProtocolToUse = "https"
    }
}
else {
    $script:ProtocolToUse = $Protocol
}

# Set default data root based on environment if not specified
if ([string]::IsNullOrWhiteSpace($DataRoot)) {
    # Windows environment: always use relative path to avoid permission issues
    $script:DataRootToUse = "./data/gatrix-storage-root"
}
else {
    $script:DataRootToUse = $DataRoot
}

Validate-Inputs
$backupFile = Check-ExistingEnv
Create-EnvFile
Print-Summary -BackupFile $backupFile

