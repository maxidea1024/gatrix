import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import {
  Close as CloseIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
} from '@mui/icons-material';
import type { CcuData } from '../../services/playerConnectionService';

// ─── Animated Counter Hook ───
function useAnimatedNumber(target: number, duration = 800): number {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const from = prevRef.current;
    const to = target;
    prevRef.current = target;

    if (from === to) return;

    const startTime = performance.now();
    const diff = to - from;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + diff * eased));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return display;
}

// ─── Trend indicator ───
type Trend = 'up' | 'down' | 'flat';

function getTrend(current: number, previous: number | undefined): Trend {
  if (previous === undefined) return 'flat';
  if (current > previous) return 'up';
  if (current < previous) return 'down';
  return 'flat';
}

const TREND_COLORS = {
  up: '#00e676',
  down: '#ff5252',
  flat: 'rgba(255,255,255,0.5)',
} as const;

// ─── Sparkline ───
const MAX_HISTORY = 60;

const Sparkline: React.FC<{ data: number[]; trend: Trend }> = ({ data, trend }) => {
  if (data.length < 2) return null;

  const W = 800;
  const H = 160;
  const PAD = 4;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((v - min) / range) * (H - PAD * 2);
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${H} L${points[0].x},${H} Z`;

  const color = trend === 'up' ? TREND_COLORS.up : trend === 'down' ? TREND_COLORS.down : '#64b4ff';

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{
        position: 'absolute',
        bottom: '-30%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '90vw',
        maxWidth: 1200,
        height: 'auto',
        pointerEvents: 'none',
        opacity: 0.15,
      }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.5" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkFill)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// ─── Props ───
interface CcuScoreboardProps {
  ccuData: CcuData | null;
  prevCcuData: CcuData | null;
  onClose: () => void;
}


// ─── Main Scoreboard Component ───
const CcuScoreboard: React.FC<CcuScoreboardProps> = ({
  ccuData,
  prevCcuData,
  onClose,
}) => {
  const totalCount = ccuData?.total ?? 0;
  const prevTotalCount = prevCcuData?.total;
  const animatedTotal = useAnimatedNumber(totalCount, 1200);
  const totalTrend = getTrend(totalCount, prevTotalCount);
  const totalDelta =
    prevTotalCount !== undefined ? totalCount - prevTotalCount : 0;

  // Pulse animation on total change
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (prevTotalCount !== undefined && totalCount !== prevTotalCount) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 1000);
      return () => clearTimeout(t);
    }
  }, [totalCount, prevTotalCount]);

  // Browser fullscreen on mount, exit on unmount
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});

    // If user exits fullscreen via browser (ESC hits browser first), close scoreboard
    const onFsChange = () => {
      if (!document.fullscreenElement) onClose();
    };
    document.addEventListener('fullscreenchange', onFsChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    };
  }, [onClose]);

  // ESC to close (also exits fullscreen via unmount cleanup above)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Current time
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // CCU history for sparkline
  const historyRef = useRef<number[]>([]);
  useEffect(() => {
    if (ccuData?.total !== undefined) {
      historyRef.current = [...historyRef.current, ccuData.total].slice(-MAX_HISTORY);
    }
  }, [ccuData?.total]);



  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        background:
          'radial-gradient(ellipse at 20% 50%, #0d1b2a 0%, #0a0f1a 50%, #060a12 100%)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        cursor: 'default',
        // Animated background grid
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          pointerEvents: 'none',
        },
      }}
    >
      {/* Top bar */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 4,
          py: 2,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: '#00e676',
              boxShadow: '0 0 12px #00e676, 0 0 4px #00e676',
              animation: 'livePulse 2s infinite',
              '@keyframes livePulse': {
                '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                '50%': { opacity: 0.5, transform: 'scale(0.8)' },
              },
            }}
          />
          <Typography
            sx={{
              color: 'rgba(255,255,255,0.7)',
              fontWeight: 600,
              fontSize: '0.85rem',
              letterSpacing: 1.5,
              textTransform: 'uppercase',
            }}
          >
            LIVE CCU MONITOR
          </Typography>
        </Box>

        <Typography
          sx={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'rgba(255,255,255,0.6)',
            fontFamily: '"Roboto Mono", monospace',
            fontSize: '1.1rem',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: 1,
          }}
        >
          {now.toLocaleTimeString()}
        </Typography>

        <Box
          sx={{
            display: 'flex',
            gap: 0.5,
            opacity: 0.08,
            transition: 'opacity 0.3s ease',
            '&:hover': { opacity: 0.6 },
          }}
        >
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              color: 'rgba(255,255,255,0.8)',
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Main content */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 2,
          px: 4,
          pb: 4,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Ambient glow behind total */}
        <Box
          sx={{
            position: 'absolute',
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${
              totalTrend === 'up'
                ? 'rgba(0,230,118,0.08)'
                : totalTrend === 'down'
                  ? 'rgba(255,82,82,0.08)'
                  : 'rgba(100,180,255,0.06)'
            } 0%, transparent 70%)`,
            filter: 'blur(40px)',
            transition: 'background 1s ease',
            pointerEvents: 'none',
          }}
        />

        {/* Sparkline trend graph */}
        <Sparkline data={historyRef.current} trend={totalTrend} />

        {/* Total CCU number */}
        <Box sx={{ position: 'relative', textAlign: 'center' }}>
          {pulse && (
            <Box
              sx={{
                position: 'absolute',
                inset: '-40px -80px',
                borderRadius: 4,
                border: `2px solid ${TREND_COLORS[totalTrend]}`,
                opacity: 0,
                animation: 'ripple 1s ease-out',
                '@keyframes ripple': {
                  '0%': {
                    opacity: 0.6,
                    transform: 'scale(0.95)',
                  },
                  '100%': {
                    opacity: 0,
                    transform: 'scale(1.05)',
                  },
                },
                pointerEvents: 'none',
              }}
            />
          )}
          <Typography
            sx={{
              fontWeight: 900,
              fontSize: 'clamp(6rem, 18vw, 15rem)',
              lineHeight: 1,
              color: TREND_COLORS[totalTrend],
              fontFamily: '"Inter", "Roboto Mono", monospace',
              fontVariantNumeric: 'tabular-nums',
              textShadow: `0 0 60px ${TREND_COLORS[totalTrend]}40, 0 0 120px ${TREND_COLORS[totalTrend]}20`,
              transition: 'color 0.5s ease, text-shadow 0.5s ease',
              position: 'relative',
            }}
          >
            {animatedTotal.toLocaleString()}
          </Typography>
        </Box>

        {/* Delta & Trend — only show when there IS a change */}
        {totalDelta !== 0 && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              minHeight: 32,
            }}
          >
            {totalTrend === 'up' ? (
              <TrendingUpIcon
                sx={{ color: TREND_COLORS.up, fontSize: 28 }}
              />
            ) : (
              <TrendingDownIcon
                sx={{ color: TREND_COLORS.down, fontSize: 28 }}
              />
            )}
            <Typography
              sx={{
                color: TREND_COLORS[totalTrend],
                fontWeight: 700,
                fontSize: '1.5rem',
                fontFamily: '"Inter", monospace',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {totalDelta > 0 ? '+' : ''}
              {totalDelta.toLocaleString()}
            </Typography>
          </Box>
        )}

        {/* Bot count */}
        {(ccuData?.botTotal ?? 0) > 0 && (
          <Typography
            sx={{
              color: 'rgba(255,255,255,0.25)',
              fontSize: '0.8rem',
              fontWeight: 500,
            }}
          >
            🤖 Bots: {ccuData!.botTotal.toLocaleString()}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default CcuScoreboard;
