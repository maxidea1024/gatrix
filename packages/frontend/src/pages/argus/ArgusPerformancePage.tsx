import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  TableSortLabel,
  alpha,
  Tooltip,
  Skeleton,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Speed as SpeedIcon,
  ArrowBack as ArrowBackIcon,
  Schedule as ScheduleIcon,
  Storage as StorageIcon,
  Http as HttpIcon,
  Functions as FuncIcon,
  Cached as CacheIcon,
  Send as SendIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
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
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import PageContentLoader from '@/components/common/PageContentLoader';
import argusService, {
  ArgusTransaction,
  ArgusTransactionDetail,
  ArgusTraceDetail,
  ArgusTraceSpan,
} from '@/services/argusService';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Title, ChartTooltip, Legend, Filler
);

const TIME_RANGES = [
  { value: '1h', label: '1H' },
  { value: '6h', label: '6H' },
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
];

// Span operation colors
const OP_COLORS: Record<string, string> = {
  'db.query': '#26a69a',
  'db': '#26a69a',
  'http.client': '#7c4dff',
  'http': '#7c4dff',
  'cache.get': '#42a5f5',
  'cache.set': '#42a5f5',
  'cache': '#42a5f5',
  'function': '#ffa726',
  'crypto': '#ef5350',
  'message.publish': '#66bb6a',
  'message': '#66bb6a',
};
const getOpColor = (op: string) => OP_COLORS[op] || OP_COLORS[op.split('.')[0]] || '#9e9e9e';

const OP_ICONS: Record<string, React.ReactElement> = {
  db: <StorageIcon sx={{ fontSize: 13 }} />,
  http: <HttpIcon sx={{ fontSize: 13 }} />,
  function: <FuncIcon sx={{ fontSize: 13 }} />,
  cache: <CacheIcon sx={{ fontSize: 13 }} />,
  message: <SendIcon sx={{ fontSize: 13 }} />,
  crypto: <LockIcon sx={{ fontSize: 13 }} />,
};
const getOpIcon = (op: string) => OP_ICONS[op.split('.')[0]] || <FuncIcon sx={{ fontSize: 13 }} />;

type ViewMode = 'list' | 'detail' | 'trace';

const ArgusPerformancePage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const projectId = '1';

  const [transactions, setTransactions] = useState<ArgusTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(() => localStorage.getItem('argus-perf-period') || '24h');
  const [sort, setSort] = useState<string>('count');

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedTxn, setSelectedTxn] = useState<string | null>(null);
  const [detail, setDetail] = useState<ArgusTransactionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Trace waterfall state
  const [traceData, setTraceData] = useState<ArgusTraceDetail | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await argusService.getTransactions(projectId, { period, sort, limit: 30 });
      setTransactions(data);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, period, sort]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const fetchDetail = useCallback(async (txnName: string) => {
    setDetailLoading(true);
    try {
      const data = await argusService.getTransactionDetail(projectId, txnName, period);
      setDetail(data);
    } catch (error) {
      console.error('Failed to fetch detail:', error);
    } finally {
      setDetailLoading(false);
    }
  }, [projectId, period]);

  const fetchTrace = useCallback(async (traceId: string) => {
    setTraceLoading(true);
    try {
      const data = await argusService.getTraceDetail(projectId, traceId);
      setTraceData(data);
      setViewMode('trace');
    } catch (error) {
      console.error('Failed to fetch trace:', error);
    } finally {
      setTraceLoading(false);
    }
  }, [projectId]);

  const handleTxnClick = (txnName: string) => {
    setSelectedTxn(txnName);
    setViewMode('detail');
    fetchDetail(txnName);
  };

  const handleBack = () => {
    if (viewMode === 'trace') {
      setViewMode('detail');
      setTraceData(null);
    } else {
      setViewMode('list');
      setSelectedTxn(null);
      setDetail(null);
    }
  };

  const handlePeriodChange = (_: React.MouseEvent<HTMLElement>, value: string | null) => {
    if (!value) return;
    setPeriod(value);
    localStorage.setItem('argus-perf-period', value);
    if (selectedTxn && viewMode === 'detail') fetchDetail(selectedTxn);
  };

  // --- Chart Data ---
  const trendChartData = useMemo(() => {
    if (!detail?.trend) return { labels: [], datasets: [] };
    return {
      labels: detail.trend.map((d) => formatHour(d.hour)),
      datasets: [
        {
          label: 'P95',
          data: detail.trend.map((d) => Number(d.p95)),
          borderColor: '#ff9800',
          backgroundColor: alpha('#ff9800', 0.1),
          borderWidth: 2, tension: 0.4, fill: true, pointRadius: 0, pointHoverRadius: 4,
          yAxisID: 'y',
        },
        {
          label: t('argus.performance.throughput'),
          data: detail.trend.map((d) => d.count),
          borderColor: theme.palette.primary.main,
          backgroundColor: 'transparent',
          borderWidth: 1.5, tension: 0.4, fill: false, pointRadius: 0, pointHoverRadius: 3,
          yAxisID: 'y1',
        },
      ],
    };
  }, [detail, theme, t]);

  const histogramData = useMemo(() => {
    if (!detail?.histogram) return { labels: [], datasets: [] };
    return {
      labels: detail.histogram.map((d) => d.bucket),
      datasets: [{
        label: t('argus.performance.count'),
        data: detail.histogram.map((d) => d.count),
        backgroundColor: alpha(theme.palette.info.main, 0.6),
        borderColor: theme.palette.info.main,
        borderWidth: 0, borderRadius: 4,
      }],
    };
  }, [detail, theme, t]);

  const chartOpts = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: { legend: { display: true, position: 'top' as const, labels: { boxWidth: 8, font: { size: 11 } } } },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10, font: { size: 10 } } },
      y: { beginAtZero: true, grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }, border: { display: false }, ticks: { font: { size: 10 } }, title: { display: true, text: 'ms', font: { size: 10 } } },
      y1: { position: 'right' as const, beginAtZero: true, grid: { display: false }, border: { display: false }, ticks: { font: { size: 10 } }, title: { display: true, text: 'req', font: { size: 10 } } },
    },
    interaction: { mode: 'nearest' as const, axis: 'x' as const, intersect: false },
  }), [isDark]);

  const barOpts = useMemo(() => ({
    responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 10 } } },
      y: { beginAtZero: true, grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }, border: { display: false }, ticks: { font: { size: 10 } } },
    },
  }), [isDark]);

  const headerTitle = viewMode === 'trace' ? `Trace ${traceData?.trace_id?.slice(0, 8)}...`
    : viewMode === 'detail' ? selectedTxn
    : t('argus.performance.title');

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {viewMode !== 'list' && (
            <IconButton onClick={handleBack} size="small"><ArrowBackIcon /></IconButton>
          )}
          <SpeedIcon sx={{ fontSize: 26, color: theme.palette.primary.main }} />
          <Typography variant="h5" fontWeight={700} noWrap sx={{ maxWidth: 500 }}>
            {headerTitle}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ToggleButtonGroup value={period} exclusive onChange={handlePeriodChange} size="small">
            {TIME_RANGES.map((r) => (
              <ToggleButton key={r.value} value={r.value}
                sx={{ px: 1.2, py: 0.3, textTransform: 'none', fontSize: '0.75rem', minWidth: 36,
                  '&.Mui-selected': { backgroundColor: alpha(theme.palette.primary.main, 0.15), color: theme.palette.primary.main, fontWeight: 600 },
                }}
              >{r.label}</ToggleButton>
            ))}
          </ToggleButtonGroup>
          <IconButton onClick={viewMode === 'list' ? fetchTransactions : () => selectedTxn && fetchDetail(selectedTxn)} size="small">
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {/* === TRACE WATERFALL VIEW === */}
      {viewMode === 'trace' && (
        <PageContentLoader loading={traceLoading}>
          {traceData && <TraceWaterfall trace={traceData} isDark={isDark} />}
        </PageContentLoader>
      )}

      {/* === DETAIL VIEW === */}
      {viewMode === 'detail' && (
        <PageContentLoader loading={detailLoading}>
          {/* Charts */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 2 }}>
            <Paper elevation={0} sx={{ p: 2, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, borderRadius: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
                {t('argus.performance.latencyTrend')}
              </Typography>
              <Box sx={{ height: 220 }}>
                <Line data={trendChartData} options={chartOpts} />
              </Box>
            </Paper>
            <Paper elevation={0} sx={{ p: 2, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, borderRadius: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
                {t('argus.performance.durationDistribution')}
              </Typography>
              <Box sx={{ height: 220 }}>
                <Bar data={histogramData} options={barOpts} />
              </Box>
            </Paper>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            {/* Slowest Spans */}
            <Paper elevation={0} sx={{ p: 2, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, borderRadius: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
                {t('argus.performance.slowestSpans')}
              </Typography>
              {detail?.spans?.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                  {t('argus.performance.noSpans')}
                </Typography>
              ) : (
                <Box sx={{ maxHeight: 280, overflow: 'auto' }}>
                  {detail?.spans?.slice(0, 10).map((span, idx) => {
                    const opColor = getOpColor(span.op);
                    const maxDur = Math.max(...(detail?.spans?.map(s => Number(s.avg_duration)) || [1]));
                    const pct = (Number(span.avg_duration) / maxDur) * 100;
                    return (
                      <Box key={idx} sx={{ mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.3 }}>
                          <Box sx={{ color: opColor, display: 'flex' }}>{getOpIcon(span.op)}</Box>
                          <Typography variant="caption" noWrap sx={{ flex: 1, fontFamily: 'monospace', fontSize: '0.75rem' }}>
                            {span.description || span.op}
                          </Typography>
                          <Typography variant="caption" fontWeight={700} sx={{ color: opColor, flexShrink: 0 }}>
                            {Number(span.avg_duration).toFixed(0)}ms
                          </Typography>
                          <Typography variant="caption" sx={{ color: isDark ? '#555' : '#bbb', flexShrink: 0 }}>
                            ×{span.count}
                          </Typography>
                        </Box>
                        <Box sx={{ height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
                          <Box sx={{ height: '100%', borderRadius: 2, width: `${pct}%`, backgroundColor: opColor, transition: 'width 0.3s' }} />
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Paper>

            {/* Recent Traces */}
            <Paper elevation={0} sx={{ p: 2, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, borderRadius: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
                최근 트레이스
              </Typography>
              {!detail?.recent_traces?.length ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                  트레이스 없음
                </Typography>
              ) : (
                <Box sx={{ maxHeight: 280, overflow: 'auto' }}>
                  {detail.recent_traces.map((tr) => {
                    const isErr = tr.transaction_status !== 'ok';
                    return (
                      <Box
                        key={tr.event_id}
                        onClick={() => fetchTrace(tr.trace_id)}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 1.5, p: 1, borderRadius: 1.5,
                          cursor: 'pointer', transition: 'background 0.15s',
                          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                          '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' },
                        }}
                      >
                        <Box sx={{ width: 3, height: 28, borderRadius: 1, backgroundColor: isErr ? '#f44336' : '#4caf50', flexShrink: 0 }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.72rem', color: isDark ? '#888' : '#666' }}>
                            {tr.trace_id.slice(0, 16)}...
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Typography variant="caption" fontWeight={600}>
                              {Number(tr.duration).toLocaleString()}ms
                            </Typography>
                            <Chip label={`${tr.span_count} spans`} size="small" sx={{ height: 16, fontSize: '0.6rem', backgroundColor: alpha(theme.palette.primary.main, 0.1) }} />
                            {isErr && <Chip label={tr.http_status_code || 'error'} size="small" color="error" sx={{ height: 16, fontSize: '0.6rem' }} />}
                          </Box>
                        </Box>
                        <Typography variant="caption" sx={{ color: isDark ? '#555' : '#bbb', fontSize: '0.68rem', flexShrink: 0 }}>
                          {formatTime(tr.timestamp)}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Paper>
          </Box>
        </PageContentLoader>
      )}

      {/* === TRANSACTION LIST === */}
      {viewMode === 'list' && (
        <PageContentLoader loading={loading}>
          <Paper elevation={0} sx={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, borderRadius: 2, overflow: 'hidden' }}>
            {/* Table Header */}
            <Box sx={{
              display: 'grid', gridTemplateColumns: '2fr repeat(5, 1fr)', gap: 1,
              px: 2, py: 1.2,
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            }}>
              <Typography variant="caption" fontWeight={600}>{t('argus.performance.transactionName')}</Typography>
              <Typography variant="caption" fontWeight={600} sx={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => setSort('count')}>
                {t('argus.performance.count')} {sort === 'count' ? '↓' : ''}
              </Typography>
              <Typography variant="caption" fontWeight={600} sx={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => setSort('avg')}>
                {t('argus.performance.avgDuration')} {sort === 'avg' ? '↓' : ''}
              </Typography>
              <Typography variant="caption" fontWeight={600} sx={{ textAlign: 'right' }}>P50</Typography>
              <Typography variant="caption" fontWeight={600} sx={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => setSort('p95')}>
                P95 {sort === 'p95' ? '↓' : ''}
              </Typography>
              <Typography variant="caption" fontWeight={600} sx={{ textAlign: 'right' }}>{t('argus.performance.errorRate')}</Typography>
            </Box>

            {transactions.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <SpeedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                <Typography color="text.secondary">{t('argus.performance.noTransactions')}</Typography>
              </Box>
            ) : (
              transactions.map((txn, idx) => {
                const p95Val = Number(txn.p95);
                const errRate = Number(txn.error_rate);
                return (
                  <Box
                    key={txn.name}
                    onClick={() => handleTxnClick(txn.name)}
                    sx={{
                      display: 'grid', gridTemplateColumns: '2fr repeat(5, 1fr)', gap: 1,
                      px: 2, py: 1.2, alignItems: 'center', cursor: 'pointer',
                      borderBottom: idx < transactions.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}` : 'none',
                      transition: 'background 0.15s',
                      '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)' },
                    }}
                  >
                    <Typography variant="body2" fontWeight={500} noWrap>{txn.name}</Typography>
                    <Typography variant="body2" sx={{ textAlign: 'right' }}>{Number(txn.count).toLocaleString()}</Typography>
                    <Typography variant="body2" sx={{ textAlign: 'right' }}>{Number(txn.avg_duration).toFixed(0)}ms</Typography>
                    <Typography variant="body2" sx={{ textAlign: 'right' }}>{Number(txn.p50).toFixed(0)}ms</Typography>
                    <Typography variant="body2" fontWeight={600} sx={{
                      textAlign: 'right',
                      color: p95Val > 3000 ? '#f44336' : p95Val > 1000 ? '#ff9800' : 'inherit',
                    }}>
                      {p95Val.toFixed(0)}ms
                    </Typography>
                    <Box sx={{ textAlign: 'right' }}>
                      <Chip
                        label={`${errRate.toFixed(1)}%`}
                        size="small"
                        sx={{
                          height: 20, fontSize: '0.7rem', fontWeight: 600,
                          backgroundColor: alpha(errRate > 5 ? '#f44336' : errRate > 1 ? '#ff9800' : '#4caf50', 0.12),
                          color: errRate > 5 ? '#f44336' : errRate > 1 ? '#ff9800' : '#4caf50',
                          border: 'none',
                        }}
                      />
                    </Box>
                  </Box>
                );
              })
            )}
          </Paper>
        </PageContentLoader>
      )}
    </Box>
  );
};

// ==================== TRACE WATERFALL COMPONENT ====================

const TraceWaterfall: React.FC<{ trace: ArgusTraceDetail; isDark: boolean }> = ({ trace, isDark }) => {
  const theme = useTheme();
  const root = trace.root;
  const spans = trace.spans || [];

  // Calculate timeline boundaries
  const allTimestamps = [
    root?.start_timestamp,
    root?.timestamp,
    ...spans.map((s) => s.start_timestamp),
    ...spans.map((s) => s.timestamp),
  ].filter(Boolean).map((t) => new Date(t).getTime());

  const timelineStart = Math.min(...allTimestamps);
  const timelineEnd = Math.max(...allTimestamps);
  const totalDuration = timelineEnd - timelineStart || 1;

  const getBarPosition = (startTs: string, dur: number) => {
    const start = new Date(startTs).getTime();
    const left = ((start - timelineStart) / totalDuration) * 100;
    const width = Math.max((dur / totalDuration) * 100, 0.5);
    return { left: `${left}%`, width: `${Math.min(width, 100 - left)}%` };
  };

  return (
    <Box>
      {/* Root transaction header */}
      {root && (
        <Paper elevation={0} sx={{
          p: 2, mb: 2,
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          borderRadius: 2,
          display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
        }}>
          <Box>
            <Typography variant="body1" fontWeight={700}>{root.transaction}</Typography>
            <Typography variant="caption" color="text.secondary">{root.transaction_op}</Typography>
          </Box>
          <Chip label={`${Number(root.duration).toLocaleString()}ms`} size="small" sx={{ fontWeight: 700 }} />
          <Chip
            label={root.transaction_status}
            size="small"
            sx={{
              fontWeight: 600,
              backgroundColor: alpha(root.transaction_status === 'ok' ? '#4caf50' : '#f44336', 0.12),
              color: root.transaction_status === 'ok' ? '#4caf50' : '#f44336',
              border: 'none',
            }}
          />
          {root.http_status_code > 0 && (
            <Chip label={`HTTP ${root.http_status_code}`} size="small" variant="outlined" sx={{ fontSize: '0.72rem' }} />
          )}
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            {spans.length} spans · {root.environment} · {root.release}
          </Typography>
        </Paper>
      )}

      {/* Timeline header */}
      <Paper elevation={0} sx={{
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        borderRadius: 2, overflow: 'hidden',
      }}>
        <Box sx={{
          display: 'grid', gridTemplateColumns: '280px 1fr', gap: 0,
          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          px: 1.5, py: 0.8,
        }}>
          <Typography variant="caption" fontWeight={600}>Operation</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption" color="text.secondary">0ms</Typography>
            <Typography variant="caption" color="text.secondary">{(totalDuration / 2).toFixed(0)}ms</Typography>
            <Typography variant="caption" color="text.secondary">{totalDuration.toFixed(0)}ms</Typography>
          </Box>
        </Box>

        {/* Root transaction bar */}
        {root && (
          <WaterfallRow
            label={root.transaction}
            sublabel={root.transaction_op}
            op="http.server"
            duration={Number(root.duration)}
            barPos={getBarPosition(root.start_timestamp, Number(root.duration))}
            status={root.transaction_status}
            isRoot
            isDark={isDark}
          />
        )}

        {/* Span bars */}
        {spans.map((span, idx) => (
          <WaterfallRow
            key={span.span_id || idx}
            label={span.description || span.op}
            sublabel={span.op}
            op={span.op}
            duration={Number(span.duration)}
            barPos={getBarPosition(span.start_timestamp, Number(span.duration))}
            status={span.status}
            isDark={isDark}
            data={typeof span.data === 'object' ? span.data : undefined}
          />
        ))}

        {spans.length === 0 && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">이 트레이스에 span 데이터가 없습니다</Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

// --- Waterfall Row ---
const WaterfallRow: React.FC<{
  label: string;
  sublabel: string;
  op: string;
  duration: number;
  barPos: { left: string; width: string };
  status: string;
  isRoot?: boolean;
  isDark: boolean;
  data?: Record<string, string>;
}> = ({ label, sublabel, op, duration, barPos, status, isRoot, isDark, data }) => {
  const opColor = getOpColor(op);
  const isErr = status !== 'ok' && status !== '';

  return (
    <Tooltip
      title={
        <Box sx={{ fontSize: '0.75rem' }}>
          <Box><strong>{op}</strong>: {label}</Box>
          <Box>Duration: {duration}ms</Box>
          <Box>Status: {status}</Box>
          {data && Object.entries(data).slice(0, 3).map(([k, v]) => (
            <Box key={k}>{k}: {v}</Box>
          ))}
        </Box>
      }
      placement="top"
      arrow
    >
      <Box sx={{
        display: 'grid', gridTemplateColumns: '280px 1fr', gap: 0,
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'}`,
        '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' },
        transition: 'background 0.1s',
      }}>
        {/* Label */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, px: 1.5, py: 0.6, overflow: 'hidden' }}>
          {!isRoot && <Box sx={{ width: 12, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, flexShrink: 0 }} />}
          <Box sx={{ color: opColor, display: 'flex', flexShrink: 0 }}>{getOpIcon(op)}</Box>
          <Typography variant="caption" noWrap sx={{
            fontFamily: 'monospace', fontSize: '0.73rem',
            fontWeight: isRoot ? 700 : 400,
            color: isErr ? '#f44336' : (isDark ? '#ccc' : '#333'),
          }}>
            {label}
          </Typography>
        </Box>

        {/* Bar */}
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', px: 1 }}>
          {/* Grid lines */}
          {[25, 50, 75].map(pct => (
            <Box key={pct} sx={{
              position: 'absolute', left: `${pct}%`, top: 0, bottom: 0, width: 1,
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
            }} />
          ))}
          {/* Duration bar */}
          <Box sx={{
            position: 'absolute',
            left: barPos.left,
            width: barPos.width,
            height: isRoot ? 20 : 16,
            borderRadius: 1,
            backgroundColor: isErr ? alpha('#f44336', 0.7) : alpha(opColor, 0.7),
            border: `1px solid ${isErr ? '#f44336' : opColor}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 2,
            transition: 'all 0.2s',
          }}>
            {duration > totalDuration(barPos) * 0.15 && (
              <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 600, color: '#fff', textShadow: '0 0 2px rgba(0,0,0,0.3)' }}>
                {duration}ms
              </Typography>
            )}
          </Box>
          {/* Duration label outside if bar is small */}
          {duration <= totalDuration(barPos) * 0.15 && (
            <Typography variant="caption" sx={{
              position: 'absolute',
              left: `calc(${barPos.left} + ${barPos.width} + 4px)`,
              fontSize: '0.62rem', fontWeight: 600, color: isDark ? '#777' : '#999',
            }}>
              {duration}ms
            </Typography>
          )}
        </Box>
      </Box>
    </Tooltip>
  );
};

// totalDuration helper for bar — parse width percentage back
function totalDuration(barPos: { width: string }): number {
  return parseFloat(barPos.width) || 100;
}

function formatHour(hourStr: string): string {
  try {
    const d = new Date(hourStr);
    return `${String(d.getHours()).padStart(2, '0')}:00`;
  } catch { return hourStr; }
}

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  } catch { return ts; }
}

export default ArgusPerformancePage;
