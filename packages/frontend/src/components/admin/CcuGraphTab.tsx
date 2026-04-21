import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
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
} from '@mui/material';
import {
  People as PeopleIcon,
  SmartToy as BotIcon,
  Groups as AllIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
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
import type { CcuHistoryRecord } from '../../services/playerConnectionService';
import PageContentLoader from '../common/PageContentLoader';
import EmptyPlaceholder from '../common/EmptyPlaceholder';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

const TIME_RANGES = [
  { value: '1h', label: '1H', hours: 1 },
  { value: '6h', label: '6H', hours: 6 },
  { value: '24h', label: '24H', hours: 24 },
  { value: '7d', label: '7D', hours: 168 },
  { value: '14d', label: '14D', hours: 336 },
];

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
}

const CcuGraphTab: React.FC<Props> = ({ projectApiPath }) => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<CcuHistoryRecord[]>([]);
  const [timeRange, setTimeRange] = useState(
    () => searchParams.get('range') || '24h'
  );
  const [displayMode, setDisplayMode] = useState<'all' | 'users' | 'bots'>(
    'all'
  );

  const getDateRange = useCallback(() => {
    const opt = TIME_RANGES.find((r) => r.value === timeRange);
    const hours = opt?.hours || 24;
    const to = new Date();
    const from = new Date(to.getTime() - hours * 3600000);
    return { from, to };
  }, [timeRange]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = getDateRange();
      const data = await playerConnectionService.getCcuHistory(projectApiPath, {
        from: from.toISOString(),
        to: to.toISOString(),
      });
      setRecords(data);
    } catch (err) {
      console.error('CCU history load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [projectApiPath, getDateRange]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Persist range to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (timeRange !== '24h') params.set('range', timeRange);
    else params.delete('range');
    params.set('tab', '1');
    setSearchParams(params, { replace: true });
  }, [timeRange]); // eslint-disable-line react-hooks/exhaustive-deps

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

    return { labels, datasets };
  }, [records, t, displayMode]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' as const },
        tooltip: { mode: 'index' as const, intersect: false },
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
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
      },
      interaction: {
        mode: 'nearest' as const,
        axis: 'x' as const,
        intersect: false,
      },
    }),
    []
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
            label={t('playerConnections.ccuGraph.all')}
            size="small"
            variant={displayMode === 'all' ? 'filled' : 'outlined'}
            color={displayMode === 'all' ? 'primary' : 'default'}
            onClick={() => setDisplayMode('all')}
            sx={{ borderRadius: 1.5 }}
          />
          <Chip
            icon={<PeopleIcon sx={{ fontSize: 16 }} />}
            label={t('playerConnections.ccuGraph.usersOnly')}
            size="small"
            variant={displayMode === 'users' ? 'filled' : 'outlined'}
            color={displayMode === 'users' ? 'primary' : 'default'}
            onClick={() => setDisplayMode('users')}
            sx={{ borderRadius: 1.5 }}
          />
          <Chip
            icon={<BotIcon sx={{ fontSize: 16 }} />}
            label={t('playerConnections.ccuGraph.botsOnly')}
            size="small"
            variant={displayMode === 'bots' ? 'filled' : 'outlined'}
            color={displayMode === 'bots' ? 'secondary' : 'default'}
            onClick={() => setDisplayMode('bots')}
            sx={{ borderRadius: 1.5 }}
          />
        </Stack>
        <ToggleButtonGroup
          value={timeRange}
          exclusive
          onChange={(_, v) => v && setTimeRange(v)}
          size="small"
        >
          {TIME_RANGES.map((r) => (
            <ToggleButton
              key={r.value}
              value={r.value}
              sx={{ px: 1.5, py: 0.5, textTransform: 'none' }}
            >
              {r.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

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
                <Line data={chartData} options={chartOptions} />
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
