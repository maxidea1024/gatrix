import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useArgusUrlState from '@/hooks/useArgusUrlState';
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  useTheme,
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
  BugReport as BugReportIcon,
  Warning as WarningIcon,
  Lightbulb as LightbulbIcon,
  DevicesOther as DevicesIcon,
  Cloud as EnvIcon,
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
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import PageHeader from '@/components/common/PageHeader';
import {
  TableSkeleton,
  ChartSkeleton,
  StatsRowSkeleton,
} from '@/components/argus/ArgusSkeletons';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import argusService, {
  ArgusTransaction,
  ArgusTransactionDetail,
  ArgusTraceDetail,
  ArgusTraceSpan,
} from '@/services/argusService';
import TraceWaterfall from '@/components/argus/TraceWaterfall';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import ArgusFilterBar, {
  ArgusFilterState,
  defaultArgusFilterState,
} from '@/components/argus/ArgusFilterBar';
import { dateRangeToApiParams as argusDateRangeToApiParams } from '@/components/common/DateRangeSelector';
import { formatCompactNumber } from '@/utils/numberFormat';
import SimplePagination from '@/components/common/SimplePagination';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import FilterChipSelect from '@/components/common/FilterChipSelect';

const PERF_PAGE_SIZE_KEY = 'argusPerf.pageSize';
const PERF_DEFAULT_PAGE_SIZE = 15;
const PERF_VALID_PAGE_SIZES = [5, 10, 15, 20, 25, 50, 100];

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

const OP_ICONS: Record<string, React.ReactElement> = {
  db: <StorageIcon sx={{ fontSize: 13 }} />,
  http: <HttpIcon sx={{ fontSize: 13 }} />,
  function: <FuncIcon sx={{ fontSize: 13 }} />,
  cache: <CacheIcon sx={{ fontSize: 13 }} />,
  message: <SendIcon sx={{ fontSize: 13 }} />,
  crypto: <LockIcon sx={{ fontSize: 13 }} />,
};
const getOpIcon = (op: string) =>
  OP_ICONS[op.split('.')[0]] || <FuncIcon sx={{ fontSize: 13 }} />;

type ViewMode = 'list' | 'detail' | 'trace';

const ArgusPerformancePage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

  // ─── URL-driven state ───
  const URL_PARAMS = useMemo(
    () => ({
      view: { key: 'view', default: 'list', pushHistory: true },
      txn: { key: 'txn', default: '', pushHistory: true },
      trace: { key: 'trace', default: '', pushHistory: true },
      period: {
        key: 'period',
        default: '14d',
        storageKey: 'argus-perf-period',
      },
      sort: { key: 'sort', default: 'count' },
    }),
    []
  );
  const [urlState, setUrlState] = useArgusUrlState(URL_PARAMS);

  const viewMode = urlState.view as ViewMode;
  const selectedTxn = urlState.txn || null;
  const sort = urlState.sort;

  // Derive ArgusFilterState from URL period (for ArgusFilterBar compatibility)
  const [filters, setFilters] = useState<ArgusFilterState>(() =>
    defaultArgusFilterState(urlState.period)
  );

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      dateRange: { type: 'preset', preset: urlState.period },
    }));
  }, [urlState.period]);

  const [transactions, setTransactions] = useState<ArgusTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [perfPage, setPerfPage] = useState(0);
  const [perfRowsPerPage, setPerfRowsPerPage] = useState(() => {
    const saved = parseInt(localStorage.getItem(PERF_PAGE_SIZE_KEY) || '', 10);
    if (!isNaN(saved) && PERF_VALID_PAGE_SIZES.includes(saved)) return saved;
    return PERF_DEFAULT_PAGE_SIZE;
  });

  useEffect(() => {
    localStorage.setItem(PERF_PAGE_SIZE_KEY, String(perfRowsPerPage));
  }, [perfRowsPerPage]);
  const [detail, setDetail] = useState<ArgusTransactionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Trace waterfall state
  const [traceData, setTraceData] = useState<ArgusTraceDetail | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [sortAnchor, setSortAnchor] = useState<HTMLElement | null>(null);

  const sortOptions = useMemo(
    () => [
      { value: 'count', label: t('argus.performance.count') },
      { value: 'avg', label: t('argus.performance.avgDuration') },
      { value: 'p95', label: 'P95' },
      { value: 'error_rate', label: t('argus.performance.errorRate') },
    ],
    [t]
  );

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const ap = argusDateRangeToApiParams(filters.dateRange);
      const data = await argusService.getTransactions(projectId, {
        ...ap,
        sort,
        limit: 500,
      });
      setTransactions(data);
      setPerfPage(0);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, filters, sort]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const fetchDetail = useCallback(
    async (txnName: string) => {
      setDetailLoading(true);
      try {
        const ap = argusDateRangeToApiParams(filters.dateRange);
        const data = await argusService.getTransactionDetail(
          projectId,
          txnName,
          ap.period,
          ap.start,
          ap.end
        );
        setDetail(data);
      } catch (error) {
        console.error('Failed to fetch detail:', error);
      } finally {
        setDetailLoading(false);
      }
    },
    [projectId, filters]
  );

  const fetchTrace = useCallback(
    async (traceId: string) => {
      setTraceLoading(true);
      try {
        const data = await argusService.getTraceDetail(projectId, traceId);
        setTraceData(data);
      } catch (error) {
        console.error('Failed to fetch trace:', error);
      } finally {
        setTraceLoading(false);
      }
    },
    [projectId]
  );

  // Restore view from URL on mount
  useEffect(() => {
    if (urlState.trace) {
      // URL has trace ID — ensure we're in trace view and fetch data
      if (viewMode !== 'trace') setUrlState({ view: 'trace' });
      fetchTrace(urlState.trace);
    } else if (urlState.txn) {
      // URL has transaction name — ensure we're in detail view and fetch data
      if (viewMode !== 'detail') setUrlState({ view: 'detail' });
      fetchDetail(urlState.txn);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  const handleTxnClick = (txnName: string) => {
    setUrlState({ view: 'detail', txn: txnName, trace: '' });
    fetchDetail(txnName);
  };

  const handleBack = () => {
    // If navigated from another page (e.g., logs), use browser back
    if (location.state?.allowBack) {
      navigate(-1);
      return;
    }
    if (viewMode === 'trace') {
      setUrlState({ view: selectedTxn ? 'detail' : 'list', trace: '' });
      setTraceData(null);
    } else {
      setUrlState({ view: 'list', txn: '', trace: '' });
      setDetail(null);
    }
  };

  const handleFilterChange = (newFilters: ArgusFilterState) => {
    setFilters(newFilters);
    if (newFilters.dateRange.type === 'preset' && newFilters.dateRange.preset) {
      setUrlState({ period: newFilters.dateRange.preset });
    }
    if (selectedTxn && viewMode === 'detail') fetchDetail(selectedTxn);
  };

  const handleSortChange = (newSort: string) => {
    setUrlState({ sort: newSort });
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
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4,
          yAxisID: 'y',
        },
        {
          label: t('argus.performance.throughput'),
          data: detail.trend.map((d) => d.count),
          borderColor: theme.palette.primary.main,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          tension: 0.4,
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 3,
          yAxisID: 'y1',
        },
      ],
    };
  }, [detail, theme, t]);

  const histogramData = useMemo(() => {
    if (!detail?.histogram) return { labels: [], datasets: [] };
    return {
      labels: detail.histogram.map((d) => d.bucket),
      datasets: [
        {
          label: t('argus.performance.count'),
          data: detail.histogram.map((d) => d.count),
          backgroundColor: alpha(theme.palette.info.main, 0.6),
          borderColor: theme.palette.info.main,
          borderWidth: 0,
          borderRadius: 4,
        },
      ],
    };
  }, [detail, theme, t]);

  const chartOpts = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: { boxWidth: 8, font: { size: 11 } },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 10,
            font: { size: 10 },
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
          },
          border: { display: false },
          ticks: { font: { size: 10 } },
          title: { display: true, text: 'ms', font: { size: 10 } },
        },
        y1: {
          position: 'right' as const,
          beginAtZero: true,
          grid: { display: false },
          border: { display: false },
          ticks: { font: { size: 10 } },
          title: { display: true, text: 'req', font: { size: 10 } },
        },
      },
      interaction: {
        mode: 'nearest' as const,
        axis: 'x' as const,
        intersect: false,
      },
    }),
    [isDark]
  );

  const barOpts = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { font: { size: 10 } },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
          },
          border: { display: false },
          ticks: { font: { size: 10 } },
        },
      },
    }),
    [isDark]
  );

  const headerTitle =
    viewMode === 'trace'
      ? `Trace ${(traceData?.trace_id || urlState.trace || '')?.slice(0, 8)}...`
      : viewMode === 'detail'
        ? selectedTxn || urlState.txn
        : t('argus.performance.title');

  const breadcrumbPaths = useMemo(() => {
    const paths: { label: string; to?: string }[] = [
      {
        label: t('argus.performance.title'),
        to: viewMode !== 'list' ? `/argus/performance` : undefined,
      },
    ];
    if (
      viewMode === 'detail' ||
      (viewMode === 'trace' && (selectedTxn || urlState.txn))
    ) {
      paths.push({
        label: (selectedTxn || urlState.txn) as string,
        to:
          viewMode === 'trace'
            ? `/argus/performance?txn=${encodeURIComponent(selectedTxn || urlState.txn)}`
            : undefined,
      });
    }
    if (viewMode === 'trace') {
      paths.push({
        label: `Trace ${(traceData?.trace_id || urlState.trace || '')?.slice(0, 8)}...`,
      });
    }
    return paths;
  }, [
    viewMode,
    projectId,
    t,
    selectedTxn,
    urlState.txn,
    urlState.trace,
    traceData,
  ]);

  // ─── Stable callback handlers (for React.memo) ─────────────────
  const handleSortOpen = useCallback((e: React.MouseEvent<HTMLElement>) => setSortAnchor(e.currentTarget), []);
  const handleSortClose = useCallback(() => setSortAnchor(null), []);

  return (
    <Box>
      {/* Header */}
      <PageHeader
        icon={<SpeedIcon />}
        title={<ArgusBreadcrumbs size="title" paths={breadcrumbPaths} />}
        subtitle={
          viewMode === 'list' ? t('argus.performance.subtitle') : undefined
        }
        onBack={viewMode !== 'list' ? handleBack : undefined}
      />

      {/* Filter Bar + Sort */}
      <ArgusFilterBar
        projectId={projectId}
        value={filters}
        onChange={handleFilterChange}
        onRefresh={
          viewMode === 'list'
            ? fetchTransactions
            : () => selectedTxn && fetchDetail(selectedTxn)
        }
        loading={loading}
        extraControls={
          viewMode === 'list' ? (
            <FilterChipSelect
              label={t('argus.issues.sort')}
              value={sort}
              options={sortOptions}
              anchorEl={sortAnchor}
              onOpen={handleSortOpen}
              onClose={handleSortClose}
              onSelect={handleSortChange}
            />
          ) : undefined
        }
      />

      {/* === TRACE WATERFALL VIEW === */}
      {viewMode === 'trace' && (
        <PageContentLoader
          loading={traceLoading}
          skeleton={<TableSkeleton rows={8} cols={6} />}
        >
          {traceData && <TraceWaterfall trace={traceData} isDark={isDark} />}
        </PageContentLoader>
      )}

      {/* === DETAIL VIEW === */}
      {viewMode === 'detail' && (
        <PageContentLoader
          loading={detailLoading}
          skeleton={
            <>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                  gap: 2,
                  mb: 2,
                }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 2,
                  }}
                >
                  <ArgusChartSkeleton
                    type="line"
                    height={260}
                    color="#ff9800"
                  />
                </Paper>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 2,
                  }}
                >
                  <ArgusChartSkeleton
                    type="bar"
                    height={220}
                    color={theme.palette.info.main}
                  />
                </Paper>
              </Box>
            </>
          }
        >
          {/* Summary Cards */}
          {detail?.summary && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 2,
                mb: 2,
              }}
            >
              {[
                {
                  label: t('argus.performance.totalTransactions', 'Total'),
                  value: formatCompactNumber(Number(detail.summary.count)),
                  color: '#7c4dff',
                  icon: <SpeedIcon />,
                },
                {
                  label: t('argus.performance.avgP95', 'P95'),
                  value: `${Number(detail.summary.p95).toFixed(0)}ms`,
                  color:
                    Number(detail.summary.p95) > 3000
                      ? '#f44336'
                      : Number(detail.summary.p95) > 1000
                        ? '#ff9800'
                        : '#4caf50',
                  icon: <TimelineIcon />,
                },
                {
                  label: t('argus.performance.avgDuration', 'Avg'),
                  value: `${Number(detail.summary.avg_duration).toFixed(0)}ms`,
                  color: '#2196f3',
                  icon: <ScheduleIcon />,
                },
                {
                  label: t('argus.performance.errorRate', 'Error Rate'),
                  value: `${Number(detail.summary.error_rate).toFixed(2)}%`,
                  color:
                    Number(detail.summary.error_rate) > 5
                      ? '#f44336'
                      : '#4caf50',
                  icon: <BugReportIcon />,
                },
              ].map((card, idx) => (
                <Paper
                  key={idx}
                  elevation={0}
                  sx={{
                    p: 1.5,
                    background: isDark
                      ? `linear-gradient(135deg, ${alpha(card.color, 0.12)}, ${alpha(card.color, 0.03)})`
                      : `linear-gradient(135deg, ${alpha(card.color, 0.06)}, ${alpha(card.color, 0.01)})`,
                    border: `1px solid ${alpha(card.color, 0.2)}`,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                  }}
                >
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: alpha(card.color, isDark ? 0.2 : 0.1),
                      color: card.color,
                    }}
                  >
                    {React.cloneElement(card.icon, { sx: { fontSize: 18 } })}
                  </Box>
                  <Box>
                    <Typography
                      variant="h6"
                      fontWeight={800}
                      sx={{
                        lineHeight: 1.1,
                        fontSize: '1.1rem',
                        color: card.color,
                      }}
                    >
                      {card.value}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: isDark ? '#888' : '#777',
                        fontWeight: 500,
                        fontSize: '0.65rem',
                      }}
                    >
                      {card.label}
                    </Typography>
                  </Box>
                </Paper>
              ))}
            </Box>
          )}

          {/* Charts */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 2,
              mb: 2,
            }}
          >
            <Paper
              elevation={0}
              sx={{
                p: 2,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                borderRadius: 2,
              }}
            >
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
                {t('argus.performance.latencyTrend')}
              </Typography>
              <Box sx={{ height: 260 }}>
                {detailLoading ? (
                  <ArgusChartSkeleton
                    type="line"
                    height={260}
                    color="#ff9800"
                  />
                ) : (
                  <Line
                    data={trendChartData}
                    options={chartOpts}
                    plugins={[getCrosshairPlugin(isDark)]}
                  />
                )}
              </Box>
            </Paper>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                borderRadius: 2,
              }}
            >
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
                {t('argus.performance.durationDistribution')}
              </Typography>
              <Box sx={{ height: 220 }}>
                {detailLoading ? (
                  <ArgusChartSkeleton
                    type="bar"
                    height={220}
                    color={theme.palette.info.main}
                  />
                ) : (
                  <Bar data={histogramData} options={barOpts} />
                )}
              </Box>
            </Paper>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Top Row: Insights & Suspect Tags (Full Width) */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                borderRadius: 2,
              }}
            >
              <Typography
                variant="subtitle2"
                fontWeight={600}
                sx={{
                  mb: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                <LightbulbIcon
                  fontSize="small"
                  sx={{ color: theme.palette.warning.main }}
                />
                {t('argus.performance.insights', 'Insights & Suspect Tags')}
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {/* Variance Insight */}
                {detail?.summary &&
                  detail.summary.p95 > detail.summary.p50 * 3 &&
                  detail.summary.p50 > 50 && (
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 1.5,
                        backgroundColor: alpha('#ff9800', 0.1),
                        border: `1px solid ${alpha('#ff9800', 0.2)}`,
                      }}
                    >
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        sx={{
                          color: '#ff9800',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          mb: 0.5,
                        }}
                      >
                        <WarningIcon sx={{ fontSize: 16 }} />
                        {t(
                          'argus.performance.highVariance',
                          'High Latency Variance Detected'
                        )}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: isDark ? '#ccc' : '#555',
                          display: 'block',
                          lineHeight: 1.4,
                        }}
                      >
                        {t(
                          'argus.performance.varianceDesc',
                          'P95 duration is significantly higher than the median (P50), indicating inconsistent performance.'
                        )}
                      </Typography>
                    </Box>
                  )}

                {/* Suspect Tags */}
                {detail?.suspect_tags &&
                  detail.suspect_tags.length > 0 &&
                  (() => {
                    const slowestTag = [...detail.suspect_tags].sort(
                      (a, b) => b.p95 - a.p95
                    )[0];
                    if (
                      detail.summary &&
                      slowestTag.p95 > detail.summary.p95 * 1.5
                    ) {
                      return (
                        <Box
                          sx={{
                            p: 1.5,
                            borderRadius: 1.5,
                            backgroundColor: alpha('#2196f3', 0.1),
                            border: `1px solid ${alpha('#2196f3', 0.2)}`,
                          }}
                        >
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            sx={{
                              color: '#2196f3',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                              mb: 0.5,
                            }}
                          >
                            {slowestTag.tag_key === 'browser' ? (
                              <DevicesIcon sx={{ fontSize: 16 }} />
                            ) : (
                              <EnvIcon sx={{ fontSize: 16 }} />
                            )}
                            {t(
                              'argus.performance.slowestTag',
                              'Slowest Environment/Tag'
                            )}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: isDark ? '#ccc' : '#555',
                              display: 'block',
                              lineHeight: 1.4,
                            }}
                          >
                            {t(
                              'argus.performance.slowestTagDesc',
                              `This transaction is unusually slow on {{tag_value}} ({{tag_key}}).`,
                              {
                                tag_value: slowestTag.tag_value,
                                tag_key: slowestTag.tag_key,
                              }
                            )}
                            <strong style={{ marginLeft: 4 }}>
                              P95: {Number(slowestTag.p95).toFixed(0)}ms
                            </strong>
                          </Typography>
                        </Box>
                      );
                    }
                    return null;
                  })()}

                {(!detail?.summary ||
                  (!(
                    detail.summary.p95 > detail.summary.p50 * 3 &&
                    detail.summary.p50 > 50
                  ) &&
                    !detail?.suspect_tags?.some(
                      (tag) =>
                        detail.summary && tag.p95 > detail.summary.p95 * 1.5
                    ))) && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ py: 1, textAlign: 'center' }}
                  >
                    {t(
                      'argus.performance.noInsights',
                      'No significant anomalies detected.'
                    )}
                  </Typography>
                )}
              </Box>
            </Paper>

            {/* Middle Row: Related Issues (Full Width) */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                borderRadius: 2,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Typography
                variant="subtitle2"
                fontWeight={600}
                sx={{
                  mb: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                <BugReportIcon
                  fontSize="small"
                  sx={{ color: theme.palette.error.main }}
                />
                {t('argus.performance.relatedIssues', 'Related Issues')}
              </Typography>
              {!detail?.related_issues?.length ? (
                <EmptyPlaceholder
                  icon={<BugReportIcon sx={{ fontSize: 36 }} />}
                  message={t(
                    'argus.performance.noIssues',
                    'No related issues found.'
                  )}
                  minHeight={150}
                />
              ) : (
                <Box
                  sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}
                >
                  {detail.related_issues.map((issue, idx) => {
                    const levelColor =
                      issue.level === 'fatal'
                        ? '#f44336'
                        : issue.level === 'error'
                          ? '#ff5722'
                          : issue.level === 'warning'
                            ? '#ff9800'
                            : '#2196f3';
                    return (
                      <Box
                        key={idx}
                        onClick={() =>
                          navigate(
                            `/argus/issues/${projectId}/${issue.issue_id}`
                          )
                        }
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          p: 1,
                          pl: 0,
                          borderRadius: 1.5,
                          cursor: 'pointer',
                          transition: 'background 0.15s',
                          '&:hover': {
                            backgroundColor: alpha(levelColor, 0.06),
                          },
                        }}
                      >
                        <Box
                          sx={{
                            width: 3,
                            height: 32,
                            borderRadius: 1,
                            backgroundColor: levelColor,
                            flexShrink: 0,
                          }}
                        />
                        <Box sx={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            noWrap
                            sx={{ lineHeight: 1.3 }}
                          >
                            {issue.title || `Issue ${issue.issue_id}`}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                            sx={{ fontSize: '0.7rem' }}
                          >
                            {issue.subtitle || ''}
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            px: 1.2,
                            py: 0.3,
                            borderRadius: 1,
                            backgroundColor: alpha(
                              levelColor,
                              isDark ? 0.15 : 0.08
                            ),
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            flexShrink: 0,
                          }}
                        >
                          <Typography
                            variant="caption"
                            fontWeight={700}
                            sx={{ color: levelColor, fontSize: '0.72rem' }}
                          >
                            {issue.event_count?.toLocaleString()}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Paper>

            {/* Bottom Row: Slowest Spans & Recent Traces */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: 2,
              }}
            >
              {/* Slowest Spans */}
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  borderRadius: 2,
                  flex: 1,
                }}
              >
                <Typography
                  variant="subtitle2"
                  fontWeight={600}
                  sx={{ mb: 1.5 }}
                >
                  {t('argus.performance.slowestSpans')}
                </Typography>
                {detail?.spans?.length === 0 ? (
                  <EmptyPlaceholder
                    message={t('argus.performance.noSpans')}
                    minHeight={100}
                  />
                ) : (
                  <Box sx={{ maxHeight: 280, overflow: 'auto' }}>
                    {detail?.spans?.slice(0, 10).map((span, idx) => {
                      const opColor = getOpColor(span.op);
                      const maxDur = Math.max(
                        ...(detail?.spans?.map((s) =>
                          Number(s.avg_duration)
                        ) || [1])
                      );
                      const pct = (Number(span.avg_duration) / maxDur) * 100;
                      return (
                        <Box key={idx} sx={{ mb: 1 }}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              mb: 0.3,
                            }}
                          >
                            <Box sx={{ color: opColor, display: 'flex' }}>
                              {getOpIcon(span.op)}
                            </Box>
                            <Typography
                              variant="caption"
                              noWrap
                              sx={{ flex: 1, fontSize: '0.75rem' }}
                            >
                              {span.description || span.op}
                            </Typography>
                            <Typography
                              variant="caption"
                              fontWeight={700}
                              sx={{ color: opColor, flexShrink: 0 }}
                            >
                              {Number(span.avg_duration).toFixed(0)}ms
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                color: isDark ? '#555' : '#bbb',
                                flexShrink: 0,
                              }}
                            >
                              ×{span.count}
                            </Typography>
                          </Box>
                          <Box
                            sx={{
                              height: 4,
                              borderRadius: 2,
                              backgroundColor: isDark
                                ? 'rgba(255,255,255,0.04)'
                                : 'rgba(0,0,0,0.04)',
                            }}
                          >
                            <Box
                              sx={{
                                height: '100%',
                                borderRadius: 2,
                                width: `${pct}%`,
                                backgroundColor: opColor,
                                transition: 'width 0.3s',
                              }}
                            />
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Paper>

              {/* Recent Traces */}
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  borderRadius: 2,
                  flex: 1,
                }}
              >
                <Typography
                  variant="subtitle2"
                  fontWeight={600}
                  sx={{ mb: 1.5 }}
                >
                  {t('argus.performance.recentTraces')}
                </Typography>
                {!detail?.recent_traces?.length ? (
                  <EmptyPlaceholder
                    message={t('argus.performance.noTraces')}
                    minHeight={100}
                  />
                ) : (
                  <Box sx={{ maxHeight: 280, overflow: 'auto' }}>
                    {detail.recent_traces.map((tr, idx) => {
                      const isErr = tr.transaction_status !== 'ok';
                      return (
                        <Box
                          key={`${tr.event_id || tr.trace_id}-${idx}`}
                          onClick={() => {
                            setUrlState({ view: 'trace', trace: tr.trace_id });
                            fetchTrace(tr.trace_id);
                          }}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            p: 1,
                            borderRadius: 1.5,
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                            '&:hover': {
                              backgroundColor: isDark
                                ? 'rgba(255,255,255,0.03)'
                                : 'rgba(0,0,0,0.02)',
                            },
                          }}
                        >
                          <Box
                            sx={{
                              width: 3,
                              height: 28,
                              borderRadius: 1,
                              backgroundColor: isErr ? '#f44336' : '#4caf50',
                              flexShrink: 0,
                            }}
                          />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                              variant="caption"
                              sx={{
                                fontSize: '0.72rem',
                                color: isDark ? '#888' : '#666',
                              }}
                            >
                              {tr.trace_id.slice(0, 16)}...
                            </Typography>
                            <Box
                              sx={{
                                display: 'flex',
                                gap: 1,
                                alignItems: 'center',
                              }}
                            >
                              <Typography variant="caption" fontWeight={600}>
                                {Number(tr.duration).toLocaleString()}ms
                              </Typography>
                              <Chip
                                label={`${tr.span_count} spans`}
                                size="small"
                                sx={{
                                  height: 16,
                                  fontSize: '0.6rem',
                                  backgroundColor: alpha(
                                    theme.palette.primary.main,
                                    0.1
                                  ),
                                }}
                              />
                              {isErr && (
                                <Chip
                                  label={tr.http_status_code || 'error'}
                                  size="small"
                                  color="error"
                                  sx={{ height: 16, fontSize: '0.6rem' }}
                                />
                              )}
                            </Box>
                          </Box>
                          <Typography
                            variant="caption"
                            sx={{
                              color: isDark ? '#555' : '#bbb',
                              fontSize: '0.68rem',
                              flexShrink: 0,
                            }}
                          >
                            {formatTime(tr.timestamp)}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Paper>
            </Box>
          </Box>
        </PageContentLoader>
      )}

      {/* === TRANSACTION LIST === */}
      {viewMode === 'list' && (
        <PageContentLoader
          loading={loading}
          skeleton={
            <>
              <StatsRowSkeleton count={5} />
              <TableSkeleton rows={10} cols={6} />
            </>
          }
        >
          {/* Performance Summary Stats */}
          {transactions.length > 0 && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 2,
                mb: 3,
              }}
            >
              {(() => {
                const totalCount = transactions.reduce(
                  (s, t) => s + Number(t.count),
                  0
                );
                const avgP95 =
                  transactions.reduce((s, t) => s + Number(t.p95), 0) /
                  transactions.length;
                const avgDur =
                  transactions.reduce((s, t) => s + Number(t.avg_duration), 0) /
                  transactions.length;
                const avgErr =
                  transactions.reduce((s, t) => s + Number(t.error_rate), 0) /
                  transactions.length;
                const slowest = transactions.reduce(
                  (max, t) => (Number(t.p95) > Number(max.p95) ? t : max),
                  transactions[0]
                );
                return [
                  {
                    label: t(
                      'argus.performance.totalTransactions',
                      'Total Transactions'
                    ),
                    value: formatCompactNumber(totalCount),
                    color: '#7c4dff',
                    icon: <SpeedIcon />,
                  },
                  {
                    label: t('argus.performance.avgP95', 'Avg. P95'),
                    value: `${avgP95.toFixed(0)}ms`,
                    color:
                      avgP95 > 3000
                        ? '#f44336'
                        : avgP95 > 1000
                          ? '#ff9800'
                          : '#4caf50',
                    icon: <TimelineIcon />,
                  },
                  {
                    label: t('argus.performance.avgDuration', 'Avg. Duration'),
                    value: `${avgDur.toFixed(0)}ms`,
                    color: '#2196f3',
                    icon: <ScheduleIcon />,
                  },
                  {
                    label: t(
                      'argus.performance.avgErrorRate',
                      'Avg. Error Rate'
                    ),
                    value: `${avgErr.toFixed(2)}%`,
                    color:
                      avgErr > 5
                        ? '#f44336'
                        : avgErr > 1
                          ? '#ff9800'
                          : '#4caf50',
                    icon: <SpeedIcon />,
                  },
                  {
                    label: t(
                      'argus.performance.slowestEndpoint',
                      'Slowest Endpoint'
                    ),
                    value: `${parseTransaction(slowest.name).path.slice(0, 20)}`,
                    color: '#f44336',
                    icon: <SpeedIcon />,
                    subtitle: `P95: ${Number(slowest.p95).toFixed(0)}ms`,
                  },
                ].map((card, idx) => (
                  <Paper
                    key={idx}
                    elevation={0}
                    sx={{
                      p: 2,
                      background: isDark
                        ? `linear-gradient(135deg, ${alpha(card.color, 0.12)}, ${alpha(card.color, 0.03)})`
                        : `linear-gradient(135deg, ${alpha(card.color, 0.06)}, ${alpha(card.color, 0.01)})`,
                      border: `1px solid ${alpha(card.color, 0.2)}`,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      transition: 'all 0.2s',
                      '&:hover': { transform: 'translateY(-1px)' },
                    }}
                  >
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: alpha(card.color, isDark ? 0.2 : 0.1),
                        color: card.color,
                      }}
                    >
                      {React.cloneElement(card.icon, { sx: { fontSize: 18 } })}
                    </Box>
                    <Box>
                      <Typography
                        variant="h6"
                        fontWeight={800}
                        sx={{
                          lineHeight: 1.2,
                          fontSize: '1rem',
                          color: card.color,
                        }}
                      >
                        {card.value}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: isDark ? '#888' : '#777',
                          fontWeight: 500,
                          fontSize: '0.6rem',
                        }}
                      >
                        {card.label}
                      </Typography>
                      {(card as any).subtitle && (
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            color: isDark ? '#555' : '#bbb',
                            fontSize: '0.58rem',
                          }}
                        >
                          {(card as any).subtitle}
                        </Typography>
                      )}
                    </Box>
                  </Paper>
                ));
              })()}
            </Box>
          )}
          <Paper
            elevation={0}
            sx={{
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            {/* Table Header */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '2fr repeat(5, 1fr)',
                gap: 0,
                px: 0,
                py: 0,
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.02)'
                  : 'rgba(0,0,0,0.02)',
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              }}
            >
              <Typography
                variant="caption"
                fontWeight={600}
                sx={{ px: 2, py: 1.2 }}
              >
                {t('argus.performance.transactionName')}
              </Typography>
              <Typography
                variant="caption"
                fontWeight={600}
                sx={{
                  textAlign: 'right',
                  px: 2,
                  py: 1.2,
                  borderLeft: `1px dashed ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                }}
              >
                {t('argus.performance.count')}
              </Typography>
              <Typography
                variant="caption"
                fontWeight={600}
                sx={{
                  textAlign: 'right',
                  px: 2,
                  py: 1.2,
                  borderLeft: `1px dashed ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                }}
              >
                {t('argus.performance.avgDuration')}
              </Typography>
              <Typography
                variant="caption"
                fontWeight={600}
                sx={{
                  textAlign: 'right',
                  px: 2,
                  py: 1.2,
                  borderLeft: `1px dashed ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                }}
              >
                P50
              </Typography>
              <Typography
                variant="caption"
                fontWeight={600}
                sx={{
                  textAlign: 'right',
                  px: 2,
                  py: 1.2,
                  borderLeft: `1px dashed ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                }}
              >
                P95
              </Typography>
              <Typography
                variant="caption"
                fontWeight={600}
                sx={{
                  textAlign: 'right',
                  px: 2,
                  py: 1.2,
                  borderLeft: `1px dashed ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                }}
              >
                {t('argus.performance.errorRate')}
              </Typography>
            </Box>

            {transactions.length === 0 ? (
              <EmptyPlaceholder
                icon={<SpeedIcon sx={{ fontSize: 48 }} />}
                message={t('argus.performance.noTransactions')}
                minHeight={250}
              />
            ) : (
              transactions
                .slice(
                  perfPage * perfRowsPerPage,
                  perfPage * perfRowsPerPage + perfRowsPerPage
                )
                .map((txn, idx) => {
                  const p95Val = Number(txn.p95);
                  const p50Val = Number(txn.p50);
                  const errRate = Number(txn.error_rate);
                  const maxP95 = Math.max(
                    ...transactions.map((t) => Number(t.p95)),
                    1
                  );
                  const { method, path: txnPath } = parseTransaction(txn.name);
                  return (
                    <Box
                      key={`${txn.name}-${idx}`}
                      onClick={() => handleTxnClick(txn.name)}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: '2fr repeat(5, 1fr)',
                        gap: 0,
                        px: 0,
                        py: 0,
                        alignItems: 'stretch',
                        cursor: 'pointer',
                        borderBottom:
                          idx < perfRowsPerPage - 1
                            ? `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`
                            : 'none',
                        transition: 'background 0.15s',
                        '&:hover': {
                          backgroundColor: isDark
                            ? 'rgba(255,255,255,0.02)'
                            : 'rgba(0,0,0,0.015)',
                        },
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          overflow: 'hidden',
                          px: 2,
                          py: 1.2,
                        }}
                      >
                        <Box sx={{ width: 55, flexShrink: 0 }}>
                          <Chip
                            label={method}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              borderRadius: 0.8,
                              width: '100%',
                              backgroundColor: alpha(
                                getMethodColor(method),
                                0.12
                              ),
                              color: getMethodColor(method),
                              border: 'none',
                            }}
                          />
                        </Box>
                        <Typography
                          variant="body2"
                          fontWeight={500}
                          noWrap
                          sx={{ flex: 1 }}
                        >
                          {txnPath}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          px: 2,
                          py: 1.2,
                          borderLeft: `1px dashed ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                        }}
                      >
                        <Typography variant="body2">
                          {formatCompactNumber(Number(txn.count))}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          px: 2,
                          py: 1.2,
                          borderLeft: `1px dashed ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                        }}
                      >
                        <Typography variant="body2">
                          {Number(txn.avg_duration).toFixed(0)}ms
                        </Typography>
                      </Box>
                      {/* P50 with mini bar */}
                      <Box
                        sx={{
                          px: 2,
                          py: 1.2,
                          textAlign: 'right',
                          borderLeft: `1px dashed ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ fontSize: '0.82rem' }}
                        >
                          {p50Val.toFixed(0)}ms
                        </Typography>
                        <Box
                          sx={{
                            height: 3,
                            borderRadius: 2,
                            mt: 0.3,
                            backgroundColor: isDark
                              ? 'rgba(255,255,255,0.04)'
                              : 'rgba(0,0,0,0.04)',
                          }}
                        >
                          <Box
                            sx={{
                              height: '100%',
                              borderRadius: 2,
                              width: `${(p50Val / maxP95) * 100}%`,
                              backgroundColor: '#4caf50',
                              transition: 'width 0.3s',
                            }}
                          />
                        </Box>
                      </Box>
                      {/* P95 with mini bar */}
                      <Box
                        sx={{
                          px: 2,
                          py: 1.2,
                          textAlign: 'right',
                          borderLeft: `1px dashed ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                        }}
                      >
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          sx={{
                            fontSize: '0.82rem',
                            color:
                              p95Val > 3000
                                ? '#f44336'
                                : p95Val > 1000
                                  ? '#ff9800'
                                  : 'inherit',
                          }}
                        >
                          {p95Val.toFixed(0)}ms
                        </Typography>
                        <Box
                          sx={{
                            height: 3,
                            borderRadius: 2,
                            mt: 0.3,
                            backgroundColor: isDark
                              ? 'rgba(255,255,255,0.04)'
                              : 'rgba(0,0,0,0.04)',
                          }}
                        >
                          <Box
                            sx={{
                              height: '100%',
                              borderRadius: 2,
                              width: `${(p95Val / maxP95) * 100}%`,
                              backgroundColor:
                                p95Val > 3000
                                  ? '#f44336'
                                  : p95Val > 1000
                                    ? '#ff9800'
                                    : '#7c4dff',
                              transition: 'width 0.3s',
                            }}
                          />
                        </Box>
                      </Box>
                      {/* Error Rate with bar */}
                      <Box
                        sx={{
                          px: 2,
                          py: 1.2,
                          borderLeft: `1px dashed ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: 1,
                            mb: 0.3,
                          }}
                        >
                          <Box
                            sx={{
                              flex: 1,
                              height: 6,
                              borderRadius: 3,
                              backgroundColor: isDark
                                ? 'rgba(255,255,255,0.04)'
                                : 'rgba(0,0,0,0.04)',
                              overflow: 'hidden',
                            }}
                          >
                            <Box
                              sx={{
                                height: '100%',
                                borderRadius: 3,
                                width: `${Math.min(errRate, 100)}%`,
                                backgroundColor:
                                  errRate > 5
                                    ? '#f44336'
                                    : errRate > 1
                                      ? '#ff9800'
                                      : '#4caf50',
                                transition: 'width 0.3s',
                              }}
                            />
                          </Box>
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            sx={{
                              fontSize: '0.78rem',
                              flexShrink: 0,
                              minWidth: 38,
                              textAlign: 'right',
                              color:
                                errRate > 5
                                  ? '#f44336'
                                  : errRate > 1
                                    ? '#ff9800'
                                    : '#4caf50',
                            }}
                          >
                            {errRate.toFixed(1)}%
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  );
                })
            )}
          </Paper>
          {transactions.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <SimplePagination
                count={transactions.length}
                page={perfPage}
                rowsPerPage={perfRowsPerPage}
                onPageChange={(_, newPage) => setPerfPage(newPage)}
                onRowsPerPageChange={(e) => {
                  setPerfRowsPerPage(Number(e.target.value));
                  setPerfPage(0);
                }}
                rowsPerPageOptions={PERF_VALID_PAGE_SIZES}
                size="small"
              />
            </Box>
          )}
        </PageContentLoader>
      )}
    </Box>
  );
};

const METHOD_COLORS: Record<string, string> = {
  GET: '#4caf50',
  POST: '#2196f3',
  PUT: '#ff9800',
  PATCH: '#7c4dff',
  DELETE: '#f44336',
  HEAD: '#9e9e9e',
  OPTIONS: '#607d8b',
  WS: '#00bcd4',
  CRON: '#e91e63',
  JOB: '#e91e63',
  GRPC: '#ff5722',
  TXN: '#8d6e63',
  FUNC: '#8d6e63',
};
function getMethodColor(method: string): string {
  return METHOD_COLORS[method.toUpperCase()] || '#9e9e9e';
}
function parseTransaction(name: string): { method: string; path: string } {
  // Match any uppercase word at the start (e.g., GET, POST, WS, CRON)
  const match = name.match(/^([A-Z]{2,10})\s+(.+)$/);
  if (match) return { method: match[1].toUpperCase(), path: match[2] };
  return { method: 'TXN', path: name };
}

function formatHour(hourStr: string): string {
  try {
    const d = new Date(hourStr);
    return `${String(d.getHours()).padStart(2, '0')}:00`;
  } catch {
    return hourStr;
  }
}

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  } catch {
    return ts;
  }
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
