import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  useTheme,
  alpha,
  Tooltip,
} from '@mui/material';
import {
  People as PeopleIcon,
  TrendingUp as TrendingUpIcon,
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
import { useTranslation } from 'react-i18next';
import { formatCompactNumber } from '@/utils/numberFormat';
import { StatCard } from '../../ArgusAnalyticsPage.styles';
import type { AnalyticsEventNameEntry } from '@/services/argusService';

export interface SummaryData {
  total_events: number;
  unique_users: number;
  total_sessions: number;
  dau_today: number;
  dau_yesterday: number;
  daily_trend: Array<{ date: string; events: number; users: number }>;
  hourly_heatmap: Array<{ dow: number; hour: number; count: number }>;
}

interface OverviewLeftPanelProps {
  summary: SummaryData | null;
  eventNames: AnalyticsEventNameEntry[];
  dateRangeLabel: string;
}

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

export const OverviewLeftPanel: React.FC<OverviewLeftPanelProps> = ({
  summary,
  eventNames,
  dateRangeLabel,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

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
      ((summary.dau_today - summary.dau_yesterday) / summary.dau_yesterday) * 100
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

  return (
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
                  isAnimationActive={false}
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
                    maxWidth: 160,
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
};
