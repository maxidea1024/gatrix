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
    config.environment = "production";
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
| `EVENTS::FLAGS_METRICS_SENT`  | `"flags.metrics.sent"`  |
| `EVENTS::flagChange("name")`  | `"flags.name.change"`   |

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
