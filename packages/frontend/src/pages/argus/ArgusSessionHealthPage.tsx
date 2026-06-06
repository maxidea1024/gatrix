import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  useTheme,
  alpha,
  Tooltip,
} from '@mui/material';
import {
  Devices as DevicesIcon,
  Cancel as CrashIcon,
  People as PeopleIcon,
  Timer as TimerIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Warning as WarningIcon,
  InfoOutlined as InfoIcon,
  VisibilityOff as HideIcon,
  Visibility as ShowIcon,
} from '@mui/icons-material';
import { getCrosshairPlugin } from '../../utils/chartPlugins';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import argusService, {
  ArgusSessionHealth,
  ArgusIssue,
} from '@/services/argusService';
import IssueListItem from '@/components/argus/IssueListItem';
import ArgusFilterBar, {
  ArgusFilterState,
  defaultArgusFilterState,
} from '@/components/argus/ArgusFilterBar';
import { dateRangeToApiParams as argusDateRangeToApiParams } from '@/components/common/DateRangeSelector';
import useArgusUrlState from '@/hooks/useArgusUrlState';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import PageHeader from '@/components/common/PageHeader';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

// Session status definitions for tooltips
const SESSION_STATUS_DEFS: Record<string, string> = {
  healthy: 'argus.sessions.healthyDef',
  crashed: 'argus.sessions.crashedDef',
  errored: 'argus.sessions.erroredDef',
  abnormal: 'argus.sessions.abnormalDef',
};

type DisplayMode = 'sessions' | 'users';

// Color palette for release charts
const RELEASE_COLORS = [
  '#7c4dff',
  '#448aff',
  '#00bcd4',
  '#26a69a',
  '#66bb6a',
  '#ffa726',
  '#ef5350',
  '#ab47bc',
];

const ArgusSessionHealthPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';
  const navigate = useNavigate();

  const URL_PARAMS = useMemo(
    () => ({
      period: {
        key: 'period',
        default: '14d',
        storageKey: 'argus-session-period',
      },
    }),
    []
  );
  const [urlState, setUrlState] = useArgusUrlState(URL_PARAMS);

  const [data, setData] = useState<ArgusSessionHealth | null>(null);
  const [topIssues, setTopIssues] = useState<ArgusIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('sessions');
  const [hideHealthy, setHideHealthy] = useState(false);

  const [filters, setFilters] = useState<ArgusFilterState>(() =>
    defaultArgusFilterState(urlState.period)
  );

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      dateRange: { type: 'preset', preset: urlState.period },
    }));
  }, [urlState.period]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const ap = argusDateRangeToApiParams(filters.dateRange);
      const [healthResult, issuesResult] = await Promise.all([
        argusService.getSessionHealth(projectId, ap.period, ap.start, ap.end),
        argusService
          .listIssues(projectId, {
            sort: 'event_count',
            limit: 5,
            level: 'error',
            period: ap.period,
            start: ap.start,
            end: ap.end,
          })
          .catch((err) => {
            console.error('Failed to fetch top issues:', err);
            return { data: [], total: 0 };
          }),
      ]);
      setData(healthResult);
      setTopIssues(issuesResult.data);
    } catch (error) {
      console.error('Failed to fetch session health:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilterChange = (newFilters: ArgusFilterState) => {
    setFilters(newFilters);
    if (newFilters.dateRange.type === 'preset' && newFilters.dateRange.preset) {
      setUrlState({ period: newFilters.dateRange.preset });
    }
  };

  const s = data?.summary;
  const pp = data?.previous_period;
  const crashFreeRate = Number(s?.crash_free_rate || 0);
  const rateColor =
    crashFreeRate >= 99
      ? '#4caf50'
      : crashFreeRate >= 95
        ? '#ff9800'
        : '#f44336';

  const calcChange = (
    current: number | undefined,
    previous: number | undefined
  ): number | null => {
    if (current == null || previous == null || previous === 0) return null;
    return ((current - previous) / previous) * 100;
  };

  // Donut chart data
  const donutData = useMemo(
    () => ({
      labels: [
        t('argus.sessions.healthy'),
        t('argus.sessions.crashed'),
        t('argus.sessions.errored'),
        t('argus.sessions.abnormal'),
      ],
      datasets: [
        {
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
        },
      ],
    }),
    [s, isDark, t]
  );

  const donutOpts = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
    }),
    []
  );

  // Status timeline (stacked area) - with hide healthy support
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

  // Duration distribution bar chart
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

  // Stat cards — session vs user mode
  const statCards = useMemo(() => {
    if (displayMode === 'users') {
      return [
        {
          icon: <PeopleIcon />,
          color: '#2196f3',
          label: t('argus.sessions.uniqueUsers'),
          value: s?.unique_users,
          prev: pp?.unique_users,
          invertChange: false,
        },
        {
          icon: <CrashIcon />,
          color: '#f44336',
          label: t('argus.sessions.crashedUsers'),
          value: s?.crashed,
          prev: pp?.crashed,
          invertChange: true,
        },
        {
          icon: <DevicesIcon />,
          color: '#7c4dff',
          label: t('argus.sessions.totalSessions'),
          value: s?.total_sessions,
          prev: pp?.total_sessions,
          invertChange: false,
        },
        {
          icon: <TimerIcon />,
          color: '#ff9800',
          label: t('argus.sessions.avgDuration'),
          value: s
            ? `${Math.round(Number(s.avg_duration) / 1000)}s`
            : undefined,
          prev: undefined,
          invertChange: false,
        },
      ];
    }
    return [
      {
        icon: <DevicesIcon />,
        color: '#7c4dff',
        label: t('argus.sessions.totalSessions'),
        value: s?.total_sessions,
        prev: pp?.total_sessions,
        invertChange: false,
      },
      {
        icon: <PeopleIcon />,
        color: '#2196f3',
        label: t('argus.sessions.uniqueUsers'),
        value: s?.unique_users,
        prev: pp?.unique_users,
        invertChange: false,
      },
      {
        icon: <CrashIcon />,
        color: '#f44336',
        label: t('argus.sessions.crashed'),
        value: s?.crashed,
        prev: pp?.crashed,
        invertChange: true,
      },
      {
        icon: <TimerIcon />,
        color: '#ff9800',
        label: t('argus.sessions.avgDuration'),
        value: s ? `${Math.round(Number(s.avg_duration) / 1000)}s` : undefined,
        prev: undefined,
        invertChange: false,
      },
    ];
  }, [displayMode, s, pp, t]);

  const legendItems = [
    {
      key: 'healthy',
      label: t('argus.sessions.healthy'),
      value: s?.healthy,
      color: '#4caf50',
      defKey: SESSION_STATUS_DEFS.healthy,
    },
    {
      key: 'crashed',
      label: t('argus.sessions.crashed'),
      value: s?.crashed,
      color: '#f44336',
      defKey: SESSION_STATUS_DEFS.crashed,
    },
    {
      key: 'errored',
      label: t('argus.sessions.errored'),
      value: s?.errored,
      color: '#ff9800',
      defKey: SESSION_STATUS_DEFS.errored,
    },
    {
      key: 'abnormal',
      label: t('argus.sessions.abnormal'),
      value: s?.abnormal,
      color: '#9e9e9e',
      defKey: SESSION_STATUS_DEFS.abnormal,
    },
  ];

  // Phase 2: Unhealthy sessions combined chart (errored + crashed + abnormal stacked)
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

  // Phase 2: Release adoption data (percentage of total sessions per release)
  const adoptionData = useMemo(() => {
    if (!data?.by_release?.length) return [];
    const totalAll = data.by_release.reduce(
      (sum, r) => sum + Number(r.total),
      0
    );
    if (totalAll === 0) return [];
    return data.by_release.map((r) => ({
      release: r.release,
      sessions: Number(r.total),
      pct: (Number(r.total) / totalAll) * 100,
    }));
  }, [data]);

  return (
    <Box>
      <PageHeader
        icon={<DevicesIcon />}
        title={
          <ArgusBreadcrumbs
            size="title"
            paths={[{ label: t('argus.sessions.title', 'Session Health') }]}
          />
        }
        subtitle={t('argus.sessionHealth.subtitle')}
      />

      <ArgusFilterBar
        projectId={projectId}
        value={filters}
        onChange={handleFilterChange}
        onRefresh={fetchData}
        loading={loading}
        extraControls={
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <Box
              sx={{
                height: 20,
                borderLeft: '1px solid',
                borderColor: 'divider',
                mx: 0.25,
              }}
            />
            {(['sessions', 'users'] as DisplayMode[]).map((mode) => (
              <Chip
                key={mode}
                label={t(
                  `argus.sessions.display${mode === 'sessions' ? 'Sessions' : 'Users'}`
                )}
                size="small"
                onClick={() => setDisplayMode(mode)}
                variant={displayMode === mode ? 'filled' : 'outlined'}
                sx={{
                  fontSize: '0.72rem',
                  fontWeight: displayMode === mode ? 700 : 500,
                  borderRadius: '14px',
                  height: 24,
                  ...(displayMode === mode
                    ? {
                        backgroundColor: alpha(
                          theme.palette.primary.main,
                          0.15
                        ),
                        color: theme.palette.primary.main,
                        borderColor: 'transparent',
                      }
                    : {
                        borderColor: isDark
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(0,0,0,0.08)',
                        color: 'text.secondary',
                      }),
                }}
              />
            ))}
          </Box>
        }
      />

      <PageContentLoader loading={loading}>
        {/* Top Row: Donut + Stats */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '260px 1fr' },
            gap: 2,
            mb: 2.5,
          }}
        >
          {/* Crash-free Donut */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              borderRadius: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box sx={{ position: 'relative', width: 140, height: 140 }}>
              <Doughnut data={donutData} options={donutOpts} />
              <Box
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  pointerEvents: 'none',
                  zIndex: 0,
                }}
              >
                <Typography
                  variant="h4"
                  fontWeight={800}
                  sx={{ color: rateColor, lineHeight: 1, fontSize: '1.8rem' }}
                >
                  {crashFreeRate.toFixed(1)}%
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: isDark ? '#777' : '#999', fontSize: '0.6rem' }}
                >
                  {t('argus.sessions.crashFree')}
                </Typography>
              </Box>
            </Box>
            {/* Legend with status tooltips */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 0.4,
                mt: 1.5,
                width: '100%',
              }}
            >
              {legendItems.map((item) => (
                <Tooltip
                  key={item.key}
                  title={t(item.defKey)}
                  placement="bottom"
                  arrow
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.4,
                      px: 0.5,
                      py: 0.2,
                      borderRadius: 1,
                      cursor: 'help',
                      '&:hover': {
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.04)'
                          : 'rgba(0,0,0,0.03)',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        backgroundColor: item.color,
                        flexShrink: 0,
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.64rem',
                        color: 'text.secondary',
                        lineHeight: 1.2,
                      }}
                    >
                      {item.label}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.64rem',
                        fontWeight: 700,
                        ml: 'auto',
                        lineHeight: 1.2,
                      }}
                    >
                      {Number(item.value || 0).toLocaleString()}
                    </Typography>
                  </Box>
                </Tooltip>
              ))}
            </Box>
          </Paper>

          {/* Stat Cards Grid */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 1.5,
            }}
          >
            {statCards.map((card, idx) => {
              const change =
                typeof card.value === 'number' && typeof card.prev === 'number'
                  ? calcChange(card.value, card.prev)
                  : null;
              return (
                <Paper
                  key={idx}
                  elevation={0}
                  sx={{
                    p: 2,
                    background: isDark
                      ? `linear-gradient(135deg, ${alpha(card.color, 0.12)}, ${alpha(card.color, 0.03)})`
                      : `linear-gradient(135deg, ${alpha(card.color, 0.06)}, ${alpha(card.color, 0.01)})`,
                    border: `1px solid ${alpha(card.color, 0.15)}`,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    transition: 'all 0.2s',
                    '&:hover': {
                      transform: 'translateY(-1px)',
                      boxShadow: `0 4px 16px ${alpha(card.color, 0.08)}`,
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: alpha(card.color, isDark ? 0.2 : 0.1),
                      color: card.color,
                    }}
                  >
                    {React.cloneElement(card.icon, { sx: { fontSize: 18 } })}
                  </Box>
                  <Box>
                    <Box
                      sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}
                    >
                      <Typography
                        variant="h6"
                        fontWeight={800}
                        sx={{ lineHeight: 1.2, fontSize: '1.1rem' }}
                      >
                        {typeof card.value === 'number'
                          ? card.value.toLocaleString()
                          : (card.value ?? '-')}
                      </Typography>
                      {change != null && (
                        <ChangeIndicator
                          value={change}
                          invert={card.invertChange}
                        />
                      )}
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        color: isDark ? '#777' : '#999',
                        fontWeight: 500,
                        fontSize: '0.68rem',
                      }}
                    >
                      {card.label}
                    </Typography>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        </Box>

        {/* Session Status Timeline (Stacked Area) */}
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
                onClick={() => setHideHealthy(!hideHealthy)}
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
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}
            >
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
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}
            >
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
                params.set('projectId', projectId);
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
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}
            >
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
                params.set('projectId', projectId);
                params.set('os', os);
                const ap = argusDateRangeToApiParams(filters.dateRange);
                if (ap.start) params.set('start', ap.start);
                if (ap.end) params.set('end', ap.end);
                navigate(`/argus/issues?${params.toString()}`);
              }}
            />
          </Paper>
        </Box>

        {/* Top Crash Issues */}
        {!topIssues.length ? (
          <Box sx={{ mb: 2.5 }}>
            <EmptyPlaceholder
              message={
                loading ? t('common.loading') : t('argus.sessions.noData')
              }
              minHeight={150}
            />
          </Box>
        ) : (
          <Paper
            elevation={0}
            sx={{
              mb: 2.5,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                px: 2.5,
                py: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  {t('argus.sessions.topCrashIssues')}
                </Typography>
                <Tooltip title={t('argus.sessions.topCrashIssuesDesc')} arrow>
                  <InfoIcon
                    sx={{
                      fontSize: 14,
                      color: 'text.disabled',
                      cursor: 'help',
                    }}
                  />
                </Tooltip>
              </Box>
              <Chip
                label={t('argus.overview.viewAll')}
                size="small"
                onClick={() =>
                  navigate('/argus/issues?level=error&sort=event_count')
                }
                sx={{
                  fontSize: '0.66rem',
                  height: 22,
                  fontWeight: 600,
                  backgroundColor: alpha(theme.palette.primary.main, 0.08),
                  color: theme.palette.primary.main,
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.15),
                  },
                }}
              />
            </Box>
            {topIssues.map((issue, idx) => (
              <IssueListItem
                key={issue.id}
                issue={issue}
                onClick={() =>
                  navigate(`/argus/issues/${projectId}/${issue.id}`)
                }
                showSparkline
                showLastSeen
                showDivider={idx < topIssues.length - 1}
                isFirst={idx === 0}
                isLast={idx === topIssues.length - 1}
              />
            ))}
          </Paper>
        )}

        {/* ═══ Phase 2: Unhealthy Sessions Combined View ═══ */}
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

        {/* ═══ Phase 2: Release Adoption + Comparison (side by side) ═══ */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 2,
            mb: 2.5,
          }}
        >
          {/* Release Adoption (Horizontal stacked bar) */}
          {/* Release Adoption (Horizontal stacked bar) */}
          {!data?.by_release?.length ? (
            <EmptyPlaceholder
              message={t('argus.sessions.noData')}
              minHeight={100}
            />
          ) : (
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                borderRadius: 2,
              }}
            >
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}
              >
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
                      background: 'linear-gradient(180deg, #7c4dff, #448aff)',
                      mr: 0.5,
                    }}
                  />
                  {t('argus.sessions.adoptionChart')}
                </Typography>
                <Tooltip title={t('argus.sessions.adoptionChartDesc')} arrow>
                  <InfoIcon
                    sx={{
                      fontSize: 14,
                      color: 'text.disabled',
                      cursor: 'help',
                    }}
                  />
                </Tooltip>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {/* Stacked bar */}
                <Box
                  sx={{
                    display: 'flex',
                    height: 28,
                    borderRadius: 2,
                    overflow: 'hidden',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  }}
                >
                  {adoptionData.map((item, idx) => (
                    <Tooltip
                      key={idx}
                      title={`${item.release}: ${item.sessions.toLocaleString()} ${t('argus.sessions.sessions')} (${item.pct.toFixed(1)}%)`}
                      arrow
                    >
                      <Box
                        sx={{
                          width: `${item.pct}%`,
                          minWidth: item.pct > 2 ? 16 : 4,
                          backgroundColor:
                            RELEASE_COLORS[idx % RELEASE_COLORS.length],
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.3s',
                          cursor: 'pointer',
                          '&:hover': {
                            filter: 'brightness(1.2)',
                            transform: 'scaleY(1.1)',
                          },
                        }}
                        onClick={() =>
                          navigate(
                            `/argus/releases/${projectId}/${encodeURIComponent(item.release)}`
                          )
                        }
                      >
                        {item.pct > 8 && (
                          <Typography
                            sx={{
                              fontSize: '0.58rem',
                              fontWeight: 700,
                              color: '#fff',
                              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                            }}
                          >
                            {item.pct.toFixed(0)}%
                          </Typography>
                        )}
                      </Box>
                    </Tooltip>
                  ))}
                </Box>
                {/* Legend */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {adoptionData.map((item, idx) => (
                    <Box
                      key={idx}
                      onClick={() =>
                        navigate(
                          `/argus/releases/${projectId}/${encodeURIComponent(item.release)}`
                        )
                      }
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.4,
                        px: 0.8,
                        py: 0.3,
                        borderRadius: 1,
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: isDark
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(0,0,0,0.04)',
                        },
                      }}
                    >
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '2px',
                          backgroundColor:
                            RELEASE_COLORS[idx % RELEASE_COLORS.length],
                          flexShrink: 0,
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{ fontSize: '0.64rem', fontWeight: 500 }}
                        noWrap
                      >
                        {item.release}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '0.62rem',
                          color: 'text.disabled',
                          ml: 0.2,
                        }}
                      >
                        {item.pct.toFixed(1)}%
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Paper>
          )}

          {/* Release Comparison (Grouped bar chart) */}
          {/* Release Comparison (Grouped bar chart) */}
          {!data?.by_release?.length ? (
            <EmptyPlaceholder
              message={t('argus.sessions.noData')}
              minHeight={100}
            />
          ) : (
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                borderRadius: 2,
              }}
            >
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}
              >
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
                      background: 'linear-gradient(180deg, #4caf50, #ff9800)',
                      mr: 0.5,
                    }}
                  />
                  {t('argus.sessions.releaseComparison')}
                </Typography>
                <Tooltip
                  title={t('argus.sessions.releaseComparisonDesc')}
                  arrow
                >
                  <InfoIcon
                    sx={{
                      fontSize: 14,
                      color: 'text.disabled',
                      cursor: 'help',
                    }}
                  />
                </Tooltip>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {/* Comparison table */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: `100px repeat(${Math.min(data.by_release.length, 5)}, 1fr)`,
                    gap: 0,
                    fontSize: '0.68rem',
                  }}
                >
                  {/* Header */}
                  <Box sx={{ py: 0.5, px: 0.8 }} />
                  {data.by_release.slice(0, 5).map((r, idx) => (
                    <Box
                      key={idx}
                      sx={{ py: 0.5, px: 0.5, textAlign: 'center' }}
                    >
                      <Chip
                        label={r.release}
                        size="small"
                        onClick={() =>
                          navigate(
                            `/argus/releases/${projectId}/${encodeURIComponent(r.release)}`
                          )
                        }
                        sx={{
                          fontSize: '0.58rem',
                          height: 18,
                          fontWeight: 600,
                          cursor: 'pointer',
                          maxWidth: '100%',
                          backgroundColor: alpha(
                            RELEASE_COLORS[idx % RELEASE_COLORS.length],
                            0.15
                          ),
                          color: RELEASE_COLORS[idx % RELEASE_COLORS.length],
                          border: 'none',
                        }}
                      />
                    </Box>
                  ))}
                  {/* Crash-free rate row */}
                  {[
                    {
                      label: t('argus.sessions.crashFree'),
                      key: 'crash_free_rate',
                      format: (v: number) => `${Number(v).toFixed(1)}%`,
                      colorFn: (v: number) =>
                        Number(v) >= 99
                          ? '#4caf50'
                          : Number(v) >= 95
                            ? '#ff9800'
                            : '#f44336',
                    },
                    {
                      label: t('argus.sessions.sessions'),
                      key: 'total',
                      format: (v: number) => Number(v).toLocaleString(),
                      colorFn: () => 'text.primary',
                    },
                    {
                      label: t('argus.sessions.users'),
                      key: 'users',
                      format: (v: number) => Number(v).toLocaleString(),
                      colorFn: () => 'text.primary',
                    },
                    {
                      label: t('argus.sessions.crashed'),
                      key: 'crashed',
                      format: (v: number) => Number(v).toLocaleString(),
                      colorFn: (v: number) =>
                        Number(v) > 0 ? '#f44336' : '#4caf50',
                    },
                  ].map((row) => (
                    <React.Fragment key={row.key}>
                      <Box
                        sx={{
                          py: 0.8,
                          px: 0.8,
                          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: '0.66rem',
                            color: 'text.secondary',
                            fontWeight: 500,
                          }}
                        >
                          {row.label}
                        </Typography>
                      </Box>
                      {data.by_release.slice(0, 5).map((r, idx) => {
                        const val = (r as any)[row.key];
                        const maxVal = Math.max(
                          ...data.by_release
                            .slice(0, 5)
                            .map((x) => Number((x as any)[row.key]))
                        );
                        const barPct =
                          row.key === 'crash_free_rate'
                            ? Number(val)
                            : maxVal > 0
                              ? (Number(val) / maxVal) * 100
                              : 0;
                        return (
                          <Box
                            key={idx}
                            sx={{
                              py: 0.8,
                              px: 0.5,
                              textAlign: 'center',
                              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                              position: 'relative',
                            }}
                          >
                            <Box
                              sx={{
                                position: 'absolute',
                                bottom: 0,
                                left: 2,
                                right: 2,
                                height: `${Math.min(barPct, 100) * 0.6}%`,
                                backgroundColor: alpha(
                                  RELEASE_COLORS[idx % RELEASE_COLORS.length],
                                  0.06
                                ),
                                borderRadius: '4px 4px 0 0',
                                transition: 'height 0.3s',
                              }}
                            />
                            <Typography
                              variant="caption"
                              sx={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                position: 'relative',
                                color: row.colorFn(val),
                              }}
                            >
                              {row.format(val)}
                            </Typography>
                          </Box>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </Box>
              </Box>
            </Paper>
          )}
        </Box>

        {/* By Release (existing) */}
        {/* By Release (existing) */}
        {!data?.by_release?.length ? (
          <Box sx={{ mb: 2.5 }}>
            <EmptyPlaceholder
              message={t('argus.sessions.noData')}
              minHeight={150}
            />
          </Box>
        ) : (
          <Paper
            elevation={0}
            sx={{
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                px: 2.5,
                py: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
              }}
            >
              <Typography variant="subtitle2" fontWeight={600}>
                {t('argus.sessions.byRelease')}
              </Typography>
              <Tooltip title={t('argus.sessions.byReleaseDesc')} arrow>
                <InfoIcon
                  sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }}
                />
              </Tooltip>
            </Box>
            {data.by_release.map((r, idx) => {
              const rate = Number(r.crash_free_rate);
              const barColor =
                rate >= 99 ? '#4caf50' : rate >= 95 ? '#ff9800' : '#f44336';
              return (
                <Box
                  key={`${r.release}-${idx}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    px: 2.5,
                    py: 1,
                    borderBottom:
                      idx < data.by_release.length - 1
                        ? `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`
                        : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    '&:hover': {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.04)'
                        : 'rgba(0,0,0,0.03)',
                      transform: 'translateX(4px)',
                      boxShadow: isDark
                        ? '-2px 0 0 0 #7c4dff'
                        : '-2px 0 0 0 #7c4dff',
                    },
                  }}
                  onClick={() =>
                    navigate(
                      `/argus/releases/${projectId}/${encodeURIComponent(r.release)}`
                    )
                  }
                >
                  <Chip
                    label={r.release}
                    size="small"
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.7rem',
                      minWidth: 100,
                      backgroundColor: alpha('#7c4dff', 0.1),
                      color: '#7c4dff',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        mb: 0.3,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          color: isDark ? '#777' : '#999',
                          fontSize: '0.68rem',
                        }}
                      >
                        {Number(r.total).toLocaleString()}{' '}
                        {t('argus.sessions.sessions')} ·{' '}
                        {Number(r.users).toLocaleString()}{' '}
                        {t('argus.sessions.users')}
                      </Typography>
                      <Typography
                        variant="caption"
                        fontWeight={700}
                        sx={{ color: barColor, fontSize: '0.72rem' }}
                      >
                        {rate.toFixed(1)}%
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.04)'
                          : 'rgba(0,0,0,0.04)',
                      }}
                    >
                      <Box
                        sx={{
                          height: '100%',
                          borderRadius: 3,
                          width: `${rate}%`,
                          background: `linear-gradient(90deg, ${barColor}, ${alpha(barColor, 0.6)})`,
                          transition: 'width 0.5s',
                        }}
                      />
                    </Box>
                  </Box>
                  <Chip
                    label={`${Number(r.crashed)} ${t('argus.sessions.crashes')}`}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.62rem',
                      cursor: 'pointer',
                      backgroundColor:
                        Number(r.crashed) > 0
                          ? alpha('#f44336', 0.1)
                          : alpha('#4caf50', 0.1),
                      color: Number(r.crashed) > 0 ? '#f44336' : '#4caf50',
                      border: 'none',
                    }}
                  />
                </Box>
              );
            })}
          </Paper>
        )}
      </PageContentLoader>
    </Box>
  );
};

// --- Sub-components ---

const ChangeIndicator: React.FC<{ value: number; invert?: boolean }> = ({
  value,
  invert,
}) => {
  const isUp = value > 0;
  const isGood = invert ? !isUp : isUp;
  const color = isGood ? '#4caf50' : '#f44336';
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.2 }}>
      {isUp ? (
        <TrendingUpIcon sx={{ fontSize: 13, color }} />
      ) : (
        <TrendingDownIcon sx={{ fontSize: 13, color }} />
      )}
      <Typography
        variant="caption"
        sx={{ fontSize: '0.6rem', fontWeight: 700, color }}
      >
        {Math.abs(value).toFixed(0)}%
      </Typography>
    </Box>
  );
};

const CrashDistribution: React.FC<{
  data: { label: string; total: number; crashed: number; rate: number }[];
  isDark: boolean;
  onClick?: (label: string) => void;
}> = ({ data, isDark, onClick }) => {
  const { t } = useTranslation();
  if (data.length === 0)
    return (
      <EmptyPlaceholder message={t('argus.sessions.noData')} minHeight={100} />
    );
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.7 }}>
      {data.slice(0, 5).map((item, idx) => (
        <Box
          key={`${item.label}-${idx}`}
          onClick={() => onClick?.(item.label)}
          sx={{
            p: 0.8,
            px: 1,
            borderRadius: 1.5,
            cursor: onClick ? 'pointer' : 'default',
            transition: 'all 0.15s',
            '&:hover': onClick
              ? {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.04)',
                  transform: 'scale(1.02) translateX(2px)',
                }
              : {},
          }}
        >
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.2 }}
          >
            <Typography
              variant="caption"
              sx={{ fontSize: '0.72rem', fontWeight: 500 }}
            >
              {item.label}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'center' }}>
              <Typography
                variant="caption"
                sx={{ fontSize: '0.65rem', color: isDark ? '#777' : '#999' }}
              >
                {item.crashed}/{item.total}
              </Typography>
              <Typography
                variant="caption"
                fontWeight={700}
                sx={{
                  fontSize: '0.7rem',
                  color:
                    item.rate > 5
                      ? '#f44336'
                      : item.rate > 1
                        ? '#ff9800'
                        : '#4caf50',
                }}
              >
                {item.rate.toFixed(1)}%
              </Typography>
            </Box>
          </Box>
          <Box
            sx={{
              height: 4,
              borderRadius: 2,
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(0,0,0,0.04)',
            }}
          >
            <Box
              sx={{
                height: '100%',
                borderRadius: 2,
                width: `${Math.min(item.rate * 5, 100)}%`,
                backgroundColor:
                  item.rate > 5
                    ? alpha('#f44336', 0.7)
                    : item.rate > 1
                      ? alpha('#ff9800', 0.6)
                      : alpha('#4caf50', 0.5),
                transition: 'width 0.4s',
              }}
            />
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
  } catch {
    return h;
  }
}

export default ArgusSessionHealthPage;
