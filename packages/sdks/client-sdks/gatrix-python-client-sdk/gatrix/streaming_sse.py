"""SSE (Server-Sent Events) streaming connection for real-time flag updates.

Uses Python's urllib (stdlib) for chunked HTTP streaming with automatic
reconnection via exponential backoff + jitter.
"""
from __future__ import annotations

import json
import logging
import math
import random
import threading
import time
from datetime import datetime, timezone
from typing import Callable, Dict, List, Optional
from urllib.error import URLError
from urllib.request import Request, urlopen

from gatrix.events import EVENTS, EventEmitter
from gatrix.types import SseStreamingConfig, StreamingConnectionState

logger = logging.getLogger("gatrix.streaming.sse")

# Callbacks
InvalidationCallback = Callable[[List[str]], None]
FetchCallback = Callable[[], None]


class SseConnection:
    """SSE streaming connection with automatic reconnection."""

    def __init__(
        self,
        api_url: str,
        api_token: str,
        app_name: str,
        environment: str,
        connection_id: str,
        sdk_version: str,
        config: SseStreamingConfig,
        emitter: EventEmitter,
        custom_headers: Optional[Dict[str, str]] = None,
    ) -> None:
        self._api_url = api_url
        self._api_token = api_token
        self._app_name = app_name
        self._environment = environment
        self._connection_id = connection_id
        self._sdk_version = sdk_version
        self._config = config
        self._emitter = emitter
        self._custom_headers = custom_headers or {}

        self._state: StreamingConnectionState = "disconnected"
        self._reconnect_attempt = 0
        self._reconnect_count = 0
        self._event_count = 0
        self._error_count = 0
        self._recovery_count = 0
        self._local_global_revision = 0
        self._last_error: Optional[str] = None
        self._last_event_time: Optional[datetime] = None
        self._last_error_time: Optional[datetime] = None
        self._last_recovery_time: Optional[datetime] = None
        self._stop_requested = False
        self._thread: Optional[threading.Thread] = None
        self._reconnect_timer: Optional[threading.Timer] = None

        self.on_invalidation: Optional[InvalidationCallback] = None
        self.on_fetch_request: Optional[FetchCallback] = None

    @property
    def state(self) -> StreamingConnectionState:
        return self._state

    @property
    def reconnect_count(self) -> int:
        return self._reconnect_count

    @property
    def event_count(self) -> int:
        return self._event_count

    @property
    def error_count(self) -> int:
        return self._error_count

    @property
    def recovery_count(self) -> int:
        return self._recovery_count

    @property
    def last_error(self) -> Optional[str]:
        return self._last_error

    @property
    def last_event_time(self) -> Optional[datetime]:
        return self._last_event_time

    @property
    def last_error_time(self) -> Optional[datetime]:
        return self._last_error_time

    @property
    def last_recovery_time(self) -> Optional[datetime]:
        return self._last_recovery_time

    def connect(self) -> None:
        """Start SSE connection."""
        if self._state in ("connected", "connecting"):
            return

        self._state = "connecting"
        self._stop_requested = False

        self._thread = threading.Thread(
            target=self._run_sse_loop, daemon=True, name="gatrix-sse"
        )
        self._thread.start()

    def disconnect(self) -> None:
        """Disconnect and cleanup."""
        self._stop_requested = True
        self._state = "disconnected"
        if self._reconnect_timer:
            self._reconnect_timer.cancel()
            self._reconnect_timer = None

    def _build_url(self) -> str:
        base_url = self._config.url or (
            f"{self._api_url}/client/features/{self._environment}/stream/sse"
        )
        params = (
            f"x-api-token={self._api_token}"
            f"&appName={self._app_name}"
            f"&environment={self._environment}"
            f"&connectionId={self._connection_id}"
            f"&sdkVersion={self._sdk_version}"
        )
        sep = "&" if "?" in base_url else "?"
        return f"{base_url}{sep}{params}"

    def _run_sse_loop(self) -> None:
        url = self._build_url()
        logger.debug("SSE connecting to: %s", url)

        try:
            req = Request(url)
            req.add_header("Accept", "text/event-stream")
            req.add_header("Cache-Control", "no-cache")
            req.add_header("X-API-Token", self._api_token)
            req.add_header("X-Application-Name", self._app_name)
            req.add_header("X-Environment", self._environment)
            req.add_header("X-Connection-Id", self._connection_id)
            req.add_header("X-SDK-Version", self._sdk_version)
            for k, v in self._custom_headers.items():
                req.add_header(k, v)

            with urlopen(req, timeout=None) as response:
                if response.status != 200:
                    error_msg = f"SSE HTTP error: {response.status}"
                    self._track_error(error_msg)
                    self._state = "reconnecting"
                    self._emitter.emit(EVENTS.FLAGS_STREAMING_ERROR, error_msg)
                    self._emitter.emit(EVENTS.FLAGS_STREAMING_DISCONNECTED)
                    self._schedule_reconnect()
                    return

                # Track recovery
                if self._reconnect_count > 0:
                    self._track_recovery()
                self._state = "connected"
                self._reconnect_attempt = 0
                logger.info("SSE streaming connected")
                self._emitter.emit(EVENTS.FLAGS_STREAMING_CONNECTED)

                # Parse SSE stream line by line
                current_event_type = ""
                data_buffer = ""
                for raw_line in response:
                    if self._stop_requested:
                        break

                    line = raw_line.decode("utf-8", errors="replace").rstrip(
                        "\r\n"
                    )

                    if not line:
                        # Empty line = dispatch
                        if current_event_type or data_buffer:
                            event_type = current_event_type or "message"
                            self._process_event(event_type, data_buffer)
                            current_event_type = ""
                            data_buffer = ""
                    elif line.startswith("event:"):
                        current_event_type = line[6:].lstrip()
                    elif line.startswith("data:"):
                        data_value = line[5:].lstrip()
                        if data_buffer:
                            data_buffer += "\n"
                        data_buffer += data_value
                    # Ignore id:, retry:, and comment lines

            # Stream ended
            if (
                not self._stop_requested
                and self._state != "disconnected"
            ):
                logger.info("SSE connection closed by server")
                self._state = "reconnecting"
                self._emitter.emit(EVENTS.FLAGS_STREAMING_DISCONNECTED)
                self._schedule_reconnect()

        except (URLError, OSError, Exception) as e:
            if self._stop_requested or self._state == "disconnected":
                return

            error_msg = str(e)
            self._track_error(error_msg)
            logger.warning("SSE connection error: %s", error_msg)
            self._emitter.emit(EVENTS.FLAGS_STREAMING_ERROR, error_msg)

            if self._state != "reconnecting":
                self._state = "reconnecting"
                self._emitter.emit(EVENTS.FLAGS_STREAMING_DISCONNECTED)
            self._schedule_reconnect()

    def _process_event(self, event_type: str, event_data: str) -> None:
        self._last_event_time = datetime.now(timezone.utc)
        self._event_count += 1

        if event_type == "connected":
            try:
                data = json.loads(event_data)
                server_revision = int(data.get("globalRevision", 0))
                if (
                    server_revision > self._local_global_revision
                    and self._local_global_revision > 0
                ):
                    self._local_global_revision = server_revision
                    if self.on_fetch_request:
                        self.on_fetch_request()
                elif self._local_global_revision == 0:
                    self._local_global_revision = server_revision
            except (json.JSONDecodeError, ValueError, TypeError):
                pass

        elif event_type == "flags_changed":
            try:
                data = json.loads(event_data)
                server_revision = int(data.get("globalRevision", 0))
                changed_keys = [str(k) for k in data.get("changedKeys", [])]

                if server_revision > self._local_global_revision:
                    self._local_global_revision = server_revision
                    self._emitter.emit(EVENTS.FLAGS_INVALIDATED)
                    if self.on_invalidation:
                        self.on_invalidation(changed_keys)
            except (json.JSONDecodeError, ValueError, TypeError):
                pass

        elif event_type == "heartbeat":
            logger.debug("SSE heartbeat received")

    def _schedule_reconnect(self) -> None:
        if self._state == "disconnected" or self._stop_requested:
            return

        if self._reconnect_timer:
            self._reconnect_timer.cancel()

        self._reconnect_attempt += 1
        self._reconnect_count += 1

        base_s = self._config.reconnect_base
        max_s = self._config.reconnect_max
        exponential = min(
            base_s * math.pow(2, self._reconnect_attempt - 1), max_s
        )
        jitter = random.uniform(0, 1)
        delay = exponential + jitter

        logger.debug(
            "Scheduling SSE reconnect: attempt=%d, delay=%.1fs",
            self._reconnect_attempt,
            delay,
        )
        self._emitter.emit(EVENTS.FLAGS_STREAMING_RECONNECTING)

        if self._reconnect_attempt >= 5 and self._state != "degraded":
            self._state = "degraded"

        def _reconnect():
            if not self._stop_requested and self._state != "disconnected":
                self.connect()

        self._reconnect_timer = threading.Timer(delay, _reconnect)
        self._reconnect_timer.daemon = True
        self._reconnect_timer.start()

    def _track_error(self, error_message: str) -> None:
        self._error_count += 1
        self._last_error_time = datetime.now(timezone.utc)
        self._last_error = error_message

    def _track_recovery(self) -> None:
        self._recovery_count += 1
        self._last_recovery_time = datetime.now(timezone.utc)
