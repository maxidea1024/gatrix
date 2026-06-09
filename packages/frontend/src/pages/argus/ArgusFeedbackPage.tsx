import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  useTheme,
  alpha,
  Avatar,
  TextField,
  InputAdornment,
  Button,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Tabs,
  Tab,
  Divider,
  Collapse,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Feedback as FeedbackIcon,
  Schedule as ScheduleIcon,
  Link as LinkIcon,
  Search as SearchIcon,
  People as PeopleIcon,
  ContactMail as ContactIcon,
  TextFields as TextIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircleOutline as ResolveIcon,
  ReportProblem as SpamIcon,
  Undo as UnresolveIcon,
  BugReport as BugReportIcon,
  Image as ImageIcon,
  Close as CloseIcon,
  PersonAdd as AssignIcon,
  OpenInNew as OpenIcon,
  Person as PersonIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Add as AddIcon,
  Mail as MailIcon,
  Language as UrlIcon,
  Dns as EnvIcon,
  NewReleases as ReleaseIcon,
  LocalOffer as TagIcon,
  Source as SourceIcon,
  FilterList as FilterListIcon,
  Delete as DeleteIcon,
  PlayArrow as RunIcon,
  ArrowBack as ArrowBackIcon,
  Computer as BrowserIcon,
  PhoneAndroid as DeviceIcon,
  Public as OsIcon,
  AccountCircle as UserIdIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useSnackbar } from 'notistack';
import PageContentLoader from '@/components/common/PageContentLoader';

import argusService, {
  ArgusFeedbackItem,
  ArgusFeedbackResponse,
  ArgusIssueTracker,
  ArgusIssue,
} from '@/services/argusService';
import { rbacService } from '@/services/rbacService';
import ArgusFilterBar, {
  ArgusFilterState,
  defaultArgusFilterState,
} from '@/components/argus/ArgusFilterBar';
import { dateRangeToApiParams as argusDateRangeToApiParams } from '@/components/common/DateRangeSelector';
import { formatRelativeTime } from '@/utils/dateFormat';
import { formatCompactNumber, formatWithCommas } from '@/utils/numberFormat';

import useArgusUrlState from '@/hooks/useArgusUrlState';
import SimplePagination from '@/components/common/SimplePagination';
import PageHeader from '@/components/common/PageHeader';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import { CopyButton } from '@/components/common/CopyButton';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import { stringToColor, getInitials } from '@/utils/argusHelpers';
import HighlightText from '@/components/common/HighlightText';
import FeedbackListItem from './components/FeedbackListItem';
import FeedbackActivityTimeline from './components/FeedbackActivityTimeline';
import FeedbackStatsBar from './components/FeedbackStatsBar';
import FilterChipSelect from '@/components/common/FilterChipSelect';
import { QueryDSLEditor, FEEDBACK_CONFIG } from '@/components/argus/query-dsl';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

const PAGE_SIZE_KEY = 'argus-feedback-page-size';
const STATS_COLLAPSED_KEY = 'argus-feedback-stats-collapsed';
const SPLIT_WIDTH_KEY = 'argus-feedback-split-width';
const DEFAULT_PAGE_SIZE = 20;
const VALID_PAGE_SIZES = [5, 10, 15, 20, 25, 50, 100];
const DEFAULT_SPLIT_WIDTH = 380;
const MIN_SPLIT_WIDTH = 280;
const MAX_SPLIT_WIDTH = 1000;

// ─── Helpers ───

const statusColor = (s: string) => {
  if (s === 'resolved') return '#4caf50';
  if (s === 'spam') return '#9e9e9e';
  return '#ff9800';
};

type FeedbackStatusTab = 'unresolved' | 'resolved' | 'spam' | '';

// ─── Main Component ───
const ArgusFeedbackPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = searchParams.get('projectId') || currentProject?.id || '1';

  // ─── URL State ───
  const URL_PARAMS = useMemo(
    () => ({
      period: {
        key: 'period',
        default: '14d',
        storageKey: 'argus-feedback-period',
      },
      status: { key: 'status', default: 'unresolved' },
      page: { key: 'page', default: '1' },
      sort: { key: 'sort', default: 'newest' },
      fb: { key: 'fb', default: '' }, // selected feedback ID
    }),
    []
  );
  const [urlState, setUrlState] = useArgusUrlState(URL_PARAMS);

  // ─── Core State ───
  const [data, setData] = useState<ArgusFeedbackResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const page = parseInt(urlState.page, 10) || 1;
  const [rowsPerPage, setRowsPerPage] = useState(() => {
    const saved = parseInt(localStorage.getItem(PAGE_SIZE_KEY) || '', 10);
    if (!isNaN(saved) && VALID_PAGE_SIZES.includes(saved)) return saved;
    return DEFAULT_PAGE_SIZE;
  });

  useEffect(() => {
    localStorage.setItem(PAGE_SIZE_KEY, String(rowsPerPage));
  }, [rowsPerPage]);

  const [filters, setFilters] = useState<ArgusFilterState>(() =>
    defaultArgusFilterState(urlState.period)
  );

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      dateRange: { type: 'preset', preset: urlState.period },
    }));
  }, [urlState.period]);

  // Lazy-loading callback for QueryDSLEditor: fetch values for a specific field on demand
  // Uses the generic attribute-facet API (same pattern as logs)
  const fetchFieldValues = useCallback(
    async (fieldKey: string): Promise<string[]> => {
      try {
        // Map DSL field keys → ClickHouse column names
        const columnMap: Record<string, string> = {
          browser_name: 'browser',
          os_name: 'os',
          assigned: 'assigned_to',
          feedback: 'message',
          contact_email: 'contact_email',
        };
        const chKey = columnMap[fieldKey] ?? fieldKey;
        const data = await argusService.getFeedbackAttributeFacet(
          projectId,
          chKey,
          { period: urlState.period }
        );
        return data.map((d) => d.attr_value);
      } catch {
        return [];
      }
    },
    [projectId, urlState.period]
  );

  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const statusTab = urlState.status as FeedbackStatusTab;
  const sortOrder = urlState.sort;

  // ─── Selection & Menus ───
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assigneeAnchor, setAssigneeAnchor] = useState<{
    el: HTMLElement;
    feedbackId: string;
  } | null>(null);
  const [bulkAssignAnchor, setBulkAssignAnchor] = useState<HTMLElement | null>(
    null
  );
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [sortAnchor, setSortAnchor] = useState<HTMLElement | null>(null);

  // ─── Stats & UI ───
  const [statsCollapsed, setStatsCollapsed] = useState(
    () => localStorage.getItem(STATS_COLLAPSED_KEY) === 'true'
  );
  const [members, setMembers] = useState<any[]>([]);

  // ─── Create Issue Dialog ───
  const [createIssueOpen, setCreateIssueOpen] = useState(false);
  const [createIssueTitle, setCreateIssueTitle] = useState('');
  const [createIssueFeedbackId, setCreateIssueFeedbackId] = useState('');
  const [issueTrackers, setIssueTrackers] = useState<ArgusIssueTracker[]>([]);
  const [selectedTrackerId, setSelectedTrackerId] = useState<number | ''>('');

  // ─── Link Existing Issue Dialog ───
  const [linkIssueOpen, setLinkIssueOpen] = useState(false);
  const [linkIssueSearch, setLinkIssueSearch] = useState('');
  const [linkIssueResults, setLinkIssueResults] = useState<ArgusIssue[]>([]);
  const [linkIssueLoading, setLinkIssueLoading] = useState(false);
  const [linkedIssueDetail, setLinkedIssueDetail] = useState<ArgusIssue | null>(
    null
  );

  // ─── Spam Filter Dialog ───
  const [spamFilterOpen, setSpamFilterOpen] = useState(false);
  const [spamKeywords, setSpamKeywords] = useState<
    { id: number; keyword: string; is_regex: boolean; created_at: string }[]
  >([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [newKeywordRegex, setNewKeywordRegex] = useState(false);
  const [spamScanLoading, setSpamScanLoading] = useState(false);

  // ─── Resizable Splitter ───

  const [splitWidth, setSplitWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem(SPLIT_WIDTH_KEY) || '', 10);
    return !isNaN(saved) && saved >= MIN_SPLIT_WIDTH && saved <= MAX_SPLIT_WIDTH
      ? saved
      : DEFAULT_SPLIT_WIDTH;
  });

  // ─── Confirm Dialog ───
  const [confirmConfig, setConfirmConfig] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    confirmColor?: 'primary' | 'error' | 'warning' | 'success';
  }>({ open: false, title: '', message: '', onConfirm: () => {} });
  const [isSplitDragging, setIsSplitDragging] = useState(false);
  const splitContainerRef = React.useRef<HTMLDivElement>(null);

  const handleSplitterMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsSplitDragging(true);
      const startX = e.clientX;
      const startWidth = splitWidth;

      const onMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        const newWidth = Math.min(
          MAX_SPLIT_WIDTH,
          Math.max(MIN_SPLIT_WIDTH, startWidth + delta)
        );
        setSplitWidth(newWidth);
      };
      const onMouseUp = () => {
        setIsSplitDragging(false);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [splitWidth]
  );

  useEffect(() => {
    localStorage.setItem(SPLIT_WIDTH_KEY, String(splitWidth));
  }, [splitWidth]);

  useEffect(() => {
    localStorage.setItem(STATS_COLLAPSED_KEY, String(statsCollapsed));
  }, [statsCollapsed]);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const data = await rbacService.getProjectMembers(projectId);
        setMembers(data);
      } catch (error) {
        console.error('Failed to fetch project members:', error);
      }
    };
    fetchMembers();
  }, [projectId]);

  // ─── Debounce Search ───
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // ─── Fetch Data ───
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const ap = argusDateRangeToApiParams(filters.dateRange);
      const result = await argusService.getFeedback(projectId, {
        ...ap,
        page,
        limit: rowsPerPage,
        search: searchDebounce || undefined,
        status: statusTab || undefined,
        sort: sortOrder,
      });
      setData(result);
    } catch (error) {
      console.error('Failed to fetch feedback:', error);
    } finally {
      setLoading(false);
    }
  }, [
    projectId,
    filters,
    page,
    rowsPerPage,
    searchDebounce,
    statusTab,
    sortOrder,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Handlers ───
  const handleFilterChange = (newFilters: ArgusFilterState) => {
    setFilters(newFilters);
    if (newFilters.dateRange.type === 'preset' && newFilters.dateRange.preset) {
      setUrlState({ period: newFilters.dateRange.preset, page: '1', fb: '' });
    }
  };

  const handleUpdateStatus = (feedbackId: string, status: string) => {
    const isResolve = status === 'resolved';
    setConfirmConfig({
      open: true,
      title: isResolve
        ? t('argus.feedback.resolveTitle')
        : t('argus.feedback.unresolveTitle'),
      message: isResolve
        ? t('argus.feedback.resolveConfirm')
        : t('argus.feedback.unresolveConfirm'),
      confirmText: isResolve
        ? t('argus.feedback.resolve')
        : t('argus.feedback.unresolve'),
      confirmColor: isResolve ? 'success' : 'warning',
      onConfirm: async () => {
        setConfirmConfig((p) => ({ ...p, open: false }));
        try {
          await argusService.updateFeedback(projectId, feedbackId, { status });
          enqueueSnackbar(t('argus.feedback.statusUpdated'), {
            variant: 'success',
          });
          fetchData();
        } catch {
          enqueueSnackbar(t('common.error'), { variant: 'error' });
        }
      },
    });
  };

  const handleMarkSpam = (feedbackId: string) => {
    setConfirmConfig({
      open: true,
      title: t('argus.feedback.spamTitle'),
      message: t('argus.feedback.spamConfirm'),
      confirmText: t('argus.feedback.markSpam'),
      confirmColor: 'error',
      onConfirm: async () => {
        setConfirmConfig((p) => ({ ...p, open: false }));
        try {
          await argusService.updateFeedback(projectId, feedbackId, {
            is_spam: true,
          });
          enqueueSnackbar(t('argus.feedback.markedSpam'), {
            variant: 'success',
          });
          fetchData();
        } catch {
          enqueueSnackbar(t('common.error'), { variant: 'error' });
        }
      },
    });
  };

  const handleAssignFeedback = async (feedbackId: string, assignee: string) => {
    try {
      await argusService.updateFeedback(projectId, feedbackId, {
        assigned_to: assignee,
      });
      enqueueSnackbar(t('argus.feedback.assigneeUpdated'), {
        variant: 'success',
      });
      fetchData();
    } catch {
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
    setAssigneeAnchor(null);
  };

  const handleBulkAction = (action: 'resolve' | 'unresolve' | 'spam') => {
    if (selectedIds.size === 0) return;

    let title = '';
    let message = '';
    let confirmText = '';
    let confirmColor: 'primary' | 'error' | 'warning' | 'success' = 'primary';

    if (action === 'resolve') {
      title = t('argus.feedback.bulkResolveTitle');
      message = t('argus.feedback.bulkResolveConfirm', {
        count: selectedIds.size,
      });
      confirmText = t('argus.feedback.resolve');
      confirmColor = 'success';
    } else if (action === 'unresolve') {
      title = t('argus.feedback.bulkUnresolveTitle');
      message = t('argus.feedback.bulkUnresolveConfirm', {
        count: selectedIds.size,
      });
      confirmText = t('argus.feedback.unresolve');
      confirmColor = 'warning';
    } else if (action === 'spam') {
      title = t('argus.feedback.bulkSpamTitle');
      message = t('argus.feedback.bulkSpamConfirm', {
        count: selectedIds.size,
      });
      confirmText = t('argus.feedback.markSpam');
      confirmColor = 'error';
    }

    setConfirmConfig({
      open: true,
      title,
      message,
      confirmText,
      confirmColor,
      onConfirm: async () => {
        setConfirmConfig((p) => ({ ...p, open: false }));
        try {
          await argusService.bulkFeedbackAction(
            projectId,
            Array.from(selectedIds),
            action
          );
          enqueueSnackbar(
            t('argus.feedback.bulkDone', { count: selectedIds.size }),
            { variant: 'success' }
          );
          setSelectedIds(new Set());
          fetchData();
        } catch {
          enqueueSnackbar(t('common.error'), { variant: 'error' });
        }
      },
    });
  };

  const handleBulkAssign = async (assignee: string) => {
    if (selectedIds.size === 0) return;
    try {
      await argusService.bulkFeedbackAction(
        projectId,
        Array.from(selectedIds),
        'assign',
        assignee
      );
      enqueueSnackbar(t('argus.feedback.bulkAssignSuccess'), {
        variant: 'success',
      });
      setSelectedIds(new Set());
      fetchData();
    } catch {
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
    setBulkAssignAnchor(null);
  };

  const handleCreateIssue = async () => {
    if (!createIssueTitle.trim() || !createIssueFeedbackId) return;
    try {
      const result = await argusService.createIssue(projectId, {
        title: createIssueTitle,
        level: 'info',
        message: selectedItem?.message || '',
        culprit: selectedItem?.url || 'user-feedback',
        tracker_id: selectedTrackerId ? Number(selectedTrackerId) : undefined,
      });
      if (result.external_url) {
        enqueueSnackbar(
          t('argus.feedback.issueCreatedExternal', {
            key: result.external_key || '',
          }),
          { variant: 'success' }
        );
      } else {
        enqueueSnackbar(t('argus.feedback.issueCreated'), {
          variant: 'success',
        });
      }
      setCreateIssueOpen(false);
      setCreateIssueTitle('');
      setSelectedTrackerId('');
      fetchData();
    } catch {
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
  };

  // ─── Link / Unlink Issue ───
  const handleLinkIssue = async (issueId: number) => {
    if (!selectedItem) return;
    try {
      await argusService.linkFeedbackToIssue(
        projectId,
        selectedItem.feedback_id,
        issueId
      );
      enqueueSnackbar(t('argus.feedback.issueLinked'), { variant: 'success' });
      setLinkIssueOpen(false);
      setLinkIssueSearch('');
      fetchData();
    } catch {
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
  };

  const handleUnlinkIssue = async () => {
    if (!selectedItem) return;
    try {
      await argusService.unlinkFeedbackFromIssue(
        projectId,
        selectedItem.feedback_id
      );
      enqueueSnackbar(t('argus.feedback.issueUnlinked'), {
        variant: 'success',
      });
      setLinkedIssueDetail(null);
      fetchData();
    } catch {
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
  };

  const linkSearchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const searchIssuesForLink = useCallback(
    async (search: string) => {
      setLinkIssueLoading(true);
      try {
        const result = await argusService.listIssues(projectId, {
          search,
          limit: 15,
        });
        setLinkIssueResults(result.data || []);
      } catch {
        setLinkIssueResults([]);
      } finally {
        setLinkIssueLoading(false);
      }
    },
    [projectId]
  );

  const debouncedSearchIssues = useCallback(
    (search: string) => {
      if (linkSearchTimerRef.current) clearTimeout(linkSearchTimerRef.current);
      linkSearchTimerRef.current = setTimeout(
        () => searchIssuesForLink(search),
        300
      );
    },
    [searchIssuesForLink]
  );

  const fetchSpamKeywords = async () => {
    try {
      setSpamKeywords(await argusService.getSpamKeywords(projectId));
    } catch {
      /* ignore */
    }
  };

  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) return;
    try {
      await argusService.addSpamKeyword(
        projectId,
        newKeyword.trim(),
        newKeywordRegex
      );
      setNewKeyword('');
      setNewKeywordRegex(false);
      fetchSpamKeywords();
    } catch {
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
  };

  const handleDeleteKeyword = async (id: number) => {
    try {
      await argusService.deleteSpamKeyword(projectId, id);
      fetchSpamKeywords();
    } catch {
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
  };

  const handleRunAutoSpam = async () => {
    setSpamScanLoading(true);
    try {
      const result = await argusService.runAutoSpam(projectId);
      enqueueSnackbar(
        result.matched > 0
          ? t('argus.feedback.spamScanDone', { count: result.matched })
          : t('argus.feedback.spamScanNone'),
        { variant: result.matched > 0 ? 'success' : 'info' }
      );
      if (result.matched > 0) fetchData();
    } catch {
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    } finally {
      setSpamScanLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ─── Derived Data ───
  const items = data?.items || [];
  const total = data?.total || 0;
  const summary = data?.summary;
  const selectedFbId = urlState.fb;
  const selectedItem =
    items.find((i) => i.feedback_id === selectedFbId) || null;

  // Lazy-fetch linked issue detail when selectedItem changes
  useEffect(() => {
    if (selectedItem?.issue_id) {
      argusService
        .getIssueDetail(projectId, selectedItem.issue_id)
        .then((detail) => setLinkedIssueDetail(detail))
        .catch(() => setLinkedIssueDetail(null));
    } else {
      setLinkedIssueDetail(null);
    }
  }, [selectedItem?.issue_id, selectedItem?.feedback_id, projectId]);

  const unresolvedCount = summary?.unresolved_count || 0;
  const resolvedCount = summary?.resolved_count || 0;
  const spamCount = summary?.spam_count || 0;

  // ─── Trend Chart ───
  const chartRef = React.useRef<any>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const trendLabelsRaw = useMemo(
    () => data?.trend?.map((d) => d.day) || [],
    [data]
  );

  const trendChartData = useMemo(() => {
    if (!data?.trend) return { labels: [], datasets: [] };
    const barColors = data.trend.map((_, idx) => {
      if (dragStart !== null && dragEnd !== null) {
        const lo = Math.min(dragStart, dragEnd);
        const hi = Math.max(dragStart, dragEnd);
        if (idx >= lo && idx <= hi) return '#7c4dff';
        return alpha('#7c4dff', 0.2);
      }
      return alpha('#7c4dff', 0.6);
    });
    return {
      labels: data.trend.map((d) => {
        try {
          const dt = new Date(d.day);
          return `${dt.getMonth() + 1}/${dt.getDate()}`;
        } catch {
          return d.day;
        }
      }),
      datasets: [
        {
          label: t('argus.feedback.title'),
          data: data.trend.map((d) => Number(d.count)),
          backgroundColor: barColors,
          borderColor: 'transparent',
          borderWidth: 0,
          borderRadius: 4,
          borderSkipped: false as const,
        },
      ],
    };
  }, [data, t, dragStart, dragEnd]);

  const getBarIndex = (e: React.MouseEvent<HTMLElement>) => {
    const chart = chartRef.current;
    if (!chart) return null;
    const elements = chart.getElementsAtEventForMode(
      e.nativeEvent,
      'index',
      { intersect: false },
      false
    );
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
    if (trendLabelsRaw.length > 0 && lo >= 0 && hi < trendLabelsRaw.length) {
      const startDay = trendLabelsRaw[lo];
      const endDay = trendLabelsRaw[hi];
      try {
        const start = new Date(startDay);
        const end = new Date(endDay);
        end.setHours(23, 59, 59, 999);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          // Update filter to custom date range
          const ap = { start: start.toISOString(), end: end.toISOString() };
          setUrlState({ period: `${ap.start}|${ap.end}`, page: '1', fb: '' });
        }
      } catch {
        /* ignore */
      }
    }
  };

  const handleChartReset = () => {
    setDragStart(null);
    setDragEnd(null);
  };

  const chartOpts = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            font: { size: 10 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 15,
          },
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: {
            color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
          },
          ticks: { font: { size: 10 } },
        },
      },
    }),
    [isDark]
  );

  const statCards = [
    {
      icon: <FeedbackIcon />,
      color: '#7c4dff',
      label: t('argus.feedback.totalFeedback'),
      value: summary?.total_feedback,
    },
    {
      icon: <PeopleIcon />,
      color: '#2196f3',
      label: t('argus.feedback.uniqueUsers'),
      value: summary?.unique_users,
    },
    {
      icon: <ContactIcon />,
      color: '#4caf50',
      label: t('argus.feedback.withContact'),
      value: summary?.with_contact,
    },
    {
      icon: <TextIcon />,
      color: '#ff9800',
      label: t('argus.feedback.avgMessageLength'),
      value: summary
        ? `${Math.round(Number(summary.avg_message_length))}`
        : undefined,
    },
  ];

  const SORT_OPTIONS = [
    { value: 'newest', label: t('argus.feedback.sortNewest') },
    { value: 'oldest', label: t('argus.feedback.sortOldest') },
  ];

  // ─── RENDER ───
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 120px)',
      }}
    >
      {/* Header */}
      <PageHeader
        icon={<FeedbackIcon />}
        title={
          <ArgusBreadcrumbs
            size="title"
            paths={[{ label: t('argus.feedback.title') }]}
          />
        }
        actions={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {!loading && total > 0 && (
              <Chip
                label={formatCompactNumber(total)}
                size="small"
                sx={{
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  height: 22,
                  backgroundColor: alpha('#7c4dff', 0.1),
                  color: '#7c4dff',
                  border: 'none',
                }}
              />
            )}
            <Button
              size="small"
              startIcon={
                statsCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />
              }
              onClick={() => setStatsCollapsed(!statsCollapsed)}
              sx={{
                textTransform: 'none',
                fontSize: '0.72rem',
                color: 'text.secondary',
              }}
            >
              {statsCollapsed
                ? t('argus.feedback.showStats')
                : t('argus.feedback.hideStats')}
            </Button>
            <Tooltip title={t('argus.feedback.spamFilter')}>
              <Button
                size="small"
                startIcon={<FilterListIcon />}
                onClick={() => {
                  setSpamFilterOpen(true);
                  fetchSpamKeywords();
                }}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.72rem',
                  color: 'text.secondary',
                }}
              >
                {t('argus.feedback.spamFilter')}
              </Button>
            </Tooltip>
          </Box>
        }
      />

      {/* Filter Bar + Search + Sort */}
      <Box sx={{ flexShrink: 0, '& > div': { mb: 1.5 } }}>
        <ArgusFilterBar
          projectId={projectId}
          value={filters}
          onChange={handleFilterChange}
          onRefresh={fetchData}
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
                  config={FEEDBACK_CONFIG}
                  initialQuery={search}
                  onSearch={(q) => {
                    setSearch(q);
                    setUrlState({ page: '1', fb: '' });
                  }}
                  onChange={(q) => setSearch(q)}
                  fetchFieldValues={fetchFieldValues}
                  placeholder={t('argus.feedback.searchPlaceholder')}
                />
              </Box>
              {/* Sort */}
              <FilterChipSelect
                label={t('argus.issues.sort')}
                value={sortOrder}
                options={SORT_OPTIONS}
                anchorEl={sortAnchor}
                onOpen={(e) => setSortAnchor(e.currentTarget)}
                onClose={() => setSortAnchor(null)}
                onSelect={(v) => {
                  setUrlState({ sort: v, page: '1', fb: '' });
                }}
              />
            </>
          }
        />
      </Box>

      {/* Collapsible Stats */}
      <FeedbackStatsBar
        isDark={isDark}
        statsCollapsed={statsCollapsed}
        loading={loading}
        statCards={statCards}
        chartRef={chartRef}
        trendChartData={trendChartData}
        chartOpts={chartOpts}
        isDragging={isDragging}
        dragStart={dragStart}
        dragEnd={dragEnd}
        onChartMouseDown={handleChartMouseDown}
        onChartMouseMove={handleChartMouseMove}
        onChartMouseUp={handleChartMouseUp}
        onChartReset={handleChartReset}
      />

      {/* Status Tabs */}
      <Tabs
        value={statusTab}
        onChange={(_, v) => {
          setUrlState({ status: v, page: '1', fb: '' });
          setSelectedIds(new Set());
        }}
        sx={{
          mb: 1,
          minHeight: 30,
          flexShrink: 0,
          '& .MuiTab-root': {
            minHeight: 30,
            py: 0.3,
            textTransform: 'none',
            fontSize: '0.75rem',
            fontWeight: 600,
          },
          '& .MuiTabs-indicator': { height: 2 },
        }}
      >
        <Tab
          value="unresolved"
          label={`${t('argus.feedback.statusUnresolved')} (${formatCompactNumber(unresolvedCount)})`}
        />
        <Tab
          value="resolved"
          label={`${t('argus.feedback.statusResolved')} (${formatCompactNumber(resolvedCount)})`}
        />
        <Tab
          value="spam"
          label={`${t('argus.feedback.statusSpam')} (${formatCompactNumber(spamCount)})`}
        />
        <Tab value="" label={t('argus.feedback.statusAll')} />
      </Tabs>

      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <Paper
          elevation={0}
          sx={{
            mb: 1,
            p: 0.8,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            border: `1px solid ${alpha('#7c4dff', 0.3)}`,
            borderRadius: 1.5,
            backgroundColor: alpha('#7c4dff', 0.04),
            flexShrink: 0,
          }}
        >
          <Typography
            variant="body2"
            fontWeight={600}
            sx={{ fontSize: '0.76rem' }}
          >
            {selectedIds.size} {t('argus.issues.selected')}
          </Typography>
          <Button
            size="small"
            startIcon={<ResolveIcon />}
            onClick={() => handleBulkAction('resolve')}
            sx={{
              textTransform: 'none',
              fontSize: '0.72rem',
              borderRadius: '6px',
            }}
          >
            {t('argus.feedback.resolve')}
          </Button>
          <Button
            size="small"
            startIcon={<SpamIcon />}
            onClick={() => handleBulkAction('spam')}
            sx={{
              textTransform: 'none',
              fontSize: '0.72rem',
              borderRadius: '6px',
            }}
          >
            {t('argus.feedback.markSpam')}
          </Button>
          <Button
            size="small"
            startIcon={<AssignIcon />}
            onClick={(e) => setBulkAssignAnchor(e.currentTarget)}
            sx={{
              textTransform: 'none',
              fontSize: '0.72rem',
              borderRadius: '6px',
            }}
          >
            {t('argus.feedback.assign')}
          </Button>
          <Button
            size="small"
            onClick={() => setSelectedIds(new Set())}
            sx={{ textTransform: 'none', fontSize: '0.72rem', ml: 'auto' }}
          >
            {t('common.cancel')}
          </Button>
        </Paper>
      )}

      {/* ═══════ SPLIT-PANEL INBOX ═══════ */}
      <Box
        ref={splitContainerRef}
        sx={{
          flex: 1,
          display: 'flex',
          gap: 0,
          overflow: 'hidden',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          borderRadius: 2,
        }}
      >
        {/* ─── LEFT: Feedback List ─── */}
        <Box
          sx={{
            width: splitWidth,
            minWidth: MIN_SPLIT_WIDTH,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            transition: isSplitDragging ? 'none' : 'width 0.2s',
            overflow: 'hidden',
          }}
        >
          <PageContentLoader
            loading={loading}
            sx={{
              flex: 1,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {items.length === 0 ? (
              <EmptyPlaceholder
                message={t('argus.feedback.noFeedback')}
                sx={{ flex: 1, border: 'none' }}
              />
            ) : (
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                {items.map((item) => (
                  <FeedbackListItem
                    key={item.feedback_id}
                    item={item}
                    isActive={selectedFbId === item.feedback_id}
                    isSelected={selectedIds.has(item.feedback_id)}
                    isDark={isDark}
                    searchHighlight={searchDebounce}
                    onSelect={() => {
                      setUrlState({ fb: item.feedback_id });
                      if (!item.is_read) {
                        argusService
                          .markFeedbackRead(projectId, [item.feedback_id])
                          .catch(() => {});
                        item.is_read = 1;
                      }
                    }}
                    onToggleCheck={() => toggleSelect(item.feedback_id)}
                  />
                ))}
              </Box>
            )}

            {/* Pagination */}
            {total > 0 && (
              <Box
                sx={{
                  flexShrink: 0,
                  borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                }}
              >
                <SimplePagination
                  count={total}
                  page={page - 1}
                  rowsPerPage={rowsPerPage}
                  onPageChange={(_, newPage) =>
                    setUrlState({ page: String(newPage + 1), fb: '' })
                  }
                  onRowsPerPageChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setUrlState({ page: '1', fb: '' });
                  }}
                  rowsPerPageOptions={VALID_PAGE_SIZES}
                  size="small"
                />
              </Box>
            )}
          </PageContentLoader>
        </Box>

        {/* ─── Resizable Splitter Handle ─── */}
        <Box
          onMouseDown={handleSplitterMouseDown}
          sx={{
            width: '1px',
            flexShrink: 0,
            cursor: 'col-resize',
            bgcolor: isSplitDragging ? 'primary.main' : 'divider',
            position: 'relative',
            zIndex: 10,
            transition: 'background-color 0.15s, transform 0.15s',
            transformOrigin: 'center',
            ...(isSplitDragging && {
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

        {/* ─── RIGHT: Detail Panel ─── */}
        {selectedItem ? (
          <Box
            sx={{
              flex: 1,
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Detail Header */}
            <Box
              sx={{
                px: 2.5,
                py: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.02)'
                  : 'rgba(0,0,0,0.015)',
                flexShrink: 0,
              }}
            >
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  backgroundColor: stringToColor(
                    selectedItem.name || selectedItem.email || 'A'
                  ),
                }}
              >
                {getInitials(
                  selectedItem.name || selectedItem.email?.split('@')[0] || 'A'
                )}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body1"
                  fontWeight={700}
                  sx={{ fontSize: '0.9rem' }}
                >
                  {selectedItem.name ||
                    selectedItem.email?.split('@')[0] ||
                    t('argus.feedback.anonymous')}
                </Typography>
                {selectedItem.email && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: isDark ? '#888' : '#777',
                      fontSize: '0.72rem',
                    }}
                  >
                    {selectedItem.email}
                  </Typography>
                )}
              </Box>
              <Chip
                label={t(
                  `argus.feedback.status${(selectedItem.status || 'unresolved').charAt(0).toUpperCase() + (selectedItem.status || 'unresolved').slice(1)}`,
                  selectedItem.status
                )}
                size="small"
                sx={{
                  height: 22,
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  backgroundColor: alpha(
                    statusColor(selectedItem.status),
                    0.12
                  ),
                  color: statusColor(selectedItem.status),
                  border: 'none',
                }}
              />
              <Typography
                variant="caption"
                sx={{ color: isDark ? '#666' : '#999', fontSize: '0.68rem' }}
              >
                {formatRelativeTime(selectedItem.submitted_at)}
              </Typography>
            </Box>

            {/* Detail Actions — Unified Toolbar */}
            <Box
              sx={{
                px: 2,
                py: 0.8,
                display: 'flex',
                alignItems: 'center',
                gap: 0,
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                flexShrink: 0,
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.015)'
                  : 'rgba(0,0,0,0.01)',
              }}
            >
              {/* Status action group */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}
              >
                {selectedItem.status !== 'resolved' ? (
                  <Button
                    size="small"
                    startIcon={
                      <ResolveIcon sx={{ fontSize: '14px !important' }} />
                    }
                    onClick={() =>
                      handleUpdateStatus(selectedItem.feedback_id, 'resolved')
                    }
                    sx={{
                      textTransform: 'none',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      px: 1.2,
                      minHeight: 30,
                      borderRadius: 0,
                      color: isDark ? '#66bb6a' : '#2e7d32',
                      '&:hover': {
                        backgroundColor: alpha('#4caf50', isDark ? 0.15 : 0.08),
                      },
                    }}
                  >
                    {t('argus.feedback.resolve')}
                  </Button>
                ) : (
                  <Button
                    size="small"
                    startIcon={
                      <UnresolveIcon sx={{ fontSize: '14px !important' }} />
                    }
                    onClick={() =>
                      handleUpdateStatus(selectedItem.feedback_id, 'unresolved')
                    }
                    sx={{
                      textTransform: 'none',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      px: 1.2,
                      minHeight: 30,
                      borderRadius: 0,
                      color: isDark ? '#ffb74d' : '#e65100',
                      '&:hover': {
                        backgroundColor: alpha('#ff9800', isDark ? 0.15 : 0.08),
                      },
                    }}
                  >
                    {t('argus.feedback.unresolve')}
                  </Button>
                )}
                {!selectedItem.is_spam && (
                  <>
                    <Divider
                      orientation="vertical"
                      flexItem
                      sx={{
                        borderColor: isDark
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(0,0,0,0.08)',
                      }}
                    />
                    <Button
                      size="small"
                      startIcon={
                        <SpamIcon sx={{ fontSize: '14px !important' }} />
                      }
                      onClick={() => handleMarkSpam(selectedItem.feedback_id)}
                      sx={{
                        textTransform: 'none',
                        fontSize: '0.72rem',
                        fontWeight: 500,
                        px: 1.2,
                        minHeight: 30,
                        borderRadius: 0,
                        color: isDark
                          ? 'rgba(255,255,255,0.5)'
                          : 'rgba(0,0,0,0.5)',
                        '&:hover': {
                          backgroundColor: isDark
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(0,0,0,0.04)',
                        },
                      }}
                    >
                      {t('argus.feedback.markSpam')}
                    </Button>
                  </>
                )}
                <Divider
                  orientation="vertical"
                  flexItem
                  sx={{
                    borderColor: isDark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(0,0,0,0.08)',
                  }}
                />
                <Button
                  size="small"
                  startIcon={
                    <AssignIcon sx={{ fontSize: '14px !important' }} />
                  }
                  onClick={(e) =>
                    setAssigneeAnchor({
                      el: e.currentTarget,
                      feedbackId: selectedItem.feedback_id,
                    })
                  }
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.72rem',
                    fontWeight: 500,
                    px: 1.2,
                    minHeight: 30,
                    borderRadius: 0,
                    color: isDark ? '#b388ff' : '#5e35b1',
                    '&:hover': {
                      backgroundColor: alpha('#7c4dff', isDark ? 0.12 : 0.06),
                    },
                  }}
                >
                  {selectedItem.assigned_to || t('argus.feedback.assign')}
                </Button>
              </Box>

              <Box sx={{ flex: 1 }} />

              {/* Issue linking group */}
              {selectedItem.issue_id ? (
                (() => {
                  const issueColor =
                    selectedItem.issue_status === 'resolved'
                      ? '#4caf50'
                      : selectedItem.issue_status === 'ignored'
                        ? '#9e9e9e'
                        : '#ff9800';
                  const issueTextColor =
                    selectedItem.issue_status === 'resolved'
                      ? isDark
                        ? '#66bb6a'
                        : '#2e7d32'
                      : selectedItem.issue_status === 'ignored'
                        ? isDark
                          ? '#bdbdbd'
                          : '#616161'
                        : isDark
                          ? '#ffb74d'
                          : '#e65100';
                  return (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        border: `1px solid ${alpha(issueColor, isDark ? 0.3 : 0.25)}`,
                        borderRadius: '8px',
                        overflow: 'hidden',
                      }}
                    >
                      <Button
                        size="small"
                        startIcon={
                          <BugReportIcon sx={{ fontSize: '14px !important' }} />
                        }
                        onClick={() =>
                          navigate(
                            `/argus/issues/${projectId}/${selectedItem.issue_id}`,
                            { state: { from: 'feedback' } }
                          )
                        }
                        sx={{
                          textTransform: 'none',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          px: 1.2,
                          minHeight: 30,
                          borderRadius: 0,
                          color: issueTextColor,
                          '&:hover': {
                            backgroundColor: alpha(
                              issueColor,
                              isDark ? 0.15 : 0.08
                            ),
                          },
                        }}
                      >
                        #{selectedItem.issue_id}{' '}
                        {selectedItem.issue_status || ''}
                      </Button>
                    </Box>
                  );
                })()
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    borderRadius: '8px',
                    overflow: 'hidden',
                  }}
                >
                  <Button
                    size="small"
                    startIcon={
                      <LinkIcon sx={{ fontSize: '14px !important' }} />
                    }
                    onClick={() => {
                      setLinkIssueSearch('');
                      setLinkIssueResults([]);
                      setLinkIssueOpen(true);
                      searchIssuesForLink('');
                    }}
                    sx={{
                      textTransform: 'none',
                      fontSize: '0.72rem',
                      fontWeight: 500,
                      px: 1.2,
                      minHeight: 30,
                      borderRadius: 0,
                      color: isDark ? '#64b5f6' : '#1565c0',
                      '&:hover': {
                        backgroundColor: alpha('#2196f3', isDark ? 0.12 : 0.06),
                      },
                    }}
                  >
                    {t('argus.feedback.linkExistingIssue')}
                  </Button>
                  <Divider
                    orientation="vertical"
                    flexItem
                    sx={{
                      borderColor: isDark
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(0,0,0,0.08)',
                    }}
                  />
                  <Button
                    size="small"
                    startIcon={<AddIcon sx={{ fontSize: '14px !important' }} />}
                    onClick={async () => {
                      setCreateIssueFeedbackId(selectedItem.feedback_id);
                      setCreateIssueTitle(
                        `[Feedback] ${selectedItem.message.slice(0, 80)}`
                      );
                      setSelectedTrackerId('');
                      try {
                        setIssueTrackers(
                          await argusService.listIssueTrackers(projectId)
                        );
                      } catch {
                        /* ok */
                      }
                      setCreateIssueOpen(true);
                    }}
                    sx={{
                      textTransform: 'none',
                      fontSize: '0.72rem',
                      fontWeight: 500,
                      px: 1.2,
                      minHeight: 30,
                      borderRadius: 0,
                      color: isDark ? '#7986cb' : '#283593',
                      '&:hover': {
                        backgroundColor: alpha('#3f51b5', isDark ? 0.12 : 0.06),
                      },
                    }}
                  >
                    {t('argus.feedback.createIssue')}
                  </Button>
                </Box>
              )}
            </Box>

            {/* Detail Body */}
            <Box sx={{ flex: 1, overflow: 'auto', px: 2.5, py: 2 }}>
              {/* Message */}
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  mb: 2,
                  borderRadius: 2,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.02)'
                    : 'rgba(0,0,0,0.01)',
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    lineHeight: 1.8,
                    fontSize: '0.88rem',
                  }}
                >
                  {selectedItem.message}
                </Typography>
              </Paper>

              {/* Linked Issue Card */}
              {selectedItem.issue_id && (
                <Paper
                  elevation={0}
                  sx={{
                    mb: 2,
                    borderRadius: 2,
                    overflow: 'hidden',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                  }}
                >
                  <Box
                    sx={{
                      px: 1.5,
                      py: 0.6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.03)'
                        : 'rgba(0,0,0,0.02)',
                      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                    }}
                  >
                    <BugReportIcon
                      sx={{ fontSize: 14, color: 'text.secondary' }}
                    />
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      sx={{
                        fontSize: '0.7rem',
                        color: 'text.secondary',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      {t('argus.feedback.linkedIssue', 'Linked Issue')}
                    </Typography>
                  </Box>
                  <Box sx={{ px: 2, py: 1.5 }}>
                    {/* Issue title + status */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1,
                        mb: 1,
                      }}
                    >
                      {(() => {
                        const issueColor =
                          selectedItem.issue_status === 'resolved'
                            ? '#4caf50'
                            : selectedItem.issue_status === 'ignored'
                              ? '#9e9e9e'
                              : '#ff9800';
                        return (
                          <Chip
                            label={selectedItem.issue_status || 'unresolved'}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.6rem',
                              fontWeight: 700,
                              backgroundColor: alpha(issueColor, 0.12),
                              color: issueColor,
                              border: 'none',
                              flexShrink: 0,
                            }}
                          />
                        );
                      })()}
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          lineHeight: 1.4,
                          '&:hover': { textDecoration: 'underline' },
                        }}
                        onClick={() =>
                          navigate(
                            `/argus/issues/${projectId}/${selectedItem.issue_id}`,
                            { state: { from: 'feedback' } }
                          )
                        }
                      >
                        {selectedItem.issue_title ||
                          `Issue #${selectedItem.issue_id}`}
                      </Typography>
                    </Box>

                    {/* Issue meta from lazy-fetched detail */}
                    <Box
                      sx={{
                        display: 'flex',
                        gap: 2,
                        mb: 1.5,
                        flexWrap: 'wrap',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ fontSize: '0.68rem', color: 'text.disabled' }}
                      >
                        #{selectedItem.issue_id}
                      </Typography>
                      {linkedIssueDetail && (
                        <>
                          <Typography
                            variant="caption"
                            sx={{ fontSize: '0.68rem', color: 'text.disabled' }}
                          >
                            {t('argus.issues.events', 'Events')}:{' '}
                            {formatWithCommas(linkedIssueDetail.event_count)}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ fontSize: '0.68rem', color: 'text.disabled' }}
                          >
                            {t('argus.issues.users', 'Users')}:{' '}
                            {formatWithCommas(linkedIssueDetail.user_count)}
                          </Typography>
                        </>
                      )}
                    </Box>

                    {/* Actions */}
                    <Box sx={{ display: 'flex', gap: 0.75 }}>
                      <Button
                        size="small"
                        startIcon={
                          <OpenIcon sx={{ fontSize: '14px !important' }} />
                        }
                        onClick={() =>
                          navigate(
                            `/argus/issues/${projectId}/${selectedItem.issue_id}`,
                            { state: { from: 'feedback' } }
                          )
                        }
                        sx={{
                          textTransform: 'none',
                          fontSize: '0.68rem',
                          fontWeight: 500,
                          borderRadius: '6px',
                          px: 1.5,
                          minHeight: 26,
                          backgroundColor: alpha(
                            '#2196f3',
                            isDark ? 0.12 : 0.08
                          ),
                          color: isDark ? '#64b5f6' : '#1565c0',
                          border: `1px solid ${alpha('#2196f3', isDark ? 0.25 : 0.2)}`,
                          '&:hover': {
                            backgroundColor: alpha(
                              '#2196f3',
                              isDark ? 0.2 : 0.14
                            ),
                          },
                        }}
                      >
                        {t('argus.feedback.viewIssue')}
                      </Button>
                      <Button
                        size="small"
                        onClick={handleUnlinkIssue}
                        sx={{
                          textTransform: 'none',
                          fontSize: '0.68rem',
                          fontWeight: 500,
                          borderRadius: '6px',
                          px: 1.5,
                          minHeight: 26,
                          backgroundColor: alpha(
                            '#f44336',
                            isDark ? 0.12 : 0.08
                          ),
                          color: isDark ? '#ef9a9a' : '#c62828',
                          border: `1px solid ${alpha('#f44336', isDark ? 0.25 : 0.2)}`,
                          '&:hover': {
                            backgroundColor: alpha(
                              '#f44336',
                              isDark ? 0.2 : 0.14
                            ),
                          },
                        }}
                      >
                        {t('argus.feedback.unlinkIssue')}
                      </Button>
                    </Box>
                  </Box>
                </Paper>
              )}

              {/* Attachments */}
              {selectedItem.attachments?.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography
                    variant="caption"
                    fontWeight={600}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      mb: 1,
                      fontSize: '0.72rem',
                      color: 'text.secondary',
                    }}
                  >
                    <ImageIcon sx={{ fontSize: 14 }} />{' '}
                    {t('argus.feedback.attachments')} (
                    {selectedItem.attachments.length})
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {selectedItem.attachments.map((url, ai) => (
                      <Box
                        key={ai}
                        onClick={() => setLightboxUrl(url)}
                        sx={{
                          width: 188,
                          height: 141,
                          borderRadius: 1.5,
                          overflow: 'hidden',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          '&:hover': {
                            borderColor: '#7c4dff',
                            transform: 'scale(1.03)',
                          },
                        }}
                      >
                        <img
                          src={url}
                          alt={`attachment-${ai}`}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}

              {/* Metadata Section */}
              <Typography
                variant="caption"
                fontWeight={600}
                sx={{
                  display: 'block',
                  mb: 1,
                  fontSize: '0.72rem',
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                {t('argus.feedback.metadata')}
              </Typography>
              <Paper
                elevation={0}
                sx={{
                  mb: 2,
                  borderRadius: 2,
                  overflow: 'hidden',
                  backgroundColor: 'transparent',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                }}
              >
                {[
                  {
                    icon: <UrlIcon sx={{ fontSize: 14 }} />,
                    label: 'URL',
                    value: selectedItem.url,
                  },
                  {
                    icon: <MailIcon sx={{ fontSize: 14 }} />,
                    label: t('argus.feedback.contactEmail'),
                    value: selectedItem.contact_email,
                  },
                  {
                    icon: <EnvIcon sx={{ fontSize: 14 }} />,
                    label: t('argus.feedback.environment'),
                    value: selectedItem.environment,
                  },
                  {
                    icon: <ReleaseIcon sx={{ fontSize: 14 }} />,
                    label: t('argus.feedback.release'),
                    value: selectedItem.release,
                  },
                  {
                    icon: <SourceIcon sx={{ fontSize: 14 }} />,
                    label: t('argus.feedback.source'),
                    value: selectedItem.source,
                  },
                  {
                    icon: <BrowserIcon sx={{ fontSize: 14 }} />,
                    label: t('argus.feedback.browser'),
                    value: selectedItem.browser
                      ? `${selectedItem.browser}${selectedItem.browser_version ? ` ${selectedItem.browser_version}` : ''}`
                      : '',
                  },
                  {
                    icon: <OsIcon sx={{ fontSize: 14 }} />,
                    label: t('argus.feedback.os'),
                    value: selectedItem.os
                      ? `${selectedItem.os}${selectedItem.os_version ? ` ${selectedItem.os_version}` : ''}`
                      : '',
                  },
                  {
                    icon: <DeviceIcon sx={{ fontSize: 14 }} />,
                    label: t('argus.feedback.device'),
                    value: selectedItem.device,
                  },
                  {
                    icon: <UserIdIcon sx={{ fontSize: 14 }} />,
                    label: t('argus.feedback.userId'),
                    value: selectedItem.user_id,
                  },
                ]
                  .filter((row) => row.value)
                  .map((row, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        px: 1.5,
                        py: 0.8,
                        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                        '&:last-child': { borderBottom: 'none' },
                      }}
                    >
                      <Box
                        sx={{
                          color: isDark ? '#666' : '#aaa',
                          display: 'flex',
                        }}
                      >
                        {row.icon}
                      </Box>
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 600,
                          color: 'text.secondary',
                          fontSize: '0.7rem',
                          minWidth: 80,
                        }}
                      >
                        {row.label}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '0.72rem',
                          wordBreak: 'break-all',
                          flex: 1,
                        }}
                      >
                        {row.value}
                      </Typography>
                      <CopyButton text={row.value as string} size={14} />
                    </Box>
                  ))}
              </Paper>

              {/* Tags */}
              {selectedItem.tags &&
                Object.keys(selectedItem.tags).length > 0 && (
                  <>
                    <Typography
                      variant="caption"
                      fontWeight={600}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        mb: 1,
                        fontSize: '0.72rem',
                        color: 'text.secondary',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      <TagIcon sx={{ fontSize: 14 }} />{' '}
                      {t('argus.feedback.tags')}
                    </Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        gap: 0.5,
                        flexWrap: 'wrap',
                        mb: 2,
                      }}
                    >
                      {Object.entries(selectedItem.tags).map(([k, v]) => (
                        <Chip
                          key={k}
                          label={`${k}: ${v}`}
                          size="small"
                          sx={{
                            height: 22,
                            fontSize: '0.65rem',
                            backgroundColor: alpha(
                              theme.palette.primary.main,
                              0.08
                            ),
                            border: 'none',
                          }}
                        />
                      ))}
                    </Box>
                  </>
                )}

              {/* Activity Timeline */}
              <FeedbackActivityTimeline
                projectId={projectId}
                feedbackId={selectedItem.feedback_id}
                isDark={isDark}
              />
            </Box>
          </Box>
        ) : (
          /* Empty Detail Placeholder */
          items.length > 0 &&
          !loading && (
            <EmptyPlaceholder
              message={t(
                'argus.feedback.emptySelection',
                '피드백을 선택하면 상세 내용을 확인할 수 있습니다.'
              )}
              sx={{ flex: 1, border: 'none', height: '100%' }}
            />
          )
        )}
      </Box>

      {/* ═══════ DIALOGS & MENUS ═══════ */}

      {/* Spam Filter Dialog */}
      <Dialog
        open={spamFilterOpen}
        onClose={() => setSpamFilterOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle
          sx={{
            fontSize: '0.9rem',
            fontWeight: 700,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterListIcon sx={{ fontSize: 20, color: '#ff9800' }} />
            {t('argus.feedback.spamFilter')}
          </Box>
          <IconButton size="small" onClick={() => setSpamFilterOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              display: 'block',
              mb: 2,
              fontSize: '0.75rem',
            }}
          >
            {t('argus.feedback.spamFilterDesc')}
          </Typography>

          {/* Add keyword */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              size="small"
              fullWidth
              placeholder={t('argus.feedback.spamKeywordPlaceholder')}
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.82rem' } }}
            />
            <Tooltip title={t('argus.feedback.regexToggle')}>
              <Chip
                label=".*"
                size="small"
                onClick={() => setNewKeywordRegex(!newKeywordRegex)}
                sx={{
                  height: 32,
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: newKeywordRegex
                    ? alpha('#ff9800', 0.15)
                    : 'transparent',
                  color: newKeywordRegex ? '#ff9800' : 'text.disabled',
                  border: `1px solid ${newKeywordRegex ? '#ff9800' : 'rgba(128,128,128,0.3)'}`,
                }}
              />
            </Tooltip>
            <Button
              variant="contained"
              size="small"
              onClick={handleAddKeyword}
              disabled={!newKeyword.trim()}
              sx={{ textTransform: 'none', minWidth: 60, fontWeight: 700 }}
            >
              {t('common.add')}
            </Button>
          </Box>

          {/* Keyword list */}
          {spamKeywords.length === 0 ? (
            <Box sx={{ py: 3, textAlign: 'center' }}>
              <FilterListIcon
                sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }}
              />
              <Typography color="text.disabled" sx={{ fontSize: '0.82rem' }}>
                {t('argus.feedback.noSpamKeywords')}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ maxHeight: 240, overflow: 'auto' }}>
              {spamKeywords.map((kw) => (
                <Box
                  key={kw.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1.5,
                    py: 0.8,
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                    '&:hover': {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.02)'
                        : 'rgba(0,0,0,0.01)',
                    },
                  }}
                >
                  <Typography sx={{ flex: 1, fontSize: '0.82rem' }}>
                    {kw.keyword}
                  </Typography>
                  {kw.is_regex && (
                    <Chip
                      label="regex"
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.58rem',
                        fontWeight: 700,
                        backgroundColor: alpha('#ff9800', 0.1),
                        color: '#ff9800',
                        border: 'none',
                      }}
                    />
                  )}
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteKeyword(kw.id)}
                    sx={{
                      color: 'text.disabled',
                      '&:hover': { color: '#f44336' },
                    }}
                  >
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RunIcon />}
            onClick={handleRunAutoSpam}
            disabled={spamScanLoading || spamKeywords.length === 0}
            sx={{ textTransform: 'none', fontSize: '0.78rem', fontWeight: 600 }}
          >
            {spamScanLoading
              ? t('common.loading')
              : t('argus.feedback.runSpamScan')}
          </Button>
          <Button
            onClick={() => setSpamFilterOpen(false)}
            sx={{ textTransform: 'none' }}
          >
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Issue Dialog */}
      <Dialog
        open={createIssueOpen}
        onClose={() => setCreateIssueOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: '0.9rem', fontWeight: 700 }}>
          {t('argus.feedback.createIssue')}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            size="small"
            label={t('argus.feedback.issueTitle')}
            value={createIssueTitle}
            onChange={(e) => setCreateIssueTitle(e.target.value)}
            sx={{ mt: 1 }}
          />

          {/* Issue Tracker Selection */}
          <FormControl fullWidth size="small" sx={{ mt: 2 }}>
            <InputLabel sx={{ fontSize: '0.82rem' }}>
              {t('argus.feedback.issueTracker')}
            </InputLabel>
            <Select
              value={selectedTrackerId}
              onChange={(e) =>
                setSelectedTrackerId(e.target.value as number | '')
              }
              label={t('argus.feedback.issueTracker')}
              sx={{ fontSize: '0.82rem' }}
            >
              <MenuItem value="" sx={{ fontSize: '0.82rem' }}>
                <em>{t('argus.feedback.internalOnly')}</em>
              </MenuItem>
              {issueTrackers
                .filter((tr) => tr.enabled)
                .map((tracker) => (
                  <MenuItem
                    key={tracker.id}
                    value={tracker.id}
                    sx={{ fontSize: '0.82rem' }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={tracker.provider.toUpperCase()}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          backgroundColor:
                            tracker.provider === 'jira'
                              ? 'rgba(0,82,204,0.1)'
                              : tracker.provider === 'linear'
                                ? 'rgba(94,106,210,0.1)'
                                : 'rgba(0,0,0,0.06)',
                          color:
                            tracker.provider === 'jira'
                              ? '#0052CC'
                              : tracker.provider === 'linear'
                                ? '#5E6AD2'
                                : '#333',
                          border: 'none',
                        }}
                      />
                      {tracker.name}
                    </Box>
                  </MenuItem>
                ))}
            </Select>
          </FormControl>

          {selectedItem && (
            <Paper
              elevation={0}
              sx={{
                mt: 2,
                p: 1.5,
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.03)'
                  : 'rgba(0,0,0,0.02)',
                borderRadius: 1.5,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  color: 'text.secondary',
                  fontSize: '0.68rem',
                }}
              >
                {t('argus.feedback.feedbackMessage')}:
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  mt: 0.5,
                  fontSize: '0.8rem',
                  whiteSpace: 'pre-wrap',
                  maxHeight: 120,
                  overflow: 'auto',
                }}
              >
                {selectedItem.message}
              </Typography>
            </Paper>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setCreateIssueOpen(false)}
            sx={{ textTransform: 'none' }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateIssue}
            disabled={!createIssueTitle.trim()}
            sx={{ textTransform: 'none' }}
          >
            {t('argus.feedback.createIssue')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Link Existing Issue Dialog */}
      <Dialog
        open={linkIssueOpen}
        onClose={() => setLinkIssueOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: '0.9rem', fontWeight: 700 }}>
          {t('argus.feedback.linkExistingIssue', 'Link Existing Issue')}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            size="small"
            placeholder={t('argus.feedback.searchIssue', 'Search issues...')}
            value={linkIssueSearch}
            onChange={(e) => {
              setLinkIssueSearch(e.target.value);
              debouncedSearchIssues(e.target.value);
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                </InputAdornment>
              ),
            }}
            sx={{ mt: 1, mb: 1 }}
          />
          <Box sx={{ height: 350, overflow: 'auto' }}>
            {linkIssueLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <Typography variant="caption" color="text.disabled">
                  {t('common.loading')}...
                </Typography>
              </Box>
            ) : linkIssueResults.length === 0 ? (
              <Box sx={{ py: 3, textAlign: 'center' }}>
                <Typography variant="caption" color="text.disabled">
                  {t('argus.feedback.noIssuesFound', 'No issues found')}
                </Typography>
              </Box>
            ) : (
              linkIssueResults.map((issue) => {
                const issueColor =
                  issue.status === 'resolved'
                    ? '#4caf50'
                    : issue.status === 'ignored'
                      ? '#9e9e9e'
                      : '#ff9800';
                return (
                  <Box
                    key={issue.id}
                    onClick={() => handleLinkIssue(issue.id)}
                    sx={{
                      px: 1.5,
                      py: 1,
                      cursor: 'pointer',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1,
                      '&:hover': {
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.04)'
                          : 'rgba(0,0,0,0.03)',
                      },
                    }}
                  >
                    <Chip
                      label={issue.status}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.55rem',
                        fontWeight: 700,
                        backgroundColor: alpha(issueColor, 0.12),
                        color: issueColor,
                        border: 'none',
                        flexShrink: 0,
                        mt: 0.2,
                      }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {issue.title}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ fontSize: '0.65rem', color: 'text.disabled' }}
                      >
                        #{issue.id} · {t('argus.issues.events', 'Events')}:{' '}
                        {issue.event_count} · {issue.culprit}
                      </Typography>
                    </Box>
                  </Box>
                );
              })
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setLinkIssueOpen(false)}
            sx={{ textTransform: 'none' }}
          >
            {t('common.cancel')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Lightbox */}
      <Dialog
        open={Boolean(lightboxUrl)}
        onClose={() => setLightboxUrl(null)}
        maxWidth="lg"
      >
        <DialogContent sx={{ p: 0, position: 'relative' }}>
          <IconButton
            onClick={() => setLightboxUrl(null)}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: 'rgba(0,0,0,0.5)',
              color: '#fff',
              '&:hover': { backgroundColor: 'rgba(0,0,0,0.7)' },
            }}
          >
            <CloseIcon />
          </IconButton>
          {lightboxUrl && (
            <img
              src={lightboxUrl}
              alt="attachment"
              style={{ maxWidth: '90vw', maxHeight: '80vh', display: 'block' }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Assignee Menu */}
      <Menu
        anchorEl={assigneeAnchor?.el}
        open={Boolean(assigneeAnchor)}
        onClose={() => setAssigneeAnchor(null)}
        slotProps={{
          paper: {
            sx: {
              borderRadius: 2,
              minWidth: 160,
              maxHeight: 300,
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            },
          },
        }}
      >
        <MenuItem
          onClick={() =>
            handleAssignFeedback(assigneeAnchor?.feedbackId || '', '')
          }
        >
          <ListItemIcon>
            <PersonIcon sx={{ fontSize: 18 }} />
          </ListItemIcon>
          <ListItemText
            primary={t('argus.issues.unassigned')}
            primaryTypographyProps={{ fontSize: '0.82rem' }}
          />
        </MenuItem>
        <Divider />
        {members.map((member) => {
          const dn = member.name || member.email || member.userId;
          return (
            <MenuItem
              key={member.userId}
              onClick={() =>
                handleAssignFeedback(assigneeAnchor?.feedbackId || '', dn)
              }
            >
              <Avatar
                sx={{
                  width: 20,
                  height: 20,
                  mr: 1,
                  fontSize: '0.55rem',
                  fontWeight: 700,
                  backgroundColor: stringToColor(dn),
                }}
              >
                {getInitials(dn)}
              </Avatar>
              <ListItemText
                primary={dn}
                primaryTypographyProps={{ fontSize: '0.82rem' }}
              />
            </MenuItem>
          );
        })}
      </Menu>

      {/* Bulk Assignee Menu */}
      <Menu
        anchorEl={bulkAssignAnchor}
        open={Boolean(bulkAssignAnchor)}
        onClose={() => setBulkAssignAnchor(null)}
        slotProps={{
          paper: {
            sx: {
              borderRadius: 2,
              minWidth: 160,
              maxHeight: 300,
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            },
          },
        }}
      >
        <MenuItem onClick={() => handleBulkAssign('')}>
          <ListItemIcon>
            <PersonIcon sx={{ fontSize: 18 }} />
          </ListItemIcon>
          <ListItemText
            primary={t('argus.issues.unassigned')}
            primaryTypographyProps={{ fontSize: '0.82rem' }}
          />
        </MenuItem>
        <Divider />
        {members.map((member) => {
          const dn = member.name || member.email || member.userId;
          return (
            <MenuItem key={member.userId} onClick={() => handleBulkAssign(dn)}>
              <Avatar
                sx={{
                  width: 20,
                  height: 20,
                  mr: 1,
                  fontSize: '0.55rem',
                  fontWeight: 700,
                  backgroundColor: stringToColor(dn),
                }}
              >
                {getInitials(dn)}
              </Avatar>
              <ListItemText
                primary={dn}
                primaryTypographyProps={{ fontSize: '0.82rem' }}
              />
            </MenuItem>
          );
        })}
      </Menu>

      <ConfirmDialog
        open={confirmConfig.open}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onClose={() => setConfirmConfig((p) => ({ ...p, open: false }))}
        onConfirm={confirmConfig.onConfirm}
        confirmText={confirmConfig.confirmText}
        confirmColor={confirmConfig.confirmColor}
      />
    </Box>
  );
};

export default ArgusFeedbackPage;
