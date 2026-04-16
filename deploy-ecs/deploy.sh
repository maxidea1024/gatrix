#!/usr/bin/env bash
#
# Gatrix ECS Deployment Script
#
# Usage:
#   ./deploy.sh [options]
#
# Options:
#   -v, --version <version>   Version to deploy (default: latest)
#   -e, --env-file <file>     Environment file path (default: .env)
#   -p, --prefix <name>       CloudFormation stack prefix (default: gatrix)
#   -i, --init                Create all CloudFormation stacks (first-time setup)
#   -u, --update              Update existing CloudFormation stacks
#   --skip-infra              Skip infrastructure stacks, deploy services only
#   -h, --help                Show help

set -euo pipefail

VERSION="latest"
ENV_FILE=".env"
PREFIX="gatrix"
INIT=false
UPDATE=false
SKIP_INFRA=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

show_help() {
    echo "Gatrix ECS Deployment Script"
    echo ""
    echo "Usage: ./deploy.sh [options]"
    echo ""
    echo "Options:"
    echo "  -v, --version <version>   Version to deploy (default: latest)"
    echo "  -e, --env-file <file>     Environment file path (default: .env)"
    echo "  -p, --prefix <name>       Stack prefix (default: gatrix)"
    echo "  -i, --init                Create all stacks (first-time)"
    echo "  -u, --update              Update existing stacks"
    echo "  --skip-infra              Skip infra, deploy services only"
    echo "  -h, --help                Show help"
    exit 0
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        -v|--version) VERSION="$2"; shift 2 ;;
        -e|--env-file) ENV_FILE="$2"; shift 2 ;;
        -p|--prefix) PREFIX="$2"; shift 2 ;;
        -i|--init) INIT=true; shift ;;
        -u|--update) UPDATE=true; shift ;;
        --skip-infra) SKIP_INFRA=true; shift ;;
        -h|--help) show_help ;;
        *) echo "[ERROR] Unknown option: $1"; exit 1 ;;
    esac
done

info()    { echo -e "\033[34m[INFO]\033[0m $1"; }
success() { echo -e "\033[32m[SUCCESS]\033[0m $1"; }
warn()    { echo -e "\033[33m[WARN]\033[0m $1"; }
error()   { echo -e "\033[31m[ERROR]\033[0m $1"; }

# Check AWS CLI
if ! command -v aws &>/dev/null; then
    error "AWS CLI is not installed."
    exit 1
fi

# Load .env
ENV_PATH="$SCRIPT_DIR/$ENV_FILE"
if [[ -f "$ENV_PATH" ]]; then
    info "Loading environment from $ENV_PATH"
    set -a
    source <(grep -v '^\s*#' "$ENV_PATH" | grep -v '^\s*$')
    set +a
else
    error "Environment file not found: $ENV_PATH"
    info "Copy .env.example to .env and configure it first"
    exit 1
fi

REGION="${AWS_REGION:-ap-northeast-2}"
ACCOUNT_ID="${AWS_ACCOUNT_ID:?AWS_ACCOUNT_ID is required}"
PREFIX="${CFN_STACK_PREFIX:-$PREFIX}"
ECR_REGISTRY="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"
CFN_DIR="$SCRIPT_DIR/cfn"

# Validate required vars
for var in DB_HOST DB_USER DB_PASSWORD REDIS_HOST EDGE_REDIS_HOST; do
    val="${!var:-}"
    if [[ -z "$val" || "$val" == your-* ]]; then
        error "Required variable '$var' is not set or has placeholder value"
        exit 1
    fi
done
success "Environment variables validated"

deploy_stack() {
    local stack_name="$PREFIX-$1"
    local template_file="$CFN_DIR/$2"
    shift 2
    local params=("$@")

    local param_args=""
    if [[ ${#params[@]} -gt 0 ]]; then
        param_args="--parameters ${params[*]}"
    fi

    if aws cloudformation describe-stacks --stack-name "$stack_name" --region "$REGION" &>/dev/null; then
        info "Updating stack: $stack_name"
        if aws cloudformation update-stack \
            --stack-name "$stack_name" \
            --template-body "file://$template_file" \
            --capabilities CAPABILITY_NAMED_IAM \
            --region "$REGION" \
            $param_args 2>&1 | grep -q "No updates"; then
            warn "No changes for stack: $stack_name"
        else
            info "Waiting for stack update: $stack_name ..."
            aws cloudformation wait stack-update-complete --stack-name "$stack_name" --region "$REGION"
            success "Stack updated: $stack_name"
        fi
    else
        info "Creating stack: $stack_name"
        aws cloudformation create-stack \
            --stack-name "$stack_name" \
            --template-body "file://$template_file" \
            --capabilities CAPABILITY_NAMED_IAM \
            --region "$REGION" \
            $param_args
        info "Waiting for stack creation: $stack_name ..."
        aws cloudformation wait stack-create-complete --stack-name "$stack_name" --region "$REGION"
        success "Stack created: $stack_name"
    fi
}

echo "========================================"
echo "   Gatrix ECS Deployment"
echo "========================================"
echo ""
info "Region:   $REGION"
info "Account:  $ACCOUNT_ID"
info "Prefix:   $PREFIX"
info "Version:  $VERSION"
info "Registry: $ECR_REGISTRY"
echo ""

# ECR Login
info "Logging in to ECR..."
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"
success "ECR login successful"

if [[ "$SKIP_INFRA" == "false" ]]; then
    deploy_stack "vpc" "00-vpc.yml" "ParameterKey=EnvironmentName,ParameterValue=$PREFIX"
    deploy_stack "sg" "01-security-groups.yml" "ParameterKey=EnvironmentName,ParameterValue=$PREFIX"
    deploy_stack "alb" "02-alb.yml" "ParameterKey=EnvironmentName,ParameterValue=$PREFIX"
    deploy_stack "ecs-cluster" "03-ecs-cluster.yml" "ParameterKey=EnvironmentName,ParameterValue=$PREFIX"
    deploy_stack "service-discovery" "04-service-discovery.yml" "ParameterKey=EnvironmentName,ParameterValue=$PREFIX"
fi

BACKEND_IMAGE="$ECR_REGISTRY/gatrix-backend:$VERSION"
FRONTEND_IMAGE="$ECR_REGISTRY/gatrix-frontend:$VERSION"
EDGE_IMAGE="$ECR_REGISTRY/gatrix-edge:$VERSION"

JWT_ARN="arn:aws:secretsmanager:$REGION:$ACCOUNT_ID:secret:$PREFIX/jwt-secret"
JWT_REFRESH_ARN="arn:aws:secretsmanager:$REGION:$ACCOUNT_ID:secret:$PREFIX/jwt-refresh-secret"
SESSION_ARN="arn:aws:secretsmanager:$REGION:$ACCOUNT_ID:secret:$PREFIX/session-secret"

info "Deploying task definitions..."
deploy_stack "task-defs" "05-task-definitions.yml" \
    "ParameterKey=EnvironmentName,ParameterValue=$PREFIX" \
    "ParameterKey=BackendImage,ParameterValue=$BACKEND_IMAGE" \
    "ParameterKey=FrontendImage,ParameterValue=$FRONTEND_IMAGE" \
    "ParameterKey=EdgeImage,ParameterValue=$EDGE_IMAGE" \
    "ParameterKey=DbHost,ParameterValue=$DB_HOST" \
    "ParameterKey=DbUser,ParameterValue=$DB_USER" \
    "ParameterKey=DbPassword,ParameterValue=$DB_PASSWORD" \
    "ParameterKey=RedisHost,ParameterValue=$REDIS_HOST" \
    "ParameterKey=EdgeRedisHost,ParameterValue=$EDGE_REDIS_HOST" \
    "ParameterKey=JwtSecretArn,ParameterValue=$JWT_ARN" \
    "ParameterKey=JwtRefreshSecretArn,ParameterValue=$JWT_REFRESH_ARN" \
    "ParameterKey=SessionSecretArn,ParameterValue=$SESSION_ARN"

info "Deploying ECS services..."
deploy_stack "ecs-services" "06-ecs-services.yml" \
    "ParameterKey=EnvironmentName,ParameterValue=$PREFIX" \
    "ParameterKey=BackendDesiredCount,ParameterValue=${BACKEND_REPLICAS:-2}" \
    "ParameterKey=FrontendDesiredCount,ParameterValue=${FRONTEND_REPLICAS:-2}" \
    "ParameterKey=EdgeDesiredCount,ParameterValue=${EDGE_REPLICAS:-2}"

info "Deploying monitoring stack..."
deploy_stack "monitoring" "07-monitoring.yml" \
    "ParameterKey=EnvironmentName,ParameterValue=$PREFIX" \
    "ParameterKey=GrafanaAdminUser,ParameterValue=${GRAFANA_ADMIN_USER:-admin}" \
    "ParameterKey=GrafanaAdminPassword,ParameterValue=${GRAFANA_ADMIN_PASSWORD:-admin}"

CLUSTER_NAME="$PREFIX-cluster"
info "Waiting for services to stabilize..."
for svc in "$PREFIX-backend" "$PREFIX-frontend" "$PREFIX-edge"; do
    info "Waiting for $svc..."
    aws ecs wait services-stable --cluster "$CLUSTER_NAME" --services "$svc" --region "$REGION" 2>&1 && \
        success "$svc is stable" || warn "$svc may not be fully stable yet"
done

echo ""
success "Deployment completed!"
ALB_DNS=$(aws cloudformation describe-stacks --stack-name "$PREFIX-alb" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='ALBDnsName'].OutputValue" --output text 2>/dev/null || echo "")
if [[ -n "$ALB_DNS" ]]; then
    echo ""
    echo "Access your services via ALB:"
    echo "  - Frontend (Admin UI): http://$ALB_DNS/"
    echo "  - Backend API:         http://$ALB_DNS/api/v1/"
    echo "  - Edge:                http://$ALB_DNS/edge/"
    echo "  - Grafana:             http://$ALB_DNS/grafana/"
fi
echo ""
echo "Run ./health-check.sh for full service verification."
