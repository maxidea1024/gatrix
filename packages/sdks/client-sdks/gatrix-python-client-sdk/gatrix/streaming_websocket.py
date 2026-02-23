"""WebSocket streaming connection for real-time flag updates.

Uses the `websockets` library for async WebSocket communication.
A background thread runs the asyncio event loop so the Python SDK
remains synchronous on the public API surface.
"""
from __future__ import annotations

import asyncio
import json
import logging
import math
import random
import threading
from datetime import datetime, timezone
from typing import Callable, Dict, List, Optional

from gatrix.events import EVENTS, EventEmitter
from gatrix.types import StreamingConnectionState, WebSocketStreamingConfig

logger = logging.getLogger("gatrix.streaming.ws")

# Callbacks
InvalidationCallback = Callable[[List[str]], None]
FetchCallback = Callable[[], None]


class WebSocketConnection:
    """WebSocket streaming connection with automatic reconnection.

    Runs an asyncio event loop in a daemon thread to keep the
    public Python SDK API synchronous.
    """

    def __init__(
        self,
        api_url: str,
        api_token: str,
        app_name: str,
        environment: str,
        connection_id: str,
        sdk_version: str,
        config: WebSocketStreamingConfig,
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
        self._loop: Optional[asyncio.AbstractEventLoop] = None
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
        """Start WebSocket connection in background thread."""
        if self._state in ("connected", "connecting"):
            return

        self._state = "connecting"
        self._stop_requested = False

        self._thread = threading.Thread(
            target=self._run_loop, daemon=True, name="gatrix-ws"
        )
        self._thread.start()

    def disconnect(self) -> None:
        """Disconnect and cleanup."""
        self._stop_requested = True
        self._state = "disconnected"
        if self._reconnect_timer:
            self._reconnect_timer.cancel()
            self._reconnect_timer = None
        if self._loop and self._loop.is_running():
            self._loop.call_soon_threadsafe(self._loop.stop)

    def _build_url(self) -> str:
        if self._config.url:
            base_url = self._config.url
        else:
            base_url = (
                self._api_url.replace("https://", "wss://")
                .replace("http://", "ws://")
            )
            base_url += (
                f"/client/features/{self._environment}/stream/ws"
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

    def _run_loop(self) -> None:
        """Run the asyncio event loop with websocket connection."""
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        try:
            self._loop.run_until_complete(self._ws_connection_loop())
        except Exception:
            pass
        finally:
            self._loop.close()

    async def _ws_connection_loop(self) -> None:
        url = self._build_url()
        logger.debug("WebSocket connecting to: %s", url)

        try:
            # Import websockets lazily so it is only required when
            # WebSocket transport is actually used.
            import websockets  # type: ignore[import-untyped]

            extra_headers = {
                "X-API-Token": self._api_token,
                "X-Application-Name": self._app_name,
                "X-Environment": self._environment,
                "X-Connection-Id": self._connection_id,
                "X-SDK-Version": self._sdk_version,
            }
            extra_headers.update(self._custom_headers)

            async with websockets.connect(
                url,
                additional_headers=extra_headers,
                ping_interval=None,  # We manage our own pings
            ) as ws:
                # Track recovery
                if self._reconnect_count > 0:
                    self._track_recovery()
                self._state = "connected"
                self._reconnect_attempt = 0
                logger.info("WebSocket streaming connected")
                self._emitter.emit(EVENTS.FLAGS_STREAMING_CONNECTED)

                # Start ping task
                ping_task = asyncio.ensure_future(
                    self._ping_loop(ws)
                )

                try:
                    async for message in ws:
                        if self._stop_requested:
                            break
                        self._process_message(str(message))
                finally:
                    ping_task.cancel()
                    try:
                        await ping_task
                    except asyncio.CancelledError:
                        pass

            # Connection closed
            if not self._stop_requested and self._state != "disconnected":
                logger.info("WebSocket closed by server")
                self._state = "reconnecting"
                self._emitter.emit(EVENTS.FLAGS_STREAMING_DISCONNECTED)
                self._schedule_reconnect()

        except Exception as e:
            if self._stop_requested or self._state == "disconnected":
                return

            error_msg = str(e)
            self._track_error(error_msg)
            logger.warning("WebSocket error: %s", error_msg)
            self._emitter.emit(EVENTS.FLAGS_STREAMING_ERROR, error_msg)

            if self._state != "reconnecting":
                self._state = "reconnecting"
                self._emitter.emit(EVENTS.FLAGS_STREAMING_DISCONNECTED)
            self._schedule_reconnect()

    async def _ping_loop(self, ws) -> None:  # noqa: ANN001
        """Periodically send ping messages."""
        interval = self._config.ping_interval
        while not self._stop_requested:
            await asyncio.sleep(interval)
            if self._stop_requested:
                break
            try:
                await ws.send(json.dumps({"type": "ping"}))
            except Exception:
                break

    def _process_message(self, message: str) -> None:
        try:
            data = json.loads(message)
            event_type = data.get("type")
            if not event_type:
                return

            # Handle pong locally
            if event_type == "pong":
                return

            event_data = data.get("data", {})
            self._process_event(event_type, event_data)
        except (json.JSONDecodeError, ValueError, TypeError):
            pass

    def _process_event(
        self, event_type: str, event_data: Optional[dict]
    ) -> None:
        self._last_event_time = datetime.now(timezone.utc)
        self._event_count += 1

        if event_type == "connected":
            if event_data:
                server_revision = int(event_data.get("globalRevision", 0))
                if (
                    server_revision > self._local_global_revision
                    and self._local_global_revision > 0
                ):
                    self._local_global_revision = server_revision
                    if self.on_fetch_request:
                        self.on_fetch_request()
                elif self._local_global_revision == 0:
                    self._local_global_revision = server_revision

        elif event_type == "flags_changed":
            if event_data:
                server_revision = int(event_data.get("globalRevision", 0))
                changed_keys = [
                    str(k) for k in event_data.get("changedKeys", [])
                ]

                if server_revision > self._local_global_revision:
                    self._local_global_revision = server_revision
                    self._emitter.emit(EVENTS.FLAGS_INVALIDATED)
                    if self.on_invalidation:
                        self.on_invalidation(changed_keys)

        elif event_type == "heartbeat":
            logger.debug("WebSocket heartbeat received")

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
            "Scheduling WS reconnect: attempt=%d, delay=%.1fs",
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
