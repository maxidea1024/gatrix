// Copyright Gatrix. All Rights Reserved.

#include "GatrixBannerClient.h"
#include "Http.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Async/Async.h"

DEFINE_LOG_CATEGORY_STATIC(LogGatrixBanner, Log, All);

// ==================== Initialization ====================

void UGatrixBannerClient::Initialize(const FString& InApiUrl, const FString& InApiToken,
                                     const TMap<FString, FString>& InCustomHeaders) {
  ApiUrl = InApiUrl;
  ApiToken = InApiToken;
  CustomHeaders = InCustomHeaders;

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

  // prevent GC during async operation
  TWeakObjectPtr<UGatrixBannerClient> WeakThis(this);

  Request->OnProcessRequestComplete().BindLambda(
      [WeakThis, OnComplete](FHttpRequestPtr Req, FHttpResponsePtr Resp,
                             bool bConnectedSuccessfully) {
        // Must process results on game thread
        AsyncTask(ENamedThreads::GameThread, [WeakThis, Resp, bConnectedSuccessfully, OnComplete]() {
          if (!WeakThis.IsValid()) return;

          UGatrixBannerClient* Self = WeakThis.Get();
          TArray<FGatrixBanner> Banners;

          if (!bConnectedSuccessfully || !Resp.IsValid()) {
            UE_LOG(LogGatrixBanner, Warning, TEXT("FetchAllBanners: Connection failed"));
            if (OnComplete) OnComplete(false, Banners);
            Self->OnAllBannersLoaded.Broadcast(false, Banners);
            return;
          }

          const int32 StatusCode = Resp->GetResponseCode();
          if (StatusCode != 200) {
            UE_LOG(LogGatrixBanner, Warning,
                   TEXT("FetchAllBanners: HTTP %d — %s"), StatusCode,
                   *Resp->GetContentAsString().Left(200));
            if (OnComplete) OnComplete(false, Banners);
            Self->OnAllBannersLoaded.Broadcast(false, Banners);
            return;
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

          // Extract data.banners array
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
