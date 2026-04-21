import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Skeleton,
  IconButton,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  OpenInNew as OpenInNewIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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

const DashboardCcuChart: React.FC<Props> = ({ projectApiPath }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<CcuHistoryRecord[]>([]);
  const [timeRange, setTimeRange] = useState('24h');

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
      console.error('Dashboard CCU history load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [projectApiPath, getDateRange]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

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

    // Total line (bold, filled)
    if (totalRecords.length > 0) {
      datasets.push({
        label: t('playerConnections.ccu.total'),
        data: totalRecords.map((r) => r.playerCount),
        borderColor: '#1976d2',
        backgroundColor: 'rgba(25,118,210,0.15)',
        borderWidth: 2.5,
        tension: 0.3,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 3,
        spanGaps: true,
      });
    }

    // Per-world lines
    let colorIdx = 0;
    groups.forEach((recs, key) => {
      if (key === '__total__') return;
      const c = WORLD_COLORS[colorIdx % WORLD_COLORS.length];
      datasets.push({
        label: recs[0]?.worldName || key,
        data: recs.map((r) => r.playerCount),
        borderColor: c.border,
        backgroundColor: c.bg,
        borderWidth: 1.5,
        tension: 0.3,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 2,
        spanGaps: true,
      });
      colorIdx++;
    });

    return { labels, datasets };
  }, [records, t]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            boxWidth: 12,
            font: { size: 11 },
            padding: 8,
          },
        },
        tooltip: { mode: 'index' as const, intersect: false },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
            font: { size: 10 },
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { font: { size: 10 } },
        },
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
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1.5,
          }}
        >
          <Typography variant="subtitle1" fontWeight={600}>
            {t('dashboard.ccuChartTitle')}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
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
                  sx={{
                    px: 1,
                    py: 0.25,
                    textTransform: 'none',
                    fontSize: '0.7rem',
                    minWidth: 32,
                  }}
                >
                  {r.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Tooltip title={t('common.refresh')}>
              <IconButton size="small" onClick={loadHistory}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('dashboard.ccuChartViewDetail')}>
              <IconButton
                size="small"
                onClick={() => navigate('/admin/player-connections?tab=1')}
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {loading ? (
          <Skeleton
            variant="rectangular"
            height={210}
            sx={{ borderRadius: 1 }}
          />
        ) : chartData.datasets.length === 0 ? (
          <Box
            sx={{
              height: 280,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'text.secondary',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <Typography variant="body2">
              {t('playerConnections.ccuGraph.noData')}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ height: 280 }}>
            <Line data={chartData} options={chartOptions} />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default DashboardCcuChart;
