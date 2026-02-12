# Gatrix Client SDK Specification

This document defines the core architecture, API, and behavior for all Gatrix Client SDKs.

## Scope and Future Expansion

> [!IMPORTANT]
> The Gatrix Client SDK is designed as a unified platform for multiple Gatrix services. While the initial focus is on **Feature Flags (Gatrix Features)**, the architecture allows for seamless integration of future services, including:
>
> - **Gatrix Features**: Feature flags and remote configuration (Current focus).
> - **Gatrix Surveys**: Client-side survey triggering and responses.
> - **Gatrix Maintenance**: Maintenance window management and whitelisting.
> - **Gatrix Messaging**: In-app notifications and messaging.
>
> All naming conventions and event structures should be designed to be service-agnostic or explicitly namespaced (e.g., using `flags.` prefix for feature flag events) to avoid collisions with future features.

## Terminology

> [!CAUTION]
> Gatrix uses the term **"flag"** (or **"feature flag"**) ??never **"toggle"** or **"feature toggle"**.
> All SDK code, APIs, metrics payloads, documentation, and comments MUST use `flag`/`flags` consistently.
> For example, metrics payloads use `bucket.flags`, not `bucket.toggles`.

## Metrics Payload Format

When sending metrics to the backend, the payload MUST follow this structure:

```json
{
  "appName": "MyApp",
  "environment": "production",
  "sdkName": "gatrix-js-client-sdk",
  "sdkVersion": "1.0.0",
  "connectionId": "uuid-string",
  "bucket": {
    "start": "2024-01-01T00:00:00.000Z",
    "stop": "2024-01-01T00:01:00.000Z",
    "flags": {
      "my-flag": {
        "yes": 10,
        "no": 2,
        "variants": {
          "variant-a": 7,
          "variant-b": 3
        }
      }
    },
    "missing": {
      "unknown-flag": 5
    }
  }
}
```

- `bucket.flags` ??per-flag access counts (`yes` = enabled, `no` = disabled, `variants` = variant name counts)
- `bucket.missing` ??flags that were accessed but not found in the local cache

## Overview

This specification defines the requirements and interfaces for Gatrix client-side SDKs. These SDKs are designed to run in browser environments, mobile applications, and game engines (like Unity), communicating with the Gatrix Edge API.

## Core Concepts

### 1. Server-Side Evaluation (for Features)

For the Feature Flag service, client-side SDKs:

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
          "name": "dark-theme",
          "enabled": true,
          "value": {"key": "value"}
        },
        "valueType": "json",
        "version": 12,
        "impressionData": true
      }
    ]
  }
}
```

### Flag Structure

| `name` | string | Unique flag identifier |
| `enabled` | boolean | Whether the flag is enabled |
| `variant` | object | Selected variant details |
| `variant.name` | string | Variant name |
| `variant.enabled` | boolean | Whether variant is enabled |
| `variant.value` | string \| number \| boolean \| object | Variant value (flexible type) |
| `valueType` | "string" \| "number" \| "boolean" \| "json" | Value type hint (server response never contains "none"; "none" is SDK-internal only for missing/disabled flags) |
| `version` | number | Flag version for change detection |
| `impressionData` | boolean? | Whether to track impressions |
| `reason` | string? | Evaluation reason (e.g., "targeting_match", "disabled", "not_found") |

## SDK Configuration

```typescript
interface GatrixClientConfig {
  // Required
  apiUrl: string; // Base API URL for Edge or Backend server (e.g., https://edge.your-api.com/api/v1)
  apiToken: string; // Client API token
  appName: string; // Application name
  environment: string; // Environment name (required)

  // Optional - Polling
  refreshInterval?: number; // Seconds between polls (default: 30)
  disableRefresh?: boolean; // Disable automatic polling

  // Optional - Context
  context?: GatrixContext; // Initial context

  // Optional - Storage
  storageProvider?: IStorageProvider; // Custom storage provider

  // Optional - Sync Mode
  explicitSyncMode?: boolean; // Enable explicit sync mode

  // Optional - Offline Mode
  offlineMode?: boolean; // Start in offline mode (no network requests)
  // Requires bootstrap or cached flags, throws error if none available

  // Optional - Bootstrap
  bootstrap?: EvaluatedFlag[]; // Initial flags for instant availability
  bootstrapOverride?: boolean; // Override stored flags with bootstrap

  // Optional - Advanced
  customHeaders?: Record<string, string>;
  disableMetrics?: boolean; // Disable server-side metrics collection
  disableStats?: boolean; // Disable local statistics tracking (default: false)
  impressionDataAll?: boolean; // Track impressions for all flags

  // Optional - Debug
  enableDevMode?: boolean; // Enable detailed debug logging (default: false)

  // Optional - Storage
  cacheKeyPrefix?: string; // Prefix for cache storage keys (default: "gatrix_cache")

  // Optional - Fetch Retry Options
  fetchRetryOptions?: FetchRetryOptions; // Configure retry/backoff behavior
}

interface FetchRetryOptions {
  nonRetryableStatusCodes?: number[]; // HTTP status codes that stop polling (default: [401, 403])
  initialBackoffMs?: number; // Initial backoff delay in ms (default: 1000)
  maxBackoffMs?: number; // Maximum backoff delay in ms (default: 60000)
}
```

### Fetch Retry & Backoff Behavior

All client SDKs implement a **schedule-after-completion** pattern for polling:

1. **Normal polling**: After a successful fetch (200) or not-modified response (304), the SDK schedules the next fetch after `refreshInterval` seconds.
2. **Retryable errors**: On HTTP errors not in `nonRetryableStatusCodes` or network errors, the SDK increments a `consecutiveFailures` counter and schedules the next fetch with exponential backoff: `min(initialBackoffMs * 2^(failures-1), maxBackoffMs)`.
3. **Non-retryable errors**: On HTTP status codes listed in `nonRetryableStatusCodes` (default: 401, 403), polling is stopped entirely. Call `fetchFlags()` manually to resume.
4. **Recovery**: On any successful response after errors, `consecutiveFailures` is reset to 0 and normal polling resumes.
5. **Manual fetchFlags()**: Calling `fetchFlags()` manually resets `pollingStopped` and cancels any pending timer, allowing recovery from non-retryable errors.
6. **start()/stop()**: `start()` resets `consecutiveFailures` and `pollingStopped`. `stop()` sets `pollingStopped = true` and resets `consecutiveFailures`.

### HTTP Headers

All client SDKs MUST include the following standard headers on every HTTP request. This ensures consistent authentication, identification, and traceability across all platforms.

#### Common Headers (fetchFlags + sendMetrics)

| Header | Value | Description |
|--------|-------|-------------|
| `X-API-Token` | `{apiToken}` | Client API token for authentication |
| `X-Application-Name` | `{appName}` | Application name from config |
| `X-Connection-Id` | `{connectionId}` | Unique connection identifier (UUID, generated once per SDK instance) |
| `X-SDK-Version` | `{sdkName}/{sdkVersion}` | SDK identification string (e.g., `@gatrix/js-client-sdk/1.0.0`) |
| `Content-Type` | `application/json` | Required for POST requests |
| `...customHeaders` | User-defined | Spread/merged from `config.customHeaders` |

#### fetchFlags-Only Headers

| Header | Value | Description |
|--------|-------|-------------|
| `X-Environment` | `{environment}` | Environment name from config |
| `If-None-Match` | `{etag}` | ETag from previous response (only when etag exists, enables 304 Not Modified) |

#### X-SDK-Version Format

The `X-SDK-Version` header combines SDK name and version in a single value using the format `{sdkName}/{sdkVersion}`.

Standard SDK names:
- `@gatrix/js-client-sdk` (JavaScript)
- `gatrix-unity-client-sdk` (Unity)
- `gatrix-unreal-client-sdk` (Unreal Engine)
- `gatrix-cocos2dx-client-sdk` (Cocos2d-x)
- `gatrix-flutter-client-sdk` (Flutter)
- `gatrix-godot-client-sdk` (Godot)
- `gatrix-python-client-sdk` (Python)

#### Authentication Note

All SDKs use `X-API-Token` as the primary authentication header. The server also accepts `Authorization: Bearer {token}` as a fallback, but SDKs SHOULD prefer `X-API-Token` for consistency.

### Metrics Retry Behavior

All client SDKs implement retry logic for `sendMetrics` requests:

1. **Max retries**: Up to 2 retry attempts after the initial failure.
2. **Retryable conditions**: Network errors, HTTP 408 (Timeout), 429 (Too Many Requests), or 5xx (Server Error).
3. **Backoff**: Exponential backoff with delay = `2^attempt` seconds (2s, 4s).
4. **Non-retryable**: HTTP 4xx errors (except 408, 429) are not retried.
5. **On final failure**: Emit `FLAGS_METRICS_ERROR` event and increment error counter.

### Config Validation

All client SDKs MUST validate configuration at initialization time and fail fast with clear error messages. Validation runs in the constructor/init before any network calls.

#### Required Fields

| Field | Rule | Error |
|-------|------|-------|
| `apiUrl` | Non-empty, trimmed | `"apiUrl is required"` |
| `apiToken` | Non-empty, trimmed | `"apiToken is required"` |
| `appName` | Non-empty, trimmed | `"appName is required"` |
| `environment` | Non-empty, trimmed | `"environment is required"` |

#### Format Validation

| Field | Rule | Error |
|-------|------|-------|
| `apiUrl` | Must be valid HTTP/HTTPS URL | `"apiUrl must be a valid HTTP/HTTPS URL"` |
| `apiUrl`, `apiToken` | No leading/trailing whitespace | `"must not have leading or trailing whitespace"` |
| `cacheKeyPrefix` | <= 100 characters | `"cacheKeyPrefix must be <= 100 characters"` |

#### Numeric Range Validation

| Field | Min | Max | Unit |
|-------|-----|-----|------|
| `refreshInterval` | 1 | 86400 | seconds |
| `metricsInterval` | 1 | 86400 | seconds |
| `metricsIntervalInitial` | 0 | 3600 | seconds |
| `fetchRetryLimit` | 0 | 10 | count |
| `fetchTimeout` | 1 (or 1000ms) | 120 (or 120000ms) | seconds/ms |
| `initialBackoffMs` | 100 | 60000 | ms |
| `maxBackoffMs` | 1000 | 600000 | ms |

#### Cross-Field Validation

- `initialBackoffMs` must be <= `maxBackoffMs`
- `nonRetryableStatusCodes` entries must be in range 400-599

### Dev Mode Logging

When `enableDevMode` is set to `true`, the SDK outputs detailed debug logs at key lifecycle points:

- **start()**: Logs configuration values (offlineMode, refreshInterval, explicitSyncMode, disableRefresh)
- **stop()**: Logs that stop was called
- **fetchFlags()**: Logs fetch initiation with current etag
- **scheduleNextRefresh()**: Logs scheduled delay, consecutive failures count, and polling stopped state
- **setFlags()**: Logs number of flags loaded and sync mode
- **setReady()**: Logs total flag count when SDK becomes ready
- **initFromStorage()**: Logs number of cached flags loaded

All dev mode log messages are prefixed with `[DEV]` for easy filtering. By default, `enableDevMode` is `false` and no debug logs are emitted.

### Cache Key Prefix

The `cacheKeyPrefix` option (default: `"gatrix_cache"`) allows customization of the prefix used for all storage keys. This is useful when multiple SDK instances share the same storage space (e.g., multiple app environments).

- **JS SDK**: Used in localStorage key names (e.g., `gatrix_cache_flags`, `gatrix_cache_etag`)
- **Flutter SDK**: Used in SharedPreferences key names
- **Unity SDK**: Used in storage provider key names
- **Unreal SDK**: Used as file name prefix in file-based storage
- **Cocos2d-x SDK**: Available in config for custom storage implementations
- **Godot SDK**: Available in config for storage key customization

### Unreal SDK Specifics

#### Log Category

The Unreal SDK declares a dedicated log category `LogGatrix` for all log output. Use this in the Output Log filter to isolate Gatrix SDK messages:

```
LogGatrix: Log: Features ready. 12 flags loaded.
LogGatrix: Log: [DEV] Start() called. offlineMode=False, refreshInterval=30.0, disableRefresh=False
```

#### File-Based Caching

The Unreal SDK uses `FGatrixFileStorageProvider` by default, which persists flag data as JSON files in `{ProjectSaved}/Gatrix/`. Files are named using the pattern `{cacheKeyPrefix}_{key}.json`. This provides:

- **Persistent storage** across game sessions
- **Thread-safe** access via `FCriticalSection`
- **Automatic directory creation** on first use
- **Safe filename sanitization** for keys containing special characters

## Context Interface

```typescript
interface GatrixContext {
  userId?: string;
  sessionId?: string;
  currentTime?: string;
  properties?: Record<string, string | number | boolean>;
}
```

## Events

All events use the `flags.*` prefix for namespacing:

| Event                     | Description                                          | Payload                              |
| ------------------------- | ---------------------------------------------------- | ------------------------------------ |
| `flags.init`              | SDK initialized (from storage/bootstrap)             | -                                    |
| `flags.ready`             | First successful fetch completed                     | -                                    |
| `flags.fetch`             | Started fetching flags from server                   | `{ etag: string \| null }`           |
| `flags.fetch_start`       | Started fetching flags from server (alias for fetch) | `{ etag: string \| null }`           |
| `flags.fetch_success`     | Successfully fetched flags from server               | -                                    |
| `flags.fetch_error`       | Error occurred during fetching                       | `{ status?: number, error?: Error }` |
| `flags.fetch_end`         | Completed fetching flags (success or error)          | -                                    |
| `flags.change`            | Flags changed from server                            | `{ flags: EvaluatedFlag[] }`         |
| `flags.removed`           | One or more flags removed from server                | `string[]` (removed flag names)      |
| `flags.error`             | General SDK error occurred                           | `{ type: string, error: Error }`     |
| `flags.recovered`         | SDK recovered from error state                       | -                                    |
| `flags.impression`        | Flag accessed (if impressionData enabled)            | `ImpressionEvent`                    |
| `flags.pending_sync`      | Pending sync flags available (explicitSyncMode)      | -                                    |
| `flags.{flagName}.change` | Specific flag created or updated                     | `(newFlag, oldFlag, changeType)` where changeType is `'created'` or `'updated'` |
| `flags.metrics.sent`      | Metrics successfully sent to server                  | `{ count: number }`                  |

### Per-Flag Change Events (`flags.{flagName}.change`)

Per-flag change events are emitted when a flag is **created** (new flag) or **updated** (existing flag value changed). Each event includes a `changeType` parameter:

- `'created'`: The flag is new and did not exist in the previous fetch
- `'updated'`: The flag existed before but its value, enabled state, or variant changed

**Flag removals are NOT emitted as per-flag change events.** Instead, a bulk `flags.removed` event is emitted with an array of removed flag names.

### watchFlag Behavior

`watchFlag(flagName, callback)` subscribes to `flags.{flagName}.change` events only. This means:

- ??**Reacts to**: Flag created (`changeType: 'created'`), Flag updated (`changeType: 'updated'`)
- ??**Does NOT react to**: Flag removal ??use `on('flags.removed', callback)` to handle removals separately

This design prevents ambiguous callback behavior when a watched flag is removed from the server.

## Main Interface

### GatrixClient

```typescript
class GatrixClient {
  constructor(config: GatrixClientConfig);

  // Access to FeaturesClient
  get features(): FeaturesClient;

  // Lifecycle
  start(): Promise<void>;
  stop(): void;
  isReady(): boolean;
  getError(): unknown;

  // Event Subscription
  on(event: string, callback: (...args: any[]) => void | Promise<void>, name?: string): this;
  once(event: string, callback: (...args: any[]) => void | Promise<void>, name?: string): this;
  off(event: string, callback?: (...args: any[]) => void | Promise<void>): this;
  onAny(callback: (event: string, ...args: any[]) => void, name?: string): this; // Subscribe to ALL events
  offAny(callback?: (event: string, ...args: any[]) => void): this; // Unsubscribe from ALL events

  // Static
  static get version(): string;
  static get EVENTS(): typeof EVENTS;
}

class FeaturesClient implements VariationProvider {
  // Context Management
  getContext(): GatrixContext;
  updateContext(context: Partial<GatrixContext>): Promise<void>;

  // Flag Access - Basic
  // All flag access methods accept an optional `forceRealtime` parameter (default: false).
  // When `forceRealtime: true`, the method always returns values from `realtimeFlags`
  // regardless of `explicitSyncMode`. This is useful for displaying real-time
  // status in dashboards or debug UIs while keeping the main app synchronized.
  isEnabled(flagName: string, forceRealtime?: boolean): boolean;
  getVariant(flagName: string, forceRealtime?: boolean): Variant; // Never returns null/undefined
  getAllFlags(forceRealtime?: boolean): EvaluatedFlag[];
  hasFlag(flagName: string, forceRealtime?: boolean): boolean;

  // Flag Access - Typed Variations (fallbackValue is REQUIRED)
  variation(flagName: string, fallbackValue: string, forceRealtime?: boolean): string; // Variant name only
  boolVariation(flagName: string, fallbackValue: boolean, forceRealtime?: boolean): boolean;
  stringVariation(flagName: string, fallbackValue: string, forceRealtime?: boolean): string;
  numberVariation(flagName: string, fallbackValue: number, forceRealtime?: boolean): number; // JS/TS only
  jsonVariation<T>(flagName: string, fallbackValue: T, forceRealtime?: boolean): T;

  // Variation Details - Returns detailed result with reason (fallbackValue is REQUIRED)
  boolVariationDetails(flagName: string, fallbackValue: boolean, forceRealtime?: boolean): VariationResult<boolean>;
  stringVariationDetails(flagName: string, fallbackValue: string, forceRealtime?: boolean): VariationResult<string>;
  numberVariationDetails(flagName: string, fallbackValue: number, forceRealtime?: boolean): VariationResult<number>;
  jsonVariationDetails<T>(flagName: string, fallbackValue: T, forceRealtime?: boolean): VariationResult<T>;

  // Strict Variations - Throws GatrixFeatureError on not found/disabled/invalid
  boolVariationOrThrow(flagName: string, forceRealtime?: boolean): boolean;
  stringVariationOrThrow(flagName: string, forceRealtime?: boolean): string;
  numberVariationOrThrow(flagName: string, forceRealtime?: boolean): number;
  jsonVariationOrThrow<T>(flagName: string, forceRealtime?: boolean): T;

  // Explicit Sync Mode
  isExplicitSyncEnabled(): boolean;
  setExplicitSyncMode(enabled: boolean): void; // Change mode at runtime
  hasPendingSyncFlags(): boolean;
  syncFlags(fetchNow?: boolean): Promise<void>;

  // Watch (Change Detection) - Returns FlagProxy for convenience
  watchFlag(
    flagName: string,
    callback: (flag: FlagProxy) => void | Promise<void>,
    name?: string
  ): () => void;
  watchFlagWithInitialState(
    flagName: string,
    callback: (flag: FlagProxy) => void | Promise<void>,
    name?: string
  ): () => void;
  createWatchFlagGroup(name: string): WatchFlagGroup;

  // Event Tracking (future implementation)
  track(eventName: string, ...eventArgs: any[]): void;

  // Statistics (Debugging & Monitoring)
  getStats(): GatrixSdkStats;
}
```

> [!IMPORTANT]
> **`numberVariation` availability**: JS/TS SDKs retain `numberVariation` because TypeScript's `number` type covers both integers and floats. All other SDKs (C++, C#, GDScript, Dart, Python) MUST use type-specific functions instead: `intVariation` + `floatVariation` (or `doubleVariation`).

### Variation Metric Requirements

Every flag access method (`isEnabled`, `variation`, `boolVariation`, etc.) MUST track the following metrics:
- **Impression**: If the flag being accessed has `impressionData` enabled, an impression event must be sent.
- **Missing**: If the requested `flagName` does not exist in the SDK's local cache, a `missing` metric MUST be recorded (visible in `SdkStats.missingFlags`).
- **Access Counts**: Successful flag evaluations should increment internal access counters (`flagEnabledCounts`, `flagVariantCounts`).

These requirements ensure consistent observability across all SDKs.

### SDK Statistics

The `getStats()` method returns comprehensive SDK statistics for debugging and monitoring:

```typescript
interface SdkStats {
  // Counts
  totalFlagCount: number; // Total flags in cache
  fetchFlagsCount: number; // Number of fetchFlags calls
  updateCount: number; // Successful updates (flag data changed)
  notModifiedCount: number; // 304 Not Modified responses
  errorCount: number; // Total fetch errors
  recoveryCount: number; // Recoveries from error state
  impressionCount: number; // Impression events sent
  contextChangeCount: number; // Context change count
  syncFlagsCount: number; // syncFlags calls
  metricsSentCount: number; // Metrics payloads successfully sent
  metricsErrorCount: number; // Metrics send errors

  // Timestamps
  startTime: Date | null; // SDK start time (set when start() is called)
  lastFetchTime: Date | null; // Last fetch attempt
  lastUpdateTime: Date | null; // Last successful update
  lastErrorTime: Date | null; // Last error occurrence
  lastRecoveryTime: Date | null; // Last recovery from error

  // State
  sdkState: SdkState; // 'initializing' | 'ready' | 'healthy' | 'error'
  connectionId: string; // Unique connection ID (UUID)
  etag: string | null; // Current ETag
  offlineMode: boolean; // Offline mode status
  lastError: Error | null; // Last error object
  missingFlags: Record<string, number>; // Missing flag access counts

  // Per-flag data
  flagEnabledCounts: Record<string, { yes: number; no: number }>;
  flagVariantCounts: Record<string, Record<string, number>>;
  flagLastChangedTimes: Record<string, Date>; // Per-flag last change time
  activeWatchGroups: string[]; // Active watch group names

  // Event Handler Monitoring
  eventHandlerStats: Record<string, EventHandlerStats[]>; // eventName -> handlers
}

interface EventHandlerStats {
  name: string; // User-provided name or auto-generated
  callCount: number; // Total number of times this handler was called
  isOnce: boolean; // Whether the handler is registered with once()
  registeredAt: Date; // Timestamp of registration
}
```

### API Call Frequency Guide

Understanding which methods can be called frequently is important for performance:

**Safe for Hot Paths (call frequently):**

- `isEnabled()`, `boolVariation()`, `stringVariation()`, `numberVariation()`, `jsonVariation()`
- `*VariationDetails()`, `*VariationOrThrow()`
- `getVariant()`, `getAllFlags()`, `getContext()`

These methods read from in-memory cache and are safe to call in render loops, event handlers, or any hot code path.

**Moderate Frequency:**

- `watchFlag()`, `watchFlagWithInitialState()` - Register once, no need to call repeatedly

**Infrequent / Setup Only:**

- `start()`, `stop()` - Call once per app lifecycle
- `updateContext()`, `syncFlags()` - Triggers network request, debounce if calling from user input
- `fetchFlags()` - Manual refresh, avoid calling in loops

> [!CAUTION]
> **Context Update Performance**: Client-side SDKs use **remote evaluation only** (flags are evaluated on the server, not locally). This means every `updateContext()` call requires a network request to get re-evaluated flags. Avoid putting frequently changing values (timestamps, counters, animation frames) in context. For time-based targeting, use the server-side `currentTime` context field which is evaluated on the server without client-side updates.

> [!TIP]
> Flag evaluation methods are purely in-memory operations. The SDK automatically fetches flags on `start()` and periodically using configurable `fetchInterval`.

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

### Custom Storage Provider

You can implement your own storage provider for different use cases (e.g., Redis, IndexedDB, or custom backend storage):

```typescript
// Example: Redis Storage Provider for Node.js
class RedisStorageProvider implements IStorageProvider {
  private client: RedisClient;

  constructor(client: RedisClient) {
    this.client = client;
  }

  async get(key: string): Promise<any> {
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async save(key: string, value: any): Promise<void> {
    await this.client.set(key, JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }
}

// Usage
const client = new GatrixClient({
  apiUrl: 'https://edge.your-api.com/api/v1',
  apiToken: 'your-token',
  appName: 'my-app',
  environment: 'production',
  storageProvider: new RedisStorageProvider(redisClient),
});
```

## Variation Functions

All variation functions:

- Use the global context (no context parameter needed)
- Return the default value if flag not found or disabled
- Count metrics for the flag access

### Why Default Values Are Required

All variation methods require an explicit default value parameter. This is a deliberate design decision:

1. **Prevents Ambiguity:** When a flag doesn't exist or has no value, the SDK returns your specified default?봭ot `undefined` or `null`.
2. **Type Safety:** The default value establishes the expected return type.
3. **Fail-Safe Behavior:** Your application always receives a usable value, even during network failures or SDK initialization.
4. **Explicit Intent:** Forces developers to consider the fallback scenario, reducing bugs.

| Function           | Return Type | Description                    |
| ------------------ | ----------- | ------------------------------ |
| `variation`        | string      | Variant name only              |
| `boolVariation`    | boolean     | Boolean variant value (`variant.value`). Strict: `valueType` must be `boolean`. |
| `stringVariation`  | string      | Variant value as string. Strict: `valueType` must be `string`. |
| `numberVariation`  | number      | Variant value as number (JS/TS only). Strict: `valueType` must be `number`. |
| `intVariation`     | int         | Variant value as integer (non-JS SDKs). Strict: `valueType` must be `number`. |
| `floatVariation`   | float/double | Variant value as float (non-JS SDKs). Strict: `valueType` must be `number`. |
| `jsonVariation<T>` | T           | Variant value parsed as JSON. Strict: `valueType` must be `json`. |

### VariationResult Interface

```typescript
interface VariationResult<T> {
  value: T; // The evaluated value
  reason: string; // Evaluation reason
  flagExists: boolean; // Whether flag exists
  enabled: boolean; // Flag enabled state
}
```

### Reserved Variant Names

The following variant names are system-reserved and use a `$` prefix:

| Name | Meaning |
|------|---------|
| `$missing` | Flag does not exist in cache |
| `$disabled` | Flag is disabled |
| `$config` | Flag uses configuration value |

SDKs MUST NOT allow user-defined variant names starting with `$`.

### VariationInternal Pattern

All SDKs MUST implement the `variationInternal` pattern for centralized flag logic:

**Architecture:**
- `FeaturesClient` contains `*VariationInternal()` methods that handle **all** logic: flag lookup + value extraction + metrics tracking.
- Public variation methods (e.g., `boolVariation`) simply delegate to the internal methods.
- `FlagProxy` is a **convenience shell** that delegates all variation calls back to `FeaturesClient`'s internal methods.
- All internal methods accept an optional `forceRealtime` parameter (default: `false`). When `true`, the method reads from `realtimeFlags` directly, bypassing `selectFlags()` logic.

```typescript
// VariationProvider interface (separate file to avoid circular deps)
interface VariationProvider {
  isEnabledInternal(flagName: string, forceRealtime?: boolean): boolean;
  getVariantInternal(flagName: string, forceRealtime?: boolean): Variant;
  variationInternal(flagName: string, fallbackValue: string, forceRealtime?: boolean): string;
  boolVariationInternal(flagName: string, fallbackValue: boolean, forceRealtime?: boolean): boolean;
  stringVariationInternal(flagName: string, fallbackValue: string, forceRealtime?: boolean): string;
  numberVariationInternal(flagName: string, fallbackValue: number, forceRealtime?: boolean): number;
  jsonVariationInternal<T>(flagName: string, fallbackValue: T, forceRealtime?: boolean): T;
  // ... Details and OrThrow variants follow the same pattern
}

// FeaturesClient implements VariationProvider
class FeaturesClient implements VariationProvider {
  // Internal: does flag lookup + value extraction + metrics tracking
  boolVariationInternal(flagName: string, fallbackValue: boolean): boolean {
    const flag = this.lookupFlag(flagName);
    if (!flag) {
      this.trackFlagAccess(flagName, undefined, 'getVariant');
      return fallbackValue;
    }
    this.trackFlagAccess(flagName, flag, 'getVariant', flag.variant.name);
    if (flag.valueType !== 'boolean') return fallbackValue;
    return Boolean(flag.variant.value);
  }

  // Public: delegates to internal
  boolVariation(flagName: string, fallbackValue: boolean): boolean {
    return this.boolVariationInternal(flagName, fallbackValue);
  }
}
```

### FlagProxy Class

FlagProxy is a **convenience shell** that delegates all variation logic to `FeaturesClient`.

**Architecture:**
- Uses **null object pattern**: `this.flag` is never null/undefined. A `MISSING_FLAG` sentinel is used for non-existent flags.
- Holds a reference to `VariationProvider` (interface, not `FeaturesClient` directly) to avoid circular dependencies.
- All variation methods delegate to `VariationProvider`'s internal methods.
- Read-only property accessors (`variant`, `valueType`, `version`, etc.) access flag data directly.
- **No `onAccess` callback** ??metrics tracking is handled entirely by the internal methods.
- **Strict type checking**: All variation methods validate `valueType` to prevent misuse.

> [!WARNING]
> **GC and Circular Reference Considerations**: FlagProxy holds a reference to VariationProvider (FeaturesClient). In languages with reference counting GC (C++, Swift), use weak pointers/references. In managed languages (JS, C#, Dart, Python) with mark-and-sweep GC, cycles are handled automatically. FlagProxy instances are typically short-lived (created for one-shot variation calls and immediately discarded).

> [!IMPORTANT]
> **FlagProxy.client is ALWAYS non-null**: FlagProxy is exclusively created by `FeaturesClient` (via `getFlag()`, `watchFlag()`, etc.) and always receives the creating client as its `VariationProvider`. SDK implementations MUST NOT add null/undefined checks for the `client` parameter inside FlagProxy methods. The `client` constructor parameter is non-optional and guaranteed to be a valid `VariationProvider` instance. Adding unnecessary null checks creates misleading code that suggests FlagProxy can function without a client, which is architecturally incorrect.

**`boolVariation` behavior:**
- Checks `valueType === 'boolean'` strictly.
- Returns `Boolean(variant.value)`, NOT `flag.enabled`.
- `flag.enabled` is purely the flag's on/off state; `boolVariation` extracts the actual boolean value from the variant.

```typescript
class FlagProxy {
  constructor(
    flag: EvaluatedFlag | undefined,
    client: VariationProvider, // Replaces onAccess callback
    flagName?: string
  );

  // Read-only property accessors
  get exists(): boolean;
  get enabled(): boolean; // Delegates to client.isEnabledInternal()
  get name(): string;
  get variant(): Variant; // Never null/undefined
  get valueType(): ValueType;
  get version(): number;
  get reason(): string | undefined;
  get impressionData(): boolean;
  get raw(): EvaluatedFlag | undefined;

  // All variation methods delegate to VariationProvider
  variation(fallbackValue: string): string;
  boolVariation(fallbackValue: boolean): boolean;
  stringVariation(fallbackValue: string): string;
  numberVariation(fallbackValue: number): number; // JS/TS only
  jsonVariation<T>(fallbackValue: T): T;

  // Variation details
  boolVariationDetails(fallbackValue: boolean): VariationResult<boolean>;
  stringVariationDetails(fallbackValue: string): VariationResult<string>;
  numberVariationDetails(fallbackValue: number): VariationResult<number>;
  jsonVariationDetails<T>(fallbackValue: T): VariationResult<T>;

  // Strict variations
  boolVariationOrThrow(): boolean;
  stringVariationOrThrow(): string;
  numberVariationOrThrow(): number;
  jsonVariationOrThrow<T>(): T;
}
```

#### FlagProxy Variation Logic Summary

| Method | valueType Check | Value Source | Fallback |
|--------|----------------|--------------|----------|
| `enabled` | none | `flag.enabled` | `false` |
| `variation` | none | `variant.name` | fallbackValue |
| `boolVariation` | `boolean` | `Boolean(variant.value)` | fallbackValue |
| `stringVariation` | `string` | `String(variant.value)` | fallbackValue |
| `numberVariation` | `number` | `Number(variant.value)` | fallbackValue |
| `intVariation` | `number` | `int(variant.value)` | fallbackValue |
| `floatVariation` | `number` | `float(variant.value)` | fallbackValue |
| `jsonVariation` | `json` + object check | `variant.value` | fallbackValue |

> [!IMPORTANT]
> **`boolVariation` ??`isEnabled`**: `isEnabled()` returns `flag.enabled`, while `boolVariation()` returns the boolean *value* from `variant.value`. These serve different purposes:
> - `isEnabled()`: Is the feature flag turned on?
> - `boolVariation()`: What boolean value did the flag evaluate to?

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
group.watchFlag('flag-1', handler1).watchFlag('flag-2', handler2);

// Later, unsubscribe all at once
group.unwatchAll();
```

## Explicit Sync Mode

When `explicitSyncMode: true`:

1. Flags are fetched in the background (forceRealtime store)
2. Application reads from synchronized store
3. Call `syncFlags()` at safe points to apply changes
4. When `pendingSync` transitions from `false` to `true`, the SDK emits `flags.pending_sync` event
5. Flag access methods accept an optional `forceRealtime` parameter to bypass sync and read directly from forceRealtime store

### Runtime Mode Switching

`setExplicitSyncMode(enabled)` allows changing the sync mode at runtime:

- **Enabling** (`false ??true`): Current `realtimeFlags` are copied to `synchronizedFlags`, `pendingSync` is set to `false`. Subsequent fetches will buffer changes.
- **Disabling** (`true ??false`): `synchronizedFlags` are updated to match `realtimeFlags`, `pendingSync` is set to `false`. All reads immediately return forceRealtime values.

### forceRealtime Parameter

All flag access methods (`isEnabled`, `*Variation`, `getVariant`, etc.) accept an optional `forceRealtime` parameter (default: `false`):

- When `forceRealtime: false` (default): Returns values from `synchronizedFlags` if `explicitSyncMode` is enabled, otherwise from `realtimeFlags`.
- When `forceRealtime: true`: Always returns values from `realtimeFlags`, regardless of `explicitSyncMode` setting.

This is useful for:
- Debug/monitoring UIs that need to show the latest server values
- Dashboards displaying real-time flag status alongside the app's synchronized state

```typescript
// Enable explicit sync mode
const client = new GatrixClient({
  url: 'https://edge.gatrix.com/api/v1',
  apiKey: 'client-key',
  appName: 'my-app',
  explicitSyncMode: true,
});

// Read from synchronized store (default)
const enabled = client.isEnabled('my-feature');

// Read from forceRealtime store (bypass sync)
const realtimeEnabled = client.isEnabled('my-feature', true);

// Listen for pending sync availability
client.on('flags.pending_sync', () => {
  console.log('New flag values available, call syncFlags() to apply');
});

// Apply pending changes at safe point (e.g., scene transition)
await client.syncFlags();

// Switch to non-explicit mode at runtime
client.features.setExplicitSyncMode(false);
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

## Events

SDK emits the following events that you can subscribe to:

| `flags.init`          | `EVENTS.FLAGS_INIT`    | SDK initialized (from storage/bootstrap)             | -                                                   |
| `flags.ready`         | `EVENTS.FLAGS_READY`   | First successful fetch completed                     | -                                                   |
| `flags.fetch`         | `EVENTS.FLAGS_FETCH`   | Started fetching flags from server                   | `{ etag: string \| null }`                          |
| `flags.fetch_start`   | `EVENTS.FLAGS_FETCH_START` | Started fetching flags from server (alias for fetch) | `{ etag: string \| null }`                          |
| `flags.fetch_success` | `EVENTS.FLAGS_FETCH_SUCCESS` | Successfully fetched flags from server               | -                                                   |
| `flags.fetch_error`   | `EVENTS.FLAGS_FETCH_ERROR` | Error occurred during fetching                       | `{ status?: number, error?: Error }`                |
| `flags.fetch_end`     | `EVENTS.FLAGS_FETCH_END` | Completed fetching flags (success or error)          | -                                                   |
| `flags.change`        | `EVENTS.FLAGS_CHANGE`  | Flags changed from server                            | `{ flags: EvaluatedFlag[] }`                        |
| `flags.{name}.change` | -                      | Individual flag changed                              | `(newFlag: EvaluatedFlag, oldFlag?: EvaluatedFlag)` |
| `flags.error`         | `EVENTS.SDK_ERROR`     | General error occurred                               | `{ type: string, message: string }`                 |
| `flags.recovered`     | `EVENTS.FLAGS_RECOVERED` | SDK recovered from error state                       | -                                                   |
| `flags.sync`          | `EVENTS.FLAGS_SYNC`    | Flags synchronized (explicitSyncMode)                | -                                                   |
| `flags.pending_sync`  | `EVENTS.FLAGS_PENDING_SYNC` | Pending sync flags available (explicitSyncMode)     | -                                                   |
| `flags.impression`    | `EVENTS.FLAGS_IMPRESSION` | Flag accessed (if impressionData enabled)            | `{ featureName, enabled, variant, ... }`            |

### Event Subscription

```typescript
// Subscribe to specific event
client.on(EVENTS.READY, () => {
  console.log('SDK is ready');
});

// Subscribe to ALL events at once (useful for debugging)
client.onAny((eventName, data) => {
  console.log(`Event: ${eventName}`, data);
});

// Unsubscribe
client.off(EVENTS.READY, myCallback);
client.offAny(myAnyCallback);
```

## Metrics

When metrics enabled, SDK tracks:

- Flag access counts (enabled: yes/no)
- Variant selections
- Impression events (if impressionData enabled)
- **notFound events** (when accessing non-existent flags)

Metrics are batched and sent periodically to the Edge API.

## Fetch Method Support

All SDKs MUST support both **GET** and **POST** HTTP methods for flag evaluation requests:

### GET (default)

- Context fields are sent as query parameters
- Suitable for small context payloads
- Endpoint: `GET /client/features/{environment}/eval?userId=xxx&sessionId=yyy`

### POST

- Context fields are sent in the request body as JSON
- Required when context contains large or complex data (e.g., many properties)
- Endpoint: `POST /client/features/{environment}/eval`
- Body: `{ "userId": "xxx", "sessionId": "yyy", "properties": { ... } }`

SDKs SHOULD default to GET and provide a configuration option to switch to POST.

## Event Tracking (track)

All SDKs MUST provide a `track()` method for sending custom events to the analytics system.

```typescript
// Signature
track(eventName: string, ...eventArgs: any[]): void;
```

> [!NOTE]
> The `track()` method is currently a stub (no-op). Implementation will be added in a future release. The interface is defined now to ensure consistent API surface across all SDKs.

## Design Rules

> [!IMPORTANT]
> **getVariant never returns null/undefined** - Always returns a fallback variant (`{ name: '$missing', enabled: false }`) when flag not found.

- All variation functions return default values for disabled/not-found flags
- `*VariationOrThrow` methods throw for strict checking scenarios
- Context updates trigger automatic re-fetch of flags
- SessionId is automatically generated if not provided
- `deviceId` is NOT a standard context field ??SDKs MUST NOT include it automatically

## Error Handling

SDK should be resilient:

- Graceful degradation with cached/bootstrap flags
- Exponential backoff on fetch failures
- Error events emitted, not thrown

### Polling Resilience

> [!IMPORTANT]
> **Polling MUST continue after errors.** When `fetchFlags()` fails (network error, HTTP error, etc.), the SDK MUST schedule the next refresh. Polling must never stop permanently due to errors. The SDK relies on fetch retry (via HTTP client like `ky`) for individual request retries, and uses `scheduleNextRefresh()` to maintain the polling loop regardless of success or failure.

Error path behavior:
1. **HTTP errors (4xx/5xx):** Call `handleFetchError()`, emit error events, then `scheduleNextRefresh()`
2. **Network errors (fetch exception):** Set `sdkState` to `error`, increment `errorCount`, emit error events, then `scheduleNextRefresh()`
3. **Abort errors:** Ignore (intentional cancellation)

### Cache-Based Ready State

> [!IMPORTANT]
> **Cached flags trigger ready state.** During `init()`, if cached flags are loaded from storage and the list is non-empty, the SDK MUST call `setReady()` immediately. This enables offline-first behavior where the application can start rendering flags from cache before the first network request completes.

Ready state flow:
1. `init()`: Load cached flags from storage ??if non-empty, call `setReady()`
2. `init()`: Load bootstrap flags ??if present, call `setReady()` (may override cached)
3. `start()`: First successful `fetchFlags()` ??call `setReady()` if not already called

### SDK State Reporting

> [!IMPORTANT]
> **Statistics must reflect actual state.** `GatrixClient.getStats()` MUST use actual values from `FeaturesClient`, not computed proxies:
> - `sdkState`: Use `FeaturesClient._sdkState` directly (not derived from `getError()`)
> - `errorCount`: Use `FeaturesClient._errorCount` (not `metricsErrorCount`)
> - `startTime`: Use `FeaturesClient._startTime` (not `lastFetchTime`)
> - `lastError`: Use `FeaturesClient._lastError` directly
> - `lastErrorTime`: Use `FeaturesClient._lastErrorTime` directly

### Error Recovery

When the SDK transitions from `error` state to a successful fetch:
1. Set `sdkState` to `healthy`
2. Increment `recoveryCount`
3. Set `lastRecoveryTime`
4. Emit `flags.recovered` event

## Implementation Checklist (gatrix-js-client-sdk)

- [x] Core GatrixClient class with event emitter
- [x] Configuration validation
- [x] Repository pattern with storage providers
- [x] Polling mechanism with backoff
- [x] Context management (global)
- [x] Explicit sync mode (isExplicitSyncEnabled, hasPendingSyncFlags)
- [x] Watch pattern for change detection (watchFlag, WatchFlagGroup)
- [x] Variation functions (bool, string, number, json)
- [x] Variation details and OrThrow variants
- [x] FlagProxy convenience shell (delegates to VariationProvider)
- [x] VariationInternal pattern (centralized flag logic)
- [x] Metrics collection with notFound tracking
- [x] TypeScript types and exports
- [x] Browser build (ES modules + CJS + UMD)
- [ ] track() event tracking
- [ ] GET/POST method support
