# @gatrix/server-sdk

Gatrix Server-side SDK for Node.js - Provides easy access to Gatrix backend APIs with caching, event handling, and service discovery.

## Features

- 🚀 **Easy to use** - Simple API for common operations
- 📦 **Caching** - Built-in caching with automatic refresh
- 🔔 **Event handling** - Real-time cache updates via BullMQ
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
  gatrixUrl: 'https://api.gatrix.com',
  apiToken: 'your-server-api-token', // Optional: defaults to 'gatrix-unsecured-server-api-token' for testing
  applicationName: 'your-app-name',
});

// Initialize SDK (loads cache)
await sdk.initialize();

// Use SDK
const worlds = await sdk.getGameWorlds();
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
  gatrixUrl: 'https://api.gatrix.com',
  apiToken: 'your-server-api-token',
  applicationName: 'your-app-name',
});
```

### With Redis (for event handling)

```typescript
const sdk = new GatrixServerSDK({
  gatrixUrl: 'https://api.gatrix.com',
  apiToken: 'your-server-api-token',
  applicationName: 'your-app-name',
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
    ttl: 300, // seconds
    autoRefresh: true,
  },

  // Optional - Logger
  logger: {
    level: 'info', // 'debug' | 'info' | 'warn' | 'error'
    customLogger: (level, message, meta) => {
      // Custom logger implementation
      console.log(`[${level}] ${message}`, meta);
    },
  },
});
```

## API Reference

### Coupon

#### Redeem Coupon

```typescript
const result = await sdk.redeemCoupon({
  code: 'COUPON123',
  userId: 'user-123',
  userName: 'John Doe',
  characterId: 'char-456',
  worldId: 'world-1', // optional
  platform: 'pc', // optional
  channel: 'steam', // optional
  subChannel: 'global', // optional
  requestId: 'unique-request-id', // optional, for idempotency
});

console.log('Reward:', result.reward);
console.log('User used count:', result.userUsedCount);
```

### Game Worlds

#### Get All Game Worlds

```typescript
const worlds = await sdk.getGameWorlds('en'); // language parameter (default: 'en')
console.log('Worlds:', worlds);
```

Each game world object includes:
- `worldId`: Unique world identifier
- `worldServerAddress`: Server address in `ip:port` format (e.g., `192.168.1.100:8080`)
- `name`: World name (localized)
- `description`: World description (localized)
- `status`: World status (`active`, `maintenance`, etc.)
- `customPayload`: Custom JSON data for game-specific configuration

#### Get Game World by ID

```typescript
const world = await sdk.getGameWorldById(1);
console.log('World:', world);
console.log('Server address:', world.worldServerAddress); // e.g., "192.168.1.100:8080"
```

#### Get Game World by World ID

```typescript
const world = await sdk.getGameWorldByWorldId('world-1');
console.log('World:', world);
console.log('Server address:', world.worldServerAddress); // e.g., "192.168.1.100:8080"
```

#### Get Cached Game Worlds

```typescript
const worlds = sdk.getCachedGameWorlds();
console.log('Cached worlds:', worlds);
```

#### Check Maintenance Status

```typescript
const isMaintenance = sdk.isWorldInMaintenance('world-1');
console.log('Is in maintenance:', isMaintenance);

const message = sdk.getMaintenanceMessage('world-1');
console.log('Maintenance message:', message);
```

### Popup Notices

#### Get Active Popup Notices

```typescript
const notices = await sdk.getPopupNotices();
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
const surveys = await sdk.getSurveys();
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
```

#### Listen to Custom Events

```typescript
sdk.on('custom:player.levelup', async (event) => {
  console.log('Player leveled up:', event.data);
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
  hostname: 'game-server-1',
  internalAddress: '10.0.0.1', // Optional: auto-detected from first NIC if omitted
  ports: {
    tcp: [7777],
    http: [8080],
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
const allServices = await sdk.getServices();

// Get services of specific type
const worldServers = await sdk.getServices({ serviceType: 'worldd' });

// Get services by group
const kr1Servers = await sdk.getServices({ serviceGroup: 'kr-1' });

// Get ready services only
const readyServers = await sdk.getServices({ status: 'ready' });

// Exclude self
const otherServers = await sdk.getServices({ excludeSelf: true });

console.log('World servers:', worldServers);
```

#### Get Specific Service

```typescript
const service = await sdk.getService('worldd', 'instance-id');
console.log('Service:', service);
```

#### Unregister Service

```typescript
await sdk.unregisterService();
```

#### Service Maintenance

Check if a service is in maintenance mode and get localized maintenance messages:

```typescript
// Check if service is in maintenance
const isInMaintenance = await sdk.isServiceInMaintenance('world');

if (isInMaintenance) {
  // Get maintenance message in Korean
  const message = await sdk.getServiceMaintenanceMessage('world', 'ko');
  console.log('Maintenance message:', message);

  // Get message in English
  const enMessage = await sdk.getServiceMaintenanceMessage('world', 'en');
  console.log('Maintenance message (EN):', enMessage);
}
```

**Supported Languages:**
- `ko`: Korean
- `en`: English
- `zh`: Chinese

#### Whitelist Management

Retrieve IP and Account whitelists:

```typescript
// Get all whitelists
const whitelists = await sdk.getWhitelists();
console.log('IP Whitelist:', whitelists.ipWhitelist);
console.log('Account Whitelist:', whitelists.accountWhitelist);

// Check if IP is whitelisted
const isIpAllowed = await sdk.isIpWhitelisted('192.168.1.100');
console.log('IP allowed:', isIpAllowed);

// Check if account is whitelisted
const isAccountAllowed = await sdk.isAccountWhitelisted('account123');
console.log('Account allowed:', isAccountAllowed);
```

**Whitelist Features:**
- IP whitelist supports CIDR notation (e.g., `192.168.1.0/24`)
- Time-based validity with `validFrom` and `validUntil` dates
- Automatic filtering of expired entries

## Error Handling

```typescript
import { GatrixSDKError, ErrorCode, isGatrixSDKError } from '@gatrix/server-sdk';

try {
  await sdk.redeemCoupon({
    code: 'INVALID',
    userId: 'user-123',
    userName: 'John',
    characterId: 'char-456',
  });
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

## Migration from GatrixSDK to GatrixServerSDK

The SDK has been renamed from `GatrixSDK` to `GatrixServerSDK` to emphasize that it's a server-side SDK. The old name is still available for backward compatibility:

```typescript
// New (recommended)
import { GatrixServerSDK } from '@gatrix/server-sdk';
const sdk = new GatrixServerSDK({ ... });

// Old (still works)
import { GatrixSDK } from '@gatrix/server-sdk';
const sdk = new GatrixSDK({ ... });
```

### Service Discovery Changes

Service discovery is now handled entirely by the Backend API. The SDK no longer connects directly to Redis or etcd:

- ✅ **Before**: SDK connected directly to Redis/etcd for service discovery
- ✅ **Now**: SDK uses Backend API for all service discovery operations
- ✅ **Benefit**: Simplified configuration, no need for Redis/etcd credentials in game servers

## License

MIT

