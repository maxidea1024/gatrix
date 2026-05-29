import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Divider,
  Button,
  IconButton,
  useTheme,
} from '@mui/material';
import PageContentLoader from '@/components/common/PageContentLoader';
import {
  ArrowBack as ArrowBackIcon,
  ErrorOutline as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  DoNotDisturb as IgnoreIcon,
  BugReport as BugReportIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import argusService, { ArgusIssueDetail } from '@/services/argusService';

const LEVEL_COLORS: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  fatal: 'error',
  error: 'error',
  warning: 'warning',
  info: 'info',
  debug: 'default',
};

const ArgusIssueDetailPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { projectId, issueId } = useParams<{ projectId: string; issueId: string }>();

  const [issue, setIssue] = useState<ArgusIssueDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId || !issueId) return;

    const fetchIssue = async () => {
      setLoading(true);
      try {
        const data = await argusService.getIssueDetail(projectId, issueId);
        setIssue(data);
      } catch (error) {
        console.error('Failed to fetch issue detail:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchIssue();
  }, [projectId, issueId]);

  const handleStatusChange = async (newStatus: string) => {
    if (!projectId || !issueId || !issue) return;
    try {
      await argusService.updateIssueStatus(projectId, issueId, newStatus);
      setIssue({ ...issue, status: newStatus });
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const latestEvent = issue?.latest_event;

  return (
    <PageContentLoader loading={loading}>
    {!issue ? (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography color="text.secondary">Issue not found</Typography>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ mt: 2 }}
        >
          Go Back
        </Button>
      </Box>
    ) : (
    <Box>
      {/* Back button + Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={() => navigate(-1)} size="small">
          <ArrowBackIcon />
        </IconButton>
        <BugReportIcon sx={{ color: theme.palette.error.main }} />
        <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
          {issue.title}
        </Typography>
        <Chip
          label={issue.level}
          size="small"
          color={LEVEL_COLORS[issue.level] || 'default'}
          variant="outlined"
        />
      </Box>

      {issue.culprit && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, ml: 5 }}>
          {issue.culprit}
        </Typography>
      )}

      {/* Action bar */}
      <Paper sx={{ p: 2, mb: 3, display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
          Status:
        </Typography>
        <Chip
          label={issue.status}
          color={issue.status === 'resolved' ? 'success' : issue.status === 'ignored' ? 'default' : 'error'}
          variant="filled"
          size="small"
          sx={{ textTransform: 'capitalize' }}
        />
        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

        {issue.status !== 'resolved' && (
          <Button
            variant="outlined"
            size="small"
            color="success"
            startIcon={<CheckCircleIcon />}
            onClick={() => handleStatusChange('resolved')}
          >
            Resolve
          </Button>
        )}
        {issue.status !== 'ignored' && (
          <Button
            variant="outlined"
            size="small"
            color="inherit"
            startIcon={<IgnoreIcon />}
            onClick={() => handleStatusChange('ignored')}
          >
            Ignore
          </Button>
        )}
        {issue.status !== 'unresolved' && (
          <Button
            variant="outlined"
            size="small"
            color="error"
            startIcon={<ErrorIcon />}
            onClick={() => handleStatusChange('unresolved')}
          >
            Reopen
          </Button>
        )}

        {issue.is_regression ? (
          <Chip label="Regression" color="warning" variant="outlined" size="small" sx={{ ml: 'auto' }} />
        ) : null}
      </Paper>

      {/* Summary cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Paper sx={{ p: 2, textAlign: 'center', flex: '1 1 200px', minWidth: 140 }}>
          <Typography variant="h5" fontWeight={700}>
            {issue.event_count?.toLocaleString() || 0}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Events
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, textAlign: 'center', flex: '1 1 200px', minWidth: 140 }}>
          <Typography variant="h5" fontWeight={700}>
            {issue.user_count?.toLocaleString() || 0}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Users Affected
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, textAlign: 'center', flex: '1 1 200px', minWidth: 140 }}>
          <Typography variant="body1" fontWeight={500}>
            {issue.first_seen ? new Date(issue.first_seen).toLocaleString() : '-'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            First Seen
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, textAlign: 'center', flex: '1 1 200px', minWidth: 140 }}>
          <Typography variant="body1" fontWeight={500}>
            {issue.last_seen ? new Date(issue.last_seen).toLocaleString() : '-'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Last Seen
          </Typography>
        </Paper>
      </Box>

      {/* Latest Event */}
      {latestEvent && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            Latest Event
          </Typography>
          <Divider sx={{ mb: 2 }} />

          {/* Exception info */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight={600} color="error.main">
              {latestEvent.exception_type}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {latestEvent.exception_value}
            </Typography>
          </Box>

          {/* Stacktrace */}
          {latestEvent.stacktrace_raw && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                Stack Trace
              </Typography>
              <Box
                component="pre"
                sx={{
                  p: 2,
                  borderRadius: 1,
                  backgroundColor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
                  overflow: 'auto',
                  maxHeight: 500,
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {typeof latestEvent.stacktrace_raw === 'string'
                  ? latestEvent.stacktrace_raw
                  : JSON.stringify(latestEvent.stacktrace_raw, null, 2)}
              </Box>
            </Box>
          )}

          {/* Context info */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
            {latestEvent.environment && (
              <Box sx={{ minWidth: 140 }}>
                <Typography variant="caption" color="text.secondary">Environment</Typography>
                <Typography variant="body2">{latestEvent.environment}</Typography>
              </Box>
            )}
            {latestEvent.release && (
              <Box sx={{ minWidth: 140 }}>
                <Typography variant="caption" color="text.secondary">Release</Typography>
                <Typography variant="body2">{latestEvent.release}</Typography>
              </Box>
            )}
            {latestEvent.browser && (
              <Box sx={{ minWidth: 140 }}>
                <Typography variant="caption" color="text.secondary">Browser</Typography>
                <Typography variant="body2">{latestEvent.browser} {latestEvent.browser_version}</Typography>
              </Box>
            )}
            {latestEvent.os && (
              <Box sx={{ minWidth: 140 }}>
                <Typography variant="caption" color="text.secondary">OS</Typography>
                <Typography variant="body2">{latestEvent.os} {latestEvent.os_version}</Typography>
              </Box>
            )}
            {latestEvent.user_email && (
              <Box sx={{ minWidth: 140 }}>
                <Typography variant="caption" color="text.secondary">User</Typography>
                <Typography variant="body2">{latestEvent.user_email}</Typography>
              </Box>
            )}
            {latestEvent.user_ip && (
              <Box sx={{ minWidth: 140 }}>
                <Typography variant="caption" color="text.secondary">IP Address</Typography>
                <Typography variant="body2">{latestEvent.user_ip}</Typography>
              </Box>
            )}
            {latestEvent.transaction && (
              <Box sx={{ minWidth: 140 }}>
                <Typography variant="caption" color="text.secondary">Transaction</Typography>
                <Typography variant="body2">{latestEvent.transaction}</Typography>
              </Box>
            )}
          </Box>

          {/* Tags */}
          {latestEvent.tags && Object.keys(latestEvent.tags).length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                Tags
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {Object.entries(
                  typeof latestEvent.tags === 'string'
                    ? JSON.parse(latestEvent.tags)
                    : latestEvent.tags
                ).map(([key, val]) => (
                  <Chip
                    key={key}
                    label={`${key}: ${val}`}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Box>
          )}
        </Paper>
      )}
    </Box>
    )}
    </PageContentLoader>
  );
};

export default ArgusIssueDetailPage;
