import React from 'react';
import { Box, Typography, Paper, Button, Divider, Tooltip, useTheme, alpha } from '@mui/material';
import {
  MergeType as MergeIcon,
  CheckCircle as ResolveIcon,
  Block as IgnoreIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface IssueBulkActionsProps {
  /** Set of selected issue IDs */
  selectedIds: Set<number>;
  /** Whether a merge operation is in progress */
  merging?: boolean;
  /** Resolve selected issues */
  onResolve: () => void;
  /** Ignore selected issues */
  onIgnore: () => void;
  /** Merge selected issues */
  onMerge: () => void;
  /** Delete selected issues */
  onDelete: () => void;
  /** Clear selection */
  onCancel: () => void;
}

/**
 * Floating action bar shown when one or more issues are selected.
 * Provides bulk resolve, ignore, merge, and delete actions.
 */
const IssueBulkActions: React.FC<IssueBulkActionsProps> = ({
  selectedIds,
  merging = false,
  onResolve,
  onIgnore,
  onMerge,
  onDelete,
  onCancel,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

  if (selectedIds.size === 0) return null;

  return (
    <Paper elevation={0} sx={{
      mb: 1.5, p: 1, display: 'flex', alignItems: 'center', gap: 1,
      border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
      borderRadius: 2,
      backgroundColor: alpha(theme.palette.primary.main, 0.04),
    }}>
      <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8rem', mr: 0.5 }}>
        {selectedIds.size} {t('argus.issues.selected')}
      </Typography>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      <Button
        variant="outlined"
        size="small"
        startIcon={<ResolveIcon sx={{ fontSize: 14 }} />}
        onClick={onResolve}
        sx={{ textTransform: 'none', borderRadius: '6px', fontSize: '0.76rem', borderColor: alpha('#4caf50', 0.5), color: '#4caf50', '&:hover': { borderColor: '#4caf50', backgroundColor: alpha('#4caf50', 0.08) } }}
      >
        {t('argus.issues.resolve')}
      </Button>
      <Button
        variant="outlined"
        size="small"
        startIcon={<IgnoreIcon sx={{ fontSize: 14 }} />}
        onClick={onIgnore}
        sx={{ textTransform: 'none', borderRadius: '6px', fontSize: '0.76rem', borderColor: alpha('#9e9e9e', 0.5), color: '#9e9e9e', '&:hover': { borderColor: '#9e9e9e', backgroundColor: alpha('#9e9e9e', 0.08) } }}
      >
        {t('argus.issues.ignore')}
      </Button>
      <Tooltip title={selectedIds.size < 2 ? t('argus.issues.mergeMinTwo') : ''}>
        <span>
          <Button
            variant="outlined"
            size="small"
            startIcon={<MergeIcon sx={{ fontSize: 14 }} />}
            disabled={selectedIds.size < 2 || merging}
            onClick={onMerge}
            sx={{ textTransform: 'none', borderRadius: '6px', fontSize: '0.76rem' }}
          >
            {t('argus.issues.merge')}
          </Button>
        </span>
      </Tooltip>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      <Button
        variant="outlined"
        size="small"
        startIcon={<CloseIcon sx={{ fontSize: 14 }} />}
        onClick={onDelete}
        sx={{ textTransform: 'none', borderRadius: '6px', fontSize: '0.76rem', borderColor: alpha('#f44336', 0.5), color: '#f44336', '&:hover': { borderColor: '#f44336', backgroundColor: alpha('#f44336', 0.08) } }}
      >
        {t('argus.detail.delete')}
      </Button>
      <Button
        size="small"
        onClick={onCancel}
        sx={{ textTransform: 'none', fontSize: '0.76rem', ml: 'auto' }}
      >
        {t('common.cancel')}
      </Button>
    </Paper>
  );
};

export default React.memo(IssueBulkActions);
