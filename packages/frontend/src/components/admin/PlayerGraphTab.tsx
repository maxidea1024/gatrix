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
import {
  People as PlayersIcon,
  PersonAdd as NewPlayersIcon,
  Groups as AllIcon,
  Visibility as LegendOnIcon,
  VisibilityOff as LegendOffIcon,
  BarChart as BarChartIcon,
  ShowChart as LineChartIcon,
  StackedLineChart as AreaChartIcon,
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
import { Chart } from 'react-chartjs-2';
import useLocalStorage from '../../hooks/useLocalStorage';
import playerConnectionService from '../../services/playerConnectionService';
import type { PlayerHistoryRecord } from '../../services/playerConnectionService';
import PageContentLoader from '../common/PageContentLoader';
import EmptyPlaceholder from '../common/EmptyPlaceholder';
import { crosshairPlugin } from '../../utils/chartCrosshairPlugin';
import DateRangeSelector, {
  DateRangeValue,
  dateRangeToDatePair,
} from '../common/DateRangeSelector';

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

// --- History Table: 10-minute bucket aggregation ---
interface BucketRow {
  time: string;
  totalPlayers: number;
  newPlayers: number;
}

const PlayerHistoryTable: React.FC<{
  records: PlayerHistoryRecord[];
}> = ({ records }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const buckets = useMemo(() => {
    if (records.length === 0) return [];

    const bucketMap = new Map<string, BucketRow>();

    records.forEach((r) => {
      const d = new Date(r.recordedAt);
      const mins = Math.floor(d.getMinutes() / 10) * 10;
      d.setMinutes(mins, 0, 0);
      const key = d.toISOString();
      const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

      if (!bucketMap.has(key)) {
        bucketMap.set(key, {
          time: label,
          totalPlayers: r.totalPlayers,
          newPlayers: r.newPlayers,
        });
      } else {
        const existing = bucketMap.get(key)!;
        existing.totalPlayers = Math.max(existing.totalPlayers, r.totalPlayers);
        existing.newPlayers = Math.max(existing.newPlayers, r.newPlayers);
      }
    });

    return Array.from(bucketMap.values()).sort((a, b) =>
      b.time > a.time ? 1 : -1
    );
  }, [records]);

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
          {t('playerConnections.player.historyTable')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('playerConnections.player.historyTableDesc', {
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
                {t('playerConnections.player.colTime')}
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
                {t('playerConnections.player.colTotalPlayers')}
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
                {t('playerConnections.player.colNewPlayers')}
              </TableCell>
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
                  {row.totalPlayers.toLocaleString()}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontSize: '0.75rem',
                    py: 0.75,
                    fontWeight: 600,
                    color: 'success.main',
                  }}
                >
                  {row.newPlayers > 0
                    ? `+${row.newPlayers.toLocaleString()}`
                    : '0'}
                </TableCell>
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

const PlayerGraphTab: React.FC<Props> = ({ projectApiPath, refreshKey }) => {
  const { t } = useTranslation();
  const [chartType, setChartType] = useLocalStorage<'bar' | 'line' | 'area'>(
    'playerConnections.playerGraph.chartType',
    'line'
  );
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<PlayerHistoryRecord[]>([]);

  const [displayMode, setDisplayModeRaw] = useState<'all' | 'total' | 'new'>(
    () =>
      (localStorage.getItem('player-display-mode') as
        | 'all'
        | 'total'
        | 'new') || 'all'
  );
  const setDisplayMode = useCallback((v: 'all' | 'total' | 'new') => {
    setDisplayModeRaw(v);
    localStorage.setItem('player-display-mode', v);
  }, []);
  const [showLegend, setShowLegendRaw] = useState(
    () => localStorage.getItem('player-show-legend') !== 'false'
  );
  const setShowLegend = useCallback((v: boolean) => {
    setShowLegendRaw(v);
    localStorage.setItem('player-show-legend', String(v));
  }, []);
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => ({
    type: 'preset',
    preset: '7d',
  }));

  const getDateRange = useCallback(() => {
    return dateRangeToDatePair(dateRange);
  }, [dateRange]);

  const hasLoadedRef = useRef(false);
  const prevGetDateRangeRef = useRef(getDateRange);

  const loadHistory = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      try {
        const { start, end } = getDateRange();
        const data = await playerConnectionService.getPlayerHistory(
          projectApiPath,
          { from: start.toISOString(), to: end.toISOString() }
        );
        setRecords(data);
        hasLoadedRef.current = true;
      } catch (err) {
        console.error('Player history load failed:', err);
      } finally {
        setLoading(false);
      }
    },
    [projectApiPath, getDateRange]
  );

  useEffect(() => {
    const rangeChanged = prevGetDateRangeRef.current !== getDateRange;
    prevGetDateRangeRef.current = getDateRange;
    loadHistory(!hasLoadedRef.current || rangeChanged);
  }, [loadHistory]);

  const prevRefreshKeyRef = useRef(refreshKey);
  useEffect(() => {
    if (prevRefreshKeyRef.current !== refreshKey && hasLoadedRef.current) {
      prevRefreshKeyRef.current = refreshKey;
      loadHistory(false);
    }
  }, [refreshKey, loadHistory]);

  // Build chart data with gap filling
  const chartData = useMemo(() => {
    if (records.length === 0) return { labels: [], datasets: [] };

    // Generate full time axis from date range
    // Match backend downsampling: ??D=10min, ??0D=30min, >30D=60min
    const { start, end } = getDateRange();
    const rangeHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const intervalMinutes =
      rangeHours > 24 * 30 ? 60 : rangeHours > 24 * 7 ? 30 : 10;

    const allLabels: string[] = [];
    const current = new Date(start);
    current.setMinutes(
      Math.floor(current.getMinutes() / intervalMinutes) * intervalMinutes,
      0,
      0
    );
    while (current <= end) {
      allLabels.push(
        `${String(current.getMonth() + 1).padStart(2, '0')}/${String(current.getDate()).padStart(2, '0')} ${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}`
      );
      current.setMinutes(current.getMinutes() + intervalMinutes);
    }

    // Build maps of label -> value for each metric
    const totalMap = new Map<string, number>();
    const newMap = new Map<string, number>();
    records.forEach((r) => {
      const d = new Date(r.recordedAt);
      const mins =
        Math.floor(d.getMinutes() / intervalMinutes) * intervalMinutes;
      d.setMinutes(mins, 0, 0);
      const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      totalMap.set(label, Math.max(totalMap.get(label) ?? 0, r.totalPlayers));
      newMap.set(label, Math.max(newMap.get(label) ?? 0, r.newPlayers));
    });

    // Fill gaps: totalPlayers carry-forwards, newPlayers defaults to 0
    const fillTotal = (): (number | null)[] => {
      let lastVal: number | null = null;
      return allLabels.map((label) => {
        if (totalMap.has(label)) {
          lastVal = totalMap.get(label)!;
          return lastVal;
        }
        return lastVal;
      });
    };
    const fillNew = (): (number | null)[] => {
      let hasStarted = false;
      return allLabels.map((label) => {
        if (newMap.has(label)) {
          hasStarted = true;
          return newMap.get(label)!;
        }
        return hasStarted ? 0 : null;
      });
    };

    const datasets: any[] = [];

    if (displayMode === 'all' || displayMode === 'total') {
      datasets.push({
        label: t('playerConnections.player.totalPlayers'),
        data: fillTotal(),
        borderColor: '#1976d2',
        backgroundColor: 'rgba(25,118,210,0.15)',
        borderWidth: 3,
        tension: 0.3,
        fill: displayMode === 'total',
        pointRadius: 0,
        pointHoverRadius: 4,
        spanGaps: true,
        yAxisID: 'y',
      });
    }

    if (displayMode === 'all' || displayMode === 'new') {
      datasets.push({
        label: t('playerConnections.player.newPlayers'),
        data: fillNew(),
        borderColor: '#4caf50',
        backgroundColor: 'rgba(76,175,80,0.15)',
        borderWidth: 2,
        tension: 0.3,
        fill: displayMode === 'new',
        pointRadius: 0,
        pointHoverRadius: 4,
        spanGaps: true,
        yAxisID: displayMode === 'all' ? 'y1' : 'y',
      });
    }

    const finalDatasets = datasets.map((ds) => {
      const isBar = chartType === 'bar';
      const isArea = chartType === 'area';
      return {
        ...ds,
        type: isBar ? 'bar' : 'line',
        fill: isArea,
        backgroundColor: isBar || isArea ? ds.backgroundColor : 'transparent',
        borderWidth: isBar ? 0 : ds.borderWidth || 2,
        borderRadius: isBar ? 4 : 0,
      };
    });

    return { labels: allLabels, datasets: finalDatasets };
  }, [records, t, displayMode, getDateRange, chartType]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false as const,
      plugins: {
        legend: { display: showLegend, position: 'top' as const },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
          callbacks: {
            label: (ctx: any) => {
              const val = ctx.parsed.y;
              return `${ctx.dataset.label}: ${val != null ? val.toLocaleString() : '-'}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: true, color: 'rgba(0,0,0,0.05)' },
          ticks: {
            maxRotation: 45,
            minRotation: 45,
            autoSkip: true,
            maxTicksLimit: 16,
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.05)' },
          position: 'left' as const,
          ticks: {
            precision: 0,
            callback: (value: any) =>
              typeof value === 'number' ? value.toLocaleString() : value,
          },
        },
        ...(displayMode === 'all'
          ? {
              y1: {
                beginAtZero: true,
                grid: { drawOnChartArea: false },
                position: 'right' as const,
                ticks: {
                  precision: 0,
                  callback: (value: any) =>
                    typeof value === 'number' ? value.toLocaleString() : value,
                },
              },
            }
          : {}),
      },
      interaction: {
        mode: 'nearest' as const,
        axis: 'x' as const,
        intersect: false,
      },
    }),
    [showLegend, displayMode]
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
              {t('playerConnections.player.showAll')}
            </ToggleButton>
            <ToggleButton value="total">
              <PlayersIcon sx={{ fontSize: 16 }} />
              {t('playerConnections.player.totalPlayers')}
            </ToggleButton>
            <ToggleButton value="new">
              <NewPlayersIcon sx={{ fontSize: 16 }} />
              {t('playerConnections.player.newPlayers')}
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
          </ToggleButtonGroup>

          <Tooltip
            title={
              showLegend
                ? t('playerConnections.player.hideLegend')
                : t('playerConnections.player.showLegend')
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
            message={t('playerConnections.player.noData')}
            minHeight={300}
          />
        ) : (
          <>
            <Card variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ height: 400 }}>
                <Chart
                  type={chartType === 'bar' ? 'bar' : 'line'}
                  data={chartData}
                  options={chartOptions as any}
                />
              </Box>
            </Card>

            {/* History table */}
            <PlayerHistoryTable records={records} />
          </>
        )}
      </PageContentLoader>
    </Box>
  );
};

export default PlayerGraphTab;
