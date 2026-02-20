// Copyright Gatrix. All Rights Reserved.
// FeaturesClient implementation - HTTP fetching, polling, caching, metrics,
// thread safety

#include "GatrixFeaturesClient.h"
#include "GatrixClient.h"
#include "GatrixEvents.h"
#include "GatrixSDKModule.h"

#include "Async/Async.h"
#include "Dom/JsonObject.h"
#include "Engine/Engine.h"
#include "Engine/World.h"
#include "GenericPlatform/GenericPlatformHttp.h"
#include "HttpModule.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"
#include "Misc/Guid.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "TimerManager.h"

const FString UGatrixFeaturesClient::StorageKeyFlags = TEXT("gatrix_flags");
const FString UGatrixFeaturesClient::StorageKeyEtag = TEXT("gatrix_etag");

// ==================== Initialization ====================

void UGatrixFeaturesClient::Initialize(
    const FGatrixClientConfig &Config, FGatrixEventEmitter *Emitter,
    TSharedPtr<IGatrixStorageProvider> Storage) {
  ClientConfig = Config;
  EventEmitter = Emitter;
  StorageProvider = Storage;
  ConnectionId =
      FGuid::NewGuid().ToString(EGuidFormats::DigitsWithHyphens).ToLower();
  SdkState = EGatrixSdkState::Initializing;

  // Ensure context has system fields
  ClientConfig.Context.AppName = ClientConfig.AppName;
  ClientConfig.Context.Environment = ClientConfig.Environment;

  // Load cached data from storage
  LoadFromStorage();

  // Apply bootstrap flags if provided
  ApplyBootstrap();

  SdkState = EGatrixSdkState::Healthy;
  if (EventEmitter) {
    EventEmitter->Emit(GatrixEvents::FlagsInit);
  }
}

void UGatrixFeaturesClient::Start() {
  if (bStarted)
    return;
  bStarted = true;
  ConsecutiveFailures = 0;
  bPollingStopped = false;

  if (ClientConfig.bEnableDevMode) {
    UE_LOG(LogGatrix, Log,
           TEXT("[DEV] Start() called. offlineMode=%s, "
                "refreshInterval=%.1f, disableRefresh=%s"),
           ClientConfig.bOfflineMode ? TEXT("True") : TEXT("False"),
           ClientConfig.Features.RefreshInterval,
           ClientConfig.Features.bDisableRefresh ? TEXT("True")
                                                 : TEXT("False"));
  }

  if (ClientConfig.bOfflineMode) {
    if (RealtimeFlags.Num() == 0) {
      SdkState = EGatrixSdkState::Error;
      FGatrixErrorEvent ErrorEvent;
      ErrorEvent.Type = TEXT("offline_no_data");
      ErrorEvent.Message =
          TEXT("offlineMode requires bootstrap data or cached flags");
      if (EventEmitter) {
        EventEmitter->Emit(GatrixEvents::SdkError, ErrorEvent.Message);
      }
      OnError.Broadcast(ErrorEvent);
      return;
    }
    SetReady();
    return;
  }

  // Start first fetch
  FetchFlags();

  // Start metrics if enabled
  if (!ClientConfig.Features.bDisableMetrics) {
    StartMetrics();
  }
}

void UGatrixFeaturesClient::Stop() {
  if (ClientConfig.bEnableDevMode) {
    UE_LOG(LogGatrix, Log, TEXT("[DEV] Stop() called"));
  }
  bStarted = false;
  bPollingStopped = true;
  ConsecutiveFailures = 0;
  StopPolling();
  StopMetrics();
}

// ==================== Flag Access (Thread-Safe) ====================

TMap<FString, FGatrixEvaluatedFlag>
UGatrixFeaturesClient::SelectFlags(bool bForceRealtime) const {
  FScopeLock Lock(&FlagsCriticalSection);
  if (bForceRealtime || !ClientConfig.Features.bExplicitSyncMode) {
    return RealtimeFlags;
  }
  return SynchronizedFlags;
}

bool UGatrixFeaturesClient::IsEnabled(const FString &FlagName,
                                      bool bForceRealtime) const {
  return const_cast<UGatrixFeaturesClient *>(this)->IsEnabledInternal(
      FlagName, bForceRealtime);
}

FGatrixEvaluatedFlag UGatrixFeaturesClient::GetFlag(const FString &FlagName,
                                                    bool bForceRealtime) const {
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags(bForceRealtime);
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  if (!Found) {
    TrackAccess(FlagName, nullptr, TEXT("getFlag"), TEXT(""));
    return FGatrixEvaluatedFlag();
  }
  TrackAccess(FlagName, Found, TEXT("getFlag"), Found->Variant.Name);
  return *Found;
}

FGatrixVariant UGatrixFeaturesClient::GetVariant(const FString &FlagName,
                                                 bool bForceRealtime) const {
  return const_cast<UGatrixFeaturesClient *>(this)->GetVariantInternal(
      FlagName, bForceRealtime);
}

UGatrixFlagProxy *UGatrixFeaturesClient::CreateProxy(const FString &FlagName,
                                                     bool bForceRealtime) {
  FScopeLock Lock(&FlagsCriticalSection);
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags(bForceRealtime);
  UGatrixFlagProxy *Proxy = NewObject<UGatrixFlagProxy>(this);

  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  if (Found) {
    TrackAccess(FlagName, Found, TEXT("watch"), Found->Variant.Name);
  } else {
    TrackAccess(FlagName, nullptr, TEXT("watch"), TEXT(""));
  }

  Proxy->Initialize(this, FlagName, bForceRealtime);
  return Proxy;
}

TArray<FGatrixEvaluatedFlag> UGatrixFeaturesClient::GetAllFlags() const {
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags();
  TArray<FGatrixEvaluatedFlag> Result;
  Flags.GenerateValueArray(Result);
  return Result;
}

// ==================== Variation Methods ====================

bool UGatrixFeaturesClient::BoolVariation(const FString &FlagName,
                                          bool FallbackValue,
                                          bool bForceRealtime) const {
  return const_cast<UGatrixFeaturesClient *>(this)->BoolVariationInternal(
      FlagName, FallbackValue, bForceRealtime);
}

FString UGatrixFeaturesClient::StringVariation(const FString &FlagName,
                                               const FString &FallbackValue,
                                               bool bForceRealtime) const {
  return const_cast<UGatrixFeaturesClient *>(this)->StringVariationInternal(
      FlagName, FallbackValue, bForceRealtime);
}

float UGatrixFeaturesClient::FloatVariation(const FString &FlagName,
                                            float FallbackValue,
                                            bool bForceRealtime) const {
  return const_cast<UGatrixFeaturesClient *>(this)->FloatVariationInternal(
      FlagName, FallbackValue, bForceRealtime);
}

int32 UGatrixFeaturesClient::IntVariation(const FString &FlagName,
                                          int32 FallbackValue,
                                          bool bForceRealtime) const {
  return const_cast<UGatrixFeaturesClient *>(this)->IntVariationInternal(
      FlagName, FallbackValue, bForceRealtime);
}

double UGatrixFeaturesClient::DoubleVariation(const FString &FlagName,
                                              double FallbackValue,
                                              bool bForceRealtime) const {
  return const_cast<UGatrixFeaturesClient *>(this)->DoubleVariationInternal(
      FlagName, FallbackValue, bForceRealtime);
}

FString UGatrixFeaturesClient::JsonVariation(const FString &FlagName,
                                             const FString &FallbackValue,
                                             bool bForceRealtime) const {
  return const_cast<UGatrixFeaturesClient *>(this)->JsonVariationInternal(
      FlagName, FallbackValue, bForceRealtime);
}

// ==================== Variation Details ====================

FGatrixVariationResult UGatrixFeaturesClient::BoolVariationDetails(
    const FString &FlagName, bool FallbackValue, bool bForceRealtime) const {
  return const_cast<UGatrixFeaturesClient *>(this)
      ->BoolVariationDetailsInternal(FlagName, FallbackValue, bForceRealtime);
}

FGatrixVariationResult
UGatrixFeaturesClient::StringVariationDetails(const FString &FlagName,
                                              const FString &FallbackValue,
                                              bool bForceRealtime) const {
  return const_cast<UGatrixFeaturesClient *>(this)
      ->StringVariationDetailsInternal(FlagName, FallbackValue, bForceRealtime);
}

FGatrixVariationResult UGatrixFeaturesClient::IntVariationDetails(
    const FString &FlagName, int32 FallbackValue, bool bForceRealtime) const {
  return const_cast<UGatrixFeaturesClient *>(this)->IntVariationDetailsInternal(
      FlagName, FallbackValue, bForceRealtime);
}

FGatrixVariationResult UGatrixFeaturesClient::FloatVariationDetails(
    const FString &FlagName, float FallbackValue, bool bForceRealtime) const {
  return const_cast<UGatrixFeaturesClient *>(this)
      ->FloatVariationDetailsInternal(FlagName, FallbackValue, bForceRealtime);
}

FGatrixVariationResult UGatrixFeaturesClient::DoubleVariationDetails(
    const FString &FlagName, double FallbackValue, bool bForceRealtime) const {
  return const_cast<UGatrixFeaturesClient *>(this)
      ->DoubleVariationDetailsInternal(FlagName, FallbackValue, bForceRealtime);
}

FGatrixVariationResult
UGatrixFeaturesClient::JsonVariationDetails(const FString &FlagName,
                                            const FString &FallbackValue,
                                            bool bForceRealtime) const {
  return const_cast<UGatrixFeaturesClient *>(this)
      ->JsonVariationDetailsInternal(FlagName, FallbackValue, bForceRealtime);
}

// ==================== OrThrow Variations ====================

bool UGatrixFeaturesClient::BoolVariationOrThrow(const FString &FlagName,
                                                 bool bForceRealtime) {
  return BoolVariationOrThrowInternal(FlagName, bForceRealtime);
}

FString UGatrixFeaturesClient::StringVariationOrThrow(const FString &FlagName,
                                                      bool bForceRealtime) {
  return StringVariationOrThrowInternal(FlagName, bForceRealtime);
}

float UGatrixFeaturesClient::FloatVariationOrThrow(const FString &FlagName,
                                                   bool bForceRealtime) {
  return FloatVariationOrThrowInternal(FlagName, bForceRealtime);
}

int32 UGatrixFeaturesClient::IntVariationOrThrow(const FString &FlagName,
                                                 bool bForceRealtime) {
  return IntVariationOrThrowInternal(FlagName, bForceRealtime);
}

double UGatrixFeaturesClient::DoubleVariationOrThrow(const FString &FlagName,
                                                     bool bForceRealtime) {
  return DoubleVariationOrThrowInternal(FlagName, bForceRealtime);
}

FString UGatrixFeaturesClient::JsonVariationOrThrow(const FString &FlagName,
                                                    bool bForceRealtime) {
  return JsonVariationOrThrowInternal(FlagName, bForceRealtime);
}

// ==================== Context ====================

void UGatrixFeaturesClient::UpdateContext(const FGatrixContext &NewContext) {
  // Preserve system fields
  FGatrixContext MergedContext = NewContext;
  MergedContext.AppName = ClientConfig.AppName;
  MergedContext.Environment = ClientConfig.Environment;

  ClientConfig.Context = MergedContext;

  {
    FScopeLock Lock(&StatsCriticalSection);
    ContextChangeCount++;
  }

  // Re-fetch with new context
  if (bStarted && !ClientConfig.bOfflineMode) {
    FetchFlags();
  }
}

FGatrixContext UGatrixFeaturesClient::GetContext() const {
  return ClientConfig.Context;
}

// ==================== Explicit Sync ====================

void UGatrixFeaturesClient::SyncFlags(bool bFetchNow) {
  if (!ClientConfig.Features.bExplicitSyncMode)
    return;

  if (bFetchNow) {
    FetchFlags();
  }

  {
    FScopeLock Lock(&FlagsCriticalSection);
    TMap<FString, FGatrixEvaluatedFlag> OldFlags = SynchronizedFlags;
    SynchronizedFlags = RealtimeFlags;
    EmitFlagChanges(OldFlags, SynchronizedFlags);
    InvokeWatchCallbacks(SyncedWatchCallbacks, OldFlags, SynchronizedFlags,
                         /*bForceRealtime=*/false);
  }

  {
    FScopeLock Lock(&StatsCriticalSection);
    SyncFlagsCount++;
  }

  bPendingSync = false;
  if (EventEmitter) {
    EventEmitter->Emit(GatrixEvents::FlagsSync);
  }
  OnSync.Broadcast();
}

bool UGatrixFeaturesClient::CanSyncFlags() const {
  return ClientConfig.Features.bExplicitSyncMode && bPendingSync;
}

bool UGatrixFeaturesClient::HasPendingSyncFlags() const {
  return ClientConfig.Features.bExplicitSyncMode && bPendingSync;
}

void UGatrixFeaturesClient::SetExplicitSyncMode(bool bEnabled) {
  if (ClientConfig.Features.bExplicitSyncMode == bEnabled)
    return;

  ClientConfig.Features.bExplicitSyncMode = bEnabled;

  if (bEnabled) {
    // Copy current realtime flags as the synchronized snapshot
    FScopeLock Lock(&FlagsCriticalSection);
    SynchronizedFlags = RealtimeFlags;
    bPendingSync = false;
  } else {
    // Apply any pending flags immediately
    bPendingSync = false;
  }
}

// ==================== Fetch ====================

void UGatrixFeaturesClient::FetchFlags() {
  if (bIsFetching || !bStarted)
    return;

  bIsFetching = true;

  if (ClientConfig.bEnableDevMode) {
    UE_LOG(LogGatrix, Log, TEXT("[DEV] FetchFlags: starting fetch. etag=%s"),
           *Etag);
  }

  if (EventEmitter) {
    EventEmitter->Emit(GatrixEvents::FlagsFetchStart);
  }

  DoFetchFlags();
}

void UGatrixFeaturesClient::DoFetchFlags() {
  {
    FScopeLock Lock(&StatsCriticalSection);
    FetchFlagsCount++;
  }

  FString Url = BuildFetchUrl();
  bool bUsePOST = ClientConfig.Features.bUsePOSTRequests;

  TSharedRef<IHttpRequest, ESPMode::ThreadSafe> HttpRequest =
      FHttpModule::Get().CreateRequest();
  HttpRequest->SetURL(Url);
  HttpRequest->SetVerb(bUsePOST ? TEXT("POST") : TEXT("GET"));
  HttpRequest->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
  HttpRequest->SetHeader(TEXT("X-API-Token"), ClientConfig.ApiToken);
  HttpRequest->SetHeader(TEXT("X-Application-Name"), ClientConfig.AppName);
  HttpRequest->SetHeader(TEXT("X-Environment"), ClientConfig.Environment);
  HttpRequest->SetHeader(TEXT("X-Connection-Id"), ConnectionId);
  HttpRequest->SetHeader(TEXT("X-SDK-Version"),
                         FString::Printf(TEXT("%s/%s"), *UGatrixClient::SdkName,
                                         *UGatrixClient::SdkVersion));

  // ETag for conditional requests
  if (!Etag.IsEmpty()) {
    HttpRequest->SetHeader(TEXT("If-None-Match"), Etag);
  }

  // Custom headers
  for (const auto &Header : ClientConfig.CustomHeaders) {
    HttpRequest->SetHeader(Header.Key, Header.Value);
  }

  // POST body with context
  if (bUsePOST) {
    HttpRequest->SetContentAsString(ContextToJson());
  }

  // Set timeout
  HttpRequest->SetTimeout(ClientConfig.Features.FetchRetryOptions.TimeoutMs /
                          1000.0f);

  if (EventEmitter) {
    EventEmitter->Emit(GatrixEvents::FlagsFetch, Etag);
  }

  // HTTP response callback - runs on game thread in UE4
  HttpRequest->OnProcessRequestComplete().BindLambda(
      [this](FHttpRequestPtr Request, FHttpResponsePtr Response,
             bool bWasSuccessful) {
        // Already on game thread in UE4 FHttpModule
        bIsFetching = false;

        if (!bWasSuccessful || !Response.IsValid()) {
          FString ErrorMsg = TEXT("Network error: request failed");
          if (EventEmitter) {
            EventEmitter->Emit(GatrixEvents::FlagsFetchError, ErrorMsg);
            EventEmitter->Emit(GatrixEvents::SdkError, ErrorMsg);
            EventEmitter->Emit(GatrixEvents::FlagsFetchEnd);
          }

          FGatrixErrorEvent ErrorEvent;
          ErrorEvent.Type = TEXT("fetch_error");
          ErrorEvent.Message = ErrorMsg;
          OnError.Broadcast(ErrorEvent);

          SdkState = EGatrixSdkState::Error;
          // Network error: schedule with backoff
          ConsecutiveFailures++;
          ScheduleNextPoll();
          return;
        }

        int32 HttpStatus = Response->GetResponseCode();
        FString ResponseBody = Response->GetContentAsString();

        // ETag from response
        FString NewEtag = Response->GetHeader(TEXT("ETag"));

        HandleFetchResponse(ResponseBody, HttpStatus, NewEtag);

        if (EventEmitter) {
          EventEmitter->Emit(GatrixEvents::FlagsFetchEnd);
        }
      });

  HttpRequest->ProcessRequest();
}

void UGatrixFeaturesClient::HandleFetchResponse(const FString &ResponseBody,
                                                int32 HttpStatus,
                                                const FString &EtagHeader) {
  // Check for recovery from error state
  if (SdkState == EGatrixSdkState::Error && HttpStatus < 400) {
    SdkState = EGatrixSdkState::Healthy;
    {
      FScopeLock Lock(&StatsCriticalSection);
      RecoveryCount++;
    }
    if (EventEmitter) {
      EventEmitter->Emit(GatrixEvents::FlagsRecovered);
    }
    OnRecovered.Broadcast();
  }

  if (HttpStatus == 200) {
    // Update ETag
    if (!EtagHeader.IsEmpty() && EtagHeader != Etag) {
      Etag = EtagHeader;
      if (StorageProvider.IsValid()) {
        StorageProvider->Save(StorageKeyEtag, Etag);
      }
    }

    // Parse response JSON
    TSharedPtr<FJsonObject> JsonObject;
    TSharedRef<TJsonReader<>> Reader =
        TJsonReaderFactory<>::Create(ResponseBody);
    if (!FJsonSerializer::Deserialize(Reader, JsonObject) ||
        !JsonObject.IsValid()) {
      UE_LOG(LogGatrix, Error, TEXT("Failed to parse flags response JSON"));
      if (EventEmitter) {
        EventEmitter->Emit(GatrixEvents::FlagsFetchError,
                           TEXT("JSON parse error"));
      }
      return;
    }

    // Check success field
    bool bSuccess = false;
    JsonObject->TryGetBoolField(TEXT("success"), bSuccess);
    if (!bSuccess) {
      UE_LOG(LogGatrix, Warning, TEXT("Flags response success=false"));
      return;
    }

    // Parse flags from data.flags
    const TSharedPtr<FJsonObject> *DataObj = nullptr;
    if (!JsonObject->TryGetObjectField(TEXT("data"), DataObj)) {
      return;
    }

    const TArray<TSharedPtr<FJsonValue>> *FlagsArray = nullptr;
    if (!(*DataObj)->TryGetArrayField(TEXT("flags"), FlagsArray)) {
      return;
    }

    TArray<FGatrixEvaluatedFlag> ParsedFlags;
    for (const auto &FlagValue : *FlagsArray) {
      const TSharedPtr<FJsonObject> *FlagObj = nullptr;
      if (!FlagValue->TryGetObject(FlagObj))
        continue;

      FGatrixEvaluatedFlag Flag;
      (*FlagObj)->TryGetStringField(TEXT("name"), Flag.Name);
      (*FlagObj)->TryGetBoolField(TEXT("enabled"), Flag.bEnabled);
      (*FlagObj)->TryGetNumberField(TEXT("version"), Flag.Version);
      (*FlagObj)->TryGetStringField(TEXT("reason"), Flag.Reason);
      (*FlagObj)->TryGetBoolField(TEXT("impressionData"), Flag.bImpressionData);

      // Parse variant type
      FString TypeStr;
      (*FlagObj)->TryGetStringField(TEXT("valueType"), TypeStr);
      if (TypeStr == TEXT("string"))
        Flag.ValueType = EGatrixValueType::String;
      else if (TypeStr == TEXT("number"))
        Flag.ValueType = EGatrixValueType::Number;
      else if (TypeStr == TEXT("boolean"))
        Flag.ValueType = EGatrixValueType::Boolean;
      else if (TypeStr == TEXT("json"))
        Flag.ValueType = EGatrixValueType::Json;
      else
        Flag.ValueType = EGatrixValueType::None;

      // Parse variant
      const TSharedPtr<FJsonObject> *VariantObj = nullptr;
      if ((*FlagObj)->TryGetObjectField(TEXT("variant"), VariantObj)) {
        (*VariantObj)->TryGetStringField(TEXT("name"), Flag.Variant.Name);
        (*VariantObj)->TryGetBoolField(TEXT("enabled"), Flag.Variant.bEnabled);

        // Payload: can be string, number, or object
        const TSharedPtr<FJsonValue> PayloadValue =
            (*VariantObj)->TryGetField(TEXT("value"));
        if (PayloadValue.IsValid()) {
          switch (PayloadValue->Type) {
          case EJson::String:
            PayloadValue->TryGetString(Flag.Variant.Value);
            break;
          case EJson::Number: {
            double NumVal = 0;
            PayloadValue->TryGetNumber(NumVal);
            Flag.Variant.Value = FString::SanitizeFloat(NumVal);
            break;
          }
          case EJson::Object:
          case EJson::Array: {
            // Serialize back to JSON string
            FString JsonStr;
            TSharedRef<TJsonWriter<>> Writer =
                TJsonWriterFactory<>::Create(&JsonStr);
            FJsonSerializer::Serialize(PayloadValue, TEXT(""), Writer);
            Flag.Variant.Value = JsonStr;
            break;
          }
          default:
            break;
          }
        }
      }

      ParsedFlags.Add(MoveTemp(Flag));
    }

    bool bIsInitialFetch = !bFetchedFromServer;
    StoreFlags(ParsedFlags, bIsInitialFetch);

    {
      FScopeLock Lock(&StatsCriticalSection);
      UpdateCount++;
    }

    if (!bFetchedFromServer) {
      bFetchedFromServer = true;
      SetReady();
    }

    if (EventEmitter) {
      EventEmitter->Emit(GatrixEvents::FlagsFetchSuccess);
    }

    // Success: reset failure counter and schedule at normal interval
    ConsecutiveFailures = 0;
    ScheduleNextPoll();
  } else if (HttpStatus == 304) {
    // Not Modified
    {
      FScopeLock Lock(&StatsCriticalSection);
      NotModifiedCount++;
    }

    if (!bFetchedFromServer) {
      bFetchedFromServer = true;
      SetReady();
    }

    if (EventEmitter) {
      EventEmitter->Emit(GatrixEvents::FlagsFetchSuccess);
    }

    // 304: reset failure counter and schedule at normal interval
    ConsecutiveFailures = 0;
    ScheduleNextPoll();
  } else {
    // Error response
    SdkState = EGatrixSdkState::Error;
    FString ErrorMsg = FString::Printf(TEXT("HTTP %d"), HttpStatus);

    if (EventEmitter) {
      EventEmitter->Emit(GatrixEvents::FlagsFetchError, ErrorMsg);
      EventEmitter->Emit(GatrixEvents::SdkError, ErrorMsg);
    }

    FGatrixErrorEvent ErrorEvent;
    ErrorEvent.Type = TEXT("fetch_error");
    ErrorEvent.Code = HttpStatus;
    ErrorEvent.Message = ErrorMsg;
    OnError.Broadcast(ErrorEvent);

    // Check for non-retryable status codes
    bool bIsNonRetryable = ClientConfig.Features.FetchRetryOptions
                               .NonRetryableStatusCodes.Contains(HttpStatus);

    if (bIsNonRetryable) {
      // Non-retryable error: stop polling entirely
      bPollingStopped = true;
      UE_LOG(LogGatrix, Error,
             TEXT("Polling stopped due to non-retryable status "
                  "code %d"),
             HttpStatus);
    } else {
      // Retryable error: schedule with backoff
      ConsecutiveFailures++;
      ScheduleNextPoll();
    }
  }
}

// ==================== Storage ====================

void UGatrixFeaturesClient::StoreFlags(
    const TArray<FGatrixEvaluatedFlag> &NewFlags, bool bIsInitialFetch) {
  TMap<FString, FGatrixEvaluatedFlag> OldFlags;

  {
    FScopeLock Lock(&FlagsCriticalSection);
    OldFlags = RealtimeFlags;

    RealtimeFlags.Empty();
    for (const auto &Flag : NewFlags) {
      RealtimeFlags.Add(Flag.Name, Flag);
    }

    // In non-explicit-sync mode, also update synchronized flags
    if (!ClientConfig.Features.bExplicitSyncMode) {
      SynchronizedFlags = RealtimeFlags;
    } else {
      bool bWasPending = bPendingSync;
      bPendingSync = true;
      if (!bWasPending && EventEmitter) {
        EventEmitter->Emit(GatrixEvents::FlagsPendingSync);
      }
    }
  }

  // Persist to storage
  if (StorageProvider.IsValid()) {
    // Serialize flags to JSON for storage
    FString FlagsJson;
    TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&FlagsJson);
    Writer->WriteArrayStart();
    for (const auto &Flag : NewFlags) {
      Writer->WriteObjectStart();
      Writer->WriteValue(TEXT("name"), Flag.Name);
      Writer->WriteValue(TEXT("enabled"), Flag.bEnabled);
      Writer->WriteValue(TEXT("version"), Flag.Version);
      Writer->WriteValue(TEXT("reason"), Flag.Reason);
      Writer->WriteValue(TEXT("impressionData"), Flag.bImpressionData);

      FString TypeStr;
      switch (Flag.ValueType) {
      case EGatrixValueType::String:
        TypeStr = TEXT("string");
        break;
      case EGatrixValueType::Number:
        TypeStr = TEXT("number");
        break;
      case EGatrixValueType::Boolean:
        TypeStr = TEXT("boolean");
        break;
      case EGatrixValueType::Json:
        TypeStr = TEXT("json");
        break;
      default:
        TypeStr = TEXT("none");
        break;
      }
      Writer->WriteValue(TEXT("valueType"), TypeStr);

      Writer->WriteObjectStart(TEXT("variant"));
      Writer->WriteValue(TEXT("name"), Flag.Variant.Name);
      Writer->WriteValue(TEXT("enabled"), Flag.Variant.bEnabled);
      Writer->WriteValue(TEXT("value"), Flag.Variant.Value);
      Writer->WriteObjectEnd();

      Writer->WriteObjectEnd();
    }
    Writer->WriteArrayEnd();
    Writer->Close();

    StorageProvider->Save(StorageKeyFlags, FlagsJson);
  }

  // Emit flag changes
  if (!bIsInitialFetch) {
    TMap<FString, FGatrixEvaluatedFlag> CurrentFlags = SelectFlags();
    EmitFlagChanges(OldFlags, CurrentFlags);

    // Always invoke realtime watch callbacks
    InvokeWatchCallbacks(WatchCallbacks, OldFlags, CurrentFlags,
                         /*bForceRealtime=*/true);

    if (!ClientConfig.Features.bExplicitSyncMode) {
      // In non-explicit mode, also invoke synced callbacks
      InvokeWatchCallbacks(SyncedWatchCallbacks, OldFlags, CurrentFlags,
                           /*bForceRealtime=*/false);
      if (EventEmitter) {
        EventEmitter->Emit(GatrixEvents::FlagsChange);
      }
      OnChange.Broadcast();
    }
  }
}

void UGatrixFeaturesClient::LoadFromStorage() {
  if (!StorageProvider.IsValid())
    return;

  // Load ETag
  FString StoredEtag = StorageProvider->Load(StorageKeyEtag);
  if (!StoredEtag.IsEmpty()) {
    Etag = StoredEtag;
  }

  // Load cached flags
  FString FlagsJson = StorageProvider->Load(StorageKeyFlags);
  if (FlagsJson.IsEmpty())
    return;

  TSharedPtr<FJsonValue> ParsedValue;
  TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(FlagsJson);
  if (!FJsonSerializer::Deserialize(Reader, ParsedValue) ||
      !ParsedValue.IsValid())
    return;

  const TArray<TSharedPtr<FJsonValue>> *FlagsArray = nullptr;
  if (!ParsedValue->TryGetArray(FlagsArray))
    return;

  FScopeLock Lock(&FlagsCriticalSection);
  for (const auto &FlagValue : *FlagsArray) {
    const TSharedPtr<FJsonObject> *FlagObj = nullptr;
    if (!FlagValue->TryGetObject(FlagObj))
      continue;

    FGatrixEvaluatedFlag Flag;
    (*FlagObj)->TryGetStringField(TEXT("name"), Flag.Name);
    (*FlagObj)->TryGetBoolField(TEXT("enabled"), Flag.bEnabled);
    (*FlagObj)->TryGetNumberField(TEXT("version"), Flag.Version);
    (*FlagObj)->TryGetStringField(TEXT("reason"), Flag.Reason);

    FString TypeStr;
    (*FlagObj)->TryGetStringField(TEXT("valueType"), TypeStr);
    if (TypeStr == TEXT("string"))
      Flag.ValueType = EGatrixValueType::String;
    else if (TypeStr == TEXT("number"))
      Flag.ValueType = EGatrixValueType::Number;
    else if (TypeStr == TEXT("boolean"))
      Flag.ValueType = EGatrixValueType::Boolean;
    else if (TypeStr == TEXT("json"))
      Flag.ValueType = EGatrixValueType::Json;

    const TSharedPtr<FJsonObject> *VariantObj = nullptr;
    if ((*FlagObj)->TryGetObjectField(TEXT("variant"), VariantObj)) {
      (*VariantObj)->TryGetStringField(TEXT("name"), Flag.Variant.Name);
      (*VariantObj)->TryGetBoolField(TEXT("enabled"), Flag.Variant.bEnabled);
      (*VariantObj)->TryGetStringField(TEXT("value"), Flag.Variant.Value);
    }

    RealtimeFlags.Add(Flag.Name, Flag);
  }

  SynchronizedFlags = RealtimeFlags;
}

void UGatrixFeaturesClient::ApplyBootstrap() {
  // Bootstrap is applied via config in a real scenario
  // Here we check if there are bootstrap flags in the features config
  // (In UE4, bootstrap would typically be loaded from a data asset or config)
}

// ==================== Ready ====================

void UGatrixFeaturesClient::SetReady() {
  if (bReadyEmitted)
    return;
  bReadyEmitted = true;

  if (EventEmitter) {
    EventEmitter->Emit(GatrixEvents::FlagsReady);
  }
  OnReady.Broadcast();

  UE_LOG(LogGatrix, Log, TEXT("Features ready. %d flags loaded."),
         RealtimeFlags.Num());
}

// ==================== Flag Change Emission ====================

void UGatrixFeaturesClient::EmitFlagChanges(
    const TMap<FString, FGatrixEvaluatedFlag> &OldFlags,
    const TMap<FString, FGatrixEvaluatedFlag> &NewFlags) {
  if (!EventEmitter)
    return;

  // Detect changed/created flags
  for (const auto &Pair : NewFlags) {
    const FGatrixEvaluatedFlag *OldFlag = OldFlags.Find(Pair.Key);
    if (!OldFlag || OldFlag->bEnabled != Pair.Value.bEnabled ||
        OldFlag->Variant.Name != Pair.Value.Variant.Name ||
        OldFlag->Variant.Value != Pair.Value.Variant.Value) {
      FString ChangeType = OldFlag ? TEXT("updated") : TEXT("created");
      EventEmitter->Emit(GatrixEvents::FlagChange(Pair.Key),
                         Pair.Value.Variant.Name, ChangeType);
    }
  }

  // Detect removed flags - emit bulk event, not per-flag change
  TArray<FString> RemovedNames;
  for (const auto &Pair : OldFlags) {
    if (!NewFlags.Contains(Pair.Key)) {
      RemovedNames.Add(Pair.Key);
    }
  }
  if (RemovedNames.Num() > 0) {
    EventEmitter->Emit(GatrixEvents::FlagsRemoved,
                       FString::Join(RemovedNames, TEXT(",")));
  }
}

// ==================== Impressions ====================

void UGatrixFeaturesClient::TrackImpression(const FString &FlagName,
                                            bool bEnabled,
                                            const FString &VariantName,
                                            const FString &EventType) {
  FGatrixImpressionEvent Event;
  Event.EventType = EventType;
  Event.EventId =
      FGuid::NewGuid().ToString(EGuidFormats::DigitsWithHyphens).ToLower();
  Event.Context = ClientConfig.Context;
  Event.bEnabled = bEnabled;
  Event.FeatureName = FlagName;
  Event.bImpressionData = true;
  Event.VariantName = VariantName;

  {
    FScopeLock Lock(&StatsCriticalSection);
    ImpressionCount++;
  }

  if (EventEmitter) {
    EventEmitter->Emit(GatrixEvents::FlagsImpression, FlagName);
  }
  OnImpression.Broadcast(Event);
}

void UGatrixFeaturesClient::TrackAccess(const FString &FlagName,
                                        const FGatrixEvaluatedFlag *Flag,
                                        const FString &EventType,
                                        const FString &VariantName) const {
  {
    FScopeLock Lock(&MetricsCriticalSection);
    if (!Flag) {
      MetricsMissingFlags.FindOrAdd(FlagName)++;
    } else {
      FFlagMetrics &Metrics = MetricsFlagBucket.FindOrAdd(FlagName);
      if (Flag->bEnabled) {
        Metrics.Yes++;
      } else {
        Metrics.No++;
      }

      if (!VariantName.IsEmpty() && VariantName != TEXT("disabled") &&
          VariantName != GatrixVariantSource::Missing) {
        Metrics.Variants.FindOrAdd(VariantName)++;
      }
    }
  }

  if (Flag && Flag->bImpressionData) {
    const_cast<UGatrixFeaturesClient *>(this)->TrackImpression(
        FlagName, Flag->bEnabled, VariantName, EventType);
  } else if (ClientConfig.Features.bImpressionDataAll) {
    const_cast<UGatrixFeaturesClient *>(this)->TrackImpression(
        FlagName, Flag ? Flag->bEnabled : false, VariantName, EventType);
  }
}

// ==================== Watch ====================

int32 UGatrixFeaturesClient::WatchRealtimeFlag(
    const FString &FlagName, FGatrixFlagWatchDelegate Callback,
    const FString &Name) {
  FWatchCallbackEntry Entry;
  Entry.FlagName = FlagName;
  Entry.Callback = Callback;
  Entry.Handle = NextWatchHandle++;
  WatchCallbacks.Add(Entry);
  return Entry.Handle;
}

int32 UGatrixFeaturesClient::WatchSyncedFlag(const FString &FlagName,
                                             FGatrixFlagWatchDelegate Callback,
                                             const FString &Name) {
  FWatchCallbackEntry Entry;
  Entry.FlagName = FlagName;
  Entry.Callback = Callback;
  Entry.Handle = NextWatchHandle++;
  SyncedWatchCallbacks.Add(Entry);
  return Entry.Handle;
}

void UGatrixFeaturesClient::UnwatchFlag(int32 Handle) {
  WatchCallbacks.RemoveAll([Handle](const FWatchCallbackEntry &Entry) {
    return Entry.Handle == Handle;
  });
  SyncedWatchCallbacks.RemoveAll([Handle](const FWatchCallbackEntry &Entry) {
    return Entry.Handle == Handle;
  });
}

// ==================== Metadata Access Internal Methods ====================

bool UGatrixFeaturesClient::HasFlagInternal(const FString &FlagName,
                                            bool bForceRealtime) const {
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags(bForceRealtime);
  return Flags.Contains(FlagName);
}

EGatrixValueType
UGatrixFeaturesClient::GetValueTypeInternal(const FString &FlagName,
                                            bool bForceRealtime) const {
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags(bForceRealtime);
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  if (!Found)
    return EGatrixValueType::None;
  return Found->ValueType;
}

int32 UGatrixFeaturesClient::GetVersionInternal(const FString &FlagName,
                                                bool bForceRealtime) const {
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags(bForceRealtime);
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  if (!Found)
    return 0;
  return static_cast<int32>(Found->Version);
}

FString UGatrixFeaturesClient::GetReasonInternal(const FString &FlagName,
                                                 bool bForceRealtime) const {
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags(bForceRealtime);
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  if (!Found)
    return TEXT("");
  return Found->Reason;
}

bool UGatrixFeaturesClient::GetImpressionDataInternal(
    const FString &FlagName, bool bForceRealtime) const {
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags(bForceRealtime);
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  if (!Found)
    return false;
  return Found->bImpressionData;
}

FGatrixEvaluatedFlag
UGatrixFeaturesClient::GetRawFlagInternal(const FString &FlagName,
                                          bool bForceRealtime) const {
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags(bForceRealtime);
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  if (Found)
    return *Found;
  FGatrixEvaluatedFlag Empty;
  Empty.Name = FlagName;
  return Empty;
}

void UGatrixFeaturesClient::InvokeWatchCallbacks(
    const TArray<FWatchCallbackEntry> &CallbackList,
    const TMap<FString, FGatrixEvaluatedFlag> &OldFlags,
    const TMap<FString, FGatrixEvaluatedFlag> &NewFlags, bool bForceRealtime) {
  // Check for changed/new flags
  for (const auto &Pair : NewFlags) {
    const FGatrixEvaluatedFlag *OldFlag = OldFlags.Find(Pair.Key);
    if (!OldFlag || OldFlag->bEnabled != Pair.Value.bEnabled ||
        OldFlag->Variant.Name != Pair.Value.Variant.Name ||
        OldFlag->Variant.Value != Pair.Value.Variant.Value) {
      // Invoke watch callbacks for this flag
      for (const auto &Entry : CallbackList) {
        if (Entry.FlagName == Pair.Key) {
          UGatrixFlagProxy *Proxy = CreateProxy(Pair.Key, bForceRealtime);
          Entry.Callback.ExecuteIfBound(Proxy);
        }
      }
    }
  }

  // Check for removed flags
  for (const auto &Pair : OldFlags) {
    if (!NewFlags.Contains(Pair.Key)) {
      for (const auto &Entry : CallbackList) {
        if (Entry.FlagName == Pair.Key) {
          UGatrixFlagProxy *Proxy = CreateProxy(Pair.Key, bForceRealtime);
          Entry.Callback.ExecuteIfBound(Proxy);
        }
      }
    }
  }
}

// ==================== Polling ====================

void UGatrixFeaturesClient::ScheduleNextPoll() {
  if (!bStarted || ClientConfig.Features.bDisableRefresh ||
      ClientConfig.bOfflineMode || bPollingStopped) {
    return;
  }

  // Stop existing timer
  StopPolling();

  float Interval = ClientConfig.Features.RefreshInterval;
  if (Interval <= 0.0f)
    Interval = 30.0f;

  // Apply exponential backoff on consecutive failures
  if (ConsecutiveFailures > 0) {
    int32 InitialBackoff =
        ClientConfig.Features.FetchRetryOptions.InitialBackoffMs;
    int32 MaxBackoff = ClientConfig.Features.FetchRetryOptions.MaxBackoffMs;
    int32 BackoffMs = FMath::Min(
        static_cast<int32>(
            InitialBackoff *
            FMath::Pow(2.0f, static_cast<float>(ConsecutiveFailures - 1))),
        MaxBackoff);
    Interval = static_cast<float>(BackoffMs) / 1000.0f;
    UE_LOG(LogGatrix, Warning,
           TEXT("Scheduling retry after %.1fs (consecutive "
                "failures: %d)"),
           Interval, ConsecutiveFailures);
  }

  if (ClientConfig.bEnableDevMode) {
    UE_LOG(LogGatrix, Log,
           TEXT("[DEV] ScheduleNextPoll: delay=%.1fs, "
                "consecutiveFailures=%d, pollingStopped=%s"),
           Interval, ConsecutiveFailures,
           bPollingStopped ? TEXT("True") : TEXT("False"));
  }

  // Use engine world timer if available
  UWorld *World = nullptr;
  if (GEngine) {
    World = GEngine->GetWorldContexts().Num() > 0
                ? GEngine->GetWorldContexts()[0].World()
                : nullptr;
  }

  if (World) {
    World->GetTimerManager().SetTimer(
        PollTimerHandle,
        FTimerDelegate::CreateWeakLambda(this,
                                         [this]() {
                                           if (bStarted) {
                                             FetchFlags();
                                           }
                                         }),
        Interval,
        false // one-shot, will be re-scheduled after each fetch
    );
  }
}

void UGatrixFeaturesClient::StopPolling() {
  UWorld *World = nullptr;
  if (GEngine && GEngine->GetWorldContexts().Num() > 0) {
    World = GEngine->GetWorldContexts()[0].World();
  }

  if (World) {
    World->GetTimerManager().ClearTimer(PollTimerHandle);
  }
}

// ==================== Metrics ====================

void UGatrixFeaturesClient::StartMetrics() {
  float InitialDelay = ClientConfig.Features.MetricsIntervalInitial;
  if (InitialDelay <= 0.0f)
    InitialDelay = 2.0f;

  UWorld *World = nullptr;
  if (GEngine && GEngine->GetWorldContexts().Num() > 0) {
    World = GEngine->GetWorldContexts()[0].World();
  }

  if (World) {
    // Initial metrics send after delay
    World->GetTimerManager().SetTimer(
        MetricsTimerHandle,
        FTimerDelegate::CreateWeakLambda(
            this,
            [this]() {
              SendMetrics();

              // Schedule recurring sends
              float Interval = ClientConfig.Features.MetricsInterval;
              if (Interval <= 0.0f)
                Interval = 60.0f;

              UWorld *W = nullptr;
              if (GEngine && GEngine->GetWorldContexts().Num() > 0) {
                W = GEngine->GetWorldContexts()[0].World();
              }
              if (W) {
                W->GetTimerManager().SetTimer(
                    MetricsTimerHandle,
                    FTimerDelegate::CreateWeakLambda(
                        this, [this]() { SendMetrics(); }),
                    Interval,
                    true // recurring
                );
              }
            }),
        InitialDelay, false);
  }
}

void UGatrixFeaturesClient::StopMetrics() {
  UWorld *World = nullptr;
  if (GEngine && GEngine->GetWorldContexts().Num() > 0) {
    World = GEngine->GetWorldContexts()[0].World();
  }

  if (World) {
    World->GetTimerManager().ClearTimer(MetricsTimerHandle);
  }

  // Send final metrics
  SendMetrics();
}

void UGatrixFeaturesClient::SendMetrics() {
  FString PayloadJson;
  BuildMetricsPayload(PayloadJson);

  if (PayloadJson.IsEmpty())
    return;

  FString MetricsUrl =
      FString::Printf(TEXT("%s/client/metrics"), *ClientConfig.ApiUrl);

  // Retry with a simple attempt counter via shared pointer
  auto RetryCount = MakeShared<int32>(0);
  const int32 MaxRetries = 2;

  auto DoSendMetrics = [this, MetricsUrl, PayloadJson, RetryCount,
                        MaxRetries]() {
    TSharedRef<IHttpRequest, ESPMode::ThreadSafe> HttpRequest =
        FHttpModule::Get().CreateRequest();
    HttpRequest->SetURL(MetricsUrl);
    HttpRequest->SetVerb(TEXT("POST"));
    HttpRequest->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
    HttpRequest->SetHeader(TEXT("X-API-Token"), ClientConfig.ApiToken);
    HttpRequest->SetHeader(TEXT("X-Application-Name"), ClientConfig.AppName);
    HttpRequest->SetHeader(TEXT("X-Connection-Id"), ConnectionId);
    HttpRequest->SetHeader(TEXT("X-SDK-Version"),
                           FString::Printf(TEXT("%s/%s"),
                                           *UGatrixClient::SdkName,
                                           *UGatrixClient::SdkVersion));

    // Custom headers
    for (const auto &Header : ClientConfig.CustomHeaders) {
      HttpRequest->SetHeader(Header.Key, Header.Value);
    }

    HttpRequest->SetContentAsString(PayloadJson);
    return HttpRequest;
  };

  // Use a weak lambda to handle response and retry
  TSharedRef<IHttpRequest, ESPMode::ThreadSafe> HttpRequest = DoSendMetrics();

  HttpRequest->OnProcessRequestComplete().BindLambda(
      [this, RetryCount, MaxRetries, DoSendMetrics](FHttpRequestPtr Request,
                                                    FHttpResponsePtr Response,
                                                    bool bWasSuccessful) {
        if (bWasSuccessful && Response.IsValid() &&
            Response->GetResponseCode() < 400) {
          {
            FScopeLock Lock(&StatsCriticalSection);
            MetricsSentCount++;
          }
          if (EventEmitter) {
            EventEmitter->Emit(GatrixEvents::FlagsMetricsSent);
          }
        } else {
          // Retry on retryable status codes
          const int32 StatusCode =
              Response.IsValid() ? Response->GetResponseCode() : 0;
          const bool bRetryable = !bWasSuccessful || StatusCode == 408 ||
                                  StatusCode == 429 || StatusCode >= 500;

          if (bRetryable && *RetryCount < MaxRetries) {
            (*RetryCount)++;
            const float Delay = FMath::Pow(2.0f, (float)*RetryCount);

            FTimerHandle TimerHandle;
            GetWorld()->GetTimerManager().SetTimer(
                TimerHandle,
                [DoSendMetrics]() {
                  auto Req = DoSendMetrics();
                  Req->ProcessRequest();
                },
                Delay, false);
            return;
          }

          {
            FScopeLock Lock(&StatsCriticalSection);
            MetricsErrorCount++;
          }
          if (EventEmitter) {
            EventEmitter->Emit(GatrixEvents::FlagsMetricsError);
          }
        }
      });

  HttpRequest->ProcessRequest();
}

void UGatrixFeaturesClient::BuildMetricsPayload(FString &OutJson) const {
  TMap<FString, FFlagMetrics> BucketCopy;
  TMap<FString, int32> MissingCopy;

  {
    FScopeLock Lock(&MetricsCriticalSection);
    BucketCopy = MetricsFlagBucket;
    MissingCopy = MetricsMissingFlags;

    // Clear after reading
    const_cast<TMap<FString, FFlagMetrics> &>(MetricsFlagBucket).Empty();
    const_cast<TMap<FString, int32> &>(MetricsMissingFlags).Empty();
  }

  if (BucketCopy.Num() == 0 && MissingCopy.Num() == 0) {
    OutJson = FString();
    return;
  }

  TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&OutJson);
  Writer->WriteObjectStart();
  Writer->WriteValue(TEXT("appName"), ClientConfig.AppName);
  Writer->WriteValue(TEXT("environment"), ClientConfig.Environment);
  Writer->WriteValue(TEXT("sdkName"), UGatrixClient::SdkName);
  Writer->WriteValue(TEXT("sdkVersion"), UGatrixClient::SdkVersion);
  Writer->WriteValue(TEXT("connectionId"), ConnectionId);

  Writer->WriteObjectStart(TEXT("bucket"));

  // Track start/stop if we had timestamps, otherwise omit or use current
  // For now, simpler:
  Writer->WriteValue(
      TEXT("stop"),
      FDateTime::UtcNow().ToIso8601()); // SDK usually does this on send

  // Flag access counts
  Writer->WriteObjectStart(TEXT("flags"));
  for (const auto &Pair : BucketCopy) {
    Writer->WriteObjectStart(Pair.Key);
    Writer->WriteValue(TEXT("yes"), Pair.Value.Yes);
    Writer->WriteValue(TEXT("no"), Pair.Value.No);

    if (Pair.Value.Variants.Num() > 0) {
      Writer->WriteObjectStart(TEXT("variants"));
      for (const auto &VarPair : Pair.Value.Variants) {
        Writer->WriteValue(VarPair.Key, VarPair.Value);
      }
      Writer->WriteObjectEnd();
    }

    Writer->WriteObjectEnd();
  }
  Writer->WriteObjectEnd(); // flags

  // Missing flags
  Writer->WriteObjectStart(TEXT("missing"));
  for (const auto &Pair : MissingCopy) {
    Writer->WriteValue(Pair.Key, Pair.Value);
  }
  Writer->WriteObjectEnd(); // missing

  Writer->WriteObjectEnd(); // bucket
  Writer->WriteObjectEnd();
  Writer->Close();
}

// ==================== URL Building ====================

FString UGatrixFeaturesClient::BuildFetchUrl() const {
  FString BaseUrl =
      FString::Printf(TEXT("%s/client/features"), *ClientConfig.ApiUrl);

  if (!ClientConfig.Features.bUsePOSTRequests) {
    const FString QueryString = BuildContextQueryString();
    if (!QueryString.IsEmpty()) {
      BaseUrl += TEXT("?") + QueryString;
    }
  }

  return BaseUrl;
}

FString UGatrixFeaturesClient::BuildContextQueryString() const {
  TArray<FString> Params;

  Params.Add(
      FString::Printf(TEXT("appName=%s"),
                      *FGenericPlatformHttp::UrlEncode(ClientConfig.AppName)));
  Params.Add(FString::Printf(
      TEXT("environment=%s"),
      *FGenericPlatformHttp::UrlEncode(ClientConfig.Environment)));

  if (!ClientConfig.Context.UserId.IsEmpty())
    Params.Add(FString::Printf(
        TEXT("userId=%s"),
        *FGenericPlatformHttp::UrlEncode(ClientConfig.Context.UserId)));
  if (!ClientConfig.Context.SessionId.IsEmpty())
    Params.Add(FString::Printf(
        TEXT("sessionId=%s"),
        *FGenericPlatformHttp::UrlEncode(ClientConfig.Context.SessionId)));

  for (const auto &Prop : ClientConfig.Context.Properties) {
    Params.Add(FString::Printf(TEXT("properties[%s]=%s"),
                               *FGenericPlatformHttp::UrlEncode(Prop.Key),
                               *FGenericPlatformHttp::UrlEncode(Prop.Value)));
  }

  return FString::Join(Params, TEXT("&"));
}

FString UGatrixFeaturesClient::ContextToJson() const {
  FString Json;
  TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Json);
  Writer->WriteObjectStart();
  Writer->WriteObjectStart(TEXT("context"));

  Writer->WriteValue(TEXT("appName"), ClientConfig.AppName);
  Writer->WriteValue(TEXT("environment"), ClientConfig.Environment);

  if (!ClientConfig.Context.UserId.IsEmpty())
    Writer->WriteValue(TEXT("userId"), ClientConfig.Context.UserId);
  if (!ClientConfig.Context.SessionId.IsEmpty())
    Writer->WriteValue(TEXT("sessionId"), ClientConfig.Context.SessionId);

  if (ClientConfig.Context.Properties.Num() > 0) {
    Writer->WriteObjectStart(TEXT("properties"));
    for (const auto &Prop : ClientConfig.Context.Properties) {
      Writer->WriteValue(Prop.Key, Prop.Value);
    }
    Writer->WriteObjectEnd();
  }

  Writer->WriteObjectEnd(); // context
  Writer->WriteObjectEnd();
  Writer->Close();

  return Json;
}

// ==================== Statistics ====================

FGatrixFeaturesStats UGatrixFeaturesClient::GetStats() const {
  FScopeLock Lock(&StatsCriticalSection);

  FGatrixFeaturesStats Stats;
  Stats.TotalFlagCount = RealtimeFlags.Num();
  Stats.FetchFlagsCount = FetchFlagsCount;
  Stats.UpdateCount = UpdateCount;
  Stats.NotModifiedCount = NotModifiedCount;
  Stats.RecoveryCount = RecoveryCount;
  Stats.SyncFlagsCount = SyncFlagsCount;
  Stats.ImpressionCount = ImpressionCount;
  Stats.ContextChangeCount = ContextChangeCount;
  Stats.MetricsSentCount = MetricsSentCount;
  Stats.MetricsErrorCount = MetricsErrorCount;
  Stats.Etag = Etag;

  return Stats;
}

// ==================== IGatrixVariationProvider Implementation
// ====================

bool UGatrixFeaturesClient::IsEnabledInternal(const FString &FlagName,
                                              bool bForceRealtime) {
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags(bForceRealtime);
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  TrackAccess(FlagName, Found, TEXT("isEnabled"),
              Found ? Found->Variant.Name : TEXT(""));
  return Found ? Found->bEnabled : false;
}

FGatrixVariant
UGatrixFeaturesClient::GetVariantInternal(const FString &FlagName,
                                          bool bForceRealtime) {
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags(bForceRealtime);
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  TrackAccess(FlagName, Found, TEXT("getVariant"),
              Found ? Found->Variant.Name : TEXT(""));
  if (!Found) {
    return FGatrixVariant(GatrixVariantSource::Missing, false);
  }
  return Found->Variant;
}

FString UGatrixFeaturesClient::VariationInternal(const FString &FlagName,
                                                 const FString &FallbackValue,
                                                 bool bForceRealtime) {
  return GetVariantInternal(FlagName, bForceRealtime).Name;
}

bool UGatrixFeaturesClient::BoolVariationInternal(const FString &FlagName,
                                                  bool FallbackValue,
                                                  bool bForceRealtime) {
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags(bForceRealtime);
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  TrackAccess(FlagName, Found, TEXT("getVariant"),
              Found ? Found->Variant.Name : TEXT(""));
  if (!Found)
    return FallbackValue;
  if (Found->ValueType != EGatrixValueType::Boolean &&
      Found->ValueType != EGatrixValueType::None)
    return FallbackValue;
  if (Found->Variant.Value.IsEmpty())
    return FallbackValue;
  return Found->Variant.Value.ToBool();
}

FString
UGatrixFeaturesClient::StringVariationInternal(const FString &FlagName,
                                               const FString &FallbackValue,
                                               bool bForceRealtime) {
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags(bForceRealtime);
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  TrackAccess(FlagName, Found, TEXT("getVariant"),
              Found ? Found->Variant.Name : TEXT(""));
  if (!Found)
    return FallbackValue;
  if (Found->ValueType != EGatrixValueType::String &&
      Found->ValueType != EGatrixValueType::None)
    return FallbackValue;
  return Found->Variant.Value;
}

float UGatrixFeaturesClient::FloatVariationInternal(const FString &FlagName,
                                                    float FallbackValue,
                                                    bool bForceRealtime) {
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags(bForceRealtime);
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  TrackAccess(FlagName, Found, TEXT("getVariant"),
              Found ? Found->Variant.Name : TEXT(""));
  if (!Found)
    return FallbackValue;
  if (Found->ValueType != EGatrixValueType::Number &&
      Found->ValueType != EGatrixValueType::None)
    return FallbackValue;
  if (Found->Variant.Value.IsEmpty())
    return FallbackValue;
  return FCString::Atof(*Found->Variant.Value);
}

int32 UGatrixFeaturesClient::IntVariationInternal(const FString &FlagName,
                                                  int32 FallbackValue,
                                                  bool bForceRealtime) {
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags(bForceRealtime);
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  TrackAccess(FlagName, Found, TEXT("getVariant"),
              Found ? Found->Variant.Name : TEXT(""));
  if (!Found)
    return FallbackValue;
  if (Found->ValueType != EGatrixValueType::Number &&
      Found->ValueType != EGatrixValueType::None)
    return FallbackValue;
  if (Found->Variant.Value.IsEmpty())
    return FallbackValue;
  return FCString::Atoi(*Found->Variant.Value);
}

double UGatrixFeaturesClient::DoubleVariationInternal(const FString &FlagName,
                                                      double FallbackValue,
                                                      bool bForceRealtime) {
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags(bForceRealtime);
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  TrackAccess(FlagName, Found, TEXT("getVariant"),
              Found ? Found->Variant.Name : TEXT(""));
  if (!Found)
    return FallbackValue;
  if (Found->ValueType != EGatrixValueType::Number &&
      Found->ValueType != EGatrixValueType::None)
    return FallbackValue;
  if (Found->Variant.Value.IsEmpty())
    return FallbackValue;
  return FCString::Atod(*Found->Variant.Value);
}

FString
UGatrixFeaturesClient::JsonVariationInternal(const FString &FlagName,
                                             const FString &FallbackValue,
                                             bool bForceRealtime) {
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags(bForceRealtime);
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  TrackAccess(FlagName, Found, TEXT("getVariant"),
              Found ? Found->Variant.Name : TEXT(""));
  if (!Found)
    return FallbackValue;
  if (Found->ValueType != EGatrixValueType::Json &&
      Found->ValueType != EGatrixValueType::None)
    return FallbackValue;
  return Found->Variant.Value;
}

FGatrixVariationResult UGatrixFeaturesClient::BoolVariationDetailsInternal(
    const FString &FlagName, bool FallbackValue, bool bForceRealtime) {
  FGatrixVariationResult Result;
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags(bForceRealtime);
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  Result.bFlagExists = Found != nullptr;
  Result.bEnabled = Found ? Found->bEnabled : false;
  bool Val = BoolVariationInternal(FlagName, FallbackValue, bForceRealtime);
  Result.Value = Val ? TEXT("true") : TEXT("false");
  if (!Found)
    Result.Reason = TEXT("flag_not_found");
  else if (Found->ValueType != EGatrixValueType::Boolean &&
           Found->ValueType != EGatrixValueType::None)
    Result.Reason = TEXT("type_mismatch:expected_boolean");
  else
    Result.Reason = Found->Reason.IsEmpty() ? TEXT("evaluated") : Found->Reason;
  return Result;
}

FGatrixVariationResult UGatrixFeaturesClient::StringVariationDetailsInternal(
    const FString &FlagName, const FString &FallbackValue,
    bool bForceRealtime) {
  FGatrixVariationResult Result;
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags(bForceRealtime);
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  Result.bFlagExists = Found != nullptr;
  Result.bEnabled = Found ? Found->bEnabled : false;
  Result.Value =
      StringVariationInternal(FlagName, FallbackValue, bForceRealtime);
  if (!Found)
    Result.Reason = TEXT("flag_not_found");
  else if (Found->ValueType != EGatrixValueType::String &&
           Found->ValueType != EGatrixValueType::None)
    Result.Reason = TEXT("type_mismatch:expected_string");
  else
    Result.Reason = Found->Reason.IsEmpty() ? TEXT("evaluated") : Found->Reason;
  return Result;
}

FGatrixVariationResult UGatrixFeaturesClient::FloatVariationDetailsInternal(
    const FString &FlagName, float FallbackValue, bool bForceRealtime) {
  FGatrixVariationResult Result;
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags(bForceRealtime);
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  Result.bFlagExists = Found != nullptr;
  Result.bEnabled = Found ? Found->bEnabled : false;
  Result.Value = FString::SanitizeFloat(
      FloatVariationInternal(FlagName, FallbackValue, bForceRealtime));
  if (!Found)
    Result.Reason = TEXT("flag_not_found");
  else if (Found->ValueType != EGatrixValueType::Number &&
           Found->ValueType != EGatrixValueType::None)
    Result.Reason = TEXT("type_mismatch:expected_number");
  else
    Result.Reason = Found->Reason.IsEmpty() ? TEXT("evaluated") : Found->Reason;
  return Result;
}

FGatrixVariationResult UGatrixFeaturesClient::IntVariationDetailsInternal(
    const FString &FlagName, int32 FallbackValue, bool bForceRealtime) {
  FGatrixVariationResult Result;
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags(bForceRealtime);
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  Result.bFlagExists = Found != nullptr;
  Result.bEnabled = Found ? Found->bEnabled : false;
  Result.Value = FString::FromInt(
      IntVariationInternal(FlagName, FallbackValue, bForceRealtime));
  if (!Found)
    Result.Reason = TEXT("flag_not_found");
  else if (Found->ValueType != EGatrixValueType::Number &&
           Found->ValueType != EGatrixValueType::None)
    Result.Reason = TEXT("type_mismatch:expected_number");
  else
    Result.Reason = Found->Reason.IsEmpty() ? TEXT("evaluated") : Found->Reason;
  return Result;
}

FGatrixVariationResult UGatrixFeaturesClient::DoubleVariationDetailsInternal(
    const FString &FlagName, double FallbackValue, bool bForceRealtime) {
  FGatrixVariationResult Result;
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags(bForceRealtime);
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  Result.bFlagExists = Found != nullptr;
  Result.bEnabled = Found ? Found->bEnabled : false;
  Result.Value = FString::Printf(
      TEXT("%lf"),
      DoubleVariationInternal(FlagName, FallbackValue, bForceRealtime));
  if (!Found)
    Result.Reason = TEXT("flag_not_found");
  else if (Found->ValueType != EGatrixValueType::Number &&
           Found->ValueType != EGatrixValueType::None)
    Result.Reason = TEXT("type_mismatch:expected_number");
  else
    Result.Reason = Found->Reason.IsEmpty() ? TEXT("evaluated") : Found->Reason;
  return Result;
}

FGatrixVariationResult UGatrixFeaturesClient::JsonVariationDetailsInternal(
    const FString &FlagName, const FString &FallbackValue,
    bool bForceRealtime) {
  FGatrixVariationResult Result;
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags(bForceRealtime);
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  Result.bFlagExists = Found != nullptr;
  Result.bEnabled = Found ? Found->bEnabled : false;
  Result.Value = JsonVariationInternal(FlagName, FallbackValue, bForceRealtime);
  if (!Found)
    Result.Reason = TEXT("flag_not_found");
  else if (Found->ValueType != EGatrixValueType::Json &&
           Found->ValueType != EGatrixValueType::None)
    Result.Reason = TEXT("type_mismatch:expected_json");
  else
    Result.Reason = Found->Reason.IsEmpty() ? TEXT("evaluated") : Found->Reason;
  return Result;
}

bool UGatrixFeaturesClient::BoolVariationOrThrowInternal(
    const FString &FlagName, bool bForceRealtime) {
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags(bForceRealtime);
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  if (!Found)
    throw TEXT("Flag not found");
  return BoolVariationInternal(FlagName, false, bForceRealtime);
}

FString
UGatrixFeaturesClient::StringVariationOrThrowInternal(const FString &FlagName,
                                                      bool bForceRealtime) {
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags(bForceRealtime);
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  if (!Found)
    throw TEXT("Flag not found");
  return StringVariationInternal(FlagName, TEXT(""), bForceRealtime);
}

float UGatrixFeaturesClient::FloatVariationOrThrowInternal(
    const FString &FlagName, bool bForceRealtime) {
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags(bForceRealtime);
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  if (!Found)
    throw TEXT("Flag not found");
  return FloatVariationInternal(FlagName, 0.0f, bForceRealtime);
}

int32 UGatrixFeaturesClient::IntVariationOrThrowInternal(
    const FString &FlagName, bool bForceRealtime) {
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags(bForceRealtime);
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  if (!Found)
    throw TEXT("Flag not found");
  return IntVariationInternal(FlagName, 0, bForceRealtime);
}

double
UGatrixFeaturesClient::DoubleVariationOrThrowInternal(const FString &FlagName,
                                                      bool bForceRealtime) {
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags(bForceRealtime);
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  if (!Found)
    throw TEXT("Flag not found");
  return DoubleVariationInternal(FlagName, 0.0, bForceRealtime);
}

FString
UGatrixFeaturesClient::JsonVariationOrThrowInternal(const FString &FlagName,
                                                    bool bForceRealtime) {
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags(bForceRealtime);
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  if (!Found)
    throw TEXT("Flag not found");
  return JsonVariationInternal(FlagName, TEXT(""), bForceRealtime);
}
