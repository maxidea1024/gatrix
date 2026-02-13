/**
 * Impact Metrics Chart Panel
 *
 * Grafana-like approach: users register metric chart configs,
 * then each config renders as a chart panel querying Prometheus.
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Autocomplete,
  TextField,
  Button,
  IconButton,
  CircularProgress,
  Alert,
  Chip,
  useTheme,
  Stack,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Grid,
  SelectChangeEvent,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  ShowChart as ChartIcon,
  Edit as EditIcon,
  ZoomIn as ExpandIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import api from '../../services/api';
import { useSnackbar } from 'notistack';
import EmptyPlaceholder from '../common/EmptyPlaceholder';
import ConfirmDialog from '../common/ConfirmDialog';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

// ==================== Types ====================

interface AvailableMetric {
  name: string;
  help: string;
  type: string;
}

interface MetricConfig {
  id: string;
  flagId: string;
  title: string;
  metricName: string;
  chartType: 'line' | 'area' | 'bar';
  groupBy?: string[];
  labelSelectors?: Record<string, string[]> | null;
  aggregationMode: string;
  chartRange: string;
  displayOrder: number;
}

interface TimeSeriesSeries {
  metric: Record<string, string>;
  data: [number, number][];
}

interface TimeSeriesResponse {
  series: TimeSeriesSeries[];
}

type RangeOption = 'hour' | 'day' | 'week' | 'month';
type AggregationMode = 'rps' | 'count' | 'avg' | 'sum' | 'p50' | 'p95' | 'p99';

interface ImpactMetricsChartProps {
  flagId?: string;
  canManage?: boolean;
  compact?: boolean;
  hideTitle?: boolean;
}

// Colors for multiple series
const SERIES_COLORS = [
  { border: '#2196f3', bg: 'rgba(33, 150, 243, 0.4)' },
  { border: '#4caf50', bg: 'rgba(76, 175, 80, 0.4)' },
  { border: '#ff9800', bg: 'rgba(255, 152, 0, 0.4)' },
  { border: '#f44336', bg: 'rgba(244, 67, 54, 0.4)' },
  { border: '#9c27b0', bg: 'rgba(156, 39, 176, 0.4)' },
  { border: '#00bcd4', bg: 'rgba(0, 188, 212, 0.4)' },
  { border: '#607d8b', bg: 'rgba(96, 125, 139, 0.4)' },
  { border: '#e91e63', bg: 'rgba(233, 30, 99, 0.4)' },
];

// ==================== Single Chart Panel ====================

interface ChartPanelProps {
  config: MetricConfig;
  canManage?: boolean;
  onDelete?: () => void;
  onEdit?: () => void;
  onExpand?: () => void;
  onRangeChange?: (range: RangeOption) => void;
  isExpanded?: boolean;
}

const AddChartPlaceholder: React.FC<{ onClick: () => void; label: string }> = ({
  onClick,
  label,
}) => {
  const theme = useTheme();
  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={{
        height: 340,
        width: '100%',
        boxSizing: 'border-box',
        borderRadius: 3,
        borderStyle: 'dashed',
        borderWidth: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s',
        bgcolor: theme.palette.action.hover + '05',
        color: 'text.secondary',
        '&:hover': {
          bgcolor: theme.palette.action.hover + '10',
          borderColor: theme.palette.primary.main,
          color: theme.palette.primary.main,
          transform: 'translateY(-2px)',
          boxShadow: theme.shadows[2],
        },
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'action.selected',
          mb: 1.5,
        }}
      >
        <AddIcon sx={{ fontSize: 28 }} />
      </Box>
      <Typography variant="subtitle2" fontWeight={600}>
        {label}
      </Typography>
    </Paper>
  );
};

const ChartPanel: React.FC<ChartPanelProps> = ({
  config,
  canManage,
  onDelete,
  onEdit,
  onExpand,
  onRangeChange,
  isExpanded = false,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seriesData, setSeriesData] = useState<TimeSeriesResponse | null>(null);
  const [range, setRange] = useState<RangeOption>((config.chartRange as RangeOption) || 'hour');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {
        series: config.metricName,
        range,
        aggregationMode: config.aggregationMode || 'count',
      };
      if (config.labelSelectors) {
        params.labels = JSON.stringify(config.labelSelectors);
      }
      if (config.groupBy && config.groupBy.length > 0) {
        // Axios handles array params by default
        params.groupBy = config.groupBy;
      }

      const response = await api.get<TimeSeriesResponse>('/admin/impact-metrics', { params });
      setSeriesData(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [config.metricName, config.aggregationMode, config.labelSelectors, config.groupBy, range]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRangeChange = (_: React.MouseEvent<HTMLElement>, newRange: RangeOption | null) => {
    if (newRange) {
      setRange(newRange);
      onRangeChange?.(newRange);
    }
  };

  // Build chart data
  const chartData = useMemo(() => {
    if (!seriesData?.series?.length) return { labels: [], datasets: [] };

    const allTimestamps = new Set<number>();
    seriesData.series.forEach((s) => {
      s.data.forEach(([ts]) => allTimestamps.add(ts));
    });
    const sorted = Array.from(allTimestamps).sort((a, b) => a - b);

    const formatLabel = (ts: number) => {
      const d = new Date(ts * 1000);
      if (range === 'hour' || range === 'day') {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    const labels = sorted.map(formatLabel);
    const datasets = seriesData.series.map((s, idx) => {
      const color = SERIES_COLORS[idx % SERIES_COLORS.length];
      const tsMap = new Map(s.data.map(([ts, val]) => [ts, val]));

      // Build label from groupBy or metric labels
      let label = config.metricName;

      // Prioritize groupBy labels if available
      if (config.groupBy && config.groupBy.length > 0) {
        const groupParts = config.groupBy.map((key) => s.metric[key] || '').filter((v) => v);
        if (groupParts.length > 0) {
          label = groupParts.join(' / ');
        }
      } else {
        // Fallback to all extra labels
        const metricLabels = Object.entries(s.metric || {}).filter(([k]) => k !== '__name__');
        if (metricLabels.length > 0 && metricLabels.length < 3) {
          label = metricLabels.map(([k, v]) => `${k}=${v}`).join(', ');
        } else if (metricLabels.length >= 3) {
          // Too many labels, just show summary or ID?
          label = `${config.metricName} (${idx + 1})`;
        }
      }

      return {
        label,
        data: sorted.map((ts) => tsMap.get(ts) ?? null),
        borderColor: color.border,
        backgroundColor: config.chartType === 'line' ? color.bg.replace('0.4', '0.1') : color.bg,
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 1,
        pointHoverRadius: 4,
        fill: config.chartType === 'area',
        spanGaps: true,
      };
    });

    return { labels, datasets };
  }, [seriesData, range, config]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index' as const, intersect: false },
      plugins: {
        legend: {
          display: chartData.datasets.length > 1,
          position: 'bottom' as const,
          labels: {
            color: theme.palette.text.primary,
            usePointStyle: true,
            padding: 10,
            font: { size: 10 },
            boxWidth: 8,
          },
        },
        tooltip: {
          backgroundColor: theme.palette.mode === 'dark' ? '#333' : '#fff',
          titleColor: theme.palette.text.primary,
          bodyColor: theme.palette.text.secondary,
          borderColor: theme.palette.divider,
          borderWidth: 1,
          cornerRadius: 6,
          callbacks: {
            label: (ctx: any) => {
              const val = ctx.parsed?.y;
              if (val === null || val === undefined) return '';
              return `${ctx.dataset.label}: ${typeof val === 'number' ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : val}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
          },
          ticks: {
            color: theme.palette.text.secondary,
            font: { size: 9 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
          },
          ticks: { color: theme.palette.text.secondary, font: { size: 9 } },
        },
      },
    }),
    [theme, chartData.datasets.length]
  );

  const hasData = chartData.datasets.length > 0;

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2.5,
        borderRadius: 3,
        height: isExpanded ? '100%' : 340,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.2s',
        position: 'relative',
        '&:hover': {
          transform: isExpanded ? 'none' : 'translateY(-2px)',
          boxShadow: isExpanded ? theme.shadows[3] : theme.shadows[6],
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
          minWidth: 0,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: theme.palette.primary.main + '15',
              color: theme.palette.primary.main,
            }}
          >
            <ChartIcon sx={{ fontSize: 18 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <Typography
              variant="subtitle1"
              fontWeight={600}
              title={config.title}
              sx={{
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'block',
                width: '100%',
              }}
            >
              {config.title}
            </Typography>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                width: '100%',
                overflow: 'hidden',
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                title={config.metricName}
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'block',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {config.metricName}
              </Typography>
              <Chip
                label={config.aggregationMode.toUpperCase()}
                size="small"
                variant="filled"
                color="default"
                sx={{
                  height: 16,
                  fontSize: '0.6rem',
                  bgcolor: theme.palette.action.selected,
                  flexShrink: 0,
                  '& .MuiChip-label': { px: 0.8 },
                }}
              />
            </Box>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          {!isExpanded && (
            <Tooltip title={t('common.expand')}>
              <IconButton size="small" onClick={onExpand}>
                <ExpandIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={t('common.refresh')}>
            <IconButton size="small" onClick={fetchData} disabled={loading}>
              <RefreshIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          {canManage && !isExpanded && (
            <>
              {onEdit && (
                <Tooltip title={t('common.edit')}>
                  <IconButton size="small" onClick={onEdit}>
                    <EditIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              )}
              {onDelete && (
                <Tooltip title={t('common.delete')}>
                  <IconButton size="small" onClick={onDelete} color="error">
                    <DeleteIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              )}
            </>
          )}
        </Box>
      </Box>

      {/* Content Area */}
      <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {/* Range Toggle Overlay for cleaner look */}
        <Box sx={{ position: 'absolute', top: 0, right: 0, zIndex: 1 }}>
          <ToggleButtonGroup
            size="small"
            value={range}
            exclusive
            onChange={handleRangeChange}
            sx={{
              bgcolor: theme.palette.background.paper,
              boxShadow: 1,
              '& .MuiToggleButton-root': {
                py: 0.2,
                px: 1,
                fontSize: '0.65rem',
                height: 22,
                textTransform: 'none',
                border: 'none',
                '&.Mui-selected': {
                  bgcolor: theme.palette.primary.main,
                  color: '#fff',
                  '&:hover': { bgcolor: theme.palette.primary.dark },
                },
              },
            }}
          >
            <ToggleButton value="hour">1h</ToggleButton>
            <ToggleButton value="day">24h</ToggleButton>
            <ToggleButton value="week">7d</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {error ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'error.main',
            }}
          >
            <Typography variant="body2">{error}</Typography>
          </Box>
        ) : loading ? (
          <Box
            sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}
          >
            <CircularProgress size={24} thickness={4} />
          </Box>
        ) : !hasData ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              flexDirection: 'column',
              color: 'text.secondary',
              opacity: 0.7,
              pt: 4, // Make room for toggle
            }}
          >
            <Typography variant="body2" fontWeight={500}>
              {t('impactMetrics.noData')}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ height: '100%', pt: 4 }}>
            {config.chartType === 'bar' ? (
              <Bar data={chartData} options={chartOptions} />
            ) : (
              <Line data={chartData} options={chartOptions} />
            )}
          </Box>
        )}
      </Box>
    </Paper>
  );
};

// ==================== Add Chart Dialog ====================

// ==================== Chart Config Dialog ====================

const ChartConfigDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    metricName: string;
    chartType: 'line' | 'area' | 'bar';
    groupBy?: string[];
    aggregationMode: string;
    chartRange: string;
  }) => void;
  availableMetrics: AvailableMetric[];
  loadingMetrics: boolean;
  initialValues?: MetricConfig;
}> = ({ open, onClose, onSave, availableMetrics, loadingMetrics, initialValues }) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [metricName, setMetricName] = useState('');
  const [chartType, setChartType] = useState<'line' | 'area' | 'bar'>('line');
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [aggregationMode, setAggregationMode] = useState<AggregationMode>('count');
  const [chartRange, setChartRange] = useState<RangeOption>('hour');

  // New state for labels
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const [loadingLabels, setLoadingLabels] = useState(false);

  // Load initial values when dialog opens
  useEffect(() => {
    if (open && initialValues) {
      setTitle(initialValues.title);
      setMetricName(initialValues.metricName);
      setChartType(initialValues.chartType);
      setGroupBy(initialValues.groupBy || []);
      setAggregationMode(initialValues.aggregationMode as AggregationMode);
      setChartRange(initialValues.chartRange as RangeOption);
    } else if (open && !initialValues) {
      // Reset for new chart
      setTitle('');
      setMetricName('');
      setChartType('line');
      setGroupBy([]);
      setAggregationMode('count');
      setChartRange('hour');
    }
  }, [open, initialValues]);

  // Fetch labels when metricName changes
  useEffect(() => {
    if (!metricName) {
      setAvailableLabels([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingLabels(true);
      try {
        const response = await api.get<{ data: string[] }>('/admin/impact-metrics/labels', {
          params: { metric: metricName },
        });
        setAvailableLabels(response.data?.data || []);
      } catch (err) {
        console.error('Failed to fetch labels:', err);
        setAvailableLabels([]);
      } finally {
        setLoadingLabels(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [metricName]);

  const handleSave = () => {
    if (!metricName) return;
    onSave({
      title: title || metricName,
      metricName,
      chartType,
      groupBy,
      aggregationMode,
      chartRange,
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {initialValues ? t('impactMetrics.editChart') : t('impactMetrics.addChart')}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {/* Metric name - disabled in edit mode if desired, but let's allow change */}
          <Autocomplete
            freeSolo
            loading={loadingMetrics}
            options={availableMetrics.map((m) => m.name)}
            value={metricName}
            onChange={(_, newValue) => setMetricName(newValue || '')}
            onInputChange={(_, newInput) => setMetricName(newInput)}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('impactMetrics.metricName')}
                required
                helperText={t('impactMetrics.metricNameHelp')}
              />
            )}
            renderOption={(props, option) => {
              const metric = availableMetrics.find((m) => m.name === option);
              return (
                <li {...props} key={option}>
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
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

          {/* Group By - Now with autocomplete */}
          <Autocomplete
            multiple
            freeSolo
            loading={loadingLabels}
            options={availableLabels}
            value={groupBy}
            onChange={(_, newValue) => setGroupBy(newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('impactMetrics.groupBy')}
                placeholder="label (e.g. pod)"
                helperText={t('impactMetrics.groupByHelp')}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <React.Fragment>
                      {loadingLabels ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </React.Fragment>
                  ),
                }}
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip variant="outlined" label={option} size="small" {...getTagProps({ index })} />
              ))
            }
          />

          {/* Title */}
          <TextField
            label={t('impactMetrics.chartTitle')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={metricName || t('impactMetrics.chartTitlePlaceholder')}
            helperText={t('impactMetrics.chartTitleHelp')}
          />

          <Stack direction="row" spacing={2}>
            {/* Chart Type */}
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>{t('impactMetrics.chartType')}</InputLabel>
              <Select
                value={chartType}
                label={t('impactMetrics.chartType')}
                onChange={(e: SelectChangeEvent<'line' | 'area' | 'bar'>) =>
                  setChartType(e.target.value as any)
                }
              >
                <MenuItem value="line">{t('impactMetrics.chartType.line')}</MenuItem>
                <MenuItem value="area">{t('impactMetrics.chartType.area')}</MenuItem>
                <MenuItem value="bar">{t('impactMetrics.chartType.bar')}</MenuItem>
              </Select>
            </FormControl>

            {/* Aggregation */}
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>{t('impactMetrics.aggregation')}</InputLabel>
              <Select
                value={aggregationMode}
                label={t('impactMetrics.aggregation')}
                onChange={(e: SelectChangeEvent<AggregationMode>) =>
                  setAggregationMode(e.target.value as AggregationMode)
                }
              >
                <MenuItem value="count">{t('impactMetrics.aggregation.count')}</MenuItem>
                <MenuItem value="sum">{t('impactMetrics.aggregation.sum')}</MenuItem>
                <MenuItem value="avg">{t('impactMetrics.aggregation.avg')}</MenuItem>
                <MenuItem value="rps">{t('impactMetrics.aggregation.rps')}</MenuItem>
                <MenuItem value="p50">P50</MenuItem>
                <MenuItem value="p95">P95</MenuItem>
                <MenuItem value="p99">P99</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          {/* Range */}
          <FormControl size="small" fullWidth>
            <InputLabel>{t('impactMetrics.defaultRange')}</InputLabel>
            <Select
              value={chartRange}
              label={t('impactMetrics.defaultRange')}
              onChange={(e: SelectChangeEvent<RangeOption>) =>
                setChartRange(e.target.value as RangeOption)
              }
            >
              <MenuItem value="hour">{t('impactMetrics.range.hour')}</MenuItem>
              <MenuItem value="day">{t('impactMetrics.range.day')}</MenuItem>
              <MenuItem value="week">{t('impactMetrics.range.week')}</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={handleSave} disabled={!metricName}>
          {initialValues ? t('common.save') : t('common.add')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== Main Component ====================

// ==================== Main Component ====================

const ImpactMetricsChart: React.FC<ImpactMetricsChartProps> = ({
  flagId,
  canManage = false,
  compact = false,
  hideTitle = false,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // State
  const [configs, setConfigs] = useState<MetricConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableMetrics, setAvailableMetrics] = useState<AvailableMetric[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Dialog state
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<MetricConfig | undefined>(undefined);

  // Expanded chart state
  const [expandedConfig, setExpandedConfig] = useState<MetricConfig | null>(null);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Fetch configs
  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const url = flagId
        ? `/admin/impact-metrics/configs/${flagId}`
        : '/admin/impact-metrics/configs/all';
      const response = await api.get<MetricConfig[]>(url);
      setConfigs(response.data || []);
    } catch (err) {
      console.error('Failed to fetch configs:', err);
    } finally {
      setLoading(false);
    }
  }, [flagId]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  // Fetch available metrics when dialog opens
  const handleOpenAddDialog = async () => {
    setEditingConfig(undefined);
    setShowConfigDialog(true);
    if (availableMetrics.length === 0) {
      setLoadingMetrics(true);
      try {
        const response = await api.get<AvailableMetric[]>('/admin/impact-metrics/available');
        setAvailableMetrics(response.data || []);
      } catch (err) {
        console.error('Failed to fetch available metrics:', err);
      } finally {
        setLoadingMetrics(false);
      }
    }
  };

  const handleOpenEditDialog = async (config: MetricConfig) => {
    setEditingConfig(config);
    setShowConfigDialog(true);
    if (availableMetrics.length === 0) {
      setLoadingMetrics(true);
      try {
        const response = await api.get<AvailableMetric[]>('/admin/impact-metrics/available');
        setAvailableMetrics(response.data || []);
      } catch (err) {
        console.error('Failed to fetch available metrics:', err);
      } finally {
        setLoadingMetrics(false);
      }
    }
  };

  // Add/Update chart config
  const handleSaveChart = async (data: {
    title: string;
    metricName: string;
    chartType: 'line' | 'area' | 'bar';
    groupBy?: string[];
    aggregationMode: string;
    chartRange: string;
  }) => {
    try {
      if (editingConfig) {
        // Update
        await api.put(`/admin/impact-metrics/configs/${editingConfig.id}`, {
          ...data,
        });
        enqueueSnackbar(t('impactMetrics.chartUpdated'), { variant: 'success' });
      } else {
        // Create
        await api.post('/admin/impact-metrics/configs', {
          flagId, // If null/undefined, backend treats as global
          ...data,
          displayOrder: configs.length,
        });
        enqueueSnackbar(t('impactMetrics.chartAdded'), { variant: 'success' });
      }
      fetchConfigs();
    } catch (err) {
      enqueueSnackbar(
        editingConfig ? t('impactMetrics.chartUpdateFailed') : t('impactMetrics.chartAddFailed'),
        { variant: 'error' }
      );
    }
  };

  // Delete chart config
  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/admin/impact-metrics/configs/${deleteId}`);
      enqueueSnackbar(t('impactMetrics.chartDeleted'), { variant: 'success' });
      setConfigs((prev) => prev.filter((c) => c.id !== deleteId));
    } catch (err) {
      enqueueSnackbar(t('impactMetrics.chartDeleteFailed'), { variant: 'error' });
    } finally {
      setDeleteId(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: hideTitle ? 0 : 2,
        }}
      >
        {!hideTitle ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ChartIcon color="primary" />
            <Typography variant={compact ? 'subtitle1' : 'h6'} fontWeight={600}>
              {t('impactMetrics.chartTitle')}
            </Typography>
            {configs.length > 0 && (
              <Chip label={configs.length} size="small" color="primary" sx={{ height: 20 }} />
            )}
          </Box>
        ) : (
          <Box />
        )}
      </Box>

      {/* Chart Grid */}
      <Box sx={{ width: '100%', overflow: 'hidden' }}>
        <Grid container spacing={3}>
          {configs.map((config) => (
            <Grid
              item
              xs={12}
              md={6}
              key={config.id}
              sx={{ minWidth: 0, display: 'flex', width: '100%' }}
            >
              <Box
                sx={{
                  width: '100%',
                  minWidth: 0,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <ChartPanel
                  config={config}
                  canManage={canManage}
                  onDelete={() => handleDeleteClick(config.id)}
                  onEdit={() => handleOpenEditDialog(config)}
                  onExpand={() => setExpandedConfig(config)}
                />
              </Box>
            </Grid>
          ))}

          {canManage && (
            <Grid item xs={12} md={6} sx={{ minWidth: 0, display: 'flex', width: '100%' }}>
              <Box sx={{ width: '100%', minWidth: 0, overflow: 'hidden' }}>
                <AddChartPlaceholder
                  onClick={handleOpenAddDialog}
                  label={t('impactMetrics.addChartPlaceholder')}
                />
              </Box>
            </Grid>
          )}
        </Grid>
      </Box>

      {/* Expanded Chart Dialog - Full Screen like Grafana */}
      <Dialog
        fullScreen
        open={!!expandedConfig}
        onClose={() => setExpandedConfig(null)}
        PaperProps={{
          sx: { bgcolor: 'background.default' },
        }}
      >
        <DialogTitle
          sx={{
            m: 0,
            p: 2,
            display: 'flex',
            alignItems: 'center',
            bgcolor: 'background.paper',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <IconButton onClick={() => setExpandedConfig(null)} sx={{ mr: 2 }}>
            <CloseIcon />
          </IconButton>
          <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>
            {expandedConfig?.title || t('impactMetrics.expandedView')}
          </Typography>
          <Button variant="outlined" onClick={() => setExpandedConfig(null)} size="small">
            {t('common.close')}
          </Button>
        </DialogTitle>
        <DialogContent sx={{ p: 3, display: 'flex', flexDirection: 'column' }}>
          {expandedConfig && (
            <Box sx={{ flex: 1, display: 'flex' }}>
              <ChartPanel config={expandedConfig} canManage={false} isExpanded={true} />
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Config Dialog */}
      <ChartConfigDialog
        open={showConfigDialog}
        onClose={() => setShowConfigDialog(false)}
        onSave={handleSaveChart}
        availableMetrics={availableMetrics}
        loadingMetrics={loadingMetrics}
        initialValues={editingConfig}
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title={t('common.deleteConfirm')}
        message={t(
          'impactMetrics.deleteConfirmMessage',
          'Are you sure you want to delete this chart?'
        )}
        confirmColor="error"
      />
    </Box>
  );
};

export default ImpactMetricsChart;
