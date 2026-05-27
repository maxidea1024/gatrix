# Gatrix CocosCreator Client SDK

Client-side SDK for [Gatrix](https://gatrix.io) feature flags, designed specifically for **CocosCreator 2.x and 3.x** environments.

> **Zero runtime dependencies** — just add the source files to your CocosCreator project.

## Features

- 🎮 **CocosCreator Native** — Works on Web, Android, iOS via CocosCreator's JSB runtime
- 🔄 **Real-time Updates** — WebSocket streaming with automatic polling fallback
- 💾 **Persistent Cache** — Flags cached via `cc.sys.localStorage` for instant startup
- 📊 **Usage Metrics** — Automatic flag access tracking and reporting
- 🔍 **Explicit Sync Mode** — Control exactly when flag changes propagate to your game logic
- 🛡️ **Type-safe** — Full TypeScript support with strict typing

## Installation

### Option 1: Copy Source Files (Recommended)

1. Copy the `src/` directory into your CocosCreator project's `assets/scripts/gatrix/` folder
2. That's it — CocosCreator will compile the TypeScript files automatically

```
your-cocos-project/
└── assets/
    └── scripts/
        └── gatrix/
            ├── index.ts
            ├── gatrix-client.ts
            ├── features-client.ts
            └── ... (all files from src/)
```

### Option 2: As a Package (Advanced)

```bash
# If your project uses npm/pnpm
npm install @gatrix/gatrix-cocoscreator-client-sdk
```

## Quick Start

```typescript
import { GatrixClient } from './gatrix/index';

// 1. Create client
const client = new GatrixClient({
  apiUrl: 'https://your-gatrix-server.com/api/v1',
  apiToken: 'your-client-api-token',
  appName: 'my-cocos-game',
});

// 2. Start the SDK
await client.start();

// 3. Check feature flags
if (client.features.isEnabled('new-boss-fight')) {
  // Show new boss fight
}

// 4. Get typed variations
const difficulty = client.features.numberVariation('difficulty-level', 1);
const theme = client.features.stringVariation('ui-theme', 'default');
const config = client.features.jsonVariation('game-config', { speed: 1.0 });

// 5. Stop when done (e.g., on game exit)
client.stop();
```

## Context (User Targeting)

Set context properties for targeted flag evaluation:

```typescript
const client = new GatrixClient({
  apiUrl: 'https://your-gatrix-server.com/api/v1',
  apiToken: 'your-token',
  appName: 'my-game',
  features: {
    context: {
      userId: 'player-123',
      properties: {
        platform: 'ios',
        level: '42',
        isPremium: 'true',
      },
    },
  },
});
```

Update context at runtime:

```typescript
// Update user ID after login
await client.features.updateContext({
  userId: 'player-456',
  properties: { level: '50' },
});
```

## Watching Flag Changes

React to real-time flag changes:

```typescript
// Watch a single flag
const unwatch = client.features.watchRealtimeFlag('sale-banner', (flag) => {
  if (flag.enabled) {
    showSaleBanner(flag.stringVariation(''));
  } else {
    hideSaleBanner();
  }
});

// Watch with initial state (fires callback immediately with current value)
client.features.watchRealtimeFlagWithInitialState('ui-theme', (flag) => {
  applyTheme(flag.stringVariation('default'));
});

// Unwatch when done
unwatch();
```

### Watch Groups

Manage multiple watchers as a group:

```typescript
const group = client.features.createWatchFlagGroup('battle-scene');

group
  .watchRealtimeFlag('boss-health-multiplier', (flag) => {
    setBossHealth(flag.numberVariation(1.0));
  })
  .watchRealtimeFlag('enable-power-ups', (flag) => {
    togglePowerUps(flag.enabled);
  });

// Unwatch all at once (e.g., when leaving the scene)
group.destroy();
```

## Explicit Sync Mode

By default, the SDK uses **explicit sync mode** — flag changes from the server are received in real-time but only applied to your game logic when you call `syncFlags()`. This prevents mid-frame flag changes from causing inconsistencies.

```typescript
// Check if there are pending changes
if (client.features.hasPendingSyncFlags()) {
  // Apply changes at a safe point (e.g., between scenes)
  await client.features.syncFlags();
}
```

To disable explicit sync mode (flags update immediately):

```typescript
client.features.setExplicitSyncMode(false);
```

## Variation Methods

| Method | Return Type | Description |
|---|---|---|
| `isEnabled(name)` | `boolean` | Whether flag is enabled |
| `boolVariation(name, fallback)` | `boolean` | Boolean value or fallback |
| `stringVariation(name, fallback)` | `string` | String value or fallback |
| `numberVariation(name, fallback)` | `number` | Number value or fallback |
| `jsonVariation(name, fallback)` | `T` | JSON object or fallback |
| `boolVariationOrThrow(name)` | `boolean` | Throws if not found/type mismatch |

### Variation Details

Get the value along with evaluation metadata:

```typescript
const result = client.features.boolVariationDetails('flag-name', false);
// result.value     — the resolved value
// result.reason    — why this value was returned
// result.flagExists — whether the flag exists
// result.enabled   — whether the flag is enabled
```

## Events

```typescript
import { GatrixClient } from './gatrix/index';

const client = new GatrixClient({ /* config */ });

// SDK ready (flags loaded)
client.on(GatrixClient.EVENTS.FLAGS_READY, () => {
  console.log('Flags are ready!');
});

// Flags changed
client.on(GatrixClient.EVENTS.FLAGS_CHANGE, ({ flags }) => {
  console.log(`${flags.length} flags updated`);
});

// Streaming connected
client.on(GatrixClient.EVENTS.FLAGS_STREAMING_CONNECTED, () => {
  console.log('WebSocket streaming connected');
});

// Error
client.on(GatrixClient.EVENTS.SDK_ERROR, (error) => {
  console.error('SDK error:', error);
});
```

## Configuration

```typescript
const client = new GatrixClient({
  // Required
  apiUrl: 'https://your-server.com/api/v1',
  apiToken: 'your-client-token',
  appName: 'my-game',

  // Optional
  enableDevMode: false,           // Detailed debug logging
  customHeaders: {},              // Extra HTTP headers

  features: {
    // Polling
    refreshInterval: 30,          // Seconds between polls (default: 30)
    disableRefresh: false,        // Disable polling

    // Streaming (WebSocket)
    streaming: {
      enabled: true,              // Enable WebSocket streaming (default: true)
      websocket: {
        reconnectBase: 1,         // Initial reconnect delay in seconds
        reconnectMax: 30,         // Max reconnect delay in seconds
        pingInterval: 30,         // Ping interval in seconds
      },
    },

    // Storage
    cacheKeyPrefix: 'gatrix_cache', // Storage key prefix

    // Sync
    explicitSyncMode: true,       // Require manual syncFlags() (default: true)

    // Metrics
    disableMetrics: false,        // Disable usage tracking
    metricsInterval: 60,          // Metrics send interval in seconds

    // Offline
    offlineMode: false,           // No network requests (use cache/bootstrap)
    bootstrap: [],                // Initial flag data for instant availability
  },
});
```

## Custom Storage Provider

Implement the `StorageProvider` interface for custom storage:

```typescript
import { StorageProvider } from './gatrix/storage-provider';

class MyStorageProvider implements StorageProvider {
  async get(key: string): Promise<any> { /* ... */ }
  async save(key: string, value: any): Promise<void> { /* ... */ }
  async delete(key: string): Promise<void> { /* ... */ }
}

const client = new GatrixClient({
  /* ... */
  features: {
    storageProvider: new MyStorageProvider(),
  },
});
```

## CocosCreator Version Compatibility

| CocosCreator Version | Support |
|---|---|
| 3.x (latest) | ✅ Full support |
| 2.x | ✅ Full support |

The SDK automatically detects the CocosCreator version and uses the appropriate APIs.

## API Comparison with JS SDK

This SDK provides the **same public API** as `@gatrix/gatrix-js-client-sdk`. The only differences are internal:

| Feature | JS SDK | CocosCreator SDK |
|---|---|---|
| HTTP Client | `ky` (Fetch API) | `XMLHttpRequest` |
| Streaming | SSE + WebSocket | WebSocket only |
| Storage | `localStorage` | `cc.sys.localStorage` |
| URL Parsing | `new URL()` | Custom `UrlBuilder` |
| Hashing | `crypto.subtle` (async) | `djb2` (sync) |
| Dependencies | 2 (`ky`, `fetch-event-source`) | 0 |

## License

MIT
