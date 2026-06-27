import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  useTheme,
  alpha,
  LinearProgress,
  Chip,
  Tooltip,
} from '@mui/material';
import ArgusVolumeChart from '@/components/argus/ArgusVolumeChart';
import { formatWith } from '@/utils/dateFormat';
import {
  BugReport as ErrorIcon,
  Speed as PerfIcon,
  Notes as LogIcon,
  Timer as TimerIcon,
  FiberManualRecord as DotIcon,
  Feedback as FeedbackIcon,
  SentimentSatisfied as PositiveIcon,
  SentimentDissatisfied as NegativeIcon,
  SentimentNeutral as NeutralIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import {
  getTrackingRealtimeData,
  type TrackingRealtimeData,
} from '@/services/argus/argusAnalytics';
import { ARGUS_SEMANTIC } from './argusThemeTokens';

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL = 5000;
const SPARKLINE_POINTS = 30;

// ─── Sparkline ────────────────────────────────────────────────────────────────

const Sparkline: React.FC<{ data: number[]; color: string; width?: number; height?: number }> = ({ data, color, width = 140, height = 16 }) => {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - (v / max) * height}`).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round" opacity={0.6} />
    </svg>
  );
};

// ─── PulseCard ────────────────────────────────────────────────────────────────

interface PulseCardProps {
  label: string;
  value: number | string;
  color: string;
  icon: React.ReactNode;
  sparkData?: number[];
  subtitle?: string;
  subtitleColor?: string;
  formatValue?: (v: number) => string;
  anomaly?: 'normal' | 'high' | 'low';
}

const PulseCard: React.FC<PulseCardProps> = React.memo(({ label, value, color, icon, sparkData, subtitle, subtitleColor, formatValue, anomaly }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isAnomalyHigh = anomaly === 'high';
  return (
    <Box
      sx={{
        flex: 1, minWidth: 140, p: 1.5,
        borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        display: 'flex', flexDirection: 'column', gap: 0.3,
        ...(isAnomalyHigh ? {
          bgcolor: alpha(ARGUS_SEMANTIC.negative, 0.06),
          borderBottom: `2px solid ${ARGUS_SEMANTIC.negative}`,
          animation: 'anomalyPulse 2s ease-in-out infinite',
          '@keyframes anomalyPulse': {
            '0%, 100%': { bgcolor: alpha(ARGUS_SEMANTIC.negative, 0.06) },
            '50%': { bgcolor: alpha(ARGUS_SEMANTIC.negative, 0.12) },
          },
        } : {}),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Box sx={{ color: alpha(color, 0.7), display: 'flex' }}>{icon}</Box>
        <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
        {typeof value === 'number' && formatValue ? formatValue(value) : typeof value === 'number' ? value.toLocaleString() : value}
      </Typography>
      {subtitle && (
        <Typography sx={{ fontSize: 11, fontWeight: 600, color: subtitleColor || 'text.disabled', mt: 0.2 }}>
          {subtitle}
        </Typography>
      )}
      {sparkData && sparkData.length > 1 && <Sparkline data={sparkData} color={color} width={140} height={16} />}
    </Box>
  );
});
PulseCard.displayName = 'PulseCard';

// ─── Panel wrapper ────────────────────────────────────────────────────────────

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
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        ...sx,
      }}
    >
      {title && (
        <Box sx={{ px: 1.2, py: 0.6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, color: 'text.secondary' }}>
            {title}
          </Typography>
          {titleRight}
        </Box>
      )}
      <Box sx={{ flex: 1, overflow: 'auto', ...(noPadding ? {} : { p: 1 }) }}>
        {children}
      </Box>
    </Box>
  );
};

// ─── BarRow ───────────────────────────────────────────────────────────────────

const BarRow: React.FC<{ label: string; value: number; max: number; color: string; suffix?: string; onClick?: () => void }> = ({ label, value, max, color, suffix, onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      display: 'flex', alignItems: 'center', gap: 0.8, py: 0.3,
      ...(onClick ? { cursor: 'pointer', borderRadius: 0.5, '&:hover': { bgcolor: 'action.hover' } } : {}),
    }}
  >
    <Typography sx={{ fontSize: 12, fontWeight: 600, width: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {label}
    </Typography>
    <Box sx={{ flex: 1 }}>
      <LinearProgress
        variant="determinate"
        value={max > 0 ? (value / max) * 100 : 0}
        sx={{
          height: 10, borderRadius: 0.5,
          bgcolor: alpha(color, 0.08),
          '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 0.5 },
        }}
      />
    </Box>
    <Typography sx={{ fontSize: 12, fontWeight: 700, minWidth: 50, textAlign: 'right', fontFamily: 'monospace' }}>
      {value.toLocaleString()}{suffix || ''}
    </Typography>
  </Box>
);

// ─── LiveDot ──────────────────────────────────────────────────────────────────

const LiveDot: React.FC = () => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
    <DotIcon
      sx={{
        fontSize: 10, color: ARGUS_SEMANTIC.positive,
        animation: 'pulse 2s ease-in-out infinite',
        '@keyframes pulse': {
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

// ─── Log Level Colors ─────────────────────────────────────────────────────────

const LOG_LEVEL_COLORS: Record<string, string> = {
  error: '#ef4444',
  fatal: '#dc2626',
  warning: '#f59e0b',
  warn: '#f59e0b',
  info: '#3b82f6',
  debug: '#8b5cf6',
  trace: '#6b7280',
};

const RELEASE_COLORS = [
  '#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1',
];

const SENTIMENT_ICONS: Record<string, React.ReactNode> = {
  positive: <Tooltip title="Positive" arrow><PositiveIcon sx={{ fontSize: 14, color: '#10b981' }} /></Tooltip>,
  negative: <Tooltip title="Negative" arrow><NegativeIcon sx={{ fontSize: 14, color: '#ef4444' }} /></Tooltip>,
  neutral: <Tooltip title="Neutral" arrow><NeutralIcon sx={{ fontSize: 14, color: '#6b7280' }} /></Tooltip>,
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const ArgusTrackingRealtimePage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation();
  const { currentProject } = useOrgProject();
  const projectId = String(currentProject?.id || '1');

  const [data, setData] = useState<TrackingRealtimeData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [sparkHistory, setSparkHistory] = useState<number[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const result = await getTrackingRealtimeData(projectId);
      setData(result);
      setLastUpdate(new Date());
      setSparkHistory((prev) => [...prev.slice(-SPARKLINE_POINTS + 1), result.error_count]);
    } catch {
      // Keep previous data
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, POLL_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchData]);

  // ─── Derived ────────────────────────────────────────────────────────────────

  const primary = theme.palette.primary.main;

  const epmData = data?.errors_per_minute || [];
  const epmValues = epmData.map((d) => d.count);
  const prevEpmValues = (data?.prev_errors_per_minute || []).map((d) => d.count);

  const perfTs = data?.perf_timeseries || [];
  const p50Values = perfTs.map((d) => d.p50);
  const p95Values = perfTs.map((d) => d.p95);
  const throughputValues = perfTs.map((d) => d.cnt);

  const errorTypes = data?.error_types || [];
  const maxErrorType = Math.max(...errorTypes.map((e) => e.count), 1);

  const logLevels = data?.log_levels || [];
  const totalLogs = logLevels.reduce((s, l) => s + l.count, 0) || 1;

  const slowTxns = data?.slow_transactions || [];
  const maxSlowP95 = Math.max(...slowTxns.map((t) => t.p95), 1);

  const anomalies = data?.anomalies || { errors: 'normal' as const, p95: 'normal' as const };

  // vs yesterday labels
  const vsLabel = (current: number, prev: number): { text: string; color: string } => {
    if (prev === 0) return { text: '', color: 'text.disabled' };
    const pct = Math.round(((current - prev) / prev) * 100);
    const arrow = pct > 0 ? '↑' : pct < 0 ? '↓' : '→';
    // For errors/p95: higher = bad
    const color = Math.abs(pct) < 10 ? 'text.disabled' : pct > 0 ? ARGUS_SEMANTIC.negative : ARGUS_SEMANTIC.positive;
    return { text: `vs ${t('argus.tracking.realtime.yesterday', 'yesterday')} ${pct > 0 ? '+' : ''}${pct}% ${arrow}`, color };
  };

  const errorsVs = vsLabel(data?.error_count || 0, data?.prev_error_count || 0);
  const p50Vs = vsLabel(data?.p50 || 0, data?.prev_p50 || 0);
  const p95Vs = vsLabel(data?.p95 || 0, data?.prev_p95 || 0);
  const logsVs = vsLabel(data?.log_count || 0, data?.prev_log_count || 0);

  // ─── Release-based EPM ────────────────────────────────────────────────────
  const releaseEpmData = useMemo(() => {
    const raw = data?.errors_by_release || [];
    if (raw.length === 0) return { releases: [] as string[], labels: [] as string[], datasets: [] as { label: string; data: number[]; color: string }[] };

    const releaseSet = new Set<string>();
    const minuteSet = new Set<string>();
    raw.forEach((r) => { releaseSet.add(r.release); minuteSet.add(r.minute); });

    const releases = Array.from(releaseSet).sort();
    const minutes = Array.from(minuteSet).sort();
    const labels = minutes.map((m) => formatWith(m, 'HH:mm'));

    const lookup = new Map<string, number>();
    raw.forEach((r) => lookup.set(`${r.release}|${r.minute}`, r.count));

    const datasets = releases.map((rel, i) => ({
      label: rel,
      data: minutes.map((m) => lookup.get(`${rel}|${m}`) || 0),
      color: RELEASE_COLORS[i % RELEASE_COLORS.length],
    }));

    return { releases, labels, datasets };
  }, [data?.errors_by_release]);



  // ─── Feedback ─────────────────────────────────────────────────────────────
  const fbSummary = data?.feedback_summary || { total: 0, negative: 0, positive: 0, neutral: 0, bugs: 0 };
  const recentFb = data?.recent_feedback || [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)', overflow: 'auto' }}>
      <PageHeader
        title={
          <ArgusBreadcrumbs
            paths={[
              { label: t('argus.tracking.title', 'Tracking'), to: '/argus/overview' },
              { label: t('argus.tracking.realtime', 'Real-time') },
            ]}
            size="title"
          />
        }
        subtitle={t('argus.tracking.realtime.subtitle', 'System health — last 30 minutes')}
        actions={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LiveDot />
            {lastUpdate && (
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11 }}>
                {formatWith(lastUpdate, 'HH:mm:ss')}
              </Typography>
            )}
          </Box>
        }
      />

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 0.8, pb: 1 }}>
        {/* ═══════ Row 1: KPI Strip ═══════ */}
        <Box
          sx={{
            display: 'flex', flexShrink: 0, flexWrap: 'wrap',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
            borderRadius: 1.5, overflow: 'hidden',
            bgcolor: isDark ? 'rgba(255,255,255,0.015)' : '#fff',
          }}
        >
          <PulseCard
            label={t('argus.tracking.realtime.errors', 'Errors')}
            value={data?.error_count || 0}
            color={ARGUS_SEMANTIC.negative}
            icon={<ErrorIcon sx={{ fontSize: 14 }} />}
            sparkData={sparkHistory}
            subtitle={errorsVs.text}
            subtitleColor={errorsVs.color}
            anomaly={anomalies.errors}
          />
          <PulseCard
            label={t('argus.tracking.realtime.p50', 'P50')}
            value={`${data?.p50 || 0}ms`}
            color={ARGUS_SEMANTIC.info}
            icon={<TimerIcon sx={{ fontSize: 14 }} />}
            sparkData={p50Values}
            subtitle={p50Vs.text}
            subtitleColor={p50Vs.color}
          />
          <PulseCard
            label={t('argus.tracking.realtime.p95', 'P95')}
            value={`${data?.p95 || 0}ms`}
            color={ARGUS_SEMANTIC.warning}
            icon={<PerfIcon sx={{ fontSize: 14 }} />}
            sparkData={p95Values}
            subtitle={p95Vs.text}
            subtitleColor={p95Vs.color}
            anomaly={anomalies.p95}
          />
          <PulseCard
            label={t('argus.tracking.realtime.logs', 'Logs')}
            value={data?.log_count || 0}
            color={primary}
            icon={<LogIcon sx={{ fontSize: 14 }} />}
            subtitle={logsVs.text}
            subtitleColor={logsVs.color}
          />
          <PulseCard
            label={t('argus.tracking.realtime.transactions', 'Transactions')}
            value={data?.txn_count || 0}
            color={ARGUS_SEMANTIC.positive}
            icon={<PerfIcon sx={{ fontSize: 14 }} />}
          />
          <PulseCard
            label={t('argus.tracking.realtime.errorRate', 'Error Rate')}
            value={data && data.txn_count > 0 ? `${((data.error_count / data.txn_count) * 100).toFixed(1)}%` : '0%'}
            color={ARGUS_SEMANTIC.negative}
            icon={<ErrorIcon sx={{ fontSize: 14 }} />}
          />
        </Box>

        {/* ═══════ Anomaly Banner ═══════ */}
        {(anomalies.errors !== 'normal' || anomalies.p95 !== 'normal') && (
          <Box
            sx={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1,
              px: 1.5, py: 0.6, borderRadius: 1,
              bgcolor: alpha(ARGUS_SEMANTIC.negative, 0.12),
              border: `1px solid ${alpha(ARGUS_SEMANTIC.negative, 0.3)}`,
            }}
          >
            <Typography sx={{ fontSize: 13 }}>⚠</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {anomalies.errors === 'high' && (
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: ARGUS_SEMANTIC.negative }}>
                  {t('argus.tracking.realtime.anomaly.errorsHigh', 'Error count above yesterday')}
                </Typography>
              )}
              {anomalies.p95 === 'high' && (
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: ARGUS_SEMANTIC.warning }}>
                  {t('argus.tracking.realtime.anomaly.p95High', 'P95 latency above yesterday')}
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {/* ═══════ Row 2: Charts + Error Types + Log Levels ═══════ */}
        <Box sx={{ flexShrink: 0, display: 'flex', gap: 0.8, flexDirection: { xs: 'column', lg: 'row' } }}>
          {/* Left column: Charts stacked */}
          <Box sx={{ flex: 2, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.8 }}>
            <ArgusVolumeChart
              title={t('argus.tracking.realtime.errorsPerMinByRelease', 'Errors per Minute (by Release)')}
              labels={releaseEpmData.labels.length > 0 ? releaseEpmData.labels : epmData.map((d) => formatWith(d.minute, 'HH:mm'))}
              datasets={[
                ...(releaseEpmData.datasets.length > 0 ? releaseEpmData.datasets : [
                  { label: t('argus.tracking.realtime.errorsPerMin'), data: epmValues, color: ARGUS_SEMANTIC.negative },
                ]),
                ...(prevEpmValues.length > 0 ? [{
                  label: t('argus.tracking.realtime.yesterday', 'Yesterday'),
                  data: prevEpmValues,
                  color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
                }] : []),
              ]}
              loading={!data}
              storagePrefix="argus_tracking_epm"
              showCompactToggle={false}
              showChartTypeToggle={false}
              showLegend
              mb={0}
            />
            <ArgusVolumeChart
              title={t('argus.tracking.realtime.latency', 'Response Time (ms)')}
              labels={perfTs.map((d) => formatWith(d.minute, 'HH:mm'))}
              datasets={[
                { label: 'P50', data: p50Values, color: ARGUS_SEMANTIC.info },
                { label: 'P95', data: p95Values, color: ARGUS_SEMANTIC.warning },
              ]}
              loading={!data}
              storagePrefix="argus_tracking_perf"
              showCompactToggle={false}
              showChartTypeToggle={false}
              showLegend
              mb={0}
            />
            <ArgusVolumeChart
              title={t('argus.tracking.realtime.throughput', 'Throughput (req/min)')}
              labels={perfTs.map((d) => formatWith(d.minute, 'HH:mm'))}
              datasets={[
                { label: t('argus.tracking.realtime.requestsPerMin', 'Requests'), data: throughputValues, color: ARGUS_SEMANTIC.positive },
              ]}
              loading={!data}
              storagePrefix="argus_tracking_tps"
              showCompactToggle={false}
              showChartTypeToggle={false}
              mb={0}
            />
          </Box>

          {/* Right column: Error Types + Log Levels */}
          <Box sx={{ width: { xs: '100%', lg: '32%' }, minWidth: 200, display: 'flex', flexDirection: { xs: 'row', md: 'column' }, gap: 0.8 }}>
            <Panel title={t('argus.tracking.realtime.errorTypes', 'Error Types')} sx={{ flex: 1 }}>
              {errorTypes.length > 0 ? errorTypes.map((et) => (
                <BarRow key={et.type} label={et.type} value={et.count} max={maxErrorType} color={ARGUS_SEMANTIC.negative}
                  onClick={() => navigate(`/argus/issues?query=type:${encodeURIComponent(et.type)}`)}
                />
              )) : (
                <Typography sx={{ fontSize: 12, color: 'text.disabled', textAlign: 'center', py: 2 }}>
                  {t('argus.tracking.realtime.noData', 'No data')}
                </Typography>
              )}
            </Panel>
            <Panel title={t('argus.tracking.realtime.logLevels', 'Log Levels')} sx={{ flex: 1 }}>
              {logLevels.length > 0 ? (
                <>
                  {logLevels.map((ll) => (
                    <Box key={ll.level} onClick={() => navigate(`/argus/explore/logs?level=${ll.level}`)} sx={{ display: 'flex', alignItems: 'center', gap: 0.8, py: 0.3, cursor: 'pointer', borderRadius: 0.5, '&:hover': { bgcolor: 'action.hover' } }}>
                      <Chip
                        label={ll.level.toUpperCase()}
                        size="small"
                        sx={{
                          height: 20, fontSize: 11, fontWeight: 700,
                          minWidth: 60, justifyContent: 'center',
                          bgcolor: alpha(LOG_LEVEL_COLORS[ll.level.toLowerCase()] || '#6b7280', 0.15),
                          color: LOG_LEVEL_COLORS[ll.level.toLowerCase()] || '#6b7280',
                          '& .MuiChip-label': { px: 0.5 },
                        }}
                      />
                      <Box sx={{ flex: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={(ll.count / totalLogs) * 100}
                          sx={{
                            height: 6, borderRadius: 0.5,
                            bgcolor: alpha(LOG_LEVEL_COLORS[ll.level.toLowerCase()] || '#6b7280', 0.08),
                            '& .MuiLinearProgress-bar': { bgcolor: LOG_LEVEL_COLORS[ll.level.toLowerCase()] || '#6b7280', borderRadius: 0.5 },
                          }}
                        />
                      </Box>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', minWidth: 40, textAlign: 'right' }}>
                        {ll.count.toLocaleString()}
                      </Typography>
                    </Box>
                  ))}
                </>
              ) : (
                <Typography sx={{ fontSize: 11, color: 'text.disabled', textAlign: 'center', py: 2 }}>
                  {t('argus.tracking.realtime.noData', 'No data')}
                </Typography>
              )}
            </Panel>
          </Box>
        </Box>

        {/* ═══════ Row 3: Recent Errors + Slow Transactions ═══════ */}
        <Box sx={{ flexShrink: 0, display: 'flex', gap: 0.8, flexDirection: { xs: 'column', md: 'row' }, minHeight: 280 }}>
          <Panel title={t('argus.tracking.realtime.recentErrors', 'Recent Errors')} sx={{ flex: 1 }} noPadding>
            <Box sx={{ overflow: 'auto', flex: 1 }}>
              {(data?.recent_errors || []).length > 0 ? (data?.recent_errors || []).map((err, i) => (
                <Box key={i} onClick={() => navigate(`/argus/issues?query=type:${encodeURIComponent(err.type)}`)} sx={{
                  px: 1, py: 0.5, cursor: 'pointer',
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                  '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: ARGUS_SEMANTIC.negative, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {err.type}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.disabled', fontFamily: 'monospace', flexShrink: 0 }}>
                      {formatWith(err.timestamp, 'HH:mm:ss')}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {err.value}
                  </Typography>
                  {(err.release || err.environment) && (
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 0.2 }}>
                      {err.release && <Chip label={err.release} size="small" sx={{ height: 16, fontSize: 10 }} />}
                      {err.environment && <Chip label={err.environment} size="small" sx={{ height: 16, fontSize: 10 }} />}
                    </Box>
                  )}
                </Box>
              )) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 60 }}>
                  <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
                    {t('argus.tracking.realtime.noErrors', 'No recent errors')}
                  </Typography>
                </Box>
              )}
            </Box>
          </Panel>

          <Panel title={t('argus.tracking.realtime.slowTxns', 'Slow Transactions')} sx={{ flex: 1 }}>
            {slowTxns.length > 0 ? slowTxns.map((txn) => (
              <BarRow
                key={txn.transaction}
                label={txn.transaction}
                value={txn.p95}
                max={maxSlowP95}
                onClick={() => navigate(`/argus/performance?transaction=${encodeURIComponent(txn.transaction)}`)}
                color={ARGUS_SEMANTIC.warning}
                suffix="ms"
              />
            )) : (
              <Typography sx={{ fontSize: 11, color: 'text.disabled', textAlign: 'center', py: 2 }}>
                {t('argus.tracking.realtime.noData', 'No data')}
              </Typography>
            )}
          </Panel>

          <Panel title={t('argus.tracking.realtime.feedback', 'Feedback')} titleRight={
            fbSummary.total > 0 ? <Chip label={`${fbSummary.total}`} size="small" sx={{ height: 16, fontSize: 9, fontWeight: 700 }} /> : undefined
          } sx={{ flex: 1 }} noPadding>
            {fbSummary.total > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                {/* Summary strip */}
                <Box sx={{ display: 'flex', gap: 1.5, px: 1, py: 0.6, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                    <PositiveIcon sx={{ fontSize: 12, color: '#10b981' }} />
                    <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{fbSummary.positive}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                    <NegativeIcon sx={{ fontSize: 12, color: '#ef4444' }} />
                    <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{fbSummary.negative}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                    <NeutralIcon sx={{ fontSize: 12, color: '#6b7280' }} />
                    <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{fbSummary.neutral}</Typography>
                  </Box>
                  {fbSummary.bugs > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                      <ErrorIcon sx={{ fontSize: 12, color: ARGUS_SEMANTIC.negative }} />
                      <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{fbSummary.bugs}</Typography>
                    </Box>
                  )}
                </Box>
                {/* Recent feedback list */}
                <Box sx={{ overflow: 'auto', flex: 1 }}>
                  {recentFb.map((fb, i) => (
                    <Box key={i} onClick={() => navigate('/argus/feedback')} sx={{
                      px: 1, py: 0.5, cursor: 'pointer',
                      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                      '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {SENTIMENT_ICONS[fb.sentiment] || SENTIMENT_ICONS.neutral}
                        <Typography sx={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {fb.message}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: 'text.disabled', fontFamily: 'monospace', flexShrink: 0 }}>
                          {formatWith(fb.timestamp, 'HH:mm')}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.2, pl: 2.5 }}>
                        {fb.release && <Chip label={fb.release} size="small" sx={{ height: 16, fontSize: 10 }} />}
                        {fb.category && <Chip label={fb.category} size="small" sx={{ height: 16, fontSize: 10 }} />}
                      </Box>
                    </Box>
                  ))}
                </Box>
                <Box sx={{ px: 1, py: 0.5, textAlign: 'center' }}>
                  <Typography
                    onClick={() => navigate('/argus/feedback')}
                    sx={{ fontSize: 11, color: 'primary.main', cursor: 'pointer', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}
                  >
                    {t('argus.tracking.realtime.viewAll', 'View all →')}
                  </Typography>
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 60 }}>
                <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
                  {t('argus.tracking.realtime.noData', 'No data')}
                </Typography>
              </Box>
            )}
          </Panel>
        </Box>
      </Box>
    </Box>
  );
};

export default ArgusTrackingRealtimePage;
