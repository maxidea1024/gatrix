#!/bin/bash
#
# Gatrix Swarm Rollback Script
#
# Usage:
#   ./rollback.sh [options]
#
# Options:
#   -s, --stack <name>        Stack name (default: gatrix)
#   --service <name>          Rollback specific service only
#   --all                     Rollback all services
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
SERVICE_NAME=""
ROLLBACK_ALL=false

# Services that can be rolled back
ROLLBACK_SERVICES=("backend" "frontend" "event-lens" "event-lens-worker" "chat-server" "edge")

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--stack)
            STACK_NAME="$2"
            shift 2
            ;;
        --service)
            SERVICE_NAME="$2"
            shift 2
            ;;
        --all)
            ROLLBACK_ALL=true
            shift
            ;;
        -h|--help)
            echo "Gatrix Swarm Rollback Script"
            echo ""
            echo "Usage: ./rollback.sh [options]"
            echo ""
            echo "Options:"
            echo "  -s, --stack <name>        Stack name (default: gatrix)"
            echo "  --service <name>          Rollback specific service only"
            echo "  --all                     Rollback all application services"
            echo "  -h, --help                Show help"
            echo ""
            echo "Services: ${ROLLBACK_SERVICES[*]}"
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

# Rollback a single service
rollback_service() {
    local service="$1"
    local full_service_name="${STACK_NAME}_${service}"
    
    log_info "Rolling back service: $full_service_name"
    
    if docker service inspect "$full_service_name" &> /dev/null; then
        docker service rollback "$full_service_name"
        log_success "Rollback initiated for: $full_service_name"
    else
        log_warn "Service not found: $full_service_name"
    fi
}

# Show current versions
show_versions() {
    echo ""
    log_info "Current service versions:"
    
    for service in "${ROLLBACK_SERVICES[@]}"; do
        local full_name="${STACK_NAME}_${service}"
        if docker service inspect "$full_name" &> /dev/null; then
            local image=$(docker service inspect "$full_name" --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}')
            echo "  $service: $image"
        fi
    done
    echo ""
}

# Main
main() {
    echo "========================================"
    echo "   Gatrix Swarm Rollback"
    echo "========================================"
    echo ""
    
    show_versions
    
    if [ -n "$SERVICE_NAME" ]; then
        # Rollback specific service
        rollback_service "$SERVICE_NAME"
    elif [ "$ROLLBACK_ALL" = true ]; then
        # Rollback all services
        log_info "Rolling back all application services..."
        for service in "${ROLLBACK_SERVICES[@]}"; do
            rollback_service "$service"
        done
    else
        log_error "Please specify --service <name> or --all"
        echo ""
        echo "Available services: ${ROLLBACK_SERVICES[*]}"
        exit 1
    fi
    
    echo ""
    log_info "Waiting for rollback to complete..."
    sleep 10
    
    echo ""
    log_info "Service status after rollback:"
    docker stack services "$STACK_NAME"
    
    echo ""
    log_success "Rollback completed!"
}

main

