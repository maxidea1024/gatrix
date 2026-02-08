---
slug: /deployment/edge-server
title: Edge Server Guide
sidebar_position: 51
---

# Edge Server Guide

The Edge server is a high-availability client-facing API gateway that caches Gatrix backend data and serves it to game clients and servers with low latency.

## Overview

````
?��??�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�??    ?��??�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�??    ?��??�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�????  Game Client   ?��??�?�?�?�│   Edge Server   ?��??�?�?�?�│    Backend      ???��??�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�??    ?��??�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�??    ?��??�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�??                               ??                       ??                               ??                       ??                        ?��??�?�?�?�?�?�?�?�?�?�?�?�??         ?��??�?�?�?�?�?�?�?�?�?�?�?�??                        ??   Cache    ?��??�?�?�?�?�?�?�?�?�??   Redis    ??                        ?? (In-Memory)?? PubSub  ??  PubSub    ??                        ?��??�?�?�?�?�?�?�?�?�?�?�?�??         ?��??�?�?�?�?�?�?�?�?�?�?�?�??```

## Key Features

- **Multi-Environment Support**: Cache data for all environments with `EDGE_ENVIRONMENTS=*`
- **Real-time Sync**: Redis PubSub for instant cache updates (`CACHE_SYNC_METHOD=event`)
- **Token Mirroring**: All API tokens are cached locally for fast validation
- **Environment-specific Filtering**: Each API filters data by the requested environment
- **Health Endpoints**: `/health` and `/health/cache` for monitoring

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `EDGE_PORT` | `3400` | Edge server port |
| `EDGE_METRICS_PORT` | `9400` | Prometheus metrics port (internal) |
| `EDGE_BYPASS_TOKEN` | `gatrix-edge-internal-bypass-token` | Bypass token for internal APIs |
| `EDGE_APPLICATION_NAME` | `edge-server` | Application name |
| `EDGE_ENVIRONMENTS` | `*` | Target environments (`*` for all, or comma-separated IDs) |
| `GATRIX_URL` | `http://localhost:5000` | Backend API URL |
| `CACHE_SYNC_METHOD` | `event` | Sync method: `event`, `polling`, or `manual` |
| `CACHE_POLLING_INTERVAL_MS` | `60000` | Polling interval (only for `polling` mode) |
| `LOG_LEVEL` | `info` | Log level |

### Redis Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | (empty) | Redis password |
| `REDIS_DB` | `0` | Redis database |

## Cache Sync Methods

### Event Mode (Recommended)

```yaml
CACHE_SYNC_METHOD: event
````

- Uses Redis PubSub for real-time synchronization
- Cache is updated immediately when backend publishes events
- No periodic polling overhead
- Recommended for production

**Supported Events:**

- `environment.created` / `environment.deleted`
- `game_world.created` / `game_world.updated` / `game_world.deleted`
- `popup_notice.created` / `popup_notice.updated` / `popup_notice.deleted`
- `survey.created` / `survey.updated` / `survey.deleted`
- `whitelist.updated`
- `api_token.created` / `api_token.updated` / `api_token.deleted`

### Polling Mode

```yaml
CACHE_SYNC_METHOD: polling
CACHE_POLLING_INTERVAL_MS: 60000
```

- Periodically fetches data from backend
- No Redis dependency for sync (still needed for token mirroring)
- Higher latency for updates

## API Endpoints

### Health Checks

| Endpoint            | Description        |
| ------------------- | ------------------ |
| `GET /health`       | Basic health check |
| `GET /health/ready` | Readiness check    |
| `GET /health/live`  | Liveness check     |

### Client APIs

All client APIs require authentication headers:

- `X-API-Token`: API access token
- `X-Application-Name`: Application name
- `X-Environment`: Environment ID (optional, uses token's default)

| Endpoint                         | Description     |
| -------------------------------- | --------------- |
| `GET /api/v1/client/versions`    | Client versions |
| `GET /api/v1/client/banners`     | Banners         |
| `GET /api/v1/client/notices`     | Service notices |
| `GET /api/v1/client/game-worlds` | Game worlds     |

### Internal APIs (Separate Port)

?�️ **Security Note**: Internal APIs run on a **separate port** (main port + 10) for security isolation. These endpoints should NOT be exposed to the public internet.

| Port   | Description                       |
| ------ | --------------------------------- |
| `3400` | Main Edge server (public-facing)  |
| `3410` | Internal server (operations only) |

| Endpoint         | Method | Description                                                             |
| ---------------- | ------ | ----------------------------------------------------------------------- |
| `/cache`         | GET    | Detailed cache status with per-environment counts and last refresh time |
| `/cache/refresh` | POST   | Force refresh all caches and return updated status                      |

**Example: Check cache status**

```bash
curl http://localhost:3410/cache
```

**Example: Force cache refresh**

```bash
curl -X POST http://localhost:3410/cache/refresh
```

## Health Check Response Example

```json
{
  "status": "ready",
  "timestamp": "2025-12-11T15:28:49.211Z",
  "summary": {
    "clientVersions": {
      "development": 5,
      "qa": 3,
      "production": 2
    },
    "gameWorlds": {
      "development": 3,
      "qa": 1,
      "production": 0
    },
    "storeProducts": {
      "development": 2,
      "qa": 0,
      "production": 0
    }
  }
}
```

## Internal Cache Status Response Example

```json
{
  "status": "ready",
  "timestamp": "2025-12-19T15:20:00.000Z",
  "lastRefreshedAt": "2025-12-19T15:15:00.000Z",
  "summary": {
    "clientVersions": { "development": 5, "qa": 3 },
    "gameWorlds": { "development": 3 },
    "storeProducts": { "development": 2 }
  },
  "detail": { ... }
}
```

## Docker Compose Configuration

### Production

```yaml
edge:
  environment:
    NODE_ENV: production
    GATRIX_URL: http://backend:5000
    EDGE_BYPASS_TOKEN: ${EDGE_BYPASS_TOKEN:-gatrix-edge-internal-bypass-token}
    EDGE_ENVIRONMENTS: ${EDGE_ENVIRONMENTS:-*}
    CACHE_SYNC_METHOD: ${EDGE_CACHE_SYNC_METHOD:-event}
    REDIS_HOST: redis
    REDIS_PORT: 6379
```

### Development

```yaml
edge-dev:
  environment:
    NODE_ENV: development
    LOG_LEVEL: debug
    GATRIX_URL: http://backend-dev:5000
    EDGE_BYPASS_TOKEN: ${EDGE_BYPASS_TOKEN:-gatrix-edge-internal-bypass-token}
    EDGE_ENVIRONMENTS: ${EDGE_ENVIRONMENTS:-*}
    CACHE_SYNC_METHOD: ${EDGE_CACHE_SYNC_METHOD:-event}
    REDIS_HOST: redis
    REDIS_PORT: 6379
```

## Troubleshooting

### Cache Not Updating

1. Check Redis connection: `docker logs gatrix-redis-dev`
2. Verify `CACHE_SYNC_METHOD=event` is set
3. Check backend is publishing events to `gatrix-sdk-events` channel
4. Review Edge logs: `docker logs gatrix-edge-dev`

### Environment Data Missing

1. Verify environment exists in backend
2. Check `EDGE_ENVIRONMENTS` setting (`*` for all)
3. Confirm API token has access to the environment
