# Gatrix Svelte SDK

Svelte SDK for the Gatrix platform — reactive feature flag stores with automatic cleanup.

Built on top of `@gatrix/js-client-sdk`, providing idiomatic Svelte stores for flag access, variations, and status tracking.

## Installation

```bash
yarn add @gatrix/svelte-sdk @gatrix/js-client-sdk
```

## Quick Start

### 1. Initialize in your root layout

```svelte
<!-- +layout.svelte -->
<script>
  import { initGatrix } from '@gatrix/svelte-sdk';

  initGatrix({
    config: {
      apiUrl: 'http://localhost:3400/api/v1',
      apiToken: 'your-client-api-token',
      appName: 'MyApp',
      environment: 'development',
      context: {
        userId: 'user-123',
        properties: { platform: 'web' },
      },
    },
  });
</script>

<slot />
```

### 2. Use flags in any child component

```svelte
<script>
  import { flag, numberVariation } from '@gatrix/svelte-sdk';

  const darkMode = flag('dark-mode');
  const speed = numberVariation('game-speed', 1.0);
</script>

{#if $darkMode}
  <DarkTheme />
{/if}

<p>Speed: {$speed}x</p>
```

## API Reference

### Provider

#### `initGatrix(options)`

Must be called in a root/layout component during initialization.

```typescript
interface GatrixInitOptions {
  config?: GatrixClientConfig;
  client?: GatrixClient;     // Use existing client instance
  startClient?: boolean;     // Auto-start, default: true
}
```

### Flag Stores

#### `flag(flagName): Readable<boolean>`

Reactive boolean store for a flag's enabled state.

```svelte
<script>
  import { flag } from '@gatrix/svelte-sdk';
  const isEnabled = flag('my-feature');
</script>
{#if $isEnabled}
  <NewFeature />
{/if}
```

#### `flagProxy(flagName): Readable<FlagProxy>`

Full FlagProxy store with access to all variation methods.

```svelte
<script>
  import { flagProxy } from '@gatrix/svelte-sdk';
  const myFlag = flagProxy('my-feature');
</script>
{#if $myFlag.enabled}
  <p>Variant: {$myFlag.variant.name}</p>
  <p>Payload: {$myFlag.stringVariation('default')}</p>
{/if}
```

#### `allFlags(): Readable<EvaluatedFlag[]>`

Store for all evaluated flags.

```svelte
<script>
  import { allFlags } from '@gatrix/svelte-sdk';
  const flags = allFlags();
</script>
{#each $flags as f}
  <p>{f.name}: {f.enabled ? 'ON' : 'OFF'}</p>
{/each}
```

### Variation Stores

All variation stores return `Readable<T>` — use with `$` prefix in templates.

```svelte
<script>
  import { boolVariation, stringVariation, numberVariation, jsonVariation, variant } from '@gatrix/svelte-sdk';

  const darkMode = boolVariation('dark-mode', false);
  const welcome = stringVariation('welcome-text', 'Hello!');
  const speed = numberVariation('game-speed', 1.0);
  const uiConfig = jsonVariation('ui-config', { theme: 'default' });
  const myVariant = variant('my-flag');
</script>

<p>Dark mode: {$darkMode}</p>
<p>Welcome: {$welcome}</p>
<p>Speed: {$speed}x</p>
<p>Theme: {$uiConfig.theme}</p>
<p>Variant: {$myVariant.name}</p>
```

### Status

#### `flagsStatus(): FlagsStatus`

Returns reactive stores for SDK status.

```svelte
<script>
  import { flagsStatus } from '@gatrix/svelte-sdk';
  const { ready, healthy, error } = flagsStatus();
</script>

{#if !$ready}
  <LoadingSpinner />
{:else if $error}
  <ErrorBanner message={$error.message} />
{:else}
  <App />
{/if}
```

### Actions

```svelte
<script>
  import { updateContext, syncFlags, fetchFlags } from '@gatrix/svelte-sdk';

  const setContext = updateContext();
  const sync = syncFlags();
  const fetch = fetchFlags();
</script>

<button on:click={() => setContext({ userId: 'new-user' })}>
  Switch User
</button>
<button on:click={() => sync()}>Sync Flags</button>
<button on:click={() => fetch()}>Refresh</button>
```

### Direct Client Access

```svelte
<script>
  import { getGatrixClient } from '@gatrix/svelte-sdk';
  const client = getGatrixClient();

  // Direct access to all core SDK features
  client.on(EVENTS.FLAGS_CHANGE, (data) => {
    console.log('Flags changed:', data);
  });
</script>
```

## Key Features

| Feature | Description |
|---------|-------------|
| **Reactive stores** | All values are Svelte `Readable` stores — auto-update on flag changes |
| **Auto-cleanup** | Store subscriptions auto-unsubscribe when components are destroyed |
| **Typed variations** | `boolVariation`, `stringVariation`, `numberVariation`, `jsonVariation` |
| **FlagProxy** | Full access to flag details, variant, and all variation methods |
| **Status tracking** | `ready`, `healthy`, `error` stores for SDK state |
| **Context management** | `updateContext()` triggers automatic re-fetch |
| **Explicit sync** | `syncFlags()` for safe mid-gameplay flag application |
| **Per-flag watch** | Each store watches its specific flag for granular updates |

## Requirements

- Svelte 4.x or 5.x
- `@gatrix/js-client-sdk`

## License

MIT
