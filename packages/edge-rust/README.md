# Gatrix Edge Server (Rust)

Gatrix Edge Server — a high-performance caching proxy built with Rust. Compiles to a **single static binary** with zero runtime dependencies. Caches all Gatrix backend data locally and serves client/server SDK requests without hitting the backend on every call.

## Features

- 🦀 **Single binary** — No runtime dependencies, ~15MB Docker image
- 🚀 **Local caching** — All Gatrix data (game worlds, feature flags, notices, etc.) cached in memory
- 🔄 **Real-time sync** — Redis PubSub event-driven cache invalidation or polling
- 🌍 **Multi-environment** — Caches all environments simultaneously
- 🏳️ **Feature flags** — Full local evaluation with no backend roundtrip
- 🔌 **SDK-compatible API** — Drop-in replacement for direct backend calls in client/server SDKs
- 🩺 **Health check** — Built-in `/health` endpoint
- ⚡ **CLI overrides** — All config can be overridden via command-line arguments

## Requirements

- Rust >= 1.75 (for building)
- Redis (optional, for event-based cache sync)
- Gatrix Backend running and reachable

## Quick Start

### From Source

```bash
cd packages/edge-rust
cargo run
```

### With CLI Arguments

```bash
cargo run -- --port 3400 --gatrix-url http://localhost:5000 --api-token my-token
```

### With Docker

```bash
# Build from monorepo root
docker build -f packages/edge-rust/Dockerfile -t gatrix-edge-rust .

# Run
docker run -p 3400:3400 -p 3410:3410 \
  -e GATRIX_URL=http://backend:5000 \
  -e EDGE_BYPASS_TOKEN=your-bypass-token \
  gatrix-edge-rust
```

### Pre-built Binary

Copy the single `gatrix-edge-rust` binary to any Linux server:

```bash
./gatrix-edge-rust --gatrix-url http://backend:5000 --api-token your-token
```

## Configuration

Configure via environment variables or CLI arguments. CLI arguments take precedence.

| CLI Argument               | Environment Variable               | Default                    | Description                      |
| -------------------------- | ---------------------------------- | -------------------------- | -------------------------------- |
| `--port`                   | `EDGE_PORT`                        | `3400`                     | Main API port                    |
| `--gatrix-url`             | `GATRIX_URL`                       | `http://localhost:5000`    | Gatrix backend URL               |
| `--api-token`              | `EDGE_BYPASS_TOKEN`                | `gatrix-infra-server-token`| Bypass API token                 |
| `--app-name`               | `EDGE_APPLICATION_NAME`            | `edge-rust-server`         | Application name                 |
| `--service`                | `EDGE_SERVICE`                     | `edge-rust`                | Service label                    |
| `--group`                  | `EDGE_GROUP`                       | `gatrix`                   | Group label                      |
| `--redis-host`             | `EDGE_REDIS_HOST` / `REDIS_HOST`   | `localhost`                | Redis host                       |
| `--redis-port`             | `EDGE_REDIS_PORT` / `REDIS_PORT`   | `6379`                     | Redis port                       |
| `--redis-password`         | `EDGE_REDIS_PASSWORD`              | —                          | Redis password (optional)        |
| `--redis-db`               | `EDGE_REDIS_DB` / `REDIS_DB`       | `0`                        | Redis database number            |
| `--sync-method`            | `EDGE_SYNC_METHOD`                 | `polling`                  | `polling` / `event` / `manual`   |
| `--polling-interval-ms`    | `EDGE_CACHE_POLLING_INTERVAL_MS`   | `30000`                    | Polling interval in milliseconds |
| `--log-level`              | `EDGE_LOG_LEVEL`                   | `info`                     | Log level                        |

### Cache Sync Methods

| Method    | Redis Required | Description                                        |
| --------- | -------------- | -------------------------------------------------- |
| `polling` | ❌             | Refresh cache periodically                         |
| `event`   | ✅             | Refresh immediately via Redis PubSub (recommended) |
| `manual`  | ❌             | No automatic refresh                               |

## Ports

| Port   | Purpose                                    |
| ------ | ------------------------------------------ |
| `3400` | Client SDK API, Server SDK API, Health     |
| `3410` | Internal APIs (cache management, stats)    |

## API Endpoints

### Client SDK Endpoints (port 3400)

- `GET /api/v1/client/test` — Auth test
- `GET /api/v1/client/client-version` — Client version lookup
- `GET /api/v1/client/client-versions` — All client versions
- `GET /api/v1/client/game-worlds` — Game worlds
- `GET /api/v1/client/banners` — All banners
- `GET /api/v1/client/banners/{bannerId}` — Single banner
- `GET /api/v1/client/service-notices` — Service notices

### Server SDK Endpoints (port 3400)

- `GET /api/v1/server/features` — Feature flags + segments
- `GET /api/v1/server/segments` — Segments
- `POST /api/v1/server/features/metrics` — Server metrics
- `POST /api/v1/server/features/unknown` — Unknown flag reports
- `GET|POST /api/v1/server/features/eval` — Feature evaluation

### Health (port 3400)

- `GET /health` — Health check
- `GET /health/ready` — Readiness check
- `GET /health/live` — Liveness check

### Internal (port 3410)

- `GET /internal/health` — Detailed health
- `GET /internal/cache/summary` — Cache summary
- `POST /internal/cache/refresh` — Force cache refresh

## Development

```bash
# Build
cargo build

# Run with debug logging
RUST_LOG=debug cargo run

# Run clippy lint
cargo clippy

# Build release binary
cargo build --release
```

## docker-compose Example

```yaml
services:
  edge-rust:
    build:
      context: ../..   # monorepo root
      dockerfile: packages/edge-rust/Dockerfile
    ports:
      - "3400:3400"
      - "3410:3410"
    environment:
      - GATRIX_URL=http://backend:5000
      - EDGE_BYPASS_TOKEN=gatrix-edge-internal-bypass-token
      - EDGE_SYNC_METHOD=event
      - REDIS_HOST=redis
    depends_on:
      - backend
      - redis
```

## License

See [LICENSE](../../LICENSE) in the repository root.
