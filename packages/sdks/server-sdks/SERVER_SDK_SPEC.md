# Gatrix Server SDK Specification

This document defines the core architecture, API, and behavior for all Gatrix Server SDKs. As the baseline for all server-side implementations (Node.js, .NET, Java, Go, etc.), this specification MUST be strictly adhered to. It is designed to be as rigorous and strict as the Client SDK Specification.

## Scope and Core Differences from Client SDKs

> [!IMPORTANT]
> Server SDKs operate in a fundamentally different environment than Client SDKs.
> 
> - **Multi-User Environment:** A Server SDK instance serves thousands of requests simultaneously for many different users. Therefore, Context (UserId, SessionId, properties, etc.) MUST be passed **per-evaluation**, not stored globally on the client instance.
> - **Local Evaluation:** Instead of calling the Edge API for each user's evaluated feature flags, Server SDKs fetch **all flag definitions, rules, and segments**, cache them locally in memory, and perform the evaluation locally using an embedded rule engine. This ensures **zero network latency** during flag evaluation.
> - **Multi-Service Architecture:** Like Client SDKs, the Server SDK is a unified platform handling Feature Flags, Game Worlds, Popups, Surveys, Service Discovery, and Maintenance.

## Terminology

> [!CAUTION]
> Gatrix uses the term **"flag"** (or **"feature flag"**) — never **"toggle"** or **"feature toggle"**.
> All SDK code, APIs, metrics payloads, documentation, and comments MUST use `flag`/`flags` consistently.

## SDK Naming Convention

All server SDK names **MUST** include both `gatrix` and `server` in their identifier.

### Folder Name

Pattern: `gatrix-{platform}-server-sdk`

| Platform | Folder Name |
|----------|-------------|
| Node.js | `server-sdk` (legacy) or `gatrix-node-server-sdk` |
| .NET | `gatrix-dotnet-server-sdk` |
| Java | `gatrix-java-server-sdk` |
| Go | `gatrix-go-server-sdk` |

### Package / Module Name

| Platform | Package Name |
|----------|-------------|
| Node.js | `@gatrix/server-sdk` |
| .NET | `Gatrix.Server.Sdk` |
| Java | `com.gatrix.server.sdk` |
| Go | `github.com/gatrix/gatrix-go-server-sdk` |

## Core Concepts

### 1. Local Evaluation & Definition Caching

For the Feature Flag service, Server SDKs:
- Fetch raw **flag definitions and segments** (from `GET /api/v1/server/:environment/features`).
- Periodically poll or listen for invalidation events to update these definitions.
- Store definitions and segments locally in an optimized in-memory cache (e.g., `Dictionary` or `Map`).
- Evaluate flags completely locally using a shared evaluation engine (such as porting or wrapping `@gatrix/shared`'s `FeatureFlagEvaluator`).
- Buffer usage metrics locally and flush them periodically to the Gatrix Edge API to avoid network spam.
- **Unlike Client SDKs, Server SDKs DO NOT have `synced` vs `realtime` flag concepts or `explicitSyncMode`.** Every flag evaluation is implicitly realtime, using the absolute latest definitions from the in-memory cache. Mid-session consistency is handled by passing identical contexts across stateless requests.

### 2. Service-Namespaced Access

To maintain a clean and scalable API, **all service-specific operations MUST be accessed through their dedicated sub-service** — never directly on the main root `GatrixServerSdk` object.

| ❌ Wrong | ✅ Correct |
|----------|-----------|
| `sdk.isEnabled("flag", context)` | `sdk.featureFlag.isEnabled("flag", context)` |
| `sdk.getGameWorld("world-1")` | `sdk.gameWorld.fetchById("world-1")` |

**Required Services:**
- `coupon`
- `gameWorld`
- `popupNotice`
- `survey`
- `whitelist`
- `serviceMaintenance`
- `storeProduct`
- `featureFlag`
- `serviceDiscovery`
- `impactMetrics`

### 3. Unified Lifecycle: Single `initialize()`

Equivalent to the Client SDK's `start()`, Server SDKs use a single initialization method to bootstrap caches and connections.

```typescript
const sdk = new GatrixServerSDK(config);
await sdk.initialize();
```

### 4. Cache Management and Refresh Strategies

Server SDKs MUST implement a unified `CacheManager` with three distinct modes for refreshing Definitions:

| Method | Description |
|--------|-------------|
| `polling` (Default)| Periodically fetches data from the API based on a configured `ttl`. No Redis required. |
| `event` | Connects to Gatrix Redis via Pub/Sub. When Gatrix backend publishes a change event, the cache is instantly refreshed. `ttl` interval is ignored. |
| `manual` | No background activity. Developer manually calls `refreshCache()`. |

**Resiliency Requirement:**
If the Gatrix Backend becomes unreachable during polling or event synchronization, the SDK MUST gracefully degrade and continue serving the last known good state from the in-memory cache. Initialization MUST NOT crash the host application unless strictly designed to do so; it should log an error and retry in the background.

### 5. Redis Pub/Sub Event System

When `cache.refreshMethod` is `"event"`, the SDK subscribes to a Redis Pub/Sub channel for real-time cache invalidation.

**Channel:** `gatrix-sdk-events`

**Event Format:**
```json
{
  "type": "gameworld.updated",
  "data": {
    "id": 42,
    "environment": "production",
    "isVisible": 1
  }
}
```

> **MySQL TINYINT(1):** `isVisible` and `isActive` may come as `0`/`1` instead of `false`/`true`. SDKs MUST handle this coercion.

#### Standard Event Types

| Event Type | Service | Action |
|-----------|---------|--------|
| `gameworld.created/updated` | GameWorld | Refresh game worlds for the event's environment |
| `gameworld.deleted` | GameWorld | Remove from cache |
| `gameworld.order_changed` | GameWorld | Full refresh (order affects sorting) |
| `popup.created/updated/deleted` | PopupNotice | Refresh popup notices |
| `survey.created/updated/deleted` | Survey | Refresh surveys |
| `survey.settings.updated` | Survey | Refresh survey settings |
| `whitelist.updated` | Whitelist | Refresh whitelist |
| `maintenance.settings.updated` | ServiceMaintenance | Refresh maintenance status |
| `store_product.created/updated/deleted` | StoreProduct | Refresh store products |
| `store_product.bulk_updated` | StoreProduct | Full refresh |
| `feature_flag.changed/created/updated/deleted` | FeatureFlag | Refresh feature flag definitions |
| `segment.created/updated/deleted` | FeatureFlag | Refresh ALL feature flags (segments are global) |
| `client_version.created/updated/deleted` | ClientVersion | Update/remove from cache |
| `banner.created/updated/deleted` | Banner | Update/remove from cache |
| `service_notice.created/updated/deleted` | ServiceNotice | Update/remove from cache |

#### Processing Rules

1. **Feature gate check:** Before processing, check if the relevant feature is enabled in `FeaturesOptions`. Skip silently if disabled.
2. **Environment required:** All events include `data.environment`. If missing, log a warning and skip.
3. **Reconnection:** On Redis reconnection, refresh ALL caches immediately to recover missed events.
4. **Fallback:** If Redis connection fails during initialization, fall back to polling mode.

#### User Event Subscription

SDKs MUST support user-registered callbacks via an `On(eventType, callback)` / `Off(eventType, callback)` API.
Wildcard `"*"` subscribes to all events. Callbacks receive an `SdkEvent` object `{ type, data, timestamp }`.

## API Response Format (Feature Flags)

The Server API returns flag **definitions**, not evaluated results.
The evaluator must resolve segment references locally using the cached `segments`.

### Flag Definition (from `@gatrix/shared`)

```typescript
interface FeatureFlag {
  id: string;
  name: string;
  isEnabled: boolean;
  strategies: FeatureStrategy[];  // Targeting rules (segments → constraints → rollout)
  variants: Variant[];            // Weighted variant list
  valueType?: 'string' | 'number' | 'boolean' | 'json';
  enabledValue?: any;             // Value when enabled (no strategy match)
  disabledValue?: any;            // Value when disabled
  valueSource?: 'environment' | 'flag';
}

interface FeatureStrategy {
  name: string;
  parameters?: { rollout?: number; stickiness?: string; groupId?: string; };
  constraints?: Constraint[];
  segments?: string[];  // Segment name references
  isEnabled: boolean;
}

interface Constraint {
  contextName: string;
  operator: ConstraintOperator;  // str_eq, num_gt, semver_gte, arr_any, etc.
  value?: string;
  values?: string[];
  caseInsensitive?: boolean;
  inverted?: boolean;
}
```

### Evaluation Order (per strategy)
1. **Segments** — All referenced segment constraints MUST pass
2. **Constraints** — All strategy-level constraints MUST pass  
3. **Rollout** — MurmurHash3-based sticky percentage check

## Feature Flag Service API

### Core Methods

All methods follow this parameter order convention:
- **Required:** `flagName`, `fallback` (where applicable)
- **Optional:** `context?`, `environment?` (both can be omitted)

When `environment` is omitted, single-environment mode uses the configured default.
In multi-environment mode (Edge server), `environment` should be specified explicitly.

```csharp
// Core Evaluation
EvaluationResult Evaluate(string flagName, EvaluationContext? context = null, string? environment = null);
bool IsEnabled(string flagName, bool fallback, EvaluationContext? context = null, string? environment = null);

// Variant Name (returns matched variant name, not the value)
string Variation(string flagName, string fallback = "", EvaluationContext? context = null, string? environment = null);

// Typed Variations (returns the variant VALUE converted to the specified type)
// IMPORTANT: BoolVariation returns the variant's VALUE parsed as bool, NOT the flag's enabled state.
//            Use IsEnabled() for the flag's enabled state.
string StringVariation(string flagName, string fallback, EvaluationContext? context = null, string? environment = null);
int    IntVariation(string flagName, int fallback, EvaluationContext? context = null, string? environment = null);
long   LongVariation(string flagName, long fallback, EvaluationContext? context = null, string? environment = null);
float  FloatVariation(string flagName, float fallback, EvaluationContext? context = null, string? environment = null);
double DoubleVariation(string flagName, double fallback, EvaluationContext? context = null, string? environment = null);
bool   BoolVariation(string flagName, bool fallback, EvaluationContext? context = null, string? environment = null);
T?     JsonVariation<T>(string flagName, T? fallback = default, EvaluationContext? context = null, string? environment = null);

// *Details — returns value + evaluation metadata (reason, variant name)
EvaluationDetail<string> StringVariationDetails(string flagName, string fallback, EvaluationContext? context = null, string? environment = null);
EvaluationDetail<int>    IntVariationDetails(string flagName, int fallback, EvaluationContext? context = null, string? environment = null);
// ... (all types follow the same pattern)

// *OrThrow — throws FeatureFlagException if flag not found or no value
string StringVariationOrThrow(string flagName, EvaluationContext? context = null, string? environment = null);
int    IntVariationOrThrow(string flagName, EvaluationContext? context = null, string? environment = null);
// ... (all types follow the same pattern)
```

> **CRITICAL:** `BoolVariation` parses the variant's string value as a boolean (`"true"`/`"false"`, `"1"`/`"0"`).
> It does **NOT** return the flag's enabled state. Use `IsEnabled()` for the flag state.


## SDK Configuration Definition

The configuration model MUST strictly mirror this interface:

```typescript
interface GatrixSDKConfig {
  // Required Authentication and Identity
  apiUrl: string;  // Gatrix backend URL (e.g., https://api.gatrix.com)
  apiToken: string;
  applicationName: string;
  service: string;
  group: string;
  environment: string; // Environment identifier, or "*" for multi-env Edge server
  
  // Optional specific identifiers
  worldId?: string;

  // External event bus for realtime cache invalidation
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };

  cache?: {
    enabled: boolean;
    ttl: number; // default: 300
    refreshMethod: 'polling' | 'event' | 'manual'; // default: 'polling'
  };

  logger?: {
    level: 'debug' | 'info' | 'warn' | 'error';
  };

  retry?: {
    enabled: boolean;
    maxRetries: number;
    retryDelay: number;
    retryDelayMultiplier: number; // default: 2
    maxRetryDelay: number; // default: 10000
    retryableStatusCodes: number[]; // default: [408, 429, 500, 502, 503, 504]
  };

  metrics?: {
    enabled: boolean;
    serverEnabled?: boolean;
    port?: number;
  };
}
```

## Resilience, Retry, and Backoff Behavior

All outgoing HTTP requests (except long-polling or Redis connections) MUST implement exponential backoff:
1. **Initial Backoff:** Configurable (default: 2000ms).
2. **Multiplier:** Default 2x.
3. **Max Retries:** Default 10.
4. **Retryable Status Codes:** 408, 429, 500, 502, 503, 504.
5. Non-retryable HTTP codes (e.g., 401, 403, 404) MUST skip the retry loop and fail immediately.

## HTTP Headers

All Server SDKs MUST include the following standard headers on every HTTP request. This ensures consistent authentication, identification, and traceability.

| Header | Value | Description |
|--------|-------|-------------|
| `X-API-Token` | `{apiToken}` | Server API Token for authentication |
| `X-Application-Name` | `{appName}` | Application name from config |
| `X-SDK-Version` | `{sdkName}/{version}` | e.g., `gatrix-dotnet-server-sdk/1.0.0` |
| `X-Environment` | `{environment}` | The target environment (or `*` for Edge modes) |
| `Content-Type` | `application/json` | Required for POST/PUT requests |

## Metrics & Telemetry

### 1. Internal SDK Metrics (Prometheus)
The SDK MUST collect internal usage metrics and expose them on a Prometheus-compatible endpoint (e.g., `http://0.0.0.0:9337/metrics`). All internal metrics MUST be prefixed with `gatrix_sdk_`.

Must include:
- `gatrix_sdk_http_requests_total`
- `gatrix_sdk_cache_refresh_total` (labels: `service_type`, `status`)
- `gatrix_sdk_flag_evaluations_total` (labels: `flag_name`, `variant`, `reason`)

### 2. Gatrix Flag Analytics (Usage Metrics)
Since evaluations happen locally, the Server SDK MUST buffer evaluation metrics in memory and flush them to the Backend API periodically (default: every 60s). This powers the Gatrix dashboard counters just like Client SDK `sendMetrics`.

### 3. Impact Metrics (Safeguards)
The SDK MUST provide an `impactMetrics` service to record custom application-level metrics that Gatrix uses to evaluate Canary/Rollout safety.
Implementations MUST buffer these in memory and flush them to the Backend API periodically.

```typescript
// Define metrics
sdk.impactMetrics.defineCounter('http_errors', 'Count of HTTP errors');
sdk.impactMetrics.defineHistogram('response_time_ms', 'Response time', [10, 50, 100, 500, 1000]);

// Record metrics during request handling
sdk.impactMetrics.incrementCounter('http_errors');
sdk.impactMetrics.observeHistogram('response_time_ms', 42);
```

## Language-Specific Implementation Idioms

While the architecture is consistent natively, SDKs should embrace their ecosystem's conventions.

### .NET (C#)

The .NET implementation (`gatrix-dotnet-server-sdk`) MUST be built idiomatically for raw C# as well as deep ASP.NET Core integration.

**1. Dependency Injection:**
Must expose `IServiceCollection.AddGatrixServerSdk(Action<GatrixSdkOptions>)`.
Services MUST be registered as Singletons. `HttpClient` MUST be registered via `IHttpClientFactory` to avoid socket exhaustion.

**2. Attribute-Based Feature Gating & Routing:**
ASP.NET Core applications must support advanced ActionFilter attributes that evaluate flags dynamically based on the current Request Context.

- `[FeatureGate("flag-name")]`: Grants access only if the flag evaluates to `true`. If `false`, returns a configurable HTTP Response (e.g., `404 Not Found` or `403 Forbidden`).
    ```csharp
    [FeatureGate("premium-tier")]
    [HttpGet("api/premium/data")]
    public IActionResult GetPremiumData() { ... }
    ```

- `[FeatureMatch("flag-name", "variant-name")]`: Grants access only if the flag evaluates to a specific variant. Useful for A/B testing routing.
    ```csharp
    [FeatureMatch("new-checkout", "v2")]
    [HttpPost("api/checkout")]
    public IActionResult CheckoutV2() { ... }
    ```

- `[FeatureValue("flag-name")]`: Injects a flag's variant value into an action parameter. Falls back to the parameter's default value.
    ```csharp
    [HttpGet("api/config")]
    public IActionResult GetConfig([FeatureValue("ui-theme")] string theme = "default") { ... }
    ```

- `UseGatrixContext()`: Middleware to automatically extract Context (e.g., `UserId` from Claims, `RemoteAddress`) and inject it into the scoped `GatrixAmbientContext`.

**3. Options Pattern:**
Configuration MUST bind to `Microsoft.Extensions.Options.IOptions<GatrixSdkOptions>` allowing configuration from `appsettings.json` and hot-reloading using `IOptionsMonitor`.

**4. Context Extraction:**
The .NET SDK must integrate smoothly with `HttpContext` via scoped `GatrixAmbientContext` to automatically build `EvaluationContext` without requiring developers to manually pass it to every evaluation call.

**5. Logging:**
MUST map precisely to `Microsoft.Extensions.Logging.ILogger<T>`.

### Error Handling Consistency

- Invalid configuration during initialization MUST throw an easily identifiable exception (e.g., `GatrixConfigurationException`).
- Caching/sync failures logic MUST NOT break application runtime loops. All exceptions thrown during background processes (events/polling) MUST be swallowed and logged via the internal Logger.

## Complete Service API Reference

All services below MUST be implemented by every Server SDK. Access is always namespaced:
`sdk.featureFlag.*`, `sdk.gameWorld.*`, etc.

### BaseEnvironmentService Pattern

Most services extend a shared abstract base class (`BaseEnvironmentService<T, TResponse>`) that provides:

| Method | Description |
|--------|-------------|
| `fetchByEnvironment(env)` | Fetch items from API and cache locally |
| `getCached(env)` | Get cached items for a specific environment |
| `updateCache(items, env)` | Replace cache atomically |
| `upsertItemInCache(item, env)` | Update or add a single item in cache |
| `removeFromCache(id, env)` | Remove a single item from cache |
| `clearCache()` | Clear all cached data |

### 1. Feature Flag (`sdk.featureFlag`)

Local evaluation using cached flag definitions. All evaluations accept nullable `EvaluationContext`.

#### Method Categories

| Category | Methods |
|----------|---------|
| **Core** | `Evaluate(flagName, ctx?)`, `IsEnabled(flagName, ctx?, fallback)` |
| **Typed Variations** | `StringVariation`, `IntVariation`, `LongVariation`, `FloatVariation`, `DoubleVariation`, `BoolVariation`, `JsonVariation<T>` |
| **\*Details** | Same as typed variations but returns `EvaluationDetail<T>` with `Value`, `Reason`, `VariantName` |
| **\*OrThrow** | Same as typed variations but throws `FeatureFlagException` if flag not found or value missing |

> **`fallback` is the standard parameter name** for default values. Not `missingValue`, not `defaultValue`.

#### Evaluation Engine

The evaluator MUST be a faithful port of `@gatrix/shared/FeatureFlagEvaluator`. Key elements:

| Element | Description |
|---------|-------------|
| **Strategy evaluation order** | Segments → Constraints → Rollout (first match wins) |
| **Constraint operators** | `str_eq`, `str_contains`, `str_starts_with`, `str_ends_with`, `str_in`, `str_regex`, `num_eq`, `num_gt`, `num_gte`, `num_lt`, `num_lte`, `num_in`, `bool_is`, `date_eq/gt/gte/lt/lte`, `semver_eq/gt/gte/lt/lte/in`, `exists`, `not_exists`, `arr_any`, `arr_all`, `arr_empty` |
| **Modifier flags** | `inverted` (negate result), `caseInsensitive` (string comparison) |
| **Rollout** | MurmurHash3 with stickiness (userId/sessionId/random/custom) |
| **Variant selection** | Weighted distribution via murmurhash percentage |
| **Value coercion** | `getFallbackValue(value, valueType)` ensures type-correct output |

#### Flag Analytics Metrics

SDK MUST buffer flag evaluation metrics and flush periodically (default: 60s).

```
POST /api/v1/client/features/:environment/metrics
{
  appName, sdkVersion,
  bucket: {
    start, stop,
    flags: { flagName: { yes, no, variants: { variantName: count } } },
    missing: { flagName: count }
  }
}
```

### 2. Game World (`sdk.gameWorld`)

| Method | Description |
|--------|-------------|
| `fetchAsync(env)` | Fetch game worlds from API |
| `getAll(env)` | Get cached game worlds (sorted by `displayOrder`) |
| `getByWorldId(worldId, env)` | Lookup by worldId |
| `isWorldMaintenanceActive(worldId, env)` | Time-based maintenance check |
| `getWorldMaintenanceMessage(worldId, env, lang)` | Localized maintenance message |

### 3. Popup Notice (`sdk.popupNotice`)

| Method | Description |
|--------|-------------|
| `fetchAsync(env)` | Fetch popup notices |
| `getAll(env)` | Get cached notices |
| `getForWorld(worldId, env)` | Filter by targetWorlds |
| `getActive(env, platform?, channel?, worldId?, userId?)` | Filter by time range + targeting (sorted by displayPriority) |

**Targeting logic:** Each targeting field supports `inverted` flag. If targets list is null/empty, all values match.

### 4. Survey (`sdk.survey`)

| Method | Description |
|--------|-------------|
| `fetchAsync(env)` | Fetch surveys + settings |
| `getAll(env)` | Get cached surveys |
| `getSettings(env)` | Get survey platform settings |

### 5. Whitelist (`sdk.whitelist`)

| Method | Description |
|--------|-------------|
| `fetchAsync(env)` | Fetch whitelist data |
| `get(env)` | Get cached whitelist |
| `isIpWhitelisted(ip, env)` | Check IP against whitelist |
| `isAccountWhitelisted(accountId, env)` | Check account against whitelist |

### 6. Service Maintenance (`sdk.serviceMaintenance`)

| Method | Description |
|--------|-------------|
| `fetchAsync(env)` | Fetch maintenance status |
| `getStatus(env)` | Get cached status |
| `isActive(env)` | Time-based active check |
| `getMessage(env, lang)` | Localized maintenance message |

### 7. Store Product (`sdk.storeProduct`)

| Method | Description |
|--------|-------------|
| `fetchAsync(env)` | Fetch store products |
| `getAll(env)` | Get cached products |

### 8. Service Discovery (`sdk.serviceDiscovery`)

**Not cached** — real-time API calls.

| Method | Description |
|--------|-------------|
| `registerAsync(input)` | Register service instance |
| `updateStatusAsync(instanceId, input)` | Update status/stats |
| `deregisterAsync(instanceId)` | Deregister instance |
| `getServicesAsync(filter?)` | Query registered services |

### 9. Coupon (`sdk.coupon`)

**Not cached** — real-time API calls.

| Method | Description |
|--------|-------------|
| `redeemAsync(request, env)` | Redeem a coupon code |
