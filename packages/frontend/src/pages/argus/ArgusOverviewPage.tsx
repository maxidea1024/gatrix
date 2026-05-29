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
  Divider,
} from '@mui/material';
import PageContentLoader from '@/components/common/PageContentLoader';
import {
  Refresh as RefreshIcon,
  BugReport as BugReportIcon,
  Speed as SpeedIcon,
  People as PeopleIcon,
  CheckCircle as CheckCircleIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
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

  // TODO: make project selectable
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePeriodChange = (_: React.MouseEvent<HTMLElement>, value: string | null) => {
    if (!value) return;
    setPeriod(value);
    localStorage.setItem('argus-overview-period', value);
  };

  // --- Chart data ---
  const errorChartData = useMemo(() => {
    if (!data?.error_trend) return { labels: [], datasets: [] };
    const labels = data.error_trend.map((d) => formatHourLabel(d.hour));
    return {
      labels,
      datasets: [
        {
          label: t('argus.overview.errors'),
          data: data.error_trend.map((d) => d.count),
          borderColor: theme.palette.error.main,
          backgroundColor: `${theme.palette.error.main}20`,
          borderWidth: 2,
          tension: 0.3,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 3,
        },
      ],
    };
  }, [data, theme, t]);

  const txnChartData = useMemo(() => {
    if (!data?.transaction_trend) return { labels: [], datasets: [] };
    const labels = data.transaction_trend.map((d) => formatHourLabel(d.hour));
    return {
      labels,
      datasets: [
        {
          label: t('argus.overview.throughput'),
          data: data.transaction_trend.map((d) => d.count),
          backgroundColor: `${theme.palette.primary.main}80`,
          borderColor: theme.palette.primary.main,
          borderWidth: 1,
          borderRadius: 2,
        },
      ],
    };
  }, [data, theme, t]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false as const,
      plugins: {
        legend: { display: false },
        tooltip: { mode: 'index' as const, intersect: false },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8, font: { size: 10 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
          ticks: { font: { size: 10 } },
        },
      },
      interaction: { mode: 'nearest' as const, axis: 'x' as const, intersect: false },
    }),
    [isDark]
  );

  const es = data?.error_summary;
  const ts = data?.transaction_summary;
  const ss = data?.session_summary;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <BugReportIcon sx={{ fontSize: 28, color: theme.palette.error.main }} />
          <Typography variant="h5" fontWeight={700}>
            {t('argus.overview.title')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ToggleButtonGroup value={period} exclusive onChange={handlePeriodChange} size="small">
            {TIME_RANGES.map((r) => (
              <ToggleButton
                key={r.value}
                value={r.value}
                sx={{ px: 1.2, py: 0.3, textTransform: 'none', fontSize: '0.75rem', minWidth: 36 }}
              >
                {r.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <IconButton onClick={fetchData} disabled={loading} size="small">
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      <PageContentLoader loading={loading}>
        {/* Summary Cards */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <StatCard
            icon={<BugReportIcon />}
            color={theme.palette.error.main}
            label={t('argus.overview.totalErrors')}
            value={es?.total_errors}
          />
          <StatCard
            icon={<PeopleIcon />}
            color={theme.palette.warning.main}
            label={t('argus.overview.affectedUsers')}
            value={es?.affected_users}
          />
          <StatCard
            icon={<SpeedIcon />}
            color={theme.palette.primary.main}
            label={t('argus.overview.transactions')}
            value={ts?.total_transactions}
          />
          <StatCard
            icon={<CheckCircleIcon />}
            color={theme.palette.success.main}
            label={t('argus.overview.crashFreeRate')}
            value={ss ? `${Number(ss.crash_free_rate).toFixed(1)}%` : undefined}
          />
        </Box>

        {/* Charts Row */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          {/* Error Trend */}
          <Paper sx={{ p: 2, flex: '1 1 400px', minWidth: 300 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
              {t('argus.overview.errorTrend')}
            </Typography>
            <Box sx={{ height: 220 }}>
              <Line data={errorChartData} options={chartOptions} />
            </Box>
          </Paper>

          {/* Transaction Throughput */}
          <Paper sx={{ p: 2, flex: '1 1 400px', minWidth: 300 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
              {t('argus.overview.transactionThroughput')}
            </Typography>
            <Box sx={{ height: 220 }}>
              <Bar data={txnChartData} options={chartOptions} />
            </Box>
          </Paper>
        </Box>

        {/* Performance Summary + Top Issues */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {/* Performance Metrics */}
          <Paper sx={{ p: 2, flex: '1 1 300px', minWidth: 260 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <TrendingUpIcon fontSize="small" color="primary" />
              <Typography variant="subtitle2" fontWeight={600}>
                {t('argus.overview.performanceSummary')}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <MetricRow label="P50" value={`${Number(ts?.p50 || 0).toFixed(0)}ms`} />
              <MetricRow label="P95" value={`${Number(ts?.p95 || 0).toFixed(0)}ms`} />
              <MetricRow label="P99" value={`${Number(ts?.p99 || 0).toFixed(0)}ms`} />
              <Divider sx={{ my: 0.5 }} />
              <MetricRow label={t('argus.overview.avgDuration')} value={`${Number(ts?.avg_duration || 0).toFixed(0)}ms`} />
              <MetricRow label={t('argus.overview.errorRate')} value={`${Number(ts?.error_rate || 0).toFixed(2)}%`} />
            </Box>
          </Paper>

          {/* Top Issues */}
          <Paper sx={{ p: 2, flex: '2 1 400px', minWidth: 300 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BugReportIcon fontSize="small" color="error" />
                <Typography variant="subtitle2" fontWeight={600}>
                  {t('argus.overview.topIssues')}
                </Typography>
              </Box>
              <Chip
                label={t('argus.overview.viewAll')}
                size="small"
                variant="outlined"
                onClick={() => navigate('/argus/issues')}
                sx={{ cursor: 'pointer' }}
              />
            </Box>
            {data?.top_issues?.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                {t('argus.overview.noIssues')}
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {data?.top_issues?.map((issue, idx) => (
                  <Box
                    key={issue.fingerprint}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1,
                      borderRadius: 1,
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: theme.palette.action.hover },
                    }}
                    onClick={() => navigate('/argus/issues')}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 16 }}>
                      {idx + 1}
                    </Typography>
                    <Box sx={{ flex: 1, overflow: 'hidden' }}>
                      <Typography
                        variant="body2"
                        fontWeight={500}
                        sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {issue.title || issue.fingerprint.slice(0, 16)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {issue.subtitle}
                      </Typography>
                    </Box>
                    <Chip label={issue.event_count.toLocaleString()} size="small" variant="outlined" />
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Box>
      </PageContentLoader>
    </Box>
  );
};

// --- Sub-components ---

interface StatCardProps {
  icon: React.ReactElement;
  color: string;
  label: string;
  value?: number | string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, color, label, value }) => (
  <Paper
    sx={{
      p: 2,
      flex: '1 1 180px',
      minWidth: 150,
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
    }}
  >
    <Box
      sx={{
        width: 40,
        height: 40,
        borderRadius: 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${color}15`,
        color,
      }}
    >
      {React.cloneElement(icon, { fontSize: 'small' })}
    </Box>
    <Box>
      <Typography variant="h6" fontWeight={700}>
        {typeof value === 'number' ? value.toLocaleString() : value ?? '-'}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  </Paper>
);

const MetricRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="body2" fontWeight={600}>
      {value}
    </Typography>
  </Box>
);

function formatHourLabel(hourStr: string): string {
  try {
    const d = new Date(hourStr);
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;
  } catch {
    return hourStr;
  }
}

export default ArgusOverviewPage;
