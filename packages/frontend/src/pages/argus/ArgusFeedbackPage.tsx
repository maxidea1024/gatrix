import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  Box,
  Typography,
  useTheme,
  alpha,
  Button,
  Tooltip,
  Tab,
} from '@mui/material';
import {
  Feedback as FeedbackIcon,
  People as PeopleIcon,
  ContactMail as ContactIcon,
  TextFields as TextIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  FilterList as FilterListIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
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
import { useSnackbar } from 'notistack';
import PageContentLoader from '@/components/common/PageContentLoader';

import argusService, {
  ArgusFeedbackResponse,
  ArgusFeedbackItem,
  ArgusIssue,
} from '@/services/argusService';
import { rbacService } from '@/services/rbacService';
import ArgusFilterBar, {
  ArgusFilterState,
  defaultArgusFilterState,
} from '@/components/argus/ArgusFilterBar';
import { dateRangeToApiParams as argusDateRangeToApiParams } from '@/components/common/DateRangeSelector';
import { formatCompactNumber } from '@/utils/numberFormat';

import useArgusUrlState from '@/hooks/useArgusUrlState';
import SimplePagination from '@/components/common/SimplePagination';
import PageHeader from '@/components/common/PageHeader';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import FeedbackListItem from './components/FeedbackListItem';
import FeedbackStatsBar from './components/FeedbackStatsBar';
import FeedbackDetailPanel from './components/FeedbackDetailPanel';
import FeedbackBulkToolbar from './components/FeedbackBulkToolbar';
import {
  SpamFilterDialog,
  CreateIssueDialog,
  LinkIssueDialog,
} from './components/FeedbackDialogs';
import FilterChipSelect from '@/components/common/FilterChipSelect';
import {
  QueryAQLEditor,
  FEEDBACK_CONFIG,
  type QueryAQLEditorHandle,
} from '@/components/argus/query-aql';
import {
  PageContainer,
  TotalCountChip,
  FeedbackTabs,
  SplitContainer,
  ListPanel,
  SplitterHandle,
  PaginationWrapper,
} from './ArgusFeedbackPage.styles';
import FacetSidebar, { FacetGroup } from '@/components/argus/FacetSidebar';

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

const FACET_COLLAPSED_KEY = 'argus-feedback-facet-collapsed';
const FACET_WIDTH_KEY = 'argus-feedback-facet-width';
const DEFAULT_FACET_WIDTH = 220;
const MIN_FACET_WIDTH = 150;
const MAX_FACET_WIDTH = 400;

type FeedbackStatusTab = 'unresolved' | 'resolved' | 'spam' | '';

// ─── Main Component ───
const ArgusFeedbackPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
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
      fb: { key: 'fb', default: '' },
    }),
    []
  );
  const [urlState, setUrlState] = useArgusUrlState(URL_PARAMS);

  // ─── Core State ───
  const [data, setData] = useState<ArgusFeedbackResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // ─── Derived Data ───
  const items = data?.items || [];
  const total = data?.total || 0;
  const summary = data?.summary;
  const selectedFbId = urlState.fb;

  // ─── Lazy-loaded detail ───
  const [selectedItem, setSelectedItem] = useState<ArgusFeedbackItem | null>(
    null
  );
  const [selectedItemLoading, setSelectedItemLoading] = useState(false);
  const expectedFbIdRef = useRef<string | null>(null);

  // ─── Lazy-load feedback detail on selection change ───
  useEffect(() => {
    const fbId = selectedFbId || null;
    expectedFbIdRef.current = fbId;

    if (!fbId) {
      setSelectedItem(null);
      setSelectedItemLoading(false);
      return;
    }

    setSelectedItem(null);
    setSelectedItemLoading(true);

    const abortController = new AbortController();

    argusService
      .getFeedbackDetail(projectId, fbId, abortController.signal)
      .then((detail) => {
        if (expectedFbIdRef.current === fbId) {
          setSelectedItem(detail);
          setSelectedItemLoading(false);
        }
      })
      .catch(() => {
        if (expectedFbIdRef.current === fbId) {
          setSelectedItemLoading(false);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [selectedFbId, projectId]);

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
    const period = urlState.period;
    // Chart brush zoom produces "ISO|ISO" format for custom date ranges
    if (period.includes('|')) {
      const [startStr, endStr] = period.split('|');
      const start = new Date(startStr);
      const end = new Date(endStr);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        setFilters((prev) => ({
          ...prev,
          dateRange: { type: 'custom', start, end },
        }));
        return;
      }
    }
    setFilters((prev) => ({
      ...prev,
      dateRange: { type: 'preset', preset: period },
    }));
  }, [urlState.period]);

  // Lazy-loading callback for QueryAQLEditor
  const fetchFieldValues = useCallback(
    async (fieldKey: string): Promise<string[]> => {
      try {
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
  const dslEditorRef = useRef<QueryAQLEditorHandle>(null);
  const statusTab = urlState.status as FeedbackStatusTab;
  const sortOrder = urlState.sort;

  // ─── Selection ───
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortAnchor, setSortAnchor] = useState<HTMLElement | null>(null);

  // ─── Stats & UI ───
  const [statsCollapsed, setStatsCollapsed] = useState(
    () => localStorage.getItem(STATS_COLLAPSED_KEY) === 'true'
  );
  const [members, setMembers] = useState<any[]>([]);

  // ─── Dialog State ───
  const [spamFilterOpen, setSpamFilterOpen] = useState(false);
  const [createIssueOpen, setCreateIssueOpen] = useState(false);
  const [linkIssueOpen, setLinkIssueOpen] = useState(false);

  // ─── Confirm Dialog ───
  const [confirmConfig, setConfirmConfig] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    confirmColor?: 'primary' | 'error' | 'warning' | 'success';
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  // ─── Resizable Splitter ───
  const [splitWidth, setSplitWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem(SPLIT_WIDTH_KEY) || '', 10);
    return !isNaN(saved) && saved >= MIN_SPLIT_WIDTH && saved <= MAX_SPLIT_WIDTH
      ? saved
      : DEFAULT_SPLIT_WIDTH;
  });
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

  // ─── Resizable Facet Sidebar ───
  const [facetCollapsed, setFacetCollapsed] = useState(() => {
    return localStorage.getItem(FACET_COLLAPSED_KEY) === 'true';
  });
  const [facetWidth, setFacetWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem(FACET_WIDTH_KEY) || '', 10);
    return !isNaN(saved) && saved >= MIN_FACET_WIDTH && saved <= MAX_FACET_WIDTH
      ? saved
      : DEFAULT_FACET_WIDTH;
  });
  const [isFacetDragging, setIsFacetDragging] = useState(false);

  const handleFacetSplitterMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsFacetDragging(true);
      const startX = e.clientX;
      const startWidth = facetWidth;

      const onMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        const newWidth = Math.min(
          MAX_FACET_WIDTH,
          Math.max(MIN_FACET_WIDTH, startWidth + delta)
        );
        setFacetWidth(newWidth);
      };
      const onMouseUp = () => {
        setIsFacetDragging(false);
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
    [facetWidth]
  );

  const handleToggleFacetCollapse = useCallback(() => {
    setFacetCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(FACET_COLLAPSED_KEY, String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    localStorage.setItem(FACET_WIDTH_KEY, String(facetWidth));
  }, [facetWidth]);

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

  // ─── Fetch Data ───
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const ap = argusDateRangeToApiParams(filters.dateRange);
      const result = await argusService.getFeedback(projectId, {
        ...ap,
        page,
        limit: rowsPerPage,
        search: search || undefined,
        status: statusTab || undefined,
        sort: sortOrder,
      });
      setData(result);
    } catch (error) {
      console.error('Failed to fetch feedback:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, filters, page, rowsPerPage, search, statusTab, sortOrder]);

  const [facetGroups, setFacetGroups] = useState<FacetGroup[]>([]);
  const [facetsLoading, setFacetsLoading] = useState(false);

  const fetchFacets = useCallback(async () => {
    setFacetsLoading(true);
    try {
      const ap = argusDateRangeToApiParams(filters.dateRange);
      const queryParams = {
        period: urlState.period || undefined,
        start: ap.start,
        end: ap.end,
      };

      const keys = [
        {
          key: 'environment',
          label: t('argus.issues.environment', 'Environment'),
        },
        { key: 'release', label: t('argus.issues.release', 'Release') },
        { key: 'browser', label: t('argus.issues.browser', 'Browser') },
        { key: 'os', label: t('argus.issues.os', 'OS') },
        { key: 'category', label: t('argus.feedback.category', 'Category') },
        { key: 'sentiment', label: t('argus.feedback.sentiment', 'Sentiment') },
        { key: 'assigned_to', label: t('argus.issues.assignee', 'Assignee') },
      ];

      const results = await Promise.all(
        keys.map(async ({ key, label }) => {
          try {
            const data = await argusService.getFeedbackAttributeFacet(
              projectId,
              key,
              queryParams
            );
            return {
              key,
              label,
              values: data.map((d) => ({
                value: d.attr_value,
                count: Number(d.count),
              })),
            };
          } catch (err) {
            console.error(`Failed to fetch facet for ${key}:`, err);
            return { key, label, values: [] };
          }
        })
      );

      setFacetGroups(results.filter((g) => g.values.length > 0));
    } catch (error) {
      console.error('Failed to fetch facets:', error);
    } finally {
      setFacetsLoading(false);
    }
  }, [projectId, filters.dateRange, urlState.period, t]);

  useEffect(() => {
    fetchFacets();
  }, [fetchFacets]);

  const handleRefresh = useCallback(() => {
    fetchData();
    fetchFacets();
    // Also refetch detail if one is currently selected
    const fbId = expectedFbIdRef.current;
    if (fbId) {
      argusService.getFeedbackDetail(projectId, fbId).then((detail) => {
        if (expectedFbIdRef.current === fbId) {
          setSelectedItem(detail);
        }
      });
    }
  }, [fetchData, fetchFacets, projectId]);

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

  const handleUpdateStatus = useCallback(
    (feedbackId: string, status: string) => {
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
            await argusService.updateFeedback(projectId, feedbackId, {
              status,
            });
            enqueueSnackbar(t('argus.feedback.statusUpdated'), {
              variant: 'success',
            });
            handleRefresh();
          } catch {
            enqueueSnackbar(t('common.error'), { variant: 'error' });
          }
        },
      });
    },
    [projectId, t, enqueueSnackbar, handleRefresh]
  );

  const handleMarkSpam = useCallback(
    (feedbackId: string) => {
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
            handleRefresh();
          } catch {
            enqueueSnackbar(t('common.error'), { variant: 'error' });
          }
        },
      });
    },
    [projectId, t, enqueueSnackbar, handleRefresh]
  );

  const handleAssignFeedback = useCallback(
    async (feedbackId: string, assignee: string) => {
      try {
        await argusService.updateFeedback(projectId, feedbackId, {
          assigned_to: assignee,
        });
        enqueueSnackbar(t('argus.feedback.assigneeUpdated'), {
          variant: 'success',
        });
        handleRefresh();
      } catch {
        enqueueSnackbar(t('common.error'), { variant: 'error' });
      }
    },
    [projectId, t, enqueueSnackbar, handleRefresh]
  );

  const handleBulkAction = useCallback(
    (action: 'resolve' | 'unresolve' | 'spam') => {
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
            handleRefresh();
          } catch {
            enqueueSnackbar(t('common.error'), { variant: 'error' });
          }
        },
      });
    },
    [selectedIds, projectId, t, enqueueSnackbar, handleRefresh]
  );

  const handleBulkAssign = useCallback(
    async (assignee: string) => {
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
        handleRefresh();
      } catch {
        enqueueSnackbar(t('common.error'), { variant: 'error' });
      }
    },
    [selectedIds, projectId, t, enqueueSnackbar, handleRefresh]
  );

  const handleUnlinkIssue = useCallback(async () => {
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
      handleRefresh();
    } catch {
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
  }, [projectId, t, enqueueSnackbar, handleRefresh, selectedItem]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleSortOpen = useCallback(
    (e: React.MouseEvent<HTMLElement>) => setSortAnchor(e.currentTarget),
    []
  );
  const handleSortClose = useCallback(() => setSortAnchor(null), []);
  const handleSortSelect = useCallback(
    (v: string) => {
      setUrlState({ sort: v, page: '1', fb: '' });
    },
    [setUrlState]
  );

  const handleFeedbackSelect = useCallback(
    (feedbackId: string) => {
      setUrlState({ fb: feedbackId });
      // Mark as read if not already
      const found = data?.items?.find((i) => i.feedback_id === feedbackId);
      if (found && !found.is_read) {
        argusService.markFeedbackRead(projectId, [feedbackId]).catch(() => {});
        found.is_read = 1;
      }
    },
    [setUrlState, data?.items, projectId]
  );

  const handleFeedbackToggleCheck = useCallback(
    (feedbackId: string) => {
      toggleSelect(feedbackId);
    },
    [toggleSelect]
  );

  const handleClearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleOpenCreateIssue = useCallback(() => setCreateIssueOpen(true), []);
  const handleOpenLinkIssue = useCallback(() => setLinkIssueOpen(true), []);

  const handleAddFilter = useCallback(
    (field: string, value: string, exclude?: boolean) => {
      dslEditorRef.current?.upsertFieldChip(
        field,
        [value],
        exclude ? '!=' : '='
      );
    },
    []
  );

  // Lazy-fetch linked issue detail
  const [linkedIssueDetail, setLinkedIssueDetail] = useState<ArgusIssue | null>(
    null
  );

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

  // ─── Trend Chart — transformed for ArgusVolumeChart ───
  const trendLabelsRaw = useMemo(
    () => data?.trend?.map((d) => d.day) || [],
    [data]
  );

  const { chartLabels, chartDatasets } = useMemo(() => {
    if (!data?.trend || data.trend.length === 0)
      return { chartLabels: [] as string[], chartDatasets: [] };

    const labels = data.trend.map((d) => {
      try {
        const dt = new Date(d.day);
        return `${dt.getMonth() + 1}/${dt.getDate()}`;
      } catch {
        return d.day;
      }
    });

    const datasets = [
      {
        label: t('argus.feedback.title'),
        data: data.trend.map((d) => Number(d.count)),
        type: 'bar' as const,
        color: '#7c4dff',
      },
    ];

    return { chartLabels: labels, chartDatasets: datasets };
  }, [data, t]);

  const handleChartZoom = useCallback(
    (startIdx: number, endIdx: number) => {
      const lo = Math.min(startIdx, endIdx);
      const hi = Math.max(startIdx, endIdx);
      if (trendLabelsRaw.length > 0 && lo >= 0 && hi < trendLabelsRaw.length) {
        try {
          const start = new Date(trendLabelsRaw[lo]);
          const end = new Date(trendLabelsRaw[hi]);
          end.setHours(23, 59, 59, 999);
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            setUrlState({
              period: `${start.toISOString()}|${end.toISOString()}`,
              page: '1',
              fb: '',
            });
          }
        } catch {
          /* ignore */
        }
      }
    },
    [trendLabelsRaw, setUrlState]
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
    <PageContainer>
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
              <TotalCountChip label={formatCompactNumber(total)} size="small" />
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
                onClick={() => setSpamFilterOpen(true)}
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
      <Box sx={{ flexShrink: 0 }}>
        <ArgusFilterBar
          projectId={projectId}
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
          onRefresh={handleRefresh}
          loading={loading}
          extraControls={
            <>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <QueryAQLEditor
                  ref={dslEditorRef}
                  config={FEEDBACK_CONFIG}
                  initialQuery={search}
                  onSearch={(q) => {
                    setSearch(q);
                    setUrlState({ page: '1', fb: '' });
                  }}
                  fetchFieldValues={fetchFieldValues}
                  placeholder={t('argus.feedback.searchPlaceholder')}
                />
              </Box>
              <FilterChipSelect
                label={t('argus.issues.sort')}
                value={sortOrder}
                options={SORT_OPTIONS}
                anchorEl={sortAnchor}
                onOpen={handleSortOpen}
                onClose={handleSortClose}
                onSelect={handleSortSelect}
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
        chartLabels={chartLabels}
        chartDatasets={chartDatasets}
        onZoom={handleChartZoom}
      />

      {/* Status Tabs */}
      <FeedbackTabs
        value={statusTab}
        onChange={(_, v) => {
          setUrlState({ status: v, page: '1', fb: '' });
          setSelectedIds(new Set());
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
      </FeedbackTabs>

      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <FeedbackBulkToolbar
          selectedCount={selectedIds.size}
          members={members}
          onBulkAction={handleBulkAction}
          onBulkAssign={handleBulkAssign}
          onClearSelection={handleClearSelection}
        />
      )}

      {/* ═══════ SPLIT-PANEL INBOX ═══════ */}
      <SplitContainer ref={splitContainerRef} isDark={isDark}>
        {/* Facet Sidebar */}
        <FacetSidebar
          width={facetWidth}
          facets={facetGroups}
          onFilter={(key, value, exclude) => {
            const r = dslEditorRef.current;
            if (!r) return;
            const mapping: Record<string, string> = {
              browser: 'browser_name',
              os: 'os_name',
              assigned_to: 'assigned',
            };
            const fieldKey = mapping[key] || key;
            const current = r.getFieldValues(fieldKey);
            if (current.includes(value)) {
              r.upsertFieldChip(
                fieldKey,
                current.filter((v) => v !== value)
              );
            } else {
              r.upsertFieldChip(
                fieldKey,
                [...current, value],
                exclude ? '!=' : '='
              );
            }
          }}
          collapsed={facetCollapsed}
          onToggleCollapse={handleToggleFacetCollapse}
          loading={facetsLoading}
        />
        {!facetCollapsed && (
          <SplitterHandle
            isDragging={isFacetDragging}
            onMouseDown={handleFacetSplitterMouseDown}
          />
        )}

        {/* ─── LEFT: Feedback List ─── */}
        <ListPanel
          panelWidth={splitWidth}
          isDragging={isSplitDragging}
          minPanelWidth={MIN_SPLIT_WIDTH}
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
                    searchHighlight={search}
                    onSelect={handleFeedbackSelect}
                    onToggleCheck={handleFeedbackToggleCheck}
                  />
                ))}
              </Box>
            )}

            {/* Pagination */}
            {total > 0 && (
              <PaginationWrapper isDark={isDark}>
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
              </PaginationWrapper>
            )}
          </PageContentLoader>
        </ListPanel>

        {/* ─── Resizable Splitter Handle ─── */}
        <SplitterHandle
          isDragging={isSplitDragging}
          onMouseDown={handleSplitterMouseDown}
        />

        {/* ─── RIGHT: Detail Panel ─── */}
        {selectedFbId || selectedItemLoading ? (
          <PageContentLoader
            loading={selectedItemLoading}
            sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}
          >
            {selectedItem && (
              <FeedbackDetailPanel
                selectedItem={selectedItem}
                isDark={isDark}
                projectId={projectId}
                members={members}
                linkedIssueDetail={linkedIssueDetail}
                onUpdateStatus={handleUpdateStatus}
                onMarkSpam={handleMarkSpam}
                onAssignFeedback={handleAssignFeedback}
                onUnlinkIssue={handleUnlinkIssue}
                onOpenCreateIssue={handleOpenCreateIssue}
                onOpenLinkIssue={handleOpenLinkIssue}
                onAddFilter={handleAddFilter}
              />
            )}
          </PageContentLoader>
        ) : (
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
      </SplitContainer>

      {/* ═══════ DIALOGS ═══════ */}
      <SpamFilterDialog
        open={spamFilterOpen}
        onClose={() => setSpamFilterOpen(false)}
        projectId={projectId}
        onSpamScanComplete={handleRefresh}
      />

      <CreateIssueDialog
        open={createIssueOpen}
        onClose={() => setCreateIssueOpen(false)}
        projectId={projectId}
        selectedItem={selectedItem}
        onIssueCreated={handleRefresh}
      />

      <LinkIssueDialog
        open={linkIssueOpen}
        onClose={() => setLinkIssueOpen(false)}
        projectId={projectId}
        feedbackId={selectedItem?.feedback_id || ''}
        onIssueLinked={handleRefresh}
      />

      <ConfirmDialog
        open={confirmConfig.open}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onClose={() => setConfirmConfig((p) => ({ ...p, open: false }))}
        onConfirm={confirmConfig.onConfirm}
        confirmText={confirmConfig.confirmText}
        confirmColor={confirmConfig.confirmColor}
      />
    </PageContainer>
  );
};

export default ArgusFeedbackPage;
