import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';

/**
 * SpriteAnimation - Frame-by-frame sprite sheet animation
 *
 * Uses React state to cycle frames for reliable 2D grid support.
 * Container clips to exactly one frame at a time.
 */

interface SpriteAnimationProps {
  /** Path to the sprite sheet image */
  src: string;
  /** Number of columns in the sprite sheet */
  columns: number;
  /** Number of rows in the sprite sheet (default: 1) */
  rows?: number;
  /** Total number of frames (default: columns * rows) */
  totalFrames?: number;
  /** Animation duration per frame in ms (default: 400) */
  frameInterval?: number;
  /** Display size in px */
  size: number;
  /** Additional sx props for the outer container */
  sx?: Record<string, any>;
}

const SpriteAnimation: React.FC<SpriteAnimationProps> = ({
  src,
  columns,
  rows = 1,
  totalFrames,
  frameInterval = 400,
  size,
  sx,
}) => {
  const total = totalFrames ?? columns * rows;
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % total);
    }, frameInterval);
    return () => clearInterval(timer);
  }, [total, frameInterval]);

  const col = frame % columns;
  const row = Math.floor(frame / columns);

  // background-position as percentage for proper scaling
  // For N columns: each step = 100 / (N - 1) %  (if N > 1)
  const bgX = columns > 1 ? (col / (columns - 1)) * 100 : 0;
  const bgY = rows > 1 ? (row / (rows - 1)) * 100 : 0;

  return (
    <Box
      sx={{
        width: size,
        height: size,
        overflow: 'hidden',
        backgroundImage: `url(${src})`,
        backgroundSize: `${columns * 100}% ${rows * 100}%`,
        backgroundPosition: `${bgX}% ${bgY}%`,
        backgroundRepeat: 'no-repeat',
        transition: 'background-position 0s',
        ...sx,
      }}
    />
  );
};

export default SpriteAnimation;
