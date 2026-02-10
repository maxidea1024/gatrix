"""GatrixClient – main entry point for the Gatrix Python SDK."""
from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional

from gatrix.errors import GatrixConfigError
from gatrix.events import EVENTS, EventEmitter
from gatrix.features_client import FeaturesClient
from gatrix.storage import StorageProvider
from gatrix.types import GatrixClientConfig, GatrixContext, SdkState
from gatrix.validate_config import validate_config
from gatrix.version import SDK_VERSION


class GatrixClient:
    """Main SDK entry point wrapping FeaturesClient + EventEmitter."""

    def __init__(
        self,
        config: GatrixClientConfig,
        storage: Optional[StorageProvider] = None,
    ) -> None:
        validate_config(config)
        self._config = config
        self._emitter = EventEmitter()
        self._features = FeaturesClient(config, self._emitter, storage)

    # =========================================================== Properties
    @property
    def features(self) -> FeaturesClient:
        return self._features

    @staticmethod
    def get_version() -> str:
        return SDK_VERSION

    @staticmethod
    def get_events() -> type:
        return EVENTS

    # =========================================================== Lifecycle
    def start(self) -> None:
        """Start the SDK (polling + metrics)."""
        self._features.start()

    def stop(self) -> None:
        """Stop the SDK."""
        self._features.stop()

    def is_ready(self) -> bool:
        return self._features._ready

    def get_error(self) -> Optional[Exception]:
        return self._features._last_error

    # =========================================================== Events
    def on(self, event: str, callback: Callable,
           name: Optional[str] = None) -> "GatrixClient":
        self._emitter.on(event, callback, name=name)
        return self

    def once(self, event: str, callback: Callable,
             name: Optional[str] = None) -> "GatrixClient":
        self._emitter.once(event, callback, name=name)
        return self

    def off(self, event: str,
            callback: Optional[Callable] = None) -> "GatrixClient":
        self._emitter.off(event, callback)
        return self

    def on_any(self, callback: Callable,
               name: Optional[str] = None) -> "GatrixClient":
        self._emitter.on_any(callback, name=name)
        return self

    def off_any(self, callback: Optional[Callable] = None) -> "GatrixClient":
        self._emitter.off_any(callback)
        return self

    # =========================================================== Stats
    def get_stats(self) -> dict:
        """Return comprehensive SDK statistics for debugging."""
        return self._features.get_stats()
