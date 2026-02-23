"""Tests for config validation."""
import pytest

from gatrix.errors import GatrixConfigError
from gatrix.types import FeaturesConfig, FetchRetryOptions, GatrixClientConfig
from gatrix.validate_config import validate_config


def _valid_config(**overrides) -> GatrixClientConfig:
    defaults = dict(
        api_url="https://api.example.com/api/v1",
        api_token="test-token",
        app_name="test-app",
        environment="development",
    )
    defaults.update(overrides)
    return GatrixClientConfig(**defaults)


class TestRequiredFields:
    def test_missing_api_url(self):
        with pytest.raises(GatrixConfigError, match="apiUrl is required"):
            validate_config(_valid_config(api_url=""))

    def test_missing_api_token(self):
        with pytest.raises(GatrixConfigError, match="apiToken is required"):
            validate_config(_valid_config(api_token=""))

    def test_missing_app_name(self):
        with pytest.raises(GatrixConfigError, match="appName is required"):
            validate_config(_valid_config(app_name=""))

    def test_missing_environment(self):
        with pytest.raises(GatrixConfigError, match="environment is required"):
            validate_config(_valid_config(environment=""))

    def test_whitespace_only_is_empty(self):
        with pytest.raises(GatrixConfigError, match="apiUrl is required"):
            validate_config(_valid_config(api_url="   "))

    def test_valid_config_passes(self):
        validate_config(_valid_config())  # Should not raise


class TestUrlFormat:
    def test_invalid_url(self):
        with pytest.raises(GatrixConfigError, match="Invalid apiUrl"):
            validate_config(_valid_config(api_url="not-a-url"))

    def test_ftp_url_rejected(self):
        with pytest.raises(GatrixConfigError, match="Invalid apiUrl"):
            validate_config(_valid_config(api_url="ftp://server.com"))

    def test_http_url_accepted(self):
        validate_config(_valid_config(api_url="http://localhost:3000/api/v1"))

    def test_https_url_accepted(self):
        validate_config(_valid_config(api_url="https://edge.example.com/api/v1"))


class TestWhitespace:
    def test_api_url_leading_whitespace(self):
        with pytest.raises(GatrixConfigError, match="must not have leading or trailing"):
            validate_config(_valid_config(api_url=" https://api.example.com"))

    def test_api_token_trailing_whitespace(self):
        with pytest.raises(GatrixConfigError, match="must not have leading or trailing"):
            validate_config(_valid_config(api_token="token "))


class TestCacheKeyPrefix:
    def test_too_long(self):
        with pytest.raises(GatrixConfigError, match="cacheKeyPrefix must be <= 100"):
            validate_config(_valid_config(cache_key_prefix="x" * 101))

    def test_valid_prefix(self):
        validate_config(_valid_config(cache_key_prefix="my_prefix"))


class TestCustomHeaders:
    def test_non_string_value(self):
        with pytest.raises(GatrixConfigError, match="customHeaders.*must be a string"):
            validate_config(_valid_config(custom_headers={"key": 123}))

    def test_valid_headers(self):
        validate_config(_valid_config(custom_headers={"X-Custom": "value"}))


class TestNumericRanges:
    def test_refresh_interval_too_low(self):
        with pytest.raises(GatrixConfigError, match="refreshInterval"):
            validate_config(
                _valid_config(features=FeaturesConfig(refresh_interval=0))
            )

    def test_refresh_interval_too_high(self):
        with pytest.raises(GatrixConfigError, match="refreshInterval"):
            validate_config(
                _valid_config(features=FeaturesConfig(refresh_interval=86401))
            )

    def test_metrics_interval_valid(self):
        validate_config(
            _valid_config(features=FeaturesConfig(metrics_interval=60))
        )

    def test_initial_backoff_above_max(self):
        with pytest.raises(GatrixConfigError, match="initialBackoffMs.*must be <="):
            validate_config(
                _valid_config(
                    features=FeaturesConfig(
                        fetch_retry_options=FetchRetryOptions(
                            initial_backoff_ms=50000,
                            max_backoff_ms=10000,
                        )
                    )
                )
            )

    def test_non_retryable_invalid_code(self):
        with pytest.raises(GatrixConfigError, match="invalid status code"):
            validate_config(
                _valid_config(
                    features=FeaturesConfig(
                        fetch_retry_options=FetchRetryOptions(
                            non_retryable_status_codes=[200]
                        )
                    )
                )
            )

    def test_valid_non_retryable_codes(self):
        validate_config(
            _valid_config(
                features=FeaturesConfig(
                    fetch_retry_options=FetchRetryOptions(
                        non_retryable_status_codes=[401, 403, 500]
                    )
                )
            )
        )
