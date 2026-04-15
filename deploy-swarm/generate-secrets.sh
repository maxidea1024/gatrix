#!/bin/bash
#
# Gatrix Secret Key Generator
# Generates cryptographically secure random keys for JWT, session, and API tokens.
#
# Usage:
#   ./generate-secrets.sh [options]
#
# Options:
#   -l, --length <n>          Key length in bytes (default: 32)
#   -e, --encoding <type>     Output encoding: base64, hex, alphanumeric (default: base64)
#   -c, --count <n>           Number of keys to generate (default: 1)
#   --env                     Generate all .env security keys at once
#   -h, --help                Show help

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

LENGTH=32
ENCODING="base64"
COUNT=1
GEN_ENV=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -l|--length) LENGTH="$2"; shift 2 ;;
        -e|--encoding) ENCODING="$2"; shift 2 ;;
        -c|--count) COUNT="$2"; shift 2 ;;
        --env) GEN_ENV=true; shift ;;
        -h|--help)
            echo "Gatrix Secret Key Generator"
            echo ""
            echo "Usage: ./generate-secrets.sh [options]"
            echo ""
            echo "Options:"
            echo "  -l, --length <n>          Key length in bytes (default: 32)"
            echo "  -e, --encoding <type>     Encoding: base64, hex, alphanumeric (default: base64)"
            echo "  -c, --count <n>           Number of keys to generate (default: 1)"
            echo "  --env                     Generate all .env security keys at once"
            echo "  -h, --help                Show help"
            echo ""
            echo "Examples:"
            echo "  ./generate-secrets.sh                          # Single 32-byte base64 key"
            echo "  ./generate-secrets.sh -l 64 -e hex             # 64-byte hex key"
            echo "  ./generate-secrets.sh -c 5                     # 5 random keys"
            echo "  ./generate-secrets.sh --env                    # Generate all .env secrets"
            echo "  ./generate-secrets.sh -l 48 -e alphanumeric    # 48-char alphanumeric key"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Generate a single random key
generate_key() {
    local len="$1"
    local enc="$2"

    case "$enc" in
        base64)
            openssl rand -base64 "$len" 2>/dev/null || \
            head -c "$len" /dev/urandom | base64 | tr -d '\n'
            ;;
        hex)
            openssl rand -hex "$len" 2>/dev/null || \
            head -c "$len" /dev/urandom | xxd -p | tr -d '\n'
            ;;
        alphanumeric)
            cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c "$len"
            ;;
        *)
            echo "Unknown encoding: $enc (use base64, hex, or alphanumeric)" >&2
            exit 1
            ;;
    esac
    echo ""
}

if [ "$GEN_ENV" = true ]; then
    echo -e "${BLUE}========================================"
    echo "   Gatrix Secret Key Generator"
    echo -e "========================================${NC}"
    echo ""
    echo -e "${YELLOW}Copy these values to your .env file:${NC}"
    echo ""
    echo "# Security Secrets (auto-generated)"
    echo "JWT_SECRET=$(generate_key 32 base64 | tr -d '\n')"
    echo "JWT_REFRESH_SECRET=$(generate_key 32 base64 | tr -d '\n')"
    echo "SESSION_SECRET=$(generate_key 32 base64 | tr -d '\n')"
    echo "EDGE_API_TOKEN=$(generate_key 24 alphanumeric | tr -d '\n')"
    echo "EDGE_BYPASS_TOKEN=$(generate_key 24 alphanumeric | tr -d '\n')"
    echo "GRAFANA_ADMIN_PASSWORD=$(generate_key 16 alphanumeric | tr -d '\n')"
    echo ""
    echo -e "${GREEN}[INFO] Keys generated using $(openssl version 2>/dev/null || echo '/dev/urandom')${NC}"
else
    for ((i=1; i<=COUNT; i++)); do
        if [ "$COUNT" -gt 1 ]; then
            echo -e "${BLUE}[$i]${NC} $(generate_key "$LENGTH" "$ENCODING")"
        else
            generate_key "$LENGTH" "$ENCODING"
        fi
    done
fi
