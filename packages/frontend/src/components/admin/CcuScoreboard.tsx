import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import {
  Close as CloseIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  ShowChart as ShowChartIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import SlideshowBackground from './SlideshowBackground';
import playerConnectionService, {
  type CcuData,
  type LoginQueueData,
} from '../../services/playerConnectionService';

import PaymentStatsDetail from './PaymentStatsDetail';

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
      height="25%"
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
  flashIn?: boolean;
  onClose: () => void;
}

// ─── Main Scoreboard Component ───
const CcuScoreboard: React.FC<CcuScoreboardProps> = ({
  ccuData,
  prevCcuData,
  projectApiPath,
  flashIn = false,
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

  // Fetch total registered accounts and characters
  const [totalRegistered, setTotalRegistered] = useState<number | null>(null);
  const [totalCharacters, setTotalCharacters] = useState<number | null>(null);
  useEffect(() => {
    let mounted = true;
    const fetchTotals = async () => {
      try {
        const [playersRes, charsRes] = await Promise.all([
          playerConnectionService.getAllPlayers(projectApiPath, { limit: 1 }),
          playerConnectionService.getAllCharacters(projectApiPath, {
            limit: 1,
          }),
        ]);
        if (mounted) {
          setTotalRegistered(playersRes.total);
          setTotalCharacters(charsRes.total);
        }
      } catch (err) {
        console.error('Failed to fetch total counts:', err);
      }
    };
    fetchTotals();
    return () => {
      mounted = false;
    };
  }, [projectApiPath]);

  // Fetch login queue data
  const [loginQueueData, setLoginQueueData] = useState<LoginQueueData | null>(
    null
  );
  useEffect(() => {
    if (!projectApiPath) return;
    let mounted = true;
    const fetchQueue = async () => {
      try {
        const data =
          await playerConnectionService.getLoginQueue(projectApiPath);
        if (mounted) setLoginQueueData(data);
      } catch {
        // non-critical
      }
    };
    fetchQueue();
    const interval = setInterval(fetchQueue, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [projectApiPath]);

  // Secret 5-tap toggle on live dot to enable/disable payment stats
  const [psEnabled, setPsEnabled] = useState(
    () => localStorage.getItem('gx_ps') === '1'
  );
  const tapRef = useRef<number[]>([]);
  const handleDotTap = () => {
    const now = Date.now();
    tapRef.current = [...tapRef.current.filter((t) => now - t < 2000), now];
    if (tapRef.current.length >= 5) {
      tapRef.current = [];
      const next = !psEnabled;
      if (next) localStorage.setItem('gx_ps', '1');
      else localStorage.removeItem('gx_ps');
      setPsEnabled(next);
    }
  };

  // Fetch payment statistics (only visible when psEnabled)
  type PaymentStatsData = Awaited<
    ReturnType<typeof playerConnectionService.getPaymentStats>
  >;
  const [paymentStats, setPaymentStats] = useState<PaymentStatsData>(null);
  const [showDetail, setShowDetail] = useState(false);
  useEffect(() => {
    if (!psEnabled) {
      setPaymentStats(null);
      return;
    }
    let mounted = true;
    const fetchStats = async () => {
      try {
        const stats =
          await playerConnectionService.getPaymentStats(projectApiPath);
        if (mounted) setPaymentStats(stats);
      } catch {
        // Silently hide
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [projectApiPath, psEnabled]);

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

  // Sparkline visibility toggle (default: hidden)
  const [sparklineVisible, setSparklineVisible] = useState(
    () => localStorage.getItem('gx_scoreboard_sparkline') === '1'
  );
  const handleToggleSparkline = () => {
    setSparklineVisible((prev) => {
      const next = !prev;
      if (next) localStorage.setItem('gx_scoreboard_sparkline', '1');
      else localStorage.removeItem('gx_scoreboard_sparkline');
      return next;
    });
  };

  // Cursor activity tracker — controls show/hide 2s after last mouse move
  const [cursorActive, setCursorActive] = useState(true);
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    const onMove = () => {
      setCursorActive(true);
      clearTimeout(cursorTimerRef.current);
      cursorTimerRef.current = setTimeout(() => setCursorActive(false), 2000);
    };
    cursorTimerRef.current = setTimeout(() => setCursorActive(false), 2000);
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      clearTimeout(cursorTimerRef.current);
    };
  }, []);

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        background:
          'linear-gradient(180deg, #0a0e17 0%, #111827 40%, #0d1117 100%)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        cursor: cursorActive ? 'default' : 'none',
        ...(flashIn
          ? {} // Skip fade-in; the white flash overlay handles the transition
          : {
              animation: 'scoreboardFadeIn 0.6s ease-out both',
              '@keyframes scoreboardFadeIn': {
                '0%': { opacity: 0 },
                '100%': { opacity: 1 },
              },
            }),
      }}
    >
      {/* Configurable background (YouTube video or image) */}
      {(() => {
        const bgType =
          localStorage.getItem('gx_scoreboard_bg_type') || 'youtube';
        const bgUrl = localStorage.getItem('gx_scoreboard_bg_url') || '';

        if (bgType === 'slideshow') {
          let imgs: string[] = [];
          try {
            imgs = JSON.parse(localStorage.getItem('gx_scoreboard_bg_slideshow') || '[]');
          } catch { /* empty */ }
          const interval = Number(localStorage.getItem('gx_scoreboard_bg_interval')) || 20;
          if (imgs.length > 0) {
            return <SlideshowBackground images={imgs} interval={interval * 1000} />;
          }
        }

        if (bgType === 'image' && bgUrl) {
          // Static image background with object-fit: cover
          return (
            <Box
              component="img"
              src={bgUrl}
              alt=""
              onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
              sx={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center center',
                zIndex: 0,
              }}
            />
          );
        }

        // YouTube video background (default)
        // Extract video ID from URL or use raw ID
        let videoId = bgUrl || 'QI3lHS55OaU';
        const ytMatch = videoId.match(
          /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
        );
        if (ytMatch) videoId = ytMatch[1];
        // Strip any remaining query params from bare ID
        videoId = videoId.replace(/[?&].*$/, '').slice(0, 11);

        return (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 0,
              overflow: 'hidden',
              pointerEvents: 'none',
              opacity: 0,
              animation: 'ytFadeIn 0.8s ease-out 3.5s forwards',
              '@keyframes ytFadeIn': {
                '0%': { opacity: 0 },
                '100%': { opacity: 1 },
              },
            }}
          >
            <Box
              component="iframe"
              src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&fs=0&playsinline=1&cc_load_policy=0`}
              allow="autoplay; encrypted-media"
              frameBorder="0"
              tabIndex={-1}
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 'max(177.78vh, 100vw)',
                height: 'max(56.25vw, 100vh)',
                border: 'none',
                pointerEvents: 'none',
              }}
            />
          </Box>
        );
      })()}
      {/* Dark overlay for text readability */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.5) 100%)',
        }}
      />
      {/* Vignette */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse 75% 65% at center, transparent 30%, rgba(0,0,0,0.4) 100%)',
        }}
      />

      {/* Flash-in overlay (white → transparent) when transitioning from countdown */}
      {flashIn && (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            bgcolor: '#fff',
            zIndex: 2147483647,
            pointerEvents: 'none',
            animation: 'flashOut 1.5s ease-out forwards',
            '@keyframes flashOut': {
              '0%': { opacity: 1 },
              '100%': { opacity: 0 },
            },
          }}
        />
      )}
      {/* Sparkline trend graph — anchored to bottom of viewport */}
      {!showDetail && sparklineVisible && (
        <Sparkline data={historyRef.current} trend={totalTrend} />
      )}

      {/* Top bar + main content — hidden when payment detail is shown */}
      {!showDetail && (
        <>
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
                onClick={handleDotTap}
                sx={{
                  p: 1,
                  m: -1,
                  cursor: 'default',
                  '& > div': {
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
                  },
                }}
              >
                <div />
              </Box>
            </Box>

            <Typography
              sx={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                color: 'rgba(255,255,255,0.85)',
                fontFamily: '"Inter", sans-serif',
                fontSize: '1.1rem',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: 1.5,
                textShadow:
                  '0 2px 8px rgba(0,0,0,1), 0 0 20px rgba(0,0,0,0.7), 0 0 40px rgba(0,0,0,0.3)',
              }}
            >
              {now.toLocaleTimeString()} (UTC {now.toISOString().slice(11, 19)})
            </Typography>

            <Box
              sx={{
                display: 'flex',
                gap: 0.5,
                opacity: cursorActive ? 0.8 : 0,
                transition: 'opacity 0.4s ease',
              }}
            >
              <IconButton
                onClick={onClose}
                size="small"
                sx={{
                  color: '#fff',
                  bgcolor: 'rgba(255,255,255,0.25)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.35)' },
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
                  fontSize: 'clamp(6.6rem, min(19.2vw, 33.6vh), 16.8rem)',
                  lineHeight: 1,
                  color: '#fff',
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
                  textShadow:
                    '0 4px 16px rgba(0,0,0,1), 0 0 60px rgba(0,0,0,0.5), 0 0 120px rgba(0,0,0,0.3)',
                }}
              >
                {animatedTotal === 0 ? '0' : animatedTotal.toLocaleString()}
              </Typography>

              {/* CCU label */}
              <Typography
                sx={{
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  letterSpacing: 3,
                  textTransform: 'uppercase',
                  mt: 0.5,
                  textShadow:
                    '0 2px 8px rgba(0,0,0,1), 0 0 20px rgba(0,0,0,0.5)',
                }}
              >
                {t('playerConnections.scoreboard.concurrentUsers')}
              </Typography>

              {/* Total registered accounts & characters — subtle secondary metrics */}
              {(totalRegistered !== null || totalCharacters !== null) && (
                <Box
                  sx={{
                    mt: 3.5,
                    display: 'flex',
                    gap: 6,
                    justifyContent: 'center',
                  }}
                >
                  {totalRegistered !== null && (
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography
                        sx={{
                          color: 'rgba(255,255,255,0.7)',
                          fontFamily: '"Inter", "Roboto Mono", monospace',
                          fontVariantNumeric: 'tabular-nums',
                          fontSize: 'clamp(1.4rem, min(3.5vw, 6vh), 2.4rem)',
                          fontWeight: 700,
                          lineHeight: 1,
                          textShadow:
                            '0 2px 10px rgba(0,0,0,1), 0 0 30px rgba(0,0,0,0.4)',
                        }}
                      >
                        {totalRegistered.toLocaleString()}
                      </Typography>
                      <Typography
                        sx={{
                          color: 'rgba(255,255,255,0.4)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          letterSpacing: 2.5,
                          textTransform: 'uppercase',
                          mt: 0.5,
                          textShadow:
                            '0 2px 8px rgba(0,0,0,1), 0 0 20px rgba(0,0,0,0.5)',
                        }}
                      >
                        {t('playerConnections.scoreboard.totalAccounts')}
                      </Typography>
                    </Box>
                  )}
                  {totalCharacters !== null && (
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography
                        sx={{
                          color: 'rgba(255,255,255,0.7)',
                          fontFamily: '"Inter", "Roboto Mono", monospace',
                          fontVariantNumeric: 'tabular-nums',
                          fontSize: 'clamp(1.4rem, min(3.5vw, 6vh), 2.4rem)',
                          fontWeight: 700,
                          lineHeight: 1,
                          textShadow: '0 1px 8px rgba(0,0,0,0.7)',
                        }}
                      >
                        {totalCharacters.toLocaleString()}
                      </Typography>
                      <Typography
                        sx={{
                          color: 'rgba(255,255,255,0.4)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          letterSpacing: 2.5,
                          textTransform: 'uppercase',
                          mt: 0.5,
                          textShadow: '0 1px 6px rgba(0,0,0,0.7)',
                        }}
                      >
                        {t('playerConnections.scoreboard.totalCharacters')}
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}

              {totalCount === 0 && (
                <Typography
                  sx={{
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: '1.2rem',
                    fontWeight: 500,
                    mt: 3,
                    letterSpacing: 1,
                    textShadow:
                      '0 2px 8px rgba(0,0,0,1), 0 0 20px rgba(0,0,0,0.5)',
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

              {/* Login queue counter */}
              {loginQueueData && loginQueueData.total > 0 && (
                <Typography
                  sx={{
                    color: 'rgba(255,200,50,0.8)',
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    mt: 2,
                    letterSpacing: 1,
                    textShadow: '0 1px 6px rgba(0,0,0,0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  ⏳ {t('playerConnections.queue.total')}:{' '}
                  {loginQueueData.total.toLocaleString()}
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
                <TrendingDownIcon
                  sx={{ color: TREND_COLORS.down, fontSize: 28 }}
                />
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
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  textShadow: '0 1px 6px rgba(0,0,0,0.7)',
                }}
              >
                🤖 Bots: {ccuData!.botTotal.toLocaleString()}
              </Typography>
            )}

            {/* Payment stats — anchored to bottom without affecting center layout */}
            {paymentStats && (
              <Box
                onClick={() => {
                  setShowDetail(true);
                }}
                sx={{
                  position: 'absolute',
                  bottom: 32,
                  left: 0,
                  right: 0,
                  display: 'flex',
                  gap: 8,
                  justifyContent: 'center',
                  alignItems: 'center',
                  cursor: 'pointer',
                  py: 1.5,
                  transition: 'opacity 0.2s ease',
                  '&:hover': { opacity: 0.8 },
                }}
              >
                <Box sx={{ textAlign: 'center' }}>
                  <Typography
                    sx={{
                      color: 'rgba(255,255,255,0.65)',
                      fontFamily: '"Inter", "Roboto Mono", monospace',
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: 'clamp(1.2rem, min(2.5vw, 4vh), 1.8rem)',
                      fontWeight: 700,
                      lineHeight: 1,
                      textShadow:
                        '0 2px 10px rgba(0,0,0,1), 0 0 30px rgba(0,0,0,0.4)',
                    }}
                  >
                    ¥{paymentStats.totalAmount.toLocaleString()} (₩
                    {Math.round(
                      paymentStats.totalAmount * 216.48
                    ).toLocaleString()}
                    )
                  </Typography>
                  <Typography
                    sx={{
                      color: 'rgba(255,255,255,0.35)',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      letterSpacing: 2,
                      textTransform: 'uppercase',
                      mt: 0.5,
                      textShadow:
                        '0 2px 8px rgba(0,0,0,1), 0 0 20px rgba(0,0,0,0.5)',
                    }}
                  >
                    {t('playerConnections.scoreboard.totalRevenue')}
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        </>
      )}
      {/* Sparkline toggle button — bottom right */}
      {!showDetail && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 24,
            right: 32,
            zIndex: 10,
            opacity: cursorActive ? 0.8 : 0,
            transition: 'opacity 0.4s ease',
          }}
        >
          <IconButton
            onClick={handleToggleSparkline}
            size="small"
            sx={{
              color: sparklineVisible ? '#fff' : 'rgba(255,255,255,0.6)',
              bgcolor: 'rgba(255,255,255,0.25)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.35)' },
            }}
          >
            <ShowChartIcon fontSize="small" />
          </IconButton>
        </Box>
      )}
      {/* Payment Stats Detail View overlay */}
      {showDetail && paymentStats && (
        <PaymentStatsDetail
          stats={paymentStats}
          onBack={() => setShowDetail(false)}
        />
      )}
    </Box>
  );
};

export default CcuScoreboard;
