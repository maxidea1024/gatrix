---
slug: /deployment/docker
title: Docker Deployment Guide
sidebar_position: 50
---

# Docker Deployment Guide

This page explains how to run Gatrix with Docker in both development and production-like environments.

## Prerequisites

- Docker 20.10+
- Docker Compose v2+
- Yarn workspaces installed (for local builds)

## Ports

- Prometheus: host 49090 -> container 9090
- Grafana: host 44000 -> container 3000
- Backend API: host 45000 -> container 5000
- Event Lens: host 45200 -> container 5200
- Chat Server: host 45100 -> container 5100
- Frontend: host 43000 -> container 80 / 3000
- Loki: host 43100 -> container 3100
- ClickHouse: host 48123 -> container 8123, host 49000 -> container 9000
- Redis: host 46379 -> container 6379
- MySQL: host 43306 -> container 3306
- etcd: host 42379 -> container 2379, host 42380 -> container 2380

## Environment Variables (selected)

### Monitoring

- `PROM_SCRAPE_INTERVAL` (default: 15s)
- `PROM_RETENTION_TIME` (default: 14d)
- `GRAFANA_ADMIN_USER` (default: admin)
- `GRAFANA_ADMIN_PASSWORD` (default: admin)
- `MONITORING_ENABLED` (true/false)

### Edge Server

| Variable                    | Default                             | Description                                                                               |
| --------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `EDGE_PORT`                 | 3400                                | Edge server port                                                                          |
| `EDGE_METRICS_PORT`         | 9400                                | Metrics endpoint port (internal only)                                                     |
| `EDGE_BYPASS_TOKEN`         | `gatrix-edge-internal-bypass-token` | Bypass token for all environments and internal APIs                                       |
| `EDGE_APPLICATION_NAME`     | `edge-server`                       | Application name for SDK identification                                                   |
| `EDGE_ENVIRONMENTS`         | `*`                                 | Target environments. Use `*` for all environments (multi-env mode) or comma-separated IDs |
| `CACHE_SYNC_METHOD`         | `event`                             | Cache sync method: `event` (Redis PubSub real-time), `polling`, or `manual`               |
| `CACHE_POLLING_INTERVAL_MS` | 60000                               | Polling interval in ms (only used when `CACHE_SYNC_METHOD=polling`)                       |
| `EDGE_LOG_LEVEL`            | `info` (prod) / `debug` (dev)       | Log level                                                                                 |

**Multi-Environment Mode (`EDGE_ENVIRONMENTS=*`):**

- Edge server caches data for ALL environments dynamically
- Automatically syncs when new environments are created/deleted via Redis PubSub
- Each API endpoint filters data by the requested environment

**Event Mode (`CACHE_SYNC_METHOD=event`):**

- Uses Redis PubSub for real-time cache synchronization
- Cache is updated immediately when backend publishes events
- Requires Redis connection
- Recommended for production use

## Development

```bash
# Bring up dev stack (includes Prometheus and Grafana)
docker compose -f docker-compose.dev.yml up -d

# Tear down
docker compose -f docker-compose.dev.yml down --remove-orphans
```

Access:

- Grafana: http://localhost:44000
- Prometheus: http://localhost:49090
- Backend: http://localhost:45000

## Production-like (Local Build)

```bash
# Bring up production-like stack (builds images locally)
docker compose up -d

# Tear down
docker compose down --remove-orphans
```

Access:

- Grafana: http://localhost:44000
- Prometheus: http://localhost:49090

## Production Deployment (Pre-built Images)

Production environments use pre-built images from Tencent Cloud Registry.

### Registry Information

- **Registry**: `your-registry.example.com`
- **Namespace**: `gatrix`
- **Image**: `gatrix`
- **Tag Format**: `{service}-{version}` (e.g., `backend-1.0.0`, `frontend-latest`)

### Building and Pushing Images

#### Available Commands

| Command                       | Description                                   |
| ----------------------------- | --------------------------------------------- |
| `yarn docker:build:prod`      | Build all service images (no version bump)    |
| `yarn docker:build:prod:push` | Bump patch version, build and push all images |
| `yarn docker:push`            | Push already built images                     |
| `yarn docker:login`           | Login to Tencent Cloud Registry               |

#### Script Options

```bash
# Show help
yarn docker:build:prod --help

# Build all services without version bump
yarn docker:build:prod

# Bump patch version, build and push
yarn docker:build:prod --bump patch --push

# Bump minor version for a specific service
yarn docker:build:prod --bump minor --service backend --push

# Build only frontend
yarn docker:build:prod --service frontend
```

**Options:**

- `--bump, -b <type>`: Version bump type (`patch`, `minor`, `major`)
- `--push, -p`: Push to registry after building
- `--service, -s <name>`: Service to build (`backend`, `frontend`, `event-lens`, `chat-server`, `edge`, `all`)
- `--login, -l`: Login to registry before pushing
- `--help, -h`: Show help message

### Running Production Stack

```bash
# Set the version to deploy
export GATRIX_VERSION=1.0.0

# Pull latest images
yarn docker:prod:pull

# Start production stack
yarn docker:prod

# View logs
yarn docker:prod:logs

# Stop production stack
yarn docker:prod:down
```

### Production Environment Variables

Create a `.env` file with production settings:

```env
# Version
GATRIX_VERSION=1.0.0

# Data storage
DATA_ROOT=/data/gatrix

# Database
DB_ROOT_PASSWORD=secure-root-password
DB_NAME=gatrix
DB_USER=gatrix_user
DB_PASSWORD=secure-db-password

# Security
JWT_SECRET=your-production-jwt-secret
JWT_REFRESH_SECRET=your-production-refresh-secret
SESSION_SECRET=your-production-session-secret

# Admin
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=secure-admin-password

# Monitoring
MONITORING_ENABLED=true
GRAFANA_ADMIN_PASSWORD=secure-grafana-password
```

### Image Tags

Each service generates two tags:

- **Version tag**: `{service}-{version}` (e.g., `backend-1.2.3`)
- **Latest tag**: `{service}-latest` (e.g., `backend-latest`)

**Services:**

- `backend` - Backend API server
- `frontend` - Frontend Nginx server
- `event-lens` - Event analytics server
- `chat-server` - WebSocket chat server
- `edge` - Edge server for clients

## Docker Swarm Deployment

For production environments with high availability requirements, use Docker Swarm orchestration.

### Available Commands

| Command                  | Description                          |
| ------------------------ | ------------------------------------ |
| `yarn swarm:deploy`      | Deploy stack to Swarm                |
| `yarn swarm:deploy:init` | Initial deployment (creates secrets) |
| `yarn swarm:update`      | Rolling update services              |
| `yarn swarm:rollback`    | Rollback to previous version         |
| `yarn swarm:scale`       | Scale services                       |
| `yarn swarm:status`      | View stack status                    |

### Quick Start

```bash
# Initialize Swarm cluster
docker swarm init

# Configure environment
cd deploy
cp .env.example .env
vim .env

# Initial deployment
./deploy.sh --init --version 1.0.0
```

### Key Features

- **Rolling Updates**: Zero-downtime deployments
- **Auto-Rollback**: Automatic rollback on failure
- **Scaling Presets**: minimal, standard, high
- **Secret Management**: Secure credential storage
- **Health Monitoring**: Automatic health checks

For detailed Swarm documentation, see the `deploy/README.md` file in the repository root.

## Data Persistence

All persistent data (MySQL, Redis, ClickHouse, logs, etc.) is stored under the `DATA_ROOT` path.

### Volume Configuration

The `DATA_ROOT` environment variable controls where all Docker volumes are stored:

| Service             | Host Path / Volume                 | Container Path        |
| ------------------- | ---------------------------------- | --------------------- |
| MySQL               | `${DATA_ROOT}/mysql`               | `/var/lib/mysql`      |
| Redis               | `${DATA_ROOT}/redis`               | `/data`               |
| ClickHouse          | `clickhouse-data` (named volume)   | `/var/lib/clickhouse` |
| Backend Logs        | `${DATA_ROOT}/backend/logs`        | `/app/logs`           |
| Backend Data        | `${DATA_ROOT}/backend/data`        | `/app/data`           |
| Event Lens Logs     | `${DATA_ROOT}/event-lens/logs`     | `/app/logs`           |
| Chat Server Uploads | `${DATA_ROOT}/chat-server/uploads` | `/app/uploads`        |
| Chat Server Logs    | `${DATA_ROOT}/chat-server/logs`    | `/app/logs`           |
| etcd                | `${DATA_ROOT}/etcd`                | `/etcd-data`          |
| Prometheus          | `${DATA_ROOT}/prometheus`          | `/prometheus`         |
| Grafana             | `${DATA_ROOT}/grafana`             | `/var/lib/grafana`    |
| Loki                | `${DATA_ROOT}/loki`                | `/loki`               |

### Environment Setup

**Development** (`.env`):

```env
DATA_ROOT=./data
```

Result: All data stored in `./data/mysql`, `./data/redis`, etc. (relative to project root)

**Production** (`.env`):

```env
DATA_ROOT=/data/gatrix
```

Result: All data stored in `/data/gatrix/mysql`, `/data/gatrix/redis`, etc. (absolute path)

### Directory Structure

```
${DATA_ROOT}/
?��??� mysql/              # MySQL database files
?��??� redis/              # Redis persistence
?��??� backend/
??  ?��??� logs/           # Backend application logs
??  ?��??� data/           # Backend data files
?��??� event-lens/
??  ?��??� logs/           # Event Lens logs
?��??� chat-server/
??  ?��??� uploads/        # User uploaded files
??  ?��??� logs/           # Chat server logs
?��??� etcd/               # etcd cluster data
?��??� prometheus/         # Prometheus metrics storage
?��??� grafana/            # Grafana dashboards & settings
?��??� loki/               # Loki log aggregation

# Managed by Docker (named volumes):
# - clickhouse-data     # ClickHouse data (use docker volume commands)
```

### Important Notes

1. **Directory Permissions**: Ensure the `DATA_ROOT` directory has proper permissions for Docker to read/write
2. **Data Migration**: When switching from named volumes to bind mounts, existing data needs to be migrated manually
3. **Backup**: All persistent data is in one location, making backup easier

### ClickHouse Named Volume

**ClickHouse uses a Docker named volume (`clickhouse-data`) instead of a bind mount.** This is intentional and should not be changed.

#### Why Named Volume?

ClickHouse's MergeTree storage engine uses atomic file rename operations during data writes:

1. Data is first written to a temporary directory (`tmp_insert_*`)
2. The directory is atomically renamed to its final location

This works perfectly on native Linux filesystems but **fails on certain configurations**:

- **Windows Docker Desktop**: NTFS bind mounts don't support atomic renames properly
- **Some network filesystems**: NFS/CIFS may have similar issues

**Symptoms of bind mount issues:**

```
filesystem error: in rename: No such file or directory
["/var/lib/clickhouse/store/.../tmp_insert_202512_1_1_0/"]
["/var/lib/clickhouse/store/.../202512_1_1_0/"]
```

#### Volume Management

Since ClickHouse uses a named volume, data is managed differently:

```bash
# List Docker volumes
docker volume ls | grep clickhouse

# Inspect volume
docker volume inspect gatrix_clickhouse-data

# Backup ClickHouse data
docker run --rm -v gatrix_clickhouse-data:/source -v $(pwd):/backup alpine \
  tar czf /backup/clickhouse-backup.tar.gz -C /source .

# Restore ClickHouse data
docker run --rm -v gatrix_clickhouse-data:/target -v $(pwd):/backup alpine \
  tar xzf /backup/clickhouse-backup.tar.gz -C /target

# Remove volume (WARNING: deletes all ClickHouse data)
docker volume rm gatrix_clickhouse-data
```

#### If You Must Use Bind Mount (Linux Only)

If you need bind mount for easier data access on a Linux server, ensure:

1. The host is running native Linux (not WSL or Docker Desktop)
2. The filesystem is ext4 or XFS
3. Add to docker-compose:

```yaml
volumes:
  - ${DATA_ROOT}/clickhouse:/var/lib/clickhouse
```

**Note**: This is not recommended and may cause issues on some systems.

## Team Rule

Do not use restart on Docker; prefer down -> up for restarts.

## Monitoring

For Prometheus + Grafana setup details and environment variables, see: [Monitoring](../features/monitoring)
