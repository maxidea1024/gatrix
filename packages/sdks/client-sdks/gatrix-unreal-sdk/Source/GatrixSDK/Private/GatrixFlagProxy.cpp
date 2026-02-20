// Copyright Gatrix. All Rights Reserved.

#include "GatrixFlagProxy.h"
#include "GatrixVariationProvider.h"

void UGatrixFlagProxy::Initialize(IGatrixVariationProvider* InProvider, const FString& InFlagName,
                                  bool bInForceRealtime) {
  check(InProvider); // Provider must not be null
  FlagName = InFlagName;
  bForceRealtime = bInForceRealtime;
  Provider = InProvider;
}

// ==================== Properties ====================

bool UGatrixFlagProxy::Exists() const {
  return Provider->HasFlagInternal(FlagName, bForceRealtime);
}

bool UGatrixFlagProxy::IsEnabled() const {
  return Provider->IsEnabledInternal(FlagName, bForceRealtime);
}

FGatrixVariant UGatrixFlagProxy::GetVariant() const {
  return Provider->GetVariantInternal(FlagName, bForceRealtime);
}

EGatrixValueType UGatrixFlagProxy::GetValueType() const {
  return Provider->GetValueTypeInternal(FlagName, bForceRealtime);
}

int32 UGatrixFlagProxy::GetVersion() const {
  return Provider->GetVersionInternal(FlagName, bForceRealtime);
}

FString UGatrixFlagProxy::GetReason() const {
  return Provider->GetReasonInternal(FlagName, bForceRealtime);
}

bool UGatrixFlagProxy::HasImpressionData() const {
  return Provider->GetImpressionDataInternal(FlagName, bForceRealtime);
}

FGatrixEvaluatedFlag UGatrixFlagProxy::GetEvaluatedFlag() const {
  return Provider->GetRawFlagInternal(FlagName, bForceRealtime);
}

// ==================== Variation Methods ====================

bool UGatrixFlagProxy::BoolVariation(bool FallbackValue) const {
  return Provider->BoolVariationInternal(FlagName, FallbackValue, bForceRealtime);
}

FString UGatrixFlagProxy::StringVariation(const FString& FallbackValue) const {
  return Provider->StringVariationInternal(FlagName, FallbackValue, bForceRealtime);
}

int32 UGatrixFlagProxy::IntVariation(int32 FallbackValue) const {
  return Provider->IntVariationInternal(FlagName, FallbackValue, bForceRealtime);
}

float UGatrixFlagProxy::FloatVariation(float FallbackValue) const {
  return Provider->FloatVariationInternal(FlagName, FallbackValue, bForceRealtime);
}

double UGatrixFlagProxy::DoubleVariation(double FallbackValue) const {
  return Provider->DoubleVariationInternal(FlagName, FallbackValue, bForceRealtime);
}

FString UGatrixFlagProxy::JsonVariation(const FString& FallbackValue) const {
  return Provider->JsonVariationInternal(FlagName, FallbackValue, bForceRealtime);
}

// ==================== Variation Details ====================

FGatrixVariationResult UGatrixFlagProxy::BoolVariationDetails(bool FallbackValue) const {
  return Provider->BoolVariationDetailsInternal(FlagName, FallbackValue, bForceRealtime);
}

FGatrixVariationResult
UGatrixFlagProxy::StringVariationDetails(const FString& FallbackValue) const {
  return Provider->StringVariationDetailsInternal(FlagName, FallbackValue, bForceRealtime);
}

FGatrixVariationResult UGatrixFlagProxy::IntVariationDetails(int32 FallbackValue) const {
  return Provider->IntVariationDetailsInternal(FlagName, FallbackValue, bForceRealtime);
}

FGatrixVariationResult UGatrixFlagProxy::FloatVariationDetails(float FallbackValue) const {
  return Provider->FloatVariationDetailsInternal(FlagName, FallbackValue, bForceRealtime);
}

FGatrixVariationResult UGatrixFlagProxy::DoubleVariationDetails(double FallbackValue) const {
  return Provider->DoubleVariationDetailsInternal(FlagName, FallbackValue, bForceRealtime);
}

FGatrixVariationResult UGatrixFlagProxy::JsonVariationDetails(const FString& FallbackValue) const {
  return Provider->JsonVariationDetailsInternal(FlagName, FallbackValue, bForceRealtime);
}

// ==================== OrThrow Variations ====================

bool UGatrixFlagProxy::BoolVariationOrThrow() {
  return Provider->BoolVariationOrThrowInternal(FlagName, bForceRealtime);
}

FString UGatrixFlagProxy::StringVariationOrThrow() {
  return Provider->StringVariationOrThrowInternal(FlagName, bForceRealtime);
}

float UGatrixFlagProxy::FloatVariationOrThrow() {
  return Provider->FloatVariationOrThrowInternal(FlagName, bForceRealtime);
}

int32 UGatrixFlagProxy::IntVariationOrThrow() {
  return Provider->IntVariationOrThrowInternal(FlagName, bForceRealtime);
}

double UGatrixFlagProxy::DoubleVariationOrThrow() {
  return Provider->DoubleVariationOrThrowInternal(FlagName, bForceRealtime);
}

FString UGatrixFlagProxy::JsonVariationOrThrow() {
  return Provider->JsonVariationOrThrowInternal(FlagName, bForceRealtime);
}
