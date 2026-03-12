# @gatrix/gatrix-node-server-sdk

Gatrix Server-side SDK for Node.js - Provides easy access to Gatrix backend APIs with caching, event handling, and service discovery.

## Features

- 🚀 **Easy to use** - Simple API for common operations
- 📦 **Caching** - Built-in caching with automatic refresh
- 🔔 **Event handling** - Real-time cache updates via Redis PubSub
- 🔍 **Service discovery** - Backend API-based service discovery
- 📝 **TypeScript** - Full TypeScript support with type definitions
- 🏴 **Feature flags** - Local evaluation with MurmurHash3 consistent bucketing
- 📊 **Metrics** - Prometheus metrics with prom-client integration
- ☁️ **Cloud detection** - Auto-detect cloud provider, region, zone

## Installation

```bash
npm install @gatrix/gatrix-node-server-sdk
```

## Requirements

- Node.js >= 22.0.0
- Redis (optional, for event handling)

## Quick Start

```typescript
import { GatrixServerSDK } from '@gatrix/gatrix-node-server-sdk';

const sdk = new GatrixServerSDK({
  apiUrl: 'https://api.gatrix.com',
  apiToken: 'your-server-api-token',
  appName: 'your-app-name',
  meta: {
    service: 'worldd',
    group: 'kr-1',
  },
  uses: {
    gameWorld: true,
  },
});

await sdk.initialize();

// Access services via service getters
const worlds = sdk.gameWorld.getCached();
console.log('Game worlds:', worlds);

await sdk.close();
```

### Testing Without API Token

For testing purposes, you can omit the `apiToken` field. The SDK will automatically use `unsecured-server-api-token`.

⚠️ **Warning:** Unsecured tokens are for testing only. Always use proper API tokens in production.

## Configuration

### Full Configuration

```typescript
const sdk = new GatrixServerSDK({
  // Required
  apiUrl: 'https://api.gatrix.com',
  apiToken: 'your-server-api-token',
  appName: 'your-app-name',

  // Optional - Service metadata
  meta: {
    service: 'worldd',          // Service name (e.g., 'auth', 'lobby', 'world', 'chat')
    group: 'kr-1',              // Service group (e.g., 'kr', 'us', 'production')
    version: '1.2.3',           // Version information (for service discovery)
    commitHash: 'abc123',       // Git commit hash
    gitBranch: 'main',          // Git branch name
  },

  // Optional - World ID (for world-specific maintenance checks)
  worldId: 'world-1',

  // Optional - Cloud configuration (auto-detect region from cloud metadata)
  cloud: {
    provider: 'aws', // 'aws' | 'gcp' | 'azure' | 'tencentcloud' | 'alibabacloud' | 'oraclecloud'
  },

  // Optional - Redis (for PubSub events)
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
    enabled: true,          // Enable SDK internal metrics (default: false)
    serverEnabled: true,    // Enable standalone metrics server (default: false)
    port: 9337,             // Metrics server port (default: 9337 or SDK_METRICS_PORT env)
    bindAddress: '0.0.0.0', // Bind address
    userMetricsEnabled: true, // Enable user-specific metrics registry
    collectDefaultMetrics: true, // Collect default Node.js metrics
  },

  // Optional - Feature toggles (selective caching, all default: false — opt-in)
  uses: {
    gameWorld: true,          // Game world caching
    popupNotice: true,        // Popup notice caching
    survey: true,             // Survey caching
    whitelist: true,          // Whitelist caching
    serviceMaintenance: true, // Service maintenance caching
    clientVersion: true,      // Client version caching
    serviceNotice: true,      // Service notice caching
    banner: true,             // Banner caching
    storeProduct: true,       // Store product caching
    featureFlag: true,        // Feature flag caching and evaluation
    vars: true,               // Vars (KV) caching
  },

  // Optional - Feature flag specific settings
  featureFlags: {
    compact: true, // Strip evaluation data from disabled flags (default: true)
  },

  // Optional - Logger
  logger: {
    level: 'info', // 'debug' | 'info' | 'warn' | 'error'
    timeOffset: 9, // Time offset in hours (e.g., 9 for +09:00). Default: 0 (UTC)
    timestampFormat: 'local', // 'iso8601' | 'local'. Default: 'iso8601'
    format: 'pretty', // 'pretty' | 'json'. Default: 'pretty'
    context: { env: 'production' }, // Extra context fields (JSON format only)
    customLogger: (level, message, meta) => {
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
import { GatrixServerSDK, GatrixSDKConfig } from '@gatrix/gatrix-node-server-sdk';

const baseConfig: GatrixSDKConfig = {
  apiUrl: 'https://api.gatrix.com',
  apiToken: 'your-server-api-token',
  appName: 'my-game',
  meta: { service: 'default-service', group: 'default-group' },
  redis: { host: 'localhost', port: 6379 },
  cache: { enabled: true, refreshMethod: 'event' },
};

// Create instance with overrides
const worldSDK = GatrixServerSDK.createInstance(baseConfig, {
  meta: { service: 'worldd', group: 'kr-1' },
  metrics: { enabled: true, serverEnabled: true, port: 9338 },
});

const authSDK = GatrixServerSDK.createInstance(baseConfig, {
  meta: { service: 'authd', group: 'global' },
  cache: { ttl: 60 },
});
```

All fields in `GatrixSDKInitOptions` are optional. Unspecified fields use values from the base config. Nested objects are deep merged.

### Multi-Environment Mode

Multi-environment mode is primarily designed for Edge servers that need to serve and cache data for multiple environments simultaneously. While it can be used for general purposes, the typical use case is Edge-like infrastructure.

Use `environmentProvider` to configure multi-environment mode:

```typescript
import { GatrixServerSDK, IEnvironmentProvider } from '@gatrix/gatrix-node-server-sdk';

const environmentProvider: IEnvironmentProvider = {
  getEnvironmentTokens: () => [
    { environmentId: 'env_dev', token: 'dev-token' },
    { environmentId: 'env_prod', token: 'prod-token' },
  ],
};

const sdk = new GatrixServerSDK({
  apiUrl: 'https://api.gatrix.com',
  apiToken: 'your-bypass-token',
  appName: 'edge-server',
  meta: { service: 'edge', group: 'default' },
  environmentProvider,
  redis: { host: 'localhost', port: 6379 },
  cache: { enabled: true, refreshMethod: 'event' },
});

await sdk.initialize();

// Access data for specific environments
const devWorlds = sdk.gameWorld.getCached('env_dev');
const prodWorlds = sdk.gameWorld.getCached('env_prod');
```

## Service Getter Pattern

All services are accessed via public getters on the SDK instance:

| Getter                 | Service                  | `uses` Key           |
| ---------------------- | ------------------------ | -------------------- |
| `sdk.gameWorld`        | GameWorldService         | `gameWorld`          |
| `sdk.popupNotice`     | PopupNoticeService       | `popupNotice`       |
| `sdk.survey`          | SurveyService            | `survey`            |
| `sdk.whitelist`       | WhitelistService         | `whitelist`         |
| `sdk.serviceMaintenance` | ServiceMaintenanceService | `serviceMaintenance` |
| `sdk.featureFlag`     | FeatureFlagService       | `featureFlag`       |
| `sdk.vars`            | VarsService              | `vars`              |
| `sdk.storeProduct`    | StoreProductService      | `storeProduct`      |
| `sdk.banner`          | BannerService            | (Edge feature)       |
| `sdk.clientVersion`   | ClientVersionService     | (Edge feature)       |
| `sdk.serviceNotice`   | ServiceNoticeService     | (Edge feature)       |
| `sdk.coupon`          | CouponService            | Always available     |
| `sdk.serviceDiscovery`| ServiceDiscoveryService  | Always available     |
| `sdk.impactMetrics`   | MetricsAPI               | Always available     |

### Common Service Methods

All cacheable services (extending `BaseEnvironmentService`) share these methods:

| Method                                   | Description                               |
| ---------------------------------------- | ----------------------------------------- |
| `getCached(environmentId?)`              | Get cached items                          |
| `listByEnvironment(environmentId?)`      | Fetch from API and update cache           |
| `refreshByEnvironment(environmentId?)`   | Refresh cache for specific environment    |

> In single-environment mode, the `environmentId` parameter can be omitted for all methods.

## API Reference

### Feature Flags (`sdk.featureFlag`)

Local evaluation with no backend roundtrip per request. Flag definitions are cached locally and evaluated using the shared `FeatureFlagEvaluator` with **MurmurHash3** for consistent percentage bucketing across all platforms.

> **Note:** Requires `uses: { featureFlag: true }` in config.

#### Basic Usage

```typescript
// Check if a flag is enabled (with explicit fallback)
const enabled = sdk.featureFlag.isEnabled('new_battle_mode', false);

// Get typed variation values
const config = sdk.featureFlag.stringVariation('battle_config', 'default');
const maxPlayers = sdk.featureFlag.numberVariation('max_players', 100);
const premium = sdk.featureFlag.boolVariation('premium_mode', false);
const settings = sdk.featureFlag.jsonVariation<GameSettings>('game_settings', defaultSettings);
```

#### Evaluation with Context

```typescript
const context = {
  userId: 'user-123',
  sessionId: 'session-456',
  appVersion: '1.2.3',
  properties: {
    platform: 'pc',
    country: 'KR',
    level: 50,
  },
};

const enabled = sdk.featureFlag.isEnabled('new_feature', context, false);
const variant = sdk.featureFlag.stringVariation('feature_config', context, 'default');
```

#### Evaluation Methods

| Method                                             | Returns            | Description                             |
| -------------------------------------------------- | ------------------ | --------------------------------------- |
| `isEnabled(flag, fallback, env?)`                  | `boolean`          | Whether the flag is enabled             |
| `isEnabled(flag, context, fallback, env?)`         | `boolean`          | Whether the flag is enabled (with context) |
| `boolVariation(flag, fallback, env?)`              | `boolean`          | Boolean variation value                 |
| `boolVariation(flag, context, fallback, env?)`     | `boolean`          | Boolean variation value (with context)  |
| `stringVariation(flag, fallback, env?)`            | `string`           | String variant value                    |
| `stringVariation(flag, context, fallback, env?)`   | `string`           | String variant value (with context)     |
| `numberVariation(flag, fallback, env?)`            | `number`           | Number variant value                    |
| `numberVariation(flag, context, fallback, env?)`   | `number`           | Number variant value (with context)     |
| `jsonVariation<T>(flag, fallback, env?)`           | `T`                | Deserialized JSON variant value         |
| `jsonVariation<T>(flag, context, fallback, env?)`  | `T`                | Deserialized JSON variant value (with context) |
| `evaluate(flag, context?, env?)`                   | `EvaluationResult` | Full evaluation details                 |

#### Detail Methods

Returns the value along with evaluation metadata (reason, flagName, variantName):

```typescript
const detail = sdk.featureFlag.stringVariationDetail('feature_config', 'default', context);
console.log('Value:', detail.value);
console.log('Reason:', detail.reason); // 'strategy_match', 'default', 'disabled', 'not_found'
console.log('Variant:', detail.variantName);
```

#### OrThrow Methods

Throws `FeatureFlagError` if the flag is not found or has no value:

```typescript
try {
  const value = sdk.featureFlag.stringVariationOrThrow('required_config', context);
} catch (error) {
  if (error instanceof FeatureFlagError) {
    console.error('Flag error:', error.code, error.message);
    // error.code: 'FLAG_NOT_FOUND' | 'NO_VALUE' | 'INVALID_VALUE_TYPE'
  }
}
```

#### Static Context

Set default context applied to all evaluations. Per-evaluation context takes precedence:

```typescript
sdk.featureFlag.setStaticContext({
  appName: 'my-game',
  properties: {
    platform: 'pc',
    region: 'kr',
  },
});
```

#### Feature Flag Metrics

Flag evaluation metrics are collected and sent to the backend periodically:

```typescript
// Metrics are auto-started on SDK initialization
// Configure at runtime:
sdk.featureFlag.setMetricsConfig({
  enabled: true,
  flushIntervalMs: 60000, // Default: 1 minute
  maxBufferSize: 1000, // Auto-flush threshold
});
```

#### Evaluation Algorithm

- Uses **MurmurHash3** (32-bit, seed 0) for consistent percentage bucketing
- Formula: `(murmurhash3(groupId + ':' + stickinessValue, 0) % 10001) / 100.0`
- Range: `0.00` – `100.00`
- Produces identical results across TypeScript and C# SDKs
- Supports stickiness modes: `default` (userId → sessionId fallback), `userId`, `sessionId`, `random`, or any custom context property

### Impact Metrics (`sdk.impactMetrics`)

Application-level metrics for safeguard evaluation. Define and record metrics that can be used for release flow monitoring.

```typescript
// Define metrics
sdk.impactMetrics.defineCounter('http_errors', 'Count of HTTP errors');
sdk.impactMetrics.defineHistogram('response_time_ms', 'Response time', [10, 50, 100, 500, 1000]);

// Record metrics during request handling
sdk.impactMetrics.incrementCounter('http_errors');
sdk.impactMetrics.observeHistogram('response_time_ms', 42);
```

Impact metrics are automatically flushed to the backend every 60 seconds.

### Game Worlds (`sdk.gameWorld`)

> **Note:** Requires `uses: { gameWorld: true }` in config.

```typescript
// Fetch from API
const worlds = await sdk.gameWorld.listByEnvironment();

// Get cached data
const cached = sdk.gameWorld.getCached();

// Get by ID / worldId
const world = await sdk.gameWorld.getById('world-id');
const world = await sdk.gameWorld.getByWorldId('world-1');

// Get from cache by worldId
const world = sdk.gameWorld.getWorldByWorldId('world-1');

// Check maintenance
const isActive = sdk.gameWorld.isWorldMaintenanceActive('world-1');
const message = sdk.gameWorld.getWorldMaintenanceMessage('world-1', undefined, 'ko');
```

Each game world object includes:

- `worldId`: Unique world identifier
- `worldServerAddress`: Server address (URL or host:port)
- `name`: World name
- `isMaintenance`: Whether maintenance is scheduled
- `customPayload`: Custom JSON data
- `infraSettings`: Infrastructure settings

### Coupon (`sdk.coupon`)

```typescript
const result = await sdk.coupon.redeem({
  code: 'COUPON123',
  userId: 'user-123',
  userName: 'John Doe',
  characterId: 'char-456',
  worldId: 'world-1',
  platform: 'pc',
  channel: 'steam',
  subChannel: 'global',
});

console.log('Reward:', result.reward);
console.log('User used count:', result.userUsedCount);
```

### Vars / KV (`sdk.vars`)

> **Note:** Requires `uses: { vars: true }` in config.

```typescript
// Get all cached vars
const vars = sdk.vars.getCached();

// Get variable value by key
const value = sdk.vars.getValue('$channels');

// Get parsed JSON value
const channels = sdk.vars.getParsedValue<any[]>('$channels');

// Get single var item
const item = sdk.vars.getByKey('$channels');
```

### Popup Notices (`sdk.popupNotice`)

> **Note:** Requires `uses: { popupNotice: true }` in config.

```typescript
// Fetch from API
const notices = await sdk.popupNotice.listByEnvironment();

// Get cached
const cached = sdk.popupNotice.getCached();

// Get notices for specific world
const worldNotices = sdk.popupNotice.getNoticesForWorld('world-1');

// Get active notices with targeting filters
const active = sdk.popupNotice.getActivePopupNotices({
  platform: 'pc',
  channel: 'steam',
  subChannel: 'global',
  worldId: 'world-1',
  userId: 'user-123',
});
```

### Store Products (`sdk.storeProduct`)

> **Note:** Requires `uses: { storeProduct: true }` in config.

```typescript
// Fetch from API
const products = await sdk.storeProduct.listByEnvironment();

// Get cached
const cached = sdk.storeProduct.getCached();
```

### Surveys (`sdk.survey`)

> **Note:** Requires `uses: { survey: true }` in config.

```typescript
// Fetch from API
const surveys = await sdk.survey.listByEnvironment();

// Get cached surveys
const cached = sdk.survey.getCached();

// Get cached settings
const settings = sdk.survey.getCachedSettings();

// Get surveys for specific world
const worldSurveys = sdk.survey.getSurveysForWorld('world-1');

// Get active surveys filtered by user conditions
const active = sdk.survey.getActiveSurveys('pc', 'steam', 'global', 'world-1', 50, 30);
```

### Whitelist (`sdk.whitelist`)

> **Note:** Requires `uses: { whitelist: true }` in config.

```typescript
// Fetch from API
const data = await sdk.whitelist.listByEnvironment();

// Get cached
const cached = sdk.whitelist.getCached();

// Check if IP is whitelisted (supports CIDR notation)
const isIpAllowed = sdk.whitelist.isIpWhitelisted('192.168.1.100');

// Check if account is whitelisted
const isAccountAllowed = sdk.whitelist.isAccountWhitelisted('account123');
```

### Banners (`sdk.banner`)

> **Note:** Requires `uses: { banner: true }` in config.

```typescript
const banners = sdk.banner.getCached();
```

### Client Versions (`sdk.clientVersion`)

> **Note:** Requires `uses: { clientVersion: true }` in config.

```typescript
const versions = sdk.clientVersion.getCached();
```

### Service Notices (`sdk.serviceNotice`)

> **Note:** Requires `uses: { serviceNotice: true }` in config.

```typescript
const notices = sdk.serviceNotice.getCached();
```

### Service Maintenance (`sdk.serviceMaintenance`)

> **Note:** Requires `uses: { serviceMaintenance: true }` in config.

The SDK also provides convenience methods directly on the SDK instance for comprehensive maintenance checks:

#### Naming Convention

| Property/Method           | Description                                                |
| ------------------------- | ---------------------------------------------------------- |
| `hasMaintenanceScheduled` | Whether maintenance is scheduled (configured in admin)     |
| `isMaintenanceActive`     | Whether maintenance is currently active (time-based check) |

#### Check Maintenance Status

```typescript
// Check global service maintenance
const isActive = sdk.isServiceMaintenanceActive();
const message = sdk.getServiceMaintenanceMessage('ko');

// Check combined maintenance (service + world)
const isActive = sdk.isMaintenanceActive('world-1');

// Get comprehensive maintenance info
const info = sdk.getMaintenanceInfo('world-1', 'ko');
// {
//   isMaintenanceActive, source, message,
//   startsAt, endsAt, forceDisconnect,
//   gracePeriodMinutes, actualStartTime
// }

// Get current status for client delivery
const status = sdk.getCurrentMaintenanceStatus();

// Get status with whitelist exemption check
const status = sdk.getMaintenanceStatusForClient({
  clientIp: '192.168.1.100',
  accountId: 'account123',
});
// If whitelisted: { isMaintenanceActive: false, isWhitelisted: true }
```

#### Maintenance Events

```typescript
sdk.on('local.maintenance.started', (event) => {
  console.log('Maintenance started:', event.data);
});

sdk.on('local.maintenance.ended', (event) => {
  console.log('Maintenance ended:', event.data);
});

sdk.on('local.maintenance.grace_period_expired', (event) => {
  console.log('Grace period expired:', event.data);
});
```

### Service Discovery (`sdk.serviceDiscovery`)

Service discovery is managed by the Backend API. Always available without `uses` configuration.

#### Register Service

```typescript
const { instanceId, externalAddress } = await sdk.registerService({
  labels: {
    service: 'worldd', // Required: service type
    group: 'kr-1', // Optional: service group
  },
  hostname: 'game-server-1', // Optional: auto-detected from os.hostname()
  internalAddress: '10.0.0.1', // Optional: auto-detected from first NIC
  ports: {
    game: 7777,
    internalApi: 8080,
    externalApi: 8081,
    // metricsApi is automatically added from SDK config (default: 9337)
  },
  status: 'ready',
  stats: { cpuUsage: 45.5, memoryUsage: 2048 },
  meta: { capacity: 1000 }, // Immutable after registration
});
```

**Notes:**

- `externalAddress` is auto-detected by the backend from the request IP
- Cloud metadata labels (`cloudProvider`, `cloudRegion`, `cloudZone`, `cloudInstanceId`) are automatically added
- `meta.version`, `meta.commitHash`, `meta.gitBranch` from SDK config are automatically merged

#### Update Status

```typescript
await sdk.updateServiceStatus({
  status: 'ready',
  stats: { cpuUsage: 45.5, memoryUsage: 2048, activeConnections: 150 },
  // autoRegisterIfMissing: true (default) — auto-registers if instance not found
});
```

#### Query Services

```typescript
const allServices = await sdk.fetchServices();
const worldServers = await sdk.fetchServices({ service: 'worldd' });
const kr1Servers = await sdk.fetchServices({ group: 'kr-1' });
const readyServers = await sdk.fetchServices({ status: 'ready' });
const otherServers = await sdk.fetchServices({ excludeSelf: true });

const specific = await sdk.fetchService('worldd', 'instance-id');
```

#### Unregister

```typescript
await sdk.unregisterService();
```

### Cache Management

#### Cache Refresh Methods

| Method    | TTL Used | Redis Required | Refresh Trigger                        |
| --------- | -------- | -------------- | -------------------------------------- |
| `polling` | ✅ Yes    | ❌ No           | Periodic interval based on `ttl`       |
| `event`   | ❌ No     | ✅ Yes          | Redis PubSub events from backend       |
| `manual`  | ❌ No     | ❌ No           | Manual refresh calls only              |

#### Refresh All Caches

```typescript
await sdk.refreshCache();
```

#### Refresh Specific Caches

```typescript
await sdk.refreshGameWorldsCache();
await sdk.refreshPopupNoticesCache();
await sdk.refreshSurveysCache();
await sdk.refreshServiceMaintenanceCache();
await sdk.refreshWhitelistCache();
await sdk.refreshVarsCache();
```

Or via service getters:

```typescript
await sdk.gameWorld.refreshByEnvironment();
await sdk.popupNotice.refreshByEnvironment();
await sdk.survey.refreshByEnvironment();
```

### Event Handling

⚠️ Requires Redis + `refreshMethod: 'event'` in cache config.

#### Standard Events

| Event Type                | Trigger                          | Auto-Refresh          |
| ------------------------- | -------------------------------- | --------------------- |
| `gameworld.created`       | New game world created           | ✅ Game worlds cache   |
| `gameworld.updated`       | Game world modified              | ✅ Game worlds cache   |
| `gameworld.deleted`       | Game world deleted               | ✅ Game worlds cache   |
| `gameworld.order_changed` | Display order changed            | ✅ Game worlds cache   |
| `popup.created`           | New popup notice created         | ✅ Popup notices cache |
| `popup.updated`           | Popup notice modified            | ✅ Popup notices cache |
| `popup.deleted`           | Popup notice deleted             | ✅ Popup notices cache |
| `survey.created`          | New survey created               | ✅ Surveys cache       |
| `survey.updated`          | Survey modified                  | ✅ Surveys cache       |
| `survey.deleted`          | Survey deleted                   | ✅ Surveys cache       |
| `survey.settings.updated` | Survey settings changed          | ✅ Surveys cache       |
| `maintenance.started`     | Maintenance mode activated       | ✅ Game worlds cache   |
| `maintenance.ended`       | Maintenance mode deactivated     | ✅ Game worlds cache   |
| `whitelist.updated`       | Whitelist modified               | ✅ Whitelists cache    |

#### Listen to Events

```typescript
sdk.on('gameworld.updated', async (event) => {
  console.log('Game world updated:', event.data);
});
```

#### Custom Events (via Redis Pub/Sub)

```typescript
// Publish (auto-prefixed with 'custom:')
await sdk.publishCustomEvent('player.levelup', {
  playerId: 'player-123',
  newLevel: 50,
});

// Listen
sdk.on('custom:player.levelup', async (event) => {
  console.log('Player leveled up:', event.data);
});
```

#### Special Events

```typescript
// Listen to all events
sdk.on('*', async (event) => {
  console.log('Event:', event.type, event.data);
});

// Connection recovery event (cache auto-refreshed after)
sdk.on('connection.restored', (event) => {
  console.log('Connection restored');
});
```

#### Unsubscribe

```typescript
// on() returns an unsubscribe function
const unsubscribe = sdk.on('gameworld.updated', callback);
unsubscribe();

// Or use off()
sdk.off('gameworld.updated', callback);
```

## Logger Configuration

```typescript
import { Logger, getLogger } from '@gatrix/gatrix-node-server-sdk';

// Category-based logger
const logger = getLogger('MY-SERVICE');
logger.info('Service initialized');

// With configuration
const logger = getLogger('CACHE-MANAGER', {
  level: 'debug',
  timeOffset: 9, // +09:00 (Korea)
  timestampFormat: 'local',
});

// JSON format (for log aggregation tools like Loki, ELK)
const logger = new Logger({
  level: 'info',
  format: 'json',
  context: { service: 'game-server', region: 'us-east-1', version: '1.2.3' },
});

logger.info('User logged in', { userId: 12345 });
// Output: {"timestamp":"...","level":"INFO","message":"User logged in","service":"game-server",...}
```

### Runtime Configuration

```typescript
logger.setTimestampFormat('local');
logger.setTimeOffset(9);
logger.setFormat('json');
logger.setContext({ service: 'my-service' });
logger.addContext({ region: 'ap-northeast-2' });
```

## Metrics Server

### Standalone Metrics Server

```typescript
import { createMetricsServer, getLogger } from '@gatrix/gatrix-node-server-sdk';

const metricsServer = createMetricsServer({
  port: 9337,
  appName: 'my-game-server',
  service: 'worldd',
  group: 'kr-1',
  logger: getLogger('MY-SERVER'),
});

metricsServer.start();

// Create custom metrics
const playersOnline = metricsServer.createGauge(
  'players_online', 'Number of players online', ['server_id', 'region']
);
playersOnline.labels('world-1', 'kr').set(150);

const eventsProcessed = metricsServer.createCounter(
  'events_processed_total', 'Total events processed', ['event_type']
);
eventsProcessed.labels('login').inc();

const responseTime = metricsServer.createHistogram(
  'request_duration_seconds', 'Request duration', ['endpoint'],
  [0.01, 0.05, 0.1, 0.5, 1, 5]
);
responseTime.labels('/api/v1/users').observe(0.123);
```

Endpoints:

- `GET /metrics` - Prometheus metrics
- `GET /health` - Health check (200 OK)

### HTTP Metrics Middleware

```typescript
const privateMiddleware = sdk.createHttpMetricsMiddleware({ scope: 'private' });
const publicMiddleware = sdk.createHttpMetricsMiddleware({ scope: 'public' });

privateApp.use(privateMiddleware);
publicApp.use(publicMiddleware);
```

### User Metrics Registry

```typescript
const provider = sdk.getUserMetricsProvider();
if (provider) {
  const counter = provider.createCounter('game_events_total', 'Game events', ['type']);
  counter.labels('login').inc();
}
```

## Cloud Metadata Detection

The SDK automatically detects cloud provider metadata during initialization:

```typescript
const metadata = sdk.getCloudMetadata();
console.log('Provider:', metadata.provider); // 'aws' | 'gcp' | 'azure' | ...
console.log('Region:', metadata.region);
console.log('Zone:', metadata.zone);

const region = sdk.getRegion();
```

Supported: AWS, GCP, Azure, Tencent Cloud, Alibaba Cloud, Oracle Cloud

## HTTP Retry Configuration

Default retry with exponential backoff:

- 1st retry: 2s → 2nd: 4s → 3rd: 8s → 4th+: 10s (max)
- Retryable status codes: 408, 429, 500, 502, 503, 504
- Max retries: 10 (set to -1 for infinite)

## Error Handling

```typescript
import {
  GatrixSDKError, isGatrixSDKError,
  CouponRedeemError, isCouponRedeemError,
  FeatureFlagError,
} from '@gatrix/gatrix-node-server-sdk';

try {
  await sdk.coupon.redeem({ ... });
} catch (error) {
  if (isCouponRedeemError(error)) {
    console.error('Coupon error:', error.code, error.message);
  } else if (isGatrixSDKError(error)) {
    console.error('SDK error:', error.code, error.statusCode);
  }
}
```

## Development

```bash
# Build
yarn build

# Test
yarn test

# Lint
yarn lint

# Deploy to game server
yarn deploy:game
yarn deploy:game:bump      # Bump version and deploy
```

### Test Servers

```bash
yarn test:servers   # Run all test servers
yarn test:authd     # Auth server
yarn test:lobbyd    # Lobby server
yarn test:chatd     # Chat server
yarn test:worldd    # World server
```

## License

MIT License - see [LICENSE](../../../LICENSE) for details.
