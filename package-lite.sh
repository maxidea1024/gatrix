#!/bin/bash
#
# Gatrix Deploy Package Script
#
# Creates a tgz package containing all files needed for deployment.
#
# Usage:
#   ./package.sh [options]
#
# Options:
#   -o, --output <file>       Output file name (default: gatrix-deploy.tgz)
#   -h, --help                Show help

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default values
DATE_SUFFIX=$(date +"%Y%m%d-%H%M")
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"
ARTIFACTS_DIR="$ROOT_DIR/artifacts"
OUTPUT_FILE="$ARTIFACTS_DIR/gatrix-deploy-${DATE_SUFFIX}.tgz"

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

show_help() {
    echo "Gatrix Deploy Package Script"
    echo ""
    echo "Usage: ./package.sh [options]"
    echo ""
    echo "Options:"
    echo "  -o, --output <file>       Output file name (default: gatrix-deploy.tgz)"
    echo "  -h, --help                Show help"
    echo ""
    echo "Included files:"
    echo "  - deploy/*                Deploy scripts"
    echo "  - docker-compose.lite.yml Lite compose file"
    echo "  - .env*.example           Environment templates"
    echo "  - setup-env.*             Environment setup scripts"
    echo "  - update-lite.sh          Lite update script"
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -o|--output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "========================================"
echo "   Gatrix Deploy Package"
echo "========================================"
echo ""

cd "$ROOT_DIR"

# Create temp directory for packaging
TEMP_DIR=$(mktemp -d)
PACKAGE_DIR="$TEMP_DIR/gatrix-deploy"
mkdir -p "$PACKAGE_DIR"

log_info "Collecting files..."

# Copy deploy folder (excluding history and env files with secrets)
mkdir -p "$PACKAGE_DIR/deploy"
cp -r deploy/*.sh "$PACKAGE_DIR/deploy/" 2>/dev/null || true
cp -r deploy/*.ps1 "$PACKAGE_DIR/deploy/" 2>/dev/null || true
cp -r deploy/README*.md "$PACKAGE_DIR/deploy/" 2>/dev/null || true
cp deploy/.env.example "$PACKAGE_DIR/deploy/" 2>/dev/null || true

# Copy docker-compose.lite.yml
if [ -f "docker-compose.lite.yml" ]; then
    cp docker-compose.lite.yml "$PACKAGE_DIR/"
    log_info "  + docker-compose.lite.yml"
fi

# Copy docker config folders required by docker-compose.lite.yml
if [ -d "docker" ]; then
    mkdir -p "$PACKAGE_DIR/docker"
    # Loki config
    if [ -d "docker/loki" ]; then
        cp -r docker/loki "$PACKAGE_DIR/docker/"
        log_info "  + docker/loki/"
    fi
    # Fluent-bit config
    if [ -d "docker/fluent-bit" ]; then
        cp -r docker/fluent-bit "$PACKAGE_DIR/docker/"
        log_info "  + docker/fluent-bit/"
    fi
    # Prometheus config
    if [ -d "docker/prometheus" ]; then
        cp -r docker/prometheus "$PACKAGE_DIR/docker/"
        log_info "  + docker/prometheus/"
    fi
    # Grafana config
    if [ -d "docker/grafana" ]; then
        cp -r docker/grafana "$PACKAGE_DIR/docker/"
        log_info "  + docker/grafana/"
    fi
    # MySQL init scripts
    if [ -d "docker/mysql" ]; then
        cp -r docker/mysql "$PACKAGE_DIR/docker/"
        log_info "  + docker/mysql/"
    fi
    # Redis config
    if [ -d "docker/redis" ]; then
        cp -r docker/redis "$PACKAGE_DIR/docker/"
        log_info "  + docker/redis/"
    fi
    # Nginx SSL (create empty if not exists)
    mkdir -p "$PACKAGE_DIR/docker/nginx/ssl"
    if [ -d "docker/nginx" ]; then
        cp -r docker/nginx "$PACKAGE_DIR/docker/" 2>/dev/null || true
        log_info "  + docker/nginx/"
    fi
fi

# Copy .env examples from root
for f in .env*.example; do
    if [ -f "$f" ]; then
        cp "$f" "$PACKAGE_DIR/"
        log_info "  + $f"
    fi
done

# Copy setup-env scripts from root
for f in setup-env*; do
    if [ -f "$f" ]; then
        cp "$f" "$PACKAGE_DIR/"
        chmod +x "$PACKAGE_DIR/$f"
        log_info "  + $f"
    fi
done

# Copy update-lite scripts from root
for f in update-lite.*; do
    if [ -f "$f" ]; then
        cp "$f" "$PACKAGE_DIR/"
        chmod +x "$PACKAGE_DIR/$f" 2>/dev/null || true
        log_info "  + $f"
    fi
done

# Copy QUICKSTART docs
for f in QUICKSTART*.md; do
    if [ -f "$f" ]; then
        cp "$f" "$PACKAGE_DIR/"
        log_info "  + $f"
    fi
done


# Create the package
mkdir -p "$ARTIFACTS_DIR"
log_info "Creating package: $OUTPUT_FILE"
cd "$TEMP_DIR"
tar -czf "$OUTPUT_FILE" gatrix-deploy

echo ""
log_success "Package created: $OUTPUT_FILE"
echo ""
log_info "Package contents:"
tar -tzf "$OUTPUT_FILE" | head -20
echo "..."
echo "..."

# Deploy to game/gatrix folder
GAME_GATRIX_DIR="$ROOT_DIR/../game/gatrix"
if [ -d "$ROOT_DIR/../game" ]; then
    echo ""
    log_info "Deploying to $GAME_GATRIX_DIR..."
    
    # Clean existing folder
    rm -rf "$GAME_GATRIX_DIR"
    mkdir -p "$GAME_GATRIX_DIR"
    
    # Copy package contents
    cp -r "$PACKAGE_DIR"/* "$GAME_GATRIX_DIR/"
    
    log_success "Deployed to $GAME_GATRIX_DIR"
fi

# Cleanup temp
rm -rf "$TEMP_DIR"

echo ""
log_info "To extract manually: tar -xzf $OUTPUT_FILE"
