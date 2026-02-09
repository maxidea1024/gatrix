# @gatrix/vue-sdk

Vue 3 SDK for Gatrix feature flags.

## Installation

```bash
yarn add @gatrix/vue-sdk @gatrix/js-client-sdk
# or
npm install @gatrix/vue-sdk @gatrix/js-client-sdk
```

## Quick Start

### 1. Register GatrixPlugin in your app

```typescript
import { createApp } from 'vue';
import { GatrixPlugin } from '@gatrix/vue-sdk';
import App from './App.vue';

const app = createApp(App);

app.use(GatrixPlugin, {
  config: {
    apiUrl: 'https://your-gatrix-server.com/api/v1',
    apiToken: 'your-client-api-token',
    appName: 'my-app',
    environment: 'production',
  },
});

app.mount('#app');
```

### 2. Use composables to access feature flags

```vue
<script setup>
import { useFlag, useBoolVariation, useFlags, useFlagsStatus } from '@gatrix/vue-sdk';

// Check if ready
const { ready, error } = useFlagsStatus();

// Simple boolean check
const isNewUIEnabled = useFlag('new-ui');

// Boolean variation with default
const darkMode = useBoolVariation('dark-mode', false);

// Get all flags
const allFlags = useFlags();
</script>

<template>
  <div v-if="!ready">Loading...</div>
  <div v-else-if="error">Error: {{ error.message }}</div>
  <div v-else :class="{ dark: darkMode }">
    <NewUI v-if="isNewUIEnabled" />
    <OldUI v-else />
  </div>
</template>
```

## API Reference

### Plugin

#### `GatrixPlugin`

Vue plugin that provides Gatrix context to your application.

```typescript
app.use(GatrixPlugin, {
  config: GatrixClientConfig, // Required: SDK configuration
  client: GatrixClient, // Optional: Pre-created client instance
  startClient: true, // Optional: Auto-start client (default: true)
});
```

### Core Composables

| Composable           | Description                                    |
| -------------------- | ---------------------------------------------- |
| `useGatrixClient()`  | Returns the `GatrixClient` instance            |
| `useFlagsStatus()`   | Returns `{ ready: Ref, error: Ref, healthy: Ref }` |
| `useUpdateContext()` | Returns function to update context             |
| `useSyncFlags()`     | Returns function to sync flags                 |
| `useFetchFlags()`    | Returns function to fetch flags                |

### Flag Access Composables

| Composable             | Description                                 |
| ---------------------- | ------------------------------------------- |
| `useFlag(flagName)`    | Returns `Ref<FlagProxy>`                    |
| `useFlags()`           | Returns `Ref<EvaluatedFlag[]>` - all flags  |

### Variation Composables

| Composable                                     | Description               |
| ---------------------------------------------- | ------------------------- |
| `useBoolVariation(flagName, defaultValue)`     | Returns `ComputedRef<boolean>`         |
| `useStringVariation(flagName, defaultValue)`   | Returns `ComputedRef<string>`          |
| `useNumberVariation(flagName, defaultValue)`   | Returns `ComputedRef<number>`          |
| `useJsonVariation<T>(flagName, defaultValue)`  | Returns `ComputedRef<T>` (JSON object) |

## Examples

### Conditional Rendering

```vue
<script setup>
import { useFlag } from '@gatrix/vue-sdk';
const showNewFeature = useFlag('new-feature');
</script>

<template>
  <NewFeature v-if="showNewFeature.enabled" />
</template>
```

### Dynamic Configuration

```vue
<script setup>
import { useJsonVariation } from '@gatrix/vue-sdk';

const config = useJsonVariation('app-config', {
  maxItems: 10,
  theme: 'light',
});
</script>

<template>
  <div :class="`theme-${config.theme}`">
    <List :maxItems="config.maxItems" />
  </div>
</template>
```

### Updating Context

```vue
<script setup>
import { useUpdateContext } from '@gatrix/vue-sdk';
const updateContext = useUpdateContext();

const handleLogin = async (userId) => {
  await updateContext({ userId });
};
</script>
```

## License

MIT
