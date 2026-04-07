// Copyright Gatrix. All Rights Reserved.

#include "GatrixWebImage.h"
#include "Components/Overlay.h"
#include "Components/OverlaySlot.h"
#include "Components/ScaleBox.h"
#include "Blueprint/WidgetTree.h"
#include "Engine/Texture2DDynamic.h"
#include "Async/Async.h"

DEFINE_LOG_CATEGORY_STATIC(LogGatrixWebImage, Log, All);

// ==================== FTickableGameObject ====================

void UGatrixWebImage::Tick(float DeltaTime) {
  if (!bIsAnimating || AnimFrames.Num() <= 1) return;

  AnimAccumulator += DeltaTime;
  float DelaySeconds = AnimDelays.IsValidIndex(CurrentAnimFrame)
                           ? AnimDelays[CurrentAnimFrame] / 1000.0f
                           : 0.1f;

  if (AnimAccumulator >= DelaySeconds) {
    AnimAccumulator -= DelaySeconds;
    CurrentAnimFrame = (CurrentAnimFrame + 1) % AnimFrames.Num();

    if (!bLoopAnimation && CurrentAnimFrame == 0) {
      bIsAnimating = false;
      return;
    }

    if (AnimFrames[CurrentAnimFrame]) {
      ApplyTexture(AnimFrames[CurrentAnimFrame]);
    }
  }
}

// ==================== Lifecycle ====================

TSharedRef<SWidget> UGatrixWebImage::RebuildWidget() {
  SetupWidgetHierarchy();
  return Super::RebuildWidget();
}

void UGatrixWebImage::SetupWidgetHierarchy() {
  if (DisplayImage) return; // already set up
  if (!WidgetTree) return;

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

  if (!Overlay) return;

  // Background image (for solid color fill behind the image)
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

  // ScaleBox for aspect-ratio-aware scaling
  ImageScaleBox = WidgetTree->ConstructWidget<UScaleBox>(UScaleBox::StaticClass());
  if (ImageScaleBox) {
    UOverlaySlot* ScaleSlot = Overlay->AddChildToOverlay(ImageScaleBox);
    if (ScaleSlot) {
      ScaleSlot->SetHorizontalAlignment(HAlign_Fill);
      ScaleSlot->SetVerticalAlignment(VAlign_Fill);
    }
    ApplyScaleModeToScaleBox();
  }

  // Display image inside the ScaleBox
  DisplayImage = WidgetTree->ConstructWidget<UImage>(UImage::StaticClass());
  if (DisplayImage && ImageScaleBox) {
    ImageScaleBox->AddChild(DisplayImage);
    ShowPlaceholder();
  }
}

void UGatrixWebImage::ApplyScaleModeToScaleBox() {
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

void UGatrixWebImage::SynchronizeProperties() {
  Super::SynchronizeProperties();

  // Editor design-time preview: download image when URL changes
  if (IsDesignTime() && !ImageUrl.IsEmpty() && ImageUrl != LastSyncedUrl) {
    LastSyncedUrl = ImageUrl;
    StartDownload();
  }
}

void UGatrixWebImage::NativeConstruct() {
  Super::NativeConstruct();

  UE_LOG(LogGatrixWebImage, Log,
         TEXT("NativeConstruct: ImageUrl='%s', DisplayImage=%p"),
         *ImageUrl, DisplayImage);

  // If ImageUrl was set before construction (e.g. via ExposeOnSpawn)
  if (!ImageUrl.IsEmpty() && LoadedUrl != ImageUrl) {
    StartDownload();
  }
}

void UGatrixWebImage::NativeDestruct() {
  bIsAnimating = false;
  AnimFrames.Empty();
  AnimDelays.Empty();
  Super::NativeDestruct();
}

// ==================== Public API ====================

void UGatrixWebImage::SetImageUrl(const FString& Url) {
  if (Url == LoadedUrl && bIsLoaded) return;

  ImageUrl = Url;

  if (Url.IsEmpty()) {
    ClearImage();
    return;
  }

  StartDownload();
}

void UGatrixWebImage::ClearImage() {
  bIsAnimating = false;
  bIsLoading = false;
  bIsLoaded = false;
  AnimFrames.Empty();
  AnimDelays.Empty();
  CurrentAnimFrame = 0;
  AnimAccumulator = 0.0f;
  ImageWidth = 0;
  ImageHeight = 0;
  LoadedUrl.Empty();
  ImageUrl.Empty();

  ShowPlaceholder();
}

void UGatrixWebImage::SetExternalImage(UImage* ExternalImg) {
  DisplayImage = ExternalImg;
}

// ==================== Internal ====================

void UGatrixWebImage::ApplyTexture(UTexture2DDynamic* Texture) {
  if (!Texture) return;

  if (DisplayImage) {
    DisplayImage->SetBrushFromTextureDynamic(Texture, true);
    DisplayImage->SetColorAndOpacity(FLinearColor::White);
    DisplayImage->SetVisibility(ESlateVisibility::Visible);
  }

  // Update background
  if (BackgroundImage) {
    if (BackgroundMode == EGatrixImageBackground::SolidColor) {
      BackgroundImage->SetColorAndOpacity(BackgroundColor);
      BackgroundImage->SetVisibility(ESlateVisibility::Visible);
    } else {
      BackgroundImage->SetVisibility(ESlateVisibility::Collapsed);
    }
  }

  // For MatchImage mode, resize to image dimensions
  if (ScaleMode == EGatrixImageScaleMode::MatchImage) {
    SetDesiredSizeInViewport(FVector2D(Texture->SizeX, Texture->SizeY));
  }

  ApplyScaleModeToScaleBox();
  SetVisibility(ESlateVisibility::SelfHitTestInvisible);
}

void UGatrixWebImage::ShowPlaceholder() {
  if (!DisplayImage) return;
  DisplayImage->SetBrushFromTexture(nullptr);
  DisplayImage->SetColorAndOpacity(PlaceholderColor);
}

void UGatrixWebImage::StartDownload() {
  if (ImageUrl.IsEmpty()) return;
  if (!UGatrixImageLoader::Get()) {
    UE_LOG(LogGatrixWebImage, Error, TEXT("ImageLoader not available"));
    return;
  }

  bIsLoading = true;
  bIsLoaded = false;
  bIsAnimating = false;
  AnimFrames.Empty();
  AnimDelays.Empty();
  CurrentAnimFrame = 0;
  AnimAccumulator = 0.0f;
  LoadedUrl = ImageUrl;

  UE_LOG(LogGatrixWebImage, Log, TEXT("StartDownload: %s"), *ImageUrl);

  TWeakObjectPtr<UGatrixWebImage> WeakThis(this);
  FGatrixImageLoadedDelegate Delegate;
  Delegate.BindLambda([WeakThis](bool bSuccess, const FGatrixImageResult& Result) {
    if (!WeakThis.IsValid()) return;
    auto* Self = WeakThis.Get();
    Self->bIsLoading = false;

    if (bSuccess && Result.IsValid()) {
      Self->OnImageDecoded(Result);
    } else {
      UE_LOG(LogGatrixWebImage, Warning, TEXT("Failed to load: %s"),
             *Self->LoadedUrl);
    }
  });

  UGatrixImageLoader::Get()->LoadImage(ImageUrl, EGatrixFrameType::Png, Delegate);
}

void UGatrixWebImage::OnImageDecoded(const FGatrixImageResult& Result) {
  bIsLoaded = true;

  if (Result.IsGif()) {
    BuildAnimFrameTextures(Result);

    if (AnimFrames.Num() > 0) {
      ApplyTexture(AnimFrames[0]);

      if (AnimFrames.Num() > 1) {
        bIsAnimating = true;
        CurrentAnimFrame = 0;
        AnimAccumulator = 0.0f;
      }
    }

    UE_LOG(LogGatrixWebImage, Log,
           TEXT("Loaded animated: %s (%d frames, %dx%d)"),
           *LoadedUrl, AnimFrames.Num(), ImageWidth, ImageHeight);
  } else {
    if (Result.Texture) {
      ImageWidth = Result.Texture->SizeX;
      ImageHeight = Result.Texture->SizeY;
      ApplyTexture(Result.Texture);
    }

    UE_LOG(LogGatrixWebImage, Log,
           TEXT("Loaded static: %s (%dx%d)"),
           *LoadedUrl, ImageWidth, ImageHeight);
  }
}

void UGatrixWebImage::BuildAnimFrameTextures(const FGatrixImageResult& Result) {
  AnimFrames = Result.GifFrames;
  AnimDelays = Result.GifFrameDelays;

  if (AnimFrames.Num() > 0 && AnimFrames[0]) {
    ImageWidth = AnimFrames[0]->SizeX;
    ImageHeight = AnimFrames[0]->SizeY;
  }
}
