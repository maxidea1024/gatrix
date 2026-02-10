"""Tests for FlagProxy."""
import pytest

from gatrix.errors import GatrixFeatureError
from gatrix.flag_proxy import FlagProxy
from gatrix.types import DISABLED_VARIANT
from tests.fixtures import BOOTSTRAP_FULL, BOOTSTRAP_WITH_VARIANTS, make_flag


class TestFlagProxyExists:
    def test_exists_when_provided(self):
        proxy = FlagProxy(make_flag("f", enabled=True))
        assert proxy.exists is True

    def test_not_exists_when_none(self):
        proxy = FlagProxy(None)
        assert proxy.exists is False


class TestFlagProxyProperties:
    def test_enabled(self):
        proxy = FlagProxy(make_flag("f", enabled=True))
        assert proxy.enabled is True

    def test_disabled(self):
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
        assert proxy.variant == DISABLED_VARIANT

    def test_version(self):
        proxy = FlagProxy(make_flag("f", version=5))
        assert proxy.version == 5

    def test_version_missing(self):
        proxy = FlagProxy(None)
        assert proxy.version == 0


class TestVariation:
    def test_returns_variant_name_when_enabled(self):
        f = make_flag("f", enabled=True, variant_name="beta",
                      variant_enabled=True)
        assert FlagProxy(f).variation("default") == "beta"

    def test_returns_default_when_disabled(self):
        f = make_flag("f", enabled=False, variant_name="beta",
                      variant_enabled=True)
        assert FlagProxy(f).variation("default") == "default"

    def test_returns_default_when_missing(self):
        assert FlagProxy(None).variation("fallback") == "fallback"

    def test_returns_default_when_variant_disabled(self):
        f = make_flag("f", enabled=True, variant_name="disabled",
                      variant_enabled=False)
        assert FlagProxy(f).variation("default") == "default"


class TestBoolVariation:
    def test_enabled(self):
        f = make_flag("f", enabled=True)
        assert FlagProxy(f).bool_variation(False) is True

    def test_disabled(self):
        f = make_flag("f", enabled=False)
        assert FlagProxy(f).bool_variation(True) is False

    def test_missing(self):
        assert FlagProxy(None).bool_variation(True) is True


class TestStringVariation:
    def test_returns_payload(self):
        f = make_flag("f", enabled=True, variant_name="v",
                      variant_enabled=True, payload="hello", variant_type="string")
        assert FlagProxy(f).string_variation("default") == "hello"

    def test_returns_default_when_disabled(self):
        f = make_flag("f", enabled=False, variant_name="v",
                      variant_enabled=True, payload="hello")
        assert FlagProxy(f).string_variation("default") == "default"

    def test_returns_default_when_no_payload(self):
        f = make_flag("f", enabled=True, variant_name="v",
                      variant_enabled=True, payload=None)
        assert FlagProxy(f).string_variation("default") == "default"

    def test_returns_default_when_missing(self):
        assert FlagProxy(None).string_variation("default") == "default"


class TestNumberVariation:
    def test_returns_number(self):
        f = make_flag("f", enabled=True, variant_name="v",
                      variant_enabled=True, payload=42, variant_type="number")
        assert FlagProxy(f).number_variation(0) == 42.0

    def test_float_payload(self):
        f = make_flag("f", enabled=True, variant_name="v",
                      variant_enabled=True, payload=1.5, variant_type="number")
        assert FlagProxy(f).number_variation(0) == 1.5

    def test_returns_default_when_disabled(self):
        f = make_flag("f", enabled=False, variant_name="v",
                      variant_enabled=True, payload=42)
        assert FlagProxy(f).number_variation(99) == 99

    def test_returns_default_when_invalid(self):
        f = make_flag("f", enabled=True, variant_name="v",
                      variant_enabled=True, payload="not-a-number")
        assert FlagProxy(f).number_variation(0) == 0

    def test_returns_default_when_missing(self):
        assert FlagProxy(None).number_variation(7) == 7


class TestJsonVariation:
    def test_returns_dict(self):
        data = {"key": "value"}
        f = make_flag("f", enabled=True, variant_name="v",
                      variant_enabled=True, payload=data, variant_type="json")
        assert FlagProxy(f).json_variation({}) == data

    def test_parses_json_string(self):
        f = make_flag("f", enabled=True, variant_name="v",
                      variant_enabled=True, payload='{"a": 1}', variant_type="json")
        assert FlagProxy(f).json_variation({}) == {"a": 1}

    def test_returns_default_when_invalid_json(self):
        f = make_flag("f", enabled=True, variant_name="v",
                      variant_enabled=True, payload="not-json")
        assert FlagProxy(f).json_variation({"fallback": True}) == {"fallback": True}

    def test_returns_default_when_disabled(self):
        f = make_flag("f", enabled=False, variant_name="v",
                      variant_enabled=True, payload={"key": "value"})
        assert FlagProxy(f).json_variation({}) == {}

    def test_returns_default_when_missing(self):
        assert FlagProxy(None).json_variation({"d": 1}) == {"d": 1}


class TestVariationDetails:
    def test_bool_details_found(self):
        f = make_flag("f", enabled=True, reason="targeting_match")
        r = FlagProxy(f).bool_variation_details(False)
        assert r.value is True
        assert r.flag_exists is True
        assert r.enabled is True
        assert r.reason == "targeting_match"

    def test_bool_details_not_found(self):
        r = FlagProxy(None).bool_variation_details(True)
        assert r.value is True
        assert r.flag_exists is False
        assert r.reason == "not_found"

    def test_string_details(self):
        f = make_flag("f", enabled=True, variant_name="v",
                      variant_enabled=True, payload="val")
        r = FlagProxy(f).string_variation_details("def")
        assert r.value == "val"
        assert r.flag_exists is True

    def test_number_details(self):
        f = make_flag("f", enabled=True, variant_name="v",
                      variant_enabled=True, payload=3.14)
        r = FlagProxy(f).number_variation_details(0)
        assert r.value == 3.14

    def test_json_details(self):
        data = {"key": "val"}
        f = make_flag("f", enabled=True, variant_name="v",
                      variant_enabled=True, payload=data, variant_type="json")
        r = FlagProxy(f).json_variation_details({})
        assert r.value == data


class TestOrThrow:
    def test_bool_or_throw_success(self):
        f = make_flag("f", enabled=True)
        assert FlagProxy(f).bool_variation_or_throw() is True

    def test_bool_or_throw_not_found(self):
        with pytest.raises(GatrixFeatureError, match="not found"):
            FlagProxy(None).bool_variation_or_throw()

    def test_bool_or_throw_disabled(self):
        f = make_flag("f", enabled=False)
        with pytest.raises(GatrixFeatureError, match="disabled"):
            FlagProxy(f).bool_variation_or_throw()

    def test_string_or_throw_success(self):
        f = make_flag("f", enabled=True, variant_name="v",
                      variant_enabled=True, payload="hello")
        assert FlagProxy(f).string_variation_or_throw() == "hello"

    def test_string_or_throw_no_payload(self):
        f = make_flag("f", enabled=True, variant_name="v",
                      variant_enabled=True, payload=None)
        with pytest.raises(GatrixFeatureError, match="no string payload"):
            FlagProxy(f).string_variation_or_throw()

    def test_number_or_throw_success(self):
        f = make_flag("f", enabled=True, variant_name="v",
                      variant_enabled=True, payload=42)
        assert FlagProxy(f).number_variation_or_throw() == 42.0

    def test_number_or_throw_invalid(self):
        f = make_flag("f", enabled=True, variant_name="v",
                      variant_enabled=True, payload="abc")
        with pytest.raises(GatrixFeatureError, match="not a valid number"):
            FlagProxy(f).number_variation_or_throw()

    def test_json_or_throw_success(self):
        data = {"key": "val"}
        f = make_flag("f", enabled=True, variant_name="v",
                      variant_enabled=True, payload=data)
        assert FlagProxy(f).json_variation_or_throw() == data

    def test_json_or_throw_invalid(self):
        f = make_flag("f", enabled=True, variant_name="v",
                      variant_enabled=True, payload="not-json{")
        with pytest.raises(GatrixFeatureError, match="not valid JSON"):
            FlagProxy(f).json_variation_or_throw()


class TestWithBootstrapData:
    """Use shared bootstrap data sets."""

    def test_full_bootstrap_bool_flag(self):
        flags = {f.name: f for f in BOOTSTRAP_FULL}
        proxy = FlagProxy(flags["bool-flag"])
        assert proxy.bool_variation(False) is True

    def test_full_bootstrap_string_flag(self):
        flags = {f.name: f for f in BOOTSTRAP_FULL}
        proxy = FlagProxy(flags["string-flag"])
        assert proxy.string_variation("") == "hello world"

    def test_full_bootstrap_number_flag(self):
        flags = {f.name: f for f in BOOTSTRAP_FULL}
        proxy = FlagProxy(flags["number-flag"])
        assert proxy.number_variation(0) == 42.0

    def test_full_bootstrap_json_flag(self):
        flags = {f.name: f for f in BOOTSTRAP_FULL}
        proxy = FlagProxy(flags["json-flag"])
        result = proxy.json_variation({})
        assert result == {"key": "value", "nested": {"a": 1}}

    def test_full_bootstrap_json_string_flag(self):
        flags = {f.name: f for f in BOOTSTRAP_FULL}
        proxy = FlagProxy(flags["json-string-flag"])
        result = proxy.json_variation({})
        assert result == {"parsed": True}

    def test_full_bootstrap_disabled_flag(self):
        flags = {f.name: f for f in BOOTSTRAP_FULL}
        proxy = FlagProxy(flags["disabled-flag"])
        assert proxy.bool_variation(True) is False
        assert proxy.string_variation("def") == "def"
        assert proxy.number_variation(99) == 99

    def test_full_bootstrap_variant_disabled(self):
        flags = {f.name: f for f in BOOTSTRAP_FULL}
        proxy = FlagProxy(flags["variant-disabled-flag"])
        assert proxy.variation("fallback") == "fallback"
        assert proxy.enabled is True  # flag enabled but variant disabled

    def test_variant_bootstrap_dark_theme(self):
        flags = {f.name: f for f in BOOTSTRAP_WITH_VARIANTS}
        proxy = FlagProxy(flags["color-theme"])
        assert proxy.variation("light") == "dark"
        assert proxy.string_variation("") == "dark-mode"

    def test_variant_bootstrap_price(self):
        flags = {f.name: f for f in BOOTSTRAP_WITH_VARIANTS}
        proxy = FlagProxy(flags["price-multiplier"])
        assert proxy.number_variation(1.0) == 1.5

    def test_variant_bootstrap_ui_config(self):
        flags = {f.name: f for f in BOOTSTRAP_WITH_VARIANTS}
        proxy = FlagProxy(flags["ui-config"])
        result = proxy.json_variation({})
        assert result["sidebar"] is True
        assert result["compact"] is False

    def test_variant_bootstrap_disabled(self):
        flags = {f.name: f for f in BOOTSTRAP_WITH_VARIANTS}
        proxy = FlagProxy(flags["disabled-variant"])
        assert proxy.enabled is False
        assert proxy.variation("default") == "default"
