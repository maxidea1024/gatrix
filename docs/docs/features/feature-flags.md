---
sidebar_position: 1
sidebar_label: Feature Flags
---

# Feature Flags

Deploy features safely using feature flags with real-time toggling, environment targeting, segment-based rollouts, and multi-platform SDK support.

## Overview

Gatrix Feature Flags allow you to control feature availability without code deployment. Flags are defined **globally** and can have **per-environment** settings (enabled/disabled, value overrides). Evaluation is performed **server-side** — client SDKs send context, receive pre-evaluated results, and cache them locally for zero-latency reads.

### Key Capabilities

- **Real-time toggling** — Enable/disable features instantly across all connected clients
- **Environment targeting** — Per-environment on/off and value overrides (development, staging, production)
- **Segment targeting** — Reusable user groups based on context constraints
- **Strategy-based rollout** — Gradual rollout with percentage, segment constraints, and stickiness
- **Multi-platform SDKs** — JavaScript/TypeScript, Unity (C#), Unreal Engine (C++), Cocos2d-x (C++), Flutter (Dart), Godot (GDScript), Python
- **Impression tracking** — Monitor flag access for analytics
- **Explicit Sync Mode** — Buffer flag changes and apply at controlled sync points (critical for games)
- **Code References** — Static analysis to track flag usage across your codebase

## Architecture

### Evaluation Model

```
┌────────────────────┐         ┌──────────────────┐         ┌──────────────┐
│   Client SDK       │─context─▶   Edge API       │─eval──▶ │  Evaluator   │
│   (cache + poll)   │◀─result─│   (or Backend)   │◀───────│  (shared)    │
└────────────────────┘         └──────────────────┘         └──────────────┘
```

1. Client SDK sends **context** (userId, sessionId, properties) to the Edge API
2. Server evaluates all flags against provided context using **strategies**, **constraints**, and **segments**
3. Pre-evaluated results are returned to the client
4. Client caches results locally for zero-latency reads
5. SDK polls periodically (default: 30s) for updates

### Key Design Decisions

- **Flags are global** — A flag is defined once, not per environment
- **Environments control activation** — Each environment has its own `isEnabled`, `enabledValue`, `disabledValue` overrides
- **Strategies are per-environment** — Targeting rules are configured per environment
- **Variants are per-environment** — A/B test distributions can differ across environments
- **Segments are global** — Reusable across all flags and environments
- **`isArchived` is management-only** — Archived flags still evaluate normally; archival is a UI/governance concept

## Creating a Feature Flag

1. Navigate to **Feature Flags** in the admin console
2. Click **Create Flag**
3. Configure the flag:

| Field                 | Type     | Required | Description                                              |
| --------------------- | -------- | -------- | -------------------------------------------------------- |
| Key (`flagName`)      | Text     | ✅       | Unique identifier (e.g., `new-checkout-flow`)            |
| Display Name          | Text     | ✅       | Human-readable display name                              |
| Description           | Textarea | —        | Purpose and context description                          |
| Flag Type (`flagType`)| Select   | ✅       | Purpose category (see below)                             |
| Value Type (`valueType`)| Select | ✅       | `boolean`, `string`, `number`, `json`                    |
| Enabled Value         | Dynamic  | ✅       | Value returned when flag evaluates to enabled            |
| Disabled Value        | Dynamic  | ✅       | Value returned when flag evaluates to disabled           |
| Impression Data       | Toggle   | —        | Enable impression tracking for this flag                 |
| Stale After (days)    | Number   | —        | Flag is considered stale after this many days            |
| Tags                  | Tags     | —        | Categorization tags                                      |

4. Click **Create**

:::tip Flag Key Naming
Use **kebab-case** for flag keys: `dark-mode`, `new-checkout-flow`, `max-retry-count`.
Flag keys are case-sensitive. Use string literals in code for static analysis compatibility.
:::

### Flag Types (Purpose)

Flag types describe the **purpose** of the flag, not its data type:

| Flag Type       | Description                                                         |
| --------------- | ------------------------------------------------------------------- |
| `release`       | Control feature rollout to users                                    |
| `experiment`    | A/B testing and experimentation                                     |
| `operational`   | Operational controls (rate limits, circuit breakers)                 |
| `killSwitch`    | Emergency toggle to disable a feature                               |
| `permission`    | Access control based on user attributes                             |
| `remoteConfig`  | Remote configuration values (game balance, UI settings, etc.)       |

### Value Types

| Value Type | Description                | Default Fallback | Example                                     |
| ---------- | -------------------------- | ---------------- | ------------------------------------------- |
| `boolean`  | True/false toggle          | `false`          | `true`                                       |
| `string`   | Text value                 | `""`             | `"dark-theme"`                               |
| `number`   | Numeric value              | `0`              | `100`                                        |
| `json`     | Complex object             | `{}`             | `{ "limit": 10, "theme": "modern" }`        |

## Per-Environment Settings

Each flag can have different settings per environment:

| Setting          | Description                                          |
| ---------------- | ---------------------------------------------------- |
| `isEnabled`      | Whether the flag is active in this environment       |
| `enabledValue`   | Override the global enabled value (optional)         |
| `disabledValue`  | Override the global disabled value (optional)        |
| `strategies`     | Targeting rules specific to this environment         |
| `variants`       | Variant distribution specific to this environment    |

### Example: 환경별 설정 (Environment-Specific Settings)

```
Flag: "new-checkout-flow" (boolean)
├── Global: enabledValue=true, disabledValue=false
├── development: isEnabled=true  (no strategies → always enabled)
├── staging:     isEnabled=true  (strategy: userId IN ["tester-1", "tester-2"])
└── production:  isEnabled=true  (strategy: rollout 10%, stickiness=userId)
```

## Strategies

Strategies are **per-environment** targeting rules that determine which users receive the enabled value. Strategies are evaluated in `sortOrder`.

### Strategy Evaluation Flow

```
Flag isEnabled?
  ├─ NO  → Return disabledValue (reason: "disabled")
  └─ YES → Active strategies exist?
       ├─ NO  → Return enabledValue (reason: "default")
       └─ YES → For each strategy (by sortOrder):
            1. Check segment constraints (ALL must pass)
            2. Check strategy constraints (ALL must pass)
            3. Check rollout percentage
            └─ If ALL pass → Return enabledValue (reason: "strategy_match")
       └─ No strategy matched → Return disabledValue (reason: "default")
```

### Strategy Parameters

| Parameter    | Type   | Description                                                         |
| ------------ | ------ | ------------------------------------------------------------------- |
| `rollout`    | number | Percentage of users (0–100) who receive the enabled value           |
| `stickiness` | string | Context field for consistent bucketing (`userId`, `sessionId`, `random`, or custom) |
| `groupId`    | string | Group identifier for rollout bucketing (defaults to flag name)      |

### Rollout Bucketing

Rollout uses **MurmurHash v3** for deterministic bucketing:

```
seed = "{groupId}:{stickinessValue}"
hash = murmurhash_v3(seed)
percentage = (hash % 10000) / 100   // 0.00 ~ 99.99
```

This ensures:
- Same user always gets the same result for the same flag
- Distribution is uniform across users
- Rollout percentage can be increased without re-bucketing existing users

## Constraints

Constraints are conditions that must be satisfied for a strategy to match. All constraints within a strategy use **AND** logic (all must pass).

### Constraint Structure

```typescript
interface Constraint {
  contextName: string;       // Context field to check (e.g., "userId", "country")
  operator: ConstraintOperator;
  value?: string;           // For single-value operators
  values?: string[];        // For multi-value operators (IN, etc.)
  caseInsensitive?: boolean; // String comparison case sensitivity
  inverted?: boolean;       // Negate the result
}
```

### Operators by Type

#### String Operators

| Operator          | Description                | Value Type | Example                              |
| ----------------- | -------------------------- | ---------- | ------------------------------------ |
| `str_eq`          | Equals                     | single     | `country str_eq "KR"`               |
| `str_contains`    | Contains substring         | single     | `email str_contains "@company.com"`  |
| `str_starts_with` | Starts with prefix         | single     | `userId str_starts_with "test_"`     |
| `str_ends_with`   | Ends with suffix           | single     | `email str_ends_with ".kr"`          |
| `str_in`          | In list                    | multiple   | `country str_in ["KR", "JP", "US"]` |
| `str_regex`       | Matches regular expression | single     | `email str_regex "^admin@.*"`        |

#### Number Operators

| Operator   | Description            | Value Type | Example                     |
| ---------- | ---------------------- | ---------- | --------------------------- |
| `num_eq`   | Equals                 | single     | `level num_eq 10`           |
| `num_gt`   | Greater than           | single     | `level num_gt 50`           |
| `num_gte`  | Greater than or equal  | single     | `level num_gte 50`          |
| `num_lt`   | Less than              | single     | `age num_lt 18`             |
| `num_lte`  | Less than or equal     | single     | `age num_lte 18`            |
| `num_in`   | In list                | multiple   | `level num_in [1, 5, 10]`   |

#### Boolean Operators

| Operator  | Description    | Value Type | Example                  |
| --------- | -------------- | ---------- | ------------------------ |
| `bool_is` | Is true/false  | single     | `isPremium bool_is true` |

#### Date Operators

| Operator   | Description           | Value Type | Example                              |
| ---------- | --------------------- | ---------- | ------------------------------------ |
| `date_eq`  | Equals                | single     | `registerDate date_eq "2025-01-01"`  |
| `date_gt`  | After                 | single     | `registerDate date_gt "2025-01-01"`  |
| `date_gte` | On or after           | single     | `registerDate date_gte "2025-01-01"` |
| `date_lt`  | Before                | single     | `registerDate date_lt "2025-06-01"`  |
| `date_lte` | On or before          | single     | `registerDate date_lte "2025-06-01"` |

#### Semver Operators

| Operator     | Description           | Value Type | Example                              |
| ------------ | --------------------- | ---------- | ------------------------------------ |
| `semver_eq`  | Equals                | single     | `appVersion semver_eq "2.0.0"`       |
| `semver_gt`  | Greater than          | single     | `appVersion semver_gt "1.5.0"`       |
| `semver_gte` | Greater than or equal | single     | `appVersion semver_gte "1.5.0"`      |
| `semver_lt`  | Less than             | single     | `appVersion semver_lt "3.0.0"`       |
| `semver_lte` | Less than or equal    | single     | `appVersion semver_lte "3.0.0"`      |
| `semver_in`  | In list               | multiple   | `appVersion semver_in ["2.0.0", "2.1.0"]` |

#### Common Operators (Type-Agnostic)

| Operator     | Description          | Value Type | Example                     |
| ------------ | -------------------- | ---------- | --------------------------- |
| `exists`     | Field has a value    | none       | `userId exists`             |
| `not_exists` | Field has no value   | none       | `userId not_exists`         |

#### Array Operators

| Operator    | Description                             | Value Type | Example                           |
| ----------- | --------------------------------------- | ---------- | --------------------------------- |
| `arr_any`   | Array contains any of the target values | multiple   | `tags arr_any ["vip", "beta"]`    |
| `arr_all`   | Array contains all of the target values | multiple   | `tags arr_all ["vip", "premium"]` |
| `arr_empty` | Array is empty or doesn't exist         | none       | `tags arr_empty`                  |

### The `inverted` Flag

Every constraint supports an `inverted` boolean. When `true`, the constraint result is negated:

```
str_eq + inverted:true  → NOT equals (≠)
str_in + inverted:true  → NOT in list
exists + inverted:true  → NOT exists
```

## Segments

Segments are **global**, reusable sets of constraints. They can be referenced by any strategy in any environment.

### Segment Structure

```typescript
interface FeatureSegment {
  name: string;
  constraints: Constraint[];  // All must pass (AND logic)
  isActive: boolean;          // UI display only, NOT used in evaluation
}
```

:::warning `isActive` Is UI-Only
Segment's `isActive` field controls **visibility in the admin UI only**. It does **not** affect evaluation. Even inactive segments are evaluated normally when referenced by a strategy.
:::

### Creating a Segment

1. Navigate to **Feature Flags** > **Segments**
2. Click **Create Segment**
3. Define constraints (e.g., `country str_in ["KR", "JP"]` AND `isPremium bool_is true`)
4. Save

### Using Segments in Strategies

Strategies can reference segments. When evaluating, segment constraints are checked **before** strategy constraints:

```
Strategy evaluation order:
1. Segment constraints (ALL referenced segments must pass)
2. Strategy constraints (ALL must pass)
3. Rollout percentage check
```

### Example: Beta Testers Segment

```json
{
  "segmentName": "beta-testers",
  "constraints": [
    { "contextName": "userId", "operator": "str_in", "values": ["user-001", "user-002", "user-003"] }
  ]
}
```

## Context

Context represents the current user/session and drives all targeting rules.

### Evaluation Context Structure

```typescript
interface EvaluationContext {
  userId?: string;
  sessionId?: string;
  appName?: string;
  appVersion?: string;
  remoteAddress?: string;
  environment?: string;
  currentTime?: Date;
  properties?: Record<string, string | number | boolean | string[]>;
}
```

### Built-in Context Fields

| Field           | Type   | Description                                                    |
| --------------- | ------ | -------------------------------------------------------------- |
| `userId`        | string | Unique user identifier — primary stickiness key               |
| `sessionId`     | string | Session identifier — auto-generated if not provided           |
| `appName`       | string | Application name from SDK config                              |
| `appVersion`    | string | Application version (supports semver comparison)              |
| `remoteAddress` | string | Client IP address (provided by server during evaluation)       |

### Custom Context Fields (Properties)

Custom properties support four types:

| Type      | Description                    | Example Operators                                     |
| --------- | ------------------------------ | ----------------------------------------------------- |
| `string`  | Text values                    | `str_eq`, `str_contains`, `str_in`, `str_regex`       |
| `number`  | Numeric values                 | `num_eq`, `num_gt`, `num_lt`, `num_in`                |
| `boolean` | True/false values              | `bool_is`                                             |
| `array`   | List of string values          | `arr_any`, `arr_all`, `arr_empty`                     |

### Predefined Custom Fields

Gatrix provides commonly used context fields out of the box:

| Key               | Type    | Description                        |
| ----------------- | ------- | ---------------------------------- |
| `userLevel`       | number  | User's current level in the game   |
| `country`         | string  | Country code (ISO 3166-1 alpha-2)  |
| `platform`        | string  | Device platform (ios, android, web, windows, mac, linux) |
| `language`        | string  | Preferred language (ko, en, ja, zh, ...) |
| `isPremium`       | boolean | Premium subscription status        |
| `registrationDate`| number  | Days since registration            |
| `lastLoginDate`   | number  | Days since last login              |
| `totalPurchases`  | number  | Total purchase amount (USD)        |
| `gameMode`        | string  | Current game mode                  |
| `tags`            | array   | Custom tags assigned to user       |

## Variants

Variants enable **A/B testing** with weighted distribution. Variants are defined **per-environment**.

### Variant Structure

```typescript
interface FeatureVariant {
  variantName: string;     // Unique identifier within the flag
  weight: number;          // Weight for distribution (0–100)
  value?: any;             // Variant-specific value
  valueType: ValueType;    // Same as flag's valueType
  weightLock?: boolean;    // Lock this variant's weight during redistribution
}
```

### Variant Selection

When a flag has variants, one is selected based on the user's context:

```
percentage = murmurhash_v3("{flagName}-variant:{stickinessValue}") % 10000 / 100
targetWeight = percentage / 100 * totalWeight

Cumulative weight check:
  Variant A (weight: 50) → 0–50%
  Variant B (weight: 30) → 50–80%
  Variant C (weight: 20) → 80–100%
```

### Reserved Variant Names

| Name        | Meaning                                 |
| ----------- | --------------------------------------- |
| `$default`  | Default variant (no variants defined)   |
| `$disabled` | Flag is disabled                        |
| `$missing`  | Flag does not exist in cache            |
| `$config`   | Flag uses configuration value           |

## SDK Usage

### Available Client SDKs

| SDK                   | Language      | Package                         |
| --------------------- | ------------- | ------------------------------- |
| **JavaScript/TypeScript** | JS/TS     | `@gatrix/js-client-sdk`         |
| **React**             | JS/TS         | `@gatrix/react-sdk`             |
| **Vue**               | JS/TS         | `@gatrix/vue-sdk`               |
| **Svelte**            | JS/TS         | `@gatrix/svelte-sdk`            |
| **Unity**             | C#            | `gatrix-unity-client-sdk`       |
| **Unreal Engine**     | C++           | `gatrix-unreal-client-sdk`      |
| **Cocos2d-x**         | C++           | `gatrix-cocos2dx-client-sdk`    |
| **Flutter**           | Dart          | `gatrix-flutter-client-sdk`     |
| **Godot**             | GDScript      | `gatrix-godot-client-sdk`       |
| **Python**            | Python        | `gatrix-python-client-sdk`      |

### SDK Lifecycle

All client SDKs follow the same lifecycle pattern:

```
Constructor → init() → start() → [polling loop] → stop()
                │          │
                │          └─ First fetch → "flags.ready" event
                └─ Load from cache/bootstrap → "flags.init" event
```

### Initialization

```typescript
import { GatrixClient } from '@gatrix/js-client-sdk';

const client = new GatrixClient({
  // Required
  apiUrl: 'https://edge.your-api.com/api/v1',
  apiToken: 'your-client-api-token',
  appName: 'my-app',
  environment: 'production',

  // Optional
  refreshInterval: 30,        // Poll interval in seconds (default: 30)
  explicitSyncMode: false,    // Buffer changes until syncFlags() (default: false)
  disableRefresh: false,      // Disable automatic polling (default: false)
  offlineMode: false,         // No network requests (default: false)
  disableMetrics: false,      // Disable metrics collection (default: false)

  // Initial context
  context: {
    userId: 'user-123',
    properties: {
      country: 'KR',
      level: 42,
      isPremium: true,
    },
  },
});

await client.start();
```

### Configuration Options

| Option             | Type    | Default         | Description                                                |
| ------------------ | ------- | --------------- | ---------------------------------------------------------- |
| `apiUrl`           | string  | **required**    | Edge API or Backend URL                                    |
| `apiToken`         | string  | **required**    | Client API token                                           |
| `appName`          | string  | **required**    | Application name                                           |
| `environment`      | string  | **required**    | Environment name                                           |
| `refreshInterval`  | number  | `30`            | Seconds between polls (1–86400)                            |
| `disableRefresh`   | boolean | `false`         | Disable automatic polling                                  |
| `explicitSyncMode` | boolean | `false`         | Buffer changes, apply with `syncFlags()`                   |
| `offlineMode`      | boolean | `false`         | No network requests; requires bootstrap or cache           |
| `bootstrap`        | array   | —               | Initial flags for instant availability                     |
| `bootstrapOverride`| boolean | `false`         | Override cached flags with bootstrap                       |
| `disableMetrics`   | boolean | `false`         | Disable metrics collection                                 |
| `impressionDataAll`| boolean | `false`         | Track impressions for all flags                            |
| `enableDevMode`    | boolean | `false`         | Detailed debug logging (prefixed with `[DEV]`)             |
| `cacheKeyPrefix`   | string  | `"gatrix_cache"`| Prefix for storage keys                                    |
| `customHeaders`    | object  | —               | Additional HTTP headers                                    |
| `storageProvider`  | object  | localStorage    | Custom storage provider                                    |

### Flag Access Methods

#### Basic Access

```typescript
const features = client.features;

// Check if flag is enabled (returns flag.enabled, NOT variant value)
const isEnabled = features.isEnabled('dark-mode');

// Check if a flag exists in cache
const exists = features.hasFlag('dark-mode');

// Get all flags
const allFlags = features.getAllFlags();
```

#### Typed Variations (Fallback Value Required)

All variation methods **require** a fallback value. This ensures your application always receives a valid value, even during failures.

```typescript
// Boolean value (from variant.value, NOT flag.enabled)
const darkMode = features.boolVariation('dark-mode', false);

// String value
const theme = features.stringVariation('theme-name', 'light');

// Number value (JS/TS SDK only — see note below)
const maxItems = features.numberVariation('max-items', 10);

// JSON value
const config = features.jsonVariation('feature-config', { enabled: false });

// Variant name (not value)
const variantName = features.variation('ab-test', 'control');
```

:::warning `isEnabled()` vs `boolVariation()`
These serve **completely different** purposes:
- **`isEnabled('flag')`** → Returns whether the flag is **turned on** (`flag.enabled`)
- **`boolVariation('flag', false)`** → Returns the **boolean value** from the variant (`variant.value`)

For simple boolean flags without variants, they may return the same result, but they are semantically different. Use `boolVariation` when you need the actual flag value.
:::

:::important Number Types in Non-JS SDKs
JavaScript/TypeScript SDKs provide `numberVariation()` because TypeScript's `number` covers both integers and floats.

**All other SDKs** use type-specific functions:
- `intVariation(flagName, fallbackValue)` / `intVariationOrThrow(flagName)` — Returns integer
- `floatVariation(flagName, fallbackValue)` / `floatVariationOrThrow(flagName)` — Returns float/double

| SDK        | Integer Function    | Float Function        |
| ---------- | ------------------- | --------------------- |
| Unity (C#) | `IntVariation()`    | `FloatVariation()`    |
| Unreal (C++)| `IntVariation()`   | `FloatVariation()`    |
| Cocos2d-x  | `intVariation()`    | `floatVariation()`    |
| Flutter    | `intVariation()`    | `doubleVariation()`   |
| Godot      | `int_variation()`   | `float_variation()`   |
| Python     | `int_variation()`   | `float_variation()`   |
:::

#### Variation Details

Get detailed information about the evaluation result:

```typescript
const result = features.boolVariationDetails('dark-mode', false);
// result.value      → true
// result.reason     → "strategy_match"
// result.flagExists → true
// result.enabled    → true
```

#### Strict Variations (OrThrow)

Throw an error if the flag is not found, disabled, or has the wrong value type:

```typescript
try {
  const value = features.boolVariationOrThrow('critical-flag');
} catch (error) {
  // GatrixFeatureError: flag not found, disabled, or wrong valueType
}
```

#### FlagProxy

The `getFlag()` method returns a `FlagProxy` — a convenience wrapper with all variation methods:

```typescript
const flag = features.getFlag('dark-mode');

flag.exists;                    // boolean: does the flag exist?
flag.enabled;                   // boolean: is the flag enabled?
flag.name;                      // string: flag name
flag.variant;                   // Variant: never null (uses $missing sentinel)
flag.valueType;                 // 'boolean' | 'string' | 'number' | 'json'
flag.version;                   // number: flag version
flag.boolVariation(false);      // Delegates to FeaturesClient internally
flag.stringVariation('default');
```

### Context Management

```typescript
// Get current context
const ctx = features.getContext();

// Update entire context (triggers re-fetch)
await features.updateContext({
  userId: 'user-456',
  properties: { country: 'JP' },
});

// Update a single context field (triggers re-fetch)
await features.setContextField('level', 42);

// Remove a context field (triggers re-fetch)
await features.removeContextField('tempFlag');
```

:::caution Context Update Performance
Every `updateContext()` / `setContextField()` / `removeContextField()` call triggers a **network request** to re-evaluate flags. Avoid putting frequently changing values in context.

**Safe for context:** userId, country, plan, platform, appVersion
**Avoid in context:** timestamps, animation frames, counters, rapidly changing game state
:::

### Watch Pattern (Reactive Updates)

Subscribe to individual flag changes for reactive UI updates:

```typescript
// Watch for flag changes (fires only on change)
const unwatch = features.watchFlag('dark-mode', (flag) => {
  console.log('Dark mode changed:', flag.boolVariation(false));
});

// Watch with initial state (fires immediately with current value, then on change)
const unwatch = features.watchFlagWithInitialState('dark-mode', (flag) => {
  applyTheme(flag.boolVariation(false) ? 'dark' : 'light');
});

// Stop watching
unwatch();
```

:::info watchFlag and Flag Removal
`watchFlag` only reacts to `created` and `updated` events. It does **NOT** fire when a flag is removed from the server. To handle removals, subscribe to `flags.removed`:
```typescript
client.on('flags.removed', (removedFlagNames: string[]) => {
  console.log('Removed flags:', removedFlagNames);
});
```
:::

#### Watch Groups

Manage multiple watchers as a batch for easy cleanup:

```typescript
const group = features.createWatchFlagGroup('ui-settings');
group
  .watchFlag('dark-mode', (flag) => updateTheme(flag))
  .watchFlag('font-size', (flag) => updateFontSize(flag));

// Unsubscribe all watchers at once
group.unwatchAll();

// Or destroy the group entirely
group.destroy();
```

### Explicit Sync Mode

Critical for **games and real-time applications** where flag changes must not disrupt the current game loop or session.

```typescript
const client = new GatrixClient({
  // ...config
  explicitSyncMode: true,
});

// Flags are fetched in background but NOT applied until syncFlags()
client.on('flags.pending_sync', () => {
  showNotification('New settings available!');
});

// Apply changes at a safe point (scene transition, lobby, loading screen)
await features.syncFlags();
```

#### How It Works

| Store               | Description                                      |
| ------------------- | ------------------------------------------------ |
| `realtimeFlags`     | Latest flags from server (always up to date)     |
| `synchronizedFlags` | Flags your app reads from (updated on syncFlags) |

- Default reads come from `synchronizedFlags`
- Use `forceRealtime: true` to read from `realtimeFlags` (useful for debug UIs)

```typescript
// Read from synchronized store (default)
const enabled = features.isEnabled('my-feature');

// Read from realtime store (for debug/dashboard)
const realtimeEnabled = features.isEnabled('my-feature', true);
```

#### Runtime Mode Switching

```typescript
// Enable explicit sync at runtime
features.setExplicitSyncMode(true);
// → synchronizedFlags = realtimeFlags, pendingSync = false

// Disable (immediately applies all pending changes)
features.setExplicitSyncMode(false);
// → synchronizedFlags = realtimeFlags, pendingSync = false
```

### Events

| Event                    | Description                                        | Payload                          |
| ------------------------ | -------------------------------------------------- | -------------------------------- |
| `flags.init`             | SDK initialized from storage/bootstrap             | —                                |
| `flags.ready`            | First successful fetch completed                   | —                                |
| `flags.fetch_start`      | Started fetching                                   | `{ etag }`                       |
| `flags.fetch_success`    | Fetch succeeded                                    | —                                |
| `flags.fetch_error`      | Fetch failed                                       | `{ status?, error? }`            |
| `flags.fetch_end`        | Fetch completed (success or error)                 | —                                |
| `flags.change`           | Flags changed from server                          | `{ flags }`                      |
| `flags.{name}.change`    | Individual flag changed                            | `(newFlag, oldFlag, changeType)` |
| `flags.removed`          | Flags removed from server                          | `string[]` (flag names)          |
| `flags.pending_sync`     | Pending sync available (explicit sync mode)        | —                                |
| `flags.impression`       | Flag accessed (if impression tracking enabled)     | `ImpressionEvent`                |
| `flags.error`            | General SDK error                                  | `{ type, error }`                |
| `flags.recovered`        | Recovered from error state                         | —                                |
| `flags.metrics.sent`     | Metrics sent successfully                          | `{ count }`                      |

```typescript
// Subscribe to events
client.on('flags.ready', () => {
  console.log('SDK ready, flags loaded');
});

client.on('flags.change', ({ flags }) => {
  console.log('Flags updated:', flags.length);
});

// Per-flag change events
client.on('flags.dark-mode.change', (newFlag, oldFlag, changeType) => {
  // changeType: 'created' | 'updated'
  console.log(`dark-mode ${changeType}:`, newFlag);
});

// Subscribe to ALL events (debugging)
client.onAny((eventName, ...args) => {
  console.log(`[gatrix] ${eventName}`, ...args);
});
```

### Polling & Error Resilience

The SDK implements robust polling with exponential backoff:

| Scenario                  | Behavior                                                        |
| ------------------------- | --------------------------------------------------------------- |
| Successful fetch          | Schedule next fetch after `refreshInterval` seconds             |
| Retryable error           | Exponential backoff: `min(initialBackoffMs * 2^(n-1), maxBackoffMs)` |
| Non-retryable (401, 403)  | Polling stops. Call `fetchFlags()` manually to resume.          |
| Recovery after errors     | `consecutiveFailures` resets, normal polling resumes            |

:::info Polling Never Stops on Errors
Polling **always** continues after errors (except 401/403). The SDK uses exponential backoff but never permanently stops. This ensures resilience in production environments.
:::

### Offline Mode & Bootstrap

```typescript
const client = new GatrixClient({
  // ...config
  offlineMode: true,              // No network requests
  bootstrap: [                    // Initial flags for instant availability
    { name: 'dark-mode', enabled: true, variant: { name: 'default', value: true } },
  ],
  bootstrapOverride: true,        // Override cached flags with bootstrap
});
```

### Storage Provider

SDKs support custom storage for flag caching:

| SDK        | Default Storage          | Custom Support                  |
| ---------- | ------------------------ | ------------------------------- |
| JS/TS      | `localStorage`           | `IStorageProvider` interface    |
| Unity      | `PlayerPrefs`            | `IGatrixStorageProvider`        |
| Unreal     | File-based (`{Saved}/Gatrix/`) | `IGatrixStorageProvider`  |
| Flutter    | `SharedPreferences`      | `GatrixStorageProvider`         |
| Cocos2d-x  | `UserDefault`            | `IGatrixStorageProvider`        |
| Godot      | `ConfigFile`             | Custom implementation           |
| Python     | In-memory                | `StorageProvider` interface     |

### Metrics

When metrics are enabled, the SDK automatically tracks and sends:

```json
{
  "appName": "MyApp",
  "environment": "production",
  "sdkName": "@gatrix/js-client-sdk",
  "sdkVersion": "1.0.0",
  "connectionId": "uuid-string",
  "bucket": {
    "start": "2024-01-01T00:00:00.000Z",
    "stop": "2024-01-01T00:01:00.000Z",
    "flags": {
      "dark-mode": { "yes": 10, "no": 2, "variants": { "dark-theme": 7 } }
    },
    "missing": {
      "unknown-flag": 5
    }
  }
}
```

- `yes` / `no` — flag enabled/disabled access counts
- `variants` — per-variant selection counts
- `missing` — flags accessed but not found in cache

### SDK Statistics

Debug and monitor SDK state at runtime:

```typescript
const stats = features.getStats();
// stats.totalFlagCount     — Total flags in cache
// stats.fetchFlagsCount    — Number of fetch calls
// stats.updateCount        — Successful updates
// stats.errorCount         — Total fetch errors
// stats.sdkState           — 'initializing' | 'ready' | 'healthy' | 'error'
// stats.missingFlags       — { "unknown-flag": 5 }
// stats.etag               — Current ETag
// stats.lastFetchTime      — Last fetch attempt timestamp
```

## Platform-Specific Examples

### Unity (C#)

```csharp
var config = new GatrixClientConfig {
    ApiUrl = "https://edge.your-api.com/api/v1",
    ApiToken = "your-token",
    AppName = "my-game",
    Environment = "production",
    ExplicitSyncMode = true, // Recommended for games
    Context = new GatrixContext {
        UserId = playerId,
        Properties = new Dictionary<string, object> {
            { "level", playerLevel },
            { "platform", "windows" }
        }
    }
};

var client = new GatrixClient(config);
await client.Start();

// Use int/float instead of number
int maxRetries = client.Features.IntVariation("max-retries", 3);
float gameSpeed = client.Features.FloatVariation("game-speed", 1.0f);
bool darkMode = client.Features.BoolVariation("dark-mode", false);

// Apply flag changes at scene transition
if (client.Features.HasPendingSyncFlags()) {
    await client.Features.SyncFlags();
}
```

### Unreal Engine (C++)

```cpp
FGatrixClientConfig Config;
Config.ApiUrl = TEXT("https://edge.your-api.com/api/v1");
Config.ApiToken = TEXT("your-token");
Config.AppName = TEXT("my-game");
Config.Environment = TEXT("production");
Config.bExplicitSyncMode = true;

TSharedPtr<FGatrixClient> Client = MakeShared<FGatrixClient>(Config);
Client->Start();

// Typed access
bool bDarkMode = Client->GetFeatures()->BoolVariation("dark-mode", false);
int32 MaxRetries = Client->GetFeatures()->IntVariation("max-retries", 3);
float GameSpeed = Client->GetFeatures()->FloatVariation("game-speed", 1.0f);
FString Theme = Client->GetFeatures()->StringVariation("theme", "default");
```

### Flutter (Dart)

```dart
final client = GatrixClient(GatrixClientConfig(
  apiUrl: 'https://edge.your-api.com/api/v1',
  apiToken: 'your-token',
  appName: 'my-app',
  environment: 'production',
  context: GatrixContext(
    userId: userId,
    properties: {'country': 'KR', 'isPremium': true},
  ),
));

await client.start();

bool darkMode = client.features.boolVariation('dark-mode', false);
int maxItems = client.features.intVariation('max-items', 10);
double speed = client.features.doubleVariation('game-speed', 1.0);
```

### Godot (GDScript)

```gdscript
var config = GatrixClientConfig.new()
config.api_url = "https://edge.your-api.com/api/v1"
config.api_token = "your-token"
config.app_name = "my-game"
config.environment = "production"
config.explicit_sync_mode = true

var client = GatrixClient.new(config)
client.start()

# Typed access
var dark_mode = client.features.bool_variation("dark-mode", false)
var max_retries = client.features.int_variation("max-retries", 3)
var game_speed = client.features.float_variation("game-speed", 1.0)
```

### Python

```python
from gatrix import GatrixClient, GatrixClientConfig, GatrixContext

config = GatrixClientConfig(
    api_url="https://edge.your-api.com/api/v1",
    api_token="your-token",
    app_name="my-app",
    environment="production",
    context=GatrixContext(
        user_id="user-123",
        properties={"country": "KR", "level": 42},
    ),
)

client = GatrixClient(config)
await client.start()

dark_mode = client.features.bool_variation("dark-mode", False)
max_items = client.features.int_variation("max-items", 10)
speed = client.features.float_variation("game-speed", 1.0)
```

## HTTP Headers

All client SDKs include these headers on every request:

| Header               | Value                        | Description                        |
| -------------------- | ---------------------------- | ---------------------------------- |
| `X-API-Token`        | `{apiToken}`                 | Authentication token               |
| `X-Application-Name` | `{appName}`                  | Application name                   |
| `X-Connection-Id`    | `{uuid}`                     | Unique per-SDK-instance ID         |
| `X-SDK-Version`      | `{sdkName}/{version}`        | SDK identification                 |
| `X-Environment`      | `{environment}`              | Environment (fetchFlags only)      |
| `If-None-Match`      | `{etag}`                     | ETag for 304 support               |

## Evaluation Result

The server returns evaluated flags in this format:

```json
{
  "success": true,
  "data": {
    "flags": [
      {
        "name": "dark-mode",
        "enabled": true,
        "variant": {
          "name": "$default",
          "enabled": true,
          "value": true
        },
        "valueType": "boolean",
        "version": 5,
        "impressionData": false
      }
    ]
  }
}
```

### Evaluation Reasons

| Reason            | Description                                          |
| ----------------- | ---------------------------------------------------- |
| `enabled`         | Flag is enabled, no strategies                       |
| `disabled`        | Flag is disabled                                     |
| `strategy_match`  | A strategy matched the context                       |
| `constraint_match`| A constraint matched                                 |
| `rollout`         | User falls within rollout percentage                 |
| `default`         | No strategies matched, using default                 |
| `not_found`       | Flag does not exist                                  |
| `error`           | Evaluation error occurred                            |

## Best Practices

### Flag Design

1. **Use kebab-case** for flag keys — consistent and static-analysis friendly
2. **Choose the right flag type** — `release` for feature rollouts, `killSwitch` for emergency toggles, `remoteConfig` for tuning values
3. **Set meaningful disabled values** — Users should see sensible defaults when a flag is off
4. **Use `staleAfterDays`** — Set a staleness threshold to identify flags that should be removed
5. **Tag your flags** — Use tags for categorization and filtering

### SDK Usage

1. **Always provide fallback values** — Ensures resilience during network failures
2. **Use `boolVariation` over `isEnabled`** — Gets the actual variant value, not just the enabled state
3. **Use Explicit Sync Mode for games** — Prevents mid-frame/mid-session flag disruption
4. **Keep context minimal** — Avoid frequently changing values in context
5. **Call `start()` once, `stop()` once** — SDK lifecycle should match your app lifecycle
6. **Use `watchFlag` for reactive UIs** — Don't poll manually
7. **Handle `flags.ready` before rendering** — Prevent flicker from unloaded flags

### Performance

1. **Flag reads are in-memory** — `isEnabled`, `*Variation`, `getVariant` are safe in hot paths (game loops, render functions)
2. **Context updates trigger network** — Debounce if driven by user input
3. **Batch flag watchers** — Use `WatchFlagGroup` for cleaner lifecycle management
4. **Use bootstrap for instant loading** — Eliminates the loading gap before first fetch

## See Also

- [Segments](./segments) — Reusable user group targeting
- [Environments](./environments) — Environment-specific configuration
- [Client SDKs](../sdks/client-side) — Platform-specific SDK documentation
- [Game Engine SDKs](../sdks/game-engines) — Unity, Unreal, Godot, Cocos2d-x
