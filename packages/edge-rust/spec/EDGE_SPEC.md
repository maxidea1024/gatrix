# Gatrix Edge Server Specification

This document defines the architecture, security model, API surface, and operational behavior for all Gatrix Edge Server implementations. The Edge Server acts as a **high-availability caching proxy** between Gatrix SDKs and the Gatrix Backend, eliminating direct SDK-to-backend traffic for reads.

## 1. Purpose

The Edge Server provides:
- **Local caching** of all Gatrix backend data (feature flags, game worlds, banners, notices, etc.)
- **Local feature flag evaluation** without backend roundtrips
- **Token mirroring** — caches API tokens from the backend and validates SDK requests locally
- **Multi-environment support** — caches all environments simultaneously
- **SDK-compatible API** — drop-in replacement for direct backend calls

> [!IMPORTANT]
> The Edge Server is a **read-only proxy**. Write operations (e.g., coupon redemption, service registration) are forwarded to the backend. Metrics are buffered and forwarded asynchronously.

## 2. Architecture Overview

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Client SDK  │────▶│   Edge Server    │────▶│   Backend    │
│  Server SDK  │◀────│  (Cache Proxy)   │◀────│   (Gatrix)   │
└──────────────┘     └──────────────────┘     └──────────────┘
                            │                        │
                            └───── Redis PubSub ─────┘
```

### Components

| Component | Description |
|-----------|-------------|
| **Token Mirror** | Fetches and caches API tokens from backend; validates requests locally |
| **Environment Registry** | Maintains org/project/environment tree for multi-env resolution |
| **SDK Instance** | Embedded `GatrixServerSDK` for data caching and feature flag evaluation |
| **HTTP Server** | Serves Client SDK, Server SDK, and Internal APIs |

## 3. Network Configuration

### Ports

| Port | Purpose | Exposure |
|------|---------|----------|
| `3400` (default) | Client SDK API + Server SDK API + Health | Public |
| `3410` (default) | Internal APIs (cache management, metrics) | Private |

The internal port is always **main port + 10**. Both ports are configurable via `--port` CLI argument or `EDGE_PORT` environment variable.

## 4. Configuration

Configuration is loaded with the following precedence (highest first):
1. CLI arguments
2. Environment variables
3. `.env` file
4. Compiled defaults

### Required Configuration

| Parameter | CLI | Env Var | Default | Description |
|-----------|-----|---------|---------|-------------|
| Backend URL | `--gatrix-url` | `GATRIX_URL` | `http://localhost:45000` | Gatrix backend URL |
| API Token | `--api-token` | `EDGE_BYPASS_TOKEN` | `gatrix-infra-server-token` | Bypass token for backend auth |

### Optional Configuration

| Parameter | CLI | Env Var | Default | Description |
|-----------|-----|---------|---------|-------------|
| Port | `--port` | `EDGE_PORT` | `3400` | Main API port |
| App Name | `--app-name` | `EDGE_APPLICATION_NAME` | `edge-rust-server` | Application identifier |
| Service | `--service` | `EDGE_SERVICE` | `edge-rust` | Service discovery label |
| Group | `--group` | `EDGE_GROUP` | `gatrix` | Group label |
| Sync Method | `--sync-method` | `EDGE_SYNC_METHOD` | `polling` | Cache sync: `polling` / `event` / `manual` |
| Polling Interval | `--polling-interval-ms` | `EDGE_CACHE_POLLING_INTERVAL_MS` | `30000` | Polling interval (ms) |
| Log Level | `--log-level` | `EDGE_LOG_LEVEL` | `info` | Log level |
| Redis Host | `--redis-host` | `EDGE_REDIS_HOST` | `localhost` | Redis host |
| Redis Port | `--redis-port` | `EDGE_REDIS_PORT` | `6379` | Redis port |
| Redis Password | `--redis-password` | `EDGE_REDIS_PASSWORD` | — | Redis password |
| Redis DB | `--redis-db` | `EDGE_REDIS_DB` | `0` | Redis database number |

### Security Configuration

| Parameter | CLI | Env Var | Default | Description |
|-----------|-----|---------|---------|-------------|
| Rate Limit | `--rate-limit-rps` | `EDGE_RATE_LIMIT_RPS` | `0` (disabled) | Max requests per second per IP |
| IP Allow List | `--allow-ip` | `EDGE_ALLOW_IPS` | — | Comma-separated CIDR list |
| IP Deny List | `--deny-ip` | `EDGE_DENY_IPS` | — | Comma-separated CIDR list |

## 5. Security

### 5.1 Token Authentication

All API requests (except `/health/*`) MUST be authenticated via API tokens.

**Token Resolution Order:**
1. `x-api-token` request header
2. `Authorization: Bearer {token}` header
3. `token` or `apiToken` query parameter

**Token Types:**
| Type | Description |
|------|-------------|
| Production Token | Validated via Token Mirror (fetched from backend) |
| Unsecured Token | Format: `unsecured-{org}:{project}:{env}-{type}-api-token` |
| Legacy Unsecured | `unsecured-client-api-token`, `unsecured-server-api-token`, `unsecured-edge-api-token` |

### 5.2 Token Path Enforcement

> [!IMPORTANT]
> Tokens MUST only access routes matching their type.

| Token Type | Allowed Paths |
|------------|---------------|
| `client` | `/api/v1/client/*` |
| `server` | `/api/v1/server/*` |
| `edge` | All paths |

Violation MUST return `403 Forbidden`.

### 5.3 IP Allow/Deny Lists

When configured, IP-based access control is enforced **before** token authentication.

**Rules:**
1. If an allow list is configured and the client IP is NOT in the list → `403 Forbidden`
2. If a deny list is configured and the client IP IS in the list → `403 Forbidden`
3. Both lists support CIDR notation (e.g., `10.0.0.0/8`, `192.168.1.0/24`)
4. If both lists are configured, deny list is checked first

### 5.4 Rate Limiting

When enabled, requests are limited per client IP using a sliding window algorithm.

**Behavior:**
- Exceeding the limit returns `429 Too Many Requests` with `Retry-After` header
- Rate limit state is per-IP, stored in memory
- Cleanup of expired entries occurs periodically

## 6. API Endpoints

### 6.1 Client SDK Endpoints (port 3400)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/client/test` | Auth test — validates token and returns environment info |
| `GET` | `/api/v1/client/client-version` | Client version lookup (`platform` required, `version` optional) |
| `GET` | `/api/v1/client/client-versions` | All client versions for environment |
| `GET` | `/api/v1/client/game-worlds` | Non-maintenance game worlds (sorted by `displayOrder`) |
| `GET` | `/api/v1/client/banners` | All banners for environment |
| `GET` | `/api/v1/client/banners/{bannerId}` | Single banner by ID |
| `GET` | `/api/v1/client/service-notices` | Service notices (filterable by `platform`) |

### 6.2 Server SDK Endpoints (port 3400)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/server/features` | Feature flag definitions + segments |
| `GET` | `/api/v1/server/segments` | Segments only |
| `GET/POST` | `/api/v1/server/features/eval` | Server-side feature evaluation |
| `POST` | `/api/v1/server/features/metrics` | Forward metrics to backend |
| `POST` | `/api/v1/server/features/unknown` | Report unknown flag access |

**Feature flag query parameters:**
- `flagNames` — comma-separated filter
- `compact` — strips strategies/variants from disabled flags (bandwidth optimization)

### 6.3 Health Endpoints (port 3400)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Full health check (SDK + Token Mirror status) |
| `GET` | `/health/ready` | Readiness probe (returns 503 if not initialized) |
| `GET` | `/health/live` | Liveness probe (always 200) |

### 6.4 Internal Endpoints (port 3410)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/internal/health` | Detailed health with token count |
| `GET` | `/internal/cache/summary` | Cached item counts per service type |
| `POST` | `/internal/cache/refresh` | Force immediate cache refresh |

## 7. ETag Caching

> [!IMPORTANT]
> All data-serving GET endpoints MUST support ETag-based conditional responses to reduce bandwidth.

**Behavior:**
1. Response body is hashed (SHA-256) to produce an `ETag` header value
2. If client sends `If-None-Match` header matching the current ETag → return `304 Not Modified` with empty body
3. Otherwise, return full response with `ETag` header

**Excluded paths:** Health endpoints, POST endpoints

## 8. Cache Synchronization

### Sync Methods

| Method | Redis Required | Description |
|--------|---------------|-------------|
| `polling` | No | Periodically refresh all caches at `polling_interval_ms` |
| `event` | Yes | Subscribe to Redis PubSub; refresh on change events |
| `manual` | No | No automatic refresh; only via `/internal/cache/refresh` |

### Token Mirror Events

The Token Mirror subscribes to `gatrix-sdk-events:*` for:
- `token.created` / `token.updated` / `token.deleted` → refetch all tokens
- `token.revoked` → immediate cache invalidation

### Environment Registry Events

The Environment Registry subscribes for:
- `environment.*` / `project.*` / `org.*` → refetch environment tree

## 9. Startup Sequence

1. Load configuration (CLI → env vars → .env → defaults)
2. Validate configuration
3. Initialize embedded SDK (fetch initial data for all services)
4. Initialize Token Mirror (fetch all tokens, start PubSub listener)
5. Initialize Environment Registry (fetch tree, start PubSub listener)
6. Register with Service Discovery
7. Start internal HTTP server (port 3410)
8. Start main HTTP server (port 3400)
9. Begin cache sync (polling or event)

## 10. Shutdown Sequence

1. Receive shutdown signal (SIGTERM/SIGINT)
2. Stop accepting new connections
3. Complete in-flight requests (grace period)
4. Unregister from Service Discovery
5. Flush pending metrics
6. Stop cache sync
7. Close Redis connections
8. Exit

## 11. Error Response Format

All error responses MUST follow this structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error description"
  }
}
```

### Standard Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `MISSING_API_TOKEN` | 401 | No token provided |
| `INVALID_TOKEN` | 401 | Token not found or invalid |
| `TOKEN_EXPIRED` | 401 | Token has expired |
| `INVALID_TOKEN_TYPE` | 401 | Token type mismatch for endpoint |
| `ENVIRONMENT_NOT_FOUND` | 401 | Cannot resolve environment |
| `FORBIDDEN` | 403 | IP blocked or path not allowed for token type |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `NOT_FOUND` | 404 | Resource or endpoint not found |
| `SERVICE_UNAVAILABLE` | 503 | SDK not initialized |

## 12. CORS

The main HTTP server MUST support CORS with:
- **Origins:** `*` (all origins allowed)
- **Methods:** `GET`, `POST`, `OPTIONS`
- **Allowed Headers:** `content-type`, `x-api-token`, `x-application-name`, `x-client-version`, `x-platform`, `x-sdk-version`, `x-environment-id`, `x-connection-id`, `authorization`, `if-none-match`
- **Exposed Headers:** `etag`
- **Max Age:** `3600` seconds

## 13. Deployment

### Single Binary

The Edge Server MUST compile to a single static binary with zero runtime dependencies. The binary accepts all configuration via CLI arguments or environment variables.

### Docker

The production Dockerfile MUST:
1. Use multi-stage build (builder + minimal runtime)
2. Produce a statically-linked binary
3. Run as non-root user
4. Include a `HEALTHCHECK` instruction
5. Expose ports 3400 and 3410

### Resource Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| Memory | 64 MB | 256 MB |
| CPU | 1 core | 2 cores |
| Disk | 50 MB | 100 MB |

## 14. Observability

### Logging

All logs MUST be structured (key-value or JSON format) and include:
- Timestamp (ISO 8601)
- Log level
- Module/component name
- Request context (when applicable)

### Health Check Response

```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00Z",
  "version": "0.1.0",
  "runtime": "rust",
  "sdk": "ready",
  "tokenMirror": "ready",
  "tokenCount": 42
}
```

## 15. Implementation Checklist

- [ ] Configuration loading (CLI + env vars + .env + defaults)
- [ ] Token Mirror service with Redis PubSub
- [ ] Environment Registry with Redis PubSub
- [ ] Client auth middleware (3-tier token validation)
- [ ] Server auth middleware
- [ ] Token path enforcement
- [ ] IP allow/deny list middleware
- [ ] Rate limiting middleware
- [ ] ETag caching middleware
- [ ] Client API routes (client-version, game-worlds, banners, service-notices)
- [ ] Server API routes (features, segments, eval, metrics, unknown)
- [ ] Health routes (health, ready, live)
- [ ] Internal routes (cache summary, cache refresh)
- [ ] Graceful shutdown with signal handling
- [ ] Service Discovery registration/deregistration
- [ ] CORS configuration
- [ ] Dockerfile (multi-stage, static binary)
- [ ] README.md + README.ko.md
