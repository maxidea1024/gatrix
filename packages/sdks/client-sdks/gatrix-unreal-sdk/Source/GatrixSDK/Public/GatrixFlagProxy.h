// Copyright Gatrix. All Rights Reserved.
// FlagProxy wrapper for convenient flag access

#pragma once

#include "CoreMinimal.h"
#include "GatrixFlagProxy.generated.h"
#include "GatrixTypes.h"

class IGatrixVariationProvider;

/**
 * FlagProxy - Single source of truth for flag value extraction.
 *
 * This is a thin shell that delegates all evaluation and metrics tracking
 * to an IGatrixVariationProvider (typically the FeaturesClient).
 *
 * IMPORTANT: Provider is ALWAYS non-null. FlagProxy is exclusively created
 * by FeaturesClient, which passes itself as the provider.
 */
UCLASS(BlueprintType, Transient)
class GATRIXSDK_API UGatrixFlagProxy : public UObject {
  GENERATED_BODY()

public:
  /** Initialize with evaluated flag data and variation provider */
  void Initialize(const FGatrixEvaluatedFlag &InFlag,
                  IGatrixVariationProvider *InProvider,
                  const FString &InFlagName);

  // ==================== Basic Getters ====================

  /** Get the flag name */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|FlagProxy")
  FString GetName() const { return FlagName; }

  /** Whether the flag exists */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|FlagProxy")
  bool Exists() const { return bExists; }

  /** Check if the flag is enabled. Triggers metrics. */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|FlagProxy")
  bool IsEnabled() const;

  /** Get the variant */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|FlagProxy")
  FGatrixVariant GetVariant() const { return Flag.Variant; }

  /** Get the value type */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|FlagProxy")
  EGatrixValueType GetValueType() const { return Flag.ValueType; }

  /** Get the version number */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|FlagProxy")
  int32 GetVersion() const { return Flag.Version; }

  /** Get the evaluation reason */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|FlagProxy")
  FString GetReason() const { return Flag.Reason; }

  /** Get whether impression data is enabled */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|FlagProxy")
  bool HasImpressionData() const { return Flag.bImpressionData; }

  // ==================== Variation Methods ====================

  /** Get boolean variation from variant value */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  bool BoolVariation(bool FallbackValue, bool bForceRealtime = false) const;

  /** Get string variation from value */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  FString StringVariation(const FString &FallbackValue,
                          bool bForceRealtime = false) const;

  /** Get integer variation from value */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  int32 IntVariation(int32 FallbackValue, bool bForceRealtime = false) const;

  /** Get float variation from value */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  float FloatVariation(float FallbackValue, bool bForceRealtime = false) const;

  /** Get double variation from value */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  double DoubleVariation(double FallbackValue,
                         bool bForceRealtime = false) const;

  /** Get JSON variation as string */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  FString JsonVariation(const FString &FallbackValue,
                        bool bForceRealtime = false) const;

  // ==================== Variation Details ====================

  /** Get boolean variation with details */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  FGatrixVariationResult
  BoolVariationDetails(bool FallbackValue, bool bForceRealtime = false) const;

  /** Get string variation with details */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  FGatrixVariationResult
  StringVariationDetails(const FString &FallbackValue,
                         bool bForceRealtime = false) const;

  /** Get integer variation with details */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  FGatrixVariationResult IntVariationDetails(int32 FallbackValue,
                                             bool bForceRealtime = false) const;

  /** Get float variation with details */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  FGatrixVariationResult
  FloatVariationDetails(float FallbackValue, bool bForceRealtime = false) const;

  /** Get double variation with details */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  FGatrixVariationResult
  DoubleVariationDetails(double FallbackValue,
                         bool bForceRealtime = false) const;

  /** Get JSON variation with details */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  FGatrixVariationResult
  JsonVariationDetails(const FString &FallbackValue,
                       bool bForceRealtime = false) const;

  // ==================== OrThrow Variations ====================

  UFUNCTION(BlueprintCallable, Category = "Gatrix|FlagProxy|Variation")
  bool BoolVariationOrThrow(bool bForceRealtime = false);

  UFUNCTION(BlueprintCallable, Category = "Gatrix|FlagProxy|Variation")
  FString StringVariationOrThrow(bool bForceRealtime = false);

  UFUNCTION(BlueprintCallable, Category = "Gatrix|FlagProxy|Variation")
  float FloatVariationOrThrow(bool bForceRealtime = false);

  UFUNCTION(BlueprintCallable, Category = "Gatrix|FlagProxy|Variation")
  int32 IntVariationOrThrow(bool bForceRealtime = false);

  UFUNCTION(BlueprintCallable, Category = "Gatrix|FlagProxy|Variation")
  double DoubleVariationOrThrow(bool bForceRealtime = false);

  UFUNCTION(BlueprintCallable, Category = "Gatrix|FlagProxy|Variation")
  FString JsonVariationOrThrow(bool bForceRealtime = false);

  /** Get the raw evaluated flag data */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|FlagProxy")
  FGatrixEvaluatedFlag GetEvaluatedFlag() const { return Flag; }

private:
  FGatrixEvaluatedFlag Flag;
  FString FlagName;
  bool bExists = false;
  IGatrixVariationProvider *Provider = nullptr;
};
