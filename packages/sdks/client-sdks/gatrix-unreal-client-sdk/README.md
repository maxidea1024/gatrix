# Gatrix Unreal SDK

> **Feature flags, A/B testing, and remote configuration — official Gatrix SDK for Unreal Engine.**

Change your game's behavior in real time without shipping a new build. Feature toggles, A/B experiments, game parameter tuning, gradual rollouts — all from the Gatrix Dashboard.

## 🚩 What is a Feature Flag?

A feature flag has two parts:

| Part | Type | Description |
|---|---|---|
| **State** (`enabled`) | `bool` | Is the feature on or off? — check with `IsEnabled()` |
| **Value** (`variant`) | `bool` `string` `number` `json` | A specific configuration value — read with `BoolVariation()`, `StringVariation()`, `FloatVariation()` |

A flag can be **enabled while also having a specific value** (e.g. `difficulty = "hard"`). State and value are independent — handle both.

> 💡 For more about feature flags, see [📚 References](#-references) at the bottom of this document.

### 💡 Quick Examples

#### 1. Feature Toggle (`IsEnabled`)

```cpp
UGatrixClient* Client = UGatrixClient::Get();

if (Client->GetFeatures()->IsEnabled(TEXT("new-shop")))
{
    // Feature is ON -> Show the new shop UI
    ShowNewShop();
}
else
{
    // Feature is OFF (or flag missing) -> Fallback to legacy shop
    ShowLegacyShop();
}
```

#### 2. Remote Configuration (`Variation`)

```cpp
// Get a float value (defaulting to 1.0 if not set)
float speed = Client->GetFeatures()->FloatVariation(TEXT("game-speed"), 1.0f);

// Get a string value
FString theme = Client->GetFeatures()->StringVariation(TEXT("app-theme"), TEXT("dark"));

// Get an integer value
int32 maxLevel = Client->GetFeatures()->IntVariation(TEXT("max-level"), 50);
```

#### 3. Conditional Targeting

```cpp
// The server evaluates context (level, region, tier...) and returns the right value.
// Your client just reads it — no branching logic needed here!
FString difficulty = Client->GetFeatures()->StringVariation(TEXT("difficulty"), TEXT("Normal"));
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

### 🚀 Separating Deployment from Release

Traditionally, **deployment** and **release** were the same thing — shipping code meant users immediately saw the change. Feature flags decouple these two:

| | Deployment | Release |
|---|---|---|
| **What** | Pushing code to production servers | Making a feature visible to users |
| **Who** | Engineering team | Product / Business team |
| **When** | Any time (CI/CD) | When business decides |
| **Risk** | Low (code is dormant) | Controlled (gradual rollout) |

This means you can **deploy daily** without releasing anything, then **release features** independently through the dashboard — no build, no deploy, no app store review.

### 🌳 Trunk-Based Development & Feature Flags

Feature flags are a natural companion to **Trunk-Based Development (TBD)** — a branching strategy where all developers commit to a single main branch.

| Traditional branching | Trunk-Based + Feature Flags |
|---|---|
| Long-lived feature branches | All commits go to main/trunk |
| Painful merge conflicts | Small, frequent merges |
| Features blocked until branch merges | Incomplete features hidden behind flags |
| Release = merge branch | Release = toggle flag on dashboard |

With feature flags, developers can commit incomplete features directly to the main branch wrapped in a flag. The code is deployed but dormant, avoiding long-lived branches and merge conflicts while still controlling when features become visible to users.

> 💡 Feature flags enable **true continuous integration** — commit to trunk every day, deploy anytime, release when ready.

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

1. Copy the `GatrixClientSDK` folder to your project's `Plugins/` directory
2. Regenerate project files
3. Add `"GatrixClientSDK"` to your game module's `.Build.cs`:

```csharp
PublicDependencyModuleNames.AddRange(new string[] { "GatrixClientSDK" });
```

---

## 🚀 Quick Start

### Option A: C++ Setup

```cpp
#include "GatrixClient.h"
#include "GatrixEvents.h"

// Initialize configuration
FGatrixClientConfig Config;
Config.ApiUrl = TEXT("https://your-api.example.com/api/v1");
Config.ApiToken = TEXT("your-client-api-token");
Config.AppName = TEXT("MyGame");


// Optional context
Config.Features.Context.UserId = TEXT("player-123");
Config.Features.Context.SessionId = TEXT("session-abc");

// Start the SDK
UGatrixClient* Client = UGatrixClient::Get();
Client->Start(Config);

// Subscribe to events
Client->On(GatrixEvents::FlagsReady, [](const TArray<FString>& Args)
{
    UE_LOG(LogTemp, Log, TEXT("Gatrix SDK ready!"));
});

Client->On(GatrixEvents::FlagsChange, [Client](const TArray<FString>& Args)
{
    float GameSpeed = Client->GetFeatures()->FloatVariation(TEXT("game-speed"), 1.0f);
    int32 Difficulty = Client->GetFeatures()->IntVariation(TEXT("difficulty"), 1);
});
```

### Option B: Blueprint Setup

1. Use **"Get Gatrix Client"** node to get the singleton
2. Call **Init** or **Start** with a `GatrixClientConfig` struct
3. Use **Bool Variation**, **String Variation**, etc. for flag values
4. Bind to **OnReady**, **OnChange**, **OnError** events in your Event Graph

---

## 🏁 Reading Feature Flags

```cpp
auto* Features = Client->GetFeatures();

// Check enabled state
bool bNewUI = Features->IsEnabled(TEXT("new-ui"));

// Typed variations (never throw — always returns fallback on error)
bool bShowBanner = Features->BoolVariation(TEXT("show-banner"), false);
FString Theme = Features->StringVariation(TEXT("app-theme"), TEXT("dark"));
int32 MaxRetries = Features->IntVariation(TEXT("max-retries"), 3);
float GameSpeed = Features->FloatVariation(TEXT("game-speed"), 1.0f);
double DropRate = Client->GetFeatures()->DoubleVariation(TEXT("item-drop-rate"), 0.05);

// Full flag proxy
UGatrixFlagProxy* Proxy = Features->GetFlag(TEXT("feature-x"));
if (Proxy)
{
    UE_LOG(LogTemp, Log, TEXT("Enabled: %s, Reason: %s"), 
        Proxy->IsEnabled() ? TEXT("true") : TEXT("false"), 
        *Proxy->GetReason());
}
```

---

## 🔁 Watching for Changes

Two watch modes available:

| Method | Callback timing |
|---|---|
| `WatchRealtimeFlag` | Immediately when a fetch brings new data |
| `WatchSyncedFlag` | After `SyncFlags()` (when `ExplicitSyncMode = true`) |

```cpp
auto* Features = Client->GetFeatures();

// Realtime watch — fires immediately on change
FGatrixFlagWatchDelegate RealtimeCallback;
RealtimeCallback.BindLambda([](UGatrixFlagProxy* Proxy)
{
    ApplyDarkMode(Proxy->IsEnabled());
});
int32 WatchHandle = Features->WatchRealtimeFlag(TEXT("dark-mode"), RealtimeCallback);

// With initial state (fires immediately with current value, then on changes)
Features->WatchRealtimeFlagWithInitialState(TEXT("game-speed"), SpeedCallback);

// Synced watch — fires only after SyncFlags()
Features->WatchSyncedFlagWithInitialState(TEXT("difficulty"), DiffCallback);

// Unwatch
Features->UnwatchFlag(WatchHandle);
```

---

## 🌍 Context Management

### What Is Context?

**Context** is the set of properties describing the current user that the SDK sends to the Gatrix server with every flag evaluation request. The server uses context to evaluate targeting rules and determine which variant each user should receive.

**How context is used:**

- **User targeting** — Show feature A to users in Korea, feature B to users in Japan
- **Gradual rollout** — Enable a feature for 10% of users based on `UserId`
- **A/B testing** — Assign users to experiment groups based on their properties
- **Segmentation** — Different experiences for free vs premium users via `Properties`

> 💡 Context is sent to the server on every fetch. The server evaluates all targeting rules against the context and returns only the final flag values — no rules are exposed to the client.

### Context Fields

| Field | Type | Description |
|---|---|---|
| `AppName` | `FString` | App name (set at init, immutable) |

| `UserId` | `FString` | Unique user identifier — most important for targeting |
| `SessionId` | `FString` | Session identifier for session-scoped experiments |
| `Properties` | `TMap<FString, FString>` | Custom key-value pairs |

### Updating Context

```cpp
// Full context update (triggers re-fetch)
FGatrixContext NewContext;
NewContext.UserId = TEXT("player-456");
NewContext.Properties.Add(TEXT("level"), TEXT("42"));
NewContext.Properties.Add(TEXT("country"), TEXT("KR"));
Client->UpdateContext(NewContext);
```

> ⚠️ All context updates trigger an automatic re-fetch. Do not update context inside rapid loops. Use a single context object to bulk update fields.

---

## ⏱️ Explicit Sync Mode

Control exactly when flag changes are applied to gameplay — the most important feature for timing-sensitive games.

```cpp
// Enable in config
Config.Features.bExplicitSyncMode = true;

// Synced watch: callback fires only after SyncFlags()
Features->WatchSyncedFlagWithInitialState(TEXT("difficulty"), DiffCallback);

// Apply at a safe moment (loading screen, between rounds)
if (Features->HasPendingSyncFlags())
{
    Features->SyncFlags(false); // fetchNow = false
}
```

### Typical Sync Points

| Sync Point | Example |
|---|---|
| **Loading screen** | Scene transition, level loading |
| **Downtime** | After match ends, before next round starts |
| **Menu / Lobby** | Settings screen, event lobby |
| **Respawn** | After player death, before next spawn |

---

## 📡 Operating Modes

### Mode Comparison

| Mode | Latency | Bandwidth | Use Case |
|---|---|---|---|
| Streaming + Polling | Near-instant | Low | Production (online games) |
| Polling Only | ~30s | Low | Simple apps, or lacking WebSocket |
| Offline | N/A | None | Testing, CI, air-gapped |

### Mode 1: Streaming + Polling (Default)

```cpp
// SSE streaming
Config.Features.Streaming.bEnabled = true;
Config.Features.Streaming.Transport = EGatrixStreamingTransport::Sse;
Config.Features.Streaming.Sse.ReconnectBase = 1;
Config.Features.Streaming.Sse.ReconnectMax = 30;

// Or WebSocket streaming
Config.Features.Streaming.Transport = EGatrixStreamingTransport::WebSocket;
Config.Features.Streaming.WebSocket.PingInterval = 30;
```

### Mode 2: Polling Only

```cpp
Config.Features.Streaming.bEnabled = false;
Config.Features.RefreshInterval = 30.0f; // seconds
```

### Mode 3: Offline

```cpp
Config.Features.bOfflineMode = true;
// Use with bootstrap data for fully offline operation
```

---

## 🔔 Events

```cpp
Client->On(GatrixEvents::FlagsReady, [](const TArray<FString>& Args)
{
    UE_LOG(LogTemp, Log, TEXT("SDK ready!"));
});

Client->On(GatrixEvents::FlagsChange, [](const TArray<FString>& Args)
{
    UE_LOG(LogTemp, Log, TEXT("Flags updated"));
});

Client->Once(GatrixEvents::FlagsReady, [](const TArray<FString>& Args)
{
    ShowWelcomeScreen();
});
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

## 🔒 Performance & Threading

- Flag reads are **synchronous and lock-free** (atomic snapshot).
- All network I/O runs on background threads via `FHttpModule` and `IWebSocket`.
- Callbacks are dispatched to the game thread automatically.
- Event emission collects callbacks under lock, then invokes outside lock to prevent deadlocks.
- Metric counters use `FThreadSafeCounter` (no lock contention).

---

## 🧹 Cleanup

```cpp
UGatrixClient::Get()->Stop();
```

---

## 📖 API Reference

### FeaturesClient (`UGatrixClient::Get()->GetFeatures()`)

| Method | Description |
|---|---|
| `IsEnabled(flagName)` | Returns `flag.enabled` |
| `BoolVariation(flagName, fallback)` | Boolean variant value |
| `StringVariation(flagName, fallback)` | String variant value |
| `IntVariation(flagName, fallback)` | Integer variant value |
| `FloatVariation(flagName, fallback)` | Float variant value |
| `DoubleVariation(flagName, fallback)` | Double variant value |
| `GetVariant(flagName)` | Full variant object |
| `GetFlag(flagName)` | Full flag proxy (`UGatrixFlagProxy`) |
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
| `FetchFlags()` | Force server fetch |

### GatrixClient (`UGatrixClient::Get()`)

| Method | Description |
|---|---|
| `Start(config)` | Initialize and start fetching |
| `Stop()` | Stop and clean up |
| `UpdateContext(ctx)` | Update full context |
| `On/Once/Off/OnAny` | Event subscriptions |

---

## 🍳 Common Recipes

### Game Speed Tuning

```cpp
Features->WatchRealtimeFlagWithInitialState(TEXT("game-speed"), 
    FGatrixFlagWatchDelegate::CreateLambda([](UGatrixFlagProxy* Proxy)
{
    UGameplayStatics::SetGlobalTimeDilation(GetWorld(), Proxy->GetFloatValue(1.0f));
}));
```

### Seasonal Event

```cpp
Features->WatchRealtimeFlagWithInitialState(TEXT("winter-event"), 
    FGatrixFlagWatchDelegate::CreateLambda([](UGatrixFlagProxy* Proxy)
{
    SetWinterEvent(Proxy->IsEnabled());
}));
```

### A/B Test UI Text

```cpp
Features->WatchRealtimeFlagWithInitialState(TEXT("cta-button-text"), 
    FGatrixFlagWatchDelegate::CreateLambda([](UGatrixFlagProxy* Proxy)
{
    if (CtaTextWidget) CtaTextWidget->SetText(FText::FromString(Proxy->GetStringValue(TEXT("Play Now"))));
}));
```

### Login Flow with Context Update

```cpp
void OnLogin(FString UserId, int32 Level)
{
    FGatrixContext Ctx;
    Ctx.UserId = UserId;
    Ctx.Properties.Add(TEXT("level"), FString::FromInt(Level));
    
    UGatrixClient::Get()->GetFeatures()->UpdateContext(Ctx);
    // Flags now reflect the logged-in user natively
}
```

### Multi-Flag Dependency with Watch Group

```cpp
UGatrixWatchFlagGroup* Group = Features->CreateWatchGroup(TEXT("shop-system"));

FGatrixFlagWatchDelegate ShopEnabledCb;
ShopEnabledCb.BindLambda([](UGatrixFlagProxy* P){ SetShopEnabled(P->IsEnabled()); });

FGatrixFlagWatchDelegate DiscountCb;
DiscountCb.BindLambda([](UGatrixFlagProxy* P){ SetDiscount(P->GetFloatValue(0.0f)); });

Group->WatchSyncedFlagWithInitialState(TEXT("new-shop-enabled"), ShopEnabledCb);
Group->WatchSyncedFlagWithInitialState(TEXT("discount-rate"), DiscountCb);

// Both applied together at sync time — no partial state
Features->SyncFlags(false);

// Cleanup
Group->DestroyGroup();
```

---

## ❓ FAQ & Troubleshooting

### 1. Flag changes are not detected in real time

| Cause | Solution |
|---|---|
| Polling interval too long | Reduce `RefreshInterval` (default: 30s) or enable Streaming |
| `ExplicitSyncMode` is on | Call `SyncFlags()` at a safe point |
| Using `WatchSyncedFlag` without sync | Switch to `WatchRealtimeFlag` or call `SyncFlags()` |
| `OfflineMode` is enabled | Set `OfflineMode = false` |
| Wrong `AppName` | Double-check config |

### 2. `WatchSyncedFlag` callback never fires

Ensure `ExplicitSyncMode` is true (it is by default) and call `SyncFlags()`:
```cpp
auto* Features = Client->GetFeatures();
Features->SyncFlags(false);
```

### 3. Flags return fallback values after initialization

| Cause | Solution |
|---|---|
| SDK not ready yet | Wait for `flags.ready` event or use `WatchRealtimeFlagWithInitialState` |
| Wrong config | Match dashboard settings |

| Network error | Check `flags.fetch_error` event and log output |

### 4. Memory leak warnings from callbacks

Always call `UnwatchFlag()` or `Group->DestroyGroup()` when the listening object is destroyed (e.g., inside `EndPlay` or `BeginDestroy`):
```cpp
void AMyActor::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    if (UGatrixClient* Client = UGatrixClient::Get())
    {
        Client->GetFeatures()->UnwatchFlag(WatchHandle);
    }
    Super::EndPlay(EndPlayReason);
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

### 💻 Code Best Practices

Scattering flag checks throughout your codebase leads to tangled, hard-to-maintain code. Martin Fowler describes proven patterns to keep flag logic clean in [Feature Toggles](https://martinfowler.com/articles/feature-toggles.html):

| Practice | Description |
|---|---|
| **Minimize toggle points** | Check each flag in [as few places as possible](https://posthog.com/blog/feature-flag-best-practices). Wrap the flag in a single function rather than repeating checks everywhere |
| **Separate decision from logic** | Don't embed flag checks directly in game logic. Create a `FeatureDecisions` layer that maps flags to named decisions (e.g., `ShouldUseBetaUI()`) |
| **Use Strategy / Proxy pattern** | Instead of `if (flag) doA() else doB()` everywhere, inject the behavior at initialization. Swap implementations based on the flag once, not at every call site |
| **Toggles at the edge** | Place flag checks at the outermost layer (UI, scene initialization) rather than deep in core logic. Keep your engine/game logic flag-free |
| **Limit flag inventory** | Treat flags as inventory with a carrying cost. Set expiration dates and remove flags after permanent rollout — [Knight Capital's $460M loss](http://dougseven.com/2014/04/17/knightmare-a-devops-cautionary-tale/) is a cautionary tale of unmanaged flags |
| **Cache at session start** | Read flag values once at a safe point (session start, loading screen) and pass the resolved values to your systems. Avoid calling the SDK repeatedly in hot paths |

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
