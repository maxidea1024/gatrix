// Copyright Gatrix. All Rights Reserved.
// Interface for variation logic delegation

#pragma once

#include "CoreMinimal.h"
#include "GatrixTypes.h"
#include "GatrixVariationProvider.generated.h"
#include "UObject/Interface.h"

// This class does not need to be modified.
UINTERFACE(MinimalAPI)
class UGatrixVariationProvider : public UInterface {
  GENERATED_BODY()
};

/**
 * Interface for feature flag variation resolution.
 * FlagProxy delegates all variation calls to an implementation of this
 * interface (typically FeaturesClient) to ensure consistent metrics tracking
 * and logic.
 */
class GATRIXSDK_API IGatrixVariationProvider {
  GENERATED_BODY()

public:
  virtual bool IsEnabledInternal(const FString &FlagName,
                                 bool bForceRealtime = false) = 0;
  virtual FGatrixVariant GetVariantInternal(const FString &FlagName,
                                            bool bForceRealtime = false) = 0;

  virtual FString VariationInternal(const FString &FlagName,
                                    const FString &FallbackValue,
                                    bool bForceRealtime = false) = 0;
  virtual bool BoolVariationInternal(const FString &FlagName,
                                     bool FallbackValue,
                                     bool bForceRealtime = false) = 0;
  virtual FString StringVariationInternal(const FString &FlagName,
                                          const FString &FallbackValue,
                                          bool bForceRealtime = false) = 0;
  virtual float FloatVariationInternal(const FString &FlagName,
                                       float FallbackValue,
                                       bool bForceRealtime = false) = 0;
  virtual int32 IntVariationInternal(const FString &FlagName,
                                     int32 FallbackValue,
                                     bool bForceRealtime = false) = 0;
  virtual double DoubleVariationInternal(const FString &FlagName,
                                         double FallbackValue,
                                         bool bForceRealtime = false) = 0;
  virtual FString JsonVariationInternal(const FString &FlagName,
                                        const FString &FallbackValue,
                                        bool bForceRealtime = false) = 0;

  virtual FGatrixVariationResult
  BoolVariationDetailsInternal(const FString &FlagName, bool FallbackValue,
                               bool bForceRealtime = false) = 0;
  virtual FGatrixVariationResult
  StringVariationDetailsInternal(const FString &FlagName,
                                 const FString &FallbackValue,
                                 bool bForceRealtime = false) = 0;
  virtual FGatrixVariationResult
  FloatVariationDetailsInternal(const FString &FlagName, float FallbackValue,
                                bool bForceRealtime = false) = 0;
  virtual FGatrixVariationResult
  IntVariationDetailsInternal(const FString &FlagName, int32 FallbackValue,
                              bool bForceRealtime = false) = 0;
  virtual FGatrixVariationResult
  DoubleVariationDetailsInternal(const FString &FlagName, double FallbackValue,
                                 bool bForceRealtime = false) = 0;
  virtual FGatrixVariationResult
  JsonVariationDetailsInternal(const FString &FlagName,
                               const FString &FallbackValue,
                               bool bForceRealtime = false) = 0;

  virtual bool BoolVariationOrThrowInternal(const FString &FlagName,
                                            bool bForceRealtime = false) = 0;
  virtual FString
  StringVariationOrThrowInternal(const FString &FlagName,
                                 bool bForceRealtime = false) = 0;
  virtual float FloatVariationOrThrowInternal(const FString &FlagName,
                                              bool bForceRealtime = false) = 0;
  virtual int32 IntVariationOrThrowInternal(const FString &FlagName,
                                            bool bForceRealtime = false) = 0;
  virtual double
  DoubleVariationOrThrowInternal(const FString &FlagName,
                                 bool bForceRealtime = false) = 0;
  virtual FString JsonVariationOrThrowInternal(const FString &FlagName,
                                               bool bForceRealtime = false) = 0;
};
