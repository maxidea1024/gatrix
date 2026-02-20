// Copyright Gatrix. All Rights Reserved.
// LuaJIT binding for Gatrix Unreal SDK
//
// Pure lua_State* based binding — no dependency on game-specific Lua wrappers.
// Registers a "gatrix" global module into an existing LuaJIT VM.
//
// Usage:
//   // C++ side — register into existing LuaJIT VM
//   #include "LuaGatrix.h"
//   FGatrixLuaBindings::Register(ExistingLuaState);
//
//   -- Lua side: lifecycle functions are on the root gatrix table
//   gatrix.Init({
//     ApiUrl      = "http://host/api/v1",
//     ApiToken    = "your-token",
//     AppName     = "MyApp",
//     Environment = "production",
//     -- Optional:
//     -- RefreshInterval = 30,
//     -- EnableDevMode   = true,
//     -- ExplicitSyncMode = false,
//   })
//   gatrix.Start()
//   gatrix.Stop()
//
//   -- Feature flag functions live under gatrix.Features.*
//   -- All names are PascalCase (except the root "gatrix" table itself)
//   if gatrix.Features.IsEnabled("new_feature") then ... end
//   local val  = gatrix.Features.StringVariation("flag_name", "default")
//   local flag = gatrix.Features.GetFlag("flag_name")   -- {Name, Enabled,
//   Variant, ...} gatrix.Features.WatchRealtimeFlag("flag_name",
//   function(proxy) ... end)

#pragma once

#include "CoreMinimal.h"

// Forward declare lua_State to avoid requiring lua.h in this header
struct lua_State;

/**
 * FGatrixLuaBindings — registers Gatrix SDK functions into a Lua VM.
 *
 * This is a pure C++ static class (not a UObject). It works with any
 * lua_State* and does NOT depend on FLuaState, FLuaFunc, FLuaScript,
 * or any other game-specific Lua wrapper.
 *
 * Memory safety:
 * - All callbacks use a shared "alive" flag (TSharedPtr<bool>) that is
 *   set to false on Unregister()/stop(). Callbacks check this flag before
 *   accessing lua_State*, preventing dangling pointer access.
 * - Lua function references are managed via luaL_ref/luaL_unref pairs.
 *   Every ref is tracked and guaranteed to be cleaned up.
 * - Unregister() MUST be called before lua_close() to prevent leaks.
 *
 * Call Register(L) once with your existing lua_State* to make the
 * "gatrix" module available to Lua scripts.
 */
class GATRIXLUASDK_API FGatrixLuaBindings {
public:
  /**
   * Register the "gatrix" module into the given Lua state.
   * After this call, Lua scripts can use: local gatrix = require("gatrix")
   *
   * @param L  Existing lua_State* from the game's Lua VM
   */
  static void Register(lua_State *L);

  /**
   * Unregister and clean up all Gatrix callbacks from the given Lua state.
   * MUST be called before lua_close() to prevent dangling references.
   *
   * @param L  The same lua_State* passed to Register()
   */
  static void Unregister(lua_State *L);

  // ==================== Lua C Functions (public for luaL_Reg table)
  // ====================

  // Lifecycle
  static int Lua_Init(lua_State *L);
  static int Lua_Start(lua_State *L);
  static int Lua_Stop(lua_State *L);

  // Flag access
  static int Lua_IsEnabled(lua_State *L);
  static int Lua_GetFlag(lua_State *L);
  static int Lua_Variation(lua_State *L);
  static int Lua_BoolVariation(lua_State *L);
  static int Lua_StringVariation(lua_State *L);
  static int Lua_IntVariation(lua_State *L);
  static int Lua_FloatVariation(lua_State *L);
  static int Lua_GetVariant(lua_State *L);
  static int Lua_GetAllFlags(lua_State *L);
  static int Lua_HasFlag(lua_State *L);

  // Flag access - Details (returns {Value, Reason, FlagExists, Enabled})
  static int Lua_BoolVariationDetails(lua_State *L);
  static int Lua_StringVariationDetails(lua_State *L);
  static int Lua_IntVariationDetails(lua_State *L);
  static int Lua_FloatVariationDetails(lua_State *L);

  // Flag access - OrThrow (raises Lua error if flag missing/type mismatch)
  static int Lua_BoolVariationOrThrow(lua_State *L);
  static int Lua_StringVariationOrThrow(lua_State *L);
  static int Lua_IntVariationOrThrow(lua_State *L);
  static int Lua_FloatVariationOrThrow(lua_State *L);

  // Context
  static int Lua_UpdateContext(lua_State *L);
  static int Lua_GetContext(lua_State *L);

  // Events
  static int Lua_On(lua_State *L);
  static int Lua_Off(lua_State *L);
  static int Lua_Once(lua_State *L);
  static int Lua_OnAny(lua_State *L);
  static int Lua_OffAny(lua_State *L);

  // Watch
  static int Lua_WatchRealtimeFlag(lua_State *L);
  static int Lua_WatchSyncedFlag(lua_State *L);
  static int Lua_WatchRealtimeFlagWithInitialState(lua_State *L);
  static int Lua_WatchSyncedFlagWithInitialState(lua_State *L);
  static int Lua_UnwatchFlag(lua_State *L);
  static int Lua_CreateWatchGroup(lua_State *L);

  // Push UGatrixFlagProxy fields as a Lua table (called from watch delegates)
  static void PushFlagProxyTable(lua_State *L, class UGatrixFlagProxy *Proxy);

  // State
  static int Lua_IsReady(lua_State *L);
  static int Lua_IsInitialized(lua_State *L);

  // Sync
  static int Lua_FetchFlags(lua_State *L);
  static int Lua_SyncFlags(lua_State *L);

private:
  // ==================== Helpers ====================

  // Safely read a Lua value as FString, converting userdata via tostring()
  static FString SafeToString(lua_State *L, int Index);

  // Push FGatrixVariant as a Lua table {Name, Enabled, Value}
  // Value is pushed as native Lua type based on ValueType
  static void
  PushVariantTable(lua_State *L, const struct FGatrixVariant &Variant,
                   EGatrixValueType ValueType = EGatrixValueType::String);

  // Push FGatrixEvaluatedFlag as a Lua table
  static void PushEvaluatedFlagTable(lua_State *L,
                                     const struct FGatrixEvaluatedFlag &Flag);

  // Push FGatrixContext as a Lua table
  static void PushContextTable(lua_State *L,
                               const struct FGatrixContext &Context);

  // Read a Lua table at the given index into FGatrixContext
  static struct FGatrixContext ReadContextFromTable(lua_State *L, int Index);

  // ==================== Callback Management ====================

  struct FCallbackEntry {
    int32 Handle;  // Handle from UGatrixClient::On() or WatchRealtimeFlag etc.
    int LuaRef;    // luaL_ref() reference in LUA_REGISTRYINDEX
    bool bIsWatch; // true if this is a Watch callback (needs UnwatchFlag for
                   // cleanup)
    bool bIsAny;   // true if this is an OnAny callback (needs OffAny for
                   // cleanup)
  };

  // Per-lua_State session tracking
  struct FLuaSession {
    // Shared alive flag — set to false when Unregister() is called.
    // All captured lambdas hold a copy of this shared ptr.
    // They check *bAlive before touching lua_State*. This prevents
    // dangling pointer access even if Gatrix fires a callback after
    // the Lua state has been destroyed.
    TSharedPtr<bool> bAlive;

    // Tracked callbacks for cleanup
    TArray<FCallbackEntry> Callbacks;
  };

  // Registry of active lua_State sessions
  static TMap<lua_State *, FLuaSession> SessionRegistry;

  // Get the alive flag for the current lua_State
  static TSharedPtr<bool> GetAliveFlag(lua_State *L);

  // Remove a specific callback entry and unref from Lua
  static void RemoveCallback(lua_State *L, int32 Handle);

  // Remove all callbacks for a lua_State and invalidate the alive flag
  static void RemoveAllCallbacks(lua_State *L);
};
