# Gatrix Edge Server (Node.js)

Gatrix Edge Server — a lightweight caching proxy built with Node.js/TypeScript. It caches all Gatrix backend data locally and serves client/server SDK requests without hitting the backend on every call.

## Features

- 🚀 **Local caching** — All Gatrix data (game worlds, feature flags, notices, etc.) cached in memory
- 🔄 **Real-time sync** — Redis PubSub event-driven cache invalidation or polling
- 🌍 **Multi-environment** — Wildcard mode caches all environments simultaneously
- 🏳️ **Feature flags** — Full local evaluation with no backend roundtrip
- 🔌 **SDK-compatible API** — Drop-in replacement for direct backend calls in client/server SDKs
- 📊 **Metrics** — Built-in Prometheus metrics endpoint
- 🩺 **Health check** — Built-in `/health` endpoint

## Requirements

- Node.js >= 22
- Redis (optional, for event-based cache sync)
- Gatrix Backend running and reachable

## Quick Start

```bash
cd packages/edge
yarn install
yarn dev
```

### With Docker

```bash
# Build from monorepo root
docker build -f packages/edge/Dockerfile -t gatrix-edge .

# Run
docker run -p 3400:3400 -p 9400:9400 \
  -e EDGE_GATRIX_URL=http://backend:5000 \
  -e EDGE_API_TOKEN=your-bypass-token \
  gatrix-edge
```

## Configuration

Configure via environment variables.

| Variable                   | Default                 | Description                                  |
| -------------------------- | ----------------------- | -------------------------------------------- |
| `EDGE_PORT`                | `3400`                  | Main API port                                |
| `EDGE_METRICS_PORT`        | `9400`                  | Prometheus metrics port                      |
| `EDGE_GATRIX_URL`          | `http://localhost:5000` | Gatrix backend URL                           |
| `EDGE_API_TOKEN`           | —                       | Bypass API token                             |
| `EDGE_APPLICATION_NAME`    | `edge-server`           | Application name                             |
| `EDGE_ENVIRONMENT`         | `production`            | Default environment                          |
| `EDGE_ENVIRONMENTS`        | —                       | Comma-separated environments, or `*` for all |
| `EDGE_SYNC_METHOD`         | `polling`               | `polling` \| `event` \| `manual`             |
| `EDGE_POLLING_INTERVAL_MS` | `30000`                 | Polling interval in milliseconds             |
| `REDIS_HOST`               | `localhost`             | Redis host                                   |
| `REDIS_PORT`               | `6379`                  | Redis port                                   |
| `REDIS_PASSWORD`           | —                       | Redis password (optional)                    |

### Cache Sync Methods

| Method    | Redis Required | Description                                        |
| --------- | -------------- | -------------------------------------------------- |
| `polling` | ❌              | Refresh cache periodically                         |
| `event`   | ✅              | Refresh immediately via Redis PubSub (recommended) |
| `manual`  | ❌              | No automatic refresh                               |

## Ports

| Port   | Purpose                                      |
| ------ | -------------------------------------------- |
| `3400` | Client SDK API, Server SDK API, Health check |
| `9400` | Prometheus metrics (internal only)           |

## API Endpoints

### Client SDK endpoints
- `GET /api/v1/client/:env/...` — All client SDK data endpoints

### Server SDK endpoints
- `GET /api/v1/server/:env/...` — All server SDK data endpoints

### Public
- `GET /health` — Health check
- `GET /metrics` — Prometheus metrics (port 9400)

## Development

```bash
yarn dev        # Start with hot reload
yarn build      # Build TypeScript
yarn lint       # Run ESLint
```

### Development Docker

```bash
# Build from monorepo root
docker build -f packages/edge/Dockerfile.dev -t gatrix-edge-dev .

docker run -p 1400:1400 -p 9400:9400 \
  -e EDGE_GATRIX_URL=http://host.docker.internal:5000 \
  gatrix-edge-dev
```

## docker-compose Example

```yaml
services:
  edge:
    build:
      context: ../..   # monorepo root
      dockerfile: packages/edge/Dockerfile
    ports:
      - "3400:3400"
    environment:
      - EDGE_GATRIX_URL=http://backend:5000
      - EDGE_API_TOKEN=gatrix-edge-internal-bypass-token
      - EDGE_ENVIRONMENTS=*
      - EDGE_SYNC_METHOD=event
      - REDIS_HOST=redis
    depends_on:
      - backend
      - redis
```
