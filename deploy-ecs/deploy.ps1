#!/usr/bin/env pwsh
#
# Gatrix ECS Deployment Script
#
# Usage:
#   ./deploy.ps1 [options]
#
# Options:
#   -v, --version <version>   Version to deploy (default: latest)
#   -e, --env-file <file>     Environment file path (default: .env)
#   -p, --prefix <name>       CloudFormation stack prefix (default: gatrix)
#   -i, --init                Create all CloudFormation stacks (first-time setup)
#   -u, --update              Update existing CloudFormation stacks
#   --skip-infra              Skip infrastructure stacks (VPC, SG, ALB) and only deploy services
#   -h, --help                Show help

$ErrorActionPreference = "Stop"

$Version = "latest"
$EnvFile = ".env"
$Prefix = "gatrix"
$Init = $false
$Update = $false
$SkipInfra = $false

function Show-Help {
    Write-Host "Gatrix ECS Deployment Script"
    Write-Host ""
    Write-Host "Usage: ./deploy.ps1 [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -v, --version <version>   Version to deploy (default: latest)"
    Write-Host "  -e, --env-file <file>     Environment file path (default: .env)"
    Write-Host "  -p, --prefix <name>       CloudFormation stack prefix (default: gatrix)"
    Write-Host "  -i, --init                Create all stacks (first-time setup)"
    Write-Host "  -u, --update              Update existing stacks"
    Write-Host "  --skip-infra              Skip infrastructure, deploy services only"
    Write-Host "  -h, --help                Show help"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  ./deploy.ps1 -v 1.0.0 -i          # First deploy (create all stacks)"
    Write-Host "  ./deploy.ps1 -v 1.0.0 -u          # Update existing deployment"
    Write-Host "  ./deploy.ps1 -v 1.0.0 --skip-infra # Update services only"
    exit 0
}

$i = 0
while ($i -lt $args.Count) {
    switch ($args[$i]) {
        { $_ -eq "-v" -or $_ -eq "--version" } { $Version = $args[$i + 1]; $i += 2 }
        { $_ -eq "-e" -or $_ -eq "--env-file" } { $EnvFile = $args[$i + 1]; $i += 2 }
        { $_ -eq "-p" -or $_ -eq "--prefix" } { $Prefix = $args[$i + 1]; $i += 2 }
        { $_ -eq "-i" -or $_ -eq "--init" } { $Init = $true; $i += 1 }
        { $_ -eq "-u" -or $_ -eq "--update" } { $Update = $true; $i += 1 }
        "--skip-infra" { $SkipInfra = $true; $i += 1 }
        { $_ -eq "-h" -or $_ -eq "--help" } { Show-Help }
        default { Write-Host "Unknown option: $($args[$i])" -ForegroundColor Red; exit 1 }
    }
}

function Show-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Blue }
function Show-Success($msg) { Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Show-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Show-Error($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }
function Coalesce($val, $default) { if ($val) { $val } else { $default } }

# Check AWS CLI
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Show-Error "AWS CLI is not installed. Install it first: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
}

# Load .env
$envFilePath = Join-Path $PSScriptRoot $EnvFile
if (Test-Path $envFilePath) {
    Show-Info "Loading environment from $envFilePath"
    $envContent = Get-Content $envFilePath | Where-Object { $_ -notmatch '^\s*#' -and $_ -ne "" }
    foreach ($line in $envContent) {
        $parts = $line -split '=', 2
        if ($parts.Length -eq 2) {
            $name = $parts[0].Trim()
            $value = $parts[1].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
} else {
    Show-Error "Environment file not found: $envFilePath"
    Show-Info "Copy .env.example to .env and configure it first:"
    Show-Info "  cp .env.example .env"
    exit 1
}

# Overrides from env
$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { "ap-northeast-2" }
$AccountId = $env:AWS_ACCOUNT_ID
if (-not $Prefix -and $env:CFN_STACK_PREFIX) { $Prefix = $env:CFN_STACK_PREFIX }

# Validate
$requiredVars = @("AWS_ACCOUNT_ID")
foreach ($var in $requiredVars) {
    $val = [Environment]::GetEnvironmentVariable($var, "Process")
    if (-not $val -or $val -match "^your-") {
        Show-Error "Required variable '$var' is not set or still has placeholder value in .env"
        exit 1
    }
}
Show-Success "Environment variables validated"

$EcrRegistry = "$AccountId.dkr.ecr.$Region.amazonaws.com"
$CfnDir = Join-Path $PSScriptRoot "cfn"

function Deploy-Stack {
    param([string]$StackName, [string]$TemplateFile, [string[]]$Params)

    $templatePath = Join-Path $CfnDir $TemplateFile
    $fullStackName = "$Prefix-$StackName"

    # Check if stack exists
    $stackExists = $false
    try {
        aws cloudformation describe-stacks --stack-name $fullStackName --region $Region 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { $stackExists = $true }
    } catch { $stackExists = $false }

    $paramArgs = @()
    if ($Params.Count -gt 0) {
        $paramArgs = @("--parameters") + $Params
    }

    if ($stackExists) {
        Show-Info "Updating stack: $fullStackName"
        # Temporarily allow stderr without terminating (AWS CLI writes errors to stderr)
        $prevEAP = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        $updateOutput = aws cloudformation update-stack `
            --stack-name $fullStackName `
            --template-body "file://$templatePath" `
            --capabilities CAPABILITY_NAMED_IAM `
            --region $Region `
            @paramArgs 2>&1
        $updateExitCode = $LASTEXITCODE
        $ErrorActionPreference = $prevEAP

        $outputStr = ($updateOutput | Out-String)
        if ($updateExitCode -eq 0) {
            Show-Info "Waiting for stack update: $fullStackName ..."
            aws cloudformation wait stack-update-complete --stack-name $fullStackName --region $Region
            Show-Success "Stack updated: $fullStackName"
        } elseif ($outputStr -match "No updates are to be performed") {
            Show-Warn "No changes for stack: $fullStackName"
        } else {
            Show-Error "Failed to update stack: $fullStackName"
            Write-Host $outputStr
            throw "Stack update failed: $fullStackName"
        }
    } else {
        Show-Info "Creating stack: $fullStackName"
        aws cloudformation create-stack `
            --stack-name $fullStackName `
            --template-body "file://$templatePath" `
            --capabilities CAPABILITY_NAMED_IAM `
            --region $Region `
            @paramArgs

        Show-Info "Waiting for stack creation: $fullStackName ..."
        aws cloudformation wait stack-create-complete --stack-name $fullStackName --region $Region
        Show-Success "Stack created: $fullStackName"
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Gatrix ECS Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Show-Info "Region:   $Region"
Show-Info "Account:  $AccountId"
Show-Info "Prefix:   $Prefix"
Show-Info "Version:  $Version"
Show-Info "Registry: $EcrRegistry"
Write-Host ""

# ECR Login
Show-Info "Logging in to ECR..."
aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin $EcrRegistry
Show-Success "ECR login successful"

if (-not $SkipInfra) {
    # 1. VPC
    Deploy-Stack "vpc" "00-vpc.yml" @(
        "ParameterKey=EnvironmentName,ParameterValue=$Prefix"
    )

    # 2. Security Groups
    Deploy-Stack "sg" "01-security-groups.yml" @(
        "ParameterKey=EnvironmentName,ParameterValue=$Prefix"
    )

    # 3. ALB
    Deploy-Stack "alb" "02-alb.yml" @(
        "ParameterKey=EnvironmentName,ParameterValue=$Prefix"
    )

    # 4. ECS Cluster
    Deploy-Stack "ecs-cluster" "03-ecs-cluster.yml" @(
        "ParameterKey=EnvironmentName,ParameterValue=$Prefix"
    )

    # 5. Service Discovery
    Deploy-Stack "service-discovery" "04-service-discovery.yml" @(
        "ParameterKey=EnvironmentName,ParameterValue=$Prefix"
    )

    # 5b. Database (RDS MySQL + ElastiCache Redis)
    if ($env:DB_PASSWORD -and $env:DB_PASSWORD -notmatch '^your-') {
        Show-Info "Deploying database stack (RDS + ElastiCache)..."
        $dbParams = @(
            "ParameterKey=EnvironmentName,ParameterValue=$Prefix",
            "ParameterKey=DBInstanceClass,ParameterValue=$(Coalesce $env:DB_INSTANCE_CLASS 'db.t4g.micro')",
            "ParameterKey=DBAllocatedStorage,ParameterValue=$(Coalesce $env:DB_ALLOCATED_STORAGE '20')",
            "ParameterKey=DBName,ParameterValue=$(Coalesce $env:DB_NAME 'gatrix')",
            "ParameterKey=DBMasterUsername,ParameterValue=$(Coalesce $env:DB_USER 'gatrix_user')",
            "ParameterKey=DBMasterPassword,ParameterValue=$env:DB_PASSWORD",
            "ParameterKey=CacheNodeType,ParameterValue=$(Coalesce $env:CACHE_NODE_TYPE 'cache.t4g.micro')"
        )
        if ($env:REDIS_PASSWORD -and $env:REDIS_PASSWORD -notmatch '^your-') {
            $dbParams += "ParameterKey=RedisAuthToken,ParameterValue=$env:REDIS_PASSWORD"
        }
        Deploy-Stack "database" "09-database.yml" $dbParams

        # Auto-update DB_HOST and REDIS_HOST from stack outputs
        $dbEndpoint = aws cloudformation describe-stacks --stack-name "$Prefix-database" --region $Region --query "Stacks[0].Outputs[?OutputKey=='DBEndpoint'].OutputValue" --output text 2>$null
        $redisEndpoint = aws cloudformation describe-stacks --stack-name "$Prefix-database" --region $Region --query "Stacks[0].Outputs[?OutputKey=='RedisEndpoint'].OutputValue" --output text 2>$null
        if ($dbEndpoint) { [Environment]::SetEnvironmentVariable('DB_HOST', $dbEndpoint, 'Process'); Show-Info "DB_HOST = $dbEndpoint" }
        if ($redisEndpoint) {
            [Environment]::SetEnvironmentVariable('REDIS_HOST', $redisEndpoint, 'Process')
            [Environment]::SetEnvironmentVariable('EDGE_REDIS_HOST', $redisEndpoint, 'Process')
            Show-Info "REDIS_HOST = $redisEndpoint"
        }
    } else {
        Show-Warn "DB_PASSWORD not set, skipping database stack. Configure manually."
    }
}

# 6. Task Definitions
$BackendImage = "$EcrRegistry/gatrix-backend:$Version"
$FrontendImage = "$EcrRegistry/gatrix-frontend:$Version"
$EdgeImage = "$EcrRegistry/gatrix-edge:$Version"

# Secrets (direct values - no Secrets Manager since no NAT Gateway)
$jwtSecret = Coalesce $env:JWT_SECRET 'change-me-jwt-secret'
$jwtRefreshSecret = Coalesce $env:JWT_REFRESH_SECRET 'change-me-jwt-refresh-secret'
$sessionSecret = Coalesce $env:SESSION_SECRET 'change-me-session-secret'

Show-Info "Deploying task definitions..."
Deploy-Stack "task-defs" "05-task-definitions.yml" @(
    "ParameterKey=EnvironmentName,ParameterValue=$Prefix",
    "ParameterKey=BackendImage,ParameterValue=$BackendImage",
    "ParameterKey=FrontendImage,ParameterValue=$FrontendImage",
    "ParameterKey=EdgeImage,ParameterValue=$EdgeImage",
    "ParameterKey=BackendCpu,ParameterValue=$(Coalesce $env:BACKEND_CPU '512')",
    "ParameterKey=BackendMemory,ParameterValue=$(Coalesce $env:BACKEND_MEMORY '1024')",
    "ParameterKey=FrontendCpu,ParameterValue=$(Coalesce $env:FRONTEND_CPU '256')",
    "ParameterKey=FrontendMemory,ParameterValue=$(Coalesce $env:FRONTEND_MEMORY '512')",
    "ParameterKey=EdgeCpu,ParameterValue=$(Coalesce $env:EDGE_CPU '256')",
    "ParameterKey=EdgeMemory,ParameterValue=$(Coalesce $env:EDGE_MEMORY '512')",
    "ParameterKey=DbHost,ParameterValue=$env:DB_HOST",
    "ParameterKey=DbPort,ParameterValue=$(Coalesce $env:DB_PORT '3306')",
    "ParameterKey=DbName,ParameterValue=$(Coalesce $env:DB_NAME 'gatrix')",
    "ParameterKey=DbUser,ParameterValue=$env:DB_USER",
    "ParameterKey=DbPassword,ParameterValue=$env:DB_PASSWORD",
    "ParameterKey=RedisHost,ParameterValue=$env:REDIS_HOST",
    "ParameterKey=RedisPort,ParameterValue=$(Coalesce $env:REDIS_PORT '6379')",
    "ParameterKey=RedisPassword,ParameterValue=$(Coalesce $env:REDIS_PASSWORD '')",
    "ParameterKey=EdgeRedisHost,ParameterValue=$env:EDGE_REDIS_HOST",
    "ParameterKey=EdgeRedisPort,ParameterValue=$(Coalesce $env:EDGE_REDIS_PORT '6379')",
    "ParameterKey=EdgeRedisPassword,ParameterValue=$(Coalesce $env:EDGE_REDIS_PASSWORD '')",
    "ParameterKey=JwtSecret,ParameterValue=$jwtSecret",
    "ParameterKey=JwtRefreshSecret,ParameterValue=$jwtRefreshSecret",
    "ParameterKey=SessionSecret,ParameterValue=$sessionSecret",
    "ParameterKey=DefaultLanguage,ParameterValue=$(Coalesce $env:DEFAULT_LANGUAGE 'zh')",
    "ParameterKey=AdminEmail,ParameterValue=$(Coalesce $env:ADMIN_EMAIL 'admin@gatrix.com')",
    "ParameterKey=AdminPassword,ParameterValue=$(Coalesce $env:ADMIN_PASSWORD 'admin123')"
)

# 7. ECS Services
Show-Info "Deploying ECS services..."
Deploy-Stack "ecs-services" "06-ecs-services.yml" @(
    "ParameterKey=EnvironmentName,ParameterValue=$Prefix",
    "ParameterKey=BackendDesiredCount,ParameterValue=$(Coalesce $env:BACKEND_REPLICAS '2')",
    "ParameterKey=FrontendDesiredCount,ParameterValue=$(Coalesce $env:FRONTEND_REPLICAS '2')",
    "ParameterKey=EdgeDesiredCount,ParameterValue=$(Coalesce $env:EDGE_REPLICAS '2')"
)

# 8. Monitoring
Show-Info "Deploying monitoring stack..."
Deploy-Stack "monitoring" "07-monitoring.yml" @(
    "ParameterKey=EnvironmentName,ParameterValue=$Prefix",
    "ParameterKey=GrafanaAdminUser,ParameterValue=$(Coalesce $env:GRAFANA_ADMIN_USER 'admin')",
    "ParameterKey=GrafanaAdminPassword,ParameterValue=$(Coalesce $env:GRAFANA_ADMIN_PASSWORD 'admin')"
)

# 9. S3 + CloudFront (Image Uploads)
Show-Info "Deploying S3/CloudFront stack..."
$s3Params = @("ParameterKey=EnvironmentName,ParameterValue=$Prefix")
if ($env:S3_UPLOADS_BUCKET) {
    $s3Params += "ParameterKey=BucketName,ParameterValue=$env:S3_UPLOADS_BUCKET"
}
Deploy-Stack "s3-cdn" "08-s3-cloudfront.yml" $s3Params

# Wait for services to stabilize
$ClusterName = "$Prefix-cluster"
Show-Info "Waiting for services to stabilize..."
$services = @("$Prefix-backend", "$Prefix-frontend", "$Prefix-edge")
foreach ($svc in $services) {
    Show-Info "Waiting for $svc..."
    aws ecs wait services-stable --cluster $ClusterName --services $svc --region $Region 2>&1
    if ($LASTEXITCODE -eq 0) {
        Show-Success "$svc is stable"
    } else {
        Show-Warn "$svc may not be fully stable yet"
    }
}

# Show results
Write-Host ""
Show-Success "Deployment completed!"
Write-Host ""

$albDns = aws cloudformation describe-stacks --stack-name "$Prefix-alb" --region $Region --query "Stacks[0].Outputs[?OutputKey=='ALBDnsName'].OutputValue" --output text 2>$null
if ($albDns) {
    Write-Host "Access your services via ALB:" -ForegroundColor Cyan
    Write-Host "  - Frontend (Admin UI): http://$albDns/"
    Write-Host "  - Backend API:         http://$albDns/api/v1/"
    Write-Host "  - Backend Health:      http://$albDns/health"
    Write-Host "  - Edge (game clients): http://edge.$albDns/ or http://$albDns/edge/"
    Write-Host "  - Grafana:             http://$albDns/grafana/"
    Write-Host "  - Prometheus:          http://$albDns/prometheus/"
}
Write-Host ""
Write-Host "Run ./health-check.ps1 for full service verification."
