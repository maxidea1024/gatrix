import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Paper,
  Chip,
  Button,
  useTheme,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { getUserSessions } from '@/services/argus/argusAnalytics';
import type { ArgusUserSession } from '@/services/argus/argusTypes';
import { formatDuration } from '@/utils/dateFormat';

interface UserProfileSessionsTabProps {
  projectId: string;
  userId: string;
}

interface SessionStats {
  avgDurSec: number;
  avgGapDays: number;
  trend: 'up' | 'down' | 'stable' | 'none';
}

function computeSessionStats(ss: ArgusUserSession[]): SessionStats {
  if (ss.length === 0) return { avgDurSec: 0, avgGapDays: 0, trend: 'none' };
  const avgDurSec = ss.reduce((a, s) => a + s.duration_seconds, 0) / ss.length;
  const sorted = [...ss].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );
  let avgGapDays = 0;
  if (sorted.length >= 2) {
    const gaps = sorted
      .slice(1)
      .map(
        (s, i) =>
          (new Date(s.start_time).getTime() -
            new Date(sorted[i].start_time).getTime()) /
          86400000
      );
    avgGapDays = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  }
  let trend: SessionStats['trend'] = 'none';
  if (ss.length >= 6) {
    const recent =
      ss.slice(0, 3).reduce((a, s) => a + s.duration_seconds, 0) / 3;
    const older = ss.slice(3, 6).reduce((a, s) => a + s.duration_seconds, 0) / 3;
    trend =
      recent > older * 1.1 ? 'up' : recent < older * 0.9 ? 'down' : 'stable';
  }
  return { avgDurSec, avgGapDays, trend };
}

export const UserProfileSessionsTab: React.FC<UserProfileSessionsTabProps> = ({
  projectId,
  userId,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [sessions, setSessions] = useState<ArgusUserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionsHasMore, setSessionsHasMore] = useState(false);
  const [sessionsLoadingMore, setSessionsLoadingMore] = useState(false);
  const SESSIONS_PAGE_SIZE = 10;

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    getUserSessions(projectId, userId, { limit: SESSIONS_PAGE_SIZE })
      .then((s) => {
        setSessions(s);
        setSessionsHasMore(s.length >= SESSIONS_PAGE_SIZE);
      })
      .catch((err) => {
        console.error('Failed to load sessions:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [projectId, userId]);

  const sessionStats = useMemo(() => computeSessionStats(sessions), [sessions]);

  const loadMoreSessions = async () => {
    if (!userId) return;
    setSessionsLoadingMore(true);
    try {
      const more = await getUserSessions(projectId, userId, {
        limit: SESSIONS_PAGE_SIZE,
        offset: sessions.length,
      });
      setSessions((prev) => [...prev, ...more]);
      setSessionsHasMore(more.length >= SESSIONS_PAGE_SIZE);
    } catch (err) {
      console.error('Failed to load more sessions:', err);
    } finally {
      setSessionsLoadingMore(false);
    }
  };

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={32} />
        </Box>
      ) : sessions.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <Typography variant="body2">
            {t('argus.userProfiles.noSessionLogs', 'No session logs found for this user.')}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflowY: 'auto' }}>
          {/* Session Engagement Summary */}
          {sessions.length >= 2 && (() => {
            const { avgDurSec, avgGapDays, trend } = sessionStats;
            const trendIcon =
              trend === 'up'
                ? '📈'
                : trend === 'down'
                  ? '📉'
                  : trend === 'stable'
                    ? '➡️'
                    : null;
            const trendLabel =
              trend === 'up'
                ? t('argus.userProfiles.trendUp', 'Increasing Sessions Trend')
                : trend === 'down'
                  ? t('argus.userProfiles.trendDown', 'Shorter Sessions (Churn Risk)')
                  : trend === 'stable'
                    ? t('argus.userProfiles.trendStable', 'Stable')
                    : null;
            return (
              <Box sx={{ display: 'flex', gap: 1.5, mb: 0.5, flexWrap: 'wrap', flexShrink: 0 }}>
                <Paper
                  variant="outlined"
                  sx={{
                    flex: 1,
                    minWidth: 120,
                    p: 1.5,
                    borderRadius: 2,
                    textAlign: 'center',
                    bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: 10,
                      color: 'text.secondary',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      fontWeight: 700,
                    }}
                  >
                    {t('argus.userProfiles.avgSession', 'Avg Session')}
                  </Typography>
                  <Typography sx={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2, mt: 0.5 }}>
                    {formatDuration(Math.round(avgDurSec) * 1000)}
                  </Typography>
                </Paper>
                <Paper
                  variant="outlined"
                  sx={{
                    flex: 1,
                    minWidth: 120,
                    p: 1.5,
                    borderRadius: 2,
                    textAlign: 'center',
                    bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: 10,
                      color: 'text.secondary',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      fontWeight: 700,
                    }}
                  >
                    {t('argus.userProfiles.avgReturn', 'Avg Return')}
                  </Typography>
                  <Typography sx={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2, mt: 0.5 }}>
                    {avgGapDays < 1
                      ? t('argus.userProfiles.lessThan1Day', '< 1 day')
                      : t('argus.userProfiles.dayValue', '{{n}} days', {
                          n: avgGapDays.toFixed(1),
                        })}
                  </Typography>
                </Paper>
                {trendIcon && (
                  <Paper
                    variant="outlined"
                    sx={{
                      flex: 1,
                      minWidth: 120,
                      p: 1.5,
                      borderRadius: 2,
                      textAlign: 'center',
                      bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: 10,
                        color: 'text.secondary',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        fontWeight: 700,
                      }}
                    >
                      {t('argus.userProfiles.trendLabel', 'Trend')}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: 13,
                        fontWeight: 700,
                        lineHeight: 1.4,
                        mt: 0.5,
                        color:
                          trend === 'down'
                            ? 'warning.main'
                            : trend === 'up'
                              ? 'success.main'
                              : 'text.secondary',
                      }}
                    >
                      {trendIcon} {trendLabel}
                    </Typography>
                  </Paper>
                )}
              </Box>
            );
          })()}

          {/* Sessions List */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {sessions.map((s, i) => (
              <Box
                key={`${s.session_id}-${i}`}
                sx={{
                  p: 1.8,
                  borderRadius: '8px',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                  bgcolor: 'background.paper',
                  '&:hover': {
                    borderColor: isDark
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(0,0,0,0.1)',
                  },
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 0.6,
                  }}
                >
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: 12,
                      color: theme.palette.primary.main,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      mr: 1,
                    }}
                  >
                    {s.session_id}
                  </Typography>
                  <Typography
                    variant="caption"
                    fontWeight={600}
                    sx={{
                      px: 1,
                      py: 0.2,
                      borderRadius: '4px',
                      bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                      flexShrink: 0,
                    }}
                  >
                    {s.duration_seconds === 0
                      ? t('argus.userProfiles.sessionSingleEvent', 'Single event')
                      : t('argus.userProfiles.sessionDurationLabel', '{{duration}}', {
                          duration: formatDuration(s.duration_seconds * 1000),
                        })}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('argus.userProfiles.sessionEvents', '{{total}} total ({{unique}} unique)', {
                      total: s.event_count,
                      unique: s.unique_events,
                    })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {s.start_time === s.end_time
                      ? new Date(s.start_time).toLocaleString()
                      : `${new Date(s.start_time).toLocaleString()} → ${new Date(s.end_time).toLocaleString()}`}
                  </Typography>
                </Box>
                {(s.platform || s.browser || s.os) && (
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.8, flexWrap: 'wrap' }}>
                    {s.platform && (
                      <Chip
                        label={s.platform}
                        size="small"
                        sx={{ height: 20, fontSize: 10 }}
                      />
                    )}
                    {s.browser && (
                      <Chip
                        label={s.browser}
                        size="small"
                        variant="outlined"
                        sx={{ height: 20, fontSize: 10 }}
                      />
                    )}
                    {s.os && (
                      <Chip
                        label={s.os}
                        size="small"
                        variant="outlined"
                        sx={{ height: 20, fontSize: 10 }}
                      />
                    )}
                  </Box>
                )}
              </Box>
            ))}
          </Box>

          {/* Load More Button */}
          {sessionsHasMore && (
            <Box sx={{ textAlign: 'center', mt: 1, pb: 2, flexShrink: 0 }}>
              <Button
                size="small"
                variant="outlined"
                disabled={sessionsLoadingMore}
                onClick={loadMoreSessions}
                sx={{ textTransform: 'none' }}
              >
                {sessionsLoadingMore ? (
                  <CircularProgress size={16} sx={{ mr: 1 }} />
                ) : null}
                {t('argus.userProfiles.loadMoreSessions', 'Load more sessions')}
              </Button>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default UserProfileSessionsTab;
