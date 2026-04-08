# Gatrix Client SDK — Banner & Web Image Specification

This document specifies the architecture, behavior, and requirements for the Banner and Web Image subsystems in Gatrix Client SDKs.

> [!IMPORTANT]
> This document covers the **image loading, caching, and display** aspects of the SDK.
> For feature flag specifications, see `CLIENT_SDK_SPEC.md`.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Central Image Manager](#central-image-manager)
3. [Image Source Model](#image-source-model)
4. [Memory Strategy](#memory-strategy)
5. [Texture Sharing (Font-Glyph Pattern)](#texture-sharing-font-glyph-pattern)
6. [Independent Playback](#independent-playback)
7. [TTL-Based Eviction](#ttl-based-eviction)
8. [Image Loader](#image-loader)
9. [Banner Client](#banner-client)
10. [ETag-Based Conditional Fetching](#etag-based-conditional-fetching)
11. [Disk Caching](#disk-caching)
12. [Image Prefetching](#image-prefetching)
13. [Consumer Widgets](#consumer-widgets)
14. [Configuration Reference](#configuration-reference)
15. [Implementation Checklist](#implementation-checklist)

---

## Architecture Overview

```
┌───────────────────────────────────────────────────────┐
│                  Consumer Layer                        │
│  UGatrixWebImage   UGatrixBannerWidget   Lua Binding  │
│  (holds TSharedPtr<FGatrixImageSource>)               │
└──────────────┬────────────────────────────────────────┘
               │ AcquireSource / ReleaseSource
               ▼
┌───────────────────────────────────────────────────────┐
│              UGatrixImageManager (Singleton)           │
│  - URL → ImageSource map (1 source per unique URL)    │
│  - Tick: advances all animated textures               │
│  - TTL eviction: delayed cleanup of unused sources    │
│  - Reference counting per source                      │
└──────────────┬────────────────────────────────────────┘
               │ LoadImageRaw (no GPU textures)
               ▼
┌───────────────────────────────────────────────────────┐
│              UGatrixImageLoader (Singleton)            │
│  - HTTP download with queue + concurrency limit       │
│  - Disk cache (URL hash → file)                       │
│  - Format detection from magic bytes                  │
│  - Decode: GIF, WebP, PNG, JPG → raw bytes + metadata │
└───────────────────────────────────────────────────────┘
```

---

## Central Image Manager

The `UGatrixImageManager` is a **singleton** that owns all image sources and is the **only** entity that creates GPU textures for images.

### Responsibilities

| Responsibility | Description |
|---|---|
| Source registry | Maintains a `URL → ImageSource` map. One source per unique URL. |
| Reference counting | Tracks `ActiveConsumerCount` per source. |
| Shared texture updates | Each Tick, advances animated sources and uploads RGBA to their shared GPU texture. |
| Sliding decode window | Only N frames of decoded RGBA exist per animated source at any time. |
| TTL eviction | Removes zero-consumer sources after a configurable grace period. |
| Prefetch | Delegates to ImageLoader to download and disk-cache images without decoding. |

### Public API

```cpp
// Acquire a shared reference (increments consumer count)
TSharedPtr<FGatrixImageSource> AcquireSource(URL, FrameType, OnReadyCallback);

// Release reference (decrements consumer count, source kept alive by grace period)
void ReleaseSource(TSharedPtr<FGatrixImageSource>& Source);

// Download + disk-cache without decoding (for banner prefetch)
void Prefetch(const TArray<FString>& Urls);

// Configuration
void SetMaxSources(int32 Max);           // Default: 64
void SetDecodeWindowSize(int32 Size);    // Default: 3
void SetEvictionGracePeriod(float Sec);  // Default: 30s
void SetMaxConcurrentDownloads(int32 N); // Default: 4
```

---

## Image Source Model

```cpp
struct FGatrixImageSource {
    FString Url;                         // Unique key
    int32 Width, Height;                 // Dimensions
    EGatrixFrameType FrameType;          // Detected format
    
    // Static images
    UTexture2DDynamic* StaticTexture;    // Single GPU texture
    
    // Animated images (GIF/WebP)
    TArray<uint8> CompressedData;        // Original file bytes
    int32 FrameCount;                    // Total frames
    TArray<int32> FrameDelays;           // ms per frame
    TArray<FGatrixDecodedFrame> DecodedWindow;  // Sliding window
    UTexture2DDynamic* SharedAnimTexture;        // Single shared GPU texture
    
    // State
    EGatrixImageSourceState State;       // Loading / Ready / Failed
    int32 ActiveConsumerCount;           // Reference count
    double LastAccessTime;               // For TTL eviction
};
```

> [!IMPORTANT]
> The `CompressedData` field stores the **original file bytes** (GIF/WebP), NOT decoded RGBA.
> Decoded RGBA is only kept for a small sliding window of frames (default 3).

---

## Memory Strategy

### Before Optimization (Problem)

For a 70-frame 200×200 GIF:
- Per-frame RGBA: 200 × 200 × 4 = 160KB
- Total for all frames: 160KB × 70 = **~11.2MB per consumer**
- 10 widgets showing the same GIF: **~112MB total**
- Each consumer also held its own GPU texture per frame: **70 GPU textures per widget**

### After Optimization (Solution)

For the same 70-frame 200×200 GIF:
- Compressed GIF data: ~100KB (shared)
- Sliding window (3 frames): 160KB × 3 = ~480KB
- Shared GPU texture: 1 (regardless of consumer count)
- **Total: ~580KB** vs 112MB = **~99.5% reduction**

### Memory Budget Per Source Type

| Source Type | Compressed | Decode Window | GPU Textures | Total (approx) |
|---|---|---|---|---|
| PNG/JPG (static) | 0 | 0 | 1 | ~100KB |
| GIF (70 frames) | ~100KB | 3 × 160KB = 480KB | 1 | ~580KB |
| WebP animated | ~50-200KB | 3 × frame_size | 1 | ~300KB-1MB |

---

## Texture Sharing (Font-Glyph Pattern)

> [!IMPORTANT]
> Images are fundamentally treated as **"picture fonts"** — shared, read-only glyphs.
> Multiple consumers displaying the same URL **always share a single GPU texture**.
> The Manager updates the pixel data of this shared texture each tick.
> Consumers do NOT manage their own animation state.

### How It Works

1. **Static images**: Manager creates one `UTexture2DDynamic`. All consumers reference it.
2. **Animated images**: Manager creates one `SharedAnimTexture`. Each tick, the Manager:
   - Advances the frame counter
   - Decodes the next frame (if not in decode window)
   - Uploads RGBA to the shared texture via `ENQUEUE_RENDER_COMMAND`
3. **Consumer widgets**: Just call `SetBrushFromTextureDynamic(Source->GetDisplayTexture())` once. The underlying pixel data updates automatically.

### Animated Playback Rule

> An animated source's playback is **always active** as long as `ActiveConsumerCount > 0`.
> If even one consumer is still showing a banner/image with this URL, the animation runs.
> When `ActiveConsumerCount` drops to 0, animation stops (no wasted CPU).

---

## Independent Playback

By default, all consumers share the same playback state (the "font glyph" pattern). However, when **independent playback** is needed:

### Banner Sequence Playback

The `UGatrixBannerWidget`'s `Play()`, `Stop()`, `Pause()` functions control the **banner sequence playback** (which frame/sequence to show next), NOT the GIF animation. This is handled by `UGatrixBannerPlayback`.

### Independent GIF/WebP Playback (Future)

If a consumer needs its own animation timing (e.g., starting from frame 0 independently), it **still shares the image data** (compressed bytes, decode window) from the Manager. Only the playback state (current frame, accumulator) is independent. The consumer would need its own `UTexture2DDynamic` for GPU upload in this case.

> [!IMPORTANT]
> Even with independent playback, **image data is always shared**.
> Only the playback state and potentially the GPU texture are duplicated.

---

## TTL-Based Eviction

> [!IMPORTANT]
> Sources with `ActiveConsumerCount == 0` are **NOT immediately removed**.
> They are kept alive for a configurable **grace period** (default: 30 seconds).
> This prevents thrashing when sources are rapidly released and re-acquired
> (e.g., banner frame switching, screen transitions).

### Eviction Algorithm

1. **Tick interval**: Eviction check runs every 5 seconds (configurable).
2. **Only when over capacity**: Eviction only triggers when `Sources.Num() > MaxSources`.
3. **Grace period**: A source is only eligible for eviction when:
   - `ActiveConsumerCount == 0`
   - `CurrentTime - LastAccessTime > EvictionGracePeriodSeconds`
4. **LRU order**: Among eligible sources, the oldest (by `LastAccessTime`) is evicted first.
5. **Cleanup**: Eviction releases GPU textures, decoded window, and compressed data.

### Eviction Safeguards

| Condition | Result |
|---|---|
| `ActiveConsumerCount > 0` | Never evicted |
| `State == Loading` | Never evicted |
| Within grace period | Not yet eligible |
| Over `MaxSources` capacity | LRU eviction of eligible sources |

---

## Image Loader

The `UGatrixImageLoader` is a **download and disk-cache engine**. It does NOT manage GPU textures for the Manager path.

### Key APIs

| Method | Purpose |
|---|---|
| `LoadImageRaw(URL, FrameType, Callback)` | Download → disk cache → extract metadata (no GPU textures) |
| `Prefetch(URLs)` | Download → disk cache only |
| `LoadFromDiskCache(URL, OutData)` | Read cached file from disk |
| `DecodeStandardImage(Data, W, H, RGBA)` | Decode PNG/JPG to RGBA (static, thread-safe) |
| `DecodeGif(Data, W, H, Frames)` | Full GIF decode (static, thread-safe) |
| `DecodeWebP(Data, W, H, RGBA, Frames)` | WebP decode (static, thread-safe) |

### FGatrixImageRawResult

```cpp
struct FGatrixImageRawResult {
    TArray<uint8> RawBytes;        // Original file bytes
    EGatrixFrameType DetectedType; // Auto-detected from magic bytes
    int32 Width, Height;           // Dimensions
    int32 FrameCount;              // 1 for static, N for animated
    TArray<int32> FrameDelays;     // ms per frame (animated only)
    bool bFromDiskCache;           // Was this loaded from disk cache
};
```

### Format Detection

Format is auto-detected from file magic bytes:

| Magic Bytes | Format |
|---|---|
| `RIFF....WEBP` | WebP |
| `GIF8` | GIF |
| `\x89PNG` | PNG |
| `\xFF\xD8\xFF` | JPEG |

---

## Banner Client

The `UGatrixBannerClient` fetches banner metadata from the Gatrix API.

### ETag-Based Conditional Fetching

> [!IMPORTANT]
> All banner list API requests MUST use ETag-based conditional fetching.

1. **First request**: Normal `GET /client/banners`
2. **Server responds** with `ETag: "abc123"` header
3. **Subsequent requests**: Include `If-None-Match: "abc123"` header
4. **Server responds with 304**: Data unchanged → use cached data
5. **Server responds with 200**: New data → update cache and ETag

### API Flow

```
Client                           Server
  │                                 │
  │  GET /client/banners            │
  │  If-None-Match: "etag-xyz"     │
  │ ──────────────────────────────▶ │
  │                                 │
  │  304 Not Modified               │  (data unchanged)
  │ ◀────────────────── ─────────── │
  │  → Use cached banners           │
  │                                 │
  │  200 OK                         │  (data changed)
  │  ETag: "etag-new"              │
  │  Body: { banners: [...] }       │
  │ ◀────────────────── ─────────── │
  │  → Update cache + ETag          │
  │  → Save to disk                 │
  │  → Prefetch images              │
```

---

## Disk Caching

### Banner Data Cache

| Item | Path | Format |
|---|---|---|
| Banner list | `{ProjectSaved}/GatrixCache/Banners/banner_list.json` | JSON array |
| Banner list ETag | `{ProjectSaved}/GatrixCache/Banners/banner_list.etag` | Plain text |
| Individual banner | `{ProjectSaved}/GatrixCache/Banners/banner_{id}.json` | JSON object |

### Image Cache

| Item | Path | Format |
|---|---|---|
| Downloaded images | `{ProjectSaved}/GatrixCache/Images/{url_hash}` | Original bytes |

### Cache Behavior

1. **On startup**: BannerClient loads cached banner list from disk → populates memory cache
2. **On fetch**: If server returns 200, save new data to disk cache
3. **On network failure**: Fall back to disk-cached data if available
4. **On 304**: Use existing memory/disk cache (no write needed)

---

## Image Prefetching

> [!IMPORTANT]
> After every successful banner list fetch (200 OK), the BannerClient MUST prefetch all referenced image URLs.

### Prefetch Flow

1. BannerClient fetches banner list → parses all `imageUrl` fields
2. Calls `UGatrixImageManager::Prefetch(AllImageUrls)`
3. Manager delegates to `UGatrixImageLoader::Prefetch()`
4. Loader downloads each URL and saves to disk cache
5. NO decoding or GPU textures created during prefetch

### Benefits

- First banner display loads from disk cache (no network wait)
- Smooth playback even on slow networks
- MP4 URLs are excluded from prefetch (streamed directly)

---

## Consumer Widgets

### UGatrixWebImage

A lightweight widget that displays a single URL image.

**Key behavior:**
- Calls `AcquireSource()` on `SetImageUrl()` / `NativeConstruct()`
- Calls `ReleaseSource()` on `ClearImage()` / `NativeDestruct()`
- Does NOT manage its own animation tick (Manager handles it)
- Does NOT hold per-frame texture arrays
- Uses `NativeTick` only for future independent playback (currently no-op)

### UGatrixBannerWidget

A widget that displays a rotating banner sequence with transitions.

**Key behavior:**
- Banner sequence playback is controlled by `UGatrixBannerPlayback`
- Image data is managed by `UGatrixImageManager` via `AcquireSource()`
- `Play()` / `Stop()` / `Pause()` control **sequence playback**, not GIF animation
- Each frame change calls `ReleaseCurrentFrameSource()` then `AcquireSource()` for the new frame
- Prefetches upcoming frame images via `UGatrixImageManager::Prefetch()`

---

## Configuration Reference

| Parameter | Default | Description |
|---|---|---|
| `MaxSources` | 64 | Max image sources in memory |
| `DecodeWindowSize` | 3 | Decoded frames per animated source |
| `EvictionGracePeriod` | 30s | Seconds before zero-consumer eviction |
| `EvictionCheckInterval` | 5s | Eviction check frequency |
| `MaxConcurrentDownloads` | 4 | Parallel HTTP downloads |

---

## Implementation Checklist

For implementing this spec in a new SDK platform:

- [ ] **Central image manager** (singleton, tickable)
  - [ ] URL → ImageSource map
  - [ ] Reference counting (AcquireSource/ReleaseSource)
  - [ ] Shared texture per animated source (font-glyph pattern)
  - [ ] Sliding window decode for animated sources
  - [ ] TTL-based eviction with grace period
  - [ ] Periodic eviction check (not on every release)
- [ ] **Image loader**
  - [ ] HTTP download queue with concurrency limit
  - [ ] Disk cache (URL hash → file)
  - [ ] Format auto-detection from magic bytes
  - [ ] Raw metadata extraction (no GPU textures)
  - [ ] GIF/WebP/PNG/JPG decode
- [ ] **Banner client**
  - [ ] ETag-based conditional fetching (If-None-Match / 304)
  - [ ] Banner list disk caching (JSON)
  - [ ] Image prefetching after banner fetch
  - [ ] Offline startup from disk cache
- [ ] **Consumer widgets**
  - [ ] Use Manager for all image sources (no direct texture creation)
  - [ ] Release source in NativeDestruct/dispose
  - [ ] No per-widget animation tick (Manager handles it)

---

## Language Note

> [!CAUTION]
> All source code comments in the implementation MUST be written in **English**.
