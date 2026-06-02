import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Box, Typography, Paper, Button, Chip, IconButton, Tooltip,
  useTheme, alpha, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell,
  FormControl, Select, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Drawer,
} from '@mui/material';
import {
  Search as SearchIcon, Close as CloseIcon,
  BarChart as MetricsIcon, ExpandMore as ExpandMoreIcon,
  TrendingUp as TrendUpIcon, TrendingDown as TrendDownIcon,
  ShowChart as ChartIcon, Bookmark as BookmarkIcon, BookmarkBorder as BookmarkBorderIcon,
  Save as SaveIcon, Delete as DeleteIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PageContentLoader from '@/components/common/PageContentLoader';
import { TableSkeleton, ChartSkeleton } from '@/components/argus/ArgusSkeletons';
import InteractiveTimeSeriesChart from '@/components/argus/InteractiveTimeSeriesChart';
import ArgusFilterBar, { ArgusFilterState, defaultArgusFilterState, argusFilterStateToApiParams } from '@/components/argus/ArgusFilterBar';
import argusService, { ArgusSavedQuery } from '@/services/argusService';
import useArgusUrlState from '@/hooks/useArgusUrlState';
import { useLocation } from 'react-router-dom';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import ExploreActions from '@/components/argus/ExploreActions';
import PageHeader from '@/components/common/PageHeader';
import EditablePageTitle from '@/components/common/EditablePageTitle';

/* ─── Constants ─── */

const METRIC_TYPE_COLORS: Record<string, string> = {
  counter: '#3b82f6',
  gauge: '#10b981',
  distribution: '#8b5cf6',
  set: '#f59e0b',
};

const AGG_OPTIONS = [
  { value: 'avg', label: 'Average' },
  { value: 'sum', label: 'Sum' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
  { value: 'count', label: 'Count' },
];

function formatMetricValue(val: number, unit?: string): string {
  if (val === undefined || val === null) return '—';
  const n = Number(val);
  if (isNaN(n)) return '—';
  if (unit === 'millisecond' || unit === 'ms') return n < 1000 ? `${n.toFixed(1)}ms` : `${(n / 1000).toFixed(2)}s`;
  if (unit === 'byte') return n > 1048576 ? `${(n / 1048576).toFixed(1)}MB` : n > 1024 ? `${(n / 1024).toFixed(1)}KB` : `${n}B`;
  if (unit === 'percent' || unit === '%') return `${n.toFixed(1)}%`;
  if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

/* ─── Metric Time Series Chart ─── */

const MetricChart: React.FC<{
  data: { bucket: string; value: number; group_value?: string }[];
  isDark: boolean;
  onZoom?: (start: string, end: string) => void;
  metricName: string;
  unit?: string;
}> = ({ data, isDark, onZoom, metricName, unit }) => {
  const { t } = useTranslation();

  const { chartData, buckets } = useMemo(() => {
    if (data.length === 0) return { chartData: [], buckets: [] };
    const sorted = [...data].sort((a, b) => a.bucket.localeCompare(b.bucket));
    const mapped = sorted.map(d => {
      const date = new Date(d.bucket);
      const label = date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
      return { label, count: Number(d.value) };
    });
    return { chartData: mapped, buckets: sorted.map(d => d.bucket) };
  }, [data]);

  const handleZoom = (startIndex: number, endIndex: number) => {
    if (onZoom && buckets[startIndex] && buckets[endIndex]) {
      const start = buckets[startIndex] < buckets[endIndex] ? buckets[startIndex] : buckets[endIndex];
      const end = buckets[startIndex] < buckets[endIndex] ? buckets[endIndex] : buckets[startIndex];
      const startDate = new Date(start);
      let endDate = new Date(end);
      if (buckets.length > 1) {
        const gap = new Date(buckets[1]).getTime() - new Date(buckets[0]).getTime();
        endDate = new Date(endDate.getTime() + gap);
      } else {
        endDate = new Date(endDate.getTime() + 3600000);
      }
      onZoom(startDate.toISOString(), endDate.toISOString());
    }
  };

  if (chartData.length === 0) return (
    <Paper elevation={0} sx={{
      mb: 2, p: 2, pt: 1.5, borderRadius: 2,
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
    }}>
      <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, mb: 1, color: 'text.disabled' }}>
        {metricName || t('argus.metrics.noMetricSelected', 'Select a metric')}
      </Typography>
      <Box sx={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled' }}>
          {t('argus.metrics.noData', 'No metric data')}
        </Typography>
      </Box>
    </Paper>
  );

  return (
    <Paper elevation={0} sx={{
      mb: 2, p: 2, pt: 1.5, borderRadius: 2,
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
    }}>
      <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, mb: 1, color: 'text.secondary' }}>
        {metricName} {unit ? `(${unit})` : ''}
      </Typography>
      <Box sx={{ height: 180 }}>
        <InteractiveTimeSeriesChart data={chartData} type="bar" height={180} onZoom={onZoom ? handleZoom : undefined} />
      </Box>
    </Paper>
  );
};

/* ─── Summary Stats Cards ─── */

const SummaryCards: React.FC<{ summary: any; unit?: string; isDark: boolean }> = ({ summary, unit, isDark }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const stats = [
    { label: t('argus.metrics.avg', 'Avg'), value: summary.avg_value, key: 'avg' },
    { label: 'P50', value: summary.p50, key: 'p50' },
    { label: 'P95', value: summary.p95, key: 'p95' },
    { label: 'P99', value: summary.p99, key: 'p99' },
    { label: t('argus.metrics.min', 'Min'), value: summary.min_value, key: 'min' },
    { label: t('argus.metrics.max', 'Max'), value: summary.max_value, key: 'max' },
  ];

  return (
    <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
      {stats.map(s => (
        <Paper key={s.key} elevation={0} sx={{
          flex: '1 1 100px', minWidth: 100, p: 1.5, borderRadius: 2,
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          textAlign: 'center',
        }}>
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', mb: 0.5 }}>
            {s.label}
          </Typography>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'monospace', color: theme.palette.primary.main }}>
            {formatMetricValue(Number(s.value), unit)}
          </Typography>
        </Paper>
      ))}
    </Box>
  );
};

/* ─── Main Component ─── */

const ArgusMetricsExplorerPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const location = useLocation();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

  // ─── URL-driven state ───
  const URL_PARAMS = useMemo(() => ({
    period:  { key: 'period',  default: '24h', storageKey: 'argus-metrics-period' },
    start:   { key: 'start',   default: '' },
    end:     { key: 'end',     default: '' },
    metric:  { key: 'metric',  default: '' },
    agg:     { key: 'agg',     default: 'avg' },
    groupBy: { key: 'groupBy', default: '' },
    queryId: { key: 'queryId', default: '' },
  }), []);
  const [urlState, setUrlState] = useArgusUrlState(URL_PARAMS);

  const selectedMetric = urlState.metric;
  const selectedAgg = urlState.agg;
  const selectedGroupBy = urlState.groupBy;

  // Derive filters
  const filters = useMemo<ArgusFilterState>(
    () => {
      if (urlState.period === 'custom' && urlState.start && urlState.end) {
        const base = defaultArgusFilterState('custom');
        base.dateRange = { type: 'custom', start: new Date(urlState.start), end: new Date(urlState.end) };
        return base;
      }
      return defaultArgusFilterState(urlState.period);
    },
    [urlState.period, urlState.start, urlState.end],
  );

  // Search
  const [search, setSearch] = useState('');
  
  // Editable Query Name
  const defaultQueryName = t('argus.metrics.newQuery', 'New Metrics Query');
  const [queryName, setQueryName] = useState((location.state as any)?.queryName || defaultQueryName);

  // Saved Queries State
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [savedQueries, setSavedQueries] = useState<ArgusSavedQuery[]>([]);
  const [savedPanelOpen, setSavedPanelOpen] = useState(false);
  const [currentQueryId, setCurrentQueryId] = useState<number | null>(null);

  // Sync URL queryId to state
  useEffect(() => {
    if (urlState.queryId && savedQueries.length > 0) {
      const qId = parseInt(urlState.queryId, 10);
      const matched = savedQueries.find(q => q.id === qId);
      if (matched && currentQueryId !== qId) {
        setCurrentQueryId(matched.id);
        setQueryName(matched.name);
      }
    }
  }, [urlState.queryId, savedQueries, currentQueryId]);

  // ─── Data ───
  const [metricNames, setMetricNames] = useState<any[]>([]);
  const [queryResult, setQueryResult] = useState<{ timeSeries: any[]; summary: any } | null>(null);
  const [loading, setLoading] = useState(false);
  const [queryLoading, setQueryLoading] = useState(false);

  const currentPeriod = useMemo(() => {
    if (filters.dateRange.type === 'preset' && filters.dateRange.preset) return filters.dateRange.preset;
    return '24h';
  }, [filters.dateRange]);

  // ─── Fetch ───
  const fetchMetricNames = useCallback(async () => {
    setLoading(true);
    try {
      const data = await argusService.getMetricNames(projectId, currentPeriod);
      setMetricNames(data);
    } catch (err) { console.error('Failed to fetch metric names', err); }
    finally { setLoading(false); }
  }, [projectId, currentPeriod]);

  const fetchMetricQuery = useCallback(async (metricName?: string) => {
    const name = metricName || selectedMetric;
    if (!name) return;
    setQueryLoading(true);
    try {
      const apiParams = argusFilterStateToApiParams(filters);
      const data = await argusService.queryMetric(projectId, {
        name,
        period: apiParams.period || currentPeriod,
        agg: selectedAgg,
        groupBy: selectedGroupBy || undefined,
        start: apiParams.start,
        end: apiParams.end,
      });
      setQueryResult(data);
    } catch (err) { console.error('Failed to query metric', err); }
    finally { setQueryLoading(false); }
  }, [projectId, filters, currentPeriod, selectedMetric, selectedAgg, selectedGroupBy]);

  useEffect(() => {
    fetchMetricNames();
    argusService.listSavedQueries(projectId, 'metrics' as any).then(setSavedQueries).catch(() => setSavedQueries([]));
  }, [fetchMetricNames, projectId]);

  useEffect(() => {
    if (selectedMetric) fetchMetricQuery();
  }, [selectedMetric, selectedAgg, selectedGroupBy, fetchMetricQuery]);

  // ─── Handlers ───
  const handleFilterChange = (newFilters: ArgusFilterState) => {
    if (newFilters.dateRange.type === 'preset' && newFilters.dateRange.preset) {
      setUrlState({ period: newFilters.dateRange.preset, start: '', end: '' });
    } else if (newFilters.dateRange.type === 'custom' && newFilters.dateRange.start && newFilters.dateRange.end) {
      setUrlState({ period: 'custom', start: newFilters.dateRange.start.toISOString(), end: newFilters.dateRange.end.toISOString() });
    }
  };

  const handleZoom = useCallback((start: string, end: string) => {
    setUrlState({ period: 'custom', start, end });
  }, [setUrlState]);

  const handleSelectMetric = (name: string) => {
    setUrlState({ metric: name });
  };

  const handleSaveQuery = async () => {
    if (!saveName.trim()) return;
    try {
      const res = await argusService.createSavedQuery(projectId, {
        name: saveName.trim(),
        query_config: { metric: selectedMetric, agg: selectedAgg, period: currentPeriod, groupBy: selectedGroupBy },
        display_type: 'chart',
        query_type: 'metrics' as any,
      });
      const updated = await argusService.listSavedQueries(projectId, 'metrics' as any);
      setSavedQueries(updated);
      setQueryName(saveName.trim());
      if (res.id) setCurrentQueryId(res.id);
      setSaveDialogOpen(false);
      setSaveName('');
    } catch (err) { console.error('Failed to save metrics query:', err); }
  };

  const handleRename = async (newName: string) => {
    setQueryName(newName);
    if (currentQueryId) {
      try {
        await argusService.updateSavedQuery(projectId, currentQueryId, { name: newName });
        const updated = await argusService.listSavedQueries(projectId, 'metrics' as any);
        setSavedQueries(updated);
      } catch (err) { console.error('Failed to rename query:', err); }
    }
  };

  const handleDeleteSavedQuery = async (id: number) => {
    try {
      await argusService.deleteSavedQuery(projectId, id);
      setSavedQueries(prev => prev.filter(q => q.id !== id));
      if (currentQueryId === id) setCurrentQueryId(null);
    } catch (err) { console.error('Failed to delete saved query:', err); }
  };

  const handleLoadSavedQuery = (sq: ArgusSavedQuery) => {
    const cfg = typeof sq.query_config === 'string' ? JSON.parse(sq.query_config) : sq.query_config;
    if (cfg.metric !== undefined) setUrlState({ metric: cfg.metric });
    if (cfg.agg !== undefined) setUrlState({ agg: cfg.agg });
    if (cfg.period) setUrlState({ period: cfg.period });
    if (cfg.groupBy !== undefined) setUrlState({ groupBy: cfg.groupBy });
    setQueryName(sq.name);
    setCurrentQueryId(sq.id);
    setSavedPanelOpen(false);
  };

  const selectedMetricInfo = metricNames.find(m => m.name === selectedMetric);

  // Filter metric list
  const filteredMetrics = useMemo(() => {
    if (!search.trim()) return metricNames;
    const q = search.toLowerCase();
    return metricNames.filter(m => m.name.toLowerCase().includes(q));
  }, [metricNames, search]);

  /* ═══ RENDER ═══ */
  return (
    <Box>
      <PageHeader
        icon={<MetricsIcon />}
        title={<EditablePageTitle value={queryName} onChange={handleRename} placeholder={defaultQueryName} />}
        subtitle={t('argus.metrics.subtitle', 'Explore application metrics and custom counters')}
        enableAutoBack
        actions={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Tooltip title={t('argus.metrics.savedQueries', 'Saved Queries')}>
              <IconButton size="small" onClick={() => setSavedPanelOpen(true)}
                sx={{ color: savedQueries.length > 0 ? theme.palette.primary.main : 'text.secondary' }}>
                {savedQueries.length > 0 ? <BookmarkIcon sx={{ fontSize: 20 }} /> : <BookmarkBorderIcon sx={{ fontSize: 20 }} />}
              </IconButton>
            </Tooltip>
            <Button
              size="small" variant="outlined" startIcon={<SaveIcon sx={{ fontSize: 15 }} />}
              onClick={() => { setSaveName(queryName === defaultQueryName ? '' : queryName); setSaveDialogOpen(true); }}
              sx={{
                textTransform: 'none', fontSize: '0.75rem', fontWeight: 600,
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                borderRadius: '6px',
              }}
            >
              {t('argus.metrics.saveAs', 'Save as...')}
            </Button>
            <ExploreActions
              dataset="metrics"
              projectId={projectId}
              queryContext={{ search: selectedMetric, period: currentPeriod }}
            />
          </Box>
        }
      />

      <ArgusFilterBar
        projectId={projectId}
        value={filters}
        onChange={handleFilterChange}
        onRefresh={() => { fetchMetricNames(); if (selectedMetric) fetchMetricQuery(); }}
        loading={loading || queryLoading}
        hideFilters={['browser', 'os']}
      />

      <Box sx={{ display: 'flex', gap: 2 }}>
        {/* ═══ Left: Metric List ═══ */}
        <Paper elevation={0} sx={{
          width: 280, flexShrink: 0, borderRadius: 2, overflow: 'hidden',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          maxHeight: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column',
        }}>
          <Box sx={{
            p: 1.5, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}>
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0.5,
              px: 1, py: 0.3, borderRadius: '6px',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#fff',
            }}>
              <SearchIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
              <Box component="input" value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                placeholder={t('argus.metrics.searchMetrics', 'Search metrics...')}
                style={{
                  flex: 1, border: 'none', outline: 'none', backgroundColor: 'transparent',
                  color: 'inherit', fontFamily: 'monospace', fontSize: '0.75rem', padding: '4px',
                }}
              />
              {search && (
                <IconButton size="small" onClick={() => setSearch('')} sx={{ p: 0.2 }}>
                  <CloseIcon sx={{ fontSize: 12 }} />
                </IconButton>
              )}
            </Box>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            <PageContentLoader loading={loading} skeleton={<TableSkeleton />}>
              {filteredMetrics.length > 0 ? (
                filteredMetrics.map((m, idx) => (
                  <Box key={idx}
                    onClick={() => handleSelectMetric(m.name)}
                    sx={{
                      px: 1.5, py: 1, cursor: 'pointer', transition: 'all 0.15s',
                      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                      backgroundColor: selectedMetric === m.name
                        ? alpha(theme.palette.primary.main, isDark ? 0.15 : 0.08)
                        : 'transparent',
                      borderLeft: selectedMetric === m.name
                        ? `3px solid ${theme.palette.primary.main}`
                        : '3px solid transparent',
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.04),
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.3 }}>
                      <Box sx={{
                        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                        bgcolor: METRIC_TYPE_COLORS[m.metric_type] || '#6b7280',
                      }} />
                      <Typography sx={{
                        fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 600,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        color: selectedMetric === m.name ? theme.palette.primary.main : 'text.primary',
                      }}>
                        {m.name}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', ml: 1.8 }}>
                      <Chip label={m.metric_type} size="small" sx={{
                        height: 16, fontSize: '0.6rem', fontFamily: 'monospace',
                        backgroundColor: alpha(METRIC_TYPE_COLORS[m.metric_type] || '#6b7280', 0.12),
                        color: METRIC_TYPE_COLORS[m.metric_type] || '#6b7280',
                        borderRadius: '3px',
                      }} />
                      {m.unit && (
                        <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', fontFamily: 'monospace' }}>
                          {m.unit}
                        </Typography>
                      )}
                      <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', ml: 'auto' }}>
                        {Number(m.total_points).toLocaleString()} pts
                      </Typography>
                    </Box>
                  </Box>
                ))
              ) : (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '0.8rem', color: 'text.disabled' }}>
                    {t('argus.metrics.noMetrics', 'No metrics found')}
                  </Typography>
                </Box>
              )}
            </PageContentLoader>
          </Box>
        </Paper>

        {/* ═══ Right: Metric Detail ═══ */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {selectedMetric ? (
            <>
              {/* Controls */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <ChartIcon sx={{ fontSize: 20, color: theme.palette.primary.main }} />
                <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, fontFamily: 'monospace' }}>
                  {selectedMetric}
                </Typography>
                {selectedMetricInfo?.unit && (
                  <Chip label={selectedMetricInfo.unit} size="small" sx={{
                    height: 20, fontSize: '0.68rem', borderRadius: '4px',
                  }} />
                )}
                <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.secondary' }}>
                    {t('argus.metrics.aggregation', 'Aggregation')}:
                  </Typography>
                  <FormControl size="small">
                    <Select
                      value={selectedAgg}
                      onChange={(e) => setUrlState({ agg: e.target.value as string })}
                      sx={{ height: 28, fontSize: '0.75rem', fontWeight: 700, minWidth: 90 }}
                    >
                      {AGG_OPTIONS.map(o => (
                        <MenuItem key={o.value} value={o.value} sx={{ fontSize: '0.75rem' }}>
                          {o.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.secondary' }}>
                    {t('argus.metrics.groupBy', 'Group by')}:
                  </Typography>
                  <FormControl size="small">
                    <Select
                      value={selectedGroupBy}
                      onChange={(e) => setUrlState({ groupBy: e.target.value as string })}
                      sx={{ height: 28, fontSize: '0.75rem', fontWeight: 700, minWidth: 110 }}
                      displayEmpty
                    >
                      <MenuItem value="" sx={{ fontSize: '0.75rem' }}>{t('argus.metrics.none', 'None')}</MenuItem>
                      <MenuItem value="environment" sx={{ fontSize: '0.75rem' }}>Environment</MenuItem>
                      <MenuItem value="release" sx={{ fontSize: '0.75rem' }}>Release</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Box>

              {/* Summary Stats */}
              {queryResult?.summary && (
                <SummaryCards summary={queryResult.summary} unit={selectedMetricInfo?.unit} isDark={isDark} />
              )}

              {/* Chart */}
              <PageContentLoader loading={queryLoading} skeleton={<ChartSkeleton />}>
                <MetricChart
                  data={queryResult?.timeSeries || []}
                  isDark={isDark}
                  onZoom={handleZoom}
                  metricName={selectedMetric}
                  unit={selectedMetricInfo?.unit}
                />
              </PageContentLoader>

              {/* Time series table */}
              {queryResult?.timeSeries && queryResult.timeSeries.length > 0 && (
                <Paper elevation={0} sx={{
                  borderRadius: 2, overflow: 'hidden',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                }}>
                  <Table size="small" sx={{ '& td, & th': { borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' } }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', py: 1 }}>
                          {t('argus.metrics.timestamp', 'TIMESTAMP')}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', py: 1 }}>
                          {t('argus.metrics.value', 'VALUE')}
                        </TableCell>
                        {queryResult.timeSeries[0]?.group_value !== undefined && (
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', py: 1 }}>
                            {selectedGroupBy.toUpperCase()}
                          </TableCell>
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {queryResult.timeSeries.slice(0, 50).map((row, idx) => (
                        <TableRow key={idx} hover>
                          <TableCell sx={{ py: 0.6 }}>
                            <Typography sx={{ fontSize: '0.73rem', fontFamily: 'monospace', color: 'text.secondary' }}>
                              {new Date(row.bucket).toLocaleString('en-US', {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
                              })}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 0.6 }}>
                            <Typography sx={{ fontSize: '0.73rem', fontFamily: 'monospace', fontWeight: 600 }}>
                              {formatMetricValue(Number(row.value), selectedMetricInfo?.unit)}
                            </Typography>
                          </TableCell>
                          {row.group_value !== undefined && (
                            <TableCell sx={{ py: 0.6 }}>
                              <Typography sx={{ fontSize: '0.73rem', fontFamily: 'monospace' }}>
                                {row.group_value}
                              </Typography>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              )}
            </>
          ) : (
            <Paper elevation={0} sx={{
              borderRadius: 2, p: 6, textAlign: 'center',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            }}>
              <MetricsIcon sx={{ fontSize: 56, color: alpha(theme.palette.primary.main, 0.15), mb: 1.5 }} />
              <Typography sx={{ fontSize: '1rem', fontWeight: 600, mb: 0.5 }}>
                {t('argus.metrics.selectMetric', 'Select a Metric')}
              </Typography>
              <Typography color="text.disabled" sx={{ fontSize: '0.82rem' }}>
                {t('argus.metrics.selectMetricDesc', 'Choose a metric from the sidebar to view its time series, aggregations, and summary statistics.')}
              </Typography>
            </Paper>
          )}
        </Box>
      </Box>

      {/* Save Query Dialog */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 2.5 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem', pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {t('argus.metrics.saveQuery', 'Save Metric Query')}
          <IconButton size="small" onClick={() => setSaveDialogOpen(false)}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth size="small" autoFocus
            label={t('argus.discover.queryName', 'Query Name')}
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveQuery(); }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSaveDialogOpen(false)} sx={{ textTransform: 'none' }}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button variant="contained" onClick={handleSaveQuery} disabled={!saveName.trim()}
            sx={{ textTransform: 'none', fontWeight: 700 }}>
            {t('common.save', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Saved Queries Panel */}
      <Drawer anchor="right" open={savedPanelOpen} onClose={() => setSavedPanelOpen(false)}
        PaperProps={{ sx: { width: 340, p: 2 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
            {t('argus.metrics.savedQueries', 'Saved Metric Queries')}
          </Typography>
          <IconButton size="small" onClick={() => setSavedPanelOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        {savedQueries.length === 0 ? (
          <Typography sx={{ color: 'text.disabled', fontSize: '0.82rem', textAlign: 'center', py: 4 }}>
            {t('argus.metrics.noSavedQueries', 'No saved metric queries yet')}
          </Typography>
        ) : (
          savedQueries.map((sq) => (
            <Paper key={sq.id} elevation={0} sx={{
              p: 1.5, mb: 1, borderRadius: 2,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
              cursor: 'pointer',
              '&:hover': { borderColor: theme.palette.primary.main, bgcolor: alpha(theme.palette.primary.main, 0.02) },
              display: 'flex', alignItems: 'center', gap: 1,
            }}>
              <Box sx={{ flex: 1, minWidth: 0 }} onClick={() => handleLoadSavedQuery(sq)}>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sq.name}
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
                  {sq.created_by} · {new Date(sq.created_at).toLocaleDateString()}
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => handleDeleteSavedQuery(sq.id)}
                sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
                <DeleteIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Paper>
          ))
        )}
      </Drawer>
    </Box>
  );
};

export default ArgusMetricsExplorerPage;
