#!/bin/bash

# Gate Application Deployment Script
# This script handles deployment to different environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="production"
BUILD_IMAGES=true
RUN_MIGRATIONS=true
RUN_SEEDS=false
BACKUP_DB=true

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -e, --environment ENV    Target environment (development|staging|production) [default: production]"
    echo "  -b, --build             Build Docker images [default: true]"
    echo "  -m, --migrate           Run database migrations [default: true]"
    echo "  -s, --seed              Run database seeds [default: false]"
    echo "  --no-backup             Skip database backup [default: false]"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Deploy to production with defaults"
    echo "  $0 -e staging -s                     # Deploy to staging with seeds"
    echo "  $0 -e development --no-backup        # Deploy to development without backup"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -b|--build)
            BUILD_IMAGES=true
            shift
            ;;
        -m|--migrate)
            RUN_MIGRATIONS=true
            shift
            ;;
        -s|--seed)
            RUN_SEEDS=true
            shift
            ;;
        --no-backup)
            BACKUP_DB=false
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT"
    print_error "Valid environments: development, staging, production"
    exit 1
fi

print_status "Starting deployment to $ENVIRONMENT environment..."

# Set compose file based on environment
if [[ "$ENVIRONMENT" == "development" ]]; then
    COMPOSE_FILE="docker-compose.dev.yml"
else
    COMPOSE_FILE="docker-compose.yml"
fi

# Check if required files exist
if [[ ! -f "$COMPOSE_FILE" ]]; then
    print_error "Compose file not found: $COMPOSE_FILE"
    exit 1
fi

if [[ ! -f ".env" ]]; then
    print_warning ".env file not found. Using .env.example as template."
    if [[ -f ".env.example" ]]; then
        cp .env.example .env
        print_warning "Please update .env file with your configuration before running again."
        exit 1
    else
        print_error ".env.example file not found. Cannot proceed."
        exit 1
    fi
fi

# Load environment variables
source .env

# Backup database if enabled and not development
if [[ "$BACKUP_DB" == true && "$ENVIRONMENT" != "development" ]]; then
    print_status "Creating database backup..."
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
    
    if command -v docker-compose &> /dev/null; then
        docker-compose -f "$COMPOSE_FILE" exec -T mysql mysqldump -u root -p"$DB_ROOT_PASSWORD" "$DB_NAME" > "backups/$BACKUP_FILE" 2>/dev/null || {
            print_warning "Database backup failed. Continuing with deployment..."
        }
    else
        print_warning "docker-compose not found. Skipping database backup."
    fi
fi

# Build images if enabled
if [[ "$BUILD_IMAGES" == true ]]; then
    print_status "Building Docker images..."
    docker-compose -f "$COMPOSE_FILE" build --no-cache
    print_success "Docker images built successfully"
fi

# Stop existing containers
print_status "Stopping existing containers..."
docker-compose -f "$COMPOSE_FILE" down

# Start database and redis first
print_status "Starting database and Redis..."
docker-compose -f "$COMPOSE_FILE" up -d mysql redis

# Wait for database to be ready
print_status "Waiting for database to be ready..."
timeout=60
counter=0
while ! docker-compose -f "$COMPOSE_FILE" exec -T mysql mysqladmin ping -h localhost -u root -p"$DB_ROOT_PASSWORD" --silent; do
    sleep 2
    counter=$((counter + 2))
    if [[ $counter -ge $timeout ]]; then
        print_error "Database failed to start within $timeout seconds"
        exit 1
    fi
done
print_success "Database is ready"

# Run migrations if enabled
if [[ "$RUN_MIGRATIONS" == true ]]; then
    print_status "Running database migrations..."
    docker-compose -f "$COMPOSE_FILE" run --rm backend-dev yarn workspace @gate/backend migrate:up || {
        print_error "Database migrations failed"
        exit 1
    }
    print_success "Database migrations completed"
fi

# Run seeds if enabled
if [[ "$RUN_SEEDS" == true ]]; then
    print_status "Running database seeds..."
    docker-compose -f "$COMPOSE_FILE" run --rm backend-dev yarn workspace @gate/backend seed:run || {
        print_error "Database seeding failed"
        exit 1
    }
    print_success "Database seeding completed"
fi

# Start all services
print_status "Starting all services..."
docker-compose -f "$COMPOSE_FILE" up -d

# Wait for services to be healthy
print_status "Waiting for services to be healthy..."
sleep 10

# Check service health
if docker-compose -f "$COMPOSE_FILE" ps | grep -q "unhealthy"; then
    print_warning "Some services are not healthy. Check logs:"
    docker-compose -f "$COMPOSE_FILE" ps
else
    print_success "All services are running and healthy"
fi

# Show running services
print_status "Deployment completed! Running services:"
docker-compose -f "$COMPOSE_FILE" ps

# Show access URLs
if [[ "$ENVIRONMENT" == "development" ]]; then
    echo ""
    print_success "Development environment is ready!"
    echo "  Frontend: http://localhost:${FRONTEND_PORT:-3000}"
    echo "  Backend:  http://localhost:${BACKEND_PORT:-5000}"
    echo "  Adminer:  http://localhost:${ADMINER_PORT:-8080}"
    echo "  Redis UI: http://localhost:${REDIS_COMMANDER_PORT:-8081}"
else
    echo ""
    print_success "$ENVIRONMENT environment is ready!"
    echo "  Frontend: http://localhost:${FRONTEND_PORT:-80}"
    echo "  Backend:  http://localhost:${BACKEND_PORT:-5000}"
fi

print_success "Deployment to $ENVIRONMENT completed successfully!"
