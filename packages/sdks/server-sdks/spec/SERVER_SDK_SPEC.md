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
| Node.js | `@gatrix/gatrix-node-server-sdk` |
| .NET | `Gatrix.Server.Sdk` |
| Java | `com.gatrix.server.sdk` |
| Go | `github.com/gatrix/gatrix-go-server-sdk` |

## Data Scope (Organization → Project → Environment)

> [!CAUTION]
> **Before implementing any caching or data storage**, SDK developers MUST identify the correct **scope** for each data type. Gatrix follows a strict **Organization → Project → Environment** hierarchy. Caching data at the wrong scope will cause cross-project data leaks or missing data.

**For every data type the SDK caches, determine which level it belongs to:**

| Scope | Description | Example |
|-------|-------------|---------|
| **Per-Environment** | Data is unique to a specific environment. Cache key MUST include `environmentId`. | Feature Flag definitions, Game Worlds, Popup Notices, Surveys, Whitelists, Maintenance, Banners, Store Products, Client Versions, Service Notices, Vars |
| **Per-Project** | Data is shared across all environments within a single project, but isolated between projects. Cache key MUST include `projectId`. | **Segments** (Feature Segments) |
| **Per-Organization** | Data is shared across all projects within an organization. | (None currently) |
| **Global** | Data is shared across all organizations. | (None currently) |

**Implementation Requirements:**

1. The API response for feature flags (`GET /api/v1/server/features`) includes a `projectId` field.
2. SDKs MUST maintain an **`environmentId → projectId` mapping** to resolve the correct data scope.
3. When evaluating a flag for `environmentId=X`, the evaluator MUST look up `projectId` from the mapping, then use `segments[projectId]` — NOT a global segment cache.
4. When handling Pub/Sub events for segments (`segment.created/updated/deleted`), the `projectId` from the event payload MUST be used to scope the cache operation.

> [!WARNING]
> A common mistake is to cache segments as a single global map. This is **WRONG**. Segments are per-project and MUST be stored as `Map<projectId, Map<segmentName, Segment>>`.

## Core Concepts

### 1. Local Evaluation & Definition Caching

For the Feature Flag service, Server SDKs:
- Fetch raw **flag definitions and segments** (from `GET /api/v1/server/features`). The environment is resolved server-side from the `X-API-Token` header — it is NOT part of the URL path.
- Periodically poll or listen for invalidation events to update these definitions.
- Store definitions locally in an optimized in-memory cache:
  - **Flags** are cached **per-environment** (each environment has its own set of flag definitions).
  - **Segments** are cached **per-project** (NOT global). Gatrix follows an **Organization → Project → Environment** hierarchy. Segments belong to a project and are shared across all environments within that project, but are isolated between projects. The API response includes a `projectId` field to identify which project the segments belong to, and the SDK MUST maintain an `environmentId → projectId` mapping to resolve the correct segments during evaluation.
- Evaluate flags completely locally using a shared evaluation engine (such as porting or wrapping `@gatrix/evaluator`'s `FeatureFlagEvaluator`; types are defined in `@gatrix/shared`). When evaluating a flag for a given environment, the evaluator MUST use the segments from the project that the environment belongs to.
- Buffer usage metrics locally and flush them periodically to the Gatrix Edge API to avoid network spam.
- **Unlike Client SDKs, Server SDKs DO NOT have `synced` vs `realtime` flag concepts or `explicitSyncMode`.** Every flag evaluation is implicitly realtime, using the absolute latest definitions from the in-memory cache. Mid-session consistency is handled by passing identical contexts across stateless requests.

### 2. Service-Namespaced Access (Getter Pattern)

> [!CAUTION]
> **All service-specific operations MUST be accessed through their dedicated service getter** — never directly on the main root `GatrixServerSdk` object. The root SDK object MUST NOT expose convenience wrapper methods that simply delegate to a sub-service. This prevents API surface bloat and ensures a single, consistent access pattern.

| ❌ Wrong (convenience method on SDK) | ✅ Correct (service getter) |
|--------------------------------------|----------------------------|
| `sdk.isEnabled("flag", context)` | `sdk.featureFlag.isEnabled("flag", context)` |
| `sdk.getGameWorlds()` | `sdk.gameWorld.getCached()` |
| `sdk.fetchGameWorldById("world-1")` | `sdk.gameWorld.getById("world-1")` |
| `sdk.getVarValue("$key")` | `sdk.vars.getValue("$key")` |
| `sdk.redeemCoupon(request)` | `sdk.coupon.redeem(request)` |

**Exceptions** — The following are allowed directly on the root SDK object because they are **cross-cutting concerns** that span multiple services or require orchestration logic beyond a single service:

| Allowed on SDK root | Reason |
|---------------------|--------|
| `initialize()`, `close()` | SDK lifecycle management |
| `on()`, `off()`, `publishCustomEvent()` | Unified event bus (dispatches to EventListener, CacheManager, or local event maps) |
| `refreshCache()` | Orchestrates refresh across ALL services via CacheManager |
| `createHttpMetricsMiddleware()` | Express middleware factory (not service-specific) |

**Required Service Getters:**

| Getter | Service |
|--------|---------|
| `sdk.coupon` | CouponService |
| `sdk.gameWorld` | GameWorldService |
| `sdk.popupNotice` | PopupNoticeService |
| `sdk.survey` | SurveyService |
| `sdk.whitelist` | WhitelistService |
| `sdk.serviceMaintenance` | ServiceMaintenanceService |
| `sdk.storeProduct` | StoreProductService |
| `sdk.featureFlag` | FeatureFlagService |
| `sdk.serviceDiscovery` | ServiceDiscoveryService (includes enrichment on register) |
| `sdk.impactMetrics` | MetricsAPI |
| `sdk.worldMaintenance` | WorldMaintenanceService (aggregates service + world + whitelist) |
| `sdk.banner` | BannerService |
| `sdk.clientVersion` | ClientVersionService |
| `sdk.serviceNotice` | ServiceNoticeService |
| `sdk.vars` | VarsService |

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
    "environmentId": "production",
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
| `segment.created/updated/deleted` | FeatureFlag | Refresh segments for the project |
| `client_version.created/updated/deleted` | ClientVersion | Update/remove from cache |
| `banner.created/updated/deleted` | Banner | Update/remove from cache |
| `service_notice.created/updated/deleted` | ServiceNotice | Update/remove from cache |

#### Processing Rules

1. **Feature gate check:** Before processing, check if the relevant feature is enabled in `FeaturesOptions`. Skip silently if disabled.
2. **Environment / Project scoping:** Events carry `data.environmentId` to identify the target environment. **Segment events (`segment.*`) do NOT require an environment** — they use `data.projectId` instead, since segments are per-project. For non-segment events, if `environmentId` is missing, log a warning and skip.
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
3. **Strategy-specific logic** — Delegate to registered strategy's `isEnabled()` method

> [!CAUTION]
> **DO NOT apply rollout/percentage checks generically to all strategies.**  
> Each strategy class MUST handle its own activation logic internally (e.g., `flexibleRollout` handles rollout percentage, `default` always returns true, `gradualRolloutUserId` handles userId-based percentage).  
> The evaluator's role is LIMITED to segments and constraints (steps 1-2). Step 3 MUST delegate to the strategy's own `isEnabled()` method.  
> Applying a generic rollout check to all strategies will cause strategies like `default` to incorrectly evaluate as `false`.

## Feature Flag Service API

### Core Methods

All methods provide **two overloads** to prevent accidental context omission:
1. **Without context** — for server-internal use where no user targeting is needed
2. **With context** — for user-targeted evaluations where context MUST be explicit

When `environmentId` is omitted, the environment mapped 1:1 to the `apiToken` is used implicitly (single-environment mode).
In multi-environment mode (e.g., Edge server with `environmentProvider`), `environmentId` MUST be specified explicitly.

```csharp
// ============================================
// Core Evaluation
// ============================================
// Without context (server-internal)
EvaluationResult Evaluate(string flagName, string? environmentId = null);
// With context (user-targeted)
EvaluationResult Evaluate(string flagName, EvaluationContext context, string? environmentId = null);

// Without context
bool IsEnabled(string flagName, bool fallback, string? environmentId = null);
// With context
bool IsEnabled(string flagName, EvaluationContext context, bool fallback, string? environmentId = null);

// ============================================
// Variant Name (returns matched variant name, not the value)
// ============================================
string Variation(string flagName, string fallback = "", string? environmentId = null);
string Variation(string flagName, EvaluationContext context, string fallback = "", string? environmentId = null);

// ============================================
// Typed Variations (returns the variant VALUE converted to the specified type)
// IMPORTANT: BoolVariation returns the variant's VALUE parsed as bool, NOT the flag's enabled state.
//            Use IsEnabled() for the flag's enabled state.
// ============================================

// Without context (server-internal, no user targeting)
string StringVariation(string flagName, string fallback, string? environmentId = null);
int    IntVariation(string flagName, int fallback, string? environmentId = null);
long   LongVariation(string flagName, long fallback, string? environmentId = null);
float  FloatVariation(string flagName, float fallback, string? environmentId = null);
double DoubleVariation(string flagName, double fallback, string? environmentId = null);
bool   BoolVariation(string flagName, bool fallback, string? environmentId = null);
T?     JsonVariation<T>(string flagName, T? fallback = default, string? environmentId = null);

// With context (user-targeted evaluation — context is REQUIRED)
string StringVariation(string flagName, EvaluationContext context, string fallback, string? environmentId = null);
int    IntVariation(string flagName, EvaluationContext context, int fallback, string? environmentId = null);
long   LongVariation(string flagName, EvaluationContext context, long fallback, string? environmentId = null);
float  FloatVariation(string flagName, EvaluationContext context, float fallback, string? environmentId = null);
double DoubleVariation(string flagName, EvaluationContext context, double fallback, string? environmentId = null);
bool   BoolVariation(string flagName, EvaluationContext context, bool fallback, string? environmentId = null);
T?     JsonVariation<T>(string flagName, EvaluationContext context, T? fallback = default, string? environmentId = null);

// ============================================
// *Details — returns value + evaluation metadata (reason, variant name)
// ============================================
EvaluationDetail<string> StringVariationDetails(string flagName, string fallback, string? environmentId = null);
EvaluationDetail<string> StringVariationDetails(string flagName, EvaluationContext context, string fallback, string? environmentId = null);
// ... (all types follow the same two-overload pattern)

// ============================================
// *OrThrow — throws FeatureFlagException if flag not found or no value
// ============================================
string StringVariationOrThrow(string flagName, string? environmentId = null);
string StringVariationOrThrow(string flagName, EvaluationContext context, string? environmentId = null);
// ... (all types follow the same two-overload pattern)
```

> [!CAUTION]
> **`BoolVariation` ≠ `IsEnabled`** — These are fundamentally different operations:
> - `BoolVariation`: Returns the **variant's VALUE** as a boolean (only when `flag.valueType === "boolean"`).
> - `IsEnabled`: Returns the **flag's enabled state** (whether the flag is turned on or off).
>
> Example: A flag can be `enabled=true` with `enabledValue=false`. `IsEnabled()` returns `true`, `BoolVariation()` returns `false`.
> **Never use `BoolVariation` as a substitute for `IsEnabled`, or vice versa.**

> [!IMPORTANT]
> **Typed Variation Methods MUST Validate `flag.valueType`**
>
> All typed variation methods (`BoolVariation`, `StringVariation`, `NumberVariation`, `JsonVariation` and their `*Details`/`*OrThrow` variants) MUST check the flag's declared `valueType` before returning a value:
>
> | Method | Required `flag.valueType` |
> |--------|---------------------------|
> | `BoolVariation` | `"boolean"` |
> | `StringVariation` | `"string"` |
> | `NumberVariation` | `"number"` |
> | `JsonVariation` | `"json"` |
>
> **Rules:**
> 1. If the flag is not found, return `fallback` (or throw for `*OrThrow`).
> 2. If `flag.valueType` does not match the expected type, return `fallback` (or throw `INVALID_VALUE_TYPE` for `*OrThrow`).
> 3. **DO NOT** use `typeof value` or `isNaN()` to infer the type at runtime. The flag's **declared `valueType`** is the single source of truth.
> 4. **Always evaluate the flag BEFORE the `valueType` check** to ensure metrics are recorded regardless of the outcome.

> [!WARNING]
> **All Flag Access Methods MUST Record Metrics**
>
> The following methods MUST always record evaluation metrics (impression tracking):
> `IsEnabled`, `GetVariant`, `BoolVariation`, `StringVariation`, `NumberVariation`, `JsonVariation`, and all `*Details`/`*OrThrow` variants.
>
> **Evaluation (and therefore metric recording) MUST happen before any `valueType` check or early return.** This ensures that flag usage is accurately tracked even when `valueType` mismatches occur.


## SDK Configuration Definition

The configuration model MUST strictly mirror this interface:

```typescript
interface GatrixSDKConfig {
  // Required Authentication and Identity
  apiUrl: string;  // Gatrix backend URL (e.g., https://api.gatrix.com)
  apiToken: string; // REQUIRED — server API token. Must be explicitly provided; no default fallback.
  appName: string;

  // Optional - World ID for world-specific maintenance checks
  worldId?: string;

  // Optional - Service metadata (for metrics labels and service discovery)
  meta?: {
    service?: string;
    group?: string;
    version?: string;
    commitHash?: string;
    gitBranch?: string;
  };

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

  // Feature toggles (selective caching)
  // All services default to disabled. Only enable what you need (opt-in).
  uses?: {
    gameWorld?: boolean;           // default: false (opt-in)
    popupNotice?: boolean;         // default: false (opt-in)
    survey?: boolean;              // default: false (opt-in)
    whitelist?: boolean;           // default: false (opt-in)
    serviceMaintenance?: boolean;  // default: false (opt-in)
    clientVersion?: boolean;       // default: false (opt-in)
    serviceNotice?: boolean;       // default: false (opt-in)
    banner?: boolean;              // default: false (opt-in)
    storeProduct?: boolean;        // default: false (opt-in)
    featureFlag?: boolean;         // default: false (opt-in)
    vars?: boolean;                // default: false (opt-in)
  };

  // Optional - Multi-environment support (designed for Edge and similar special-purpose services)
  // When provided, the SDK operates in multi-environment mode.
  // Multi-environment mode is determined solely by the PRESENCE of this provider,
  // NOT by the number of environments it returns.
  environmentProvider?: IEnvironmentProvider;
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
| `X-API-Token` | `{apiToken}` | Server API Token for authentication (environment is resolved from this token) |
| `X-Application-Name` | `{appName}` | Application name from config |
| `X-SDK-Version` | `{sdkName}/{version}` | e.g., `gatrix-java-server-sdk/1.0.0` |
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
| **Strategy evaluation order** | Segments → Constraints → Strategy-specific `isEnabled()` (first match wins) |
| **Constraint operators** | `str_eq`, `str_contains`, `str_starts_with`, `str_ends_with`, `str_in`, `str_regex`, `cidr_match`, `num_eq`, `num_gt`, `num_gte`, `num_lt`, `num_lte`, `num_in`, `bool_is`, `date_eq/gt/gte/lt/lte`, `semver_eq/gt/gte/lt/lte/in`, `exists`, `not_exists`, `arr_any`, `arr_all`, `arr_empty` |
| **Modifier flags** | `inverted` (negate result), `caseInsensitive` (string comparison) |
| **Strategy delegation** | Each strategy handles its own logic: `default` → always true, `flexibleRollout` → MurmurHash3 rollout, `gradualRolloutUserId/SessionId/Random` → percentage-based |
| **Variant selection** | Weighted distribution via murmurhash percentage |
| **Value coercion** | `getFallbackValue(value, valueType)` ensures type-correct output |

#### Flag Analytics Metrics

SDK MUST buffer flag evaluation metrics and flush periodically (default: 60s).

```
POST /api/v1/server/features/metrics
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
