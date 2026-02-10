"""
Gatrix Python Client SDK
"""

from gatrix.version import SDK_NAME, SDK_VERSION
from gatrix.types import (
    GatrixClientConfig,
    GatrixContext,
    EvaluatedFlag,
    Variant,
    VariationResult,
    FeaturesConfig,
    FetchRetryOptions,
    SdkState,
)
from gatrix.client import GatrixClient
from gatrix.features_client import FeaturesClient
from gatrix.events import EVENTS, EventEmitter
from gatrix.errors import GatrixError, GatrixConfigError, GatrixFeatureError
from gatrix.flag_proxy import FlagProxy
from gatrix.storage import StorageProvider, InMemoryStorageProvider

__all__ = [
    "SDK_NAME",
    "SDK_VERSION",
    "GatrixClient",
    "GatrixClientConfig",
    "GatrixContext",
    "EvaluatedFlag",
    "Variant",
    "VariationResult",
    "FeaturesConfig",
    "FetchRetryOptions",
    "FeaturesClient",
    "FlagProxy",
    "EVENTS",
    "EventEmitter",
    "GatrixError",
    "GatrixConfigError",
    "GatrixFeatureError",
    "SdkState",
    "StorageProvider",
    "InMemoryStorageProvider",
]

__version__ = SDK_VERSION
