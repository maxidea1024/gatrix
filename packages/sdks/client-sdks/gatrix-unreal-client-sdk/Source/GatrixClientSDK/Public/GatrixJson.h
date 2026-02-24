// Copyright Gatrix. All Rights Reserved.
// JSON serialization/deserialization utilities for Gatrix Unreal SDK.
// Provides static helper functions to eliminate duplicate JSON
// parsing/serialization code across the SDK.

#pragma once

#include "CoreMinimal.h"
#include "GatrixTypes.h"

/**
 * Static JSON utility class for the Gatrix SDK.
 * Handles serialization/deserialization of SDK types
 * (flags, context, metrics) without duplicating JSON code.
 */
class GATRIXCLIENTSDK_API FGatrixJson {
public:
  // ==================== Flags Response Parsing ====================

  /**
   * Parse a flags API response JSON string into an array of evaluated flags.
   * Handles the envelope: { "success": true, "data": { "flags": [...] } }
   * @param Json            Raw JSON response body
   * @param OutFlags        Parsed flags are appended here
   * @return true if parsing succeeded and success==true
   */
  static bool ParseFlagsResponse(const FString& Json, TArray<FGatrixEvaluatedFlag>& OutFlags);

  /**
   * Parse a stored flags JSON string (bare array) into evaluated flags.
   * Used when loading cached flags from local storage.
   * @param Json            JSON array string
   * @param OutFlags        Parsed flags are appended here
   * @return true if parsing succeeded
   */
  static bool ParseStoredFlags(const FString& Json, TArray<FGatrixEvaluatedFlag>& OutFlags);

  // ==================== Flags Serialization ====================

  /**
   * Serialize a flag array to JSON for local storage.
   * @param Flags           Flags to serialize
   * @return JSON array string
   */
  static FString SerializeFlags(const TArray<FGatrixEvaluatedFlag>& Flags);

  // ==================== Context Serialization ====================

  /**
   * Serialize an evaluation context to a POST request body.
   * Output format: { "context": { ... } }
   * @param Config          Client config containing context data
   * @return JSON string
   */
  static FString SerializeContext(const FGatrixClientConfig& Config);

  // ==================== Metrics Serialization ====================

  /** Per-flag metrics bucket data */
  struct FFlagMetrics {
    int32 Yes = 0;
    int32 No = 0;
    TMap<FString, int32> Variants;
  };

  /**
   * Serialize a metrics payload to JSON.
   * @param AppName               Application name
   * @param Environment           Environment name
   * @param SdkName               SDK name string
   * @param SdkVersion            SDK version string
   * @param ConnectionId          Connection identifier
   * @param BucketStartTime       Bucket window start time
   * @param FlagBucket            Per-flag access counts
   * @param MissingFlags          Missing flag access counts
   * @return JSON string, or empty if no data
   */
  static FString SerializeMetrics(const FString& AppName, const FString& Environment,
                                  const FString& SdkName, const FString& SdkVersion,
                                  const FString& ConnectionId, const FDateTime& BucketStartTime,
                                  const TMap<FString, FFlagMetrics>& FlagBucket,
                                  const TMap<FString, int32>& MissingFlags);

  // ==================== Value Type Helpers ====================

  /**
   * Parse a valueType string from the API into the enum.
   * @param TypeStr         "string", "number", "boolean", "json"
   * @return Corresponding EGatrixValueType (None if unrecognized)
   */
  static EGatrixValueType ParseValueType(const FString& TypeStr);

  /**
   * Convert a valueType enum to API string representation.
   * @param Type            Enum value
   * @return "string", "number", "boolean", "json", or "none"
   */
  static FString ValueTypeToString(EGatrixValueType Type);

private:
  /**
   * Parse a single flag JSON object into an FGatrixEvaluatedFlag.
   * Shared by ParseFlagsResponse and ParseStoredFlags.
   */
  static FGatrixEvaluatedFlag ParseFlag(const TSharedPtr<FJsonObject>& FlagObj);

  /**
   * Parse a variant value with proper type coercion based on valueType.
   * Handles mismatches between JSON wire type and declared valueType.
   */
  static void ParseVariantValue(const TSharedPtr<FJsonValue>& PayloadValue,
                                EGatrixValueType ValueType, FString& OutValue);
};
