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
} from '@mui/icons-material';
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
import { Doughnut } from 'react-chartjs-2';
import PageContentLoader from '@/components/common/PageContentLoader';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
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
import SessionHealthCharts from './components/SessionHealthCharts';
import SessionHealthReleases from './components/SessionHealthReleases';
import {
  SESSION_STATUS_DEFS,
  ChangeIndicator,
  calcChange,
} from './components/sessionHealthHelpers';
import { formatCompactNumber } from '@/utils/numberFormat';

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

type DisplayMode = 'sessions' | 'users';

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
      start: { key: 'start', default: '' },
      end: { key: 'end', default: '' },
    }),
    []
  );
  const [urlState, setUrlState] = useArgusUrlState(URL_PARAMS);

  const [data, setData] = useState<ArgusSessionHealth | null>(null);
  const [topIssues, setTopIssues] = useState<ArgusIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('sessions');
  const [hideHealthy, setHideHealthy] = useState(false);

  const [filters, setFilters] = useState<ArgusFilterState>(() => {
    if (urlState.period === 'custom' && urlState.start && urlState.end) {
      return {
        ...defaultArgusFilterState(),
        dateRange: {
          type: 'custom' as const,
          start: new Date(urlState.start),
          end: new Date(urlState.end),
        },
      };
    }
    return defaultArgusFilterState(urlState.period);
  });

  const isInitialMount = React.useRef(true);
  useEffect(() => {
    // Skip the first render — useState initializer already set the correct value
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (urlState.period === 'custom' && urlState.start && urlState.end) {
      setFilters((prev) => ({
        ...prev,
        dateRange: {
          type: 'custom',
          start: new Date(urlState.start),
          end: new Date(urlState.end),
        },
      }));
    } else {
      setFilters((prev) => ({
        ...prev,
        dateRange: { type: 'preset', preset: urlState.period },
      }));
    }
  }, [urlState.period, urlState.start, urlState.end]);

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

  const handleFilterChange = useCallback(
    (newFilters: ArgusFilterState) => {
      setFilters(newFilters);
      if (
        newFilters.dateRange.type === 'preset' &&
        newFilters.dateRange.preset
      ) {
        setUrlState({
          period: newFilters.dateRange.preset,
          start: '',
          end: '',
        });
      } else if (
        newFilters.dateRange.type === 'custom' &&
        newFilters.dateRange.start &&
        newFilters.dateRange.end
      ) {
        setUrlState({
          period: 'custom',
          start: newFilters.dateRange.start.toISOString(),
          end: newFilters.dateRange.end.toISOString(),
        });
      }
    },
    [setUrlState]
  );

  const handleToggleHideHealthy = useCallback(() => {
    setHideHealthy((prev) => !prev);
  }, []);

  const handleZoom = useCallback(
    (start: string, end: string) => {
      setUrlState({ period: 'custom', start, end });
    },
    [setUrlState]
  );

  const s = data?.summary;
  const pp = data?.previous_period;
  const crashFreeRate = Number(s?.crash_free_rate || 0);
  const rateColor =
    crashFreeRate >= 99
      ? '#4caf50'
      : crashFreeRate >= 95
        ? '#ff9800'
        : '#f44336';

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
      plugins: { legend: { display: false } },
    }),
    []
  );

  // Stat cards
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

  const legendItems = useMemo(
    () => [
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
    ],
    [s, t]
  );

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
          <Box
            sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flex: 1 }}
          >
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
            <Box sx={{ flex: 1 }} />
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
            {/* Legend */}
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
                      {formatCompactNumber(Number(item.value || 0))}
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
                        {card.value != null && !isNaN(Number(card.value))
                          ? formatCompactNumber(Number(card.value))
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

        {/* Charts Section */}
        <SessionHealthCharts
          data={data}
          loading={loading}
          filters={filters}
          projectId={projectId}
          hideHealthy={hideHealthy}
          onToggleHideHealthy={handleToggleHideHealthy}
          onZoom={handleZoom}
        />

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

        {/* Releases Section */}
        <SessionHealthReleases data={data} projectId={projectId} />
      </PageContentLoader>
    </Box>
  );
};

export default ArgusSessionHealthPage;
