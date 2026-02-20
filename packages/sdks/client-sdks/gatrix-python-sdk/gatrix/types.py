"""
Type definitions for the Gatrix Python Client SDK.
Uses dataclasses and TypedDict for full type-hint coverage.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional, Union

from gatrix.variant_source import VariantSource

# ---------------------------------------------------------------------------
# Enums / unions
# ---------------------------------------------------------------------------

ValueType = Literal["none", "string", "number", "boolean", "json"]
SdkState = Literal["initializing", "ready", "healthy", "error"]
StreamingTransport = Literal["sse", "websocket"]
StreamingConnectionState = Literal[
    "disconnected", "connecting", "connected", "reconnecting", "degraded"
]

# ---------------------------------------------------------------------------
# Core data structures
# ---------------------------------------------------------------------------


@dataclass
class Variant:
    """Variant information from server evaluation."""
    name: str = VariantSource.MISSING
    enabled: bool = False
    value: Optional[Union[str, int, float, dict, list]] = None


DISABLED_VARIANT = Variant(name="$disabled", enabled=False, value=None)


@dataclass
class EvaluatedFlag:
    """Evaluated flag from the Edge API."""
    name: str = ""
    enabled: bool = False
    variant: Variant = field(default_factory=lambda: Variant())
    value_type: ValueType = "none"
    version: int = 0
    reason: Optional[str] = None
    impression_data: Optional[bool] = None


@dataclass
class GatrixContext:
    """Evaluation context (global for client-side)."""
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    current_time: Optional[str] = None
    properties: Optional[Dict[str, Union[str, int, float, bool]]] = None


@dataclass
class VariationResult:
    """Variation result with evaluation details."""
    value: Any = None
    reason: str = ""
    flag_exists: bool = False
    enabled: bool = False


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------


@dataclass
class FetchRetryOptions:
    """Retry/backoff configuration for fetch requests."""
    non_retryable_status_codes: List[int] = field(default_factory=lambda: [401, 403])
    initial_backoff_ms: int = 1000
    max_backoff_ms: int = 60000


@dataclass
class FeaturesConfig:
    """Feature-flag specific settings."""
    refresh_interval: float = 30.0
    disable_refresh: bool = False
    explicit_sync_mode: bool = False
    bootstrap: Optional[List[EvaluatedFlag]] = None
    bootstrap_override: bool = True
    disable_metrics: bool = False
    disable_stats: bool = False
    impression_data_all: bool = False
    metrics_interval_initial: float = 2.0
    metrics_interval: float = 60.0
    fetch_retry_options: FetchRetryOptions = field(default_factory=FetchRetryOptions)
    use_post_requests: bool = False


@dataclass
class GatrixClientConfig:
    """SDK configuration."""
    # Required
    api_url: str = ""
    api_token: str = ""
    app_name: str = ""
    environment: str = ""

    # Optional – Context
    context: Optional[GatrixContext] = None

    # Optional – Advanced
    custom_headers: Optional[Dict[str, str]] = None
    offline_mode: bool = False
    enable_dev_mode: bool = False
    cache_key_prefix: str = "gatrix_cache"

    # Optional – Features
    features: FeaturesConfig = field(default_factory=FeaturesConfig)

    # Optional – Streaming
    streaming: Optional["StreamingConfig"] = None


@dataclass
class SseStreamingConfig:
    """SSE streaming configuration."""
    url: Optional[str] = None
    reconnect_base: int = 1
    reconnect_max: int = 30
    polling_jitter: int = 5


@dataclass
class WebSocketStreamingConfig:
    """WebSocket streaming configuration."""
    url: Optional[str] = None
    reconnect_base: int = 1
    reconnect_max: int = 30
    ping_interval: int = 30


@dataclass
class StreamingConfig:
    """Streaming configuration."""
    enabled: bool = False
    transport: StreamingTransport = "sse"
    sse: SseStreamingConfig = field(default_factory=SseStreamingConfig)
    ws: WebSocketStreamingConfig = field(default_factory=WebSocketStreamingConfig)


# ---------------------------------------------------------------------------
# Impression event
# ---------------------------------------------------------------------------


@dataclass
class ImpressionEvent:
    """Impression event data."""
    event_type: str = ""
    event_id: str = ""
    context: Optional[GatrixContext] = None
    enabled: bool = False
    feature_name: str = ""
    impression_data: bool = False
    variant_name: Optional[str] = None
    reason: Optional[str] = None
