/**
 * DraftBanner
 *
 * Floating top banner for draft actions.
 * Uses fixed positioning to float above content without affecting layout.
 * Slides down when draft changes exist, slides up when none.
 */
import React, { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Typography,
  Slide,
  useTheme,
} from '@mui/material';
import {
  Publish as PublishIcon,
  DeleteOutline as DiscardIcon,
  Visibility as ViewIcon,
  FiberManualRecord as DotIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface DraftBannerProps {
  /** Whether this resource has a saved draft */
  hasDraft: boolean;
  /** Called when user confirms Publish (fallback if no onPublishClick) */
  onPublish: () => Promise<void>;
  /** Called when user confirms Discard (fallback if no onDiscardClick) */
  onDiscard: () => Promise<void>;
  /** Called when user clicks View Changes */
  onViewChanges?: () => void;
  /** Called when user clicks Publish - opens confirm dialog */
  onPublishClick?: () => void;
  /** Called when user clicks Discard - opens confirm dialog */
  onDiscardClick?: () => void;
  /** Whether user has permission to manage */
  canManage?: boolean;
  /** Current sidebar width for centering within content area */
  sidebarWidth?: number;
}

const DraftBanner: React.FC<DraftBannerProps> = ({
  hasDraft,
  onPublish,
  onDiscard,
  onViewChanges,
  onPublishClick,
  onDiscardClick,
  canManage = true,
  sidebarWidth = 0,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const busy = publishing || discarding;

  const handlePublish = async () => {
    if (onPublishClick) {
      onPublishClick();
      return;
    }
    setPublishing(true);
    try {
      await onPublish();
    } finally {
      setPublishing(false);
    }
  };

  const handleDiscard = async () => {
    if (onDiscardClick) {
      onDiscardClick();
      return;
    }
    setDiscarding(true);
    try {
      await onDiscard();
    } finally {
      setDiscarding(false);
    }
  };

  return (
    <Slide direction="down" in={hasDraft} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: 'fixed',
          top: 72,
          left: { xs: 0, md: sidebarWidth },
          right: 0,
          zIndex: theme.zIndex.appBar - 1,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            py: 0.75,
            px: 2,
            borderRadius: 3,
            bgcolor:
              theme.palette.mode === 'dark'
                ? 'rgba(30, 30, 46, 0.95)'
                : 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(12px)',
            boxShadow:
              theme.palette.mode === 'dark'
                ? '0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)'
                : '0 4px 24px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05)',
            pointerEvents: 'auto',
            maxWidth: 560,
          }}
        >
          {/* Status */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <DotIcon
              sx={{
                fontSize: 10,
                color: 'warning.main',
                animation: 'pulse 2s infinite',
                '@keyframes pulse': {
                  '0%': { opacity: 1 },
                  '50%': { opacity: 0.4 },
                  '100%': { opacity: 1 },
                },
              }}
            />
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                fontSize: '0.78rem',
                color: 'text.primary',
                whiteSpace: 'nowrap',
              }}
            >
              {t('draft.unpublishedChanges')}
            </Typography>
          </Box>

          {/* Actions */}
          {canManage && (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {onViewChanges && (
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<ViewIcon sx={{ fontSize: 14 }} />}
                  onClick={onViewChanges}
                  disabled={busy}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    py: 0.25,
                    px: 1,
                    minHeight: 28,
                    color: 'text.secondary',
                    '&:hover': {
                      color: 'text.primary',
                      bgcolor:
                        theme.palette.mode === 'dark'
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(0,0,0,0.04)',
                    },
                  }}
                >
                  {t('draft.viewChanges')}
                </Button>
              )}
              <Button
                size="small"
                variant="contained"
                color="primary"
                startIcon={
                  publishing ? (
                    <CircularProgress size={12} color="inherit" />
                  ) : (
                    <PublishIcon sx={{ fontSize: 14 }} />
                  )
                }
                onClick={handlePublish}
                disabled={busy}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  py: 0.25,
                  px: 1.25,
                  minHeight: 28,
                  borderRadius: 2,
                  boxShadow: 'none',
                  '&:hover': { boxShadow: 'none' },
                }}
              >
                {t('draft.publish')}
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                startIcon={
                  discarding ? (
                    <CircularProgress size={12} />
                  ) : (
                    <DiscardIcon sx={{ fontSize: 14 }} />
                  )
                }
                onClick={handleDiscard}
                disabled={busy}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  py: 0.25,
                  px: 1.25,
                  minHeight: 28,
                  borderRadius: 2,
                  borderColor:
                    theme.palette.mode === 'dark'
                      ? 'rgba(255,255,255,0.12)'
                      : 'rgba(0,0,0,0.12)',
                  color: 'text.secondary',
                  '&:hover': {
                    borderColor: 'error.main',
                    color: 'error.main',
                    bgcolor: 'transparent',
                  },
                }}
              >
                {t('draft.discard')}
              </Button>
            </Box>
          )}
        </Box>
      </Box>
    </Slide>
  );
};

export default DraftBanner;
