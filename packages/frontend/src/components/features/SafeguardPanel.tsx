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
  Divider,
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
  HelpOutline as HelpIcon,
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
import api from '../../services/api';
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
type TimeUnit = 'minutes' | 'hours' | 'days';

// Convert value + unit to minutes
const toMinutes = (value: number, unit: TimeUnit): number => {
  switch (unit) {
    case 'minutes':
      return value;
    case 'hours':
      return value * 60;
    case 'days':
      return value * 1440;
    default:
      return value;
  }
};

// Convert minutes to best-fit value + unit
const fromMinutes = (minutes: number): { value: number; unit: TimeUnit } => {
  if (minutes >= 1440 && minutes % 1440 === 0) {
    return { value: minutes / 1440, unit: 'days' };
  }
  if (minutes >= 60 && minutes % 60 === 0) {
    return { value: minutes / 60, unit: 'hours' };
  }
  return { value: minutes, unit: 'minutes' };
};

// Format minutes to human-readable string (for table display)
const formatTimeRange = (minutes: number, t: (key: string) => string): string => {
  const { value, unit } = fromMinutes(minutes);
  switch (unit) {
    case 'days':
      return `${value} ${t('releaseFlow.safeguard.unitDays')}`;
    case 'hours':
      return `${value} ${t('releaseFlow.safeguard.unitHours')}`;
    case 'minutes':
      return `${value} ${t('releaseFlow.safeguard.unitMinutes')}`;
    default:
      return `${minutes}m`;
  }
};

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

  // Available labels for metric filtering
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const [labelsLoading, setLabelsLoading] = useState(false);

  // Form state
  const [metricName, setMetricName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [aggregationMode, setAggregationMode] = useState('count');
  const [operator, setOperator] = useState('>');
  const [threshold, setThreshold] = useState<number>(0);
  const [timeRangeValue, setTimeRangeValue] = useState<number>(5);
  const [timeRangeUnit, setTimeRangeUnit] = useState<TimeUnit>('minutes');
  const [labelFilters, setLabelFilters] = useState<Record<string, string>>({});
  const [newLabelKey, setNewLabelKey] = useState('');
  const [newLabelValue, setNewLabelValue] = useState('');

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

  // Fetch labels when metric name changes
  useEffect(() => {
    if (!metricName || !dialogOpen) {
      setAvailableLabels([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLabelsLoading(true);
      try {
        const response = await api.get<string[]>('/admin/impact-metrics/labels', {
          params: { metric: metricName },
        });
        setAvailableLabels(response.data || []);
      } catch {
        setAvailableLabels([]);
      } finally {
        setLabelsLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [metricName, dialogOpen]);

  const resetForm = () => {
    setMetricName('');
    setDisplayName('');
    setAggregationMode('count');
    setOperator('>');
    setThreshold(0);
    setTimeRangeValue(5);
    setTimeRangeUnit('minutes');
    setLabelFilters({});
    setNewLabelKey('');
    setNewLabelValue('');
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
    setDisplayName(safeguard.displayName || '');
    setAggregationMode(safeguard.aggregationMode);
    setOperator(safeguard.operator);
    setThreshold(safeguard.threshold);
    const { value, unit } = fromMinutes(safeguard.timeRangeMinutes);
    setTimeRangeValue(value);
    setTimeRangeUnit(unit);
    setLabelFilters(safeguard.labelFilters || {});
    setNewLabelKey('');
    setNewLabelValue('');
    setDialogOpen(true);
    fetchAvailableMetrics();
  };

  const handleSave = async () => {
    try {
      const timeRangeMinutes = toMinutes(timeRangeValue, timeRangeUnit);
      if (selectedSafeguard) {
        const input: UpdateSafeguardInput = {
          metricName,
          displayName: displayName.trim() || null,
          aggregationMode,
          operator,
          threshold,
          timeRangeMinutes,
          labelFilters: Object.keys(labelFilters).length > 0 ? labelFilters : null,
        };
        await updateSafeguard(selectedSafeguard.id, input);
        enqueueSnackbar(t('releaseFlow.safeguard.updateSuccess'), { variant: 'success' });
      } else {
        const input: CreateSafeguardInput = {
          flowId,
          milestoneId,
          metricName,
          displayName: displayName.trim() || undefined,
          aggregationMode,
          operator,
          threshold,
          timeRangeMinutes,
          labelFilters: Object.keys(labelFilters).length > 0 ? labelFilters : undefined,
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

  const handleAddLabelFilter = () => {
    if (!newLabelKey.trim()) return;
    setLabelFilters((prev) => ({ ...prev, [newLabelKey.trim()]: newLabelValue.trim() }));
    setNewLabelKey('');
    setNewLabelValue('');
  };

  const handleRemoveLabelFilter = (key: string) => {
    setLabelFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Get display label for a safeguard in the table
  const getSafeguardLabel = (sg: Safeguard): string => {
    return sg.displayName || sg.metricName;
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
            <Tooltip
              title={t('releaseFlow.safeguard.helpTooltip')}
              arrow
              placement="right"
              slotProps={{
                tooltip: { sx: { maxWidth: 360, whiteSpace: 'pre-line', fontSize: '0.8rem' } },
              }}
            >
              <HelpIcon
                fontSize="small"
                sx={{ color: 'text.secondary', cursor: 'help', fontSize: 16 }}
              />
            </Tooltip>
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
      {hideHeader && (
        <Stack direction="row" alignItems="center" justifyContent="flex-end" mb={1}>
          {safeguards.length > 0 && (
            <Stack direction="row" spacing={1}>
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
        <Table size="small" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '30%' }}>{t('releaseFlow.safeguard.metricName')}</TableCell>
              <TableCell sx={{ width: '12%' }}>
                {t('releaseFlow.safeguard.aggregationMode')}
              </TableCell>
              <TableCell align="center" sx={{ width: '10%' }}>
                {t('releaseFlow.safeguard.condition')}
              </TableCell>
              <TableCell sx={{ width: '15%' }}>{t('releaseFlow.safeguard.timeRange')}</TableCell>
              <TableCell align="center" sx={{ width: '13%' }}>
                {t('common.status')}
              </TableCell>
              {canManage && (
                <TableCell align="right" sx={{ width: '20%' }}>
                  {t('common.actions')}
                </TableCell>
              )}
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
                  <Tooltip title={sg.metricName} enterDelay={300}>
                    <Typography
                      variant="body2"
                      fontFamily={sg.displayName ? 'inherit' : 'monospace'}
                      fontSize="0.8rem"
                      fontWeight={sg.displayName ? 600 : 400}
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'block',
                      }}
                    >
                      {getSafeguardLabel(sg)}
                    </Typography>
                  </Tooltip>
                  {sg.displayName && (
                    <Tooltip title={sg.metricName} enterDelay={300}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        fontFamily="monospace"
                        fontSize="0.7rem"
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'block',
                        }}
                      >
                        {sg.metricName}
                      </Typography>
                    </Tooltip>
                  )}
                  {sg.labelFilters && Object.keys(sg.labelFilters).length > 0 && (
                    <Stack
                      direction="row"
                      spacing={0.5}
                      sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}
                    >
                      {Object.entries(sg.labelFilters).map(([k, v]) => (
                        <Chip
                          key={k}
                          label={`${k}=${v}`}
                          size="small"
                          variant="outlined"
                          sx={{
                            height: 18,
                            fontSize: '0.65rem',
                            '& .MuiChip-label': { px: 0.5 },
                          }}
                        />
                      ))}
                    </Stack>
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={sg.aggregationMode.toUpperCase()}
                    size="small"
                    variant="outlined"
                    sx={{ height: 22, fontSize: '0.7rem' }}
                  />
                </TableCell>
                <TableCell align="center">
                  <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                    {sg.operator} {sg.threshold}
                  </Typography>
                </TableCell>
                <TableCell>{formatTimeRange(sg.timeRangeMinutes, t)}</TableCell>
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
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {/* Section 1: Metric Selection */}
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                {t('releaseFlow.safeguard.sectionMetric')}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 1.5 }}
              >
                {t('releaseFlow.safeguard.sectionMetricHelp')}
              </Typography>

              <Stack spacing={2}>
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
                      required
                      helperText={t('releaseFlow.safeguard.metricNameHelp')}
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

                <TextField
                  label={t('releaseFlow.safeguard.displayNameLabel')}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  size="small"
                  placeholder={t('releaseFlow.safeguard.displayNamePlaceholder')}
                  helperText={t('releaseFlow.safeguard.displayNameHelp')}
                />
              </Stack>
            </Box>

            <Divider />

            {/* Section 2: Condition */}
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                {t('releaseFlow.safeguard.sectionCondition')}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 1.5 }}
              >
                {t('releaseFlow.safeguard.sectionConditionHelp')}
              </Typography>

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
                        {opt.toUpperCase()}
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
                  helperText={t('releaseFlow.safeguard.thresholdHelp')}
                />
              </Stack>
            </Box>

            <Divider />

            {/* Section 3: Time Range */}
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                {t('releaseFlow.safeguard.sectionTimeRange')}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 1.5 }}
              >
                {t('releaseFlow.safeguard.sectionTimeRangeHelp')}
              </Typography>

              <Stack direction="row" spacing={2} alignItems="flex-start">
                <TextField
                  label={t('releaseFlow.safeguard.timeRangeValue')}
                  type="number"
                  value={timeRangeValue}
                  onChange={(e) => setTimeRangeValue(Math.max(1, Number(e.target.value)))}
                  size="small"
                  sx={{ width: 120 }}
                  inputProps={{ min: 1 }}
                />
                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <InputLabel>{t('releaseFlow.safeguard.timeRangeUnit')}</InputLabel>
                  <Select
                    value={timeRangeUnit}
                    label={t('releaseFlow.safeguard.timeRangeUnit')}
                    onChange={(e) => setTimeRangeUnit(e.target.value as TimeUnit)}
                  >
                    <MenuItem value="minutes">{t('releaseFlow.safeguard.unitMinutes')}</MenuItem>
                    <MenuItem value="hours">{t('releaseFlow.safeguard.unitHours')}</MenuItem>
                    <MenuItem value="days">{t('releaseFlow.safeguard.unitDays')}</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Box>

            <Divider />

            {/* Section 4: Label Filters */}
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                {t('releaseFlow.safeguard.sectionLabelFilters')}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 1.5 }}
              >
                {t('releaseFlow.safeguard.sectionLabelFiltersHelp')}
              </Typography>

              {/* Existing label filters */}
              {Object.keys(labelFilters).length > 0 && (
                <Stack direction="row" spacing={0.5} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
                  {Object.entries(labelFilters).map(([key, value]) => (
                    <Chip
                      key={key}
                      label={`${key} = ${value}`}
                      size="small"
                      variant="outlined"
                      onDelete={() => handleRemoveLabelFilter(key)}
                      sx={{ height: 24 }}
                    />
                  ))}
                </Stack>
              )}

              {/* Add label filter */}
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Autocomplete
                  freeSolo
                  options={availableLabels.filter((l) => !labelFilters[l])}
                  loading={labelsLoading}
                  value={newLabelKey}
                  onInputChange={(_e, value) => setNewLabelKey(value)}
                  size="small"
                  sx={{ flex: 1 }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('releaseFlow.safeguard.labelKey')}
                      placeholder="e.g. method"
                      size="small"
                    />
                  )}
                />
                <TextField
                  label={t('releaseFlow.safeguard.labelValue')}
                  value={newLabelValue}
                  onChange={(e) => setNewLabelValue(e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                  placeholder="e.g. GET"
                />
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleAddLabelFilter}
                  disabled={!newLabelKey.trim()}
                  sx={{ minWidth: 60, height: 40 }}
                >
                  {t('common.add')}
                </Button>
              </Stack>
            </Box>
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
