import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { P } from '@/types/permissions';
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
  Tooltip,
  Checkbox,
  Skeleton,
  Divider,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Poll as PollIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Settings as SettingsIcon,
  ViewColumn as ViewColumnIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { parseApiErrorMessage } from '../../utils/errorUtils';
import surveyService, { Survey } from '../../services/surveyService';
import SimplePagination from '../../components/common/SimplePagination';
import SearchTextField from '../../components/common/SearchTextField';
import EmptyPagePlaceholder from '../../components/common/EmptyPagePlaceholder';
import ColumnSettingsDialog, {
  ColumnConfig,
} from '../../components/common/ColumnSettingsDialog';
import { useDebounce } from '../../hooks/useDebounce';
import { useGlobalPageSize } from '../../hooks/useGlobalPageSize';
import {
  formatDateTimeDetailed,
  formatRelativeTime,
} from '../../utils/dateFormat';
import SurveyFormDialog from '../../components/game/SurveyFormDialog';
import SurveyConfigDialog from '../../components/game/SurveyConfigDialog';
import DynamicFilterBar, {
  FilterDefinition,
  ActiveFilter,
} from '../../components/common/DynamicFilterBar';
import ConfirmDeleteDialog from '../../components/common/ConfirmDeleteDialog';
import RewardDisplay from '../../components/game/RewardDisplay';
import { showChangeRequestCreatedToast } from '../../utils/changeRequestToast';
import { useHandleApiError } from '../../hooks/useHandleApiError';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import PageContentLoader from '@/components/common/PageContentLoader';
import { exportToFile, ExportColumn } from '../../utils/exportImportUtils';
import ExportImportMenuItems from '../../components/common/ExportImportMenuItems';
import ImportDialog from '../../components/common/ImportDialog';
import PageHeader from '@/components/common/PageHeader';
import TagChips from '../../components/common/TagChips';

const SurveysPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManage = hasPermission([P.SURVEYS_UPDATE]);
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();

  // State
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useGlobalPageSize();
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [columnSettingsAnchor, setColumnSettingsAnchor] =
    useState<null | HTMLElement>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingSurvey, setDeletingSurvey] = useState<Survey | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [pageMenuAnchor, setPageMenuAnchor] = useState<HTMLElement | null>(
    null
  );
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Action menu state
  const [actionMenuAnchorEl, setActionMenuAnchorEl] =
    useState<null | HTMLElement>(null);
  const [actionMenuTarget, setActionMenuTarget] = useState<Survey | null>(null);

  const handleActionMenuOpen = (
    event: React.MouseEvent<HTMLElement>,
    survey: Survey
  ) => {
    setActionMenuAnchorEl(event.currentTarget);
    setActionMenuTarget(survey);
  };

  const handleActionMenuClose = () => {
    setActionMenuAnchorEl(null);
    setActionMenuTarget(null);
  };

  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const { handleApiError, ErrorDialog } = useHandleApiError();

  // Default columns for reset
  const defaultColumns: ColumnConfig[] = [
    { id: 'checkbox', labelKey: '', visible: true },
    {
      id: 'platformSurveyId',
      labelKey: 'surveys.platformSurveyId',
      visible: true,
    },
    { id: 'surveyTitle', labelKey: 'surveys.surveyTitle', visible: true },
    {
      id: 'triggerConditions',
      labelKey: 'surveys.triggerConditions',
      visible: true,
    },
    { id: 'rewards', labelKey: 'surveys.rewards', visible: true },
    { id: 'status', labelKey: 'surveys.status', visible: true },
    { id: 'tags', labelKey: 'common.tags', visible: true },
    { id: 'createdAt', labelKey: 'surveys.createdAt', visible: true },
    { id: 'actions', labelKey: 'common.actions', visible: true },
  ];

  // Column configuration (persisted in localStorage)
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('surveysColumns');
    if (saved) {
      try {
        const savedColumns = JSON.parse(saved);
        // Merge saved columns with defaults, preserving saved order
        const mergedColumns = savedColumns.map((savedCol: ColumnConfig) => {
          const defaultCol = defaultColumns.find((c) => c.id === savedCol.id);
          return defaultCol ? { ...defaultCol, ...savedCol } : savedCol;
        });
        // Add any new columns that weren't in saved state
        const savedIds = new Set(savedColumns.map((c: ColumnConfig) => c.id));
        const newColumns = defaultColumns.filter((c) => !savedIds.has(c.id));
        return [...mergedColumns, ...newColumns];
      } catch (e) {
        return defaultColumns;
      }
    }
    return defaultColumns;
  });

  // Extract filter values from activeFilters
  const conditionTypeFilter = useMemo(() => {
    const filter = activeFilters.find((f) => f.key === 'conditionType');
    return filter?.value;
  }, [activeFilters]);

  const conditionTypeFilterString = useMemo(
    () => JSON.stringify(conditionTypeFilter),
    [conditionTypeFilter]
  );

  // Filter definitions
  const availableFilterDefinitions: FilterDefinition[] = [
    {
      key: 'conditionType',
      label: t('surveys.conditionType'),
      type: 'multiselect',
      operator: 'any_of',
      allowOperatorToggle: false,
      options: [
        { value: 'userLevel', label: t('surveys.condition.userLevel') },
        { value: 'joinDays', label: t('surveys.condition.joinDays') },
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

      if (
        conditionTypeFilter &&
        Array.isArray(conditionTypeFilter) &&
        conditionTypeFilter.length > 0
      ) {
        filters.conditionType = conditionTypeFilter;
      }

      const result = await surveyService.getSurveys(projectApiPath, {
        page: page + 1,
        limit: rowsPerPage,
        ...filters,
      });

      // Check if result is valid
      if (
        result &&
        typeof result === 'object' &&
        'surveys' in result &&
        Array.isArray(result.surveys)
      ) {
        setSurveys(result.surveys);
        setTotal(result.total || 0);
      } else {
        console.error('Invalid survey response:', result);
        setSurveys([]);
        setTotal(0);
      }
    } catch (error: any) {
      console.error('Failed to load surveys:', error);
      enqueueSnackbar(parseApiErrorMessage(error, 'surveys.loadFailed'), {
        variant: 'error',
      });
      setSurveys([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  useEffect(() => {
    loadSurveys();
  }, [page, rowsPerPage, debouncedSearchTerm, conditionTypeFilterString]);

  // Filter handlers
  const handleFilterAdd = (filter: ActiveFilter) => {
    setActiveFilters([...activeFilters, filter]);
  };

  const handleFilterRemove = (filterKey: string) => {
    setActiveFilters(activeFilters.filter((f) => f.key !== filterKey));
  };

  const handleDynamicFilterChange = (filterKey: string, value: any) => {
    setActiveFilters(
      activeFilters.map((f) => (f.key === filterKey ? { ...f, value } : f))
    );
  };

  const handleOperatorChange = (
    filterKey: string,
    operator: 'any_of' | 'include_all'
  ) => {
    setActiveFilters(
      activeFilters.map((f) => (f.key === filterKey ? { ...f, operator } : f))
    );
  };

  // Column handlers
  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    // Merge with checkbox and actions columns
    const checkboxCol = columns.find((c) => c.id === 'checkbox');
    const actionsCol = columns.find((c) => c.id === 'actions');

    const updatedColumns = [checkboxCol!, ...newColumns, actionsCol!];

    setColumns(updatedColumns);
    localStorage.setItem('surveysColumns', JSON.stringify(updatedColumns));
  };

  const handleResetColumns = () => {
    setColumns(defaultColumns);
    localStorage.setItem('surveysColumns', JSON.stringify(defaultColumns));
  };

  // Selection handlers
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(surveys.map((s) => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
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

  const handleDelete = (survey: Survey) => {
    setDeletingSurvey(survey);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingSurvey) return;

    try {
      await surveyService.deleteSurvey(projectApiPath, deletingSurvey.id);
      enqueueSnackbar(t('surveys.deleteSuccess'), { variant: 'success' });
      setSelectedIds([]);
      loadSurveys();
    } catch (error: any) {
      handleApiError(error, 'surveys.deleteFailed');
    } finally {
      setDeleteConfirmOpen(false);
      setDeletingSurvey(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setDeletingSurvey(null);
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setBulkDeleteConfirmOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedIds.length === 0) return;

    try {
      await Promise.all(
        selectedIds.map((id) => surveyService.deleteSurvey(projectApiPath, id))
      );
      enqueueSnackbar(t('surveys.bulkDeleteSuccess'), { variant: 'success' });
      setSelectedIds([]);
      loadSurveys();
    } catch (error: any) {
      handleApiError(error, 'surveys.bulkDeleteFailed');
    } finally {
      setBulkDeleteConfirmOpen(false);
    }
  };

  const handleBulkDeleteCancel = () => {
    setBulkDeleteConfirmOpen(false);
  };

  const handleToggleActive = async (survey: Survey) => {
    try {
      const result = await surveyService.toggleActive(
        projectApiPath,
        survey.id
      );
      if (result.isChangeRequest) {
        showChangeRequestCreatedToast(enqueueSnackbar, closeSnackbar, navigate);
      } else {
        enqueueSnackbar(t('surveys.toggleSuccess'), { variant: 'success' });
        loadSurveys();
      }
    } catch (error: any) {
      handleApiError(error, 'surveys.toggleFailed');
    }
  };

  const handleConfigOpen = () => {
    setConfigDialogOpen(true);
  };

  // Visible columns
  const visibleColumns = columns.filter((col) => col.visible);

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        icon={<PollIcon />}
        title={t('surveys.title')}
        subtitle={t('surveys.subtitle')}
        actions={
          <>
            {canManage && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreate}
              >
                {t('surveys.createSurvey')}
              </Button>
            )}
            <IconButton
              onClick={(e) => setPageMenuAnchor(e.currentTarget)}
              aria-label="more options"
            >
              <MoreVertIcon />
            </IconButton>
            <Menu
              anchorEl={pageMenuAnchor}
              open={Boolean(pageMenuAnchor)}
              onClose={() => setPageMenuAnchor(null)}
            >
              <MenuItem
                onClick={() => {
                  setPageMenuAnchor(null);
                  handleConfigOpen();
                }}
              >
                <ListItemIcon>
                  <SettingsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>{t('surveys.config')}</ListItemText>
              </MenuItem>
              <Divider />
              <ExportImportMenuItems
                onExport={(format) => {
                  setPageMenuAnchor(null);
                  const exportColumns: ExportColumn[] = [
                    {
                      key: 'platformSurveyId',
                      header: t('surveys.platformSurveyId'),
                    },
                    { key: 'surveyTitle', header: t('surveys.surveyTitle') },
                    { key: 'isActive', header: t('common.status') },
                    { key: 'createdAt', header: t('common.createdAt') },
                  ];
                  try {
                    exportToFile(surveys, exportColumns, 'surveys', format);
                    enqueueSnackbar(t('common.exportSuccess'), {
                      variant: 'success',
                    });
                  } catch (err) {
                    enqueueSnackbar(t('common.exportFailed'), {
                      variant: 'error',
                    });
                  }
                }}
                onImportClick={() => {
                  setPageMenuAnchor(null);
                  setImportDialogOpen(true);
                }}
              />
            </Menu>
          </>
        }
      />

      {/* Filter Panel */}
      <Card sx={{ mb: 3 }}>
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
              <SearchTextField
                placeholder={t('surveys.searchPlaceholder')}
                value={searchTerm}
                onChange={setSearchTerm}
              />

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
      <PageContentLoader loading={loading && isInitialLoad}>
        {surveys.length === 0 ? (
          <EmptyPagePlaceholder
            message={t('surveys.noSurveysFound')}
            onAddClick={canManage ? handleCreate : undefined}
            addButtonLabel={t('surveys.createSurvey')}
            subtitle={canManage ? t('common.addFirstItem') : undefined}
          />
        ) : (
          <Card variant="outlined">
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
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
                                indeterminate={
                                  selectedIds.length > 0 &&
                                  selectedIds.length < surveys.length
                                }
                                checked={
                                  surveys.length > 0 &&
                                  selectedIds.length === surveys.length
                                }
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
                        return (
                          <TableCell key={column.id}>
                            {t(column.labelKey)}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {surveys.map((survey) => (
                      <TableRow
                        key={survey.id}
                        hover
                        selected={selectedIds.includes(survey.id)}
                      >
                        {visibleColumns.map((column) => {
                          if (column.id === 'checkbox') {
                            if (!canManage) return null;
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
                                <Typography
                                  sx={{
                                    cursor: 'pointer',
                                    '&:hover': {
                                      textDecoration: 'underline',
                                    },
                                  }}
                                  onClick={() => handleEdit(survey)}
                                >
                                  {survey.platformSurveyId}
                                </Typography>
                              </TableCell>
                            );
                          }
                          if (column.id === 'surveyTitle') {
                            return (
                              <TableCell key={column.id}>
                                <Typography
                                  sx={{
                                    cursor: 'pointer',
                                    '&:hover': {
                                      textDecoration: 'underline',
                                    },
                                  }}
                                  onClick={() => handleEdit(survey)}
                                >
                                  {survey.surveyTitle}
                                </Typography>
                              </TableCell>
                            );
                          }
                          if (column.id === 'triggerConditions') {
                            return (
                              <TableCell key={column.id}>
                                <Box
                                  sx={{
                                    display: 'flex',
                                    gap: 0.5,
                                    flexWrap: 'wrap',
                                    alignItems: 'center',
                                  }}
                                >
                                  {survey.triggerConditions.map(
                                    (condition, idx) => {
                                      // Format condition label with unit
                                      let label = '';
                                      if (condition.type === 'userLevel') {
                                        label = `${t('surveys.condition.userLevel')}: ${condition.value}${t('surveys.conditionUnit.levelOrMore')}`;
                                      } else if (
                                        condition.type === 'joinDays'
                                      ) {
                                        label = `${t('surveys.condition.joinDays')}: ${condition.value}${t('surveys.conditionUnit.daysOrMore')}`;
                                      } else {
                                        label = `${t(`surveys.condition.${condition.type}` as any)}: ${condition.value}`;
                                      }

                                      return (
                                        <React.Fragment key={idx}>
                                          <Chip label={label} size="small" />
                                          {idx <
                                            survey.triggerConditions.length -
                                              1 && (
                                            <Typography
                                              variant="caption"
                                              sx={{
                                                fontWeight: 600,
                                                color: 'primary.main',
                                                px: 0.5,
                                              }}
                                            >
                                              AND
                                            </Typography>
                                          )}
                                        </React.Fragment>
                                      );
                                    }
                                  )}
                                </Box>
                              </TableCell>
                            );
                          }
                          if (column.id === 'rewards') {
                            return (
                              <TableCell key={column.id}>
                                <RewardDisplay
                                  rewards={survey.participationRewards}
                                  rewardTemplateId={survey.rewardTemplateId}
                                  maxDisplay={2}
                                />
                              </TableCell>
                            );
                          }
                          if (column.id === 'status') {
                            return (
                              <TableCell key={column.id}>
                                <Chip
                                  label={
                                    survey.isActive
                                      ? t('common.active')
                                      : t('common.inactive')
                                  }
                                  color={
                                    survey.isActive ? 'success' : 'default'
                                  }
                                  size="small"
                                />
                              </TableCell>
                            );
                          }
                          if (column.id === 'tags') {
                            return (
                              <TableCell key={column.id}>
                                <TagChips
                                  tags={(survey as any).tags}
                                  maxVisible={6}
                                />
                              </TableCell>
                            );
                          }
                          if (column.id === 'createdAt') {
                            return (
                              <TableCell key={column.id}>
                                <Tooltip
                                  title={formatDateTimeDetailed(
                                    survey.createdAt
                                  )}
                                >
                                  <Typography variant="body2">
                                    {formatRelativeTime(survey.createdAt)}
                                  </Typography>
                                </Tooltip>
                              </TableCell>
                            );
                          }
                          if (column.id === 'actions') {
                            if (!canManage) return null;
                            return (
                              <TableCell key={column.id} align="center">
                                <IconButton
                                  size="small"
                                  onClick={(e) =>
                                    handleActionMenuOpen(e, survey)
                                  }
                                >
                                  <MoreVertIcon fontSize="small" />
                                </IconButton>
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
            </CardContent>
          </Card>
        )}
      </PageContentLoader>

      {/* Action Menu */}
      <Menu
        anchorEl={actionMenuAnchorEl}
        open={Boolean(actionMenuAnchorEl)}
        onClose={handleActionMenuClose}
      >
        <MenuItem
          onClick={() => {
            if (actionMenuTarget) handleEdit(actionMenuTarget);
            handleActionMenuClose();
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('common.edit')}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (actionMenuTarget) handleDelete(actionMenuTarget);
            handleActionMenuClose();
          }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>{t('common.delete')}</ListItemText>
        </MenuItem>
      </Menu>

      {/* Column Settings Dialog */}
      <ColumnSettingsDialog
        anchorEl={columnSettingsAnchor}
        onClose={() => setColumnSettingsAnchor(null)}
        columns={columns.filter(
          (col) => col.id !== 'checkbox' && col.id !== 'actions'
        )}
        onColumnsChange={handleColumnsChange}
        onReset={handleResetColumns}
      />

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

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={deleteConfirmOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={t('surveys.deleteConfirmTitle')}
        message={t('surveys.deleteConfirmMessage', {
          platformSurveyId: deletingSurvey?.platformSurveyId || '',
        })}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={bulkDeleteConfirmOpen}
        onClose={handleBulkDeleteCancel}
        onConfirm={handleBulkDeleteConfirm}
        title={t('surveys.bulkDeleteConfirmTitle')}
        message={t('surveys.bulkDeleteConfirmMessage', {
          count: selectedIds.length,
        })}
        warning={t('surveys.bulkDeleteWarning')}
      />
      <ErrorDialog />

      {/* Import Dialog */}
      <ImportDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        title={t('common.import')}
        onImport={async (data) => {
          let successCount = 0;
          let failCount = 0;
          for (const item of data) {
            try {
              await surveyService.createSurvey(projectApiPath, {
                platformSurveyId:
                  item[t('surveys.platformSurveyId')] ||
                  item.platformSurveyId ||
                  '',
                surveyTitle:
                  item[t('surveys.surveyTitle')] || item.surveyTitle || '',
                isActive:
                  String(item[t('common.status')] ?? item.isActive ?? true) ===
                  'true',
                triggerConditions: [],
                participationRewards: [],
              });
              successCount++;
            } catch (err) {
              failCount++;
            }
          }
          if (successCount > 0) {
            enqueueSnackbar(t('common.importSuccess'), { variant: 'success' });
            loadSurveys();
          }
          if (failCount > 0) {
            enqueueSnackbar(t('common.importFailed'), { variant: 'error' });
          }
        }}
      />
    </Box>
  );
};

export default SurveysPage;
