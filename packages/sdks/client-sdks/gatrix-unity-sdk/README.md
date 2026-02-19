# Gatrix Unity SDK

> **Feature flags, A/B testing, and remote configuration — built for Unity game developers.**

The Gatrix Unity SDK lets you control your game's behavior in real-time without shipping a new build. Toggle features, run A/B experiments, tune game parameters, and roll out changes gradually — all from the Gatrix dashboard.

---

## ✨ Why Gatrix?

| Without Gatrix | With Gatrix |
|---|---|
| Ship a new build to change a value | Change it live from the dashboard |
| All players get the same experience | A/B test different experiences |
| Hard-coded feature flags | Real-time remote configuration |
| Risky big-bang releases | Gradual rollouts with instant rollback |

---

## 📦 Installation

### Unity Package Manager (UPM)

Add to your `Packages/manifest.json`:

```json
{
  "dependencies": {
    "com.gatrix.unity.sdk": "file:../../path/to/gatrix-unity-sdk"
  }
}
```

Or use **Window → Package Manager → Add package from disk...** and select `package.json`.

---

## 🚀 Quick Start

### Option A: Zero-Code Setup (Recommended)

1. In the Unity menu, go to **Window → Gatrix → Setup Wizard**
2. Enter your API URL, token, and app name
3. Click **Create SDK Manager** — done!

### Option B: Code Setup

```csharp
using Gatrix.Unity.SDK;
using UnityEngine;

public class GameManager : MonoBehaviour
{
    async void Start()
    {
        var config = new GatrixClientConfig
        {
            ApiUrl    = "https://your-api.example.com/api/v1",
            ApiToken  = "your-client-api-token",
            AppName   = "my-unity-game",
            Environment = "production",
            Context   = new GatrixContext { UserId = "player-123" }
        };

        await GatrixBehaviour.InitializeAsync(config);
        Debug.Log("Gatrix ready!");
    }
}
```

---

## 🎮 Reading Feature Flags

```csharp
var features = GatrixBehaviour.Client.Features;

// Boolean check
bool newUIEnabled = features.IsEnabled("new-ui");

// Typed values with safe defaults (never throws)
bool   showBanner  = features.BoolVariation("show-banner", false);
string theme       = features.StringVariation("app-theme", "dark");
int    maxRetries  = features.IntVariation("max-retries", 3);
float  gameSpeed   = features.FloatVariation("game-speed", 1.0f);
double dropRate    = features.NumberVariation("item-drop-rate", 0.05);

// Full variant info (name + value)
Variant variant = features.GetVariant("experiment-a");
Debug.Log($"Variant: {variant.Name}, Value: {variant.Value}");

// Evaluation details (includes reason for the decision)
var details = features.BoolVariationDetails("feature-x", false);
Debug.Log($"Value: {details.Value}, Reason: {details.Reason}");
```

---

## 👁️ Watching for Changes

Gatrix provides two families of watch methods for different use cases:

### Realtime Watching

**`WatchRealtimeFlag`** fires the callback **immediately** whenever a flag change is fetched from the server, regardless of `ExplicitSyncMode`. Use this for debug UIs, monitoring dashboards, or any case where you always want the latest server value.

```csharp
var features = GatrixBehaviour.Client.Features;

// Watch a flag — callback fires on every server-side change
var unsubscribe = features.WatchRealtimeFlag("game-speed", proxy =>
{
    Debug.Log($"Server changed game-speed to: {proxy.FloatVariation(1f)}");
});

// Stop watching
unsubscribe();

// Watch with initial state (callback fires immediately with current value, then on changes)
features.WatchRealtimeFlagWithInitialState("dark-mode", proxy =>
{
    ApplyTheme(proxy.Enabled ? "dark" : "light");
});
```

### Synced Watching

**`WatchSyncedFlag`** fires the callback only when the **synchronized** flag store is updated. When `ExplicitSyncMode` is enabled, synced watchers wait until you call `SyncFlagsAsync()` to deliver changes. When `ExplicitSyncMode` is disabled, synced watchers behave identically to realtime watchers.

```csharp
var features = GatrixBehaviour.Client.Features;

// Synced watch — in ExplicitSyncMode, callback fires only after SyncFlagsAsync()
features.WatchSyncedFlagWithInitialState("difficulty", proxy =>
{
    SetDifficulty(proxy.StringVariation("normal"));
});

// Apply changes at a safe point (e.g., between rounds)
await features.SyncFlagsAsync();
// ↑ At this point, synced watchers will fire with the latest values
```

### Realtime vs Synced — When to Use Which?

| | Realtime | Synced |
|---|---|---|
| **Callback timing** | Immediately on fetch | After `SyncFlagsAsync()` (in ExplicitSyncMode) |
| **Use case** | Debug UI, monitoring, non-disruptive changes | Gameplay-affecting values that need controlled timing |
| **ExplicitSyncMode off** | Fires on change | Fires on change (same as realtime) |
| **ExplicitSyncMode on** | Fires on change | Fires only after `SyncFlagsAsync()` |

### Watch Groups

Watch multiple flags as a group and unsubscribe them all at once:

```csharp
var features = GatrixBehaviour.Client.Features;

var group = features.CreateWatchGroup("ui-flags");
group.WatchRealtimeFlag("dark-mode",   p => { /* ... */ })
     .WatchRealtimeFlag("show-ads",    p => { /* ... */ })
     .WatchSyncedFlag("premium-ui",    p => { /* ... */ });

// Unwatch all at once
group.Destroy();
```

---

## 🧩 Zero-Code Components

Drop these `MonoBehaviour` components onto any GameObject — no scripting required.

### `GatrixFlagToggle`
**Enable or disable GameObjects based on a flag.**

Perfect for: feature gating entire game systems, showing/hiding UI panels, enabling debug tools.

```
Inspector:
  Flag Name: "new-shop-ui"
  When Enabled: [ShopV2Panel]
  When Disabled: [ShopV1Panel]
```

---

### `GatrixFlagValue`
**Bind a flag's string/number value to a UI Text or TextMeshPro component.**

Perfect for: displaying server-driven text, showing A/B test copy, live countdown timers.

```
Inspector:
  Flag Name: "welcome-message"
  Format: "{0}"          ← {0} is replaced with the flag value
  Fallback Text: "Welcome!"
```

---

### `GatrixFlagImage`
**Swap sprites based on a flag's variant name.**

Perfect for: seasonal event banners, A/B testing button art, character skin rollouts.

```
Inspector:
  Flag Name: "hero-skin"
  Default Sprite: [DefaultHero]
  Variant Maps:
    "winter" → [WinterHero]
    "summer" → [SummerHero]
```

---

### `GatrixFlagMaterial`
**Swap materials or set shader properties based on a flag.**

Perfect for: visual A/B tests, seasonal shader effects, quality tier switching.

```
Inspector:
  Flag Name: "visual-quality"
  Mode: SwapMaterial
  Variant Maps:
    "high"   → [HighQualityMat]
    "medium" → [MediumQualityMat]
```

---

### `GatrixFlagTransform`
**Adjust position, rotation, or scale via flag values.**

Perfect for: live-tuning UI layout, adjusting spawn positions, A/B testing element placement.

```
Inspector:
  Flag Name: "button-scale"
  Mode: Scale
  Component: Y
```

---

### `GatrixFlagColor`
**Tint UI Graphics or Renderers based on flag state or variant.**

Perfect for: A/B testing UI color themes, status indicators, seasonal color changes.

```
Inspector:
  Flag Name: "ui-theme"
  Mode: ByVariant
  Variant Colors:
    "red"  → Color(1, 0.2, 0.2)
    "blue" → Color(0.2, 0.5, 1)
  Animate: true  ← smooth color lerp
```

---

### `GatrixFlagCanvas`
**Fade entire UI panels in/out using CanvasGroup.**

More powerful than GatrixFlagToggle for UI — supports alpha fading and disabling raycasts without hiding.

```
Inspector:
  Flag Name: "premium-hud"
  Enabled Alpha: 1.0
  Disabled Alpha: 0.0
  Animate: true  ← smooth fade
```

---

### `GatrixFlagAudio`
**Play different AudioClips based on flag state or variant.**

Perfect for: A/B testing music/SFX, seasonal audio, enabling special sound effects.

```
Inspector:
  Flag Name: "background-music"
  Mode: ByVariant
  Variant Clips:
    "winter" → [WinterTheme]
    "summer" → [SummerTheme]
  Play On Change: true
```

---

### `GatrixFlagAnimator`
**Control Animator parameters based on flag state or variant.**

Perfect for: enabling special animations, A/B testing character animations, triggering cutscenes.

```
Inspector:
  Flag Name: "hero-animation"
  Bool Parameter: "IsSpecialMode"
  Enabled Trigger: "SpecialEnter"
  Disabled Trigger: "SpecialExit"
```

---

### `GatrixFlagParticles`
**Play, stop, or pause ParticleSystems based on a flag.**

Perfect for: seasonal particle effects, enabling special VFX, A/B testing visual feedback.

```
Inspector:
  Flag Name: "snow-effect"
  On Enabled: Play
  On Disabled: Stop
  With Children: true
```

---

### `GatrixFlagEvent`
**Fire UnityEvents when a flag changes.**

Perfect for: triggering custom game logic, integrating with existing event systems.

```
Inspector:
  Flag Name: "tutorial-mode"
  On Enabled: [TutorialManager.StartTutorial()]
  On Disabled: [TutorialManager.StopTutorial()]
```

---

### `GatrixEventListener`
**Hook into SDK lifecycle events visually.**

Perfect for: showing loading spinners while SDK initializes, handling errors gracefully.

```
Inspector:
  On Ready: [UIManager.HideLoadingScreen()]
  On Error: [UIManager.ShowErrorBanner()]
```

---

### `GatrixFlagLogger`
**Log flag changes to the Unity Console.**

Perfect for: debugging flag behavior during development.

---

### `GatrixVariantSwitch`
**Activate different child GameObjects based on variant name.**

Perfect for: multi-variant UI layouts, switching between game modes.

---

### `GatrixFlagSceneRedirect`
**Load a different scene based on a flag.**

Perfect for: A/B testing onboarding flows, seasonal event scenes, gradual rollouts of new areas.

---

## 🛠️ Editor Tools

### Monitor Window
**Window → Gatrix → Monitor**

A real-time dashboard for your SDK state:

| Tab | What you see |
|-----|-------------|
| **Overview** | SDK health, connection ID, fetch stats (count, errors, recoveries), streaming stats (events, errors, recoveries, transport type), and scene configuration |
| **Flags** | All flags with live ON/OFF state, variant, and value. Highlights recently changed flags in yellow. |
| **Events** | Live event log — every SDK event with timestamp and details |
| **Context** | Current evaluation context (userId, sessionId, custom properties) |
| **Metrics** | Dual-view metrics: **Graph** mode with real-time time-series charts, or **Report** mode with detailed tables. Per-flag timeline charts for boolean/variant state history. |
| **Stats** | Detailed counters, streaming counters, flag access counts, variant hit counts, missing flags, event handler leak detection |

#### Metrics Graph View
The **Metrics** tab includes interactive time-series graphs rendered directly in the Editor:
- **Network Activity** — fetches, updates, and errors plotted over time
- **Impressions & Delivery** — impression count and metrics sent over time
- **Streaming** — reconnection attempts, stream events, and stream errors
- Per-flag timeline charts showing boolean and variant state changes over time
- Configurable collection interval (1 second) and data retention (300 seconds)
- Auto-scaling Y axis, grid lines, time axis labels, and color-coded legends
- Time offset slider for scrolling through historical data
- Toggle between **Graph** and **Report** views with a single click

**Quick actions in the toolbar:**
- **⚡ Sync** — appears when explicit sync mode has pending changes
- **↻** — manual refresh
- **● Auto / ○ Auto** — toggle auto-refresh
- **Setup ↗** — open Setup Wizard
- **About** — SDK version info

---

### Setup Wizard
**Window → Gatrix → Setup Wizard**

Guided setup for first-time configuration. Creates a pre-configured SDK Manager prefab.

---

### Custom Inspectors
Every Gatrix component has a polished custom inspector:
- **◆ GATRIX** title bar with blue accent
- **● LIVE** badge during Play Mode
- **Live flag status** showing current ON/OFF state and variant
- **Monitor ↗** quick-access button to jump to the Monitor window
- Organized groups with clear labels

---

### Project Settings
**Edit → Project Settings → Gatrix SDK**

Global settings and shortcuts accessible from the Project Settings window.

---

## 🔄 Context Management

Context determines how flags are evaluated for each player.

```csharp
var features = GatrixBehaviour.Client.Features;

// Update full context (triggers re-fetch)
await features.UpdateContextAsync(new GatrixContext
{
    UserId    = "player-456",
    SessionId = "session-abc",
    Properties = new Dictionary<string, object>
    {
        { "plan",    "premium" },
        { "level",   42 },
        { "country", "KR" }
    }
});

// Update a single field
await features.SetContextFieldAsync("level", 43);

// Remove a field
await features.RemoveContextFieldAsync("plan");
```

---

## ⏱️ Explicit Sync Mode

Control exactly when flag changes are applied to your game — useful for preventing mid-session disruptions.

```csharp
var config = new GatrixClientConfig
{
    Features = new FeaturesConfig { ExplicitSyncMode = true }
};

await GatrixBehaviour.InitializeAsync(config);

var features = GatrixBehaviour.Client.Features;

// Flags update in the background but don't affect gameplay yet.
// Use WatchSyncedFlag to react only when you apply changes:
features.WatchSyncedFlagWithInitialState("difficulty", proxy =>
{
    SetDifficulty(proxy.StringVariation("normal"));
});

// Apply changes at a safe moment (e.g., between rounds):
if (features.CanSyncFlags())
{
    await features.SyncFlagsAsync(fetchNow: false);
}
```

The **Monitor → Flags** tab shows both the active flags and pending changes side-by-side when in explicit sync mode.

---

## 📡 Events

```csharp
var client = GatrixBehaviour.Client;

client.On(GatrixEvents.Ready,       args => Debug.Log("SDK Ready"));
client.On(GatrixEvents.Change,      args => Debug.Log("Flags Updated"));
client.On(GatrixEvents.Error,       args => Debug.LogError("SDK Error"));
client.On(GatrixEvents.FetchEnd,    args => Debug.Log("Fetch complete"));
client.On(GatrixEvents.Impression,  args => Debug.Log("Impression tracked"));

// Streaming events
client.On(GatrixEvents.FlagsStreamingConnected,    args => Debug.Log("Streaming connected"));
client.On(GatrixEvents.FlagsStreamingDisconnected, args => Debug.Log("Streaming disconnected"));
client.On(GatrixEvents.FlagsStreamingReconnecting, args => Debug.Log("Streaming reconnecting"));
client.On(GatrixEvents.FlagsStreamingError,        args => Debug.LogWarning("Streaming error"));

// Subscribe once
client.Once(GatrixEvents.Ready, args => ShowWelcomeScreen());

// Subscribe to all events (useful for debugging)
client.Events.OnAny((eventName, args) => Debug.Log($"[Gatrix] {eventName}"));
```

---

## 💾 Storage & Offline Mode

```csharp
// File-based persistence (recommended for production)
config.StorageProvider = new FileStorageProvider("gatrix");

// Offline mode with bootstrap data (for testing or no-network scenarios)
config.OfflineMode = true;
config.Features.Bootstrap = cachedFlagData;
```

---

## ⚡ Performance & Threading

The SDK is designed for Unity's single-threaded model:

- **Synchronous flag reads** — `IsEnabled()`, `BoolVariation()` etc. read from an in-memory cache. Zero async overhead.
- **Main thread callbacks** — All event callbacks and flag change notifications fire on the main thread.
- **ValueTask** — Async methods use `ValueTask`/`ValueTask<T>` for zero heap allocation on synchronous code paths.
- **Thread-safe metrics** — Metrics bucket uses locking; events are dispatched via `SynchronizationContext`.
- **MainThreadDispatcher** — Background task results are automatically marshaled to the main thread.

---

## 📡 Streaming Transport

The SDK supports two real-time streaming transports for receiving flag updates:

| Transport | Platforms | Details |
|-----------|-----------|-------------|
| **SSE** (Server-Sent Events) | All platforms | Default. One-way HTTP streaming. |
| **WebSocket** | All platforms including WebGL | Full-duplex, lower latency. Auto-ping to keep connection alive. |

```csharp
var config = new GatrixClientConfig
{
    // ...
    Features = new FeaturesConfig
    {
        Streaming = new StreamingConfig
        {
            Transport = StreamingTransport.WebSocket  // default: SSE
        }
    }
};
```

### WebGL Support

The SDK fully supports Unity **WebGL** builds:

- WebSocket transport automatically uses a **JavaScript interop layer** (`GatrixWebSocket.jslib`) on WebGL since `System.Net.WebSockets.ClientWebSocket` is unavailable in the browser sandbox.
- The SDK selects the correct WebSocket implementation via `GatrixWebSocketFactory` — no manual configuration needed.
- Supported platforms: **Windows, macOS, Linux, Android, iOS, and WebGL**.

### Cross-Platform WebSocket Abstraction

| Class | Platform | Implementation |
|-------|----------|----------------|
| `StandaloneWebSocket` | Desktop, Android, iOS | Wraps `System.Net.WebSockets.ClientWebSocket` with event-based polling |
| `WebGLWebSocket` | WebGL | JavaScript interop via `GatrixWebSocket.jslib` using browser's native WebSocket API |
| `GatrixWebSocketFactory` | All | Auto-selects the correct implementation at runtime |

---

## 🧹 Cleanup

```csharp
// Handled automatically by GatrixBehaviour on application quit
GatrixBehaviour.Shutdown();

// Or manual disposal
GatrixBehaviour.Client.Dispose();
```

---

## 📖 API Reference

### FeaturesClient (via `GatrixBehaviour.Client.Features`)

| Method | Returns | Description |
|--------|---------|-------------|
| `IsEnabled(flagName)` | `bool` | Check if flag is enabled |
| `HasFlag(flagName)` | `bool` | Check if flag exists in cache |
| `GetVariant(flagName)` | `Variant` | Get variant (never null) |
| `BoolVariation(flag, default)` | `bool` | Get boolean value |
| `StringVariation(flag, default)` | `string` | Get string value |
| `IntVariation(flag, default)` | `int` | Get integer value |
| `FloatVariation(flag, default)` | `float` | Get float value |
| `NumberVariation(flag, default)` | `double` | Get double value |
| `JsonVariation(flag, default)` | `Dictionary` | Get JSON as Dictionary |
| `BoolVariationDetails(flag, default)` | `VariationResult<bool>` | Bool value with evaluation reason |
| `StringVariationDetails(flag, default)` | `VariationResult<string>` | String value with evaluation reason |
| `UpdateContextAsync(ctx)` | `UniTask` | Update evaluation context |
| `SetContextFieldAsync(key, value)` | `UniTask` | Update a single context field |
| `RemoveContextFieldAsync(key)` | `UniTask` | Remove a context field |
| `WatchRealtimeFlag(flag, callback)` | `Action` | Watch for real-time flag changes |
| `WatchRealtimeFlagWithInitialState(flag, cb)` | `Action` | Watch real-time + fire immediately |
| `WatchSyncedFlag(flag, callback)` | `Action` | Watch for synced flag changes |
| `WatchSyncedFlagWithInitialState(flag, cb)` | `Action` | Watch synced + fire immediately |
| `CreateWatchGroup(name)` | `WatchFlagGroup` | Create a named group of watchers |
| `SyncFlagsAsync()` | `UniTask` | Apply pending flag changes |
| `CanSyncFlags()` | `bool` | Check if there are pending sync changes |
| `SetExplicitSyncMode(enabled)` | `void` | Toggle explicit sync mode at runtime |
| `GetStats()` | `FeaturesStats` | Get SDK statistics |

### GatrixClient (via `GatrixBehaviour.Client`)

| Method | Returns | Description |
|--------|---------|-------------|
| `StartAsync()` | `UniTask` | Initialize and start the SDK |
| `Stop()` | `void` | Stop polling and metrics |
| `On(event, callback)` | `GatrixClient` | Subscribe to an SDK event |
| `Once(event, callback)` | `GatrixClient` | Subscribe once |
| `Off(event, callback?)` | `GatrixClient` | Unsubscribe |
| `OnAny(callback)` | `GatrixClient` | Subscribe to all events |
| `OffAny(callback)` | `GatrixClient` | Unsubscribe from all events |
| `GetStats()` | `GatrixSdkStats` | Get combined SDK statistics |
| `Dispose()` | `void` | Clean up resources |

### GatrixEventEmitter (via `GatrixBehaviour.Client.Events`)

| Method/Property | Description |
|----------------|-------------|
| `On(event, callback)` | Subscribe to event |
| `Once(event, callback)` | Subscribe once |
| `Off(event, callback?)` | Unsubscribe |
| `OnAny(callback)` | Subscribe to all events |
| `OffAny(callback)` | Unsubscribe from all events |
| `Emit(event, args)` | Emit an event |
| `ListenerCount(event)` | Handler count for one event |
| `TotalListenerCount` | Total handlers across all events |
| `RemoveAllListeners()` | Remove all listeners |

---

## 🎯 Common Recipes

### Game Speed Tuning
```csharp
var features = GatrixBehaviour.Client.Features;
features.WatchRealtimeFlagWithInitialState("game-speed", proxy =>
{
    Time.timeScale = proxy.FloatVariation(1f);
});
```

### Seasonal Event
```csharp
// Use GatrixFlagToggle component on your seasonal content root
// Or in code:
var features = GatrixBehaviour.Client.Features;
features.WatchRealtimeFlagWithInitialState("winter-event", proxy =>
{
    winterEventRoot.SetActive(proxy.Enabled);
});
```

### A/B Test UI Copy
```csharp
// Use GatrixFlagValue component on your Text/TMP component
// Or in code:
var features = GatrixBehaviour.Client.Features;
features.WatchRealtimeFlagWithInitialState("cta-button-text", proxy =>
{
    ctaButton.text = proxy.StringVariation("Play Now");
});
```

### Gradual Feature Rollout
```csharp
// Check flag before showing new feature
var features = GatrixBehaviour.Client.Features;
if (features.IsEnabled("new-inventory-system"))
{
    newInventory.SetActive(true);
    legacyInventory.SetActive(false);
}
```

### Controlled Gameplay Updates (Explicit Sync)
```csharp
// Use synced watchers for gameplay-affecting values
var features = GatrixBehaviour.Client.Features;
features.WatchSyncedFlagWithInitialState("enemy-hp-multiplier", proxy =>
{
    enemyHpMultiplier = proxy.FloatVariation(1.0f);
});

// Apply at a safe point (e.g., between rounds)
if (features.CanSyncFlags())
{
    await features.SyncFlagsAsync();
}
```

---

## 🔗 Links

- [Gatrix Dashboard](https://app.gatrix.io)
- [Documentation](https://docs.gatrix.io)
- [한국어 문서 (README.ko.md)](./README.ko.md)
- [Known Issues & Gotchas](./ISSUES.md)
- [Support](mailto:support@gatrix.io)
