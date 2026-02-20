// Copyright Gatrix. All Rights Reserved.
// Watch flag group implementation

#include "GatrixWatchFlagGroup.h"
#include "GatrixFeaturesClient.h"

FGatrixWatchFlagGroup::FGatrixWatchFlagGroup(UGatrixFeaturesClient *InClient,
                                             const FString &InName)
    : Client(InClient), Name(InName) {}

FGatrixWatchFlagGroup &
FGatrixWatchFlagGroup::WatchRealtimeFlag(const FString &FlagName,
                                         FGatrixFlagWatchDelegate Callback) {
  int32 Handle = Client->WatchRealtimeFlag(FlagName, Callback);
  WatchHandles.Add(Handle);
  return *this;
}

FGatrixWatchFlagGroup &FGatrixWatchFlagGroup::WatchRealtimeFlagWithInitialState(
    const FString &FlagName, FGatrixFlagWatchDelegate Callback) {
  int32 Handle = Client->WatchRealtimeFlagWithInitialState(FlagName, Callback);
  WatchHandles.Add(Handle);
  return *this;
}

FGatrixWatchFlagGroup &
FGatrixWatchFlagGroup::WatchSyncedFlag(const FString &FlagName,
                                       FGatrixFlagWatchDelegate Callback) {
  int32 Handle = Client->WatchSyncedFlag(FlagName, Callback);
  WatchHandles.Add(Handle);
  return *this;
}

FGatrixWatchFlagGroup &FGatrixWatchFlagGroup::WatchSyncedFlagWithInitialState(
    const FString &FlagName, FGatrixFlagWatchDelegate Callback) {
  int32 Handle = Client->WatchSyncedFlagWithInitialState(FlagName, Callback);
  WatchHandles.Add(Handle);
  return *this;
}

void FGatrixWatchFlagGroup::UnwatchAll() {
  for (int32 Handle : WatchHandles) {
    Client->UnwatchFlag(Handle);
  }
  WatchHandles.Empty();
}

void FGatrixWatchFlagGroup::DestroyGroup() { UnwatchAll(); }
