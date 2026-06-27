import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  useTheme,
  alpha,
  Chip,
  LinearProgress,
  Tooltip,
  IconButton,
} from '@mui/material';
import ArgusVolumeChart from '@/components/argus/ArgusVolumeChart';
import { formatWith } from '@/utils/dateFormat';
import {
  People as PeopleIcon,
  TouchApp as EventIcon,
  Speed as SpeedIcon,
  FiberManualRecord as DotIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
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
import {
  ComposableMap as _ComposableMap,
  Geographies as _Geographies,
  Geography as _Geography,
  Marker as _Marker,
} from 'react-simple-maps';

// React 18 JSX type compatibility
/* eslint-disable @typescript-eslint/no-explicit-any */
const ComposableMap = _ComposableMap as any;
const Geographies = _Geographies as any;
const Geography = _Geography as any;
const Marker = _Marker as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL = 5000;
const SPARKLINE_POINTS = 30;

const PLATFORM_COLORS: Record<string, string> = {
  iOS: '#5B8FF9',
  Android: '#30BF78',
  Web: '#FAAD14',
  Steam: '#1B2838',
  PlayStation: '#003087',
  Windows: '#00A4EF',
  macOS: '#A2AAAD',
  Other: '#8C8C8C',
};

const EVENT_CATEGORY_COLORS: Record<string, string> = {
  error: ARGUS_SEMANTIC.negative,
  purchase: ARGUS_SEMANTIC.positive,
  click: ARGUS_SEMANTIC.info,
  view: ARGUS_SEMANTIC.warning,
  session: '#ab47bc',
  default: '#8C8C8C',
};

function classifyEventColor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('error') || n.includes('crash')) return EVENT_CATEGORY_COLORS.error;
  if (n.includes('purchase') || n.includes('buy') || n.includes('grant') || n.includes('item_purchased')) return EVENT_CATEGORY_COLORS.purchase;
  if (n.includes('click') || n.includes('$click') || n.includes('tap')) return EVENT_CATEGORY_COLORS.click;
  if (n.includes('view') || n.includes('page') || n.includes('impression')) return EVENT_CATEGORY_COLORS.view;
  if (n.includes('session') || n.includes('login')) return EVENT_CATEGORY_COLORS.session;
  return EVENT_CATEGORY_COLORS.default;
}

// ─── Country code → lat/lng for map markers ─────────────────────────────────
const COUNTRY_COORDS: Record<string, [number, number]> = {
  US: [-95, 38], KR: [127, 36], JP: [139, 36], CN: [105, 35], DE: [10, 51],
  GB: [-1, 52], FR: [2, 47], CA: [-95, 56], AU: [134, -25], BR: [-51, -10],
  IN: [78, 22], RU: [100, 60], MX: [-102, 23], ES: [-3, 40], IT: [12, 42],
  NL: [5, 52], SE: [15, 62], NO: [10, 62], FI: [26, 64], DK: [10, 56],
  PL: [20, 52], TR: [35, 39], SA: [45, 24], AE: [54, 24], SG: [104, 1],
  TH: [101, 15], VN: [108, 16], ID: [118, -2], PH: [122, 12], MY: [102, 4],
  TW: [121, 24], HK: [114, 22], NZ: [174, -41], AR: [-64, -34], CL: [-71, -33],
  CO: [-74, 4], PE: [-76, -10], EG: [30, 27], ZA: [25, -29], NG: [8, 10],
  KE: [37, 0], IL: [35, 31], UA: [32, 49], CZ: [15, 50], AT: [14, 47],
  CH: [8, 47], BE: [4, 51], PT: [- 8, 39], IE: [-8, 53], RO: [25, 46],
};

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// ─── Mini Sparkline (pure SVG) ────────────────────────────────────────────────

const Sparkline: React.FC<{ data: number[]; color: string; width?: number; height?: number }> = React.memo(
  ({ data, color, width = 100, height = 20 }) => {
    if (data.length < 2) {
      return (
        <svg width={width} height={height}>
          <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={alpha(color, 0.2)} strokeWidth={1} strokeDasharray="3,3" />
        </svg>
      );
    }
    const max = Math.max(...data, 1);
    const points = data.map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - (v / max) * (height - 2) - 1;
      return `${x},${y}`;
    });
    const areaPoints = `0,${height} ${points.join(' ')} ${width},${height}`;
    return (
      <svg width={width} height={height}>
        <polygon points={areaPoints} fill={alpha(color, 0.12)} />
        <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      </svg>
    );
  }
);
Sparkline.displayName = 'Sparkline';

// ─── Pressure Gauge (pure CSS) ────────────────────────────────────────────────

const PressureGauge: React.FC<{ value: number; max: number }> = React.memo(({ value, max }) => {
  const theme = useTheme();
  const ratio = Math.min(value / Math.max(max, 1), 1);
  const angle = -90 + ratio * 180; // -90° to 90°
  const statusColor = ratio < 0.4 ? ARGUS_SEMANTIC.positive : ratio < 0.7 ? ARGUS_SEMANTIC.warning : ARGUS_SEMANTIC.negative;
  const statusLabel = ratio < 0.4 ? 'Idle' : ratio < 0.7 ? 'Normal' : 'High';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.3 }}>
      {/* Gauge arc */}
      <Box
        sx={{
          width: 56,
          height: 28,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: `conic-gradient(from 180deg, ${ARGUS_SEMANTIC.positive} 0deg, ${ARGUS_SEMANTIC.warning} 90deg, ${ARGUS_SEMANTIC.negative} 180deg, transparent 180deg)`,
            opacity: 0.6,
          }}
        />
        {/* Inner cutout */}
        <Box
          sx={{
            position: 'absolute',
            top: 6,
            left: 6,
            width: 44,
            height: 44,
            borderRadius: '50%',
            bgcolor: theme.palette.background.paper,
          }}
        />
        {/* Needle */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: '50%',
            width: 2,
            height: 22,
            bgcolor: statusColor,
            borderRadius: 1,
            transformOrigin: 'bottom center',
            transform: `translateX(-50%) rotate(${angle}deg)`,
            transition: 'transform 0.8s ease-out',
            boxShadow: `0 0 4px ${statusColor}`,
          }}
        />
      </Box>
      <Typography sx={{ fontSize: 10, fontWeight: 700, color: statusColor, lineHeight: 1 }}>
        {value}/{statusLabel}
      </Typography>
    </Box>
  );
});
PressureGauge.displayName = 'PressureGauge';

// ─── KPI Pulse Card ──────────────────────────────────────────────────────────

interface PulseCardProps {
  label: string;
  value: number;
  prevValue: number;
  color: string;
  icon: React.ReactNode;
  sparkData: number[];
  formatValue?: (v: number) => string;
  subtitle?: string;
  subtitleColor?: string;
}

const PulseCard: React.FC<PulseCardProps> = React.memo(({ label, value, prevValue, color, icon, sparkData, formatValue, subtitle, subtitleColor }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const delta = value - prevValue;
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (delta !== 0) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 600);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        p: 1.5,

        borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.3,
        position: 'relative',
        overflow: 'hidden',
        transition: 'background-color 0.3s',
        bgcolor: flash ? alpha(color, 0.06) : 'transparent',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Box sx={{ color: alpha(color, 0.7), display: 'flex' }}>{icon}</Box>
        <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </Typography>
        {delta !== 0 && (
          <Typography
            sx={{
              fontSize: 10,
              fontWeight: 700,
              ml: 'auto',
              color: delta > 0 ? ARGUS_SEMANTIC.positive : ARGUS_SEMANTIC.negative,
            }}
          >
            {delta > 0 ? '+' : ''}{delta}
          </Typography>
        )}
      </Box>
      <Typography
        sx={{
          fontSize: 22,
          fontWeight: 800,
          lineHeight: 1,
          transition: 'text-shadow 0.3s',
          textShadow: flash ? `0 0 12px ${alpha(color, 0.5)}` : 'none',
        }}
      >
        {formatValue ? formatValue(value) : value.toLocaleString()}
      </Typography>
      {subtitle && (
        <Typography sx={{ fontSize: 9, fontWeight: 600, color: subtitleColor || 'text.disabled', mt: 0.2 }}>
          {subtitle}
        </Typography>
      )}
      <Sparkline data={sparkData} color={color} width={140} height={16} />
    </Box>
  );
});
PulseCard.displayName = 'PulseCard';

// ─── Section Panel wrapper ───────────────────────────────────────────────────

const Panel: React.FC<{
  children: React.ReactNode;
  sx?: Record<string, any>;
  title?: string;
  titleRight?: React.ReactNode;
  noPadding?: boolean;
}> = ({ children, sx, title, titleRight, noPadding }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Box
      sx={{
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
        borderRadius: 1.5,
        bgcolor: isDark ? 'rgba(255,255,255,0.015)' : '#fff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...sx,
      }}
    >
      {title && (
        <Box
          sx={{
            px: 1.5,
            py: 0.8,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
            flexShrink: 0,
          }}
        >
          <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>
            {title}
          </Typography>
          {titleRight && <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>{titleRight}</Box>}
        </Box>
      )}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', ...(noPadding ? {} : { p: 1.5 }) }}>{children}</Box>
    </Box>
  );
};

// ─── Horizontal Bar Row ──────────────────────────────────────────────────────

const BarRow: React.FC<{ label: string; value: number; max: number; color: string; prefix?: string }> = ({ label, value, max, color, prefix }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, py: 0.3 }}>
    {prefix && (
      <Typography sx={{ fontSize: 12, minWidth: 20 }}>{prefix}</Typography>
    )}
    <Typography sx={{ fontSize: 11, fontWeight: 600, width: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {label}
    </Typography>
    <Box sx={{ flex: 1 }}>
      <LinearProgress
        variant="determinate"
        value={max > 0 ? (value / max) * 100 : 0}
        sx={{
          height: 10,
          borderRadius: 0.5,
          bgcolor: alpha(color, 0.08),
          '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 0.5 },
        }}
      />
    </Box>
    <Typography sx={{ fontSize: 10, fontWeight: 700, minWidth: 32, textAlign: 'right', fontFamily: 'monospace' }}>
      {value.toLocaleString()}
    </Typography>
  </Box>
);

// ─── Live dot ────────────────────────────────────────────────────────────────

const LiveDot: React.FC = () => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
    <DotIcon
      sx={{
        fontSize: 10,
        color: ARGUS_SEMANTIC.positive,
        animation: 'rtPulse 1.5s ease-in-out infinite',
        '@keyframes rtPulse': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.3 },
        },
      }}
    />
    <Typography variant="caption" fontWeight={700} sx={{ color: ARGUS_SEMANTIC.positive, fontSize: 10 }}>
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
  const [prevData, setPrevData] = useState<RealtimeData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [sparkHistory, setSparkHistory] = useState<number[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const result = await getRealtimeAnalytics(projectId);
      setData((prev) => {
        setPrevData(prev);
        return result;
      });
      setLastUpdate(new Date());
      // Push current EPM to spark history
      const currentEpm = result.events_per_minute?.length
        ? result.events_per_minute[result.events_per_minute.length - 1]?.count ?? 0
        : 0;
      setSparkHistory((prev) => [...prev.slice(-SPARKLINE_POINTS + 1), currentEpm]);
    } catch {
      // Keep previous data
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(() => {
      if (!paused) fetchData();
    }, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData, paused]);

  // ─── Derived computations ──────────────────────────────────────────────────

  const primary = theme.palette.primary.main;
  const epmData = data?.events_per_minute || [];
  const epmValues = epmData.map((d) => d.count);
  const avgEpm = epmValues.length ? Math.round(epmValues.reduce((a, b) => a + b, 0) / epmValues.length) : 0;
  const maxEpm = Math.max(...epmValues, 1);

  // Platform distribution (client-side from recent_events)
  const platformDist = useMemo(() => {
    const counts: Record<string, number> = {};
    (data?.recent_events || []).forEach((evt) => {
      const p = evt.platform || 'Other';
      counts[p] = (counts[p] || 0) + 1;
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        count,
        pct: Math.round((count / total) * 100),
        color: PLATFORM_COLORS[name] || PLATFORM_COLORS.Other,
      }));
  }, [data?.recent_events]);

  // Countries
  const countries = data?.top_countries || [];
  const maxCountry = Math.max(...countries.map((c) => c.count), 1);

  // Top events
  const topEvents = data?.top_events || [];
  const maxEvent = Math.max(...topEvents.map((e) => e.count), 1);

  // Recent events
  const recentEvents = data?.recent_events || [];

  // Events per second
  const eps = epmValues.length ? (epmValues[epmValues.length - 1] / 60) : 0;

  // ── Yesterday comparison ─────────────────────────────────────────────────
  const prevActiveUsers = data?.prev_active_users || 0;
  const prevTotalEvents = data?.prev_total_events || 0;
  const errorRate = data?.error_rate ?? 0;
  const errorCount = data?.error_count ?? 0;
  const anomalies = data?.anomalies || { active_users: 'normal' as const, error_rate: 'normal' as const, event_volume: 'normal' as const };

  const vsLabel = (current: number, prev: number): { text: string; color: string } => {
    if (prev === 0) return { text: '', color: 'text.disabled' };
    const pct = Math.round(((current - prev) / prev) * 100);
    const arrow = pct > 0 ? '↑' : pct < 0 ? '↓' : '→';
    const color = Math.abs(pct) < 10 ? 'text.disabled' : pct > 0 ? ARGUS_SEMANTIC.positive : ARGUS_SEMANTIC.negative;
    return { text: `vs ${t('argus.realtime.yesterday', 'yesterday')} ${pct > 0 ? '+' : ''}${pct}% ${arrow}`, color };
  };

  const activeUsersVs = vsLabel(data?.active_users || 0, prevActiveUsers);
  const totalEventsVs = vsLabel(data?.total_events || 0, prevTotalEvents);

  // Previous period EPM (for chart overlay)
  const prevEpmValues = (data?.prev_events_per_minute || []).map((d) => d.count);

  // Spark data for cards
  const activeUsersSparkData = useMemo(() => {
    return epmValues.length > 0 ? epmValues : [];
  }, [epmValues]);

  // Active users (deduplicated from recent_events, most recent action per user)
  const activeUsersList = useMemo(() => {
    const userMap = new Map<string, { user_id: string; event_name: string; platform: string | null; country: string | null; timestamp: string }>();
    (data?.recent_events || []).forEach((evt) => {
      if (!evt.user_id) return;
      if (!userMap.has(evt.user_id)) {
        userMap.set(evt.user_id, {
          user_id: evt.user_id,
          event_name: evt.event_name,
          platform: evt.platform,
          country: evt.country,
          timestamp: evt.timestamp,
        });
      }
    });
    return Array.from(userMap.values()).slice(0, 20);
  }, [data?.recent_events]);

  // Event type × time heatmap data
  const eventHeatmap = useMemo(() => {
    const events = data?.recent_events || [];
    if (events.length === 0) return { rows: [] as { name: string; cells: number[] }[], timeLabels: [] as string[], maxVal: 0 };

    // Count events per type
    const typeCounts: Record<string, number> = {};
    events.forEach((e) => { typeCounts[e.event_name] = (typeCounts[e.event_name] || 0) + 1; });
    const topTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n]) => n);

    // Build time buckets (6 × 5min slots over last 30 min)
    const now = Date.now();
    const SLOTS = 6;
    const SLOT_MS = 5 * 60 * 1000;
    const timeLabels: string[] = [];
    for (let i = 0; i < SLOTS; i++) {
      const t = new Date(now - (SLOTS - 1 - i) * SLOT_MS);
      timeLabels.push(formatWith(t.toISOString(), 'HH:mm'));
    }

    let maxVal = 0;
    const rows = topTypes.map((name) => {
      const cells = Array(SLOTS).fill(0);
      events.forEach((e) => {
        if (e.event_name !== name) return;
        const ts = new Date(e.timestamp).getTime();
        const slot = Math.floor((ts - (now - SLOTS * SLOT_MS)) / SLOT_MS);
        if (slot >= 0 && slot < SLOTS) cells[slot]++;
      });
      cells.forEach((c) => { if (c > maxVal) maxVal = c; });
      return { name, cells };
    });
    return { rows, timeLabels, maxVal: maxVal || 1 };
  }, [data?.recent_events]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)', overflow: 'hidden' }}>
      {/* Header */}
      <PageHeader
        title={
          <ArgusBreadcrumbs
            paths={[
              { label: t('argus.analytics.title', 'Analytics'), to: '/argus/analytics' },
              { label: t('argus.realtime', 'Real-time') },
            ]}
            size="title"
          />
        }
        subtitle={t('argus.realtime.subtitle', 'Live event stream — last 30 minutes')}
        actions={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LiveDot />
            {lastUpdate && (
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
                {formatWith(lastUpdate, 'HH:mm:ss')}
              </Typography>
            )}
          </Box>
        }
      />

      {/* Content — fills remaining height */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 0.8, pb: 1 }}>
        {/* ═══════ Row 1: KPI Strip ═══════ */}
        <Box
          sx={{
            display: 'flex',
            flexShrink: 0,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
            borderRadius: 1.5,
            overflow: 'hidden',
            bgcolor: isDark ? 'rgba(255,255,255,0.015)' : '#fff',
          }}
        >
          <PulseCard
            label={t('argus.realtime.activeUsers', 'Active Users')}
            value={data?.active_users || 0}
            prevValue={prevData?.active_users || 0}
            color={ARGUS_SEMANTIC.positive}
            icon={<PeopleIcon sx={{ fontSize: 14 }} />}
            sparkData={activeUsersSparkData}
            subtitle={activeUsersVs.text}
            subtitleColor={activeUsersVs.color}
          />
          <PulseCard
            label={t('argus.realtime.totalEvents', 'Total Events')}
            value={data?.total_events || 0}
            prevValue={prevData?.total_events || 0}
            color={primary}
            icon={<EventIcon sx={{ fontSize: 14 }} />}
            sparkData={epmValues}
            subtitle={totalEventsVs.text}
            subtitleColor={totalEventsVs.color}
          />
          <PulseCard
            label={t('argus.realtime.eventsPerSec', 'Events/sec')}
            value={Math.round(eps * 10) / 10}
            prevValue={0}
            color={ARGUS_SEMANTIC.info}
            icon={<SpeedIcon sx={{ fontSize: 14 }} />}
            sparkData={sparkHistory}
            formatValue={(v) => v.toFixed(1)}
          />
          {/* Error Rate Gauge */}
          <Box
            sx={{
              minWidth: 120,
              p: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              borderLeft: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            }}
          >
            <Typography sx={{ fontSize: 9, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.3 }}>
              {t('argus.realtime.errorRate', 'Error Rate')}
            </Typography>
            <PressureGauge
              value={errorRate}
              max={10}
            />
            <Typography sx={{
              fontSize: 10,
              fontWeight: 700,
              color: anomalies.error_rate === 'critical' ? ARGUS_SEMANTIC.negative
                : anomalies.error_rate === 'warning' ? ARGUS_SEMANTIC.warning
                : 'text.secondary',
              mt: 0.2,
            }}>
              {errorRate.toFixed(1)}% ({errorCount.toLocaleString()})
            </Typography>
          </Box>
        </Box>

        {/* ═══════ Anomaly Banner (only if issues detected) ═══════ */}
        {(anomalies.active_users !== 'normal' || anomalies.error_rate !== 'normal' || anomalies.event_volume !== 'normal') && (
          <Box
            sx={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 0.6,
              borderRadius: 1,
              bgcolor: anomalies.error_rate === 'critical'
                ? alpha(ARGUS_SEMANTIC.negative, 0.12)
                : alpha(ARGUS_SEMANTIC.warning, 0.1),
              border: `1px solid ${anomalies.error_rate === 'critical'
                ? alpha(ARGUS_SEMANTIC.negative, 0.3)
                : alpha(ARGUS_SEMANTIC.warning, 0.25)}`,
            }}
          >
            <Typography sx={{ fontSize: 13 }}>⚠</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {anomalies.error_rate !== 'normal' && (
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: anomalies.error_rate === 'critical' ? ARGUS_SEMANTIC.negative : ARGUS_SEMANTIC.warning }}>
                  {t('argus.realtime.anomaly.errorRate', 'Error rate {{rate}}%', { rate: errorRate.toFixed(1) })}
                </Typography>
              )}
              {anomalies.active_users === 'low' && (
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: ARGUS_SEMANTIC.negative }}>
                  {t('argus.realtime.anomaly.usersLow', 'Active users below yesterday')}
                </Typography>
              )}
              {anomalies.event_volume === 'low' && (
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: ARGUS_SEMANTIC.warning }}>
                  {t('argus.realtime.anomaly.volumeLow', 'Event volume below yesterday')}
                </Typography>
              )}
              {anomalies.active_users === 'high' && (
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: ARGUS_SEMANTIC.positive }}>
                  {t('argus.realtime.anomaly.usersHigh', 'Active users above yesterday ↑')}
                </Typography>
              )}
            </Box>
          </Box>
        )}
        {/* ═══════ Row 2: Chart + Platform + Top Events ═══════ */}
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', gap: 0.8 }}>
          {/* Events per Minute chart */}
          <Box sx={{ flex: 2, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.8 }}>
            <ArgusVolumeChart
              title={t('argus.realtime.eventsPerMin', 'Events per Minute')}
              labels={epmData.map((d) => formatWith(d.minute, 'HH:mm'))}
              datasets={[
                {
                  label: t('argus.realtime.eventsPerMin'),
                  data: epmValues,
                  color: primary,
                },
                ...(prevEpmValues.length > 0 ? [{
                  label: t('argus.realtime.yesterday', 'Yesterday'),
                  data: prevEpmValues,
                  color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
                }] : []),
              ]}
              loading={!data}
              storagePrefix="argus_realtime_epm"
              showCompactToggle={false}
              showChartTypeToggle={false}
              mb={0}
            />

            {/* Event Activity Heatmap */}
            <Panel title={t('argus.realtime.eventHeatmap', 'Event Activity')} sx={{ flex: 1, minHeight: 0 }} noPadding>
              {eventHeatmap.rows.length > 0 ? (
                <Box sx={{ overflow: 'auto', flex: 1, px: 1, py: 0.5 }}>
                  {/* Time labels header */}
                  <Box sx={{ display: 'flex', gap: 0, ml: '90px', mb: 0.3 }}>
                    {eventHeatmap.timeLabels.map((l) => (
                      <Typography key={l} sx={{ flex: 1, fontSize: 11, color: 'text.disabled', textAlign: 'center', fontFamily: 'monospace' }}>
                        {l}
                      </Typography>
                    ))}
                  </Box>
                  {eventHeatmap.rows.map((row) => (
                    <Box key={row.name} sx={{ display: 'flex', alignItems: 'center', gap: 0, mb: '2px' }}>
                      <Typography
                        sx={{
                          width: 90, fontSize: 11, fontFamily: 'monospace', fontWeight: 600,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0,
                          pr: 0.5,
                        }}
                      >
                        {row.name}
                      </Typography>
                      {row.cells.map((val, ci) => {
                        const intensity = val / eventHeatmap.maxVal;
                        return (
                          <Tooltip key={ci} title={`${row.name}: ${val}`} arrow placement="top">
                            <Box
                              sx={{
                                flex: 1,
                                height: 14,
                                borderRadius: 0.3,
                                mx: '1px',
                                bgcolor: val === 0
                                  ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)')
                                  : alpha(primary, 0.15 + intensity * 0.7),
                                transition: 'background-color 0.5s',
                              }}
                            />
                          </Tooltip>
                        );
                      })}
                    </Box>
                  ))}
                </Box>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 60 }}>
                  <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
                    {t('argus.realtime.noData', 'No data')}
                  </Typography>
                </Box>
              )}
            </Panel>
          </Box>

          {/* Right column: Platform + Top Events stacked */}
          <Box sx={{ width: '32%', minWidth: 200, display: 'flex', flexDirection: 'column', gap: 0.8 }}>
            {/* Platform Distribution */}
            <Panel title={t('argus.realtime.platformDist', 'Platform')} sx={{ flex: 1 }}>
              {platformDist.length > 0 ? (
                <>
                  {/* Stacked bar */}
                  <Box sx={{ display: 'flex', height: 14, borderRadius: 0.5, overflow: 'hidden', mb: 1 }}>
                    {platformDist.map((p) => (
                      <Tooltip key={p.name} title={`${p.name}: ${p.pct}%`}>
                        <Box sx={{ width: `${p.pct}%`, bgcolor: p.color, minWidth: 2, transition: 'width 0.5s' }} />
                      </Tooltip>
                    ))}
                  </Box>
                  {platformDist.map((p) => (
                    <Box key={p.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.2 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: p.color, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: 11, fontWeight: 500, flex: 1 }}>{p.name}</Typography>
                      <Typography sx={{ fontSize: 10, color: 'text.secondary', fontFamily: 'monospace' }}>{p.pct}%</Typography>
                      <Typography sx={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace', minWidth: 28, textAlign: 'right' }}>
                        {p.count}
                      </Typography>
                    </Box>
                  ))}
                </>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 60 }}>
                  <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
                    {t('argus.realtime.noData', 'No data')}
                  </Typography>
                </Box>
              )}
            </Panel>

            {/* Top Events */}
            <Panel title={t('argus.realtime.topEvents', 'Top Events')} sx={{ flex: 1 }}>
              {topEvents.length > 0 ? (
                topEvents.slice(0, 6).map((evt) => (
                  <BarRow key={evt.name} label={evt.name} value={evt.count} max={maxEvent} color={primary} />
                ))
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 60 }}>
                  <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
                    {t('argus.realtime.noData', 'No data')}
                  </Typography>
                </Box>
              )}
            </Panel>
          </Box>
        </Box>

        {/* ═══════ Row 3: Live Feed + Countries + OS ═══════ */}
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', gap: 0.8, overflow: 'hidden' }}>
          {/* Live Event Feed — console style */}
          <Panel
            sx={{ flex: 5 }}
            noPadding
            title={t('argus.realtime.recentEvents', 'Live Event Feed')}
            titleRight={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <LiveDot />
                <Typography sx={{ fontSize: 10, fontFamily: 'monospace', color: 'text.secondary' }}>
                  {eps.toFixed(1)} evt/s
                </Typography>
                <IconButton size="small" onClick={() => setPaused((p) => !p)} sx={{ p: 0.3 }}>
                  {paused ? <PlayIcon sx={{ fontSize: 14 }} /> : <PauseIcon sx={{ fontSize: 14 }} />}
                </IconButton>
              </Box>
            }
          >
            <Box sx={{ overflow: 'auto', height: '100%', px: 0.5 }}>
              {recentEvents.length > 0 ? (
                recentEvents.map((evt, i) => {
                  const evtColor = classifyEventColor(evt.event_name);
                  return (
                    <Box
                      key={`${evt.timestamp}-${i}`}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.8,
                        py: 0.4,
                        px: 1,
                        fontFamily: 'monospace',
                        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                        animation: i === 0 ? 'rtSlideIn 0.4s ease-out' : undefined,
                        bgcolor: i === 0 ? alpha(evtColor, 0.06) : 'transparent',
                        transition: 'background-color 0.5s',
                        '@keyframes rtSlideIn': {
                          from: { opacity: 0, transform: 'translateY(-8px)' },
                          to: { opacity: 1, transform: 'translateY(0)' },
                        },
                      }}
                    >
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: evtColor, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: 11, fontWeight: 600, width: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {evt.event_name}
                      </Typography>
                      {evt.user_id && (
                        <Typography sx={{ fontSize: 10, color: 'text.disabled', width: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {evt.user_id}
                        </Typography>
                      )}
                      {evt.platform && (
                        <Chip
                          label={evt.platform}
                          size="small"
                          sx={{
                            height: 16,
                            fontSize: 9,
                            fontWeight: 600,
                            bgcolor: alpha(PLATFORM_COLORS[evt.platform] || '#888', 0.15),
                            color: PLATFORM_COLORS[evt.platform] || '#888',
                            '& .MuiChip-label': { px: 0.5 },
                          }}
                        />
                      )}
                      {evt.country && (
                        <Typography sx={{ fontSize: 10, color: 'text.secondary', minWidth: 20 }}>
                          {evt.country}
                        </Typography>
                      )}
                      <Typography sx={{ fontSize: 10, color: 'text.disabled', ml: 'auto', flexShrink: 0 }}>
                        {formatWith(evt.timestamp, 'HH:mm:ss')}
                      </Typography>
                    </Box>
                  );
                })
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1 }}>
                  <DotIcon
                    sx={{
                      fontSize: 24,
                      color: 'text.disabled',
                      animation: 'rtPulse 2s ease-in-out infinite',
                    }}
                  />
                  <Typography sx={{ fontSize: 12, color: 'text.disabled', fontFamily: 'monospace' }}>
                    {t('argus.realtime.waitingForEvents', 'Listening for events...')}
                  </Typography>
                </Box>
              )}
            </Box>
          </Panel>

          {/* World Map Heatmap */}
          <Panel title={t('argus.realtime.worldMap', 'Live Regional Activity')} sx={{ flex: 3 }} noPadding>
            <Box sx={{ position: 'relative', width: '100%', height: '100%', minHeight: 120 }}>
              <ComposableMap
                projection="geoMercator"
                projectionConfig={{ scale: 100, center: [10, 20] }}
                style={{ width: '100%', height: '100%' }}
              >
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map((geo) => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}
                        stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}
                        strokeWidth={0.3}
                        style={{ default: { outline: 'none' }, hover: { outline: 'none' }, pressed: { outline: 'none' } }}
                      />
                    ))
                  }
                </Geographies>
                {countries.map((c) => {
                  const coords = COUNTRY_COORDS[c.country];
                  if (!coords) return null;
                  const r = Math.max(3, Math.min(14, (c.count / maxCountry) * 14));
                  return (
                    <Marker key={c.country} coordinates={coords}>
                      <circle
                        r={r}
                        fill={alpha(ARGUS_SEMANTIC.info, 0.5)}
                        stroke={ARGUS_SEMANTIC.info}
                        strokeWidth={1}
                        style={{ transition: 'r 0.5s' }}
                      />
                      <text
                        textAnchor="middle"
                        y={-r - 3}
                        style={{ fontSize: 8, fontWeight: 700, fill: isDark ? '#fff' : '#333' }}
                      >
                        {c.country}
                      </text>
                    </Marker>
                  );
                })}
              </ComposableMap>
              {countries.length === 0 && (
                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
                    {t('argus.realtime.noData', 'No data')}
                  </Typography>
                </Box>
              )}
            </Box>
          </Panel>

          {/* Active Users */}
          <Panel title={t('argus.realtime.activeUsersList', 'Active Users')} sx={{ flex: 2 }}>
            {activeUsersList.length > 0 ? (
              <Box sx={{ overflow: 'auto', flex: 1 }}>
                {activeUsersList.map((u) => (
                  <Box
                    key={u.user_id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      py: 0.3,
                      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                    }}
                  >
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: ARGUS_SEMANTIC.positive,
                        flexShrink: 0,
                        animation: 'rtPulse 2s ease-in-out infinite',
                      }}
                    />
                    <Typography
                      sx={{
                        fontSize: 10,
                        fontWeight: 600,
                        fontFamily: 'monospace',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {u.user_id}
                    </Typography>
                    <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>
                      {u.event_name}
                    </Typography>
                    {u.country && (
                      <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>
                        {u.country}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 60 }}>
                <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
                  {t('argus.realtime.noData', 'No data')}
                </Typography>
              </Box>
            )}
          </Panel>
        </Box>
      </Box>
    </Box>
  );
};

export default ArgusRealtimePage;
