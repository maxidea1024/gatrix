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
  People as AllIcon,
  PersonAdd as NewIcon,
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
import type { CharacterHistoryRecord } from '../../services/playerConnectionService';
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

// --- History Table ---
interface BucketRow {
  time: string;
  totalCharacters: number;
  newCharacters: number;
  worlds: { name: string; total: number; newCount: number }[];
}

const CharacterHistoryTable: React.FC<{
  records: CharacterHistoryRecord[];
}> = ({ records }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const buckets = useMemo(() => {
    if (records.length === 0) return [];

    const totalRecords = records.filter((r) => r.worldId === null);
    const worldRecords = records.filter((r) => r.worldId !== null);

    const bucketMap = new Map<string, BucketRow>();

    totalRecords.forEach((r) => {
      const d = new Date(r.recordedAt);
      const mins = Math.floor(d.getMinutes() / 10) * 10;
      d.setMinutes(mins, 0, 0);
      const key = d.toISOString();
      const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

      if (!bucketMap.has(key)) {
        bucketMap.set(key, {
          time: label,
          totalCharacters: r.totalCharacters,
          newCharacters: r.newCharacters,
          worlds: [],
        });
      } else {
        const existing = bucketMap.get(key)!;
        existing.totalCharacters = Math.max(
          existing.totalCharacters,
          r.totalCharacters
        );
        existing.newCharacters = Math.max(
          existing.newCharacters,
          r.newCharacters
        );
      }
    });

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
        existingWorld.total = Math.max(existingWorld.total, r.totalCharacters);
        existingWorld.newCount = Math.max(
          existingWorld.newCount,
          r.newCharacters
        );
      } else {
        bucket.worlds.push({
          name: r.worldName || r.worldId || '?',
          total: r.totalCharacters,
          newCount: r.newCharacters,
        });
      }
    });

    return Array.from(bucketMap.values()).sort((a, b) =>
      b.time > a.time ? 1 : -1
    );
  }, [records]);

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
          {t('playerConnections.character.historyTable')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('playerConnections.character.historyTableDesc', {
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
                {t('playerConnections.character.colTime')}
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
                {t('playerConnections.character.colTotalCharacters')}
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
                {t('playerConnections.character.colNewCharacters')}
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
                  {row.totalCharacters.toLocaleString()}
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
                  {row.newCharacters > 0
                    ? `+${row.newCharacters.toLocaleString()}`
                    : row.newCharacters.toLocaleString()}
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
                          w && w.total > 0 ? 'text.primary' : 'text.disabled',
                      }}
                    >
                      {w ? w.total.toLocaleString() : '-'}
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

const CharacterGraphTab: React.FC<Props> = ({ projectApiPath, refreshKey }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<CharacterHistoryRecord[]>([]);

  const [displayMode, setDisplayModeRaw] = useState<'total' | 'new'>(
    () =>
      (localStorage.getItem('character-display-mode') as 'total' | 'new') ||
      'total'
  );
  const setDisplayMode = useCallback((v: 'total' | 'new') => {
    setDisplayModeRaw(v);
    localStorage.setItem('character-display-mode', v);
  }, []);

  const [showLegend, setShowLegendRaw] = useState(
    () => localStorage.getItem('character-show-legend') !== 'false'
  );
  const setShowLegend = useCallback((v: boolean) => {
    setShowLegendRaw(v);
    localStorage.setItem('character-show-legend', String(v));
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
        const data = await playerConnectionService.getCharacterHistory(
          projectApiPath,
          { from: from.toISOString(), to: to.toISOString() }
        );
        setRecords(data);
        hasLoadedRef.current = true;
      } catch (err) {
        console.error('Character history load failed:', err);
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

  // Build chart data — with per-world breakdown and gap filling
  const chartData = useMemo(() => {
    if (records.length === 0) return { labels: [], datasets: [] };

    // Group by worldId
    const groups = new Map<string, CharacterHistoryRecord[]>();
    records.forEach((r) => {
      const key = r.worldId ?? '__total__';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    });

    // Generate full time axis from date range
    // Match backend downsampling: ≤7D=10min, ≤30D=30min, >30D=60min
    const { from, to } = getDateRange();
    const rangeHours = (to.getTime() - from.getTime()) / (1000 * 60 * 60);
    const intervalMinutes = rangeHours > 24 * 30 ? 60 : rangeHours > 24 * 7 ? 30 : 10;

    const allLabels: string[] = [];
    const current = new Date(from);
    current.setMinutes(Math.floor(current.getMinutes() / intervalMinutes) * intervalMinutes, 0, 0);
    while (current <= to) {
      allLabels.push(
        `${String(current.getMonth() + 1).padStart(2, '0')}/${String(current.getDate()).padStart(2, '0')} ${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}`
      );

      current.setMinutes(current.getMinutes() + intervalMinutes);
    }

    // Helper: fill gaps for a record set across the full time axis
    // totalCharacters carry-forwards; newCharacters defaults to 0
    const fillGaps = (
      recs: CharacterHistoryRecord[],
      isTotal: boolean
    ): (number | null)[] => {
      // Build a map of timestamp -> value
      const valueMap = new Map<string, number>();
      recs.forEach((r) => {
        const d = new Date(r.recordedAt);
        const mins = Math.floor(d.getMinutes() / intervalMinutes) * intervalMinutes;
        d.setMinutes(mins, 0, 0);
        const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        const val = isTotal ? r.totalCharacters : r.newCharacters;
        // Keep max value per bucket
        valueMap.set(label, Math.max(valueMap.get(label) ?? 0, val));
      });

      if (displayMode === 'total') {
        // Carry forward: fill gaps with last known value
        let lastVal: number | null = null;
        return allLabels.map((label) => {
          if (valueMap.has(label)) {
            lastVal = valueMap.get(label)!;
            return lastVal;
          }
          return lastVal; // null before first data point, carry forward after
        });
      } else {
        // New characters: fill gaps with 0 (only after first data point)
        let hasStarted = false;
        return allLabels.map((label) => {
          if (valueMap.has(label)) {
            hasStarted = true;
            return valueMap.get(label)!;
          }
          return hasStarted ? 0 : null;
        });
      }
    };

    const datasets: any[] = [];
    const totalRecords = groups.get('__total__') || [];

    // Total line
    if (totalRecords.length > 0) {
      const isTotal = displayMode === 'total';
      datasets.push({
        label: isTotal
          ? t('playerConnections.character.totalCharacters')
          : t('playerConnections.character.newCharacters'),
        data: fillGaps(totalRecords, isTotal),
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

    // Per-world lines
    let colorIdx = 0;
    groups.forEach((recs, key) => {
      if (key === '__total__') return;
      const c = WORLD_COLORS[colorIdx % WORLD_COLORS.length];
      const isTotal = displayMode === 'total';
      datasets.push({
        label: recs[0]?.worldName || key,
        data: fillGaps(recs, isTotal),
        borderColor: c.border,
        backgroundColor: c.bg,
        borderWidth: 1.5,
        tension: 0.3,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 3,
        spanGaps: true,
      });
      colorIdx++;
    });

    return { labels: allLabels, datasets };
  }, [records, t, displayMode, getDateRange]);

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
          ticks: {
            precision: 0,
            callback: (value: any) =>
              typeof value === 'number' ? value.toLocaleString() : value,
          },
        },
      },
      interaction: {
        mode: 'nearest' as const,
        axis: 'x' as const,
        intersect: false,
      },
    }),
    [showLegend]
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
            label={t('playerConnections.character.totalCharacters')}
            size="small"
            variant={displayMode === 'total' ? 'filled' : 'outlined'}
            color={displayMode === 'total' ? 'primary' : 'default'}
            onClick={() => setDisplayMode('total')}
            sx={{ borderRadius: 1.5 }}
          />
          <Chip
            icon={<NewIcon sx={{ fontSize: 16 }} />}
            label={t('playerConnections.character.newCharacters')}
            size="small"
            variant={displayMode === 'new' ? 'filled' : 'outlined'}
            color={displayMode === 'new' ? 'success' : 'default'}
            onClick={() => setDisplayMode('new')}
            sx={{ borderRadius: 1.5 }}
          />
          <Tooltip
            title={
              showLegend
                ? t('playerConnections.character.hideLegend')
                : t('playerConnections.character.showLegend')
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
            message={t('playerConnections.character.noData')}
            minHeight={300}
          />
        ) : (
          <>
            <Card variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ height: 400 }}>
                <Line data={chartData} options={chartOptions as any} />
              </Box>
            </Card>

            {/* History table with per-world columns */}
            <CharacterHistoryTable records={records} />
          </>
        )}
      </PageContentLoader>
    </Box>
  );
};

export default CharacterGraphTab;
