# Gatrix Client-Side SDK Specification

## Overview

This specification defines the requirements and interfaces for Gatrix client-side feature flag SDKs. These SDKs are designed to run in browser environments (or similar client-side contexts like React Native) and communicate with the Gatrix Edge API to fetch evaluated feature flags.

> [!IMPORTANT]
> Client-side SDKs do NOT perform local evaluation. All flag evaluation is performed server-side through the Edge API.

## Core Concepts

### 1. Server-Side Evaluation

Unlike server SDKs that perform local evaluation, client-side SDKs:
- Fetch pre-evaluated flags from the Edge API
- Periodically poll for flag updates
- Store flags locally for offline access

### 2. Global Context

Client-side SDKs manage context globally since they represent a single user/session:
- Context is set once and reused for all evaluations
- Context updates trigger a re-fetch of evaluated flags
- No need to pass context to every function call

### 3. Repository Pattern

Inspired by Unleash SDK architecture:
- `Repository`: Manages flag storage and synchronization
- `StorageProvider`: Interface for persistent storage (localStorage, AsyncStorage, etc.)

### 4. Explicit Sync Mode

Based on unleash-proxy-lua's pattern:
- Flags are fetched in real-time but applied at controlled sync points
- Prevents mid-session flag changes that could cause inconsistent UX
- `syncFlags()` applies pending flag changes

## API Response Format

The Edge API returns evaluated flags in this format:

```json
{
  "success": true,
  "data": {
    "flags": [
      {
        "name": "feature-name",
        "enabled": true,
        "variant": {
          "name": "variant-name",
          "enabled": true,
          "payload": "{\"key\":\"value\"}"
        },
        "variantType": "json",
        "version": 12,
        "impressionData": true
      }
    ]
  },
  "meta": {
    "environment": "development",
    "evaluatedAt": "2026-02-05T14:14:38.727Z"
  }
}
```

### Flag Structure

| `name` | string | Unique flag identifier |
| `enabled` | boolean | Whether the flag is enabled |
| `variant` | object | Selected variant details |
| `variant.name` | string | Variant name |
| `variant.enabled` | boolean | Whether variant is enabled |
| `variant.payload` | string \| number \| object | Variant payload (flexible type) |
| `variantType` | "none" \| "string" \| "number" \| "json" | Payload type hint |
| `version` | number | Flag version for change detection |
| `impressionData` | boolean? | Whether to track impressions |
| `reason` | string? | Evaluation reason (e.g., "targeting_match", "disabled", "not_found") |

## SDK Configuration

```typescript
interface GatrixClientConfig {
  // Required
  url: string;                    // Edge API URL
  apiKey: string;                 // Client API key
  appName: string;                // Application name

  // Optional - Polling
  refreshInterval?: number;       // Seconds between polls (default: 30)
  disableRefresh?: boolean;       // Disable automatic polling

  // Optional - Context
  environment?: string;           // Environment name
  context?: GatrixContext;        // Initial context

  // Optional - Storage
  storageProvider?: IStorageProvider;  // Custom storage provider

  // Optional - Sync Mode
  explicitSyncMode?: boolean;     // Enable explicit sync mode

  // Optional - Bootstrap
  bootstrap?: EvaluatedFlag[];    // Initial flags for instant availability
  bootstrapOverride?: boolean;    // Override stored flags with bootstrap

  // Optional - Advanced
  customHeaders?: Record<string, string>;
  disableMetrics?: boolean;
  impressionDataAll?: boolean;    // Track impressions for all flags
}
```

## Context Interface

```typescript
interface GatrixContext {
  userId?: string;
  sessionId?: string;
  deviceId?: string;
  currentTime?: string;
  properties?: Record<string, string | number | boolean>;
}
```

## Events

All events use the `flags.*` prefix for namespacing:

| Event | Description | Payload |
|-------|-------------|---------|
| `flags.init` | SDK initialized (from storage/bootstrap) | - |
| `flags.ready` | First successful fetch completed | - |
| `flags.update` | Flags updated from server | `{ flags: EvaluatedFlag[] }` |
| `flags.error` | Error occurred | `{ type: string, error: Error }` |
| `flags.impression` | Flag accessed (if impressionData enabled) | `ImpressionEvent` |

## Main Interface

### GatrixClient

```typescript
class GatrixClient extends EventEmitter {
  constructor(config: GatrixClientConfig);

  // Lifecycle
  start(): Promise<void>;
  stop(): void;
  isReady(): boolean;

  // Context Management (Global)
  getContext(): GatrixContext;
  updateContext(context: GatrixContext): Promise<void>;
  setContextField(field: string, value: string | number | boolean): Promise<void>;
  removeContextField(field: string): Promise<void>;

  // Flag Access - Basic
  isEnabled(flagName: string): boolean;
  getVariant(flagName: string): Variant;  // Never returns null/undefined
  getAllFlags(): EvaluatedFlag[];

  // Flag Access - Typed Variations (no context parameter - uses global)
  variation(flagName: string, defaultValue?: string): string;  // Returns variant name
  boolVariation(flagName: string, defaultValue?: boolean): boolean;
  stringVariation(flagName: string, defaultValue?: string): string;
  numberVariation(flagName: string, defaultValue?: number): number;
  jsonVariation<T>(flagName: string, defaultValue?: T): T;

  // Variation Details - Returns detailed result with reason
  boolVariationDetails(flagName: string, defaultValue?: boolean): VariationResult<boolean>;
  stringVariationDetails(flagName: string, defaultValue?: string): VariationResult<string>;
  numberVariationDetails(flagName: string, defaultValue?: number): VariationResult<number>;
  jsonVariationDetails<T>(flagName: string, defaultValue?: T): VariationResult<T>;

  // Strict Variations - Throws on not found/disabled/invalid
  boolVariationOrThrow(flagName: string): boolean;
  stringVariationOrThrow(flagName: string): string;
  numberVariationOrThrow(flagName: string): number;
  jsonVariationOrThrow<T>(flagName: string): T;

  // Explicit Sync Mode
  syncFlags(fetchNow?: boolean): Promise<void>;

  // Watch (Change Detection) - Returns FlagProxy for convenience
  watchFlag(flagName: string, callback: (flag: FlagProxy) => void): () => void;
  watchFlagWithInitialState(flagName: string, callback: (flag: FlagProxy) => void): () => void;
  createWatchGroup(name: string): WatchFlagGroup;

  // Manual Control
  fetchFlags(): Promise<void>;
}
```

## Storage Provider Interface

```typescript
interface IStorageProvider {
  get(key: string): Promise<any>;
  save(key: string, value: any): Promise<void>;
  delete?(key: string): Promise<void>;
}
```

Built-in implementations:
- `LocalStorageProvider`: Uses browser localStorage
- `InMemoryStorageProvider`: In-memory only (no persistence)

## Variation Functions

All variation functions:
- Use the global context (no context parameter needed)
- Return the default value if flag not found or disabled
- Count metrics for the flag access

| Function | Return Type | Description |
|----------|-------------|-------------|
| `variation` | string | Variant name only |
| `boolVariation` | boolean | Flag enabled state |
| `stringVariation` | string | Variant payload as string |
| `numberVariation` | number | Variant payload as number |
| `jsonVariation<T>` | T | Variant payload parsed as JSON |

### VariationResult Interface

```typescript
interface VariationResult<T> {
  value: T;              // The evaluated value
  reason: string;        // Evaluation reason
  flagExists: boolean;   // Whether flag exists
  enabled: boolean;      // Flag enabled state
}
```

### FlagProxy Class

Convenience wrapper for accessing flag values:

```typescript
class FlagProxy {
  constructor(flag: EvaluatedFlag | undefined);
  
  get exists(): boolean;
  get enabled(): boolean;
  get name(): string;
  get variant(): Variant;        // Never null/undefined
  get variantType(): VariantType;
  get version(): number;
  get reason(): string | undefined;
  get impressionData(): boolean;
  get raw(): EvaluatedFlag | undefined;
  
  isEnabled(): boolean;
  getVariantName(): string;
  
  // Variation methods
  boolVariation(defaultValue?: boolean): boolean;
  stringVariation(defaultValue?: string): string;
  numberVariation(defaultValue?: number): number;
  jsonVariation<T>(defaultValue?: T): T;
  
  // Variation details - returns VariationResult with reason
  boolVariationDetails(defaultValue?: boolean): VariationResult<boolean>;
  stringVariationDetails(defaultValue?: string): VariationResult<string>;
  numberVariationDetails(defaultValue?: number): VariationResult<number>;
  jsonVariationDetails<T>(defaultValue?: T): VariationResult<T>;
  
  // Strict variations - throws on not found/disabled/invalid
  boolVariationOrThrow(): boolean;
  stringVariationOrThrow(): string;
  numberVariationOrThrow(): number;
  jsonVariationOrThrow<T>(): T;
}
```

### WatchFlagGroup Class

Batch management for multiple flag watchers:

```typescript
class WatchFlagGroup {
  constructor(client: FeaturesClient, name: string);
  
  getName(): string;
  watchFlag(flagName: string, callback: (flag: FlagProxy) => void): this;
  watchFlagWithInitialState(flagName: string, callback: (flag: FlagProxy) => void): this;
  unwatchAll(): void;
  destroy(): void;
  get size(): number;
}

// Usage
const group = client.createWatchGroup('my-group');
group
  .watchFlag('flag-1', handler1)
  .watchFlag('flag-2', handler2);

// Later, unsubscribe all at once
group.unwatchAll();
```

## Explicit Sync Mode

When `explicitSyncMode: true`:

1. Flags are fetched in the background (realtime store)
2. Application reads from synchronized store
3. Call `syncFlags()` at safe points to apply changes

```typescript
// Enable explicit sync mode
const client = new GatrixClient({
  url: 'https://edge.gatrix.com',
  apiKey: 'client-key',
  appName: 'my-app',
  explicitSyncMode: true,
});

// Read from synchronized store
const enabled = client.isEnabled('my-feature');

// Apply pending changes at safe point (e.g., scene transition)
await client.syncFlags();
```

## Watch Pattern

Reactive change detection for individual flags:

```typescript
// Watch for changes (excludes initial state)
const unwatch = client.watchFlag('my-feature', (flag) => {
  console.log('Flag changed:', flag.enabled);
});

// Watch with initial state callback
const unwatch = client.watchFlagWithInitialState('my-feature', (flag) => {
  console.log('Flag state:', flag.enabled);
});

// Stop watching
unwatch();
```

## Metrics

When metrics enabled, SDK tracks:
- Flag access counts (enabled: yes/no)
- Variant selections
- Impression events (if impressionData enabled)
- **notFound events** (when accessing non-existent flags)

Metrics are batched and sent periodically to the Edge API.

## Design Rules

> [!IMPORTANT]
> **getVariant never returns null/undefined** - Always returns a fallback variant (`{ name: 'disabled', enabled: false }`) when flag not found or disabled.

- All variation functions return default values for disabled/not-found flags
- `*VariationOrThrow` methods throw for strict checking scenarios
- Context updates trigger automatic re-fetch of flags
- SessionId is automatically generated if not provided

## Error Handling

SDK should be resilient:
- Graceful degradation with cached/bootstrap flags
- Exponential backoff on fetch failures
- Error events emitted, not thrown

## Implementation Checklist (gatrix-js-client-sdk)

- [x] Core GatrixClient class with event emitter
- [x] Configuration validation
- [x] Repository pattern with storage providers
- [x] Polling mechanism with backoff
- [x] Context management (global)
- [x] Explicit sync mode
- [x] Watch pattern for change detection (watchFlag, WatchFlagGroup)
- [x] Variation functions (bool, string, number, json)
- [x] Variation details and OrThrow variants
- [x] FlagProxy convenience wrapper
- [x] Metrics collection with notFound tracking
- [x] TypeScript types and exports
- [x] Browser build (ES modules + CJS + UMD)
- [ ] React hooks wrapper (separate package)
