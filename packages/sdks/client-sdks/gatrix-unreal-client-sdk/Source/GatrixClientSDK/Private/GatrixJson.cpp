// Copyright Gatrix. All Rights Reserved.
// JSON serialization/deserialization utilities for Gatrix Unreal SDK.

#include "GatrixJson.h"

#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

// ==================== Value Type Helpers ====================

EGatrixValueType FGatrixJson::ParseValueType(const FString& TypeStr) {
  if (TypeStr == TEXT("string"))
    return EGatrixValueType::String;
  if (TypeStr == TEXT("number"))
    return EGatrixValueType::Number;
  if (TypeStr == TEXT("boolean"))
    return EGatrixValueType::Boolean;
  if (TypeStr == TEXT("json"))
    return EGatrixValueType::Json;
  return EGatrixValueType::None;
}

FString FGatrixJson::ValueTypeToString(EGatrixValueType Type) {
  switch (Type) {
  case EGatrixValueType::String:
    return TEXT("string");
  case EGatrixValueType::Number:
    return TEXT("number");
  case EGatrixValueType::Boolean:
    return TEXT("boolean");
  case EGatrixValueType::Json:
    return TEXT("json");
  default:
    return TEXT("none");
  }
}

// ==================== Variant Value Parsing ====================

void FGatrixJson::ParseVariantValue(const TSharedPtr<FJsonValue>& PayloadValue,
                                    EGatrixValueType ValueType, FString& OutValue) {
  if (!PayloadValue.IsValid()) {
    return;
  }

  switch (ValueType) {
  case EGatrixValueType::String:
    // Always extract as string regardless of JSON type
    if (PayloadValue->Type == EJson::String) {
      PayloadValue->TryGetString(OutValue);
    } else if (PayloadValue->Type == EJson::Number) {
      // Value was sent as number but type is string — convert without ".0"
      double NumVal = 0;
      PayloadValue->TryGetNumber(NumVal);
      if (FMath::IsNearlyEqual(NumVal, FMath::RoundToDouble(NumVal))) {
        OutValue = FString::Printf(TEXT("%lld"), static_cast<int64>(NumVal));
      } else {
        OutValue = FString::SanitizeFloat(NumVal);
      }
    } else if (PayloadValue->Type == EJson::Boolean) {
      bool BoolVal = false;
      PayloadValue->TryGetBool(BoolVal);
      OutValue = BoolVal ? TEXT("true") : TEXT("false");
    } else {
      OutValue = PayloadValue->AsString();
    }
    break;

  case EGatrixValueType::Number: {
    double NumVal = 0;
    if (PayloadValue->Type == EJson::Number) {
      PayloadValue->TryGetNumber(NumVal);
    } else if (PayloadValue->Type == EJson::String) {
      FString StrVal;
      PayloadValue->TryGetString(StrVal);
      NumVal = FCString::Atod(*StrVal);
    }
    OutValue = FString::SanitizeFloat(NumVal);
    break;
  }

  case EGatrixValueType::Boolean: {
    bool BoolVal = false;
    if (PayloadValue->Type == EJson::Boolean) {
      PayloadValue->TryGetBool(BoolVal);
    } else if (PayloadValue->Type == EJson::String) {
      FString StrVal;
      PayloadValue->TryGetString(StrVal);
      BoolVal = StrVal.Equals(TEXT("true"), ESearchCase::IgnoreCase);
    } else if (PayloadValue->Type == EJson::Number) {
      double NumVal = 0;
      PayloadValue->TryGetNumber(NumVal);
      BoolVal = (NumVal != 0);
    }
    OutValue = BoolVal ? TEXT("true") : TEXT("false");
    break;
  }

  case EGatrixValueType::Json:
  default: {
    // For JSON or unknown types, serialize back to JSON string
    if (PayloadValue->Type == EJson::String) {
      PayloadValue->TryGetString(OutValue);
    } else if (PayloadValue->Type == EJson::Object || PayloadValue->Type == EJson::Array) {
      FString JsonStr;
      TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&JsonStr);
      FJsonSerializer::Serialize(PayloadValue, TEXT(""), Writer);
      OutValue = JsonStr;
    } else {
      OutValue = PayloadValue->AsString();
    }
    break;
  }
  }
}

// ==================== Single Flag Parsing ====================

FGatrixEvaluatedFlag FGatrixJson::ParseFlag(const TSharedPtr<FJsonObject>& FlagObj) {
  FGatrixEvaluatedFlag Flag;
  if (!FlagObj.IsValid()) {
    return Flag;
  }

  FlagObj->TryGetStringField(TEXT("name"), Flag.Name);
  FlagObj->TryGetBoolField(TEXT("enabled"), Flag.bEnabled);
  FlagObj->TryGetNumberField(TEXT("version"), Flag.Version);
  FlagObj->TryGetStringField(TEXT("reason"), Flag.Reason);
  FlagObj->TryGetBoolField(TEXT("impressionData"), Flag.bImpressionData);

  // Parse value type
  FString TypeStr;
  FlagObj->TryGetStringField(TEXT("valueType"), TypeStr);
  Flag.ValueType = ParseValueType(TypeStr);

  // Parse variant
  const TSharedPtr<FJsonObject>* VariantObj = nullptr;
  if (FlagObj->TryGetObjectField(TEXT("variant"), VariantObj)) {
    (*VariantObj)->TryGetStringField(TEXT("name"), Flag.Variant.Name);
    (*VariantObj)->TryGetBoolField(TEXT("enabled"), Flag.Variant.bEnabled);

    const TSharedPtr<FJsonValue> PayloadValue = (*VariantObj)->TryGetField(TEXT("value"));
    ParseVariantValue(PayloadValue, Flag.ValueType, Flag.Variant.Value);
  }

  return Flag;
}

// ==================== Flags Response Parsing ====================

bool FGatrixJson::ParseFlagsResponse(const FString& Json, TArray<FGatrixEvaluatedFlag>& OutFlags) {
  TSharedPtr<FJsonObject> JsonObject;
  TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Json);
  if (!FJsonSerializer::Deserialize(Reader, JsonObject) || !JsonObject.IsValid()) {
    return false;
  }

  // Check success field
  bool bSuccess = false;
  JsonObject->TryGetBoolField(TEXT("success"), bSuccess);
  if (!bSuccess) {
    return false;
  }

  // Navigate to data.flags
  const TSharedPtr<FJsonObject>* DataObj = nullptr;
  if (!JsonObject->TryGetObjectField(TEXT("data"), DataObj)) {
    return false;
  }

  const TArray<TSharedPtr<FJsonValue>>* FlagsArray = nullptr;
  if (!(*DataObj)->TryGetArrayField(TEXT("flags"), FlagsArray)) {
    return false;
  }

  // Parse each flag
  for (const auto& FlagValue : *FlagsArray) {
    const TSharedPtr<FJsonObject>* FlagObj = nullptr;
    if (!FlagValue->TryGetObject(FlagObj)) {
      continue;
    }
    OutFlags.Add(ParseFlag(*FlagObj));
  }

  return true;
}

// ==================== Stored Flags Parsing ====================

bool FGatrixJson::ParseStoredFlags(const FString& Json, TArray<FGatrixEvaluatedFlag>& OutFlags) {
  TSharedPtr<FJsonValue> ParsedValue;
  TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Json);
  if (!FJsonSerializer::Deserialize(Reader, ParsedValue) || !ParsedValue.IsValid()) {
    return false;
  }

  const TArray<TSharedPtr<FJsonValue>>* FlagsArray = nullptr;
  if (!ParsedValue->TryGetArray(FlagsArray)) {
    return false;
  }

  for (const auto& FlagValue : *FlagsArray) {
    const TSharedPtr<FJsonObject>* FlagObj = nullptr;
    if (!FlagValue->TryGetObject(FlagObj)) {
      continue;
    }
    OutFlags.Add(ParseFlag(*FlagObj));
  }

  return true;
}

// ==================== Flags Serialization ====================

FString FGatrixJson::SerializeFlags(const TArray<FGatrixEvaluatedFlag>& Flags) {
  FString FlagsJson;
  TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&FlagsJson);
  Writer->WriteArrayStart();

  for (const auto& Flag : Flags) {
    Writer->WriteObjectStart();
    Writer->WriteValue(TEXT("name"), Flag.Name);
    Writer->WriteValue(TEXT("enabled"), Flag.bEnabled);
    Writer->WriteValue(TEXT("version"), Flag.Version);
    Writer->WriteValue(TEXT("reason"), Flag.Reason);
    Writer->WriteValue(TEXT("impressionData"), Flag.bImpressionData);
    Writer->WriteValue(TEXT("valueType"), ValueTypeToString(Flag.ValueType));

    Writer->WriteObjectStart(TEXT("variant"));
    Writer->WriteValue(TEXT("name"), Flag.Variant.Name);
    Writer->WriteValue(TEXT("enabled"), Flag.Variant.bEnabled);
    Writer->WriteValue(TEXT("value"), Flag.Variant.Value);
    Writer->WriteObjectEnd();

    Writer->WriteObjectEnd();
  }

  Writer->WriteArrayEnd();
  Writer->Close();

  return FlagsJson;
}

// ==================== Context Serialization ====================

FString FGatrixJson::SerializeContext(const FGatrixClientConfig& Config) {
  FString Json;
  TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Json);
  Writer->WriteObjectStart();
  Writer->WriteObjectStart(TEXT("context"));

  Writer->WriteValue(TEXT("appName"), Config.AppName);


  if (!Config.Features.Context.UserId.IsEmpty()) {
    Writer->WriteValue(TEXT("userId"), Config.Features.Context.UserId);
  }
  if (!Config.Features.Context.SessionId.IsEmpty()) {
    Writer->WriteValue(TEXT("sessionId"), Config.Features.Context.SessionId);
  }

  if (Config.Features.Context.Properties.Num() > 0) {
    Writer->WriteObjectStart(TEXT("properties"));
    for (const auto& Prop : Config.Features.Context.Properties) {
      Writer->WriteValue(Prop.Key, Prop.Value);
    }
    Writer->WriteObjectEnd();
  }

  Writer->WriteObjectEnd(); // context
  Writer->WriteObjectEnd();
  Writer->Close();

  return Json;
}

// ==================== Metrics Serialization ====================

FString FGatrixJson::SerializeMetrics(const FString& AppName,
                                      const FString& SdkName, const FString& SdkVersion,
                                      const FString& ConnectionId, const FDateTime& BucketStartTime,
                                      const TMap<FString, FFlagMetrics>& FlagBucket,
                                      const TMap<FString, int32>& MissingFlags) {
  if (FlagBucket.Num() == 0 && MissingFlags.Num() == 0) {
    return FString();
  }

  FString OutJson;
  TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&OutJson);
  Writer->WriteObjectStart();
  Writer->WriteValue(TEXT("appName"), AppName);

  Writer->WriteValue(TEXT("sdkName"), SdkName);
  Writer->WriteValue(TEXT("sdkVersion"), SdkVersion);
  Writer->WriteValue(TEXT("connectionId"), ConnectionId);

  Writer->WriteObjectStart(TEXT("bucket"));
  Writer->WriteValue(TEXT("start"), BucketStartTime.ToIso8601());
  Writer->WriteValue(TEXT("stop"), FDateTime::UtcNow().ToIso8601());

  // Flag access counts
  Writer->WriteObjectStart(TEXT("flags"));
  for (const auto& Pair : FlagBucket) {
    Writer->WriteObjectStart(Pair.Key);
    Writer->WriteValue(TEXT("yes"), Pair.Value.Yes);
    Writer->WriteValue(TEXT("no"), Pair.Value.No);

    if (Pair.Value.Variants.Num() > 0) {
      Writer->WriteObjectStart(TEXT("variants"));
      for (const auto& VarPair : Pair.Value.Variants) {
        Writer->WriteValue(VarPair.Key, VarPair.Value);
      }
      Writer->WriteObjectEnd();
    }

    Writer->WriteObjectEnd();
  }
  Writer->WriteObjectEnd(); // flags

  // Missing flags
  Writer->WriteObjectStart(TEXT("missing"));
  for (const auto& Pair : MissingFlags) {
    Writer->WriteValue(Pair.Key, Pair.Value);
  }
  Writer->WriteObjectEnd(); // missing

  Writer->WriteObjectEnd(); // bucket
  Writer->WriteObjectEnd();
  Writer->Close();

  return OutJson;
}
