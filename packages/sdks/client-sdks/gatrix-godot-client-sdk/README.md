# Gatrix Godot SDK

Client SDK for the Gatrix platform — feature flags, polling, caching, context, and metric reporting for Godot Engine 4.x.

## Installation

1. Copy the `addons/gatrix_sdk/` folder into your Godot project's `addons/` directory.
2. In Godot Editor, go to **Project → Project Settings → Plugins** and enable **Gatrix SDK**.
3. `GatrixClient` is automatically registered as an autoload singleton.

## Quick Start

```gdscript
# In your main scene or autoload script
func _ready() -> void:
    var config := GatrixTypes.GatrixClientConfig.new()
    config.api_url = "http://localhost:3400/api/v1"
    config.api_token = "your-client-api-token"
    config.app_name = "MyGame"

    # Optional: set user context
    config.features.context.user_id = "player-123"
    config.features.context.session_id = "session-abc"
    config.features.context.properties = { "platform": "windows", "version": "1.0.0" }

    GatrixClient.start(config, null, func(success: bool, error_msg: String):
        print("SDK started! success=", success)
    )

    # Or: wait for ready via event
    GatrixClient.once_event(GatrixEvents.FLAGS_READY, func():
        var features = GatrixClient.get_features()
        print("SDK is ready!")
        print("Feature enabled: ", features.is_enabled("my-feature"))
    )
```

## Flag Access

All flag operations go through `GatrixClient.get_features()`:

```gdscript
var features = GatrixClient.get_features()

# Boolean check
if features.is_enabled("dark-mode"):
    apply_dark_mode()

# Typed variations (with required default values)
var speed := features.float_variation("game-speed", 1.0)
var welcome := features.string_variation("welcome-message", "Hello!")
var ui_config = features.json_variation("ui-config", { "theme": "default" })

# EvaluatedFlag for direct access (returns null if flag not found)
var flag = features.get_flag("my-feature")
if flag != null and flag.enabled:
    print("Variant: ", flag.variant.name)
    print("Value: ", flag.variant.value)
```

## Variation Details

```gdscript
var features = GatrixClient.get_features()
var result := features.bool_variation_details("my-flag", false)
print("Value: ", result.value)
print("Reason: ", result.reason)      # e.g., "targeting_match"
print("Exists: ", result.flag_exists)
print("Enabled: ", result.enabled)
```

## Strict Variations (OrThrow)

```gdscript
var features = GatrixClient.get_features()
# These will assert/error if flag not found or disabled
var speed := features.float_variation_or_throw("game-speed")
var cfg = features.json_variation_or_throw("game-config")
```

## Watch Pattern

```gdscript
var features = GatrixClient.get_features()

# Watch for flag changes
var unwatch := features.watch_realtime_flag("my-feature", func(flag: GatrixFlagProxy):
    print("Flag changed! Enabled: ", flag.enabled)
)

# Watch with immediate initial state
var unwatch2 := features.watch_realtime_flag_with_initial_state("speed", func(flag: GatrixFlagProxy):
    player.speed = flag.float_variation(5.0)
)

# Stop watching
unwatch.call()
```

## Watch Groups

```gdscript
var features = GatrixClient.get_features()

# Batch management for multiple watchers
var group := GatrixWatchFlagGroup.new(features, "gameplay")

group.watch_realtime_flag_with_initial_state("speed", func(flag: GatrixFlagProxy):
    player.speed = flag.float_variation(5.0)
).watch_realtime_flag_with_initial_state("dark-mode", func(flag: GatrixFlagProxy):
    apply_theme("dark" if flag.enabled else "light")
)

# Unwatch all at once (e.g., when leaving a scene)
group.unwatch_all()
```

## Context Management

```gdscript
var features = GatrixClient.get_features()

# Update context (triggers re-fetch from server)
var ctx := GatrixTypes.GatrixContext.new()
ctx.user_id = "new-player-456"
ctx.properties = { "level": 10, "region": "us-west" }
features.update_context(ctx)
```

## Explicit Sync Mode

```gdscript
# Prevent mid-gameplay flag changes
var config := GatrixTypes.GatrixClientConfig.new()
config.features.explicit_sync_mode = true
# ... other config ...

GatrixClient.start(config)

var features = GatrixClient.get_features()

# Flags are fetched in background but not applied until:
if features.has_pending_sync_flags():
    features.sync_flags()  # Apply pending changes at safe points
```

## Events

```gdscript
# Subscribe to specific events
GatrixClient.on_event(GatrixEvents.FLAGS_READY, func():
    print("SDK ready!")
)

GatrixClient.on_event(GatrixEvents.FLAGS_CHANGE, func(data):
    print("Flags changed: ", data)
)

GatrixClient.on_event(GatrixEvents.FLAGS_FETCH_ERROR, func(data):
    print("Fetch error: ", data)
)

# Subscribe to ALL events (useful for debugging)
GatrixClient.on_any(func(event_name, args):
    print("[Gatrix Event] ", event_name, " -> ", args)
)
```

### Available Events

| Constant | Event Name | Description |
|----------|-----------|-------------|
| `GatrixEvents.FLAGS_INIT` | `flags.init` | SDK initialized from storage/bootstrap |
| `GatrixEvents.FLAGS_READY` | `flags.ready` | First successful fetch completed |
| `GatrixEvents.FLAGS_FETCH` | `flags.fetch` | Started fetching flags |
| `GatrixEvents.FLAGS_FETCH_START` | `flags.fetch_start` | Started fetching (alias) |
| `GatrixEvents.FLAGS_FETCH_SUCCESS` | `flags.fetch_success` | Fetch succeeded |
| `GatrixEvents.FLAGS_FETCH_ERROR` | `flags.fetch_error` | Fetch failed |
| `GatrixEvents.FLAGS_FETCH_END` | `flags.fetch_end` | Fetch completed |
| `GatrixEvents.FLAGS_CHANGE` | `flags.change` | Flags changed from server |
| `GatrixEvents.SDK_ERROR` | `flags.error` | General SDK error |
| `GatrixEvents.FLAGS_RECOVERED` | `flags.recovered` | Recovered from error state |
| `GatrixEvents.FLAGS_SYNC` | `flags.sync` | Flags synchronized |
| `GatrixEvents.FLAGS_IMPRESSION` | `flags.impression` | Impression tracked |
| `GatrixEvents.FLAGS_PENDING_SYNC` | `flags.pending_sync` | Pending sync flags available |
| `GatrixEvents.FLAGS_REMOVED` | `flags.removed` | Flags removed from server |
| `GatrixEvents.FLAGS_METRICS_SENT` | `flags.metrics.sent` | Metrics sent to server |

## Statistics

```gdscript
var stats := GatrixClient.get_stats()
print("Flags: ", stats.total_flag_count)
print("Fetches: ", stats.fetch_flags_count)
print("Updates: ", stats.update_count)
print("Errors: ", stats.error_count)
print("Missing: ", stats.missing_flags)
```

## Storage Providers

```gdscript
# Default: InMemoryStorageProvider (no persistence)
GatrixClient.start(config)

# File-based persistence (recommended for games)
var storage := GatrixStorageProvider.FileStorageProvider.new("user://gatrix/")
GatrixClient.start(config, storage)
```

## Configuration Options

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `api_url` | String | `http://localhost:3400/api/v1` | Edge API base URL |
| `api_token` | String | **required** | Client API token |
| `app_name` | String | **required** | Application name |
| `custom_headers` | Dictionary | `{}` | Custom HTTP headers |
| `features.context` | GatrixContext | `null` | Initial evaluation context |
| `features.offline_mode` | bool | `false` | Start in offline mode |
| `features.cache_key_prefix` | String | `gatrix_cache` | Cache key prefix |
| `features.refresh_interval` | float | `30.0` | Polling interval in seconds |
| `features.disable_refresh` | bool | `false` | Disable automatic polling |
| `features.explicit_sync_mode` | bool | `true` | Enable explicit sync mode |
| `features.bootstrap` | Array | `[]` | Initial flags for instant availability |
| `features.bootstrap_override` | bool | `true` | Override stored flags with bootstrap |
| `features.disable_metrics` | bool | `false` | Disable metrics collection |
| `features.disable_stats` | bool | `false` | Disable local stats tracking |
| `features.impression_data_all` | bool | `false` | Track impressions for all flags |

## Requirements

- Godot Engine 4.x
- HTTPS support (enabled by default in Godot)

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
