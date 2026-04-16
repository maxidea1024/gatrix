#!/usr/bin/env bash
# Gatrix ECS Teardown Script
set -euo pipefail
PREFIX="gatrix"; SECRETS=false; LOGS=false; YES=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
while [[ $# -gt 0 ]]; do
    case "$1" in -p|--prefix) PREFIX="$2"; shift 2 ;; --secrets) SECRETS=true; shift ;;
        --logs) LOGS=true; shift ;; --all) SECRETS=true; LOGS=true; shift ;;
        -y|--yes) YES=true; shift ;; -h|--help) echo "Usage: ./teardown.sh [--all] [-y]"; exit 0 ;;
        *) echo "[ERROR] Unknown: $1"; exit 1 ;; esac; done
[[ -f "$SCRIPT_DIR/.env" ]] && set -a && source <(grep -v '^\s*#' "$SCRIPT_DIR/.env" | grep -v '^\s*$') && set +a
REGION="${AWS_REGION:-ap-northeast-2}"
info() { echo -e "\033[34m[INFO]\033[0m $1"; }
success() { echo -e "\033[32m[SUCCESS]\033[0m $1"; }
warn() { echo -e "\033[33m[WARN]\033[0m $1"; }
echo "========================================"; echo "   Gatrix ECS Teardown"; echo "========================================"; echo ""
if [[ "$YES" != "true" ]]; then
    echo -e "\033[31mWARNING: This will DELETE all CloudFormation stacks.\033[0m"
    read -p "Are you sure? (y/N) " confirm
    [[ "$confirm" != "y" && "$confirm" != "Y" ]] && { echo "Cancelled."; exit 0; }
fi
for stack in s3-cdn monitoring ecs-services task-defs database service-discovery ecs-cluster alb sg vpc; do
    fn="$PREFIX-$stack"
    if aws cloudformation describe-stacks --stack-name "$fn" --region "$REGION" &>/dev/null; then
        info "Deleting: $fn..."
        aws cloudformation delete-stack --stack-name "$fn" --region "$REGION"
        aws cloudformation wait stack-delete-complete --stack-name "$fn" --region "$REGION"
        success "Deleted: $fn"
    else warn "Not found: $fn"; fi
done
[[ "$SECRETS" == "true" ]] && for s in jwt-secret jwt-refresh-secret session-secret; do
    aws secretsmanager delete-secret --secret-id "$PREFIX/$s" --force-delete-without-recovery --region "$REGION" 2>/dev/null && success "Deleted secret: $PREFIX/$s" || warn "Secret not found: $PREFIX/$s"
done
[[ "$LOGS" == "true" ]] && for svc in backend frontend edge prometheus grafana; do
    aws logs delete-log-group --log-group-name "/ecs/$PREFIX-$svc" --region "$REGION" 2>/dev/null && success "Deleted logs: /ecs/$PREFIX-$svc" || warn "Log group not found"
done
success "Teardown completed!"
