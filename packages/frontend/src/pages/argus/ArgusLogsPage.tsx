import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Box, Typography, Button, IconButton, Tooltip,
  useTheme, alpha, CircularProgress, Collapse,
} from '@mui/material';
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
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip as ChartTooltip, Legend } from 'chart.js';
import PageContentLoader from '@/components/common/PageContentLoader';
import { TableSkeleton } from '@/components/argus/ArgusSkeletons';
import ArgusFilterBar, { ArgusFilterState, defaultArgusFilterState, argusFilterStateToApiParams } from '@/components/argus/ArgusFilterBar';
import DiscoverFacetMap from '@/components/argus/DiscoverFacetMap';
import ArgusQueryBuilder from '@/components/argus/ArgusQueryBuilder';
import SearchAutocompletePopover from '@/components/argus/SearchAutocompletePopover';
import argusService, { ArgusLogEntry, ArgusSavedQuery } from '@/services/argusService';
import PageHeader from '@/components/common/PageHeader';
import EditablePageTitle from '@/components/common/EditablePageTitle';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { formatWith } from '@/utils/dateFormat';

// Page-specific components
import LogDetail from './components/LogDetail';
import LogVolumeChart, { VolumePoint } from './components/LogVolumeChart';
import LogsToolbar from './components/LogsToolbar';
import LogsTablePanel from './components/LogsTablePanel';
import LogsAggregatePanel from './components/LogsAggregatePanel';
import { EditTableDialog, SaveQueryDialog, SavedQueriesDrawer } from './components/LogsDialogs';

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

/* ─── Main Component ─── */

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
  }), []);
  const [urlState, setUrlState] = useArgusUrlState(URL_PARAMS);

  const activeTab = parseInt(urlState.tab, 10) || 0;
  const aggGroupBy = urlState.groupBy;

  // Derive filters from URL period
  const [filters, setFilters] = useState<ArgusFilterState>(() => {
    if (urlState.period === 'custom' && urlState.start && urlState.end) {
      const base = defaultArgusFilterState('custom');
      base.dateRange = { type: 'custom', start: new Date(urlState.start), end: new Date(urlState.end) };
      return base;
    }
    return defaultArgusFilterState(urlState.period);
  });

  useEffect(() => {
    setFilters(prev => {
      if (urlState.period === 'custom' && urlState.start && urlState.end) {
        return {
          ...prev,
          dateRange: { type: 'custom', start: new Date(urlState.start), end: new Date(urlState.end) }
        };
      }
      return {
        ...prev,
        dateRange: { type: 'preset', preset: urlState.period }
      };
    });
  }, [urlState.period, urlState.start, urlState.end]);

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
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

  const [columns, setColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [editTableOpen, setEditTableOpen] = useState(false);
  const [tempColumns, setTempColumns] = useState<string[]>([]);

  // Log viewer features
  const [wrapLines, setWrapLines] = useState(false);
  const [logsFullscreen, setLogsFullscreen] = useState(false);
  const [showGotoTime, setShowGotoTime] = useState(false);
  const [gotoTime, setGotoTime] = useState('');
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Aggregates state
  const [aggData, setAggData] = useState<{
    groupBy: string;
    topValues: { group_value: string; count: number }[];
    timeSeries: { bucket: string; group_value: string; count: number }[];
  } | null>(null);
  const [aggLoading, setAggLoading] = useState(false);

  // Search Autocomplete State
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [searchFocused, setSearchFocused] = useState(false);

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

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

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

      const result = await argusService.browseLogs(projectId, params);
      const newLogs = result.data || [];
      if (append) {
        setLogs(prev => [...prev, ...newLogs]);
      } else {
        setLogs(newLogs);
      }
      setHasMore(result.meta?.hasMore || false);
    } catch (err) { console.error('Failed to fetch logs', err); }
    finally { setLoading(false); }
  }, [projectId, filters, searchDebounce]);

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
        search: searchDebounce.trim()
      });
      setVolume(data);
    } catch (err) { console.error('Failed to fetch volume', err); }
  }, [projectId, filters, searchDebounce]);

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
      });
      setAggData(data);
    } catch (err) { console.error('Failed to fetch aggregates', err); }
    finally { setAggLoading(false); }
  }, [projectId, filters, currentPeriod, aggGroupBy]);

  useEffect(() => {
    fetchAll();
    if (activeTab === 1) fetchAggregates();
    argusService.listSavedQueries(projectId, 'logs').then(setSavedQueries).catch(() => setSavedQueries([]));
  }, [fetchAll]);

  useEffect(() => {
    if (autoRefresh) {
      autoRefreshRef.current = setInterval(() => { fetchLogs(); fetchVolume(); }, 5000);
    } else {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    }
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [autoRefresh, fetchLogs, fetchVolume]);

  // ─── Handlers ───
  const addSearchTag = (key: string, value: string, op: string = 'is') => {
    const opStr = op === '!=' ? '!=' : ':';
    const appendStr = `${key}${opStr}"${value}"`;

    let newSearch = search;
    const colonMatch = search.match(/([\w.-]+):([^\s]*)$/);
    if (colonMatch && colonMatch[1] === key) {
      newSearch = search.substring(0, search.length - colonMatch[0].length);
    } else {
      const bareMatch = search.match(/([\w.-]+)$/);
      if (bareMatch && bareMatch[1] === key) {
        newSearch = search.substring(0, search.length - bareMatch[0].length);
      }
    }

    const finalStr = (newSearch.trim() ? newSearch.trim() + ' ' : '') + appendStr + ' ';
    setSearch(finalStr);
    setUrlState({ q: finalStr.trim() });
    setSearchFocused(false);
  };

  const toggleRow = useCallback((logId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(logId) ? next.delete(logId) : next.add(logId);
      return next;
    });
  }, []);

  const handleSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setUrlState({ q: search.trim() });
      setSearchFocused(false);
      setTimeout(() => fetchLogs(), 10);
    }
  };

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
    addSearchTag(key, val, exclude ? '!=' : 'is');
  }, [addSearchTag]);

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
  const handleSaveQuery = async () => {
    if (!saveName.trim()) return;
    try {
      const res = await argusService.createSavedQuery(projectId, {
        name: saveName.trim(),
        query_config: { search: search.trim(), columns, period: currentPeriod, groupBy: aggGroupBy },
        display_type: 'table',
        query_type: 'logs',
      });
      const updated = await argusService.listSavedQueries(projectId, 'logs');
      setSavedQueries(updated);
      setQueryName(saveName.trim());
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
      case 'message':
        return <Typography sx={{ fontSize: '0.73rem', ...(wrapLines ? { whiteSpace: 'pre-wrap', wordBreak: 'break-all' } : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }) }}>{log.message}</Typography>;
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
                navigate(`/argus/explore/traces?q=trace_id:"${log.trace_id}"`);
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
  }, [wrapLines, navigate]);

  // ─── Logs table content ───
  const logsTableContent = useMemo(() => (
    <PageContentLoader loading={loading && logs.length === 0} skeleton={<TableSkeleton rows={12} cols={columns.length || 4} />}>
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
            {logs.map(log => {
              const levelColor = SEVERITY_COLORS[log.level?.toLowerCase()] || '#9e9e9e';
              const isExpanded = expandedRows.has(log.log_id);

              return (
                <Box key={log.log_id}>
                  <Box
                    data-log-row
                    sx={{
                      display: 'flex', alignItems: 'center', px: 1.5, py: 0.5,
                      cursor: 'pointer', transition: 'background-color 0.1s',
                      borderBottom: isExpanded ? 'none' : `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                      '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.008)' },
                    }}
                    onClick={() => toggleRow(log.log_id)}
                  >
                    <Box sx={{ width: 44, display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                      {isExpanded ? <ExpandIcon sx={{ fontSize: 16, color: 'text.disabled' }} /> : <CollapseIcon sx={{ fontSize: 16, color: 'text.disabled' }} />}
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

                  <Collapse in={isExpanded}>
                    <LogDetail log={log} isDark={isDark} onFilter={handleDetailFilter} />
                  </Collapse>
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
  ), [loading, logs, columns, expandedRows, isDark, theme, t, wrapLines, hasMore, logsFullscreen, handleLoadMore, toggleRow, renderCell, handleDetailFilter]);

  /* ═══ RENDER ═══ */
  return (
    <Box>
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
            <Tooltip title={t('argus.logs.savedQueries', 'Saved Queries')}>
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
              {t('argus.logs.saveAs', 'Save as...')}
            </Button>
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
                display: 'flex', alignItems: 'center', gap: 0.5, flex: 1,
                px: 1, py: 0.2, borderRadius: '6px', minWidth: 500, minHeight: 30,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                transition: 'border-color 0.2s',
                backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#fff',
                '&:focus-within': { borderColor: theme.palette.primary.main, boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}` },
              }}
            >
              <SearchIcon sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0, ml: 0.5 }} />
              <Box component="input"
                value={search}
                spellCheck={false}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                onKeyDown={handleSearchKey as any}
                onFocus={() => setSearchFocused(true)}
                placeholder={t('argus.discover.searchPlaceholder', 'Search for events, users, tags (e.g. level:error OR browser:Chrome)')}
                style={{
                  flex: 1, border: 'none', outline: 'none', backgroundColor: 'transparent',
                  color: 'inherit', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 500, minWidth: 120, padding: '6px 8px'
                }}
              />
              {search && (
                <IconButton size="small" onClick={() => { setSearch(''); setUrlState({ q: '' }); }} sx={{ p: 0.2, mr: 0.5 }}>
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
                  borderRadius: '6px', height: 30, width: 30,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
                }}
              >
                <FilterIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>

            <ArgusQueryBuilder
              fields={['severity', 'service', 'environment', 'logger_name', 'trace_id', 'release']}
              query={search}
              onApply={(q) => { setSearch(q); setUrlState({ q }); }}
              anchorEl={builderAnchorEl}
              onClose={() => setBuilderAnchorEl(null)}
            />

            {/* Search Autocomplete Popover */}
            <SearchAutocompletePopover
              open={searchFocused}
              anchorEl={searchContainerRef.current}
              query={search}
              fields={['severity', 'service', 'environment', 'logger', 'trace_id', 'message']}
              facets={mappedFacets}
              isDark={isDark}
              onSelectTag={(field, value) => {
                addSearchTag(field, value);
                setSearch('');
                setSearchFocused(false);
              }}
              onSelectField={(field) => {
                const tokens = search.split(/\s+/);
                const newCond = tokens.slice(0, -1).join(' ') + (tokens.length > 1 ? ' ' : '') + field + ':';
                setSearch(newCond);
                searchContainerRef.current?.querySelector('input')?.focus();
              }}
              onSelectSyntax={(syntax) => {
                const tokens = search.split(/\s+/);
                const newCond = tokens.slice(0, -1).join(' ') + (tokens.length > 1 ? ' ' : '') + syntax + ' ';
                setSearch(newCond);
                searchContainerRef.current?.querySelector('input')?.focus();
              }}
              onClose={() => setSearchFocused(false)}
            />
          </Box>
        }
      />

      {/* Facet Map */}
      <DiscoverFacetMap
        facets={mappedFacets}
        onSelectFacet={(key, val, ex) => addSearchTag(key, val, ex ? '!=' : 'is')}
        loading={loading}
      />

      {/* Volume Chart */}
      <LogVolumeChart data={volume} isDark={isDark} period={currentPeriod} onZoom={handleZoom} />

      {/* Toolbar */}
      <LogsToolbar
        activeTab={activeTab}
        onTabChange={(key) => { setUrlState({ tab: key }); if (key === '1' && !aggData) fetchAggregates(); }}
        autoRefresh={autoRefresh}
        onAutoRefreshToggle={() => setAutoRefresh(!autoRefresh)}
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
          onAddFilter={(key, val) => addSearchTag(key, val)}
        />
      )}

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
        saveName={saveName}
        onClose={() => setSaveDialogOpen(false)}
        onNameChange={setSaveName}
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
