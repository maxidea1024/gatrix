#!/usr/bin/env pwsh
#
# Gatrix Build and Push Script (ECS/ECR Edition)
#
# Usage:
#   ./build-and-push.ps1 [options]
#
# Options:
#   -t, --tag <tag>           Image tag (default: latest)
#   -p, --push                Push images to ECR
#   -l, --latest              Also tag and push as "latest"
#   -s, --service <name>      Service to build (repeatable)
#   -h, --help                Show help

$ErrorActionPreference = "Stop"
$Tag = "latest"
$Push = $false
$TagLatest = $false
$TargetServices = @()

function Show-Help {
    Write-Host "Gatrix Build and Push Script (ECS/ECR Edition)"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -t, --tag <tag>           Image tag (default: latest)"
    Write-Host "  -p, --push                Push images to ECR"
    Write-Host "  -l, --latest              Also tag and push as 'latest'"
    Write-Host "  -s, --service <name>      Service to build (repeatable)"
    Write-Host "  -h, --help                Show help"
    Write-Host ""
    Write-Host "Available services: backend, frontend, edge"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  ./build-and-push.ps1 -t v1.0.0 -l -p"
    Write-Host "  ./build-and-push.ps1 --service backend --push"
    exit 0
}

$i = 0
while ($i -lt $args.Count) {
    switch ($args[$i]) {
        { $_ -eq "-t" -or $_ -eq "--tag" } { $Tag = $args[$i + 1]; $i += 2 }
        { $_ -eq "-p" -or $_ -eq "--push" } { $Push = $true; $i += 1 }
        { $_ -eq "-l" -or $_ -eq "--latest" } { $TagLatest = $true; $i += 1 }
        { $_ -eq "-s" -or $_ -eq "--service" } { $TargetServices += $args[$i + 1]; $i += 2 }
        { $_ -eq "-h" -or $_ -eq "--help" } { Show-Help }
        default { Write-Host "Unknown option: $($args[$i])" -ForegroundColor Red; exit 1 }
    }
}

# Load .env
$envPath = Join-Path $PSScriptRoot ".env"
if (Test-Path $envPath) {
    Get-Content $envPath | Where-Object { $_ -match "=" -and $_ -notmatch "^\s*#" } | ForEach-Object {
        $parts = $_ -split '=', 2
        [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
    }
}

$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { "ap-northeast-2" }
$AccountId = $env:AWS_ACCOUNT_ID
if (-not $AccountId) { Write-Host "[ERROR] AWS_ACCOUNT_ID not set in .env" -ForegroundColor Red; exit 1 }
$Registry = "$AccountId.dkr.ecr.$Region.amazonaws.com"

$allServices = @{
    "backend"  = "packages/backend/Dockerfile"
    "frontend" = "packages/frontend/Dockerfile"
    "edge"     = "packages/edge/Dockerfile"
}

$servicesToBuild = @{}
if ($TargetServices.Count -gt 0) {
    foreach ($svcName in $TargetServices) {
        if ($allServices.ContainsKey($svcName)) {
            $servicesToBuild[$svcName] = $allServices[$svcName]
        } else {
            Write-Warning "Service '$svcName' not found. Available: $($allServices.Keys -join ', ')"
        }
    }
} else {
    $servicesToBuild = $allServices
}

$rootDir = Resolve-Path "$PSScriptRoot\.."

Write-Host "Gatrix Build & Push (ECR Edition)" -ForegroundColor Cyan
Write-Host "Root Directory: $rootDir"
Write-Host "Tag: $Tag"
Write-Host "Registry: $Registry/gatrix-<service>:<tag>"
Write-Host "Services: $($servicesToBuild.Keys -join ', ')"

# ECR Login
if ($Push) {
    Write-Host "Logging in to ECR..." -ForegroundColor Yellow
    aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin $Registry
    if ($LASTEXITCODE -ne 0) { throw "ECR login failed" }
}

foreach ($serviceName in $servicesToBuild.Keys) {
    $dockerfile = $servicesToBuild[$serviceName]
    $repoName = "gatrix-$serviceName"
    $imageName = "$Registry/$repoName`:$Tag"
    $latestImageName = "$Registry/$repoName`:latest"

    # Ensure ECR repo exists
    if ($Push) {
        aws ecr describe-repositories --repository-names $repoName --region $Region 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[$serviceName] Creating ECR repository: $repoName" -ForegroundColor Yellow
            aws ecr create-repository --repository-name $repoName --region $Region --image-scanning-configuration scanOnPush=true | Out-Null
        }
    }

    Write-Host "`n[$serviceName] Building image: $imageName..." -ForegroundColor Green
    $fullDockerPath = Join-Path $rootDir $dockerfile
    if (-not (Test-Path $fullDockerPath)) {
        Write-Warning "Dockerfile not found: $fullDockerPath. Skipping."
        continue
    }

    Push-Location $rootDir
    try {
        docker build -f $dockerfile -t $imageName --build-arg APP_VERSION=$Tag .
        if ($LASTEXITCODE -ne 0) { throw "Docker build failed for $serviceName" }

        if ($TagLatest -and $Tag -ne "latest") {
            docker tag $imageName $latestImageName
        }

        Write-Host "[$serviceName] Build success." -ForegroundColor Green

        if ($Push) {
            Write-Host "[$serviceName] Pushing $Tag..."
            docker push $imageName
            if ($LASTEXITCODE -ne 0) { throw "Docker push failed for $serviceName" }

            if ($TagLatest -and $Tag -ne "latest") {
                Write-Host "[$serviceName] Pushing latest..."
                docker push $latestImageName
            }
            Write-Host "[$serviceName] Push success." -ForegroundColor Green
        }
    } finally { Pop-Location }
}

# Save build history
$historyFile = Join-Path $PSScriptRoot ".build-history.json"
$gitHash = git rev-parse --short HEAD 2>$null; if (-not $gitHash) { $gitHash = "unknown" }
$gitBranch = git rev-parse --abbrev-ref HEAD 2>$null; if (-not $gitBranch) { $gitBranch = "unknown" }

$buildRecord = @{
    timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    tag       = $Tag
    latest    = $TagLatest
    pushed    = $Push
    services  = @($servicesToBuild.Keys)
    gitHash   = $gitHash
    gitBranch = $gitBranch
    registry  = $Registry
}

$history = @()
if (Test-Path $historyFile) {
    try { $history = Get-Content $historyFile -Raw | ConvertFrom-Json; if ($history -isnot [Array]) { $history = @($history) } } catch { $history = @() }
}
$history += $buildRecord
$history | ConvertTo-Json -Depth 10 | Set-Content $historyFile -Encoding UTF8

Write-Host "`nDone." -ForegroundColor Cyan
if ($Push) {
    Write-Host "`nPushed Images:" -ForegroundColor Cyan
    foreach ($svc in $servicesToBuild.Keys) {
        Write-Host "  $Registry/gatrix-$svc`:$Tag" -ForegroundColor Green
    }
}
