"""Event constants and EventEmitter implementation (stdlib only)."""
from __future__ import annotations

import threading
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Tuple


class EVENTS:
    """Event name constants (flags.* namespace)."""
    FLAGS_INIT = "flags.init"
    FLAGS_READY = "flags.ready"
    FLAGS_FETCH = "flags.fetch"
    FLAGS_FETCH_START = "flags.fetch_start"
    FLAGS_FETCH_SUCCESS = "flags.fetch_success"
    FLAGS_FETCH_ERROR = "flags.fetch_error"
    FLAGS_FETCH_END = "flags.fetch_end"
    FLAGS_CHANGE = "flags.change"
    FLAGS_REMOVED = "flags.removed"
    FLAGS_SYNC = "flags.sync"
    FLAGS_IMPRESSION = "flags.impression"
    FLAGS_METRICS_SENT = "flags.metrics.sent"
    FLAGS_METRICS_ERROR = "flags.metrics.error"
    SDK_ERROR = "flags.error"
    FLAGS_RECOVERED = "flags.recovered"


# Type aliases
Callback = Callable[..., Any]


class _HandlerInfo:
    """Metadata for a registered handler."""
    __slots__ = ("callback", "once", "name", "call_count", "registered_at")

    def __init__(self, callback: Callback, *, once: bool = False,
                 name: Optional[str] = None) -> None:
        self.callback = callback
        self.once = once
        self.name = name or ""
        self.call_count = 0
        self.registered_at = datetime.now(timezone.utc)


class EventEmitter:
    """Thread-safe event emitter with on/once/off/onAny/offAny support."""

    def __init__(self) -> None:
        self._handlers: Dict[str, List[_HandlerInfo]] = {}
        self._any_handlers: List[_HandlerInfo] = []
        self._lock = threading.Lock()

    # ------------------------------------------------------------------ on
    def on(self, event: str, callback: Callback,
           name: Optional[str] = None) -> "EventEmitter":
        with self._lock:
            self._handlers.setdefault(event, []).append(
                _HandlerInfo(callback, name=name)
            )
        return self

    # ---------------------------------------------------------------- once
    def once(self, event: str, callback: Callback,
             name: Optional[str] = None) -> "EventEmitter":
        with self._lock:
            self._handlers.setdefault(event, []).append(
                _HandlerInfo(callback, once=True, name=name)
            )
        return self

    # ----------------------------------------------------------------- off
    def off(self, event: str,
            callback: Optional[Callback] = None) -> "EventEmitter":
        with self._lock:
            if callback is None:
                self._handlers.pop(event, None)
            else:
                handlers = self._handlers.get(event, [])
                self._handlers[event] = [
                    h for h in handlers if h.callback is not callback
                ]
        return self

    # -------------------------------------------------------------- onAny
    def on_any(self, callback: Callback,
               name: Optional[str] = None) -> "EventEmitter":
        with self._lock:
            self._any_handlers.append(_HandlerInfo(callback, name=name))
        return self

    # ------------------------------------------------------------- offAny
    def off_any(self, callback: Optional[Callback] = None) -> "EventEmitter":
        with self._lock:
            if callback is None:
                self._any_handlers.clear()
            else:
                self._any_handlers = [
                    h for h in self._any_handlers if h.callback is not callback
                ]
        return self

    # ---------------------------------------------------------------- emit
    def emit(self, event: str, *args: Any) -> None:
        with self._lock:
            handlers = list(self._handlers.get(event, []))
            any_handlers = list(self._any_handlers)

        to_remove: List[Tuple[str, _HandlerInfo]] = []
        for h in handlers:
            try:
                h.callback(*args)
                h.call_count += 1
            except Exception:
                pass
            if h.once:
                to_remove.append((event, h))

        for h in any_handlers:
            try:
                h.callback(event, *args)
                h.call_count += 1
            except Exception:
                pass

        # Cleanup once-handlers
        if to_remove:
            with self._lock:
                for ev, h in to_remove:
                    lst = self._handlers.get(ev, [])
                    try:
                        lst.remove(h)
                    except ValueError:
                        pass

    # ---------------------------------------------------------- introspect
    def get_handler_stats(self) -> Dict[str, List[dict]]:
        """Return handler stats for SDK monitoring."""
        with self._lock:
            result: Dict[str, List[dict]] = {}
            for event, handlers in self._handlers.items():
                result[event] = [
                    {
                        "name": h.name,
                        "call_count": h.call_count,
                        "is_once": h.once,
                        "registered_at": h.registered_at,
                    }
                    for h in handlers
                ]
            return result
