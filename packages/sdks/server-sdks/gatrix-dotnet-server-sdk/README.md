# Gatrix .NET Server SDK

Gatrix Server-side SDK for .NET — provides easy access to Gatrix backend APIs with local caching, event-driven refresh, and feature flag evaluation.

## Features

- 🚀 **Easy to use** — Clean DI-based API via `AddGatrixServerSdk()`
- 📦 **Local caching** — All data cached in memory with optional file persistence
- 🔔 **Real-time sync** — Redis PubSub event-driven cache invalidation
- 🏳️ **Feature flags** — Full local evaluation (no backend roundtrip per request)
- 🌍 **Multi-environment** — Wildcard mode caches all environments simultaneously
- 📝 **Strongly typed** — Full C# type definitions

## Requirements

- .NET 8+
- Redis (optional, for event-based refresh)

## Installation

```bash
dotnet add package Gatrix.Server.Sdk
dotnet add package Gatrix.Server.Sdk.AspNetCore
```

> **Note:** If referencing as a project reference (monorepo), see the section below.

## Quick Start

### 1. Register services

```csharp
// Program.cs
builder.Services.AddGatrixServerSdk(options =>
{
    options.ApiUrl          = "https://api.gatrix.com";
    options.ApiToken        = "your-server-api-token";
    options.ApplicationName = "my-game-server";
    options.Service         = "worldd";
    options.Group           = "kr-1";
    options.Environment     = "production";
});
```

### 2. Inject and use

```csharp
public class MyController : ControllerBase
{
    private readonly IGatrixServerSdk _sdk;

    public MyController(IGatrixServerSdk sdk)
    {
        _sdk = sdk;
    }

    [HttpGet("worlds")]
    public IActionResult GetWorlds()
    {
        var worlds = _sdk.GameWorld.GetCached("production");
        return Ok(worlds);
    }
}
```

## Configuration

### appsettings.json

```json
{
  "Gatrix": {
    "ApiUrl": "https://api.gatrix.com",
    "ApiToken": "your-server-api-token",
    "ApplicationName": "my-game-server",
    "Service": "worldd",
    "Group": "kr-1",
    "Environment": "production",
    "Cache": {
      "Enabled": true,
      "Ttl": 300,
      "RefreshMethod": "polling",
      "LocalStoragePath": null
    },
    "Redis": {
      "Host": "localhost",
      "Port": 6379,
      "Password": null,
      "Db": 0
    }
  }
}
```

Bind from config:

```csharp
builder.Services.AddGatrixServerSdk(options =>
    builder.Configuration.GetSection("Gatrix").Bind(options));
```

### Configuration Reference

| Property                 | Type     | Default     | Description                                         |
| ------------------------ | -------- | ----------- | --------------------------------------------------- |
| `ApiUrl`                 | string   | —           | **Required.** Gatrix backend URL                    |
| `ApiToken`               | string   | —           | **Required.** Server API token                      |
| `ApplicationName`        | string   | —           | **Required.** Application name                      |
| `Service`                | string   | —           | **Required.** Service name (e.g., `worldd`, `auth`) |
| `Group`                  | string   | —           | **Required.** Service group (e.g., `kr-1`, `us`)    |
| `Environment`            | string   | —           | **Required.** Default environment identifier        |
| `Environments`           | string[] | —           | Target environments. Set to `["*"]` for all         |
| `Cache.Enabled`          | bool     | `true`      | Enable local caching                                |
| `Cache.Ttl`              | int      | `300`       | Cache TTL in seconds (polling only)                 |
| `Cache.RefreshMethod`    | string   | `polling`   | `polling` \| `event` \| `manual`                    |
| `Cache.LocalStoragePath` | string?  | `null`      | Path for file-based ETag + data persistence         |
| `Redis.Host`             | string   | `localhost` | Redis host                                          |
| `Redis.Port`             | int      | `6379`      | Redis port                                          |
| `Redis.Password`         | string?  | —           | Redis password (optional)                           |
| `Redis.Db`               | int      | `0`         | Redis database number                               |

### Cache Sync Methods

| Method    | Redis Required | Description                                                       |
| --------- | -------------- | ----------------------------------------------------------------- |
| `polling` | ❌              | Refresh cache periodically based on `Ttl`                         |
| `event`   | ✅              | Refresh immediately via Redis PubSub (recommended)                |
| `manual`  | ❌              | No automatic refresh. Call `CacheManager.RefreshAsync()` manually |

### File-Based Cache Persistence (Optional)

When `Cache.LocalStoragePath` is set, the SDK persists cached data **and ETag values** to disk. On process restart, data is restored from files and ETag-based 304 optimization is maintained immediately.

```json
{
  "Gatrix": {
    "Cache": {
      "LocalStoragePath": "/var/cache/gatrix"
    }
  }
}
```

> **Docker note:** If `LocalStoragePath` is set, mount a volume to preserve the cache across container restarts. Without a volume, the cache is ephemeral but the application still works correctly.

## Multi-Environment Mode

For Edge servers or services caching data for multiple environments:

```csharp
builder.Services.AddGatrixServerSdk(options =>
{
    options.ApiUrl          = "https://api.gatrix.com";
    options.ApiToken        = "your-bypass-token"; // Must have all-env access
    options.ApplicationName = "edge-server";
    options.Service         = "edge";
    options.Group           = "default";
    options.Environment     = "production"; // Fallback environment
    options.Environments    = ["*"];        // Wildcard: cache all environments
});
```

Access per-environment data:

```csharp
var worlds = _sdk.GameWorld.GetCached("production");
var devWorlds = _sdk.GameWorld.GetCached("development");
```

## Feature Flags

Local evaluation with no backend roundtrip per request:

```csharp
public class GameController : ControllerBase
{
    private readonly IFeatureFlagService _flags;

    public GameController(IFeatureFlagService flags)
    {
        _flags = flags;
    }

    [HttpGet("battle-mode")]
    public IActionResult GetBattleMode()
    {
        var enabled = _flags.IsEnabled("new_battle_mode", fallback: false);
        var variant = _flags.StringVariation("battle_config", fallback: "default");

        return Ok(new { enabled, variant });
    }
}
```

### Evaluation Methods

| Method                             | Returns            | Description                     |
| ---------------------------------- | ------------------ | ------------------------------- |
| `IsEnabled(flag, fallback)`        | `bool`             | Whether the flag is enabled     |
| `Variation(flag, fallback)`        | `string`           | Variant name                    |
| `StringVariation(flag, fallback)`  | `string`           | String variant value            |
| `IntVariation(flag, fallback)`     | `int`              | Integer variant value           |
| `BoolVariation(flag, fallback)`    | `bool`             | Boolean variant value           |
| `JsonVariation<T>(flag, fallback)` | `T?`               | Deserialized JSON variant value |
| `Evaluate(flag, context)`          | `EvaluationResult` | Full evaluation details         |

### Evaluation Context

```csharp
var context = new EvaluationContext
{
    Properties = new Dictionary<string, object?>
    {
        ["userId"]   = "user-123",
        ["platform"] = "pc",
        ["country"]  = "KR",
    }
};

var enabled = _flags.IsEnabled("new_feature", fallback: false, context: context);
```

## Services

| Service Interface            | Description                            |
| ---------------------------- | -------------------------------------- |
| `IGameWorldService`          | Game world list and maintenance status |
| `IPopupNoticeService`        | In-game popup notices                  |
| `ISurveyService`             | Surveys                                |
| `IWhitelistService`          | IP and account whitelists              |
| `IServiceMaintenanceService` | Service maintenance status             |
| `IStoreProductService`       | Store products                         |
| `IClientVersionService`      | Client version information             |
| `IServiceNoticeService`      | Service notices                        |
| `IBannerService`             | Banners                                |
| `IVarsService`               | KV variables (Vars)                    |
| `IFeatureFlagService`        | Feature flag evaluation                |

## Selective Feature Toggles

Only enable the services you need to reduce cache memory usage:

```csharp
builder.Services.AddGatrixServerSdk(options =>
{
    // ...
    options.Features = new FeaturesOptions
    {
        GameWorld          = true,
        PopupNotice        = true,
        Survey             = false,  // Disabled
        Whitelist          = true,
        ServiceMaintenance = true,
        FeatureFlag        = true,
        Vars               = false,  // Disabled
        // ...
    };
});
```

## Monorepo Project Reference

When using as a local project reference:

```xml
<!-- your-project.csproj -->
<ItemGroup>
  <ProjectReference Include="path/to/Gatrix.Server.Sdk.csproj" />
  <ProjectReference Include="path/to/Gatrix.Server.Sdk.AspNetCore.csproj" />
</ItemGroup>
```
