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

void UGatrixFlagProxy::TrackAccess(const FString &EventType) const {
  // Logic centralized in VariationProvider
}

bool UGatrixFlagProxy::IsEnabled() const {
  return Provider->IsEnabledInternal(FlagName);
}

bool UGatrixFlagProxy::BoolVariation(bool MissingValue) const {
  return Provider->BoolVariationInternal(FlagName, MissingValue);
}

FString UGatrixFlagProxy::StringVariation(const FString &MissingValue) const {
  return Provider->StringVariationInternal(FlagName, MissingValue);
}

int32 UGatrixFlagProxy::IntVariation(int32 MissingValue) const {
  return Provider->IntVariationInternal(FlagName, MissingValue);
}

float UGatrixFlagProxy::FloatVariation(float MissingValue) const {
  return Provider->FloatVariationInternal(FlagName, MissingValue);
}

double UGatrixFlagProxy::DoubleVariation(double MissingValue) const {
  return Provider->DoubleVariationInternal(FlagName, MissingValue);
}

FString UGatrixFlagProxy::JsonVariation(const FString &MissingValue) const {
  return Provider->JsonVariationInternal(FlagName, MissingValue);
}

FGatrixVariationResult
UGatrixFlagProxy::BoolVariationDetails(bool MissingValue) const {
  return Provider->BoolVariationDetailsInternal(FlagName, MissingValue);
}

FGatrixVariationResult
UGatrixFlagProxy::StringVariationDetails(const FString &MissingValue) const {
  return Provider->StringVariationDetailsInternal(FlagName, MissingValue);
}

FGatrixVariationResult
UGatrixFlagProxy::IntVariationDetails(int32 MissingValue) const {
  return Provider->IntVariationDetailsInternal(FlagName, MissingValue);
}

FGatrixVariationResult
UGatrixFlagProxy::FloatVariationDetails(float MissingValue) const {
  return Provider->FloatVariationDetailsInternal(FlagName, MissingValue);
}

FGatrixVariationResult
UGatrixFlagProxy::DoubleVariationDetails(double MissingValue) const {
  return Provider->DoubleVariationDetailsInternal(FlagName, MissingValue);
}

FGatrixVariationResult
UGatrixFlagProxy::JsonVariationDetails(const FString &MissingValue) const {
  return Provider->JsonVariationDetailsInternal(FlagName, MissingValue);
}

bool UGatrixFlagProxy::BoolVariationOrThrow() {
  return Provider->BoolVariationOrThrowInternal(FlagName);
}

FString UGatrixFlagProxy::StringVariationOrThrow() {
  return Provider->StringVariationOrThrowInternal(FlagName);
}

float UGatrixFlagProxy::FloatVariationOrThrow() {
  return Provider->FloatVariationOrThrowInternal(FlagName);
}

int32 UGatrixFlagProxy::IntVariationOrThrow() {
  return Provider->IntVariationOrThrowInternal(FlagName);
}

double UGatrixFlagProxy::DoubleVariationOrThrow() {
  return Provider->DoubleVariationOrThrowInternal(FlagName);
}

FString UGatrixFlagProxy::JsonVariationOrThrow() {
  return Provider->JsonVariationOrThrowInternal(FlagName);
}
