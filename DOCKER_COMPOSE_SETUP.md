# Docker Compose Setup Guide

> **Note**: Docker Compose v2+ is required. The `version` field has been removed as it's obsolete in modern Docker Compose.

## 📋 Overview

Gatrix provides two Docker Compose configurations:

- **`docker-compose.yml`**: Production environment
- **`docker-compose.dev.yml`**: Development environment with hot reload

## 🏗️ Architecture

### Production Stack (`docker-compose.yml`)

```
┌─────────────────────────────────────────────────────────────┐
│                        Gatrix Stack                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Frontend │  │ Backend  │  │  Chat    │  │  Event   │   │
│  │  (Nginx) │  │   API    │  │  Server  │  │  Lens    │   │
│  │   :80    │  │  :5000   │  │  :3001   │  │  :3002   │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │              │              │          │
│  ┌────┴─────────────┴──────────────┴──────────────┴─────┐  │
│  │                  Infrastructure                        │  │
│  ├────────────┬──────────────┬──────────────────────────┤  │
│  │   MySQL    │    Redis     │      ClickHouse          │  │
│  │   :3306    │    :6379     │    :8123 / :9000         │  │
│  └────────────┴──────────────┴──────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Development Stack (`docker-compose.dev.yml`)

Additional services for development:
- **Adminer** (:8080) - Database management UI
- **Redis Commander** (:8081) - Redis management UI
- **Hot Reload** - All services support live code updates

## 🚀 Quick Start

### Production Environment

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down

# Stop and remove volumes (⚠️ data loss)
docker compose down -v
```

### Development Environment

```bash
# Start all services with hot reload
docker compose -f docker-compose.dev.yml up -d

# View logs for specific service
docker compose -f docker-compose.dev.yml logs -f backend-dev

# Rebuild and restart a service
docker compose -f docker-compose.dev.yml up -d --build backend-dev

# Stop all services
docker compose -f docker-compose.dev.yml down
```

## 📦 Services

### Core Services

#### MySQL (Port: 3306)
- **Image**: `mysql:8.0`
- **Purpose**: Primary database
- **Volumes**: 
  - `mysql_data` - Persistent data
  - `./docker/mysql/init` - Initialization scripts
  - `./docker/mysql/conf.d` - Configuration files
- **Health Check**: MySQL ping command

#### Redis (Port: 6379)
- **Image**: `redis:7-alpine`
- **Purpose**: Cache, sessions, job queues
- **Volumes**: `redis_data` - Persistent data
- **Health Check**: Redis ping command

#### ClickHouse (Ports: 8123, 9000)
- **Image**: `clickhouse/clickhouse-server:24.12.2.29-alpine`
- **Purpose**: Analytics data storage (time-series)
- **Volumes**: `clickhouse_data` - Persistent data
- **Health Check**: HTTP ping on port 8123

### Application Services

#### Backend (Port: 5000)
- **Build**: `packages/backend/Dockerfile`
- **Purpose**: REST API server
- **Dependencies**: MySQL, Redis
- **Volumes** (dev): 
  - `./packages/backend:/app` - Source code
  - `backend_logs` - Log files
- **Health Check**: HTTP GET /health

#### Frontend (Port: 3000 dev / 80 prod)
- **Build**: `packages/frontend/Dockerfile`
- **Purpose**: Web UI (Vite + React)
- **Dependencies**: Backend
- **Volumes** (dev): `./packages/frontend:/app` - Source code

#### Chat Server (Ports: 3001, 9090)
- **Build**: `packages/chat-server/Dockerfile`
- **Purpose**: Real-time messaging (WebSocket)
- **Dependencies**: MySQL, Redis, Backend
- **Volumes**: 
  - `chat_server_uploads` - File uploads
  - `chat_server_logs` - Log files
- **Health Check**: HTTP GET /health
- **Metrics**: Prometheus metrics on port 9090

#### Event Lens (Port: 3002)
- **Build**: `packages/event-lens/Dockerfile`
- **Purpose**: Analytics API server
- **Dependencies**: MySQL, Redis, ClickHouse
- **Volumes**: `event_lens_logs` - Log files
- **Health Check**: HTTP GET /health

#### Event Lens Worker
- **Build**: `packages/event-lens/Dockerfile`
- **Purpose**: Background job processing
- **Command**: `node dist/worker.js`
- **Dependencies**: MySQL, Redis, ClickHouse
- **Volumes**: `event_lens_logs` - Log files

### Development Tools (dev only)

#### Adminer (Port: 8080)
- **Image**: `adminer:latest`
- **Purpose**: Database management UI
- **Access**: http://localhost:8080
- **Default Server**: mysql

#### Redis Commander (Port: 8081)
- **Image**: `rediscommander/redis-commander:latest`
- **Purpose**: Redis management UI
- **Access**: http://localhost:8081

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```bash
# Database
DB_ROOT_PASSWORD=rootpassword
DB_NAME=gatrix
DB_USER=gatrix_user
DB_PASSWORD=gatrix_password
DB_PORT=3306

# Redis
REDIS_PORT=6379
REDIS_PASSWORD=

# Backend
BACKEND_PORT=5000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
SESSION_SECRET=your-super-secret-session-key-change-this-in-production
ADMIN_EMAIL=admin@gatrix.com
ADMIN_PASSWORD=admin123
ADMIN_NAME=Administrator
CORS_ORIGIN=http://localhost:3000
DEFAULT_LANGUAGE=ko

# Frontend
FRONTEND_PORT=3000
VITE_API_URL=http://localhost:5000/api/v1
VITE_APP_NAME=Gatrix
VITE_DEFAULT_LANGUAGE=ko

# Chat Server
CHAT_DB_NAME=gatrix_chat
CHAT_PORT=3001
CHAT_METRICS_PORT=9090
CHAT_LOG_LEVEL=info
CHAT_CLUSTER_ENABLED=true
CHAT_CLUSTER_WORKERS=0
CHAT_STICKY_SESSION=true
CHAT_BROADCAST_BATCH_SIZE=1000
CHAT_USE_MESSAGE_PACK=true
CHAT_BROADCAST_COMPRESSION=true
CHAT_WS_MAX_CONNECTIONS=10000
CHAT_MONITORING_ENABLED=true

# Event Lens
EVENT_LENS_PORT=3002
EVENT_LENS_LOG_LEVEL=info
CLICKHOUSE_PORT=8123
WORKER_BATCH_SIZE=1000
WORKER_BATCH_TIMEOUT=5000
WORKER_CONCURRENCY=10

# Gatrix Integration
GATRIX_API_URL=http://backend:5000
GATRIX_API_SECRET=shared-secret-between-servers
```

### Network Configuration

Both compose files use custom bridge networks:
- **Production**: `gatrix-network` (172.20.0.0/16)
- **Development**: `gatrix-dev-network` (172.21.0.0/16)

## 📊 Volume Management

### List Volumes
```bash
docker volume ls | grep gatrix
```

### Backup Volume
```bash
# Backup MySQL data
docker run --rm -v gatrix_mysql_data:/data -v $(pwd):/backup alpine tar czf /backup/mysql_backup.tar.gz -C /data .

# Backup ClickHouse data
docker run --rm -v gatrix_clickhouse_data:/data -v $(pwd):/backup alpine tar czf /backup/clickhouse_backup.tar.gz -C /data .
```

### Restore Volume
```bash
# Restore MySQL data
docker run --rm -v gatrix_mysql_data:/data -v $(pwd):/backup alpine tar xzf /backup/mysql_backup.tar.gz -C /data

# Restore ClickHouse data
docker run --rm -v gatrix_clickhouse_data:/data -v $(pwd):/backup alpine tar xzf /backup/clickhouse_backup.tar.gz -C /data
```

### Remove Volumes (⚠️ Data Loss)
```bash
# Remove all Gatrix volumes
docker volume rm $(docker volume ls -q | grep gatrix)
```

## 🔍 Troubleshooting

### Check Service Health
```bash
docker compose ps
```

### View Service Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend

# Last 100 lines
docker compose logs --tail=100 backend
```

### Restart Service
```bash
docker compose restart backend
```

### Rebuild Service
```bash
docker compose up -d --build backend
```

### Access Service Shell
```bash
docker compose exec backend sh
docker compose exec mysql mysql -u root -p
docker compose exec redis redis-cli
```

### Check Resource Usage
```bash
docker stats
```

## 🚨 Common Issues

### Port Already in Use
```bash
# Find process using port
lsof -i :3306  # macOS/Linux
netstat -ano | findstr :3306  # Windows

# Change port in .env file
DB_PORT=3307
```

### Service Won't Start
```bash
# Check logs
docker compose logs backend

# Remove and recreate
docker compose down
docker compose up -d
```

### Database Connection Failed
```bash
# Wait for MySQL to be ready
docker compose exec mysql mysqladmin ping -h localhost -u root -p

# Check health status
docker compose ps
```

## 📚 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Docker Compose v2 Migration](https://docs.docker.com/compose/migrate/)
- [Gatrix Backend README](packages/backend/README.md)
- [Gatrix Chat Server README](packages/chat-server/README.md)
- [Event Lens Setup Guide](EVENT_LENS_SETUP_GUIDE.md)

