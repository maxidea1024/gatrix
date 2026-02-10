// Copyright Gatrix. All Rights Reserved.

#include "GatrixFlagProxy.h"

void UGatrixFlagProxy::Initialize(const FGatrixEvaluatedFlag &InFlag,
                                  const FGatrixFlagAccessCallback &InOnAccess) {
  Flag = InFlag;
  FlagName = InFlag.Name;
  bExists = true;
  OnAccess = InOnAccess;
}

void UGatrixFlagProxy::Initialize(const FGatrixEvaluatedFlag &InFlag) {
  Flag = InFlag;
  FlagName = InFlag.Name;
  bExists = true;
}

void UGatrixFlagProxy::TrackAccess(const FString &EventType) const {
  if (OnAccess.IsBound()) {
    if (bExists) {
      OnAccess.Execute(FlagName, &Flag, EventType, Flag.Variant.Name);
    } else {
      OnAccess.Execute(FlagName, nullptr, EventType, TEXT(""));
    }
  }
}

bool UGatrixFlagProxy::IsEnabled() const {
  TrackAccess(TEXT("isEnabled"));
  if (!bExists)
    return false;
  return Flag.bEnabled;
}

bool UGatrixFlagProxy::BoolVariation(bool MissingValue) const {
  TrackAccess(TEXT("getVariant"));
  if (!bExists)
    return MissingValue;
  // Strict: ValueType must be Boolean
  if (Flag.ValueType != EGatrixValueType::None &&
      Flag.ValueType != EGatrixValueType::Boolean) {
    return MissingValue;
  }
  if (Flag.Variant.Value.IsEmpty())
    return MissingValue;
  return Flag.Variant.Value.ToBool();
}

FString UGatrixFlagProxy::StringVariation(const FString &MissingValue) const {
  TrackAccess(TEXT("getVariant"));
  if (!bExists)
    return MissingValue;
  // Strict: ValueType must be String
  if (Flag.ValueType != EGatrixValueType::None &&
      Flag.ValueType != EGatrixValueType::String) {
    return MissingValue;
  }
  if (Flag.Variant.Value.IsEmpty())
    return MissingValue;
  return Flag.Variant.Value;
}

float UGatrixFlagProxy::NumberVariation(float MissingValue) const {
  return FloatVariation(MissingValue);
}

int32 UGatrixFlagProxy::IntVariation(int32 MissingValue) const {
  TrackAccess(TEXT("getVariant"));
  if (!bExists)
    return MissingValue;
  if (Flag.ValueType != EGatrixValueType::None &&
      Flag.ValueType != EGatrixValueType::Number) {
    return MissingValue;
  }
  if (Flag.Variant.Value.IsEmpty())
    return MissingValue;
  return FCString::Atoi(*Flag.Variant.Value);
}

float UGatrixFlagProxy::FloatVariation(float MissingValue) const {
  TrackAccess(TEXT("getVariant"));
  if (!bExists)
    return MissingValue;
  if (Flag.ValueType != EGatrixValueType::None &&
      Flag.ValueType != EGatrixValueType::Number) {
    return MissingValue;
  }
  if (Flag.Variant.Value.IsEmpty())
    return MissingValue;
  return FCString::Atof(*Flag.Variant.Value);
}

double UGatrixFlagProxy::DoubleVariation(double MissingValue) const {
  TrackAccess(TEXT("getVariant"));
  if (!bExists)
    return MissingValue;
  if (Flag.ValueType != EGatrixValueType::None &&
      Flag.ValueType != EGatrixValueType::Number) {
    return MissingValue;
  }
  if (Flag.Variant.Value.IsEmpty())
    return MissingValue;
  return FCString::Atod(*Flag.Variant.Value);
}

FString UGatrixFlagProxy::JsonVariation(const FString &MissingValue) const {
  TrackAccess(TEXT("getVariant"));
  if (!bExists)
    return MissingValue;
  // Strict: ValueType must be Json
  if (Flag.ValueType != EGatrixValueType::None &&
      Flag.ValueType != EGatrixValueType::Json) {
    return MissingValue;
  }
  if (Flag.Variant.Value.IsEmpty())
    return MissingValue;
  return Flag.Variant.Value;
}

FGatrixVariationResult
UGatrixFlagProxy::BoolVariationDetails(bool MissingValue) const {
  FGatrixVariationResult Result;
  Result.bFlagExists = bExists;
  Result.bEnabled = bExists ? Flag.bEnabled : false;
  TrackAccess(TEXT("getVariant"));
  if (!bExists) {
    Result.Value = MissingValue ? TEXT("true") : TEXT("false");
    Result.Reason = TEXT("flag_not_found");
    return Result;
  }
  if (Flag.ValueType != EGatrixValueType::None &&
      Flag.ValueType != EGatrixValueType::Boolean) {
    Result.Value = MissingValue ? TEXT("true") : TEXT("false");
    Result.Reason = TEXT("type_mismatch:expected_boolean");
    return Result;
  }
  bool Val =
      Flag.Variant.Value.IsEmpty() ? MissingValue : Flag.Variant.Value.ToBool();
  Result.Value = Val ? TEXT("true") : TEXT("false");
  Result.Reason = Flag.Reason.IsEmpty() ? TEXT("evaluated") : Flag.Reason;
  return Result;
}

FGatrixVariationResult
UGatrixFlagProxy::StringVariationDetails(const FString &MissingValue) const {
  FGatrixVariationResult Result;
  Result.bFlagExists = bExists;
  Result.bEnabled = bExists ? Flag.bEnabled : false;
  TrackAccess(TEXT("getVariant"));
  if (!bExists) {
    Result.Value = MissingValue;
    Result.Reason = TEXT("flag_not_found");
    return Result;
  }
  if (Flag.ValueType != EGatrixValueType::None &&
      Flag.ValueType != EGatrixValueType::String) {
    Result.Value = MissingValue;
    Result.Reason = TEXT("type_mismatch:expected_string");
    return Result;
  }
  Result.Value =
      Flag.Variant.Value.IsEmpty() ? MissingValue : Flag.Variant.Value;
  Result.Reason = Flag.Reason.IsEmpty() ? TEXT("evaluated") : Flag.Reason;
  return Result;
}

FGatrixVariationResult
UGatrixFlagProxy::NumberVariationDetails(float MissingValue) const {
  return FloatVariationDetails(MissingValue);
}

FGatrixVariationResult
UGatrixFlagProxy::IntVariationDetails(int32 MissingValue) const {
  FGatrixVariationResult Result;
  Result.bFlagExists = bExists;
  Result.bEnabled = bExists ? Flag.bEnabled : false;
  TrackAccess(TEXT("getVariant"));
  if (!bExists) {
    Result.Value = FString::FromInt(MissingValue);
    Result.Reason = TEXT("flag_not_found");
    return Result;
  }
  if (Flag.ValueType != EGatrixValueType::None &&
      Flag.ValueType != EGatrixValueType::Number) {
    Result.Value = FString::FromInt(MissingValue);
    Result.Reason = TEXT("type_mismatch:expected_number");
    return Result;
  }
  int32 Val = Flag.Variant.Value.IsEmpty()
                  ? MissingValue
                  : FCString::Atoi(*Flag.Variant.Value);
  Result.Value = FString::FromInt(Val);
  Result.Reason = Flag.Reason.IsEmpty() ? TEXT("evaluated") : Flag.Reason;
  return Result;
}

FGatrixVariationResult
UGatrixFlagProxy::FloatVariationDetails(float MissingValue) const {
  FGatrixVariationResult Result;
  Result.bFlagExists = bExists;
  Result.bEnabled = bExists ? Flag.bEnabled : false;
  TrackAccess(TEXT("getVariant"));
  if (!bExists) {
    Result.Value = FString::SanitizeFloat(MissingValue);
    Result.Reason = TEXT("flag_not_found");
    return Result;
  }
  if (Flag.ValueType != EGatrixValueType::None &&
      Flag.ValueType != EGatrixValueType::Number) {
    Result.Value = FString::SanitizeFloat(MissingValue);
    Result.Reason = TEXT("type_mismatch:expected_number");
    return Result;
  }
  float Val = Flag.Variant.Value.IsEmpty()
                  ? MissingValue
                  : FCString::Atof(*Flag.Variant.Value);
  Result.Value = FString::SanitizeFloat(Val);
  Result.Reason = Flag.Reason.IsEmpty() ? TEXT("evaluated") : Flag.Reason;
  return Result;
}

FGatrixVariationResult
UGatrixFlagProxy::DoubleVariationDetails(double MissingValue) const {
  FGatrixVariationResult Result;
  Result.bFlagExists = bExists;
  Result.bEnabled = bExists ? Flag.bEnabled : false;
  TrackAccess(TEXT("getVariant"));
  if (!bExists) {
    Result.Value = FString::Printf(TEXT("%f"), MissingValue);
    Result.Reason = TEXT("flag_not_found");
    return Result;
  }
  if (Flag.ValueType != EGatrixValueType::None &&
      Flag.ValueType != EGatrixValueType::Number) {
    Result.Value = FString::Printf(TEXT("%f"), MissingValue);
    Result.Reason = TEXT("type_mismatch:expected_number");
    return Result;
  }
  double Val = Flag.Variant.Value.IsEmpty()
                   ? MissingValue
                   : FCString::Atod(*Flag.Variant.Value);
  Result.Value = FString::Printf(TEXT("%f"), Val);
  Result.Reason = Flag.Reason.IsEmpty() ? TEXT("evaluated") : Flag.Reason;
  return Result;
}
