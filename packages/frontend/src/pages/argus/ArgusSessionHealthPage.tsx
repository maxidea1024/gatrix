import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  useTheme,
  alpha,
  Skeleton,
  Tooltip,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Devices as DevicesIcon,
  CheckCircle as CheckIcon,
  Cancel as CrashIcon,
  People as PeopleIcon,
  Timer as TimerIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Warning as WarningIcon,
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
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import PageContentLoader from '@/components/common/PageContentLoader';
import argusService, { ArgusSessionHealth } from '@/services/argusService';
import ArgusFilterBar, { ArgusFilterState, defaultArgusFilterState } from '@/components/argus/ArgusFilterBar';
import { argusDateRangeToApiParams } from '@/components/argus/ArgusDateRangePicker';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, ChartTooltip, Legend, Filler);




const ArgusSessionHealthPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const projectId = '1';

  const [data, setData] = useState<ArgusSessionHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ArgusFilterState>(() => {
    const saved = localStorage.getItem('argus-session-period');
    return defaultArgusFilterState(saved || '24h');
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const ap = argusDateRangeToApiParams(filters.dateRange);
      const result = await argusService.getSessionHealth(projectId, ap.period, ap.start, ap.end);
      setData(result);
    } catch (error) {
      console.error('Failed to fetch session health:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFilterChange = (newFilters: ArgusFilterState) => {
    setFilters(newFilters);
    if (newFilters.dateRange.type === 'preset' && newFilters.dateRange.preset) {
      localStorage.setItem('argus-session-period', newFilters.dateRange.preset);
    }
  };

  const s = data?.summary;
  const pp = data?.previous_period;
  const crashFreeRate = Number(s?.crash_free_rate || 0);
  const rateColor = crashFreeRate >= 99 ? '#4caf50' : crashFreeRate >= 95 ? '#ff9800' : '#f44336';

  const calcChange = (current: number | undefined, previous: number | undefined): number | null => {
    if (current == null || previous == null || previous === 0) return null;
    return ((current - previous) / previous) * 100;
  };

  // Donut chart data
  const donutData = useMemo(() => ({
    labels: ['Healthy', 'Crashed', 'Errored', 'Abnormal'],
    datasets: [{
      data: [
        Number(s?.healthy || 0),
        Number(s?.crashed || 0),
        Number(s?.errored || 0),
        Number(s?.abnormal || 0),
      ],
      backgroundColor: ['#4caf50', '#f44336', '#ff9800', '#9e9e9e'],
      borderColor: isDark ? '#1a1a2e' : '#ffffff',
      borderWidth: 3,
      cutout: '72%',
      spacing: 0,
      borderRadius: 0,
      hoverOffset: 6,
    }],
  }), [s, isDark]);

  const donutOpts = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 500 },
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
  }), []);

  // Status timeline (stacked area)
  const statusTimelineData = useMemo(() => {
    if (!data?.status_timeline) return { labels: [], datasets: [] };
    return {
      labels: data.status_timeline.map(d => formatHour(d.hour)),
      datasets: [
        { label: 'Healthy', data: data.status_timeline.map(d => Number(d.healthy)), borderColor: '#4caf50', backgroundColor: alpha('#4caf50', 0.15), borderWidth: 2, tension: 0.4, fill: true, pointRadius: 0 },
        { label: 'Errored', data: data.status_timeline.map(d => Number(d.errored)), borderColor: '#ff9800', backgroundColor: alpha('#ff9800', 0.15), borderWidth: 2, tension: 0.4, fill: true, pointRadius: 0 },
        { label: 'Crashed', data: data.status_timeline.map(d => Number(d.crashed)), borderColor: '#f44336', backgroundColor: alpha('#f44336', 0.15), borderWidth: 2, tension: 0.4, fill: true, pointRadius: 0 },
      ],
    };
  }, [data]);

  // Duration distribution bar chart
  const durationChartData = useMemo(() => {
    if (!data?.duration_distribution) return { labels: [], datasets: [] };
    return {
      labels: data.duration_distribution.map(d => d.bucket),
      datasets: [{
        label: 'Sessions',
        data: data.duration_distribution.map(d => Number(d.count)),
        backgroundColor: alpha('#7c4dff', 0.6),
        borderColor: '#7c4dff',
        borderWidth: 0,
        borderRadius: 4,
        borderSkipped: false,
      }],
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

  const barOpts = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 9 } } },
      y: { beginAtZero: true, border: { display: false }, grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 } } },
    },
  }), [isDark]);

  const statCards = [
    { icon: <DevicesIcon />, color: '#7c4dff', label: t('argus.sessions.totalSessions'), value: s?.total_sessions, prev: pp?.total_sessions, invertChange: false },
    { icon: <PeopleIcon />, color: '#2196f3', label: t('argus.sessions.uniqueUsers'), value: s?.unique_users, prev: pp?.unique_users, invertChange: false },
    { icon: <CrashIcon />, color: '#f44336', label: t('argus.sessions.crashed'), value: s?.crashed, prev: pp?.crashed, invertChange: true },
    { icon: <TimerIcon />, color: '#ff9800', label: t('argus.sessions.avgDuration'), value: s ? `${Math.round(Number(s.avg_duration) / 1000)}s` : undefined, prev: undefined, invertChange: false },
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <DevicesIcon sx={{ color: theme.palette.info.main }} />
        <Typography variant="h5" fontWeight={700}>
          {t('argus.sessions.title')}
        </Typography>
      </Box>

      {/* Filter Bar */}
      <ArgusFilterBar
        projectId={projectId}
        value={filters}
        onChange={handleFilterChange}
        onRefresh={fetchData}
        loading={loading}
      />

      <PageContentLoader loading={loading}>
        {/* Top Row: Donut + Stats */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '280px 1fr' }, gap: 2, mb: 3 }}>
          {/* Crash-free Donut */}
          <Paper elevation={0} sx={{
            p: 3, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            borderRadius: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <Box sx={{ position: 'relative', width: 160, height: 160 }}>
              <Doughnut data={donutData} options={donutOpts} />
              <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <Typography variant="h4" fontWeight={800} sx={{ color: rateColor, lineHeight: 1 }}>
                  {crashFreeRate.toFixed(1)}%
                </Typography>
                <Typography variant="caption" sx={{ color: isDark ? '#777' : '#999', fontSize: '0.65rem' }}>
                  {t('argus.sessions.crashFree')}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, mt: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                { label: 'Healthy', value: s?.healthy, color: '#4caf50' },
                { label: 'Crashed', value: s?.crashed, color: '#f44336' },
                { label: 'Errored', value: s?.errored, color: '#ff9800' },
                { label: 'Abnormal', value: s?.abnormal, color: '#9e9e9e' },
              ].map((item, idx) => (
                <Box key={`legend-${idx}`} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: item.color }} />
                  <Typography variant="caption" sx={{ fontSize: '0.68rem' }}>
                    {item.label} <strong>{Number(item.value || 0).toLocaleString()}</strong>
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>

          {/* Stat Cards Grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
            {statCards.map((card, idx) => {
              const change = typeof card.value === 'number' && typeof card.prev === 'number' ? calcChange(card.value, card.prev) : null;
              return (
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
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                      <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.2 }}>
                        {typeof card.value === 'number' ? card.value.toLocaleString() : card.value ?? '-'}
                      </Typography>
                      {change != null && (
                        <ChangeIndicator value={change} invert={card.invertChange} />
                      )}
                    </Box>
                    <Typography variant="caption" sx={{ color: isDark ? '#777' : '#999', fontWeight: 500 }}>
                      {card.label}
                    </Typography>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        </Box>

        {/* Session Status Timeline (Stacked Area) */}
        <Paper elevation={0} sx={{ p: 2.5, mb: 3, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, borderRadius: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 3, height: 16, borderRadius: 1, backgroundColor: '#4caf50', mr: 0.5 }} />
            {t('argus.sessions.crashFreeTrend')}
          </Typography>
          <Box sx={{ height: 240 }}>
            <Line data={statusTimelineData} options={chartOpts} plugins={[getCrosshairPlugin(isDark)]} />
          </Box>
        </Paper>

        {/* Duration Distribution + Crash by Browser/OS */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2, mb: 3 }}>
          {/* Duration Distribution */}
          <Paper elevation={0} sx={{ p: 2.5, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <TimerIcon fontSize="small" sx={{ color: '#7c4dff' }} />
              Session Duration Distribution
            </Typography>
            <Box sx={{ height: 180 }}>
              <Bar data={durationChartData} options={barOpts} />
            </Box>
          </Paper>

          {/* Crash by Browser */}
          <Paper elevation={0} sx={{ p: 2.5, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <WarningIcon fontSize="small" sx={{ color: '#f44336' }} />
              Crash Rate by Browser
            </Typography>
            <CrashDistribution data={data?.crash_by_browser?.map(d => ({ label: d.browser, total: Number(d.total), crashed: Number(d.crashed), rate: Number(d.crash_rate) })) || []} isDark={isDark} />
          </Paper>

          {/* Crash by OS */}
          <Paper elevation={0} sx={{ p: 2.5, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <WarningIcon fontSize="small" sx={{ color: '#ff9800' }} />
              Crash Rate by OS
            </Typography>
            <CrashDistribution data={data?.crash_by_os?.map(d => ({ label: d.os, total: Number(d.total), crashed: Number(d.crashed), rate: Number(d.crash_rate) })) || []} isDark={isDark} />
          </Paper>
        </Box>

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
                        {Number(r.total).toLocaleString()} sessions · {Number(r.users).toLocaleString()} users
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
                  <Chip label={`${Number(r.crashed)} crashes`} size="small" sx={{
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

// --- Sub-components ---

const ChangeIndicator: React.FC<{ value: number; invert?: boolean }> = ({ value, invert }) => {
  const isUp = value > 0;
  const isGood = invert ? !isUp : isUp;
  const color = isGood ? '#4caf50' : '#f44336';
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.2 }}>
      {isUp ? <TrendingUpIcon sx={{ fontSize: 13, color }} /> : <TrendingDownIcon sx={{ fontSize: 13, color }} />}
      <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 700, color }}>
        {Math.abs(value).toFixed(0)}%
      </Typography>
    </Box>
  );
};

const CrashDistribution: React.FC<{ data: { label: string; total: number; crashed: number; rate: number }[]; isDark: boolean }> = ({ data, isDark }) => {
  if (data.length === 0) return <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>No data</Typography>;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.7 }}>
      {data.slice(0, 5).map((item, idx) => (
        <Box key={`${item.label}-${idx}`}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.2 }}>
            <Typography variant="caption" sx={{ fontSize: '0.72rem', fontWeight: 500 }}>{item.label}</Typography>
            <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'center' }}>
              <Typography variant="caption" sx={{ fontSize: '0.65rem', color: isDark ? '#777' : '#999' }}>
                {item.crashed}/{item.total}
              </Typography>
              <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.7rem', color: item.rate > 5 ? '#f44336' : item.rate > 1 ? '#ff9800' : '#4caf50' }}>
                {item.rate.toFixed(1)}%
              </Typography>
            </Box>
          </Box>
          <Box sx={{ height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
            <Box sx={{ height: '100%', borderRadius: 2, width: `${Math.min(item.rate * 5, 100)}%`, backgroundColor: item.rate > 5 ? alpha('#f44336', 0.7) : item.rate > 1 ? alpha('#ff9800', 0.6) : alpha('#4caf50', 0.5), transition: 'width 0.4s' }} />
          </Box>
        </Box>
      ))}
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
