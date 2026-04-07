// Copyright Gatrix. All Rights Reserved.
// Banner playback controller — manages frame/sequence timing and transitions

#pragma once

#include "CoreMinimal.h"
#include "GatrixBannerTypes.h"
#include "GatrixBannerPlayback.generated.h"

/** Delegate fired when the current frame changes */
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FGatrixOnFrameChanged, int32, FrameIndex,
                                             const FGatrixBannerFrame&, Frame);

/** Delegate fired when the current sequence changes */
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FGatrixOnSequenceChanged, int32, SequenceIndex);

/** Delegate fired when playback reaches the end (once mode) */
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FGatrixOnPlaybackFinished);

/** Delegate fired when a frame's action should be executed */
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FGatrixOnFrameActionTriggered,
                                            const FGatrixFrameAction&, Action);

/** Context for targeting evaluation */
USTRUCT(BlueprintType)
struct GATRIXCLIENTSDK_API FGatrixBannerContext {
  GENERATED_BODY()

  /** Current platform identifier (e.g., "pc", "ios") */
  UPROPERTY(BlueprintReadWrite, Category = "Gatrix|Banner")
  FString Platform;

  /** Current world identifier */
  UPROPERTY(BlueprintReadWrite, Category = "Gatrix|Banner")
  FString World;

  /** Current channel */
  UPROPERTY(BlueprintReadWrite, Category = "Gatrix|Banner")
  FString Channel;

  /** Current subchannel */
  UPROPERTY(BlueprintReadWrite, Category = "Gatrix|Banner")
  FString Subchannel;

  /** Player level */
  UPROPERTY(BlueprintReadWrite, Category = "Gatrix|Banner")
  int32 PlayerLevel = 0;

  /** Days since the player joined */
  UPROPERTY(BlueprintReadWrite, Category = "Gatrix|Banner")
  int32 JoinDays = -1;
};

/**
 * Manages the playback state and timing for a Gatrix banner.
 * Handles frame delays, sequence looping modes, speed multipliers,
 * and frame targeting filters. All timer operations are non-blocking.
 */
UCLASS(BlueprintType)
class GATRIXCLIENTSDK_API UGatrixBannerPlayback : public UObject {
  GENERATED_BODY()

public:
  UGatrixBannerPlayback();

  /**
   * Set the banner data to play.
   * Resets playback state to the beginning.
   */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Banner|Playback")
  void SetBanner(const FGatrixBanner& InBanner);

  /** Set the targeting context for frame filtering */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Banner|Playback")
  void SetContext(const FGatrixBannerContext& InContext);

  // ==================== Playback Control ====================

  UFUNCTION(BlueprintCallable, Category = "Gatrix|Banner|Playback")
  void Play();

  UFUNCTION(BlueprintCallable, Category = "Gatrix|Banner|Playback")
  void Pause();

  UFUNCTION(BlueprintCallable, Category = "Gatrix|Banner|Playback")
  void Stop();

  /** Advance to the next frame (manual step) */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Banner|Playback")
  void NextFrame();

  /** Go to the previous frame (manual step) */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Banner|Playback")
  void PrevFrame();

  /** Reset to the first frame of the first sequence */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Banner|Playback")
  void Reset();

  /** Seek to a specific frame index within the current sequence */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Banner|Playback")
  void SeekToFrame(int32 FrameIndex);

  /** Override the playback speed (multiplied with banner's playbackSpeed) */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Banner|Playback")
  void SetPlaybackSpeed(float Speed);

  /** Call every frame from the owning widget's Tick */
  void Tick(float DeltaTime);

  // ==================== State Queries ====================

  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Banner|Playback")
  EGatrixBannerPlaybackState GetState() const { return State; }

  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Banner|Playback")
  bool IsPlaying() const { return State == EGatrixBannerPlaybackState::Playing; }

  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Banner|Playback")
  int32 GetCurrentFrameIndex() const { return CurrentFrameIndex; }

  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Banner|Playback")
  int32 GetCurrentSequenceIndex() const { return CurrentSequenceIndex; }

  /** Get the current frame data */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Banner|Playback")
  FGatrixBannerFrame GetCurrentFrame() const;

  /** Get the current sequence data */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Banner|Playback")
  FGatrixBannerSequence GetCurrentSequence() const;

  /** Get duration until next frame in seconds (accounting for speed) */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Banner|Playback")
  float GetCurrentFrameDuration() const;

  /** Get the frame count in the current sequence (after targeting filter) */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Banner|Playback")
  int32 GetFilteredFrameCount() const;

  /** Get the sequence count */
  UFUNCTION(BlueprintCallable, BlueprintPure, Category = "Gatrix|Banner|Playback")
  int32 GetSequenceCount() const;

  /** Get the next N image URLs for prefetching */
  TArray<FString> GetUpcomingImageUrls(int32 Count) const;

  // ==================== Events ====================

  UPROPERTY(BlueprintAssignable, Category = "Gatrix|Banner|Events")
  FGatrixOnFrameChanged OnFrameChanged;

  UPROPERTY(BlueprintAssignable, Category = "Gatrix|Banner|Events")
  FGatrixOnSequenceChanged OnSequenceChanged;

  UPROPERTY(BlueprintAssignable, Category = "Gatrix|Banner|Events")
  FGatrixOnPlaybackFinished OnPlaybackFinished;

  UPROPERTY(BlueprintAssignable, Category = "Gatrix|Banner|Events")
  FGatrixOnFrameActionTriggered OnFrameAction;

  /** Trigger the current frame's action (called by widget on click) */
  UFUNCTION(BlueprintCallable, Category = "Gatrix|Banner|Playback")
  void TriggerCurrentFrameAction();

private:
  /** Move to the next frame respecting loop mode */
  void AdvanceFrame(int32 Direction = 1);

  /** Schedule the timer for the current frame */
  void ScheduleFrameTimer();

  /** Stop the frame timer */
  void ClearFrameTimer();

  /** Called when the frame timer fires */
  void OnFrameTimerFired();

  /** Apply targeting filter to get the effective frame list */
  void RebuildFilteredFrameIndices();

  /** Check if a frame passes the targeting filter */
  bool PassesTargetingFilter(const FGatrixBannerFrame& Frame) const;

  /** Compute actual delay for a frame in seconds */
  float ComputeFrameDelay(const FGatrixBannerFrame& Frame) const;

  // State
  FGatrixBanner Banner;
  FGatrixBannerContext Context;
  EGatrixBannerPlaybackState State = EGatrixBannerPlaybackState::Stopped;

  int32 CurrentSequenceIndex = 0;
  int32 CurrentFrameIndex = 0; // Index into FilteredFrameIndices
  int32 PingPongDirection = 1; // 1 = forward, -1 = backward

  float UserPlaybackSpeed = 1.0f;

  // Filtered frame indices per sequence (after targeting)
  TArray<TArray<int32>> FilteredFrameIndicesPerSequence;

  // Shuffled sequence order
  TArray<int32> SequenceOrder;

  // Tick-based frame timing
  float FrameElapsed = 0.0f;
  float FrameTargetDelay = 0.0f;
};
