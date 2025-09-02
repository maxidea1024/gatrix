import React, { useState, useEffect, useCallback } from 'react';
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
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  LinearProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as ExecuteIcon,
  History as HistoryIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { jobService } from '../../services/jobService';
import { Job, JobType, JobExecution, JobExecutionStatus, JobListResponse } from '../../types/job';
import { formatDateTimeDetailed } from '../../utils/dateFormat';
import JobForm from '../../components/jobs/JobForm';
import JobExecutionHistory from '../../components/jobs/JobExecutionHistory';
import SimplePagination from '../../components/common/SimplePagination';
import EmptyTableRow from '../../components/common/EmptyTableRow';

const JobsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // State
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJobType, setSelectedJobType] = useState<number | ''>('');
  const [enabledFilter, setEnabledFilter] = useState<boolean | ''>('');
  const [tabValue, setTabValue] = useState(0);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);

  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [selectedJobForHistory, setSelectedJobForHistory] = useState<Job | null>(null);
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [jobsResponse, jobTypesData] = await Promise.all([
        jobService.getJobsWithPagination({
          jobTypeId: selectedJobType || undefined,
          isEnabled: enabledFilter !== '' ? enabledFilter : undefined,
          search: searchTerm || undefined,
          limit: rowsPerPage,
          offset: page * rowsPerPage
        }),
        jobService.getJobTypes()
      ]);

      setJobs(jobsResponse.jobs);
      setTotal(jobsResponse.pagination.total);
      setJobTypes(jobTypesData);
    } catch (error) {
      console.error('Failed to load data:', error);
      enqueueSnackbar('작업 목록을 불러오는데 실패했습니다.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [selectedJobType, enabledFilter, searchTerm, page, rowsPerPage]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [selectedJobType, enabledFilter, searchTerm]);

  // Load data
  useEffect(() => {
    console.log('JobsPage useEffect - loading data');
    loadData();
  }, [loadData]);

  // Handlers
  const handleSearch = () => {
    setPage(0); // Reset to first page
    // loadData will be called automatically by useEffect
  };

  const handleReset = () => {
    setSearchTerm('');
    setSelectedJobType('');
    setEnabledFilter('');
    setPage(0); // Reset to first page
    // loadData will be called automatically by useEffect
  };

  // 페이지 변경 핸들러
  const handlePageChange = useCallback((_: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  // 페이지 크기 변경 핸들러
  const handleRowsPerPageChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
  }, []);

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
      enqueueSnackbar(t('jobs.executeStarted', { name: job.name, executionId: result.executionId }), { 
        variant: 'success' 
      });
    } catch (error) {
      console.error('Failed to execute job:', error);
      enqueueSnackbar('작업 실행에 실패했습니다.', { variant: 'error' });
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
      enqueueSnackbar(t('jobs.deleted', { name: jobToDelete.name }), { variant: 'success' });
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
        enqueueSnackbar(t('jobs.updated', { name: data.name }), { variant: 'success' });
      } else {
        await jobService.createJob(data);
        enqueueSnackbar(t('jobs.created', { name: data.name }), { variant: 'success' });
      }
      setFormDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Failed to save job:', error);

      // 409 에러 (이름 중복) 처리
      const status = error?.status || error?.response?.status;
      if (status === 409) {
        enqueueSnackbar('이미 존재하는 작업 이름입니다.', { variant: 'error' });
      } else {
        enqueueSnackbar('작업 저장에 실패했습니다.', { variant: 'error' });
      }
    }
  };

  const getStatusChip = (job: Job) => {
    if (!job.isEnabled) {
      return <Chip label={t('common.unavailable')} color="default" size="small" />;
    }
    return <Chip label={t('common.usable')} color="success" size="small" />;
  };

  const getJobTypeLabel = (jobTypeId: number) => {
    const jobType = jobTypes.find(jt => jt.id === jobTypeId);
    return jobType?.displayName || jobType?.name || 'Unknown';
  };

  // 텍스트 길이 제한 함수
  const truncateText = (text: string | null | undefined, maxLength: number = 50) => {
    if (!text) return '-';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{t('jobs.title')}</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddJob}
        >
          {t('jobs.addJob')}
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label={t('common.search')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                InputProps={{
                  endAdornment: (
                    <IconButton onClick={handleSearch}>
                      <SearchIcon />
                    </IconButton>
                  )
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel shrink={true}>{t('jobs.jobType')}</InputLabel>
                <Select
                  value={selectedJobType}
                  onChange={(e) => setSelectedJobType(e.target.value as number | '')}
                  label={t('jobs.jobType')}
                  displayEmpty
                  sx={{
                    minWidth: 120,
                    '& .MuiSelect-select': {
                      overflow: 'visible',
                      textOverflow: 'clip',
                      whiteSpace: 'nowrap',
                    },
                  }}
                >
                  <MenuItem value="">{t('common.all')}</MenuItem>
                  {jobTypes.map((jobType) => (
                    <MenuItem key={jobType.id} value={jobType.id}>
                      {jobType.displayName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel shrink={true}>{t('common.usable')}</InputLabel>
                <Select
                  value={enabledFilter}
                  onChange={(e) => setEnabledFilter(e.target.value as boolean | '')}
                  label={t('common.usable')}
                  displayEmpty
                  sx={{
                    minWidth: 120,
                    '& .MuiSelect-select': {
                      overflow: 'visible',
                      textOverflow: 'clip',
                      whiteSpace: 'nowrap',
                    },
                  }}
                >
                  <MenuItem value="">{t('common.all')}</MenuItem>
                  <MenuItem value={true}>{t('common.usable')}</MenuItem>
                  <MenuItem value={false}>{t('common.unavailable')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>

          </Grid>
        </CardContent>
      </Card>

      {/* Jobs Table */}
      <TableContainer
        component={Paper}
        sx={{
          maxWidth: '100%',
          overflow: 'auto'
        }}
      >
        {loading && <LinearProgress />}
        <Table sx={{ tableLayout: 'fixed', minWidth: 1100 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '150px' }}>{t('common.name')}</TableCell>
              <TableCell sx={{ width: '200px' }}>{t('common.memo')}</TableCell>
              <TableCell sx={{ width: '120px' }}>{t('jobs.jobType')}</TableCell>
              <TableCell sx={{ width: '80px' }}>{t('common.usable')}</TableCell>
              <TableCell sx={{ width: '150px' }}>{t('common.tags')}</TableCell>
              <TableCell sx={{ width: '120px' }}>{t('common.createdBy')}</TableCell>
              <TableCell sx={{ width: '140px' }}>{t('common.createdAt')}</TableCell>
              <TableCell align="right" sx={{ width: '140px' }}>{t('common.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {jobs.length === 0 ? (
              <EmptyTableRow
                colSpan={8}
                loading={loading}
                message="등록된 작업이 없습니다."
              />
            ) : (
              jobs.map((job) => (
                <TableRow key={job.id}>
                <TableCell>
                  {job.name && job.name.length > 30 ? (
                    <Tooltip title={job.name} arrow>
                      <Typography
                        variant="body2"
                        fontWeight="medium"
                        sx={{
                          cursor: 'help',
                          maxWidth: '150px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {truncateText(job.name, 30)}
                      </Typography>
                    </Tooltip>
                  ) : (
                    <Typography variant="body2" fontWeight="medium">
                      {job.name}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  {job.memo && job.memo.length > 50 ? (
                    <Tooltip title={job.memo} arrow>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          cursor: 'help',
                          maxWidth: '200px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {truncateText(job.memo, 50)}
                      </Typography>
                    </Tooltip>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {job.memo || '-'}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {(() => {
                      const jobTypeLabel = getJobTypeLabel(job.jobTypeId);
                      return jobTypeLabel && jobTypeLabel.length > 20 ? (
                        <Tooltip title={jobTypeLabel} arrow>
                          <Typography
                            variant="body2"
                            sx={{
                              cursor: 'help',
                              maxWidth: '120px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {truncateText(jobTypeLabel, 20)}
                          </Typography>
                        </Tooltip>
                      ) : (
                        <Typography variant="body2">
                          {jobTypeLabel}
                        </Typography>
                      );
                    })()}
                  </Box>
                </TableCell>
                <TableCell>{getStatusChip(job)}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {job.tags && job.tags.length > 0 ? (
                      job.tags.map((tag) => (
                        <Tooltip key={tag.id} title={tag.description || tag.name}>
                          <Chip
                            label={tag.name}
                            size="small"
                            style={{
                              backgroundColor: tag.color,
                              color: '#fff',
                              fontSize: '0.75rem'
                            }}
                          />
                        </Tooltip>
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        -
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  {job.createdByName ? (
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {job.createdByName}
                      </Typography>
                      {job.createdByEmail && (
                        <Typography variant="caption" color="text.secondary">
                          {job.createdByEmail}
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      -
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {formatDateTimeDetailed(job.createdAt)}
                  </Typography>
                </TableCell>
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
                    <IconButton size="small" onClick={() => handleViewHistory(job)}>
                      <HistoryIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('common.edit')}>
                    <IconButton size="small" onClick={() => handleEditJob(job)}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('common.delete')}>
                    <IconButton size="small" onClick={() => handleDeleteJob(job)}>
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* 페이지네이션 */}
        <SimplePagination
          count={total}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={handlePageChange}
          onRowsPerPageChange={handleRowsPerPageChange}
        />
      </TableContainer>

      {/* Job Form Dialog */}
      <Dialog open={formDialogOpen} onClose={() => setFormDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingJob ? t('jobs.editJob') : t('jobs.addJob')}
        </DialogTitle>
        <DialogContent>
          <JobForm
            job={editingJob}
            jobTypes={jobTypes}
            onSubmit={handleFormSubmit}
            onCancel={() => setFormDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Job History Dialog */}
      <Dialog open={historyDialogOpen} onClose={() => setHistoryDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          {t('jobs.executionHistory')} - {selectedJobForHistory?.name}
        </DialogTitle>
        <DialogContent>
          {selectedJobForHistory && (
            <JobExecutionHistory jobId={selectedJobForHistory.id} />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDialogOpen(false)}>
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('common.confirmDelete')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('jobs.confirmDeleteMessage', { name: jobToDelete?.name })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default JobsPage;
