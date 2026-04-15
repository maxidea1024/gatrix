#!/bin/bash
#
# Gatrix Post-Deploy Health Check Script
# Verifies that all services are running and responding correctly.
#
# Usage:
#   ./health-check.sh [options]
#
# Options:
#   -s, --stack <name>        Stack name (default: gatrix)
#   --timeout <seconds>       Max wait time for services (default: 120)
#   -h, --help                Show help

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

STACK_NAME="gatrix"
TIMEOUT=120

while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--stack) STACK_NAME="$2"; shift 2 ;;
        --timeout) TIMEOUT="$2"; shift 2 ;;
        -h|--help)
            echo "Gatrix Post-Deploy Health Check Script"
            echo ""
            echo "Usage: ./health-check.sh [options]"
            echo ""
            echo "Options:"
            echo "  -s, --stack <name>        Stack name (default: gatrix)"
            echo "  --timeout <seconds>       Max wait for services (default: 120)"
            echo "  -h, --help                Show help"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; }

PASS_COUNT=0
FAIL_COUNT=0

check_pass() { ((PASS_COUNT++)); log_success "$1"; }
check_fail() { ((FAIL_COUNT++)); log_fail "$1"; }

echo "========================================"
echo "   Gatrix Post-Deploy Health Check"
echo "========================================"
echo ""

# ==========================================
# 1. Check stack exists
# ==========================================
log_info "Checking stack: $STACK_NAME..."
if docker stack ls | grep -q "$STACK_NAME"; then
    check_pass "Stack '$STACK_NAME' exists"
else
    check_fail "Stack '$STACK_NAME' not found"
    echo ""
    log_fail "Stack not deployed. Run ./deploy.sh first."
    exit 1
fi

# ==========================================
# 2. Wait for replicas to be ready
# ==========================================
log_info "Waiting for all services to reach desired replicas (timeout: ${TIMEOUT}s)..."
elapsed=0
while [ $elapsed -lt $TIMEOUT ]; do
    not_ready=$(docker stack services "$STACK_NAME" --format '{{.Replicas}}' | grep "0/" || true)
    if [ -z "$not_ready" ]; then
        check_pass "All services have running replicas"
        break
    fi
    sleep 5
    elapsed=$((elapsed + 5))
    printf "."
done
echo ""

if [ $elapsed -ge $TIMEOUT ]; then
    check_fail "Timeout waiting for services to be ready"
fi

# ==========================================
# 3. Check individual service status
# ==========================================
log_info "Checking individual service health..."
echo ""

services=$(docker stack services "$STACK_NAME" --format "{{.Name}}|{{.Replicas}}")
for svc_info in $services; do
    name=$(echo "$svc_info" | cut -d'|' -f1)
    replicas=$(echo "$svc_info" | cut -d'|' -f2)
    desired=$(echo "$replicas" | cut -d'/' -f2)
    running=$(echo "$replicas" | cut -d'/' -f1)

    if [ "$running" = "$desired" ] && [ "$desired" != "0" ]; then
        check_pass "$name ($replicas)"
    elif [ "$running" -gt 0 ] 2>/dev/null; then
        log_warn "$name ($replicas) - partial"
        ((FAIL_COUNT++))
    else
        check_fail "$name ($replicas) - no running tasks"
    fi
done

# ==========================================
# 4. HTTP endpoint checks (direct service ports)
# ==========================================
echo ""
log_info "Checking HTTP endpoints (direct ports)..."

# Load env for port overrides
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR/.env" | grep -v '^\s*$' | xargs) 2>/dev/null || true
fi
BACKEND_PORT="${BACKEND_PORT:-45000}"
FRONTEND_PORT="${FRONTEND_PORT:-43000}"
HTTP_PORT="${HTTP_PORT:-80}"

# Check backend API
if curl -sf "http://localhost:${BACKEND_PORT}/health" -o /dev/null --max-time 10 2>/dev/null; then
    check_pass "Backend API (http://localhost:${BACKEND_PORT}/health)"
else
    check_fail "Backend API (http://localhost:${BACKEND_PORT}/health)"
fi

# Check frontend
if curl -sf "http://localhost:${FRONTEND_PORT}/health" -o /dev/null --max-time 5 2>/dev/null; then
    check_pass "Frontend (http://localhost:${FRONTEND_PORT}/health)"
else
    check_fail "Frontend (http://localhost:${FRONTEND_PORT}/health)"
fi

# Check edge server (Cloud LB target)
if curl -sf "http://localhost:3400/health" -o /dev/null --max-time 5 2>/dev/null; then
    check_pass "Edge server (http://localhost:3400/health)"
else
    check_fail "Edge server (http://localhost:3400/health)"
fi

# Check nginx (optional, only if NGINX_REPLICAS > 0)
NGINX_REPLICAS="${NGINX_REPLICAS:-0}"
if [ "$NGINX_REPLICAS" -gt 0 ] 2>/dev/null; then
    if curl -sf "http://localhost:${HTTP_PORT}/health" -o /dev/null --max-time 5 2>/dev/null; then
        check_pass "Nginx gateway (http://localhost:${HTTP_PORT}/health)"
    else
        check_fail "Nginx gateway (http://localhost:${HTTP_PORT}/health)"
    fi
fi

# ==========================================
# 5. Summary
# ==========================================
echo ""
echo "========================================"
TOTAL=$((PASS_COUNT + FAIL_COUNT))
echo "   Results: $PASS_COUNT/$TOTAL passed"
echo "========================================"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    log_success "All health checks passed!"
    exit 0
else
    log_fail "$FAIL_COUNT check(s) failed"
    echo ""
    echo "Troubleshooting:"
    echo "  ./status.sh --health           # Check service health"
    echo "  ./status.sh --logs backend     # Check backend logs"
    echo "  docker service ps ${STACK_NAME}_backend  # Check task status"
    exit 1
fi
