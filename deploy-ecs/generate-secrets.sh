#!/usr/bin/env bash
# Gatrix Secret Key Generator
set -euo pipefail
GEN_ENV=false
while [[ $# -gt 0 ]]; do
    case "$1" in --env) GEN_ENV=true; shift ;; -h|--help)
        echo "Usage: ./generate-secrets.sh [--env]"; exit 0 ;; *) shift ;; esac; done
gen_key() { openssl rand -base64 "$1" 2>/dev/null || head -c "$1" /dev/urandom | base64; }
gen_alnum() { cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c "$1"; }
if [[ "$GEN_ENV" == "true" ]]; then
    echo "========================================"
    echo "   Gatrix Secret Key Generator"
    echo "========================================"
    echo ""
    echo "Copy these values to your .env file:"
    echo ""
    echo "JWT_SECRET=$(gen_key 32)"
    echo "JWT_REFRESH_SECRET=$(gen_key 32)"
    echo "SESSION_SECRET=$(gen_key 32)"
    echo "GRAFANA_ADMIN_PASSWORD=$(gen_alnum 16)"
    echo ""
    echo "Then run ./setup-secrets.sh to store them in AWS Secrets Manager."
else gen_key 32; fi
