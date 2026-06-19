import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import {
  Box,
  Typography,
  useTheme,
  alpha,
  Tooltip,
  IconButton,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Chip,
} from '@mui/material';
import {
  Insights as InsightsIcon,
  FilterAlt as FunnelIcon,
  Autorenew as RetentionIcon,
  AccountTree as FlowsIcon,
  BarChart as OverviewIcon,
  Save as SaveIcon,
  SaveAs as SaveAsIcon,
  Dashboard as DashboardIcon,
  ArrowDropDown as DropdownIcon,
  Circle as CircleIcon,
  FolderOpen as FolderIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import DateRangeSelector, {
  DateRangeValue,
  dateRangeToApiParams,
} from '@/components/common/DateRangeSelector';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import argusService, {
  type AnalyticsEventNameEntry,
} from '@/services/argusService';
import AnalyticsLayout from './components/analytics/AnalyticsLayout';
import {
  useInsightsStore,
  useFunnelsStore,
  useRetentionStore,
  useFlowsStore,
  useAnalyticsSaveState,
  serializeAnalyticsQuery,
  restoreInsightsQuery,
  restoreFunnelsQuery,
  restoreRetentionQuery,
  restoreFlowsQuery,
} from '@/hooks/useAnalyticsStore';
import type { ArgusSavedQuery, SavedQueryType } from '@/services/argusService';
import SaveAnalyticsQueryDialog from './components/analytics/SaveAnalyticsQueryDialog';
import AddToDashboardDialog from './components/analytics/AddToDashboardDialog';
import SavedQueriesSidePanel from './components/analytics/SavedQueriesSidePanel';
import { useResizableSplit } from '@/hooks/useResizableSplit';
import { OverviewLeftPanel, type SummaryData } from './components/analytics/OverviewLeftPanel';
import { OverviewMainContent } from './components/analytics/OverviewMainContent';

/* ─── Sub-pages (static imports — ArgusAnalyticsPage is already router-split) ─── */
import ArgusInsightsPage from './ArgusInsightsPage';
import ArgusFunnelsPage from './ArgusFunnelsPage';
import ArgusRetentionPage from './ArgusRetentionPage';
import ArgusFlowsPage from './ArgusFlowsPage';

/* ─── Tab config ─── */
type AnalyticsTab = 'overview' | 'insights' | 'funnels' | 'retention' | 'flows';

interface TabDef {
  key: AnalyticsTab;
  labelKey: string;
  descriptionKey: string;
  icon: React.ReactElement;
  color: string;
}

const TABS: TabDef[] = [
  {
    key: 'overview',
    labelKey: 'argus.analytics.overview',
    descriptionKey: 'argus.analytics.overviewDesc',
    icon: <OverviewIcon />,
    color: '#6366f1',
  },
  {
    key: 'insights',
    labelKey: 'argus.analytics.insights',
    descriptionKey: 'argus.analytics.insightsDesc',
    icon: <InsightsIcon />,
    color: '#6366f1',
  },
  {
    key: 'funnels',
    labelKey: 'argus.analytics.funnels',
    descriptionKey: 'argus.analytics.funnelsDesc',
    icon: <FunnelIcon />,
    color: '#f59e0b',
  },
  {
    key: 'retention',
    labelKey: 'argus.analytics.retention',
    descriptionKey: 'argus.analytics.retentionDesc',
    icon: <RetentionIcon />,
    color: '#10b981',
  },
  {
    key: 'flows',
    labelKey: 'argus.analytics.flows',
    descriptionKey: 'argus.analytics.flowsDesc',
    icon: <FlowsIcon />,
    color: '#ec4899',
  },
];

/* ─── TabBar Component (goes into AnalyticsLayout's tabBar slot) ─── */
interface AnalyticsTabBarProps {
  activeTab: AnalyticsTab;
  onTabChange: (tab: AnalyticsTab) => void;
}

interface TabIconButtonProps {
  tab: TabDef;
  isActive: boolean;
  isDark: boolean;
  label: string;
  onTabChange: (tab: AnalyticsTab) => void;
}

const TabIconButton: React.FC<TabIconButtonProps> = React.memo(
  function TabIconButton({ tab, isActive, isDark, label, onTabChange }) {
    const [open, setOpen] = useState(false);

    return (
      <Tooltip
        title={label}
        placement="bottom"
        arrow
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        enterDelay={400}
        leaveDelay={0}
        disableInteractive
      >
        <IconButton
          size="small"
          onMouseDown={() => setOpen(false)}
          onClick={() => onTabChange(tab.key)}
          sx={{
            width: 34,
            height: 34,
            borderRadius: '8px',
            color: isActive
              ? tab.color
              : isDark
                ? 'rgba(255,255,255,0.4)'
                : 'rgba(0,0,0,0.35)',
            backgroundColor: isActive
              ? alpha(tab.color, isDark ? 0.15 : 0.1)
              : 'transparent',
            transition: 'all 0.15s ease',
            '&:hover': {
              backgroundColor: isActive
                ? alpha(tab.color, isDark ? 0.2 : 0.15)
                : isDark
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(0,0,0,0.04)',
              color: isActive
                ? tab.color
                : isDark
                  ? 'rgba(255,255,255,0.7)'
                  : 'rgba(0,0,0,0.6)',
            },
          }}
        >
          {React.cloneElement(tab.icon, { sx: { fontSize: 18 } })}
        </IconButton>
      </Tooltip>
    );
  }
);

const AnalyticsTabBar: React.FC<AnalyticsTabBarProps> = React.memo(
  function AnalyticsTabBar({ activeTab, onTabChange }) {
    const theme = useTheme();
    const { t } = useTranslation();
    const isDark = theme.palette.mode === 'dark';
    const activeTabDef = TABS.find((tab) => tab.key === activeTab)!;

    return (
      <Box sx={{ flexShrink: 0 }}>
        {/* Icon row */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.25,
            px: 1.5,
            py: 1,
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TabIconButton
                key={tab.key}
                tab={tab}
                isActive={isActive}
                isDark={isDark}
                label={t(tab.labelKey)}
                onTabChange={onTabChange}
              />
            );
          })}
        </Box>

        {/* Active tab description banner */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 1,
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            background: alpha(activeTabDef.color, isDark ? 0.07 : 0.05),
            transition: 'background 0.2s ease',
          }}
        >
          {/* Color accent bar */}
          <Box
            sx={{
              width: 3,
              height: 28,
              borderRadius: '2px',
              background: activeTabDef.color,
              flexShrink: 0,
              transition: 'background 0.2s ease',
            }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                fontWeight: 700,
                fontSize: '0.72rem',
                color: activeTabDef.color,
                lineHeight: 1.2,
                transition: 'color 0.2s ease',
              }}
            >
              {t(activeTabDef.labelKey)}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                fontSize: '0.68rem',
                color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
                lineHeight: 1.4,
                whiteSpace: 'normal',
                wordBreak: 'keep-all',
              }}
            >
              {t(activeTabDef.descriptionKey)}
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }
);

/* ─── Overview Content (rendered inside AnalyticsLayout's main area) ─── */
interface OverviewContentProps {
  dateRange: DateRangeValue;
  setDateRange: (v: DateRangeValue) => void;
  tabBar: React.ReactNode;
}

const OverviewContent: React.FC<OverviewContentProps> = ({
  dateRange,
  setDateRange,
  tabBar,
}) => {
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

  const [eventNames, setEventNames] = useState<AnalyticsEventNameEntry[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const apiParams = dateRangeToApiParams(dateRange);
      const [evData, summData] = await Promise.all([
        argusService.getAnalyticsEventNames(
          projectId,
          apiParams.period,
          apiParams.start,
          apiParams.end
        ),
        argusService.getAnalyticsSummary(
          projectId,
          apiParams.period,
          apiParams.start,
          apiParams.end
        ),
      ]);
      setEventNames(evData);
      setSummary(summData);
    } catch {
      setEventNames([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const dateRangeLabel = dateRange.preset || 'custom';

  return (
    <AnalyticsLayout
      tabBar={tabBar}
      leftPanel={
        <OverviewLeftPanel
          summary={summary}
          eventNames={eventNames}
          dateRangeLabel={dateRangeLabel}
        />
      }
    >
      <OverviewMainContent
        summary={summary}
        eventNames={eventNames}
        loading={loading}
        dateRangeLabel={dateRangeLabel}
        setDateRange={setDateRange}
      />
    </AnalyticsLayout>
  );
};

/* ─── Main Container (Tabbed Page) ─── */
const ArgusAnalyticsPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();

  const [activeTab, setActiveTab] = useLocalStorage<AnalyticsTab>(
    'argus_analytics_active_tab',
    'overview'
  );

  const [dateRange, setDateRange] = useState<DateRangeValue>({
    type: 'preset',
    preset: '14d',
  });

  // Save / Load state
  const {
    currentQueryId,
    currentQueryName,
    isDirty,
    setCurrentQuery,
    setDirty,
    clearSaveState,
  } = useAnalyticsSaveState();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveDialogMode, setSaveDialogMode] = useState<'create' | 'save_as'>(
    'create'
  );
  const [dashboardDialogOpen, setDashboardDialogOpen] = useState(false);
  const [saveMenuAnchor, setSaveMenuAnchor] = useState<HTMLElement | null>(
    null
  );
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const saveButtonRef = React.useRef<HTMLButtonElement>(null);
  const [sidePanelRefresh, setSidePanelRefresh] = useState(0);
  const [savedQueriesOpen, setSavedQueriesOpen] = useState(false);

  // Unified panel width for all analytics tabs
  const {
    splitWidth: unifiedPanelWidth,
    isDragging: unifiedIsDragging,
    handleMouseDown: unifiedHandleMouseDown,
  } = useResizableSplit({
    storageKey: 'argus_analytics_panel_width',
    defaultWidth: 340,
    minWidth: 260,
    maxWidth: 600,
  });

  const activeQueryType: SavedQueryType | null = useMemo(() => {
    if (activeTab === 'overview') return null;
    return `analytics-${activeTab}` as SavedQueryType;
  }, [activeTab]);

  const getActiveStoreState = useCallback(() => {
    switch (activeTab) {
      case 'insights':
        return useInsightsStore.getState();
      case 'funnels':
        return useFunnelsStore.getState();
      case 'retention':
        return useRetentionStore.getState();
      case 'flows':
        return useFlowsStore.getState();
      default:
        return {};
    }
  }, [activeTab]);

  const handleSaveQuery = useCallback(
    async (name: string, description: string) => {
      if (!activeQueryType) return;
      const storeState = getActiveStoreState();
      const queryConfig = serializeAnalyticsQuery(activeTab as any, storeState);

      if (saveDialogMode === 'create' && currentQueryId) {
        // Update existing
        await argusService.updateSavedQuery(
          currentProject?.id || '1',
          currentQueryId,
          {
            name,
            description,
            query_config: queryConfig,
          }
        );
        setCurrentQuery(currentQueryId, name);
      } else {
        // Create new
        const result = await argusService.createSavedQuery(
          currentProject?.id || '1',
          {
            name,
            description,
            query_config: queryConfig,
            query_type: activeQueryType,
          }
        );
        setCurrentQuery(result.id, name);
      }
      setSaveDialogOpen(false);
      setSidePanelRefresh((p) => p + 1);
    },
    [
      activeQueryType,
      activeTab,
      currentQueryId,
      getActiveStoreState,
      saveDialogMode,
      currentProject?.id,
      setCurrentQuery,
    ]
  );

  const handleOverwriteSave = useCallback(async () => {
    if (!currentQueryId || !activeQueryType) return;
    const storeState = getActiveStoreState();
    const queryConfig = serializeAnalyticsQuery(activeTab as any, storeState);
    await argusService.updateSavedQuery(
      currentProject?.id || '1',
      currentQueryId,
      {
        query_config: queryConfig,
      }
    );
    setDirty(false);
    setSidePanelRefresh((p) => p + 1);
  }, [
    currentQueryId,
    activeQueryType,
    activeTab,
    getActiveStoreState,
    currentProject?.id,
    setDirty,
  ]);

  const handleLoadQuery = useCallback(
    (query: ArgusSavedQuery) => {
      const config = query.query_config;
      switch (activeTab) {
        case 'insights':
          restoreInsightsQuery(config, useInsightsStore.getState());
          break;
        case 'funnels':
          restoreFunnelsQuery(config, useFunnelsStore.getState());
          break;
        case 'retention':
          restoreRetentionQuery(config, useRetentionStore.getState());
          break;
        case 'flows':
          restoreFlowsQuery(config, useFlowsStore.getState());
          break;
      }
      setCurrentQuery(query.id, query.name);
    },
    [activeTab, setCurrentQuery]
  );

  const handleNewQuery = useCallback(() => {
    switch (activeTab) {
      case 'insights':
        useInsightsStore.getState().resetStore();
        break;
      case 'funnels':
        useFunnelsStore.getState().resetStore();
        break;
      case 'retention':
        useRetentionStore.getState().resetStore();
        break;
      case 'flows':
        useFlowsStore.getState().resetStore();
        break;
    }
    clearSaveState();
  }, [activeTab, clearSaveState]);

  // Clear save state when switching tabs
  useEffect(() => {
    clearSaveState();
  }, [activeTab, clearSaveState]);

  // Sync dateRange to all sub-page stores
  const setInsightsDateRange = useInsightsStore((s) => s.setDateRange);
  const setFunnelsDateRange = useFunnelsStore((s) => s.setDateRange);
  const setRetentionDateRange = useRetentionStore((s) => s.setDateRange);
  const setFlowsDateRange = useFlowsStore((s) => s.setDateRange);

  const handleDateRangeChange = useCallback(
    (value: DateRangeValue) => {
      setDateRange(value);
      setInsightsDateRange(value);
      setFunnelsDateRange(value);
      setRetentionDateRange(value);
      setFlowsDateRange(value);
    },
    [
      setInsightsDateRange,
      setFunnelsDateRange,
      setRetentionDateRange,
      setFlowsDateRange,
    ]
  );

  const handleTabChange = useCallback(
    (tab: AnalyticsTab) => {
      setActiveTab(tab);
    },
    [setActiveTab]
  );

  const tabBar = useMemo(
    () => (
      <AnalyticsTabBar activeTab={activeTab} onTabChange={handleTabChange} />
    ),
    [activeTab, handleTabChange]
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 64px)',
        overflow: 'hidden',
        m: -2,
      }}
    >
      <PageHeader
        title={
          <ArgusBreadcrumbs
            paths={[{ label: t('argus.analytics.title', 'Analytics') }]}
            size="title"
          />
        }
        subtitle={t(
          'argus.analytics.subtitle',
          'User behavior analysis and product insights'
        )}
        actions={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Current query name */}
            {currentQueryName && activeTab !== 'overview' && (
              <Chip
                size="small"
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {isDirty && (
                      <CircleIcon sx={{ fontSize: 6, color: '#f59e0b' }} />
                    )}
                    {currentQueryName}
                  </Box>
                }
                onDelete={() => {
                  clearSaveState();
                }}
                sx={{
                  height: 26,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: (t) => alpha(t.palette.primary.main, 0.08),
                  '& .MuiChip-deleteIcon': { fontSize: 14 },
                }}
              />
            )}
            {/* Saved Queries toggle button — only for analysis tabs */}
            {activeTab !== 'overview' && (
              <Tooltip title={t('argus.analytics.savedQueries', 'Saved Queries')}>
                <IconButton
                  size="small"
                  onClick={() => setSavedQueriesOpen((prev) => !prev)}
                  sx={{
                    width: 28,
                    height: 28,
                    color: savedQueriesOpen ? 'primary.main' : 'text.secondary',
                    backgroundColor: savedQueriesOpen
                      ? (t) => alpha(t.palette.primary.main, 0.1)
                      : 'transparent',
                    '&:hover': {
                      backgroundColor: (t) => alpha(t.palette.primary.main, 0.15),
                    },
                  }}
                >
                  <FolderIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
            <DateRangeSelector
              value={dateRange}
              onChange={handleDateRangeChange}
              compact
            />
            {/* Save button — only for analysis tabs */}
            {activeTab !== 'overview' && (
              <Button
                ref={saveButtonRef}
                size="small"
                variant="outlined"
                startIcon={<SaveIcon sx={{ fontSize: 14 }} />}
                endIcon={<DropdownIcon sx={{ fontSize: 16 }} />}
                onClick={(e) => {
                  setSaveMenuAnchor(e.currentTarget);
                  setSaveMenuOpen(true);
                }}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  minWidth: 0,
                }}
              >
                {t('argus.analytics.save', 'Save')}
              </Button>
            )}
          </Box>
        }
        actionsUpdateTrigger={`${JSON.stringify(dateRange)}-${currentQueryId}-${currentQueryName}-${isDirty}-${activeTab}-${savedQueriesOpen}`}
      />

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

        {/* Overview: always rendered */}
        <Box
          sx={{
            display: activeTab === 'overview' ? 'flex' : 'none',
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <OverviewContent
            dateRange={dateRange}
            setDateRange={handleDateRangeChange}
            tabBar={tabBar}
          />
        </Box>

        {/* Insights */}
        {activeTab === 'insights' && (
          <Box
            sx={{
              display: 'flex',
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <ArgusInsightsPage
              embedded
              tabBar={tabBar}
              panelWidth={unifiedPanelWidth}
              onPanelResizeMouseDown={unifiedHandleMouseDown}
              isPanelDragging={unifiedIsDragging}
              onDateRangeChange={handleDateRangeChange}
            />
          </Box>
        )}

        {/* Funnels */}
        {activeTab === 'funnels' && (
          <Box
            sx={{
              display: 'flex',
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <ArgusFunnelsPage
              embedded
              tabBar={tabBar}
              panelWidth={unifiedPanelWidth}
              onPanelResizeMouseDown={unifiedHandleMouseDown}
              isPanelDragging={unifiedIsDragging}
            />
          </Box>
        )}

        {/* Retention */}
        {activeTab === 'retention' && (
          <Box
            sx={{
              display: 'flex',
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <ArgusRetentionPage
              embedded
              tabBar={tabBar}
              panelWidth={unifiedPanelWidth}
              onPanelResizeMouseDown={unifiedHandleMouseDown}
              isPanelDragging={unifiedIsDragging}
            />
          </Box>
        )}

        {/* Flows */}
        {activeTab === 'flows' && (
          <Box
            sx={{
              display: 'flex',
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <ArgusFlowsPage
              embedded
              tabBar={tabBar}
              panelWidth={unifiedPanelWidth}
              onPanelResizeMouseDown={unifiedHandleMouseDown}
              isPanelDragging={unifiedIsDragging}
            />
          </Box>
        )}
      </Box>

      {/* Saved Queries Drawer */}
      {activeQueryType && (
        <SavedQueriesSidePanel
          projectId={currentProject?.id || '1'}
          queryType={activeQueryType}
          activeQueryId={currentQueryId}
          onLoadQuery={handleLoadQuery}
          onNewQuery={handleNewQuery}
          refreshTrigger={sidePanelRefresh}
          open={savedQueriesOpen}
          onClose={() => setSavedQueriesOpen(false)}
        />
      )}

      {/* Save Menu */}
      <Menu
        anchorEl={saveMenuAnchor}
        open={saveMenuOpen}
        onClose={() => {
          setSaveMenuOpen(false);
          setSaveMenuAnchor(null);
        }}
        slotProps={{ paper: { sx: { minWidth: 180, borderRadius: '8px' } } }}
      >
        {currentQueryId && (
          <MenuItem
            onClick={() => {
              setSaveMenuOpen(false);
              setSaveMenuAnchor(null);
              handleOverwriteSave();
            }}
            sx={{ fontSize: '0.8rem' }}
          >
            <ListItemIcon>
              <SaveIcon sx={{ fontSize: 16 }} />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: '0.8rem' }}>
              {t('argus.analytics.save', 'Save')}
            </ListItemText>
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            setSaveMenuOpen(false);
            setSaveMenuAnchor(null);
            setSaveDialogMode(currentQueryId ? 'save_as' : 'create');
            setSaveDialogOpen(true);
          }}
          sx={{ fontSize: '0.8rem' }}
        >
          <ListItemIcon>
            <SaveAsIcon sx={{ fontSize: 16 }} />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: '0.8rem' }}>
            {currentQueryId
              ? t('argus.analytics.saveAs', 'Save As')
              : t('argus.analytics.saveQuery', 'Save Query')}
          </ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setSaveMenuOpen(false);
            setSaveMenuAnchor(null);
            setDashboardDialogOpen(true);
          }}
          sx={{ fontSize: '0.8rem' }}
        >
          <ListItemIcon>
            <DashboardIcon sx={{ fontSize: 16 }} />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: '0.8rem' }}>
            {t('argus.analytics.addToDashboard', 'Add to Dashboard')}
          </ListItemText>
        </MenuItem>
      </Menu>

      {/* Save / Save As Dialog */}
      <SaveAnalyticsQueryDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        mode={saveDialogMode}
        defaultName={currentQueryName}
        onSave={handleSaveQuery}
      />

      {/* Add to Dashboard Dialog */}
      {activeQueryType && (
        <AddToDashboardDialog
          open={dashboardDialogOpen}
          onClose={() => setDashboardDialogOpen(false)}
          projectId={currentProject?.id || '1'}
          analyticsType={activeTab as any}
          analyticsConfig={serializeAnalyticsQuery(
            activeTab as any,
            getActiveStoreState()
          )}
          defaultTitle={currentQueryName || `${activeTab} query`}
        />
      )}
    </Box>
  );
};

export default ArgusAnalyticsPage;
