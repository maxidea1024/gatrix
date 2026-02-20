// Copyright Gatrix. All Rights Reserved.
// Lua binding implementation for Gatrix Unreal SDK

#include "LuaGatrix.h"
#include "GatrixClient.h"
#include "GatrixEvents.h"
#include "GatrixFlagProxy.h"
#include "GatrixLuaSDKModule.h"
#include "GatrixTypes.h"
#include "GatrixWatchFlagGroup.h"

// Lua headers (C linkage)
extern "C" {
#include "lauxlib.h"
#include "lua.h"
#include "lualib.h"
}

// ==================== Static State ====================

TMap<lua_State *, FGatrixLuaBindings::FLuaSession>
    FGatrixLuaBindings::SessionRegistry;

// ==================== Registration ====================

// Root-level functions: lifecycle, context, events
static const struct luaL_Reg GatrixRootFunctions[] = {
    // Lifecycle
    {"Init", FGatrixLuaBindings::Lua_Init},
    {"Start", FGatrixLuaBindings::Lua_Start},
    {"Stop", FGatrixLuaBindings::Lua_Stop},
    // Context
    {"UpdateContext", FGatrixLuaBindings::Lua_UpdateContext},
    {"GetContext", FGatrixLuaBindings::Lua_GetContext},
    // Events
    {"On", FGatrixLuaBindings::Lua_On},
    {"Off", FGatrixLuaBindings::Lua_Off},
    {"Once", FGatrixLuaBindings::Lua_Once},
    {"OnAny", FGatrixLuaBindings::Lua_OnAny},
    {"OffAny", FGatrixLuaBindings::Lua_OffAny},
    {nullptr, nullptr}};

// Feature flag functions: gatrix.Features.*
static const struct luaL_Reg GatrixFeaturesFunctions[] = {
    // Flag access
    {"IsEnabled", FGatrixLuaBindings::Lua_IsEnabled},
    {"GetFlag", FGatrixLuaBindings::Lua_GetFlag},
    {"Variation", FGatrixLuaBindings::Lua_Variation},
    {"BoolVariation", FGatrixLuaBindings::Lua_BoolVariation},
    {"StringVariation", FGatrixLuaBindings::Lua_StringVariation},
    {"IntVariation", FGatrixLuaBindings::Lua_IntVariation},
    {"FloatVariation", FGatrixLuaBindings::Lua_FloatVariation},
    {"GetVariant", FGatrixLuaBindings::Lua_GetVariant},
    {"GetAllFlags", FGatrixLuaBindings::Lua_GetAllFlags},
    {"HasFlag", FGatrixLuaBindings::Lua_HasFlag},
    // Details (value + reason)
    {"BoolVariationDetails", FGatrixLuaBindings::Lua_BoolVariationDetails},
    {"StringVariationDetails", FGatrixLuaBindings::Lua_StringVariationDetails},
    {"IntVariationDetails", FGatrixLuaBindings::Lua_IntVariationDetails},
    {"FloatVariationDetails", FGatrixLuaBindings::Lua_FloatVariationDetails},
    // OrThrow (raises Lua error on failure)
    {"BoolVariationOrThrow", FGatrixLuaBindings::Lua_BoolVariationOrThrow},
    {"StringVariationOrThrow", FGatrixLuaBindings::Lua_StringVariationOrThrow},
    {"IntVariationOrThrow", FGatrixLuaBindings::Lua_IntVariationOrThrow},
    {"FloatVariationOrThrow", FGatrixLuaBindings::Lua_FloatVariationOrThrow},
    // Watch
    {"WatchRealtimeFlag", FGatrixLuaBindings::Lua_WatchRealtimeFlag},
    {"WatchSyncedFlag", FGatrixLuaBindings::Lua_WatchSyncedFlag},
    {"WatchRealtimeFlagWithInitialState",
     FGatrixLuaBindings::Lua_WatchRealtimeFlagWithInitialState},
    {"WatchSyncedFlagWithInitialState",
     FGatrixLuaBindings::Lua_WatchSyncedFlagWithInitialState},
    {"UnwatchFlag", FGatrixLuaBindings::Lua_UnwatchFlag},
    {"CreateWatchGroup", FGatrixLuaBindings::Lua_CreateWatchGroup},
    // State
    {"IsReady", FGatrixLuaBindings::Lua_IsReady},
    {"IsInitialized", FGatrixLuaBindings::Lua_IsInitialized},
    // Sync
    {"FetchFlags", FGatrixLuaBindings::Lua_FetchFlags},
    {"SyncFlags", FGatrixLuaBindings::Lua_SyncFlags},
    {nullptr, nullptr}};

void FGatrixLuaBindings::Register(lua_State *L) {
  if (!L) {
    UE_LOG(LogGatrixLua, Error, TEXT("Register called with null lua_State"));
    return;
  }

  // Create session with alive flag
  FLuaSession &Session = SessionRegistry.FindOrAdd(L);
  Session.bAlive = MakeShared<bool>(true);
  Session.Callbacks.Empty();

  // Create the "gatrix" root table with lifecycle/event functions
  luaL_newlib(L, GatrixRootFunctions);

  // Create "Features" sub-table with feature flag functions
  luaL_newlib(L, GatrixFeaturesFunctions);
  lua_setfield(L, -2, "Features");

  // Set as global
  lua_setglobal(L, "gatrix");

  // Also register as a loadable module for require("gatrix")
  // LuaJIT is Lua 5.1 based — use package.loaded directly instead of
  // luaL_getsubtable/LUA_LOADED_TABLE which are Lua 5.2+ only
  lua_getglobal(L, "package");
  if (lua_istable(L, -1)) {
    lua_getfield(L, -1, "loaded");
    if (lua_istable(L, -1)) {
      lua_getglobal(L, "gatrix");
      lua_setfield(L, -2, "gatrix");
    }
    lua_pop(L, 1); // pop loaded
  }
  lua_pop(L, 1); // pop package

  UE_LOG(LogGatrixLua, Log, TEXT("Registered into Lua state %p"), L);
}

void FGatrixLuaBindings::Unregister(lua_State *L) {
  if (!L) {
    return;
  }

  RemoveAllCallbacks(L);

  UE_LOG(LogGatrixLua, Log, TEXT("Unregistered from Lua state %p"), L);
}

// ==================== Session Helpers ====================

TSharedPtr<bool> FGatrixLuaBindings::GetAliveFlag(lua_State *L) {
  FLuaSession *Session = SessionRegistry.Find(L);
  if (Session) {
    return Session->bAlive;
  }
  return nullptr;
}

// ==================== Value Helpers ====================

FString FGatrixLuaBindings::SafeToString(lua_State *L, int Index) {
  int AbsIndex = (Index > 0) ? Index : lua_gettop(L) + Index + 1;

  if (lua_isuserdata(L, AbsIndex)) {
    // For userdata, call tostring() to get a meaningful string representation
    lua_getglobal(L, "tostring");
    lua_pushvalue(L, AbsIndex);
    if (lua_pcall(L, 1, 1, 0) == LUA_OK) {
      const char *Str = lua_tostring(L, -1);
      FString Result = Str ? UTF8_TO_TCHAR(Str) : FString();
      lua_pop(L, 1);
      return Result;
    } else {
      lua_pop(L, 1); // pop error
      return FString();
    }
  }

  if (lua_isnil(L, AbsIndex)) {
    return FString();
  }

  if (lua_isboolean(L, AbsIndex)) {
    return lua_toboolean(L, AbsIndex) ? TEXT("true") : TEXT("false");
  }

  const char *Str = lua_tostring(L, AbsIndex);
  return Str ? UTF8_TO_TCHAR(Str) : FString();
}

// FGatrixVariant: { Name, Enabled, Value }
// Value is pushed as native Lua type based on ValueType:
//   String/Json → lua_pushstring
//   Number      → lua_pushnumber
//   Boolean     → lua_pushboolean
//   None        → lua_pushstring (fallback)
void FGatrixLuaBindings::PushVariantTable(lua_State *L,
                                          const FGatrixVariant &Variant,
                                          EGatrixValueType ValueType) {
  lua_createtable(L, 0, 3);

  lua_pushstring(L, TCHAR_TO_UTF8(*Variant.Name));
  lua_setfield(L, -2, "Name");

  lua_pushboolean(L, Variant.bEnabled);
  lua_setfield(L, -2, "Enabled");

  // Push Value as native Lua type based on ValueType
  switch (ValueType) {
  case EGatrixValueType::Boolean:
    lua_pushboolean(
        L, Variant.Value.Equals(TEXT("true"), ESearchCase::IgnoreCase));
    break;
  case EGatrixValueType::Number: {
    double NumVal = FCString::Atod(*Variant.Value);
    lua_pushnumber(L, NumVal);
    break;
  }
  case EGatrixValueType::String:
  case EGatrixValueType::Json:
  default:
    lua_pushstring(L, TCHAR_TO_UTF8(*Variant.Value));
    break;
  }
  lua_setfield(L, -2, "Value");
}

// FGatrixEvaluatedFlag: { Name, bEnabled, Variant{}, ValueType, Version,
// Reason, bImpressionData }
void FGatrixLuaBindings::PushEvaluatedFlagTable(
    lua_State *L, const FGatrixEvaluatedFlag &Flag) {
  lua_createtable(L, 0, 7);

  lua_pushstring(L, TCHAR_TO_UTF8(*Flag.Name));
  lua_setfield(L, -2, "Name");

  lua_pushboolean(L, Flag.bEnabled);
  lua_setfield(L, -2, "Enabled");

  // Variant as sub-table
  PushVariantTable(L, Flag.Variant, Flag.ValueType);
  lua_setfield(L, -2, "Variant");

  lua_pushinteger(L, static_cast<int>(Flag.ValueType));
  lua_setfield(L, -2, "ValueType");

  lua_pushinteger(L, Flag.Version);
  lua_setfield(L, -2, "Version");

  lua_pushstring(L, TCHAR_TO_UTF8(*Flag.Reason));
  lua_setfield(L, -2, "Reason");

  lua_pushboolean(L, Flag.bImpressionData);
  lua_setfield(L, -2, "ImpressionData");
}

// FGatrixContext: { AppName, Environment, UserId, SessionId, CurrentTime,
// Properties }
void FGatrixLuaBindings::PushContextTable(lua_State *L,
                                          const FGatrixContext &Context) {
  lua_createtable(L, 0, 6);

  lua_pushstring(L, TCHAR_TO_UTF8(*Context.AppName));
  lua_setfield(L, -2, "AppName");

  lua_pushstring(L, TCHAR_TO_UTF8(*Context.Environment));
  lua_setfield(L, -2, "Environment");

  lua_pushstring(L, TCHAR_TO_UTF8(*Context.UserId));
  lua_setfield(L, -2, "UserId");

  lua_pushstring(L, TCHAR_TO_UTF8(*Context.SessionId));
  lua_setfield(L, -2, "SessionId");

  lua_pushstring(L, TCHAR_TO_UTF8(*Context.CurrentTime));
  lua_setfield(L, -2, "CurrentTime");

  // Push custom properties as a sub-table
  if (Context.Properties.Num() > 0) {
    lua_createtable(L, 0, Context.Properties.Num());
    for (const auto &Pair : Context.Properties) {
      lua_pushstring(L, TCHAR_TO_UTF8(*Pair.Value));
      lua_setfield(L, -2, TCHAR_TO_UTF8(*Pair.Key));
    }
    lua_setfield(L, -2, "Properties");
  }
}

void FGatrixLuaBindings::PushFlagProxyTable(lua_State *L,
                                            UGatrixFlagProxy *Proxy) {
  if (!Proxy) {
    lua_pushnil(L);
    return;
  }

  lua_createtable(L, 0, 8);

  lua_pushstring(L, TCHAR_TO_UTF8(*Proxy->GetName()));
  lua_setfield(L, -2, "Name");

  lua_pushboolean(L, Proxy->IsEnabled());
  lua_setfield(L, -2, "Enabled");

  lua_pushboolean(L, Proxy->Exists());
  lua_setfield(L, -2, "Exists");

  lua_pushboolean(L, Proxy->IsRealtime());
  lua_setfield(L, -2, "Realtime");

  FGatrixVariant Variant = Proxy->GetVariant();
  PushVariantTable(L, Variant, Proxy->GetValueType());
  lua_setfield(L, -2, "Variant");

  lua_pushinteger(L, static_cast<int>(Proxy->GetValueType()));
  lua_setfield(L, -2, "ValueType");

  lua_pushinteger(L, Proxy->GetVersion());
  lua_setfield(L, -2, "Version");

  lua_pushstring(L, TCHAR_TO_UTF8(*Proxy->GetReason()));
  lua_setfield(L, -2, "Reason");
}

FGatrixContext FGatrixLuaBindings::ReadContextFromTable(lua_State *L,
                                                        int Index) {
  FGatrixContext Ctx;
  int AbsIndex = (Index > 0) ? Index : lua_gettop(L) + Index + 1;

  if (!lua_istable(L, AbsIndex)) {
    luaL_error(L, "gatrix.UpdateContext: expected a table argument");
    return Ctx;
  }

  // Read known fields (use SafeToString so userdata gets converted)
  lua_getfield(L, AbsIndex, "AppName");
  if (!lua_isnil(L, -1))
    Ctx.AppName = SafeToString(L, -1);
  lua_pop(L, 1);

  lua_getfield(L, AbsIndex, "Environment");
  if (!lua_isnil(L, -1))
    Ctx.Environment = SafeToString(L, -1);
  lua_pop(L, 1);

  lua_getfield(L, AbsIndex, "UserId");
  if (!lua_isnil(L, -1))
    Ctx.UserId = SafeToString(L, -1);
  lua_pop(L, 1);

  lua_getfield(L, AbsIndex, "SessionId");
  if (!lua_isnil(L, -1))
    Ctx.SessionId = SafeToString(L, -1);
  lua_pop(L, 1);

  lua_getfield(L, AbsIndex, "CurrentTime");
  if (!lua_isnil(L, -1))
    Ctx.CurrentTime = SafeToString(L, -1);
  lua_pop(L, 1);

  // Read custom properties sub-table
  lua_getfield(L, AbsIndex, "Properties");
  if (lua_istable(L, -1)) {
    lua_pushnil(L);
    while (lua_next(L, -2) != 0) {
      FString Key = SafeToString(L, -2);
      FString Value = SafeToString(L, -1);
      if (!Key.IsEmpty()) {
        Ctx.Properties.Add(Key, Value);
      }
      lua_pop(L, 1); // pop value, keep key for next iteration
    }
  }
  lua_pop(L, 1); // pop properties table or nil

  return Ctx;
}

// ==================== Callback Management ====================

void FGatrixLuaBindings::RemoveCallback(lua_State *L, int32 Handle) {
  FLuaSession *Session = SessionRegistry.Find(L);
  if (!Session) {
    return;
  }

  for (int32 i = Session->Callbacks.Num() - 1; i >= 0; --i) {
    if (Session->Callbacks[i].Handle == Handle) {
      // Release the Lua function reference
      luaL_unref(L, LUA_REGISTRYINDEX, Session->Callbacks[i].LuaRef);
      Session->Callbacks.RemoveAt(i);
      break;
    }
  }
}

void FGatrixLuaBindings::RemoveAllCallbacks(lua_State *L) {
  FLuaSession *Session = SessionRegistry.Find(L);
  if (!Session) {
    return;
  }

  // Invalidate alive flag FIRST — any in-flight callbacks will see this
  // and skip lua_State* access, preventing dangling pointer crashes
  if (Session->bAlive.IsValid()) {
    *Session->bAlive = false;
  }

  UGatrixClient *Client = UGatrixClient::Get();
  for (const FCallbackEntry &Entry : Session->Callbacks) {
    if (Client) {
      if (Entry.bIsWatch) {
        Client->GetFeatures()->UnwatchFlag(Entry.Handle);
      } else if (Entry.bIsAny) {
        Client->OffAny(Entry.Handle);
      } else {
        Client->Off(Entry.Handle);
      }
    }
    // Release the Lua function reference
    luaL_unref(L, LUA_REGISTRYINDEX, Entry.LuaRef);
  }

  SessionRegistry.Remove(L);
}

// ==================== Deferred Helper ====================

// Create a Lua deferred object by calling `deferred.new()`.
// Returns the registry ref to the deferred table, or LUA_NOREF on failure.
// The deferred table is left on top of the Lua stack.
static int CreateDeferred(lua_State *L) {
  lua_getglobal(L, "deferred");
  if (!lua_istable(L, -1)) {
    lua_pop(L, 1);
    UE_LOG(LogGatrixLua, Warning, TEXT("'deferred' module not available"));
    return LUA_NOREF;
  }
  lua_getfield(L, -1, "new");
  if (!lua_isfunction(L, -1)) {
    lua_pop(L, 2);
    UE_LOG(LogGatrixLua, Warning, TEXT("'deferred.new' not found"));
    return LUA_NOREF;
  }
  lua_remove(L, -2); // remove deferred table, keep deferred.new function
  if (lua_pcall(L, 0, 1, 0) != LUA_OK) {
    const char *Err = lua_tostring(L, -1);
    UE_LOG(LogGatrixLua, Error, TEXT("deferred.new() failed: %s"),
           Err ? UTF8_TO_TCHAR(Err) : TEXT("unknown"));
    lua_pop(L, 1);
    return LUA_NOREF;
  }
  // Deferred table is now on top of stack.
  // Create a reference so we can access it from callbacks.
  lua_pushvalue(L, -1);
  int DeferredRef = luaL_ref(L, LUA_REGISTRYINDEX);
  return DeferredRef;
}

// Resolve a deferred by its registry ref: d:resolve(...)
// nArgs values should be on top of the stack before calling.
static void ResolveDeferred(lua_State *L, int DeferredRef, int nArgs = 0) {
  if (DeferredRef == LUA_NOREF)
    return;

  lua_rawgeti(L, LUA_REGISTRYINDEX, DeferredRef);
  if (!lua_istable(L, -1)) {
    lua_pop(L, 1 + nArgs);
    luaL_unref(L, LUA_REGISTRYINDEX, DeferredRef);
    return;
  }
  lua_getfield(L, -1, "resolve");
  lua_pushvalue(L, -2); // self
  // Move args if any
  if (nArgs > 0) {
    // Args are below the deferred table and resolve function
    // Stack: [args...] [deferred] [resolve] [self]
    // We need to move args after self
    for (int i = 0; i < nArgs; ++i) {
      lua_pushvalue(L, -(3 + nArgs) + i);
    }
  }
  if (lua_pcall(L, 1 + nArgs, 0, 0) != LUA_OK) {
    const char *Err = lua_tostring(L, -1);
    UE_LOG(LogGatrixLua, Error, TEXT("deferred:resolve() failed: %s"),
           Err ? UTF8_TO_TCHAR(Err) : TEXT("unknown"));
    lua_pop(L, 1);
  }
  lua_pop(L, 1); // pop deferred table
  if (nArgs > 0) {
    lua_pop(L, nArgs); // pop original args
  }
  luaL_unref(L, LUA_REGISTRYINDEX, DeferredRef);
}

// Reject a deferred by its registry ref: d:reject(errorMsg)
static void RejectDeferred(lua_State *L, int DeferredRef,
                           const char *ErrorMsg = nullptr) {
  if (DeferredRef == LUA_NOREF)
    return;

  lua_rawgeti(L, LUA_REGISTRYINDEX, DeferredRef);
  if (!lua_istable(L, -1)) {
    lua_pop(L, 1);
    luaL_unref(L, LUA_REGISTRYINDEX, DeferredRef);
    return;
  }
  lua_getfield(L, -1, "reject");
  lua_pushvalue(L, -2); // self
  if (ErrorMsg) {
    lua_pushstring(L, ErrorMsg);
  }
  if (lua_pcall(L, ErrorMsg ? 2 : 1, 0, 0) != LUA_OK) {
    const char *Err = lua_tostring(L, -1);
    UE_LOG(LogGatrixLua, Error, TEXT("deferred:reject() failed: %s"),
           Err ? UTF8_TO_TCHAR(Err) : TEXT("unknown"));
    lua_pop(L, 1);
  }
  lua_pop(L, 1); // pop deferred table
  luaL_unref(L, LUA_REGISTRYINDEX, DeferredRef);
}

// ==================== Lifecycle ====================

int FGatrixLuaBindings::Lua_Init(lua_State *L) {
  luaL_checktype(L, 1, LUA_TTABLE);

  FGatrixClientConfig Config;

  // Required fields
  lua_getfield(L, 1, "ApiUrl");
  Config.ApiUrl = UTF8_TO_TCHAR(luaL_checkstring(L, -1));
  lua_pop(L, 1);

  lua_getfield(L, 1, "ApiToken");
  Config.ApiToken = UTF8_TO_TCHAR(luaL_checkstring(L, -1));
  lua_pop(L, 1);

  lua_getfield(L, 1, "AppName");
  Config.AppName = UTF8_TO_TCHAR(luaL_checkstring(L, -1));
  lua_pop(L, 1);

  lua_getfield(L, 1, "Environment");
  Config.Environment = UTF8_TO_TCHAR(luaL_checkstring(L, -1));
  lua_pop(L, 1);

  // Optional fields
  lua_getfield(L, 1, "RefreshInterval");
  if (lua_isnumber(L, -1)) {
    Config.Features.RefreshInterval = static_cast<float>(lua_tonumber(L, -1));
  }
  lua_pop(L, 1);

  lua_getfield(L, 1, "DisableRefresh");
  if (lua_isboolean(L, -1)) {
    Config.Features.bDisableRefresh = (lua_toboolean(L, -1) != 0);
  }
  lua_pop(L, 1);

  lua_getfield(L, 1, "EnableDevMode");
  if (lua_isboolean(L, -1)) {
    Config.bEnableDevMode = (lua_toboolean(L, -1) != 0);
  }
  lua_pop(L, 1);

  lua_getfield(L, 1, "ExplicitSyncMode");
  if (lua_isboolean(L, -1)) {
    Config.Features.bExplicitSyncMode = (lua_toboolean(L, -1) != 0);
  }
  lua_pop(L, 1);

  lua_getfield(L, 1, "DisableMetrics");
  if (lua_isboolean(L, -1)) {
    Config.Features.bDisableMetrics = (lua_toboolean(L, -1) != 0);
  }
  lua_pop(L, 1);

  lua_getfield(L, 1, "ImpressionDataAll");
  if (lua_isboolean(L, -1)) {
    Config.Features.bImpressionDataAll = (lua_toboolean(L, -1) != 0);
  }
  lua_pop(L, 1);

  lua_getfield(L, 1, "OfflineMode");
  if (lua_isboolean(L, -1)) {
    Config.bOfflineMode = (lua_toboolean(L, -1) != 0);
  }
  lua_pop(L, 1);

  UGatrixClient::Get()->Init(Config);
  return 0;
}

int FGatrixLuaBindings::Lua_Start(lua_State *L) {
  UGatrixClient *Client = UGatrixClient::Get();

  // Create deferred promise
  int DeferredRef = CreateDeferred(L);
  // Deferred table is on top of stack (will be returned)

  if (DeferredRef == LUA_NOREF) {
    // No deferred available, fallback to synchronous
    Client->Start();
    lua_pushnil(L);
    return 1;
  }

  // If already ready, resolve immediately after Start
  if (Client->IsReady()) {
    Client->Start();
    ResolveDeferred(L, DeferredRef);
    // Return the deferred (still on stack from CreateDeferred)
    return 1;
  }

  // Register one-shot listener for "flags.ready" to resolve
  TSharedPtr<bool> AliveFlag = GetAliveFlag(L);
  lua_State *CapturedL = L;
  int CapturedDeferredRef = DeferredRef;
  TSharedPtr<bool> CapturedAlive = AliveFlag;

  auto HandlePtr = MakeShared<int32>(0);

  int32 GatrixHandle = Client->Once(
      TEXT("flags.ready"), [CapturedL, CapturedDeferredRef, CapturedAlive,
                            HandlePtr](const TArray<FString> &Args) {
        if (!CapturedAlive.IsValid() || !(*CapturedAlive))
          return;
        ResolveDeferred(CapturedL, CapturedDeferredRef);
        RemoveCallback(CapturedL, *HandlePtr);
      });

  *HandlePtr = GatrixHandle;

  FLuaSession *Session = SessionRegistry.Find(L);
  if (Session) {
    Session->Callbacks.Add({GatrixHandle, LUA_NOREF, false, false});
  }

  Client->Start();

  // Return the deferred table (already on stack)
  return 1;
}

int FGatrixLuaBindings::Lua_Stop(lua_State *L) {
  // Clean up all Lua callbacks before stopping
  RemoveAllCallbacks(L);
  UGatrixClient::Get()->Stop();
  return 0;
}

// ==================== Flag Access ====================

int FGatrixLuaBindings::Lua_IsEnabled(lua_State *L) {
  const char *FlagName = luaL_checkstring(L, 1);
  bool bEnabled =
      UGatrixClient::Get()->GetFeatures()->IsEnabled(UTF8_TO_TCHAR(FlagName));
  lua_pushboolean(L, bEnabled);
  return 1;
}

int FGatrixLuaBindings::Lua_GetFlag(lua_State *L) {
  const char *FlagName = luaL_checkstring(L, 1);
  FGatrixEvaluatedFlag Flag =
      UGatrixClient::Get()->GetFeatures()->GetFlag(UTF8_TO_TCHAR(FlagName));
  PushEvaluatedFlagTable(L, Flag);
  return 1;
}

int FGatrixLuaBindings::Lua_BoolVariation(lua_State *L) {
  const char *FlagName = luaL_checkstring(L, 1);
  bool Fallback = (lua_toboolean(L, 2) != 0);
  bool Value = UGatrixClient::Get()->GetFeatures()->BoolVariation(
      UTF8_TO_TCHAR(FlagName), Fallback);
  lua_pushboolean(L, Value);
  return 1;
}

int FGatrixLuaBindings::Lua_StringVariation(lua_State *L) {
  const char *FlagName = luaL_checkstring(L, 1);
  const char *Fallback = luaL_optstring(L, 2, "");
  FString Value = UGatrixClient::Get()->GetFeatures()->StringVariation(
      UTF8_TO_TCHAR(FlagName), UTF8_TO_TCHAR(Fallback));
  lua_pushstring(L, TCHAR_TO_UTF8(*Value));
  return 1;
}

int FGatrixLuaBindings::Lua_IntVariation(lua_State *L) {
  const char *FlagName = luaL_checkstring(L, 1);
  int32 Fallback = static_cast<int32>(luaL_optinteger(L, 2, 0));
  int32 Value = UGatrixClient::Get()->GetFeatures()->IntVariation(
      UTF8_TO_TCHAR(FlagName), Fallback);
  lua_pushinteger(L, Value);
  return 1;
}

int FGatrixLuaBindings::Lua_FloatVariation(lua_State *L) {
  const char *FlagName = luaL_checkstring(L, 1);
  float Fallback = static_cast<float>(luaL_optnumber(L, 2, 0.0));
  float Value = UGatrixClient::Get()->GetFeatures()->FloatVariation(
      UTF8_TO_TCHAR(FlagName), Fallback);
  lua_pushnumber(L, Value);
  return 1;
}

// Variation — returns variant name as string
int FGatrixLuaBindings::Lua_Variation(lua_State *L) {
  const char *FlagName = luaL_checkstring(L, 1);
  const char *Fallback = luaL_optstring(L, 2, "");
  FString Value = UGatrixClient::Get()->GetFeatures()->Variation(
      UTF8_TO_TCHAR(FlagName), UTF8_TO_TCHAR(Fallback));
  lua_pushstring(L, TCHAR_TO_UTF8(*Value));
  return 1;
}

// Helper: push FGatrixVariationResult as a Lua table
static void PushVariationResultTable(lua_State *L,
                                     const FGatrixVariationResult &Result) {
  lua_createtable(L, 0, 4);

  lua_pushstring(L, TCHAR_TO_UTF8(*Result.Value));
  lua_setfield(L, -2, "Value");

  lua_pushstring(L, TCHAR_TO_UTF8(*Result.Reason));
  lua_setfield(L, -2, "Reason");

  lua_pushboolean(L, Result.bFlagExists);
  lua_setfield(L, -2, "FlagExists");

  lua_pushboolean(L, Result.bEnabled);
  lua_setfield(L, -2, "Enabled");
}

// ==================== Variation Details ====================

int FGatrixLuaBindings::Lua_BoolVariationDetails(lua_State *L) {
  const char *FlagName = luaL_checkstring(L, 1);
  bool Fallback = (lua_toboolean(L, 2) != 0);
  FGatrixVariationResult Result =
      UGatrixClient::Get()->GetFeatures()->BoolVariationDetails(
          UTF8_TO_TCHAR(FlagName), Fallback);
  PushVariationResultTable(L, Result);
  return 1;
}

int FGatrixLuaBindings::Lua_StringVariationDetails(lua_State *L) {
  const char *FlagName = luaL_checkstring(L, 1);
  const char *Fallback = luaL_optstring(L, 2, "");
  FGatrixVariationResult Result =
      UGatrixClient::Get()->GetFeatures()->StringVariationDetails(
          UTF8_TO_TCHAR(FlagName), UTF8_TO_TCHAR(Fallback));
  PushVariationResultTable(L, Result);
  return 1;
}

int FGatrixLuaBindings::Lua_IntVariationDetails(lua_State *L) {
  const char *FlagName = luaL_checkstring(L, 1);
  int32 Fallback = static_cast<int32>(luaL_optinteger(L, 2, 0));
  FGatrixVariationResult Result =
      UGatrixClient::Get()->GetFeatures()->IntVariationDetails(
          UTF8_TO_TCHAR(FlagName), Fallback);
  PushVariationResultTable(L, Result);
  return 1;
}

int FGatrixLuaBindings::Lua_FloatVariationDetails(lua_State *L) {
  const char *FlagName = luaL_checkstring(L, 1);
  float Fallback = static_cast<float>(luaL_optnumber(L, 2, 0.0));
  FGatrixVariationResult Result =
      UGatrixClient::Get()->GetFeatures()->FloatVariationDetails(
          UTF8_TO_TCHAR(FlagName), Fallback);
  PushVariationResultTable(L, Result);
  return 1;
}

// ==================== Variation OrThrow ====================

int FGatrixLuaBindings::Lua_BoolVariationOrThrow(lua_State *L) {
  const char *FlagName = luaL_checkstring(L, 1);
  try {
    bool Value = UGatrixClient::Get()->GetFeatures()->BoolVariationOrThrow(
        UTF8_TO_TCHAR(FlagName));
    lua_pushboolean(L, Value);
    return 1;
  } catch (const std::exception &e) {
    return luaL_error(L, "BoolVariationOrThrow(%s): %s", FlagName, e.what());
  }
}

int FGatrixLuaBindings::Lua_StringVariationOrThrow(lua_State *L) {
  const char *FlagName = luaL_checkstring(L, 1);
  try {
    FString Value = UGatrixClient::Get()->GetFeatures()->StringVariationOrThrow(
        UTF8_TO_TCHAR(FlagName));
    lua_pushstring(L, TCHAR_TO_UTF8(*Value));
    return 1;
  } catch (const std::exception &e) {
    return luaL_error(L, "StringVariationOrThrow(%s): %s", FlagName, e.what());
  }
}

int FGatrixLuaBindings::Lua_IntVariationOrThrow(lua_State *L) {
  const char *FlagName = luaL_checkstring(L, 1);
  try {
    int32 Value = UGatrixClient::Get()->GetFeatures()->IntVariationOrThrow(
        UTF8_TO_TCHAR(FlagName));
    lua_pushinteger(L, Value);
    return 1;
  } catch (const std::exception &e) {
    return luaL_error(L, "IntVariationOrThrow(%s): %s", FlagName, e.what());
  }
}

int FGatrixLuaBindings::Lua_FloatVariationOrThrow(lua_State *L) {
  const char *FlagName = luaL_checkstring(L, 1);
  try {
    float Value = UGatrixClient::Get()->GetFeatures()->FloatVariationOrThrow(
        UTF8_TO_TCHAR(FlagName));
    lua_pushnumber(L, Value);
    return 1;
  } catch (const std::exception &e) {
    return luaL_error(L, "FloatVariationOrThrow(%s): %s", FlagName, e.what());
  }
}

int FGatrixLuaBindings::Lua_GetVariant(lua_State *L) {
  const char *FlagName = luaL_checkstring(L, 1);
  FString FlagStr = UTF8_TO_TCHAR(FlagName);
  FGatrixVariant Variant =
      UGatrixClient::Get()->GetFeatures()->GetVariant(FlagStr);
  // Get ValueType from the flag to push Value as native Lua type
  EGatrixValueType ValType =
      UGatrixClient::Get()->GetFeatures()->GetValueTypeInternal(FlagStr, false);
  PushVariantTable(L, Variant, ValType);
  return 1;
}

int FGatrixLuaBindings::Lua_GetAllFlags(lua_State *L) {
  TArray<FGatrixEvaluatedFlag> Flags =
      UGatrixClient::Get()->GetFeatures()->GetAllFlags();

  lua_createtable(L, Flags.Num(), 0);
  for (int32 i = 0; i < Flags.Num(); ++i) {
    PushEvaluatedFlagTable(L, Flags[i]);
    lua_rawseti(L, -2, i + 1); // Lua arrays are 1-indexed
  }
  return 1;
}

int FGatrixLuaBindings::Lua_HasFlag(lua_State *L) {
  const char *FlagName = luaL_checkstring(L, 1);
  bool bExists =
      UGatrixClient::Get()->GetFeatures()->HasFlag(UTF8_TO_TCHAR(FlagName));
  lua_pushboolean(L, bExists);
  return 1;
}

// ==================== Context ====================

int FGatrixLuaBindings::Lua_UpdateContext(lua_State *L) {
  luaL_checktype(L, 1, LUA_TTABLE);
  FGatrixContext Ctx = ReadContextFromTable(L, 1);

  // Create deferred promise
  int DeferredRef = CreateDeferred(L);
  if (DeferredRef == LUA_NOREF) {
    // 'deferred' module unavailable — fire and forget
    UGatrixClient::Get()->UpdateContext(Ctx);
    lua_pushnil(L);
    return 1;
  }

  TSharedPtr<bool> AliveFlag = GetAliveFlag(L);
  lua_State *CapturedL = L;
  int CapturedRef = DeferredRef;
  TSharedPtr<bool> CapturedAlive = AliveFlag;

  // Pass a native C++ completion callback to UpdateContext.
  // The callback is guaranteed to be called on the game thread once the
  // resulting FetchFlags completes (or immediately when offline/not started).
  // We do NOT touch any lock here — all paths are game-thread-only.
  UGatrixClient::Get()->UpdateContext(
      Ctx, [CapturedL, CapturedRef, CapturedAlive](bool bSuccess,
                                                   const FString &ErrorMsg) {
        // Safety: check that the Lua state is still alive
        if (!CapturedAlive.IsValid() || !(*CapturedAlive)) {
          return;
        }

        if (bSuccess) {
          ResolveDeferred(CapturedL, CapturedRef);
        } else {
          RejectDeferred(CapturedL, CapturedRef, TCHAR_TO_UTF8(*ErrorMsg));
        }
      });

  // Return the deferred table (already on stack from CreateDeferred)
  return 1;
}

int FGatrixLuaBindings::Lua_GetContext(lua_State *L) {
  FGatrixContext Ctx = UGatrixClient::Get()->GetContext();
  PushContextTable(L, Ctx);
  return 1;
}

// ==================== Events ====================

int FGatrixLuaBindings::Lua_On(lua_State *L) {
  const char *EventName = luaL_checkstring(L, 1);
  luaL_checktype(L, 2, LUA_TFUNCTION);

  // Store a reference to the Lua function in the registry
  lua_pushvalue(L, 2);
  int LuaRef = luaL_ref(L, LUA_REGISTRYINDEX);

  // Get alive flag for safe callback invocation
  TSharedPtr<bool> AliveFlag = GetAliveFlag(L);
  if (!AliveFlag.IsValid()) {
    luaL_unref(L, LUA_REGISTRYINDEX, LuaRef);
    return luaL_error(
        L, "gatrix.Features.On: module not registered (call Register first)");
  }

  // Capture alive flag (shared ptr copy) and lua_State for the callback.
  // The alive flag is checked before every lua_State access.
  lua_State *CapturedL = L;
  int CapturedRef = LuaRef;
  TSharedPtr<bool> CapturedAlive = AliveFlag;

  int32 GatrixHandle = UGatrixClient::Get()->On(
      UTF8_TO_TCHAR(EventName),
      [CapturedL, CapturedRef, CapturedAlive](const TArray<FString> &Args) {
        // CRITICAL: check alive flag before touching lua_State
        if (!CapturedAlive.IsValid() || !(*CapturedAlive)) {
          return;
        }

        // Push the stored callback function
        lua_rawgeti(CapturedL, LUA_REGISTRYINDEX, CapturedRef);
        if (!lua_isfunction(CapturedL, -1)) {
          lua_pop(CapturedL, 1);
          return;
        }

        // Push args as a table
        lua_createtable(CapturedL, Args.Num(), 0);
        for (int32 i = 0; i < Args.Num(); ++i) {
          lua_pushstring(CapturedL, TCHAR_TO_UTF8(*Args[i]));
          lua_rawseti(CapturedL, -2, i + 1);
        }

        // Call the Lua function with 1 argument (the args table)
        if (lua_pcall(CapturedL, 1, 0, 0) != LUA_OK) {
          const char *Err = lua_tostring(CapturedL, -1);
          UE_LOG(LogGatrixLua, Error, TEXT("On callback error: %s"),
                 Err ? UTF8_TO_TCHAR(Err) : TEXT("unknown"));
          lua_pop(CapturedL, 1);
        }
      });

  // Track the callback for cleanup
  FLuaSession *Session = SessionRegistry.Find(L);
  if (Session) {
    Session->Callbacks.Add({GatrixHandle, LuaRef, false, false});
  }

  lua_pushinteger(L, GatrixHandle);
  return 1;
}

int FGatrixLuaBindings::Lua_Off(lua_State *L) {
  int32 Handle = static_cast<int32>(luaL_checkinteger(L, 1));

  // Unsubscribe from Gatrix
  UGatrixClient::Get()->Off(Handle);

  // Release the Lua reference
  RemoveCallback(L, Handle);

  return 0;
}

int FGatrixLuaBindings::Lua_Once(lua_State *L) {
  const char *EventName = luaL_checkstring(L, 1);
  luaL_checktype(L, 2, LUA_TFUNCTION);

  // Store a reference to the Lua function
  lua_pushvalue(L, 2);
  int LuaRef = luaL_ref(L, LUA_REGISTRYINDEX);

  TSharedPtr<bool> AliveFlag = GetAliveFlag(L);
  if (!AliveFlag.IsValid()) {
    luaL_unref(L, LUA_REGISTRYINDEX, LuaRef);
    return luaL_error(
        L, "gatrix.Once: module not registered (call Register first)");
  }

  lua_State *CapturedL = L;
  int CapturedRef = LuaRef;
  TSharedPtr<bool> CapturedAlive = AliveFlag;

  // Use shared pointer to store the handle for self-cleanup
  auto HandlePtr = MakeShared<int32>(0);

  int32 GatrixHandle = UGatrixClient::Get()->Once(
      UTF8_TO_TCHAR(EventName), [CapturedL, CapturedRef, CapturedAlive,
                                 HandlePtr](const TArray<FString> &Args) {
        // CRITICAL: check alive flag before touching lua_State
        if (!CapturedAlive.IsValid() || !(*CapturedAlive)) {
          return;
        }

        // Push the stored callback function
        lua_rawgeti(CapturedL, LUA_REGISTRYINDEX, CapturedRef);
        if (!lua_isfunction(CapturedL, -1)) {
          lua_pop(CapturedL, 1);
          RemoveCallback(CapturedL, *HandlePtr);
          return;
        }

        // Push args as a table
        lua_createtable(CapturedL, Args.Num(), 0);
        for (int32 i = 0; i < Args.Num(); ++i) {
          lua_pushstring(CapturedL, TCHAR_TO_UTF8(*Args[i]));
          lua_rawseti(CapturedL, -2, i + 1);
        }

        if (lua_pcall(CapturedL, 1, 0, 0) != LUA_OK) {
          const char *Err = lua_tostring(CapturedL, -1);
          UE_LOG(LogGatrixLua, Error, TEXT("Once callback error: %s"),
                 Err ? UTF8_TO_TCHAR(Err) : TEXT("unknown"));
          lua_pop(CapturedL, 1);
        }

        // Clean up: remove from callback registry (also calls luaL_unref)
        RemoveCallback(CapturedL, *HandlePtr);
      });

  *HandlePtr = GatrixHandle;

  // Track the callback
  FLuaSession *Session = SessionRegistry.Find(L);
  if (Session) {
    Session->Callbacks.Add({GatrixHandle, LuaRef, false, false});
  }

  lua_pushinteger(L, GatrixHandle);
  return 1;
}

// ==================== Watch ====================

int FGatrixLuaBindings::Lua_WatchRealtimeFlag(lua_State *L) {
  const char *FlagName = luaL_checkstring(L, 1);
  luaL_checktype(L, 2, LUA_TFUNCTION);

  lua_pushvalue(L, 2);
  int LuaRef = luaL_ref(L, LUA_REGISTRYINDEX);

  TSharedPtr<bool> AliveFlag = GetAliveFlag(L);
  if (!AliveFlag.IsValid()) {
    luaL_unref(L, LUA_REGISTRYINDEX, LuaRef);
    return luaL_error(
        L, "gatrix.Features.WatchRealtimeFlag: module not registered");
  }

  lua_State *CapturedL = L;
  int CapturedRef = LuaRef;
  TSharedPtr<bool> CapturedAlive = AliveFlag;

  FGatrixFlagWatchDelegate Delegate;
  Delegate.BindLambda([CapturedL, CapturedRef,
                       CapturedAlive](UGatrixFlagProxy *Proxy) {
    // CRITICAL: check alive flag before touching lua_State
    if (!CapturedAlive.IsValid() || !(*CapturedAlive)) {
      return;
    }

    lua_rawgeti(CapturedL, LUA_REGISTRYINDEX, CapturedRef);
    if (!lua_isfunction(CapturedL, -1)) {
      lua_pop(CapturedL, 1);
      return;
    }

    // Push FlagProxy as a Lua table
    PushFlagProxyTable(CapturedL, Proxy);

    if (lua_pcall(CapturedL, 1, 0, 0) != LUA_OK) {
      const char *Err = lua_tostring(CapturedL, -1);
      UE_LOG(LogGatrixLua, Error, TEXT("WatchRealtimeFlag callback error: %s"),
             Err ? UTF8_TO_TCHAR(Err) : TEXT("unknown"));
      lua_pop(CapturedL, 1);
    }
  });

  int32 Handle = UGatrixClient::Get()->GetFeatures()->WatchRealtimeFlag(
      UTF8_TO_TCHAR(FlagName), Delegate);

  FLuaSession *Session = SessionRegistry.Find(L);
  if (Session) {
    Session->Callbacks.Add({Handle, LuaRef, true, false});
  }

  lua_pushinteger(L, Handle);
  return 1;
}

int FGatrixLuaBindings::Lua_WatchSyncedFlag(lua_State *L) {
  const char *FlagName = luaL_checkstring(L, 1);
  luaL_checktype(L, 2, LUA_TFUNCTION);

  lua_pushvalue(L, 2);
  int LuaRef = luaL_ref(L, LUA_REGISTRYINDEX);

  TSharedPtr<bool> AliveFlag = GetAliveFlag(L);
  if (!AliveFlag.IsValid()) {
    luaL_unref(L, LUA_REGISTRYINDEX, LuaRef);
    return luaL_error(L,
                      "gatrix.Features.WatchSyncedFlag: module not registered");
  }

  lua_State *CapturedL = L;
  int CapturedRef = LuaRef;
  TSharedPtr<bool> CapturedAlive = AliveFlag;

  FGatrixFlagWatchDelegate Delegate;
  Delegate.BindLambda([CapturedL, CapturedRef,
                       CapturedAlive](UGatrixFlagProxy *Proxy) {
    // CRITICAL: check alive flag before touching lua_State
    if (!CapturedAlive.IsValid() || !(*CapturedAlive)) {
      return;
    }

    lua_rawgeti(CapturedL, LUA_REGISTRYINDEX, CapturedRef);
    if (!lua_isfunction(CapturedL, -1)) {
      lua_pop(CapturedL, 1);
      return;
    }

    PushFlagProxyTable(CapturedL, Proxy);

    if (lua_pcall(CapturedL, 1, 0, 0) != LUA_OK) {
      const char *Err = lua_tostring(CapturedL, -1);
      UE_LOG(LogGatrixLua, Error, TEXT("WatchSyncedFlag callback error: %s"),
             Err ? UTF8_TO_TCHAR(Err) : TEXT("unknown"));
      lua_pop(CapturedL, 1);
    }
  });

  int32 Handle = UGatrixClient::Get()->GetFeatures()->WatchSyncedFlag(
      UTF8_TO_TCHAR(FlagName), Delegate);

  FLuaSession *Session = SessionRegistry.Find(L);
  if (Session) {
    Session->Callbacks.Add({Handle, LuaRef, true, false});
  }

  lua_pushinteger(L, Handle);
  return 1;
}

int FGatrixLuaBindings::Lua_WatchRealtimeFlagWithInitialState(lua_State *L) {
  const char *FlagName = luaL_checkstring(L, 1);
  luaL_checktype(L, 2, LUA_TFUNCTION);

  lua_pushvalue(L, 2);
  int LuaRef = luaL_ref(L, LUA_REGISTRYINDEX);

  TSharedPtr<bool> AliveFlag = GetAliveFlag(L);
  if (!AliveFlag.IsValid()) {
    luaL_unref(L, LUA_REGISTRYINDEX, LuaRef);
    return luaL_error(L, "gatrix.Features.WatchRealtimeFlagWithInitialState: "
                         "module not registered");
  }

  lua_State *CapturedL = L;
  int CapturedRef = LuaRef;
  TSharedPtr<bool> CapturedAlive = AliveFlag;

  FGatrixFlagWatchDelegate Delegate;
  Delegate.BindLambda(
      [CapturedL, CapturedRef, CapturedAlive](UGatrixFlagProxy *Proxy) {
        if (!CapturedAlive.IsValid() || !(*CapturedAlive)) {
          return;
        }

        lua_rawgeti(CapturedL, LUA_REGISTRYINDEX, CapturedRef);
        if (!lua_isfunction(CapturedL, -1)) {
          lua_pop(CapturedL, 1);
          return;
        }

        PushFlagProxyTable(CapturedL, Proxy);

        if (lua_pcall(CapturedL, 1, 0, 0) != LUA_OK) {
          const char *Err = lua_tostring(CapturedL, -1);
          UE_LOG(LogGatrixLua, Error,
                 TEXT("WatchRealtimeFlagWithInitialState "
                      "callback error: %s"),
                 Err ? UTF8_TO_TCHAR(Err) : TEXT("unknown"));
          lua_pop(CapturedL, 1);
        }
      });

  int32 Handle =
      UGatrixClient::Get()->GetFeatures()->WatchRealtimeFlagWithInitialState(
          UTF8_TO_TCHAR(FlagName), Delegate);

  FLuaSession *Session = SessionRegistry.Find(L);
  if (Session) {
    Session->Callbacks.Add({Handle, LuaRef, true, false});
  }

  lua_pushinteger(L, Handle);
  return 1;
}

int FGatrixLuaBindings::Lua_WatchSyncedFlagWithInitialState(lua_State *L) {
  const char *FlagName = luaL_checkstring(L, 1);
  luaL_checktype(L, 2, LUA_TFUNCTION);

  lua_pushvalue(L, 2);
  int LuaRef = luaL_ref(L, LUA_REGISTRYINDEX);

  TSharedPtr<bool> AliveFlag = GetAliveFlag(L);
  if (!AliveFlag.IsValid()) {
    luaL_unref(L, LUA_REGISTRYINDEX, LuaRef);
    return luaL_error(L, "gatrix.Features.WatchSyncedFlagWithInitialState: "
                         "module not registered");
  }

  lua_State *CapturedL = L;
  int CapturedRef = LuaRef;
  TSharedPtr<bool> CapturedAlive = AliveFlag;

  FGatrixFlagWatchDelegate Delegate;
  Delegate.BindLambda(
      [CapturedL, CapturedRef, CapturedAlive](UGatrixFlagProxy *Proxy) {
        if (!CapturedAlive.IsValid() || !(*CapturedAlive)) {
          return;
        }

        lua_rawgeti(CapturedL, LUA_REGISTRYINDEX, CapturedRef);
        if (!lua_isfunction(CapturedL, -1)) {
          lua_pop(CapturedL, 1);
          return;
        }

        PushFlagProxyTable(CapturedL, Proxy);

        if (lua_pcall(CapturedL, 1, 0, 0) != LUA_OK) {
          const char *Err = lua_tostring(CapturedL, -1);
          UE_LOG(LogGatrixLua, Error,
                 TEXT("WatchSyncedFlagWithInitialState "
                      "callback error: %s"),
                 Err ? UTF8_TO_TCHAR(Err) : TEXT("unknown"));
          lua_pop(CapturedL, 1);
        }
      });

  int32 Handle =
      UGatrixClient::Get()->GetFeatures()->WatchSyncedFlagWithInitialState(
          UTF8_TO_TCHAR(FlagName), Delegate);

  FLuaSession *Session = SessionRegistry.Find(L);
  if (Session) {
    Session->Callbacks.Add({Handle, LuaRef, true, false});
  }

  lua_pushinteger(L, Handle);
  return 1;
}

int FGatrixLuaBindings::Lua_UnwatchFlag(lua_State *L) {
  int32 Handle = static_cast<int32>(luaL_checkinteger(L, 1));

  UGatrixClient::Get()->GetFeatures()->UnwatchFlag(Handle);
  RemoveCallback(L, Handle);

  return 0;
}

// ==================== State ====================

int FGatrixLuaBindings::Lua_IsReady(lua_State *L) {
  lua_pushboolean(L, UGatrixClient::Get()->IsReady());
  return 1;
}

int FGatrixLuaBindings::Lua_IsInitialized(lua_State *L) {
  lua_pushboolean(L, UGatrixClient::Get()->IsInitialized());
  return 1;
}

// ==================== Sync ====================

int FGatrixLuaBindings::Lua_FetchFlags(lua_State *L) {
  UGatrixClient *Client = UGatrixClient::Get();

  // Create deferred promise
  int DeferredRef = CreateDeferred(L);

  if (DeferredRef == LUA_NOREF) {
    // No deferred available, fallback to fire-and-forget
    Client->GetFeatures()->FetchFlags();
    lua_pushnil(L);
    return 1;
  }

  TSharedPtr<bool> AliveFlag = GetAliveFlag(L);
  lua_State *CapturedL = L;
  int CapturedDeferredRef = DeferredRef;
  TSharedPtr<bool> CapturedAlive = AliveFlag;

  // Use shared bools to track which event fires first
  auto bResolved = MakeShared<bool>(false);

  auto SuccessHandlePtr = MakeShared<int32>(0);
  auto ErrorHandlePtr = MakeShared<int32>(0);

  // On success: resolve and clean up error listener
  int32 SuccessHandle = Client->Once(
      TEXT("flags.fetch_success"),
      [CapturedL, CapturedDeferredRef, CapturedAlive, bResolved,
       SuccessHandlePtr, ErrorHandlePtr](const TArray<FString> &Args) {
        if (*bResolved)
          return;
        *bResolved = true;
        if (CapturedAlive.IsValid() && *CapturedAlive) {
          ResolveDeferred(CapturedL, CapturedDeferredRef);
          RemoveCallback(CapturedL, *SuccessHandlePtr);
          RemoveCallback(CapturedL, *ErrorHandlePtr);
        }
      });

  // On error: reject and clean up success listener
  int32 ErrorHandle = Client->Once(
      TEXT("flags.fetch_error"),
      [CapturedL, CapturedDeferredRef, CapturedAlive, bResolved,
       SuccessHandlePtr, ErrorHandlePtr](const TArray<FString> &Args) {
        if (*bResolved)
          return;
        *bResolved = true;
        if (CapturedAlive.IsValid() && *CapturedAlive) {
          const char *ErrMsg =
              Args.Num() > 0 ? TCHAR_TO_UTF8(*Args[0]) : "fetch failed";
          RejectDeferred(CapturedL, CapturedDeferredRef, ErrMsg);
          RemoveCallback(CapturedL, *SuccessHandlePtr);
          RemoveCallback(CapturedL, *ErrorHandlePtr);
        }
      });

  *SuccessHandlePtr = SuccessHandle;
  *ErrorHandlePtr = ErrorHandle;

  FLuaSession *Session = SessionRegistry.Find(L);
  if (Session) {
    Session->Callbacks.Add({SuccessHandle, LUA_NOREF, false, false});
    Session->Callbacks.Add({ErrorHandle, LUA_NOREF, false, false});
  }

  Client->GetFeatures()->FetchFlags();

  // Return the deferred table (already on stack)
  return 1;
}

int FGatrixLuaBindings::Lua_SyncFlags(lua_State *L) {
  bool bFetchNow = true;
  if (lua_isboolean(L, 1)) {
    bFetchNow = (lua_toboolean(L, 1) != 0);
  }
  UGatrixClient::Get()->GetFeatures()->SyncFlags(bFetchNow);
  return 0;
}

// ==================== OnAny / OffAny ====================

int FGatrixLuaBindings::Lua_OnAny(lua_State *L) {
  luaL_checktype(L, 1, LUA_TFUNCTION);

  TSharedPtr<bool> CapturedAlive = GetAliveFlag(L);
  if (!CapturedAlive.IsValid()) {
    return luaL_error(L, "gatrix.Features.OnAny: Lua state not registered");
  }

  lua_pushvalue(L, 1);
  int LuaRef = luaL_ref(L, LUA_REGISTRYINDEX);

  lua_State *CapturedL = L;
  int CapturedRef = LuaRef;

  int32 GatrixHandle = UGatrixClient::Get()->OnAny(
      [CapturedL, CapturedRef, CapturedAlive](const FString &EventName,
                                              const TArray<FString> &Args) {
        if (!CapturedAlive.IsValid() || !(*CapturedAlive)) {
          return;
        }

        // Push the Lua callback function
        lua_rawgeti(CapturedL, LUA_REGISTRYINDEX, CapturedRef);

        // Push event name as first arg
        lua_pushstring(CapturedL, TCHAR_TO_UTF8(*EventName));

        // Push args table as second arg
        lua_createtable(CapturedL, Args.Num(), 0);
        for (int32 i = 0; i < Args.Num(); ++i) {
          lua_pushstring(CapturedL, TCHAR_TO_UTF8(*Args[i]));
          lua_rawseti(CapturedL, -2, i + 1);
        }

        // Call the Lua function with 2 arguments (event name, args table)
        if (lua_pcall(CapturedL, 2, 0, 0) != LUA_OK) {
          const char *Err = lua_tostring(CapturedL, -1);
          UE_LOG(LogGatrixLua, Error, TEXT("OnAny callback error: %s"),
                 Err ? UTF8_TO_TCHAR(Err) : TEXT("unknown"));
          lua_pop(CapturedL, 1);
        }
      });

  // Track the callback for cleanup (bIsWatch=false, bIsAny=true)
  FLuaSession *Session = SessionRegistry.Find(L);
  if (Session) {
    Session->Callbacks.Add({GatrixHandle, LuaRef, false, true});
  }

  lua_pushinteger(L, GatrixHandle);
  return 1;
}

int FGatrixLuaBindings::Lua_OffAny(lua_State *L) {
  int32 Handle = static_cast<int32>(luaL_checkinteger(L, 1));

  UGatrixClient::Get()->OffAny(Handle);
  RemoveCallback(L, Handle);

  return 0;
}

// ==================== CreateWatchGroup ====================

// Lua userdata metatype name for watch group
static const char *WATCHGROUP_METATABLE = "GatrixWatchGroup";

// Heap-allocated data for WatchGroup.
// lua_newuserdata only provides raw memory (no constructors), so we must NOT
// place non-trivial types (TSharedPtr, TArray) directly inside userdata.
// Instead, userdata holds a single pointer to this heap-allocated struct,
// whose constructor/destructor run normally.
struct FLuaWatchGroupData {
  FGatrixWatchFlagGroup *Group = nullptr;
  lua_State *OwnerState = nullptr;
  TSharedPtr<bool> Alive;
  TArray<int> LuaRefs; // Tracked luaL_ref references for cleanup

  void ReleaseAllLuaRefs() {
    if (OwnerState) {
      for (int Ref : LuaRefs) {
        luaL_unref(OwnerState, LUA_REGISTRYINDEX, Ref);
      }
    }
    LuaRefs.Empty();
  }

  void DestroyInternal() {
    ReleaseAllLuaRefs();
    if (Group) {
      Group->DestroyGroup();
      delete Group;
      Group = nullptr;
    }
  }

  ~FLuaWatchGroupData() { DestroyInternal(); }
};

// Forward declarations for WatchGroup metamethods
static int WatchGroup_WatchRealtimeFlag(lua_State *L);
static int WatchGroup_WatchSyncedFlag(lua_State *L);
static int WatchGroup_WatchRealtimeFlagWithInitialState(lua_State *L);
static int WatchGroup_WatchSyncedFlagWithInitialState(lua_State *L);
static int WatchGroup_UnwatchAll(lua_State *L);
static int WatchGroup_Destroy(lua_State *L);
static int WatchGroup_Size(lua_State *L);
static int WatchGroup_GetName(lua_State *L);
static int WatchGroup_GC(lua_State *L);

static const luaL_Reg WatchGroupMethods[] = {
    {"WatchRealtimeFlag", WatchGroup_WatchRealtimeFlag},
    {"WatchSyncedFlag", WatchGroup_WatchSyncedFlag},
    {"WatchRealtimeFlagWithInitialState",
     WatchGroup_WatchRealtimeFlagWithInitialState},
    {"WatchSyncedFlagWithInitialState",
     WatchGroup_WatchSyncedFlagWithInitialState},
    {"UnwatchAll", WatchGroup_UnwatchAll},
    {"Destroy", WatchGroup_Destroy},
    {"Size", WatchGroup_Size},
    {"GetName", WatchGroup_GetName},
    {nullptr, nullptr}};

// Helper to get FLuaWatchGroupData** from Lua userdata
static FLuaWatchGroupData *CheckWatchGroup(lua_State *L) {
  FLuaWatchGroupData **Ptr = static_cast<FLuaWatchGroupData **>(
      luaL_checkudata(L, 1, WATCHGROUP_METATABLE));
  if (!Ptr || !*Ptr) {
    luaL_error(L, "WatchGroup has been destroyed");
    return nullptr;
  }
  return *Ptr;
}

int FGatrixLuaBindings::Lua_CreateWatchGroup(lua_State *L) {
  const char *Name = luaL_checkstring(L, 1);

  FGatrixWatchFlagGroup *Group =
      UGatrixClient::Get()->GetFeatures()->CreateWatchGroup(
          UTF8_TO_TCHAR(Name));

  // Allocate userdata as a pointer-to-heap-object.
  // lua_newuserdata provides raw memory; we store only a pointer (trivial type)
  // which avoids the UB of placing TSharedPtr/TArray in raw memory.
  FLuaWatchGroupData **UDPtr = static_cast<FLuaWatchGroupData **>(
      lua_newuserdata(L, sizeof(FLuaWatchGroupData *)));
  *UDPtr = new FLuaWatchGroupData();
  (*UDPtr)->Group = Group;
  (*UDPtr)->OwnerState = L;
  (*UDPtr)->Alive = GetAliveFlag(L);

  // Create or get the metatable
  if (luaL_newmetatable(L, WATCHGROUP_METATABLE)) {
    // Set methods
    luaL_newlib(L, WatchGroupMethods);
    lua_setfield(L, -2, "__index");

    // Set GC finalizer
    lua_pushcfunction(L, WatchGroup_GC);
    lua_setfield(L, -2, "__gc");
  }
  lua_setmetatable(L, -2);

  return 1; // return the userdata
}

// Helper to create a watch delegate that captures alive flag and Lua ref,
// and register the Lua ref for cleanup.
static FGatrixFlagWatchDelegate
CreateWatchGroupDelegate(lua_State *L, FLuaWatchGroupData *Data) {
  TSharedPtr<bool> CapturedAlive = Data->Alive;
  lua_pushvalue(L, 3);
  int LuaRef = luaL_ref(L, LUA_REGISTRYINDEX);
  lua_State *CapturedL = L;

  // Track the ref for cleanup on Destroy/GC
  Data->LuaRefs.Add(LuaRef);

  FGatrixFlagWatchDelegate Delegate;
  Delegate.BindLambda(
      [CapturedL, LuaRef, CapturedAlive](UGatrixFlagProxy *Proxy) {
        if (!CapturedAlive.IsValid() || !(*CapturedAlive)) {
          return;
        }
        lua_rawgeti(CapturedL, LUA_REGISTRYINDEX, LuaRef);
        FGatrixLuaBindings::PushFlagProxyTable(CapturedL, Proxy);
        if (lua_pcall(CapturedL, 1, 0, 0) != LUA_OK) {
          const char *Err = lua_tostring(CapturedL, -1);
          UE_LOG(LogGatrixLua, Error, TEXT("WatchGroup callback error: %s"),
                 Err ? UTF8_TO_TCHAR(Err) : TEXT("unknown"));
          lua_pop(CapturedL, 1);
        }
      });

  return Delegate;
}

static int WatchGroup_WatchRealtimeFlag(lua_State *L) {
  FLuaWatchGroupData *Data = CheckWatchGroup(L);
  const char *FlagName = luaL_checkstring(L, 2);
  luaL_checktype(L, 3, LUA_TFUNCTION);

  FGatrixFlagWatchDelegate Delegate = CreateWatchGroupDelegate(L, Data);
  Data->Group->WatchRealtimeFlag(UTF8_TO_TCHAR(FlagName), Delegate);

  // Return self for chaining
  lua_pushvalue(L, 1);
  return 1;
}

static int WatchGroup_WatchSyncedFlag(lua_State *L) {
  FLuaWatchGroupData *Data = CheckWatchGroup(L);
  const char *FlagName = luaL_checkstring(L, 2);
  luaL_checktype(L, 3, LUA_TFUNCTION);

  FGatrixFlagWatchDelegate Delegate = CreateWatchGroupDelegate(L, Data);
  Data->Group->WatchSyncedFlag(UTF8_TO_TCHAR(FlagName), Delegate);

  lua_pushvalue(L, 1);
  return 1;
}

static int WatchGroup_WatchRealtimeFlagWithInitialState(lua_State *L) {
  FLuaWatchGroupData *Data = CheckWatchGroup(L);
  const char *FlagName = luaL_checkstring(L, 2);
  luaL_checktype(L, 3, LUA_TFUNCTION);

  FGatrixFlagWatchDelegate Delegate = CreateWatchGroupDelegate(L, Data);
  Data->Group->WatchRealtimeFlagWithInitialState(UTF8_TO_TCHAR(FlagName),
                                                 Delegate);

  lua_pushvalue(L, 1);
  return 1;
}

static int WatchGroup_WatchSyncedFlagWithInitialState(lua_State *L) {
  FLuaWatchGroupData *Data = CheckWatchGroup(L);
  const char *FlagName = luaL_checkstring(L, 2);
  luaL_checktype(L, 3, LUA_TFUNCTION);

  FGatrixFlagWatchDelegate Delegate = CreateWatchGroupDelegate(L, Data);
  Data->Group->WatchSyncedFlagWithInitialState(UTF8_TO_TCHAR(FlagName),
                                               Delegate);

  lua_pushvalue(L, 1);
  return 1;
}

static int WatchGroup_UnwatchAll(lua_State *L) {
  FLuaWatchGroupData *Data = CheckWatchGroup(L);
  // Release Lua refs first, then unwatch
  Data->ReleaseAllLuaRefs();
  Data->Group->UnwatchAll();
  return 0;
}

static int WatchGroup_Destroy(lua_State *L) {
  FLuaWatchGroupData **Ptr = static_cast<FLuaWatchGroupData **>(
      luaL_checkudata(L, 1, WATCHGROUP_METATABLE));
  if (Ptr && *Ptr) {
    (*Ptr)->DestroyInternal();
    delete *Ptr;
    *Ptr = nullptr;
  }
  return 0;
}

static int WatchGroup_Size(lua_State *L) {
  FLuaWatchGroupData *Data = CheckWatchGroup(L);
  lua_pushinteger(L, Data->Group ? Data->Group->Size() : 0);
  return 1;
}

static int WatchGroup_GetName(lua_State *L) {
  FLuaWatchGroupData *Data = CheckWatchGroup(L);
  if (Data->Group) {
    lua_pushstring(L, TCHAR_TO_UTF8(*Data->Group->GetName()));
  } else {
    lua_pushnil(L);
  }
  return 1;
}

static int WatchGroup_GC(lua_State *L) {
  FLuaWatchGroupData **Ptr = static_cast<FLuaWatchGroupData **>(
      luaL_checkudata(L, 1, WATCHGROUP_METATABLE));
  if (Ptr && *Ptr) {
    // DestroyInternal releases Lua refs and unwatches
    (*Ptr)->DestroyInternal();
    delete *Ptr;
    *Ptr = nullptr;
  }
  return 0;
}
