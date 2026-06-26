import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { Box, Button, IconButton, useTheme } from '@mui/material';
import {
  Timeline as TraceIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import SafeTooltip from '@/components/common/SafeTooltip';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import PageHeader from '@/components/common/PageHeader';
import EditablePageTitle from '@/components/common/EditablePageTitle';
import ExploreActions from '@/components/argus/ExploreActions';
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
import { TRACES_CONFIG } from '@/components/argus/query-aql/fields';
import FacetSidebar, { FacetGroup } from '@/components/argus/FacetSidebar';
import SpanDetailPanel from '@/components/argus/SpanDetailDrawer';
import SaveQueryDialog from '@/components/argus/SaveQueryDialog';
import DeleteQueryConfirmDialog from '@/components/argus/DeleteQueryConfirmDialog';
import argusService, { ArgusSavedQuery } from '@/services/argusService';
import useArgusUrlState from '@/hooks/useArgusUrlState';
import { useResizableSplit } from '@/hooks/useResizableSplit';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { getOpColor } from './components/traceExplorerHelpers';
import { ChartDataset } from '@/components/argus/InteractiveTimeSeriesChart';
import {
  SaveQueryDialog as TraceSaveQueryDialog,
  SavedQueriesPanel,
} from './components/TraceExplorerDialogs';

import { TraceViews } from './components/trace/TraceViews';

const ArgusTraceExplorerPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
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
      volumeChartType: { key: 'vct', default: 'bar' },
      aggChartTypes: { key: 'act', default: 'bar' },
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

    const opTotals = new Map<string, number>();
    volume.forEach((p) => {
      if (p.op)
        opTotals.set(p.op, (opTotals.get(p.op) || 0) + (Number(p.count) || 0));
    });
    const topOps = [...opTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([op]) => op);

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

  const [facetCollapsed, setFacetCollapsed] = useState(() => {
    try {
      return localStorage.getItem('argus-trace-facet-collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const {
    splitWidth: facetWidth,
    isDragging: isFacetDragging,
    handleMouseDown: handleFacetSplitterMouseDown,
    panelRef: facetPanelRef,
  } = useResizableSplit({
    storageKey: 'argus-trace-facet-width',
    defaultWidth: DEFAULT_FACET_WIDTH,
    minWidth: MIN_FACET_WIDTH,
    maxWidth: MAX_FACET_WIDTH,
  });

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
  const {
    splitWidth: detailWidth,
    isDragging: isDetailDragging,
    handleMouseDown: handleDetailSplitterMouseDown,
    panelRef: detailPanelRef,
  } = useResizableSplit({
    storageKey: 'argus-trace-detail-width',
    defaultWidth: 400,
    minWidth: 280,
    maxWidth: 700,
    invertDelta: true,
  });

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

  useEffect(() => {
    if (urlState.queryId && savedQueries.length > 0) {
      const qId = parseInt(urlState.queryId, 10);
      const matched = savedQueries.find((q) => q.id === qId);
      if (matched && currentQueryId !== qId) {
        const cfg =
          typeof matched.query_config === 'string'
            ? JSON.parse(matched.query_config)
            : matched.query_config;
        setCurrentQueryId(matched.id);
        setQueryName(matched.name);
        if (cfg.search !== undefined) {
          setSearch(cfg.search);
          setUrlState({ q: cfg.search });
        }
        if (cfg.groupBy) setUrlState({ groupBy: cfg.groupBy });
        if (cfg.period) setUrlState({ period: cfg.period });
        if (cfg.tab !== undefined) setUrlState({ tab: String(cfg.tab) });
        if (cfg.orderBy) setUrlState({ orderBy: cfg.orderBy });
        if (cfg.volumeChartType)
          setUrlState({ volumeChartType: cfg.volumeChartType });
        if (cfg.aggChartTypes)
          setUrlState({ aggChartTypes: cfg.aggChartTypes });
        setSavedSnapshot({
          search: cfg.search || '',
          groupBy: cfg.groupBy || 'op',
          orderBy: cfg.orderBy || orderBy,
          tab: cfg.tab !== undefined ? String(cfg.tab) : '0',
          volumeChartType: cfg.volumeChartType || 'bar',
          aggChartTypes: cfg.aggChartTypes || 'bar',
        });
      }
    }
  }, [urlState.queryId, savedQueries, currentQueryId]);

  // Dirty state tracking
  type TraceSnapshot = {
    search: string;
    groupBy: string;
    orderBy: string;
    tab: string;
    volumeChartType: string;
    aggChartTypes: string;
  };
  const [savedSnapshot, setSavedSnapshot] = useState<TraceSnapshot | null>(
    null
  );

  const takeSnapshot = useCallback(() => {
    setSavedSnapshot({
      search,
      groupBy: urlState.groupBy,
      orderBy,
      tab: urlState.tab,
      volumeChartType: urlState.volumeChartType,
      aggChartTypes: urlState.aggChartTypes,
    });
  }, [
    search,
    urlState.groupBy,
    orderBy,
    urlState.tab,
    urlState.volumeChartType,
    urlState.aggChartTypes,
  ]);

  const isDirty = useMemo(() => {
    if (!savedSnapshot) return !urlState.queryId;
    const normalizedSearch = normalizeQuery(search);
    const normalizedSnapshot = normalizeQuery(savedSnapshot.search);
    return (
      normalizedSearch !== normalizedSnapshot ||
      urlState.groupBy !== savedSnapshot.groupBy ||
      orderBy !== savedSnapshot.orderBy ||
      urlState.tab !== savedSnapshot.tab ||
      urlState.volumeChartType !== savedSnapshot.volumeChartType ||
      urlState.aggChartTypes !== savedSnapshot.aggChartTypes
    );
  }, [
    search,
    urlState.groupBy,
    orderBy,
    urlState.tab,
    urlState.volumeChartType,
    urlState.aggChartTypes,
    savedSnapshot,
    urlState.queryId,
  ]);

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

  const fetchTabData = useCallback(() => {
    if (activeTab === 0) fetchSpans();
    else if (activeTab === 1) fetchTraceSamples();
    else if (activeTab === 2) fetchAggregates();
  }, [activeTab, fetchSpans, fetchTraceSamples, fetchAggregates]);

  const fetchTabDataRef = useRef(fetchTabData);
  fetchTabDataRef.current = fetchTabData;

  const fetchCommon = useCallback(() => {
    fetchVolume();
    fetchTags();
  }, [fetchVolume, fetchTags]);

  const fetchAll = useCallback(() => {
    fetchTabData();
    fetchCommon();
  }, [fetchTabData, fetchCommon]);

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
      orderBy,
      volumeChartType: urlState.volumeChartType,
      aggChartTypes: urlState.aggChartTypes,
    }),
    [
      search,
      currentPeriod,
      activeTab,
      aggGroupBys,
      orderBy,
      urlState.volumeChartType,
      urlState.aggChartTypes,
    ]
  );

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

  const handleSaveAs = useCallback(() => {
    setSaveName(queryName === defaultQueryName ? '' : queryName);
    setSaveDialogMode('saveAs');
    setSaveDialogOpen(true);
  }, [queryName, defaultQueryName]);

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
        tab: cfg.tab !== undefined ? String(cfg.tab) : '0',
        volumeChartType: cfg.volumeChartType || 'bar',
        aggChartTypes: cfg.aggChartTypes || 'bar',
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
              onChange={(q) => setUrlState({ q })}
              fetchFieldValues={fetchFieldValues}
              initialFacets={mappedFacets}
            />
          </Box>
        }
      />

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
        <FacetSidebar
          ref={facetPanelRef as React.Ref<HTMLDivElement>}
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

        <TraceViews
          volumeDatasets={volumeDatasets}
          volumeLabels={volumeLabels}
          loading={loading}
          volume={volume}
          handleZoom={handleZoom}
          activeTab={activeTab}
          handleTabChange={handleTabChange}
          spans={spans}
          orderCol={orderCol}
          orderDir={orderDir}
          handleColumnSort={handleColumnSort}
          handleSelectSpan={handleSelectSpan}
          selectedSpanIndex={selectedSpanIndex}
          addSearchTag={addSearchTag}
          spansHasMore={spansHasMore}
          loadingMore={loadingMore}
          handleLoadMoreSpans={handleLoadMoreSpans}
          traceSamples={traceSamples}
          tracesHasMore={tracesHasMore}
          handleLoadMoreTraces={handleLoadMoreTraces}
          aggGroupBys={aggGroupBys}
          aggDataMap={aggDataMap}
          aggLoading={aggLoading}
          traceGroupByOptions={traceGroupByOptions}
          spanFacets={spanFacets}
          setUrlState={setUrlState}
          fetchAggregates={fetchAggregates}
          volumeChartType={urlState.volumeChartType as any}
          onVolumeChartTypeChange={(type) =>
            setUrlState({ volumeChartType: type })
          }
          aggChartTypes={(urlState.aggChartTypes || 'bar').split(',') as any[]}
          onAggChartTypeChange={(index, type) => {
            const types = (urlState.aggChartTypes || 'bar').split(',');
            while (types.length <= index) types.push('bar');
            types[index] = type;
            setUrlState({ aggChartTypes: types.join(',') });
          }}
        />

        {selectedSpan && activeTab === 0 && (
          <>
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
              ref={detailPanelRef as React.Ref<HTMLDivElement>}
              sx={{ width: detailWidth, flexShrink: 0, overflow: 'auto' }}
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

      <DeleteQueryConfirmDialog
        open={!!deleteTarget}
        queryName={deleteTarget?.name || ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

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
