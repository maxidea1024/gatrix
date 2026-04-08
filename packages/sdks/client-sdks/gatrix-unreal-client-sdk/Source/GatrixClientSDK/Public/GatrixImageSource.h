// Copyright Gatrix. All Rights Reserved.
// Centralized image source — represents a single URL's decoded media asset.
// One source per unique URL, shared across all consumers via reference counting.

#pragma once

#include "CoreMinimal.h"
#include "GatrixBannerTypes.h"
#include "Engine/Texture2DDynamic.h"

/**
 * State of an image source in the loading pipeline.
 */
enum class EGatrixImageSourceState : uint8 {
  /** Download/decode in progress */
  Loading,
  /** Ready for display */
  Ready,
  /** Download or decode failed */
  Failed
};

/**
 * A single decoded frame in the decode buffer.
 * Used temporarily during background decode before creating GPU textures.
 */
struct FGatrixDecodedFrame {
  int32 FrameIndex = -1;
  TArray<uint8> RGBA; // Width * Height * 4 bytes
};

/**
 * Centralized image source for a single URL.
 *
 * Design principles:
 * - GPU: Animated sources pre-create one UTexture2DDynamic per frame.
 *   All consumers share the SAME texture array. Tick just advances
 *   an index — zero game-thread cost during playback.
 * - Sharing: Multiple consumers (WebImage, BannerWidget) hold TSharedPtr
 *   references to the same source. The manager only evicts sources with
 *   zero consumers.
 * - Decode: All decoding happens on background threads. The game thread
 *   never performs any image decode operations.
 * - MP4 exception: Video frames are not managed here (use UMediaPlayer).
 *
 * Lifecycle:
 *   AcquireSource() → [Loading] → background decode → create textures
 *   → [Ready] → tick advances frame index → ... → ReleaseSource()
 *   → [Evictable after grace period]
 */
struct GATRIXCLIENTSDK_API FGatrixImageSource : public TSharedFromThis<FGatrixImageSource> {
  // ==================== Identity ====================

  /** The URL this source was loaded from (serves as the unique key) */
  FString Url;

  /** Detected media format */
  EGatrixFrameType FrameType = EGatrixFrameType::Png;

  // ==================== Dimensions ====================

  int32 Width = 0;
  int32 Height = 0;

  // ==================== Static Image ====================

  /** For non-animated images: the single GPU texture.
   *  Lifecycle managed by UGatrixImageManager (AddToRoot/RemoveFromRoot). */
  UTexture2DDynamic* StaticTexture = nullptr;

  // ==================== Animated Image (GIF/WebP) ====================

  /** Compressed original file bytes (GIF/WebP).
   *  Kept during decode phase; freed after all frame textures are created. */
  TArray<uint8> CompressedData;

  /** Total number of frames (extracted during initial metadata decode) */
  int32 FrameCount = 0;

  /** Per-frame display delays in milliseconds (extracted during initial decode) */
  TArray<int32> FrameDelays;

  // --- Decode Buffer (temporary, cleared after texture creation) ---

  /** Decoded RGBA frames from background thread.
   *  Populated by DecodeFramesAsync, consumed by CreateFrameTextures,
   *  then emptied to free RAM. */
  TArray<FGatrixDecodedFrame> DecodedWindow;

  /** True if a background decode task is currently running for this source */
  bool bDecodeInProgress = false;

  // --- Frame Textures (permanent, one per frame) ---

  /** Pre-created GPU textures, one per animation frame.
   *  Created from decoded RGBA on game thread after async decode completes.
   *  All consumers share these texture pointers.
   *  Lifecycle managed by UGatrixImageManager (AddToRoot/RemoveFromRoot). */
  TArray<UTexture2DDynamic*> FrameTextures;

  /** Current frame index being displayed */
  int32 SharedCurrentFrame = 0;

  /** Accumulated time for frame advancement */
  float SharedAccumulator = 0.0f;

  // ==================== State ====================

  EGatrixImageSourceState State = EGatrixImageSourceState::Loading;

  // ==================== Reference Management ====================

  /** Number of active consumers (WebImage, BannerWidget instances).
   *  Source is evictable only when this reaches zero. */
  int32 ActiveConsumerCount = 0;

  /** Timestamp of last access (for LRU eviction among zero-consumer sources) */
  double LastAccessTime = 0.0;

  // ==================== Queries ====================

  bool IsAnimated() const { return FrameCount > 1; }
  bool IsReady() const { return State == EGatrixImageSourceState::Ready; }

  /** Get the current display texture — static or current animated frame */
  UTexture2DDynamic* GetDisplayTexture() const {
    if (IsAnimated() && FrameTextures.IsValidIndex(SharedCurrentFrame)) {
      return FrameTextures[SharedCurrentFrame];
    }
    return StaticTexture;
  }
};
