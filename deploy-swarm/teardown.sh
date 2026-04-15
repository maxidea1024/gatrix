#!/bin/bash
#
# Gatrix Swarm Teardown Script
# Cleanly removes the entire stack and optionally cleans up volumes/secrets.
#
# Usage:
#   ./teardown.sh [options]
#
# Options:
#   -s, --stack <name>        Stack name (default: gatrix)
#   --volumes                 Also remove Docker volumes
#   --secrets                 Also remove Docker secrets
#   --all                     Remove everything (stack + volumes + secrets)
#   -y, --yes                 Skip confirmation prompt
#   -h, --help                Show help

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

STACK_NAME="gatrix"
REMOVE_VOLUMES=false
REMOVE_SECRETS=false
SKIP_CONFIRM=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--stack) STACK_NAME="$2"; shift 2 ;;
        --volumes) REMOVE_VOLUMES=true; shift ;;
        --secrets) REMOVE_SECRETS=true; shift ;;
        --all) REMOVE_VOLUMES=true; REMOVE_SECRETS=true; shift ;;
        -y|--yes) SKIP_CONFIRM=true; shift ;;
        -h|--help)
            echo "Gatrix Swarm Teardown Script"
            echo ""
            echo "Usage: ./teardown.sh [options]"
            echo ""
            echo "Options:"
            echo "  -s, --stack <name>        Stack name (default: gatrix)"
            echo "  --volumes                 Also remove Docker volumes"
            echo "  --secrets                 Also remove Docker secrets"
            echo "  --all                     Remove everything (stack + volumes + secrets)"
            echo "  -y, --yes                 Skip confirmation prompt"
            echo "  -h, --help                Show help"
            echo ""
            echo "Examples:"
            echo "  ./teardown.sh                    # Remove stack only"
            echo "  ./teardown.sh --all              # Remove everything"
            echo "  ./teardown.sh --all -y           # Remove everything without prompt"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo "========================================"
echo "   Gatrix Swarm Teardown"
echo "========================================"
echo ""

# Show what will be removed
log_info "Stack: $STACK_NAME"
log_info "Remove volumes: $REMOVE_VOLUMES"
log_info "Remove secrets: $REMOVE_SECRETS"
echo ""

# Confirmation
if [ "$SKIP_CONFIRM" != true ]; then
    echo -e "${RED}WARNING: This will remove the stack and all running services.${NC}"
    read -p "Are you sure? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 0
    fi
fi

# Remove stack
log_info "Removing stack: $STACK_NAME..."
if docker stack rm "$STACK_NAME" 2>/dev/null; then
    log_success "Stack removed: $STACK_NAME"
else
    log_warn "Stack '$STACK_NAME' not found or already removed"
fi

# Wait for services to fully stop
log_info "Waiting for services to stop..."
sleep 10

# Check if any services remain
remaining=$(docker service ls --filter "label=com.docker.stack.namespace=$STACK_NAME" -q 2>/dev/null | wc -l)
if [ "$remaining" -gt 0 ]; then
    log_warn "Some services still stopping, waiting..."
    sleep 15
fi

log_success "All services stopped"

# Remove volumes
if [ "$REMOVE_VOLUMES" = true ]; then
    log_info "Removing Docker volumes..."
    VOLUME_PREFIX="${STACK_NAME}_"
    volumes=$(docker volume ls --filter "name=$VOLUME_PREFIX" -q 2>/dev/null)
    if [ -n "$volumes" ]; then
        for vol in $volumes; do
            docker volume rm "$vol" 2>/dev/null && \
                log_success "Removed volume: $vol" || \
                log_warn "Could not remove volume: $vol (may still be in use)"
        done
    else
        log_info "No volumes found with prefix: $VOLUME_PREFIX"
    fi
fi

# Remove secrets
if [ "$REMOVE_SECRETS" = true ]; then
    log_info "Removing Docker secrets..."
    local_secrets=("jwt_secret" "jwt_refresh_secret" "session_secret" "api_secret" "edge_api_token" "grafana_password")
    for secret in "${local_secrets[@]}"; do
        if docker secret inspect "$secret" &>/dev/null; then
            docker secret rm "$secret" 2>/dev/null && \
                log_success "Removed secret: $secret" || \
                log_warn "Could not remove secret: $secret"
        fi
    done
fi

# Cleanup unused resources
log_info "Pruning unused networks..."
docker network prune -f 2>/dev/null || true

echo ""
log_success "Teardown completed!"
echo ""
echo "To verify clean state:"
echo "  docker stack ls"
echo "  docker service ls"
echo "  docker volume ls"
echo "  docker secret ls"
