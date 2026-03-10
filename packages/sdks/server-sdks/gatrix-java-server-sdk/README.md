# Gatrix Java Server SDK

Kotlin-based server SDK for the [Gatrix](https://gatrix.io) feature flag and live operations platform.

> This SDK runs on game servers or backend services.
> It fetches flag definitions and evaluates them **locally** — zero network latency during evaluation.

## Installation

### Gradle (Kotlin DSL)

```kotlin
dependencies {
    implementation("com.gatrix:gatrix-java-server-sdk:1.0.0")
}
```

### Gradle (Groovy)

```groovy
dependencies {
    implementation 'com.gatrix:gatrix-java-server-sdk:1.0.0'
}
```

## Quick Start

```kotlin
import com.gatrix.server.sdk.GatrixServerSdk
import com.gatrix.server.sdk.config.GatrixSdkConfig
import com.gatrix.server.sdk.models.EvaluationContext

// 1. Configure
val config = GatrixSdkConfig(
    apiUrl = "https://your-gatrix-server.com",
    apiToken = "your-server-api-token",
    applicationName = "my-game-server"
)

// 2. Initialize
val sdk = GatrixServerSdk(config)
sdk.initialize()

// 3. Evaluate flags with per-request context
val context = EvaluationContext(
    userId = "user-123",
    appVersion = "2.1.0",
    properties = mapOf("region" to "us-east", "level" to 42)
)

val enabled = sdk.features.isEnabled("new-ui", false, context)
val maxRetries = sdk.features.intVariation("max-retries", 3, context)
val bannerText = sdk.features.stringVariation("banner-text", "Welcome!", context)

// 4. Shutdown when done
sdk.shutdown()
```

## API Reference

All feature flag operations are accessed via `sdk.features`.

### Evaluation Methods

| Method | Return Type | Description |
|--------|-------------|-------------|
| `isEnabled(flagName, fallback, context?)` | `Boolean` | Check if a flag is enabled |
| `evaluate(flagName, context?)` | `EvaluationResult` | Full evaluation result with reason and variant |

### Typed Variations

| Method | Return Type | Description |
|--------|-------------|-------------|
| `boolVariation(flagName, fallback, context?)` | `Boolean` | Boolean variant value |
| `stringVariation(flagName, fallback, context?)` | `String` | String variant value |
| `intVariation(flagName, fallback, context?)` | `Int` | Integer variant value |
| `numberVariation(flagName, fallback, context?)` | `Double` | Double variant value |
| `jsonVariation(flagName, fallback, context?)` | `Map<String, Any?>` | JSON variant value |

### Detailed Variations

All typed variations have a `*Detail` variant (e.g., `boolVariationDetail`) that returns `EvaluationDetail<T>` including `reason` and `variantName`.

## Configuration

```kotlin
val config = GatrixSdkConfig(
    apiUrl = "https://your-gatrix-server.com",  // Required
    apiToken = "your-server-api-token",          // Required (resolves org/project/environment)
    applicationName = "my-game-server",          // Required

    // Cache refresh strategy
    cache = CacheConfig(
        refreshMethod = "polling",  // "polling" | "event" | "manual"
        ttl = 15                    // Polling interval in seconds
    ),

    // Redis Pub/Sub (required for "event" mode)
    redis = RedisConfig(
        host = "localhost",
        port = 6379,
        password = null,
        db = 0
    ),

    // HTTP retry
    retry = RetryConfig(
        enabled = true,
        maxRetries = 3,
        retryDelay = 1000
    )
)
```

### Cache Refresh Methods

| Method | Description |
|--------|-------------|
| `polling` (default) | Periodically fetches flag definitions at the configured `ttl` interval |
| `event` | Subscribes to Redis Pub/Sub for real-time cache invalidation |
| `manual` | No background activity; call `sdk.refreshCache()` manually |

## EvaluationContext

Context is passed **per-evaluation** (not stored globally).

```kotlin
val context = EvaluationContext(
    userId = "user-123",        // Sticky bucketing key
    sessionId = "session-abc",  // Session-based stickiness
    appName = "my-app",
    appVersion = "1.2.3",       // Used for semver constraints
    remoteAddress = "1.2.3.4",
    properties = mapOf(         // Custom properties for constraint evaluation
        "region" to "us-east",
        "level" to 42,
        "isPremium" to true,
        "tags" to listOf("beta", "vip")
    )
)
```

## Constraint Operators

The evaluation engine supports the following constraint operators:

| Category | Operators |
|----------|-----------|
| String | `str_eq`, `str_contains`, `str_starts_with`, `str_ends_with`, `str_in`, `str_regex` |
| Number | `num_eq`, `num_gt`, `num_gte`, `num_lt`, `num_lte`, `num_in` |
| Boolean | `bool_is` |
| Date | `date_eq`, `date_gt`, `date_gte`, `date_lt`, `date_lte` |
| Semver | `semver_eq`, `semver_gt`, `semver_gte`, `semver_lt`, `semver_lte`, `semver_in` |
| Array | `arr_any`, `arr_all`, `arr_empty` |
| Existence | `exists`, `not_exists` |

All operators support `inverted` and `caseInsensitive` flags.

## Architecture

```
GatrixServerSdk
├── features: FeatureFlagService
│   ├── FlagDefinitionCache (per-env flags, per-project segments)
│   └── FeatureFlagEvaluator (local evaluation engine)
├── GatrixApiClient (OkHttp, ETag, retry)
└── EventListener (Redis Pub/Sub, real-time cache invalidation)
```

## Requirements

- JDK 17+
- Kotlin 1.9+

## License

Proprietary — Gatrix Platform
