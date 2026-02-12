# SDK Spec Compliance Check Results

## Date: 2026-02-12

## Scope
Checked all 7 SDK implementations against `CLIENT_SDK_SPEC.md` for synchronization logic:
- JS/TS (Reference), Flutter, Unity, Python, Godot, Unreal, Cocos2d-x

---

## Summary of Fixes Applied

### 1. FlagProxy `forceRealtime` Parameter Removal
**Spec Rule:** FlagProxy methods do NOT expose `forceRealtime` (lines 753-769). Only `FeaturesClient` public methods do.

| SDK       | Before | After  | Status |
|-----------|--------|--------|--------|
| JS/TS     | ✅ No forceRealtime | - | Compliant |
| Unity     | ✅ No forceRealtime | - | Compliant |
| Unreal    | ✅ No forceRealtime | - | Compliant |
| Cocos2d-x | ✅ No forceRealtime | - | Compliant |
| Flutter   | ❌ Had forceRealtime | ✅ Removed | **Fixed** |
| Python    | ❌ Had force_realtime | ✅ Removed | **Fixed** |
| Godot     | ❌ Had force_realtime | ✅ Removed | **Fixed** |

### 2. FLAGS_PENDING_SYNC false→true Transition Check
**Spec Rule:** `FLAGS_PENDING_SYNC` should only be emitted when `pendingSync` transitions from `false` to `true`.

| SDK       | Before | After  | Status |
|-----------|--------|--------|--------|
| JS/TS     | ✅ Checks `wasPending` | - | Compliant |
| Unity     | ✅ Checks `_pendingSync` | - | Compliant |
| Flutter   | ✅ Checks `wasPending` | - | Compliant |
| Python    | ✅ Checks `_pending_sync` | - | Compliant |
| Cocos2d-x | ✅ Checks `_pendingSync` | - | Compliant |
| Unreal    | ❌ Always emitted | ✅ Added `bWasPending` check | **Fixed** |
| Godot     | ❌ Always emitted | ✅ Added `was_pending` check | **Fixed** |

### 3. syncFlags() FLAGS_CHANGE Emission
**Spec Rule:** `syncFlags()` should emit both `FLAGS_SYNC` and `FLAGS_CHANGE`.

| SDK       | Before | After  | Status |
|-----------|--------|--------|--------|
| JS/TS     | ✅ Emits both | - | Compliant |
| Unity     | ✅ Emits both | - | Compliant |
| Flutter   | ✅ Emits both | - | Compliant |
| Cocos2d-x | ✅ Emits both | - | Compliant |
| Python    | ❌ Only FLAGS_SYNC | ✅ Added FLAGS_CHANGE | **Fixed** |
| Godot     | ❌ Only FLAGS_SYNC | ✅ Added FLAGS_CHANGE | **Fixed** |

### 4. syncFlags() Explicit Sync Guard
**Spec Rule:** `syncFlags()` should be a no-op when not in explicit sync mode.

| SDK       | Before | After  | Status |
|-----------|--------|--------|--------|
| JS/TS     | ✅ Has guard | - | Compliant |
| Unity     | ✅ Has guard | - | Compliant |
| Flutter   | ✅ Has guard | - | Compliant |
| Cocos2d-x | ✅ Has guard | - | Compliant |
| Unreal    | ✅ Has guard | - | Compliant |
| Godot     | ✅ Has guard | - | Compliant |
| Python    | ❌ No guard | ✅ Added guard | **Fixed** |

### 5. setExplicitSyncMode() Config Update
**Spec Rule:** `setExplicitSyncMode()` must actually change the mode at runtime.

| SDK       | Before | After  | Status |
|-----------|--------|--------|--------|
| JS/TS     | ✅ Updates config | - | Compliant |
| Unity     | ✅ Updates config | - | Compliant |
| Flutter   | ✅ Updates field | - | Compliant |
| Python    | ✅ Updates field | - | Compliant |
| Godot     | ✅ Updates config | - | Compliant |
| Unreal    | ✅ Updates config | - | Compliant |
| Cocos2d-x | ❌ const ref prevented update | ✅ Added mutable `_explicitSyncMode` field | **Fixed** |

### 6. Explicit Sync Mode: FLAGS_CHANGE in storeFlags
**Spec Rule:** `FLAGS_CHANGE` should NOT be emitted in `storeFlags` when in explicit sync mode (only emitted via `syncFlags`).

| SDK       | Before | After  | Status |
|-----------|--------|--------|--------|
| JS/TS     | ✅ Conditional | - | Compliant |
| Unity     | ✅ Conditional | - | Compliant |
| Flutter   | ✅ Conditional | - | Compliant |
| Python    | ✅ Conditional | - | Compliant |
| Cocos2d-x | ✅ Conditional | - | Compliant |
| Unreal    | ✅ Conditional | - | Compliant |
| Godot     | ❌ Always emitted FLAGS_CHANGE | ✅ Conditional | **Fixed** |

---

## Files Modified

### Flutter SDK
- `lib/src/flag_proxy.dart` - Removed `forceRealtime` from all variation methods

### Python SDK
- `gatrix/flag_proxy.py` - Removed `force_realtime` from all variation methods
- `gatrix/features_client.py` - Added explicit_sync_mode guard and FLAGS_CHANGE to sync_flags
- `tests/test_flag_proxy.py` - Updated tests to match new FlagProxy interface

### Godot SDK
- `addons/gatrix_sdk/gatrix_flag_proxy.gd` - Removed `force_realtime` from all variation methods
- `addons/gatrix_sdk/gatrix_features_client.gd` - Fixed FLAGS_PENDING_SYNC transition, added FLAGS_CHANGE to sync_flags, conditional FLAGS_CHANGE in _store_flags

### Unreal SDK
- `source/gatrixsdk/private/gatrixfeaturesclient.cpp` - Fixed FLAGS_PENDING_SYNC false→true transition check

### Cocos2d-x SDK
- `include/GatrixFeaturesClient.h` - Added mutable `_explicitSyncMode` field
- `src/GatrixFeaturesClient.cpp` - Replaced all `_config.explicitSyncMode` with `_explicitSyncMode`, fixed setExplicitSyncMode

---

## Test Results
- Python: 41/41 tests passed ✅
- JS/TS: TypeScript compile check passed ✅
