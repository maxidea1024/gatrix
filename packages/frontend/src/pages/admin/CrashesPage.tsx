import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  CardContent,
  Drawer,
  Collapse,
  Chip,
  Paper,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  BugReport as BugReportIcon,
  Description as LogIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Link as LinkIcon,
  HourglassEmpty as HourglassIcon,
  MoreVert as MoreVertIcon,
  CheckCircle as CheckCircleIcon,
  Replay as ReplayIcon,
  PersonOutline as PersonIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { copyToClipboardWithNotification } from '@/utils/clipboard';
import { formatRelativeTime, formatDateTimeDetailed } from '@/utils/dateFormat';
import { useI18n } from '@/contexts/I18nContext';
import dayjs, { Dayjs } from 'dayjs';
import DateRangePicker, {
  DateRangePreset,
} from '../../components/common/DateRangePicker';

// Types and Services
import { CrashState, getPlatformName } from '@/types/crash';
import crashService from '@/services/crashService';
import SimplePagination from '../../components/common/SimplePagination';
import EmptyPagePlaceholder from '../../components/common/EmptyPagePlaceholder';
import PageContentLoader from '@/components/common/PageContentLoader';
import DynamicFilterBar, {
  FilterDefinition,
  ActiveFilter,
} from '../../components/common/DynamicFilterBar';
import { usePageState } from '../../hooks/usePageState';
import { useDebounce } from '../../hooks/useDebounce';
import LogViewer from '../../components/LogViewer';
import StackTraceViewer from '../../components/StackTraceViewer';
import SearchTextField from '../../components/common/SearchTextField';
import PageHeader from '@/components/common/PageHeader';

// State color mapping
const STATE_COLORS: Record<
  number,
  'default' | 'primary' | 'success' | 'error' | 'warning' | 'info'
> = {
  [CrashState.OPEN]: 'primary',
  [CrashState.CLOSED]: 'default',
  [CrashState.RESOLVED]: 'success',
  [CrashState.REPEATED]: 'error',
  [CrashState.DELETED]: 'warning',
};

const STATE_LABEL_KEYS: Record<number, string> = {
  [CrashState.OPEN]: 'crashes.states.open',
  [CrashState.CLOSED]: 'crashes.states.closed',
  [CrashState.RESOLVED]: 'crashes.states.resolved',
  [CrashState.REPEATED]: 'crashes.states.repeated',
  [CrashState.DELETED]: 'crashes.states.deleted',
};

/**
 * CrashesPage - Crash groups list with expandable event history
 *
 * Shows unique crash groups (deduplicated by callstack hash + branch).
 * Clicking a row expands to show individual crash events for that group.
 * Search works across both crash group fields and event fields.
 */
const CrashesPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { language } = useI18n();

  // Page state management (localStorage + URL params)
  const { pageState, updatePage, updateLimit, updateSort } = usePageState({
    defaultState: {
      page: 1,
      limit: 20,
      sortBy: 'lastCrashAt',
      sortOrder: 'DESC',
      filters: {},
    },
    storageKey: 'crashesPage',
  });

  // State
  const [crashes, setCrashes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Date range state - restore from pageState.filters
  const [dateFrom, setDateFrom] = useState<Dayjs | null>(
    pageState.filters?.dateFrom
      ? dayjs(pageState.filters.dateFrom)
      : dayjs().subtract(7, 'day')
  );
  const [dateTo, setDateTo] = useState<Dayjs | null>(
    pageState.filters?.dateTo ? dayjs(pageState.filters.dateTo) : dayjs()
  );
  const [dateRangePreset, setDateRangePreset] =
    useState<DateRangePreset>('last7d');

  // Search state - restore from pageState.filters
  const [searchTerm, setSearchTerm] = useState<string>(
    pageState.filters?.search || ''
  );

  // Debounced search term (500ms delay)
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Filter options from backend
  const [filterOptions, setFilterOptions] = useState<{
    platforms: string[];
    environments: { id: string; name: string }[];
    branches: string[];
    channels: string[];
    subchannels: string[];
    states: number[];
  }>({
    platforms: [],
    environments: [],
    branches: [],
    channels: [],
    subchannels: [],
    states: [],
  });

  // Dynamic filters state
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [filtersInitialized, setFiltersInitialized] = useState(false);

  // Context menu state for row actions
  const [contextMenuAnchor, setContextMenuAnchor] =
    useState<null | HTMLElement>(null);
  const [contextMenuCrash, setContextMenuCrash] = useState<any | null>(null);

  // Expanded rows (crash group events)
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Record<string, any[]>>(
    {}
  );
  const [expandedEventsLoading, setExpandedEventsLoading] = useState<
    Set<string>
  >(new Set());
  const [expandedEventsTotal, setExpandedEventsTotal] = useState<
    Record<string, number>
  >({});
  const [expandedEventsPage, setExpandedEventsPage] = useState<
    Record<string, number>
  >({});

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState<'stackTrace' | 'log'>(
    'stackTrace'
  );
  const [drawerContent, setDrawerContent] = useState<string>('');
  const [loadingDrawer, setLoadingDrawer] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEventLogPath, setSelectedEventLogPath] = useState<string>('');

  // Drawer width state (persisted in localStorage)
  const [drawerWidth, setDrawerWidth] = useState<number>(() => {
    const saved = localStorage.getItem('crashesDrawerWidth');
    return saved ? parseInt(saved) : 700;
  });
  const [isResizing, setIsResizing] = useState(false);

  // Assignee dialog
  const [assigneeDialogOpen, setAssigneeDialogOpen] = useState(false);
  const [assigneeValue, setAssigneeValue] = useState('');

  // Jira dialog
  const [jiraDialogOpen, setJiraDialogOpen] = useState(false);
  const [jiraValue, setJiraValue] = useState('');

  // Dynamic filter definitions
  const availableFilterDefinitions: FilterDefinition[] = useMemo(
    () => [
      {
        key: 'platform',
        label: t('crashes.filters.platform'),
        type: 'multiselect',
        operator: 'any_of',
        allowOperatorToggle: false,
        options: filterOptions.platforms.map((p) => ({
          value: p,
          label: getPlatformName(p),
        })),
      },
      {
        key: 'environment',
        label: t('crashes.filters.environment'),
        type: 'multiselect',
        operator: 'any_of',
        allowOperatorToggle: false,
        options: filterOptions.environments.map((e) => ({
          value: e.id,
          label: e.name,
        })),
      },
      {
        key: 'branch',
        label: t('crashes.filters.branch'),
        type: 'multiselect',
        operator: 'any_of',
        allowOperatorToggle: false,
        options: filterOptions.branches.map((b) => ({
          value: b,
          label: b,
        })),
      },
      {
        key: 'channel',
        label: t('crashes.filters.channel'),
        type: 'multiselect',
        operator: 'any_of',
        allowOperatorToggle: false,
        options: filterOptions.channels.map((c) => ({
          value: c,
          label: c,
        })),
      },
      {
        key: 'subchannel',
        label: t('crashes.filters.subchannel'),
        type: 'multiselect',
        operator: 'any_of',
        allowOperatorToggle: false,
        options: filterOptions.subchannels.map((s) => ({
          value: s,
          label: s,
        })),
      },
      {
        key: 'state',
        label: t('crashes.columns.state'),
        type: 'select',
        operator: 'any_of',
        allowOperatorToggle: false,
        options: filterOptions.states.map((s) => ({
          value: String(s),
          label: t(STATE_LABEL_KEYS[s] || 'common.unknown'),
        })),
      },
    ],
    [t, filterOptions]
  );

  // Dynamic filter handlers
  const handleFilterAdd = (filter: ActiveFilter) => {
    setActiveFilters([...activeFilters, filter]);
  };

  const handleFilterRemove = (filterKey: string) => {
    setActiveFilters(activeFilters.filter((f) => f.key !== filterKey));
  };

  const handleDynamicFilterChange = (filterKey: string, value: any) => {
    setActiveFilters(
      activeFilters.map((f) => (f.key === filterKey ? { ...f, value } : f))
    );
  };

  const handleOperatorChange = (
    filterKey: string,
    operator: 'any_of' | 'include_all'
  ) => {
    setActiveFilters(
      activeFilters.map((f) => (f.key === filterKey ? { ...f, operator } : f))
    );
  };

  // Load filter options
  const loadFilterOptions = useCallback(async () => {
    try {
      const options = await crashService.getCrashesFilterOptions();
      setFilterOptions({
        platforms: options.platforms || [],
        environments: options.environments || [],
        branches: options.branches || [],
        channels: options.channels || [],
        subchannels: options.subchannels || [],
        states: options.states || [],
      });
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  }, []);

  // Build query params from active filters
  const buildQueryParams = useCallback((): Record<string, any> => {
    const params: Record<string, any> = {
      page: pageState.page,
      limit: pageState.limit,
      sortBy: pageState.sortBy,
      sortOrder: pageState.sortOrder,
    };

    // Add search
    if (debouncedSearchTerm) {
      params.search = debouncedSearchTerm;
    }

    // Add date range
    if (dateFrom) {
      params.dateFrom = dateFrom.toISOString();
    }
    if (dateTo) {
      params.dateTo = dateTo.toISOString();
    }

    // Add active filters
    activeFilters.forEach((filter) => {
      const value =
        Array.isArray(filter.value) && filter.value.length > 0
          ? filter.value.join(',')
          : filter.value;

      if (value) {
        if (filter.key === 'state') {
          params.state = parseInt(value as string, 10);
        } else {
          params[filter.key] = value;
        }
      }
    });

    return params;
  }, [
    pageState.page,
    pageState.limit,
    pageState.sortBy,
    pageState.sortOrder,
    debouncedSearchTerm,
    dateFrom,
    dateTo,
    activeFilters,
  ]);

  // Load crashes
  const loadCrashes = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildQueryParams();
      const response = await crashService.getCrashes(params);
      setCrashes(response.data || []);
      setTotal(response.total || 0);
    } catch (error) {
      console.error('Error loading crashes:', error);
      enqueueSnackbar(t('crashes.loadError'), { variant: 'error' });
      setCrashes([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams, enqueueSnackbar, t]);

  // Load filter options on mount
  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  // Load crashes when filters change
  useEffect(() => {
    loadCrashes();
  }, [loadCrashes]);

  // Restore active filters from pageState.filters on mount
  useEffect(() => {
    if (filtersInitialized) return;

    if (!pageState.filters || Object.keys(pageState.filters).length === 0) {
      setFiltersInitialized(true);
      return;
    }

    const restoredFilters: ActiveFilter[] = [];
    const filters = pageState.filters;

    Object.entries(filters).forEach(([key, value]) => {
      if (['search'].includes(key)) return;

      const filterDef = availableFilterDefinitions.find((f) => f.key === key);
      if (!filterDef) return;

      restoredFilters.push({
        key,
        value: Array.isArray(value) ? value : [value],
        label: filterDef.label,
        operator: 'any_of',
      });
    });

    if (restoredFilters.length > 0) {
      setActiveFilters(restoredFilters);
    }
    setFiltersInitialized(true);
  }, [filtersInitialized, pageState.filters, availableFilterDefinitions]);

  const handlePageChange = useCallback(
    (_: unknown, newPage: number) => {
      updatePage(newPage + 1); // SimplePagination uses 0-based
    },
    [updatePage]
  );

  const handleRowsPerPageChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newLimit = parseInt(event.target.value, 10);
      updateLimit(newLimit);
    },
    [updateLimit]
  );

  const handleSort = useCallback(
    (column: string) => {
      const newSortOrder =
        pageState.sortBy === column && pageState.sortOrder === 'DESC'
          ? 'ASC'
          : 'DESC';
      updateSort(column, newSortOrder);
    },
    [pageState.sortBy, pageState.sortOrder, updateSort]
  );

  // Toggle expand crash group row
  const handleToggleRow = async (crashId: string) => {
    const isExpanding = expandedRowId !== crashId;
    setExpandedRowId(isExpanding ? crashId : null);

    // Load events when expanding
    if (isExpanding && !expandedEvents[crashId]) {
      setExpandedEventsLoading((prev) => new Set([...prev, crashId]));
      try {
        const result = await crashService.getCrashGroupEvents(crashId, {
          page: 1,
          limit: 10,
        });
        setExpandedEvents((prev) => ({ ...prev, [crashId]: result.data }));
        setExpandedEventsTotal((prev) => ({
          ...prev,
          [crashId]: result.total,
        }));
        setExpandedEventsPage((prev) => ({ ...prev, [crashId]: 1 }));
      } catch {
        enqueueSnackbar(t('crashes.loadError'), { variant: 'error' });
      } finally {
        setExpandedEventsLoading((prev) => {
          const s = new Set(prev);
          s.delete(crashId);
          return s;
        });
      }
    }
  };

  // Load events page for expanded crash
  const handleEventsPageChange = useCallback(
    async (crashId: string, _: unknown, newPage: number) => {
      const nextPage = newPage + 1; // SimplePagination 0-based
      setExpandedEventsLoading((prev) => new Set([...prev, crashId]));
      try {
        const result = await crashService.getCrashGroupEvents(crashId, {
          page: nextPage,
          limit: 10,
        });
        setExpandedEvents((prev) => ({ ...prev, [crashId]: result.data }));
        setExpandedEventsPage((prev) => ({ ...prev, [crashId]: nextPage }));
        setExpandedEventsTotal((prev) => ({
          ...prev,
          [crashId]: result.total,
        }));
      } catch {
        enqueueSnackbar(t('crashes.loadError'), { variant: 'error' });
      } finally {
        setExpandedEventsLoading((prev) => {
          const s = new Set(prev);
          s.delete(crashId);
          return s;
        });
      }
    },
    [t, enqueueSnackbar]
  );

  // View stack trace from crash group
  const handleViewStackTrace = async (crash: any) => {
    setDrawerType('stackTrace');
    setDrawerOpen(true);
    setDrawerContent('');
    setLoadingDrawer(true);
    try {
      const data = await crashService.getCrashById(crash.id);
      setDrawerContent(data.stackTrace || '');
    } catch (error) {
      console.error('Failed to load stack trace:', error);
    } finally {
      setLoadingDrawer(false);
    }
  };

  // View event log
  const handleViewLog = async (event: any) => {
    setSelectedEventId(event.id);
    setSelectedEventLogPath(event.logFilePath || '');
    setDrawerType('log');
    setDrawerOpen(true);
    setDrawerContent('');
    setLoadingDrawer(true);
    try {
      const logData = await crashService.getLogFile(event.id);
      setDrawerContent(logData.logContent || '');
    } catch (error) {
      console.error('Failed to load log file:', error);
      enqueueSnackbar(t('crashes.logNotAvailable'), { variant: 'warning' });
    } finally {
      setLoadingDrawer(false);
    }
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setDrawerContent('');
    setSelectedEventId(null);
    setSelectedEventLogPath('');
  };

  // Handle drawer resize
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = window.innerWidth - e.clientX;
      const minWidth = 400;
      const maxWidth = window.innerWidth;

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setDrawerWidth(newWidth);
        localStorage.setItem('crashesDrawerWidth', String(newWidth));
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Context menu action handlers
  const handleResolve = useCallback(async () => {
    if (!contextMenuCrash) return;
    try {
      await crashService.updateCrashState(
        contextMenuCrash.id,
        CrashState.RESOLVED
      );
      enqueueSnackbar(t('common.updateSuccess'), { variant: 'success' });
      loadCrashes();
    } catch {
      enqueueSnackbar(t('common.saveFailed'), { variant: 'error' });
    }
    setContextMenuAnchor(null);
    setContextMenuCrash(null);
  }, [contextMenuCrash, loadCrashes, t, enqueueSnackbar]);

  const handleReopen = useCallback(async () => {
    if (!contextMenuCrash) return;
    try {
      await crashService.updateCrashState(contextMenuCrash.id, CrashState.OPEN);
      enqueueSnackbar(t('common.updateSuccess'), { variant: 'success' });
      loadCrashes();
    } catch {
      enqueueSnackbar(t('common.saveFailed'), { variant: 'error' });
    }
    setContextMenuAnchor(null);
    setContextMenuCrash(null);
  }, [contextMenuCrash, loadCrashes, t, enqueueSnackbar]);

  const handleOpenAssignDialog = useCallback(() => {
    if (!contextMenuCrash) return;
    setAssigneeValue(contextMenuCrash.assignee || '');
    setAssigneeDialogOpen(true);
    setContextMenuAnchor(null);
  }, [contextMenuCrash]);

  const handleSaveAssignee = useCallback(async () => {
    if (!contextMenuCrash) return;
    try {
      await crashService.updateCrashAssignee(
        contextMenuCrash.id,
        assigneeValue || null
      );
      enqueueSnackbar(t('common.updateSuccess'), { variant: 'success' });
      loadCrashes();
    } catch {
      enqueueSnackbar(t('common.saveFailed'), { variant: 'error' });
    }
    setAssigneeDialogOpen(false);
    setContextMenuCrash(null);
  }, [contextMenuCrash, assigneeValue, loadCrashes, t, enqueueSnackbar]);

  const handleOpenJiraDialog = useCallback(() => {
    if (!contextMenuCrash) return;
    setJiraValue(contextMenuCrash.jiraTicket || '');
    setJiraDialogOpen(true);
    setContextMenuAnchor(null);
  }, [contextMenuCrash]);

  const handleSaveJira = useCallback(async () => {
    if (!contextMenuCrash) return;
    try {
      await crashService.updateCrashJiraTicket(
        contextMenuCrash.id,
        jiraValue || null
      );
      enqueueSnackbar(t('common.updateSuccess'), { variant: 'success' });
      loadCrashes();
    } catch {
      enqueueSnackbar(t('common.saveFailed'), { variant: 'error' });
    }
    setJiraDialogOpen(false);
    setContextMenuCrash(null);
  }, [contextMenuCrash, jiraValue, loadCrashes, t, enqueueSnackbar]);

  const handleCopyCurrentView = useCallback(() => {
    const currentUrl = window.location.href;
    copyToClipboardWithNotification(
      currentUrl,
      () =>
        enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
      () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
    );
  }, [t, enqueueSnackbar]);

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        icon={<BugReportIcon />}
        title={t('crashes.title')}
        subtitle={t('crashes.subtitle')}
      />

      {/* Search & Filters */}
      <Box sx={{ mb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {/* Date Range Picker */}
          <DateRangePicker
            dateFrom={dateFrom}
            dateTo={dateTo}
            onChange={(from, to, preset) => {
              setDateFrom(from);
              setDateTo(to);
              setDateRangePreset(preset);
            }}
            preset={dateRangePreset}
            availablePresets={[
              'today',
              'yesterday',
              'last7d',
              'last30d',
              'custom',
            ]}
            size="small"
          />

          {/* Search */}
          <SearchTextField
            placeholder={t('crashes.searchPlaceholder')}
            value={searchTerm}
            onChange={setSearchTerm}
          />

          {/* Dynamic Filter Bar */}
          <DynamicFilterBar
            availableFilters={availableFilterDefinitions}
            activeFilters={activeFilters}
            onFilterAdd={handleFilterAdd}
            onFilterRemove={handleFilterRemove}
            onFilterChange={handleDynamicFilterChange}
            onOperatorChange={handleOperatorChange}
          />

          {/* Copy Current View Button */}
          <Tooltip title={t('crashes.copyCurrentView')}>
            <IconButton
              onClick={handleCopyCurrentView}
              sx={{
                ml: 1,
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                '&:hover': {
                  bgcolor: 'action.hover',
                },
              }}
            >
              <LinkIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Table */}
      <PageContentLoader loading={loading && crashes.length === 0}>
        {crashes.length === 0 ? (
          !loading && <EmptyPagePlaceholder message={t('crashes.noResults')} />
        ) : (
          <Card variant="outlined">
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              <TableContainer>
                <Table sx={{ tableLayout: 'auto' }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 40 }}></TableCell>
                      <TableCell>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            cursor: 'pointer',
                          }}
                          onClick={() => handleSort('firstLine')}
                        >
                          {t('crashes.columns.firstLine')}
                          {pageState.sortBy === 'firstLine' &&
                            (pageState.sortOrder === 'DESC' ? (
                              <ArrowDownwardIcon fontSize="small" />
                            ) : (
                              <ArrowUpwardIcon fontSize="small" />
                            ))}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            cursor: 'pointer',
                          }}
                          onClick={() => handleSort('crashesCount')}
                        >
                          {t('crashes.columns.count')}
                          {pageState.sortBy === 'crashesCount' &&
                            (pageState.sortOrder === 'DESC' ? (
                              <ArrowDownwardIcon fontSize="small" />
                            ) : (
                              <ArrowUpwardIcon fontSize="small" />
                            ))}
                        </Box>
                      </TableCell>
                      <TableCell>{t('crashes.columns.platform')}</TableCell>
                      <TableCell>{t('crashes.columns.branch')}</TableCell>
                      <TableCell>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            cursor: 'pointer',
                          }}
                          onClick={() => handleSort('crashesState')}
                        >
                          {t('crashes.columns.state')}
                          {pageState.sortBy === 'crashesState' &&
                            (pageState.sortOrder === 'DESC' ? (
                              <ArrowDownwardIcon fontSize="small" />
                            ) : (
                              <ArrowUpwardIcon fontSize="small" />
                            ))}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            cursor: 'pointer',
                          }}
                          onClick={() => handleSort('lastCrashAt')}
                        >
                          {t('crashes.columns.lastCrash')}
                          {pageState.sortBy === 'lastCrashAt' &&
                            (pageState.sortOrder === 'DESC' ? (
                              <ArrowDownwardIcon fontSize="small" />
                            ) : (
                              <ArrowUpwardIcon fontSize="small" />
                            ))}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            cursor: 'pointer',
                          }}
                          onClick={() => handleSort('firstCrashAt')}
                        >
                          {t('crashes.columns.firstCrash')}
                          {pageState.sortBy === 'firstCrashAt' &&
                            (pageState.sortOrder === 'DESC' ? (
                              <ArrowDownwardIcon fontSize="small" />
                            ) : (
                              <ArrowUpwardIcon fontSize="small" />
                            ))}
                        </Box>
                      </TableCell>
                      <TableCell>{t('crashes.columns.lastVersion')}</TableCell>
                      <TableCell align="center" sx={{ width: 100 }}>
                        {t('crashes.columns.actions')}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {crashes.map((crash, index) => (
                      <React.Fragment key={crash.id}>
                        <TableRow
                          hover
                          sx={{
                            '& > td': {
                              backgroundColor: (theme) =>
                                index % 2 === 1
                                  ? theme.palette.mode === 'dark'
                                    ? 'rgba(255, 255, 255, 0.05)'
                                    : 'rgba(0, 0, 0, 0.04)'
                                  : undefined,
                            },
                          }}
                        >
                          <TableCell>
                            <IconButton
                              size="small"
                              onClick={() => handleToggleRow(crash.id)}
                            >
                              {expandedRowId === crash.id ? (
                                <ExpandLessIcon />
                              ) : (
                                <ExpandMoreIcon />
                              )}
                            </IconButton>
                          </TableCell>
                          <TableCell sx={{ maxWidth: 350 }}>
                            <Typography
                              variant="body2"
                              sx={{
                                cursor: 'pointer',
                                fontWeight: 500,
                                '&:hover': {
                                  color: 'primary.main',
                                  textDecoration: 'underline',
                                },
                              }}
                              onClick={() => handleViewStackTrace(crash)}
                            >
                              {crash.firstLine || '-'}
                            </Typography>
                            {crash.assignee && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: 'block', mt: 0.3 }}
                              >
                                <PersonIcon
                                  sx={{
                                    fontSize: 12,
                                    mr: 0.3,
                                    verticalAlign: 'text-bottom',
                                  }}
                                />
                                {crash.assignee}
                              </Typography>
                            )}
                            {crash.jiraTicket && (
                              <Typography
                                variant="caption"
                                color="primary"
                                sx={{
                                  display: 'inline-block',
                                  ml: crash.assignee ? 1 : 0,
                                  mt: crash.assignee ? 0 : 0.3,
                                  cursor: 'pointer',
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (crash.jiraTicket.startsWith('http')) {
                                    window.open(crash.jiraTicket, '_blank');
                                  }
                                }}
                              >
                                <LinkIcon
                                  sx={{
                                    fontSize: 12,
                                    mr: 0.3,
                                    verticalAlign: 'text-bottom',
                                  }}
                                />
                                {crash.jiraTicket}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={crash.crashesCount}
                              size="small"
                              color={
                                crash.crashesCount > 10
                                  ? 'error'
                                  : crash.crashesCount > 5
                                    ? 'warning'
                                    : 'default'
                              }
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={getPlatformName(crash.platform)}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={crash.branch}
                              size="small"
                              color="info"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={t(
                                STATE_LABEL_KEYS[crash.crashesState] ||
                                  'common.unknown'
                              )}
                              size="small"
                              color={
                                STATE_COLORS[crash.crashesState] || 'default'
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Tooltip
                              title={formatDateTimeDetailed(crash.lastCrashAt)}
                            >
                              <Typography
                                variant="body2"
                                sx={{ whiteSpace: 'nowrap' }}
                              >
                                {formatRelativeTime(
                                  crash.lastCrashAt,
                                  undefined,
                                  language
                                )}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Tooltip
                              title={formatDateTimeDetailed(crash.firstCrashAt)}
                            >
                              <Typography
                                variant="body2"
                                sx={{ whiteSpace: 'nowrap' }}
                              >
                                {formatRelativeTime(
                                  crash.firstCrashAt,
                                  undefined,
                                  language
                                )}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={crash.maxAppVersion || '-'}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                setContextMenuAnchor(e.currentTarget);
                                setContextMenuCrash(crash);
                              }}
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>

                        {/* Expanded events sub-table */}
                        <TableRow>
                          <TableCell colSpan={10} sx={{ p: 0, border: 0 }}>
                            <Collapse
                              in={expandedRowId === crash.id}
                              timeout="auto"
                              unmountOnExit
                            >
                              <Box
                                sx={{
                                  py: 2,
                                  pl: 10,
                                  pr: 3,
                                  bgcolor: (theme) =>
                                    theme.palette.mode === 'dark'
                                      ? 'rgba(255,255,255,0.02)'
                                      : 'rgba(0,0,0,0.02)',
                                  borderTop: 1,
                                  borderBottom: 1,
                                  borderColor: 'divider',
                                }}
                              >
                                {/* Events header */}
                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 2,
                                    mb: 2,
                                  }}
                                >
                                  <Typography
                                    variant="h6"
                                    sx={{ fontWeight: 600 }}
                                  >
                                    {t('crashes.crashEvents')}
                                  </Typography>
                                  <Chip
                                    label={expandedEventsTotal[crash.id] || 0}
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                  />
                                </Box>

                                {expandedEventsLoading.has(crash.id) ? (
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      justifyContent: 'center',
                                      p: 4,
                                    }}
                                  >
                                    <HourglassIcon
                                      sx={{
                                        fontSize: 48,
                                        color: 'primary.main',
                                        animation:
                                          'hourglassRotate 2s ease-in-out infinite',
                                        '@keyframes hourglassRotate': {
                                          '0%': {
                                            transform: 'rotate(0deg)',
                                          },
                                          '50%': {
                                            transform: 'rotate(180deg)',
                                          },
                                          '100%': {
                                            transform: 'rotate(360deg)',
                                          },
                                        },
                                      }}
                                    />
                                  </Box>
                                ) : (
                                  <>
                                    <Paper
                                      variant="outlined"
                                      sx={{ overflow: 'hidden' }}
                                    >
                                      <Table size="small">
                                        <TableHead>
                                          <TableRow>
                                            <TableCell>
                                              {t('crashes.table.createdAt')}
                                            </TableCell>
                                            <TableCell>
                                              {t('crashes.table.platform')}
                                            </TableCell>
                                            <TableCell>
                                              {t('crashes.table.appVersion')}
                                            </TableCell>
                                            <TableCell>
                                              {t('crashes.table.accountId')}
                                            </TableCell>
                                            <TableCell>
                                              {t('crashes.table.characterId')}
                                            </TableCell>
                                            <TableCell>
                                              {t('crashes.table.userName')}
                                            </TableCell>
                                            <TableCell>
                                              {t('crashes.table.userMessage')}
                                            </TableCell>
                                            <TableCell align="center">
                                              {t('crashes.columns.actions')}
                                            </TableCell>
                                          </TableRow>
                                        </TableHead>
                                        <TableBody>
                                          {(expandedEvents[crash.id] || [])
                                            .length === 0 ? (
                                            <TableRow>
                                              <TableCell
                                                colSpan={8}
                                                align="center"
                                              >
                                                <Typography
                                                  variant="body2"
                                                  color="text.secondary"
                                                >
                                                  {t('crashes.noEvents')}
                                                </Typography>
                                              </TableCell>
                                            </TableRow>
                                          ) : (
                                            (
                                              expandedEvents[crash.id] || []
                                            ).map(
                                              (
                                                event: any,
                                                eventIdx: number
                                              ) => (
                                                <TableRow
                                                  key={event.id}
                                                  hover
                                                  sx={{
                                                    '& > td': {
                                                      backgroundColor: (
                                                        theme
                                                      ) =>
                                                        eventIdx % 2 === 1
                                                          ? theme.palette
                                                              .mode === 'dark'
                                                            ? 'rgba(255, 255, 255, 0.05)'
                                                            : 'rgba(0, 0, 0, 0.04)'
                                                          : undefined,
                                                    },
                                                  }}
                                                >
                                                  <TableCell>
                                                    <Tooltip
                                                      title={formatDateTimeDetailed(
                                                        event.createdAt
                                                      )}
                                                    >
                                                      <Typography
                                                        variant="body2"
                                                        sx={{
                                                          whiteSpace: 'nowrap',
                                                        }}
                                                      >
                                                        {formatRelativeTime(
                                                          event.createdAt,
                                                          undefined,
                                                          language
                                                        )}
                                                      </Typography>
                                                    </Tooltip>
                                                  </TableCell>
                                                  <TableCell>
                                                    <Chip
                                                      label={getPlatformName(
                                                        event.platform
                                                      )}
                                                      size="small"
                                                      color="primary"
                                                      variant="outlined"
                                                    />
                                                  </TableCell>
                                                  <TableCell>
                                                    <Chip
                                                      label={
                                                        event.appVersion || '-'
                                                      }
                                                      size="small"
                                                      variant="outlined"
                                                    />
                                                  </TableCell>
                                                  <TableCell>
                                                    <Typography variant="body2">
                                                      {event.accountId || '-'}
                                                    </Typography>
                                                  </TableCell>
                                                  <TableCell>
                                                    <Typography variant="body2">
                                                      {event.characterId || '-'}
                                                    </Typography>
                                                  </TableCell>
                                                  <TableCell>
                                                    <Typography variant="body2">
                                                      {event.userName || '-'}
                                                    </Typography>
                                                  </TableCell>
                                                  <TableCell>
                                                    <Tooltip
                                                      title={
                                                        event.userMessage || ''
                                                      }
                                                      arrow
                                                    >
                                                      <Typography
                                                        variant="body2"
                                                        sx={{
                                                          maxWidth: 120,
                                                          overflow: 'hidden',
                                                          textOverflow:
                                                            'ellipsis',
                                                          whiteSpace: 'nowrap',
                                                        }}
                                                      >
                                                        {event.userMessage ||
                                                          '-'}
                                                      </Typography>
                                                    </Tooltip>
                                                  </TableCell>
                                                  <TableCell align="center">
                                                    {event.logFilePath ? (
                                                      <Tooltip
                                                        title={t(
                                                          'crashes.viewLog'
                                                        )}
                                                      >
                                                        <IconButton
                                                          size="small"
                                                          onClick={() =>
                                                            handleViewLog(event)
                                                          }
                                                        >
                                                          <LogIcon fontSize="small" />
                                                        </IconButton>
                                                      </Tooltip>
                                                    ) : (
                                                      <Typography
                                                        variant="body2"
                                                        color="text.disabled"
                                                      >
                                                        -
                                                      </Typography>
                                                    )}
                                                  </TableCell>
                                                </TableRow>
                                              )
                                            )
                                          )}
                                        </TableBody>
                                      </Table>
                                    </Paper>

                                    {/* Events pagination */}
                                    {(expandedEventsTotal[crash.id] || 0) >
                                      10 && (
                                      <SimplePagination
                                        count={
                                          expandedEventsTotal[crash.id] || 0
                                        }
                                        page={
                                          (expandedEventsPage[crash.id] || 1) -
                                          1
                                        }
                                        rowsPerPage={10}
                                        onPageChange={(_, newPage) =>
                                          handleEventsPageChange(
                                            crash.id,
                                            _,
                                            newPage
                                          )
                                        }
                                        onRowsPerPageChange={() => {}}
                                        showRowsPerPage={false}
                                      />
                                    )}
                                  </>
                                )}
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <SimplePagination
                count={total}
                page={pageState.page - 1}
                rowsPerPage={pageState.limit}
                onPageChange={handlePageChange}
                onRowsPerPageChange={handleRowsPerPageChange}
              />
            </CardContent>
          </Card>
        )}
      </PageContentLoader>

      {/* Context Menu for row actions */}
      <Menu
        anchorEl={contextMenuAnchor}
        open={Boolean(contextMenuAnchor)}
        onClose={() => {
          setContextMenuAnchor(null);
          setContextMenuCrash(null);
        }}
      >
        <MenuItem
          onClick={() => {
            const crash = contextMenuCrash;
            setContextMenuAnchor(null);
            setContextMenuCrash(null);
            if (crash) handleViewStackTrace(crash);
          }}
        >
          <ListItemIcon>
            <BugReportIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('crashes.viewStackTrace')}</ListItemText>
        </MenuItem>
        {contextMenuCrash?.crashesState !== CrashState.RESOLVED && (
          <MenuItem onClick={handleResolve}>
            <ListItemIcon>
              <CheckCircleIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('crashes.states.resolved')}</ListItemText>
          </MenuItem>
        )}
        {contextMenuCrash?.crashesState !== CrashState.OPEN && (
          <MenuItem onClick={handleReopen}>
            <ListItemIcon>
              <ReplayIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('crashes.states.open')}</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={handleOpenAssignDialog}>
          <ListItemIcon>
            <PersonIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('crashes.assignee', 'Assignee')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleOpenJiraDialog}>
          <ListItemIcon>
            <LinkIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Jira</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            const crash = contextMenuCrash;
            setContextMenuAnchor(null);
            setContextMenuCrash(null);
            if (crash) {
              const jsonData = JSON.stringify(crash, null, 2);
              copyToClipboardWithNotification(
                jsonData,
                () =>
                  enqueueSnackbar(t('common.copiedToClipboard'), {
                    variant: 'success',
                  }),
                () =>
                  enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
              );
            }
          }}
        >
          <ListItemIcon>
            <CopyIcon sx={{ fontSize: 14 }} />
          </ListItemIcon>
          <ListItemText>{t('common.copyData')}</ListItemText>
        </MenuItem>
      </Menu>

      {/* Assignee Dialog */}
      <Dialog
        open={assigneeDialogOpen}
        onClose={() => setAssigneeDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('crashes.assignee', 'Assignee')}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            size="small"
            value={assigneeValue}
            onChange={(e) => setAssigneeValue(e.target.value)}
            placeholder={t('crashes.assignee', 'Assignee')}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssigneeDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained" onClick={handleSaveAssignee}>
            {t('common.update')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Jira Dialog */}
      <Dialog
        open={jiraDialogOpen}
        onClose={() => setJiraDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Jira</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            size="small"
            value={jiraValue}
            onChange={(e) => setJiraValue(e.target.value)}
            placeholder="JIRA-123 or URL"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJiraDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained" onClick={handleSaveJira}>
            {t('common.update')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Drawer for Stack Trace and Log */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={handleCloseDrawer}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 3,
          '& .MuiDrawer-paper': {
            width: `${drawerWidth}px`,
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
        ModalProps={{
          keepMounted: false,
        }}
      >
        {/* Resize Grip */}
        <Box
          onMouseDown={handleMouseDown}
          sx={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '4px',
            cursor: 'ew-resize',
            bgcolor: isResizing ? 'primary.main' : 'transparent',
            transition: 'background-color 0.2s',
            zIndex: 1000,
            '&:hover': {
              bgcolor: 'primary.light',
            },
          }}
        />
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Box>
            <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
              {drawerType === 'stackTrace'
                ? t('crashes.viewStackTrace')
                : t('crashes.viewLog')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {drawerType === 'stackTrace'
                ? t('crashes.viewStackTraceSubtitle')
                : t('crashes.viewLogSubtitle')}
            </Typography>
          </Box>
          <IconButton
            onClick={handleCloseDrawer}
            size="small"
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box
          sx={{
            flex: 1,
            overflow: 'hidden',
            p: 2,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {drawerType === 'stackTrace' ? (
            // Stack Trace View
            loadingDrawer ? (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  p: 4,
                }}
              >
                <HourglassIcon
                  sx={{
                    fontSize: 48,
                    color: 'primary.main',
                    animation: 'hourglassRotate 2s ease-in-out infinite',
                    '@keyframes hourglassRotate': {
                      '0%': { transform: 'rotate(0deg)' },
                      '50%': { transform: 'rotate(180deg)' },
                      '100%': { transform: 'rotate(360deg)' },
                    },
                  }}
                />
              </Box>
            ) : drawerContent ? (
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <StackTraceViewer stackTrace={drawerContent} />
              </Box>
            ) : (
              <Typography color="text.secondary">
                {t('crashes.stackTraceNotAvailable')}
              </Typography>
            )
          ) : // Log View
          loadingDrawer ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                p: 4,
              }}
            >
              <HourglassIcon
                sx={{
                  fontSize: 48,
                  color: 'primary.main',
                  animation: 'hourglassRotate 2s ease-in-out infinite',
                  '@keyframes hourglassRotate': {
                    '0%': { transform: 'rotate(0deg)' },
                    '50%': { transform: 'rotate(180deg)' },
                    '100%': { transform: 'rotate(360deg)' },
                  },
                }}
              />
            </Box>
          ) : drawerContent ? (
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <LogViewer
                logContent={drawerContent}
                logFilePath={selectedEventLogPath}
                eventId={selectedEventId || undefined}
              />
            </Box>
          ) : (
            <Typography color="text.secondary">
              {t('crashes.logNotAvailable')}
            </Typography>
          )}
        </Box>
      </Drawer>
    </Box>
  );
};

export default CrashesPage;
