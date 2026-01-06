import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/types/permissions';
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
  Notifications as NotificationsIcon,
  ViewColumn as ViewColumnIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { usePlatformConfig } from '../../contexts/PlatformConfigContext';
import ingamePopupNoticeService, { IngamePopupNotice, IngamePopupNoticeFilters } from '../../services/ingamePopupNoticeService';
import IngamePopupNoticeFormDialog from '../../components/game/IngamePopupNoticeFormDialog';
import IngamePopupNoticeGuideDrawer from '../../components/game/IngamePopupNoticeGuideDrawer';

import SimplePagination from '../../components/common/SimplePagination';
import DynamicFilterBar, { FilterDefinition, ActiveFilter } from '../../components/common/DynamicFilterBar';
import EmptyTableRow from '../../components/common/EmptyTableRow';
import ColumnSettingsDialog, { ColumnConfig } from '../../components/common/ColumnSettingsDialog';
import { formatDateTime, formatRelativeTime, formatDateTimeDetailed } from '../../utils/dateFormat';
import { useI18n } from '../../contexts/I18nContext';
import { useDebounce } from '../../hooks/useDebounce';
import dayjs from 'dayjs';

const IngamePopupNoticesPage: React.FC = () => {
  const { t } = useTranslation();
  const { language } = useI18n();
  const { enqueueSnackbar } = useSnackbar();
  const { platforms } = usePlatformConfig();
  const { hasPermission } = useAuth();
  const canManage = hasPermission([PERMISSIONS.INGAME_POPUP_NOTICES_MANAGE]);

  // State
  const [notices, setNotices] = useState<IngamePopupNotice[]>([]);
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
  const platformFilterString = useMemo(() =>
    Array.isArray(platformFilter) ? platformFilter.join(',') : '',
    [platformFilter]
  );

  // Dialog states
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<IngamePopupNotice | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingNotice, setDeletingNotice] = useState<IngamePopupNotice | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [guideDrawerOpen, setGuideDrawerOpen] = useState(false);

  // Default column configuration
  const defaultColumns: ColumnConfig[] = [
    { id: 'content', labelKey: 'ingamePopupNotices.content', visible: true },
    { id: 'currentlyVisible', labelKey: 'ingamePopupNotices.currentlyVisible', visible: true },
    { id: 'status', labelKey: 'ingamePopupNotices.status', visible: true },
    { id: 'priority', labelKey: 'ingamePopupNotices.priority', visible: true },
    { id: 'targeting', labelKey: 'ingamePopupNotices.targetingInfo', visible: true },
    { id: 'period', labelKey: 'ingamePopupNotices.period', visible: true },
    { id: 'createdAt', labelKey: 'common.createdAt', visible: true },
  ];

  // Column settings
  const [columnSettingsAnchor, setColumnSettingsAnchor] = useState<null | HTMLElement>(null);
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('ingamePopupNoticesColumns');
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
      label: t('ingamePopupNotices.status'),
      type: 'select',
      options: [
        { value: 'true', label: t('common.active') },
        { value: 'false', label: t('common.inactive') },
      ],
    },
    {
      key: 'currentlyVisible',
      label: t('ingamePopupNotices.currentlyVisible'),
      type: 'select',
      options: [
        { value: 'true', label: t('ingamePopupNotices.visible') },
        { value: 'false', label: t('ingamePopupNotices.notVisible') },
      ],
    },
    {
      key: 'platform',
      label: t('ingamePopupNotices.targetPlatforms'),
      type: 'multiselect',
      operator: 'any_of',
      allowOperatorToggle: true,
      options: platforms.map(platform => ({
        value: platform.value,
        label: platform.label,
      })),
    },
  ];

  // Visible columns
  const visibleColumns = useMemo(() => columns.filter(col => col.visible), [columns]);

  // Load notices
  const loadNotices = async () => {
    setLoading(true);
    try {
      const filters: IngamePopupNoticeFilters = {};

      // Apply search filter
      if (debouncedSearchTerm) {
        filters.search = debouncedSearchTerm;
      }

      // Apply active filters
      if (isActiveFilter !== undefined && isActiveFilter !== '') {
        filters.isActive = isActiveFilter === 'true';
      }
      if (currentlyVisibleFilter !== undefined && currentlyVisibleFilter !== '') {
        filters.currentlyVisible = currentlyVisibleFilter === 'true';
      }
      if (Array.isArray(platformFilter) && platformFilter.length > 0) {
        filters.platform = platformFilter;
        filters.platformOperator = platformOperator;
      }

      const result = await ingamePopupNoticeService.getIngamePopupNotices(page + 1, rowsPerPage, filters);

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
      console.error('Failed to load ingame popup notices:', error);
      enqueueSnackbar(error.message || t('ingamePopupNotices.loadFailed'), { variant: 'error' });
      setNotices([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  useEffect(() => {
    loadNotices();
  }, [page, rowsPerPage, debouncedSearchTerm, isActiveFilterString, currentlyVisibleFilterString, platformFilterString]);

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
    localStorage.setItem('ingamePopupNoticesColumns', JSON.stringify(newColumns));
  };

  const handleResetColumns = () => {
    setColumns(defaultColumns);
    localStorage.setItem('ingamePopupNoticesColumns', JSON.stringify(defaultColumns));
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

  const handleEdit = (notice: IngamePopupNotice) => {
    setEditingNotice(notice);
    setFormDrawerOpen(true);
  };

  const handleDelete = (notice: IngamePopupNotice) => {
    setDeletingNotice(notice);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingNotice) return;

    try {
      await ingamePopupNoticeService.deleteIngamePopupNotice(deletingNotice.id);
      enqueueSnackbar(t('ingamePopupNotices.deleteSuccess'), { variant: 'success' });
      setDeleteDialogOpen(false);
      setDeletingNotice(null);
      loadNotices();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('ingamePopupNotices.deleteFailed'), { variant: 'error' });
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setBulkDeleteDialogOpen(true);
  };

  const confirmBulkDelete = async () => {
    try {
      await ingamePopupNoticeService.deleteMultipleIngamePopupNotices(selectedIds);
      enqueueSnackbar(t('ingamePopupNotices.bulkDeleteSuccess', { count: selectedIds.length }), { variant: 'success' });
      setBulkDeleteDialogOpen(false);
      setSelectedIds([]);
      loadNotices();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('ingamePopupNotices.bulkDeleteFailed'), { variant: 'error' });
    }
  };

  const handleToggleActive = async (notice: IngamePopupNotice) => {
    try {
      await ingamePopupNoticeService.toggleActive(notice.id);
      enqueueSnackbar(t('ingamePopupNotices.toggleSuccess'), { variant: 'success' });
      loadNotices();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('ingamePopupNotices.toggleFailed'), { variant: 'error' });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NotificationsIcon />
            {t('ingamePopupNotices.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('ingamePopupNotices.subtitle')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {canManage && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreate}
            >
              {t('ingamePopupNotices.createNotice')}
            </Button>
          )}
          <Divider orientation="vertical" flexItem sx={{ my: 1 }} />
          <Button
            variant="outlined"
            startIcon={<CodeIcon />}
            onClick={() => setGuideDrawerOpen(true)}
          >
            {t('ingamePopupNotices.sdkGuide')}
          </Button>
        </Box>
      </Box>

      {/* Search and Filters Card */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'nowrap', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'nowrap', flexGrow: 1, minWidth: 0 }}>
              <TextField
                placeholder={t('ingamePopupNotices.searchPlaceholder')}
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
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {canManage && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={notices.length > 0 && selectedIds.length === notices.length}
                        indeterminate={selectedIds.length > 0 && selectedIds.length < notices.length}
                        onChange={handleSelectAll}
                      />
                    </TableCell>
                  )}
                  {visibleColumns.map((column) => (
                    <TableCell key={column.id}>{t(column.labelKey)}</TableCell>
                  ))}
                  {canManage && <TableCell align="center">{t('common.actions')}</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {isInitialLoad && loading ? (
                  // Skeleton loading (only on initial load)
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      {canManage && (
                        <TableCell padding="checkbox">
                          <Skeleton variant="rectangular" width={24} height={24} />
                        </TableCell>
                      )}
                      {visibleColumns.map((column) => (
                        <TableCell key={column.id}>
                          <Skeleton variant="text" width="80%" />
                        </TableCell>
                      ))}
                      {canManage && (
                        <TableCell align="center">
                          <Skeleton variant="circular" width={32} height={32} sx={{ display: 'inline-block', mr: 0.5 }} />
                          <Skeleton variant="circular" width={32} height={32} sx={{ display: 'inline-block', mr: 0.5 }} />
                          <Skeleton variant="circular" width={32} height={32} sx={{ display: 'inline-block' }} />
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : notices.length === 0 ? (
                  <EmptyTableRow
                    colSpan={visibleColumns.length + (canManage ? 2 : 0)}
                    loading={loading}
                    message={t('ingamePopupNotices.noNoticesFound')}
                    subtitle={canManage ? t('common.addFirstItem') : undefined}
                    onAddClick={canManage ? handleCreate : undefined}
                    addButtonLabel={t('ingamePopupNotices.createNotice')}
                  />
                ) : (
                  notices.map((notice) => (
                    <TableRow key={notice.id} hover>
                      {canManage && (
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedIds.includes(notice.id)}
                            onChange={() => handleSelectOne(notice.id)}
                          />
                        </TableCell>
                      )}
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
                          const now = dayjs();
                          const startDate = notice.startDate ? dayjs(notice.startDate) : null;
                          const endDate = notice.endDate ? dayjs(notice.endDate) : null;
                          const isCurrentlyVisible = notice.isActive && (!startDate || now.isAfter(startDate)) && (!endDate || now.isBefore(endDate));

                          return (
                            <TableCell key={column.id}>
                              <Chip
                                label={isCurrentlyVisible ? t('ingamePopupNotices.visible') : t('ingamePopupNotices.notVisible')}
                                color={isCurrentlyVisible ? 'primary' : 'default'}
                                size="small"
                                variant={isCurrentlyVisible ? 'filled' : 'outlined'}
                              />
                            </TableCell>
                          );
                        }
                        if (column.id === 'content') {
                          return (
                            <TableCell key={column.id}>
                              <Typography
                                variant="body2"
                                noWrap
                                sx={{
                                  maxWidth: 300,
                                  cursor: 'pointer',
                                  '&:hover': {
                                    textDecoration: 'underline',
                                  }
                                }}
                                onClick={() => handleEdit(notice)}
                              >
                                {notice.content || t('ingamePopupNotices.noContent')}
                              </Typography>
                            </TableCell>
                          );
                        }
                        if (column.id === 'priority') {
                          return (
                            <TableCell key={column.id}>
                              <Chip label={notice.displayPriority} size="small" />
                            </TableCell>
                          );
                        }
                        if (column.id === 'targeting') {
                          return (
                            <TableCell key={column.id}>
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {/* Platforms */}
                                {notice.targetPlatforms && notice.targetPlatforms.length > 0 ? (
                                  <>
                                    {notice.targetPlatforms.map((platform) => (
                                      <Chip key={platform} label={platform} size="small" />
                                    ))}
                                  </>
                                ) : (
                                  <Chip label={t('common.all')} size="small" variant="outlined" />
                                )}
                                {/* Worlds */}
                                {notice.targetWorlds && notice.targetWorlds.length > 0 && (
                                  <Chip label={`${t('ingamePopupNotices.targetWorlds')}: ${notice.targetWorlds.length}`} size="small" />
                                )}
                                {/* Markets */}
                                {notice.targetMarkets && notice.targetMarkets.length > 0 && (
                                  <Chip label={`${t('ingamePopupNotices.targetMarkets')}: ${notice.targetMarkets.length}`} size="small" />
                                )}
                                {/* Client Versions */}
                                {notice.targetClientVersions && notice.targetClientVersions.length > 0 && (
                                  <Chip label={`${t('ingamePopupNotices.targetClientVersions')}: ${notice.targetClientVersions.length}`} size="small" />
                                )}
                                {/* Account IDs */}
                                {notice.targetAccountIds && notice.targetAccountIds.length > 0 && (
                                  <Chip label={`${t('ingamePopupNotices.targetAccountIds')}: ${notice.targetAccountIds.length}`} size="small" />
                                )}
                                {/* Show Once */}
                                {notice.showOnce && (
                                  <Chip label={t('ingamePopupNotices.showOnce')} size="small" color="info" />
                                )}
                              </Box>
                            </TableCell>
                          );
                        }
                        if (column.id === 'period') {
                          return (
                            <TableCell key={column.id}>
                              <Tooltip title={notice.startDate ? formatDateTimeDetailed(notice.startDate) : t('ingamePopupNotices.startImmediately')}>
                                <Typography variant="caption" display="block">
                                  {notice.startDate ? formatRelativeTime(notice.startDate, undefined, language) : t('ingamePopupNotices.startImmediately')}
                                </Typography>
                              </Tooltip>
                              <Tooltip title={notice.endDate ? formatDateTimeDetailed(notice.endDate) : t('ingamePopupNotices.endDateNotSet')}>
                                <Typography variant="caption" display="block" color="text.secondary">
                                  ~ {notice.endDate ? formatRelativeTime(notice.endDate, undefined, language) : t('ingamePopupNotices.endDateNotSet')}
                                </Typography>
                              </Tooltip>
                            </TableCell>
                          );
                        }
                        if (column.id === 'createdAt') {
                          return (
                            <TableCell key={column.id}>
                              <Tooltip title={formatDateTimeDetailed(notice.createdAt)}>
                                <Typography variant="caption">
                                  {formatRelativeTime(notice.createdAt, undefined, language)}
                                </Typography>
                              </Tooltip>
                            </TableCell>
                          );
                        }
                        return null;
                      })}
                      {canManage && (
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
                      )}
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
      <IngamePopupNoticeFormDialog
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
            {t('ingamePopupNotices.confirmDelete')}
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
            {t('ingamePopupNotices.confirmBulkDelete', { count: selectedIds.length })}
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

      {/* SDK Guide Drawer */}
      <IngamePopupNoticeGuideDrawer
        open={guideDrawerOpen}
        onClose={() => setGuideDrawerOpen(false)}
      />
    </Box>
  );
};

export default IngamePopupNoticesPage;

