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
  Skeleton,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  BugReport as BugReportIcon,
  Speed as SpeedIcon,
  People as PeopleIcon,
  CheckCircle as CheckCircleIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { getCrosshairPlugin } from '../../utils/chartPlugins';
import { useNavigate } from 'react-router-dom';
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
import { Line, Bar } from 'react-chartjs-2';
import argusService, { ArgusOverviewData } from '@/services/argusService';
import ArgusSparkline from '@/components/argus/ArgusSparkline';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Title, ChartTooltip, Legend, Filler
);

const TIME_RANGES = [
  { value: '1h', label: '1H' },
  { value: '6h', label: '6H' },
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
];

const ArgusOverviewPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  const [data, setData] = useState<ArgusOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(() => localStorage.getItem('argus-overview-period') || '24h');
  const projectId = '1';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await argusService.getOverview(projectId, period);
      setData(result);
    } catch (error) {
      console.error('Failed to fetch overview:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePeriodChange = (_: React.MouseEvent<HTMLElement>, value: string | null) => {
    if (!value) return;
    setPeriod(value);
    localStorage.setItem('argus-overview-period', value);
  };

  // --- Chart Data ---
  const errorTrendData = data?.error_trend?.map((d: any) => d.count) || [];
  const txnTrendData = data?.transaction_trend?.map((d: any) => d.count) || [];

  const errorChartData = useMemo(() => {
    if (!data?.error_trend) return { labels: [], datasets: [] };
    return {
      labels: data.error_trend.map((d: any) => formatHourLabel(d.hour)),
      datasets: [{
        label: t('argus.overview.errors'),
        data: data.error_trend.map((d: any) => d.count),
        borderColor: theme.palette.error.main,
        backgroundColor: (ctx: any) => {
          const gradient = ctx.chart?.ctx?.createLinearGradient(0, 0, 0, 220);
          if (gradient) {
            gradient.addColorStop(0, alpha(theme.palette.error.main, 0.25));
            gradient.addColorStop(1, alpha(theme.palette.error.main, 0.01));
          }
          return gradient || alpha(theme.palette.error.main, 0.1);
        },
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: theme.palette.error.main,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
      }],
    };
  }, [data, theme, t]);

  const txnChartData = useMemo(() => {
    if (!data?.transaction_trend) return { labels: [], datasets: [] };
    return {
      labels: data.transaction_trend.map((d: any) => formatHourLabel(d.hour)),
      datasets: [{
        label: t('argus.overview.throughput'),
        data: data.transaction_trend.map((d: any) => d.count),
        backgroundColor: (ctx: any) => {
          const gradient = ctx.chart?.ctx?.createLinearGradient(0, 0, 0, 220);
          if (gradient) {
            gradient.addColorStop(0, alpha(theme.palette.primary.main, 0.7));
            gradient.addColorStop(1, alpha(theme.palette.primary.main, 0.2));
          }
          return gradient || alpha(theme.palette.primary.main, 0.5);
        },
        borderColor: theme.palette.primary.main,
        borderWidth: 0,
        borderRadius: 3,
        borderSkipped: false,
      }],
    };
  }, [data, theme, t]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: isDark ? 'rgba(30,30,40,0.95)' : 'rgba(255,255,255,0.95)',
        titleColor: isDark ? '#fff' : '#1a1a2e',
        bodyColor: isDark ? '#ccc' : '#555',
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8, font: { size: 10 }, color: isDark ? '#666' : '#999' },
      },
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', drawBorder: false },
        ticks: { font: { size: 10 }, color: isDark ? '#555' : '#aaa', padding: 8 },
      },
    },
    interaction: { mode: 'nearest' as const, axis: 'x' as const, intersect: false },
  }), [isDark]);

  const es = data?.error_summary;
  const ts = data?.transaction_summary;
  const ss = data?.session_summary;

  // --- Stat Card Configs ---
  const statCards = [
    {
      icon: <BugReportIcon />,
      gradient: isDark
        ? `linear-gradient(135deg, ${alpha('#f44336', 0.15)}, ${alpha('#ff5252', 0.05)})`
        : `linear-gradient(135deg, ${alpha('#f44336', 0.08)}, ${alpha('#ff5252', 0.02)})`,
      borderColor: alpha('#f44336', 0.3),
      color: '#f44336',
      label: t('argus.overview.totalErrors'),
      value: es?.total_errors,
      sparkData: errorTrendData,
    },
    {
      icon: <PeopleIcon />,
      gradient: isDark
        ? `linear-gradient(135deg, ${alpha('#ff9800', 0.15)}, ${alpha('#ffa726', 0.05)})`
        : `linear-gradient(135deg, ${alpha('#ff9800', 0.08)}, ${alpha('#ffa726', 0.02)})`,
      borderColor: alpha('#ff9800', 0.3),
      color: '#ff9800',
      label: t('argus.overview.affectedUsers'),
      value: es?.affected_users,
      sparkData: errorTrendData,
    },
    {
      icon: <SpeedIcon />,
      gradient: isDark
        ? `linear-gradient(135deg, ${alpha('#7c4dff', 0.15)}, ${alpha('#536dfe', 0.05)})`
        : `linear-gradient(135deg, ${alpha('#7c4dff', 0.08)}, ${alpha('#536dfe', 0.02)})`,
      borderColor: alpha('#7c4dff', 0.3),
      color: '#7c4dff',
      label: t('argus.overview.transactions'),
      value: ts?.total_transactions,
      sparkData: txnTrendData,
    },
    {
      icon: <CheckCircleIcon />,
      gradient: isDark
        ? `linear-gradient(135deg, ${alpha('#4caf50', 0.15)}, ${alpha('#66bb6a', 0.05)})`
        : `linear-gradient(135deg, ${alpha('#4caf50', 0.08)}, ${alpha('#66bb6a', 0.02)})`,
      borderColor: alpha('#4caf50', 0.3),
      color: '#4caf50',
      label: t('argus.overview.crashFreeRate'),
      value: ss ? `${Number(ss.crash_free_rate).toFixed(1)}%` : undefined,
      sparkData: [],
    },
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BugReportIcon sx={{ color: theme.palette.error.main }} />
          {t('argus.overview.title')}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ToggleButtonGroup value={period} exclusive onChange={handlePeriodChange} size="small">
            {TIME_RANGES.map((r) => (
              <ToggleButton
                key={r.value}
                value={r.value}
                sx={{
                  px: 1.5, py: 0.3, textTransform: 'none', fontSize: '0.75rem', minWidth: 36,
                  '&.Mui-selected': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.15),
                    color: theme.palette.primary.main,
                    fontWeight: 600,
                  },
                }}
              >
                {r.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <IconButton onClick={fetchData} disabled={loading} size="small">
            <RefreshIcon sx={{ transition: 'transform 0.3s', ...(loading && { animation: 'spin 1s linear infinite', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }) }} />
          </IconButton>
        </Box>
      </Box>

      {/* Stat Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 2, mb: 3 }}>
        {statCards.map((card, idx) => (
          <Paper
            key={idx}
            elevation={0}
            sx={{
              p: 2.5,
              background: card.gradient,
              border: `1px solid ${card.borderColor}`,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 4px 20px ${alpha(card.color, 0.15)}` },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  width: 42, height: 42, borderRadius: 2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: alpha(card.color, isDark ? 0.2 : 0.1),
                  color: card.color,
                }}
              >
                {React.cloneElement(card.icon, { sx: { fontSize: 22 } })}
              </Box>
              <Box>
                {loading ? (
                  <Skeleton width={60} height={32} />
                ) : (
                  <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1.2, color: isDark ? '#fff' : '#1a1a2e' }}>
                    {typeof card.value === 'number' ? card.value.toLocaleString() : card.value ?? '-'}
                  </Typography>
                )}
                <Typography variant="caption" sx={{ color: isDark ? '#888' : '#777', fontWeight: 500, letterSpacing: 0.3 }}>
                  {card.label}
                </Typography>
              </Box>
            </Box>
            {card.sparkData.length > 2 && (
              <ArgusSparkline data={card.sparkData} width={70} height={28} color={card.color} />
            )}
          </Paper>
        ))}
      </Box>

      {/* Charts Row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 3 }}>
        <Paper elevation={0} sx={{ p: 2.5, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, borderRadius: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 3, height: 16, borderRadius: 1, backgroundColor: theme.palette.error.main, mr: 0.5 }} />
            {t('argus.overview.errorTrend')}
          </Typography>
          <Box sx={{ height: 220 }}>
            {loading ? <Skeleton variant="rounded" height={220} /> : <Line data={errorChartData} options={chartOptions} plugins={[getCrosshairPlugin(isDark)]} />}
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ p: 2.5, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, borderRadius: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 3, height: 16, borderRadius: 1, backgroundColor: theme.palette.primary.main, mr: 0.5 }} />
            {t('argus.overview.transactionThroughput')}
          </Typography>
          <Box sx={{ height: 220 }}>
            {loading ? <Skeleton variant="rounded" height={220} /> : <Bar data={txnChartData} options={chartOptions} />}
          </Box>
        </Paper>
      </Box>

      {/* Bottom Row: Performance Summary + Top Issues */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' }, gap: 2 }}>
        {/* Performance Metrics */}
        <Paper elevation={0} sx={{ p: 2.5, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, borderRadius: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TrendingUpIcon fontSize="small" sx={{ color: theme.palette.primary.main }} />
            {t('argus.overview.performanceSummary')}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <MetricBar label="P50" value={Number(ts?.p50 || 0)} max={Number(ts?.p99 || 1000)} color={theme.palette.success.main} />
            <MetricBar label="P95" value={Number(ts?.p95 || 0)} max={Number(ts?.p99 || 1000)} color={theme.palette.warning.main} />
            <MetricBar label="P99" value={Number(ts?.p99 || 0)} max={Number(ts?.p99 || 1000)} color={theme.palette.error.main} />
            <Box sx={{ mt: 1, pt: 1.5, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
              <MetricRow label={t('argus.overview.avgDuration')} value={`${Number(ts?.avg_duration || 0).toFixed(0)}ms`} />
              <MetricRow label={t('argus.overview.errorRate')} value={`${Number(ts?.error_rate || 0).toFixed(2)}%`} highlight={Number(ts?.error_rate || 0) > 5} />
            </Box>
          </Box>
        </Paper>

        {/* Top Issues */}
        <Paper elevation={0} sx={{ p: 2.5, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <BugReportIcon fontSize="small" sx={{ color: theme.palette.error.main }} />
              {t('argus.overview.topIssues')}
            </Typography>
            <Chip
              label={t('argus.overview.viewAll')}
              size="small"
              variant="outlined"
              deleteIcon={<ArrowForwardIcon sx={{ fontSize: '14px !important' }} />}
              onDelete={() => navigate('/argus/issues')}
              onClick={() => navigate('/argus/issues')}
              sx={{ cursor: 'pointer', borderRadius: 1.5, fontSize: '0.72rem' }}
            />
          </Box>
          {!data?.top_issues || data.top_issues.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">{t('argus.overview.noIssues')}</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {data.top_issues.map((issue: any, idx: number) => {
                const levelColor = issue.level === 'fatal' ? '#f44336'
                  : issue.level === 'error' ? '#ff5722'
                  : issue.level === 'warning' ? '#ff9800' : '#2196f3';
                return (
                  <Box
                    key={issue.fingerprint || idx}
                    onClick={() => navigate('/argus/issues')}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      p: 1, pl: 0, borderRadius: 1.5,
                      cursor: 'pointer', transition: 'background 0.15s',
                      '&:hover': { backgroundColor: alpha(levelColor, 0.06) },
                    }}
                  >
                    {/* Level color bar */}
                    <Box sx={{ width: 3, height: 32, borderRadius: 1, backgroundColor: levelColor, flexShrink: 0 }} />
                    {/* Rank */}
                    <Typography variant="caption" sx={{ color: isDark ? '#555' : '#bbb', fontWeight: 700, fontSize: '0.7rem', width: 14, textAlign: 'center' }}>
                      {idx + 1}
                    </Typography>
                    {/* Info */}
                    <Box sx={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap sx={{ lineHeight: 1.3 }}>
                        {issue.title || issue.fingerprint?.slice(0, 16)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.7rem' }}>
                        {issue.subtitle}
                      </Typography>
                    </Box>
                    {/* Event count badge */}
                    <Box sx={{
                      px: 1.2, py: 0.3, borderRadius: 1,
                      backgroundColor: alpha(levelColor, isDark ? 0.15 : 0.08),
                      display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0,
                    }}>
                      <Typography variant="caption" fontWeight={700} sx={{ color: levelColor, fontSize: '0.72rem' }}>
                        {issue.event_count?.toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
};

// --- Sub-components ---

const MetricBar: React.FC<{ label: string; value: number; max: number; color: string }> = ({ label, value, max, color }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={500}>{label}</Typography>
        <Typography variant="caption" fontWeight={700}>{value.toFixed(0)}ms</Typography>
      </Box>
      <Box sx={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(128,128,128,0.1)', overflow: 'hidden' }}>
        <Box sx={{
          height: '100%', borderRadius: 3, width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}, ${color}aa)`,
          transition: 'width 0.5s ease',
        }} />
      </Box>
    </Box>
  );
};

const MetricRow: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.3 }}>
    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>{label}</Typography>
    <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.82rem', ...(highlight && { color: 'error.main' }) }}>{value}</Typography>
  </Box>
);

function formatHourLabel(hourStr: string): string {
  try {
    const d = new Date(hourStr);
    return `${String(d.getHours()).padStart(2, '0')}:00`;
  } catch {
    return hourStr;
  }
}

export default ArgusOverviewPage;
