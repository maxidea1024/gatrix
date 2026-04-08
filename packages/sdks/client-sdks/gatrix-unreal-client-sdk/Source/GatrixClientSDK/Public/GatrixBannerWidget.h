// Copyright Gatrix. All Rights Reserved.
// UMG widget that displays and animates Gatrix banners

#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "Tickable.h"
#include "Components/Image.h"
#include "Components/ScaleBox.h"
#include "GatrixBannerTypes.h"
#include "GatrixImageScaleMode.h"
#include "GatrixBannerClient.h"
#include "GatrixBannerPlayback.h"
#include "GatrixImageLoader.h"
#include "GatrixImageSource.h"
#include "MediaPlayer.h"
#include "MediaTexture.h"
#include "GatrixBannerWidget.generated.h"

/** Delegate fired when the banner finishes loading */
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FGatrixOnBannerWidgetLoaded, bool, bSuccess);

/** Delegate fired when a frame action is triggered (click/tap) */
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FGatrixOnBannerWidgetAction,
                                            const FGatrixFrameAction&, Action);

/**
 * UMG widget for displaying Gatrix banners.
 *
 * Handles:
 * - Async banner data fetch from API
 * - Async image download with disk/memory caching
 * - Frame playback with transitions and effects
 * - MP4 video playback via UMediaPlayer
 * - GIF animation (multi-frame)
 * - Loading placeholder during CDN fetch
 * - Prefetching upcoming frames
 *
 * All operations are fully async — never blocks the game thread.
 *
 * Usage (Blueprint):
 *   1. Add GatrixBannerWidget to your UMG layout
 *   2. Call LoadBanner("banner-id")
 *   3. Call Play() (or set bAutoPlay=true)
 *
 * Usage (C++):
 *   auto* BannerWidget = CreateWidget<UGatrixBannerWidget>(GetWorld());
 *   BannerWidget->LoadBanner("banner-id");
 */
UCLASS(Blueprintable, BlueprintType)
class GATRIXCLIENTSDK_API UGatrixBannerWidget : public UUserWidget, public FTickableGameObject {
  GENERATED_BODY()

public:
  // FTickableGameObject interface
  virtual void Tick(float DeltaTime) override;
  virtual bool IsTickable() const override { return !IsTemplate(); }
  virtual TStatId GetStatId() const override { RETURN_QUICK_DECLARE_CYCLE_STAT(UGatrixBannerWidget, STATGROUP_Tickables); }

public:
  // ==================== Configuration ====================

  /** Banner ID to load. Set this in the editor or at runtime. */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|Banner",
            meta = (ExposeOnSpawn = "true"))
  FString BannerId;

  /** Auto-play after banner data and first frame are loaded */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|Banner")
  bool bAutoPlay = true;

  /** Number of upcoming frames to prefetch */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|Banner")
  int32 PrefetchCount = 3;

  /** Placeholder color shown while loading */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|Banner")
  FLinearColor PlaceholderColor = FLinearColor(0.1f, 0.1f, 0.1f, 1.0f);

  /** Enable shimmer animation while loading (pulsing glow effect) */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|Banner")
  bool bEnableShimmer = true;

  /** Shimmer highlight color (the bright phase of the pulse) */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|Banner")
  FLinearColor ShimmerHighlightColor = FLinearColor(0.22f, 0.22f, 0.25f, 1.0f);

  /** Shimmer pulse speed (cycles per second) */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|Banner",
            meta = (ClampMin = "0.5", ClampMax = "5.0"))
  float ShimmerSpeed = 1.5f;

  /** Enable transition effects between frames */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|Banner")
  bool bEnableTransitions = true;

  /** Enable enter/exit effects on frames */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|Banner")
  bool bEnableEffects = true;

  /** Default transition duration override in seconds (0 = use frame data) */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|Banner")
  float TransitionDurationOverride = 0.0f;

  /** How the image is scaled within the widget bounds */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|Banner|Display")
  EGatrixImageScaleMode ScaleMode = EGatrixImageScaleMode::Fit;

  /** How to treat empty space when image doesn't fill the widget (Fit mode) */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|Banner|Display")
  EGatrixImageBackground BackgroundMode = EGatrixImageBackground::SolidColor;

  /** Color used to fill empty space (when BackgroundMode is SolidColor) */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|Banner|Display")
  FLinearColor BackgroundColor = FLinearColor(0.0f, 0.0f, 0.0f, 1.0f);

  // ==================== Blueprint API ====================

  /**
   * Load a banner by ID from the Gatrix API.
   * Automatically downloads and caches the first frame's image.
   */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Banner")
  void LoadBanner(const FString& InBannerId);

  /**
   * Load a banner from pre-fetched data.
   * Useful when banners are already fetched via UGatrixBannerClient.
   */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Banner")
  void LoadBannerFromData(const FGatrixBanner& BannerData);

  /** Start playback */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Banner")
  void Play();

  /** Pause playback */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Banner")
  void Pause();

  /** Stop playback and reset to first frame */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Banner")
  void Stop();

  /** Advance to next frame manually */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Banner")
  void NextFrame();

  /** Go to previous frame manually */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Banner")
  void PrevFrame();

  /** Set playback speed multiplier */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Banner")
  void SetBannerPlaybackSpeed(float Speed);

  /** Set the targeting context for frame filtering */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Banner")
  void SetTargetingContext(const FGatrixBannerContext& Context);

  /** Initialize the banner client connection (call once) */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Banner")
  void InitializeClient(const FString& ApiUrl, const FString& ApiToken);

  /**
   * Use an external UImage for rendering instead of the internal widget tree.
   * This allows the banner to render into any UImage already in the UI hierarchy.
   * Call this before LoadBanner().
   */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Banner")
  void SetExternalImage(UImage* ExternalImage);

  // ==================== State Queries ====================

  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Banner")
  bool IsLoaded() const { return bBannerLoaded; }

  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Banner")
  bool IsPlaying() const;

  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Banner")
  int32 GetCurrentFrameIndex() const;

  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Banner")
  int32 GetTotalFrameCount() const;

  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Banner")
  FString GetBannerId() const { return CurrentBannerId; }

  // ==================== Events ====================

  /** Fires when the banner finishes loading (data + first frame image) */
  UPROPERTY(BlueprintAssignable, Category = "Gatrix|Banner|Events")
  FGatrixOnBannerWidgetLoaded OnBannerLoaded;

  /** Fires when a frame click/tap action is triggered */
  UPROPERTY(BlueprintAssignable, Category = "Gatrix|Banner|Events")
  FGatrixOnBannerWidgetAction OnBannerAction;

  /** Fires when playback finishes (once mode) */
  UPROPERTY(BlueprintAssignable, Category = "Gatrix|Banner|Events")
  FGatrixOnPlaybackFinished OnPlaybackFinished;

protected:
  virtual TSharedRef<SWidget> RebuildWidget() override;
  virtual void NativeConstruct() override;
  virtual void NativeDestruct() override;
  virtual void NativeTick(const FGeometry& MyGeometry, float InDeltaTime) override;
  virtual FReply NativeOnMouseButtonDown(const FGeometry& InGeometry,
                                         const FPointerEvent& InMouseEvent) override;
  virtual void SynchronizeProperties() override;

private:
  // Internal components (created dynamically)
  UPROPERTY()
  UImage* CurrentImage = nullptr;

  UPROPERTY()
  UImage* PreviousImage = nullptr; // For crossfade transitions

  UPROPERTY()
  UImage* BackgroundImage = nullptr; // Solid color fill behind image

  UPROPERTY()
  UScaleBox* ImageScaleBox = nullptr; // Controls image scaling mode

  UPROPERTY()
  UGatrixBannerClient* BannerClient = nullptr;

  UPROPERTY()
  UGatrixBannerPlayback* Playback = nullptr;

  UPROPERTY()
  UMediaPlayer* VideoPlayer = nullptr;

  UPROPERTY()
  UMediaTexture* VideoTexture = nullptr;

  // State
  FString CurrentBannerId;
  FGatrixBanner CurrentBanner;
  bool bBannerLoaded = false;
  bool bFirstFrameLoaded = false;
  bool bClientInitialized = false;
  bool bShowingShimmer = false;
  float ShimmerAccumulator = 0.0f;

  // Transition animation state
  float TransitionAlpha = 1.0f;
  float TransitionDuration = 0.3f;
  bool bTransitioning = false;
  EGatrixTransitionType ActiveTransitionType = EGatrixTransitionType::None;

  // Effect animation state
  float EffectProgress = 0.0f;
  float EffectDuration = 0.3f;
  bool bEffectActive = false;
  EGatrixFrameEffectType ActiveEnterEffect = EGatrixFrameEffectType::None;

  // GIF playback: shared source from Manager (no per-widget texture arrays)
  TSharedPtr<FGatrixImageSource> CurrentFrameSource;

  // Last texture pointer applied to UImage (to detect frame changes for per-frame textures)
  UTexture2DDynamic* LastDisplayedTexture = nullptr;

  // ==================== Internal Methods ====================

  void SetupWidgetHierarchy();
  void ApplyScaleModeToScaleBox();
  void OnBannerDataReceived(bool bSuccess, const FGatrixBanner& Banner);
  void LoadFirstFrame();
  void OnFirstFrameLoaded(bool bSuccess, const FGatrixImageResult& Result);

  UFUNCTION()
  void OnFrameChanged(int32 FrameIndex, const FGatrixBannerFrame& Frame);

  UFUNCTION()
  void OnSequenceChanged(int32 SequenceIndex);

  UFUNCTION()
  void OnFrameActionTriggered(const FGatrixFrameAction& Action);

  UFUNCTION()
  void HandlePlaybackFinished();

  void ShowFrame(const FGatrixBannerFrame& Frame);
  void ShowImageFrame(const FGatrixBannerFrame& Frame);
  void ShowVideoFrame(const FGatrixBannerFrame& Frame);
  void ShowGifFrame(const FGatrixBannerFrame& Frame);

  void ApplyFrameTexture(UTexture2DDynamic* Texture);
  void ShowPlaceholder();

  // Transition helpers
  void StartTransition(EGatrixTransitionType Type, float Duration);
  void UpdateTransition(float DeltaTime);
  void FinishTransition();

  // Effect helpers
  void StartEnterEffect(EGatrixFrameEffectType Type, float Duration);
  void UpdateEffect(float DeltaTime);
  void FinishEffect();

  // Prefetch (delegates to UGatrixImageManager)
  void PrefetchUpcomingFrames();

  // Source management
  void ReleaseCurrentFrameSource();

  // Video
  void InitVideoPlayer();
  void CleanupVideoPlayer();

  void SetImageOpacity(UImage* Image, float Opacity);
  void SetImageTranslation(UImage* Image, FVector2D Translation);
  void SetImageScale(UImage* Image, FVector2D Scale);
  void ResetImageTransform(UImage* Image);

  // Editor preview
  FString LastSyncedBannerId;
#if WITH_EDITOR
  bool bEditorPreviewLoading = false;
  void FetchEditorPreview();
#endif
};
