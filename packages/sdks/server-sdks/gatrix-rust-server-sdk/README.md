# Gatrix Rust Server SDK

Official Rust server SDK for [Gatrix](https://github.com/gatrix) – a feature management platform.

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
gatrix-rust-server-sdk = { path = "../gatrix-rust-server-sdk" }
tokio = { version = "1", features = ["full"] }
```

## Quick Start

```rust
use gatrix_rust_server_sdk::{GatrixServerSDK, GatrixSDKConfig, UsesConfig, EvaluationContext};

#[tokio::main]
async fn main() {
    let mut config = GatrixSDKConfig::new(
        "http://localhost:45000",
        "unsecured-server-api-token",
        "my-game-server",
    );
    config.uses = UsesConfig {
        feature_flag: true,
        game_world: true,
        ..Default::default()
    };

    let mut sdk = GatrixServerSDK::new(config).expect("Failed to create SDK");
    sdk.initialize().await.expect("Failed to initialize");

    // Evaluate a feature flag
    let ctx = EvaluationContext {
        user_id: Some("user-123".to_string()),
        ..Default::default()
    };
    let enabled = sdk.feature_flag.is_enabled("my-feature", false, Some(&ctx), None).await;
    println!("Feature enabled: {}", enabled);

    sdk.shutdown().await;
}
```

## Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `api_url` | `String` | ✅ | Gatrix backend URL |
| `api_token` | `String` | ✅ | Server API Token |
| `app_name` | `String` | ✅ | Application name |
| `meta` | `Option<MetaConfig>` | | Service metadata (service, group, version) |
| `world_id` | `Option<String>` | | World ID for maintenance checks |
| `redis` | `Option<RedisConfig>` | | Redis config for event mode |
| `cache` | `CacheConfig` | | Cache refresh settings (default: polling, 300s TTL) |
| `logger` | `LoggerConfig` | | Log level (debug, info, warn, error) |
| `retry` | `RetryConfig` | | HTTP retry settings (default: 10 retries, exponential backoff) |
| `uses` | `UsesConfig` | | Which services to enable |
| `feature_flags` | `FeatureFlagConfig` | | Feature flag settings (compact mode) |

### Cache Refresh Methods

| Method | Description |
|--------|-------------|
| `Polling` (default) | Periodic refresh (interval configurable via `cache.ttl`) |
| `Event` | Real-time via Redis Pub/Sub (`gatrix-sdk-events` channel) |
| `Manual` | No auto-refresh; call `sdk.refresh_cache()` explicitly |

```rust
use gatrix_rust_server_sdk::{CacheConfig, RefreshMethod};

config.cache = CacheConfig {
    enabled: true,
    ttl: 60,
    refresh_method: RefreshMethod::Polling,
};
```

### Uses Config

Enable only the services you need:

```rust
config.uses = UsesConfig {
    feature_flag: true,
    game_world: true,
    popup_notice: true,
    survey: false,
    whitelist: false,
    service_maintenance: true,
    ..Default::default()
};
```

## Services API

### Feature Flag Service

```rust
let ctx = EvaluationContext {
    user_id: Some("user-123".to_string()),
    app_version: Some("2.1.0".to_string()),
    properties: [("level".to_string(), serde_json::json!(42))].into(),
    ..Default::default()
};

// Check if enabled
let enabled = sdk.feature_flag.is_enabled("flag-name", false, Some(&ctx), None).await;

// Get typed variation values
let s = sdk.feature_flag.string_variation("flag-name", "default", Some(&ctx), None).await;
let n = sdk.feature_flag.number_variation("flag-name", 0.0, Some(&ctx), None).await;
let b = sdk.feature_flag.bool_variation("flag-name", false, Some(&ctx), None).await;
let j = sdk.feature_flag.json_variation("flag-name", serde_json::json!({}), Some(&ctx), None).await;

// With evaluation details
let detail = sdk.feature_flag.string_variation_detail("flag-name", "default", Some(&ctx), None).await;
println!("value={}, reason={}, variant={:?}", detail.value, detail.reason, detail.variant_name);

// Or-throw (returns Result instead of fallback)
let val = sdk.feature_flag.string_variation_or_throw("flag-name", Some(&ctx), None).await?;

// Static context (merged with per-evaluation context)
sdk.feature_flag.set_static_context(EvaluationContext {
    app_name: Some("my-app".to_string()),
    ..Default::default()
}).await;
```

### Game World Service

```rust
let worlds = sdk.game_world.get_cached(None).await;
let world = sdk.game_world.get_by_world_id("world-1", None).await;
let is_maint = sdk.game_world.is_world_maintenance_active("world-1", None).await;
let msg = sdk.game_world.get_world_maintenance_message("world-1", None, Some("ko")).await;
```

### Coupon Service

```rust
use gatrix_rust_server_sdk::types::api::RedeemCouponRequest;

let result = sdk.coupon.redeem(&RedeemCouponRequest {
    code: "PROMO2024".to_string(),
    user_id: "user-123".to_string(),
    user_name: "Player".to_string(),
    character_id: "char-1".to_string(),
    world_id: "world-1".to_string(),
    platform: "pc".to_string(),
    channel: "steam".to_string(),
    sub_channel: "".to_string(),
}, None).await?;
```

### Service Discovery

```rust
use gatrix_rust_server_sdk::types::api::*;

let instance = sdk.service_discovery.register(RegisterServiceInput {
    instance_id: None,
    labels: ServiceLabels {
        service: "world-server".to_string(),
        group: Some("kr".to_string()),
        environment: None,
        region: None,
        extra: Default::default(),
    },
    hostname: None,
    internal_address: None,
    ports: ServicePorts([("game".to_string(), 7777), ("http".to_string(), 8080)].into()),
    status: Some(ServiceStatus::Ready),
    stats: None,
    meta: None,
}).await?;

// Fetch services
let services = sdk.service_discovery.fetch_services(None).await?;

// Unregister on shutdown
sdk.service_discovery.unregister().await?;
```

### Other Services

```rust
// Whitelist
let allowed = sdk.whitelist.is_ip_whitelisted("192.168.1.1", None).await;
let allowed = sdk.whitelist.is_account_whitelisted("account-123", None).await;

// Maintenance
let active = sdk.service_maintenance.is_active(None).await;
let msg = sdk.service_maintenance.get_message(None, Some("ko")).await;

// Popup Notices
let notices = sdk.popup_notice.get_cached(None).await;

// Surveys
let surveys = sdk.survey.get_cached(None).await;

// Store Products
let products = sdk.store_product.get_cached(None).await;

// Banners
let banners = sdk.banner.get_cached(None).await;

// Client Versions
let versions = sdk.client_version.get_cached(None).await;

// Service Notices
let notices = sdk.service_notice.get_cached(None).await;

// Vars (KV)
let value = sdk.vars.get_value("my-key", None).await;
let parsed: Option<i32> = sdk.vars.get_parsed_value("max-retries", None).await;

// Impact Metrics
sdk.impact_metrics.define_counter("logins", "Total login count").await;
sdk.impact_metrics.increment_counter("logins").await;
sdk.impact_metrics.define_histogram("response_time", "Response time ms", None).await;
sdk.impact_metrics.observe_histogram("response_time", 42.5).await;
```

## Event Handling

```rust
use std::sync::Arc;

// Listen for events
sdk.on("feature_flag.changed", Arc::new(|event| {
    println!("Flag changed: {:?}", event.data);
})).await;

// Wildcard listener
sdk.on("*", Arc::new(|event| {
    println!("Event: {}", event.event_type);
})).await;

// Remove listeners
sdk.off("feature_flag.changed").await;
```

## Lifecycle

```rust
let mut sdk = GatrixServerSDK::new(config)?;
sdk.initialize().await?;    // Fetch initial data, start polling/events
// ... application runs ...
sdk.shutdown().await;        // Flush metrics, stop polling, unregister
```

## Features

- `redis-pubsub` (default): Enable Redis Pub/Sub event listener

To disable Redis support:

```toml
[dependencies]
gatrix-rust-server-sdk = { path = "...", default-features = false }
```

## License

MIT
