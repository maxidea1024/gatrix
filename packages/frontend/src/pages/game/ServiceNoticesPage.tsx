import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  Tooltip,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Skeleton,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Announcement as AnnouncementIcon,
  Visibility as VisibilityIcon,
  ViewColumn as ViewColumnIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  ContentCopy as ContentCopyIcon,
  Info as InfoIcon,
  SportsEsports as SportsEsportsIcon,
} from '@mui/icons-material';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import serviceNoticeService, { ServiceNotice, ServiceNoticeFilters } from '../../services/serviceNoticeService';
import ServiceNoticeFormDialog from '../../components/game/ServiceNoticeFormDialog';
import SimplePagination from '../../components/common/SimplePagination';
import DynamicFilterBar, { FilterDefinition, ActiveFilter } from '../../components/common/DynamicFilterBar';
import EmptyTableRow from '../../components/common/EmptyTableRow';
import ColumnSettingsDialog, { ColumnConfig } from '../../components/common/ColumnSettingsDialog';
import { formatDateTime } from '../../utils/dateFormat';
import { useDebounce } from '../../hooks/useDebounce';
import { copyToClipboardWithNotification } from '../../utils/clipboard';

const ServiceNoticesPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // State
  const [notices, setNotices] = useState<ServiceNotice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Extract filter values with useMemo for stable references
  const isActiveFilter = useMemo(() => {
    const filter = activeFilters.find(f => f.key === 'isActive');
    return filter?.value as string | undefined;
  }, [activeFilters]);

  const currentlyVisibleFilter = useMemo(() => {
    const filter = activeFilters.find(f => f.key === 'currentlyVisible');
    return filter?.value as string | undefined;
  }, [activeFilters]);

  const categoryFilter = useMemo(() => {
    const filter = activeFilters.find(f => f.key === 'category');
    return filter?.value as string[] | undefined;
  }, [activeFilters]);

  const platformFilter = useMemo(() => {
    const filter = activeFilters.find(f => f.key === 'platform');
    return filter?.value as string[] | undefined;
  }, [activeFilters]);

  const platformOperator = useMemo(() => {
    const filter = activeFilters.find(f => f.key === 'platform');
    return filter?.operator;
  }, [activeFilters]);

  // Convert filters to strings for dependency array
  const isActiveFilterString = useMemo(() => isActiveFilter || '', [isActiveFilter]);
  const currentlyVisibleFilterString = useMemo(() => currentlyVisibleFilter || '', [currentlyVisibleFilter]);
  const categoryFilterString = useMemo(() =>
    Array.isArray(categoryFilter) ? categoryFilter.join(',') : '',
    [categoryFilter]
  );
  const platformFilterString = useMemo(() =>
    Array.isArray(platformFilter) ? platformFilter.join(',') : '',
    [platformFilter]
  );

  // Dialog states
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<ServiceNotice | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingNotice, setDeletingNotice] = useState<ServiceNotice | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

  // Webview menu state
  const [webviewMenuAnchorEl, setWebviewMenuAnchorEl] = useState<null | HTMLElement>(null);

  // Default column configuration - title moved to first position
  const defaultColumns: ColumnConfig[] = [
    { id: 'title', labelKey: 'serviceNotices.noticeTitle', visible: true },
    { id: 'currentlyVisible', labelKey: 'serviceNotices.currentlyVisible', visible: true },
    { id: 'status', labelKey: 'serviceNotices.status', visible: true },
    { id: 'category', labelKey: 'serviceNotices.category', visible: true },
    { id: 'targetAudience', labelKey: 'serviceNotices.targetAudience', visible: true },
    { id: 'period', labelKey: 'serviceNotices.period', visible: true },
    { id: 'createdAt', labelKey: 'common.createdAt', visible: true },
  ];

  // Column settings
  const [columnSettingsAnchor, setColumnSettingsAnchor] = useState<null | HTMLElement>(null);
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('serviceNoticesColumns');
    if (saved) {
      try {
        const savedColumns = JSON.parse(saved);
        // Merge saved columns with defaults, preserving saved order
        const mergedColumns = savedColumns.map((savedCol: ColumnConfig) => {
          const defaultCol = defaultColumns.find(c => c.id === savedCol.id);
          return defaultCol ? { ...defaultCol, ...savedCol } : savedCol;
        });
        // Add any new columns that weren't in saved state
        const savedIds = new Set(savedColumns.map((c: ColumnConfig) => c.id));
        const newColumns = defaultColumns.filter(c => !savedIds.has(c.id));
        return [...mergedColumns, ...newColumns];
      } catch (e) {
        return defaultColumns;
      }
    }
    return defaultColumns;
  });

  // Debounced search
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Filter definitions
  const availableFilterDefinitions: FilterDefinition[] = [
    {
      key: 'isActive',
      label: t('serviceNotices.status'),
      type: 'select',
      options: [
        { value: 'true', label: t('common.active') },
        { value: 'false', label: t('common.inactive') },
      ],
    },
    {
      key: 'currentlyVisible',
      label: t('serviceNotices.currentlyVisible'),
      type: 'select',
      options: [
        { value: 'true', label: t('serviceNotices.visible') },
        { value: 'false', label: t('serviceNotices.notVisible') },
      ],
    },
    {
      key: 'category',
      label: t('serviceNotices.category'),
      type: 'multiselect',
      operator: 'any_of',
      allowOperatorToggle: false,
      options: [
        { value: 'maintenance', label: t('serviceNotices.categories.maintenance') },
        { value: 'event', label: t('serviceNotices.categories.event') },
        { value: 'notice', label: t('serviceNotices.categories.notice') },
        { value: 'promotion', label: t('serviceNotices.categories.promotion') },
        { value: 'other', label: t('serviceNotices.categories.other') },
      ],
    },
    {
      key: 'platform',
      label: t('serviceNotices.platform'),
      type: 'multiselect',
      operator: 'any_of',
      allowOperatorToggle: true,
      options: [
        { value: 'pc', label: 'PC' },
        { value: 'pc-wegame', label: 'PC-WeGame' },
        { value: 'ios', label: 'iOS' },
        { value: 'android', label: 'Android' },
        { value: 'harmonyos', label: 'HarmonyOS' },
      ],
    },
  ];

  // Visible columns
  const visibleColumns = useMemo(() => columns.filter(col => col.visible), [columns]);

  // Load notices
  const loadNotices = async () => {
    setLoading(true);
    try {
      const filters: ServiceNoticeFilters = {
        search: debouncedSearchTerm || undefined,
      };

      // Apply active filters
      if (isActiveFilter !== undefined && isActiveFilter !== '') {
        filters.isActive = isActiveFilter === 'true';
      }
      if (currentlyVisibleFilter !== undefined && currentlyVisibleFilter !== '') {
        filters.currentlyVisible = currentlyVisibleFilter === 'true';
      }
      if (Array.isArray(categoryFilter) && categoryFilter.length > 0) {
        filters.category = categoryFilter[0];
      }
      if (Array.isArray(platformFilter) && platformFilter.length > 0) {
        filters.platform = platformFilter;
        filters.platformOperator = platformOperator;
      }

      const result = await serviceNoticeService.getServiceNotices(page + 1, rowsPerPage, filters);
      
      // Validate response
      if (result && typeof result === 'object') {
        setNotices(result.notices || []);
        setTotal(result.total || 0);
      } else {
        console.error('Invalid response format:', result);
        setNotices([]);
        setTotal(0);
      }
    } catch (error: any) {
      console.error('Failed to load service notices:', error);
      enqueueSnackbar(error.message || t('serviceNotices.loadFailed'), { variant: 'error' });
      setNotices([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  useEffect(() => {
    loadNotices();
  }, [page, rowsPerPage, debouncedSearchTerm, isActiveFilterString, currentlyVisibleFilterString, categoryFilterString, platformFilterString]);

  // Filter handlers
  const handleFilterAdd = (filter: ActiveFilter) => {
    setActiveFilters([...activeFilters, filter]);
    setPage(0);
  };

  const handleFilterRemove = (filterKey: string) => {
    setActiveFilters(activeFilters.filter(f => f.key !== filterKey));
    setPage(0);
  };

  const handleDynamicFilterChange = (filterKey: string, value: any) => {
    const newFilters = activeFilters.map(f =>
      f.key === filterKey ? { ...f, value } : f
    );
    setActiveFilters(newFilters);
    setPage(0);
  };

  const handleOperatorChange = (filterKey: string, operator: 'any_of' | 'include_all') => {
    const newFilters = activeFilters.map(f =>
      f.key === filterKey ? { ...f, operator } : f
    );
    setActiveFilters(newFilters);
  };

  // Column handlers
  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    setColumns(newColumns);
    localStorage.setItem('serviceNoticesColumns', JSON.stringify(newColumns));
  };

  const handleResetColumns = () => {
    setColumns(defaultColumns);
    localStorage.setItem('serviceNoticesColumns', JSON.stringify(defaultColumns));
  };

  // Search handler
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setPage(0);
  };

  // Selection handlers
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(notices.map(n => n.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // CRUD handlers
  const handleCreate = () => {
    setEditingNotice(null);
    setFormDrawerOpen(true);
  };

  const handleEdit = (notice: ServiceNotice) => {
    setEditingNotice(notice);
    setFormDrawerOpen(true);
  };

  const handleDelete = (notice: ServiceNotice) => {
    setDeletingNotice(notice);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingNotice) return;

    try {
      await serviceNoticeService.deleteServiceNotice(deletingNotice.id);
      enqueueSnackbar(t('serviceNotices.deleteSuccess'), { variant: 'success' });
      setDeleteDialogOpen(false);
      setDeletingNotice(null);
      loadNotices();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('serviceNotices.deleteFailed'), { variant: 'error' });
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setBulkDeleteDialogOpen(true);
  };

  const confirmBulkDelete = async () => {
    try {
      await serviceNoticeService.deleteMultipleServiceNotices(selectedIds);
      enqueueSnackbar(t('serviceNotices.bulkDeleteSuccess', { count: selectedIds.length }), { variant: 'success' });
      setBulkDeleteDialogOpen(false);
      setSelectedIds([]);
      loadNotices();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('serviceNotices.bulkDeleteFailed'), { variant: 'error' });
    }
  };

  // Webview menu handlers
  const handleWebviewMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setWebviewMenuAnchorEl(event.currentTarget);
  };

  const handleWebviewMenuClose = () => {
    setWebviewMenuAnchorEl(null);
  };

  const handleOpenWebviewPreview = () => {
    // Open the actual game webview HTML page in a new window (same size as preview dialog)
    window.open('/game-service-notices.html', '_blank', 'width=1536,height=928');
    handleWebviewMenuClose();
  };

  // Copy notice URL to clipboard
  const handleCopyNoticeUrl = async () => {
    const noticeUrl = `${window.location.origin}/game-service-notices.html`;
    copyToClipboardWithNotification(
      noticeUrl,
      () => enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
      () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
    );
    handleWebviewMenuClose();
  };

  const handleToggleActive = async (notice: ServiceNotice) => {
    try {
      await serviceNoticeService.toggleActive(notice.id);
      enqueueSnackbar(t('serviceNotices.toggleSuccess'), { variant: 'success' });
      loadNotices();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('serviceNotices.toggleFailed'), { variant: 'error' });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AnnouncementIcon />
            {t('serviceNotices.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('serviceNotices.subtitle')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<VisibilityIcon />}
            onClick={() => setPreviewDialogOpen(true)}
          >
            {t('serviceNotices.preview')}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreate}
          >
            {t('serviceNotices.createNotice')}
          </Button>
          <Divider orientation="vertical" sx={{ height: 32, mx: 0.5 }} />
          <Tooltip title={t('serviceNotices.webviewMenuTooltip')}>
            <IconButton
              size="small"
              onClick={handleWebviewMenuOpen}
              sx={{ p: 1 }}
            >
              <SportsEsportsIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Search and Filters Card */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'nowrap', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'nowrap', flexGrow: 1, minWidth: 0 }}>
              <TextField
                placeholder={t('serviceNotices.searchPlaceholder')}
                value={searchTerm}
                onChange={handleSearchChange}
                sx={{
                  minWidth: 300,
                  flexGrow: 1,
                  maxWidth: 500,
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
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
                size="small"
              />

              {/* Dynamic Filter Bar with Column Settings and Refresh Button */}
              <DynamicFilterBar
                availableFilters={availableFilterDefinitions}
                activeFilters={activeFilters}
                onFilterAdd={handleFilterAdd}
                onFilterRemove={handleFilterRemove}
                onFilterChange={handleDynamicFilterChange}
                onOperatorChange={handleOperatorChange}
                onRefresh={loadNotices}
                refreshDisabled={loading}
                noWrap={true}
                afterFilterAddActions={
                  <Tooltip title={t('users.columnSettings')}>
                    <IconButton
                      onClick={(e) => setColumnSettingsAnchor(e.currentTarget)}
                      sx={{
                        bgcolor: 'background.paper',
                        border: 1,
                        borderColor: 'divider',
                        '&:hover': {
                          bgcolor: 'action.hover',
                        },
                      }}
                    >
                      <ViewColumnIcon />
                    </IconButton>
                  </Tooltip>
                }
              />
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {t('common.selectedCount', { count: selectedIds.length })}
          </Typography>
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<DeleteIcon />}
            onClick={handleBulkDelete}
          >
            {t('common.deleteSelected')}
          </Button>
        </Box>
      )}

      {/* Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={notices.length > 0 && selectedIds.length === notices.length}
                      indeterminate={selectedIds.length > 0 && selectedIds.length < notices.length}
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  {visibleColumns.map((column) => (
                    <TableCell key={column.id}>{t(column.labelKey)}</TableCell>
                  ))}
                  <TableCell align="center">{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isInitialLoad && loading ? (
                  // Skeleton loading (only on initial load)
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      <TableCell padding="checkbox">
                        <Skeleton variant="rectangular" width={24} height={24} />
                      </TableCell>
                      {visibleColumns.map((column) => (
                        <TableCell key={column.id}>
                          <Skeleton variant="text" width="80%" />
                        </TableCell>
                      ))}
                      <TableCell align="center">
                        <Skeleton variant="circular" width={32} height={32} sx={{ display: 'inline-block', mr: 0.5 }} />
                        <Skeleton variant="circular" width={32} height={32} sx={{ display: 'inline-block', mr: 0.5 }} />
                        <Skeleton variant="circular" width={32} height={32} sx={{ display: 'inline-block' }} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : notices.length === 0 ? (
                  <EmptyTableRow
                    colSpan={visibleColumns.length + 2}
                    loading={loading}
                    message={t('serviceNotices.noNoticesFound')}
                  />
                ) : (
                  notices.map((notice) => (
                    <TableRow key={notice.id} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedIds.includes(notice.id)}
                          onChange={() => handleSelectOne(notice.id)}
                        />
                      </TableCell>
                      {visibleColumns.map((column) => {
                        if (column.id === 'status') {
                          return (
                            <TableCell key={column.id}>
                              <Chip
                                label={notice.isActive ? t('common.active') : t('common.inactive')}
                                color={notice.isActive ? 'success' : 'default'}
                                size="small"
                                onClick={() => handleToggleActive(notice)}
                                sx={{ cursor: 'pointer' }}
                              />
                            </TableCell>
                          );
                        }
                        if (column.id === 'currentlyVisible') {
                          // Check if notice is currently visible (isActive + within date range)
                          // startDate is optional - if null, treat as immediately available
                          // endDate is optional - if null, treat as permanent (no end date)
                          const now = new Date();
                          const startDate = notice.startDate ? new Date(notice.startDate) : null;
                          const endDate = notice.endDate ? new Date(notice.endDate) : null;
                          const isCurrentlyVisible = notice.isActive && (!startDate || now >= startDate) && (!endDate || now <= endDate);

                          // Create tooltip message
                          const tooltipMessage = isCurrentlyVisible
                            ? t('serviceNotices.currentlyVisibleTooltip', {
                                time: formatDateTime(now),
                                start: formatDateTime(startDate),
                                end: formatDateTime(endDate)
                              })
                            : t('serviceNotices.notVisibleTooltip', {
                                time: formatDateTime(now),
                                start: formatDateTime(startDate),
                                end: formatDateTime(endDate),
                                isActive: notice.isActive
                              });

                          return (
                            <TableCell key={column.id}>
                              <Tooltip title={tooltipMessage} arrow>
                                <Chip
                                  label={isCurrentlyVisible ? t('serviceNotices.visible') : t('serviceNotices.notVisible')}
                                  color={isCurrentlyVisible ? 'primary' : 'default'}
                                  size="small"
                                  variant={isCurrentlyVisible ? 'filled' : 'outlined'}
                                />
                              </Tooltip>
                            </TableCell>
                          );
                        }
                        if (column.id === 'category') {
                          return (
                            <TableCell key={column.id}>
                              <Chip
                                label={t(`serviceNotices.categories.${notice.category}`)}
                                size="small"
                                variant="outlined"
                              />
                            </TableCell>
                          );
                        }
                        if (column.id === 'title') {
                          return (
                            <TableCell key={column.id}>
                              <Box>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    '&:hover': {
                                      textDecoration: 'underline',
                                    }
                                  }}
                                  onClick={() => handleEdit(notice)}
                                >
                                  {notice.tabTitle || notice.title}
                                </Typography>
                                {notice.tabTitle && (
                                  <Typography variant="caption" color="text.secondary">
                                    {notice.title}
                                  </Typography>
                                )}
                              </Box>
                            </TableCell>
                          );
                        }
                        if (column.id === 'targetAudience') {
                          const hasChannels = notice.channels && notice.channels.length > 0;
                          const platformsText = notice.platforms.length === 0
                            ? t('common.all')
                            : notice.platforms.join(', ');
                          const channelsText = hasChannels
                            ? notice.channels.join(', ')
                            : null;

                          return (
                            <TableCell key={column.id}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                    {platformsText}
                                  </Typography>
                                  {channelsText && (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                      {channelsText}
                                    </Typography>
                                  )}
                                </Box>
                                {(hasChannels || notice.platforms.length > 2) && (
                                  <Tooltip title={
                                    <Box>
                                      <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                                        <strong>{t('serviceNotices.platforms')}:</strong> {platformsText}
                                      </Typography>
                                      {channelsText && (
                                        <Typography variant="caption" sx={{ display: 'block' }}>
                                          <strong>{t('serviceNotices.channels')}:</strong> {channelsText}
                                        </Typography>
                                      )}
                                    </Box>
                                  }>
                                    <InfoIcon sx={{ fontSize: '1rem', cursor: 'pointer', color: 'action.active' }} />
                                  </Tooltip>
                                )}
                              </Box>
                            </TableCell>
                          );
                        }
                        if (column.id === 'period') {
                          return (
                            <TableCell key={column.id}>
                              <Typography variant="caption" display="block">
                                {notice.startDate ? formatDateTime(notice.startDate) : t('serviceNotices.startImmediately')}
                              </Typography>
                              <Typography variant="caption" display="block" color="text.secondary">
                                ~ {notice.endDate ? formatDateTime(notice.endDate) : t('serviceNotices.permanent')}
                              </Typography>
                            </TableCell>
                          );
                        }
                        if (column.id === 'createdAt') {
                          return (
                            <TableCell key={column.id}>
                              <Typography variant="caption">
                                {formatDateTime(notice.createdAt)}
                              </Typography>
                            </TableCell>
                          );
                        }
                        return null;
                      })}
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                          <Tooltip title={t('common.edit')}>
                            <IconButton
                              size="small"
                              onClick={() => handleEdit(notice)}
                              color="primary"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={t('common.delete')}>
                            <IconButton
                              size="small"
                              onClick={() => handleDelete(notice)}
                              color="error"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          {!loading && notices.length > 0 && (
            <SimplePagination
              page={page}
              rowsPerPage={rowsPerPage}
              count={total}
              onPageChange={(event, newPage) => setPage(newPage)}
              onRowsPerPageChange={(event) => {
                setRowsPerPage(Number(event.target.value));
                setPage(0);
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Form Drawer */}
      <ServiceNoticeFormDialog
        open={formDrawerOpen}
        onClose={() => setFormDrawerOpen(false)}
        onSuccess={loadNotices}
        notice={editingNotice}
      />

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('common.confirmDelete')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('serviceNotices.confirmDelete', { title: deletingNotice?.title })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={bulkDeleteDialogOpen} onClose={() => setBulkDeleteDialogOpen(false)}>
        <DialogTitle>{t('common.confirmDelete')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('serviceNotices.confirmBulkDelete', { count: selectedIds.length })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={confirmBulkDelete} color="error" variant="contained">
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>



      {/* Column Settings Dialog */}
      <ColumnSettingsDialog
        anchorEl={columnSettingsAnchor}
        onClose={() => setColumnSettingsAnchor(null)}
        columns={columns}
        onColumnsChange={handleColumnsChange}
        onReset={handleResetColumns}
      />

      {/* Preview Dialog */}
      <Dialog
        open={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        maxWidth={false}
        PaperProps={{
          sx: {
            width: 1536,
            height: 928,
            maxWidth: '95vw',
            maxHeight: '95vh',
          },
        }}
      >
        <DialogTitle
          sx={(theme) => ({
            display: 'flex',
            flexDirection: 'column',
            pb: 1,
            bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100',
            borderBottom: 1,
            borderColor: 'divider',
          })}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
            <Typography variant="h6">{t('serviceNotices.preview')}</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton
                color="primary"
                onClick={() => {
                  const iframe = document.querySelector('iframe[src="/service-notices-preview"]') as HTMLIFrameElement;
                  if (iframe) {
                    iframe.src = iframe.src;
                  }
                }}
                aria-label="refresh"
                size="small"
              >
                <RefreshIcon />
              </IconButton>
              <IconButton
                edge="end"
                color="inherit"
                onClick={() => setPreviewDialogOpen(false)}
                aria-label="close"
                size="small"
              >
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            {t('serviceNotices.previewPage.subtitle')}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 0, overflow: 'hidden', display: 'flex' }}>
          <Box
            component="iframe"
            src="/service-notices-preview"
            sx={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block',
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Webview Context Menu */}
      <Menu
        anchorEl={webviewMenuAnchorEl}
        open={Boolean(webviewMenuAnchorEl)}
        onClose={handleWebviewMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={handleOpenWebviewPreview}>
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('serviceNotices.webviewPreview')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleCopyNoticeUrl}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('serviceNotices.copyWebviewUrl')}</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default ServiceNoticesPage;

