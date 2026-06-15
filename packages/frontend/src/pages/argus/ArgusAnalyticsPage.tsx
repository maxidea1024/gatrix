import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  useTheme,
  alpha,
  Grid,
  Skeleton,
} from '@mui/material';
import {
  Insights as InsightsIcon,
  FilterAlt as FunnelIcon,
  Autorenew as RetentionIcon,
  AccountTree as FlowsIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Event as EventIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import argusService from '@/services/argusService';
import { formatCompactNumber } from '@/utils/numberFormat';
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

/* ─── Main Component ─── */

const ArgusAnalyticsPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

  // Event stats
  const [eventNames, setEventNames] = useState<
    { name: string; count: number }[]
  >([]);
  const [loading, setLoading] = useState(true);

  const fetchEventNames = useCallback(async () => {
    setLoading(true);
    try {
      const data = await argusService.getAnalyticsEventNames(projectId, '14d');
      setEventNames(data);
    } catch {
      setEventNames([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchEventNames();
  }, [fetchEventNames]);

  const totalEvents = useMemo(
    () => eventNames.reduce((sum, e) => sum + Number(e.count), 0),
    [eventNames]
  );

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
      />
      <PageContainer>
        {/* Stats row */}
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <StatCard isDark={isDark} elevation={0}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EventIcon
                  sx={{
                    fontSize: 18,
                    color: isDark ? '#818cf8' : '#6366f1',
                  }}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {t('argus.analytics.eventNames', 'Event Types')}
                </Typography>
              </Box>
              {loading ? (
                <Skeleton width={60} height={32} />
              ) : (
                <Typography variant="h5" fontWeight={700}>
                  {eventNames.length}
                </Typography>
              )}
            </StatCard>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <StatCard isDark={isDark} elevation={0}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUpIcon
                  sx={{
                    fontSize: 18,
                    color: isDark ? '#34d399' : '#10b981',
                  }}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {t('argus.analytics.total', 'Total Events')} (14d)
                </Typography>
              </Box>
              {loading ? (
                <Skeleton width={80} height={32} />
              ) : (
                <Typography variant="h5" fontWeight={700}>
                  {formatCompactNumber(totalEvents)}
                </Typography>
              )}
            </StatCard>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <StatCard isDark={isDark} elevation={0}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PeopleIcon
                  sx={{
                    fontSize: 18,
                    color: isDark ? '#fbbf24' : '#f59e0b',
                  }}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {t('argus.analytics.topEvent', 'Top Event')}
                </Typography>
              </Box>
              {loading ? (
                <Skeleton width={100} height={32} />
              ) : (
                <Typography
                  variant="h5"
                  fontWeight={700}
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {eventNames[0]?.name || '—'}
                </Typography>
              )}
            </StatCard>
          </Grid>
        </Grid>

        {/* Feature cards */}
        <Box>
          <SectionHeader>
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                fontSize: '0.7rem',
              }}
            >
              {t('argus.analytics.features', 'Features')}
            </Typography>
          </SectionHeader>
          <Grid container spacing={2}>
            {FEATURES.map((f) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={f.key}>
                <FeatureCard
                  isDark={isDark}
                  accentColor={f.color}
                  elevation={0}
                  onClick={() =>
                    navigate(f.path, { state: { fromSidebar: false } })
                  }
                >
                  <FeatureIconBox color={f.color}>
                    {React.cloneElement(f.icon, { sx: { fontSize: 22 } })}
                  </FeatureIconBox>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {t(f.labelKey)}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: '0.8rem', lineHeight: 1.5 }}
                  >
                    {t(f.descKey)}
                  </Typography>
                </FeatureCard>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Top events table */}
        {!loading && eventNames.length > 0 && (
          <Box>
            <SectionHeader>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  fontSize: '0.7rem',
                }}
              >
                {t('argus.analytics.eventNames', 'Event List')} (14d)
              </Typography>
            </SectionHeader>
            <Box
              sx={{
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              {eventNames.slice(0, 15).map((ev, i) => {
                const pctValue =
                  totalEvents > 0 ? (ev.count / totalEvents) * 100 : 0;
                const pctLabel =
                  pctValue === 0
                    ? '0%'
                    : pctValue < 1
                      ? '<1%'
                      : `${Math.round(pctValue)}%`;
                return (
                  <Box
                    key={ev.name}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      px: 2,
                      py: 1,
                      borderBottom:
                        i < Math.min(eventNames.length, 15) - 1
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
                    {/* Bar background */}
                    <Box
                      sx={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${pctValue}%`,
                        background: alpha(isDark ? '#818cf8' : '#6366f1', 0.06),
                        transition: 'width 0.3s ease',
                      }}
                    />
                    <Typography
                      variant="body2"
                      sx={{
                        flex: 1,
                        fontWeight: 500,
                        position: 'relative',
                        zIndex: 1,
                      }}
                    >
                      {ev.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        fontWeight: 600,
                        position: 'relative',
                        zIndex: 1,
                        minWidth: 60,
                        textAlign: 'right',
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
                        minWidth: 40,
                        textAlign: 'right',
                        opacity: 0.7,
                      }}
                    >
                      {pctLabel}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
      </PageContainer>
    </>
  );
};

export default ArgusAnalyticsPage;
