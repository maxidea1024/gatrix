// Copyright Gatrix. All Rights Reserved.

#include "GatrixSDKModule.h"
#include "Modules/ModuleManager.h"

#define LOCTEXT_NAMESPACE "FGatrixSDKModule"

void FGatrixSDKModule::StartupModule() {
  UE_LOG(LogTemp, Log, TEXT("[GatrixSDK] Module loaded."));
}

void FGatrixSDKModule::ShutdownModule() {
  UE_LOG(LogTemp, Log, TEXT("[GatrixSDK] Module unloaded."));
}

#undef LOCTEXT_NAMESPACE

IMPLEMENT_MODULE(FGatrixSDKModule, GatrixSDK)
