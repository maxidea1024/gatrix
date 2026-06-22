import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Tooltip,
  Alert,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CheckCircle as ResolveIcon,
  Delete as DeleteIcon,
  HelpOutline as UnknownIcon,
  MoreVert as MoreVertIcon,
  Undo as UndoIcon,
  ContentCopy as CopyIcon,
  ViewColumn as ViewColumnIcon,
  AddCircleOutline as CreateFlagIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useEnvironment } from '../../contexts/EnvironmentContext';
import { useOrgProject } from '../../contexts/OrgProjectContext';
import {
  unknownFlagService,
  UnknownFlag,
} from '../../services/unknownFlagService';
import RelativeTime from '../../components/common/RelativeTime';
import DynamicFilterBar, {
  FilterDefinition,
  ActiveFilter,
} from '../../components/common/DynamicFilterBar';
import ColumnSettingsDialog, {
  ColumnConfig,
} from '../../components/common/ColumnSettingsDialog';
import HelpTip from '../../components/common/HelpTip';
import { copyToClipboardWithNotification } from '../../utils/clipboard';
import { useDebounce } from '../../hooks/useDebounce';
import PageContentLoader from '@/components/common/PageContentLoader';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import PageHeader from '@/components/common/PageHeader';
import PageHeaderContextMenu from '@/components/common/PageHeaderContextMenu';
import SearchTextField from '@/components/common/SearchTextField';
import SimplePagination from '../../components/common/SimplePagination';
import { useGlobalPageSize } from '../../hooks/useGlobalPageSize';
import DateRangeSelector, {
  DateRangeValue,
  dateRangeToDatePair,
} from '@/components/common/DateRangeSelector';
import ArgusVolumeChart from '@/components/argus/ArgusVolumeChart';
import { ChartDataset } from '@/components/argus/InteractiveTimeSeriesChart';

const UnknownFlagsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { currentEnvironmentId } = useEnvironment();
  const { enqueueSnackbar } = useSnackbar();
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();

  const [flags, setFlags] = useState<UnknownFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [dateRange, setDateRangeState] = useState<DateRangeValue>(() => {
    const rangeParam = searchParams.get('range');
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    if (startParam && endParam) {
      return { type: 'custom', start: new Date(startParam), end: new Date(endParam) };
    }
    if (rangeParam) {
      return { type: 'preset', preset: rangeParam };
    }
    return { type: 'preset', preset: '7d' };
  });
  const [chartGroupBy, setChartGroupBy] = useState<'all' | 'flag' | 'env' | 'app'>('all');

  // Sync dateRange to URL
  const setDateRange = useCallback((value: DateRangeValue) => {
    setDateRangeState(value);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('range');
      next.delete('start');
      next.delete('end');
      if (value.type === 'custom' && value.start && value.end) {
        next.set('start', value.start.toISOString());
        next.set('end', value.end.toISOString());
      } else if (value.type === 'preset' && value.preset) {
        next.set('range', value.preset);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useGlobalPageSize();

  // Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedFlag, setSelectedFlag] = useState<UnknownFlag | null>(null);

  // Dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: 'resolve' | 'unresolve' | 'delete';
    flag: UnknownFlag | null;
  }>({ open: false, type: 'resolve', flag: null });

  // Column settings state
  const [columnSettingsAnchor, setColumnSettingsAnchor] =
    useState<null | HTMLElement>(null);
  const defaultColumns: ColumnConfig[] = [
    { id: 'flagName', labelKey: 'featureFlags.flagName', visible: true },
    { id: 'environment', labelKey: 'common.environment', visible: true },
    { id: 'project', labelKey: 'common.project', visible: true },
    { id: 'organisation', labelKey: 'common.organisation', visible: true },
    { id: 'appName', labelKey: 'featureFlags.appName', visible: true },
    { id: 'sdkVersion', labelKey: 'featureFlags.sdkVersion', visible: true },
    { id: 'accessCount', labelKey: 'featureFlags.accessCount', visible: true },
    {
      id: 'lastReportedAt',
      labelKey: 'featureFlags.lastReported',
      visible: true,
    },
    { id: 'status', labelKey: 'common.status', visible: true },
  ];
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('unknownFlagsColumns');
    if (saved) {
      try {
        const savedColumns = JSON.parse(saved);
        const mergedColumns = savedColumns.map((savedCol: ColumnConfig) => {
          const defaultCol = defaultColumns.find((c) => c.id === savedCol.id);
          return defaultCol ? { ...defaultCol, ...savedCol } : savedCol;
        });
        const savedIds = new Set(savedColumns.map((c: ColumnConfig) => c.id));
        const newColumns = defaultColumns.filter((c) => !savedIds.has(c.id));
        return [...mergedColumns, ...newColumns];
      } catch {
        return defaultColumns;
      }
    }
    return defaultColumns;
  });

  // Extract filter values
  const statusFilter = useMemo(() => {
    const filter = activeFilters.find((f) => f.key === 'status');
    return filter?.value as string[] | undefined;
  }, [activeFilters]);

  const environmentFilter = useMemo(() => {
    const filter = activeFilters.find((f) => f.key === 'environment');
    return filter?.value as string[] | undefined;
  }, [activeFilters]);

  const projectFilter = useMemo(() => {
    const filter = activeFilters.find((f) => f.key === 'project');
    return filter?.value as string[] | undefined;
  }, [activeFilters]);

  const organisationFilter = useMemo(() => {
    const filter = activeFilters.find((f) => f.key === 'organisation');
    return filter?.value as string[] | undefined;
  }, [activeFilters]);

  const appNameFilter = useMemo(() => {
    const filter = activeFilters.find((f) => f.key === 'appName');
    return filter?.value as string[] | undefined;
  }, [activeFilters]);

  const sdkVersionFilter = useMemo(() => {
    const filter = activeFilters.find((f) => f.key === 'sdkVersion');
    return filter?.value as string[] | undefined;
  }, [activeFilters]);

  // Build dynamic options from loaded flags data
  const environmentOptions = useMemo(() => {
    const unique = new Map<string, string>();
    for (const f of flags) {
      const key = f.environmentId;
      if (key && !unique.has(key)) {
        unique.set(key, f.environmentName || f.environmentId);
      }
    }
    return Array.from(unique.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [flags]);

  const projectOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const f of flags) {
      if (f.projectName) unique.add(f.projectName);
    }
    return Array.from(unique)
      .sort()
      .map((v) => ({ value: v, label: v }));
  }, [flags]);

  const organisationOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const f of flags) {
      if (f.orgName) unique.add(f.orgName);
    }
    return Array.from(unique)
      .sort()
      .map((v) => ({ value: v, label: v }));
  }, [flags]);

  const appNameOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const f of flags) {
      if (f.appName) unique.add(f.appName);
    }
    return Array.from(unique)
      .sort()
      .map((v) => ({ value: v, label: v }));
  }, [flags]);

  const sdkVersionOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const f of flags) {
      if (f.sdkVersion) unique.add(f.sdkVersion);
    }
    return Array.from(unique)
      .sort()
      .map((v) => ({ value: v, label: v }));
  }, [flags]);

  // Filter definitions
  const filterDefinitions: FilterDefinition[] = useMemo(
    () => [
      {
        key: 'status',
        label: t('common.status'),
        type: 'multiselect',
        options: [
          {
            value: 'unresolved',
            label: t('featureFlags.unresolved'),
            icon: (
              <Chip
                size="small"
                color="warning"
                label=""
                sx={{ width: 16, height: 16, p: 0 }}
              />
            ),
          },
          {
            value: 'resolved',
            label: t('featureFlags.resolved'),
            icon: (
              <Chip
                size="small"
                color="success"
                label=""
                sx={{ width: 16, height: 16, p: 0 }}
              />
            ),
          },
        ],
      },
      {
        key: 'environment',
        label: t('common.environment'),
        type: 'multiselect',
        options: environmentOptions,
      },
      {
        key: 'project',
        label: t('common.project'),
        type: 'multiselect',
        options: projectOptions,
      },
      {
        key: 'organisation',
        label: t('common.organisation'),
        type: 'multiselect',
        options: organisationOptions,
      },
      {
        key: 'appName',
        label: t('featureFlags.appName'),
        type: 'multiselect',
        options: appNameOptions,
      },
      {
        key: 'sdkVersion',
        label: t('featureFlags.sdkVersion'),
        type: 'multiselect',
        options: sdkVersionOptions,
      },
    ],
    [
      t,
      environmentOptions,
      projectOptions,
      organisationOptions,
      appNameOptions,
      sdkVersionOptions,
    ]
  );

  const loadFlags = useCallback(async () => {
    setLoading(true);
    try {
      // Determine includeResolved based on filter
      const includeResolved =
        statusFilter?.includes('resolved') ||
        statusFilter?.length === 2 ||
        !statusFilter;
      const result = await unknownFlagService.getUnknownFlags(
        {
          includeResolved,
          environmentId: currentEnvironmentId || undefined,
        },
        projectApiPath
      );
      setFlags(result.flags);
    } catch {
      enqueueSnackbar(String(t('common.loadError')), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, currentEnvironmentId, enqueueSnackbar, t, projectApiPath]);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  // Handle filter changes
  const handleFilterChange = useCallback((key: string, value: any) => {
    setActiveFilters((prev) => {
      const existing = prev.find((f) => f.key === key);
      if (existing) {
        if (
          value === undefined ||
          value === null ||
          (Array.isArray(value) && value.length === 0)
        ) {
          return prev.filter((f) => f.key !== key);
        }
        return prev.map((f) => (f.key === key ? { ...f, value } : f));
      }
      if (
        value === undefined ||
        value === null ||
        (Array.isArray(value) && value.length === 0)
      ) {
        return prev;
      }
      return [...prev, { key, value, label: key }];
    });
  }, []);

  const handleRemoveFilter = useCallback((key: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.key !== key));
  }, []);

  const handleFilterAdd = useCallback((filter: ActiveFilter) => {
    setActiveFilters((prev) => {
      const exists = prev.find((f) => f.key === filter.key);
      if (exists) {
        return prev;
      }
      return [...prev, filter];
    });
  }, []);

  const handleClearFilters = useCallback(() => {
    setActiveFilters([]);
    setSearchTerm('');
  }, []);

  // Column settings handlers
  const handleColumnsChange = useCallback((newColumns: ColumnConfig[]) => {
    setColumns(newColumns);
    localStorage.setItem('unknownFlagsColumns', JSON.stringify(newColumns));
  }, []);

  // Filter flags based on search and all active filters
  const filteredFlags = useMemo(() => {
    let result = flags;

    // Apply search
    // Apply date range filter first (biggest reduction for large datasets)
    const { start: rangeStart, end: rangeEnd } = dateRangeToDatePair(dateRange);
    const rangeStartMs = rangeStart.getTime();
    const rangeEndMs = rangeEnd.getTime();
    result = result.filter((f) => {
      const ts = new Date(f.lastReportedAt).getTime();
      return ts >= rangeStartMs && ts <= rangeEndMs;
    });

    // Apply search filter
    if (debouncedSearchTerm) {
      const lower = debouncedSearchTerm.toLowerCase();
      result = result.filter(
        (f) =>
          f.flagName.toLowerCase().includes(lower) ||
          f.appName?.toLowerCase().includes(lower)
      );
    }

    // Apply status filter
    if (statusFilter && statusFilter.length > 0 && statusFilter.length < 2) {
      if (statusFilter.includes('resolved')) {
        result = result.filter((f) => f.isResolved);
      } else if (statusFilter.includes('unresolved')) {
        result = result.filter((f) => !f.isResolved);
      }
    }

    // Apply environment filter
    if (environmentFilter && environmentFilter.length > 0) {
      result = result.filter((f) =>
        environmentFilter.includes(f.environmentId)
      );
    }

    // Apply project filter
    if (projectFilter && projectFilter.length > 0) {
      result = result.filter(
        (f) => f.projectName && projectFilter.includes(f.projectName)
      );
    }

    // Apply organisation filter
    if (organisationFilter && organisationFilter.length > 0) {
      result = result.filter(
        (f) => f.orgName && organisationFilter.includes(f.orgName)
      );
    }

    // Apply app name filter
    if (appNameFilter && appNameFilter.length > 0) {
      result = result.filter(
        (f) => f.appName && appNameFilter.includes(f.appName)
      );
    }

    // Apply SDK version filter
    if (sdkVersionFilter && sdkVersionFilter.length > 0) {
      result = result.filter(
        (f) => f.sdkVersion && sdkVersionFilter.includes(f.sdkVersion)
      );
    }

    return result;
  }, [
    flags,
    dateRange,
    debouncedSearchTerm,
    statusFilter,
    environmentFilter,
    projectFilter,
    organisationFilter,
    appNameFilter,
    sdkVersionFilter,
  ]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [
    dateRange,
    debouncedSearchTerm,
    statusFilter,
    environmentFilter,
    projectFilter,
    organisationFilter,
    appNameFilter,
    sdkVersionFilter,
  ]);

  // ─── Chart: aggregate filteredFlags by hour buckets with grouping ───
  const seriesColors = [
    '#ed6c02', '#2196f3', '#4caf50', '#9c27b0', '#f44336',
    '#00bcd4', '#ff9800', '#e91e63', '#3f51b5', '#009688',
    '#cddc39', '#795548', '#607d8b', '#ff5722', '#8bc34a',
  ];

  const { chartLabels, chartDatasets, bucketSizeMs } = useMemo(() => {
    const { start, end } = dateRangeToDatePair(dateRange);
    const rangeMs = end.getTime() - start.getTime();
    const HOUR_MS = 3_600_000;
    const DAY_MS = 86_400_000;
    const useDaily = rangeMs > 7 * DAY_MS;
    const stepMs = useDaily ? DAY_MS : HOUR_MS;

    // Build buckets
    const buckets: Date[] = [];
    const cur = new Date(start);
    if (useDaily) {
      cur.setHours(0, 0, 0, 0);
    } else {
      cur.setMinutes(0, 0, 0);
    }
    while (cur <= end) {
      buckets.push(new Date(cur));
      cur.setTime(cur.getTime() + stepMs);
    }
    if (buckets.length === 0) {
      return { chartLabels: [] as string[], chartDatasets: [] as ChartDataset[], bucketSizeMs: stepMs };
    }

    const bucketStartMs = buckets[0].getTime();

    const labels = buckets.map((d) => {
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      if (useDaily) return `${month}/${day}`;
      const hour = String(d.getHours()).padStart(2, '0');
      return `${month}/${day} ${hour}:00`;
    });

    // O(1) bucket index calculation
    const findBucket = (ts: number): number => {
      const idx = Math.floor((ts - bucketStartMs) / stepMs);
      if (idx < 0 || idx >= buckets.length) return -1;
      return idx;
    };

    if (chartGroupBy === 'all') {
      const counts = new Array(buckets.length).fill(0);
      for (const flag of filteredFlags) {
        const idx = findBucket(new Date(flag.lastReportedAt).getTime());
        if (idx >= 0) counts[idx] += flag.accessCount;
      }
      return {
        chartLabels: labels,
        chartDatasets: [{
          label: t('featureFlags.unknownFlags'),
          data: counts,
          color: '#ed6c02',
        }],
        bucketSizeMs: stepMs,
      };
    }

    // Group by key
    const getKey = (flag: UnknownFlag): string => {
      switch (chartGroupBy) {
        case 'flag': return flag.flagName;
        case 'env': {
          const org = flag.orgName || '';
          const proj = flag.projectName || '';
          const env = flag.environmentName || flag.environmentId;
          return `${org}/${proj}/${env}`;
        }
        case 'app': return flag.appName || '-';
        default: return 'all';
      }
    };

    // Collect unique groups (limit to top 10 by total accessCount)
    const groupTotals = new Map<string, number>();
    for (const flag of filteredFlags) {
      const key = getKey(flag);
      groupTotals.set(key, (groupTotals.get(key) || 0) + flag.accessCount);
    }
    const topGroups = [...groupTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key]) => key);
    const topGroupSet = new Set(topGroups);

    // Build per-group counts
    const groupCounts = new Map<string, number[]>();
    for (const g of topGroups) {
      groupCounts.set(g, new Array(buckets.length).fill(0));
    }
    let hasOther = false;
    const otherCounts = new Array(buckets.length).fill(0);

    for (const flag of filteredFlags) {
      const key = getKey(flag);
      const idx = findBucket(new Date(flag.lastReportedAt).getTime());
      if (idx < 0) continue;
      if (topGroupSet.has(key)) {
        groupCounts.get(key)![idx] += flag.accessCount;
      } else {
        otherCounts[idx] += flag.accessCount;
        hasOther = true;
      }
    }

    const datasets: ChartDataset[] = topGroups.map((g, i) => ({
      label: g,
      data: groupCounts.get(g)!,
      color: seriesColors[i % seriesColors.length],
    }));
    if (hasOther) {
      datasets.push({
        label: 'Other',
        data: otherCounts,
        color: '#9e9e9e',
      });
    }

    return { chartLabels: labels, chartDatasets: datasets, bucketSizeMs: stepMs };
  }, [filteredFlags, dateRange, chartGroupBy, t]);

  const handleChartZoom = useCallback(
    (startIndex: number, endIndex: number) => {
      const { start: rangeStart } = dateRangeToDatePair(dateRange);
      const DAY_MS = 86_400_000;
      const isDaily = bucketSizeMs >= DAY_MS;

      // Mirror the same alignment as chart bucket builder
      const base = new Date(rangeStart);
      if (isDaily) {
        base.setHours(0, 0, 0, 0);
      } else {
        base.setMinutes(0, 0, 0);
      }

      const s = new Date(base.getTime() + startIndex * bucketSizeMs);
      const e = new Date(base.getTime() + endIndex * bucketSizeMs);
      setDateRange({ type: 'custom', start: s, end: e });
    },
    [dateRange, bucketSizeMs, setDateRange]
  );

  // Client-side pagination
  const paginatedFlags = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredFlags.slice(start, start + rowsPerPage);
  }, [filteredFlags, page, rowsPerPage]);

  const handleMenuOpen = (
    event: React.MouseEvent<HTMLElement>,
    flag: UnknownFlag
  ) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedFlag(flag);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedFlag(null);
  };

  const handleOpenConfirmDialog = (
    type: 'resolve' | 'unresolve' | 'delete'
  ) => {
    setConfirmDialog({ open: true, type, flag: selectedFlag });
    handleMenuClose();
  };

  const handleCloseConfirmDialog = () => {
    setConfirmDialog({ open: false, type: 'resolve', flag: null });
  };

  const handleConfirmAction = async () => {
    if (!confirmDialog.flag) return;

    try {
      switch (confirmDialog.type) {
        case 'resolve':
          await unknownFlagService.resolveUnknownFlag(
            confirmDialog.flag.id,
            projectApiPath
          );
          enqueueSnackbar(t('featureFlags.resolvedSuccessfully'), {
            variant: 'success',
          });
          break;
        case 'unresolve':
          await unknownFlagService.unresolveUnknownFlag(
            confirmDialog.flag.id,
            projectApiPath
          );
          enqueueSnackbar(t('featureFlags.unresolvedSuccessfully'), {
            variant: 'success',
          });
          break;
        case 'delete':
          await unknownFlagService.deleteUnknownFlag(
            confirmDialog.flag.id,
            projectApiPath
          );
          enqueueSnackbar(t('common.deleted'), { variant: 'success' });
          break;
      }
      loadFlags();
    } catch {
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    } finally {
      handleCloseConfirmDialog();
    }
  };

  const getDialogContent = () => {
    if (!confirmDialog.flag) return { title: '', message: '' };
    const flagName = confirmDialog.flag.flagName;

    switch (confirmDialog.type) {
      case 'resolve':
        return {
          title: t('featureFlags.confirmResolve'),
          message: t('featureFlags.confirmResolveMessage', { flagName }),
        };
      case 'unresolve':
        return {
          title: t('featureFlags.confirmUnresolve'),
          message: t('featureFlags.confirmUnresolveMessage', { flagName }),
        };
      case 'delete':
        return {
          title: t('common.confirmDelete'),
          message: t('featureFlags.confirmDeleteMessage', { flagName }),
        };
    }
  };

  const visibleColumns = columns.filter((c) => c.visible);
  const dialogContent = getDialogContent();

  const handleCopyFlagName = (flagName: string) => {
    copyToClipboardWithNotification(
      flagName,
      () =>
        enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
      () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
    );
  };

  return (
    <Box>
      <PageHeader
        icon={<UnknownIcon />}
        title={`${t('featureFlags.unknownFlags')} (${filteredFlags.length})`}
        subtitle={t('featureFlags.unknownFlagsDescription')}
        actions={
          <PageHeaderContextMenu
            onRefresh={loadFlags}
            refreshDisabled={loading}
          />
        }
      />

      {/* Search and Filters */}
      <Box sx={{ mb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              gap: 1.5,
              alignItems: 'center',
              flexWrap: 'wrap',
              flexGrow: 1,
            }}
          >
            <SearchTextField
              placeholder={t('featureFlags.searchUnknownFlags')}
              value={searchTerm}
              onChange={(value) => setSearchTerm(value)}
            />

            {/* Unified Control Group */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                borderRadius: '8px',
                minHeight: '36px',
                px: 0.5,
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              }}
            >
              <DynamicFilterBar
                availableFilters={filterDefinitions}
                activeFilters={activeFilters}
                onFilterAdd={handleFilterAdd}
                onFilterRemove={handleRemoveFilter}
                onFilterChange={handleFilterChange}
              />

              <Box
                sx={{
                  width: '1px',
                  height: '20px',
                  bgcolor: 'divider',
                  mx: 0.5,
                }}
              />

              {/* Column Settings Button */}
              <Tooltip title={t('common.columnSettings')}>
                <IconButton
                  size="small"
                  onClick={(e) => setColumnSettingsAnchor(e.currentTarget)}
                  sx={{
                    color: 'text.secondary',
                    borderRadius: '6px',
                    width: 30,
                    height: 30,
                    '&:hover': {
                      bgcolor: 'action.hover',
                      color: 'primary.main',
                    },
                  }}
                >
                  <ViewColumnIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Box>

            {/* Standalone Chart Grouping Selector */}
            <ToggleButtonGroup
              size="small"
              value={chartGroupBy}
              exclusive
              onChange={(_, value) => value && setChartGroupBy(value)}
              sx={{
                height: '36px',
                '& .MuiToggleButton-root': {
                  py: 0,
                  px: 1.5,
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  textTransform: 'none',
                },
              }}
            >
              <ToggleButton value="all">
                {t('network.groupByAll')}
              </ToggleButton>
              <ToggleButton value="flag">
                {t('featureFlags.flagName')}
              </ToggleButton>
              <ToggleButton value="env">
                {t('common.environment')}
              </ToggleButton>
              <ToggleButton value="app">
                {t('featureFlags.appName')}
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <DateRangeSelector
            value={dateRange}
            onChange={setDateRange}
            compact
          />
        </Box>
      </Box>


      <ArgusVolumeChart
        labels={chartLabels}
        datasets={chartDatasets}
        loading={loading}
        title={t('featureFlags.unknownFlags')}
        onZoom={handleChartZoom}
        storagePrefix="unknown_flags"
        skeletonColor="#ed6c02"
        showLegend={chartGroupBy !== 'all'}
        mb={2}
      />

      {/* Content */}
      <PageContentLoader loading={loading}>
        {filteredFlags.length === 0 ? (
          <EmptyPagePlaceholder message={t('featureFlags.noUnknownFlags')} />
        ) : (
          <Card variant="outlined">
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              <TableContainer>
                <Table
                  size="small"
                  sx={{ '& .MuiTableCell-root': { py: 0.75 } }}
                >
                  <TableHead>
                    <TableRow>
                      {visibleColumns.map((col) => (
                        <TableCell
                          key={col.id}
                          align={
                            col.id === 'accessCount' || col.id === 'status'
                              ? 'center'
                              : 'left'
                          }
                        >
                          {t(col.labelKey)}
                        </TableCell>
                      ))}
                      <TableCell align="center">
                        {t('common.actions')}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedFlags.map((flag) => (
                      <TableRow key={flag.id} hover>
                        {visibleColumns.map((col) => {
                          switch (col.id) {
                            case 'flagName':
                              return (
                                <TableCell key={col.id}>
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 1,
                                    }}
                                  >
                                    <UnknownIcon
                                      fontSize="small"
                                      color="warning"
                                    />
                                    <Typography fontWeight={500}>
                                      {flag.flagName}
                                    </Typography>
                                    <Tooltip title={t('common.copy')}>
                                      <IconButton
                                        size="small"
                                        onClick={() =>
                                          handleCopyFlagName(flag.flagName)
                                        }
                                        sx={{
                                          opacity: 0.6,
                                          '&:hover': { opacity: 1 },
                                        }}
                                      >
                                        <CopyIcon sx={{ fontSize: 13 }} />
                                      </IconButton>
                                    </Tooltip>
                                  </Box>
                                </TableCell>
                              );
                            case 'environment':
                              return (
                                <TableCell key={col.id}>
                                  <Tooltip title={flag.environmentId}>
                                    <Chip
                                      label={
                                        flag.environmentName ||
                                        flag.environmentId
                                      }
                                      size="small"
                                      sx={{ borderRadius: '16px' }}
                                    />
                                  </Tooltip>
                                </TableCell>
                              );
                            case 'project':
                              return (
                                <TableCell key={col.id}>
                                  <Typography variant="body2">
                                    {flag.projectName || '-'}
                                  </Typography>
                                </TableCell>
                              );
                            case 'organisation':
                              return (
                                <TableCell key={col.id}>
                                  <Typography variant="body2">
                                    {flag.orgName || '-'}
                                  </Typography>
                                </TableCell>
                              );
                            case 'appName':
                              return (
                                <TableCell key={col.id}>
                                  {flag.appName ? (
                                    <Chip
                                      label={flag.appName}
                                      size="small"
                                      variant="outlined"
                                      sx={{ borderRadius: '16px' }}
                                    />
                                  ) : (
                                    <Typography
                                      variant="body2"
                                      color="text.secondary"
                                    >
                                      -
                                    </Typography>
                                  )}
                                </TableCell>
                              );
                            case 'sdkVersion':
                              return (
                                <TableCell key={col.id}>
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                  >
                                    {flag.sdkVersion || '-'}
                                  </Typography>
                                </TableCell>
                              );
                            case 'accessCount':
                              return (
                                <TableCell key={col.id} align="center">
                                  <Typography variant="body2">
                                    {flag.accessCount.toLocaleString()}
                                  </Typography>
                                </TableCell>
                              );
                            case 'lastReportedAt':
                              return (
                                <TableCell key={col.id}>
                                  <RelativeTime date={flag.lastReportedAt} />
                                </TableCell>
                              );
                            case 'status':
                              return (
                                <TableCell key={col.id} align="center">
                                  {flag.isResolved ? (
                                    <Chip
                                      label={t('featureFlags.resolved')}
                                      size="small"
                                      color="success"
                                    />
                                  ) : (
                                    <Chip
                                      label={t('featureFlags.unresolved')}
                                      size="small"
                                      color="warning"
                                    />
                                  )}
                                </TableCell>
                              );
                            default:
                              return <TableCell key={col.id}>-</TableCell>;
                          }
                        })}
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuOpen(e, flag)}
                          >
                            <MoreVertIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
              <SimplePagination
                page={page}
                rowsPerPage={rowsPerPage}
                count={filteredFlags.length}
                onPageChange={(event, newPage) => setPage(newPage)}
                onRowsPerPageChange={(event) => {
                  setRowsPerPage(Number(event.target.value));
                  setPage(0);
                }}
              />
            </CardContent>
          </Card>
        )}
      </PageContentLoader>

      {/* Action Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        {selectedFlag && !selectedFlag.isResolved && (
          <MenuItem
            onClick={() => {
              if (selectedFlag) {
                navigate(
                  `/feature-flags?create=${encodeURIComponent(selectedFlag.flagName)}`
                );
              }
              handleMenuClose();
            }}
          >
            <ListItemIcon>
              <CreateFlagIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('featureFlags.createFlag')}</ListItemText>
          </MenuItem>
        )}
        {selectedFlag && !selectedFlag.isResolved && (
          <MenuItem onClick={() => handleOpenConfirmDialog('resolve')}>
            <ListItemIcon>
              <ResolveIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('featureFlags.markResolved')}</ListItemText>
          </MenuItem>
        )}
        {selectedFlag && selectedFlag.isResolved && (
          <MenuItem onClick={() => handleOpenConfirmDialog('unresolve')}>
            <ListItemIcon>
              <UndoIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('featureFlags.markUnresolved')}</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={() => handleOpenConfirmDialog('delete')}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('common.delete')}</ListItemText>
        </MenuItem>
      </Menu>

      {/* Column Settings Dialog */}
      <ColumnSettingsDialog
        anchorEl={columnSettingsAnchor}
        columns={columns}
        onColumnsChange={handleColumnsChange}
        onClose={() => setColumnSettingsAnchor(null)}
        onReset={() => handleColumnsChange(defaultColumns)}
      />

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onClose={handleCloseConfirmDialog}>
        <DialogTitle>{dialogContent.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{dialogContent.message}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={handleCloseConfirmDialog}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleConfirmAction}
            color={confirmDialog.type === 'delete' ? 'error' : 'primary'}
            variant="contained"
          >
            {t('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UnknownFlagsPage;
