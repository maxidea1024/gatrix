"""Config validation – runs before any network calls."""
from __future__ import annotations

from urllib.parse import urlparse

from gatrix.errors import GatrixConfigError
from gatrix.types import GatrixClientConfig


def validate_config(config: GatrixClientConfig) -> None:
    """Validate SDK configuration. Raises GatrixConfigError on invalid config."""
    # Required string fields
    _require_non_empty(config.api_url, "apiUrl")
    _require_non_empty(config.api_token, "apiToken")
    _require_non_empty(config.app_name, "appName")
    _require_non_empty(config.environment, "environment")

    # URL format
    _validate_url(config.api_url)

    # No leading/trailing whitespace
    _no_whitespace(config.api_url, "apiUrl")
    _no_whitespace(config.api_token, "apiToken")

    # cacheKeyPrefix length
    if len(config.cache_key_prefix) > 100:
        raise GatrixConfigError("cacheKeyPrefix must be <= 100 characters")

    # customHeaders
    if config.custom_headers is not None:
        if not isinstance(config.custom_headers, dict):
            raise GatrixConfigError("customHeaders must be a dict")
        for key, value in config.custom_headers.items():
            if not isinstance(value, str):
                raise GatrixConfigError(
                    f'customHeaders["{key}"] must be a string, got {type(value).__name__}'
                )

    # Features config
    feat = config.features
    _validate_range(feat.refresh_interval, "refreshInterval", 1, 86400)
    _validate_range(feat.metrics_interval, "metricsInterval", 1, 86400)
    _validate_range(feat.metrics_interval_initial, "metricsIntervalInitial", 0, 3600)

    # Fetch retry options
    retry = feat.fetch_retry_options
    _validate_range(retry.initial_backoff_ms, "initialBackoffMs", 100, 60000)
    _validate_range(retry.max_backoff_ms, "maxBackoffMs", 1000, 600000)

    if retry.initial_backoff_ms > retry.max_backoff_ms:
        raise GatrixConfigError(
            f"initialBackoffMs ({retry.initial_backoff_ms}) must be <= "
            f"maxBackoffMs ({retry.max_backoff_ms})"
        )

    for code in retry.non_retryable_status_codes:
        if not isinstance(code, int) or code < 400 or code > 599:
            raise GatrixConfigError(
                f"nonRetryableStatusCodes contains invalid status code: {code} "
                f"(must be 400-599)"
            )


# ==================== Helpers ====================

def _require_non_empty(value: str, field_name: str) -> None:
    if not value or not value.strip():
        raise GatrixConfigError(f"{field_name} is required")


def _no_whitespace(value: str, field_name: str) -> None:
    if value != value.strip():
        raise GatrixConfigError(
            f"{field_name} must not have leading or trailing whitespace"
        )


def _validate_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise GatrixConfigError(
            f'Invalid apiUrl: "{url}". Must be a valid HTTP/HTTPS URL '
            f"(e.g., https://api.example.com/api/v1)"
        )


def _validate_range(
    value: float, field_name: str, min_val: float, max_val: float
) -> None:
    if not isinstance(value, (int, float)):
        raise GatrixConfigError(
            f"{field_name} must be a number, got {type(value).__name__}"
        )
    if value < min_val or value > max_val:
        raise GatrixConfigError(
            f"{field_name} must be between {min_val} and {max_val}, got {value}"
        )
