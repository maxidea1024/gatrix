import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, useTheme, IconButton, Button } from '@mui/material';
import {
  Terminal as LogIcon,
  Save as SaveIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';
import SafeTooltip from '@/components/common/SafeTooltip';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import ArgusFilterBar from '@/components/argus/ArgusFilterBar';
import {
  QueryAQLEditor,
  LOGS_CONFIG,
  type QueryAQLEditorHandle,
} from '@/components/argus/query-aql';
import PageHeader from '@/components/common/PageHeader';
import EditablePageTitle from '@/components/common/EditablePageTitle';
import { useResizableSplit } from '@/hooks/useResizableSplit';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { ArgusLogEntry } from '@/services/argusService';

// Page-specific components
import ArgusVolumeChart from '@/components/argus/ArgusVolumeChart';
import LogsToolbar from './components/LogsToolbar';
import LogsTablePanel from './components/LogsTablePanel';
import LogsAggregatePanel from './components/LogsAggregatePanel';
import LogsPatternsPanel from './components/LogsPatternsPanel';
import PatternDetailPanel from './components/PatternDetailPanel';
import type { PatternEntry } from './components/LogsPatternsPanel';
import LogsLiveTailPanel from './components/LogsLiveTailPanel';
import {
  EditTableDialog,
  SaveQueryDialog as LogsSaveQueryDialog,
  SavedQueriesDrawer,
} from './components/LogsDialogs';
import SaveQueryDialog from '@/components/argus/SaveQueryDialog';
import DeleteQueryConfirmDialog from '@/components/argus/DeleteQueryConfirmDialog';
import FacetSidebar from '@/components/argus/FacetSidebar';
import LogSidePanel from './components/LogSidePanel';

// Custom Hooks
import { useArgusLogs } from './hooks/useArgusLogs';

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip, Legend);

const ArgusLogsPage: React.FC = () => {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();

  const {
    projectId,
    activeTab,
    aggGroupBy,
    aggGroupBys,
    filters,
    search,
    logs,
    loading,
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
    handleSave,
    handleDialogSave,
    handleRename,
    handleDeleteSavedQuery,
    handleLoadSavedQuery,
    confirmDelete,
    isDirty,
    saving,
    deleteTarget,
    setDeleteTarget,
    setQueryName: _setQueryName,
    setCurrentQueryId: _setCurrentQueryId,

    // Patterns
    patterns,
    patternsLoading,
  } = useArgusLogs();

  // Local UI states
  const [columnsLocal, setColumnsLocal] = useState<string[]>(columns);
  const [columnNamesLocal, setColumnNamesLocal] =
    useState<Record<string, string>>(columnNames);

  // Sync local columns with hook when columns change (e.g. from saved query)
  React.useEffect(() => {
    setColumnsLocal(columns);
  }, [columns]);
  React.useEffect(() => {
    setColumnNamesLocal(columnNames);
  }, [columnNames]);

  const [editTableOpen, setEditTableOpen] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState<PatternEntry | null>(
    null
  );
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveDialogMode, setSaveDialogMode] = useState<'new' | 'saveAs'>('new');
  const [saveName, setSaveName] = useState('');
  const [savedPanelOpen, setSavedPanelOpen] = useState(false);
  const [wrapLines, setWrapLines] = useLocalStorage<boolean>(
    'argus_logs_wrap_lines',
    false
  );
  const [logsFullscreen, setLogsFullscreen] = useState(false);
  const [showGotoTime, setShowGotoTime] = useState(false);
  const [gotoTime, setGotoTime] = useState('');
  const [displayDensity, setDisplayDensity] = useLocalStorage<
    'compact' | 'default' | 'expanded'
  >('argus_logs_display_density', 'default');

  // Live tail selected log (separate from normal log selection)
  const [liveTailSelectedLog, setLiveTailSelectedLog] =
    useState<ArgusLogEntry | null>(null);

  const handleLiveTailSelectLog = useCallback((log: ArgusLogEntry) => {
    setLiveTailSelectedLog(log);
  }, []);

  // Effective selected log for the side panel based on active tab
  const effectiveSelectedLog =
    activeTab === 3 ? liveTailSelectedLog : selectedLog;
  const effectiveIsRightPanelOpen =
    activeTab === 3 ? liveTailSelectedLog !== null : isRightPanelOpen;

  const logContainerRef = useRef<HTMLDivElement>(null);
  const dslEditorRef = useRef<QueryAQLEditorHandle>(null);
  const [facetSidebarCollapsed, setFacetSidebarCollapsed] = useLocalStorage(
    'argus_facet_sidebar_collapsed',
    false
  );

  // Resizable splitters
  const {
    splitWidth: panelWidth,
    isDragging: isPanelDragging,
    handleMouseDown: handlePanelSplitterMouseDown,
  } = useResizableSplit({
    storageKey: 'argus_log_panel_width',
    defaultWidth: 420,
    minWidth: 320,
    maxWidth: 700,
    invertDelta: true,
  });

  const handleToggleFacetCollapse = useCallback(
    () => setFacetSidebarCollapsed((c) => !c),
    [setFacetSidebarCollapsed]
  );

  const {
    splitWidth: facetWidth,
    isDragging: isFacetDragging,
    handleMouseDown: handleFacetSplitterMouseDown,
  } = useResizableSplit({
    storageKey: 'argus_facet_panel_width',
    defaultWidth: 240,
    minWidth: 150,
    maxWidth: 500,
  });

  // Local handlers that require refs or states inside component
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `logs-${new Date().toISOString()}.json`;
    a.click();
  };

  const handleGotoTimeSubmit = () => {
    if (gotoTime) {
      const parts = gotoTime.split(':').map(Number);
      if (parts.length >= 2) {
        const targetSec =
          (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
        let closestIdx = 0,
          closestDiff = Infinity;
        logs.forEach((log, idx) => {
          const d = new Date(log.timestamp);
          const logSec =
            d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
          const diff = Math.abs(logSec - targetSec);
          if (diff < closestDiff) {
            closestDiff = diff;
            closestIdx = idx;
          }
        });
        const container = logContainerRef.current;
        if (container) {
          const rows = container.querySelectorAll('[data-log-row]');
          if (rows[closestIdx]) {
            rows[closestIdx].scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            });
            (rows[closestIdx] as HTMLElement).style.backgroundColor = isDark
              ? 'rgba(33,150,243,0.15)'
              : 'rgba(33,150,243,0.12)';
            setTimeout(() => {
              (rows[closestIdx] as HTMLElement).style.backgroundColor = '';
            }, 1500);
          }
        }
      }
    }
    setShowGotoTime(false);
    setGotoTime('');
  };

  const openEditTable = useCallback(() => setEditTableOpen(true), []);
  const saveEditTable = useCallback(
    (newCols: string[], newNames: Record<string, string>) => {
      setColumns(newCols);
      setColumnsLocal(newCols);
      setColumnNamesLocal(newNames);
      setEditTableOpen(false);
    },
    [setColumns]
  );

  // Stable callback refs for memoized children
  const handleTabChange = useCallback(
    (key: string) => {
      setUrlState({ tab: key });
      if (key === '1') fetchAggregates();
      if (key === '2') fetchPatterns();
    },
    [setUrlState, fetchAggregates, fetchPatterns]
  );
  const handleWrapLinesToggle = useCallback(() => setWrapLines((w) => !w), []);
  const handleFullscreenToggle = useCallback(
    () => setLogsFullscreen((f) => !f),
    []
  );
  const handleShowGotoTime = useCallback(() => setShowGotoTime(true), []);
  const handleGotoTimeCancel = useCallback(() => {
    setShowGotoTime(false);
    setGotoTime('');
  }, []);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 64px)',
        overflow: 'hidden',
      }}
    >
      {/* ── Top: Header (full width) ── */}
      <PageHeader
        icon={<LogIcon />}
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
          'argus.logs.subtitle',
          'Structured log explorer with trace-connected debugging'
        )}
        actions={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <SafeTooltip title={t('argus.logs.savedQueries', 'Saved Queries')}>
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
              onClick={async () => {
                if (saving) return;
                if (currentQueryId) {
                  handleSave();
                } else if (queryName !== defaultQueryName && queryName.trim()) {
                  const duplicate = savedQueries.find(
                    (q) =>
                      q.name.toLowerCase() === queryName.trim().toLowerCase()
                  );
                  if (duplicate) {
                    setSaveName(queryName.trim());
                    setSaveDialogMode('new');
                    setSaveDialogOpen(true);
                  } else {
                    // Save directly via dialog callback
                    await handleDialogSave(queryName.trim(), null);
                  }
                } else {
                  setSaveName('');
                  setSaveDialogMode('new');
                  setSaveDialogOpen(true);
                }
              }}
              disabled={saving || !isDirty}
              sx={{
                textTransform: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: '6px',
              }}
            >
              {t('argus.logs.save', 'Save')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<SaveIcon sx={{ fontSize: 15 }} />}
              onClick={() => {
                setSaveName(queryName === defaultQueryName ? '' : queryName);
                setSaveDialogMode('saveAs');
                setSaveDialogOpen(true);
              }}
              disabled={saving}
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
              {t('argus.logs.saveAs', 'Save as...')}
            </Button>
          </Box>
        }
      />

      {/* ── Top: Filter Bar (full width) ── */}
      <ArgusFilterBar
        projectId={projectId}
        value={filters}
        onChange={(newFilters) => {
          // Environment change → AQL chip
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
              config={LOGS_CONFIG}
              initialQuery={search}
              placeholder={t(
                'argus.logs.searchPlaceholder',
                'Search by message, service, or severity...'
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

      {/* ── Body: Sidebar + Content split ── */}
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          borderRadius: 2,
          backgroundColor: 'background.paper',
        }}
      >
        {/* Left: Facets Sidebar */}
        <Box sx={{ display: 'flex', flexShrink: 0, position: 'relative' }}>
          <FacetSidebar
            width={facetWidth}
            facets={facetGroups}
            onFilter={(key, value) => {
              const ref = dslEditorRef.current;
              if (!ref) return;
              // Strip internal prefixes (discovered facets use "discovered.key", custom facets use "attr.key")
              const cleanKey = key.replace(/^(discovered\.|attr\.)/, '');
              const current = ref.getFieldValues(cleanKey);
              if (current.includes(value)) {
                ref.upsertFieldChip(
                  cleanKey,
                  current.filter((v) => v !== value)
                );
              } else {
                ref.upsertFieldChip(cleanKey, [...current, value]);
              }
            }}
            collapsed={facetSidebarCollapsed}
            onToggleCollapse={handleToggleFacetCollapse}
            loading={loading}
            customFacets={customFacetData}
            discoveredFacets={discoveredFacets}
            onAddCustomFacet={handleAddCustomFacet}
            onRemoveCustomFacet={handleRemoveCustomFacet}
          />
          {!facetSidebarCollapsed && (
            <Box
              onMouseDown={handleFacetSplitterMouseDown}
              sx={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: '1px',
                cursor: 'col-resize',
                bgcolor: isFacetDragging ? 'primary.main' : 'divider',
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
        </Box>

        {/* Right: Main log content */}
        <Box
          sx={{
            flex: 1,
            overflow: 'hidden',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Volume Chart - fixed at top */}
          {(() => {
            // Transform VolumePoint[] → labels + datasets for ArgusVolumeChart
            const SEVERITY_ORDER = [
              'fatal',
              'critical',
              'error',
              'warn',
              'warning',
              'info',
              'debug',
              'trace',
            ];
            const SEVERITY_COLORS: Record<string, string> = {
              fatal: '#d32f2f',
              critical: '#d32f2f',
              error: '#f44336',
              warn: '#ff9800',
              warning: '#ff9800',
              info: '#2196f3',
              debug: '#9e9e9e',
              trace: '#607d8b',
            };

            const bucketSet = new Set<string>();
            const levelSet = new Set<string>();
            volume.forEach((p) => {
              bucketSet.add(p.bucket);
              levelSet.add(p.level?.toLowerCase() || 'unknown');
            });
            const sortedBuckets = [...bucketSet].sort();
            const levels = [...levelSet].sort((a, b) => {
              const ai = SEVERITY_ORDER.indexOf(a);
              const bi = SEVERITY_ORDER.indexOf(b);
              return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
            });

            // Dedup levels sharing same color (warn/warning)
            const deduped: { level: string; color: string }[] = [];
            const seenColors = new Set<string>();
            levels.forEach((lvl) => {
              const color = SEVERITY_COLORS[lvl] || '#6b7280';
              if (!seenColors.has(color)) {
                seenColors.add(color);
                deduped.push({ level: lvl, color });
              }
            });

            // Lookup map
            const lookup = new Map<string, Map<string, number>>();
            volume.forEach((p) => {
              const bkt = p.bucket;
              const lvl = p.level?.toLowerCase() || 'unknown';
              if (!lookup.has(bkt)) lookup.set(bkt, new Map());
              const m = lookup.get(bkt)!;
              m.set(lvl, (m.get(lvl) || 0) + (Number(p.count) || 0));
            });

            const chartLabels = sortedBuckets.map((b) => {
              const d = new Date(b);
              return d.toLocaleString(i18n.language || 'en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              });
            });

            const chartDatasets = deduped.map(({ level, color }) => ({
              label: level.charAt(0).toUpperCase() + level.slice(1),
              data: sortedBuckets.map((bkt) => {
                const m = lookup.get(bkt);
                if (!m) return 0;
                if (level === 'warn' || level === 'warning') {
                  return (m.get('warn') || 0) + (m.get('warning') || 0);
                }
                return m.get(level) || 0;
              }),
              type: 'bar' as const,
              color,
            }));

            const handleChartZoom = (startIdx: number, endIdx: number) => {
              const si = Math.min(startIdx, endIdx);
              const ei = Math.max(startIdx, endIdx);
              if (sortedBuckets[si] && sortedBuckets[ei]) {
                const startDate = new Date(sortedBuckets[si]);
                let endDate = new Date(sortedBuckets[ei]);
                if (sortedBuckets.length > 1) {
                  const gap =
                    new Date(sortedBuckets[1]).getTime() -
                    new Date(sortedBuckets[0]).getTime();
                  endDate = new Date(endDate.getTime() + gap);
                } else {
                  endDate = new Date(endDate.getTime() + 3600000);
                }
                handleZoom(startDate.toISOString(), endDate.toISOString());
              }
            };

            return (
              <Box sx={{ flexShrink: 0, pt: 2, pb: 1, px: 2 }}>
                <ArgusVolumeChart
                  datasets={chartDatasets}
                  labels={chartLabels}
                  loading={loading && volume.length === 0}
                  title="count(logs)"
                  emptyMessage={t('argus.logs.noLogData')}
                  onZoom={handleChartZoom}
                  storagePrefix="argus_log_volume"
                  showLegend
                  mb={0}
                />
              </Box>
            );
          })()}

          {/* Main Content Area (Fullscreen Wrapper) */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              overflow: 'hidden',
              ...(!logsFullscreen && { px: 2, pb: 2 }),
              ...(logsFullscreen && {
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 1300,
                bgcolor: 'background.default',
                p: 1,
              }),
            }}
          >
            {/* Toolbar - fixed */}
            <Box sx={{ flexShrink: 0 }}>
              <LogsToolbar
                activeTab={activeTab}
                onTabChange={handleTabChange}
                totalLogCount={totalLogCount}
                displayCount={logs.length}
                isDark={isDark}
                onOpenEditTable={openEditTable}
                onExport={handleExport}
                wrapLines={wrapLines}
                onWrapLinesToggle={handleWrapLinesToggle}
                logsFullscreen={logsFullscreen}
                onFullscreenToggle={handleFullscreenToggle}
                showGotoTime={showGotoTime}
                gotoTime={gotoTime}
                onShowGotoTime={handleShowGotoTime}
                onGotoTimeChange={setGotoTime}
                onGotoTimeSubmit={handleGotoTimeSubmit}
                onGotoTimeCancel={handleGotoTimeCancel}
                displayDensity={displayDensity}
                onDensityChange={setDisplayDensity}
              />
            </Box>

            {/* Row container for Table + Side Panel */}
            <Box
              sx={{
                display: 'flex',
                flex: 1,
                overflow: 'hidden',
                minHeight: 0,
                width: '100%',
                border: `1px solid`,
                borderColor: 'divider',
                borderRadius: 2,
              }}
            >
              {/* Scrollable tab content */}
              <Box
                sx={{
                  flex: 1,
                  overflow: activeTab === 0 ? 'hidden' : 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {activeTab === 0 && logs.length === 0 && !loading && (
                  <EmptyPlaceholder
                    variant="text"
                    icon={<SearchIcon sx={{ fontSize: 48 }} />}
                    message={t('argus.logs.noLogs', 'No logs found yet')}
                    description={t(
                      'argus.logs.noLogsDesc',
                      'Try adjusting your filters or time range.'
                    )}
                    sx={{ flex: 1 }}
                  />
                )}
                {activeTab === 0 && (logs.length > 0 || loading) && (
                  <LogsTablePanel
                    columns={columnsLocal}
                    columnNames={columnNamesLocal}
                    availableColumns={dynamicAvailableColumns}
                    logsFullscreen={logsFullscreen}
                    wrapLines={wrapLines}
                    isDark={isDark}
                    logs={logs}
                    loading={loading}
                    hasMore={hasMore}
                    selectedLogIndex={selectedLogIndex}
                    displayDensity={displayDensity}
                    searchDebounce={search}
                    logContainerRef={logContainerRef}
                    onSelectLog={handleSelectLog}
                    onLoadMore={handleLoadMore}
                  />
                )}

                {/* Aggregates Tab */}
                {activeTab === 1 &&
                  !aggLoading &&
                  (!aggData || aggData.topValues.length === 0) && (
                    <EmptyPlaceholder
                      variant="text"
                      icon={<SearchIcon sx={{ fontSize: 48 }} />}
                      message={t(
                        'argus.logs.aggregatesTitle',
                        'Log Aggregates'
                      )}
                      description={t(
                        'argus.logs.aggregatesDesc',
                        'Group and count logs by attributes to identify patterns.'
                      )}
                      sx={{ flex: 1 }}
                    />
                  )}
                {activeTab === 1 &&
                  (aggLoading ||
                    aggGroupBys.some(
                      (g) => aggDataMap[g]?.topValues?.length > 0
                    )) && (
                    <>
                      {aggGroupBys.map((gKey, gIdx) => (
                        <LogsAggregatePanel
                          key={gKey}
                          aggData={aggDataMap[gKey] || null}
                          aggGroupBy={gKey}
                          aggLoading={aggLoading}
                          isDark={isDark}
                          discoveredFacetKeys={discoveredFacets.map(
                            (f) => f.label
                          )}
                          onGroupByChange={(val) => {
                            const newKeys = [...aggGroupBys];
                            newKeys[gIdx] = val;
                            const deduped = [...new Set(newKeys)];
                            setUrlState({ groupBy: deduped.join(',') });
                            fetchAggregates(deduped);
                          }}
                          onAddFilter={(key, val) => {
                            const r = dslEditorRef.current;
                            if (!r) return;
                            const current = r.getFieldValues(key);
                            if (current.includes(val)) {
                              r.upsertFieldChip(
                                key,
                                current.filter((v) => v !== val)
                              );
                            } else {
                              r.upsertFieldChip(key, [...current, val]);
                            }
                          }}
                          showRemove={aggGroupBys.length > 1}
                          onRemovePanel={() => {
                            const newKeys = aggGroupBys.filter(
                              (_, i) => i !== gIdx
                            );
                            setUrlState({ groupBy: newKeys.join(',') });
                            fetchAggregates(newKeys);
                          }}
                        />
                      ))}
                      {aggGroupBys.length < 3 && (
                        <Box
                          onClick={() => {
                            // Add a new group-by panel with a default key not already used
                            const defaults = [
                              'level',
                              'service',
                              'environment',
                              'logger_name',
                              'release',
                            ];
                            const next =
                              defaults.find((d) => !aggGroupBys.includes(d)) ||
                              'level';
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
                            transition: 'all 0.15s',
                            '&:hover': {
                              color: 'primary.main',
                              bgcolor: isDark
                                ? 'rgba(255,255,255,0.02)'
                                : 'rgba(0,0,0,0.01)',
                            },
                          }}
                        >
                          + {t('argus.logs.agg.addGroup', 'Add group')}
                        </Box>
                      )}
                    </>
                  )}

                {/* Patterns Tab */}
                {activeTab === 2 && (
                  <LogsPatternsPanel
                    patterns={patterns}
                    loading={patternsLoading}
                    isDark={isDark}
                    onPatternClick={(p) => setSelectedPattern(p)}
                    onCreateAlert={(p) => {
                      const params = new URLSearchParams();
                      params.set('dataset', 'logs');
                      const keyword = p.sample_message
                        ?.replace(/<[A-Z]+>/g, '')
                        ?.split(/[\s:]+/)
                        ?.find((w) => w.length > 3 && !/^\d+$/.test(w));
                      if (keyword) params.set('query', `message:"${keyword}"`);
                      if (p.level) params.set('level', p.level);
                      if (p.service) params.set('service', p.service);
                      navigate(
                        `/argus/alerts?action=create&${params.toString()}`
                      );
                    }}
                  />
                )}

                {/* Pattern Detail Drilldown Panel (⭐7) */}
                {activeTab === 2 && (
                  <PatternDetailPanel
                    pattern={selectedPattern}
                    open={!!selectedPattern}
                    onClose={() => setSelectedPattern(null)}
                    isDark={isDark}
                    onFilterPattern={undefined}
                    onCreateAlert={(p) => {
                      const params = new URLSearchParams();
                      params.set('dataset', 'logs');
                      const keyword = p.sample_message
                        ?.replace(/<[A-Z]+>/g, '')
                        ?.split(/[\s:]+/)
                        ?.find((w) => w.length > 3 && !/^\d+$/.test(w));
                      if (keyword) params.set('query', `message:"${keyword}"`);
                      if (p.level) params.set('level', p.level);
                      if (p.service) params.set('service', p.service);
                      navigate(
                        `/argus/alerts?action=create&${params.toString()}`
                      );
                    }}
                    projectId={projectId}
                    period={currentPeriod}
                  />
                )}

                {/* Live Tail Tab */}
                {activeTab === 3 && (
                  <LogsLiveTailPanel
                    projectId={projectId}
                    searchDebounce={search}
                    isDark={isDark}
                    onSelectLog={handleLiveTailSelectLog}
                    selectedLogId={liveTailSelectedLog?.log_id}
                  />
                )}
              </Box>

              {/* ── Splitter Handle + Right Side Panel ── */}
              {effectiveIsRightPanelOpen &&
                (activeTab === 0 || activeTab === 3) && (
                  <>
                    <Box
                      onMouseDown={handlePanelSplitterMouseDown}
                      sx={{
                        width: '1px',
                        flexShrink: 0,
                        cursor: 'col-resize',
                        bgcolor: isPanelDragging ? 'primary.main' : 'divider',
                        position: 'relative',
                        zIndex: 10,
                        transition: 'background-color 0.15s, transform 0.15s',
                        transformOrigin: 'center',
                        ...(isPanelDragging && {
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
                    <LogSidePanel
                      log={effectiveSelectedLog}
                      loading={activeTab === 0 ? selectedLogLoading : false}
                      open={effectiveIsRightPanelOpen}
                      onClose={() => {
                        if (activeTab === 3) {
                          setLiveTailSelectedLog(null);
                        } else {
                          handleCloseSidePanel();
                        }
                      }}
                      onPrev={activeTab === 0 ? handlePrevLog : undefined}
                      onNext={activeTab === 0 ? handleNextLog : undefined}
                      onFilter={(key, val, exclude) => {
                        const r = dslEditorRef.current;
                        if (!r) return;
                        const current = r.getFieldValues(key);
                        if (exclude) {
                          r.upsertFieldChip(key, [val], '!=');
                        } else if (current.includes(val)) {
                          r.upsertFieldChip(
                            key,
                            current.filter((v) => v !== val)
                          );
                        } else {
                          r.upsertFieldChip(key, [...current, val]);
                        }
                      }}
                      hasPrev={
                        activeTab === 0 &&
                        selectedLogIndex !== null &&
                        selectedLogIndex > 0
                      }
                      hasNext={
                        activeTab === 0 &&
                        selectedLogIndex !== null &&
                        selectedLogIndex < logs.length - 1
                      }
                      width={panelWidth}
                    />
                  </>
                )}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Dialogs */}
      <EditTableDialog
        open={editTableOpen}
        availableColumns={dynamicAvailableColumns}
        initialColumns={columnsLocal}
        initialNames={columnNamesLocal}
        onClose={() => setEditTableOpen(false)}
        onSave={saveEditTable}
      />

      <SaveQueryDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        name={saveName}
        onNameChange={setSaveName}
        onSave={async (name: string, existingQueryId: number | null) => {
          await handleDialogSave(name, existingQueryId, {
            displayDensity,
            wrapLines,
          });
          setSaveDialogOpen(false);
          setSaveName('');
        }}
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

      <SavedQueriesDrawer
        open={savedPanelOpen}
        queries={savedQueries}
        isDark={isDark}
        onClose={() => setSavedPanelOpen(false)}
        onLoad={(sq) =>
          handleLoadSavedQuery(sq, (cfg) => {
            if (cfg.displayDensity) setDisplayDensity(cfg.displayDensity);
            if (cfg.wrapLines !== undefined) setWrapLines(cfg.wrapLines);
          })
        }
        onDelete={handleDeleteSavedQuery}
      />
    </Box>
  );
};

export default ArgusLogsPage;
