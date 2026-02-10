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
    environment="production",
))

client.start()

# Check if a feature is enabled
if client.features.is_enabled("new-dashboard"):
    print("New dashboard is ON!")

# Get typed variations
color = client.features.string_variation("theme-color", "blue")
rate = client.features.number_variation("rate-limit", 100.0)
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
        variant=Variant(name="v1", enabled=True, payload="hello"),
        variant_type="string",
        version=1,
    ),
]

client = GatrixClient(GatrixClientConfig(
    api_url="https://edge.example.com/api/v1",
    api_token="your-token",
    app_name="my-app",
    environment="production",
    offline_mode=True,
    features=FeaturesConfig(bootstrap=bootstrap_flags),
))

assert client.features.is_enabled("my-feature") is True
```

## Watch for Changes

```python
from gatrix import EVENTS

# Watch a specific flag
unwatch = client.features.watch_flag("my-feature", lambda proxy: print(f"Changed: {proxy.enabled}"))

# Watch with initial state
client.features.watch_flag_with_initial_state("my-feature", lambda proxy: print(f"State: {proxy.enabled}"))

# Watch groups
group = client.features.create_watch_flag_group("ui-flags")
group.watch_flag("sidebar", handler1)
group.watch_flag("theme", handler2)
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
    environment="production",
    features=FeaturesConfig(explicit_sync_mode=True),
))

client.start()

# Flags are fetched in background but not applied yet
# Apply at a safe point (e.g., between game rounds)
if client.features.can_sync_flags():
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
```

## Running Tests

```bash
pip install pytest
python -m pytest tests/ -v
```

## License

MIT
