import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  Box,
  Card,
  Chip,
  Stack,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  alpha,
  useTheme,
  IconButton,
  Tooltip,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import DateRangeSelector, {
  DateRangeValue,
  presetToHours,
  dateRangeToDatePair,
} from '../common/DateRangeSelector';
import {
  People as PeopleIcon,
  SmartToy as BotIcon,
  Groups as AllIcon,
  Visibility as LegendOnIcon,
  VisibilityOff as LegendOffIcon,
  BarChart as BarChartIcon,
  StackedBarChart as StackedBarChartIcon,
  ShowChart as LineChartIcon,
  Timeline as AreaChartIcon,
  StackedLineChart as StackedAreaChartIcon,
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
import { Chart } from 'react-chartjs-2';
import useLocalStorage from '../../hooks/useLocalStorage';
import playerConnectionService from '../../services/playerConnectionService';
import type { CcuHistoryRecord } from '../../services/playerConnectionService';
import PageContentLoader from '../common/PageContentLoader';
import EmptyPlaceholder from '../common/EmptyPlaceholder';
import { crosshairPlugin } from '../../utils/chartCrosshairPlugin';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  ChartTooltip,
  Legend,
  Filler,
  crosshairPlugin
);

const WORLD_COLORS = [
  { border: '#2196f3', bg: 'rgba(33,150,243,0.1)' },
  { border: '#4caf50', bg: 'rgba(76,175,80,0.1)' },
  { border: '#ff9800', bg: 'rgba(255,152,0,0.1)' },
  { border: '#e91e63', bg: 'rgba(233,30,99,0.1)' },
  { border: '#9c27b0', bg: 'rgba(156,39,176,0.1)' },
  { border: '#00bcd4', bg: 'rgba(0,188,212,0.1)' },
  { border: '#795548', bg: 'rgba(121,85,72,0.1)' },
  { border: '#607d8b', bg: 'rgba(96,125,139,0.1)' },
];

// --- CcuHistoryTable: 10-minute bucket aggregation ---
interface BucketRow {
  time: string; // e.g. "04/21 10:30"
  total: number;
  bots: number;
  worlds: { name: string; count: number; bots: number }[];
}

const CcuHistoryTable: React.FC<{ records: CcuHistoryRecord[] }> = ({
  records,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const buckets = useMemo(() => {
    if (records.length === 0) return [];

    // Only use total records (worldId === null)
    const totalRecords = records.filter((r) => r.worldId === null);
    const worldRecords = records.filter((r) => r.worldId !== null);

    // Group totals into 10-minute buckets
    const bucketMap = new Map<string, BucketRow>();

    totalRecords.forEach((r) => {
      const d = new Date(r.recordedAt);
      // Round down to 10-min bucket
      const mins = Math.floor(d.getMinutes() / 10) * 10;
      d.setMinutes(mins, 0, 0);
      const key = d.toISOString();
      const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

      if (!bucketMap.has(key)) {
        bucketMap.set(key, {
          time: label,
          total: r.playerCount,
          bots: r.botCount || 0,
          worlds: [],
        });
      } else {
        // Keep the latest value in the bucket
        const existing = bucketMap.get(key)!;
        existing.total = Math.max(existing.total, r.playerCount);
        existing.bots = Math.max(existing.bots, r.botCount || 0);
      }
    });

    // Attach per-world data to each bucket
    worldRecords.forEach((r) => {
      const d = new Date(r.recordedAt);
      const mins = Math.floor(d.getMinutes() / 10) * 10;
      d.setMinutes(mins, 0, 0);
      const key = d.toISOString();
      const bucket = bucketMap.get(key);
      if (!bucket) return;

      const existingWorld = bucket.worlds.find(
        (w) => w.name === (r.worldName || r.worldId)
      );
      if (existingWorld) {
        existingWorld.count = Math.max(existingWorld.count, r.playerCount);
        existingWorld.bots = Math.max(existingWorld.bots, r.botCount || 0);
      } else {
        bucket.worlds.push({
          name: r.worldName || r.worldId || '?',
          count: r.playerCount,
          bots: r.botCount || 0,
        });
      }
    });

    // Sort descending (most recent first)
    return Array.from(bucketMap.values()).sort((a, b) =>
      b.time > a.time ? 1 : -1
    );
  }, [records]);

  // Collect all unique world names
  const worldNames = useMemo(() => {
    const names = new Set<string>();
    buckets.forEach((b) => b.worlds.forEach((w) => names.add(w.name)));
    return Array.from(names).sort();
  }, [buckets]);

  if (buckets.length === 0) return null;

  return (
    <Card variant="outlined" sx={{ mt: 2 }}>
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="subtitle2" fontWeight={600}>
          {t('playerConnections.ccuGraph.historyTable')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('playerConnections.ccuGraph.historyTableDesc', {
            count: buckets.length,
          })}
        </Typography>
      </Box>
      <TableContainer sx={{ maxHeight: 400 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  py: 1,
                  bgcolor: 'background.paper',
                }}
              >
                {t('playerConnections.ccuGraph.colTime')}
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  py: 1,
                  bgcolor: 'background.paper',
                }}
              >
                {t('playerConnections.ccuGraph.colTotal')}
              </TableCell>
              {worldNames.map((name) => (
                <TableCell
                  key={name}
                  align="right"
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    py: 1,
                    bgcolor: 'background.paper',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {name}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {buckets.map((row, idx) => (
              <TableRow
                key={row.time}
                sx={{
                  bgcolor:
                    idx % 2 === 0
                      ? 'transparent'
                      : alpha(theme.palette.action.hover, 0.3),
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <TableCell
                  sx={{
                    fontSize: '0.75rem',
                    py: 0.75,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.time}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontSize: '0.75rem',
                    py: 0.75,
                    fontWeight: 700,
                    color: 'primary.main',
                  }}
                >
                  {row.total.toLocaleString()}
                </TableCell>
                {worldNames.map((name) => {
                  const w = row.worlds.find((x) => x.name === name);
                  return (
                    <TableCell
                      key={name}
                      align="right"
                      sx={{
                        fontSize: '0.75rem',
                        py: 0.75,
                        color:
                          w && w.count > 0 ? 'text.primary' : 'text.disabled',
                      }}
                    >
                      {w ? w.count.toLocaleString() : '-'}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
};

interface Props {
  projectApiPath: string;
  refreshKey?: number;
}

const CcuGraphTab: React.FC<Props> = ({ projectApiPath, refreshKey }) => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [chartType, setChartType] = useLocalStorage<
    'bar' | 'stacked-bar' | 'line' | 'area' | 'stacked-area'
  >('playerConnections.ccuGraph.chartType', 'line');
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<CcuHistoryRecord[]>([]);
  const [dateRange, setDateRangeRaw] = useState<DateRangeValue>(() => {
    const fromUrl = searchParams.get('range');
    const fromStorage = localStorage.getItem('ccu-time-range');
    const preset = fromUrl || fromStorage || '24h';
    return { type: 'preset', preset };
  });
  const setDateRange = useCallback((v: DateRangeValue) => {
    setDateRangeRaw(v);
    if (v.type === 'preset' && v.preset) {
      localStorage.setItem('ccu-time-range', v.preset);
    }
  }, []);
  const [displayMode, setDisplayModeRaw] = useState<'all' | 'users' | 'bots'>(
    () =>
      (localStorage.getItem('ccu-display-mode') as 'all' | 'users' | 'bots') ||
      'all'
  );
  const setDisplayMode = useCallback((v: 'all' | 'users' | 'bots') => {
    setDisplayModeRaw(v);
    localStorage.setItem('ccu-display-mode', v);
  }, []);
  const [showLegend, setShowLegendRaw] = useState(
    () => localStorage.getItem('ccu-show-legend') !== 'false'
  );
  const setShowLegend = useCallback((v: boolean) => {
    setShowLegendRaw(v);
    localStorage.setItem('ccu-show-legend', String(v));
  }, []);

  const getDateRange = useCallback(() => {
    const { start, end } = dateRangeToDatePair(dateRange);
    return { from: start, to: end };
  }, [dateRange]);

  // Track whether we've done the initial load (to avoid showing loading skeleton on refreshes)
  const hasLoadedRef = useRef(false);
  const prevGetDateRangeRef = useRef(getDateRange);

  const loadHistory = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      try {
        const { from, to } = getDateRange();
        const data = await playerConnectionService.getCcuHistory(
          projectApiPath,
          {
            from: from.toISOString(),
            to: to.toISOString(),
          }
        );
        setRecords(data);
        hasLoadedRef.current = true;
      } catch (err) {
        console.error('CCU history load failed:', err);
      } finally {
        setLoading(false);
      }
    },
    [projectApiPath, getDateRange]
  );

  // Initial load or time range change ??show loading skeleton
  useEffect(() => {
    // Show loading skeleton only if time range changed or it's the first load
    const rangeChanged = prevGetDateRangeRef.current !== getDateRange;
    prevGetDateRangeRef.current = getDateRange;
    loadHistory(!hasLoadedRef.current || rangeChanged);
  }, [loadHistory]);

  // Periodic refresh via refreshKey ??update data silently without resetting chart
  const prevRefreshKeyRef = useRef(refreshKey);
  useEffect(() => {
    if (prevRefreshKeyRef.current !== refreshKey && hasLoadedRef.current) {
      prevRefreshKeyRef.current = refreshKey;
      loadHistory(false);
    }
  }, [refreshKey, loadHistory]);

  // Persist range to URL
  useEffect(() => {
    const currentTab = searchParams.get('tab') || 'overview';
    if (currentTab !== 'ccu-graph') return;

    const params = new URLSearchParams(searchParams);
    const preset =
      dateRange.type === 'preset' ? dateRange.preset || '24h' : 'custom';
    if (preset !== '24h') params.set('range', preset);
    else params.delete('range');
    params.set('tab', 'ccu-graph');
    setSearchParams(params, { replace: true });
  }, [dateRange, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build chart data
  const chartData = useMemo(() => {
    if (records.length === 0) return { labels: [], datasets: [] };

    // Group by worldId
    const groups = new Map<string, CcuHistoryRecord[]>();
    records.forEach((r) => {
      const key = r.worldId ?? '__total__';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    });

    // Use total's timestamps as labels
    const totalRecords = groups.get('__total__') || [];
    const labels = totalRecords.map((r) => {
      const d = new Date(r.recordedAt);
      return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    });

    const datasets: any[] = [];

    // Total line (always first, bold)
    if (totalRecords.length > 0) {
      if (displayMode === 'all' || displayMode === 'users') {
        datasets.push({
          label:
            displayMode === 'users'
              ? t('playerConnections.ccu.total') + ' (Users)'
              : t('playerConnections.ccu.total'),
          data: totalRecords.map((r) => r.playerCount),
          borderColor: '#1976d2',
          backgroundColor: 'rgba(25,118,210,0.15)',
          borderWidth: 3,
          tension: 0.3,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4,
          spanGaps: true,
        });
      }
      if (displayMode === 'all' || displayMode === 'bots') {
        datasets.push({
          label:
            displayMode === 'bots'
              ? t('playerConnections.ccu.total') + ' (Bots)'
              : t('playerConnections.ccu.botTotal'),
          data: totalRecords.map((r) => r.botCount || 0),
          borderColor: '#9c27b0',
          backgroundColor: 'rgba(156,39,176,0.10)',
          borderWidth: 2,
          tension: 0.3,
          fill: displayMode === 'bots',
          borderDash: displayMode === 'all' ? [5, 3] : undefined,
          pointRadius: 0,
          pointHoverRadius: 4,
          spanGaps: true,
        });
      }
    }

    // Per-world lines
    let colorIdx = 0;
    groups.forEach((recs, key) => {
      if (key === '__total__') return;
      const c = WORLD_COLORS[colorIdx % WORLD_COLORS.length];
      if (displayMode === 'all' || displayMode === 'users') {
        datasets.push({
          label:
            (recs[0]?.worldName || key) + (displayMode === 'all' ? '' : ''),
          data: recs.map((r) => r.playerCount),
          borderColor: c.border,
          backgroundColor: c.bg,
          borderWidth: 1.5,
          tension: 0.3,
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 3,
          spanGaps: true,
        });
      }
      if (displayMode === 'bots') {
        datasets.push({
          label: (recs[0]?.worldName || key) + ' (Bot)',
          data: recs.map((r) => r.botCount || 0),
          borderColor: c.border,
          backgroundColor: c.bg,
          borderWidth: 1.5,
          tension: 0.3,
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 3,
          spanGaps: true,
        });
      }
      colorIdx++;
    });

    const finalDatasets = datasets.map((ds) => {
      const isBar = chartType === 'bar' || chartType === 'stacked-bar';
      const isArea = chartType === 'area' || chartType === 'stacked-area';
      return {
        ...ds,
        type: isBar ? 'bar' : 'line',
        fill: isArea,
        backgroundColor: isBar || isArea ? ds.backgroundColor : 'transparent',
        borderWidth: isBar ? 0 : ds.borderWidth || 2,
        borderRadius: isBar ? 4 : 0,
      };
    });

    return { labels, datasets: finalDatasets };
  }, [records, t, displayMode, chartType]);

  const isStacked = chartType === 'stacked-bar' || chartType === 'stacked-area';

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false as const,
      plugins: {
        legend: { display: showLegend, position: 'top' as const },
        tooltip: { mode: 'index' as const, intersect: false },
      },
      scales: {
        x: {
          stacked: isStacked,
          grid: { display: true, color: 'rgba(0,0,0,0.05)' },
          ticks: {
            maxRotation: 45,
            minRotation: 45,
            autoSkip: true,
            maxTicksLimit: 16,
          },
        },
        y: {
          stacked: isStacked,
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.05)' }
        },
      },
      interaction: {
        mode: 'nearest' as const,
        axis: 'x' as const,
        intersect: false,
      },
    }),
    [showLegend, isStacked]
  );

  return (
    <Box>
      <Paper
        variant="outlined"
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 1,
          px: 1.5,
          mb: 2,
          bgcolor: (theme) => alpha(theme.palette.action.hover, 0.04),
          borderRadius: 2.5,
          borderColor: 'divider',
          flexWrap: 'wrap',
          gap: 1.5,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <ToggleButtonGroup
            value={displayMode}
            exclusive
            onChange={(_, val) => val && setDisplayMode(val)}
            size="small"
            sx={{
              bgcolor: 'background.paper',
              borderRadius: 2,
              border: 1,
              borderColor: 'divider',
              p: 0.25,
              '& .MuiToggleButton-root': {
                px: 1.5,
                py: 0.35,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.8125rem',
                border: 'none',
                borderRadius: 1.5,
                color: 'text.secondary',
                gap: 0.5,
                '&.Mui-selected': {
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                  color: 'primary.main',
                  '&:hover': {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                  },
                },
              },
            }}
          >
            <ToggleButton value="all">
              <AllIcon sx={{ fontSize: 16 }} />
              {t('playerConnections.ccuGraph.all')}
            </ToggleButton>
            <ToggleButton value="users">
              <PeopleIcon sx={{ fontSize: 16 }} />
              {t('playerConnections.ccuGraph.usersOnly')}
            </ToggleButton>
            <ToggleButton value="bots">
              <BotIcon sx={{ fontSize: 16 }} />
              {t('playerConnections.ccuGraph.botsOnly')}
            </ToggleButton>
          </ToggleButtonGroup>

          <ToggleButtonGroup
            value={chartType}
            exclusive
            onChange={(_, val) => val && setChartType(val)}
            size="small"
            sx={{
              bgcolor: 'background.paper',
              borderRadius: 2,
              border: 1,
              borderColor: 'divider',
              p: 0.25,
              '& .MuiToggleButton-root': {
                px: 1.2,
                py: 0.35,
                border: 'none',
                borderRadius: 1.5,
                color: 'text.secondary',
                '&.Mui-selected': {
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                  color: 'primary.main',
                  '&:hover': {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                  },
                },
              },
            }}
          >
            <ToggleButton value="bar">
              <Tooltip title={t('argus.chart.bar', 'Bar')}>
                <BarChartIcon sx={{ fontSize: 16 }} />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="stacked-bar">
              <Tooltip title={t('argus.chart.stackedBar', 'Stacked Bar')}>
                <StackedBarChartIcon sx={{ fontSize: 16 }} />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="line">
              <Tooltip title={t('argus.chart.line', 'Line')}>
                <LineChartIcon sx={{ fontSize: 16 }} />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="area">
              <Tooltip title={t('argus.chart.area', 'Area')}>
                <AreaChartIcon sx={{ fontSize: 16 }} />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="stacked-area">
              <Tooltip title={t('argus.chart.stackedArea', 'Stacked Area')}>
                <StackedAreaChartIcon sx={{ fontSize: 16 }} />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>

          <Tooltip
            title={
              showLegend
                ? t('playerConnections.ccuGraph.hideLegend')
                : t('playerConnections.ccuGraph.showLegend')
            }
          >
            <IconButton
              size="small"
              onClick={() => setShowLegend(!showLegend)}
              sx={{
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              {showLegend ? (
                <LegendOnIcon fontSize="small" />
              ) : (
                <LegendOffIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </Stack>
        <DateRangeSelector value={dateRange} onChange={setDateRange} compact />
      </Paper>

      <PageContentLoader loading={loading}>
        {chartData.datasets.length === 0 ? (
          <EmptyPlaceholder
            message={t('playerConnections.ccuGraph.noData')}
            minHeight={300}
          />
        ) : (
          <>
            <Card variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ height: 400 }}>
                <Chart type={(chartType === 'bar' || chartType === 'stacked-bar') ? 'bar' : 'line'} data={chartData} options={chartOptions as any} />
              </Box>
            </Card>

            {/* Time-based CCU list (10-minute buckets) */}
            <CcuHistoryTable records={records} />
          </>
        )}
      </PageContentLoader>
    </Box>
  );
};

export default CcuGraphTab;
