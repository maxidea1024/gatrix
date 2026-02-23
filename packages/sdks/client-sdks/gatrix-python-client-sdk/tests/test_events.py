"""Tests for EventEmitter."""
import pytest

from gatrix.events import EVENTS, EventEmitter


class TestOn:
    def test_basic_on(self):
        emitter = EventEmitter()
        received = []
        emitter.on("test", lambda x: received.append(x))
        emitter.emit("test", "hello")
        assert received == ["hello"]

    def test_multiple_handlers(self):
        emitter = EventEmitter()
        r1, r2 = [], []
        emitter.on("ev", lambda x: r1.append(x))
        emitter.on("ev", lambda x: r2.append(x))
        emitter.emit("ev", 42)
        assert r1 == [42]
        assert r2 == [42]

    def test_no_args(self):
        emitter = EventEmitter()
        called = []
        emitter.on("ping", lambda: called.append(True))
        emitter.emit("ping")
        assert called == [True]

    def test_multiple_args(self):
        emitter = EventEmitter()
        received = []
        emitter.on("multi", lambda a, b, c: received.append((a, b, c)))
        emitter.emit("multi", 1, "two", 3.0)
        assert received == [(1, "two", 3.0)]


class TestOnce:
    def test_once_fires_once(self):
        emitter = EventEmitter()
        received = []
        emitter.once("ev", lambda: received.append(1))
        emitter.emit("ev")
        emitter.emit("ev")
        assert received == [1]


class TestOff:
    def test_off_specific(self):
        emitter = EventEmitter()
        received = []
        cb = lambda x: received.append(x)
        emitter.on("ev", cb)
        emitter.off("ev", cb)
        emitter.emit("ev", "should-not")
        assert received == []

    def test_off_all(self):
        emitter = EventEmitter()
        received = []
        emitter.on("ev", lambda: received.append(1))
        emitter.on("ev", lambda: received.append(2))
        emitter.off("ev")  # Remove all
        emitter.emit("ev")
        assert received == []


class TestOnAny:
    def test_on_any_catches_all(self):
        emitter = EventEmitter()
        received = []
        emitter.on_any(lambda ev, *args: received.append((ev, args)))
        emitter.emit("a", 1)
        emitter.emit("b", 2, 3)
        assert received == [("a", (1,)), ("b", (2, 3))]

    def test_off_any_specific(self):
        emitter = EventEmitter()
        received = []
        cb = lambda ev, *args: received.append(ev)
        emitter.on_any(cb)
        emitter.off_any(cb)
        emitter.emit("x")
        assert received == []

    def test_off_any_all(self):
        emitter = EventEmitter()
        received = []
        emitter.on_any(lambda ev: received.append(ev))
        emitter.off_any()
        emitter.emit("x")
        assert received == []


class TestHandlerStats:
    def test_stats_tracking(self):
        emitter = EventEmitter()
        emitter.on("ev", lambda: None, name="my-handler")
        emitter.emit("ev")
        emitter.emit("ev")

        stats = emitter.get_handler_stats()
        assert "ev" in stats
        assert len(stats["ev"]) == 1
        assert stats["ev"][0]["name"] == "my-handler"
        assert stats["ev"][0]["call_count"] == 2
        assert stats["ev"][0]["is_once"] is False


class TestErrorResilience:
    def test_handler_error_does_not_propagate(self):
        emitter = EventEmitter()
        after = []

        def bad_handler():
            raise RuntimeError("boom")

        emitter.on("ev", bad_handler)
        emitter.on("ev", lambda: after.append(True))
        emitter.emit("ev")  # Should not raise
        assert after == [True]


class TestEventConstants:
    def test_event_names(self):
        assert EVENTS.FLAGS_INIT == "flags.init"
        assert EVENTS.FLAGS_READY == "flags.ready"
        assert EVENTS.FLAGS_FETCH == "flags.fetch"
        assert EVENTS.FLAGS_CHANGE == "flags.change"
        assert EVENTS.FLAGS_IMPRESSION == "flags.impression"
        assert EVENTS.SDK_ERROR == "flags.error"
