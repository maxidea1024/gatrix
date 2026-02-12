import React, { useState, useEffect, useMemo } from 'react';

import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../types/permissions';
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
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Stack,
  FormHelperText,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import ResizableDrawer from '../../components/common/ResizableDrawer';
import {
  Add as AddIcon,
  Search as SearchIcon,
  SettingsSuggest as ContextIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  ViewColumn as ViewColumnIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { parseApiErrorMessage } from '../../utils/errorUtils';
import SimplePagination from '../../components/common/SimplePagination';
import EmptyState from '../../components/common/EmptyState';
import DynamicFilterBar, {
  FilterDefinition,
  ActiveFilter,
} from '../../components/common/DynamicFilterBar';
import ColumnSettingsDialog, { ColumnConfig } from '../../components/common/ColumnSettingsDialog';
import { useDebounce } from '../../hooks/useDebounce';
import { useGlobalPageSize } from '../../hooks/useGlobalPageSize';
import { formatDateTimeDetailed, formatRelativeTime } from '../../utils/dateFormat';
import { copyToClipboardWithNotification } from '../../utils/clipboard';
import ConfirmDeleteDialog from '../../components/common/ConfirmDeleteDialog';
import api from '../../services/api';
import { tagService } from '../../services/tagService';
import { getContrastColor } from '../../utils/colorUtils';
import FeatureSwitch from '../../components/common/FeatureSwitch';
import FieldTypeIcon from '../../components/common/FieldTypeIcon';

interface FeatureContextField {
  id: string;
  environmentId: string;
  fieldName: string;
  displayName: string;
  description: string;
  fieldType: 'string' | 'number' | 'boolean' | 'date' | 'semver' | 'array' | 'country';
  legalValues: string[];
  isEnabled: boolean;
  tags: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

const FeatureContextFieldsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { hasPermission } = useAuth();
  const canManage = hasPermission([PERMISSIONS.FEATURE_FLAGS_MANAGE]);

  // State
  const [allFields, setAllFields] = useState<FeatureContextField[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useGlobalPageSize();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingField, setDeletingField] = useState<FeatureContextField | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<Partial<FeatureContextField> | null>(null);
  const [originalField, setOriginalField] = useState<Partial<FeatureContextField> | null>(null);
  const [expandedLegalValues, setExpandedLegalValues] = useState<Set<string>>(new Set());
  const [allTags, setAllTags] = useState<
    { id: number; name: string; color: string; description?: string }[]
  >([]);
  const [columnSettingsAnchor, setColumnSettingsAnchor] = useState<null | HTMLElement>(null);
  const [showFieldDescription, setShowFieldDescription] = useState(false);
  const [showFieldTags, setShowFieldTags] = useState(false);

  // Column settings
  const defaultColumns: ColumnConfig[] = [
    { id: 'visibility', labelKey: 'featureFlags.visibility', visible: true },
    { id: 'fieldName', labelKey: 'featureFlags.fieldName', visible: true },
    { id: 'description', labelKey: 'featureFlags.description', visible: true },
    {
      id: 'legalValues',
      labelKey: 'featureFlags.legalValuesColumn',
      visible: true,
    },
    { id: 'tags', labelKey: 'featureFlags.tags', visible: true },
    { id: 'createdBy', labelKey: 'common.createdBy', visible: true },
    { id: 'createdAt', labelKey: 'featureFlags.createdAt', visible: true },
  ];
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('contextFieldsColumns');
    if (saved) {
      try {
        const savedColumns = JSON.parse(saved);
        return savedColumns;
      } catch {
        return defaultColumns;
      }
    }
    return defaultColumns;
  });
  const visibleColumns = useMemo(() => columns.filter((col) => col.visible), [columns]);

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Load fields
  const loadFields = async () => {
    setLoading(true);
    try {
      const result = await api.get('/admin/features/context-fields', {
        params: {
          search: debouncedSearchTerm || undefined,
        },
      });
      const allData = result.data?.contextFields || [];
      setAllFields(allData);
      setTotal(allData.length);
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.loadFailed'), {
        variant: 'error',
      });
      setAllFields([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // Extract filter values first
  const typeFilter = useMemo(() => {
    const filter = activeFilters.find((f) => f.key === 'fieldType');
    return filter?.value as string[] | undefined;
  }, [activeFilters]);

  const tagFilter = useMemo(() => {
    const filter = activeFilters.find((f) => f.key === 'tag');
    return filter?.value as string[] | undefined;
  }, [activeFilters]);

  // Client-side pagination with filtering
  const fields = useMemo(() => {
    let filtered = allFields;

    // Apply type filter (multiselect)
    if (typeFilter && typeFilter.length > 0) {
      filtered = filtered.filter((f) => typeFilter.includes(f.fieldType));
    }

    // Apply tag filter
    if (tagFilter && tagFilter.length > 0) {
      filtered = filtered.filter((f) => tagFilter.some((tag) => f.tags?.includes(tag)));
    }

    const start = page * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [allFields, page, rowsPerPage, typeFilter, tagFilter]);

  // Update total when filters change
  const filteredTotal = useMemo(() => {
    let filtered = allFields;
    if (typeFilter && typeFilter.length > 0) {
      filtered = filtered.filter((f) => typeFilter.includes(f.fieldType));
    }
    if (tagFilter && tagFilter.length > 0) {
      filtered = filtered.filter((f) => tagFilter.some((tag) => f.tags?.includes(tag)));
    }
    return filtered.length;
  }, [allFields, typeFilter, tagFilter]);

  // Field type icon helper for filter options
  const getFieldTypeIcon = (type: string) => {
    return <FieldTypeIcon type={type} size={16} />;
  };

  // Filter definitions
  const availableFilterDefinitions: FilterDefinition[] = useMemo(
    () => [
      {
        key: 'fieldType',
        label: t('featureFlags.fieldType'),
        type: 'multiselect',
        options: [
          {
            value: 'string',
            label: t('featureFlags.fieldTypes.string'),
            icon: getFieldTypeIcon('string'),
          },
          {
            value: 'number',
            label: t('featureFlags.fieldTypes.number'),
            icon: getFieldTypeIcon('number'),
          },
          {
            value: 'boolean',
            label: t('featureFlags.fieldTypes.boolean'),
            icon: getFieldTypeIcon('boolean'),
          },
          {
            value: 'date',
            label: t('featureFlags.fieldTypes.date'),
            icon: getFieldTypeIcon('date'),
          },
          {
            value: 'semver',
            label: t('featureFlags.fieldTypes.semver'),
            icon: getFieldTypeIcon('semver'),
          },
          {
            value: 'array',
            label: t('featureFlags.fieldTypes.array'),
            icon: getFieldTypeIcon('array'),
          },
          {
            value: 'country',
            label: t('featureFlags.fieldTypes.country'),
            icon: getFieldTypeIcon('country'),
          },
        ],
      },
      {
        key: 'tag',
        label: t('featureFlags.tags'),
        type: 'multiselect',
        options: allTags.map((tag) => ({ value: tag.name, label: tag.name })),
      },
    ],
    [t, allTags]
  );

  useEffect(() => {
    loadFields();
  }, [debouncedSearchTerm, typeFilter, tagFilter]);

  // Load tags for selection
  useEffect(() => {
    const loadTags = async () => {
      try {
        const tags = await tagService.list();
        setAllTags(tags);
      } catch (error) {
        console.error('Failed to load tags:', error);
      }
    };
    loadTags();
  }, []);

  // Filter handlers
  const handleFilterAdd = (filter: ActiveFilter) => {
    setActiveFilters([...activeFilters, filter]);
    setPage(0);
  };

  const handleFilterRemove = (filterKey: string) => {
    setActiveFilters(activeFilters.filter((f) => f.key !== filterKey));
    setPage(0);
  };

  const handleFilterChange = (filterKey: string, value: any) => {
    const newFilters = activeFilters.map((f) => (f.key === filterKey ? { ...f, value } : f));
    setActiveFilters(newFilters);
    setPage(0);
  };

  // Column handlers
  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    setColumns(newColumns);
    localStorage.setItem('contextFieldsColumns', JSON.stringify(newColumns));
  };

  const handleResetColumns = () => {
    setColumns(defaultColumns);
    localStorage.setItem('contextFieldsColumns', JSON.stringify(defaultColumns));
  };

  // Get type icon
  const getTypeIcon = (type: string) => {
    return <FieldTypeIcon type={type} size={20} sx={{ mr: 1 }} />;
  };

  // Handlers
  const handleEdit = (field: FeatureContextField) => {
    setEditingField(field);
    setOriginalField(JSON.parse(JSON.stringify(field)));
    setEditDialogOpen(true);
  };

  const handleCreate = () => {
    const newField = {
      fieldName: '',
      displayName: '',
      description: '',
      fieldType: 'string' as const,
      legalValues: [],
      tags: [],
      sortOrder: 0,
    };
    setEditingField(newField);
    setOriginalField(null);
    setShowFieldDescription(false);
    setShowFieldTags(false);
    setEditDialogOpen(true);
  };

  // Check if field has been modified
  const hasChanges = (): boolean => {
    if (!editingField) return false;
    if (!originalField) return true; // New field always has "changes"

    // Compare each field explicitly to avoid JSON.stringify key order issues
    const fieldNameChanged = (editingField.fieldName || '') !== (originalField.fieldName || '');
    const displayNameChanged =
      (editingField.displayName || '') !== (originalField.displayName || '');
    const descriptionChanged =
      (editingField.description || '') !== (originalField.description || '');
    const fieldTypeChanged =
      (editingField.fieldType || 'string') !== (originalField.fieldType || 'string');
    const sortOrderChanged = (editingField.sortOrder || 0) !== (originalField.sortOrder || 0);

    // Compare legalValues arrays
    const editingLegalValues = editingField.legalValues || [];
    const originalLegalValues = originalField.legalValues || [];
    const legalValuesChanged =
      editingLegalValues.length !== originalLegalValues.length ||
      editingLegalValues.some((v, i) => v !== originalLegalValues[i]);

    // Compare tags arrays
    const editingTags = editingField.tags || [];
    const originalTags = originalField.tags || [];
    const tagsChanged =
      editingTags.length !== originalTags.length ||
      editingTags.some((v, i) => v !== originalTags[i]);

    return (
      fieldNameChanged ||
      displayNameChanged ||
      descriptionChanged ||
      fieldTypeChanged ||
      sortOrderChanged ||
      legalValuesChanged ||
      tagsChanged
    );
  };

  const handleSave = async () => {
    if (!editingField) return;
    try {
      if (editingField.id) {
        await api.put(`/admin/features/context-fields/${editingField.fieldName}`, editingField);
        enqueueSnackbar(t('featureFlags.updateSuccess'), {
          variant: 'success',
        });
      } else {
        await api.post('/admin/features/context-fields', editingField);
        enqueueSnackbar(t('featureFlags.createSuccess'), {
          variant: 'success',
        });
      }
      setEditDialogOpen(false);
      setEditingField(null);
      loadFields();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.saveFailed'), {
        variant: 'error',
      });
    }
  };

  const handleDelete = (field: FeatureContextField) => {
    setDeletingField(field);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingField) return;
    try {
      await api.delete(`/admin/features/context-fields/${deletingField.fieldName}`);
      enqueueSnackbar(t('featureFlags.deleteSuccess'), { variant: 'success' });
      loadFields();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.deleteFailed'), {
        variant: 'error',
      });
    } finally {
      setDeleteConfirmOpen(false);
      setDeletingField(null);
    }
  };

  const getFieldTypeLabel = (type: string) => {
    switch (type) {
      case 'string':
        return t('featureFlags.fieldTypes.string');
      case 'number':
        return t('featureFlags.fieldTypes.number');
      case 'boolean':
        return t('featureFlags.fieldTypes.boolean');
      case 'date':
        return t('featureFlags.fieldTypes.date');
      case 'semver':
        return t('featureFlags.fieldTypes.semver');
      case 'array':
        return t('featureFlags.fieldTypes.array');
      case 'country':
        return t('featureFlags.fieldTypes.country');
      default:
        return type;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 3,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <ContextIcon />
            {t('featureFlags.contextFields')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('featureFlags.contextFieldsDescription')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
              {t('featureFlags.addContextField')}
            </Button>
          )}
        </Box>
      </Box>

      {/* Search and Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              flexWrap: 'nowrap',
              justifyContent: 'space-between',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                alignItems: 'center',
                flexWrap: 'nowrap',
                flexGrow: 1,
                minWidth: 0,
              }}
            >
              <TextField
                placeholder={t('common.search')}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(0);
                }}
                sx={{
                  minWidth: 300,
                  flexGrow: 1,
                  maxWidth: 500,
                  '& .MuiOutlinedInput-root': {
                    height: '40px',
                    borderRadius: '20px',
                    bgcolor: 'background.paper',
                    transition: 'all 0.2s ease-in-out',
                    '& fieldset': { borderColor: 'divider' },
                    '&:hover': {
                      bgcolor: 'action.hover',
                      '& fieldset': { borderColor: 'primary.light' },
                    },
                    '&.Mui-focused': {
                      bgcolor: 'background.paper',
                      boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.1)',
                      '& fieldset': {
                        borderColor: 'primary.main',
                        borderWidth: '1px',
                      },
                    },
                  },
                  '& .MuiInputBase-input': { fontSize: '0.875rem' },
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
                onFilterChange={handleFilterChange}
                onRefresh={loadFields}
                refreshDisabled={loading}
                noWrap={true}
                afterFilterAddActions={
                  <Tooltip title={t('common.columnSettings')}>
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
                }
              />
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <Typography color="text.secondary">{t('common.loadingData')}</Typography>
            </Box>
          ) : fields.length === 0 ? (
            <EmptyState
              message={t('featureFlags.noContextFieldsFound')}
              onAddClick={canManage ? handleCreate : undefined}
              addButtonLabel={t('featureFlags.addContextField')}
            />
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      {visibleColumns.map((col) => (
                        <TableCell key={col.id}>{t(col.labelKey)}</TableCell>
                      ))}
                      {canManage && <TableCell align="center">{t('common.actions')}</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {fields.map((field) => (
                      <TableRow key={field.id} hover>
                        {visibleColumns.map((col) => {
                          switch (col.id) {
                            case 'visibility':
                              return (
                                <TableCell key={col.id}>
                                  <FeatureSwitch
                                    size="small"
                                    checked={field.isEnabled !== false}
                                    onChange={async () => {
                                      const newEnabled = !field.isEnabled;
                                      setAllFields((prev) =>
                                        prev.map((f) =>
                                          f.id === field.id ? { ...f, isEnabled: newEnabled } : f
                                        )
                                      );
                                      try {
                                        await api.put(
                                          `/admin/features/context-fields/${field.fieldName}`,
                                          { isEnabled: newEnabled }
                                        );
                                      } catch (error: any) {
                                        setAllFields((prev) =>
                                          prev.map((f) =>
                                            f.id === field.id ? { ...f, isEnabled: !newEnabled } : f
                                          )
                                        );
                                        enqueueSnackbar(
                                          parseApiErrorMessage(error, t('common.saveFailed')),
                                          { variant: 'error' }
                                        );
                                      }
                                    }}
                                    disabled={!canManage}
                                  />
                                </TableCell>
                              );
                            case 'fieldName':
                              return (
                                <TableCell key={col.id}>
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <Tooltip title={getFieldTypeLabel(field.fieldType)}>
                                      <Box
                                        sx={{
                                          display: 'flex',
                                          alignItems: 'center',
                                        }}
                                      >
                                        {getTypeIcon(field.fieldType)}
                                      </Box>
                                    </Tooltip>
                                    <Box>
                                      <Box
                                        sx={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 0.5,
                                        }}
                                      >
                                        <Typography
                                          fontWeight={500}
                                          sx={{
                                            cursor: 'pointer',
                                            '&:hover': {
                                              textDecoration: 'underline',
                                            },
                                          }}
                                          onClick={() => handleEdit(field)}
                                        >
                                          {field.fieldName}
                                        </Typography>
                                        <Tooltip title={t('common.copy')}>
                                          <IconButton
                                            size="small"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              copyToClipboardWithNotification(
                                                field.fieldName,
                                                enqueueSnackbar,
                                                t
                                              );
                                            }}
                                            sx={{
                                              opacity: 0.5,
                                              '&:hover': { opacity: 1 },
                                            }}
                                          >
                                            <CopyIcon sx={{ fontSize: 14 }} />
                                          </IconButton>
                                        </Tooltip>
                                      </Box>
                                      {field.displayName &&
                                        field.displayName !== field.fieldName && (
                                          <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{ fontSize: '0.8rem' }}
                                          >
                                            {field.displayName}
                                          </Typography>
                                        )}
                                    </Box>
                                  </Box>
                                </TableCell>
                              );
                            case 'description':
                              return (
                                <TableCell key={col.id}>
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{
                                      maxWidth: 200,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {field.description || '-'}
                                  </Typography>
                                </TableCell>
                              );
                            case 'legalValues':
                              return (
                                <TableCell key={col.id}>
                                  {field.legalValues && field.legalValues.length > 0 ? (
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: 0.5,
                                        alignItems: 'center',
                                      }}
                                    >
                                      {(expandedLegalValues.has(field.id)
                                        ? field.legalValues
                                        : field.legalValues.slice(0, 3)
                                      ).map((value, idx) => (
                                        <Chip
                                          key={idx}
                                          label={value}
                                          size="small"
                                          variant="outlined"
                                          sx={{ fontSize: '0.75rem' }}
                                        />
                                      ))}
                                      {field.legalValues.length > 3 && (
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            cursor: 'pointer',
                                            color: 'primary.main',
                                            '&:hover': {
                                              textDecoration: 'underline',
                                            },
                                          }}
                                          onClick={() => {
                                            setExpandedLegalValues((prev) => {
                                              const newSet = new Set(prev);
                                              if (newSet.has(field.id)) {
                                                newSet.delete(field.id);
                                              } else {
                                                newSet.add(field.id);
                                              }
                                              return newSet;
                                            });
                                          }}
                                        >
                                          {expandedLegalValues.has(field.id)
                                            ? t('featureFlags.showLess')
                                            : t('featureFlags.showMore', {
                                              count: field.legalValues.length - 3,
                                            })}
                                        </Typography>
                                      )}
                                    </Box>
                                  ) : (
                                    <Typography variant="body2" color="text.disabled">
                                      -
                                    </Typography>
                                  )}
                                </TableCell>
                              );
                            case 'tags':
                              return (
                                <TableCell key={col.id}>
                                  {field.tags && field.tags.length > 0 ? (
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: 0.5,
                                      }}
                                    >
                                      {field.tags.map((tagName, idx) => {
                                        const tagData = allTags.find((t) => t.name === tagName);
                                        const color = tagData?.color || '#888888';
                                        return (
                                          <Tooltip
                                            key={idx}
                                            title={tagData?.description || ''}
                                            arrow
                                          >
                                            <Chip
                                              label={tagName}
                                              size="small"
                                              sx={{
                                                bgcolor: color,
                                                color: getContrastColor(color),
                                                fontSize: '0.75rem',
                                              }}
                                            />
                                          </Tooltip>
                                        );
                                      })}
                                    </Box>
                                  ) : (
                                    <Typography variant="body2" color="text.disabled">
                                      -
                                    </Typography>
                                  )}
                                </TableCell>
                              );
                            case 'createdBy':
                              return (
                                <TableCell key={col.id}>
                                  <Box>
                                    <Typography variant="body2" fontWeight={500}>
                                      {field.createdByName || '-'}
                                    </Typography>
                                    {field.createdByEmail && (
                                      <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ fontSize: '0.8rem' }}
                                      >
                                        {field.createdByEmail}
                                      </Typography>
                                    )}
                                  </Box>
                                </TableCell>
                              );
                            case 'createdAt':
                              return (
                                <TableCell key={col.id}>
                                  <Tooltip title={formatDateTimeDetailed(field.createdAt)}>
                                    <span>{formatRelativeTime(field.createdAt)}</span>
                                  </Tooltip>
                                </TableCell>
                              );
                            default:
                              return <TableCell key={col.id}>-</TableCell>;
                          }
                        })}
                        {canManage && (
                          <TableCell align="center">
                            <Box
                              sx={{
                                display: 'flex',
                                gap: 0.5,
                                justifyContent: 'center',
                              }}
                            >
                              <Tooltip title={t('common.edit')}>
                                <IconButton size="small" onClick={() => handleEdit(field)}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t('common.delete')}>
                                <IconButton size="small" onClick={() => handleDelete(field)}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <SimplePagination
                page={page}
                rowsPerPage={rowsPerPage}
                count={filteredTotal}
                onPageChange={(_, newPage) => setPage(newPage)}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setPage(0);
                }}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Drawer */}
      <ResizableDrawer
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        title={
          editingField?.id ? t('featureFlags.editContextField') : t('featureFlags.addContextField')
        }
        subtitle={t('featureFlags.contextFieldsDescription')}
        storageKey="featureContextFieldDrawerWidth"
        defaultWidth={500}
      >
        <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
          <Stack spacing={2.5}>
            <Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={editingField?.isEnabled !== false}
                    onChange={(e) =>
                      setEditingField((prev) => ({
                        ...prev,
                        isEnabled: e.target.checked,
                      }))
                    }
                  />
                }
                label={t('featureFlags.visibility')}
              />
              <FormHelperText sx={{ ml: 4, mt: -0.5 }}>
                {t('featureFlags.visibilityHelp')}
              </FormHelperText>
            </Box>

            {/* Name + Display Name on same row */}
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <TextField
                sx={{ flex: 1 }}
                required
                label={t('featureFlags.fieldName')}
                value={editingField?.fieldName || ''}
                onChange={(e) =>
                  setEditingField((prev) => ({
                    ...prev,
                    fieldName: e.target.value.replace(/[^a-zA-Z0-9_]/g, ''),
                  }))
                }
                disabled={!!editingField?.id}
                helperText={t('featureFlags.fieldNameHelp')}
                placeholder="userId, deviceType, country..."
              />
              <TextField
                sx={{ flex: 1 }}
                label={t('featureFlags.displayName')}
                value={editingField?.displayName || ''}
                onChange={(e) =>
                  setEditingField((prev) => ({
                    ...prev,
                    displayName: e.target.value,
                  }))
                }
                helperText={t('featureFlags.displayNameHelp')}
              />
            </Box>

            {/* Expandable Description + Tags buttons */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {!showFieldDescription && !(editingField?.description) && (
                <Button
                  size="small"
                  onClick={() => setShowFieldDescription(true)}
                  sx={{ textTransform: 'none', color: 'text.secondary', fontSize: '0.8rem' }}
                >
                  {t('common.addDescription')}
                </Button>
              )}
              {!showFieldTags && !(editingField?.tags?.length) && (
                <Button
                  size="small"
                  onClick={() => setShowFieldTags(true)}
                  sx={{ textTransform: 'none', color: 'text.secondary', fontSize: '0.8rem' }}
                >
                  + {t('common.addTag')}
                </Button>
              )}
            </Box>

            {/* Collapsible Description */}
            {(showFieldDescription || !!(editingField?.description)) && (
              <TextField
                fullWidth
                multiline
                rows={3}
                label={t('featureFlags.description')}
                value={editingField?.description || ''}
                onChange={(e) =>
                  setEditingField((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                helperText={t('featureFlags.descriptionHelp')}
              />
            )}

            {/* Collapsible Tags */}
            {(showFieldTags || !!(editingField?.tags?.length)) && (
              <Autocomplete
                multiple
                options={allTags}
                getOptionLabel={(option) => (typeof option === 'string' ? option : option.name)}
                filterSelectedOptions
                isOptionEqualToValue={(option, value) => {
                  const optName = typeof option === 'string' ? option : option.name;
                  const valName = typeof value === 'string' ? value : value.name;
                  return optName === valName;
                }}
                value={(editingField?.tags || []).map((tagName) => {
                  const found = allTags.find((t) => t.name === tagName);
                  return found || { id: 0, name: tagName, color: '#888888' };
                })}
                onChange={(_, newValue) => {
                  const tagNames = newValue.map((v) => (typeof v === 'string' ? v : v.name));
                  setEditingField((prev) => ({ ...prev, tags: tagNames }));
                }}
                renderTags={(value, getTagProps) =>
                  value.map((option, idx) => {
                    const { key, ...chipProps } = getTagProps({ index: idx });
                    const tagData =
                      typeof option === 'string' ? { name: option, color: '#888888' } : option;
                    return (
                      <Tooltip key={key} title={tagData.description || ''} arrow>
                        <Chip
                          size="small"
                          label={tagData.name}
                          sx={{
                            bgcolor: tagData.color,
                            color: getContrastColor(tagData.color),
                          }}
                          {...chipProps}
                        />
                      </Tooltip>
                    );
                  })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t('featureFlags.tags')}
                    placeholder={t('featureFlags.tagsPlaceholder')}
                    helperText={t('featureFlags.tagsHelp')}
                  />
                )}
                renderOption={(props, option) => {
                  const tagData =
                    typeof option === 'string'
                      ? { name: option, color: '#888888', description: '' }
                      : option;
                  return (
                    <Box component="li" {...props}>
                      <Chip
                        label={tagData.name}
                        size="small"
                        sx={{
                          bgcolor: tagData.color,
                          color: getContrastColor(tagData.color),
                          mr: 1,
                        }}
                      />
                      {tagData.description || t('tags.noDescription')}
                    </Box>
                  );
                }}
              />
            )}

            <FormControl fullWidth>
              <InputLabel>{t('featureFlags.fieldType')}</InputLabel>
              <Select
                value={editingField?.fieldType || 'string'}
                label={t('featureFlags.fieldType')}
                onChange={(e) =>
                  setEditingField((prev) => ({
                    ...prev,
                    fieldType: e.target.value as any,
                  }))
                }
                disabled={!!editingField?.id}
                renderValue={(value) => (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {getTypeIcon(value as string)}
                    <span>{t(`featureFlags.fieldTypes.${value}`)}</span>
                  </Box>
                )}
              >
                {[
                  { value: 'string', descKey: 'featureFlags.fieldTypeDesc.string' },
                  { value: 'number', descKey: 'featureFlags.fieldTypeDesc.number' },
                  { value: 'boolean', descKey: 'featureFlags.fieldTypeDesc.boolean' },
                  { value: 'date', descKey: 'featureFlags.fieldTypeDesc.date' },
                  { value: 'semver', descKey: 'featureFlags.fieldTypeDesc.semver' },
                  { value: 'array', descKey: 'featureFlags.fieldTypeDesc.array' },
                  { value: 'country', descKey: 'featureFlags.fieldTypeDesc.country' },
                ].map((item) => (
                  <MenuItem key={item.value} value={item.value} sx={{ py: 1.5 }}>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {getTypeIcon(item.value)}
                        {t(`featureFlags.fieldTypes.${item.value}`)}
                      </Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ ml: 3.5, display: 'block', mt: 0.25, lineHeight: 1.3 }}
                      >
                        {t(item.descKey)}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>{t('featureFlags.fieldTypeHelp')}</FormHelperText>
            </FormControl>

            {/* Legal Values - only show for string and number types */}
            {(editingField?.fieldType === 'string' || editingField?.fieldType === 'number') && (
              <Autocomplete
                multiple
                freeSolo
                options={[]}
                value={editingField?.legalValues || []}
                onChange={(_, newValue) =>
                  setEditingField((prev) => ({
                    ...prev,
                    legalValues: newValue as string[],
                  }))
                }
                renderTags={(value, getTagProps) =>
                  value.map((option, idx) => (
                    <Chip size="small" label={option} {...getTagProps({ index: idx })} key={idx} />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t('featureFlags.legalValues')}
                    placeholder={t('featureFlags.legalValuesPlaceholder')}
                    helperText={t('featureFlags.legalValuesHelp')}
                  />
                )}
              />
            )}
          </Stack>
        </Box>

        {/* Footer Actions */}
        <Box
          sx={{
            p: 2,
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            gap: 1,
            justifyContent: 'flex-end',
          }}
        >
          <Button onClick={() => setEditDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!hasChanges() || !editingField?.fieldName}
          >
            {editingField?.id ? t('common.update') : t('common.create')}
          </Button>
        </Box>
      </ResizableDrawer>

      {/* Delete Dialog */}
      <ConfirmDeleteDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteConfirm}
        title={t('featureFlags.deleteConfirmTitle')}
        message={t('featureFlags.deleteConfirmMessage', {
          name: deletingField?.fieldName || '',
        })}
      />

      {/* Column Settings Dialog */}
      <ColumnSettingsDialog
        anchorEl={columnSettingsAnchor}
        onClose={() => setColumnSettingsAnchor(null)}
        columns={columns}
        onColumnsChange={handleColumnsChange}
        onReset={handleResetColumns}
      />
    </Box>
  );
};

export default FeatureContextFieldsPage;
