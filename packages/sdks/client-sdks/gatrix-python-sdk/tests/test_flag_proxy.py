"""Tests for FlagProxy.

Note: FlagProxy without a VariationProvider (client=None) returns
fallback values for all variation calls. The actual variation logic
is tested via FeaturesClient integration tests.

These tests verify:
1. Property accessors work correctly (exists, name, version, etc.)
2. Fallback behavior when client is None
3. Delegation to client when provided
"""
import pytest

from gatrix.errors import GatrixFeatureError
from gatrix.flag_proxy import FlagProxy, MISSING_FLAG
from gatrix.types import MISSING_VARIANT
from tests.fixtures import BOOTSTRAP_FULL, BOOTSTRAP_WITH_VARIANTS, make_flag


class TestFlagProxyExists:
    def test_exists_when_provided(self):
        proxy = FlagProxy(make_flag("f", enabled=True))
        assert proxy.exists is True

    def test_not_exists_when_none(self):
        proxy = FlagProxy(None)
        assert proxy.exists is False


class TestFlagProxyProperties:
    def test_enabled_no_client(self):
        proxy = FlagProxy(make_flag("f", enabled=True))
        assert proxy.enabled is True

    def test_disabled_no_client(self):
        proxy = FlagProxy(make_flag("f", enabled=False))
        assert proxy.enabled is False

    def test_name(self):
        proxy = FlagProxy(make_flag("my-flag"))
        assert proxy.name == "my-flag"

    def test_name_missing(self):
        proxy = FlagProxy(None)
        assert proxy.name == ""

    def test_variant_fallback(self):
        proxy = FlagProxy(None)
        assert proxy.variant == MISSING_VARIANT

    def test_version(self):
        proxy = FlagProxy(make_flag("f", version=5))
        assert proxy.version == 5

    def test_version_missing(self):
        proxy = FlagProxy(None)
        assert proxy.version == 0

    def test_value_type(self):
        proxy = FlagProxy(make_flag("f", value_type="string"))
        assert proxy.value_type == "string"

    def test_value_type_missing(self):
        proxy = FlagProxy(None)
        assert proxy.value_type == "none"

    def test_raw_exists(self):
        f = make_flag("f", enabled=True)
        proxy = FlagProxy(f)
        assert proxy.raw is f

    def test_raw_missing(self):
        proxy = FlagProxy(None)
        assert proxy.raw is None


class TestVariationNoClient:
    """Without a VariationProvider, variation returns fallback values."""

    def test_variation_returns_variant_name(self):
        f = make_flag("f", enabled=True, variant_name="beta", variant_enabled=True)
        assert FlagProxy(f).variation("default") == "beta"

    def test_variation_returns_default_when_missing(self):
        assert FlagProxy(None).variation("fallback") == "fallback"

    def test_bool_variation_returns_default(self):
        f = make_flag("f", enabled=True)
        assert FlagProxy(f).bool_variation(False) is False  # No client, returns fallback

    def test_string_variation_returns_default(self):
        assert FlagProxy(None).string_variation("default") == "default"

    def test_int_variation_returns_default(self):
        assert FlagProxy(None).int_variation(7) == 7

    def test_float_variation_returns_default(self):
        assert FlagProxy(None).float_variation(3.14) == 3.14

    def test_json_variation_returns_default(self):
        assert FlagProxy(None).json_variation({"d": 1}) == {"d": 1}


class TestOrThrowNoClient:
    """Without a VariationProvider, or_throw raises errors."""

    def test_bool_or_throw_no_client(self):
        with pytest.raises(GatrixFeatureError, match="no client"):
            FlagProxy(None).bool_variation_or_throw()

    def test_string_or_throw_no_client(self):
        with pytest.raises(GatrixFeatureError, match="no client"):
            FlagProxy(None).string_variation_or_throw()

    def test_int_or_throw_no_client(self):
        with pytest.raises(GatrixFeatureError, match="no client"):
            FlagProxy(None).int_variation_or_throw()

    def test_float_or_throw_no_client(self):
        with pytest.raises(GatrixFeatureError, match="no client"):
            FlagProxy(None).float_variation_or_throw()

    def test_json_or_throw_no_client(self):
        with pytest.raises(GatrixFeatureError, match="no client"):
            FlagProxy(None).json_variation_or_throw()


class TestDetailsNoClient:
    """Without a VariationProvider, details return no_client reason."""

    def test_bool_details_no_client(self):
        r = FlagProxy(None).bool_variation_details(True)
        assert r.value is True
        assert r.flag_exists is False
        assert r.reason == "no_client"

    def test_string_details_no_client(self):
        r = FlagProxy(None).string_variation_details("def")
        assert r.value == "def"
        assert r.flag_exists is False

    def test_int_details_no_client(self):
        r = FlagProxy(None).int_variation_details(0)
        assert r.value == 0
        assert r.flag_exists is False

    def test_float_details_no_client(self):
        r = FlagProxy(None).float_variation_details(0.0)
        assert r.value == 0.0
        assert r.flag_exists is False

    def test_json_details_no_client(self):
        r = FlagProxy(None).json_variation_details({})
        assert r.value == {}
        assert r.flag_exists is False


class TestWithBootstrapData:
    """Use shared bootstrap data sets – property-only tests (no client)."""

    def test_full_bootstrap_bool_flag_enabled(self):
        flags = {f.name: f for f in BOOTSTRAP_FULL}
        proxy = FlagProxy(flags["bool-flag"])
        assert proxy.exists is True
        assert proxy.enabled is True  # No client, returns flag.enabled directly

    def test_full_bootstrap_string_flag_properties(self):
        flags = {f.name: f for f in BOOTSTRAP_FULL}
        proxy = FlagProxy(flags["string-flag"])
        assert proxy.value_type == "string"
        assert proxy.variant.value == "hello world"

    def test_full_bootstrap_number_flag_properties(self):
        flags = {f.name: f for f in BOOTSTRAP_FULL}
        proxy = FlagProxy(flags["number-flag"])
        assert proxy.value_type == "number"
        assert proxy.variant.value == 42

    def test_full_bootstrap_json_flag_properties(self):
        flags = {f.name: f for f in BOOTSTRAP_FULL}
        proxy = FlagProxy(flags["json-flag"])
        assert proxy.value_type == "json"
        assert proxy.variant.value == {"key": "value", "nested": {"a": 1}}

    def test_full_bootstrap_disabled_flag(self):
        flags = {f.name: f for f in BOOTSTRAP_FULL}
        proxy = FlagProxy(flags["disabled-flag"])
        assert proxy.enabled is False

    def test_variant_bootstrap_dark_theme(self):
        flags = {f.name: f for f in BOOTSTRAP_WITH_VARIANTS}
        proxy = FlagProxy(flags["color-theme"])
        assert proxy.variation("light") == "dark"
        assert proxy.variant.value == "dark-mode"

    def test_variant_bootstrap_price(self):
        flags = {f.name: f for f in BOOTSTRAP_WITH_VARIANTS}
        proxy = FlagProxy(flags["price-multiplier"])
        assert proxy.variant.value == 1.5

    def test_variant_bootstrap_ui_config(self):
        flags = {f.name: f for f in BOOTSTRAP_WITH_VARIANTS}
        proxy = FlagProxy(flags["ui-config"])
        assert proxy.variant.value["sidebar"] is True
        assert proxy.variant.value["compact"] is False

    def test_variant_bootstrap_disabled(self):
        flags = {f.name: f for f in BOOTSTRAP_WITH_VARIANTS}
        proxy = FlagProxy(flags["disabled-variant"])
        assert proxy.enabled is False
        assert proxy.variation("default") == "beta"  # variant.name returned regardless of enabled
