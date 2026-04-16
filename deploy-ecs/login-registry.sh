#!/usr/bin/env bash
# Gatrix ECR Login Script
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "$SCRIPT_DIR/.env" ]] && set -a && source <(grep -v '^\s*#' "$SCRIPT_DIR/.env" | grep -v '^\s*$') && set +a
REGION="${AWS_REGION:-ap-northeast-2}"
ACCOUNT="${AWS_ACCOUNT_ID:?AWS_ACCOUNT_ID is required}"
REGISTRY="$ACCOUNT.dkr.ecr.$REGION.amazonaws.com"
echo "Logging in to ECR: $REGISTRY ..."
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"
echo "Login Succeeded"
