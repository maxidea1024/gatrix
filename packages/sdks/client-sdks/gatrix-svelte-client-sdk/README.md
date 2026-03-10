# Gatrix Svelte SDK

Svelte SDK for the Gatrix platform — reactive feature flag stores with automatic cleanup.

Built on top of `@gatrix/gatrix-js-client-sdk`, providing idiomatic Svelte stores for flag access, variations, and status tracking.

## Installation

```bash
yarn add @gatrix/gatrix-svelte-client-sdk @gatrix/gatrix-js-client-sdk
```

## Quick Start

### 1. Initialize in your root layout

```svelte
<!-- +layout.svelte -->
<script>
  import { initGatrix } from '@gatrix/gatrix-svelte-client-sdk';

  initGatrix({
    config: {
      apiUrl: 'http://localhost:3400/api/v1',
      apiToken: 'your-client-api-token',
      appName: 'MyApp',
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
  import { flag, numberVariation } from '@gatrix/gatrix-svelte-client-sdk';

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

#### `flag(flagName, forceRealtime?): Readable<boolean>`

Reactive boolean store for a flag's enabled state.

```svelte
<script>
  import { flag } from '@gatrix/gatrix-svelte-client-sdk';
  const isEnabled = flag('my-feature');
</script>
{#if $isEnabled}
  <NewFeature />
{/if}
```

#### `flagState(flagName, forceRealtime?): Readable<FlagState>`

Full flag state store with enabled, variant name, and variant value.

```svelte
<script>
  import { flagState } from '@gatrix/gatrix-svelte-client-sdk';
  const myFlag = flagState('my-feature');
</script>
{#if $myFlag.enabled}
  <p>Variant: {$myFlag.variantName}</p>
  <p>Value: {$myFlag.variantValue}</p>
{/if}
```

#### `allFlags(forceRealtime?): Readable<EvaluatedFlag[]>`

Store for all evaluated flags.

```svelte
<script>
  import { allFlags } from '@gatrix/gatrix-svelte-client-sdk';
  const flags = allFlags();
</script>
{#each $flags as f}
  <p>{f.name}: {f.enabled ? 'ON' : 'OFF'}</p>
{/each}
```

### Variation Stores

All variation stores accept an optional `forceRealtime` parameter (default: `true`). When `true`, reads from realtime flags regardless of explicit sync mode.

| Store | Description |
|-------|-------------|
| `boolVariation(flagName, fallbackValue, forceRealtime?)` | `Readable<boolean>` |
| `stringVariation(flagName, fallbackValue, forceRealtime?)` | `Readable<string>` |
| `numberVariation(flagName, fallbackValue, forceRealtime?)` | `Readable<number>` |
| `jsonVariation<T>(flagName, fallbackValue, forceRealtime?)` | `Readable<T>` (JSON object) |
| `variant(flagName, forceRealtime?)` | `Readable<Variant>` |

All variation stores return `Readable<T>` — use with `$` prefix in templates.

```svelte
<script>
  import { boolVariation, stringVariation, numberVariation, jsonVariation, variant } from '@gatrix/gatrix-svelte-client-sdk';

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
  import { flagsStatus } from '@gatrix/gatrix-svelte-client-sdk';
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
  import { updateContext, syncFlags, fetchFlags } from '@gatrix/gatrix-svelte-client-sdk';

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

### Tracking

```svelte
<script>
  import { getTrack } from '@gatrix/gatrix-svelte-client-sdk';
  const track = getTrack();

  track('button_click', { button: 'purchase' });
</script>
```

### Direct Client Access

```svelte
<script>
  import { getGatrixClient } from '@gatrix/gatrix-svelte-client-sdk';
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
- `@gatrix/gatrix-js-client-sdk`

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
