# Known Issues & Editor Development Gotchas

This document covers Unity-specific pitfalls and workarounds encountered during Gatrix SDK development.

---

## ⚠️ Editor Development Gotchas

When extending Gatrix Editor tools (e.g., `EditorWindow`, custom inspectors), keep these Unity-specific pitfalls in mind:

### `Time.realtimeSinceStartup` Resets on Play Mode

`Time.realtimeSinceStartup` resets to `0` when entering Play mode, but **`EditorWindow` serializable fields persist** across Play sessions. If you store a timestamp like `_lastRefreshTime = Time.realtimeSinceStartup` (e.g., `300.0f`) and then enter Play mode, the comparison `Time.realtimeSinceStartup(0) - _lastRefreshTime(300) > interval` will be **negative and always false** — causing timers to silently stop working.

**Fix:** Always reset time-tracking fields in `OnEnable()`:

```csharp
private void OnEnable()
{
    _lastRefreshTime = 0f; // Reset so auto-refresh works immediately
    EditorApplication.update += OnUpdate;
}
```

### `PostToMainThread` — Prefer `MainThreadDispatcher.Enqueue()`

Use `MainThreadDispatcher.Enqueue()` instead of `SynchronizationContext.Post()` for dispatching callbacks from background threads. `MonoBehaviour.Update()` provides more predictable timing in the Unity Editor than `SynchronizationContext`, which can be affected by UniTask's PlayerLoop modifications.
