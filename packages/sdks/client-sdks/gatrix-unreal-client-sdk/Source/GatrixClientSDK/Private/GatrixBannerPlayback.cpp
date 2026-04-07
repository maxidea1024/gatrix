// Copyright Gatrix. All Rights Reserved.

#include "GatrixBannerPlayback.h"
#include "TimerManager.h"
#include "Engine/World.h"
#include "Async/Async.h"

DEFINE_LOG_CATEGORY_STATIC(LogGatrixPlayback, Log, All);

UGatrixBannerPlayback::UGatrixBannerPlayback() {
}

// ==================== Setup ====================

void UGatrixBannerPlayback::SetBanner(const FGatrixBanner& InBanner) {
  Stop();
  Banner = InBanner;

  // Build sequence order
  SequenceOrder.Empty();
  for (int32 i = 0; i < Banner.Sequences.Num(); ++i) {
    SequenceOrder.Add(i);
  }

  if (Banner.bShuffle && SequenceOrder.Num() > 1) {
    // Fisher-Yates shuffle
    for (int32 i = SequenceOrder.Num() - 1; i > 0; --i) {
      int32 j = FMath::RandRange(0, i);
      SequenceOrder.Swap(i, j);
    }
  }

  RebuildFilteredFrameIndices();
  Reset();
}

void UGatrixBannerPlayback::SetContext(const FGatrixBannerContext& InContext) {
  Context = InContext;
  RebuildFilteredFrameIndices();

  // If currently playing, validate current position
  if (State == EGatrixBannerPlaybackState::Playing) {
    if (GetFilteredFrameCount() == 0) {
      Stop();
    } else {
      CurrentFrameIndex = FMath::Clamp(CurrentFrameIndex, 0, GetFilteredFrameCount() - 1);
      ScheduleFrameTimer();
    }
  }
}

// ==================== Playback Control ====================

void UGatrixBannerPlayback::Play() {
  if (!Banner.IsValid() || Banner.Sequences.Num() == 0) {
    UE_LOG(LogGatrixPlayback, Warning, TEXT("Play: No valid banner set"));
    return;
  }

  if (GetFilteredFrameCount() == 0) {
    UE_LOG(LogGatrixPlayback, Warning, TEXT("Play: No frames pass targeting filter"));
    return;
  }

  if (State == EGatrixBannerPlaybackState::Playing) return;

  State = EGatrixBannerPlaybackState::Playing;
  PingPongDirection = 1;

  // Emit initial frame
  FGatrixBannerFrame Frame = GetCurrentFrame();
  OnFrameChanged.Broadcast(CurrentFrameIndex, Frame);

  ScheduleFrameTimer();
}

void UGatrixBannerPlayback::Pause() {
  if (State != EGatrixBannerPlaybackState::Playing) return;

  State = EGatrixBannerPlaybackState::Paused;
  ClearFrameTimer();
}

void UGatrixBannerPlayback::Stop() {
  State = EGatrixBannerPlaybackState::Stopped;
  ClearFrameTimer();
  CurrentFrameIndex = 0;
  CurrentSequenceIndex = 0;
  PingPongDirection = 1;
}

void UGatrixBannerPlayback::NextFrame() {
  AdvanceFrame(1);
}

void UGatrixBannerPlayback::PrevFrame() {
  AdvanceFrame(-1);
}

void UGatrixBannerPlayback::Reset() {
  ClearFrameTimer();
  CurrentSequenceIndex = 0;
  CurrentFrameIndex = 0;
  PingPongDirection = 1;

  if (State == EGatrixBannerPlaybackState::Playing) {
    FGatrixBannerFrame Frame = GetCurrentFrame();
    OnFrameChanged.Broadcast(CurrentFrameIndex, Frame);
    ScheduleFrameTimer();
  }
}

void UGatrixBannerPlayback::SeekToFrame(int32 FrameIndex) {
  if (GetFilteredFrameCount() == 0) return;

  CurrentFrameIndex = FMath::Clamp(FrameIndex, 0, GetFilteredFrameCount() - 1);

  FGatrixBannerFrame Frame = GetCurrentFrame();
  OnFrameChanged.Broadcast(CurrentFrameIndex, Frame);

  if (State == EGatrixBannerPlaybackState::Playing) {
    ScheduleFrameTimer();
  }
}

void UGatrixBannerPlayback::SetPlaybackSpeed(float Speed) {
  UserPlaybackSpeed = FMath::Max(0.01f, Speed);

  if (State == EGatrixBannerPlaybackState::Playing) {
    // Reschedule with new speed
    ScheduleFrameTimer();
  }
}

// ==================== State Queries ====================

FGatrixBannerFrame UGatrixBannerPlayback::GetCurrentFrame() const {
  if (Banner.Sequences.Num() == 0 || SequenceOrder.Num() == 0) {
    return FGatrixBannerFrame();
  }

  int32 SeqIdx = SequenceOrder[CurrentSequenceIndex % SequenceOrder.Num()];
  if (SeqIdx >= Banner.Sequences.Num()) return FGatrixBannerFrame();

  const FGatrixBannerSequence& Seq = Banner.Sequences[SeqIdx];
  if (SeqIdx >= FilteredFrameIndicesPerSequence.Num()) return FGatrixBannerFrame();

  const TArray<int32>& Filtered = FilteredFrameIndicesPerSequence[SeqIdx];
  if (Filtered.Num() == 0) return FGatrixBannerFrame();

  int32 ActualIdx = Filtered[CurrentFrameIndex % Filtered.Num()];
  if (ActualIdx < Seq.Frames.Num()) {
    return Seq.Frames[ActualIdx];
  }

  return FGatrixBannerFrame();
}

FGatrixBannerSequence UGatrixBannerPlayback::GetCurrentSequence() const {
  if (SequenceOrder.Num() == 0) return FGatrixBannerSequence();

  int32 SeqIdx = SequenceOrder[CurrentSequenceIndex % SequenceOrder.Num()];
  if (SeqIdx < Banner.Sequences.Num()) {
    return Banner.Sequences[SeqIdx];
  }
  return FGatrixBannerSequence();
}

float UGatrixBannerPlayback::GetCurrentFrameDuration() const {
  FGatrixBannerFrame Frame = GetCurrentFrame();
  return ComputeFrameDelay(Frame);
}

int32 UGatrixBannerPlayback::GetFilteredFrameCount() const {
  if (SequenceOrder.Num() == 0) return 0;

  int32 SeqIdx = SequenceOrder[CurrentSequenceIndex % SequenceOrder.Num()];
  if (SeqIdx < FilteredFrameIndicesPerSequence.Num()) {
    return FilteredFrameIndicesPerSequence[SeqIdx].Num();
  }
  return 0;
}

int32 UGatrixBannerPlayback::GetSequenceCount() const {
  return SequenceOrder.Num();
}

TArray<FString> UGatrixBannerPlayback::GetUpcomingImageUrls(int32 Count) const {
  TArray<FString> Urls;

  if (SequenceOrder.Num() == 0) return Urls;

  int32 SeqIdx = SequenceOrder[CurrentSequenceIndex % SequenceOrder.Num()];
  if (SeqIdx >= Banner.Sequences.Num() ||
      SeqIdx >= FilteredFrameIndicesPerSequence.Num()) {
    return Urls;
  }

  const FGatrixBannerSequence& Seq = Banner.Sequences[SeqIdx];
  const TArray<int32>& Filtered = FilteredFrameIndicesPerSequence[SeqIdx];

  for (int32 i = 1; i <= Count && i < Filtered.Num(); ++i) {
    int32 NextIdx = (CurrentFrameIndex + i) % Filtered.Num();
    int32 ActualIdx = Filtered[NextIdx];
    if (ActualIdx < Seq.Frames.Num() && !Seq.Frames[ActualIdx].ImageUrl.IsEmpty()) {
      Urls.Add(Seq.Frames[ActualIdx].ImageUrl);
    }
  }

  return Urls;
}

void UGatrixBannerPlayback::TriggerCurrentFrameAction() {
  FGatrixBannerFrame Frame = GetCurrentFrame();
  if (Frame.Action.Type != EGatrixFrameActionType::None) {
    OnFrameAction.Broadcast(Frame.Action);
  }
  // Also check clickUrl
  if (!Frame.ClickUrl.IsEmpty() && Frame.Action.Type == EGatrixFrameActionType::None) {
    FGatrixFrameAction UrlAction;
    UrlAction.Type = EGatrixFrameActionType::OpenUrl;
    UrlAction.Value = Frame.ClickUrl;
    OnFrameAction.Broadcast(UrlAction);
  }
}

// ==================== Internal ====================

void UGatrixBannerPlayback::AdvanceFrame(int32 Direction) {
  if (GetFilteredFrameCount() <= 1) return;

  int32 Count = GetFilteredFrameCount();
  int32 SeqIdx = SequenceOrder[CurrentSequenceIndex % SequenceOrder.Num()];
  const FGatrixBannerSequence& Seq = Banner.Sequences[SeqIdx];

  int32 EffectiveDir = Direction * PingPongDirection;
  int32 NextIndex = CurrentFrameIndex + EffectiveDir;

  bool bSequenceEnded = false;

  switch (Seq.LoopMode) {
    case EGatrixLoopMode::Loop:
      if (NextIndex >= Count) {
        NextIndex = 0;
        bSequenceEnded = true;
      } else if (NextIndex < 0) {
        NextIndex = Count - 1;
      }
      break;

    case EGatrixLoopMode::PingPong:
      if (NextIndex >= Count) {
        PingPongDirection = -1;
        NextIndex = FMath::Max(0, Count - 2);
      } else if (NextIndex < 0) {
        PingPongDirection = 1;
        NextIndex = FMath::Min(1, Count - 1);
        bSequenceEnded = true;
      }
      break;

    case EGatrixLoopMode::Once:
      if (NextIndex >= Count || NextIndex < 0) {
        bSequenceEnded = true;
        NextIndex = FMath::Clamp(NextIndex, 0, Count - 1);
      }
      break;
  }

  // Move to next sequence if current one ended
  if (bSequenceEnded && SequenceOrder.Num() > 1) {
    int32 NextSeq = CurrentSequenceIndex + 1;
    if (NextSeq >= SequenceOrder.Num()) {
      // All sequences done
      if (Seq.LoopMode == EGatrixLoopMode::Once) {
        State = EGatrixBannerPlaybackState::Stopped;
        ClearFrameTimer();
        OnPlaybackFinished.Broadcast();
        return;
      }
      NextSeq = 0; // loop back
    }

    CurrentSequenceIndex = NextSeq;
    CurrentFrameIndex = 0;
    PingPongDirection = 1;
    OnSequenceChanged.Broadcast(CurrentSequenceIndex);
  } else if (bSequenceEnded && Seq.LoopMode == EGatrixLoopMode::Once) {
    State = EGatrixBannerPlaybackState::Stopped;
    ClearFrameTimer();
    OnPlaybackFinished.Broadcast();
    return;
  } else {
    CurrentFrameIndex = NextIndex;
  }

  FGatrixBannerFrame Frame = GetCurrentFrame();
  OnFrameChanged.Broadcast(CurrentFrameIndex, Frame);

  if (State == EGatrixBannerPlaybackState::Playing) {
    ScheduleFrameTimer();
  }
}

void UGatrixBannerPlayback::ScheduleFrameTimer() {
  FrameElapsed = 0.0f;
  FrameTargetDelay = GetCurrentFrameDuration();
  if (FrameTargetDelay <= 0.0f) {
    FrameTargetDelay = 0.1f;
  }
}

void UGatrixBannerPlayback::ClearFrameTimer() {
  FrameElapsed = 0.0f;
  FrameTargetDelay = 0.0f;
}

void UGatrixBannerPlayback::OnFrameTimerFired() {
  if (State != EGatrixBannerPlaybackState::Playing) return;
  AdvanceFrame(1);
}

void UGatrixBannerPlayback::Tick(float DeltaTime) {
  if (State != EGatrixBannerPlaybackState::Playing) return;
  if (FrameTargetDelay <= 0.0f) return;

  FrameElapsed += DeltaTime;
  if (FrameElapsed >= FrameTargetDelay) {
    FrameElapsed = 0.0f;
    AdvanceFrame(1);
  }
}

float UGatrixBannerPlayback::ComputeFrameDelay(const FGatrixBannerFrame& Frame) const {
  float DelayMs = static_cast<float>(Frame.Delay);
  if (DelayMs <= 0.f) DelayMs = 3000.f;

  float BannerSpeed = FMath::Max(0.01f, Banner.PlaybackSpeed);

  int32 SeqIdx = SequenceOrder.Num() > 0
                     ? SequenceOrder[CurrentSequenceIndex % SequenceOrder.Num()]
                     : 0;
  float SeqSpeed = 1.0f;
  if (SeqIdx < Banner.Sequences.Num()) {
    SeqSpeed = FMath::Max(0.01f, Banner.Sequences[SeqIdx].SpeedMultiplier);
  }

  float TotalSpeed = BannerSpeed * SeqSpeed * FMath::Max(0.01f, UserPlaybackSpeed);

  return (DelayMs / 1000.f) / TotalSpeed;
}

// ==================== Targeting Filter ====================

void UGatrixBannerPlayback::RebuildFilteredFrameIndices() {
  FilteredFrameIndicesPerSequence.SetNum(Banner.Sequences.Num());

  for (int32 SeqIdx = 0; SeqIdx < Banner.Sequences.Num(); ++SeqIdx) {
    const FGatrixBannerSequence& Seq = Banner.Sequences[SeqIdx];
    FilteredFrameIndicesPerSequence[SeqIdx].Empty();

    for (int32 FrameIdx = 0; FrameIdx < Seq.Frames.Num(); ++FrameIdx) {
      if (PassesTargetingFilter(Seq.Frames[FrameIdx])) {
        FilteredFrameIndicesPerSequence[SeqIdx].Add(FrameIdx);
      }
    }
  }
}

bool UGatrixBannerPlayback::PassesTargetingFilter(
    const FGatrixBannerFrame& Frame) const {
  const FGatrixFrameTargeting& T = Frame.Targeting;

  // No targeting = show to everyone
  if (T.IsEmpty()) return true;

  bool bUseAnd = (T.FilterLogic == EGatrixFrameFilterLogic::And);
  bool bAllPass = true;
  bool bAnyPass = false;

  // Platform check
  if (T.Platforms.Num() > 0 && !Context.Platform.IsEmpty()) {
    bool bMatch = T.Platforms.Contains(Context.Platform);
    if (T.bPlatformsInverted) bMatch = !bMatch;

    if (bMatch) bAnyPass = true;
    else bAllPass = false;
  }

  // World check
  if (T.Worlds.Num() > 0 && !Context.World.IsEmpty()) {
    bool bMatch = T.Worlds.Contains(Context.World);
    if (T.bWorldsInverted) bMatch = !bMatch;

    if (bMatch) bAnyPass = true;
    else bAllPass = false;
  }

  // Level check
  if (T.LevelMin > 0 || T.LevelMax > 0) {
    bool bMatch = true;
    if (T.LevelMin > 0 && Context.PlayerLevel < T.LevelMin) bMatch = false;
    if (T.LevelMax > 0 && Context.PlayerLevel > T.LevelMax) bMatch = false;

    if (bMatch) bAnyPass = true;
    else bAllPass = false;
  }

  // Join days check
  if (T.JoinDaysMin >= 0 || T.JoinDaysMax >= 0) {
    bool bMatch = true;
    if (T.JoinDaysMin >= 0 && Context.JoinDays < T.JoinDaysMin) bMatch = false;
    if (T.JoinDaysMax >= 0 && Context.JoinDays > T.JoinDaysMax) bMatch = false;

    if (bMatch) bAnyPass = true;
    else bAllPass = false;
  }

  // Channel/Subchannel check
  if (T.ChannelSubchannels.Num() > 0 && !Context.Channel.IsEmpty()) {
    bool bMatch = false;
    for (const auto& Cs : T.ChannelSubchannels) {
      if (Cs.Channel == Context.Channel) {
        if (Cs.Subchannels.Num() == 0 || Context.Subchannel.IsEmpty() ||
            Cs.Subchannels.Contains(Context.Subchannel)) {
          bMatch = true;
          break;
        }
      }
    }
    if (T.bChannelSubchannelsInverted) bMatch = !bMatch;

    if (bMatch) bAnyPass = true;
    else bAllPass = false;
  }

  return bUseAnd ? bAllPass : bAnyPass;
}
