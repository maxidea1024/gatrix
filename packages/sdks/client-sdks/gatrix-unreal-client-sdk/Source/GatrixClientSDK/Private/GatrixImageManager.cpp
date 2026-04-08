// Copyright Gatrix. All Rights Reserved.

#include "GatrixImageManager.h"
#include "GatrixImageLoader.h"
#include "Async/Async.h"
#include "Engine/Texture2DDynamic.h"
#include "TextureResource.h"
#include "Misc/Paths.h"
#include "Misc/ConfigCacheIni.h"
#include "ThirdParty/GatrixGifDecoder.h"
#include "ThirdParty/GatrixWebPDecoder.h"

DEFINE_LOG_CATEGORY_STATIC(LogGatrixImageManager, Log, All);

UGatrixImageManager* UGatrixImageManager::Singleton = nullptr;

// ==================== Singleton ====================

UGatrixImageManager* UGatrixImageManager::Get() {
  if (!Singleton) {
    Singleton = NewObject<UGatrixImageManager>();
    Singleton->AddToRoot(); // Prevent GC
    Singleton->LoadConfigFromIni();
    Singleton->RegisterConsoleCommands();
    UE_LOG(LogGatrixImageManager, Log,
           TEXT("ImageManager initialized (MaxSources=%d, DecodeWindow=%d, "
                "EvictionGrace=%.0fs, EvictionInterval=%.0fs)"),
           Singleton->MaxSources, Singleton->DecodeWindowSize,
           Singleton->EvictionGracePeriodSeconds,
           Singleton->EvictionCheckInterval);
  }
  return Singleton;
}

// ==================== FTickableGameObject ====================

void UGatrixImageManager::Tick(float DeltaTime) {
  TickAnimatedSources(DeltaTime);
  TickEviction(DeltaTime);
}

// ==================== Public API: Source Lifecycle ====================

TSharedPtr<FGatrixImageSource> UGatrixImageManager::AcquireSource(
    const FString& Url, EGatrixFrameType FrameType,
    FGatrixImageLoadedDelegate OnReady) {
  if (Url.IsEmpty()) {
    FGatrixImageResult Empty;
    OnReady.ExecuteIfBound(false, Empty);
    return nullptr;
  }

  // 1. Check if source already exists
  TSharedPtr<FGatrixImageSource>* Found = Sources.Find(Url);
  if (Found && Found->IsValid()) {
    TSharedPtr<FGatrixImageSource>& Existing = *Found;
    Existing->ActiveConsumerCount++;
    Existing->LastAccessTime = FPlatformTime::Seconds();

    if (Existing->IsReady()) {
      // Source ready — invoke callback immediately with shared texture
      FGatrixImageResult Result;
      Result.Texture = Existing->GetDisplayTexture();
      Result.Width = Existing->Width;
      Result.Height = Existing->Height;
      Result.bFromCache = true;
      OnReady.ExecuteIfBound(true, Result);
    } else if (Existing->State == EGatrixImageSourceState::Failed) {
      FGatrixImageResult Empty;
      OnReady.ExecuteIfBound(false, Empty);
    } else {
      // Still loading — queue callback
      PendingCallbacks.FindOrAdd(Url).Add(OnReady);
    }

    UE_LOG(LogGatrixImageManager, Verbose,
           TEXT("AcquireSource: Reused existing source for %s (consumers=%d)"),
           *Url, Existing->ActiveConsumerCount);
    return Existing;
  }

  // 2. Create a new source
  TSharedPtr<FGatrixImageSource> NewSource = MakeShared<FGatrixImageSource>();
  NewSource->Url = Url;
  NewSource->FrameType = FrameType;
  NewSource->ActiveConsumerCount = 1;
  NewSource->LastAccessTime = FPlatformTime::Seconds();
  NewSource->State = EGatrixImageSourceState::Loading;
  Sources.Add(Url, NewSource);
  TotalSourcesCreated++;

  // Queue callback
  PendingCallbacks.FindOrAdd(Url).Add(OnReady);

  // 3. Start download via ImageLoader's raw API (no GPU textures created)
  TWeakObjectPtr<UGatrixImageManager> WeakThis(this);
  FString UrlCopy = Url;

  FGatrixImageRawLoadedDelegate RawDelegate;
  RawDelegate.BindLambda(
      [WeakThis, UrlCopy](bool bSuccess, const FGatrixImageRawResult& RawResult) {
    if (!WeakThis.IsValid()) return;
    WeakThis->OnRawImageLoaded(UrlCopy, bSuccess, RawResult);
  });

  UGatrixImageLoader::Get()->LoadImageRaw(Url, FrameType, RawDelegate);

  UE_LOG(LogGatrixImageManager, Log,
         TEXT("AcquireSource: Created new source for %s"), *Url);
  return NewSource;
}

void UGatrixImageManager::ReleaseSource(TSharedPtr<FGatrixImageSource>& Source) {
  if (!Source.IsValid()) return;

  Source->ActiveConsumerCount = FMath::Max(0, Source->ActiveConsumerCount - 1);

  // Record the time when consumer count reached zero (for TTL eviction)
  if (Source->ActiveConsumerCount == 0) {
    Source->LastAccessTime = FPlatformTime::Seconds();
  }

  UE_LOG(LogGatrixImageManager, Verbose,
         TEXT("ReleaseSource: %s (consumers=%d)"),
         *Source->Url, Source->ActiveConsumerCount);

  Source.Reset();

  // Note: no immediate eviction — TickEviction handles it periodically
  // with a grace period to support rapid re-acquire patterns.
}

// ==================== Public API: Prefetch ====================

void UGatrixImageManager::Prefetch(const TArray<FString>& Urls) {
  UGatrixImageLoader* Loader = UGatrixImageLoader::Get();
  if (!Loader) return;

  TArray<FString> UrlsToFetch;
  for (const FString& Url : Urls) {
    if (Url.IsEmpty()) continue;
    if (Sources.Contains(Url)) continue;
    if (Loader->IsInDiskCache(Url)) continue;
    UrlsToFetch.Add(Url);
  }

  if (UrlsToFetch.Num() > 0) {
    Loader->Prefetch(UrlsToFetch);
  }
}

// ==================== Public API: Configuration ====================

void UGatrixImageManager::SetMaxSources(int32 Max) {
  MaxSources = FMath::Max(8, Max);
}

void UGatrixImageManager::SetDecodeWindowSize(int32 WindowSize) {
  DecodeWindowSize = FMath::Clamp(WindowSize, 1, 16);
}

void UGatrixImageManager::SetMaxConcurrentDownloads(int32 Max) {
  UGatrixImageLoader::Get()->SetMaxConcurrentDownloads(Max);
}

void UGatrixImageManager::SetEvictionGracePeriod(float Seconds) {
  EvictionGracePeriodSeconds = FMath::Max(0.0f, Seconds);
}

// ==================== Public API: Queries ====================

bool UGatrixImageManager::HasReadySource(const FString& Url) const {
  const TSharedPtr<FGatrixImageSource>* Found = Sources.Find(Url);
  return Found && Found->IsValid() && (*Found)->IsReady();
}

int32 UGatrixImageManager::GetSourceCount() const {
  return Sources.Num();
}

int32 UGatrixImageManager::GetTotalConsumerCount() const {
  int32 Total = 0;
  for (const auto& Pair : Sources) {
    if (Pair.Value.IsValid()) {
      Total += Pair.Value->ActiveConsumerCount;
    }
  }
  return Total;
}

// ==================== Public API: Cleanup ====================

void UGatrixImageManager::ReleaseAll() {
  for (auto& Pair : Sources) {
    if (Pair.Value.IsValid()) {
      ReleaseSourceTextures(*Pair.Value);
    }
  }
  Sources.Empty();
  PendingCallbacks.Empty();
}

// ==================== Internal: Raw Load Completion ====================

void UGatrixImageManager::OnRawImageLoaded(const FString& Url, bool bSuccess,
                                            const FGatrixImageRawResult& RawResult) {
  TSharedPtr<FGatrixImageSource>* Found = Sources.Find(Url);
  if (!Found || !Found->IsValid()) {
    // Source was evicted while loading — notify and discard
    NotifyPendingCallbacks(Url, false, FGatrixImageResult());
    return;
  }

  TSharedPtr<FGatrixImageSource>& Source = *Found;

  if (!bSuccess || !RawResult.IsValid()) {
    Source->State = EGatrixImageSourceState::Failed;
    NotifyPendingCallbacks(Url, false, FGatrixImageResult());
    return;
  }

  // Populate source from raw result
  Source->Width = RawResult.Width;
  Source->Height = RawResult.Height;
  Source->FrameType = RawResult.DetectedType;

  if (RawResult.IsAnimated()) {
    // Animated image — store compressed data + metadata
    Source->FrameCount = RawResult.FrameCount;
    Source->FrameDelays = RawResult.FrameDelays;
    Source->CompressedData = RawResult.RawBytes;

    // Start async full decode on background thread.
    // When complete, CreateFrameTextures will create per-frame GPU textures
    // and set state to Ready. Until then, the source stays in Loading state.
    Source->SharedCurrentFrame = 0;
    Source->SharedAccumulator = 0.0f;
    DecodeFramesAsync(Source);
    // Note: don't set Ready here — DecodeFramesAsync completion will do it.
    return;
  } else {
    // Static image — create texture from pre-decoded RGBA (decoded on background thread)
    Source->FrameCount = 1;
    if (RawResult.DecodedRGBA.Num() > 0) {
      // Use RGBA that was already decoded during ExtractMetadata (no double-decode)
      Source->StaticTexture = UGatrixImageLoader::CreateTextureFromRGBA(
          RawResult.DecodedRGBA, Source->Width, Source->Height);
    }
    if (!Source->StaticTexture) {
      // Fallback: decode from raw bytes on game thread
      UE_LOG(LogGatrixImageManager, Warning,
             TEXT("Pre-decoded RGBA failed for %s (DecodedRGBA=%d, %dx%d, type=%d), re-decoding from raw bytes"),
             *Url, RawResult.DecodedRGBA.Num(), Source->Width, Source->Height,
             static_cast<int32>(Source->FrameType));
      TArray<uint8> RGBAData;
      int32 W = 0, H = 0;
      bool bDecoded = false;
      if (Source->FrameType == EGatrixFrameType::Webp) {
        TArray<TPair<TArray<uint8>, int32>> WebPFrames;
        bDecoded = UGatrixImageLoader::DecodeWebP(
            RawResult.RawBytes, W, H, RGBAData, WebPFrames);
      } else {
        bDecoded = UGatrixImageLoader::DecodeStandardImage(
            RawResult.RawBytes, W, H, RGBAData);
      }
      if (bDecoded && RGBAData.Num() > 0) {
        Source->StaticTexture =
            UGatrixImageLoader::CreateTextureFromRGBA(RGBAData, W, H);
        Source->Width = W;
        Source->Height = H;
      }
    }
  }

  Source->State = EGatrixImageSourceState::Ready;

  // Build result with shared texture pointer for callbacks
  FGatrixImageResult SharedResult;
  SharedResult.Texture = Source->GetDisplayTexture();
  SharedResult.Width = Source->Width;
  SharedResult.Height = Source->Height;

  NotifyPendingCallbacks(Url, true, SharedResult);

  UE_LOG(LogGatrixImageManager, Log,
         TEXT("Source ready: %s (%dx%d, %s, %d frames, %d consumers)"),
         *Url, Source->Width, Source->Height,
         Source->IsAnimated() ? TEXT("animated") : TEXT("static"),
         Source->FrameCount, Source->ActiveConsumerCount);
}

// ==================== Internal: Tick ====================

void UGatrixImageManager::TickAnimatedSources(float DeltaTime) {
  for (auto& Pair : Sources) {
    TSharedPtr<FGatrixImageSource>& Source = Pair.Value;
    if (!Source.IsValid()) continue;
    if (!Source->IsAnimated()) continue;
    if (!Source->IsReady()) continue;
    if (Source->ActiveConsumerCount <= 0) continue;
    if (Source->FrameTextures.Num() == 0) continue;

    // Advance accumulator
    Source->SharedAccumulator += DeltaTime;

    // Consume accumulated time — may skip multiple frames on lag spikes.
    // Capped at FrameCount to prevent infinite loop on degenerate delays.
    int32 FramesAdvanced = 0;
    while (FramesAdvanced < Source->FrameCount) {
      float DelaySeconds = 0.1f;
      if (Source->FrameDelays.IsValidIndex(Source->SharedCurrentFrame)) {
        DelaySeconds = FMath::Max(0.01f,
            Source->FrameDelays[Source->SharedCurrentFrame] / 1000.0f);
      }

      if (Source->SharedAccumulator < DelaySeconds) break;

      Source->SharedAccumulator -= DelaySeconds;
      Source->SharedCurrentFrame =
          (Source->SharedCurrentFrame + 1) % Source->FrameCount;
      FramesAdvanced++;
    }
    TotalTextureUploads += FramesAdvanced;
  }
}

// ==================== Internal: Async Decode + Texture Creation ====================

void UGatrixImageManager::DecodeFramesAsync(
    TSharedPtr<FGatrixImageSource> Source) {
  if (!Source.IsValid() || Source->bDecodeInProgress) return;
  if (Source->CompressedData.Num() == 0) return;
  Source->bDecodeInProgress = true;

  // Move compressed data into shared pointer — avoids deep copy of entire file
  TSharedRef<TArray<uint8>> SharedData =
      MakeShared<TArray<uint8>>(MoveTemp(Source->CompressedData));
  EGatrixFrameType FrameType = Source->FrameType;
  TWeakObjectPtr<UGatrixImageManager> WeakThis(this);

  // Decode ALL frames on background thread.
  // No decoding ever happens on the game thread.
  AsyncTask(ENamedThreads::AnyBackgroundThreadNormalTask,
            [WeakThis, Source, SharedData, FrameType]() {
    TArray<FGatrixDecodedFrame> DecodedFrames;

    if (FrameType == EGatrixFrameType::Gif) {
      FGatrixGifDecoder Decoder;
      if (!Decoder.Load(SharedData->GetData(), SharedData->Num())) {
        AsyncTask(ENamedThreads::GameThread, [Source]() {
          Source->bDecodeInProgress = false;
        });
        return;
      }

      DecodedFrames.Reserve(Decoder.GetFrameCount());
      for (int32 i = 0; i < Decoder.GetFrameCount(); ++i) {
        const FGatrixGifFrame& GifFrame = Decoder.GetFrame(i);
        FGatrixDecodedFrame Frame;
        Frame.FrameIndex = i;
        Frame.RGBA.SetNumUninitialized(GifFrame.RGBA.size());
        FMemory::Memcpy(Frame.RGBA.GetData(), GifFrame.RGBA.data(),
                        GifFrame.RGBA.size());
        DecodedFrames.Add(MoveTemp(Frame));
      }
    } else if (FrameType == EGatrixFrameType::Webp) {
      int32 W = 0, H = 0;
      TArray<uint8> RGBAData;
      TArray<TPair<TArray<uint8>, int32>> WebPFrames;
      if (UGatrixImageLoader::DecodeWebP(*SharedData, W, H, RGBAData, WebPFrames)
          && WebPFrames.Num() > 1) {
        DecodedFrames.Reserve(WebPFrames.Num());
        for (int32 i = 0; i < WebPFrames.Num(); ++i) {
          FGatrixDecodedFrame Frame;
          Frame.FrameIndex = i;
          Frame.RGBA = MoveTemp(WebPFrames[i].Key);
          DecodedFrames.Add(MoveTemp(Frame));
        }
      }
    }

    // Transfer decoded RGBA to game thread → create GPU textures
    AsyncTask(ENamedThreads::GameThread,
              [WeakThis, Source, DecodedFrames = MoveTemp(DecodedFrames)]() mutable {
      if (!WeakThis.IsValid() || !Source.IsValid()) return;

      Source->DecodedWindow = MoveTemp(DecodedFrames);
      Source->bDecodeInProgress = false;

      // Create per-frame GPU textures from decoded RGBA
      WeakThis->CreateFrameTextures(Source);
    });
  });
}

void UGatrixImageManager::CreateFrameTextures(
    TSharedPtr<FGatrixImageSource>& Source) {
  check(IsInGameThread());
  if (!Source.IsValid()) return;
  if (Source->DecodedWindow.Num() == 0) return;

  // Move RGBA data out of DecodedWindow — avoids deep copy of all frame pixels
  int64 TotalRAM = 0;
  TArray<TArray<uint8>> RGBADataArray;
  RGBADataArray.Reserve(Source->DecodedWindow.Num());
  for (FGatrixDecodedFrame& Decoded : Source->DecodedWindow) {
    TotalRAM += Decoded.RGBA.Num();
    RGBADataArray.Add(MoveTemp(Decoded.RGBA));
  }

  // Batch-create all GPU textures: 2 FlushRenderingCommands total
  // (instead of 2 per frame — e.g. 2 vs 140 for a 70-frame GIF)
  UGatrixImageLoader::CreateTexturesFromRGBABatch(
      RGBADataArray, Source->Width, Source->Height, Source->FrameTextures);

  // Free decoded RGBA — GPU textures now own the data
  Source->DecodedWindow.Empty();
  Source->CompressedData.Empty();

  // Mark ready
  Source->State = EGatrixImageSourceState::Ready;

  // Notify pending callbacks
  FGatrixImageResult SharedResult;
  SharedResult.Texture = Source->GetDisplayTexture();
  SharedResult.Width = Source->Width;
  SharedResult.Height = Source->Height;
  NotifyPendingCallbacks(Source->Url, true, SharedResult);

  UE_LOG(LogGatrixImageManager, Log,
         TEXT("Source ready: %s (%dx%d, animated, %d frames, %d textures, VRAM=%.1fKB, %d consumers)"),
         *Source->Url, Source->Width, Source->Height,
         Source->FrameCount, Source->FrameTextures.Num(),
         TotalRAM / 1024.0f, Source->ActiveConsumerCount);
  TotalSourcesCreated++; // Count actual completions
}

// ==================== Internal: Callback Dispatch ====================

void UGatrixImageManager::NotifyPendingCallbacks(
    const FString& Url, bool bSuccess, const FGatrixImageResult& Result) {
  TArray<FGatrixImageLoadedDelegate>* Callbacks = PendingCallbacks.Find(Url);
  if (Callbacks) {
    for (auto& Cb : *Callbacks) {
      Cb.ExecuteIfBound(bSuccess, Result);
    }
  }
  PendingCallbacks.Remove(Url);
}

// ==================== Internal: Eviction ====================

void UGatrixImageManager::TickEviction(float DeltaTime) {
  EvictionCheckTimer += DeltaTime;
  if (EvictionCheckTimer < EvictionCheckInterval) return;
  EvictionCheckTimer = 0.0f;

  // Only evict if over capacity
  if (Sources.Num() > MaxSources) {
    EvictUnusedSources();
  }
}

void UGatrixImageManager::EvictUnusedSources() {
  const double Now = FPlatformTime::Seconds();

  while (Sources.Num() > MaxSources) {
    // Find the LRU source that:
    // 1. Has zero active consumers
    // 2. Has exceeded the grace period since last access
    FString OldestKey;
    double OldestTime = TNumericLimits<double>::Max();

    for (const auto& Pair : Sources) {
      if (!Pair.Value.IsValid()) continue;
      if (Pair.Value->ActiveConsumerCount > 0) continue; // Never evict active
      if (Pair.Value->State == EGatrixImageSourceState::Loading) continue;

      // Check if grace period has elapsed
      double TimeSinceRelease = Now - Pair.Value->LastAccessTime;
      if (TimeSinceRelease < EvictionGracePeriodSeconds) continue;

      if (Pair.Value->LastAccessTime < OldestTime) {
        OldestTime = Pair.Value->LastAccessTime;
        OldestKey = Pair.Key;
      }
    }

    if (OldestKey.IsEmpty()) break; // No eligible sources for eviction

    UE_LOG(LogGatrixImageManager, Log,
           TEXT("Evicting source: %s (idle %.1fs)"),
           *OldestKey, Now - OldestTime);

    TSharedPtr<FGatrixImageSource>* ToEvict = Sources.Find(OldestKey);
    if (ToEvict && ToEvict->IsValid()) {
      ReleaseSourceTextures(**ToEvict);
    }
    Sources.Remove(OldestKey);
    TotalSourcesEvicted++;
  }
}

void UGatrixImageManager::ReleaseSourceTextures(FGatrixImageSource& Source) {
  if (Source.StaticTexture && Source.StaticTexture->IsValidLowLevel()) {
    Source.StaticTexture->RemoveFromRoot();
    Source.StaticTexture = nullptr;
  }
  for (UTexture2DDynamic* Tex : Source.FrameTextures) {
    if (Tex && Tex->IsValidLowLevel()) {
      Tex->RemoveFromRoot();
    }
  }
  Source.FrameTextures.Empty();
  Source.DecodedWindow.Empty();
  Source.CompressedData.Empty();
}

// ==================== Diagnostics ====================

void UGatrixImageManager::DumpStats() const {
  const double Now = FPlatformTime::Seconds();
  int32 ActiveCount = 0;
  int32 LoadingCount = 0;
  int32 FailedCount = 0;
  int32 IdleCount = 0;
  int32 AnimCount = 0;
  int32 StaticCount = 0;
  int32 TotalConsumers = 0;

  UE_LOG(LogGatrixImageManager, Display,
         TEXT("===================================================================="));
  UE_LOG(LogGatrixImageManager, Display,
         TEXT("           Gatrix Image Manager — Detailed Statistics"));
  UE_LOG(LogGatrixImageManager, Display,
         TEXT("===================================================================="));

  // Configuration
  UE_LOG(LogGatrixImageManager, Display,
         TEXT("[Config] MaxSources=%d  DecodeWindow=%d  EvictionGrace=%.1fs  EvictionInterval=%.1fs"),
         MaxSources, DecodeWindowSize, EvictionGracePeriodSeconds, EvictionCheckInterval);

  UE_LOG(LogGatrixImageManager, Display, TEXT(""));
  UE_LOG(LogGatrixImageManager, Display,
         TEXT("[Cumulative] Created=%lld  Evicted=%lld  DecodeWindowMisses=%lld  TextureUploads=%lld"),
         TotalSourcesCreated, TotalSourcesEvicted,
         TotalDecodeWindowMisses, TotalTextureUploads);

  UE_LOG(LogGatrixImageManager, Display, TEXT(""));
  UE_LOG(LogGatrixImageManager, Display,
         TEXT("--- Per-Source Details (%d total) ---"), Sources.Num());

  for (const auto& Pair : Sources) {
    if (!Pair.Value.IsValid()) continue;
    const FGatrixImageSource& S = *Pair.Value;

    // Categorize
    if (S.State == EGatrixImageSourceState::Loading) {
      LoadingCount++;
    } else if (S.State == EGatrixImageSourceState::Failed) {
      FailedCount++;
    } else if (S.ActiveConsumerCount > 0) {
      ActiveCount++;
    } else {
      IdleCount++;
    }

    if (S.IsAnimated()) AnimCount++;
    else StaticCount++;
    TotalConsumers += S.ActiveConsumerCount;

    // Per-source RAM estimation
    int64 CompBytes = S.CompressedData.Num();
    int64 WindowBytes = 0;
    for (const auto& F : S.DecodedWindow) {
      WindowBytes += F.RGBA.Num();
    }
    int64 VRAMBytes = 0;
    if (S.StaticTexture) VRAMBytes += S.Width * S.Height * 4;
    VRAMBytes += (int64)S.FrameTextures.Num() * S.Width * S.Height * 4;

    float IdleTime = (S.ActiveConsumerCount == 0 && S.State == EGatrixImageSourceState::Ready)
                         ? static_cast<float>(Now - S.LastAccessTime)
                         : 0.0f;

    // State string
    FString StateStr;
    switch (S.State) {
      case EGatrixImageSourceState::Loading: StateStr = TEXT("LOADING"); break;
      case EGatrixImageSourceState::Ready:   StateStr = TEXT("READY");   break;
      case EGatrixImageSourceState::Failed:  StateStr = TEXT("FAILED");  break;
    }

    // Frame type string
    FString TypeStr;
    switch (S.FrameType) {
      case EGatrixFrameType::Gif:  TypeStr = TEXT("GIF");  break;
      case EGatrixFrameType::Webp: TypeStr = TEXT("WebP"); break;
      case EGatrixFrameType::Png:  TypeStr = TEXT("PNG");  break;
      case EGatrixFrameType::Jpg:  TypeStr = TEXT("JPG");  break;
      default: TypeStr = TEXT("Other"); break;
    }

    // Truncate URL for display (last 60 chars)
    FString DisplayUrl = S.Url.Len() > 60
        ? TEXT("...") + S.Url.Right(57)
        : S.Url;

    UE_LOG(LogGatrixImageManager, Display,
           TEXT("  [%s] %s  %dx%d %s  Consumers=%d  Frames=%d"),
           *StateStr, *DisplayUrl, S.Width, S.Height, *TypeStr,
           S.ActiveConsumerCount, S.FrameCount);

    if (S.IsAnimated()) {
      UE_LOG(LogGatrixImageManager, Display,
             TEXT("         AnimFrame=%d/%d  FrameTextures=%d  Decoding=%s"),
             S.SharedCurrentFrame, S.FrameCount,
             S.FrameTextures.Num(),
             S.bDecodeInProgress ? TEXT("YES") : TEXT("NO"));
    }

    UE_LOG(LogGatrixImageManager, Display,
           TEXT("         RAM: Compressed=%s  Window=%s  VRAM=%s  Idle=%.1fs"),
           *FString::Printf(TEXT("%.1fKB"), CompBytes / 1024.0f),
           *FString::Printf(TEXT("%.1fKB"), WindowBytes / 1024.0f),
           *FString::Printf(TEXT("%.1fKB"), VRAMBytes / 1024.0f),
           IdleTime);
  }

  int64 TotalRAM = GetEstimatedRAMUsage();
  int64 TotalVRAM = GetEstimatedVRAMUsage();

  UE_LOG(LogGatrixImageManager, Display, TEXT(""));
  UE_LOG(LogGatrixImageManager, Display,
         TEXT("--- Summary ---"));
  UE_LOG(LogGatrixImageManager, Display,
         TEXT("  Sources: %d total (%d active, %d idle, %d loading, %d failed)"),
         Sources.Num(), ActiveCount, IdleCount, LoadingCount, FailedCount);
  UE_LOG(LogGatrixImageManager, Display,
         TEXT("  Types: %d animated, %d static"), AnimCount, StaticCount);
  UE_LOG(LogGatrixImageManager, Display,
         TEXT("  Consumers: %d total"), TotalConsumers);
  UE_LOG(LogGatrixImageManager, Display,
         TEXT("  Memory: RAM=%.2fMB  VRAM=%.2fMB"),
         TotalRAM / (1024.0 * 1024.0), TotalVRAM / (1024.0 * 1024.0));
  UE_LOG(LogGatrixImageManager, Display,
         TEXT("  Pending loads: %d"), PendingCallbacks.Num());
  UE_LOG(LogGatrixImageManager, Display,
         TEXT("===================================================================="));
}

int64 UGatrixImageManager::GetEstimatedRAMUsage() const {
  int64 Total = 0;
  for (const auto& Pair : Sources) {
    if (!Pair.Value.IsValid()) continue;
    const FGatrixImageSource& S = *Pair.Value;
    Total += S.CompressedData.Num();
    for (const auto& F : S.DecodedWindow) {
      Total += F.RGBA.Num();
    }
    Total += S.FrameDelays.Num() * sizeof(int32);
  }
  return Total;
}

int64 UGatrixImageManager::GetEstimatedVRAMUsage() const {
  int64 Total = 0;
  for (const auto& Pair : Sources) {
    if (!Pair.Value.IsValid()) continue;
    const FGatrixImageSource& S = *Pair.Value;
    if (S.StaticTexture) Total += S.Width * S.Height * 4;
    Total += (int64)S.FrameTextures.Num() * S.Width * S.Height * 4;
  }
  return Total;
}

// ==================== Config ====================

void UGatrixImageManager::LoadConfigFromIni() {
  const FString UwoIni = FPaths::ProjectConfigDir() / TEXT("Uwo.ini");

  int32 ConfigInt;
  float ConfigFloat;

  if (GConfig->GetInt(TEXT("Gatrix"), TEXT("ImageMaxSources"), ConfigInt, UwoIni)) {
    MaxSources = FMath::Max(1, ConfigInt);
    UE_LOG(LogGatrixImageManager, Log, TEXT("Config: ImageMaxSources=%d"), MaxSources);
  }

  if (GConfig->GetInt(TEXT("Gatrix"), TEXT("ImageDecodeWindowSize"), ConfigInt, UwoIni)) {
    DecodeWindowSize = FMath::Clamp(ConfigInt, 1, 30);
    UE_LOG(LogGatrixImageManager, Log, TEXT("Config: ImageDecodeWindowSize=%d"), DecodeWindowSize);
  }

  if (GConfig->GetFloat(TEXT("Gatrix"), TEXT("ImageEvictionGracePeriod"), ConfigFloat, UwoIni)) {
    EvictionGracePeriodSeconds = FMath::Max(0.0f, ConfigFloat);
    UE_LOG(LogGatrixImageManager, Log, TEXT("Config: ImageEvictionGracePeriod=%.1f"), EvictionGracePeriodSeconds);
  }

  if (GConfig->GetFloat(TEXT("Gatrix"), TEXT("ImageEvictionCheckInterval"), ConfigFloat, UwoIni)) {
    EvictionCheckInterval = FMath::Max(0.5f, ConfigFloat);
    UE_LOG(LogGatrixImageManager, Log, TEXT("Config: ImageEvictionCheckInterval=%.1f"), EvictionCheckInterval);
  }

  if (GConfig->GetInt(TEXT("Gatrix"), TEXT("ImageMaxConcurrentDownloads"), ConfigInt, UwoIni)) {
    UGatrixImageLoader::Get()->SetMaxConcurrentDownloads(FMath::Clamp(ConfigInt, 1, 16));
    UE_LOG(LogGatrixImageManager, Log, TEXT("Config: ImageMaxConcurrentDownloads=%d"), ConfigInt);
  }
}

// ==================== Console Commands ====================

void UGatrixImageManager::RegisterConsoleCommands() {
  // Gatrix.ImageStats — dump full statistics
  ConsoleCommands.Add(MakeUnique<FAutoConsoleCommand>(
      TEXT("Gatrix.ImageStats"),
      TEXT("Dump detailed Gatrix Image Manager statistics to the output log."),
      FConsoleCommandDelegate::CreateLambda([]() {
        UGatrixImageManager::Get()->DumpStats();
      })
  ));

  // Gatrix.ImageStats.Summary — compact one-line summary
  ConsoleCommands.Add(MakeUnique<FAutoConsoleCommand>(
      TEXT("Gatrix.ImageStats.Summary"),
      TEXT("Show one-line summary of Gatrix Image Manager state."),
      FConsoleCommandDelegate::CreateLambda([]() {
        auto* Mgr = UGatrixImageManager::Get();
        int64 RAM = Mgr->GetEstimatedRAMUsage();
        int64 VRAM = Mgr->GetEstimatedVRAMUsage();
        UE_LOG(LogGatrixImageManager, Display,
               TEXT("[GatrixImage] Sources=%d  Consumers=%d  RAM=%.2fMB  VRAM=%.2fMB  "
                    "Created=%lld  Evicted=%lld  DecodeMisses=%lld  Uploads=%lld"),
               Mgr->GetSourceCount(), Mgr->GetTotalConsumerCount(),
               RAM / (1024.0 * 1024.0), VRAM / (1024.0 * 1024.0),
               Mgr->TotalSourcesCreated, Mgr->TotalSourcesEvicted,
               Mgr->TotalDecodeWindowMisses, Mgr->TotalTextureUploads);
      })
  ));

  // Gatrix.ImageEvict — force eviction check now
  ConsoleCommands.Add(MakeUnique<FAutoConsoleCommand>(
      TEXT("Gatrix.ImageEvict"),
      TEXT("Force immediate eviction check of zero-consumer sources."),
      FConsoleCommandDelegate::CreateLambda([]() {
        UGatrixImageManager::Get()->EvictUnusedSources();
        UE_LOG(LogGatrixImageManager, Display,
               TEXT("Eviction check completed. Remaining sources: %d"),
               UGatrixImageManager::Get()->GetSourceCount());
      })
  ));

  // Gatrix.ImageReleaseAll — release all sources
  ConsoleCommands.Add(MakeUnique<FAutoConsoleCommand>(
      TEXT("Gatrix.ImageReleaseAll"),
      TEXT("Release ALL image sources and textures (emergency cleanup)."),
      FConsoleCommandDelegate::CreateLambda([]() {
        UGatrixImageManager::Get()->ReleaseAll();
        UE_LOG(LogGatrixImageManager, Display,
               TEXT("All image sources released."));
      })
  ));

  // Gatrix.ImageConfig — show current configuration
  ConsoleCommands.Add(MakeUnique<FAutoConsoleCommand>(
      TEXT("Gatrix.ImageConfig"),
      TEXT("Show current Gatrix Image Manager configuration."),
      FConsoleCommandDelegate::CreateLambda([]() {
        auto* Mgr = UGatrixImageManager::Get();
        UE_LOG(LogGatrixImageManager, Display,
               TEXT("[GatrixImage Config]"));
        UE_LOG(LogGatrixImageManager, Display,
               TEXT("  MaxSources = %d"), Mgr->MaxSources);
        UE_LOG(LogGatrixImageManager, Display,
               TEXT("  DecodeWindowSize = %d"), Mgr->DecodeWindowSize);
        UE_LOG(LogGatrixImageManager, Display,
               TEXT("  EvictionGracePeriod = %.1fs"), Mgr->EvictionGracePeriodSeconds);
        UE_LOG(LogGatrixImageManager, Display,
               TEXT("  EvictionCheckInterval = %.1fs"), Mgr->EvictionCheckInterval);
        UE_LOG(LogGatrixImageManager, Display,
               TEXT("  Source: Config/Uwo.ini [Gatrix] section"));
      })
  ));
}
