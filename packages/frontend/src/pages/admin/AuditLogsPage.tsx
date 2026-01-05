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
  Popover,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ClickAwayListener,
  Checkbox,
  Button,
} from '@mui/material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  Refresh as RefreshIcon,
  Info as InfoIcon,
  ContentCopy as ContentCopyIcon,
  History as HistoryIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowRight as KeyboardArrowRightIcon,
  ViewColumn as ViewColumnIcon,
  DragIndicator as DragIndicatorIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { copyToClipboardWithNotification } from '@/utils/clipboard';
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

// Column definition interface
interface ColumnConfig {
  id: string;
  labelKey: string;
  visible: boolean;
}

// Sortable list item component for drag and drop
interface SortableColumnItemProps {
  column: ColumnConfig;
  onToggleVisibility: (id: string) => void;
}

const SortableColumnItem: React.FC<SortableColumnItemProps> = ({ column, onToggleVisibility }) => {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <ListItem
      ref={setNodeRef}
      style={style}
      disablePadding
      secondaryAction={
        <Box {...attributes} {...listeners} sx={{ cursor: 'grab', display: 'flex', alignItems: 'center', '&:active': { cursor: 'grabbing' } }}>
          <DragIndicatorIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
        </Box>
      }
    >
      <ListItemButton
        dense
        onClick={() => onToggleVisibility(column.id)}
        sx={{ pr: 6 }}
      >
        <Checkbox
          edge="start"
          checked={column.visible}
          tabIndex={-1}
          disableRipple
          size="small"
          icon={<VisibilityOffIcon fontSize="small" />}
          checkedIcon={<VisibilityIcon fontSize="small" />}
        />
        <ListItemText
          primary={t(column.labelKey)}
          slotProps={{ primary: { variant: 'body2' } }}
        />
      </ListItemButton>
    </ListItem>
  );
};

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

  // Column configuration
  const defaultColumns: ColumnConfig[] = [
    { id: 'createdAt', labelKey: 'auditLogs.createdAt', visible: true },
    { id: 'user', labelKey: 'auditLogs.user', visible: true },
    { id: 'action', labelKey: 'auditLogs.action', visible: true },
    { id: 'resource', labelKey: 'auditLogs.resource', visible: true },
    { id: 'resourceId', labelKey: 'auditLogs.resourceId', visible: true },
    { id: 'ipAddress', labelKey: 'auditLogs.ipAddress', visible: true },
  ];

  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('auditLogsColumns');
    if (saved) {
      try {
        const savedColumns = JSON.parse(saved);
        const mergedColumns = savedColumns.map((savedCol: ColumnConfig) => {
          const defaultCol = defaultColumns.find(c => c.id === savedCol.id);
          return defaultCol ? { ...defaultCol, ...savedCol } : savedCol;
        });
        const savedIds = new Set(savedColumns.map((c: ColumnConfig) => c.id));
        const newColumns = defaultColumns.filter(c => !savedIds.has(c.id));
        return [...mergedColumns, ...newColumns];
      } catch (e) {
        return defaultColumns;
      }
    }
    return defaultColumns;
  });

  const [columnSettingsAnchor, setColumnSettingsAnchor] = useState<HTMLButtonElement | null>(null);

  const columnSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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

  // Column handlers
  const handleToggleColumnVisibility = (columnId: string) => {
    const newColumns = columns.map(col =>
      col.id === columnId ? { ...col, visible: !col.visible } : col
    );
    setColumns(newColumns);
    localStorage.setItem('auditLogsColumns', JSON.stringify(newColumns));
  };

  const handleResetColumns = () => {
    setColumns(defaultColumns);
    localStorage.setItem('auditLogsColumns', JSON.stringify(defaultColumns));
  };

  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = columns.findIndex((col) => col.id === active.id);
      const newIndex = columns.findIndex((col) => col.id === over.id);
      const newColumns = arrayMove(columns, oldIndex, newIndex);
      setColumns(newColumns);
      localStorage.setItem('auditLogsColumns', JSON.stringify(newColumns));
    }
  };

  const renderCellContent = (log: AuditLog, columnId: string) => {
    switch (columnId) {
      case 'createdAt':
        return <Typography variant="body2">{formatDateTimeDetailed((log as any).createdAt || log.created_at)}</Typography>;
      case 'user':
        return log.user_name ? (
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>{log.user_name}</Typography>
            <Typography variant="caption" color="text.secondary">{log.user_email}</Typography>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">{t('auditLogs.system')}</Typography>
        );
      case 'action':
        return <Chip label={t(`auditLogs.actions.${log.action}`)} color={AuditLogService.getActionColor(log.action)} size="small" />;
      case 'resource':
        const resourceType = (log as any).resourceType || (log as any).resource_type || (log as any).entityType;
        return resourceType ? (
          <Box>
            <Typography variant="body2" fontWeight="medium">
              {t(`auditLogs.resources.${resourceType}`, resourceType)}
            </Typography>
            {(() => {
              const oldVals = (log as any).oldValues || (log as any).old_values;
              const newVals = (log as any).newValues || (log as any).new_values;
              const resourceName = oldVals?.name || newVals?.name || oldVals?.worldId || newVals?.worldId;
              return resourceName ? (
                <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500 }}>
                  {resourceName}
                </Typography>
              ) : null;
            })()}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">-</Typography>
        );
      case 'resourceId':
        const resourceId = (log as any).resourceId || (log as any).resource_id || (log as any).entityId;
        return resourceId ? (
          <Typography variant="caption" color="text.secondary">ID: {resourceId}</Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">-</Typography>
        );
      case 'ipAddress':
        return <Typography variant="body2" fontFamily="monospace">{log.ip_address || '-'}</Typography>;
      default:
        return null;
    }
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
    let text = '';
    if (!details) {
      text = 'No details available';
    } else if (typeof details === 'string') {
      text = details;
    } else {
      text = JSON.stringify(details, null, 2);
    }

    copyToClipboardWithNotification(
      text,
      () => enqueueSnackbar(t('auditLogs.detailsCopied'), { variant: 'success' }),
      () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
    );
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

            {/* Column Settings Button */}
            <Tooltip title={t('users.columnSettings')}>
              <IconButton
                onClick={(e) => setColumnSettingsAnchor(e.currentTarget)}
                sx={{
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <ViewColumnIcon />
              </IconButton>
            </Tooltip>
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
          <Table sx={{ tableLayout: 'auto' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 50 }}></TableCell>
                {columns.filter(col => col.visible).map((column) => (
                  <TableCell key={column.id}>
                    {t(column.labelKey)}
                  </TableCell>
                ))}
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
                    {columns.filter(col => col.visible).map((column) => (
                      <TableCell key={column.id}>
                        <Skeleton variant="text" width="80%" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : auditLogs.length === 0 ? (
                <EmptyTableRow
                  colSpan={columns.filter(col => col.visible).length + 1}
                  loading={false}
                  message={t('auditLogs.noLogsFound')}
                  loadingMessage={t('common.loadingAuditLogs')}
                />
              ) : (
                auditLogs.map((log, index) => (
                  <React.Fragment key={log.id}>
                    <TableRow
                      hover
                      sx={{
                        cursor: 'pointer',
                        bgcolor: (theme) =>
                          index % 2 === 0
                            ? 'transparent'
                            : theme.palette.mode === 'dark'
                              ? 'rgba(255, 255, 255, 0.02)'
                              : 'rgba(0, 0, 0, 0.02)',
                        '& > *': { borderBottom: expandedRowId === log.id ? 'none' : undefined }
                      }}
                      onClick={() => setExpandedRowId(expandedRowId === log.id ? null : log.id)}
                    >
                      <TableCell>
                        <IconButton size="small">
                          {expandedRowId === log.id ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
                        </IconButton>
                      </TableCell>
                      {columns.filter(col => col.visible).map((column) => (
                        <TableCell key={column.id}>
                          {renderCellContent(log, column.id)}
                        </TableCell>
                      ))}
                    </TableRow>

                    {/* Expanded Detail Row */}
                    <TableRow>
                      <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={columns.filter(col => col.visible).length + 1}>
                        <Collapse in={expandedRowId === log.id} timeout="auto" unmountOnExit>
                          <Box sx={{
                            py: 3,
                            px: 4,
                            bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                            borderTop: 1,
                            borderBottom: 1,
                            borderColor: 'divider',
                          }}>
                            {/* Header with Action Badge */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, pl: 3 }}>
                              <Chip
                                label={t(`auditLogs.actions.${log.action}`)}
                                color={AuditLogService.getActionColor(log.action)}
                                sx={{ fontWeight: 600, fontSize: '0.875rem' }}
                              />
                              {((log as any).resourceType || (log as any).resource_type || (log as any).entityType) && (
                                <Chip
                                  label={t(`auditLogs.resources.${(log as any).resourceType || (log as any).resource_type || (log as any).entityType}`, (log as any).resourceType || (log as any).resource_type || (log as any).entityType)}
                                  variant="outlined"
                                  size="small"
                                />
                              )}
                            </Box>

                            {/* Detail Fields in OpenSearch Discovery Style */}
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pl: 3 }}>
                              {/* Timestamp */}
                              <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                  {t('auditLogs.date')}
                                </Typography>
                                <Typography variant="body1" sx={{ mt: 0.5, fontFamily: 'monospace' }}>
                                  {formatDateTimeDetailed((log as any).createdAt || log.created_at)}
                                </Typography>
                              </Box>

                              <Divider />

                              {/* User Information */}
                              <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                  {t('auditLogs.user')}
                                </Typography>
                                <Box sx={{ mt: 0.5 }}>
                                  {log.user_name ? (
                                    <>
                                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                        {log.user_name}
                                      </Typography>
                                      <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                        {log.user_email}
                                      </Typography>
                                    </>
                                  ) : (
                                    <Typography variant="body1" color="text.secondary">
                                      {t('auditLogs.system')}
                                    </Typography>
                                  )}
                                </Box>
                              </Box>

                              <Divider />

                              {/* Resource Information */}
                              {((log as any).resourceId || (log as any).resource_id || (log as any).entityId) && (
                                <>
                                  <Box>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                      {t('auditLogs.resource')}
                                    </Typography>
                                    <Box sx={{ mt: 0.5 }}>
                                      {(() => {
                                        const oldVals = (log as any).oldValues || (log as any).old_values;
                                        const newVals = (log as any).newValues || (log as any).new_values;
                                        const resourceName = oldVals?.name || newVals?.name || oldVals?.worldId || newVals?.worldId;
                                        const resourceType = (log as any).resourceType || (log as any).resource_type || (log as any).entityType;
                                        const resourceId = (log as any).resourceId || (log as any).resource_id || (log as any).entityId;

                                        return (
                                          <>
                                            {resourceName && (
                                              <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                                                {resourceName}
                                              </Typography>
                                            )}
                                            <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                                              {resourceType} #{resourceId}
                                            </Typography>
                                          </>
                                        );
                                      })()}
                                    </Box>
                                  </Box>
                                  <Divider />
                                </>
                              )}

                              {/* IP Address */}
                              <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                  {t('auditLogs.ipAddress')}
                                </Typography>
                                <Typography variant="body1" sx={{ mt: 0.5, fontFamily: 'monospace' }}>
                                  {log.ip_address || log.ipAddress || '-'}
                                </Typography>
                              </Box>

                              {/* User Agent */}
                              {(log.user_agent || log.userAgent) && (
                                <>
                                  <Divider />
                                  <Box>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                      {t('auditLogs.userAgent')}
                                    </Typography>
                                    <Typography variant="body2" sx={{ mt: 0.5, wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.75rem', color: 'text.secondary' }}>
                                      {log.user_agent || log.userAgent}
                                    </Typography>
                                  </Box>
                                </>
                              )}

                              {/* Changes - Diff Viewer */}
                              {(() => {
                                const oldVals = (log as any).oldValues || (log as any).old_values;
                                const newVals = (log as any).newValues || (log as any).new_values;
                                return oldVals && newVals && (
                                  <>
                                    <Divider />
                                    <Box>
                                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        {t('auditLogs.changes')}
                                      </Typography>
                                      <Paper
                                        elevation={0}
                                        sx={{
                                          bgcolor: 'background.default',
                                          overflow: 'hidden',
                                          border: 1,
                                          borderColor: 'divider',
                                          borderRadius: 1,
                                        }}
                                      >
                                        <Table size="small">
                                          <TableHead>
                                            <TableRow sx={{ bgcolor: 'action.hover' }}>
                                              <TableCell sx={{ fontWeight: 600, width: '25%' }}>{t('changeRequest.field')}</TableCell>
                                              <TableCell sx={{ fontWeight: 600, width: '37.5%' }}>{t('changeRequest.oldValue')}</TableCell>
                                              <TableCell sx={{ fontWeight: 600, width: '37.5%' }}>{t('changeRequest.newValue')}</TableCell>
                                            </TableRow>
                                          </TableHead>
                                          <TableBody>
                                            {(() => {
                                              const allKeys = new Set([...Object.keys(oldVals || {}), ...Object.keys(newVals || {})]);
                                              const changedFields: { key: string; oldVal: any; newVal: any }[] = [];
                                              allKeys.forEach(key => {
                                                const oldVal = oldVals?.[key];
                                                const newVal = newVals?.[key];
                                                if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                                                  changedFields.push({ key, oldVal, newVal });
                                                }
                                              });
                                              if (changedFields.length === 0) {
                                                return (
                                                  <TableRow>
                                                    <TableCell colSpan={3} align="center" sx={{ color: 'text.secondary', py: 2 }}>
                                                      {t('changeRequest.noChanges')}
                                                    </TableCell>
                                                  </TableRow>
                                                );
                                              }
                                              return changedFields.map(({ key, oldVal, newVal }) => (
                                                <TableRow key={key} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                                                  <TableCell sx={{ fontWeight: 500, fontFamily: 'monospace', fontSize: '0.75rem' }}>{key}</TableCell>
                                                  <TableCell sx={{
                                                    fontFamily: 'monospace',
                                                    fontSize: '0.75rem',
                                                    bgcolor: alpha(theme.palette.error.main, 0.08),
                                                    color: 'text.secondary',
                                                    wordBreak: 'break-all',
                                                  }}>
                                                    {oldVal !== undefined ? (typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal)) : '-'}
                                                  </TableCell>
                                                  <TableCell sx={{
                                                    fontFamily: 'monospace',
                                                    fontSize: '0.75rem',
                                                    bgcolor: alpha(theme.palette.success.main, 0.08),
                                                    wordBreak: 'break-all',
                                                  }}>
                                                    {newVal !== undefined ? (typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal)) : '-'}
                                                  </TableCell>
                                                </TableRow>
                                              ));
                                            })()}
                                          </TableBody>
                                        </Table>
                                      </Paper>
                                    </Box>
                                  </>
                                );
                              })()}

                              {/* Show only new values if old values don't exist */}
                              {(() => {
                                const oldVals = (log as any).oldValues || (log as any).old_values;
                                const newVals = (log as any).newValues || (log as any).new_values;
                                return !oldVals && newVals && (
                                  <>
                                    <Divider />
                                    <Box>
                                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        {t('auditLogs.newValues')}
                                      </Typography>
                                      <Paper
                                        elevation={0}
                                        sx={{
                                          p: 2,
                                          bgcolor: 'background.default',
                                          border: 1,
                                          borderColor: 'divider',
                                          borderRadius: 1,
                                          overflow: 'auto',
                                          maxHeight: 400,
                                        }}
                                      >
                                        <pre style={{
                                          margin: 0,
                                          fontSize: '0.75rem',
                                          fontFamily: 'monospace',
                                          color: theme.palette.text.primary,
                                        }}>
                                          {JSON.stringify(newVals, null, 2)}
                                        </pre>
                                      </Paper>
                                    </Box>
                                  </>
                                );
                              })()}

                              {/* Show only old values if new values don't exist */}
                              {(() => {
                                const oldVals = (log as any).oldValues || (log as any).old_values;
                                const newVals = (log as any).newValues || (log as any).new_values;
                                return oldVals && !newVals && (
                                  <>
                                    <Divider />
                                    <Box>
                                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        {t('auditLogs.oldValues')}
                                      </Typography>
                                      <Paper
                                        elevation={0}
                                        sx={{
                                          p: 2,
                                          bgcolor: 'background.default',
                                          border: 1,
                                          borderColor: 'divider',
                                          borderRadius: 1,
                                          overflow: 'auto',
                                          maxHeight: 400,
                                        }}
                                      >
                                        <pre style={{
                                          margin: 0,
                                          fontSize: '0.75rem',
                                          fontFamily: 'monospace',
                                          color: theme.palette.text.primary,
                                        }}>
                                          {JSON.stringify(oldVals, null, 2)}
                                        </pre>
                                      </Paper>
                                    </Box>
                                  </>
                                );
                              })()}
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

      {/* Column Settings Popover */}
      <Popover
        open={Boolean(columnSettingsAnchor)}
        anchorEl={columnSettingsAnchor}
        onClose={() => setColumnSettingsAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        hideBackdrop
        disableScrollLock
      >
        <ClickAwayListener onClickAway={() => setColumnSettingsAnchor(null)}>
          <Box sx={{ p: 2, minWidth: 280, maxWidth: 320 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {t('users.columnSettings')}
              </Typography>
              <Button size="small" onClick={handleResetColumns} color="warning">
                {t('common.reset')}
              </Button>
            </Box>
            <DndContext
              sensors={columnSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleColumnDragEnd}
              modifiers={[restrictToVerticalAxis]}
            >
              <SortableContext
                items={columns.map(col => col.id)}
                strategy={verticalListSortingStrategy}
              >
                <List dense disablePadding>
                  {columns.map((column) => (
                    <SortableColumnItem
                      key={column.id}
                      column={column}
                      onToggleVisibility={handleToggleColumnVisibility}
                    />
                  ))}
                </List>
              </SortableContext>
            </DndContext>
          </Box>
        </ClickAwayListener>
      </Popover>
    </Box>
  );
};

export default AuditLogsPage;
