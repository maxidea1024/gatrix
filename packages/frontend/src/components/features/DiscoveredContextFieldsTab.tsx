/**
 * DiscoveredContextFieldsTab
 * Displays context fields automatically discovered from SDK evaluations.
 * Reuses existing UI components from the Defined tab.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  IconButton,
  Chip,
  Typography,
  Tooltip,
  Menu,
  MenuItem as MuiMenuItem,
  ListItemIcon,
  ListItemText,
  TextField,
  Card,
  CardContent,
  Button,
  Divider,
  Stack,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  ViewColumn as ViewColumnIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ArrowUpward as PromoteIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { parseApiErrorMessage } from '../../utils/errorUtils';
import SimplePagination from '../../components/common/SimplePagination';
import SearchTextField from '../../components/common/SearchTextField';
import EmptyPagePlaceholder from '../../components/common/EmptyPagePlaceholder';
import DynamicFilterBar, {
  FilterDefinition,
  ActiveFilter,
} from '../../components/common/DynamicFilterBar';
import ColumnSettingsDialog, {
  ColumnConfig,
} from '../../components/common/ColumnSettingsDialog';
import { useDebounce } from '../../hooks/useDebounce';
import { useGlobalPageSize } from '../../hooks/useGlobalPageSize';
import {
  formatDateTimeDetailed,
  formatRelativeTime,
} from '../../utils/dateFormat';
import { copyToClipboard } from '../../utils/clipboard';
import ConfirmDeleteDialog from '../../components/common/ConfirmDeleteDialog';
import ResizableDrawer from '../../components/common/ResizableDrawer';
import PageContentLoader from '@/components/common/PageContentLoader';
import TagSelector from '../../components/common/TagSelector';
import { Tag } from '../../services/tagService';
import { getContrastColor } from '../../utils/colorUtils';
import { useOrgProject } from '../../contexts/OrgProjectContext';
import { useAuth } from '../../hooks/useAuth';
import { P } from '@/types/permissions';
import {
  contextFieldUsageService,
  ContextFieldUsageRecord,
} from '../../services/contextFieldUsageService';

interface DiscoveredContextFieldsTabProps {
  onPromote?: (fieldName: string, inferredType: string) => void;
  definedFieldNames?: Set<string>;
}

const DiscoveredContextFieldsTab: React.FC<DiscoveredContextFieldsTabProps> = ({
  onPromote,
  definedFieldNames,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { hasPermission } = useAuth();
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();
  const canManage = hasPermission([P.FEATURES_UPDATE]);

  // Sortable columns
  const SORTABLE_COLUMNS = new Set([
    'fieldName',
    'appNames',
    'accessCount',
    'lastSeen',
  ]);

  // State
  const [allFields, setAllFields] = useState<ContextFieldUsageRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useGlobalPageSize();
  const [sortBy, setSortBy] = useState<string>('lastSeen');
  const [sortDesc, setSortDesc] = useState(true);
  const [appNames, setAppNames] = useState<string[]>([]);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuTarget, setMenuTarget] = useState<ContextFieldUsageRecord | null>(
    null
  );
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editingField, setEditingField] =
    useState<ContextFieldUsageRecord | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editTagSelection, setEditTagSelection] = useState<Tag[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingField, setDeletingField] =
    useState<ContextFieldUsageRecord | null>(null);
  const [columnSettingsAnchor, setColumnSettingsAnchor] =
    useState<null | HTMLElement>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Column settings
  const defaultColumns: ColumnConfig[] = [
    {
      id: 'fieldName',
      labelKey: 'featureFlags.fieldName',
      visible: true,
    },
    {
      id: 'appNames',
      labelKey: 'contextFieldUsage.appName',
      visible: true,
    },
    {
      id: 'accessCount',
      labelKey: 'contextFieldUsage.accessCount',
      visible: true,
    },
    {
      id: 'lastSeen',
      labelKey: 'contextFieldUsage.lastSeen',
      visible: true,
    },
    {
      id: 'tags',
      labelKey: 'featureFlags.tags',
      visible: true,
    },
    {
      id: 'description',
      labelKey: 'featureFlags.description',
      visible: true,
    },
  ];

  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('discoveredContextFieldsColumns');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return defaultColumns;
      }
    }
    return defaultColumns;
  });

  const visibleColumns = useMemo(
    () => columns.filter((c) => c.visible).map((c) => c.id),
    [columns]
  );

  // Load data
  const loadFields = useCallback(async () => {
    setLoading(true);
    try {
      const statusFilter = activeFilters.find((f) => f.key === 'status');
      const appNameFilter = activeFilters.find((f) => f.key === 'appName');
      const envFilter = activeFilters.find((f) => f.key === 'environmentId');

      const fields = await contextFieldUsageService.getDiscoveredFields(
        projectApiPath!,
        {
          search: debouncedSearchTerm || undefined,
          appName: (appNameFilter?.value as string) || undefined,
          environmentId: (envFilter?.value as string) || undefined,
          includeIgnored:
            (statusFilter?.value as string) === 'ignored' ||
            (statusFilter?.value as string) === 'all',
        }
      );

      // Client-side filter for ignored
      let filtered = fields;
      if ((statusFilter?.value as string) === 'ignored') {
        filtered = fields.filter((f) => f.isIgnored);
      } else if (
        !statusFilter ||
        (statusFilter?.value as string) === 'active'
      ) {
        filtered = fields.filter((f) => !f.isIgnored);
      }

      setAllFields(filtered);
    } catch (error) {
      enqueueSnackbar(
        parseApiErrorMessage(error, 'Failed to load discovered fields'),
        { variant: 'error' }
      );
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchTerm, activeFilters, enqueueSnackbar]);

  useEffect(() => {
    loadFields();
  }, [loadFields]);

  // Load app names for filters
  useEffect(() => {
    const loadAppNames = async () => {
      try {
        const names = await contextFieldUsageService.getAppNames(
          projectApiPath!
        );
        setAppNames(names);
      } catch {
        // ignore
      }
    };
    loadAppNames();
  }, []);

  // Sort
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(column);
      setSortDesc(true);
    }
    setPage(0);
  };

  // Sorted + Paginated
  const sortedFields = useMemo(() => {
    const sorted = [...allFields].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'fieldName':
          cmp = a.fieldName.localeCompare(b.fieldName);
          break;
        case 'appNames':
          cmp = (a.appName || '').localeCompare(b.appName || '');
          break;
        case 'accessCount':
          cmp = a.accessCount - b.accessCount;
          break;
        case 'lastSeen':
          cmp =
            new Date(a.lastSeenAt).getTime() - new Date(b.lastSeenAt).getTime();
          break;
        default:
          cmp = 0;
      }
      return sortDesc ? -cmp : cmp;
    });
    return sorted;
  }, [allFields, sortBy, sortDesc]);

  const paginatedFields = useMemo(() => {
    const start = page * rowsPerPage;
    return sortedFields.slice(start, start + rowsPerPage);
  }, [sortedFields, page, rowsPerPage]);

  // Filter definitions
  const filterDefinitions: FilterDefinition[] = useMemo(
    () => [
      {
        key: 'status',
        label: t('common.status'),
        type: 'select',
        options: [
          { value: 'active', label: t('contextFieldUsage.status.active') },
          { value: 'ignored', label: t('contextFieldUsage.status.ignored') },
          { value: 'all', label: t('common.all') },
        ],
      },
      ...(appNames.length > 0
        ? [
            {
              key: 'appName',
              label: t('contextFieldUsage.appName'),
              type: 'select' as const,
              options: appNames.map((n) => ({ value: n, label: n })),
            },
          ]
        : []),
    ],
    [t, appNames]
  );

  // Handlers
  const handleFilterAdd = (filter: ActiveFilter) => {
    setActiveFilters([...activeFilters, filter]);
    setPage(0);
  };

  const handleFilterRemove = (filterKey: string) => {
    setActiveFilters(activeFilters.filter((f) => f.key !== filterKey));
    setPage(0);
  };

  const handleFilterChange = (filterKey: string, value: any) => {
    const newFilters = activeFilters.map((f) =>
      f.key === filterKey ? { ...f, value } : f
    );
    setActiveFilters(newFilters);
    setPage(0);
  };

  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    setColumns(newColumns);
    localStorage.setItem(
      'discoveredContextFieldsColumns',
      JSON.stringify(newColumns)
    );
  };

  const handleResetColumns = () => {
    setColumns(defaultColumns);
    localStorage.setItem(
      'discoveredContextFieldsColumns',
      JSON.stringify(defaultColumns)
    );
  };

  const handleMenuOpen = (
    event: React.MouseEvent<HTMLElement>,
    field: ContextFieldUsageRecord
  ) => {
    setMenuAnchorEl(event.currentTarget);
    setMenuTarget(field);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuTarget(null);
  };

  const handleEdit = (field: ContextFieldUsageRecord) => {
    setEditingField(field);
    setEditDescription(field.description || '');
    // Convert string[] tags to Tag[] for TagSelector
    setEditTagSelection(
      (field.tags || []).map((name) => ({
        id: 0 as any,
        name,
        color: '#888888',
      }))
    );
    setEditDrawerOpen(true);
    handleMenuClose();
  };

  const handleEditSave = async () => {
    if (!editingField) return;
    try {
      const tagNames = editTagSelection.map((t) => t.name);
      await contextFieldUsageService.updateFieldMeta(
        projectApiPath!,
        editingField.id,
        {
          description: editDescription,
          tags: tagNames,
        }
      );
      enqueueSnackbar(t('common.saveSuccess'), { variant: 'success' });
      setEditDrawerOpen(false);
      loadFields();
    } catch (error) {
      enqueueSnackbar(parseApiErrorMessage(error, 'Failed to save'), {
        variant: 'error',
      });
    }
  };

  const handleToggleIgnore = async (field: ContextFieldUsageRecord) => {
    try {
      await contextFieldUsageService.updateFieldMeta(
        projectApiPath!,
        field.id,
        {
          isIgnored: !field.isIgnored,
        }
      );
      enqueueSnackbar(
        field.isIgnored
          ? t('contextFieldUsage.unignored')
          : t('contextFieldUsage.ignored'),
        { variant: 'success' }
      );
      loadFields();
    } catch (error) {
      enqueueSnackbar(parseApiErrorMessage(error, 'Failed to update'), {
        variant: 'error',
      });
    }
    handleMenuClose();
  };

  const handleDelete = (field: ContextFieldUsageRecord) => {
    setDeletingField(field);
    setDeleteConfirmOpen(true);
    handleMenuClose();
  };

  const handleDeleteConfirm = async () => {
    if (!deletingField) return;
    try {
      await contextFieldUsageService.deleteField(
        projectApiPath!,
        deletingField.id
      );
      enqueueSnackbar(t('common.deletedSuccessfully'), { variant: 'success' });
      loadFields();
    } catch (error) {
      enqueueSnackbar(parseApiErrorMessage(error, 'Failed to delete'), {
        variant: 'error',
      });
    } finally {
      setDeleteConfirmOpen(false);
      setDeletingField(null);
    }
  };

  const handlePromote = async (field: ContextFieldUsageRecord) => {
    handleMenuClose();
    try {
      const { inferredType } = await contextFieldUsageService.inferType(
        projectApiPath!,
        field.id
      );
      if (onPromote) {
        onPromote(field.fieldName, inferredType);
      }
    } catch (error) {
      enqueueSnackbar(parseApiErrorMessage(error, 'Failed to infer type'), {
        variant: 'error',
      });
    }
  };

  const formatNumber = (n: number) => {
    return n.toLocaleString();
  };

  return (
    <Box>
      {/* Search and Filters */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'nowrap',
          justifyContent: 'space-between',
          mb: 1,
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
          <SearchTextField
            placeholder={t('common.search')}
            value={searchTerm}
            onChange={(value) => {
              setSearchTerm(value);
              setPage(0);
            }}
          />

          <DynamicFilterBar
            availableFilters={filterDefinitions}
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

      {/* Table */}
      <PageContentLoader loading={loading}>
        {allFields.length === 0 ? (
          <EmptyPagePlaceholder
            message={t('contextFieldUsage.emptyTitle')}
            subtitle={t('contextFieldUsage.emptyDescription')}
          />
        ) : (
          <Card variant="outlined">
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              <TableContainer
                sx={{
                  maxHeight: 'calc(100vh - 380px)',
                  position: 'relative',
                }}
              >
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {visibleColumns.includes('fieldName') && (
                        <TableCell
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            bgcolor: (theme) =>
                              theme.palette.mode === 'dark'
                                ? '#1e1e2f'
                                : '#f4f2ff',
                            zIndex: 2,
                            py: 1,
                            px: 1.5,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <TableSortLabel
                            active={sortBy === 'fieldName'}
                            direction={
                              sortBy === 'fieldName'
                                ? sortDesc
                                  ? 'desc'
                                  : 'asc'
                                : 'asc'
                            }
                            onClick={() => handleSort('fieldName')}
                          >
                            {t('featureFlags.fieldName')}
                          </TableSortLabel>
                        </TableCell>
                      )}
                      {visibleColumns.includes('appNames') && (
                        <TableCell
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            bgcolor: (theme) =>
                              theme.palette.mode === 'dark'
                                ? '#1e1e2f'
                                : '#f4f2ff',
                            zIndex: 2,
                            py: 1,
                            px: 1.5,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <TableSortLabel
                            active={sortBy === 'appNames'}
                            direction={
                              sortBy === 'appNames'
                                ? sortDesc
                                  ? 'desc'
                                  : 'asc'
                                : 'asc'
                            }
                            onClick={() => handleSort('appNames')}
                          >
                            {t('contextFieldUsage.appName')}
                          </TableSortLabel>
                        </TableCell>
                      )}
                      {visibleColumns.includes('accessCount') && (
                        <TableCell
                          align="right"
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            bgcolor: (theme) =>
                              theme.palette.mode === 'dark'
                                ? '#1e1e2f'
                                : '#f4f2ff',
                            zIndex: 2,
                            py: 1,
                            px: 1.5,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <TableSortLabel
                            active={sortBy === 'accessCount'}
                            direction={
                              sortBy === 'accessCount'
                                ? sortDesc
                                  ? 'desc'
                                  : 'asc'
                                : 'asc'
                            }
                            onClick={() => handleSort('accessCount')}
                          >
                            {t('contextFieldUsage.accessCount')}
                          </TableSortLabel>
                        </TableCell>
                      )}
                      {visibleColumns.includes('lastSeen') && (
                        <TableCell
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            bgcolor: (theme) =>
                              theme.palette.mode === 'dark'
                                ? '#1e1e2f'
                                : '#f4f2ff',
                            zIndex: 2,
                            py: 1,
                            px: 1.5,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <TableSortLabel
                            active={sortBy === 'lastSeen'}
                            direction={
                              sortBy === 'lastSeen'
                                ? sortDesc
                                  ? 'desc'
                                  : 'asc'
                                : 'asc'
                            }
                            onClick={() => handleSort('lastSeen')}
                          >
                            {t('contextFieldUsage.lastSeen')}
                          </TableSortLabel>
                        </TableCell>
                      )}
                      {visibleColumns.includes('tags') && (
                        <TableCell
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            bgcolor: (theme) =>
                              theme.palette.mode === 'dark'
                                ? '#1e1e2f'
                                : '#f4f2ff',
                            zIndex: 2,
                            py: 1,
                            px: 1.5,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t('featureFlags.tags')}
                        </TableCell>
                      )}
                      {visibleColumns.includes('description') && (
                        <TableCell
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            bgcolor: (theme) =>
                              theme.palette.mode === 'dark'
                                ? '#1e1e2f'
                                : '#f4f2ff',
                            zIndex: 2,
                            py: 1,
                            px: 1.5,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t('featureFlags.description')}
                        </TableCell>
                      )}
                      {canManage && (
                        <TableCell
                          align="center"
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            bgcolor: (theme) =>
                              theme.palette.mode === 'dark'
                                ? '#1e1e2f'
                                : '#f4f2ff',
                            zIndex: 2,
                            py: 1,
                            px: 1.5,
                            width: 48,
                          }}
                        />
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedFields.map((field) => (
                      <TableRow
                        key={field.id}
                        hover
                        sx={{
                          opacity: field.isIgnored ? 0.5 : 1,
                          cursor: 'pointer',
                          '&:last-child td': { borderBottom: 0 },
                        }}
                        onClick={() => handleEdit(field)}
                      >
                        {visibleColumns.includes('fieldName') && (
                          <TableCell sx={{ py: 0.75, px: 1.5 }}>
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                              }}
                            >
                              <Typography
                                variant="body2"
                                sx={{
                                  fontFamily: 'monospace',
                                  fontWeight: 500,
                                }}
                              >
                                {field.fieldName}
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(field.fieldName).then(
                                    (ok) => {
                                      if (ok) {
                                        enqueueSnackbar(
                                          t('common.copiedToClipboard'),
                                          { variant: 'success' }
                                        );
                                      }
                                    }
                                  );
                                }}
                                sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
                              >
                                <CopyIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                              {field.isIgnored && (
                                <Chip
                                  label={t('contextFieldUsage.status.ignored')}
                                  size="small"
                                  color="default"
                                  variant="outlined"
                                />
                              )}
                            </Box>
                          </TableCell>
                        )}
                        {visibleColumns.includes('appNames') && (
                          <TableCell sx={{ py: 0.75, px: 1.5 }}>
                            {field.appName ? (
                              <Chip
                                label={field.appName}
                                size="small"
                                variant="outlined"
                              />
                            ) : (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                —
                              </Typography>
                            )}
                          </TableCell>
                        )}
                        {visibleColumns.includes('accessCount') && (
                          <TableCell align="right" sx={{ py: 0.75, px: 1.5 }}>
                            <Typography
                              variant="body2"
                              sx={{ fontFamily: 'monospace' }}
                            >
                              {formatNumber(field.accessCount)}
                            </Typography>
                          </TableCell>
                        )}
                        {visibleColumns.includes('lastSeen') && (
                          <TableCell sx={{ py: 0.75, px: 1.5 }}>
                            <Tooltip
                              title={formatDateTimeDetailed(field.lastSeenAt)}
                            >
                              <span>
                                {formatRelativeTime(field.lastSeenAt)}
                              </span>
                            </Tooltip>
                          </TableCell>
                        )}
                        {visibleColumns.includes('tags') && (
                          <TableCell sx={{ py: 0.75, px: 1.5 }}>
                            {field.tags && field.tags.length > 0 ? (
                              <Box
                                sx={{
                                  display: 'flex',
                                  gap: 0.5,
                                  flexWrap: 'wrap',
                                }}
                              >
                                {field.tags.map((tag) => (
                                  <Chip
                                    key={tag}
                                    label={tag}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: '0.75rem' }}
                                  />
                                ))}
                              </Box>
                            ) : (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                —
                              </Typography>
                            )}
                          </TableCell>
                        )}
                        {visibleColumns.includes('description') && (
                          <TableCell sx={{ py: 0.75, px: 1.5 }}>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                maxWidth: 250,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {field.description || '—'}
                            </Typography>
                          </TableCell>
                        )}
                        {canManage && (
                          <TableCell align="center" sx={{ py: 0.75, px: 1.5 }}>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMenuOpen(e, field);
                              }}
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <SimplePagination
                count={allFields.length}
                page={page}
                rowsPerPage={rowsPerPage}
                onPageChange={(_event: unknown, newPage: number) =>
                  setPage(newPage)
                }
                onRowsPerPageChange={(event: any) => {
                  setRowsPerPage(Number(event.target.value));
                  setPage(0);
                }}
              />
            </CardContent>
          </Card>
        )}
      </PageContentLoader>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MuiMenuItem onClick={() => menuTarget && handleEdit(menuTarget)}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('common.edit')}</ListItemText>
        </MuiMenuItem>
        {menuTarget && !definedFieldNames?.has(menuTarget.fieldName) && (
          <MuiMenuItem onClick={() => menuTarget && handlePromote(menuTarget)}>
            <ListItemIcon>
              <PromoteIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('contextFieldUsage.promote')}</ListItemText>
          </MuiMenuItem>
        )}
        <MuiMenuItem
          onClick={() => menuTarget && handleToggleIgnore(menuTarget)}
        >
          <ListItemIcon>
            {menuTarget?.isIgnored ? (
              <VisibilityIcon fontSize="small" />
            ) : (
              <VisibilityOffIcon fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText>
            {menuTarget?.isIgnored
              ? t('contextFieldUsage.unignore')
              : t('contextFieldUsage.ignore')}
          </ListItemText>
        </MuiMenuItem>
        <MuiMenuItem
          onClick={() => menuTarget && handleDelete(menuTarget)}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>{t('common.delete')}</ListItemText>
        </MuiMenuItem>
      </Menu>

      {/* Edit Drawer */}
      <ResizableDrawer
        open={editDrawerOpen}
        onClose={() => setEditDrawerOpen(false)}
        title={editingField?.fieldName || ''}
        subtitle={t('contextFieldUsage.discoveredFieldSubtitle', {
          defaultValue: t('contextFieldUsage.fieldInfo'),
        })}
        storageKey="discoveredFieldDrawerWidth"
        defaultWidth={480}
      >
        <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
          <Stack spacing={2.5}>
            {/* Read-only field info */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr',
                gap: 1.5,
                alignItems: 'center',
                py: 1,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {t('contextFieldUsage.accessCount')}
              </Typography>
              <Typography
                variant="body2"
                fontWeight={600}
                sx={{ fontFamily: 'monospace' }}
              >
                {editingField ? formatNumber(editingField.accessCount) : ''}
              </Typography>

              <Typography variant="body2" color="text.secondary">
                {t('contextFieldUsage.firstSeen')}
              </Typography>
              {editingField ? (
                <Tooltip
                  title={formatDateTimeDetailed(editingField.firstSeenAt)}
                >
                  <span>{formatRelativeTime(editingField.firstSeenAt)}</span>
                </Tooltip>
              ) : (
                <Typography variant="body2">-</Typography>
              )}

              <Typography variant="body2" color="text.secondary">
                {t('contextFieldUsage.lastSeen')}
              </Typography>
              {editingField ? (
                <Tooltip
                  title={formatDateTimeDetailed(editingField.lastSeenAt)}
                >
                  <span>{formatRelativeTime(editingField.lastSeenAt)}</span>
                </Tooltip>
              ) : (
                <Typography variant="body2">-</Typography>
              )}

              {editingField?.appName && (
                <>
                  <Typography variant="body2" color="text.secondary">
                    {t('contextFieldUsage.appName')}
                  </Typography>
                  <Chip
                    label={editingField.appName}
                    size="small"
                    variant="outlined"
                    sx={{ justifySelf: 'flex-start' }}
                  />
                </>
              )}

              {editingField?.sdkVersion && (
                <>
                  <Typography variant="body2" color="text.secondary">
                    {t('contextFieldUsage.sdkVersion')}
                  </Typography>
                  <Typography variant="body2">
                    {editingField.sdkVersion}
                  </Typography>
                </>
              )}
            </Box>

            <Divider />

            {/* Editable: Description */}
            <TextField
              label={t('featureFlags.description')}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              multiline
              rows={3}
              fullWidth
            />

            {/* Editable: Tags */}
            <TagSelector
              value={editTagSelection}
              onChange={(tags) => {
                setEditTagSelection(tags);
              }}
            />
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
            bgcolor: 'background.paper',
          }}
        >
          <Button onClick={() => setEditDrawerOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleEditSave}
            disabled={
              editDescription === (editingField?.description || '') &&
              JSON.stringify(editTagSelection.map((t) => t.name)) ===
                JSON.stringify(editingField?.tags || [])
            }
          >
            {t('common.save')}
          </Button>
        </Box>
      </ResizableDrawer>

      {/* Delete Confirm */}
      <ConfirmDeleteDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteConfirm}
        title={t('common.confirmDelete')}
        message={t('contextFieldUsage.deleteConfirmMessage', {
          name: deletingField?.fieldName || '',
        })}
      />

      {/* Column Settings */}
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

export default DiscoveredContextFieldsTab;
