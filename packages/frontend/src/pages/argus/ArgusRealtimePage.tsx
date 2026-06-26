import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  useTheme,
  alpha,
  Paper,
  Chip,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import ArgusVolumeChart from '@/components/argus/ArgusVolumeChart';
import { formatWith } from '@/utils/dateFormat';
import {
  People as PeopleIcon,
  TouchApp as EventIcon,
  TrendingUp as TrendingIcon,
  Public as GlobeIcon,
  FiberManualRecord as DotIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import {
  getRealtimeAnalytics,
  type RealtimeData,
} from '@/services/argus/argusAnalytics';
import { ARGUS_SEMANTIC } from './argusThemeTokens';

// ─── KPI Card ────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ icon, label, value, color }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        borderRadius: 3,
        bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
        borderColor: alpha(color, 0.3),
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: alpha(color, 0.12),
          color,
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h4" fontWeight={800} sx={{ lineHeight: 1.1 }}>
          {value.toLocaleString()}
        </Typography>
      </Box>
    </Paper>
  );
};

// ─── Horizontal Bar ──────────────────────────────────────────────────────────

interface HorizontalBarProps {
  items: { label: string; count: number }[];
  color: string;
}

const HorizontalBar: React.FC<HorizontalBarProps> = ({ items, color }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const maxCount = Math.max(...items.map((d) => d.count), 1);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
      {items.map((item) => (
        <Box
          key={item.label}
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <Typography
            variant="caption"
            sx={{
              width: 120,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            {item.label}
          </Typography>
          <Box sx={{ flex: 1 }}>
            <LinearProgress
              variant="determinate"
              value={(item.count / maxCount) * 100}
              sx={{
                height: 16,
                borderRadius: 1,
                bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: color,
                  borderRadius: 1,
                },
              }}
            />
          </Box>
          <Typography
            variant="caption"
            fontWeight={700}
            sx={{ minWidth: 40, textAlign: 'right' }}
          >
            {item.count.toLocaleString()}
          </Typography>
        </Box>
      ))}
      {items.length === 0 && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ py: 2, textAlign: 'center' }}
        >
          No data
        </Typography>
      )}
    </Box>
  );
};

// ─── Live dot indicator ──────────────────────────────────────────────────────

const LiveDot: React.FC = () => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
    <DotIcon
      sx={{
        fontSize: 12,
        color: ARGUS_SEMANTIC.positive,
        animation: 'pulse 1.5s ease-in-out infinite',
        '@keyframes pulse': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.3 },
        },
      }}
    />
    <Typography variant="caption" fontWeight={600} color="success.main">
      LIVE
    </Typography>
  </Box>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const ArgusRealtimePage: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation();
  const { currentProject } = useOrgProject();
  const projectId = String(currentProject?.id || '1');

  const [data, setData] = useState<RealtimeData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await getRealtimeAnalytics(projectId);
      setData(result);
      setLastUpdate(new Date());
    } catch {
      // Keep previous data on error
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  const primary = theme.palette.primary.main;
  const secondary = theme.palette.secondary.main;
  const successColor = ARGUS_SEMANTIC.positive;
  const warningColor = ARGUS_SEMANTIC.warning;

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
              { label: t('argus.realtime', 'Real-time') },
            ]}
            size="title"
          />
        }
        subtitle={t(
          'argus.realtime.subtitle',
          'Live event stream — last 30 minutes'
        )}
        actions={<LiveDot />}
      />

      <Box>
        {/* KPI Row */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 2,
            mb: 3,
          }}
        >
          <KpiCard
            icon={<PeopleIcon />}
            label={t('argus.realtime.activeUsers')}
            value={data?.active_users || 0}
            color={primary}
          />
          <KpiCard
            icon={<EventIcon />}
            label={t('argus.realtime.totalEvents')}
            value={data?.total_events || 0}
            color={secondary}
          />
          <KpiCard
            icon={<TrendingIcon />}
            label={t('argus.realtime.eventsPerMinAvg')}
            value={
              data?.events_per_minute?.length
                ? Math.round(
                    data.events_per_minute.reduce((s, e) => s + e.count, 0) /
                      data.events_per_minute.length
                  )
                : 0
            }
            color={successColor}
          />
        </Box>

        {/* Charts Row */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
            gap: 2,
            mb: 3,
          }}
        >
          {/* Events per Minute */}
          <ArgusVolumeChart
            title={t('argus.realtime.eventsPerMin')}
            labels={(data?.events_per_minute || []).map((d) =>
              formatWith(d.minute, 'HH:mm')
            )}
            datasets={[
              {
                label: t('argus.realtime.eventsPerMin'),
                data: (data?.events_per_minute || []).map((d) => d.count),
                color: primary,
              },
            ]}
            loading={!data}
            storagePrefix="argus_realtime_epm"
            showCompactToggle={false}
            showChartTypeToggle={false}
            mb={0}
          />

          {/* Top Events */}
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 3,
              bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
            }}
          >
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
              {t('argus.realtime.topEvents')}
            </Typography>
            <HorizontalBar
              items={(data?.top_events || []).map((e) => ({
                label: e.name,
                count: e.count,
              }))}
              color={primary}
            />
          </Paper>
        </Box>

        {/* Bottom Row */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 2,
          }}
        >
          {/* Top Countries */}
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 3,
              bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
            }}
          >
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}
            >
              <GlobeIcon fontSize="small" color="action" />
              <Typography variant="subtitle2" fontWeight={700}>
                {t('argus.realtime.topCountries')}
              </Typography>
            </Box>
            <HorizontalBar
              items={(data?.top_countries || []).map((c) => ({
                label: c.country,
                count: c.count,
              }))}
              color={warningColor}
            />
          </Paper>

          {/* Live Event Stream */}
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 3,
              bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
              maxHeight: 400,
              overflow: 'auto',
            }}
          >
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}
            >
              <LiveDot />
              <Typography variant="subtitle2" fontWeight={700}>
                {t('argus.realtime.recentEvents')}
              </Typography>
            </Box>
            {(data?.recent_events || []).map((evt, i) => (
              <Box
                key={`${evt.timestamp}-${i}`}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  py: 0.6,
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                  '&:last-child': { borderBottom: 'none' },
                }}
              >
                <Chip
                  label={evt.event_name}
                  size="small"
                  sx={{ fontSize: 11, height: 22, fontWeight: 600 }}
                />
                <Box sx={{ flex: 1 }} />
                {evt.user_id && (
                  <Typography
                    variant="caption"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: 10,
                      color: 'text.secondary',
                      maxWidth: 100,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {evt.user_id}
                  </Typography>
                )}
                {evt.country && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: 11 }}
                  >
                    {evt.country}
                  </Typography>
                )}
                <Typography
                  variant="caption"
                  color="text.disabled"
                  sx={{ fontSize: 10, minWidth: 55 }}
                >
                  {new Date(evt.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </Typography>
              </Box>
            ))}
            {(!data?.recent_events || data.recent_events.length === 0) && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ py: 3, textAlign: 'center' }}
              >
                {t('argus.realtime.noData')}
              </Typography>
            )}
          </Paper>
        </Box>

        {/* Last update */}
        {lastUpdate && (
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ mt: 2, display: 'block', textAlign: 'right' }}
          >
            {t('argus.realtime.lastUpdated')}: {lastUpdate.toLocaleTimeString()}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default ArgusRealtimePage;
