import React from 'react';
import { Box, useTheme, alpha } from '@mui/material';

interface ArgusChartSkeletonProps {
  type?: 'bar' | 'line';
  height?: number;
  color?: string;
}

export const ArgusChartSkeleton: React.FC<ArgusChartSkeletonProps> = ({
  type = 'bar',
  height = 140,
  color = '#7c4dff'
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      height: height,
      width: '100%',
      px: 1,
      py: 1,
      boxSizing: 'border-box',
      position: 'relative',
      overflow: 'hidden',
      // Pulse animation
      '@keyframes pulseBar': {
        '0%, 100%': { opacity: 0.3, transform: 'scaleY(1)' },
        '50%': { opacity: 0.6, transform: 'scaleY(1.04)' },
      },
      '@keyframes pulseLine': {
        '0%, 100%': { opacity: 0.3 },
        '50%': { opacity: 0.6 },
      },
    }}>
      {type === 'bar' ? (
        // Render pulsating vertical bars
        [40, 70, 45, 90, 60, 80, 50, 75, 40, 65, 85, 55, 70, 45, 80].map((h, i) => (
          <Box
            key={i}
            sx={{
              width: '5%',
              height: `${h}%`,
              backgroundColor: alpha(color, isDark ? 0.12 : 0.08),
              borderRadius: '4px 4px 0 0',
              transformOrigin: 'bottom',
              animation: `pulseBar 1.6s infinite ease-in-out`,
              animationDelay: `${i * 0.08}s`,
            }}
          />
        ))
      ) : (
        // Render a simulated line chart path
        <Box sx={{
          width: '100%',
          height: '100%',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          animation: `pulseLine 1.6s infinite ease-in-out`,
        }}>
          {/* Simulated grid lines */}
          {[1, 2, 3].map((g) => (
            <Box key={g} sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: `${g * 25}%`,
              height: '1px',
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
            }} />
          ))}
          {/* Pulsating line visual SVG */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{
            width: '100%',
            height: '80%',
            overflow: 'visible',
          }}>
            {/* Gradient fill */}
            <defs>
              <linearGradient id={`skeleton-grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={isDark ? 0.15 : 0.1} />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M 0 60 Q 15 20 30 70 T 60 30 T 90 80 T 100 50 L 100 100 L 0 100 Z"
              fill={`url(#skeleton-grad-${color.replace('#', '')})`}
            />
            <path
              d="M 0 60 Q 15 20 30 70 T 60 30 T 90 80 T 100 50"
              fill="none"
              stroke={alpha(color, 0.4)}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </Box>
      )}
    </Box>
  );
};

export default ArgusChartSkeleton;
