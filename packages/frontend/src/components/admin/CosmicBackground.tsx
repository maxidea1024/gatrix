import React, { useEffect, useRef } from 'react';

// ─── Types ───

interface Star {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  driftX: number;
  driftY: number;
  color: string;
}

interface Nebula {
  x: number;
  y: number;
  radius: number;
  color: [number, number, number]; // RGB
  baseAlpha: number;
  breathSpeed: number;
  breathPhase: number;
  driftX: number;
  driftY: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  length: number;
}

// ─── Constants ───

const STAR_COLORS = [
  'rgba(255,255,255,', // white
  'rgba(200,220,255,', // blue-white
  'rgba(255,240,220,', // warm white
  'rgba(180,200,255,', // cool blue
  'rgba(255,220,180,', // pale gold
];

const NEBULA_COLORS: [number, number, number][] = [
  [107, 47, 160], // purple
  [26, 107, 107], // teal
  [30, 58, 107], // navy
  [107, 26, 58], // crimson
  [40, 80, 140], // deep blue
  [80, 40, 120], // violet
  [20, 90, 90], // dark cyan
  [60, 20, 80], // deep purple
];

// ─── Helpers ───

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function createStars(
  w: number,
  h: number,
  baseCount: number,
  radiusRange: [number, number],
  alphaRange: [number, number],
  speedMultiplier: number
): Star[] {
  // Scale star count proportionally to viewport area so ultra-wide screens
  // aren't sparse. Reference area = 1920×1080 (≈2M px).
  const area = w * h;
  const refArea = 960 * 540; // half-res reference
  const count = Math.round(baseCount * Math.max(1, area / refArea));

  const cx = w * 0.5;
  const cy = h * 0.55;

  return Array.from({ length: count }, () => {
    let x: number, y: number;

    if (Math.random() < 0.6) {
      // 60%: Center-biased distribution (galactic core density)
      const angle = rand(0, Math.PI * 2);
      const maxDist = Math.max(w, h) * 0.7; // use max dimension → fills wide screens
      const dist = Math.pow(Math.random(), 0.6) * maxDist;
      x = cx + Math.cos(angle) * dist;
      y = cy + Math.sin(angle) * dist;
    } else {
      // 40%: Uniform scatter across entire viewport (guarantees edge coverage)
      x = rand(-10, w + 10);
      y = rand(-10, h + 10);
    }

    return {
      x,
      y,
      radius: rand(radiusRange[0], radiusRange[1]),
      baseAlpha: rand(alphaRange[0], alphaRange[1]),
      twinkleSpeed: rand(0.3, 1.5),
      twinklePhase: rand(0, Math.PI * 2),
      driftX: rand(-0.08, 0.08) * speedMultiplier,
      driftY: rand(-0.04, 0.04) * speedMultiplier,
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
    };
  });
}

function createNebulae(w: number, h: number): Nebula[] {
  // More nebulae on wider screens to fill edges
  const baseCount = 6 + Math.floor(Math.random() * 3);
  const aspect = w / h;
  const count =
    aspect > 2 ? baseCount + 3 : aspect > 1.5 ? baseCount + 1 : baseCount;
  const dim = Math.max(w, h); // use max dimension so nebulae scale to ultra-wide

  return Array.from({ length: count }, () => ({
    x: rand(w * -0.05, w * 1.05),
    y: rand(h * -0.05, h * 1.05),
    radius: rand(dim * 0.12, dim * 0.35),
    color: NEBULA_COLORS[Math.floor(Math.random() * NEBULA_COLORS.length)],
    baseAlpha: rand(0.008, 0.025),
    breathSpeed: rand(0.1, 0.3),
    breathPhase: rand(0, Math.PI * 2),
    driftX: rand(-0.06, 0.06),
    driftY: rand(-0.03, 0.03),
  }));
}

function spawnShootingStar(w: number, h: number): ShootingStar {
  const startEdge = Math.random();
  let x: number, y: number;
  if (startEdge < 0.5) {
    x = rand(0, w);
    y = rand(-20, h * 0.3);
  } else {
    x = rand(w * 0.3, w + 20);
    y = rand(0, h * 0.5);
  }
  const speed = rand(4, 8);
  const angle = rand(Math.PI * 0.6, Math.PI * 0.85); // mostly downward-left
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 0,
    maxLife: rand(40, 80),
    length: rand(40, 100),
  };
}

// ─── Component ───

const CosmicBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Render at half resolution for performance + natural soft focus
    const SCALE = 0.5;

    let w: number;
    let h: number;

    // State
    let farStars: Star[];
    let midStars: Star[];
    let nearStars: Star[];
    let nebulae: Nebula[];
    let shootingStars: ShootingStar[] = [];
    let shootingStarTimer = rand(480, 900); // frames until next

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = Math.floor(w * SCALE);
      canvas!.height = Math.floor(h * SCALE);
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;

      // Recreate particles on resize
      const cw = canvas!.width;
      const ch = canvas!.height;
      farStars = createStars(cw, ch, 300, [0.3, 0.7], [0.08, 0.25], 0.3);
      midStars = createStars(cw, ch, 120, [0.5, 1.0], [0.12, 0.35], 0.7);
      nearStars = createStars(cw, ch, 30, [0.8, 1.6], [0.2, 0.5], 1.2);
      nebulae = createNebulae(cw, ch);
    }

    resize();
    window.addEventListener('resize', resize);

    let time = 0;

    function drawNebulae(ctx: CanvasRenderingContext2D) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      for (const n of nebulae) {
        const alpha =
          n.baseAlpha *
          (0.7 + 0.3 * Math.sin(time * n.breathSpeed + n.breathPhase));

        // Slow drift with wrap-around
        n.x += n.driftX;
        n.y += n.driftY;
        const cw = ctx.canvas.width;
        const ch = ctx.canvas.height;
        if (n.x < -n.radius) n.x = cw + n.radius;
        if (n.x > cw + n.radius) n.x = -n.radius;
        if (n.y < -n.radius) n.y = ch + n.radius;
        if (n.y > ch + n.radius) n.y = -n.radius;

        const gradient = ctx.createRadialGradient(
          n.x,
          n.y,
          0,
          n.x,
          n.y,
          n.radius
        );
        gradient.addColorStop(
          0,
          `rgba(${n.color[0]},${n.color[1]},${n.color[2]},${alpha})`
        );
        gradient.addColorStop(
          0.4,
          `rgba(${n.color[0]},${n.color[1]},${n.color[2]},${alpha * 0.5})`
        );
        gradient.addColorStop(
          1,
          `rgba(${n.color[0]},${n.color[1]},${n.color[2]},0)`
        );

        ctx.fillStyle = gradient;
        ctx.fillRect(
          n.x - n.radius,
          n.y - n.radius,
          n.radius * 2,
          n.radius * 2
        );
      }

      ctx.restore();
    }

    function drawGalacticCore(ctx: CanvasRenderingContext2D) {
      const cw = ctx.canvas.width;
      const ch = ctx.canvas.height;
      const cx = cw * 0.5;
      const cy = ch * 0.55;

      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      // Outer glow
      const outerR = Math.min(cw, ch) * 0.35;
      const g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerR);
      g1.addColorStop(0, 'rgba(60,50,80,0.04)');
      g1.addColorStop(0.3, 'rgba(40,35,70,0.02)');
      g1.addColorStop(1, 'rgba(20,15,40,0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, cw, ch);

      // Inner glow — brighter core
      const innerR = Math.min(cw, ch) * 0.1;
      const pulseAlpha = 0.03 + 0.01 * Math.sin(time * 0.15);
      const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR);
      g2.addColorStop(0, `rgba(180,160,220,${pulseAlpha})`);
      g2.addColorStop(0.5, `rgba(100,80,140,${pulseAlpha * 0.4})`);
      g2.addColorStop(1, 'rgba(40,30,60,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(cx - innerR, cy - innerR, innerR * 2, innerR * 2);

      ctx.restore();
    }

    function drawStarLayer(ctx: CanvasRenderingContext2D, stars: Star[]) {
      const cw = ctx.canvas.width;
      const ch = ctx.canvas.height;

      for (const s of stars) {
        // Drift
        s.x += s.driftX;
        s.y += s.driftY;

        // Wrap
        if (s.x < -5) s.x = cw + 5;
        if (s.x > cw + 5) s.x = -5;
        if (s.y < -5) s.y = ch + 5;
        if (s.y > ch + 5) s.y = -5;

        // Twinkle
        const twinkle =
          0.5 + 0.5 * Math.sin(time * s.twinkleSpeed + s.twinklePhase);
        const alpha = s.baseAlpha * (0.3 + 0.7 * twinkle);

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = s.color + alpha.toFixed(3) + ')';
        ctx.fill();

        // Glow for larger stars
        if (s.radius > 1.2) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.radius * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = s.color + (alpha * 0.08).toFixed(3) + ')';
          ctx.fill();
        }
      }
    }

    function drawShootingStars(ctx: CanvasRenderingContext2D) {
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i];
        ss.x += ss.vx;
        ss.y += ss.vy;
        ss.life++;

        if (ss.life > ss.maxLife) {
          shootingStars.splice(i, 1);
          continue;
        }

        const progress = ss.life / ss.maxLife;
        // Fade in then fade out
        const alpha =
          progress < 0.1
            ? progress / 0.1
            : progress > 0.7
              ? (1 - progress) / 0.3
              : 1;

        const tailX =
          ss.x - (ss.vx / Math.sqrt(ss.vx * ss.vx + ss.vy * ss.vy)) * ss.length;
        const tailY =
          ss.y - (ss.vy / Math.sqrt(ss.vx * ss.vx + ss.vy * ss.vy)) * ss.length;

        const gradient = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y);
        gradient.addColorStop(0, `rgba(255,255,255,0)`);
        gradient.addColorStop(
          1,
          `rgba(255,255,255,${(alpha * 0.8).toFixed(3)})`
        );

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(ss.x, ss.y);
        ctx.stroke();

        // Bright head
        ctx.beginPath();
        ctx.arc(ss.x, ss.y, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${(alpha * 0.9).toFixed(3)})`;
        ctx.fill();
        ctx.restore();
      }
    }

    function frame() {
      if (document.hidden) {
        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      time += 0.016; // ~60fps time step

      const cw = ctx!.canvas.width;
      const ch = ctx!.canvas.height;

      // Clear to deep space black
      ctx!.fillStyle = '#05080f';
      ctx!.fillRect(0, 0, cw, ch);

      // Render layers back-to-front
      drawNebulae(ctx!);
      drawGalacticCore(ctx!);
      drawStarLayer(ctx!, farStars);
      drawStarLayer(ctx!, midStars);
      drawStarLayer(ctx!, nearStars);

      // Shooting stars
      shootingStarTimer--;
      if (shootingStarTimer <= 0) {
        shootingStars.push(spawnShootingStar(cw, ch));
        shootingStarTimer = rand(480, 900); // 8-15 seconds at 60fps
      }
      drawShootingStars(ctx!);

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
};

export default CosmicBackground;
