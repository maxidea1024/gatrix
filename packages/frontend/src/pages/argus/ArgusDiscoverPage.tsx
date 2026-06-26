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
  IconButton,
  Tooltip,
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
  NotificationsActive as AlertIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PageContentLoader from '@/components/common/PageContentLoader';
import PageHeader from '@/components/common/PageHeader';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import EditablePageTitle from '@/components/common/EditablePageTitle';
import { dateRangeToApiParams as argusDateRangeToApiParams } from '@/components/common/DateRangeSelector';

import ArgusFilterBar, {
  ArgusFilterState,
  defaultArgusFilterState,
  argusFilterStateToApiParams,
} from '@/components/argus/ArgusFilterBar';
import DiscoverFacetMap from '@/components/argus/DiscoverFacetMap';
import {
  QueryAQLEditor,
  DISCOVER_CONFIG,
  type QueryAQLEditorHandle,
} from '@/components/argus/query-aql';
import argusService, { ArgusSavedQuery } from '@/services/argusService';

import useArgusUrlState from '@/hooks/useArgusUrlState';
import { useLocation, useNavigate } from 'react-router-dom';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import ColumnEditorModal from '@/components/argus/ColumnEditorModal';
import {
  VolumeChart,
  GroupBySelector,
  DatasetSwitcher,
  PrebuiltQueryCards,
  PaginationControls,
  FALLBACK_COLUMNS,
  DATASET_FALLBACK_COLUMNS,
  type PrebuiltQuery,
  type DiscoverDataset,
} from './components/discoverHelpers';
import { DiscoverSavedPanel } from './components/DiscoverDialogs';
import SaveQueryDialog from '@/components/argus/SaveQueryDialog';
import DeleteQueryConfirmDialog from '@/components/argus/DeleteQueryConfirmDialog';
import { ARGUS_SEMANTIC } from './argusThemeTokens';

const ArgusDiscoverPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

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
      dataset: { key: 'dataset', default: 'errors' },
    }),
    []
  );
  const [urlState, setUrlState] = useArgusUrlState(URL_PARAMS);

  const fields = urlState.fields as string[];
  const groupBy = urlState.groupBy as string[];
  const displayMode = urlState.display;
  const yAxis = urlState.yAxis;
  const orderBy = urlState.orderBy;
  const dataset = urlState.dataset as DiscoverDataset;
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

  const fetchFieldValues = useCallback(
    async (fieldKey: string): Promise<string[]> => {
      try {
        const dateParams = argusDateRangeToApiParams(filters.dateRange);
        const data = await argusService.getAttributeFacet(
          projectId,
          fieldKey,
          dateParams
        );
        return data.map((d) => d.attr_value);
      } catch {
        return [];
      }
    },
    [projectId, filters.dateRange]
  );

  const [conditions, setConditions] = useState<string>(urlState.q || '');
  const lastSubmittedConditionsRef = useRef<string>(urlState.q || '');
  const dslEditorRef = useRef<QueryAQLEditorHandle>(null);

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
  const [hasQueried, setHasQueried] = useState(true);
  const [queryOffset, setQueryOffset] = useState(0);
  const QUERY_LIMIT = 50;

  const [savedQueries, setSavedQueries] = useState<ArgusSavedQuery[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveDialogMode, setSaveDialogMode] = useState<'new' | 'saveAs'>('new');
  const [saveName, setSaveName] = useState('');
  const [savedPanelOpen, setSavedPanelOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [currentQueryId, setCurrentQueryId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ArgusSavedQuery | null>(
    null
  );

  const defaultQueryName = t('argus.discover.newQuery', 'New Discover Query');
  const [queryName, setQueryName] = useState(
    (location.state as any)?.queryName || defaultQueryName
  );

  // Sync URL queryId to state — delegate to handleLoadSavedQuery
  useEffect(() => {
    if (urlState.queryId && savedQueries.length > 0) {
      const qId = parseInt(urlState.queryId, 10);
      if (currentQueryId !== qId) {
        const matched = savedQueries.find((q) => q.id === qId);
        if (matched) {
          handleLoadSavedQuery(matched);
        }
      }
    } else if (!urlState.queryId && currentQueryId !== null) {
      setCurrentQueryId(null);
      setQueryName(defaultQueryName);
      setSavedSnapshot(null);
    }
  }, [urlState.queryId, savedQueries, currentQueryId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Dirty state tracking ───
  type DiscoverSnapshot = {
    fields: string[];
    conditions: string;
    groupBy: string[];
    orderBy: string;
    displayMode: string;
    yAxis: string;
    dataset: string;
  };
  const [savedSnapshot, setSavedSnapshot] = useState<DiscoverSnapshot | null>(
    null
  );

  const takeSnapshot = useCallback(() => {
    setSavedSnapshot({
      fields: [...(fields as string[])],
      conditions,
      groupBy: [...(groupBy as string[])],
      orderBy,
      displayMode,
      yAxis,
      dataset,
    });
  }, [fields, conditions, groupBy, orderBy, displayMode, yAxis, dataset]);

  const isDirty = useMemo(() => {
    if (!savedSnapshot) {
      return !urlState.queryId;
    }
    return (
      JSON.stringify(fields) !== JSON.stringify(savedSnapshot.fields) ||
      conditions !== savedSnapshot.conditions ||
      JSON.stringify(groupBy) !== JSON.stringify(savedSnapshot.groupBy) ||
      orderBy !== savedSnapshot.orderBy ||
      displayMode !== savedSnapshot.displayMode ||
      yAxis !== savedSnapshot.yAxis ||
      dataset !== savedSnapshot.dataset
    );
  }, [
    fields,
    conditions,
    groupBy,
    orderBy,
    displayMode,
    yAxis,
    dataset,
    hasQueried,
    savedSnapshot,
  ]);

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

  const handleChartZoom = useCallback((start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;
    setFilters((prev) => ({
      ...prev,
      dateRange: { type: 'custom', start: startDate, end: endDate },
    }));
  }, []);

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
        dataset,
      });
      setVolume(data);
    } catch (err) {
      console.error('Failed to fetch volume', err);
    }
  }, [projectId, filters, currentPeriod, buildConditions, dataset]);

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
        limit: QUERY_LIMIT,
        offset: queryOffset,
        period: apiParams.period || currentPeriod,
        start: apiParams.start,
        end: apiParams.end,
        dataset,
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
      .discoverTags(projectId, dataset)
      .then((data) => {
        setFacets(data.tags || {});
        setAvailableColumns(
          data.columns?.length
            ? data.columns
            : DATASET_FALLBACK_COLUMNS[dataset] || FALLBACK_COLUMNS
        );
        setAvailableAggregates(
          data.aggregates?.length
            ? data.aggregates
            : ['count', 'uniq', 'avg', 'sum', 'p95']
        );
      })
      .catch(() => {
        setAvailableColumns(
          DATASET_FALLBACK_COLUMNS[dataset] || FALLBACK_COLUMNS
        );
        setAvailableAggregates(['count', 'uniq', 'avg', 'sum', 'p95']);
      });
    fetchVolume();
  }, [projectId, fetchVolume, dataset]);

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
  const buildQueryConfig = useCallback(
    () => ({
      fields,
      conditions,
      groupBy,
      orderBy,
      period: currentPeriod,
    }),
    [fields, conditions, groupBy, orderBy, currentPeriod]
  );

  // Save: update existing or prompt name for new
  const handleSave = useCallback(async () => {
    if (currentQueryId) {
      // Update existing query in-place
      setSaving(true);
      try {
        await argusService.updateSavedQuery(projectId, currentQueryId, {
          name: queryName,
          query_config: buildQueryConfig(),
          display_type: displayMode,
        });
        const updated = await argusService.listSavedQueries(projectId);
        setSavedQueries(updated);
        takeSnapshot();
      } catch (err) {
        console.error('Failed to update query:', err);
      } finally {
        setSaving(false);
      }
    } else if (queryName !== defaultQueryName && queryName.trim()) {
      // New state with user-given name: check for duplicates
      const duplicate = savedQueries.find(
        (q) => q.name.toLowerCase() === queryName.trim().toLowerCase()
      );
      if (duplicate) {
        // Name conflict: open dialog so user sees the warning
        setSaveName(queryName.trim());
        setSaveDialogMode('new');
        setSaveDialogOpen(true);
      } else {
        // No conflict: save directly
        setSaving(true);
        try {
          const res = await argusService.createSavedQuery(projectId, {
            name: queryName.trim(),
            query_config: buildQueryConfig(),
            display_type: displayMode,
          });
          if (res.id) {
            setCurrentQueryId(res.id);
            setUrlState({ queryId: String(res.id) });
          }
          const updated = await argusService.listSavedQueries(projectId);
          setSavedQueries(updated);
          takeSnapshot();
        } catch (err) {
          console.error('Failed to create query:', err);
        } finally {
          setSaving(false);
        }
      }
    } else {
      // New state with default name: open name dialog
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
    displayMode,
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
      setSaving(true);
      try {
        if (existingQueryId) {
          // Overwrite existing query with same name
          await argusService.updateSavedQuery(projectId, existingQueryId, {
            name,
            query_config: buildQueryConfig(),
            display_type: displayMode,
          });
          setCurrentQueryId(existingQueryId);
          setQueryName(name);
          setUrlState({ queryId: String(existingQueryId) });
        } else {
          // Create new
          const res = await argusService.createSavedQuery(projectId, {
            name,
            query_config: buildQueryConfig(),
            display_type: displayMode,
          });
          if (res.id) {
            setCurrentQueryId(res.id);
            setQueryName(name);
            setUrlState({ queryId: String(res.id) });
          }
        }
        const updated = await argusService.listSavedQueries(projectId);
        setSavedQueries(updated);

        takeSnapshot();
        setSaveDialogOpen(false);
        setSaveName('');
      } catch (err) {
        console.error('Failed to save query:', err);
      } finally {
        setSaving(false);
      }
    },
    [projectId, buildQueryConfig, displayMode, setUrlState, takeSnapshot]
  );

  const handleRename = useCallback(
    async (newName: string) => {
      setQueryName(newName);
      const effectiveId =
        currentQueryId ||
        (urlState.queryId ? parseInt(urlState.queryId, 10) : null);
      if (effectiveId) {
        setSaving(true);
        try {
          await argusService.updateSavedQuery(projectId, effectiveId, {
            name: newName,
          });
          const updated = await argusService.listSavedQueries(projectId);
          setSavedQueries(updated);
        } catch (err) {
          console.error('Failed to rename query:', err);
        } finally {
          setSaving(false);
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
      console.error('Failed to delete query:', err);
    }
    setDeleteTarget(null);
  }, [deleteTarget, projectId, currentQueryId]);

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
        queryId: String(query.id),
      });
      setConditions(cfg.conditions || '');
      setQueryName(query.name);
      setCurrentQueryId(query.id);
      setSavedPanelOpen(false);
      // Set snapshot after load so isDirty starts as false
      setSavedSnapshot({
        fields: cfg.fields || ['count()'],
        conditions: cfg.conditions || '',
        groupBy: cfg.groupBy || [],
        orderBy: cfg.orderBy || '-count',
        displayMode: cfg.display_type || 'total',
        yAxis: cfg.yAxis || 'count()',
        dataset: cfg.dataset || 'errors',
      });
    },
    [setUrlState]
  );

  const handleSearchChange = useCallback(
    (query: string) => {
      setConditions(query);
      setUrlState({ q: query });
    },
    [setUrlState]
  );

  const handleSearchSubmit = useCallback(
    (query: string) => {
      setConditions(query);
      setUrlState({ q: query });
      runQuery();
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
      handleSearchSubmit(finalStr);
    },
    [conditions, handleSearchSubmit]
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
    const headers = Object.keys(results[0]);
    const csvRows = [
      headers.join(','),
      ...results.map((row) =>
        headers
          .map((h) => {
            const val = row[h];
            const str = val == null ? '' : String(val);
            return str.includes(',') || str.includes('"') || str.includes('\n')
              ? `"${str.replace(/"/g, '""')}"`
              : str;
          })
          .join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `discover-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }, [results]);

  const handleSelectPrebuilt = useCallback(
    (q: PrebuiltQuery) => {
      setUrlState({
        fields: q.fields,
        groupBy: q.groupBy,
        orderBy: q.orderBy,
        yAxis: q.yAxis,
      });
      setQueryName(q.defaultName);
      setQueryOffset(0);
      // Trigger query on next tick after state update
      setTimeout(() => runQuery(), 0);
    },
    [setUrlState, runQuery]
  );

  const handlePagePrev = useCallback(() => {
    setQueryOffset((prev) => Math.max(0, prev - QUERY_LIMIT));
  }, []);

  const handlePageNext = useCallback(() => {
    setQueryOffset((prev) => prev + QUERY_LIMIT);
  }, []);

  // Re-run query when offset changes (pagination)
  useEffect(() => {
    if (hasQueried && queryOffset > 0) {
      runQuery();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryOffset]);

  const handleRowClick = useCallback(
    (row: Record<string, any>) => {
      // Drill-down: navigate to issue detail if issue_id is available
      if (row.issue_id) {
        navigate(`/argus/issues/${projectId}/${row.issue_id}`);
      }
    },
    [navigate, projectId]
  );

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
        titleUpdateTrigger={queryName}
        actionsUpdateTrigger={`${isDirty}-${saving}-${currentQueryId}`}
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
              {t('argus.discover.save', 'Save')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<SaveIcon sx={{ fontSize: 15 }} />}
              onClick={handleSaveAs}
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
            <Button
              size="small"
              variant="outlined"
              startIcon={<AlertIcon sx={{ fontSize: 15 }} />}
              onClick={() => {
                navigate('/argus/alerts', {
                  state: {
                    fromDiscover: true,
                    query: {
                      conditions: buildConditions(),
                      fields,
                      groupBy,
                      dataset,
                      yAxis,
                    },
                  },
                });
              }}
              disabled={!hasQueried}
              sx={{
                textTransform: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderColor: isDark
                  ? 'rgba(255,255,255,0.12)'
                  : 'rgba(0,0,0,0.12)',
                borderRadius: '6px',
                color: theme.palette.warning.main,
              }}
            >
              {t('argus.discover.createAlert', 'Create Alert')}
            </Button>
          </Box>
        }
      />

      {/* Dataset Switcher */}
      <Box sx={{ mb: 1.5 }}>
        <DatasetSwitcher
          value={dataset}
          onChange={(ds) => {
            const fallback = DATASET_FALLBACK_COLUMNS[ds] || FALLBACK_COLUMNS;
            setUrlState({
              dataset: ds,
              fields: fallback.slice(0, 4),
              groupBy: [],
              orderBy: '-count',
              yAxis: 'count()',
            });
            setQueryOffset(0);
            setHasQueried(false);
            setResults([]);
          }}
        />
      </Box>

      <ArgusFilterBar
        projectId={projectId}
        value={filters}
        onChange={(newFilters) => {
          const prevEnvs = filters.environments;
          const newEnvs = newFilters.environments;
          if (
            prevEnvs.length !== newEnvs.length ||
            prevEnvs.some((e, i) => e !== newEnvs[i])
          ) {
            dslEditorRef.current?.upsertFieldChip('environment', newEnvs);
          }
          handleFilterChange(newFilters);
        }}
        onRefresh={hasQueried ? runQuery : undefined}
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
            <GroupBySelector
              groupBy={groupBy}
              columns={groupableColumns}
              onToggle={toggleGroupBy}
              isDark={isDark}
            />
            <QueryAQLEditor
              ref={dslEditorRef}
              config={DISCOVER_CONFIG}
              initialQuery={conditions}
              onSearch={handleSearchSubmit}
              onChange={handleSearchChange}
              fetchFieldValues={fetchFieldValues}
              initialFacets={facets}
              placeholder={t(
                'argus.discover.searchPlaceholder',
                'Search by event, user, or tag...'
              )}
            />
          </Box>
        }
      />

      {/* Tag Summary (Facet Map) */}
      <DiscoverFacetMap
        facets={facets}
        onSelectFacet={handleSelectFacet}
        loading={loading}
      />

      {/* Volume Chart */}
      <VolumeChart
        data={volume}
        isDark={isDark}
        period={currentPeriod}
        loading={loading}
        onZoom={handleChartZoom}
      />

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
            <Box
              sx={{
                p: 2,
                backgroundColor: alpha(ARGUS_SEMANTIC.negative, 0.04),
              }}
            >
              <Typography
                variant="body2"
                sx={{ color: ARGUS_SEMANTIC.negative, fontSize: '0.82rem' }}
              >
                {error}
              </Typography>
            </Box>
          )}

          <>
            {results.length > 0 ? (
              <>
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
                          onClick={() => handleRowClick(row)}
                          sx={{
                            cursor: row.issue_id ? 'pointer' : 'default',
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
                                <span
                                  style={{
                                    ...((colKey === 'event_id' &&
                                      row.issue_id) ||
                                    colKey === 'issue_id'
                                      ? {
                                          color: theme.palette.primary.main,
                                          cursor: 'pointer',
                                          textDecoration: 'underline',
                                          textDecorationStyle:
                                            'dotted' as const,
                                        }
                                      : {}),
                                  }}
                                >
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
                {/* Pagination */}
                <PaginationControls
                  offset={queryOffset}
                  limit={QUERY_LIMIT}
                  resultCount={results.length}
                  onPrev={handlePagePrev}
                  onNext={handlePageNext}
                  isDark={isDark}
                />
              </>
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
          </>
        </Paper>
      )}

      {/* Empty initial state — Pre-built Query Cards */}
      {!hasQueried && (
        <PrebuiltQueryCards onSelect={handleSelectPrebuilt} isDark={isDark} />
      )}

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
