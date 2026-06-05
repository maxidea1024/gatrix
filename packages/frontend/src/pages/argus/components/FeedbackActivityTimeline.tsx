import React, { useState } from 'react';
import { Box, Typography, Avatar, TextField, alpha } from '@mui/material';
import {
  CheckCircleOutline as ResolveIcon,
  ReportProblem as SpamIcon,
  PersonAdd as AssignIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { formatRelativeTime } from '@/utils/dateFormat';
import { stringToColor, getInitials } from '@/utils/argusHelpers';
import argusService, { ArgusFeedbackActivity } from '@/services/argusService';

const statusColor = (s: string) => {
  if (s === 'resolved') return '#4caf50';
  if (s === 'spam') return '#9e9e9e';
  return '#ff9800';
};

interface FeedbackActivityTimelineProps {
  projectId: string;
  feedbackId: string;
  activities: ArgusFeedbackActivity[];
  isDark: boolean;
  onActivitiesChange: (activities: ArgusFeedbackActivity[]) => void;
}

const FeedbackActivityTimeline: React.FC<FeedbackActivityTimelineProps> = ({
  projectId,
  feedbackId,
  activities,
  isDark,
  onActivitiesChange,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

  return (
    <>
      {/* Activity Header */}
      <Typography variant="caption" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, fontSize: '0.72rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {t('argus.feedback.activity')}
        {activities.length > 0 && (
          <Typography component="span" sx={{ color: 'text.disabled', fontSize: '0.65rem', fontWeight: 500 }}>
            ({activities.length})
          </Typography>
        )}
      </Typography>

      {/* Comment Input */}
      <Box sx={{ display: 'flex', gap: 1, mb: 1.5, alignItems: 'flex-start' }}>
        <TextField
          size="small"
          fullWidth
          multiline
          maxRows={3}
          placeholder={t('argus.feedback.addComment')}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === 'Enter' && !e.shiftKey && commentText.trim() && !commentLoading) {
              e.preventDefault();
              const target = e.target as HTMLTextAreaElement;
              setCommentLoading(true);
              const text = commentText.trim();
              let userName: string | undefined;
              try { const u = JSON.parse(localStorage.getItem('user') || '{}'); userName = u.name || undefined; } catch { /* ignore */ }
              setCommentText('');
              try {
                await argusService.addFeedbackComment(projectId, feedbackId, text, userName);
                const updated = await argusService.getFeedbackActivity(projectId, feedbackId);
                onActivitiesChange(updated);
              } catch {
                enqueueSnackbar(t('common.error'), { variant: 'error' });
                setCommentText(text);
              }
              finally {
                setCommentLoading(false);
                requestAnimationFrame(() => target.focus());
              }
            }
          }}
          disabled={commentLoading}
          sx={{
            '& .MuiOutlinedInput-root': {
              fontSize: '0.78rem', borderRadius: '8px',
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)',
              '& fieldset': { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' },
              '&:hover fieldset': { borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)' },
            },
            '& .MuiOutlinedInput-input': { py: 0.8 },
          }}
        />
      </Box>

      {/* Activity Items */}
      {activities.length > 0 && (
        <Box sx={{ mb: 2 }}>
          {activities.map((act, idx) => {
            const actData = typeof act.data === 'string' ? JSON.parse(act.data) : act.data;
            const isComment = act.action === 'comment';
            const isLast = idx === activities.length - 1;
            const displayName = act.user_name || t('argus.activity.system');

            let label = '';
            let iconColor = 'text.secondary';
            switch (act.action) {
              case 'status_change':
                label = t('argus.activity.statusChanged', { to: actData?.to || '?' });
                iconColor = statusColor(actData?.to || '');
                break;
              case 'assign':
                label = actData?.assigned_to
                  ? t('argus.activity.assigned', { to: actData.assigned_to })
                  : t('argus.activity.unassigned');
                iconColor = '#2196f3';
                break;
              case 'comment':
                label = actData?.text || '';
                iconColor = '#ff9800';
                break;
              case 'mark_spam':
                label = t('argus.feedback.markedAsSpam');
                iconColor = '#9e9e9e';
                break;
              case 'unmark_spam':
                label = t('argus.feedback.unmarkedFromSpam');
                iconColor = '#4caf50';
                break;
            }

            return (
              <Box key={act.id} sx={{ display: 'flex', gap: 1.5, position: 'relative' }}>
                <Box sx={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  position: 'relative', minWidth: 28, pt: 0.2,
                }}>
                  {!isLast && (
                    <Box sx={{
                      position: 'absolute',
                      top: isComment ? 28 : 24,
                      bottom: 0, left: '50%', transform: 'translateX(-50%)',
                      width: '2px',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                    }} />
                  )}
                  {isComment ? (
                    <Avatar sx={{
                      width: 26, height: 26, fontSize: '0.6rem', fontWeight: 700,
                      backgroundColor: stringToColor(displayName),
                      color: '#fff', zIndex: 1,
                    }}>
                      {getInitials(displayName)}
                    </Avatar>
                  ) : (
                    <Box sx={{
                      width: 22, height: 22, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: alpha(iconColor, isDark ? 0.15 : 0.08),
                      color: iconColor, zIndex: 1,
                    }}>
                      {act.action === 'status_change' && <ResolveIcon sx={{ fontSize: 14 }} />}
                      {act.action === 'assign' && <AssignIcon sx={{ fontSize: 14 }} />}
                      {act.action === 'mark_spam' && <SpamIcon sx={{ fontSize: 14 }} />}
                      {act.action === 'unmark_spam' && <ResolveIcon sx={{ fontSize: 14 }} />}
                    </Box>
                  )}
                </Box>

                <Box sx={{ flex: 1, minWidth: 0, pb: isLast ? 0 : 1.5 }}>
                  {isComment ? (
                    <>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.4 }}>
                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.primary' }}>
                          {displayName}
                        </Typography>
                        <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled' }}>
                          {formatRelativeTime(act.created_at)}
                        </Typography>
                      </Box>
                      <Box sx={{
                        px: 1.5, py: 1, borderRadius: '8px',
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                      }}>
                        <Typography sx={{ fontSize: '0.78rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
                          {label}
                        </Typography>
                      </Box>
                    </>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minHeight: 22, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary' }}>
                        {displayName}
                      </Typography>
                      <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
                        {label}
                      </Typography>
                      <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', ml: 'auto', whiteSpace: 'nowrap' }}>
                        {formatRelativeTime(act.created_at)}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </>
  );
};

export default FeedbackActivityTimeline;
