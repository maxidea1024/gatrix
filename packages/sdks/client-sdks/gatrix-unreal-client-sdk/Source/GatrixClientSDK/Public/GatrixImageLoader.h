// Copyright Gatrix. All Rights Reserved.
// Async image downloader, decoder, and cache system for banner media

#pragma once

#include "CoreMinimal.h"
#include "GatrixBannerTypes.h"
#include "Engine/Texture2DDynamic.h"
#include "GatrixImageLoader.generated.h"

/** Lightweight result: raw bytes + metadata, no GPU textures.
 *  Used by UGatrixImageManager. */
struct GATRIXCLIENTSDK_API FGatrixImageRawResult {
  /** Raw compressed file bytes (GIF/WebP/PNG/JPG) */
  TArray<uint8> RawBytes;

  /** Format auto-detected from magic bytes */
  EGatrixFrameType DetectedType = EGatrixFrameType::Png;

  /** Image dimensions */
  int32 Width = 0;
  int32 Height = 0;

  /** For animated formats: number of frames */
  int32 FrameCount = 1;

  /** For animated formats: per-frame delays in milliseconds */
  TArray<int32> FrameDelays;

  /** Whether this came from disk cache */
  bool bFromDiskCache = false;

  /** For static images: decoded RGBA from background thread.
   *  Avoids double-decode: background thread decodes for metadata,
   *  game thread reuses RGBA for texture creation. */
  TArray<uint8> DecodedRGBA;

  bool IsValid() const { return RawBytes.Num() > 0 && Width > 0 && Height > 0; }
  bool IsAnimated() const { return FrameCount > 1; }
};

/** Delegate for raw image load completion */
DECLARE_DELEGATE_TwoParams(FGatrixImageRawLoadedDelegate,
                           bool /*bSuccess*/,
                           const FGatrixImageRawResult& /*Result*/);

/** Result of an image load operation */
USTRUCT(BlueprintType)
struct GATRIXCLIENTSDK_API FGatrixImageResult {
  GENERATED_BODY()

  /** The loaded texture (null if failed) */
  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  UTexture2DDynamic* Texture = nullptr;

  /** For GIF: all decoded frames */
  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  TArray<UTexture2DDynamic*> GifFrames;

  /** For GIF: per-frame delays in milliseconds */
  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  TArray<int32> GifFrameDelays;

  /** Image dimensions */
  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  int32 Width = 0;

  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  int32 Height = 0;

  /** Whether this result came from cache */
  UPROPERTY(BlueprintReadOnly, Category = "Gatrix|Banner")
  bool bFromCache = false;

  bool IsValid() const { return Texture != nullptr || GifFrames.Num() > 0; }
  bool IsGif() const { return GifFrames.Num() > 0; }
};

/** Delegate for image load completion */
DECLARE_DELEGATE_TwoParams(FGatrixImageLoadedDelegate, bool /*bSuccess*/, const FGatrixImageResult& /*Result*/);

/**
 * Async image downloader and cache system for Gatrix banners.
 * Handles PNG, JPG, WebP (via libwebp), GIF (via gifdec), and provides
 * both in-memory and on-disk caching.
 *
 * All heavy operations (download, decode) run on background threads.
 * Texture creation happens on the game thread.
 */
UCLASS()
class GATRIXCLIENTSDK_API UGatrixImageLoader : public UObject {
  GENERATED_BODY()

public:
  /** Get the singleton instance (created on first access) */
  static UGatrixImageLoader* Get();

  /**
   * Load an image from URL asynchronously.
   * Checks memory cache → disk cache → network download.
   *
   * @param Url       Full URL to the image
   * @param FrameType Expected media type (for format-specific decoding)
   * @param OnLoaded  Callback when complete (always on game thread)
   */
  void LoadImage(const FString& Url, EGatrixFrameType FrameType,
                 FGatrixImageLoadedDelegate OnLoaded);

  /**
   * Prefetch images for upcoming frames.
   * Downloads and caches without returning textures.
   */
  void Prefetch(const TArray<FString>& Urls);

  /**
   * Load an image and return raw bytes + metadata (no GPU textures).
   * Intended for UGatrixImageManager: the manager creates its own
   * shared textures from the raw data.
   *
   * Flow: disk cache → network download → metadata extraction
   * Does NOT create UTexture2DDynamic objects.
   */
  void LoadImageRaw(const FString& Url, EGatrixFrameType FrameType,
                    FGatrixImageRawLoadedDelegate OnLoaded);

  /** Check if an image is already in memory cache */
  bool IsInMemoryCache(const FString& Url) const;

  /** Check if an image is in the disk cache */
  bool IsInDiskCache(const FString& Url) const;

  /** Clear all in-memory cached textures */
  void ClearMemoryCache();

  /** Clear all disk-cached files */
  void ClearDiskCache();

  /** Set maximum memory cache entries (default: 64) */
  void SetMaxMemoryCacheEntries(int32 MaxEntries);

  /** Set maximum disk cache size in MB (default: 100) */
  void SetMaxDiskCacheSizeMB(int32 SizeMB);

  /** Set maximum concurrent downloads (default: 4) */
  void SetMaxConcurrentDownloads(int32 MaxDownloads);

private:
  static UGatrixImageLoader* Singleton;

  // ==================== Memory Cache ====================

  struct FMemoryCacheEntry {
    FGatrixImageResult Result;
    FString Url;
    double LastAccessTime = 0.0;
  };

  mutable FCriticalSection MemoryCacheLock;
  TMap<FString, TSharedPtr<FMemoryCacheEntry>> MemoryCache;
  int32 MaxMemoryCacheEntries = 64;

  void AddToMemoryCache(const FString& Url, const FGatrixImageResult& Result);
  bool GetFromMemoryCache(const FString& Url, FGatrixImageResult& OutResult);
  void EvictOldestMemoryCacheEntry();

  // ==================== Disk Cache ====================

  FString DiskCacheDir;
  int32 MaxDiskCacheSizeMB = 100;

  FString GetDiskCachePath(const FString& Url) const;
  FString ComputeCacheKey(const FString& Url) const;
  void SaveToDiskCache(const FString& Url, const TArray<uint8>& Data);
  void EnsureDiskCacheDir();

public:
  /** Load raw bytes from disk cache (public for UGatrixImageManager) */
  bool LoadFromDiskCache(const FString& Url, TArray<uint8>& OutData) const;

private:

  // ==================== Download Queue ====================

  struct FDownloadRequest {
    FString Url;
    EGatrixFrameType FrameType;
    FGatrixImageLoadedDelegate OnLoaded;
    bool bPrefetchOnly = false;
  };

  FCriticalSection DownloadQueueLock;
  TArray<FDownloadRequest> PendingDownloads;
  int32 ActiveDownloads = 0;
  int32 MaxConcurrentDownloads = 4;

  // Requests waiting for the same URL (coalescing)
  TMap<FString, TArray<FGatrixImageLoadedDelegate>> PendingCallbacks;

  void EnqueueDownload(const FDownloadRequest& Request);
  void ProcessDownloadQueue();
  void StartDownload(const FDownloadRequest& Request);

  // ==================== Decoding (public for UGatrixImageManager) ====================

public:
  /** Create UTexture2DDynamic from RGBA buffer (must be called on game thread) */
  static UTexture2DDynamic* CreateTextureFromRGBA(const TArray<uint8>& RGBAData,
                                                  int32 Width, int32 Height);

  /**
   * Batch-create multiple UTexture2DDynamic from RGBA buffers.
   * Uses only 2 FlushRenderingCommands total instead of 2 per texture.
   * Must be called on game thread.
   */
  static void CreateTexturesFromRGBABatch(
      const TArray<TArray<uint8>>& RGBADataArray,
      int32 Width, int32 Height,
      TArray<UTexture2DDynamic*>& OutTextures);

  /** Decode PNG/JPG to RGBA (thread-safe, no GPU) */
  static bool DecodeStandardImage(const TArray<uint8>& Data,
                                  int32& OutWidth, int32& OutHeight,
                                  TArray<uint8>& OutRGBA);

  /** Decode GIF to array of (RGBA, delay_ms) per frame (thread-safe) */
  static bool DecodeGif(const TArray<uint8>& Data,
                        int32& OutWidth, int32& OutHeight,
                        TArray<TPair<TArray<uint8>, int32>>& OutFrames);

  /** Decode WebP (thread-safe) */
  static bool DecodeWebP(const TArray<uint8>& Data,
                         int32& OutWidth, int32& OutHeight,
                         TArray<uint8>& OutRGBA,
                         TArray<TPair<TArray<uint8>, int32>>& OutGifFrames);

private:
  /** Decode raw bytes into RGBA pixel buffer on a background thread (internal) */
  void DecodeImageAsync(const TArray<uint8>& Data, EGatrixFrameType FrameType,
                        const FString& Url,
                        TFunction<void(bool bSuccess, int32 Width, int32 Height,
                                       const TArray<uint8>& RGBAData,
                                       const TArray<TPair<TArray<uint8>, int32>>& GifFrames)>
                            OnDecoded);
};
