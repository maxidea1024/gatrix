"""Tests for storage providers."""
import json
import os
import tempfile

import pytest

from gatrix.storage import FileStorageProvider, InMemoryStorageProvider


class TestInMemoryStorage:
    def test_get_nonexistent(self):
        s = InMemoryStorageProvider()
        assert s.get("key") is None

    def test_save_and_get(self):
        s = InMemoryStorageProvider()
        s.save("key", {"a": 1})
        assert s.get("key") == {"a": 1}

    def test_delete(self):
        s = InMemoryStorageProvider()
        s.save("key", "value")
        s.delete("key")
        assert s.get("key") is None

    def test_delete_nonexistent(self):
        s = InMemoryStorageProvider()
        s.delete("key")  # Should not raise

    def test_overwrite(self):
        s = InMemoryStorageProvider()
        s.save("key", "v1")
        s.save("key", "v2")
        assert s.get("key") == "v2"

    def test_different_types(self):
        s = InMemoryStorageProvider()
        s.save("str", "hello")
        s.save("num", 42)
        s.save("list", [1, 2, 3])
        s.save("dict", {"k": "v"})
        assert s.get("str") == "hello"
        assert s.get("num") == 42
        assert s.get("list") == [1, 2, 3]
        assert s.get("dict") == {"k": "v"}


class TestFileStorage:
    def test_save_and_get(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            s = FileStorageProvider(tmpdir)
            s.save("testkey", {"hello": "world"})
            assert s.get("testkey") == {"hello": "world"}

    def test_get_nonexistent(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            s = FileStorageProvider(tmpdir)
            assert s.get("nope") is None

    def test_delete(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            s = FileStorageProvider(tmpdir)
            s.save("key", "value")
            s.delete("key")
            assert s.get("key") is None

    def test_special_characters_in_key(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            s = FileStorageProvider(tmpdir)
            s.save("my:special/key", "val")
            assert s.get("my:special/key") == "val"

    def test_creates_directory(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            subdir = os.path.join(tmpdir, "sub", "deep")
            s = FileStorageProvider(subdir)
            s.save("key", "value")
            assert s.get("key") == "value"
