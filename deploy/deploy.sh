#!/bin/bash
#
# Gatrix Swarm Deployment Script
#
# Usage:
#   ./deploy.sh [options]
#
# Options:
#   -v, --version <version>   Version to deploy (default: latest)
#   -e, --env <file>          Environment file path (default: .env)
#   -s, --stack <name>        Stack name (default: gatrix)
#   --init                    Initialize swarm and create secrets
#   --update                  Update existing deployment (rolling update)
#   --prune                   Remove unused images after deployment
#   -h, --help                Show help

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
VERSION="latest"
ENV_FILE=".env"
STACK_NAME="gatrix"
INIT_MODE=false
UPDATE_MODE=false
PRUNE_MODE=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -e|--env)
            ENV_FILE="$2"
            shift 2
            ;;
        -s|--stack)
            STACK_NAME="$2"
            shift 2
            ;;
        --init)
            INIT_MODE=true
            shift
            ;;
        --update)
            UPDATE_MODE=true
            shift
            ;;
        --prune)
            PRUNE_MODE=true
            shift
            ;;
        -h|--help)
            echo "Gatrix Swarm Deployment Script"
            echo ""
            echo "Usage: ./deploy.sh [options]"
            echo ""
            echo "Options:"
            echo "  -v, --version <version>   Version to deploy (default: latest)"
            echo "  -e, --env <file>          Environment file path (default: .env)"
            echo "  -s, --stack <name>        Stack name (default: gatrix)"
            echo "  --init                    Initialize swarm and create secrets"
            echo "  --update                  Update existing deployment"
            echo "  --prune                   Remove unused images after deployment"
            echo "  -h, --help                Show help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if docker is available
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
}

# Check if swarm is initialized
check_swarm() {
    if ! docker info --format '{{.Swarm.LocalNodeState}}' | grep -q "active"; then
        if [ "$INIT_MODE" = true ]; then
            log_info "Initializing Docker Swarm..."
            docker swarm init
        else
            log_error "Docker Swarm is not initialized. Run with --init flag or run 'docker swarm init'"
            exit 1
        fi
    fi
}

# Load environment file
load_env() {
    if [ -f "$ENV_FILE" ]; then
        log_info "Loading environment from $ENV_FILE"
        export $(grep -v '^#' "$ENV_FILE" | xargs)
    else
        log_warn "Environment file not found: $ENV_FILE"
    fi
    export GATRIX_VERSION="$VERSION"
}

# Create Docker secrets
create_secrets() {
    log_info "Creating Docker secrets..."
    
    local secrets=(
        "db_root_password:${DB_ROOT_PASSWORD:-rootpassword}"
        "db_password:${DB_PASSWORD:-gatrix_password}"
        "jwt_secret:${JWT_SECRET:-your-super-secret-jwt-key}"
        "jwt_refresh_secret:${JWT_REFRESH_SECRET:-your-super-secret-refresh-key}"
        "session_secret:${SESSION_SECRET:-your-super-secret-session-key}"
        "api_secret:${GATRIX_API_SECRET:-shared-secret-between-servers}"
        "edge_api_token:${EDGE_API_TOKEN:-gatrix-unsecured-server-api-token}"
        "grafana_password:${GRAFANA_ADMIN_PASSWORD:-admin}"
    )
    
    for secret_pair in "${secrets[@]}"; do
        IFS=':' read -r name value <<< "$secret_pair"
        if docker secret inspect "$name" &> /dev/null; then
            log_warn "Secret '$name' already exists, skipping..."
        else
            echo -n "$value" | docker secret create "$name" -
            log_success "Created secret: $name"
        fi
    done
}

# Login to registry
source "$(dirname "${BASH_SOURCE[0]}")/login_registry.sh"

# Pull images
pull_images() {
    log_info "Pulling images for version: $VERSION"

    local services=("backend" "frontend" "event-lens" "chat-server" "edge")

    for service in "${services[@]}"; do
        log_info "Pulling uwocn.tencentcloudcr.com/uwocn/gatrix-${service}:${VERSION}"
        docker pull "uwocn.tencentcloudcr.com/uwocn/gatrix-${service}:${VERSION}" || {
            log_warn "Failed to pull gatrix-${service}:${VERSION}, trying latest..."
            docker pull "uwocn.tencentcloudcr.com/uwocn/gatrix-${service}:latest"
        }
    done
}

# Deploy stack
deploy_stack() {
    log_info "Deploying stack: $STACK_NAME (version: $VERSION)"

    cd "$SCRIPT_DIR"

    if [ "$UPDATE_MODE" = true ]; then
        log_info "Performing rolling update..."
    fi

    docker stack deploy \
        -c docker-stack.yml \
        --with-registry-auth \
        "$STACK_NAME"

    log_success "Stack deployed successfully!"
}

# Wait for services to be ready
wait_for_services() {
    log_info "Waiting for services to be ready..."

    local timeout=300
    local elapsed=0

    while [ $elapsed -lt $timeout ]; do
        local replicas=$(docker stack services "$STACK_NAME" --format '{{.Replicas}}' | grep -v "0/")
        local total=$(docker stack services "$STACK_NAME" --format '{{.Replicas}}' | wc -l)
        local ready=$(docker stack services "$STACK_NAME" --format '{{.Replicas}}' | grep -E "^[0-9]+/\1$" | wc -l)

        log_info "Services ready: checking... (${elapsed}s / ${timeout}s)"

        if docker stack services "$STACK_NAME" --format '{{.Replicas}}' | grep -qv "0/"; then
            sleep 10
            elapsed=$((elapsed + 10))
        else
            log_success "All services are ready!"
            return 0
        fi
    done

    log_warn "Timeout waiting for services. Check service status manually."
}

# Prune unused images
prune_images() {
    if [ "$PRUNE_MODE" = true ]; then
        log_info "Pruning unused images..."
        docker image prune -f
    fi
}

# Show status
show_status() {
    echo ""
    log_info "Stack Status:"
    docker stack services "$STACK_NAME"
    echo ""
    log_info "Service Replicas:"
    docker stack ps "$STACK_NAME" --filter "desired-state=running"
}

# Main
main() {
    echo "========================================"
    echo "   Gatrix Swarm Deployment"
    echo "========================================"
    echo ""

    check_docker
    check_swarm
    load_env

    if [ "$INIT_MODE" = true ]; then
        create_secrets
    fi

    login_registry
    pull_images
    deploy_stack
    wait_for_services
    prune_images
    show_status

    echo ""
    log_success "Deployment completed!"
    echo ""
    echo "Access your services:"
    echo "  - Frontend: http://localhost:${HTTP_PORT:-80}"
    echo "  - API: http://localhost:${HTTP_PORT:-80}/api/v1"
    echo "  - Grafana: http://localhost:${HTTP_PORT:-80}/grafana"
}

main

