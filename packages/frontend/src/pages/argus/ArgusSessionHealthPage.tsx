import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Devices as DevicesIcon,
  CheckCircle as CheckIcon,
  Cancel as CrashIcon,
  People as PeopleIcon,
  Timer as TimerIcon,
} from '@mui/icons-material';
import { getCrosshairPlugin } from '../../utils/chartPlugins';
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
  ArcElement,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import PageContentLoader from '@/components/common/PageContentLoader';
import argusService, { ArgusSessionHealth } from '@/services/argusService';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, ChartTooltip, Legend, Filler);

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

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePeriodChange = (_: React.MouseEvent<HTMLElement>, value: string | null) => {
    if (!value) return;
    setPeriod(value);
    localStorage.setItem('argus-session-period', value);
  };

  const s = data?.summary;
  const crashFreeRate = Number(s?.crash_free_rate || 0);
  const rateColor = crashFreeRate >= 99 ? '#4caf50' : crashFreeRate >= 95 ? '#ff9800' : '#f44336';

  // Donut chart data
  const donutData = useMemo(() => ({
    labels: ['Healthy', 'Crashed', 'Abnormal'],
    datasets: [{
      data: [
        Number(s?.healthy || 0),
        Number(s?.crashed || 0),
        Number(s?.abnormal || 0),
      ],
      backgroundColor: [alpha('#4caf50', 0.8), alpha('#f44336', 0.8), alpha('#ff9800', 0.8)],
      borderColor: [alpha('#4caf50', 1), alpha('#f44336', 1), alpha('#ff9800', 1)],
      borderWidth: 2,
      cutout: '72%',
      spacing: 2,
      borderRadius: 4,
    }],
  }), [s]);

  const donutOpts = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 500 },
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
  }), []);

  // Trend chart
  const trendChartData = useMemo(() => {
    if (!data?.trend) return { labels: [], datasets: [] };
    return {
      labels: data.trend.map((d) => formatHour(d.hour)),
      datasets: [
        {
          label: 'Healthy',
          data: data.trend.map((d) => Number(d.healthy)),
          borderColor: '#4caf50',
          backgroundColor: alpha('#4caf50', 0.15),
          borderWidth: 2, tension: 0.4, fill: true, pointRadius: 0, pointHoverRadius: 3,
        },
        {
          label: 'Crashed',
          data: data.trend.map((d) => Number(d.crashed)),
          borderColor: '#f44336',
          backgroundColor: alpha('#f44336', 0.15),
          borderWidth: 2, tension: 0.4, fill: true, pointRadius: 0, pointHoverRadius: 3,
        },
      ],
    };
  }, [data]);

  const chartOpts = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: { display: true, position: 'top' as const, labels: { boxWidth: 8, font: { size: 11 } } },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10, font: { size: 10 } } },
      y: { beginAtZero: true, stacked: true, border: { display: false }, grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 } } },
    },
    interaction: { mode: 'nearest' as const, axis: 'x' as const, intersect: false },
  }), [isDark]);

  const statCards = [
    { icon: <DevicesIcon />, color: '#7c4dff', label: t('argus.sessions.totalSessions'), value: s?.total_sessions },
    { icon: <PeopleIcon />, color: '#2196f3', label: t('argus.sessions.uniqueUsers'), value: s?.unique_users },
    { icon: <CrashIcon />, color: '#f44336', label: t('argus.sessions.crashed'), value: s?.crashed },
    { icon: <TimerIcon />, color: '#ff9800', label: t('argus.sessions.avgDuration'), value: s ? `${Math.round(Number(s.avg_duration) / 1000)}s` : undefined },
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DevicesIcon sx={{ color: theme.palette.info.main }} />
          {t('argus.sessions.title')}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ToggleButtonGroup value={period} exclusive onChange={handlePeriodChange} size="small">
            {TIME_RANGES.map((r) => (
              <ToggleButton key={r.value} value={r.value} sx={{
                px: 1.2, py: 0.3, textTransform: 'none', fontSize: '0.75rem', minWidth: 36,
                '&.Mui-selected': { backgroundColor: alpha(theme.palette.primary.main, 0.15), color: theme.palette.primary.main, fontWeight: 600 },
              }}>{r.label}</ToggleButton>
            ))}
          </ToggleButtonGroup>
          <IconButton onClick={fetchData} size="small"><RefreshIcon /></IconButton>
        </Box>
      </Box>

      <PageContentLoader loading={loading}>
        {/* Top Row: Donut + Stats */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '300px 1fr' }, gap: 2, mb: 3 }}>
          {/* Crash-free Donut */}
          <Paper elevation={0} sx={{
            p: 3, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            borderRadius: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <Box sx={{ position: 'relative', width: 180, height: 180 }}>
              <Doughnut data={donutData} options={donutOpts} />
              {/* Center text */}
              <Box sx={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                textAlign: 'center',
              }}>
                <Typography variant="h4" fontWeight={800} sx={{ color: rateColor, lineHeight: 1 }}>
                  {crashFreeRate.toFixed(1)}%
                </Typography>
                <Typography variant="caption" sx={{ color: isDark ? '#777' : '#999', fontSize: '0.68rem' }}>
                  {t('argus.sessions.crashFree')}
                </Typography>
              </Box>
            </Box>
            {/* Legend */}
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              {[
                { label: t('argus.sessions.healthy'), value: s?.healthy, color: '#4caf50' },
                { label: t('argus.sessions.crashed'), value: s?.crashed, color: '#f44336' },
                { label: t('argus.sessions.abnormal'), value: s?.abnormal, color: '#ff9800' },
              ].map(item => (
                <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: item.color }} />
                  <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                    {item.label} <strong>{Number(item.value || 0).toLocaleString()}</strong>
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>

          {/* Stat Cards Grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
            {statCards.map((card, idx) => (
              <Paper key={idx} elevation={0} sx={{
                p: 2.5,
                background: isDark
                  ? `linear-gradient(135deg, ${alpha(card.color, 0.12)}, ${alpha(card.color, 0.03)})`
                  : `linear-gradient(135deg, ${alpha(card.color, 0.06)}, ${alpha(card.color, 0.01)})`,
                border: `1px solid ${alpha(card.color, 0.2)}`,
                borderRadius: 2,
                display: 'flex', alignItems: 'center', gap: 1.5,
                transition: 'all 0.2s',
                '&:hover': { transform: 'translateY(-1px)', boxShadow: `0 4px 16px ${alpha(card.color, 0.1)}` },
              }}>
                <Box sx={{
                  width: 40, height: 40, borderRadius: 2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: alpha(card.color, isDark ? 0.2 : 0.1), color: card.color,
                }}>
                  {React.cloneElement(card.icon, { sx: { fontSize: 20 } })}
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.2 }}>
                    {typeof card.value === 'number' ? card.value.toLocaleString() : card.value ?? '-'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: isDark ? '#777' : '#999', fontWeight: 500 }}>
                    {card.label}
                  </Typography>
                </Box>
              </Paper>
            ))}
          </Box>
        </Box>

        {/* Session Trend Chart */}
        <Paper elevation={0} sx={{ p: 2.5, mb: 3, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, borderRadius: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 3, height: 16, borderRadius: 1, backgroundColor: '#4caf50', mr: 0.5 }} />
            {t('argus.sessions.crashFreeTrend')}
          </Typography>
          <Box sx={{ height: 240 }}>
            <Line data={trendChartData} options={chartOpts} plugins={[getCrosshairPlugin(isDark)]} />
          </Box>
        </Paper>

        {/* By Release */}
        <Paper elevation={0} sx={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ px: 2.5, py: 1.5, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}>
            <Typography variant="subtitle2" fontWeight={600}>
              {t('argus.sessions.byRelease')}
            </Typography>
          </Box>
          {!data?.by_release?.length ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">{t('argus.sessions.noData')}</Typography>
            </Box>
          ) : (
            data.by_release.map((r, idx) => {
              const rate = Number(r.crash_free_rate);
              const barColor = rate >= 99 ? '#4caf50' : rate >= 95 ? '#ff9800' : '#f44336';
              return (
                <Box key={`${r.release}-${idx}`} sx={{
                  display: 'flex', alignItems: 'center', gap: 2, px: 2.5, py: 1.2,
                  borderBottom: idx < data.by_release.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}` : 'none',
                }}>
                  <Chip label={r.release} size="small" sx={{
                    fontWeight: 600, fontSize: '0.72rem', minWidth: 110,
                    backgroundColor: alpha('#7c4dff', 0.1), color: '#7c4dff', border: 'none',
                  }} />
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                      <Typography variant="caption" sx={{ color: isDark ? '#777' : '#999' }}>
                        {t('argus.sessions.sessionsCount', { count: Number(r.total) as any }).replace(r.total.toString(), Number(r.total).toLocaleString())} · {t('argus.sessions.usersCount', { count: Number(r.users) as any }).replace(r.users.toString(), Number(r.users).toLocaleString())}
                      </Typography>
                      <Typography variant="caption" fontWeight={700} sx={{ color: barColor }}>
                        {rate.toFixed(1)}%
                      </Typography>
                    </Box>
                    <Box sx={{ height: 6, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
                      <Box sx={{
                        height: '100%', borderRadius: 3, width: `${rate}%`,
                        background: `linear-gradient(90deg, ${barColor}, ${alpha(barColor, 0.6)})`,
                        transition: 'width 0.5s',
                      }} />
                    </Box>
                  </Box>
                  <Chip label={t('argus.sessions.crashesCount', { count: Number(r.crashed) })} size="small" sx={{
                    height: 20, fontSize: '0.65rem',
                    backgroundColor: Number(r.crashed) > 0 ? alpha('#f44336', 0.1) : alpha('#4caf50', 0.1),
                    color: Number(r.crashed) > 0 ? '#f44336' : '#4caf50',
                    border: 'none',
                  }} />
                </Box>
              );
            })
          )}
        </Paper>
      </PageContentLoader>
    </Box>
  );
};

function formatHour(h: string): string {
  try {
    const d = new Date(h);
    return `${String(d.getHours()).padStart(2, '0')}:00`;
  } catch { return h; }
}

export default ArgusSessionHealthPage;
