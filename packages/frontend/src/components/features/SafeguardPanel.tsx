/**
 * SafeguardPanel - Manages safeguards for a release flow milestone.
 *
 * Shows a list of safeguards with their status (triggered/normal),
 * and allows creating, editing, deleting, evaluating, and resetting safeguards.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  Chip,
  IconButton,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
  CircularProgress,
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as EvaluateIcon,
  Refresh as ResetIcon,
  Shield as ShieldIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import {
  listSafeguards,
  createSafeguard,
  updateSafeguard,
  deleteSafeguard,
  evaluateSafeguards,
  resetSafeguard,
  getAvailableMetrics,
} from '../../services/releaseFlowService';
import type {
  Safeguard,
  CreateSafeguardInput,
  UpdateSafeguardInput,
  AvailableMetric,
} from '../../services/releaseFlowService';
import ConfirmDialog from '../common/ConfirmDialog';
import EmptyPlaceholder from '../common/EmptyPlaceholder';

interface SafeguardPanelProps {
  flowId: string;
  milestoneId: string;
  canManage: boolean;
  hideHeader?: boolean;
}

const AGGREGATION_OPTIONS = ['count', 'rps', 'avg', 'sum', 'p50', 'p95', 'p99'];
const OPERATOR_OPTIONS = ['>', '<', '>=', '<=', '=='];
const TIME_RANGE_OPTIONS = ['hour', 'day', 'week', 'month'];

const SafeguardPanel: React.FC<SafeguardPanelProps> = ({
  flowId,
  milestoneId,
  canManage,
  hideHeader = false,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [safeguards, setSafeguards] = useState<Safeguard[]>([]);
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedSafeguard, setSelectedSafeguard] = useState<Safeguard | null>(null);

  // Available metrics for autocomplete
  const [availableMetrics, setAvailableMetrics] = useState<AvailableMetric[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);

  // Form state
  const [metricName, setMetricName] = useState('');
  const [aggregationMode, setAggregationMode] = useState('count');
  const [operator, setOperator] = useState('>');
  const [threshold, setThreshold] = useState<number>(0);
  const [timeRange, setTimeRange] = useState('hour');

  const fetchSafeguards = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSafeguards(milestoneId);
      setSafeguards(data);
    } catch {
      // Silent catch - empty state will show
    } finally {
      setLoading(false);
    }
  }, [milestoneId]);

  useEffect(() => {
    fetchSafeguards();
  }, [fetchSafeguards]);

  // Fetch available metrics when dialog opens
  const fetchAvailableMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const metrics = await getAvailableMetrics();
      setAvailableMetrics(metrics);
    } catch {
      // Silent - user can still type manually
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  const resetForm = () => {
    setMetricName('');
    setAggregationMode('count');
    setOperator('>');
    setThreshold(0);
    setTimeRange('hour');
    setSelectedSafeguard(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setDialogOpen(true);
    fetchAvailableMetrics();
  };

  const handleOpenEdit = (safeguard: Safeguard) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setSelectedSafeguard(safeguard);
    setMetricName(safeguard.metricName);
    setAggregationMode(safeguard.aggregationMode);
    setOperator(safeguard.operator);
    setThreshold(safeguard.threshold);
    setTimeRange(safeguard.timeRange);
    setDialogOpen(true);
    fetchAvailableMetrics();
  };

  const handleSave = async () => {
    try {
      if (selectedSafeguard) {
        const input: UpdateSafeguardInput = {
          metricName,
          aggregationMode,
          operator,
          threshold,
          timeRange,
        };
        await updateSafeguard(selectedSafeguard.id, input);
        enqueueSnackbar(t('releaseFlow.safeguard.updateSuccess'), { variant: 'success' });
      } else {
        const input: CreateSafeguardInput = {
          flowId,
          milestoneId,
          metricName,
          aggregationMode,
          operator,
          threshold,
          timeRange,
          action: 'pause',
        };
        await createSafeguard(input);
        enqueueSnackbar(t('releaseFlow.safeguard.createSuccess'), { variant: 'success' });
      }
      setDialogOpen(false);
      resetForm();
      fetchSafeguards();
    } catch {
      // Error is handled by API interceptor
    }
  };

  const handleDeleteClick = (safeguard: Safeguard) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setSelectedSafeguard(safeguard);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedSafeguard) return;
    try {
      await deleteSafeguard(selectedSafeguard.id);
      enqueueSnackbar(t('releaseFlow.safeguard.deleteSuccess'), { variant: 'success' });
      setDeleteConfirmOpen(false);
      setSelectedSafeguard(null);
      fetchSafeguards();
    } catch {
      // Error is handled by API interceptor
    }
  };

  const handleEvaluate = async () => {
    setEvaluating(true);
    try {
      await evaluateSafeguards(milestoneId);
      enqueueSnackbar(t('releaseFlow.safeguard.evaluateSuccess'), { variant: 'success' });
      fetchSafeguards();
    } catch {
      // Error handled
    } finally {
      setEvaluating(false);
    }
  };

  const handleReset = async (safeguardId: string) => {
    try {
      await resetSafeguard(safeguardId);
      enqueueSnackbar(t('releaseFlow.safeguard.resetSuccess'), { variant: 'success' });
      fetchSafeguards();
    } catch {
      // Error handled
    }
  };

  const getTimeRangeLabel = (range: string) => {
    switch (range) {
      case 'hour':
        return t('releaseFlow.safeguard.timeRangeHour');
      case 'day':
        return t('releaseFlow.safeguard.timeRangeDay');
      case 'week':
        return t('releaseFlow.safeguard.timeRangeWeek');
      case 'month':
        return t('releaseFlow.safeguard.timeRangeMonth');
      default:
        return range;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={3}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box>
      {!hideHeader && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <ShieldIcon fontSize="small" color="primary" />
            <Typography variant="subtitle2">{t('releaseFlow.safeguards')}</Typography>
            <Chip label={safeguards.length} size="small" />
          </Stack>
          <Stack direction="row" spacing={1}>
            {safeguards.length > 0 && (
              <Tooltip title={t('releaseFlow.safeguard.evaluateDesc')}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={evaluating ? <CircularProgress size={14} /> : <EvaluateIcon />}
                  onClick={handleEvaluate}
                  disabled={evaluating}
                >
                  {t('releaseFlow.safeguard.evaluate')}
                </Button>
              </Tooltip>
            )}
            {canManage && safeguards.length > 0 && (
              <Button
                size="small"
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenCreate}
              >
                {t('releaseFlow.safeguard.addSafeguard')}
              </Button>
            )}
          </Stack>
        </Stack>
      )}
      {hideHeader && safeguards.length > 0 && (
        <Stack direction="row" justifyContent="flex-end" spacing={1} mb={1}>
          <Tooltip title={t('releaseFlow.safeguard.evaluateDesc')}>
            <Button
              size="small"
              variant="outlined"
              startIcon={evaluating ? <CircularProgress size={14} /> : <EvaluateIcon />}
              onClick={handleEvaluate}
              disabled={evaluating}
            >
              {t('releaseFlow.safeguard.evaluate')}
            </Button>
          </Tooltip>
          {canManage && (
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenCreate}
            >
              {t('releaseFlow.safeguard.addSafeguard')}
            </Button>
          )}
        </Stack>
      )}

      {/* Empty state */}
      {safeguards.length === 0 && (
        <EmptyPlaceholder
          message={t('releaseFlow.safeguard.noSafeguards')}
          description={t('releaseFlow.safeguard.noSafeguardsDesc')}
          onAddClick={canManage ? handleOpenCreate : undefined}
          addButtonLabel={t('releaseFlow.safeguard.addSafeguard')}
        />
      )}

      {/* Safeguards table */}
      {safeguards.length > 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('releaseFlow.safeguard.metricName')}</TableCell>
              <TableCell>{t('releaseFlow.safeguard.aggregationMode')}</TableCell>
              <TableCell align="center">{t('releaseFlow.safeguard.operator')}</TableCell>
              <TableCell align="right">{t('releaseFlow.safeguard.threshold')}</TableCell>
              <TableCell>{t('releaseFlow.safeguard.timeRange')}</TableCell>
              <TableCell align="center">{t('common.status')}</TableCell>
              {canManage && <TableCell align="right">{t('common.actions')}</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {safeguards.map((sg) => (
              <TableRow
                key={sg.id}
                sx={
                  sg.isTriggered
                    ? { bgcolor: 'error.main', '& td': { color: 'error.contrastText' } }
                    : undefined
                }
              >
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                    {sg.metricName}
                  </Typography>
                </TableCell>
                <TableCell>{sg.aggregationMode}</TableCell>
                <TableCell align="center">{sg.operator}</TableCell>
                <TableCell align="right">{sg.threshold}</TableCell>
                <TableCell>{getTimeRangeLabel(sg.timeRange)}</TableCell>
                <TableCell align="center">
                  {sg.isTriggered ? (
                    <Chip
                      icon={<WarningIcon />}
                      label={t('releaseFlow.safeguard.triggered')}
                      color="error"
                      size="small"
                    />
                  ) : (
                    <Chip
                      icon={<CheckIcon />}
                      label={t('releaseFlow.safeguard.notTriggered')}
                      color="success"
                      size="small"
                      variant="outlined"
                    />
                  )}
                </TableCell>
                {canManage && (
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      {sg.isTriggered && (
                        <Tooltip title={t('releaseFlow.safeguard.resetDesc')}>
                          <IconButton size="small" onClick={() => handleReset(sg.id)}>
                            <ResetIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title={t('releaseFlow.safeguard.editSafeguard')}>
                        <IconButton size="small" onClick={() => handleOpenEdit(sg)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('releaseFlow.safeguard.deleteSafeguard')}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteClick(sg)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedSafeguard
            ? t('releaseFlow.safeguard.editSafeguard')
            : t('releaseFlow.safeguard.addSafeguard')}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Autocomplete
              freeSolo
              options={availableMetrics.map((m) => m.name)}
              loading={metricsLoading}
              value={metricName}
              onInputChange={(_e, value) => setMetricName(value)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('releaseFlow.safeguard.metricName')}
                  placeholder={t('releaseFlow.safeguard.metricNamePlaceholder')}
                  size="small"
                />
              )}
              renderOption={(props, option) => {
                const metric = availableMetrics.find((m) => m.name === option);
                return (
                  <li {...props} key={option}>
                    <Box>
                      <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                        {option}
                      </Typography>
                      {metric?.help && (
                        <Typography variant="caption" color="text.secondary">
                          {metric.help} ({metric.type})
                        </Typography>
                      )}
                    </Box>
                  </li>
                );
              }}
            />
            <Stack direction="row" spacing={2}>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>{t('releaseFlow.safeguard.aggregationMode')}</InputLabel>
                <Select
                  value={aggregationMode}
                  label={t('releaseFlow.safeguard.aggregationMode')}
                  onChange={(e) => setAggregationMode(e.target.value)}
                >
                  {AGGREGATION_OPTIONS.map((opt) => (
                    <MenuItem key={opt} value={opt}>
                      {opt}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <InputLabel>{t('releaseFlow.safeguard.operator')}</InputLabel>
                <Select
                  value={operator}
                  label={t('releaseFlow.safeguard.operator')}
                  onChange={(e) => setOperator(e.target.value)}
                >
                  {OPERATOR_OPTIONS.map((opt) => (
                    <MenuItem key={opt} value={opt}>
                      {opt}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label={t('releaseFlow.safeguard.threshold')}
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                size="small"
                sx={{ minWidth: 120 }}
              />
            </Stack>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>{t('releaseFlow.safeguard.timeRange')}</InputLabel>
              <Select
                value={timeRange}
                label={t('releaseFlow.safeguard.timeRange')}
                onChange={(e) => setTimeRange(e.target.value)}
              >
                {TIME_RANGE_OPTIONS.map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {getTimeRangeLabel(opt)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleSave} disabled={!metricName.trim()}>
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteConfirm}
        title={t('releaseFlow.safeguard.deleteSafeguard')}
        message={t('releaseFlow.safeguard.deleteConfirm')}
      />
    </Box>
  );
};

export default SafeguardPanel;
