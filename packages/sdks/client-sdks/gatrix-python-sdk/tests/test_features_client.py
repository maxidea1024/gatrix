"""Tests for FeaturesClient using bootstrap data (no network)."""
import pytest

from gatrix.events import EVENTS, EventEmitter
from gatrix.features_client import FeaturesClient
from gatrix.flag_proxy import FlagProxy
from gatrix.storage import InMemoryStorageProvider
from gatrix.types import (
    DISABLED_VARIANT,
    FeaturesConfig,
    GatrixClientConfig,
    GatrixContext,
    Variant,
)
from gatrix.variant_source import VariantSource
from tests.fixtures import (
    BOOTSTRAP_FULL,
    BOOTSTRAP_IMPRESSION,
    BOOTSTRAP_SIMPLE,
    BOOTSTRAP_WITH_VARIANTS,
    make_flag,
)


def _config(
    bootstrap=None,
    offline=True,
    explicit_sync=False,
    impression_all=False,
    disable_metrics=True,
    disable_stats=False,
) -> GatrixClientConfig:
    return GatrixClientConfig(
        api_url="https://api.example.com/api/v1",
        api_token="test-token",
        app_name="test-app",
        environment="development",
        offline_mode=offline,
        features=FeaturesConfig(
            bootstrap=bootstrap,
            explicit_sync_mode=explicit_sync,
            impression_data_all=impression_all,
            disable_metrics=disable_metrics,
            disable_stats=disable_stats,
        ),
    )


class TestBootstrapInit:
    def test_ready_after_bootstrap(self):
        emitter = EventEmitter()
        events = []
        emitter.on(EVENTS.FLAGS_READY, lambda: events.append("ready"))
        emitter.on(EVENTS.FLAGS_INIT, lambda: events.append("init"))

        fc = FeaturesClient(_config(bootstrap=BOOTSTRAP_SIMPLE), emitter)
        assert "init" in events
        assert "ready" in events

    def test_flags_loaded_from_bootstrap(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_SIMPLE), EventEmitter()
        )
        assert fc.is_enabled("feature-on") is True
        assert fc.is_enabled("feature-off") is False

    def test_empty_bootstrap(self):
        emitter = EventEmitter()
        events = []
        emitter.on(EVENTS.FLAGS_READY, lambda: events.append("ready"))
        fc = FeaturesClient(_config(bootstrap=[]), emitter)
        assert "ready" not in events

    def test_get_all_flags(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_FULL), EventEmitter()
        )
        flags = fc.get_all_flags()
        assert len(flags) == len(BOOTSTRAP_FULL)
        names = {f.name for f in flags}
        assert "bool-flag" in names
        assert "string-flag" in names


class TestIsEnabled:
    def test_enabled_flag(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_SIMPLE), EventEmitter()
        )
        assert fc.is_enabled("feature-on") is True

    def test_disabled_flag(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_SIMPLE), EventEmitter()
        )
        assert fc.is_enabled("feature-off") is False

    def test_missing_flag_returns_false(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_SIMPLE), EventEmitter()
        )
        assert fc.is_enabled("nonexistent") is False


class TestGetVariant:
    def test_enabled_variant(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_WITH_VARIANTS), EventEmitter()
        )
        v = fc.get_variant("color-theme")
        assert v.name == "dark"
        assert v.enabled is True
        assert v.value == "dark-mode"

    def test_disabled_flag_returns_disabled_variant(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_WITH_VARIANTS), EventEmitter()
        )
        v = fc.get_variant("disabled-variant")
        assert v.name == "beta"
        assert v.enabled is True  # variant itself is enabled, flag is disabled

    def test_missing_flag_returns_disabled_variant(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_SIMPLE), EventEmitter()
        )
        v = fc.get_variant("nonexistent")
        assert v.name == VariantSource.MISSING


class TestVariations:
    def test_variation(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_WITH_VARIANTS), EventEmitter()
        )
        assert fc.variation("color-theme", "light") == "dark"
        assert fc.variation("disabled-variant", "fallback") == "beta"
        assert fc.variation("nonexistent", "default") == "default"

    def test_bool_variation(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_FULL), EventEmitter()
        )
        assert fc.bool_variation("bool-flag", False) is True
        assert fc.bool_variation("disabled-flag", True) is False  # value_type=boolean, value=False
        assert fc.bool_variation("nonexistent", True) is True

    def test_string_variation(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_FULL), EventEmitter()
        )
        assert fc.string_variation("string-flag", "") == "hello world"
        assert fc.string_variation("disabled-flag", "def") == "def"  # no string value -> default
        assert fc.string_variation("nonexistent", "def") == "def"

    def test_int_variation(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_FULL), EventEmitter()
        )
        assert fc.int_variation("number-flag", 0) == 42
        assert fc.int_variation("disabled-flag", 99) == 99
        assert fc.int_variation("nonexistent", 7) == 7

    def test_float_variation(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_FULL), EventEmitter()
        )
        assert fc.float_variation("number-flag", 0.0) == 42.0
        assert fc.float_variation("disabled-flag", 99.0) == 99.0
        assert fc.float_variation("nonexistent", 7.0) == 7.0

    def test_json_variation(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_FULL), EventEmitter()
        )
        result = fc.json_variation("json-flag", {})
        assert result == {"key": "value", "nested": {"a": 1}}
        assert fc.json_variation("disabled-flag", {"d": 1}) == {"d": 1}
        assert fc.json_variation("nonexistent", {}) == {}

    def test_json_string_payload(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_FULL), EventEmitter()
        )
        result = fc.json_variation("json-string-flag", {})
        assert result == {"parsed": True}


class TestVariationDetails:
    def test_bool_details(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_FULL), EventEmitter()
        )
        r = fc.bool_variation_details("bool-flag", False)
        assert r.value is True
        assert r.flag_exists is True
        assert r.enabled is True

    def test_details_not_found(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_FULL), EventEmitter()
        )
        r = fc.bool_variation_details("nonexistent", True)
        assert r.value is True
        assert r.flag_exists is False
        assert r.reason == "flag_not_found"

    def test_string_details(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_FULL), EventEmitter()
        )
        r = fc.string_variation_details("string-flag", "")
        assert r.value == "hello world"

    def test_int_details(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_FULL), EventEmitter()
        )
        r = fc.int_variation_details("number-flag", 0)
        assert r.value == 42

    def test_float_details(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_FULL), EventEmitter()
        )
        r = fc.float_variation_details("number-flag", 0.0)
        assert r.value == 42.0

    def test_json_details(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_FULL), EventEmitter()
        )
        r = fc.json_variation_details("json-flag", {})
        assert r.value == {"key": "value", "nested": {"a": 1}}


class TestOrThrow:
    def test_bool_or_throw(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_FULL), EventEmitter()
        )
        assert fc.bool_variation_or_throw("bool-flag") is True

    def test_string_or_throw(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_FULL), EventEmitter()
        )
        assert fc.string_variation_or_throw("string-flag") == "hello world"

    def test_int_or_throw(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_FULL), EventEmitter()
        )
        assert fc.int_variation_or_throw("number-flag") == 42

    def test_float_or_throw(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_FULL), EventEmitter()
        )
        assert fc.float_variation_or_throw("number-flag") == 42.0

    def test_json_or_throw(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_FULL), EventEmitter()
        )
        assert fc.json_variation_or_throw("json-flag") == {
            "key": "value",
            "nested": {"a": 1},
        }

    def test_or_throw_missing(self):
        from gatrix.errors import GatrixFeatureError

        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_FULL), EventEmitter()
        )
        with pytest.raises(GatrixFeatureError):
            fc.bool_variation_or_throw("nonexistent")


class TestMissingFlags:
    def test_missing_tracked(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_SIMPLE), EventEmitter()
        )
        fc.is_enabled("missing-1")
        fc.is_enabled("missing-1")
        fc.is_enabled("missing-2")
        stats = fc.get_stats()
        missing = stats["features"]["missing_flags"]
        assert missing["missing-1"] == 2
        assert missing["missing-2"] == 1

    def test_missing_not_tracked_when_stats_disabled(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_SIMPLE, disable_stats=True),
            EventEmitter(),
        )
        fc.is_enabled("missing-1")
        stats = fc.get_stats()
        assert stats["features"]["missing_flags"] == {}


class TestImpressions:
    def test_impression_emitted(self):
        emitter = EventEmitter()
        impressions = []
        emitter.on(EVENTS.FLAGS_IMPRESSION, lambda e: impressions.append(e))

        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_IMPRESSION), emitter
        )
        fc.is_enabled("tracked-flag")
        assert len(impressions) == 1
        assert impressions[0].feature_name == "tracked-flag"

    def test_no_impression_for_untracked(self):
        emitter = EventEmitter()
        impressions = []
        emitter.on(EVENTS.FLAGS_IMPRESSION, lambda e: impressions.append(e))

        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_IMPRESSION), emitter
        )
        fc.is_enabled("untracked-flag")
        assert len(impressions) == 0

    def test_impression_data_all(self):
        emitter = EventEmitter()
        impressions = []
        emitter.on(EVENTS.FLAGS_IMPRESSION, lambda e: impressions.append(e))

        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_SIMPLE, impression_all=True),
            emitter,
        )
        fc.is_enabled("feature-on")
        fc.is_enabled("feature-off")
        assert len(impressions) == 2


class TestFlagEnabledCounts:
    def test_counts_tracked(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_SIMPLE), EventEmitter()
        )
        fc.is_enabled("feature-on")
        fc.is_enabled("feature-on")
        fc.is_enabled("feature-off")

        stats = fc.get_stats()
        counts = stats["features"]["flag_enabled_counts"]
        assert counts["feature-on"] == {"yes": 2, "no": 0}
        assert counts["feature-off"] == {"yes": 0, "no": 1}


class TestExplicitSyncMode:
    def test_is_explicit_sync(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_SIMPLE, explicit_sync=True),
            EventEmitter(),
        )
        assert fc.is_explicit_sync_enabled() is True

    def test_not_explicit_sync(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_SIMPLE), EventEmitter()
        )
        assert fc.is_explicit_sync_enabled() is False

    def test_can_sync_false_initially(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_SIMPLE, explicit_sync=True),
            EventEmitter(),
        )
        assert fc.has_pending_sync_flags() is False


class TestWatchFlag:
    def test_watch_flag_change(self):
        emitter = EventEmitter()
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_SIMPLE), emitter
        )
        changes = []
        fc.watch_flag("feature-on", lambda *args: changes.append(args))

        # Simulate change
        emitter.emit("flags.feature-on.change", FlagProxy(make_flag("feature-on")), None, "updated")
        assert len(changes) == 1

    def test_unwatch(self):
        emitter = EventEmitter()
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_SIMPLE), emitter
        )
        changes = []
        unwatch = fc.watch_flag("feature-on", lambda *args: changes.append(args))
        unwatch()

        emitter.emit("flags.feature-on.change", FlagProxy(make_flag("feature-on")), None, "updated")
        assert len(changes) == 0

    def test_watch_with_initial_state(self):
        emitter = EventEmitter()
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_SIMPLE), emitter
        )
        states = []
        fc.watch_flag_with_initial_state(
            "feature-on", lambda proxy: states.append(proxy.enabled)
        )
        assert len(states) == 1
        assert states[0] is True


class TestWatchFlagGroup:
    def test_group_watch_and_unwatch(self):
        emitter = EventEmitter()
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_SIMPLE), emitter
        )
        group = fc.create_watch_flag_group("test-group")
        changes: list = []
        group.watch_flag("feature-on", lambda *a: changes.append("on"))
        group.watch_flag("feature-off", lambda *a: changes.append("off"))

        assert group.size == 2
        assert group.name == "test-group"

        emitter.emit("flags.feature-on.change", None, None, "updated")
        assert len(changes) == 1

        group.unwatch_all()
        emitter.emit("flags.feature-on.change", None, None, "updated")
        assert len(changes) == 1  # No more events

    def test_group_destroy(self):
        emitter = EventEmitter()
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_SIMPLE), emitter
        )
        group = fc.create_watch_flag_group("my-group")
        group.watch_flag("feature-on", lambda *a: None)

        stats = fc.get_stats()
        assert "my-group" in stats["features"]["active_watch_groups"]

        group.destroy()
        stats = fc.get_stats()
        assert "my-group" not in stats["features"]["active_watch_groups"]


class TestContext:
    def test_get_context_default(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_SIMPLE), EventEmitter()
        )
        ctx = fc.get_context()
        assert ctx.user_id is None

    def test_update_context(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_SIMPLE), EventEmitter()
        )
        new_ctx = GatrixContext(user_id="user-123")
        fc.update_context(new_ctx)
        assert fc.get_context().user_id == "user-123"
        stats = fc.get_stats()
        assert stats["features"]["context_change_count"] == 1


class TestStats:
    def test_initial_stats(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_SIMPLE), EventEmitter()
        )
        stats = fc.get_stats()
        assert stats["sdk_state"] == "ready"
        assert stats["offline_mode"] is True
        assert stats["features"]["total_flag_count"] == 2
        assert stats["features"]["fetch_flags_count"] == 0
        assert stats["features"]["update_count"] == 0

    def test_stats_after_operations(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_FULL), EventEmitter()
        )
        fc.is_enabled("bool-flag")
        fc.is_enabled("nonexistent")
        fc.get_variant("string-flag")

        stats = fc.get_stats()
        assert stats["features"]["total_flag_count"] == len(BOOTSTRAP_FULL)
        assert "nonexistent" in stats["features"]["missing_flags"]
        assert stats["features"]["flag_enabled_counts"]["bool-flag"]["yes"] == 1


class TestCacheStorage:
    def test_flags_cached_on_init(self):
        storage = InMemoryStorageProvider()
        # Pre-load flags into storage
        from gatrix.features_client import _flag_to_dict
        cached = [_flag_to_dict(f) for f in BOOTSTRAP_SIMPLE]
        storage.save("gatrix_cache_flags", cached)

        fc = FeaturesClient(
            _config(bootstrap=None), EventEmitter(), storage=storage
        )
        assert fc.is_enabled("feature-on") is True
        assert fc.is_enabled("feature-off") is False

    def test_bootstrap_overrides_cache(self):
        storage = InMemoryStorageProvider()
        from gatrix.features_client import _flag_to_dict
        cached = [_flag_to_dict(make_flag("feature-on", enabled=False))]
        storage.save("gatrix_cache_flags", cached)

        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_SIMPLE), EventEmitter(), storage=storage
        )
        # Bootstrap has feature-on=True, should override cache
        assert fc.is_enabled("feature-on") is True

    def test_etag_from_cache(self):
        storage = InMemoryStorageProvider()
        storage.save("gatrix_cache_etag", "W/\"abc123\"")

        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_SIMPLE), EventEmitter(), storage=storage
        )
        assert fc._etag == "W/\"abc123\""


class TestFlagChangeEvents:
    def test_apply_flags_emits_change(self):
        emitter = EventEmitter()
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_SIMPLE), emitter
        )
        changes = []
        emitter.on(EVENTS.FLAGS_CHANGE, lambda data: changes.append(data))

        # Apply new flags
        new_flags = {
            "feature-on": make_flag("feature-on", enabled=False, version=2),
            "feature-off": make_flag("feature-off", enabled=False),
        }
        fc._apply_flags(new_flags)

        assert len(changes) == 1
        # feature-on changed (enabled True->False)
        changed_names = [f.name for f in changes[0]["flags"]]
        assert "feature-on" in changed_names

    def test_apply_flags_emits_removed(self):
        emitter = EventEmitter()
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_SIMPLE), emitter
        )
        removed_events = []
        emitter.on(EVENTS.FLAGS_REMOVED, lambda names: removed_events.append(names))

        # Apply flags without "feature-on"
        new_flags = {
            "feature-off": make_flag("feature-off", enabled=False),
        }
        fc._apply_flags(new_flags)

        assert len(removed_events) == 1
        assert "feature-on" in removed_events[0]

    def test_per_flag_change_event(self):
        emitter = EventEmitter()
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_SIMPLE), emitter
        )
        per_flag = []
        emitter.on(
            "flags.feature-on.change",
            lambda proxy, old, change_type: per_flag.append(
                (proxy, old, change_type)
            ),
        )

        new_flags = {
            "feature-on": make_flag("feature-on", enabled=False, version=2),
            "feature-off": make_flag("feature-off", enabled=False),
        }
        fc._apply_flags(new_flags)

        assert len(per_flag) == 1
        proxy, old_proxy, ct = per_flag[0]
        assert ct == "updated"

    def test_new_flag_emits_created(self):
        emitter = EventEmitter()
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_SIMPLE), emitter
        )
        created = []
        emitter.on(
            "flags.brand-new.change",
            lambda proxy, old, change_type: created.append(change_type),
        )

        new_flags = {
            "feature-on": make_flag("feature-on"),
            "feature-off": make_flag("feature-off", enabled=False),
            "brand-new": make_flag("brand-new", enabled=True, version=1),
        }
        fc._apply_flags(new_flags)

        assert created == ["created"]

    def test_no_change_no_event(self):
        emitter = EventEmitter()
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_SIMPLE), emitter
        )
        changes = []
        emitter.on(EVENTS.FLAGS_CHANGE, lambda data: changes.append(data))

        # Apply identical flags
        new_flags = {f.name: f for f in BOOTSTRAP_SIMPLE}
        fc._apply_flags(new_flags)

        assert len(changes) == 0  # No changes


class TestConnectionId:
    def test_connection_id_is_uuid(self):
        import uuid

        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_SIMPLE), EventEmitter()
        )
        # Should be a valid UUID
        uuid.UUID(fc._connection_id)


class TestOfflineMode:
    def test_offline_no_fetch(self):
        fc = FeaturesClient(
            _config(bootstrap=BOOTSTRAP_SIMPLE, offline=True),
            EventEmitter(),
        )
        fc.start()
        stats = fc.get_stats()
        assert stats["features"]["fetch_flags_count"] == 0
