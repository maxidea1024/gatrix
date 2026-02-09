// Copyright Gatrix. All Rights Reserved.

#include "GatrixClient.h"
#include "GatrixEvents.h"
#include "Misc/Guid.h"

const FString UGatrixClient::SdkVersion = TEXT("1.0.0");
const FString UGatrixClient::SdkName = TEXT("gatrix-unreal-client-sdk");

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
    UE_LOG(LogTemp, Warning,
           TEXT("[GatrixSDK] Already initialized. Call Stop() first to "
                "re-initialize."));
    return;
  }

  Config = InConfig;
  ClientConnectionId =
      FGuid::NewGuid().ToString(EGuidFormats::DigitsWithHyphensLower);

  // Create storage provider if not provided
  StorageProvider = MakeShareable(new FGatrixInMemoryStorageProvider());

  // Create features client
  FeaturesClient = NewObject<UGatrixFeaturesClient>(this);
  FeaturesClient->Initialize(Config, &EventEmitter, StorageProvider);

  bInitialized = true;

  UE_LOG(LogTemp, Log,
         TEXT("[GatrixSDK] Initialized. App=%s Env=%s ConnectionId=%s"),
         *Config.AppName, *Config.Environment, *ClientConnectionId);
}

void UGatrixClient::Start() {
  if (!bInitialized) {
    UE_LOG(
        LogTemp, Error,
        TEXT("[GatrixSDK] Cannot start - not initialized. Call Init() first."));
    return;
  }

  if (bStarted) {
    UE_LOG(LogTemp, Warning, TEXT("[GatrixSDK] Already started."));
    return;
  }

  bStarted = true;
  FeaturesClient->Start();

  UE_LOG(LogTemp, Log, TEXT("[GatrixSDK] Started."));
}

void UGatrixClient::Stop() {
  if (!bStarted)
    return;

  bStarted = false;

  if (FeaturesClient) {
    FeaturesClient->Stop();
  }

  EventEmitter.RemoveAll();

  UE_LOG(LogTemp, Log, TEXT("[GatrixSDK] Stopped."));
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
