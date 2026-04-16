#!/usr/bin/env bash
# Gatrix Build and Push Script (ECR Edition)
set -euo pipefail
TAG="latest"; PUSH=false; TAG_LATEST=false; SERVICES=()
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
while [[ $# -gt 0 ]]; do
    case "$1" in -t|--tag) TAG="$2"; shift 2 ;; -p|--push) PUSH=true; shift ;;
        -l|--latest) TAG_LATEST=true; shift ;; -s|--service) SERVICES+=("$2"); shift 2 ;;
        -h|--help) echo "Usage: ./build-and-push.sh [-t <tag>] [-p] [-l] [-s <svc>]"; exit 0 ;;
        *) echo "[ERROR] Unknown: $1"; exit 1 ;; esac; done
[[ -f "$SCRIPT_DIR/.env" ]] && set -a && source <(grep -v '^\s*#' "$SCRIPT_DIR/.env" | grep -v '^\s*$') && set +a
REGION="${AWS_REGION:-ap-northeast-2}"
ACCOUNT="${AWS_ACCOUNT_ID:?AWS_ACCOUNT_ID required}"
REGISTRY="$ACCOUNT.dkr.ecr.$REGION.amazonaws.com"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
declare -A ALL_SVCS=([backend]="packages/backend/Dockerfile" [frontend]="packages/frontend/Dockerfile" [edge]="packages/edge/Dockerfile")
[[ ${#SERVICES[@]} -eq 0 ]] && SERVICES=(backend frontend edge)
[[ "$PUSH" == "true" ]] && aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"
for svc in "${SERVICES[@]}"; do
    df="${ALL_SVCS[$svc]:-}"
    [[ -z "$df" ]] && { echo "[WARN] Unknown service: $svc"; continue; }
    repo="gatrix-$svc"; img="$REGISTRY/$repo:$TAG"; lat="$REGISTRY/$repo:latest"
    [[ "$PUSH" == "true" ]] && aws ecr describe-repositories --repository-names "$repo" --region "$REGION" &>/dev/null || \
        aws ecr create-repository --repository-name "$repo" --region "$REGION" --image-scanning-configuration scanOnPush=true >/dev/null 2>&1 || true
    echo -e "\033[32m[$svc] Building: $img\033[0m"
    (cd "$ROOT_DIR" && docker build -f "$df" -t "$img" --build-arg APP_VERSION="$TAG" .)
    [[ "$TAG_LATEST" == "true" && "$TAG" != "latest" ]] && docker tag "$img" "$lat"
    if [[ "$PUSH" == "true" ]]; then
        docker push "$img"; echo -e "\033[32m[$svc] Pushed $TAG\033[0m"
        [[ "$TAG_LATEST" == "true" && "$TAG" != "latest" ]] && docker push "$lat"
    fi
done
echo -e "\033[36mDone.\033[0m"
