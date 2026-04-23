import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import {
  Close as CloseIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
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

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
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
        overflow: 'auto',
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
            color: 'rgba(255,255,255,0.35)',
            fontFamily: '"Roboto Mono", monospace',
            fontSize: '0.8rem',
            fontVariantNumeric: 'tabular-nums',
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

        {/* Label */}
        <Typography
          sx={{
            color: 'rgba(255,255,255,0.4)',
            fontWeight: 600,
            fontSize: '1rem',
            letterSpacing: 3,
            textTransform: 'uppercase',
            position: 'relative',
          }}
        >
          TOTAL CONCURRENT USERS
        </Typography>

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
              fontSize: 'clamp(4rem, 12vw, 10rem)',
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

        {/* Delta & Trend */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            minHeight: 32,
          }}
        >
          {totalDelta !== 0 ? (
            <>
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
            </>
          ) : (
            <>
              <TrendingFlatIcon
                sx={{ color: TREND_COLORS.flat, fontSize: 24 }}
              />
              <Typography
                sx={{
                  color: 'rgba(255,255,255,0.3)',
                  fontWeight: 500,
                  fontSize: '0.9rem',
                }}
              >
                No change
              </Typography>
            </>
          )}
        </Box>

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
