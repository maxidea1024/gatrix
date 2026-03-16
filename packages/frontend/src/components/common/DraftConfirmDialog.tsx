/**
 * DraftConfirmDialog
 *
 * Confirmation dialog that shows draft changes and lets the user
 * publish or discard after reviewing. Opened from DraftBanner buttons.
 */
import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Stack,
  Paper,
  Link,
} from '@mui/material';
import ContentLoader from './ContentLoader';
import {
  Publish as PublishIcon,
  DeleteOutline as DiscardIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  type Environment,
  type TargetDiff,
  fetchAllDiffs,
} from './DraftDiffUtils';

type ConfirmMode = 'publish' | 'discard';

interface DraftConfirmDialogProps {
  open: boolean;
  mode: ConfirmMode;
  onClose: () => void;
  /** Execute publish/discard */
  onConfirm: () => Promise<void>;
  targetTypes: string[];
  environments: Environment[];
  projectApiPath: string;
}

const DraftConfirmDialog: React.FC<DraftConfirmDialogProps> = ({
  open,
  mode,
  onClose,
  onConfirm,
  targetTypes,
  environments,
  projectApiPath,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetDiffs, setTargetDiffs] = useState<TargetDiff[]>([]);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) return;

    const fetchAndDiff = async () => {
      setLoading(true);
      setError(null);
      try {
        const results = await fetchAllDiffs(
          targetTypes,
          environments,
          projectApiPath,
          t
        );
        setTargetDiffs(results);
      } catch {
        setError(t('draft.loadFailed'));
      } finally {
        setLoading(false);
      }
    };
    fetchAndDiff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const totalChanges = targetDiffs.reduce(
    (sum, td) => sum + td.envDiffs.reduce((s, ed) => s + ed.changes.length, 0),
    0
  );

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      // Error handling is done by the parent callback
    } finally {
      setConfirming(false);
    }
  };

  const handleTargetClick = (targetType: string, targetName: string) => {
    onClose();
    if (targetType === 'segment') {
      navigate('/segments');
    } else {
      navigate(`/feature-flags/${targetName}`);
    }
  };

  const isPublish = mode === 'publish';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {isPublish
          ? t('draft.confirmPublishTitle')
          : t('draft.confirmDiscardTitle')}
        {!loading && totalChanges > 0 && (
          <Chip
            label={`${totalChanges}`}
            size="small"
            color="primary"
            sx={{ ml: 1, height: 22 }}
          />
        )}
      </DialogTitle>
      <DialogContent sx={{ height: 500, overflow: 'auto' }}>
        {/* Description */}
        <Alert severity={isPublish ? 'info' : 'warning'} sx={{ mb: 2 }}>
          {isPublish
            ? t('draft.confirmPublishDesc')
            : t('draft.confirmDiscardDesc')}
        </Alert>

        <ContentLoader loading={loading}>
          {error ? (
            <Alert severity="error">{error}</Alert>
          ) : targetDiffs.length === 0 ? (
            <Alert severity="info">{t('draft.changes.noChanges')}</Alert>
          ) : (
            <Stack spacing={2}>
              {targetDiffs.map(
                ({
                  targetId: tid,
                  targetName: tName,
                  targetType: tType,
                  envDiffs,
                }) => (
                  <Paper
                    key={`${tType}-${tid}`}
                    variant="outlined"
                    sx={{ p: 2 }}
                  >
                    <Link
                      component="button"
                      variant="subtitle1"
                      fontWeight={700}
                      underline="hover"
                      onClick={() => handleTargetClick(tType, tName)}
                      sx={{
                        cursor: 'pointer',
                        mb: 1,
                        display: 'block',
                        textAlign: 'left',
                      }}
                    >
                      {tName}
                    </Link>
                    <Stack spacing={1.5} sx={{ pl: 2 }}>
                      {envDiffs.map(({ envId, envName, changes }) => (
                        <Box key={envId}>
                          <Typography
                            variant="subtitle2"
                            fontWeight={600}
                            color="text.secondary"
                            gutterBottom
                          >
                            {envName}
                          </Typography>
                          <Divider sx={{ mb: 1 }} />
                          <Stack spacing={0.5}>{changes}</Stack>
                        </Box>
                      ))}
                    </Stack>
                  </Paper>
                )
              )}
            </Stack>
          )}
        </ContentLoader>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={confirming}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          color={isPublish ? 'primary' : 'error'}
          startIcon={
            confirming ? (
              <CircularProgress size={16} color="inherit" />
            ) : isPublish ? (
              <PublishIcon />
            ) : (
              <DiscardIcon />
            )
          }
          onClick={handleConfirm}
          disabled={confirming || loading || (isPublish && totalChanges === 0)}
        >
          {isPublish ? t('draft.publish') : t('draft.discard')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DraftConfirmDialog;
