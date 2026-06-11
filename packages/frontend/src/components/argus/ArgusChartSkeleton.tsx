import React from 'react';
import { Box, useTheme } from '@mui/material';

interface ArgusChartSkeletonProps {
  type?: 'bar' | 'line';
  height?: number;
  color?: string;
}

export const ArgusChartSkeleton: React.FC<ArgusChartSkeletonProps> = ({
  height = 140,
}) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: height,
        width: '100%',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
        // Smooth bouncing dots animation
        '@keyframes bounceDots': {
          '0%, 100%': { transform: 'translateY(0)', opacity: 0.3 },
          '50%': { transform: 'translateY(-6px)', opacity: 1 },
        },
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: theme.palette.divider,
              animation: 'bounceDots 1.4s infinite ease-in-out',
              animationDelay: `${i * 0.16}s`,
            }}
          />
        ))}
      </Box>
    </Box>
  );
};

export default ArgusChartSkeleton;
