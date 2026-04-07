/**
 * GatrixGifDecoder — In-memory GIF89a frame decoder for UE4.
 *
 * Decodes all frames from a GIF byte buffer into RGBA pixel arrays.
 * Based on the GIF89a specification. Handles:
 * - LZW decompression
 * - Global and local color tables
 * - Interlaced images
 * - Transparency
 * - Frame disposal methods
 * - Per-frame delay extraction (from Graphic Control Extension)
 *
 * This is a self-contained, single-header library. No external dependencies
 * beyond standard C/C++ headers. Safe for use on background threads.
 *
 * License: MIT (derived from lecram/gifdec, public domain)
 *
 * Usage:
 *   TArray<uint8> GifData = ...; // raw GIF bytes
 *   FGatrixGifDecoder Decoder;
 *   if (Decoder.Load(GifData.GetData(), GifData.Num())) {
 *     for (int i = 0; i < Decoder.GetFrameCount(); i++) {
 *       const FGatrixGifFrame& Frame = Decoder.GetFrame(i);
 *       // Frame.RGBA — width*height*4 bytes
 *       // Frame.DelayMs — display time in milliseconds
 *     }
 *   }
 */

#pragma once

#include <cstdint>
#include <cstring>
#include <cstdlib>
#include <vector>

struct FGatrixGifFrame {
  std::vector<uint8_t> RGBA; // width * height * 4 bytes
  int32_t DelayMs = 100;     // display time in milliseconds
};

class FGatrixGifDecoder {
public:
  bool Load(const uint8_t* Data, size_t DataSize) {
    Pos = 0;
    Buf = Data;
    BufSize = DataSize;
    Frames.clear();
    Width = Height = 0;

    if (!ReadHeader()) return false;
    if (!ReadGlobalColorTable()) return false;

    // Initialize canvas (RGBA) — fully transparent initially
    Canvas.resize(Width * Height * 4, 0);
    PrevCanvas.resize(Width * Height * 4, 0);

    // Decode all frames
    while (Pos < BufSize) {
      uint8_t Sep = ReadByte();
      if (Sep == 0x3B) break; // Trailer
      if (Sep == 0x21) {
        ReadExtension();
      } else if (Sep == 0x2C) {
        if (!ReadImageFrame()) break;
      } else {
        break; // Unknown block
      }
    }

    return Frames.size() > 0;
  }

  int32_t GetWidth() const { return Width; }
  int32_t GetHeight() const { return Height; }
  int32_t GetFrameCount() const { return static_cast<int32_t>(Frames.size()); }
  const FGatrixGifFrame& GetFrame(int32_t Index) const { return Frames[Index]; }

private:
  const uint8_t* Buf = nullptr;
  size_t BufSize = 0;
  size_t Pos = 0;

  int32_t Width = 0;
  int32_t Height = 0;

  // Color tables
  struct ColorTable {
    int Size = 0;
    uint8_t Colors[256 * 3] = {};
  };
  ColorTable GCT; // Global Color Table
  ColorTable LCT; // Local Color Table
  ColorTable* ActivePalette = nullptr;

  // Graphic Control Extension state
  struct GCE {
    uint16_t Delay = 0;
    uint8_t TranspIndex = 0;
    uint8_t Disposal = 0;
    bool HasTransparency = false;
  };
  GCE CurrentGCE;
  bool HasPendingGCE = false;

  // Canvas for compositing (RGBA)
  std::vector<uint8_t> Canvas;
  std::vector<uint8_t> PrevCanvas;

  // Background color index
  uint8_t BgIndex = 0;

  std::vector<FGatrixGifFrame> Frames;

  // ==================== Reading Helpers ====================

  uint8_t ReadByte() {
    if (Pos >= BufSize) return 0;
    return Buf[Pos++];
  }

  uint16_t ReadWord() {
    uint8_t Lo = ReadByte();
    uint8_t Hi = ReadByte();
    return Lo | (static_cast<uint16_t>(Hi) << 8);
  }

  void ReadBytes(void* Dest, size_t Count) {
    size_t Avail = (Pos + Count <= BufSize) ? Count : (BufSize - Pos);
    std::memcpy(Dest, Buf + Pos, Avail);
    Pos += Avail;
  }

  void Skip(size_t Count) {
    Pos += Count;
    if (Pos > BufSize) Pos = BufSize;
  }

  void SkipSubBlocks() {
    while (Pos < BufSize) {
      uint8_t Size = ReadByte();
      if (Size == 0) break;
      Skip(Size);
    }
  }

  // ==================== Header ====================

  bool ReadHeader() {
    if (BufSize < 13) return false;

    // Signature "GIF"
    if (Buf[0] != 'G' || Buf[1] != 'I' || Buf[2] != 'F') return false;
    // Version "87a" or "89a"
    Pos = 6;

    Width = ReadWord();
    Height = ReadWord();

    uint8_t Packed = ReadByte();
    BgIndex = ReadByte();
    /*uint8_t AspectRatio =*/ ReadByte();

    // Global Color Table flag
    bool HasGCT = (Packed & 0x80) != 0;
    int GCTSize = 1 << ((Packed & 0x07) + 1);

    if (HasGCT) {
      GCT.Size = GCTSize;
    }

    return Width > 0 && Height > 0;
  }

  bool ReadGlobalColorTable() {
    if (GCT.Size > 0) {
      ReadBytes(GCT.Colors, GCT.Size * 3);
    }
    ActivePalette = &GCT;
    return true;
  }

  // ==================== Extensions ====================

  void ReadExtension() {
    uint8_t Label = ReadByte();
    switch (Label) {
      case 0xF9: ReadGraphicControlExt(); break;
      case 0xFF: ReadApplicationExt(); break;
      default: SkipSubBlocks(); break;
    }
  }

  void ReadGraphicControlExt() {
    /*uint8_t BlockSize =*/ ReadByte(); // always 4
    uint8_t Packed = ReadByte();
    CurrentGCE.Disposal = (Packed >> 2) & 0x07;
    CurrentGCE.HasTransparency = (Packed & 0x01) != 0;
    CurrentGCE.Delay = ReadWord();
    CurrentGCE.TranspIndex = ReadByte();
    /*uint8_t Terminator =*/ ReadByte(); // block terminator
    HasPendingGCE = true;
  }

  void ReadApplicationExt() {
    uint8_t BlockSize = ReadByte();
    Skip(BlockSize); // app identifier + auth code
    SkipSubBlocks();
  }

  // ==================== Image Frame ====================

  bool ReadImageFrame() {
    uint16_t FrameX = ReadWord();
    uint16_t FrameY = ReadWord();
    uint16_t FrameW = ReadWord();
    uint16_t FrameH = ReadWord();
    uint8_t Packed = ReadByte();

    bool Interlaced = (Packed & 0x40) != 0;
    bool HasLCT = (Packed & 0x80) != 0;

    // Read Local Color Table if present
    if (HasLCT) {
      LCT.Size = 1 << ((Packed & 0x07) + 1);
      ReadBytes(LCT.Colors, LCT.Size * 3);
      ActivePalette = &LCT;
    } else {
      ActivePalette = &GCT;
    }

    // Read LZW minimum code size
    uint8_t MinCodeSize = ReadByte();
    if (MinCodeSize < 2 || MinCodeSize > 8) {
      SkipSubBlocks();
      return true; // skip invalid frame
    }

    // Collect all sub-block data
    std::vector<uint8_t> CompressedData;
    while (Pos < BufSize) {
      uint8_t SubBlockSize = ReadByte();
      if (SubBlockSize == 0) break;
      size_t Start = CompressedData.size();
      CompressedData.resize(Start + SubBlockSize);
      ReadBytes(CompressedData.data() + Start, SubBlockSize);
    }

    // LZW decompress
    std::vector<uint8_t> IndexData;
    if (!LZWDecompress(CompressedData, MinCodeSize, FrameW * FrameH, IndexData)) {
      return true; // skip bad frame
    }

    // Apply disposal from previous frame
    GCE FrameGCE = {};
    if (HasPendingGCE) {
      FrameGCE = CurrentGCE;
      HasPendingGCE = false;
    }

    // Save canvas for disposal method 3 (restore to previous)
    if (FrameGCE.Disposal == 3) {
      PrevCanvas = Canvas;
    }

    // Render indexed pixels onto canvas
    for (int32_t j = 0; j < FrameH; ++j) {
      int32_t DstY = Interlaced ? InterlacedLineIndex(FrameH, j) : j;
      if (FrameY + DstY >= Height) continue;

      for (int32_t k = 0; k < FrameW; ++k) {
        if (FrameX + k >= Width) continue;

        int32_t SrcIdx = j * FrameW + k;
        if (SrcIdx >= static_cast<int32_t>(IndexData.size())) continue;

        uint8_t ColorIdx = IndexData[SrcIdx];

        // Skip transparent pixels
        if (FrameGCE.HasTransparency && ColorIdx == FrameGCE.TranspIndex) {
          continue;
        }

        int32_t CanvasIdx = ((FrameY + DstY) * Width + (FrameX + k)) * 4;
        if (CanvasIdx + 3 < static_cast<int32_t>(Canvas.size())) {
          Canvas[CanvasIdx + 0] = ActivePalette->Colors[ColorIdx * 3 + 0];
          Canvas[CanvasIdx + 1] = ActivePalette->Colors[ColorIdx * 3 + 1];
          Canvas[CanvasIdx + 2] = ActivePalette->Colors[ColorIdx * 3 + 2];
          Canvas[CanvasIdx + 3] = 255; // Opaque
        }
      }
    }

    // Convert canvas to FGatrixGifFrame
    FGatrixGifFrame Frame;
    Frame.RGBA = Canvas;

    // Delay in centiseconds → milliseconds
    Frame.DelayMs = static_cast<int32_t>(FrameGCE.Delay) * 10;
    if (Frame.DelayMs <= 0) Frame.DelayMs = 100;

    Frames.push_back(std::move(Frame));

    // Apply disposal for next frame
    switch (FrameGCE.Disposal) {
      case 2: {
        // Restore to background
        uint8_t* BgColor = &ActivePalette->Colors[BgIndex * 3];
        bool UseBgColor = !FrameGCE.HasTransparency && (BgIndex < ActivePalette->Size);

        for (int32_t j = 0; j < FrameH && j + FrameY < Height; ++j) {
          for (int32_t k = 0; k < FrameW && k + FrameX < Width; ++k) {
            int32_t Idx = ((FrameY + j) * Width + (FrameX + k)) * 4;
            if (Idx + 3 < static_cast<int32_t>(Canvas.size())) {
              if (UseBgColor) {
                Canvas[Idx + 0] = BgColor[0];
                Canvas[Idx + 1] = BgColor[1];
                Canvas[Idx + 2] = BgColor[2];
                Canvas[Idx + 3] = 255;
              } else {
                Canvas[Idx + 0] = 0;
                Canvas[Idx + 1] = 0;
                Canvas[Idx + 2] = 0;
                Canvas[Idx + 3] = 0; // Transparent block
              }
            }
          }
        }
        break;
      }
      case 3:
        // Restore to previous
        Canvas = PrevCanvas;
        break;
      default:
        // Leave canvas as-is (disposal 0 or 1)
        break;
    }

    return true;
  }

  // ==================== LZW Decompression ====================

  bool LZWDecompress(const std::vector<uint8_t>& Src, int MinCodeSize,
                     int PixelCount, std::vector<uint8_t>& Out) {
    const int ClearCode = 1 << MinCodeSize;
    const int EOICode = ClearCode + 1;
    int CodeSize = MinCodeSize + 1;
    int MaxCode = (1 << CodeSize) - 1;

    // LZW dictionary
    struct LZWEntry {
      int16_t Prefix;
      uint8_t Suffix;
      int16_t Length;
    };

    const int MaxTableSize = 4096;
    std::vector<LZWEntry> Table(MaxTableSize);

    // Initialize table
    auto ResetTable = [&]() {
      for (int i = 0; i < ClearCode; ++i) {
        Table[i].Prefix = -1;
        Table[i].Suffix = static_cast<uint8_t>(i);
        Table[i].Length = 1;
      }
      Table[ClearCode] = {-1, 0, 0};
      Table[EOICode] = {-1, 0, 0};
      CodeSize = MinCodeSize + 1;
      MaxCode = (1 << CodeSize) - 1;
      return EOICode + 1; // next available code
    };

    int TableSize = ResetTable();
    Out.reserve(PixelCount);

    // Bit reader
    int BitPos = 0;
    int TotalBits = static_cast<int>(Src.size()) * 8;

    auto ReadCode = [&]() -> int {
      if (BitPos + CodeSize > TotalBits) return EOICode;
      int Code = 0;
      for (int i = 0; i < CodeSize; ++i) {
        int ByteIdx = (BitPos + i) / 8;
        int BitIdx = (BitPos + i) % 8;
        if (Src[ByteIdx] & (1 << BitIdx)) {
          Code |= (1 << i);
        }
      }
      BitPos += CodeSize;
      return Code;
    };

    // Decode a code into output
    auto DecodeString = [&](int Code, std::vector<uint8_t>& Dest) {
      int Len = (Code < TableSize) ? Table[Code].Length : 0;
      if (Len <= 0) return;
      size_t Start = Dest.size();
      Dest.resize(Start + Len);
      int Idx = Code;
      for (int i = Len - 1; i >= 0; --i) {
        if (Idx < 0 || Idx >= TableSize) break;
        Dest[Start + i] = Table[Idx].Suffix;
        Idx = Table[Idx].Prefix;
      }
    };

    // First code must be clear code
    int Code = ReadCode();
    if (Code != ClearCode) return false;

    int PrevCode = -1;

    while (static_cast<int>(Out.size()) < PixelCount) {
      Code = ReadCode();
      if (Code == EOICode) break;

      if (Code == ClearCode) {
        TableSize = ResetTable();
        PrevCode = -1;
        continue;
      }

      if (PrevCode == -1) {
        // First code after clear
        if (Code < ClearCode) {
          Out.push_back(static_cast<uint8_t>(Code));
        }
        PrevCode = Code;
        continue;
      }

      if (Code < TableSize) {
        // Code is in table
        DecodeString(Code, Out);

        // Add new entry: PrevCode + first char of Code string
        if (TableSize < MaxTableSize) {
          uint8_t FirstChar = 0;
          int Tmp = Code;
          while (Tmp >= 0 && Tmp < TableSize) {
            FirstChar = Table[Tmp].Suffix;
            if (Table[Tmp].Prefix < 0) break;
            Tmp = Table[Tmp].Prefix;
          }
          Table[TableSize].Prefix = static_cast<int16_t>(PrevCode);
          Table[TableSize].Suffix = FirstChar;
          Table[TableSize].Length =
              (PrevCode < TableSize ? Table[PrevCode].Length : 0) + 1;
          TableSize++;
          if (TableSize > MaxCode && CodeSize < 12) {
            CodeSize++;
            MaxCode = (1 << CodeSize) - 1;
          }
        }
      } else if (Code == TableSize) {
        // Special case: code not yet in table
        uint8_t FirstChar = 0;
        int Tmp = PrevCode;
        while (Tmp >= 0 && Tmp < TableSize) {
          FirstChar = Table[Tmp].Suffix;
          if (Table[Tmp].Prefix < 0) break;
          Tmp = Table[Tmp].Prefix;
        }

        if (TableSize < MaxTableSize) {
          Table[TableSize].Prefix = static_cast<int16_t>(PrevCode);
          Table[TableSize].Suffix = FirstChar;
          Table[TableSize].Length =
              (PrevCode < TableSize ? Table[PrevCode].Length : 0) + 1;
          TableSize++;
        }

        DecodeString(Code, Out);

        if (TableSize > MaxCode && CodeSize < 12) {
          CodeSize++;
          MaxCode = (1 << CodeSize) - 1;
        }
      } else {
        // Invalid code
        break;
      }

      PrevCode = Code;
    }

    return Out.size() > 0;
  }

  // ==================== Interlace ====================

  static int InterlacedLineIndex(int Height, int Line) {
    int P;
    P = (Height - 1) / 8 + 1;
    if (Line < P) return Line * 8;         // Pass 1
    Line -= P;
    P = (Height - 5) / 8 + 1;
    if (Line < P) return Line * 8 + 4;     // Pass 2
    Line -= P;
    P = (Height - 3) / 4 + 1;
    if (Line < P) return Line * 4 + 2;     // Pass 3
    Line -= P;
    return Line * 2 + 1;                   // Pass 4
  }
};
