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

## Production-like

```bash
# Bring up production-like stack
docker compose up -d

# Tear down
docker compose down --remove-orphans
```

Access:
- Grafana: http://localhost:54000
- Prometheus: http://localhost:59091

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

