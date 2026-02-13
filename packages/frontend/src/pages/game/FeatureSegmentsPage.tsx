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
  Divider,
  Stack,
  FormHelperText,
  Autocomplete,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  People as SegmentIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
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
import ResizableDrawer from '../../components/common/ResizableDrawer';
import api from '../../services/api';
import ConstraintEditor, {
  Constraint,
  ContextField,
} from '../../components/features/ConstraintEditor';
import { ConstraintList } from '../../components/features/ConstraintDisplay';
import { tagService } from '../../services/tagService';
import { getContrastColor } from '../../utils/colorUtils';
import FeatureSwitch from '../../components/common/FeatureSwitch';

interface FeatureSegment {
  id: string;
  environmentId: string;
  segmentName: string;
  displayName: string;
  description: string;
  constraints: Constraint[];
  isActive?: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
  createdByEmail?: string;
}

const FeatureSegmentsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { hasPermission } = useAuth();
  const canManage = hasPermission([PERMISSIONS.FEATURE_FLAGS_MANAGE]);

  // State
  const [allSegments, setAllSegments] = useState<FeatureSegment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useGlobalPageSize();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingSegment, setDeletingSegment] = useState<FeatureSegment | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Partial<FeatureSegment> | null>(null);
  const [originalSegment, setOriginalSegment] = useState<Partial<FeatureSegment> | null>(null);
  const [contextFields, setContextFields] = useState<ContextField[]>([]);
  const [expandedConstraints, setExpandedConstraints] = useState<Set<string>>(new Set());
  const [allTags, setAllTags] = useState<
    { id: number; name: string; color: string; description?: string }[]
  >([]);
  const [columnSettingsAnchor, setColumnSettingsAnchor] = useState<null | HTMLElement>(null);
  const [showDescription, setShowDescription] = useState(false);
  const [showTags, setShowTags] = useState(false);

  // Column settings
  const defaultColumns: ColumnConfig[] = [
    { id: 'visibility', labelKey: 'featureFlags.visibility', visible: true },
    { id: 'segmentName', labelKey: 'featureFlags.segmentName', visible: true },
    { id: 'constraints', labelKey: 'featureFlags.constraints', visible: true },
    { id: 'tags', labelKey: 'featureFlags.tags', visible: true },
    { id: 'createdBy', labelKey: 'common.createdBy', visible: true },
    { id: 'createdAt', labelKey: 'featureFlags.createdAt', visible: true },
  ];
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('segmentsColumns');
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

  // Load context fields for constraint editor
  const loadContextFields = async () => {
    try {
      const result = await api.get('/admin/features/context-fields');
      const fields = result.data?.contextFields || [];
      setContextFields(
        fields
          .filter((f: any) => f.isEnabled !== false)
          .map((f: any) => {
            let rules = f.validationRules;
            if (typeof rules === 'string' && rules.trim()) {
              try {
                rules = JSON.parse(rules);
              } catch (e) {
                rules = null;
              }
            }

            return {
              fieldName: f.fieldName,
              displayName: f.displayName || f.fieldName,
              description: f.description || '',
              fieldType: f.fieldType || 'string',
              validationRules: rules,
            };
          })
      );
    } catch (error) {
      console.error('Failed to load context fields:', error);
      // Provide default context fields if API fails
      setContextFields([
        { fieldName: 'userId', displayName: 'User ID', fieldType: 'string' },
        {
          fieldName: 'sessionId',
          displayName: 'Session ID',
          fieldType: 'string',
        },
        {
          fieldName: 'currentTime',
          displayName: 'Current Time',
          fieldType: 'date',
        },
      ]);
    }
  };

  // Load segments
  const loadSegments = async () => {
    setLoading(true);
    try {
      const result = await api.get('/admin/features/segments', {
        params: {
          search: debouncedSearchTerm || undefined,
        },
      });
      const allData = result.data?.segments || [];
      setAllSegments(allData);
      setTotal(allData.length);
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.loadFailed'), {
        variant: 'error',
      });
      setAllSegments([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // Filter definitions
  const availableFilterDefinitions: FilterDefinition[] = useMemo(
    () => [
      {
        key: 'tag',
        label: t('featureFlags.tags'),
        type: 'multiselect',
        options: allTags.map((tag) => ({ value: tag.name, label: tag.name })),
      },
    ],
    [t, allTags]
  );

  // Extract filter values (must be before segments useMemo)
  const tagFilter = useMemo(() => {
    const filter = activeFilters.find((f) => f.key === 'tag');
    return filter?.value as string[] | undefined;
  }, [activeFilters]);

  // Client-side pagination with tag filtering
  const segments = useMemo(() => {
    let filtered = allSegments;

    // Apply tag filter
    if (tagFilter && tagFilter.length > 0) {
      filtered = filtered.filter((s) => tagFilter.some((tag) => s.tags?.includes(tag)));
    }

    const start = page * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [allSegments, page, rowsPerPage, tagFilter]);

  // Update total when filters change
  const filteredTotal = useMemo(() => {
    let filtered = allSegments;
    if (tagFilter && tagFilter.length > 0) {
      filtered = filtered.filter((s) => tagFilter.some((tag) => s.tags?.includes(tag)));
    }
    return filtered.length;
  }, [allSegments, tagFilter]);

  useEffect(() => {
    loadContextFields();
  }, []);

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

  useEffect(() => {
    loadSegments();
  }, [debouncedSearchTerm, tagFilter]);

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
    localStorage.setItem('segmentsColumns', JSON.stringify(newColumns));
  };

  const handleResetColumns = () => {
    setColumns(defaultColumns);
    localStorage.setItem('segmentsColumns', JSON.stringify(defaultColumns));
  };

  // Handlers
  const handleEdit = (segment: FeatureSegment) => {
    const segmentData = {
      ...segment,
      constraints: segment.constraints || [],
    };
    setEditingSegment(segmentData);
    setOriginalSegment(JSON.parse(JSON.stringify(segmentData)));
    setEditDialogOpen(true);
  };

  const handleCreate = () => {
    const newSegment = {
      segmentName: '',
      displayName: '',
      description: '',
      constraints: [],
      tags: [],
    };
    setEditingSegment(newSegment);
    setOriginalSegment(null);
    setShowDescription(false);
    setShowTags(false);
    setEditDialogOpen(true);
  };

  // Check if segment has been modified
  const hasChanges = (): boolean => {
    if (!editingSegment) return false;
    if (!originalSegment) return true; // New segment always has "changes"

    // Compare basic fields
    if ((editingSegment.segmentName || '') !== (originalSegment.segmentName || '')) return true;
    if ((editingSegment.displayName || '') !== (originalSegment.displayName || '')) return true;
    if ((editingSegment.description || '') !== (originalSegment.description || '')) return true;

    // Deep compare constraints
    const editingConstraints = editingSegment.constraints || [];
    const originalConstraints = originalSegment.constraints || [];

    if (editingConstraints.length !== originalConstraints.length) return true;

    for (let i = 0; i < editingConstraints.length; i++) {
      const ec = editingConstraints[i];
      const oc = originalConstraints[i];

      if (ec.contextName !== oc.contextName) return true;
      if (ec.operator !== oc.operator) return true;
      if ((ec.value ?? '') !== (oc.value ?? '')) return true;
      if (Boolean(ec.caseInsensitive) !== Boolean(oc.caseInsensitive)) return true;
      if (Boolean(ec.inverted) !== Boolean(oc.inverted)) return true;

      // Compare values arrays
      const ecValues = ec.values || [];
      const ocValues = oc.values || [];
      if (ecValues.length !== ocValues.length) return true;
      for (let j = 0; j < ecValues.length; j++) {
        if (ecValues[j] !== ocValues[j]) return true;
      }
    }

    // Compare tags
    const editingTags = editingSegment.tags || [];
    const originalTags = originalSegment.tags || [];
    if (editingTags.length !== originalTags.length) return true;
    for (let i = 0; i < editingTags.length; i++) {
      if (editingTags[i] !== originalTags[i]) return true;
    }

    return false;
  };

  // Check if segment is valid for saving
  const isSegmentValid = (): boolean => {
    if (!editingSegment?.segmentName) return false;

    // Valueless operators - no value required
    const valuelessOps = ['exists', 'not_exists', 'arr_empty'];
    // Multi-value operators - require values array
    const multiValueOps = ['str_in', 'num_in', 'semver_in'];

    // All constraints must have valid contextName and value
    const constraints = editingSegment.constraints || [];
    for (const constraint of constraints) {
      // Must have a context field selected
      if (!constraint.contextName) return false;

      // Valueless operators don't need a value
      if (valuelessOps.includes(constraint.operator)) continue;

      // Must have value(s) based on operator type
      if (multiValueOps.includes(constraint.operator)) {
        if (!constraint.values?.length) return false;
      } else {
        if (constraint.value === undefined || constraint.value === '') return false;
      }
    }

    return true;
  };

  const handleSave = async () => {
    if (!editingSegment) return;
    try {
      if (editingSegment.id) {
        await api.put(`/admin/features/segments/${editingSegment.id}`, editingSegment);
        enqueueSnackbar(t('featureFlags.updateSuccess'), {
          variant: 'success',
        });
      } else {
        await api.post('/admin/features/segments', editingSegment);
        enqueueSnackbar(t('featureFlags.createSuccess'), {
          variant: 'success',
        });
      }
      setEditDialogOpen(false);
      setEditingSegment(null);
      loadSegments();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.saveFailed'), {
        variant: 'error',
      });
    }
  };

  const handleDelete = (segment: FeatureSegment) => {
    setDeletingSegment(segment);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingSegment) return;
    try {
      await api.delete(`/admin/features/segments/${deletingSegment.id}`);
      enqueueSnackbar(t('featureFlags.deleteSuccess'), { variant: 'success' });
      loadSegments();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.deleteFailed'), {
        variant: 'error',
      });
    } finally {
      setDeleteConfirmOpen(false);
      setDeletingSegment(null);
    }
  };

  const handleConstraintsChange = (constraints: Constraint[]) => {
    setEditingSegment((prev) => (prev ? { ...prev, constraints } : null));
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
            <SegmentIcon />
            {t('featureFlags.segments')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('featureFlags.segmentsDescription')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
              {t('featureFlags.addSegment')}
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
                onRefresh={loadSegments}
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
          ) : segments.length === 0 ? (
            <EmptyState
              message={t('featureFlags.noSegmentsFound')}
              onAddClick={canManage ? handleCreate : undefined}
              addButtonLabel={t('featureFlags.addSegment')}
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
                    {segments.map((segment) => (
                      <TableRow key={segment.id} hover>
                        {visibleColumns.map((col) => {
                          switch (col.id) {
                            case 'visibility':
                              return (
                                <TableCell key={col.id}>
                                  <FeatureSwitch
                                    size="small"
                                    checked={segment.isActive !== false}
                                    onChange={async () => {
                                      const newActive = !segment.isActive;
                                      setAllSegments((prev) =>
                                        prev.map((s) =>
                                          s.id === segment.id ? { ...s, isActive: newActive } : s
                                        )
                                      );
                                      try {
                                        await api.put(`/admin/features/segments/${segment.id}`, {
                                          isActive: newActive,
                                        });
                                      } catch (error: any) {
                                        setAllSegments((prev) =>
                                          prev.map((s) =>
                                            s.id === segment.id ? { ...s, isActive: !newActive } : s
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
                            case 'segmentName':
                              return (
                                <TableCell key={col.id}>
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <SegmentIcon
                                      sx={{
                                        fontSize: 20,
                                        mr: 1,
                                        color: 'primary.main',
                                      }}
                                    />
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
                                          onClick={() => handleEdit(segment)}
                                        >
                                          {segment.segmentName}
                                        </Typography>
                                        <Tooltip title={t('common.copy')}>
                                          <IconButton
                                            size="small"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              copyToClipboardWithNotification(
                                                segment.segmentName,
                                                () =>
                                                  enqueueSnackbar(t('common.copySuccess'), {
                                                    variant: 'success',
                                                  }),
                                                () =>
                                                  enqueueSnackbar(t('common.copyFailed'), {
                                                    variant: 'error',
                                                  })
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
                                      {segment.displayName &&
                                        segment.displayName !== segment.segmentName && (
                                          <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{ fontSize: '0.8rem' }}
                                          >
                                            {segment.displayName}
                                          </Typography>
                                        )}
                                    </Box>
                                  </Box>
                                </TableCell>
                              );
                            case 'constraints':
                              return (
                                <TableCell key={col.id}>
                                  {segment.constraints && segment.constraints.length > 0 ? (
                                    <Box>
                                      <Box
                                        sx={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 0.5,
                                          cursor: 'pointer',
                                        }}
                                        onClick={() => {
                                          setExpandedConstraints((prev) => {
                                            const newSet = new Set(prev);
                                            if (newSet.has(segment.id)) {
                                              newSet.delete(segment.id);
                                            } else {
                                              newSet.add(segment.id);
                                            }
                                            return newSet;
                                          });
                                        }}
                                      >
                                        <Chip label={segment.constraints.length} size="small" />
                                        {expandedConstraints.has(segment.id) ? (
                                          <ExpandLessIcon fontSize="small" />
                                        ) : (
                                          <ExpandMoreIcon fontSize="small" />
                                        )}
                                      </Box>
                                      {expandedConstraints.has(segment.id) && (
                                        <Box sx={{ mt: 1 }}>
                                          <ConstraintList
                                            constraints={segment.constraints}
                                            contextFields={contextFields}
                                          />
                                        </Box>
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
                                  {segment.tags && segment.tags.length > 0 ? (
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: 0.5,
                                      }}
                                    >
                                      {segment.tags.map((tagName, idx) => {
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
                                      {segment.createdByName || '-'}
                                    </Typography>
                                    {segment.createdByEmail && (
                                      <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ fontSize: '0.8rem' }}
                                      >
                                        {segment.createdByEmail}
                                      </Typography>
                                    )}
                                  </Box>
                                </TableCell>
                              );
                            case 'createdAt':
                              return (
                                <TableCell key={col.id}>
                                  <Tooltip title={formatDateTimeDetailed(segment.createdAt)}>
                                    <span>{formatRelativeTime(segment.createdAt)}</span>
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
                                <IconButton size="small" onClick={() => handleEdit(segment)}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t('common.delete')}>
                                <IconButton size="small" onClick={() => handleDelete(segment)}>
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
        title={editingSegment?.id ? t('featureFlags.editSegment') : t('featureFlags.addSegment')}
        subtitle={t('featureFlags.segmentsDescription')}
        storageKey="featureSegmentDrawerWidth"
        defaultWidth={500}
      >
        <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
          <Stack spacing={2.5}>
            <Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={editingSegment?.isActive !== false}
                    onChange={(e) =>
                      setEditingSegment((prev) => ({
                        ...prev,
                        isActive: e.target.checked,
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
                autoFocus={!editingSegment?.id}
                label={t('featureFlags.segmentName')}
                value={editingSegment?.segmentName || ''}
                onChange={(e) =>
                  setEditingSegment((prev) => ({
                    ...prev,
                    segmentName: e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''),
                  }))
                }
                disabled={!!editingSegment?.id}
                helperText={t('featureFlags.segmentNameHelp')}
                placeholder="beta-users, premium-tier..."
              />
              <TextField
                sx={{ flex: 1 }}
                label={t('featureFlags.displayName')}
                value={editingSegment?.displayName || ''}
                onChange={(e) =>
                  setEditingSegment((prev) => ({
                    ...prev,
                    displayName: e.target.value,
                  }))
                }
                helperText={t('featureFlags.segmentDisplayNameHelp')}
              />
            </Box>

            {/* Expandable Description + Tags buttons */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {!showDescription && !editingSegment?.description && (
                <Button
                  size="small"
                  onClick={() => setShowDescription(true)}
                  sx={{ textTransform: 'none', color: 'text.secondary', fontSize: '0.8rem' }}
                >
                  {t('common.addDescription')}
                </Button>
              )}
              {!showTags && !editingSegment?.tags?.length && (
                <Button
                  size="small"
                  onClick={() => setShowTags(true)}
                  sx={{ textTransform: 'none', color: 'text.secondary', fontSize: '0.8rem' }}
                >
                  + {t('common.addTag')}
                </Button>
              )}
            </Box>

            {/* Collapsible Description */}
            {(showDescription || !!editingSegment?.description) && (
              <TextField
                fullWidth
                multiline
                rows={3}
                label={t('featureFlags.description')}
                value={editingSegment?.description || ''}
                onChange={(e) =>
                  setEditingSegment((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                helperText={t('featureFlags.segmentDescriptionHelp')}
              />
            )}

            {/* Collapsible Tags */}
            {(showTags || !!editingSegment?.tags?.length) && (
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
                value={(editingSegment?.tags || []).map((tagName) => {
                  const found = allTags.find((t) => t.name === tagName);
                  return found || { id: 0, name: tagName, color: '#888888' };
                })}
                onChange={(_, newValue) => {
                  const tagNames = newValue.map((v) => (typeof v === 'string' ? v : v.name));
                  setEditingSegment((prev) => ({ ...prev, tags: tagNames }));
                }}
                renderTags={(value, getTagProps) =>
                  value.map((option, idx) => {
                    const { key, ...chipProps } = getTagProps({ index: idx });
                    const tagData =
                      typeof option === 'string'
                        ? { name: option, color: '#888888', description: '' }
                        : { ...option, description: (option as any).description || '' };
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

            <Divider />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {t('featureFlags.constraints')}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                {t('featureFlags.segmentConstraintsHelp')}
              </Typography>
              <ConstraintEditor
                constraints={editingSegment?.constraints || []}
                onChange={handleConstraintsChange}
                contextFields={contextFields}
                disabled={!canManage}
              />
            </Box>
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
            disabled={!hasChanges() || !isSegmentValid()}
          >
            {editingSegment?.id ? t('common.update') : t('common.create')}
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
          name: deletingSegment?.segmentName || '',
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

export default FeatureSegmentsPage;
