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

## Usage

### Get Data

```csharp
// Get all game worlds
var gameWorlds = sdk.GetGameWorlds();

// Get specific game world
var world = sdk.GetGameWorldById("world-1");

// Get all popup notices
var notices = sdk.GetPopupNotices();

// Get all surveys
var surveys = sdk.GetSurveys();
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

## License

MIT

