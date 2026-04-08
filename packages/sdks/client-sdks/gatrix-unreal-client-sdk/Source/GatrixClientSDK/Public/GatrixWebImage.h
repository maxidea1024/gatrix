// Copyright Gatrix. All Rights Reserved.
// Simple web image widget — set a URL and it auto-downloads, caches, and animates.

#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "Components/Image.h"
#include "Components/ScaleBox.h"
#include "Engine/Texture2DDynamic.h"
#include "GatrixImageLoader.h"
#include "GatrixImageSource.h"
#include "GatrixImageScaleMode.h"
#include "GatrixWebImage.generated.h"

// Forward declaration
class UGatrixImageManager;

/**
 * A lightweight UMG widget that displays an image from a URL.
 *
 * Features:
 * - Async download with disk/memory caching via central UGatrixImageManager
 * - Auto-detect format from file header (PNG, JPG, GIF, WebP)
 * - Animated GIF / animated WebP playback (shared across consumers)
 * - Blueprint-friendly: just set ImageUrl and it works
 *
 * Memory model:
 * - Holds a TSharedPtr<FGatrixImageSource> from the central manager
 * - No per-widget texture arrays — all textures are shared
 * - Manager updates the shared texture; widget just displays it
 */
UCLASS(Blueprintable, BlueprintType)
class GATRIXCLIENTSDK_API UGatrixWebImage : public UUserWidget {
  GENERATED_BODY()

public:
  // ==================== Configuration ====================

  /** The image URL to display. Setting this triggers download. */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|WebImage",
            meta = (ExposeOnSpawn = "true"))
  FString ImageUrl;

  /** Placeholder color shown while loading */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|WebImage")
  FLinearColor PlaceholderColor = FLinearColor(0.1f, 0.1f, 0.1f, 1.0f);

  /** Enable shimmer animation while loading (pulsing glow effect) */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|WebImage")
  bool bEnableShimmer = true;

  /** Shimmer highlight color (the bright phase of the pulse) */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|WebImage")
  FLinearColor ShimmerHighlightColor = FLinearColor(0.22f, 0.22f, 0.25f, 1.0f);

  /** Shimmer pulse speed (cycles per second) */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|WebImage",
            meta = (ClampMin = "0.5", ClampMax = "5.0"))
  float ShimmerSpeed = 1.5f;

  /** Whether to loop animated images (GIF/WebP) — reserved for future independent playback */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|WebImage")
  bool bLoopAnimation = true;

  /** How the image is scaled within the widget bounds */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|WebImage|Display")
  EGatrixImageScaleMode ScaleMode = EGatrixImageScaleMode::Fit;

  /** How to treat empty space when image doesn't fill the widget (Fit mode) */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|WebImage|Display")
  EGatrixImageBackground BackgroundMode = EGatrixImageBackground::SolidColor;

  /** Color used to fill empty space (when BackgroundMode is SolidColor) */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|WebImage|Display")
  FLinearColor BackgroundColor = FLinearColor(0.0f, 0.0f, 0.0f, 1.0f);

  // ==================== Blueprint API ====================

  /** Set the image URL and start downloading */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|WebImage")
  void SetImageUrl(const FString& Url);

  /** Clear the current image */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|WebImage")
  void ClearImage();

  /** Is the image currently loading? */
  UFUNCTION(BlueprintPure, Category = "Gatrix|WebImage")
  bool IsLoading() const { return bIsLoading; }

  /** Is the image loaded and displayed? */
  UFUNCTION(BlueprintPure, Category = "Gatrix|WebImage")
  bool IsImageLoaded() const { return bIsLoaded; }

  /** Is the image animated (GIF/WebP)? */
  UFUNCTION(BlueprintPure, Category = "Gatrix|WebImage")
  bool IsAnimated() const;

  /** Get the image dimensions (0,0 if not loaded) */
  UFUNCTION(BlueprintPure, Category = "Gatrix|WebImage")
  FVector2D GetImageSize() const { return FVector2D(ImageWidth, ImageHeight); }

  /** Inject an external UImage for rendering (used by Lua binding) */
  void SetExternalImage(UImage* ExternalImg);

protected:
  virtual TSharedRef<SWidget> RebuildWidget() override;
  virtual void NativeConstruct() override;
  virtual void NativeDestruct() override;
  virtual void NativeTick(const FGeometry& MyGeometry, float InDeltaTime) override;
  virtual void SynchronizeProperties() override;

private:
  void SetupWidgetHierarchy();
  void ApplyScaleModeToScaleBox();
  void StartDownload();
  void OnSourceReady(bool bSuccess, const FGatrixImageResult& Result);
  void ApplyTexture(UTexture2DDynamic* Texture);
  void ShowPlaceholder();
  void ReleaseCurrentSource();

  // UMG widgets (created dynamically via WidgetTree)
  UPROPERTY()
  UImage* DisplayImage = nullptr;

  UPROPERTY()
  UImage* BackgroundImage = nullptr;

  UPROPERTY()
  UScaleBox* ImageScaleBox = nullptr;

  /** Shared image source from UGatrixImageManager.
   *  No per-widget texture duplication — all consumers share this source. */
  TSharedPtr<FGatrixImageSource> ImageSource;

  /** Loading state */
  bool bIsLoading = false;
  bool bIsLoaded = false;
  int32 ImageWidth = 0;
  int32 ImageHeight = 0;

  /** Current URL being loaded (to detect changes) */
  FString LoadedUrl;

  /** Last texture pointer applied to UImage (to detect frame changes) */
  UTexture2DDynamic* LastDisplayedTexture = nullptr;

  /** Shimmer animation accumulator */
  float ShimmerAccumulator = 0.0f;

  /** Editor preview: last synced URL to avoid redundant downloads */
  FString LastSyncedUrl;
};
