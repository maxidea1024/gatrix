#!/usr/bin/env bash
# Gatrix ECS Scaling Script
set -euo pipefail
SERVICE="" ; REPLICAS=0 ; PRESET="" ; STATUS=false ; NO_PERSIST=false ; PREFIX="gatrix"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
while [[ $# -gt 0 ]]; do
    case "$1" in
        -s|--service) SERVICE="$2"; shift 2 ;; -r|--replicas) REPLICAS="$2"; shift 2 ;;
        --preset) PRESET="$2"; shift 2 ;; --no-persist) NO_PERSIST=true; shift ;;
        --status) STATUS=true; shift ;; -p|--prefix) PREFIX="$2"; shift 2 ;;
        -h|--help) echo "Usage: ./scale.sh [-s <svc> -r <n>|--preset <name>|--status]"; exit 0 ;;
        *) echo "[ERROR] Unknown: $1"; exit 1 ;; esac; done
[[ -f "$SCRIPT_DIR/.env" ]] && set -a && source <(grep -v '^\s*#' "$SCRIPT_DIR/.env" | grep -v '^\s*$') && set +a
REGION="${AWS_REGION:-ap-northeast-2}"; CLUSTER="$PREFIX-cluster"
info() { echo -e "\033[34m[INFO]\033[0m $1"; }
success() { echo -e "\033[32m[SUCCESS]\033[0m $1"; }
scale_svc() {
    local svc="$1" count="$2"
    info "Scaling $svc to $count tasks..."
    aws ecs update-service --cluster "$CLUSTER" --service "$PREFIX-$svc" --desired-count "$count" --region "$REGION" >/dev/null
    success "Scaled $svc to $count"
    if [[ "$NO_PERSIST" == "false" ]]; then
        local var=$(echo "${svc^^}_REPLICAS")
        [[ -f "$SCRIPT_DIR/.env" ]] && sed -i "s/^${var}=.*/${var}=${count}/" "$SCRIPT_DIR/.env" && success "Saved: ${var}=${count}"
    fi
}
show_status() {
    info "Current status:"
    for svc in backend frontend edge; do
        local info_json=$(aws ecs describe-services --cluster "$CLUSTER" --services "$PREFIX-$svc" --region "$REGION" --query "services[0].{R:runningCount,D:desiredCount}" --output json 2>/dev/null)
        local r=$(echo "$info_json" | jq -r '.R') d=$(echo "$info_json" | jq -r '.D')
        [[ "$r" == "$d" ]] && echo -e "  \033[32m$svc: $r/$d\033[0m" || echo -e "  \033[33m$svc: $r/$d\033[0m"
    done
}
[[ "$STATUS" == "true" ]] && { show_status; exit 0; }
if [[ -n "$PRESET" ]]; then
    case "$PRESET" in
        minimal) scale_svc backend 1; scale_svc frontend 1; scale_svc edge 1 ;;
        standard) scale_svc backend 2; scale_svc frontend 1; scale_svc edge 2 ;;
        high) scale_svc backend 4; scale_svc frontend 2; scale_svc edge 8 ;;
        *) echo "[ERROR] Unknown preset: $PRESET"; exit 1 ;; esac
elif [[ -n "$SERVICE" && "$REPLICAS" -gt 0 ]]; then scale_svc "$SERVICE" "$REPLICAS"
else echo "[ERROR] Specify --service+--replicas, --preset, or --status"; exit 1; fi
show_status; success "Scaling completed!"
