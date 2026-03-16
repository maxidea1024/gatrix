/**
 * ContentLoader
 *
 * Reusable loading wrapper for dialogs, panels, and other non-page containers.
 * Shows a deferred spinner during load, then fades in content smoothly.
 *
 * Usage:
 *   <ContentLoader loading={isLoading}>
 *     <YourContent />
 *   </ContentLoader>
 */
import React from 'react';
import { Box, CircularProgress, Fade } from '@mui/material';
import { DeferredComponent } from './DeferredComponent';

interface ContentLoaderProps {
  loading: boolean;
  children: React.ReactNode;
  /** Delay before showing spinner in ms (default: 300) */
  spinnerDelay?: number;
  /** Fade-in duration in ms (default: 350) */
  fadeDuration?: number;
  /** Spinner size (default: 28) */
  spinnerSize?: number;
}

const ContentLoader: React.FC<ContentLoaderProps> = ({
  loading,
  children,
  spinnerDelay = 300,
  fadeDuration = 350,
  spinnerSize = 28,
}) => {
  if (loading) {
    return (
      <DeferredComponent shouldRender={loading} delay={spinnerDelay}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={spinnerSize} />
        </Box>
      </DeferredComponent>
    );
  }

  return (
    <Fade in={!loading} timeout={fadeDuration}>
      <div>{children}</div>
    </Fade>
  );
};

export default ContentLoader;
