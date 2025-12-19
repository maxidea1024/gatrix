<#
.SYNOPSIS
    Builds and pushes Docker images for Gatrix services.

.DESCRIPTION
    This script builds Docker images for backend, frontend, edge, chat-server, and event-lens.
    It automatically logs in to the Tencent Cloud Registry and pushes images there.

.PARAMETER Tag
    The image tag (default: "latest").

.PARAMETER Push
    If specified, pushes the images to the registry.

.PARAMETER Service
    Optional. The specific service(s) to build (e.g., "backend", "frontend").
    If omitted, all services are built.

.EXAMPLE
    .\build_and_push.ps1 -Tag "v1.0.0"
    Builds all images locally with tag "v1.0.0".

.EXAMPLE
    .\build_and_push.ps1 -Service backend -Tag "dev"
    Builds only the backend image.

.EXAMPLE
    .\build_and_push.ps1 -Service backend,frontend -Tag "prod" -Push
    Builds and pushes backend and frontend images.
#>

param(
    [string]$Tag = "latest",
    [switch]$Push = $false,
    [string[]]$Service = @()
)

$ErrorActionPreference = "Stop"

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

if ($Service.Count -gt 0) {
    foreach ($svcName in $Service) {
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
$loginScript = Join-Path $PSScriptRoot "login_registry.ps1"

Write-Host "Wrapper script for Gatrix Build & Push" -ForegroundColor Cyan
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
        docker build -f $dockerfile -t $imageName .
        if ($LASTEXITCODE -ne 0) { throw "Docker build failed for $serviceName" }
        
        Write-Host "[$serviceName] Build success." -ForegroundColor Green
        
        if ($Push) {
            Write-Host "[$serviceName] Pushing to registry..."
            docker push $imageName
            if ($LASTEXITCODE -ne 0) { throw "Docker push failed for $serviceName" }
            Write-Host "[$serviceName] Push success." -ForegroundColor Green
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
