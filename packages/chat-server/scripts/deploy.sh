#!/bin/bash

# Gatrix Chat Server Deployment Script
# This script handles the deployment of the chat server with zero-downtime

set -e

# Configuration
DOCKER_COMPOSE_FILE="docker-compose.yml"
BACKUP_DIR="./backups"
LOG_FILE="./logs/deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
    fi
    
    # Check if required files exist
    if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
        error "Docker Compose file not found: $DOCKER_COMPOSE_FILE"
    fi
    
    # Check if .env file exists
    if [ ! -f ".env" ]; then
        warning ".env file not found, using default configuration"
    fi
    
    success "Prerequisites check completed"
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    mkdir -p "$BACKUP_DIR"
    mkdir -p "./logs"
    mkdir -p "./uploads"
    mkdir -p "./ssl"
    
    success "Directories created"
}

# Backup current deployment
backup_deployment() {
    log "Creating backup of current deployment..."
    
    BACKUP_NAME="backup_$(date +'%Y%m%d_%H%M%S')"
    BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
    
    mkdir -p "$BACKUP_PATH"
    
    # Backup database
    if docker-compose ps mysql | grep -q "Up"; then
        log "Backing up MySQL database..."
        docker-compose exec -T mysql mysqldump -u root -proot_password gatrix_chat > "$BACKUP_PATH/database.sql"
    fi
    
    # Backup Redis data
    if docker-compose ps redis | grep -q "Up"; then
        log "Backing up Redis data..."
        docker-compose exec -T redis redis-cli --rdb - > "$BACKUP_PATH/redis.rdb"
    fi
    
    # Backup uploads
    if [ -d "./uploads" ]; then
        log "Backing up uploads..."
        cp -r "./uploads" "$BACKUP_PATH/"
    fi
    
    success "Backup created: $BACKUP_PATH"
}

# Build new images
build_images() {
    log "Building new Docker images..."
    
    docker-compose build --no-cache chat-server
    
    success "Docker images built successfully"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    # Wait for database to be ready
    log "Waiting for database to be ready..."
    timeout 60 bash -c 'until docker-compose exec mysql mysqladmin ping -h localhost --silent; do sleep 1; done'
    
    # Run migrations
    docker-compose exec chat-server npm run migrate:latest
    
    success "Database migrations completed"
}

# Health check
health_check() {
    log "Performing health check..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3001/health > /dev/null 2>&1; then
            success "Health check passed"
            return 0
        fi
        
        log "Health check attempt $attempt/$max_attempts failed, retrying in 5 seconds..."
        sleep 5
        ((attempt++))
    done
    
    error "Health check failed after $max_attempts attempts"
}

# Rolling deployment
rolling_deployment() {
    log "Starting rolling deployment..."
    
    # Scale up new instances
    docker-compose up -d --scale chat-server=6 --no-recreate
    
    # Wait for new instances to be healthy
    sleep 30
    health_check
    
    # Scale down old instances
    docker-compose up -d --scale chat-server=3 --no-recreate
    
    success "Rolling deployment completed"
}

# Cleanup old images
cleanup() {
    log "Cleaning up old Docker images..."
    
    # Remove dangling images
    docker image prune -f
    
    # Remove old backups (keep last 10)
    if [ -d "$BACKUP_DIR" ]; then
        ls -t "$BACKUP_DIR" | tail -n +11 | xargs -r -I {} rm -rf "$BACKUP_DIR/{}"
    fi
    
    success "Cleanup completed"
}

# Main deployment function
deploy() {
    log "Starting Gatrix Chat Server deployment..."
    
    check_prerequisites
    create_directories
    
    # Only backup if services are running
    if docker-compose ps | grep -q "Up"; then
        backup_deployment
    fi
    
    build_images
    
    # Start services
    docker-compose up -d
    
    # Wait for services to start
    sleep 20
    
    run_migrations
    health_check
    
    cleanup
    
    success "Deployment completed successfully!"
    
    # Show status
    log "Service status:"
    docker-compose ps
    
    log "Chat server is available at: http://localhost:3001"
    log "Metrics are available at: http://localhost:9090"
    log "Grafana is available at: http://localhost:3000"
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        deploy
        ;;
    "backup")
        backup_deployment
        ;;
    "health")
        health_check
        ;;
    "cleanup")
        cleanup
        ;;
    "logs")
        docker-compose logs -f chat-server
        ;;
    "stop")
        log "Stopping chat server..."
        docker-compose down
        success "Chat server stopped"
        ;;
    "restart")
        log "Restarting chat server..."
        docker-compose restart chat-server
        health_check
        success "Chat server restarted"
        ;;
    *)
        echo "Usage: $0 {deploy|backup|health|cleanup|logs|stop|restart}"
        echo ""
        echo "Commands:"
        echo "  deploy   - Full deployment with backup and health checks"
        echo "  backup   - Create backup of current deployment"
        echo "  health   - Run health check"
        echo "  cleanup  - Clean up old images and backups"
        echo "  logs     - Show chat server logs"
        echo "  stop     - Stop all services"
        echo "  restart  - Restart chat server"
        exit 1
        ;;
esac
