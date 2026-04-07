// Copyright Gatrix. All Rights Reserved.
// Banner API client — fetches banner data from Gatrix server

#pragma once

#include "CoreMinimal.h"
#include "GatrixBannerTypes.h"
#include "GatrixBannerClient.generated.h"

// Delegates
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FGatrixOnBannersLoaded, bool, bSuccess, const TArray<FGatrixBanner>&, Banners);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FGatrixOnBannerLoaded, bool, bSuccess, const FGatrixBanner&, Banner);

/**
 * Client for fetching banner data from the Gatrix API.
 * All network operations are fully async and never block the game thread.
 *
 * Uses the same ApiUrl/ApiToken configuration as the main GatrixClient.
 */
UCLASS(BlueprintType)
class GATRIXCLIENTSDK_API UGatrixBannerClient : public UObject {
  GENERATED_BODY()

public:
  /**
   * Initialize with API configuration.
   * Typically called once after GatrixClient starts.
   */
  void Initialize(const FString& InApiUrl, const FString& InApiToken,
                  const TMap<FString, FString>& InCustomHeaders = {});

  /**
   * Fetch all published banners (async).
   * Results delivered via OnAllBannersLoaded delegate AND the OnComplete lambda.
   */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Banner")
  void FetchAllBanners();

  /** C++ overload with completion callback */
  void FetchAllBanners(TFunction<void(bool, const TArray<FGatrixBanner>&)> OnComplete);

  /**
   * Fetch a single banner by ID (async).
   * Results delivered via OnBannerLoaded delegate AND the OnComplete lambda.
   */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Banner")
  void FetchBannerById(const FString& BannerId);

  /** C++ overload with completion callback */
  void FetchBannerById(const FString& BannerId,
                       TFunction<void(bool, const FGatrixBanner&)> OnComplete);

  /**
   * Get a cached banner by ID (returns empty if not cached).
   * Does not make a network request.
   */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Banner")
  FGatrixBanner GetCachedBanner(const FString& BannerId) const;

  /** Get all cached banners */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Banner")
  TArray<FGatrixBanner> GetCachedBanners() const;

  /** Check if a banner is in the memory cache */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Banner")
  bool HasCachedBanner(const FString& BannerId) const;

  /** Clear all cached banner data */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Banner")
  void ClearCache();

  /** Get the configured API URL */
  const FString& GetApiUrl() const { return ApiUrl; }

  /** Get the configured API Token */
  const FString& GetApiToken() const { return ApiToken; }

  // ==================== Blueprint Events ====================

  /** Fires when FetchAllBanners completes */
  UPROPERTY(BlueprintAssignable, Category = "Gatrix|Banner|Events")
  FGatrixOnBannersLoaded OnAllBannersLoaded;

  /** Fires when FetchBannerById completes */
  UPROPERTY(BlueprintAssignable, Category = "Gatrix|Banner|Events")
  FGatrixOnBannerLoaded OnBannerLoaded;

private:
  // API configuration
  FString ApiUrl;
  FString ApiToken;
  TMap<FString, FString> CustomHeaders;

  // Memory cache: BannerId -> FGatrixBanner
  TMap<FString, FGatrixBanner> BannerCache;

  // JSON parsing
  static bool ParseBannerFromJson(const TSharedPtr<class FJsonObject>& JsonObj, FGatrixBanner& OutBanner);
  static bool ParseSequenceFromJson(const TSharedPtr<class FJsonObject>& JsonObj, FGatrixBannerSequence& OutSeq);
  static bool ParseFrameFromJson(const TSharedPtr<class FJsonObject>& JsonObj, FGatrixBannerFrame& OutFrame);
  static void ParseTargetingFromJson(const TSharedPtr<class FJsonObject>& JsonObj, FGatrixFrameTargeting& OutTargeting);

  // HTTP helpers
  TSharedRef<class IHttpRequest, ESPMode::ThreadSafe> CreateRequest(const FString& Endpoint) const;
};
