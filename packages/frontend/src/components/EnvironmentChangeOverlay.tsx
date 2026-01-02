/**
 * EnvironmentChangeOverlay
 *
 * Displays a full-screen overlay when environment changes,
 * with fighting game style "Let's Fight!" animation.
 */
import React, { useState, useEffect } from 'react';
import { Box, Typography, keyframes } from '@mui/material';
import { useEnvironment } from '@/contexts/EnvironmentContext';
import { useTranslation } from 'react-i18next';

// Environment type colors
const getEnvironmentColor = (type: string, customColor?: string): string => {
  if (customColor) return customColor;
  switch (type) {
    case 'production':
      return '#d32f2f'; // Red
    case 'staging':
      return '#ed6c02'; // Orange
    case 'development':
      return '#2e7d32'; // Green
    default:
      return '#1976d2'; // Blue
  }
};

// Fighting game style animations
const slamIn = keyframes`
  0% {
    transform: scale(3) translateY(-20px);
    opacity: 0;
  }
  50% {
    transform: scale(1.1) translateY(0);
    opacity: 1;
  }
  70% {
    transform: scale(0.95) translateY(0);
  }
  100% {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
`;

const shakeEffect = keyframes`
  0%, 100% { transform: translateX(0); }
  10% { transform: translateX(-8px) rotate(-1deg); }
  20% { transform: translateX(8px) rotate(1deg); }
  30% { transform: translateX(-6px) rotate(-0.5deg); }
  40% { transform: translateX(6px) rotate(0.5deg); }
  50% { transform: translateX(-4px); }
  60% { transform: translateX(4px); }
  70% { transform: translateX(-2px); }
  80% { transform: translateX(2px); }
  90% { transform: translateX(0); }
`;

const glowPulse = keyframes`
  0%, 100% {
    filter: drop-shadow(0 0 20px currentColor) drop-shadow(0 0 40px currentColor);
  }
  50% {
    filter: drop-shadow(0 0 40px currentColor) drop-shadow(0 0 80px currentColor);
  }
`;

const slideOut = keyframes`
  0% {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
  100% {
    transform: scale(0.8) translateY(-50px);
    opacity: 0;
  }
`;

const bgFadeIn = keyframes`
  0% { opacity: 0; backdrop-filter: blur(0px); }
  100% { opacity: 1; backdrop-filter: blur(8px); }
`;

const bgFadeOut = keyframes`
  0% { opacity: 1; backdrop-filter: blur(8px); }
  100% { opacity: 0; backdrop-filter: blur(0px); }
`;

const DISPLAY_DURATION = 1200; // How long to show before exit animation

export const EnvironmentChangeOverlay: React.FC = () => {
  const { t } = useTranslation();
  const { environments } = useEnvironment();
  const [phase, setPhase] = useState<'hidden' | 'enter' | 'exit'>('hidden');
  const [displayedEnv, setDisplayedEnv] = useState<typeof environments[0] | null>(null);

  useEffect(() => {
    // Listen for manual environment switch only (not page load)
    const handleEnvironmentChange = (event: CustomEvent<{ environmentId: string; environment: typeof environments[0] }>) => {
      const { environment } = event.detail;
      setDisplayedEnv(environment);
      setPhase('enter');

      const exitTimer = setTimeout(() => {
        setPhase('exit');
      }, DISPLAY_DURATION);

      const hideTimer = setTimeout(() => {
        setPhase('hidden');
      }, DISPLAY_DURATION + 400);

      return () => {
        clearTimeout(exitTimer);
        clearTimeout(hideTimer);
      };
    };

    window.addEventListener('environment-changed', handleEnvironmentChange as EventListener);
    return () => {
      window.removeEventListener('environment-changed', handleEnvironmentChange as EventListener);
    };
  }, []);

  if (phase === 'hidden' || !displayedEnv) return null;

  const envColor = getEnvironmentColor(displayedEnv.environmentType, displayedEnv.color);
  const envName = displayedEnv.displayName || displayedEnv.environmentName;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        pointerEvents: 'none',
        animation: phase === 'enter'
          ? `${bgFadeIn} 0.15s ease-out forwards`
          : `${bgFadeOut} 0.4s ease-out forwards`,
      }}
    >
      {/* Radial glow background */}
      <Box
        sx={{
          position: 'absolute',
          width: '150%',
          height: '150%',
          background: `radial-gradient(ellipse at center, ${envColor}33 0%, transparent 50%)`,
          animation: phase === 'enter' ? `${glowPulse} 0.6s ease-in-out` : undefined,
        }}
      />

      {/* Main content */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
          animation: phase === 'enter'
            ? `${slamIn} 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards, ${shakeEffect} 0.5s ease-out 0.3s`
            : `${slideOut} 0.4s ease-in forwards`,
        }}
      >
        {/* Environment name - Main text */}
        <Typography
          sx={{
            fontSize: { xs: '3rem', sm: '4rem', md: '5rem' },
            fontWeight: 900,
            color: '#fff',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            textShadow: `
              0 0 10px ${envColor},
              0 0 20px ${envColor},
              0 0 40px ${envColor},
              0 4px 0 rgba(0,0,0,0.3)
            `,
            WebkitTextStroke: `2px ${envColor}`,
            textAlign: 'center',
            lineHeight: 1.1,
          }}
        >
          {envName}
        </Typography>

        {/* Decorative line */}
        <Box
          sx={{
            width: { xs: 200, sm: 300, md: 400 },
            height: 4,
            background: `linear-gradient(90deg, transparent, ${envColor}, transparent)`,
            borderRadius: 2,
            boxShadow: `0 0 20px ${envColor}`,
          }}
        />

        {/* Subtitle */}
        <Typography
          sx={{
            fontSize: { xs: '1rem', sm: '1.25rem' },
            fontWeight: 600,
            color: envColor,
            textTransform: 'uppercase',
            letterSpacing: '0.3em',
            textShadow: `0 0 10px ${envColor}`,
            mt: 1,
          }}
        >
          {t('environments.switchedTo')}
        </Typography>
      </Box>
    </Box>
  );
};

export default EnvironmentChangeOverlay;

