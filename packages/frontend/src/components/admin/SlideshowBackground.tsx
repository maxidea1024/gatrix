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

  // Compute initial portrait side ONCE so sideA and lastPortraitSideRef agree
  const initialSide = useMemo<'left' | 'right'>(
    () => (Math.random() > 0.5 ? 'left' : 'right'),
    []
  );
  // Two explicit layers with their own pinned image source AND portrait side
  const [layerA, setLayerA] = useState(shuffled[0] || '');
  const [layerB, setLayerB] = useState('');
  const [sideA, setSideA] = useState<'left' | 'right'>(initialSide);
  const [sideB, setSideB] = useState<'left' | 'right'>('right');
  // Which layer is the "current" (fully visible) one — controls opacity
  const [topLayer, setTopLayer] = useState<'A' | 'B'>('A');
  const [fading, setFading] = useState(false);
  // Which layer is visually in front (higher z-index) — controls stacking
  // Set at the START of a transition; the incoming layer goes to front.
  const [frontLayer, setFrontLayer] = useState<'A' | 'B'>('B');
  const idxRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  // Refs to keep advance callback stable (avoids interval reset on every transition)
  const topLayerRef = useRef<'A' | 'B'>('A');
  const fadingRef = useRef(false);
  // Track last portrait side so consecutive portraits always alternate
  const lastPortraitSideRef = useRef<'left' | 'right'>(
    isPortrait(shuffled[0] || '') ? initialSide : 'left'
  );

  // Advance to next image — stable callback, reads mutable refs instead of state
  const advance = useCallback(() => {
    if (shuffled.length < 2) return;
    // Guard: if a crossfade is already in progress, skip this tick
    if (fadingRef.current) return;

    const nextIdx = (idxRef.current + 1) % shuffled.length;
    const nextSrc = shuffled[nextIdx];

    // If next image is portrait, force opposite side from last portrait
    let newSide: 'left' | 'right';
    if (isPortrait(nextSrc)) {
      newSide = lastPortraitSideRef.current === 'left' ? 'right' : 'left';
      lastPortraitSideRef.current = newSide;
    } else {
      newSide = Math.random() > 0.5 ? 'left' : 'right';
    }

    // Lock fading immediately to prevent double-advance
    fadingRef.current = true;
    idxRef.current = nextIdx;

    // Ensure image is fully loaded before starting the crossfade
    let fired = false;
    const doTransition = () => {
      if (fired) return;
      fired = true;

      if (topLayerRef.current === 'A') {
        setFrontLayer('B');
        setLayerB(nextSrc);
        setSideB(newSide);
        requestAnimationFrame(() => {
          setFading(true);
          setTimeout(() => {
            topLayerRef.current = 'B';
            setTopLayer('B');
            fadingRef.current = false;
            setFading(false);
          }, CROSSFADE_MS);
        });
      } else {
        setFrontLayer('A');
        setLayerA(nextSrc);
        setSideA(newSide);
        requestAnimationFrame(() => {
          setFading(true);
          setTimeout(() => {
            topLayerRef.current = 'A';
            setTopLayer('A');
            fadingRef.current = false;
            setFading(false);
          }, CROSSFADE_MS);
        });
      }

      // Preload 2 images ahead
      for (let offset = 1; offset <= 2; offset++) {
        const aheadIdx = (nextIdx + offset) % shuffled.length;
        const img = new Image();
        img.src = shuffled[aheadIdx];
      }
    };

    const preload = new Image();
    preload.src = nextSrc;
    if (preload.complete) {
      doTransition();
    } else {
      preload.onload = doTransition;
      preload.onerror = doTransition;
      setTimeout(doTransition, 3000);
    }
  }, [shuffled]);

  useEffect(() => {
    if (shuffled.length < 2) return;
    // Eagerly preload the first few images
    for (let i = 1; i <= Math.min(3, shuffled.length - 1); i++) {
      const img = new Image();
      img.src = shuffled[i];
    }

    timerRef.current = setInterval(advance, interval);
    return () => clearInterval(timerRef.current);
  }, [advance, interval, shuffled.length]);

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
            transition: `opacity ${CROSSFADE_MS}ms ease-in-out`,
            background: 'linear-gradient(180deg, #0f1628 0%, #1a1e3a 20%, #2a2040 45%, #1e1832 70%, #12101e 100%)',
          }}
        >
          <Box
            key={src}
            component="img"
            src={src}
            alt=""
            sx={{
              position: 'absolute',
              bottom: 0,
              [side]: '-3%',
              height: '95%',
              maxWidth: '50%',
              objectFit: 'contain',
              objectPosition: 'bottom',
              filter: 'drop-shadow(0 0 40px rgba(0,0,0,0.8))',
              animation: `portraitReveal ${CROSSFADE_MS * 1.2}ms cubic-bezier(0.22, 1, 0.36, 1) both`,
              '@keyframes portraitReveal': {
                '0%': {
                  transform: 'scale(0.96) translateY(2%)',
                  filter:
                    'drop-shadow(0 0 40px rgba(0,0,0,0.8)) brightness(1.4)',
                },
                '60%': {
                  transform: 'scale(1.0) translateY(0%)',
                  filter:
                    'drop-shadow(0 0 60px rgba(200,180,255,0.3)) brightness(1.08)',
                },
                '100%': {
                  transform: 'scale(1.0) translateY(0%)',
                  filter: 'drop-shadow(0 0 40px rgba(0,0,0,0.8)) brightness(1)',
                },
              },
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
          transition: `opacity ${CROSSFADE_MS}ms ease-in-out`,
        }}
      />
    );
  };

  // Opacity: topLayer is always visible; the other is visible only during fading
  const aOpacity = topLayer === 'A' ? 1 : fading ? 1 : 0;
  const bOpacity = topLayer === 'B' ? 1 : fading ? 1 : 0;
  // Z-index: frontLayer is always on top — set at transition START, never flipped at END
  const aZ = frontLayer === 'A' ? 1 : 0;
  const bZ = frontLayer === 'B' ? 1 : 0;

  return (
    <>
      {renderLayer(layerA, aOpacity, aZ, sideA)}
      {renderLayer(layerB, bOpacity, bZ, sideB)}
    </>
  );
};

export default SlideshowBackground;
