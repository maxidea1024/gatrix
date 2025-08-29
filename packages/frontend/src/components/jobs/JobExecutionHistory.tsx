import React, { useState, useEffect } from 'react';
import {
  Box,
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
  Typography,
  Collapse,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { jobService } from '../../services/jobService';
import { JobExecution, JobExecutionStatus } from '../../types/job';
import { formatDateTimeDetailed, formatDuration } from '../../utils/dateFormat';

interface JobExecutionHistoryProps {
  jobId: number;
}

const JobExecutionHistory: React.FC<JobExecutionHistoryProps> = ({ jobId }) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [executions, setExecutions] = useState<JobExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadExecutions();
  }, [jobId]);

  const loadExecutions = async () => {
    try {
      setLoading(true);
      const data = await jobService.getJobExecutions(jobId, { limit: 50 });
      setExecutions(data);
    } catch (error) {
      console.error('Failed to load job executions:', error);
      enqueueSnackbar(t('jobs.errors.loadExecutionsFailed'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const toggleRowExpansion = (executionId: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(executionId)) {
      newExpanded.delete(executionId);
    } else {
      newExpanded.add(executionId);
    }
    setExpandedRows(newExpanded);
  };

  const getStatusChip = (status: JobExecutionStatus) => {
    const statusConfig = {
      [JobExecutionStatus.PENDING]: { color: 'default' as const, label: t('jobs.status.pending') },
      [JobExecutionStatus.RUNNING]: { color: 'info' as const, label: t('jobs.status.running') },
      [JobExecutionStatus.COMPLETED]: { color: 'success' as const, label: t('jobs.status.completed') },
      [JobExecutionStatus.FAILED]: { color: 'error' as const, label: t('jobs.status.failed') },
      [JobExecutionStatus.TIMEOUT]: { color: 'warning' as const, label: t('jobs.status.timeout') },
      [JobExecutionStatus.CANCELLED]: { color: 'default' as const, label: t('jobs.status.cancelled') }
    };

    const config = statusConfig[status] || statusConfig[JobExecutionStatus.PENDING];
    return <Chip label={config.label} color={config.color} size="small" />;
  };

  const formatExecutionTime = (execution: JobExecution) => {
    if (!execution.started_at) return '-';
    
    if (execution.execution_time_ms) {
      return formatDuration(execution.execution_time_ms);
    }
    
    if (execution.completed_at) {
      const start = new Date(execution.started_at).getTime();
      const end = new Date(execution.completed_at).getTime();
      return formatDuration(end - start);
    }
    
    if (execution.status === JobExecutionStatus.RUNNING) {
      const start = new Date(execution.started_at).getTime();
      const now = Date.now();
      return formatDuration(now - start) + ' (running)';
    }
    
    return '-';
  };

  const renderExecutionDetails = (execution: JobExecution) => {
    return (
      <Box sx={{ p: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  {t('jobs.executionDetails')}
                </Typography>
                <Typography variant="body2">
                  <strong>{t('jobs.executionId')}:</strong> {execution.id}
                </Typography>
                <Typography variant="body2">
                  <strong>{t('jobs.retryAttempt')}:</strong> {execution.retry_attempt}
                </Typography>
                <Typography variant="body2">
                  <strong>{t('jobs.startedAt')}:</strong> {execution.started_at ? formatDateTimeDetailed(execution.started_at) : '-'}
                </Typography>
                <Typography variant="body2">
                  <strong>{t('jobs.completedAt')}:</strong> {execution.completed_at ? formatDateTimeDetailed(execution.completed_at) : '-'}
                </Typography>
                <Typography variant="body2">
                  <strong>{t('jobs.executionTime')}:</strong> {formatExecutionTime(execution)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          {execution.result && (
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>
                    {t('jobs.executionResult')}
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      fontSize: '0.75rem',
                      backgroundColor: 'grey.100',
                      p: 1,
                      borderRadius: 1,
                      overflow: 'auto',
                      maxHeight: 200
                    }}
                  >
                    {JSON.stringify(execution.result, null, 2)}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}
          
          {execution.error_message && (
            <Grid item xs={12}>
              <Alert severity="error">
                <Typography variant="subtitle2" gutterBottom>
                  {t('jobs.errorMessage')}
                </Typography>
                <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                  {execution.error_message}
                </Typography>
              </Alert>
            </Grid>
          )}
        </Grid>
      </Box>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (executions.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', p: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {t('jobs.noExecutions')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          {t('jobs.executionHistory')} ({executions.length})
        </Typography>
        <IconButton onClick={loadExecutions} size="small">
          <RefreshIcon />
        </IconButton>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width="40px"></TableCell>
              <TableCell>{t('jobs.status')}</TableCell>
              <TableCell>{t('jobs.startedAt')}</TableCell>
              <TableCell>{t('jobs.executionTime')}</TableCell>
              <TableCell>{t('jobs.retryAttempt')}</TableCell>
              <TableCell>{t('common.createdAt')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {executions.map((execution) => (
              <React.Fragment key={execution.id}>
                <TableRow hover>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => toggleRowExpansion(execution.id)}
                    >
                      {expandedRows.has(execution.id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </TableCell>
                  <TableCell>{getStatusChip(execution.status)}</TableCell>
                  <TableCell>
                    {execution.started_at ? formatDateTimeDetailed(execution.started_at) : '-'}
                  </TableCell>
                  <TableCell>{formatExecutionTime(execution)}</TableCell>
                  <TableCell>{execution.retry_attempt}</TableCell>
                  <TableCell>{formatDateTimeDetailed(execution.created_at)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={6} sx={{ p: 0, border: 0 }}>
                    <Collapse in={expandedRows.has(execution.id)} timeout="auto" unmountOnExit>
                      {renderExecutionDetails(execution)}
                    </Collapse>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default JobExecutionHistory;
