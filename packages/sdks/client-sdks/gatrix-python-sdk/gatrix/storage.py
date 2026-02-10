"""Storage provider interface and built-in implementations."""
from __future__ import annotations

import json
import os
import threading
from typing import Any, Optional, Protocol


class StorageProvider(Protocol):
    """Storage provider interface (sync)."""
    def get(self, key: str) -> Any: ...
    def save(self, key: str, value: Any) -> None: ...
    def delete(self, key: str) -> None: ...


class InMemoryStorageProvider:
    """In-memory only storage (no persistence). Thread-safe."""

    def __init__(self) -> None:
        self._data: dict[str, Any] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Any:
        with self._lock:
            return self._data.get(key)

    def save(self, key: str, value: Any) -> None:
        with self._lock:
            self._data[key] = value

    def delete(self, key: str) -> None:
        with self._lock:
            self._data.pop(key, None)


class FileStorageProvider:
    """File-based persistent storage. Thread-safe."""

    def __init__(self, directory: str) -> None:
        self._directory = directory
        self._lock = threading.Lock()
        os.makedirs(directory, exist_ok=True)

    def _path(self, key: str) -> str:
        safe = "".join(c if c.isalnum() or c in ("_", "-") else "_" for c in key)
        return os.path.join(self._directory, f"{safe}.json")

    def get(self, key: str) -> Any:
        with self._lock:
            path = self._path(key)
            if not os.path.exists(path):
                return None
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)

    def save(self, key: str, value: Any) -> None:
        with self._lock:
            path = self._path(key)
            with open(path, "w", encoding="utf-8") as f:
                json.dump(value, f, ensure_ascii=False)

    def delete(self, key: str) -> None:
        with self._lock:
            path = self._path(key)
            if os.path.exists(path):
                os.remove(path)
