import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';

/** CDN base URL for slideshow assets (CloudFront → S3) */
const CDN_BASE = 'https://d4oe5k889c0fy.cloudfront.net/slideshow';

/** All available slideshow images — served via CloudFront CDN */
export const SLIDESHOW_LANDSCAPES = Array.from({ length: 26 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  // landscape 10, 12, 14, 15, 19 are jpg, rest png
  const ext = [10, 12, 14, 15, 19].includes(i + 1) ? 'jpg' : 'png';
  return `${CDN_BASE}/uwo_landscape_${n}.${ext}`;
});

export const SLIDESHOW_PORTRAITS = Array.from(
  { length: 24 },
  (_, i) => `${CDN_BASE}/uwo_portrait_${String(i + 1).padStart(2, '0')}.png`
);

export const ALL_SLIDESHOW_IMAGES = [
  ...SLIDESHOW_LANDSCAPES,
  ...SLIDESHOW_PORTRAITS,
];

/** Convert a full-res CDN URL to its 200px thumbnail URL */
export const toThumb = (url: string): string =>
  url.replace('/slideshow/', '/slideshow/thumbs/');

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
const SlideshowBackground = ({
  images,
  interval,
}: SlideshowBackgroundProps) => {
  // Shuffle images once on mount so portraits/landscapes are interspersed
  const shuffled = useMemo(() => {
    const arr = [...images];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [images]);

  // Two explicit layers with their own pinned image source AND portrait side
  const [layerA, setLayerA] = useState(shuffled[0] || '');
  const [layerB, setLayerB] = useState('');
  const [sideA, setSideA] = useState<'left' | 'right'>(
    Math.random() > 0.5 ? 'left' : 'right'
  );
  const [sideB, setSideB] = useState<'left' | 'right'>('right');
  const [topLayer, setTopLayer] = useState<'A' | 'B'>('A');
  const [fading, setFading] = useState(false);
  const idxRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Preload the next image
  const preloadNext = useCallback(() => {
    if (shuffled.length < 2) return;
    const nextIdx = (idxRef.current + 1) % shuffled.length;
    const img = new Image();
    img.src = shuffled[nextIdx];
  }, [shuffled]);

  // Advance to next image
  const advance = useCallback(() => {
    if (shuffled.length < 2) return;
    const nextIdx = (idxRef.current + 1) % shuffled.length;
    const nextSrc = shuffled[nextIdx];
    idxRef.current = nextIdx;

    const newSide: 'left' | 'right' = Math.random() > 0.5 ? 'left' : 'right';

    // Set the BACK layer to the next image with its own side, then crossfade
    if (topLayer === 'A') {
      setLayerB(nextSrc);
      setSideB(newSide);
      requestAnimationFrame(() => {
        setFading(true);
        setTimeout(() => {
          setTopLayer('B');
          setFading(false);
        }, CROSSFADE_MS);
      });
    } else {
      setLayerA(nextSrc);
      setSideA(newSide);
      requestAnimationFrame(() => {
        setFading(true);
        setTimeout(() => {
          setTopLayer('A');
          setFading(false);
        }, CROSSFADE_MS);
      });
    }

    // Preload the one after
    const afterIdx = (nextIdx + 1) % shuffled.length;
    const preImg = new Image();
    preImg.src = shuffled[afterIdx];
  }, [shuffled, topLayer]);

  useEffect(() => {
    if (shuffled.length < 2) return;
    preloadNext();
    timerRef.current = setInterval(advance, interval);
    return () => clearInterval(timerRef.current);
  }, [advance, interval, shuffled.length, preloadNext]);

  if (shuffled.length === 0) return null;

  const renderLayer = (
    src: string,
    opacity: number,
    zIdx: number,
    side: 'left' | 'right'
  ) => {
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
            transition: fading
              ? `opacity ${CROSSFADE_MS}ms ease-in-out`
              : 'none',
            background: 'linear-gradient(180deg, #080c18 0%, #0d1520 100%)',
          }}
        >
          <Box
            component="img"
            src={src}
            alt=""
            sx={{
              position: 'absolute',
              bottom: 0,
              [side]: '-8%',
              height: '95%',
              maxWidth: '50%',
              objectFit: 'contain',
              objectPosition: 'bottom',
              filter: 'drop-shadow(0 0 40px rgba(0,0,0,0.8))',
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
  const aOpacity = topLayer === 'A' ? 1 : fading ? 1 : 0;
  const bOpacity = topLayer === 'B' ? 1 : fading ? 1 : 0;
  const aZ = topLayer === 'A' ? 0 : 1;
  const bZ = topLayer === 'B' ? 0 : 1;

  return (
    <>
      {renderLayer(layerA, aOpacity, aZ, sideA)}
      {renderLayer(layerB, bOpacity, bZ, sideB)}
    </>
  );
};

export default SlideshowBackground;
