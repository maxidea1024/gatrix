#!/bin/bash
#
# Gatrix Build and Push Script
#
# Usage:
#   ./build-and-push.sh [options]
#
# Options:
#   -t, --tag <tag>           Image tag (default: latest)
#   -p, --push                Push images to registry
#   -l, --latest              Also tag and push as "latest"
#   -s, --service <name>      Service to build (can be used multiple times)
#   -h, --help                Show help

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Default values
TAG="latest"
PUSH=false
TAG_LATEST=false
REGISTRY="uwocn.tencentcloudcr.com"
NAMESPACE="uwocn"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
LOGIN_SCRIPT="$SCRIPT_DIR/login-registry.sh"

# Available services
declare -A ALL_SERVICES
ALL_SERVICES=(
    ["backend"]="packages/backend/Dockerfile"
    ["frontend"]="packages/frontend/Dockerfile"
    ["edge"]="packages/edge/Dockerfile"
    ["chat-server"]="packages/chat-server/Dockerfile"
    ["event-lens"]="packages/event-lens/Dockerfile"
)

# Targeted services (empty means all)
TARGET_SERVICES=()

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        -p|--push)
            PUSH=true
            shift
            ;;
        -l|--latest)
            TAG_LATEST=true
            shift
            ;;
        -s|--service)
            TARGET_SERVICES+=("$2")
            shift 2
            ;;
        -h|--help)
            echo "Gatrix Build and Push Script"
            echo ""
            echo "Usage: ./build-and-push.sh [options]"
            echo ""
            echo "Options:"
            echo "  -t, --tag <tag>           Image tag (default: latest)"
            echo "  -p, --push                Push images to registry"
            echo "  -l, --latest              Also tag and push as 'latest'"
            echo "  -s, --service <name>      Service to build (repeatable)"
            echo "  -h, --help                Show help"
            echo ""
            echo "Example:"
            echo "  ./build-and-push.sh -t v1.0.0 -l -p"
            echo "  ./build-and-push.sh --service backend --service frontend --push"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Determine services to build
declare -A SERVICES_TO_BUILD
if [ ${#TARGET_SERVICES[@]} -gt 0 ]; then
    for svc in "${TARGET_SERVICES[@]}"; do
        if [ -n "${ALL_SERVICES[$svc]}" ]; then
            SERVICES_TO_BUILD[$svc]="${ALL_SERVICES[$svc]}"
        else
            log_warn "Service '$svc' not found. Skipping."
        fi
    done
    if [ ${#SERVICES_TO_BUILD[@]} -eq 0 ]; then
        log_error "No valid services specified."
        exit 1
    fi
else
    # Copy all
    for key in "${!ALL_SERVICES[@]}"; do
        SERVICES_TO_BUILD[$key]="${ALL_SERVICES[$key]}"
    done
fi


echo "========================================"
echo "   Gatrix Build & Push"
echo "========================================"
echo "Root Directory: $ROOT_DIR"
echo "Tag: $TAG"
echo "Registry: $REGISTRY/$NAMESPACE/gatrix-<service>:<tag>"
echo "Services: ${!SERVICES_TO_BUILD[@]}"
echo ""

# Login if pushing
if [ "$PUSH" = true ]; then
    if [ -f "$LOGIN_SCRIPT" ]; then
        log_info "Calling registry login script..."
        source "$LOGIN_SCRIPT"
        if type login-registry &>/dev/null; then
             login-registry
        fi
    else
        log_warn "Login script not found at $LOGIN_SCRIPT. Assuming already logged in."
    fi
fi

for SERVICE_NAME in "${!SERVICES_TO_BUILD[@]}"; do
    DOCKERFILE="${SERVICES_TO_BUILD[$SERVICE_NAME]}"
    IMAGE_NAME="$REGISTRY/$NAMESPACE/gatrix-$SERVICE_NAME:$TAG"
    
    log_info "Building image for $SERVICE_NAME: $IMAGE_NAME..."
    
    FULL_DOCKER_PATH="$ROOT_DIR/$DOCKERFILE"
    
    if [ ! -f "$FULL_DOCKER_PATH" ]; then
        log_warn "Dockerfile not found for $SERVICE_NAME at $FULL_DOCKER_PATH. Skipping."
        continue
    fi
    
    # Build
    (
        cd "$ROOT_DIR"
        LATEST_IMAGE_NAME="$REGISTRY/$NAMESPACE/gatrix-$SERVICE_NAME:latest"
        
        if docker build -f "$DOCKERFILE" -t "$IMAGE_NAME" --build-arg APP_VERSION="$TAG" .; then
            # Tag as latest if requested
            if [ "$TAG_LATEST" = true ] && [ "$TAG" != "latest" ]; then
                log_info "[$SERVICE_NAME] Tagging as latest..."
                docker tag "$IMAGE_NAME" "$LATEST_IMAGE_NAME"
            fi
            
            log_success "[$SERVICE_NAME] Build success."
            
            if [ "$PUSH" = true ]; then
                log_info "[$SERVICE_NAME] Pushing $TAG to registry..."
                if docker push "$IMAGE_NAME"; then
                    log_success "[$SERVICE_NAME] Push $TAG success."
                else
                    log_error "[$SERVICE_NAME] Push $TAG failed."
                    exit 1
                fi
                
                # Push latest tag if requested
                if [ "$TAG_LATEST" = true ] && [ "$TAG" != "latest" ]; then
                    log_info "[$SERVICE_NAME] Pushing latest to registry..."
                    if docker push "$LATEST_IMAGE_NAME"; then
                        log_success "[$SERVICE_NAME] Push latest success."
                    else
                        log_error "[$SERVICE_NAME] Push latest failed."
                        exit 1
                    fi
                fi
            fi
        else
            log_error "[$SERVICE_NAME] Build failed."
            exit 1
        fi
    ) || exit 1
done

echo ""
log_success "Done."

# Save build history
HISTORY_FILE="$SCRIPT_DIR/.build-history.json"
GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
SERVICES_LIST=$(printf '"%s",' "${!SERVICES_TO_BUILD[@]}" | sed 's/,$//')

# Create new record
NEW_RECORD=$(cat <<EOF
{
  "timestamp": "$TIMESTAMP",
  "tag": "$TAG",
  "latest": $TAG_LATEST,
  "pushed": $PUSH,
  "services": [$SERVICES_LIST],
  "gitHash": "$GIT_HASH",
  "gitBranch": "$GIT_BRANCH",
  "registry": "$REGISTRY/$NAMESPACE"
}
EOF
)

# Append to existing history or create new
if [ -f "$HISTORY_FILE" ]; then
    # Read existing content and append new record
    EXISTING=$(cat "$HISTORY_FILE")
    # Remove trailing ] and add new record
    echo "$EXISTING" | sed '$ s/]$/,/' > "$HISTORY_FILE.tmp"
    echo "$NEW_RECORD" >> "$HISTORY_FILE.tmp"
    echo "]" >> "$HISTORY_FILE.tmp"
    mv "$HISTORY_FILE.tmp" "$HISTORY_FILE"
else
    # Create new array with single record
    echo "[" > "$HISTORY_FILE"
    echo "$NEW_RECORD" >> "$HISTORY_FILE"
    echo "]" >> "$HISTORY_FILE"
fi

echo ""
echo -e "${BLUE}Build history saved to: $HISTORY_FILE${NC}"
