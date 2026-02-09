// Copyright Gatrix. All Rights Reserved.

#include "GatrixFlagProxy.h"

void UGatrixFlagProxy::Initialize(const FGatrixEvaluatedFlag &InFlag) {
  Flag = InFlag;
  bExists = true;
}

bool UGatrixFlagProxy::BoolVariation(bool DefaultValue) const {
  if (!bExists)
    return DefaultValue;
  return Flag.bEnabled;
}

FString UGatrixFlagProxy::StringVariation(const FString &DefaultValue) const {
  if (!bExists || !Flag.bEnabled)
    return DefaultValue;
  if (Flag.VariantType != EGatrixVariantType::String)
    return DefaultValue;
  if (Flag.Variant.Payload.IsEmpty())
    return DefaultValue;
  return Flag.Variant.Payload;
}

float UGatrixFlagProxy::NumberVariation(float DefaultValue) const {
  if (!bExists || !Flag.bEnabled)
    return DefaultValue;
  if (Flag.VariantType != EGatrixVariantType::Number)
    return DefaultValue;
  if (Flag.Variant.Payload.IsEmpty())
    return DefaultValue;
  return FCString::Atof(*Flag.Variant.Payload);
}

FString UGatrixFlagProxy::JsonVariation(const FString &DefaultValue) const {
  if (!bExists || !Flag.bEnabled)
    return DefaultValue;
  if (Flag.VariantType != EGatrixVariantType::Json)
    return DefaultValue;
  if (Flag.Variant.Payload.IsEmpty())
    return DefaultValue;
  return Flag.Variant.Payload;
}

FGatrixVariationResult
UGatrixFlagProxy::BoolVariationDetails(bool DefaultValue) const {
  FGatrixVariationResult Result;
  Result.bFlagExists = bExists;
  Result.bEnabled = bExists ? Flag.bEnabled : false;
  Result.Value =
      (bExists ? Flag.bEnabled : DefaultValue) ? TEXT("true") : TEXT("false");
  Result.Reason = bExists ? Flag.Reason : TEXT("flag_not_found");
  return Result;
}

FGatrixVariationResult
UGatrixFlagProxy::StringVariationDetails(const FString &DefaultValue) const {
  FGatrixVariationResult Result;
  Result.bFlagExists = bExists;
  Result.bEnabled = bExists ? Flag.bEnabled : false;
  Result.Value = StringVariation(DefaultValue);
  Result.Reason = bExists ? Flag.Reason : TEXT("flag_not_found");
  return Result;
}

FGatrixVariationResult
UGatrixFlagProxy::NumberVariationDetails(float DefaultValue) const {
  FGatrixVariationResult Result;
  Result.bFlagExists = bExists;
  Result.bEnabled = bExists ? Flag.bEnabled : false;
  Result.Value = FString::SanitizeFloat(NumberVariation(DefaultValue));
  Result.Reason = bExists ? Flag.Reason : TEXT("flag_not_found");
  return Result;
}
