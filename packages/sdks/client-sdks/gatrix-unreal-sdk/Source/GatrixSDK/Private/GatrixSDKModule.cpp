// Copyright Gatrix. All Rights Reserved.

#include "GatrixSDKModule.h"
#include "Modules/ModuleManager.h"

#define LOCTEXT_NAMESPACE "FGatrixSDKModule"

DEFINE_LOG_CATEGORY(LogGatrix);

void FGatrixSDKModule::StartupModule() {
  UE_LOG(LogGatrix, Log, TEXT("Module loaded."));
}

void FGatrixSDKModule::ShutdownModule() {
  UE_LOG(LogGatrix, Log, TEXT("Module unloaded."));
}

#undef LOCTEXT_NAMESPACE

IMPLEMENT_MODULE(FGatrixSDKModule, GatrixSDK)
