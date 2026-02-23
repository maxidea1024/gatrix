// Copyright Gatrix. All Rights Reserved.

#include "GatrixClient.h"
#include "GatrixEvents.h"
#include "GatrixFileStorageProvider.h"
#include "GatrixClientSDKModule.h"
#include "GatrixVersion.h"
#include "Misc/Guid.h"

const FString UGatrixClient::SdkVersion = GATRIX_SDK_VERSION;
const FString UGatrixClient::SdkName = GATRIX_SDK_NAME;

UGatrixClient* UGatrixClient::Singleton = nullptr;

UGatrixClient* UGatrixClient::Get() {
  if (!Singleton) {
    Singleton = NewObject<UGatrixClient>();
    Singleton->AddToRoot(); // Prevent GC
  }
  return Singleton;
}

bool UGatrixClient::InitInternal(const FGatrixClientConfig& InConfig) {
  // Validate required fields
  if (InConfig.ApiUrl.IsEmpty()) {
    UE_LOG(LogGatrix, Error, TEXT("Config validation failed: apiUrl is required"));
    return false;
  }
  if (InConfig.ApiToken.IsEmpty()) {
    UE_LOG(LogGatrix, Error, TEXT("Config validation failed: apiToken is required"));
    return false;
  }
  if (InConfig.AppName.IsEmpty()) {
    UE_LOG(LogGatrix, Error, TEXT("Config validation failed: appName is required"));
    return false;
  }
  if (InConfig.Environment.IsEmpty()) {
    UE_LOG(LogGatrix, Error, TEXT("Config validation failed: environment is required"));
    return false;
  }

  // Validate URL format
  if (!InConfig.ApiUrl.StartsWith(TEXT("http://")) &&
      !InConfig.ApiUrl.StartsWith(TEXT("https://"))) {
    UE_LOG(LogGatrix, Error,
           TEXT("Config validation failed: apiUrl must start with http:// or "
                "https://. Got: %s"),
           *InConfig.ApiUrl);
    return false;
  }

  // Validate numeric ranges
  const auto& Feat = InConfig.Features;
  if (Feat.RefreshInterval < 1.0f || Feat.RefreshInterval > 86400.0f) {
    UE_LOG(LogGatrix, Error,
           TEXT("Config validation failed: RefreshInterval must be between 1 "
                "and 86400, got %f"),
           Feat.RefreshInterval);
    return false;
  }
  if (Feat.MetricsInterval < 1.0f || Feat.MetricsInterval > 86400.0f) {
    UE_LOG(LogGatrix, Error,
           TEXT("Config validation failed: MetricsInterval must be between 1 "
                "and 86400, got %f"),
           Feat.MetricsInterval);
    return false;
  }
  if (Feat.MetricsIntervalInitial < 0.0f || Feat.MetricsIntervalInitial > 3600.0f) {
    UE_LOG(LogGatrix, Error,
           TEXT("Config validation failed: MetricsIntervalInitial must be "
                "between 0 and 3600, got %f"),
           Feat.MetricsIntervalInitial);
    return false;
  }

  // Validate fetch retry options
  const auto& Retry = Feat.FetchRetryOptions;
  if (Retry.Limit < 0 || Retry.Limit > 10) {
    UE_LOG(LogGatrix, Error,
           TEXT("Config validation failed: FetchRetryOptions.Limit must be "
                "between 0 and 10, got %d"),
           Retry.Limit);
    return false;
  }
  if (Retry.Timeout < 1.0f || Retry.Timeout > 120.0f) {
    UE_LOG(LogGatrix, Error,
           TEXT("Config validation failed: FetchRetryOptions.Timeout must be "
                "between 1 and 120 seconds, got %f"),
           Retry.Timeout);
    return false;
  }
  if (Retry.InitialBackoff < 0.1f || Retry.InitialBackoff > 60.0f) {
    UE_LOG(LogGatrix, Error,
           TEXT("Config validation failed: InitialBackoff must be between "
                "0.1 and 60 seconds, got %f"),
           Retry.InitialBackoff);
    return false;
  }
  if (Retry.MaxBackoff < 1.0f || Retry.MaxBackoff > 600.0f) {
    UE_LOG(LogGatrix, Error,
           TEXT("Config validation failed: MaxBackoff must be between 1 "
                "and 600 seconds, got %f"),
           Retry.MaxBackoff);
    return false;
  }
  if (Retry.InitialBackoff > Retry.MaxBackoff) {
    UE_LOG(LogGatrix, Error,
           TEXT("Config validation failed: InitialBackoff (%f) must be <= "
                "MaxBackoff (%f)"),
           Retry.InitialBackoff, Retry.MaxBackoff);
    return false;
  }

  StoredConfig = InConfig;
  ClientConnectionId = FGuid::NewGuid().ToString(EGuidFormats::DigitsWithHyphens).ToLower();

  // Create file-based storage provider (persists flags across sessions)
  StorageProvider =
      MakeShareable(new FGatrixFileStorageProvider(StoredConfig.Features.CacheKeyPrefix));

  // Create features client
  FeaturesClient = NewObject<UGatrixFeaturesClient>(this);
  FeaturesClient->Initialize(StoredConfig, &EventEmitter, StorageProvider, ClientConnectionId);

  bInitialized = true;

  UE_LOG(LogGatrix, Log, TEXT("Initialized. App=%s Env=%s ConnectionId=%s"), *StoredConfig.AppName,
         *StoredConfig.Environment, *ClientConnectionId);
  return true;
}

void UGatrixClient::Start(const FGatrixClientConfig& InConfig) {
  if (bStarted) {
    UE_LOG(LogGatrix, Warning, TEXT("Already started."));
    return;
  }

  if (!InitInternal(InConfig)) {
    return;
  }

  bStarted = true;
  FeaturesClient->Start();

  UE_LOG(LogGatrix, Log, TEXT("Started."));
}

void UGatrixClient::Start(const FGatrixClientConfig& InConfig,
                          TFunction<void(bool, const FString&)> OnComplete) {
  if (bStarted) {
    if (OnComplete)
      OnComplete(true, TEXT(""));
    return;
  }

  if (!InitInternal(InConfig)) {
    if (OnComplete)
      OnComplete(false, TEXT("Config validation failed"));
    return;
  }

  bStarted = true;
  FeaturesClient->Start(MoveTemp(OnComplete));
  UE_LOG(LogGatrix, Log, TEXT("Started."));
}

void UGatrixClient::Stop() {
  if (!bInitialized)
    return;

  bStarted = false;
  bInitialized = false;

  if (FeaturesClient) {
    FeaturesClient->Stop();
    FeaturesClient = nullptr;
  }

  EventEmitter.RemoveAll();

  UE_LOG(LogGatrix, Log, TEXT("Stopped."));
}

bool UGatrixClient::IsReady() const {
  return FeaturesClient ? FeaturesClient->IsReady() : false;
}

int32 UGatrixClient::On(const FString& EventName, TFunction<void(const TArray<FString>&)> Callback,
                        const FString& Name) {
  return EventEmitter.On(EventName, MoveTemp(Callback), Name);
}

int32 UGatrixClient::Once(const FString& EventName,
                          TFunction<void(const TArray<FString>&)> Callback, const FString& Name) {
  return EventEmitter.Once(EventName, MoveTemp(Callback), Name);
}

void UGatrixClient::Off(int32 Handle) {
  EventEmitter.Off(Handle);
}

void UGatrixClient::Off(const FString& EventName) {
  EventEmitter.OffAll(EventName);
}

int32 UGatrixClient::OnAny(TFunction<void(const FString&, const TArray<FString>&)> Callback,
                           const FString& Name) {
  return EventEmitter.OnAny(MoveTemp(Callback), Name);
}

void UGatrixClient::OffAny(int32 Handle) {
  EventEmitter.OffAny(Handle);
}

void UGatrixClient::Track(const FString& EventName, const TMap<FString, FString>& Properties) {
  // Not yet implemented — reserved for the upcoming Gatrix Analytics service.
  if (StoredConfig.bEnableDevMode) {
    UE_LOG(LogGatrix, Log,
           TEXT("[Gatrix] Track() called: eventName=\"%s\", properties=%d entries "
                "— tracking is not yet supported but will be available soon."),
           *EventName, Properties.Num());
  }
}

void UGatrixClient::Track(const FString& EventName) {
  Track(EventName, TMap<FString, FString>());
}

FGatrixSdkStats UGatrixClient::GetStats() const {
  FGatrixSdkStats Stats;
  Stats.ConnectionId = ClientConnectionId;
  Stats.bOfflineMode = StoredConfig.Features.bOfflineMode;

  if (FeaturesClient) {
    Stats.Features = FeaturesClient->GetStats();
    Stats.SdkState = Stats.Features.TotalFlagCount > 0 ? EGatrixSdkState::Healthy
                                                       : EGatrixSdkState::Initializing;
  }

  return Stats;
}

FGatrixOnReady& UGatrixClient::GetOnReady() {
  return FeaturesClient->OnReady;
}

FGatrixOnChange& UGatrixClient::GetOnChange() {
  return FeaturesClient->OnChange;
}

FGatrixOnError& UGatrixClient::GetOnError() {
  return FeaturesClient->OnError;
}
