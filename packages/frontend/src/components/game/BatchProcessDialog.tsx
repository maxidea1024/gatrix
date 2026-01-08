import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useDebounce } from '../../hooks/useDebounce';
import { getActionLabel } from '../../utils/changeRequestToast';
import { useEnvironment } from '../../contexts/EnvironmentContext';

interface BatchProcessDialogProps {
  open: boolean;
  onClose: () => void;
  onExecute: (params: {
    search?: string;
    currentIsActive?: boolean;
    targetIsActive: boolean;
  }) => Promise<{ affectedCount: number }>;
  onGetCount: (params: { search?: string; isActive?: boolean }) => Promise<number>;
}

type TargetStatus = 'all' | 'active' | 'inactive';
type BatchAction = 'activate' | 'deactivate';

const BatchProcessDialog: React.FC<BatchProcessDialogProps> = ({
  open,
  onClose,
  onExecute,
  onGetCount,
}) => {
  const { t } = useTranslation();
  const { currentEnvironment } = useEnvironment();
  const requiresApproval = currentEnvironment?.requiresApproval ?? false;

  const [searchTerm, setSearchTerm] = useState('');
  const [targetStatus, setTargetStatus] = useState<TargetStatus>('all');
  const [action, setAction] = useState<BatchAction>('activate');
  const [matchingCount, setMatchingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [countLoading, setCountLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Fetch matching count when filters change
  const fetchCount = useCallback(async () => {
    setCountLoading(true);
    try {
      const params: { search?: string; isActive?: boolean } = {};
      if (debouncedSearchTerm) {
        params.search = debouncedSearchTerm;
      }
      if (targetStatus === 'active') {
        params.isActive = true;
      } else if (targetStatus === 'inactive') {
        params.isActive = false;
      }
      const count = await onGetCount(params);
      setMatchingCount(count);
      setError(null);
    } catch (err: any) {
      setError(err.message || t('storeProducts.batchExecuteFailed'));
      setMatchingCount(null);
    } finally {
      setCountLoading(false);
    }
  }, [debouncedSearchTerm, targetStatus, onGetCount, t]);

  useEffect(() => {
    if (open) {
      fetchCount();
    }
  }, [open, fetchCount]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSearchTerm('');
      setTargetStatus('all');
      setAction('activate');
      setMatchingCount(null);
      setError(null);
    }
  }, [open]);

  const handleExecute = async () => {
    if (matchingCount === null || matchingCount === 0) return;

    setLoading(true);
    setError(null);
    try {
      const params: {
        search?: string;
        currentIsActive?: boolean;
        targetIsActive: boolean;
      } = {
        targetIsActive: action === 'activate',
      };

      if (debouncedSearchTerm) {
        params.search = debouncedSearchTerm;
      }
      if (targetStatus === 'active') {
        params.currentIsActive = true;
      } else if (targetStatus === 'inactive') {
        params.currentIsActive = false;
      }

      await onExecute(params);
      onClose();
    } catch (err: any) {
      setError(err.message || t('storeProducts.batchExecuteFailed'));
    } finally {
      setLoading(false);
    }
  };

  const getDialogActionLabel = () => {
    return action === 'activate'
      ? t('storeProducts.batchActionActivate')
      : t('storeProducts.batchActionDeactivate');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('storeProducts.batchProcessTitle')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t('storeProducts.batchProcessSubtitle')}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Search */}
        <TextField
          fullWidth
          label={t('storeProducts.batchSearchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ mb: 2 }}
          size="small"
        />

        {/* Target Status */}
        <FormControl fullWidth sx={{ mb: 2 }} size="small">
          <InputLabel>{t('storeProducts.batchTargetStatus')}</InputLabel>
          <Select
            value={targetStatus}
            label={t('storeProducts.batchTargetStatus')}
            onChange={(e) => setTargetStatus(e.target.value as TargetStatus)}
          >
            <MenuItem value="all">{t('storeProducts.batchTargetAll')}</MenuItem>
            <MenuItem value="active">{t('storeProducts.batchTargetActive')}</MenuItem>
            <MenuItem value="inactive">{t('storeProducts.batchTargetInactive')}</MenuItem>
          </Select>
        </FormControl>

        {/* Action */}
        <FormControl fullWidth sx={{ mb: 2 }} size="small">
          <InputLabel>{t('storeProducts.batchAction')}</InputLabel>
          <Select
            value={action}
            label={t('storeProducts.batchAction')}
            onChange={(e) => setAction(e.target.value as BatchAction)}
          >
            <MenuItem value="activate">{t('storeProducts.batchActionActivate')}</MenuItem>
            <MenuItem value="deactivate">{t('storeProducts.batchActionDeactivate')}</MenuItem>
          </Select>
        </FormControl>

        <Divider sx={{ my: 2 }} />

        {/* Matching Count */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" fontWeight="medium">
            {t('storeProducts.batchMatchingProducts')}:
          </Typography>
          {countLoading ? (
            <CircularProgress size={16} />
          ) : matchingCount !== null ? (
            <Typography
              variant="body2"
              color={matchingCount > 0 ? 'primary.main' : 'text.secondary'}
              fontWeight="bold"
            >
              {t('storeProducts.batchMatchingProductsCount', { count: matchingCount })}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">-</Typography>
          )}
        </Box>

        {matchingCount === 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            {t('storeProducts.batchNoMatchingProducts')}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleExecute}
          disabled={loading || countLoading || matchingCount === null || matchingCount === 0}
          color={action === 'activate' ? 'success' : 'warning'}
        >
          {loading ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            `${getActionLabel('update', requiresApproval, t)} (${getDialogActionLabel()})`
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BatchProcessDialog;

