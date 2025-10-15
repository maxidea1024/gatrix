import React, { useState, useEffect, useCallback } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { usePageState } from '../../hooks/usePageState';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Alert,
  LinearProgress,
  Pagination,
  Skeleton,
  CircularProgress,
  Collapse,
  Paper,
  Divider,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Info as InfoIcon,
  ContentCopy as ContentCopyIcon,
  History as HistoryIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowRight as KeyboardArrowRightIcon,
} from '@mui/icons-material';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';

import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { AuditLogService, AuditLogFilters } from '../../services/auditLogService';
import { AuditLog } from '../../types';
import { formatDateTimeDetailed } from '../../utils/dateFormat';
import SimplePagination from '../../components/common/SimplePagination';
import EmptyTableRow from '../../components/common/EmptyTableRow';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { useI18n } from '../../contexts/I18nContext';
import { koKR, zhCN, enUS } from '@mui/x-date-pickers/locales';
import dayjs, { Dayjs } from 'dayjs';
import DateRangePicker, { DateRangePreset } from '../../components/common/DateRangePicker';
import DynamicFilterBar, { FilterDefinition, ActiveFilter } from '../../components/common/DynamicFilterBar';
import { InputAdornment } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';



const AuditLogsPage: React.FC = () => {
  const { t } = useTranslation();
  const { language } = useI18n();
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();

  // 페이지 상태 관리 (localStorage 연동)
  const {
    pageState,
    updatePage,
    updateLimit,
    updateFilters,
  } = usePageState({
    defaultState: {
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
      filters: {},
    },
    storageKey: 'auditLogsPage',
  });

  // Get locale text for DateTimePicker
  const getDatePickerLocale = () => {
    switch (language) {
      case 'ko':
        return koKR;
      case 'zh':
        return zhCN;
      default:
        return enUS;
    }
  };

  // State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Expanded row state
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);

  // Date range state
  const [dateFrom, setDateFrom] = useState<Dayjs | null>(
    pageState.filters?.start_date ? dayjs(pageState.filters.start_date) : dayjs().subtract(7, 'day')
  );
  const [dateTo, setDateTo] = useState<Dayjs | null>(
    pageState.filters?.end_date ? dayjs(pageState.filters.end_date) : dayjs()
  );
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('last7d');

  // Filters - localStorage에서 복원
  const [userFilter, setUserFilter] = useState<string>(pageState.filters?.user || '');

  // 동적 필터 상태
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [filtersInitialized, setFiltersInitialized] = useState(false);

  // 디바운싱된 검색어 (500ms 지연)
  const debouncedUserFilter = useDebounce(userFilter, 500);

  // Available filter definitions
  const availableFilters: FilterDefinition[] = [
    {
      key: 'action',
      label: t('auditLogs.action'),
      type: 'multiselect',
      operator: 'any_of',
      allowOperatorToggle: false, // Single-value field, only 'any_of' makes sense
      options: AuditLogService.getAvailableActions().map(action => ({
        value: action,
        label: t(`auditLogs.actions.${action}`),
      })),
    },
    {
      key: 'resource_type',
      label: t('auditLogs.resourceType'),
      type: 'multiselect',
      operator: 'any_of',
      allowOperatorToggle: false, // Single-value field, only 'any_of' makes sense
      options: AuditLogService.getAvailableResourceTypes().map(type => ({
        value: type,
        label: t(`auditLogs.resources.${type}`),
      })),
    },
    {
      key: 'ip_address',
      label: t('auditLogs.ipAddress'),
      type: 'text',
    },
  ];

  // Load audit logs
  const loadAuditLogs = useCallback(async () => {
    try {
      setLoading(true);

      const dateFilters: AuditLogFilters = { ...pageState.filters };
      if (dateFrom) {
        dateFilters.start_date = dateFrom.toISOString();
      }
      if (dateTo) {
        dateFilters.end_date = dateTo.toISOString();
      }
      if (debouncedUserFilter) {
        (dateFilters as any).user = debouncedUserFilter.trim();
      }

      // Add dynamic filters
      activeFilters.forEach(filter => {
        if (filter.value !== undefined && filter.value !== null && filter.value !== '') {
          // For multiselect filters, send as array with operator
          if (Array.isArray(filter.value) && filter.value.length > 0) {
            (dateFilters as any)[filter.key] = filter.value;
            // Add operator for multiselect filters
            if (filter.operator) {
              (dateFilters as any)[`${filter.key}_operator`] = filter.operator;
            }
          } else if (!Array.isArray(filter.value)) {
            // For text filters
            (dateFilters as any)[filter.key] = filter.value;
          }
        }
      });

      const result = await AuditLogService.getAuditLogs(
        pageState.page,
        pageState.limit,
        dateFilters
      );

      if (result && Array.isArray(result.logs)) {
        setAuditLogs(result.logs);
        setTotal(result.total || 0);
      } else {
        setAuditLogs([]);
        setTotal(0);
      }
    } catch (error: any) {
      console.error('Error loading audit logs:', error);
      enqueueSnackbar(error.message || t('auditLogs.loadFailed'), { variant: 'error' });
      setAuditLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  }, [pageState, dateFrom, dateTo, debouncedUserFilter, activeFilters, enqueueSnackbar, t]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  // Handlers
  const handlePageChange = (event: unknown, newPage: number) => {
    updatePage(newPage + 1); // MUI는 0부터 시작, 우리는 1부터 시작
  };

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newLimit = parseInt(event.target.value, 10);
    updateLimit(newLimit);
  };

  const handleFilterChange = (key: keyof AuditLogFilters, value: any) => {
    const newFilters = {
      ...pageState.filters,
      [key]: value || undefined,
    };
    updateFilters(newFilters);
  };

  const handleRefresh = () => {
    loadAuditLogs();
  };

  // 페이지 로드 시 pageState.filters에서 activeFilters 복원
  useEffect(() => {
    if (filtersInitialized) return;

    if (!pageState.filters || Object.keys(pageState.filters).length === 0) {
      setFiltersInitialized(true);
      return;
    }

    const restoredFilters: ActiveFilter[] = [];
    const filters = pageState.filters;

    // action 필터 복원
    if (filters.action) {
      restoredFilters.push({
        key: 'action',
        value: Array.isArray(filters.action) ? filters.action : [filters.action],
        label: t('auditLogs.action'),
        operator: 'any_of',
      });
    }

    // resource_type 필터 복원
    if (filters.resource_type) {
      restoredFilters.push({
        key: 'resource_type',
        value: Array.isArray(filters.resource_type) ? filters.resource_type : [filters.resource_type],
        label: t('auditLogs.resourceType'),
        operator: 'any_of',
      });
    }

    // ip_address 필터 복원
    if (filters.ip_address) {
      restoredFilters.push({
        key: 'ip_address',
        value: filters.ip_address,
        label: t('auditLogs.ipAddress'),
        operator: 'any_of',
      });
    }

    if (restoredFilters.length > 0) {
      setActiveFilters(restoredFilters);
    }
    setFiltersInitialized(true);
  }, [filtersInitialized, pageState.filters, t]);

  // Dynamic filter handlers
  const handleFilterAdd = (filter: ActiveFilter) => {
    setActiveFilters(prev => [...prev, filter]);
  };

  const handleFilterRemove = (filterKey: string) => {
    setActiveFilters(prev => prev.filter(f => f.key !== filterKey));
  };

  const handleDynamicFilterChange = (filterKey: string, value: any) => {
    setActiveFilters(prev =>
      prev.map(f => (f.key === filterKey ? { ...f, value } : f))
    );
  };

  const handleOperatorChange = (filterKey: string, operator: 'any_of' | 'include_all') => {
    setActiveFilters(prev =>
      prev.map(f => (f.key === filterKey ? { ...f, operator } : f))
    );
  };

  const formatDate = (dateString: string) => {
    return formatDateTimeDetailed(dateString);
  };

  const formatDetails = (details: any) => {
    if (!details) return '-';
    if (typeof details === 'string') return details;
    return JSON.stringify(details, null, 2);
  };

  const handleCopyDetails = async (details: any) => {
    try {
      let text = '';
      if (!details) {
        text = 'No details available';
      } else if (typeof details === 'string') {
        text = details;
      } else {
        text = JSON.stringify(details, null, 2);
      }
      await navigator.clipboard.writeText(text);
      enqueueSnackbar(t('auditLogs.detailsCopied'), { variant: 'success' });
    } catch (error) {
      console.error('Copy failed:', error);
      enqueueSnackbar(t('common.copyFailed'), { variant: 'error' });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <HistoryIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {t('auditLogs.title')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('auditLogs.subtitle')}
              </Typography>
            </Box>
          </Box>
        </Box>

      </Box>

        {/* Filters */}
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
                availablePresets={['today', 'yesterday', 'last7d', 'last30d', 'last3m', 'last6m', 'last12m', 'custom']}
                size="small"
              />

              {/* Search */}
              <TextField
                placeholder={t('auditLogs.searchUserPlaceholder')}
                size="small"
                sx={{
                  minWidth: 200,
                  flexGrow: 1,
                  maxWidth: 320,
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
                value={userFilter}
                onChange={(e) => {
                  const value = e.target.value;
                  setUserFilter(value);
                  handleFilterChange('user', value);
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
              />

              {/* Dynamic Filters */}
              <DynamicFilterBar
                availableFilters={availableFilters}
                activeFilters={activeFilters}
                onFilterAdd={handleFilterAdd}
                onFilterRemove={handleFilterRemove}
                onFilterChange={handleDynamicFilterChange}
                onOperatorChange={handleOperatorChange}
              />
            </Box>
          </CardContent>
        </Card>

        {/* Audit Logs Table */}

        <Card sx={{ position: 'relative' }}>
          <TableContainer
            sx={{
              opacity: !isInitialLoad && loading ? 0.5 : 1,
              transition: 'opacity 0.15s ease-in-out',
              pointerEvents: !isInitialLoad && loading ? 'none' : 'auto',
            }}
          >
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell width="50px"></TableCell>
                  <TableCell>{t('auditLogs.id')}</TableCell>
                  <TableCell>{t('auditLogs.action')}</TableCell>
                  <TableCell>{t('auditLogs.resource')}</TableCell>
                  <TableCell>{t('auditLogs.user')}</TableCell>
                  <TableCell>{t('auditLogs.ipAddress')}</TableCell>
                  <TableCell>{t('auditLogs.date')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isInitialLoad && loading ? (
                  // 스켈레톤 로딩 (초기 로딩 시에만)
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      <TableCell>
                        <Skeleton variant="circular" width={32} height={32} />
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="text" width={60} />
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="rounded" width={100} height={24} />
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Skeleton variant="text" width={120} />
                          <Skeleton variant="text" width={80} sx={{ fontSize: '0.75rem' }} />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="text" width={100} />
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="text" width="80%" />
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="text" width="70%" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : auditLogs.length === 0 ? (
                  <EmptyTableRow
                    colSpan={7}
                    loading={false}
                    message={t('auditLogs.noLogsFound')}
                    loadingMessage={t('common.loadingAuditLogs')}
                  />
                ) : (
                  auditLogs.map((log) => (
                    <React.Fragment key={log.id}>
                      <TableRow
                        hover
                        sx={{
                          cursor: 'pointer',
                          '& > *': { borderBottom: expandedRowId === log.id ? 'none' : undefined }
                        }}
                        onClick={() => setExpandedRowId(expandedRowId === log.id ? null : log.id)}
                      >
                        <TableCell>
                          <IconButton size="small">
                            {expandedRowId === log.id ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
                          </IconButton>
                        </TableCell>
                        <TableCell>{log.id}</TableCell>
                        <TableCell>
                          <Chip label={t(`auditLogs.actions.${log.action}`)} color={AuditLogService.getActionColor(log.action)} size="small" />
                        </TableCell>
                        <TableCell>
                          {((log as any).resourceType || (log as any).resource_type || (log as any).entityType) ? (
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {t(`auditLogs.resources.${(log as any).resourceType || (log as any).resource_type || (log as any).entityType}`, (log as any).resourceType || (log as any).resource_type || (log as any).entityType)}
                              </Typography>
                              {((log as any).resourceId || (log as any).resource_id || (log as any).entityId) && (
                                <Typography variant="caption" color="text.secondary">
                                  ID: {(log as any).resourceId || (log as any).resource_id || (log as any).entityId}
                                </Typography>
                              )}
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary">-</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.user_name ? (
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {log.user_name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {log.user_email}
                              </Typography>
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              {t('auditLogs.system')}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace">
                            {log.ip_address || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {formatDateTimeDetailed((log as any).createdAt || log.created_at)}
                          </Typography>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Detail Row */}
                      <TableRow>
                        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
                          <Collapse in={expandedRowId === log.id} timeout="auto" unmountOnExit>
                            <Box sx={{ py: 2, px: 3, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
                              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                                {t('auditLogs.detailsTitle')}
                              </Typography>

                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {/* IP Address & User Agent */}
                                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                                  <Box>
                                    <Typography variant="caption" color="text.secondary">
                                      {t('auditLogs.ipAddress')}
                                    </Typography>
                                    <Typography variant="body2" fontFamily="monospace">
                                      {log.ip_address || '-'}
                                    </Typography>
                                  </Box>
                                  {log.user_agent && (
                                    <Box>
                                      <Typography variant="caption" color="text.secondary">
                                        {t('auditLogs.userAgent')}
                                      </Typography>
                                      <Typography variant="body2" sx={{ wordBreak: 'break-all', fontSize: '0.75rem' }}>
                                        {log.user_agent}
                                      </Typography>
                                    </Box>
                                  )}
                                </Box>

                                <Divider />

                                {/* Changes - Diff Viewer */}
                                {log.old_values && log.new_values && (
                                  <Box>
                                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                                      {t('auditLogs.changes')}
                                    </Typography>
                                    <Paper sx={{
                                      mt: 0.5,
                                      bgcolor: 'background.default',
                                      overflow: 'hidden',
                                      '& pre': {
                                        fontSize: '0.75rem !important',
                                        fontFamily: 'monospace',
                                      },
                                      '& .diff-gutter': {
                                        minWidth: '30px',
                                      },
                                      '& .diff-code': {
                                        fontSize: '0.75rem',
                                      },
                                    }}>
                                      <ReactDiffViewer
                                        oldValue={JSON.stringify(log.old_values, null, 2)}
                                        newValue={JSON.stringify(log.new_values, null, 2)}
                                        splitView={false}
                                        compareMethod={DiffMethod.WORDS}
                                        useDarkTheme={theme.palette.mode === 'dark'}
                                        hideLineNumbers={false}
                                        showDiffOnly={true}
                                        styles={{
                                          variables: {
                                            dark: {
                                              diffViewerBackground: theme.palette.background.default,
                                              addedBackground: alpha(theme.palette.success.main, 0.2),
                                              addedColor: theme.palette.success.contrastText,
                                              removedBackground: alpha(theme.palette.error.main, 0.2),
                                              removedColor: theme.palette.error.contrastText,
                                              wordAddedBackground: alpha(theme.palette.success.main, 0.4),
                                              wordRemovedBackground: alpha(theme.palette.error.main, 0.4),
                                              gutterBackground: theme.palette.background.paper,
                                            },
                                            light: {
                                              diffViewerBackground: theme.palette.background.default,
                                              addedBackground: alpha(theme.palette.success.main, 0.1),
                                              addedColor: theme.palette.text.primary,
                                              removedBackground: alpha(theme.palette.error.main, 0.1),
                                              removedColor: theme.palette.text.primary,
                                              wordAddedBackground: alpha(theme.palette.success.main, 0.3),
                                              wordRemovedBackground: alpha(theme.palette.error.main, 0.3),
                                              gutterBackground: theme.palette.background.paper,
                                            },
                                          },
                                        }}
                                      />
                                    </Paper>
                                  </Box>
                                )}

                                {/* Show only new values if old values don't exist */}
                                {!log.old_values && log.new_values && (
                                  <Box>
                                    <Typography variant="caption" color="text.secondary">
                                      {t('auditLogs.newValues')}
                                    </Typography>
                                    <Paper sx={{ p: 1.5, mt: 0.5, bgcolor: 'background.default' }}>
                                      <pre style={{ margin: 0, fontSize: '0.75rem', overflow: 'auto', fontFamily: 'monospace' }}>
                                        {JSON.stringify(log.new_values, null, 2)}
                                      </pre>
                                    </Paper>
                                  </Box>
                                )}

                                {/* Show only old values if new values don't exist */}
                                {log.old_values && !log.new_values && (
                                  <Box>
                                    <Typography variant="caption" color="text.secondary">
                                      {t('auditLogs.oldValues')}
                                    </Typography>
                                    <Paper sx={{ p: 1.5, mt: 0.5, bgcolor: 'background.default' }}>
                                      <pre style={{ margin: 0, fontSize: '0.75rem', overflow: 'auto', fontFamily: 'monospace' }}>
                                        {JSON.stringify(log.old_values, null, 2)}
                                      </pre>
                                    </Paper>
                                  </Box>
                                )}
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

          <SimplePagination
            count={total}
            page={pageState.page - 1} // MUI는 0부터 시작
            rowsPerPage={pageState.limit}
            onPageChange={handlePageChange}
            onRowsPerPageChange={handleRowsPerPageChange}
            rowsPerPageOptions={[5, 10, 25, 50, 100]}
          />
        </Card>
      </Box>
    );
};

export default AuditLogsPage;
