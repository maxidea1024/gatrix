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
  country: 'KR'
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
  status: 'online'
});
```

### Update Status

```typescript
await gatrix.gameWorlds.updateStatus('world-1', {
  currentPlayers: 600,
  status: 'online'
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
    version: '1.2.0'
  }
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
