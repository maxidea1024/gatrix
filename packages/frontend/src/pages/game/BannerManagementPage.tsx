import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
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
  Card,
  CardContent,
  TableSortLabel,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  ViewColumn as ViewColumnIcon,
  Image as ImageIcon,
  Refresh as RefreshIcon,
  ContentCopy as ContentCopyIcon,
  Publish as PublishIcon,
  Archive as ArchiveIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import bannerService, { Banner, BannerStatus } from '../../services/bannerService';
import SimplePagination from '../../components/common/SimplePagination';
import EmptyTableRow from '../../components/common/EmptyTableRow';
import ColumnSettingsDialog, { ColumnConfig } from '../../components/common/ColumnSettingsDialog';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDateTimeDetailed } from '../../utils/dateFormat';
import ConfirmDeleteDialog from '../../components/common/ConfirmDeleteDialog';
import BannerFormDialog from '../../components/game/BannerFormDialog';

const BannerManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // State
  const [banners, setBanners] = useState<Banner[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingBanner, setDeletingBanner] = useState<Banner | null>(null);
  const [columnSettingsAnchor, setColumnSettingsAnchor] = useState<null | HTMLElement>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(null);
  const [actionMenuBanner, setActionMenuBanner] = useState<Banner | null>(null);

  // Sorting state with localStorage persistence
  const [orderBy, setOrderBy] = useState<string>(() => {
    const saved = localStorage.getItem('bannersSortBy');
    return saved || 'createdAt';
  });
  const [order, setOrder] = useState<'asc' | 'desc'>(() => {
    const saved = localStorage.getItem('bannersSortOrder');
    return (saved as 'asc' | 'desc') || 'desc';
  });

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Default columns for reset
  const defaultColumns: ColumnConfig[] = [
    { id: 'checkbox', labelKey: '', visible: true },
    { id: 'name', labelKey: 'banners.name', visible: true },
    { id: 'description', labelKey: 'banners.description', visible: true },
    { id: 'size', labelKey: 'banners.size', visible: true },
    { id: 'sequences', labelKey: 'banners.sequences', visible: true },
    { id: 'status', labelKey: 'banners.status', visible: true },
    { id: 'version', labelKey: 'banners.version', visible: true },
    { id: 'createdAt', labelKey: 'banners.createdAt', visible: true },
    { id: 'actions', labelKey: 'common.actions', visible: true },
  ];

  // Column configuration (persisted in localStorage)
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('bannersColumns');
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

  // Load banners
  const loadBanners = async () => {
    setLoading(true);
    try {
      const result = await bannerService.getBanners({
        page: page + 1,
        limit: rowsPerPage,
        search: debouncedSearchTerm || undefined,
        sortBy: orderBy,
        sortOrder: order,
      });

      if (result && typeof result === 'object' && 'banners' in result && Array.isArray(result.banners)) {
        setBanners(result.banners);
        const validTotal = typeof result.total === 'number' && !isNaN(result.total) ? result.total : 0;
        setTotal(validTotal);
      } else {
        console.error('Invalid response:', result);
        setBanners([]);
        setTotal(0);
      }
    } catch (error: any) {
      console.error('Failed to load banners:', error);
      enqueueSnackbar(error.message || t('banners.loadFailed'), { variant: 'error' });
      setBanners([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  useEffect(() => {
    loadBanners();
  }, [page, rowsPerPage, debouncedSearchTerm, orderBy, order]);

  // Column handlers
  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    const checkboxCol = columns.find(c => c.id === 'checkbox');
    const actionsCol = columns.find(c => c.id === 'actions');
    const updatedColumns = [checkboxCol!, ...newColumns, actionsCol!];
    setColumns(updatedColumns);
    localStorage.setItem('bannersColumns', JSON.stringify(updatedColumns));
  };

  const handleResetColumns = () => {
    setColumns(defaultColumns);
    localStorage.setItem('bannersColumns', JSON.stringify(defaultColumns));
  };

  // Sort handler
  const handleSort = (colId: string) => {
    let newOrder: 'asc' | 'desc' = 'asc';
    if (orderBy === colId) {
      newOrder = order === 'asc' ? 'desc' : 'asc';
    }
    setOrderBy(colId);
    setOrder(newOrder);
    localStorage.setItem('bannersSortBy', colId);
    localStorage.setItem('bannersSortOrder', newOrder);
    setPage(0);
  };

  // CRUD handlers
  const handleCreate = () => {
    setEditingBanner(null);
    setFormDialogOpen(true);
  };

  const handleEdit = (banner: Banner) => {
    setEditingBanner(banner);
    setFormDialogOpen(true);
  };

  const handleFormClose = () => {
    setFormDialogOpen(false);
    setEditingBanner(null);
  };

  const handleFormSave = async () => {
    handleFormClose();
    setPage(0);
    setSelectedIds([]);
    await loadBanners();
  };

  const handleDelete = (banner: Banner) => {
    setDeletingBanner(banner);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingBanner) return;
    try {
      await bannerService.deleteBanner(deletingBanner.bannerId);
      enqueueSnackbar(t('banners.deleteSuccess'), { variant: 'success' });
      setSelectedIds([]);
      loadBanners();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('banners.deleteFailed'), { variant: 'error' });
    } finally {
      setDeleteConfirmOpen(false);
      setDeletingBanner(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setDeletingBanner(null);
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setBulkDeleteConfirmOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedIds.length === 0) return;
    try {
      await Promise.all(selectedIds.map(id => bannerService.deleteBanner(id)));
      enqueueSnackbar(t('banners.bulkDeleteSuccess'), { variant: 'success' });
      setSelectedIds([]);
      loadBanners();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('banners.bulkDeleteFailed'), { variant: 'error' });
    } finally {
      setBulkDeleteConfirmOpen(false);
    }
  };

  const handleBulkDeleteCancel = () => {
    setBulkDeleteConfirmOpen(false);
  };

  // Action menu handlers
  const handleActionMenuOpen = (event: React.MouseEvent<HTMLElement>, banner: Banner) => {
    setActionMenuAnchor(event.currentTarget);
    setActionMenuBanner(banner);
  };

  const handleActionMenuClose = () => {
    setActionMenuAnchor(null);
    setActionMenuBanner(null);
  };

  const handleDuplicate = async () => {
    if (!actionMenuBanner) return;
    try {
      await bannerService.duplicateBanner(actionMenuBanner.bannerId);
      enqueueSnackbar(t('banners.duplicateSuccess'), { variant: 'success' });
      loadBanners();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('banners.duplicateFailed'), { variant: 'error' });
    } finally {
      handleActionMenuClose();
    }
  };

  const handlePublish = async () => {
    if (!actionMenuBanner) return;
    try {
      await bannerService.publishBanner(actionMenuBanner.bannerId);
      enqueueSnackbar(t('banners.publishSuccess'), { variant: 'success' });
      loadBanners();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('banners.publishFailed'), { variant: 'error' });
    } finally {
      handleActionMenuClose();
    }
  };

  const handleArchive = async () => {
    if (!actionMenuBanner) return;
    try {
      await bannerService.archiveBanner(actionMenuBanner.bannerId);
      enqueueSnackbar(t('banners.archiveSuccess'), { variant: 'success' });
      loadBanners();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('banners.archiveFailed'), { variant: 'error' });
    } finally {
      handleActionMenuClose();
    }
  };

  // Selection handlers
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(banners.map(b => b.bannerId));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Status chip color
  const getStatusColor = (status: BannerStatus): 'default' | 'success' | 'warning' => {
    switch (status) {
      case 'published': return 'success';
      case 'archived': return 'warning';
      default: return 'default';
    }
  };

  // Visible columns
  const visibleColumns = columns.filter(col => col.visible);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ImageIcon />
            {t('banners.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('banners.subtitle')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
            {t('banners.createBanner')}
          </Button>
        </Box>
      </Box>

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
              <TextField
                placeholder={t('banners.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
                sx={{
                  minWidth: 200, flexGrow: 1, maxWidth: 320,
                  '& .MuiOutlinedInput-root': {
                    height: '40px', borderRadius: '20px', bgcolor: 'background.paper',
                    transition: 'all 0.2s ease-in-out',
                    '& fieldset': { borderColor: 'divider' },
                    '&:hover': { bgcolor: 'action.hover', '& fieldset': { borderColor: 'primary.light' } },
                    '&.Mui-focused': { bgcolor: 'background.paper', boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.1)', '& fieldset': { borderColor: 'primary.main', borderWidth: '1px' } }
                  },
                  '& .MuiInputBase-input': { fontSize: '0.875rem' }
                }}
                InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} /></InputAdornment>) }}
                size="small"
              />
              <Tooltip title={t('common.columnSettings')}>
                <IconButton onClick={(e) => setColumnSettingsAnchor(e.currentTarget)} sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', '&:hover': { bgcolor: 'action.hover' } }}>
                  <ViewColumnIcon />
                </IconButton>
              </Tooltip>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Tooltip title={t('common.refresh')}>
                <span><IconButton size="small" onClick={loadBanners} disabled={loading}><RefreshIcon /></IconButton></span>
              </Tooltip>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">{t('common.selectedCount', { count: selectedIds.length })}</Typography>
          <Button variant="outlined" color="error" size="small" startIcon={<DeleteIcon />} onClick={handleBulkDelete}>{t('common.deleteSelected')}</Button>
        </Box>
      )}

      {/* Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {visibleColumns.map((column) => {
                    if (column.id === 'checkbox') {
                      return (<TableCell key={column.id} padding="checkbox"><Checkbox indeterminate={selectedIds.length > 0 && selectedIds.length < banners.length} checked={banners.length > 0 && selectedIds.length === banners.length} onChange={handleSelectAll} /></TableCell>);
                    }
                    if (column.id === 'actions') {
                      return (<TableCell key={column.id} align="center">{t(column.labelKey)}</TableCell>);
                    }
                    const isSortable = ['name', 'createdAt', 'status'].includes(column.id);
                    return (
                      <TableCell key={column.id}>
                        {isSortable ? (<TableSortLabel active={orderBy === column.id} direction={orderBy === column.id ? order : 'asc'} onClick={() => handleSort(column.id)}>{t(column.labelKey)}</TableSortLabel>) : (t(column.labelKey))}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && isInitialLoad ? (
                  <EmptyTableRow colSpan={visibleColumns.length} loading={true} message="" loadingMessage={t('common.loadingData')} />
                ) : banners.length === 0 ? (
                  <EmptyTableRow colSpan={visibleColumns.length} loading={false} message={t('banners.noBannersFound')} loadingMessage="" />
                ) : (
                  banners.map((banner) => (
                    <TableRow key={banner.bannerId} hover selected={selectedIds.includes(banner.bannerId)}>
                      {visibleColumns.map((column) => {
                        if (column.id === 'checkbox') return (<TableCell key={column.id} padding="checkbox"><Checkbox checked={selectedIds.includes(banner.bannerId)} onChange={() => handleSelectOne(banner.bannerId)} /></TableCell>);
                        if (column.id === 'name') return (<TableCell key={column.id}><Typography sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }} onClick={() => handleEdit(banner)}>{banner.name}</Typography></TableCell>);
                        if (column.id === 'description') return (<TableCell key={column.id}><Typography sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }} onClick={() => handleEdit(banner)}>{banner.description || '-'}</Typography></TableCell>);
                        if (column.id === 'size') return (<TableCell key={column.id}>{banner.width} x {banner.height}</TableCell>);
                        if (column.id === 'sequences') return (<TableCell key={column.id}><Chip label={banner.sequences?.length || 0} size="small" /></TableCell>);
                        if (column.id === 'status') return (<TableCell key={column.id}><Chip label={t(`banners.statusLabels.${banner.status}`)} size="small" color={getStatusColor(banner.status)} /></TableCell>);
                        if (column.id === 'version') return (<TableCell key={column.id}>v{banner.version}</TableCell>);
                        if (column.id === 'createdAt') return (<TableCell key={column.id}>{formatDateTimeDetailed(banner.createdAt)}</TableCell>);
                        if (column.id === 'actions') return (
                          <TableCell key={column.id} align="center">
                            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                              <Tooltip title={t('common.edit')}><IconButton size="small" onClick={() => handleEdit(banner)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                              <Tooltip title={t('common.delete')}><IconButton size="small" onClick={() => handleDelete(banner)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                              <IconButton size="small" onClick={(e) => handleActionMenuOpen(e, banner)}><MoreVertIcon fontSize="small" /></IconButton>
                            </Box>
                          </TableCell>
                        );
                        return null;
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {!loading && banners.length > 0 && (
            <SimplePagination page={page} rowsPerPage={rowsPerPage} count={total} onPageChange={(event, newPage) => setPage(newPage)} onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }} />
          )}
        </CardContent>
      </Card>

      {/* Action Menu */}
      <Menu anchorEl={actionMenuAnchor} open={Boolean(actionMenuAnchor)} onClose={handleActionMenuClose}>
        <MenuItem onClick={handleDuplicate}><ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon><ListItemText>{t('banners.duplicate')}</ListItemText></MenuItem>
        {actionMenuBanner?.status !== 'published' && (<MenuItem onClick={handlePublish}><ListItemIcon><PublishIcon fontSize="small" /></ListItemIcon><ListItemText>{t('banners.publish')}</ListItemText></MenuItem>)}
        {actionMenuBanner?.status !== 'archived' && (<MenuItem onClick={handleArchive}><ListItemIcon><ArchiveIcon fontSize="small" /></ListItemIcon><ListItemText>{t('banners.archive')}</ListItemText></MenuItem>)}
      </Menu>

      {/* Column Settings Dialog */}
      <ColumnSettingsDialog anchorEl={columnSettingsAnchor} onClose={() => setColumnSettingsAnchor(null)} columns={columns.filter(col => col.id !== 'checkbox' && col.id !== 'actions')} onColumnsChange={handleColumnsChange} onReset={handleResetColumns} />

      {/* Form Dialog */}
      <BannerFormDialog open={formDialogOpen} onClose={handleFormClose} onSave={handleFormSave} banner={editingBanner} />

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog open={deleteConfirmOpen} onClose={handleDeleteCancel} onConfirm={handleDeleteConfirm} title={t('banners.deleteConfirmTitle')} message={t('banners.deleteConfirmMessage', { name: deletingBanner?.name || '' })} />

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDeleteDialog open={bulkDeleteConfirmOpen} onClose={handleBulkDeleteCancel} onConfirm={handleBulkDeleteConfirm} title={t('banners.bulkDeleteConfirmTitle')} message={t('banners.bulkDeleteConfirmMessage', { count: selectedIds.length })} />
    </Box>
  );
};

export default BannerManagementPage;
