"""FlagProxy – Convenience shell that delegates to VariationProvider.

Per spec: FlagProxy is a convenience shell that delegates all variation
logic to FeaturesClient (via VariationProvider interface).
No onAccess callback – metrics tracking is handled by the internal methods.

Uses null object pattern: _flag is never None.
MISSING_FLAG sentinel is used for non-existent flags.

IMPORTANT: client (VariationProvider) is ALWAYS non-null. FlagProxy is
exclusively created by FeaturesClient, which passes itself as the client.

FlagProxy does NOT expose force_realtime; it is available only through
FeaturesClient's public methods for direct flag access.
"""
from __future__ import annotations

from typing import Any, Optional, TYPE_CHECKING

from gatrix.types import (
    MISSING_VARIANT,
    EvaluatedFlag,
    Variant,
    VariationResult,
)

if TYPE_CHECKING:
    from gatrix.variation_provider import VariationProvider

# Null object for non-existent flags
MISSING_FLAG = EvaluatedFlag(
    name="",
    enabled=False,
    variant=MISSING_VARIANT,
    value_type="none",
    version=0,
)


class FlagProxy:
    """Convenience shell – delegates all variation calls to VariationProvider."""

    __slots__ = ("_flag", "_exists", "_client", "_flag_name")

    def __init__(
        self,
        flag: Optional[EvaluatedFlag],
        client: VariationProvider,
        flag_name: str,
    ) -> None:
        self._exists = flag is not None
        self._flag = flag if flag is not None else MISSING_FLAG
        self._client = client
        self._flag_name = flag_name or self._flag.name

    # ---------------------------------------------------------------- props
    @property
    def exists(self) -> bool:
        return self._exists

    @property
    def enabled(self) -> bool:
        """Check if the flag is enabled. Delegates to client for metrics."""
        return self._client.is_enabled_internal(self._flag_name)

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
    def variation(self, fallback_value: str) -> str:
        """Return variant name (or default)."""
        return self._client.variation_internal(self._flag_name, fallback_value)

    def bool_variation(self, fallback_value: bool) -> bool:
        """Get boolean variation from variant value."""
        return self._client.bool_variation_internal(self._flag_name, fallback_value)

    def string_variation(self, fallback_value: str) -> str:
        """Get string variation."""
        return self._client.string_variation_internal(self._flag_name, fallback_value)

    def int_variation(self, fallback_value: int) -> int:
        """Get integer variation. Strict: value_type must be 'number'."""
        return self._client.int_variation_internal(self._flag_name, fallback_value)

    def float_variation(self, fallback_value: float) -> float:
        """Get float variation. Strict: value_type must be 'number'."""
        return self._client.float_variation_internal(self._flag_name, fallback_value)

    def json_variation(self, fallback_value: Any) -> Any:
        """Get JSON variation."""
        return self._client.json_variation_internal(self._flag_name, fallback_value)

    # ------------------------------------------------- variation details
    def bool_variation_details(self, fallback_value: bool) -> VariationResult:
        return self._client.bool_variation_details_internal(self._flag_name, fallback_value)

    def string_variation_details(self, fallback_value: str) -> VariationResult:
        return self._client.string_variation_details_internal(self._flag_name, fallback_value)

    def int_variation_details(self, fallback_value: int) -> VariationResult:
        return self._client.int_variation_details_internal(self._flag_name, fallback_value)

    def float_variation_details(self, fallback_value: float) -> VariationResult:
        return self._client.float_variation_details_internal(self._flag_name, fallback_value)

    def json_variation_details(self, fallback_value: Any) -> VariationResult:
        return self._client.json_variation_details_internal(self._flag_name, fallback_value)

    # ------------------------------------------------- or-throw variants
    def bool_variation_or_throw(self) -> bool:
        return self._client.bool_variation_or_throw_internal(self._flag_name)

    def string_variation_or_throw(self) -> str:
        return self._client.string_variation_or_throw_internal(self._flag_name)

    def int_variation_or_throw(self) -> int:
        return self._client.int_variation_or_throw_internal(self._flag_name)

    def float_variation_or_throw(self) -> float:
        return self._client.float_variation_or_throw_internal(self._flag_name)

    def json_variation_or_throw(self) -> Any:
        return self._client.json_variation_or_throw_internal(self._flag_name)
