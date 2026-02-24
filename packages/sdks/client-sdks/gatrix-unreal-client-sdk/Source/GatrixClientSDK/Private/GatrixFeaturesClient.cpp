// Copyright Gatrix. All Rights Reserved.
// FeaturesClient implementation - HTTP fetching, polling, caching, metrics,
// thread safety

#include "GatrixFeaturesClient.h"
#include "GatrixClient.h"
#include "GatrixEvents.h"
#include "GatrixClientSDKModule.h"

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

// ==================== Constructor ====================

UGatrixFeaturesClient::UGatrixFeaturesClient() {}

// ==================== Initialization ====================

void UGatrixFeaturesClient::Initialize(const FGatrixClientConfig& Config,
                                       FGatrixEventEmitter* Emitter,
                                       TSharedPtr<IGatrixStorageProvider> Storage,
                                       const FString& InConnectionId) {
  ClientConfig = Config;
  EventEmitter = Emitter;
  StorageProvider = Storage;
  ConnectionId = InConnectionId;
  SdkState = EGatrixSdkState::Initializing;

  // Ensure context has system fields
  ClientConfig.Features.Context.AppName = ClientConfig.AppName;
  ClientConfig.Features.Context.Environment = ClientConfig.Environment;

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
  ConsecutiveFailures.Reset();
  bPollingStopped = false;

  if (ClientConfig.bEnableDevMode) {
    UE_LOG(LogGatrix, Log,
           TEXT("[DEV] Start() called. offlineMode=%s, "
                "refreshInterval=%.1f, disableRefresh=%s"),
           ClientConfig.Features.bOfflineMode ? TEXT("True") : TEXT("False"),
           ClientConfig.Features.RefreshInterval,
           ClientConfig.Features.bDisableRefresh ? TEXT("True") : TEXT("False"));
  }

  if (ClientConfig.Features.bOfflineMode) {
    if (RealtimeFlags.Num() == 0) {
      SdkState = EGatrixSdkState::Error;
      FGatrixErrorEvent ErrorEvent;
      ErrorEvent.Type = TEXT("offline_no_data");
      ErrorEvent.Message = TEXT("offlineMode requires bootstrap data or cached flags");
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

  // Start streaming if enabled
  if (ClientConfig.Features.Streaming.bEnabled && !ClientConfig.Features.bOfflineMode) {
    ConnectStreaming();
  }
}

void UGatrixFeaturesClient::Start(TFunction<void(bool, const FString&)> OnComplete) {
  if (!OnComplete) {
    Start();
    return;
  }

  // Already ready — notify immediately
  if (bReadyEmitted) {
    OnComplete(true, TEXT(""));
    return;
  }

  // In offline mode Start() calls SetReady() synchronously after setting
  // bStarted, so we queue first and then call Start().
  PendingStartCallbacks.Add(MoveTemp(OnComplete));
  Start();
}

void UGatrixFeaturesClient::Stop() {
  if (ClientConfig.bEnableDevMode) {
    UE_LOG(LogGatrix, Log, TEXT("[DEV] Stop() called"));
  }
  bStarted = false;
  bPollingStopped = true;
  ConsecutiveFailures.Reset();
  StopPolling();
  StopMetrics();
  DisconnectStreaming();
}

// ==================== Flag Access (Thread-Safe) ====================

TMap<FString, FGatrixEvaluatedFlag> UGatrixFeaturesClient::SelectFlags(bool bForceRealtime) const {
  FScopeLock Lock(&FlagsCriticalSection);
  return SelectFlagsRef(bForceRealtime);
}

const TMap<FString, FGatrixEvaluatedFlag>&
UGatrixFeaturesClient::SelectFlagsRef(bool bForceRealtime) const {
  // Caller MUST hold FlagsCriticalSection
  if (bForceRealtime || !ClientConfig.Features.bExplicitSyncMode) {
    return RealtimeFlags;
  }
  return SynchronizedFlags;
}

const FGatrixEvaluatedFlag* UGatrixFeaturesClient::FindFlag(const FString& FlagName,
                                                            bool bForceRealtime,
                                                            FGatrixEvaluatedFlag& OutFlag) const {
  FScopeLock Lock(&FlagsCriticalSection);
  const TMap<FString, FGatrixEvaluatedFlag>& Flags = SelectFlagsRef(bForceRealtime);
  const FGatrixEvaluatedFlag* Found = Flags.Find(FlagName);
  if (Found) {
    OutFlag = *Found;
    return &OutFlag;
  }
  return nullptr;
}

bool UGatrixFeaturesClient::IsEnabled(const FString& FlagName, bool bForceRealtime) const {
  return const_cast<UGatrixFeaturesClient*>(this)->IsEnabledInternal(FlagName, bForceRealtime);
}

FGatrixEvaluatedFlag UGatrixFeaturesClient::GetFlag(const FString& FlagName,
                                                    bool bForceRealtime) const {
  FGatrixEvaluatedFlag FlagCopy;
  const FGatrixEvaluatedFlag* Found = FindFlag(FlagName, bForceRealtime, FlagCopy);
  if (!Found) {
    TrackAccess(FlagName, nullptr, TEXT("getFlag"), TEXT(""));
    return FGatrixEvaluatedFlag();
  }
  TrackAccess(FlagName, Found, TEXT("getFlag"), Found->Variant.Name);
  return *Found;
}

FGatrixVariant UGatrixFeaturesClient::GetVariant(const FString& FlagName,
                                                 bool bForceRealtime) const {
  return const_cast<UGatrixFeaturesClient*>(this)->GetVariantInternal(FlagName, bForceRealtime);
}

UGatrixFlagProxy* UGatrixFeaturesClient::CreateProxy(const FString& FlagName, bool bForceRealtime) {
  FScopeLock Lock(&FlagsCriticalSection);
  const auto& Flags = SelectFlagsRef(bForceRealtime);
  UGatrixFlagProxy* Proxy = NewObject<UGatrixFlagProxy>(this);

  const FGatrixEvaluatedFlag* Found = Flags.Find(FlagName);
  if (Found) {
    TrackAccess(FlagName, Found, TEXT("watch"), Found->Variant.Name);
  } else {
    TrackAccess(FlagName, nullptr, TEXT("watch"), TEXT(""));
  }

  Proxy->Initialize(this, FlagName, bForceRealtime);
  return Proxy;
}

TArray<FGatrixEvaluatedFlag> UGatrixFeaturesClient::GetAllFlags(bool bForceRealtime) const {
  FScopeLock Lock(&FlagsCriticalSection);
  const auto& Flags = SelectFlagsRef(bForceRealtime);
  TArray<FGatrixEvaluatedFlag> Result;
  Flags.GenerateValueArray(Result);
  return Result;
}

bool UGatrixFeaturesClient::HasFlag(const FString& FlagName, bool bForceRealtime) const {
  FGatrixEvaluatedFlag FlagCopy;
  return FindFlag(FlagName, bForceRealtime, FlagCopy) != nullptr;
}

// ==================== Variation Methods ====================

FString UGatrixFeaturesClient::Variation(const FString& FlagName, const FString& FallbackValue,
                                         bool bForceRealtime) const {
  return const_cast<UGatrixFeaturesClient*>(this)->VariationInternal(FlagName, FallbackValue,
                                                                     bForceRealtime);
}

bool UGatrixFeaturesClient::BoolVariation(const FString& FlagName, bool FallbackValue,
                                          bool bForceRealtime) const {
  return const_cast<UGatrixFeaturesClient*>(this)->BoolVariationInternal(FlagName, FallbackValue,
                                                                         bForceRealtime);
}

FString UGatrixFeaturesClient::StringVariation(const FString& FlagName,
                                               const FString& FallbackValue,
                                               bool bForceRealtime) const {
  return const_cast<UGatrixFeaturesClient*>(this)->StringVariationInternal(FlagName, FallbackValue,
                                                                           bForceRealtime);
}

float UGatrixFeaturesClient::FloatVariation(const FString& FlagName, float FallbackValue,
                                            bool bForceRealtime) const {
  return const_cast<UGatrixFeaturesClient*>(this)->FloatVariationInternal(FlagName, FallbackValue,
                                                                          bForceRealtime);
}

int32 UGatrixFeaturesClient::IntVariation(const FString& FlagName, int32 FallbackValue,
                                          bool bForceRealtime) const {
  return const_cast<UGatrixFeaturesClient*>(this)->IntVariationInternal(FlagName, FallbackValue,
                                                                        bForceRealtime);
}

double UGatrixFeaturesClient::DoubleVariation(const FString& FlagName, double FallbackValue,
                                              bool bForceRealtime) const {
  return const_cast<UGatrixFeaturesClient*>(this)->DoubleVariationInternal(FlagName, FallbackValue,
                                                                           bForceRealtime);
}

FString UGatrixFeaturesClient::JsonVariation(const FString& FlagName, const FString& FallbackValue,
                                             bool bForceRealtime) const {
  return const_cast<UGatrixFeaturesClient*>(this)->JsonVariationInternal(FlagName, FallbackValue,
                                                                         bForceRealtime);
}

// ==================== Variation Details ====================

FGatrixVariationResult UGatrixFeaturesClient::BoolVariationDetails(const FString& FlagName,
                                                                   bool FallbackValue,
                                                                   bool bForceRealtime) const {
  return const_cast<UGatrixFeaturesClient*>(this)->BoolVariationDetailsInternal(
      FlagName, FallbackValue, bForceRealtime);
}

FGatrixVariationResult UGatrixFeaturesClient::StringVariationDetails(const FString& FlagName,
                                                                     const FString& FallbackValue,
                                                                     bool bForceRealtime) const {
  return const_cast<UGatrixFeaturesClient*>(this)->StringVariationDetailsInternal(
      FlagName, FallbackValue, bForceRealtime);
}

FGatrixVariationResult UGatrixFeaturesClient::IntVariationDetails(const FString& FlagName,
                                                                  int32 FallbackValue,
                                                                  bool bForceRealtime) const {
  return const_cast<UGatrixFeaturesClient*>(this)->IntVariationDetailsInternal(
      FlagName, FallbackValue, bForceRealtime);
}

FGatrixVariationResult UGatrixFeaturesClient::FloatVariationDetails(const FString& FlagName,
                                                                    float FallbackValue,
                                                                    bool bForceRealtime) const {
  return const_cast<UGatrixFeaturesClient*>(this)->FloatVariationDetailsInternal(
      FlagName, FallbackValue, bForceRealtime);
}

FGatrixVariationResult UGatrixFeaturesClient::DoubleVariationDetails(const FString& FlagName,
                                                                     double FallbackValue,
                                                                     bool bForceRealtime) const {
  return const_cast<UGatrixFeaturesClient*>(this)->DoubleVariationDetailsInternal(
      FlagName, FallbackValue, bForceRealtime);
}

FGatrixVariationResult UGatrixFeaturesClient::JsonVariationDetails(const FString& FlagName,
                                                                   const FString& FallbackValue,
                                                                   bool bForceRealtime) const {
  return const_cast<UGatrixFeaturesClient*>(this)->JsonVariationDetailsInternal(
      FlagName, FallbackValue, bForceRealtime);
}

// ==================== OrThrow Variations ====================

bool UGatrixFeaturesClient::BoolVariationOrThrow(const FString& FlagName, bool bForceRealtime) {
  return BoolVariationOrThrowInternal(FlagName, bForceRealtime);
}

FString UGatrixFeaturesClient::StringVariationOrThrow(const FString& FlagName,
                                                      bool bForceRealtime) {
  return StringVariationOrThrowInternal(FlagName, bForceRealtime);
}

float UGatrixFeaturesClient::FloatVariationOrThrow(const FString& FlagName, bool bForceRealtime) {
  return FloatVariationOrThrowInternal(FlagName, bForceRealtime);
}

int32 UGatrixFeaturesClient::IntVariationOrThrow(const FString& FlagName, bool bForceRealtime) {
  return IntVariationOrThrowInternal(FlagName, bForceRealtime);
}

double UGatrixFeaturesClient::DoubleVariationOrThrow(const FString& FlagName, bool bForceRealtime) {
  return DoubleVariationOrThrowInternal(FlagName, bForceRealtime);
}

FString UGatrixFeaturesClient::JsonVariationOrThrow(const FString& FlagName, bool bForceRealtime) {
  return JsonVariationOrThrowInternal(FlagName, bForceRealtime);
}

// ==================== Context ====================

void UGatrixFeaturesClient::UpdateContext(const FGatrixContext& NewContext) {
  UpdateContext(NewContext, nullptr);
}

FString UGatrixFeaturesClient::ComputeContextHash(const FGatrixContext& Context) {
  // Build a deterministic string from context fields
  FString HashInput =
      Context.UserId + TEXT("|") + Context.SessionId + TEXT("|") + Context.CurrentTime;

  // Sort properties for deterministic ordering
  TArray<FString> Keys;
  Context.Properties.GetKeys(Keys);
  Keys.Sort();
  for (const FString& Key : Keys) {
    HashInput += TEXT("|") + Key + TEXT("=") + Context.Properties[Key];
  }

  // Use MD5 for fast hashing
  return FMD5::HashAnsiString(*HashInput);
}

void UGatrixFeaturesClient::UpdateContext(const FGatrixContext& NewContext,
                                          TFunction<void(bool, const FString&)> OnComplete) {
  // Preserve system fields
  FGatrixContext MergedContext = NewContext;
  MergedContext.AppName = ClientConfig.AppName;
  MergedContext.Environment = ClientConfig.Environment;

  // Check if context actually changed using hash
  FString NewHash = ComputeContextHash(MergedContext);
  if (NewHash == LastContextHash) {
    // No change — notify immediately without fetching
    if (OnComplete) {
      OnComplete(true, TEXT(""));
    }
    return;
  }

  ClientConfig.Features.Context = MergedContext;
  LastContextHash = NewHash;
  ContextChangeCount.Increment();

  // If not running or offline, no fetch will happen — notify immediately
  if (!bStarted || ClientConfig.Features.bOfflineMode) {
    if (OnComplete) {
      OnComplete(true, TEXT(""));
    }
    return;
  }

  // Queue the completion callback before triggering the fetch so it is already
  // registered when the fetch response arrives.
  if (OnComplete) {
    PendingContextCallbacks.Add(MoveTemp(OnComplete));
  }

  FetchFlags();
}

FGatrixContext UGatrixFeaturesClient::GetContext() const {
  return ClientConfig.Features.Context;
}

// ==================== Explicit Sync ====================

void UGatrixFeaturesClient::SyncFlags(bool bFetchNow) {
  SyncFlags(bFetchNow, nullptr);
}

void UGatrixFeaturesClient::SyncFlags(bool bFetchNow,
                                      TFunction<void(bool, const FString&)> OnComplete) {
  if (!ClientConfig.Features.bExplicitSyncMode) {
    if (OnComplete) {
      OnComplete(false, TEXT("ExplicitSyncMode is not enabled"));
    }
    return;
  }

  {
    FScopeLock Lock(&FlagsCriticalSection);
    TMap<FString, FGatrixEvaluatedFlag> OldFlags = SynchronizedFlags;
    SynchronizedFlags = RealtimeFlags;
    EmitFlagChanges(OldFlags, SynchronizedFlags);
    InvokeWatchCallbacks(SyncedWatchCallbacks, OldFlags, SynchronizedFlags,
                         /*bForceRealtime=*/false);
  }

  SyncFlagsCount.Increment();

  bPendingSync = false;
  if (EventEmitter) {
    EventEmitter->Emit(GatrixEvents::FlagsSync);
  }
  OnSync.Broadcast();

  if (bFetchNow) {
    FetchFlags(MoveTemp(OnComplete));
  } else {
    if (OnComplete) {
      OnComplete(true, TEXT(""));
    }
  }
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
  FetchFlags(nullptr);
}

void UGatrixFeaturesClient::FetchFlags(TFunction<void(bool, const FString&)> OnComplete) {
  if (OnComplete) {
    PendingFetchCallbacks.Add(MoveTemp(OnComplete));
  }

  if (bIsFetching || !bStarted)
    return;

  bIsFetching = true;

  if (ClientConfig.bEnableDevMode) {
    UE_LOG(LogGatrix, Log, TEXT("[DEV] FetchFlags: starting fetch. etag=%s"), *Etag);
  }

  if (EventEmitter) {
    EventEmitter->Emit(GatrixEvents::FlagsFetchStart);
  }

  DoFetchFlags();
}

void UGatrixFeaturesClient::DoFetchFlags() {
  FetchFlagsCount.Increment();

  FString Url = BuildFetchUrl();
  bool bUsePOST = ClientConfig.Features.bUsePOSTRequests;

  TSharedRef<IHttpRequest, ESPMode::ThreadSafe> HttpRequest = FHttpModule::Get().CreateRequest();
  HttpRequest->SetURL(Url);
  HttpRequest->SetVerb(bUsePOST ? TEXT("POST") : TEXT("GET"));
  HttpRequest->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
  HttpRequest->SetHeader(TEXT("X-API-Token"), ClientConfig.ApiToken);
  HttpRequest->SetHeader(TEXT("X-Application-Name"), ClientConfig.AppName);
  HttpRequest->SetHeader(TEXT("X-Environment"), ClientConfig.Environment);
  HttpRequest->SetHeader(TEXT("X-Connection-Id"), ConnectionId);
  HttpRequest->SetHeader(
      TEXT("X-SDK-Version"),
      FString::Printf(TEXT("%s/%s"), *UGatrixClient::SdkName, *UGatrixClient::SdkVersion));

  // ETag for conditional requests
  if (!Etag.IsEmpty()) {
    HttpRequest->SetHeader(TEXT("If-None-Match"), Etag);
  }

  // Custom headers
  for (const auto& Header : ClientConfig.CustomHeaders) {
    HttpRequest->SetHeader(Header.Key, Header.Value);
  }

  // POST body with context
  if (bUsePOST) {
    HttpRequest->SetContentAsString(ContextToJson());
  }

  // Set timeout
  HttpRequest->SetTimeout(ClientConfig.Features.FetchRetryOptions.Timeout);

  if (EventEmitter) {
    EventEmitter->Emit(GatrixEvents::FlagsFetch, Etag);
  }

  // HTTP response callback - runs on game thread in UE4
  HttpRequest->OnProcessRequestComplete().BindLambda(
      [this](FHttpRequestPtr Request, FHttpResponsePtr Response, bool bWasSuccessful) {
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

          // Notify UpdateContext callers (safe MoveTemp drain)
          {
            auto Pending = MoveTemp(PendingContextCallbacks);
            for (auto& Cb : Pending) {
              if (Cb)
                Cb(false, ErrorMsg);
            }
          }

          // Notify FetchFlags(onComplete) callers
          {
            auto Pending = MoveTemp(PendingFetchCallbacks);
            for (auto& Cb : Pending) {
              if (Cb)
                Cb(false, ErrorMsg);
            }
          }

          // Notify Start(onComplete) callers if we never became ready
          if (!bReadyEmitted) {
            auto Pending = MoveTemp(PendingStartCallbacks);
            for (auto& Cb : Pending) {
              if (Cb)
                Cb(false, ErrorMsg);
            }
          }

          SdkState = EGatrixSdkState::Error;
          // Network error: schedule with backoff
          ConsecutiveFailures.Increment();
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

void UGatrixFeaturesClient::HandleFetchResponse(const FString& ResponseBody, int32 HttpStatus,
                                                const FString& EtagHeader) {
  // Check for recovery from error state
  if (SdkState == EGatrixSdkState::Error && HttpStatus < 400) {
    SdkState = EGatrixSdkState::Healthy;
    RecoveryCount.Increment();
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
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(ResponseBody);
    if (!FJsonSerializer::Deserialize(Reader, JsonObject) || !JsonObject.IsValid()) {
      UE_LOG(LogGatrix, Error, TEXT("Failed to parse flags response JSON"));
      if (EventEmitter) {
        EventEmitter->Emit(GatrixEvents::FlagsFetchError, TEXT("JSON parse error"));
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
    const TSharedPtr<FJsonObject>* DataObj = nullptr;
    if (!JsonObject->TryGetObjectField(TEXT("data"), DataObj)) {
      return;
    }

    const TArray<TSharedPtr<FJsonValue>>* FlagsArray = nullptr;
    if (!(*DataObj)->TryGetArrayField(TEXT("flags"), FlagsArray)) {
      return;
    }

    TArray<FGatrixEvaluatedFlag> ParsedFlags;
    for (const auto& FlagValue : *FlagsArray) {
      const TSharedPtr<FJsonObject>* FlagObj = nullptr;
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
      const TSharedPtr<FJsonObject>* VariantObj = nullptr;
      if ((*FlagObj)->TryGetObjectField(TEXT("variant"), VariantObj)) {
        (*VariantObj)->TryGetStringField(TEXT("name"), Flag.Variant.Name);
        (*VariantObj)->TryGetBoolField(TEXT("enabled"), Flag.Variant.bEnabled);

        // Parse variant value using the declared valueType, not JSON parse type.
        // JSON may parse "1234" as a number, but if valueType is "string",
        // we must store it as the string "1234", not "1234.0".
        const TSharedPtr<FJsonValue> PayloadValue = (*VariantObj)->TryGetField(TEXT("value"));
        if (PayloadValue.IsValid()) {
          switch (Flag.ValueType) {
          case EGatrixValueType::String:
            // Always extract as string regardless of JSON type
            if (PayloadValue->Type == EJson::String) {
              PayloadValue->TryGetString(Flag.Variant.Value);
            } else if (PayloadValue->Type == EJson::Number) {
              // Value was sent as number but type is string — convert without ".0"
              double NumVal = 0;
              PayloadValue->TryGetNumber(NumVal);
              if (FMath::IsNearlyEqual(NumVal, FMath::RoundToDouble(NumVal))) {
                Flag.Variant.Value = FString::Printf(TEXT("%lld"), static_cast<int64>(NumVal));
              } else {
                Flag.Variant.Value = FString::SanitizeFloat(NumVal);
              }
            } else if (PayloadValue->Type == EJson::Boolean) {
              bool BoolVal = false;
              PayloadValue->TryGetBool(BoolVal);
              Flag.Variant.Value = BoolVal ? TEXT("true") : TEXT("false");
            } else {
              Flag.Variant.Value = PayloadValue->AsString();
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
            Flag.Variant.Value = FString::SanitizeFloat(NumVal);
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
            Flag.Variant.Value = BoolVal ? TEXT("true") : TEXT("false");
            break;
          }
          case EGatrixValueType::Json:
          default: {
            // For JSON or unknown types, serialize back to JSON string
            if (PayloadValue->Type == EJson::String) {
              PayloadValue->TryGetString(Flag.Variant.Value);
            } else if (PayloadValue->Type == EJson::Object || PayloadValue->Type == EJson::Array) {
              FString JsonStr;
              TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&JsonStr);
              FJsonSerializer::Serialize(PayloadValue, TEXT(""), Writer);
              Flag.Variant.Value = JsonStr;
            } else {
              Flag.Variant.Value = PayloadValue->AsString();
            }
            break;
          }
          }
        }
      }

      ParsedFlags.Add(MoveTemp(Flag));
    }

    bool bIsInitialFetch = !bFetchedFromServer;
    StoreFlags(ParsedFlags, bIsInitialFetch);

    UpdateCount.Increment();

    if (!bFetchedFromServer) {
      bFetchedFromServer = true;
      SetReady();
    }

    if (EventEmitter) {
      EventEmitter->Emit(GatrixEvents::FlagsFetchSuccess);
    }

    // Notify UpdateContext callers (safe MoveTemp drain)
    {
      auto Pending = MoveTemp(PendingContextCallbacks);
      for (auto& Cb : Pending) {
        if (Cb)
          Cb(true, TEXT(""));
      }
    }

    // Notify FetchFlags(onComplete) callers
    {
      auto Pending = MoveTemp(PendingFetchCallbacks);
      for (auto& Cb : Pending) {
        if (Cb)
          Cb(true, TEXT(""));
      }
    }

    // Success: reset failure counter and schedule at normal interval
    ConsecutiveFailures.Reset();
    ScheduleNextPoll();
  } else if (HttpStatus == 304) {
    // Not Modified
    NotModifiedCount.Increment();

    if (!bFetchedFromServer) {
      bFetchedFromServer = true;
      SetReady();
    }

    if (EventEmitter) {
      EventEmitter->Emit(GatrixEvents::FlagsFetchSuccess);
    }

    // Notify UpdateContext callers (safe MoveTemp drain)
    {
      auto Pending = MoveTemp(PendingContextCallbacks);
      for (auto& Cb : Pending) {
        if (Cb)
          Cb(true, TEXT(""));
      }
    }

    // Notify FetchFlags(onComplete) callers
    {
      auto Pending = MoveTemp(PendingFetchCallbacks);
      for (auto& Cb : Pending) {
        if (Cb)
          Cb(true, TEXT(""));
      }
    }

    // 304: reset failure counter and schedule at normal interval
    ConsecutiveFailures.Reset();
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
    bool bIsNonRetryable =
        ClientConfig.Features.FetchRetryOptions.NonRetryableStatusCodes.Contains(HttpStatus);

    if (bIsNonRetryable) {
      // Non-retryable error: stop polling entirely
      bPollingStopped = true;
      UE_LOG(LogGatrix, Error,
             TEXT("Polling stopped due to non-retryable status "
                  "code %d"),
             HttpStatus);
    } else {
      // Retryable error: schedule with backoff
      ConsecutiveFailures.Increment();
      ScheduleNextPoll();
    }

    // Notify UpdateContext callers (safe MoveTemp drain)
    {
      auto Pending = MoveTemp(PendingContextCallbacks);
      for (auto& Cb : Pending) {
        if (Cb)
          Cb(false, ErrorMsg);
      }
    }

    // Notify FetchFlags(onComplete) callers
    {
      auto Pending = MoveTemp(PendingFetchCallbacks);
      for (auto& Cb : Pending) {
        if (Cb)
          Cb(false, ErrorMsg);
      }
    }

    // Notify Start(onComplete) callers if we never became ready
    if (!bReadyEmitted) {
      auto Pending = MoveTemp(PendingStartCallbacks);
      for (auto& Cb : Pending) {
        if (Cb)
          Cb(false, ErrorMsg);
      }
    }
  }
}

// ==================== Storage ====================

void UGatrixFeaturesClient::StoreFlags(const TArray<FGatrixEvaluatedFlag>& NewFlags,
                                       bool bIsInitialFetch) {
  TMap<FString, FGatrixEvaluatedFlag> OldFlags;

  {
    FScopeLock Lock(&FlagsCriticalSection);
    OldFlags = RealtimeFlags;

    RealtimeFlags.Empty();
    for (const auto& Flag : NewFlags) {
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
    for (const auto& Flag : NewFlags) {
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

  if (!bIsInitialFetch) {
    // Log detected changes
    for (const auto& Pair : RealtimeFlags) {
      const FGatrixEvaluatedFlag* Old = OldFlags.Find(Pair.Key);
      if (!Old) {
        UE_LOG(LogGatrix, Verbose, TEXT("StoreFlags: ADDED '%s' enabled=%d value='%s'"), *Pair.Key,
               (int)Pair.Value.bEnabled, *Pair.Value.Variant.Value);
      } else if (Old->Version != Pair.Value.Version) {
        UE_LOG(
            LogGatrix, Log,
            TEXT("StoreFlags: CHANGED '%s' version %lld->%lld, enabled %d->%d, value '%s'->'%s'"),
            *Pair.Key, Old->Version, Pair.Value.Version, (int)Old->bEnabled,
            (int)Pair.Value.bEnabled, *Old->Variant.Value, *Pair.Value.Variant.Value);
      }
    }

    // Always invoke realtime flag changes (events) and watch callbacks
    EmitFlagChanges(OldFlags, RealtimeFlags);
    InvokeWatchCallbacks(WatchCallbacks, OldFlags, RealtimeFlags, /*bForceRealtime=*/true);

    if (!ClientConfig.Features.bExplicitSyncMode) {
      // In non-explicit mode, also invoke synced callbacks and global change events
      InvokeWatchCallbacks(SyncedWatchCallbacks, OldFlags, RealtimeFlags, /*bForceRealtime=*/false);

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
  if (!FJsonSerializer::Deserialize(Reader, ParsedValue) || !ParsedValue.IsValid())
    return;

  const TArray<TSharedPtr<FJsonValue>>* FlagsArray = nullptr;
  if (!ParsedValue->TryGetArray(FlagsArray))
    return;

  FScopeLock Lock(&FlagsCriticalSection);
  for (const auto& FlagValue : *FlagsArray) {
    const TSharedPtr<FJsonObject>* FlagObj = nullptr;
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

    const TSharedPtr<FJsonObject>* VariantObj = nullptr;
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

  UE_LOG(LogGatrix, Log, TEXT("Features ready. %d flags loaded."), RealtimeFlags.Num());

  // Notify Start(onComplete) callers (safe MoveTemp drain)
  {
    auto Pending = MoveTemp(PendingStartCallbacks);
    for (auto& Cb : Pending) {
      if (Cb)
        Cb(true, TEXT(""));
    }
  }
}

// ==================== Flag Change Emission ====================

void UGatrixFeaturesClient::EmitFlagChanges(const TMap<FString, FGatrixEvaluatedFlag>& OldFlags,
                                            const TMap<FString, FGatrixEvaluatedFlag>& NewFlags) {
  if (!EventEmitter)
    return;

  // Detect changed/created flags
  for (const auto& Pair : NewFlags) {
    const FGatrixEvaluatedFlag* OldFlag = OldFlags.Find(Pair.Key);
    if (!OldFlag || OldFlag->Version != Pair.Value.Version) {
      FString ChangeType = OldFlag ? TEXT("updated") : TEXT("created");
      EventEmitter->Emit(GatrixEvents::FlagChange(Pair.Key),
                         Pair.Value.Variant.Name + TEXT("|") + ChangeType);
    }
  }

  // Detect removed flags - emit bulk event, not per-flag change
  TArray<FString> RemovedNames;
  for (const auto& Pair : OldFlags) {
    if (!NewFlags.Contains(Pair.Key)) {
      RemovedNames.Add(Pair.Key);
    }
  }
  if (RemovedNames.Num() > 0) {
    EventEmitter->Emit(GatrixEvents::FlagsRemoved, FString::Join(RemovedNames, TEXT(",")));
  }
}

// ==================== Impressions ====================

void UGatrixFeaturesClient::TrackImpression(const FString& FlagName, bool bEnabled,
                                            const FString& VariantName, const FString& EventType) {
  FGatrixImpressionEvent Event;
  Event.EventType = EventType;
  Event.EventId = FGuid::NewGuid().ToString(EGuidFormats::DigitsWithHyphens).ToLower();
  Event.Context = ClientConfig.Features.Context;
  Event.bEnabled = bEnabled;
  Event.FeatureName = FlagName;
  Event.bImpressionData = true;
  Event.VariantName = VariantName;

  ImpressionCount.Increment();

  if (EventEmitter) {
    EventEmitter->Emit(GatrixEvents::FlagsImpression, FlagName);
  }
  OnImpression.Broadcast(Event);
}

void UGatrixFeaturesClient::TrackAccess(const FString& FlagName, const FGatrixEvaluatedFlag* Flag,
                                        const FString& EventType,
                                        const FString& VariantName) const {
  {
    FScopeLock Lock(&MetricsCriticalSection);
    if (!Flag) {
      MetricsMissingFlags.FindOrAdd(FlagName)++;
    } else {
      FFlagMetrics& Metrics = MetricsFlagBucket.FindOrAdd(FlagName);
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
    const_cast<UGatrixFeaturesClient*>(this)->TrackImpression(FlagName, Flag->bEnabled, VariantName,
                                                              EventType);
  } else if (ClientConfig.Features.bImpressionDataAll) {
    const_cast<UGatrixFeaturesClient*>(this)->TrackImpression(
        FlagName, Flag ? Flag->bEnabled : false, VariantName, EventType);
  }
}

// ==================== Watch ====================

int32 UGatrixFeaturesClient::WatchRealtimeFlag(const FString& FlagName,
                                               FGatrixFlagWatchDelegate Callback,
                                               const FString& Name) {
  FWatchCallbackEntry Entry;
  Entry.FlagName = FlagName;
  Entry.Callback = Callback;
  Entry.Handle = NextWatchHandle++;
  WatchCallbacks.Add(Entry);
  return Entry.Handle;
}

int32 UGatrixFeaturesClient::WatchSyncedFlag(const FString& FlagName,
                                             FGatrixFlagWatchDelegate Callback,
                                             const FString& Name) {
  FWatchCallbackEntry Entry;
  Entry.FlagName = FlagName;
  Entry.Callback = Callback;
  Entry.Handle = NextWatchHandle++;
  SyncedWatchCallbacks.Add(Entry);
  return Entry.Handle;
}

int32 UGatrixFeaturesClient::WatchRealtimeFlagWithInitialState(const FString& FlagName,
                                                               FGatrixFlagWatchDelegate Callback,
                                                               const FString& Name) {
  int32 Handle = WatchRealtimeFlag(FlagName, Callback, Name);

  // Emit initial state — always use realtimeFlags for realtime watchers
  if (bReadyEmitted) {
    UGatrixFlagProxy* Proxy = CreateProxy(FlagName, /*bForceRealtime=*/true);
    Callback.ExecuteIfBound(Proxy);
  } else if (EventEmitter) {
    // Capture by value for safe deferred invocation
    FString CapturedFlagName = FlagName;
    FGatrixFlagWatchDelegate CapturedCallback = Callback;
    EventEmitter->Once(
        GatrixEvents::FlagsReady,
        [this, CapturedFlagName, CapturedCallback](const TArray<FString>&) {
          UGatrixFlagProxy* Proxy = CreateProxy(CapturedFlagName, /*bForceRealtime=*/true);
          CapturedCallback.ExecuteIfBound(Proxy);
        },
        Name.IsEmpty() ? FString() : Name + TEXT("_initial"));
  }

  return Handle;
}

int32 UGatrixFeaturesClient::WatchSyncedFlagWithInitialState(const FString& FlagName,
                                                             FGatrixFlagWatchDelegate Callback,
                                                             const FString& Name) {
  int32 Handle = WatchSyncedFlag(FlagName, Callback, Name);

  // Emit initial state — respect explicitSyncMode for synced watchers
  if (bReadyEmitted) {
    UGatrixFlagProxy* Proxy = CreateProxy(FlagName, /*bForceRealtime=*/false);
    Callback.ExecuteIfBound(Proxy);
  } else if (EventEmitter) {
    FString CapturedFlagName = FlagName;
    FGatrixFlagWatchDelegate CapturedCallback = Callback;
    EventEmitter->Once(
        GatrixEvents::FlagsReady,
        [this, CapturedFlagName, CapturedCallback](const TArray<FString>&) {
          UGatrixFlagProxy* Proxy = CreateProxy(CapturedFlagName, /*bForceRealtime=*/false);
          CapturedCallback.ExecuteIfBound(Proxy);
        },
        Name.IsEmpty() ? FString() : Name + TEXT("_initial"));
  }

  return Handle;
}

void UGatrixFeaturesClient::UnwatchFlag(int32 Handle) {
  WatchCallbacks.RemoveAll(
      [Handle](const FWatchCallbackEntry& Entry) { return Entry.Handle == Handle; });
  SyncedWatchCallbacks.RemoveAll(
      [Handle](const FWatchCallbackEntry& Entry) { return Entry.Handle == Handle; });
}

FGatrixWatchFlagGroup* UGatrixFeaturesClient::CreateWatchGroup(const FString& Name) {
  return new FGatrixWatchFlagGroup(this, Name);
}

// ==================== Metadata Access Internal Methods ====================

bool UGatrixFeaturesClient::HasFlagInternal(const FString& FlagName, bool bForceRealtime) const {
  FGatrixEvaluatedFlag FlagCopy;
  return FindFlag(FlagName, bForceRealtime, FlagCopy) != nullptr;
}

EGatrixValueType UGatrixFeaturesClient::GetValueTypeInternal(const FString& FlagName,
                                                             bool bForceRealtime) const {
  FGatrixEvaluatedFlag FlagCopy;
  const FGatrixEvaluatedFlag* Found = FindFlag(FlagName, bForceRealtime, FlagCopy);
  if (!Found)
    return EGatrixValueType::None;
  return Found->ValueType;
}

int32 UGatrixFeaturesClient::GetVersionInternal(const FString& FlagName,
                                                bool bForceRealtime) const {
  FGatrixEvaluatedFlag FlagCopy;
  const FGatrixEvaluatedFlag* Found = FindFlag(FlagName, bForceRealtime, FlagCopy);
  if (!Found)
    return 0;
  return static_cast<int32>(Found->Version);
}

FString UGatrixFeaturesClient::GetReasonInternal(const FString& FlagName,
                                                 bool bForceRealtime) const {
  FGatrixEvaluatedFlag FlagCopy;
  const FGatrixEvaluatedFlag* Found = FindFlag(FlagName, bForceRealtime, FlagCopy);
  if (!Found)
    return TEXT("");
  return Found->Reason;
}

bool UGatrixFeaturesClient::GetImpressionDataInternal(const FString& FlagName,
                                                      bool bForceRealtime) const {
  FGatrixEvaluatedFlag FlagCopy;
  const FGatrixEvaluatedFlag* Found = FindFlag(FlagName, bForceRealtime, FlagCopy);
  if (!Found)
    return false;
  return Found->bImpressionData;
}

FGatrixEvaluatedFlag UGatrixFeaturesClient::GetRawFlagInternal(const FString& FlagName,
                                                               bool bForceRealtime) const {
  FGatrixEvaluatedFlag FlagCopy;
  const FGatrixEvaluatedFlag* Found = FindFlag(FlagName, bForceRealtime, FlagCopy);
  if (Found)
    return *Found;
  FGatrixEvaluatedFlag Empty;
  Empty.Name = FlagName;
  return Empty;
}

void UGatrixFeaturesClient::InvokeWatchCallbacks(
    const TArray<FWatchCallbackEntry>& CallbackList,
    const TMap<FString, FGatrixEvaluatedFlag>& OldFlags,
    const TMap<FString, FGatrixEvaluatedFlag>& NewFlags, bool bForceRealtime) {
  // Check for changed/new flags
  for (const auto& Pair : NewFlags) {
    const FGatrixEvaluatedFlag* OldFlag = OldFlags.Find(Pair.Key);
    if (!OldFlag || OldFlag->Version != Pair.Value.Version) {
      // Invoke watch callbacks for this flag
      for (const auto& Entry : CallbackList) {
        UE_LOG(LogGatrix, Verbose,
               TEXT("InvokeWatchCallbacks: changed='%s', watching='%s', match=%d"), *Pair.Key,
               *Entry.FlagName, (int)(Entry.FlagName == Pair.Key));
        if (Entry.FlagName == Pair.Key) {
          UGatrixFlagProxy* Proxy = CreateProxy(Pair.Key, bForceRealtime);
          Entry.Callback.ExecuteIfBound(Proxy);
        }
      }
    }
  }

  // Check for removed flags
  for (const auto& Pair : OldFlags) {
    if (!NewFlags.Contains(Pair.Key)) {
      for (const auto& Entry : CallbackList) {
        if (Entry.FlagName == Pair.Key) {
          UGatrixFlagProxy* Proxy = CreateProxy(Pair.Key, bForceRealtime);
          Entry.Callback.ExecuteIfBound(Proxy);
        }
      }
    }
  }
}

// ==================== Polling ====================

void UGatrixFeaturesClient::ScheduleNextPoll() {
  if (!bStarted || ClientConfig.Features.bDisableRefresh || ClientConfig.Features.bOfflineMode ||
      bPollingStopped) {
    return;
  }

  // Stop existing timer
  StopPolling();

  float Interval = ClientConfig.Features.RefreshInterval;
  if (Interval <= 0.0f)
    Interval = 30.0f;

  // Apply exponential backoff on consecutive failures
  if (ConsecutiveFailures.GetValue() > 0) {
    float InitialBackoff = ClientConfig.Features.FetchRetryOptions.InitialBackoff;
    float MaxBackoffVal = ClientConfig.Features.FetchRetryOptions.MaxBackoff;
    float BackoffSec = FMath::Min(
        InitialBackoff * FMath::Pow(2.0f, static_cast<float>(ConsecutiveFailures.GetValue() - 1)),
        MaxBackoffVal);
    Interval = BackoffSec;
    UE_LOG(LogGatrix, Warning,
           TEXT("Scheduling retry after %.1fs (consecutive "
                "failures: %d)"),
           Interval, ConsecutiveFailures.GetValue());
  } else {
    // Add jitter (+/-10%) to prevent thundering herd
    const float JitterRange = Interval * 0.1f;
    Interval += FMath::FRandRange(-JitterRange, JitterRange);
  }

  if (ClientConfig.bEnableDevMode) {
    UE_LOG(LogGatrix, Log,
           TEXT("[DEV] ScheduleNextPoll: delay=%.1fs, "
                "consecutiveFailures=%d, pollingStopped=%s"),
           Interval, ConsecutiveFailures.GetValue(),
           bPollingStopped ? TEXT("True") : TEXT("False"));
  }

  // Use engine world timer if available
  UWorld* World = nullptr;
  if (GEngine) {
    World =
        GEngine->GetWorldContexts().Num() > 0 ? GEngine->GetWorldContexts()[0].World() : nullptr;
  }

  if (World) {
    World->GetTimerManager().SetTimer(PollTimerHandle,
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
  UWorld* World = nullptr;
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

  UWorld* World = nullptr;
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

              UWorld* W = nullptr;
              if (GEngine && GEngine->GetWorldContexts().Num() > 0) {
                W = GEngine->GetWorldContexts()[0].World();
              }
              if (W) {
                W->GetTimerManager().SetTimer(
                    MetricsTimerHandle,
                    FTimerDelegate::CreateWeakLambda(this, [this]() { SendMetrics(); }), Interval,
                    true // recurring
                );
              }
            }),
        InitialDelay, false);
  }
}

void UGatrixFeaturesClient::StopMetrics() {
  UWorld* World = nullptr;
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

  FString MetricsUrl = FString::Printf(TEXT("%s/client/features/%s/metrics"), *ClientConfig.ApiUrl,
                                       *FGenericPlatformHttp::UrlEncode(ClientConfig.Environment));

  // Retry with a simple attempt counter via shared pointer
  auto RetryCount = MakeShared<int32>(0);
  const int32 MaxRetries = 2;

  auto DoSendMetrics = [this, MetricsUrl, PayloadJson, RetryCount, MaxRetries]() {
    TSharedRef<IHttpRequest, ESPMode::ThreadSafe> HttpRequest = FHttpModule::Get().CreateRequest();
    HttpRequest->SetURL(MetricsUrl);
    HttpRequest->SetVerb(TEXT("POST"));
    HttpRequest->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
    HttpRequest->SetHeader(TEXT("X-API-Token"), ClientConfig.ApiToken);
    HttpRequest->SetHeader(TEXT("X-Application-Name"), ClientConfig.AppName);
    HttpRequest->SetHeader(TEXT("X-Connection-Id"), ConnectionId);
    HttpRequest->SetHeader(
        TEXT("X-SDK-Version"),
        FString::Printf(TEXT("%s/%s"), *UGatrixClient::SdkName, *UGatrixClient::SdkVersion));

    // Custom headers
    for (const auto& Header : ClientConfig.CustomHeaders) {
      HttpRequest->SetHeader(Header.Key, Header.Value);
    }

    HttpRequest->SetContentAsString(PayloadJson);
    return HttpRequest;
  };

  // Use a weak lambda to handle response and retry
  TSharedRef<IHttpRequest, ESPMode::ThreadSafe> HttpRequest = DoSendMetrics();

  HttpRequest->OnProcessRequestComplete().BindLambda(
      [this, RetryCount, MaxRetries,
       DoSendMetrics](FHttpRequestPtr Request, FHttpResponsePtr Response, bool bWasSuccessful) {
        if (bWasSuccessful && Response.IsValid() && Response->GetResponseCode() < 400) {
          MetricsSentCount.Increment();
          if (EventEmitter) {
            EventEmitter->Emit(GatrixEvents::FlagsMetricsSent);
          }
        } else {
          // Retry on retryable status codes
          const int32 StatusCode = Response.IsValid() ? Response->GetResponseCode() : 0;
          const bool bRetryable =
              !bWasSuccessful || StatusCode == 408 || StatusCode == 429 || StatusCode >= 500;

          if (bRetryable && *RetryCount < MaxRetries) {
            (*RetryCount)++;
            const float Delay = FMath::Pow(2.0f, (float)*RetryCount);

            UWorld* RetryWorld = nullptr;
            if (GEngine && GEngine->GetWorldContexts().Num() > 0) {
              RetryWorld = GEngine->GetWorldContexts()[0].World();
            }
            if (RetryWorld) {
              FTimerHandle TimerHandle;
              RetryWorld->GetTimerManager().SetTimer(
                  TimerHandle,
                  FTimerDelegate::CreateWeakLambda(this,
                                                   [DoSendMetrics]() {
                                                     auto Req = DoSendMetrics();
                                                     Req->ProcessRequest();
                                                   }),
                  Delay, false);
              return;
            }
          }

          MetricsErrorCount.Increment();
          if (EventEmitter) {
            EventEmitter->Emit(GatrixEvents::FlagsMetricsError);
          }
        }
      });

  HttpRequest->ProcessRequest();
}

void UGatrixFeaturesClient::BuildMetricsPayload(FString& OutJson) const {
  TMap<FString, FFlagMetrics> BucketCopy;
  TMap<FString, int32> MissingCopy;

  {
    FScopeLock Lock(&MetricsCriticalSection);
    BucketCopy = MetricsFlagBucket;
    MissingCopy = MetricsMissingFlags;

    // Clear after reading
    const_cast<TMap<FString, FFlagMetrics>&>(MetricsFlagBucket).Empty();
    const_cast<TMap<FString, int32>&>(MetricsMissingFlags).Empty();
    const_cast<FDateTime&>(MetricsBucketStartTime) = FDateTime::UtcNow();
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

  Writer->WriteValue(TEXT("start"), MetricsBucketStartTime.ToIso8601());
  Writer->WriteValue(TEXT("stop"), FDateTime::UtcNow().ToIso8601());

  // Flag access counts
  Writer->WriteObjectStart(TEXT("flags"));
  for (const auto& Pair : BucketCopy) {
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
  for (const auto& Pair : MissingCopy) {
    Writer->WriteValue(Pair.Key, Pair.Value);
  }
  Writer->WriteObjectEnd(); // missing

  Writer->WriteObjectEnd(); // bucket
  Writer->WriteObjectEnd();
  Writer->Close();
}

// ==================== URL Building ====================

FString UGatrixFeaturesClient::BuildFetchUrl() const {
  // URL pattern: {apiUrl}/client/features/{environment}/eval
  FString BaseUrl = FString::Printf(TEXT("%s/client/features/%s/eval"), *ClientConfig.ApiUrl,
                                    *FGenericPlatformHttp::UrlEncode(ClientConfig.Environment));

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
      FString::Printf(TEXT("appName=%s"), *FGenericPlatformHttp::UrlEncode(ClientConfig.AppName)));
  Params.Add(FString::Printf(TEXT("environment=%s"),
                             *FGenericPlatformHttp::UrlEncode(ClientConfig.Environment)));

  if (!ClientConfig.Features.Context.UserId.IsEmpty())
    Params.Add(FString::Printf(
        TEXT("userId=%s"), *FGenericPlatformHttp::UrlEncode(ClientConfig.Features.Context.UserId)));
  if (!ClientConfig.Features.Context.SessionId.IsEmpty())
    Params.Add(FString::Printf(TEXT("sessionId=%s"), *FGenericPlatformHttp::UrlEncode(
                                                         ClientConfig.Features.Context.SessionId)));

  for (const auto& Prop : ClientConfig.Features.Context.Properties) {
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

  if (!ClientConfig.Features.Context.UserId.IsEmpty())
    Writer->WriteValue(TEXT("userId"), ClientConfig.Features.Context.UserId);
  if (!ClientConfig.Features.Context.SessionId.IsEmpty())
    Writer->WriteValue(TEXT("sessionId"), ClientConfig.Features.Context.SessionId);

  if (ClientConfig.Features.Context.Properties.Num() > 0) {
    Writer->WriteObjectStart(TEXT("properties"));
    for (const auto& Prop : ClientConfig.Features.Context.Properties) {
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
  FGatrixFeaturesStats Stats;
  Stats.TotalFlagCount = RealtimeFlags.Num();
  Stats.FetchFlagsCount = FetchFlagsCount.GetValue();
  Stats.UpdateCount = UpdateCount.GetValue();
  Stats.NotModifiedCount = NotModifiedCount.GetValue();
  Stats.RecoveryCount = RecoveryCount.GetValue();
  Stats.SyncFlagsCount = SyncFlagsCount.GetValue();
  Stats.ImpressionCount = ImpressionCount.GetValue();
  Stats.ContextChangeCount = ContextChangeCount.GetValue();
  Stats.MetricsSentCount = MetricsSentCount.GetValue();
  Stats.MetricsErrorCount = MetricsErrorCount.GetValue();
  Stats.Etag = Etag;

  // Streaming stats
  Stats.bStreamingEnabled = ClientConfig.Features.Streaming.bEnabled;
  Stats.StreamingState = StreamingState;
  Stats.StreamingTransport = ClientConfig.Features.Streaming.Transport;
  Stats.StreamingReconnectCount = StreamingReconnectCount;
  Stats.StreamingEventCount = StreamingEventCount;
  Stats.StreamingErrorCount = StreamingErrorCount;
  Stats.StreamingRecoveryCount = StreamingRecoveryCount;

  return Stats;
}

// ==================== IGatrixVariationProvider Implementation
// ====================

bool UGatrixFeaturesClient::IsEnabledInternal(const FString& FlagName, bool bForceRealtime) {
  FGatrixEvaluatedFlag FlagCopy;
  const FGatrixEvaluatedFlag* Found = FindFlag(FlagName, bForceRealtime, FlagCopy);
  TrackAccess(FlagName, Found, TEXT("isEnabled"), Found ? Found->Variant.Name : TEXT(""));
  return Found ? Found->bEnabled : false;
}

FGatrixVariant UGatrixFeaturesClient::GetVariantInternal(const FString& FlagName,
                                                         bool bForceRealtime) {
  FGatrixEvaluatedFlag FlagCopy;
  const FGatrixEvaluatedFlag* Found = FindFlag(FlagName, bForceRealtime, FlagCopy);
  TrackAccess(FlagName, Found, TEXT("getVariant"), Found ? Found->Variant.Name : TEXT(""));
  if (!Found) {
    return FGatrixVariant(GatrixVariantSource::Missing, false);
  }
  return Found->Variant;
}

FString UGatrixFeaturesClient::VariationInternal(const FString& FlagName,
                                                 const FString& FallbackValue,
                                                 bool bForceRealtime) {
  return GetVariantInternal(FlagName, bForceRealtime).Name;
}

bool UGatrixFeaturesClient::BoolVariationInternal(const FString& FlagName, bool FallbackValue,
                                                  bool bForceRealtime) {
  FGatrixEvaluatedFlag FlagCopy;
  const FGatrixEvaluatedFlag* Found = FindFlag(FlagName, bForceRealtime, FlagCopy);
  TrackAccess(FlagName, Found, TEXT("getVariant"), Found ? Found->Variant.Name : TEXT(""));
  if (!Found)
    return FallbackValue;
  if (Found->ValueType != EGatrixValueType::Boolean && Found->ValueType != EGatrixValueType::None)
    return FallbackValue;
  if (Found->Variant.Value.IsEmpty())
    return FallbackValue;
  return Found->Variant.Value.ToBool();
}

FString UGatrixFeaturesClient::StringVariationInternal(const FString& FlagName,
                                                       const FString& FallbackValue,
                                                       bool bForceRealtime) {
  FGatrixEvaluatedFlag FlagCopy;
  const FGatrixEvaluatedFlag* Found = FindFlag(FlagName, bForceRealtime, FlagCopy);
  TrackAccess(FlagName, Found, TEXT("getVariant"), Found ? Found->Variant.Name : TEXT(""));
  if (!Found)
    return FallbackValue;
  if (Found->ValueType != EGatrixValueType::String && Found->ValueType != EGatrixValueType::None)
    return FallbackValue;
  return Found->Variant.Value;
}

float UGatrixFeaturesClient::FloatVariationInternal(const FString& FlagName, float FallbackValue,
                                                    bool bForceRealtime) {
  FGatrixEvaluatedFlag FlagCopy;
  const FGatrixEvaluatedFlag* Found = FindFlag(FlagName, bForceRealtime, FlagCopy);
  TrackAccess(FlagName, Found, TEXT("getVariant"), Found ? Found->Variant.Name : TEXT(""));
  if (!Found)
    return FallbackValue;
  if (Found->ValueType != EGatrixValueType::Number && Found->ValueType != EGatrixValueType::None)
    return FallbackValue;
  if (Found->Variant.Value.IsEmpty())
    return FallbackValue;
  return FCString::Atof(*Found->Variant.Value);
}

int32 UGatrixFeaturesClient::IntVariationInternal(const FString& FlagName, int32 FallbackValue,
                                                  bool bForceRealtime) {
  FGatrixEvaluatedFlag FlagCopy;
  const FGatrixEvaluatedFlag* Found = FindFlag(FlagName, bForceRealtime, FlagCopy);
  TrackAccess(FlagName, Found, TEXT("getVariant"), Found ? Found->Variant.Name : TEXT(""));
  if (!Found)
    return FallbackValue;
  if (Found->ValueType != EGatrixValueType::Number && Found->ValueType != EGatrixValueType::None)
    return FallbackValue;
  if (Found->Variant.Value.IsEmpty())
    return FallbackValue;
  return FCString::Atoi(*Found->Variant.Value);
}

double UGatrixFeaturesClient::DoubleVariationInternal(const FString& FlagName, double FallbackValue,
                                                      bool bForceRealtime) {
  FGatrixEvaluatedFlag FlagCopy;
  const FGatrixEvaluatedFlag* Found = FindFlag(FlagName, bForceRealtime, FlagCopy);
  TrackAccess(FlagName, Found, TEXT("getVariant"), Found ? Found->Variant.Name : TEXT(""));
  if (!Found)
    return FallbackValue;
  if (Found->ValueType != EGatrixValueType::Number && Found->ValueType != EGatrixValueType::None)
    return FallbackValue;
  if (Found->Variant.Value.IsEmpty())
    return FallbackValue;
  return FCString::Atod(*Found->Variant.Value);
}

FString UGatrixFeaturesClient::JsonVariationInternal(const FString& FlagName,
                                                     const FString& FallbackValue,
                                                     bool bForceRealtime) {
  FGatrixEvaluatedFlag FlagCopy;
  const FGatrixEvaluatedFlag* Found = FindFlag(FlagName, bForceRealtime, FlagCopy);
  TrackAccess(FlagName, Found, TEXT("getVariant"), Found ? Found->Variant.Name : TEXT(""));
  if (!Found)
    return FallbackValue;
  if (Found->ValueType != EGatrixValueType::Json && Found->ValueType != EGatrixValueType::None)
    return FallbackValue;
  return Found->Variant.Value;
}

FGatrixVariationResult UGatrixFeaturesClient::BoolVariationDetailsInternal(const FString& FlagName,
                                                                           bool FallbackValue,
                                                                           bool bForceRealtime) {
  FGatrixVariationResult Result;
  FGatrixEvaluatedFlag FlagCopy;
  const FGatrixEvaluatedFlag* Found = FindFlag(FlagName, bForceRealtime, FlagCopy);
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
    const FString& FlagName, const FString& FallbackValue, bool bForceRealtime) {
  FGatrixVariationResult Result;
  FGatrixEvaluatedFlag FlagCopy;
  const FGatrixEvaluatedFlag* Found = FindFlag(FlagName, bForceRealtime, FlagCopy);
  Result.bFlagExists = Found != nullptr;
  Result.bEnabled = Found ? Found->bEnabled : false;
  Result.Value = StringVariationInternal(FlagName, FallbackValue, bForceRealtime);
  if (!Found)
    Result.Reason = TEXT("flag_not_found");
  else if (Found->ValueType != EGatrixValueType::String &&
           Found->ValueType != EGatrixValueType::None)
    Result.Reason = TEXT("type_mismatch:expected_string");
  else
    Result.Reason = Found->Reason.IsEmpty() ? TEXT("evaluated") : Found->Reason;
  return Result;
}

FGatrixVariationResult UGatrixFeaturesClient::FloatVariationDetailsInternal(const FString& FlagName,
                                                                            float FallbackValue,
                                                                            bool bForceRealtime) {
  FGatrixVariationResult Result;
  FGatrixEvaluatedFlag FlagCopy;
  const FGatrixEvaluatedFlag* Found = FindFlag(FlagName, bForceRealtime, FlagCopy);
  Result.bFlagExists = Found != nullptr;
  Result.bEnabled = Found ? Found->bEnabled : false;
  Result.Value =
      FString::SanitizeFloat(FloatVariationInternal(FlagName, FallbackValue, bForceRealtime));
  if (!Found)
    Result.Reason = TEXT("flag_not_found");
  else if (Found->ValueType != EGatrixValueType::Number &&
           Found->ValueType != EGatrixValueType::None)
    Result.Reason = TEXT("type_mismatch:expected_number");
  else
    Result.Reason = Found->Reason.IsEmpty() ? TEXT("evaluated") : Found->Reason;
  return Result;
}

FGatrixVariationResult UGatrixFeaturesClient::IntVariationDetailsInternal(const FString& FlagName,
                                                                          int32 FallbackValue,
                                                                          bool bForceRealtime) {
  FGatrixVariationResult Result;
  FGatrixEvaluatedFlag FlagCopy;
  const FGatrixEvaluatedFlag* Found = FindFlag(FlagName, bForceRealtime, FlagCopy);
  Result.bFlagExists = Found != nullptr;
  Result.bEnabled = Found ? Found->bEnabled : false;
  Result.Value = FString::FromInt(IntVariationInternal(FlagName, FallbackValue, bForceRealtime));
  if (!Found)
    Result.Reason = TEXT("flag_not_found");
  else if (Found->ValueType != EGatrixValueType::Number &&
           Found->ValueType != EGatrixValueType::None)
    Result.Reason = TEXT("type_mismatch:expected_number");
  else
    Result.Reason = Found->Reason.IsEmpty() ? TEXT("evaluated") : Found->Reason;
  return Result;
}

FGatrixVariationResult
UGatrixFeaturesClient::DoubleVariationDetailsInternal(const FString& FlagName, double FallbackValue,
                                                      bool bForceRealtime) {
  FGatrixVariationResult Result;
  FGatrixEvaluatedFlag FlagCopy;
  const FGatrixEvaluatedFlag* Found = FindFlag(FlagName, bForceRealtime, FlagCopy);
  Result.bFlagExists = Found != nullptr;
  Result.bEnabled = Found ? Found->bEnabled : false;
  Result.Value = FString::Printf(TEXT("%lf"),
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
    const FString& FlagName, const FString& FallbackValue, bool bForceRealtime) {
  FGatrixVariationResult Result;
  FGatrixEvaluatedFlag FlagCopy;
  const FGatrixEvaluatedFlag* Found = FindFlag(FlagName, bForceRealtime, FlagCopy);
  Result.bFlagExists = Found != nullptr;
  Result.bEnabled = Found ? Found->bEnabled : false;
  Result.Value = JsonVariationInternal(FlagName, FallbackValue, bForceRealtime);
  if (!Found)
    Result.Reason = TEXT("flag_not_found");
  else if (Found->ValueType != EGatrixValueType::Json && Found->ValueType != EGatrixValueType::None)
    Result.Reason = TEXT("type_mismatch:expected_json");
  else
    Result.Reason = Found->Reason.IsEmpty() ? TEXT("evaluated") : Found->Reason;
  return Result;
}

bool UGatrixFeaturesClient::BoolVariationOrThrowInternal(const FString& FlagName,
                                                         bool bForceRealtime) {
  FGatrixEvaluatedFlag FlagCopy;
  const FGatrixEvaluatedFlag* Found = FindFlag(FlagName, bForceRealtime, FlagCopy);
  if (!Found)
    throw TEXT("Flag not found");
  return BoolVariationInternal(FlagName, false, bForceRealtime);
}

FString UGatrixFeaturesClient::StringVariationOrThrowInternal(const FString& FlagName,
                                                              bool bForceRealtime) {
  FGatrixEvaluatedFlag FlagCopy;
  const FGatrixEvaluatedFlag* Found = FindFlag(FlagName, bForceRealtime, FlagCopy);
  if (!Found)
    throw TEXT("Flag not found");
  return StringVariationInternal(FlagName, TEXT(""), bForceRealtime);
}

float UGatrixFeaturesClient::FloatVariationOrThrowInternal(const FString& FlagName,
                                                           bool bForceRealtime) {
  FGatrixEvaluatedFlag FlagCopy;
  const FGatrixEvaluatedFlag* Found = FindFlag(FlagName, bForceRealtime, FlagCopy);
  if (!Found)
    throw TEXT("Flag not found");
  return FloatVariationInternal(FlagName, 0.0f, bForceRealtime);
}

int32 UGatrixFeaturesClient::IntVariationOrThrowInternal(const FString& FlagName,
                                                         bool bForceRealtime) {
  FGatrixEvaluatedFlag FlagCopy;
  const FGatrixEvaluatedFlag* Found = FindFlag(FlagName, bForceRealtime, FlagCopy);
  if (!Found)
    throw TEXT("Flag not found");
  return IntVariationInternal(FlagName, 0, bForceRealtime);
}

double UGatrixFeaturesClient::DoubleVariationOrThrowInternal(const FString& FlagName,
                                                             bool bForceRealtime) {
  FGatrixEvaluatedFlag FlagCopy;
  const FGatrixEvaluatedFlag* Found = FindFlag(FlagName, bForceRealtime, FlagCopy);
  if (!Found)
    throw TEXT("Flag not found");
  return DoubleVariationInternal(FlagName, 0.0, bForceRealtime);
}

FString UGatrixFeaturesClient::JsonVariationOrThrowInternal(const FString& FlagName,
                                                            bool bForceRealtime) {
  FGatrixEvaluatedFlag FlagCopy;
  const FGatrixEvaluatedFlag* Found = FindFlag(FlagName, bForceRealtime, FlagCopy);
  if (!Found)
    throw TEXT("Flag not found");
  return JsonVariationInternal(FlagName, TEXT(""), bForceRealtime);
}

// ==================== Streaming ====================

void UGatrixFeaturesClient::ConnectStreaming() {
  DisconnectStreaming();

  const FGatrixStreamingConfig& StreamConfig = ClientConfig.Features.Streaming;

  if (!StreamConfig.bEnabled || ClientConfig.Features.bOfflineMode) {
    return;
  }

  SetStreamingState(EGatrixStreamingConnectionState::Connecting);

  FString Url = BuildStreamingUrl();
  TMap<FString, FString> Headers;
  Headers.Add(TEXT("X-API-Token"), ClientConfig.ApiToken);
  Headers.Add(TEXT("X-Application-Name"), ClientConfig.AppName);
  Headers.Add(TEXT("X-Connection-Id"), ConnectionId);
  Headers.Add(TEXT("X-SDK-Version"),
              FString::Printf(TEXT("%s/%s"), *UGatrixClient::SdkName, *UGatrixClient::SdkVersion));
  for (const auto& Header : ClientConfig.CustomHeaders) {
    Headers.Add(Header.Key, Header.Value);
  }

  if (StreamConfig.Transport == EGatrixStreamingTransport::WebSocket) {
    // WebSocket transport
    WebSocketConnection = MakeUnique<FGatrixWebSocketConnection>();

    WebSocketConnection->OnConnected.BindLambda([this]() {
      AsyncTask(ENamedThreads::GameThread, [this]() {
        SetStreamingState(EGatrixStreamingConnectionState::Connected);
        StreamingReconnectAttempt = 0;
        if (EventEmitter) {
          EventEmitter->Emit(GatrixEvents::FlagsStreamingConnected);
        }
      });
    });

    WebSocketConnection->OnEvent.BindLambda([this](const FString& EventType,
                                                   const FString& EventData) {
      AsyncTask(ENamedThreads::GameThread,
                [this, EventType, EventData]() { ProcessStreamingEvent(EventType, EventData); });
    });

    WebSocketConnection->OnError.BindLambda([this](const FString& ErrorMsg) {
      AsyncTask(ENamedThreads::GameThread, [this, ErrorMsg]() {
        StreamingErrorCount++;
        if (EventEmitter) {
          EventEmitter->Emit(GatrixEvents::FlagsStreamingError, ErrorMsg);
        }
      });
    });

    WebSocketConnection->OnDisconnected.BindLambda([this]() {
      AsyncTask(ENamedThreads::GameThread, [this]() {
        if (bStarted && ClientConfig.Features.Streaming.bEnabled) {
          ScheduleStreamingReconnect();
        } else {
          SetStreamingState(EGatrixStreamingConnectionState::Disconnected);
          if (EventEmitter) {
            EventEmitter->Emit(GatrixEvents::FlagsStreamingDisconnected);
          }
        }
      });
    });

    WebSocketConnection->Connect(Url, Headers, StreamConfig.WebSocket.PingInterval);

  } else {
    // SSE transport (default)
    SseConnection = MakeUnique<FGatrixSseConnection>();

    SseConnection->OnConnected.BindLambda([this]() {
      AsyncTask(ENamedThreads::GameThread, [this]() {
        SetStreamingState(EGatrixStreamingConnectionState::Connected);
        StreamingReconnectAttempt = 0;
        if (EventEmitter) {
          EventEmitter->Emit(GatrixEvents::FlagsStreamingConnected);
        }
      });
    });

    SseConnection->OnEvent.BindLambda([this](const FString& EventType, const FString& EventData) {
      AsyncTask(ENamedThreads::GameThread,
                [this, EventType, EventData]() { ProcessStreamingEvent(EventType, EventData); });
    });

    SseConnection->OnError.BindLambda([this](const FString& ErrorMsg) {
      AsyncTask(ENamedThreads::GameThread, [this, ErrorMsg]() {
        StreamingErrorCount++;
        if (EventEmitter) {
          EventEmitter->Emit(GatrixEvents::FlagsStreamingError, ErrorMsg);
        }
      });
    });

    SseConnection->OnDisconnected.BindLambda([this]() {
      AsyncTask(ENamedThreads::GameThread, [this]() {
        if (bStarted && ClientConfig.Features.Streaming.bEnabled) {
          ScheduleStreamingReconnect();
        } else {
          SetStreamingState(EGatrixStreamingConnectionState::Disconnected);
          if (EventEmitter) {
            EventEmitter->Emit(GatrixEvents::FlagsStreamingDisconnected);
          }
        }
      });
    });

    SseConnection->Connect(Url, Headers);
  }

  UE_LOG(LogGatrix, Log, TEXT("Streaming: Connecting via %s to %s"),
         StreamConfig.Transport == EGatrixStreamingTransport::WebSocket ? TEXT("WebSocket")
                                                                        : TEXT("SSE"),
         *Url);
}

void UGatrixFeaturesClient::DisconnectStreaming() {
  // Cancel reconnect timer
  UWorld* World = nullptr;
  if (GEngine && GEngine->GetWorldContexts().Num() > 0) {
    World = GEngine->GetWorldContexts()[0].World();
  }
  if (World) {
    World->GetTimerManager().ClearTimer(StreamingReconnectTimerHandle);
  }

  if (SseConnection.IsValid()) {
    SseConnection->Disconnect();
    SseConnection.Reset();
  }

  if (WebSocketConnection.IsValid()) {
    WebSocketConnection->Disconnect();
    WebSocketConnection.Reset();
  }

  SetStreamingState(EGatrixStreamingConnectionState::Disconnected);
  StreamingReconnectAttempt = 0;
}

void UGatrixFeaturesClient::ProcessStreamingEvent(const FString& EventType,
                                                  const FString& EventData) {
  StreamingEventCount++;
  UE_LOG(LogGatrix, Log, TEXT("Streaming: ProcessStreamingEvent type='%s'"), *EventType);

  if (EventType == TEXT("connected")) {
    // Server acknowledged connection, extract connectionId if present
    TSharedPtr<FJsonObject> JsonObject;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(EventData);
    if (FJsonSerializer::Deserialize(Reader, JsonObject) && JsonObject.IsValid()) {
      FString ServerConnectionId;
      if (JsonObject->TryGetStringField(TEXT("connectionId"), ServerConnectionId)) {
        UE_LOG(LogGatrix, Log, TEXT("Streaming: Server connectionId=%s"), *ServerConnectionId);
      }
    }
  } else if (EventType == TEXT("flags_changed") || EventType == TEXT("invalidate")) {
    // Parse changed flag keys
    TSharedPtr<FJsonObject> JsonObject;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(EventData);
    if (FJsonSerializer::Deserialize(Reader, JsonObject) && JsonObject.IsValid()) {
      TArray<FString> ChangedKeys;

      // Only process if server revision is ahead (skip stale/duplicate events)
      int64 ServerRevision = 0;
      if (JsonObject->TryGetNumberField(TEXT("globalRevision"), ServerRevision)) {
        if (ServerRevision <= LocalGlobalRevision) {
          UE_LOG(LogGatrix, Verbose,
                 TEXT("Streaming: Ignoring stale event (local=%lld, server=%lld)"),
                 LocalGlobalRevision, ServerRevision);
          return;
        }
        LocalGlobalRevision = ServerRevision;
      }

      // Get changed keys
      const TArray<TSharedPtr<FJsonValue>>* KeysArray;
      if (JsonObject->TryGetArrayField(TEXT("changedKeys"), KeysArray)) {
        for (const auto& KeyVal : *KeysArray) {
          FString Key;
          if (KeyVal->TryGetString(Key)) {
            ChangedKeys.Add(Key);
          }
        }
      }

      // Delegate to HandleStreamingInvalidation:
      // - changedKeys present → partial fetch
      // - changedKeys absent  → full fetch (clears ETag internally)
      HandleStreamingInvalidation(ChangedKeys);
    }
  } else if (EventType == TEXT("heartbeat") || EventType == TEXT("ping")) {
    // Heartbeat received, connection is alive
    UE_LOG(LogGatrix, Verbose, TEXT("Streaming: Heartbeat received"));
  }

  if (EventEmitter) {
    EventEmitter->Emit(GatrixEvents::FlagsInvalidated, EventType);
  }
}

void UGatrixFeaturesClient::HandleStreamingInvalidation(const TArray<FString>& ChangedKeys) {
  UE_LOG(LogGatrix, Log,
         TEXT("HandleStreamingInvalidation: keys=%d, bStreamingFetching=%d, bIsFetching=%d"),
         ChangedKeys.Num(), (int)bStreamingFetching, (int)bIsFetching);

  if (ChangedKeys.Num() == 0) {
    // No specific keys: clear ETag and do full fetch
    Etag = TEXT("");
    if (!bIsFetching) {
      FetchFlags();
    } else {
      // Full fetch pending
      PendingInvalidationKeys.Add(TEXT("*"));
    }
    return;
  }

  // If already fetching, queue the keys for later
  if (bStreamingFetching) {
    for (const FString& Key : ChangedKeys) {
      PendingInvalidationKeys.Add(Key);
    }
    UE_LOG(LogGatrix, Log, TEXT("HandleStreamingInvalidation: queued (bStreamingFetching=true)"));
    return;
  }

  // Do partial fetch for affected keys
  UE_LOG(LogGatrix, Log, TEXT("HandleStreamingInvalidation: calling FetchPartialFlags"));
  FetchPartialFlags(ChangedKeys);
}

void UGatrixFeaturesClient::FetchPartialFlags(const TArray<FString>& FlagKeys) {
  if (FlagKeys.Num() == 0) {
    return;
  }

  bStreamingFetching = true;

  // Build URL with specific flag keys
  FString BaseUrl = BuildFetchUrl();

  // Add flagKeys parameter
  FString KeysParam;
  for (int32 i = 0; i < FlagKeys.Num(); ++i) {
    if (i > 0)
      KeysParam += TEXT(",");
    KeysParam += FGenericPlatformHttp::UrlEncode(FlagKeys[i]);
  }
  BaseUrl += FString::Printf(TEXT("&flagKeys=%s"), *KeysParam);

  UE_LOG(LogGatrix, Log, TEXT("FetchPartialFlags: url=%s"), *BaseUrl);

  TSharedRef<IHttpRequest, ESPMode::ThreadSafe> HttpRequest = FHttpModule::Get().CreateRequest();
  HttpRequest->SetURL(BaseUrl);
  HttpRequest->SetVerb(TEXT("GET"));
  HttpRequest->SetHeader(TEXT("Accept"), TEXT("application/json"));
  HttpRequest->SetHeader(TEXT("X-API-Token"), ClientConfig.ApiToken);
  HttpRequest->SetHeader(TEXT("X-Application-Name"), ClientConfig.AppName);
  HttpRequest->SetHeader(TEXT("X-Connection-Id"), ConnectionId);
  HttpRequest->SetHeader(
      TEXT("X-SDK-Version"),
      FString::Printf(TEXT("%s/%s"), *UGatrixClient::SdkName, *UGatrixClient::SdkVersion));

  // Intentionally skip If-None-Match: partial fetch must always return fresh data

  for (const auto& Header : ClientConfig.CustomHeaders) {
    HttpRequest->SetHeader(Header.Key, Header.Value);
  }

  // Capture requested keys for merge
  TSet<FString> RequestedKeys;
  for (const FString& Key : FlagKeys) {
    RequestedKeys.Add(Key);
  }

  HttpRequest->OnProcessRequestComplete().BindLambda(
      [this, RequestedKeys](FHttpRequestPtr Request, FHttpResponsePtr Response,
                            bool bWasSuccessful) {
        bStreamingFetching = false;

        int32 StatusCode = Response.IsValid() ? Response->GetResponseCode() : -1;
        UE_LOG(LogGatrix, Log, TEXT("FetchPartialFlags: response code=%d, bWasSuccessful=%d"),
               StatusCode, (int)bWasSuccessful);

        if (bWasSuccessful && Response.IsValid() && StatusCode == 200) {
          FString Body = Response->GetContentAsString();
          // Update flags via normal path (StoreFlags handles Version-based change detection)
          HandleFetchResponse(Body, 200, TEXT(""));
        } else {
          // On failure, fall back to full fetch with cleared ETag
          UE_LOG(LogGatrix, Warning,
                 TEXT("Partial fetch failed (code=%d), falling back to full fetch"), StatusCode);
          Etag = TEXT("");
          FetchFlags();
        }

        // Process accumulated pending invalidation keys
        if (PendingInvalidationKeys.Num() > 0) {
          TArray<FString> PendingKeys = PendingInvalidationKeys.Array();
          PendingInvalidationKeys.Empty();
          FetchPartialFlags(PendingKeys);
        }
      });

  HttpRequest->ProcessRequest();
}

void UGatrixFeaturesClient::MergePartialResponse(const FString& ResponseBody,
                                                 const TSet<FString>& RequestedKeys) {
  UE_LOG(LogGatrix, Log, TEXT("MergePartialResponse: called, body length=%d"), ResponseBody.Len());

  // Parse response JSON (same structure as full fetch)
  TSharedPtr<FJsonObject> JsonObject;
  TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(ResponseBody);
  if (!FJsonSerializer::Deserialize(Reader, JsonObject) || !JsonObject.IsValid()) {
    UE_LOG(LogGatrix, Warning, TEXT("MergePartialResponse: JSON parse failed, falling back"));
    Etag = TEXT("");
    FetchFlags();
    return;
  }

  bool bSuccess = false;
  JsonObject->TryGetBoolField(TEXT("success"), bSuccess);
  if (!bSuccess) {
    UE_LOG(LogGatrix, Warning, TEXT("MergePartialResponse: success=false, falling back"));
    Etag = TEXT("");
    FetchFlags();
    return;
  }

  const TSharedPtr<FJsonObject>* DataObj = nullptr;
  if (!JsonObject->TryGetObjectField(TEXT("data"), DataObj)) {
    return;
  }

  const TArray<TSharedPtr<FJsonValue>>* FlagsArray = nullptr;
  if (!(*DataObj)->TryGetArrayField(TEXT("flags"), FlagsArray)) {
    return;
  }

  // Parse the partial flags using the same inline logic as HandleFetchResponse
  TArray<FGatrixEvaluatedFlag> PartialFlags;
  for (const auto& FlagValue : *FlagsArray) {
    const TSharedPtr<FJsonObject>* FlagObj = nullptr;
    if (!FlagValue->TryGetObject(FlagObj))
      continue;

    FGatrixEvaluatedFlag Flag;
    (*FlagObj)->TryGetStringField(TEXT("name"), Flag.Name);
    (*FlagObj)->TryGetBoolField(TEXT("enabled"), Flag.bEnabled);
    (*FlagObj)->TryGetNumberField(TEXT("version"), Flag.Version);
    (*FlagObj)->TryGetStringField(TEXT("reason"), Flag.Reason);
    (*FlagObj)->TryGetBoolField(TEXT("impressionData"), Flag.bImpressionData);

    FString TypeStr;
    if ((*FlagObj)->TryGetStringField(TEXT("valueType"), TypeStr)) {
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
    }

    const TSharedPtr<FJsonObject>* VariantObj = nullptr;
    if ((*FlagObj)->TryGetObjectField(TEXT("variant"), VariantObj)) {
      (*VariantObj)->TryGetStringField(TEXT("name"), Flag.Variant.Name);
      (*VariantObj)->TryGetBoolField(TEXT("enabled"), Flag.Variant.bEnabled);

      const TSharedPtr<FJsonValue> PayloadValue = (*VariantObj)->TryGetField(TEXT("value"));
      if (PayloadValue.IsValid()) {
        switch (Flag.ValueType) {
        case EGatrixValueType::String:
          if (PayloadValue->Type == EJson::String) {
            PayloadValue->TryGetString(Flag.Variant.Value);
          } else if (PayloadValue->Type == EJson::Number) {
            double N = 0;
            PayloadValue->TryGetNumber(N);
            Flag.Variant.Value = FMath::IsNearlyEqual(N, FMath::RoundToDouble(N))
                                     ? FString::Printf(TEXT("%lld"), static_cast<int64>(N))
                                     : FString::SanitizeFloat(N);
          } else if (PayloadValue->Type == EJson::Boolean) {
            bool B = false;
            PayloadValue->TryGetBool(B);
            Flag.Variant.Value = B ? TEXT("true") : TEXT("false");
          } else {
            Flag.Variant.Value = PayloadValue->AsString();
          }
          break;
        case EGatrixValueType::Number: {
          double N = 0;
          if (PayloadValue->Type == EJson::Number)
            PayloadValue->TryGetNumber(N);
          else if (PayloadValue->Type == EJson::String) {
            FString S;
            PayloadValue->TryGetString(S);
            N = FCString::Atod(*S);
          }
          Flag.Variant.Value = FString::SanitizeFloat(N);
          break;
        }
        case EGatrixValueType::Boolean: {
          bool B = false;
          if (PayloadValue->Type == EJson::Boolean)
            PayloadValue->TryGetBool(B);
          else if (PayloadValue->Type == EJson::String) {
            FString S;
            PayloadValue->TryGetString(S);
            B = S.Equals(TEXT("true"), ESearchCase::IgnoreCase);
          }
          Flag.Variant.Value = B ? TEXT("true") : TEXT("false");
          break;
        }
        case EGatrixValueType::Json: {
          FString JsonStr;
          TSharedRef<TJsonWriter<>> W = TJsonWriterFactory<>::Create(&JsonStr);
          if (FJsonSerializer::Serialize(PayloadValue.ToSharedRef(), TEXT(""), W)) {
            W->Close();
            Flag.Variant.Value = JsonStr;
          } else {
            Flag.Variant.Value = PayloadValue->AsString();
          }
          break;
        }
        default:
          break;
        }
      }
    }
    PartialFlags.Add(MoveTemp(Flag));
  }

  UE_LOG(LogGatrix, Log, TEXT("MergePartialResponse: parsed %d flags"), PartialFlags.Num());
  for (const auto& F : PartialFlags) {
    UE_LOG(LogGatrix, Log, TEXT("  -> flag='%s' enabled=%d variantValue='%s'"), *F.Name,
           (int)F.bEnabled, *F.Variant.Value);
  }

  // Merge into existing cache (update/add returned; remove requested-but-absent)
  TMap<FString, FGatrixEvaluatedFlag> OldFlags;
  {
    FScopeLock Lock(&FlagsCriticalSection);
    OldFlags = RealtimeFlags;

    for (const auto& Flag : PartialFlags) {
      RealtimeFlags.Add(Flag.Name, Flag);
    }

    TSet<FString> ReturnedNames;
    for (const auto& Flag : PartialFlags)
      ReturnedNames.Add(Flag.Name);
    for (const FString& Key : RequestedKeys) {
      if (!ReturnedNames.Contains(Key))
        RealtimeFlags.Remove(Key);
    }

    if (!ClientConfig.Features.bExplicitSyncMode) {
      SynchronizedFlags = RealtimeFlags;
    }
  }

  // Emit watch callbacks for changed flags using RealtimeFlags directly
  TMap<FString, FGatrixEvaluatedFlag> NewRealtime = RealtimeFlags;

  EmitFlagChanges(OldFlags, NewRealtime);
  InvokeWatchCallbacks(WatchCallbacks, OldFlags, NewRealtime, /*bForceRealtime=*/true);

  if (!ClientConfig.Features.bExplicitSyncMode) {
    InvokeWatchCallbacks(SyncedWatchCallbacks, OldFlags, NewRealtime, /*bForceRealtime=*/false);
    if (EventEmitter)
      EventEmitter->Emit(GatrixEvents::FlagsChange);
    OnChange.Broadcast();
  }
}

void UGatrixFeaturesClient::ScheduleStreamingReconnect() {
  if (!bStarted || !ClientConfig.Features.Streaming.bEnabled) {
    return;
  }

  SetStreamingState(EGatrixStreamingConnectionState::Reconnecting);
  StreamingReconnectCount++;

  if (EventEmitter) {
    EventEmitter->Emit(GatrixEvents::FlagsStreamingReconnecting);
  }

  // Exponential backoff with jitter
  const FGatrixStreamingConfig& StreamConfig = ClientConfig.Features.Streaming;
  int32 ReconnectBase, ReconnectMax;
  if (StreamConfig.Transport == EGatrixStreamingTransport::WebSocket) {
    ReconnectBase = StreamConfig.WebSocket.ReconnectBase;
    ReconnectMax = StreamConfig.WebSocket.ReconnectMax;
  } else {
    ReconnectBase = StreamConfig.Sse.ReconnectBase;
    ReconnectMax = StreamConfig.Sse.ReconnectMax;
  }

  float Delay = FMath::Min(static_cast<float>(ReconnectBase) *
                               FMath::Pow(2.0f, static_cast<float>(StreamingReconnectAttempt)),
                           static_cast<float>(ReconnectMax));
  // Add jitter (+/-25%)
  const float JitterRange = Delay * 0.25f;
  Delay += FMath::FRandRange(-JitterRange, JitterRange);
  Delay = FMath::Max(Delay, 0.5f);

  StreamingReconnectAttempt++;

  UE_LOG(LogGatrix, Log, TEXT("Streaming: Scheduling reconnect in %.1fs (attempt %d)"), Delay,
         StreamingReconnectAttempt);

  UWorld* World = nullptr;
  if (GEngine && GEngine->GetWorldContexts().Num() > 0) {
    World = GEngine->GetWorldContexts()[0].World();
  }

  if (World) {
    World->GetTimerManager().SetTimer(StreamingReconnectTimerHandle,
                                      FTimerDelegate::CreateWeakLambda(this,
                                                                       [this]() {
                                                                         if (bStarted) {
                                                                           ConnectStreaming();
                                                                         }
                                                                       }),
                                      Delay, false);
  }
}

void UGatrixFeaturesClient::SetStreamingState(EGatrixStreamingConnectionState NewState) {
  if (StreamingState != NewState) {
    StreamingState = NewState;

    if (ClientConfig.bEnableDevMode) {
      static const TCHAR* StateNames[] = {TEXT("Disconnected"), TEXT("Connecting"),
                                          TEXT("Connected"), TEXT("Reconnecting"),
                                          TEXT("Degraded")};
      UE_LOG(LogGatrix, Log, TEXT("[DEV] Streaming state: %s"),
             StateNames[static_cast<int32>(NewState)]);
    }

    // Manage polling based on streaming state:
    // - Connected: streaming delivers real-time updates, stop polling to avoid race conditions
    // - Disconnected/Degraded: fall back to polling as the only update mechanism
    if (NewState == EGatrixStreamingConnectionState::Connected) {
      bPollingStopped = true;
      StopPolling();
      UE_LOG(LogGatrix, Log, TEXT("Polling stopped: streaming connected"));
    } else if (NewState == EGatrixStreamingConnectionState::Disconnected ||
               NewState == EGatrixStreamingConnectionState::Degraded) {
      bPollingStopped = false;
      ScheduleNextPoll();
      UE_LOG(LogGatrix, Log, TEXT("Polling resumed: streaming %s"),
             NewState == EGatrixStreamingConnectionState::Degraded ? TEXT("degraded")
                                                                   : TEXT("disconnected"));
    }
  }
}

FString UGatrixFeaturesClient::BuildStreamingUrl() const {
  const FGatrixStreamingConfig& StreamConfig = ClientConfig.Features.Streaming;

  FString BaseUrl;
  if (StreamConfig.Transport == EGatrixStreamingTransport::WebSocket) {
    BaseUrl = StreamConfig.WebSocket.Url;
  } else {
    BaseUrl = StreamConfig.Sse.Url;
  }

  // If no custom URL, derive from ApiUrl
  // URL pattern: {apiUrl}/client/features/{environment}/stream/sse|ws
  if (BaseUrl.IsEmpty()) {
    FString EncodedEnv = FGenericPlatformHttp::UrlEncode(ClientConfig.Environment);
    if (StreamConfig.Transport == EGatrixStreamingTransport::WebSocket) {
      BaseUrl = FString::Printf(TEXT("%s/client/features/%s/stream/ws"), *ClientConfig.ApiUrl,
                                *EncodedEnv);
      // Convert http(s) to ws(s)
      BaseUrl = BaseUrl.Replace(TEXT("https://"), TEXT("wss://"));
      BaseUrl = BaseUrl.Replace(TEXT("http://"), TEXT("ws://"));
    } else {
      BaseUrl = FString::Printf(TEXT("%s/client/features/%s/stream/sse"), *ClientConfig.ApiUrl,
                                *EncodedEnv);
    }
  }

  // Add query parameters
  FString QueryString = FString::Printf(TEXT("?appName=%s&environment=%s"),
                                        *FGenericPlatformHttp::UrlEncode(ClientConfig.AppName),
                                        *FGenericPlatformHttp::UrlEncode(ClientConfig.Environment));

  if (LocalGlobalRevision > 0) {
    QueryString += FString::Printf(TEXT("&globalRevision=%lld"), LocalGlobalRevision);
  }

  return BaseUrl + QueryString;
}
