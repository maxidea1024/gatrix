# Edge Server Implementation Plan

## 1. Overview

### 1.1 Background
The current architecture where game clients directly request the Backend API has the following issues:
- **Security Vulnerabilities**: Backend server directly exposed to the outside
- **Scaling Limitations**: Client requests and admin requests processed on the same server
- **Single Point of Failure**: Entire service outage when Backend fails

### 1.2 Goals
- Separate Edge server for clients
- Strengthen Backend security (isolate to internal network)
- Independent scalable architecture
- Cache-based high-performance responses
- **Ensure service continuity even during Backend failures**

### 1.3 Core Design Principle: High Availability

> ⚠️ **Edge server must NOT stop service even when Backend fails.**

| Situation | Edge Server Behavior |
|-----------|---------------------|
| Backend Normal | Respond with latest cached data |
| Backend Failure | **Continue responding with cached (stale) data** |
| Backend Recovery | Automatically refresh cache then respond with latest data |

**Design Principles**:
1. **Respond with stale data**: Old data is better than no response
2. **Minimize Backend dependency**: Operate independently after initialization
3. **Graceful Degradation**: Other features work normally when some fail
4. **Keep cache indefinitely**: Use expired cache until new data arrives
5. **⛔ No direct database access**: All data fetched only through SDK

> ⛔ **Absolute Rule**: Edge server does **NOT directly connect** to MySQL, Redis, etc.
> All data is fetched only through Server SDK → Backend API.
> Redis is used ONLY for PubSub event reception.

### 1.4 Specifications
| Item | Value |
|------|-------|
| Server Name | `edge` |
| Main Port | 3400 (external) - Client API only |
| Metrics Port | 9400 (internal only) - Prometheus metrics |
| Tech Stack | Node.js + Express + TypeScript |
| Cache Method | Server SDK based memory cache |
| Synchronization | Redis PubSub (events) or Polling |

> ⚠️ **Security Warning**: Metrics port (9337) must **NEVER be exposed externally**.
> Firewall/network configuration required for internal network access only.

---

## 2. Architecture

### 2.1 Current Structure (AS-IS)
```
┌──────────────┐         ┌──────────────┐
│ Game Client  │────────▶│   Backend    │
│              │         │  (Port 5000) │
└──────────────┘         └──────────────┘
                                │
                         ┌──────┴──────┐
                         │    MySQL    │
                         │    Redis    │
                         └─────────────┘
```

### 2.2 Target Structure (TO-BE)
```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│ Game Client  │────────▶│    Edge      │◀───────▶│   Backend    │
│              │         │  (Port 3400) │  SDK    │  (Port 5000) │
└──────────────┘         └──────────────┘         └──────────────┘
                                │                        │
                                │    ┌──────────────┐    │
                                └───▶│    Redis     │◀───┘
                                     │   (PubSub)   │
                                     └──────────────┘
```

### 2.3 Data Flow
1. **Initialization**: Load data from Backend API on Edge server start → memory cache
2. **Synchronization**: Real-time sync via Redis PubSub or Polling
3. **Request Processing**: Client request → respond from memory cache (no Backend call)
4. **Event Reception**: Backend data change → Redis event → cache refresh

### 2.4 Failure Scenario Behaviors

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Normal Operation                               │
├─────────────────────────────────────────────────────────────────────┤
│  Client ──▶ Edge (cache) ◀──sync──▶ Backend ◀──▶ DB                │
│             Respond with latest data                                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      Backend Failure                                │
├─────────────────────────────────────────────────────────────────────┤
│  Client ──▶ Edge (cache) ◀──X──▶ Backend (DOWN)                    │
│             Continue responding with cached data ✅                 │
│             (Only log sync failures, maintain service)              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                       Redis Failure                                 │
├─────────────────────────────────────────────────────────────────────┤
│  Client ──▶ Edge (cache) ◀──X──▶ Redis (DOWN)                      │
│             Continue responding with cached data ✅                 │
│             (Auto-switch to Polling mode or maintain cache)         │
└─────────────────────────────────────────────────────────────────────┘
```

**Edge Server Failure Response Principles**:
- Cache refresh failure → keep existing cache, only log errors
- TTL expiration → use expired cache until new data arrives
- Backend unreachable → retry while serving from existing cache

---

## 3. Functional Requirements

### 3.1 APIs Handled by Edge Server

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/v1/client/client-version` | GET | Client version info | API Token |
| `/api/v1/client/game-worlds` | GET | Game world list | Optional |
| `/api/v1/client/banners` | GET | Banner list | API Token |
| `/api/v1/client/remote-config/templates` | GET | Remote config templates | API Token |
| `/api/v1/client/remote-config/evaluate` | POST | Remote config evaluation | API Token |
| `/api/v1/client/crashes/upload` | POST | Crash report upload | API Token |
| `/api/v1/public/service-notices` | GET | Service notice list | None |
| `/api/v1/public/service-notices/:id` | GET | Service notice detail | None |
| `/health` | GET | Health check | None |
| `/ready` | GET | Readiness check | None |
| `/metrics` | GET | Prometheus metrics | None (internal only) |

### 3.2 Header Compatibility Requirements

Edge server must support the same headers as existing Backend:

```typescript
// Required headers
'x-api-token'          // API token
'x-application-name'   // Application name
'x-environment-id'     // Environment ID (multi-environment support)

// Optional headers
'x-user-id'           // User ID
'authorization'       // Bearer token (alternative)
```

### 3.3 Environment Support (⚠️ Key Difference)

> ⚠️ **One SDK, Two Modes** - We extend the existing SDK rather than creating a separate Edge SDK.

| Item | Single Environment Mode (Default) | Multi Environment Mode (Edge) |
|------|----------------------------------|-------------------------------|
| Config | `environments` not specified or empty array | `environments: ['env_prod', 'env_dev', ...]` |
| Used By | Game servers, API servers | Edge server |
| API Calls | `/api/v1/server/xxx` | `/api/v1/server/xxx?environments=env1,env2,env3` |
| Cache Structure | All data → 'default' key | Separated Map by environment |
| Query | `getCached()` | `getCached(environmentId)` |

**Game Server (Single Environment Mode - Default)**:
```typescript
const sdk = new GatrixServerSDK({
  gatrixUrl: 'http://backend:3000',
  apiToken: 'xxx',
  applicationName: 'game-server',
  // environments not specified = single environment mode (default)
  features: {
    clientVersion: true,  // Enable only needed features
  }
});

// environmentId parameter is ignored (always returns own environment's data)
const versions = sdk.getClientVersions();
```

**Edge Server (Multi Environment Mode)**:
```typescript
const sdk = new GatrixServerSDK({
  gatrixUrl: 'http://backend:3000',
  apiToken: 'xxx',
  applicationName: 'edge-server',
  environments: ['env_prod', 'env_staging', 'env_dev'],  // ✅ Target environments
  features: {
    gameWorld: false,      // Not needed for Edge
    survey: false,         // Not needed for Edge
    clientVersion: true,
    serviceNotice: true,
    banner: true,
  }
});

// Query data for the request's environment
const envId = req.headers['x-environment-id'];
const versions = sdk.getClientVersions(envId);
const notices = sdk.getServiceNotices(envId);
```

**Internal Cache Behavior**:
```typescript
// Single environment mode: All data stored under 'default' key
cachedVersionsByEnv.get('default') // → ClientVersion[]

// Multi environment mode: Separated by environment
cachedVersionsByEnv.get('env_prod')    // → ClientVersion[] (production)
cachedVersionsByEnv.get('env_staging') // → ClientVersion[] (staging)
```

**Request Processing Flow (Edge)**:
1. Client request → Extract `X-Environment-Id` header
2. Query `sdk.getXxx(environmentId)` for that environment's cache
3. Return environment-filtered data

---

## 4. SDK Extension Requirements

### 4.1 Current SDK Caching Support

| Data Type | Current Support | Edge Needed | Notes |
|-----------|----------------|-------------|-------|
| GameWorld | ✅ | ✅ | Existing |
| PopupNotice | ✅ | ✅ | Existing |
| Survey | ✅ | ❌ | Not needed for Edge |
| Whitelist | ✅ | ✅ | Existing |
| ServiceMaintenance | ✅ | ✅ | Existing |
| **ClientVersion** | ❌ | ✅ | **New - required** |
| **ServiceNotice** | ❌ | ✅ | **New - required** |
| **Banner** | ❌ | ✅ | **New - required** |
| **API Token** | ❌ | ✅ | **New - required** |

### 4.2 SDK Configuration Extension

**Key Change**: Make all existing features optional so each server enables only what it needs

```typescript
interface GatrixSDKConfig {
  // Existing fields
  gatrixUrl: string;
  apiToken: string;
  applicationName: string;
  redis?: RedisConfig;
  cache?: CacheConfig;

  // Feature toggles - all caching features optionalized
  features?: {
    // Existing features (currently always enabled → make optional)
    gameWorld?: boolean;          // default: true (maintain existing behavior)
    popupNotice?: boolean;        // default: true
    survey?: boolean;             // default: true
    whitelist?: boolean;          // default: true
    serviceMaintenance?: boolean; // default: true

    // New features (Edge specific)
    clientVersion?: boolean;      // default: false
    serviceNotice?: boolean;      // default: false
    banner?: boolean;             // default: false
    apiTokenCache?: boolean;      // default: false
  };
}
```

### 4.3 Usage Examples by Server Type

```typescript
// Edge Server - for client API serving
const edgeSDK = new GatrixServerSDK({
  features: {
    gameWorld: true,
    popupNotice: false,      // Not needed for Edge
    survey: false,           // Not needed for Edge
    whitelist: true,
    serviceMaintenance: true,
    clientVersion: true,     // Edge specific
    serviceNotice: true,     // Edge specific
    banner: true,            // Edge specific
    apiTokenCache: true,     // Edge specific
  }
});

// Game Server - for game logic
const gameServerSDK = new GatrixServerSDK({
  features: {
    gameWorld: true,
    popupNotice: true,
    survey: false,           // Not needed for game server
    whitelist: true,
    serviceMaintenance: true,
    // Rest default to false
  }
});
```

---

## 5. Security Considerations

### 5.1 Network
- Only Edge main port exposed externally (port 3400)
- Backend isolated to internal network
- TLS applied (at Reverse Proxy)

### 5.2 Metrics Endpoint Security (⚠️ CRITICAL)

> ⛔ **`/metrics` endpoint must NEVER be exposed externally!**

**Vulnerability Risks:**
1. **Information Disclosure**: Internal system state, request patterns, error rates usable for attacks
2. **Attack Vector**: Attackers can identify optimal attack timing by monitoring system load
3. **Business Information Leak**: Traffic patterns, user counts, and other sensitive business metrics

**Required Actions:**
- Metrics served on separate port (9337)
- Metrics port accessible only from internal network via firewall
- In docker-compose, don't bind metrics port to host or set as internal network only

```yaml
# docker-compose.yml - Metrics port NEVER exposed!
services:
  edge:
    ports:
      - "3400:3400"        # Main API port (external)
      # - "9400:9400"      # ⛔ NEVER expose externally!
    networks:
      - public             # For external access
      - internal           # For internal communication

  prometheus:
    networks:
      - internal           # Access edge:9337 only from internal
```

### 5.3 Authentication
- API token cache invalidation support
- Token expiration validation
- Rate Limiting applied

### 5.4 Data
- Exclude sensitive information from logs
- Prevent internal information exposure in responses
- CORS policy applied

---

## 6. Rollback Plan

### 6.1 Immediate Rollback
- Switch to direct Backend connection on Edge server failure
- Change API URL in client configuration

### 6.2 Gradual Transition
- Route only some traffic to Edge (Canary)
- Adjust ratio on issues

---

*Document Created: 2025-12-05*
*Version: 1.0*

