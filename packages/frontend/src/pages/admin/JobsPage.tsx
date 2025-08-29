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
  Tab
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
import { Job, JobType, JobExecution, JobExecutionStatus } from '../../types/job';
import { formatDateTimeDetailed } from '../../utils/dateFormat';
import JobForm from '../../components/jobs/JobForm';
import JobExecutionHistory from '../../components/jobs/JobExecutionHistory';

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

  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [selectedJobForHistory, setSelectedJobForHistory] = useState<Job | null>(null);
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [jobsData, jobTypesData] = await Promise.all([
        jobService.getJobs({
          job_type_id: selectedJobType || undefined,
          is_enabled: enabledFilter !== '' ? enabledFilter : undefined,
          search: searchTerm || undefined
        }),
        jobService.getJobTypes()
      ]);
      setJobs(jobsData);
      setJobTypes(jobTypesData);
    } catch (error) {
      console.error('Failed to load data:', error);
      enqueueSnackbar(t('jobs.errors.loadFailed'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Handlers
  const handleSearch = () => {
    loadData();
  };

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
      enqueueSnackbar(t('jobs.errors.executeFailed'), { variant: 'error' });
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
      enqueueSnackbar(t('jobs.errors.deleteFailed'), { variant: 'error' });
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
        enqueueSnackbar(t('jobs.errors.nameAlreadyExists'), { variant: 'error' });
      } else {
        enqueueSnackbar(t('jobs.errors.saveFailed'), { variant: 'error' });
      }
    }
  };

  const getStatusChip = (job: Job) => {
    if (!job.is_enabled) {
      return <Chip label={t('common.disabled')} color="default" size="small" />;
    }
    return <Chip label={t('common.enabled')} color="success" size="small" />;
  };

  const getJobTypeLabel = (jobTypeId: number) => {
    const jobType = jobTypes.find(jt => jt.id === jobTypeId);
    return jobType?.display_name || jobType?.name || 'Unknown';
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
            <Grid item xs={12} md={4}>
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
            <Grid item xs={12} md={3}>
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
                      {jobType.display_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel shrink={true}>{t('common.status')}</InputLabel>
                <Select
                  value={enabledFilter}
                  onChange={(e) => setEnabledFilter(e.target.value as boolean | '')}
                  label={t('common.status')}
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
                  <MenuItem value={true}>{t('common.enabled')}</MenuItem>
                  <MenuItem value={false}>{t('common.disabled')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>

          </Grid>
        </CardContent>
      </Card>

      {/* Jobs Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('common.name')}</TableCell>
              <TableCell>{t('jobs.jobType')}</TableCell>
              <TableCell>{t('common.status')}</TableCell>
              <TableCell>{t('jobs.retryCount')}</TableCell>
              <TableCell>{t('jobs.timeout')}</TableCell>
              <TableCell>{t('common.updatedAt')}</TableCell>
              <TableCell align="right">{t('common.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                  <Typography variant="body1" color="text.secondary">
                    {t('jobs.noJobsFound')}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => (
                <TableRow key={job.id}>
                <TableCell>
                  <Box>
                    <Typography variant="body2" fontWeight="medium">
                      {job.name}
                    </Typography>
                    {job.description && (
                      <Typography variant="caption" color="text.secondary">
                        {job.description}
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>{getJobTypeLabel(job.job_type_id)}</TableCell>
                <TableCell>{getStatusChip(job)}</TableCell>
                <TableCell>{job.retry_count} / {job.max_retry_count}</TableCell>
                <TableCell>{job.timeout_seconds}s</TableCell>
                <TableCell>{formatDateTimeDetailed(job.updated_at)}</TableCell>
                <TableCell align="right">
                  <Tooltip title={t('jobs.execute')}>
                    <IconButton
                      size="small"
                      onClick={() => handleExecuteJob(job)}
                      disabled={!job.is_enabled}
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
