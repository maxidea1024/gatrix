# gatrix-js-client-sdk

Client-side JavaScript SDK for Gatrix feature flags.

## Installation

```bash
npm install @gatrix/js-client-sdk
# or
yarn add @gatrix/js-client-sdk
```

## Usage

```typescript
import { GatrixClient } from '@gatrix/js-client-sdk';

const client = new GatrixClient({
  url: 'https://your-edge-api.com/api/v1/client/features/development/eval',
  apiKey: 'your-api-key',
  appName: 'my-app',
  context: {
    userId: 'user-123',
  },
  features: {
    refreshInterval: 30,
    explicitSyncMode: false,
  },
});

// Start the client
await client.start();

// Check if a feature is enabled
const isEnabled = client.features.isEnabled('my-feature');

// Get variations
const stringValue = client.features.stringVariation('my-string-flag', 'default');
const numberValue = client.features.numberVariation('my-number-flag', 0);
const jsonValue = client.features.jsonVariation('my-json-flag', { default: true });

// Watch for flag changes
const unwatch = client.features.watchFlag('my-feature', (flag) => {
  console.log('Flag changed:', flag.enabled, flag.stringVariation('default'));
});

// Clean up
unwatch();
client.stop();
```

## Events

```typescript
import { GatrixClient, EVENTS } from '@gatrix/js-client-sdk';

client.on(EVENTS.READY, () => {
  console.log('SDK is ready');
});

client.on(EVENTS.UPDATE, ({ flags }) => {
  console.log('Flags updated:', flags);
});

client.on(EVENTS.ERROR, (error) => {
  console.error('Error:', error);
});

client.on(EVENTS.RECOVERED, () => {
  console.log('SDK recovered from error');
});
```

## Explicit Sync Mode

```typescript
const client = new GatrixClient({
  // ...
  features: {
    explicitSyncMode: true,
  },
});

// Flags won't update until you call syncFlags
await client.features.syncFlags();
```

## API Reference

### GatrixClient

- `start()`: Start the SDK
- `stop()`: Stop polling
- `isReady()`: Check if SDK is ready
- `getError()`: Get last error
- `on(event, callback)`: Subscribe to events
- `off(event, callback)`: Unsubscribe from events
- `features`: Access to FeaturesClient

### FeaturesClient (via `client.features`)

- `isEnabled(flagName)`: Check if flag is enabled
- `boolVariation(flagName, defaultValue)`: Get boolean variation
- `stringVariation(flagName, defaultValue)`: Get string variation
- `numberVariation(flagName, defaultValue)`: Get number variation
- `jsonVariation(flagName, defaultValue)`: Get JSON variation
- `getVariant(flagName)`: Get variant details
- `getAllFlags()`: Get all flags
- `watchFlag(flagName, callback)`: Watch for flag changes
- `watchFlagWithInitialState(flagName, callback)`: Watch with initial callback
- `syncFlags(fetchNow?)`: Sync flags (explicit sync mode)
- `updateContext(context)`: Update evaluation context
- `getContext()`: Get current context
- `getError()`: Get last error
