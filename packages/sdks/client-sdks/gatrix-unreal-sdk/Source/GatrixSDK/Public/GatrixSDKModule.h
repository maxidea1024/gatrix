// Copyright Gatrix. All Rights Reserved.
// Module header for Gatrix Unreal SDK

#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleManager.h"

class FGatrixSDKModule : public IModuleInterface {
public:
  virtual void StartupModule() override;
  virtual void ShutdownModule() override;
};
