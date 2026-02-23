// Copyright Gatrix. All Rights Reserved.
// Module header for Gatrix Unreal Client SDK

#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleManager.h"

/** Gatrix Client SDK log category */
DECLARE_LOG_CATEGORY_EXTERN(LogGatrix, Log, All);

class FGatrixClientSDKModule : public IModuleInterface {
public:
  virtual void StartupModule() override;
  virtual void ShutdownModule() override;
};
