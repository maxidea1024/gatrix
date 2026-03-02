import React from 'react';
import { Box, Fade, CircularProgress } from '@mui/material';
import { DeferredComponent } from './DeferredComponent';

interface PageContentLoaderProps {
  loading: boolean;
  children: React.ReactNode;
  /** Fade-in duration in ms (default: 300) */
  fadeDuration?: number;
  /** Delay before showing fallback spinner in ms (default: 500) */
  spinnerDelay?: number;
}

/**
 * Wraps page content with a smooth loading transition.
 *
 * - While loading: renders nothing (or a delayed spinner for long loads)
 * - Once loaded: content fades in smoothly
 *
 * This eliminates the "flash" where table headers or empty states
 * briefly appear before the real content is ready.
 */
const PageContentLoader: React.FC<PageContentLoaderProps> = ({
  loading,
  children,
  fadeDuration = 300,
  spinnerDelay = 500,
}) => {
  if (loading) {
    return (
      <DeferredComponent shouldRender={loading} delay={spinnerDelay}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={28} />
        </Box>
      </DeferredComponent>
    );
  }

  return (
    <Fade in appear timeout={fadeDuration}>
      <Box>{children}</Box>
    </Fade>
  );
};

export default PageContentLoader;
