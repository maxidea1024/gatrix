/**
 * DraftBanner
 *
 * Displays a compact banner indicating that a draft exists for a resource.
 * Shows Publish, View Changes, and Discard buttons with loading states.
 */
import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Typography,
} from '@mui/material';
import {
  Publish as PublishIcon,
  DeleteOutline as DiscardIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface DraftBannerProps {
  /** Whether this resource has a saved draft */
  hasDraft: boolean;
  /** Optional flag name to identify which resource has a draft */
  flagName?: string;
  /** Timestamp of last draft update */
  updatedAt?: string;
  /** Name of the user who last updated the draft */
  updatedByName?: string;
  /** Called when user clicks Publish */
  onPublish: () => Promise<void>;
  /** Called when user clicks Discard */
  onDiscard: () => Promise<void>;
  /** Called when user clicks View Changes */
  onViewChanges?: () => void;
  /** Whether user has permission to manage */
  canManage?: boolean;
}

const DraftBanner: React.FC<DraftBannerProps> = ({
  hasDraft,
  onPublish,
  onDiscard,
  onViewChanges,
  canManage = true,
}) => {
  const { t } = useTranslation();
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const busy = publishing || discarding;

  if (!hasDraft) return null;

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await onPublish();
    } finally {
      setPublishing(false);
    }
  };

  const handleDiscard = async () => {
    setDiscarding(true);
    try {
      await onDiscard();
    } finally {
      setDiscarding(false);
    }
  };

  return (
    <Alert
      severity="info"
      icon={<EditIcon fontSize="small" />}
      sx={{
        borderRadius: 2,
        py: 0.25,
        px: 1.5,
        '& .MuiAlert-icon': {
          py: 0.5,
          mr: 0.5,
        },
        '& .MuiAlert-message': {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          py: 0.25,
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          gap: 1.5,
        }}
      >
        <Typography
          variant="body2"
          sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}
        >
          {t('draft.unpublishedChanges')}
        </Typography>
        {canManage && (
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            {onViewChanges && (
              <Button
                size="small"
                variant="outlined"
                color="info"
                startIcon={<ViewIcon sx={{ fontSize: 16 }} />}
                onClick={onViewChanges}
                disabled={busy}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.8rem',
                  py: 0.25,
                  px: 1.5,
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
                  <CircularProgress size={14} color="inherit" />
                ) : (
                  <PublishIcon sx={{ fontSize: 16 }} />
                )
              }
              onClick={handlePublish}
              disabled={busy}
              sx={{
                textTransform: 'none',
                fontSize: '0.8rem',
                py: 0.25,
                px: 1.5,
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
                  <CircularProgress size={14} />
                ) : (
                  <DiscardIcon sx={{ fontSize: 16 }} />
                )
              }
              onClick={handleDiscard}
              disabled={busy}
              sx={{
                textTransform: 'none',
                fontSize: '0.8rem',
                py: 0.25,
                px: 1.5,
              }}
            >
              {t('draft.discard')}
            </Button>
          </Box>
        )}
      </Box>
    </Alert>
  );
};

export default DraftBanner;
