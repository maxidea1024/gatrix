#!/bin/bash
# Load registry credentials
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/registry.env"

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Login to registry
login_registry() {
    echo -e "${BLUE}[INFO]${NC} Logging in to $REGISTRY_HOST..."
    if echo "$REGISTRY_PASS" | docker login "$REGISTRY_HOST" --username "$REGISTRY_USER" --password-stdin; then
        echo -e "${GREEN}[SUCCESS]${NC} Login Succeeded"
    else
        echo -e "${RED}[ERROR]${NC} Login Failed. Check credentials in registry.env"
        return 1
    fi
}

# Run if executed directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    login_registry
fi
