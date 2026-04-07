# ThirdParty Libraries for GatrixClientSDK Banner System

## GIF Decoder (Built-in)

`GatrixGifDecoder.h` — Self-contained, single-header GIF89a decoder.
- **No external dependencies required**
- Supports multi-frame GIF with per-frame delays
- Handles interlacing, transparency, and frame disposal
- Works entirely from memory buffers (no file I/O)
- Safe for use on background threads

## WebP Decoder

### Without libwebp (Default)
`GatrixWebPDecoder.h` falls back to UE4's `ImageWrapper` module.
Some UE4 versions may not support WebP natively — in that case, WebP images will fail to decode.

### With libwebp (Recommended for full WebP support)

**Important**: libwebp binaries go in the **game project's** ThirdParty directory,
NOT in this SDK plugin. The SDK plugin's Build.cs automatically detects and links
libwebp from `<ProjectDir>/ThirdParty/libwebp/`.

1. **Download** prebuilt libwebp from:
   https://developers.google.com/speed/webp/download

2. **Extract** and place files in the game project:
   ```
   game/Unreal/ThirdParty/
     libwebp/
       include/
         webp/
           decode.h
           types.h
           mux_types.h
       lib/
         Win64/
           webp.lib
         iOS/
           libwebp.a
   ```

3. **Build** — `GatrixClientSDK.Build.cs` will automatically detect the `include/` directory
   and enable `GATRIX_HAS_LIBWEBP=1`.

### Building libwebp from source (alternative)

```bash
# Clone
git clone https://chromium.googlesource.com/webm/libwebp

# Build decode-only (minimal)
cd libwebp
mkdir build && cd build
cmake .. -DWEBP_BUILD_CWEBP=OFF -DWEBP_BUILD_DWEBP=OFF \
         -DWEBP_BUILD_GIF2WEBP=OFF -DWEBP_BUILD_IMG2WEBP=OFF \
         -DWEBP_BUILD_EXTRAS=OFF
cmake --build . --config Release
```

Copy the resulting `.lib` / `.a` files to the appropriate `lib/` subdirectory.
