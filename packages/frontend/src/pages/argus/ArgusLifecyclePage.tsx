import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  useTheme,
  alpha,
  Paper,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import {
  FiberNew as NewIcon,
  Bolt as ActiveIcon,
  Replay as ReturningIcon,
  HotelClass as DormantIcon,
  PersonOff as ChurnedIcon,
  Autorenew as LifecycleIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import PageContentLoader from '@/components/common/PageContentLoader';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import DateRangeSelector, {
  DateRangeValue,
  dateRangeToApiParams,
} from '@/components/common/DateRangeSelector';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import {
  getLifecycleAnalytics,
  type LifecycleData,
} from '@/services/argus/argusAnalytics';
import { ARGUS_SEMANTIC, ARGUS_SERIES } from './argusThemeTokens';

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

  const STAGE_CONFIG: Record<
    string,
    { color: string; icon: React.ReactElement; labelKey: string }
  > = {
    new: {
      color: ARGUS_SEMANTIC.positive,
      icon: <NewIcon />,
      labelKey: 'argus.lifecycle.new',
    },
    active: {
      color: ARGUS_SEMANTIC.info,
      icon: <ActiveIcon />,
      labelKey: 'argus.lifecycle.active',
    },
    returning: {
      color: ARGUS_SERIES[4],
      icon: <ReturningIcon />,
      labelKey: 'argus.lifecycle.returning',
    },
    dormant: {
      color: ARGUS_SEMANTIC.warning,
      icon: <DormantIcon />,
      labelKey: 'argus.lifecycle.dormant',
    },
    churned: {
      color: ARGUS_SEMANTIC.negative,
      icon: <ChurnedIcon />,
      labelKey: 'argus.lifecycle.churned',
    },
  };

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
            {/* Lifecycle Stages */}
            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                borderRadius: 3,
                mb: 3,
                bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
              }}
            >
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
                {t('argus.lifecycle.lifecycleStages')}
              </Typography>
              {/* Stacked bar */}
              <Box
                sx={{
                  display: 'flex',
                  height: 40,
                  borderRadius: 2,
                  overflow: 'hidden',
                  mb: 2,
                }}
              >
                {data.stages.map((s) => {
                  const pct =
                    totalUsers > 0 ? (s.user_count / totalUsers) * 100 : 0;
                  const cfg = STAGE_CONFIG[s.stage] || {
                    color: '#999',
                    icon: <></>,
                    labelKey: s.stage,
                  };
                  return pct > 0 ? (
                    <Tooltip
                      key={s.stage}
                      title={`${t(cfg.labelKey)}: ${s.user_count.toLocaleString()} (${pct.toFixed(1)}%)`}
                    >
                      <Box
                        sx={{
                          width: `${pct}%`,
                          bgcolor: cfg.color,
                          transition: 'width 0.3s',
                          minWidth: 4,
                        }}
                      />
                    </Tooltip>
                  ) : null;
                })}
              </Box>
              {/* Legend */}
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {data.stages.map((s) => {
                  const cfg = STAGE_CONFIG[s.stage] || {
                    color: '#999',
                    icon: <></>,
                    labelKey: s.stage,
                  };
                  const pct =
                    totalUsers > 0
                      ? ((s.user_count / totalUsers) * 100).toFixed(1)
                      : '0';
                  return (
                    <Box
                      key={s.stage}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                    >
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          bgcolor: cfg.color,
                        }}
                      />
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        sx={{ color: cfg.color }}
                      >
                        {t(cfg.labelKey)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {s.user_count.toLocaleString()} ({pct}%)
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Paper>

            {/* Engagement Metrics */}
            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                borderRadius: 3,
                bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
              }}
            >
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
                {t('argus.lifecycle.engagementMetrics')}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 2,
                }}
              >
                {[
                  { label: t('argus.lifecycle.dau'), value: data.dau },
                  { label: t('argus.lifecycle.wau'), value: data.wau },
                  { label: t('argus.lifecycle.mau'), value: data.mau },
                  {
                    label: t('argus.lifecycle.stickiness'),
                    value: `${data.stickiness}%`,
                    isPercent: true,
                  },
                ].map((m) => (
                  <Paper
                    key={m.label}
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      textAlign: 'center',
                      bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fafafa',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {m.label}
                    </Typography>
                    <Typography variant="h5" fontWeight={800}>
                      {typeof m.value === 'number'
                        ? m.value.toLocaleString()
                        : m.value}
                    </Typography>
                  </Paper>
                ))}
              </Box>
            </Paper>
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
