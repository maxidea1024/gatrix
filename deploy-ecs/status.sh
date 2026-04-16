#!/usr/bin/env bash
# Gatrix ECS Status Script
set -euo pipefail
PREFIX="gatrix"; LOGS=""; HEALTH=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
while [[ $# -gt 0 ]]; do
    case "$1" in
        -p|--prefix) PREFIX="$2"; shift 2 ;; -l|--logs) LOGS="$2"; shift 2 ;;
        --health) HEALTH=true; shift ;; -h|--help) echo "Usage: ./status.sh [-l <svc>|--health]"; exit 0 ;;
        *) echo "[ERROR] Unknown: $1"; exit 1 ;; esac; done
[[ -f "$SCRIPT_DIR/.env" ]] && set -a && source <(grep -v '^\s*#' "$SCRIPT_DIR/.env" | grep -v '^\s*$') && set +a
REGION="${AWS_REGION:-ap-northeast-2}"; CLUSTER="$PREFIX-cluster"
if [[ -n "$LOGS" ]]; then
    echo "[INFO] Tailing logs: /ecs/$PREFIX-$LOGS"
    aws logs tail "/ecs/$PREFIX-$LOGS" --region "$REGION" --follow --since 5m
elif [[ "$HEALTH" == "true" ]]; then
    echo "[INFO] Health Status:"
    for svc in backend frontend edge; do
        info=$(aws ecs describe-services --cluster "$CLUSTER" --services "$PREFIX-$svc" --region "$REGION" --query "services[0].{R:runningCount,D:desiredCount}" --output json 2>/dev/null)
        r=$(echo "$info" | jq -r '.R'); d=$(echo "$info" | jq -r '.D')
        [[ "$r" == "$d" && "$d" != "0" ]] && echo -e "  \033[32mOK   $svc ($r/$d)\033[0m" || echo -e "  \033[31mFAIL $svc ($r/$d)\033[0m"
    done
else
    echo "[INFO] ECS Services in cluster: $CLUSTER"
    for svc in backend frontend edge prometheus grafana; do
        info=$(aws ecs describe-services --cluster "$CLUSTER" --services "$PREFIX-$svc" --region "$REGION" --query "services[0].{S:status,R:runningCount,D:desiredCount}" --output json 2>/dev/null)
        s=$(echo "$info" | jq -r '.S'); r=$(echo "$info" | jq -r '.R'); d=$(echo "$info" | jq -r '.D')
        [[ "$s" != "null" ]] && echo "  $svc: $r/$d [$s]"
    done
fi
