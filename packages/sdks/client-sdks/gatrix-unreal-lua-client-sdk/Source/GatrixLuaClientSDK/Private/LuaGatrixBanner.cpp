// Copyright Gatrix. All Rights Reserved.

#include "LuaGatrixBanner.h"
#include "GatrixBannerClient.h"
#include "GatrixBannerTypes.h"
#include "GatrixClient.h"
#include "Async/Async.h"

// LuaJIT headers
#include "lua.h"
#include "lauxlib.h"
#include "lualib.h"

DEFINE_LOG_CATEGORY_STATIC(LogGatrixBannerLua, Log, All);

TMap<lua_State*, TWeakObjectPtr<UGatrixBannerClient>> FGatrixBannerLuaBindings::BannerClients;
TMap<lua_State*, TArray<FGatrixBannerLuaBindings::FBannerCallbackEntry>>
    FGatrixBannerLuaBindings::PendingCallbacks;

// ==================== Registration ====================

static const luaL_Reg BannerFunctions[] = {
    {"Init", FGatrixBannerLuaBindings::Lua_InitBannerClient},
    {"FetchAll", FGatrixBannerLuaBindings::Lua_FetchAllBanners},
    {"FetchById", FGatrixBannerLuaBindings::Lua_FetchBannerById},
    {"GetCached", FGatrixBannerLuaBindings::Lua_GetCachedBanner},
    {"GetAllCached", FGatrixBannerLuaBindings::Lua_GetAllCachedBanners},
    {"ClearCache", FGatrixBannerLuaBindings::Lua_ClearBannerCache},
    {nullptr, nullptr}};

void FGatrixBannerLuaBindings::Register(lua_State* L) {
  // Get the global "gatrix" table
  lua_getglobal(L, "gatrix");
  if (!lua_istable(L, -1)) {
    lua_pop(L, 1);
    UE_LOG(LogGatrixBannerLua, Warning,
           TEXT("Register: 'gatrix' global not found. Call FGatrixLuaBindings::Register first."));
    return;
  }

  // Create gatrix.Banner sub-table
  lua_newtable(L);
  luaL_setfuncs(L, BannerFunctions, 0);
  lua_setfield(L, -2, "Banner");

  lua_pop(L, 1); // pop gatrix table

  UE_LOG(LogGatrixBannerLua, Log, TEXT("gatrix.Banner registered"));
}

void FGatrixBannerLuaBindings::Unregister(lua_State* L) {
  // Clean up pending callback refs
  if (TArray<FBannerCallbackEntry>* Entries = PendingCallbacks.Find(L)) {
    for (auto& E : *Entries) {
      if (E.LuaRef != LUA_NOREF) {
        luaL_unref(L, LUA_REGISTRYINDEX, E.LuaRef);
      }
    }
  }
  PendingCallbacks.Remove(L);
  BannerClients.Remove(L);
}

// ==================== Helpers ====================

UGatrixBannerClient* FGatrixBannerLuaBindings::GetOrCreateClient(lua_State* L) {
  TWeakObjectPtr<UGatrixBannerClient>* Found = BannerClients.Find(L);
  if (Found && Found->IsValid()) {
    return Found->Get();
  }
  return nullptr;
}

// ==================== Lua C Functions ====================

int FGatrixBannerLuaBindings::Lua_InitBannerClient(lua_State* L) {
  // gatrix.Banner.Init(apiUrl, apiToken)
  const char* ApiUrl = luaL_checkstring(L, 1);
  const char* ApiToken = luaL_checkstring(L, 2);

  UGatrixBannerClient* Client = NewObject<UGatrixBannerClient>();
  Client->AddToRoot();
  Client->Initialize(FString(ApiUrl), FString(ApiToken));
  BannerClients.Add(L, Client);

  UE_LOG(LogGatrixBannerLua, Log, TEXT("Banner client initialized via Lua"));
  return 0;
}

int FGatrixBannerLuaBindings::Lua_FetchAllBanners(lua_State* L) {
  // gatrix.Banner.FetchAll(callback)
  UGatrixBannerClient* Client = GetOrCreateClient(L);
  if (!Client) {
    luaL_error(L, "Banner client not initialized. Call gatrix.Banner.Init() first.");
    return 0;
  }

  int CallbackRef = LUA_NOREF;
  if (lua_isfunction(L, 1)) {
    lua_pushvalue(L, 1);
    CallbackRef = luaL_ref(L, LUA_REGISTRYINDEX);
  }

  lua_State* LuaState = L;

  Client->FetchAllBanners(
      [LuaState, CallbackRef](bool bSuccess, const TArray<FGatrixBanner>& Banners) {
        if (CallbackRef == LUA_NOREF) return;

        AsyncTask(ENamedThreads::GameThread, [LuaState, CallbackRef, bSuccess, Banners]() {
          lua_rawgeti(LuaState, LUA_REGISTRYINDEX, CallbackRef);
          if (lua_isfunction(LuaState, -1)) {
            lua_pushboolean(LuaState, bSuccess ? 1 : 0);

            // Push banners as array table
            lua_newtable(LuaState);
            for (int32 i = 0; i < Banners.Num(); ++i) {
              FGatrixBannerLuaBindings::PushBannerTable(LuaState, Banners[i]);
              lua_rawseti(LuaState, -2, i + 1);
            }

            if (lua_pcall(LuaState, 2, 0, 0) != 0) {
              UE_LOG(LogGatrixBannerLua, Warning,
                     TEXT("FetchAll callback error: %s"),
                     ANSI_TO_TCHAR(lua_tostring(LuaState, -1)));
              lua_pop(LuaState, 1);
            }
          } else {
            lua_pop(LuaState, 1);
          }
          luaL_unref(LuaState, LUA_REGISTRYINDEX, CallbackRef);
        });
      });

  return 0;
}

int FGatrixBannerLuaBindings::Lua_FetchBannerById(lua_State* L) {
  // gatrix.Banner.FetchById(bannerId, callback)
  UGatrixBannerClient* Client = GetOrCreateClient(L);
  if (!Client) {
    luaL_error(L, "Banner client not initialized.");
    return 0;
  }

  const char* BannerId = luaL_checkstring(L, 1);

  int CallbackRef = LUA_NOREF;
  if (lua_isfunction(L, 2)) {
    lua_pushvalue(L, 2);
    CallbackRef = luaL_ref(L, LUA_REGISTRYINDEX);
  }

  lua_State* LuaState = L;
  FString BannerIdStr(BannerId);

  Client->FetchBannerById(BannerIdStr,
      [LuaState, CallbackRef](bool bSuccess, const FGatrixBanner& Banner) {
        if (CallbackRef == LUA_NOREF) return;

        AsyncTask(ENamedThreads::GameThread, [LuaState, CallbackRef, bSuccess, Banner]() {
          lua_rawgeti(LuaState, LUA_REGISTRYINDEX, CallbackRef);
          if (lua_isfunction(LuaState, -1)) {
            lua_pushboolean(LuaState, bSuccess ? 1 : 0);
            FGatrixBannerLuaBindings::PushBannerTable(LuaState, Banner);

            if (lua_pcall(LuaState, 2, 0, 0) != 0) {
              UE_LOG(LogGatrixBannerLua, Warning,
                     TEXT("FetchById callback error: %s"),
                     ANSI_TO_TCHAR(lua_tostring(LuaState, -1)));
              lua_pop(LuaState, 1);
            }
          } else {
            lua_pop(LuaState, 1);
          }
          luaL_unref(LuaState, LUA_REGISTRYINDEX, CallbackRef);
        });
      });

  return 0;
}

int FGatrixBannerLuaBindings::Lua_GetCachedBanner(lua_State* L) {
  // gatrix.Banner.GetCached(bannerId) -> table or nil
  UGatrixBannerClient* Client = GetOrCreateClient(L);
  if (!Client) {
    lua_pushnil(L);
    return 1;
  }

  const char* BannerId = luaL_checkstring(L, 1);
  FString BannerIdStr(BannerId);

  if (Client->HasCachedBanner(BannerIdStr)) {
    FGatrixBanner Banner = Client->GetCachedBanner(BannerIdStr);
    PushBannerTable(L, Banner);
  } else {
    lua_pushnil(L);
  }
  return 1;
}

int FGatrixBannerLuaBindings::Lua_GetAllCachedBanners(lua_State* L) {
  // gatrix.Banner.GetAllCached() -> table
  UGatrixBannerClient* Client = GetOrCreateClient(L);
  if (!Client) {
    lua_newtable(L);
    return 1;
  }

  TArray<FGatrixBanner> Banners = Client->GetCachedBanners();
  lua_newtable(L);
  for (int32 i = 0; i < Banners.Num(); ++i) {
    PushBannerTable(L, Banners[i]);
    lua_rawseti(L, -2, i + 1);
  }
  return 1;
}

int FGatrixBannerLuaBindings::Lua_ClearBannerCache(lua_State* L) {
  UGatrixBannerClient* Client = GetOrCreateClient(L);
  if (Client) {
    Client->ClearCache();
  }
  return 0;
}

// ==================== Push Helpers ====================

void FGatrixBannerLuaBindings::PushBannerTable(lua_State* L,
                                                const FGatrixBanner& Banner) {
  lua_newtable(L);

  lua_pushstring(L, TCHAR_TO_ANSI(*Banner.BannerId));
  lua_setfield(L, -2, "bannerId");

  lua_pushstring(L, TCHAR_TO_ANSI(*Banner.Name));
  lua_setfield(L, -2, "name");

  lua_pushinteger(L, Banner.Width);
  lua_setfield(L, -2, "width");

  lua_pushinteger(L, Banner.Height);
  lua_setfield(L, -2, "height");

  lua_pushnumber(L, Banner.PlaybackSpeed);
  lua_setfield(L, -2, "playbackSpeed");

  lua_pushboolean(L, Banner.bShuffle ? 1 : 0);
  lua_setfield(L, -2, "shuffle");

  lua_pushinteger(L, Banner.Version);
  lua_setfield(L, -2, "version");

  // Sequences array
  lua_newtable(L);
  for (int32 i = 0; i < Banner.Sequences.Num(); ++i) {
    PushSequenceTable(L, Banner.Sequences[i]);
    lua_rawseti(L, -2, i + 1);
  }
  lua_setfield(L, -2, "sequences");
}

void FGatrixBannerLuaBindings::PushSequenceTable(lua_State* L,
                                                  const FGatrixBannerSequence& Seq) {
  lua_newtable(L);

  lua_pushstring(L, TCHAR_TO_ANSI(*Seq.SequenceId));
  lua_setfield(L, -2, "sequenceId");

  lua_pushstring(L, TCHAR_TO_ANSI(*Seq.Name));
  lua_setfield(L, -2, "name");

  lua_pushnumber(L, Seq.SpeedMultiplier);
  lua_setfield(L, -2, "speedMultiplier");

  // loopMode as string
  const char* LoopModes[] = {"loop", "pingpong", "once"};
  int32 Idx = static_cast<int32>(Seq.LoopMode);
  lua_pushstring(L, LoopModes[FMath::Clamp(Idx, 0, 2)]);
  lua_setfield(L, -2, "loopMode");

  // Frames array
  lua_newtable(L);
  for (int32 i = 0; i < Seq.Frames.Num(); ++i) {
    PushFrameTable(L, Seq.Frames[i]);
    lua_rawseti(L, -2, i + 1);
  }
  lua_setfield(L, -2, "frames");
}

void FGatrixBannerLuaBindings::PushFrameTable(lua_State* L,
                                               const FGatrixBannerFrame& Frame) {
  lua_newtable(L);

  lua_pushstring(L, TCHAR_TO_ANSI(*Frame.FrameId));
  lua_setfield(L, -2, "frameId");

  lua_pushstring(L, TCHAR_TO_ANSI(*Frame.ImageUrl));
  lua_setfield(L, -2, "imageUrl");

  // type as string
  const char* TypeStrings[] = {"jpg", "png", "gif", "mp4", "webp"};
  int32 TypeIdx = static_cast<int32>(Frame.Type);
  lua_pushstring(L, TypeStrings[FMath::Clamp(TypeIdx, 0, 4)]);
  lua_setfield(L, -2, "type");

  lua_pushinteger(L, Frame.Delay);
  lua_setfield(L, -2, "delay");

  lua_pushboolean(L, Frame.bLoop ? 1 : 0);
  lua_setfield(L, -2, "loop");

  if (!Frame.ClickUrl.IsEmpty()) {
    lua_pushstring(L, TCHAR_TO_ANSI(*Frame.ClickUrl));
    lua_setfield(L, -2, "clickUrl");
  }

  // Action
  if (Frame.Action.Type != EGatrixFrameActionType::None) {
    lua_newtable(L);
    const char* ActionTypes[] = {"none", "openUrl", "command", "deepLink"};
    int32 AIdx = static_cast<int32>(Frame.Action.Type);
    lua_pushstring(L, ActionTypes[FMath::Clamp(AIdx, 0, 3)]);
    lua_setfield(L, -2, "type");
    lua_pushstring(L, TCHAR_TO_ANSI(*Frame.Action.Value));
    lua_setfield(L, -2, "value");
    lua_setfield(L, -2, "action");
  }
}
