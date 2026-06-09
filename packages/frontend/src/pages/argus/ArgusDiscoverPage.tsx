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
  useTheme,
  alpha,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  FormControl,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Explore as DiscoverIcon,
  Save as SaveIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  ViewColumn as ColumnsIcon,
  FileDownload as ExportIcon,
  ArrowDownward as SortDescIcon,
  ArrowUpward as SortAscIcon,
  FilterList as FilterIcon,
  Block as ExcludeIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip as ChartTooltip,
} from 'chart.js';
import PageContentLoader from '@/components/common/PageContentLoader';
import PageHeader from '@/components/common/PageHeader';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import EditablePageTitle from '@/components/common/EditablePageTitle';
import { TableSkeleton } from '@/components/argus/ArgusSkeletons';
import ArgusFilterBar, {
  ArgusFilterState,
  defaultArgusFilterState,
  argusFilterStateToApiParams,
} from '@/components/argus/ArgusFilterBar';
import DiscoverFacetMap from '@/components/argus/DiscoverFacetMap';
import { QueryDSLEditor, DISCOVER_CONFIG } from '@/components/argus/query-dsl';
import argusService, { ArgusSavedQuery } from '@/services/argusService';
import ColumnEditorModal from '@/components/argus/ColumnEditorModal';
import InteractiveTimeSeriesChart from '@/components/argus/InteractiveTimeSeriesChart';
import useArgusUrlState from '@/hooks/useArgusUrlState';
import { useLocation } from 'react-router-dom';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import {
  VolumeChart,
  GroupBySelector,
  DisplayModeChip,
  FALLBACK_COLUMNS,
  Y_AXIS_OPTIONS,
} from './components/discoverHelpers';
import {
  DiscoverSaveDialog,
  DiscoverSavedPanel,
} from './components/DiscoverDialogs';

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip);

const ArgusDiscoverPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const location = useLocation();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

  const fetchFieldValues = useCallback(
    async (fieldKey: string): Promise<string[]> => {
      try {
        const data = await argusService.getAttributeFacet(projectId, fieldKey);
        return data.map((d) => d.attr_value);
      } catch {
        return [];
      }
    },
    [projectId]
  );

  // ─── URL-driven state ───
  const URL_PARAMS = useMemo(
    () => ({
      period: {
        key: 'period',
        default: '14d',
        storageKey: 'argus-discover-period',
      },
      fields: {
        key: 'fields',
        default: 'count(),level,platform',
        type: 'array' as const,
      },
      groupBy: { key: 'groupBy', default: 'level', type: 'array' as const },
      q: { key: 'q', default: '' },
      orderBy: { key: 'orderBy', default: '-count' },
      display: { key: 'display', default: 'total' },
      yAxis: { key: 'yAxis', default: 'count()' },
      queryId: { key: 'queryId', default: '' },
    }),
    []
  );
  const [urlState, setUrlState] = useArgusUrlState(URL_PARAMS);

  const fields = urlState.fields as string[];
  const groupBy = urlState.groupBy as string[];
  const displayMode = urlState.display;
  const yAxis = urlState.yAxis;
  const orderBy = urlState.orderBy;
  const orderDir: 'asc' | 'desc' = orderBy.startsWith('-') ? 'desc' : 'asc';

  const [filters, setFilters] = useState<ArgusFilterState>(() =>
    defaultArgusFilterState(urlState.period)
  );

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      dateRange: { type: 'preset', preset: urlState.period },
    }));
  }, [urlState.period]);

  const [conditions, setConditions] = useState<string>(urlState.q || '');
  const lastSubmittedConditionsRef = useRef<string>(urlState.q || '');

  useEffect(() => {
    const urlVal = urlState.q || '';
    if (urlVal !== lastSubmittedConditionsRef.current) {
      setConditions(urlVal);
      lastSubmittedConditionsRef.current = urlVal;
    }
  }, [urlState.q]);

  // ─── Results ───
  const [results, setResults] = useState<Record<string, any>[]>([]);
  const [volume, setVolume] = useState<
    { bucket: string; level: string; count: number }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasQueried, setHasQueried] = useState(false);

  const [savedQueries, setSavedQueries] = useState<ArgusSavedQuery[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [savedPanelOpen, setSavedPanelOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [currentQueryId, setCurrentQueryId] = useState<number | null>(null);

  const defaultQueryName = t('argus.discover.newQuery', 'New Discover Query');
  const [queryName, setQueryName] = useState(
    (location.state as any)?.queryName || defaultQueryName
  );

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

  // ─── Tag/schema data ───
  const [facets, setFacets] = useState<Record<string, any[]>>({});
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [availableAggregates, setAvailableAggregates] = useState<string[]>([]);

  const groupableColumns = useMemo(
    () =>
      (availableColumns.length > 0
        ? availableColumns
        : FALLBACK_COLUMNS
      ).filter((c) => !c.includes('(')),
    [availableColumns]
  );

  const currentPeriod = useMemo(() => {
    if (filters.dateRange.type === 'preset' && filters.dateRange.preset)
      return filters.dateRange.preset;
    return '24h';
  }, [filters.dateRange]);

  // ─── API calls ───
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
    } catch (err) {
      console.error('Failed to fetch volume', err);
    }
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
      fetchVolume();
    } catch (err: any) {
      setError(err?.message || t('argus.discover.queryFailed', 'Query failed'));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [
    fields,
    groupBy,
    buildConditions,
    orderBy,
    filters,
    currentPeriod,
    projectId,
    t,
    fetchVolume,
    yAxis,
  ]);

  useEffect(() => {
    argusService
      .listSavedQueries(projectId)
      .then(setSavedQueries)
      .catch(() => setSavedQueries([]));
    argusService
      .discoverTags(projectId)
      .then((data) => {
        setFacets(data.tags || {});
        setAvailableColumns(
          data.columns?.length ? data.columns : FALLBACK_COLUMNS
        );
        setAvailableAggregates(
          data.aggregates?.length
            ? data.aggregates
            : ['count', 'uniq', 'avg', 'sum', 'p95']
        );
      })
      .catch(() => {
        setAvailableColumns(FALLBACK_COLUMNS);
        setAvailableAggregates(['count', 'uniq', 'avg', 'sum', 'p95']);
      });
    fetchVolume();
  }, [projectId, fetchVolume]);

  useEffect(() => {
    runQuery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const yAxisRef = useRef(yAxis);
  useEffect(() => {
    if (yAxisRef.current !== yAxis) {
      yAxisRef.current = yAxis;
      if (hasQueried) runQuery();
    }
  }, [yAxis, hasQueried, runQuery]);

  // ─── Handlers ───
  const handleSaveQuery = useCallback(async () => {
    if (!saveName.trim()) return;
    try {
      const res = await argusService.createSavedQuery(projectId, {
        name: saveName.trim(),
        query_config: {
          fields,
          conditions,
          groupBy,
          orderBy,
          period: currentPeriod,
        },
        display_type: displayMode,
      });
      const updated = await argusService.listSavedQueries(projectId);
      setSavedQueries(updated);
      setQueryName(saveName.trim());
      if (res.id) setCurrentQueryId(res.id);
      setSaveDialogOpen(false);
      setSaveName('');
    } catch (err) {
      console.error('Failed to save query:', err);
    }
  }, [
    saveName,
    projectId,
    fields,
    conditions,
    groupBy,
    orderBy,
    currentPeriod,
    displayMode,
  ]);

  const handleRename = useCallback(
    async (newName: string) => {
      setQueryName(newName);
      if (currentQueryId) {
        try {
          await argusService.updateSavedQuery(projectId, currentQueryId, {
            name: newName,
          });
          const updated = await argusService.listSavedQueries(projectId);
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
        console.error('Failed to delete query:', err);
      }
    },
    [projectId, currentQueryId]
  );

  const handleLoadSavedQuery = useCallback(
    (query: ArgusSavedQuery) => {
      const cfg =
        typeof query.query_config === 'string'
          ? JSON.parse(query.query_config)
          : query.query_config;
      setUrlState({
        fields: cfg.fields || ['count()'],
        groupBy: cfg.groupBy || [],
        orderBy: cfg.orderBy || '-count',
      });
      setConditions(cfg.conditions || '');
      setQueryName(query.name);
      setCurrentQueryId(query.id);
      setSavedPanelOpen(false);
    },
    [setUrlState]
  );

  const handleSearchChange = useCallback(
    (query: string) => {
      setConditions(query);
      lastSubmittedConditionsRef.current = query;
      setUrlState({ q: query });
      setTimeout(runQuery, 10);
    },
    [setUrlState, runQuery]
  );

  const handleSelectFacet = useCallback(
    (tag: string, value: string, exclude?: boolean) => {
      const op = exclude ? '!=' : 'is';
      let appendStr: string;
      if (op === '!=') {
        appendStr = `!${tag}:"${value}"`;
      } else {
        appendStr = `${tag}:"${value}"`;
      }
      const finalStr = (conditions.trim() + ' ' + appendStr).trim();
      handleSearchChange(finalStr);
    },
    [conditions, handleSearchChange]
  );

  const handleColumnSort = useCallback(
    (colKey: string) => {
      if (orderBy === colKey || orderBy === `-${colKey}`) {
        const newOrderBy = orderDir === 'desc' ? colKey : `-${colKey}`;
        setUrlState({ orderBy: newOrderBy });
      } else {
        setUrlState({ orderBy: `-${colKey}` });
      }
    },
    [orderBy, orderDir, setUrlState]
  );

  const toggleGroupBy = useCallback(
    (col: string) => {
      const next = groupBy.includes(col)
        ? groupBy.filter((c) => c !== col)
        : [...groupBy, col];
      setUrlState({ groupBy: next });
    },
    [groupBy, setUrlState]
  );

  const handleFilterChange = useCallback(
    (newFilters: ArgusFilterState) => {
      setFilters(newFilters);
      if (
        newFilters.dateRange.type === 'preset' &&
        newFilters.dateRange.preset
      ) {
        setUrlState({ period: newFilters.dateRange.preset });
      }
    },
    [setUrlState]
  );

  const handleExport = useCallback(() => {
    if (results.length === 0) return;
    const blob = new Blob([JSON.stringify(results, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `discover-${new Date().toISOString()}.json`;
    a.click();
  }, [results]);

  const resultsToChartData = useCallback(() => {
    if (results.length === 0) return [];
    let numKey = yAxis;
    if (!numKey || !(numKey in results[0])) {
      const keys = Object.keys(results[0]);
      numKey =
        keys.find(
          (k) =>
            typeof results[0][k] === 'number' || !isNaN(Number(results[0][k]))
        ) || '';
    }
    let labelKey = groupBy.length > 0 ? groupBy[0] : '';
    if (!labelKey || !(labelKey in results[0])) {
      labelKey = Object.keys(results[0]).find((k) => k !== numKey) || '';
    }
    if (!numKey || !labelKey) return [];
    return results
      .slice(0, 50)
      .map((r) => ({ label: String(r[labelKey]), count: Number(r[numKey]) }));
  }, [results, yAxis, groupBy]);

  const currentOrderCol = orderBy.replace(/^-/, '');

  /* ═══ RENDER ═══ */
  return (
    <Box>
      <PageHeader
        icon={<DiscoverIcon />}
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
          'argus.discover.subtitle',
          'Query and explore your error data'
        )}
        actions={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Tooltip title={t('argus.discover.savedQueries', 'Saved Queries')}>
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
              disabled={fields.length === 0}
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

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <QueryDSLEditor
          config={DISCOVER_CONFIG}
          initialQuery={conditions}
          onSearch={handleSearchChange}
          onChange={handleSearchChange}
          fetchFieldValues={fetchFieldValues}
          placeholder={t(
            'argus.discover.searchPlaceholder',
            'Search by event, user, or tag...'
          )}
        />
        <Button
          variant="contained"
          size="small"
          onClick={runQuery}
          disabled={loading || fields.length === 0}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            px: 2.5,
            height: 36,
            borderRadius: '6px',
            fontSize: '0.78rem',
          }}
        >
          {loading ? (
            <CircularProgress size={16} color="inherit" />
          ) : (
            t('argus.discover.run', 'Search')
          )}
        </Button>
      </Box>

      {/* Tag Summary (Facet Map) */}
      <DiscoverFacetMap
        facets={facets}
        onSelectFacet={handleSelectFacet}
        loading={loading}
      />

      {/* Volume Chart */}
      <VolumeChart data={volume} isDark={isDark} period={currentPeriod} />

      {/* Interactive Chart */}
      {hasQueried && results.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            mb: 2,
            p: 2,
            borderRadius: 2,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}
        >
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5, alignItems: 'center' }}>
            <DisplayModeChip
              value={displayMode}
              onChange={(v: string) => setUrlState({ display: v })}
              isDark={isDark}
            />
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                height: 28,
                px: 1.2,
                borderRadius: '6px',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: 'text.secondary',
                }}
              >
                {t('argus.discover.yAxis', 'Y-Axis')}:
              </Typography>
              <FormControl
                size="small"
                variant="standard"
                sx={{ minWidth: 80 }}
              >
                <Select
                  value={yAxis}
                  onChange={(e) => setUrlState({ yAxis: e.target.value })}
                  disableUnderline
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    '& .MuiSelect-select': { py: 0 },
                  }}
                >
                  {Y_AXIS_OPTIONS.map((o) => (
                    <MenuItem
                      key={o.value}
                      value={o.value}
                      sx={{ fontSize: '0.75rem' }}
                    >
                      {o.label}
                    </MenuItem>
                  ))}
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
            type={
              displayMode === 'bar' || displayMode === 'daily' ? 'bar' : 'line'
            }
            height={180}
            onZoom={() => {}}
          />
        </Paper>
      )}

      {/* Results Table */}
      {hasQueried && (
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
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 0.8,
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.015)'
                : 'rgba(0,0,0,0.01)',
            }}
          >
            <Button
              size="small"
              startIcon={<ColumnsIcon sx={{ fontSize: 15 }} />}
              onClick={() => setEditorOpen(true)}
              sx={{
                textTransform: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              {t('argus.discover.columns', 'Columns')}
            </Button>
            <Box
              sx={{
                display: 'flex',
                gap: 0.5,
                flex: 1,
                overflow: 'hidden',
                flexWrap: 'nowrap',
              }}
            >
              {fields.slice(0, 6).map((f, i) => (
                <Chip
                  key={i}
                  label={f}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.62rem',
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(0,0,0,0.03)',
                    border: 'none',
                  }}
                />
              ))}
              {fields.length > 6 && (
                <Chip
                  label={`+${fields.length - 6}`}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.62rem',
                    backgroundColor: alpha(theme.palette.primary.main, 0.08),
                    color: theme.palette.primary.main,
                    border: 'none',
                  }}
                />
              )}
            </Box>
            <Tooltip title={t('argus.discover.exportCsv', 'Export CSV')}>
              <IconButton
                size="small"
                onClick={handleExport}
                sx={{ color: 'text.disabled' }}
              >
                <ExportIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>

          {error && (
            <Box sx={{ p: 2, backgroundColor: alpha('#f44336', 0.04) }}>
              <Typography
                variant="body2"
                sx={{ color: '#f44336', fontSize: '0.82rem' }}
              >
                {error}
              </Typography>
            </Box>
          )}

          <PageContentLoader
            loading={loading}
            skeleton={<TableSkeleton rows={8} cols={fields.length || 4} />}
          >
            {results.length > 0 ? (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {Object.keys(results[0]).map((key) => (
                        <TableCell
                          key={key}
                          onClick={() => handleColumnSort(key)}
                          sx={{
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                            backgroundColor: isDark
                              ? 'rgba(255,255,255,0.02)'
                              : 'rgba(0,0,0,0.01)',
                            borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                            whiteSpace: 'nowrap',
                            userSelect: 'none',
                            '&:hover': { color: theme.palette.primary.main },
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                            }}
                          >
                            {key}
                            {currentOrderCol === key &&
                              (orderDir === 'desc' ? (
                                <SortDescIcon
                                  sx={{
                                    fontSize: 14,
                                    color: theme.palette.primary.main,
                                  }}
                                />
                              ) : (
                                <SortAscIcon
                                  sx={{
                                    fontSize: 14,
                                    color: theme.palette.primary.main,
                                  }}
                                />
                              ))}
                          </Box>
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {results.map((row, idx) => (
                      <TableRow
                        key={idx}
                        hover
                        sx={{
                          '&:hover': {
                            backgroundColor: isDark
                              ? 'rgba(255,255,255,0.015)'
                              : 'rgba(0,0,0,0.008)',
                          },
                        }}
                      >
                        {Object.entries(row).map(([colKey, val], cidx) => (
                          <TableCell
                            key={cidx}
                            sx={{
                              fontSize: '0.78rem',
                              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                              position: 'relative',
                              whiteSpace: 'nowrap',
                              '&:hover .cell-actions': { opacity: 1 },
                            }}
                          >
                            <Box
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.5,
                              }}
                            >
                              <span>
                                {typeof val === 'number'
                                  ? val.toLocaleString()
                                  : String(val)}
                              </span>
                              <Box
                                className="cell-actions"
                                sx={{
                                  opacity: 0,
                                  transition: 'opacity 0.15s',
                                  display: 'inline-flex',
                                  gap: 0.25,
                                  ml: 0.5,
                                }}
                              >
                                <Tooltip
                                  title={t(
                                    'argus.discover.facet.addToFilter',
                                    'Add to filter'
                                  )}
                                >
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      handleSelectFacet(
                                        colKey,
                                        String(val),
                                        false
                                      )
                                    }
                                    sx={{
                                      p: 0.25,
                                      color: theme.palette.primary.main,
                                    }}
                                  >
                                    <FilterIcon sx={{ fontSize: 13 }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip
                                  title={t(
                                    'argus.discover.facet.exclude',
                                    'Exclude'
                                  )}
                                >
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      handleSelectFacet(
                                        colKey,
                                        String(val),
                                        true
                                      )
                                    }
                                    sx={{
                                      p: 0.25,
                                      color: theme.palette.error.main,
                                    }}
                                  >
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
                <DiscoverIcon
                  sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }}
                />
                <Typography color="text.secondary" sx={{ fontSize: '0.88rem' }}>
                  {t(
                    'argus.discover.empty',
                    'Build a query and press Search to explore your data'
                  )}
                </Typography>
              </Box>
            ) : null}
          </PageContentLoader>
        </Paper>
      )}

      {/* Empty initial state */}
      {!hasQueried && (
        <Paper
          elevation={0}
          sx={{
            py: 10,
            textAlign: 'center',
            borderRadius: 2,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}
        >
          <DiscoverIcon
            sx={{
              fontSize: 48,
              color: alpha(theme.palette.primary.main, 0.3),
              mb: 1.5,
            }}
          />
          <Typography
            variant="h6"
            fontWeight={600}
            sx={{ mb: 0.5, fontSize: '1rem' }}
          >
            {t('argus.discover.title', 'Discover')}
          </Typography>
          <Typography
            color="text.secondary"
            sx={{ fontSize: '0.85rem', maxWidth: 400, mx: 'auto' }}
          >
            {t(
              'argus.discover.emptyHint',
              'Query and explore your error data. Add search conditions above or click Search to get started.'
            )}
          </Typography>
        </Paper>
      )}

      {/* Save Dialog */}
      <DiscoverSaveDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        saveName={saveName}
        onNameChange={setSaveName}
        onSave={handleSaveQuery}
      />

      {/* Saved Queries Panel */}
      <DiscoverSavedPanel
        open={savedPanelOpen}
        onClose={() => setSavedPanelOpen(false)}
        savedQueries={savedQueries}
        onLoad={handleLoadSavedQuery}
        onDelete={handleDeleteSavedQuery}
      />

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
