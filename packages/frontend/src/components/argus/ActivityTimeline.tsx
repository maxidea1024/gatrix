import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Avatar,
  useTheme,
  alpha,
  CircularProgress,
  Collapse,
  Link,
} from '@mui/material';
import {
  CheckCircle as ResolvedIcon,
  PersonAdd as AssignIcon,
  Comment as CommentIcon,
  Merge as MergeIcon,
  PriorityHigh as PriorityIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import argusService, { ArgusIssueActivity } from '@/services/argusService';
import { formatRelativeTime } from '@/utils/dateFormat';
import { useLocalStorage } from '@/hooks/useLocalStorage';

// ==================== Props ====================

interface ActivityTimelineProps {
  projectId: string;
  issueId: string;
  isDark: boolean;
  /** When true, renders without Paper card wrapper for embedding in sidebar */
  embedded?: boolean;
}

// ==================== Config ====================

const ACTION_CONFIG: Record<
  string,
  { icon: React.ReactElement; color: string; label: string }
> = {
  status_change: {
    icon: <ResolvedIcon sx={{ fontSize: 14 }} />,
    color: '#4caf50',
    label: 'Status changed',
  },
  assign: {
    icon: <AssignIcon sx={{ fontSize: 14 }} />,
    color: '#2196f3',
    label: 'Assigned',
  },
  comment: {
    icon: <CommentIcon sx={{ fontSize: 14 }} />,
    color: '#ff9800',
    label: 'Comment',
  },
  priority_change: {
    icon: <PriorityIcon sx={{ fontSize: 14 }} />,
    color: '#7c4dff',
    label: 'Priority changed',
  },
  merge: {
    icon: <MergeIcon sx={{ fontSize: 14 }} />,
    color: '#00bcd4',
    label: 'Merged',
  },
};

// ==================== Helpers ====================

function getActivityDescription(activity: ArgusIssueActivity, t: any): string {
  const data = activity.data;
  switch (activity.action) {
    case 'status_change':
      return t('argus.activity.statusChanged', { to: data?.to || '?' });
    case 'assign':
      return data?.to
        ? t('argus.activity.assigned', { to: data.to })
        : t('argus.activity.unassigned');
    case 'comment':
      return data?.text || '';
    case 'priority_change':
      return t('argus.activity.priorityChanged', { to: data?.to || '?' });
    case 'merge':
      return t('argus.activity.merged');
    default:
      return activity.action;
  }
}

function getInitials(name?: string | null): string {
  if (!name || name === 'Unknown') return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function getAvatarColor(name?: string | null): string {
  if (!name) return '#9e9e9e';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#e91e63',
    '#9c27b0',
    '#673ab7',
    '#3f51b5',
    '#2196f3',
    '#009688',
    '#4caf50',
    '#ff9800',
    '#ff5722',
    '#795548',
  ];
  return colors[Math.abs(hash) % colors.length];
}

// ==================== Component ====================

const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  projectId,
  issueId,
  isDark,
  embedded = false,
}) => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [activities, setActivities] = useState<ArgusIssueActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sectionExpanded, setSectionExpanded] = useLocalStorage(
    'argus_activity_expanded',
    true
  );

  const fetchActivities = useCallback(
    async (silent = false, customLimit = 5) => {
      if (!silent) setLoading(true);
      try {
        const data = await argusService.getIssueActivity(
          projectId,
          issueId,
          customLimit,
          0
        );
        setActivities(data);
        setHasMore(data.length === customLimit);
      } catch (error) {
        console.error('Failed to fetch activities:', error);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [projectId, issueId]
  );

  useEffect(() => {
    fetchActivities(false, 5);
  }, [issueId, fetchActivities]);

  const fetchMoreActivities = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const offset = activities.length;
      const data = await argusService.getIssueActivity(
        projectId,
        issueId,
        5,
        offset
      );
      if (data.length > 0) {
        setActivities((prev) => [...prev, ...data]);
        if (data.length < 5) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Failed to fetch more activities:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || submitting) return;
    const text = commentText.trim();
    setSubmitting(true);
    setCommentText('');

    // Optimistic update — insert immediately
    const optimisticItem: ArgusIssueActivity = {
      id: Date.now(),
      project_id: Number(projectId),
      issue_id: Number(issueId),
      user_name: (() => {
        try {
          const u = JSON.parse(localStorage.getItem('user') || '{}');
          return u.name || null;
        } catch {
          return null;
        }
      })(),
      action: 'comment',
      data: { text },
      created_at: new Date().toISOString(),
    };
    setActivities((prev) => [optimisticItem, ...prev]);

    try {
      await argusService.addIssueComment(projectId, issueId, text);
    } catch (error) {
      console.error('Failed to add comment:', error);
      // Rollback optimistic update
      setActivities((prev) => prev.filter((a) => a.id !== optimisticItem.id));
      setCommentText(text);
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Render activity item ----
  const renderActivityItem = (
    activity: ArgusIssueActivity,
    idx: number,
    total: number
  ) => {
    const config =
      ACTION_CONFIG[activity.action] || ACTION_CONFIG.status_change;
    const isComment = activity.action === 'comment';
    const isLast = idx === total - 1;
    const displayName = activity.user_name || t('argus.activity.system');

    return (
      <Box
        key={activity.id}
        sx={{ display: 'flex', gap: 1.5, position: 'relative' }}
      >
        {/* Timeline column: avatar/icon + vertical line */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            minWidth: 28,
            pt: 0.2,
          }}
        >
          {/* Vertical line — positioned behind the dot */}
          {!isLast && (
            <Box
              sx={{
                position: 'absolute',
                top: isComment ? 28 : 24,
                bottom: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '2px',
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(0,0,0,0.06)',
              }}
            />
          )}

          {isComment ? (
            <Avatar
              sx={{
                width: 26,
                height: 26,
                fontSize: '0.6rem',
                fontWeight: 700,
                backgroundColor: getAvatarColor(activity.user_name),
                color: '#fff',
                zIndex: 1,
              }}
            >
              {getInitials(activity.user_name)}
            </Avatar>
          ) : (
            <Box
              sx={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: alpha(config.color, isDark ? 0.15 : 0.08),
                color: config.color,
                zIndex: 1,
              }}
            >
              {config.icon}
            </Box>
          )}
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, minWidth: 0, pb: isLast ? 0 : 1.5 }}>
          {isComment ? (
            // ---- Comment style ----
            <>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  mb: 0.3,
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: 'text.primary',
                  }}
                >
                  {displayName}
                </Typography>
                <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
                  ·
                </Typography>
                <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
                  {formatRelativeTime(
                    activity.created_at,
                    undefined,
                    i18n.language
                  )}
                </Typography>
              </Box>
              <Box
                sx={{
                  px: 1.5,
                  py: 0.8,
                  borderRadius: '6px',
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.03)'
                    : 'rgba(0,0,0,0.018)',
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.76rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    lineHeight: 1.5,
                    color: 'text.primary',
                  }}
                >
                  {getActivityDescription(activity, t)}
                </Typography>
              </Box>
            </>
          ) : (
            // ---- System activity (compact inline) ----
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                minHeight: 22,
                flexWrap: 'wrap',
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: 'text.secondary',
                }}
              >
                {displayName}
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
                {getActivityDescription(activity, t)}
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.6rem',
                  color: 'text.disabled',
                  ml: 'auto',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatRelativeTime(
                  activity.created_at,
                  undefined,
                  i18n.language
                )}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    );
  };

  // ---- Main render ----
  return (
    <Box>
      {/* Header */}
      <Box
        onClick={() => setSectionExpanded(!sectionExpanded)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          mb: 1,
          cursor: 'pointer',
          '&:hover': { opacity: 0.8 },
        }}
      >
        <Typography
          variant="caption"
          fontWeight={700}
          sx={{
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'text.secondary',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            flex: 1,
          }}
        >
          {t('argus.activity.title')}
          {activities.length > 0 && (
            <Typography
              component="span"
              sx={{
                color: 'text.disabled',
                fontSize: '0.65rem',
                fontWeight: 500,
              }}
            >
              ({activities.length})
            </Typography>
          )}
        </Typography>
        {sectionExpanded ? (
          <ExpandLessIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
        ) : (
          <ExpandMoreIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
        )}
      </Box>

      <Collapse in={sectionExpanded}>
        {/* Comment input */}
        <Box
          sx={{
            display: 'flex',
            gap: 0,
            mb: 2,
            alignItems: 'flex-end',
            borderRadius: '10px',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.025)'
              : 'rgba(0,0,0,0.012)',
            transition: 'border-color 0.2s, box-shadow 0.2s',
            '&:focus-within': {
              borderColor: alpha(theme.palette.primary.main, 0.4),
              boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.08)}`,
            },
          }}
        >
          <TextField
            size="small"
            fullWidth
            multiline
            maxRows={3}
            placeholder={t('argus.activity.addComment')}
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
                fontSize: '0.78rem',
                borderRadius: '10px',
                backgroundColor: 'transparent',
                '& fieldset': { border: 'none' },
                '&:hover fieldset': { border: 'none' },
                '&.Mui-focused fieldset': { border: 'none' },
              },
              '& .MuiOutlinedInput-input': { py: 0.8, px: 1.2 },
            }}
          />
        </Box>

        {/* Activity list */}
        {loading ? (
          <Box sx={{ py: 3, textAlign: 'center' }}>
            <CircularProgress size={20} />
          </Box>
        ) : activities.length === 0 ? (
          <Box sx={{ py: 3, textAlign: 'center' }}>
            <Typography
              variant="caption"
              color="text.disabled"
              sx={{ fontSize: '0.72rem' }}
            >
              {t('argus.activity.noActivity')}
            </Typography>
          </Box>
        ) : (
          <Box>
            {(() => {
              const visibleActivities = activities;
              const showLoadMore = hasMore;
              return (
                <>
                  {visibleActivities.map((activity, idx) =>
                    renderActivityItem(activity, idx, visibleActivities.length)
                  )}
                  {showLoadMore && (
                    <Box sx={{ pt: 1, textAlign: 'center' }}>
                      <Link
                        component="button"
                        variant="caption"
                        onClick={fetchMoreActivities}
                        disabled={loadingMore}
                        sx={{
                          fontSize: '0.7rem',
                          cursor: 'pointer',
                          color: theme.palette.primary.main,
                          textDecoration: 'none',
                          fontWeight: 600,
                          opacity: loadingMore ? 0.5 : 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          '&:hover': { textDecoration: 'underline' },
                        }}
                      >
                        {loadingMore && (
                          <CircularProgress size={10} color="inherit" />
                        )}
                        {t('common.showMore', { count: 5 })}
                      </Link>
                    </Box>
                  )}
                </>
              );
            })()}
          </Box>
        )}
      </Collapse>
    </Box>
  );
};

export default ActivityTimeline;
