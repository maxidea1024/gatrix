import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import {
  Close as CloseIcon,
  SkipNext as SkipNextIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import OceanBackground from './OceanBackground';


// ─── Types ───
interface CountdownScoreboardProps {
  ddayTarget: Date;
  onCountdownComplete: () => void;
  onSkipToCcu: () => void;
  onClose: () => void;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number; // total ms remaining
}

// ─── Helpers ───
function computeTimeLeft(target: Date): TimeLeft {
  const now = Date.now();
  const total = target.getTime() - now;
  if (total <= 0)
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };

  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / 1000 / 60 / 60) % 24);
  const days = Math.floor(total / 1000 / 60 / 60 / 24);

  return { days, hours, minutes, seconds, total };
}

// ─── Digit Cell ───
const DigitCell: React.FC<{ value: string; prevValue: string }> = ({
  value,
  prevValue,
}) => {
  const changed = value !== prevValue;
  return (
    <Box
      key={value + (changed ? '-flip' : '')}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 'clamp(48px, 8vw, 120px)',
        height: 'clamp(64px, 11vw, 160px)',
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(8px)',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow:
          '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
        mx: '3px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Typography
        sx={{
          fontFamily: '"Inter", "Roboto Mono", monospace',
          fontWeight: 900,
          fontSize: 'clamp(2rem, 5.5vw, 6.5rem)',
          lineHeight: 1,
          color: '#fff',
          textShadow:
            '0 2px 12px rgba(0,0,0,0.5), 0 0 40px rgba(255,255,255,0.1)',
          fontVariantNumeric: 'tabular-nums',
          animation: changed ? 'digitFlip 0.4s ease-out' : 'none',
          '@keyframes digitFlip': {
            '0%': { transform: 'scaleY(0.6)', opacity: 0.4 },
            '40%': { transform: 'scaleY(1.05)', opacity: 1 },
            '100%': { transform: 'scaleY(1)', opacity: 1 },
          },
        }}
      >
        {value}
      </Typography>
    </Box>
  );
};

// ─── Separator ───
const Separator: React.FC = () => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 'clamp(6px, 1.5vw, 16px)',
      mx: 'clamp(4px, 1vw, 16px)',
      height: 'clamp(64px, 11vw, 160px)',
      animation: 'separatorPulse 1s ease-in-out infinite',
      '@keyframes separatorPulse': {
        '0%, 100%': { opacity: 1 },
        '50%': { opacity: 0.3 },
      },
    }}
  >
    <Box
      sx={{
        width: 'clamp(6px, 1vw, 12px)',
        height: 'clamp(6px, 1vw, 12px)',
        borderRadius: '50%',
        bgcolor: 'rgba(255,255,255,0.9)',
        boxShadow: '0 0 10px rgba(255,255,255,0.6)',
      }}
    />
    <Box
      sx={{
        width: 'clamp(6px, 1vw, 12px)',
        height: 'clamp(6px, 1vw, 12px)',
        borderRadius: '50%',
        bgcolor: 'rgba(255,255,255,0.9)',
        boxShadow: '0 0 10px rgba(255,255,255,0.6)',
      }}
    />
  </Box>
);

// ─── Countdown Unit Block ───
const CountdownUnit: React.FC<{
  value: number;
  prevValue: number;
  label: string;
  pad?: number;
}> = ({ value, prevValue, label, pad = 2 }) => {
  const str = value.toString().padStart(pad, '0');
  const prevStr = prevValue.toString().padStart(pad, '0');

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        {str.split('').map((digit, i) => (
          <DigitCell key={i} value={digit} prevValue={prevStr[i] ?? digit} />
        ))}
      </Box>
      <Typography
        sx={{
          color: 'rgba(255,255,255,0.85)',
          fontSize: 'clamp(0.6rem, 1.2vw, 1rem)',
          fontWeight: 700,
          letterSpacing: 4,
          textTransform: 'uppercase',
          mt: 1.5,
          textShadow: '0 1px 6px rgba(0,0,0,0.8), 0 0 12px rgba(0,0,0,0.4)',
        }}
      >
        {label}
      </Typography>
    </Box>
  );
};

// ─── Main Component ───
const CountdownScoreboard: React.FC<CountdownScoreboardProps> = ({
  ddayTarget,
  onCountdownComplete,
  onSkipToCcu,
  onClose,
}) => {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() =>
    computeTimeLeft(ddayTarget)
  );
  const prevTimeRef = useRef<TimeLeft>(timeLeft);
  const completeCalledRef = useRef(false);

  // Stable ref for callbacks
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onCompleteRef = useRef(onCountdownComplete);
  onCompleteRef.current = onCountdownComplete;
  const onSkipRef = useRef(onSkipToCcu);
  onSkipRef.current = onSkipToCcu;
  const skipCalledRef = useRef(false);

  // Update countdown every second
  useEffect(() => {
    const interval = setInterval(() => {
      const newTimeLeft = computeTimeLeft(ddayTarget);
      setTimeLeft((prev) => {
        prevTimeRef.current = prev;
        return newTimeLeft;
      });

      if (newTimeLeft.total <= 0 && !completeCalledRef.current) {
        completeCalledRef.current = true;
        clearInterval(interval);
        // Short delay so the 00:00:00:00 renders before transition
        setTimeout(() => {
          onCompleteRef.current();
        }, 1500);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [ddayTarget]);

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

  // Fullscreen exit handler
  const wasFullscreenRef = useRef(!!document.fullscreenElement);
  useEffect(() => {
    const onFsChange = () => {
      if (
        !document.fullscreenElement &&
        wasFullscreenRef.current &&
        !skipCalledRef.current
      ) {
        onCloseRef.current();
      }
      wasFullscreenRef.current = !!document.fullscreenElement;
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      if (document.fullscreenElement && !skipCalledRef.current) {
        document.exitFullscreen?.().catch(() => {});
      }
    };
  }, []);

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

  const prev = prevTimeRef.current;


  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        cursor: cursorActive ? 'default' : 'none',
        background: '#060a14',
        animation: 'countdownFadeIn 0.8s ease-out both',
        '@keyframes countdownFadeIn': {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
      }}
    >
      {/* Night ocean background (always fixed) */}
      <OceanBackground />

      {/* Top bar */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 4,
          py: 2,
          position: 'relative',
          zIndex: 10,
        }}
      >
        <Box />

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

      {/* Main countdown content */}
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
          zIndex: 10,
        }}
      >
        {/* Countdown digits */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            flexWrap: 'nowrap',
          }}
        >
          <CountdownUnit
            value={timeLeft.days}
            prevValue={prev.days}
            label={t('playerConnections.countdown.days')}
            pad={timeLeft.days >= 100 ? 3 : 2}
          />
          <Separator />
          <CountdownUnit
            value={timeLeft.hours}
            prevValue={prev.hours}
            label={t('playerConnections.countdown.hours')}
          />
          <Separator />
          <CountdownUnit
            value={timeLeft.minutes}
            prevValue={prev.minutes}
            label={t('playerConnections.countdown.minutes')}
          />
          <Separator />
          <CountdownUnit
            value={timeLeft.seconds}
            prevValue={prev.seconds}
            label={t('playerConnections.countdown.seconds')}
          />
        </Box>

        {/* Target date display */}
        <Typography
          sx={{
            color: 'rgba(255,255,255,0.8)',
            fontSize: 'clamp(0.7rem, 1vw, 0.9rem)',
            fontWeight: 600,
            mt: 4,
            letterSpacing: 1,
            textShadow: '0 1px 6px rgba(0,0,0,0.8), 0 0 12px rgba(0,0,0,0.4)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          🚀 {ddayTarget.toLocaleString()} (UTC{' '}
          {ddayTarget.toISOString().slice(0, 16).replace('T', ' ')})
        </Typography>

        {/* "Completed" flash when reaching zero */}
        {timeLeft.total <= 0 && (
          <Typography
            sx={{
              color: '#fff',
              fontSize: 'clamp(1.2rem, 2.5vw, 2rem)',
              fontWeight: 800,
              mt: 3,
              letterSpacing: 4,
              textShadow:
                '0 0 20px rgba(255,255,255,0.8), 0 0 40px rgba(255,200,100,0.5)',
              animation: 'completePulse 0.8s ease-in-out infinite',
              '@keyframes completePulse': {
                '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                '50%': { opacity: 0.7, transform: 'scale(1.05)' },
              },
            }}
          >
            🚀 LAUNCH!
          </Typography>
        )}
      </Box>

      {/* Skip to CCU button — bottom right */}
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
          onClick={() => {
            skipCalledRef.current = true;
            onSkipRef.current();
          }}
          size="small"
          sx={{
            color: '#fff',
            bgcolor: 'rgba(255,255,255,0.25)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.35)' },
          }}
        >
          <SkipNextIcon fontSize="medium" />
        </IconButton>
      </Box>
    </Box>
  );
};

export default CountdownScoreboard;
