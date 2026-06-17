import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  lazy,
  Suspense,
} from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import {
  Box,
  Typography,
  useTheme,
  alpha,
  Grid,
  Skeleton,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  Insights as InsightsIcon,
  FilterAlt as FunnelIcon,
  Autorenew as RetentionIcon,
  AccountTree as FlowsIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  DeviceHub as SessionIcon,
  TouchApp as EngagementIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  BarChart as OverviewIcon,
} from '@mui/icons-material';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import ArgusVolumeChart from '@/components/argus/ArgusVolumeChart';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import PageContentLoader from '@/components/common/PageContentLoader';
import type { ChartDataset } from '@/components/argus/InteractiveTimeSeriesChart';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import DateRangeSelector, {
  DateRangeValue,
  dateRangeToApiParams,
} from '@/components/common/DateRangeSelector';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import argusService, {
  type AnalyticsEventNameEntry,
} from '@/services/argusService';
import { formatCompactNumber } from '@/utils/numberFormat';
import EventLabel from '@/components/argus/EventLabel';
import {
  PageContainer,
  SectionHeader,
  StatCard,
} from './ArgusAnalyticsPage.styles';
import AnalyticsLayout from './components/analytics/AnalyticsLayout';
import {
  useInsightsStore,
  useFunnelsStore,
  useRetentionStore,
  useFlowsStore,
} from '@/hooks/useAnalyticsStore';

/* ─── Lazy loaded sub-pages ─── */

const ArgusInsightsPage = lazy(() => import('./ArgusInsightsPage'));
const ArgusFunnelsPage = lazy(() => import('./ArgusFunnelsPage'));
const ArgusRetentionPage = lazy(() => import('./ArgusRetentionPage'));
const ArgusFlowsPage = lazy(() => import('./ArgusFlowsPage'));

/* ─── Tab config ─── */

type AnalyticsTab = 'overview' | 'insights' | 'funnels' | 'retention' | 'flows';

interface TabDef {
  key: AnalyticsTab;
  labelKey: string;
  descriptionKey: string;
  icon: React.ReactElement;
  color: string;
}

const TABS: TabDef[] = [
  {
    key: 'overview',
    labelKey: 'argus.analytics.overview',
    descriptionKey: 'argus.analytics.overviewDesc',
    icon: <OverviewIcon />,
    color: '#6366f1',
  },
  {
    key: 'insights',
    labelKey: 'argus.analytics.insights',
    descriptionKey: 'argus.analytics.insightsDesc',
    icon: <InsightsIcon />,
    color: '#6366f1',
  },
  {
    key: 'funnels',
    labelKey: 'argus.analytics.funnels',
    descriptionKey: 'argus.analytics.funnelsDesc',
    icon: <FunnelIcon />,
    color: '#f59e0b',
  },
  {
    key: 'retention',
    labelKey: 'argus.analytics.retention',
    descriptionKey: 'argus.analytics.retentionDesc',
    icon: <RetentionIcon />,
    color: '#10b981',
  },
  {
    key: 'flows',
    labelKey: 'argus.analytics.flows',
    descriptionKey: 'argus.analytics.flowsDesc',
    icon: <FlowsIcon />,
    color: '#ec4899',
  },
];

/* ─── TabBar Component (goes into AnalyticsLayout's tabBar slot) ─── */

interface AnalyticsTabBarProps {
  activeTab: AnalyticsTab;
  onTabChange: (tab: AnalyticsTab) => void;
}

/* ─── TabIconButton ───
 * Owns its own tooltip `open` state so that:
 *   1. onMouseDown closes the tooltip *before* onClick fires the tab switch.
 *   2. enterDelay ensures rapid clicks never open the tooltip in the first place.
 * This prevents the MUI Popper (0,0) flash that occurs when the parent
 * re-renders during the tab transition.
 */
interface TabIconButtonProps {
  tab: TabDef;
  isActive: boolean;
  isDark: boolean;
  label: string;
  onTabChange: (tab: AnalyticsTab) => void;
}

const TabIconButton: React.FC<TabIconButtonProps> = React.memo(
  function TabIconButton({ tab, isActive, isDark, label, onTabChange }) {
    const [open, setOpen] = useState(false);

    return (
      <Tooltip
        title={label}
        placement="bottom"
        arrow
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        enterDelay={400}
        leaveDelay={0}
        disableInteractive
      >
        <IconButton
          size="small"
          onMouseDown={() => setOpen(false)}
          onClick={() => onTabChange(tab.key)}
          sx={{
            width: 34,
            height: 34,
            borderRadius: '8px',
            color: isActive
              ? tab.color
              : isDark
                ? 'rgba(255,255,255,0.4)'
                : 'rgba(0,0,0,0.35)',
            backgroundColor: isActive
              ? alpha(tab.color, isDark ? 0.15 : 0.1)
              : 'transparent',
            transition: 'all 0.15s ease',
            '&:hover': {
              backgroundColor: isActive
                ? alpha(tab.color, isDark ? 0.2 : 0.15)
                : isDark
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(0,0,0,0.04)',
              color: isActive
                ? tab.color
                : isDark
                  ? 'rgba(255,255,255,0.7)'
                  : 'rgba(0,0,0,0.6)',
            },
          }}
        >
          {React.cloneElement(tab.icon, { sx: { fontSize: 18 } })}
        </IconButton>
      </Tooltip>
    );
  }
);

const AnalyticsTabBar: React.FC<AnalyticsTabBarProps> = React.memo(
  function AnalyticsTabBar({ activeTab, onTabChange }) {
    const theme = useTheme();
    const { t } = useTranslation();
    const isDark = theme.palette.mode === 'dark';
    const activeTabDef = TABS.find((tab) => tab.key === activeTab)!;

    return (
      <Box sx={{ flexShrink: 0 }}>
        {/* Icon row */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.25,
            px: 1.5,
            py: 1,
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TabIconButton
                key={tab.key}
                tab={tab}
                isActive={isActive}
                isDark={isDark}
                label={t(tab.labelKey)}
                onTabChange={onTabChange}
              />
            );
          })}
        </Box>

        {/* Active tab description banner */}
        <Box
          key={activeTab}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 1,
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            background: alpha(activeTabDef.color, isDark ? 0.07 : 0.05),
            animation: 'tabDescFadeIn 0.2s ease',
            '@keyframes tabDescFadeIn': {
              from: { opacity: 0, transform: 'translateY(-4px)' },
              to: { opacity: 1, transform: 'translateY(0)' },
            },
          }}
        >
          {/* Color accent bar */}
          <Box
            sx={{
              width: 3,
              height: 28,
              borderRadius: '2px',
              background: activeTabDef.color,
              flexShrink: 0,
            }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                fontWeight: 700,
                fontSize: '0.72rem',
                color: activeTabDef.color,
                lineHeight: 1.2,
              }}
            >
              {t(activeTabDef.labelKey)}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                fontSize: '0.68rem',
                color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
                lineHeight: 1.4,
                whiteSpace: 'normal',
                wordBreak: 'keep-all',
              }}
            >
              {t(activeTabDef.descriptionKey)}
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }
);

/* ─── Constants ─── */

const DONUT_COLORS = [
  '#6366f1',
  '#f59e0b',
  '#10b981',
  '#ec4899',
  '#3b82f6',
  '#8b5cf6',
  '#14b8a6',
  '#f97316',
  '#ef4444',
  '#06b6d4',
];

interface SummaryData {
  total_events: number;
  unique_users: number;
  total_sessions: number;
  dau_today: number;
  dau_yesterday: number;
  daily_trend: Array<{ date: string; events: number; users: number }>;
  hourly_heatmap: Array<{ dow: number; hour: number; count: number }>;
}

const DOW_KEYS = [
  'argus.analytics.dow.mon',
  'argus.analytics.dow.tue',
  'argus.analytics.dow.wed',
  'argus.analytics.dow.thu',
  'argus.analytics.dow.fri',
  'argus.analytics.dow.sat',
  'argus.analytics.dow.sun',
];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

/* ═══════════════════════════════════════════════════════════════════════
   Overview Content (rendered inside AnalyticsLayout's main area)
   ═══════════════════════════════════════════════════════════════════════ */

interface OverviewContentProps {
  dateRange: DateRangeValue;
  setDateRange: (v: DateRangeValue) => void;
  tabBar: React.ReactNode;
}

const OverviewContent: React.FC<OverviewContentProps> = ({
  dateRange,
  setDateRange,
  tabBar,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

  const [eventNames, setEventNames] = useState<AnalyticsEventNameEntry[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const apiParams = dateRangeToApiParams(dateRange);
      const [evData, summData] = await Promise.all([
        argusService.getAnalyticsEventNames(
          projectId,
          apiParams.period,
          apiParams.start,
          apiParams.end
        ),
        argusService.getAnalyticsSummary(
          projectId,
          apiParams.period,
          apiParams.start,
          apiParams.end
        ),
      ]);
      setEventNames(evData);
      setSummary(summData);
    } catch {
      setEventNames([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalEvents = useMemo(
    () => eventNames.reduce((sum, e) => sum + Number(e.count), 0),
    [eventNames]
  );
  const eventsPerUser = useMemo(() => {
    if (!summary || summary.unique_users === 0) return 0;
    return Math.round((summary.total_events / summary.unique_users) * 10) / 10;
  }, [summary]);
  const dauChange = useMemo(() => {
    if (!summary || summary.dau_yesterday === 0) return 0;
    return Math.round(
      ((summary.dau_today - summary.dau_yesterday) / summary.dau_yesterday) *
        100
    );
  }, [summary]);

  const donutData = useMemo(() => {
    if (eventNames.length === 0) return [];
    const top = eventNames.slice(0, 6);
    const otherCount = eventNames
      .slice(6)
      .reduce((s, e) => s + Number(e.count), 0);
    const items = top.map((ev, i) => ({
      name: ev.display_name || ev.name,
      value: Number(ev.count),
      color: ev.icon_color || DONUT_COLORS[i % DONUT_COLORS.length],
    }));
    if (otherCount > 0) {
      items.push({
        name: t('argus.analytics.others', 'Others'),
        value: otherCount,
        color: isDark ? '#4a4a5a' : '#94a3b8',
      });
    }
    return items;
  }, [eventNames, isDark, t]);

  const trendLabels = useMemo(() => {
    if (!summary) return [];
    return summary.daily_trend.map((d) => String(d.date).substring(5));
  }, [summary]);

  const trendDatasets: ChartDataset[] = useMemo(() => {
    if (!summary) return [];
    return [
      {
        label: t('argus.analytics.events', 'Events'),
        data: summary.daily_trend.map((d) => d.events),
        color: '#6366f1',
        type: 'area' as const,
      },
      {
        label: t('argus.analytics.users', 'Users'),
        data: summary.daily_trend.map((d) => d.users),
        color: '#10b981',
        type: 'area' as const,
      },
    ];
  }, [summary, t]);

  const handleTrendZoom = useCallback(
    (startIndex: number, endIndex: number) => {
      if (!summary || summary.daily_trend.length === 0) return;
      const trend = summary.daily_trend;
      const startDate = trend[Math.max(0, startIndex)]?.date;
      const endDate = trend[Math.min(trend.length - 1, endIndex)]?.date;
      if (startDate && endDate) {
        setDateRange({
          type: 'custom',
          start: new Date(startDate),
          end: new Date(endDate),
        });
      }
    },
    [summary, setDateRange]
  );

  const heatmapGrid = useMemo(() => {
    if (!summary || summary.hourly_heatmap.length === 0) return null;
    const grid: number[][] = Array.from({ length: 7 }, () =>
      new Array(24).fill(0)
    );
    let maxCount = 0;
    for (const { dow, hour, count } of summary.hourly_heatmap) {
      const rowIdx = dow - 1;
      if (rowIdx >= 0 && rowIdx < 7 && hour >= 0 && hour < 24) {
        grid[rowIdx][hour] = count;
        if (count > maxCount) maxCount = count;
      }
    }
    return { grid, maxCount };
  }, [summary]);

  const renderKpiCard = (
    icon: React.ReactElement,
    iconColor: string,
    label: string,
    value: string | number,
    change?: number | null
  ) => (
    <StatCard isDark={isDark} elevation={0}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {React.cloneElement(icon, { sx: { fontSize: 16, color: iconColor } })}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            fontSize: '0.65rem',
          }}
        >
          {label}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
        <Typography variant="h5" fontWeight={700} sx={{ fontSize: '1.4rem' }}>
          {typeof value === 'number' ? formatCompactNumber(value) : value}
        </Typography>
        {change != null && change !== 0 && (
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.25,
              color:
                change > 0
                  ? isDark
                    ? '#34d399'
                    : '#10b981'
                  : isDark
                    ? '#f87171'
                    : '#ef4444',
              fontSize: '0.72rem',
              fontWeight: 600,
            }}
          >
            {change > 0 ? (
              <ArrowUpIcon sx={{ fontSize: 14 }} />
            ) : (
              <ArrowDownIcon sx={{ fontSize: 14 }} />
            )}
            {Math.abs(change)}%
          </Box>
        )}
      </Box>
    </StatCard>
  );

  const dateRangeLabel = dateRange.preset || 'custom';

  /* Overview left panel — summary stats in sidebar */
  const overviewLeftPanel = (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography
        variant="overline"
        sx={{ fontWeight: 700, color: 'text.secondary', ml: 0.5 }}
      >
        {t('argus.analytics.overview', 'Overview')}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {renderKpiCard(
          <PeopleIcon />,
          isDark ? '#818cf8' : '#6366f1',
          t('argus.analytics.dauToday', 'DAU (Today)'),
          summary?.dau_today ?? 0,
          dauChange
        )}
        {renderKpiCard(
          <TrendingUpIcon />,
          isDark ? '#34d399' : '#10b981',
          `${t('argus.analytics.total', 'Total Events')} (${dateRangeLabel})`,
          summary?.total_events ?? totalEvents
        )}
        {renderKpiCard(
          <SessionIcon />,
          isDark ? '#fbbf24' : '#f59e0b',
          t('argus.analytics.sessions', 'Sessions'),
          summary?.total_sessions ?? 0
        )}
        {renderKpiCard(
          <EngagementIcon />,
          isDark ? '#f472b6' : '#ec4899',
          t('argus.analytics.eventsPerUser', 'Events / User'),
          eventsPerUser
        )}
      </Box>

      {/* Donut chart + legend in sidebar */}
      {donutData.length > 0 && (
        <Box>
          <Typography
            variant="overline"
            sx={{ fontWeight: 700, color: 'text.secondary', ml: 0.5 }}
          >
            {t('argus.analytics.eventDistribution', 'Event Distribution')}
          </Typography>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              mt: 1,
              width: '100%',
              height: 140,
              minWidth: 0,
            }}
          >
            <ResponsiveContainer
              width="100%"
              height={140}
              minWidth={0}
              minHeight={0}
              debounce={50}
            >
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={58}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {donutData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{
                    background: isDark ? '#1e1e2e' : '#fff',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    borderRadius: 8,
                    fontSize: 12,
                    color: isDark ? '#e2e8f0' : '#1e293b',
                  }}
                  formatter={(value: number) => formatCompactNumber(value)}
                />
              </PieChart>
            </ResponsiveContainer>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            {donutData.map((entry) => (
              <Box
                key={entry.name}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  py: 0.25,
                  px: 0.5,
                }}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: entry.color,
                    flexShrink: 0,
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    flex: 1,
                    fontSize: '0.7rem',
                    color: isDark ? '#ccc' : '#555',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {entry.name}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    fontFamily: 'monospace',
                    color: isDark ? '#e2e8f0' : '#1e293b',
                    flexShrink: 0,
                  }}
                >
                  {formatCompactNumber(entry.value)}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );

  /* Overview main content — trend chart, heatmap, event list */
  const overviewMainContent = (
    <PageContentLoader
      loading={loading}
      skeleton={
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <ArgusChartSkeleton height={200} color="#6366f1" />
          <ArgusChartSkeleton height={140} color="#6366f1" />
        </Box>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Daily Trend */}
        <ArgusVolumeChart
          title={t('argus.analytics.dailyTrend', 'Daily Trend')}
          labels={trendLabels}
          datasets={trendDatasets}
          loading={loading}
          onZoom={handleTrendZoom}
          storagePrefix="argus_analytics_trend"
          showLegend
          showCompactToggle={false}
          mb={0}
        />

        {/* Peak Hours Heatmap */}
        {heatmapGrid && (
          <Box
            sx={{
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              borderRadius: 2,
              p: 2,
              background: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
            }}
          >
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                fontSize: '0.65rem',
                mb: 1.5,
              }}
            >
              {t('argus.analytics.peakHours', 'Peak Hours')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  gap: 0,
                  width: 28,
                  flexShrink: 0,
                }}
              >
                <Box sx={{ height: 16 }} />
                {DOW_KEYS.map((key) => (
                  <Typography
                    key={key}
                    sx={{
                      fontSize: '0.6rem',
                      color: 'text.secondary',
                      textAlign: 'right',
                      height: 16,
                      lineHeight: '16px',
                    }}
                  >
                    {t(key)}
                  </Typography>
                ))}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(24, 1fr)',
                    gap: '2px',
                    mb: '2px',
                  }}
                >
                  {HOURS.map((h) => (
                    <Box key={h} sx={{ textAlign: 'center', height: 14 }}>
                      <Typography
                        sx={{
                          fontSize: '0.55rem',
                          color: 'text.secondary',
                          lineHeight: '14px',
                        }}
                      >
                        {h % 3 === 0 ? h : ''}
                      </Typography>
                    </Box>
                  ))}
                </Box>
                {heatmapGrid.grid.map((row, rowIdx) => (
                  <Box
                    key={rowIdx}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(24, 1fr)',
                      gap: '2px',
                      mb: '2px',
                    }}
                  >
                    {row.map((count, colIdx) => {
                      const intensity =
                        heatmapGrid.maxCount > 0
                          ? count / heatmapGrid.maxCount
                          : 0;
                      const cellColor =
                        intensity === 0
                          ? isDark
                            ? 'rgba(255,255,255,0.03)'
                            : 'rgba(0,0,0,0.03)'
                          : alpha(
                              '#6366f1',
                              0.1 + intensity * (isDark ? 0.7 : 0.6)
                            );
                      return (
                        <Tooltip
                          key={colIdx}
                          title={
                            <Box sx={{ textAlign: 'center' }}>
                              <Typography
                                sx={{ fontSize: '0.75rem', fontWeight: 600 }}
                              >
                                {t(DOW_KEYS[rowIdx])}{' '}
                                {String(colIdx).padStart(2, '0')}:00
                              </Typography>
                              <Typography
                                sx={{ fontSize: '0.85rem', fontWeight: 700 }}
                              >
                                {formatCompactNumber(count)}{' '}
                                {t('argus.analytics.events', 'events')}
                              </Typography>
                            </Box>
                          }
                          arrow
                          placement="top"
                          slotProps={{
                            tooltip: {
                              sx: {
                                bgcolor: isDark
                                  ? 'rgba(30,30,40,0.95)'
                                  : 'rgba(255,255,255,0.95)',
                                color: isDark ? '#e2e8f0' : '#1e293b',
                                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                borderRadius: '8px',
                                px: 1.5,
                                py: 0.75,
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                              },
                            },
                            arrow: {
                              sx: {
                                color: isDark
                                  ? 'rgba(30,30,40,0.95)'
                                  : 'rgba(255,255,255,0.95)',
                              },
                            },
                          }}
                        >
                          <Box
                            sx={{
                              minWidth: 0,
                              height: 14,
                              borderRadius: '2px',
                              backgroundColor: cellColor,
                              transition: 'box-shadow 0.15s',
                              cursor: 'default',
                              '&:hover': {
                                boxShadow: `inset 0 0 0 1.5px ${isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)'}`,
                              },
                            }}
                          />
                        </Tooltip>
                      );
                    })}
                  </Box>
                ))}
              </Box>
            </Box>
            {/* Color scale legend */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 0.5,
                mt: 1,
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.6rem',
                  color: 'text.secondary',
                  fontFamily: 'monospace',
                }}
              >
                0
              </Typography>
              {[0, 0.2, 0.4, 0.6, 0.8, 1].map((level) => (
                <Box
                  key={level}
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '2px',
                    backgroundColor:
                      level === 0
                        ? isDark
                          ? 'rgba(255,255,255,0.03)'
                          : 'rgba(0,0,0,0.03)'
                        : alpha('#6366f1', 0.1 + level * (isDark ? 0.7 : 0.6)),
                  }}
                />
              ))}
              <Typography
                sx={{
                  fontSize: '0.6rem',
                  color: 'text.secondary',
                  fontFamily: 'monospace',
                }}
              >
                {formatCompactNumber(heatmapGrid.maxCount)}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Top Events */}
        <Box>
          <SectionHeader>
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                fontSize: '0.65rem',
              }}
            >
              {t('argus.analytics.topEvents', 'Top Events')} ({dateRangeLabel})
            </Typography>
          </SectionHeader>
          <Box
            sx={{
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              borderRadius: 2,
              overflow: 'hidden',
              background: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
            }}
          >
            {eventNames.length === 0 ? (
              <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {t('argus.analytics.noEvents', 'No events found')}
                </Typography>
              </Box>
            ) : (
              eventNames.slice(0, 10).map((ev, i) => {
                const pctValue =
                  totalEvents > 0 ? (ev.count / totalEvents) * 100 : 0;
                const pctLabel =
                  pctValue === 0
                    ? '0%'
                    : pctValue < 1
                      ? '<1%'
                      : `${Math.round(pctValue)}%`;
                const barColor =
                  ev.icon_color || DONUT_COLORS[i % DONUT_COLORS.length];
                return (
                  <Box
                    key={ev.name}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      px: 1.5,
                      py: 0.6,
                      borderBottom:
                        i < Math.min(eventNames.length, 10) - 1
                          ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`
                          : 'none',
                      position: 'relative',
                      overflow: 'hidden',
                      '&:hover': {
                        background: isDark
                          ? 'rgba(255,255,255,0.02)'
                          : 'rgba(0,0,0,0.01)',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${pctValue}%`,
                        background: alpha(barColor, isDark ? 0.15 : 0.1),
                        transition: 'width 0.3s ease',
                      }}
                    />
                    <Box
                      sx={{
                        flex: 1,
                        position: 'relative',
                        zIndex: 1,
                        minWidth: 0,
                      }}
                    >
                      <EventLabel
                        eventName={ev.name}
                        displayName={ev.display_name}
                        icon={ev.icon}
                        iconColor={ev.icon_color}
                        description={ev.description}
                        isReserved={ev.is_reserved}
                        size="default"
                      />
                    </Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        fontWeight: 600,
                        position: 'relative',
                        zIndex: 1,
                        minWidth: 50,
                        textAlign: 'right',
                        fontSize: '0.75rem',
                      }}
                    >
                      {formatCompactNumber(ev.count)}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        position: 'relative',
                        zIndex: 1,
                        minWidth: 32,
                        textAlign: 'right',
                        opacity: 0.6,
                        fontSize: '0.7rem',
                      }}
                    >
                      {pctLabel}
                    </Typography>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      </Box>
    </PageContentLoader>
  );

  return (
    <AnalyticsLayout tabBar={tabBar} leftPanel={overviewLeftPanel}>
      {overviewMainContent}
    </AnalyticsLayout>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   Main Container (Tabbed Page)
   ═══════════════════════════════════════════════════════════════════════ */

const ArgusAnalyticsPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  const [activeTab, setActiveTab] = useLocalStorage<AnalyticsTab>(
    'argus_analytics_active_tab',
    'overview'
  );

  // Track which tabs have been mounted at least once.
  // Once mounted, a tab stays in the DOM (display:none when inactive) to
  // prevent the full unmount/remount cycle that causes sidebar flickering.
  const [visitedTabs, setVisitedTabs] = useState<Set<AnalyticsTab>>(
    () => new Set([activeTab])
  );

  const [dateRange, setDateRange] = useState<DateRangeValue>({
    type: 'preset',
    preset: '14d',
  });

  // Sync dateRange to all sub-page stores
  const setInsightsDateRange = useInsightsStore((s) => s.setDateRange);
  const setFunnelsDateRange = useFunnelsStore((s) => s.setDateRange);
  const setRetentionDateRange = useRetentionStore((s) => s.setDateRange);
  const setFlowsDateRange = useFlowsStore((s) => s.setDateRange);

  const handleDateRangeChange = useCallback(
    (value: DateRangeValue) => {
      setDateRange(value);
      setInsightsDateRange(value);
      setFunnelsDateRange(value);
      setRetentionDateRange(value);
      setFlowsDateRange(value);
    },
    [
      setInsightsDateRange,
      setFunnelsDateRange,
      setRetentionDateRange,
      setFlowsDateRange,
    ]
  );

  const handleTabChange = useCallback(
    (tab: AnalyticsTab) => {
      setActiveTab(tab);
      setVisitedTabs((prev) => {
        if (prev.has(tab)) return prev;
        const next = new Set(prev);
        next.add(tab);
        return next;
      });
    },
    [setActiveTab]
  );

  const tabBar = useMemo(
    () => (
      <AnalyticsTabBar activeTab={activeTab} onTabChange={handleTabChange} />
    ),
    [activeTab, handleTabChange]
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 64px)',
        overflow: 'hidden',
        m: -2,
      }}
    >
      <PageHeader
        title={
          <ArgusBreadcrumbs
            paths={[{ label: t('argus.analytics.title', 'Analytics') }]}
            size="title"
          />
        }
        subtitle={t(
          'argus.analytics.subtitle',
          'User behavior analysis and product insights'
        )}
        actions={
          <DateRangeSelector
            value={dateRange}
            onChange={handleDateRangeChange}
            compact
          />
        }
      />

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* Overview: always rendered (no lazy loading needed) */}
        <Box
          sx={{
            display: activeTab === 'overview' ? 'flex' : 'none',
            flex: 1,
            minHeight: 0,
            minWidth: 0,
          }}
        >
          <OverviewContent
            dateRange={dateRange}
            setDateRange={handleDateRangeChange}
            tabBar={tabBar}
          />
        </Box>

        {/* Insights: mount on first visit, keep alive with display:none */}
        {visitedTabs.has('insights') && (
          <Box
            sx={{
              display: activeTab === 'insights' ? 'flex' : 'none',
              flex: 1,
              minHeight: 0,
              minWidth: 0,
            }}
          >
            <Suspense
              fallback={
                <Box sx={{ flex: 1, display: 'flex' }}>
                  <ArgusChartSkeleton height={400} />
                </Box>
              }
            >
              <ArgusInsightsPage embedded tabBar={tabBar} />
            </Suspense>
          </Box>
        )}

        {/* Funnels: mount on first visit, keep alive with display:none */}
        {visitedTabs.has('funnels') && (
          <Box
            sx={{
              display: activeTab === 'funnels' ? 'flex' : 'none',
              flex: 1,
              minHeight: 0,
              minWidth: 0,
            }}
          >
            <Suspense
              fallback={
                <Box sx={{ flex: 1, display: 'flex' }}>
                  <ArgusChartSkeleton height={400} />
                </Box>
              }
            >
              <ArgusFunnelsPage embedded tabBar={tabBar} />
            </Suspense>
          </Box>
        )}

        {/* Retention: mount on first visit, keep alive with display:none */}
        {visitedTabs.has('retention') && (
          <Box
            sx={{
              display: activeTab === 'retention' ? 'flex' : 'none',
              flex: 1,
              minHeight: 0,
              minWidth: 0,
            }}
          >
            <Suspense
              fallback={
                <Box sx={{ flex: 1, display: 'flex' }}>
                  <ArgusChartSkeleton height={400} />
                </Box>
              }
            >
              <ArgusRetentionPage embedded tabBar={tabBar} />
            </Suspense>
          </Box>
        )}

        {/* Flows: mount on first visit, keep alive with display:none */}
        {visitedTabs.has('flows') && (
          <Box
            sx={{
              display: activeTab === 'flows' ? 'flex' : 'none',
              flex: 1,
              minHeight: 0,
              minWidth: 0,
            }}
          >
            <Suspense
              fallback={
                <Box sx={{ flex: 1, display: 'flex' }}>
                  <ArgusChartSkeleton height={400} />
                </Box>
              }
            >
              <ArgusFlowsPage embedded tabBar={tabBar} />
            </Suspense>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ArgusAnalyticsPage;
