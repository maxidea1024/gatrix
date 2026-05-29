import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Devices as DevicesIcon,
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
import { Line } from 'react-chartjs-2';
import PageContentLoader from '@/components/common/PageContentLoader';
import argusService, { ArgusSessionHealth } from '@/services/argusService';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, ChartTooltip, Legend, Filler);

const TIME_RANGES = [
  { value: '1h', label: '1H' },
  { value: '6h', label: '6H' },
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
];

const ArgusSessionHealthPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const projectId = '1';

  const [data, setData] = useState<ArgusSessionHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(() => localStorage.getItem('argus-session-period') || '24h');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await argusService.getSessionHealth(projectId, period);
      setData(result);
    } catch (error) {
      console.error('Failed to fetch session health:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePeriodChange = (_: React.MouseEvent<HTMLElement>, value: string | null) => {
    if (!value) return;
    setPeriod(value);
    localStorage.setItem('argus-session-period', value);
  };

  const s = data?.summary;

  const trendChartData = useMemo(() => {
    if (!data?.trend) return { labels: [], datasets: [] };
    return {
      labels: data.trend.map((d) => formatHour(d.hour)),
      datasets: [
        {
          label: t('argus.sessions.crashFreeRate'),
          data: data.trend.map((d) => Number(d.crash_free_rate)),
          borderColor: theme.palette.success.main,
          backgroundColor: `${theme.palette.success.main}20`,
          borderWidth: 2,
          tension: 0.3,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 3,
        },
      ],
    };
  }, [data, theme, t]);

  const chartOpts = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false as const,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10, font: { size: 10 } } },
        y: { min: 90, max: 100, grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }, ticks: { font: { size: 10 }, callback: (v: any) => `${v}%` } },
      },
      interaction: { mode: 'nearest' as const, axis: 'x' as const, intersect: false },
    }),
    [isDark]
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <DevicesIcon sx={{ fontSize: 28, color: theme.palette.info.main }} />
          <Typography variant="h5" fontWeight={700}>
            {t('argus.sessions.title')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ToggleButtonGroup value={period} exclusive onChange={handlePeriodChange} size="small">
            {TIME_RANGES.map((r) => (
              <ToggleButton key={r.value} value={r.value} sx={{ px: 1.2, py: 0.3, textTransform: 'none', fontSize: '0.75rem', minWidth: 36 }}>
                {r.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <IconButton onClick={fetchData} size="small"><RefreshIcon /></IconButton>
        </Box>
      </Box>

      <PageContentLoader loading={loading}>
        {/* Summary Cards */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <StatCard label={t('argus.sessions.totalSessions')} value={s?.total_sessions} color={theme.palette.primary.main} />
          <StatCard label={t('argus.sessions.crashFreeRate')} value={s ? `${Number(s.crash_free_rate).toFixed(1)}%` : undefined} color={theme.palette.success.main} />
          <StatCard label={t('argus.sessions.crashed')} value={s?.crashed} color={theme.palette.error.main} />
          <StatCard label={t('argus.sessions.uniqueUsers')} value={s?.unique_users} color={theme.palette.warning.main} />
        </Box>

        {/* Crash-free Rate Trend */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
            {t('argus.sessions.crashFreeTrend')}
          </Typography>
          <Box sx={{ height: 240 }}>
            <Line data={trendChartData} options={chartOpts} />
          </Box>
        </Paper>

        {/* By Release */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
            {t('argus.sessions.byRelease')}
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>{t('argus.sessions.release')}</TableCell>
                  <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>{t('argus.sessions.totalSessions')}</TableCell>
                  <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>{t('argus.sessions.crashed')}</TableCell>
                  <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>{t('argus.sessions.crashFreeRate')}</TableCell>
                  <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>{t('argus.sessions.users')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data?.by_release?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ py: 4, textAlign: 'center' }}>
                      <Typography color="text.secondary">{t('argus.sessions.noData')}</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.by_release?.map((r) => (
                    <TableRow key={r.release}>
                      <TableCell>
                        <Chip label={r.release} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell align="right">{Number(r.total).toLocaleString()}</TableCell>
                      <TableCell align="right">{Number(r.crashed).toLocaleString()}</TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          color={Number(r.crash_free_rate) < 95 ? 'error' : Number(r.crash_free_rate) < 99 ? 'warning.main' : 'success.main'}
                        >
                          {Number(r.crash_free_rate).toFixed(1)}%
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{Number(r.users).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </PageContentLoader>
    </Box>
  );
};

const StatCard: React.FC<{ label: string; value?: number | string; color: string }> = ({ label, value, color }) => (
  <Paper sx={{ p: 2, flex: '1 1 160px', minWidth: 140 }}>
    <Typography variant="h5" fontWeight={700} sx={{ color }}>
      {typeof value === 'number' ? value.toLocaleString() : value ?? '-'}
    </Typography>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
  </Paper>
);

function formatHour(h: string): string {
  try {
    const d = new Date(h);
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;
  } catch { return h; }
}

export default ArgusSessionHealthPage;
