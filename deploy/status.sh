#!/bin/bash
#
# Gatrix Swarm Status Script
#
# Usage:
#   ./status.sh [options]
#
# Options:
#   -s, --stack <name>        Stack name (default: gatrix)
#   --services                Show service list
#   --tasks                   Show running tasks
#   --logs <service>          Show logs for a service
#   --health                  Show health status
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
SHOW_SERVICES=false
SHOW_TASKS=false
SHOW_LOGS=""
SHOW_HEALTH=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--stack)
            STACK_NAME="$2"
            shift 2
            ;;
        --services)
            SHOW_SERVICES=true
            shift
            ;;
        --tasks)
            SHOW_TASKS=true
            shift
            ;;
        --logs)
            SHOW_LOGS="$2"
            shift 2
            ;;
        --health)
            SHOW_HEALTH=true
            shift
            ;;
        -h|--help)
            echo "Gatrix Swarm Status Script"
            echo ""
            echo "Usage: ./status.sh [options]"
            echo ""
            echo "Options:"
            echo "  -s, --stack <name>        Stack name (default: gatrix)"
            echo "  --services                Show service list"
            echo "  --tasks                   Show running tasks"
            echo "  --logs <service>          Show logs for a service"
            echo "  --health                  Show health status"
            echo "  -h, --help                Show help"
            echo ""
            echo "Examples:"
            echo "  ./status.sh                     # Show all status"
            echo "  ./status.sh --services          # Show services only"
            echo "  ./status.sh --logs backend      # Show backend logs"
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

# Show services
show_services() {
    echo ""
    log_info "Services in stack: $STACK_NAME"
    echo ""
    docker stack services "$STACK_NAME" --format "table {{.Name}}\t{{.Mode}}\t{{.Replicas}}\t{{.Image}}\t{{.Ports}}"
}

# Show tasks
show_tasks() {
    echo ""
    log_info "Running tasks in stack: $STACK_NAME"
    echo ""
    docker stack ps "$STACK_NAME" --filter "desired-state=running" --format "table {{.Name}}\t{{.Image}}\t{{.Node}}\t{{.CurrentState}}"
}

# Show logs
show_logs() {
    local service="$1"
    local full_service_name="${STACK_NAME}_${service}"
    
    log_info "Logs for service: $full_service_name"
    docker service logs "$full_service_name" --tail 100 --follow
}

# Show health
show_health() {
    echo ""
    log_info "Health Status"
    echo ""
    
    local services=$(docker stack services "$STACK_NAME" --format "{{.Name}}")
    
    for service in $services; do
        local replicas=$(docker service inspect "$service" --format '{{.Spec.Mode.Replicated.Replicas}}')
        local running=$(docker service ps "$service" --filter "desired-state=running" --format "{{.ID}}" | wc -l)
        
        if [ "$running" -eq "$replicas" ] 2>/dev/null; then
            echo -e "  ${GREEN}✓${NC} $service ($running/$replicas)"
        elif [ "$running" -gt 0 ] 2>/dev/null; then
            echo -e "  ${YELLOW}○${NC} $service ($running/$replicas)"
        else
            echo -e "  ${RED}✗${NC} $service ($running/$replicas)"
        fi
    done
}

# Show all
show_all() {
    show_services
    show_tasks
    show_health
}

# Main
main() {
    echo "========================================"
    echo "   Gatrix Swarm Status"
    echo "========================================"
    
    if [ -n "$SHOW_LOGS" ]; then
        show_logs "$SHOW_LOGS"
    elif [ "$SHOW_SERVICES" = true ]; then
        show_services
    elif [ "$SHOW_TASKS" = true ]; then
        show_tasks
    elif [ "$SHOW_HEALTH" = true ]; then
        show_health
    else
        show_all
    fi
}

main

