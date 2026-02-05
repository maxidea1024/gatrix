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

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Unique flag identifier |
| `enabled` | boolean | Whether the flag is enabled |
| `variant` | object | Selected variant details |
| `variant.name` | string | Variant name |
| `variant.enabled` | boolean | Whether variant is enabled |
| `variant.payload` | string? | Variant payload (may be stringified JSON) |
| `variantType` | "none" \| "string" \| "json" | Payload type hint |
| `version` | number | Flag version for change detection |
| `impressionData` | boolean? | Whether to track impressions |

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
  getVariant(flagName: string): Variant;
  getAllFlags(): EvaluatedFlag[];

  // Flag Access - Typed Variations (no context parameter - uses global)
  boolVariation(flagName: string, defaultValue?: boolean): boolean;
  stringVariation(flagName: string, defaultValue?: string): string;
  numberVariation(flagName: string, defaultValue?: number): number;
  jsonVariation<T>(flagName: string, defaultValue?: T): T;

  // Explicit Sync Mode
  syncFlags(fetchNow?: boolean): Promise<void>;

  // Watch (Change Detection)
  watchFlag(flagName: string, callback: (flag: EvaluatedFlag) => void): () => void;
  watchFlagWithInitialState(flagName: string, callback: (flag: EvaluatedFlag) => void): () => void;

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
| `boolVariation` | boolean | Flag enabled state |
| `stringVariation` | string | Variant payload as string |
| `numberVariation` | number | Variant payload as number |
| `jsonVariation<T>` | T | Variant payload parsed as JSON |

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

Metrics are batched and sent periodically to the Edge API.

## Error Handling

SDK should be resilient:
- Graceful degradation with cached/bootstrap flags
- Exponential backoff on fetch failures
- Error events emitted, not thrown

## Implementation Checklist

- [ ] Core client class with event emitter
- [ ] Configuration validation
- [ ] Repository pattern with storage providers
- [ ] Polling mechanism with backoff
- [ ] Context management
- [ ] Explicit sync mode
- [ ] Watch pattern for change detection
- [ ] Variation functions
- [ ] Metrics collection
- [ ] TypeScript types
- [ ] Browser build (ES modules + UMD)
- [ ] React hooks wrapper (separate package)
