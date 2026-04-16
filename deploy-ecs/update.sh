#!/usr/bin/env bash
# Gatrix ECS Update Script (Rolling Update)
set -euo pipefail

VERSION=""
SERVICE=""
ALL=false
FORCE=false
PREFIX="gatrix"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

while [[ $# -gt 0 ]]; do
    case "$1" in
        -v|--version) VERSION="$2"; shift 2 ;;
        -s|--service) SERVICE="$2"; shift 2 ;;
        -a|--all) ALL=true; shift ;;
        -f|--force) FORCE=true; shift ;;
        -p|--prefix) PREFIX="$2"; shift 2 ;;
        -h|--help) echo "Usage: ./update.sh -v <version> [-s <service>|-a] [-f]"; exit 0 ;;
        *) echo "[ERROR] Unknown option: $1"; exit 1 ;;
    esac
done

[[ -f "$SCRIPT_DIR/.env" ]] && set -a && source <(grep -v '^\s*#' "$SCRIPT_DIR/.env" | grep -v '^\s*$') && set +a
REGION="${AWS_REGION:-ap-northeast-2}"
ACCOUNT_ID="${AWS_ACCOUNT_ID:?AWS_ACCOUNT_ID is required}"
ECR_REGISTRY="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"
CLUSTER_NAME="$PREFIX-cluster"

info()    { echo -e "\033[34m[INFO]\033[0m $1"; }
success() { echo -e "\033[32m[SUCCESS]\033[0m $1"; }

update_service() {
    local svc_name="$1" ver="$2"
    local ecs_service="$PREFIX-$svc_name"
    local new_image="$ECR_REGISTRY/gatrix-$svc_name:$ver"
    info "Updating $svc_name to $ver (image: $new_image)"

    local current_td=$(aws ecs describe-services --cluster "$CLUSTER_NAME" --services "$ecs_service" --region "$REGION" --query "services[0].taskDefinition" --output text)
    local td_json=$(aws ecs describe-task-definition --task-definition "$current_td" --region "$REGION" --query "taskDefinition" --output json)
    local family=$(echo "$td_json" | jq -r '.family')
    local cpu=$(echo "$td_json" | jq -r '.cpu')
    local memory=$(echo "$td_json" | jq -r '.memory')
    local exec_role=$(echo "$td_json" | jq -r '.executionRoleArn')
    local task_role=$(echo "$td_json" | jq -r '.taskRoleArn')
    local container_defs=$(echo "$td_json" | jq --arg img "$new_image" '.containerDefinitions | map(.image = $img)')

    local new_td_arn=$(aws ecs register-task-definition \
        --family "$family" --container-definitions "$container_defs" \
        --cpu "$cpu" --memory "$memory" --network-mode awsvpc \
        --requires-compatibilities FARGATE \
        --execution-role-arn "$exec_role" --task-role-arn "$task_role" \
        --region "$REGION" --query "taskDefinition.taskDefinitionArn" --output text)

    local force_flag=""
    [[ "$FORCE" == "true" ]] && force_flag="--force-new-deployment"
    aws ecs update-service --cluster "$CLUSTER_NAME" --service "$ecs_service" --task-definition "$new_td_arn" $force_flag --region "$REGION" >/dev/null
    success "Update initiated for: $svc_name"
}

[[ -z "$VERSION" ]] && { echo "[ERROR] Version required. Use --version <version>"; exit 1; }
info "Target version: $VERSION"

if [[ -n "$SERVICE" ]]; then update_service "$SERVICE" "$VERSION"
elif [[ "$ALL" == "true" ]]; then
    for svc in backend frontend edge; do update_service "$svc" "$VERSION"; done
else echo "[ERROR] Specify --service or --all"; exit 1; fi

info "Waiting for services to stabilize..."
for svc in ${SERVICE:-backend frontend edge}; do
    aws ecs wait services-stable --cluster "$CLUSTER_NAME" --services "$PREFIX-$svc" --region "$REGION" 2>&1
done
success "Update completed!"
