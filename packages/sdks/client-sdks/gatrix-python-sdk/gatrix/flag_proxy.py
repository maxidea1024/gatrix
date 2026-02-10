"""FlagProxy – Single source of truth for flag value extraction.

ALL variation logic lives here. FeaturesClient delegates to FlagProxy
so that value extraction + metrics tracking happen in one place.

Uses null object pattern: _flag is never None.
MISSING_FLAG sentinel is used for non-existent flags.

on_access callback is invoked on every variation/enabled call, enabling
consistent metrics tracking regardless of how FlagProxy is obtained.

Type safety: value_type is checked strictly to prevent misuse.
"""
from __future__ import annotations

import json
from typing import Any, Callable, Optional, TypeVar

from gatrix.errors import GatrixFeatureError
from gatrix.types import (
    MISSING_VARIANT,
    EvaluatedFlag,
    Variant,
    VariationResult,
)

T = TypeVar("T")

# Callback type: (flag_name, flag_or_none, event_type, variant_name) -> None
FlagAccessCallback = Callable[
    [str, Optional[EvaluatedFlag], str, Optional[str]], None
]

# Null object for non-existent flags
MISSING_FLAG = EvaluatedFlag(
    name="",
    enabled=False,
    variant=MISSING_VARIANT,
    value_type="none",
    version=0,
)


class FlagProxy:
    """Single source of truth for flag value extraction."""

    __slots__ = ("_flag", "_exists", "_on_access", "_flag_name")

    def __init__(
        self,
        flag: Optional[EvaluatedFlag] = None,
        on_access: Optional[FlagAccessCallback] = None,
        flag_name: Optional[str] = None,
    ) -> None:
        self._exists = flag is not None
        self._flag = flag if flag is not None else MISSING_FLAG
        self._on_access = on_access
        self._flag_name = flag_name or self._flag.name

    # ---------------------------------------------------------------- props
    @property
    def exists(self) -> bool:
        return self._exists

    @property
    def enabled(self) -> bool:
        """Check if the flag is enabled. Triggers metrics."""
        if not self._exists:
            if self._on_access:
                self._on_access(self._flag_name, None, "isEnabled", None)
            return False
        if self._on_access:
            self._on_access(
                self._flag_name, self._flag, "isEnabled", self._flag.variant.name
            )
        return self._flag.enabled

    @property
    def name(self) -> str:
        return self._flag_name

    @property
    def variant(self) -> Variant:
        return self._flag.variant

    @property
    def value_type(self) -> str:
        return self._flag.value_type

    @property
    def version(self) -> int:
        return self._flag.version

    @property
    def reason(self) -> Optional[str]:
        return self._flag.reason

    @property
    def impression_data(self) -> bool:
        return bool(self._flag.impression_data) if self._flag.impression_data else False

    @property
    def raw(self) -> Optional[EvaluatedFlag]:
        return self._flag if self._exists else None

    # ----------------------------------------------------------- variations
    # Single source of truth. Type safety via value_type check.

    def variation(self, missing_value: str) -> str:
        """Return variant name (or default)."""
        if not self._exists:
            if self._on_access:
                self._on_access(self._flag_name, None, "getVariant", None)
            return missing_value
        if self._on_access:
            self._on_access(
                self._flag_name, self._flag, "getVariant", self._flag.variant.name
            )
        return self._flag.variant.name

    def bool_variation(self, missing_value: bool) -> bool:
        """Get boolean variation from variant value.
        Strict: value_type must be 'boolean'.
        Returns actual variant value, NOT flag.enabled."""
        if not self._exists:
            if self._on_access:
                self._on_access(self._flag_name, None, "getVariant", None)
            return missing_value
        if self._on_access:
            self._on_access(
                self._flag_name, self._flag, "getVariant", self._flag.variant.name
            )
        if self._flag.value_type not in ("none", "boolean"):
            return missing_value
        val = self._flag.variant.value
        if val is None:
            return missing_value
        if isinstance(val, bool):
            return val
        if isinstance(val, str):
            return val.lower() == "true"
        return bool(val)

    def string_variation(self, missing_value: str) -> str:
        """Get string variation. Strict: value_type must be 'string'."""
        if not self._exists:
            if self._on_access:
                self._on_access(self._flag_name, None, "getVariant", None)
            return missing_value
        if self._on_access:
            self._on_access(
                self._flag_name, self._flag, "getVariant", self._flag.variant.name
            )
        if self._flag.value_type not in ("none", "string"):
            return missing_value
        if self._flag.variant.value is None:
            return missing_value
        return str(self._flag.variant.value)

    def number_variation(self, missing_value: float) -> float:
        """Get number variation. Strict: value_type must be 'number'."""
        if not self._exists:
            if self._on_access:
                self._on_access(self._flag_name, None, "getVariant", None)
            return missing_value
        if self._on_access:
            self._on_access(
                self._flag_name, self._flag, "getVariant", self._flag.variant.name
            )
        if self._flag.value_type not in ("none", "number"):
            return missing_value
        if self._flag.variant.value is None:
            return missing_value
        try:
            return float(self._flag.variant.value)  # type: ignore[arg-type]
        except (ValueError, TypeError):
            return missing_value

    def json_variation(self, missing_value: Any) -> Any:
        """Get JSON variation. Strict: value_type must be 'json', value must be dict/list."""
        if not self._exists:
            if self._on_access:
                self._on_access(self._flag_name, None, "getVariant", None)
            return missing_value
        if self._on_access:
            self._on_access(
                self._flag_name, self._flag, "getVariant", self._flag.variant.name
            )
        if self._flag.value_type not in ("none", "json"):
            return missing_value
        if self._flag.variant.value is None:
            return missing_value
        if isinstance(self._flag.variant.value, (dict, list)):
            return self._flag.variant.value
        # Try to parse string as JSON
        try:
            return json.loads(str(self._flag.variant.value))
        except (json.JSONDecodeError, TypeError):
            return missing_value

    # ------------------------------------------------- variation details
    def bool_variation_details(self, missing_value: bool) -> VariationResult:
        value = self.bool_variation(missing_value)
        reason = self._flag.reason or ("evaluated" if self._exists else "flag_not_found")
        if self._exists and self._flag.value_type not in ("none", "boolean"):
            reason = f"type_mismatch:expected_boolean_got_{self._flag.value_type}"
        return VariationResult(
            value=value,
            reason=reason,
            flag_exists=self._exists,
            enabled=self._flag.enabled if self._exists else False,
        )

    def string_variation_details(self, missing_value: str) -> VariationResult:
        value = self.string_variation(missing_value)
        reason = self._flag.reason or ("evaluated" if self._exists else "flag_not_found")
        if self._exists and self._flag.value_type not in ("none", "string"):
            reason = f"type_mismatch:expected_string_got_{self._flag.value_type}"
        return VariationResult(
            value=value,
            reason=reason,
            flag_exists=self._exists,
            enabled=self._flag.enabled if self._exists else False,
        )

    def number_variation_details(self, missing_value: float) -> VariationResult:
        value = self.number_variation(missing_value)
        reason = self._flag.reason or ("evaluated" if self._exists else "flag_not_found")
        if self._exists and self._flag.value_type not in ("none", "number"):
            reason = f"type_mismatch:expected_number_got_{self._flag.value_type}"
        return VariationResult(
            value=value,
            reason=reason,
            flag_exists=self._exists,
            enabled=self._flag.enabled if self._exists else False,
        )

    def json_variation_details(self, missing_value: Any) -> VariationResult:
        value = self.json_variation(missing_value)
        reason = self._flag.reason or ("evaluated" if self._exists else "flag_not_found")
        if self._exists and self._flag.value_type not in ("none", "json"):
            reason = f"type_mismatch:expected_json_got_{self._flag.value_type}"
        return VariationResult(
            value=value,
            reason=reason,
            flag_exists=self._exists,
            enabled=self._flag.enabled if self._exists else False,
        )

    # ------------------------------------------------- or-throw variants
    def bool_variation_or_throw(self) -> bool:
        if not self._exists:
            if self._on_access:
                self._on_access(self._flag_name, None, "getVariant", None)
            raise GatrixFeatureError(f"Flag '{self._flag_name}' not found")
        if self._on_access:
            self._on_access(
                self._flag_name, self._flag, "getVariant", self._flag.variant.name
            )
        if self._flag.value_type not in ("none", "boolean"):
            raise GatrixFeatureError(
                f"Flag '{self._flag_name}' type mismatch: "
                f"expected boolean, got {self._flag.value_type}"
            )
        val = self._flag.variant.value
        if val is None:
            raise GatrixFeatureError(
                f"Flag '{self._flag_name}' has no boolean value"
            )
        if isinstance(val, bool):
            return val
        if isinstance(val, str):
            return val.lower() == "true"
        return bool(val)

    def string_variation_or_throw(self) -> str:
        if not self._exists:
            if self._on_access:
                self._on_access(self._flag_name, None, "getVariant", None)
            raise GatrixFeatureError(f"Flag '{self._flag_name}' not found")
        if self._on_access:
            self._on_access(
                self._flag_name, self._flag, "getVariant", self._flag.variant.name
            )
        if self._flag.value_type not in ("none", "string"):
            raise GatrixFeatureError(
                f"Flag '{self._flag_name}' type mismatch: "
                f"expected string, got {self._flag.value_type}"
            )
        if self._flag.variant.value is None:
            raise GatrixFeatureError(
                f"Flag '{self._flag_name}' has no string value"
            )
        return str(self._flag.variant.value)

    def number_variation_or_throw(self) -> float:
        if not self._exists:
            if self._on_access:
                self._on_access(self._flag_name, None, "getVariant", None)
            raise GatrixFeatureError(f"Flag '{self._flag_name}' not found")
        if self._on_access:
            self._on_access(
                self._flag_name, self._flag, "getVariant", self._flag.variant.name
            )
        if self._flag.value_type not in ("none", "number"):
            raise GatrixFeatureError(
                f"Flag '{self._flag_name}' type mismatch: "
                f"expected number, got {self._flag.value_type}"
            )
        if self._flag.variant.value is None:
            raise GatrixFeatureError(
                f"Flag '{self._flag_name}' has no number value"
            )
        try:
            return float(self._flag.variant.value)  # type: ignore[arg-type]
        except (ValueError, TypeError) as e:
            raise GatrixFeatureError(
                f"Flag '{self._flag_name}' value is not a valid number"
            ) from e

    def json_variation_or_throw(self) -> Any:
        if not self._exists:
            if self._on_access:
                self._on_access(self._flag_name, None, "getVariant", None)
            raise GatrixFeatureError(f"Flag '{self._flag_name}' not found")
        if self._on_access:
            self._on_access(
                self._flag_name, self._flag, "getVariant", self._flag.variant.name
            )
        if self._flag.value_type not in ("none", "json"):
            raise GatrixFeatureError(
                f"Flag '{self._flag_name}' type mismatch: "
                f"expected json, got {self._flag.value_type}"
            )
        if self._flag.variant.value is None:
            raise GatrixFeatureError(
                f"Flag '{self._flag_name}' has no JSON value"
            )
        if isinstance(self._flag.variant.value, (dict, list)):
            return self._flag.variant.value
        try:
            return json.loads(str(self._flag.variant.value))
        except (json.JSONDecodeError, TypeError) as e:
            raise GatrixFeatureError(
                f"Flag '{self._flag_name}' value is not valid JSON"
            ) from e
