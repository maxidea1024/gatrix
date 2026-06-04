import React, { useState, useEffect, useCallback } from 'react';
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
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import SavedSearchesSidebar, { SavedSearch } from '@/components/argus/SavedSearchesSidebar';
import { useArgusRealtime } from '@/hooks/useArgusRealtime';
import FilterChipSelect from '@/components/common/FilterChipSelect';
import IssueListItem from '@/components/argus/IssueListItem';
import IssueVolumeChart from './components/IssueVolumeChart';
import IssueBulkActions from './components/IssueBulkActions';
import IssueAssigneeMenu from './components/IssueAssigneeMenu';
import NewIssuesBanner from './components/NewIssuesBanner';

const PAGE_SIZE_STORAGE_KEY = 'argusIssues.pageSize';
const DEFAULT_PAGE_SIZE = 25;
const VALID_PAGE_SIZES = [5, 10, 15, 20, 25, 50, 100];

const QUERY_BUILDER_FIELDS = [
  'level', 'status', 'platform', 'browser', 'os', 'device',
  'environment', 'release', 'assigned', 'times_seen', 'user_count',
];

interface ArgusIssuesPageProps {
  projectId?: string | number;
}

const ArgusIssuesPage: React.FC<ArgusIssuesPageProps> = ({ projectId: propProjectId }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const isDark = theme.palette.mode === 'dark';

  const { currentProject } = useOrgProject();
  const projectId = propProjectId || searchParams.get('projectId') || currentProject?.id || '1';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const [rowsPerPage, setRowsPerPage] = useState(() => {
    const saved = parseInt(localStorage.getItem(PAGE_SIZE_STORAGE_KEY) || '', 10);
    if (!isNaN(saved) && VALID_PAGE_SIZES.includes(saved)) return saved;
    return DEFAULT_PAGE_SIZE;
  });

  // ─── State ──────────────────────────────────────────────────────
  const [issues, setIssues] = useState<ArgusIssue[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [searchDebounce, setSearchDebounce] = useState(search);
  const [status, setStatus] = useState(searchParams.get('status') || 'unresolved');
  const [level, setLevel] = useState(searchParams.get('level') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'last_seen');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [merging, setMerging] = useState(false);
  const [activeViewId, setActiveViewId] = useState(searchParams.get('view') || 'unresolved');
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

  // ─── Debounce search ───────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // ─── Fetch issues ──────────────────────────────────────────────
  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      const dateParams = argusDateRangeToApiParams(filters.dateRange);
      const substatus = searchParams.get('substatus') || undefined;
      const assignedTo = searchParams.get('assigned_to') || undefined;
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
        substatus,
        assigned_to: assignedTo,
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
  }, [projectId, status, level, sort, currentPage, rowsPerPage, searchDebounce, filters]);

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
    const params = new URLSearchParams(searchParams);
    params.set('page', String(page));
    setSearchParams(params);
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
    const params = new URLSearchParams(searchParams);
    params.set('view', view.id);
    Object.entries(view.urlParams).forEach(([k, v]) => {
      if (v === '__me__') {
        params.set(k, user?.name || '');
      } else {
        params.set(k, v);
      }
    });
    ['status', 'substatus', 'assigned_to'].forEach(k => {
      if (!view.urlParams[k]) params.delete(k);
    });
    params.set('page', '1');
    setSearchParams(params);
    setStatus(view.urlParams.status || '');
  };

  const handleQueryBuilderApply = (query: string) => {
    setSearch(query);
    const params = new URLSearchParams(searchParams);
    if (query) {
      params.set('search', query);
    } else {
      params.delete('search');
    }
    params.set('page', '1');
    setSearchParams(params);
  };

  const handleDateRangeSelect = (start: Date, end: Date) => {
    setFilters(prev => ({
      ...prev,
      dateRange: { type: 'custom', start, end },
    }));
    const params = new URLSearchParams(searchParams);
    params.set('start', start.toISOString());
    params.set('end', end.toISOString());
    params.set('page', '1');
    setSearchParams(params);
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
            <TextField
              size="small"
              placeholder={t('argus.issues.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const params = new URLSearchParams(searchParams);
                  params.set('search', search);
                  params.set('page', '1');
                  setSearchParams(params);
                }
              }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 14, color: 'text.disabled' }} /></InputAdornment>,
                endAdornment: search ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => {
                      setSearch('');
                      const params = new URLSearchParams(searchParams);
                      params.delete('search');
                      params.set('page', '1');
                      setSearchParams(params);
                    }} sx={{ p: 0.2 }}>
                      <CloseIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
              sx={{
                minWidth: 160,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '6px', fontSize: '0.75rem', height: 26,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                },
                '& .MuiOutlinedInput-input': { py: 0.3 },
              }}
            />
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
              query={search}
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
                const params = new URLSearchParams(searchParams);
                params.set('status', v); params.set('page', '1');
                setSearchParams(params);
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
                const params = new URLSearchParams(searchParams);
                params.set('level', v); params.set('page', '1');
                setSearchParams(params);
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
                const params = new URLSearchParams(searchParams);
                params.set('sort', v);
                setSearchParams(params);
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
          currentQuery={search}
          currentSort={sort}
          onApply={(saved: SavedSearch) => {
            setSearch(saved.query);
            setSort(saved.sort);
            const params = new URLSearchParams(searchParams);
            if (saved.query) params.set('search', saved.query);
            else params.delete('search');
            params.set('sort', saved.sort);
            params.set('page', '1');
            setSearchParams(params);
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
                    const params = new URLSearchParams(searchParams);
                    params.set('page', '1');
                    setSearchParams(params);
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
