# Gatrix Edge Server (.NET)

Gatrix Edge Server for .NET — a high-performance caching proxy built with ASP.NET Core 8. It caches all Gatrix backend data locally and serves client/server SDK requests without hitting the backend on every call.

## Features

- 🚀 **Local caching** — All Gatrix data (game worlds, feature flags, notices, etc.) cached in memory
- 🔄 **Real-time sync** — Redis PubSub event-driven cache invalidation or polling
- 🌍 **Multi-environment** — Wildcard mode caches all environments simultaneously
- 🏳️ **Feature flags** — Full local evaluation with no backend roundtrip
- 🔌 **SDK-compatible API** — Identical REST endpoints to the Node.js Edge server
- 🩺 **Health check** — Built-in `/health` endpoint

## Requirements

- .NET 8 SDK
- Redis (optional, for event-based cache sync)
- Gatrix Backend running and reachable

## Quick Start

```bash
cd packages/edge-dotnet
dotnet run --project src/Gatrix.Edge
```

### With Docker

```bash
# Build from monorepo root
docker build -f packages/edge-dotnet/Dockerfile -t gatrix-edge-dotnet .

# Run
docker run -p 3400:3400 -p 3410:3410 \
  -e Edge__GatrixUrl=http://backend:5000 \
  -e Edge__ApiToken=your-bypass-token \
  gatrix-edge-dotnet
```

## Configuration

Configure via `appsettings.json` or environment variables (prefix: `Edge__`).

### appsettings.json

```json
{
  "Edge": {
    "Port": 3400,
    "InternalPort": 3410,
    "GatrixUrl": "http://localhost:5000",
    "ApiToken": "gatrix-edge-internal-bypass-token",
    "ApplicationName": "edge-server",
    "Service": "edge",
    "Group": "gatrix",
    "Environment": "production",
    "Environments": ["*"],
    "Redis": {
      "Host": "localhost",
      "Port": 6379,
      "Password": null,
      "Db": 0
    },
    "Cache": {
      "PollingIntervalMs": 30000,
      "SyncMethod": "event"
    }
  }
}
```

### Environment Variables

| Variable                         | Default                 | Description                                             |
| -------------------------------- | ----------------------- | ------------------------------------------------------- |
| `Edge__Port`                     | `3400`                  | Main API port (client/server SDK requests)              |
| `Edge__InternalPort`             | `3410`                  | Internal management port                                |
| `Edge__GatrixUrl`                | `http://localhost:5000` | Gatrix backend URL                                      |
| `Edge__ApiToken`                 | —                       | Bypass API token (must have access to all environments) |
| `Edge__ApplicationName`          | `edge-server`           | Application name for identification                     |
| `Edge__Service`                  | `edge`                  | Service name                                            |
| `Edge__Group`                    | `gatrix`                | Service group                                           |
| `Edge__Environment`              | `production`            | Default environment (used when `Environments` is empty) |
| `Edge__Environments__0`          | —                       | Target environments. Set to `*` for all environments    |
| `Edge__Redis__Host`              | `localhost`             | Redis host                                              |
| `Edge__Redis__Port`              | `6379`                  | Redis port                                              |
| `Edge__Redis__Password`          | —                       | Redis password (optional)                               |
| `Edge__Cache__SyncMethod`        | `polling`               | `polling` \| `event` \| `manual`                        |
| `Edge__Cache__PollingIntervalMs` | `30000`                 | Polling interval in milliseconds                        |

### Cache Sync Methods

| Method    | Redis Required | Description                                             |
| --------- | -------------- | ------------------------------------------------------- |
| `polling` | ❌              | Refresh cache periodically based on `PollingIntervalMs` |
| `event`   | ✅              | Refresh immediately via Redis PubSub (recommended)      |
| `manual`  | ❌              | No automatic refresh. Call internal API manually        |

## Ports

| Port   | Purpose                                                                                    |
| ------ | ------------------------------------------------------------------------------------------ |
| `3400` | Client SDK API (`/api/v1/client/...`), Server SDK API (`/api/v1/server/...`), Health check |
| `3410` | Internal management API (`/internal/...`)                                                  |

## API Endpoints

The Edge server exposes the same API surface as the Gatrix backend for SDK consumers:

### Client SDK endpoints
- `GET /api/v1/client/:env/...` — All client SDK data endpoints

### Server SDK endpoints
- `GET /api/v1/server/:env/...` — All server SDK data endpoints

### Internal endpoints (port 3410 only)
- `GET /internal/stats` — Cache statistics
- `POST /internal/refresh` — Force cache refresh
- `GET /internal/health` — Detailed health status

### Public
- `GET /health` — Health check

## Development

```bash
# Run with hot reload
dotnet watch run --project src/Gatrix.Edge

# Build
dotnet build

# Run tests
dotnet test
```

### Development Docker

```bash
# Build from monorepo root
docker build -f packages/edge-dotnet/Dockerfile.dev -t gatrix-edge-dotnet-dev .

docker run -p 1400:1400 -p 1410:1410 \
  -e Edge__GatrixUrl=http://host.docker.internal:5000 \
  gatrix-edge-dotnet-dev
```

## docker-compose Example

```yaml
services:
  edge-dotnet:
    build:
      context: ../../..   # monorepo root
      dockerfile: packages/edge-dotnet/Dockerfile
    ports:
      - "3400:3400"
      - "3410:3410"
    environment:
      - Edge__GatrixUrl=http://backend:5000
      - Edge__ApiToken=gatrix-edge-internal-bypass-token
      - Edge__Environments__0=*
      - Edge__Cache__SyncMethod=event
      - Edge__Redis__Host=redis
    depends_on:
      - backend
      - redis
```
