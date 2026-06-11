import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import useArgusUrlState from '@/hooks/useArgusUrlState';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import argusService, {
  ArgusLogEntry,
  ArgusSavedQuery,
} from '@/services/argusService';
import {
  ArgusFilterState,
  defaultArgusFilterState,
  argusFilterStateToApiParams,
} from '@/components/argus/ArgusFilterBar';
export interface VolumePoint {
  bucket: string;
  level: string;
  count: number;
}
import { FacetGroup } from '@/components/argus/FacetSidebar';
import { PatternEntry } from '../components/LogsPatternsPanel';

interface LogFacets {
  levels: { level: string; count: number }[];
  services: { service: string; count: number }[];
  environments: { environment: string; count: number }[];
  loggers: { logger_name: string; count: number }[];
  releases: { release: string; count: number }[];
}

const DEFAULT_COLUMNS = ['timestamp', 'severity', 'message'];
const AVAILABLE_COLUMNS = [
  { key: 'timestamp', label: 'TIMESTAMP' },
  { key: 'severity', label: 'SEVERITY' },
  { key: 'message', label: 'MESSAGE' },
  { key: 'service', label: 'SERVICE' },
  { key: 'environment', label: 'ENVIRONMENT' },
  { key: 'logger_name', label: 'LOGGER' },
  { key: 'trace_id', label: 'TRACE ID' },
  { key: 'release', label: 'RELEASE' },
];

export function useArgusLogs() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

  // ─── URL-driven state ───
  const URL_PARAMS = useMemo(
    () => ({
      period: {
        key: 'period',
        default: '14d',
        storageKey: 'argus-logs-period',
      },
      start: { key: 'start', default: '' },
      end: { key: 'end', default: '' },
      q: { key: 'q', default: '' },
      tab: { key: 'tab', default: '0' },
      groupBy: { key: 'groupBy', default: 'level' },
      queryId: { key: 'queryId', default: '' },
      filters: { key: 'filters', default: '' },
      log: { key: 'log', default: '' },
    }),
    []
  );
  const [urlState, setUrlState] = useArgusUrlState(URL_PARAMS);

  const activeTab = parseInt(urlState.tab, 10) || 0;
  // Support multiple group-by keys (comma-separated in URL)
  const aggGroupBys: string[] = useMemo(() => {
    const parsed = (urlState.groupBy || 'level').split(',').filter(Boolean);
    return parsed.length > 0 ? parsed : ['level'];
  }, [urlState.groupBy]);
  const aggGroupBy = aggGroupBys[0];

  // Derive filters from URL period
  const [filters, setFilters] = useState<ArgusFilterState>(() => {
    if (urlState.period === 'custom') {
      if (urlState.start && urlState.end) {
        const base = defaultArgusFilterState('custom');
        base.dateRange = {
          type: 'custom',
          start: new Date(urlState.start),
          end: new Date(urlState.end),
        };
        return base;
      }
      return defaultArgusFilterState('14d');
    }
    return defaultArgusFilterState(urlState.period);
  });

  useEffect(() => {
    setFilters((prev) => {
      if (urlState.period === 'custom') {
        if (urlState.start && urlState.end) {
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
          dateRange: { type: 'preset', preset: '14d' },
        };
      }
      return {
        ...prev,
        dateRange: { type: 'preset', preset: urlState.period },
      };
    });
  }, [urlState.period, urlState.start, urlState.end]);

  useEffect(() => {
    if (urlState.period === 'custom' && (!urlState.start || !urlState.end)) {
      setUrlState({ period: '14d' });
    }
  }, [urlState.period, urlState.start, urlState.end, setUrlState]);

  // Search state — only updated on explicit submit (no debounce needed)
  const [search, setSearch] = useState<string>(urlState.q || '');

  // Sync from URL only on external changes (e.g., browser back/forward)
  const lastSubmittedSearchRef = useRef<string>(urlState.q || '');
  useEffect(() => {
    const urlVal = urlState.q || '';
    if (urlVal !== lastSubmittedSearchRef.current) {
      setSearch(urlVal);
      lastSubmittedSearchRef.current = urlVal;
    }
  }, [urlState.q]);

  // ─── State ───
  const [logs, setLogs] = useState<ArgusLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [facets, setFacets] = useState<LogFacets>({
    levels: [],
    services: [],
    environments: [],
    loggers: [],
    releases: [],
  });
  const [volume, setVolume] = useState<VolumePoint[]>([]);
  const [hasMore, setHasMore] = useState(false);

  const [columns, setColumns] = useLocalStorage<string[]>(
    'argus_log_columns',
    DEFAULT_COLUMNS
  );
  const [columnNames, setColumnNames] = useLocalStorage<Record<string, string>>(
    'argus_log_column_names',
    {}
  );

  const dynamicAvailableColumns = useMemo(() => {
    const baseKeys = AVAILABLE_COLUMNS.map((c) => c.key);
    const logKeys = new Set<string>();
    logs.forEach((log) => {
      if (log.attributes)
        Object.keys(log.attributes).forEach((k) => logKeys.add(k));
    });
    const result = [...AVAILABLE_COLUMNS];
    logKeys.forEach((key) => {
      if (!baseKeys.includes(key)) {
        result.push({ key, label: key.toUpperCase() });
      }
    });
    return result;
  }, [logs]);

  // Side panel state (selected log via URL)
  const selectedLogIndex = useMemo(() => {
    if (!urlState.log) return null;
    const idx = logs.findIndex((l) => l.log_id === urlState.log);
    return idx >= 0 ? idx : null;
  }, [logs, urlState.log]);

  // Lazy-load log detail when selected
  const [selectedLog, setSelectedLog] = useState<ArgusLogEntry | null>(null);
  const [selectedLogLoading, setSelectedLogLoading] = useState(false);
  const expectedLogIdRef = useRef<string | null>(null);

  useEffect(() => {
    const logId = urlState.log;
    expectedLogIdRef.current = logId || null;

    if (!logId) {
      setSelectedLog(null);
      setSelectedLogLoading(false);
      return;
    }

    // Clear previous detail immediately to prevent stale data flash
    setSelectedLog(null);
    setSelectedLogLoading(true);

    const abortController = new AbortController();

    argusService
      .getLogDetail(projectId, logId, abortController.signal)
      .then((detail) => {
        // Only update if this is still the expected log (guard against race)
        if (expectedLogIdRef.current === logId) {
          setSelectedLog(detail);
          setSelectedLogLoading(false);
        }
      })
      .catch(() => {
        // Aborted or failed — only clear loading if still expected
        if (expectedLogIdRef.current === logId) {
          setSelectedLogLoading(false);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [urlState.log, projectId]);

  const [isRightPanelOpen, setIsRightPanelOpen] = useLocalStorage(
    'argus_right_panel_open',
    false
  );

  // ─── Custom Facets (user-defined attribute keys) ───
  const CUSTOM_FACETS_KEY = 'argus_custom_facets';
  const [customFacetKeys, setCustomFacetKeys] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(CUSTOM_FACETS_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const [customFacetData, setCustomFacetData] = useState<FacetGroup[]>([]);

  // Persist custom facet keys
  useEffect(() => {
    localStorage.setItem(CUSTOM_FACETS_KEY, JSON.stringify(customFacetKeys));
  }, [customFacetKeys]);

  // Fetch custom facet values from backend
  const fetchCustomFacets = useCallback(async () => {
    if (customFacetKeys.length === 0) {
      setCustomFacetData([]);
      return;
    }
    const apiParams = argusFilterStateToApiParams(filters);
    const results = await Promise.all(
      customFacetKeys.map(async (key) => {
        try {
          const data = await argusService.getAttributeFacet(projectId, key, {
            period: apiParams.period,
            start: apiParams.start,
            end: apiParams.end,
          });
          return {
            key: `attr.${key}`,
            label: key,
            values: data.map((d) => ({
              value: d.attr_value,
              count: Number(d.count),
            })),
          } as FacetGroup;
        } catch {
          return { key: `attr.${key}`, label: key, values: [] } as FacetGroup;
        }
      })
    );
    setCustomFacetData(results);
  }, [customFacetKeys, projectId, filters]);

  useEffect(() => {
    fetchCustomFacets();
  }, [fetchCustomFacets]);

  const handleAddCustomFacet = useCallback((key: string) => {
    setCustomFacetKeys((prev) => {
      if (prev.includes(key)) return prev;
      return [...prev, key];
    });
  }, []);

  const handleRemoveCustomFacet = useCallback((facetKey: string) => {
    const realKey = facetKey.startsWith('attr.') ? facetKey.slice(5) : facetKey;
    setCustomFacetKeys((prev) => prev.filter((k) => k !== realKey));
    setCustomFacetData((prev) => prev.filter((f) => f.key !== facetKey));
  }, []);

  // Aggregates state — keyed by groupBy value for multi-panel support
  type AggDataEntry = {
    groupBy: string;
    topValues: { group_value: string; count: number }[];
    timeSeries: { bucket: string; group_value: string; count: number }[];
  };
  const [aggDataMap, setAggDataMap] = useState<Record<string, AggDataEntry>>(
    {}
  );
  const [aggLoading, setAggLoading] = useState(false);
  // Convenience: single aggData for backward compat (first panel)
  const aggData = aggDataMap[aggGroupBy] || null;

  // Saved Queries State
  const [savedQueries, setSavedQueries] = useState<ArgusSavedQuery[]>([]);
  const [currentQueryId, setCurrentQueryId] = useState<number | null>(null);

  // Editable Query Name
  const defaultQueryName = t('argus.logs.newQuery', 'New Logs Query');
  const [queryName, setQueryName] = useState(
    (location.state as any)?.queryName || defaultQueryName
  );

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

  const currentPeriod = useMemo(() => {
    if (filters.dateRange.type === 'preset' && filters.dateRange.preset)
      return filters.dateRange.preset;
    return '14d';
  }, [filters.dateRange]);

  // Lazy-loading callback for QueryAQLEditor: fetch values for a specific field
  const fetchFieldValues = useCallback(
    async (fieldKey: string): Promise<string[]> => {
      try {
        const apiParams = argusFilterStateToApiParams(filters);
        const data = await argusService.getAttributeFacet(projectId, fieldKey, {
          period: apiParams.period || currentPeriod,
          start: apiParams.start,
          end: apiParams.end,
        });
        return data.map((d) => d.attr_value);
      } catch {
        return [];
      }
    },
    [projectId, filters, currentPeriod]
  );

  // Discovered attribute facets from backend API (time-period only, no search filter)
  const [discoveredFacets, setDiscoveredFacets] = useState<FacetGroup[]>([]);

  const mappedFacets = useMemo(() => {
    const result: Record<string, { value: string; count: number }[]> = {};

    // Base facets from getLogFacets API
    if (facets.levels?.length) {
      const vals = facets.levels.map((l) => ({
        value: l.level,
        count: Number(l.count),
      }));
      result.severity = vals;
      result.level = vals;
    }
    if (facets.services?.length) {
      const vals = facets.services.map((s) => ({
        value: s.service,
        count: Number(s.count),
      }));
      result.service = vals;
    }
    if (facets.environments?.length) {
      const vals = facets.environments.map((e) => ({
        value: e.environment,
        count: Number(e.count),
      }));
      result.environment = vals;
    }
    if (facets.loggers?.length) {
      const vals = facets.loggers.map((l) => ({
        value: l.logger_name,
        count: Number(l.count),
      }));
      result.logger = vals;
      result.logger_name = vals;
    }
    if (facets.releases?.length) {
      const vals = facets.releases.map((r) => ({
        value: r.release,
        count: Number(r.count),
      }));
      result.release = vals;
    }

    // Discovered facets from log attributes
    for (const df of discoveredFacets) {
      const key = df.label;
      if (!result[key]) {
        result[key] = df.values;
      }
    }

    // Custom facets from user-defined attribute keys
    for (const cf of customFacetData) {
      const key = cf.label;
      if (!result[key]) {
        result[key] = cf.values;
      }
    }

    return result;
  }, [facets, discoveredFacets, customFacetData]);

  // Build facet groups for the sidebar component
  const facetGroups: FacetGroup[] = useMemo(
    () =>
      [
        {
          key: 'severity',
          label: t('argus.logs.facet.severity', 'Severity'),
          values: mappedFacets.severity || [],
        },
        {
          key: 'service',
          label: t('argus.logs.facet.service', 'Service'),
          values: mappedFacets.service || [],
        },
        {
          key: 'environment',
          label: t('argus.logs.facet.environment', 'Environment'),
          values: mappedFacets.environment || [],
        },
        {
          key: 'logger',
          label: t('argus.logs.facet.logger', 'Logger'),
          values: mappedFacets.logger || [],
        },
        {
          key: 'release',
          label: t('argus.logs.facet.release', 'Release'),
          values: mappedFacets.release || [],
        },
      ].filter((g) => g.values.length > 0),
    [mappedFacets, t]
  );

  // ─── Fetch ───
  const fetchLogs = useCallback(
    async (append = false, cursor?: string) => {
      setLoading(true);
      try {
        const apiParams = argusFilterStateToApiParams(filters);
        const params: Record<string, any> = {
          period: apiParams.period || '14d',
          limit: 25,
          order: 'DESC',
        };
        if (apiParams.start) params.start = apiParams.start;
        if (apiParams.end) params.end = apiParams.end;
        if (search.trim()) params.search = search.trim();
        if (cursor) params.cursor = cursor;

        const result = await argusService.browseLogs(projectId, params);
        const newLogs = result.data || [];
        if (append) {
          setLogs((prev) => [...prev, ...newLogs]);
        } else {
          setLogs(newLogs);
          setUrlState({ log: '' });
        }
        setHasMore(result.meta?.hasMore || false);
      } catch (err) {
        console.error('Failed to fetch logs', err);
      } finally {
        setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [projectId, filters, search]
  );

  const fetchFacets = useCallback(async () => {
    try {
      const apiParams = argusFilterStateToApiParams(filters);
      const periodParam = apiParams.period || currentPeriod;

      // Fetch base facets and attribute keys in parallel (time-period only)
      const [facetData, attrKeys, messageFacet] = await Promise.all([
        argusService.getLogFacets(
          projectId,
          periodParam,
          apiParams.start,
          apiParams.end
        ),
        argusService
          .getAttributeKeys(projectId, {
            period: periodParam,
            start: apiParams.start,
            end: apiParams.end,
            limit: 30,
          })
          .catch(
            () =>
              [] as {
                key: string;
                count: number;
                values: { attr_value: string; count: string }[];
              }[]
          ),
        argusService
          .getAttributeFacet(projectId, 'message', {
            period: periodParam,
            start: apiParams.start,
            end: apiParams.end,
          })
          .catch(() => []),
      ]);

      setFacets(facetData);

      // Convert attribute keys to FacetGroup format
      const discovered: FacetGroup[] = attrKeys.map((ak) => ({
        key: `discovered.${ak.key}`,
        label: ak.key,
        values: ak.values.map((v) => ({
          value: v.attr_value,
          count: Number(v.count),
        })),
      }));

      // Add message facet as a discovered facet so it appears in autocomplete
      if (messageFacet.length > 0) {
        discovered.push({
          key: 'discovered.message',
          label: 'message',
          values: messageFacet.map((m) => ({
            value: m.attr_value,
            count: Number(m.count),
          })),
        });
      }

      setDiscoveredFacets(discovered);
    } catch (err) {
      console.error('Failed to fetch facets', err);
    }
  }, [projectId, filters, currentPeriod]);

  const fetchVolume = useCallback(async () => {
    try {
      const apiParams = argusFilterStateToApiParams(filters);
      const data = await argusService.getLogVolume(projectId, {
        period: apiParams.period || '14d',
        start: apiParams.start,
        end: apiParams.end,
        search: search.trim() || undefined,
      });
      setVolume(data);
    } catch (err) {
      console.error('Failed to fetch volume', err);
    }
  }, [projectId, filters, search]);

  const fetchAll = useCallback(() => {
    fetchLogs();
    fetchFacets();
    fetchVolume();
  }, [fetchLogs, fetchFacets, fetchVolume]);

  const fetchAggregates = useCallback(
    async (groupByOverrides?: string[]) => {
      const keys = groupByOverrides || aggGroupBys;
      setAggLoading(true);
      try {
        const apiParams = argusFilterStateToApiParams(filters);
        // Use allSettled so one failed panel doesn't break the rest
        const settled = await Promise.allSettled(
          keys.map((gKey) =>
            argusService.getLogAggregate(projectId, {
              period: apiParams.period || currentPeriod,
              start: apiParams.start,
              end: apiParams.end,
              groupBy: gKey,
              search: search.trim() || undefined,
            })
          )
        );
        const newMap: Record<string, AggDataEntry> = {};
        settled.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            const data = result.value;
            // Use the requested key (not the returned groupBy) in case backend fallback changed it
            newMap[keys[idx]] = data;
          } else {
            // Store empty result so the panel renders in empty state instead of disappearing
            newMap[keys[idx]] = {
              groupBy: keys[idx],
              topValues: [],
              timeSeries: [],
            };
          }
        });
        setAggDataMap(newMap);
      } catch (err) {
        console.error('Failed to fetch aggregates', err);
      } finally {
        setAggLoading(false);
      }
    },
    [projectId, filters, currentPeriod, aggGroupBys, search]
  );

  useEffect(() => {
    fetchAll();
    if (activeTab === 1) fetchAggregates();
    argusService
      .listSavedQueries(projectId, 'logs')
      .then(setSavedQueries)
      .catch(() => setSavedQueries([]));
  }, [fetchAll]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Patterns state ───
  const [patterns, setPatterns] = useState<PatternEntry[]>([]);
  const [patternsLoading, setPatternsLoading] = useState(false);

  const fetchPatterns = useCallback(async () => {
    setPatternsLoading(true);
    try {
      const apiParams = argusFilterStateToApiParams(filters);
      const data = await argusService.getLogPatterns(projectId, {
        period: apiParams.period,
        start: apiParams.start,
        end: apiParams.end,
        search: search.trim() || undefined,
      });
      setPatterns(data);
    } catch (e) {
      console.error('Failed to fetch patterns', e);
    }
    setPatternsLoading(false);
  }, [projectId, filters, search]);

  // Auto-fetch patterns when switching to patterns tab or on mount when already on tab 2
  useEffect(() => {
    if (activeTab === 2) fetchPatterns();
  }, [activeTab, fetchPatterns]);

  const handleSearchSubmit = useCallback(
    (val: string) => {
      setSearch(val);
      setUrlState({ q: val });
      // No explicit fetchLogs() here — setSearch triggers the
      // fetchLogs → fetchAll → useEffect([fetchAll]) chain automatically.
    },
    [setUrlState]
  );

  // Side panel handlers
  const handleSelectLog = useCallback(
    (index: number) => {
      const log = logs[index];
      if (log) {
        setUrlState({ log: log.log_id });
        setIsRightPanelOpen(true);
      }
    },
    [logs, setUrlState, setIsRightPanelOpen]
  );

  const handleCloseSidePanel = useCallback(() => {
    setIsRightPanelOpen(false);
  }, [setIsRightPanelOpen]);

  const handlePrevLog = useCallback(() => {
    if (selectedLogIndex !== null && selectedLogIndex > 0) {
      setUrlState({ log: logs[selectedLogIndex - 1].log_id });
    }
  }, [selectedLogIndex, logs, setUrlState]);

  const handleNextLog = useCallback(() => {
    if (selectedLogIndex !== null && selectedLogIndex < logs.length - 1) {
      setUrlState({ log: logs[selectedLogIndex + 1].log_id });
    }
  }, [selectedLogIndex, logs, setUrlState]);

  const handleLoadMore = useCallback(() => {
    if (logs.length > 0) fetchLogs(true, logs[logs.length - 1].timestamp);
  }, [logs, fetchLogs]);

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

  // ─── Saved Query Handlers ───
  const handleSaveQuery = async (
    finalName: string,
    extras?: Record<string, any>
  ) => {
    if (!finalName.trim()) return;
    try {
      const res = await argusService.createSavedQuery(projectId, {
        name: finalName.trim(),
        query_config: {
          search: search.trim(),
          columns,
          columnNames,
          period: currentPeriod,
          groupBy: aggGroupBys.length > 0 ? aggGroupBys.join(',') : 'level',
          activeTab,
          ...extras,
        },
        display_type: 'table',
        query_type: 'logs',
      });
      const updated = await argusService.listSavedQueries(projectId, 'logs');
      setSavedQueries(updated);
      setQueryName(finalName.trim());
      if (res.id) setCurrentQueryId(res.id);
    } catch (err) {
      console.error('Failed to save log query:', err);
    }
  };

  const handleRename = async (newName: string) => {
    setQueryName(newName);
    if (currentQueryId) {
      try {
        await argusService.updateSavedQuery(projectId, currentQueryId, {
          name: newName,
        });
        const updated = await argusService.listSavedQueries(projectId, 'logs');
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

  const handleLoadSavedQuery = (
    sq: ArgusSavedQuery,
    onExtrasLoaded?: (extras: Record<string, any>) => void
  ) => {
    try {
      const cfg =
        typeof sq.query_config === 'string'
          ? JSON.parse(sq.query_config)
          : sq.query_config;
      if (cfg.search !== undefined) {
        setSearch(cfg.search);
        setUrlState({ q: cfg.search });
      }
      if (cfg.columns) setColumns(cfg.columns);
      if (cfg.columnNames) setColumnNames(cfg.columnNames);
      if (cfg.period) setUrlState({ period: cfg.period });
      if (cfg.groupBy) setUrlState({ groupBy: cfg.groupBy });
      if (cfg.activeTab !== undefined)
        setUrlState({ tab: String(cfg.activeTab) });
      setQueryName(sq.name);
      setCurrentQueryId(sq.id);

      // Pass extra fields (displayDensity, wrapLines) to the caller
      if (onExtrasLoaded) {
        onExtrasLoaded(cfg);
      }
    } catch (err) {
      console.error('Failed to load saved query config:', err);
      setQueryName(sq.name);
      setCurrentQueryId(sq.id);
    }
  };

  const totalLogCount =
    facets.levels?.reduce((s, l) => s + Number(l.count), 0) || 0;

  return {
    projectId,
    activeTab,
    aggGroupBy,
    aggGroupBys,
    filters,
    search,
    logs,
    loading,
    facets,
    volume,
    hasMore,
    columns,
    setColumns,
    columnNames,
    setColumnNames,
    dynamicAvailableColumns,
    selectedLogIndex,
    selectedLog,
    selectedLogLoading,
    isRightPanelOpen,
    setIsRightPanelOpen,
    customFacetKeys,
    customFacetData,
    discoveredFacets,
    aggData,
    aggDataMap,
    aggLoading,
    savedQueries,
    currentQueryId,
    queryName,
    defaultQueryName,
    currentPeriod,
    mappedFacets,
    facetGroups,
    totalLogCount,
    fetchFieldValues,

    // Handlers
    setUrlState,
    fetchLogs,
    fetchFacets,
    fetchVolume,
    fetchAggregates,
    fetchPatterns,
    fetchAll,
    handleAddCustomFacet,
    handleRemoveCustomFacet,
    handleSearchSubmit,
    handleSelectLog,
    handleCloseSidePanel,
    handlePrevLog,
    handleNextLog,
    handleLoadMore,
    handleFilterChange,
    handleZoom,
    handleSaveQuery,
    handleRename,
    handleDeleteSavedQuery,
    handleLoadSavedQuery,

    // Patterns
    patterns,
    patternsLoading,
  };
}
