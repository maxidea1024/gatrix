---
sidebar_position: 2
sidebar_label: Server SDK API
---

# Server SDK API

SDK for game servers to integrate with Gatrix.

## Installation

```bash
npm install @gatrix/server-sdk
# or
yarn add @gatrix/server-sdk
```

## Initialization

```typescript
import { GatrixServerSDK } from '@gatrix/server-sdk';

const gatrix = new GatrixServerSDK({
  apiKey: 'your-server-api-key',
  environment: 'production',
  // Optional
  baseUrl: 'https://your-backend:45000',
  cacheEnabled: true,
  cacheTTL: 60000, // 1 minute
});
```

## Feature Flags

### Get Boolean Value

```typescript
const isEnabled = await gatrix.featureFlags.getBoolValue('dark_mode', {
  userId: 'user123',
  country: 'KR',
});
```

### Get String Value

```typescript
const message = await gatrix.featureFlags.getStringValue('welcome_message', context);
```

### Get Number Value

```typescript
const maxItems = await gatrix.featureFlags.getNumberValue('max_items', context);
```

### Get JSON Value

```typescript
const config = await gatrix.featureFlags.getJsonValue('feature_config', context);
```

### Get All Flags

```typescript
const allFlags = await gatrix.featureFlags.getAllFlags(context);
```

## REST API Reference

### GET `/api/v1/server/:env/features`

Fetches all feature flags for a given environment.

#### Query Parameters

| Parameter   | Type    | Default | Description                                                                                                                                                                                |
| ----------- | ------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `flagNames` | string  | —       | Comma-separated list of flag names to filter                                                                                                                                               |
| `compact`   | boolean | `false` | When `true`, disabled flags omit `strategies`, `variants`, and `enabledValue` to reduce payload. Only `disabledValue` is returned for disabled flags. This saves bandwidth and DB queries. |

#### Compact Mode Behavior

When `compact=true`:
- **Enabled flags** (`isEnabled: true`): Full data returned (no change)
- **Disabled flags** (`isEnabled: false`): Only essential fields returned:
  - `id`, `name`, `isEnabled`, `valueType`, `disabledValue`, `valueSource`, `version`
  - `strategies`, `variants`, `enabledValue` fields are **omitted entirely** (not empty arrays)
  - `compact: true` — **explicit marker** indicating this flag was returned in compact mode

The `compact` field on each flag allows SDKs to distinguish between:
- A flag that genuinely has no strategies (`compact` absent or `false`)
- A flag whose strategies were stripped due to compact mode (`compact: true`)

#### Re-enable Flow

When a disabled flag is re-enabled via the dashboard:
1. Backend emits `feature_flag.changed` event with `changeType: "enabled_changed"`
2. SDK detects the event and calls the **single-flag endpoint** (`GET /api/v1/server/:env/features/:flagName`) — which **does not apply compact mode**
3. The SDK receives full flag data (strategies, variants, enabledValue) and updates its cache
4. The `compact` field is cleared (not present in the full response)

This ensures that re-enabled flags always have their complete evaluation data.

#### SDK Configuration

**Node.js (server-sdk)**

```typescript
const sdk = new GatrixServerSDK({
  // ...
  featureFlags: {
    compact: true, // Default: true — strip disabled flag data to reduce bandwidth
  },
});
```

**C# (.NET SDK)**

```csharp
services.AddGatrixServerSdk(options =>
{
    // ...
    options.FeatureFlags.Compact = true; // Default: true
});
```

The `featureFlags.compact` config controls whether the SDK appends `?compact=true` when fetching flags via `GET /api/v1/server/:env/features`. It defaults to `true` since compact mode is safe — the SDK handles re-enable refetch automatically.

### GET `/api/v1/server/:env/features/:flagName`

Fetches a single feature flag by name. This endpoint **always returns full data** regardless of any compact setting, ensuring re-enabled flags always receive complete definitions.

## Maintenance

### Check Status

```typescript
const status = await gatrix.maintenance.getCurrentStatus();
if (status.isActive) {
  // Server is under maintenance
}
```

## Whitelist

### Check Account

```typescript
const isWhitelisted = await gatrix.whitelist.isAccountWhitelisted('user123');
```

### Check IP

```typescript
const isIpWhitelisted = await gatrix.whitelist.isIpWhitelisted('192.168.1.1');
```

## Game Worlds

### Register Instance

```typescript
await gatrix.gameWorlds.register({
  worldId: 'world-1',
  name: 'World 1',
  region: 'KR',
  capacity: 1000,
  currentPlayers: 500,
  status: 'online',
});
```

### Update Status

```typescript
await gatrix.gameWorlds.updateStatus('world-1', {
  currentPlayers: 600,
  status: 'online',
});
```

## Events

### Send Event

```typescript
await gatrix.events.send({
  name: 'player_login',
  userId: 'user123',
  properties: {
    platform: 'android',
    version: '1.2.0',
  },
});
```

## Error Handling

```typescript
try {
  const value = await gatrix.featureFlags.getBoolValue('my_flag', context);
} catch (error) {
  if (error instanceof GatrixError) {
    console.error('Gatrix error:', error.code, error.message);
  }
}
```
