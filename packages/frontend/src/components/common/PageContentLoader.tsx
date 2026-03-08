import React from 'react';
import {
  Box,
  CircularProgress,
  SxProps,
  Theme,
  keyframes,
} from '@mui/material';
import { DeferredComponent } from './DeferredComponent';

const slideUpFadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

interface PageContentLoaderProps {
  loading: boolean;
  children: React.ReactNode;
  /** Animation duration in ms (default: 350) */
  animationDuration?: number;
  /** Delay before showing fallback spinner in ms (default: 1000) */
  spinnerDelay?: number;
  /** Optional sx passed to the wrapper Box (e.g. flex, height) */
  sx?: SxProps<Theme>;
}

/**
 * Wraps page content with a smooth loading transition.
 *
 * - While loading: renders nothing (or a delayed spinner for long loads)
 * - Once loaded: content slides up and fades in smoothly
 *
 * This eliminates the "flash" where table headers or empty states
 * briefly appear before the real content is ready.
 */
const PageContentLoader: React.FC<PageContentLoaderProps> = ({
  loading,
  children,
  animationDuration = 350,
  spinnerDelay = 1000,
  sx,
}) => {
  if (loading) {
    return (
      <DeferredComponent shouldRender={loading} delay={spinnerDelay}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            py: 8,
            ...((sx as object) || {}),
          }}
        >
          <CircularProgress size={28} />
        </Box>
      </DeferredComponent>
    );
  }

  return (
    <Box
      sx={{
        animation: `${slideUpFadeIn} ${animationDuration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both`,
        ...((sx as object) || {}),
      }}
    >
      {children}
    </Box>
  );
};

export default PageContentLoader;
