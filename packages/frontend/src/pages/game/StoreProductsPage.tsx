import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/types/permissions';
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
  Switch,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  ViewColumn as ViewColumnIcon,
  Storefront as StorefrontIcon,
  ContentCopy as ContentCopyIcon,
  Refresh as RefreshIcon,
  Sync as SyncIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import storeProductService, { StoreProduct, SyncPreviewResult, SelectedSyncItems, StoreProductStats } from '../../services/storeProductService';
import { tagService } from '../../services/tagService';
import SyncPreviewDialog, { SelectedSyncItems as DialogSelectedSyncItems } from '../../components/game/SyncPreviewDialog';
import SimplePagination from '../../components/common/SimplePagination';
import EmptyTableRow from '../../components/common/EmptyTableRow';
import ColumnSettingsDialog, { ColumnConfig } from '../../components/common/ColumnSettingsDialog';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDateTimeDetailed } from '../../utils/dateFormat';
import ConfirmDeleteDialog from '../../components/common/ConfirmDeleteDialog';
import StoreProductFormDrawer from '../../components/game/StoreProductFormDrawer';
import DynamicFilterBar, { FilterDefinition, ActiveFilter } from '../../components/common/DynamicFilterBar';

// Store display names
const STORE_DISPLAY_NAMES: Record<string, string> = {
  sdo: 'SDO',
  google_play: 'Google Play',
  app_store: 'App Store',
  one_store: 'ONE Store',
  galaxy_store: 'Galaxy Store',
  amazon: 'Amazon Appstore',
  huawei: 'Huawei AppGallery',
};

const StoreProductsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { hasPermission } = useAuth();
  const canManage = hasPermission([PERMISSIONS.STORE_PRODUCTS_MANAGE]);

  // State
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [allProducts, setAllProducts] = useState<StoreProduct[]>([]);
  const [allRegistryTags, setAllRegistryTags] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<StoreProduct | null>(null);
  const [columnSettingsAnchor, setColumnSettingsAnchor] = useState<null | HTMLElement>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  // Sync state
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncPreview, setSyncPreview] = useState<SyncPreviewResult | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);

  // Stats state
  const [productStats, setProductStats] = useState<StoreProductStats>({ total: 0, active: 0, inactive: 0 });

  // Sorting state with localStorage persistence
  const [orderBy, setOrderBy] = useState<string>(() => {
    const saved = localStorage.getItem('storeProductsSortBy');
    return saved || 'createdAt';
  });
  const [order, setOrder] = useState<'asc' | 'desc'>(() => {
    const saved = localStorage.getItem('storeProductsSortOrder');
    return (saved as 'asc' | 'desc') || 'desc';
  });

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Dynamic filter state with localStorage persistence
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>(() => {
    try {
      const saved = localStorage.getItem('storeProductsActiveFilters');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Filter definitions
  const availableFilterDefinitions: FilterDefinition[] = useMemo(() => [
    {
      key: 'isActive',
      label: t('storeProducts.isActive'),
      type: 'select',
      options: [
        { value: 'true', label: t('common.active') },
        { value: 'false', label: t('common.inactive') },
      ],
    },
    {
      key: 'tags',
      label: t('storeProducts.tags'),
      type: 'tags',
      operator: 'include_all',
      allowOperatorToggle: true,
      options: allRegistryTags.map(tag => ({
        value: tag.id,
        label: tag.name,
        color: tag.color,
        description: tag.description,
      })),
    },
    {
      key: 'store',
      label: t('storeProducts.store'),
      type: 'select',
      options: Object.entries(STORE_DISPLAY_NAMES).map(([value, label]) => ({
        value,
        label,
      })),
    },
    {
      key: 'currency',
      label: t('storeProducts.currency'),
      type: 'select',
      options: [
        { value: 'CNY', label: 'CNY' },
        { value: 'KRW', label: 'KRW' },
        { value: 'USD', label: 'USD' },
      ],
    },
    {
      key: 'priceMin',
      label: t('storeProducts.priceMin'),
      type: 'number',
    },
    {
      key: 'priceMax',
      label: t('storeProducts.priceMax'),
      type: 'number',
    },
  ], [t, allRegistryTags]);

  // Default columns
  const defaultColumns: ColumnConfig[] = [
    { id: 'checkbox', labelKey: '', visible: true },
    { id: 'isActive', labelKey: 'storeProducts.isActive', visible: true },
    { id: 'cmsProductId', labelKey: 'storeProducts.cmsProductId', visible: true },
    { id: 'productId', labelKey: 'storeProducts.productId', visible: true },
    { id: 'productName', labelKey: 'storeProducts.productName', visible: true },
    { id: 'store', labelKey: 'storeProducts.store', visible: true },
    { id: 'price', labelKey: 'storeProducts.price', visible: true },
    { id: 'saleStartAt', labelKey: 'storeProducts.saleStartAt', visible: true },
    { id: 'saleEndAt', labelKey: 'storeProducts.saleEndAt', visible: true },
    { id: 'tags', labelKey: 'storeProducts.tags', visible: true },
    { id: 'createdAt', labelKey: 'storeProducts.createdAt', visible: false },
    { id: 'updatedAt', labelKey: 'storeProducts.updatedAt', visible: false },
    { id: 'actions', labelKey: 'common.actions', visible: true },
  ];

  // Column configuration (persisted in localStorage)
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('storeProductsColumns');
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

  // Apply dynamic filters to products
  const applyFilters = (productsToFilter: StoreProduct[]): StoreProduct[] => {
    if (activeFilters.length === 0) {
      return productsToFilter;
    }

    return productsToFilter.filter(product => {
      return activeFilters.every(filter => {
        if (filter.key === 'tags') {
          const selectedTagIds = Array.isArray(filter.value) ? filter.value : [];
          if (selectedTagIds.length === 0) return true;

          const productTags = product.tags || [];
          const productTagIds = productTags.map(t => {
            if (typeof t === 'object' && t !== null && 'id' in t) {
              return t.id;
            }
            return null;
          }).filter(id => id !== null);

          return filter.operator === 'include_all'
            ? selectedTagIds.every(tagId => productTagIds.includes(tagId))
            : selectedTagIds.some(tagId => productTagIds.includes(tagId));
        }
        if (filter.key === 'store') {
          // Skip filter if value is empty
          if (!filter.value) return true;
          return product.store === filter.value;
        }
        if (filter.key === 'isActive') {
          // Skip filter if value is empty
          if (!filter.value) return true;
          return product.isActive === (filter.value === 'true');
        }
        if (filter.key === 'cmsProductId') {
          // Skip filter if value is empty
          if (!filter.value) return true;
          const searchId = Number(filter.value);
          if (isNaN(searchId)) return true;
          return product.cmsProductId === searchId;
        }
        if (filter.key === 'currency') {
          // Skip filter if value is empty
          if (!filter.value) return true;
          return product.currency === filter.value;
        }
        if (filter.key === 'priceMin') {
          // Skip filter if value is empty
          if (!filter.value) return true;
          const minPrice = Number(filter.value);
          if (isNaN(minPrice)) return true;
          return Number(product.price) >= minPrice;
        }
        if (filter.key === 'priceMax') {
          // Skip filter if value is empty
          if (!filter.value) return true;
          const maxPrice = Number(filter.value);
          if (isNaN(maxPrice)) return true;
          return Number(product.price) <= maxPrice;
        }
        return true;
      });
    });
  };

  // Load products
  const loadProducts = async () => {
    setLoading(true);
    try {
      const result = await storeProductService.getStoreProducts({
        page: page + 1,
        limit: rowsPerPage,
        search: debouncedSearchTerm || undefined,
        sortBy: orderBy,
        sortOrder: order,
      });

      if (result && typeof result === 'object' && 'products' in result && Array.isArray(result.products)) {
        const productsCopy = result.products.map(p => ({
          ...p,
          tags: p.tags && Array.isArray(p.tags) ? p.tags.map(tag => ({ ...tag })) : [],
        }));

        setAllProducts(productsCopy);
        const filteredProducts = applyFilters(productsCopy);
        setProducts(filteredProducts);
        const validTotal = typeof result.total === 'number' && !isNaN(result.total) ? result.total : 0;
        setTotal(validTotal);
      } else {
        setProducts([]);
        setAllProducts([]);
        setTotal(0);
      }
    } catch (error: any) {
      console.error('Failed to load products:', error);
      enqueueSnackbar(error.message || t('storeProducts.loadFailed'), { variant: 'error' });
      setProducts([]);
      setAllProducts([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  // Load product statistics
  const loadStats = async () => {
    try {
      const stats = await storeProductService.getStats();
      setProductStats(stats);
    } catch (error) {
      console.error('Failed to load product stats:', error);
    }
  };

  // Save active filters to localStorage
  useEffect(() => {
    localStorage.setItem('storeProductsActiveFilters', JSON.stringify(activeFilters));
  }, [activeFilters]);

  // Load all registry tags on mount
  useEffect(() => {
    const loadTags = async () => {
      try {
        const tags = await tagService.list();
        setAllRegistryTags(tags);
      } catch (error) {
        console.error('Failed to load registry tags:', error);
      }
    };
    loadTags();
    loadStats();
  }, []);

  useEffect(() => {
    loadProducts();
    loadStats();
  }, [page, rowsPerPage, debouncedSearchTerm, orderBy, order, activeFilters]);

  // Column handlers
  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    const checkboxCol = columns.find(c => c.id === 'checkbox');
    const actionsCol = columns.find(c => c.id === 'actions');

    const updatedColumns = [
      checkboxCol!,
      ...newColumns,
      actionsCol!,
    ];

    setColumns(updatedColumns);
    localStorage.setItem('storeProductsColumns', JSON.stringify(updatedColumns));
  };

  const handleResetColumns = () => {
    setColumns(defaultColumns);
    localStorage.setItem('storeProductsColumns', JSON.stringify(defaultColumns));
  };

  // Sort handler
  const handleSort = (colId: string) => {
    let newOrder: 'asc' | 'desc' = 'asc';
    if (orderBy === colId) {
      newOrder = order === 'asc' ? 'desc' : 'asc';
    }
    setOrderBy(colId);
    setOrder(newOrder);
    localStorage.setItem('storeProductsSortBy', colId);
    localStorage.setItem('storeProductsSortOrder', newOrder);
    setPage(0);
  };

  // Filter handlers
  const handleFilterAdd = (filter: ActiveFilter) => {
    setActiveFilters(prev => [...prev, filter]);
    setPage(0);
  };

  const handleFilterRemove = (key: string) => {
    setActiveFilters(prev => prev.filter(f => f.key !== key));
    setPage(0);
  };

  const handleDynamicFilterChange = (key: string, value: any) => {
    setActiveFilters(prev =>
      prev.map(f => (f.key === key ? { ...f, value } : f))
    );
    setPage(0);
  };

  const handleOperatorChange = (key: string, operator: 'any_of' | 'include_all') => {
    setActiveFilters(prev =>
      prev.map(f => (f.key === key ? { ...f, operator } : f))
    );
    setPage(0);
  };

  // CRUD handlers
  const handleCreate = () => {
    setEditingProduct(null);
    setFormDrawerOpen(true);
  };

  const handleEdit = (product: StoreProduct) => {
    const productCopy: StoreProduct = {
      ...product,
      tags: product.tags ? product.tags.map(tag => ({ ...tag })) : [],
    };
    setEditingProduct(productCopy);
    setFormDrawerOpen(true);
  };

  const handleCopy = (product: StoreProduct) => {
    const copiedName = `${product.productName} (${t('common.copy')})`;
    const copiedProduct: StoreProduct = {
      ...product,
      id: '',
      productName: copiedName,
      tags: product.tags ? product.tags.map(tag => ({ ...tag })) : [],
    };
    setEditingProduct(copiedProduct);
    setFormDrawerOpen(true);
  };

  const handleFormClose = () => {
    setFormDrawerOpen(false);
    setEditingProduct(null);
  };

  const handleFormSave = async () => {
    handleFormClose();
    setPage(0);
    setSelectedIds([]);
    await loadProducts();
    loadStats();
  };

  // Sync handlers
  const handleSyncPreview = async () => {
    setSyncLoading(true);
    try {
      const preview = await storeProductService.previewSync();
      setSyncPreview(preview);
      setSyncDialogOpen(true);
    } catch (error: any) {
      console.error('Failed to get sync preview:', error);
      enqueueSnackbar(error.message || t('storeProducts.syncPreviewFailed'), { variant: 'error' });
    } finally {
      setSyncLoading(false);
    }
  };

  const handleSyncApply = async (selected: SelectedSyncItems) => {
    setSyncLoading(true);
    try {
      const result = await storeProductService.applySync(selected);
      setSyncDialogOpen(false);
      setSyncPreview(null);
      enqueueSnackbar(
        `${t('storeProducts.syncApplySuccess')} (${t('storeProducts.syncResultAdded', { count: result.addedCount })}, ${t('storeProducts.syncResultUpdated', { count: result.updatedCount })}, ${t('storeProducts.syncResultDeleted', { count: result.deletedCount })})`,
        { variant: 'success' }
      );
      setPage(0);
      setSelectedIds([]);
      await loadProducts();
      loadStats();
    } catch (error: any) {
      console.error('Failed to apply sync:', error);
      enqueueSnackbar(error.message || t('storeProducts.syncApplyFailed'), { variant: 'error' });
    } finally {
      setSyncLoading(false);
    }
  };

  const handleSyncDialogClose = () => {
    setSyncDialogOpen(false);
    setSyncPreview(null);
  };

  const handleDelete = (product: StoreProduct) => {
    setDeletingProduct(product);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProduct) return;

    try {
      await storeProductService.deleteStoreProduct(deletingProduct.id);
      enqueueSnackbar(t('storeProducts.deleteSuccess'), { variant: 'success' });
      setSelectedIds([]);
      loadProducts();
      loadStats();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('storeProducts.deleteFailed'), { variant: 'error' });
    } finally {
      setDeleteConfirmOpen(false);
      setDeletingProduct(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setDeletingProduct(null);
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setBulkDeleteConfirmOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedIds.length === 0) return;

    try {
      await storeProductService.deleteStoreProducts(selectedIds);
      enqueueSnackbar(t('storeProducts.bulkDeleteSuccess'), { variant: 'success' });
      setSelectedIds([]);
      loadProducts();
      loadStats();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('storeProducts.bulkDeleteFailed'), { variant: 'error' });
    } finally {
      setBulkDeleteConfirmOpen(false);
    }
  };

  const handleBulkDeleteCancel = () => {
    setBulkDeleteConfirmOpen(false);
  };

  // Bulk update active status
  const handleBulkActivate = async () => {
    if (selectedIds.length === 0) return;
    try {
      await storeProductService.bulkUpdateActiveStatus(selectedIds, true);
      enqueueSnackbar(t('storeProducts.bulkActivateSuccess'), { variant: 'success' });
      setSelectedIds([]);
      loadProducts();
      loadStats();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('storeProducts.bulkActivateFailed'), { variant: 'error' });
    }
  };

  const handleBulkDeactivate = async () => {
    if (selectedIds.length === 0) return;
    try {
      await storeProductService.bulkUpdateActiveStatus(selectedIds, false);
      enqueueSnackbar(t('storeProducts.bulkDeactivateSuccess'), { variant: 'success' });
      setSelectedIds([]);
      loadProducts();
      loadStats();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('storeProducts.bulkDeactivateFailed'), { variant: 'error' });
    }
  };

  // Toggle active status
  const handleToggleActive = async (product: StoreProduct) => {
    try {
      await storeProductService.toggleActive(product.id, !product.isActive);
      enqueueSnackbar(
        product.isActive ? t('storeProducts.deactivated') : t('storeProducts.activated'),
        { variant: 'success' }
      );
      loadProducts();
      loadStats();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('common.saveFailed'), { variant: 'error' });
    }
  };

  // Selection handlers
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(products.map(p => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Visible columns
  const visibleColumns = columns.filter(col => col.visible);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StorefrontIcon />
            {t('storeProducts.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('storeProducts.subtitle')}
          </Typography>
        </Box>
        {canManage && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              variant="outlined"
              startIcon={<SyncIcon />}
              onClick={handleSyncPreview}
              disabled={syncLoading}
            >
              {t('storeProducts.syncWithPlanningData')}
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreate}
              disabled
            >
              {t('storeProducts.createProduct')}
            </Button>
          </Box>
        )}
      </Box>

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
              <TextField
                placeholder={t('storeProducts.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(0);
                }}
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
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
                size="small"
              />

              <DynamicFilterBar
                availableFilters={availableFilterDefinitions}
                activeFilters={activeFilters}
                onFilterAdd={handleFilterAdd}
                onFilterRemove={handleFilterRemove}
                onFilterChange={handleDynamicFilterChange}
                onOperatorChange={handleOperatorChange}
                afterFilterAddActions={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                    <Tooltip title={t('common.columnSettings')}>
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
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0,
                        ml: 1,
                        borderRadius: 1,
                        bgcolor: 'background.paper',
                        border: 1,
                        borderColor: 'divider',
                        overflow: 'hidden',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.5 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main' }} />
                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                          {t('storeProducts.statsTotal')} <strong style={{ color: 'inherit' }}>{productStats.total}</strong>
                        </Typography>
                      </Box>
                      <Box sx={{ width: '1px', height: 20, bgcolor: 'divider' }} />
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.5 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} />
                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                          {t('storeProducts.statsActive')} <strong style={{ color: 'inherit' }}>{productStats.active}</strong>
                        </Typography>
                      </Box>
                      <Box sx={{ width: '1px', height: 20, bgcolor: 'divider' }} />
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.5 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'text.disabled' }} />
                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                          {t('storeProducts.statsInactive')} <strong style={{ color: 'inherit' }}>{productStats.inactive}</strong>
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                }
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Tooltip title={t('common.refresh')}>
                <span>
                  <IconButton
                    size="small"
                    onClick={loadProducts}
                    disabled={loading}
                  >
                    <RefreshIcon />
                  </IconButton>
                </span>
              </Tooltip>
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
            color="success"
            size="small"
            onClick={handleBulkActivate}
          >
            {t('storeProducts.bulkActivate')}
          </Button>
          <Button
            variant="outlined"
            color="warning"
            size="small"
            onClick={handleBulkDeactivate}
          >
            {t('storeProducts.bulkDeactivate')}
          </Button>
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
                  {visibleColumns.map((column) => {
                    if (column.id === 'checkbox') {
                      if (!canManage) return null;
                      return (
                        <TableCell key={column.id} padding="checkbox">
                          <Checkbox
                            indeterminate={selectedIds.length > 0 && selectedIds.length < products.length}
                            checked={products.length > 0 && selectedIds.length === products.length}
                            onChange={handleSelectAll}
                          />
                        </TableCell>
                      );
                    }
                    if (column.id === 'actions') {
                      if (!canManage) return null;
                      return (
                        <TableCell key={column.id} align="center">
                          {t(column.labelKey)}
                        </TableCell>
                      );
                    }
                    const isSortable = ['cmsProductId', 'productId', 'productName', 'store', 'price', 'createdAt', 'updatedAt'].includes(column.id);
                    return (
                      <TableCell key={column.id}>
                        {isSortable ? (
                          <TableSortLabel
                            active={orderBy === column.id}
                            direction={orderBy === column.id ? order : 'asc'}
                            onClick={() => handleSort(column.id)}
                          >
                            {t(column.labelKey)}
                          </TableSortLabel>
                        ) : (
                          t(column.labelKey)
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && isInitialLoad ? (
                  <EmptyTableRow
                    colSpan={visibleColumns.length - (canManage ? 0 : 2)}
                    loading={true}
                    message=""
                    loadingMessage={t('common.loadingData')}
                  />
                ) : products.length === 0 ? (
                  <EmptyTableRow
                    colSpan={visibleColumns.length - (canManage ? 0 : 2)}
                    loading={false}
                    message={t('storeProducts.noProductsFound')}
                    loadingMessage=""
                  />
                ) : (
                  products.map((product) => (
                    <TableRow
                      key={product.id}
                      hover
                      selected={selectedIds.includes(product.id)}
                    >
                      {visibleColumns.map((column) => {
                        if (column.id === 'checkbox') {
                          if (!canManage) return null;
                          return (
                            <TableCell key={column.id} padding="checkbox">
                              <Checkbox
                                checked={selectedIds.includes(product.id)}
                                onChange={() => handleSelectOne(product.id)}
                              />
                            </TableCell>
                          );
                        }
                        if (column.id === 'cmsProductId') {
                          return (
                            <TableCell key={column.id}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Box
                                  component="span"
                                  onClick={() => handleEdit(product)}
                                  sx={{
                                    cursor: 'pointer',
                                    color: 'primary.main',
                                    '&:hover': { textDecoration: 'underline' },
                                  }}
                                >
                                  {product.cmsProductId ?? '-'}
                                </Box>
                                {product.cmsProductId && (
                                  <Tooltip title={t('common.copy')}>
                                    <IconButton
                                      size="small"
                                      onClick={() => {
                                        navigator.clipboard.writeText(String(product.cmsProductId));
                                        enqueueSnackbar(t('common.copied'), { variant: 'success' });
                                      }}
                                      sx={{ p: 0.25 }}
                                    >
                                      <ContentCopyIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Box>
                            </TableCell>
                          );
                        }
                        if (column.id === 'isActive') {
                          return (
                            <TableCell key={column.id}>
                              <Switch
                                checked={product.isActive}
                                onChange={() => handleToggleActive(product)}
                                disabled={!canManage}
                                size="small"
                              />
                            </TableCell>
                          );
                        }
                        if (column.id === 'productId') {
                          return (
                            <TableCell key={column.id}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography
                                  sx={{
                                    cursor: 'pointer',
                                    '&:hover': { textDecoration: 'underline' }
                                  }}
                                  onClick={() => handleEdit(product)}
                                >
                                  {product.productId}
                                </Typography>
                                <Tooltip title={t('common.copy')}>
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      navigator.clipboard.writeText(product.productId);
                                      enqueueSnackbar(t('common.copied'), { variant: 'success' });
                                    }}
                                    sx={{ p: 0.25 }}
                                  >
                                    <ContentCopyIcon sx={{ fontSize: 14 }} />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          );
                        }
                        if (column.id === 'productName') {
                          return (
                            <TableCell key={column.id}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography
                                  sx={{
                                    cursor: 'pointer',
                                    '&:hover': { textDecoration: 'underline' }
                                  }}
                                  onClick={() => handleEdit(product)}
                                >
                                  {product.productName}
                                </Typography>
                                <Tooltip title={t('common.copy')}>
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      navigator.clipboard.writeText(product.productName);
                                      enqueueSnackbar(t('common.copied'), { variant: 'success' });
                                    }}
                                    sx={{ p: 0.25 }}
                                  >
                                    <ContentCopyIcon sx={{ fontSize: 14 }} />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          );
                        }
                        if (column.id === 'store') {
                          return (
                            <TableCell key={column.id}>
                              <Chip
                                label={STORE_DISPLAY_NAMES[product.store] || product.store}
                                size="small"
                                variant="outlined"
                              />
                            </TableCell>
                          );
                        }
                        if (column.id === 'price') {
                          return (
                            <TableCell key={column.id}>
                              {product.price.toLocaleString()} {product.currency}
                            </TableCell>
                          );
                        }
                        if (column.id === 'saleStartAt') {
                          return (
                            <TableCell key={column.id}>
                              {product.saleStartAt ? formatDateTimeDetailed(product.saleStartAt) : '-'}
                            </TableCell>
                          );
                        }
                        if (column.id === 'saleEndAt') {
                          return (
                            <TableCell key={column.id}>
                              {product.saleEndAt ? formatDateTimeDetailed(product.saleEndAt) : '-'}
                            </TableCell>
                          );
                        }
                        if (column.id === 'tags') {
                          return (
                            <TableCell key={column.id}>
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', maxWidth: 220 }}>
                                {product.tags && product.tags.length > 0 ? (
                                  product.tags.slice(0, 6).map((tag, idx) => (
                                    <Tooltip key={`${tag.id}-${idx}`} title={tag.description || t('tags.noDescription')} arrow>
                                      <Chip label={tag.name} size="small" sx={{ bgcolor: tag.color, color: '#fff', cursor: 'help' }} />
                                    </Tooltip>
                                  ))
                                ) : (
                                  <Typography variant="body2" color="text.secondary">-</Typography>
                                )}
                              </Box>
                            </TableCell>
                          );
                        }
                        if (column.id === 'createdAt') {
                          return (
                            <TableCell key={column.id}>
                              {formatDateTimeDetailed(product.createdAt)}
                            </TableCell>
                          );
                        }
                        if (column.id === 'updatedAt') {
                          return (
                            <TableCell key={column.id}>
                              {formatDateTimeDetailed(product.updatedAt)}
                            </TableCell>
                          );
                        }
                        if (column.id === 'actions') {
                          if (!canManage) return null;
                          return (
                            <TableCell key={column.id} align="center">
                              <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                <Tooltip title={t('common.edit')}>
                                  <IconButton size="small" onClick={() => handleEdit(product)}>
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title={t('storeProducts.copyProduct')}>
                                  <span>
                                    <IconButton size="small" onClick={() => handleCopy(product)} disabled>
                                      <ContentCopyIcon fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                                <Tooltip title={t('common.delete')}>
                                  <IconButton size="small" onClick={() => handleDelete(product)}>
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          );
                        }
                        return null;
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          {!loading && products.length > 0 && (
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

      {/* Column Settings Dialog */}
      <ColumnSettingsDialog
        anchorEl={columnSettingsAnchor}
        onClose={() => setColumnSettingsAnchor(null)}
        columns={columns.filter(col => col.id !== 'checkbox' && col.id !== 'actions')}
        onColumnsChange={handleColumnsChange}
        onReset={handleResetColumns}
      />

      {/* Form Drawer */}
      <StoreProductFormDrawer
        open={formDrawerOpen}
        onClose={handleFormClose}
        onSave={handleFormSave}
        product={editingProduct}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={deleteConfirmOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={t('storeProducts.deleteConfirmTitle')}
        message={t('storeProducts.deleteConfirmMessage', {
          name: deletingProduct?.productName || ''
        })}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={bulkDeleteConfirmOpen}
        onClose={handleBulkDeleteCancel}
        onConfirm={handleBulkDeleteConfirm}
        title={t('storeProducts.bulkDeleteConfirmTitle')}
        message={t('storeProducts.bulkDeleteConfirmMessage', { count: selectedIds.length })}
        warning={t('storeProducts.bulkDeleteWarning')}
      >
        {/* List of products to be deleted */}
        <TableContainer sx={{ maxHeight: 300, mt: 2 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'background.paper' }}>{t('storeProducts.cmsProductId')}</TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'background.paper' }}>{t('storeProducts.productId')}</TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'background.paper' }}>{t('storeProducts.productName')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {products
                .filter((p) => selectedIds.includes(p.id))
                .map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>{product.cmsProductId || '-'}</TableCell>
                    <TableCell>{product.productId}</TableCell>
                    <TableCell>{product.productName}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      </ConfirmDeleteDialog>

      {/* Sync Preview Dialog */}
      <SyncPreviewDialog
        open={syncDialogOpen}
        onClose={handleSyncDialogClose}
        onApply={handleSyncApply}
        preview={syncPreview}
        loading={syncLoading}
      />
    </Box>
  );
};

export default StoreProductsPage;