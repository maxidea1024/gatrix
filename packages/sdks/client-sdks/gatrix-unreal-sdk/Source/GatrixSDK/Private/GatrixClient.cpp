// Copyright Gatrix. All Rights Reserved.

#include "GatrixClient.h"
#include "GatrixEvents.h"
#include "GatrixFileStorageProvider.h"
#include "GatrixSDKModule.h"
#include "GatrixVersion.h"
#include "Misc/Guid.h"

const FString UGatrixClient::SdkVersion = GATRIX_SDK_VERSION;
const FString UGatrixClient::SdkName = GATRIX_SDK_NAME;

UGatrixClient *UGatrixClient::Singleton = nullptr;

UGatrixClient *UGatrixClient::Get() {
  if (!Singleton) {
    Singleton = NewObject<UGatrixClient>();
    Singleton->AddToRoot(); // Prevent GC
  }
  return Singleton;
}

void UGatrixClient::Init(const FGatrixClientConfig &InConfig) {
  if (bInitialized) {
    UE_LOG(LogGatrix, Warning,
           TEXT("Already initialized. Call Stop() first to "
                "re-initialize."));
    return;
  }

  Config = InConfig;
  ClientConnectionId =
      FGuid::NewGuid().ToString(EGuidFormats::DigitsWithHyphens).ToLower();

  // Create file-based storage provider (persists flags across sessions)
  StorageProvider =
      MakeShareable(new FGatrixFileStorageProvider(Config.CacheKeyPrefix));

  // Create features client
  FeaturesClient = NewObject<UGatrixFeaturesClient>(this);
  FeaturesClient->Initialize(Config, &EventEmitter, StorageProvider);

  bInitialized = true;

  UE_LOG(LogGatrix, Log, TEXT("Initialized. App=%s Env=%s ConnectionId=%s"),
         *Config.AppName, *Config.Environment, *ClientConnectionId);
}

void UGatrixClient::Start() {
  if (!bInitialized) {
    UE_LOG(LogGatrix, Error,
           TEXT("Cannot start - not initialized. Call Init() first."));
    return;
  }

  if (bStarted) {
    UE_LOG(LogGatrix, Warning, TEXT("Already started."));
    return;
  }

  bStarted = true;
  FeaturesClient->Start();

  UE_LOG(LogGatrix, Log, TEXT("Started."));
}

void UGatrixClient::Stop() {
  if (!bStarted)
    return;

  bStarted = false;

  if (FeaturesClient) {
    FeaturesClient->Stop();
  }

  EventEmitter.RemoveAll();

  UE_LOG(LogGatrix, Log, TEXT("Stopped."));
}

bool UGatrixClient::IsReady() const {
  return FeaturesClient ? FeaturesClient->IsReady() : false;
}

bool UGatrixClient::IsEnabled(const FString &FlagName) const {
  return FeaturesClient ? FeaturesClient->IsEnabled(FlagName) : false;
}

bool UGatrixClient::BoolVariation(const FString &FlagName,
                                  bool DefaultValue) const {
  return FeaturesClient ? FeaturesClient->BoolVariation(FlagName, DefaultValue)
                        : DefaultValue;
}

FString UGatrixClient::StringVariation(const FString &FlagName,
                                       const FString &DefaultValue) const {
  return FeaturesClient
             ? FeaturesClient->StringVariation(FlagName, DefaultValue)
             : DefaultValue;
}

float UGatrixClient::NumberVariation(const FString &FlagName,
                                     float DefaultValue) const {
  return FeaturesClient
             ? FeaturesClient->NumberVariation(FlagName, DefaultValue)
             : DefaultValue;
}

FGatrixVariant UGatrixClient::GetVariant(const FString &FlagName) const {
  return FeaturesClient ? FeaturesClient->GetVariant(FlagName)
                        : FGatrixVariant::Disabled();
}

TArray<FGatrixEvaluatedFlag> UGatrixClient::GetAllFlags() const {
  return FeaturesClient ? FeaturesClient->GetAllFlags()
                        : TArray<FGatrixEvaluatedFlag>();
}

int32 UGatrixClient::On(const FString &EventName,
                        TFunction<void(const TArray<FString> &)> Callback,
                        const FString &Name) {
  return EventEmitter.On(EventName, MoveTemp(Callback), Name);
}

int32 UGatrixClient::Once(const FString &EventName,
                          TFunction<void(const TArray<FString> &)> Callback,
                          const FString &Name) {
  return EventEmitter.Once(EventName, MoveTemp(Callback), Name);
}

void UGatrixClient::Off(int32 Handle) { EventEmitter.Off(Handle); }

void UGatrixClient::Off(const FString &EventName) {
  EventEmitter.OffAll(EventName);
}

int32 UGatrixClient::OnAny(
    TFunction<void(const FString &, const TArray<FString> &)> Callback,
    const FString &Name) {
  return EventEmitter.OnAny(MoveTemp(Callback), Name);
}

void UGatrixClient::OffAny(int32 Handle) { EventEmitter.OffAny(Handle); }

FGatrixSdkStats UGatrixClient::GetStats() const {
  FGatrixSdkStats Stats;
  Stats.ConnectionId = ClientConnectionId;
  Stats.bOfflineMode = Config.bOfflineMode;

  if (FeaturesClient) {
    Stats.Features = FeaturesClient->GetStats();
    Stats.SdkState = Stats.Features.TotalFlagCount > 0
                         ? EGatrixSdkState::Healthy
                         : EGatrixSdkState::Initializing;
  }

  return Stats;
}

void UGatrixClient::UpdateContext(const FGatrixContext &NewContext) {
  if (FeaturesClient) {
    FeaturesClient->UpdateContext(NewContext);
  }
}

FGatrixContext UGatrixClient::GetContext() const {
  return FeaturesClient ? FeaturesClient->GetContext() : FGatrixContext();
}

FGatrixOnReady &UGatrixClient::GetOnReady() { return FeaturesClient->OnReady; }

FGatrixOnChange &UGatrixClient::GetOnChange() {
  return FeaturesClient->OnChange;
}

FGatrixOnError &UGatrixClient::GetOnError() { return FeaturesClient->OnError; }
