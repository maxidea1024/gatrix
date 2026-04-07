// Copyright Gatrix. All Rights Reserved.
// Simple web image widget — set a URL and it auto-downloads, caches, and animates.

#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "Tickable.h"
#include "Components/Image.h"
#include "Components/ScaleBox.h"
#include "Engine/Texture2DDynamic.h"
#include "GatrixImageLoader.h"
#include "GatrixImageScaleMode.h"
#include "GatrixWebImage.generated.h"

/**
 * A lightweight UMG widget that displays an image from a URL.
 *
 * Features:
 * - Async download with disk/memory caching
 * - Auto-detect format from file header (PNG, JPG, GIF, WebP)
 * - Animated GIF / animated WebP playback
 * - Blueprint-friendly: just set ImageUrl and it works
 */
UCLASS(Blueprintable, BlueprintType)
class GATRIXCLIENTSDK_API UGatrixWebImage : public UUserWidget, public FTickableGameObject {
  GENERATED_BODY()

public:
  // ==================== FTickableGameObject ====================
  virtual void Tick(float DeltaTime) override;
  virtual bool IsTickable() const override { return bIsAnimating && !IsTemplate(); }
  virtual TStatId GetStatId() const override {
    RETURN_QUICK_DECLARE_CYCLE_STAT(UGatrixWebImage, STATGROUP_Tickables);
  }

  // ==================== Configuration ====================

  /** The image URL to display. Setting this triggers download. */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|WebImage",
            meta = (ExposeOnSpawn = "true"))
  FString ImageUrl;

  /** Placeholder color shown while loading */
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Gatrix|WebImage")
  FLinearColor PlaceholderColor = FLinearColor(0.1f, 0.1f, 0.1f, 1.0f);

  /** Whether to loop animated images (GIF/WebP) */
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
  bool IsAnimated() const { return AnimFrames.Num() > 1; }

  /** Get the image dimensions (0,0 if not loaded) */
  UFUNCTION(BlueprintPure, Category = "Gatrix|WebImage")
  FVector2D GetImageSize() const { return FVector2D(ImageWidth, ImageHeight); }

  /** Inject an external UImage for rendering (used by Lua binding) */
  void SetExternalImage(UImage* ExternalImg);

protected:
  virtual TSharedRef<SWidget> RebuildWidget() override;
  virtual void NativeConstruct() override;
  virtual void NativeDestruct() override;
  virtual void SynchronizeProperties() override;

private:
  void SetupWidgetHierarchy();
  void ApplyScaleModeToScaleBox();
  void StartDownload();
  void OnImageDecoded(const FGatrixImageResult& Result);
  void BuildAnimFrameTextures(const FGatrixImageResult& Result);
  void ApplyTexture(UTexture2DDynamic* Texture);
  void ShowPlaceholder();

  // UMG widgets (created dynamically via WidgetTree)
  UPROPERTY()
  UImage* DisplayImage = nullptr;

  UPROPERTY()
  UImage* BackgroundImage = nullptr;

  UPROPERTY()
  UScaleBox* ImageScaleBox = nullptr;

  /** Animation state */
  TArray<UTexture2DDynamic*> AnimFrames;
  TArray<int32> AnimDelays; // ms per frame
  int32 CurrentAnimFrame = 0;
  float AnimAccumulator = 0.0f;
  bool bIsAnimating = false;

  /** Loading state */
  bool bIsLoading = false;
  bool bIsLoaded = false;
  int32 ImageWidth = 0;
  int32 ImageHeight = 0;

  /** Current URL being loaded (to detect changes) */
  FString LoadedUrl;

  /** Editor preview: last synced URL to avoid redundant downloads */
  FString LastSyncedUrl;
};

