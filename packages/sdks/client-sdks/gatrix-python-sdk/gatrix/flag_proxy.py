"""FlagProxy – convenience wrapper for accessing flag values."""
from __future__ import annotations

import json
from typing import Any, Optional, TypeVar

from gatrix.errors import GatrixFeatureError
from gatrix.types import (
    DISABLED_VARIANT,
    EvaluatedFlag,
    Variant,
    VariantType,
    VariationResult,
)

T = TypeVar("T")


class FlagProxy:
    """Convenience wrapper around an EvaluatedFlag (or missing flag)."""

    def __init__(self, flag: Optional[EvaluatedFlag] = None) -> None:
        self._flag = flag

    # ---------------------------------------------------------------- props
    @property
    def exists(self) -> bool:
        return self._flag is not None

    @property
    def enabled(self) -> bool:
        return self._flag.enabled if self._flag else False

    @property
    def name(self) -> str:
        return self._flag.name if self._flag else ""

    @property
    def variant(self) -> Variant:
        if self._flag and self._flag.variant:
            return self._flag.variant
        return DISABLED_VARIANT

    @property
    def variant_type(self) -> VariantType:
        return self._flag.variant_type if self._flag else "none"

    @property
    def version(self) -> int:
        return self._flag.version if self._flag else 0

    @property
    def reason(self) -> Optional[str]:
        return self._flag.reason if self._flag else None

    @property
    def impression_data(self) -> bool:
        return bool(self._flag.impression_data) if self._flag else False

    @property
    def raw(self) -> Optional[EvaluatedFlag]:
        return self._flag

    # ----------------------------------------------------------- variations
    def variation(self, default_value: str) -> str:
        """Return variant name (or default)."""
        if not self._flag or not self._flag.enabled:
            return default_value
        v = self._flag.variant
        if v and v.enabled and v.name != "disabled":
            return v.name
        return default_value

    def bool_variation(self, default_value: bool) -> bool:
        if not self._flag:
            return default_value
        return self._flag.enabled

    def string_variation(self, default_value: str) -> str:
        if not self._flag or not self._flag.enabled:
            return default_value
        v = self._flag.variant
        if v and v.enabled and v.payload is not None:
            return str(v.payload)
        return default_value

    def number_variation(self, default_value: float) -> float:
        if not self._flag or not self._flag.enabled:
            return default_value
        v = self._flag.variant
        if v and v.enabled and v.payload is not None:
            try:
                return float(v.payload)  # type: ignore[arg-type]
            except (ValueError, TypeError):
                return default_value
        return default_value

    def json_variation(self, default_value: Any) -> Any:
        if not self._flag or not self._flag.enabled:
            return default_value
        v = self._flag.variant
        if v and v.enabled and v.payload is not None:
            if isinstance(v.payload, (dict, list)):
                return v.payload
            try:
                return json.loads(str(v.payload))
            except (json.JSONDecodeError, TypeError):
                return default_value
        return default_value

    # ------------------------------------------------- variation details
    def bool_variation_details(self, default_value: bool) -> VariationResult:
        value = self.bool_variation(default_value)
        return VariationResult(
            value=value,
            reason=self.reason or ("flag_found" if self.exists else "not_found"),
            flag_exists=self.exists,
            enabled=self.enabled,
        )

    def string_variation_details(self, default_value: str) -> VariationResult:
        value = self.string_variation(default_value)
        return VariationResult(
            value=value,
            reason=self.reason or ("flag_found" if self.exists else "not_found"),
            flag_exists=self.exists,
            enabled=self.enabled,
        )

    def number_variation_details(self, default_value: float) -> VariationResult:
        value = self.number_variation(default_value)
        return VariationResult(
            value=value,
            reason=self.reason or ("flag_found" if self.exists else "not_found"),
            flag_exists=self.exists,
            enabled=self.enabled,
        )

    def json_variation_details(self, default_value: Any) -> VariationResult:
        value = self.json_variation(default_value)
        return VariationResult(
            value=value,
            reason=self.reason or ("flag_found" if self.exists else "not_found"),
            flag_exists=self.exists,
            enabled=self.enabled,
        )

    # ------------------------------------------------- or-throw variants
    def bool_variation_or_throw(self) -> bool:
        if not self._flag:
            raise GatrixFeatureError(f"Flag not found")
        if not self._flag.enabled:
            raise GatrixFeatureError(f"Flag '{self._flag.name}' is disabled")
        return self._flag.enabled

    def string_variation_or_throw(self) -> str:
        if not self._flag:
            raise GatrixFeatureError(f"Flag not found")
        if not self._flag.enabled:
            raise GatrixFeatureError(f"Flag '{self._flag.name}' is disabled")
        v = self._flag.variant
        if not v or not v.enabled or v.payload is None:
            raise GatrixFeatureError(
                f"Flag '{self._flag.name}' has no string payload"
            )
        return str(v.payload)

    def number_variation_or_throw(self) -> float:
        if not self._flag:
            raise GatrixFeatureError(f"Flag not found")
        if not self._flag.enabled:
            raise GatrixFeatureError(f"Flag '{self._flag.name}' is disabled")
        v = self._flag.variant
        if not v or not v.enabled or v.payload is None:
            raise GatrixFeatureError(
                f"Flag '{self._flag.name}' has no number payload"
            )
        try:
            return float(v.payload)  # type: ignore[arg-type]
        except (ValueError, TypeError) as e:
            raise GatrixFeatureError(
                f"Flag '{self._flag.name}' payload is not a valid number"
            ) from e

    def json_variation_or_throw(self) -> Any:
        if not self._flag:
            raise GatrixFeatureError(f"Flag not found")
        if not self._flag.enabled:
            raise GatrixFeatureError(f"Flag '{self._flag.name}' is disabled")
        v = self._flag.variant
        if not v or not v.enabled or v.payload is None:
            raise GatrixFeatureError(
                f"Flag '{self._flag.name}' has no JSON payload"
            )
        if isinstance(v.payload, (dict, list)):
            return v.payload
        try:
            return json.loads(str(v.payload))
        except (json.JSONDecodeError, TypeError) as e:
            raise GatrixFeatureError(
                f"Flag '{self._flag.name}' payload is not valid JSON"
            ) from e
