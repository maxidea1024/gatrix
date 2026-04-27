import { useState, useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';

/** All available slideshow images — auto-discovered at build time */
export const SLIDESHOW_LANDSCAPES = Array.from(
  { length: 26 },
  (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    // landscape 10, 12, 14, 15, 19 are jpg, rest png
    const ext = [10, 12, 14, 15, 19].includes(i + 1) ? 'jpg' : 'png';
    return `/images/slideshow/uwo_landscape_${n}.${ext}`;
  }
);

export const SLIDESHOW_PORTRAITS = Array.from(
  { length: 24 },
  (_, i) => `/images/slideshow/uwo_portrait_${String(i + 1).padStart(2, '0')}.png`
);

export const ALL_SLIDESHOW_IMAGES = [...SLIDESHOW_LANDSCAPES, ...SLIDESHOW_PORTRAITS];

/** Check if a path is a portrait image */
const isPortrait = (src: string) => src.includes('portrait');

const CROSSFADE_MS = 1500;

interface SlideshowBackgroundProps {
  /** Image paths to cycle through */
  images: string[];
  /** Interval between transitions in milliseconds */
  interval: number;
}

/**
 * Full-screen slideshow background with crossfade transitions.
 * Uses two explicit layers (A/B) with pinned image sources to avoid flash.
 *
 * - Landscape images fill the screen with object-fit: cover
 * - Portrait images appear on a random side (left/right) with a dark BG
 */
const SlideshowBackground = ({ images, interval }: SlideshowBackgroundProps) => {
  // Two explicit layers with their own pinned image source
  const [layerA, setLayerA] = useState(images[0] || '');
  const [layerB, setLayerB] = useState('');
  const [topLayer, setTopLayer] = useState<'A' | 'B'>('A');
  const [fading, setFading] = useState(false);
  const [portraitSide, setPortraitSide] = useState<'left' | 'right'>('right');
  const idxRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Preload the next image
  const preloadNext = useCallback(() => {
    if (images.length < 2) return;
    const nextIdx = (idxRef.current + 1) % images.length;
    const img = new Image();
    img.src = images[nextIdx];
  }, [images]);

  // Advance to next image
  const advance = useCallback(() => {
    if (images.length < 2) return;
    const nextIdx = (idxRef.current + 1) % images.length;
    const nextSrc = images[nextIdx];
    idxRef.current = nextIdx;

    // Randomize portrait side
    setPortraitSide(Math.random() > 0.5 ? 'left' : 'right');

    // Set the BACK layer to the next image, then crossfade
    if (topLayer === 'A') {
      setLayerB(nextSrc);
      // Small delay to let browser paint the new src before fading
      requestAnimationFrame(() => {
        setFading(true);
        setTimeout(() => {
          setTopLayer('B');
          setFading(false);
        }, CROSSFADE_MS);
      });
    } else {
      setLayerA(nextSrc);
      requestAnimationFrame(() => {
        setFading(true);
        setTimeout(() => {
          setTopLayer('A');
          setFading(false);
        }, CROSSFADE_MS);
      });
    }

    // Preload the one after
    const afterIdx = (nextIdx + 1) % images.length;
    const preImg = new Image();
    preImg.src = images[afterIdx];
  }, [images, topLayer]);

  useEffect(() => {
    if (images.length < 2) return;
    preloadNext();
    timerRef.current = setInterval(advance, interval);
    return () => clearInterval(timerRef.current);
  }, [advance, interval, images.length, preloadNext]);

  if (images.length === 0) return null;

  const renderLayer = (src: string, opacity: number, zIdx: number) => {
    if (!src) return null;
    const portrait = isPortrait(src);

    if (portrait) {
      return (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: zIdx,
            opacity,
            transition: fading ? `opacity ${CROSSFADE_MS}ms ease-in-out` : 'none',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: portraitSide === 'left' ? 'flex-start' : 'flex-end',
            background: 'linear-gradient(180deg, #080c18 0%, #0d1520 100%)',
          }}
        >
          <Box
            component="img"
            src={src}
            alt=""
            sx={{
              height: '95%',
              maxWidth: '55%',
              objectFit: 'contain',
              objectPosition: 'bottom',
              filter: 'drop-shadow(0 0 40px rgba(0,0,0,0.8))',
              px: 4,
            }}
          />
        </Box>
      );
    }

    // Landscape — full cover
    return (
      <Box
        component="img"
        src={src}
        alt=""
        sx={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center center',
          zIndex: zIdx,
          opacity,
          transition: fading ? `opacity ${CROSSFADE_MS}ms ease-in-out` : 'none',
        }}
      />
    );
  };

  // The top layer is fully visible; the back layer fades in on top during transition
  // When topLayer=A: A is z0 (visible), B fades in on z1
  // When topLayer=B: B is z0 (visible), A fades in on z1
  const aOpacity = topLayer === 'A' ? 1 : fading ? 1 : 0;
  const bOpacity = topLayer === 'B' ? 1 : fading ? 1 : 0;
  const aZ = topLayer === 'A' ? 0 : 1;
  const bZ = topLayer === 'B' ? 0 : 1;

  return (
    <>
      {renderLayer(layerA, aOpacity, aZ)}
      {renderLayer(layerB, bOpacity, bZ)}
    </>
  );
};

export default SlideshowBackground;
