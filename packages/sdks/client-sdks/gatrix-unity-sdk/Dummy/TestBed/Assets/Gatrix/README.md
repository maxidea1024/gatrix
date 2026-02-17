# Gatrix Unity SDK

Gatrix Client SDK for Unity. Provides feature flag evaluation, context management, real-time updates, and editor monitoring tools.

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
                UserId = "user-123"
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
Debug.Log($"Variant: {variant.Name}, Value: {variant.Value}");

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

// Get a FlagProxy for convenient access
var proxy = GatrixBehaviour.Client.GetFlag("new-ui");
Debug.Log($"{proxy.Name}: exists={proxy.Exists}, enabled={proxy.Enabled}, variant={proxy.Variant.Name}");

// You can also get proxies for all flags
var allFlags = GatrixBehaviour.Client.GetAllFlags();
foreach (var flag in allFlags)
{
    var p = GatrixBehaviour.Client.GetFlag(flag.Name);
    Debug.Log($"{p.Name}: {p.Enabled}");
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
await client.RemoveContextFieldAsync("plan");
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
    Features = new FeaturesConfig { ExplicitSyncMode = true }
};

await GatrixBehaviour.InitializeAsync(config);

// Inside your game loop or logic
if (client.CanSyncFlags())
{
    await client.SyncFlagsAsync(fetchNow: false);
}
```

## Events & Monitoring

```csharp
client.On(GatrixEvents.Ready, args => Debug.Log("SDK Ready"));
client.On(GatrixEvents.Change, args => Debug.Log("Flags Updated"));
```

### Event Handler Monitoring
The SDK helps you detect listener leaks. You can check handler counts via code:
```csharp
int total = client.Events.TotalListenerCount;
var counts = client.Events.GetAllListenerCounts();
```
> **Tip:** The **Monitor Window (Statistics tab)** highlights events with >3 handlers in red to help you debug leaks.

## Storage & Offline

```csharp
// Recommended for production
config.StorageProvider = new FileStorageProvider("gatrix");

// Offline mode with bootstrap data
config.OfflineMode = true;
config.Features.Bootstrap = cachedFlags;
```

---

## Zero-Code Components

The Gatrix SDK includes ready-to-use `MonoBehaviour` components to integrate feature flags without coding.

| Component | Description |
|-----------|-------------|
| **`GatrixFlagToggle`** | Enable/Disable GameObjects based on flag state. |
| **`GatrixFlagValue`** | Bind flag values to UI `Text` or `TextMeshPro`. |
| **`GatrixFlagImage`** | Swap Sprites on `Image` or `SpriteRenderer` based on variant. |
| **`GatrixFlagTransform`** | Adjust Position/Rotation/Scale via flag values. |
| **`GatrixFlagMaterial`** | Dynamic Materials and shader property updates. |
| **`GatrixFlagEvent`** | Fire `UnityEvent` on flag/variant changes. |
| **`GatrixEventListener`** | Hook into SDK lifecycle (Ready, Error) visually. |
| **`GatrixFlagLogger`** | Log flag changes to console for debugging. |
| **`GatrixVariantSwitch`** | Switch child objects based on variant name. |
| **`GatrixFlagSceneRedirect`** | Conditional scene loading at start. |

---

## Editor & Tools

### Prefab Creator (Context Menu)
Right-click in the **Hierarchy** or use the top menu **GameObject > Gatrix** to quickly add pre-configured objects:
*   **SDK Manager**: Full SDK setup with event listener.
*   **UI > Flag Text/Image**: UI elements with bindings.
*   **Logic > Flag Toggle/Switch**: Flow control objects.

### Monitor Window
**Window > Gatrix > Monitor**
*   **Overview**: Real-time health and network stats.
*   **Flags**: Searchable list with change highlighting.
*   **Statistics**: Advanced metrics (hit counts, ETags, handler leaks).

### Professional Custom Inspectors
*   **Organized UI**: Stylized headers and groups (NGUI/Odin style).
*   **Live Feedback**: **● LIVE** status badges and real-time values shown during Play Mode.
*   **Safety**: Searchable dropdowns for flag names.

---

### Project Settings
**Edit > Project Settings > Gatrix SDK** - Global settings and tool shortcuts.

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
| `HasFlag(flagName)` | Check if flag exists in cache |
| `GetFlag(flagName)` | Get a `FlagProxy` (factory method) |
| `GetVariant(flagName)` | Get variant (never null, returns `$missing` if not found) |
| `BoolVariation(flagName, default)` | Get boolean value |
| `StringVariation(flagName, default)` | Get string value |
| `NumberVariation(flagName, default)` | Get number value (double) |
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
