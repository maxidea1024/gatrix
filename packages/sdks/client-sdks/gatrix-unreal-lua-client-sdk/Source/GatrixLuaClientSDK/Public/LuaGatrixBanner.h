// Copyright Gatrix. All Rights Reserved.
// LuaJIT binding for Gatrix Banner functionality
//
// Registers banner functions under the existing "gatrix" table:
//   gatrix.Banner.FetchAll(callback)
//   gatrix.Banner.FetchById(bannerId, callback)
//   gatrix.Banner.GetCached(bannerId) -> table
//   gatrix.Banner.GetAllCached() -> table
//   gatrix.Banner.ClearCache()

#pragma once

#include "CoreMinimal.h"

struct lua_State;

/**
 * FGatrixBannerLuaBindings — registers banner-specific Lua functions.
 *
 * Call RegisterBanner(L) after FGatrixLuaBindings::Register(L) to add
 * the gatrix.Banner sub-table.
 */
class GATRIXLUACLIENTSDK_API FGatrixBannerLuaBindings {
public:
  /**
   * Register the "gatrix.Banner" sub-module into the given Lua state.
   * FGatrixLuaBindings::Register(L) must be called first.
   */
  static void Register(lua_State* L);

  /** Cleanup banner-related Lua refs */
  static void Unregister(lua_State* L);

  // ==================== Lua C Functions ====================

  // Banner data fetching
  static int Lua_FetchAllBanners(lua_State* L);
  static int Lua_FetchBannerById(lua_State* L);
  static int Lua_GetCachedBanner(lua_State* L);
  static int Lua_GetAllCachedBanners(lua_State* L);
  static int Lua_ClearBannerCache(lua_State* L);

  // Banner client lifecycle
  static int Lua_InitBannerClient(lua_State* L);

private:
  // Push FGatrixBanner as a Lua table
  static void PushBannerTable(lua_State* L, const struct FGatrixBanner& Banner);
  static void PushSequenceTable(lua_State* L, const struct FGatrixBannerSequence& Seq);
  static void PushFrameTable(lua_State* L, const struct FGatrixBannerFrame& Frame);

  // Get banner client for the given Lua state
  static class UGatrixBannerClient* GetOrCreateClient(lua_State* L);

  // Banner client singleton (per Lua state)
  static TMap<lua_State*, TWeakObjectPtr<class UGatrixBannerClient>> BannerClients;

  // Pending callback refs
  struct FBannerCallbackEntry {
    int LuaRef;
  };
  static TMap<lua_State*, TArray<FBannerCallbackEntry>> PendingCallbacks;
};
