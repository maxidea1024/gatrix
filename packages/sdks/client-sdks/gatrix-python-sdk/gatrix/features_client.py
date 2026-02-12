"""FeaturesClient – feature flag management with polling, metrics, caching.

Implements VariationProvider protocol. All variation logic lives in
*_internal methods. Public methods + FlagProxy delegate to them.
"""
from __future__ import annotations

import json
import logging
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from gatrix.errors import GatrixFeatureError
from gatrix.events import EVENTS, EventEmitter
from gatrix.flag_proxy import FlagProxy
from gatrix.storage import InMemoryStorageProvider, StorageProvider
from gatrix.types import (
    DISABLED_VARIANT,
    MISSING_VARIANT,
    EvaluatedFlag,
    GatrixClientConfig,
    GatrixContext,
    ImpressionEvent,
    Variant,
    VariationResult,
)
from gatrix.version import SDK_NAME, SDK_VERSION

logger = logging.getLogger("gatrix")


def _flag_from_dict(d: dict) -> EvaluatedFlag:
    """Build an EvaluatedFlag from a dict (API response or storage)."""
    variant_data = d.get("variant") or {}
    variant = Variant(
        name=variant_data.get("name", "disabled"),
        enabled=variant_data.get("enabled", False),
        value=variant_data.get("value"),
    )
    return EvaluatedFlag(
        name=d.get("name", ""),
        enabled=d.get("enabled", False),
        variant=variant,
        value_type=d.get("valueType", d.get("value_type", "none")),
        version=d.get("version", 0),
        reason=d.get("reason"),
        impression_data=d.get("impressionData", d.get("impression_data")),
    )


def _flag_to_dict(f: EvaluatedFlag) -> dict:
    """Serialize an EvaluatedFlag to a dict."""
    return {
        "name": f.name,
        "enabled": f.enabled,
        "variant": {
            "name": f.variant.name,
            "enabled": f.variant.enabled,
            "value": f.variant.value,
        },
        "valueType": f.value_type,
        "version": f.version,
        "reason": f.reason,
        "impressionData": f.impression_data,
    }


def _context_to_qs(ctx: Optional[GatrixContext], app_name: str,
                   environment: str) -> str:
    """Build query-string from context for GET requests."""
    params: List[str] = []

    def add(key: str, val: Optional[str]) -> None:
        if val:
            from urllib.parse import quote
            params.append(f"{key}={quote(val)}")

    add("appName", app_name)
    add("environment", environment)
    if ctx:
        add("userId", ctx.user_id)
        add("sessionId", ctx.session_id)
        add("currentTime", ctx.current_time)
        if ctx.properties:
            for k, v in ctx.properties.items():
                add(f"properties[{k}]", str(v))
    return "&".join(params)


def _context_to_body(ctx: Optional[GatrixContext], app_name: str,
                     environment: str) -> dict:
    """Build POST body from context."""
    body: dict = {"appName": app_name, "environment": environment}
    if ctx:
        if ctx.user_id:
            body["userId"] = ctx.user_id
        if ctx.session_id:
            body["sessionId"] = ctx.session_id
        if ctx.current_time:
            body["currentTime"] = ctx.current_time
        if ctx.properties:
            body["properties"] = ctx.properties
    return body


class WatchFlagGroup:
    """Batch management for multiple flag watchers."""

    def __init__(self, features: "FeaturesClient", name: str) -> None:
        self._features = features
        self._name = name
        self._unwatchers: List[Callable[[], None]] = []

    @property
    def name(self) -> str:
        return self._name

    @property
    def size(self) -> int:
        return len(self._unwatchers)

    def watch_flag(self, flag_name: str, callback: Callable) -> "WatchFlagGroup":
        unwatch = self._features.watch_flag(flag_name, callback, name=self._name)
        self._unwatchers.append(unwatch)
        return self

    def watch_flag_with_initial_state(
        self, flag_name: str, callback: Callable
    ) -> "WatchFlagGroup":
        unwatch = self._features.watch_flag_with_initial_state(
            flag_name, callback, name=self._name
        )
        self._unwatchers.append(unwatch)
        return self

    def unwatch_all(self) -> None:
        for fn in self._unwatchers:
            fn()
        self._unwatchers.clear()

    def destroy(self) -> None:
        self.unwatch_all()
        self._features._remove_watch_group(self._name)


class FeaturesClient:
    """Manages feature flags: polling, caching, metrics, context.

    Implements VariationProvider protocol – all variation logic lives in
    *_internal methods. FlagProxy delegates to these methods.
    """

    def __init__(
        self,
        config: GatrixClientConfig,
        emitter: EventEmitter,
        storage: Optional[StorageProvider] = None,
    ) -> None:
        self._config = config
        self._emitter = emitter
        self._storage: StorageProvider = storage or InMemoryStorageProvider()

        feat = config.features
        self._api_url = config.api_url.rstrip("/")
        self._api_token = config.api_token
        self._app_name = config.app_name
        self._environment = config.environment
        self._custom_headers = config.custom_headers or {}
        self._offline_mode = config.offline_mode
        self._dev_mode = config.enable_dev_mode
        self._cache_prefix = config.cache_key_prefix
        self._use_post = feat.use_post_requests

        # Polling
        self._refresh_interval = feat.refresh_interval
        self._disable_refresh = feat.disable_refresh

        # Metrics
        self._disable_metrics = feat.disable_metrics
        self._disable_stats = feat.disable_stats
        self._metrics_interval = feat.metrics_interval
        self._metrics_interval_initial = feat.metrics_interval_initial
        self._impression_data_all = feat.impression_data_all

        # Sync mode
        self._explicit_sync_mode = feat.explicit_sync_mode
        self._bootstrap = feat.bootstrap
        self._bootstrap_override = feat.bootstrap_override

        # Retry options
        retry = feat.fetch_retry_options
        self._non_retryable = set(retry.non_retryable_status_codes)
        self._initial_backoff_ms = retry.initial_backoff_ms
        self._max_backoff_ms = retry.max_backoff_ms

        # Internal state
        self._connection_id = str(uuid.uuid4())
        self._context = config.context or GatrixContext()
        self._flags: Dict[str, EvaluatedFlag] = {}
        self._pending_flags: Optional[Dict[str, EvaluatedFlag]] = None
        self._pending_sync = False
        self._etag: Optional[str] = None
        self._sdk_state = "initializing"
        self._ready = False
        self._started = False
        self._last_error: Optional[Exception] = None
        self._consecutive_failures = 0
        self._polling_stopped = False

        # Timers
        self._poll_timer: Optional[threading.Timer] = None
        self._metrics_timer: Optional[threading.Timer] = None
        self._lock = threading.Lock()

        # Statistics
        self._start_time: Optional[datetime] = None
        self._fetch_count = 0
        self._update_count = 0
        self._not_modified_count = 0
        self._error_count = 0
        self._recovery_count = 0
        self._impression_count = 0
        self._context_change_count = 0
        self._sync_count = 0
        self._metrics_sent_count = 0
        self._metrics_error_count = 0
        self._last_fetch_time: Optional[datetime] = None
        self._last_update_time: Optional[datetime] = None
        self._last_error_time: Optional[datetime] = None
        self._last_recovery_time: Optional[datetime] = None
        self._missing_flags: Dict[str, int] = {}
        self._flag_enabled_counts: Dict[str, Dict[str, int]] = {}
        self._flag_variant_counts: Dict[str, Dict[str, int]] = {}
        self._flag_last_changed: Dict[str, datetime] = {}
        self._watch_groups: List[str] = []

        # Metrics bucket
        self._metrics_bucket: Dict[str, Any] = {}
        self._bucket_start: Optional[datetime] = None

        # Init from cache/bootstrap
        self._init()

    # ================================================================ Init
    def _init(self) -> None:
        """Load flags from storage/bootstrap."""
        cached = self._storage.get(f"{self._cache_prefix}_flags")
        if cached and isinstance(cached, list):
            for d in cached:
                flag = _flag_from_dict(d)
                self._flags[flag.name] = flag
            if self._flags:
                if self._dev_mode:
                    logger.debug(
                        "[DEV] initFromStorage(): %d cached flags loaded",
                        len(self._flags),
                    )
                self._set_ready()

        cached_etag = self._storage.get(f"{self._cache_prefix}_etag")
        if isinstance(cached_etag, str):
            self._etag = cached_etag

        # Bootstrap
        if self._bootstrap:
            if self._bootstrap_override or not self._flags:
                self._flags.clear()
                for flag in self._bootstrap:
                    self._flags[flag.name] = flag
            if self._flags:
                self._set_ready()

        if self._flags:
            self._emitter.emit(EVENTS.FLAGS_INIT)

    # ============================================================= Lifecycle
    def start(self) -> None:
        """Start polling and metrics."""
        if self._started:
            return
        self._started = True
        self._start_time = datetime.now(timezone.utc)
        self._consecutive_failures = 0
        self._polling_stopped = False

        if self._dev_mode:
            logger.debug(
                "[DEV] start() called. offlineMode=%s, refreshInterval=%s, "
                "explicitSyncMode=%s, disableRefresh=%s",
                self._offline_mode,
                self._refresh_interval,
                self._explicit_sync_mode,
                self._disable_refresh,
            )

        if not self._offline_mode:
            self.fetch_flags()
            if not self._disable_refresh:
                self._schedule_next_refresh()
            if not self._disable_metrics:
                self._start_metrics()

    def stop(self) -> None:
        """Stop polling and flush metrics."""
        if self._dev_mode:
            logger.debug("[DEV] stop() called")

        self._started = False
        self._polling_stopped = True
        self._consecutive_failures = 0
        self._cancel_poll_timer()
        self._cancel_metrics_timer()
        if not self._disable_metrics:
            self._send_metrics()

    # ============================================================= Context
    def get_context(self) -> GatrixContext:
        return self._context

    def update_context(self, context: GatrixContext) -> None:
        """Update context and re-fetch flags."""
        self._context = context
        self._context_change_count += 1
        self._etag = None  # Force full fetch
        if self._started and not self._offline_mode:
            self.fetch_flags()

    # ============================================================= Flag Access
    def _create_proxy(self, flag_name: str) -> FlagProxy:
        """Create a FlagProxy backed by this client as VariationProvider."""
        flag = self._get_flag(flag_name)
        return FlagProxy(flag, client=self, flag_name=flag_name)

    # ---------------------------------------------- Metrics tracking helpers
    def _track_flag_access(
        self,
        flag_name: str,
        flag: Optional[EvaluatedFlag],
        event_type: str,
        variant_name: Optional[str] = None,
    ) -> None:
        """Central metrics tracking for flag access."""
        if flag is None:
            self._record_missing(flag_name)
            return
        self._count_flag(flag_name, enabled=flag.enabled)
        if variant_name:
            self._count_variant(flag_name, variant_name)
        self._maybe_impression(flag, event_type)

    # ===================================================== Internal methods
    # These implement the VariationProvider protocol.
    # All flag lookup + value extraction + metrics tracking happen here.

    def _select_flags(self, force_realtime: bool = False) -> Dict[str, EvaluatedFlag]:
        """Select the appropriate flag source based on sync mode."""
        if force_realtime and self._pending_flags is not None:
            return self._pending_flags
        return self._flags

    def _lookup_flag(self, flag_name: str, force_realtime: bool = False) -> Optional[EvaluatedFlag]:
        """Look up a flag from the appropriate source."""
        flags = self._select_flags(force_realtime)
        return flags.get(flag_name)

    def is_enabled_internal(self, flag_name: str, force_realtime: bool = False) -> bool:
        flag = self._lookup_flag(flag_name, force_realtime)
        if flag is None:
            self._track_flag_access(flag_name, None, "isEnabled")
            return False
        self._track_flag_access(flag_name, flag, "isEnabled", flag.variant.name)
        return flag.enabled

    def get_variant_internal(self, flag_name: str, force_realtime: bool = False) -> Variant:
        flag = self._lookup_flag(flag_name, force_realtime)
        if flag is None:
            self._track_flag_access(flag_name, None, "getVariant")
            return MISSING_VARIANT
        self._track_flag_access(flag_name, flag, "getVariant", flag.variant.name)
        return flag.variant

    def variation_internal(self, flag_name: str, fallback_value: str, force_realtime: bool = False) -> str:
        """Return variant name."""
        flag = self._lookup_flag(flag_name, force_realtime)
        if flag is None:
            self._track_flag_access(flag_name, None, "getVariant")
            return fallback_value
        self._track_flag_access(flag_name, flag, "getVariant", flag.variant.name)
        return flag.variant.name

    def bool_variation_internal(self, flag_name: str, fallback_value: bool, force_realtime: bool = False) -> bool:
        flag = self._lookup_flag(flag_name, force_realtime)
        if flag is None:
            self._track_flag_access(flag_name, None, "getVariant")
            return fallback_value
        self._track_flag_access(flag_name, flag, "getVariant", flag.variant.name)
        if flag.value_type != "boolean":
            return fallback_value
        val = flag.variant.value
        if val is None:
            return fallback_value
        if isinstance(val, bool):
            return val
        if isinstance(val, str):
            return val.lower() == "true"
        return bool(val)

    def string_variation_internal(self, flag_name: str, fallback_value: str, force_realtime: bool = False) -> str:
        flag = self._lookup_flag(flag_name, force_realtime)
        if flag is None:
            self._track_flag_access(flag_name, None, "getVariant")
            return fallback_value
        self._track_flag_access(flag_name, flag, "getVariant", flag.variant.name)
        if flag.value_type != "string":
            return fallback_value
        if flag.variant.value is None:
            return fallback_value
        return str(flag.variant.value)

    def int_variation_internal(self, flag_name: str, fallback_value: int, force_realtime: bool = False) -> int:
        flag = self._lookup_flag(flag_name, force_realtime)
        if flag is None:
            self._track_flag_access(flag_name, None, "getVariant")
            return fallback_value
        self._track_flag_access(flag_name, flag, "getVariant", flag.variant.name)
        if flag.value_type != "number":
            return fallback_value
        if flag.variant.value is None:
            return fallback_value
        try:
            return int(flag.variant.value)  # type: ignore[arg-type]
        except (ValueError, TypeError):
            return fallback_value

    def float_variation_internal(self, flag_name: str, fallback_value: float, force_realtime: bool = False) -> float:
        flag = self._lookup_flag(flag_name, force_realtime)
        if flag is None:
            self._track_flag_access(flag_name, None, "getVariant")
            return fallback_value
        self._track_flag_access(flag_name, flag, "getVariant", flag.variant.name)
        if flag.value_type != "number":
            return fallback_value
        if flag.variant.value is None:
            return fallback_value
        try:
            return float(flag.variant.value)  # type: ignore[arg-type]
        except (ValueError, TypeError):
            return fallback_value

    def json_variation_internal(self, flag_name: str, fallback_value: Any, force_realtime: bool = False) -> Any:
        flag = self._lookup_flag(flag_name, force_realtime)
        if flag is None:
            self._track_flag_access(flag_name, None, "getVariant")
            return fallback_value
        self._track_flag_access(flag_name, flag, "getVariant", flag.variant.name)
        if flag.value_type != "json":
            return fallback_value
        if flag.variant.value is None:
            return fallback_value
        if isinstance(flag.variant.value, (dict, list)):
            return flag.variant.value
        try:
            return json.loads(str(flag.variant.value))
        except (json.JSONDecodeError, TypeError):
            return fallback_value

    # --------------------------------------------- Variation details internal
    def _make_details(
        self, flag_name: str, value: Any, expected_type: str,
        force_realtime: bool = False
    ) -> VariationResult:
        flag = self._lookup_flag(flag_name, force_realtime)
        exists = flag is not None
        reason = (flag.reason if flag else None) or (
            "evaluated" if exists else "flag_not_found"
        )
        if exists and flag.value_type != expected_type:
            reason = f"type_mismatch:expected_{expected_type}_got_{flag.value_type}"
        return VariationResult(
            value=value,
            reason=reason,
            flag_exists=exists,
            enabled=flag.enabled if exists else False,
        )

    def bool_variation_details_internal(
        self, flag_name: str, fallback_value: bool, force_realtime: bool = False
    ) -> VariationResult:
        value = self.bool_variation_internal(flag_name, fallback_value, force_realtime)
        return self._make_details(flag_name, value, "boolean", force_realtime)

    def string_variation_details_internal(
        self, flag_name: str, fallback_value: str, force_realtime: bool = False
    ) -> VariationResult:
        value = self.string_variation_internal(flag_name, fallback_value, force_realtime)
        return self._make_details(flag_name, value, "string", force_realtime)

    def int_variation_details_internal(
        self, flag_name: str, fallback_value: int, force_realtime: bool = False
    ) -> VariationResult:
        value = self.int_variation_internal(flag_name, fallback_value, force_realtime)
        return self._make_details(flag_name, value, "number", force_realtime)

    def float_variation_details_internal(
        self, flag_name: str, fallback_value: float, force_realtime: bool = False
    ) -> VariationResult:
        value = self.float_variation_internal(flag_name, fallback_value, force_realtime)
        return self._make_details(flag_name, value, "number", force_realtime)

    def json_variation_details_internal(
        self, flag_name: str, fallback_value: Any, force_realtime: bool = False
    ) -> VariationResult:
        value = self.json_variation_internal(flag_name, fallback_value, force_realtime)
        return self._make_details(flag_name, value, "json", force_realtime)

    # ------------------------------------------------ Or-throw internal
    def bool_variation_or_throw_internal(self, flag_name: str, force_realtime: bool = False) -> bool:
        flag = self._lookup_flag(flag_name, force_realtime)
        if flag is None:
            self._track_flag_access(flag_name, None, "getVariant")
            raise GatrixFeatureError(f"Flag '{flag_name}' not found")
        self._track_flag_access(flag_name, flag, "getVariant", flag.variant.name)
        if flag.value_type != "boolean":
            raise GatrixFeatureError(
                f"Flag '{flag_name}' type mismatch: "
                f"expected boolean, got {flag.value_type}"
            )
        val = flag.variant.value
        if val is None:
            raise GatrixFeatureError(f"Flag '{flag_name}' has no boolean value")
        if isinstance(val, bool):
            return val
        if isinstance(val, str):
            return val.lower() == "true"
        return bool(val)

    def string_variation_or_throw_internal(self, flag_name: str, force_realtime: bool = False) -> str:
        flag = self._lookup_flag(flag_name, force_realtime)
        if flag is None:
            self._track_flag_access(flag_name, None, "getVariant")
            raise GatrixFeatureError(f"Flag '{flag_name}' not found")
        self._track_flag_access(flag_name, flag, "getVariant", flag.variant.name)
        if flag.value_type != "string":
            raise GatrixFeatureError(
                f"Flag '{flag_name}' type mismatch: "
                f"expected string, got {flag.value_type}"
            )
        if flag.variant.value is None:
            raise GatrixFeatureError(f"Flag '{flag_name}' has no string value")
        return str(flag.variant.value)

    def int_variation_or_throw_internal(self, flag_name: str, force_realtime: bool = False) -> int:
        flag = self._lookup_flag(flag_name, force_realtime)
        if flag is None:
            self._track_flag_access(flag_name, None, "getVariant")
            raise GatrixFeatureError(f"Flag '{flag_name}' not found")
        self._track_flag_access(flag_name, flag, "getVariant", flag.variant.name)
        if flag.value_type != "number":
            raise GatrixFeatureError(
                f"Flag '{flag_name}' type mismatch: "
                f"expected number, got {flag.value_type}"
            )
        if flag.variant.value is None:
            raise GatrixFeatureError(f"Flag '{flag_name}' has no number value")
        try:
            return int(flag.variant.value)  # type: ignore[arg-type]
        except (ValueError, TypeError) as e:
            raise GatrixFeatureError(
                f"Flag '{flag_name}' value is not a valid integer"
            ) from e

    def float_variation_or_throw_internal(self, flag_name: str, force_realtime: bool = False) -> float:
        flag = self._lookup_flag(flag_name, force_realtime)
        if flag is None:
            self._track_flag_access(flag_name, None, "getVariant")
            raise GatrixFeatureError(f"Flag '{flag_name}' not found")
        self._track_flag_access(flag_name, flag, "getVariant", flag.variant.name)
        if flag.value_type != "number":
            raise GatrixFeatureError(
                f"Flag '{flag_name}' type mismatch: "
                f"expected number, got {flag.value_type}"
            )
        if flag.variant.value is None:
            raise GatrixFeatureError(f"Flag '{flag_name}' has no number value")
        try:
            return float(flag.variant.value)  # type: ignore[arg-type]
        except (ValueError, TypeError) as e:
            raise GatrixFeatureError(
                f"Flag '{flag_name}' value is not a valid number"
            ) from e

    def json_variation_or_throw_internal(self, flag_name: str, force_realtime: bool = False) -> Any:
        flag = self._lookup_flag(flag_name, force_realtime)
        if flag is None:
            self._track_flag_access(flag_name, None, "getVariant")
            raise GatrixFeatureError(f"Flag '{flag_name}' not found")
        self._track_flag_access(flag_name, flag, "getVariant", flag.variant.name)
        if flag.value_type != "json":
            raise GatrixFeatureError(
                f"Flag '{flag_name}' type mismatch: "
                f"expected json, got {flag.value_type}"
            )
        if flag.variant.value is None:
            raise GatrixFeatureError(f"Flag '{flag_name}' has no JSON value")
        if isinstance(flag.variant.value, (dict, list)):
            return flag.variant.value
        try:
            return json.loads(str(flag.variant.value))
        except (json.JSONDecodeError, TypeError) as e:
            raise GatrixFeatureError(
                f"Flag '{flag_name}' value is not valid JSON"
            ) from e

    # ============================================= Public methods (delegate)

    def is_enabled(self, flag_name: str, force_realtime: bool = False) -> bool:
        return self.is_enabled_internal(flag_name, force_realtime)

    def get_variant(self, flag_name: str, force_realtime: bool = False) -> Variant:
        """Never returns None – returns MISSING_VARIANT for missing flags."""
        return self.get_variant_internal(flag_name, force_realtime)

    def get_all_flags(self) -> List[EvaluatedFlag]:
        return list(self._flags.values())

    def has_flag(self, flag_name: str) -> bool:
        return flag_name in self._flags

    # ----------------------------------------------------------- variations
    def variation(self, flag_name: str, fallback_value: str, force_realtime: bool = False) -> str:
        return self.variation_internal(flag_name, fallback_value, force_realtime)

    def bool_variation(self, flag_name: str, fallback_value: bool, force_realtime: bool = False) -> bool:
        return self.bool_variation_internal(flag_name, fallback_value, force_realtime)

    def string_variation(self, flag_name: str, fallback_value: str, force_realtime: bool = False) -> str:
        return self.string_variation_internal(flag_name, fallback_value, force_realtime)

    def int_variation(self, flag_name: str, fallback_value: int, force_realtime: bool = False) -> int:
        return self.int_variation_internal(flag_name, fallback_value, force_realtime)

    def float_variation(self, flag_name: str, fallback_value: float, force_realtime: bool = False) -> float:
        return self.float_variation_internal(flag_name, fallback_value, force_realtime)

    def json_variation(self, flag_name: str, fallback_value: Any, force_realtime: bool = False) -> Any:
        return self.json_variation_internal(flag_name, fallback_value, force_realtime)

    # ------------------------------------------------- variation details
    def bool_variation_details(
        self, flag_name: str, fallback_value: bool, force_realtime: bool = False
    ) -> VariationResult:
        return self.bool_variation_details_internal(flag_name, fallback_value, force_realtime)

    def string_variation_details(
        self, flag_name: str, fallback_value: str, force_realtime: bool = False
    ) -> VariationResult:
        return self.string_variation_details_internal(flag_name, fallback_value, force_realtime)

    def int_variation_details(
        self, flag_name: str, fallback_value: int, force_realtime: bool = False
    ) -> VariationResult:
        return self.int_variation_details_internal(flag_name, fallback_value, force_realtime)

    def float_variation_details(
        self, flag_name: str, fallback_value: float, force_realtime: bool = False
    ) -> VariationResult:
        return self.float_variation_details_internal(flag_name, fallback_value, force_realtime)

    def json_variation_details(
        self, flag_name: str, fallback_value: Any, force_realtime: bool = False
    ) -> VariationResult:
        return self.json_variation_details_internal(flag_name, fallback_value, force_realtime)

    # ------------------------------------------------- or-throw variants
    def bool_variation_or_throw(self, flag_name: str, force_realtime: bool = False) -> bool:
        return self.bool_variation_or_throw_internal(flag_name, force_realtime)

    def string_variation_or_throw(self, flag_name: str, force_realtime: bool = False) -> str:
        return self.string_variation_or_throw_internal(flag_name, force_realtime)

    def int_variation_or_throw(self, flag_name: str, force_realtime: bool = False) -> int:
        return self.int_variation_or_throw_internal(flag_name, force_realtime)

    def float_variation_or_throw(self, flag_name: str, force_realtime: bool = False) -> float:
        return self.float_variation_or_throw_internal(flag_name, force_realtime)

    def json_variation_or_throw(self, flag_name: str, force_realtime: bool = False) -> Any:
        return self.json_variation_or_throw_internal(flag_name, force_realtime)

    # ============================================================ Sync mode
    def is_explicit_sync_enabled(self) -> bool:
        return self._explicit_sync_mode

    def has_pending_sync_flags(self) -> bool:
        return self._pending_sync

    def can_sync_flags(self) -> bool:
        return self._pending_sync

    def set_explicit_sync_mode(self, enabled: bool) -> None:
        """Dynamically enable/disable explicit sync mode at runtime."""
        if self._explicit_sync_mode == enabled:
            return
        self._explicit_sync_mode = enabled
        self._pending_sync = False
        if not enabled and self._pending_flags is not None:
            self._apply_flags(self._pending_flags)
            self._pending_flags = None

    def sync_flags(self, fetch_now: bool = False) -> None:
        """Apply pending flag changes (explicit sync mode)."""
        if not self._explicit_sync_mode:
            return
        if fetch_now and not self._offline_mode:
            self.fetch_flags()
        if self._pending_flags is not None:
            self._apply_flags(self._pending_flags)
            self._pending_flags = None
            self._pending_sync = False
            self._sync_count += 1
            self._emitter.emit(EVENTS.FLAGS_SYNC)
            self._emitter.emit(EVENTS.FLAGS_CHANGE)

    # ============================================================ Watch
    def watch_flag(
        self, flag_name: str, callback: Callable, name: Optional[str] = None
    ) -> Callable[[], None]:
        """Watch for changes to a specific flag. Returns unwatch function."""
        event = f"flags.{flag_name}.change"
        self._emitter.on(event, callback, name=name)

        def unwatch() -> None:
            self._emitter.off(event, callback)

        return unwatch

    def watch_flag_with_initial_state(
        self, flag_name: str, callback: Callable, name: Optional[str] = None
    ) -> Callable[[], None]:
        """Watch flag and fire callback immediately with current state."""
        flag = self._flags.get(flag_name)
        proxy = FlagProxy(flag, client=self, flag_name=flag_name)
        callback(proxy)
        return self.watch_flag(flag_name, callback, name=name)

    def create_watch_flag_group(self, name: str) -> WatchFlagGroup:
        self._watch_groups.append(name)
        return WatchFlagGroup(self, name)

    def _remove_watch_group(self, name: str) -> None:
        try:
            self._watch_groups.remove(name)
        except ValueError:
            pass

    # ============================================================ Stats
    def get_stats(self) -> dict:
        """Return comprehensive SDK statistics."""
        return {
            "sdk_state": self._sdk_state,
            "start_time": self._start_time,
            "connection_id": self._connection_id,
            "error_count": self._error_count,
            "last_error": self._last_error,
            "last_error_time": self._last_error_time,
            "offline_mode": self._offline_mode,
            "features": {
                "total_flag_count": len(self._flags),
                "missing_flags": dict(self._missing_flags),
                "fetch_flags_count": self._fetch_count,
                "update_count": self._update_count,
                "not_modified_count": self._not_modified_count,
                "recovery_count": self._recovery_count,
                "error_count": self._error_count,
                "sdk_state": self._sdk_state,
                "last_error": self._last_error,
                "start_time": self._start_time,
                "last_fetch_time": self._last_fetch_time,
                "last_update_time": self._last_update_time,
                "last_recovery_time": self._last_recovery_time,
                "last_error_time": self._last_error_time,
                "flag_enabled_counts": dict(self._flag_enabled_counts),
                "flag_variant_counts": dict(self._flag_variant_counts),
                "sync_flags_count": self._sync_count,
                "active_watch_groups": list(self._watch_groups),
                "etag": self._etag,
                "impression_count": self._impression_count,
                "context_change_count": self._context_change_count,
                "flag_last_changed_times": dict(self._flag_last_changed),
                "metrics_sent_count": self._metrics_sent_count,
                "metrics_error_count": self._metrics_error_count,
            },
            "event_handler_stats": self._emitter.get_handler_stats(),
        }

    # ============================================================ Fetch
    def fetch_flags(self) -> None:
        """Fetch flags from server."""
        if self._offline_mode:
            return

        self._polling_stopped = False
        self._cancel_poll_timer()
        self._fetch_count += 1
        self._last_fetch_time = datetime.now(timezone.utc)

        if self._dev_mode:
            logger.debug("[DEV] fetchFlags() etag=%s", self._etag)

        self._emitter.emit(EVENTS.FLAGS_FETCH, {"etag": self._etag})
        self._emitter.emit(EVENTS.FLAGS_FETCH_START, {"etag": self._etag})

        try:
            req = self._build_fetch_request()
            with urlopen(req, timeout=30) as resp:
                status = resp.status
                if status == 304:
                    self._not_modified_count += 1
                    self._consecutive_failures = 0
                    self._emitter.emit(EVENTS.FLAGS_FETCH_SUCCESS)
                    self._emitter.emit(EVENTS.FLAGS_FETCH_END)
                    return

                data = json.loads(resp.read().decode("utf-8"))
                new_etag = resp.headers.get("ETag")
                if new_etag:
                    self._etag = new_etag
                    self._storage.save(f"{self._cache_prefix}_etag", new_etag)

            # Parse flags
            flags_data = data.get("data", {}).get("flags", [])
            new_flags: Dict[str, EvaluatedFlag] = {}
            for fd in flags_data:
                flag = _flag_from_dict(fd)
                new_flags[flag.name] = flag

            # Recovery
            if self._sdk_state == "error":
                self._sdk_state = "healthy"
                self._recovery_count += 1
                self._last_recovery_time = datetime.now(timezone.utc)
                self._emitter.emit(EVENTS.FLAGS_RECOVERED)

            self._consecutive_failures = 0

            if self._explicit_sync_mode:
                self._pending_flags = new_flags
                if not self._pending_sync:
                    self._pending_sync = True
                    self._emitter.emit(EVENTS.FLAGS_PENDING_SYNC)
            else:
                self._pending_sync = False
                self._apply_flags(new_flags)

            self._update_count += 1
            self._last_update_time = datetime.now(timezone.utc)

            # Cache
            self._storage.save(
                f"{self._cache_prefix}_flags",
                [_flag_to_dict(f) for f in new_flags.values()],
            )

            self._set_ready()
            self._emitter.emit(EVENTS.FLAGS_FETCH_SUCCESS)

        except HTTPError as e:
            self._handle_fetch_error(e.code, e)
        except URLError as e:
            self._handle_fetch_error(None, e)
        except Exception as e:
            self._handle_fetch_error(None, e)
        finally:
            self._emitter.emit(EVENTS.FLAGS_FETCH_END)

    def _build_fetch_request(self) -> Request:
        """Build the HTTP request for fetching flags."""
        headers = self._common_headers()
        headers["X-Environment"] = self._environment
        if self._etag:
            headers["If-None-Match"] = self._etag

        if self._use_post:
            body = _context_to_body(self._context, self._app_name, self._environment)
            headers["Content-Type"] = "application/json"
            url = f"{self._api_url}/client/features"
            data = json.dumps(body).encode("utf-8")
            return Request(url, data=data, headers=headers, method="POST")
        else:
            qs = _context_to_qs(self._context, self._app_name, self._environment)
            url = f"{self._api_url}/client/features?{qs}"
            return Request(url, headers=headers, method="GET")

    def _handle_fetch_error(
        self, status: Optional[int], error: Exception
    ) -> None:
        self._error_count += 1
        self._last_error = error
        self._last_error_time = datetime.now(timezone.utc)
        self._sdk_state = "error"

        self._emitter.emit(
            EVENTS.FLAGS_FETCH_ERROR, {"status": status, "error": error}
        )
        self._emitter.emit(
            EVENTS.SDK_ERROR, {"type": "fetch_error", "error": error}
        )

        # Non-retryable -> stop polling
        if status is not None and status in self._non_retryable:
            self._polling_stopped = True
            return

        self._consecutive_failures += 1

    # ============================================================ Apply flags
    def _apply_flags(self, new_flags: Dict[str, EvaluatedFlag]) -> None:
        """Diff and apply new flags, emitting change/removed events."""
        old_flags = self._flags
        now = datetime.now(timezone.utc)

        # Detect changes
        changed: List[EvaluatedFlag] = []
        for name, new_flag in new_flags.items():
            old_flag = old_flags.get(name)
            if old_flag is None:
                # New flag
                changed.append(new_flag)
                self._flag_last_changed[name] = now
                proxy = FlagProxy(new_flag, client=self, flag_name=name)
                self._emitter.emit(
                    f"flags.{name}.change", proxy, None, "created"
                )
            elif self._flag_changed(old_flag, new_flag):
                changed.append(new_flag)
                self._flag_last_changed[name] = now
                proxy = FlagProxy(new_flag, client=self, flag_name=name)
                old_proxy = FlagProxy(old_flag, client=self, flag_name=name)
                self._emitter.emit(
                    f"flags.{name}.change", proxy, old_proxy, "updated"
                )

        # Detect removed
        removed = [n for n in old_flags if n not in new_flags]
        if removed:
            self._emitter.emit(EVENTS.FLAGS_REMOVED, removed)

        self._flags = new_flags

        if changed:
            self._emitter.emit(
                EVENTS.FLAGS_CHANGE, {"flags": changed}
            )

        if self._dev_mode:
            logger.debug(
                "[DEV] setFlags(): %d flags loaded, syncMode=%s",
                len(new_flags),
                self._explicit_sync_mode,
            )

    @staticmethod
    def _flag_changed(old: EvaluatedFlag, new: EvaluatedFlag) -> bool:
        if old.enabled != new.enabled:
            return True
        if old.version != new.version:
            return True
        if old.variant.name != new.variant.name:
            return True
        if old.variant.enabled != new.variant.enabled:
            return True
        if old.variant.value != new.variant.value:
            return True
        return False

    # ============================================================ Polling
    def _schedule_next_refresh(self) -> None:
        if self._polling_stopped or not self._started:
            return
        if self._disable_refresh:
            return

        if self._consecutive_failures > 0:
            delay_ms = min(
                self._initial_backoff_ms * (2 ** (self._consecutive_failures - 1)),
                self._max_backoff_ms,
            )
            delay = delay_ms / 1000.0
        else:
            delay = self._refresh_interval

        if self._dev_mode:
            logger.debug(
                "[DEV] scheduleNextRefresh() delay=%.1fs failures=%d stopped=%s",
                delay,
                self._consecutive_failures,
                self._polling_stopped,
            )

        self._cancel_poll_timer()
        self._poll_timer = threading.Timer(delay, self._poll_tick)
        self._poll_timer.daemon = True
        self._poll_timer.start()

    def _poll_tick(self) -> None:
        if not self._started or self._polling_stopped:
            return
        self.fetch_flags()
        self._schedule_next_refresh()

    def _cancel_poll_timer(self) -> None:
        if self._poll_timer:
            self._poll_timer.cancel()
            self._poll_timer = None

    # ============================================================ Metrics
    def _start_metrics(self) -> None:
        self._reset_bucket()
        delay = self._metrics_interval_initial
        self._metrics_timer = threading.Timer(delay, self._metrics_tick)
        self._metrics_timer.daemon = True
        self._metrics_timer.start()

    def _metrics_tick(self) -> None:
        if not self._started:
            return
        self._send_metrics()
        self._cancel_metrics_timer()
        self._metrics_timer = threading.Timer(
            self._metrics_interval, self._metrics_tick
        )
        self._metrics_timer.daemon = True
        self._metrics_timer.start()

    def _cancel_metrics_timer(self) -> None:
        if self._metrics_timer:
            self._metrics_timer.cancel()
            self._metrics_timer = None

    def _reset_bucket(self) -> None:
        self._metrics_bucket = {}
        self._bucket_start = datetime.now(timezone.utc)

    def _send_metrics(self) -> None:
        if self._disable_metrics:
            return
        bucket = self._metrics_bucket
        if not bucket and not self._missing_flags:
            self._reset_bucket()
            return

        body = {
            "appName": self._app_name,
            "environment": self._environment,
            "sdkName": SDK_NAME,
            "sdkVersion": SDK_VERSION,
            "connectionId": self._connection_id,
            "bucket": {
                "start": (
                    self._bucket_start.isoformat()
                    if self._bucket_start
                    else datetime.now(timezone.utc).isoformat()
                ),
                "stop": datetime.now(timezone.utc).isoformat(),
                "flags": bucket,
                "missing": dict(self._missing_flags),
            },
        }

        self._reset_bucket()
        self._missing_flags.clear()

        url = f"{self._api_url}/client/metrics"
        headers = self._common_headers()
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")

        max_retries = 2
        for attempt in range(max_retries + 1):
            try:
                req = Request(url, data=data, headers=headers, method="POST")
                with urlopen(req, timeout=30) as resp:
                    if 200 <= resp.status < 300:
                        self._metrics_sent_count += 1
                        self._emitter.emit(
                            EVENTS.FLAGS_METRICS_SENT,
                            {"count": len(bucket)},
                        )
                        return
            except HTTPError as e:
                code = e.code
                # Non-retryable 4xx (except 408, 429)
                if 400 <= code < 500 and code not in (408, 429):
                    break
                if attempt < max_retries:
                    import time
                    time.sleep(2 ** (attempt + 1))
                    continue
            except Exception:
                if attempt < max_retries:
                    import time
                    time.sleep(2 ** (attempt + 1))
                    continue

        # Final failure
        self._metrics_error_count += 1
        self._emitter.emit(EVENTS.FLAGS_METRICS_ERROR)

    # ============================================================ Helpers
    def _common_headers(self) -> Dict[str, str]:
        headers: Dict[str, str] = {
            "X-API-Token": self._api_token,
            "X-Application-Name": self._app_name,
            "X-Connection-Id": self._connection_id,
            "X-SDK-Version": f"{SDK_NAME}/{SDK_VERSION}",
        }
        if self._custom_headers:
            headers.update(self._custom_headers)
        return headers

    def _set_ready(self) -> None:
        if not self._ready:
            self._ready = True
            if self._sdk_state == "initializing":
                self._sdk_state = "ready"
            if self._dev_mode:
                logger.debug(
                    "[DEV] setReady() totalFlags=%d", len(self._flags)
                )
            self._emitter.emit(EVENTS.FLAGS_READY)
        elif self._sdk_state == "ready":
            self._sdk_state = "healthy"

    def _get_flag(self, flag_name: str) -> Optional[EvaluatedFlag]:
        return self._flags.get(flag_name)

    def _record_missing(self, flag_name: str) -> None:
        if not self._disable_stats:
            self._missing_flags[flag_name] = (
                self._missing_flags.get(flag_name, 0) + 1
            )

    def _count_flag(self, flag_name: str, enabled: bool) -> None:
        if self._disable_stats:
            return
        # Enabled counts
        if flag_name not in self._flag_enabled_counts:
            self._flag_enabled_counts[flag_name] = {"yes": 0, "no": 0}
        key = "yes" if enabled else "no"
        self._flag_enabled_counts[flag_name][key] += 1

        # Metrics bucket
        if flag_name not in self._metrics_bucket:
            self._metrics_bucket[flag_name] = {"yes": 0, "no": 0, "variants": {}}
        self._metrics_bucket[flag_name][key] += 1

    def _count_variant(self, flag_name: str, variant_name: str) -> None:
        if self._disable_stats:
            return
        if flag_name not in self._flag_variant_counts:
            self._flag_variant_counts[flag_name] = {}
        self._flag_variant_counts[flag_name][variant_name] = (
            self._flag_variant_counts[flag_name].get(variant_name, 0) + 1
        )
        # Metrics bucket
        if flag_name in self._metrics_bucket:
            variants = self._metrics_bucket[flag_name].setdefault("variants", {})
            variants[variant_name] = variants.get(variant_name, 0) + 1

    def _maybe_impression(self, flag: EvaluatedFlag, event_type: str) -> None:
        should_track = self._impression_data_all or flag.impression_data
        if not should_track:
            return
        self._impression_count += 1

        # Track variant
        if flag.variant and flag.variant.enabled and flag.variant.name != "disabled":
            self._count_variant(flag.name, flag.variant.name)

        event = ImpressionEvent(
            event_type=event_type,
            event_id=str(uuid.uuid4()),
            context=self._context,
            enabled=flag.enabled,
            feature_name=flag.name,
            impression_data=True,
            variant_name=(
                flag.variant.name if flag.variant and flag.variant.enabled else None
            ),
            reason=flag.reason,
        )
        self._emitter.emit(EVENTS.FLAGS_IMPRESSION, event)
