#!/bin/bash
#
# List images in Docker Registry (Tencent Cloud CR)
# Outputs full image URLs that can be used directly in docker-compose.yml.
#

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGISTRY_ENV="$SCRIPT_DIR/registry.env"

# Load environment
if [ -f "$REGISTRY_ENV" ]; then
    source "$REGISTRY_ENV"
else
    echo -e "${RED}[ERROR]${NC} registry.env not found."
    exit 1
fi

# Services to check
SERVICES=("backend" "frontend" "edge" "chat-server" "event-lens")

echo -e "${BLUE}[INFO]${NC} Fetching image tags from $REGISTRY_HOST..."
echo ""

# Get Bearer token for a specific repo
get_bearer_token() {
    local repo="$1"
    
    # Get auth challenge
    local challenge=$(curl -s -D - "https://$REGISTRY_HOST/v2/" -o /dev/null | grep -i "Www-Authenticate" | tr -d '\r')
    
    if [[ "$challenge" =~ Bearer ]]; then
        local realm=$(echo "$challenge" | sed -n 's/.*realm="\([^"]*\)".*/\1/p')
        local service=$(echo "$challenge" | sed -n 's/.*service="\([^"]*\)".*/\1/p')
        local scope="repository:$repo:pull"
        
        # Get token
        local token_resp=$(curl -s -u "$REGISTRY_USER:$REGISTRY_PASS" "$realm?service=$service&scope=$scope")
        
        if command -v jq &> /dev/null; then
            echo "$token_resp" | jq -r '.token // .access_token'
        else
            echo "$token_resp" | grep -o '"token":"[^"]*"' | cut -d'"' -f4
        fi
    fi
}

for svc in "${SERVICES[@]}"; do
    repo="$REGISTRY_NAMESPACE/gatrix-$svc"
    url="https://$REGISTRY_HOST/v2/$repo/tags/list"
    
    echo -e "${YELLOW}[$svc]${NC}"
    
    token=$(get_bearer_token "$repo")
    if [ -z "$token" ] || [ "$token" == "null" ]; then
        echo -e "  ${RED}(auth failed)${NC}"
        continue
    fi
    
    response=$(curl -s -H "Authorization: Bearer $token" "$url")
    
    if echo "$response" | grep -q '"tags"'; then
        if command -v jq &> /dev/null; then
            tags=$(echo "$response" | jq -r '.tags[]' 2>/dev/null | sort -r)
        else
            tags=$(echo "$response" | grep -o '"tags":\[.*\]' | sed 's/"tags":\[//' | sed 's/\]//' | tr ',' '\n' | sed 's/"//g' | sort -r)
        fi
        
        if [ -n "$tags" ]; then
            while IFS= read -r tag; do
                if [ -n "$tag" ]; then
                    echo -e "  ${GREEN}$REGISTRY_HOST/$REGISTRY_NAMESPACE/gatrix-$svc:$tag${NC}"
                fi
            done <<< "$tags"
        else
            echo -e "  ${GRAY}(no tags)${NC}"
        fi
    elif echo "$response" | grep -q "NAME_UNKNOWN"; then
        echo -e "  ${GRAY}(not found)${NC}"
    else
        echo -e "  ${RED}(error)${NC}"
    fi
    echo ""
done

echo -e "${BLUE}[INFO]${NC} Done."
