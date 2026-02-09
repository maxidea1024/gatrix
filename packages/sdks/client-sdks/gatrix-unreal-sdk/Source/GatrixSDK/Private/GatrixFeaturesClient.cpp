// Copyright Gatrix. All Rights Reserved.
// FeaturesClient implementation - HTTP fetching, polling, caching, metrics,
// thread safety

#include "GatrixFeaturesClient.h"
#include "GatrixClient.h"
#include "GatrixEvents.h"


#include "Async/Async.h"
#include "Dom/JsonObject.h"
#include "Engine/Engine.h"
#include "Engine/World.h"
#include "HttpModule.h"
#include "GenericPlatform/GenericPlatformHttp.h"
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
  bStarted = false;
  StopPolling();
  StopMetrics();
}

// ==================== Flag Access (Thread-Safe) ====================

TMap<FString, FGatrixEvaluatedFlag> UGatrixFeaturesClient::SelectFlags() const {
  FScopeLock Lock(&FlagsCriticalSection);
  if (ClientConfig.Features.bExplicitSyncMode) {
    return SynchronizedFlags;
  }
  return RealtimeFlags;
}

bool UGatrixFeaturesClient::IsEnabled(const FString &FlagName) const {
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags();
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  if (!Found) {
    // Track missing flag
    FScopeLock Lock(&MetricsCriticalSection);
    const_cast<TArray<FString> &>(MissingFlagNames).AddUnique(FlagName);
    return false;
  }

  // Track impression if needed
  if (Found->bImpressionData || ClientConfig.Features.bImpressionDataAll) {
    const_cast<UGatrixFeaturesClient *>(this)->TrackImpression(
        FlagName, Found->bEnabled, Found->Variant.Name);
  }

  return Found->bEnabled;
}

FGatrixVariant
UGatrixFeaturesClient::GetVariant(const FString &FlagName) const {
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags();
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  if (!Found) {
    return FGatrixVariant::Disabled();
  }
  return Found->Variant;
}

UGatrixFlagProxy *UGatrixFeaturesClient::GetFlag(const FString &FlagName) {
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags();
  UGatrixFlagProxy *Proxy = NewObject<UGatrixFlagProxy>(this);

  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  if (Found) {
    Proxy->Initialize(*Found);
  } else {
    // Return proxy with empty data (bExists will be false)
    FGatrixEvaluatedFlag EmptyFlag;
    EmptyFlag.Name = FlagName;
    Proxy->Initialize(EmptyFlag);
  }

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
                                          bool DefaultValue) const {
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags();
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  if (!Found)
    return DefaultValue;
  return Found->bEnabled;
}

FString
UGatrixFeaturesClient::StringVariation(const FString &FlagName,
                                       const FString &DefaultValue) const {
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags();
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  if (!Found || !Found->bEnabled)
    return DefaultValue;
  if (Found->VariantType != EGatrixVariantType::String)
    return DefaultValue;
  if (Found->Variant.Payload.IsEmpty())
    return DefaultValue;
  return Found->Variant.Payload;
}

float UGatrixFeaturesClient::NumberVariation(const FString &FlagName,
                                             float DefaultValue) const {
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags();
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  if (!Found || !Found->bEnabled)
    return DefaultValue;
  if (Found->VariantType != EGatrixVariantType::Number)
    return DefaultValue;
  if (Found->Variant.Payload.IsEmpty())
    return DefaultValue;
  return FCString::Atof(*Found->Variant.Payload);
}

FString
UGatrixFeaturesClient::JsonVariation(const FString &FlagName,
                                     const FString &DefaultValue) const {
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags();
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  if (!Found || !Found->bEnabled)
    return DefaultValue;
  if (Found->VariantType != EGatrixVariantType::Json)
    return DefaultValue;
  if (Found->Variant.Payload.IsEmpty())
    return DefaultValue;
  return Found->Variant.Payload;
}

// ==================== Variation Details ====================

FGatrixVariationResult
UGatrixFeaturesClient::BoolVariationDetails(const FString &FlagName,
                                            bool DefaultValue) const {
  FGatrixVariationResult Result;
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags();
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  Result.bFlagExists = Found != nullptr;
  Result.bEnabled = Found ? Found->bEnabled : false;
  Result.Value =
      (Found ? Found->bEnabled : DefaultValue) ? TEXT("true") : TEXT("false");
  Result.Reason = Found ? Found->Reason : TEXT("flag_not_found");
  return Result;
}

FGatrixVariationResult UGatrixFeaturesClient::StringVariationDetails(
    const FString &FlagName, const FString &DefaultValue) const {
  FGatrixVariationResult Result;
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags();
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  Result.bFlagExists = Found != nullptr;
  Result.bEnabled = Found ? Found->bEnabled : false;
  Result.Value = StringVariation(FlagName, DefaultValue);
  Result.Reason = Found ? Found->Reason : TEXT("flag_not_found");
  return Result;
}

FGatrixVariationResult
UGatrixFeaturesClient::NumberVariationDetails(const FString &FlagName,
                                              float DefaultValue) const {
  FGatrixVariationResult Result;
  TMap<FString, FGatrixEvaluatedFlag> Flags = SelectFlags();
  const FGatrixEvaluatedFlag *Found = Flags.Find(FlagName);
  Result.bFlagExists = Found != nullptr;
  Result.bEnabled = Found ? Found->bEnabled : false;
  Result.Value =
      FString::SanitizeFloat(NumberVariation(FlagName, DefaultValue));
  Result.Reason = Found ? Found->Reason : TEXT("flag_not_found");
  return Result;
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
    // After fetch completes, apply to synchronized flags
    FetchFlags();
  }

  {
    FScopeLock Lock(&FlagsCriticalSection);
    TMap<FString, FGatrixEvaluatedFlag> OldFlags = SynchronizedFlags;
    SynchronizedFlags = RealtimeFlags;
    EmitFlagChanges(OldFlags, SynchronizedFlags);
  }

  {
    FScopeLock Lock(&StatsCriticalSection);
    SyncFlagsCount++;
  }

  bHasPendingSync = false;
  if (EventEmitter) {
    EventEmitter->Emit(GatrixEvents::FlagsSync);
  }
  OnSync.Broadcast();
}

bool UGatrixFeaturesClient::CanSyncFlags() const { return bHasPendingSync; }

// ==================== Fetch ====================

void UGatrixFeaturesClient::FetchFlags() {
  if (bIsFetching || !bStarted)
    return;

  bIsFetching = true;
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
  HttpRequest->SetHeader(
      TEXT("Authorization"),
      FString::Printf(TEXT("Bearer %s"), *ClientConfig.ApiToken));
  HttpRequest->SetHeader(TEXT("X-Gatrix-SDK"), UGatrixClient::SdkName);
  HttpRequest->SetHeader(TEXT("X-Gatrix-SDK-Version"),
                         UGatrixClient::SdkVersion);

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

        ScheduleNextPoll();
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
      UE_LOG(LogTemp, Error,
             TEXT("[GatrixSDK] Failed to parse flags response JSON"));
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
      UE_LOG(LogTemp, Warning,
             TEXT("[GatrixSDK] Flags response success=false"));
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
      (*FlagObj)->TryGetStringField(TEXT("variantType"), TypeStr);
      if (TypeStr == TEXT("string"))
        Flag.VariantType = EGatrixVariantType::String;
      else if (TypeStr == TEXT("number"))
        Flag.VariantType = EGatrixVariantType::Number;
      else if (TypeStr == TEXT("json"))
        Flag.VariantType = EGatrixVariantType::Json;
      else
        Flag.VariantType = EGatrixVariantType::None;

      // Parse variant
      const TSharedPtr<FJsonObject> *VariantObj = nullptr;
      if ((*FlagObj)->TryGetObjectField(TEXT("variant"), VariantObj)) {
        (*VariantObj)->TryGetStringField(TEXT("name"), Flag.Variant.Name);
        (*VariantObj)->TryGetBoolField(TEXT("enabled"), Flag.Variant.bEnabled);

        // Payload: can be string, number, or object
        const TSharedPtr<FJsonValue> PayloadValue =
            (*VariantObj)->TryGetField(TEXT("payload"));
        if (PayloadValue.IsValid()) {
          switch (PayloadValue->Type) {
          case EJson::String:
            PayloadValue->TryGetString(Flag.Variant.Payload);
            break;
          case EJson::Number: {
            double NumVal = 0;
            PayloadValue->TryGetNumber(NumVal);
            Flag.Variant.Payload = FString::SanitizeFloat(NumVal);
            break;
          }
          case EJson::Object:
          case EJson::Array: {
            // Serialize back to JSON string
            FString JsonStr;
            TSharedRef<TJsonWriter<>> Writer =
                TJsonWriterFactory<>::Create(&JsonStr);
            FJsonSerializer::Serialize(PayloadValue, TEXT(""), Writer);
            Flag.Variant.Payload = JsonStr;
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
      bHasPendingSync = true;
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
      switch (Flag.VariantType) {
      case EGatrixVariantType::String:
        TypeStr = TEXT("string");
        break;
      case EGatrixVariantType::Number:
        TypeStr = TEXT("number");
        break;
      case EGatrixVariantType::Json:
        TypeStr = TEXT("json");
        break;
      default:
        TypeStr = TEXT("none");
        break;
      }
      Writer->WriteValue(TEXT("variantType"), TypeStr);

      Writer->WriteObjectStart(TEXT("variant"));
      Writer->WriteValue(TEXT("name"), Flag.Variant.Name);
      Writer->WriteValue(TEXT("enabled"), Flag.Variant.bEnabled);
      Writer->WriteValue(TEXT("payload"), Flag.Variant.Payload);
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

    if (!ClientConfig.Features.bExplicitSyncMode) {
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
    (*FlagObj)->TryGetStringField(TEXT("variantType"), TypeStr);
    if (TypeStr == TEXT("string"))
      Flag.VariantType = EGatrixVariantType::String;
    else if (TypeStr == TEXT("number"))
      Flag.VariantType = EGatrixVariantType::Number;
    else if (TypeStr == TEXT("json"))
      Flag.VariantType = EGatrixVariantType::Json;

    const TSharedPtr<FJsonObject> *VariantObj = nullptr;
    if ((*FlagObj)->TryGetObjectField(TEXT("variant"), VariantObj)) {
      (*VariantObj)->TryGetStringField(TEXT("name"), Flag.Variant.Name);
      (*VariantObj)->TryGetBoolField(TEXT("enabled"), Flag.Variant.bEnabled);
      (*VariantObj)->TryGetStringField(TEXT("payload"), Flag.Variant.Payload);
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

  UE_LOG(LogTemp, Log, TEXT("[GatrixSDK] Features ready. %d flags loaded."),
         RealtimeFlags.Num());
}

// ==================== Flag Change Emission ====================

void UGatrixFeaturesClient::EmitFlagChanges(
    const TMap<FString, FGatrixEvaluatedFlag> &OldFlags,
    const TMap<FString, FGatrixEvaluatedFlag> &NewFlags) {
  if (!EventEmitter)
    return;

  // Detect changed flags
  for (const auto &Pair : NewFlags) {
    const FGatrixEvaluatedFlag *OldFlag = OldFlags.Find(Pair.Key);
    if (!OldFlag || OldFlag->bEnabled != Pair.Value.bEnabled ||
        OldFlag->Variant.Name != Pair.Value.Variant.Name ||
        OldFlag->Variant.Payload != Pair.Value.Variant.Payload) {
      // Flag changed
      EventEmitter->Emit(GatrixEvents::FlagChange(Pair.Key),
                         Pair.Value.Variant.Name);
    }
  }

  // Detect removed flags
  for (const auto &Pair : OldFlags) {
    if (!NewFlags.Contains(Pair.Key)) {
      EventEmitter->Emit(GatrixEvents::FlagChange(Pair.Key), TEXT("removed"));
    }
  }
}

// ==================== Impressions ====================

void UGatrixFeaturesClient::TrackImpression(const FString &FlagName,
                                            bool bEnabled,
                                            const FString &VariantName) {
  FGatrixImpressionEvent Event;
  Event.EventType = TEXT("isEnabled");
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

// ==================== Watch ====================

int32 UGatrixFeaturesClient::WatchFlag(const FString &FlagName,
                                       FGatrixFlagWatchDelegate Callback,
                                       const FString &Name) {
  FString EventName = GatrixEvents::FlagChange(FlagName);

  // Capture FlagName and Callback for the event handler
  return EventEmitter->On(
      EventName,
      [this, FlagName, Callback](const TArray<FString> &Args) {
        UGatrixFlagProxy *Proxy = GetFlag(FlagName);
        Callback.ExecuteIfBound(Proxy);
      },
      Name);
}

void UGatrixFeaturesClient::UnwatchFlag(int32 Handle) {
  if (EventEmitter) {
    EventEmitter->Off(Handle);
  }
}

// ==================== Polling ====================

void UGatrixFeaturesClient::ScheduleNextPoll() {
  if (!bStarted || ClientConfig.Features.bDisableRefresh ||
      ClientConfig.bOfflineMode) {
    return;
  }

  float Interval = ClientConfig.Features.RefreshInterval;
  if (Interval <= 0.0f)
    Interval = 30.0f;

  // Use engine world timer if available, otherwise use FTSTicker
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

  TSharedRef<IHttpRequest, ESPMode::ThreadSafe> HttpRequest =
      FHttpModule::Get().CreateRequest();
  HttpRequest->SetURL(MetricsUrl);
  HttpRequest->SetVerb(TEXT("POST"));
  HttpRequest->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
  HttpRequest->SetHeader(
      TEXT("Authorization"),
      FString::Printf(TEXT("Bearer %s"), *ClientConfig.ApiToken));
  HttpRequest->SetContentAsString(PayloadJson);

  HttpRequest->OnProcessRequestComplete().BindLambda(
      [this](FHttpRequestPtr Request, FHttpResponsePtr Response,
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
  TMap<FString, int32> FlagAccessCopy;
  TArray<FString> MissingCopy;

  {
    FScopeLock Lock(&MetricsCriticalSection);
    FlagAccessCopy = MetricsFlagAccess;
    MissingCopy = MissingFlagNames;

    // Clear after reading
    const_cast<TMap<FString, int32> &>(MetricsFlagAccess).Empty();
    const_cast<TArray<FString> &>(MissingFlagNames).Empty();
  }

  if (FlagAccessCopy.Num() == 0 && MissingCopy.Num() == 0) {
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

  // Flag access counts
  Writer->WriteObjectStart(TEXT("flags"));
  for (const auto &Pair : FlagAccessCopy) {
    Writer->WriteObjectStart(Pair.Key);
    Writer->WriteValue(TEXT("yes"), Pair.Value);
    Writer->WriteObjectEnd();
  }
  Writer->WriteObjectEnd();

  Writer->WriteObjectEnd(); // bucket
  Writer->WriteObjectEnd();
  Writer->Close();
}

// ==================== URL Building ====================

FString UGatrixFeaturesClient::BuildFetchUrl() const {
  FString BaseUrl =
      FString::Printf(TEXT("%s/client/features"), *ClientConfig.ApiUrl);

  if (!ClientConfig.Features.bUsePOSTRequests) {
    FString QueryString = BuildContextQueryString();
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
  if (!ClientConfig.Context.DeviceId.IsEmpty())
    Params.Add(FString::Printf(
        TEXT("deviceId=%s"),
        *FGenericPlatformHttp::UrlEncode(ClientConfig.Context.DeviceId)));

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
  if (!ClientConfig.Context.DeviceId.IsEmpty())
    Writer->WriteValue(TEXT("deviceId"), ClientConfig.Context.DeviceId);

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
