# Gatrix Unity SDK

Gatrix Feature Flags Client SDK for Unity. Provides feature flag evaluation, context management, real-time updates, and editor monitoring tools.

## Installation

### Unity Package Manager (UPM)

Add to your `manifest.json`:

```json
{
  "dependencies": {
    "com.gatrix.unity.sdk": "file:../../path/to/gatrix-unity-sdk"
  }
}
```

Or use **Window > Package Manager > Add package from disk...** and select `package.json`.

## Quick Start

```csharp
using Gatrix.Unity.SDK;
using UnityEngine;

public class GameManager : MonoBehaviour
{
    async void Start()
    {
        var config = new GatrixClientConfig
        {
            ApiUrl = "https://your-api.example.com/api/v1",
            ApiToken = "your-client-api-token",
            AppName = "my-unity-game",
            Environment = "production",
            // Optional: use file-based storage for persistence
            StorageProvider = new FileStorageProvider(),
            // Optional: initial context
            Context = new GatrixContext
            {
                UserId = "user-123",
                DeviceId = SystemInfo.deviceUniqueIdentifier
            }
        };

        await GatrixBehaviour.InitializeAsync(config);
        Debug.Log("Gatrix SDK initialized!");
    }
}
```

## Feature Flag Access

```csharp
// Simple boolean check
bool isEnabled = GatrixBehaviour.Client.IsEnabled("new-ui");

// Variation methods with default values (never throws)
bool showBanner = GatrixBehaviour.Client.BoolVariation("show-banner", false);
string theme = GatrixBehaviour.Client.StringVariation("app-theme", "dark");
int maxRetries = GatrixBehaviour.Client.IntVariation("max-retries", 3);
float speed = GatrixBehaviour.Client.FloatVariation("game-speed", 1.0f);

// Get full variant info
Variant variant = GatrixBehaviour.Client.GetVariant("experiment-a");
Debug.Log($"Variant: {variant.Name}, Payload: {variant.Payload}");

// Variation with details (includes reason)
var details = GatrixBehaviour.Client.Features.BoolVariationDetails("feature-x", false);
Debug.Log($"Value: {details.Value}, Reason: {details.Reason}");

// Strict mode (throws if flag not found)
try
{
    string value = GatrixBehaviour.Client.Features.StringVariationOrThrow("required-flag");
}
catch (GatrixFeatureException e)
{
    Debug.LogError($"Flag error: {e.Code} - {e.Message}");
}
```

## FlagProxy

```csharp
// Get a FlagProxy for convenient access
var flags = GatrixBehaviour.Client.Features;
var allFlags = flags.GetAllFlags();

foreach (var flag in allFlags)
{
    var proxy = new FlagProxy(flag);
    Debug.Log($"{proxy.Name}: enabled={proxy.Enabled}, variant={proxy.GetVariantName()}");
}
```

## Context Management

```csharp
var client = GatrixBehaviour.Client;

// Update full context (triggers re-fetch)
await client.UpdateContextAsync(new GatrixContext
{
    UserId = "user-456",
    Properties = new Dictionary<string, object>
    {
        { "plan", "premium" },
        { "level", 10 }
    }
});

// Update a single field
await client.SetContextFieldAsync("userId", "user-789");

// Remove a field
await client.RemoveContextFieldAsync("deviceId");
```

## Watch for Changes

```csharp
// Watch a single flag
var unsubscribe = client.WatchFlag("my-flag", proxy =>
{
    Debug.Log($"Flag changed: {proxy.Name} = {proxy.Enabled}");
});

// Later: stop watching
unsubscribe();

// Watch with initial state (callback fires immediately with current state)
client.WatchFlagWithInitialState("my-flag", proxy =>
{
    Debug.Log($"Flag state: {proxy.Enabled}");
});

// Batch management with WatchFlagGroup
var group = client.CreateWatchGroup("ui-flags");
group.WatchFlag("dark-mode", p => { /* ... */ })
     .WatchFlag("show-ads", p => { /* ... */ })
     .WatchFlag("premium-ui", p => { /* ... */ });

// Unwatch all at once
group.Destroy();
```

## Explicit Sync Mode

For scenarios where you want to control when flag changes are applied:

```csharp
var config = new GatrixClientConfig
{
    // ... required fields
    Features = new FeaturesConfig
    {
        ExplicitSyncMode = true,
        RefreshInterval = 10
    }
};

await GatrixBehaviour.InitializeAsync(config);

// Flags are fetched in background but not applied to reads
// Check if there are pending changes
if (client.CanSyncFlags())
{
    // Apply the latest flags
    await client.SyncFlagsAsync(fetchNow: false);
}
```

## Events

```csharp
client.On(GatrixEvents.Ready, args =>
{
    Debug.Log("SDK is ready!");
});

client.On(GatrixEvents.Change, args =>
{
    Debug.Log("Flags changed!");
});

client.On(GatrixEvents.Error, args =>
{
    if (args.Length > 0 && args[0] is ErrorEvent errorEvt)
    {
        Debug.LogError($"SDK error: {errorEvt.Type}");
    }
});
```

### Event Handler Monitoring

Monitor registered event handlers to detect leaked or duplicate listeners:

```csharp
var emitter = client.Events;

// Get per-event handler counts
Dictionary<string, int> counts = emitter.GetAllListenerCounts();
foreach (var kvp in counts)
{
    Debug.Log($"{kvp.Key}: {kvp.Value} handlers");
}

// Total listener count across all events
int total = emitter.TotalListenerCount;

// Single event listener count
int changeCount = emitter.ListenerCount(GatrixEvents.Change);
```

> **Tip:** The Editor Monitor Window (Statistics tab) displays handler counts with red warnings for events with >3 handlers, helping detect listener leaks.

## Storage Providers

```csharp
// PlayerPrefs (default for small data)
config.StorageProvider = new PlayerPrefsStorageProvider("myapp_");

// File-based (persistent data path, recommended for production)
config.StorageProvider = new FileStorageProvider("gatrix");

// In-memory (no persistence, good for testing)
config.StorageProvider = new InMemoryStorageProvider();
```

## Offline Mode

```csharp
var config = new GatrixClientConfig
{
    // ... required fields
    OfflineMode = true,
    Features = new FeaturesConfig
    {
        Bootstrap = cachedFlags // Pre-loaded flags
    }
};
```

## Editor Tools

### Monitor Window
**Window > Gatrix > Monitor** - Real-time monitoring with 5 tabs:

| Tab | Contents |
|-----|----------|
| **Overview** | SDK state, connection info, network stats, metrics |
| **Flags** | Searchable flag list with variant, type, payload, version |
| **Events** | Live event log with start/stop capture |
| **Context** | Current evaluation context and custom properties |
| **Statistics** | Timing, flag access counts, missing flags, watch groups, **event handler counts** |

The Statistics tab includes per-event handler counts with red highlighting for counts >3, useful for detecting leaked or duplicate listeners.

### Inspector
Select the `[GatrixSDK]` GameObject to see live flag states, context, and controls in the Inspector.

### Project Settings
**Edit > Project Settings > Gatrix SDK** - SDK information and quick access to tools.

## Threading & Performance

The SDK is designed for Unity's single-threaded model:
- All event callbacks fire on the main thread
- Flag access methods are synchronous (read from in-memory cache)
- Network requests use async/await with proper SynchronizationContext handling
- `MainThreadDispatcher` ensures background task results are marshaled to the main thread
- **ValueTask**: All async methods return `ValueTask`/`ValueTask<T>` instead of `Task` for zero heap allocation on synchronous code paths (e.g., cached storage reads, in-memory operations)

## Cleanup

```csharp
// On application quit (handled automatically by GatrixBehaviour)
GatrixBehaviour.Shutdown();

// Or manual disposal
client.Dispose();
```

## API Reference

### GatrixClient
| Method | Description |
|--------|-------------|
| `StartAsync()` | Initialize and start the SDK |
| `Stop()` | Stop polling and metrics |
| `IsEnabled(flagName)` | Check if flag is enabled |
| `GetVariant(flagName)` | Get variant (never null) |
| `BoolVariation(flagName, default)` | Get boolean value |
| `StringVariation(flagName, default)` | Get string value |
| `NumberVariation(flagName, default)` | Get number value |
| `IntVariation(flagName, default)` | Get int value |
| `FloatVariation(flagName, default)` | Get float value |
| `JsonVariation(flagName, default)` | Get JSON as Dictionary |
| `UpdateContextAsync(context)` | Update evaluation context |
| `WatchFlag(flagName, callback)` | Watch for flag changes |
| `SyncFlagsAsync()` | Apply pending flag changes |
| `GetStats()` | Get SDK statistics |
| `Dispose()` | Clean up resources |

### GatrixEventEmitter
| Method/Property | Description |
|--------|-------------|
| `On(eventName, callback)` | Subscribe to event |
| `Once(eventName, callback)` | Subscribe once |
| `Off(eventName, callback?)` | Unsubscribe (all if no callback) |
| `OnAny(callback)` | Subscribe to all events |
| `Emit(eventName, args)` | Emit an event |
| `ListenerCount(eventName)` | Handler count for one event |
| `GetAllListenerCounts()` | Handler counts per event |
| `TotalListenerCount` | Total handlers across all events |
| `RemoveAllListeners()` | Remove all listeners |

## Example: Simplit

A simple UGUI-based dashboard example is included in `Samples~/Simplit/`. Import via **Package Manager > Gatrix Unity SDK > Samples > Import**.

Components: `SimplitMain` (config/screen manager), `SimplitDashboard` (flag grid), `SimplitFlagCard` (flag card with flash animation), `SimplitStatsPanel` (auto-refresh stats).

See `Samples~/Simplit/README.md` for setup instructions.
