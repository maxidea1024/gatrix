---
slug: /monitoring/setup
title: Monitoring Setup
sidebar_position: 51
---

# Monitoring Setup

This page provides a quick entry point for setting up Prometheus and Grafana.

For the complete guide, see: [/docs/features/monitoring](/docs/features/monitoring)

## Quick Steps

1) Start the dev stack (Prometheus + Grafana included)

```bash
docker compose -f docker-compose.dev.yml up -d
```

2) Access UIs
- Grafana: http://localhost:44000
- Prometheus: http://localhost:49090

3) Enable metrics per service
- Set `MONITORING_ENABLED=true`
- Default metrics path `/metrics`

4) Service discovery
- Prometheus scrapes targets from Backend HTTP-SD endpoint:
  - `/api/v1/public/monitoring/prometheus/targets`

5) Restart policy
- Use `docker compose down` then `up` (do not use `restart`).

6) Direct Log Push (SDK)
- Game servers now push logs directly to Loki via the `@gatrix/server-sdk`.
- This eliminates the need for Promtail or file scraping.
- Configuration in `mconf.ts` (or `default.json5`):
  ```json5
  gatrix: {
    loki: {
      enabled: true,
      url: "http://localhost:43100/loki/api/v1/push"
    }
  }
  ```

