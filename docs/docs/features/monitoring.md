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

- Prometheus: host 59091 -> container 9090
- Grafana: host 54000 -> container 3000
- Chat server metrics (existing): host 59090 -> container 9090

You can override host ports via environment variables:
- `PROMETHEUS_PORT` (default 59091)
- `GRAFANA_PORT` (default 54000)

## Environment Variables

Prometheus (both dev/prod):
- `PROM_SCRAPE_INTERVAL`: default `15s`
- `PROM_RETENTION_TIME`: default `14d`

Grafana (both dev/prod):
- `GRAFANA_ADMIN_USER`: default `admin` (mapped to `GF_SECURITY_ADMIN_USER`)
- `GRAFANA_ADMIN_PASSWORD`: default `admin` (mapped to `GF_SECURITY_ADMIN_PASSWORD`)
- `GF_USERS_ALLOW_SIGN_UP`: defaults to `false`

Frontend:
- `VITE_GRAFANA_URL`: Optional. If set, the Admin Panel shortcut uses this URL; otherwise it defaults to `http(s)://<host>:54000`.

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

## Admin Panel Integration

- Sidebar adds a "Grafana" item under the Admin Panel section.
- Opens in a new tab and honors `VITE_GRAFANA_URL` when provided.
- Localization keys were added in `en.json`, `ko.json`, `zh.json` (checked for duplicates).

## How to Run (Local/Docker)

1) Build the monorepo

- `yarn build` (or `yarn build:backend && yarn build:frontend && yarn build:event-lens && yarn build:chat-server`)

2) Development stack

- `yarn docker:dev` to start all dev services (including Prometheus and Grafana)
- Access Grafana: http://localhost:54000
- Access Prometheus: http://localhost:59091

3) Production-like stack

- `yarn docker:up` to start services with production compose
- Access Grafana: http://localhost:54000
- Access Prometheus: http://localhost:59091

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

- Prometheus has a `Targets` page to verify discovered endpoints.
- If targets are missing, check the Backend HTTP-SD endpoint and service discovery configuration.
- Ensure ports do not conflict (chat metrics use 59090/9090; Prometheus uses 59091/9090).

## Internationalization

- All UI labels for the Grafana menu item are localized (ko/en/zh).
- When adding new guidance strings, ensure localization keys are unique and friendly (Korean guidelines ending with "...합니다.").

