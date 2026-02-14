/**
 * Impact Metrics Chart Panel
 *
 * Grafana-like dashboard: drag-and-drop chart layout using react-grid-layout.
 * Users can register metric chart configs, resize and reposition them freely.
 */

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Autocomplete,
  TextField,
  Button,
  IconButton,
  CircularProgress,
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
  SelectChangeEvent,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  ShowChart as ChartIcon,
  Edit as EditIcon,
  ZoomIn as ExpandIcon,
  Close as CloseIcon,
  BarChart as BarChartIcon,
  StackedLineChart as AreaChartIcon,
  Timeline as LineChartIcon,
  GridView as GridViewIcon,
  AccessTime as TimeIcon,
  Autorenew as AutorenewIcon,
  FilterList as FilterListIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
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
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - direct submodule imports for Vite CJS compatibility
import ReactGridLayout from 'react-grid-layout/build/ReactGridLayout';
// @ts-ignore
import WidthProvider from 'react-grid-layout/build/components/WidthProvider';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import api from '../../services/api';
import { useSnackbar } from 'notistack';
import ConfirmDialog from '../common/ConfirmDialog';

const GridLayout = WidthProvider(ReactGridLayout);

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
  layoutX: number;
  layoutY: number;
  layoutW: number;
  layoutH: number;
}

interface TimeSeriesSeries {
  metric: Record<string, string>;
  data: [number, number][];
}

interface TimeSeriesResponse {
  series: TimeSeriesSeries[];
}

type RangeOption = 'hour' | 'sixhour' | 'day' | 'week' | 'month';
type AggregationMode = 'rps' | 'count' | 'avg' | 'sum' | 'p50' | 'p95' | 'p99';
type ChartType = 'line' | 'area' | 'bar';

interface ImpactMetricsChartProps {
  flagId?: string;
  canManage?: boolean;
  compact?: boolean;
  hideTitle?: boolean;
}

// Grid config
const GRID_COLS = 12;
const ROW_HEIGHT = 120;
const DEFAULT_W = 6;
const DEFAULT_H = 3;
const MIN_W = 3;
const MIN_H = 2;

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
  isExpanded?: boolean;
  onChartTypeChange?: (chartType: ChartType) => void;
  globalRange: RangeOption;
  refreshKey: number;
  globalLabelFilter?: string;
}

const ChartPanel: React.FC<ChartPanelProps> = ({
  config,
  canManage,
  onDelete,
  onEdit,
  onExpand,
  isExpanded = false,
  onChartTypeChange,
  globalRange,
  refreshKey,
  globalLabelFilter,
}) => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seriesData, setSeriesData] = useState<TimeSeriesResponse | null>(null);
  const range = globalRange;
  const [localChartType, setLocalChartType] = useState<ChartType>(config.chartType);
  const hasLoadedRef = useRef(false);

  const fetchData = useCallback(async () => {
    // Only show full loading spinner on first fetch
    if (!hasLoadedRef.current) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);
    try {
      const params: any = {
        series: config.metricName,
        range,
        aggregationMode: config.aggregationMode || 'count',
      };

      // Merge config labelSelectors with global label filter
      let mergedLabels: Record<string, string[]> = {};
      if (config.labelSelectors) {
        mergedLabels = { ...config.labelSelectors };
      }
      if (globalLabelFilter) {
        globalLabelFilter.split(',').forEach((pair) => {
          const [key, val] = pair.split('=').map((s) => s.trim());
          if (key && val) {
            mergedLabels[key] = mergedLabels[key] ? [...mergedLabels[key], val] : [val];
          }
        });
      }
      if (Object.keys(mergedLabels).length > 0) {
        params.labels = JSON.stringify(mergedLabels);
      }

      if (config.groupBy && config.groupBy.length > 0) {
        params.groupBy = config.groupBy;
      }

      const response = await api.get<TimeSeriesResponse>('/admin/impact-metrics', { params });
      setSeriesData(response.data);
      hasLoadedRef.current = true;
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [
    config.metricName,
    config.aggregationMode,
    config.labelSelectors,
    config.groupBy,
    range,
    globalLabelFilter,
  ]);

  // Fetch on mount, range/filter change, or refresh trigger
  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  const handleChartTypeChange = (_: React.MouseEvent<HTMLElement>, newType: ChartType | null) => {
    if (newType) {
      setLocalChartType(newType);
      onChartTypeChange?.(newType);
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

    const locale = i18n.language === 'ko' ? 'ko-KR' : i18n.language === 'zh' ? 'zh-CN' : 'en-US';
    const formatLabel = (ts: number) => {
      const d = new Date(ts * 1000);
      if (range === 'hour' || range === 'day') {
        return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
      }
      return d.toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    };

    const labels = sorted.map(formatLabel);
    const datasets = seriesData.series.map((s, idx) => {
      const color = SERIES_COLORS[idx % SERIES_COLORS.length];
      const tsMap = new Map(s.data.map(([ts, val]) => [ts, val]));

      let label = config.metricName;
      if (config.groupBy && config.groupBy.length > 0) {
        const groupParts = config.groupBy.map((key) => s.metric[key] || '').filter((v) => v);
        if (groupParts.length > 0) {
          label = groupParts.join(' / ');
        }
      } else {
        const metricLabels = Object.entries(s.metric || {}).filter(([k]) => k !== '__name__');
        if (metricLabels.length > 0 && metricLabels.length < 3) {
          label = metricLabels.map(([k, v]) => `${k}=${v}`).join(', ');
        } else if (metricLabels.length >= 3) {
          label = `${config.metricName} (${idx + 1})`;
        }
      }

      return {
        label,
        data: sorted.map((ts) => tsMap.get(ts) ?? null),
        borderColor: color.border,
        backgroundColor: localChartType === 'line' ? color.bg.replace('0.4', '0.1') : color.bg,
        borderWidth: 2,
        tension: 0.3,
        pointRadius: isExpanded ? 2 : 1,
        pointHoverRadius: 4,
        fill: localChartType === 'area',
        spanGaps: true,
      };
    });

    return { labels, datasets };
  }, [seriesData, range, config, localChartType, isExpanded]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false as const,
      interaction: { mode: 'index' as const, intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'bottom' as const,
          labels: {
            color: theme.palette.text.primary,
            usePointStyle: true,
            padding: isExpanded ? 16 : 12,
            font: { size: isExpanded ? 13 : 12 },
            boxWidth: 10,
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
            font: { size: isExpanded ? 11 : 10 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: isExpanded ? 16 : 8,
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
          },
          ticks: {
            color: theme.palette.text.secondary,
            font: { size: isExpanded ? 11 : 10 },
          },
        },
      },
    }),
    [theme, isExpanded]
  );

  const hasData = chartData.datasets.length > 0;

  return (
    <Paper
      elevation={isExpanded ? 0 : 3}
      sx={{
        borderRadius: isExpanded ? 0 : 3,
        height: '100%',
        width: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 0.2s',
        position: 'relative',
      }}
    >
      {/* Header - title bar style */}
      <Box
        className="chart-drag-handle"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 0.8,
          minWidth: 0,
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
          borderBottom: `1px solid ${theme.palette.divider}`,
          borderRadius: isExpanded ? 0 : '12px 12px 0 0',
          cursor: canManage ? 'grab' : 'default',
          '&:active': canManage ? { cursor: 'grabbing' } : {},
        }}
      >
        {/* Left: icon + title (truncated) */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: theme.palette.primary.main + '15',
              color: theme.palette.primary.main,
            }}
          >
            <ChartIcon sx={{ fontSize: 16 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Tooltip title={config.title} enterDelay={500}>
              <Typography
                variant="subtitle2"
                fontWeight={600}
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'block',
                  lineHeight: 1.3,
                }}
              >
                {config.title}
              </Typography>
            </Tooltip>
            <Tooltip title={config.metricName} enterDelay={500}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'block',
                  lineHeight: 1.2,
                }}
              >
                {config.metricName}
              </Typography>
            </Tooltip>
          </Box>
        </Box>

        {/* Right: action icons */}
        <Box
          className="no-drag"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.25,
            flexShrink: 0,
            ml: 0.5,
          }}
        >
          <Chip
            label={config.aggregationMode.toUpperCase()}
            size="small"
            variant="filled"
            color="default"
            sx={{
              height: 18,
              fontSize: '0.6rem',
              bgcolor: theme.palette.action.selected,
              '& .MuiChip-label': { px: 0.6 },
            }}
          />
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          {/* Chart type toggle */}
          <ToggleButtonGroup
            size="small"
            value={localChartType}
            exclusive
            onChange={handleChartTypeChange}
            sx={{
              '& .MuiToggleButton-root': {
                py: 0.1,
                px: 0.4,
                border: `1px solid ${theme.palette.divider}`,
                '&.Mui-selected': {
                  bgcolor: theme.palette.primary.main + '15',
                  color: theme.palette.primary.main,
                  borderColor: theme.palette.primary.main + '40',
                },
              },
            }}
          >
            <ToggleButton value="line">
              <Tooltip title={t('impactMetrics.chartType.line')}>
                <LineChartIcon sx={{ fontSize: 14 }} />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="area">
              <Tooltip title={t('impactMetrics.chartType.area')}>
                <AreaChartIcon sx={{ fontSize: 14 }} />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="bar">
              <Tooltip title={t('impactMetrics.chartType.bar')}>
                <BarChartIcon sx={{ fontSize: 14 }} />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          {!isExpanded && (
            <Tooltip title={t('common.expand')}>
              <IconButton size="small" onClick={onExpand} sx={{ p: 0.4 }}>
                <ExpandIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={t('common.refresh')}>
            <span>
              <IconButton size="small" onClick={fetchData} disabled={loading} sx={{ p: 0.4 }}>
                <RefreshIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>
          {canManage && !isExpanded && (
            <>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              {onEdit && (
                <Tooltip title={t('common.edit')}>
                  <IconButton size="small" onClick={onEdit} sx={{ p: 0.4 }}>
                    <EditIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              )}
              {onDelete && (
                <Tooltip title={t('common.delete')}>
                  <IconButton size="small" onClick={onDelete} color="error" sx={{ p: 0.4 }}>
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              )}
            </>
          )}
        </Box>
      </Box>

      {/* Content Area */}
      <Box sx={{ flex: 1, minHeight: 0, position: 'relative', px: 1.5, pb: 1 }}>
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
            }}
          >
            <Typography variant="body2" fontWeight={500}>
              {t('impactMetrics.noData')}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ height: '100%' }}>
            {localChartType === 'bar' ? (
              <Bar data={chartData} options={chartOptions} redraw={false} />
            ) : (
              <Line data={chartData} options={chartOptions} redraw={false} />
            )}
          </Box>
        )}
      </Box>
    </Paper>
  );
};

const MemoChartPanel = React.memo(ChartPanel);

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

  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const [loadingLabels, setLoadingLabels] = useState(false);

  useEffect(() => {
    if (open && initialValues) {
      setTitle(initialValues.title);
      setMetricName(initialValues.metricName);
      setChartType(initialValues.chartType);
      setGroupBy(initialValues.groupBy || []);
      setAggregationMode(initialValues.aggregationMode as AggregationMode);
    } else if (open && !initialValues) {
      setTitle('');
      setMetricName('');
      setChartType('line');
      setGroupBy([]);
      setAggregationMode('count');
    }
  }, [open, initialValues]);

  useEffect(() => {
    if (!metricName) {
      setAvailableLabels([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingLabels(true);
      try {
        const response = await api.get<string[]>('/admin/impact-metrics/labels', {
          params: { metric: metricName },
        });
        setAvailableLabels(response.data || []);
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
                autoFocus
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

          <TextField
            label={t('impactMetrics.chartTitle')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={metricName || t('impactMetrics.chartTitlePlaceholder')}
            helperText={t('impactMetrics.chartTitleHelp')}
          />

          <Stack direction="row" spacing={2}>
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

const ImpactMetricsChart: React.FC<ImpactMetricsChartProps> = ({
  flagId,
  canManage = false,
  compact = false,
  hideTitle = false,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
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

  // Auto-arrange confirm
  const [showAutoArrangeConfirm, setShowAutoArrangeConfirm] = useState(false);

  // Global label filter (applied to all charts, debounced)
  const [labelFilterInput, setLabelFilterInput] = useState<string>('');
  const [debouncedLabelFilter, setDebouncedLabelFilter] = useState<string>('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLabelFilter(labelFilterInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [labelFilterInput]);

  // URL params + localStorage persistence for dashboard controls
  const [searchParams, setSearchParams] = useSearchParams();
  const STORAGE_KEY = 'impactMetrics';
  const validRanges: RangeOption[] = ['hour', 'sixhour', 'day', 'week', 'month'];
  const validIntervals = [0, 5, 10, 30, 60, 300];

  const resolveInitialRange = (): RangeOption => {
    const fromUrl = searchParams.get('range');
    if (fromUrl && validRanges.includes(fromUrl as RangeOption)) return fromUrl as RangeOption;
    const fromStorage = localStorage.getItem(`${STORAGE_KEY}.range`);
    if (fromStorage && validRanges.includes(fromStorage as RangeOption))
      return fromStorage as RangeOption;
    return 'hour';
  };

  const resolveInitialRefresh = (): number => {
    const fromUrl = searchParams.get('refresh');
    if (fromUrl !== null) {
      const val = Number(fromUrl);
      if (validIntervals.includes(val)) return val;
    }
    const fromStorage = localStorage.getItem(`${STORAGE_KEY}.refresh`);
    if (fromStorage !== null) {
      const val = Number(fromStorage);
      if (validIntervals.includes(val)) return val;
    }
    return 30;
  };

  // Global dashboard controls (Grafana-style)
  const [globalRange, setGlobalRangeState] = useState<RangeOption>(resolveInitialRange);
  const [refreshInterval, setRefreshIntervalState] = useState<number>(resolveInitialRefresh);
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync to URL params + localStorage on change
  const setGlobalRange = useCallback(
    (range: RangeOption) => {
      setGlobalRangeState(range);
      localStorage.setItem(`${STORAGE_KEY}.range`, range);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('range', range);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const setRefreshInterval = useCallback(
    (interval: number) => {
      setRefreshIntervalState(interval);
      localStorage.setItem(`${STORAGE_KEY}.refresh`, String(interval));
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('refresh', String(interval));
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  // Auto-refresh timer
  useEffect(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (refreshInterval > 0) {
      refreshTimerRef.current = setInterval(() => {
        setRefreshKey((k) => k + 1);
      }, refreshInterval * 1000);
    }
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [refreshInterval]);

  // Manual refresh
  const handleManualRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Track refreshing state for toolbar spinner
  const [globalRefreshing, setGlobalRefreshing] = useState(false);
  useEffect(() => {
    if (refreshKey === 0) return; // Skip initial mount
    setGlobalRefreshing(true);
    const timer = setTimeout(() => setGlobalRefreshing(false), 2000);
    return () => clearTimeout(timer);
  }, [refreshKey]);

  // Suppress transition on initial mount (prevents WidthProvider resize flash)
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 300);
    return () => clearTimeout(timer);
  }, []);

  // Layout save debounce
  const layoutSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Key to force GridLayout remount when auto-arrange is triggered
  const [gridKey, setGridKey] = useState(0);

  // Save layout to server (debounced)
  const saveLayoutToServer = useCallback(
    (newLayout: Layout[]) => {
      if (!canManage) return;
      if (layoutSaveTimerRef.current) {
        clearTimeout(layoutSaveTimerRef.current);
      }
      layoutSaveTimerRef.current = setTimeout(async () => {
        try {
          await api.put('/admin/impact-metrics/configs/layouts', {
            layouts: newLayout.map((l) => ({
              id: l.i,
              x: l.x,
              y: l.y,
              w: l.w,
              h: l.h,
            })),
          });
        } catch (err) {
          console.error('Failed to save layout:', err);
        }
      }, 800);
    },
    [canManage]
  );

  // Sync final positions to configs + save when drag/resize completes
  const handleDragResizeStop = useCallback(
    (newLayout: Layout[]) => {
      setConfigs((prev) =>
        prev.map((config) => {
          const layoutItem = newLayout.find((l) => l.i === config.id);
          if (layoutItem) {
            return {
              ...config,
              layoutX: layoutItem.x,
              layoutY: layoutItem.y,
              layoutW: layoutItem.w,
              layoutH: layoutItem.h,
            };
          }
          return config;
        })
      );
      saveLayoutToServer(newLayout);
    },
    [saveLayoutToServer]
  );

  // Auto-arrange: reset to 2-column grid pattern
  const handleAutoArrange = useCallback(() => {
    setConfigs((prev) =>
      prev.map((config, idx) => ({
        ...config,
        layoutX: (idx % 2) * DEFAULT_W,
        layoutY: Math.floor(idx / 2) * DEFAULT_H,
        layoutW: DEFAULT_W,
        layoutH: DEFAULT_H,
      }))
    );
    // Force remount to pick up new data-grid values
    setGridKey((k) => k + 1);
    const newLayout: Layout[] = configs.map((config, idx) => ({
      i: config.id,
      x: (idx % 2) * DEFAULT_W,
      y: Math.floor(idx / 2) * DEFAULT_H,
      w: DEFAULT_W,
      h: DEFAULT_H,
      minW: MIN_W,
      minH: MIN_H,
    }));
    saveLayoutToServer(newLayout);
  }, [configs, saveLayoutToServer]);

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

  const handleSaveChart = async (data: {
    title: string;
    metricName: string;
    chartType: 'line' | 'area' | 'bar';
    groupBy?: string[];
    aggregationMode: string;
  }) => {
    try {
      if (editingConfig) {
        await api.put(`/admin/impact-metrics/configs/${editingConfig.id}`, { ...data });
        enqueueSnackbar(t('impactMetrics.chartUpdated'), { variant: 'success' });
      } else {
        // Find the next available position
        const maxY = configs.reduce((max, c) => Math.max(max, c.layoutY + c.layoutH), 0);
        await api.post('/admin/impact-metrics/configs', {
          flagId,
          ...data,
          displayOrder: configs.length,
          layoutX: 0,
          layoutY: maxY,
          layoutW: DEFAULT_W,
          layoutH: DEFAULT_H,
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

  const handleChartTypeChange = async (configId: string, chartType: ChartType) => {
    try {
      await api.put(`/admin/impact-metrics/configs/${configId}`, { chartType });
      setConfigs((prev) => prev.map((c) => (c.id === configId ? { ...c, chartType } : c)));
    } catch (err) {
      console.error('Failed to update chart type:', err);
    }
  };

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

  // No charts
  if (configs.length === 0) {
    return (
      <Box>
        {!hideTitle && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <ChartIcon color="primary" />
            <Typography variant={compact ? 'subtitle1' : 'h6'} fontWeight={600}>
              {t('impactMetrics.chartTitle')}
            </Typography>
          </Box>
        )}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 8,
            color: 'text.secondary',
          }}
        >
          <Typography variant="body1" sx={{ mb: 2 }}>
            {t('impactMetrics.noCharts')}
          </Typography>
          {canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAddDialog}>
              {t('impactMetrics.addChart')}
            </Button>
          )}
        </Box>

        <ChartConfigDialog
          open={showConfigDialog}
          onClose={() => setShowConfigDialog(false)}
          onSave={handleSaveChart}
          availableMetrics={availableMetrics}
          loadingMetrics={loadingMetrics}
          initialValues={editingConfig}
        />
      </Box>
    );
  }

  return (
    <Box>
      {/* Grafana-style Dashboard Toolbar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
          gap: 1,
        }}
      >
        {/* Left: Title */}
        {!hideTitle && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ChartIcon color="primary" />
            <Typography variant={compact ? 'subtitle1' : 'h6'} fontWeight={600}>
              {t('impactMetrics.chartTitle')}
            </Typography>
            <Chip label={configs.length} size="small" color="primary" sx={{ height: 20 }} />
          </Box>
        )}

        {/* Right: Global Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
          {/* Label Filter */}
          <TextField
            size="small"
            placeholder={t('impactMetrics.labelFilter')}
            value={labelFilterInput}
            onChange={(e) => setLabelFilterInput(e.target.value)}
            InputProps={{
              startAdornment: (
                <FilterListIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
              ),
            }}
            sx={{
              minWidth: 160,
              '& .MuiInputBase-root': { height: 30, fontSize: '0.8rem' },
              '& .MuiInputBase-input': { py: 0.3 },
            }}
          />

          {/* Divider */}
          <Box sx={{ width: 1, height: 24, bgcolor: theme.palette.divider }} />
          {/* Time Range Picker */}
          <ToggleButtonGroup
            size="small"
            value={globalRange}
            exclusive
            onChange={(_, v) => v && setGlobalRange(v)}
            sx={{
              '& .MuiToggleButton-root': {
                py: 0.3,
                px: 1,
                fontSize: '0.75rem',
                height: 30,
                textTransform: 'none',
                border: `1px solid ${theme.palette.divider}`,
                '&.Mui-selected': {
                  bgcolor: theme.palette.primary.main,
                  color: '#fff',
                  '&:hover': { bgcolor: theme.palette.primary.dark },
                },
              },
            }}
          >
            <ToggleButton value="hour">1h</ToggleButton>
            <ToggleButton value="sixhour">6h</ToggleButton>
            <ToggleButton value="day">24h</ToggleButton>
            <ToggleButton value="week">7d</ToggleButton>
            <ToggleButton value="month">30d</ToggleButton>
          </ToggleButtonGroup>

          {/* Divider */}
          <Box sx={{ width: 1, height: 24, bgcolor: theme.palette.divider }} />

          {/* Auto-Refresh Selector */}
          <FormControl size="small" sx={{ minWidth: 80 }}>
            <Select
              value={refreshInterval}
              onChange={(e: SelectChangeEvent<number>) =>
                setRefreshInterval(e.target.value as number)
              }
              variant="outlined"
              sx={{
                height: 30,
                fontSize: '0.75rem',
                '& .MuiSelect-select': { py: 0.3, display: 'flex', alignItems: 'center', gap: 0.5 },
              }}
              renderValue={(val) => (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AutorenewIcon sx={{ fontSize: 14 }} />
                  {val === 0 ? 'Off' : val < 60 ? `${val}s` : `${val / 60}m`}
                </Box>
              )}
            >
              <MenuItem value={0}>Off</MenuItem>
              <MenuItem value={5}>5s</MenuItem>
              <MenuItem value={10}>10s</MenuItem>
              <MenuItem value={30}>30s</MenuItem>
              <MenuItem value={60}>1m</MenuItem>
              <MenuItem value={300}>5m</MenuItem>
            </Select>
          </FormControl>

          {/* Manual Refresh */}
          <Tooltip title={t('common.refresh')}>
            <IconButton size="small" onClick={handleManualRefresh} sx={{ p: 0.5 }}>
              <RefreshIcon
                fontSize="small"
                sx={{
                  ...(globalRefreshing && {
                    animation: 'toolbar-spin 1s linear infinite',
                    '@keyframes toolbar-spin': {
                      '0%': { transform: 'rotate(0deg)' },
                      '100%': { transform: 'rotate(360deg)' },
                    },
                  }),
                }}
              />
            </IconButton>
          </Tooltip>

          {/* Divider */}
          <Box sx={{ width: 1, height: 24, bgcolor: theme.palette.divider }} />

          {/* Auto-arrange */}
          {canManage && (
            <Tooltip title={t('impactMetrics.autoArrange')}>
              <IconButton size="small" onClick={() => setShowAutoArrangeConfirm(true)}>
                <GridViewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {/* Add Chart */}
          {canManage && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleOpenAddDialog}
              sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {t('impactMetrics.addChart')}
            </Button>
          )}
        </Box>
      </Box>

      {/* react-grid-layout Dashboard */}
      <Box
        sx={{
          // Override react-grid-layout styles for themed look
          '& .react-grid-item.react-grid-placeholder': {
            bgcolor: theme.palette.primary.main + '20',
            borderRadius: 3,
            border: `2px dashed ${theme.palette.primary.main}`,
            opacity: 0.6,
          },
          // Disable transition during drag/resize to prevent offset jump
          '& .react-grid-item.react-draggable-dragging': {
            transition: 'none !important',
            zIndex: 100,
          },
          '& .react-grid-item.resizing': {
            transition: 'none !important',
          },
          // Suppress initial mount transition (WidthProvider measurement)
          ...(!isMounted && {
            '& .react-grid-item': {
              transition: 'none !important',
            },
          }),
          // Draggable cursor for resize handle
          '& .react-grid-item > .react-resizable-handle': {
            backgroundImage: 'none',
            cursor: 'se-resize',
            '&::after': {
              content: '""',
              position: 'absolute',
              right: 4,
              bottom: 4,
              width: 10,
              height: 10,
              borderRight: `2px solid ${theme.palette.text.disabled}`,
              borderBottom: `2px solid ${theme.palette.text.disabled}`,
              borderRadius: '0 0 2px 0',
            },
          },
        }}
      >
        <GridLayout
          key={gridKey}
          className="layout"
          cols={GRID_COLS}
          rowHeight={ROW_HEIGHT}
          isDraggable={canManage}
          isResizable={canManage}
          onDragStop={(_layout: Layout[]) => handleDragResizeStop(_layout)}
          onResizeStop={(_layout: Layout[]) => handleDragResizeStop(_layout)}
          compactType="vertical"
          margin={[16, 16]}
          containerPadding={[0, 0]}
          useCSSTransforms
          draggableCancel=".no-drag"
          draggableHandle=".chart-drag-handle"
        >
          {configs.map((config, idx) => (
            <div
              key={config.id}
              data-grid={{
                x: config.layoutX ?? (idx % 2) * DEFAULT_W,
                y: config.layoutY ?? Math.floor(idx / 2) * DEFAULT_H,
                w: config.layoutW ?? DEFAULT_W,
                h: config.layoutH ?? DEFAULT_H,
                minW: MIN_W,
                minH: MIN_H,
              }}
            >
              <MemoChartPanel
                config={config}
                canManage={canManage}
                onDelete={() => handleDeleteClick(config.id)}
                onEdit={() => handleOpenEditDialog(config)}
                onExpand={() => setExpandedConfig(config)}
                onChartTypeChange={(chartType) => handleChartTypeChange(config.id, chartType)}
                globalRange={globalRange}
                refreshKey={refreshKey}
                globalLabelFilter={debouncedLabelFilter}
              />
            </div>
          ))}
        </GridLayout>
      </Box>

      {/* Expanded Chart Dialog */}
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
            py: 1.5,
            px: 2,
            display: 'flex',
            alignItems: 'center',
            bgcolor: 'background.paper',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <IconButton onClick={() => setExpandedConfig(null)} sx={{ mr: 1.5 }}>
            <CloseIcon />
          </IconButton>
          <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>
            {expandedConfig?.title || t('impactMetrics.expandedView')}
          </Typography>
          <Button variant="outlined" onClick={() => setExpandedConfig(null)} size="small">
            {t('common.close')}
          </Button>
        </DialogTitle>
        <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
          {expandedConfig && (
            <Box sx={{ flex: 1, display: 'flex', p: 2 }}>
              <ChartPanel
                config={expandedConfig}
                canManage={false}
                isExpanded={true}
                onChartTypeChange={(chartType) =>
                  handleChartTypeChange(expandedConfig.id, chartType)
                }
                globalRange={globalRange}
                refreshKey={refreshKey}
                globalLabelFilter={debouncedLabelFilter}
              />
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

      {/* Auto Arrange Confirm Dialog */}
      <ConfirmDialog
        open={showAutoArrangeConfirm}
        onClose={() => setShowAutoArrangeConfirm(false)}
        onConfirm={() => {
          setShowAutoArrangeConfirm(false);
          handleAutoArrange();
        }}
        title={t('impactMetrics.autoArrange')}
        message={t('impactMetrics.autoArrangeConfirmMessage')}
      />
    </Box>
  );
};

export default ImpactMetricsChart;
