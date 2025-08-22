#!/bin/bash

# Gate Application Setup Script
# This script sets up the development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check Node.js version
check_node_version() {
    if command_exists node; then
        NODE_VERSION=$(node --version | cut -d'v' -f2)
        REQUIRED_VERSION="18.0.0"
        
        if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
            print_success "Node.js version $NODE_VERSION is compatible"
            return 0
        else
            print_error "Node.js version $NODE_VERSION is not compatible. Required: >= $REQUIRED_VERSION"
            return 1
        fi
    else
        print_error "Node.js is not installed"
        return 1
    fi
}

# Function to check Yarn
check_yarn() {
    if command_exists yarn; then
        YARN_VERSION=$(yarn --version)
        print_success "Yarn version $YARN_VERSION is installed"
        return 0
    else
        print_error "Yarn is not installed"
        return 1
    fi
}

# Function to check Docker
check_docker() {
    if command_exists docker; then
        DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
        print_success "Docker version $DOCKER_VERSION is installed"
        
        if command_exists docker-compose; then
            COMPOSE_VERSION=$(docker-compose --version | cut -d' ' -f3 | cut -d',' -f1)
            print_success "Docker Compose version $COMPOSE_VERSION is installed"
            return 0
        else
            print_error "Docker Compose is not installed"
            return 1
        fi
    else
        print_error "Docker is not installed"
        return 1
    fi
}

print_status "Setting up Gate development environment..."

# Check prerequisites
print_status "Checking prerequisites..."

PREREQUISITES_OK=true

if ! check_node_version; then
    PREREQUISITES_OK=false
    print_warning "Please install Node.js 18 or later: https://nodejs.org/"
fi

if ! check_yarn; then
    PREREQUISITES_OK=false
    print_warning "Please install Yarn: npm install -g yarn"
fi

if ! check_docker; then
    PREREQUISITES_OK=false
    print_warning "Please install Docker and Docker Compose: https://docs.docker.com/get-docker/"
fi

if [ "$PREREQUISITES_OK" = false ]; then
    print_error "Prerequisites not met. Please install the required tools and run this script again."
    exit 1
fi

print_success "All prerequisites are met!"

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p backups
mkdir -p logs
mkdir -p docker/nginx/ssl
print_success "Directories created"

# Setup environment file
print_status "Setting up environment configuration..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_success "Environment file created from .env.example"
        print_warning "Please review and update .env file with your configuration"
    else
        print_error ".env.example file not found"
        exit 1
    fi
else
    print_success "Environment file already exists"
fi

# Install dependencies
print_status "Installing dependencies..."
yarn install
print_success "Dependencies installed"

# Setup Git hooks (if .git exists)
if [ -d ".git" ]; then
    print_status "Setting up Git hooks..."
    
    # Create pre-commit hook
    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh
# Gate pre-commit hook

echo "Running pre-commit checks..."

# Run linting
echo "Running ESLint..."
yarn lint
if [ $? -ne 0 ]; then
    echo "ESLint failed. Please fix the issues before committing."
    exit 1
fi

# Run type checking
echo "Running TypeScript checks..."
yarn typecheck
if [ $? -ne 0 ]; then
    echo "TypeScript check failed. Please fix the issues before committing."
    exit 1
fi

echo "Pre-commit checks passed!"
EOF

    chmod +x .git/hooks/pre-commit
    print_success "Git hooks configured"
else
    print_warning "Not a Git repository. Skipping Git hooks setup."
fi

# Build applications
print_status "Building applications..."
yarn build
print_success "Applications built successfully"

# Setup database (if Docker is available)
if command_exists docker-compose; then
    print_status "Setting up development database..."
    
    # Start database services
    docker-compose -f docker-compose.dev.yml up -d mysql redis
    
    # Wait for database
    print_status "Waiting for database to be ready..."
    timeout=60
    counter=0
    while ! docker-compose -f docker-compose.dev.yml exec -T mysql mysqladmin ping -h localhost -u root -proot --silent 2>/dev/null; do
        sleep 2
        counter=$((counter + 2))
        if [ $counter -ge $timeout ]; then
            print_warning "Database setup timeout. You may need to run migrations manually."
            break
        fi
    done
    
    if [ $counter -lt $timeout ]; then
        print_success "Database is ready"
        
        # Run migrations
        print_status "Running database migrations..."
        yarn migrate:up
        print_success "Database migrations completed"
        
        # Run seeds
        print_status "Running database seeds..."
        yarn seed:run
        print_success "Database seeding completed"
    fi
    
    # Stop services
    docker-compose -f docker-compose.dev.yml down
    print_success "Development database setup completed"
else
    print_warning "Docker not available. Skipping database setup."
    print_warning "You'll need to set up MySQL and Redis manually."
fi

# Create SSL certificates for development (optional)
if command_exists openssl; then
    print_status "Creating self-signed SSL certificates for development..."
    
    if [ ! -f "docker/nginx/ssl/cert.pem" ]; then
        openssl req -x509 -newkey rsa:4096 -keyout docker/nginx/ssl/key.pem -out docker/nginx/ssl/cert.pem -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
        print_success "SSL certificates created"
    else
        print_success "SSL certificates already exist"
    fi
else
    print_warning "OpenSSL not found. Skipping SSL certificate generation."
fi

# Final instructions
echo ""
print_success "Gate development environment setup completed!"
echo ""
echo "Next steps:"
echo "  1. Review and update .env file with your configuration"
echo "  2. Start development environment:"
echo "     yarn dev                    # Start both frontend and backend"
echo "     yarn docker:up              # Or use Docker for full stack"
echo ""
echo "Useful commands:"
echo "  yarn dev                       # Start development servers"
echo "  yarn build                     # Build for production"
echo "  yarn test                      # Run all tests"
echo "  yarn lint                      # Run linting"
echo "  yarn typecheck                 # Run TypeScript checks"
echo "  yarn migrate:up                # Run database migrations"
echo "  yarn seed:run                  # Seed database with initial data"
echo ""
echo "Docker commands:"
echo "  yarn docker:up                 # Start all services with Docker"
echo "  yarn docker:down               # Stop all services"
echo "  yarn docker:logs               # View logs"
echo ""
echo "Access URLs (when running):"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:5000"
echo "  Adminer:  http://localhost:8080 (with Docker)"
echo ""
print_success "Happy coding! 🚀"
