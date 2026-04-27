import { useState, useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';

/** All available slideshow images — auto-discovered at build time */
export const SLIDESHOW_LANDSCAPES = Array.from({ length: 26 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  // landscape 10, 12, 14, 15, 19 are jpg, rest png
  const ext = [10, 12, 14, 15, 19].includes(i + 1) ? 'jpg' : 'png';
  return `/images/slideshow/uwo_landscape_${n}.${ext}`;
});

export const SLIDESHOW_PORTRAITS = Array.from(
  { length: 24 },
  (_, i) =>
    `/images/slideshow/uwo_portrait_${String(i + 1).padStart(2, '0')}.png`
);

export const ALL_SLIDESHOW_IMAGES = [
  ...SLIDESHOW_LANDSCAPES,
  ...SLIDESHOW_PORTRAITS,
];

/** Check if a path is a portrait image */
const isPortrait = (src: string) => src.includes('portrait');

interface SlideshowBackgroundProps {
  /** Image paths to cycle through */
  images: string[];
  /** Interval between transitions in milliseconds */
  interval: number;
}

/**
 * Full-screen slideshow background with crossfade transitions.
 * - Landscape images fill the screen with object-fit: cover
 * - Portrait images appear on a random side (left/right) with a dark blurred BG
 */
const SlideshowBackground = ({
  images,
  interval,
}: SlideshowBackgroundProps) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [showNext, setShowNext] = useState(false);
  const nextIdx = (activeIdx + 1) % images.length;
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const [portraitSide, setPortraitSide] = useState<'left' | 'right'>('right');

  // Preload next image
  useEffect(() => {
    if (images.length < 2) return;
    const img = new Image();
    img.src = images[nextIdx];
  }, [nextIdx, images]);

  // Auto-advance timer
  const advance = useCallback(() => {
    if (images.length < 2) return;
    // Randomize portrait side for next image
    setPortraitSide(Math.random() > 0.5 ? 'left' : 'right');
    setShowNext(true);
    // After crossfade completes, swap layers
    setTimeout(() => {
      setActiveIdx((prev) => (prev + 1) % images.length);
      setShowNext(false);
    }, 1500); // match CSS transition duration
  }, [images]);

  useEffect(() => {
    if (images.length < 2) return;
    timerRef.current = setInterval(advance, interval);
    return () => clearInterval(timerRef.current);
  }, [advance, interval, images.length]);

  if (images.length === 0) return null;

  const renderImage = (
    src: string,
    opacity: number,
    zIdx: number,
    side?: 'left' | 'right'
  ) => {
    const portrait = isPortrait(src);

    if (portrait) {
      return (
        <Box
          key={`layer-${zIdx}`}
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: zIdx,
            opacity,
            transition: 'opacity 1.5s ease-in-out',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent:
              (side || portraitSide) === 'left' ? 'flex-start' : 'flex-end',
            // Dark background behind portrait
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
        key={`layer-${zIdx}`}
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
          transition: 'opacity 1.5s ease-in-out',
        }}
      />
    );
  };

  return (
    <>
      {/* Active layer (always visible) */}
      {renderImage(images[activeIdx], 1, 0, portraitSide)}
      {/* Next layer (fades in on top during transition) */}
      {images.length > 1 &&
        renderImage(images[nextIdx], showNext ? 1 : 0, 1, portraitSide)}
    </>
  );
};

export default SlideshowBackground;
