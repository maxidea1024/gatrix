import React, { useEffect, useRef } from 'react';

/**
 * OceanBackground — 大航海時代 (Uncharted Waters) atmospheric night-ocean.
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

    interface Star {
      x: number;
      y: number;
      r: number;
      a: number;
      sp: number;
      ph: number;
    }
    let stars: Star[] = [];

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      a: number;
      life: number;
      maxLife: number;
    }
    let particles: Particle[] = [];
    const MAX_PARTICLES = 40;

    interface ShootingStar {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      len: number;
    }
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
      const skyH = ch * 0.65;
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
    const onVis = () => {
      visible = !document.hidden;
    };
    document.addEventListener('visibilitychange', onVis);

    function drawSky(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
      // Deep midnight gradient
      const g = ctx.createLinearGradient(0, 0, 0, ch);
      g.addColorStop(0, '#020408');
      g.addColorStop(0.25, '#060e1a');
      g.addColorStop(0.5, '#091826');
      g.addColorStop(0.65, '#0b1e32');
      g.addColorStop(0.69, '#0c2038');
      g.addColorStop(0.75, '#071520');
      g.addColorStop(1, '#030810');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cw, ch);

      // Subtle nebula/aurora undertones for dreaminess
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      // Purple nebula wash (upper-left)
      const n1 = ctx.createRadialGradient(
        cw * 0.2,
        ch * 0.15,
        0,
        cw * 0.2,
        ch * 0.15,
        cw * 0.35
      );
      n1.addColorStop(0, 'rgba(60,30,90,0.03)');
      n1.addColorStop(0.5, 'rgba(40,20,70,0.015)');
      n1.addColorStop(1, 'rgba(20,10,40,0)');
      ctx.fillStyle = n1;
      ctx.fillRect(0, 0, cw * 0.6, ch * 0.5);

      // Deep blue nebula (center-right)
      const n2 = ctx.createRadialGradient(
        cw * 0.65,
        ch * 0.3,
        0,
        cw * 0.65,
        ch * 0.3,
        cw * 0.25
      );
      n2.addColorStop(0, 'rgba(20,50,100,0.025)');
      n2.addColorStop(0.6, 'rgba(15,35,70,0.01)');
      n2.addColorStop(1, 'rgba(10,20,40,0)');
      ctx.fillStyle = n2;
      ctx.fillRect(cw * 0.3, 0, cw * 0.7, ch * 0.6);

      ctx.restore();
    }

    function drawHorizonGlow(
      ctx: CanvasRenderingContext2D,
      cw: number,
      ch: number
    ) {
      const horizonY = ch * 0.69;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      const glowW = cw * 0.5;
      const glowH = ch * 0.15;
      const gx = cw * 0.55;
      const breathe = 0.6 + 0.4 * Math.sin(time * 0.15);

      const g = ctx.createRadialGradient(
        gx,
        horizonY,
        0,
        gx,
        horizonY,
        glowW * 0.5
      );
      g.addColorStop(0, `rgba(200,140,60,${(0.045 * breathe).toFixed(4)})`);
      g.addColorStop(0.3, `rgba(180,100,40,${(0.025 * breathe).toFixed(4)})`);
      g.addColorStop(0.7, `rgba(120,60,30,${(0.01 * breathe).toFixed(4)})`);
      g.addColorStop(1, 'rgba(80,40,20,0)');
      ctx.fillStyle = g;
      ctx.fillRect(gx - glowW, horizonY - glowH, glowW * 2, glowH * 2);

      const g2 = ctx.createRadialGradient(
        cw * 0.15,
        horizonY,
        0,
        cw * 0.15,
        horizonY,
        cw * 0.12
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
        const tw1 = Math.sin(time * s.sp + s.ph);
        const tw2 = Math.sin(time * s.sp * 2.3 + s.ph * 1.7);
        const twinkle = tw1 * 0.6 + tw2 * 0.4;
        const a = s.a * (0.15 + 0.85 * ((twinkle + 1) * 0.5));
        if (a <= 0.005) continue;

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(210,220,245,${a.toFixed(3)})`;
        ctx.fill();

        if (s.r > 0.6 && a > 0.1) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(200,215,240,${(a * 0.12).toFixed(4)})`;
          ctx.fill();

          if (a > 0.2) {
            ctx.save();
            ctx.globalAlpha = a * 0.25;
            ctx.strokeStyle = 'rgba(220,230,255,0.4)';
            ctx.lineWidth = 0.3;
            const len = s.r * 4;
            ctx.beginPath();
            ctx.moveTo(s.x - len, s.y);
            ctx.lineTo(s.x + len, s.y);
            ctx.moveTo(s.x, s.y - len);
            ctx.lineTo(s.x, s.y + len);
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

      // === Massive bloom glow (user liked this) ===
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      // Layer 1: huge atmospheric glow
      const bloom1 = mr * 12;
      const gb1 = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, bloom1);
      gb1.addColorStop(0, 'rgba(180,200,230,0.07)');
      gb1.addColorStop(0.15, 'rgba(140,170,210,0.035)');
      gb1.addColorStop(0.4, 'rgba(100,140,190,0.012)');
      gb1.addColorStop(1, 'rgba(60,100,160,0)');
      ctx.fillStyle = gb1;
      ctx.fillRect(mx - bloom1, my - bloom1, bloom1 * 2, bloom1 * 2);

      // Layer 2: bright inner halo
      const bloom2 = mr * 5;
      const gb2 = ctx.createRadialGradient(mx, my, mr * 0.8, mx, my, bloom2);
      gb2.addColorStop(0, 'rgba(210,225,250,0.12)');
      gb2.addColorStop(0.3, 'rgba(180,200,235,0.05)');
      gb2.addColorStop(1, 'rgba(140,170,210,0)');
      ctx.fillStyle = gb2;
      ctx.fillRect(mx - bloom2, my - bloom2, bloom2 * 2, bloom2 * 2);

      // Layer 3: hot white core glow
      const bloom3 = mr * 2.5;
      const gb3 = ctx.createRadialGradient(mx, my, mr * 0.3, mx, my, bloom3);
      gb3.addColorStop(0, 'rgba(240,245,255,0.15)');
      gb3.addColorStop(0.5, 'rgba(220,235,255,0.06)');
      gb3.addColorStop(1, 'rgba(200,220,250,0)');
      ctx.fillStyle = gb3;
      ctx.fillRect(mx - bloom3, my - bloom3, bloom3 * 2, bloom3 * 2);

      ctx.restore();

      // Moon disc
      ctx.save();
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(225,235,250,0.45)';
      ctx.fill();

      // Surface highlight
      const hlg = ctx.createRadialGradient(
        mx - mr * 0.2,
        my - mr * 0.2,
        mr * 0.1,
        mx,
        my,
        mr
      );
      hlg.addColorStop(0, 'rgba(255,255,255,0.15)');
      hlg.addColorStop(0.5, 'rgba(220,235,255,0.05)');
      hlg.addColorStop(1, 'rgba(200,220,250,0)');
      ctx.fillStyle = hlg;
      ctx.fill();

      // Mare (dark patches)
      ctx.globalAlpha = 0.08;
      const patches = [
        { x: -0.15, y: -0.1, r: 0.25 },
        { x: 0.2, y: 0.15, r: 0.2 },
        { x: -0.05, y: 0.25, r: 0.18 },
        { x: 0.25, y: -0.2, r: 0.12 },
        { x: -0.3, y: 0.1, r: 0.15 },
      ];
      for (const p of patches) {
        ctx.beginPath();
        ctx.arc(mx + p.x * mr, my + p.y * mr, p.r * mr, 0, Math.PI * 2);
        ctx.fillStyle = '#0a1220';
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Subtle rim light
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(220,235,255,0.3)';
      ctx.lineWidth = 0.6;
      ctx.stroke();

      ctx.restore();
    }

    function drawClouds(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
      const mx = cw * 0.82;
      const my = ch * 0.14;

      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      // 3 wispy cloud bands drifting near the moon
      const clouds = [
        { yOff: -0.02, speed: 0.08, width: 0.25, height: 8, alpha: 0.025 },
        { yOff: 0.03, speed: 0.05, width: 0.3, height: 6, alpha: 0.02 },
        { yOff: 0.07, speed: 0.12, width: 0.2, height: 5, alpha: 0.015 },
      ];

      for (const c of clouds) {
        const cx = mx + Math.sin(time * c.speed) * cw * 0.06;
        const cy = my + ch * c.yOff;
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
      const oceanH = ch - horizonY;

      // Deep ocean body
      const og = ctx.createLinearGradient(0, horizonY, 0, ch);
      og.addColorStop(0, 'rgba(8,20,36,0.75)');
      og.addColorStop(0.4, 'rgba(5,12,24,0.85)');
      og.addColorStop(1, 'rgba(2,6,12,0.95)');
      ctx.fillStyle = og;
      ctx.fillRect(0, horizonY, cw, oceanH);

      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      // 7 wave layers for rich, visible swells
      const waves = [
        { yOff: 0, amp: 3.5, freq: 0.005, speed: 0.4, alpha: 0.06 },
        { yOff: 8, amp: 2.8, freq: 0.007, speed: 0.32, alpha: 0.05 },
        { yOff: 18, amp: 2.2, freq: 0.01, speed: 0.45, alpha: 0.04 },
        { yOff: 30, amp: 1.8, freq: 0.014, speed: 0.38, alpha: 0.035 },
        { yOff: 45, amp: 1.4, freq: 0.018, speed: 0.42, alpha: 0.025 },
        { yOff: 62, amp: 0.9, freq: 0.023, speed: 0.5, alpha: 0.02 },
        { yOff: 82, amp: 0.5, freq: 0.028, speed: 0.38, alpha: 0.015 },
      ];

      for (const wc of waves) {
        ctx.beginPath();
        for (let x = 0; x <= cw; x += 3) {
          const y =
            horizonY +
            wc.yOff +
            Math.sin(x * wc.freq + time * wc.speed) * wc.amp +
            Math.sin(x * wc.freq * 0.55 + time * wc.speed * 1.4) *
              wc.amp *
              0.45 +
            Math.sin(x * wc.freq * 2.0 + time * wc.speed * 0.6) * wc.amp * 0.12;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(100,155,215,${wc.alpha})`;
        ctx.lineWidth = 1.0;
        ctx.stroke();
      }

      // Horizon mist — dreamy atmospheric fog at the waterline
      const mistH = oceanH * 0.25;
      const mist = ctx.createLinearGradient(
        0,
        horizonY - 5,
        0,
        horizonY + mistH
      );
      mist.addColorStop(0, 'rgba(100,140,190,0.035)');
      mist.addColorStop(0.3, 'rgba(80,120,170,0.025)');
      mist.addColorStop(1, 'rgba(60,100,150,0)');
      ctx.fillStyle = mist;
      ctx.fillRect(0, horizonY - 5, cw, mistH + 5);

      ctx.restore();
    }

    function drawMoonReflection(
      ctx: CanvasRenderingContext2D,
      cw: number,
      ch: number
    ) {
      const mx = cw * 0.82;
      const horizonY = ch * 0.69;
      const oceanH = ch - horizonY;

      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      // Wide moonlight shimmer path
      const segCount = 25;
      for (let i = 0; i < segCount; i++) {
        const t = i / segCount;
        const segY = horizonY + oceanH * t;
        const segH = oceanH / segCount + 1.5;

        // Widens with perspective
        const spread = cw * (0.03 + t * 0.08);
        const wobble = Math.sin(time * 0.5 + i * 0.6) * (spread * 0.12);
        const centerX = mx + wobble;

        const baseAlpha = (1 - t * 0.7) * 0.065;
        const shimmer = 0.7 + 0.3 * Math.sin(time * 0.4 + i * 0.9);
        const alpha = baseAlpha * shimmer;
        if (alpha <= 0.001) continue;

        const rg = ctx.createLinearGradient(
          centerX - spread,
          segY,
          centerX + spread,
          segY
        );
        rg.addColorStop(0, 'rgba(140,180,220,0)');
        rg.addColorStop(0.25, `rgba(160,195,230,${(alpha * 0.4).toFixed(4)})`);
        rg.addColorStop(0.5, `rgba(200,225,250,${alpha.toFixed(4)})`);
        rg.addColorStop(0.75, `rgba(160,195,230,${(alpha * 0.4).toFixed(4)})`);
        rg.addColorStop(1, 'rgba(140,180,220,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(centerX - spread, segY, spread * 2, segH);
      }

      // Organic specular glints scattered along the moonlight path
      const glintCount = 60;
      for (let i = 0; i < glintCount; i++) {
        const r1 = (Math.sin(i * 12.9898) * 43758.5453) % 1;
        const r2 = (Math.sin(i * 78.233) * 43758.5453) % 1;
        const r3 = (Math.sin(i * 37.719) * 43758.5453) % 1;

        const t = Math.abs(r1);
        const sy = horizonY + oceanH * Math.pow(t, 1.3);
        const spreadX = cw * (0.025 + t * 0.07);
        const sx =
          mx + (r2 - 0.5) * spreadX * 2.5 + Math.sin(time * 0.5 + i * 1.7) * 6;

        // Each glint has unique flash rhythm
        const flash = Math.sin(time * (1.5 + r3 * 2.5) + i * 4.3);
        if (flash > 0.5) {
          const intensity = (flash - 0.5) / 0.5;
          const alpha = (0.04 + 0.08 * (1 - t)) * intensity;
          if (alpha > 0.008) {
            ctx.beginPath();
            const w = 1.5 + t * 4;
            ctx.ellipse(sx, sy, w, 0.5 + t * 0.5, 0, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(220,240,255,${alpha.toFixed(3)})`;
            ctx.fill();
          }
        }
      }

      ctx.restore();
    }

    function drawShip(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
      const horizonY = ch * 0.69;
      const shipX = cw * 0.3 + Math.sin(time * 0.06) * cw * 0.008;
      const bobY = Math.sin(time * 0.5) * 1.5;
      const tilt = Math.sin(time * 0.4) * 0.015;
      const s = Math.min(cw, ch) * 0.001;

      ctx.save();
      ctx.translate(shipX, horizonY - 1 + bobY);
      ctx.rotate(tilt);
      ctx.scale(s, s);
      ctx.globalAlpha = 0.15;

      // Hull
      ctx.beginPath();
      ctx.moveTo(-40, 0);
      ctx.bezierCurveTo(-35, 5, -15, 12, 5, 12);
      ctx.bezierCurveTo(25, 12, 40, 6, 45, -2);
      ctx.lineTo(42, -5);
      ctx.bezierCurveTo(30, 2, 10, 5, -10, 5);
      ctx.bezierCurveTo(-25, 4, -38, 0, -40, 0);
      ctx.fillStyle = '#0a0d17';
      ctx.fill();

      // Stern
      ctx.beginPath();
      ctx.moveTo(-38, 0);
      ctx.lineTo(-40, -15);
      ctx.lineTo(-30, -18);
      ctx.lineTo(-25, -5);
      ctx.closePath();
      ctx.fillStyle = '#0a0d17';
      ctx.fill();

      // Masts
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -65);
      ctx.moveTo(20, 0);
      ctx.lineTo(20, -45);
      ctx.strokeStyle = '#0e121e';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Sails
      const sailPuff = Math.sin(time * 0.3) * 2 + 12;
      ctx.beginPath();
      ctx.moveTo(1, -58);
      ctx.quadraticCurveTo(sailPuff + 6, -42, sailPuff + 4, -18);
      ctx.lineTo(2, -18);
      ctx.fillStyle = 'rgba(160,180,200,0.18)';
      ctx.fill();

      const forePuff = Math.sin(time * 0.35 + 1) * 1.5 + 8;
      ctx.beginPath();
      ctx.moveTo(21, -42);
      ctx.quadraticCurveTo(21 + forePuff + 4, -30, 21 + forePuff + 2, -10);
      ctx.lineTo(21, -10);
      ctx.fillStyle = 'rgba(160,180,200,0.14)';
      ctx.fill();

      // Bowsprit & Jib
      ctx.beginPath();
      ctx.moveTo(40, -3);
      ctx.lineTo(60, -12);
      ctx.strokeStyle = '#0e121e';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(58, -11);
      ctx.lineTo(20, -40);
      ctx.lineTo(22, -5);
      ctx.fillStyle = 'rgba(160,180,200,0.06)';
      ctx.fill();

      ctx.restore();
    }

    function drawSeagulls(
      ctx: CanvasRenderingContext2D,
      cw: number,
      ch: number
    ) {
      const horizonY = ch * 0.69;
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = '#809ab5';
      ctx.lineWidth = 0.8;

      const gulls = [
        {
          baseX: 0.35,
          baseY: -0.08,
          speed: 0.04,
          wingSpeed: 2.5,
          size: 1.0,
          phase: 0,
        },
        {
          baseX: 0.42,
          baseY: -0.12,
          speed: 0.03,
          wingSpeed: 3.0,
          size: 0.7,
          phase: 2,
        },
        {
          baseX: 0.48,
          baseY: -0.06,
          speed: 0.05,
          wingSpeed: 2.2,
          size: 0.85,
          phase: 4,
        },
      ];

      for (const g of gulls) {
        const rawX =
          (g.baseX * cw + time * g.speed * cw * 0.1 + g.phase * cw * 0.1) %
          (cw * 1.3);
        const gx = rawX - cw * 0.15;
        const gy = horizonY + g.baseY * ch + Math.sin(time * 0.5 + g.phase) * 3;
        const wingFlap = Math.sin(time * g.wingSpeed + g.phase) * 5 * g.size;
        const span = 10 * g.size;

        ctx.beginPath();
        ctx.moveTo(gx - span, gy + wingFlap);
        ctx.quadraticCurveTo(
          gx - span * 0.4,
          gy - Math.abs(wingFlap) * 0.3,
          gx,
          gy
        );
        ctx.quadraticCurveTo(
          gx + span * 0.4,
          gy - Math.abs(wingFlap) * 0.3,
          gx + span,
          gy + wingFlap
        );
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawShootingStars(
      ctx: CanvasRenderingContext2D,
      cw: number,
      ch: number
    ) {
      const skyH = ch * 0.65;
      shootingStarTimer--;
      if (shootingStarTimer <= 0) {
        shootingStars.push({
          x: Math.random() * cw * 0.8,
          y: Math.random() * skyH * 0.5,
          vx: Math.cos(0.5) * (4 + Math.random() * 2),
          vy: Math.sin(0.5) * (4 + Math.random() * 2),
          life: 0,
          maxLife: 25 + Math.random() * 15,
          len: 15 + Math.random() * 20,
        });
        shootingStarTimer = 400 + Math.random() * 600;
      }

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      shootingStars = shootingStars.filter((ss) => {
        ss.x += ss.vx;
        ss.y += ss.vy;
        ss.life++;
        if (ss.life > ss.maxLife) return false;
        const progress = ss.life / ss.maxLife;
        const alpha =
          progress < 0.2 ? progress / 0.2 : 1 - (progress - 0.2) / 0.8;

        const tailX = ss.x - ss.vx * (ss.len / Math.hypot(ss.vx, ss.vy));
        const tailY = ss.y - ss.vy * (ss.len / Math.hypot(ss.vx, ss.vy));
        const tg = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y);
        tg.addColorStop(0, 'rgba(200,220,255,0)');
        tg.addColorStop(1, `rgba(240,245,255,${(alpha * 0.4).toFixed(3)})`);

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(ss.x, ss.y);
        ctx.strokeStyle = tg;
        ctx.lineWidth = 1.0;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(ss.x, ss.y, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(240,245,255,${(alpha * 0.5).toFixed(3)})`;
        ctx.fill();
        return true;
      });
      ctx.restore();
    }

    function drawWindParticles(
      ctx: CanvasRenderingContext2D,
      cw: number,
      ch: number
    ) {
      if (particles.length < MAX_PARTICLES && Math.random() < 0.15)
        spawnParticle(cw, ch);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      particles = particles.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        if (p.life > p.maxLife || p.x > cw + 20) return false;
        const alpha =
          p.a *
          Math.min(1, (p.life / p.maxLife) * 5) *
          Math.max(0, 1 - (p.life / p.maxLife - 0.7) / 0.3);
        if (alpha > 0.003) {
          ctx.beginPath();
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
