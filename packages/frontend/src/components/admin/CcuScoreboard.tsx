import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import {
  Close as CloseIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import playerConnectionService, { type CcuData } from '../../services/playerConnectionService';

// ─── Animated Number Hook (stock ticker tween) ───
function useAnimatedNumber(target: number): number {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const from = prevRef.current;
    const to = target;
    prevRef.current = target;

    if (from === to) return;

    const diff = Math.abs(to - from);
    // Adaptive duration: small changes are gentle, big changes whiz
    const duration = Math.min(800, Math.max(400, diff * 2));
    const startTime = performance.now();
    const delta = to - from;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Exponential ease-out — fast start, smooth landing
      const eased = 1 - Math.pow(2, -10 * progress);
      setDisplay(Math.round(from + delta * eased));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(to);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);

  return display;
}

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
  flat: '#00e676',
} as const;

// ─── Sparkline ───
const MAX_HISTORY = 60;

const Sparkline: React.FC<{ data: number[]; trend: Trend }> = ({
  data,
  trend,
}) => {
  if (data.length < 2) return null;

  const W = 800;
  const H = 160;
  const PAD = 4;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - 2 * PAD);
    const y = H - PAD - ((v - min) / range) * (H - 2 * PAD);
    return [x, y];
  });

  const linePath = `M ${points.map((p) => p.join(',')).join(' L ')}`;
  const areaPath = `${linePath} L ${points[points.length - 1][0]},${H} L ${points[0][0]},${H} Z`;
  const color = TREND_COLORS[trend];

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} ${H}`}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        pointerEvents: 'none',
        opacity: 0.2,
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
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// ─── Props ───
interface CcuScoreboardProps {
  ccuData: CcuData | null;
  prevCcuData: CcuData | null;
  projectApiPath: string;
  onClose: () => void;
}

// ─── Main Scoreboard Component ───
const CcuScoreboard: React.FC<CcuScoreboardProps> = ({
  ccuData,
  prevCcuData,
  projectApiPath,
  onClose,
}) => {
  const { t } = useTranslation();
  const totalCount = ccuData?.total ?? 0;
  const prevTotalCount = prevCcuData?.total;
  const animatedTotal = useAnimatedNumber(totalCount);
  const totalTrend = getTrend(totalCount, prevTotalCount);
  const totalDelta =
    prevTotalCount !== undefined ? totalCount - prevTotalCount : 0;
  const tickerDirection =
    totalDelta > 0
      ? ('up' as const)
      : totalDelta < 0
        ? ('down' as const)
        : ('none' as const);

  // Track value changes to trigger rumble
  const [animKey, setAnimKey] = useState(0);
  useEffect(() => {
    if (prevTotalCount !== undefined && totalCount !== prevTotalCount) {
      setAnimKey((k) => k + 1);
    }
  }, [totalCount, prevTotalCount]);

  // Fetch total registered accounts
  const [totalRegistered, setTotalRegistered] = useState<number | null>(null);
  useEffect(() => {
    let mounted = true;
    const fetchTotal = async () => {
      try {
        const res = await playerConnectionService.getAllPlayers(projectApiPath, { limit: 1 });
        if (mounted) setTotalRegistered(res.total);
      } catch (err) {
        console.error('Failed to fetch total registered players:', err);
      }
    };
    fetchTotal();
    return () => {
      mounted = false;
    };
  }, [projectApiPath]);

  // Stable ref for onClose to avoid useEffect churn on parent re-renders
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Only close scoreboard if user actively exits fullscreen (not on page load)
  const wasFullscreenRef = useRef(!!document.fullscreenElement);
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement && wasFullscreenRef.current) {
        onCloseRef.current();
      }
      wasFullscreenRef.current = !!document.fullscreenElement;
    };
    document.addEventListener('fullscreenchange', onFsChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    };
  }, []);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Current time
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // CCU history for sparkline
  const historyRef = useRef<number[]>([]);
  useEffect(() => {
    historyRef.current = [...historyRef.current, totalCount].slice(
      -MAX_HISTORY
    );
  }, [totalCount]);

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
        animation: 'scoreboardFadeIn 0.6s ease-out both',
        '@keyframes scoreboardFadeIn': {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
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
      {/* Sparkline trend graph — anchored to bottom of viewport */}
      <Sparkline data={historyRef.current} trend={totalTrend} />

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
            {t('playerConnections.scoreboard.liveMonitor')}
          </Typography>
        </Box>

        <Typography
          sx={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'rgba(255,255,255,0.6)',
            fontFamily: '"Inter", sans-serif',
            fontSize: '1.1rem',
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: 1.5,
          }}
        >
          {now.toLocaleTimeString()} (UTC {now.toISOString().slice(11, 19)})
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
        {/* Total CCU number — hero display */}
        <Box sx={{ position: 'relative', textAlign: 'center' }}>
          <Typography
            key={animKey}
            sx={{
              fontWeight: 900,
              fontSize: 'clamp(5.5rem, min(16vw, 28vh), 14rem)',
              lineHeight: 1,
              color: TREND_COLORS[totalTrend],
              fontFamily: '"Inter", "Roboto Mono", monospace',
              fontVariantNumeric: 'tabular-nums',
              transition: 'color 0.3s ease',
              position: 'relative',
              animation:
                animKey > 0
                  ? 'rumble 0.3s cubic-bezier(0.36, 0.07, 0.19, 0.97) both'
                  : 'none',
              '@keyframes rumble': {
                '0%': { transform: 'translate(0, 0)' },
                '15%': { transform: 'translate(-2px, -2px)' },
                '30%': { transform: 'translate(2px, 2px)' },
                '45%': { transform: 'translate(-2px, 2px)' },
                '60%': { transform: 'translate(2px, -2px)' },
                '75%': { transform: 'translate(-1px, -1px)' },
                '100%': { transform: 'translate(0, 0)' },
              },
            }}
          >
            {animatedTotal === 0 ? '0' : animatedTotal.toLocaleString()}
          </Typography>

          {/* CCU label */}
          <Typography
            sx={{
              color: 'rgba(255,255,255,0.35)',
              fontSize: '0.9rem',
              fontWeight: 600,
              letterSpacing: 3,
              textTransform: 'uppercase',
              mt: 1.5,
            }}
          >
            {t('playerConnections.scoreboard.concurrentUsers')}
          </Typography>

          {/* Total registered accounts — subtle secondary metric */}
          {totalRegistered !== null && (
            <Box sx={{ mt: 3.5, textAlign: 'center' }}>
              <Typography
                sx={{
                  color: 'rgba(255,255,255,0.5)',
                  fontFamily: '"Inter", "Roboto Mono", monospace',
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: 'clamp(1.4rem, min(3.5vw, 6vh), 2.4rem)',
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                {totalRegistered.toLocaleString()}
              </Typography>
              <Typography
                sx={{
                  color: 'rgba(255,255,255,0.2)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  letterSpacing: 2.5,
                  textTransform: 'uppercase',
                  mt: 0.5,
                }}
              >
                {t('playerConnections.scoreboard.totalAccounts')}
              </Typography>
            </Box>
          )}

          {totalCount === 0 && (
            <Typography
              sx={{
                color: 'rgba(255,255,255,0.3)',
                fontSize: '1.2rem',
                fontWeight: 500,
                mt: 3,
                letterSpacing: 1,
                animation: 'fadeInOut 3s ease-in-out infinite',
                '@keyframes fadeInOut': {
                  '0%, 100%': { opacity: 0.3 },
                  '50%': { opacity: 0.6 },
                },
              }}
            >
              ⛵ {t('playerConnections.scoreboard.waitingForAdventurers')}
            </Typography>
          )}
        </Box>

        {/* Delta & Trend — always reserve space, fade in/out */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
            minHeight: 40,
            opacity: totalDelta !== 0 ? 1 : 0,
            transition: 'opacity 0.4s ease',
          }}
        >
          {totalDelta > 0 ? (
            <TrendingUpIcon sx={{ color: TREND_COLORS.up, fontSize: 28 }} />
          ) : totalDelta < 0 ? (
            <TrendingDownIcon sx={{ color: TREND_COLORS.down, fontSize: 28 }} />
          ) : null}
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
