import React, { useEffect, useRef } from 'react';

/**
 * MatrixBackground - Classic Digital Rain Effect
 * Provides a high-tech, hacker-style background that fits the "Gatrix" theme.
 */
const MatrixBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set higher resolution for crisp text
    const updateSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    const fontSize = 20;
    const columns = Math.floor(canvas.width / fontSize);

    // Character array (Japanese Katakana + Latin + Numbers)
    const chars =
      'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝabcdefghijklmnopqrstuvwxyz0123456789';
    const charArray = chars.split('');

    // Falling positions for each column
    const drops: number[] = new Array(columns).fill(1).map(() => Math.floor(Math.random() * -100));

    let animationId: number;
    let lastTime = 0;
    const fps = 20; // Slightly slower for a more subtle feel
    const interval = 1000 / fps;

    const render = (timestamp: number) => {
      if (timestamp - lastTime > interval) {
        lastTime = timestamp;

        // Translucent clear to create tail effect - more transparent for longer, subtler tails
        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.font = `${fontSize}px "Courier New", Courier, monospace`;

        for (let i = 0; i < drops.length; i++) {
          // Pick a random character
          const text = charArray[Math.floor(Math.random() * charArray.length)];

          // X position
          const x = i * fontSize;
          // Y position
          const y = drops[i] * fontSize;

          // More visible green, with occasional soft white heads
          const isHead = Math.random() > 0.98;
          if (isHead) {
            ctx.fillStyle = 'rgba(200, 255, 200, 0.9)';
          } else {
            // Brighter retro green
            ctx.fillStyle = 'rgba(0, 200, 80, 0.7)';
          }

          ctx.fillText(text, x, y);

          // Reset when reaching bottom or randomly
          if (y > canvas.height && Math.random() > 0.975) {
            drops[i] = 0;
          }

          drops[i]++;
        }
      }

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', updateSize);
      cancelAnimationFrame(animationId);
    };
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
        backgroundColor: '#000',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          imageRendering: 'pixelated', // Force pixelated look
          filter: 'contrast(1.2) brightness(1.0)', // Better brightness
          opacity: 0.8, // Increased opacity for visibility
        }}
      />
      {/* Smooth transition to focus on the form */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'radial-gradient(circle at center, transparent 10%, rgba(0,0,0,0.85) 100%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};

export default MatrixBackground;
