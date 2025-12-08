#!/bin/bash
#
# Gatrix Swarm Scaling Script
#
# Usage:
#   ./scale.sh [options]
#
# Options:
#   -s, --stack <name>        Stack name (default: gatrix)
#   --service <name>          Service to scale
#   --replicas <n>            Number of replicas
#   --preset <name>           Use scaling preset (minimal, standard, high)
#   --status                  Show current scaling status
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
REPLICAS=""
PRESET=""
SHOW_STATUS=false

# Scalable services
SCALABLE_SERVICES=("backend" "frontend" "event-lens" "event-lens-worker" "chat-server" "edge")

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
        --replicas)
            REPLICAS="$2"
            shift 2
            ;;
        --preset)
            PRESET="$2"
            shift 2
            ;;
        --status)
            SHOW_STATUS=true
            shift
            ;;
        -h|--help)
            echo "Gatrix Swarm Scaling Script"
            echo ""
            echo "Usage: ./scale.sh [options]"
            echo ""
            echo "Options:"
            echo "  -s, --stack <name>        Stack name (default: gatrix)"
            echo "  --service <name>          Service to scale"
            echo "  --replicas <n>            Number of replicas"
            echo "  --preset <name>           Use scaling preset (minimal, standard, high)"
            echo "  --status                  Show current scaling status"
            echo "  -h, --help                Show help"
            echo ""
            echo "Presets:"
            echo "  minimal   - 1 replica for each service (development/testing)"
            echo "  standard  - 2 replicas for critical services (production)"
            echo "  high      - 4+ replicas for high traffic (peak hours)"
            echo ""
            echo "Scalable services: ${SCALABLE_SERVICES[*]}"
            echo ""
            echo "Examples:"
            echo "  ./scale.sh --service backend --replicas 4"
            echo "  ./scale.sh --preset high"
            echo "  ./scale.sh --status"
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

# Scale a service
scale_service() {
    local service="$1"
    local replicas="$2"
    local full_service_name="${STACK_NAME}_${service}"
    
    if docker service inspect "$full_service_name" &> /dev/null; then
        log_info "Scaling $service to $replicas replicas..."
        docker service scale "$full_service_name=$replicas"
        log_success "Scaled $service to $replicas replicas"
    else
        log_warn "Service not found: $full_service_name"
    fi
}

# Apply preset
apply_preset() {
    local preset="$1"
    
    case $preset in
        minimal)
            log_info "Applying minimal preset..."
            scale_service "backend" 1
            scale_service "frontend" 1
            scale_service "event-lens" 1
            scale_service "event-lens-worker" 1
            scale_service "chat-server" 1
            scale_service "edge" 1
            ;;
        standard)
            log_info "Applying standard preset..."
            scale_service "backend" 2
            scale_service "frontend" 2
            scale_service "event-lens" 1
            scale_service "event-lens-worker" 2
            scale_service "chat-server" 2
            scale_service "edge" 2
            ;;
        high)
            log_info "Applying high traffic preset..."
            scale_service "backend" 4
            scale_service "frontend" 4
            scale_service "event-lens" 2
            scale_service "event-lens-worker" 4
            scale_service "chat-server" 4
            scale_service "edge" 4
            ;;
        *)
            log_error "Unknown preset: $preset"
            exit 1
            ;;
    esac
}

# Show status
show_status() {
    echo ""
    log_info "Current scaling status for stack: $STACK_NAME"
    echo ""
    docker stack services "$STACK_NAME" --format "table {{.Name}}\t{{.Mode}}\t{{.Replicas}}\t{{.Image}}"
}

# Main
main() {
    echo "========================================"
    echo "   Gatrix Swarm Scaling"
    echo "========================================"
    echo ""

    if [ "$SHOW_STATUS" = true ]; then
        show_status
        exit 0
    fi

    if [ -n "$PRESET" ]; then
        apply_preset "$PRESET"
    elif [ -n "$SERVICE_NAME" ] && [ -n "$REPLICAS" ]; then
        scale_service "$SERVICE_NAME" "$REPLICAS"
    else
        log_error "Please specify --service and --replicas, --preset, or --status"
        exit 1
    fi

    echo ""
    show_status

    echo ""
    log_success "Scaling completed!"
}

main

