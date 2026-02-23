"""FlagProxy - Thin shell that delegates ALL logic to VariationProvider.

Architecture per CLIENT_SDK_SPEC:
- Holds only flag_name + force_realtime + client reference.
- ALL property reads and variation methods delegate to the client.
- No deep copy of flag data - always reads live state from FeaturesClient cache.
- is_realtime property indicates the proxy's operational mode.
- Client is always present (never None).
"""
from __future__ import annotations

from typing import Any, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from gatrix.variation_provider import VariationProvider


class FlagProxy:
    """Thin shell around a feature flag that delegates all reads to the VariationProvider."""

    __slots__ = ('_client', '_flag_name', '_force_realtime')

    def __init__(
        self,
        client: VariationProvider,
        flag_name: str,
        force_realtime: bool = False,
    ) -> None:
        self._client = client
        self._flag_name = flag_name or ''
        self._force_realtime = force_realtime

    # ==================== Properties ====================

    @property
    def name(self) -> str:
        return self._flag_name

    @property
    def is_realtime(self) -> bool:
        """Whether this proxy was created in realtime mode."""
        return self._force_realtime

    @property
    def exists(self) -> bool:
        """Whether the flag exists in the current cache."""
        return self._client.has_flag_internal(self._flag_name, self._force_realtime)

    @property
    def enabled(self) -> bool:
        """Check if flag is enabled. Delegates to client for metrics tracking."""
        return self._client.is_enabled_internal(self._flag_name, self._force_realtime)

    @property
    def variant(self):
        return self._client.get_variant_internal(self._flag_name, self._force_realtime)

    @property
    def value_type(self) -> str:
        return self._client.get_value_type_internal(self._flag_name, self._force_realtime)

    @property
    def version(self) -> int:
        return self._client.get_version_internal(self._flag_name, self._force_realtime)

    @property
    def impression_data(self) -> bool:
        return self._client.get_impression_data_internal(self._flag_name, self._force_realtime)

    @property
    def raw(self):
        return self._client.get_raw_flag_internal(self._flag_name, self._force_realtime)

    @property
    def reason(self) -> Optional[str]:
        return self._client.get_reason_internal(self._flag_name, self._force_realtime)

    # ==================== Variation Methods ====================
    # All methods delegate to client's internal methods.
    # FlagProxy is a convenience shell - no own logic.

    def variation(self, fallback_value: str) -> str:
        return self._client.variation_internal(self._flag_name, fallback_value, self._force_realtime)

    def bool_variation(self, fallback_value: bool) -> bool:
        return self._client.bool_variation_internal(self._flag_name, fallback_value, self._force_realtime)

    def string_variation(self, fallback_value: str) -> str:
        return self._client.string_variation_internal(self._flag_name, fallback_value, self._force_realtime)

    def int_variation(self, fallback_value: int) -> int:
        return self._client.int_variation_internal(self._flag_name, fallback_value, self._force_realtime)

    def float_variation(self, fallback_value: float) -> float:
        return self._client.float_variation_internal(self._flag_name, fallback_value, self._force_realtime)

    def json_variation(self, fallback_value: Any) -> Any:
        return self._client.json_variation_internal(self._flag_name, fallback_value, self._force_realtime)

    # ==================== Variation Details ====================

    def bool_variation_details(self, fallback_value: bool):
        return self._client.bool_variation_details_internal(self._flag_name, fallback_value, self._force_realtime)

    def string_variation_details(self, fallback_value: str):
        return self._client.string_variation_details_internal(self._flag_name, fallback_value, self._force_realtime)

    def int_variation_details(self, fallback_value: int):
        return self._client.int_variation_details_internal(self._flag_name, fallback_value, self._force_realtime)

    def float_variation_details(self, fallback_value: float):
        return self._client.float_variation_details_internal(self._flag_name, fallback_value, self._force_realtime)

    def json_variation_details(self, fallback_value: Any):
        return self._client.json_variation_details_internal(self._flag_name, fallback_value, self._force_realtime)

    # ==================== Strict Variation Methods (OrThrow) ====================

    def bool_variation_or_throw(self) -> bool:
        return self._client.bool_variation_or_throw_internal(self._flag_name, self._force_realtime)

    def string_variation_or_throw(self) -> str:
        return self._client.string_variation_or_throw_internal(self._flag_name, self._force_realtime)

    def int_variation_or_throw(self) -> int:
        return self._client.int_variation_or_throw_internal(self._flag_name, self._force_realtime)

    def float_variation_or_throw(self) -> float:
        return self._client.float_variation_or_throw_internal(self._flag_name, self._force_realtime)

    def json_variation_or_throw(self) -> Any:
        return self._client.json_variation_or_throw_internal(self._flag_name, self._force_realtime)
