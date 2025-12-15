#!/bin/sh

# Replace environment variables in built files
# This allows runtime configuration of the frontend

echo "Starting Gatrix Frontend..."

# Default values
# In production, use relative path for API calls (same origin)
# In development, use absolute URL
API_URL=${VITE_API_URL:-"/api/v1"}
APP_NAME=${VITE_APP_NAME:-"Gatrix"}
DEFAULT_LANGUAGE=${VITE_DEFAULT_LANGUAGE:-"ko"}
ROUTER_BASENAME=${VITE_ROUTER_BASENAME:-"/"}
CHAT_SERVER_URL=${VITE_CHAT_SERVER_URL:-""}
CHAT_SERVER_PORT=${VITE_CHAT_SERVER_PORT:-"45100"}

echo "Configuration:"
echo "  API_URL: $API_URL"
echo "  APP_NAME: $APP_NAME"
echo "  DEFAULT_LANGUAGE: $DEFAULT_LANGUAGE"
echo "  ROUTER_BASENAME: $ROUTER_BASENAME"
echo "  CHAT_SERVER_URL: $CHAT_SERVER_URL"
echo "  CHAT_SERVER_PORT: $CHAT_SERVER_PORT"

# Create runtime config file
cat > /usr/share/nginx/html/config.js << EOF
window.ENV = {
  VITE_API_URL: '$API_URL',
  VITE_APP_NAME: '$APP_NAME',
  VITE_DEFAULT_LANGUAGE: '$DEFAULT_LANGUAGE',
  VITE_ROUTER_BASENAME: '$ROUTER_BASENAME',
  VITE_CHAT_SERVER_URL: '$CHAT_SERVER_URL',
  VITE_CHAT_SERVER_PORT: '$CHAT_SERVER_PORT'
};
EOF

echo "Runtime configuration created."

# Start nginx
echo "Starting Nginx..."
exec "$@"
