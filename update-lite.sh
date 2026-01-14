#!/bin/bash
#
# Gatrix Lite Update Script
#
# Usage:
#   ./update-lite.sh [options]
#
# Options:
#   -t, --tag <tag>           Image tag to pull (default: latest)
#   -v, --volumes             Remove volumes before starting
#   -f, --file <file>         Compose file (default: docker-compose.lite.yml)
#   -h, --help                Show help

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Default values
TAG="latest"
REMOVE_VOLUMES=false
COMPOSE_FILE="docker-compose.lite.yml"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

show_help() {
    echo "Gatrix Lite Update Script"
    echo ""
    echo "Usage: ./update-lite.sh [options]"
    echo ""
    echo "Options:"
    echo "  -t, --tag <tag>           Image tag to pull (default: latest)"
    echo "  -v, --volumes             Remove volumes before starting"
    echo "  -f, --file <file>         Compose file (default: docker-compose.lite.yml)"
    echo "  -h, --help                Show help"
    echo ""
    echo "Examples:"
    echo "  ./update-lite.sh                     # Update with latest tag"
    echo "  ./update-lite.sh -t v1.0.0           # Update with specific tag"
    echo "  ./update-lite.sh -t v1.0.0 -v        # Update and remove old volumes"
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        -v|--volumes)
            REMOVE_VOLUMES=true
            shift
            ;;
        -f|--file)
            COMPOSE_FILE="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Find compose file
if [ ! -f "$COMPOSE_FILE" ]; then
    # Try parent directory
    if [ -f "$SCRIPT_DIR/../$COMPOSE_FILE" ]; then
        COMPOSE_FILE="$SCRIPT_DIR/../$COMPOSE_FILE"
    elif [ -f "$SCRIPT_DIR/$COMPOSE_FILE" ]; then
        COMPOSE_FILE="$SCRIPT_DIR/$COMPOSE_FILE"
    else
        log_error "Compose file not found: $COMPOSE_FILE"
        exit 1
    fi
fi

echo "========================================"
echo "   Gatrix Lite Update"
echo "========================================"
echo ""
log_info "Compose file: $COMPOSE_FILE"
log_info "Image tag: $TAG"
log_info "Remove volumes: $REMOVE_VOLUMES"
echo ""

# Export tag as environment variable for compose file
export GATRIX_VERSION="$TAG"

# Check if we need sudo for docker
DOCKER_CMD="docker"
if ! docker info > /dev/null 2>&1; then
    if sudo docker info > /dev/null 2>&1; then
        DOCKER_CMD="sudo docker"
        log_info "Using sudo for docker commands"
    else
        log_error "Cannot connect to Docker daemon. Is Docker running?"
        exit 1
    fi
fi

# Stop services
log_info "Stopping services..."
if [ "$REMOVE_VOLUMES" = true ]; then
    $DOCKER_CMD compose -f "$COMPOSE_FILE" down -v
    log_success "Services stopped and volumes removed."
else
    $DOCKER_CMD compose -f "$COMPOSE_FILE" down
    log_success "Services stopped."
fi

# Pull and start
log_info "Pulling images with tag: $TAG..."
$DOCKER_CMD compose -f "$COMPOSE_FILE" pull

log_info "Starting services..."
$DOCKER_CMD compose -f "$COMPOSE_FILE" up -d

echo ""
log_success "Update completed!"
echo ""
log_info "Services status:"
$DOCKER_CMD compose -f "$COMPOSE_FILE" ps
