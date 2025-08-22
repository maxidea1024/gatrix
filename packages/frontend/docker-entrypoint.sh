#!/bin/sh

# Replace environment variables in built files
# This allows runtime configuration of the frontend

echo "Starting Gate Frontend..."

# Default values
API_URL=${VITE_API_URL:-"http://localhost:5000/api/v1"}
APP_NAME=${VITE_APP_NAME:-"Gate"}
DEFAULT_LANGUAGE=${VITE_DEFAULT_LANGUAGE:-"ko"}

echo "Configuration:"
echo "  API_URL: $API_URL"
echo "  APP_NAME: $APP_NAME"
echo "  DEFAULT_LANGUAGE: $DEFAULT_LANGUAGE"

# Create runtime config file
cat > /usr/share/nginx/html/config.js << EOF
window.ENV = {
  VITE_API_URL: '$API_URL',
  VITE_APP_NAME: '$APP_NAME',
  VITE_DEFAULT_LANGUAGE: '$DEFAULT_LANGUAGE'
};
EOF

echo "Runtime configuration created."

# Start nginx
echo "Starting Nginx..."
exec "$@"
