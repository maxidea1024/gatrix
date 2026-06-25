import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useArgusUrlState from '@/hooks/useArgusUrlState';
import { Box, useTheme } from '@mui/material';
import { Speed as SpeedIcon } from '@mui/icons-material';
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
import { useTranslation } from 'react-i18next';
import PageContentLoader from '@/components/common/PageContentLoader';
import { TableSkeleton } from '@/components/argus/ArgusSkeletons';
import PageHeader from '@/components/common/PageHeader';
import argusService, {
  ArgusTransaction,
  ArgusTransactionDetail,
  ArgusTraceDetail,
} from '@/services/argusService';
import TraceWaterfall from '@/components/argus/TraceWaterfall';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import ArgusFilterBar, {
  ArgusFilterState,
  defaultArgusFilterState,
} from '@/components/argus/ArgusFilterBar';
import { dateRangeToApiParams as argusDateRangeToApiParams } from '@/components/common/DateRangeSelector';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import FilterChipSelect from '@/components/common/FilterChipSelect';
import PerformanceDetailView from './components/PerformanceDetailView';
import PerformanceTransactionTable from './components/PerformanceTransactionTable';

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

  // Derive ArgusFilterState from URL period
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
  const [detail, setDetail] = useState<ArgusTransactionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(!!urlState.txn);

  // Trace waterfall state
  const [traceData, setTraceData] = useState<ArgusTraceDetail | null>(null);
  const [traceLoading, setTraceLoading] = useState(!!urlState.trace);
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

  // ─── Data Fetch ───
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
      if (viewMode !== 'trace') setUrlState({ view: 'trace' });
      fetchTrace(urlState.trace);
    } else if (urlState.txn) {
      if (viewMode !== 'detail') setUrlState({ view: 'detail' });
      fetchDetail(urlState.txn);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  // ─── Navigation Handlers ───
  const handleTxnClick = useCallback(
    (txnName: string) => {
      setDetailLoading(true);
      setUrlState({ view: 'detail', txn: txnName, trace: '' });
      fetchDetail(txnName);
    },
    [setUrlState, fetchDetail]
  );

  const handleBack = useCallback(() => {
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
  }, [viewMode, selectedTxn, location.state, navigate, setUrlState]);

  const handleFilterChange = useCallback(
    (newFilters: ArgusFilterState) => {
      setFilters(newFilters);
      if (
        newFilters.dateRange.type === 'preset' &&
        newFilters.dateRange.preset
      ) {
        setUrlState({ period: newFilters.dateRange.preset });
      }
      if (selectedTxn && viewMode === 'detail') fetchDetail(selectedTxn);
    },
    [selectedTxn, viewMode, fetchDetail, setUrlState]
  );

  const handleSortChange = useCallback(
    (newSort: string) => {
      setUrlState({ sort: newSort });
    },
    [setUrlState]
  );

  const handleTraceClick = useCallback(
    (traceId: string) => {
      setUrlState({ view: 'trace', trace: traceId });
      fetchTrace(traceId);
    },
    [setUrlState, fetchTrace]
  );

  // ─── Breadcrumbs ───
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
  }, [viewMode, t, selectedTxn, urlState.txn, urlState.trace, traceData]);

  // Stable callback handlers
  const handleSortOpen = useCallback(
    (e: React.MouseEvent<HTMLElement>) => setSortAnchor(e.currentTarget),
    []
  );
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
      />

      {/* Filter Bar + Sort – hidden in trace waterfall view since filters don't apply */}
      {viewMode !== 'trace' && (
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
      )}

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
        <PerformanceDetailView
          detail={detail}
          detailLoading={detailLoading}
          projectId={projectId}
          onTraceClick={handleTraceClick}
        />
      )}

      {/* === TRANSACTION LIST === */}
      {viewMode === 'list' && (
        <PerformanceTransactionTable
          transactions={transactions}
          loading={loading}
          onTxnClick={handleTxnClick}
        />
      )}
    </Box>
  );
};

export default ArgusPerformancePage;
