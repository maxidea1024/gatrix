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
  Popover,
  ClickAwayListener,
  List,
  Skeleton,
} from '@mui/material';
import {
  Poll as PollIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  ViewColumn as ViewColumnIcon,
  DragIndicator as DragIndicatorIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import surveyService, { Survey } from '../../services/surveyService';
import SimplePagination from '../../components/common/SimplePagination';
import EmptyTableRow from '../../components/common/EmptyTableRow';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDateTimeDetailed } from '../../utils/dateFormat';
import SurveyFormDialog from '../../components/game/SurveyFormDialog';
import SurveyConfigDialog from '../../components/game/SurveyConfigDialog';
import DynamicFilterBar, { FilterDefinition, ActiveFilter } from '../../components/common/DynamicFilterBar';

// Column definition interface
interface ColumnConfig {
  id: string;
  labelKey: string;
  visible: boolean;
  width?: string;
}

// Sortable column item component
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
    <Box
      ref={setNodeRef}
      style={style}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 0.5,
        px: 1,
        borderRadius: 1,
        '&:hover': {
          bgcolor: 'action.hover',
        },
      }}
    >
      <Box {...attributes} {...listeners} sx={{ display: 'flex', cursor: 'grab', '&:active': { cursor: 'grabbing' } }}>
        <DragIndicatorIcon fontSize="small" sx={{ color: 'text.secondary' }} />
      </Box>
      <Checkbox
        checked={column.visible}
        onChange={() => onToggleVisibility(column.id)}
        size="small"
      />
      <Typography variant="body2" sx={{ flex: 1 }}>
        {t(column.labelKey)}
      </Typography>
    </Box>
  );
};

const SurveysPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // State
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [columnSettingsAnchor, setColumnSettingsAnchor] = useState<null | HTMLElement>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Column configuration
  const [columns, setColumns] = useState<ColumnConfig[]>([
    { id: 'checkbox', labelKey: '', visible: true },
    { id: 'platformSurveyId', labelKey: 'surveys.platformSurveyId', visible: true },
    { id: 'surveyTitle', labelKey: 'surveys.surveyTitle', visible: true },
    { id: 'triggerConditions', labelKey: 'surveys.triggerConditions', visible: true },
    { id: 'status', labelKey: 'surveys.status', visible: true },
    { id: 'createdAt', labelKey: 'surveys.createdAt', visible: true },
    { id: 'actions', labelKey: 'common.actions', visible: true },
  ]);

  // DnD sensors for column reordering
  const columnSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Extract filter values from activeFilters
  const isActiveFilter = useMemo(() => {
    const filter = activeFilters.find(f => f.key === 'isActive');
    return filter?.value;
  }, [activeFilters]);

  const isActiveFilterString = useMemo(() => JSON.stringify(isActiveFilter), [isActiveFilter]);

  // Filter definitions
  const availableFilterDefinitions: FilterDefinition[] = [
    {
      key: 'isActive',
      label: t('surveys.status'),
      type: 'select',
      options: [
        { value: 'true', label: t('common.active') },
        { value: 'false', label: t('common.inactive') },
      ],
    },
  ];

  // Load surveys
  const loadSurveys = async () => {
    setLoading(true);
    try {
      const filters: any = {
        search: debouncedSearchTerm || undefined,
      };

      // Apply active filters
      if (isActiveFilter !== undefined && isActiveFilter !== '') {
        filters.isActive = isActiveFilter === 'true';
      }

      const result = await surveyService.getSurveys({
        page: page + 1,
        limit: rowsPerPage,
        ...filters,
      });

      if (result && result.surveys) {
        setSurveys(result.surveys);
        setTotal(result.total || 0);
      } else {
        console.error('Invalid survey response:', result);
        setSurveys([]);
        setTotal(0);
      }
    } catch (error: any) {
      console.error('Failed to load surveys:', error);
      enqueueSnackbar(error.message || t('surveys.loadFailed'), { variant: 'error' });
      setSurveys([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  useEffect(() => {
    loadSurveys();
  }, [page, rowsPerPage, debouncedSearchTerm, isActiveFilterString]);

  // Filter handlers
  const handleFilterAdd = (filter: ActiveFilter) => {
    setActiveFilters([...activeFilters, filter]);
  };

  const handleFilterRemove = (filterKey: string) => {
    setActiveFilters(activeFilters.filter(f => f.key !== filterKey));
  };

  const handleDynamicFilterChange = (filterKey: string, value: any) => {
    setActiveFilters(activeFilters.map(f =>
      f.key === filterKey ? { ...f, value } : f
    ));
  };

  const handleOperatorChange = (filterKey: string, operator: 'any_of' | 'include_all') => {
    setActiveFilters(activeFilters.map(f =>
      f.key === filterKey ? { ...f, operator } : f
    ));
  };

  // Column handlers
  const handleToggleColumnVisibility = (columnId: string) => {
    setColumns(columns.map(col =>
      col.id === columnId ? { ...col, visible: !col.visible } : col
    ));
  };

  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setColumns((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleResetColumns = () => {
    setColumns([
      { id: 'checkbox', labelKey: '', visible: true },
      { id: 'platformSurveyId', labelKey: 'surveys.platformSurveyId', visible: true },
      { id: 'surveyTitle', labelKey: 'surveys.surveyTitle', visible: true },
      { id: 'triggerConditions', labelKey: 'surveys.triggerConditions', visible: true },
      { id: 'status', labelKey: 'surveys.status', visible: true },
      { id: 'createdAt', labelKey: 'surveys.createdAt', visible: true },
      { id: 'actions', labelKey: 'common.actions', visible: true },
    ]);
  };

  // Selection handlers
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(surveys.map(s => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // CRUD handlers
  const handleCreate = () => {
    setEditingSurvey(null);
    setFormDrawerOpen(true);
  };

  const handleEdit = (survey: Survey) => {
    setEditingSurvey(survey);
    setFormDrawerOpen(true);
  };

  const handleDelete = async (survey: Survey) => {
    if (!window.confirm(t('surveys.confirmDelete'))) {
      return;
    }

    try {
      await surveyService.deleteSurvey(survey.id);
      enqueueSnackbar(t('surveys.deleteSuccess'), { variant: 'success' });
      setSelectedIds([]);
      loadSurveys();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('surveys.deleteFailed'), { variant: 'error' });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    if (!window.confirm(t('surveys.confirmBulkDelete', { count: selectedIds.length }))) {
      return;
    }

    try {
      await Promise.all(selectedIds.map(id => surveyService.deleteSurvey(id)));
      enqueueSnackbar(t('surveys.bulkDeleteSuccess'), { variant: 'success' });
      setSelectedIds([]);
      loadSurveys();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('surveys.bulkDeleteFailed'), { variant: 'error' });
    }
  };

  const handleToggleActive = async (survey: Survey) => {
    try {
      await surveyService.toggleActive(survey.id);
      enqueueSnackbar(t('surveys.toggleSuccess'), { variant: 'success' });
      loadSurveys();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('surveys.toggleFailed'), { variant: 'error' });
    }
  };

  const handleConfigOpen = () => {
    setConfigDialogOpen(true);
  };

  // Visible columns
  const visibleColumns = columns.filter(col => col.visible);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PollIcon />
            {t('surveys.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('surveys.subtitle')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={handleConfigOpen}
          >
            {t('surveys.config')}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreate}
          >
            {t('surveys.createSurvey')}
          </Button>
        </Box>
      </Box>

      {/* Filter Panel */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Search Bar */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                placeholder={t('surveys.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                size="small"
              />
            </Box>

            {/* Bulk Actions and Filters */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {selectedIds.length > 0 && (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('common.selectedCount', { count: selectedIds.length })}
                  </Typography>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={handleBulkDelete}
                  >
                    {t('common.delete')}
                  </Button>
                </Box>
              )}

              {/* Dynamic Filter Bar with Column Settings and Refresh Button */}
              <DynamicFilterBar
                availableFilters={availableFilterDefinitions}
                activeFilters={activeFilters}
                onFilterAdd={handleFilterAdd}
                onFilterRemove={handleFilterRemove}
                onFilterChange={handleDynamicFilterChange}
                onOperatorChange={handleOperatorChange}
                onRefresh={loadSurveys}
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

      {/* Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {visibleColumns.map((column) => {
                    if (column.id === 'checkbox') {
                      return (
                        <TableCell key={column.id} padding="checkbox">
                          <Checkbox
                            indeterminate={selectedIds.length > 0 && selectedIds.length < surveys.length}
                            checked={surveys.length > 0 && selectedIds.length === surveys.length}
                            onChange={handleSelectAll}
                          />
                        </TableCell>
                      );
                    }
                    if (column.id === 'actions') {
                      return (
                        <TableCell key={column.id} align="center">
                          {t(column.labelKey)}
                        </TableCell>
                      );
                    }
                    return (
                      <TableCell key={column.id}>
                        {t(column.labelKey)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && isInitialLoad ? (
                  <EmptyTableRow
                    colSpan={visibleColumns.length}
                    loading={true}
                    message=""
                    loadingMessage={t('common.loadingData')}
                  />
                ) : surveys.length === 0 ? (
                  <EmptyTableRow
                    colSpan={visibleColumns.length}
                    loading={false}
                    message={t('surveys.noSurveysFound')}
                    loadingMessage=""
                  />
                ) : (
                  surveys.map((survey) => (
                    <TableRow
                      key={survey.id}
                      hover
                      selected={selectedIds.includes(survey.id)}
                    >
                      {visibleColumns.map((column) => {
                        if (column.id === 'checkbox') {
                          return (
                            <TableCell key={column.id} padding="checkbox">
                              <Checkbox
                                checked={selectedIds.includes(survey.id)}
                                onChange={() => handleSelectOne(survey.id)}
                              />
                            </TableCell>
                          );
                        }
                        if (column.id === 'platformSurveyId') {
                          return (
                            <TableCell key={column.id}>
                              {survey.platformSurveyId}
                            </TableCell>
                          );
                        }
                        if (column.id === 'surveyTitle') {
                          return (
                            <TableCell key={column.id}>
                              {survey.surveyTitle}
                            </TableCell>
                          );
                        }
                        if (column.id === 'triggerConditions') {
                          return (
                            <TableCell key={column.id}>
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {survey.triggerConditions.map((condition, idx) => (
                                  <Chip
                                    key={idx}
                                    label={`${t(`surveys.condition.${condition.type}`)}: ${condition.value}`}
                                    size="small"
                                  />
                                ))}
                              </Box>
                            </TableCell>
                          );
                        }
                        if (column.id === 'status') {
                          return (
                            <TableCell key={column.id}>
                              <Chip
                                label={survey.isActive ? t('common.active') : t('common.inactive')}
                                color={survey.isActive ? 'success' : 'default'}
                                size="small"
                              />
                            </TableCell>
                          );
                        }
                        if (column.id === 'createdAt') {
                          return (
                            <TableCell key={column.id}>
                              {formatDateTimeDetailed(survey.createdAt)}
                            </TableCell>
                          );
                        }
                        if (column.id === 'actions') {
                          return (
                            <TableCell key={column.id} align="center">
                              <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                <Tooltip title={t('common.edit')}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleEdit(survey)}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title={survey.isActive ? t('surveys.deactivate') : t('surveys.activate')}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleToggleActive(survey)}
                                  >
                                    <Chip
                                      label={survey.isActive ? t('common.active') : t('common.inactive')}
                                      color={survey.isActive ? 'success' : 'default'}
                                      size="small"
                                      sx={{ cursor: 'pointer' }}
                                    />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title={t('common.delete')}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDelete(survey)}
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
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          {!loading && surveys.length > 0 && (
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

      {/* Column Settings Popover */}
      <Popover
        open={Boolean(columnSettingsAnchor)}
        anchorEl={columnSettingsAnchor}
        onClose={() => setColumnSettingsAnchor(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        hideBackdrop
        disableScrollLock
      >
        <ClickAwayListener onClickAway={() => setColumnSettingsAnchor(null)}>
          <Box sx={{ p: 2, minWidth: 250 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2">{t('users.columnSettings')}</Typography>
              <Button size="small" onClick={handleResetColumns}>
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
                items={columns.map(c => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <List dense>
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

      {/* Form Drawer */}
      <SurveyFormDialog
        open={formDrawerOpen}
        onClose={() => setFormDrawerOpen(false)}
        onSuccess={loadSurveys}
        survey={editingSurvey}
      />

      {/* Config Dialog */}
      <SurveyConfigDialog
        open={configDialogOpen}
        onClose={() => setConfigDialogOpen(false)}
      />
    </Box>
  );
};

export default SurveysPage;

