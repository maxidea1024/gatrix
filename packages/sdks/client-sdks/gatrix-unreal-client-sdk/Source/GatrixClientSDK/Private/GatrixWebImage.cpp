// Copyright Gatrix. All Rights Reserved.

#include "GatrixWebImage.h"
#include "GatrixImageManager.h"
#include "Components/Overlay.h"
#include "Components/OverlaySlot.h"
#include "Components/ScaleBox.h"
#include "Blueprint/WidgetTree.h"
#include "Engine/Texture2DDynamic.h"

DEFINE_LOG_CATEGORY_STATIC(LogGatrixWebImage, Log, All);

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
  // Release the shared source reference (critical for memory management)
  ReleaseCurrentSource();
  Super::NativeDestruct();
}

void UGatrixWebImage::NativeTick(const FGeometry& MyGeometry, float InDeltaTime) {
  Super::NativeTick(MyGeometry, InDeltaTime);

  // For animated sources with per-frame textures, update the brush
  // when the Manager advances to a new frame. This is a cheap pointer swap
  // — no GPU upload, no decode, just changing which pre-created texture
  // the UImage widget references.
  if (ImageSource.IsValid() && ImageSource->IsAnimated() &&
      ImageSource->IsReady() && DisplayImage) {
    UTexture2DDynamic* CurrentTex = ImageSource->GetDisplayTexture();
    if (CurrentTex && CurrentTex != LastDisplayedTexture) {
      DisplayImage->SetBrushFromTextureDynamic(CurrentTex, true);
      LastDisplayedTexture = CurrentTex;
    }
  }
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
  ReleaseCurrentSource();

  bIsLoading = false;
  bIsLoaded = false;
  ImageWidth = 0;
  ImageHeight = 0;
  LoadedUrl.Empty();
  ImageUrl.Empty();

  ShowPlaceholder();
}

void UGatrixWebImage::SetExternalImage(UImage* ExternalImg) {
  DisplayImage = ExternalImg;
}

bool UGatrixWebImage::IsAnimated() const {
  return ImageSource.IsValid() && ImageSource->IsAnimated();
}

// ==================== Internal ====================

void UGatrixWebImage::ReleaseCurrentSource() {
  if (ImageSource.IsValid()) {
    UGatrixImageManager::Get()->ReleaseSource(ImageSource);
  }
}

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

  // Release previous source if any
  ReleaseCurrentSource();

  bIsLoading = true;
  bIsLoaded = false;
  LoadedUrl = ImageUrl;

  UE_LOG(LogGatrixWebImage, Log, TEXT("StartDownload: %s"), *ImageUrl);

  TWeakObjectPtr<UGatrixWebImage> WeakThis(this);
  FGatrixImageLoadedDelegate Delegate;
  Delegate.BindLambda([WeakThis](bool bSuccess, const FGatrixImageResult& Result) {
    if (!WeakThis.IsValid()) return;
    auto* Self = WeakThis.Get();
    Self->bIsLoading = false;

    if (bSuccess && Result.IsValid()) {
      Self->OnSourceReady(bSuccess, Result);
    } else {
      UE_LOG(LogGatrixWebImage, Warning, TEXT("Failed to load: %s"),
             *Self->LoadedUrl);
    }
  });

  // Acquire source from the central manager (shared across all consumers)
  ImageSource = UGatrixImageManager::Get()->AcquireSource(
      ImageUrl, EGatrixFrameType::Png, Delegate);
}

void UGatrixWebImage::OnSourceReady(bool bSuccess,
                                     const FGatrixImageResult& Result) {
  bIsLoaded = true;

  // Get the display texture from the shared source
  UTexture2DDynamic* DisplayTexture = nullptr;

  if (ImageSource.IsValid()) {
    DisplayTexture = ImageSource->GetDisplayTexture();
    ImageWidth = ImageSource->Width;
    ImageHeight = ImageSource->Height;
  } else if (Result.Texture) {
    DisplayTexture = Result.Texture;
    ImageWidth = Result.Width;
    ImageHeight = Result.Height;
  }

  if (DisplayTexture) {
    ApplyTexture(DisplayTexture);
  }

  UE_LOG(LogGatrixWebImage, Log,
         TEXT("Loaded: %s (%dx%d, %s)"),
         *LoadedUrl, ImageWidth, ImageHeight,
         IsAnimated() ? TEXT("animated") : TEXT("static"));
}
