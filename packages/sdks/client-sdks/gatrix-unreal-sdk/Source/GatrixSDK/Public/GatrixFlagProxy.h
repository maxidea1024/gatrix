// Copyright Gatrix. All Rights Reserved.
// FlagProxy - Thin shell that delegates ALL logic to IGatrixVariationProvider.

#pragma once

#include "CoreMinimal.h"
#include "GatrixFlagProxy.generated.h"
#include "GatrixTypes.h"

class IGatrixVariationProvider;

/**
 * FlagProxy - Thin shell that delegates ALL logic to IGatrixVariationProvider.
 *
 * Architecture per CLIENT_SDK_SPEC:
 * - Holds only FlagName + bForceRealtime + Provider pointer.
 * - ALL property reads and variation methods delegate to the provider.
 * - No deep copy of flag data - always reads live state from FeaturesClient
 * cache.
 * - IsRealtime() indicates the proxy's operational mode.
 * - Provider is always non-null.
 */
UCLASS(BlueprintType, Transient)
class GATRIXSDK_API UGatrixFlagProxy : public UObject {
  GENERATED_BODY()

public:
  /** Initialize with variation provider and flag name */
  void Initialize(IGatrixVariationProvider *InProvider,
                  const FString &InFlagName, bool bInForceRealtime = false);

  // ==================== Properties ====================

  /** Get the flag name */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|FlagProxy")
  FString GetName() const { return FlagName; }

  /** Whether this proxy was created in realtime mode */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|FlagProxy")
  bool IsRealtime() const { return bForceRealtime; }

  /** Whether the flag exists in the current cache */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|FlagProxy")
  bool Exists() const;

  /** Check if the flag is enabled. Delegates to provider for metrics tracking.
   */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|FlagProxy")
  bool IsEnabled() const;

  /** Get the variant */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|FlagProxy")
  FGatrixVariant GetVariant() const;

  /** Get the value type */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|FlagProxy")
  EGatrixValueType GetValueType() const;

  /** Get the version number */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|FlagProxy")
  int32 GetVersion() const;

  /** Get the evaluation reason */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|FlagProxy")
  FString GetReason() const;

  /** Get whether impression data is enabled */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|FlagProxy")
  bool HasImpressionData() const;

  /** Get the raw evaluated flag data */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|FlagProxy")
  FGatrixEvaluatedFlag GetEvaluatedFlag() const;

  // ==================== Variation Methods ====================
  // No per-method bForceRealtime — uses constructor value.

  /** Get boolean variation from variant value */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  bool BoolVariation(bool FallbackValue) const;

  /** Get string variation from value */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  FString StringVariation(const FString &FallbackValue) const;

  /** Get integer variation from value */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  int32 IntVariation(int32 FallbackValue) const;

  /** Get float variation from value */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  float FloatVariation(float FallbackValue) const;

  /** Get double variation from value */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  double DoubleVariation(double FallbackValue) const;

  /** Get JSON variation as string */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  FString JsonVariation(const FString &FallbackValue) const;

  // ==================== Variation Details ====================

  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  FGatrixVariationResult BoolVariationDetails(bool FallbackValue) const;

  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  FGatrixVariationResult
  StringVariationDetails(const FString &FallbackValue) const;

  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  FGatrixVariationResult IntVariationDetails(int32 FallbackValue) const;

  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  FGatrixVariationResult FloatVariationDetails(float FallbackValue) const;

  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  FGatrixVariationResult DoubleVariationDetails(double FallbackValue) const;

  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  FGatrixVariationResult
  JsonVariationDetails(const FString &FallbackValue) const;

  // ==================== OrThrow Variations ====================

  UFUNCTION(BlueprintCallable, Category = "Gatrix|FlagProxy|Variation")
  bool BoolVariationOrThrow();

  UFUNCTION(BlueprintCallable, Category = "Gatrix|FlagProxy|Variation")
  FString StringVariationOrThrow();

  UFUNCTION(BlueprintCallable, Category = "Gatrix|FlagProxy|Variation")
  float FloatVariationOrThrow();

  UFUNCTION(BlueprintCallable, Category = "Gatrix|FlagProxy|Variation")
  int32 IntVariationOrThrow();

  UFUNCTION(BlueprintCallable, Category = "Gatrix|FlagProxy|Variation")
  double DoubleVariationOrThrow();

  UFUNCTION(BlueprintCallable, Category = "Gatrix|FlagProxy|Variation")
  FString JsonVariationOrThrow();

private:
  FString FlagName;
  bool bForceRealtime = false;
  IGatrixVariationProvider *Provider = nullptr;
};
