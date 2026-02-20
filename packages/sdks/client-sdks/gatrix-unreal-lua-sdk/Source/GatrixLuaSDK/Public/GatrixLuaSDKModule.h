// Copyright Gatrix. All Rights Reserved.
// Module header for Gatrix Lua SDK

#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleManager.h"

/** Gatrix Lua SDK log category */
DECLARE_LOG_CATEGORY_EXTERN(LogGatrixLua, Log, All);

class FGatrixLuaSDKModule : public IModuleInterface {
public:
  virtual void StartupModule() override;
  virtual void ShutdownModule() override;
};
