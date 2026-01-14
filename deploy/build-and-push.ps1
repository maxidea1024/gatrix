#!/usr/bin/env pwsh
#
# Gatrix Build and Push Script
#
# Usage:
#   ./build-and-push.ps1 [options]
#
# Options:
#   -t, --tag <tag>           Image tag (default: latest)
#   -p, --push                Push images to registry
#   -l, --latest              Also tag and push as "latest"
#   -s, --service <name>      Service to build (can be used multiple times)
#   -h, --help                Show help

$ErrorActionPreference = "Stop"

# Default values
$Tag = "latest"
$Push = $false
$TagLatest = $false
$TargetServices = @()

# Show help function
function Show-Help {
    Write-Host "Gatrix Build and Push Script"
    Write-Host ""
    Write-Host "Usage: ./build-and-push.ps1 [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -t, --tag <tag>           Image tag (default: latest)"
    Write-Host "  -p, --push                Push images to registry"
    Write-Host "  -l, --latest              Also tag and push as 'latest'"
    Write-Host "  -s, --service <name>      Service to build (repeatable)"
    Write-Host "  -h, --help                Show help"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  ./build-and-push.ps1 -t v1.0.0 -l -p"
    Write-Host "  ./build-and-push.ps1 --tag v1.0.0 --latest --push"
    Write-Host "  ./build-and-push.ps1 --service backend --service frontend --push"
    exit 0
}

# Parse arguments
$i = 0
while ($i -lt $args.Count) {
    switch ($args[$i]) {
        { $_ -eq "-t" -or $_ -eq "--tag" } {
            $Tag = $args[$i + 1]
            $i += 2
        }
        { $_ -eq "-p" -or $_ -eq "--push" } {
            $Push = $true
            $i += 1
        }
        { $_ -eq "-l" -or $_ -eq "--latest" } {
            $TagLatest = $true
            $i += 1
        }
        { $_ -eq "-s" -or $_ -eq "--service" } {
            $TargetServices += $args[$i + 1]
            $i += 2
        }
        { $_ -eq "-h" -or $_ -eq "--help" } {
            Show-Help
        }
        default {
            Write-Host "Unknown option: $($args[$i])" -ForegroundColor Red
            Write-Host "Use --help for usage information"
            exit 1
        }
    }
}

# Configuration
$Registry = "uwocn.tencentcloudcr.com"
$Namespace = "uwocn"

# Define available services
# Service Name -> Dockerfile path (relative to root)
$allServices = @{
    "backend"     = "packages/backend/Dockerfile"
    "frontend"    = "packages/frontend/Dockerfile"
    "edge"        = "packages/edge/Dockerfile"
    "chat-server" = "packages/chat-server/Dockerfile"
    "event-lens"  = "packages/event-lens/Dockerfile"
}

# Determine services to build
$servicesToBuild = @{}

if ($TargetServices.Count -gt 0) {
    foreach ($svcName in $TargetServices) {
        if ($allServices.ContainsKey($svcName)) {
            $servicesToBuild[$svcName] = $allServices[$svcName]
        }
        else {
            Write-Warning "Service '$svcName' not found. Available services: $($allServices.Keys -join ', ')"
        }
    }
    if ($servicesToBuild.Count -eq 0) {
        throw "No valid services specified to build."
    }
}
else {
    $servicesToBuild = $allServices
}

# Root directory of the project (parent of 'deploy')
$rootDir = Resolve-Path "$PSScriptRoot\.."
$loginScript = Join-Path $PSScriptRoot "login-registry.ps1"

Write-Host "Gatrix Build & Push" -ForegroundColor Cyan
Write-Host "Root Directory: $rootDir"
Write-Host "Tag: $Tag"
Write-Host "Registry: $Registry/$Namespace/gatrix-<service>:<tag>"
Write-Host "Services: $($servicesToBuild.Keys -join ', ')"

# Login if pushing
if ($Push) {
    if (Test-Path $loginScript) {
        Write-Host "Calling registry login script..." -ForegroundColor Yellow
        & $loginScript
        if ($LASTEXITCODE -ne 0) { throw "Login failed" }
    }
    else {
        Write-Warning "Login script not found at $loginScript. Assuming already logged in."
    }
}

foreach ($serviceName in $servicesToBuild.Keys) {
    $dockerfile = $servicesToBuild[$serviceName]
    
    $imageName = "$Registry/$Namespace/gatrix-$serviceName`:$Tag"
    $latestImageName = "$Registry/$Namespace/gatrix-$serviceName`:latest"

    Write-Host "`n[$serviceName] Building image: $imageName..." -ForegroundColor Green
    
    # Check if Dockerfile exists
    $fullDockerPath = Join-Path $rootDir $dockerfile
    if (-not (Test-Path $fullDockerPath)) {
        Write-Warning "Dockerfile not found for $serviceName at $fullDockerPath. Skipping."
        continue
    }

    # Execute Docker Build
    Push-Location $rootDir
    try {
        # Build with version tag
        docker build -f $dockerfile -t $imageName --build-arg APP_VERSION=$Tag .
        if ($LASTEXITCODE -ne 0) { throw "Docker build failed for $serviceName" }
        
        # Also tag as latest if requested
        if ($TagLatest -and $Tag -ne "latest") {
            Write-Host "[$serviceName] Tagging as latest..."
            docker tag $imageName $latestImageName
        }
        
        Write-Host "[$serviceName] Build success." -ForegroundColor Green
        
        if ($Push) {
            Write-Host "[$serviceName] Pushing $Tag to registry..."
            docker push $imageName
            if ($LASTEXITCODE -ne 0) { throw "Docker push failed for $serviceName" }
            Write-Host "[$serviceName] Push $Tag success." -ForegroundColor Green
            
            # Push latest tag if requested
            if ($TagLatest -and $Tag -ne "latest") {
                Write-Host "[$serviceName] Pushing latest to registry..."
                docker push $latestImageName
                if ($LASTEXITCODE -ne 0) { throw "Docker push latest failed for $serviceName" }
                Write-Host "[$serviceName] Push latest success." -ForegroundColor Green
            }
        }
    }
    catch {
        $errorMessage = $_
        if ($_ -is [System.Management.Automation.ErrorRecord]) {
            $errorMessage = $_.Exception.Message
        }
        Write-Host "Error processing $serviceName`: $errorMessage" -ForegroundColor Red
        exit 1
    }
    finally {
        Pop-Location
    }
}

Write-Host "`nDone." -ForegroundColor Cyan
