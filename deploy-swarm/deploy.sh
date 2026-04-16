#!/bin/bash
#
# Gatrix Swarm Deployment Script (Cloud Infra Edition)
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
            echo "Gatrix Swarm Deployment Script (Cloud Infra Edition)"
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
            echo ""
            echo "Examples:"
            echo "  ./deploy.sh -v 1.0.0 --init    # First deploy (init swarm)"
            echo "  ./deploy.sh -v 1.0.0 --update  # Update deployment"
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

# Check if docker is available and determine if sudo is needed
DOCKER_CMD="docker"
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check if we need sudo for docker
    if ! docker info > /dev/null 2>&1; then
        if sudo docker info > /dev/null 2>&1; then
            DOCKER_CMD="sudo docker"
            log_info "Using sudo for docker commands"
        else
            log_error "Cannot connect to Docker daemon. Is Docker running?"
            exit 1
        fi
    fi
}

# Check if swarm is initialized
check_swarm() {
    if ! $DOCKER_CMD info --format '{{.Swarm.LocalNodeState}}' | grep -q "active"; then
        if [ "$INIT_MODE" = true ]; then
            log_info "Initializing Docker Swarm..."
            $DOCKER_CMD swarm init
        else
            log_error "Docker Swarm is not initialized. Run with --init flag or run 'docker swarm init'"
            exit 1
        fi
    fi
}

# Load environment file
load_env() {
    local env_path="$SCRIPT_DIR/$ENV_FILE"
    if [ -f "$env_path" ]; then
        log_info "Loading environment from $env_path"
        export $(grep -v '^#' "$env_path" | grep -v '^\s*$' | xargs)
    else
        log_error "Environment file not found: $env_path"
        log_info "Copy .env.example to .env and configure it first:"
        log_info "  cp .env.example .env"
        exit 1
    fi
    export GATRIX_VERSION="$VERSION"
}

# Validate required environment variables
validate_env() {
    local required_vars=("DB_HOST" "DB_USER" "DB_PASSWORD" "REDIS_HOST" "EDGE_REDIS_HOST")
    local has_error=false

    for var in "${required_vars[@]}"; do
        local val="${!var}"
        if [ -z "$val" ] || [[ "$val" == your-* ]]; then
            log_error "Required variable '$var' is not set or still has placeholder value in .env"
            has_error=true
        fi
    done

    if [ "$has_error" = true ]; then
        exit 1
    fi
    log_success "Environment variables validated"
}

# Generate file hash for config rotation
get_file_hash() {
    local file=$1
    if [ -f "$file" ]; then
        if command -v md5sum >/dev/null 2>&1; then
            md5sum "$file" | awk '{print $1}' | cut -c1-8
        elif command -v shasum >/dev/null 2>&1; then
            shasum "$file" | awk '{print $1}' | cut -c1-8
        elif command -v md5 >/dev/null 2>&1; then
            md5 -q "$file" | cut -c1-8
        else
            date +%s
        fi
    else
        echo "default"
    fi
}

# Setup config Hashes
setup_config_hashes() {
    export PROM_CONFIG_ID=$(get_file_hash "$SCRIPT_DIR/config/prometheus.yml")
    export GRAFANA_DS_ID=$(get_file_hash "$SCRIPT_DIR/config/grafana/provisioning/datasources/datasource.yml")
    export GRAFANA_DB_ID=$(get_file_hash "$SCRIPT_DIR/config/grafana/provisioning/dashboards/dashboards.yml")
    export NGINX_CONFIG_ID=$(get_file_hash "$SCRIPT_DIR/config/nginx.conf")
    log_info "Config hashes generated for dynamic rotation"
}

# Create Docker secrets
create_secrets() {
    log_info "Creating Docker secrets..."
    
    local secrets=(
        "jwt_secret:${JWT_SECRET:-your-super-secret-jwt-key}"
        "jwt_refresh_secret:${JWT_REFRESH_SECRET:-your-super-secret-refresh-key}"
        "session_secret:${SESSION_SECRET:-your-super-secret-session-key}"
        "api_secret:${GATRIX_API_SECRET:-shared-secret-between-servers}"
        "edge_api_token:${EDGE_API_TOKEN:-gatrix-unsecured-server-api-token}"
        "grafana_password:${GRAFANA_ADMIN_PASSWORD:-admin}"
    )
    
    for secret_pair in "${secrets[@]}"; do
        IFS=':' read -r name value <<< "$secret_pair"
        if $DOCKER_CMD secret inspect "$name" &> /dev/null; then
            log_warn "Secret '$name' already exists, skipping..."
        else
            echo -n "$value" | $DOCKER_CMD secret create "$name" -
            log_success "Created secret: $name"
        fi
    done
}

# Login to registry
login_registry() {
    local login_script="$SCRIPT_DIR/login-registry.sh"
    if [ -f "$login_script" ]; then
        source "$login_script"
        if type login-registry &>/dev/null; then
            login-registry
        fi
    else
        log_warn "Login script not found at $login_script"
    fi
}

# Pull images
pull_images() {
    log_info "Pulling images for version: $VERSION"

    local services=("backend" "frontend" "edge")

    for service in "${services[@]}"; do
        log_info "Pulling uwocn.tencentcloudcr.com/uwocn/gatrix-${service}:${VERSION}"
        $DOCKER_CMD pull "uwocn.tencentcloudcr.com/uwocn/gatrix-${service}:${VERSION}" || {
            log_warn "Failed to pull gatrix-${service}:${VERSION}, trying latest..."
            $DOCKER_CMD pull "uwocn.tencentcloudcr.com/uwocn/gatrix-${service}:latest"
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

    $DOCKER_CMD stack deploy \
        -c docker-compose.swarm.yml \
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
        # Match "0/N" where N>0 (not ready). Skip "0/0" (intentionally scaled to 0).
        if $DOCKER_CMD stack services "$STACK_NAME" --format '{{.Replicas}}' | grep -qE '0/[1-9]'; then
            sleep 10
            elapsed=$((elapsed + 10))
            printf "."
        else
            echo ""
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
        $DOCKER_CMD image prune -f
    fi
}

# Show status
show_status() {
    echo ""
    log_info "Stack Status:"
    $DOCKER_CMD stack services "$STACK_NAME"
    echo ""
    log_info "Service Replicas:"
    $DOCKER_CMD stack ps "$STACK_NAME" --filter "desired-state=running"
}

# Main
main() {
    echo "========================================"
    echo "   Gatrix Swarm Deployment"
    echo "   (Cloud Infra Edition)"
    echo "========================================"
    echo ""

    check_docker
    check_swarm
    load_env
    validate_env
    setup_config_hashes

    create_secrets

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
    echo "  - Frontend (Admin UI): http://localhost:${FRONTEND_PORT:-43000}"
    echo "  - Backend API:         http://localhost:${BACKEND_PORT:-45000}/health"
    echo "  - Edge server:         http://localhost:3400/health"
    echo "  - Grafana:             http://localhost:${GRAFANA_PORT:-3000}"
    echo "  - Prometheus:          http://localhost:${PROMETHEUS_PORT:-9090}"
    echo ""
    echo "Run ./health-check.sh for full service verification."
}

main
