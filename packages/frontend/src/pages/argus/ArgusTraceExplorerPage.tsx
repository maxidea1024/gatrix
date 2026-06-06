import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  IconButton,
  Tooltip,
  useTheme,
  alpha,
  CircularProgress,
  Popover,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  FormControl,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Drawer,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  Timeline as TraceIcon,
  ExpandMore as ExpandMoreIcon,
  FilterList as FilterIcon,
  ArrowDownward as SortDescIcon,
  ArrowUpward as SortAscIcon,
  ViewColumn as ViewIcon,
  Terminal as LogsIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import PageContentLoader from '@/components/common/PageContentLoader';
import { TableSkeleton } from '@/components/argus/ArgusSkeletons';
import InteractiveTimeSeriesChart from '@/components/argus/InteractiveTimeSeriesChart';
import ArgusFilterBar, {
  ArgusFilterState,
  defaultArgusFilterState,
  argusFilterStateToApiParams,
} from '@/components/argus/ArgusFilterBar';
import ArgusQueryBuilder from '@/components/argus/ArgusQueryBuilder';
import SegmentedTabs from '@/components/common/SegmentedTabs';
import PageHeader from '@/components/common/PageHeader';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import EditablePageTitle from '@/components/common/EditablePageTitle';
import FeatureSwitch from '@/components/common/FeatureSwitch';
import { CopyButton } from '@/components/common/CopyButton';
import argusService, { ArgusSavedQuery } from '@/services/argusService';
import useArgusUrlState from '@/hooks/useArgusUrlState';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { formatWith } from '@/utils/dateFormat';
import { useNavigate, useLocation } from 'react-router-dom';
import ExploreActions from '@/components/argus/ExploreActions';

/* ─── Constants ─── */

const OP_COLORS: Record<string, string> = {
  db: '#8b5cf6',
  'db.query': '#8b5cf6',
  http: '#3b82f6',
  'http.client': '#3b82f6',
  'http.server': '#60a5fa',
  cache: '#f59e0b',
  queue: '#ef4444',
  grpc: '#10b981',
  resource: '#6366f1',
  browser: '#ec4899',
  ui: '#f97316',
  navigation: '#14b8a6',
  serialize: '#a855f7',
  middleware: '#06b6d4',
};

function getOpColor(op: string): string {
  return OP_COLORS[op?.toLowerCase()] || '#6b7280';
}

function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/* ─── Volume Chart ─── */

const SpanVolumeChart: React.FC<{
  data: { bucket: string; op: string; count: number }[];
  isDark: boolean;
  onZoom?: (start: string, end: string) => void;
}> = ({ data, isDark, onZoom }) => {
  const { t } = useTranslation();

  const { chartData, buckets } = useMemo(() => {
    if (data.length === 0) return { chartData: [], buckets: [] };
    const bucketMap = new Map<string, number>();
    data.forEach((p) => {
      const count = Number(p.count) || 0;
      bucketMap.set(p.bucket, (bucketMap.get(p.bucket) || 0) + count);
    });
    const sorted = [...bucketMap.entries()].sort((a, b) =>
      a[0].localeCompare(b[0])
    );
    const mapped = sorted.map(([b, count]) => {
      const d = new Date(b);
      const label = d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      return { label, count };
    });
    return { chartData: mapped, buckets: sorted.map(([b]) => b) };
  }, [data]);

  const handleZoom = (startIndex: number, endIndex: number) => {
    if (onZoom && buckets[startIndex] && buckets[endIndex]) {
      const start =
        buckets[startIndex] < buckets[endIndex]
          ? buckets[startIndex]
          : buckets[endIndex];
      const end =
        buckets[startIndex] < buckets[endIndex]
          ? buckets[endIndex]
          : buckets[startIndex];
      const startDate = new Date(start);
      let endDate = new Date(end);
      if (buckets.length > 1) {
        const gap =
          new Date(buckets[1]).getTime() - new Date(buckets[0]).getTime();
        endDate = new Date(endDate.getTime() + gap);
      } else {
        endDate = new Date(endDate.getTime() + 3600000);
      }
      onZoom(startDate.toISOString(), endDate.toISOString());
    }
  };

  if (chartData.length === 0)
    return (
      <EmptyPlaceholder
        message={t('argus.traces.noSpanData')}
        minHeight={130}
      />
    );

  return (
    <Paper
      elevation={0}
      sx={{
        mb: 2,
        p: 2,
        pt: 1.5,
        borderRadius: 2,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      }}
    >
      <Typography
        sx={{
          fontSize: '0.78rem',
          fontWeight: 700,
          mb: 1,
          color: 'text.secondary',
        }}
      >
        count(spans)
      </Typography>
      <Box sx={{ height: 130 }}>
        <InteractiveTimeSeriesChart
          data={chartData}
          type="bar"
          height={130}
          onZoom={onZoom ? handleZoom : undefined}
        />
      </Box>
    </Paper>
  );
};

/* ─── Main Component ─── */

const ArgusTraceExplorerPage: React.FC = () => {
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
      period: {
        key: 'period',
        default: '14d',
        storageKey: 'argus-traces-period',
      },
      start: { key: 'start', default: '' },
      end: { key: 'end', default: '' },
      q: { key: 'q', default: '' },
      tab: { key: 'tab', default: '0' },
      groupBy: { key: 'groupBy', default: 'op' },
      orderBy: { key: 'orderBy', default: '-duration' },
      queryId: { key: 'queryId', default: '' },
    }),
    []
  );
  const [urlState, setUrlState] = useArgusUrlState(URL_PARAMS);

  const activeTab = parseInt(urlState.tab, 10) || 0;
  const aggGroupBy = urlState.groupBy;
  const orderBy = urlState.orderBy;
  const orderDir: 'asc' | 'desc' = orderBy.startsWith('-') ? 'desc' : 'asc';
  const orderCol = orderBy.replace(/^-/, '');

  // Derive filters
  const [filters, setFilters] = useState<ArgusFilterState>(() => {
    if (urlState.period === 'custom' && urlState.start && urlState.end) {
      const base = defaultArgusFilterState('custom');
      base.dateRange = {
        type: 'custom',
        start: new Date(urlState.start),
        end: new Date(urlState.end),
      };
      return base;
    }
    return defaultArgusFilterState(urlState.period);
  });

  useEffect(() => {
    setFilters((prev) => {
      if (urlState.period === 'custom' && urlState.start && urlState.end) {
        return {
          ...prev,
          dateRange: {
            type: 'custom',
            start: new Date(urlState.start),
            end: new Date(urlState.end),
          },
        };
      }
      return {
        ...prev,
        dateRange: { type: 'preset', preset: urlState.period },
      };
    });
  }, [urlState.period, urlState.start, urlState.end]);

  // Search
  const [search, setSearch] = useState<string>(urlState.q || '');
  useEffect(() => {
    setSearch(urlState.q || '');
  }, [urlState.q]);

  // ─── Data State ───
  const [spans, setSpans] = useState<any[]>([]);
  const [traceSamples, setTraceSamples] = useState<any[]>([]);
  const [volume, setVolume] = useState<
    { bucket: string; op: string; count: number }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [tags, setTags] = useState<{ op: any[]; status: any[]; domain: any[] }>(
    { op: [], status: [], domain: [] }
  );

  // Aggregates
  const [aggData, setAggData] = useState<{
    groupBy: string;
    topValues: {
      group_value: string;
      count: number;
      avg_duration?: number;
      p95_duration?: number;
    }[];
    timeSeries: { bucket: string; group_value: string; count: number }[];
  } | null>(null);
  const [aggLoading, setAggLoading] = useState(false);

  // Search state
  const [searchFocused, setSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Editable Query Name
  const defaultQueryName = t('argus.traces.newQuery', 'New Trace Query');
  const [queryName, setQueryName] = useState(
    (location.state as any)?.queryName || defaultQueryName
  );

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
      const matched = savedQueries.find((q) => q.id === qId);
      if (matched && currentQueryId !== qId) {
        setCurrentQueryId(matched.id);
        setQueryName(matched.name);
      }
    }
  }, [urlState.queryId, savedQueries, currentQueryId]);

  // Search UI
  const [builderAnchorEl, setBuilderAnchorEl] = useState<HTMLElement | null>(
    null
  );

  const currentPeriod = useMemo(() => {
    if (filters.dateRange.type === 'preset' && filters.dateRange.preset)
      return filters.dateRange.preset;
    return '24h';
  }, [filters.dateRange]);

  // ─── Fetch ───
  const fetchSpans = useCallback(async () => {
    setLoading(true);
    try {
      const apiParams = argusFilterStateToApiParams(filters);
      const data = await argusService.searchSpans(projectId, {
        period: apiParams.period || currentPeriod,
        search: search.trim() || undefined,
        orderBy,
        limit: 50,
        start: apiParams.start,
        end: apiParams.end,
      });
      setSpans(data);
    } catch (err) {
      console.error('Failed to search spans', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, filters, currentPeriod, search, orderBy]);

  const fetchTraceSamples = useCallback(async () => {
    setLoading(true);
    try {
      const apiParams = argusFilterStateToApiParams(filters);
      const data = await argusService.getTraceSamples(projectId, {
        period: apiParams.period || currentPeriod,
        search: search.trim() || undefined,
        limit: 25,
        start: apiParams.start,
        end: apiParams.end,
      });
      setTraceSamples(data);
    } catch (err) {
      console.error('Failed to get trace samples', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, filters, currentPeriod, search]);

  const fetchVolume = useCallback(async () => {
    try {
      const apiParams = argusFilterStateToApiParams(filters);
      const data = await argusService.getSpanVolume(projectId, {
        period: apiParams.period || currentPeriod,
        search: search.trim() || undefined,
        start: apiParams.start,
        end: apiParams.end,
      });
      setVolume(data);
    } catch (err) {
      console.error('Failed to fetch span volume', err);
    }
  }, [projectId, filters, currentPeriod, search]);

  const fetchTags = useCallback(async () => {
    try {
      const data = await argusService.getSpanTags(projectId, currentPeriod);
      setTags(data);
    } catch (err) {
      console.error('Failed to fetch span tags', err);
    }
  }, [projectId, currentPeriod]);

  const fetchAggregates = useCallback(
    async (groupByVal?: string) => {
      setAggLoading(true);
      try {
        const apiParams = argusFilterStateToApiParams(filters);
        const data = await argusService.getSpanAggregates(projectId, {
          period: apiParams.period || currentPeriod,
          groupBy: groupByVal || aggGroupBy,
          start: apiParams.start,
          end: apiParams.end,
        });
        setAggData(data);
      } catch (err) {
        console.error('Failed to fetch span aggregates', err);
      } finally {
        setAggLoading(false);
      }
    },
    [projectId, filters, currentPeriod, aggGroupBy]
  );

  const fetchAll = useCallback(() => {
    if (activeTab === 0) fetchSpans();
    else if (activeTab === 1) fetchTraceSamples();
    else if (activeTab === 2) fetchAggregates();
    fetchVolume();
  }, [activeTab, fetchSpans, fetchTraceSamples, fetchAggregates, fetchVolume]);

  useEffect(() => {
    fetchAll();
    fetchTags();
    argusService
      .listSavedQueries(projectId, 'traces')
      .then(setSavedQueries)
      .catch(() => setSavedQueries([]));
  }, [fetchAll, fetchTags, projectId]);

  // ─── Handlers ───
  const handleSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setUrlState({ q: search.trim() });
      setSearchFocused(false);
      setTimeout(fetchAll, 10);
    }
  };

  const handleFilterChange = (newFilters: ArgusFilterState) => {
    setFilters(newFilters);
    if (newFilters.dateRange.type === 'preset' && newFilters.dateRange.preset) {
      setUrlState({ period: newFilters.dateRange.preset, start: '', end: '' });
    } else if (
      newFilters.dateRange.type === 'custom' &&
      newFilters.dateRange.start &&
      newFilters.dateRange.end
    ) {
      setUrlState({
        period: 'custom',
        start: newFilters.dateRange.start.toISOString(),
        end: newFilters.dateRange.end.toISOString(),
      });
    }
  };

  const handleZoom = useCallback(
    (start: string, end: string) => {
      setUrlState({ period: 'custom', start, end });
    },
    [setUrlState]
  );

  const handleColumnSort = useCallback(
    (col: string) => {
      if (orderCol === col) {
        setUrlState({ orderBy: orderDir === 'desc' ? col : `-${col}` });
      } else {
        setUrlState({ orderBy: `-${col}` });
      }
    },
    [orderCol, orderDir, setUrlState]
  );

  const handleSaveQuery = async () => {
    if (!saveName.trim()) return;
    try {
      const res = await argusService.createSavedQuery(projectId, {
        name: saveName.trim(),
        query_config: {
          search,
          period: currentPeriod,
          tab: activeTab,
          groupBy: aggGroupBy,
        },
        display_type: 'table',
        query_type: 'traces',
      });
      const updated = await argusService.listSavedQueries(
        projectId,
        'traces'
      );
      setSavedQueries(updated);
      setQueryName(saveName.trim());
      if (res.id) setCurrentQueryId(res.id);
      setSaveDialogOpen(false);
      setSaveName('');
    } catch (err) {
      console.error('Failed to save trace query:', err);
    }
  };

  const handleRename = async (newName: string) => {
    setQueryName(newName);
    if (currentQueryId) {
      try {
        await argusService.updateSavedQuery(projectId, currentQueryId, {
          name: newName,
        });
        const updated = await argusService.listSavedQueries(
          projectId,
          'traces'
        );
        setSavedQueries(updated);
      } catch (err) {
        console.error('Failed to rename query:', err);
      }
    }
  };

  const handleDeleteSavedQuery = async (id: number) => {
    try {
      await argusService.deleteSavedQuery(projectId, id);
      setSavedQueries((prev) => prev.filter((q) => q.id !== id));
      if (currentQueryId === id) setCurrentQueryId(null);
    } catch (err) {
      console.error('Failed to delete saved query:', err);
    }
  };

  const handleLoadSavedQuery = (sq: ArgusSavedQuery) => {
    const cfg =
      typeof sq.query_config === 'string'
        ? JSON.parse(sq.query_config)
        : sq.query_config;
    if (cfg.search !== undefined) {
      setSearch(cfg.search);
      setUrlState({ q: cfg.search });
    }
    if (cfg.period) setUrlState({ period: cfg.period });
    if (cfg.tab !== undefined) setUrlState({ tab: String(cfg.tab) });
    if (cfg.groupBy) setUrlState({ groupBy: cfg.groupBy });
    setQueryName(sq.name);
    setCurrentQueryId(sq.id);
    setSavedPanelOpen(false);
  };

  const handleTabChange = (newTab: string) => {
    setUrlState({ tab: newTab });
  };

  const addSearchTag = (key: string, value: string) => {
    const appendStr = `${key}:"${value}"`;
    const finalStr =
      (search.trim() ? search.trim() + ' ' : '') + appendStr + ' ';
    setSearch(finalStr);
    setUrlState({ q: finalStr.trim() });
    setSearchFocused(false);
  };

  const SPAN_COLUMNS = [
    'timestamp',
    'op',
    'description',
    'duration',
    'status',
    'trace_id',
  ];

  const spansTableContent = useMemo(
    () => (
      <PageContentLoader loading={loading} skeleton={<TableSkeleton />}>
        {spans.length > 0 ? (
          <Table
            size="small"
            sx={{
              '& td, & th': {
                borderColor: isDark
                  ? 'rgba(255,255,255,0.04)'
                  : 'rgba(0,0,0,0.04)',
              },
            }}
          >
            <TableHead>
              <TableRow>
                {SPAN_COLUMNS.map((col) => (
                  <TableCell
                    key={col}
                    onClick={() =>
                      ['duration', 'timestamp'].includes(col)
                        ? handleColumnSort(col)
                        : undefined
                    }
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                      cursor: ['duration', 'timestamp'].includes(col)
                        ? 'pointer'
                        : 'default',
                      userSelect: 'none',
                      py: 1,
                      color:
                        orderCol === col
                          ? theme.palette.primary.main
                          : 'text.secondary',
                    }}
                  >
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}
                    >
                      {col === 'trace_id' ? 'TRACE' : col.toUpperCase()}
                      {orderCol === col &&
                        (orderDir === 'desc' ? (
                          <SortDescIcon sx={{ fontSize: 13 }} />
                        ) : (
                          <SortAscIcon sx={{ fontSize: 13 }} />
                        ))}
                    </Box>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {spans.map((span, idx) => (
                <TableRow
                  key={idx}
                  hover
                  sx={{
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.02),
                    },
                  }}
                >
                  <TableCell sx={{ py: 0.8 }}>
                    <Typography
                      sx={{
                        fontSize: '0.73rem',
                        color: 'text.secondary',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatWith(span.timestamp, 'MMM D, HH:mm:ss')}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 0.8 }}>
                    <Chip
                      label={span.op || '—'}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        backgroundColor: alpha(getOpColor(span.op), 0.12),
                        color: getOpColor(span.op),
                        borderRadius: '4px',
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: 0.8, maxWidth: 300 }}>
                    <Typography
                      sx={{
                        fontSize: '0.73rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {span.description || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 0.8 }}>
                    <Typography
                      sx={{
                        fontSize: '0.73rem',
                        fontWeight: 600,
                        color:
                          Number(span.duration) > 1000
                            ? theme.palette.error.main
                            : 'text.primary',
                      }}
                    >
                      {formatDuration(Number(span.duration))}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 0.8 }}>
                    <Typography
                      sx={{
                        fontSize: '0.72rem',
                        color:
                          span.status === 'ok'
                            ? theme.palette.success.main
                            : span.status && span.status !== ''
                              ? theme.palette.error.main
                              : 'text.disabled',
                      }}
                    >
                      {span.status || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 0.8 }}>
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <Typography
                        onClick={() => {
                          if (span.trace_id) {
                            navigate(
                              `/argus/performance?trace=${span.trace_id}`,
                              { state: { allowBack: true } }
                            );
                          }
                        }}
                        sx={{
                          fontSize: '0.72rem',
                          color: theme.palette.primary.main,
                          cursor: 'pointer',
                          '&:hover': { textDecoration: 'underline' },
                        }}
                      >
                        {span.trace_id
                          ? String(span.trace_id).slice(0, 12) + '…'
                          : '—'}
                      </Typography>
                      {span.trace_id && (
                        <>
                          <Tooltip
                            title={t('argus.traces.viewLogs', 'View Logs')}
                          >
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(
                                  `/argus/explore/logs?q=trace_id:"${span.trace_id}"`
                                );
                              }}
                              sx={{ p: 0.2 }}
                            >
                              <LogsIcon
                                sx={{ fontSize: 12, color: 'text.disabled' }}
                              />
                            </IconButton>
                          </Tooltip>
                          <CopyButton
                            text={span.trace_id}
                            size={12}
                            sx={{ p: 0.2 }}
                          />
                        </>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : !loading ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <TraceIcon
              sx={{
                fontSize: 48,
                color: alpha(theme.palette.primary.main, 0.15),
                mb: 1,
              }}
            />
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, mb: 0.5 }}>
              {t('argus.traces.noSpans', 'No spans found')}
            </Typography>
            <Typography color="text.disabled" sx={{ fontSize: '0.8rem' }}>
              {t(
                'argus.traces.noSpansDesc',
                'Try adjusting your filters or time range.'
              )}
            </Typography>
          </Box>
        ) : null}
      </PageContentLoader>
    ),
    [
      loading,
      spans,
      orderCol,
      orderDir,
      theme,
      isDark,
      t,
      handleColumnSort,
      navigate,
    ]
  );

  /* ═══ RENDER ═══ */
  return (
    <Box>
      <PageHeader
        icon={<TraceIcon />}
        title={
          <ArgusBreadcrumbs
            size="title"
            paths={[
              {
                label: t('argus.explore.title', 'Explore'),
                to: `/argus/explore`,
              },
              {
                label: (
                  <EditablePageTitle
                    value={queryName}
                    onChange={handleRename}
                    placeholder={defaultQueryName}
                  />
                ),
              },
            ]}
          />
        }
        subtitle={t(
          'argus.traces.subtitle',
          'Search and analyze spans across all traces'
        )}
        actions={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Tooltip title={t('argus.traces.savedQueries', 'Saved Queries')}>
              <IconButton
                size="small"
                onClick={() => setSavedPanelOpen(true)}
                sx={{
                  color:
                    savedQueries.length > 0
                      ? theme.palette.primary.main
                      : 'text.secondary',
                }}
              >
                {savedQueries.length > 0 ? (
                  <BookmarkIcon sx={{ fontSize: 20 }} />
                ) : (
                  <BookmarkBorderIcon sx={{ fontSize: 20 }} />
                )}
              </IconButton>
            </Tooltip>
            <Button
              size="small"
              variant="outlined"
              startIcon={<SaveIcon sx={{ fontSize: 15 }} />}
              onClick={() => {
                setSaveName(queryName === defaultQueryName ? '' : queryName);
                setSaveDialogOpen(true);
              }}
              sx={{
                textTransform: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderColor: isDark
                  ? 'rgba(255,255,255,0.12)'
                  : 'rgba(0,0,0,0.12)',
                borderRadius: '6px',
              }}
            >
              {t('argus.traces.saveAs', 'Save as...')}
            </Button>
            <ExploreActions
              dataset="spans"
              projectId={projectId}
              queryContext={{ search: search, period: currentPeriod }}
            />
          </Box>
        }
      />

      <ArgusFilterBar
        projectId={projectId}
        value={filters}
        onChange={handleFilterChange}
        onRefresh={fetchAll}
        loading={loading}
        hideFilters={['browser', 'os']}
        extraControls={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              ref={searchContainerRef}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                flex: 1,
                px: 1,
                py: 0.2,
                borderRadius: '6px',
                minWidth: 400,
                minHeight: 30,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                transition: 'border-color 0.2s',
                backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#fff',
                '&:focus-within': {
                  borderColor: theme.palette.primary.main,
                  boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`,
                },
              }}
            >
              <SearchIcon
                sx={{
                  fontSize: 16,
                  color: 'text.disabled',
                  flexShrink: 0,
                  ml: 0.5,
                }}
              />
              <Box
                component="input"
                value={search}
                spellCheck={false}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSearch(e.target.value)
                }
                onKeyDown={handleSearchKey as any}
                onFocus={() => setSearchFocused(true)}
                placeholder={t(
                  'argus.traces.searchPlaceholder',
                  'Search spans by description, op, or tag...'
                )}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  color: 'inherit',
                  fontFamily: 'inherit',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  minWidth: 100,
                  padding: '6px 8px',
                }}
              />
              {search && (
                <IconButton
                  size="small"
                  onClick={() => {
                    setSearch('');
                    setUrlState({ q: '' });
                  }}
                  sx={{ p: 0.2, mr: 0.5 }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              )}
            </Box>

            <Tooltip title={t('argus.builder.open', 'Open Query Builder')}>
              <IconButton
                size="small"
                onClick={(e) => setBuilderAnchorEl(e.currentTarget)}
                sx={{
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  borderRadius: '6px',
                  height: 30,
                  width: 30,
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.05)'
                    : 'rgba(0,0,0,0.02)',
                }}
              >
                <FilterIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>

            <ArgusQueryBuilder
              fields={['op', 'status', 'domain', 'action']}
              query={search}
              onApply={(q) => {
                setSearch(q);
                setUrlState({ q });
              }}
              anchorEl={builderAnchorEl}
              onClose={() => setBuilderAnchorEl(null)}
            />

            {/* Search Autocomplete */}
            <Popover
              open={searchFocused}
              anchorEl={searchContainerRef.current}
              onClose={() => setSearchFocused(false)}
              disableAutoFocus
              disableEnforceFocus
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
              slotProps={{
                paper: {
                  sx: {
                    width: searchContainerRef.current?.offsetWidth || 300,
                    mt: 0.5,
                    borderRadius: '8px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                    maxHeight: 320,
                    overflow: 'auto',
                  },
                },
              }}
            >
              <Box sx={{ p: 1 }}>
                <Typography
                  variant="caption"
                  sx={{
                    px: 1,
                    color: 'text.disabled',
                    fontWeight: 600,
                    display: 'block',
                    mb: 0.5,
                  }}
                >
                  {t('argus.traces.opValues', 'Operations')}
                </Typography>
                {tags.op.slice(0, 10).map((v: any, idx: number) => (
                  <Box
                    key={idx}
                    onClick={() => addSearchTag('op', v.value)}
                    sx={{
                      px: 1.5,
                      py: 0.5,
                      cursor: 'pointer',
                      borderRadius: '4px',
                      fontSize: '0.78rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      '&:hover': {
                        backgroundColor: alpha(
                          theme.palette.primary.main,
                          0.08
                        ),
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: getOpColor(v.value),
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          color: theme.palette.primary.main,
                          fontWeight: 600,
                        }}
                      >
                        {v.value || '(empty)'}
                      </span>
                    </Box>
                    <Typography
                      sx={{ fontSize: '0.65rem', color: 'text.disabled' }}
                    >
                      {Number(v.count).toLocaleString()}
                    </Typography>
                  </Box>
                ))}
                {tags.status.length > 0 && (
                  <>
                    <Typography
                      variant="caption"
                      sx={{
                        px: 1,
                        color: 'text.disabled',
                        fontWeight: 600,
                        display: 'block',
                        mt: 1,
                        mb: 0.5,
                      }}
                    >
                      {t('argus.traces.statusValues', 'Status')}
                    </Typography>
                    {tags.status.slice(0, 8).map((v: any, idx: number) => (
                      <Box
                        key={idx}
                        onClick={() => addSearchTag('status', v.value)}
                        sx={{
                          px: 1.5,
                          py: 0.5,
                          cursor: 'pointer',
                          borderRadius: '4px',
                          fontSize: '0.78rem',
                          '&:hover': {
                            backgroundColor: alpha(
                              theme.palette.primary.main,
                              0.08
                            ),
                          },
                        }}
                      >
                        <span style={{}}>{v.value}</span>
                      </Box>
                    ))}
                  </>
                )}
              </Box>
            </Popover>
          </Box>
        }
      />

      {/* Volume Chart */}
      <SpanVolumeChart data={volume} isDark={isDark} onZoom={handleZoom} />

      {/* Tabs */}
      <Box sx={{ mb: 2 }}>
        <SegmentedTabs
          items={[
            { key: '0', label: t('argus.traces.spansTab', 'Spans') },
            { key: '1', label: t('argus.traces.tracesTab', 'Traces') },
            { key: '2', label: t('argus.traces.aggregatesTab', 'Aggregates') },
          ]}
          value={String(activeTab)}
          onChange={handleTabChange}
        />
      </Box>

      {/* ═══ Tab 0: Span Samples ═══ */}
      {activeTab === 0 && (
        <Paper
          elevation={0}
          sx={{
            borderRadius: 2,
            overflow: 'hidden',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}
        >
          {spansTableContent}
        </Paper>
      )}

      {/* ═══ Tab 1: Trace Samples ═══ */}
      {activeTab === 1 && (
        <Paper
          elevation={0}
          sx={{
            borderRadius: 2,
            overflow: 'hidden',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}
        >
          <PageContentLoader loading={loading} skeleton={<TableSkeleton />}>
            {traceSamples.length > 0 ? (
              <Table
                size="small"
                sx={{
                  '& td, & th': {
                    borderColor: isDark
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(0,0,0,0.04)',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                        py: 1,
                      }}
                    >
                      TRACE ID
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                        py: 1,
                      }}
                    >
                      {t('argus.traces.startTime', 'START TIME')}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                        py: 1,
                      }}
                    >
                      {t('argus.traces.spanCount', 'SPANS')}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                        py: 1,
                      }}
                    >
                      {t('argus.traces.totalDuration', 'TOTAL DURATION')}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                        py: 1,
                      }}
                    >
                      {t('argus.traces.operations', 'OPERATIONS')}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                        py: 1,
                      }}
                    >
                      {t('argus.traces.errors', 'ERRORS')}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                        py: 1,
                        width: 40,
                      }}
                    />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {traceSamples.map((trace, idx) => {
                    const ops: string[] = Array.isArray(trace.operations)
                      ? trace.operations
                      : [];
                    return (
                      <TableRow
                        key={idx}
                        hover
                        sx={{
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: alpha(
                              theme.palette.primary.main,
                              0.02
                            ),
                          },
                        }}
                        onClick={() =>
                          navigate(
                            `/argus/performance?trace=${trace.trace_id}`,
                            { state: { allowBack: true } }
                          )
                        }
                      >
                        <TableCell sx={{ py: 0.8 }}>
                          <Typography
                            sx={{
                              fontSize: '0.73rem',
                              color: theme.palette.primary.main,
                              fontWeight: 600,
                            }}
                          >
                            {String(trace.trace_id).slice(0, 16)}…
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 0.8 }}>
                          <Typography
                            sx={{
                              fontSize: '0.73rem',
                              color: 'text.secondary',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {new Date(trace.start_time).toLocaleString(
                              'en-US',
                              {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: false,
                              }
                            )}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 0.8 }}>
                          <Typography
                            sx={{ fontSize: '0.73rem', fontWeight: 600 }}
                          >
                            {Number(trace.span_count).toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 0.8 }}>
                          <Typography
                            sx={{ fontSize: '0.73rem', fontWeight: 600 }}
                          >
                            {formatDuration(Number(trace.total_duration))}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 0.8 }}>
                          <Box
                            sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}
                          >
                            {ops.slice(0, 4).map((op, i) => (
                              <Chip
                                key={i}
                                label={op}
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: '0.65rem',
                                  backgroundColor: alpha(getOpColor(op), 0.12),
                                  color: getOpColor(op),
                                  borderRadius: '3px',
                                }}
                              />
                            ))}
                            {ops.length > 4 && (
                              <Chip
                                label={`+${ops.length - 4}`}
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: '0.65rem',
                                  borderRadius: '3px',
                                }}
                              />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell sx={{ py: 0.8 }}>
                          <Typography
                            sx={{
                              fontSize: '0.73rem',
                              fontWeight: 600,
                              color:
                                Number(trace.error_count) > 0
                                  ? theme.palette.error.main
                                  : 'text.disabled',
                            }}
                          >
                            {Number(trace.error_count)}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 0.8 }}>
                          <Tooltip
                            title={t('argus.traces.viewLogs', 'View Logs')}
                          >
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(
                                  `/argus/explore/logs?q=trace_id:"${trace.trace_id}"`
                                );
                              }}
                              sx={{ p: 0.3 }}
                            >
                              <LogsIcon
                                sx={{ fontSize: 14, color: 'text.disabled' }}
                              />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : !loading ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <TraceIcon
                  sx={{
                    fontSize: 48,
                    color: alpha(theme.palette.primary.main, 0.15),
                    mb: 1,
                  }}
                />
                <Typography
                  sx={{ fontSize: '0.95rem', fontWeight: 600, mb: 0.5 }}
                >
                  {t('argus.traces.noTraces', 'No traces found')}
                </Typography>
                <Typography color="text.disabled" sx={{ fontSize: '0.8rem' }}>
                  {t(
                    'argus.traces.noTracesDesc',
                    'Try adjusting your search or time range.'
                  )}
                </Typography>
              </Box>
            ) : null}
          </PageContentLoader>
        </Paper>
      )}

      {/* ═══ Tab 2: Aggregates ═══ */}
      {activeTab === 2 && (
        <Paper
          elevation={0}
          sx={{
            borderRadius: 2,
            overflow: 'hidden',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            }}
          >
            <Typography
              sx={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'text.secondary',
              }}
            >
              {t('argus.traces.groupBy', 'Group by')}:
            </Typography>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select
                value={aggGroupBy}
                onChange={(e) => {
                  setUrlState({ groupBy: e.target.value as string });
                  fetchAggregates(e.target.value as string);
                }}
                sx={{ height: 28, fontSize: '0.75rem', fontWeight: 700 }}
              >
                <MenuItem value="op" sx={{ fontSize: '0.75rem' }}>
                  Operation (op)
                </MenuItem>
                <MenuItem value="status" sx={{ fontSize: '0.75rem' }}>
                  Status
                </MenuItem>
                <MenuItem value="domain" sx={{ fontSize: '0.75rem' }}>
                  Domain
                </MenuItem>
                <MenuItem value="action" sx={{ fontSize: '0.75rem' }}>
                  Action
                </MenuItem>
              </Select>
            </FormControl>
            <Button
              size="small"
              variant="outlined"
              onClick={() => fetchAggregates()}
              disabled={aggLoading}
              sx={{
                textTransform: 'none',
                fontSize: '0.72rem',
                ml: 'auto',
                borderRadius: '6px',
              }}
            >
              {aggLoading ? (
                <CircularProgress size={14} />
              ) : (
                t('argus.traces.runAgg', 'Run')
              )}
            </Button>
          </Box>

          <PageContentLoader loading={aggLoading} skeleton={<TableSkeleton />}>
            {aggData && aggData.topValues.length > 0 ? (
              <Table
                size="small"
                sx={{
                  '& td, & th': {
                    borderColor: isDark
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(0,0,0,0.04)',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                        py: 1,
                      }}
                    >
                      {aggGroupBy.toUpperCase()}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                        py: 1,
                      }}
                    >
                      {t('argus.traces.count', 'COUNT')}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                        py: 1,
                      }}
                    >
                      {t('argus.traces.avgDuration', 'AVG DURATION')}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                        py: 1,
                      }}
                    >
                      P95
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {aggData.topValues.map((row, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell sx={{ py: 0.8 }}>
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                        >
                          {aggGroupBy === 'op' && (
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                bgcolor: getOpColor(row.group_value),
                                flexShrink: 0,
                              }}
                            />
                          )}
                          <Typography
                            sx={{ fontSize: '0.78rem', fontWeight: 600 }}
                          >
                            {row.group_value || '(empty)'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ py: 0.8 }}>
                        <Typography sx={{ fontSize: '0.73rem' }}>
                          {Number(row.count).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 0.8 }}>
                        <Typography sx={{ fontSize: '0.73rem' }}>
                          {formatDuration(Number(row.avg_duration || 0))}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 0.8 }}>
                        <Typography
                          sx={{
                            fontSize: '0.73rem',
                            fontWeight: 600,
                            color:
                              Number(row.p95_duration) > 1000
                                ? theme.palette.error.main
                                : 'text.primary',
                          }}
                        >
                          {formatDuration(Number(row.p95_duration || 0))}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : !aggLoading ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <ViewIcon
                  sx={{
                    fontSize: 48,
                    color: alpha(theme.palette.primary.main, 0.15),
                    mb: 1,
                  }}
                />
                <Typography
                  sx={{ fontSize: '0.95rem', fontWeight: 600, mb: 0.5 }}
                >
                  {t('argus.traces.aggregatesTitle', 'Span Aggregates')}
                </Typography>
                <Typography color="text.disabled" sx={{ fontSize: '0.8rem' }}>
                  {t(
                    'argus.traces.aggregatesDesc',
                    'Group spans by operation, status, or domain to find patterns.'
                  )}
                </Typography>
              </Box>
            ) : null}
          </PageContentLoader>
        </Paper>
      )}

      {/* Save Query Dialog */}
      <Dialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2.5 } }}
      >
        <DialogTitle
          sx={{
            fontWeight: 700,
            fontSize: '0.95rem',
            pb: 1,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {t('argus.traces.saveQuery', 'Save Trace Query')}
          <IconButton size="small" onClick={() => setSaveDialogOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            size="small"
            autoFocus
            label={t('argus.discover.queryName', 'Query Name')}
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveQuery();
            }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setSaveDialogOpen(false)}
            sx={{ textTransform: 'none' }}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveQuery}
            disabled={!saveName.trim()}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {t('common.save', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Saved Queries Panel */}
      <Drawer
        anchor="right"
        open={savedPanelOpen}
        onClose={() => setSavedPanelOpen(false)}
        PaperProps={{ sx: { width: 340, p: 2 } }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
            {t('argus.traces.savedQueries', 'Saved Trace Queries')}
          </Typography>
          <IconButton size="small" onClick={() => setSavedPanelOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        {savedQueries.length === 0 ? (
          <Typography
            sx={{
              color: 'text.disabled',
              fontSize: '0.82rem',
              textAlign: 'center',
              py: 4,
            }}
          >
            {t('argus.traces.noSavedQueries', 'No saved trace queries yet')}
          </Typography>
        ) : (
          savedQueries.map((sq) => (
            <Paper
              key={sq.id}
              elevation={0}
              sx={{
                p: 1.5,
                mb: 1,
                borderRadius: 2,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                cursor: 'pointer',
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  bgcolor: alpha(theme.palette.primary.main, 0.02),
                },
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Box
                sx={{ flex: 1, minWidth: 0 }}
                onClick={() => handleLoadSavedQuery(sq)}
              >
                <Typography
                  sx={{
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {sq.name}
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
                  {sq.created_by} ·{' '}
                  {new Date(sq.created_at).toLocaleDateString()}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={() => handleDeleteSavedQuery(sq.id)}
                sx={{
                  color: 'text.disabled',
                  '&:hover': { color: 'error.main' },
                }}
              >
                <DeleteIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Paper>
          ))
        )}
      </Drawer>
    </Box>
  );
};

export default ArgusTraceExplorerPage;
