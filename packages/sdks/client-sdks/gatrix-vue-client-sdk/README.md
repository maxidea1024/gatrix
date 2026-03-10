# @gatrix/gatrix-vue-client-sdk

Vue 3 SDK for the Gatrix platform.

## Installation

```bash
yarn add @gatrix/gatrix-vue-client-sdk @gatrix/gatrix-js-client-sdk
# or
npm install @gatrix/gatrix-vue-client-sdk @gatrix/gatrix-js-client-sdk
```

## Quick Start

### 1. Register GatrixPlugin in your app

```typescript
import { createApp } from 'vue';
import { GatrixPlugin } from '@gatrix/gatrix-vue-client-sdk';
import App from './App.vue';

const app = createApp(App);

app.use(GatrixPlugin, {
  config: {
    apiUrl: 'https://your-gatrix-server.com/api/v1',
    apiToken: 'your-client-api-token',
    appName: 'my-app',
  },
});

app.mount('#app');
```

### 2. Use composables to access feature flags

```vue
<script setup>
import { useFlag, useBoolVariation, useFlags, useFlagsStatus } from '@gatrix/gatrix-vue-client-sdk';

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

All flag access composables accept an optional `forceRealtime` parameter (default: `true`). When `true`, reads from realtime flags regardless of explicit sync mode.

| Composable             | Description                                 |
| ---------------------- | ------------------------------------------- |
| `useFlag(flagName, forceRealtime?)`    | Returns `ComputedRef<boolean>` — flag enabled state |
| `useFlagProxy(flagName, forceRealtime?)` | Returns `Ref<FlagProxy | null>` — full FlagProxy |
| `useVariant(flagName, forceRealtime?)`   | Returns `ComputedRef<Variant | undefined>`  |
| `useFlags(forceRealtime?)`               | Returns `Ref<EvaluatedFlag[]>` — all flags  |
| `useTrack()`                              | Returns track function `(eventName, properties?) => void` |

### Variation Composables

All variation composables accept an optional `forceRealtime` parameter (default: `true`) as the third argument.

| Composable                                     | Description               |
| ---------------------------------------------- | ------------------------- |
| `useBoolVariation(flagName, fallbackValue, forceRealtime?)`     | Returns `ComputedRef<boolean>`         |
| `useStringVariation(flagName, fallbackValue, forceRealtime?)`   | Returns `ComputedRef<string>`          |
| `useNumberVariation(flagName, fallbackValue, forceRealtime?)`   | Returns `ComputedRef<number>`          |
| `useJsonVariation<T>(flagName, fallbackValue, forceRealtime?)`  | Returns `ComputedRef<T>` (JSON object) |

## Examples

### Conditional Rendering

```vue
<script setup>
import { useFlag } from '@gatrix/gatrix-vue-client-sdk';
const showNewFeature = useFlag('new-feature');
</script>

<template>
  <NewFeature v-if="showNewFeature" />
</template>
```

### Dynamic Configuration

```vue
<script setup>
import { useJsonVariation } from '@gatrix/gatrix-vue-client-sdk';

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
import { useUpdateContext } from '@gatrix/gatrix-vue-client-sdk';
const updateContext = useUpdateContext();

const handleLogin = async (userId) => {
  await updateContext({ userId });
};
</script>
```

## ⚠️ Essential Practices

### Test All Flag States

Every feature flag creates **at least two code paths** (on and off). Both must be tested. Untested paths are ticking time bombs that will eventually reach production.

| What to test | Why |
|---|---|
| Flag **ON** | Verify the new behavior works correctly |
| Flag **OFF** | Verify the original behavior still works — this is often forgotten |
| Flag **toggled mid-session** | If using real-time mode, verify no crashes or inconsistent state |
| **Default value** path | Verify behavior when the flag doesn't exist on the server (network error, new environment, etc.) |

### Handle Dependencies Carefully

Toggling a flag can change which objects, modules, or resources are used. If those dependencies aren't ready, you get crashes or undefined behavior.

**Common pitfall:** Flag A enables a feature that depends on an object initialized by Flag B. If A is on but B is off, the object doesn't exist → crash.

**How to prevent:**

- Initialize all resources that _might_ be needed regardless of flag state, or
- Use lazy initialization with null checks, or
- Use `ExplicitSyncMode` to apply flag changes only at safe points where all dependencies can be resolved together

### Document Every Flag

When creating a flag, clearly communicate the following to your team:

| Item | Description |
|---|---|
| **Purpose** | What does this flag control? Why does it exist? |
| **Affected areas** | Which screens, systems, or APIs are impacted? |
| **Side effects** | What changes when flipped? Any performance, data, or UX implications? |
| **Dependencies** | Does this flag depend on other flags or system state? |
| **Owner** | Who is responsible for this flag? |
| **Expiration** | When should this flag be removed? |

Undocumented flags become a source of confusion, and eventually, incidents.

## 📚 References

**Concepts:**

- [Feature Toggles (aka Feature Flags)](https://martinfowler.com/articles/feature-toggles.html) — Martin Fowler
- [What are Feature Flags?](https://www.atlassian.com/continuous-delivery/principles/feature-flags) — Atlassian

**Use Cases & Case Studies:**

- [How We Ship Code Faster and Safer with Feature Flags](https://github.blog/engineering/infrastructure/ship-code-faster-safer-feature-flags/) — GitHub Engineering
- [Deploys at Slack](https://slack.engineering/deploys-at-slack/) — Slack Engineering
- [Preparing the Netflix API for Deployment](https://netflixtechblog.com/preparing-the-netflix-api-for-deployment-786d8f58090d) — Netflix Tech Blog
- [Progressive Experimentation with Feature Flags](https://learn.microsoft.com/en-us/devops/operate/progressive-experimentation-feature-flags) — Microsoft

**Trunk-Based Development:**

- [Feature Flags in Trunk-Based Development](https://trunkbaseddevelopment.com/feature-flags/) — trunkbaseddevelopment.com
- [Trunk-Based Development Best Practices](https://www.atlassian.com/continuous-delivery/continuous-integration/trunk-based-development) — Atlassian

## License

This project is licensed under the MIT License - see the [LICENSE](../../../../LICENSE) file for details.
