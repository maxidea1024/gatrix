# Gatrix Docker Swarm Deployment

Production deployment configuration using Docker Swarm for orchestration.

## Features

- **Rolling Updates**: Zero-downtime deployments with automatic rollback on failure
- **Service Scaling**: Scale services up/down based on traffic
- **Rollback**: Instant rollback to previous versions
- **Health Checks**: Automatic container health monitoring
- **Secret Management**: Secure storage for sensitive data
- **Load Balancing**: Built-in service mesh and load balancing

## Prerequisites

- Docker 20.10+
- Docker Swarm initialized
- Access to Tencent Cloud Registry

## Quick Start

### 1. Initialize Swarm Cluster

```bash
# On the manager node
docker swarm init

# Add worker nodes (optional)
docker swarm join-token worker
# Run the generated command on worker nodes
```

### 2. Configure Environment

```bash
cd deploy
cp .env.example .env
# Edit .env with your production values
vim .env
```

### 3. Initial Deployment

```bash
# Deploy with initialization (creates secrets)
./deploy.sh --init --version 1.0.0
```

## Scripts Reference

| Script | Description |
|--------|-------------|
| `deploy.sh` | Deploy or update the entire stack |
| `update.sh` | Rolling update for specific services |
| `rollback.sh` | Rollback services to previous version |
| `scale.sh` | Scale services up/down |
| `status.sh` | View stack and service status |

## Deployment Workflows

### New Deployment

```bash
./deploy.sh --init --version 1.0.0
```

### Rolling Update

```bash
# Update all services to new version
./update.sh --version 1.1.0 --all

# Update specific service
./update.sh --version 1.1.0 --service backend
```

### Rollback

```bash
# Rollback a specific service
./rollback.sh --service backend

# Rollback all services
./rollback.sh --all
```

### Scaling

```bash
# Scale specific service
./scale.sh --service backend --replicas 4

# Use presets
./scale.sh --preset minimal    # 1 replica each
./scale.sh --preset standard   # 2 replicas for critical services
./scale.sh --preset high       # 4+ replicas for peak traffic

# View current scaling
./scale.sh --status
```

### Status Monitoring

```bash
# View all status
./status.sh

# View services
./status.sh --services

# View running tasks
./status.sh --tasks

# View health
./status.sh --health

# Stream logs
./status.sh --logs backend
```

## Scaling Presets

| Preset | backend | frontend | event-lens | chat-server | edge |
|--------|---------|----------|------------|-------------|------|
| minimal | 1 | 1 | 1 | 1 | 1 |
| standard | 2 | 2 | 1 | 2 | 2 |
| high | 4 | 4 | 2 | 4 | 4 |

## Update Configuration

Default rolling update settings:
- `parallelism: 1` - Update one container at a time
- `delay: 10s` - Wait between updates
- `failure_action: rollback` - Auto-rollback on failure
- `monitor: 30s` - Monitor period after update
- `order: start-first` - Start new container before stopping old

## Secret Management

Secrets are created during `--init` deployment:

| Secret | Description |
|--------|-------------|
| `db_root_password` | MySQL root password |
| `db_password` | Application database password |
| `jwt_secret` | JWT signing key |
| `jwt_refresh_secret` | JWT refresh token key |
| `session_secret` | Session encryption key |
| `api_secret` | Internal API authentication |
| `edge_api_token` | Edge server API token |
| `grafana_password` | Grafana admin password |

To update a secret:
```bash
# Remove old secret (must remove services using it first)
docker secret rm jwt_secret

# Create new secret
echo -n "new-secret-value" | docker secret create jwt_secret -

# Redeploy affected services
./deploy.sh --version 1.0.0
```

## Network Architecture

- `gatrix-internal`: Internal overlay network (isolated)
- `gatrix-public`: Public-facing overlay network

## Troubleshooting

### Check service logs
```bash
docker service logs gatrix_backend --follow --tail 100
```

### Check task status
```bash
docker service ps gatrix_backend --no-trunc
```

### Force service update
```bash
docker service update --force gatrix_backend
```

### Remove stack
```bash
docker stack rm gatrix
```

