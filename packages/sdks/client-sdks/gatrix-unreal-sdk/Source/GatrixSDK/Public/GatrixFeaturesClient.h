// Copyright Gatrix. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GatrixEventEmitter.h"
#include "GatrixFeaturesClient.generated.h"
#include "GatrixFlagProxy.h"
#include "GatrixTypes.h"
#include "GatrixVariationProvider.h"
#include "Http.h"
#include "IGatrixVariationProvider.h"
#include "Runtime/Engine/Public/TimerManager.h"


// Delegates for Blueprint events
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FGatrixOnReady);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FGatrixOnChange);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FGatrixOnSync);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FGatrixOnRecovered);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FGatrixOnError, FString, Code,
                                             FString, Message);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_FourParams(FGatrixOnImpression, FString,
                                              FlagName, bool, bEnabled, FString,
                                              VariantName, FString, EventType);

// Delegate for internal flag watching
DECLARE_DELEGATE_OneParam(FGatrixFlagWatchDelegate, UGatrixFlagProxy *);

/**
 * UGatrixFeaturesClient - Central client for feature flag management in Unreal
 * SDK. Implementation of CLIENT_SDK_SPEC.md.
 */
UCLASS(BlueprintType)
class GATRIXSDK_API UGatrixFeaturesClient : public UObject,
                                            public IGatrixVariationProvider {
  GENERATED_BODY()

public:
  UGatrixFeaturesClient();

  /**
   * Start the client - initializes storage, bootstrap, and starts polling.
   */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Features")
  void Start();

  /**
   * Stop the client - stops polling and metrics.
   */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Features")
  void Stop();

  // ==================== Flag Access - Basic ====================

  /** Check if a flag is enabled */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Features")
  bool IsEnabled(const FString &FlagName) const;

  /** Get variant for a flag */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Features")
  FGatrixVariant GetVariant(const FString &FlagName) const;

  /** Get all evaluated flags */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Features")
  TArray<FGatrixEvaluatedFlag> GetAllFlags() const;

  /** Get a FlagProxy for convenient access */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Features")
  UGatrixFlagProxy *GetFlag(const FString &FlagName) const;

  /** Check if a flag is registered in the cache */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Features")
  bool HasFlag(const FString &FlagName) const;

  // ==================== Flag Access - Typed Variations ====================

  /** Get boolean variation */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|Features|Variation")
  bool BoolVariation(const FString &FlagName, bool MissingValue) const;

  /** Get string variation */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|Features|Variation")
  FString StringVariation(const FString &FlagName,
                          const FString &MissingValue) const;

  /** Get integer variation */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|Features|Variation")
  int32 IntVariation(const FString &FlagName, int32 MissingValue) const;

  /** Get float variation */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|Features|Variation")
  float FloatVariation(const FString &FlagName, float MissingValue) const;

  /** Get double variation */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|Features|Variation")
  double DoubleVariation(const FString &FlagName, double MissingValue) const;

  /** Get JSON variation as string */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|Features|Variation")
  FString JsonVariation(const FString &FlagName,
                        const FString &MissingValue) const;

  // ==================== Variation Details ====================

  /** Get boolean variation with details */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|Features|Variation")
  FGatrixVariationResult BoolVariationDetails(const FString &FlagName,
                                              bool MissingValue) const;

  /** Get string variation with details */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|Features|Variation")
  FGatrixVariationResult
  StringVariationDetails(const FString &FlagName,
                         const FString &MissingValue) const;

  /** Get integer variation with details */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|Features|Variation")
  FGatrixVariationResult IntVariationDetails(const FString &FlagName,
                                             int32 MissingValue) const;

  /** Get float variation with details */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|Features|Variation")
  FGatrixVariationResult FloatVariationDetails(const FString &FlagName,
                                               float MissingValue) const;

  /** Get double variation with details */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|Features|Variation")
  FGatrixVariationResult DoubleVariationDetails(const FString &FlagName,
                                                double MissingValue) const;

  /** Get JSON variation with details */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|Features|Variation")
  FGatrixVariationResult
  JsonVariationDetails(const FString &FlagName,
                       const FString &MissingValue) const;

  // ==================== OrThrow Variations ====================

  UFUNCTION(BlueprintCallable, Category = "Gatrix|Features|Variation")
  bool BoolVariationOrThrow(const FString &FlagName);

  UFUNCTION(BlueprintCallable, Category = "Gatrix|Features|Variation")
  FString StringVariationOrThrow(const FString &FlagName);

  UFUNCTION(BlueprintCallable, Category = "Gatrix|Features|Variation")
  float FloatVariationOrThrow(const FString &FlagName);

  UFUNCTION(BlueprintCallable, Category = "Gatrix|Features|Variation")
  int32 IntVariationOrThrow(const FString &FlagName);

  UFUNCTION(BlueprintCallable, Category = "Gatrix|Features|Variation")
  double DoubleVariationOrThrow(const FString &FlagName);

  UFUNCTION(BlueprintCallable, Category = "Gatrix|Features|Variation")
  FString JsonVariationOrThrow(const FString &FlagName);

  // ==================== Context Management ====================

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

  // ==================== IGatrixVariationProvider Implementation
  // ====================

  virtual bool IsEnabledInternal(const FString &FlagName) override;
  virtual FGatrixVariant GetVariantInternal(const FString &FlagName) override;

  virtual FString VariationInternal(const FString &FlagName,
                                    const FString &MissingValue) override;
  virtual bool BoolVariationInternal(const FString &FlagName,
                                     bool MissingValue) override;
  virtual FString StringVariationInternal(const FString &FlagName,
                                          const FString &MissingValue) override;
  virtual float FloatVariationInternal(const FString &FlagName,
                                       float MissingValue) override;
  virtual int32 IntVariationInternal(const FString &FlagName,
                                     int32 MissingValue) override;
  virtual double DoubleVariationInternal(const FString &FlagName,
                                         double MissingValue) override;
  virtual FString JsonVariationInternal(const FString &FlagName,
                                        const FString &MissingValue) override;

  virtual FGatrixVariationResult
  BoolVariationDetailsInternal(const FString &FlagName,
                               bool MissingValue) override;
  virtual FGatrixVariationResult
  StringVariationDetailsInternal(const FString &FlagName,
                                 const FString &MissingValue) override;
  virtual FGatrixVariationResult
  FloatVariationDetailsInternal(const FString &FlagName,
                                float MissingValue) override;
  virtual FGatrixVariationResult
  IntVariationDetailsInternal(const FString &FlagName,
                              int32 MissingValue) override;
  virtual FGatrixVariationResult
  DoubleVariationDetailsInternal(const FString &FlagName,
                                 double MissingValue) override;
  virtual FGatrixVariationResult
  JsonVariationDetailsInternal(const FString &FlagName,
                               const FString &MissingValue) override;

  virtual bool BoolVariationOrThrowInternal(const FString &FlagName) override;
  virtual FString
  StringVariationOrThrowInternal(const FString &FlagName) override;
  virtual float FloatVariationOrThrowInternal(const FString &FlagName) override;
  virtual int32 IntVariationOrThrowInternal(const FString &FlagName) override;
  virtual double
  DoubleVariationOrThrowInternal(const FString &FlagName) override;
  virtual FString
  JsonVariationOrThrowInternal(const FString &FlagName) override;

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
                       const FString &VariantName, const FString &EventType);
  void TrackAccess(const FString &FlagName, const FGatrixEvaluatedFlag *Flag,
                   const FString &EventType, const FString &VariantName) const;
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
  int32 ConsecutiveFailures = 0;
  bool bPollingStopped = false;

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
  struct FFlagMetrics {
    int32 Yes = 0;
    int32 No = 0;
    TMap<FString, int32> Variants;
  };

  mutable FCriticalSection MetricsCriticalSection;
  TMap<FString, FFlagMetrics> MetricsFlagBucket;
  TMap<FString, int32> MetricsMissingFlags;

  // Polling timer
  FTimerHandle PollTimerHandle;
  FTimerHandle MetricsTimerHandle;

  // Storage keys
  static const FString StorageKeyFlags;
  static const FString StorageKeyEtag;

  // Connection ID
  FString ConnectionId;
};
