import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  LinearProgress,
  Tabs,
  Tab,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  PlayArrow as RetryIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CompletedIcon,
  Error as ErrorIcon,
  Pause as WaitingIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/services/api';

interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
}

interface Job {
  id: string;
  name: string;
  data: any;
  opts: any;
  progress: number;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  failedReason?: string;
  returnvalue?: any;
}

interface QueueData {
  name: string;
  jobs: Job[];
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
}

const CustomQueueMonitorPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queues, setQueues] = useState<QueueData[]>([]);
  const [selectedQueue, setSelectedQueue] = useState<string>('');
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);

  const statusTabs = ['latest', 'waiting', 'active', 'completed', 'failed', 'delayed'];

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchQueues();
      const interval = setInterval(fetchQueues, 5000); // 5초마다 갱신
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchQueues = async () => {
    try {
      const response = await apiClient.get('/admin/queues/api/queues');
      const queueData = response.data;

      if (queueData && queueData.queues) {
        setQueues(queueData.queues);
        if (!selectedQueue && queueData.queues.length > 0) {
          setSelectedQueue(queueData.queues[0].name);
        }
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch queue data');
    } finally {
      setLoading(false);
    }
  };

  const fetchQueueJobs = async (queueName: string, status: string = 'latest') => {
    try {
      const response = await apiClient.get(
        `/admin/queues/api/queues?activeQueue=${queueName}&status=${status}&page=1&jobsPerPage=50`
      );
      return response.data;
    } catch (err: any) {
      console.error('Failed to fetch queue jobs:', err);
      return null;
    }
  };

  const retryJob = async (jobId: string) => {
    try {
      await apiClient.post(`/admin/queues/api/jobs/${jobId}/retry`);
      fetchQueues();
    } catch (err: any) {
      setError('Failed to retry job');
    }
  };

  const deleteJob = async (jobId: string) => {
    try {
      await apiClient.delete(`/admin/queues/api/jobs/${jobId}`);
      fetchQueues();
    } catch (err: any) {
      setError('Failed to delete job');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CompletedIcon color="success" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      case 'active':
        return <CircularProgress size={20} />;
      case 'waiting':
        return <WaitingIcon color="info" />;
      case 'delayed':
        return <ScheduleIcon color="warning" />;
      default:
        return <WaitingIcon />;
    }
  };

  const getStatusColor = (
    status: string
  ): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'active':
        return 'primary';
      case 'waiting':
        return 'info';
      case 'delayed':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const currentQueue = queues.find((q) => q.name === selectedQueue);

  if (!user || user.role !== 'admin') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{t('errors.accessDenied')}</Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          큐 모니터 (커스텀)
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchQueues}
          disabled={loading}
        >
          새로고침
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* 큐 통계 카드들 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {queues.map((queue) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={queue.name}>
            <Card
              sx={{
                cursor: 'pointer',
                border: selectedQueue === queue.name ? 2 : 1,
                borderColor: selectedQueue === queue.name ? 'primary.main' : 'divider',
              }}
              onClick={() => setSelectedQueue(queue.name)}
            >
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {queue.name}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Chip label={`대기: ${queue.counts?.waiting || 0}`} color="info" size="small" />
                  <Chip
                    label={`실행중: ${queue.counts?.active || 0}`}
                    color="primary"
                    size="small"
                  />
                  <Chip
                    label={`완료: ${queue.counts?.completed || 0}`}
                    color="success"
                    size="small"
                  />
                  <Chip label={`실패: ${queue.counts?.failed || 0}`} color="error" size="small" />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* 선택된 큐의 상세 정보 */}
      {currentQueue && (
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom>
              {currentQueue.name} 큐 상세
            </Typography>

            <Tabs
              value={selectedTab}
              onChange={(_, newValue) => setSelectedTab(newValue)}
              sx={{ mb: 2 }}
            >
              {statusTabs.map((status, index) => (
                <Tab key={status} label={status.toUpperCase()} />
              ))}
            </Tabs>

            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>이름</TableCell>
                    <TableCell>상태</TableCell>
                    <TableCell>생성시간</TableCell>
                    <TableCell>진행률</TableCell>
                    <TableCell>액션</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {currentQueue.jobs?.slice(0, 20).map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>{job.id}</TableCell>
                      <TableCell>{job.name}</TableCell>
                      <TableCell>
                        <Chip
                          icon={getStatusIcon('waiting')}
                          label="대기중"
                          color={getStatusColor('waiting')}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{formatTimestamp(job.timestamp)}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={job.progress || 0}
                            sx={{ flexGrow: 1 }}
                          />
                          <Typography variant="caption">{job.progress || 0}%</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Tooltip title="상세보기">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedJob(job);
                              setJobDialogOpen(true);
                            }}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="재시도">
                          <IconButton size="small" onClick={() => retryJob(job.id)}>
                            <RetryIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="삭제">
                          <IconButton size="small" onClick={() => deleteJob(job.id)}>
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* 작업 상세 다이얼로그 */}
      <Dialog open={jobDialogOpen} onClose={() => setJobDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>작업 상세 정보</DialogTitle>
        <DialogContent>
          {selectedJob && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                <strong>ID:</strong> {selectedJob.id}
              </Typography>
              <Typography variant="subtitle1" gutterBottom>
                <strong>이름:</strong> {selectedJob.name}
              </Typography>
              <Typography variant="subtitle1" gutterBottom>
                <strong>데이터:</strong>
              </Typography>
              <Paper sx={{ p: 2, bgcolor: 'grey.100' }}>
                <pre>{JSON.stringify(selectedJob.data, null, 2)}</pre>
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJobDialogOpen(false)}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CustomQueueMonitorPage;
