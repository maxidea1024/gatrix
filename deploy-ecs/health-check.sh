#!/usr/bin/env bash
# Gatrix ECS Health Check Script
set -euo pipefail
PREFIX="gatrix"; TIMEOUT=120
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
while [[ $# -gt 0 ]]; do
    case "$1" in -p|--prefix) PREFIX="$2"; shift 2 ;; --timeout) TIMEOUT="$2"; shift 2 ;;
        -h|--help) echo "Usage: ./health-check.sh [-p <prefix>] [--timeout <s>]"; exit 0 ;;
        *) echo "[ERROR] Unknown: $1"; exit 1 ;; esac; done
[[ -f "$SCRIPT_DIR/.env" ]] && set -a && source <(grep -v '^\s*#' "$SCRIPT_DIR/.env" | grep -v '^\s*$') && set +a
REGION="${AWS_REGION:-ap-northeast-2}"; CLUSTER="$PREFIX-cluster"
PASS=0; FAIL=0
pass() { ((PASS++)); echo -e "\033[32m[PASS]\033[0m $1"; }
fail() { ((FAIL++)); echo -e "\033[31m[FAIL]\033[0m $1"; }
info() { echo -e "\033[34m[INFO]\033[0m $1"; }
echo "========================================"; echo "   Gatrix ECS Health Check"; echo "========================================"; echo ""
# 1. Check cluster
info "Checking ECS cluster: $CLUSTER..."
cs=$(aws ecs describe-clusters --clusters "$CLUSTER" --region "$REGION" --query "clusters[0].status" --output text 2>/dev/null)
[[ "$cs" == "ACTIVE" ]] && pass "Cluster active" || { fail "Cluster not found"; exit 1; }
# 2. Check services
info "Checking ECS services..."
for svc in backend frontend edge; do
    j=$(aws ecs describe-services --cluster "$CLUSTER" --services "$PREFIX-$svc" --region "$REGION" --query "services[0].{R:runningCount,D:desiredCount}" --output json 2>/dev/null)
    r=$(echo "$j" | jq -r '.R'); d=$(echo "$j" | jq -r '.D')
    [[ "$r" == "$d" && "$d" != "0" ]] && pass "$svc ($r/$d)" || fail "$svc ($r/$d)"
done
# 3. Check ALB
info "Checking ALB endpoint..."
ALB_DNS=$(aws cloudformation describe-stacks --stack-name "$PREFIX-alb" --region "$REGION" --query "Stacks[0].Outputs[?OutputKey=='ALBDnsName'].OutputValue" --output text 2>/dev/null || echo "")
if [[ -n "$ALB_DNS" ]]; then
    sc=$(curl -s -o /dev/null -w '%{http_code}' "http://$ALB_DNS/health" --max-time 10 2>/dev/null || echo "000")
    [[ "$sc" == "200" ]] && pass "Backend API (http://$ALB_DNS/health)" || fail "Backend API (HTTP $sc)"
fi
echo ""; echo "========================================"; echo "   Results: $PASS/$((PASS+FAIL)) passed"; echo "========================================"
[[ "$FAIL" -eq 0 ]] && { echo -e "\033[32m[PASS] All checks passed!\033[0m"; exit 0; } || { echo -e "\033[31m[FAIL] $FAIL check(s) failed\033[0m"; exit 1; }
