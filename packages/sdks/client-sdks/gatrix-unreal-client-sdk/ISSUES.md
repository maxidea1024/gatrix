# Known Issues & Fixes

## [FIXED] SSE Watch Callback Not Firing in Lua SDK (2026-02-24)

**Commit:** `e61ae670`

### Symptom
When feature flags were updated via the dashboard and SSE events were received, the Lua `WatchRealtimeFlag` callback was never invoked — even though C++ logs confirmed `InvokeWatchCallbacks` was matching and calling `ExecuteIfBound`.

The Lua callback's `print(...)` simply never executed.

### Root Causes (Two Issues)

#### 1. Handle Number Collision (Primary — Lua callback silently broken)

`FGatrixEventEmitter::NextHandle` and `UGatrixFeaturesClient::NextWatchHandle` **both started at 1**. When Lua called `gatrix.Start()`, an internal `Once("flags.ready", ...)` listener was registered with an EventEmitter handle (e.g., handle=1). Separately, `gatrix.Features.WatchRealtimeFlag(...)` registered a Watch callback with a FeaturesClient handle (also handle=1).

In the Lua binding layer, both callbacks were tracked in the same `Session->Callbacks` array with:
```
{Handle=1, LuaRef=<lua_registry_ref>, bIsWatch=false, ...}  // Once
{Handle=1, LuaRef=12,                  bIsWatch=true,  ...}  // Watch
```

When the `flags.ready` Once callback completed and called `RemoveCallback(L, handle=1)`, it searched by Handle only (ignoring `bIsWatch`), found the Watch entry first, and called `luaL_unref(L, LUA_REGISTRYINDEX, 12)` — **freeing the Watch callback's Lua function reference**.

After this, the Lua registry slot 12 was reused for a number value. When the Watch callback later fired, `lua_rawgeti(L, LUA_REGISTRYINDEX, 12)` returned a number instead of a function → `lua_isfunction` returned false → callback silently skipped.

**Fix:** Changed `NextWatchHandle` initial value from `1` to `100000` to avoid overlap with EventEmitter handles.

#### 2. Stale Value Comparison (Secondary — some changes missed)

Flag change detection used field-by-field comparison (`bEnabled`, `Variant.Name`, `Variant.Value`). When the Edge service returned data with the same field values but a different `Version`, changes were silently missed.

**Fix:** Changed all comparison logic (`StoreFlags`, `EmitFlagChanges`, `InvokeWatchCallbacks`, `MergePartialResponse`) to compare only the `Version` field, matching the Unity SDK's behavior.

### Additional Fixes in Same Commit

- `GetAllFlags()` and `HasFlag()` now accept `bForceRealtime` parameter
- `SelectFlags()` default parameter removed — callers must explicitly specify `bForceRealtime`
- `StoreFlags` and `MergePartialResponse` use `RealtimeFlags` directly for callback invocation
- Removed debug-only diagnostic logs
