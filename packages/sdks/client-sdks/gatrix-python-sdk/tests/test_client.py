"""Tests for GatrixClient (high-level)."""
import pytest

from gatrix.client import GatrixClient
from gatrix.errors import GatrixConfigError
from gatrix.events import EVENTS
from gatrix.types import FeaturesConfig, GatrixClientConfig, GatrixContext
from gatrix.version import SDK_VERSION
from tests.fixtures import BOOTSTRAP_FULL, BOOTSTRAP_SIMPLE


def _config(bootstrap=None, offline=True) -> GatrixClientConfig:
    return GatrixClientConfig(
        api_url="https://api.example.com/api/v1",
        api_token="test-token",
        app_name="test-app",
        environment="development",
        offline_mode=offline,
        features=FeaturesConfig(
            bootstrap=bootstrap,
            disable_metrics=True,
        ),
    )


class TestInit:
    def test_creates_successfully(self):
        client = GatrixClient(_config(bootstrap=BOOTSTRAP_SIMPLE))
        assert client.features is not None

    def test_invalid_config_raises(self):
        with pytest.raises(GatrixConfigError):
            GatrixClient(GatrixClientConfig())  # All empty


class TestVersion:
    def test_version(self):
        assert GatrixClient.get_version() == SDK_VERSION

    def test_events(self):
        assert GatrixClient.get_events() is EVENTS


class TestLifecycle:
    def test_start_stop(self):
        client = GatrixClient(_config(bootstrap=BOOTSTRAP_SIMPLE))
        client.start()
        assert client.is_ready() is True
        client.stop()

    def test_is_ready_with_bootstrap(self):
        client = GatrixClient(_config(bootstrap=BOOTSTRAP_SIMPLE))
        assert client.is_ready() is True

    def test_is_ready_without_bootstrap(self):
        client = GatrixClient(
            GatrixClientConfig(
                api_url="https://api.example.com/api/v1",
                api_token="test-token",
                app_name="test-app",
                environment="development",
                offline_mode=True,
            )
        )
        assert client.is_ready() is False

    def test_get_error_initially_none(self):
        client = GatrixClient(_config(bootstrap=BOOTSTRAP_SIMPLE))
        assert client.get_error() is None


class TestEvents:
    def test_on_and_emit(self):
        client = GatrixClient(_config(bootstrap=BOOTSTRAP_SIMPLE))
        events = []
        client.on(EVENTS.FLAGS_CHANGE, lambda d: events.append(d))

        # Trigger through features
        from tests.fixtures import make_flag
        new = {"feature-on": make_flag("feature-on", enabled=False, version=2),
               "feature-off": make_flag("feature-off", enabled=False)}
        client.features._apply_flags(new)

        assert len(events) == 1

    def test_once(self):
        client = GatrixClient(_config(bootstrap=BOOTSTRAP_SIMPLE))
        events = []
        client.once("test.event", lambda: events.append(1))
        client._emitter.emit("test.event")
        client._emitter.emit("test.event")
        assert events == [1]

    def test_off(self):
        client = GatrixClient(_config(bootstrap=BOOTSTRAP_SIMPLE))
        events = []
        cb = lambda: events.append(1)
        client.on("test.event", cb)
        client.off("test.event", cb)
        client._emitter.emit("test.event")
        assert events == []

    def test_on_any(self):
        client = GatrixClient(_config(bootstrap=BOOTSTRAP_SIMPLE))
        events = []
        client.on_any(lambda ev, *args: events.append(ev))
        client._emitter.emit("a")
        client._emitter.emit("b")
        assert events == ["a", "b"]

    def test_off_any(self):
        client = GatrixClient(_config(bootstrap=BOOTSTRAP_SIMPLE))
        events = []
        cb = lambda ev, *args: events.append(ev)
        client.on_any(cb)
        client.off_any(cb)
        client._emitter.emit("a")
        assert events == []


class TestStats:
    def test_get_stats(self):
        client = GatrixClient(_config(bootstrap=BOOTSTRAP_FULL))
        stats = client.get_stats()
        assert stats["sdk_state"] == "ready"
        assert stats["features"]["total_flag_count"] == len(BOOTSTRAP_FULL)
        assert "event_handler_stats" in stats

    def test_stats_after_access(self):
        client = GatrixClient(_config(bootstrap=BOOTSTRAP_FULL))
        client.features.is_enabled("bool-flag")
        client.features.is_enabled("nonexistent")

        stats = client.get_stats()
        assert stats["features"]["flag_enabled_counts"]["bool-flag"]["yes"] == 1
        assert stats["features"]["missing_flags"]["nonexistent"] == 1


class TestFeaturesAccess:
    """End-to-end tests through GatrixClient -> FeaturesClient."""

    def test_is_enabled(self):
        client = GatrixClient(_config(bootstrap=BOOTSTRAP_FULL))
        assert client.features.is_enabled("bool-flag") is True
        assert client.features.is_enabled("disabled-flag") is False

    def test_variations(self):
        client = GatrixClient(_config(bootstrap=BOOTSTRAP_FULL))
        assert client.features.string_variation("string-flag", "") == "hello world"
        assert client.features.number_variation("number-flag", 0) == 42.0
        assert client.features.json_variation("json-flag", {}) == {
            "key": "value",
            "nested": {"a": 1},
        }

    def test_variation_details(self):
        client = GatrixClient(_config(bootstrap=BOOTSTRAP_FULL))
        r = client.features.bool_variation_details("bool-flag", False)
        assert r.value is True
        assert r.flag_exists is True

    def test_or_throw(self):
        client = GatrixClient(_config(bootstrap=BOOTSTRAP_FULL))
        assert client.features.bool_variation_or_throw("bool-flag") is True

        from gatrix.errors import GatrixFeatureError
        with pytest.raises(GatrixFeatureError):
            client.features.bool_variation_or_throw("nonexistent")
