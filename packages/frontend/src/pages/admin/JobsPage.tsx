import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { P } from '@/types/permissions';
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
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  Drawer,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  PlayArrow as ExecuteIcon,
  History as HistoryIcon,
  Work as WorkIcon,
  ViewColumn as ViewColumnIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useDebounce } from '../../hooks/useDebounce';
import { jobService } from '../../services/jobService';
import { tagService, Tag } from '../../services/tagService';
import {
  Job,
  JobType,
  JobExecution,
  JobExecutionStatus,
  JobListResponse,
} from '../../types/job';
import { formatDateTimeDetailed } from '../../utils/dateFormat';
import JobForm from '../../components/jobs/JobForm';
import JobExecutionHistory from '../../components/jobs/JobExecutionHistory';
import SimplePagination from '../../components/common/SimplePagination';
import TagChips from '../../components/common/TagChips';
import EmptyPagePlaceholder from '../../components/common/EmptyPagePlaceholder';
import PageContentLoader from '@/components/common/PageContentLoader';
import ColumnSettingsDialog, {
  ColumnConfig,
} from '../../components/common/ColumnSettingsDialog';
import DynamicFilterBar, {
  FilterDefinition,
  ActiveFilter,
} from '../../components/common/DynamicFilterBar';
import SearchTextField from '../../components/common/SearchTextField';
import PageHeader from '@/components/common/PageHeader';

// Default column configuration
const defaultColumns: ColumnConfig[] = [
  { id: 'jobName', labelKey: 'jobs.jobName', visible: true },
  { id: 'jobType', labelKey: 'jobs.jobType', visible: true },
  { id: 'schedule', labelKey: 'jobs.schedule', visible: true },
  { id: 'lastExecution', labelKey: 'jobs.lastExecution', visible: true },
  { id: 'nextExecution', labelKey: 'jobs.nextExecution', visible: true },
  { id: 'isEnabled', labelKey: 'jobs.isEnabled', visible: true },
  { id: 'tags', labelKey: 'common.tags', visible: true },
];

const JobsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
  const { hasPermission } = useAuth();
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();
  const canManage = hasPermission([P.SCHEDULER_UPDATE]);

  // Column settings state
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('jobsColumns');
    if (saved) {
      try {
        const savedColumns = JSON.parse(saved);
        const mergedColumns = savedColumns.map((savedCol: ColumnConfig) => {
          const defaultCol = defaultColumns.find((c) => c.id === savedCol.id);
          return defaultCol ? { ...defaultCol, ...savedCol } : savedCol;
        });
        const savedIds = new Set(savedColumns.map((c: ColumnConfig) => c.id));
        const newColumns = defaultColumns.filter((c) => !savedIds.has(c.id));
        return [...mergedColumns, ...newColumns];
      } catch (e) {
        return defaultColumns;
      }
    }
    return defaultColumns;
  });

  const [columnSettingsAnchor, setColumnSettingsAnchor] =
    useState<HTMLButtonElement | null>(null);

  // State
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Dynamic filters
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);

  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [selectedJobForHistory, setSelectedJobForHistory] =
    useState<Job | null>(null);
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);

  // Column handlers
  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    setColumns(newColumns);
    localStorage.setItem('jobsColumns', JSON.stringify(newColumns));
  };

  const handleResetColumns = () => {
    setColumns(defaultColumns);
    localStorage.removeItem('jobsColumns');
  };

  // Extract filter values from activeFilters
  const selectedJobType = useMemo(() => {
    const f = activeFilters.find((f) => f.key === 'jobType');
    return f?.value ?? '';
  }, [activeFilters]);

  const enabledFilter = useMemo(() => {
    const f = activeFilters.find((f) => f.key === 'isEnabled');
    return f?.value ?? '';
  }, [activeFilters]);

  const tagFilterIds = useMemo(() => {
    const f = activeFilters.find((f) => f.key === 'tags');
    return Array.isArray(f?.value) ? f.value : [];
  }, [activeFilters]);

  // Filter definitions for DynamicFilterBar
  const availableFilterDefinitions: FilterDefinition[] = useMemo(
    () => [
      {
        key: 'jobType',
        label: t('jobs.jobType'),
        type: 'select',
        options: jobTypes.map((jt) => ({
          value: jt.id,
          label: jt.displayName || jt.name,
        })),
      },
      {
        key: 'isEnabled',
        label: t('common.usable'),
        type: 'select',
        options: [
          { value: 'true', label: t('common.usable') },
          { value: 'false', label: t('common.unavailable') },
        ],
      },
      {
        key: 'tags',
        label: t('common.tags'),
        type: 'tags',
        operator: 'any_of',
        allowOperatorToggle: true,
        options: allTags.map((tag) => ({
          value: tag.id,
          label: tag.name,
          color: tag.color,
        })),
      },
    ],
    [t, jobTypes, allTags]
  );

  // Dynamic filter handlers
  const handleFilterAdd = (filter: ActiveFilter) => {
    setActiveFilters((prev) => [...prev, filter]);
  };

  const handleFilterRemove = (key: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.key !== key));
  };

  const handleDynamicFilterChange = (key: string, value: any) => {
    setActiveFilters((prev) =>
      prev.map((f) => (f.key === key ? { ...f, value } : f))
    );
  };

  const handleOperatorChange = (
    key: string,
    operator: 'any_of' | 'include_all'
  ) => {
    setActiveFilters((prev) =>
      prev.map((f) => (f.key === key ? { ...f, operator } : f))
    );
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [jobsResponse, jobTypesData] = await Promise.all([
        jobService.getJobsWithPagination({
          jobTypeId: selectedJobType || undefined,
          isEnabled:
            enabledFilter !== '' ? enabledFilter === 'true' : undefined,
          search: debouncedSearch || undefined,
          tags: tagFilterIds.length > 0 ? tagFilterIds.map(Number) : undefined,
          limit: rowsPerPage,
          offset: page * rowsPerPage,
        }),
        jobService.getJobTypes(),
      ]);

      setJobs(jobsResponse.jobs);
      setTotal(jobsResponse.pagination.total);
      setJobTypes(jobTypesData);
    } catch (error) {
      console.error('Failed to load data:', error);
      enqueueSnackbar(t('jobs.loadFailed'), {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [
    selectedJobType,
    enabledFilter,
    debouncedSearch,
    tagFilterIds,
    page,
    rowsPerPage,
  ]);

  // 태그 로딩
  const loadTags = useCallback(async () => {
    try {
      const tags = await tagService.list(projectApiPath);
      setAllTags(tags);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, activeFilters]);

  // Load data and tags
  useEffect(() => {
    loadData();
    loadTags();
  }, [loadData, loadTags]);

  // 페이지 변경 핸들러
  const handlePageChange = useCallback((_: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  // 페이지 크기 변경 핸들러
  const handleRowsPerPageChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newRowsPerPage = parseInt(event.target.value, 10);
      setRowsPerPage(newRowsPerPage);
      setPage(0);
    },
    []
  );

  const handleAddJob = () => {
    setEditingJob(null);
    setFormDialogOpen(true);
  };

  const handleEditJob = (job: Job) => {
    setEditingJob(job);
    setFormDialogOpen(true);
  };

  const handleDeleteJob = (job: Job) => {
    setJobToDelete(job);
    setDeleteDialogOpen(true);
  };

  const handleExecuteJob = async (job: Job) => {
    try {
      const result = await jobService.executeJob(job.id);
      enqueueSnackbar(
        t('jobs.executeStarted', {
          name: job.name,
          executionId: result.executionId,
        }),
        {
          variant: 'success',
        }
      );
    } catch (error) {
      console.error('Failed to execute job:', error);
      enqueueSnackbar(t('common.jobExecuteFailed'), { variant: 'error' });
    }
  };

  const handleViewHistory = (job: Job) => {
    setSelectedJobForHistory(job);
    setHistoryDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!jobToDelete) return;

    try {
      await jobService.deleteJob(jobToDelete.id);
      enqueueSnackbar(t('jobs.deleted', { name: jobToDelete.name }), {
        variant: 'success',
      });
      setDeleteDialogOpen(false);
      setJobToDelete(null);
      loadData();
    } catch (error) {
      console.error('Failed to delete job:', error);
      enqueueSnackbar('작업 삭제에 실패했습니다.', { variant: 'error' });
    }
  };

  const handleFormSubmit = async (data: any) => {
    try {
      if (editingJob) {
        await jobService.updateJob(editingJob.id, data);
        enqueueSnackbar(t('jobs.updated', { name: data.name }), {
          variant: 'success',
        });
      } else {
        await jobService.createJob(data);
        enqueueSnackbar(t('jobs.created', { name: data.name }), {
          variant: 'success',
        });
      }
      setFormDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Failed to save job:', error);

      // 409 에러 (이름 중복) 처리
      const status = error?.status || error?.response?.status;
      if (status === 409) {
        enqueueSnackbar(t('common.jobNameDuplicate'), { variant: 'error' });
      } else {
        enqueueSnackbar(t('common.jobSaveFailed'), { variant: 'error' });
      }
    }
  };

  const getStatusChip = (job: Job) => {
    if (!job.isEnabled) {
      return (
        <Chip label={t('common.unavailable')} color="default" size="small" />
      );
    }
    return <Chip label={t('common.usable')} color="success" size="small" />;
  };

  const getJobTypeLabel = (jobTypeId: number) => {
    const jobType = jobTypes.find((jt) => jt.id === jobTypeId);
    return jobType?.displayName || jobType?.name || 'Unknown';
  };

  // 텍스트 길이 제한 함수
  const truncateText = (
    text: string | null | undefined,
    maxLength: number = 50
  ) => {
    if (!text) return '-';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Render cell content based on column ID
  const renderCellContent = (job: Job, columnId: string) => {
    switch (columnId) {
      case 'jobName':
        return (
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {truncateText(job.name, 30)}
          </Typography>
        );
      case 'jobType':
        return (
          <Chip
            label={getJobTypeLabel(job.jobTypeId)}
            size="small"
            color="primary"
            variant="outlined"
          />
        );
      case 'schedule':
        return (
          <Typography variant="body2">{job.cronExpression || '-'}</Typography>
        );
      case 'lastExecution':
        return (
          <Typography variant="body2">
            {job.lastExecutedAt
              ? formatDateTimeDetailed(job.lastExecutedAt)
              : '-'}
          </Typography>
        );
      case 'nextExecution':
        return (
          <Typography variant="body2">
            {job.nextExecutionAt
              ? formatDateTimeDetailed(job.nextExecutionAt)
              : '-'}
          </Typography>
        );
      case 'isEnabled':
        return getStatusChip(job);
      case 'tags':
        return <TagChips tags={job.tags} />;
      default:
        return null;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        icon={<WorkIcon />}
        title={t('jobs.title')}
        subtitle={t('jobs.description')}
        actions={
          canManage ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddJob}
            >
              {t('jobs.addJob')}
            </Button>
          ) : undefined
        }
      />

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              flexWrap: 'wrap',
              justifyContent: 'space-between',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                alignItems: 'center',
                flexWrap: 'wrap',
                flexGrow: 1,
              }}
            >
              <SearchTextField
                placeholder={t('common.search')}
                value={searchTerm}
                onChange={setSearchTerm}
              />

              {/* Dynamic Filter Bar */}
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 1,
                  alignItems: 'center',
                }}
              >
                <DynamicFilterBar
                  availableFilters={availableFilterDefinitions}
                  activeFilters={activeFilters}
                  onFilterAdd={handleFilterAdd}
                  onFilterRemove={handleFilterRemove}
                  onFilterChange={handleDynamicFilterChange}
                  onOperatorChange={handleOperatorChange}
                  onRefresh={loadData}
                />

                {/* Column Settings Button */}
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
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Jobs Table */}
      <PageContentLoader loading={loading}>
        {jobs.length === 0 ? (
          <EmptyPagePlaceholder
            message={t('jobs.noJobsFound')}
            subtitle={canManage ? t('common.addFirstItem') : undefined}
            onAddClick={canManage ? handleAddJob : undefined}
            addButtonLabel={t('jobs.addJob')}
          />
        ) : (
          <TableContainer
            component={Paper}
            sx={{
              maxWidth: '100%',
              overflow: 'auto',
            }}
          >
            <Table sx={{ tableLayout: 'auto' }}>
              <TableHead>
                <TableRow>
                  {columns
                    .filter((col) => col.visible)
                    .map((column) => (
                      <TableCell key={column.id}>
                        {t(column.labelKey)}
                      </TableCell>
                    ))}
                  {canManage && (
                    <TableCell align="right" sx={{ width: 150 }}>
                      {t('common.actions')}
                    </TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {jobs.map((job, index) => (
                  <TableRow
                    hover
                    key={job.id}
                    sx={{
                      bgcolor:
                        index % 2 === 0
                          ? theme.palette.mode === 'dark'
                            ? 'rgba(255, 255, 255, 0.02)'
                            : 'rgba(0, 0, 0, 0.02)'
                          : 'transparent',
                    }}
                  >
                    {columns
                      .filter((col) => col.visible)
                      .map((column) => (
                        <TableCell key={column.id}>
                          {renderCellContent(job, column.id)}
                        </TableCell>
                      ))}
                    {canManage && (
                      <TableCell align="right">
                        <Tooltip title={t('jobs.execute')}>
                          <IconButton
                            size="small"
                            onClick={() => handleExecuteJob(job)}
                            disabled={!job.isEnabled}
                          >
                            <ExecuteIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('jobs.viewHistory')}>
                          <IconButton
                            size="small"
                            onClick={() => handleViewHistory(job)}
                          >
                            <HistoryIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('common.edit')}>
                          <IconButton
                            size="small"
                            onClick={() => handleEditJob(job)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('common.delete')}>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteJob(job)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <SimplePagination
              count={total}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={handlePageChange}
              onRowsPerPageChange={handleRowsPerPageChange}
            />
          </TableContainer>
        )}
      </PageContentLoader>

      {/* Job Form Drawer */}
      <Drawer
        anchor="right"
        open={formDialogOpen}
        onClose={() => setFormDialogOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 700 },
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
        ModalProps={{
          keepMounted: false,
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {editingJob ? t('jobs.editJob') : t('jobs.addJob')}
          </Typography>
          <IconButton
            onClick={() => setFormDialogOpen(false)}
            size="small"
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <JobForm
            job={editingJob}
            jobTypes={jobTypes}
            onSubmit={handleFormSubmit}
            onCancel={() => setFormDialogOpen(false)}
            isDrawer={true}
          />
        </Box>
      </Drawer>

      {/* Job History Drawer */}
      <Drawer
        anchor="right"
        open={historyDialogOpen}
        onClose={() => setHistoryDialogOpen(false)}
        sx={{
          zIndex: 1301,
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 800 },
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {t('jobs.executionHistory')} - {selectedJobForHistory?.name}
          </Typography>
          <IconButton
            onClick={() => setHistoryDialogOpen(false)}
            size="small"
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {selectedJobForHistory && (
            <JobExecutionHistory jobId={selectedJobForHistory.id} />
          )}
        </Box>

        {/* Footer */}
        <Box
          sx={{
            p: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'flex',
            gap: 2,
            justifyContent: 'flex-end',
          }}
        >
          <Button
            onClick={() => setHistoryDialogOpen(false)}
            variant="outlined"
          >
            {t('common.close')}
          </Button>
        </Box>
      </Drawer>

      {/* Delete Confirmation Drawer */}
      <Drawer
        anchor="right"
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        sx={{
          zIndex: 1301,
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 400 },
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {t('common.confirmDelete')}
          </Typography>
          <IconButton
            onClick={() => setDeleteDialogOpen(false)}
            size="small"
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, p: 2 }}>
          <Typography>
            {t('jobs.confirmDeleteMessage', { name: jobToDelete?.name })}
          </Typography>
        </Box>

        {/* Footer */}
        <Box
          sx={{
            p: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'flex',
            gap: 2,
            justifyContent: 'flex-end',
          }}
        >
          <Button onClick={() => setDeleteDialogOpen(false)} variant="outlined">
            {t('common.cancel')}
          </Button>
          <Button
            onClick={confirmDelete}
            color="error"
            variant="contained"
            startIcon={<DeleteIcon />}
          >
            {t('common.delete')}
          </Button>
        </Box>
      </Drawer>

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

export default JobsPage;
