// Copyright Gatrix. All Rights Reserved.

#include "GatrixLuaSDKModule.h"
#include "Modules/ModuleManager.h"

#define LOCTEXT_NAMESPACE "FGatrixLuaSDKModule"

DEFINE_LOG_CATEGORY(LogGatrixLua);

void FGatrixLuaSDKModule::StartupModule() {
  UE_LOG(LogGatrixLua, Log, TEXT("Module loaded."));
}

void FGatrixLuaSDKModule::ShutdownModule() {
  UE_LOG(LogGatrixLua, Log, TEXT("Module unloaded."));
}

#undef LOCTEXT_NAMESPACE

IMPLEMENT_MODULE(FGatrixLuaSDKModule, GatrixLuaSDK)
