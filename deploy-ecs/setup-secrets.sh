#!/usr/bin/env bash
# Gatrix AWS Secrets Manager Setup (idempotent)
set -euo pipefail
PREFIX="gatrix"; FORCE=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
while [[ $# -gt 0 ]]; do
    case "$1" in -p|--prefix) PREFIX="$2"; shift 2 ;; -f|--force) FORCE=true; shift ;;
        -h|--help) echo "Usage: ./setup-secrets.sh [-p <prefix>] [-f]"; exit 0 ;;
        *) echo "[ERROR] Unknown: $1"; exit 1 ;; esac; done
[[ -f "$SCRIPT_DIR/.env" ]] && set -a && source <(grep -v '^\s*#' "$SCRIPT_DIR/.env" | grep -v '^\s*$') && set +a
REGION="${AWS_REGION:-ap-northeast-2}"
info() { echo -e "\033[34m[INFO]\033[0m $1"; }
success() { echo -e "\033[32m[SUCCESS]\033[0m $1"; }
warn() { echo -e "\033[33m[WARN]\033[0m $1"; }
declare -A SECRETS=(
    ["$PREFIX/jwt-secret"]="${JWT_SECRET:-}"
    ["$PREFIX/jwt-refresh-secret"]="${JWT_REFRESH_SECRET:-}"
    ["$PREFIX/session-secret"]="${SESSION_SECRET:-}"
)
for name in "${!SECRETS[@]}"; do
    val="${SECRETS[$name]}"
    [[ -z "$val" || "$val" == change-this* ]] && { warn "$name has placeholder value"; continue; }
    if aws secretsmanager describe-secret --secret-id "$name" --region "$REGION" &>/dev/null; then
        [[ "$FORCE" == "true" ]] && { aws secretsmanager update-secret --secret-id "$name" --secret-string "$val" --region "$REGION" >/dev/null; success "Updated: $name"; } \
            || warn "$name exists, skipping (use --force)"
    else
        aws secretsmanager create-secret --name "$name" --secret-string "$val" --region "$REGION" >/dev/null
        success "Created: $name"
    fi
done
success "Secrets Manager setup completed!"
