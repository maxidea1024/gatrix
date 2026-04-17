import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  IconButton,
  Button,
  Tabs,
  Tab,
  Stack,
  Tooltip,
  Alert,
  Switch,
  FormControlLabel,
  alpha,
} from '@mui/material';
import {
  Monitor as MonitorIcon,
  Refresh as RefreshIcon,
  Replay as RetryIcon,
  Delete as DeleteIcon,
  CleaningServices as CleanIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CompletedIcon,
  Error as ErrorIcon,
  HourglassEmpty as WaitingIcon,
  PlayArrow as ActiveIcon,
  Timer as DelayedIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import {
  fetchAllQueueStats,
  fetchRepeatableJobs,
  fetchQueueJobs,
  retryQueueJob,
  removeQueueJob,
  removeRepeatableJob,
  cleanQueue,
} from '@/services/queueMonitorService';
import type {
  QueueStats,
  QueueJob,
  RepeatableJob,
} from '@/services/queueMonitorService';
import PageContentLoader from '@/components/common/PageContentLoader';
import ContentLoader from '@/components/common/ContentLoader';
import PageHeader from '@/components/common/PageHeader';

// Format duration in ms to human-readable
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// Format timestamp
function formatTime(ts: number | null): string {
  if (!ts) return '-';
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatDateTime(ts: number | null): string {
  if (!ts) return '-';
  return new Date(ts).toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

// Status color map
const statusColors: Record<
  string,
  'success' | 'error' | 'warning' | 'info' | 'default'
> = {
  completed: 'success',
  failed: 'error',
  active: 'info',
  waiting: 'warning',
  delayed: 'default',
};

const statusIcons: Record<string, React.ReactElement> = {
  completed: <CompletedIcon fontSize="small" />,
  failed: <ErrorIcon fontSize="small" />,
  active: <ActiveIcon fontSize="small" />,
  waiting: <WaitingIcon fontSize="small" />,
  delayed: <DelayedIcon fontSize="small" />,
};

const QueueMonitorPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [searchParams, setSearchParams] = useSearchParams();

  const [stats, setStats] = useState<QueueStats[]>([]);
  const [selectedQueue, setSelectedQueue] = useState<string | null>(
    searchParams.get('queue') || null
  );
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get('tab');
    return tabParam ? parseInt(tabParam, 10) : 0;
  });
  const [repeatables, setRepeatables] = useState<RepeatableJob[]>([]);
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMessage, setConfirmMessage] = useState('');

  const statusTabs = ['completed', 'failed', 'active', 'waiting', 'delayed'];

  // Sync state to URL query params
  useEffect(() => {
    const params: Record<string, string> = {};
    if (selectedQueue) params.queue = selectedQueue;
    if (activeTab !== 0) params.tab = String(activeTab);
    setSearchParams(params, { replace: true });
  }, [selectedQueue, activeTab, setSearchParams]);

  // Load queue stats
  const loadStats = useCallback(async () => {
    try {
      const data = await fetchAllQueueStats();
      setStats(data);
      if (!selectedQueue && data.length > 0) {
        setSelectedQueue(data[0].name);
      }
    } catch {
      // Silent - will show empty state
    } finally {
      setLoading(false);
    }
  }, [selectedQueue]);

  // Load repeatable jobs or job history
  const loadQueueDetails = useCallback(
    async (silent = false) => {
      if (!selectedQueue) return;
      if (!silent) setJobsLoading(true);
      try {
        if (activeTab === 0) {
          const data = await fetchRepeatableJobs(selectedQueue);
          setRepeatables(data);
        } else {
          const status = statusTabs[activeTab - 1];
          const data = await fetchQueueJobs(selectedQueue, status, 0, 49);
          setJobs(data);
        }
      } catch {
        // Silent
      } finally {
        if (!silent) setJobsLoading(false);
      }
    },
    [selectedQueue, activeTab]
  );

  // Initial load
  useEffect(() => {
    loadStats();
  }, []);

  // Load details when queue or tab changes
  useEffect(() => {
    setJobs([]);
    setRepeatables([]);
    loadQueueDetails();
  }, [selectedQueue, activeTab, loadQueueDetails]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        loadStats();
        loadQueueDetails(true);
      }, 5000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, loadStats, loadQueueDetails]);

  // Handlers
  const handleRetry = async (jobId: string) => {
    if (!selectedQueue) return;
    try {
      await retryQueueJob(selectedQueue, jobId);
      enqueueSnackbar(t('queueMonitor.retrySuccess'), { variant: 'success' });
      loadQueueDetails();
      loadStats();
    } catch {
      enqueueSnackbar(t('queueMonitor.retryFailed'), { variant: 'error' });
    }
  };

  const handleRemoveJob = async (jobId: string) => {
    if (!selectedQueue) return;
    try {
      await removeQueueJob(selectedQueue, jobId);
      enqueueSnackbar(t('queueMonitor.removeSuccess'), { variant: 'success' });
      loadQueueDetails();
      loadStats();
    } catch {
      enqueueSnackbar(t('queueMonitor.removeFailed'), { variant: 'error' });
    }
  };

  const handleRemoveRepeatable = (key: string) => {
    setConfirmMessage(t('queueMonitor.removeRepeatableConfirm'));
    setConfirmAction(() => async () => {
      if (!selectedQueue) return;
      try {
        await removeRepeatableJob(selectedQueue, key);
        enqueueSnackbar(t('queueMonitor.removeRepeatableSuccess'), {
          variant: 'success',
        });
        loadQueueDetails();
      } catch {
        enqueueSnackbar(t('queueMonitor.removeRepeatableFailed'), {
          variant: 'error',
        });
      }
    });
    setConfirmOpen(true);
  };

  const handleClean = (status: string) => {
    if (!selectedQueue) return;
    setConfirmMessage(
      t('queueMonitor.cleanConfirm', {
        status: t(`queueMonitor.${status}`),
        queue: selectedQueue,
      })
    );
    setConfirmAction(() => async () => {
      try {
        const result = await cleanQueue(selectedQueue!, status);
        enqueueSnackbar(
          t('queueMonitor.cleanSuccess', { count: result.removed }),
          {
            variant: 'success',
          }
        );
        loadQueueDetails();
        loadStats();
      } catch {
        enqueueSnackbar(t('queueMonitor.cleanFailed'), { variant: 'error' });
      }
    });
    setConfirmOpen(true);
  };

  const handleSelectQueue = (queueName: string) => {
    setSelectedQueue(queueName);
    setActiveTab(0);
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  if (!user) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{t('errors.accessDenied')}</Alert>
      </Box>
    );
  }

  const selectedStats = stats.find((s) => s.name === selectedQueue);

  // Build tab label with badge count
  const getTabLabel = (statusKey: string) => {
    const count = selectedStats?.[statusKey as keyof QueueStats] as number;
    if (count && count > 0) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
          {t(`queueMonitor.${statusKey}`)}
          <Chip
            size="small"
            label={count}
            color={statusColors[statusKey]}
            sx={{
              height: 18,
              minWidth: 24,
              '& .MuiChip-label': {
                px: 0.6,
                fontSize: '0.7rem',
                fontWeight: 700,
              },
            }}
          />
        </Box>
      );
    }
    return t(`queueMonitor.${statusKey}`);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <PageHeader
        icon={<MonitorIcon />}
        title={t('queueMonitor.title')}
        subtitle={t('queueMonitor.description')}
        actions={
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
              }
              label={
                <Typography variant="caption">
                  {t('queueMonitor.autoRefresh')}
                </Typography>
              }
            />
            <Button
              size="small"
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={() => {
                loadStats();
                loadQueueDetails();
              }}
            >
              {t('common.refresh')}
            </Button>
          </Stack>
        }
      />

      <PageContentLoader loading={loading}>
        {stats.length === 0 ? (
          <Alert severity="info">{t('queueMonitor.noQueues')}</Alert>
        ) : (
          <Box sx={{ display: 'flex', gap: 3 }}>
            {/* Queue List Sidebar */}
            <Box sx={{ width: 260, flexShrink: 0 }}>
              <Stack spacing={0.75}>
                {stats.map((q) => (
                  <Card
                    key={q.name}
                    variant="outlined"
                    sx={{
                      cursor: 'pointer',
                      border: 2,
                      borderColor:
                        selectedQueue === q.name ? 'primary.main' : 'transparent',
                      bgcolor:
                        selectedQueue === q.name
                          ? (theme) =>
                              `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.primary.main, 0.03)} 100%)`
                          : 'background.paper',
                      ...(selectedQueue === q.name && {
                        background: (theme: any) =>
                          `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
                        boxShadow: (theme: any) =>
                          `0 2px 12px ${alpha(theme.palette.primary.main, 0.15)}`,
                      }),
                      transition: 'border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease',
                      '&:hover': {
                        borderColor: selectedQueue === q.name
                          ? 'primary.main'
                          : 'primary.light',
                        ...(selectedQueue !== q.name && {
                          bgcolor: (theme: any) =>
                            alpha(theme.palette.primary.main, 0.02),
                        }),
                      },
                    }}
                    onClick={() => handleSelectQueue(q.name)}
                  >
                    <CardContent
                      sx={{ py: 1.25, px: 2, '&:last-child': { pb: 1.25 } }}
                    >
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: selectedQueue === q.name ? 700 : 600,
                          mb: 0.5,
                          fontFamily: 'monospace',
                          fontSize: '0.85rem',
                        }}
                      >
                        {q.name}
                      </Typography>
                      <Stack
                        direction="row"
                        spacing={0.5}
                        flexWrap="wrap"
                        useFlexGap
                      >
                        {q.active > 0 && (
                          <Chip
                            size="small"
                            label={q.active}
                            color="info"
                            variant="filled"
                            sx={{
                              height: 20,
                              '& .MuiChip-label': {
                                px: 0.8,
                                fontSize: '0.7rem',
                              },
                            }}
                          />
                        )}
                        {q.waiting > 0 && (
                          <Chip
                            size="small"
                            label={q.waiting}
                            color="warning"
                            variant="filled"
                            sx={{
                              height: 20,
                              '& .MuiChip-label': {
                                px: 0.8,
                                fontSize: '0.7rem',
                              },
                            }}
                          />
                        )}
                        {q.failed > 0 && (
                          <Chip
                            size="small"
                            label={q.failed}
                            color="error"
                            variant="filled"
                            sx={{
                              height: 20,
                              '& .MuiChip-label': {
                                px: 0.8,
                                fontSize: '0.7rem',
                              },
                            }}
                          />
                        )}
                        <Chip
                          size="small"
                          label={`${q.completed}`}
                          color="success"
                          variant="outlined"
                          sx={{
                            height: 20,
                            '& .MuiChip-label': { px: 0.8, fontSize: '0.7rem' },
                          }}
                        />
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>

            {/* Detail Panel */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {!selectedQueue ? (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 300,
                  }}
                >
                  <Typography color="text.secondary">
                    {t('queueMonitor.selectQueue')}
                  </Typography>
                </Box>
              ) : (
                <Card variant="outlined">
                  {/* Tabs bar with clean button */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      borderBottom: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <Tabs
                      value={activeTab}
                      onChange={handleTabChange}
                      sx={{
                        flex: 1,
                        minHeight: 42,
                        '& .MuiTab-root': { minHeight: 42, py: 0 },
                      }}
                    >
                      <Tab
                        icon={<ScheduleIcon sx={{ fontSize: 16 }} />}
                        iconPosition="start"
                        label={t('queueMonitor.repeatableJobs')}
                        sx={{ textTransform: 'none', fontSize: '0.8rem' }}
                      />
                      {statusTabs.map((s) => (
                        <Tab
                          key={s}
                          icon={statusIcons[s]}
                          iconPosition="start"
                          label={getTabLabel(s)}
                          sx={{ textTransform: 'none', fontSize: '0.8rem' }}
                        />
                      ))}
                    </Tabs>
                    {/* Clean button — visible for completed/failed tabs */}
                    {(activeTab === 1 || activeTab === 2) &&
                      jobs.length > 0 && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="warning"
                          startIcon={<CleanIcon />}
                          onClick={() =>
                            handleClean(statusTabs[activeTab - 1])
                          }
                          sx={{ mr: 1.5, whiteSpace: 'nowrap' }}
                        >
                          {t('queueMonitor.clean')}{' '}
                          {statusTabs[activeTab - 1]}
                        </Button>
                      )}
                  </Box>

                  <ContentLoader loading={jobsLoading}>
                    {/* Repeatable Jobs Tab */}
                    {activeTab === 0 && (
                      <Box>
                        {repeatables.length === 0 ? (
                          <Box sx={{ py: 4, textAlign: 'center' }}>
                            <Typography color="text.secondary">
                              {t('queueMonitor.noRepeatableJobs')}
                            </Typography>
                          </Box>
                        ) : (
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 600 }}>
                                  {t('queueMonitor.jobName')}
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>
                                  {t('queueMonitor.pattern')}
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>
                                  {t('queueMonitor.every')}
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>
                                  {t('queueMonitor.nextRun')}
                                </TableCell>
                                <TableCell
                                  sx={{ fontWeight: 600, width: 60 }}
                                />
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {repeatables.map((rj) => (
                                <TableRow key={rj.key} hover>
                                  <TableCell>
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        fontFamily: 'monospace',
                                        fontWeight: 600,
                                      }}
                                    >
                                      {rj.name}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    {rj.pattern ? (
                                      <Chip
                                        size="small"
                                        label={rj.pattern}
                                        variant="outlined"
                                        sx={{
                                          fontFamily: 'monospace',
                                          height: 22,
                                          '& .MuiChip-label': {
                                            fontSize: '0.75rem',
                                          },
                                        }}
                                      />
                                    ) : (
                                      '-'
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {rj.every
                                      ? formatDuration(parseInt(rj.every))
                                      : '-'}
                                  </TableCell>
                                  <TableCell>
                                    {formatDateTime(rj.next)}
                                  </TableCell>
                                  <TableCell>
                                    <Tooltip
                                      title={t(
                                        'queueMonitor.removeRepeatable'
                                      )}
                                    >
                                      <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() =>
                                          handleRemoveRepeatable(rj.key)
                                        }
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </Box>
                    )}

                    {/* Job History Tabs */}
                    {activeTab > 0 && (
                      <Box>


                        {jobs.length === 0 ? (
                          <Box sx={{ py: 4, textAlign: 'center' }}>
                            <Typography color="text.secondary">
                              {t('queueMonitor.noJobs')}
                            </Typography>
                          </Box>
                        ) : (
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 600 }}>
                                  {t('queueMonitor.jobId')}
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>
                                  {t('queueMonitor.jobName')}
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>
                                  {t('queueMonitor.createdAt')}
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>
                                  {t('queueMonitor.duration')}
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>
                                  {t('queueMonitor.attempts')}
                                </TableCell>
                                {statusTabs[activeTab - 1] === 'failed' && (
                                  <TableCell sx={{ fontWeight: 600 }}>
                                    {t('queueMonitor.failedReason')}
                                  </TableCell>
                                )}
                                <TableCell
                                  sx={{ fontWeight: 600, width: 80 }}
                                />
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {jobs.map((job) => {
                                const duration =
                                  job.finishedOn && job.processedOn
                                    ? job.finishedOn - job.processedOn
                                    : null;
                                return (
                                  <TableRow key={job.id} hover>
                                    <TableCell>
                                      <Typography
                                        variant="body2"
                                        sx={{
                                          fontFamily: 'monospace',
                                          fontSize: '0.75rem',
                                        }}
                                      >
                                        {job.id}
                                      </Typography>
                                    </TableCell>
                                    <TableCell>
                                      <Chip
                                        size="small"
                                        label={job.name}
                                        color={
                                          statusColors[
                                            statusTabs[activeTab - 1]
                                          ]
                                        }
                                        variant="outlined"
                                        sx={{
                                          fontFamily: 'monospace',
                                          height: 22,
                                          '& .MuiChip-label': {
                                            fontSize: '0.75rem',
                                          },
                                        }}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontSize: '0.8rem' }}
                                      >
                                        {formatTime(job.timestamp)}
                                      </Typography>
                                    </TableCell>
                                    <TableCell>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontSize: '0.8rem' }}
                                      >
                                        {duration !== null
                                          ? formatDuration(duration)
                                          : '-'}
                                      </Typography>
                                    </TableCell>
                                    <TableCell>
                                      <Typography variant="body2">
                                        {job.attemptsMade}
                                      </Typography>
                                    </TableCell>
                                    {statusTabs[activeTab - 1] ===
                                      'failed' && (
                                      <TableCell>
                                        <Typography
                                          variant="body2"
                                          color="error"
                                          sx={{
                                            maxWidth: 360,
                                            fontSize: '0.75rem',
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                          }}
                                        >
                                          {job.failedReason || '-'}
                                        </Typography>
                                      </TableCell>
                                    )}
                                    <TableCell>
                                      <Stack direction="row" spacing={0.5}>
                                        {statusTabs[activeTab - 1] ===
                                          'failed' && (
                                          <Tooltip
                                            title={t('queueMonitor.retry')}
                                          >
                                            <IconButton
                                              size="small"
                                              color="primary"
                                              onClick={() =>
                                                handleRetry(job.id)
                                              }
                                            >
                                              <RetryIcon fontSize="small" />
                                            </IconButton>
                                          </Tooltip>
                                        )}
                                        <Tooltip
                                          title={t('queueMonitor.remove')}
                                        >
                                          <IconButton
                                            size="small"
                                            color="error"
                                            onClick={() =>
                                              handleRemoveJob(job.id)
                                            }
                                          >
                                            <DeleteIcon fontSize="small" />
                                          </IconButton>
                                        </Tooltip>
                                      </Stack>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        )}
                      </Box>
                    )}
                  </ContentLoader>
                </Card>
              )}
            </Box>
          </Box>
        )}
      </PageContentLoader>

      <ConfirmDialog
        open={confirmOpen}
        title={t('common.confirm')}
        message={confirmMessage}
        onConfirm={() => {
          setConfirmOpen(false);
          confirmAction?.();
        }}
        onClose={() => setConfirmOpen(false)}
      />
    </Box>
  );
};

export default QueueMonitorPage;
