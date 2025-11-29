#!/bin/bash

################################################################################
# Gatrix .env Setup Script
#
# Automatically generates .env file during initial setup.
# Encryption keys are securely auto-generated, only host address is required.
#
# Usage:
#   ./setup-env.sh [HOST] [ENVIRONMENT] [LANGUAGE] [OPTIONS]
#
# Options:
#   --force                    Overwrite existing .env file
#   --nobackup                 Do not create backup file when overwriting
#   --admin-password           Set custom admin password
#   --protocol                 Set protocol (http or https, default: http for dev, https for prod)
#   --service-discovery-mode   Set service discovery mode (etcd or redis, default: etcd)
#   --data-root                Set root path for Docker volume data (default: ./data for dev, /data/gatrix for prod)
#
# Examples:
#   ./setup-env.sh localhost development
#   ./setup-env.sh 192.168.1.100 production
#   ./setup-env.sh example.cn production zh
#   ./setup-env.sh localhost development --force
#   ./setup-env.sh localhost development zh --nobackup
#   ./setup-env.sh localhost development zh --admin-password "MySecurePassword123"
#   ./setup-env.sh example.cn production zh --admin-password "SecurePass123" --force --nobackup
#   ./setup-env.sh localhost development zh --protocol https
#   ./setup-env.sh localhost development zh --service-discovery-mode redis
#   ./setup-env.sh example.com production zh --data-root /data/gatrix
#
################################################################################

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory - handle both root and scripts folder execution
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_NAME="$(basename "$SCRIPT_DIR")"

if [ "$SCRIPT_NAME" = "scripts" ]; then
  PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
else
  PROJECT_ROOT="$SCRIPT_DIR"
fi

ENV_FILE="$PROJECT_ROOT/.env"
ENV_EXAMPLE="$PROJECT_ROOT/.env.example"

################################################################################
# Functions
################################################################################

# Print colored output
print_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

# Validate inputs
validate_inputs() {
  if [ -z "$HOST" ]; then
    print_error "Host address is required."
    echo ""
    echo "Usage: $0 [HOST] [ENVIRONMENT] [LANGUAGE] [--force]"
    echo ""
    echo "Examples:"
    echo "  $0 localhost development"
    echo "  $0 192.168.1.100 production"
    echo "  $0 example.cn production zh"
    echo "  $0 localhost development zh --force"
    exit 1
  fi

  if [ -z "$ENVIRONMENT" ]; then
    ENVIRONMENT="development"
    print_info "Environment not specified, using 'development'."
  fi

  if [ "$ENVIRONMENT" != "development" ] && [ "$ENVIRONMENT" != "production" ]; then
    print_error "Environment must be 'development' or 'production'."
    exit 1
  fi

  if [ ! -f "$ENV_EXAMPLE" ]; then
    print_error ".env.example file not found: $ENV_EXAMPLE"
    exit 1
  fi

  # Check if openssl is available
  if ! command -v openssl &> /dev/null; then
    print_error "openssl is not installed. Cannot generate encryption keys."
    exit 1
  fi
}

# Generate JWT Secret (32 characters)
generate_jwt_secret() {
  openssl rand -base64 24 | tr -d '\n' | cut -c1-32
}

# Generate Session Secret (20 characters)
generate_session_secret() {
  openssl rand -base64 15 | tr -d '\n' | cut -c1-20
}

# Generate JWT Refresh Secret (32 characters)
generate_jwt_refresh_secret() {
  openssl rand -base64 24 | tr -d '\n' | cut -c1-32
}

# Check if .env file exists and handle accordingly
check_existing_env() {
  if [ -f "$ENV_FILE" ]; then
    if [ "$FORCE" = false ]; then
      echo ""
      print_error ".env file already exists!"
      echo ""
      echo "To overwrite the existing .env file, use the --force flag:"
      echo "  ./setup-env.sh $HOST $ENVIRONMENT --force"
      echo ""
      exit 1
    fi

    # Backup existing file before overwriting (unless --nobackup is specified)
    if [ "$NOBACKUP" = false ]; then
      TIMESTAMP=$(date +%Y%m%d_%H%M%S)
      BACKUP_FILE="$PROJECT_ROOT/.env.backup.$TIMESTAMP"
      cp "$ENV_FILE" "$BACKUP_FILE"
      print_warning "Existing .env file backed up: $BACKUP_FILE"
    else
      print_info "Skipping backup (--nobackup flag used)"
    fi
  fi
}

# Create .env file
create_env_file() {
  print_info "Generating .env file..."

  # Generate secrets
  JWT_SECRET=$(generate_jwt_secret)
  SESSION_SECRET=$(generate_session_secret)
  JWT_REFRESH_SECRET=$(generate_jwt_refresh_secret)

  # Copy .env.example to .env
  cp "$ENV_EXAMPLE" "$ENV_FILE"

  # Replace values based on environment
  sed -i.bak "s|^NODE_ENV=.*|NODE_ENV=$ENVIRONMENT|" "$ENV_FILE"
  sed -i.bak "s|^DB_HOST=.*|DB_HOST=mysql|" "$ENV_FILE"
  sed -i.bak "s|^DB_PORT=.*|DB_PORT=3306|" "$ENV_FILE"
  sed -i.bak "s|^DB_NAME=.*|DB_NAME=gatrix|" "$ENV_FILE"
  sed -i.bak "s|^DB_USER=.*|DB_USER=gatrix_user|" "$ENV_FILE"
  sed -i.bak "s|^DB_PASSWORD=.*|DB_PASSWORD=gatrix_password|" "$ENV_FILE"
  sed -i.bak "s|^REDIS_HOST=.*|REDIS_HOST=redis|" "$ENV_FILE"
  sed -i.bak "s|^REDIS_PORT=.*|REDIS_PORT=6379|" "$ENV_FILE"

  # Set CORS_ORIGIN and FRONTEND_URL based on protocol and environment
  # In production with standard ports (80/443), omit port number
  # In development or non-standard ports, include port number
  if [ "$ENVIRONMENT" = "development" ]; then
    # Development: include port number, use HOST address (not localhost)
    # This allows access from other machines in the development team
    sed -i.bak "s|^CORS_ORIGIN=.*|CORS_ORIGIN=$PROTOCOL://$HOST:53000|" "$ENV_FILE"
    sed -i.bak "s|^FRONTEND_URL=.*|FRONTEND_URL=$PROTOCOL://$HOST:53000|" "$ENV_FILE"
  else
    # Production: use standard HTTPS port (443), no port number in URL
    sed -i.bak "s|^CORS_ORIGIN=.*|CORS_ORIGIN=$PROTOCOL://$HOST:53000|" "$ENV_FILE"
    sed -i.bak "s|^FRONTEND_URL=.*|FRONTEND_URL=$PROTOCOL://$HOST:53000|" "$ENV_FILE"
  fi

  # Set LOG_LEVEL based on environment
  if [ "$ENVIRONMENT" = "development" ]; then
    sed -i.bak "s|^LOG_LEVEL=.*|LOG_LEVEL=debug|" "$ENV_FILE"
  else
    sed -i.bak "s|^LOG_LEVEL=.*|LOG_LEVEL=info|" "$ENV_FILE"
  fi

  sed -i.bak "s|^CHAT_SERVER_URL=.*|CHAT_SERVER_URL=http://chat-server:53001|" "$ENV_FILE"

  # Replace language settings
  sed -i.bak "s|^VITE_DEFAULT_LANGUAGE=.*|VITE_DEFAULT_LANGUAGE=$DEFAULT_LANGUAGE|" "$ENV_FILE"
  sed -i.bak "s|^DEFAULT_LANGUAGE=.*|DEFAULT_LANGUAGE=$DEFAULT_LANGUAGE|" "$ENV_FILE"

  # Set Grafana URL based on environment
  # In production, Grafana is typically accessed through a subpath or subdomain
  if [ "$ENVIRONMENT" = "development" ]; then
    # Development: include port number, use HOST address (not localhost)
    sed -i.bak "s|^VITE_GRAFANA_URL=.*|VITE_GRAFANA_URL=$PROTOCOL://$HOST:54000|" "$ENV_FILE"
  else
    # Production: Grafana accessed via /grafana subpath (handled by load balancer)
    sed -i.bak "s|^VITE_GRAFANA_URL=.*|VITE_GRAFANA_URL=$PROTOCOL://$HOST:54000|" "$ENV_FILE"
  fi

  # Set Bull Board URL based on environment
  if [ "$ENVIRONMENT" = "development" ]; then
    # Development: include port number, use HOST address (not localhost)
    sed -i.bak "s|^VITE_BULL_BOARD_URL=.*|VITE_BULL_BOARD_URL=$PROTOCOL://$HOST:53000/bull-board|" "$ENV_FILE"
  else
    # Production: Bull Board accessed via /bull-board subpath
    sed -i.bak "s|^VITE_BULL_BOARD_URL=.*|VITE_BULL_BOARD_URL=$PROTOCOL://$HOST:53000/bull-board|" "$ENV_FILE"
  fi


  # Replace admin password
  sed -i.bak "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=$ADMIN_PASSWORD|" "$ENV_FILE"

  # Replace service discovery mode
  sed -i.bak "s|^SERVICE_DISCOVERY_MODE=.*|SERVICE_DISCOVERY_MODE=$SERVICE_DISCOVERY_MODE|" "$ENV_FILE"

  # Replace data root
  sed -i.bak "s|^DATA_ROOT=.*|DATA_ROOT=$DATA_ROOT|" "$ENV_FILE"

  # Replace secrets
  sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" "$ENV_FILE"
  sed -i.bak "s|^SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|" "$ENV_FILE"
  sed -i.bak "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET|" "$ENV_FILE"

  # Remove backup files created by sed
  rm -f "$ENV_FILE.bak"

  # Set file permissions (600 - owner read/write only)
  chmod 600 "$ENV_FILE"

  print_success ".env file generated successfully."
}

# Print summary
print_summary() {
  echo ""
  echo -e "${GREEN}============================================================${NC}"
  echo -e "${GREEN}[OK] .env file generated successfully!${NC}"
  echo -e "${GREEN}============================================================${NC}"
  echo ""
  echo -e "${BLUE}[CONFIGURATION]${NC}"
  echo "  - HOST: $HOST"
  echo "  - PROTOCOL: $PROTOCOL"
  echo "  - ENVIRONMENT: $ENVIRONMENT"
  echo "  - NODE_ENV: $ENVIRONMENT"
  echo "  - DEFAULT_LANGUAGE: $DEFAULT_LANGUAGE"
  echo "  - ADMIN_PASSWORD: $ADMIN_PASSWORD"
  echo "  - SERVICE_DISCOVERY_MODE: $SERVICE_DISCOVERY_MODE"
  echo "  - DATA_ROOT: $DATA_ROOT"
  echo "  - JWT_SECRET: [auto-generated] (32 chars)"
  echo "  - SESSION_SECRET: [auto-generated] (20 chars)"
  echo "  - JWT_REFRESH_SECRET: [auto-generated] (32 chars)"
  echo "  - DB_HOST: mysql"
  echo "  - DB_NAME: gatrix"
  echo "  - DB_USER: gatrix_user"
  echo "  - REDIS_HOST: redis"
  echo ""
  echo -e "${BLUE}[FILE LOCATIONS]${NC}"
  echo "  - .env: $ENV_FILE"
  if [ -f "$BACKUP_FILE" ]; then
    echo "  - Backup: $BACKUP_FILE"
  fi
  echo ""
  echo -e "${YELLOW}[IMPORTANT] Update these values for your environment:${NC}"
  echo "  - GOOGLE_CLIENT_ID"
  echo "  - GOOGLE_CLIENT_SECRET"
  echo "  - GITHUB_CLIENT_ID"
  echo "  - GITHUB_CLIENT_SECRET"
  echo ""
  echo -e "${BLUE}[NEXT STEPS]${NC}"
  echo "  1. Review and update the .env file with your settings"

  if [ "$ENVIRONMENT" = "development" ]; then
    echo "  2. Start Docker services: docker-compose -f docker-compose.dev.yml up -d"
    echo "  3. Access the application: $PROTOCOL://$HOST:53000"
  else
    echo "  2. Start Docker services: docker-compose -f docker-compose.yml up -d"
    echo "  3. Access the application: $PROTOCOL://$HOST"
    echo "  4. Configure your load balancer to forward:"
    echo "     - HTTPS 443 → 53000 (Frontend)"
    echo "     - HTTPS 443/grafana → 54000 (Grafana, optional)"
  fi
  echo ""
}

################################################################################
# Main
################################################################################

main() {
  echo ""
  echo -e "${BLUE}============================================================${NC}"
  echo -e "${BLUE}Gatrix .env Auto-Generation Script${NC}"
  echo -e "${BLUE}============================================================${NC}"
  echo ""

  HOST="$1"
  ENVIRONMENT="$2"
  DEFAULT_LANGUAGE="${3:-zh}"
  ADMIN_PASSWORD="admin123"
  PROTOCOL=""
  SERVICE_DISCOVERY_MODE="etcd"
  DATA_ROOT=""
  FORCE=false
  NOBACKUP=false

  # Parse optional arguments
  i=4
  while [ $i -le $# ]; do
    arg="${!i}"
    if [ "$arg" = "--force" ]; then
      FORCE=true
    elif [ "$arg" = "--nobackup" ]; then
      NOBACKUP=true
    elif [ "$arg" = "--admin-password" ]; then
      i=$((i + 1))
      ADMIN_PASSWORD="${!i}"
    elif [[ "$arg" == --admin-password=* ]]; then
      ADMIN_PASSWORD="${arg#*=}"
    elif [ "$arg" = "--protocol" ]; then
      i=$((i + 1))
      PROTOCOL="${!i}"
    elif [[ "$arg" == --protocol=* ]]; then
      PROTOCOL="${arg#*=}"
    elif [ "$arg" = "--service-discovery-mode" ]; then
      i=$((i + 1))
      SERVICE_DISCOVERY_MODE="${!i}"
    elif [[ "$arg" == --service-discovery-mode=* ]]; then
      SERVICE_DISCOVERY_MODE="${arg#*=}"
    elif [ "$arg" = "--data-root" ]; then
      i=$((i + 1))
      DATA_ROOT="${!i}"
    elif [[ "$arg" == --data-root=* ]]; then
      DATA_ROOT="${arg#*=}"
    fi
    i=$((i + 1))
  done

  # Set default protocol based on environment if not specified
  if [ -z "$PROTOCOL" ]; then
    if [ "$ENVIRONMENT" = "development" ]; then
      PROTOCOL="http"
    else
      PROTOCOL="https"
    fi
  fi

  # Validate protocol
  if [ "$PROTOCOL" != "http" ] && [ "$PROTOCOL" != "https" ]; then
    print_error "Protocol must be 'http' or 'https'."
    exit 1
  fi

  # Validate service discovery mode
  if [ "$SERVICE_DISCOVERY_MODE" != "etcd" ] && [ "$SERVICE_DISCOVERY_MODE" != "redis" ]; then
    print_error "Service discovery mode must be 'etcd' or 'redis'."
    exit 1
  fi

  # Set default data root based on environment if not specified
  if [ -z "$DATA_ROOT" ]; then
    if [ "$ENVIRONMENT" = "development" ]; then
      DATA_ROOT="./data"
    else
      DATA_ROOT="/data/gatrix"
    fi
  fi

  validate_inputs
  check_existing_env
  create_env_file
  print_summary
}

# Run main function
main "$@"

