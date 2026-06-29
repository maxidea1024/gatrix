import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  useTheme,
  alpha,
} from '@mui/material';
import { Autorenew as LifecycleIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import PageContentLoader from '@/components/common/PageContentLoader';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import DateRangeSelector, {
  DateRangeValue,
  dateRangeToApiParams,
} from '@/components/common/DateRangeSelector';
import ArgusVolumeChart from '@/components/argus/ArgusVolumeChart';
import type { ChartDataset } from '@/components/argus/InteractiveTimeSeriesChart';
import { ChangeIndicator } from '@/pages/argus/components/argusSharedComponents';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import {
  getLifecycleAnalytics,
  type LifecycleData,
} from '@/services/argus/argusAnalytics';
import { ARGUS_SEMANTIC, ARGUS_SERIES, argusBorder } from './argusThemeTokens';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateLabel(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function calcChange(
  current: number | undefined,
  previous: number | undefined
): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

// ─── Stage Config ─────────────────────────────────────────────────────────────

const STAGE_ORDER = ['new', 'active', 'returning', 'dormant', 'churned'];
const STAGE_COLORS: Record<string, string> = {
  new: ARGUS_SEMANTIC.positive,
  active: ARGUS_SEMANTIC.info,
  returning: ARGUS_SERIES[4],
  dormant: ARGUS_SEMANTIC.warning,
  churned: ARGUS_SEMANTIC.negative,
};
const STAGE_LABEL_KEYS: Record<string, string> = {
  new: 'argus.lifecycle.new',
  active: 'argus.lifecycle.active',
  returning: 'argus.lifecycle.returning',
  dormant: 'argus.lifecycle.dormant',
  churned: 'argus.lifecycle.churned',
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const ArgusLifecyclePage: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation();
  const { currentProject } = useOrgProject();
  const projectId = String(currentProject?.id || '1');

  const [data, setData] = useState<LifecycleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    type: 'preset',
    preset: '30d',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const apiParams = dateRangeToApiParams(dateRange);
      setData(await getLifecycleAnalytics(projectId, apiParams));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalUsers = data
    ? data.stages.reduce((a, s) => a + s.user_count, 0)
    : 0;

  // ── Shared styles ───────────────────────────────────────────────────────────

  const borderColor = argusBorder(isDark);

  // ── KPI strip data (realtime-style cards-in-one-card) ───────────────────────

  const engagementItems = data
    ? [
        {
          label: t('argus.lifecycle.dau'),
          value: data.dau,
          prev: data.prev_dau,
          format: (v: number) => v.toLocaleString(),
        },
        {
          label: t('argus.lifecycle.wau'),
          value: data.wau,
          prev: data.prev_wau,
          format: (v: number) => v.toLocaleString(),
        },
        {
          label: t('argus.lifecycle.mau'),
          value: data.mau,
          prev: data.prev_mau,
          format: (v: number) => v.toLocaleString(),
        },
        {
          label: t('argus.lifecycle.stickiness'),
          value: data.stickiness,
          prev: data.prev_stickiness,
          format: (v: number) => `${v}%`,
        },
      ]
    : [];

  // ── New Users chart datasets ────────────────────────────────────────────────

  const newUsersLabels = useMemo(
    () => (data?.new_users_over_time || []).map((d) => formatDateLabel(d.period)),
    [data]
  );

  const newUsersDatasets = useMemo((): ChartDataset[] => {
    if (!data?.new_users_over_time?.length) return [];
    const currentValues = data.new_users_over_time.map((d) => d.new_users);
    const ds: ChartDataset[] = [
      {
        label: t('argus.lifecycle.newUsersOverTime'),
        data: currentValues,
        color: ARGUS_SEMANTIC.positive,
      },
    ];

    if (data.prev_new_users_over_time?.length) {
      const prevValues = data.prev_new_users_over_time.map((d) => d.new_users);
      const aligned = currentValues.map((_, i) => prevValues[i] ?? 0);
      ds.push({
        label: t('argus.lifecycle.previousPeriod'),
        data: aligned,
        color: isDark ? '#555' : '#bbb',
        type: 'line',
      });
    }
    return ds;
  }, [data, t, isDark]);

  // ── Stages over time chart datasets ─────────────────────────────────────────

  const stagesLabels = useMemo(() => {
    if (!data?.stages_over_time?.length) return [];
    const periodSet = new Set(data.stages_over_time.map((r) => r.period));
    return Array.from(periodSet).sort().map(formatDateLabel);
  }, [data]);

  const stagesDatasets = useMemo((): ChartDataset[] => {
    if (!data?.stages_over_time?.length) return [];

    const periodMap = new Map<string, Record<string, number>>();
    for (const row of data.stages_over_time) {
      if (!periodMap.has(row.period)) periodMap.set(row.period, {});
      periodMap.get(row.period)![row.stage] = row.user_count;
    }
    const periods = Array.from(periodMap.keys()).sort();

    const ds: ChartDataset[] = STAGE_ORDER.map((stage) => ({
      label: t(STAGE_LABEL_KEYS[stage] || stage),
      data: periods.map((p) => periodMap.get(p)?.[stage] || 0),
      color: STAGE_COLORS[stage] || '#999',
      type: 'stacked-bar' as const,
    }));

    // Previous period total as line overlay
    if (data.prev_stages_over_time?.length) {
      const prevPeriodMap = new Map<string, number>();
      for (const row of data.prev_stages_over_time) {
        prevPeriodMap.set(
          row.period,
          (prevPeriodMap.get(row.period) || 0) + row.user_count
        );
      }
      const prevPeriods = Array.from(prevPeriodMap.keys()).sort();
      const prevTotals = periods.map(
        (_, i) => (prevPeriods[i] ? prevPeriodMap.get(prevPeriods[i]) || 0 : 0)
      );
      ds.push({
        label: t('argus.lifecycle.previousPeriod'),
        data: prevTotals,
        color: isDark ? '#555' : '#bbb',
        type: 'line',
      });
    }

    return ds;
  }, [data, t, isDark]);

  // ── DAU/WAU/MAU over time chart datasets ────────────────────────────────────

  const dauLabels = useMemo(
    () => (data?.dau_over_time || []).map((d) => formatDateLabel(d.period)),
    [data]
  );

  const dauDatasets = useMemo((): ChartDataset[] => {
    if (!data?.dau_over_time?.length) return [];
    return [
      {
        label: 'MAU',
        data: data.dau_over_time.map((d) => d.mau),
        color: ARGUS_SERIES[2],
        type: 'area',
      },
      {
        label: 'WAU',
        data: data.dau_over_time.map((d) => d.wau),
        color: ARGUS_SERIES[1],
        type: 'area',
      },
      {
        label: 'DAU',
        data: data.dau_over_time.map((d) => d.dau),
        color: ARGUS_SERIES[0],
        type: 'line',
      },
    ];
  }, [data]);

  // ── Individual stage trend chart (multi-line from stages_over_time) ────────

  const stageTrendDatasets = useMemo((): ChartDataset[] => {
    if (!data?.stages_over_time?.length) return [];

    const periodMap = new Map<string, Record<string, number>>();
    for (const row of data.stages_over_time) {
      if (!periodMap.has(row.period)) periodMap.set(row.period, {});
      periodMap.get(row.period)![row.stage] = row.user_count;
    }
    const periods = Array.from(periodMap.keys()).sort();

    return STAGE_ORDER.map((stage) => ({
      label: t(STAGE_LABEL_KEYS[stage] || stage),
      data: periods.map((p) => periodMap.get(p)?.[stage] || 0),
      color: STAGE_COLORS[stage] || '#999',
      type: 'line' as const,
    }));
  }, [data, t]);

  return (
    <Box>
      <PageHeader
        title={
          <ArgusBreadcrumbs
            paths={[
              {
                label: t('argus.analytics.title', 'Analytics'),
                to: '/argus/analytics',
              },
              { label: t('argus.lifecycle') },
            ]}
            size="title"
          />
        }
        subtitle={t('argus.lifecycle.subtitle')}
        actions={
          <DateRangeSelector value={dateRange} onChange={setDateRange} />
        }
      />

      <PageContentLoader loading={loading}>
        {data ? (
          <>
            {/* ── Combined KPI + Stages Card ──────────────────────────── */}
            <Box
              sx={{
                border: `1px solid ${borderColor}`,
                borderRadius: 2,
                overflow: 'hidden',
                bgcolor: isDark ? 'rgba(255,255,255,0.015)' : '#fff',
                mb: 2.5,
              }}
            >
              {/* Row 1: Engagement metrics */}
              <Box sx={{ display: 'flex' }}>
                {engagementItems.map((item, i) => {
                  const change = calcChange(item.value, item.prev);
                  return (
                    <Box
                      key={item.label}
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        p: 1.5,
                        borderRight:
                          i < engagementItems.length - 1
                            ? `1px solid ${borderColor}`
                            : undefined,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.3,
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: 'text.secondary',
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}
                      >
                        {item.label}
                      </Typography>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 0.75,
                        }}
                      >
                        <Typography
                          sx={{
                            fontSize: 22,
                            fontWeight: 800,
                            lineHeight: 1,
                          }}
                        >
                          {item.format(item.value)}
                        </Typography>
                        {change != null && (
                          <ChangeIndicator value={change} variant="chip" />
                        )}
                      </Box>
                      <Typography
                        sx={{
                          fontSize: 10,
                          color: 'text.disabled',
                          mt: 0.2,
                        }}
                      >
                        {t('argus.lifecycle.previousPeriod')}: {item.format(item.prev)}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
              {/* Divider */}
              <Box sx={{ borderTop: `1px solid ${borderColor}` }} />
              {/* Row 2: Lifecycle stages */}
              <Box sx={{ display: 'flex' }}>
                {data.stages.map((s, i) => {
                  const pct =
                    totalUsers > 0
                      ? ((s.user_count / totalUsers) * 100).toFixed(1)
                      : '0';
                  return (
                    <Box
                      key={s.stage}
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        p: 1.5,
                        borderRight:
                          i < data.stages.length - 1
                            ? `1px solid ${borderColor}`
                            : undefined,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.3,
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: 'text.secondary',
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}
                      >
                        {t(STAGE_LABEL_KEYS[s.stage] || s.stage)}
                      </Typography>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 0.75,
                        }}
                      >
                        <Typography
                          sx={{
                            fontSize: 22,
                            fontWeight: 800,
                            lineHeight: 1,
                          }}
                        >
                          {s.user_count.toLocaleString()}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: 'text.secondary',
                          }}
                        >
                          {pct}%
                        </Typography>
                      </Box>
                      <Typography
                        sx={{
                          fontSize: 10,
                          color: 'text.disabled',
                          mt: 0.2,
                        }}
                      >
                        {t('argus.lifecycle.avgEvents')}: {s.avg_events.toLocaleString()}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>

            {/* ── DAU / WAU / MAU Trend (ArgusVolumeChart) ──────────── */}
            <ArgusVolumeChart
              title={t('argus.lifecycle.dauWauMauTrend')}
              labels={dauLabels}
              datasets={dauDatasets}
              loading={loading}
              storagePrefix="lifecycle_dau"
              chartType="area"
              showChartTypeToggle={false}
              showCompactToggle={false}
              showLegend
              skeletonColor={ARGUS_SERIES[0]}
              mb={2.5}
            />

            {/* ── Lifecycle Stages Over Time (ArgusVolumeChart) ────────── */}
            <ArgusVolumeChart
              title={t('argus.lifecycle.stagesOverTime')}
              labels={stagesLabels}
              datasets={stagesDatasets}
              loading={loading}
              storagePrefix="lifecycle_stages"
              chartType="stacked-bar"
              showChartTypeToggle={false}
              showCompactToggle={false}
              skeletonColor={ARGUS_SEMANTIC.info}
              mb={2.5}
            />

            {/* ── Individual Stage Trends (multi-line) ───────────────── */}
            <ArgusVolumeChart
              title={t('argus.lifecycle.stageTrends')}
              labels={stagesLabels}
              datasets={stageTrendDatasets}
              loading={loading}
              storagePrefix="lifecycle_stage_trends"
              chartType="line"
              showChartTypeToggle={false}
              showCompactToggle={false}
              showLegend
              skeletonColor={ARGUS_SEMANTIC.warning}
              mb={2.5}
            />

            {/* ── New Users Trend (ArgusVolumeChart) ─────────────────── */}
            <ArgusVolumeChart
              title={t('argus.lifecycle.newUsersOverTime')}
              labels={newUsersLabels}
              datasets={newUsersDatasets}
              loading={loading}
              storagePrefix="lifecycle_newusers"
              chartType="area"
              showChartTypeToggle={false}
              showCompactToggle={false}
              skeletonColor={ARGUS_SEMANTIC.positive}
              mb={0}
            />
          </>
        ) : (
          <EmptyPagePlaceholder
            icon={<LifecycleIcon sx={{ fontSize: 48 }} />}
            message={t('argus.lifecycle.noData')}
            subtitle={t('argus.lifecycle.noDataDesc')}
          />
        )}
      </PageContentLoader>
    </Box>
  );
};

export default ArgusLifecyclePage;
