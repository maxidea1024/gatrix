import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Box, Typography, Paper, Button, Chip, useTheme, alpha,
  Table, TableHead, TableBody, TableRow, TableCell,
  FormControl, Select, MenuItem,
  IconButton, Tooltip, CircularProgress, Drawer,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Popover,
} from '@mui/material';
import {
  Search as SearchIcon, Explore as DiscoverIcon,
  Delete as DeleteIcon, Save as SaveIcon,
  Bookmark as BookmarkIcon, BookmarkBorder as BookmarkBorderIcon,
  ViewColumn as ColumnsIcon, FileDownload as ExportIcon,
  ArrowDownward as SortDescIcon, ArrowUpward as SortAscIcon,
  FilterList as FilterIcon, Block as ExcludeIcon,
  Close as CloseIcon, ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip as ChartTooltip } from 'chart.js';
import PageContentLoader from '@/components/common/PageContentLoader';
import SegmentedTabs from '@/components/common/SegmentedTabs';
import PageHeader from '@/components/common/PageHeader';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import EditablePageTitle from '@/components/common/EditablePageTitle';
import FeatureSwitch from '@/components/common/FeatureSwitch';
import { TableSkeleton, ChartSkeleton } from '@/components/argus/ArgusSkeletons';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import ArgusFilterBar, { ArgusFilterState, defaultArgusFilterState, argusFilterStateToApiParams } from '@/components/argus/ArgusFilterBar';
import DiscoverFacetMap from '@/components/argus/DiscoverFacetMap';
import ArgusQueryBuilder from '@/components/argus/ArgusQueryBuilder';
import argusService, { ArgusSavedQuery } from '@/services/argusService';
import ColumnEditorModal from '@/components/argus/ColumnEditorModal';
import InteractiveTimeSeriesChart from '@/components/argus/InteractiveTimeSeriesChart';
import useArgusUrlState from '@/hooks/useArgusUrlState';
import { useLocation } from 'react-router-dom';
import { useOrgProject } from '@/contexts/OrgProjectContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip);

/* ─── Constants ─── */

const FALLBACK_COLUMNS = ['event_id', 'timestamp', 'level', 'platform', 'browser', 'os', 'environment', 'release', 'transaction'];

const DISPLAY_OPTIONS_KEYS = [
  { value: 'total', labelKey: 'argus.discover.displayTotal' },
  { value: 'bar', labelKey: 'argus.discover.displayBar' },
  { value: 'top5', labelKey: 'argus.discover.displayTop5' },
  { value: 'daily', labelKey: 'argus.discover.displayDaily' },
];

const Y_AXIS_OPTIONS = [
  { value: 'count()', label: 'count()' },
  { value: 'uniq(event_id)', label: 'count_unique(event_id)' },
  { value: 'uniq(user_id)', label: 'count_unique(user_id)' },
];

/* ─── Volume Chart ─── */

const VolumeChart: React.FC<{
  data: { bucket: string; level: string; count: number }[];
  isDark: boolean;
  period: string;
  onZoom?: (start: string, end: string) => void;
}> = ({ data, isDark, onZoom }) => {
  const { t, i18n } = useTranslation();
  const { sortedBuckets, chartData } = useMemo(() => {
    if (data.length === 0) return { sortedBuckets: [] as string[], chartData: null };
    const bucketMap = new Map<string, number>();
    data.forEach(p => {
      const count = Number(p.count) || 0;
      bucketMap.set(p.bucket, (bucketMap.get(p.bucket) || 0) + count);
    });
    const sorted = [...bucketMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const labels = sorted.map(([b]) => {
      const d = new Date(b);
      return d.toLocaleString(i18n.language || 'en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    });
    const values = sorted.map(([, c]) => c);
    return {
      sortedBuckets: sorted.map(([b]) => b),
      chartData: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: alpha('#7c4dff', 0.55),
          hoverBackgroundColor: '#7c4dff',
          borderRadius: 1,
          barPercentage: 0.9,
          categoryPercentage: 0.92,
        }],
      },
    };
  }, [data]);

  const chartRef = useRef<any>(null);
  const dragRef = useRef<{ startIdx: number; active: boolean }>({ startIdx: -1, active: false });

  const handleChartClick = useCallback((_event: any, elements: any[]) => {
    if (!onZoom || sortedBuckets.length === 0 || elements.length === 0) return;
    const idx = elements[0].index;
    const bucket = sortedBuckets[idx];
    if (bucket) {
      const start = new Date(bucket);
      const end = new Date(start.getTime() + 3600_000); // 1hr bucket
      onZoom(start.toISOString(), end.toISOString());
    }
  }, [onZoom, sortedBuckets]);

  if (!chartData) return (
    <EmptyPlaceholder message={t('argus.discover.noEventData')} minHeight={130} />
  );

  return (
    <Paper elevation={0} sx={{
      mb: 2, p: 2, pt: 1.5, borderRadius: 2,
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
    }}>
      <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, mb: 1, color: 'text.secondary' }}>
        {t('argus.discover.volumeTitle', 'count(events)')}
      </Typography>
      <Box sx={{ height: 130, cursor: onZoom ? 'crosshair' : undefined }}>
        <Bar ref={chartRef} data={chartData} options={{
          responsive: true, maintainAspectRatio: false,
          animation: { duration: 300 },
          onClick: handleChartClick,
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

/* ─── GroupBy Chip Selector ─── */

const GroupBySelector: React.FC<{
  groupBy: string[];
  columns: string[];
  onToggle: (col: string) => void;
  isDark: boolean;
}> = ({ groupBy, columns, onToggle, isDark }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);

  return (
    <>
      <Box
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.5,
          height: 32, px: 1.5, borderRadius: '6px',
          border: '1px solid', borderColor: anchorEl ? 'primary.main' : 'divider',
          bgcolor: anchorEl ? alpha(theme.palette.primary.main, 0.04) : 'transparent',
          cursor: 'pointer', transition: 'all 0.15s', userSelect: 'none', whiteSpace: 'nowrap',
          '&:hover': { borderColor: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.04) },
        }}
      >
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.secondary' }}>
          {t('argus.discover.groupBy', 'Group By')}:
        </Typography>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: groupBy.length > 0 ? theme.palette.primary.main : 'text.primary' }}>
          {groupBy.length > 0 ? groupBy.join(', ') : t('argus.discover.none', 'None')}
        </Typography>
        <ExpandMoreIcon sx={{ fontSize: 13, color: 'text.disabled', transform: anchorEl ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </Box>
      <Popover
        open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { mt: 0.5, borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', minWidth: 200, maxHeight: 320, overflow: 'auto', py: 0.5 } } }}
      >
        {columns.filter(c => !c.includes('(')).slice(0, 15).map(col => (
          <Box
            key={col}
            onClick={() => onToggle(col)}
            sx={{
              px: 1.5, py: 0.6, cursor: 'pointer', fontSize: '0.78rem', fontWeight: groupBy.includes(col) ? 700 : 400,
              color: groupBy.includes(col) ? theme.palette.primary.main : 'text.primary',
              backgroundColor: groupBy.includes(col) ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
              transition: 'background 0.1s', display: 'flex', alignItems: 'center', gap: 1,
              '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.04) },
            }}
          >
            <Box sx={{
              width: 14, height: 14, borderRadius: '3px', border: `1.5px solid ${groupBy.includes(col) ? theme.palette.primary.main : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}`,
              backgroundColor: groupBy.includes(col) ? theme.palette.primary.main : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {groupBy.includes(col) && <Typography sx={{ color: '#fff', fontSize: '0.6rem', fontWeight: 800 }}>✓</Typography>}
            </Box>
            {col}
          </Box>
        ))}
      </Popover>
    </>
  );
};

/* ─── Display Mode Chip ─── */

const DisplayModeChip: React.FC<{
  value: string;
  onChange: (v: string) => void;
  isDark: boolean;
}> = ({ value, onChange, isDark }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const currentOpt = DISPLAY_OPTIONS_KEYS.find(o => o.value === value);
  const displayLabel = currentOpt ? t(currentOpt.labelKey, currentOpt.value) : value;

  return (
    <>
      <Box
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.5,
          height: 28, px: 1.2, borderRadius: '6px',
          border: '1px solid', borderColor: 'divider',
          cursor: 'pointer', transition: 'all 0.15s', userSelect: 'none', whiteSpace: 'nowrap',
          '&:hover': { borderColor: 'primary.main' },
        }}
      >
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary' }}>{t('argus.discover.display', 'Display')}:</Typography>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.primary' }}>{displayLabel}</Typography>
        <ExpandMoreIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
      </Box>
      <Popover
        open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { mt: 0.5, borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', minWidth: 140, py: 0.5 } } }}
      >
        {DISPLAY_OPTIONS_KEYS.map(opt => (
          <Box
            key={opt.value}
            onClick={() => { onChange(opt.value); setAnchorEl(null); }}
            sx={{
              px: 1.5, py: 0.6, cursor: 'pointer', fontSize: '0.78rem',
              fontWeight: opt.value === value ? 700 : 400,
              color: opt.value === value ? 'primary.main' : 'text.primary',
              backgroundColor: opt.value === value ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
              '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.04) },
            }}
          >
            {t(opt.labelKey, opt.value)}
          </Box>
        ))}
      </Popover>
    </>
  );
};

/* ─── Main Component ─── */

const ArgusDiscoverPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const location = useLocation();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

  // ─── URL-driven state ───
  const URL_PARAMS = useMemo(() => ({
    period:   { key: 'period',   default: '24h',                    storageKey: 'argus-discover-period' },
    fields:   { key: 'fields',   default: 'count(),level,platform', type: 'array' as const },
    groupBy:  { key: 'groupBy',  default: 'level',                  type: 'array' as const },
    q:        { key: 'q',        default: '' },
    orderBy:  { key: 'orderBy',  default: '-count' },
    display:  { key: 'display',  default: 'total' },
    yAxis:    { key: 'yAxis',    default: 'count()' },
    queryId:  { key: 'queryId',  default: '' },
  }), []);
  const [urlState, setUrlState] = useArgusUrlState(URL_PARAMS);

  const fields = urlState.fields as string[];
  const groupBy = urlState.groupBy as string[];
  const displayMode = urlState.display;
  const yAxis = urlState.yAxis;
  const orderBy = urlState.orderBy;
  const orderDir: 'asc' | 'desc' = orderBy.startsWith('-') ? 'desc' : 'asc';

  // Derive ArgusFilterState from URL period
  const [filters, setFilters] = useState<ArgusFilterState>(
    () => defaultArgusFilterState(urlState.period)
  );

  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      dateRange: { type: 'preset', preset: urlState.period }
    }));
  }, [urlState.period]);

  // Search conditions (raw input)
  const [conditions, setConditions] = useState<string>(urlState.q || '');

  // Sync state if URL changes externally
  useEffect(() => {
    setConditions(urlState.q || '');
  }, [urlState.q]);

  // ─── Results ───
  const [results, setResults] = useState<Record<string, any>[]>([]);
  const [volume, setVolume] = useState<{bucket:string; level:string; count:number}[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasQueried, setHasQueried] = useState(false);

  const [savedQueries, setSavedQueries] = useState<ArgusSavedQuery[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [savedPanelOpen, setSavedPanelOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [currentQueryId, setCurrentQueryId] = useState<number | null>(null);
  
  // Editable Query Name
  const defaultQueryName = t('argus.discover.newQuery', 'New Discover Query');
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

  // Query Builder State
  const [builderAnchorEl, setBuilderAnchorEl] = useState<HTMLElement | null>(null);

  // Autocomplete
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [searchFocused, setSearchFocused] = useState(false);

  // ─── Tag/schema data ───
  const [facets, setFacets] = useState<Record<string, any[]>>({});
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [availableAggregates, setAvailableAggregates] = useState<string[]>([]);

  const groupableColumns = useMemo(
    () => (availableColumns.length > 0 ? availableColumns : FALLBACK_COLUMNS).filter(c => !c.includes('(')),
    [availableColumns],
  );

  const currentPeriod = useMemo(() => {
    if (filters.dateRange.type === 'preset' && filters.dateRange.preset) return filters.dateRange.preset;
    return '24h';
  }, [filters.dateRange]);

  // ─── API calls ───
  // Build SQL conditions from searchTags + raw conditions
  const buildConditions = useCallback(() => {
    return urlState.q || '';
  }, [urlState.q]);

  const fetchVolume = useCallback(async () => {
    try {
      const apiParams = argusFilterStateToApiParams(filters);
      const data = await argusService.getDiscoverVolume(projectId, {
        period: apiParams.period || currentPeriod,
        start: apiParams.start,
        end: apiParams.end,
        search: buildConditions(),
      });
      setVolume(data);
    } catch (err) { console.error('Failed to fetch volume', err); }
  }, [projectId, filters, currentPeriod, buildConditions]);

  const runQuery = useCallback(async () => {
    setLoading(true);
    setError(null);
    setHasQueried(true);
    try {
      const apiParams = argusFilterStateToApiParams(filters);
      const builtConditions = buildConditions();
      
      const queryFields = [...fields];
      if (yAxis && !queryFields.includes(yAxis)) {
        queryFields.push(yAxis);
      }

      const result = await argusService.discoverQuery(projectId, {
        fields: queryFields,
        groupBy: groupBy.length > 0 ? groupBy : undefined,
        conditions: builtConditions || undefined,
        orderBy: orderBy || undefined,
        limit: 50,
        period: apiParams.period || currentPeriod,
        start: apiParams.start,
        end: apiParams.end,
      });
      setResults(result.data || []);
      fetchVolume(); // fetch volume alongside query
    } catch (err: any) {
      setError(err?.message || t('argus.discover.queryFailed', 'Query failed'));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [fields, groupBy, buildConditions, orderBy, filters, currentPeriod, projectId, t, fetchVolume, yAxis]);

  useEffect(() => {
    argusService.listSavedQueries(projectId).then(setSavedQueries).catch(() => setSavedQueries([]));
    argusService.discoverTags(projectId).then(data => {
      setFacets(data.tags || {});
      setAvailableColumns(data.columns?.length ? data.columns : FALLBACK_COLUMNS);
      setAvailableAggregates(data.aggregates?.length ? data.aggregates : ['count', 'uniq', 'avg', 'sum', 'p95']);
    }).catch(() => {
      // Backend may fail — use fallback columns so UI is still functional
      setAvailableColumns(FALLBACK_COLUMNS);
      setAvailableAggregates(['count', 'uniq', 'avg', 'sum', 'p95']);
    });
    fetchVolume(); // Fetch initial volume on load
  }, [projectId, fetchVolume]);

  // Auto-run query on initial load
  useEffect(() => {
    runQuery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run query when yAxis changes (only after initial query)
  const yAxisRef = useRef(yAxis);
  useEffect(() => {
    if (yAxisRef.current !== yAxis) {
      yAxisRef.current = yAxis;
      if (hasQueried) runQuery();
    }
  }, [yAxis, hasQueried, runQuery]);

  const handleSaveQuery = async () => {
    if (!saveName.trim()) return;
    try {
      const res = await argusService.createSavedQuery(projectId, {
        name: saveName.trim(),
        query_config: { fields, conditions, groupBy, orderBy, period: currentPeriod },
        display_type: displayMode,
      });
      const updated = await argusService.listSavedQueries(projectId);
      setSavedQueries(updated);
      setQueryName(saveName.trim());
      if (res.id) setCurrentQueryId(res.id);
      setSaveDialogOpen(false);
      setSaveName('');
    } catch (err) { console.error('Failed to save query:', err); }
  };

  const handleRename = async (newName: string) => {
    setQueryName(newName);
    if (currentQueryId) {
      try {
        await argusService.updateSavedQuery(projectId, currentQueryId, { name: newName });
        const updated = await argusService.listSavedQueries(projectId);
        setSavedQueries(updated);
      } catch (err) { console.error('Failed to rename query:', err); }
    }
  };

  const handleDeleteSavedQuery = async (id: number) => {
    try {
      await argusService.deleteSavedQuery(projectId, id);
      setSavedQueries(prev => prev.filter(q => q.id !== id));
      if (currentQueryId === id) {
        setCurrentQueryId(null);
      }
    } catch (err) { console.error('Failed to delete query:', err); }
  };

  const handleLoadSavedQuery = (query: ArgusSavedQuery) => {
    const cfg = typeof query.query_config === 'string' ? JSON.parse(query.query_config) : query.query_config;
    setUrlState({
      fields: cfg.fields || ['count()'],
      groupBy: cfg.groupBy || [],
      orderBy: cfg.orderBy || '-count',
    });
    setConditions(cfg.conditions || '');
    setQueryName(query.name);
    setCurrentQueryId(query.id);
    setSavedPanelOpen(false);
  };

  const addSearchTag = (key: string, value: string, op: string = 'is') => {
    const opStr = op === '!=' ? '!=' : ':';
    const appendStr = `${key}${opStr}"${value}"`;
    
    // Replace the last typing token if it matches
    let newConditions = conditions;
    const colonMatch = conditions.match(/([\w.-]+):([^\s]*)$/);
    if (colonMatch && colonMatch[1] === key) {
      newConditions = conditions.substring(0, conditions.length - colonMatch[0].length);
    } else {
      const bareMatch = conditions.match(/([\w.-]+)$/);
      if (bareMatch && bareMatch[1] === key) {
        newConditions = conditions.substring(0, conditions.length - bareMatch[0].length);
      }
    }
    
    const finalStr = (newConditions.trim() + ' ' + appendStr).trim();
    setConditions(finalStr);
    setUrlState({ q: finalStr });
    setSearchFocused(false);
  };

  const handleSelectFacet = (tag: string, value: string, exclude?: boolean) => {
    addSearchTag(tag, value, exclude ? '!=' : 'is');
  };

  const handleColumnSort = (colKey: string) => {
    if (orderBy === colKey || orderBy === `-${colKey}`) {
      const newOrderBy = orderDir === 'desc' ? colKey : `-${colKey}`;
      setUrlState({ orderBy: newOrderBy });
    } else {
      setUrlState({ orderBy: `-${colKey}` });
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setUrlState({ q: conditions.trim() });
      setSearchFocused(false);
      // Wait a tick for URL state to update, then run query
      setTimeout(runQuery, 10);
    }
  };

  const toggleGroupBy = (col: string) => {
    const next = groupBy.includes(col) ? groupBy.filter(c => c !== col) : [...groupBy, col];
    setUrlState({ groupBy: next });
  };

  const handleFilterChange = (newFilters: ArgusFilterState) => {
    setFilters(newFilters);
    if (newFilters.dateRange.type === 'preset' && newFilters.dateRange.preset) {
      setUrlState({ period: newFilters.dateRange.preset });
    }
  };

  const handleExport = () => {
    if (results.length === 0) return;
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `discover-${new Date().toISOString()}.json`;
    a.click();
  };

  const resultsToChartData = () => {
    if (results.length === 0) return [];
    
    let numKey = yAxis;
    if (!numKey || !(numKey in results[0])) {
      const keys = Object.keys(results[0]);
      numKey = keys.find(k => typeof results[0][k] === 'number' || !isNaN(Number(results[0][k]))) || '';
    }
    
    let labelKey = groupBy.length > 0 ? groupBy[0] : '';
    if (!labelKey || !(labelKey in results[0])) {
      labelKey = Object.keys(results[0]).find(k => k !== numKey) || '';
    }
    
    if (!numKey || !labelKey) return [];
    return results.slice(0, 50).map(r => ({ label: String(r[labelKey]), count: Number(r[numKey]) }));
  };

  const currentOrderCol = orderBy.replace(/^-/, '');

  const resultsTableContent = useMemo(() => (
    <PageContentLoader loading={loading} skeleton={<TableSkeleton rows={8} cols={fields.length || 4} />}>
      {results.length > 0 ? (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {Object.keys(results[0]).map(key => (
                  <TableCell key={key}
                    onClick={() => handleColumnSort(key)}
                    sx={{
                      fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                      borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                      whiteSpace: 'nowrap', userSelect: 'none',
                      '&:hover': { color: theme.palette.primary.main },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {key}
                      {currentOrderCol === key && (
                        orderDir === 'desc'
                          ? <SortDescIcon sx={{ fontSize: 14, color: theme.palette.primary.main }} />
                          : <SortAscIcon sx={{ fontSize: 14, color: theme.palette.primary.main }} />
                      )}
                    </Box>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((row, idx) => (
                <TableRow key={idx} hover sx={{
                  '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.008)' },
                }}>
                  {Object.entries(row).map(([colKey, val], cidx) => (
                    <TableCell key={cidx} sx={{
                      fontSize: '0.78rem', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                      position: 'relative', whiteSpace: 'nowrap',
                      '&:hover .cell-actions': { opacity: 1 },
                    }}>
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                        <span>{typeof val === 'number' ? val.toLocaleString() : String(val)}</span>
                        <Box className="cell-actions" sx={{
                          opacity: 0, transition: 'opacity 0.15s', display: 'inline-flex', gap: 0.25, ml: 0.5,
                        }}>
                          <Tooltip title={t('argus.discover.facet.addToFilter', 'Add to filter')}>
                            <IconButton size="small" onClick={() => handleSelectFacet(colKey, String(val), false)}
                              sx={{ p: 0.25, color: theme.palette.primary.main }}>
                              <FilterIcon sx={{ fontSize: 13 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={t('argus.discover.facet.exclude', 'Exclude')}>
                            <IconButton size="small" onClick={() => handleSelectFacet(colKey, String(val), true)}
                              sx={{ p: 0.25, color: theme.palette.error.main }}>
                              <ExcludeIcon sx={{ fontSize: 13 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      ) : !loading && !error ? (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <DiscoverIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary" sx={{ fontSize: '0.88rem' }}>
            {t('argus.discover.empty', 'Build a query and press Search to explore your data')}
          </Typography>
        </Box>
      ) : null}
    </PageContentLoader>
  ), [loading, results, fields, theme, isDark, t, currentOrderCol, orderDir, handleColumnSort, handleSelectFacet, error]);

  /* ═══ RENDER ═══ */
  return (
    <Box>
      <PageHeader
        icon={<DiscoverIcon />}
        title={
          <ArgusBreadcrumbs size="title" paths={[
            { label: t('argus.explore.title', 'Explore'), to: `/argus/explore` },
            { label: <EditablePageTitle value={queryName} onChange={handleRename} placeholder={defaultQueryName} /> }
          ]} />
        }
        subtitle={t('argus.discover.subtitle', 'Query and explore your error data')}
        actions={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Tooltip title={t('argus.discover.savedQueries', 'Saved Queries')}>
              <IconButton size="small" onClick={() => setSavedPanelOpen(true)}
                sx={{ color: savedQueries.length > 0 ? theme.palette.primary.main : 'text.secondary' }}>
                {savedQueries.length > 0 ? <BookmarkIcon sx={{ fontSize: 20 }} /> : <BookmarkBorderIcon sx={{ fontSize: 20 }} />}
              </IconButton>
            </Tooltip>
            <Button
              size="small" variant="outlined" startIcon={<SaveIcon sx={{ fontSize: 15 }} />}
              onClick={() => { setSaveName(queryName === defaultQueryName ? '' : queryName); setSaveDialogOpen(true); }} disabled={fields.length === 0}
              sx={{
                textTransform: 'none', fontSize: '0.75rem', fontWeight: 600,
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                borderRadius: '6px',
              }}
            >
              {t('argus.discover.saveAs', 'Save as...')}
            </Button>
          </Box>
        }
      />

      <ArgusFilterBar
        projectId={projectId}
        value={filters}
        onChange={handleFilterChange}
        onRefresh={hasQueried ? runQuery : undefined}
        loading={loading}
        hideFilters={['browser', 'os']}
        extraControls={
          <GroupBySelector
            groupBy={groupBy}
            columns={groupableColumns}
            onToggle={toggleGroupBy}
            isDark={isDark}
          />
        }
      />

      {/* ── Advanced Search Bar ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Box
          ref={searchContainerRef}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.5, flex: 1,
            px: 1, py: 0.3, borderRadius: '8px', minHeight: 36,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            transition: 'border-color 0.2s',
            backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#fff',
            '&:focus-within': { borderColor: theme.palette.primary.main, boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}` },
          }}>
          <SearchIcon sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0, ml: 0.5 }} />
          <Box component="input"
            value={conditions}
            spellCheck={false}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConditions(e.target.value)}
            onKeyDown={handleSearchKeyDown as any}
            onFocus={() => setSearchFocused(true)}
            placeholder={t('argus.discover.searchPlaceholder', 'Search for events, users, tags (e.g. level:error OR browser:Chrome)')}
            style={{
              flex: 1, border: 'none', outline: 'none', backgroundColor: 'transparent',
              color: 'inherit', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 500, minWidth: 120, padding: '6px 8px'
            }}
          />
          {conditions && (
            <IconButton size="small" onClick={() => { setConditions(''); setUrlState({ q: '' }); }} sx={{ p: 0.2, mr: 0.5 }}>
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
              borderRadius: '6px', height: 36, width: 36,
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
            }}
          >
            <FilterIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Button
          variant="contained" size="small"
          onClick={runQuery} disabled={loading || fields.length === 0}
          sx={{
            textTransform: 'none', fontWeight: 700, px: 2.5, height: 36,
            borderRadius: '6px', fontSize: '0.78rem',
          }}
        >
          {loading ? <CircularProgress size={16} color="inherit" /> : t('argus.discover.run', 'Search')}
        </Button>

        <ArgusQueryBuilder
          fields={groupableColumns}
          query={conditions}
          onApply={(q) => setConditions(q)}
          anchorEl={builderAnchorEl}
          onClose={() => setBuilderAnchorEl(null)}
        />

        {/* 2-stage Autocomplete: fields → values from facets */}
        <Popover
          open={searchFocused}
          anchorEl={searchContainerRef.current}
          onClose={() => setSearchFocused(false)}
          disableAutoFocus disableEnforceFocus
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          slotProps={{ paper: { sx: { width: searchContainerRef.current?.offsetWidth || 400, mt: 0.5, borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', maxHeight: 320, overflow: 'auto' } } }}
        >
          <Box sx={{ p: 1 }}>
            {(() => {
              const colonMatch = conditions.match(/([\w.-]+):([^\s]*)$/);

              if (colonMatch) {
                const fieldKey = colonMatch[1];
                const partialValue = colonMatch[2].toLowerCase();
                const values = (facets[fieldKey] || []) as { value: string; count: number }[];
                const filtered = partialValue
                  ? values.filter(v => v.value?.toLowerCase().includes(partialValue))
                  : values;

                if (filtered.length === 0) {
                  // If no facet data exists for this field at all, it's a free-text field
                  const hasFacetData = values.length > 0;
                  return (
                    <Typography sx={{ px: 1, py: 1, fontSize: '0.75rem', color: 'text.disabled', fontStyle: 'italic' }}>
                      {partialValue
                        ? t('argus.discover.pressEnterToUse', { val: partialValue })
                        : t('argus.discover.typeValue', 'Type a value and press Enter')}
                    </Typography>
                  );
                }

                const maxCount = Math.max(...filtered.map(v => v.count), 1);
                const totalCount = filtered.reduce((s, v) => s + v.count, 0);

                return (
                  <>
                    <Typography variant="caption" sx={{ px: 1, color: 'text.disabled', fontWeight: 600, display: 'block', mb: 0.5 }}>
                      {fieldKey} {t('argus.discover.values', 'values')}
                    </Typography>
                    {filtered.slice(0, 10).map((v, idx) => {
                      const pct = (v.count / maxCount) * 100;
                      const pctOfTotal = totalCount > 0 ? ((v.count / totalCount) * 100) : 0;
                      return (
                        <Box key={idx}
                          onClick={() => {
                            addSearchTag(fieldKey, v.value);
                          }}
                          sx={{
                            position: 'relative', px: 1.5, py: 0.4, cursor: 'pointer', borderRadius: '4px',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            overflow: 'hidden',
                            '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.08) },
                          }}
                        >
                          {/* Background percentage bar */}
                          <Box sx={{
                            position: 'absolute', left: 0, top: 0, bottom: 0,
                            width: `${pct}%`,
                            backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.25 : 0.18),
                            zIndex: 0,
                            transition: 'width 0.3s ease',
                          }} />
                          <span style={{ fontSize: '0.78rem', color: theme.palette.primary.main, fontWeight: 600, zIndex: 1, position: 'relative' }}>
                            {v.value || '(empty)'}
                          </span>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, zIndex: 1, position: 'relative' }}>
                            <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', fontWeight: 600 }}>
                              {pctOfTotal.toFixed(0)}%
                            </Typography>
                            <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled' }}>
                              {v.count.toLocaleString()}
                            </Typography>
                          </Box>
                        </Box>
                      );
                    })}
                  </>
                );
              }

              // Get the last token for partial matching
              const tokens = conditions.split(/\s+/);
              const lastToken = tokens[tokens.length - 1].toLowerCase();

              const cols = groupableColumns.slice(0, 15);
              const syntax = ['AND', 'OR'];
              
              const filteredCols = lastToken ? cols.filter(f => f.toLowerCase().includes(lastToken)) : cols;
              const filteredSyntax = lastToken ? syntax.filter(s => s.toLowerCase().includes(lastToken)) : syntax;

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
                              setConditions(newCond);
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
                        setConditions(newCond);
                        searchContainerRef.current?.querySelector('input')?.focus();
                      }}
                      sx={{
                        px: 1.5, py: 0.5, cursor: 'pointer', borderRadius: '4px', fontSize: '0.78rem', '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.08) },
                      }}
                    >
                      <span style={{ color: theme.palette.primary.main }}>has</span>:
                      <span style={{ color: 'text.disabled', fontSize: '0.7rem', marginLeft: 8 }}>{t('argus.discover.hasDesc', 'Find events with this tag')}</span>
                    </Box>
                  )}
                  {filteredCols.map(field => (
                    <Box key={field}
                      onClick={() => {
                        const newCond = tokens.slice(0, -1).join(' ') + (tokens.length > 1 ? ' ' : '') + field + ':';
                        setConditions(newCond);
                        searchContainerRef.current?.querySelector('input')?.focus();
                      }}
                      sx={{
                        px: 1.5, py: 0.5, cursor: 'pointer', borderRadius: '4px', fontSize: '0.78rem', '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.08) },
                      }}
                    >
                      <span style={{ color: theme.palette.primary.main }}>{field}</span>:
                    </Box>
                  ))}
                  {filteredCols.length === 0 && (!lastToken || !'has:'.includes(lastToken)) && (
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

      {/* ── Tag Summary (Facet Map) ── */}
      <DiscoverFacetMap facets={facets} onSelectFacet={handleSelectFacet} loading={loading} />

      {/* ── Volume Chart ── */}
      <VolumeChart data={volume} isDark={isDark} period={currentPeriod} />

      {/* ── Interactive Chart ── */}
      {hasQueried && results.length > 0 && (
        <Paper elevation={0} sx={{
          mb: 2, p: 2, borderRadius: 2,
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5, alignItems: 'center' }}>
            <DisplayModeChip value={displayMode} onChange={(v: string) => setUrlState({ display: v })} isDark={isDark} />
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.5,
              height: 28, px: 1.2, borderRadius: '6px',
              border: '1px solid', borderColor: 'divider',
            }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary' }}>
                {t('argus.discover.yAxis', 'Y-Axis')}:
              </Typography>
              <FormControl size="small" variant="standard" sx={{ minWidth: 80 }}>
                <Select value={yAxis} onChange={(e) => setUrlState({ yAxis: e.target.value })}
                  disableUnderline
                  sx={{ fontSize: '0.7rem', fontWeight: 700, '& .MuiSelect-select': { py: 0 } }}>
                  {Y_AXIS_OPTIONS.map(o => <MenuItem key={o.value} value={o.value} sx={{ fontSize: '0.75rem'}}>{o.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ flex: 1 }} />
            {results.length > 0 && (
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                {results.length} {t('argus.discover.results', 'results')}
              </Typography>
            )}
          </Box>

          <InteractiveTimeSeriesChart
            data={resultsToChartData()}
            type={displayMode === 'bar' || displayMode === 'daily' ? 'bar' : 'line'}
            height={180}
            onZoom={() => {}}
          />
        </Paper>
      )}

      {/* ── Results Table ── */}
      {hasQueried && (
        <Paper elevation={0} sx={{
          borderRadius: 2, overflow: 'hidden',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        }}>
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 0.8,
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            backgroundColor: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.01)',
          }}>
            <Button size="small" startIcon={<ColumnsIcon sx={{ fontSize: 15 }} />}
              onClick={() => setEditorOpen(true)}
              sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 600 }}>
              {t('argus.discover.columns', 'Columns')}
            </Button>
            <Box sx={{ display: 'flex', gap: 0.5, flex: 1, overflow: 'hidden', flexWrap: 'nowrap' }}>
              {fields.slice(0, 6).map((f, i) => (
                <Chip key={i} label={f} size="small" sx={{
                  height: 20, fontSize: '0.62rem', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  border: 'none',
                }} />
              ))}
              {fields.length > 6 && (
                <Chip label={`+${fields.length - 6}`} size="small" sx={{
                  height: 20, fontSize: '0.62rem', backgroundColor: alpha(theme.palette.primary.main, 0.08),
                  color: theme.palette.primary.main, border: 'none',
                }} />
              )}
            </Box>
            <Tooltip title={t('argus.discover.exportCsv', 'Export CSV')}>
              <IconButton size="small" onClick={handleExport} sx={{ color: 'text.disabled' }}>
                <ExportIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>

          {error && (
            <Box sx={{ p: 2, backgroundColor: alpha('#f44336', 0.04) }}>
              <Typography variant="body2" sx={{ color: '#f44336', fontSize: '0.82rem'}}>
                {error}
              </Typography>
            </Box>
          )}

          {resultsTableContent}
        </Paper>
      )}

      {/* Empty initial state */}
      {!hasQueried && (
        <Paper elevation={0} sx={{
          py: 10, textAlign: 'center', borderRadius: 2,
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        }}>
          <DiscoverIcon sx={{ fontSize: 48, color: alpha(theme.palette.primary.main, 0.3), mb: 1.5 }} />
          <Typography variant="h6" fontWeight={600} sx={{ mb: 0.5, fontSize: '1rem' }}>
            {t('argus.discover.title', 'Discover')}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: '0.85rem', maxWidth: 400, mx: 'auto' }}>
            {t('argus.discover.emptyHint', 'Query and explore your error data. Add search conditions above or click Search to get started.')}
          </Typography>
        </Paper>
      )}

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 2.5 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {t('argus.discover.saveQuery', 'Save Query')}
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
          <Button onClick={handleSaveQuery} variant="contained" disabled={!saveName.trim()}
            sx={{ textTransform: 'none', fontWeight: 700 }}>
            {t('common.save', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Saved Queries Panel */}
      <Drawer anchor="right" open={savedPanelOpen} onClose={() => setSavedPanelOpen(false)}
        PaperProps={{ sx: { width: 340, p: 2.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BookmarkIcon sx={{ color: theme.palette.primary.main }} />
            {t('argus.discover.savedQueries', 'Saved Queries')}
          </Typography>
          <IconButton size="small" onClick={() => setSavedPanelOpen(false)}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
        {savedQueries.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            {t('argus.discover.noSavedQueries', 'No saved queries yet')}
          </Typography>
        ) : (
          savedQueries.map((sq) => (
            <Paper key={sq.id} elevation={0} sx={{
              p: 1.5, mb: 1, borderRadius: 1.5, cursor: 'pointer',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              transition: 'all 0.15s',
              '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.04), borderColor: alpha(theme.palette.primary.main, 0.2) },
            }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ flex: 1, minWidth: 0 }} onClick={() => handleLoadSavedQuery(sq)}>
                  <Typography variant="body2" fontWeight={600} noWrap>{sq.name}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>
                    {(() => {
                      const cfg = typeof sq.query_config === 'string' ? JSON.parse(sq.query_config) : sq.query_config;
                      return (cfg.fields || []).join(', ');
                    })()}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => handleDeleteSavedQuery(sq.id)}
                  sx={{ color: 'text.disabled', '&:hover': { color: '#f44336' } }}>
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            </Paper>
          ))
        )}
      </Drawer>

      {/* Column Editor Modal */}
      <ColumnEditorModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        fields={fields}
        availableColumns={availableColumns}
        availableAggregates={availableAggregates}
        onApply={(newFields: string[]) => setUrlState({ fields: newFields })}
      />
    </Box>
  );
};

export default ArgusDiscoverPage;
