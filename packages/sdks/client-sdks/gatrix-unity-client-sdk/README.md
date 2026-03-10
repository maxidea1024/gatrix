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
if (GatrixSDK.Features.IsEnabled("new-shop"))
    ShowNewShop();
else
    ShowLegacyShop();
```

#### 2. Remote Configuration (`Variation`)

```csharp
float speed   = GatrixSDK.Features.FloatVariation("game-speed", 1.0f);
string theme  = GatrixSDK.Features.StringVariation("app-theme", "dark");
int maxLevel  = GatrixSDK.Features.IntVariation("max-level", 50);
```

#### 3. Conditional Targeting

```csharp
// The server evaluates context (level, region, tier...) and returns the right value.
// Your client just reads it — no branching logic needed here!
string difficulty = GatrixSDK.Features.StringVariation("difficulty", "Normal");
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

1. The SDK sends **context** (userId, properties) to the Gatrix server.
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
2. Configure in the Inspector: API URL, API Token, App Name.
3. Use **Gatrix > Setup Wizard** for guided configuration.

### Option B: Code Setup

```csharp
using Gatrix.Unity.SDK;

public class GameManager : MonoBehaviour
{
    async void Start()
    {
        var config = new GatrixClientConfig
        {
            ApiUrl      = "https://your-api.example.com/api/v1",
            ApiToken    = "your-client-api-token",
            AppName     = "MyGame",
            Features    = new FeaturesConfig
            {
                Context = new GatrixContext { UserId = "player-123" },
            },
        };

        await GatrixSDK.InitializeAsync(config);

        float speed = GatrixSDK.Features.FloatVariation("game-speed", 1.0f);
    }
}
```

---

## 🏁 Reading Feature Flags

```csharp
var features = GatrixSDK.Features;

// Check enabled state
bool newUI = features.IsEnabled("new-ui");

// Typed variations (never throw — always returns fallback on error)
bool   showBanner = features.BoolVariation("show-banner", false);
string theme      = features.StringVariation("app-theme", "dark");
int    maxRetries = features.IntVariation("max-retries", 3);
float  gameSpeed  = features.FloatVariation("game-speed", 1.0f);
double dropRate   = features.DoubleVariation("item-drop-rate", 0.05);

// Full evaluated flag
EvaluatedFlag flag = features.GetFlag("feature-x");
Debug.Log($"Enabled: {flag.Enabled}, Variant: {flag.Variant?.Name}");
```

---

## 🔁 Watching for Changes

Two watch modes available:

| Method | Callback timing |
|---|---|
| `WatchRealtimeFlag` | Immediately when a fetch brings new data |
| `WatchSyncedFlag` | After `SyncFlagsAsync()` (when `ExplicitSyncMode = true`) |

```csharp
var features = GatrixSDK.Features;

// Realtime watch — fires immediately on change (returns Action to unsubscribe)
Action unwatch = features.WatchRealtimeFlag("dark-mode", flag =>
{
    ApplyDarkMode(flag.Enabled);
});

// With initial state (fires immediately with current value, then on changes)
features.WatchRealtimeFlagWithInitialState("game-speed", flag =>
{
    SetGameSpeed(flag.FloatValue(1.0f));
});

// Synced watch — fires only after SyncFlagsAsync()
features.WatchSyncedFlagWithInitialState("difficulty", flag =>
{
    SetDifficulty(flag.StringValue("normal"));
});

// Unwatch (call the returned Action)
unwatch();
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

**Context** is the set of properties describing the current user and session. The Gatrix server uses context to decide which variant to return for each flag.

### Context Fields

| Field | Type | Description |
|---|---|---|
| `AppName` | `string` | App name (set at init, immutable) |
| `UserId` | `string` | Unique user identifier — most important for targeting |
| `SessionId` | `string` | Session identifier for session-scoped experiments |
| `Properties` | `Dictionary<string,string>` | Custom key-value pairs |

### Updating Context

```csharp
// Full context update (triggers re-fetch)
await GatrixSDK.Client.UpdateContextAsync(new GatrixContext
{
    UserId = "player-456",
    Properties = new Dictionary<string, string>
    {
        { "level", "42" },
        { "country", "KR" }
    }
});

```

> ⚠️ All context changes trigger an automatic re-fetch. Do not update context in a loop. Use `UpdateContextAsync` to change multiple fields at once.

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
    await features.SyncFlagsAsync();
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
var events = GatrixSDK.Events;

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
GatrixSDK.Client.Stop();
```

---

## 📖 API Reference

### FeaturesClient (`GatrixSDK.Features`)

| Method | Return | Description |
|---|---|---|
| `StartAsync()` | `UniTask` | Initialize and start fetching |
| `Stop()` | `void` | Stop polling, streaming, metrics |
| `IsReady()` | `bool` | True after first successful fetch |
| `IsOfflineMode()` | `bool` | True if offline mode is enabled |
| `IsFetching()` | `bool` | True if a fetch is in progress |
| `GetError()` | `Exception` | Last error, or null |
| `GetConnectionId()` | `string` | Server-assigned connection ID |
| `IsEnabled(flagName, forceRealtime = true)` | `bool` | Flag enabled state |
| `GetFlag(flagName, forceRealtime = true)` | `EvaluatedFlag` | Full evaluated flag (tracks metrics) |
| `GetFlagRaw(flagName, forceRealtime = true)` | `EvaluatedFlag` | Full evaluated flag (no metrics tracking) |
| `GetVariant(flagName, forceRealtime = true)` | `Variant` | Variant object (never null) |
| `HasFlag(flagName)` | `bool` | Check cache existence |
| `GetAllFlags(forceRealtime = true)` | `List<EvaluatedFlag>` | All evaluated flags |
| `Variation(flagName, fallback, forceRealtime = true)` | `string` | Variant name |
| `BoolVariation(flagName, fallback, forceRealtime = true)` | `bool` | Boolean value |
| `StringVariation(flagName, fallback, forceRealtime = true)` | `string` | String value |
| `IntVariation(flagName, fallback, forceRealtime = true)` | `int` | Integer value |
| `FloatVariation(flagName, fallback, forceRealtime = true)` | `float` | Float value |
| `DoubleVariation(flagName, fallback, forceRealtime = true)` | `double` | Double value |
| `JsonVariation(flagName, fallback, forceRealtime = true)` | `Dictionary<string,object>` | JSON value |
| `BoolVariationOrThrow(flagName, forceRealtime = true)` | `bool` | Throws if not found |
| `StringVariationOrThrow(flagName, forceRealtime = true)` | `string` | Throws if not found |
| `JsonVariationOrThrow(flagName, forceRealtime = true)` | `Dictionary<string,object>` | Throws if not found |
| `BoolVariationDetails(flagName, fallback, forceRealtime = true)` | `VariationResult<bool>` | Value + reason + metadata |
| `StringVariationDetails(flagName, fallback, forceRealtime = true)` | `VariationResult<string>` | Value + reason + metadata |
| `JsonVariationDetails(flagName, fallback, forceRealtime = true)` | `VariationResult<Dictionary<string,object>>` | Value + reason + metadata |
| `GetContext()` | `GatrixContext` | Deep copy of current context |
| `UpdateContextAsync(ctx)` | `UniTask` | Replace context and re-fetch |
| `SyncFlagsAsync(fetchNow = true)` | `UniTask` | Apply pending changes (explicit sync mode) |
| `HasPendingSyncFlags()` | `bool` | Check if pending changes exist |
| `FetchFlagsAsync()` | `UniTask` | Force server fetch |
| `IsExplicitSync()` | `bool` | Check if explicit sync mode is enabled |
| `SetExplicitSyncMode(enabled)` | `void` | Toggle explicit sync mode at runtime |
| `WatchRealtimeFlag(flagName, callback, name?)` | `Action` | Realtime watch (call returned Action to unsubscribe) |
| `WatchRealtimeFlagWithInitialState(flagName, callback, name?)` | `Action` | Realtime watch + immediate callback |
| `WatchSyncedFlag(flagName, callback, name?)` | `Action` | Synced watch |
| `WatchSyncedFlagWithInitialState(flagName, callback, name?)` | `Action` | Synced watch + immediate callback |
| `CreateWatchFlagGroup(name)` | `WatchFlagGroup` | Create named group for batch management |
| `GetStats()` | `FeaturesStats` | Full statistics snapshot |
| `GetLightStats()` | `FeaturesLightStats` | Lightweight stats (no collection copying) |

### GatrixSDK (static shorthand)

| Member | Description |
|---|---|
| `GatrixSDK.Features` | Shorthand for `GatrixBehaviour.Client.Features` |
| `GatrixSDK.Events` | Shorthand for `GatrixBehaviour.Client.Events` |
| `GatrixSDK.Client` | Active `GatrixClient` instance |
| `GatrixSDK.IsInitialized` | True if SDK is started |
| `GatrixSDK.InitializeAsync(config)` | Code-based initialization |
| `GatrixSDK.Shutdown()` | Manual shutdown |

### GatrixBehaviour (static)

| Member | Description |
|---|---|
| `GatrixBehaviour.Client` | Active `GatrixClient` instance |
| `GatrixBehaviour.IsInitialized` | True if SDK is started |
| `GatrixSDK.InitializeAsync(config)` | Code-based initialization |
| `GatrixSDK.Shutdown()` | Manual shutdown |

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
    await features.SyncFlagsAsync();
}
```

### Login Flow with Context Update

```csharp
async void OnLogin(string userId, int level)
{
    await GatrixSDK.Client.UpdateContextAsync(new GatrixContext
    {
        UserId = userId,
        Properties = new Dictionary<string, string> { { "level", level.ToString() } }
    });
    // Flags now reflect the logged-in user
}
```

### Multi-Flag Dependency with Watch Group

```csharp
var group = features.CreateWatchFlagGroup("shop-system");
group
    .WatchSyncedFlagWithInitialState("new-shop-enabled", f => SetShopEnabled(f.Enabled))
    .WatchSyncedFlagWithInitialState("discount-rate", f => SetDiscount(f.FloatValue(0f)));

// Both applied together at sync time — no partial state
await features.SyncFlagsAsync();

// Cleanup
group.Destroy();
```

---

## ❓ FAQ & Troubleshooting

### 1. Flag changes are not detected in real time

| Cause | Solution |
|---|---|
| Polling interval too long | Reduce `RefreshInterval` (default: 30s) |
| `ExplicitSyncMode` is on | Call `SyncFlagsAsync()` at a safe point |
| Using `WatchSyncedFlag` without sync | Switch to `WatchRealtimeFlag` or call `SyncFlagsAsync()` |
| `OfflineMode` is enabled | Set `Features.OfflineMode = false` |
| Wrong `AppName` | Double-check config |

### 2. `WatchSyncedFlag` callback never fires

Enable `ExplicitSyncMode` and call `SyncFlags()`:
```csharp
config.Features.ExplicitSyncMode = true;
features.WatchSyncedFlagWithInitialState("my-flag", flag => { ... });
await features.SyncFlagsAsync();
```

### 3. Flags return fallback values after initialization

| Cause | Solution |
|---|---|
| SDK not ready yet | Wait for `flags.ready` event or use `WatchRealtimeFlagWithInitialState` |
| Wrong `AppName` | Match dashboard settings |
| Flag not assigned | Verify in dashboard |
| Network error on first fetch | Check `flags.fetch_error` event and logs |

### 4. Flag values change unexpectedly during gameplay

Enable `ExplicitSyncMode` and use `WatchSyncedFlag` for gameplay-critical values.

### 5. Memory leak warnings from callbacks

Always call the returned unsubscribe `Action` or `group.Destroy()` when the consumer is destroyed:
```csharp
private Action _unwatch;

void Start() {
    _unwatch = features.WatchRealtimeFlag("my-flag", f => { ... });
}

void OnDestroy()
{
    _unwatch?.Invoke();
    watchGroup?.Destroy();
}
```

---

## 🎮 Feature Flags in Games

### Industry Case Studies

**GitHub** [documented their approach](https://github.blog/engineering/infrastructure/ship-code-faster-safer-feature-flags/) to shipping code faster and safer with feature flags — including reducing deployment risk, testing features with internal users first, and using percentage-based rollouts. While not a game company, their patterns directly apply to live service games.

**Slack** [shared their deployment process](https://slack.engineering/deploys-at-slack/) which uses staged rollouts (staging → dogfood → canary → percentage production). This pattern is highly relevant for multiplayer games that need to validate changes against real player traffic before full rollout.

### Practical Game Scenarios

| Scenario | How Feature Flags Help |
|---|---|
| **Live balance tuning** | Adjust weapon damage, drop rates, enemy HP remotely without a patch |
| **Seasonal events** | Pre-deploy holiday content, toggle it on at exactly the right moment |
| **App store / console review** | Submit with new features hidden, enable after approval — no second review |
| **Emergency kill switch** | Disable a crashing feature in seconds, not hours of hotfix builds |
| **A/B testing gameplay** | Test two difficulty curves with different player groups and measure retention |
| **Gradual rollout** | Release a new game mode to 5% of players first, watch for crashes, then expand |
| **Tournament / esports** | Lock game parameters during competitive matches to prevent mid-match changes |

### ⚠️ Cautions for Game Development

| Pitfall | Recommendation |
|---|---|
| **Flag changes during gameplay** | Use `ExplicitSyncMode` to buffer changes and apply at safe points (loading screens, between rounds) |
| **Network dependency** | SDK caches last-known values locally — the game works even if the server is unreachable |
| **Too many flags** | Start with high-impact values (difficulty, economy, features). Don't flag every constant |
| **Flag cleanup** | Remove flags after permanent rollout. Stale flags become technical debt |
| **Deterministic multiplayer** | Ensure all clients see the same flag values in the same session. Use `UserId` for consistent assignment |
| **Performance-sensitive paths** | Avoid flag checks in tight loops (Update/Tick). Cache the value at session start or sync points |

## ⚠️ Essential Practices

### Test All Flag States

Every feature flag creates **at least two code paths** (on and off). Both must be tested. Untested paths are ticking time bombs that will eventually reach production.

| What to test | Why |
|---|---|
| Flag **ON** | Verify the new behavior works correctly |
| Flag **OFF** | Verify the original behavior still works — this is often forgotten |
| Flag **toggled mid-session** | If using real-time mode, verify no crashes or inconsistent state |
| **Default value** path | Verify behavior when the flag doesn't exist on the server (network error, new environment, etc.) |

### Handle Dependencies Carefully

Toggling a flag can change which objects, modules, or resources are used. If those dependencies aren't ready, you get crashes or undefined behavior.

**Common pitfall:** Flag A enables a feature that depends on an object initialized by Flag B. If A is on but B is off, the object doesn't exist → crash.

**How to prevent:**

- Initialize all resources that _might_ be needed regardless of flag state, or
- Use lazy initialization with null checks, or
- Use `ExplicitSyncMode` to apply flag changes only at safe points where all dependencies can be resolved together

### Document Every Flag

When creating a flag, clearly communicate the following to your team:

| Item | Description |
|---|---|
| **Purpose** | What does this flag control? Why does it exist? |
| **Affected areas** | Which screens, systems, or APIs are impacted? |
| **Side effects** | What changes when flipped? Any performance, data, or UX implications? |
| **Dependencies** | Does this flag depend on other flags or system state? |
| **Owner** | Who is responsible for this flag? |
| **Expiration** | When should this flag be removed? |

Undocumented flags become a source of confusion, and eventually, incidents.

## 📚 References

**Concepts:**

- [Feature Toggles (aka Feature Flags)](https://martinfowler.com/articles/feature-toggles.html) — Martin Fowler
- [What are Feature Flags?](https://www.atlassian.com/continuous-delivery/principles/feature-flags) — Atlassian

**Use Cases & Case Studies:**

- [How We Ship Code Faster and Safer with Feature Flags](https://github.blog/engineering/infrastructure/ship-code-faster-safer-feature-flags/) — GitHub Engineering
- [Deploys at Slack](https://slack.engineering/deploys-at-slack/) — Slack Engineering
- [Preparing the Netflix API for Deployment](https://netflixtechblog.com/preparing-the-netflix-api-for-deployment-786d8f58090d) — Netflix Tech Blog
- [Progressive Experimentation with Feature Flags](https://learn.microsoft.com/en-us/devops/operate/progressive-experimentation-feature-flags) — Microsoft

**Trunk-Based Development:**

- [Feature Flags in Trunk-Based Development](https://trunkbaseddevelopment.com/feature-flags/) — trunkbaseddevelopment.com
- [Trunk-Based Development Best Practices](https://www.atlassian.com/continuous-delivery/continuous-integration/trunk-based-development) — Atlassian

## License

This project is licensed under the MIT License - see the [LICENSE](../../../../LICENSE) file for details.
