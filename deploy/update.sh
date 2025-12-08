#!/bin/bash
#
# Gatrix Swarm Update Script (Rolling Update)
#
# Usage:
#   ./update.sh [options]
#
# Options:
#   -s, --stack <name>        Stack name (default: gatrix)
#   -v, --version <version>   Version to update to (required)
#   --service <name>          Update specific service only
#   --all                     Update all application services
#   --force                   Force update even with same image
#   -h, --help                Show help

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default values
STACK_NAME="gatrix"
VERSION=""
SERVICE_NAME=""
UPDATE_ALL=false
FORCE_UPDATE=false

# Services that can be updated
UPDATE_SERVICES=("backend" "frontend" "event-lens" "event-lens-worker" "chat-server" "edge")

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--stack)
            STACK_NAME="$2"
            shift 2
            ;;
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        --service)
            SERVICE_NAME="$2"
            shift 2
            ;;
        --all)
            UPDATE_ALL=true
            shift
            ;;
        --force)
            FORCE_UPDATE=true
            shift
            ;;
        -h|--help)
            echo "Gatrix Swarm Update Script"
            echo ""
            echo "Usage: ./update.sh [options]"
            echo ""
            echo "Options:"
            echo "  -s, --stack <name>        Stack name (default: gatrix)"
            echo "  -v, --version <version>   Version to update to (required)"
            echo "  --service <name>          Update specific service only"
            echo "  --all                     Update all application services"
            echo "  --force                   Force update even with same image"
            echo "  -h, --help                Show help"
            echo ""
            echo "Examples:"
            echo "  ./update.sh --version 1.2.0 --all"
            echo "  ./update.sh --version 1.2.0 --service backend"
            echo "  ./update.sh --version 1.2.0 --service frontend --force"
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

# Update a service
update_service() {
    local service="$1"
    local version="$2"
    local full_service_name="${STACK_NAME}_${service}"
    
    # Map service name to image name
    local image_service="$service"
    if [ "$service" = "event-lens-worker" ]; then
        image_service="event-lens"
    fi
    
    local new_image="uwocn.tencentcloudcr.com/uwocn/uwocn:${image_service}-${version}"
    
    if docker service inspect "$full_service_name" &> /dev/null; then
        log_info "Updating $service to version $version..."
        log_info "New image: $new_image"
        
        if [ "$FORCE_UPDATE" = true ]; then
            docker service update --image "$new_image" --force "$full_service_name"
        else
            docker service update --image "$new_image" "$full_service_name"
        fi
        
        log_success "Update initiated for: $service"
    else
        log_warn "Service not found: $full_service_name"
    fi
}

# Watch update progress
watch_update() {
    local service="$1"
    local full_service_name="${STACK_NAME}_${service}"
    
    log_info "Watching update progress for $service..."
    docker service ps "$full_service_name" --format "table {{.Name}}\t{{.Image}}\t{{.CurrentState}}\t{{.Error}}"
}

# Main
main() {
    echo "========================================"
    echo "   Gatrix Swarm Rolling Update"
    echo "========================================"
    echo ""
    
    if [ -z "$VERSION" ]; then
        log_error "Version is required. Use --version <version>"
        exit 1
    fi
    
    log_info "Target version: $VERSION"
    echo ""
    
    if [ -n "$SERVICE_NAME" ]; then
        update_service "$SERVICE_NAME" "$VERSION"
        sleep 5
        watch_update "$SERVICE_NAME"
    elif [ "$UPDATE_ALL" = true ]; then
        log_info "Updating all application services..."
        for service in "${UPDATE_SERVICES[@]}"; do
            update_service "$service" "$VERSION"
            sleep 2
        done
    else
        log_error "Please specify --service <name> or --all"
        exit 1
    fi
    
    echo ""
    log_info "Service status after update:"
    docker stack services "$STACK_NAME"
    
    echo ""
    log_success "Update initiated! Use 'docker service ps <service>' to monitor progress."
}

main

