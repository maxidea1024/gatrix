// Copyright Gatrix. All Rights Reserved.

#include "GatrixClientSDKModule.h"
#include "Modules/ModuleManager.h"

#define LOCTEXT_NAMESPACE "FGatrixClientSDKModule"

DEFINE_LOG_CATEGORY(LogGatrix);

void FGatrixClientSDKModule::StartupModule() {
  UE_LOG(LogGatrix, Log, TEXT("Module loaded."));
}

void FGatrixClientSDKModule::ShutdownModule() {
  UE_LOG(LogGatrix, Log, TEXT("Module unloaded."));
}

#undef LOCTEXT_NAMESPACE

IMPLEMENT_MODULE(FGatrixClientSDKModule, GatrixClientSDK)
