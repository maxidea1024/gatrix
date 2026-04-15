#!/bin/bash
#
# Gatrix Deploy-Swarm Packaging Script
# Packages the deploy-swarm directory into a timestamped .tgz archive
# for transfer to publisher/system administrator.
#
# Usage:
#   ./package.sh [options]
#
# Options:
#   -o, --output <dir>        Output directory (default: current directory)
#   -h, --help                Show help
#
# Output format: gatrix-swarm-YYYYMMDD-HHMMSS.tgz

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/dist"

while [[ $# -gt 0 ]]; do
    case $1 in
        -o|--output) OUTPUT_DIR="$2"; shift 2 ;;
        -h|--help)
            echo "Gatrix Deploy-Swarm Packaging Script"
            echo ""
            echo "Usage: ./package.sh [options]"
            echo ""
            echo "Options:"
            echo "  -o, --output <dir>        Output directory (default: current directory)"
            echo "  -h, --help                Show help"
            echo ""
            echo "Creates a timestamped .tgz archive of the deploy-swarm directory."
            echo "Output directory: ./dist/ (override with -o)"
            echo "Output format: gatrix-swarm-YYYYMMDD-HHMMSS.tgz"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
ARCHIVE_NAME="gatrix-swarm-${TIMESTAMP}.tgz"
ARCHIVE_PATH="${OUTPUT_DIR}/${ARCHIVE_NAME}"

echo -e "${BLUE}========================================"
echo "   Gatrix Deploy-Swarm Packaging"
echo -e "========================================${NC}"
echo ""

# Files/directories to include
INCLUDE_FILES=(
    "docker-compose.swarm.yml"
    ".env.example"
    "config/"
    "deploy.sh"
    "deploy.ps1"
    "login-registry.sh"
    "login-registry.ps1"
    "update.sh"
    "update.ps1"
    "rollback.sh"
    "rollback.ps1"
    "ephemeral-scale.sh"
    "ephemeral-scale.ps1"
    "status.sh"
    "status.ps1"
    "list-images.sh"
    "list-images.ps1"
    "teardown.sh"
    "teardown.ps1"
    "health-check.sh"
    "health-check.ps1"
    "generate-secrets.sh"
    "generate-secrets.ps1"
    "package-deploy.js"
    "README.md"
    "README.en.md"
    "README.zh.md"
    ".gitignore"
)

# Collect existing files
EXISTING=()
echo "Including files:"
for item in "${INCLUDE_FILES[@]}"; do
    full_path="$SCRIPT_DIR/$item"
    if [ -e "$full_path" ]; then
        EXISTING+=("$item")
        if [ -d "$full_path" ]; then
            echo -e "  ${GREEN}[+]${NC} $item (dir)"
        else
            size=$(du -h "$full_path" | cut -f1)
            echo -e "  ${GREEN}[+]${NC} $item ($size)"
        fi
    else
        echo "  [-] $item (not found, skipping)"
    fi
done

# Excluded files (never include)
echo ""
echo "Excluded:"
echo "  [-] .env (contains secrets)"
echo "  [-] registry.env (contains registry credentials - create manually)"
echo "  [-] .build-history.json (local build history)"
echo "  [-] *.tgz (previous archives)"

echo ""

# Create archive
mkdir -p "$OUTPUT_DIR"
cd "$SCRIPT_DIR"
tar -czf "$ARCHIVE_PATH" "${EXISTING[@]}"

# Show result
SIZE=$(du -h "$ARCHIVE_PATH" | cut -f1)

echo -e "${GREEN}========================================"
echo "   Archive Created"
echo "========================================"
echo ""
echo "  File: $ARCHIVE_NAME"
echo "  Size: $SIZE"
echo "  Path: $ARCHIVE_PATH"
echo -e "========================================${NC}"
echo ""
echo "To deploy on target server:"
echo "  1. Copy $ARCHIVE_NAME to server"
echo "  2. tar -xzf $ARCHIVE_NAME"
echo "  3. cp .env.example .env"
echo "  4. vi .env  # Configure Cloud DB/Redis"
echo "  5. Create registry.env with your Docker registry credentials"
echo "  6. ./generate-secrets.sh --env  # Generate security keys"
echo "  7. ./deploy.sh -v latest --init"
