import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Card,
  Chip,
  Stack,
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
          <Card variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ height: 400 }}>
              <Line data={chartData} options={chartOptions} />
            </Box>
          </Card>
        )}
      </PageContentLoader>
    </Box>
  );
};

export default CcuGraphTab;
