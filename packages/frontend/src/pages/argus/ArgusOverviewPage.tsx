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
  BugReport as BugReportIcon,
  Speed as SpeedIcon,
  People as PeopleIcon,
  CheckCircle as CheckCircleIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  ArrowForward as ArrowForwardIcon,
  ReportProblem as UnhandledIcon,
  GridView as HeatmapIcon,
  DevicesOther as DevicesIcon,
  Cloud as EnvIcon,
  NewReleases as ReleaseIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { getCrosshairPlugin, getDragSelectPlugin } from '../../utils/chartPlugins';
import { formatCompactNumber } from '../../utils/numberFormat';
import { useNavigate, useLocation } from 'react-router-dom';
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
import ArgusFilterBar, { ArgusFilterState, defaultArgusFilterState, argusFilterStateToApiParams } from '@/components/argus/ArgusFilterBar';
import { argusDateRangeToApiParams } from '@/components/argus/ArgusDateRangePicker';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import useArgusUrlState from '@/hooks/useArgusUrlState';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import PageHeader from '@/components/common/PageHeader';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Title, ChartTooltip, Legend, Filler
);



const DAY_KEYS = ['common.day.mon', 'common.day.tue', 'common.day.wed', 'common.day.thu', 'common.day.fri', 'common.day.sat', 'common.day.sun'];

const ArgusOverviewPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  const URL_PARAMS = useMemo(() => ({
    period: { key: 'period', default: '24h', storageKey: 'argus-overview-period' },
  }), []);
  const [urlState, setUrlState] = useArgusUrlState(URL_PARAMS);

  const [data, setData] = useState<ArgusOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const filters = useMemo<ArgusFilterState>(
    () => defaultArgusFilterState(urlState.period),
    [urlState.period],
  );
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const apiParams = argusDateRangeToApiParams(filters.dateRange);
      const result = await argusService.getOverview(projectId, apiParams.period, apiParams.start, apiParams.end);
      setData(result);
    } catch (error) {
      console.error('Failed to fetch overview:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFilterChange = (newFilters: ArgusFilterState) => {
    if (newFilters.dateRange.type === 'preset' && newFilters.dateRange.preset) {
      setUrlState({ period: newFilters.dateRange.preset });
    }
  };

  // --- Helpers ---
  const calcChange = (current: number | undefined, previous: number | undefined): number | null => {
    if (current == null || previous == null || previous === 0) return null;
    return ((current - previous) / previous) * 100;
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
  const pp = data?.previous_period;

  const errorChange = calcChange(es?.total_errors, pp?.total_errors);
  const userChange = calcChange(es?.affected_users, pp?.affected_users);
  const txnChange = calcChange(ts?.total_transactions, pp?.total_transactions);

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
      change: errorChange,
      sparkData: errorTrendData,
      invertChange: true,
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
      change: userChange,
      sparkData: errorTrendData,
      invertChange: true,
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
      change: txnChange,
      sparkData: txnTrendData,
      invertChange: false,
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
      change: null,
      sparkData: [],
      invertChange: false,
    },
    {
      icon: <UnhandledIcon />,
      gradient: isDark
        ? `linear-gradient(135deg, ${alpha('#ef5350', 0.15)}, ${alpha('#e53935', 0.05)})`
        : `linear-gradient(135deg, ${alpha('#ef5350', 0.08)}, ${alpha('#e53935', 0.02)})`,
      borderColor: alpha('#ef5350', 0.3),
      color: '#ef5350',
      label: t('argus.overview.unhandledRate'),
      value: data ? `${Number(data.unhandled_rate || 0).toFixed(1)}%` : undefined,
      change: null,
      sparkData: [],
      invertChange: true,
    },
  ];

  // --- Heatmap data ---
  const heatmapMax = Math.max(1, ...(data?.error_heatmap?.map(h => Number(h.count)) || [1]));

  return (
    <Box>
      {/* Header */}
      <PageHeader
        icon={<BugReportIcon />}
        title={t('argus.overview.title')}
        subtitle={t('argus.overview.subtitle')}
        enableAutoBack
      />

      {/* Filter Bar */}
      <ArgusFilterBar
        projectId={projectId}
        value={filters}
        onChange={handleFilterChange}
        onRefresh={fetchData}
        loading={loading}
      />

      {/* Stat Cards — with change indicators */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
        {statCards.map((card, idx) => (
          <Paper
            key={idx}
            elevation={0}
            sx={{
              p: 2,
              background: card.gradient,
              border: `1px solid ${card.borderColor}`,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              overflow: 'hidden',
              transition: 'all 0.2s ease',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 4px 20px ${alpha(card.color, 0.15)}` },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
              <Box
                sx={{
                  width: 40, height: 40, borderRadius: 2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: alpha(card.color, isDark ? 0.2 : 0.1),
                  color: card.color,
                  flexShrink: 0,
                }}
              >
                {React.cloneElement(card.icon, { sx: { fontSize: 20 } })}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                {loading ? (
                  <Skeleton width={60} height={28} />
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.8, flexWrap: 'wrap' }}>
                    <Tooltip title={typeof card.value === 'number' && card.value >= 1000 ? card.value.toLocaleString() : ''} arrow>
                      <Typography variant="h6" fontWeight={800} noWrap sx={{ lineHeight: 1.2, color: isDark ? '#fff' : '#1a1a2e', maxWidth: '100%' }}>
                        {typeof card.value === 'number' ? formatCompactNumber(card.value) : card.value ?? '-'}
                      </Typography>
                    </Tooltip>
                    {card.change != null && (
                      <Box sx={{ flexShrink: 0 }}>
                        <ChangeIndicator value={card.change} invert={card.invertChange} />
                      </Box>
                    )}
                  </Box>
                )}
                <Typography variant="caption" noWrap sx={{ color: isDark ? '#888' : '#777', fontWeight: 500, letterSpacing: 0.3, fontSize: '0.68rem', display: 'block' }}>
                  {card.label}
                </Typography>
              </Box>
            </Box>
            {card.sparkData.length > 2 && (
              <Box sx={{ flexShrink: 0, ml: 1 }}>
                <ArgusSparkline data={card.sparkData} width={60} height={24} color={card.color} />
              </Box>
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
            {loading ? <ArgusChartSkeleton type="line" height={220} color={theme.palette.error.main} /> : <Line data={errorChartData} options={chartOptions} plugins={[getCrosshairPlugin(isDark), getDragSelectPlugin(isDark, (si, ei) => {
              const trend = data?.error_trend;
              if (!trend) return;
              const startHour = trend[si]?.hour;
              const endHour = trend[ei]?.hour;
              if (startHour && endHour) {
                const start = new Date(startHour).toISOString();
                const end = new Date(new Date(endHour).getTime() + 3600000).toISOString();
                navigate(`/argus/issues?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
              }
            })]} />}
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ p: 2.5, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, borderRadius: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 3, height: 16, borderRadius: 1, backgroundColor: theme.palette.primary.main, mr: 0.5 }} />
            {t('argus.overview.transactionThroughput')}
          </Typography>
          <Box sx={{ height: 220 }}>
            {loading ? <ArgusChartSkeleton type="bar" height={220} color={theme.palette.primary.main} /> : <Bar data={txnChartData} options={chartOptions} plugins={[getDragSelectPlugin(isDark, (si, ei) => {
              const trend = data?.transaction_trend;
              if (!trend) return;
              const startHour = trend[si]?.hour;
              const endHour = trend[ei]?.hour;
              if (startHour && endHour) {
                const start = new Date(startHour).toISOString();
                const end = new Date(new Date(endHour).getTime() + 3600000).toISOString();
                navigate(`/argus/issues?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
              }
            })]} />}
          </Box>
        </Paper>
      </Box>

      {/* NEW: Error Heatmap */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 3, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, borderRadius: 2 }}>
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <HeatmapIcon fontSize="small" sx={{ color: theme.palette.error.main }} />
          {t('argus.overview.errorHeatmap')}
          <Typography variant="caption" sx={{ ml: 1, color: isDark ? '#666' : '#aaa' }}>
            {t('argus.overview.last7Days')}
          </Typography>
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', mb: 1.5, color: isDark ? '#555' : '#bbb', fontSize: '0.68rem' }}>
          {t('argus.overview.heatmapDesc')}
        </Typography>
        {loading ? (
          <Skeleton variant="rounded" height={180} />
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '48px repeat(24, 1fr)', gap: '2px', minWidth: 600 }}>
              {/* Hour labels header */}
              <Box />
              {Array.from({ length: 24 }, (_, h) => (
                <Typography key={`h-${h}`} variant="caption" sx={{ textAlign: 'center', fontSize: '0.6rem', color: isDark ? '#555' : '#bbb' }}>
                  {h.toString().padStart(2, '0')}
                </Typography>
              ))}
              {/* Rows: each day */}
              {DAY_KEYS.map((dayKey, dayIdx) => {
                const dayLabel = t(dayKey);
                return (
                <React.Fragment key={dayKey}>
                  <Typography variant="caption" sx={{ fontSize: '0.68rem', color: isDark ? '#777' : '#999', display: 'flex', alignItems: 'center', pr: 0.5 }}>
                    {dayLabel}
                  </Typography>
                  {Array.from({ length: 24 }, (_, h) => {
                    const cell = data?.error_heatmap?.find(c => Number(c.day) === dayIdx + 1 && Number(c.hour) === h);
                    const count = Number(cell?.count || 0);
                    const intensity = heatmapMax > 0 ? count / heatmapMax : 0;
                    return (
                      <Tooltip key={`${dayIdx}-${h}`} title={`${dayLabel} ${h.toString().padStart(2, '0')}:00 — ${count.toLocaleString()} ${t('argus.overview.errorEvents')}`} arrow>
                        <Box sx={{
                          height: 20,
                          borderRadius: 0.5,
                          backgroundColor: count === 0
                            ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)')
                            : alpha('#f44336', Math.max(0.1, Math.min(intensity, 1))),
                          transition: 'all 0.15s',
                          cursor: 'pointer',
                          '&:hover': { transform: 'scale(1.2)', zIndex: 1, outline: '1px solid rgba(244,67,54,0.5)' },
                        }}
                        onClick={() => navigate(`/argus/issues?dayOfWeek=${dayIdx + 1}&hour=${h}`)}
                      />
                      </Tooltip>
                    );
                  })}
                </React.Fragment>
                );
              })}
            </Box>
            {/* Legend */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1, justifyContent: 'flex-end' }}>
              <Typography variant="caption" sx={{ fontSize: '0.6rem', color: isDark ? '#555' : '#bbb', mr: 0.5 }}>{t('argus.overview.less')}</Typography>
              {[0.05, 0.2, 0.4, 0.6, 0.8, 1].map((v) => (
                <Box key={v} sx={{ width: 12, height: 12, borderRadius: 0.3, backgroundColor: alpha('#f44336', v) }} />
              ))}
              <Typography variant="caption" sx={{ fontSize: '0.6rem', color: isDark ? '#555' : '#bbb', ml: 0.5 }}>{t('argus.overview.more')}</Typography>
            </Box>
          </Box>
        )}
      </Paper>

      {/* NEW: Distribution Row — Environment / Browser / OS */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2, mb: 3 }}>
        <DistributionCard
          title={t('argus.overview.errorByEnv')}
          icon={<EnvIcon fontSize="small" sx={{ color: '#7c4dff' }} />}
          data={data?.error_by_environment?.map(d => ({ label: d.environment, value: Number(d.count) })) || []}
          loading={loading}
          isDark={isDark}
          color="#7c4dff"
          onItemClick={(label) => navigate(`/argus/issues?environment=${encodeURIComponent(label)}`)}
        />
        <DistributionCard
          title={t('argus.overview.errorByBrowser')}
          icon={<DevicesIcon fontSize="small" sx={{ color: '#2196f3' }} />}
          data={data?.error_by_browser?.map(d => ({ label: d.browser, value: Number(d.count) })) || []}
          loading={loading}
          isDark={isDark}
          color="#2196f3"
          onItemClick={(label) => navigate(`/argus/issues?browser=${encodeURIComponent(label)}`)}
        />
        <DistributionCard
          title={t('argus.overview.errorByOS')}
          icon={<DevicesIcon fontSize="small" sx={{ color: '#ff9800' }} />}
          data={data?.error_by_os?.map(d => ({ label: d.os, value: Number(d.count) })) || []}
          loading={loading}
          isDark={isDark}
          color="#ff9800"
          onItemClick={(label) => navigate(`/argus/issues?os=${encodeURIComponent(label)}`)}
        />
      </Box>

      {/* Bottom Row: Performance Summary + Release Health + Top Issues */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 2fr' }, gap: 2 }}>
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

        {/* NEW: Release Error Comparison */}
        <Paper elevation={0} sx={{ p: 2.5, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, borderRadius: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ReleaseIcon fontSize="small" sx={{ color: '#7c4dff' }} />
            {t('argus.overview.errorByRelease')}
          </Typography>
          {loading ? (
            <Skeleton variant="rounded" height={160} />
          ) : !data?.error_by_release?.length ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">{t('argus.overview.noData')}</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {data.error_by_release.map((r, idx) => {
                const maxCount = Math.max(...data.error_by_release.map(d => Number(d.count)));
                const pct = maxCount > 0 ? (Number(r.count) / maxCount) * 100 : 0;
                return (
                  <Box key={`${r.release}-${idx}`}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                      <Typography variant="caption" noWrap sx={{ fontFamily: 'monospace', fontSize: '0.72rem', maxWidth: '60%' }}>
                        {r.release}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Typography variant="caption" fontWeight={700} sx={{ color: '#f44336' }}>
                          {Number(r.count).toLocaleString()}
                        </Typography>
                        <Typography variant="caption" sx={{ color: isDark ? '#555' : '#bbb' }}>
                          {Number(r.users).toLocaleString()} {t('argus.overview.users')}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
                      <Box sx={{
                        height: '100%', borderRadius: 3, width: `${pct}%`,
                        background: `linear-gradient(90deg, #7c4dff, ${alpha('#7c4dff', 0.5)})`,
                        transition: 'width 0.5s ease',
                      }} />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
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
                    key={`${issue.fingerprint || 'issue'}-${idx}`}
                    onClick={() => navigate('/argus/issues')}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      p: 1, pl: 0, borderRadius: 1.5,
                      cursor: 'pointer', transition: 'background 0.15s',
                      '&:hover': { backgroundColor: alpha(levelColor, 0.06) },
                    }}
                  >
                    <Box sx={{ width: 3, height: 32, borderRadius: 1, backgroundColor: levelColor, flexShrink: 0 }} />
                    <Typography variant="caption" sx={{ color: isDark ? '#555' : '#bbb', fontWeight: 700, fontSize: '0.7rem', width: 14, textAlign: 'center' }}>
                      {idx + 1}
                    </Typography>
                    <Box sx={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap sx={{ lineHeight: 1.3 }}>
                        {issue.title || issue.fingerprint?.slice(0, 16)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.7rem' }}>
                        {issue.subtitle}
                      </Typography>
                    </Box>
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

const ChangeIndicator: React.FC<{ value: number; invert?: boolean }> = ({ value, invert }) => {
  const isUp = value > 0;
  // For errors: up is bad (red), down is good (green). For transactions: up is good.
  const isGood = invert ? !isUp : isUp;
  const color = isGood ? '#4caf50' : '#f44336';
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.2 }}>
      {isUp ? (
        <TrendingUpIcon sx={{ fontSize: 14, color }} />
      ) : (
        <TrendingDownIcon sx={{ fontSize: 14, color }} />
      )}
      <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 700, color }}>
        {Math.abs(value).toFixed(0)}%
      </Typography>
    </Box>
  );
};

const DistributionCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  data: { label: string; value: number }[];
  loading: boolean;
  isDark: boolean;
  color: string;
  onItemClick?: (label: string) => void;
}> = ({ title, icon, data, loading, isDark, color, onItemClick }) => {
  const { t } = useTranslation();
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <Paper elevation={0} sx={{ p: 2.5, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, borderRadius: 2 }}>
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {icon}
        {title}
      </Typography>
      {loading ? (
        <Skeleton variant="rounded" height={120} />
      ) : data.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>{t('argus.overview.noData')}</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
          {data.slice(0, 5).map((item, idx) => {
            const pct = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <Box
                key={`${item.label}-${idx}`}
                onClick={() => onItemClick?.(item.label)}
                sx={{
                  cursor: onItemClick ? 'pointer' : 'default',
                  borderRadius: 1,
                  px: 0.5,
                  py: 0.3,
                  transition: 'background 0.15s',
                  '&:hover': onItemClick ? { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' } : {},
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.2 }}>
                  <Typography variant="caption" sx={{ fontSize: '0.72rem', fontWeight: 500 }}>{item.label}</Typography>
                  <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'center' }}>
                    <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.7rem' }}>
                      {item.value.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.62rem', color: isDark ? '#555' : '#bbb' }}>
                      {pct.toFixed(1)}%
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
                  <Box sx={{
                    height: '100%', borderRadius: 2, width: `${pct}%`,
                    backgroundColor: alpha(color, 0.6 + idx * 0.05),
                    transition: 'width 0.4s ease',
                  }} />
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Paper>
  );
};

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
