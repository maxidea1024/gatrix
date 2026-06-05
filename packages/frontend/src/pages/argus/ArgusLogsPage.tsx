import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Box, Typography, Button, IconButton, Chip,
  useTheme, alpha, CircularProgress, Collapse,
} from '@mui/material';
import SafeTooltip from '@/components/common/SafeTooltip';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import { useNavigate, useLocation } from 'react-router-dom';
import useArgusUrlState from '@/hooks/useArgusUrlState';
import {
  Search as SearchIcon, Close as CloseIcon,
  KeyboardArrowDown as ExpandIcon, KeyboardArrowRight as CollapseIcon,
  FiberManualRecord as DotIcon,
  Terminal as LogIcon,
  FilterList as FilterIcon,
  Save as SaveIcon, Bookmark as BookmarkIcon, BookmarkBorder as BookmarkBorderIcon,
  PlayArrow as PlayArrowIcon, Stop as StopIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip as ChartTooltip, Legend } from 'chart.js';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import PageContentLoader from '@/components/common/PageContentLoader';
import ArgusFilterBar, { ArgusFilterState, defaultArgusFilterState, argusFilterStateToApiParams } from '@/components/argus/ArgusFilterBar';
import DiscoverFacetMap from '@/components/argus/DiscoverFacetMap';
import ArgusQueryBuilder from '@/components/argus/ArgusQueryBuilder';
import SearchAutocompletePopover, { SearchAutocompletePopoverHandle } from '@/components/argus/SearchAutocompletePopover';
import { ArgusSearchInput } from '@/components/argus/ArgusSearchInput';
import argusService, { ArgusLogEntry, ArgusSavedQuery } from '@/services/argusService';
import PageHeader from '@/components/common/PageHeader';
import EditablePageTitle from '@/components/common/EditablePageTitle';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { formatWith } from '@/utils/dateFormat';
import { useResizableSplit } from '@/hooks/useResizableSplit';

// Page-specific components
import LogDetail from './components/LogDetail';
import LogVolumeChart, { VolumePoint } from './components/LogVolumeChart';
import LogsToolbar from './components/LogsToolbar';
import LogsTablePanel from './components/LogsTablePanel';
import LogsAggregatePanel from './components/LogsAggregatePanel';
import { EditTableDialog, SaveQueryDialog, SavedQueriesDrawer } from './components/LogsDialogs';
import FacetSidebar, { FacetGroup } from '@/components/argus/FacetSidebar';
import LogSidePanel from './components/LogSidePanel';

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip, Legend);

/* ─── Types ─── */

interface LogFacets {
  levels: { level: string; count: number }[];
  services: { service: string; count: number }[];
  environments: { environment: string; count: number }[];
  loggers: { logger_name: string; count: number }[];
}

const SEVERITY_COLORS: Record<string, string> = {
  fatal: '#d32f2f', error: '#f44336', warn: '#ff9800', warning: '#ff9800',
  info: '#2196f3', debug: '#9e9e9e', trace: '#607d8b',
};

const DEFAULT_COLUMNS = ['timestamp', 'severity', 'message'];

/** Log row display density modes */
export type DisplayDensity = 'compact' | 'default' | 'expanded';
const DENSITY_PY: Record<DisplayDensity, number> = { compact: 0.15, default: 0.5, expanded: 1 };

/* ─── Isolated Search Input Component ─── */

/**
 * Extract free-text search terms from a query string (ignoring key:value pairs)
 * and wrap matching substrings in the text with a highlighted <mark> element.
 *
 * - key:"value" and key:value patterns are skipped (they are field filters, not text searches)
 * - AND/OR operators are skipped
 * - Remaining tokens are treated as free-text search terms to highlight
 */
function highlightSearchTerms(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;

  // Tokenize query: extract tokens that are NOT key:value pairs and NOT logical operators
  const tokens = query.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  const freeTextTerms = tokens
    .filter(t => !/^[\w.-]+[:!=]/.test(t))  // skip key:value, key!=value
    .filter(t => !['AND', 'OR', 'NOT'].includes(t.toUpperCase()))
    .map(t => t.replace(/^"|"$/g, '').trim())  // strip quotes
    .filter(t => t.length > 0);

  if (freeTextTerms.length === 0) return text;

  // Build regex from terms, escaping special chars
  const escaped = freeTextTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');

  const parts = text.split(regex);
  if (parts.length === 1) return text;

  // When splitting by a capturing group regex, matched segments appear
  // at odd indices (1, 3, 5, ...) in the resulting array.
  return parts.map((part, i) =>
    i % 2 === 1
      ? <mark key={i} style={{ backgroundColor: 'rgba(255,213,79,0.4)', borderRadius: 2, padding: '0 1px' }}>{part}</mark>
      : part
  );
}

const ArgusLogsPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

  // ─── URL-driven state ───
  const URL_PARAMS = useMemo(() => ({
    period:  { key: 'period',  default: '14d', storageKey: 'argus-logs-period' },
    start:   { key: 'start',   default: '' },
    end:     { key: 'end',     default: '' },
    q:       { key: 'q',       default: '' },
    tab:     { key: 'tab',     default: '0' },
    groupBy: { key: 'groupBy', default: 'level' },
    queryId: { key: 'queryId', default: '' },
    filters: { key: 'filters', default: '' },
    log:     { key: 'log',     default: '' },
  }), []);
  const [urlState, setUrlState] = useArgusUrlState(URL_PARAMS);

  const activeTab = parseInt(urlState.tab, 10) || 0;
  const aggGroupBy = urlState.groupBy;

  // Derive filters from URL period
  const [filters, setFilters] = useState<ArgusFilterState>(() => {
    if (urlState.period === 'custom') {
      if (urlState.start && urlState.end) {
        const base = defaultArgusFilterState('custom');
        base.dateRange = { type: 'custom', start: new Date(urlState.start), end: new Date(urlState.end) };
        return base;
      }
      return defaultArgusFilterState('14d');
    }
    return defaultArgusFilterState(urlState.period);
  });

  useEffect(() => {
    setFilters(prev => {
      if (urlState.period === 'custom') {
        if (urlState.start && urlState.end) {
          return {
            ...prev,
            dateRange: { type: 'custom', start: new Date(urlState.start), end: new Date(urlState.end) }
          };
        }
        return {
          ...prev,
          dateRange: { type: 'preset', preset: '14d' }
        };
      }
      return {
        ...prev,
        dateRange: { type: 'preset', preset: urlState.period }
      };
    });
  }, [urlState.period, urlState.start, urlState.end]);

  useEffect(() => {
    if (urlState.period === 'custom' && (!urlState.start || !urlState.end)) {
      setUrlState({ period: '14d' });
    }
  }, [urlState.period, urlState.start, urlState.end, setUrlState]);

  // Search state
  const [search, setSearch] = useState<string>(urlState.q || '');
  const [searchDebounce, setSearchDebounce] = useState(urlState.q || '');

  useEffect(() => {
    setSearch(urlState.q || '');
  }, [urlState.q]);

  // ─── State ───
  const [logs, setLogs] = useState<ArgusLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [facets, setFacets] = useState<LogFacets>({ levels: [], services: [], environments: [], loggers: [] });
  const [volume, setVolume] = useState<VolumePoint[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(false);

  const [columns, setColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [editTableOpen, setEditTableOpen] = useState(false);
  const [tempColumns, setTempColumns] = useState<string[]>([]);

  // Log viewer features
  const [wrapLines, setWrapLines] = useState(false);
  const [logsFullscreen, setLogsFullscreen] = useState(false);
  const [showGotoTime, setShowGotoTime] = useState(false);
  const [gotoTime, setGotoTime] = useState('');
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Facet sidebar state
  const [facetSidebarCollapsed, setFacetSidebarCollapsed] = useLocalStorage('argus_facet_sidebar_collapsed', false);

  // Side panel state (selected log via URL)
  const selectedLogIndex = useMemo(() => {
    if (!urlState.log) return null;
    const idx = logs.findIndex(l => l.log_id === urlState.log);
    return idx >= 0 ? idx : null;
  }, [logs, urlState.log]);
  const selectedLog = selectedLogIndex !== null ? logs[selectedLogIndex] || null : null;
  const [isRightPanelOpen, setIsRightPanelOpen] = useLocalStorage('argus_right_panel_open', false);

  // Resizable side panel splitter
  const { splitWidth: panelWidth, isDragging: isPanelDragging, handleMouseDown: handlePanelSplitterMouseDown } = useResizableSplit({
    storageKey: 'argus_log_panel_width',
    defaultWidth: 420,
    minWidth: 320,
    maxWidth: 700,
    invertDelta: true,
  });

  // Resizable facet sidebar splitter
  const { splitWidth: facetWidth, isDragging: isFacetDragging, handleMouseDown: handleFacetSplitterMouseDown } = useResizableSplit({
    storageKey: 'argus_facet_panel_width',
    defaultWidth: 240,
    minWidth: 150,
    maxWidth: 500,
  });

  // Display density
  const [displayDensity, setDisplayDensity] = useState<DisplayDensity>('default');

  // ─── Active Filters (chip tags from facet sidebar / detail panel) ───
  type ActiveFilter = { key: string; value: string; exclude: boolean; enabled: boolean };

  /** Deserialize filters from URL param. Format: key:value (include+enabled), !key:value (exclude), ~key:value (disabled), ~!key:value (disabled+exclude) */
  const parseFiltersFromUrl = useCallback((raw: string): ActiveFilter[] => {
    if (!raw) return [];
    return raw.split(',').map(part => {
      let enabled = true;
      let exclude = false;
      let s = part.trim();
      if (s.startsWith('~')) { enabled = false; s = s.slice(1); }
      if (s.startsWith('!')) { exclude = true; s = s.slice(1); }
      const colonIdx = s.indexOf(':');
      if (colonIdx < 0) return null;
      return { key: s.slice(0, colonIdx), value: s.slice(colonIdx + 1), exclude, enabled };
    }).filter(Boolean) as ActiveFilter[];
  }, []);

  const serializeFiltersToUrl = useCallback((filters: ActiveFilter[]): string => {
    if (filters.length === 0) return '';
    return filters.map(f => {
      const prefix = (!f.enabled ? '~' : '') + (f.exclude ? '!' : '');
      return `${prefix}${f.key}:${f.value}`;
    }).join(',');
  }, []);

  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>(
    () => parseFiltersFromUrl(urlState.filters)
  );

  // Sync activeFilters → URL
  useEffect(() => {
    const serialized = serializeFiltersToUrl(activeFilters);
    if (serialized !== (urlState.filters || '')) {
      setUrlState({ filters: serialized });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilters]);

  /** Toggle a facet chip filter. If already exists, toggle enabled; otherwise add as enabled. */
  const toggleActiveFilter = useCallback((key: string, value: string, exclude: boolean = false) => {
    setActiveFilters(prev => {
      const idx = prev.findIndex(f => f.key === key && f.value === value && f.exclude === exclude);
      if (idx >= 0) {
        // Already exists — toggle enabled/disabled
        return prev.map((f, i) => i === idx ? { ...f, enabled: !f.enabled } : f);
      }
      return [...prev, { key, value, exclude, enabled: true }];
    });
  }, []);

  const removeActiveFilter = useCallback((idx: number) => {
    setActiveFilters(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const clearAllActiveFilters = useCallback(() => {
    setActiveFilters([]);
  }, []);

  // Re-fetch when activeFilters change
  useEffect(() => {
    fetchLogs();
    fetchVolume();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilters]);

  // ─── Custom Facets (user-defined attribute keys) ───
  const CUSTOM_FACETS_KEY = 'argus_custom_facets';
  const [customFacetKeys, setCustomFacetKeys] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(CUSTOM_FACETS_KEY) || '[]'); }
    catch { return []; }
  });
  const [customFacetData, setCustomFacetData] = useState<FacetGroup[]>([]);

  // Persist custom facet keys
  useEffect(() => {
    localStorage.setItem(CUSTOM_FACETS_KEY, JSON.stringify(customFacetKeys));
  }, [customFacetKeys]);

  // Fetch custom facet values from backend
  const fetchCustomFacets = useCallback(async () => {
    if (customFacetKeys.length === 0) { setCustomFacetData([]); return; }
    const apiParams = argusFilterStateToApiParams(filters);
    const results = await Promise.all(
      customFacetKeys.map(async (key) => {
        try {
          const data = await argusService.getAttributeFacet(projectId, key, {
            period: apiParams.period, start: apiParams.start, end: apiParams.end,
          });
          return {
            key: `attr.${key}`,
            label: key,
            values: data.map(d => ({ value: d.attr_value, count: Number(d.count) })),
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
    setCustomFacetKeys(prev => {
      if (prev.includes(key)) return prev;
      return [...prev, key];
    });
  }, []);

  const handleRemoveCustomFacet = useCallback((facetKey: string) => {
    // facetKey is "attr.xxx", extract the real key
    const realKey = facetKey.startsWith('attr.') ? facetKey.slice(5) : facetKey;
    setCustomFacetKeys(prev => prev.filter(k => k !== realKey));
    setCustomFacetData(prev => prev.filter(f => f.key !== facetKey));
  }, []);

  // Aggregates state
  const [aggData, setAggData] = useState<{
    groupBy: string;
    topValues: { group_value: string; count: number }[];
    timeSeries: { bucket: string; group_value: string; count: number }[];
  } | null>(null);
  const [aggLoading, setAggLoading] = useState(false);

  // Query Builder State
  const [builderAnchorEl, setBuilderAnchorEl] = useState<HTMLElement | null>(null);

  // Saved Queries State
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [savedQueries, setSavedQueries] = useState<ArgusSavedQuery[]>([]);
  const [savedPanelOpen, setSavedPanelOpen] = useState(false);
  const [currentQueryId, setCurrentQueryId] = useState<number | null>(null);

  // Editable Query Name
  const defaultQueryName = t('argus.logs.newQuery', 'New Logs Query');
  const [queryName, setQueryName] = useState((location.state as any)?.queryName || defaultQueryName);

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

  const currentPeriod = useMemo(() => {
    if (filters.dateRange.type === 'preset' && filters.dateRange.preset) return filters.dateRange.preset;
    return '14d';
  }, [filters.dateRange]);

  const mappedFacets = useMemo(() => ({
    severity: facets.levels?.map(l => ({ value: l.level, count: Number(l.count) })) || [],
    service: facets.services?.map(s => ({ value: s.service, count: Number(s.count) })) || [],
    environment: facets.environments?.map(e => ({ value: e.environment, count: Number(e.count) })) || [],
    logger: facets.loggers?.map(l => ({ value: l.logger_name, count: Number(l.count) })) || [],
  }), [facets]);

  // Build facet groups for the sidebar component
  const facetGroups: FacetGroup[] = useMemo(() => [
    { key: 'severity', label: t('argus.logs.facet.severity', 'Severity'), values: mappedFacets.severity },
    { key: 'service', label: t('argus.logs.facet.service', 'Service'), values: mappedFacets.service },
    { key: 'environment', label: t('argus.logs.facet.environment', 'Environment'), values: mappedFacets.environment },
    { key: 'logger', label: t('argus.logs.facet.logger', 'Logger'), values: mappedFacets.logger },
  ].filter(g => g.values.length > 0), [mappedFacets, t]);

  // ─── Search + Filter Merge Helper ───
  /** Merge search-bar text + active chip filters into a single QueryParser-compatible search string */
  const buildSearchWithFilters = useCallback((): string | undefined => {
    const parts: string[] = [];
    if (searchDebounce.trim()) parts.push(searchDebounce.trim());
    for (const f of activeFilters) {
      if (!f.enabled) continue;
      const prefix = f.exclude ? '!' : '';
      parts.push(`${prefix}${f.key}:"${f.value}"`);
    }
    return parts.length > 0 ? parts.join(' ') : undefined;
  }, [searchDebounce, activeFilters]);

  // ─── Fetch ───
  const fetchLogs = useCallback(async (append = false, cursor?: string) => {
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
      if (apiParams.environment) params.environment = apiParams.environment;
      if (searchDebounce.trim()) params.search = searchDebounce.trim();
      if (cursor) params.cursor = cursor;

      // Inject active chip filters into the search query string
      // This ensures they go through QueryParser and don't conflict with search-bar conditions
      const mergedSearch = buildSearchWithFilters();
      if (mergedSearch) params.search = mergedSearch;

      const result = await argusService.browseLogs(projectId, params);
      const newLogs = result.data || [];
      if (append) {
        setLogs(prev => [...prev, ...newLogs]);
      } else {
        setLogs(newLogs);
        setSelectedLogIndex(null);  // Reset selection when log list is replaced
      }
      setHasMore(result.meta?.hasMore || false);
    } catch (err) { console.error('Failed to fetch logs', err); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, filters, searchDebounce, activeFilters]);

  const fetchFacets = useCallback(async () => {
    try {
      const apiParams = argusFilterStateToApiParams(filters);
      const data = await argusService.getLogFacets(projectId, apiParams.period || currentPeriod, apiParams.start, apiParams.end);
      setFacets(data);
    } catch (err) { console.error('Failed to fetch facets', err); }
  }, [projectId, filters, currentPeriod]);

  const fetchVolume = useCallback(async () => {
    try {
      const apiParams = argusFilterStateToApiParams(filters);
      const data = await argusService.getLogVolume(projectId, {
        period: apiParams.period || '14d',
        start: apiParams.start,
        end: apiParams.end,
        search: buildSearchWithFilters(),
      });
      setVolume(data);
    } catch (err) { console.error('Failed to fetch volume', err); }
  }, [projectId, filters, buildSearchWithFilters]);

  const fetchAll = useCallback(() => {
    fetchLogs(); fetchFacets(); fetchVolume();
  }, [fetchLogs, fetchFacets, fetchVolume]);

  const fetchAggregates = useCallback(async (groupByVal?: string) => {
    setAggLoading(true);
    try {
      const apiParams = argusFilterStateToApiParams(filters);
      const data = await argusService.getLogAggregate(projectId, {
        period: apiParams.period || currentPeriod,
        start: apiParams.start,
        end: apiParams.end,
        groupBy: groupByVal || aggGroupBy,
        search: buildSearchWithFilters(),
      });
      setAggData(data);
    } catch (err) { console.error('Failed to fetch aggregates', err); }
    finally { setAggLoading(false); }
  }, [projectId, filters, currentPeriod, aggGroupBy, buildSearchWithFilters]);

  useEffect(() => {
    fetchAll();
    if (activeTab === 1) fetchAggregates();
    argusService.listSavedQueries(projectId, 'logs').then(setSavedQueries).catch(() => setSavedQueries([]));
  }, [fetchAll]);

  // ─── Patterns state ───
  type PatternEntry = {
    pattern: string; count: number; level: string; service: string;
    first_seen: string; last_seen: string; sample_message: string;
  };
  const [patterns, setPatterns] = useState<PatternEntry[]>([]);
  const [patternsLoading, setPatternsLoading] = useState(false);

  const fetchPatterns = useCallback(async () => {
    setPatternsLoading(true);
    try {
      const apiParams = argusFilterStateToApiParams(filters);
      const data = await argusService.getLogPatterns(projectId, {
        period: apiParams.period, start: apiParams.start, end: apiParams.end,
        search: buildSearchWithFilters(),
      });
      setPatterns(data);
    } catch (e) { console.error('Failed to fetch patterns', e); }
    setPatternsLoading(false);
  }, [projectId, filters, buildSearchWithFilters]);

  // Auto-fetch patterns when switching to patterns tab
  useEffect(() => {
    if (activeTab === 2) fetchPatterns();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Live Tail state ───
  const [liveTailLogs, setLiveTailLogs] = useState<ArgusLogEntry[]>([]);
  const [liveTailActive, setLiveTailActive] = useState(false);
  const [liveTailPaused, setLiveTailPaused] = useState(false);
  const [liveTailCount, setLiveTailCount] = useState(0);
  const liveTailRef = useRef<EventSource | null>(null);
  const liveTailBufferRef = useRef<ArgusLogEntry[]>([]);

  // Start/stop live tail
  useEffect(() => {
    if (activeTab !== 3) {
      // Close connection when leaving Live Tail tab
      if (liveTailRef.current) {
        liveTailRef.current.close();
        liveTailRef.current = null;
      }
      setLiveTailActive(false);
      return;
    }
  }, [activeTab]);

  const startLiveTail = useCallback(() => {
    if (liveTailRef.current) liveTailRef.current.close();
    setLiveTailLogs([]);
    setLiveTailCount(0);
    setLiveTailPaused(false);
    setLiveTailActive(true);

    const es = argusService.createLiveTailConnection(
      projectId,
      { search: searchDebounce || undefined },
      (newLogs) => {
        setLiveTailCount(prev => prev + newLogs.length);
        if (!liveTailPaused) {
          setLiveTailLogs(prev => [...prev, ...newLogs].slice(-500));
        } else {
          liveTailBufferRef.current.push(...newLogs);
        }
      },
      () => { /* SSE error — will auto-reconnect */ }
    );
    liveTailRef.current = es;
  }, [projectId, searchDebounce, liveTailPaused]);

  const stopLiveTail = useCallback(() => {
    if (liveTailRef.current) {
      liveTailRef.current.close();
      liveTailRef.current = null;
    }
    setLiveTailActive(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (liveTailRef.current) liveTailRef.current.close();
    };
  }, []);

  // ─── Handlers ───
  const handleDebouncedSearchChange = useCallback((val: string) => {
    setSearchDebounce(val);
  }, []);

  const handleSearchSubmit = useCallback((val: string) => {
    setSearch(val);
    setUrlState({ q: val });
    setTimeout(() => fetchLogs(), 10);
  }, [setUrlState, fetchLogs]);

  const addSearchTag = useCallback((key: string, value: string, op: string = 'is') => {
    const opStr = op === '!=' ? '!=' : ':';
    const appendStr = `${key}${opStr}"${value}"`;

    setSearch(prevSearch => {
      let newSearch = prevSearch;
      const colonMatch = prevSearch.match(/([\w.-]+):([^\s]*)$/);
      if (colonMatch && colonMatch[1] === key) {
        newSearch = prevSearch.substring(0, prevSearch.length - colonMatch[0].length);
      } else {
        const bareMatch = prevSearch.match(/([\w.-]+)$/);
        if (bareMatch && bareMatch[1] === key) {
          newSearch = prevSearch.substring(0, prevSearch.length - bareMatch[0].length);
        }
      }

      const finalStr = (newSearch.trim() ? newSearch.trim() + ' ' : '') + appendStr + ' ';
      setUrlState({ q: finalStr.trim() });
      setTimeout(() => fetchLogs(), 10);
      return finalStr;
    });
  }, [setUrlState, fetchLogs]);

  const toggleRow = useCallback((logId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(logId) ? next.delete(logId) : next.add(logId);
      return next;
    });
  }, []);

  // Side panel handlers
  const handleSelectLog = useCallback((index: number) => {
    const log = logs[index];
    if (log) {
      setUrlState({ log: log.log_id });
      setIsRightPanelOpen(true);
    }
  }, [logs, setUrlState, setIsRightPanelOpen]);

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

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `logs-${new Date().toISOString()}.json`; a.click();
  };

  const handleFilterChange = (newFilters: ArgusFilterState) => {
    setFilters(newFilters);
    if (newFilters.dateRange.type === 'preset' && newFilters.dateRange.preset) {
      setUrlState({ period: newFilters.dateRange.preset, start: '', end: '' });
    } else if (newFilters.dateRange.type === 'custom' && newFilters.dateRange.start && newFilters.dateRange.end) {
      setUrlState({ period: 'custom', start: newFilters.dateRange.start.toISOString(), end: newFilters.dateRange.end.toISOString() });
    }
  };

  const handleZoom = useCallback((start: string, end: string) => {
    setUrlState({ period: 'custom', start, end });
  }, [setUrlState]);

  const openEditTable = () => { setTempColumns([...columns]); setEditTableOpen(true); };
  const saveEditTable = () => { setColumns(tempColumns); setEditTableOpen(false); };
  const toggleColumn = (col: string) => {
    setTempColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  };

  const handleDetailFilter = useCallback((key: string, val: string, exclude: boolean) => {
    toggleActiveFilter(key, val, exclude);
  }, [toggleActiveFilter]);

  const handleGotoTimeSubmit = () => {
    if (gotoTime) {
      const parts = gotoTime.split(':').map(Number);
      if (parts.length >= 2) {
        const targetSec = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
        let closestIdx = 0, closestDiff = Infinity;
        logs.forEach((log, idx) => {
          const d = new Date(log.timestamp);
          const logSec = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
          const diff = Math.abs(logSec - targetSec);
          if (diff < closestDiff) { closestDiff = diff; closestIdx = idx; }
        });
        const container = logContainerRef.current;
        if (container) {
          const rows = container.querySelectorAll('[data-log-row]');
          if (rows[closestIdx]) {
            rows[closestIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
            (rows[closestIdx] as HTMLElement).style.backgroundColor = isDark ? 'rgba(33,150,243,0.15)' : 'rgba(33,150,243,0.12)';
            setTimeout(() => { (rows[closestIdx] as HTMLElement).style.backgroundColor = ''; }, 1500);
          }
        }
      }
    }
    setShowGotoTime(false);
    setGotoTime('');
  };

  // ─── Saved Query Handlers ───
  const handleSaveQuery = async (finalName: string) => {
    if (!finalName.trim()) return;
    try {
      const res = await argusService.createSavedQuery(projectId, {
        name: finalName.trim(),
        query_config: { search: search.trim(), columns, period: currentPeriod, groupBy: aggGroupBy },
        display_type: 'table',
        query_type: 'logs',
      });
      const updated = await argusService.listSavedQueries(projectId, 'logs');
      setSavedQueries(updated);
      setQueryName(finalName.trim());
      if (res.id) setCurrentQueryId(res.id);
      setSaveDialogOpen(false);
      setSaveName('');
    } catch (err) { console.error('Failed to save log query:', err); }
  };

  const handleRename = async (newName: string) => {
    setQueryName(newName);
    if (currentQueryId) {
      try {
        await argusService.updateSavedQuery(projectId, currentQueryId, { name: newName });
        const updated = await argusService.listSavedQueries(projectId, 'logs');
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
    if (cfg.search !== undefined) { setSearch(cfg.search); setUrlState({ q: cfg.search }); }
    if (cfg.columns) setColumns(cfg.columns);
    if (cfg.period) setUrlState({ period: cfg.period });
    if (cfg.groupBy) setUrlState({ groupBy: cfg.groupBy });
    setQueryName(sq.name);
    setCurrentQueryId(sq.id);
    setSavedPanelOpen(false);
  };

  const totalLogCount = facets.levels?.reduce((s, l) => s + Number(l.count), 0) || 0;

  // ─── Cell renderer ───
  const renderCell = useCallback((log: ArgusLogEntry, col: string) => {
    switch (col) {
      case 'timestamp': {
        const formatted = formatWith(log.timestamp, 'MMM D, h:mm:ss A') + '.' + String(new Date(log.timestamp + 'Z').getMilliseconds()).padStart(3, '0');
        return <Typography sx={{ fontSize: '0.73rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>{formatted}</Typography>;
      }
      case 'severity':
        return (
          <Typography sx={{
            fontSize: '0.72rem', fontWeight: 700, color: SEVERITY_COLORS[log.level?.toLowerCase()] || '#9e9e9e',
          }}>
            {log.level?.toUpperCase()}
          </Typography>
        );
      case 'message': {
        const highlighted = highlightSearchTerms(log.message || '', searchDebounce);
        return <Typography component="div" sx={{ fontSize: '0.73rem', ...(wrapLines ? { whiteSpace: 'pre-wrap', wordBreak: 'break-all' } : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }) }}>{highlighted}</Typography>;
      }
      case 'service':
        return <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{log.service || '—'}</Typography>;
      case 'environment':
        return <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{log.environment || '—'}</Typography>;
      case 'logger_name':
        return <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{log.logger_name || '—'}</Typography>;
      case 'trace_id':
        return (
          <Typography
            onClick={(e) => {
              if (log.trace_id) {
                e.stopPropagation();
                navigate(`/argus/performance?trace=${log.trace_id}`, { state: { allowBack: true } });
              }
            }}
            sx={{
              fontSize: '0.72rem', color: '#7c4dff',
              cursor: log.trace_id ? 'pointer' : 'default',
              '&:hover': log.trace_id ? { textDecoration: 'underline' } : {},
            }}
          >
            {log.trace_id ? log.trace_id.slice(0, 12) + '…' : '—'}
          </Typography>
        );
      case 'release':
        return <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{log.release || '—'}</Typography>;
      default:
        return <Typography sx={{ fontSize: '0.72rem' }}>—</Typography>;
    }
  }, [wrapLines, navigate, searchDebounce]);

  // ─── Logs table content ───
  const logsTableContent = useMemo(() => (
    <PageContentLoader loading={loading && logs.length === 0}>
      <Box ref={logContainerRef} sx={{
        ...(logsFullscreen ? { flex: 1, overflowY: 'auto' } : { maxHeight: 'none' }),
      }}>
        {logs.length === 0 && !loading ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <SearchIcon sx={{ fontSize: 48, color: alpha(theme.palette.primary.main, 0.15), mb: 1 }} />
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, mb: 0.5 }}>
              {t('argus.logs.noLogs', 'No logs found yet')}
            </Typography>
            <Typography color="text.disabled" sx={{ fontSize: '0.8rem' }}>
              {t('argus.logs.noLogsDesc', 'Try adjusting your filters or time range.')}
            </Typography>
          </Box>
        ) : (
          <>
            {logs.map((log, idx) => {
              const levelColor = SEVERITY_COLORS[log.level?.toLowerCase()] || '#9e9e9e';
              const isSelected = selectedLogIndex === idx;

              return (
                <Box key={log.log_id}>
                  <Box
                    data-log-row
                    sx={{
                      display: 'flex', alignItems: 'center', px: 1.5, py: DENSITY_PY[displayDensity],
                      cursor: 'pointer', transition: 'background-color 0.1s',
                      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                      backgroundColor: isSelected
                        ? (isDark ? 'rgba(33,150,243,0.08)' : 'rgba(33,150,243,0.06)')
                        : 'transparent',
                      '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.008)' },
                      ...(isSelected && { borderLeft: `2px solid ${theme.palette.primary.main}` }),
                    }}
                    onClick={() => handleSelectLog(idx)}
                  >
                    <Box sx={{ width: 44, display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                      <DotIcon sx={{ fontSize: 8, color: levelColor }} />
                    </Box>

                    {columns.map(col => (
                      <Box key={col} sx={{
                        flex: col === 'message' ? 3 : col === 'timestamp' ? 1.3 : 0.8,
                        minWidth: col === 'timestamp' ? 165 : col === 'message' ? 200 : 80,
                        overflow: 'hidden',
                      }}>
                        {renderCell(log, col)}
                      </Box>
                    ))}
                  </Box>
                </Box>
              );
            })}

            {hasMore && (
              <Box sx={{ py: 2, textAlign: 'center', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}>
                <Button variant="outlined" size="small" onClick={handleLoadMore} disabled={loading}
                  startIcon={loading ? <CircularProgress size={14} color="inherit" /> : undefined}
                  sx={{ textTransform: 'none', fontSize: '0.78rem', fontWeight: 600, minWidth: 160, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)' }}>
                  {t('argus.logs.loadMore', 'Load More Logs')}
                </Button>
              </Box>
            )}
          </>
        )}
      </Box>
    </PageContentLoader>
  ), [loading, logs, columns, expandedRows, isDark, theme, t, wrapLines, hasMore, logsFullscreen, handleLoadMore, toggleRow, renderCell, handleDetailFilter, selectedLogIndex, handleSelectLog, displayDensity]);

  /* ═══ RENDER ═══ */
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* ── Top: Header (full width) ── */}
      <PageHeader
        icon={<LogIcon />}
        title={
          <ArgusBreadcrumbs size="title" paths={[
            { label: t('argus.explore.title', 'Explore'), to: `/argus/explore` },
            { label: <EditablePageTitle value={queryName} onChange={handleRename} placeholder={defaultQueryName} /> }
          ]} />
        }
        subtitle={t('argus.logs.subtitle', 'Structured log explorer with trace-connected debugging')}
        actions={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <SafeTooltip title={t('argus.logs.savedQueries', 'Saved Queries')}>
              <IconButton size="small" onClick={() => setSavedPanelOpen(true)}
                sx={{ color: savedQueries.length > 0 ? theme.palette.primary.main : 'text.secondary' }}>
                {savedQueries.length > 0 ? <BookmarkIcon sx={{ fontSize: 20 }} /> : <BookmarkBorderIcon sx={{ fontSize: 20 }} />}
              </IconButton>
            </SafeTooltip>
            <Button
              size="small" variant="outlined" startIcon={<SaveIcon sx={{ fontSize: 15 }} />}
              onClick={() => { setSaveName(queryName === defaultQueryName ? '' : queryName); setSaveDialogOpen(true); }}
              sx={{
                textTransform: 'none', fontSize: '0.75rem', fontWeight: 600,
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                borderRadius: '6px',
              }}
            >
              {t('argus.logs.saveAs', 'Save as...')}
            </Button>
          </Box>
        }
      />

      {/* ── Top: Filter Bar (full width) ── */}
      <ArgusFilterBar
        projectId={projectId}
        value={filters}
        onChange={handleFilterChange}
        onRefresh={fetchAll}
        loading={loading}
        hideFilters={['browser', 'os']}
        extraControls={
          <ArgusSearchInput
            initialValue={search}
            onDebouncedChange={handleDebouncedSearchChange}
            onSubmit={handleSearchSubmit}
            isDark={isDark}
            theme={theme}
            mappedFacets={mappedFacets}
            activeFilters={activeFilters}
          />
        }
      />

      {/* ── Active Filter Chips ── */}
      {activeFilters.length > 0 && (
        <Box sx={{
          display: 'flex', flexWrap: 'wrap', gap: 0.5, px: 2, py: 0.75,
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          backgroundColor: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
          alignItems: 'center', flexShrink: 0,
        }}>
          {activeFilters.map((f, idx) => (
            <Chip
              key={`${f.key}-${f.value}-${f.exclude}-${idx}`}
              label={`${f.key}${f.exclude ? ' ≠ ' : ': '}${f.value}`}
              size="small"
              onClick={() => {
                // Toggle enabled/disabled on click
                setActiveFilters(prev =>
                  prev.map((item, i) => i === idx ? { ...item, enabled: !item.enabled } : item)
                );
              }}
              onDelete={() => removeActiveFilter(idx)}
              sx={{
                height: 24, fontSize: '0.73rem', fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: !f.enabled
                  ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)')
                  : f.exclude
                    ? alpha(theme.palette.error.main, 0.12)
                    : alpha(theme.palette.primary.main, 0.10),
                color: !f.enabled
                  ? 'text.disabled'
                  : f.exclude ? theme.palette.error.main : theme.palette.primary.main,
                borderRadius: '6px',
                opacity: f.enabled ? 1 : 0.55,
                textDecoration: f.enabled ? 'none' : 'line-through',
                transition: 'all 0.15s ease',
                '& .MuiChip-label': {
                  textDecoration: f.enabled ? 'none' : 'line-through',
                },
                '& .MuiChip-deleteIcon': {
                  fontSize: 14,
                  color: !f.enabled
                    ? 'text.disabled'
                    : f.exclude ? theme.palette.error.main : theme.palette.primary.main,
                  opacity: 0.6,
                  '&:hover': { opacity: 1 },
                },
              }}
            />
          ))}
          <Typography
            component="span"
            onClick={clearAllActiveFilters}
            sx={{
              fontSize: '0.7rem', color: 'text.disabled', cursor: 'pointer',
              ml: 0.5, '&:hover': { color: 'text.secondary', textDecoration: 'underline' },
            }}
          >
            {t('argus.logs.clearAll', 'Clear all')}
          </Typography>
        </Box>
      )}

      {/* ── Body: Sidebar + Content split ── */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Facets Sidebar */}
        <Box sx={{ display: 'flex', flexShrink: 0, position: 'relative' }}>
          <FacetSidebar
            width={facetWidth}
            facets={facetGroups}
            onFilter={(key, val, exclude) => toggleActiveFilter(key, val, exclude)}
            collapsed={facetSidebarCollapsed}
            onToggleCollapse={() => setFacetSidebarCollapsed(c => !c)}
            loading={loading}
            customFacets={customFacetData}
            onAddCustomFacet={handleAddCustomFacet}
            onRemoveCustomFacet={handleRemoveCustomFacet}
          />
          {!facetSidebarCollapsed && (
            <Box
              onMouseDown={handleFacetSplitterMouseDown}
              sx={{
                position: 'absolute', right: -4, top: 0, bottom: 0,
                width: 8, cursor: 'col-resize',
                backgroundColor: isFacetDragging ? alpha(theme.palette.primary.main, 0.2) : 'transparent',
                transition: 'background-color 0.2s',
                zIndex: 10,
                '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.1) },
              }}
            />
          )}
        </Box>

        {/* Right: Main log content — separated from sidebar with a subtle border gap */}
        <Box sx={{
          flex: 1, overflow: 'auto', minWidth: 0,
          pl: facetSidebarCollapsed ? 0.25 : 0.75,
        }}>
          {/* Volume Chart */}
          <LogVolumeChart data={volume} isDark={isDark} period={currentPeriod} onZoom={handleZoom} />

          {/* Toolbar */}
          <LogsToolbar
            activeTab={activeTab}
            onTabChange={(key) => {
              setUrlState({ tab: key });
              if (key === '1' && !aggData) fetchAggregates();
              if (key === '2') fetchPatterns();
            }}
            totalLogCount={totalLogCount}
            displayCount={logs.length}
            isDark={isDark}
            onOpenEditTable={openEditTable}
            onExport={handleExport}
            wrapLines={wrapLines}
            onWrapLinesToggle={() => setWrapLines(w => !w)}
            logsFullscreen={logsFullscreen}
            onFullscreenToggle={() => setLogsFullscreen(f => !f)}
            showGotoTime={showGotoTime}
            gotoTime={gotoTime}
            onShowGotoTime={() => setShowGotoTime(true)}
            onGotoTimeChange={setGotoTime}
            onGotoTimeSubmit={handleGotoTimeSubmit}
            onGotoTimeCancel={() => { setShowGotoTime(false); setGotoTime(''); }}
            displayDensity={displayDensity}
            onDensityChange={setDisplayDensity}
          />

          {/* Logs Tab */}
          {activeTab === 0 && (
            <LogsTablePanel
              columns={columns}
              logsFullscreen={logsFullscreen}
              wrapLines={wrapLines}
              logCount={logs.length}
              isDark={isDark}
              onExitFullscreen={() => setLogsFullscreen(false)}
              onWrapLinesToggle={() => setWrapLines(w => !w)}
            >
              {logsTableContent}
            </LogsTablePanel>
          )}

          {/* Aggregates Tab */}
          {activeTab === 1 && (
            <LogsAggregatePanel
              aggData={aggData}
              aggGroupBy={aggGroupBy}
              aggLoading={aggLoading}
              isDark={isDark}
              onGroupByChange={(val) => { setUrlState({ groupBy: val }); fetchAggregates(val); }}
              onAddFilter={(key, val) => toggleActiveFilter(key, val)}
            />
          )}

          {/* Patterns Tab */}
          {activeTab === 2 && (
            <Box sx={{ px: 1, py: 1 }}>
              {patternsLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
                  <CircularProgress size={24} sx={{ mr: 1 }} />
                  <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
                    {t('argus.logs.patterns.loading', 'Analyzing patterns...')}
                  </Typography>
                </Box>
              ) : patterns.length === 0 ? (
                <Box sx={{ py: 8, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, mb: 0.5 }}>
                    {t('argus.logs.patterns.noPatterns', 'No patterns found')}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                    {t('argus.logs.patterns.noPatternsDesc', 'Try adjusting your search or time range.')}
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.73rem' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}>
                        <th style={{ textAlign: 'right', padding: '6px 10px', fontWeight: 700, width: 70 }}>{t('argus.logs.patterns.count', 'Count')}</th>
                        <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 700 }}>{t('argus.logs.patterns.pattern', 'Pattern')}</th>
                        <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 700, width: 80 }}>{t('argus.logs.patterns.service', 'Service')}</th>
                        <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 700, width: 140 }}>{t('argus.logs.patterns.lastSeen', 'Last Seen')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patterns.map((p, idx) => (
                        <tr key={idx} style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}` }}>
                          <td style={{ textAlign: 'right', padding: '6px 10px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: theme.palette.primary.main }}>
                            {Number(p.count).toLocaleString()}
                          </td>
                          <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontSize: '0.70rem', wordBreak: 'break-all', opacity: 0.85 }}>
                            {p.pattern}
                            <br />
                            <span style={{ fontSize: '0.65rem', color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}>
                              {p.sample_message?.slice(0, 120)}
                            </span>
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            <Chip label={p.service || '-'} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.62rem' }} />
                          </td>
                          <td style={{ padding: '6px 10px', fontSize: '0.68rem', color: 'text.secondary' }}>
                            {p.last_seen ? new Date(p.last_seen).toLocaleString() : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
              )}
            </Box>
          )}

          {/* Live Tail Tab */}
          {activeTab === 3 && (
            <Box sx={{ px: 1, py: 1, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 300 }}>
              {/* Controls */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                {!liveTailActive ? (
                  <Button variant="contained" size="small" color="success" onClick={startLiveTail}
                    startIcon={<PlayArrowIcon sx={{ fontSize: 16 }} />}
                    sx={{ textTransform: 'none', fontSize: '0.73rem', fontWeight: 600, borderRadius: '6px' }}>
                    {t('argus.logs.liveTail.start', 'Start Streaming')}
                  </Button>
                ) : (
                  <Button variant="contained" size="small" color="error" onClick={stopLiveTail}
                    startIcon={<StopIcon sx={{ fontSize: 16 }} />}
                    sx={{ textTransform: 'none', fontSize: '0.73rem', fontWeight: 600, borderRadius: '6px' }}>
                    {t('argus.logs.liveTail.stop', 'Stop Streaming')}
                  </Button>
                )}
                {liveTailActive && (
                  <Button variant="outlined" size="small"
                    onClick={() => {
                      if (liveTailPaused) {
                        // Resume: flush buffer
                        setLiveTailLogs(prev => [...prev, ...liveTailBufferRef.current].slice(-500));
                        liveTailBufferRef.current = [];
                      }
                      setLiveTailPaused(p => !p);
                    }}
                    sx={{ textTransform: 'none', fontSize: '0.72rem', borderRadius: '6px' }}>
                    {liveTailPaused
                      ? t('argus.logs.liveTail.resume', 'Resume')
                      : t('argus.logs.liveTail.pause', 'Pause')}
                  </Button>
                )}
                {liveTailLogs.length > 0 && (
                  <Button variant="text" size="small" onClick={() => { setLiveTailLogs([]); setLiveTailCount(0); }}
                    sx={{ textTransform: 'none', fontSize: '0.72rem', color: 'text.secondary' }}>
                    {t('argus.logs.liveTail.clear', 'Clear Logs')}
                  </Button>
                )}
                <Box sx={{ flex: 1 }} />
                {liveTailActive && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{
                      width: 8, height: 8, borderRadius: '50%',
                      backgroundColor: liveTailPaused ? '#ff9800' : '#4caf50',
                      animation: liveTailPaused ? 'none' : 'pulse 1.5s infinite',
                      '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
                    }} />
                    <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', fontWeight: 600 }}>
                      {liveTailPaused
                        ? t('argus.logs.liveTail.paused', 'Paused')
                        : t('argus.logs.liveTail.streaming', 'Streaming...')}
                    </Typography>
                    <Chip size="small" label={t('argus.logs.liveTail.received', '{{count}} received', { count: liveTailCount })}
                      sx={{ height: 20, fontSize: '0.65rem', ml: 0.5 }} />
                  </Box>
                )}
              </Box>

              {/* Log stream */}
              <Box sx={{ flex: 1, overflow: 'auto', fontFamily: 'monospace', fontSize: '0.70rem' }}>
                {liveTailLogs.length === 0 ? (
                  <Box sx={{ py: 8, textAlign: 'center' }}>
                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, mb: 0.5 }}>
                      {t('argus.logs.liveTail.noLogs', 'No logs received yet')}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                      {t('argus.logs.liveTail.noLogsDesc', 'Start streaming to see new logs appear here.')}
                    </Typography>
                  </Box>
                ) : (
                  liveTailLogs.map((log, idx) => (
                    <Box key={`${log.log_id}-${idx}`} sx={{
                      display: 'flex', gap: 1, py: 0.3, px: 0.5,
                      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                      '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' },
                    }}>
                      <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', flexShrink: 0, width: 75, fontFamily: 'monospace' }}>
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </Typography>
                      <Chip label={log.level} size="small" sx={{
                        height: 16, fontSize: '0.58rem', fontWeight: 700, flexShrink: 0,
                        backgroundColor: alpha(SEVERITY_COLORS[log.level?.toLowerCase()] || '#9e9e9e', 0.15),
                        color: SEVERITY_COLORS[log.level?.toLowerCase()] || '#9e9e9e',
                      }} />
                      <Typography sx={{ fontSize: '0.70rem', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.message || log.body}
                      </Typography>
                    </Box>
                  ))
                )}
              </Box>
            </Box>
          )}
        </Box>

        {/* ── Splitter Handle + Right Side Panel ── */}
        {isRightPanelOpen && (
          <>
            <Box
              onMouseDown={handlePanelSplitterMouseDown}
              sx={{
                width: '1px', flexShrink: 0, cursor: 'col-resize',
                bgcolor: isPanelDragging ? 'primary.main' : 'divider',
                position: 'relative', zIndex: 10,
                transition: 'background-color 0.15s, transform 0.15s',
                transformOrigin: 'center',
                ...(isPanelDragging && { bgcolor: 'primary.main', transform: 'scaleX(4)' }),
                '&::after': {
                  content: '""', position: 'absolute',
                  top: 0, bottom: 0, left: '-5px', right: '-5px', cursor: 'col-resize',
                },
                '&:hover, &:active': { bgcolor: 'primary.main', transform: 'scaleX(4)' },
              }}
            />
            <LogSidePanel
              log={selectedLog}
              open={isRightPanelOpen}
              onClose={handleCloseSidePanel}
              onPrev={handlePrevLog}
              onNext={handleNextLog}
              onFilter={handleDetailFilter}
              hasPrev={selectedLogIndex !== null && selectedLogIndex > 0}
              hasNext={selectedLogIndex !== null && selectedLogIndex < logs.length - 1}
              width={panelWidth}
            />
          </>
        )}
      </Box>

      {/* Dialogs */}
      <EditTableDialog
        open={editTableOpen}
        tempColumns={tempColumns}
        onClose={() => setEditTableOpen(false)}
        onToggleColumn={toggleColumn}
        onReset={() => setTempColumns(DEFAULT_COLUMNS)}
        onSave={saveEditTable}
      />

      <SaveQueryDialog
        open={saveDialogOpen}
        initialName={saveName}
        onClose={() => setSaveDialogOpen(false)}
        onSave={handleSaveQuery}
      />

      <SavedQueriesDrawer
        open={savedPanelOpen}
        queries={savedQueries}
        isDark={isDark}
        onClose={() => setSavedPanelOpen(false)}
        onLoad={handleLoadSavedQuery}
        onDelete={handleDeleteSavedQuery}
      />
    </Box>
  );
};

export default ArgusLogsPage;
