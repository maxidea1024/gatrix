import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Button,
  IconButton as MuiIconButton,
  useTheme,
  alpha,
  Tooltip,
} from '@mui/material';
import {
  BugReport as BugReportIcon,
  Save as SaveIcon,
  SaveAs as SaveAsIcon,
  FolderOpen as FolderOpenIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
} from '@mui/icons-material';
import PageContentLoader from '@/components/common/PageContentLoader';
import { ListSkeleton } from '@/components/argus/ArgusSkeletons';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import ArgusIcon from '@/components/icons/ArgusIcon';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import argusService, {
  ArgusIssue,
  ArgusIssueListParams,
  ArgusSavedQuery,
} from '@/services/argusService';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import { rbacService } from '@/services/rbacService';
import { useAuth } from '@/contexts/AuthContext';
import { useSnackbar } from 'notistack';
import ArgusFilterBar, {
  ArgusFilterState,
  defaultArgusFilterState,
} from '@/components/argus/ArgusFilterBar';
import { dateRangeToApiParams as argusDateRangeToApiParams } from '@/components/common/DateRangeSelector';
import useLocalStorage from '@/hooks/useLocalStorage';
import { formatCompactNumber } from '@/utils/numberFormat';
import SimplePagination from '@/components/common/SimplePagination';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import PageHeader from '@/components/common/PageHeader';
import IssueViewTabs, { IssueView } from '@/components/argus/IssueViewTabs';

import {
  QueryAQLEditor,
  ISSUES_CONFIG,
  resolveSearchMagicValues,
  type QueryAQLEditorHandle,
} from '@/components/argus/query-aql';
import FacetSidebar, { FacetGroup } from '@/components/argus/FacetSidebar';

import { useResizableSplit } from '@/hooks/useResizableSplit';
import { useArgusRealtime } from '@/hooks/useArgusRealtime';
import FilterChipSelect from '@/components/common/FilterChipSelect';
import IssueListItem from '@/components/argus/IssueListItem';
import IssueVolumeChart from './components/IssueVolumeChart';
import IssueBulkActions from './components/IssueBulkActions';
import IssueAssigneeMenu from './components/IssueAssigneeMenu';
import NewIssuesBanner from './components/NewIssuesBanner';
import { useArgusIssueStore } from '@/hooks/useArgusIssueStore';
import useGlobalPageSize from '@/hooks/useGlobalPageSize';
import {
  SaveQueryDialog,
  SavedQueriesPanel,
} from './components/TraceExplorerDialogs';
import {
  DEEP_LINK_KEYS,
  getSortOptions,
  EMPTY_FACET_COUNTS,
  type FacetCounts,
  buildFacetCounts,
} from './components/issuesHelpers';

interface ArgusIssuesPageProps {
  projectId?: string | number;
}

const ArgusIssuesPage: React.FC<ArgusIssuesPageProps> = ({
  projectId: propProjectId,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const isDark = theme.palette.mode === 'dark';

  // ─── Zustand Store ──────────────────────────────────────────────
  const currentPage = useArgusIssueStore((s) => s.currentPage);
  const storeSearch = useArgusIssueStore((s) => s.search);
  const status = useArgusIssueStore((s) => s.status);
  const level = useArgusIssueStore((s) => s.level);
  const sort = useArgusIssueStore((s) => s.sort);
  const activeViewId = useArgusIssueStore((s) => s.activeViewId);
  const substatus = useArgusIssueStore((s) => s.substatus);
  const assignedTo = useArgusIssueStore((s) => s.assignedTo);
  const storePeriod = useArgusIssueStore((s) => s.period);
  const storeCustomStart = useArgusIssueStore((s) => s.customStart);
  const storeCustomEnd = useArgusIssueStore((s) => s.customEnd);

  const setCurrentPage = useArgusIssueStore((s) => s.setCurrentPage);
  const setStoreSearch = useArgusIssueStore((s) => s.setSearch);
  const setStatus = useArgusIssueStore((s) => s.setStatus);
  const setLevel = useArgusIssueStore((s) => s.setLevel);
  const setSort = useArgusIssueStore((s) => s.setSort);
  const setActiveViewId = useArgusIssueStore((s) => s.setActiveViewId);
  const setSubstatus = useArgusIssueStore((s) => s.setSubstatus);
  const setAssignedTo = useArgusIssueStore((s) => s.setAssignedTo);
  const setStorePeriod = useArgusIssueStore((s) => s.setPeriod);
  const setStoreCustomDateRange = useArgusIssueStore(
    (s) => s.setCustomDateRange
  );
  const hydrateFromParams = useArgusIssueStore((s) => s.hydrateFromParams);
  const resetStore = useArgusIssueStore((s) => s.resetStore);

  // ─── Mount Initialization ──────────────────────────────────────
  // Runs once: handles GNB reset and deep-link hydration.
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // 1. GNB/Sidebar reset: MainLayout's openOrNavigate passes { fromSidebar: true }
    //    When user clicks the sidebar menu (not breadcrumb), reset to clean state.
    if ((location.state as any)?.fromSidebar) {
      resetStore();
      // Clear location state to prevent re-reset on re-render
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }

    // 2. Deep-link hydration: if URL contains filter params, apply them to store
    const hasDeepLinkParams = DEEP_LINK_KEYS.some((k) => searchParams.has(k));
    if (hasDeepLinkParams) {
      // Reset to defaults first, then apply URL params on top.
      // This prevents stale Zustand state from leaking into deep-link navigation
      // (e.g. Overview → Issues with level=error should NOT retain page=50 from previous session).
      resetStore();
      const hydration: Record<string, unknown> = {};
      const urlPage = searchParams.get('page');
      const urlSearch = searchParams.get('search');
      const urlStatus = searchParams.get('status');
      const urlLevel = searchParams.get('level');
      const urlSort = searchParams.get('sort');
      const urlView = searchParams.get('view');
      const urlSubstatus = searchParams.get('substatus');
      const urlAssignedTo = searchParams.get('assigned_to');

      if (urlPage) hydration.currentPage = parseInt(urlPage, 10);
      if (urlSearch) hydration.search = urlSearch;
      if (urlStatus) hydration.status = urlStatus;
      if (urlLevel) hydration.level = urlLevel;
      if (urlSort) hydration.sort = urlSort;
      if (urlView) hydration.activeViewId = urlView;
      if (urlSubstatus) hydration.substatus = urlSubstatus;
      if (urlAssignedTo) hydration.assignedTo = urlAssignedTo;

      hydrateFromParams(hydration);
      // Strip deep-link params from URL (Zustand is now the source of truth)
      navigate(location.pathname, { replace: true });
    }
    // 3. Normal breadcrumb return: no URL params, no GNB flag
    //    → Zustand retains previous state automatically.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Project / Page-size ────────────────────────────────────────
  const { currentProject } = useOrgProject();
  const projectId =
    propProjectId || searchParams.get('projectId') || currentProject?.id || '1';
  const [rowsPerPage, setRowsPerPage] = useGlobalPageSize();

  // ─── Saved Queries ───────────────────────────────────────────────
  const defaultQueryName = t(
    'argus.issues.untitledQuery',
    'Untitled Issue Query'
  );
  const [currentQueryId, setCurrentQueryId] = useState<number | null>(null);
  const [queryName, setQueryName] = useState(
    (location.state as any)?.queryName || defaultQueryName
  );
  const [saveName, setSaveName] = useState('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveDialogMode, setSaveDialogMode] = useState<'new' | 'saveAs'>('new');
  const [savedQueries, setSavedQueries] = useState<ArgusSavedQuery[]>([]);
  const [savedPanelOpen, setSavedPanelOpen] = useState(false);

  // Snapshot for dirty tracking
  const [savedSnapshot, setSavedSnapshot] = useState<string>('');

  const buildQueryConfig = useCallback(
    () => ({
      search: storeSearch,
      status,
      level,
      sort,
      period: storePeriod || '14d',
      substatus,
      assignedTo,
    }),
    [storeSearch, status, level, sort, storePeriod, substatus, assignedTo]
  );

  const isDirty = useMemo(() => {
    if (!savedSnapshot) return !!currentQueryId; // No snapshot + no saved query = not dirty (initial state)
    return JSON.stringify(buildQueryConfig()) !== savedSnapshot;
  }, [savedSnapshot, buildQueryConfig, currentQueryId]);

  // Load saved query from URL queryId param
  useEffect(() => {
    const urlQueryId = searchParams.get('queryId');
    if (urlQueryId && savedQueries.length > 0) {
      const qId = parseInt(urlQueryId, 10);
      const matched = savedQueries.find((q) => q.id === qId);
      if (matched && matched.id !== currentQueryId) {
        const cfg =
          typeof matched.query_config === 'string'
            ? JSON.parse(matched.query_config)
            : matched.query_config || {};
        setCurrentQueryId(matched.id);
        setQueryName(matched.name);
        if (cfg.search !== undefined) setStoreSearch(cfg.search);
        if (cfg.status !== undefined) setStatus(cfg.status);
        if (cfg.level !== undefined) setLevel(cfg.level);
        if (cfg.sort !== undefined) setSort(cfg.sort);
        if (cfg.substatus !== undefined) setSubstatus(cfg.substatus);
        if (cfg.assignedTo !== undefined) setAssignedTo(cfg.assignedTo);
        setSavedSnapshot(JSON.stringify(cfg));
        setCurrentPage(1);
      }
    }
  }, [searchParams, savedQueries, currentQueryId]);

  // Fetch saved queries
  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await argusService.listSavedQueries(projectId, 'issues');
        setSavedQueries(data);
      } catch {
        /* ignore */
      }
    };
    fetch();
  }, [projectId]);

  const handleSave = useCallback(async () => {
    const config = buildQueryConfig();
    if (currentQueryId) {
      // Update existing query (no dialog)
      try {
        await argusService.updateSavedQuery(projectId, currentQueryId, {
          name: queryName,
          query_config: config,
        });
        setSavedSnapshot(JSON.stringify(config));
        enqueueSnackbar(t('argus.issues.querySaved', 'Query saved'), {
          variant: 'success',
        });
        const data = await argusService.listSavedQueries(projectId, 'issues');
        setSavedQueries(data);
      } catch {
        enqueueSnackbar(t('common.error'), { variant: 'error' });
      }
    } else {
      // New query — always open dialog for name input
      setSaveName('');
      setSaveDialogMode('new');
      setSaveDialogOpen(true);
    }
  }, [
    currentQueryId,
    projectId,
    buildQueryConfig,
    queryName,
    enqueueSnackbar,
    t,
  ]);

  const handleSaveAs = useCallback(() => {
    setSaveName(queryName === defaultQueryName ? '' : queryName);
    setSaveDialogMode('saveAs');
    setSaveDialogOpen(true);
  }, [queryName, defaultQueryName]);

  const handleSaveDialogConfirm = useCallback(async () => {
    if (!saveName.trim()) return;
    const config = buildQueryConfig();
    try {
      // Check for existing query with same name → update instead of duplicate
      const existing = savedQueries.find(
        (q) => q.name.toLowerCase() === saveName.trim().toLowerCase()
      );
      if (existing && saveDialogMode === 'new') {
        // Update existing query
        await argusService.updateSavedQuery(projectId, existing.id, {
          name: saveName.trim(),
          query_config: config,
        });
        setCurrentQueryId(existing.id);
      } else {
        // Create new query
        const result = await argusService.createSavedQuery(projectId, {
          name: saveName.trim(),
          query_type: 'issues',
          query_config: config,
          display_type: 'table',
        });
        setCurrentQueryId(result.id);
      }
      setQueryName(saveName.trim());
      setSavedSnapshot(JSON.stringify(config));
      setSaveDialogOpen(false);
      enqueueSnackbar(t('argus.issues.querySaved', 'Query saved'), {
        variant: 'success',
      });
      const data = await argusService.listSavedQueries(projectId, 'issues');
      setSavedQueries(data);
    } catch {
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
  }, [
    saveName,
    projectId,
    buildQueryConfig,
    savedQueries,
    saveDialogMode,
    enqueueSnackbar,
    t,
  ]);

  const handleLoadSavedQuery = useCallback(
    (sq: ArgusSavedQuery) => {
      const cfg =
        typeof sq.query_config === 'string'
          ? JSON.parse(sq.query_config)
          : sq.query_config || {};
      setCurrentQueryId(sq.id);
      setQueryName(sq.name);
      if (cfg.search !== undefined) setStoreSearch(cfg.search);
      if (cfg.status !== undefined) setStatus(cfg.status);
      if (cfg.level !== undefined) setLevel(cfg.level);
      if (cfg.sort !== undefined) setSort(cfg.sort);
      if (cfg.substatus !== undefined) setSubstatus(cfg.substatus);
      if (cfg.assignedTo !== undefined) setAssignedTo(cfg.assignedTo);
      setSavedSnapshot(JSON.stringify(cfg));
      setCurrentPage(1);
      setSavedPanelOpen(false);
    },
    [
      setStoreSearch,
      setStatus,
      setLevel,
      setSort,
      setSubstatus,
      setAssignedTo,
      setCurrentPage,
    ]
  );

  const handleDeleteSavedQuery = useCallback(
    async (id: number) => {
      try {
        await argusService.deleteSavedQuery(projectId, id);
        setSavedQueries((prev) => prev.filter((q) => q.id !== id));
        if (currentQueryId === id) {
          setCurrentQueryId(null);
          setQueryName(defaultQueryName);
          setSavedSnapshot('');
        }
        enqueueSnackbar(t('argus.issues.queryDeleted', 'Query deleted'), {
          variant: 'success',
        });
      } catch {
        enqueueSnackbar(t('common.error'), { variant: 'error' });
      }
    },
    [projectId, currentQueryId, defaultQueryName, enqueueSnackbar, t]
  );

  // ─── Local-only UI State ────────────────────────────────────────
  const [issues, setIssues] = useState<ArgusIssue[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [facetsLoading, setFacetsLoading] = useState(false);

  // Search is managed directly by Zustand store (no local debounce needed)

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [merging, setMerging] = useState(false);

  const [members, setMembers] = useState<any[]>([]);
  const [assigneeAnchor, setAssigneeAnchor] = useState<{
    el: HTMLElement;
    issue: ArgusIssue;
  } | null>(null);

  // Filter chip popover anchors
  const [sortAnchor, setSortAnchor] = useState<HTMLElement | null>(null);

  // ─── Facet sidebar state ────────────────────────────────────────
  const [facetCollapsed, setFacetCollapsed] = useLocalStorage(
    'argus_issue_facet_collapsed',
    false
  );
  const {
    splitWidth: facetWidth,
    isDragging: isFacetDragging,
    handleMouseDown: handleFacetSplitterMouseDown,
    panelRef: facetPanelRef,
  } = useResizableSplit({
    storageKey: 'argus_issue_facet_width',
    defaultWidth: 220,
    minWidth: 150,
    maxWidth: 400,
  });

  const handleToggleFacetCollapse = useCallback(
    () => setFacetCollapsed((c) => !c),
    [setFacetCollapsed]
  );

  const dslEditorRef = useRef<QueryAQLEditorHandle>(null);

  // ─── Real-time SSE ──────────────────────────────────────────────
  const { newIssueCount, resetNewIssueCount } = useArgusRealtime(
    String(projectId),
    {
      onIssueCreated: () => {},
      onIssueUpdated: () => {},
    }
  );

  // ─── Date / Filter State ────────────────────────────────────────
  const [savedPeriod, setSavedPeriod] = useLocalStorage(
    'argus-issues-period',
    '14d'
  );

  const [filters, setFilters] = useState<ArgusFilterState>(() => {
    // Build initial dateRange from Zustand store (survives back-navigation)
    let initialDateRange: ArgusFilterState['dateRange'] | null = null;
    if (storePeriod === 'custom' && storeCustomStart && storeCustomEnd) {
      const startDate = new Date(storeCustomStart);
      const endDate = new Date(storeCustomEnd);
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        initialDateRange = { type: 'custom', start: startDate, end: endDate };
      }
    }
    if (!initialDateRange) {
      initialDateRange = { type: 'preset', preset: storePeriod || savedPeriod };
    }

    const state = {
      ...defaultArgusFilterState(savedPeriod),
      dateRange: initialDateRange,
    };
    const env = searchParams.get('environment');
    if (env) state.environments = [env];

    const dayOfWeek = searchParams.get('dayOfWeek');
    const hour = searchParams.get('hour');
    if (dayOfWeek && hour) {
      const dow = parseInt(dayOfWeek, 10);
      const h = parseInt(hour, 10);
      const now = new Date();
      const jsDay = dow === 7 ? 0 : dow;
      let diff = now.getDay() - jsDay;
      if (diff < 0) diff += 7;
      if (diff === 0 && now.getHours() < h) diff = 7;
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() - diff);
      const start = new Date(targetDate);
      start.setHours(h, 0, 0, 0);
      const end = new Date(start);
      end.setHours(h + 1, 0, 0, 0);
      state.dateRange = { type: 'custom', start, end };
    }

    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    if (startParam && endParam) {
      const startDate = new Date(startParam);
      const endDate = new Date(endParam);
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        state.dateRange = { type: 'custom', start: startDate, end: endDate };
      }
    }

    return state;
  });

  // ─── Members fetch ──────────────────────────────────────────────
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const data = await rbacService.getProjectMembers(String(projectId));
        setMembers(data);
      } catch (error) {
        console.error('Failed to fetch project members:', error);
      }
    };
    fetchMembers();
  }, [projectId]);

  // ─── Fetch issues ──────────────────────────────────────────────
  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      const dateParams = argusDateRangeToApiParams(filters.dateRange);
      const params: ArgusIssueListParams = {
        status: status || undefined,
        level: level || undefined,
        sort,
        limit: rowsPerPage,
        offset: (currentPage - 1) * rowsPerPage,
        query: storeSearch.trim()
          ? resolveSearchMagicValues(storeSearch.trim(), {
              userName: user?.name,
            })
          : undefined,
        ...dateParams,
        substatus: substatus || undefined,
        assigned_to: assignedTo || undefined,
      };
      const result = await argusService.listIssues(projectId, params);
      setIssues(result.data);
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to fetch issues:', error);
      setIssues([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    projectId,
    status,
    level,
    sort,
    currentPage,
    rowsPerPage,
    storeSearch,
    filters,
    substatus,
    assignedTo,
  ]);



  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  // ─── Handlers ──────────────────────────────────────────────────

  const handleFilterChange = (newFilters: ArgusFilterState) => {
    setFilters(newFilters);
    if (newFilters.dateRange.type === 'preset' && newFilters.dateRange.preset) {
      setSavedPeriod(newFilters.dateRange.preset);
      setStorePeriod(newFilters.dateRange.preset);
    } else if (
      newFilters.dateRange.type === 'custom' &&
      newFilters.dateRange.start &&
      newFilters.dateRange.end
    ) {
      setStoreCustomDateRange(
        newFilters.dateRange.start.toISOString(),
        newFilters.dateRange.end.toISOString()
      );
    }
  };

  const handlePageChange = (_: unknown, page: number) => {
    setCurrentPage(page);
  };

  const handleIssueClick = (issue: ArgusIssue) => {
    navigate(`/argus/issues/${projectId}/${issue.id}`);
  };

  const handleAssignIssue = async (
    issueId: number | undefined,
    assignee: string
  ) => {
    if (!issueId) return;
    try {
      await argusService.assignIssue(projectId, issueId, assignee || null);
      setIssues((prev) =>
        prev.map((issue) =>
          issue.id === issueId
            ? { ...issue, assigned_to: assignee || null }
            : issue
        )
      );
      enqueueSnackbar(t('argus.issues.assigneeUpdated'), {
        variant: 'success',
      });
    } catch {
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
    setAssigneeAnchor(null);
  };

  const handleMerge = async () => {
    if (selectedIds.size < 2) return;
    setMerging(true);
    try {
      await argusService.mergeIssues(projectId, Array.from(selectedIds));
      setSelectedIds(new Set());
      enqueueSnackbar(t('argus.issues.mergeSuccess'), { variant: 'success' });
      fetchIssues();
    } catch {
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    } finally {
      setMerging(false);
    }
  };

  const handleBulkAction = async (action: 'resolved' | 'ignored') => {
    if (selectedIds.size === 0) return;
    try {
      await argusService.bulkUpdateIssues(projectId, Array.from(selectedIds), {
        status: action,
      });
      setSelectedIds(new Set());
      enqueueSnackbar(
        t('argus.issues.bulkSuccess', {
          count: selectedIds.size,
          action: t(`argus.issues.${action}`, action),
        }),
        { variant: 'success' }
      );
      fetchIssues();
    } catch {
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(t('argus.detail.deleteConfirmMessage'))) return;
    try {
      for (const id of selectedIds) {
        await argusService.deleteIssue(String(projectId), String(id));
      }
      setSelectedIds(new Set());
      fetchIssues();
    } catch (e) {
      console.error('Failed to delete issues:', e);
    }
  };

  const handleViewChange = (view: IssueView) => {
    setActiveViewId(view.id);
    setCurrentPage(1);

    // Apply view-specific params to store
    const viewStatus = view.urlParams.status || '';
    const viewSubstatus = view.urlParams.substatus || '';
    const viewAssignedTo = view.urlParams.assigned_to
      ? view.urlParams.assigned_to === '__me__'
        ? user?.name || ''
        : view.urlParams.assigned_to
      : '';

    setStatus(viewStatus);
    setSubstatus(viewSubstatus);
    setAssignedTo(viewAssignedTo);
  };

  const handleDateRangeSelect = (start: Date, end: Date) => {
    setFilters((prev) => ({
      ...prev,
      dateRange: { type: 'custom', start, end },
    }));
    setStoreCustomDateRange(start.toISOString(), end.toISOString());
    setCurrentPage(1);
  };

  const handleCheckChange = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleAssigneeClick = useCallback(
    (e: React.MouseEvent, iss: ArgusIssue) => {
      setAssigneeAnchor({
        el: e.currentTarget as HTMLElement,
        issue: iss,
      });
    },
    []
  );

  // ─── Stable callback handlers (for React.memo) ─────────────────

  const handleSortOpen = useCallback(
    (e: React.MouseEvent<HTMLElement>) => setSortAnchor(e.currentTarget),
    []
  );
  const handleSortClose = useCallback(() => setSortAnchor(null), []);
  const handleSortSelect = useCallback((v: string) => setSort(v), [setSort]);

  const handleBulkResolve = useCallback(
    () => handleBulkAction('resolved'),
    [handleBulkAction]
  );
  const handleBulkIgnore = useCallback(
    () => handleBulkAction('ignored'),
    [handleBulkAction]
  );
  const handleBulkCancel = useCallback(() => setSelectedIds(new Set()), []);

  const handleNewIssuesClick = useCallback(() => {
    resetNewIssueCount();
    fetchIssues();
  }, [resetNewIssueCount, fetchIssues]);

  const handleAssigneeMenuClose = useCallback(
    () => setAssigneeAnchor(null),
    []
  );

  // ─── Filter options ────────────────────────────────────────────

  const sortOptions = getSortOptions(t);

  // Lazy-loading callback for QueryAQLEditor: fetch values for a specific field on demand
  // Uses the errors table (not logs) so release/environment values match error events.
  const fetchFieldValues = useCallback(
    async (fieldKey: string): Promise<string[]> => {
      try {
        const dateParams = argusDateRangeToApiParams(filters.dateRange);
        const data = await argusService.getIssueAttributeFacet(
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

  // ─── Facet data (separate fetch without activeFilters) ───
  const [facetData, setFacetData] = useState<FacetCounts>(EMPTY_FACET_COUNTS);
  const [discoveredTags, setDiscoveredTags] = useState<Record<string, { value: string; count: number }[]>>({});

   const fetchFacets = useCallback(async () => {
    setFacetsLoading(true);
    try {
      const dateParams = argusDateRangeToApiParams(filters.dateRange);
      const params: ArgusIssueListParams = {
        status: status || undefined,
        level: level || undefined,
        sort,
        limit: 1000,
        offset: 0,
        query: storeSearch
          ? resolveSearchMagicValues(storeSearch, { userName: user?.name })
          : undefined,
        ...dateParams,
        substatus: substatus || undefined,
        assigned_to: assignedTo || undefined,
      };

      // Fetch MySQL-based issue counts + ClickHouse event facets + discovered tags in parallel
      const [result, chFacets, discoveredData] = await Promise.all([
        argusService.listIssues(projectId, params),
        argusService.getIssueFacets(projectId, dateParams).catch(() => ({})),
        argusService.discoverTags(projectId, 'errors').catch(() => ({ tags: {} })),
      ]);

      const issueFacets = buildFacetCounts(result.data);
      setFacetData({
        ...issueFacets,
        // Merge ClickHouse event-level facets
        release: (chFacets as any).release || [],
        environment: (chFacets as any).environment || [],
        browser_name: (chFacets as any).browser_name || [],
        os_name: (chFacets as any).os_name || [],
      });
      setDiscoveredTags(discoveredData.tags || {});
    } catch {
      /* ignore */
    } finally {
      setFacetsLoading(false);
    }
  }, [
    projectId,
    filters,
    status,
    level,
    sort,
    storeSearch,
    substatus,
    assignedTo,
  ]);

  // Fetch facets on base filter changes (NOT on activeFilters change)
  useEffect(() => {
    fetchFacets();
  }, [fetchFacets]);

  const mappedFacets = facetData;

  // Hardcoded facets (MySQL + ClickHouse columns)
  const baseFacetKeys = new Set([
    'level', 'status', 'platform', 'assigned_to', 'priority',
    'release', 'environment', 'browser_name', 'os_name',
  ]);

  const facetGroups: FacetGroup[] = useMemo(
    () => {
      const base: FacetGroup[] = [
        {
          key: 'level',
          label: t('argus.issues.level', 'Level'),
          values: mappedFacets.level,
        },
        {
          key: 'status',
          label: t('argus.issues.status', 'Status'),
          values: mappedFacets.status,
        },
        {
          key: 'platform',
          label: t('argus.issues.platform', 'Platform'),
          values: mappedFacets.platform,
        },
        {
          key: 'assigned_to',
          label: t('argus.issues.assignee', 'Assignee'),
          values: mappedFacets.assigned_to,
        },
        {
          key: 'priority',
          label: t('argus.issues.priority', 'Priority'),
          values: mappedFacets.priority,
        },
        // ClickHouse event-level facets
        {
          key: 'release',
          label: t('argus.issues.release', 'Release'),
          values: mappedFacets.release,
        },
        {
          key: 'environment',
          label: t('argus.issues.environment', 'Environment'),
          values: mappedFacets.environment,
        },
        {
          key: 'browser_name',
          label: t('argus.issues.browser', 'Browser'),
          values: mappedFacets.browser_name,
        },
        {
          key: 'os_name',
          label: t('argus.issues.os', 'OS'),
          values: mappedFacets.os_name,
        },
      ].filter((g) => g.values.length > 0);

      // Append discovered tags from Map columns (skip if already in base facets)
      const discovered: FacetGroup[] = Object.entries(discoveredTags)
        .filter(([key, values]) => !baseFacetKeys.has(key) && values.length > 0)
        .map(([key, values]) => ({
          key,
          label: t(`argus.facet.${key}`, key),
          values: values.map((v) => ({ value: v.value, count: Number(v.count) })),
        }));

      return [...base, ...discovered];
    },
    [mappedFacets, discoveredTags, t]
  );

  // Merge discovered tag keys with base facets for AQL autocomplete
  const mergedFacets = useMemo(() => {
    const res: Record<string, any> = { ...facetData };
    for (const [key, values] of Object.entries(discoveredTags)) {
      if (!res[key]) {
        res[key] = values;
      }
    }
    return res;
  }, [facetData, discoveredTags]);

  // ─── Custom Facets (user-defined attribute keys) ───
  const CUSTOM_FACETS_KEY = 'argus_issue_custom_facets';
  const [customFacetKeys, setCustomFacetKeys] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(CUSTOM_FACETS_KEY) || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(CUSTOM_FACETS_KEY, JSON.stringify(customFacetKeys));
  }, [customFacetKeys]);

  const customFacetData: FacetGroup[] = useMemo(() => {
    if (customFacetKeys.length === 0) return [];
    // For issues, custom facets try to count by arbitrary issue field
    return customFacetKeys.map((key) => {
      const counts = new Map<string, number>();
      issues.forEach((issue) => {
        const val = (issue as any)[key];
        if (val != null && val !== '') {
          const k = String(val);
          counts.set(k, (counts.get(k) || 0) + 1);
        }
      });
      return {
        key: `attr.${key}`,
        label: key,
        values: Array.from(counts.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count),
      } as FacetGroup;
    });
  }, [customFacetKeys, issues]);

  const handleAddCustomFacet = useCallback((key: string) => {
    setCustomFacetKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }, []);

  const handleRemoveCustomFacet = useCallback((facetKey: string) => {
    const realKey = facetKey.startsWith('attr.') ? facetKey.slice(5) : facetKey;
    setCustomFacetKeys((prev) => prev.filter((k) => k !== realKey));
  }, []);

  // ─── Render ────────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        icon={<ArgusIcon />}
        title={
          <ArgusBreadcrumbs
            size="title"
            paths={[
              { label: currentQueryId ? queryName : t('argus.issues.title') },
            ]}
          />
        }
        subtitle={t('argus.issues.subtitle')}
        actionsUpdateTrigger={`${isDirty}-${currentQueryId}-${savedQueries.length}`}
        actions={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {!loading && total > 0 && (
              <Chip
                label={`${formatCompactNumber(total)} ${t('argus.issues.issuesLabel')}`}
                size="small"
                sx={{
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  height: 22,
                  backgroundColor: alpha(theme.palette.error.main, 0.1),
                  color: theme.palette.error.main,
                  border: 'none',
                }}
              />
            )}
            <Tooltip
              title={t('argus.issues.savedQueries', 'Saved Issue Queries')}
            >
              <MuiIconButton
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
              </MuiIconButton>
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
              {t('argus.issues.save', 'Save')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<SaveIcon sx={{ fontSize: 15 }} />}
              onClick={handleSaveAs}
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
              {t('argus.issues.saveAs', 'Save as...')}
            </Button>
          </Box>
        }
      />

      <IssueViewTabs
        activeViewId={activeViewId}
        onViewChange={handleViewChange}
        currentUser={user?.name}
        onSaveCurrentAsView={() => {}}
      />

      <ArgusFilterBar
        projectId={String(projectId)}
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
        loading={loading}
        extraControls={
          <>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <QueryAQLEditor
                ref={dslEditorRef}
                config={ISSUES_CONFIG}
                initialQuery={storeSearch}
                placeholder={t(
                  'argus.issues.searchPlaceholder',
                  'Search by title, message, or severity...'
                )}
                onSearch={(val) => {
                  setStoreSearch(val);
                  setCurrentPage(1);
                }}
                onChange={(val) => {
                  setStoreSearch(val);
                  setCurrentPage(1);
                }}
                fetchFieldValues={fetchFieldValues}
                initialFacets={mergedFacets}
              />
            </Box>

            <FilterChipSelect
              label={t('argus.issues.sort')}
              value={sort}
              options={sortOptions}
              anchorEl={sortAnchor}
              onOpen={handleSortOpen}
              onClose={handleSortClose}
              onSelect={handleSortSelect}
              sx={{ height: 32 }}
            />
          </>
        }
      />

      {/* ── Body: Sidebar + Content split ── */}
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
          borderRadius: 2,
        }}
      >
        {/* Left: Facet Sidebar */}
        <Box sx={{ display: 'flex', flexShrink: 0, position: 'relative' }}>
          <FacetSidebar
            ref={facetPanelRef as React.Ref<HTMLDivElement>}
            width={facetWidth}
            facets={facetGroups}
            onFilter={(key, value) => {
              const r = dslEditorRef.current;
              if (!r) return;
              const current = r.getFieldValues(key);
              if (current.includes(value)) {
                r.upsertFieldChip(
                  key,
                  current.filter((v) => v !== value)
                );
              } else {
                r.upsertFieldChip(key, [...current, value]);
              }
            }}
            collapsed={facetCollapsed}
            onToggleCollapse={handleToggleFacetCollapse}
            loading={facetsLoading || loading}
            customFacets={customFacetData}
            onAddCustomFacet={handleAddCustomFacet}
            onRemoveCustomFacet={handleRemoveCustomFacet}
          />
          {!facetCollapsed && (
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

        {/* Right: Main content */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            p: 2,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Volume Chart - fixed at top (hidden when no issues) */}
          {(loading || issues.length > 0) && (
            <Box sx={{ flexShrink: 0 }}>
              <IssueVolumeChart
                projectId={projectId}
                filters={filters}
                status={status}
                level={level}
                query={storeSearch.trim() || undefined}
                onDateRangeSelect={handleDateRangeSelect}
              />
            </Box>
          )}

          {/* Scrollable issue list area */}
          <Box
            sx={{
              flex: 1,
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Bulk Actions */}
            <IssueBulkActions
              selectedIds={selectedIds}
              merging={merging}
              onResolve={handleBulkResolve}
              onIgnore={handleBulkIgnore}
              onMerge={handleMerge}
              onDelete={handleBulkDelete}
              onCancel={handleBulkCancel}
            />

            {/* Real-time new issues banner */}
            <NewIssuesBanner
              count={newIssueCount}
              onClick={handleNewIssuesClick}
            />

            <PageContentLoader
              loading={loading && issues.length === 0}
              sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
            >
              {issues.length === 0 ? (
                <EmptyPlaceholder
                  icon={<ArgusIcon sx={{ fontSize: 48 }} />}
                  message={t('argus.issues.noIssues')}
                  description={t(
                    'argus.issues.noIssuesDescription',
                    '검색 조건을 변경하거나 필터를 해제해 보세요.'
                  )}
                  variant="text"
                  sx={{ flex: 1 }}
                />
              ) : (
                <>
                  <Paper
                    elevation={0}
                    sx={{
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                      borderRadius: 2,
                      overflow: 'auto',
                      flex: 1,
                      opacity: loading ? 0.55 : 1,
                      transition: 'opacity 0.15s ease',
                      pointerEvents: loading ? 'none' : 'auto',
                    }}
                  >
                    {issues.map((issue, idx) => (
                      <IssueListItem
                        key={issue.id}
                        issue={issue}
                        onClick={handleIssueClick}
                        highlight={storeSearch}
                        showCheckbox
                        checked={selectedIds.has(issue.id)}
                        onCheckChange={handleCheckChange}
                        showAssignee
                        onAssigneeClick={handleAssigneeClick}
                        showSparkline
                        showLastSeen
                        isFirst={idx === 0}
                        isLast={idx === issues.length - 1}
                        showDivider={idx < issues.length - 1}
                      />
                    ))}
                  </Paper>

                  {total > 0 && (
                    <Box sx={{ mt: 2, flexShrink: 0 }}>
                      <SimplePagination
                        count={total}
                        page={currentPage - 1}
                        rowsPerPage={rowsPerPage}
                        onPageChange={(_, newPage) =>
                          handlePageChange(_, newPage + 1)
                        }
                        onRowsPerPageChange={(e) => {
                          setRowsPerPage(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        size="small"
                      />
                    </Box>
                  )}
                </>
              )}
            </PageContentLoader>
          </Box>
          {/* end scrollable area */}
        </Box>
        {/* end right content area */}
      </Box>
      {/* end flex sidebar container */}

      {/* Assignee Menu */}
      <IssueAssigneeMenu
        anchor={assigneeAnchor}
        members={members}
        onClose={handleAssigneeMenuClose}
        onAssign={handleAssignIssue}
      />

      {/* Save Query Dialog */}
      <SaveQueryDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        saveName={saveName}
        onNameChange={setSaveName}
        onSave={handleSaveDialogConfirm}
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

export default ArgusIssuesPage;
