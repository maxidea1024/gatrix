# @gatrix/server-sdk

Gatrix Server-side SDK for Node.js - Provides easy access to Gatrix backend APIs with caching, event handling, and service discovery.

## Features

- 🚀 **Easy to use** - Simple API for common operations
- 📦 **Caching** - Built-in caching with automatic refresh
- 🔔 **Event handling** - Real-time cache updates via BullMQ
- 🔍 **Service discovery** - etcd and Redis-based service discovery
- 📝 **TypeScript** - Full TypeScript support with type definitions
- ✅ **Tested** - Comprehensive test coverage

## Installation

```bash
npm install @gatrix/server-sdk
```

## Requirements

- Node.js >= 22.0.0
- Redis (optional, for event handling)
- etcd (optional, for service discovery)

## Quick Start

```typescript
import { GatrixSDK } from '@gatrix/server-sdk';

// Create SDK instance
const sdk = new GatrixSDK({
  gatrixUrl: 'https://api.gatrix.com',
  apiToken: 'your-server-api-token',
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

## Configuration

### Basic Configuration

```typescript
const sdk = new GatrixSDK({
  gatrixUrl: 'https://api.gatrix.com',
  apiToken: 'your-server-api-token',
  applicationName: 'your-app-name',
});
```

### With Redis (for event handling)

```typescript
const sdk = new GatrixSDK({
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

### With etcd (for service discovery)

```typescript
const sdk = new GatrixSDK({
  gatrixUrl: 'https://api.gatrix.com',
  apiToken: 'your-server-api-token',
  applicationName: 'your-app-name',
  etcd: {
    hosts: 'localhost:2379,localhost:2380',
  },
  serviceDiscovery: {
    enabled: true,
    mode: 'etcd', // or 'redis'
    ttlSeconds: 30,
    heartbeatIntervalMs: 10000,
  },
});
```

### Full Configuration

```typescript
const sdk = new GatrixSDK({
  // Required
  gatrixUrl: 'https://api.gatrix.com',
  apiToken: 'your-server-api-token',
  applicationName: 'your-app-name',

  // Optional - Redis
  redis: {
    host: 'localhost',
    port: 6379,
    password: 'your-redis-password',
    db: 0,
  },

  // Optional - etcd
  etcd: {
    hosts: 'localhost:2379',
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

  // Optional - Service Discovery
  serviceDiscovery: {
    enabled: true,
    mode: 'etcd', // 'redis' | 'etcd'
    ttlSeconds: 30,
    heartbeatIntervalMs: 10000,
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

#### Get Game World by ID

```typescript
const world = await sdk.getGameWorldById(1);
console.log('World:', world);
```

#### Get Game World by World ID

```typescript
const world = await sdk.getGameWorldByWorldId('world-1');
console.log('World:', world);
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

### Service Discovery

#### Register Service

```typescript
const instanceId = await sdk.registerService({
  type: 'world',
  hostname: 'game-server-1',
  externalAddress: '203.0.113.1',
  internalAddress: '10.0.0.1',
  ports: {
    tcp: [7777],
    http: [8080],
  },
  status: 'ready',
  meta: {
    region: 'us-west',
    capacity: 1000,
  },
});

console.log('Service registered:', instanceId);
```

#### Update Service Status

```typescript
await sdk.updateServiceStatus({
  status: 'ready',
  instanceStats: {
    cpuUsage: 45.5,
    memoryUsage: 2048,
    memoryTotal: 8192,
  },
});
```

#### Get Services

```typescript
// Get all services
const allServices = await sdk.getServices();

// Get services of specific type
const worldServers = await sdk.getServices('world');

console.log('World servers:', worldServers);
```

#### Get Specific Service

```typescript
const service = await sdk.getService('instance-id', 'world');
console.log('Service:', service);
```

#### Unregister Service

```typescript
await sdk.unregisterService();
```

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

## License

MIT

