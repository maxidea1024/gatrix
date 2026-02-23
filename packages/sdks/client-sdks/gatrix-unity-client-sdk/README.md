# Gatrix Unity SDK

> **Feature flags, A/B testing, and remote configuration — official Gatrix SDK for Unity.**

Change your game's behavior in real time without shipping a new build. Feature toggles, A/B experiments, game parameter tuning, gradual rollouts — all from the Gatrix Dashboard.

## 🚩 What is a Feature Flag?

A feature flag has two parts:

| Part | Type | Description |
|---|---|---|
| **State** (`enabled`) | `bool` | Is the feature on or off? — check with `IsEnabled()` |
| **Value** (`variant`) | `bool` `string` `number` `json` | A specific configuration value — read with `BoolVariation()`, `StringVariation()`, `FloatVariation()` |

A flag can be **enabled while also having a specific value** (e.g. `difficulty = "hard"`). State and value are independent — handle both.

### 💡 Quick Examples

#### 1. Feature Toggle (`IsEnabled`)

```csharp
if (GatrixBehaviour.Client.Features.IsEnabled("new-shop"))
    ShowNewShop();
else
    ShowLegacyShop();
```

#### 2. Remote Configuration (`Variation`)

```csharp
float speed   = GatrixBehaviour.Client.Features.FloatVariation("game-speed", 1.0f);
string theme  = GatrixBehaviour.Client.Features.StringVariation("app-theme", "dark");
int maxLevel  = GatrixBehaviour.Client.Features.IntVariation("max-level", 50);
```

#### 3. Conditional Targeting

```csharp
// The server evaluates context (level, region, tier...) and returns the right value.
// Your client just reads it — no branching logic needed here!
string difficulty = GatrixBehaviour.Client.Features.StringVariation("difficulty", "Normal");
```

---

## 🤔 Why Gatrix?

| Without Gatrix | With Gatrix |
|---|---|
| Ship a new build to change a value | Change it live from the dashboard |
| All players get the same experience | A/B test different experiences |
| Hard-coded feature flags | Real-time remote configuration |
| Risky big-bang releases | Gradual rollouts with instant rollback |

### 🔑 Real-World Scenarios

- **📱 Mobile App Store Review** — Submit with features disabled, enable right after approval. No second review needed.
- **⚖️ Regulatory Compliance** — Disable features by region instantly when laws change (GDPR, COPPA, etc.).
- **🚨 Emergency Kill Switch** — Disable a crashing feature in seconds, not hours.
- **🔬 A/B Testing** — Show different variants to different groups and measure impact.
- **📅 Uncertain Timing** — Code is always ready; business decides when to launch.

---

## 📐 Evaluation Model: Remote Evaluation Only

1. The SDK sends **context** (userId, environment, properties) to the Gatrix server.
2. The server evaluates all targeting rules remotely.
3. The SDK receives only the **final evaluated flag values** — no rules exposed to the client.

| | Remote Evaluation (Gatrix) | Local Evaluation |
|---|---|---|
| **Security** | ✅ Rules never leave the server | ⚠️ Rules visible to client |
| **Consistency** | ✅ Identical results across all SDKs | ⚠️ Each SDK must reimplement logic |
| **Payload** | ✅ Only final values (small) | ⚠️ Full rule set (large) |
| **Offline** | ⚠️ Cached values or bootstrap | ✅ Full offline after download |

> 🛡️ The SDK caches last known values locally. `fallbackValue` ensures your game never crashes due to network issues.

---

## 📦 Installation

### Unity Package Manager (UPM)

1. Open **Window > Package Manager**
2. Click **+** → **Add package from git URL...**
3. Enter: `https://github.com/your-org/gatrix-unity-sdk.git`

Or add to `Packages/manifest.json`:
```json
{
  "dependencies": {
    "com.gatrix.unity-sdk": "https://github.com/your-org/gatrix-unity-sdk.git"
  }
}
```

---

## 🚀 Quick Start

### Option A: Zero-Code Setup (Recommended)

1. Add a **GatrixBehaviour** component to a GameObject in your first scene.
2. Configure in the Inspector: API URL, API Token, App Name, Environment.
3. Use **Gatrix > Setup Wizard** for guided configuration.

### Option B: Code Setup

```csharp
using Gatrix;

public class GameManager : MonoBehaviour
{
    async void Start()
    {
        var config = new GatrixClientConfig
        {
            ApiUrl      = "https://your-api.example.com/api/v1",
            ApiToken    = "your-client-api-token",
            AppName     = "MyGame",
            Environment = "production",
            Features    = new FeaturesConfig
            {
                Context = new GatrixContext { UserId = "player-123" },
            },
        };

        await GatrixBehaviour.Client.StartAsync();

        float speed = GatrixBehaviour.Client.Features.FloatVariation("game-speed", 1.0f);
    }
}
```

---

## 🏁 Reading Feature Flags

```csharp
var features = GatrixBehaviour.Client.Features;

// Check enabled state
bool newUI = features.IsEnabled("new-ui");

// Typed variations (never throw — always returns fallback on error)
bool   showBanner = features.BoolVariation("show-banner", false);
string theme      = features.StringVariation("app-theme", "dark");
int    maxRetries = features.IntVariation("max-retries", 3);
float  gameSpeed  = features.FloatVariation("game-speed", 1.0f);
double dropRate   = features.DoubleVariation("item-drop-rate", 0.05);

// Full flag proxy
IFlagProxy proxy = features.GetFlag("feature-x");
Debug.Log($"Enabled: {proxy.IsEnabled}, Reason: {proxy.Reason}");
```

---

## 🔁 Watching for Changes

Two watch modes available:

| Method | Callback timing |
|---|---|
| `WatchRealtimeFlag` | Immediately when a fetch brings new data |
| `WatchSyncedFlag` | After `SyncFlags()` (when `ExplicitSyncMode = true`) |

```csharp
var features = GatrixBehaviour.Client.Features;

// Realtime watch — fires immediately on change
int handle = features.WatchRealtimeFlag("dark-mode", proxy =>
{
    ApplyDarkMode(proxy.IsEnabled);
});

// With initial state (fires immediately with current value, then on changes)
features.WatchRealtimeFlagWithInitialState("game-speed", proxy =>
{
    SetGameSpeed(proxy.FloatValue(1.0f));
});

// Synced watch — fires only after SyncFlags()
features.WatchSyncedFlagWithInitialState("difficulty", proxy =>
{
    SetDifficulty(proxy.StringValue("normal"));
});

// Unwatch
features.UnwatchFlag(handle);
```

---

## 🧩 Zero-Code Components

Attach these components to GameObjects — no scripting required:

| Component | Description |
|---|---|
| `GatrixFlagToggle` | Activate/deactivate a GameObject based on flag enabled state |
| `GatrixFlagText` | Set a TextMeshPro or UI.Text string from a flag value |
| `GatrixFlagFloat` | Drive an Animator float parameter from a flag value |
| `GatrixFlagImage` | Swap a Sprite based on flag variant name |

---

## 🛠️ Editor Tools

### Monitor Window
**Gatrix > Monitor** — Real-time view of all flags, metrics graphs, event log, and streaming status.

### Setup Wizard
**Gatrix > Setup Wizard** — Guided configuration for first-time setup.

### About Window
**Gatrix > About** — SDK version, links, and changelog.

### Custom Inspectors
Inspector overlays for `GatrixBehaviour` and Zero-Code components.

### Project Settings
**Edit > Project Settings > Gatrix** — Default configuration and editor preferences.

---

## 🌍 Context Management

### What Is Context?

**Context** is the set of properties describing the current user and environment. The Gatrix server uses context to decide which variant to return for each flag.

### Context Fields

| Field | Type | Description |
|---|---|---|
| `AppName` | `string` | App name (set at init, immutable) |
| `Environment` | `string` | Environment name (set at init, immutable) |
| `UserId` | `string` | Unique user identifier — most important for targeting |
| `SessionId` | `string` | Session identifier for session-scoped experiments |
| `Properties` | `Dictionary<string,string>` | Custom key-value pairs |

### Updating Context

```csharp
// Full context update (triggers re-fetch)
await GatrixBehaviour.Client.UpdateContextAsync(new GatrixContext
{
    UserId = "player-456",
    Properties = new Dictionary<string, string>
    {
        { "level", "42" },
        { "country", "KR" }
    }
});

```

> ⚠️ 모든 컨텍스트 변경은 자동 리페치를 트리거합니다. 반복 루프 안에서 컨텍스트를 업데이트하지 마세요. 여러 필드를 동시에 변경하려면 `UpdateContextAsync`를 사용하세요.

---

## ⏱️ Explicit Sync Mode

Control exactly when flag changes are applied to gameplay — the most important feature for timing-sensitive games.

```csharp
// Enable in config
config.Features.ExplicitSyncMode = true;

// Synced watch: callback fires only after SyncFlags()
features.WatchSyncedFlagWithInitialState("difficulty", proxy =>
{
    SetDifficulty(proxy.StringValue("normal")); // Only fires after sync
});

// Apply at a safe moment (loading screen, between rounds)
if (features.HasPendingSyncFlags())
    features.SyncFlags();
```

### Typical Sync Points

| Sync Point | Example |
|---|---|
| **Loading screen** | Scene transition, level loading |
| **Downtime** | After match ends, before next round starts |
| **Menu / Lobby** | Settings screen, event lobby |
| **Respawn** | After player death, before next spawn |

---

## 🔔 Events

```csharp
var events = GatrixBehaviour.Client.Events;

events.On(GatrixEvents.FlagsReady, args =>
    Debug.Log("SDK ready!"));

events.On(GatrixEvents.FlagsChange, args =>
    Debug.Log("Flags updated"));

events.Once(GatrixEvents.FlagsReady, args =>
    ShowWelcomeScreen());

events.OnAny((name, args) =>
    Debug.Log($"[Gatrix] {name}"));
```

**Available Events:**

| Event | Description |
|---|---|
| `flags.init` | SDK initialized |
| `flags.ready` | First successful fetch completed |
| `flags.fetch_start` / `fetch_success` / `fetch_error` / `fetch_end` | Fetch lifecycle |
| `flags.change` | Flags changed from server |
| `flags.error` | SDK error |
| `flags.sync` | Flags synchronized (explicit sync mode) |
| `flags.recovered` | SDK recovered from error |
| `flags.streaming_connected` / `disconnected` / `error` | Streaming state |

---

## 📡 Operating Modes

### Mode Comparison

| Mode | Latency | Bandwidth | Use Case |
|---|---|---|---|
| Streaming + Polling | Near-instant | Low | Production (online games) |
| Polling Only | ~30s | Low | Simple apps, WebGL |
| Offline | N/A | None | Testing, CI, air-gapped |

### Mode 1: Streaming + Polling (Default)

```csharp
config.Features.Streaming.Enabled = true;
config.Features.Streaming.Transport = GatrixStreamingTransport.WebSocket; // or Sse
config.Features.Streaming.WebSocket.ReconnectBase = 1;
config.Features.Streaming.WebSocket.ReconnectMax  = 30;
```

### Mode 2: Polling Only

```csharp
config.Features.Streaming.Enabled  = false;
config.Features.RefreshInterval    = 30f; // seconds
config.Features.DisableRefresh     = false;
```

### Mode 3: Offline

```csharp
config.Features.OfflineMode = true;
// Use with bootstrap data for fully offline operation
```

### WebGL Support

WebGL does not support native WebSocket or SSE. The SDK automatically falls back to polling when running in WebGL.

---

## 🔒 Performance & Threading

- Flag reads are synchronous and lock-free (atomic snapshot)
- All network I/O runs on background threads
- Unity callbacks are dispatched to the main thread via `UnitySynchronizationContext`
- Event emission collects callbacks under lock, then invokes outside lock to prevent deadlocks

---

## 🧹 Cleanup

```csharp
// Automatic: GatrixBehaviour cleans up on OnDestroy
// Manual:
GatrixBehaviour.Client.Stop();
```

---

## 📖 API Reference

### FeaturesClient (`GatrixBehaviour.Client.Features`)

| Method | Description |
|---|---|
| `IsEnabled(flagName)` | Returns `flag.enabled` |
| `BoolVariation(flagName, fallback)` | Boolean variant value |
| `StringVariation(flagName, fallback)` | String variant value |
| `IntVariation(flagName, fallback)` | Integer variant value |
| `FloatVariation(flagName, fallback)` | Float variant value |
| `DoubleVariation(flagName, fallback)` | Double variant value |
| `GetVariant(flagName)` | Full variant object |
| `GetFlag(flagName)` | Full flag proxy (`IFlagProxy`) |
| `GetAllFlags()` | All evaluated flags |
| `HasFlag(flagName)` | Check cache existence |
| `WatchRealtimeFlag(name, cb)` | Realtime watch |
| `WatchRealtimeFlagWithInitialState(name, cb)` | Realtime watch + immediate callback |
| `WatchSyncedFlag(name, cb)` | Synced watch |
| `WatchSyncedFlagWithInitialState(name, cb)` | Synced watch + immediate callback |
| `UnwatchFlag(handle)` | Remove a watcher |
| `CreateWatchGroup(name)` | Batch watcher management |
| `SyncFlags(fetchNow)` | Apply pending changes (explicit sync mode) |
| `HasPendingSyncFlags()` | Check if pending changes exist |
| `FetchFlagsAsync()` | Force server fetch |

### GatrixClient (`GatrixBehaviour.Client`)

| Method | Description |
|---|---|
| `StartAsync()` | Initialize and start fetching |
| `Stop()` | Stop and clean up |
| `UpdateContextAsync(ctx)` | Update full context |

---

## 🍳 Common Recipes

### Game Speed Tuning

```csharp
features.WatchRealtimeFlagWithInitialState("game-speed", proxy =>
    Time.timeScale = proxy.FloatValue(1.0f));
```

### Seasonal Event

```csharp
features.WatchRealtimeFlagWithInitialState("winter-event", proxy =>
    SetWinterEvent(proxy.IsEnabled));
```

### A/B Test UI Copy

```csharp
features.WatchRealtimeFlagWithInitialState("cta-button-text", proxy =>
    ctaButton.text = proxy.StringValue("Play Now"));
```

### Controlled Gameplay Updates (Explicit Sync)

```csharp
// Register synced watcher for gameplay-critical values
features.WatchSyncedFlagWithInitialState("enemy-hp-multiplier", proxy =>
    SetEnemyHpMultiplier(proxy.FloatValue(1.0f)));

// Apply at loading screen
IEnumerator LoadingScreen()
{
    yield return SceneManager.LoadSceneAsync("Game");
    features.SyncFlags();
}
```

### Login Flow with Context Update

```csharp
async void OnLogin(string userId, int level)
{
    await GatrixBehaviour.Client.UpdateContextAsync(new GatrixContext
    {
        UserId = userId,
        Properties = new Dictionary<string, string> { { "level", level.ToString() } }
    });
    // Flags now reflect the logged-in user
}
```

### Multi-Flag Dependency with Watch Group

```csharp
var group = features.CreateWatchGroup("shop-system");
group
    .WatchSyncedFlagWithInitialState("new-shop-enabled", p => SetShopEnabled(p.IsEnabled))
    .WatchSyncedFlagWithInitialState("discount-rate", p => SetDiscount(p.FloatValue(0f)));

// Both applied together at sync time — no partial state
features.SyncFlags();

// Cleanup
group.Destroy();
```

---

## ❓ FAQ & Troubleshooting

### 1. Flag changes are not detected in real time

| Cause | Solution |
|---|---|
| Polling interval too long | Reduce `RefreshInterval` (default: 30s) |
| `ExplicitSyncMode` is on | Call `SyncFlags()` at a safe point |
| Using `WatchSyncedFlag` without sync | Switch to `WatchRealtimeFlag` or call `SyncFlags()` |
| `OfflineMode` is enabled | Set `Features.OfflineMode = false` |
| Wrong `AppName` or `Environment` | Double-check config |

### 2. `WatchSyncedFlag` callback never fires

Enable `ExplicitSyncMode` and call `SyncFlags()`:
```csharp
config.Features.ExplicitSyncMode = true;
features.WatchSyncedFlagWithInitialState("my-flag", proxy => { ... });
features.SyncFlags();
```

### 3. Flags return fallback values after initialization

| Cause | Solution |
|---|---|
| SDK not ready yet | Wait for `flags.ready` event or use `WatchRealtimeFlagWithInitialState` |
| Wrong `AppName` / `Environment` | Match dashboard settings |
| Flag not assigned to this environment | Verify in dashboard |
| Network error on first fetch | Check `flags.fetch_error` event and logs |

### 4. Flag values change unexpectedly during gameplay

Enable `ExplicitSyncMode` and use `WatchSyncedFlag` for gameplay-critical values.

### 5. Memory leak warnings from callbacks

Always call `UnwatchFlag()` or `group.Destroy()` when the consumer is destroyed:
```csharp
void OnDestroy()
{
    features.UnwatchFlag(watchHandle);
    watchGroup?.Destroy();
}
```

---

## 📜 License

Copyright Gatrix. All Rights Reserved.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
