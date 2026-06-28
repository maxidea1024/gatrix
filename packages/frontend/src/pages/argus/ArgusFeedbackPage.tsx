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
import { useAuth } from '@/contexts/AuthContext';
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
import useGlobalPageSize from '@/hooks/useGlobalPageSize';
import { useResizableSplit } from '@/hooks/useResizableSplit';
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
  resolveSearchMagicValues,
  type QueryAQLEditorHandle,
  type DomainConfig,
  type QueryField,
} from '@/components/argus/query-aql';
import {
  PageContainer,
  TotalCountChip,
  SplitContainer,
  ListPanel,
  SplitterHandle,
  PaginationWrapper,
} from './ArgusFeedbackPage.styles';
import FacetSidebar, { FacetGroup } from '@/components/argus/FacetSidebar';
import { ARGUS_SEMANTIC } from './argusThemeTokens';

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

// ─── Main Component ───
const ArgusFeedbackPage: React.FC = () => {
  const { user } = useAuth();
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
      start: { key: 'start', default: '' },
      end: { key: 'end', default: '' },
      status: { key: 'status', default: '' },
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
  const [rowsPerPage, setRowsPerPage] = useGlobalPageSize();

  const [filters, setFilters] = useState<ArgusFilterState>(() =>
    defaultArgusFilterState(urlState.period)
  );

  useEffect(() => {
    setFilters((prev) => {
      if (urlState.period === 'custom') {
        if (urlState.start && urlState.end) {
          return {
            ...prev,
            dateRange: {
              type: 'custom',
              start: new Date(urlState.start),
              end: new Date(urlState.end),
            },
          };
        }
        return {
          ...prev,
          dateRange: { type: 'preset', preset: '14d' },
        };
      }
      return {
        ...prev,
        dateRange: { type: 'preset', preset: urlState.period },
      };
    });
  }, [urlState.period, urlState.start, urlState.end]);

  useEffect(() => {
    if (urlState.period === 'custom' && (!urlState.start || !urlState.end)) {
      setUrlState({ period: '14d' });
    }
  }, [urlState.period, urlState.start, urlState.end, setUrlState]);

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
          {
            period: urlState.period,
            start: urlState.start,
            end: urlState.end,
          }
        );
        return data.map((d) => d.attr_value);
      } catch {
        return [];
      }
    },
    [projectId, urlState.period, urlState.start, urlState.end]
  );

  const [search, setSearch] = useState('');
  const dslEditorRef = useRef<QueryAQLEditorHandle>(null);
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
  const {
    splitWidth,
    isDragging: isSplitDragging,
    handleMouseDown: handleSplitterMouseDown,
    panelRef: splitPanelRef,
  } = useResizableSplit({
    storageKey: SPLIT_WIDTH_KEY,
    defaultWidth: DEFAULT_SPLIT_WIDTH,
    minWidth: MIN_SPLIT_WIDTH,
    maxWidth: MAX_SPLIT_WIDTH,
  });
  const splitContainerRef = React.useRef<HTMLDivElement>(null);

  // ─── Resizable Facet Sidebar ───
  const [facetCollapsed, setFacetCollapsed] = useState(() => {
    return localStorage.getItem(FACET_COLLAPSED_KEY) === 'true';
  });
  const {
    splitWidth: facetWidth,
    isDragging: isFacetDragging,
    handleMouseDown: handleFacetSplitterMouseDown,
    panelRef: facetPanelRef,
  } = useResizableSplit({
    storageKey: FACET_WIDTH_KEY,
    defaultWidth: DEFAULT_FACET_WIDTH,
    minWidth: MIN_FACET_WIDTH,
    maxWidth: MAX_FACET_WIDTH,
  });

  const handleToggleFacetCollapse = useCallback(() => {
    setFacetCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(FACET_COLLAPSED_KEY, String(next));
      return next;
    });
  }, []);

  // localStorage persistence is handled by useResizableSplit on mouseup

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
        search: search
          ? resolveSearchMagicValues(search, { userName: user?.name })
          : undefined,
        sort: sortOrder,
      });
      setData(result);
    } catch (error) {
      console.error('Failed to fetch feedback:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, filters, page, rowsPerPage, search, sortOrder]);

  const [facetGroups, setFacetGroups] = useState<FacetGroup[]>([]);
  const [facetsLoading, setFacetsLoading] = useState(false);
  const [discoveredTagKeys, setDiscoveredTagKeys] = useState<
    { key: string; values: string[] }[]
  >([]);
  const [rawFacets, setRawFacets] = useState<
    Record<string, { value: string; count: number }[]>
  >({});

  const fetchFacets = useCallback(async () => {
    setFacetsLoading(true);
    try {
      const data = await argusService.discoverTags(projectId, 'feedback', {
        period: urlState.period,
        start: urlState.start,
        end: urlState.end,
      });
      const tags = data.tags || {};

      // Convert discovered tags into FacetGroup format
      const groups: FacetGroup[] = Object.entries(tags)
        .filter(([, values]) => values.length > 0)
        .map(([key, values]) => ({
          key,
          label: t(`argus.facet.${key}`, key),
          values: values.map((v) => ({
            value: v.value,
            count: Number(v.count),
          })),
        }));

      setFacetGroups(groups);
      setRawFacets(tags);

      // Track discovered tag keys for AQL autocomplete
      setDiscoveredTagKeys(
        Object.entries(tags)
          .filter(([, values]) => values.length > 0)
          .map(([key, values]) => ({
            key,
            values: values.map((v) => v.value),
          }))
      );
    } catch (error) {
      console.error('Failed to fetch facets:', error);
    } finally {
      setFacetsLoading(false);
    }
    // Only re-fetch facets when time range changes — NOT on search/filter changes
  }, [projectId, urlState.period, urlState.start, urlState.end, t]);

  // Merge discovered tag keys into FEEDBACK_CONFIG for AQL autocomplete
  const mergedConfig = useMemo<DomainConfig>(() => {
    if (discoveredTagKeys.length === 0) return FEEDBACK_CONFIG;

    const existingKeys = new Set(FEEDBACK_CONFIG.fields.map((f) => f.key));
    const extraFields: QueryField[] = discoveredTagKeys
      .filter((tag) => !existingKeys.has(tag.key))
      .map((tag) => ({
        key: tag.key,
        label: tag.key,
        type: 'string' as const,
        searchable: true,
        operators: ['=' as const, '!=' as const],
        category: 'custom' as const,
        description: `Tag: ${tag.key}`,
        staticValues: tag.values,
      }));

    if (extraFields.length === 0) return FEEDBACK_CONFIG;

    return {
      ...FEEDBACK_CONFIG,
      fields: [...FEEDBACK_CONFIG.fields, ...extraFields],
    };
  }, [discoveredTagKeys]);

  // Map backend column names to frontend AQL field names for autocomplete values
  const mappedInitialFacets = useMemo(() => {
    const res: Record<string, any> = {};
    const keyMapping: Record<string, string> = {
      browser: 'browser_name',
      os: 'os_name',
      assigned_to: 'assigned',
      message: 'feedback',
    };
    for (const [key, values] of Object.entries(rawFacets)) {
      const targetKey = keyMapping[key] || key;
      res[targetKey] = values;
    }
    return res;
  }, [rawFacets]);

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
      setUrlState({
        period: newFilters.dateRange.preset,
        start: '',
        end: '',
        page: '1',
        fb: '',
      });
    } else if (
      newFilters.dateRange.type === 'custom' &&
      newFilters.dateRange.start &&
      newFilters.dateRange.end
    ) {
      setUrlState({
        period: 'custom',
        start: newFilters.dateRange.start.toISOString(),
        end: newFilters.dateRange.end.toISOString(),
        page: '1',
        fb: '',
      });
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

  const handleUnlinkIssueConfirm = useCallback(() => {
    setConfirmConfig({
      open: true,
      title: t('argus.issues.unlinkConfirmTitle', '이슈 연결 해제'),
      message: t('argus.issues.unlinkConfirm', '외부 이슈 연결을 해제하시겠습니까?'),
      confirmText: t('argus.issues.unlinkAction', '연결 해제'),
      confirmColor: 'error' as const,
      onConfirm: async () => {
        setConfirmConfig((p) => ({ ...p, open: false }));
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
      },
    });
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

  // ─── Trend Chart — transformed for ArgusVolumeChart ───
  const trendLabelsRaw = useMemo(
    () => data?.trend?.map((d) => d.day) || [],
    [data]
  );

  const { chartLabels, chartDatasets } = useMemo(() => {
    if (!data?.trend || data.trend.length === 0)
      return { chartLabels: [] as string[], chartDatasets: [] };

    const datasets = [
      {
        label: t('argus.feedback.title'),
        data: data.trend.map((d) => Number(d.count)),
        type: 'bar' as const,
        color: '#7c4dff',
      },
    ];

    return { chartLabels: [] as string[], chartDatasets: datasets };
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
              period: 'custom',
              start: start.toISOString(),
              end: end.toISOString(),
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
      value: summary ? Number(summary.total_feedback) : undefined,
    },
    {
      icon: <PeopleIcon />,
      color: ARGUS_SEMANTIC.info,
      label: t('argus.feedback.uniqueUsers'),
      value: summary ? Number(summary.unique_users) : undefined,
    },
    {
      icon: <ContactIcon />,
      color: ARGUS_SEMANTIC.positive,
      label: t('argus.feedback.withContact'),
      value: summary ? Number(summary.with_contact) : undefined,
    },
    {
      icon: <TextIcon />,
      color: ARGUS_SEMANTIC.warning,
      label: t('argus.feedback.avgMessageLength'),
      value: summary
        ? Math.round(Number(summary.avg_message_length))
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
        subtitle={t(
          'argus.feedback.subtitle',
          '사용자 피드백을 수집, 분류 및 관리합니다.'
        )}
        actions={
          !loading && total > 0 ? (
            <TotalCountChip label={formatCompactNumber(total)} size="small" />
          ) : undefined
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
                  config={mergedConfig}
                  initialQuery={search}
                  onSearch={(q) => {
                    setSearch(q);
                    setUrlState({ page: '1', fb: '' });
                  }}
                  onChange={(q) => {
                    setSearch(q);
                  }}
                  fetchFieldValues={fetchFieldValues}
                  initialFacets={mappedInitialFacets}
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
                  whiteSpace: 'nowrap',
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
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t('argus.feedback.spamFilter')}
                </Button>
              </Tooltip>
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
        chartRawPeriods={trendLabelsRaw}
        chartDatasets={chartDatasets}
        onZoom={handleChartZoom}
      />

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
          ref={facetPanelRef as React.Ref<HTMLDivElement>}
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
          ref={splitPanelRef as React.Ref<HTMLDivElement>}
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
                onUnlinkIssue={handleUnlinkIssueConfirm}
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
