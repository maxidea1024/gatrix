/**
 * GatrixWebPDecoder — WebP decode wrapper for UE4.
 *
 * Thin C++ wrapper around libwebp's decode API.
 * Falls back to UE4's ImageWrapper if libwebp is not available.
 *
 * Setup:
 *   1. Download libwebp: https://developers.google.com/speed/webp/download
 *   2. Place headers in ThirdParty/libwebp/include/webp/
 *   3. Place libraries:
 *      - Win64: ThirdParty/libwebp/lib/Win64/webp.lib
 *      - iOS:   ThirdParty/libwebp/lib/iOS/libwebp.a
 *   4. Enable GATRIX_HAS_LIBWEBP in Build.cs
 */

#pragma once

#include <cstdint>
#include <cstring>
#include <vector>

// Set to 1 when libwebp is properly installed
#ifndef GATRIX_HAS_LIBWEBP
#define GATRIX_HAS_LIBWEBP 0
#endif

#if GATRIX_HAS_LIBWEBP
#include "webp/decode.h"
#include "webp/demux.h"
#endif

// We use FGatrixGifFrame structure for both GIF and animated WebP frames
#include "GatrixGifDecoder.h"

class FGatrixWebPDecoder {
public:
  /**
   * Decode WebP image data into RGBA pixel buffer (for static frames).
   *
   * @param Data      Raw WebP file bytes
   * @param DataSize  Size of data in bytes
   * @param OutWidth  Output image width
   * @param OutHeight Output image height
   * @param OutRGBA   Output RGBA pixel data (width * height * 4 bytes)
   * @return true on success
   */
  static bool Decode(const uint8_t* Data, size_t DataSize,
                     int32_t& OutWidth, int32_t& OutHeight,
                     std::vector<uint8_t>& OutRGBA) {
    if (!Data || DataSize < 12) return false;

    // Verify WebP signature: "RIFF" + 4 bytes size + "WEBP"
    if (Data[0] != 'R' || Data[1] != 'I' || Data[2] != 'F' || Data[3] != 'F' ||
        Data[8] != 'W' || Data[9] != 'E' || Data[10] != 'B' || Data[11] != 'P') {
      return false;
    }

#if GATRIX_HAS_LIBWEBP
    return DecodeWithLibWebP(Data, DataSize, OutWidth, OutHeight, OutRGBA);
#else
    return DecodeMinimal(Data, DataSize, OutWidth, OutHeight, OutRGBA);
#endif
  }

  /**
   * Decode Animated WebP image data into a sequence of frames.
   */
  static bool DecodeAnimated(const uint8_t* Data, size_t DataSize,
                             int32_t& OutWidth, int32_t& OutHeight,
                             std::vector<FGatrixGifFrame>& OutFrames) {
#if GATRIX_HAS_LIBWEBP
    WebPData WebPDataChunk;
    WebPDataChunk.bytes = Data;
    WebPDataChunk.size = DataSize;

    WebPAnimDecoderOptions Options;
    if (!WebPAnimDecoderOptionsInit(&Options)) {
      return false;
    }
    Options.color_mode = MODE_RGBA;
    Options.use_threads = 1;

    WebPAnimDecoder* Dec = WebPAnimDecoderNew(&WebPDataChunk, &Options);
    if (!Dec) {
      return false;
    }

    WebPAnimInfo AnimInfo;
    WebPAnimDecoderGetInfo(Dec, &AnimInfo);

    OutWidth = AnimInfo.canvas_width;
    OutHeight = AnimInfo.canvas_height;

    int PrevTimestamp = 0;
    while (WebPAnimDecoderHasMoreFrames(Dec)) {
      uint8_t* Buf = nullptr;
      int Timestamp = 0; // Represents END time of the frame
      if (WebPAnimDecoderGetNext(Dec, &Buf, &Timestamp)) {
        FGatrixGifFrame Frame;
        size_t FrameBytes = OutWidth * OutHeight * 4;
        Frame.RGBA.resize(FrameBytes);
        std::memcpy(Frame.RGBA.data(), Buf, FrameBytes);

        Frame.DelayMs = Timestamp - PrevTimestamp;
        if (Frame.DelayMs <= 0) Frame.DelayMs = 100;
        PrevTimestamp = Timestamp;

        OutFrames.push_back(std::move(Frame));
      } else {
        break;
      }
    }

    WebPAnimDecoderDelete(Dec);
    return OutFrames.size() > 0;
#else
    return false;
#endif
  }

  /** Check if full WebP decode support is available */
  static bool IsFullDecodeAvailable() {
#if GATRIX_HAS_LIBWEBP
    return true;
#else
    return false;
#endif
  }

private:
#if GATRIX_HAS_LIBWEBP
  static bool DecodeWithLibWebP(const uint8_t* Data, size_t DataSize,
                                 int32_t& OutWidth, int32_t& OutHeight,
                                 std::vector<uint8_t>& OutRGBA) {
    int W = 0, H = 0;

    // Get dimensions first
    if (!WebPGetInfo(Data, DataSize, &W, &H)) {
      return false;
    }

    OutWidth = W;
    OutHeight = H;

    // Decode to RGBA
    uint8_t* Pixels = WebPDecodeRGBA(Data, DataSize, &W, &H);
    if (!Pixels) {
      return false;
    }

    // Copy to output vector
    size_t PixelCount = static_cast<size_t>(W) * H * 4;
    OutRGBA.resize(PixelCount);
    std::memcpy(OutRGBA.data(), Pixels, PixelCount);

    // Free libwebp-allocated memory
    WebPFree(Pixels);

    return true;
  }
#endif

  /**
   * Minimal WebP decoder — extracts VP8 lossless "simple" images only.
   * This handles a subset of WebP files (VP8L headers with simple format).
   * For production use with all WebP variants, install libwebp.
   */
  static bool DecodeMinimal(const uint8_t* Data, size_t DataSize,
                            int32_t& OutWidth, int32_t& OutHeight,
                            std::vector<uint8_t>& OutRGBA) {
    // Parse RIFF header
    if (DataSize < 20) return false;

    // Skip RIFF header (12 bytes)
    size_t Pos = 12;

    // Read first chunk
    if (Pos + 8 > DataSize) return false;

    char ChunkId[5] = {};
    std::memcpy(ChunkId, Data + Pos, 4);
    Pos += 4;

    uint32_t ChunkSize = Data[Pos] | (Data[Pos + 1] << 8) |
                         (Data[Pos + 2] << 16) | (Data[Pos + 3] << 24);
    Pos += 4;

    // VP8L (lossless) header — try to extract dimensions
    if (std::strcmp(ChunkId, "VP8L") == 0 && Pos + 5 <= DataSize) {
      uint8_t Signature = Data[Pos];
      if (Signature != 0x2F) return false; // VP8L signature byte

      // Bits 0-13: width-1, bits 14-27: height-1
      uint32_t Bits = Data[Pos + 1] | (Data[Pos + 2] << 8) |
                      (Data[Pos + 3] << 16) | (Data[Pos + 4] << 24);
      OutWidth = (Bits & 0x3FFF) + 1;
      OutHeight = ((Bits >> 14) & 0x3FFF) + 1;

      // We can't decompress VP8L without a full decoder
      // Return false to let the caller try other methods
      return false;
    }

    // VP8 (lossy) header
    if (std::strcmp(ChunkId, "VP8 ") == 0 && Pos + 10 <= DataSize) {
      // Frame tag (3 bytes)
      // Start code: 0x9D 0x01 0x2A
      if (Data[Pos + 3] == 0x9D && Data[Pos + 4] == 0x01 && Data[Pos + 5] == 0x2A) {
        OutWidth = Data[Pos + 6] | ((Data[Pos + 7] & 0x3F) << 8);
        OutHeight = Data[Pos + 8] | ((Data[Pos + 9] & 0x3F) << 8);
      }
      // Can't decompress VP8 lossy without a full decoder
      return false;
    }

    return false; // Unrecognized format
  }
};
