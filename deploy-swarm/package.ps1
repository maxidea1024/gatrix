#!/usr/bin/env pwsh
#
# Gatrix Deploy-Swarm Packaging Script
# Packages the deploy-swarm directory into a timestamped .tgz archive
# for transfer to publisher/system administrator.
#
# Usage:
#   ./package.ps1 [options]
#
# Options:
#   -o, --output <dir>        Output directory (default: current directory)
#   -h, --help                Show help
#
# Output format: gatrix-swarm-YYYYMMDD-HHMMSS.tgz

$ErrorActionPreference = "Stop"

$OutputDir = Join-Path $PSScriptRoot "dist"

$i = 0
while ($i -lt $args.Count) {
    switch ($args[$i]) {
        { $_ -eq "-o" -or $_ -eq "--output" } { $OutputDir = $args[$i + 1]; $i += 2 }
        { $_ -eq "-h" -or $_ -eq "--help" } {
            Write-Host "Gatrix Deploy-Swarm Packaging Script"
            Write-Host ""
            Write-Host "Usage: ./package.ps1 [options]"
            Write-Host ""
            Write-Host "Options:"
            Write-Host "  -o, --output <dir>        Output directory (default: current directory)"
            Write-Host "  -h, --help                Show help"
            Write-Host ""
            Write-Host "Creates a timestamped .tgz archive of the deploy-swarm directory."
            Write-Host "Output directory: ./dist/ (override with -o)"
            Write-Host "Output format: gatrix-swarm-YYYYMMDD-HHMMSS.tgz"
            exit 0
        }
        default { Write-Host "Unknown option: $($args[$i])" -ForegroundColor Red; exit 1 }
    }
}

$Timestamp = (Get-Date).ToString("yyyyMMdd-HHmmss")
$ArchiveName = "gatrix-swarm-${Timestamp}.tgz"
$ArchivePath = Join-Path $OutputDir $ArchiveName

Write-Host "========================================" -ForegroundColor Blue
Write-Host "   Gatrix Deploy-Swarm Packaging" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

# Files/directories to include
$IncludeFiles = @(
    "docker-compose.swarm.yml"
    ".env.example"
    "config"
    "deploy.sh"
    "deploy.ps1"
    "login-registry.sh"
    "login-registry.ps1"
    "update.sh"
    "update.ps1"
    "rollback.sh"
    "rollback.ps1"
    "scale.sh"
    "scale.ps1"
    "status.sh"
    "status.ps1"
    "list-images.sh"
    "list-images.ps1"
    "teardown.sh"
    "teardown.ps1"
    "health-check.sh"
    "health-check.ps1"
    "generate-secrets.sh"
    "generate-secrets.ps1"
    "package-deploy.js"
    "README.md"
    "README.en.md"
    "README.zh.md"
    ".gitignore"
)

# Collect existing files
$existing = @()
Write-Host "Including files:"
foreach ($item in $IncludeFiles) {
    $fullPath = Join-Path $PSScriptRoot $item
    if (Test-Path $fullPath) {
        $existing += $item
        if (Test-Path $fullPath -PathType Container) {
            Write-Host "  [+] $item (dir)" -ForegroundColor Green
        }
        else {
            $size = [math]::Round((Get-Item $fullPath).Length / 1KB, 1)
            Write-Host "  [+] $item (${size}KB)" -ForegroundColor Green
        }
    }
    else {
        Write-Host "  [-] $item (not found, skipping)"
    }
}

Write-Host ""
Write-Host "Excluded:"
Write-Host "  [-] .env (contains secrets)"
Write-Host "  [-] registry.env (contains registry credentials - create manually)"
Write-Host "  [-] .build-history.json (local build history)"
Write-Host "  [-] *.tgz (previous archives)"
Write-Host ""

# Ensure output directory exists
if (-not (Test-Path $OutputDir)) { New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null }

# Create archive using tar
Push-Location $PSScriptRoot
try {
    $tarArgs = @("-czf", $ArchivePath) + $existing
    & tar @tarArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Host "tar failed with exit code $LASTEXITCODE" -ForegroundColor Red
        exit 1
    }
}
finally {
    Pop-Location
}

$archiveSize = [math]::Round((Get-Item $ArchivePath).Length / 1KB, 1)

Write-Host "========================================" -ForegroundColor Green
Write-Host "   Archive Created" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  File: $ArchiveName"
Write-Host "  Size: ${archiveSize}KB"
Write-Host "  Path: $ArchivePath"
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "To deploy on target server:"
Write-Host "  1. Copy $ArchiveName to server"
Write-Host "  2. tar -xzf $ArchiveName"
Write-Host "  3. cp .env.example .env"
Write-Host "  4. vi .env  # Configure Cloud DB/Redis"
Write-Host "  5. Create registry.env with your Docker registry credentials"
Write-Host "  6. ./generate-secrets.ps1 --env  # Generate security keys"
Write-Host "  7. ./deploy.ps1 -v latest -i"
