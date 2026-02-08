# Gatrix.ServerSDK

Gatrix Server-side SDK for .NET - Provides easy access to Gatrix backend APIs with caching, event handling, and service discovery.

## Features

- 🚀 **Easy to use** - Simple API for common operations
- 📦 **Caching** - Built-in caching with automatic refresh
- 🔔 **Event handling** - Real-time cache updates via Redis PubSub
- 🔍 **Service discovery** - Backend API-based service discovery
- 💉 **Dependency Injection** - Full DI support for .NET
- ✅ **Tested** - Comprehensive test coverage

## Requirements

- .NET 8.0 or higher
- Redis (optional, for event handling)

## Installation

```bash
dotnet add package Gatrix.ServerSDK
```

## Quick Start

### Basic Setup with Dependency Injection

```csharp
using Gatrix.ServerSDK;
using Gatrix.ServerSDK.Extensions;
using Microsoft.Extensions.DependencyInjection;

var services = new ServiceCollection();

// Add GatrixServerSDK with configuration
services.AddGatrixServerSDK(config =>
{
    config.GatrixUrl = "https://api.gatrix.com";
    config.ApiToken = "your-server-api-token";
    config.ApplicationName = "your-app-name";

    // Optional: Configure cache
    config.Cache.RefreshMethod = CacheRefreshMethod.Polling;
    config.Cache.Ttl = 300;

    // Optional: Configure logger
    config.Logger.Level = LogLevel.Information;
    config.Logger.TimeOffset = 9; // +09:00 (Korea)
    config.Logger.TimestampFormat = TimestampFormat.Local;
});

var provider = services.BuildServiceProvider();
var sdk = provider.GetRequiredService<GatrixServerSDK>();

// Initialize SDK
await sdk.InitializeAsync();

// Use SDK
var gameWorlds = sdk.GetGameWorlds();
foreach (var world in gameWorlds)
{
    Console.WriteLine($"World: {world.Name}");
}

// Cleanup
await sdk.DisposeAsync();
```

### With Redis (Event-Based Refresh)

```csharp
services.AddGatrixServerSDK(config =>
{
    config.GatrixUrl = "https://api.gatrix.com";
    config.ApiToken = "your-server-api-token";
    config.ApplicationName = "your-app-name";

    // Configure Redis
    config.Redis = new RedisConfig
    {
        Host = "localhost",
        Port = 6379,
        Password = "your-redis-password" // optional
    };

    // Use event-based refresh
    config.Cache.RefreshMethod = CacheRefreshMethod.Event;
});
```

## Configuration

### Cache Refresh Methods

**1. Polling (Default)**

- Periodically refreshes cache at fixed intervals
- No Redis required

```csharp
config.Cache.RefreshMethod = CacheRefreshMethod.Polling;
config.Cache.Ttl = 300; // Refresh every 300 seconds
```

**2. Event-Based (Real-time)**

- Refreshes cache immediately when backend sends events
- Requires Redis for PubSub

```csharp
config.Cache.RefreshMethod = CacheRefreshMethod.Event;
config.Redis = new RedisConfig { Host = "localhost", Port = 6379 };
```

**3. Manual**

- No automatic cache refresh
- Manual refresh only

```csharp
config.Cache.RefreshMethod = CacheRefreshMethod.Manual;
```

### Logger Configuration

```csharp
config.Logger.Level = LogLevel.Information;
config.Logger.TimeOffset = 9; // +09:00 (Korea)
config.Logger.TimestampFormat = TimestampFormat.Local;
```

### Category-Based Logger

The SDK supports category-based logging for better module identification. When using dependency injection, the logger is automatically created with the "GatrixServerSDK" category:

```csharp
// The logger is automatically injected with category "GatrixServerSDK"
var logger = provider.GetRequiredService<GatrixLogger>();

logger.Info("Service initialized");
logger.Warn("Warning message");
logger.Error("Error occurred", new { error = "Details" });

// Output examples:
// [2025-11-12 10:48:10.454] [INFO] [GatrixServerSDK] Service initialized
// [2025-11-12 10:48:11.123] [WARN] [GatrixServerSDK] Warning message
// [2025-11-12 10:48:12.456] [ERROR] [GatrixServerSDK] Error occurred: { error = "Details" }
```

For custom categories, create a new logger instance:

```csharp
using Gatrix.ServerSDK.Utils;

var msLogger = provider.GetRequiredService<ILogger<GatrixLogger>>();
var loggerConfig = provider.GetRequiredService<LoggerConfig>();

// Create logger with custom category
var customLogger = new GatrixLogger(msLogger, loggerConfig, "MY-SERVICE");

customLogger.Info("Custom service message");
// Output: [2025-11-12 10:48:10.454] [INFO] [MY-SERVICE] Custom service message
```

## Usage

### Get Data

```csharp
// Get all game worlds from cache (no API call)
var gameWorlds = sdk.GetCachedGameWorlds();

// Get specific game world from cache (no API call)
var world = sdk.GetCachedGameWorldById("world-1");

// Get all popup notices from cache (no API call)
var notices = sdk.GetCachedPopupNotices();

// Get all surveys from cache (no API call)
var surveys = sdk.GetCachedSurveys();
```

### Refresh Cache

```csharp
// Manual refresh
await sdk.RefreshCacheAsync();
```

### Event Handling

```csharp
// Listen to specific event
sdk.On("gameworld.updated", async (event) =>
{
    Console.WriteLine($"Game world updated: {event.Data}");
});

// Listen to all events
sdk.On("*", async (event) =>
{
    Console.WriteLine($"Event: {event.Type}");
});

// Unregister listener
sdk.Off("gameworld.updated", handler);
```

### Service Discovery

Register your service instance with the backend:

```csharp
var response = await sdk.RegisterServiceAsync(new RegisterServiceInput
{
    Labels = new ServiceLabels
    {
        Service = "game-server",
        Group = "kr-1",
        CustomLabels = new Dictionary<string, object>
        {
            { "env", "production" },
            { "region", "ap-northeast-2" }
        }
    },
    Hostname = "game-server-1", // Optional: auto-detected from Environment.MachineName if omitted
    InternalAddress = "10.0.0.1", // Optional: auto-detected from first NIC if omitted
    Ports = new ServicePorts
    {
        Tcp = new[] { 7777 },
        Http = new[] { 8080 }
    },
    Status = "ready",
    Stats = new Dictionary<string, object>
    {
        { "cpuUsage", 45.5 },
        { "memoryUsage", 2048 }
    },
    Meta = new Dictionary<string, object>
    {
        { "capacity", 1000 }
    }
});

Console.WriteLine($"Service registered: {response.InstanceId}");
Console.WriteLine($"External address: {response.ExternalAddress}");
```

**Notes:**

- `hostname` is optional; if omitted, `Environment.MachineName` will be used
- `internalAddress` is optional; if omitted, the first non-internal IPv4 address will be used
- `externalAddress` is auto-detected by the backend from the request IP

## License

MIT
