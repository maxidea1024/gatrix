// Copyright Gatrix. All Rights Reserved.

#include "GatrixLuaClientSDKModule.h"
#include "Modules/ModuleManager.h"

#define LOCTEXT_NAMESPACE "FGatrixLuaClientSDKModule"

DEFINE_LOG_CATEGORY(LogGatrixLua);

void FGatrixLuaClientSDKModule::StartupModule() {
  UE_LOG(LogGatrixLua, Log, TEXT("Module loaded."));
}

void FGatrixLuaClientSDKModule::ShutdownModule() {
  UE_LOG(LogGatrixLua, Log, TEXT("Module unloaded."));
}

#undef LOCTEXT_NAMESPACE

IMPLEMENT_MODULE(FGatrixLuaClientSDKModule, GatrixLuaClientSDK)
