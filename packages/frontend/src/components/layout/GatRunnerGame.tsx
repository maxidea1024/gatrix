import React, { useRef, useEffect, useCallback } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface GatRunnerGameProps {
  open: boolean;
  onClose: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PI = Math.PI;
const W = 800;
const H = 260;
const GY = 210; // ground Y
const CAT_X = 100;
const GRAV = 0.65;
const JUMP_V = -12.5;
const INIT_SPEED = 5;
const SPEED_INC = 0.002;
const MAX_SPEED = 14;

// ─── Cat Drawing (faces RIGHT) ───────────────────────────────────────────────

function drawCatRun(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  f: number
) {
  ctx.save();
  ctx.translate(x, y);
  const S = 0.65;
  ctx.translate(0, Math.sin(f * 0.4) * 2); // bounce

  ctx.fillStyle = '#1a1a1a';

  // Tail (left)
  ctx.save();
  ctx.translate(-22 * S, -28 * S);
  ctx.rotate(-Math.sin(f * 0.3) * 0.3);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-12 * S, -18 * S, -22 * S, -32 * S, -16 * S, -42 * S);
  ctx.bezierCurveTo(-10 * S, -46 * S, -4 * S, -36 * S, -6 * S, -26 * S);
  ctx.bezierCurveTo(-8 * S, -18 * S, -4 * S, -4 * S, 0, 0);
  ctx.fill();
  ctx.restore();

  // Body
  ctx.beginPath();
  ctx.ellipse(0, -18 * S, 26 * S, 22 * S, 0, 0, PI * 2);
  ctx.fill();

  // Back legs (left side, behind body)
  const lp = f * 0.35;
  ctx.save();
  ctx.translate(-14 * S, -2 * S);
  ctx.rotate(Math.sin(lp + PI * 0.5) * 0.5);
  ctx.beginPath();
  ctx.ellipse(0, 9 * S, 5 * S, 11 * S, 0, 0, PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-1 * S, 20 * S, 6 * S, 3 * S, 0, 0, PI * 2);
  ctx.fill();
  ctx.restore();

  // Head (right side)
  ctx.beginPath();
  ctx.arc(10 * S, -44 * S, 20 * S, 0, PI * 2);
  ctx.fill();

  // Ears
  ctx.beginPath();
  ctx.moveTo(-2 * S, -56 * S);
  ctx.lineTo(-8 * S, -72 * S);
  ctx.lineTo(-14 * S, -56 * S);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(20 * S, -56 * S);
  ctx.lineTo(28 * S, -72 * S);
  ctx.lineTo(14 * S, -60 * S);
  ctx.closePath();
  ctx.fill();

  // Eyes (big white, facing right)
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(2 * S, -46 * S, 7 * S, 0, PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(18 * S, -48 * S, 6.5 * S, 0, PI * 2);
  ctx.fill();
  // Pupils
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(5 * S, -45 * S, 3.5 * S, 0, PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(20 * S, -47 * S, 3 * S, 0, PI * 2);
  ctx.fill();
  // Highlights
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(6 * S, -47 * S, 1.2 * S, 0, PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(21 * S, -49 * S, 1.2 * S, 0, PI * 2);
  ctx.fill();

  // Mouth (ω)
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(8 * S, -34 * S);
  ctx.quadraticCurveTo(10 * S, -30 * S, 13 * S, -33 * S);
  ctx.quadraticCurveTo(16 * S, -30 * S, 18 * S, -33 * S);
  ctx.stroke();

  // Front legs (right side, in front)
  ctx.fillStyle = '#1a1a1a';
  ctx.save();
  ctx.translate(10 * S, -2 * S);
  ctx.rotate(Math.sin(lp) * 0.6);
  ctx.beginPath();
  ctx.ellipse(0, 9 * S, 5 * S, 11 * S, 0, 0, PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 20 * S, 6 * S, 3 * S, 0, 0, PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(2 * S, -2 * S);
  ctx.rotate(Math.sin(lp + PI) * 0.6);
  ctx.beginPath();
  ctx.ellipse(0, 9 * S, 5 * S, 11 * S, 0, 0, PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 20 * S, 6 * S, 3 * S, 0, 0, PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

function drawCatJump(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  const S = 0.65;
  ctx.fillStyle = '#1a1a1a';

  // Tail (up-left)
  ctx.beginPath();
  ctx.moveTo(-20 * S, -22 * S);
  ctx.bezierCurveTo(-28 * S, -38 * S, -32 * S, -50 * S, -24 * S, -55 * S);
  ctx.bezierCurveTo(-18 * S, -52 * S, -18 * S, -40 * S, -16 * S, -28 * S);
  ctx.closePath();
  ctx.fill();

  // Body
  ctx.beginPath();
  ctx.ellipse(0, -20 * S, 24 * S, 20 * S, 0, 0, PI * 2);
  ctx.fill();
  // Head
  ctx.beginPath();
  ctx.arc(10 * S, -44 * S, 20 * S, 0, PI * 2);
  ctx.fill();
  // Ears
  ctx.beginPath();
  ctx.moveTo(-2 * S, -56 * S);
  ctx.lineTo(-8 * S, -72 * S);
  ctx.lineTo(-14 * S, -56 * S);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(20 * S, -56 * S);
  ctx.lineTo(28 * S, -72 * S);
  ctx.lineTo(14 * S, -60 * S);
  ctx.closePath();
  ctx.fill();

  // Eyes (wide)
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(2 * S, -46 * S, 8 * S, 0, PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(18 * S, -48 * S, 7.5 * S, 0, PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(5 * S, -45 * S, 3 * S, 0, PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(20 * S, -47 * S, 2.5 * S, 0, PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(6 * S, -47 * S, 1.2 * S, 0, PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(21 * S, -49 * S, 1.2 * S, 0, PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(8 * S, -34 * S);
  ctx.quadraticCurveTo(10 * S, -30 * S, 13 * S, -33 * S);
  ctx.quadraticCurveTo(16 * S, -30 * S, 18 * S, -33 * S);
  ctx.stroke();

  // Legs tucked
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(8 * S, 0, 7 * S, 4 * S, 0.3, 0, PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-2 * S, 1 * S, 6 * S, 4 * S, -0.2, 0, PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-14 * S, -1 * S, 8 * S, 4 * S, -0.3, 0, PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-22 * S, 1 * S, 7 * S, 4 * S, 0.2, 0, PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawCatDead(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  const S = 0.65;
  ctx.fillStyle = '#1a1a1a';

  // Tail drooping
  ctx.beginPath();
  ctx.moveTo(-20 * S, -18 * S);
  ctx.bezierCurveTo(-28 * S, -8 * S, -32 * S, 2 * S, -28 * S, 6 * S);
  ctx.bezierCurveTo(-24 * S, 8 * S, -20 * S, -4 * S, -16 * S, -14 * S);
  ctx.closePath();
  ctx.fill();

  // Body
  ctx.beginPath();
  ctx.ellipse(0, -16 * S, 26 * S, 20 * S, 0, 0, PI * 2);
  ctx.fill();

  // Head (tilted)
  ctx.save();
  ctx.rotate(-0.12);
  ctx.beginPath();
  ctx.arc(8 * S, -42 * S, 20 * S, 0, PI * 2);
  ctx.fill();
  // Ears
  ctx.beginPath();
  ctx.moveTo(-4 * S, -54 * S);
  ctx.lineTo(-10 * S, -70 * S);
  ctx.lineTo(-16 * S, -54 * S);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(18 * S, -54 * S);
  ctx.lineTo(26 * S, -70 * S);
  ctx.lineTo(12 * S, -58 * S);
  ctx.closePath();
  ctx.fill();

  // X eyes
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-2 * S, -50 * S);
  ctx.lineTo(8 * S, -40 * S);
  ctx.moveTo(8 * S, -50 * S);
  ctx.lineTo(-2 * S, -40 * S);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(14 * S, -52 * S);
  ctx.lineTo(24 * S, -42 * S);
  ctx.moveTo(24 * S, -52 * S);
  ctx.lineTo(14 * S, -42 * S);
  ctx.stroke();

  // Tongue
  ctx.fillStyle = '#ff6b8a';
  ctx.beginPath();
  ctx.ellipse(14 * S, -28 * S, 3.5 * S, 5 * S, -0.2, 0, PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(6 * S, -32 * S);
  ctx.lineTo(18 * S, -31 * S);
  ctx.stroke();
  ctx.restore();

  // Sweat
  ctx.fillStyle = '#64b5f6';
  ctx.beginPath();
  ctx.moveTo(28 * S, -60 * S);
  ctx.quadraticCurveTo(30 * S, -54 * S, 26 * S, -52 * S);
  ctx.quadraticCurveTo(24 * S, -54 * S, 28 * S, -60 * S);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-22 * S, -65 * S);
  ctx.quadraticCurveTo(-20 * S, -59 * S, -24 * S, -57 * S);
  ctx.quadraticCurveTo(-26 * S, -59 * S, -22 * S, -65 * S);
  ctx.fill();

  // Stars
  ctx.fillStyle = '#ffeb3b';
  drawStar(ctx, 32 * S, -65 * S, 4, 5);
  drawStar(ctx, -28 * S, -70 * S, 3, 4);

  // Legs splayed
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(14 * S, 2 * S, 7 * S, 4 * S, 0.4, 0, PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-14 * S, 2 * S, 7 * S, 4 * S, -0.4, 0, PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(4 * S, 4 * S, 6 * S, 3 * S, 0, 0, PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-24 * S, 3 * S, 6 * S, 3 * S, -0.3, 0, PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  pts: number
) {
  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const rad = i % 2 === 0 ? r : r * 0.4;
    const a = (i * PI) / pts - PI / 2;
    if (i === 0) ctx.moveTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
    else ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
}

// ─── Mouse (target, runs ahead of cat) ────────────────────────────────────────

function drawMouseRunner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  f: number
) {
  ctx.save();
  ctx.translate(x, y);

  const S = 0.8;
  const bounce = Math.sin(f * 0.5) * 1.5;
  ctx.translate(0, bounce);

  // Body
  ctx.fillStyle = '#9e9e9e';
  ctx.beginPath();
  ctx.ellipse(0, -8 * S, 10 * S, 8 * S, 0, 0, PI * 2);
  ctx.fill();

  // Head (right, facing away)
  ctx.beginPath();
  ctx.arc(10 * S, -14 * S, 8 * S, 0, PI * 2);
  ctx.fill();

  // Ears
  ctx.fillStyle = '#b0b0b0';
  ctx.beginPath();
  ctx.arc(8 * S, -22 * S, 4 * S, 0, PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(14 * S, -22 * S, 4 * S, 0, PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffb6c1';
  ctx.beginPath();
  ctx.arc(8 * S, -22 * S, 2 * S, 0, PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(14 * S, -22 * S, 2 * S, 0, PI * 2);
  ctx.fill();

  // Eye
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(16 * S, -14 * S, 2 * S, 0, PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(16.5 * S, -14.5 * S, 0.8 * S, 0, PI * 2);
  ctx.fill();

  // Nose
  ctx.fillStyle = '#ff9eb5';
  ctx.beginPath();
  ctx.arc(18 * S, -12 * S, 1.5 * S, 0, PI * 2);
  ctx.fill();

  // Tail (left, behind)
  ctx.strokeStyle = '#c09090';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  const tw = Math.sin(f * 0.25) * 4;
  ctx.beginPath();
  ctx.moveTo(-10 * S, -6 * S);
  ctx.quadraticCurveTo(-18 * S, -10 * S + tw, -22 * S, -4 * S + tw);
  ctx.stroke();

  // Legs
  ctx.fillStyle = '#9e9e9e';
  const la = Math.floor(f / 4) % 2;
  ctx.beginPath();
  ctx.ellipse(6 * S, 0 + la * S, 3 * S, 4 * S, 0, 0, PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-4 * S, 0 + (1 - la) * S, 3 * S, 4 * S, 0, 0, PI * 2);
  ctx.fill();

  // Cheese (held in front)
  ctx.fillStyle = '#ffd600';
  ctx.beginPath();
  ctx.moveTo(18 * S, -8 * S);
  ctx.lineTo(26 * S, -12 * S);
  ctx.lineTo(26 * S, -4 * S);
  ctx.closePath();
  ctx.fill();
  // Cheese holes
  ctx.fillStyle = '#ffb300';
  ctx.beginPath();
  ctx.arc(22 * S, -9 * S, 1 * S, 0, PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(24 * S, -6 * S, 0.8 * S, 0, PI * 2);
  ctx.fill();

  ctx.restore();
}

// ─── Obstacles (boxes, yarn balls) ───────────────────────────────────────────

function drawObstacle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: 'box' | 'box_tall' | 'yarn'
) {
  ctx.save();
  ctx.translate(x, y);

  if (type === 'box') {
    // Small cardboard box
    ctx.fillStyle = '#a1887f';
    ctx.fillRect(-12, -20, 24, 20);
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(-12, -20, 24, 4);
    // Flaps
    ctx.strokeStyle = '#795548';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-12, -20);
    ctx.lineTo(-6, -26);
    ctx.lineTo(0, -20);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(6, -26);
    ctx.lineTo(12, -20);
    ctx.stroke();
    // Tape
    ctx.strokeStyle = '#e8d5b7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(0, -6);
    ctx.stroke();
  } else if (type === 'box_tall') {
    // Tall stacked boxes
    ctx.fillStyle = '#a1887f';
    ctx.fillRect(-14, -40, 28, 40);
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(-14, -40, 28, 4);
    ctx.fillRect(-14, -20, 28, 3);
    ctx.strokeStyle = '#795548';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-14, -20);
    ctx.lineTo(14, -20);
    ctx.stroke();
    // Tape
    ctx.strokeStyle = '#e8d5b7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -40);
    ctx.lineTo(0, -28);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(0, -8);
    ctx.stroke();
  } else {
    // Yarn ball
    ctx.fillStyle = '#ef5350';
    ctx.beginPath();
    ctx.arc(0, -12, 12, 0, PI * 2);
    ctx.fill();
    // Yarn lines
    ctx.strokeStyle = '#c62828';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -12, 8, 0.3, PI * 1.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -12, 5, PI * 0.8, PI * 2);
    ctx.stroke();
    // Yarn tail
    ctx.strokeStyle = '#ef5350';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(10, -6);
    ctx.quadraticCurveTo(16, -2, 14, 0);
    ctx.stroke();
  }

  ctx.restore();
}

// ─── Scenery ──────────────────────────────────────────────────────────────────

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(x + 15, y, 10, 0, PI * 2);
  ctx.arc(x + 5, y - 3, 8, 0, PI * 2);
  ctx.arc(x + 25, y - 2, 9, 0, PI * 2);
  ctx.arc(x + 10, y + 2, 7, 0, PI * 2);
  ctx.arc(x + 20, y + 1, 8, 0, PI * 2);
  ctx.fill();
}

function drawGround(ctx: CanvasRenderingContext2D, off: number) {
  ctx.fillStyle = '#555';
  ctx.fillRect(0, GY, W, 2);
  ctx.fillStyle = '#777';
  for (let i = 0; i < W; i += 12)
    ctx.fillRect((i + off * 0.5) % W, GY + 4, 6, 1);
  for (let i = 0; i < W; i += 20)
    ctx.fillRect((i + off * 0.3) % W, GY + 8, 3, 1);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ObsType = 'box' | 'box_tall' | 'yarn';
interface Obstacle {
  x: number;
  type: ObsType;
}
interface Cloud {
  x: number;
  y: number;
  speed: number;
}

const OBS_TYPES: ObsType[] = ['box', 'box_tall', 'yarn'];

function obsHitbox(type: ObsType) {
  if (type === 'box') return { w: 20, h: 20 };
  if (type === 'box_tall') return { w: 24, h: 40 };
  return { w: 20, h: 24 }; // yarn
}

// ─── Component ────────────────────────────────────────────────────────────────

const GatRunnerGame: React.FC<GatRunnerGameProps> = ({ open, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  // Store onClose in ref to avoid useEffect re-runs when parent re-renders
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const stateRef = useRef({
    catY: GY,
    velY: 0,
    jumping: false,
    jumpCount: 0,
    obstacles: [] as Obstacle[],
    clouds: [] as Cloud[],
    score: 0,
    highScore: 0,
    speed: INIT_SPEED,
    frame: 0,
    gameOver: false,
    started: false,
    nextObsDist: 200,
    mouseX: W - 80,
    gameOverCooldown: 0, // frames to wait before allowing restart
  });

  const jump = useCallback(() => {
    const s = stateRef.current;
    if (s.gameOver) {
      if (s.gameOverCooldown > 0) return; // Still in cooldown, ignore
      s.catY = GY;
      s.velY = 0;
      s.jumping = false;
      s.jumpCount = 0;
      s.obstacles = [];
      s.score = 0;
      s.speed = INIT_SPEED;
      s.gameOver = false;
      s.started = true;
      s.nextObsDist = 200;
      s.mouseX = W - 80;
      return;
    }
    if (!s.started) s.started = true;
    if (s.jumpCount < 2) {
      s.velY = JUMP_V;
      s.jumping = true;
      s.jumpCount++;
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    const s = stateRef.current;
    s.catY = GY;
    s.velY = 0;
    s.jumping = false;
    s.obstacles = [];
    s.clouds = [
      { x: 100, y: 30, speed: 0.5 },
      { x: 300, y: 50, speed: 0.3 },
      { x: 550, y: 20, speed: 0.4 },
    ];
    s.score = 0;
    s.speed = INIT_SPEED;
    s.frame = 0;
    s.gameOver = false;
    s.started = false;
    s.nextObsDist = 200;
    s.mouseX = W - 80;

    try {
      const saved = localStorage.getItem('gat-runner-highscore');
      if (saved) s.highScore = parseInt(saved, 10);
    } catch {
      /* */
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // Cache gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GY);
    skyGrad.addColorStop(0, '#e8f4fd');
    skyGrad.addColorStop(1, '#f5f9fc');

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
    };
    const onTouch = (e: TouchEvent) => {
      e.preventDefault();
      jump();
    };

    window.addEventListener('keydown', onKey);
    canvas.addEventListener('touchstart', onTouch, { passive: false });

    const loop = () => {
      const s = stateRef.current;
      if (!s.gameOver) s.frame++;
      if (s.gameOverCooldown > 0) s.gameOverCooldown--;

      // ── Draw background ──
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, GY);
      ctx.fillStyle = '#f0ebe3';
      ctx.fillRect(0, GY, W, H - GY);

      for (const c of s.clouds) {
        drawCloud(ctx, c.x, c.y);
        if (s.started && !s.gameOver) {
          c.x -= c.speed;
          if (c.x < -40) {
            c.x = W + 20;
            c.y = 15 + Math.random() * 50;
          }
        }
      }
      drawGround(ctx, s.started ? s.frame * s.speed : 0);

      // ── Game logic ──
      if (s.started && !s.gameOver) {
        s.velY += GRAV;
        s.catY += s.velY;
        if (s.catY >= GY) {
          s.catY = GY;
          s.velY = 0;
          s.jumping = false;
          s.jumpCount = 0;
        }
        if (s.speed < MAX_SPEED) s.speed += SPEED_INC;
        s.score += 0.15;

        // Mouse drifts close (near cat!) then runs far away — teasing
        const close = CAT_X + 60; // closest: right in front of cat
        const far = W - 40; // farthest: near right edge
        const mid = (close + far) / 2;
        const range = (far - close) / 2;
        s.mouseX =
          mid +
          Math.sin(s.frame * 0.006) * range +
          Math.sin(s.frame * 0.019) * 25;

        // Spawn obstacles (generous spacing)
        s.nextObsDist -= s.speed;
        if (s.nextObsDist <= 0) {
          const type = OBS_TYPES[Math.floor(Math.random() * OBS_TYPES.length)];
          s.obstacles.push({ x: W + 30, type });
          s.nextObsDist = 160 + Math.random() * 200 + 350 / s.speed;
        }

        // Move & collide
        for (let i = s.obstacles.length - 1; i >= 0; i--) {
          const o = s.obstacles[i];
          o.x -= s.speed;
          if (o.x < -40) {
            s.obstacles.splice(i, 1);
            continue;
          }

          const hb = obsHitbox(o.type);
          const catL = CAT_X - 12,
            catR = CAT_X + 12;
          const catT = s.catY - 42,
            catB = s.catY + 2;
          const oL = o.x - hb.w / 2,
            oR = o.x + hb.w / 2;
          const oT = GY - hb.h;

          if (catR > oL + 3 && catL < oR - 3 && catB > oT + 3 && catT < GY) {
            s.gameOver = true;
            s.gameOverCooldown = 120; // ~2 seconds at 60fps
            const fs = Math.floor(s.score);
            if (fs > s.highScore) {
              s.highScore = fs;
              try {
                localStorage.setItem('gat-runner-highscore', String(fs));
              } catch {
                /* */
              }
            }
          }
        }
      }

      // ── Draw mouse (ahead, target) ──
      if (s.started) {
        drawMouseRunner(ctx, s.mouseX, GY, s.frame);
      }

      // ── Draw obstacles (with wiggle) ──
      for (const o of s.obstacles) {
        const wiggleY = Math.sin(s.frame * 0.12 + o.x * 0.05) * 1.5;
        const wiggleR = Math.sin(s.frame * 0.08 + o.x * 0.03) * 0.02;
        ctx.save();
        ctx.translate(o.x, GY + wiggleY);
        ctx.rotate(wiggleR);
        drawObstacle(ctx, 0, 0, o.type);
        ctx.restore();
      }

      // ── Draw cat ──
      if (s.gameOver) drawCatDead(ctx, CAT_X, s.catY);
      else if (s.jumping) drawCatJump(ctx, CAT_X, s.catY);
      else drawCatRun(ctx, CAT_X, s.catY, s.frame);

      // ── HUD ──
      if (s.started) {
        ctx.textAlign = 'right';
        ctx.font = 'bold 14px "Inter", monospace';
        if (s.highScore > 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillText(
            `HI ${String(s.highScore).padStart(5, '0')}`,
            W - 90,
            24
          );
        }
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillText(String(Math.floor(s.score)).padStart(5, '0'), W - 16, 24);
      }

      // ── Overlays ──
      if (!s.started) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, 0, W, H);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px "Inter", sans-serif';
        ctx.fillText('Gat Runner', W / 2, H / 2 - 24);
        ctx.font = '13px "Inter", sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillText(
          '\uCE58\uC988\uB97C \uD6D4\uCE5C \uC950\uB97C \uC7A1\uC544\uB77C!',
          W / 2,
          H / 2 + 4
        );
        ctx.font = '12px "Inter", sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText('Space / \u2191 / Click', W / 2, H / 2 + 28);
      }

      if (s.gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(0, 0, W, H);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px "Inter", sans-serif';
        ctx.fillText('GAME OVER', W / 2, H / 2 - 16);
        ctx.font = '14px "Inter", sans-serif';
        ctx.fillText(`Score: ${Math.floor(s.score)}`, W / 2, H / 2 + 12);
        ctx.font = '12px "Inter", sans-serif';
        if (s.gameOverCooldown > 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.fillText(
            `${Math.ceil(s.gameOverCooldown / 60)}...`,
            W / 2,
            H / 2 + 36
          );
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.fillText('Space / Click to Retry', W / 2, H / 2 + 36);
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('keydown', onKey);
      canvas.removeEventListener('touchstart', onTouch);
    };
  }, [open, jump]); // onClose NOT in deps — stored in ref

  if (!open) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Box
        sx={{
          position: 'relative',
          bgcolor: '#2d2d2d',
          borderRadius: 3,
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          maxWidth: '95vw',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2.5,
            py: 1.5,
            bgcolor: '#2d2d2d',
            color: '#fff',
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              fontFamily: '"Inter", sans-serif',
              letterSpacing: 1,
            }}
          >
            🐱 GAT RUNNER
          </Typography>
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              color: '#fff',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onClick={jump}
          style={{
            display: 'block',
            cursor: 'pointer',
            maxWidth: '100%',
            height: 'auto',
          }}
        />
        <Box
          sx={{
            textAlign: 'center',
            py: 0.75,
            bgcolor: '#2d2d2d',
            color: 'rgba(255,255,255,0.5)',
            fontSize: '0.7rem',
            fontFamily: 'monospace',
          }}
        >
          SPACE / ↑ / CLICK TO JUMP • ESC TO EXIT
        </Box>
      </Box>
    </Box>
  );
};

export default GatRunnerGame;
