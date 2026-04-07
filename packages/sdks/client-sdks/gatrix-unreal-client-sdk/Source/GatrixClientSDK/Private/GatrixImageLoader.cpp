// Copyright Gatrix. All Rights Reserved.

#include "GatrixImageLoader.h"
#include "Http.h"
#include "Async/Async.h"
#include "Misc/Paths.h"
#include "Misc/FileHelper.h"
#include "Misc/SecureHash.h"
#include "HAL/PlatformFilemanager.h"
#include "IImageWrapperModule.h"
#include "IImageWrapper.h"
#include "Modules/ModuleManager.h"
#include "Engine/Texture2DDynamic.h"
#include "TextureResource.h"

// ThirdParty decoders
#include "ThirdParty/GatrixGifDecoder.h"
#include "ThirdParty/GatrixWebPDecoder.h"

DEFINE_LOG_CATEGORY_STATIC(LogGatrixImageLoader, Log, All);

UGatrixImageLoader* UGatrixImageLoader::Singleton = nullptr;

// ==================== Singleton ====================

UGatrixImageLoader* UGatrixImageLoader::Get() {
  if (!Singleton) {
    Singleton = NewObject<UGatrixImageLoader>();
    Singleton->AddToRoot(); // prevent GC
    Singleton->EnsureDiskCacheDir();
  }
  return Singleton;
}

// ==================== Public API ====================

void UGatrixImageLoader::LoadImage(const FString& Url, EGatrixFrameType FrameType,
                                   FGatrixImageLoadedDelegate OnLoaded) {
  if (Url.IsEmpty()) {
    FGatrixImageResult EmptyResult;
    OnLoaded.ExecuteIfBound(false, EmptyResult);
    return;
  }

  // 1. Check memory cache
  FGatrixImageResult CachedResult;
  if (GetFromMemoryCache(Url, CachedResult)) {
    CachedResult.bFromCache = true;
    OnLoaded.ExecuteIfBound(true, CachedResult);
    return;
  }

  // 2. Check disk cache (async read)
  FString CachePath = GetDiskCachePath(Url);
  if (FPaths::FileExists(CachePath)) {
    // Read from disk on background thread
    TWeakObjectPtr<UGatrixImageLoader> WeakThis(this);
    FString UrlCopy = Url;
    EGatrixFrameType TypeCopy = FrameType;

    AsyncTask(ENamedThreads::AnyBackgroundThreadNormalTask, [WeakThis, UrlCopy, TypeCopy, CachePath, OnLoaded]() {
      TArray<uint8> FileData;
      if (FFileHelper::LoadFileToArray(FileData, *CachePath)) {
        // Decode on background thread, then create texture on game thread
        if (WeakThis.IsValid()) {
          WeakThis->DecodeImageAsync(FileData, TypeCopy, UrlCopy,
            [WeakThis, UrlCopy, OnLoaded](bool bSuccess, int32 Width, int32 Height,
                                           const TArray<uint8>& RGBAData,
                                           const TArray<TPair<TArray<uint8>, int32>>& GifFrames) {
              AsyncTask(ENamedThreads::GameThread, [WeakThis, UrlCopy, bSuccess, Width, Height, RGBAData, GifFrames, OnLoaded]() {
                if (!WeakThis.IsValid()) return;
                FGatrixImageResult Result;
                Result.Width = Width;
                Result.Height = Height;
                Result.bFromCache = true;

                if (GifFrames.Num() > 0) {
                  for (const auto& GifFrame : GifFrames) {
                    UTexture2DDynamic* FrameTex = CreateTextureFromRGBA(GifFrame.Key, Width, Height);
                    if (FrameTex) {
                      Result.GifFrames.Add(FrameTex);
                      Result.GifFrameDelays.Add(GifFrame.Value);
                    }
                  }
                  if (Result.GifFrames.Num() > 0) {
                    Result.Texture = Result.GifFrames[0];
                  }
                } else if (bSuccess) {
                  Result.Texture = CreateTextureFromRGBA(RGBAData, Width, Height);
                }

                if (Result.IsValid()) {
                  WeakThis->AddToMemoryCache(UrlCopy, Result);
                  OnLoaded.ExecuteIfBound(true, Result);
                } else {
                  OnLoaded.ExecuteIfBound(false, Result);
                }
              });
            });
        }
      } else {
        // Disk read failed → fall through to network
        AsyncTask(ENamedThreads::GameThread, [WeakThis, UrlCopy, TypeCopy, OnLoaded]() {
          if (!WeakThis.IsValid()) return;
          FDownloadRequest Req;
          Req.Url = UrlCopy;
          Req.FrameType = TypeCopy;
          Req.OnLoaded = OnLoaded;
          WeakThis->EnqueueDownload(Req);
        });
      }
    });
    return;
  }

  // 3. Network download
  FDownloadRequest Req;
  Req.Url = Url;
  Req.FrameType = FrameType;
  Req.OnLoaded = OnLoaded;
  EnqueueDownload(Req);
}

void UGatrixImageLoader::Prefetch(const TArray<FString>& Urls) {
  for (const FString& Url : Urls) {
    if (Url.IsEmpty() || IsInMemoryCache(Url) || IsInDiskCache(Url)) {
      continue;
    }
    FDownloadRequest Req;
    Req.Url = Url;
    Req.FrameType = EGatrixFrameType::Png; // type determined from content
    Req.bPrefetchOnly = true;
    EnqueueDownload(Req);
  }
}

bool UGatrixImageLoader::IsInMemoryCache(const FString& Url) const {
  FScopeLock Lock(&MemoryCacheLock);
  return MemoryCache.Contains(Url);
}

bool UGatrixImageLoader::IsInDiskCache(const FString& Url) const {
  return FPaths::FileExists(GetDiskCachePath(Url));
}

void UGatrixImageLoader::ClearMemoryCache() {
  FScopeLock Lock(&MemoryCacheLock);
  // Release GC root references for all cached textures
  for (auto& Pair : MemoryCache) {
    if (Pair.Value.IsValid()) {
      FGatrixImageResult& R = Pair.Value->Result;
      if (R.Texture && R.Texture->IsValidLowLevel()) R.Texture->RemoveFromRoot();
      for (auto* GifTex : R.GifFrames) {
        if (GifTex && GifTex->IsValidLowLevel()) GifTex->RemoveFromRoot();
      }
    }
  }
  MemoryCache.Empty();
}

void UGatrixImageLoader::ClearDiskCache() {
  IPlatformFile& PF = FPlatformFileManager::Get().GetPlatformFile();
  PF.DeleteDirectoryRecursively(*DiskCacheDir);
  PF.CreateDirectory(*DiskCacheDir);
}

void UGatrixImageLoader::SetMaxMemoryCacheEntries(int32 MaxEntries) {
  MaxMemoryCacheEntries = FMath::Max(8, MaxEntries);
}

void UGatrixImageLoader::SetMaxDiskCacheSizeMB(int32 SizeMB) {
  MaxDiskCacheSizeMB = FMath::Max(10, SizeMB);
}

void UGatrixImageLoader::SetMaxConcurrentDownloads(int32 MaxDownloads) {
  MaxConcurrentDownloads = FMath::Clamp(MaxDownloads, 1, 16);
}

// ==================== Memory Cache ====================

void UGatrixImageLoader::AddToMemoryCache(const FString& Url,
                                          const FGatrixImageResult& Result) {
  FScopeLock Lock(&MemoryCacheLock);

  while (MemoryCache.Num() >= MaxMemoryCacheEntries) {
    EvictOldestMemoryCacheEntry();
  }

  TSharedPtr<FMemoryCacheEntry> Entry = MakeShared<FMemoryCacheEntry>();
  Entry->Result = Result;
  Entry->Url = Url;
  Entry->LastAccessTime = FPlatformTime::Seconds();
  MemoryCache.Add(Url, Entry);
}

bool UGatrixImageLoader::GetFromMemoryCache(const FString& Url,
                                            FGatrixImageResult& OutResult) {
  FScopeLock Lock(&MemoryCacheLock);

  TSharedPtr<FMemoryCacheEntry>* Found = MemoryCache.Find(Url);
  if (Found && Found->IsValid()) {
    (*Found)->LastAccessTime = FPlatformTime::Seconds();
    OutResult = (*Found)->Result;
    return true;
  }
  return false;
}

void UGatrixImageLoader::EvictOldestMemoryCacheEntry() {
  // Already locked by caller
  FString OldestKey;
  double OldestTime = TNumericLimits<double>::Max();

  for (const auto& Pair : MemoryCache) {
    if (Pair.Value->LastAccessTime < OldestTime) {
      OldestTime = Pair.Value->LastAccessTime;
      OldestKey = Pair.Key;
    }
  }

  if (!OldestKey.IsEmpty()) {
    // Release GC root references before removing
    TSharedPtr<FMemoryCacheEntry>* Entry = MemoryCache.Find(OldestKey);
    if (Entry && Entry->IsValid()) {
      FGatrixImageResult& R = (*Entry)->Result;
      if (R.Texture && R.Texture->IsValidLowLevel()) R.Texture->RemoveFromRoot();
      for (auto* GifTex : R.GifFrames) {
        if (GifTex && GifTex->IsValidLowLevel()) GifTex->RemoveFromRoot();
      }
    }
    MemoryCache.Remove(OldestKey);
  }
}

// ==================== Disk Cache ====================

FString UGatrixImageLoader::GetDiskCachePath(const FString& Url) const {
  return DiskCacheDir / ComputeCacheKey(Url);
}

FString UGatrixImageLoader::ComputeCacheKey(const FString& Url) const {
  return FMD5::HashAnsiString(*Url);
}

bool UGatrixImageLoader::LoadFromDiskCache(const FString& Url,
                                           TArray<uint8>& OutData) const {
  FString Path = GetDiskCachePath(Url);
  return FFileHelper::LoadFileToArray(OutData, *Path);
}

void UGatrixImageLoader::SaveToDiskCache(const FString& Url,
                                         const TArray<uint8>& Data) {
  FString Path = GetDiskCachePath(Url);
  // Write on background thread to avoid blocking
  AsyncTask(ENamedThreads::AnyBackgroundThreadNormalTask,
            [Path, Data]() {
              FFileHelper::SaveArrayToFile(Data, *Path);
            });
}

void UGatrixImageLoader::EnsureDiskCacheDir() {
  DiskCacheDir = FPaths::ProjectSavedDir() / TEXT("GatrixCache") / TEXT("Images");
  IPlatformFile& PF = FPlatformFileManager::Get().GetPlatformFile();
  if (!PF.DirectoryExists(*DiskCacheDir)) {
    PF.CreateDirectoryTree(*DiskCacheDir);
  }
}

// ==================== Download Queue ====================

void UGatrixImageLoader::EnqueueDownload(const FDownloadRequest& Request) {
  FScopeLock Lock(&DownloadQueueLock);

  // Coalesce duplicate URL requests
  if (PendingCallbacks.Contains(Request.Url)) {
    if (!Request.bPrefetchOnly) {
      PendingCallbacks[Request.Url].Add(Request.OnLoaded);
    }
    return;
  }

  if (!Request.bPrefetchOnly) {
    TArray<FGatrixImageLoadedDelegate> Callbacks;
    Callbacks.Add(Request.OnLoaded);
    PendingCallbacks.Add(Request.Url, MoveTemp(Callbacks));
  }

  if (ActiveDownloads < MaxConcurrentDownloads) {
    ActiveDownloads++;
    StartDownload(Request);
  } else {
    PendingDownloads.Add(Request);
  }
}

void UGatrixImageLoader::ProcessDownloadQueue() {
  FScopeLock Lock(&DownloadQueueLock);

  while (ActiveDownloads < MaxConcurrentDownloads && PendingDownloads.Num() > 0) {
    FDownloadRequest Req = PendingDownloads[0];
    PendingDownloads.RemoveAt(0);
    ActiveDownloads++;
    StartDownload(Req);
  }
}

void UGatrixImageLoader::StartDownload(const FDownloadRequest& Request) {
  auto HttpRequest = FHttpModule::Get().CreateRequest();
  HttpRequest->SetURL(Request.Url);
  HttpRequest->SetVerb(TEXT("GET"));

  TWeakObjectPtr<UGatrixImageLoader> WeakThis(this);
  FString UrlCopy = Request.Url;
  EGatrixFrameType TypeCopy = Request.FrameType;
  bool bPrefetch = Request.bPrefetchOnly;

  HttpRequest->OnProcessRequestComplete().BindLambda(
      [WeakThis, UrlCopy, TypeCopy, bPrefetch](
          FHttpRequestPtr Req, FHttpResponsePtr Resp, bool bConnected) {
        if (!WeakThis.IsValid()) return;

        auto* Self = WeakThis.Get();

        if (!bConnected || !Resp.IsValid() || Resp->GetResponseCode() != 200) {
          UE_LOG(LogGatrixImageLoader, Warning,
                 TEXT("Download failed: %s (HTTP %d)"), *UrlCopy,
                 Resp.IsValid() ? Resp->GetResponseCode() : 0);

          AsyncTask(ENamedThreads::GameThread, [WeakThis, UrlCopy, bPrefetch]() {
            if (!WeakThis.IsValid()) return;
            auto* S = WeakThis.Get();

            FGatrixImageResult EmptyResult;
            {
              FScopeLock Lock(&S->DownloadQueueLock);
              if (TArray<FGatrixImageLoadedDelegate>* Cbs = S->PendingCallbacks.Find(UrlCopy)) {
                for (auto& Cb : *Cbs) {
                  Cb.ExecuteIfBound(false, EmptyResult);
                }
              }
              S->PendingCallbacks.Remove(UrlCopy);
              S->ActiveDownloads--;
            }
            S->ProcessDownloadQueue();
          });
          return;
        }

        // Got raw bytes — save to disk cache
        TArray<uint8> RawData = Resp->GetContent();
        Self->SaveToDiskCache(UrlCopy, RawData);

        if (bPrefetch) {
          // Prefetch: just cache to disk, don't decode
          AsyncTask(ENamedThreads::GameThread, [WeakThis, UrlCopy]() {
            if (!WeakThis.IsValid()) return;
            auto* S = WeakThis.Get();
            FScopeLock Lock(&S->DownloadQueueLock);
            S->PendingCallbacks.Remove(UrlCopy);
            S->ActiveDownloads--;
            S->ProcessDownloadQueue();
          });
          return;
        }

        // Decode on background thread
        Self->DecodeImageAsync(RawData, TypeCopy, UrlCopy,
          [WeakThis, UrlCopy](bool bSuccess, int32 Width, int32 Height,
                               const TArray<uint8>& RGBAData,
                               const TArray<TPair<TArray<uint8>, int32>>& GifFrames) {
            AsyncTask(ENamedThreads::GameThread, [WeakThis, UrlCopy, bSuccess, Width, Height, RGBAData, GifFrames]() {
              if (!WeakThis.IsValid()) return;
              auto* S = WeakThis.Get();

              FGatrixImageResult Result;
              Result.Width = Width;
              Result.Height = Height;

              if (GifFrames.Num() > 0) {
                for (const auto& GifFrame : GifFrames) {
                  UTexture2DDynamic* FrameTex = CreateTextureFromRGBA(GifFrame.Key, Width, Height);
                  if (FrameTex) {
                    Result.GifFrames.Add(FrameTex);
                    Result.GifFrameDelays.Add(GifFrame.Value);
                  }
                }
                if (Result.GifFrames.Num() > 0) {
                  Result.Texture = Result.GifFrames[0];
                }
              } else if (bSuccess) {
                Result.Texture = CreateTextureFromRGBA(RGBAData, Width, Height);
              }

              bool bValid = Result.IsValid();
              if (bValid) {
                S->AddToMemoryCache(UrlCopy, Result);
              }

              // Notify all waiting callbacks
              {
                FScopeLock Lock(&S->DownloadQueueLock);
                if (TArray<FGatrixImageLoadedDelegate>* Cbs = S->PendingCallbacks.Find(UrlCopy)) {
                  for (auto& Cb : *Cbs) {
                    Cb.ExecuteIfBound(bValid, Result);
                  }
                }
                S->PendingCallbacks.Remove(UrlCopy);
                S->ActiveDownloads--;
              }
              S->ProcessDownloadQueue();
            });
          });
      });

  HttpRequest->ProcessRequest();
}

// ==================== Decoding ====================

void UGatrixImageLoader::DecodeImageAsync(
    const TArray<uint8>& Data, EGatrixFrameType FrameType, const FString& Url,
    TFunction<void(bool, int32, int32, const TArray<uint8>&,
                   const TArray<TPair<TArray<uint8>, int32>>&)>
        OnDecoded) {
  // Capture data by value for background thread
  AsyncTask(ENamedThreads::AnyBackgroundThreadNormalTask,
            [Data, FrameType, Url, OnDecoded]() {
              int32 Width = 0, Height = 0;
              TArray<uint8> RGBAData;
              TArray<TPair<TArray<uint8>, int32>> GifFrames;

              bool bSuccess = false;

              // Auto-detect actual format from file magic bytes (overrides server metadata)
              EGatrixFrameType ActualType = FrameType;
              if (Data.Num() >= 4) {
                const uint8* D = Data.GetData();
                // WebP: "RIFF" + 4 bytes + "WEBP"
                if (Data.Num() >= 12 &&
                    D[0] == 'R' && D[1] == 'I' && D[2] == 'F' && D[3] == 'F' &&
                    D[8] == 'W' && D[9] == 'E' && D[10] == 'B' && D[11] == 'P') {
                  ActualType = EGatrixFrameType::Webp;
                }
                // GIF: "GIF89a" or "GIF87a"
                else if (D[0] == 'G' && D[1] == 'I' && D[2] == 'F') {
                  ActualType = EGatrixFrameType::Gif;
                }
                // PNG: 0x89 'P' 'N' 'G'
                else if (D[0] == 0x89 && D[1] == 'P' && D[2] == 'N' && D[3] == 'G') {
                  ActualType = EGatrixFrameType::Png;
                }
                // JPG: 0xFF 0xD8 0xFF
                else if (D[0] == 0xFF && D[1] == 0xD8 && D[2] == 0xFF) {
                  ActualType = EGatrixFrameType::Jpg;
                }
                // SVG: starts with "<?xml" or "<svg" or whitespace+<
                else if (D[0] == '<' && (D[1] == '?' || D[1] == 's' || D[1] == 'S' ||
                                         D[1] == '!')) {
                  // Quick check for SVG content
                  FString Snippet = FString(FAnsiStringView(
                      reinterpret_cast<const char*>(D),
                      FMath::Min(Data.Num(), 512)));
                  if (Snippet.Contains(TEXT("<svg")) || Snippet.Contains(TEXT("<SVG"))) {
                    ActualType = EGatrixFrameType::Svg;
                  }
                }
              }

              if (ActualType != FrameType) {
                UE_LOG(LogGatrixImageLoader, Log,
                       TEXT("Format auto-detect: server said type=%d, actual=%d for %s"),
                       static_cast<int32>(FrameType), static_cast<int32>(ActualType), *Url);
              }

              switch (ActualType) {
                case EGatrixFrameType::Gif:
                  bSuccess = DecodeGif(Data, Width, Height, GifFrames);
                  break;

                case EGatrixFrameType::Webp:
                  bSuccess = DecodeWebP(Data, Width, Height, RGBAData, GifFrames);
                  break;



                case EGatrixFrameType::Svg:
                  UE_LOG(LogGatrixImageLoader, Warning,
                         TEXT("SVG format detected but not supported: %s"), *Url);
                  break;

                case EGatrixFrameType::Jpg:
                case EGatrixFrameType::Png:
                default:
                  bSuccess = DecodeStandardImage(Data, Width, Height, RGBAData);
                  break;
              }

              if (!bSuccess) {
                UE_LOG(LogGatrixImageLoader, Warning,
                       TEXT("Decode failed for: %s (detected=%d, server=%d)"), *Url,
                       static_cast<int32>(ActualType), static_cast<int32>(FrameType));
              }

              OnDecoded(bSuccess, Width, Height, RGBAData, GifFrames);
            });
}

UTexture2DDynamic* UGatrixImageLoader::CreateTextureFromRGBA(
    const TArray<uint8>& RGBAData, int32 Width, int32 Height) {
  check(IsInGameThread());

  if (Width <= 0 || Height <= 0 || RGBAData.Num() < Width * Height * 4) {
    return nullptr;
  }

  UTexture2DDynamic* Texture =
      UTexture2DDynamic::Create(Width, Height, PF_R8G8B8A8);
  if (!Texture) return nullptr;

  Texture->AddToRoot();
  Texture->SRGB = true;

  // Ensure render resource is fully created before accessing it
  FlushRenderingCommands();

  FTexture2DDynamicResource* TextureResource =
      static_cast<FTexture2DDynamicResource*>(Texture->GetResource());
  if (TextureResource) {
    TArray<uint8> DataCopy = RGBAData;
    int32 W = Width;
    int32 H = Height;
    ENQUEUE_RENDER_COMMAND(UpdateGatrixTexture)
    ([TextureResource, DataCopy = MoveTemp(DataCopy), W, H](FRHICommandListImmediate& RHICmdList) {
      FTexture2DRHIRef TextureRHI = TextureResource->GetTexture2DRHI();
      if (TextureRHI.IsValid()) {
        uint32 Stride = 0;
        void* TextureData = RHILockTexture2D(
            TextureRHI, 0, RLM_WriteOnly, Stride, false);
        if (TextureData) {
          const int32 SrcPitch = W * 4;
          if ((int32)Stride == SrcPitch) {
            FMemory::Memcpy(TextureData, DataCopy.GetData(), DataCopy.Num());
          } else {
            const uint8* SrcPtr = DataCopy.GetData();
            uint8* DstPtr = static_cast<uint8*>(TextureData);
            for (int32 y = 0; y < H; ++y) {
              FMemory::Memcpy(DstPtr, SrcPtr, SrcPitch);
              SrcPtr += SrcPitch;
              DstPtr += Stride;
            }
          }
          RHIUnlockTexture2D(TextureRHI, 0, false);
        }
      }
    });
    FlushRenderingCommands();
  } else {
    UE_LOG(LogGatrixImageLoader, Error,
           TEXT("CreateTextureFromRGBA: GetResource() returned null for %dx%d texture"), Width, Height);
  }

  return Texture;
}

bool UGatrixImageLoader::DecodeStandardImage(const TArray<uint8>& Data,
                                             int32& OutWidth, int32& OutHeight,
                                             TArray<uint8>& OutRGBA) {
  IImageWrapperModule& ImageWrapperModule =
      FModuleManager::LoadModuleChecked<IImageWrapperModule>(TEXT("ImageWrapper"));

  // Detect format
  EImageFormat DetectedFormat = ImageWrapperModule.DetectImageFormat(
      Data.GetData(), Data.Num());

  if (DetectedFormat == EImageFormat::Invalid) {
    return false;
  }

  TSharedPtr<IImageWrapper> ImageWrapper =
      ImageWrapperModule.CreateImageWrapper(DetectedFormat);

  if (!ImageWrapper.IsValid()) return false;

  if (!ImageWrapper->SetCompressed(Data.GetData(), Data.Num())) {
    return false;
  }

  OutWidth = ImageWrapper->GetWidth();
  OutHeight = ImageWrapper->GetHeight();

  TArray<uint8> RawData;
  if (!ImageWrapper->GetRaw(ERGBFormat::RGBA, 8, RawData)) {
    return false;
  }

  OutRGBA = MoveTemp(RawData);
  return true;
}

bool UGatrixImageLoader::DecodeWebP(const TArray<uint8>& Data,
                                    int32& OutWidth, int32& OutHeight,
                                    TArray<uint8>& OutRGBA,
                                    TArray<TPair<TArray<uint8>, int32>>& OutGifFrames) {
  UE_LOG(LogGatrixImageLoader, Log,
         TEXT("DecodeWebP: data size=%d, libwebp available=%s"),
         Data.Num(),
         FGatrixWebPDecoder::IsFullDecodeAvailable() ? TEXT("YES") : TEXT("NO"));

  // Strategy 1: Try animated WebP via libwebp demux
  if (FGatrixWebPDecoder::IsFullDecodeAvailable()) {
    std::vector<FGatrixGifFrame> AnimFrames;
    UE_LOG(LogGatrixImageLoader, Log, TEXT("DecodeWebP: Attempting DecodeAnimated..."));
    bool bAnimResult = FGatrixWebPDecoder::DecodeAnimated(Data.GetData(), Data.Num(), OutWidth, OutHeight, AnimFrames);
    UE_LOG(LogGatrixImageLoader, Log,
           TEXT("DecodeWebP: DecodeAnimated returned %s, frames=%d, size=%dx%d"),
           bAnimResult ? TEXT("TRUE") : TEXT("FALSE"),
           static_cast<int32>(AnimFrames.size()), OutWidth, OutHeight);

    if (bAnimResult && AnimFrames.size() > 1) {
      for (const auto& Frame : AnimFrames) {
        TArray<uint8> FrameData;
        FrameData.SetNumUninitialized(Frame.RGBA.size());
        FMemory::Memcpy(FrameData.GetData(), Frame.RGBA.data(), Frame.RGBA.size());
        OutGifFrames.Add(TPair<TArray<uint8>, int32>(MoveTemp(FrameData), Frame.DelayMs));
      }
      UE_LOG(LogGatrixImageLoader, Log,
             TEXT("WebP: Decoded Animated via libwebp (%dx%d, %d frames)"),
             OutWidth, OutHeight, static_cast<int32>(AnimFrames.size()));
      return true;
    }

    if (bAnimResult && AnimFrames.size() == 1) {
      OutRGBA.SetNumUninitialized(AnimFrames[0].RGBA.size());
      FMemory::Memcpy(OutRGBA.GetData(), AnimFrames[0].RGBA.data(), AnimFrames[0].RGBA.size());
      UE_LOG(LogGatrixImageLoader, Log,
             TEXT("WebP: Decoded Static via libwebp (%dx%d)"), OutWidth, OutHeight);
      return true;
    }

    // DecodeAnimated failed, try static decode as fallback
    UE_LOG(LogGatrixImageLoader, Log, TEXT("DecodeWebP: Attempting static Decode..."));
    std::vector<uint8_t> RGBAVec;
    bool bStaticResult = FGatrixWebPDecoder::Decode(Data.GetData(), Data.Num(), OutWidth, OutHeight, RGBAVec);
    UE_LOG(LogGatrixImageLoader, Log,
           TEXT("DecodeWebP: Decode returned %s, size=%dx%d, rgba=%d"),
           bStaticResult ? TEXT("TRUE") : TEXT("FALSE"),
           OutWidth, OutHeight, static_cast<int32>(RGBAVec.size()));
    if (bStaticResult) {
      OutRGBA.SetNumUninitialized(RGBAVec.size());
      FMemory::Memcpy(OutRGBA.GetData(), RGBAVec.data(), RGBAVec.size());
      return true;
    }
  } else {
    // No libwebp - try minimal decoder
    UE_LOG(LogGatrixImageLoader, Log, TEXT("DecodeWebP: No libwebp, trying minimal..."));
    std::vector<uint8_t> RGBAVec;
    if (FGatrixWebPDecoder::Decode(Data.GetData(), Data.Num(), OutWidth, OutHeight, RGBAVec)) {
      OutRGBA.SetNumUninitialized(RGBAVec.size());
      FMemory::Memcpy(OutRGBA.GetData(), RGBAVec.data(), RGBAVec.size());
      return true;
    }
  }

  // Strategy 2: Try UE4's ImageWrapper
  UE_LOG(LogGatrixImageLoader, Log, TEXT("DecodeWebP: Trying ImageWrapper fallback..."));
  {
    IImageWrapperModule& ImageWrapperModule =
        FModuleManager::LoadModuleChecked<IImageWrapperModule>(TEXT("ImageWrapper"));

    EImageFormat DetectedFormat = ImageWrapperModule.DetectImageFormat(
        Data.GetData(), Data.Num());

    UE_LOG(LogGatrixImageLoader, Log,
           TEXT("DecodeWebP: ImageWrapper DetectedFormat=%d"),
           static_cast<int32>(DetectedFormat));

    if (DetectedFormat != EImageFormat::Invalid) {
      TSharedPtr<IImageWrapper> Wrapper =
          ImageWrapperModule.CreateImageWrapper(DetectedFormat);
      if (Wrapper.IsValid() && Wrapper->SetCompressed(Data.GetData(), Data.Num())) {
        OutWidth = Wrapper->GetWidth();
        OutHeight = Wrapper->GetHeight();
        TArray<uint8> Raw;
        if (Wrapper->GetRaw(ERGBFormat::BGRA, 8, Raw)) {
          OutRGBA.SetNumUninitialized(Raw.Num());
          const uint8* Src = Raw.GetData();
          uint8* Dst = OutRGBA.GetData();
          int32 PixelCount = OutWidth * OutHeight;
          for (int32 i = 0; i < PixelCount; ++i) {
            Dst[i * 4 + 0] = Src[i * 4 + 2];
            Dst[i * 4 + 1] = Src[i * 4 + 1];
            Dst[i * 4 + 2] = Src[i * 4 + 0];
            Dst[i * 4 + 3] = Src[i * 4 + 3];
          }
          UE_LOG(LogGatrixImageLoader, Log,
                 TEXT("WebP: Decoded via ImageWrapper (%dx%d)"), OutWidth, OutHeight);
          return true;
        }
      }
    }
  }

  UE_LOG(LogGatrixImageLoader, Warning,
         TEXT("WebP: ALL decode strategies failed for data size: %d"), Data.Num());
  return false;
}

bool UGatrixImageLoader::DecodeGif(const TArray<uint8>& Data,
                                   int32& OutWidth, int32& OutHeight,
                                   TArray<TPair<TArray<uint8>, int32>>& OutFrames) {
  // Use GatrixGifDecoder for full multi-frame GIF support
  FGatrixGifDecoder Decoder;
  if (Decoder.Load(Data.GetData(), Data.Num())) {
    OutWidth = Decoder.GetWidth();
    OutHeight = Decoder.GetHeight();

    UE_LOG(LogGatrixImageLoader, Log,
           TEXT("GIF: Decoded %d frames (%dx%d)"),
           Decoder.GetFrameCount(), OutWidth, OutHeight);

    for (int32 i = 0; i < Decoder.GetFrameCount(); ++i) {
      const FGatrixGifFrame& GifFrame = Decoder.GetFrame(i);

      TArray<uint8> RGBAData;
      RGBAData.SetNumUninitialized(GifFrame.RGBA.size());
      FMemory::Memcpy(RGBAData.GetData(), GifFrame.RGBA.data(), GifFrame.RGBA.size());

      OutFrames.Add(TPair<TArray<uint8>, int32>(MoveTemp(RGBAData), GifFrame.DelayMs));
    }

    return OutFrames.Num() > 0;
  }

  // Fallback: Try UE4's ImageWrapper (single-frame only)
  if (Data.Num() >= 6 && Data[0] == 'G' && Data[1] == 'I' && Data[2] == 'F') {
    // Extract dimensions from GIF header
    OutWidth = Data[6] | (Data[7] << 8);
    OutHeight = Data[8] | (Data[9] << 8);

    IImageWrapperModule& ImageWrapperModule =
        FModuleManager::LoadModuleChecked<IImageWrapperModule>(TEXT("ImageWrapper"));
    EImageFormat DetectedFormat = ImageWrapperModule.DetectImageFormat(
        Data.GetData(), Data.Num());

    if (DetectedFormat != EImageFormat::Invalid) {
      TSharedPtr<IImageWrapper> Wrapper =
          ImageWrapperModule.CreateImageWrapper(DetectedFormat);
      if (Wrapper.IsValid() && Wrapper->SetCompressed(Data.GetData(), Data.Num())) {
        TArray<uint8> Raw;
        if (Wrapper->GetRaw(ERGBFormat::RGBA, 8, Raw)) {
          OutFrames.Add(TPair<TArray<uint8>, int32>(MoveTemp(Raw), 100));
          UE_LOG(LogGatrixImageLoader, Log,
                 TEXT("GIF: Fallback to ImageWrapper (single frame)"));
          return true;
        }
      }
    }
  }

  UE_LOG(LogGatrixImageLoader, Warning, TEXT("GIF: All decode strategies failed"));
  return false;
}
