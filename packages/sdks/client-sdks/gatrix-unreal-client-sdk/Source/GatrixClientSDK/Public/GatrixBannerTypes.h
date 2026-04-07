// Copyright Gatrix. All Rights Reserved.
// Banner system type definitions for Gatrix Unreal SDK

#pragma once

#include "CoreMinimal.h"
#include "GatrixBannerTypes.generated.h"

// ==================== Enums ====================

/** Media type of a banner frame */
UENUM(BlueprintType)
enum class EGatrixFrameType : uint8 {
  Jpg    UMETA(DisplayName = "JPG"),
  Png    UMETA(DisplayName = "PNG"),
  Gif    UMETA(DisplayName = "GIF"),
  Mp4    UMETA(DisplayName = "MP4"),
  Webp   UMETA(DisplayName = "WebP"),
  Svg    UMETA(DisplayName = "SVG")
};

/** Action triggered when a frame is interacted with */
UENUM(BlueprintType)
enum class EGatrixFrameActionType : uint8 {
  None     UMETA(DisplayName = "None"),
  OpenUrl  UMETA(DisplayName = "Open URL"),
  Command  UMETA(DisplayName = "Command"),
  DeepLink UMETA(DisplayName = "Deep Link")
};

/** Target for frame action (webview vs external browser) */
UENUM(BlueprintType)
enum class EGatrixFrameActionTarget : uint8 {
  Webview  UMETA(DisplayName = "Webview"),
  External UMETA(DisplayName = "External")
};

/** Visual effect applied to a frame on enter/exit */
UENUM(BlueprintType)
enum class EGatrixFrameEffectType : uint8 {
  None       UMETA(DisplayName = "None"),
  FadeIn     UMETA(DisplayName = "Fade In"),
  FadeOut    UMETA(DisplayName = "Fade Out"),
  SlideLeft  UMETA(DisplayName = "Slide Left"),
  SlideRight UMETA(DisplayName = "Slide Right"),
  SlideUp    UMETA(DisplayName = "Slide Up"),
  SlideDown  UMETA(DisplayName = "Slide Down"),
  ZoomIn     UMETA(DisplayName = "Zoom In"),
  ZoomOut    UMETA(DisplayName = "Zoom Out"),
  Shake      UMETA(DisplayName = "Shake")
};

/** Transition type between frames */
UENUM(BlueprintType)
enum class EGatrixTransitionType : uint8 {
  None      UMETA(DisplayName = "None"),
  Fade      UMETA(DisplayName = "Fade"),
  Slide     UMETA(DisplayName = "Slide"),
  CrossFade UMETA(DisplayName = "Cross Fade")
};

/** Loop mode for sequence playback */
UENUM(BlueprintType)
enum class EGatrixLoopMode : uint8 {
  Loop     UMETA(DisplayName = "Loop"),
  PingPong UMETA(DisplayName = "Ping Pong"),
  Once     UMETA(DisplayName = "Once")
};

/** Playback state of the banner */
UENUM(BlueprintType)
enum class EGatrixBannerPlaybackState : uint8 {
  Stopped UMETA(DisplayName = "Stopped"),
  Playing UMETA(DisplayName = "Playing"),
  Paused  UMETA(DisplayName = "Paused"),
  Loading UMETA(DisplayName = "Loading")
};

/** Filter logic for combining targeting conditions */
UENUM(BlueprintType)
enum class EGatrixFrameFilterLogic : uint8 {
  And UMETA(DisplayName = "AND"),
  Or  UMETA(DisplayName = "OR")
};

// ==================== Structs ====================

/** Action associated with a frame (e.g., open URL on click) */
USTRUCT(BlueprintType)
struct GATRIXCLIENTSDK_API FGatrixFrameAction {
  GENERATED_BODY()

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  EGatrixFrameActionType Type = EGatrixFrameActionType::None;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  FString Value;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  EGatrixFrameActionTarget Target = EGatrixFrameActionTarget::External;
};

/** Enter/exit visual effects for a frame */
USTRUCT(BlueprintType)
struct GATRIXCLIENTSDK_API FGatrixFrameEffects {
  GENERATED_BODY()

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  EGatrixFrameEffectType Enter = EGatrixFrameEffectType::None;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  EGatrixFrameEffectType Exit = EGatrixFrameEffectType::None;

  /** Duration of the effect in milliseconds */
  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  int32 Duration = 300;
};

/** Transition between frames */
USTRUCT(BlueprintType)
struct GATRIXCLIENTSDK_API FGatrixFrameTransition {
  GENERATED_BODY()

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  EGatrixTransitionType Type = EGatrixTransitionType::None;

  /** Duration of the transition in milliseconds */
  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  int32 Duration = 300;
};

/** Channel + subchannel targeting data */
USTRUCT(BlueprintType)
struct GATRIXCLIENTSDK_API FGatrixChannelSubchannel {
  GENERATED_BODY()

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  FString Channel;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  TArray<FString> Subchannels;
};

/** Targeting/filtering options for a frame */
USTRUCT(BlueprintType)
struct GATRIXCLIENTSDK_API FGatrixFrameTargeting {
  GENERATED_BODY()

  /** Target platforms (e.g., "pc", "ios", "android") */
  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  TArray<FString> Platforms;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  bool bPlatformsInverted = false;

  /** Target channel/subchannels */
  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  TArray<FGatrixChannelSubchannel> ChannelSubchannels;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  bool bChannelSubchannelsInverted = false;

  /** Target worlds */
  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  TArray<FString> Worlds;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  bool bWorldsInverted = false;

  /** User level range (0 = not set) */
  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  int32 LevelMin = 0;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  int32 LevelMax = 0;

  /** Days since joining range (-1 = not set) */
  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  int32 JoinDaysMin = -1;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  int32 JoinDaysMax = -1;

  /** Logic for combining conditions */
  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  EGatrixFrameFilterLogic FilterLogic = EGatrixFrameFilterLogic::And;

  /** Returns true if no targeting conditions are set */
  bool IsEmpty() const {
    return Platforms.Num() == 0 && ChannelSubchannels.Num() == 0 &&
           Worlds.Num() == 0 && LevelMin == 0 && LevelMax == 0 &&
           JoinDaysMin < 0 && JoinDaysMax < 0;
  }
};

/** A single frame within a banner sequence */
USTRUCT(BlueprintType)
struct GATRIXCLIENTSDK_API FGatrixBannerFrame {
  GENERATED_BODY()

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  FString FrameId;

  /** URL to the media asset (image or video) */
  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  FString ImageUrl;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  EGatrixFrameType Type = EGatrixFrameType::Png;

  /** Display duration in milliseconds */
  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  int32 Delay = 3000;

  /** Whether MP4 should loop during its display time */
  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  bool bLoop = false;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  FGatrixFrameAction Action;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  FGatrixFrameEffects Effects;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  FGatrixFrameTransition Transition;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  FGatrixFrameTargeting Targeting;

  /** Optional click URL */
  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  FString ClickUrl;
};

/** A sequence of frames with its own playback settings */
USTRUCT(BlueprintType)
struct GATRIXCLIENTSDK_API FGatrixBannerSequence {
  GENERATED_BODY()

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  FString SequenceId;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  FString Name;

  /** Speed multiplier for this sequence (applied on top of banner playbackSpeed) */
  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  float SpeedMultiplier = 1.0f;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  EGatrixLoopMode LoopMode = EGatrixLoopMode::Loop;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  FGatrixFrameTransition Transition;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  TArray<FGatrixBannerFrame> Frames;
};

/** Complete banner data */
USTRUCT(BlueprintType)
struct GATRIXCLIENTSDK_API FGatrixBanner {
  GENERATED_BODY()

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  FString BannerId;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  FString Name;

  /** Banner canvas width in pixels */
  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  int32 Width = 0;

  /** Banner canvas height in pixels */
  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  int32 Height = 0;

  /** Global playback speed multiplier */
  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  float PlaybackSpeed = 1.0f;

  /** Whether to shuffle sequence order */
  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  bool bShuffle = false;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  TArray<FGatrixBannerSequence> Sequences;

  /** Data version (for change detection / cache invalidation) */
  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  int32 Version = 0;

  /** Returns total frame count across all sequences */
  int32 GetTotalFrameCount() const {
    int32 Total = 0;
    for (const auto& Seq : Sequences) {
      Total += Seq.Frames.Num();
    }
    return Total;
  }

  bool IsValid() const {
    return !BannerId.IsEmpty() && Width > 0 && Height > 0 && Sequences.Num() > 0;
  }
};

// ==================== Parsing Helpers ====================

namespace GatrixBannerParse {

  inline EGatrixFrameType ParseFrameType(const FString& Str) {
    if (Str == TEXT("jpg") || Str == TEXT("jpeg")) return EGatrixFrameType::Jpg;
    if (Str == TEXT("png")) return EGatrixFrameType::Png;
    if (Str == TEXT("gif")) return EGatrixFrameType::Gif;
    if (Str == TEXT("mp4")) return EGatrixFrameType::Mp4;
    if (Str == TEXT("webp")) return EGatrixFrameType::Webp;
    if (Str == TEXT("svg")) return EGatrixFrameType::Svg;
    return EGatrixFrameType::Png; // default
  }

  inline EGatrixFrameActionType ParseActionType(const FString& Str) {
    if (Str == TEXT("openUrl")) return EGatrixFrameActionType::OpenUrl;
    if (Str == TEXT("command")) return EGatrixFrameActionType::Command;
    if (Str == TEXT("deepLink")) return EGatrixFrameActionType::DeepLink;
    return EGatrixFrameActionType::None;
  }

  inline EGatrixFrameActionTarget ParseActionTarget(const FString& Str) {
    if (Str == TEXT("webview")) return EGatrixFrameActionTarget::Webview;
    return EGatrixFrameActionTarget::External;
  }

  inline EGatrixFrameEffectType ParseEffectType(const FString& Str) {
    if (Str == TEXT("fadeIn")) return EGatrixFrameEffectType::FadeIn;
    if (Str == TEXT("fadeOut")) return EGatrixFrameEffectType::FadeOut;
    if (Str == TEXT("slideLeft")) return EGatrixFrameEffectType::SlideLeft;
    if (Str == TEXT("slideRight")) return EGatrixFrameEffectType::SlideRight;
    if (Str == TEXT("slideUp")) return EGatrixFrameEffectType::SlideUp;
    if (Str == TEXT("slideDown")) return EGatrixFrameEffectType::SlideDown;
    if (Str == TEXT("zoomIn")) return EGatrixFrameEffectType::ZoomIn;
    if (Str == TEXT("zoomOut")) return EGatrixFrameEffectType::ZoomOut;
    if (Str == TEXT("shake")) return EGatrixFrameEffectType::Shake;
    return EGatrixFrameEffectType::None;
  }

  inline EGatrixTransitionType ParseTransitionType(const FString& Str) {
    if (Str == TEXT("fade")) return EGatrixTransitionType::Fade;
    if (Str == TEXT("slide")) return EGatrixTransitionType::Slide;
    if (Str == TEXT("crossfade")) return EGatrixTransitionType::CrossFade;
    return EGatrixTransitionType::None;
  }

  inline EGatrixLoopMode ParseLoopMode(const FString& Str) {
    if (Str == TEXT("pingpong")) return EGatrixLoopMode::PingPong;
    if (Str == TEXT("once")) return EGatrixLoopMode::Once;
    return EGatrixLoopMode::Loop;
  }

  inline EGatrixFrameFilterLogic ParseFilterLogic(const FString& Str) {
    if (Str == TEXT("or")) return EGatrixFrameFilterLogic::Or;
    return EGatrixFrameFilterLogic::And;
  }

} // namespace GatrixBannerParse
