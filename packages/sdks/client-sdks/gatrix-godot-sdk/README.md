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
    config.environment = "development"

    # Optional: set user context
    config.context.user_id = "player-123"
    config.context.session_id = "session-abc"
    config.context.properties = { "platform": "windows", "version": "1.0.0" }

    GatrixClient.init_sdk(config)
    GatrixClient.start()

    # Wait for ready (optional)
    GatrixClient.once_event(GatrixEvents.FLAGS_READY, func():
        print("SDK is ready!")
        print("Feature enabled: ", GatrixClient.is_enabled("my-feature"))
    )
```

## Flag Access

```gdscript
# Boolean check
if GatrixClient.is_enabled("dark-mode"):
    apply_dark_mode()

# Typed variations (with required default values)
var speed := GatrixClient.number_variation("game-speed", 1.0)
var welcome := GatrixClient.string_variation("welcome-message", "Hello!")
var ui_config = GatrixClient.json_variation("ui-config", { "theme": "default" })

# FlagProxy for rich access
var flag := GatrixClient.get_flag("my-feature")
if flag.exists and flag.enabled:
    print("Variant: ", flag.variant.name)
    print("Payload: ", flag.string_variation("fallback"))
```

## Variation Details

```gdscript
var result := GatrixClient.bool_variation_details("my-flag", false)
print("Value: ", result.value)
print("Reason: ", result.reason)      # e.g., "targeting_match"
print("Exists: ", result.flag_exists)
print("Enabled: ", result.enabled)
```

## Strict Variations (OrThrow)

```gdscript
# These will assert/error if flag not found or disabled
var speed := GatrixClient.number_variation_or_throw("game-speed")
var config = GatrixClient.json_variation_or_throw("game-config")
```

## Watch Pattern

```gdscript
# Watch for flag changes
var unwatch := GatrixClient.watch_flag("my-feature", func(flag: GatrixFlagProxy):
    print("Flag changed! Enabled: ", flag.enabled)
)

# Watch with immediate initial state
var unwatch2 := GatrixClient.watch_flag_with_initial_state("speed", func(flag: GatrixFlagProxy):
    player.speed = flag.number_variation(5.0)
)

# Stop watching
unwatch.call()
```

## Watch Groups

```gdscript
# Batch management for multiple watchers
var group := GatrixWatchFlagGroup.new(GatrixClient.get_features(), "gameplay")

group.watch_flag("speed", func(flag: GatrixFlagProxy):
    player.speed = flag.number_variation(5.0)
).watch_flag("dark-mode", func(flag: GatrixFlagProxy):
    apply_theme("dark" if flag.enabled else "light")
)

# Unwatch all at once (e.g., when leaving a scene)
group.unwatch_all()
```

## Context Management

```gdscript
# Update context (triggers re-fetch from server)
var ctx := GatrixTypes.GatrixContext.new()
ctx.user_id = "new-player-456"
ctx.properties = { "level": 10, "region": "us-west" }
GatrixClient.update_context(ctx)
```

## Explicit Sync Mode

```gdscript
# Prevent mid-gameplay flag changes
var config := GatrixTypes.GatrixClientConfig.new()
config.explicit_sync_mode = true
# ... other config ...

GatrixClient.init_sdk(config)
GatrixClient.start()

# Flags are fetched in background but not applied until:
if GatrixClient.can_sync_flags():
    GatrixClient.sync_flags()  # Apply pending changes at safe points
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
GatrixClient.init_sdk(config)

# File-based persistence (recommended for games)
var storage := GatrixStorageProvider.FileStorageProvider.new("user://gatrix/")
GatrixClient.init_sdk(config, storage)
```

## Configuration Options

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `api_url` | String | `http://localhost:3400/api/v1` | Edge API base URL |
| `api_token` | String | **required** | Client API token |
| `app_name` | String | **required** | Application name |
| `environment` | String | **required** | Environment (e.g., "production") |
| `refresh_interval` | float | `30.0` | Polling interval in seconds |
| `disable_refresh` | bool | `false` | Disable automatic polling |
| `explicit_sync_mode` | bool | `false` | Enable explicit sync mode |
| `offline_mode` | bool | `false` | Start in offline mode |
| `bootstrap` | Array | `[]` | Initial flags for instant availability |
| `bootstrap_override` | bool | `true` | Override stored flags with bootstrap |
| `disable_metrics` | bool | `false` | Disable metrics collection |
| `disable_stats` | bool | `false` | Disable local stats tracking |
| `impression_data_all` | bool | `false` | Track impressions for all flags |
| `custom_headers` | Dictionary | `{}` | Custom HTTP headers |

## Requirements

- Godot Engine 4.x
- HTTPS support (enabled by default in Godot)

## License

MIT
