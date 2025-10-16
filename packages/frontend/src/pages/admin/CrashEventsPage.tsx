import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  CardContent,
  Drawer,
  Collapse,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  Paper,
  Button,
} from '@mui/material';
import {
  Search as SearchIcon,
  BugReport as BugReportIcon,
  Description as LogIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  TableChart as TableIcon,
  DataObject as JsonIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Link as LinkIcon,
  HourglassEmpty as HourglassIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import dayjs, { Dayjs } from 'dayjs';

// Types and Services
import {
  CrashEvent,
  GetCrashEventsRequest,
  getPlatformName,
  getEnvironmentName,
} from '@/types/crash';
import crashService from '@/services/crashService';
import SimplePagination from '../../components/common/SimplePagination';
import EmptyTableRow from '../../components/common/EmptyTableRow';
import DynamicFilterBar, { FilterDefinition, ActiveFilter } from '../../components/common/DynamicFilterBar';
import DateRangePicker, { DateRangePreset } from '../../components/common/DateRangePicker';
import { usePageState } from '../../hooks/usePageState';
import { useDebounce } from '../../hooks/useDebounce';
import LogViewer from '../../components/LogViewer';
import StackTraceViewer from '../../components/StackTraceViewer';

const CrashEventsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // Page state management (localStorage + URL params)
  const {
    pageState,
    updatePage,
    updateLimit,
    updateSort,
  } = usePageState({
    defaultState: {
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
      filters: {},
    },
    storageKey: 'crashEventsPage',
  });

  // State
  const [events, setEvents] = useState<CrashEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  // Date range state - restore from pageState.filters
  const [dateFrom, setDateFrom] = useState<Dayjs | null>(
    pageState.filters?.dateFrom ? dayjs(pageState.filters.dateFrom) : dayjs().subtract(7, 'day')
  );
  const [dateTo, setDateTo] = useState<Dayjs | null>(
    pageState.filters?.dateTo ? dayjs(pageState.filters.dateTo) : dayjs()
  );
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('last7d');

  // Search state - restore from pageState.filters
  const [searchTerm, setSearchTerm] = useState<string>(pageState.filters?.search || '');

  // Debounced search term (500ms delay)
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Filter options from backend
  const [filterOptions, setFilterOptions] = useState<{
    platforms: string[];
    environments: string[];
    branches: string[];
    marketTypes: string[];
    appVersions: string[];
  }>({
    platforms: [],
    environments: [],
    branches: [],
    marketTypes: [],
    appVersions: [],
  });

  // Dynamic filters state
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [filtersInitialized, setFiltersInitialized] = useState(false);

  // Dialog state for viewing crash details
  const [expandedRowId, setExpandedRowId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('expandedId') || null;
  });
  const [detailViewMode, setDetailViewMode] = useState<'table' | 'json'>('table');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState<'stackTrace' | 'log'>('log');
  const [selectedEvent, setSelectedEvent] = useState<CrashEvent | null>(null);
  const [logContent, setLogContent] = useState<string>('');
  const [stackTraceMap, setStackTraceMap] = useState<Record<string, string>>({});
  const [loadingLog, setLoadingLog] = useState(false);
  const [loadingStackTraceId, setLoadingStackTraceId] = useState<string | null>(null);

  // Drawer fullscreen state (persisted in localStorage, separate for stackTrace and log)
  const [isStackTraceFullscreen, setIsStackTraceFullscreen] = useState<boolean>(() => {
    const saved = localStorage.getItem('crashEventsStackTraceFullscreen');
    return saved === 'true';
  });
  const [isLogFullscreen, setIsLogFullscreen] = useState<boolean>(() => {
    const saved = localStorage.getItem('crashEventsLogFullscreen');
    return saved === 'true';
  });

  // Initial scroll line for log viewer (from URL hash)
  // Capture hash at mount time to prevent it from being lost
  const [initialLogScrollLine, setInitialLogScrollLine] = useState<number | undefined>(undefined);
  const initialHashRef = useRef<string>(window.location.hash);

  // Dynamic filter definitions
  const availableFilterDefinitions: FilterDefinition[] = useMemo(() => [
    {
      key: 'platform',
      label: t('crashes.filters.platform'),
      type: 'multiselect',
      operator: 'any_of',
      allowOperatorToggle: false,
      options: filterOptions.platforms.map(p => ({
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
      options: filterOptions.environments.map(e => ({
        value: e,
        label: getEnvironmentName(e),
      })),
    },
    {
      key: 'branch',
      label: t('crashes.filters.branch'),
      type: 'multiselect',
      operator: 'any_of',
      allowOperatorToggle: false,
      options: filterOptions.branches.map(b => ({
        value: b,
        label: b,
      })),
    },
    {
      key: 'marketType',
      label: t('crashes.filters.marketType'),
      type: 'multiselect',
      operator: 'any_of',
      allowOperatorToggle: false,
      options: filterOptions.marketTypes.map(m => ({
        value: m,
        label: m,
      })),
    },
    {
      key: 'appVersion',
      label: t('crashes.filters.appVersion'),
      type: 'multiselect',
      operator: 'any_of',
      allowOperatorToggle: false,
      options: filterOptions.appVersions.map(v => ({
        value: v,
        label: v,
      })),
    },
    {
      key: 'isEditor',
      label: t('crashes.filters.isEditor'),
      type: 'select',
      operator: 'any_of',
      allowOperatorToggle: false,
      options: [
        { value: 'true', label: t('common.yes') },
        { value: 'false', label: t('common.no') },
      ],
    },
  ], [t, filterOptions]);

  // Dynamic filter handlers
  const handleFilterAdd = (filter: ActiveFilter) => {
    setActiveFilters([...activeFilters, filter]);
  };

  const handleFilterRemove = (filterKey: string) => {
    setActiveFilters(activeFilters.filter(f => f.key !== filterKey));
  };

  const handleDynamicFilterChange = (filterKey: string, value: any) => {
    setActiveFilters(activeFilters.map(f =>
      f.key === filterKey ? { ...f, value } : f
    ));
  };

  const handleOperatorChange = (filterKey: string, operator: 'any_of' | 'include_all') => {
    setActiveFilters(activeFilters.map(f =>
      f.key === filterKey ? { ...f, operator } : f
    ));
  };

  // Load filter options
  const loadFilterOptions = useCallback(async () => {
    try {
      const options = await crashService.getFilterOptions();
      setFilterOptions({
        platforms: options.platforms || [],
        environments: options.environments || [],
        branches: options.branches || [],
        marketTypes: options.marketTypes || [],
        appVersions: options.appVersions || [],
      });
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  }, []);

  // Build query params from active filters
  const buildQueryParams = useCallback((): GetCrashEventsRequest => {
    const params: GetCrashEventsRequest = {
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
    activeFilters.forEach(filter => {
      const value = Array.isArray(filter.value) && filter.value.length > 0
        ? filter.value.join(',')
        : filter.value;

      if (value) {
        if (filter.key === 'isEditor') {
          params.isEditor = value === 'true';
        } else {
          (params as any)[filter.key] = value;
          // Add operator suffix for multiselect filters
          if (filter.operator && Array.isArray(filter.value)) {
            (params as any)[`${filter.key}Operator`] = filter.operator;
          }
        }
      }
    });

    return params;
  }, [pageState.page, pageState.limit, pageState.sortBy, pageState.sortOrder, debouncedSearchTerm, dateFrom, dateTo, activeFilters]);

  // Load events
  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildQueryParams();
      const response = await crashService.getCrashEvents(params);
      setEvents(response.data || []);
      setTotal(response.total || 0);
    } catch (error) {
      console.error('Error loading crash events:', error);
      enqueueSnackbar(t('crashes.loadError'), { variant: 'error' });
      setEvents([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams, enqueueSnackbar, t]);

  // Load filter options on mount
  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  // Load events when filters change
  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Restore active filters from pageState.filters on mount
  useEffect(() => {
    if (filtersInitialized) return;

    if (!pageState.filters || Object.keys(pageState.filters).length === 0) {
      setFiltersInitialized(true);
      return;
    }

    const restoredFilters: ActiveFilter[] = [];
    const filters = pageState.filters;

    // Restore each filter type
    Object.entries(filters).forEach(([key, value]) => {
      // Skip special keys
      if (['search', 'dateFrom', 'dateTo'].includes(key)) return;

      const filterDef = availableFilterDefinitions.find(f => f.key === key);
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

  // Update URL when expandedRowId changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (expandedRowId) {
      params.set('expandedId', expandedRowId);
    } else {
      params.delete('expandedId');
    }

    const paramsString = params.toString();
    const newUrl = paramsString
      ? `${window.location.pathname}?${paramsString}`
      : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }, [expandedRowId]);

  // Auto-open log drawer from URL parameters (for shareable log line links)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get('eventId');
    const action = params.get('action');

    if (eventId && action === 'viewLog' && events.length > 0) {
      const event = events.find(e => e.id === eventId);

      if (event && event.logFilePath) {
        // Extract line number from the hash captured at mount time
        const hash = initialHashRef.current;
        let lineNumber: number | undefined = undefined;
        if (hash.startsWith('#L')) {
          const parsed = parseInt(hash.substring(2), 10);
          if (!isNaN(parsed)) {
            lineNumber = parsed;
          }
        }

        // Open log drawer
        setSelectedEvent(event);
        setDrawerType('log');
        setDrawerOpen(true);
        setLogContent('');
        setLoadingLog(true);
        setInitialLogScrollLine(lineNumber);

        // Load log content
        crashService.getLogFile(event.id)
          .then(logData => {
            setLogContent(logData.logContent);

            // Clean up URL parameters AFTER loading content
            // Use setTimeout to ensure state updates are processed first
            setTimeout(() => {
              const currentParams = new URLSearchParams(window.location.search);
              currentParams.delete('eventId');
              currentParams.delete('action');
              const newUrl = currentParams.toString()
                ? `${window.location.pathname}?${currentParams.toString()}${window.location.hash}`
                : `${window.location.pathname}${window.location.hash}`;
              window.history.replaceState({}, '', newUrl);

              // Reset initialLogScrollLine after scroll has been applied
              // This prevents the line number from being applied to other logs
              setTimeout(() => {
                setInitialLogScrollLine(undefined);
              }, 2000); // Wait for scroll animations to complete
            }, 100);
          })
          .catch(error => {
            console.error('Failed to load log file:', error);
            enqueueSnackbar(t('crashes.logNotAvailable'), { variant: 'warning' });
          })
          .finally(() => {
            setLoadingLog(false);
          });
      }
    }
  }, [events, enqueueSnackbar, t]);



  const handlePageChange = useCallback((_: unknown, newPage: number) => {
    updatePage(newPage + 1); // MUI uses 0-based, we use 1-based
  }, [updatePage]);

  const handleRowsPerPageChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newLimit = parseInt(event.target.value, 10);
    updateLimit(newLimit);
  }, [updateLimit]);

  const handleSort = useCallback((column: string) => {
    const newSortOrder = pageState.sortBy === column && pageState.sortOrder === 'DESC' ? 'ASC' : 'DESC';
    updateSort(column, newSortOrder);
  }, [pageState.sortBy, pageState.sortOrder, updateSort]);

  const handleToggleRow = async (eventId: string) => {
    const isExpanding = expandedRowId !== eventId;
    setExpandedRowId(isExpanding ? eventId : null);

    // Load stack trace when expanding
    if (isExpanding && !stackTraceMap[eventId]) {
      setLoadingStackTraceId(eventId);
      try {
        const stackData = await crashService.getStackTrace(eventId);
        setStackTraceMap(prev => ({
          ...prev,
          [eventId]: stackData.stackTrace,
        }));
      } catch (error) {
        console.error('Failed to load stack trace:', error);
        // Don't show error snackbar, just show "not available" in UI
      } finally {
        setLoadingStackTraceId(null);
      }
    }
  };

  const handleCopyTableData = useCallback((event: CrashEvent) => {
    // Create TSV (Tab-Separated Values) format for easy paste into spreadsheet
    const fields = [
      ['ID', event.id],
      ['Created At', dayjs(event.createdAt).format('YYYY-MM-DD HH:mm:ss')],
      ['Platform', getPlatformName(event.platform)],
      ['Environment', getEnvironmentName(event.environment)],
      ['Branch', event.branch],
      ['App Version', event.appVersion || '-'],
      ['Res Version', event.resVersion || '-'],
      ['Account ID', event.accountId || '-'],
      ['Character ID', event.characterId || '-'],
      ['Game User ID', event.gameUserId || '-'],
      ['User Name', event.userName || '-'],
      ['Game Server ID', event.gameServerId || '-'],
      ['Market Type', event.marketType || '-'],
      ['Is Editor', event.isEditor ? 'Yes' : 'No'],
      ['IP Address', event.crashEventIp || '-'],
      ['User Agent', event.crashEventUserAgent || '-'],
      ['User Message', event.userMessage || '-'],
    ];
    const tsvData = fields.map(([key, value]) => `${key}\t${value}`).join('\n');
    navigator.clipboard.writeText(tsvData);
    enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' });
  }, [t, enqueueSnackbar]);

  const handleCopyJsonData = useCallback((event: CrashEvent) => {
    const jsonData = JSON.stringify(event, null, 2);
    navigator.clipboard.writeText(jsonData);
    enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' });
  }, [t, enqueueSnackbar]);

  const handleCopyCurrentView = useCallback(() => {
    const currentUrl = window.location.href;
    navigator.clipboard.writeText(currentUrl);
    enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' });
  }, [t, enqueueSnackbar]);

  const handleViewLog = async (event: CrashEvent) => {
    setSelectedEvent(event);
    setDrawerType('log');
    setDrawerOpen(true);
    setLogContent('');
    setInitialLogScrollLine(undefined); // Reset scroll line when manually opening log

    if (event.logFilePath) {
      setLoadingLog(true);
      try {
        const logData = await crashService.getLogFile(event.id);
        setLogContent(logData.logContent);
      } catch (error) {
        console.error('Failed to load log file:', error);
        enqueueSnackbar(t('crashes.logNotAvailable'), { variant: 'warning' });
      } finally {
        setLoadingLog(false);
      }
    }
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedEvent(null);
    setLogContent('');
    setInitialLogScrollLine(undefined); // Reset scroll line when closing drawer
  };

  const handleToggleDrawerFullscreen = () => {
    if (drawerType === 'stackTrace') {
      const newValue = !isStackTraceFullscreen;
      setIsStackTraceFullscreen(newValue);
      localStorage.setItem('crashEventsStackTraceFullscreen', String(newValue));
    } else {
      const newValue = !isLogFullscreen;
      setIsLogFullscreen(newValue);
      localStorage.setItem('crashEventsLogFullscreen', String(newValue));
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <BugReportIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {t('crashes.crashEvents')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('crashes.subtitle')}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Search & Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
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
              availablePresets={['today', 'yesterday', 'last7d', 'last30d', 'custom']}
              size="small"
            />

            {/* Search */}
            <TextField
              placeholder={t('crashes.searchPlaceholder')}
              size="small"
              sx={{
                minWidth: 450,
                flexGrow: 1,
                maxWidth: 450,
                '& .MuiOutlinedInput-root': {
                  height: '40px',
                  borderRadius: '20px',
                  bgcolor: 'background.paper',
                  transition: 'all 0.2s ease-in-out',
                  '& fieldset': {
                    borderColor: 'divider',
                  },
                  '&:hover': {
                    bgcolor: 'action.hover',
                    '& fieldset': {
                      borderColor: 'primary.light',
                    }
                  },
                  '&.Mui-focused': {
                    bgcolor: 'background.paper',
                    boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.1)',
                    '& fieldset': {
                      borderColor: 'primary.main',
                      borderWidth: '1px',
                    }
                  }
                },
                '& .MuiInputBase-input': {
                  fontSize: '0.875rem',
                }
              }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
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
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width="40px"></TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }} onClick={() => handleSort('createdAt')}>
                    {t('crashes.table.createdAt')}
                    {pageState.sortBy === 'createdAt' && (
                      pageState.sortOrder === 'DESC' ? <ArrowDownwardIcon fontSize="small" /> : <ArrowUpwardIcon fontSize="small" />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }} onClick={() => handleSort('platform')}>
                    {t('crashes.table.platform')}
                    {pageState.sortBy === 'platform' && (
                      pageState.sortOrder === 'DESC' ? <ArrowDownwardIcon fontSize="small" /> : <ArrowUpwardIcon fontSize="small" />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }} onClick={() => handleSort('environment')}>
                    {t('crashes.table.environment')}
                    {pageState.sortBy === 'environment' && (
                      pageState.sortOrder === 'DESC' ? <ArrowDownwardIcon fontSize="small" /> : <ArrowUpwardIcon fontSize="small" />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }} onClick={() => handleSort('branch')}>
                    {t('crashes.table.branch')}
                    {pageState.sortBy === 'branch' && (
                      pageState.sortOrder === 'DESC' ? <ArrowDownwardIcon fontSize="small" /> : <ArrowUpwardIcon fontSize="small" />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }} onClick={() => handleSort('appVersion')}>
                    {t('crashes.table.appVersion')}
                    {pageState.sortBy === 'appVersion' && (
                      pageState.sortOrder === 'DESC' ? <ArrowDownwardIcon fontSize="small" /> : <ArrowUpwardIcon fontSize="small" />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }} onClick={() => handleSort('resVersion')}>
                    {t('crashes.table.resVersion')}
                    {pageState.sortBy === 'resVersion' && (
                      pageState.sortOrder === 'DESC' ? <ArrowDownwardIcon fontSize="small" /> : <ArrowUpwardIcon fontSize="small" />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }} onClick={() => handleSort('accountId')}>
                    {t('crashes.table.accountId')}
                    {pageState.sortBy === 'accountId' && (
                      pageState.sortOrder === 'DESC' ? <ArrowDownwardIcon fontSize="small" /> : <ArrowUpwardIcon fontSize="small" />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }} onClick={() => handleSort('characterId')}>
                    {t('crashes.table.characterId')}
                    {pageState.sortBy === 'characterId' && (
                      pageState.sortOrder === 'DESC' ? <ArrowDownwardIcon fontSize="small" /> : <ArrowUpwardIcon fontSize="small" />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }} onClick={() => handleSort('gameUserId')}>
                    {t('crashes.table.gameUserId')}
                    {pageState.sortBy === 'gameUserId' && (
                      pageState.sortOrder === 'DESC' ? <ArrowDownwardIcon fontSize="small" /> : <ArrowUpwardIcon fontSize="small" />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }} onClick={() => handleSort('userName')}>
                    {t('crashes.table.userName')}
                    {pageState.sortBy === 'userName' && (
                      pageState.sortOrder === 'DESC' ? <ArrowDownwardIcon fontSize="small" /> : <ArrowUpwardIcon fontSize="small" />
                    )}
                  </Box>
                </TableCell>
                <TableCell width="150px">{t('crashes.table.userMessage')}</TableCell>
                <TableCell align="center" width="100px">{t('crashes.columns.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.length === 0 ? (
                <EmptyTableRow colSpan={13} message={t('crashes.noEvents')} loading={loading} />
              ) : (
                events.map((event, index) => (
                  <React.Fragment key={event.id}>
                    <TableRow
                      hover
                      sx={{
                        bgcolor: (theme) =>
                          index % 2 === 0
                            ? 'transparent'
                            : theme.palette.mode === 'dark'
                              ? 'rgba(255, 255, 255, 0.02)'
                              : 'rgba(0, 0, 0, 0.02)',
                      }}
                    >
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleToggleRow(event.id)}
                        >
                          {expandedRowId === event.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        {dayjs(event.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getPlatformName(event.platform)}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getEnvironmentName(event.environment)}
                          size="small"
                          color="secondary"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={event.branch}
                          size="small"
                          color="info"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={event.appVersion || '-'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={event.resVersion || '-'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{event.accountId || '-'}</TableCell>
                      <TableCell>{event.characterId || '-'}</TableCell>
                      <TableCell>{event.gameUserId || '-'}</TableCell>
                      <TableCell>{event.userName || '-'}</TableCell>
                      <TableCell>
                        <Tooltip title={event.userMessage || ''} arrow>
                          <Typography
                            variant="body2"
                            sx={{
                              maxWidth: 120,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {event.userMessage || '-'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                          <Tooltip title={t('crashes.viewStackTrace')}>
                            <IconButton
                              size="small"
                              onClick={async () => {
                                try {
                                  const stackData = await crashService.getStackTrace(event.id);
                                  setSelectedEvent(event);
                                  setStackTraceMap(prev => ({
                                    ...prev,
                                    [event.id]: stackData.stackTrace,
                                  }));
                                  setDrawerType('stackTrace');
                                  setDrawerOpen(true);
                                } catch (error) {
                                  console.error('Failed to load stack trace:', error);
                                  enqueueSnackbar(t('crashes.loadError'), { variant: 'error' });
                                }
                              }}
                            >
                              <BugReportIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {event.logFilePath && (
                            <Tooltip title={t('crashes.viewLog')}>
                              <IconButton
                                size="small"
                                onClick={() => handleViewLog(event)}
                              >
                                <LogIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={13} sx={{ p: 0, border: 0 }}>
                        <Collapse in={expandedRowId === event.id} timeout="auto" unmountOnExit>
                          <Box sx={{
                            py: 2,
                            pl: 10,
                            pr: 3,
                            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                            borderTop: 1,
                            borderBottom: 1,
                            borderColor: 'divider',
                          }}>
                            {/* Properties Title */}
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                              {t('crashes.properties')}
                            </Typography>

                            {/* Table View */}
                            {detailViewMode === 'table' && (
                              <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                                <Table size="small">
                                  <TableBody>
                                    {/* ID */}
                                    <TableRow>
                                      <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover', whiteSpace: 'nowrap' }}>
                                        ID
                                      </TableCell>
                                      <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                            {event.id}
                                          </Typography>
                                          <IconButton
                                            size="small"
                                            onClick={() => {
                                              navigator.clipboard.writeText(event.id);
                                              enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' });
                                            }}
                                          >
                                            <CopyIcon fontSize="small" />
                                          </IconButton>
                                        </Box>
                                      </TableCell>
                                    </TableRow>

                                    {/* Created At */}
                                    <TableRow>
                                      <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover', whiteSpace: 'nowrap' }}>
                                        {t('crashes.table.createdAt')}
                                      </TableCell>
                                      <TableCell>
                                        <Typography variant="body2">
                                          {dayjs(event.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                                        </Typography>
                                      </TableCell>
                                    </TableRow>

                                    {/* Platform */}
                                    <TableRow>
                                      <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover', whiteSpace: 'nowrap' }}>
                                        {t('crashes.table.platform')}
                                      </TableCell>
                                      <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                          <Chip
                                            label={getPlatformName(event.platform)}
                                            size="small"
                                            color="primary"
                                            variant="outlined"
                                          />
                                          <IconButton
                                            size="small"
                                            onClick={() => {
                                              navigator.clipboard.writeText(event.platform);
                                              enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' });
                                            }}
                                          >
                                            <CopyIcon fontSize="small" />
                                          </IconButton>
                                        </Box>
                                      </TableCell>
                                    </TableRow>

                                    {/* Environment */}
                                    <TableRow>
                                      <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover', whiteSpace: 'nowrap' }}>
                                        {t('crashes.table.environment')}
                                      </TableCell>
                                      <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                          <Chip
                                            label={getEnvironmentName(event.environment)}
                                            size="small"
                                            color="secondary"
                                            variant="outlined"
                                          />
                                          <IconButton
                                            size="small"
                                            onClick={() => {
                                              navigator.clipboard.writeText(event.environment);
                                              enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' });
                                            }}
                                          >
                                            <CopyIcon fontSize="small" />
                                          </IconButton>
                                        </Box>
                                      </TableCell>
                                    </TableRow>

                                    {/* Branch */}
                                    <TableRow>
                                      <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover', whiteSpace: 'nowrap' }}>
                                        {t('crashes.table.branch')}
                                      </TableCell>
                                      <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                          <Chip
                                            label={event.branch}
                                            size="small"
                                            color="info"
                                            variant="outlined"
                                          />
                                          <IconButton
                                            size="small"
                                            onClick={() => {
                                              navigator.clipboard.writeText(event.branch);
                                              enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' });
                                            }}
                                          >
                                            <CopyIcon fontSize="small" />
                                          </IconButton>
                                        </Box>
                                      </TableCell>
                                    </TableRow>

                                    {/* App Version */}
                                    <TableRow>
                                      <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover', whiteSpace: 'nowrap' }}>
                                        {t('crashes.table.appVersion')}
                                      </TableCell>
                                      <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                          <Chip
                                            label={event.appVersion || '-'}
                                            size="small"
                                            variant="outlined"
                                          />
                                          {event.appVersion && (
                                            <IconButton
                                              size="small"
                                              onClick={() => {
                                                navigator.clipboard.writeText(event.appVersion!);
                                                enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' });
                                              }}
                                            >
                                              <CopyIcon fontSize="small" />
                                            </IconButton>
                                          )}
                                        </Box>
                                      </TableCell>
                                    </TableRow>

                                    {/* Res Version */}
                                    <TableRow>
                                      <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover', whiteSpace: 'nowrap' }}>
                                        {t('crashes.table.resVersion')}
                                      </TableCell>
                                      <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                          <Chip
                                            label={event.resVersion || '-'}
                                            size="small"
                                            variant="outlined"
                                          />
                                          {event.resVersion && (
                                            <IconButton
                                              size="small"
                                              onClick={() => {
                                                navigator.clipboard.writeText(event.resVersion!);
                                                enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' });
                                              }}
                                            >
                                              <CopyIcon fontSize="small" />
                                            </IconButton>
                                          )}
                                        </Box>
                                      </TableCell>
                                    </TableRow>

                                    {/* Account ID */}
                                    {event.accountId != null && (
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover', whiteSpace: 'nowrap' }}>
                                          {t('crashes.table.accountId')}
                                        </TableCell>
                                        <TableCell>
                                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Typography variant="body2">{event.accountId}</Typography>
                                            <IconButton
                                              size="small"
                                              onClick={() => {
                                                navigator.clipboard.writeText(String(event.accountId));
                                                enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' });
                                              }}
                                            >
                                              <CopyIcon fontSize="small" />
                                            </IconButton>
                                          </Box>
                                        </TableCell>
                                      </TableRow>
                                    )}

                                    {/* Character ID */}
                                    {event.characterId != null && (
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover', whiteSpace: 'nowrap' }}>
                                          {t('crashes.table.characterId')}
                                        </TableCell>
                                        <TableCell>
                                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Typography variant="body2">{event.characterId}</Typography>
                                            <IconButton
                                              size="small"
                                              onClick={() => {
                                                navigator.clipboard.writeText(String(event.characterId));
                                                enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' });
                                              }}
                                            >
                                              <CopyIcon fontSize="small" />
                                            </IconButton>
                                          </Box>
                                        </TableCell>
                                      </TableRow>
                                    )}

                                    {/* Game User ID */}
                                    {event.gameUserId != null && (
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover', whiteSpace: 'nowrap' }}>
                                          {t('crashes.table.gameUserId')}
                                        </TableCell>
                                        <TableCell>
                                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Typography variant="body2">{event.gameUserId}</Typography>
                                            <IconButton
                                              size="small"
                                              onClick={() => {
                                                navigator.clipboard.writeText(String(event.gameUserId));
                                                enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' });
                                              }}
                                            >
                                              <CopyIcon fontSize="small" />
                                            </IconButton>
                                          </Box>
                                        </TableCell>
                                      </TableRow>
                                    )}

                                    {/* User Name */}
                                    {!!event.userName && (
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover', whiteSpace: 'nowrap' }}>
                                          {t('crashes.table.userName')}
                                        </TableCell>
                                        <TableCell>
                                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Typography variant="body2">{event.userName}</Typography>
                                            <IconButton
                                              size="small"
                                              onClick={() => {
                                                navigator.clipboard.writeText(event.userName!);
                                                enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' });
                                              }}
                                            >
                                              <CopyIcon fontSize="small" />
                                            </IconButton>
                                          </Box>
                                        </TableCell>
                                      </TableRow>
                                    )}

                                    {/* Game Server ID */}
                                    {event.gameServerId != null && (
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover', whiteSpace: 'nowrap' }}>
                                          {t('crashes.table.gameServerId')}
                                        </TableCell>
                                        <TableCell>
                                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Typography variant="body2">{event.gameServerId}</Typography>
                                            <IconButton
                                              size="small"
                                              onClick={() => {
                                                navigator.clipboard.writeText(String(event.gameServerId));
                                                enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' });
                                              }}
                                            >
                                              <CopyIcon fontSize="small" />
                                            </IconButton>
                                          </Box>
                                        </TableCell>
                                      </TableRow>
                                    )}

                                    {/* Market Type */}
                                    {!!event.marketType && (
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover', whiteSpace: 'nowrap' }}>
                                          {t('crashes.table.marketType')}
                                        </TableCell>
                                        <TableCell>
                                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Typography variant="body2">{event.marketType}</Typography>
                                            <IconButton
                                              size="small"
                                              onClick={() => {
                                                navigator.clipboard.writeText(event.marketType!);
                                                enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' });
                                              }}
                                            >
                                              <CopyIcon fontSize="small" />
                                            </IconButton>
                                          </Box>
                                        </TableCell>
                                      </TableRow>
                                    )}

                                    {/* Is Editor */}
                                    {!!event.isEditor && (
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover', whiteSpace: 'nowrap' }}>
                                          {t('crashes.table.isEditor')}
                                        </TableCell>
                                        <TableCell>
                                          <Chip label="Editor" size="small" color="warning" />
                                        </TableCell>
                                      </TableRow>
                                    )}

                                    {/* IP Address */}
                                    <TableRow>
                                      <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover', whiteSpace: 'nowrap' }}>
                                        {t('crashes.table.ipAddress')}
                                      </TableCell>
                                      <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                            {event.crashEventIp || '-'}
                                          </Typography>
                                          {event.crashEventIp && (
                                            <IconButton
                                              size="small"
                                              onClick={() => {
                                                navigator.clipboard.writeText(event.crashEventIp!);
                                                enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' });
                                              }}
                                            >
                                              <CopyIcon fontSize="small" />
                                            </IconButton>
                                          )}
                                        </Box>
                                      </TableCell>
                                    </TableRow>

                                    {/* User Agent */}
                                    <TableRow>
                                      <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover', whiteSpace: 'nowrap' }}>
                                        {t('crashes.table.userAgent')}
                                      </TableCell>
                                      <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                                            {event.crashEventUserAgent || '-'}
                                          </Typography>
                                          {event.crashEventUserAgent && (
                                            <IconButton
                                              size="small"
                                              onClick={() => {
                                                navigator.clipboard.writeText(event.crashEventUserAgent!);
                                                enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' });
                                              }}
                                            >
                                              <CopyIcon fontSize="small" />
                                            </IconButton>
                                          )}
                                        </Box>
                                      </TableCell>
                                    </TableRow>

                                    {/* User Message */}
                                    {!!event.userMessage && (
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                                          {t('crashes.table.userMessage')}
                                        </TableCell>
                                        <TableCell>
                                          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                                            <Typography
                                              variant="body2"
                                              sx={{
                                                flex: 1,
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word',
                                              }}
                                            >
                                              {event.userMessage}
                                            </Typography>
                                            <IconButton
                                              size="small"
                                              onClick={() => {
                                                navigator.clipboard.writeText(event.userMessage!);
                                                enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' });
                                              }}
                                            >
                                              <CopyIcon fontSize="small" />
                                            </IconButton>
                                          </Box>
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </TableBody>
                                </Table>
                              </Paper>
                            )}

                            {/* JSON View */}
                            {detailViewMode === 'json' && (
                              <Paper
                                variant="outlined"
                                sx={{
                                  p: 2,
                                  bgcolor: 'background.default',
                                  maxHeight: 600,
                                  overflow: 'auto',
                                }}
                              >
                                <pre style={{
                                  margin: 0,
                                  fontSize: '0.875rem',
                                  fontFamily: 'monospace',
                                  lineHeight: 1.6,
                                }}>
                                  {JSON.stringify(event, null, 2)}
                                </pre>
                              </Paper>
                            )}

                            {/* Toggle and Copy Button */}
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
                              <ToggleButtonGroup
                                value={detailViewMode}
                                exclusive
                                onChange={(_, newMode) => {
                                  if (newMode !== null) {
                                    setDetailViewMode(newMode);
                                  }
                                }}
                                size="small"
                              >
                                <ToggleButton value="table">
                                  <TableIcon fontSize="small" sx={{ mr: 0.5 }} />
                                  Table
                                </ToggleButton>
                                <ToggleButton value="json">
                                  <JsonIcon fontSize="small" sx={{ mr: 0.5 }} />
                                  JSON
                                </ToggleButton>
                              </ToggleButtonGroup>
                              <Tooltip title={detailViewMode === 'table' ? 'Copy as Table' : 'Copy as JSON'}>
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    if (detailViewMode === 'table') {
                                      handleCopyTableData(event);
                                    } else {
                                      handleCopyJsonData(event);
                                    }
                                  }}
                                >
                                  <CopyIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <SimplePagination
          count={total}
          page={pageState.page - 1} // SimplePagination uses 0-based
          rowsPerPage={pageState.limit}
          onPageChange={handlePageChange}
          onRowsPerPageChange={handleRowsPerPageChange}
        />
      </Card>

      {/* Drawer for Stack Trace and Log */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={handleCloseDrawer}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 3,
          '& .MuiDrawer-paper': {
            width: (drawerType === 'stackTrace' ? isStackTraceFullscreen : isLogFullscreen)
              ? '100vw'
              : { xs: '100%', sm: 600, md: 700 },
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
        ModalProps={{
          keepMounted: false
        }}
      >
        {/* Header */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}>
          <Box>
            <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
              {drawerType === 'stackTrace' ? t('crashes.viewStackTrace') : t('crashes.viewLog')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {drawerType === 'stackTrace' ? t('crashes.viewStackTraceSubtitle') : t('crashes.viewLogSubtitle')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title={(drawerType === 'stackTrace' ? isStackTraceFullscreen : isLogFullscreen) ? t('common.exitFullscreen') : t('common.enterFullscreen')}>
              <IconButton
                onClick={handleToggleDrawerFullscreen}
                size="small"
                sx={{
                  '&:hover': {
                    backgroundColor: 'action.hover'
                  }
                }}
              >
                {(drawerType === 'stackTrace' ? isStackTraceFullscreen : isLogFullscreen) ? <FullscreenExitIcon /> : <FullscreenIcon />}
              </IconButton>
            </Tooltip>
            <IconButton
              onClick={handleCloseDrawer}
              size="small"
              sx={{
                '&:hover': {
                  backgroundColor: 'action.hover'
                }
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'hidden', p: 2, display: 'flex', flexDirection: 'column' }}>
          {drawerType === 'stackTrace' ? (
            // Stack Trace View
            selectedEvent && stackTraceMap[selectedEvent.id] ? (
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <StackTraceViewer stackTrace={stackTraceMap[selectedEvent.id]} />
              </Box>
            ) : (
              <Typography color="text.secondary">{t('crashes.stackTraceNotAvailable')}</Typography>
            )
          ) : (
            // Log View
            loadingLog ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
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
            ) : logContent ? (
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <LogViewer
                  logContent={logContent}
                  logFilePath={selectedEvent?.logFilePath || ''}
                  eventId={selectedEvent?.id}
                  initialScrollLine={initialLogScrollLine}
                />
              </Box>
            ) : (
              <Typography color="text.secondary">{t('crashes.logNotAvailable')}</Typography>
            )
          )}
        </Box>
      </Drawer>
    </Box>
  );
};

export default CrashEventsPage;

