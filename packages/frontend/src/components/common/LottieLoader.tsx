import React, { useState, useEffect } from 'react';
import Lottie from 'lottie-react';
import { Box } from '@mui/material';

export interface LottieLoaderProps {
  size?: number;
  message?: string;
}

export const LottieLoader: React.FC<LottieLoaderProps> = ({
  size = 120,
  message,
}) => {
  const [animData, setAnimData] = useState<object | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch('/animations/loading-dots.json')
      .then((r) => r.json())
      .then((data) => {
        if (isMounted) setAnimData(data);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  if (!animData) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Lottie
        animationData={animData}
        loop
        autoplay
        style={{ width: size, height: size }}
      />
      {message && (
        <Box sx={{ mt: 1, color: 'text.secondary', fontSize: '0.875rem' }}>
          {message}
        </Box>
      )}
    </Box>
  );
};

export default LottieLoader;
