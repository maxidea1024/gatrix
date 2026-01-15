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
  Divider,
  TableSortLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  ViewColumn as ViewColumnIcon,
  CardGiftcard as GiftIcon,
  FilterList as FilterListIcon,
  ContentCopy as ContentCopyIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { parseApiErrorMessage } from '../../utils/errorUtils';
import rewardTemplateService, { RewardTemplate } from '../../services/rewardTemplateService';
import { tagService } from '../../services/tagService';
import SimplePagination from '../../components/common/SimplePagination';
import EmptyState from '../../components/common/EmptyState';
import ColumnSettingsDialog, { ColumnConfig } from '../../components/common/ColumnSettingsDialog';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDateTimeDetailed } from '../../utils/dateFormat';
import ConfirmDeleteDialog from '../../components/common/ConfirmDeleteDialog';
import RewardTemplateFormDialog from '../../components/game/RewardTemplateFormDialog';
import RewardDisplay from '../../components/game/RewardDisplay';
import DynamicFilterBar, { FilterDefinition, ActiveFilter } from '../../components/common/DynamicFilterBar';

const RewardTemplatesPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { hasPermission } = useAuth();
  const canManage = hasPermission([PERMISSIONS.REWARD_TEMPLATES_MANAGE]);

  // State
  const [templates, setTemplates] = useState<RewardTemplate[]>([]);
  const [allTemplates, setAllTemplates] = useState<RewardTemplate[]>([]); // All templates for tag extraction
  const [allRegistryTags, setAllRegistryTags] = useState<any[]>([]); // All registry tags for filter options
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RewardTemplate | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<RewardTemplate | null>(null);
  const [columnSettingsAnchor, setColumnSettingsAnchor] = useState<null | HTMLElement>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  // Sorting state with localStorage persistence
  const [orderBy, setOrderBy] = useState<string>(() => {
    const saved = localStorage.getItem('rewardTemplatesSortBy');
    return saved || 'createdAt';
  });
  const [order, setOrder] = useState<'asc' | 'desc'>(() => {
    const saved = localStorage.getItem('rewardTemplatesSortOrder');
    return (saved as 'asc' | 'desc') || 'desc';
  });

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Dynamic filter state with localStorage persistence
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>(() => {
    try {
      const saved = localStorage.getItem('rewardTemplatesActiveFilters');
      const filters = saved ? JSON.parse(saved) : [];
      console.log('[RewardTemplatesPage] Restored filters from localStorage:', filters);
      return filters;
    } catch (e) {
      console.error('[RewardTemplatesPage] Failed to restore filters:', e);
      return [];
    }
  });

  // Get all unique tags from all templates for filter options (not just displayed ones)
  const allTags = useMemo(() => {
    const tagMap = new Map<number, any>();
    allTemplates.forEach((template) => {
      if (template.tags && Array.isArray(template.tags)) {
        template.tags.forEach(tag => {
          if (tag && typeof tag === 'object' && 'id' in tag) {
            tagMap.set(tag.id, tag);
          }
        });
      }
    });
    const result = Array.from(tagMap.values());
    console.log('[RewardTemplatesPage] allTags computed from allTemplates:', {
      allTemplateCount: allTemplates.length,
      displayedTemplateCount: templates.length,
      uniqueTagCount: result.length,
      tags: result.map(t => ({ id: t.id, name: t.name })),
    });
    return result;
  }, [allTemplates]);

  // Filter definitions
  const availableFilterDefinitions: FilterDefinition[] = useMemo(() => [
    {
      key: 'tags',
      label: t('rewardTemplates.tags'),
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
  ], [t, allRegistryTags]);

  // Default columns for reset
  const defaultColumns: ColumnConfig[] = [
    { id: 'checkbox', labelKey: '', visible: true },
    { id: 'name', labelKey: 'rewardTemplates.name', visible: true },
    { id: 'description', labelKey: 'rewardTemplates.description', visible: true },
    { id: 'rewardItems', labelKey: 'rewardTemplates.rewardItems', visible: true },
    { id: 'tags', labelKey: 'rewardTemplates.tags', visible: true },
    { id: 'createdAt', labelKey: 'rewardTemplates.createdAt', visible: true },
    { id: 'actions', labelKey: 'common.actions', visible: true },
  ];

  // Column configuration (persisted in localStorage)
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('rewardTemplatesColumns');
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

  // Apply dynamic filters to templates
  const applyFilters = (templatesToFilter: RewardTemplate[]): RewardTemplate[] => {
    if (activeFilters.length === 0) {
      return templatesToFilter;
    }

    console.log('[RewardTemplatesPage] Applying filters:', {
      activeFilters,
      templateCount: templatesToFilter.length,
    });

    const filtered = templatesToFilter.filter(template => {
      return activeFilters.every(filter => {
        // Handle tags filter
        if (filter.key === 'tags') {
          const selectedTagIds = Array.isArray(filter.value) ? filter.value : [];
          if (selectedTagIds.length === 0) return true;

          const templateTags = template.tags || [];
          const templateTagIds = templateTags.map(t => {
            if (typeof t === 'object' && t !== null && 'id' in t) {
              return t.id;
            }
            return null;
          }).filter(id => id !== null);

          // include_all: all selected tags must be present
          // any_of: at least one selected tag must be present
          const matches = filter.operator === 'include_all'
            ? selectedTagIds.every(tagId => templateTagIds.includes(tagId))
            : selectedTagIds.some(tagId => templateTagIds.includes(tagId));

          console.log('[RewardTemplatesPage] Tag filter check:', {
            templateId: template.id,
            templateName: template.name,
            templateTagIds,
            selectedTagIds,
            operator: filter.operator,
            matches,
          });

          return matches;
        }
        return true;
      });
    });

    console.log('[RewardTemplatesPage] Filter result:', {
      beforeCount: templatesToFilter.length,
      afterCount: filtered.length,
    });

    return filtered;
  };

  // Load templates
  const loadTemplates = async () => {
    setLoading(true);
    try {
      const result = await rewardTemplateService.getRewardTemplates({
        page: page + 1,
        limit: rowsPerPage,
        search: debouncedSearchTerm || undefined,
        sortBy: orderBy,
        sortOrder: order,
      });

      if (result && typeof result === 'object' && 'templates' in result && Array.isArray(result.templates)) {
        // Create a deep copy of templates to avoid mutation issues
        const templatesCopy = result.templates.map(t => {
          // Deep copy tags array
          const tagsCopy = t.tags && Array.isArray(t.tags)
            ? t.tags.map(tag => {
              if (typeof tag === 'object' && tag !== null) {
                return { ...tag };
              }
              return tag;
            })
            : [];

          // Deep copy rewardItems array
          const rewardItemsCopy = t.rewardItems && Array.isArray(t.rewardItems)
            ? t.rewardItems.map(item => {
              if (typeof item === 'object' && item !== null) {
                return { ...item };
              }
              return item;
            })
            : [];

          return {
            ...t,
            tags: tagsCopy,
            rewardItems: rewardItemsCopy,
          };
        });

        // Store all templates for tag extraction (for filter options)
        setAllTemplates(templatesCopy);

        // Apply dynamic filters
        const filteredTemplates = applyFilters(templatesCopy);
        setTemplates(filteredTemplates);
        // Ensure total is a valid number, default to 0 if undefined or NaN
        const totalCount = result.total;
        const validTotal = typeof totalCount === 'number' && !isNaN(totalCount) ? totalCount : 0;
        setTotal(validTotal);
      } else {
        console.error('Invalid response:', result);
        setTemplates([]);
        setAllTemplates([]);
        setTotal(0);
      }
    } catch (error: any) {
      console.error('Failed to load templates:', error);
      enqueueSnackbar(parseApiErrorMessage(error, 'rewardTemplates.loadFailed'), { variant: 'error' });
      setTemplates([]);
      setAllTemplates([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  // Save active filters to localStorage
  useEffect(() => {
    console.log('[RewardTemplatesPage] Saving filters to localStorage:', activeFilters);
    localStorage.setItem('rewardTemplatesActiveFilters', JSON.stringify(activeFilters));
  }, [activeFilters]);

  // Load all registry tags on mount (for filter options)
  useEffect(() => {
    const loadTags = async () => {
      try {
        const tags = await tagService.list();
        setAllRegistryTags(tags);
        console.log('[RewardTemplatesPage] Registry tags loaded:', tags.length);
      } catch (error) {
        console.error('[RewardTemplatesPage] Failed to load registry tags:', error);
      }
    };
    loadTags();
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [page, rowsPerPage, debouncedSearchTerm, orderBy, order, activeFilters]);

  // Column handlers
  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    // Merge with checkbox and actions columns
    const checkboxCol = columns.find(c => c.id === 'checkbox');
    const actionsCol = columns.find(c => c.id === 'actions');

    const updatedColumns = [
      checkboxCol!,
      ...newColumns,
      actionsCol!,
    ];

    setColumns(updatedColumns);
    localStorage.setItem('rewardTemplatesColumns', JSON.stringify(updatedColumns));
  };

  const handleResetColumns = () => {
    setColumns(defaultColumns);
    localStorage.setItem('rewardTemplatesColumns', JSON.stringify(defaultColumns));
  };

  // Sort handler
  const handleSort = (colId: string) => {
    let newOrder: 'asc' | 'desc' = 'asc';
    if (orderBy === colId) {
      newOrder = order === 'asc' ? 'desc' : 'asc';
    }
    setOrderBy(colId);
    setOrder(newOrder);
    localStorage.setItem('rewardTemplatesSortBy', colId);
    localStorage.setItem('rewardTemplatesSortOrder', newOrder);
    setPage(0); // Reset to first page when sorting
  };

  // Filter handlers
  const handleFilterAdd = (filter: ActiveFilter) => {
    console.log('[RewardTemplatesPage] Adding filter:', filter);
    setActiveFilters(prev => [...prev, filter]);
    setPage(0); // Reset to first page when adding filter
  };

  const handleFilterRemove = (key: string) => {
    console.log('[RewardTemplatesPage] Removing filter:', key);
    setActiveFilters(prev => prev.filter(f => f.key !== key));
    setPage(0); // Reset to first page when removing filter
  };

  const handleDynamicFilterChange = (key: string, value: any) => {
    console.log('[RewardTemplatesPage] Changing filter value:', { key, value });
    setActiveFilters(prev =>
      prev.map(f => (f.key === key ? { ...f, value } : f))
    );
    setPage(0); // Reset to first page when changing filter value
  };

  const handleOperatorChange = (key: string, operator: 'any_of' | 'include_all') => {
    console.log('[RewardTemplatesPage] Changing operator:', { key, operator });
    setActiveFilters(prev =>
      prev.map(f => (f.key === key ? { ...f, operator } : f))
    );
    setPage(0); // Reset to first page when changing operator
  };

  // CRUD handlers
  const handleCreate = () => {
    setEditingTemplate(null);
    setFormDrawerOpen(true);
  };

  const handleEdit = (template: RewardTemplate) => {
    // Deep copy template to avoid reference sharing
    const templateCopy: RewardTemplate = {
      ...template,
      tags: template.tags ? template.tags.map(tag => ({ ...tag })) : [],
      rewardItems: template.rewardItems ? template.rewardItems.map(item => ({ ...item })) : [],
    };
    setEditingTemplate(templateCopy);
    setFormDrawerOpen(true);
  };

  const handleCopy = (template: RewardTemplate) => {
    // Create a copy with modified name
    const copiedName = `${template.name} (${t('common.copy')})`;
    const copiedTemplate: RewardTemplate = {
      ...template,
      id: '', // Remove ID so it's treated as a new template
      name: copiedName,
      tags: template.tags ? template.tags.map(tag => ({ ...tag })) : [],
      rewardItems: template.rewardItems ? template.rewardItems.map(item => ({ ...item })) : [],
    };
    setEditingTemplate(copiedTemplate);
    setFormDrawerOpen(true);
  };

  const handleFormClose = () => {
    setFormDrawerOpen(false);
    setEditingTemplate(null);
  };

  const handleFormSave = async () => {
    handleFormClose();
    setPage(0);
    setSelectedIds([]);
    await loadTemplates();
  };

  const handleDelete = (template: RewardTemplate) => {
    setDeletingTemplate(template);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTemplate) return;

    try {
      await rewardTemplateService.deleteRewardTemplate(deletingTemplate.id);
      enqueueSnackbar(t('rewardTemplates.deleteSuccess'), { variant: 'success' });
      setSelectedIds([]);
      loadTemplates();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'rewardTemplates.deleteFailed'), { variant: 'error' });
    } finally {
      setDeleteConfirmOpen(false);
      setDeletingTemplate(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setDeletingTemplate(null);
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setBulkDeleteConfirmOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedIds.length === 0) return;

    try {
      await Promise.all(selectedIds.map(id => rewardTemplateService.deleteRewardTemplate(id)));
      enqueueSnackbar(t('rewardTemplates.bulkDeleteSuccess'), { variant: 'success' });
      setSelectedIds([]);
      loadTemplates();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'rewardTemplates.bulkDeleteFailed'), { variant: 'error' });
    } finally {
      setBulkDeleteConfirmOpen(false);
    }
  };

  const handleBulkDeleteCancel = () => {
    setBulkDeleteConfirmOpen(false);
  };

  // Selection handlers
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(templates.map(t => t.id));
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
            <GiftIcon />
            {t('rewardTemplates.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('rewardTemplates.subtitle')}
          </Typography>
        </Box>
        {canManage && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreate}
            >
              {t('rewardTemplates.createTemplate')}
            </Button>
          </Box>
        )}
      </Box>

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {/* Left side: Search and Filters */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
              <TextField
                placeholder={t('rewardTemplates.searchPlaceholder')}
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

              {/* Dynamic Filter Bar */}
              <DynamicFilterBar
                availableFilters={availableFilterDefinitions}
                activeFilters={activeFilters}
                onFilterAdd={handleFilterAdd}
                onFilterRemove={handleFilterRemove}
                onFilterChange={handleDynamicFilterChange}
                onOperatorChange={handleOperatorChange}
                afterFilterAddActions={
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
                }
              />
            </Box>

            {/* Right side: Refresh Button */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Tooltip title={t('common.refresh')}>
                <span>
                  <IconButton
                    size="small"
                    onClick={loadTemplates}
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
          {loading && isInitialLoad ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <Typography color="text.secondary">{t('common.loadingData')}</Typography>
            </Box>
          ) : templates.length === 0 ? (
            <EmptyState
              message={t('rewardTemplates.noTemplatesFound')}
              onAddClick={canManage ? handleCreate : undefined}
              addButtonLabel={t('rewardTemplates.createTemplate')}
              subtitle={canManage ? t('common.addFirstItem') : undefined}
            />
          ) : (
            <>
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
                                indeterminate={selectedIds.length > 0 && selectedIds.length < templates.length}
                                checked={templates.length > 0 && selectedIds.length === templates.length}
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
                        const isSortable = ['name', 'createdAt'].includes(column.id);
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
                    {templates.map((template) => (
                      <TableRow
                        key={template.id}
                        hover
                        selected={selectedIds.includes(template.id)}
                      >
                        {visibleColumns.map((column) => {
                          if (column.id === 'checkbox') {
                            if (!canManage) return null;
                            return (
                              <TableCell key={column.id} padding="checkbox">
                                <Checkbox
                                  checked={selectedIds.includes(template.id)}
                                  onChange={() => handleSelectOne(template.id)}
                                />
                              </TableCell>
                            );
                          }
                          if (column.id === 'name') {
                            return (
                              <TableCell key={column.id}>
                                <Typography
                                  sx={{
                                    cursor: 'pointer',
                                    '&:hover': {
                                      textDecoration: 'underline'
                                    }
                                  }}
                                  onClick={() => handleEdit(template)}
                                >
                                  {template.name}
                                </Typography>
                              </TableCell>
                            );
                          }
                          if (column.id === 'description') {
                            return (
                              <TableCell key={column.id}>
                                <Typography
                                  sx={{
                                    cursor: 'pointer',
                                    '&:hover': {
                                      textDecoration: 'underline'
                                    }
                                  }}
                                  onClick={() => handleEdit(template)}
                                >
                                  {template.description || '-'}
                                </Typography>
                              </TableCell>
                            );
                          }
                          if (column.id === 'rewardItems') {
                            return (
                              <TableCell key={column.id}>
                                <RewardDisplay rewards={template.rewardItems} maxDisplay={3} />
                              </TableCell>
                            );
                          }
                          if (column.id === 'tags') {
                            return (
                              <TableCell key={column.id}>
                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', maxWidth: 220 }}>
                                  {template.tags && template.tags.length > 0 ? (
                                    template.tags.slice(0, 6).map((tag, idx) => (
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
                                {formatDateTimeDetailed(template.createdAt)}
                              </TableCell>
                            );
                          }
                          if (column.id === 'actions') {
                            if (!canManage) return null;
                            return (
                              <TableCell key={column.id} align="center">
                                <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                  <Tooltip title={t('common.edit')}>
                                    <IconButton
                                      size="small"
                                      onClick={() => handleEdit(template)}
                                    >
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title={t('rewardTemplates.copyTemplate')}>
                                    <IconButton
                                      size="small"
                                      onClick={() => handleCopy(template)}
                                    >
                                      <ContentCopyIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title={t('common.delete')}>
                                    <IconButton
                                      size="small"
                                      onClick={() => handleDelete(template)}
                                    >
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
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
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
            </>
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

      {/* Form Dialog */}
      <RewardTemplateFormDialog
        open={formDrawerOpen}
        onClose={handleFormClose}
        onSave={handleFormSave}
        template={editingTemplate}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={deleteConfirmOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={t('rewardTemplates.deleteConfirmTitle')}
        message={t('rewardTemplates.deleteConfirmMessage', {
          name: deletingTemplate?.name || ''
        })}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={bulkDeleteConfirmOpen}
        onClose={handleBulkDeleteCancel}
        onConfirm={handleBulkDeleteConfirm}
        title={t('rewardTemplates.bulkDeleteConfirmTitle')}
        message={t('rewardTemplates.bulkDeleteConfirmMessage', { count: selectedIds.length })}
        warning={t('rewardTemplates.bulkDeleteWarning')}
      />
    </Box>
  );
};

export default RewardTemplatesPage;

