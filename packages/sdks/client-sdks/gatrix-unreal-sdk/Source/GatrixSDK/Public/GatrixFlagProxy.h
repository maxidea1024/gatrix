// Copyright Gatrix. All Rights Reserved.
// FlagProxy wrapper for convenient flag access

#pragma once

#include "CoreMinimal.h"
#include "GatrixFlagProxy.generated.h"
#include "GatrixTypes.h"


/**
 * Proxy object wrapping a single evaluated flag.
 * Provides convenient typed access to flag values.
 * Blueprint-accessible via BlueprintCallable functions.
 */
UCLASS(BlueprintType, Transient)
class GATRIXSDK_API UGatrixFlagProxy : public UObject {
  GENERATED_BODY()

public:
  /** Initialize with evaluated flag data */
  void Initialize(const FGatrixEvaluatedFlag &InFlag);

  // ==================== Basic Getters ====================

  /** Get the flag name */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|FlagProxy")
  FString GetName() const { return Flag.Name; }

  /** Check if the flag is enabled */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|FlagProxy")
  bool IsEnabled() const { return Flag.bEnabled; }

  /** Get the variant */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|FlagProxy")
  FGatrixVariant GetVariant() const { return Flag.Variant; }

  /** Get the variant type */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|FlagProxy")
  EGatrixVariantType GetVariantType() const { return Flag.VariantType; }

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

  /** Get boolean variation (flag enabled state) */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  bool BoolVariation(bool DefaultValue) const;

  /** Get string variation from payload */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  FString StringVariation(const FString &DefaultValue) const;

  /** Get number variation from payload */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  float NumberVariation(float DefaultValue) const;

  /** Get JSON variation as string */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  FString JsonVariation(const FString &DefaultValue) const;

  // ==================== Variation Details ====================

  /** Get boolean variation with details */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  FGatrixVariationResult BoolVariationDetails(bool DefaultValue) const;

  /** Get string variation with details */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  FGatrixVariationResult
  StringVariationDetails(const FString &DefaultValue) const;

  /** Get number variation with details */
  UFUNCTION(BlueprintCallable, BlueprintPure,
            Category = "Gatrix|FlagProxy|Variation")
  FGatrixVariationResult NumberVariationDetails(float DefaultValue) const;

  /** Get the raw evaluated flag data */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|FlagProxy")
  FGatrixEvaluatedFlag GetEvaluatedFlag() const { return Flag; }

private:
  FGatrixEvaluatedFlag Flag;
  bool bExists = false;
};
