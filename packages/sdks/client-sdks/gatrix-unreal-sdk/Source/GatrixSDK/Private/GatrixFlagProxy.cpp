// Copyright Gatrix. All Rights Reserved.

#include "GatrixFlagProxy.h"
#include "GatrixVariationProvider.h"

void UGatrixFlagProxy::Initialize(const FGatrixEvaluatedFlag &InFlag,
                                  IGatrixVariationProvider *InProvider,
                                  const FString &InFlagName) {
  check(InProvider); // Provider must not be null
  Flag = InFlag;
  FlagName = InFlagName;
  bExists = InProvider->GetVariantInternal(InFlagName).Name != TEXT("$missing");
  Provider = InProvider;
}

bool UGatrixFlagProxy::IsEnabled() const {
  return Provider->IsEnabledInternal(FlagName);
}

bool UGatrixFlagProxy::BoolVariation(bool FallbackValue,
                                     bool bForceRealtime) const {
  return Provider->BoolVariationInternal(FlagName, FallbackValue,
                                         bForceRealtime);
}

FString UGatrixFlagProxy::StringVariation(const FString &FallbackValue,
                                          bool bForceRealtime) const {
  return Provider->StringVariationInternal(FlagName, FallbackValue,
                                           bForceRealtime);
}

int32 UGatrixFlagProxy::IntVariation(int32 FallbackValue,
                                     bool bForceRealtime) const {
  return Provider->IntVariationInternal(FlagName, FallbackValue,
                                        bForceRealtime);
}

float UGatrixFlagProxy::FloatVariation(float FallbackValue,
                                       bool bForceRealtime) const {
  return Provider->FloatVariationInternal(FlagName, FallbackValue,
                                          bForceRealtime);
}

double UGatrixFlagProxy::DoubleVariation(double FallbackValue,
                                         bool bForceRealtime) const {
  return Provider->DoubleVariationInternal(FlagName, FallbackValue,
                                           bForceRealtime);
}

FString UGatrixFlagProxy::JsonVariation(const FString &FallbackValue,
                                        bool bForceRealtime) const {
  return Provider->JsonVariationInternal(FlagName, FallbackValue,
                                         bForceRealtime);
}

FGatrixVariationResult
UGatrixFlagProxy::BoolVariationDetails(bool FallbackValue,
                                       bool bForceRealtime) const {
  return Provider->BoolVariationDetailsInternal(FlagName, FallbackValue,
                                                bForceRealtime);
}

FGatrixVariationResult
UGatrixFlagProxy::StringVariationDetails(const FString &FallbackValue,
                                         bool bForceRealtime) const {
  return Provider->StringVariationDetailsInternal(FlagName, FallbackValue,
                                                  bForceRealtime);
}

FGatrixVariationResult
UGatrixFlagProxy::IntVariationDetails(int32 FallbackValue,
                                      bool bForceRealtime) const {
  return Provider->IntVariationDetailsInternal(FlagName, FallbackValue,
                                               bForceRealtime);
}

FGatrixVariationResult
UGatrixFlagProxy::FloatVariationDetails(float FallbackValue,
                                        bool bForceRealtime) const {
  return Provider->FloatVariationDetailsInternal(FlagName, FallbackValue,
                                                 bForceRealtime);
}

FGatrixVariationResult
UGatrixFlagProxy::DoubleVariationDetails(double FallbackValue,
                                         bool bForceRealtime) const {
  return Provider->DoubleVariationDetailsInternal(FlagName, FallbackValue,
                                                  bForceRealtime);
}

FGatrixVariationResult
UGatrixFlagProxy::JsonVariationDetails(const FString &FallbackValue,
                                       bool bForceRealtime) const {
  return Provider->JsonVariationDetailsInternal(FlagName, FallbackValue,
                                                bForceRealtime);
}

bool UGatrixFlagProxy::BoolVariationOrThrow(bool bForceRealtime) {
  return Provider->BoolVariationOrThrowInternal(FlagName, bForceRealtime);
}

FString UGatrixFlagProxy::StringVariationOrThrow(bool bForceRealtime) {
  return Provider->StringVariationOrThrowInternal(FlagName, bForceRealtime);
}

float UGatrixFlagProxy::FloatVariationOrThrow(bool bForceRealtime) {
  return Provider->FloatVariationOrThrowInternal(FlagName, bForceRealtime);
}

int32 UGatrixFlagProxy::IntVariationOrThrow(bool bForceRealtime) {
  return Provider->IntVariationOrThrowInternal(FlagName, bForceRealtime);
}

double UGatrixFlagProxy::DoubleVariationOrThrow(bool bForceRealtime) {
  return Provider->DoubleVariationOrThrowInternal(FlagName, bForceRealtime);
}

FString UGatrixFlagProxy::JsonVariationOrThrow(bool bForceRealtime) {
  return Provider->JsonVariationOrThrowInternal(FlagName, bForceRealtime);
}
