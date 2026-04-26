import React, { useEffect, useRef } from 'react';

/**
 * OceanBackground — 大航海時代 (Uncharted Waters) atmospheric night-ocean.
 *
 * Conveys the thrill of setting sail into the unknown:
 *   - Starry navigation sky with twinkling constellations
 *   - Crescent moon with shimmering water reflection
 *   - Warm amber glow on the distant horizon (the promise of new lands)
 *   - Animated ocean swells with depth
 *   - Detailed sailing ship silhouette with billowing sails
 *   - Seagulls gliding near the horizon
 *   - Drifting sea-spray particles (wind feel)
 *   - Slowly rotating compass rose
 */
const OceanBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const SCALE = 0.5;
    let w: number, h: number;
    let time = 0;

    // ── Star data ──
    interface Star { x: number; y: number; r: number; a: number; sp: number; ph: number; }
    let stars: Star[] = [];

    // ── Wind particles (sea spray / mist) ──
    interface Particle { x: number; y: number; vx: number; vy: number; a: number; life: number; maxLife: number; }
    let particles: Particle[] = [];
    const MAX_PARTICLES = 40;

    // ── Shooting stars ──
    interface ShootingStar { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; len: number; }
    let shootingStars: ShootingStar[] = [];
    let shootingStarTimer = 300 + Math.random() * 500;

    function spawnParticle(cw: number, ch: number) {
      const horizonY = ch * 0.69;
      particles.push({
        x: -10,
        y: horizonY + Math.random() * (ch * 0.3),
        vx: 0.3 + Math.random() * 0.6,
        vy: -0.1 + Math.random() * 0.2,
        a: 0.02 + Math.random() * 0.03,
        life: 0,
        maxLife: 200 + Math.random() * 300,
      });
    }

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = Math.floor(w * SCALE);
      canvas!.height = Math.floor(h * SCALE);
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;

      const cw = canvas!.width;
      const ch = canvas!.height;
      const skyH = ch * 0.68;
      const count = Math.round((cw * skyH) / 4500);
      stars = [];
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * cw,
          y: Math.random() * skyH,
          r: 0.3 + Math.random() * 0.8,
          a: 0.1 + Math.random() * 0.3,
          sp: 0.3 + Math.random() * 1.0,
          ph: Math.random() * Math.PI * 2,
        });
      }
      particles = [];
    }

    resize();
    window.addEventListener('resize', resize);

    let visible = true;
    const onVis = () => { visible = !document.hidden; };
    document.addEventListener('visibilitychange', onVis);

    // ── Drawing functions ──

    function drawSky(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
      const g = ctx.createLinearGradient(0, 0, 0, ch);
      g.addColorStop(0, '#030810');
      g.addColorStop(0.38, '#071828');
      g.addColorStop(0.63, '#0c2238');
      g.addColorStop(0.69, '#0e2540');
      g.addColorStop(0.74, '#0a1c30');
      g.addColorStop(1, '#061018');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cw, ch);
    }

    function drawHorizonGlow(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
      const horizonY = ch * 0.69;

      // Warm amber glow on the distant horizon — "new lands await"
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      const glowW = cw * 0.5;
      const glowH = ch * 0.15;
      const gx = cw * 0.55;
      const breathe = 0.6 + 0.4 * Math.sin(time * 0.15);

      const g = ctx.createRadialGradient(
        gx, horizonY, 0,
        gx, horizonY, glowW * 0.5
      );
      g.addColorStop(0, `rgba(200,140,60,${(0.045 * breathe).toFixed(4)})`);
      g.addColorStop(0.3, `rgba(180,100,40,${(0.025 * breathe).toFixed(4)})`);
      g.addColorStop(0.7, `rgba(120,60,30,${(0.01 * breathe).toFixed(4)})`);
      g.addColorStop(1, 'rgba(80,40,20,0)');
      ctx.fillStyle = g;
      ctx.fillRect(gx - glowW, horizonY - glowH, glowW * 2, glowH * 2);

      // Second smaller glow — port lights in the distance
      const g2 = ctx.createRadialGradient(
        cw * 0.15, horizonY, 0,
        cw * 0.15, horizonY, cw * 0.12
      );
      g2.addColorStop(0, `rgba(220,180,100,${(0.02 * breathe).toFixed(4)})`);
      g2.addColorStop(0.5, `rgba(180,120,60,${(0.008 * breathe).toFixed(4)})`);
      g2.addColorStop(1, 'rgba(120,80,40,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, horizonY - cw * 0.12, cw * 0.3, cw * 0.24);

      ctx.restore();
    }

    function drawStars(ctx: CanvasRenderingContext2D) {
      for (const s of stars) {
        // Dual-frequency twinkle for a natural sparkle
        const tw1 = Math.sin(time * s.sp + s.ph);
        const tw2 = Math.sin(time * s.sp * 2.3 + s.ph * 1.7);
        const twinkle = tw1 * 0.6 + tw2 * 0.4;
        const a = s.a * (0.15 + 0.85 * ((twinkle + 1) * 0.5));
        if (a <= 0.005) continue;

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(210,220,245,${a.toFixed(3)})`;
        ctx.fill();

        // Soft glow halo around brighter stars
        if (s.r > 0.6 && a > 0.1) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(200,215,240,${(a * 0.12).toFixed(4)})`;
          ctx.fill();

          // Cross-sparkle for the brightest moments
          if (a > 0.2) {
            ctx.save();
            ctx.globalAlpha = a * 0.25;
            ctx.strokeStyle = 'rgba(220,230,255,0.4)';
            ctx.lineWidth = 0.3;
            const len = s.r * 4;
            ctx.beginPath();
            ctx.moveTo(s.x - len, s.y); ctx.lineTo(s.x + len, s.y);
            ctx.moveTo(s.x, s.y - len); ctx.lineTo(s.x, s.y + len);
            ctx.stroke();
            ctx.restore();
          }
        }
      }
    }

    function drawMoon(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
      const mx = cw * 0.82;
      const my = ch * 0.14;
      const mr = Math.min(cw, ch) * 0.05;

      // === Massive bloom glow ===
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      // Layer 1: huge atmospheric glow
      const bloom1 = mr * 12;
      const gb1 = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, bloom1);
      gb1.addColorStop(0, 'rgba(180,200,230,0.08)');
      gb1.addColorStop(0.15, 'rgba(140,170,210,0.04)');
      gb1.addColorStop(0.4, 'rgba(100,140,190,0.015)');
      gb1.addColorStop(1, 'rgba(60,100,160,0)');
      ctx.fillStyle = gb1;
      ctx.fillRect(mx - bloom1, my - bloom1, bloom1 * 2, bloom1 * 2);

      // Layer 2: bright inner halo
      const bloom2 = mr * 5;
      const gb2 = ctx.createRadialGradient(mx, my, mr * 0.8, mx, my, bloom2);
      gb2.addColorStop(0, 'rgba(210,225,250,0.15)');
      gb2.addColorStop(0.3, 'rgba(180,200,235,0.06)');
      gb2.addColorStop(1, 'rgba(140,170,210,0)');
      ctx.fillStyle = gb2;
      ctx.fillRect(mx - bloom2, my - bloom2, bloom2 * 2, bloom2 * 2);

      // Layer 3: hot white core glow
      const bloom3 = mr * 2.5;
      const gb3 = ctx.createRadialGradient(mx, my, mr * 0.3, mx, my, bloom3);
      gb3.addColorStop(0, 'rgba(240,245,255,0.2)');
      gb3.addColorStop(0.5, 'rgba(220,235,255,0.08)');
      gb3.addColorStop(1, 'rgba(200,220,250,0)');
      ctx.fillStyle = gb3;
      ctx.fillRect(mx - bloom3, my - bloom3, bloom3 * 2, bloom3 * 2);

      ctx.restore();

      // === Moon disc ===
      ctx.save();

      // Base — bright white-blue
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(220,230,248,0.45)';
      ctx.fill();

      // Core highlight — off-center
      const hlg = ctx.createRadialGradient(
        mx - mr * 0.2, my - mr * 0.15, mr * 0.05,
        mx + mr * 0.1, my + mr * 0.05, mr
      );
      hlg.addColorStop(0, 'rgba(255,255,255,0.35)');
      hlg.addColorStop(0.3, 'rgba(240,245,255,0.2)');
      hlg.addColorStop(0.7, 'rgba(210,225,245,0.05)');
      hlg.addColorStop(1, 'rgba(190,210,235,0)');
      ctx.fillStyle = hlg;
      ctx.fill();

      // Mare (dark patches)
      ctx.globalAlpha = 0.12;
      const patches = [
        { x: -0.15, y: -0.1, r: 0.22 },
        { x: 0.18, y: 0.15, r: 0.18 },
        { x: -0.05, y: 0.22, r: 0.16 },
        { x: 0.22, y: -0.18, r: 0.1 },
        { x: -0.28, y: 0.08, r: 0.13 },
      ];
      for (const p of patches) {
        ctx.beginPath();
        ctx.arc(mx + p.x * mr, my + p.y * mr, p.r * mr, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(60,75,100,1)';
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Rim
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(240,248,255,0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    }

    function drawClouds(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
      const mx = cw * 0.82;
      const my = ch * 0.14;

      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      // Wispy cloud bands drifting near the moon
      const clouds = [
        { yOff: -15, speed: 0.012, width: 0.25, alpha: 0.035, height: 8 },
        { yOff: 10, speed: -0.008, width: 0.3, alpha: 0.025, height: 6 },
        { yOff: 30, speed: 0.015, width: 0.2, alpha: 0.02, height: 5 },
      ];

      for (const c of clouds) {
        const drift = time * c.speed * cw * 0.5;
        const cx = mx + drift % (cw * 0.5) - cw * 0.25;
        const cy = my + c.yOff;
        const w = cw * c.width;

        const cg = ctx.createLinearGradient(cx - w / 2, cy, cx + w / 2, cy);
        cg.addColorStop(0, 'rgba(140,160,190,0)');
        cg.addColorStop(0.2, `rgba(150,170,200,${c.alpha})`);
        cg.addColorStop(0.5, `rgba(170,185,210,${c.alpha * 1.2})`);
        cg.addColorStop(0.8, `rgba(150,170,200,${c.alpha})`);
        cg.addColorStop(1, 'rgba(140,160,190,0)');

        ctx.fillStyle = cg;
        ctx.fillRect(cx - w / 2, cy - c.height / 2, w, c.height);
      }

      ctx.restore();
    }

    function drawOcean(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
      const horizonY = ch * 0.69;

      // Ocean body
      const og = ctx.createLinearGradient(0, horizonY, 0, ch);
      og.addColorStop(0, 'rgba(8,24,44,0.6)');
      og.addColorStop(0.5, 'rgba(6,16,32,0.7)');
      og.addColorStop(1, 'rgba(4,10,22,0.8)');
      ctx.fillStyle = og;
      ctx.fillRect(0, horizonY, cw, ch - horizonY);

      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      // 5 wave layers
      const waves = [
        { yOff: 0, amp: 3.0, freq: 0.006, speed: 0.45, alpha: 0.04 },
        { yOff: 10, amp: 2.2, freq: 0.009, speed: 0.35, alpha: 0.03 },
        { yOff: 22, amp: 1.6, freq: 0.013, speed: 0.50, alpha: 0.025 },
        { yOff: 38, amp: 1.2, freq: 0.017, speed: 0.40, alpha: 0.02 },
        { yOff: 58, amp: 0.8, freq: 0.022, speed: 0.55, alpha: 0.015 },
      ];

      for (const wc of waves) {
        ctx.beginPath();
        for (let x = 0; x <= cw; x += 2) {
          const y =
            horizonY + wc.yOff +
            Math.sin(x * wc.freq + time * wc.speed) * wc.amp +
            Math.sin(x * wc.freq * 0.5 + time * wc.speed * 1.3) * wc.amp * 0.4;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(100,160,200,${wc.alpha})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      ctx.restore();
    }

    function drawMoonReflection(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
      const mx = cw * 0.82;
      const horizonY = ch * 0.69;
      const oceanH = ch - horizonY;

      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      // === Wide moonlight path on water ===
      // Bright column that widens toward viewer
      const segCount = 25;
      for (let i = 0; i < segCount; i++) {
        const t = i / segCount;
        const segY = horizonY + oceanH * t;
        const segH = oceanH / segCount + 1;

        // Widens as it gets closer (perspective)
        const spread = cw * (0.03 + t * 0.08);
        const wobble = Math.sin(time * 0.5 + i * 0.6) * (spread * 0.15);
        const centerX = mx + wobble;

        // Brighter near horizon, fading at bottom
        const baseAlpha = (1 - t * 0.7) * 0.06;
        const shimmer = 0.7 + 0.3 * Math.sin(time * 0.4 + i * 0.9);
        const alpha = baseAlpha * shimmer;

        const rg = ctx.createLinearGradient(
          centerX - spread, segY,
          centerX + spread, segY
        );
        rg.addColorStop(0, 'rgba(140,180,220,0)');
        rg.addColorStop(0.25, `rgba(160,195,230,${(alpha * 0.4).toFixed(4)})`);
        rg.addColorStop(0.5, `rgba(200,220,245,${alpha.toFixed(4)})`);
        rg.addColorStop(0.75, `rgba(160,195,230,${(alpha * 0.4).toFixed(4)})`);
        rg.addColorStop(1, 'rgba(140,180,220,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(centerX - spread, segY, spread * 2, segH);
      }

      // === Individual wave-crest highlights ===
      // Small bright sparkles scattered along the moonlight path
      for (let i = 0; i < 20; i++) {
        const t = (i + 0.5) / 20;
        const rowY = horizonY + oceanH * t;
        const pathSpread = cw * (0.02 + t * 0.06);

        // 2-3 sparkles per row
        const sparkleCount = 2 + Math.floor(t * 2);
        for (let j = 0; j < sparkleCount; j++) {
          const phase = i * 3.7 + j * 2.1;
          const sparkleAlpha = (0.04 + 0.03 * (1 - t)) *
            Math.max(0, Math.sin(time * 1.2 + phase));
          if (sparkleAlpha < 0.005) continue;

          const sx = mx + (Math.sin(phase * 1.3) * pathSpread) +
            Math.sin(time * 0.6 + phase) * 3;
          const sy = rowY + Math.sin(time * 0.8 + phase * 0.7) * 2;

          ctx.beginPath();
          const sparkleW = 2 + t * 3;
          ctx.ellipse(sx, sy, sparkleW, 0.6, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(220,235,255,${sparkleAlpha.toFixed(4)})`;
          ctx.fill();
        }
      }

      ctx.restore();
    }

    function drawShip(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
      const horizonY = ch * 0.69;
      const shipX = cw * 0.30 + Math.sin(time * 0.06) * cw * 0.008;
      const bobY = Math.sin(time * 0.5) * 1.5;
      const tilt = Math.sin(time * 0.4) * 0.015; // gentle rocking
      const s = Math.min(cw, ch) * 0.001;

      ctx.save();
      ctx.translate(shipX, horizonY - 1 + bobY);
      ctx.rotate(tilt);
      ctx.scale(s, s);
      ctx.globalAlpha = 0.15;

      // Hull — carrack style
      ctx.beginPath();
      ctx.moveTo(-40, 0);
      ctx.bezierCurveTo(-35, 5, -15, 12, 5, 12);
      ctx.bezierCurveTo(25, 12, 40, 6, 45, -2);
      ctx.lineTo(42, -5);
      ctx.bezierCurveTo(30, 2, 10, 5, -10, 5);
      ctx.bezierCurveTo(-25, 4, -38, 0, -40, 0);
      ctx.fillStyle = '#15192a';
      ctx.fill();

      // Stern castle
      ctx.beginPath();
      ctx.moveTo(-38, 0);
      ctx.lineTo(-40, -15);
      ctx.lineTo(-30, -18);
      ctx.lineTo(-25, -5);
      ctx.closePath();
      ctx.fillStyle = '#15192a';
      ctx.fill();

      // Main mast
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -65);
      ctx.strokeStyle = '#1a1e30';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Crow's nest
      ctx.beginPath();
      ctx.rect(-4, -62, 8, 3);
      ctx.fillStyle = '#1a1e30';
      ctx.fill();

      // Main sail — billowing
      const sailPuff = Math.sin(time * 0.3) * 2 + 12;
      ctx.beginPath();
      ctx.moveTo(1, -58);
      ctx.quadraticCurveTo(sailPuff + 6, -42, sailPuff + 4, -18);
      ctx.lineTo(2, -18);
      ctx.lineTo(1, -58);
      ctx.fillStyle = 'rgba(190,200,220,0.18)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(160,170,190,0.08)';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Fore mast
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(20, -45);
      ctx.strokeStyle = '#1a1e30';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Fore sail
      const forePuff = Math.sin(time * 0.35 + 1) * 1.5 + 8;
      ctx.beginPath();
      ctx.moveTo(21, -42);
      ctx.quadraticCurveTo(21 + forePuff + 4, -30, 21 + forePuff + 2, -10);
      ctx.lineTo(21, -10);
      ctx.lineTo(21, -42);
      ctx.fillStyle = 'rgba(190,200,220,0.14)';
      ctx.fill();

      // Bowsprit
      ctx.beginPath();
      ctx.moveTo(40, -3);
      ctx.lineTo(60, -12);
      ctx.strokeStyle = '#1a1e30';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Jib sail
      ctx.beginPath();
      ctx.moveTo(58, -11);
      ctx.lineTo(20, -40);
      ctx.lineTo(22, -5);
      ctx.closePath();
      ctx.fillStyle = 'rgba(190,200,220,0.06)';
      ctx.fill();

      // Rigging lines
      ctx.strokeStyle = 'rgba(160,170,190,0.06)';
      ctx.lineWidth = 0.5;
      // Shrouds
      ctx.beginPath();
      ctx.moveTo(-15, 3); ctx.lineTo(0, -55);
      ctx.moveTo(15, 3); ctx.lineTo(0, -55);
      ctx.moveTo(30, 3); ctx.lineTo(20, -40);
      ctx.stroke();

      ctx.restore();
    }

    function drawWindParticles(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
      // Spawn new particles
      if (particles.length < MAX_PARTICLES && Math.random() < 0.15) {
        spawnParticle(cw, ch);
      }

      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        if (p.life > p.maxLife || p.x > cw + 20) return false;

        const lifeRatio = p.life / p.maxLife;
        const fadeIn = Math.min(1, lifeRatio * 5);
        const fadeOut = Math.max(0, 1 - (lifeRatio - 0.7) / 0.3);
        const alpha = p.a * fadeIn * fadeOut;

        if (alpha > 0.003) {
          ctx.beginPath();
          // Small horizontal streak
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - 4 - Math.random() * 3, p.y + 0.3);
          ctx.strokeStyle = `rgba(180,210,240,${alpha.toFixed(4)})`;
          ctx.lineWidth = 0.4;
          ctx.stroke();
        }

        return true;
      });

      ctx.restore();
    }

    function drawCompass(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
      const cx = cw * 0.92;
      const cy = ch * 0.88;
      const r = Math.min(cw, ch) * 0.05;

      ctx.save();
      ctx.globalAlpha = 0.055;
      ctx.translate(cx, cy);
      ctx.rotate(time * 0.025);

      // Outer ring
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(200,180,150,1)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Inner ring
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(200,180,150,0.5)';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Center dot
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.06, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(220,200,160,1)';
      ctx.fill();

      // Cardinal points
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate((Math.PI / 2) * i);

        ctx.beginPath();
        ctx.moveTo(0, -r * 0.15);
        ctx.lineTo(r * 0.08, -r * 0.55);
        ctx.lineTo(0, -r * 0.95);
        ctx.lineTo(-r * 0.08, -r * 0.55);
        ctx.closePath();
        ctx.fillStyle = i === 0
          ? 'rgba(230,190,120,1)'    // North — golden
          : 'rgba(200,190,170,0.7)';
        ctx.fill();

        ctx.restore();
      }

      // 8 tick marks
      for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.rotate((Math.PI / 4) * i);
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.85);
        ctx.lineTo(0, -r * 0.95);
        ctx.strokeStyle = 'rgba(200,180,150,0.6)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
    }

    function drawSeagulls(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
      const horizonY = ch * 0.69;
      ctx.save();
      ctx.globalAlpha = 0.10;
      ctx.strokeStyle = '#a0b8d0';
      ctx.lineWidth = 0.8;

      // 3 seagulls at different positions/speeds
      const gulls = [
        { baseX: 0.35, baseY: -0.08, speed: 0.04, wingSpeed: 2.5, size: 1.0, phase: 0 },
        { baseX: 0.42, baseY: -0.12, speed: 0.03, wingSpeed: 3.0, size: 0.7, phase: 2 },
        { baseX: 0.48, baseY: -0.06, speed: 0.05, wingSpeed: 2.2, size: 0.85, phase: 4 },
      ];

      for (const g of gulls) {
        // Move slowly across the screen, loop around
        const rawX = (g.baseX * cw + time * g.speed * cw * 0.1 + g.phase * cw * 0.1) % (cw * 1.3);
        const gx = rawX - cw * 0.15;
        const gy = horizonY + g.baseY * ch + Math.sin(time * 0.5 + g.phase) * 3;
        const wingFlap = Math.sin(time * g.wingSpeed + g.phase) * 5 * g.size;
        const span = 10 * g.size;

        ctx.beginPath();
        // Left wing
        ctx.moveTo(gx - span, gy + wingFlap);
        ctx.quadraticCurveTo(gx - span * 0.4, gy - Math.abs(wingFlap) * 0.3, gx, gy);
        // Right wing
        ctx.quadraticCurveTo(gx + span * 0.4, gy - Math.abs(wingFlap) * 0.3, gx + span, gy + wingFlap);
        ctx.stroke();
      }

      ctx.restore();
    }

    function drawShootingStars(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
      const skyH = ch * 0.65;

      // Spawn timer
      shootingStarTimer--;
      if (shootingStarTimer <= 0) {
        const startX = Math.random() * cw * 0.8;
        const startY = Math.random() * skyH * 0.5;
        const angle = 0.3 + Math.random() * 0.4; // downward-right
        const speed = 3 + Math.random() * 3;
        shootingStars.push({
          x: startX, y: startY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          maxLife: 30 + Math.random() * 25,
          len: 20 + Math.random() * 30,
        });
        shootingStarTimer = 400 + Math.random() * 500;
      }

      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      shootingStars = shootingStars.filter(ss => {
        ss.x += ss.vx;
        ss.y += ss.vy;
        ss.life++;
        if (ss.life > ss.maxLife) return false;

        const progress = ss.life / ss.maxLife;
        const alpha = progress < 0.2
          ? progress / 0.2
          : 1 - (progress - 0.2) / 0.8;

        // Tail
        const tailX = ss.x - ss.vx * (ss.len / Math.hypot(ss.vx, ss.vy));
        const tailY = ss.y - ss.vy * (ss.len / Math.hypot(ss.vx, ss.vy));

        const tg = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y);
        tg.addColorStop(0, 'rgba(200,220,255,0)');
        tg.addColorStop(0.7, `rgba(220,235,255,${(alpha * 0.15).toFixed(4)})`);
        tg.addColorStop(1, `rgba(240,245,255,${(alpha * 0.3).toFixed(4)})`);

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(ss.x, ss.y);
        ctx.strokeStyle = tg;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Head glow
        ctx.beginPath();
        ctx.arc(ss.x, ss.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(240,245,255,${(alpha * 0.25).toFixed(4)})`;
        ctx.fill();

        return true;
      });

      ctx.restore();
    }

    // ── Main render loop ──

    function draw() {
      if (!visible) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      time += 0.008;

      const cw = canvas!.width;
      const ch = canvas!.height;

      drawSky(ctx!, cw, ch);
      drawHorizonGlow(ctx!, cw, ch);
      drawStars(ctx!);
      drawMoon(ctx!, cw, ch);
      drawClouds(ctx!, cw, ch);
      drawOcean(ctx!, cw, ch);
      drawMoonReflection(ctx!, cw, ch);
      drawShip(ctx!, cw, ch);
      drawSeagulls(ctx!, cw, ch);
      drawShootingStars(ctx!, cw, ch);
      drawWindParticles(ctx!, cw, ch);
      drawCompass(ctx!, cw, ch);

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
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

export default OceanBackground;
