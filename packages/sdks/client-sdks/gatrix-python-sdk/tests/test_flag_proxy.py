"""Tests for FlagProxy.

These tests verify:
1. Property accessors work correctly (exists, name, version, etc.)
2. Delegation to client (MockVariationProvider)
3. Correct flag_name propagation
"""
import pytest

from gatrix.errors import GatrixFeatureError
from gatrix.flag_proxy import FlagProxy
from gatrix.types import EvaluatedFlag, Variant, VariationResult
from gatrix.variant_source import VariantSource
from tests.fixtures import BOOTSTRAP_FULL, BOOTSTRAP_WITH_VARIANTS, make_flag


class MockVariationProvider:
    """Mock VariationProvider that records calls and returns configurable values."""

    def __init__(self, flags=None):
        self._flags = {f.name: f for f in (flags or [])}
        self.last_method = None
        self.last_flag_name = None

    def _record(self, method, flag_name):
        self.last_method = method
        self.last_flag_name = flag_name

    def _get_flag(self, name):
        return self._flags.get(name)

    def is_enabled_internal(self, flag_name, force_realtime=False):
        self._record("is_enabled_internal", flag_name)
        f = self._get_flag(flag_name)
        return f.enabled if f else False

    def get_variant_internal(self, flag_name, force_realtime=False):
        self._record("get_variant_internal", flag_name)
        f = self._get_flag(flag_name)
        return f.variant if f else Variant(name=VariantSource.MISSING, enabled=False, value=None)

    def variation_internal(self, flag_name, fallback_value, force_realtime=False):
        self._record("variation_internal", flag_name)
        f = self._get_flag(flag_name)
        if f and f.variant.name != VariantSource.MISSING:
            return f.variant.name
        return fallback_value

    def bool_variation_internal(self, flag_name, fallback_value, force_realtime=False):
        self._record("bool_variation_internal", flag_name)
        f = self._get_flag(flag_name)
        if f and f.value_type == "boolean":
            v = f.variant.value
            if isinstance(v, bool):
                return v
        return fallback_value

    def string_variation_internal(self, flag_name, fallback_value, force_realtime=False):
        self._record("string_variation_internal", flag_name)
        f = self._get_flag(flag_name)
        if f and f.value_type == "string":
            v = f.variant.value
            if isinstance(v, str):
                return v
        return fallback_value

    def int_variation_internal(self, flag_name, fallback_value, force_realtime=False):
        self._record("int_variation_internal", flag_name)
        f = self._get_flag(flag_name)
        if f and f.value_type == "number":
            v = f.variant.value
            if isinstance(v, (int, float)):
                return int(v)
        return fallback_value

    def float_variation_internal(self, flag_name, fallback_value, force_realtime=False):
        self._record("float_variation_internal", flag_name)
        f = self._get_flag(flag_name)
        if f and f.value_type == "number":
            v = f.variant.value
            if isinstance(v, (int, float)):
                return float(v)
        return fallback_value

    def json_variation_internal(self, flag_name, fallback_value, force_realtime=False):
        self._record("json_variation_internal", flag_name)
        f = self._get_flag(flag_name)
        if f and f.value_type == "json":
            return f.variant.value
        return fallback_value

    def bool_variation_details_internal(self, flag_name, fallback_value, force_realtime=False):
        self._record("bool_variation_details_internal", flag_name)
        f = self._get_flag(flag_name)
        if not f:
            return VariationResult(value=fallback_value, flag_exists=False, reason="flag_not_found")
        return VariationResult(value=f.variant.value if isinstance(f.variant.value, bool) else fallback_value,
                               flag_exists=True, enabled=f.enabled, reason="evaluated")

    def string_variation_details_internal(self, flag_name, fallback_value, force_realtime=False):
        self._record("string_variation_details_internal", flag_name)
        f = self._get_flag(flag_name)
        if not f:
            return VariationResult(value=fallback_value, flag_exists=False, reason="flag_not_found")
        return VariationResult(value=f.variant.value if isinstance(f.variant.value, str) else fallback_value,
                               flag_exists=True, enabled=f.enabled, reason="evaluated")

    def int_variation_details_internal(self, flag_name, fallback_value, force_realtime=False):
        self._record("int_variation_details_internal", flag_name)
        f = self._get_flag(flag_name)
        if not f:
            return VariationResult(value=fallback_value, flag_exists=False, reason="flag_not_found")
        return VariationResult(value=int(f.variant.value) if isinstance(f.variant.value, (int, float)) else fallback_value,
                               flag_exists=True, enabled=f.enabled, reason="evaluated")

    def float_variation_details_internal(self, flag_name, fallback_value, force_realtime=False):
        self._record("float_variation_details_internal", flag_name)
        f = self._get_flag(flag_name)
        if not f:
            return VariationResult(value=fallback_value, flag_exists=False, reason="flag_not_found")
        return VariationResult(value=float(f.variant.value) if isinstance(f.variant.value, (int, float)) else fallback_value,
                               flag_exists=True, enabled=f.enabled, reason="evaluated")

    def json_variation_details_internal(self, flag_name, fallback_value, force_realtime=False):
        self._record("json_variation_details_internal", flag_name)
        f = self._get_flag(flag_name)
        if not f:
            return VariationResult(value=fallback_value, flag_exists=False, reason="flag_not_found")
        return VariationResult(value=f.variant.value, flag_exists=True, enabled=f.enabled, reason="evaluated")

    def bool_variation_or_throw_internal(self, flag_name, force_realtime=False):
        self._record("bool_variation_or_throw_internal", flag_name)
        f = self._get_flag(flag_name)
        if not f:
            raise GatrixFeatureError(f"flag '{flag_name}' not found")
        if not isinstance(f.variant.value, bool):
            raise GatrixFeatureError(f"type mismatch for '{flag_name}'")
        return f.variant.value

    def string_variation_or_throw_internal(self, flag_name, force_realtime=False):
        self._record("string_variation_or_throw_internal", flag_name)
        f = self._get_flag(flag_name)
        if not f:
            raise GatrixFeatureError(f"flag '{flag_name}' not found")
        if not isinstance(f.variant.value, str):
            raise GatrixFeatureError(f"type mismatch for '{flag_name}'")
        return f.variant.value

    def int_variation_or_throw_internal(self, flag_name, force_realtime=False):
        self._record("int_variation_or_throw_internal", flag_name)
        f = self._get_flag(flag_name)
        if not f:
            raise GatrixFeatureError(f"flag '{flag_name}' not found")
        return int(f.variant.value)

    def float_variation_or_throw_internal(self, flag_name, force_realtime=False):
        self._record("float_variation_or_throw_internal", flag_name)
        f = self._get_flag(flag_name)
        if not f:
            raise GatrixFeatureError(f"flag '{flag_name}' not found")
        return float(f.variant.value)

    def json_variation_or_throw_internal(self, flag_name, force_realtime=False):
        self._record("json_variation_or_throw_internal", flag_name)
        f = self._get_flag(flag_name)
        if not f:
            raise GatrixFeatureError(f"flag '{flag_name}' not found")
        return f.variant.value


def _make_proxy(flag, flags=None, flag_name=None):
    """Helper to create a FlagProxy with a MockVariationProvider."""
    all_flags = list(flags or [])
    if flag is not None and flag not in all_flags:
        all_flags.append(flag)
    mock = MockVariationProvider(all_flags)
    name = flag_name or (flag.name if flag else "")
    return FlagProxy(flag, mock, name), mock


class TestFlagProxyExists:
    def test_exists_when_provided(self):
        proxy, _ = _make_proxy(make_flag("f", enabled=True))
        assert proxy.exists is True

    def test_not_exists_when_none(self):
        proxy, _ = _make_proxy(None)
        assert proxy.exists is False


class TestFlagProxyProperties:
    def test_enabled_delegates_to_client(self):
        proxy, mock = _make_proxy(make_flag("f", enabled=True))
        assert proxy.enabled is True
        assert mock.last_method == "is_enabled_internal"

    def test_disabled_delegates_to_client(self):
        proxy, mock = _make_proxy(make_flag("f", enabled=False))
        assert proxy.enabled is False
        assert mock.last_method == "is_enabled_internal"

    def test_name(self):
        proxy, _ = _make_proxy(make_flag("my-flag"))
        assert proxy.name == "my-flag"

    def test_name_missing(self):
        proxy, _ = _make_proxy(None)
        assert proxy.name == ""

    def test_variant_from_flag(self):
        proxy, _ = _make_proxy(make_flag("f", variant_name="beta"))
        assert proxy.variant.name == "beta"

    def test_variant_missing_flag(self):
        proxy, _ = _make_proxy(None)
        assert proxy.variant.name == VariantSource.MISSING

    def test_version(self):
        proxy, _ = _make_proxy(make_flag("f", version=5))
        assert proxy.version == 5

    def test_version_missing(self):
        proxy, _ = _make_proxy(None)
        assert proxy.version == 0

    def test_value_type(self):
        proxy, _ = _make_proxy(make_flag("f", value_type="string"))
        assert proxy.value_type == "string"

    def test_value_type_missing(self):
        proxy, _ = _make_proxy(None)
        assert proxy.value_type == "none"

    def test_raw_exists(self):
        f = make_flag("f", enabled=True)
        proxy, _ = _make_proxy(f)
        assert proxy.raw is f

    def test_raw_missing(self):
        proxy, _ = _make_proxy(None)
        assert proxy.raw is None


class TestVariationDelegation:
    """Variation methods should delegate to the VariationProvider."""

    def test_variation_delegates(self):
        f = make_flag("f", enabled=True, variant_name="beta", variant_enabled=True)
        proxy, mock = _make_proxy(f)
        result = proxy.variation("default")
        assert result == "beta"
        assert mock.last_method == "variation_internal"

    def test_variation_fallback_when_missing(self):
        proxy, _ = _make_proxy(None)
        assert proxy.variation("fallback") == "fallback"

    def test_bool_variation_delegates(self):
        f = make_flag("f", enabled=True, value_type="boolean", value=True)
        proxy, mock = _make_proxy(f)
        result = proxy.bool_variation(False)
        assert result is True
        assert mock.last_method == "bool_variation_internal"

    def test_string_variation_delegates(self):
        f = make_flag("f", value_type="string", value="hello")
        proxy, mock = _make_proxy(f)
        result = proxy.string_variation("default")
        assert result == "hello"
        assert mock.last_method == "string_variation_internal"

    def test_int_variation_delegates(self):
        f = make_flag("f", value_type="number", value=42)
        proxy, mock = _make_proxy(f)
        result = proxy.int_variation(0)
        assert result == 42
        assert mock.last_method == "int_variation_internal"

    def test_float_variation_delegates(self):
        f = make_flag("f", value_type="number", value=3.14)
        proxy, mock = _make_proxy(f)
        result = proxy.float_variation(0.0)
        assert result == pytest.approx(3.14)
        assert mock.last_method == "float_variation_internal"

    def test_json_variation_delegates(self):
        f = make_flag("f", value_type="json", value={"key": "val"})
        proxy, mock = _make_proxy(f)
        result = proxy.json_variation({})
        assert result == {"key": "val"}
        assert mock.last_method == "json_variation_internal"


class TestOrThrowDelegation:
    """OrThrow methods delegate to the VariationProvider and raise on missing."""

    def test_bool_or_throw_missing_raises(self):
        proxy, _ = _make_proxy(None)
        with pytest.raises(GatrixFeatureError, match="not found"):
            proxy.bool_variation_or_throw()

    def test_string_or_throw_missing_raises(self):
        proxy, _ = _make_proxy(None)
        with pytest.raises(GatrixFeatureError, match="not found"):
            proxy.string_variation_or_throw()

    def test_int_or_throw_missing_raises(self):
        proxy, _ = _make_proxy(None)
        with pytest.raises(GatrixFeatureError, match="not found"):
            proxy.int_variation_or_throw()

    def test_float_or_throw_missing_raises(self):
        proxy, _ = _make_proxy(None)
        with pytest.raises(GatrixFeatureError, match="not found"):
            proxy.float_variation_or_throw()

    def test_json_or_throw_missing_raises(self):
        proxy, _ = _make_proxy(None)
        with pytest.raises(GatrixFeatureError, match="not found"):
            proxy.json_variation_or_throw()


class TestDetailsDelegation:
    """Details methods delegate to the VariationProvider."""

    def test_bool_details_missing(self):
        proxy, _ = _make_proxy(None)
        r = proxy.bool_variation_details(True)
        assert r.value is True
        assert r.flag_exists is False
        assert r.reason == "flag_not_found"

    def test_string_details_missing(self):
        proxy, _ = _make_proxy(None)
        r = proxy.string_variation_details("def")
        assert r.value == "def"
        assert r.flag_exists is False

    def test_int_details_missing(self):
        proxy, _ = _make_proxy(None)
        r = proxy.int_variation_details(0)
        assert r.value == 0
        assert r.flag_exists is False

    def test_float_details_missing(self):
        proxy, _ = _make_proxy(None)
        r = proxy.float_variation_details(0.0)
        assert r.value == 0.0
        assert r.flag_exists is False

    def test_json_details_missing(self):
        proxy, _ = _make_proxy(None)
        r = proxy.json_variation_details({})
        assert r.value == {}
        assert r.flag_exists is False


class TestWithBootstrapData:
    """Use shared bootstrap data sets with MockVariationProvider."""

    def test_full_bootstrap_bool_flag_enabled(self):
        flags = BOOTSTRAP_FULL
        flags_dict = {f.name: f for f in flags}
        proxy, mock = _make_proxy(flags_dict["bool-flag"], flags=flags)
        assert proxy.exists is True
        assert proxy.enabled is True

    def test_full_bootstrap_string_flag_properties(self):
        flags_dict = {f.name: f for f in BOOTSTRAP_FULL}
        proxy, _ = _make_proxy(flags_dict["string-flag"], flags=BOOTSTRAP_FULL)
        assert proxy.value_type == "string"
        assert proxy.variant.value == "hello world"

    def test_full_bootstrap_number_flag_properties(self):
        flags_dict = {f.name: f for f in BOOTSTRAP_FULL}
        proxy, _ = _make_proxy(flags_dict["number-flag"], flags=BOOTSTRAP_FULL)
        assert proxy.value_type == "number"
        assert proxy.variant.value == 42

    def test_full_bootstrap_json_flag_properties(self):
        flags_dict = {f.name: f for f in BOOTSTRAP_FULL}
        proxy, _ = _make_proxy(flags_dict["json-flag"], flags=BOOTSTRAP_FULL)
        assert proxy.value_type == "json"
        assert proxy.variant.value == {"key": "value", "nested": {"a": 1}}

    def test_full_bootstrap_disabled_flag(self):
        flags_dict = {f.name: f for f in BOOTSTRAP_FULL}
        proxy, _ = _make_proxy(flags_dict["disabled-flag"], flags=BOOTSTRAP_FULL)
        assert proxy.enabled is False

    def test_variant_bootstrap_dark_theme(self):
        flags_dict = {f.name: f for f in BOOTSTRAP_WITH_VARIANTS}
        proxy, _ = _make_proxy(flags_dict["color-theme"], flags=BOOTSTRAP_WITH_VARIANTS)
        assert proxy.variation("light") == "dark"
        assert proxy.variant.value == "dark-mode"

    def test_variant_bootstrap_price(self):
        flags_dict = {f.name: f for f in BOOTSTRAP_WITH_VARIANTS}
        proxy, _ = _make_proxy(flags_dict["price-multiplier"], flags=BOOTSTRAP_WITH_VARIANTS)
        assert proxy.variant.value == 1.5

    def test_variant_bootstrap_ui_config(self):
        flags_dict = {f.name: f for f in BOOTSTRAP_WITH_VARIANTS}
        proxy, _ = _make_proxy(flags_dict["ui-config"], flags=BOOTSTRAP_WITH_VARIANTS)
        assert proxy.variant.value["sidebar"] is True
        assert proxy.variant.value["compact"] is False

    def test_variant_bootstrap_disabled(self):
        flags_dict = {f.name: f for f in BOOTSTRAP_WITH_VARIANTS}
        proxy, _ = _make_proxy(flags_dict["disabled-variant"], flags=BOOTSTRAP_WITH_VARIANTS)
        assert proxy.enabled is False
        # Variant name returned regardless of enabled state
        assert proxy.variation("default") == "beta"


class TestFlagNamePropagation:
    """Verify flag_name is correctly propagated to the client."""

    def test_all_methods_pass_correct_flag_name(self):
        f = make_flag("target", value_type="boolean", value=True)
        proxy, mock = _make_proxy(f)

        proxy.bool_variation(False)
        assert mock.last_flag_name == "target"

        proxy.string_variation("")
        assert mock.last_flag_name == "target"

        proxy.int_variation(0)
        assert mock.last_flag_name == "target"

        _ = proxy.enabled
        assert mock.last_flag_name == "target"
