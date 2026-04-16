#!/usr/bin/env bash
# Gatrix ECS Rollback Script
set -euo pipefail
SERVICE="" ; ALL=false ; PREFIX="gatrix"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
while [[ $# -gt 0 ]]; do
    case "$1" in
        -s|--service) SERVICE="$2"; shift 2 ;; -a|--all) ALL=true; shift ;;
        -p|--prefix) PREFIX="$2"; shift 2 ;; -h|--help) echo "Usage: ./rollback.sh [-s <svc>|-a]"; exit 0 ;;
        *) echo "[ERROR] Unknown: $1"; exit 1 ;; esac; done
[[ -f "$SCRIPT_DIR/.env" ]] && set -a && source <(grep -v '^\s*#' "$SCRIPT_DIR/.env" | grep -v '^\s*$') && set +a
REGION="${AWS_REGION:-ap-northeast-2}"; CLUSTER="$PREFIX-cluster"
info() { echo -e "\033[34m[INFO]\033[0m $1"; }
success() { echo -e "\033[32m[SUCCESS]\033[0m $1"; }
rollback_svc() {
    local svc="$1" ecs_svc="$PREFIX-$1"
    local cur=$(aws ecs describe-services --cluster "$CLUSTER" --services "$ecs_svc" --region "$REGION" --query "services[0].taskDefinition" --output text)
    local rev=$(echo "$cur" | rev | cut -d: -f1 | rev)
    [[ "$rev" -le 1 ]] && { echo "[WARN] No previous revision for $svc"; return; }
    local prev=$((rev-1)) family="$PREFIX-$svc"
    info "Rolling back $svc: rev $rev -> $prev"
    aws ecs update-service --cluster "$CLUSTER" --service "$ecs_svc" --task-definition "$family:$prev" --region "$REGION" >/dev/null
    success "Rollback initiated: $svc"
}
if [[ -n "$SERVICE" ]]; then rollback_svc "$SERVICE"
elif [[ "$ALL" == "true" ]]; then for s in backend frontend edge; do rollback_svc "$s"; done
else echo "[ERROR] Specify --service or --all"; exit 1; fi
success "Rollback completed!"
