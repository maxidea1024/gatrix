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
  Tooltip,
  Popover,
  Button,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  Timeline as TraceIcon,
  FilterList as FilterIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import ArgusFilterBar, {
  ArgusFilterState,
  defaultArgusFilterState,
  argusFilterStateToApiParams,
} from '@/components/argus/ArgusFilterBar';
import ArgusQueryBuilder from '@/components/argus/ArgusQueryBuilder';
import SegmentedTabs from '@/components/common/SegmentedTabs';
import PageHeader from '@/components/common/PageHeader';
import EditablePageTitle from '@/components/common/EditablePageTitle';
import ExploreActions from '@/components/argus/ExploreActions';
import argusService, { ArgusSavedQuery } from '@/services/argusService';
import useArgusUrlState from '@/hooks/useArgusUrlState';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { SpanVolumeChart, getOpColor } from './components/traceExplorerHelpers';
import {
  SpansTab,
  TracesTab,
  AggregatesTab,
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
  const aggGroupBy = urlState.groupBy;
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

  // Aggregates
  const [aggData, setAggData] = useState<{
    groupBy: string;
    topValues: {
      group_value: string;
      count: number;
      avg_duration?: number;
      p95_duration?: number;
    }[];
    timeSeries: { bucket: string; group_value: string; count: number }[];
  } | null>(null);
  const [aggLoading, setAggLoading] = useState(false);

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
  const [builderAnchorEl, setBuilderAnchorEl] = useState<HTMLElement | null>(
    null
  );

  const currentPeriod = useMemo(() => {
    if (filters.dateRange.type === 'preset' && filters.dateRange.preset)
      return filters.dateRange.preset;
    return '24h';
  }, [filters.dateRange]);

  // ─── Fetch ───
  const fetchSpans = useCallback(async () => {
    setLoading(true);
    try {
      const apiParams = argusFilterStateToApiParams(filters);
      const data = await argusService.searchSpans(projectId, {
        period: apiParams.period || currentPeriod,
        search: search.trim() || undefined,
        orderBy,
        limit: 50,
        start: apiParams.start,
        end: apiParams.end,
      });
      setSpans(data);
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
      const data = await argusService.getTraceSamples(projectId, {
        period: apiParams.period || currentPeriod,
        search: search.trim() || undefined,
        limit: 25,
        start: apiParams.start,
        end: apiParams.end,
      });
      setTraceSamples(data);
    } catch (err) {
      console.error('Failed to get trace samples', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, filters, currentPeriod, search]);

  const fetchVolume = useCallback(async () => {
    try {
      const apiParams = argusFilterStateToApiParams(filters);
      const data = await argusService.getSpanVolume(projectId, {
        period: apiParams.period || currentPeriod,
        search: search.trim() || undefined,
        start: apiParams.start,
        end: apiParams.end,
      });
      setVolume(data);
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

  const fetchAggregates = useCallback(
    async (groupByVal?: string) => {
      setAggLoading(true);
      try {
        const apiParams = argusFilterStateToApiParams(filters);
        const data = await argusService.getSpanAggregates(projectId, {
          period: apiParams.period || currentPeriod,
          groupBy: groupByVal || aggGroupBy,
          start: apiParams.start,
          end: apiParams.end,
        });
        setAggData(data);
      } catch (err) {
        console.error('Failed to fetch span aggregates', err);
      } finally {
        setAggLoading(false);
      }
    },
    [projectId, filters, currentPeriod, aggGroupBy]
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
        setTimeout(fetchAll, 10);
      }
    },
    [search, setUrlState, fetchAll]
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

  const handleGroupByChange = useCallback(
    (val: string) => {
      setUrlState({ groupBy: val });
      fetchAggregates(val);
    },
    [setUrlState, fetchAggregates]
  );

  const handleRunAgg = useCallback(() => {
    fetchAggregates();
  }, [fetchAggregates]);

  const handleSaveQuery = useCallback(async () => {
    if (!saveName.trim()) return;
    try {
      const res = await argusService.createSavedQuery(projectId, {
        name: saveName.trim(),
        query_config: {
          search,
          period: currentPeriod,
          tab: activeTab,
          groupBy: aggGroupBy,
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
  }, [saveName, projectId, search, currentPeriod, activeTab, aggGroupBy]);

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
            <Tooltip title={t('argus.traces.savedQueries', 'Saved Queries')}>
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              ref={searchContainerRef}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                flex: 1,
                px: 1,
                py: 0.2,
                borderRadius: '6px',
                minWidth: 400,
                minHeight: 30,
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
                  sx={{ p: 0.2, mr: 0.5 }}
                >
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
                  borderRadius: '6px',
                  height: 30,
                  width: 30,
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.05)'
                    : 'rgba(0,0,0,0.02)',
                }}
              >
                <FilterIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>

            <ArgusQueryBuilder
              fields={['op', 'status', 'domain', 'action']}
              query={search}
              onApply={(q) => {
                setSearch(q);
                setUrlState({ q });
              }}
              anchorEl={builderAnchorEl}
              onClose={() => setBuilderAnchorEl(null)}
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

      {/* Volume Chart */}
      <SpanVolumeChart data={volume} isDark={isDark} onZoom={handleZoom} />

      {/* Tabs */}
      <Box sx={{ mb: 2 }}>
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
      {activeTab === 0 && (
        <SpansTab
          spans={spans}
          loading={loading}
          orderCol={orderCol}
          orderDir={orderDir}
          onColumnSort={handleColumnSort}
        />
      )}

      {activeTab === 1 && (
        <TracesTab traceSamples={traceSamples} loading={loading} />
      )}

      {activeTab === 2 && (
        <AggregatesTab
          aggData={aggData}
          aggLoading={aggLoading}
          aggGroupBy={aggGroupBy}
          onGroupByChange={handleGroupByChange}
          onRunAgg={handleRunAgg}
        />
      )}

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
