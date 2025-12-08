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

- Prometheus: host 59091 -> container 9090
- Grafana: host 54000 -> container 3000
- Chat Server metrics: host 59090 -> container 9090 (existing)
- Backend API: host 55000 -> container 5000
- Event Lens: host 53002 -> container 3002
- Chat Server: host 53001 -> container 3001
- etcd: host 52879 -> container 2379, host 52880 -> container 2380

## Environment Variables (selected)

- PROM_SCRAPE_INTERVAL (default: 15s)
- PROM_RETENTION_TIME (default: 14d)
- GRAFANA_ADMIN_USER (default: admin)
- GRAFANA_ADMIN_PASSWORD (default: admin)
- MONITORING_ENABLED (true/false)

## Development

```bash
# Bring up dev stack (includes Prometheus and Grafana)
docker compose -f docker-compose.dev.yml up -d

# Tear down
docker compose -f docker-compose.dev.yml down --remove-orphans
```

Access:
- Grafana: http://localhost:54000
- Prometheus: http://localhost:59091
- Backend: http://localhost:55000

## Production-like (Local Build)

```bash
# Bring up production-like stack (builds images locally)
docker compose up -d

# Tear down
docker compose down --remove-orphans
```

Access:
- Grafana: http://localhost:54000
- Prometheus: http://localhost:59091

## Production Deployment (Pre-built Images)

Production environments use pre-built images from Tencent Cloud Registry.

### Registry Information

- **Registry**: `uwocn.tencentcloudcr.com`
- **Namespace**: `uwocn`
- **Image**: `uwocn`
- **Tag Format**: `{service}-{version}` (e.g., `backend-1.0.0`, `frontend-latest`)

### Building and Pushing Images

#### Available Commands

| Command | Description |
|---------|-------------|
| `yarn docker:build:prod` | Build all service images (no version bump) |
| `yarn docker:build:prod:push` | Bump patch version, build and push all images |
| `yarn docker:push` | Push already built images |
| `yarn docker:login` | Login to Tencent Cloud Registry |

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

## Data Persistence

All persistent data (MySQL, Redis, ClickHouse, logs, etc.) is stored under the `DATA_ROOT` path.

### Volume Configuration

The `DATA_ROOT` environment variable controls where all Docker volumes are stored:

| Service | Host Path | Container Path |
|---------|-----------|----------------|
| MySQL | `${DATA_ROOT}/mysql` | `/var/lib/mysql` |
| Redis | `${DATA_ROOT}/redis` | `/data` |
| ClickHouse | `${DATA_ROOT}/clickhouse` | `/var/lib/clickhouse` |
| Backend Logs | `${DATA_ROOT}/backend/logs` | `/app/logs` |
| Backend Data | `${DATA_ROOT}/backend/data` | `/app/data` |
| Event Lens Logs | `${DATA_ROOT}/event-lens/logs` | `/app/logs` |
| Chat Server Uploads | `${DATA_ROOT}/chat-server/uploads` | `/app/uploads` |
| Chat Server Logs | `${DATA_ROOT}/chat-server/logs` | `/app/logs` |
| etcd | `${DATA_ROOT}/etcd` | `/etcd-data` |
| Prometheus | `${DATA_ROOT}/prometheus` | `/prometheus` |
| Grafana | `${DATA_ROOT}/grafana` | `/var/lib/grafana` |
| Loki | `${DATA_ROOT}/loki` | `/loki` |

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
├── mysql/              # MySQL database files
├── redis/              # Redis persistence
├── clickhouse/         # ClickHouse data
├── backend/
│   ├── logs/           # Backend application logs
│   └── data/           # Backend data files
├── event-lens/
│   └── logs/           # Event Lens logs
├── chat-server/
│   ├── uploads/        # User uploaded files
│   └── logs/           # Chat server logs
├── etcd/               # etcd cluster data
├── prometheus/         # Prometheus metrics storage
├── grafana/            # Grafana dashboards & settings
└── loki/               # Loki log aggregation
```

### Important Notes

1. **Directory Permissions**: Ensure the `DATA_ROOT` directory has proper permissions for Docker to read/write
2. **Data Migration**: When switching from named volumes to bind mounts, existing data needs to be migrated manually
3. **Backup**: All persistent data is in one location, making backup easier

## Team Rule

Do not use restart on Docker; prefer down -> up for restarts.

## Monitoring

For Prometheus + Grafana setup details and environment variables, see: /docs/features/monitoring

