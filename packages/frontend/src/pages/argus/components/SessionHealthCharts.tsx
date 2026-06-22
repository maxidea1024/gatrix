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
import { Bar } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import InteractiveTimeSeriesChart, {
  ChartDataset,
} from '@/components/argus/InteractiveTimeSeriesChart';
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
  onZoom?: (start: string, end: string) => void;
}

const SessionHealthCharts: React.FC<SessionHealthChartsProps> = ({
  data,
  loading,
  filters,
  projectId,
  hideHealthy,
  onToggleHideHealthy,
  onZoom,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();

  // ─── Chart Data ───
  const timelineLabels = useMemo(
    () => data?.status_timeline?.map((d) => formatHour(d.hour)) || [],
    [data]
  );

  // Raw hour strings for zoom index → ISO conversion
  const rawHours = useMemo(
    () => data?.status_timeline?.map((d) => d.hour) || [],
    [data]
  );

  const statusDatasets = useMemo(() => {
    if (!data?.status_timeline) return [];
    const ds: ChartDataset[] = [];
    if (!hideHealthy) {
      ds.push({
        label: t('argus.sessions.healthy'),
        data: data.status_timeline.map((d) => Number(d.healthy)),
        color: '#4caf50',
        type: 'area',
      });
    }
    ds.push(
      {
        label: t('argus.sessions.errored'),
        data: data.status_timeline.map((d) => Number(d.errored)),
        color: '#ff9800',
        type: 'area',
      },
      {
        label: t('argus.sessions.crashed'),
        data: data.status_timeline.map((d) => Number(d.crashed)),
        color: '#f44336',
        type: 'area',
      }
    );
    return ds;
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

  const unhealthyDatasets = useMemo(() => {
    if (!data?.status_timeline) return [];
    return [
      {
        label: t('argus.sessions.errored'),
        data: data.status_timeline.map((d) => Number(d.errored)),
        color: '#ff9800',
        type: 'stacked-bar' as const,
      },
      {
        label: t('argus.sessions.crashed'),
        data: data.status_timeline.map((d) => Number(d.crashed)),
        color: '#f44336',
        type: 'stacked-bar' as const,
      },
      {
        label: t('argus.sessions.abnormal'),
        data: data.status_timeline.map((d) => Number(d.abnormal)),
        color: '#9e9e9e',
        type: 'stacked-bar' as const,
      },
    ];
  }, [data, t]);

  const handleChartZoom = React.useCallback(
    (startIdx: number, endIdx: number) => {
      if (!onZoom) return;
      const si = Math.min(startIdx, endIdx);
      const ei = Math.max(startIdx, endIdx);
      if (rawHours[si] && rawHours[ei]) {
        const startDate = new Date(rawHours[si]);
        let endDate = new Date(rawHours[ei]);
        if (rawHours.length > 1) {
          const gap =
            new Date(rawHours[1]).getTime() - new Date(rawHours[0]).getTime();
          endDate = new Date(endDate.getTime() + gap);
        } else {
          endDate = new Date(endDate.getTime() + 3600000);
        }
        onZoom(startDate.toISOString(), endDate.toISOString());
      }
    },
    [onZoom, rawHours]
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
            <InteractiveTimeSeriesChart
              labels={timelineLabels}
              datasets={statusDatasets}
              height={220}
              onZoom={onZoom ? handleChartZoom : undefined}
              showLegend
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
            <InteractiveTimeSeriesChart
              labels={timelineLabels}
              datasets={unhealthyDatasets}
              height={200}
              onZoom={onZoom ? handleChartZoom : undefined}
              showLegend
            />
          )}
        </Box>
      </Paper>
    </>
  );
};

export default React.memo(SessionHealthCharts);
