// Copyright Gatrix. All Rights Reserved.
// Watch flag group for batch management of flag watchers

#pragma once

#include "CoreMinimal.h"

class UGatrixFeaturesClient;

/**
 * Batch management for multiple flag watchers.
 * Groups watch handles together so they can be cleaned up at once.
 *
 * Usage:
 *   auto* Group = Features->CreateWatchGroup("ui-flags");
 *   Group->WatchRealtimeFlag("dark-mode", Delegate1);
 *   Group->WatchSyncedFlag("show-ads", Delegate2);
 *   // Later: clean up all watchers at once
 *   Group->DestroyGroup();
 */
class GATRIXSDK_API FGatrixWatchFlagGroup {
public:
  FGatrixWatchFlagGroup(UGatrixFeaturesClient *InClient, const FString &InName);

  /** Get the group name */
  const FString &GetName() const { return Name; }

  /** Watch a flag for realtime changes and add to this group */
  FGatrixWatchFlagGroup &WatchRealtimeFlag(const FString &FlagName,
                                           FGatrixFlagWatchDelegate Callback);

  /** Watch a flag for realtime changes with initial state */
  FGatrixWatchFlagGroup &
  WatchRealtimeFlagWithInitialState(const FString &FlagName,
                                    FGatrixFlagWatchDelegate Callback);

  /** Watch a flag for synced changes and add to this group */
  FGatrixWatchFlagGroup &WatchSyncedFlag(const FString &FlagName,
                                         FGatrixFlagWatchDelegate Callback);

  /** Watch a flag for synced changes with initial state */
  FGatrixWatchFlagGroup &
  WatchSyncedFlagWithInitialState(const FString &FlagName,
                                  FGatrixFlagWatchDelegate Callback);

  /** Unwatch all registered watchers in this group */
  void UnwatchAll();

  /** Alias for UnwatchAll - destroys the group */
  void DestroyGroup();

  /** Get the number of active watchers */
  int32 Size() const { return WatchHandles.Num(); }

private:
  UGatrixFeaturesClient *Client;
  FString Name;
  TArray<int32> WatchHandles;
};
