# Gatrix Cocos2d-x SDK (C++)

C++ SDK for the Gatrix platform, designed for the Cocos2d-x game engine.
Fully implements the [CLIENT_SDK_SPEC.md](../CLIENT_SDK_SPEC.md).

## Features

- **Full CLIENT_SDK_SPEC compliance**: All required interfaces implemented
- **Typed Variations**: `boolVariation`, `stringVariation`, `intVariation`, `floatVariation`, `doubleVariation`, `jsonVariation` (default value REQUIRED)
- **Variation Details**: `boolVariationDetails`, `stringVariationDetails`, `intVariationDetails`, `floatVariationDetails`, `doubleVariationDetails`, `jsonVariationDetails` with reason, flagExists, enabled
- **OrThrow Variations**: `boolVariationOrThrow`, `stringVariationOrThrow`, `intVariationOrThrow`, `floatVariationOrThrow`, `doubleVariationOrThrow`, `jsonVariationOrThrow`
- **FlagProxy**: Full property access (exists, enabled, name, variant, valueType, version, reason, impressionData, raw)
- **Watch Pattern**: `watchRealtimeFlag`, `watchRealtimeFlagWithInitialState`, `watchSyncedFlag`, `watchSyncedFlagWithInitialState`, `WatchFlagGroup` with chain API
- **Explicit Sync Mode**: `isExplicitSync`, `hasPendingSyncFlags`, `syncFlags`
- **Event System**: `on`, `once`, `off`, `onAny`, `offAny` with handler stats tracking
- **Storage Provider**: `IStorageProvider` interface + `InMemoryStorageProvider`
- **Comprehensive Stats**: `GatrixClientSDKStats` with all spec fields
- **Bootstrap Support**: Pre-loaded flags for instant startup
- **ETag / 304 Support**: Conditional fetching to reduce bandwidth
- **Impression Tracking**: Per-flag impression events
- **Missing Flag Tracking**: Automatic counting of non-existent flag accesses
- **Per-flag Access Counts**: `flagEnabledCounts`, `flagVariantCounts`
- **Integrated with Cocos2d-x**: Uses `HttpClient` for networking, `Scheduler` for polling

## File Structure

```
gatrix-cocos2dx-client-sdk/
├── include/
│   ├── GatrixClient.h          # Main entry point (singleton)
│   ├── GatrixFeaturesClient.h  # Feature flags client + WatchFlagGroup
│   ├── GatrixFlagProxy.h       # Flag access wrapper
│   ├── GatrixEventEmitter.h    # Event system with handler stats
│   ├── GatrixEvents.h          # Event name constants (EVENTS struct)
│   └── GatrixTypes.h           # All data types, config, errors, storage
├── src/
│   ├── GatrixClient.cpp        # GatrixClient implementation
│   └── GatrixFeaturesClient.cpp # FeaturesClient + WatchFlagGroup implementation
├── test_stubs/                 # Stub headers for build testing without Cocos2d-x
│   └── build_verify.cpp        # Comprehensive API surface verification test
├── CMakeLists.txt
└── README.md
```

## Installation

### 1. Copy SDK files
Copy the `include/` and `src/` directories into your Cocos2d-x project.

### 2. Add to CMakeLists.txt
```cmake
list(APPEND GAME_SOURCE
     Classes/gatrix/src/GatrixClient.cpp
     Classes/gatrix/src/GatrixFeaturesClient.cpp
)
list(APPEND GAME_HEADER
     Classes/gatrix/include/GatrixClient.h
     Classes/gatrix/include/GatrixFeaturesClient.h
     Classes/gatrix/include/GatrixFlagProxy.h
     Classes/gatrix/include/GatrixEventEmitter.h
     Classes/gatrix/include/GatrixEvents.h
     Classes/gatrix/include/GatrixTypes.h
)
```

## Quick Start

### Initialize (AppDelegate.cpp)

```cpp
#include "GatrixClient.h"

bool AppDelegate::applicationDidFinishLaunching() {
    gatrix::GatrixClientConfig config;
    config.apiUrl = "https://edge.your-api.com/api/v1";
    config.apiToken = "your-client-token";
    config.appName = "my-game";
    config.features.refreshInterval = 30;

    auto* client = gatrix::GatrixClient::getInstance();
    client->init(config);
    client->start();

    return true;
}
```

### Use Feature Flags

```cpp
#include "GatrixClient.h"

auto* features = gatrix::GatrixClient::getInstance()->features();

// Basic check
if (features->isEnabled("new-boss")) {
    spawnBoss();
}

// Typed variations (default value REQUIRED)
bool showTutorial = features->boolVariation("show-tutorial", true);
std::string theme = features->stringVariation("holiday-theme", "default");
double speed = features->floatVariation("game-speed", 1.0f);
int level = features->intVariation("start-level", 1);
double gravity = features->doubleVariation("gravity", 9.8);

// Variation details (with evaluation reason)
auto details = features->boolVariationDetails("premium-feature", false);
if (details.flagExists && details.enabled) {
    enablePremium();
}

// Strict mode (throws GatrixFeatureError if flag missing)
try {
    double discount = features->doubleVariationOrThrow("discount-rate");
} catch (const gatrix::GatrixFeatureError& e) {
    // Handle missing/invalid flag
}
```

### FlagProxy

```cpp
// Watch a specific flag for changes (recommended pattern)
features->watchRealtimeFlagWithInitialState("special-offer", [](FlagProxy flag) {
  flag.exists();          // bool
  flag.enabled();         // bool
  flag.name();            // const string&
  flag.variant();         // Variant (never null - returns fallback)
  flag.valueType();      // ValueType enum
  flag.version();         // int
  flag.reason();          // const string&
  flag.impressionData();  // bool
  flag.raw();             // const EvaluatedFlag*

  // Variations on proxy
  flag.boolVariation(false);
  flag.stringVariation("default");
  flag.intVariation(0);
  flag.floatVariation(0.0f);
  flag.doubleVariation(0.0);
  flag.jsonVariation("{}");

  // Details on proxy
  auto details = flag.boolVariationDetails(false);
  // details.value, details.reason, details.flagExists, details.enabled

  // OrThrow on proxy
  flag.boolVariationOrThrow();
}, "special_offer_watcher");
```

### Watch Pattern

Two watch modes available:

| Method                                                    | Callback timing                                                                     |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `watchSyncedFlag` / `watchSyncedFlagWithInitialState`     | In `explicitSyncMode`: fires after `syncFlags()`. In normal mode: fires immediately |
| `watchRealtimeFlag` / `watchRealtimeFlagWithInitialState` | Always fires immediately when server fetch brings new data                          |

```cpp
// Synced watch - respects explicitSyncMode
auto unwatch = features->watchSyncedFlag("my-feature", [](gatrix::FlagProxy flag) {
    updateUI(flag.enabled());
});

// Synced watch with initial state
auto unwatchInit = features->watchSyncedFlagWithInitialState("my-feature", [](gatrix::FlagProxy flag) {
    updateUI(flag.enabled());
});

// Realtime watch - fires immediately regardless of explicitSyncMode
auto unwatchRt = features->watchRealtimeFlag("realtime-feature", [](gatrix::FlagProxy flag) {
    updateDebugUI(flag.enabled());
});

// Stop watching
unwatch();
unwatchInit();
unwatchRt();

// Watch group (batch management)
auto* group = features->createWatchFlagGroup("scene-flags");
group->watchRealtimeFlag("flag-1", handler1)
     .watchSyncedFlag("flag-2", handler2)
     .watchSyncedFlagWithInitialState("flag-3", handler3);

// Unsubscribe all at once
group->unwatchAll();
```

### Events

```cpp
using namespace gatrix;

auto* client = GatrixClient::getInstance();

// Subscribe to specific events
client->on(EVENTS::FLAGS_READY, [](const std::vector<std::string>&) {
    CCLOG("SDK is ready!");
});

client->on(EVENTS::FLAGS_CHANGE, [](const std::vector<std::string>&) {
    CCLOG("Flags changed!");
});

// Subscribe to ALL events (debugging)
client->onAny([](const std::string& event, const std::vector<std::string>&) {
    CCLOG("Event: %s", event.c_str());
});

// Unsubscribe
client->off(EVENTS::FLAGS_READY);
client->offAny();
```

### Explicit Sync Mode

```cpp
gatrix::GatrixClientConfig config;
config.features.explicitSyncMode = true;
// ...

auto* features = client->features();

// Flags are fetched in background but NOT applied yet
bool canSync = features->hasPendingSyncFlags(); // true if pending changes

// Apply at safe point (e.g. scene transition)
features->syncFlags();

// Check mode
features->isExplicitSync(); // true
```

### Statistics

```cpp
auto stats = features->getStats();
stats.totalFlagCount;       // Total flags in cache
stats.fetchFlagsCount;      // Number of fetch calls
stats.updateCount;          // Successful updates
stats.notModifiedCount;     // 304 responses
stats.errorCount;           // Total errors
stats.recoveryCount;        // Recoveries from error
stats.impressionCount;      // Impressions sent
stats.contextChangeCount;   // Context updates
stats.syncFlagsCount;       // syncFlags calls
stats.sdkState;             // SdkState enum
stats.missingFlags;         // map<string, int>
stats.flagEnabledCounts;    // map<string, FlagEnabledCount>
stats.flagVariantCounts;    // map<string, map<string, int>>
```

## Event Constants

| Constant                      | Value                   |
| ----------------------------- | ----------------------- |
| `EVENTS::FLAGS_INIT`          | `"flags.init"`          |
| `EVENTS::FLAGS_READY`         | `"flags.ready"`         |
| `EVENTS::FLAGS_FETCH`         | `"flags.fetch"`         |
| `EVENTS::FLAGS_FETCH_START`   | `"flags.fetch_start"`   |
| `EVENTS::FLAGS_FETCH_SUCCESS` | `"flags.fetch_success"` |
| `EVENTS::FLAGS_FETCH_ERROR`   | `"flags.fetch_error"`   |
| `EVENTS::FLAGS_FETCH_END`     | `"flags.fetch_end"`     |
| `EVENTS::FLAGS_CHANGE`        | `"flags.change"`        |
| `EVENTS::SDK_ERROR`           | `"flags.error"`         |
| `EVENTS::FLAGS_RECOVERED`     | `"flags.recovered"`     |
| `EVENTS::FLAGS_SYNC`          | `"flags.sync"`          |
| `EVENTS::FLAGS_IMPRESSION`    | `"flags.impression"`    |
| `EVENTS::FLAGS_PENDING_SYNC` | `"flags.pending_sync"` |
| `EVENTS::FLAGS_REMOVED`      | `"flags.removed"`      |
| `EVENTS::FLAGS_METRICS_SENT`  | `"flags.metrics.sent"`  |
| `EVENTS::FLAGS_METRICS_ERROR` | `"flags.metrics.error"` |
| `EVENTS::flagChange("name")`  | `"flags.name.change"`   |

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
