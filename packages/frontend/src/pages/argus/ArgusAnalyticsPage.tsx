import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  useTheme,
  alpha,
  Grid,
  Skeleton,
  Tooltip,
} from '@mui/material';
import {
  Insights as InsightsIcon,
  FilterAlt as FunnelIcon,
  Autorenew as RetentionIcon,
  AccountTree as FlowsIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Event as EventIcon,
  DeviceHub as SessionIcon,
  TouchApp as EngagementIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
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
import { useNavigate } from 'react-router-dom';
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
  FeatureCard,
  FeatureIconBox,
  SectionHeader,
  StatCard,
} from './ArgusAnalyticsPage.styles';

/* ─── Feature definitions ─── */

interface FeatureDef {
  key: string;
  labelKey: string;
  descKey: string;
  icon: React.ReactElement;
  color: string;
  path: string;
}

const FEATURES: FeatureDef[] = [
  {
    key: 'insights',
    labelKey: 'argus.analytics.insights',
    descKey: 'argus.analytics.insightsDesc',
    icon: <InsightsIcon />,
    color: '#6366f1',
    path: '/argus/analytics/insights',
  },
  {
    key: 'funnels',
    labelKey: 'argus.analytics.funnels',
    descKey: 'argus.analytics.funnelsDesc',
    icon: <FunnelIcon />,
    color: '#f59e0b',
    path: '/argus/analytics/funnels',
  },
  {
    key: 'retention',
    labelKey: 'argus.analytics.retention',
    descKey: 'argus.analytics.retentionDesc',
    icon: <RetentionIcon />,
    color: '#10b981',
    path: '/argus/analytics/retention',
  },
  {
    key: 'flows',
    labelKey: 'argus.analytics.flows',
    descKey: 'argus.analytics.flowsDesc',
    icon: <FlowsIcon />,
    color: '#ec4899',
    path: '/argus/analytics/flows',
  },
];

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

/* ─── Types ─── */

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

/* ─── Main Component ─── */

const ArgusAnalyticsPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

  // State
  const [eventNames, setEventNames] = useState<AnalyticsEventNameEntry[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    type: 'preset',
    preset: '14d',
  });

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

  // Derived data
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

  // Donut chart data (top 6 + others)
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

  // Trend chart data → ArgusVolumeChart format
  const trendLabels = useMemo(() => {
    if (!summary) return [];
    return summary.daily_trend.map((d) => String(d.date).substring(5)); // MM-DD
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

  // onZoom: convert index range → custom date range
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
    [summary]
  );

  // Heatmap grid (7 rows × 24 cols)
  const heatmapGrid = useMemo(() => {
    if (!summary || summary.hourly_heatmap.length === 0) return null;
    const grid: number[][] = Array.from({ length: 7 }, () =>
      new Array(24).fill(0)
    );
    let maxCount = 0;
    for (const { dow, hour, count } of summary.hourly_heatmap) {
      // ClickHouse toDayOfWeek: 1=Mon ... 7=Sun
      const rowIdx = dow - 1;
      if (rowIdx >= 0 && rowIdx < 7 && hour >= 0 && hour < 24) {
        grid[rowIdx][hour] = count;
        if (count > maxCount) maxCount = count;
      }
    }
    return { grid, maxCount };
  }, [summary]);

  // ── KPI Card Helper ──
  const renderKpiCard = (
    icon: React.ReactElement,
    iconColor: string,
    label: string,
    value: string | number,
    change?: number | null
  ) => (
    <StatCard isDark={isDark} elevation={0}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {React.cloneElement(icon, {
          sx: { fontSize: 16, color: iconColor },
        })}
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

  return (
    <>
      <PageHeader
        title={
          <ArgusBreadcrumbs
            paths={[
              {
                label: t('argus.analytics.title', 'Analytics'),
              },
            ]}
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
            onChange={setDateRange}
            compact
          />
        }
      />
      <PageContentLoader
        loading={loading}
        skeleton={
          <PageContainer>
            <Grid container spacing={1.5}>
              {[0, 1, 2, 3].map((i) => (
                <Grid size={{ xs: 6, sm: 3 }} key={i}>
                  <StatCard isDark={isDark} elevation={0}>
                    <Skeleton width={80} height={14} />
                    <Skeleton width={60} height={28} />
                  </StatCard>
                </Grid>
              ))}
            </Grid>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 8 }}>
                <ArgusChartSkeleton height={140} color="#6366f1" />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <ArgusChartSkeleton height={140} color="#6366f1" />
              </Grid>
            </Grid>
          </PageContainer>
        }
      >
        <PageContainer>
          {/* ── KPI Cards ── */}
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 6, sm: 3 }}>
              {renderKpiCard(
                <PeopleIcon />,
                isDark ? '#818cf8' : '#6366f1',
                t('argus.analytics.dauToday', 'DAU (Today)'),
                summary?.dau_today ?? 0,
                dauChange
              )}
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              {renderKpiCard(
                <TrendingUpIcon />,
                isDark ? '#34d399' : '#10b981',
                `${t('argus.analytics.total', 'Total Events')} (${dateRangeLabel})`,
                summary?.total_events ?? totalEvents
              )}
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              {renderKpiCard(
                <SessionIcon />,
                isDark ? '#fbbf24' : '#f59e0b',
                t('argus.analytics.sessions', 'Sessions'),
                summary?.total_sessions ?? 0
              )}
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              {renderKpiCard(
                <EngagementIcon />,
                isDark ? '#f472b6' : '#ec4899',
                t('argus.analytics.eventsPerUser', 'Events / User'),
                eventsPerUser
              )}
            </Grid>
          </Grid>

          {/* ── Trend Chart + Donut ── */}
          <Grid container spacing={2}>
            {/* Left column: Trend + Peak Hours heatmap */}
            <Grid size={{ xs: 12, md: 8 }}>
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
                    mt: 2,
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
                    {/* Day labels */}
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
                      {/* Spacer for hour label row */}
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
                    {/* Grid */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      {/* Hour labels */}
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
                      {/* Cells */}
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
                                      sx={{
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                      }}
                                    >
                                      {t(DOW_KEYS[rowIdx])}{' '}
                                      {String(colIdx).padStart(2, '0')}:00
                                    </Typography>
                                    <Typography
                                      sx={{
                                        fontSize: '0.85rem',
                                        fontWeight: 700,
                                      }}
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
                              : alpha(
                                  '#6366f1',
                                  0.1 + level * (isDark ? 0.7 : 0.6)
                                ),
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
            </Grid>

            {/* Right column: Donut + custom legend */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Box
                sx={{
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  borderRadius: 2,
                  p: 2,
                  background: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
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
                    mb: 1,
                  }}
                >
                  {t('argus.analytics.eventDistribution', 'Event Distribution')}
                </Typography>
                {donutData.length > 0 ? (
                  <>
                    <Box sx={{ minHeight: 0 }}>
                      <ResponsiveContainer
                        width="100%"
                        height={160}
                        minWidth={0}
                        minHeight={0}
                        debounce={50}
                      >
                        <PieChart>
                          <Pie
                            data={donutData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={68}
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
                            itemStyle={{
                              color: isDark ? '#e2e8f0' : '#1e293b',
                            }}
                            labelStyle={{
                              color: isDark ? '#f1f5f9' : '#0f172a',
                              fontWeight: 600,
                            }}
                            formatter={(value: number) =>
                              formatCompactNumber(value)
                            }
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                    {/* Custom legend with counts */}
                    <Box
                      sx={{
                        mt: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.25,
                      }}
                    >
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
                  </>
                ) : null}
              </Box>
            </Grid>
          </Grid>

          {/* ── Feature Cards + Event List (2-column) ── */}
          <Grid container spacing={2}>
            {/* Feature cards */}
            <Grid size={{ xs: 12, md: 5 }}>
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
                  {t('argus.analytics.features', 'Features')}
                </Typography>
              </SectionHeader>
              <Grid container spacing={1.5}>
                {FEATURES.map((f) => (
                  <Grid size={{ xs: 6 }} key={f.key}>
                    <FeatureCard
                      isDark={isDark}
                      accentColor={f.color}
                      elevation={0}
                      onClick={() =>
                        navigate(f.path, { state: { fromSidebar: false } })
                      }
                      sx={{ padding: '16px 18px', gap: '6px' }}
                    >
                      <FeatureIconBox
                        color={f.color}
                        sx={{ width: 36, height: 36, borderRadius: '10px' }}
                      >
                        {React.cloneElement(f.icon, { sx: { fontSize: 18 } })}
                      </FeatureIconBox>
                      <Typography
                        variant="subtitle2"
                        fontWeight={700}
                        sx={{ fontSize: '0.8rem' }}
                      >
                        {t(f.labelKey)}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontSize: '0.7rem', lineHeight: 1.4 }}
                      >
                        {t(f.descKey)}
                      </Typography>
                    </FeatureCard>
                  </Grid>
                ))}
              </Grid>
            </Grid>

            {/* Event list */}
            <Grid size={{ xs: 12, md: 7 }}>
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
                  {t('argus.analytics.topEvents', 'Top Events')} (
                  {dateRangeLabel})
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
                        {/* Bar background — uses event color */}
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
            </Grid>
          </Grid>
        </PageContainer>
      </PageContentLoader>
    </>
  );
};

export default ArgusAnalyticsPage;
