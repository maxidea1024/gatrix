// Copyright Gatrix. All Rights Reserved.

#include "GatrixBannerClient.h"
#include "GatrixImageManager.h"
#include "Http.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"
#include "Async/Async.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "HAL/PlatformFilemanager.h"

DEFINE_LOG_CATEGORY_STATIC(LogGatrixBanner, Log, All);

// ==================== Initialization ====================

void UGatrixBannerClient::Initialize(const FString& InApiUrl, const FString& InApiToken,
                                     const TMap<FString, FString>& InCustomHeaders) {
  ApiUrl = InApiUrl;
  ApiToken = InApiToken;
  CustomHeaders = InCustomHeaders;
  EnsureCacheDir();

  // Load cached banners from disk on startup (offline support)
  TArray<FGatrixBanner> CachedBanners;
  if (LoadBannerListFromCache(CachedBanners)) {
    for (const auto& B : CachedBanners) {
      BannerCache.Add(B.BannerId, B);
    }
    UE_LOG(LogGatrixBanner, Log,
           TEXT("BannerClient: Loaded %d banners from disk cache"),
           CachedBanners.Num());
  }

  UE_LOG(LogGatrixBanner, Log, TEXT("BannerClient initialized. ApiUrl=%s"), *ApiUrl);
}

// ==================== Fetch All Banners ====================

void UGatrixBannerClient::FetchAllBanners() {
  FetchAllBanners(nullptr);
}

void UGatrixBannerClient::FetchAllBanners(
    TFunction<void(bool, const TArray<FGatrixBanner>&)> OnComplete) {
  TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request =
      CreateRequest(TEXT("/client/banners"));

  // Set ETag for conditional request (304 Not Modified)
  if (!BannerListEtag.IsEmpty()) {
    Request->SetHeader(TEXT("If-None-Match"), BannerListEtag);
  }

  TWeakObjectPtr<UGatrixBannerClient> WeakThis(this);

  Request->OnProcessRequestComplete().BindLambda(
      [WeakThis, OnComplete](FHttpRequestPtr Req, FHttpResponsePtr Resp,
                             bool bConnectedSuccessfully) {
        AsyncTask(ENamedThreads::GameThread, [WeakThis, Resp, bConnectedSuccessfully, OnComplete]() {
          if (!WeakThis.IsValid()) return;

          UGatrixBannerClient* Self = WeakThis.Get();
          TArray<FGatrixBanner> Banners;

          if (!bConnectedSuccessfully || !Resp.IsValid()) {
            UE_LOG(LogGatrixBanner, Warning, TEXT("FetchAllBanners: Connection failed"));
            // Fall back to disk cache
            Banners = Self->GetCachedBanners();
            bool bHasCache = Banners.Num() > 0;
            if (OnComplete) OnComplete(bHasCache, Banners);
            Self->OnAllBannersLoaded.Broadcast(bHasCache, Banners);
            return;
          }

          const int32 StatusCode = Resp->GetResponseCode();

          // 304 Not Modified — cached data is still valid
          if (StatusCode == 304) {
            UE_LOG(LogGatrixBanner, Log,
                   TEXT("FetchAllBanners: 304 Not Modified — using cache"));
            Banners = Self->GetCachedBanners();
            if (OnComplete) OnComplete(true, Banners);
            Self->OnAllBannersLoaded.Broadcast(true, Banners);
            return;
          }

          if (StatusCode != 200) {
            UE_LOG(LogGatrixBanner, Warning,
                   TEXT("FetchAllBanners: HTTP %d — %s"), StatusCode,
                   *Resp->GetContentAsString().Left(200));
            if (OnComplete) OnComplete(false, Banners);
            Self->OnAllBannersLoaded.Broadcast(false, Banners);
            return;
          }

          // Store new ETag
          FString NewEtag = Resp->GetHeader(TEXT("ETag"));
          if (!NewEtag.IsEmpty()) {
            Self->BannerListEtag = NewEtag;
          }

          // Parse JSON
          TSharedPtr<FJsonObject> RootObj;
          TSharedRef<TJsonReader<>> Reader =
              TJsonReaderFactory<>::Create(Resp->GetContentAsString());

          if (!FJsonSerializer::Deserialize(Reader, RootObj) || !RootObj.IsValid()) {
            UE_LOG(LogGatrixBanner, Warning, TEXT("FetchAllBanners: JSON parse failed"));
            if (OnComplete) OnComplete(false, Banners);
            Self->OnAllBannersLoaded.Broadcast(false, Banners);
            return;
          }

          const TSharedPtr<FJsonObject>* DataObj = nullptr;
          if (!RootObj->TryGetObjectField(TEXT("data"), DataObj)) {
            UE_LOG(LogGatrixBanner, Warning, TEXT("FetchAllBanners: Missing 'data' field"));
            if (OnComplete) OnComplete(false, Banners);
            Self->OnAllBannersLoaded.Broadcast(false, Banners);
            return;
          }

          const TArray<TSharedPtr<FJsonValue>>* BannersArr = nullptr;
          if (!(*DataObj)->TryGetArrayField(TEXT("banners"), BannersArr)) {
            UE_LOG(LogGatrixBanner, Warning,
                   TEXT("FetchAllBanners: Missing 'data.banners' array"));
            if (OnComplete) OnComplete(false, Banners);
            Self->OnAllBannersLoaded.Broadcast(false, Banners);
            return;
          }

          for (const auto& BannerVal : *BannersArr) {
            const TSharedPtr<FJsonObject>* BannerObj = nullptr;
            if (BannerVal->TryGetObject(BannerObj)) {
              FGatrixBanner Banner;
              if (ParseBannerFromJson(*BannerObj, Banner)) {
                Self->BannerCache.Add(Banner.BannerId, Banner);
                Banners.Add(MoveTemp(Banner));
              }
            }
          }

          UE_LOG(LogGatrixBanner, Log, TEXT("FetchAllBanners: Loaded %d banners"),
                 Banners.Num());

          // Save to disk cache for offline use
          Self->SaveBannerListToCache(Banners);

          // Prefetch all referenced images
          Self->PrefetchBannerImages(Banners);

          if (OnComplete) OnComplete(true, Banners);
          Self->OnAllBannersLoaded.Broadcast(true, Banners);
        });
      });

  Request->ProcessRequest();
}

// ==================== Fetch Banner By ID ====================

void UGatrixBannerClient::FetchBannerById(const FString& BannerId) {
  FetchBannerById(BannerId, nullptr);
}

void UGatrixBannerClient::FetchBannerById(
    const FString& BannerId,
    TFunction<void(bool, const FGatrixBanner&)> OnComplete) {
  const FString Endpoint =
      FString::Printf(TEXT("/client/banners/%s"), *BannerId);
  TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = CreateRequest(Endpoint);

  TWeakObjectPtr<UGatrixBannerClient> WeakThis(this);

  Request->OnProcessRequestComplete().BindLambda(
      [WeakThis, OnComplete](FHttpRequestPtr Req, FHttpResponsePtr Resp,
                             bool bConnectedSuccessfully) {
        AsyncTask(ENamedThreads::GameThread, [WeakThis, Resp, bConnectedSuccessfully, OnComplete]() {
          if (!WeakThis.IsValid()) return;

          UGatrixBannerClient* Self = WeakThis.Get();
          FGatrixBanner EmptyBanner;

          if (!bConnectedSuccessfully || !Resp.IsValid()) {
            UE_LOG(LogGatrixBanner, Warning, TEXT("FetchBannerById: Connection failed"));
            if (OnComplete) OnComplete(false, EmptyBanner);
            Self->OnBannerLoaded.Broadcast(false, EmptyBanner);
            return;
          }

          const int32 StatusCode = Resp->GetResponseCode();
          if (StatusCode != 200) {
            UE_LOG(LogGatrixBanner, Warning,
                   TEXT("FetchBannerById: HTTP %d"), StatusCode);
            if (OnComplete) OnComplete(false, EmptyBanner);
            Self->OnBannerLoaded.Broadcast(false, EmptyBanner);
            return;
          }

          TSharedPtr<FJsonObject> RootObj;
          TSharedRef<TJsonReader<>> Reader =
              TJsonReaderFactory<>::Create(Resp->GetContentAsString());

          if (!FJsonSerializer::Deserialize(Reader, RootObj) || !RootObj.IsValid()) {
            UE_LOG(LogGatrixBanner, Warning, TEXT("FetchBannerById: JSON parse failed"));
            if (OnComplete) OnComplete(false, EmptyBanner);
            Self->OnBannerLoaded.Broadcast(false, EmptyBanner);
            return;
          }

          const TSharedPtr<FJsonObject>* DataObj = nullptr;
          if (!RootObj->TryGetObjectField(TEXT("data"), DataObj)) {
            if (OnComplete) OnComplete(false, EmptyBanner);
            Self->OnBannerLoaded.Broadcast(false, EmptyBanner);
            return;
          }

          const TSharedPtr<FJsonObject>* BannerObj = nullptr;
          if (!(*DataObj)->TryGetObjectField(TEXT("banner"), BannerObj)) {
            if (OnComplete) OnComplete(false, EmptyBanner);
            Self->OnBannerLoaded.Broadcast(false, EmptyBanner);
            return;
          }

          FGatrixBanner Banner;
          if (ParseBannerFromJson(*BannerObj, Banner)) {
            Self->BannerCache.Add(Banner.BannerId, Banner);
            UE_LOG(LogGatrixBanner, Log,
                   TEXT("FetchBannerById: Loaded banner '%s' (%dx%d, %d sequences)"),
                   *Banner.Name, Banner.Width, Banner.Height, Banner.Sequences.Num());
            if (OnComplete) OnComplete(true, Banner);
            Self->OnBannerLoaded.Broadcast(true, Banner);
          } else {
            UE_LOG(LogGatrixBanner, Warning,
                   TEXT("FetchBannerById: Failed to parse banner"));
            if (OnComplete) OnComplete(false, EmptyBanner);
            Self->OnBannerLoaded.Broadcast(false, EmptyBanner);
          }
        });
      });

  Request->ProcessRequest();
}

// ==================== Cache ====================

FGatrixBanner UGatrixBannerClient::GetCachedBanner(const FString& BannerId) const {
  const FGatrixBanner* Found = BannerCache.Find(BannerId);
  return Found ? *Found : FGatrixBanner();
}

TArray<FGatrixBanner> UGatrixBannerClient::GetCachedBanners() const {
  TArray<FGatrixBanner> Result;
  BannerCache.GenerateValueArray(Result);
  return Result;
}

bool UGatrixBannerClient::HasCachedBanner(const FString& BannerId) const {
  return BannerCache.Contains(BannerId);
}

void UGatrixBannerClient::ClearCache() {
  BannerCache.Empty();
}

// ==================== HTTP Helpers ====================

TSharedRef<IHttpRequest, ESPMode::ThreadSafe>
UGatrixBannerClient::CreateRequest(const FString& Endpoint) const {
  auto Request = FHttpModule::Get().CreateRequest();
  Request->SetURL(ApiUrl + Endpoint);
  Request->SetVerb(TEXT("GET"));
  Request->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
  Request->SetHeader(TEXT("Accept"), TEXT("application/json"));

  // API token auth
  if (!ApiToken.IsEmpty()) {
    Request->SetHeader(TEXT("X-API-Token"), ApiToken);
  }

  // Custom headers
  for (const auto& Pair : CustomHeaders) {
    Request->SetHeader(Pair.Key, Pair.Value);
  }

  return Request;
}

// ==================== JSON Parsing ====================

bool UGatrixBannerClient::ParseBannerFromJson(
    const TSharedPtr<FJsonObject>& JsonObj, FGatrixBanner& OutBanner) {
  if (!JsonObj.IsValid()) return false;

  OutBanner.BannerId = JsonObj->GetStringField(TEXT("bannerId"));
  OutBanner.Name = JsonObj->GetStringField(TEXT("name"));
  OutBanner.Width = static_cast<int32>(JsonObj->GetNumberField(TEXT("width")));
  OutBanner.Height = static_cast<int32>(JsonObj->GetNumberField(TEXT("height")));
  OutBanner.PlaybackSpeed =
      static_cast<float>(JsonObj->GetNumberField(TEXT("playbackSpeed")));

  bool bShuffle = false;
  if (JsonObj->TryGetBoolField(TEXT("shuffle"), bShuffle)) {
    OutBanner.bShuffle = bShuffle;
  }

  double Version = 0;
  if (JsonObj->TryGetNumberField(TEXT("version"), Version)) {
    OutBanner.Version = static_cast<int32>(Version);
  }

  // Parse sequences
  const TArray<TSharedPtr<FJsonValue>>* SeqArr = nullptr;
  if (JsonObj->TryGetArrayField(TEXT("sequences"), SeqArr)) {
    for (const auto& SeqVal : *SeqArr) {
      const TSharedPtr<FJsonObject>* SeqObj = nullptr;
      if (SeqVal->TryGetObject(SeqObj)) {
        FGatrixBannerSequence Seq;
        if (ParseSequenceFromJson(*SeqObj, Seq)) {
          OutBanner.Sequences.Add(MoveTemp(Seq));
        }
      }
    }
  }

  return !OutBanner.BannerId.IsEmpty();
}

bool UGatrixBannerClient::ParseSequenceFromJson(
    const TSharedPtr<FJsonObject>& JsonObj, FGatrixBannerSequence& OutSeq) {
  if (!JsonObj.IsValid()) return false;

  OutSeq.SequenceId = JsonObj->GetStringField(TEXT("sequenceId"));
  OutSeq.Name = JsonObj->GetStringField(TEXT("name"));

  double SpeedMul = 1.0;
  if (JsonObj->TryGetNumberField(TEXT("speedMultiplier"), SpeedMul)) {
    OutSeq.SpeedMultiplier = static_cast<float>(SpeedMul);
  }

  FString LoopMode;
  if (JsonObj->TryGetStringField(TEXT("loopMode"), LoopMode)) {
    OutSeq.LoopMode = GatrixBannerParse::ParseLoopMode(LoopMode);
  }

  // Sequence-level transition
  const TSharedPtr<FJsonObject>* TransObj = nullptr;
  if (JsonObj->TryGetObjectField(TEXT("transition"), TransObj)) {
    FString TransType;
    if ((*TransObj)->TryGetStringField(TEXT("type"), TransType)) {
      OutSeq.Transition.Type = GatrixBannerParse::ParseTransitionType(TransType);
    }
    double TransDur = 300;
    if ((*TransObj)->TryGetNumberField(TEXT("duration"), TransDur)) {
      OutSeq.Transition.Duration = static_cast<int32>(TransDur);
    }
  }

  // Parse frames
  const TArray<TSharedPtr<FJsonValue>>* FramesArr = nullptr;
  if (JsonObj->TryGetArrayField(TEXT("frames"), FramesArr)) {
    for (const auto& FrameVal : *FramesArr) {
      const TSharedPtr<FJsonObject>* FrameObj = nullptr;
      if (FrameVal->TryGetObject(FrameObj)) {
        FGatrixBannerFrame Frame;
        if (ParseFrameFromJson(*FrameObj, Frame)) {
          OutSeq.Frames.Add(MoveTemp(Frame));
        }
      }
    }
  }

  return !OutSeq.SequenceId.IsEmpty();
}

bool UGatrixBannerClient::ParseFrameFromJson(
    const TSharedPtr<FJsonObject>& JsonObj, FGatrixBannerFrame& OutFrame) {
  if (!JsonObj.IsValid()) return false;

  OutFrame.FrameId = JsonObj->GetStringField(TEXT("frameId"));
  OutFrame.ImageUrl = JsonObj->GetStringField(TEXT("imageUrl"));

  FString FrameType;
  if (JsonObj->TryGetStringField(TEXT("type"), FrameType) && !FrameType.IsEmpty()) {
    OutFrame.Type = GatrixBannerParse::ParseFrameType(FrameType);
  } else {
    // Infer type from URL extension if server didn't specify
    FString Ext = FPaths::GetExtension(OutFrame.ImageUrl).ToLower();
    OutFrame.Type = GatrixBannerParse::ParseFrameType(Ext);
  }

  double Delay = 3000;
  if (JsonObj->TryGetNumberField(TEXT("delay"), Delay)) {
    OutFrame.Delay = static_cast<int32>(Delay);
  }

  bool bLoop = false;
  if (JsonObj->TryGetBoolField(TEXT("loop"), bLoop)) {
    OutFrame.bLoop = bLoop;
  }

  FString ClickUrl;
  if (JsonObj->TryGetStringField(TEXT("clickUrl"), ClickUrl)) {
    OutFrame.ClickUrl = ClickUrl;
  }

  // Action
  const TSharedPtr<FJsonObject>* ActionObj = nullptr;
  if (JsonObj->TryGetObjectField(TEXT("action"), ActionObj)) {
    FString ActionType;
    if ((*ActionObj)->TryGetStringField(TEXT("type"), ActionType)) {
      OutFrame.Action.Type = GatrixBannerParse::ParseActionType(ActionType);
    }
    FString ActionValue;
    if ((*ActionObj)->TryGetStringField(TEXT("value"), ActionValue)) {
      OutFrame.Action.Value = ActionValue;
    }
    FString ActionTarget;
    if ((*ActionObj)->TryGetStringField(TEXT("target"), ActionTarget)) {
      OutFrame.Action.Target = GatrixBannerParse::ParseActionTarget(ActionTarget);
    }
  }

  // Effects
  const TSharedPtr<FJsonObject>* EffectsObj = nullptr;
  if (JsonObj->TryGetObjectField(TEXT("effects"), EffectsObj)) {
    FString Enter;
    if ((*EffectsObj)->TryGetStringField(TEXT("enter"), Enter)) {
      OutFrame.Effects.Enter = GatrixBannerParse::ParseEffectType(Enter);
    }
    FString Exit;
    if ((*EffectsObj)->TryGetStringField(TEXT("exit"), Exit)) {
      OutFrame.Effects.Exit = GatrixBannerParse::ParseEffectType(Exit);
    }
    double EffDur = 300;
    if ((*EffectsObj)->TryGetNumberField(TEXT("duration"), EffDur)) {
      OutFrame.Effects.Duration = static_cast<int32>(EffDur);
    }
  }

  // Transition
  const TSharedPtr<FJsonObject>* TransObj = nullptr;
  if (JsonObj->TryGetObjectField(TEXT("transition"), TransObj)) {
    FString TransType;
    if ((*TransObj)->TryGetStringField(TEXT("type"), TransType)) {
      OutFrame.Transition.Type = GatrixBannerParse::ParseTransitionType(TransType);
    }
    double TransDur = 300;
    if ((*TransObj)->TryGetNumberField(TEXT("duration"), TransDur)) {
      OutFrame.Transition.Duration = static_cast<int32>(TransDur);
    }
  }

  // Targeting
  const TSharedPtr<FJsonObject>* TargetObj = nullptr;
  if (JsonObj->TryGetObjectField(TEXT("targeting"), TargetObj)) {
    ParseTargetingFromJson(*TargetObj, OutFrame.Targeting);
  }

  return !OutFrame.FrameId.IsEmpty();
}

void UGatrixBannerClient::ParseTargetingFromJson(
    const TSharedPtr<FJsonObject>& JsonObj, FGatrixFrameTargeting& OutTargeting) {
  if (!JsonObj.IsValid()) return;

  // Platforms
  const TArray<TSharedPtr<FJsonValue>>* PlatformsArr = nullptr;
  if (JsonObj->TryGetArrayField(TEXT("platforms"), PlatformsArr)) {
    for (const auto& Val : *PlatformsArr) {
      FString Str;
      if (Val->TryGetString(Str)) {
        OutTargeting.Platforms.Add(Str);
      }
    }
  }
  bool bPlatformsInv = false;
  if (JsonObj->TryGetBoolField(TEXT("platformsInverted"), bPlatformsInv)) {
    OutTargeting.bPlatformsInverted = bPlatformsInv;
  }

  // Worlds
  const TArray<TSharedPtr<FJsonValue>>* WorldsArr = nullptr;
  if (JsonObj->TryGetArrayField(TEXT("worlds"), WorldsArr)) {
    for (const auto& Val : *WorldsArr) {
      FString Str;
      if (Val->TryGetString(Str)) {
        OutTargeting.Worlds.Add(Str);
      }
    }
  }
  bool bWorldsInv = false;
  if (JsonObj->TryGetBoolField(TEXT("worldsInverted"), bWorldsInv)) {
    OutTargeting.bWorldsInverted = bWorldsInv;
  }

  // Channel/subchannels
  const TArray<TSharedPtr<FJsonValue>>* CsArr = nullptr;
  if (JsonObj->TryGetArrayField(TEXT("channelSubchannels"), CsArr)) {
    for (const auto& CsVal : *CsArr) {
      const TSharedPtr<FJsonObject>* CsObj = nullptr;
      if (CsVal->TryGetObject(CsObj)) {
        FGatrixChannelSubchannel Cs;
        (*CsObj)->TryGetStringField(TEXT("channel"), Cs.Channel);
        const TArray<TSharedPtr<FJsonValue>>* SubArr = nullptr;
        if ((*CsObj)->TryGetArrayField(TEXT("subchannels"), SubArr)) {
          for (const auto& SubVal : *SubArr) {
            FString Sub;
            if (SubVal->TryGetString(Sub)) {
              Cs.Subchannels.Add(Sub);
            }
          }
        }
        OutTargeting.ChannelSubchannels.Add(MoveTemp(Cs));
      }
    }
  }
  bool bCsInv = false;
  if (JsonObj->TryGetBoolField(TEXT("channelSubchannelsInverted"), bCsInv)) {
    OutTargeting.bChannelSubchannelsInverted = bCsInv;
  }

  // Level range
  double LevelMin = 0, LevelMax = 0;
  if (JsonObj->TryGetNumberField(TEXT("levelMin"), LevelMin)) {
    OutTargeting.LevelMin = static_cast<int32>(LevelMin);
  }
  if (JsonObj->TryGetNumberField(TEXT("levelMax"), LevelMax)) {
    OutTargeting.LevelMax = static_cast<int32>(LevelMax);
  }

  // Join days range
  double JoinMin = -1, JoinMax = -1;
  if (JsonObj->TryGetNumberField(TEXT("joinDaysMin"), JoinMin)) {
    OutTargeting.JoinDaysMin = static_cast<int32>(JoinMin);
  }
  if (JsonObj->TryGetNumberField(TEXT("joinDaysMax"), JoinMax)) {
    OutTargeting.JoinDaysMax = static_cast<int32>(JoinMax);
  }

  // Filter logic
  FString FilterLogic;
  if (JsonObj->TryGetStringField(TEXT("filterLogic"), FilterLogic)) {
    OutTargeting.FilterLogic = GatrixBannerParse::ParseFilterLogic(FilterLogic);
  }
}

// ==================== Disk Cache ====================

void UGatrixBannerClient::EnsureCacheDir() {
  BannerCacheDir = FPaths::ProjectSavedDir() / TEXT("GatrixCache") / TEXT("Banners");
  IPlatformFile& PlatformFile = FPlatformFileManager::Get().GetPlatformFile();
  if (!PlatformFile.DirectoryExists(*BannerCacheDir)) {
    PlatformFile.CreateDirectoryTree(*BannerCacheDir);
  }
}

FString UGatrixBannerClient::GetCacheFilePath(const FString& Filename) const {
  return BannerCacheDir / Filename;
}

void UGatrixBannerClient::SaveBannerListToCache(const TArray<FGatrixBanner>& Banners) {
  // Save raw banner JSON response as a simplified format
  FString JsonContent = TEXT("[");
  for (int32 i = 0; i < Banners.Num(); ++i) {
    if (i > 0) JsonContent += TEXT(",");
    JsonContent += SerializeBannerToJson(Banners[i]);
  }
  JsonContent += TEXT("]");

  FFileHelper::SaveStringToFile(
      JsonContent, *GetCacheFilePath(TEXT("banner_list.json")),
      FFileHelper::EEncodingOptions::ForceUTF8WithoutBOM);

  // Save ETag separately
  if (!BannerListEtag.IsEmpty()) {
    FFileHelper::SaveStringToFile(
        BannerListEtag, *GetCacheFilePath(TEXT("banner_list.etag")),
        FFileHelper::EEncodingOptions::ForceUTF8WithoutBOM);
  }

  UE_LOG(LogGatrixBanner, Log, TEXT("SaveBannerListToCache: %d banners saved"),
         Banners.Num());
}

bool UGatrixBannerClient::LoadBannerListFromCache(TArray<FGatrixBanner>& OutBanners) {
  FString JsonContent;
  if (!FFileHelper::LoadFileToString(
          JsonContent, *GetCacheFilePath(TEXT("banner_list.json")))) {
    return false;
  }

  // Load ETag
  FString CachedEtag;
  if (FFileHelper::LoadFileToString(
          CachedEtag, *GetCacheFilePath(TEXT("banner_list.etag")))) {
    BannerListEtag = CachedEtag.TrimStartAndEnd();
  }

  // Parse JSON array
  TArray<TSharedPtr<FJsonValue>> JsonArray;
  TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(JsonContent);
  if (!FJsonSerializer::Deserialize(Reader, JsonArray)) {
    UE_LOG(LogGatrixBanner, Warning, TEXT("LoadBannerListFromCache: JSON parse failed"));
    return false;
  }

  for (const auto& Val : JsonArray) {
    const TSharedPtr<FJsonObject>* Obj = nullptr;
    if (Val->TryGetObject(Obj)) {
      FGatrixBanner Banner;
      if (ParseBannerFromJson(*Obj, Banner)) {
        OutBanners.Add(MoveTemp(Banner));
      }
    }
  }

  return OutBanners.Num() > 0;
}

void UGatrixBannerClient::SaveBannerToCache(const FGatrixBanner& Banner) {
  FString Filename = FString::Printf(TEXT("banner_%s.json"), *Banner.BannerId);
  FString JsonContent = SerializeBannerToJson(Banner);
  FFileHelper::SaveStringToFile(
      JsonContent, *GetCacheFilePath(Filename),
      FFileHelper::EEncodingOptions::ForceUTF8WithoutBOM);
}

bool UGatrixBannerClient::LoadBannerFromCache(const FString& BannerId,
                                               FGatrixBanner& OutBanner) {
  FString Filename = FString::Printf(TEXT("banner_%s.json"), *BannerId);
  FString JsonContent;
  if (!FFileHelper::LoadFileToString(JsonContent, *GetCacheFilePath(Filename))) {
    return false;
  }

  TSharedPtr<FJsonObject> JsonObj;
  TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(JsonContent);
  if (!FJsonSerializer::Deserialize(Reader, JsonObj) || !JsonObj.IsValid()) {
    return false;
  }

  return ParseBannerFromJson(JsonObj, OutBanner);
}

// ==================== Serialization ====================

FString UGatrixBannerClient::SerializeBannerToJson(const FGatrixBanner& Banner) {
  TSharedRef<FJsonObject> Obj = MakeShared<FJsonObject>();
  Obj->SetStringField(TEXT("bannerId"), Banner.BannerId);
  Obj->SetStringField(TEXT("name"), Banner.Name);
  Obj->SetNumberField(TEXT("width"), Banner.Width);
  Obj->SetNumberField(TEXT("height"), Banner.Height);
  Obj->SetNumberField(TEXT("playbackSpeed"), Banner.PlaybackSpeed);
  Obj->SetBoolField(TEXT("shuffle"), Banner.bShuffle);
  Obj->SetNumberField(TEXT("version"), Banner.Version);

  // Serialize sequences
  TArray<TSharedPtr<FJsonValue>> SeqArray;
  for (const auto& Seq : Banner.Sequences) {
    TSharedRef<FJsonObject> SeqObj = MakeShared<FJsonObject>();
    SeqObj->SetStringField(TEXT("sequenceId"), Seq.SequenceId);
    SeqObj->SetStringField(TEXT("name"), Seq.Name);
    SeqObj->SetNumberField(TEXT("speedMultiplier"), Seq.SpeedMultiplier);

    TArray<TSharedPtr<FJsonValue>> FrameArray;
    for (const auto& Frame : Seq.Frames) {
      TSharedRef<FJsonObject> FrameObj = MakeShared<FJsonObject>();
      FrameObj->SetStringField(TEXT("frameId"), Frame.FrameId);
      FrameObj->SetStringField(TEXT("imageUrl"), Frame.ImageUrl);

      // Frame type as string (reverse of ParseFrameType)
      FString TypeStr = TEXT("png");
      switch (Frame.Type) {
        case EGatrixFrameType::Jpg:  TypeStr = TEXT("jpg"); break;
        case EGatrixFrameType::Png:  TypeStr = TEXT("png"); break;
        case EGatrixFrameType::Gif:  TypeStr = TEXT("gif"); break;
        case EGatrixFrameType::Mp4:  TypeStr = TEXT("mp4"); break;
        case EGatrixFrameType::Webp: TypeStr = TEXT("webp"); break;
        case EGatrixFrameType::Svg:  TypeStr = TEXT("svg"); break;
        default: break;
      }
      FrameObj->SetStringField(TEXT("type"), TypeStr);
      FrameObj->SetNumberField(TEXT("delay"), Frame.Delay);
      FrameObj->SetBoolField(TEXT("loop"), Frame.bLoop);

      // Action
      if (!Frame.Action.Value.IsEmpty()) {
        TSharedRef<FJsonObject> ActionObj = MakeShared<FJsonObject>();
        ActionObj->SetStringField(TEXT("value"), Frame.Action.Value);

        // Action type as string (reverse of ParseActionType)
        FString ActionStr = TEXT("none");
        switch (Frame.Action.Type) {
          case EGatrixFrameActionType::OpenUrl:  ActionStr = TEXT("openUrl"); break;
          case EGatrixFrameActionType::Command:  ActionStr = TEXT("command"); break;
          case EGatrixFrameActionType::DeepLink: ActionStr = TEXT("deepLink"); break;
          default: break;
        }
        ActionObj->SetStringField(TEXT("type"), ActionStr);
        FrameObj->SetObjectField(TEXT("action"), ActionObj);
      }

      // Click URL
      if (!Frame.ClickUrl.IsEmpty()) {
        FrameObj->SetStringField(TEXT("clickUrl"), Frame.ClickUrl);
      }

      FrameArray.Add(MakeShared<FJsonValueObject>(FrameObj));
    }
    SeqObj->SetArrayField(TEXT("frames"), FrameArray);
    SeqArray.Add(MakeShared<FJsonValueObject>(SeqObj));
  }
  Obj->SetArrayField(TEXT("sequences"), SeqArray);

  // Serialize to string
  FString Result;
  TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Result);
  FJsonSerializer::Serialize(Obj, Writer);
  return Result;
}

// ==================== Image Prefetch ====================

void UGatrixBannerClient::PrefetchBannerImages(const TArray<FGatrixBanner>& Banners) {
  TArray<FString> AllImageUrls;

  for (const auto& Banner : Banners) {
    for (const auto& Seq : Banner.Sequences) {
      for (const auto& Frame : Seq.Frames) {
        if (!Frame.ImageUrl.IsEmpty() &&
            Frame.Type != EGatrixFrameType::Mp4) { // Skip video URLs
          AllImageUrls.AddUnique(Frame.ImageUrl);
        }
      }
    }
  }

  if (AllImageUrls.Num() > 0) {
    UE_LOG(LogGatrixBanner, Log,
           TEXT("PrefetchBannerImages: Prefetching %d image URLs"),
           AllImageUrls.Num());
    UGatrixImageManager::Get()->Prefetch(AllImageUrls);
  }
}
