import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Timeline as TimelineIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  FitScreen as FitScreenIcon,
} from '@mui/icons-material';
import { getCrosshairPlugin } from '../../utils/chartPlugins';
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
import TraceWaterfall from '@/components/argus/TraceWaterfall';

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
              <Box sx={{ height: 260 }}>
                <Line data={trendChartData} options={chartOpts} plugins={[getCrosshairPlugin(isDark)]} />
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
                {t('argus.performance.recentTraces')}
              </Typography>
              {!detail?.recent_traces?.length ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                  {t('argus.performance.noTraces')}
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
                const p50Val = Number(txn.p50);
                const errRate = Number(txn.error_rate);
                const maxP95 = Math.max(...transactions.map(t => Number(t.p95)), 1);
                const { method, path: txnPath } = parseTransaction(txn.name);
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
                      {method && (
                        <Chip label={method} size="small" sx={{
                          height: 20, fontSize: '0.65rem', fontWeight: 700, borderRadius: 0.8, minWidth: 40,
                          backgroundColor: alpha(getMethodColor(method), 0.12),
                          color: getMethodColor(method), border: 'none',
                        }} />
                      )}
                      <Typography variant="body2" fontWeight={500} noWrap>{txnPath}</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ textAlign: 'right' }}>{Number(txn.count).toLocaleString()}</Typography>
                    <Typography variant="body2" sx={{ textAlign: 'right' }}>{Number(txn.avg_duration).toFixed(0)}ms</Typography>
                    {/* P50 with mini bar */}
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>{p50Val.toFixed(0)}ms</Typography>
                      <Box sx={{ height: 3, borderRadius: 2, mt: 0.3, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
                        <Box sx={{ height: '100%', borderRadius: 2, width: `${(p50Val / maxP95) * 100}%`, backgroundColor: '#4caf50', transition: 'width 0.3s' }} />
                      </Box>
                    </Box>
                    {/* P95 with mini bar */}
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="body2" fontWeight={600} sx={{
                        fontSize: '0.82rem',
                        color: p95Val > 3000 ? '#f44336' : p95Val > 1000 ? '#ff9800' : 'inherit',
                      }}>
                        {p95Val.toFixed(0)}ms
                      </Typography>
                      <Box sx={{ height: 3, borderRadius: 2, mt: 0.3, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
                        <Box sx={{ height: '100%', borderRadius: 2, width: `${(p95Val / maxP95) * 100}%`,
                          backgroundColor: p95Val > 3000 ? '#f44336' : p95Val > 1000 ? '#ff9800' : '#7c4dff',
                          transition: 'width 0.3s',
                        }} />
                      </Box>
                    </Box>
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

const METHOD_COLORS: Record<string, string> = {
  GET: '#4caf50', POST: '#2196f3', PUT: '#ff9800', PATCH: '#7c4dff',
  DELETE: '#f44336', HEAD: '#9e9e9e', OPTIONS: '#607d8b',
};
function getMethodColor(method: string): string {
  return METHOD_COLORS[method.toUpperCase()] || '#9e9e9e';
}
function parseTransaction(name: string): { method: string; path: string } {
  const match = name.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(.+)$/i);
  if (match) return { method: match[1].toUpperCase(), path: match[2] };
  return { method: '', path: name };
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

function getOpColor(op: string): string {
  if (!op) return '#9e9e9e';
  if (op.startsWith('db')) return '#ff9800';
  if (op.startsWith('http')) return '#2196f3';
  if (op.startsWith('queue')) return '#9c27b0';
  if (op.startsWith('cache')) return '#00bcd4';
  return '#9e9e9e';
}

export default ArgusPerformancePage;
