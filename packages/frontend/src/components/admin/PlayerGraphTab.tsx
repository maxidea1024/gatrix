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
} from '@mui/material';
import {
  People as PlayersIcon,
  PersonAdd as NewPlayersIcon,
  Groups as AllIcon,
  Visibility as LegendOnIcon,
  VisibilityOff as LegendOffIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import playerConnectionService from '../../services/playerConnectionService';
import type { PlayerHistoryRecord } from '../../services/playerConnectionService';
import PageContentLoader from '../common/PageContentLoader';
import EmptyPlaceholder from '../common/EmptyPlaceholder';
import { crosshairPlugin } from '../../utils/chartCrosshairPlugin';
import DateRangePicker, { DateRangePreset } from '../common/DateRangePicker';
import dayjs, { Dayjs } from 'dayjs';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
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
                    fontFamily: 'monospace',
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
  const [dateFrom, setDateFrom] = useState<Dayjs | null>(() =>
    dayjs().subtract(7, 'day').startOf('day')
  );
  const [dateTo, setDateTo] = useState<Dayjs | null>(() =>
    dayjs().endOf('day')
  );
  const [datePreset, setDatePreset] = useState<DateRangePreset>('last7d');

  const handleDateChange = useCallback(
    (from: Dayjs | null, to: Dayjs | null, preset: DateRangePreset) => {
      setDateFrom(from);
      setDateTo(to);
      setDatePreset(preset);
    },
    []
  );

  const getDateRange = useCallback(() => {
    const to = dateTo ? dateTo.toDate() : new Date();
    const from = dateFrom
      ? dateFrom.toDate()
      : new Date(to.getTime() - 7 * 24 * 3600000);
    return { from, to };
  }, [dateFrom, dateTo]);

  const hasLoadedRef = useRef(false);
  const prevGetDateRangeRef = useRef(getDateRange);

  const loadHistory = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      try {
        const { from, to } = getDateRange();
        const data = await playerConnectionService.getPlayerHistory(
          projectApiPath,
          { from: from.toISOString(), to: to.toISOString() }
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

  // Build chart data
  const chartData = useMemo(() => {
    if (records.length === 0) return { labels: [], datasets: [] };

    const labels = records.map((r) => {
      const d = new Date(r.recordedAt);
      return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    });

    const datasets: any[] = [];

    if (displayMode === 'all' || displayMode === 'total') {
      datasets.push({
        label: t('playerConnections.player.totalPlayers'),
        data: records.map((r) => r.totalPlayers),
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
        data: records.map((r) => r.newPlayers),
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

    return { labels, datasets };
  }, [records, t, displayMode]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
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
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Stack direction="row" spacing={0.5}>
          <Chip
            icon={<AllIcon sx={{ fontSize: 16 }} />}
            label={t('playerConnections.player.showAll')}
            size="small"
            variant={displayMode === 'all' ? 'filled' : 'outlined'}
            color={displayMode === 'all' ? 'primary' : 'default'}
            onClick={() => setDisplayMode('all')}
            sx={{ borderRadius: 1.5 }}
          />
          <Chip
            icon={<PlayersIcon sx={{ fontSize: 16 }} />}
            label={t('playerConnections.player.totalPlayers')}
            size="small"
            variant={displayMode === 'total' ? 'filled' : 'outlined'}
            color={displayMode === 'total' ? 'primary' : 'default'}
            onClick={() => setDisplayMode('total')}
            sx={{ borderRadius: 1.5 }}
          />
          <Chip
            icon={<NewPlayersIcon sx={{ fontSize: 16 }} />}
            label={t('playerConnections.player.newPlayers')}
            size="small"
            variant={displayMode === 'new' ? 'filled' : 'outlined'}
            color={displayMode === 'new' ? 'success' : 'default'}
            onClick={() => setDisplayMode('new')}
            sx={{ borderRadius: 1.5 }}
          />
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
              sx={{ ml: 0.5 }}
            >
              {showLegend ? (
                <LegendOnIcon fontSize="small" />
              ) : (
                <LegendOffIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </Stack>
        <DateRangePicker
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChange={handleDateChange}
          preset={datePreset}
          availablePresets={[
            'today',
            'yesterday',
            'last7d',
            'last30d',
            'last3m',
            'last6m',
            'custom',
          ]}
          size="small"
        />
      </Box>

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
                <Line data={chartData} options={chartOptions as any} />
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
