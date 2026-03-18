/**
 * DraftChangesDialog
 *
 * View-only dialog for inspecting draft changes.
 * Uses shared diff utilities from DraftDiffUtils.
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
  Alert,
  Stack,
  Paper,
  Link,
} from '@mui/material';
import ContentLoader from './ContentLoader';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  type Environment,
  type TargetDiff,
  fetchAllDiffs,
} from './DraftDiffUtils';

interface DraftChangesDialogProps {
  open: boolean;
  onClose: () => void;
  targetTypes: string[];
  environments: Environment[];
  projectApiPath: string;
}

const DraftChangesDialog: React.FC<DraftChangesDialogProps> = ({
  open,
  onClose,
  targetTypes,
  environments,
  projectApiPath,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetDiffs, setTargetDiffs] = useState<TargetDiff[]>([]);

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

  const handleTargetClick = (targetType: string, targetName: string) => {
    onClose();
    if (targetType === 'segment') {
      navigate('/segments');
    } else {
      navigate(`/feature-flags/${targetName}`);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t('draft.changes.title')}
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
        <ContentLoader loading={loading}>
          <>
            {targetDiffs.length === 0 ? (
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
          </>
          {error && <Alert severity="error">{error}</Alert>}
        </ContentLoader>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default DraftChangesDialog;
