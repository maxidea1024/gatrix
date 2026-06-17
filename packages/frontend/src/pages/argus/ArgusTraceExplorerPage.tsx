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
  Button,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Timeline as TraceIcon,
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
import {
  QueryAQLEditor,
  QueryAQLEditorHandle,
} from '@/components/argus/query-aql/QueryAQLEditor';
import { normalizeQuery } from '@/components/argus/query-aql';
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
import { SpansTab, TracesTab } from './components/TraceExplorerTabs';
import {
  SaveQueryDialog as TraceSaveQueryDialog,
  SavedQueriesPanel,
} from './components/TraceExplorerDialogs';
import SaveQueryDialog from '@/components/argus/SaveQueryDialog';
import DeleteQueryConfirmDialog from '@/components/argus/DeleteQueryConfirmDialog';

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
  const aggGroupBys = useMemo(
    () => (urlState.groupBy || 'op').split(',').filter(Boolean),
    [urlState.groupBy]
  );
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
  const [tags, setTags] = useState<{
    op: any[];
    status: any[];
    domain: any[];
    discovered?: Record<string, { value: string; count: number }[]>;
  }>({ op: [], status: [], domain: [] });

  // ─── Transform volume for ArgusVolumeChart ───
  const { volumeLabels, volumeDatasets } = useMemo(() => {
    if (volume.length === 0)
      return {
        volumeLabels: [] as string[],
        volumeDatasets: [] as ChartDataset[],
      };

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
    volume.forEach((p) =>
      lookup.set(`${p.bucket}::${p.op}`, Number(p.count) || 0)
    );

    const labels = sorted.map((b) => {
      try {
        const d = new Date(b);
        return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:00`;
      } catch {
        return b;
      }
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
  const [selectedSpanIndex, setSelectedSpanIndex] = useState<number | null>(
    null
  );

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
      return !isNaN(saved) &&
        saved >= MIN_FACET_WIDTH &&
        saved <= MAX_FACET_WIDTH
        ? saved
        : DEFAULT_FACET_WIDTH;
    } catch {
      return DEFAULT_FACET_WIDTH;
    }
  });
  const [isFacetDragging, setIsFacetDragging] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(FACET_WIDTH_KEY, String(facetWidth));
    } catch {}
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
          Math.min(
            MAX_FACET_WIDTH,
            Math.max(MIN_FACET_WIDTH, startWidth + delta)
          )
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
      try {
        localStorage.setItem('argus-trace-facet-collapsed', String(next));
      } catch {}
      return next;
    });
  }, []);

  // Detail panel resize
  const MIN_DETAIL_WIDTH = 280;
  const MAX_DETAIL_WIDTH = 700;
  const DEFAULT_DETAIL_WIDTH = 400;
  const DETAIL_WIDTH_KEY = 'argus-trace-detail-width';

  const [detailWidth, setDetailWidth] = useState(() => {
    try {
      const saved = parseInt(localStorage.getItem(DETAIL_WIDTH_KEY) || '', 10);
      return !isNaN(saved) &&
        saved >= MIN_DETAIL_WIDTH &&
        saved <= MAX_DETAIL_WIDTH
        ? saved
        : DEFAULT_DETAIL_WIDTH;
    } catch {
      return DEFAULT_DETAIL_WIDTH;
    }
  });
  const [isDetailDragging, setIsDetailDragging] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(DETAIL_WIDTH_KEY, String(detailWidth));
    } catch {}
  }, [detailWidth]);

  const handleDetailSplitterMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDetailDragging(true);
      const startX = e.clientX;
      const startWidth = detailWidth;

      const onMouseMove = (ev: MouseEvent) => {
        // Dragging left = wider detail panel (inverted delta)
        const delta = startX - ev.clientX;
        setDetailWidth(
          Math.min(
            MAX_DETAIL_WIDTH,
            Math.max(MIN_DETAIL_WIDTH, startWidth + delta)
          )
        );
      };
      const onMouseUp = () => {
        setIsDetailDragging(false);
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
    [detailWidth]
  );

  // Pagination
  const [spansHasMore, setSpansHasMore] = useState(false);
  const [tracesHasMore, setTracesHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // AQL editor ref for programmatic chip insertion
  const dslEditorRef = useRef<QueryAQLEditorHandle>(null);

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
  const [saveDialogMode, setSaveDialogMode] = useState<'new' | 'saveAs'>('new');
  const [deleteTarget, setDeleteTarget] = useState<ArgusSavedQuery | null>(
    null
  );

  // Sync URL queryId to state
  useEffect(() => {
    if (urlState.queryId && savedQueries.length > 0) {
      const qId = parseInt(urlState.queryId, 10);
      const matched = savedQueries.find((q) => q.id === qId);
      if (matched && currentQueryId !== qId) {
        setCurrentQueryId(matched.id);
        setQueryName(matched.name);
        // Initialize snapshot so isDirty starts as false
        setSavedSnapshot({
          search,
          groupBy: urlState.groupBy,
          orderBy,
        });
      }
    }
  }, [
    urlState.queryId,
    savedQueries,
    currentQueryId,
    search,
    urlState.groupBy,
    orderBy,
  ]);

  // ─── Dirty state tracking ───
  type TraceSnapshot = {
    search: string;
    groupBy: string;
    orderBy: string;
  };
  const [savedSnapshot, setSavedSnapshot] = useState<TraceSnapshot | null>(
    null
  );

  const takeSnapshot = useCallback(() => {
    setSavedSnapshot({
      search,
      groupBy: urlState.groupBy,
      orderBy,
    });
  }, [search, urlState.groupBy, orderBy]);

  const isDirty = useMemo(() => {
    if (!savedSnapshot) {
      return !urlState.queryId;
    }
    const normalizedSearch = normalizeQuery(search);
    const normalizedSnapshot = normalizeQuery(savedSnapshot.search);
    return (
      normalizedSearch !== normalizedSnapshot ||
      urlState.groupBy !== savedSnapshot.groupBy ||
      orderBy !== savedSnapshot.orderBy
    );
  }, [search, urlState.groupBy, orderBy, savedSnapshot]);

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
        values: tags.op.map((v: any) => ({
          value: v.value,
          count: Number(v.count) || 0,
        })),
      });
    }
    if (tags.status?.length > 0) {
      facets.push({
        key: 'status',
        label: 'Status',
        values: tags.status.map((v: any) => ({
          value: v.value,
          count: Number(v.count) || 0,
        })),
      });
    }
    if (tags.domain?.length > 0) {
      facets.push({
        key: 'domain',
        label: 'Domain',
        values: tags.domain.map((v: any) => ({
          value: v.value,
          count: Number(v.count) || 0,
        })),
      });
    }
    return facets;
  }, [tags]);

  // Dynamically discovered tag facets from span tags Map
  const discoveredFacets = useMemo<FacetGroup[]>(() => {
    if (!tags.discovered) return [];
    return Object.entries(tags.discovered)
      .filter(([, values]) => values && values.length > 0)
      .map(([key, values]) => ({
        key,
        label: key,
        values: values.map((v) => ({
          value: v.value,
          count: Number(v.count) || 0,
        })),
      }));
  }, [tags.discovered]);

  // Facet values for AQL editor autocomplete (initialFacets)
  const mappedFacets = useMemo(() => {
    const result: Record<string, { value: string; count: number }[]> = {};
    if (tags.op?.length) {
      result.op = tags.op.map((v: any) => ({
        value: v.value,
        count: Number(v.count) || 0,
      }));
    }
    if (tags.status?.length) {
      result.status = tags.status.map((v: any) => ({
        value: v.value,
        count: Number(v.count) || 0,
      }));
    }
    if (tags.domain?.length) {
      result.domain = tags.domain.map((v: any) => ({
        value: v.value,
        count: Number(v.count) || 0,
      }));
    }
    // Discovered tag facets (e.g. server.region, http.method)
    for (const df of discoveredFacets) {
      if (!result[df.key]) {
        result[df.key] = df.values;
      }
    }
    return result;
  }, [tags, discoveredFacets]);

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
      const apiParams = argusFilterStateToApiParams(filters);
      const data = await argusService.getSpanTags(
        projectId,
        apiParams.period || currentPeriod,
        apiParams.start,
        apiParams.end
      );
      setTags(data);
    } catch (err) {
      console.error('Failed to fetch span tags', err);
    }
  }, [projectId, filters, currentPeriod]);

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

      // Discovered tag keys — return values from pre-fetched tags
      if (tags.discovered?.[fieldKey]) {
        return tags.discovered[fieldKey].map((v: any) => v.value);
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

  // Fetch data for the currently active tab only
  const fetchTabData = useCallback(() => {
    if (activeTab === 0) fetchSpans();
    else if (activeTab === 1) fetchTraceSamples();
    else if (activeTab === 2) fetchAggregates();
  }, [activeTab, fetchSpans, fetchTraceSamples, fetchAggregates]);

  // Keep a ref so the main effect can call the latest fetchTabData without depending on it
  const fetchTabDataRef = useRef(fetchTabData);
  fetchTabDataRef.current = fetchTabData;

  // Fetch shared data (volume, tags) — does NOT depend on activeTab
  const fetchCommon = useCallback(() => {
    fetchVolume();
    fetchTags();
  }, [fetchVolume, fetchTags]);

  // Full refetch (for manual refresh button)
  const fetchAll = useCallback(() => {
    fetchTabData();
    fetchCommon();
  }, [fetchTabData, fetchCommon]);

  // Main data load: re-fetch when filters/search/period change
  const initialLoadRef = useRef(true);
  useEffect(() => {
    fetchTabDataRef.current();
    fetchCommon();
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      argusService
        .listSavedQueries(projectId, 'traces')
        .then(setSavedQueries)
        .catch(() => setSavedQueries([]));
    }
  }, [fetchCommon, projectId]);

  // Tab-only switch: fetch just the new tab's data without re-fetching volume/tags
  const prevTabRef = useRef(activeTab);
  useEffect(() => {
    if (prevTabRef.current !== activeTab) {
      prevTabRef.current = activeTab;
      fetchTabData();
    }
  }, [activeTab, fetchTabData]);

  // ─── Handlers ───
  const handleSearchSubmit = useCallback(
    (query: string) => {
      setSearch(query);
      setUrlState({ q: query.trim() });
    },
    [setUrlState]
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

  const buildQueryConfig = useCallback(
    () => ({
      search,
      period: currentPeriod,
      tab: activeTab,
      groupBy: aggGroupBys.join(','),
    }),
    [search, currentPeriod, activeTab, aggGroupBys]
  );

  // Save: update existing or prompt name for new
  const handleSave = useCallback(async () => {
    if (currentQueryId) {
      try {
        await argusService.updateSavedQuery(projectId, currentQueryId, {
          name: queryName,
          query_config: buildQueryConfig(),
          display_type: 'table',
        });
        const updated = await argusService.listSavedQueries(
          projectId,
          'traces'
        );
        setSavedQueries(updated);
        takeSnapshot();
      } catch (err) {
        console.error('Failed to update trace query:', err);
      }
    } else if (queryName !== defaultQueryName && queryName.trim()) {
      const duplicate = savedQueries.find(
        (q) => q.name.toLowerCase() === queryName.trim().toLowerCase()
      );
      if (duplicate) {
        setSaveName(queryName.trim());
        setSaveDialogMode('new');
        setSaveDialogOpen(true);
      } else {
        try {
          const res = await argusService.createSavedQuery(projectId, {
            name: queryName.trim(),
            query_config: buildQueryConfig(),
            query_type: 'traces',
            display_type: 'table',
          });
          if (res.id) {
            setCurrentQueryId(res.id);
            setUrlState({ queryId: String(res.id) });
          }
          const updated = await argusService.listSavedQueries(
            projectId,
            'traces'
          );
          setSavedQueries(updated);
          takeSnapshot();
        } catch (err) {
          console.error('Failed to create trace query:', err);
        }
      }
    } else {
      setSaveName('');
      setSaveDialogMode('new');
      setSaveDialogOpen(true);
    }
  }, [
    currentQueryId,
    projectId,
    queryName,
    defaultQueryName,
    buildQueryConfig,
    takeSnapshot,
    setUrlState,
    savedQueries,
  ]);

  // Save As: always open name dialog
  const handleSaveAs = useCallback(() => {
    setSaveName(queryName === defaultQueryName ? '' : queryName);
    setSaveDialogMode('saveAs');
    setSaveDialogOpen(true);
  }, [queryName, defaultQueryName]);

  // Dialog save callback
  const handleDialogSave = useCallback(
    async (name: string, existingQueryId: number | null) => {
      try {
        if (existingQueryId) {
          await argusService.updateSavedQuery(projectId, existingQueryId, {
            name,
            query_config: buildQueryConfig(),
            display_type: 'table',
          });
          setCurrentQueryId(existingQueryId);
          setQueryName(name);
          setUrlState({ queryId: String(existingQueryId) });
        } else {
          const res = await argusService.createSavedQuery(projectId, {
            name,
            query_config: buildQueryConfig(),
            display_type: 'table',
            query_type: 'traces',
          });
          if (res.id) {
            setCurrentQueryId(res.id);
            setQueryName(name);
            setUrlState({ queryId: String(res.id) });
          }
        }
        const updated = await argusService.listSavedQueries(
          projectId,
          'traces'
        );
        setSavedQueries(updated);

        takeSnapshot();
        setSaveDialogOpen(false);
        setSaveName('');
      } catch (err) {
        console.error('Failed to save trace query:', err);
      }
    },
    [projectId, buildQueryConfig, setUrlState, takeSnapshot]
  );

  const handleRename = useCallback(
    async (newName: string) => {
      setQueryName(newName);
      const effectiveId =
        currentQueryId ||
        (urlState.queryId ? parseInt(urlState.queryId, 10) : null);
      if (effectiveId) {
        try {
          await argusService.updateSavedQuery(projectId, effectiveId, {
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
    [currentQueryId, projectId, urlState.queryId]
  );

  const handleDeleteSavedQuery = useCallback(
    (id: number) => {
      const target = savedQueries.find((q) => q.id === id);
      if (target) setDeleteTarget(target);
    },
    [savedQueries]
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await argusService.deleteSavedQuery(projectId, deleteTarget.id);
      setSavedQueries((prev) => prev.filter((q) => q.id !== deleteTarget.id));
      if (currentQueryId === deleteTarget.id) setCurrentQueryId(null);
    } catch (err) {
      console.error('Failed to delete saved query:', err);
    }
    setDeleteTarget(null);
  }, [deleteTarget, projectId, currentQueryId]);

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
      setUrlState({ queryId: String(sq.id) });
      setQueryName(sq.name);
      setCurrentQueryId(sq.id);
      setSavedPanelOpen(false);
      setSavedSnapshot({
        search: cfg.search || '',
        groupBy: cfg.groupBy || 'op',
        orderBy: cfg.orderBy || '-duration',
      });
    },
    [setUrlState]
  );

  const handleTabChange = useCallback(
    (newTab: string) => {
      setUrlState({ tab: newTab });
    },
    [setUrlState]
  );

  const addSearchTag = useCallback((key: string, value: string) => {
    const ref = dslEditorRef.current;
    if (!ref) return;
    const current = ref.getFieldValues(key);
    if (!current.includes(value)) {
      ref.upsertFieldChip(key, [...current, value]);
    }
  }, []);

  const handleSelectSpan = useCallback((span: any, index: number) => {
    setSelectedSpan(span);
    setSelectedSpanIndex(index);
  }, []);

  const handleFacetFilter = useCallback((key: string, value: string) => {
    const ref = dslEditorRef.current;
    if (!ref) return;
    // Discovered facets pass their raw key (e.g. "server.region"); QueryParser
    // auto-maps unknown keys to tags['key'] via Map column fallback.
    // Strip any legacy prefixes that may still be present.
    const cleanKey = key.replace(/^(tags\.|discovered\.|attr\.)/, '');
    const current = ref.getFieldValues(cleanKey);
    if (current.includes(value)) {
      ref.upsertFieldChip(
        cleanKey,
        current.filter((v) => v !== value)
      );
    } else {
      ref.upsertFieldChip(cleanKey, [...current, value]);
    }
  }, []);

  /* ═══ RENDER ═══ */
  return (
    <Box
      sx={{
        minWidth: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
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
        titleUpdateTrigger={queryName}
        actionsUpdateTrigger={`${isDirty}-${currentQueryId}`}
        subtitle={t(
          'argus.traces.subtitle',
          'Search and analyze spans across all traces'
        )}
        actions={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <SafeTooltip
              title={t('argus.traces.savedQueries', 'Saved Queries')}
            >
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
              variant="contained"
              startIcon={<SaveIcon sx={{ fontSize: 15 }} />}
              onClick={handleSave}
              disabled={!isDirty}
              sx={{
                textTransform: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: '6px',
              }}
            >
              {t('argus.traces.save', 'Save')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<SaveIcon sx={{ fontSize: 15 }} />}
              onClick={handleSaveAs}
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
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              flex: 1,
              minWidth: 0,
            }}
          >
            <QueryAQLEditor
              ref={dslEditorRef}
              config={TRACES_CONFIG}
              initialQuery={search}
              placeholder={t(
                'argus.traces.searchPlaceholder',
                'Search spans by description, op, or tag...'
              )}
              onSearch={handleSearchSubmit}
              onChange={(q) => {
                setUrlState({ q });
              }}
              fetchFieldValues={fetchFieldValues}
              initialFacets={mappedFacets}
            />
          </Box>
        }
      />

      {/* ── Body: Sidebar + Content ── */}
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          borderRadius: 2,
          backgroundColor: 'background.paper',
        }}
      >
        {/* Left: Facets */}
        <FacetSidebar
          facets={spanFacets}
          discoveredFacets={discoveredFacets}
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
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Volume Chart */}
          <Box sx={{ px: 2, pt: 2 }}>
            <ArgusVolumeChart
              datasets={volumeDatasets}
              labels={volumeLabels}
              loading={loading}
              title="count(spans)"
              onZoom={(startIdx, endIdx) => {
                const buckets = [
                  ...new Set(volume.map((v) => v.bucket)),
                ].sort();
                const si = Math.min(startIdx, endIdx);
                const ei = Math.max(startIdx, endIdx);
                if (buckets[si] && buckets[ei]) {
                  const startDate = new Date(buckets[si]);
                  let endDate = new Date(buckets[ei]);
                  if (buckets.length > 1) {
                    const gap =
                      new Date(buckets[1]).getTime() -
                      new Date(buckets[0]).getTime();
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
                {
                  key: '2',
                  label: t('argus.traces.aggregatesTab', 'Aggregates'),
                },
              ]}
              value={String(activeTab)}
              onChange={handleTabChange}
            />
          </Box>

          {/* Tab Content */}
          <Box
            sx={{
              px: 2,
              pb: 2,
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
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
              <Box
                sx={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
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
                      const defaults = [
                        'op',
                        'status',
                        'domain',
                        'action',
                        'service',
                      ];
                      const next =
                        defaults.find((d) => !aggGroupBys.includes(d)) || 'op';
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

        {/* Right: Span Detail Drawer (resizable) */}
        {selectedSpan && activeTab === 0 && (
          <>
            {/* Splitter handle */}
            <Box
              onMouseDown={handleDetailSplitterMouseDown}
              sx={{
                width: '1px',
                flexShrink: 0,
                cursor: 'col-resize',
                bgcolor: isDetailDragging ? 'primary.main' : 'divider',
                position: 'relative',
                zIndex: 10,
                transition: 'background-color 0.15s, transform 0.15s',
                transformOrigin: 'center',
                ...(isDetailDragging && {
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
            <Box
              sx={{
                width: detailWidth,
                flexShrink: 0,
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
          </>
        )}
      </Box>

      {/* Save / Save As Dialog */}
      <SaveQueryDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        name={saveName}
        onNameChange={setSaveName}
        onSave={handleDialogSave}
        mode={saveDialogMode}
        savedQueries={savedQueries}
        currentQueryId={currentQueryId}
      />

      {/* Delete Confirm Dialog */}
      <DeleteQueryConfirmDialog
        open={!!deleteTarget}
        queryName={deleteTarget?.name || ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
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
