// Copyright Gatrix. All Rights Reserved.

#include "GatrixBannerWidget.h"
#include "GatrixClient.h"
#include "Components/CanvasPanel.h"
#include "Components/CanvasPanelSlot.h"
#include "Components/Overlay.h"
#include "Components/OverlaySlot.h"
#include "Components/ScaleBox.h"
#include "Components/ScaleBoxSlot.h"
#include "Blueprint/WidgetTree.h"
#include "Slate/SlateBrushAsset.h"
#include "Engine/Texture2DDynamic.h"
#include "MediaPlayer.h"
#include "MediaTexture.h"
#include "Async/Async.h"
#include "Http.h"
#include "GatrixImageManager.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

DEFINE_LOG_CATEGORY_STATIC(LogGatrixBannerWidget, Log, All);

// ==================== FTickableGameObject ====================

void UGatrixBannerWidget::Tick(float DeltaTime) {
  // Deferred auto-load: wait for Gatrix client to be initialized
  if (!bClientInitialized && !BannerId.IsEmpty()) {
    UGatrixClient* Gatrix = UGatrixClient::Get();
    if (Gatrix && Gatrix->IsInitialized() && Gatrix->GetBanners()) {
      BannerClient = Gatrix->GetBanners();
      bClientInitialized = true;
      UE_LOG(LogGatrixBannerWidget, Log,
             TEXT("Tick: Gatrix client now ready, auto-loading banner '%s'"),
             *BannerId);
      LoadBanner(BannerId);
    }
  }

  // Tick playback controller for frame transitions
  if (Playback) {
    Playback->Tick(DeltaTime);
  }

  // Update transition animation
  if (bTransitioning) {
    UpdateTransition(DeltaTime);
  }

  // Update effect animation
  if (bEffectActive) {
    UpdateEffect(DeltaTime);
  }

  // For animated sources with per-frame textures, update the brush
  // when the Manager advances to a new frame (cheap pointer swap).
  if (CurrentFrameSource.IsValid() && CurrentFrameSource->IsAnimated() &&
      CurrentFrameSource->IsReady() && CurrentImage) {
    UTexture2DDynamic* CurrentTex = CurrentFrameSource->GetDisplayTexture();
    if (CurrentTex && CurrentTex != LastDisplayedTexture) {
      CurrentImage->SetBrushFromTextureDynamic(CurrentTex, true);
      LastDisplayedTexture = CurrentTex;
    }
  }
}

// ==================== Lifecycle ====================

TSharedRef<SWidget> UGatrixBannerWidget::RebuildWidget() {
  SetupWidgetHierarchy();
  return Super::RebuildWidget();
}

void UGatrixBannerWidget::NativeConstruct() {
  Super::NativeConstruct();

  // Auto-initialize from central Gatrix client if not already initialized
  if (!bClientInitialized) {
    UGatrixClient* Gatrix = UGatrixClient::Get();
    if (Gatrix && Gatrix->IsInitialized() && Gatrix->GetBanners()) {
      BannerClient = Gatrix->GetBanners();
      bClientInitialized = true;
      UE_LOG(LogGatrixBannerWidget, Log,
             TEXT("NativeConstruct: Auto-initialized from central GatrixClient"));
    }
  }

  // Auto-load if BannerId was set in editor and client is ready
  if (!BannerId.IsEmpty() && bClientInitialized) {
    LoadBanner(BannerId);
  }
}

void UGatrixBannerWidget::NativeDestruct() {
  if (Playback) {
    Playback->Stop();
    Playback->OnFrameChanged.RemoveDynamic(this, &UGatrixBannerWidget::OnFrameChanged);
    Playback->OnSequenceChanged.RemoveDynamic(this, &UGatrixBannerWidget::OnSequenceChanged);
    Playback->OnFrameAction.RemoveDynamic(this, &UGatrixBannerWidget::OnFrameActionTriggered);
  }
  // Release shared image source reference (memory safety)
  ReleaseCurrentFrameSource();
  CleanupVideoPlayer();
  Super::NativeDestruct();
}

void UGatrixBannerWidget::NativeTick(const FGeometry& MyGeometry, float InDeltaTime) {
  Super::NativeTick(MyGeometry, InDeltaTime);
  // All tick logic is now handled by FTickableGameObject::Tick
}

FReply UGatrixBannerWidget::NativeOnMouseButtonDown(
    const FGeometry& InGeometry, const FPointerEvent& InMouseEvent) {
  if (InMouseEvent.GetEffectingButton() == EKeys::LeftMouseButton) {
    if (Playback) {
      Playback->TriggerCurrentFrameAction();
    }
    return FReply::Handled();
  }
  return Super::NativeOnMouseButtonDown(InGeometry, InMouseEvent);
}

void UGatrixBannerWidget::SynchronizeProperties() {
  Super::SynchronizeProperties();

  // Editor design-time preview: fetch first frame when BannerId changes
  if (IsDesignTime() && !BannerId.IsEmpty() && BannerId != LastSyncedBannerId) {
    LastSyncedBannerId = BannerId;
#if WITH_EDITOR
    FetchEditorPreview();
#endif
  }
}

#if WITH_EDITOR
void UGatrixBannerWidget::FetchEditorPreview() {
  if (bEditorPreviewLoading) return;
  bEditorPreviewLoading = true;

  FString ApiBaseUrl;
  FString Token;

  // Try central GatrixClient first
  UGatrixClient* Client = UGatrixClient::Get();
  if (Client && Client->IsInitialized() && Client->GetBanners()) {
    ApiBaseUrl = Client->GetBanners()->GetApiUrl();
    Token = Client->GetBanners()->GetApiToken();
    UE_LOG(LogGatrixBannerWidget, Log, TEXT("EditorPreview: Using GatrixClient config"));
  }

  // Fall back to Uwo.ini [Gatrix] section
  if (ApiBaseUrl.IsEmpty()) {
    const FString UwoIni = FPaths::ProjectConfigDir() / TEXT("Uwo.ini");
    GConfig->GetString(TEXT("Gatrix"), TEXT("ApiUrl"), ApiBaseUrl, UwoIni);
    GConfig->GetString(TEXT("Gatrix"), TEXT("ApiToken"), Token, UwoIni);
    UE_LOG(LogGatrixBannerWidget, Log,
           TEXT("EditorPreview: Uwo.ini ApiUrl='%s', HasToken=%d"),
           *ApiBaseUrl, !Token.IsEmpty());
  }

  if (ApiBaseUrl.IsEmpty() || Token.IsEmpty()) {
    UE_LOG(LogGatrixBannerWidget, Warning,
           TEXT("FetchEditorPreview: No API config. Add [Gatrix] ApiUrl/ApiToken to Config/Uwo.ini"));
    return;
  }

  FString Url = FString::Printf(TEXT("%s/client/banners/%s"), *ApiBaseUrl, *BannerId);
  UE_LOG(LogGatrixBannerWidget, Log, TEXT("EditorPreview: Fetching %s"), *Url);

  TSharedRef<IHttpRequest, ESPMode::ThreadSafe> HttpReq = FHttpModule::Get().CreateRequest();
  HttpReq->SetURL(Url);
  HttpReq->SetVerb(TEXT("GET"));
  HttpReq->SetHeader(TEXT("x-api-token"), Token);
  HttpReq->SetHeader(TEXT("x-application-name"), TEXT("app"));

  TWeakObjectPtr<UGatrixBannerWidget> WeakThis(this);
  HttpReq->OnProcessRequestComplete().BindLambda(
      [WeakThis](FHttpRequestPtr Req, FHttpResponsePtr Resp, bool bSuccess) {
        if (!WeakThis.IsValid()) return;
        WeakThis->bEditorPreviewLoading = false;

        if (!bSuccess || !Resp.IsValid()) {
          UE_LOG(LogGatrixBannerWidget, Warning,
                 TEXT("EditorPreview: HTTP request failed (connected=%d)"), bSuccess);
          return;
        }

        const int32 StatusCode = Resp->GetResponseCode();
        if (StatusCode != 200) {
          UE_LOG(LogGatrixBannerWidget, Warning,
                 TEXT("EditorPreview: HTTP %d — %s"), StatusCode,
                 *Resp->GetContentAsString().Left(200));
          return;
        }

        // Parse JSON: data.banner.sequences[0].frames[0].imageUrl
        TSharedPtr<FJsonObject> Root;
        TSharedRef<TJsonReader<>> Reader =
            TJsonReaderFactory<>::Create(Resp->GetContentAsString());
        if (!FJsonSerializer::Deserialize(Reader, Root)) {
          UE_LOG(LogGatrixBannerWidget, Warning, TEXT("EditorPreview: JSON parse failed"));
          return;
        }

        const TSharedPtr<FJsonObject>* DataObj;
        if (!Root->TryGetObjectField(TEXT("data"), DataObj)) return;
        const TSharedPtr<FJsonObject>* BannerObj;
        if (!(*DataObj)->TryGetObjectField(TEXT("banner"), BannerObj)) return;

        const TArray<TSharedPtr<FJsonValue>>* Sequences;
        if (!(*BannerObj)->TryGetArrayField(TEXT("sequences"), Sequences) ||
            Sequences->Num() == 0)
          return;

        const TSharedPtr<FJsonObject>* SeqObj;
        if (!(*Sequences)[0]->TryGetObject(SeqObj)) return;

        const TArray<TSharedPtr<FJsonValue>>* Frames;
        if (!(*SeqObj)->TryGetArrayField(TEXT("frames"), Frames) ||
            Frames->Num() == 0)
          return;

        const TSharedPtr<FJsonObject>* FrameObj;
        if (!(*Frames)[0]->TryGetObject(FrameObj)) return;

        FString ImageUrl = (*FrameObj)->GetStringField(TEXT("imageUrl"));
        if (ImageUrl.IsEmpty()) return;

        // Determine frame type for proper loading
        FString FrameType = (*FrameObj)->GetStringField(TEXT("type"));
        EGatrixFrameType LoadType = GatrixBannerParse::ParseFrameType(FrameType);

        UE_LOG(LogGatrixBannerWidget, Log,
               TEXT("EditorPreview: Loading image %s (type=%s)"), *ImageUrl, *FrameType);

        // Now download the first frame image
        FGatrixImageLoadedDelegate ImgDelegate;
        ImgDelegate.BindLambda(
            [WeakThis](bool bOk, const FGatrixImageResult& Result) {
              if (!WeakThis.IsValid()) return;
              if (!bOk || !Result.IsValid()) {
                UE_LOG(LogGatrixBannerWidget, Warning,
                       TEXT("EditorPreview: Image load failed"));
                return;
              }
              AsyncTask(ENamedThreads::GameThread, [WeakThis, Result]() {
                if (!WeakThis.IsValid()) return;
                UTexture2DDynamic* Tex = Result.Texture;
                if (Result.IsGif() && Result.GifFrames.Num() > 0) {
                  Tex = Result.GifFrames[0];
                }
                if (Tex) {
                  UE_LOG(LogGatrixBannerWidget, Log,
                         TEXT("EditorPreview: Applying texture %dx%d"),
                         Tex->SizeX, Tex->SizeY);
                  WeakThis->ApplyFrameTexture(Tex);
                }
              });
            });

        UGatrixImageLoader::Get()->LoadImage(
            ImageUrl, LoadType, ImgDelegate);
      });

  HttpReq->ProcessRequest();
}
#endif

// ==================== Widget Setup ====================

void UGatrixBannerWidget::SetupWidgetHierarchy() {
  if (CurrentImage) return; // already set up
  if (!WidgetTree) {
    UE_LOG(LogGatrixBannerWidget, Warning, TEXT("SetupWidgetHierarchy: WidgetTree is null!"));
    return;
  }

  UOverlay* Overlay = nullptr;

  if (WidgetTree->RootWidget) {
    Overlay = Cast<UOverlay>(WidgetTree->RootWidget);
    if (!Overlay) {
      WidgetTree->ForEachWidget([&](UWidget* Widget) {
        if (!Overlay) Overlay = Cast<UOverlay>(Widget);
      });
    }
    if (!Overlay) {
      UPanelWidget* RootPanel = Cast<UPanelWidget>(WidgetTree->RootWidget);
      if (RootPanel) {
        Overlay = WidgetTree->ConstructWidget<UOverlay>(UOverlay::StaticClass());
        RootPanel->AddChild(Overlay);
      }
    }
  } else {
    Overlay = WidgetTree->ConstructWidget<UOverlay>(UOverlay::StaticClass());
    WidgetTree->RootWidget = Overlay;
  }

  if (!Overlay) {
    UE_LOG(LogGatrixBannerWidget, Error, TEXT("SetupWidgetHierarchy: Failed to create Overlay!"));
    return;
  }

  // Background image (for solid color fill behind the image in Fit mode)
  BackgroundImage = WidgetTree->ConstructWidget<UImage>(UImage::StaticClass());
  if (BackgroundImage) {
    UOverlaySlot* BgSlot = Overlay->AddChildToOverlay(BackgroundImage);
    if (BgSlot) {
      BgSlot->SetHorizontalAlignment(HAlign_Fill);
      BgSlot->SetVerticalAlignment(VAlign_Fill);
    }
    BackgroundImage->SetColorAndOpacity(BackgroundColor);
    BackgroundImage->SetVisibility(
        BackgroundMode == EGatrixImageBackground::SolidColor
            ? ESlateVisibility::Visible
            : ESlateVisibility::Collapsed);
  }

  // ScaleBox wrapping the images for aspect-ratio-aware scaling
  ImageScaleBox = WidgetTree->ConstructWidget<UScaleBox>(UScaleBox::StaticClass());
  if (ImageScaleBox) {
    UOverlaySlot* ScaleSlot = Overlay->AddChildToOverlay(ImageScaleBox);
    if (ScaleSlot) {
      ScaleSlot->SetHorizontalAlignment(HAlign_Fill);
      ScaleSlot->SetVerticalAlignment(VAlign_Fill);
    }
    ApplyScaleModeToScaleBox();
  }

  // Inner overlay for crossfade (Previous + Current) inside the ScaleBox
  UOverlay* InnerOverlay = WidgetTree->ConstructWidget<UOverlay>(UOverlay::StaticClass());
  if (InnerOverlay && ImageScaleBox) {
    ImageScaleBox->AddChild(InnerOverlay);
  }

  // Previous image (for crossfade, behind current)
  PreviousImage = WidgetTree->ConstructWidget<UImage>(UImage::StaticClass());
  if (PreviousImage && InnerOverlay) {
    UOverlaySlot* PrevSlot = InnerOverlay->AddChildToOverlay(PreviousImage);
    if (PrevSlot) {
      PrevSlot->SetHorizontalAlignment(HAlign_Fill);
      PrevSlot->SetVerticalAlignment(VAlign_Fill);
    }
    PreviousImage->SetVisibility(ESlateVisibility::Hidden);
  }

  // Current image (main display)
  CurrentImage = WidgetTree->ConstructWidget<UImage>(UImage::StaticClass());
  if (CurrentImage && InnerOverlay) {
    UOverlaySlot* CurrSlot = InnerOverlay->AddChildToOverlay(CurrentImage);
    if (CurrSlot) {
      CurrSlot->SetHorizontalAlignment(HAlign_Fill);
      CurrSlot->SetVerticalAlignment(VAlign_Fill);
    }
    ShowPlaceholder();
  }

  UE_LOG(LogGatrixBannerWidget, Log,
         TEXT("SetupWidgetHierarchy: Complete. CurrentImage=%p, ScaleBox=%p, root=%p"),
         CurrentImage, ImageScaleBox, WidgetTree->RootWidget);

  // Create playback controller
  Playback = NewObject<UGatrixBannerPlayback>(this);
  Playback->OnFrameChanged.AddDynamic(this, &UGatrixBannerWidget::OnFrameChanged);
  Playback->OnSequenceChanged.AddDynamic(this, &UGatrixBannerWidget::OnSequenceChanged);
  Playback->OnFrameAction.AddDynamic(this, &UGatrixBannerWidget::OnFrameActionTriggered);
  Playback->OnPlaybackFinished.AddDynamic(this, &UGatrixBannerWidget::HandlePlaybackFinished);
}

void UGatrixBannerWidget::ApplyScaleModeToScaleBox() {
  if (!ImageScaleBox) return;

  switch (ScaleMode) {
    case EGatrixImageScaleMode::Stretch:
      ImageScaleBox->SetStretch(EStretch::Fill);
      break;
    case EGatrixImageScaleMode::Fit:
      ImageScaleBox->SetStretch(EStretch::ScaleToFit);
      break;
    case EGatrixImageScaleMode::Fill:
      ImageScaleBox->SetStretch(EStretch::ScaleToFill);
      break;
    case EGatrixImageScaleMode::MatchImage:
      ImageScaleBox->SetStretch(EStretch::UserSpecified);
      ImageScaleBox->SetUserSpecifiedScale(1.0f);
      break;
  }
}

// ==================== Public API ====================

void UGatrixBannerWidget::InitializeClient(const FString& ApiUrl,
                                           const FString& ApiToken) {
  // Ensure widget hierarchy is set up (must happen before Slate tree is built)
  SetupWidgetHierarchy();

  // Force Slate widget rebuild so the new WidgetTree root is reflected
  TSharedPtr<SWidget> SlateWidget = GetCachedWidget();
  if (!SlateWidget.IsValid()) {
    TakeWidget(); // triggers initial build with proper root
  }

  if (!BannerClient) {
    BannerClient = NewObject<UGatrixBannerClient>(this);
  }
  // Auto-add x-application-name header required by Edge auth
  TMap<FString, FString> Headers;
  Headers.Add(TEXT("x-application-name"), TEXT("app"));
  BannerClient->Initialize(ApiUrl, ApiToken, Headers);
  bClientInitialized = true;

  UE_LOG(LogGatrixBannerWidget, Log,
         TEXT("InitializeClient: currentImage=%p"),
         CurrentImage);
}

void UGatrixBannerWidget::SetExternalImage(UImage* ExternalImage) {
  if (!ExternalImage) return;

  CurrentImage = ExternalImage;

  // Hide until texture is loaded
  CurrentImage->SetVisibility(ESlateVisibility::Collapsed);

  // Initialize playback controller (since SetupWidgetHierarchy will skip)
  if (!Playback) {
    Playback = NewObject<UGatrixBannerPlayback>(this);
    Playback->OnFrameChanged.AddDynamic(this, &UGatrixBannerWidget::OnFrameChanged);
    Playback->OnSequenceChanged.AddDynamic(this, &UGatrixBannerWidget::OnSequenceChanged);
    Playback->OnFrameAction.AddDynamic(this, &UGatrixBannerWidget::OnFrameActionTriggered);
    Playback->OnPlaybackFinished.AddDynamic(this, &UGatrixBannerWidget::HandlePlaybackFinished);
  }

  UE_LOG(LogGatrixBannerWidget, Log,
         TEXT("SetExternalImage: Using external UImage %p, Playback=%p"),
         ExternalImage, Playback);
}

void UGatrixBannerWidget::LoadBanner(const FString& InBannerId) {
  if (!bClientInitialized) {
    UE_LOG(LogGatrixBannerWidget, Warning,
           TEXT("LoadBanner: Client not initialized. Call InitializeClient first."));
    OnBannerLoaded.Broadcast(false);
    return;
  }

  BannerId = InBannerId;
  CurrentBannerId = InBannerId;
  bBannerLoaded = false;
  bFirstFrameLoaded = false;

  // Check if we already have it cached
  if (BannerClient->HasCachedBanner(InBannerId)) {
    FGatrixBanner Cached = BannerClient->GetCachedBanner(InBannerId);
    OnBannerDataReceived(true, Cached);
    return;
  }

  // Fetch from API
  TWeakObjectPtr<UGatrixBannerWidget> WeakThis(this);
  BannerClient->FetchBannerById(InBannerId,
    [WeakThis](bool bSuccess, const FGatrixBanner& Banner) {
      if (WeakThis.IsValid()) {
        WeakThis->OnBannerDataReceived(bSuccess, Banner);
      }
    });
}

void UGatrixBannerWidget::LoadBannerFromData(const FGatrixBanner& BannerData) {
  CurrentBannerId = BannerData.BannerId;
  bBannerLoaded = false;
  bFirstFrameLoaded = false;
  OnBannerDataReceived(true, BannerData);
}

void UGatrixBannerWidget::Play() {
  if (Playback) Playback->Play();
}

void UGatrixBannerWidget::Pause() {
  if (Playback) Playback->Pause();
}

void UGatrixBannerWidget::Stop() {
  if (Playback) Playback->Stop();
  CleanupVideoPlayer();
}

void UGatrixBannerWidget::NextFrame() {
  if (Playback) Playback->NextFrame();
}

void UGatrixBannerWidget::PrevFrame() {
  if (Playback) Playback->PrevFrame();
}

void UGatrixBannerWidget::SetBannerPlaybackSpeed(float Speed) {
  if (Playback) Playback->SetPlaybackSpeed(Speed);
}

void UGatrixBannerWidget::SetTargetingContext(const FGatrixBannerContext& Context) {
  if (Playback) Playback->SetContext(Context);
}

bool UGatrixBannerWidget::IsPlaying() const {
  return Playback ? Playback->IsPlaying() : false;
}

int32 UGatrixBannerWidget::GetCurrentFrameIndex() const {
  return Playback ? Playback->GetCurrentFrameIndex() : 0;
}

int32 UGatrixBannerWidget::GetTotalFrameCount() const {
  return Playback ? Playback->GetFilteredFrameCount() : 0;
}

// ==================== Internal: Data Loading ====================

void UGatrixBannerWidget::OnBannerDataReceived(bool bSuccess,
                                               const FGatrixBanner& Banner) {
  if (!bSuccess || !Banner.IsValid()) {
    UE_LOG(LogGatrixBannerWidget, Warning,
           TEXT("Failed to load banner data for '%s'"), *CurrentBannerId);
    OnBannerLoaded.Broadcast(false);
    return;
  }

  CurrentBanner = Banner;

  if (Playback) {
    Playback->SetBanner(CurrentBanner);
  }

  UE_LOG(LogGatrixBannerWidget, Log,
         TEXT("Banner '%s' data loaded: %dx%d, %d sequences, %d total frames"),
         *Banner.Name, Banner.Width, Banner.Height,
         Banner.Sequences.Num(), Banner.GetTotalFrameCount());

  // Load the first frame's image
  LoadFirstFrame();
}

void UGatrixBannerWidget::LoadFirstFrame() {
  if (!Playback) return;

  FGatrixBannerFrame FirstFrame = Playback->GetCurrentFrame();
  if (FirstFrame.ImageUrl.IsEmpty()) {
    bBannerLoaded = true;
    OnBannerLoaded.Broadcast(true);
    if (bAutoPlay) Play();
    return;
  }

  // Release any previous frame source
  ReleaseCurrentFrameSource();

  TWeakObjectPtr<UGatrixBannerWidget> WeakThis(this);
  FGatrixImageLoadedDelegate Delegate;
  Delegate.BindLambda([WeakThis](bool bSuccess, const FGatrixImageResult& Result) {
    if (WeakThis.IsValid()) {
      WeakThis->OnFirstFrameLoaded(bSuccess, Result);
    }
  });

  // Acquire source from central manager (shared texture, no per-widget duplication)
  CurrentFrameSource = UGatrixImageManager::Get()->AcquireSource(
      FirstFrame.ImageUrl, FirstFrame.Type, Delegate);

  // Start prefetching upcoming frames
  PrefetchUpcomingFrames();
}

void UGatrixBannerWidget::OnFirstFrameLoaded(bool bSuccess,
                                             const FGatrixImageResult& Result) {
  bBannerLoaded = true;
  bFirstFrameLoaded = bSuccess;

  UE_LOG(LogGatrixBannerWidget, Log,
         TEXT("OnFirstFrameLoaded: success=%d, valid=%d, texture=%p, currentImage=%p"),
         bSuccess, Result.IsValid(), Result.Texture, CurrentImage);

  if (bSuccess && Result.IsValid()) {
    // Use the display texture from the shared source
    UTexture2DDynamic* DisplayTex = nullptr;
    if (CurrentFrameSource.IsValid()) {
      DisplayTex = CurrentFrameSource->GetDisplayTexture();
    } else {
      DisplayTex = Result.Texture;
    }
    if (DisplayTex) {
      ApplyFrameTexture(DisplayTex);
    }
  }

  OnBannerLoaded.Broadcast(bSuccess);

  if (bAutoPlay && bSuccess) {
    Play();
  }
}

// ==================== Internal: Frame Display ====================

void UGatrixBannerWidget::OnFrameChanged(int32 FrameIndex,
                                         const FGatrixBannerFrame& Frame) {
  ShowFrame(Frame);
  PrefetchUpcomingFrames();
}

void UGatrixBannerWidget::OnSequenceChanged(int32 SequenceIndex) {
  UE_LOG(LogGatrixBannerWidget, Verbose,
         TEXT("Sequence changed to %d"), SequenceIndex);
}

void UGatrixBannerWidget::OnFrameActionTriggered(const FGatrixFrameAction& Action) {
  OnBannerAction.Broadcast(Action);
}

void UGatrixBannerWidget::HandlePlaybackFinished() {
  OnPlaybackFinished.Broadcast();
}

void UGatrixBannerWidget::ShowFrame(const FGatrixBannerFrame& Frame) {
  // Release previous frame source
  ReleaseCurrentFrameSource();

  switch (Frame.Type) {
    case EGatrixFrameType::Mp4:
      ShowVideoFrame(Frame);
      break;
    case EGatrixFrameType::Gif:
    case EGatrixFrameType::Webp:
      ShowGifFrame(Frame);
      break;
    default:
      ShowImageFrame(Frame);
      break;
  }
}

void UGatrixBannerWidget::ShowImageFrame(const FGatrixBannerFrame& Frame) {
  CleanupVideoPlayer();

  TWeakObjectPtr<UGatrixBannerWidget> WeakThis(this);
  FGatrixBannerFrame FrameCopy = Frame;

  FGatrixImageLoadedDelegate Delegate;
  Delegate.BindLambda([WeakThis, FrameCopy](bool bSuccess,
                                            const FGatrixImageResult& Result) {
    if (!WeakThis.IsValid()) return;
    auto* Self = WeakThis.Get();

    if (bSuccess && Result.IsValid()) {
      // Get display texture from shared source
      UTexture2DDynamic* DisplayTex = nullptr;
      if (Self->CurrentFrameSource.IsValid()) {
        DisplayTex = Self->CurrentFrameSource->GetDisplayTexture();
      } else {
        DisplayTex = Result.Texture;
      }

      // Begin transition
      if (Self->bEnableTransitions &&
          FrameCopy.Transition.Type != EGatrixTransitionType::None) {
        float Dur = Self->TransitionDurationOverride > 0.0f
                        ? Self->TransitionDurationOverride
                        : FrameCopy.Transition.Duration / 1000.0f;
        Self->StartTransition(FrameCopy.Transition.Type, Dur);
      }

      if (DisplayTex) {
        Self->ApplyFrameTexture(DisplayTex);
      }

      // Apply enter effect
      if (Self->bEnableEffects &&
          FrameCopy.Effects.Enter != EGatrixFrameEffectType::None) {
        Self->StartEnterEffect(FrameCopy.Effects.Enter,
                               FrameCopy.Effects.Duration / 1000.0f);
      }
    } else {
      Self->ShowPlaceholder();
    }
  });

  // Acquire shared source from Manager
  CurrentFrameSource = UGatrixImageManager::Get()->AcquireSource(
      Frame.ImageUrl, Frame.Type, Delegate);
}

void UGatrixBannerWidget::ShowVideoFrame(const FGatrixBannerFrame& Frame) {
  // MP4 video via UMediaPlayer
  if (!VideoPlayer) {
    InitVideoPlayer();
  }

  if (VideoPlayer && !Frame.ImageUrl.IsEmpty()) {
    VideoPlayer->SetLooping(Frame.bLoop);
    VideoPlayer->OpenUrl(Frame.ImageUrl);

    // Video texture will be rendered via tick once media opens
    if (VideoTexture && CurrentImage) {
      CurrentImage->SetBrushResourceObject(VideoTexture);
      SetImageOpacity(CurrentImage, 1.0f);
    }
  }
}

void UGatrixBannerWidget::ShowGifFrame(const FGatrixBannerFrame& Frame) {
  CleanupVideoPlayer();

  TWeakObjectPtr<UGatrixBannerWidget> WeakThis(this);

  FGatrixImageLoadedDelegate Delegate;
  Delegate.BindLambda([WeakThis](bool bSuccess, const FGatrixImageResult& Result) {
    if (!WeakThis.IsValid()) return;
    auto* Self = WeakThis.Get();

    if (bSuccess && Result.IsValid()) {
      // Use shared display texture from Manager source
      UTexture2DDynamic* DisplayTex = nullptr;
      if (Self->CurrentFrameSource.IsValid()) {
        DisplayTex = Self->CurrentFrameSource->GetDisplayTexture();
      } else {
        DisplayTex = Result.Texture;
      }
      if (DisplayTex) {
        Self->ApplyFrameTexture(DisplayTex);
      }
    } else {
      Self->ShowPlaceholder();
    }
  });

  // Acquire shared source from Manager
  CurrentFrameSource = UGatrixImageManager::Get()->AcquireSource(
      Frame.ImageUrl, Frame.Type, Delegate);
}

void UGatrixBannerWidget::ApplyFrameTexture(UTexture2DDynamic* Texture) {
  if (!CurrentImage) {
    UE_LOG(LogGatrixBannerWidget, Error, TEXT("ApplyFrameTexture: CurrentImage is null!"));
    return;
  }
  if (!Texture || !Texture->IsValidLowLevel()) {
    UE_LOG(LogGatrixBannerWidget, Warning, TEXT("ApplyFrameTexture: Invalid texture"));
    return;
  }

  CurrentImage->SetColorAndOpacity(FLinearColor::White);
  CurrentImage->SetBrushFromTextureDynamic(Texture, true);
  CurrentImage->SetVisibility(ESlateVisibility::Visible);
  SetImageOpacity(CurrentImage, 1.0f);
  ResetImageTransform(CurrentImage);

  // Ensure widget itself is visible
  SetVisibility(ESlateVisibility::SelfHitTestInvisible);

  // Update background visibility
  if (BackgroundImage) {
    if (BackgroundMode == EGatrixImageBackground::SolidColor) {
      BackgroundImage->SetColorAndOpacity(BackgroundColor);
      BackgroundImage->SetVisibility(ESlateVisibility::Visible);
    } else {
      BackgroundImage->SetVisibility(ESlateVisibility::Collapsed);
    }
  }

  // For MatchImage mode, resize the widget to image dimensions
  if (ScaleMode == EGatrixImageScaleMode::MatchImage) {
    SetDesiredSizeInViewport(FVector2D(Texture->SizeX, Texture->SizeY));
  }

  // Refresh scale box stretch mode
  ApplyScaleModeToScaleBox();
}

void UGatrixBannerWidget::ShowPlaceholder() {
  if (!CurrentImage) return;

  CurrentImage->SetBrushFromTexture(nullptr);
  CurrentImage->SetColorAndOpacity(PlaceholderColor);
}

// ==================== Transition Animation ====================

void UGatrixBannerWidget::StartTransition(EGatrixTransitionType Type,
                                          float Duration) {
  if (Type == EGatrixTransitionType::None || Duration <= 0.0f) return;

  ActiveTransitionType = Type;
  TransitionDuration = FMath::Max(0.05f, Duration);
  TransitionAlpha = 0.0f;
  bTransitioning = true;

  // Swap current to previous for crossfade
  if (Type == EGatrixTransitionType::CrossFade ||
      Type == EGatrixTransitionType::Fade) {
    if (PreviousImage && CurrentImage) {
      PreviousImage->SetBrush(CurrentImage->Brush);
      PreviousImage->SetVisibility(ESlateVisibility::Visible);
      SetImageOpacity(PreviousImage, 1.0f);
      SetImageOpacity(CurrentImage, 0.0f);
    }
  }
}

void UGatrixBannerWidget::UpdateTransition(float DeltaTime) {
  if (!bTransitioning) return;

  TransitionAlpha += DeltaTime / TransitionDuration;
  TransitionAlpha = FMath::Clamp(TransitionAlpha, 0.0f, 1.0f);

  // Ease-in-out curve
  float T = TransitionAlpha;
  float EasedT = T * T * (3.0f - 2.0f * T); // smoothstep

  switch (ActiveTransitionType) {
    case EGatrixTransitionType::Fade:
      SetImageOpacity(CurrentImage, EasedT);
      SetImageOpacity(PreviousImage, 1.0f - EasedT);
      break;

    case EGatrixTransitionType::CrossFade:
      SetImageOpacity(CurrentImage, EasedT);
      SetImageOpacity(PreviousImage, 1.0f - EasedT);
      break;

    case EGatrixTransitionType::Slide: {
      float SlotWidth = CurrentImage ? CurrentImage->GetDesiredSize().X : 300.0f;
      float Offset = SlotWidth * (1.0f - EasedT);
      SetImageTranslation(CurrentImage, FVector2D(Offset, 0.0f));
      SetImageTranslation(PreviousImage, FVector2D(-SlotWidth * EasedT, 0.0f));
      break;
    }

    default:
      break;
  }

  if (TransitionAlpha >= 1.0f) {
    FinishTransition();
  }
}

void UGatrixBannerWidget::FinishTransition() {
  bTransitioning = false;
  ActiveTransitionType = EGatrixTransitionType::None;

  SetImageOpacity(CurrentImage, 1.0f);
  ResetImageTransform(CurrentImage);

  if (PreviousImage) {
    PreviousImage->SetVisibility(ESlateVisibility::Hidden);
    SetImageOpacity(PreviousImage, 0.0f);
    ResetImageTransform(PreviousImage);
  }
}

// ==================== Effect Animation ====================

void UGatrixBannerWidget::StartEnterEffect(EGatrixFrameEffectType Type,
                                           float Duration) {
  if (Type == EGatrixFrameEffectType::None || Duration <= 0.0f) return;

  ActiveEnterEffect = Type;
  EffectDuration = FMath::Max(0.05f, Duration);
  EffectProgress = 0.0f;
  bEffectActive = true;
}

void UGatrixBannerWidget::UpdateEffect(float DeltaTime) {
  if (!bEffectActive || !CurrentImage) return;

  EffectProgress += DeltaTime / EffectDuration;
  EffectProgress = FMath::Clamp(EffectProgress, 0.0f, 1.0f);

  float T = EffectProgress;
  float EasedT = T * T * (3.0f - 2.0f * T);

  switch (ActiveEnterEffect) {
    case EGatrixFrameEffectType::FadeIn:
      SetImageOpacity(CurrentImage, EasedT);
      break;

    case EGatrixFrameEffectType::FadeOut:
      SetImageOpacity(CurrentImage, 1.0f - EasedT);
      break;

    case EGatrixFrameEffectType::SlideLeft: {
      float W = CurrentImage->GetDesiredSize().X;
      SetImageTranslation(CurrentImage, FVector2D(W * (1.0f - EasedT), 0.0f));
      break;
    }
    case EGatrixFrameEffectType::SlideRight: {
      float W = CurrentImage->GetDesiredSize().X;
      SetImageTranslation(CurrentImage, FVector2D(-W * (1.0f - EasedT), 0.0f));
      break;
    }
    case EGatrixFrameEffectType::SlideUp: {
      float H = CurrentImage->GetDesiredSize().Y;
      SetImageTranslation(CurrentImage, FVector2D(0.0f, H * (1.0f - EasedT)));
      break;
    }
    case EGatrixFrameEffectType::SlideDown: {
      float H = CurrentImage->GetDesiredSize().Y;
      SetImageTranslation(CurrentImage, FVector2D(0.0f, -H * (1.0f - EasedT)));
      break;
    }

    case EGatrixFrameEffectType::ZoomIn: {
      float S = FMath::Lerp(0.5f, 1.0f, EasedT);
      SetImageScale(CurrentImage, FVector2D(S, S));
      SetImageOpacity(CurrentImage, EasedT);
      break;
    }
    case EGatrixFrameEffectType::ZoomOut: {
      float S = FMath::Lerp(1.5f, 1.0f, EasedT);
      SetImageScale(CurrentImage, FVector2D(S, S));
      SetImageOpacity(CurrentImage, EasedT);
      break;
    }

    case EGatrixFrameEffectType::Shake: {
      float Intensity = 5.0f * (1.0f - EasedT);
      float OffX = FMath::FRandRange(-Intensity, Intensity);
      float OffY = FMath::FRandRange(-Intensity, Intensity);
      SetImageTranslation(CurrentImage, FVector2D(OffX, OffY));
      break;
    }

    default:
      break;
  }

  if (EffectProgress >= 1.0f) {
    FinishEffect();
  }
}

void UGatrixBannerWidget::FinishEffect() {
  bEffectActive = false;
  ActiveEnterEffect = EGatrixFrameEffectType::None;
  ResetImageTransform(CurrentImage);
  SetImageOpacity(CurrentImage, 1.0f);
}

// ==================== Prefetch ====================

void UGatrixBannerWidget::PrefetchUpcomingFrames() {
  if (!Playback || PrefetchCount <= 0) return;

  TArray<FString> Urls = Playback->GetUpcomingImageUrls(PrefetchCount);
  if (Urls.Num() > 0) {
    UGatrixImageManager::Get()->Prefetch(Urls);
  }
}

void UGatrixBannerWidget::ReleaseCurrentFrameSource() {
  if (CurrentFrameSource.IsValid()) {
    UGatrixImageManager::Get()->ReleaseSource(CurrentFrameSource);
  }
}

// ==================== Video ====================

void UGatrixBannerWidget::InitVideoPlayer() {
  if (VideoPlayer) return;

  VideoPlayer = NewObject<UMediaPlayer>(this);
  VideoPlayer->SetLooping(false);

  VideoTexture = NewObject<UMediaTexture>(this);
  VideoTexture->SetMediaPlayer(VideoPlayer);
  VideoTexture->UpdateResource();
}

void UGatrixBannerWidget::CleanupVideoPlayer() {
  if (VideoPlayer) {
    VideoPlayer->Close();
  }
}

// ==================== Transform Helpers ====================

void UGatrixBannerWidget::SetImageOpacity(UImage* Image, float Opacity) {
  if (!Image) return;
  Image->SetRenderOpacity(FMath::Clamp(Opacity, 0.0f, 1.0f));
}

void UGatrixBannerWidget::SetImageTranslation(UImage* Image, FVector2D Translation) {
  if (!Image) return;
  FWidgetTransform Transform = Image->RenderTransform;
  Transform.Translation = Translation;
  Image->SetRenderTransform(Transform);
}

void UGatrixBannerWidget::SetImageScale(UImage* Image, FVector2D Scale) {
  if (!Image) return;
  FWidgetTransform Transform = Image->RenderTransform;
  Transform.Scale = Scale;
  Image->SetRenderTransform(Transform);
}

void UGatrixBannerWidget::ResetImageTransform(UImage* Image) {
  if (!Image) return;
  FWidgetTransform DefaultTransform;
  Image->SetRenderTransform(DefaultTransform);
}
