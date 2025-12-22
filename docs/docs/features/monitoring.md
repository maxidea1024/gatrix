---
sidebar_position: 9
---

# Monitoring (Prometheus + Grafana)

This guide explains how Gatrix integrates Prometheus and Grafana for monitoring in both development and production.

## Overview

- Prometheus scrapes metrics from services discovered via Backend HTTP-SD endpoint using existing etcd/Redis service discovery.
- Grafana is pre-provisioned to use Prometheus as the default data source and ships with a starter dashboard.
- Admin Panel has a Grafana shortcut at the bottom of the sidebar (opens in a new tab).

## Architecture

- Prometheus
  - Runs in Docker.
  - Retention and scrape interval are configurable via environment variables.
  - Targets are discovered dynamically from Backend: `/api/v1/public/monitoring/prometheus/targets`.
- Backend HTTP Service Discovery
  - Uses serviceDiscoveryService.getServices() to fetch active services from etcd/Redis.
  - Exposes Prometheus HTTP-SD JSON with each service's `internalAddress` and a suitable `metrics_path`.
- Grafana
  - Runs in Docker.
  - Auto-provisioned with Prometheus datasource (http://prometheus:9090) and a sample "Gatrix Overview" dashboard.

## Ports

- Prometheus: host 49090 -> container 9090
- Grafana: host 44000 -> container 3000

You can override host ports via environment variables:
- `PROMETHEUS_PORT` (default 49090)
- `GRAFANA_PORT` (default 44000)

## Environment Variables

Prometheus (both dev/prod):
- `PROM_SCRAPE_INTERVAL`: default `15s`
- `PROM_RETENTION_TIME`: default `14d`

Grafana (both dev/prod):
- `GRAFANA_ADMIN_USER`: default `admin` (mapped to `GF_SECURITY_ADMIN_USER`)
- `GRAFANA_ADMIN_PASSWORD`: default `admin` (mapped to `GF_SECURITY_ADMIN_PASSWORD`)
- `GF_USERS_ALLOW_SIGN_UP`: defaults to `false`

Frontend:
- `VITE_GRAFANA_URL`: Optional. If set, the Admin Panel shortcut uses this URL; otherwise it defaults to `http(s)://<host>:44000`.

## Docker Compose

Development:
- Services added: `prometheus`, `grafana`
- Persistent volumes: `prometheus_dev_data`, `grafana_dev_data`
- Prometheus entrypoint performs env substitution and starts Prometheus with `--web.enable-lifecycle`.

Production:
- Services added: `prometheus`, `grafana`
- Persistent volumes: `prometheus_data`, `grafana_data`

Files:
- `docker/prometheus/prometheus.base.yml` (template; interval injected by entrypoint)
- `docker/prometheus/entrypoint.sh`
- `docker/grafana/provisioning/datasources/datasource.yml`
- `docker/grafana/provisioning/dashboards/dashboards.yml`
- `docker/grafana/dashboards/gatrix-overview.json`

## Backend HTTP-SD Endpoint

Path: `/api/v1/public/monitoring/prometheus/targets`

Behavior:
- Returns an array of target groups in Prometheus HTTP-SD format.
- Uses each service's `internalAddress` and determines a metrics port/path per service type (e.g., chat -> 9090 `/metrics`).
- Safe fallback: returns `[]` on internal errors to avoid Prometheus failures.

## Enabling Metrics Per Service

- Chat Server: Already integrated via `prom-client`. Enable with `MONITORING_ENABLED=true`, metrics served on `METRICS_PORT=9090`.
- Backend & Event Lens: Planned to use `prom-client` similarly to Chat Server.
  - Add `/metrics` endpoint guarded by `MONITORING_ENABLED`.
  - Expose default process metrics and HTTP request metrics.

Note: We will request permission before installing new dependencies (prom-client) in these packages.

## SDK Metrics Server

The Server SDK provides an independent metrics server for Prometheus scraping. All services using the SDK can expose metrics on a consistent port (default: 9337).

### Quick Setup

```typescript
import { GatrixServerSDK, createMetricsServer, getLogger } from '@gatrix/server-sdk';

const logger = getLogger('MY-SERVER');

// Create SDK with required identification fields
const sdk = new GatrixServerSDK({
  gatrixUrl: 'http://localhost:45000',
  apiToken: 'your-api-token',
  applicationName: 'my-game-server',
  service: 'worldd',       // Required: service name
  group: 'kr-1',           // Required: service group
  environment: 'env_prod', // Required: environment
  metrics: {
    port: 9337,            // Optional: default is 9337
  },
});

// Create standalone metrics server
const metricsServer = createMetricsServer({
  port: 9337,
  applicationName: 'my-game-server',
  service: 'worldd',
  group: 'kr-1',
  environment: 'env_prod',
  logger,
});

// Start metrics server
metricsServer.start();
```

### Default Labels

All SDK metrics automatically include these default labels:
- `sdk`: `gatrix-server-sdk`
- `service`: Service name from config
- `group`: Service group from config
- `environment`: Environment from config
- `application`: Application name from config

These labels enable filtering and aggregation in Grafana dashboards.

### Service Discovery Integration

When registering a service, the SDK automatically reports the `metricsApi` port:

```typescript
const result = await sdk.registerService({
  labels: { service: 'worldd', group: 'kr-1' },
  ports: {
    game: 7777,   // Named port: { serviceName: port }
    web: 8080,
    // metricsApi is automatically added from SDK config (default: 9337)
  },
  status: 'ready',
});
```

Prometheus can then discover and scrape metrics from all registered services via the Backend HTTP-SD endpoint.

### Custom Metrics

```typescript
// Create custom metrics
const playersOnline = metricsServer.createGauge(
  'players_online',
  'Number of players currently online',
  ['server_id']
);

// Update metrics
playersOnline.labels('world-1').set(150);
```

## Admin Panel Integration

- Sidebar adds a "Grafana" item under the Admin Panel section.
- Opens in a new tab and honors `VITE_GRAFANA_URL` when provided.
- Localization keys were added in `en.json`, `ko.json`, `zh.json` (checked for duplicates).

## How to Run (Local/Docker)

1) Build the monorepo

- `yarn build` (or `yarn build:backend && yarn build:frontend && yarn build:event-lens && yarn build:chat-server`)

2) Development stack

- `yarn docker:dev` to start all dev services (including Prometheus and Grafana)
- Access Grafana: http://localhost:44000
- Access Prometheus: http://localhost:49090

3) Production-like stack

- `yarn docker:up` to start services with production compose
- Access Grafana: http://localhost:44000
- Access Prometheus: http://localhost:49090

4) Restart policy

- Please use `docker-compose down` then `up` (do not use `restart`), per team rules.

## Custom Metrics Guide (Preview)

Once `prom-client` is enabled for Backend/Event Lens:
- Counter example:
  - Name: `http_requests_total`
  - Labels: `method`, `route`, `status`
- Histogram example:
  - Name: `http_request_duration_seconds`
  - Labels: `method`, `route`, `status`

Implementation pattern (Node.js/Express):
- Initialize metrics registry on app start when `MONITORING_ENABLED=true`.
- Expose `/metrics` endpoint returning `text/plain; version=0.0.4`.
- Avoid side effects at import time; initialize explicitly inside a bootstrap function.

## Security Notes

- Default Grafana admin credentials are `admin/admin`. Change them via env vars in production.
- Prometheus UI should be internal-only in production or protected via reverse proxy.

## Troubleshooting

### Prometheus Targets

- Prometheus has a `Targets` page to verify discovered endpoints.
- If targets are missing, check the Backend HTTP-SD endpoint and service discovery configuration.
- Ensure ports do not conflict (Prometheus uses 49090/9090).

### Host-Based Game Server Metrics (Docker Environment)

When Prometheus runs in Docker but game servers run on the host (via PM2), Prometheus cannot access host IPs directly.

**Solution**: The Backend automatically converts host IPs to `host.docker.internal` when `RUNNING_IN_DOCKER=true`:

1. Add to `docker-compose.yml` (backend service):
   ```yaml
   environment:
     RUNNING_IN_DOCKER: "true"
   ```

2. Add to `docker-compose.yml` (prometheus service):
   ```yaml
   extra_hosts:
     - "host.docker.internal:host-gateway"
   ```

### Grafana Logs Dashboard Not Showing All Log Levels

If the Grafana Logs dashboard only shows `info` logs even when `level=All` is selected:

**Root Cause**: Loki requires labels in stream selectors to **exist** on log lines. If `externalIp` or `internalIp` labels are missing from some logs (e.g., error logs), those logs are filtered out.

**Solution**: 
1. Move optional labels (`internalIp`, `externalIp`) from **stream selector** to **log pipeline filter**:
   - Before: `{job="gatrix", level=~"$level", internalIp=~"...", externalIp=~"..."}`
   - After: `{job="gatrix", level=~"$level"} | json | internalIp=~"..." | externalIp=~"..."`

2. Add `allValue: ".*"` to all multi-select variables in the dashboard JSON:
   ```json
   {
     "name": "service",
     "includeAll": true,
     "allValue": ".*",
     "multi": true
   }
   ```

3. Restart Grafana: `docker restart gatrix-grafana-dev`

## Internationalization

- All UI labels for the Grafana menu item are localized (ko/en/zh).
- When adding new guidance strings, ensure localization keys are unique and friendly (Korean guidelines ending with "...합니다.").

## External Log Collection (Non-Docker) via Promtail

For game servers running outside of Docker (using PM2), logs are collected using **Promtail** and forwarded to Loki.

### Architecture

- **Loki**: Central log store (running in Docker).
- **Promtail**: Log agent (running in Docker) that monitors host log files.
- **Fluent Bit**: Collects logs from Docker containers and sends them to Loki.

### Configuration

Promtail is configured to watch the PM2 log directory on the host machine:

- **Host Path**: `C:/Users/jhseo/.pm2/logs/*.log`
- **Container Path**: `/mnt/pm2logs/*.log` (mounted as read-only)

The configuration file is located at `docker/promtail/promtail-config.yml`.

### How to access host logs in Docker

In `docker-compose.yml`, the host directory is mounted to the Promtail container:

```yaml
  promtail:
    image: grafana/promtail:latest
    container_name: gatrix-promtail
    volumes:
      - ./docker/promtail/promtail-config.yml:/etc/promtail/config.yml:ro
      - C:/Users/jhseo/.pm2/logs:/mnt/pm2logs:ro
    command: -config.file=/etc/promtail/config.yml
```

### Log Pipeline

The Promtail config includes a multiline stage to correctly handle stack traces and multi-line log entries by grouping lines that start with a date/time pattern.

- **First line pattern**: `^(\d{4}-\d{2}-\d{2}|\d{2}/\d{2} \d{2}:\d{2}:\d{2})`
- **Labels added**: `job="game-servers"`, `host="host-machine"`

In Grafana, these logs can be queried using `{job="game-servers"}`.

