import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  TextField,
  InputAdornment,
  useTheme,
  alpha,
  Popover,
  Checkbox,
  Button,
  Tooltip,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
} from '@mui/material';
import PageContentLoader from '@/components/common/PageContentLoader';
import { ListSkeleton } from '@/components/argus/ArgusSkeletons';
import {
  Search as SearchIcon,
  ErrorOutline as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  BugReport as BugReportIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  ExpandMore as ExpandMoreIcon,
  MergeType as MergeIcon,
  PersonAdd as AssignIcon,
  CheckCircle as ResolveIcon,
  Block as IgnoreIcon,
  KeyboardDoubleArrowUp as CriticalPriorityIcon,
  KeyboardArrowUp as HighPriorityIcon,
  Remove as MediumPriorityIcon,
  KeyboardArrowDown as LowPriorityIcon,
  OpenInNew as ExternalLinkIcon,
  Close as CloseIcon,
  ArrowBack as ArrowBackIcon,
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
import { argusDateRangeToApiParams } from '@/components/argus/ArgusDateRangePicker';
import { formatWithCommas as formatNumber, formatCompactNumber } from '@/utils/numberFormat';
import SimplePagination from '@/components/common/SimplePagination';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import PageHeader from '@/components/common/PageHeader';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title as ChartTitle,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import IssueViewTabs, { IssueView } from '@/components/argus/IssueViewTabs';
import ArgusQueryBuilder from '@/components/argus/ArgusQueryBuilder';
import SavedSearchesSidebar, { SavedSearch } from '@/components/argus/SavedSearchesSidebar';

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTitle, ChartTooltip, ChartLegend);

const PAGE_SIZE_STORAGE_KEY = 'argusIssues.pageSize';
const DEFAULT_PAGE_SIZE = 25;
const VALID_PAGE_SIZES = [5, 10, 15, 20, 25, 50, 100];

const LEVEL_CONFIG: Record<string, { color: string; icon: React.ReactElement; bg: string }> = {
  fatal: { color: '#f44336', icon: <ErrorIcon sx={{ fontSize: 16 }} />, bg: 'rgba(244,67,54,0.08)' },
  error: { color: '#ff5722', icon: <ErrorIcon sx={{ fontSize: 16 }} />, bg: 'rgba(255,87,34,0.08)' },
  warning: { color: '#ff9800', icon: <WarningIcon sx={{ fontSize: 16 }} />, bg: 'rgba(255,152,0,0.08)' },
  info: { color: '#2196f3', icon: <InfoIcon sx={{ fontSize: 16 }} />, bg: 'rgba(33,150,243,0.08)' },
  debug: { color: '#9e9e9e', icon: <InfoIcon sx={{ fontSize: 16 }} />, bg: 'rgba(158,158,158,0.08)' },
};

const PRIORITY_CONFIG: Record<string, { color: string; label: string; icon: React.ReactElement }> = {
  critical: { color: '#f44336', label: 'Critical', icon: <CriticalPriorityIcon sx={{ fontSize: 14 }} /> },
  high: { color: '#ff5722', label: 'High', icon: <HighPriorityIcon sx={{ fontSize: 14 }} /> },
  medium: { color: '#ff9800', label: 'Medium', icon: <MediumPriorityIcon sx={{ fontSize: 14 }} /> },
  low: { color: '#2196f3', label: 'Low', icon: <LowPriorityIcon sx={{ fontSize: 14 }} /> },
};

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  unresolved: { color: '#f44336', label: 'Unresolved' },
  resolved: { color: '#4caf50', label: 'Resolved' },
  ignored: { color: '#9e9e9e', label: 'Ignored' },
};

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); }
  const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#00bcd4', '#009688', '#4caf50', '#ff9800'];
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function HighlightText({ text, highlight, isDark }: { text: string; highlight: string; isDark: boolean }) {
  if (!highlight.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <span key={i} style={{ 
            backgroundColor: isDark ? 'rgba(255, 235, 59, 0.2)' : 'rgba(255, 235, 59, 0.4)',
            color: isDark ? '#ffd54f' : '#f57f17',
            borderRadius: '2px',
            padding: '0 2px'
          }}>
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

interface ArgusIssuesPageProps {
  projectId?: string | number;
}

interface FilterChipSelectProps {
  label: string;
  value: string;
  options: { value: string; label: string; color?: string }[];
  anchorEl: HTMLElement | null;
  onOpen: (e: React.MouseEvent<HTMLElement>) => void;
  onClose: () => void;
  onSelect: (value: string) => void;
}

const FilterChipSelect: React.FC<FilterChipSelectProps> = ({ label, value, options, anchorEl, onOpen, onClose, onSelect }) => {
  const theme = useTheme();
  const currentOption = options.find(o => o.value === value);
  const displayLabel = currentOption?.label || options[0]?.label;
  const dotColor = currentOption?.color;
  return (
    <>
      <Box
        onClick={onOpen}
        sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.5,
          height: 28, px: 1.2, borderRadius: '6px',
          border: '1px solid', borderColor: anchorEl ? 'primary.main' : 'divider',
          bgcolor: anchorEl ? alpha(theme.palette.primary.main, 0.04) : 'transparent',
          cursor: 'pointer', transition: 'all 0.15s', userSelect: 'none',
          '&:hover': { borderColor: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.04) },
        }}
      >
        {dotColor && <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: dotColor }} />}
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.secondary' }}>{label}:</Typography>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.primary' }}>{displayLabel}</Typography>
        <ExpandMoreIcon sx={{ fontSize: 13, color: 'text.disabled', transform: anchorEl ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </Box>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { mt: 0.5, borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', minWidth: 140, py: 0.5 } } }}
      >
        {options.map(opt => (
          <Box
            key={opt.value}
            onClick={() => { onSelect(opt.value); onClose(); }}
            sx={{
              px: 1.5, py: 0.6, cursor: 'pointer', fontSize: '0.78rem',
              fontWeight: opt.value === value ? 700 : 400,
              color: opt.value === value ? 'primary.main' : 'text.primary',
              backgroundColor: opt.value === value ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
              display: 'flex', alignItems: 'center', gap: 0.8,
              transition: 'background 0.1s',
              '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.04) },
            }}
          >
            {opt.color && <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: opt.color }} />}
            {opt.label}
          </Box>
        ))}
      </Popover>
    </>
  );
};

const ArgusIssuesPage: React.FC<ArgusIssuesPageProps> = ({ projectId: propProjectId }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
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

  const [filters, setFilters] = useState<ArgusFilterState>(() => {
    const state = defaultArgusFilterState('24h');
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

  const [statusAnchor, setStatusAnchor] = useState<HTMLElement | null>(null);
  const [levelAnchor, setLevelAnchor] = useState<HTMLElement | null>(null);
  const [sortAnchor, setSortAnchor] = useState<HTMLElement | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

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

  // Persist page size to localStorage
  useEffect(() => {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(rowsPerPage));
  }, [rowsPerPage]);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  // ─── Volume Chart ───
  const [volumeData, setVolumeData] = useState<{ day: string; count: number; issue_count: number }[]>([]);
  const [volumeLoading, setVolumeLoading] = useState(true);
  const chartRef = React.useRef<any>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fetchVolume = useCallback(async () => {
    if (!projectId) return;
    setVolumeLoading(true);
    try {
      const dateParams = argusDateRangeToApiParams(filters.dateRange);
      const data = await argusService.getIssueVolume(projectId, {
        ...dateParams,
        status: status || undefined,
        level: level || undefined,
      });
      setVolumeData(data);
    } catch (e) {
      console.error('Failed to fetch issue volume:', e);
      setVolumeData([]);
    } finally {
      setVolumeLoading(false);
    }
  }, [projectId, filters, status, level]);

  useEffect(() => { fetchVolume(); }, [fetchVolume]);

  const volumeLabelsRaw = useMemo(() => volumeData.map(d => d.day), [volumeData]);

  const volumeChartData = useMemo(() => {
    if (!volumeData.length) return { labels: [], datasets: [] };
    const barColors = volumeData.map((_, idx) => {
      if (dragStart !== null && dragEnd !== null) {
        const lo = Math.min(dragStart, dragEnd);
        const hi = Math.max(dragStart, dragEnd);
        if (idx >= lo && idx <= hi) return theme.palette.error.main;
        return alpha(theme.palette.error.main, 0.2);
      }
      return alpha(theme.palette.error.main, 0.6);
    });
    return {
      labels: volumeData.map(d => {
        try { const dt = new Date(d.day); return `${dt.getMonth() + 1}/${dt.getDate()}`; } catch { return d.day; }
      }),
      datasets: [{
        label: t('argus.issues.events'),
        data: volumeData.map(d => d.count),
        backgroundColor: barColors,
        borderColor: 'transparent',
        borderWidth: 0,
        borderRadius: 4,
        borderSkipped: false as const,
      }],
    };
  }, [volumeData, t, dragStart, dragEnd, theme]);

  const getBarIndex = (e: React.MouseEvent<HTMLElement>) => {
    const chart = chartRef.current;
    if (!chart) return null;
    const elements = chart.getElementsAtEventForMode(e.nativeEvent, 'index', { intersect: false }, false);
    if (elements.length > 0) return elements[0].index;
    return null;
  };

  const handleChartMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    const idx = getBarIndex(e);
    if (idx !== null) {
      setDragStart(idx);
      setDragEnd(idx);
      setIsDragging(true);
    }
  };

  const handleChartMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!isDragging) return;
    const idx = getBarIndex(e);
    if (idx !== null) setDragEnd(idx);
  };

  const handleChartMouseUp = () => {
    if (!isDragging || dragStart === null || dragEnd === null) {
      setIsDragging(false);
      return;
    }
    setIsDragging(false);
    const lo = Math.min(dragStart, dragEnd);
    const hi = Math.max(dragStart, dragEnd);
    if (volumeLabelsRaw.length > 0 && lo >= 0 && hi < volumeLabelsRaw.length) {
      const startDay = volumeLabelsRaw[lo];
      const endDay = volumeLabelsRaw[hi];
      try {
        const startDate = new Date(startDay);
        const endDate = new Date(endDay);
        endDate.setHours(23, 59, 59, 999);
        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          setFilters(prev => ({
            ...prev,
            dateRange: { type: 'custom', start: startDate, end: endDate },
          }));
          const params = new URLSearchParams(searchParams);
          params.set('start', startDate.toISOString());
          params.set('end', endDate.toISOString());
          params.set('page', '1');
          setSearchParams(params);
        }
      } catch { /* ignore */ }
    }
  };

  const handleChartReset = () => {
    setDragStart(null);
    setDragEnd(null);
  };

  const chartOpts = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 15 } },
      y: { beginAtZero: true, border: { display: false }, grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 } } },
    },
  }), [isDark]);

  const handleFilterChange = (newFilters: ArgusFilterState) => {
    setFilters(newFilters);
  };

  const handlePageChange = (_: unknown, page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(page));
    setSearchParams(params);
  };

  const handleIssueClick = (issue: ArgusIssue) => {
    navigate(`/argus/issues/${projectId}/${issue.id}`);
  };

  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleMerge = async () => {
    if (selectedIds.size < 2) return;
    setMerging(true);
    try {
      await argusService.mergeIssues(projectId, Array.from(selectedIds));
      setSelectedIds(new Set());
      enqueueSnackbar(t('argus.issues.mergeSuccess'), { variant: 'success' });
      fetchIssues();
    } catch (e) {
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

  const totalPages = Math.ceil(total / rowsPerPage);

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

  const QUERY_BUILDER_FIELDS = [
    'level', 'status', 'platform', 'browser', 'os', 'device',
    'environment', 'release', 'assigned', 'times_seen', 'user_count',
  ];

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
    // Clear params that aren't in this view
    ['status', 'substatus', 'assigned_to'].forEach(k => {
      if (!view.urlParams[k]) params.delete(k);
    });
    params.set('page', '1');
    setSearchParams(params);
    // Sync local filter state
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
        onSaveCurrentAsView={() => {
          // Save current search + filters as a custom view
          const viewName = search || `${t('argus.issueViews.customView', 'Custom View')} ${Date.now()}`;
          // The IssueViewTabs handles creation internally via the Add button
        }}
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
      <Paper elevation={0} sx={{ p: 1.5, mb: 1.5, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, borderRadius: 2, position: 'relative' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.secondary', fontWeight: 600 }}>
            {t('argus.issues.volumeChart')}
          </Typography>
          {dragStart !== null && dragEnd !== null && (
            <Chip
              label={t('argus.issues.clearSelection')}
              size="small"
              onDelete={handleChartReset}
              sx={{ height: 18, fontSize: '0.6rem', '& .MuiChip-deleteIcon': { fontSize: 12 } }}
            />
          )}
        </Box>
        <Box
          sx={{ height: 80, cursor: 'crosshair', userSelect: 'none' }}
          onMouseDown={handleChartMouseDown}
          onMouseMove={handleChartMouseMove}
          onMouseUp={handleChartMouseUp}
          onMouseLeave={() => { if (isDragging) handleChartMouseUp(); }}
        >
          {volumeLoading ? <ArgusChartSkeleton type="bar" height={80} color={theme.palette.error.main} /> : <Bar ref={chartRef} data={volumeChartData} options={chartOpts as any} />}
        </Box>
        {isDragging && (
          <Typography variant="caption" sx={{ position: 'absolute', bottom: 4, right: 8, fontSize: '0.58rem', color: 'text.disabled' }}>
            {t('argus.issues.dragToSelect')}
          </Typography>
        )}
      </Paper>

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

      {selectedIds.size > 0 && (
        <Paper elevation={0} sx={{
          mb: 1.5, p: 1, display: 'flex', alignItems: 'center', gap: 1,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
          borderRadius: 2,
          backgroundColor: alpha(theme.palette.primary.main, 0.04),
        }}>
          <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8rem', mr: 0.5 }}>
            {selectedIds.size} {t('argus.issues.selected')}
          </Typography>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Button
            variant="outlined"
            size="small"
            startIcon={<ResolveIcon sx={{ fontSize: 14 }} />}
            onClick={() => handleBulkAction('resolved')}
            sx={{ textTransform: 'none', borderRadius: '6px', fontSize: '0.76rem', borderColor: alpha('#4caf50', 0.5), color: '#4caf50', '&:hover': { borderColor: '#4caf50', backgroundColor: alpha('#4caf50', 0.08) } }}
          >
            {t('argus.issues.resolve')}
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<IgnoreIcon sx={{ fontSize: 14 }} />}
            onClick={() => handleBulkAction('ignored')}
            sx={{ textTransform: 'none', borderRadius: '6px', fontSize: '0.76rem', borderColor: alpha('#9e9e9e', 0.5), color: '#9e9e9e', '&:hover': { borderColor: '#9e9e9e', backgroundColor: alpha('#9e9e9e', 0.08) } }}
          >
            {t('argus.issues.ignore')}
          </Button>
          <Tooltip title={selectedIds.size < 2 ? t('argus.issues.mergeMinTwo') : ''}>
            <span>
              <Button
                variant="outlined"
                size="small"
                startIcon={<MergeIcon sx={{ fontSize: 14 }} />}
                disabled={selectedIds.size < 2 || merging}
                onClick={handleMerge}
                sx={{ textTransform: 'none', borderRadius: '6px', fontSize: '0.76rem' }}
              >
                {t('argus.issues.merge')}
              </Button>
            </span>
          </Tooltip>
          <Button
            size="small"
            onClick={() => setSelectedIds(new Set())}
            sx={{ textTransform: 'none', fontSize: '0.76rem', ml: 'auto' }}
          >
            {t('common.cancel')}
          </Button>
        </Paper>
      )}

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
            issues.map((issue, idx) => {
              const lc = LEVEL_CONFIG[issue.level] || LEVEL_CONFIG.info;
              return (
                <Box
                  key={issue.id}
                  onClick={() => handleIssueClick(issue)}
                  sx={{
                    display: 'flex',
                    alignItems: 'stretch',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    borderBottom: idx < issues.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` : 'none',
                    '&:hover': {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                    },
                  }}
                >
                  <Box sx={{
                    width: 4, flexShrink: 0,
                    backgroundColor: lc.color,
                    borderRadius: idx === 0 ? '8px 0 0 0' : idx === issues.length - 1 ? '0 0 0 8px' : 0,
                  }} />

                  <Box sx={{ display: 'flex', alignItems: 'center', pl: 0.5 }}>
                    <Checkbox
                      size="small"
                      checked={selectedIds.has(issue.id)}
                      onChange={(e) => {
                        setSelectedIds(prev => {
                          const next = new Set(prev);
                          next.has(issue.id) ? next.delete(issue.id) : next.add(issue.id);
                          return next;
                        });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      sx={{ p: 0.3, '& .MuiSvgIcon-root': { fontSize: 16 } }}
                    />
                  </Box>

                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', px: 1.5, py: 1.5, gap: 2, minWidth: 0 }}>
                    <Box sx={{
                      width: 30, height: 30, borderRadius: 1.5, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: lc.bg, color: lc.color,
                    }}>
                      {lc.icon}
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.2 }}>
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          noWrap
                          sx={{ color: isDark ? '#e0e0e0' : '#1a1a2e', lineHeight: 1.3 }}
                        >
                          <HighlightText text={issue.title} highlight={searchDebounce} isDark={isDark} />
                        </Typography>
                        {issue.external_url && (
                          <Tooltip title={`${issue.external_key || 'External'} — ${t('argus.issues.openExternal')}`}>
                            <IconButton
                              size="small"
                              onClick={(e) => { e.stopPropagation(); window.open(issue.external_url!, '_blank'); }}
                              sx={{ p: 0.2, '&:hover': { color: '#0052CC' } }}
                            >
                              <ExternalLinkIcon sx={{ fontSize: 13 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        {issue.substatus === 'regressed' && (
                          <Chip
                            label={t('argus.issues.regression')}
                            size="small"
                            sx={{
                              height: 18, fontSize: '0.6rem', fontWeight: 700,
                              backgroundColor: alpha('#ff9800', 0.15),
                              color: '#ff9800', border: 'none',
                            }}
                          />
                        )}
                        {issue.substatus === 'escalating' && (
                          <Chip
                            label={t('argus.issues.escalating')}
                            size="small"
                            sx={{
                              height: 18, fontSize: '0.6rem', fontWeight: 700,
                              backgroundColor: alpha('#f44336', 0.15),
                              color: '#f44336', border: 'none',
                            }}
                          />
                        )}
                        {issue.priority && PRIORITY_CONFIG[issue.priority] && (
                          <Chip
                            icon={PRIORITY_CONFIG[issue.priority].icon}
                            label={t(`argus.issues.priority.${issue.priority}`, PRIORITY_CONFIG[issue.priority].label)}
                            size="small"
                            sx={{
                              height: 18, fontSize: '0.6rem', fontWeight: 600,
                              backgroundColor: alpha(PRIORITY_CONFIG[issue.priority].color, 0.1),
                              color: PRIORITY_CONFIG[issue.priority].color, border: 'none',
                              '& .MuiChip-icon': { color: 'inherit', ml: 0.5 },
                            }}
                          />
                        )}
                      </Box>
                      <Typography
                        variant="caption"
                        noWrap
                        sx={{ color: isDark ? '#666' : '#999', fontSize: '0.75rem', display: 'block' }}
                      >
                        {issue.culprit || issue.fingerprint?.slice(0, 16)}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                      {/* 24h Sparkline */}
                      {issue.stats_24h && issue.stats_24h.length > 0 && (() => {
                        const data = issue.stats_24h!;
                        const max = Math.max(...data, 1);
                        const w = 48, h = 20;
                        const points = data.map((v, i) =>
                          `${(i / (data.length - 1)) * w},${h - (v / max) * h}`
                        ).join(' ');
                        return (
                          <svg width={w} height={h} style={{ flexShrink: 0 }}>
                            <polyline
                              points={points}
                              fill="none"
                              stroke={lc.color}
                              strokeWidth={1.5}
                              strokeLinejoin="round"
                              strokeLinecap="round"
                              opacity={0.7}
                            />
                          </svg>
                        );
                      })()}
                      <Box sx={{ textAlign: 'center', minWidth: 50 }}>
                        <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                          {formatCompactNumber(issue.event_count || 0)}
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: isDark ? '#555' : '#aaa' }}>
                          {t('argus.issues.events')}
                        </Typography>
                      </Box>

                      <Box sx={{ textAlign: 'center', minWidth: 40 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, justifyContent: 'center' }}>
                          <PersonIcon sx={{ fontSize: 13, color: isDark ? '#555' : '#aaa' }} />
                          <Typography variant="body2" fontWeight={600}>
                            {formatCompactNumber(issue.user_count || 0)}
                          </Typography>
                        </Box>
                      </Box>

                      <Box sx={{ minWidth: 28, display: 'flex', justifyContent: 'center' }}>
                        {issue.assigned_to ? (
                          <Tooltip title={`${t('argus.issues.assignedTo')}: ${issue.assigned_to}`}>
                            <Avatar
                              onClick={(e) => { e.stopPropagation(); setAssigneeAnchor({ el: e.currentTarget, issue }); }}
                              sx={{
                                width: 22, height: 22, fontSize: '0.55rem', fontWeight: 700,
                                backgroundColor: stringToColor(issue.assigned_to),
                                cursor: 'pointer',
                              }}
                            >
                              {getInitials(issue.assigned_to)}
                            </Avatar>
                          </Tooltip>
                        ) : (
                          <Tooltip title={t('argus.issues.unassigned')}>
                            <IconButton
                              size="small"
                              onClick={(e) => { e.stopPropagation(); setAssigneeAnchor({ el: e.currentTarget, issue }); }}
                              sx={{ p: 0.3 }}
                            >
                              <AssignIcon sx={{ fontSize: 16, color: isDark ? '#444' : '#ccc' }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>

                      <Box sx={{ minWidth: 70, textAlign: 'right' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, justifyContent: 'flex-end' }}>
                          <ScheduleIcon sx={{ fontSize: 12, color: isDark ? '#555' : '#aaa' }} />
                          <Typography variant="caption" sx={{ fontSize: '0.72rem', color: isDark ? '#777' : '#888' }}>
                            {issue.last_seen ? formatTimeAgo(issue.last_seen, t) : '-'}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              );
            })
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

      <Menu
        anchorEl={assigneeAnchor?.el}
        open={Boolean(assigneeAnchor)}
        onClose={() => setAssigneeAnchor(null)}
        slotProps={{ paper: { sx: { borderRadius: 2, minWidth: 160, maxHeight: 300, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' } } }}
      >
        <MenuItem onClick={() => handleAssignIssue(assigneeAnchor?.issue.id, '')}>
          <ListItemIcon><PersonIcon sx={{ fontSize: 18 }} /></ListItemIcon>
          <ListItemText primary={t('argus.issues.unassigned')} primaryTypographyProps={{ fontSize: '0.82rem' }} />
        </MenuItem>
        <Divider />
        {members.map(member => {
          const displayName = member.name || member.email || member.userId;
          return (
            <MenuItem key={member.userId} onClick={() => handleAssignIssue(assigneeAnchor?.issue?.id, displayName)}>
              <Avatar sx={{ width: 20, height: 20, mr: 1, fontSize: '0.55rem', fontWeight: 700, backgroundColor: stringToColor(displayName) }}>
                {getInitials(displayName)}
              </Avatar>
              <ListItemText primary={displayName} primaryTypographyProps={{ fontSize: '0.82rem' }} />
            </MenuItem>
          );
        })}
      </Menu>
    </Box>
  );
};

function formatTimeAgo(dateStr: string, t?: any): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (t) {
      if (diffSec < 60) return t('common.time.justNow');
      if (diffMin < 60) return t('common.time.minutesAgo', { count: diffMin });
      if (diffHour < 24) return t('common.time.hoursAgo', { count: diffHour });
      if (diffDay < 30) return t('common.time.daysAgo', { count: diffDay });
    } else {
      if (diffSec < 60) return `${diffSec}s ago`;
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHour < 24) return `${diffHour}h ago`;
      if (diffDay < 30) return `${diffDay}d ago`;
    }
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

export default ArgusIssuesPage;
