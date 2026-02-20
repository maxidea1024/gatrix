// Copyright Gatrix. All Rights Reserved.
// Delegate type for flag watch callbacks - split into its own header to avoid
// circular include between GatrixFeaturesClient.h and GatrixWatchFlagGroup.h

#pragma once

#include "CoreMinimal.h"

class UGatrixFlagProxy;

// Callback delegate invoked when a watched flag changes
DECLARE_DELEGATE_OneParam(FGatrixFlagWatchDelegate, UGatrixFlagProxy*);
