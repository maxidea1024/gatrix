/**
 * DraftBanner
 *
 * Displays a banner indicating that a draft exists for a resource.
 * Shows Publish and Discard buttons with loading states.
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
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { formatRelativeTime } from '../../utils/dateFormat';

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
  /** Whether user has permission to manage */
  canManage?: boolean;
}

const DraftBanner: React.FC<DraftBannerProps> = ({
  hasDraft,
  flagName,
  updatedAt,
  onPublish,
  onDiscard,
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
        borderRadius: 0,
        py: 0.5,
        '& .MuiAlert-message': {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {flagName ? (
            <>
              <strong>{flagName}</strong>{' '}
              {t('draft.unpublishedChanges')}
            </>
          ) : (
            t('draft.unpublishedChanges')
          )}
          {updatedAt && (
            <Typography
              component="span"
              variant="body2"
              sx={{ ml: 1, opacity: 0.7 }}
            >
              ({formatRelativeTime(updatedAt)})
            </Typography>
          )}
        </Typography>
        {canManage && (
          <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
            <Button
              size="small"
              variant="contained"
              color="primary"
              startIcon={
                publishing ? (
                  <CircularProgress size={14} color="inherit" />
                ) : (
                  <PublishIcon fontSize="small" />
                )
              }
              onClick={handlePublish}
              disabled={busy}
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
                  <DiscardIcon fontSize="small" />
                )
              }
              onClick={handleDiscard}
              disabled={busy}
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
