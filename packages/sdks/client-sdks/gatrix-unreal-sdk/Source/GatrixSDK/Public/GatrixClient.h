// Copyright Gatrix. All Rights Reserved.
// Main client for Gatrix Unreal SDK

#pragma once

#include "CoreMinimal.h"
#include "GatrixClient.generated.h"
#include "GatrixEventEmitter.h"
#include "GatrixFeaturesClient.h"
#include "GatrixStorageProvider.h"
#include "GatrixTypes.h"

/**
 * Main Gatrix SDK client.
 * Singleton-style access via Get(). Manages lifecycle, events, and
 * FeaturesClient. Thread-safe: internal state protected, HTTP callbacks
 * marshalled to game thread.
 *
 * Usage (C++):
 *   FGatrixClientConfig Config;
 *   Config.ApiUrl = TEXT("http://localhost:3400/api/v1");
 *   Config.ApiToken = TEXT("your-token");
 *   Config.AppName = TEXT("MyGame");
 *   Config.Environment = TEXT("production");
 *   UGatrixClient::Get()->Init(Config);
 *   UGatrixClient::Get()->Start();
 *
 * Usage (Blueprint):
 *   Use the "Get Gatrix Client" node, then call Init and Start.
 */
UCLASS(BlueprintType)
class GATRIXSDK_API UGatrixClient : public UObject {
  GENERATED_BODY()

public:
  /** Get the singleton instance */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix",
            meta = (DisplayName = "Get Gatrix Client"))
  static UGatrixClient *Get();

  /** Initialize the SDK with configuration */
  UFUNCTION(BlueprintCallable, Category = "Gatrix")
  void Init(const FGatrixClientConfig &Config);

  /** Start the SDK (begins fetching, polling, metrics) */
  UFUNCTION(BlueprintCallable, Category = "Gatrix")
  void Start();

  /** Stop the SDK (stops polling, cleans up) */
  UFUNCTION(BlueprintCallable, Category = "Gatrix")
  void Stop();

  /** Check if the SDK has been initialized */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix")
  bool IsInitialized() const { return bInitialized; }

  /** Check if the SDK is ready (first fetch completed) */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix")
  bool IsReady() const;

  // ==================== Features Client Access ====================

  /** Get the features client for flag access */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix")
  UGatrixFeaturesClient *GetFeatures() const { return FeaturesClient; }

  // ==================== Convenience Methods (delegates to FeaturesClient)
  // ====================

  /** Check if a flag is enabled (convenience) */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Quick")
  bool IsEnabled(const FString &FlagName) const;

  /** Get boolean variation (convenience) */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Quick")
  bool BoolVariation(const FString &FlagName, bool DefaultValue) const;

  /** Get string variation (convenience) */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Quick")
  FString StringVariation(const FString &FlagName,
                          const FString &DefaultValue) const;

  /** Get integer variation (convenience) */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Quick")
  int32 IntVariation(const FString &FlagName, int32 DefaultValue) const;

  /** Get float variation (convenience) */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Quick")
  float FloatVariation(const FString &FlagName, float DefaultValue) const;

  /** Get double variation (convenience) */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Quick")
  double DoubleVariation(const FString &FlagName, double DefaultValue) const;

  /** Get variant (convenience) */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Quick")
  FGatrixVariant GetVariant(const FString &FlagName) const;

  /** Get all flags (convenience) */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Quick")
  TArray<FGatrixEvaluatedFlag> GetAllFlags() const;

  // ==================== Event Subscription (C++) ====================

  /** Subscribe to an event (C++ only, returns handle for Off) */
  int32 On(const FString &EventName,
           TFunction<void(const TArray<FString> &)> Callback,
           const FString &Name = TEXT(""));

  /** Subscribe once */
  int32 Once(const FString &EventName,
             TFunction<void(const TArray<FString> &)> Callback,
             const FString &Name = TEXT(""));

  /** Unsubscribe by handle */
  void Off(int32 Handle);

  /** Unsubscribe all for an event */
  void Off(const FString &EventName);

  /** Subscribe to all events */
  int32
  OnAny(TFunction<void(const FString &, const TArray<FString> &)> Callback,
        const FString &Name = TEXT(""));

  /** Unsubscribe any-event listener */
  void OffAny(int32 Handle);

  // ==================== Stats ====================

  /** Get SDK statistics */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Stats")
  FGatrixSdkStats GetStats() const;

  // ==================== Context ====================

  /** Update evaluation context */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Context")
  void UpdateContext(const FGatrixContext &NewContext);

  /** Get current context */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Context")
  FGatrixContext GetContext() const;

  // ==================== Blueprint Events (forwarded from FeaturesClient)
  // ====================

  /** Get the features client's OnReady delegate for Blueprint binding */
  FGatrixOnReady &GetOnReady();
  FGatrixOnChange &GetOnChange();
  FGatrixOnError &GetOnError();

  /** SDK version */
  static const FString SdkVersion;
  static const FString SdkName;

private:
  static UGatrixClient *Singleton;

  UPROPERTY()
  UGatrixFeaturesClient *FeaturesClient = nullptr;

  FGatrixEventEmitter EventEmitter;
  TSharedPtr<IGatrixStorageProvider> StorageProvider;

  FGatrixClientConfig Config;
  bool bInitialized = false;
  bool bStarted = false;
  FString ClientConnectionId;
};
