# Gatrix Python Client SDK

Python client SDK for [Gatrix](https://github.com/your-org/gatrix) feature flags.

**Zero runtime dependencies** — uses only Python standard library (`urllib`, `json`, `threading`, `dataclasses`).

## Requirements

- Python 3.9+

## Installation

```bash
pip install gatrix-python-client-sdk
```

## Quick Start

```python
from gatrix import GatrixClient, GatrixClientConfig, FeaturesConfig

client = GatrixClient(GatrixClientConfig(
    api_url="https://edge.example.com/api/v1",
    api_token="your-client-token",
    app_name="my-app",
))

client.start()

# Check if a feature is enabled
if client.features.is_enabled("new-dashboard"):
    print("New dashboard is ON!")

# Get typed variations
color = client.features.string_variation("theme-color", "blue")
rate = client.features.float_variation("rate-limit", 100.0)
config = client.features.json_variation("ui-config", {"sidebar": True})

client.stop()
```

## Bootstrap / Offline Mode

```python
from gatrix import (
    GatrixClient, GatrixClientConfig, FeaturesConfig,
    EvaluatedFlag, Variant,
)

bootstrap_flags = [
    EvaluatedFlag(
        name="my-feature",
        enabled=True,
        variant=Variant(name="v1", enabled=True, value="hello"),
        value_type="string",
        version=1,
    ),
]

client = GatrixClient(GatrixClientConfig(
    api_url="https://edge.example.com/api/v1",
    api_token="your-token",
    app_name="my-app",
    features=FeaturesConfig(
        offline_mode=True,
        bootstrap=bootstrap_flags,
    ),
))

client.start()
assert client.features.is_enabled("my-feature") is True
```

## Watch for Changes

Two watch modes are available:

| Method                | Callback timing                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `watch_synced_flag`   | In `explicit_sync_mode`: only after `sync_flags()`. In normal mode: immediately on change |
| `watch_realtime_flag` | Always immediately when server fetch brings new data                                      |

```python
from gatrix import EVENTS

# Synced watch - respects explicit_sync_mode (recommended)
unwatch = client.features.watch_synced_flag("my-feature", lambda proxy: print(f"Changed: {proxy.enabled}"))

# Synced watch with initial state
client.features.watch_synced_flag_with_initial_state("my-feature", lambda proxy: print(f"State: {proxy.enabled}"))

# Realtime watch - fires immediately regardless of explicit_sync_mode
unwatch_rt = client.features.watch_realtime_flag("my-feature", lambda proxy: print(f"Realtime: {proxy.enabled}"))

# Watch groups
group = client.features.create_watch_group("ui-flags")
group.watch_realtime_flag("sidebar", handler1)
group.watch_synced_flag("theme", handler2)
group.unwatch_all()

# Global events
client.on(EVENTS.FLAGS_READY, lambda: print("SDK ready!"))
client.on(EVENTS.FLAGS_CHANGE, lambda data: print(f"Flags changed: {len(data['flags'])}"))
```

## Explicit Sync Mode

```python
client = GatrixClient(GatrixClientConfig(
    api_url="https://edge.example.com/api/v1",
    api_token="your-token",
    app_name="my-app",
    features=FeaturesConfig(explicit_sync_mode=True),
))

client.start()

# Flags are fetched in background but not applied yet
# Apply at a safe point (e.g., between game rounds)
if client.features.has_pending_sync_flags():
    client.features.sync_flags()
```

## Context

```python
from gatrix import GatrixContext

client.features.update_context(GatrixContext(
    user_id="user-123",
    session_id="session-abc",
    properties={"plan": "premium", "level": 42},
))
```

## Statistics

```python
stats = client.get_stats()
print(f"State: {stats['sdk_state']}")
print(f"Flags: {stats['features']['total_flag_count']}")
print(f"Missing: {stats['features']['missing_flags']}")

# Light stats (scalar values only)
light = client.get_light_stats()
print(f"State: {light['sdk_state']}")
```

## Running Tests

```bash
pip install pytest
python -m pytest tests/ -v
```

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
