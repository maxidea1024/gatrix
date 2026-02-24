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
    def start(
        self,
        on_complete: Optional[Callable[[bool, str], None]] = None,
    ) -> None:
        """Start the SDK (polling + metrics).

        Args:
            on_complete: Optional callback ``(success, error_msg)`` invoked once
                when the first fetch completes.
        """
        self._features.start(on_complete=on_complete)

    def stop(self) -> None:
        """Stop the SDK."""
        self._features.stop()

    def is_ready(self) -> bool:
        return self._features._ready

    def get_error(self) -> Optional[Exception]:
        return self._features._last_error

    # =========================================================== Tracking
    def track(
        self,
        event_name: str,
        properties: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Track a custom user event.

        NOTE: Not yet implemented. This API is reserved for the upcoming
        Gatrix Analytics service and will be fully supported in a future release.

        Args:
            event_name: Name of the event to track.
            properties: Optional dictionary of event properties.
        """
        if self._config.enable_dev_mode:
            import logging
            logging.getLogger("gatrix").debug(
                "[Gatrix] track() called: eventName=%r, properties=%r "
                "— tracking is not yet supported but will be available soon.",
                event_name,
                properties or {},
            )

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

    def get_light_stats(self) -> dict:
        """Return lightweight statistics — scalar values only, no dict/list copying.

        Use this for frequent polling or low-overhead diagnostics.
        """
        return self._features.get_light_stats()
