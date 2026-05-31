import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Box, Typography, Paper, Button, Chip, IconButton, Tooltip,
  useTheme, alpha, CircularProgress, Checkbox,
  Collapse, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControlLabel, Divider, Popover,
  Table, TableHead, TableBody, TableRow, TableCell,
  FormControl, Select, MenuItem,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import useArgusUrlState from '@/hooks/useArgusUrlState';
import {
  Search as SearchIcon, Close as CloseIcon,
  KeyboardArrowDown as ExpandIcon, KeyboardArrowRight as CollapseIcon,
  FileDownload as ExportIcon, Terminal as LogIcon,
  TableChart as EditTableIcon, ArrowDownward as SortDescIcon,
  FiberManualRecord as DotIcon, ViewColumn as ViewIcon,
  FilterList as FilterIcon, Block as ExcludeIcon, ContentCopy as CopyIcon,
  Fullscreen as FullscreenIcon, FullscreenExit as FullscreenExitIcon,
  WrapText as WrapTextIcon, AccessTime as GotoTimeIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip as ChartTooltip, Legend } from 'chart.js';
import PageContentLoader from '@/components/common/PageContentLoader';
import { TableSkeleton, ChartSkeleton } from '@/components/argus/ArgusSkeletons';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import ArgusFilterBar, { ArgusFilterState, defaultArgusFilterState, argusFilterStateToApiParams } from '@/components/argus/ArgusFilterBar';
import DiscoverFacetMap from '@/components/argus/DiscoverFacetMap';
import ArgusQueryBuilder from '@/components/argus/ArgusQueryBuilder';
import argusService, { ArgusLogEntry } from '@/services/argusService';
import SegmentedTabs from '@/components/common/SegmentedTabs';
import FeatureSwitch from '@/components/common/FeatureSwitch';
import { useOrgProject } from '@/contexts/OrgProjectContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip, Legend);

/* ─── Types ─── */

interface LogFacets {
  levels: { level: string; count: number }[];
  services: { service: string; count: number }[];
  environments: { environment: string; count: number }[];
  loggers: { logger_name: string; count: number }[];
}

interface VolumePoint { bucket: string; level: string; count: number; }

const SEVERITY_COLORS: Record<string, string> = {
  fatal: '#d32f2f', error: '#f44336', warn: '#ff9800', warning: '#ff9800',
  info: '#2196f3', debug: '#9e9e9e', trace: '#607d8b',
};

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

/* ─── Expanded Log Detail (Sentry two-column) ─── */

const LogDetail: React.FC<{ 
  log: ArgusLogEntry; 
  isDark: boolean;
  onFilter: (key: string, val: string, exclude: boolean) => void;
}> = ({ log, isDark, onFilter }) => {
  const { t } = useTranslation();
  const attrs: [string, any][] = [];
  if (log.level) attrs.push(['severity', log.level]);
  if (log.timestamp) attrs.push(['timestamp_precise', log.timestamp]);
  if (log.trace_id) attrs.push(['trace_id', log.trace_id]);
  if (log.span_id) attrs.push(['span_id', log.span_id]);
  if (log.service) attrs.push(['service', log.service]);
  if (log.environment) attrs.push(['environment', log.environment]);
  if (log.release) attrs.push(['release', log.release]);
  if (log.logger_name) attrs.push(['logger_name', log.logger_name]);
  if (log.body) attrs.push(['body', log.body]);
  if (log.attributes && typeof log.attributes === 'object') {
    Object.entries(log.attributes).forEach(([k, v]) => attrs.push([k, v]));
  }

  const mid = Math.ceil(attrs.length / 2);
  const left = attrs.slice(0, mid);
  const right = attrs.slice(mid);

  const handleCopy = (val: string) => {
    navigator.clipboard.writeText(val);
  };

  const renderColumn = (items: [string, any][]) => (
    <Box sx={{ flex: 1 }}>
      {items.map(([key, val]) => (
        <Box key={key} sx={{
          display: 'flex', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
          py: 0.5, gap: 2, alignItems: 'flex-start',
          '&:hover .detail-actions': { opacity: 1 },
        }}>
          <Typography sx={{
            fontSize: '0.72rem', color: 'text.disabled', minWidth: 140, fontFamily: 'monospace', flexShrink: 0, pt: 0.2
          }}>
            {key}
          </Typography>
          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', minWidth: 0 }}>
            <Typography sx={{
              fontSize: '0.72rem', fontFamily: 'monospace', wordBreak: 'break-all', pt: 0.2,
              color: key === 'severity' ? (SEVERITY_COLORS[String(val)?.toLowerCase()] || 'text.primary') : 'text.primary',
              fontWeight: key === 'severity' ? 700 : 400,
            }}>
              {typeof val === 'object' ? JSON.stringify(val) : String(val)}
            </Typography>
            <Box className="detail-actions" sx={{ opacity: 0, transition: 'opacity 0.2s', display: 'flex', gap: 0.5, flexShrink: 0 }}>
              <Tooltip title={t('argus.logs.action.copy', 'Copy')}>
                <IconButton size="small" onClick={() => handleCopy(typeof val === 'object' ? JSON.stringify(val) : String(val))} sx={{ p: 0.2 }}>
                  <CopyIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('argus.logs.action.addFilter', 'Add to filter')}>
                <IconButton size="small" onClick={() => onFilter(key, String(val), false)} sx={{ p: 0.2, color: 'primary.main' }}>
                  <FilterIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('argus.logs.action.excludeFilter', 'Exclude from filter')}>
                <IconButton size="small" onClick={() => onFilter(key, String(val), true)} sx={{ p: 0.2, color: 'error.main' }}>
                  <ExcludeIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );

  return (
    <Box sx={{
      mx: 2, mb: 1.5, px: 2, py: 1.5, borderRadius: 2,
      backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.015)',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
    }}>
      <Typography sx={{
        fontSize: '0.8rem', mb: 1.5, pb: 1, lineHeight: 1.6,
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      }}>
        {log.message}
      </Typography>
      <Box sx={{ display: 'flex', gap: 4 }}>
        {renderColumn(left)}
        {renderColumn(right)}
      </Box>
    </Box>
  );
};

/* ─── Volume Chart ─── */

const VolumeChart: React.FC<{ data: VolumePoint[]; isDark: boolean; period: string }> = ({ data, isDark, period }) => {
  const { t } = useTranslation();
  const chartData = useMemo(() => {
    if (data.length === 0) return null;
    const bucketMap = new Map<string, number>();
    data.forEach(p => {
      const count = Number(p.count) || 0;
      bucketMap.set(p.bucket, (bucketMap.get(p.bucket) || 0) + count);
    });
    const sorted = [...bucketMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const labels = sorted.map(([b]) => {
      const d = new Date(b);
      return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    });
    const values = sorted.map(([, c]) => c);
    return {
      labels,
      datasets: [{
        data: values,
        backgroundColor: alpha('#7c4dff', 0.55),
        hoverBackgroundColor: '#7c4dff',
        borderRadius: 1,
        barPercentage: 0.9,
        categoryPercentage: 0.92,
      }],
    };
  }, [data]);

  if (!chartData) return (
    <Paper elevation={0} sx={{
      mb: 2, p: 2, pt: 1.5, borderRadius: 2,
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
    }}>
      <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, mb: 1, color: 'text.disabled' }}>
        count(logs)
      </Typography>
      <Box sx={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled' }}>{t('argus.logs.noLogData', 'No log data')}</Typography>
      </Box>
    </Paper>
  );

  return (
    <Paper elevation={0} sx={{
      mb: 2, p: 2, pt: 1.5, borderRadius: 2,
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
    }}>
      <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, mb: 1, color: 'text.secondary' }}>
        count(logs)
      </Typography>
      <Box sx={{ height: 130 }}>
        <Bar data={chartData} options={{
          responsive: true, maintainAspectRatio: false,
          animation: { duration: 300 },
          plugins: { legend: { display: false }, tooltip: { enabled: true } },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { size: 9 }, color: isDark ? '#555' : '#bbb', maxTicksLimit: 8 },
              border: { display: false },
            },
            y: {
              grid: { color: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)' },
              ticks: { font: { size: 9 }, color: isDark ? '#555' : '#bbb' },
              border: { display: false },
              beginAtZero: true,
            },
          },
        }} />
      </Box>
    </Paper>
  );
};

/* ─── Main Component ─── */

const ArgusLogsPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

  // ─── URL-driven state ───
  const URL_PARAMS = useMemo(() => ({
    period:  { key: 'period',  default: '14d', storageKey: 'argus-logs-period' },
    q:       { key: 'q',       default: '' },
    tab:     { key: 'tab',     default: '0' },
    groupBy: { key: 'groupBy', default: 'level' },
  }), []);
  const [urlState, setUrlState] = useArgusUrlState(URL_PARAMS);

  const activeTab = parseInt(urlState.tab, 10) || 0;
  const aggGroupBy = urlState.groupBy;

  // Derive filters from URL period
  const filters = useMemo<ArgusFilterState>(
    () => defaultArgusFilterState(urlState.period),
    [urlState.period],
  );

  // Search state
  const [search, setSearch] = useState<string>(urlState.q || '');
  const [searchDebounce, setSearchDebounce] = useState(urlState.q || '');

  // Sync state if URL changes externally
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

  // Log viewer features (matching Issue Detail page)
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

  const currentPeriod = useMemo(() => {
    if (filters.dateRange.type === 'preset' && filters.dateRange.preset) return filters.dateRange.preset;
    return '14d';
  }, [filters.dateRange]);

  const mappedFacets = useMemo(() => {
    return {
      severity: facets.levels?.map(l => ({ value: l.level, count: Number(l.count) })) || [],
      service: facets.services?.map(s => ({ value: s.service, count: Number(s.count) })) || [],
      environment: facets.environments?.map(e => ({ value: e.environment, count: Number(e.count) })) || [],
      logger: facets.loggers?.map(l => ({ value: l.logger_name, count: Number(l.count) })) || [],
    };
  }, [facets]);

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
      const data = await argusService.getLogFacets(projectId, currentPeriod);
      setFacets(data);
    } catch (err) { console.error('Failed to fetch facets', err); }
  }, [projectId, currentPeriod]);

  const fetchVolume = useCallback(async () => {
    try {
      const data = await argusService.getLogVolume(projectId, { period: currentPeriod });
      setVolume(data);
    } catch (err) { console.error('Failed to fetch volume', err); }
  }, [projectId, currentPeriod]);

  const fetchAll = useCallback(() => {
    fetchLogs(); fetchFacets(); fetchVolume();
  }, [fetchLogs, fetchFacets, fetchVolume]);

  const fetchAggregates = useCallback(async (groupByVal?: string) => {
    setAggLoading(true);
    try {
      const apiParams = argusFilterStateToApiParams(filters);
      const data = await argusService.getLogAggregate(projectId, {
        period: apiParams.period || currentPeriod,
        groupBy: groupByVal || aggGroupBy,
      });
      setAggData(data);
    } catch (err) { console.error('Failed to fetch aggregates', err); }
    finally { setAggLoading(false); }
  }, [projectId, filters, currentPeriod, aggGroupBy]);

  useEffect(() => {
    fetchAll();
    // If page loads with aggregation tab active (from URL), also fetch aggregates
    if (activeTab === 1) fetchAggregates();
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
    
    // Replace the last typing token if it matches
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
    
    const finalStr = (newSearch.trim() + ' ' + appendStr).trim();
    setSearch(finalStr);
    setUrlState({ q: finalStr });
    setSearchFocused(false);
  };

  const toggleRow = (logId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(logId) ? next.delete(logId) : next.add(logId);
      return next;
    });
  };

  const handleSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setUrlState({ q: search.trim() });
      setSearchFocused(false);
      setTimeout(() => fetchLogs(), 10);
    }
  };

  const handleLoadMore = () => {
    if (logs.length > 0) fetchLogs(true, logs[logs.length - 1].timestamp);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `logs-${new Date().toISOString()}.json`; a.click();
  };

  const handleFilterChange = (newFilters: ArgusFilterState) => {
    if (newFilters.dateRange.type === 'preset' && newFilters.dateRange.preset) {
      setUrlState({ period: newFilters.dateRange.preset });
    }
  };

  const openEditTable = () => { setTempColumns([...columns]); setEditTableOpen(true); };
  const saveEditTable = () => { setColumns(tempColumns); setEditTableOpen(false); };
  const toggleColumn = (col: string) => {
    setTempColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  };

  const handleDetailFilter = (key: string, val: string, exclude: boolean) => {
    addSearchTag(key, val, exclude ? '!=' : 'is');
  };

  const totalLogCount = facets.levels?.reduce((s, l) => s + Number(l.count), 0) || 0;

  // ─── Cell renderer ───
  const renderCell = (log: ArgusLogEntry, col: string) => {
    switch (col) {
      case 'timestamp': {
        const d = new Date(log.timestamp);
        const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const timeStr = d.toLocaleTimeString('en-US', { hour12: true, hour: 'numeric', minute: '2-digit', second: '2-digit' });
        const ms = '.' + String(d.getMilliseconds()).padStart(3, '0');
        return <Typography sx={{ fontSize: '0.73rem', fontFamily: 'monospace', color: 'text.secondary', whiteSpace: 'nowrap' }}>{dateStr}, {timeStr}{ms}</Typography>;
      }
      case 'severity':
        return (
          <Typography sx={{
            fontSize: '0.72rem', fontWeight: 700, fontFamily: 'monospace',
            color: SEVERITY_COLORS[log.level?.toLowerCase()] || '#9e9e9e',
          }}>
            {log.level?.toUpperCase()}
          </Typography>
        );
      case 'message':
        return <Typography sx={{ fontSize: '0.73rem', ...(wrapLines ? { whiteSpace: 'pre-wrap', wordBreak: 'break-all' } : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }) }}>{log.message}</Typography>;
      case 'service':
        return <Typography sx={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'text.secondary' }}>{log.service || '—'}</Typography>;
      case 'environment':
        return <Typography sx={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'text.secondary' }}>{log.environment || '—'}</Typography>;
      case 'logger_name':
        return <Typography sx={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'text.secondary' }}>{log.logger_name || '—'}</Typography>;
      case 'trace_id':
        return (
          <Typography
            onClick={(e) => {
              if (log.trace_id) {
                e.stopPropagation();
                navigate(`/projects/${projectId}/argus/performance?trace=${log.trace_id}`);
              }
            }}
            sx={{
              fontSize: '0.72rem', fontFamily: 'monospace', color: '#7c4dff',
              cursor: log.trace_id ? 'pointer' : 'default',
              '&:hover': log.trace_id ? { textDecoration: 'underline' } : {},
            }}
          >
            {log.trace_id ? log.trace_id.slice(0, 12) + '…' : '—'}
          </Typography>
        );
      case 'release':
        return <Typography sx={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'text.secondary' }}>{log.release || '—'}</Typography>;
      default:
        return <Typography sx={{ fontSize: '0.72rem' }}>—</Typography>;
    }
  };

  /* ═══ RENDER ═══ */
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <LogIcon sx={{ fontSize: 26, color: theme.palette.primary.main }} />
        <Typography variant="h5" fontWeight={700}>
          {t('argus.logs.explorerTitle', 'Logs')}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.disabled', fontSize: '0.8rem' }}>
          — {t('argus.logs.subtitle', 'Structured log explorer with trace-connected debugging')}
        </Typography>
      </Box>

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
              <Box component="input" value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                onKeyDown={handleSearchKey as any}
                onFocus={() => setSearchFocused(true)}
                placeholder={t('argus.discover.searchPlaceholder', 'Search for events, users, tags (e.g. level:error OR browser:Chrome)')}
                style={{
                  flex: 1, border: 'none', outline: 'none', backgroundColor: 'transparent',
                  color: 'inherit', fontFamily: 'monospace', fontSize: '0.8rem', minWidth: 100, padding: '4px 8px'
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

            {/* Search Autocomplete Popover — 2-stage: fields → values */}
            <Popover
              open={searchFocused}
              anchorEl={searchContainerRef.current}
              onClose={() => setSearchFocused(false)}
              disableAutoFocus disableEnforceFocus
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
              slotProps={{ paper: { sx: { width: searchContainerRef.current?.offsetWidth || 300, mt: 0.5, borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', maxHeight: 320, overflow: 'auto' } } }}
            >
              <Box sx={{ p: 1 }}>
                {(() => {
                  // Parse current search to determine autocomplete stage
                  const colonMatch = search.match(/([\w.-]+):([^\s]*)$/);
                  const FIELD_KEYS = ['severity', 'service', 'environment', 'logger', 'trace_id', 'message'];
                  
                  if (colonMatch) {
                    // Stage 2: User typed "field:" — show values from facets
                    const fieldKey = colonMatch[1];
                    const partialValue = colonMatch[2].toLowerCase();
                    const values = (mappedFacets as Record<string, {value:string;count:number}[]>)[fieldKey] || [];
                    const filtered = partialValue
                      ? values.filter(v => v.value.toLowerCase().includes(partialValue))
                      : values;

                    if (filtered.length === 0) {
                      return (
                        <Typography sx={{ px: 1, py: 1, fontSize: '0.75rem', color: 'text.disabled', fontStyle: 'italic' }}>
                          {values.length > 0
                            ? t('argus.discover.noValues', 'No matching values')
                            : t('argus.discover.typeValue', 'Type a value and press Enter')}
                        </Typography>
                      );
                    }

                    return (
                      <>
                        <Typography variant="caption" sx={{ px: 1, color: 'text.disabled', fontWeight: 600, display: 'block', mb: 0.5 }}>
                          {fieldKey} {t('argus.discover.values', 'values')}
                        </Typography>
                        {(() => {
                          const totalCount = filtered.reduce((s, x) => s + x.count, 0);
                          return filtered.slice(0, 10).map((v, idx) => {
                            const pctOfTotal = totalCount > 0 ? ((v.count / totalCount) * 100) : 0;
                            return (
                              <Box key={idx}
                                onClick={() => {
                                  addSearchTag(fieldKey, v.value);
                                  setSearch('');
                                  setSearchFocused(false);
                                }}
                                sx={{
                                  position: 'relative', px: 1.5, py: 0.6, cursor: 'pointer', borderRadius: '4px',
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                  overflow: 'hidden',
                                  '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.08) },
                                }}
                              >
                                {/* Background bar */}
                                <Box sx={{
                                  position: 'absolute', left: 8, top: 2, bottom: 2,
                                  width: `${pctOfTotal}%`, minWidth: pctOfTotal > 0 ? 4 : 0,
                                  backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.12),
                                  borderRadius: '0 3px 3px 0',
                                  transition: 'width 0.3s ease',
                                }} />
                                <Typography sx={{
                                  zIndex: 1, fontFamily: 'monospace', fontSize: '0.78rem',
                                  color: theme.palette.primary.main, fontWeight: 600,
                                }}>
                                  {v.value || '(empty)'}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, zIndex: 1 }}>
                                  <Typography sx={{ fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: 700, color: theme.palette.primary.main }}>
                                    {pctOfTotal.toFixed(0)}%
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.65rem', fontFamily: 'monospace', color: 'text.disabled' }}>
                                    {v.count.toLocaleString()}
                                  </Typography>
                                </Box>
                              </Box>
                            );
                          });
                        })()}
                      </>
                    );
                  }

                  // Stage 1: Show field keys (optionally filtered by partial input)
                  const tokens = search.split(/\s+/);
                  const lastToken = tokens[tokens.length - 1].toLowerCase();
                  const syntax = ['AND', 'OR'];
                  
                  const filteredFields = lastToken
                    ? FIELD_KEYS.filter(f => f.toLowerCase().includes(lastToken))
                    : FIELD_KEYS;
                  const filteredSyntax = lastToken
                    ? syntax.filter(s => s.toLowerCase().includes(lastToken))
                    : syntax;

                  return (
                    <>
                      {filteredSyntax.length > 0 && (
                        <>
                          <Typography variant="caption" sx={{ px: 1, color: 'text.disabled', fontWeight: 600, display: 'block', mb: 0.5, mt: 0.5 }}>
                            {t('argus.discover.syntax', 'Syntax')}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, px: 1, mb: 1 }}>
                            {filteredSyntax.map(s => (
                              <Box key={s}
                                onClick={() => {
                                  const newCond = tokens.slice(0, -1).join(' ') + (tokens.length > 1 ? ' ' : '') + s + ' ';
                                  setSearch(newCond);
                                  searchContainerRef.current?.querySelector('input')?.focus();
                                }}
                                sx={{
                                  px: 1.2, py: 0.4, cursor: 'pointer', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700,
                                  backgroundColor: alpha(theme.palette.primary.main, 0.1), color: theme.palette.primary.main,
                                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                                  '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.2) },
                                }}
                              >
                                {s}
                              </Box>
                            ))}
                          </Box>
                        </>
                      )}

                      <Typography variant="caption" sx={{ px: 1, color: 'text.disabled', fontWeight: 600, display: 'block', mb: 0.5 }}>
                        {t('argus.discover.suggestions', 'Suggested Fields')}
                      </Typography>
                      {/* Add 'has:' syntax helper natively */}
                      {(!lastToken || 'has:'.includes(lastToken)) && (
                        <Box onClick={() => {
                            const newCond = tokens.slice(0, -1).join(' ') + (tokens.length > 1 ? ' ' : '') + 'has:';
                            setSearch(newCond);
                            searchContainerRef.current?.querySelector('input')?.focus();
                          }}
                          sx={{
                            px: 1.5, py: 0.5, cursor: 'pointer', borderRadius: '4px', fontSize: '0.78rem', fontFamily: 'monospace',
                            '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.08) },
                          }}
                        >
                          <span style={{ color: theme.palette.primary.main }}>has</span>:
                          <span style={{ color: 'text.disabled', fontSize: '0.7rem', marginLeft: 8 }}>{t('argus.discover.hasDesc', 'Find events with this tag')}</span>
                        </Box>
                      )}
                      {filteredFields.map(field => (
                        <Box key={field}
                          onClick={() => {
                            const newCond = tokens.slice(0, -1).join(' ') + (tokens.length > 1 ? ' ' : '') + field + ':';
                            setSearch(newCond);
                            searchContainerRef.current?.querySelector('input')?.focus();
                          }}
                          sx={{
                            px: 1.5, py: 0.5, cursor: 'pointer', borderRadius: '4px', fontSize: '0.78rem', fontFamily: 'monospace',
                            '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.08) },
                          }}
                        >
                          <span style={{ color: theme.palette.primary.main }}>{field}</span>:
                        </Box>
                      ))}
                      {filteredFields.length === 0 && (!lastToken || !'has:'.includes(lastToken)) && (
                        <Typography sx={{ px: 1, py: 1, fontSize: '0.75rem', color: 'text.disabled', fontStyle: 'italic' }}>
                          {t('argus.discover.noValues', 'No matching values')}
                        </Typography>
                      )}
                    </>
                  );
                })()}
              </Box>
            </Popover>
          </Box>
        }
      />

      {/* ─── Real Facet Map replacing dummy chips ─── */}
      <DiscoverFacetMap 
        facets={mappedFacets} 
        onSelectFacet={(key, val, ex) => addSearchTag(key, val, ex ? '!=' : 'is')}
        loading={loading}
      />

      <VolumeChart data={volume} isDark={isDark} period={currentPeriod} />

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <SegmentedTabs
          items={[
            { key: '0', label: t('argus.logs.logsTab', 'Logs') },
            { key: '1', label: t('argus.logs.aggregatesTab', 'Aggregates') },
          ]}
          value={String(activeTab)}
          onChange={(key) => { setUrlState({ tab: key }); if (key === '1' && !aggData) fetchAggregates(); }}
        />

        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          {totalLogCount > 0 && (
            <Chip
              size="small"
              label={`${logs.length.toLocaleString()} / ${totalLogCount.toLocaleString()}`}
              sx={{
                height: 22, fontSize: '0.68rem', fontWeight: 700, fontFamily: 'monospace',
                backgroundColor: alpha(theme.palette.primary.main, 0.08),
                color: 'text.secondary', border: 'none',
              }}
            />
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {t('argus.logs.autoRefresh', 'Auto-refresh')}
            </Typography>
            <FeatureSwitch
              checked={autoRefresh}
              onChange={() => setAutoRefresh(!autoRefresh)}
              size="small"
              label={autoRefresh ? 'ON' : 'OFF'}
              color="#43a047"
            />
          </Box>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.3, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)' }} />

          <Button variant="outlined" size="small" startIcon={<EditTableIcon sx={{ fontSize: 15 }} />}
            onClick={openEditTable}
            sx={{
              textTransform: 'none', fontSize: '0.72rem', fontWeight: 600, px: 1.2,
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              borderRadius: '6px', whiteSpace: 'nowrap',
            }}>
            {t('argus.logs.editTable', 'Edit Table')}
          </Button>

          <Tooltip title={t('argus.logs.export', 'Export')}>
            <IconButton size="small" onClick={handleExport}>
              <ExportIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>

          {/* Time Jump */}
          {showGotoTime ? (
            <Box component="input"
              placeholder="HH:MM:SS"
              value={gotoTime}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGotoTime(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter' && gotoTime) {
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
                  setShowGotoTime(false);
                  setGotoTime('');
                } else if (e.key === 'Escape') {
                  setShowGotoTime(false);
                  setGotoTime('');
                }
              }}
              autoFocus
              sx={{
                width: 90, height: 26, border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                borderRadius: '6px', px: 1, fontSize: '0.72rem', fontFamily: 'monospace',
                backgroundColor: 'transparent', color: 'text.primary', outline: 'none',
                '&:focus': { borderColor: theme.palette.primary.main },
              }}
            />
          ) : (
            <Tooltip title={t('argus.logs.jumpToTime', 'Jump to time')}>
              <IconButton size="small" onClick={() => setShowGotoTime(true)} sx={{ p: 0.4 }}>
                <GotoTimeIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}

          {/* Wrap Lines */}
          <Tooltip title={wrapLines ? t('argus.logs.unwrapLines', 'Unwrap lines') : t('argus.logs.wrapLines', 'Wrap lines')}>
            <IconButton size="small" onClick={() => setWrapLines(w => !w)} color={wrapLines ? 'primary' : 'default'} sx={{ p: 0.4 }}>
              <WrapTextIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>

          {/* Fullscreen */}
          <Tooltip title={logsFullscreen ? t('argus.logs.exitFullscreen', 'Exit fullscreen') : t('argus.logs.fullscreen', 'Fullscreen')}>
            <IconButton size="small" onClick={() => setLogsFullscreen(f => !f)} sx={{ p: 0.4 }}>
              {logsFullscreen ? <FullscreenExitIcon sx={{ fontSize: 18 }} /> : <FullscreenIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {activeTab === 0 && (
        <Paper elevation={0} sx={{
          borderRadius: 2, overflow: 'hidden',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          ...(logsFullscreen ? {
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 1300, m: 0, borderRadius: 0,
            display: 'flex', flexDirection: 'column',
            backgroundColor: theme.palette.background.paper,
          } : {}),
        }}>
          {/* Fullscreen header bar */}
          {logsFullscreen && (
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              px: 2, py: 1,
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700 }}>
                  {t('argus.logs.title', 'Logs')}
                </Typography>
                <Chip label={`${logs.length}`} size="small" sx={{
                  height: 22, fontSize: '0.7rem', fontWeight: 700,
                }} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tooltip title={wrapLines ? t('argus.logs.unwrapLines', 'Unwrap lines') : t('argus.logs.wrapLines', 'Wrap lines')}>
                  <IconButton size="small" onClick={() => setWrapLines(w => !w)} color={wrapLines ? 'primary' : 'default'} sx={{ p: 0.4 }}>
                    <WrapTextIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t('argus.logs.exitFullscreen', 'Exit fullscreen')}>
                  <IconButton size="small" onClick={() => setLogsFullscreen(false)} sx={{ p: 0.4 }}>
                    <FullscreenExitIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          )}
          <Box sx={{
            display: 'flex', alignItems: 'center', px: 1.5, py: 0.8,
            borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
          }}>
            <Box sx={{ width: 44 }} />
            {columns.map(col => {
              const cfg = AVAILABLE_COLUMNS.find(c => c.key === col);
              const isMessage = col === 'message';
              return (
                <Box key={col} sx={{
                  flex: isMessage ? 3 : col === 'timestamp' ? 1.3 : 0.8,
                  minWidth: col === 'timestamp' ? 165 : isMessage ? 200 : 80,
                  display: 'flex', alignItems: 'center', gap: 0.3,
                }}>
                  <Typography sx={{
                    fontSize: '0.68rem', fontWeight: 700, color: 'text.disabled',
                    textTransform: 'uppercase', letterSpacing: '0.03em',
                  }}>
                    {cfg?.label || col.toUpperCase()}
                  </Typography>
                  {col === 'timestamp' && <SortDescIcon sx={{ fontSize: 12, color: 'text.disabled' }} />}
                </Box>
              );
            })}
          </Box>

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
        </Paper>
      )}

      {activeTab === 1 && (
        <Paper elevation={0} sx={{
          borderRadius: 2, overflow: 'hidden',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        }}>
          {/* Toolbar */}
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1,
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            backgroundColor: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.01)',
          }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' }}>
              {t('argus.logs.groupByLabel', 'Group by')}
            </Typography>
            <FormControl size="small" variant="outlined" sx={{ minWidth: 130 }}>
              <Select value={aggGroupBy} onChange={(e) => { setUrlState({ groupBy: e.target.value }); fetchAggregates(e.target.value); }}
                sx={{ fontSize: '0.75rem', fontWeight: 600, height: 28, '& .MuiSelect-select': { py: 0.5 } }}>
                <MenuItem value="level" sx={{ fontSize: '0.75rem' }}>{t('argus.logs.agg.level', 'Severity')}</MenuItem>
                <MenuItem value="service" sx={{ fontSize: '0.75rem' }}>{t('argus.logs.agg.service', 'Service')}</MenuItem>
                <MenuItem value="environment" sx={{ fontSize: '0.75rem' }}>{t('argus.logs.agg.environment', 'Environment')}</MenuItem>
                <MenuItem value="logger_name" sx={{ fontSize: '0.75rem' }}>{t('argus.logs.agg.logger', 'Logger')}</MenuItem>
                <MenuItem value="release" sx={{ fontSize: '0.75rem' }}>{t('argus.logs.agg.release', 'Release')}</MenuItem>
              </Select>
            </FormControl>
            <Box sx={{ flex: 1 }} />
            {aggData && (
              <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
                {aggData.topValues.length} {t('argus.logs.agg.groups', 'groups')}
              </Typography>
            )}
          </Box>

          <PageContentLoader loading={aggLoading}>
            {aggData && aggData.topValues.length > 0 ? (
              <Box>
                {/* Stacked time series chart */}
                {aggData.timeSeries.length > 0 && (
                  <Box sx={{ p: 2, pb: 1 }}>
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', mb: 1 }}>
                      {t('argus.logs.agg.countOverTime', 'Count over time')}
                    </Typography>
                    <Box sx={{ height: 150 }}>
                      <Bar
                        data={(() => {
                          const groups = [...new Set(aggData.timeSeries.map(d => d.group_value))];
                          const buckets = [...new Set(aggData.timeSeries.map(d => d.bucket))].sort();
                          const labels = buckets.map(b => {
                            const d = new Date(b);
                            return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
                          });
                          const colors = ['#7c4dff', '#448aff', '#00bcd4', '#ff9800', '#f44336', '#4caf50', '#9c27b0'];
                          const datasets = groups.map((g, gi) => ({
                            label: g || '(empty)',
                            data: buckets.map(b => {
                              const found = aggData.timeSeries.find(d => d.bucket === b && d.group_value === g);
                              return found ? Number(found.count) : 0;
                            }),
                            backgroundColor: alpha(colors[gi % colors.length], 0.7),
                            borderRadius: 1,
                            barPercentage: 0.9,
                            categoryPercentage: 0.92,
                          }));
                          return { labels, datasets };
                        })()}
                        options={{
                          responsive: true, maintainAspectRatio: false,
                          animation: { duration: 300 },
                          plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 10, font: { size: 10 } } }, tooltip: { enabled: true } },
                          scales: {
                            x: { stacked: true, grid: { display: false }, ticks: { font: { size: 9 }, color: isDark ? '#555' : '#bbb', maxTicksLimit: 8 }, border: { display: false } },
                            y: { stacked: true, grid: { color: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 9 }, color: isDark ? '#555' : '#bbb' }, border: { display: false }, beginAtZero: true },
                          },
                        }}
                      />
                    </Box>
                  </Box>
                )}

                {/* Top values table */}
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                          {aggGroupBy}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                          {t('argus.logs.agg.count', 'Count')}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, width: '40%' }}>
                          {t('argus.logs.agg.percentage', '%')}
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(() => {
                        const total = aggData.topValues.reduce((s, v) => s + Number(v.count), 0);
                        return aggData.topValues.map((row, idx) => {
                          const pct = total > 0 ? (Number(row.count) / total) * 100 : 0;
                          const colors = ['#7c4dff', '#448aff', '#00bcd4', '#ff9800', '#f44336', '#4caf50', '#9c27b0'];
                          return (
                            <TableRow key={idx} hover sx={{ cursor: 'pointer', '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.008)' } }}
                              onClick={() => addSearchTag(aggGroupBy, row.group_value)}
                            >
                              <TableCell sx={{ fontSize: '0.78rem', fontFamily: 'monospace', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}` }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors[idx % colors.length], flexShrink: 0 }} />
                                  {row.group_value || '(empty)'}
                                </Box>
                              </TableCell>
                              <TableCell align="right" sx={{ fontSize: '0.78rem', fontFamily: 'monospace', fontWeight: 600, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}` }}>
                                {Number(row.count).toLocaleString()}
                              </TableCell>
                              <TableCell sx={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}` }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Box sx={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                                    <Box sx={{ width: `${pct}%`, height: '100%', borderRadius: 3, backgroundColor: colors[idx % colors.length], transition: 'width 0.3s' }} />
                                  </Box>
                                  <Typography sx={{ fontSize: '0.68rem', fontFamily: 'monospace', color: 'text.disabled', minWidth: 35, textAlign: 'right' }}>
                                    {pct.toFixed(1)}%
                                  </Typography>
                                </Box>
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                    </TableBody>
                  </Table>
                </Box>
              </Box>
            ) : !aggLoading ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <ViewIcon sx={{ fontSize: 48, color: alpha(theme.palette.primary.main, 0.15), mb: 1 }} />
                <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, mb: 0.5 }}>
                  {t('argus.logs.aggregatesTitle', 'Log Aggregates')}
                </Typography>
                <Typography color="text.disabled" sx={{ fontSize: '0.8rem' }}>
                  {t('argus.logs.aggregatesDesc', 'Group and count logs by attributes to identify patterns.')}
                </Typography>
              </Box>
            ) : null}
          </PageContentLoader>
        </Paper>
      )}

      <Dialog open={editTableOpen} onClose={() => setEditTableOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 2.5 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem', pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {t('argus.logs.editTable', 'Edit Table')}
          <IconButton size="small" onClick={() => setEditTableOpen(false)}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.disabled" sx={{ mb: 1.5, display: 'block' }}>
            {t('argus.logs.editTableDesc', 'Select columns to display in the log table.')}
          </Typography>
          {AVAILABLE_COLUMNS.map(col => (
            <FormControlLabel key={col.key}
              control={<Checkbox size="small" checked={tempColumns.includes(col.key)} onChange={() => toggleColumn(col.key)}
                sx={{ '&.Mui-checked': { color: theme.palette.primary.main } }} />}
              label={<Typography sx={{ fontSize: '0.82rem', fontFamily: 'monospace' }}>{col.label}</Typography>}
              sx={{ display: 'flex', mb: 0.3 }}
            />
          ))}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setTempColumns(DEFAULT_COLUMNS)} sx={{ textTransform: 'none', fontSize: '0.78rem' }}>
            {t('argus.logs.resetColumns', 'Reset')}
          </Button>
          <Button variant="contained" onClick={saveEditTable} disabled={tempColumns.length === 0}
            sx={{ textTransform: 'none', fontWeight: 700 }}>
            {t('common.save', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ArgusLogsPage;
