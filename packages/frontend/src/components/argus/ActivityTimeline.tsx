import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  IconButton,
  Avatar,
  useTheme,
  alpha,
  Divider,
  Collapse,
  CircularProgress,
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  CheckCircle as ResolvedIcon,
  Block as IgnoreIcon,
  ErrorOutline as ReopenedIcon,
  PersonAdd as AssignIcon,
  Comment as CommentIcon,
  Send as SendIcon,
  Merge as MergeIcon,
  PriorityHigh as PriorityIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import argusService, { ArgusIssueActivity } from '@/services/argusService';

interface ActivityTimelineProps {
  projectId: string;
  issueId: string;
  isDark: boolean;
}

const ACTION_CONFIG: Record<string, { icon: React.ReactElement; color: string; label: string }> = {
  status_change: { icon: <ResolvedIcon sx={{ fontSize: 16 }} />, color: '#4caf50', label: 'Status changed' },
  assign: { icon: <AssignIcon sx={{ fontSize: 16 }} />, color: '#2196f3', label: 'Assigned' },
  comment: { icon: <CommentIcon sx={{ fontSize: 16 }} />, color: '#ff9800', label: 'Comment' },
  priority_change: { icon: <PriorityIcon sx={{ fontSize: 16 }} />, color: '#7c4dff', label: 'Priority changed' },
  merge: { icon: <MergeIcon sx={{ fontSize: 16 }} />, color: '#00bcd4', label: 'Merged' },
};

function formatRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    if (days < 30) return `${days}d ago`;
    return d.toLocaleDateString();
  } catch { return dateStr; }
}

function getActivityDescription(activity: ArgusIssueActivity, t: any): string {
  const data = activity.data;
  switch (activity.action) {
    case 'status_change':
      return t('argus.activity.statusChanged', { to: data?.to || '?' });
    case 'assign':
      return data?.to
        ? t('argus.activity.assigned', { to: data.to })
        : t('argus.activity.unassigned', 'Unassigned');
    case 'comment':
      return data?.text || '';
    case 'priority_change':
      return t('argus.activity.priorityChanged', { to: data?.to || '?' });
    case 'merge':
      return t('argus.activity.merged', 'Issues merged');
    default:
      return activity.action;
  }
}

const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ projectId, issueId, isDark }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [activities, setActivities] = useState<ArgusIssueActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const data = await argusService.getIssueActivity(projectId, issueId);
      setActivities(data);
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, issueId]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const handleAddComment = async () => {
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);
    try {
      await argusService.addIssueComment(projectId, issueId, commentText.trim());
      setCommentText('');
      fetchActivities();
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        borderRadius: 2,
        overflow: 'hidden',
        mb: 2,
      }}
    >
      {/* Header */}
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          px: 2, py: 1.5, cursor: 'pointer',
          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
          borderBottom: expanded ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` : 'none',
        }}
      >
        <TimelineIcon sx={{ fontSize: 18, color: '#ff9800' }} />
        <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1, fontSize: '0.82rem' }}>
          {t('argus.activity.title', 'Activity')}
          {activities.length > 0 && (
            <Typography component="span" sx={{ ml: 0.5, color: 'text.disabled', fontSize: '0.72rem', fontWeight: 500 }}>
              ({activities.length})
            </Typography>
          )}
        </Typography>
        {expanded ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
      </Box>

      <Collapse in={expanded}>
        {/* Comment input */}
        <Box sx={{ display: 'flex', gap: 1, px: 2, py: 1.5, alignItems: 'flex-start' }}>
          <TextField
            size="small"
            fullWidth
            multiline
            maxRows={3}
            placeholder={t('argus.activity.addComment', 'Add a comment...')}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAddComment();
              }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                fontSize: '0.8rem',
                borderRadius: 1.5,
              },
            }}
          />
          <IconButton
            size="small"
            onClick={handleAddComment}
            disabled={!commentText.trim() || submitting}
            sx={{ color: theme.palette.primary.main, mt: 0.3 }}
          >
            {submitting ? <CircularProgress size={16} /> : <SendIcon sx={{ fontSize: 18 }} />}
          </IconButton>
        </Box>

        <Divider />

        {/* Activity list */}
        {loading ? (
          <Box sx={{ py: 3, textAlign: 'center' }}>
            <CircularProgress size={20} />
          </Box>
        ) : activities.length === 0 ? (
          <Box sx={{ py: 3, textAlign: 'center' }}>
            <Typography variant="caption" color="text.disabled">
              {t('argus.activity.noActivity', 'No activity yet')}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ px: 2, py: 1 }}>
            {activities.map((activity, idx) => {
              const config = ACTION_CONFIG[activity.action] || ACTION_CONFIG.status_change;
              const isComment = activity.action === 'comment';
              return (
                <Box
                  key={activity.id}
                  sx={{
                    display: 'flex', gap: 1.5, py: 1,
                    borderBottom: idx < activities.length - 1
                      ? `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`
                      : 'none',
                  }}
                >
                  {/* Timeline dot */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 0.3 }}>
                    <Box sx={{
                      width: 24, height: 24, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: alpha(config.color, isDark ? 0.15 : 0.08),
                      color: config.color,
                    }}>
                      {config.icon}
                    </Box>
                    {idx < activities.length - 1 && (
                      <Box sx={{ width: 1, flex: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', mt: 0.5 }} />
                    )}
                  </Box>

                  {/* Content */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.3 }}>
                      {activity.user_name && (
                        <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.72rem' }}>
                          {activity.user_name}
                        </Typography>
                      )}
                      <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>
                        {formatRelativeTime(activity.created_at)}
                      </Typography>
                    </Box>
                    {isComment ? (
                      <Box sx={{
                        px: 1.5, py: 1, borderRadius: 1.5,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                      }}>
                        <Typography variant="body2" sx={{ fontSize: '0.78rem', whiteSpace: 'pre-wrap' }}>
                          {getActivityDescription(activity, t)}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                        {getActivityDescription(activity, t)}
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Collapse>
    </Paper>
  );
};

export default ActivityTimeline;
