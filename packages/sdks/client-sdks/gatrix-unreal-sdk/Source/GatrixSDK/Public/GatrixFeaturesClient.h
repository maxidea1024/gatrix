// Copyright Gatrix. All Rights Reserved.
// Features client for Gatrix Unreal SDK
// Handles flag fetching, caching, polling, variations, watch pattern, and
// metrics

#pragma once

#include "CoreMinimal.h"
#include "GatrixEventEmitter.h"
#include "GatrixEvents.h"
#include "GatrixFeaturesClient.generated.h"
#include "GatrixFlagProxy.h"
#include "GatrixStorageProvider.h"
#include "GatrixTypes.h"


// Blueprint-bindable delegates
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FGatrixOnReady);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FGatrixOnChange);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FGatrixOnSync);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FGatrixOnRecovered);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FGatrixOnError,
                                            const FGatrixErrorEvent &,
                                            ErrorEvent);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FGatrixOnImpression,
                                            const FGatrixImpressionEvent &,
                                            ImpressionEvent);

// C++ flag watch callback
DECLARE_DELEGATE_OneParam(FGatrixFlagWatchDelegate, UGatrixFlagProxy *);

/**
 * Features client managing all feature flag operations.
 * Thread-safe: protects internal flag storage with FCriticalSection,
 * HTTP callbacks are marshalled to game thread via AsyncTask.
 */
UCLASS(BlueprintType)
class GATRIXSDK_API UGatrixFeaturesClient : public UObject {
  GENERATED_BODY()

public:
  /** Initialize the features client with config and event emitter */
  void Initialize(const FGatrixClientConfig &Config,
                  FGatrixEventEmitter *Emitter,
                  TSharedPtr<IGatrixStorageProvider> Storage);

  /** Start fetching and polling */
  void Start();

  /** Stop polling and cleanup */
  void Stop();

  // ==================== Flag Access ====================

  /** Check if a flag is enabled */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Features")
  bool IsEnabled(const FString &FlagName) const;

  /** Get variant for a flag (never null - returns disabled variant if missing)
   */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Features")
  FGatrixVariant GetVariant(const FString &FlagName) const;

  /** Get a FlagProxy for a flag */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Features")
  UGatrixFlagProxy *GetFlag(const FString &FlagName);

  /** Get all evaluated flags */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Features")
  TArray<FGatrixEvaluatedFlag> GetAllFlags() const;

  // ==================== Variation Methods ====================

  /** Get boolean variation */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|Features|Variation")
  bool BoolVariation(const FString &FlagName, bool DefaultValue) const;

  /** Get string variation */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|Features|Variation")
  FString StringVariation(const FString &FlagName,
                          const FString &DefaultValue) const;

  /** Get number variation */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|Features|Variation")
  float NumberVariation(const FString &FlagName, float DefaultValue) const;

  /** Get JSON variation as string */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|Features|Variation")
  FString JsonVariation(const FString &FlagName,
                        const FString &DefaultValue) const;

  // ==================== Variation Details ====================

  /** Get boolean variation with details */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|Features|Variation")
  FGatrixVariationResult BoolVariationDetails(const FString &FlagName,
                                              bool DefaultValue) const;

  /** Get string variation with details */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|Features|Variation")
  FGatrixVariationResult
  StringVariationDetails(const FString &FlagName,
                         const FString &DefaultValue) const;

  /** Get number variation with details */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|Features|Variation")
  FGatrixVariationResult NumberVariationDetails(const FString &FlagName,
                                                float DefaultValue) const;

  // ==================== Context ====================

  /** Update the evaluation context and re-fetch flags */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Features|Context")
  void UpdateContext(const FGatrixContext &NewContext);

  /** Get current context */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|Features|Context")
  FGatrixContext GetContext() const;

  // ==================== Explicit Sync ====================

  /** Sync flags manually (for explicitSyncMode) */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Features|Sync")
  void SyncFlags(bool bFetchNow = true);

  /** Check if new flags are available but not yet synced */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Features|Sync")
  bool CanSyncFlags() const;

  // ==================== Fetch ====================

  /** Explicitly fetch flags from the server */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Features")
  void FetchFlags();

  // ==================== Watch ====================

  /**
   * Watch a specific flag for changes.
   * Returns a handle that can be used to unsubscribe.
   */
  int32 WatchFlag(const FString &FlagName, FGatrixFlagWatchDelegate Callback,
                  const FString &Name = TEXT(""));

  /** Unsubscribe a flag watcher by handle */
  void UnwatchFlag(int32 Handle);

  // ==================== Stats ====================

  /** Get feature flag statistics */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|Features|Stats")
  FGatrixFeaturesStats GetStats() const;

  /** Check if SDK is ready */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Features")
  bool IsReady() const { return bReadyEmitted; }

  // ==================== Blueprint Events ====================

  /** Fires when flags are ready for the first time */
  UPROPERTY(BlueprintAssignable, Category = "Gatrix|Events")
  FGatrixOnReady OnReady;

  /** Fires when flags change */
  UPROPERTY(BlueprintAssignable, Category = "Gatrix|Events")
  FGatrixOnChange OnChange;

  /** Fires when flags are synced (explicitSyncMode) */
  UPROPERTY(BlueprintAssignable, Category = "Gatrix|Events")
  FGatrixOnSync OnSync;

  /** Fires when SDK recovers from error */
  UPROPERTY(BlueprintAssignable, Category = "Gatrix|Events")
  FGatrixOnRecovered OnRecovered;

  /** Fires on SDK error */
  UPROPERTY(BlueprintAssignable, Category = "Gatrix|Events")
  FGatrixOnError OnError;

  /** Fires on impression events */
  UPROPERTY(BlueprintAssignable, Category = "Gatrix|Events")
  FGatrixOnImpression OnImpression;

private:
  // ==================== Internal Methods ====================

  void LoadFromStorage();
  void ApplyBootstrap();
  void DoFetchFlags();
  void HandleFetchResponse(const FString &ResponseBody, int32 HttpStatus,
                           const FString &EtagHeader);
  void StoreFlags(const TArray<FGatrixEvaluatedFlag> &NewFlags,
                  bool bIsInitialFetch);
  TMap<FString, FGatrixEvaluatedFlag> SelectFlags() const;
  void SetReady();
  void EmitFlagChanges(const TMap<FString, FGatrixEvaluatedFlag> &OldFlags,
                       const TMap<FString, FGatrixEvaluatedFlag> &NewFlags);
  void TrackImpression(const FString &FlagName, bool bEnabled,
                       const FString &VariantName);
  void ScheduleNextPoll();
  void StopPolling();

  // Metrics
  void StartMetrics();
  void StopMetrics();
  void SendMetrics();
  void BuildMetricsPayload(FString &OutJson) const;

  FString BuildFetchUrl() const;
  FString BuildContextQueryString() const;
  FString ContextToJson() const;

  // ==================== State ====================

  FGatrixClientConfig ClientConfig;
  FGatrixEventEmitter *EventEmitter = nullptr;
  TSharedPtr<IGatrixStorageProvider> StorageProvider;

  // Thread-safe flag storage
  mutable FCriticalSection FlagsCriticalSection;
  TMap<FString, FGatrixEvaluatedFlag> RealtimeFlags;
  TMap<FString, FGatrixEvaluatedFlag> SynchronizedFlags;

  // State tracking
  EGatrixSdkState SdkState = EGatrixSdkState::Initializing;
  bool bReadyEmitted = false;
  bool bFetchedFromServer = false;
  bool bIsFetching = false;
  bool bHasPendingSync = false;
  bool bStarted = false;

  // ETag for conditional requests
  FString Etag;

  // Statistics (atomic or protected by lock)
  mutable FCriticalSection StatsCriticalSection;
  int32 FetchFlagsCount = 0;
  int32 UpdateCount = 0;
  int32 NotModifiedCount = 0;
  int32 RecoveryCount = 0;
  int32 SyncFlagsCount = 0;
  int32 ImpressionCount = 0;
  int32 ContextChangeCount = 0;
  int32 MetricsSentCount = 0;
  int32 MetricsErrorCount = 0;

  // Metrics tracking
  mutable FCriticalSection MetricsCriticalSection;
  TMap<FString, int32> MetricsFlagAccess;
  TArray<FString> MissingFlagNames;

  // Polling timer
  FTimerHandle PollTimerHandle;
  FTimerHandle MetricsTimerHandle;

  // Storage keys
  static const FString StorageKeyFlags;
  static const FString StorageKeyEtag;

  // Connection ID
  FString ConnectionId;
};
