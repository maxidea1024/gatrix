// Copyright Gatrix. All Rights Reserved.
// Main client for Gatrix Unreal SDK

#pragma once

#include "CoreMinimal.h"
#include "GatrixEventEmitter.h"
#include "GatrixFeaturesClient.h"
#include "GatrixStorageProvider.h"
#include "GatrixTypes.h"
#include "GatrixClient.generated.h"

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
 *   UGatrixClient::Get()->Start(Config);
 *
 * Usage (Blueprint):
 *   Use the "Get Gatrix Client" node, then call Start with config.
 */
UCLASS(BlueprintType)
class GATRIXCLIENTSDK_API UGatrixClient : public UObject {
  GENERATED_BODY()

public:
  /** Get the singleton instance */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix",
            meta = (DisplayName = "Get Gatrix Client"))
  static UGatrixClient* Get();

  /** Start the SDK with configuration (Blueprint) */
  UFUNCTION(BlueprintCallable, Category = "Gatrix")
  void Start(const FGatrixClientConfig& Config);

  /**
   * Start the SDK with configuration (C++ only).
   * OnComplete(bSuccess, ErrorMessage) is called when the SDK first becomes
   * ready, or immediately if already ready.
   */
  void Start(const FGatrixClientConfig& Config, TFunction<void(bool, const FString&)> OnComplete);

  /** Stop the SDK (stops polling, cleans up) */
  UFUNCTION(BlueprintCallable, Category = "Gatrix")
  void Stop();

  /** Check if the SDK has been initialized and started */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix")
  bool IsInitialized() const { return bInitialized; }

  /** Check if the SDK is ready (first fetch completed) */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix")
  bool IsReady() const;

  // ==================== Features Client Access ====================

  /** Get the features client for flag access */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix")
  UGatrixFeaturesClient* GetFeatures() const { return FeaturesClient; }

  // ==================== Event Subscription (C++) ====================

  /** Subscribe to an event (C++ only, returns handle for Off) */
  int32 On(const FString& EventName, TFunction<void(const TArray<FString>&)> Callback,
           const FString& Name = TEXT(""));

  /** Subscribe once */
  int32 Once(const FString& EventName, TFunction<void(const TArray<FString>&)> Callback,
             const FString& Name = TEXT(""));

  /** Unsubscribe by handle */
  void Off(int32 Handle);

  /** Unsubscribe all for an event */
  void Off(const FString& EventName);

  /** Subscribe to all events */
  int32 OnAny(TFunction<void(const FString&, const TArray<FString>&)> Callback,
              const FString& Name = TEXT(""));

  /** Unsubscribe any-event listener */
  void OffAny(int32 Handle);

  // ==================== Tracking ====================

  /**
   * Track a custom user event.
   * NOTE: Not yet implemented. This API is reserved for the upcoming
   * Gatrix Analytics service and will be fully supported in a future release.
   *
   * @param EventName  Name of the event to track
   * @param Properties Optional key-value properties
   */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Tracking")
  void Track(const FString& EventName, const TMap<FString, FString>& Properties);

  /** C++ convenience overload — no properties */
  void Track(const FString& EventName);

  // ==================== Stats ====================

  /** Get SDK statistics */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Stats")
  FGatrixSdkStats GetStats() const;

  /**
   * Get lightweight statistics (C++ only) — scalar values only, no TMap/TArray copying.
   * Use this for frequent polling or low-overhead diagnostics.
   */
  FGatrixLightStats GetLightStats() const;

  // ==================== Blueprint Events (forwarded from FeaturesClient)
  // ====================

  /** Get the features client's OnReady delegate for Blueprint binding */
  FGatrixOnReady& GetOnReady();
  FGatrixOnChange& GetOnChange();
  FGatrixOnError& GetOnError();

  /** SDK version */
  static const FString SdkVersion;
  static const FString SdkName;

private:
  /** Internal initialization logic (validates config, creates FeaturesClient) */
  bool InitInternal(const FGatrixClientConfig& InConfig);

  static UGatrixClient* Singleton;

  UPROPERTY()
  UGatrixFeaturesClient* FeaturesClient = nullptr;

  FGatrixEventEmitter EventEmitter;
  TSharedPtr<IGatrixStorageProvider> StorageProvider;

  FGatrixClientConfig StoredConfig;
  bool bInitialized = false;
  bool bStarted = false;
  FString ClientConnectionId;
};
