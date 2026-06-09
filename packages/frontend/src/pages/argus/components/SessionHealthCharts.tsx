import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Timer as TimerIcon,
  Warning as WarningIcon,
  InfoOutlined as InfoIcon,
  VisibilityOff as HideIcon,
  Visibility as ShowIcon,
} from '@mui/icons-material';
import { Line, Bar } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getCrosshairPlugin } from '../../../utils/chartPlugins';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import { ArgusSessionHealth } from '@/services/argusService';
import { dateRangeToApiParams as argusDateRangeToApiParams } from '@/components/common/DateRangeSelector';
import { ArgusFilterState } from '@/components/argus/ArgusFilterBar';
import { CrashDistribution, formatHour } from './sessionHealthHelpers';

interface SessionHealthChartsProps {
  data: ArgusSessionHealth | null;
  loading: boolean;
  filters: ArgusFilterState;
  projectId: string | number;
  hideHealthy: boolean;
  onToggleHideHealthy: () => void;
}

const SessionHealthCharts: React.FC<SessionHealthChartsProps> = ({
  data,
  loading,
  filters,
  projectId,
  hideHealthy,
  onToggleHideHealthy,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();

  // ─── Chart Data ───
  const statusTimelineData = useMemo(() => {
    if (!data?.status_timeline) return { labels: [], datasets: [] };
    const datasets = [];
    if (!hideHealthy) {
      datasets.push({
        label: t('argus.sessions.healthy'),
        data: data.status_timeline.map((d) => Number(d.healthy)),
        borderColor: '#4caf50',
        backgroundColor: alpha('#4caf50', 0.15),
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 0,
      });
    }
    datasets.push(
      {
        label: t('argus.sessions.errored'),
        data: data.status_timeline.map((d) => Number(d.errored)),
        borderColor: '#ff9800',
        backgroundColor: alpha('#ff9800', 0.25),
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 0,
      },
      {
        label: t('argus.sessions.crashed'),
        data: data.status_timeline.map((d) => Number(d.crashed)),
        borderColor: '#f44336',
        backgroundColor: alpha('#f44336', 0.25),
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 0,
      }
    );
    return {
      labels: data.status_timeline.map((d) => formatHour(d.hour)),
      datasets,
    };
  }, [data, t, hideHealthy]);

  const durationChartData = useMemo(() => {
    if (!data?.duration_distribution) return { labels: [], datasets: [] };
    return {
      labels: data.duration_distribution.map((d) => d.bucket),
      datasets: [
        {
          label: t('argus.sessions.sessions'),
          data: data.duration_distribution.map((d) => Number(d.count)),
          backgroundColor: alpha('#7c4dff', 0.6),
          borderColor: '#7c4dff',
          borderWidth: 0,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    };
  }, [data, t]);

  const unhealthyChartData = useMemo(() => {
    if (!data?.status_timeline) return { labels: [], datasets: [] };
    return {
      labels: data.status_timeline.map((d) => formatHour(d.hour)),
      datasets: [
        {
          label: t('argus.sessions.errored'),
          data: data.status_timeline.map((d) => Number(d.errored)),
          backgroundColor: alpha('#ff9800', 0.7),
          borderColor: '#ff9800',
          borderWidth: 0,
          borderRadius: 2,
          borderSkipped: false as const,
        },
        {
          label: t('argus.sessions.crashed'),
          data: data.status_timeline.map((d) => Number(d.crashed)),
          backgroundColor: alpha('#f44336', 0.7),
          borderColor: '#f44336',
          borderWidth: 0,
          borderRadius: 2,
          borderSkipped: false as const,
        },
        {
          label: t('argus.sessions.abnormal'),
          data: data.status_timeline.map((d) => Number(d.abnormal)),
          backgroundColor: alpha('#9e9e9e', 0.7),
          borderColor: '#9e9e9e',
          borderWidth: 0,
          borderRadius: 2,
          borderSkipped: false as const,
        },
      ],
    };
  }, [data, t]);

  const chartOpts = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            boxWidth: 8,
            font: { size: 11 },
            usePointStyle: true,
            pointStyle: 'circle',
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 10,
            font: { size: 10 },
          },
        },
        y: {
          beginAtZero: true,
          stacked: true,
          border: { display: false },
          grid: {
            color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
          },
          ticks: { font: { size: 10 } },
        },
      },
      interaction: {
        mode: 'nearest' as const,
        axis: 'x' as const,
        intersect: false,
      },
    }),
    [isDark]
  );

  const barOpts = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { font: { size: 9 } },
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: {
            color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
          },
          ticks: { font: { size: 10 } },
        },
      },
    }),
    [isDark]
  );

  return (
    <>
      {/* Session Status Timeline */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 2.5,
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          borderRadius: 2,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="subtitle2"
              fontWeight={600}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <Box
                sx={{
                  width: 3,
                  height: 16,
                  borderRadius: 1,
                  backgroundColor: '#4caf50',
                  mr: 0.5,
                }}
              />
              {t('argus.sessions.crashFreeTrend')}
            </Typography>
            <Tooltip title={t('argus.sessions.crashFreeTrendDesc')} arrow>
              <InfoIcon
                sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }}
              />
            </Tooltip>
          </Box>
          <Tooltip
            title={
              hideHealthy
                ? t('argus.sessions.showHealthy')
                : t('argus.sessions.hideHealthy')
            }
            arrow
          >
            <Chip
              icon={
                hideHealthy ? (
                  <ShowIcon sx={{ fontSize: '14px !important' }} />
                ) : (
                  <HideIcon sx={{ fontSize: '14px !important' }} />
                )
              }
              label={
                hideHealthy
                  ? t('argus.sessions.showHealthy')
                  : t('argus.sessions.hideHealthy')
              }
              size="small"
              onClick={onToggleHideHealthy}
              variant={hideHealthy ? 'filled' : 'outlined'}
              sx={{
                fontSize: '0.68rem',
                height: 24,
                fontWeight: 600,
                ...(hideHealthy
                  ? {
                      backgroundColor: alpha('#ff9800', 0.15),
                      color: '#ff9800',
                      borderColor: 'transparent',
                      '& .MuiChip-icon': { color: '#ff9800' },
                    }
                  : {
                      borderColor: isDark
                        ? 'rgba(255,255,255,0.1)'
                        : 'rgba(0,0,0,0.1)',
                      color: 'text.secondary',
                    }),
              }}
            />
          </Tooltip>
        </Box>
        <Box sx={{ height: 220 }}>
          {loading ? (
            <ArgusChartSkeleton type="line" height={220} color="#4caf50" />
          ) : (
            <Line
              data={statusTimelineData}
              options={chartOpts}
              plugins={[getCrosshairPlugin(isDark)]}
            />
          )}
        </Box>
      </Paper>

      {/* Duration Distribution + Crash by Browser/OS */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' },
          gap: 2,
          mb: 2.5,
        }}
      >
        {/* Duration Distribution */}
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            borderRadius: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Typography
              variant="subtitle2"
              fontWeight={600}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <TimerIcon fontSize="small" sx={{ color: '#7c4dff' }} />
              {t('argus.sessions.durationDistribution')}
            </Typography>
            <Tooltip title={t('argus.sessions.durationDistDesc')} arrow>
              <InfoIcon
                sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }}
              />
            </Tooltip>
          </Box>
          <Box sx={{ height: 170 }}>
            {loading ? (
              <ArgusChartSkeleton type="bar" height={170} color="#7c4dff" />
            ) : (
              <Bar data={durationChartData} options={barOpts} />
            )}
          </Box>
        </Paper>

        {/* Crash by Browser */}
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            borderRadius: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Typography
              variant="subtitle2"
              fontWeight={600}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <WarningIcon fontSize="small" sx={{ color: '#f44336' }} />
              {t('argus.sessions.crashRateByBrowser')}
            </Typography>
            <Tooltip title={t('argus.sessions.crashByBrowserDesc')} arrow>
              <InfoIcon
                sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }}
              />
            </Tooltip>
          </Box>
          <CrashDistribution
            data={
              data?.crash_by_browser?.map((d) => ({
                label: d.browser,
                total: Number(d.total),
                crashed: Number(d.crashed),
                rate: Number(d.crash_rate),
              })) || []
            }
            isDark={isDark}
            onClick={(browser) => {
              const params = new URLSearchParams();
              params.set('projectId', String(projectId));
              params.set('browser', browser);
              const ap = argusDateRangeToApiParams(filters.dateRange);
              if (ap.start) params.set('start', ap.start);
              if (ap.end) params.set('end', ap.end);
              navigate(`/argus/issues?${params.toString()}`);
            }}
          />
        </Paper>

        {/* Crash by OS */}
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            borderRadius: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Typography
              variant="subtitle2"
              fontWeight={600}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <WarningIcon fontSize="small" sx={{ color: '#ff9800' }} />
              {t('argus.sessions.crashRateByOS')}
            </Typography>
            <Tooltip title={t('argus.sessions.crashByOSDesc')} arrow>
              <InfoIcon
                sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }}
              />
            </Tooltip>
          </Box>
          <CrashDistribution
            data={
              data?.crash_by_os?.map((d) => ({
                label: d.os,
                total: Number(d.total),
                crashed: Number(d.crashed),
                rate: Number(d.crash_rate),
              })) || []
            }
            isDark={isDark}
            onClick={(os) => {
              const params = new URLSearchParams();
              params.set('projectId', String(projectId));
              params.set('os', os);
              const ap = argusDateRangeToApiParams(filters.dateRange);
              if (ap.start) params.set('start', ap.start);
              if (ap.end) params.set('end', ap.end);
              navigate(`/argus/issues?${params.toString()}`);
            }}
          />
        </Paper>
      </Box>

      {/* Unhealthy Sessions Combined */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 2.5,
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          borderRadius: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Typography
            variant="subtitle2"
            fontWeight={600}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            <Box
              sx={{
                width: 3,
                height: 16,
                borderRadius: 1,
                backgroundColor: '#f44336',
                mr: 0.5,
              }}
            />
            {t('argus.sessions.unhealthyTimeline')}
          </Typography>
          <Tooltip title={t('argus.sessions.unhealthyTimelineDesc')} arrow>
            <InfoIcon
              sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }}
            />
          </Tooltip>
        </Box>
        <Box sx={{ height: 200 }}>
          {loading ? (
            <ArgusChartSkeleton type="bar" height={200} color="#f44336" />
          ) : (
            <Bar
              data={unhealthyChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 300 },
                plugins: {
                  legend: {
                    display: true,
                    position: 'top' as const,
                    labels: {
                      boxWidth: 8,
                      font: { size: 10 },
                      usePointStyle: true,
                      pointStyle: 'circle',
                    },
                  },
                  tooltip: {
                    callbacks: {
                      footer: (items: any[]) => {
                        const total = items.reduce(
                          (sum: number, i: any) => sum + (i.raw as number),
                          0
                        );
                        return `${t('common.total')}: ${total.toLocaleString()}`;
                      },
                    },
                  },
                },
                scales: {
                  x: {
                    stacked: true,
                    grid: { display: false },
                    border: { display: false },
                    ticks: {
                      maxRotation: 0,
                      autoSkip: true,
                      maxTicksLimit: 12,
                      font: { size: 10 },
                    },
                  },
                  y: {
                    stacked: true,
                    beginAtZero: true,
                    border: { display: false },
                    grid: {
                      color: isDark
                        ? 'rgba(255,255,255,0.04)'
                        : 'rgba(0,0,0,0.04)',
                    },
                    ticks: { font: { size: 10 } },
                  },
                },
                interaction: { mode: 'index' as const, intersect: false },
              }}
              plugins={[getCrosshairPlugin(isDark)]}
            />
          )}
        </Box>
      </Paper>
    </>
  );
};

export default React.memo(SessionHealthCharts);
