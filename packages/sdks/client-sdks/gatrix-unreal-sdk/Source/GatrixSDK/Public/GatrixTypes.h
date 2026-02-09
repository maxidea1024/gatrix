// Copyright Gatrix. All Rights Reserved.
// Type definitions for Gatrix Unreal SDK

#pragma once

#include "CoreMinimal.h"
#include "GatrixTypes.generated.h"

// ==================== Enums ====================

/** SDK internal state */
UENUM(BlueprintType)
enum class EGatrixSdkState : uint8 {
  Initializing UMETA(DisplayName = "Initializing"),
  Ready UMETA(DisplayName = "Ready"),
  Healthy UMETA(DisplayName = "Healthy"),
  Error UMETA(DisplayName = "Error")
};

/** Variant payload type */
UENUM(BlueprintType)
enum class EGatrixVariantType : uint8 {
  None UMETA(DisplayName = "None"),
  String UMETA(DisplayName = "String"),
  Number UMETA(DisplayName = "Number"),
  Json UMETA(DisplayName = "Json")
};

// ==================== Structs ====================

/** Variant information from server evaluation */
USTRUCT(BlueprintType)
struct GATRIXSDK_API FGatrixVariant {
  GENERATED_BODY()

  /** Variant name */
  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  FString Name;

  /** Whether the flag is enabled */
  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  bool bEnabled = false;

  /** Payload as string (type depends on VariantType) */
  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  FString Payload;

  FGatrixVariant() {}
  FGatrixVariant(const FString &InName, bool bInEnabled,
                 const FString &InPayload = TEXT(""))
      : Name(InName), bEnabled(bInEnabled), Payload(InPayload) {}

  static FGatrixVariant Disabled() {
    return FGatrixVariant(TEXT("disabled"), false);
  }
};

/** Evaluated feature flag from the server */
USTRUCT(BlueprintType)
struct GATRIXSDK_API FGatrixEvaluatedFlag {
  GENERATED_BODY()

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  FString Name;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  bool bEnabled = false;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  FGatrixVariant Variant;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  EGatrixVariantType VariantType = EGatrixVariantType::None;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  int32 Version = 0;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  FString Reason;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  bool bImpressionData = false;
};

/** Evaluation context (global for client-side) */
USTRUCT(BlueprintType)
struct GATRIXSDK_API FGatrixContext {
  GENERATED_BODY()

  /** Application name (system field) */
  UPROPERTY(BlueprintReadWrite, Category = "Gatrix")
  FString AppName;

  /** Environment name (system field) */
  UPROPERTY(BlueprintReadWrite, Category = "Gatrix")
  FString Environment;

  UPROPERTY(BlueprintReadWrite, Category = "Gatrix")
  FString UserId;

  UPROPERTY(BlueprintReadWrite, Category = "Gatrix")
  FString SessionId;

  UPROPERTY(BlueprintReadWrite, Category = "Gatrix")
  FString DeviceId;

  UPROPERTY(BlueprintReadWrite, Category = "Gatrix")
  FString CurrentTime;

  /** Custom properties */
  UPROPERTY(BlueprintReadWrite, Category = "Gatrix")
  TMap<FString, FString> Properties;
};

/** Impression event data */
USTRUCT(BlueprintType)
struct GATRIXSDK_API FGatrixImpressionEvent {
  GENERATED_BODY()

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  FString EventType;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  FString EventId;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  FGatrixContext Context;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  bool bEnabled = false;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  FString FeatureName;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  bool bImpressionData = false;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  FString VariantName;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  FString Reason;
};

/** Error event payload */
USTRUCT(BlueprintType)
struct GATRIXSDK_API FGatrixErrorEvent {
  GENERATED_BODY()

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  FString Type;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  FString Message;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  int32 Code = 0;
};

/** Variation result with details (value + reason) */
USTRUCT(BlueprintType)
struct GATRIXSDK_API FGatrixVariationResult {
  GENERATED_BODY()

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  FString Value;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  FString Reason;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  bool bFlagExists = false;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  bool bEnabled = false;
};

/** Fetch retry options */
USTRUCT(BlueprintType)
struct GATRIXSDK_API FGatrixFetchRetryOptions {
  GENERATED_BODY()

  /** Number of retry attempts (default: 3) */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix")
  int32 Limit = 3;

  /** Backoff limit in ms (default: 8000) */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix")
  int32 BackoffLimitMs = 8000;

  /** Request timeout in ms (default: 30000) */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix")
  int32 TimeoutMs = 30000;
};

/** Feature flags configuration */
USTRUCT(BlueprintType)
struct GATRIXSDK_API FGatrixFeaturesConfig {
  GENERATED_BODY()

  /** Seconds between polls (default: 30) */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix")
  float RefreshInterval = 30.0f;

  /** Disable automatic polling */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix")
  bool bDisableRefresh = false;

  /** Enable explicit sync mode */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix")
  bool bExplicitSyncMode = false;

  /** Override stored flags with bootstrap (default: true) */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix")
  bool bBootstrapOverride = true;

  /** Disable metrics collection */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix")
  bool bDisableMetrics = false;

  /** Track impressions for all flags */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix")
  bool bImpressionDataAll = false;

  /** Use POST requests instead of GET */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix")
  bool bUsePOSTRequests = false;

  /** Initial delay before first metrics send in seconds (default: 2) */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix")
  float MetricsIntervalInitial = 2.0f;

  /** Metrics send interval in seconds (default: 60) */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix")
  float MetricsInterval = 60.0f;

  /** Fetch retry options */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix")
  FGatrixFetchRetryOptions FetchRetryOptions;

  /** Disable local statistics tracking */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix")
  bool bDisableStats = false;
};

/** SDK Configuration */
USTRUCT(BlueprintType)
struct GATRIXSDK_API FGatrixClientConfig {
  GENERATED_BODY()

  // ==================== Required ====================

  /** Base API URL (e.g., http://localhost:45000/api/v1) */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|Required")
  FString ApiUrl;

  /** Client API token */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|Required")
  FString ApiToken;

  /** Application name */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|Required")
  FString AppName;

  /** Environment name (e.g., development, production) */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|Required")
  FString Environment;

  // ==================== Optional ====================

  /** Initial context */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|Optional")
  FGatrixContext Context;

  /** Custom HTTP headers */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|Optional")
  TMap<FString, FString> CustomHeaders;

  /** Start in offline mode */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|Optional")
  bool bOfflineMode = false;

  /** Feature flags configuration */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|Optional")
  FGatrixFeaturesConfig Features;
};

/** Feature flag statistics */
USTRUCT(BlueprintType)
struct GATRIXSDK_API FGatrixFeaturesStats {
  GENERATED_BODY()

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  int32 TotalFlagCount = 0;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  int32 FetchFlagsCount = 0;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  int32 UpdateCount = 0;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  int32 NotModifiedCount = 0;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  int32 RecoveryCount = 0;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  int32 SyncFlagsCount = 0;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  int32 ImpressionCount = 0;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  int32 ContextChangeCount = 0;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  int32 MetricsSentCount = 0;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  int32 MetricsErrorCount = 0;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  FString Etag;
};

/** Overall SDK statistics */
USTRUCT(BlueprintType)
struct GATRIXSDK_API FGatrixSdkStats {
  GENERATED_BODY()

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  EGatrixSdkState SdkState = EGatrixSdkState::Initializing;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  FString ConnectionId;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  int32 ErrorCount = 0;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  bool bOfflineMode = false;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix")
  FGatrixFeaturesStats Features;
};
