# @gatrix/server-sdk

Gatrix Server-side SDK for Node.js - Provides easy access to Gatrix backend APIs with caching, event handling, and service discovery.

## Features

- 🚀 **Easy to use** - Simple API for common operations
- 📦 **Caching** - Built-in caching with automatic refresh
- 🔔 **Event handling** - Real-time cache updates via Redis PubSub
- 🔍 **Service discovery** - Backend API-based service discovery
- 📝 **TypeScript** - Full TypeScript support with type definitions
- ✅ **Tested** - Comprehensive test coverage

## Installation

```bash
npm install @gatrix/server-sdk
```

## Requirements

- Node.js >= 22.0.0
- Redis (optional, for event handling)

## Quick Start

```typescript
import { GatrixServerSDK } from '@gatrix/server-sdk';

// Create SDK instance
const sdk = new GatrixServerSDK({
  // Required
  gatrixUrl: 'https://api.gatrix.com',
  apiToken: 'your-server-api-token', // Optional: defaults to 'gatrix-unsecured-server-api-token' for testing
  applicationName: 'your-app-name',
  service: 'worldd',     // Service name (e.g., 'auth', 'lobby', 'world', 'chat')
  group: 'kr-1',         // Service group (e.g., 'kr', 'us', 'production')
  environment: 'env_prod', // Environment identifier (e.g., 'env_prod', 'env_staging')
});

// Initialize SDK (loads cache)
await sdk.initialize();

// Use SDK
const worlds = await sdk.fetchGameWorlds();
console.log('Game worlds:', worlds);

// Close SDK when done
await sdk.close();
```

### Testing Without API Token

For testing purposes, you can omit the `apiToken` field. The SDK will automatically use the unsecured test token:

```typescript
const sdk = new GatrixServerSDK({
  gatrixUrl: 'http://localhost:5000',
  applicationName: 'test-server',
  service: 'test-service',
  group: 'test-group',
  environment: 'env_dev',
  // apiToken is optional - defaults to 'gatrix-unsecured-server-api-token'
});
```

**Available Unsecured Tokens:**
- Server SDK: `gatrix-unsecured-server-api-token`
- Client SDK: `gatrix-unsecured-client-api-token`

⚠️ **Warning:** Unsecured tokens are for testing only. Always use proper API tokens in production.

## Configuration

### Basic Configuration

```typescript
const sdk = new GatrixServerSDK({
  // Required
  gatrixUrl: 'https://api.gatrix.com',
  apiToken: 'your-server-api-token',
  applicationName: 'your-app-name',
  service: 'worldd',       // Service name for identification
  group: 'kr-1',           // Service group for categorization
  environment: 'env_prod', // Environment identifier
});
```

### With Redis (for event handling)

```typescript
const sdk = new GatrixServerSDK({
  // Required
  gatrixUrl: 'https://api.gatrix.com',
  apiToken: 'your-server-api-token',
  applicationName: 'your-app-name',
  service: 'worldd',
  group: 'kr-1',
  environment: 'env_prod',

  // Optional - Redis (for event handling)
  redis: {
    host: 'localhost',
    port: 6379,
    password: 'your-redis-password', // optional
    db: 0, // optional
  },
});
```

### Full Configuration

```typescript
const sdk = new GatrixServerSDK({
  // Required
  gatrixUrl: 'https://api.gatrix.com',
  apiToken: 'your-server-api-token',
  applicationName: 'your-app-name',
  service: 'worldd',       // Service name (e.g., 'auth', 'lobby', 'world', 'chat')
  group: 'kr-1',           // Service group (e.g., 'kr', 'us', 'production')
  environment: 'env_prod', // Environment (e.g., 'env_prod', 'env_staging')

  // Optional - Redis (for event handling)
  redis: {
    host: 'localhost',
    port: 6379,
    password: 'your-redis-password',
    db: 0,
  },

  // Optional - Cache
  cache: {
    enabled: true,
    ttl: 300, // seconds (only used with 'polling' refreshMethod)
    refreshMethod: 'polling', // 'polling' | 'event' | 'manual'. Default: 'polling'
  },

  // Optional - Metrics
  metrics: {
    enabled: true, // Enable SDK internal metrics (default: true)
    port: 9337,    // Metrics server port (default: 9337 or SDK_METRICS_PORT env)
  },

  // Optional - Logger
  logger: {
    level: 'info', // 'debug' | 'info' | 'warn' | 'error'
    timeOffset: 9, // Time offset in hours (e.g., 9 for +09:00). Default: 0 (UTC)
    timestampFormat: 'local', // 'iso8601' | 'local'. Default: 'iso8601'
    customLogger: (level, message, meta) => {
      // Custom logger implementation
      console.log(`[${level}] ${message}`, meta);
    },
  },

  // Optional - HTTP Retry
  retry: {
    enabled: true, // Enable retry (default: true)
    maxRetries: 10, // Max retry attempts. -1 for infinite retries (default: 10)
    retryDelay: 2000, // Initial retry delay in ms (default: 2000)
    retryDelayMultiplier: 2, // Delay multiplier for exponential backoff (default: 2)
    maxRetryDelay: 10000, // Max retry delay in ms (default: 10000)
    retryableStatusCodes: [408, 429, 500, 502, 503, 504], // HTTP status codes to retry
  },
});
```

### Creating Instance with Overrides

When you have a shared base configuration but need to customize certain fields per program/service, use `createInstance`:

```typescript
import { GatrixServerSDK, GatrixSDKConfig, GatrixSDKInitOptions } from '@gatrix/server-sdk';

// Base config (shared across programs, typically from config file)
const baseConfig: GatrixSDKConfig = {
  gatrixUrl: 'https://api.gatrix.com',
  apiToken: 'your-server-api-token',
  applicationName: 'my-game',
  service: 'default-service',
  group: 'default-group',
  environment: 'production',
  redis: {
    host: 'localhost',
    port: 6379,
  },
  cache: {
    enabled: true,
    refreshMethod: 'event',
  },
};

// Create instance with overrides for billing worker
const billingSDK = GatrixServerSDK.createInstance(baseConfig, {
  service: 'billing-worker',
  group: 'payment',
  region: 'kr',
  logger: { level: 'debug' },
});

// Create instance with overrides for world server
const worldSDK = GatrixServerSDK.createInstance(baseConfig, {
  service: 'worldd',
  group: 'kr-1',
  worldId: 'world-1',
  metrics: { enabled: true, port: 9338 },
});

// Create instance with overrides for auth server
const authSDK = GatrixServerSDK.createInstance(baseConfig, {
  service: 'authd',
  group: 'global',
  environment: 'staging', // Override environment
  cache: { ttl: 60 }, // Override cache TTL
});
```

#### Override Options

All fields in `GatrixSDKInitOptions` are optional. Unspecified fields use values from the base config.

| Field | Type | Description |
|-------|------|-------------|
| `service` | string | Override service name |
| `group` | string | Override service group |
| `environment` | string | Override environment identifier |
| `region` | string | Override region identifier |
| `gatrixUrl` | string | Override Gatrix backend URL |
| `apiToken` | string | Override API token |
| `applicationName` | string | Override application name |
| `worldId` | string | Override world ID |
| `redis` | Partial\<RedisConfig\> | Override Redis config (deep merged) |
| `cache` | Partial\<CacheConfig\> | Override cache settings (deep merged) |
| `logger` | Partial\<LoggerConfig\> | Override logger settings (deep merged) |
| `retry` | Partial\<RetryConfig\> | Override retry settings (deep merged) |
| `metrics` | Partial\<MetricsConfig\> | Override metrics settings (deep merged) |
| `features` | Partial\<FeaturesConfig\> | Override feature toggles (deep merged) |
| `environments` | string[] \| '*' | Override target environments |

#### Using mergeConfig Directly

You can also use `mergeConfig` to create a merged configuration without instantiating:

```typescript
// Merge configs without creating instance
const mergedConfig = GatrixServerSDK.mergeConfig(baseConfig, {
  service: 'custom-service',
  logger: { level: 'warn' },
});

// Use merged config later
const sdk = new GatrixServerSDK(mergedConfig);
```

### Required Configuration Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `gatrixUrl` | string | Gatrix backend URL | `https://api.gatrix.com` |
| `apiToken` | string | Server API Token | `your-server-api-token` |
| `applicationName` | string | Application name | `my-game-server` |
| `service` | string | Service name for identification | `auth`, `lobby`, `world`, `chat` |
| `group` | string | Service group for categorization | `kr`, `us`, `production` |
| `environment` | string or `'*'` | Environment identifier or `'*'` for multi-env mode | `env_prod`, `env_staging`, `*` |
| `region` | string | (Optional) Region identifier for geographic identification | `kr`, `us`, `eu`, `asia` |

These required fields (`service`, `group`, `environment`) are used consistently across:
- **Metrics labels**: All SDK metrics include these as default labels for filtering in Grafana
- **Service Discovery**: Automatically applied when registering services

### Multi-Environment Mode

For Edge servers or services that need to cache data for ALL environments, use the wildcard `'*'`:

```typescript
const sdk = new GatrixServerSDK({
  gatrixUrl: 'https://api.gatrix.com',
  apiToken: 'your-bypass-token', // Must have access to all environments
  applicationName: 'edge-server',
  service: 'edge',
  group: 'default',
  environment: '*', // Multi-environment mode
  redis: {
    host: 'localhost',
    port: 6379,
  },
  cache: {
    enabled: true,
    refreshMethod: 'event', // Recommended for multi-env mode
  },
});

await sdk.initialize();

// Access cached data for specific environments
const devWorlds = sdk.getCachedGameWorlds('development');
const prodWorlds = sdk.getCachedGameWorlds('production');

// Get all cached environments
const environments = sdk.getCachedEnvironments();
console.log('Cached environments:', environments.map(e => e.id));
```

**Multi-Environment Mode Features:**
- Automatically fetches all environments from backend on initialization
- Caches data for each environment separately
- Listens for `environment.created` and `environment.deleted` events via Redis PubSub
- Each getter method accepts an optional `environmentId` parameter to filter data
- Ideal for Edge servers that serve multiple environments

## API Reference

### Coupon

#### Redeem Coupon

```typescript
const result = await sdk.redeemCoupon({
  code: 'COUPON123',
  userId: 'user-123',
  userName: 'John Doe',
  characterId: 'char-456', // optional
  worldId: 'world-1', // optional
  platform: 'pc', // optional
  channel: 'steam', // optional
  subChannel: 'global', // optional
  // Note: requestId is automatically generated internally for idempotency
});

console.log('Reward:', result.reward);
console.log('User used count:', result.userUsedCount);
```

### Game Worlds

#### Get All Game Worlds

```typescript
const worlds = await sdk.fetchGameWorlds('en'); // language parameter (default: 'en')
console.log('Worlds:', worlds);
```

Each game world object includes:
- `worldId`: Unique world identifier
- `worldServerAddress`: Server address as a URL or host:port (e.g., `https://world.example.com` or `world.example.com:8080`)
- `name`: World name (localized)
- `description`: World description (localized)
- `status`: World status (`active`, `maintenance`, etc.)
- `customPayload`: Custom JSON data for game-specific configuration

#### Get Game World by ID

```typescript
const world = await sdk.fetchGameWorldById(1);
console.log('World:', world);
console.log('Server address:', world.worldServerAddress); // e.g., "https://world.example.com" or "world.example.com:8080"
```

#### Get Game World by World ID

```typescript
const world = await sdk.fetchGameWorldByWorldId('world-1');
console.log('World:', world);
console.log('Server address:', world.worldServerAddress); // e.g., "https://world.example.com" or "world.example.com:8080"
```

#### Get Cached Game Worlds

```typescript
const worlds = sdk.getCachedGameWorlds();
console.log('Cached worlds:', worlds);
```

#### Check World Maintenance Status

```typescript
const isActive = sdk.isWorldMaintenanceActive('world-1');
console.log('Is maintenance active:', isActive);

const message = sdk.getWorldMaintenanceMessage('world-1', 'ko');
console.log('Maintenance message:', message);
```

### Maintenance API

The SDK provides comprehensive maintenance status checking with clear naming conventions:

#### Naming Convention

| Property/Method | Description |
|-----------------|-------------|
| `hasMaintenanceScheduled` | Whether maintenance is scheduled (configured in admin) |
| `isMaintenanceActive` | Whether maintenance is currently active (time-based check) |

#### Check Global Service Maintenance

```typescript
// Check if global service maintenance is active
const isActive = sdk.isServiceMaintenanceActive();
console.log('Service maintenance active:', isActive);

// Get localized maintenance message
const message = sdk.getServiceMaintenanceMessage('ko');
console.log('Maintenance message:', message);
```

#### Check Combined Maintenance (Service + World)

```typescript
// Check if ANY maintenance is active (service or world)
const isActive = sdk.isMaintenanceActive();
console.log('Maintenance active:', isActive);

// Check specific world (also checks global service)
const isWorldActive = sdk.isMaintenanceActive('world-1');
console.log('World maintenance active:', isWorldActive);
```

#### Get Comprehensive Maintenance Info

```typescript
// Get detailed maintenance info
const info = sdk.getMaintenanceInfo('world-1', 'ko');
console.log('Maintenance info:', info);

// MaintenanceInfo structure:
// {
//   isMaintenanceActive: boolean,    // Is maintenance currently active (time-based)
//   source: 'service' | 'world' | null,
//   worldId?: string,
//   message: string | null,
//   startsAt: string | null,         // ISO 8601 date
//   endsAt: string | null,           // ISO 8601 date
//   forceDisconnect: boolean,
//   gracePeriodMinutes: number,
//   actualStartTime: string | null,  // When maintenance actually started
// }
```

#### Get Current Maintenance Status (for Client)

```typescript
// Get status formatted for client delivery
const status = sdk.getCurrentMaintenanceStatus();
console.log('Status:', status);

// CurrentMaintenanceStatus structure:
// {
//   isMaintenanceActive: boolean,    // Is maintenance currently active (time-based)
//   source?: 'service' | 'world',
//   worldId?: string,
//   detail?: {
//     startsAt?: string,
//     endsAt?: string,
//     message?: string,
//     localeMessages?: { ko?: string, en?: string, zh?: string },
//     forceDisconnect?: boolean,
//     gracePeriodMinutes?: number,
//   }
// }
```

#### Listen to Maintenance Events

```typescript
// Maintenance started (time window began)
sdk.on('local.maintenance.started', (event) => {
  console.log('Maintenance started:', event.data);
  // { source: 'service' | 'world', worldId?: string, actualStartTime: string }
});

// Maintenance ended (time window ended or cancelled)
sdk.on('local.maintenance.ended', (event) => {
  console.log('Maintenance ended:', event.data);
  // { source: 'service' | 'world', worldId?: string }
});

// Maintenance settings updated (while active)
sdk.on('local.maintenance.updated', (event) => {
  console.log('Maintenance updated:', event.data);
  // { source: 'service' | 'world', worldId?: string }
});

// Grace period expired - kick users
sdk.on('local.maintenance.grace_period_expired', (event) => {
  console.log('Grace period expired:', event.data);
  // { source: 'service' | 'world', worldId?: string, actualStartTime: string }
});
```

### Popup Notices

#### Get Active Popup Notices

```typescript
const notices = await sdk.fetchPopupNotices();
console.log('Notices:', notices);
```

#### Get Cached Popup Notices

```typescript
const notices = sdk.getCachedPopupNotices();
console.log('Cached notices:', notices);
```

#### Get Popup Notices for World

```typescript
const notices = sdk.getPopupNoticesForWorld('world-1');
console.log('Notices for world-1:', notices);
```

### Surveys

#### Get Surveys

```typescript
const surveys = await sdk.fetchSurveys();
console.log('Surveys:', surveys);
```

#### Get Cached Surveys

```typescript
const surveys = sdk.getCachedSurveys();
console.log('Cached surveys:', surveys);
```

#### Get Active Surveys

```typescript
const surveys = sdk.getActiveSurveys();
console.log('Active surveys:', surveys);
```

#### Get Surveys for World

```typescript
const surveys = sdk.getSurveysForWorld('world-1');
console.log('Surveys for world-1:', surveys);
```

### Cache Management

#### Cache Refresh Methods

The SDK supports three cache refresh methods:

| Method | TTL Used | Redis Required | Refresh Trigger |
|--------|----------|----------------|-----------------|
| `polling` | ✅ Yes | ❌ No | Periodic interval based on `ttl` |
| `event` | ❌ No | ✅ Yes | Redis PubSub events from backend |
| `manual` | ❌ No | ❌ No | Manual `sdk.refreshCache()` calls only |

**1. Polling (Default)**
- Periodically refreshes cache at fixed intervals based on `ttl`
- No Redis required
- Suitable for applications that don't need real-time updates

```typescript
const sdk = new GatrixServerSDK({
  gatrixUrl: 'https://api.gatrix.com',
  apiToken: 'your-token',
  applicationName: 'your-app',
  service: 'worldd',
  group: 'kr-1',
  environment: 'env_prod',
  cache: {
    enabled: true,
    ttl: 300, // Required for polling: refresh every 300 seconds
    refreshMethod: 'polling', // Default method
  },
  // Redis NOT required for polling
});
```

**2. Event-Based (Real-time)**
- Refreshes cache immediately when backend sends events via Redis PubSub
- Requires Redis for PubSub
- `ttl` setting is **ignored** (no periodic polling)
- Suitable for applications that need real-time updates

```typescript
const sdk = new GatrixServerSDK({
  gatrixUrl: 'https://api.gatrix.com',
  apiToken: 'your-token',
  applicationName: 'your-app',
  service: 'worldd',
  group: 'kr-1',
  environment: 'env_prod',
  redis: {
    host: 'localhost',
    port: 6379,
  },
  cache: {
    enabled: true,
    // ttl is NOT used in event mode - cache is only refreshed via Redis events
    refreshMethod: 'event', // Event-based refresh
  },
});
```

> **Note:** In event mode, cache is refreshed only when Redis events are received. There is no periodic polling fallback. If Redis connection is lost, the cache will not be automatically refreshed until the connection is restored.

**3. Manual**
- No automatic cache refresh
- `ttl` setting is **ignored** (no periodic polling)
- Manual refresh only via `sdk.refreshCache()`

```typescript
const sdk = new GatrixServerSDK({
  gatrixUrl: 'https://api.gatrix.com',
  apiToken: 'your-token',
  applicationName: 'your-app',
  service: 'worldd',
  group: 'kr-1',
  environment: 'env_prod',
  cache: {
    enabled: true,
    // ttl is NOT used in manual mode
    refreshMethod: 'manual', // Manual refresh only
  },
});

// Manual refresh when needed
await sdk.refreshCache();
```

#### Refresh All Caches

```typescript
await sdk.refreshCache();
```

#### Refresh Specific Cache

```typescript
await sdk.refreshGameWorldsCache();
await sdk.refreshPopupNoticesCache();
await sdk.refreshSurveysCache();
```

### Event Handling

⚠️ **Note:** Event handling requires:
- Redis configured in SDK
- `refreshMethod: 'event'` in cache configuration

#### Standard Events

The SDK supports the following standard events that are automatically published by the Gatrix backend:

| Event Type | Trigger | Data | Auto-Refresh |
|---|---|---|---|
| `gameworld.created` | New game world created | `{ id, timestamp }` | ✅ Game worlds cache |
| `gameworld.updated` | Game world modified | `{ id, timestamp, isVisible }` | ✅ Game worlds cache |
| `gameworld.deleted` | Game world deleted | `{ id, timestamp }` | ✅ Game worlds cache |
| `gameworld.order_changed` | Game world display order changed | `{ id, timestamp }` | ✅ Game worlds cache |
| `popup.created` | New popup notice created | `{ id, timestamp }` | ✅ Popup notices cache |
| `popup.updated` | Popup notice modified | `{ id, timestamp, isVisible }` | ✅ Popup notices cache |
| `popup.deleted` | Popup notice deleted | `{ id, timestamp }` | ✅ Popup notices cache |
| `survey.created` | New survey created | `{ id, timestamp }` | ✅ Surveys cache |
| `survey.updated` | Survey modified | `{ id, timestamp, isActive }` | ✅ Surveys cache |
| `survey.deleted` | Survey deleted | `{ id, timestamp }` | ✅ Surveys cache |
| `survey.settings.updated` | Survey settings changed | `{ id, timestamp }` | ✅ Surveys cache |
| `maintenance.started` | Maintenance mode activated | `{ id, timestamp }` | ✅ Game worlds cache |
| `maintenance.ended` | Maintenance mode deactivated | `{ id, timestamp }` | ✅ Game worlds cache |
| `whitelist.updated` | IP or Account whitelist modified | `{ id, timestamp }` | ✅ Whitelists cache |

#### Listen to Standard Events

```typescript
sdk.on('gameworld.updated', async (event) => {
  console.log('Game world updated:', event.data);
  // Cache is automatically refreshed
});

sdk.on('popup.updated', async (event) => {
  console.log('Popup updated:', event.data);
});

sdk.on('survey.updated', async (event) => {
  console.log('Survey updated:', event.data);
});

sdk.on('maintenance.started', async (event) => {
  console.log('Maintenance started for world:', event.data.id);
});
```

#### Publish Custom Events

You can publish custom events from your game server to all SDK instances via Redis Pub/Sub:

```typescript
// Publish a custom player level up event
await sdk.publishCustomEvent('player.levelup', {
  playerId: 'player-123',
  newLevel: 50,
  characterName: 'Hero',
  timestamp: Date.now(), // optional, auto-generated if not provided
});

// Publish a custom achievement event
await sdk.publishCustomEvent('achievement.unlocked', {
  playerId: 'player-123',
  achievementId: 'ach-001',
  achievementName: 'First Victory',
});

// Note: Event type is automatically prefixed with 'custom:' if not already
// So 'player.levelup' becomes 'custom:player.levelup'
```

#### Listen to Custom Events

You can listen to custom events published by your application:

```typescript
sdk.on('custom:player.levelup', async (event) => {
  console.log('Player leveled up:', event.data);
  // event.data contains: { playerId, newLevel, characterName, timestamp }
});

sdk.on('custom:achievement.unlocked', async (event) => {
  console.log('Achievement unlocked:', event.data);
  // event.data contains: { playerId, achievementId, achievementName, timestamp }
});
```

#### Listen to All Events

```typescript
sdk.on('*', async (event) => {
  console.log('Event received:', event.type, event.data);
});
```

#### Unregister Event Listener

```typescript
const callback = async (event) => {
  console.log('Event:', event);
};

sdk.on('gameworld.updated', callback);

// Later...
sdk.off('gameworld.updated', callback);
```

### Service Discovery (via Backend API)

Service discovery is managed by the Backend. The SDK communicates with the Backend API for all service discovery operations.

#### Register Service

```typescript
const { instanceId, externalAddress } = await sdk.registerService({
  labels: {
    service: 'worldd',      // Required: service type
    group: 'kr-1',          // Optional: service group
    env: 'production',      // Optional: custom labels
    region: 'ap-northeast-2',
  },
  hostname: 'game-server-1', // Optional: auto-detected from os.hostname() if omitted
  internalAddress: '10.0.0.1', // Optional: auto-detected from first NIC if omitted
  ports: {
    game: 7777,             // Named port: { serviceName: port }
    internalApi: 8080,      // Internal API port (for internal services)
    externalApi: 8081,      // External API port (for external access like edge servers)
    // metricsApi is automatically added from SDK config (default: 9337)
  },
  status: 'ready',
  stats: {
    cpuUsage: 45.5,
    memoryUsage: 2048,
  },
  meta: {
    capacity: 1000,
  },
});

console.log('Service registered:', instanceId);
console.log('External address:', externalAddress); // Auto-detected by backend
```

**Notes:**
- `externalAddress` is auto-detected by the backend from the request IP
- `internalAddress` is optional and will be auto-detected from the first network interface if omitted
- `labels.service` is required; other labels are optional
- `meta` is immutable after registration
- `ports.metricsApi` is automatically added from SDK's `metrics.port` config (default: 9337)

#### Update Service Status

```typescript
await sdk.updateServiceStatus({
  status: 'ready',
  stats: {
    cpuUsage: 45.5,
    memoryUsage: 2048,
    memoryTotal: 8192,
    activeConnections: 150,
  },
});
```

**Notes:**
- `updateServiceStatus()` performs a partial merge - only provided fields are updated
- `stats` can contain any key-value pairs for custom metrics

#### Get Services

```typescript
// Get all services
const allServices = await sdk.fetchServices();

// Get services of specific type
const worldServers = await sdk.fetchServices({ serviceType: 'worldd' });

// Get services by group
const kr1Servers = await sdk.fetchServices({ serviceGroup: 'kr-1' });

// Get ready services only
const readyServers = await sdk.fetchServices({ status: 'ready' });

// Exclude self
const otherServers = await sdk.fetchServices({ excludeSelf: true });

console.log('World servers:', worldServers);
```

#### Get Specific Service

```typescript
const service = await sdk.fetchService('worldd', 'instance-id');
console.log('Service:', service);
```

#### Unregister Service

```typescript
await sdk.unregisterService();
```

#### Service Maintenance

Check if global service maintenance is active and get localized messages.
See [Maintenance API](#maintenance-api) section for full documentation.

```typescript
// Check if service maintenance is active (time-based check)
const isActive = sdk.isServiceMaintenanceActive();

if (isActive) {
  // Get maintenance message in Korean
  const message = sdk.getServiceMaintenanceMessage('ko');
  console.log('Maintenance message:', message);
}
```

**Supported Languages:**
- `ko`: Korean
- `en`: English
- `zh`: Chinese

#### Whitelist Management

The SDK provides both cached and real-time whitelist access:

**Get Cached Whitelists (Recommended for performance):**

```typescript
// Get cached whitelists (no API call)
const whitelists = sdk.getCachedWhitelists();
console.log('IP Whitelist:', whitelists.ipWhitelist);
console.log('Account Whitelist:', whitelists.accountWhitelist);

// Check if IP is whitelisted (uses cached data with CIDR support)
const isIpAllowed = sdk.whitelist.isIpWhitelisted('192.168.1.100');
console.log('IP allowed:', isIpAllowed);

// Check if account is whitelisted (uses cached data)
const isAccountAllowed = sdk.whitelist.isAccountWhitelisted('account123');
console.log('Account allowed:', isAccountAllowed);
```

**Refresh Whitelist Cache:**

```typescript
// Manually refresh whitelist cache
await sdk.refreshWhitelistCache();
console.log('Whitelist cache refreshed');
```

**Real-time Whitelist Updates (Event-based):**

When using event-based cache refresh with Redis, whitelists are automatically updated when the backend publishes `whitelist.updated` events:

```typescript
sdk.on('whitelist.updated', async (event) => {
  console.log('Whitelist updated:', event.data);
  // Cache is automatically refreshed
  const whitelists = sdk.getCachedWhitelists();
  console.log('Updated whitelists:', whitelists);
});
```

**Whitelist Features:**
- IP whitelist supports both exact IP matching and CIDR notation (e.g., `192.168.1.0/24`)
- Automatic CIDR range validation for IP whitelisting
- Time-based validity with `validFrom` and `validUntil` dates
- Automatic filtering of expired entries
- Real-time updates via Redis PubSub events
- Automatic cache refresh on `whitelist.updated` events
- Efficient cached lookups without API calls

## Logger Configuration

The SDK includes a built-in logger with support for custom timestamp formats and time offsets.

### Basic Logger Usage

```typescript
import { Logger, getLogger } from '@gatrix/server-sdk';

// Create logger with default category
const logger = new Logger({
  level: 'info', // 'debug' | 'info' | 'warn' | 'error'
});

logger.info('Application started');
logger.warn('This is a warning', { code: 'WARN_001' });
logger.error('An error occurred', { error: 'Details' });
```

### Category-Based Logger

For better log organization and module identification, use the `getLogger()` factory function to create loggers with specific categories:

```typescript
import { getLogger } from '@gatrix/server-sdk';

// Create logger with custom category
const logger = getLogger('MY-SERVICE');

logger.info('Service initialized');
logger.warn('Warning message');
logger.error('Error occurred', { error: 'Details' });

// Output examples:
// [2025-11-12T10:48:10.454Z] [INFO] [MY-SERVICE] Service initialized
// [2025-11-12T10:48:11.123Z] [WARN] [MY-SERVICE] Warning message
// [2025-11-12T10:48:12.456Z] [ERROR] [MY-SERVICE] Error occurred: { error: 'Details' }
```

### Category Logger with Configuration

```typescript
import { getLogger } from '@gatrix/server-sdk';

const logger = getLogger('CACHE-MANAGER', {
  level: 'debug',
  timeOffset: 9, // +09:00 (Korea)
  timestampFormat: 'local',
});

logger.debug('Cache refresh started');
logger.info('Cache updated', { count: 42 });
```

### Timestamp Formatting

#### ISO8601 Format (Default)

```typescript
const logger = new Logger({
  level: 'info',
  timeOffset: 9, // +09:00 (Korea)
  timestampFormat: 'iso8601', // Default
});

// Output: [2025-11-12T10:48:10.454Z] [INFO] [GatrixServerSDK] Message
```

#### Local Time Format

```typescript
const logger = new Logger({
  level: 'info',
  timeOffset: 9, // +09:00 (Korea)
  timestampFormat: 'local',
});

// Output: [2025-11-12 10:48:10.454] [INFO] [GatrixServerSDK] Message
```

### Time Offset Examples

```typescript
// UTC (Default)
const logger = new Logger({ timeOffset: 0 });

// Korea (+09:00)
const logger = new Logger({ timeOffset: 9 });

// US Eastern (-05:00)
const logger = new Logger({ timeOffset: -5 });

// India (+05:30)
const logger = new Logger({ timeOffset: 5.5 });
```

### JSON Format

For structured logging (e.g., for log aggregation tools like Loki, ELK), use JSON format:

```typescript
const logger = new Logger({
  level: 'info',
  format: 'json', // 'pretty' (default) or 'json'
});

logger.info('User logged in', { userId: 12345 });

// Output:
// {"timestamp":"2025-11-12T10:48:10.454Z","level":"INFO","category":"GatrixServerSDK","message":"User logged in","hostname":"server-01","internalIp":"192.168.1.100","meta":{"userId":12345}}
```

JSON format automatically includes:
- `hostname` - Server hostname
- `internalIp` - Server's internal IP address

### Context Fields

Add custom context fields that appear in every log entry (JSON format only):

```typescript
const logger = new Logger({
  level: 'info',
  format: 'json',
  context: {
    service: 'game-server',
    region: 'us-east-1',
    version: '1.2.3',
  },
});

logger.info('Server started');

// Output:
// {"timestamp":"...","level":"INFO","category":"GatrixServerSDK","message":"Server started","hostname":"...","internalIp":"...","service":"game-server","region":"us-east-1","version":"1.2.3"}
```

### Custom Logger

```typescript
const logger = new Logger({
  level: 'info',
  customLogger: (level, message, meta) => {
    // Your custom logging implementation
    console.log(`[${level.toUpperCase()}] ${message}`, meta);
  },
});
```

### Runtime Logger Configuration

```typescript
const logger = new Logger({ level: 'info' });

// Change timestamp format at runtime
logger.setTimestampFormat('local');

// Change time offset at runtime
logger.setTimeOffset(9);

// Change output format at runtime
logger.setFormat('json');

// Set or update context fields
logger.setContext({ service: 'my-service' });
logger.addContext({ region: 'ap-northeast-2' });

// Get current settings
console.log('Format:', logger.getTimestampFormat());
console.log('Offset:', logger.getTimeOffset());
console.log('Output Format:', logger.getFormat());
console.log('Context:', logger.getContext());
```

## Metrics Server

The SDK provides an independent metrics server for Prometheus scraping. All services use a consistent port (default: 9337) for metrics collection.

### Creating a Metrics Server

```typescript
import { createMetricsServer, getLogger } from '@gatrix/server-sdk';

const logger = getLogger('MY-SERVER');
const metricsServer = createMetricsServer({
  port: 9337,              // Default: 9337 or SDK_METRICS_PORT env
  applicationName: 'my-game-server',
  service: 'worldd',       // Service name (required)
  group: 'kr-1',           // Service group (required)
  environment: 'env_prod', // Environment (required)
  logger,
});

// Start the metrics server
metricsServer.start();

// Stop when shutting down
await metricsServer.stop();
```

### Default Labels

All metrics automatically include these default labels:
- `sdk`: `gatrix-server-sdk`
- `service`: Service name from config
- `group`: Service group from config
- `environment`: Environment from config
- `application`: Application name from config

### Creating Custom Metrics

```typescript
// Create a gauge for tracking online players
const playersOnline = metricsServer.createGauge(
  'players_online',
  'Number of players currently online',
  ['server_id', 'region']
);

// Update the metric
playersOnline.labels('world-1', 'kr').set(150);
playersOnline.labels('world-2', 'us').set(230);

// Create a counter for events
const eventsProcessed = metricsServer.createCounter(
  'events_processed_total',
  'Total events processed',
  ['event_type']
);

// Increment the counter
eventsProcessed.labels('login').inc();
eventsProcessed.labels('logout').inc();

// Create a histogram for response times
const responseTime = metricsServer.createHistogram(
  'request_duration_seconds',
  'Request duration in seconds',
  ['endpoint'],
  [0.01, 0.05, 0.1, 0.5, 1, 5]
);

// Observe a value
responseTime.labels('/api/v1/users').observe(0.123);
```

### Registering External Metrics

You can register existing prom-client metrics:

```typescript
import { Counter } from 'prom-client';

const customCounter = new Counter({
  name: 'custom_events_total',
  help: 'Custom events counter',
  labelNames: ['type'],
});

metricsServer.registerExternalMetric(customCounter);
```

### Accessing the Registry

```typescript
// Get the prom-client registry
const registry = metricsServer.getRegistry();

// Manually get metrics output
const metrics = await registry.metrics();
```

### Metrics Endpoint

The metrics server exposes:
- `GET /metrics` - Prometheus metrics endpoint
- `GET /health` - Health check endpoint (returns 200 OK)

## HTTP Retry Configuration

The SDK includes automatic retry logic with exponential backoff for failed HTTP requests.

### Default Retry Behavior

By default, the SDK retries failed requests up to 10 times with exponential backoff:

```typescript
const sdk = new GatrixServerSDK({
  gatrixUrl: 'https://api.gatrix.com',
  apiToken: 'your-token',
  applicationName: 'your-app',
  service: 'worldd',
  group: 'kr-1',
  environment: 'env_prod',
  // Default retry config (no need to specify)
  retry: {
    enabled: true,
    maxRetries: 10,
    retryDelay: 2000, // 2 seconds
    retryDelayMultiplier: 2,
    maxRetryDelay: 10000, // 10 seconds
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  },
});
```

### Retry Delay Pattern

With default settings, retry delays follow this pattern:
- 1st retry: 2 seconds
- 2nd retry: 4 seconds
- 3rd retry: 8 seconds
- 4th+ retries: 10 seconds (max)

### Custom Retry Configuration

```typescript
const sdk = new GatrixServerSDK({
  gatrixUrl: 'https://api.gatrix.com',
  apiToken: 'your-token',
  applicationName: 'your-app',
  service: 'worldd',
  group: 'kr-1',
  environment: 'env_prod',
  retry: {
    enabled: true,
    maxRetries: -1, // Infinite retries
    retryDelay: 1000, // 1 second
    retryDelayMultiplier: 1.5,
    maxRetryDelay: 30000, // 30 seconds
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  },
});
```

### Disable Retries

```typescript
const sdk = new GatrixServerSDK({
  gatrixUrl: 'https://api.gatrix.com',
  apiToken: 'your-token',
  applicationName: 'your-app',
  service: 'worldd',
  group: 'kr-1',
  environment: 'env_prod',
  retry: {
    enabled: false,
  },
});
```

## Error Handling

```typescript
import { GatrixSDKError, ErrorCode, isGatrixSDKError } from '@gatrix/server-sdk';

try {
  const result = await sdk.redeemCoupon({
    code: 'INVALID_COUPON_CODE',
    userId: 'user-123',
    userName: 'John Doe',
    characterId: 'char-456',
    worldId: 'world-1',
    platform: 'pc',
    channel: 'steam',
    subChannel: 'global',
  });
  console.log('Coupon redeemed successfully:', result);
} catch (error) {
  if (isGatrixSDKError(error)) {
    console.error('SDK Error:', error.code, error.message);
    console.error('Status Code:', error.statusCode);
    console.error('Details:', error.details);
  } else {
    console.error('Unknown error:', error);
  }
}
```

## Development

### Available Scripts

```bash
# Build the SDK
npm run build

# Run tests
npm run test

# Lint code
npm run lint

# Clean build output
npm run clean
```

### Deployment Scripts

Deploy SDK to game server (UWO):

```bash
# Build and deploy to game server (uses default path or GAME_SERVER_PATH env var)
npm run deploy:game

# Bump patch version and deploy
npm run deploy:game:bump

# Set specific version and deploy
npm run deploy:game -- --bump 1.2.3

# Deploy to custom game server path
npm run deploy:game -- --path /path/to/game/server

# Combine options
npm run deploy:game -- --bump 2.0.0 --path /custom/path
```

**Environment Variables:**
- `GAME_SERVER_PATH`: Default game server path (default: `c:/work/uwo/game/server/node`)

The deploy script automatically:
1. Bumps version (with `--bump` flag, optionally to specific version)
2. Builds the SDK
3. Creates npm package (`.tgz`)
4. Copies to game server `lib/` folder
5. Updates game server `package.json`
6. Runs `npm install` in game server

### Test Servers

Run test servers for development:

```bash
# Run all test servers
npm run test:servers

# Run individual test servers
npm run test:authd
npm run test:lobbyd
npm run test:chatd
npm run test:worldd
```

## License

Proprietary - Gatrix Team

