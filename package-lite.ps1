#!/usr/bin/env pwsh
#
# Gatrix Deploy Package Script
#
# Creates a tgz package containing all files needed for deployment.
#
# Usage:
#   ./package-lite.ps1 [options]
#
# Options:
#   -o, --output <file>       Output file name (default: gatrix-deploy-YYYYMMDD.tgz)
#   -h, --help                Show help

$ErrorActionPreference = "Stop"

# Default values
$DateSuffix = Get-Date -Format "yyyyMMdd-HHmm"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = $ScriptDir
$ArtifactsDir = Join-Path $RootDir "artifacts"
$OutputFile = Join-Path $ArtifactsDir "gatrix-deploy-$DateSuffix.tgz"

function Show-Help {
    Write-Host "Gatrix Deploy Package Script"
    Write-Host ""
    Write-Host "Usage: ./package-lite.ps1 [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -o, --output <file>       Output file name (default: gatrix-deploy-YYYYMMDD.tgz)"
    Write-Host "  -h, --help                Show help"
    Write-Host ""
    Write-Host "Included files:"
    Write-Host "  - deploy/*                Deploy scripts"
    Write-Host "  - docker-compose.lite.yml Lite compose file"
    Write-Host "  - .env*.example           Environment templates"
    Write-Host "  - setup-env.*             Environment setup scripts"
    Write-Host "  - update-lite.*           Lite update scripts"
    exit 0
}

# Parse arguments
$i = 0
while ($i -lt $args.Count) {
    switch ($args[$i]) {
        { $_ -eq "-o" -or $_ -eq "--output" } {
            $OutputFile = $args[$i + 1]
            $i += 2
        }
        { $_ -eq "-h" -or $_ -eq "--help" } {
            Show-Help
        }
        default {
            Write-Host "Unknown option: $($args[$i])" -ForegroundColor Red
            exit 1
        }
    }
}

Write-Host "========================================"
Write-Host "   Gatrix Deploy Package"
Write-Host "========================================"
Write-Host ""

Push-Location $RootDir
try {
    # Create temp directory
    $TempDir = Join-Path $env:TEMP "gatrix-package-$(Get-Random)"
    $PackageDir = Join-Path $TempDir "gatrix-deploy"
    New-Item -ItemType Directory -Path $PackageDir -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $PackageDir "deploy") -Force | Out-Null

    Write-Host "[INFO] Collecting files..." -ForegroundColor Blue

    # Copy deploy folder scripts
    Get-ChildItem -Path "deploy" -Filter "*.sh" | ForEach-Object {
        Copy-Item $_.FullName -Destination (Join-Path $PackageDir "deploy")
        Write-Host "  + deploy/$($_.Name)" -ForegroundColor Gray
    }
    Get-ChildItem -Path "deploy" -Filter "*.ps1" | ForEach-Object {
        Copy-Item $_.FullName -Destination (Join-Path $PackageDir "deploy")
        Write-Host "  + deploy/$($_.Name)" -ForegroundColor Gray
    }
    Get-ChildItem -Path "deploy" -Filter "README*.md" | ForEach-Object {
        Copy-Item $_.FullName -Destination (Join-Path $PackageDir "deploy")
        Write-Host "  + deploy/$($_.Name)" -ForegroundColor Gray
    }
    if (Test-Path "deploy/.env.example") {
        Copy-Item "deploy/.env.example" -Destination (Join-Path $PackageDir "deploy")
        Write-Host "  + deploy/.env.example" -ForegroundColor Gray
    }

    # Copy docker-compose.lite.yml
    if (Test-Path "docker-compose.lite.yml") {
        Copy-Item "docker-compose.lite.yml" -Destination $PackageDir
        Write-Host "  + docker-compose.lite.yml" -ForegroundColor Gray
    }

    # Copy .env examples from root
    Get-ChildItem -Path "." -Filter ".env*.example" | ForEach-Object {
        Copy-Item $_.FullName -Destination $PackageDir
        Write-Host "  + $($_.Name)" -ForegroundColor Gray
    }

    # Copy setup-env scripts
    Get-ChildItem -Path "." -Filter "setup-env*" | ForEach-Object {
        Copy-Item $_.FullName -Destination $PackageDir
        Write-Host "  + $($_.Name)" -ForegroundColor Gray
    }

    # Copy update-lite scripts
    Get-ChildItem -Path "." -Filter "update-lite*" | ForEach-Object {
        Copy-Item $_.FullName -Destination $PackageDir
        Write-Host "  + $($_.Name)" -ForegroundColor Gray
    }

    # Copy QUICKSTART docs
    Get-ChildItem -Path "." -Filter "QUICKSTART*.md" | ForEach-Object {
        Copy-Item $_.FullName -Destination $PackageDir
        Write-Host "  + $($_.Name)" -ForegroundColor Gray
    }

    # Create the package using tar
    New-Item -ItemType Directory -Path $ArtifactsDir -Force | Out-Null
    Write-Host "[INFO] Creating package: $OutputFile" -ForegroundColor Blue
    Push-Location $TempDir
    try {
        tar -czf $OutputFile "gatrix-deploy"
    }
    finally {
        Pop-Location
    }

    Write-Host ""
    Write-Host "[SUCCESS] Package created: $OutputFile" -ForegroundColor Green
    Write-Host ""
    Write-Host "[INFO] Package contents:" -ForegroundColor Blue
    tar -tzf $OutputFile | Select-Object -First 20
    Write-Host "..."

    # Deploy to game/gatrix folder
    $GameGatrixDir = Join-Path $RootDir "..\game\gatrix"
    $GameDir = Join-Path $RootDir "..\game"
    if (Test-Path $GameDir) {
        Write-Host ""
        Write-Host "[INFO] Deploying to $GameGatrixDir..." -ForegroundColor Blue
        
        # Clean existing folder
        if (Test-Path $GameGatrixDir) {
            Remove-Item -Recurse -Force $GameGatrixDir
        }
        New-Item -ItemType Directory -Path $GameGatrixDir -Force | Out-Null
        
        # Copy package contents
        Copy-Item -Recurse -Path (Join-Path $PackageDir "*") -Destination $GameGatrixDir
        
        Write-Host "[SUCCESS] Deployed to $GameGatrixDir" -ForegroundColor Green
    }

    # Cleanup temp
    Remove-Item -Recurse -Force $TempDir

    Write-Host ""
    Write-Host "[INFO] To extract manually: tar -xzf $OutputFile" -ForegroundColor Blue
}
finally {
    Pop-Location
}
