import React, { useEffect, useRef } from 'react';

/**
 * PaletteBackground - Balanced ASM64 Style Infinite Winding Tunnel
 * Found the middle ground between "too loud" and "too invisible".
 */
const PaletteBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const width = 320;
    const height = 200;
    canvas.width = width;
    canvas.height = height;

    const centerX = width / 2;
    const centerY = height / 2;

    let time = 0;
    let animationId: number;

    const render = () => {
      time += 0.006; // Very slow update for calm feel

      const imageData = ctx.createImageData(width, height);
      const data = imageData.data;

      // Hyper-winding path: Higher amplitude and depth-based curvature
      const pathX = (t: number) => Math.sin(t * 0.6) * 60 + Math.cos(t * 0.25) * 35;
      const pathY = (t: number) => Math.cos(t * 0.5) * 45 + Math.sin(t * 0.35) * 25;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x - centerX;
          const dy = y - centerY;

          const rawDist = Math.sqrt(dx * dx + dy * dy);
          const vBase = rawDist < 1 ? 1000 : 240.0 / rawDist;

          // Deeper winding effect by increasing time offset along depth
          const depthTime = time + vBase * 0.07;
          const shiftX = pathX(depthTime);
          const shiftY = pathY(depthTime);

          const correctedDx = dx - shiftX;
          const correctedDy = dy - shiftY;

          const dist = Math.sqrt(correctedDx * correctedDx + correctedDy * correctedDy);
          // Slower forward speed (4.5 -> 2.0)
          const v = (dist < 0.5 ? 1000 : 240.0 / dist) + time * 2.0;
          const u = (Math.atan2(correctedDy, correctedDx) + Math.PI) / (Math.PI * 2);

          const segments = 12;
          const pattern = (Math.floor(u * segments) ^ Math.floor(v * 1.5)) & 1;

          // "Monochrome Steel" - Dark grey tones for ultimate subtleness
          let r, g, b;
          if (pattern) {
            const sheen = (v * 2) % 25;
            r = 25 + sheen;
            g = 25 + sheen;
            b = 28 + sheen;
          } else {
            r = 8;
            g = 8;
            b = 10;
          }

          // Adjusted fog - allows for more visible area towards the observer
          const brightness = Math.min(0.8, dist / 60.0);

          const i = (y * width + x) * 4;
          data[i] = r * brightness;
          data[i + 1] = g * brightness;
          data[i + 2] = b * brightness;
          data[i + 3] = 255;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -2,
        backgroundColor: '#030305',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          imageRendering: 'pixelated',
          display: 'block',
          opacity: 0.85, // Increased for visibility
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'radial-gradient(circle at center, transparent 20%, rgba(0,0,0,0.8) 100%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};

export default PaletteBackground;
