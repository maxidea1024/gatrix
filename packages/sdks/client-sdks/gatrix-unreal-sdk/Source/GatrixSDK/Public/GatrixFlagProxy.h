// Copyright Gatrix. All Rights Reserved.
// FlagProxy wrapper for convenient flag access

#pragma once

#include "CoreMinimal.h"
#include "GatrixFlagProxy.generated.h"
#include "GatrixTypes.h"

/**
 * Callback for flag access metrics tracking.
 * Parameters: FlagName, Flag (nullable), EventType, VariantName
 */
DECLARE_DELEGATE_FourParams(FGatrixFlagAccessCallback,
                            const FString & /*FlagName*/,
                            const FGatrixEvaluatedFlag * /*Flag*/,
                            const FString & /*EventType*/,
                            const FString & /*VariantName*/);

/**
 * FlagProxy - Single source of truth for flag value extraction.
 *
 * Uses null object pattern: bExists tracks whether flag was found.
 * onAccess callback is injected by FeaturesClient for metrics tracking.
 * Type safety: ValueType is checked strictly.
 *
 * boolVariation returns variant.Value (NOT flag.bEnabled).
 */
UCLASS(BlueprintType, Transient)
class GATRIXSDK_API UGatrixFlagProxy : public UObject {
  GENERATED_BODY()

public:
  /** Initialize with evaluated flag data and metrics callback */
  void Initialize(const FGatrixEvaluatedFlag &InFlag,
                  const FGatrixFlagAccessCallback &InOnAccess);

  /** Initialize without callback (for Blueprint/testing) */
  void Initialize(const FGatrixEvaluatedFlag &InFlag);

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
  bool BoolVariation(bool MissingValue) const;

  /** Get string variation from value */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  FString StringVariation(const FString &MissingValue) const;

  /** Get number variation from value */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  float NumberVariation(float MissingValue) const;

  /** Get integer variation from value */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  int32 IntVariation(int32 MissingValue) const;

  /** Get float variation from value */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  float FloatVariation(float MissingValue) const;

  /** Get double variation from value */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  double DoubleVariation(double MissingValue) const;

  /** Get JSON variation as string */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  FString JsonVariation(const FString &MissingValue) const;

  // ==================== Variation Details ====================

  /** Get boolean variation with details */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  FGatrixVariationResult BoolVariationDetails(bool MissingValue) const;

  /** Get string variation with details */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  FGatrixVariationResult
  StringVariationDetails(const FString &MissingValue) const;

  /** Get number variation with details */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  FGatrixVariationResult NumberVariationDetails(float MissingValue) const;

  /** Get integer variation with details */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  FGatrixVariationResult IntVariationDetails(int32 MissingValue) const;

  /** Get float variation with details */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  FGatrixVariationResult FloatVariationDetails(float MissingValue) const;

  /** Get double variation with details */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  FGatrixVariationResult DoubleVariationDetails(double MissingValue) const;

  /** Get the raw evaluated flag data */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|FlagProxy")
  FGatrixEvaluatedFlag GetEvaluatedFlag() const { return Flag; }

private:
  FGatrixEvaluatedFlag Flag;
  FString FlagName;
  bool bExists = false;
  FGatrixFlagAccessCallback OnAccess;

  /** Fire onAccess callback */
  void TrackAccess(const FString &EventType) const;
};
