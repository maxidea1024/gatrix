// Copyright Gatrix. All Rights Reserved.
// Module header for Gatrix Lua Client SDK

#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleManager.h"

/** Gatrix Lua Client SDK log category */
DECLARE_LOG_CATEGORY_EXTERN(LogGatrixLua, Log, All);

class FGatrixLuaClientSDKModule : public IModuleInterface {
public:
  virtual void StartupModule() override;
  virtual void ShutdownModule() override;
};
