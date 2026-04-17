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
  Alert,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import PageContentLoader from '../common/PageContentLoader';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { jobService } from '../../services/jobService';
import { JobExecution, JobExecutionStatus } from '../../types/job';
import {
  formatDateTimeDetailed,
  formatDuration,
  formatRelativeTime,
} from '../../utils/dateFormat';

interface JobExecutionHistoryProps {
  jobId: number;
}

const JobExecutionHistory: React.FC<JobExecutionHistoryProps> = ({ jobId }) => {
  const { t, i18n } = useTranslation();
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
      enqueueSnackbar(t('jobs.errors.loadExecutionsFailed'), {
        variant: 'error',
      });
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
      [JobExecutionStatus.PENDING]: {
        color: 'default' as const,
        label: t('jobs.status.pending'),
      },
      [JobExecutionStatus.RUNNING]: {
        color: 'info' as const,
        label: t('jobs.status.running'),
      },
      [JobExecutionStatus.COMPLETED]: {
        color: 'success' as const,
        label: t('jobs.status.completed'),
      },
      [JobExecutionStatus.FAILED]: {
        color: 'error' as const,
        label: t('jobs.status.failed'),
      },
      [JobExecutionStatus.TIMEOUT]: {
        color: 'warning' as const,
        label: t('jobs.status.timeout'),
      },
      [JobExecutionStatus.CANCELLED]: {
        color: 'default' as const,
        label: t('jobs.status.cancelled'),
      },
    };

    const config =
      statusConfig[status] || statusConfig[JobExecutionStatus.PENDING];
    return <Chip label={config.label} color={config.color} size="small" />;
  };

  const formatExecutionTime = (execution: JobExecution) => {
    if (!execution.startedAt) return '-';

    if (execution.executionTimeMs) {
      return formatDuration(execution.executionTimeMs);
    }

    if (execution.completedAt) {
      const start = new Date(execution.startedAt).getTime();
      const end = new Date(execution.completedAt).getTime();
      return formatDuration(end - start);
    }

    if (execution.status === JobExecutionStatus.RUNNING) {
      const start = new Date(execution.startedAt).getTime();
      const now = Date.now();
      return formatDuration(now - start) + ' (running)';
    }

    return '-';
  };

  const renderExecutionDetails = (execution: JobExecution) => {
    return (
      <Box sx={{ p: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  {t('jobs.executionDetails')}
                </Typography>
                <Table
                  size="small"
                  sx={{ border: '1px solid', borderColor: 'divider' }}
                >
                  <TableBody>
                    <TableRow>
                      <TableCell
                        component="th"
                        scope="row"
                        sx={{ width: '120px', bgcolor: 'grey.50', py: 1 }}
                      >
                        {t('jobs.executionId')}
                      </TableCell>
                      <TableCell sx={{ py: 1 }}>{execution.id}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell
                        component="th"
                        scope="row"
                        sx={{ bgcolor: 'grey.50', py: 1 }}
                      >
                        {t('jobs.retryAttempt')}
                      </TableCell>
                      <TableCell sx={{ py: 1 }}>
                        {execution.retryAttempt > 0
                          ? execution.retryAttempt
                          : t('common.none')}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell
                        component="th"
                        scope="row"
                        sx={{ bgcolor: 'grey.50', py: 1 }}
                      >
                        {t('jobs.startedAt')}
                      </TableCell>
                      <TableCell sx={{ py: 1 }}>
                        {execution.startedAt
                          ? formatDateTimeDetailed(execution.startedAt)
                          : '-'}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell
                        component="th"
                        scope="row"
                        sx={{ bgcolor: 'grey.50', py: 1 }}
                      >
                        {t('jobs.completedAt')}
                      </TableCell>
                      <TableCell sx={{ py: 1 }}>
                        {execution.completedAt
                          ? formatDateTimeDetailed(execution.completedAt)
                          : '-'}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell
                        component="th"
                        scope="row"
                        sx={{ bgcolor: 'grey.50', py: 1 }}
                      >
                        {t('jobs.executionTime')}
                      </TableCell>
                      <TableCell sx={{ py: 1 }}>
                        {formatExecutionTime(execution)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Grid>

          {execution.result && (
            <Grid size={{ xs: 12, md: 6 }}>
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
                      maxHeight: 200,
                    }}
                  >
                    {JSON.stringify(execution.result, null, 2)}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}

          {execution.errorMessage && (
            <Grid size={{ xs: 12 }}>
              <Alert severity="error">
                <Typography variant="subtitle2" gutterBottom>
                  {t('jobs.errorMessage')}
                </Typography>
                <Typography
                  variant="body2"
                  component="pre"
                  sx={{ whiteSpace: 'pre-wrap' }}
                >
                  {execution.errorMessage}
                </Typography>
              </Alert>
            </Grid>
          )}
        </Grid>
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Typography variant="h6">
          {t('jobs.executionHistory')}{' '}
          {executions.length > 0 && `(${executions.length})`}
        </Typography>
        <IconButton onClick={loadExecutions} size="small" disabled={loading}>
          <RefreshIcon />
        </IconButton>
      </Box>

      <PageContentLoader
        loading={loading}
        sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}
      >
        {executions.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              height: '100%',
              p: 3,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {t('jobs.noExecutions')}
            </Typography>
          </Box>
        ) : (
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
                          {expandedRows.has(execution.id) ? (
                            <ExpandLessIcon />
                          ) : (
                            <ExpandMoreIcon />
                          )}
                        </IconButton>
                      </TableCell>
                      <TableCell>{getStatusChip(execution.status)}</TableCell>
                      <TableCell>
                        {execution.startedAt ? (
                          <Tooltip
                            title={formatDateTimeDetailed(execution.startedAt)}
                          >
                            <span>
                              {formatRelativeTime(
                                execution.startedAt,
                                undefined,
                                i18n.language
                              )}
                            </span>
                          </Tooltip>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>{formatExecutionTime(execution)}</TableCell>
                      <TableCell>
                        {execution.retryAttempt > 0
                          ? execution.retryAttempt
                          : t('common.none')}
                      </TableCell>
                      <TableCell>
                        <Tooltip
                          title={formatDateTimeDetailed(execution.createdAt)}
                        >
                          <span>
                            {formatRelativeTime(
                              execution.createdAt,
                              undefined,
                              i18n.language
                            )}
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={6} sx={{ p: 0, border: 0 }}>
                        <Collapse
                          in={expandedRows.has(execution.id)}
                          timeout="auto"
                          unmountOnExit
                        >
                          {renderExecutionDetails(execution)}
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </PageContentLoader>
    </Box>
  );
};

export default JobExecutionHistory;
