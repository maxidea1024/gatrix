import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { Box, Typography, Paper, Chip, useTheme, alpha } from '@mui/material';
import PageContentLoader from '@/components/common/PageContentLoader';
import { ListSkeleton } from '@/components/argus/ArgusSkeletons';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import { BugReport as BugReportIcon } from '@mui/icons-material';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import argusService, {
  ArgusIssue,
  ArgusIssueListParams,
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

import { QueryDSLEditor, ISSUES_CONFIG } from '@/components/argus/query-dsl';
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
import {
  PAGE_SIZE_STORAGE_KEY,
  DEFAULT_PAGE_SIZE,
  VALID_PAGE_SIZES,
  DEEP_LINK_KEYS,
  type ActiveFilter,
  getStatusOptions,
  getLevelOptions,
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
  const [rowsPerPage, setRowsPerPage] = useState(() => {
    const saved = parseInt(
      localStorage.getItem(PAGE_SIZE_STORAGE_KEY) || '',
      10
    );
    if (!isNaN(saved) && VALID_PAGE_SIZES.includes(saved)) return saved;
    return DEFAULT_PAGE_SIZE;
  });

  // ─── Local-only UI State ────────────────────────────────────────
  const [issues, setIssues] = useState<ArgusIssue[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Search is managed directly by Zustand store (no local debounce needed)

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [merging, setMerging] = useState(false);

  const [members, setMembers] = useState<any[]>([]);
  const [assigneeAnchor, setAssigneeAnchor] = useState<{
    el: HTMLElement;
    issue: ArgusIssue;
  } | null>(null);

  // Filter chip popover anchors
  const [statusAnchor, setStatusAnchor] = useState<HTMLElement | null>(null);
  const [levelAnchor, setLevelAnchor] = useState<HTMLElement | null>(null);
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

  // ─── Active Filters (chip tags from facet sidebar) ─────────────
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);

  const toggleActiveFilter = useCallback(
    (key: string, value: string, exclude: boolean = false) => {
      setActiveFilters((prev) => {
        const idx = prev.findIndex(
          (f) => f.key === key && f.value === value && f.exclude === exclude
        );
        if (idx >= 0) {
          return prev.map((f, i) =>
            i === idx ? { ...f, enabled: !f.enabled } : f
          );
        }
        return [...prev, { key, value, exclude, enabled: true }];
      });
    },
    []
  );

  const removeActiveFilter = useCallback((idx: number) => {
    setActiveFilters((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const clearAllActiveFilters = useCallback(() => {
    setActiveFilters([]);
  }, []);

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
    const br = searchParams.get('browser');
    const osParam = searchParams.get('os');
    if (env) state.environments = [env];
    if (br) state.browsers = [br];
    if (osParam) state.os = [osParam];

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
  /** Merge search text + active chip filters into a single query string */
  const buildSearchWithFilters = useCallback((): string | undefined => {
    const parts: string[] = [];
    if (storeSearch.trim()) parts.push(storeSearch.trim());
    for (const f of activeFilters) {
      if (!f.enabled) continue;
      parts.push(`${f.exclude ? '!' : ''}${f.key}:${f.value}`);
    }
    return parts.length > 0 ? parts.join(' ') : undefined;
  }, [storeSearch, activeFilters]);

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
        query: buildSearchWithFilters(),
        environment:
          filters.environments.length === 1
            ? filters.environments[0]
            : undefined,
        browser:
          filters.browsers.length === 1 ? filters.browsers[0] : undefined,
        os: filters.os.length === 1 ? filters.os[0] : undefined,
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
    buildSearchWithFilters,
    filters,
    substatus,
    assignedTo,
  ]);

  // Persist page size
  useEffect(() => {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(rowsPerPage));
  }, [rowsPerPage]);

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
  const handleStatusOpen = useCallback(
    (e: React.MouseEvent<HTMLElement>) => setStatusAnchor(e.currentTarget),
    []
  );
  const handleStatusClose = useCallback(() => setStatusAnchor(null), []);
  const handleStatusSelect = useCallback(
    (v: string) => {
      setStatus(v);
      setCurrentPage(1);
    },
    [setStatus, setCurrentPage]
  );

  const handleLevelOpen = useCallback(
    (e: React.MouseEvent<HTMLElement>) => setLevelAnchor(e.currentTarget),
    []
  );
  const handleLevelClose = useCallback(() => setLevelAnchor(null), []);
  const handleLevelSelect = useCallback(
    (v: string) => {
      setLevel(v);
      setCurrentPage(1);
    },
    [setLevel, setCurrentPage]
  );

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

  const statusOptions = getStatusOptions(t);
  const levelOptions = getLevelOptions(t);
  const sortOptions = getSortOptions(t);

  // Lazy-loading callback for QueryDSLEditor: fetch values for a specific field on demand
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

  // ─── Facet data (separate fetch without activeFilters) ───
  const [facetData, setFacetData] = useState<FacetCounts>(EMPTY_FACET_COUNTS);

  const fetchFacets = useCallback(async () => {
    try {
      const dateParams = argusDateRangeToApiParams(filters.dateRange);
      const params: ArgusIssueListParams = {
        status: status || undefined,
        level: level || undefined,
        sort,
        limit: 1000,
        offset: 0,
        query: storeSearch || undefined,
        ...dateParams,
        substatus: substatus || undefined,
        assigned_to: assignedTo || undefined,
      };
      const result = await argusService.listIssues(projectId, params);
      setFacetData(buildFacetCounts(result.data));
    } catch {
      /* ignore */
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

  const facetGroups: FacetGroup[] = useMemo(
    () =>
      [
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
      ].filter((g) => g.values.length > 0),
    [mappedFacets, t]
  );

  // Re-fetch displayed issues when activeFilters change
  useEffect(() => {
    fetchIssues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilters]);

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
        icon={<BugReportIcon />}
        title={
          <ArgusBreadcrumbs
            size="title"
            paths={[{ label: t('argus.issues.title') }]}
          />
        }
        subtitle={t('argus.issues.subtitle')}
        actions={
          !loading &&
          total > 0 && (
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
          )
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
        onChange={handleFilterChange}
        onRefresh={fetchIssues}
        loading={loading}
        extraControls={
          <>
            <Box
              sx={{
                height: 20,
                borderLeft: '1px solid',
                borderColor: 'divider',
                mx: 0.25,
              }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <QueryDSLEditor
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
              />
            </Box>
            <FilterChipSelect
              label={t('argus.issues.status')}
              value={status}
              options={statusOptions}
              anchorEl={statusAnchor}
              onOpen={handleStatusOpen}
              onClose={handleStatusClose}
              onSelect={handleStatusSelect}
              sx={{ height: 32 }}
            />
            <FilterChipSelect
              label={t('argus.issues.level')}
              value={level}
              options={levelOptions}
              anchorEl={levelAnchor}
              onOpen={handleLevelOpen}
              onClose={handleLevelClose}
              onSelect={handleLevelSelect}
              sx={{ height: 32 }}
            />
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

      {/* ── Active Filter Chips ── */}
      {activeFilters.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0.5,
            px: 2,
            py: 0.75,
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.01)'
              : 'rgba(0,0,0,0.01)',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          {activeFilters.map((f, idx) => (
            <Chip
              key={`${f.key}-${f.value}-${f.exclude}-${idx}`}
              label={`${f.key}${f.exclude ? ' ≠ ' : ': '}${f.value}`}
              size="small"
              onClick={() => {
                setActiveFilters((prev) =>
                  prev.map((item, i) =>
                    i === idx ? { ...item, enabled: !item.enabled } : item
                  )
                );
              }}
              onDelete={() => removeActiveFilter(idx)}
              sx={{
                height: 24,
                fontSize: '0.73rem',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: !f.enabled
                  ? isDark
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(0,0,0,0.04)'
                  : f.exclude
                    ? alpha(theme.palette.error.main, 0.12)
                    : alpha(theme.palette.primary.main, 0.1),
                color: !f.enabled
                  ? 'text.disabled'
                  : f.exclude
                    ? theme.palette.error.main
                    : theme.palette.primary.main,
                borderRadius: '6px',
                opacity: f.enabled ? 1 : 0.55,
                textDecoration: f.enabled ? 'none' : 'line-through',
                transition: 'all 0.15s ease',
                '& .MuiChip-label': {
                  textDecoration: f.enabled ? 'none' : 'line-through',
                },
                '& .MuiChip-deleteIcon': {
                  fontSize: 14,
                  color: !f.enabled
                    ? 'text.disabled'
                    : f.exclude
                      ? theme.palette.error.main
                      : theme.palette.primary.main,
                  opacity: 0.6,
                  '&:hover': { opacity: 1 },
                },
              }}
            />
          ))}
          <Typography
            component="span"
            onClick={clearAllActiveFilters}
            sx={{
              fontSize: '0.7rem',
              color: 'text.disabled',
              cursor: 'pointer',
              ml: 0.5,
              '&:hover': {
                color: 'text.secondary',
                textDecoration: 'underline',
              },
            }}
          >
            {t('argus.logs.clearAll', 'Clear all')}
          </Typography>
        </Box>
      )}

      {/* ── Body: Sidebar + Content split ── */}
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          borderTop:
            activeFilters.length === 0
              ? `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`
              : 'none',
        }}
      >
        {/* Left: Facet Sidebar */}
        <Box sx={{ display: 'flex', flexShrink: 0, position: 'relative' }}>
          <FacetSidebar
            width={facetWidth}
            facets={facetGroups}
            onFilter={toggleActiveFilter}
            collapsed={facetCollapsed}
            onToggleCollapse={handleToggleFacetCollapse}
            loading={loading}
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
            pl: facetCollapsed ? 0.25 : 0.75,
            pt: 1,
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
                query={buildSearchWithFilters()}
                environment={
                  filters.environments.length === 1
                    ? filters.environments[0]
                    : undefined
                }
                browser={
                  filters.browsers.length === 1
                    ? filters.browsers[0]
                    : undefined
                }
                os={filters.os.length === 1 ? filters.os[0] : undefined}
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
              loading={loading}
              skeleton={<ListSkeleton rows={8} />}
              sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              {issues.length === 0 ? (
                <EmptyPlaceholder
                  icon={<BugReportIcon sx={{ fontSize: 48 }} />}
                  message={t('argus.issues.noIssues')}
                  sx={{ flex: 1 }}
                />
              ) : (
                <>
                  <Paper
                    elevation={0}
                    sx={{
                      mb: 2,
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                      borderRadius: 2,
                      overflow: 'hidden',
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
                    <Box sx={{ mt: 3 }}>
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
    </Box>
  );
};

export default ArgusIssuesPage;
