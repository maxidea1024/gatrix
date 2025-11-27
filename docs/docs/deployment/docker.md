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

Both Prometheus and Grafana use Docker volumes configured in docker-compose files to persist data.

## Team Rule

Do not use restart on Docker; prefer down -> up for restarts.

## Monitoring

For Prometheus + Grafana setup details and environment variables, see: /docs/features/monitoring

