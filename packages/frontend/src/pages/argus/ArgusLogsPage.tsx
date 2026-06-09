import React, { useState, useRef, useCallback } from 'react';
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
import { QueryDSLEditor, LOGS_CONFIG } from '@/components/argus/query-dsl';
import PageHeader from '@/components/common/PageHeader';
import EditablePageTitle from '@/components/common/EditablePageTitle';
import { useResizableSplit } from '@/hooks/useResizableSplit';
import { useLocalStorage } from '@/hooks/useLocalStorage';

// Page-specific components
import LogVolumeChart from './components/LogVolumeChart';
import LogsToolbar from './components/LogsToolbar';
import LogsTablePanel from './components/LogsTablePanel';
import LogsAggregatePanel from './components/LogsAggregatePanel';
import LogsPatternsPanel from './components/LogsPatternsPanel';
import LogsLiveTailPanel from './components/LogsLiveTailPanel';
import {
  EditTableDialog,
  SaveQueryDialog,
  SavedQueriesDrawer,
} from './components/LogsDialogs';
import FacetSidebar from '@/components/argus/FacetSidebar';
import LogSidePanel from './components/LogSidePanel';
import ActiveFiltersBar from './components/ActiveFiltersBar';

// Custom Hooks
import { useArgusLogs } from './hooks/useArgusLogs';

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip, Legend);

const ArgusLogsPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  const {
    projectId,
    activeTab,
    aggGroupBy,
    filters,
    search,
    logs,
    loading,
    volume,
    hasMore,
    columns,
    setColumns,
    columnNames,
    dynamicAvailableColumns,
    selectedLogIndex,
    selectedLog,
    isRightPanelOpen,
    setIsRightPanelOpen,
    activeFilters,
    customFacetKeys,
    customFacetData,
    discoveredFacets,
    aggData,
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
    toggleActiveFilter,
    handleToggleFilterByIndex,
    removeActiveFilter,
    clearAllActiveFilters,
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
    handleDetailFilter,
    handleSaveQuery,
    handleRename,
    handleDeleteSavedQuery,
    handleLoadSavedQuery,

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
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [savedPanelOpen, setSavedPanelOpen] = useState(false);
  const [wrapLines, setWrapLines] = useState(false);
  const [logsFullscreen, setLogsFullscreen] = useState(false);
  const [showGotoTime, setShowGotoTime] = useState(false);
  const [gotoTime, setGotoTime] = useState('');
  const [displayDensity, setDisplayDensity] = useState<
    'compact' | 'default' | 'expanded'
  >('default');

  const logContainerRef = useRef<HTMLDivElement>(null);
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
        extraControls={(() => {
          const dslQueryRef = { current: search };
          return (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                flex: 1,
                minWidth: 0,
              }}
            >
              <QueryDSLEditor
                config={LOGS_CONFIG}
                initialQuery={search}
                placeholder={t(
                  'argus.logs.searchPlaceholder',
                  'Search by message, service, or severity...'
                )}
                onSearch={handleSearchSubmit}
                onChange={(q) => {
                  dslQueryRef.current = q;
                  // Sync to URL so chip state survives refresh
                  setUrlState({ q });
                }}
                fetchFieldValues={fetchFieldValues}
              />
            </Box>
          );
        })()}
      />

      {/* ── Active Filter Chips ── */}
      <ActiveFiltersBar
        activeFilters={activeFilters}
        isDark={isDark}
        onToggleFilter={handleToggleFilterByIndex}
        onRemoveFilter={removeActiveFilter}
        onClearAll={clearAllActiveFilters}
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
            onFilter={toggleActiveFilter}
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
          <Box sx={{ flexShrink: 0, pt: 2, pb: 1, px: 2 }}>
            <LogVolumeChart
              data={volume}
              isDark={isDark}
              period={currentPeriod}
              onZoom={handleZoom}
            />
          </Box>

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
                ...(!logsFullscreen && {
                  borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
                }),
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
                  (aggLoading || (aggData && aggData.topValues.length > 0)) && (
                    <LogsAggregatePanel
                      aggData={aggData}
                      aggGroupBy={aggGroupBy}
                      aggLoading={aggLoading}
                      isDark={isDark}
                      onGroupByChange={(val) => {
                        setUrlState({ groupBy: val });
                        fetchAggregates(val);
                      }}
                      onAddFilter={(key, val) => toggleActiveFilter(key, val)}
                    />
                  )}

                {/* Patterns Tab */}
                {activeTab === 2 && (
                  <LogsPatternsPanel
                    patterns={patterns}
                    loading={patternsLoading}
                    isDark={isDark}
                  />
                )}

                {/* Live Tail Tab */}
                {activeTab === 3 && (
                  <LogsLiveTailPanel
                    projectId={projectId}
                    searchDebounce={search}
                    isDark={isDark}
                  />
                )}
              </Box>

              {/* ── Splitter Handle + Right Side Panel ── */}
              {isRightPanelOpen && (
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
                    log={selectedLog}
                    open={isRightPanelOpen}
                    onClose={handleCloseSidePanel}
                    onPrev={handlePrevLog}
                    onNext={handleNextLog}
                    onFilter={handleDetailFilter}
                    hasPrev={selectedLogIndex !== null && selectedLogIndex > 0}
                    hasNext={
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
