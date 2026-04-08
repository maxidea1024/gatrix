// Copyright Gatrix. All Rights Reserved.
// Central image manager — singleton that owns all image sources,
// handles reference counting, shared texture updates, and eviction.

#pragma once

#include "CoreMinimal.h"
#include "Tickable.h"
#include "HAL/IConsoleManager.h"
#include "GatrixImageSource.h"
#include "GatrixImageLoader.h"
#include "GatrixImageManager.generated.h"

/**
 * Central manager for all image sources in the Gatrix SDK.
 *
 * Responsibilities:
 * - Owns the URL→ImageSource map (single source per unique URL)
 * - Reference counting: consumers call AcquireSource/ReleaseSource
 * - Tick: advances shared GIF/WebP textures, manages sliding decode window
 * - Eviction: TTL-based delayed removal of zero-consumer sources (grace period)
 * - Delegates download/disk-cache to UGatrixImageLoader
 *
 * Thread safety:
 * - All public API is game-thread only (UObject constraint)
 * - Background decoding uses AsyncTask with game-thread completion callbacks
 *
 * Memory strategy (per animated source):
 * - CompressedData: raw GIF/WebP bytes (~100KB-1MB typical)
 * - DecodedWindow: only N frames of RGBA decoded at a time
 * - SharedAnimTexture: 1 GPU texture, updated each tick
 * - Total: ~3-5MB per animated source vs ~80-100MB for full decode
 */
UCLASS()
class GATRIXCLIENTSDK_API UGatrixImageManager : public UObject, public FTickableGameObject {
  GENERATED_BODY()

public:
  /** Get the singleton instance (created on first access) */
  static UGatrixImageManager* Get();

  // ==================== FTickableGameObject ====================

  virtual void Tick(float DeltaTime) override;
  virtual bool IsTickable() const override { return !IsTemplate(); }
  virtual TStatId GetStatId() const override {
    RETURN_QUICK_DECLARE_CYCLE_STAT(UGatrixImageManager, STATGROUP_Tickables);
  }

  // ==================== Source Lifecycle ====================

  /**
   * Acquire a reference to an image source for the given URL.
   *
   * If the source already exists and is ready, the callback fires immediately.
   * If the source is loading, the callback is queued and fires on completion.
   * If no source exists, download+decode is initiated.
   *
   * The returned TSharedPtr increments ActiveConsumerCount. The consumer
   * MUST call ReleaseSource() when done (typically in NativeDestruct).
   *
   * @param Url        Image URL
   * @param FrameType  Format hint (overridden by magic-byte detection)
   * @param OnReady    Callback when source is ready (always on game thread)
   * @return Shared pointer to the source (may be in Loading state)
   */
  TSharedPtr<FGatrixImageSource> AcquireSource(
      const FString& Url,
      EGatrixFrameType FrameType,
      FGatrixImageLoadedDelegate OnReady);

  /**
   * Release a consumer's reference to an image source.
   * Decrements ActiveConsumerCount. When count reaches zero,
   * the source becomes eligible for eviction.
   *
   * Resets the caller's TSharedPtr to nullptr.
   */
  void ReleaseSource(TSharedPtr<FGatrixImageSource>& Source);

  // ==================== Prefetch ====================

  /**
   * Download and disk-cache images without creating sources.
   * Does NOT decode or create textures — just ensures data is on disk.
   * Used by BannerClient to pre-cache image assets after fetching banner data.
   */
  void Prefetch(const TArray<FString>& Urls);

  // ==================== Configuration ====================

  /** Maximum number of sources to keep in memory (default: 64) */
  void SetMaxSources(int32 Max);

  /** Number of decoded frames to keep per animated source (default: 3).
   *  Current frame + N ahead. Higher = smoother but more memory. */
  void SetDecodeWindowSize(int32 WindowSize);

  /** Maximum concurrent downloads (default: 4) */
  void SetMaxConcurrentDownloads(int32 Max);

  /** Grace period in seconds before zero-consumer sources are evicted (default: 30s).
   *  Sources with no active consumers are kept alive for this duration
   *  to handle rapid re-acquire (e.g. banner frame switching). */
  void SetEvictionGracePeriod(float Seconds);

  // ==================== Queries ====================

  /** Check if a source exists and is ready for the given URL */
  bool HasReadySource(const FString& Url) const;

  /** Get the number of active sources */
  int32 GetSourceCount() const;

  /** Get total active consumer count across all sources */
  int32 GetTotalConsumerCount() const;

  // ==================== Cleanup ====================

  /** Release all sources and textures (call on shutdown) */
  void ReleaseAll();

  // ==================== Diagnostics ====================

  /**
   * Dump detailed statistics to the output log.
   * Also available via console command: Gatrix.ImageStats
   *
   * Output includes:
   * - Per-source: URL, state, dimensions, format, frame count, consumer count,
   *   compressed bytes, decoded window state, GPU texture state, last access time
   * - Summary: total sources, active sources, total consumers, estimated memory (RAM + VRAM)
   * - Configuration: max sources, decode window size, eviction grace period
   */
  void DumpStats() const;

  /** Get estimated total RAM usage in bytes (compressed data + decoded windows) */
  int64 GetEstimatedRAMUsage() const;

  /** Get estimated total VRAM usage in bytes (GPU textures) */
  int64 GetEstimatedVRAMUsage() const;

private:
  static UGatrixImageManager* Singleton;

  // ==================== Source Storage ====================

  /** URL → ImageSource map. One source per unique URL. */
  TMap<FString, TSharedPtr<FGatrixImageSource>> Sources;

  /** Callbacks waiting for sources that are still loading */
  TMap<FString, TArray<FGatrixImageLoadedDelegate>> PendingCallbacks;

  // ==================== Configuration ====================

  int32 MaxSources = 64;
  int32 DecodeWindowSize = 10;

  /** Seconds to keep zero-consumer sources before eviction.
   *  Prevents thrashing when sources are rapidly released and re-acquired. */
  float EvictionGracePeriodSeconds = 30.0f;

  /** How often to check for evictable sources (seconds) */
  float EvictionCheckInterval = 5.0f;
  float EvictionCheckTimer = 0.0f;

  // ==================== Statistics ====================

  /** Cumulative stats for diagnostics */
  int64 TotalSourcesCreated = 0;
  int64 TotalSourcesEvicted = 0;
  int64 TotalDecodeWindowMisses = 0;
  int64 TotalTextureUploads = 0;

  // ==================== Console Commands ====================

  TArray<TUniquePtr<FAutoConsoleCommand>> ConsoleCommands;
  void RegisterConsoleCommands();

  // ==================== Config ====================

  /** Load configuration from Uwo.ini [Gatrix] section */
  void LoadConfigFromIni();

  // ==================== Internal Methods ====================

  /** Called when ImageLoader's raw load completes (no GPU textures) */
  void OnRawImageLoaded(const FString& Url, bool bSuccess,
                        const FGatrixImageRawResult& RawResult);

  /** Advance frame indices for all active animated sources (zero-cost: just index swap) */
  void TickAnimatedSources(float DeltaTime);

  /** Decode ALL frames from compressed data on a background thread.
   *  After completion, CreateFrameTextures is called on game thread. */
  void DecodeFramesAsync(TSharedPtr<FGatrixImageSource> Source);

  /** Create UTexture2DDynamic per decoded frame on game thread.
   *  Called after DecodeFramesAsync completes. Frees decoded RGBA after textures are created. */
  void CreateFrameTextures(TSharedPtr<FGatrixImageSource>& Source);

  /** Notify all pending callbacks for a URL */
  void NotifyPendingCallbacks(const FString& Url, bool bSuccess,
                              const FGatrixImageResult& Result);

  /** Check and evict stale zero-consumer sources (called periodically from Tick) */
  void TickEviction(float DeltaTime);

  /** Evict zero-consumer sources that have exceeded the grace period */
  void EvictUnusedSources();

  /** Release GPU resources for a source (textures) */
  void ReleaseSourceTextures(FGatrixImageSource& Source);
};

