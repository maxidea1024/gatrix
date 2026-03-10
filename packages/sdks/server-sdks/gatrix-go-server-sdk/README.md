# Gatrix Go Server SDK

Official Go server SDK for [Gatrix](https://github.com/gatrix) – a feature management platform.

## Installation

```bash
go get github.com/gatrix/gatrix-go-server-sdk
```

## Quick Start

```go
package main

import (
    gatrix "github.com/gatrix/gatrix-go-server-sdk"
    "github.com/gatrix/gatrix-go-server-sdk/types"
)

func main() {
    sdk, err := gatrix.NewGatrixServerSDK(gatrix.GatrixSDKConfig{
        APIURL:          "http://localhost:3000",
        APIToken:        "your-server-api-token",
        ApplicationName: "my-game-server",
        Environment:     "your-environment-id",
    })
    if err != nil {
        panic(err)
    }
    defer sdk.Shutdown()

    if err := sdk.Initialize(); err != nil {
        panic(err)
    }

    // Evaluate a feature flag
    ctx := &types.EvaluationContext{UserID: "user-123"}
    enabled := sdk.FeatureFlag.IsEnabled("my-feature", false, ctx, "")
}
```

## Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `APIURL` | string | ✅ | Gatrix backend URL |
| `APIToken` | string | ✅ | Server API Token |
| `ApplicationName` | string | ✅ | Application name |
| `Service` | string | | Service name |
| `Group` | string | | Service group |
| `Environment` | string | | Environment ID (or `"*"` for multi-env) |
| `WorldID` | string | | World ID for maintenance checks |
| `Redis` | *RedisConfig | | Redis config for event mode |
| `Cache` | *CacheConfig | | Cache refresh settings |
| `Logger` | *LoggerConfig | | Log level (`debug`, `info`, `warn`, `error`) |
| `Retry` | *RetryConfig | | HTTP retry settings |
| `Uses` | *UsesConfig | | Which services are cached |

### Cache Refresh Methods

| Method | Description |
|--------|-------------|
| `polling` | Periodic refresh (default, interval configurable via `Cache.TTL`) |
| `event` | Real-time via Redis Pub/Sub (`gatrix-sdk-events` channel) |
| `manual` | No auto-refresh; call `sdk.RefreshCache()` explicitly |

## Services API

### Feature Flag Service

```go
// Check if enabled
enabled := sdk.FeatureFlag.IsEnabled("flag-name", false, ctx, "")

// Get typed variation values
str := sdk.FeatureFlag.StringVariation("flag-name", "default", ctx, "")
num := sdk.FeatureFlag.IntVariation("flag-name", 0, ctx, "")
flt := sdk.FeatureFlag.FloatVariation("flag-name", 0.0, ctx, "")
bol := sdk.FeatureFlag.BoolVariation("flag-name", false, ctx, "")  // variant VALUE, NOT enabled state
jsn := sdk.FeatureFlag.JsonVariation("flag-name", map[string]interface{}{}, ctx, "")

// With evaluation details
detail := sdk.FeatureFlag.StringVariationDetails("flag-name", "default", ctx, "")
fmt.Printf("value=%s reason=%s variant=%s\n", detail.Value, detail.Reason, detail.VariantName)

// Or-throw (returns error instead of fallback)
val, err := sdk.FeatureFlag.StringVariationOrThrow("flag-name", ctx, "")
```

### Game World Service

```go
worlds := sdk.GameWorld.GetAll("")
world := sdk.GameWorld.GetByWorldID("world-1", "")
isMaintenance := sdk.GameWorld.IsWorldMaintenanceActive("world-1", "")
msg := sdk.GameWorld.GetWorldMaintenanceMessage("world-1", "", "ko")
```

### Coupon Service

```go
result, err := sdk.Coupon.Redeem(types.RedeemCouponRequest{
    Code:   "PROMO2024",
    UserID: "user-123",
    WorldID: "world-1",
}, "env-id")
```

### Service Discovery

```go
resp, err := sdk.ServiceDiscovery.Register(types.RegisterServiceInput{
    Labels: types.ServiceLabels{Service: "world-server", Group: "kr"},
    Ports:  types.ServicePorts{"game": 7777, "http": 8080},
})
defer sdk.ServiceDiscovery.Unregister()

services, err := sdk.ServiceDiscovery.FetchServices(&types.GetServicesParams{
    Service: "world-server",
    Status:  types.ServiceStatusReady,
})
```

### Other Services

```go
// Whitelist
sdk.Whitelist.IsIPWhitelisted("192.168.1.1", "")
sdk.Whitelist.IsAccountWhitelisted("account-123", "")

// Maintenance
sdk.ServiceMaintenance.IsActive("")
sdk.ServiceMaintenance.GetMessage("", "ko")

// Popup Notices
notices := sdk.PopupNotice.GetActive("", "ios", "ch1", "world-1", "user-1")

// Surveys
surveys := sdk.Survey.GetAll("")

// Store Products
products := sdk.StoreProduct.GetAll("")

// Impact Metrics
sdk.ImpactMetrics.DefineCounter("logins", "Total login count")
sdk.ImpactMetrics.IncrementCounter("logins")
sdk.ImpactMetrics.DefineHistogram("response_time", "Response time ms", nil)
sdk.ImpactMetrics.ObserveHistogram("response_time", 42.5)
```

## Event Handling

```go
// Listen for specific events
sdk.On("feature_flag.changed", func(e types.SdkEvent) {
    fmt.Printf("Flag changed: %v\n", e.Data)
})

// Wildcard listener
sdk.On("*", func(e types.SdkEvent) {
    fmt.Printf("Event: %s\n", e.Type)
})

// Remove listeners
sdk.Off("feature_flag.changed")
```

## Lifecycle

```go
sdk, _ := gatrix.NewGatrixServerSDK(config)
sdk.Initialize()  // Fetch initial data, start polling/events
// ... application runs ...
sdk.Shutdown()     // Flush metrics, stop polling, unregister
```

## License

MIT
