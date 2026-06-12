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
  IconButton,
  Popover,
  Button,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  Timeline as TraceIcon,
  Tune as TuneIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import SafeTooltip from '@/components/common/SafeTooltip';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import ArgusFilterBar, {
  ArgusFilterState,
  defaultArgusFilterState,
  argusFilterStateToApiParams,
} from '@/components/argus/ArgusFilterBar';
import QueryBuilderPanel from '@/components/argus/QueryBuilderPanel';
import FacetSidebar, { FacetGroup } from '@/components/argus/FacetSidebar';
import SpanDetailPanel from '@/components/argus/SpanDetailDrawer';
import SegmentedTabs from '@/components/common/SegmentedTabs';
import PageHeader from '@/components/common/PageHeader';
import EditablePageTitle from '@/components/common/EditablePageTitle';
import ExploreActions from '@/components/argus/ExploreActions';
import argusService, { ArgusSavedQuery } from '@/services/argusService';
import { TRACES_CONFIG } from '@/components/argus/query-aql/fields';
import useArgusUrlState from '@/hooks/useArgusUrlState';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { getOpColor } from './components/traceExplorerHelpers';
import ArgusVolumeChart from '@/components/argus/ArgusVolumeChart';
import { ChartDataset } from '@/components/argus/InteractiveTimeSeriesChart';
import AggregatePanel from '@/components/argus/AggregatePanel';
import {
  SpansTab,
  TracesTab,
} from './components/TraceExplorerTabs';
import {
  SaveQueryDialog,
  SavedQueriesPanel,
} from './components/TraceExplorerDialogs';

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
  const aggGroupBys = (urlState.groupBy || 'op').split(',').filter(Boolean);
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

  // ─── Transform volume for ArgusVolumeChart ───
  const { volumeLabels, volumeDatasets } = useMemo(() => {
    if (volume.length === 0)
      return { volumeLabels: [] as string[], volumeDatasets: [] as ChartDataset[] };

    const bucketSet = new Set<string>();
    const opSet = new Set<string>();
    volume.forEach((p) => {
      bucketSet.add(p.bucket);
      if (p.op) opSet.add(p.op);
    });
    const sorted = [...bucketSet].sort();

    // Top 10 ops by total count
    const opTotals = new Map<string, number>();
    volume.forEach((p) => {
      if (p.op)
        opTotals.set(p.op, (opTotals.get(p.op) || 0) + (Number(p.count) || 0));
    });
    const topOps = [...opTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([op]) => op);

    // Build lookup
    const lookup = new Map<string, number>();
    volume.forEach((p) => lookup.set(`${p.bucket}::${p.op}`, Number(p.count) || 0));

    const labels = sorted.map((b) => {
      try {
        const d = new Date(b);
        return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:00`;
      } catch { return b; }
    });

    const datasets: ChartDataset[] = topOps.map((op) => ({
      label: op,
      data: sorted.map((b) => lookup.get(`${b}::${op}`) || 0),
      color: getOpColor(op),
      type: 'bar' as const,
    }));

    return { volumeLabels: labels, volumeDatasets: datasets };
  }, [volume]);
  // Aggregates (multi-group)
  const [aggDataMap, setAggDataMap] = useState<
    Record<
      string,
      {
        groupBy: string;
        topValues: { group_value: string; count: number }[];
        timeSeries: { bucket: string; group_value: string; count: number }[];
      }
    >
  >({});
  const [aggLoading, setAggLoading] = useState(false);

  // Span detail drawer
  const [selectedSpan, setSelectedSpan] = useState<any | null>(null);
  const [selectedSpanIndex, setSelectedSpanIndex] = useState<number | null>(null);

  // Facet sidebar
  const MIN_FACET_WIDTH = 180;
  const MAX_FACET_WIDTH = 400;
  const DEFAULT_FACET_WIDTH = 220;
  const FACET_WIDTH_KEY = 'argus-trace-facet-width';

  const [facetCollapsed, setFacetCollapsed] = useState(() => {
    try {
      return localStorage.getItem('argus-trace-facet-collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [facetWidth, setFacetWidth] = useState(() => {
    try {
      const saved = parseInt(localStorage.getItem(FACET_WIDTH_KEY) || '', 10);
      return !isNaN(saved) && saved >= MIN_FACET_WIDTH && saved <= MAX_FACET_WIDTH
        ? saved
        : DEFAULT_FACET_WIDTH;
    } catch {
      return DEFAULT_FACET_WIDTH;
    }
  });
  const [isFacetDragging, setIsFacetDragging] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(FACET_WIDTH_KEY, String(facetWidth)); } catch {}
  }, [facetWidth]);

  const handleFacetSplitterMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsFacetDragging(true);
      const startX = e.clientX;
      const startWidth = facetWidth;

      const onMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        setFacetWidth(
          Math.min(MAX_FACET_WIDTH, Math.max(MIN_FACET_WIDTH, startWidth + delta))
        );
      };
      const onMouseUp = () => {
        setIsFacetDragging(false);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [facetWidth]
  );

  const handleToggleFacetCollapse = useCallback(() => {
    setFacetCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem('argus-trace-facet-collapsed', String(next)); } catch {}
      return next;
    });
  }, []);

  // Pagination
  const [spansHasMore, setSpansHasMore] = useState(false);
  const [tracesHasMore, setTracesHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

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
  const [builderOpen, setBuilderOpen] = useState(false);

  const currentPeriod = useMemo(() => {
    if (filters.dateRange.type === 'preset' && filters.dateRange.preset)
      return filters.dateRange.preset;
    return '24h';
  }, [filters.dateRange]);

  // Facet groups derived from tags
  const spanFacets = useMemo<FacetGroup[]>(() => {
    const facets: FacetGroup[] = [];
    if (tags.op?.length > 0) {
      facets.push({
        key: 'op',
        label: 'Operation',
        values: tags.op.map((v: any) => ({ value: v.value, count: Number(v.count) || 0 })),
      });
    }
    if (tags.status?.length > 0) {
      facets.push({
        key: 'status',
        label: 'Status',
        values: tags.status.map((v: any) => ({ value: v.value, count: Number(v.count) || 0 })),
      });
    }
    if (tags.domain?.length > 0) {
      facets.push({
        key: 'domain',
        label: 'Domain',
        values: tags.domain.map((v: any) => ({ value: v.value, count: Number(v.count) || 0 })),
      });
    }
    return facets;
  }, [tags]);

  // ─── Fetch ───
  const SPAN_PAGE_SIZE = 50;
  const TRACE_PAGE_SIZE = 25;

  const fetchSpans = useCallback(async () => {
    setLoading(true);
    setSelectedSpan(null);
    setSelectedSpanIndex(null);
    try {
      const apiParams = argusFilterStateToApiParams(filters);
      const result = await argusService.searchSpans(projectId, {
        period: apiParams.period || currentPeriod,
        search: search.trim() || undefined,
        orderBy,
        limit: SPAN_PAGE_SIZE,
        start: apiParams.start,
        end: apiParams.end,
      });
      setSpans(result.data);
      setSpansHasMore(result.hasMore);
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
      const result = await argusService.getTraceSamples(projectId, {
        period: apiParams.period || currentPeriod,
        search: search.trim() || undefined,
        limit: TRACE_PAGE_SIZE,
        start: apiParams.start,
        end: apiParams.end,
      });
      setTraceSamples(result.data);
      setTracesHasMore(result.hasMore);
    } catch (err) {
      console.error('Failed to get trace samples', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, filters, currentPeriod, search]);

  const handleLoadMoreSpans = useCallback(async () => {
    setLoadingMore(true);
    try {
      const apiParams = argusFilterStateToApiParams(filters);
      const result = await argusService.searchSpans(projectId, {
        period: apiParams.period || currentPeriod,
        search: search.trim() || undefined,
        orderBy,
        limit: SPAN_PAGE_SIZE,
        offset: spans.length,
        start: apiParams.start,
        end: apiParams.end,
      });
      setSpans((prev) => [...prev, ...result.data]);
      setSpansHasMore(result.hasMore);
    } catch (err) {
      console.error('Failed to load more spans', err);
    } finally {
      setLoadingMore(false);
    }
  }, [projectId, filters, currentPeriod, search, orderBy, spans.length]);

  const handleLoadMoreTraces = useCallback(async () => {
    setLoadingMore(true);
    try {
      const apiParams = argusFilterStateToApiParams(filters);
      const result = await argusService.getTraceSamples(projectId, {
        period: apiParams.period || currentPeriod,
        search: search.trim() || undefined,
        limit: TRACE_PAGE_SIZE,
        offset: traceSamples.length,
        start: apiParams.start,
        end: apiParams.end,
      });
      setTraceSamples((prev) => [...prev, ...result.data]);
      setTracesHasMore(result.hasMore);
    } catch (err) {
      console.error('Failed to load more traces', err);
    } finally {
      setLoadingMore(false);
    }
  }, [projectId, filters, currentPeriod, search, traceSamples.length]);

  const fetchVolume = useCallback(async () => {
    try {
      const apiParams = argusFilterStateToApiParams(filters);
      const data = await argusService.getSpanVolume(projectId, {
        period: apiParams.period || currentPeriod,
        search: search.trim() || undefined,
        start: apiParams.start,
        end: apiParams.end,
      });
      // Map 'hour' alias from backend to 'bucket' for chart
      const mapped = (data || []).map((d: any) => ({
        bucket: d.hour || d.bucket,
        op: d.op || '',
        count: Number(d.count) || 0,
      }));
      setVolume(mapped);
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

  const fetchFieldValues = useCallback(
    async (fieldKey: string): Promise<string[]> => {
      if (fieldKey === 'op' && tags.op) return tags.op.map((x) => x.value);
      if (fieldKey === 'status' && tags.status)
        return tags.status.map((x) => x.value);
      if (fieldKey === 'domain' && tags.domain)
        return tags.domain.map((x) => x.value);

      if (fieldKey === 'environment') {
        try {
          const opts = await argusService.getFilterOptions(
            projectId,
            currentPeriod
          );
          return opts.environments || [];
        } catch {
          return [];
        }
      }
      return [];
    },
    [projectId, currentPeriod, tags]
  );

  const fetchAggregates = useCallback(
    async (groupBys?: string[]) => {
      const keys = groupBys || aggGroupBys;
      setAggLoading(true);
      try {
        const apiParams = argusFilterStateToApiParams(filters);
        const results: Record<string, any> = {};
        await Promise.all(
          keys.map(async (gKey) => {
            const data = await argusService.getSpanAggregates(projectId, {
              period: apiParams.period || currentPeriod,
              groupBy: gKey,
              start: apiParams.start,
              end: apiParams.end,
            });
            results[gKey] = data;
          })
        );
        setAggDataMap(results);
      } catch (err) {
        console.error('Failed to fetch span aggregates', err);
      } finally {
        setAggLoading(false);
      }
    },
    [projectId, filters, currentPeriod, aggGroupBys]
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
  const handleSearchKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        setUrlState({ q: search.trim() });
        setSearchFocused(false);
        // No explicit fetchAll() — setUrlState triggers the
        // search → fetchSpans/fetchAll → useEffect chain automatically.
      }
    },
    [search, setUrlState]
  );

  const handleFilterChange = useCallback(
    (newFilters: ArgusFilterState) => {
      setFilters(newFilters);
      if (
        newFilters.dateRange.type === 'preset' &&
        newFilters.dateRange.preset
      ) {
        setUrlState({
          period: newFilters.dateRange.preset,
          start: '',
          end: '',
        });
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
    },
    [setUrlState]
  );

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

  // handleGroupByChange is now inline per-panel (see render section)

  const handleRunAgg = useCallback(() => {
    fetchAggregates();
  }, [fetchAggregates]);

  // groupByOptions for trace aggregates
  const traceGroupByOptions = useMemo(
    () => [
      { value: 'op', label: 'Operation' },
      { value: 'status', label: 'Status' },
      { value: 'domain', label: 'Domain' },
      { value: 'action', label: 'Action' },
      { value: 'service', label: 'Service' },
    ],
    []
  );

  const handleSaveQuery = useCallback(async () => {
    if (!saveName.trim()) return;
    try {
      const res = await argusService.createSavedQuery(projectId, {
        name: saveName.trim(),
        query_config: {
          search,
          period: currentPeriod,
          tab: activeTab,
          groupBy: aggGroupBys.join(','),
        },
        display_type: 'table',
        query_type: 'traces',
      });
      const updated = await argusService.listSavedQueries(projectId, 'traces');
      setSavedQueries(updated);
      setQueryName(saveName.trim());
      if (res.id) setCurrentQueryId(res.id);
      setSaveDialogOpen(false);
      setSaveName('');
    } catch (err) {
      console.error('Failed to save trace query:', err);
    }
  }, [saveName, projectId, search, currentPeriod, activeTab, aggGroupBys]);

  const handleRename = useCallback(
    async (newName: string) => {
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
    },
    [currentQueryId, projectId]
  );

  const handleDeleteSavedQuery = useCallback(
    async (id: number) => {
      try {
        await argusService.deleteSavedQuery(projectId, id);
        setSavedQueries((prev) => prev.filter((q) => q.id !== id));
        if (currentQueryId === id) setCurrentQueryId(null);
      } catch (err) {
        console.error('Failed to delete saved query:', err);
      }
    },
    [projectId, currentQueryId]
  );

  const handleLoadSavedQuery = useCallback(
    (sq: ArgusSavedQuery) => {
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
    },
    [setUrlState]
  );

  const handleTabChange = useCallback(
    (newTab: string) => {
      setUrlState({ tab: newTab });
    },
    [setUrlState]
  );

  const addSearchTag = useCallback(
    (key: string, value: string) => {
      const appendStr = `${key}:"${value}"`;
      const finalStr =
        (search.trim() ? search.trim() + ' ' : '') + appendStr + ' ';
      setSearch(finalStr);
      setUrlState({ q: finalStr.trim() });
      setSearchFocused(false);
    },
    [search, setUrlState]
  );

  const handleSelectSpan = useCallback((span: any, index: number) => {
    setSelectedSpan(span);
    setSelectedSpanIndex(index);
  }, []);

  const handleFacetFilter = useCallback(
    (key: string, value: string) => {
      addSearchTag(key, value);
    },
    [addSearchTag]
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
            <SafeTooltip title={t('argus.traces.savedQueries', 'Saved Queries')}>
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
            </SafeTooltip>
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: 0 }}>
            <Box
              ref={searchContainerRef}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                flex: 1,
                minWidth: 0,
                px: 1,
                py: 0.2,
                borderRadius: '6px',
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
                  sx={{ p: 0.2, flexShrink: 0 }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              )}

              {/* Builder toggle */}
              <Box
                sx={{
                  borderLeft: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                  ml: 0.5,
                  pl: 0.5,
                  height: 18,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <SafeTooltip title={t('argus.builder.open', 'Open Query Builder')}>
                  <IconButton
                    size="small"
                    onClick={() => setBuilderOpen((prev) => !prev)}
                    sx={{
                      p: 0.3,
                      color: builderOpen
                        ? theme.palette.primary.main
                        : 'text.disabled',
                      transition: 'color 0.15s',
                    }}
                  >
                    <TuneIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </SafeTooltip>
              </Box>
            </Box>

            <QueryBuilderPanel
              open={builderOpen}
              onClose={() => setBuilderOpen(false)}
              config={TRACES_CONFIG}
              query={search}
              facets={Object.fromEntries(
                Object.entries(tags || {}).map(([k, list]) => [
                  k,
                  Array.isArray(list)
                    ? list.map((item: any) => ({
                        value: item.value,
                        count: Number(item.count || 0),
                      }))
                    : [],
                ])
              )}
              fetchFieldValues={fetchFieldValues}
              onApply={(q) => {
                setSearch(q);
                setUrlState({ q });
              }}
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

      {/* ── Body: Sidebar + Content ── */}
      <Box
        sx={{
          display: 'flex',
          minHeight: 500,
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          borderRadius: 2,
          backgroundColor: 'background.paper',
        }}
      >
        {/* Left: Facets */}
        <FacetSidebar
          facets={spanFacets}
          onFilter={handleFacetFilter}
          collapsed={facetCollapsed}
          onToggleCollapse={handleToggleFacetCollapse}
          loading={loading}
          width={facetWidth}
        />
        {!facetCollapsed && (
          <Box
            onMouseDown={handleFacetSplitterMouseDown}
            sx={{
              width: '1px',
              flexShrink: 0,
              cursor: 'col-resize',
              bgcolor: isFacetDragging ? 'primary.main' : 'divider',
              position: 'relative',
              zIndex: 10,
              transition: 'background-color 0.15s, transform 0.15s',
              transformOrigin: 'center',
              ...(isFacetDragging && {
                bgcolor: 'primary.main',
                transform: 'scaleX(4)',
              }),
              '&::after': {
                content: '""',
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: '-5px',
                right: '-5px',
                cursor: 'col-resize',
              },
              '&:hover, &:active': {
                bgcolor: 'primary.main',
                transform: 'scaleX(4)',
              },
            }}
          />
        )}

        {/* Center: Main content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Volume Chart */}
          <Box sx={{ px: 2, pt: 2 }}>
            <ArgusVolumeChart
              datasets={volumeDatasets}
              labels={volumeLabels}
              loading={loading}
              title="count(spans)"
              onZoom={(startIdx, endIdx) => {
                const buckets = [...new Set(volume.map((v) => v.bucket))].sort();
                const si = Math.min(startIdx, endIdx);
                const ei = Math.max(startIdx, endIdx);
                if (buckets[si] && buckets[ei]) {
                  const startDate = new Date(buckets[si]);
                  let endDate = new Date(buckets[ei]);
                  if (buckets.length > 1) {
                    const gap = new Date(buckets[1]).getTime() - new Date(buckets[0]).getTime();
                    endDate = new Date(endDate.getTime() + gap);
                  } else {
                    endDate = new Date(endDate.getTime() + 3600000);
                  }
                  handleZoom(startDate.toISOString(), endDate.toISOString());
                }
              }}
              storagePrefix="argus_traces_volume"
              showLegend={volumeDatasets.length > 1}
              mb={1}
            />
          </Box>

          {/* Tabs */}
          <Box sx={{ px: 2, mb: 1 }}>
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

          {/* Tab Content */}
          <Box sx={{ px: 2, pb: 2 }}>
            {activeTab === 0 && (
              <SpansTab
                spans={spans}
                loading={loading}
                orderCol={orderCol}
                orderDir={orderDir}
                onColumnSort={handleColumnSort}
                onSelectSpan={handleSelectSpan}
                selectedSpanIndex={selectedSpanIndex}
                onFilterTag={addSearchTag}
                hasMore={spansHasMore}
                loadingMore={loadingMore}
                onLoadMore={handleLoadMoreSpans}
              />
            )}

            {activeTab === 1 && (
              <TracesTab
                traceSamples={traceSamples}
                loading={loading}
                hasMore={tracesHasMore}
                loadingMore={loadingMore}
                onLoadMore={handleLoadMoreTraces}
              />
            )}

            {activeTab === 2 && (
              <Box sx={{ px: 2, pt: 1 }}>
                {aggGroupBys.map((gKey, gIdx) => (
                  <AggregatePanel
                    key={gKey}
                    aggData={aggDataMap[gKey] || null}
                    aggGroupBy={gKey}
                    aggLoading={aggLoading}
                    isDark={isDark}
                    groupByOptions={traceGroupByOptions}
                    storagePrefix={`argus_traces_agg_${gIdx}`}
                    discoveredFacetKeys={spanFacets.map((f) => f.label)}
                    onGroupByChange={(val) => {
                      const newKeys = [...aggGroupBys];
                      newKeys[gIdx] = val;
                      const deduped = [...new Set(newKeys)];
                      setUrlState({ groupBy: deduped.join(',') });
                      fetchAggregates(deduped);
                    }}
                    onAddFilter={(key, val) => {
                      addSearchTag(key, val);
                    }}
                    showRemove={aggGroupBys.length > 1}
                    onRemovePanel={() => {
                      const newKeys = aggGroupBys.filter((_, i) => i !== gIdx);
                      setUrlState({ groupBy: newKeys.join(',') });
                      fetchAggregates(newKeys);
                    }}
                  />
                ))}
                {aggGroupBys.length < 3 && (
                  <Box
                    onClick={() => {
                      const defaults = ['op', 'status', 'domain', 'action', 'service'];
                      const next = defaults.find((d) => !aggGroupBys.includes(d)) || 'op';
                      const newKeys = [...aggGroupBys, next];
                      setUrlState({ groupBy: newKeys.join(',') });
                      fetchAggregates(newKeys);
                    }}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      py: 0.75,
                      cursor: 'pointer',
                      borderTop: `1px dashed ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                      color: 'text.disabled',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      transition: 'color 0.15s',
                      '&:hover': { color: 'primary.main' },
                    }}
                  >
                    + Add group
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </Box>

        {/* Right: Span Detail Drawer */}
        {selectedSpan && activeTab === 0 && (
          <Box
            sx={{
              width: 400,
              flexShrink: 0,
              borderLeft: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
              overflow: 'auto',
            }}
          >
            <SpanDetailPanel
              span={selectedSpan}
              onClose={() => {
                setSelectedSpan(null);
                setSelectedSpanIndex(null);
              }}
              isDark={isDark}
              totalDuration={Number(selectedSpan.duration) || 0}
              allSpans={spans}
            />
          </Box>
        )}
      </Box>

      {/* Save Query Dialog */}
      <SaveQueryDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        saveName={saveName}
        onNameChange={setSaveName}
        onSave={handleSaveQuery}
      />

      {/* Saved Queries Panel */}
      <SavedQueriesPanel
        open={savedPanelOpen}
        onClose={() => setSavedPanelOpen(false)}
        savedQueries={savedQueries}
        onLoad={handleLoadSavedQuery}
        onDelete={handleDeleteSavedQuery}
      />
    </Box>
  );
};

export default ArgusTraceExplorerPage;
