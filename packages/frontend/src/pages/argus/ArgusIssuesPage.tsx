import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  TextField,
  InputAdornment,
  useTheme,
  alpha,
  Tooltip,
  IconButton,
} from '@mui/material';
import PageContentLoader from '@/components/common/PageContentLoader';
import { ListSkeleton } from '@/components/argus/ArgusSkeletons';
import {
  Search as SearchIcon,
  BugReport as BugReportIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
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
import ArgusFilterBar, { ArgusFilterState, defaultArgusFilterState } from '@/components/argus/ArgusFilterBar';
import { dateRangeToApiParams as argusDateRangeToApiParams } from '@/components/common/DateRangeSelector';
import useLocalStorage from '@/hooks/useLocalStorage';
import { formatCompactNumber } from '@/utils/numberFormat';
import SimplePagination from '@/components/common/SimplePagination';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import PageHeader from '@/components/common/PageHeader';
import IssueViewTabs, { IssueView } from '@/components/argus/IssueViewTabs';
import ArgusQueryBuilder from '@/components/argus/ArgusQueryBuilder';
import { ArgusSearchInput } from '@/components/argus/ArgusSearchInput';
import SavedSearchesSidebar, { SavedSearch } from '@/components/argus/SavedSearchesSidebar';
import { useArgusRealtime } from '@/hooks/useArgusRealtime';
import FilterChipSelect from '@/components/common/FilterChipSelect';
import IssueListItem from '@/components/argus/IssueListItem';
import IssueVolumeChart from './components/IssueVolumeChart';
import IssueBulkActions from './components/IssueBulkActions';
import IssueAssigneeMenu from './components/IssueAssigneeMenu';
import NewIssuesBanner from './components/NewIssuesBanner';
import { useArgusIssueStore } from '@/hooks/useArgusIssueStore';

const PAGE_SIZE_STORAGE_KEY = 'argusIssues.pageSize';
const DEFAULT_PAGE_SIZE = 25;
const VALID_PAGE_SIZES = [5, 10, 15, 20, 25, 50, 100];

const QUERY_BUILDER_FIELDS = [
  'level', 'status', 'platform', 'browser', 'os', 'device',
  'environment', 'release', 'assigned', 'times_seen', 'user_count',
];

/** URL param keys that, when present, signal a deep-link / cross-page intent. */
const DEEP_LINK_KEYS = ['page', 'search', 'status', 'level', 'sort', 'view', 'substatus', 'assigned_to'];

interface ArgusIssuesPageProps {
  projectId?: string | number;
}

const ArgusIssuesPage: React.FC<ArgusIssuesPageProps> = ({ projectId: propProjectId }) => {
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

  const setCurrentPage = useArgusIssueStore((s) => s.setCurrentPage);
  const setStoreSearch = useArgusIssueStore((s) => s.setSearch);
  const setStatus = useArgusIssueStore((s) => s.setStatus);
  const setLevel = useArgusIssueStore((s) => s.setLevel);
  const setSort = useArgusIssueStore((s) => s.setSort);
  const setActiveViewId = useArgusIssueStore((s) => s.setActiveViewId);
  const setSubstatus = useArgusIssueStore((s) => s.setSubstatus);
  const setAssignedTo = useArgusIssueStore((s) => s.setAssignedTo);
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
  const projectId = propProjectId || searchParams.get('projectId') || currentProject?.id || '1';
  const [rowsPerPage, setRowsPerPage] = useState(() => {
    const saved = parseInt(localStorage.getItem(PAGE_SIZE_STORAGE_KEY) || '', 10);
    if (!isNaN(saved) && VALID_PAGE_SIZES.includes(saved)) return saved;
    return DEFAULT_PAGE_SIZE;
  });

  // ─── Local-only UI State ────────────────────────────────────────
  const [issues, setIssues] = useState<ArgusIssue[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Local input mirror — follows Zustand for initial value, debounced into store
  const [searchInput, setSearchInput] = useState(storeSearch);
  const [searchDebounce, setSearchDebounce] = useState(storeSearch);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [merging, setMerging] = useState(false);
  const [queryBuilderAnchor, setQueryBuilderAnchor] = useState<HTMLElement | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [assigneeAnchor, setAssigneeAnchor] = useState<{ el: HTMLElement; issue: ArgusIssue } | null>(null);

  // Filter chip popover anchors
  const [statusAnchor, setStatusAnchor] = useState<HTMLElement | null>(null);
  const [levelAnchor, setLevelAnchor] = useState<HTMLElement | null>(null);
  const [sortAnchor, setSortAnchor] = useState<HTMLElement | null>(null);

  // ─── Real-time SSE ──────────────────────────────────────────────
  const { newIssueCount, resetNewIssueCount } = useArgusRealtime(
    String(projectId),
    {
      onIssueCreated: () => {},
      onIssueUpdated: () => {},
    }
  );

  // ─── Date / Filter State ────────────────────────────────────────
  const [savedPeriod, setSavedPeriod] = useLocalStorage('argus-issues-period', '14d');

  const [filters, setFilters] = useState<ArgusFilterState>(() => {
    const state = defaultArgusFilterState(savedPeriod);
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

  // ─── Sync local search input when store changes externally ─────
  // (e.g. via hydration, reset, or saved-searches sidebar)
  useEffect(() => {
    setSearchInput(storeSearch);
  }, [storeSearch]);

  // ─── Debounce search input → store ─────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounce(searchInput);
      // Commit debounced value to Zustand if different from current store value
      if (searchInput !== storeSearch) {
        setStoreSearch(searchInput);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, storeSearch, setStoreSearch]);

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
        query: searchDebounce || undefined,
        environment: filters.environments.length === 1 ? filters.environments[0] : undefined,
        browser: filters.browsers.length === 1 ? filters.browsers[0] : undefined,
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
  }, [projectId, status, level, sort, currentPage, rowsPerPage, searchDebounce, filters, substatus, assignedTo]);

  // Persist page size
  useEffect(() => {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(rowsPerPage));
  }, [rowsPerPage]);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  // ─── Handlers ──────────────────────────────────────────────────

  const handleFilterChange = (newFilters: ArgusFilterState) => {
    setFilters(newFilters);
    if (newFilters.dateRange.type === 'preset' && newFilters.dateRange.preset) {
      setSavedPeriod(newFilters.dateRange.preset);
    }
  };

  const handlePageChange = (_: unknown, page: number) => {
    setCurrentPage(page);
  };

  const handleIssueClick = (issue: ArgusIssue) => {
    navigate(`/argus/issues/${projectId}/${issue.id}`);
  };

  const handleAssignIssue = async (issueId: number | undefined, assignee: string) => {
    if (!issueId) return;
    try {
      await argusService.assignIssue(projectId, issueId, assignee || null);
      setIssues(prev => prev.map(issue => issue.id === issueId ? { ...issue, assigned_to: assignee || null } : issue));
      enqueueSnackbar(t('argus.issues.assigneeUpdated'), { variant: 'success' });
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
      await argusService.bulkUpdateIssues(projectId, Array.from(selectedIds), { status: action });
      setSelectedIds(new Set());
      enqueueSnackbar(
        t('argus.issues.bulkSuccess', { count: selectedIds.size, action: t(`argus.issues.${action}`, action) }),
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
      ? (view.urlParams.assigned_to === '__me__' ? (user?.name || '') : view.urlParams.assigned_to)
      : '';

    setStatus(viewStatus);
    setSubstatus(viewSubstatus);
    setAssignedTo(viewAssignedTo);
  };

  const handleQueryBuilderApply = (query: string) => {
    setSearchInput(query);
    setStoreSearch(query);
    setCurrentPage(1);
  };

  const handleDateRangeSelect = (start: Date, end: Date) => {
    setFilters(prev => ({
      ...prev,
      dateRange: { type: 'custom', start, end },
    }));
    setCurrentPage(1);
  };

  // ─── Filter options ────────────────────────────────────────────

  const statusOptions = [
    { value: '', label: t('common.all') },
    { value: 'unresolved', label: t('argus.issues.unresolved'), color: '#f44336' },
    { value: 'resolved', label: t('argus.issues.resolved'), color: '#4caf50' },
    { value: 'ignored', label: t('argus.issues.ignored'), color: '#9e9e9e' },
  ];
  const levelOptions = [
    { value: '', label: t('common.all') },
    { value: 'fatal', label: t('argus.issues.fatal'), color: '#f44336' },
    { value: 'error', label: t('argus.issues.error'), color: '#ff5722' },
    { value: 'warning', label: t('argus.issues.warning'), color: '#ff9800' },
    { value: 'info', label: t('argus.issues.info'), color: '#2196f3' },
  ];
  const sortOptions = [
    { value: 'last_seen', label: t('argus.issues.lastSeen') },
    { value: 'first_seen', label: t('argus.issues.firstSeen') },
    { value: 'event_count', label: t('argus.issues.events') },
    { value: 'user_count', label: t('argus.issues.users') },
    { value: 'trends', label: t('argus.issues.sortTrends', 'Trends') },
  ];

  const mappedFacets = useMemo(() => ({
    status: statusOptions.filter(o => o.value).map(o => ({ value: o.value, count: 0 })),
    level: levelOptions.filter(o => o.value).map(o => ({ value: o.value, count: 0 })),
    sort: sortOptions.map(o => ({ value: o.value, count: 0 })),
    assigned: members.map(m => ({ value: m.name || m.email || '', count: 0 })).filter(m => m.value),
  }), [members]);

  // ─── Render ────────────────────────────────────────────────────

  return (
    <Box>
      <PageHeader
        icon={<BugReportIcon />}
        title={
          <ArgusBreadcrumbs size="title" paths={[
            { label: t('argus.issues.title') }
          ]} />
        }
        subtitle={t('argus.issues.subtitle')}
        actions={
          !loading && total > 0 && (
            <Chip
              label={`${formatCompactNumber(total)} ${t('argus.issues.issuesLabel')}`}
              size="small"
              sx={{
                fontWeight: 700, fontSize: '0.75rem', height: 22,
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
            <Box sx={{ height: 20, borderLeft: '1px solid', borderColor: 'divider', mx: 0.25 }} />
            <Box sx={{ flex: 1, minWidth: 260, maxWidth: 600 }}>
              <ArgusSearchInput
                initialValue={storeSearch}
                onDebouncedChange={(val) => setSearchInput(val)}
                onSubmit={(val) => {
                  setStoreSearch(val);
                  setSearchInput(val);
                  setCurrentPage(1);
                }}
                isDark={isDark}
                theme={theme}
                mappedFacets={mappedFacets}
              />
            </Box>
            <Tooltip title={t('argus.builder.title', 'Visual Query Builder')}>
              <IconButton
                size="small"
                onClick={(e) => setQueryBuilderAnchor(e.currentTarget)}
                sx={{
                  width: 26, height: 26,
                  border: '1px solid',
                  borderColor: queryBuilderAnchor ? 'primary.main' : 'divider',
                  borderRadius: '6px',
                  backgroundColor: queryBuilderAnchor ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                  '&:hover': { borderColor: 'primary.main', backgroundColor: alpha(theme.palette.primary.main, 0.04) },
                }}
              >
                <SearchIcon sx={{ fontSize: 14, color: queryBuilderAnchor ? 'primary.main' : 'text.disabled' }} />
              </IconButton>
            </Tooltip>
            <ArgusQueryBuilder
              fields={QUERY_BUILDER_FIELDS}
              query={searchInput}
              facets={mappedFacets}
              onApply={handleQueryBuilderApply}
              anchorEl={queryBuilderAnchor}
              onClose={() => setQueryBuilderAnchor(null)}
            />
            <FilterChipSelect
              label={t('argus.issues.status')}
              value={status}
              options={statusOptions}
              anchorEl={statusAnchor}
              onOpen={(e) => setStatusAnchor(e.currentTarget)}
              onClose={() => setStatusAnchor(null)}
              onSelect={(v) => {
                setStatus(v);
                setCurrentPage(1);
              }}
            />
            <FilterChipSelect
              label={t('argus.issues.level')}
              value={level}
              options={levelOptions}
              anchorEl={levelAnchor}
              onOpen={(e) => setLevelAnchor(e.currentTarget)}
              onClose={() => setLevelAnchor(null)}
              onSelect={(v) => {
                setLevel(v);
                setCurrentPage(1);
              }}
            />
            <FilterChipSelect
              label={t('argus.issues.sort')}
              value={sort}
              options={sortOptions}
              anchorEl={sortAnchor}
              onOpen={(e) => setSortAnchor(e.currentTarget)}
              onClose={() => setSortAnchor(null)}
              onSelect={(v) => {
                setSort(v);
              }}
            />
          </>
        }
      />

      {/* Volume Chart */}
      <IssueVolumeChart
        projectId={projectId}
        filters={filters}
        status={status}
        level={level}
        onDateRangeSelect={handleDateRangeSelect}
      />

      {/* Issues content area with sidebar */}
      <Box sx={{ display: 'flex' }}>
        <SavedSearchesSidebar
          currentQuery={searchInput}
          currentSort={sort}
          onApply={(saved: SavedSearch) => {
            setSearchInput(saved.query);
            setStoreSearch(saved.query);
            setSort(saved.sort);
            setCurrentPage(1);
          }}
        />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Bulk Actions */}
          <IssueBulkActions
            selectedIds={selectedIds}
            merging={merging}
            onResolve={() => handleBulkAction('resolved')}
            onIgnore={() => handleBulkAction('ignored')}
            onMerge={handleMerge}
            onDelete={handleBulkDelete}
            onCancel={() => setSelectedIds(new Set())}
          />

          {/* Real-time new issues banner */}
          <NewIssuesBanner
            count={newIssueCount}
            onClick={() => {
              resetNewIssueCount();
              fetchIssues();
            }}
          />

          <PageContentLoader loading={loading} skeleton={<ListSkeleton rows={8} />}>
            <Paper
              elevation={0}
              sx={{
                mb: 2,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              {issues.length === 0 ? (
                <Box sx={{ py: 8, textAlign: 'center' }}>
                  <BugReportIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary">{t('argus.issues.noIssues')}</Typography>
                </Box>
              ) : (
                issues.map((issue, idx) => (
                  <IssueListItem
                    key={issue.id}
                    issue={issue}
                    onClick={handleIssueClick}
                    highlight={searchDebounce}
                    showCheckbox
                    checked={selectedIds.has(issue.id)}
                    onCheckChange={(id) => {
                      setSelectedIds(prev => {
                        const next = new Set(prev);
                        next.has(id) ? next.delete(id) : next.add(id);
                        return next;
                      });
                    }}
                    showAssignee
                    onAssigneeClick={(e, iss) => setAssigneeAnchor({ el: e.currentTarget as HTMLElement, issue: iss })}
                    showSparkline
                    showLastSeen
                    isFirst={idx === 0}
                    isLast={idx === issues.length - 1}
                    showDivider={idx < issues.length - 1}
                  />
                ))
              )}
            </Paper>

            {total > 0 && (
              <Box sx={{ mt: 3 }}>
                <SimplePagination
                  count={total}
                  page={currentPage - 1}
                  rowsPerPage={rowsPerPage}
                  onPageChange={(_, newPage) => handlePageChange(_, newPage + 1)}
                  onRowsPerPageChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  size="small"
                />
              </Box>
            )}
          </PageContentLoader>

        </Box>{/* end flex content area */}
      </Box>{/* end flex sidebar container */}

      {/* Assignee Menu */}
      <IssueAssigneeMenu
        anchor={assigneeAnchor}
        members={members}
        onClose={() => setAssigneeAnchor(null)}
        onAssign={handleAssignIssue}
      />
    </Box>
  );
};

export default ArgusIssuesPage;
