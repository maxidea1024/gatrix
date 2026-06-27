import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  useTheme,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { getUserSessions } from '@/services/argus/argusAnalytics';
import type { ArgusUserSession } from '@/services/argus/argusTypes';
import { formatDuration } from '@/utils/dateFormat';
import SimplePagination from '@/components/common/SimplePagination';
import useGlobalPageSize from '@/hooks/useGlobalPageSize';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import { useResizableSplit } from '@/hooks/useResizableSplit';
import {
  SplitContainer,
  SplitterHandle,
  PaginationWrapper,
} from '@/pages/argus/ArgusUserProfilesPage.styles';
import PageContentLoader from '@/components/common/PageContentLoader';
import UserProfileSessionDetailPanel from './UserProfileSessionDetailPanel';

const SPLIT_STORAGE_KEY = 'argus-user-sessions-detail-split';
const MIN_DETAIL_WIDTH = 260;
const MAX_DETAIL_WIDTH = 500;
const DEFAULT_DETAIL_WIDTH = 320;

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

  const [pageSize, setPageSize] = useGlobalPageSize();
  const [page, setPage] = useState(0);
  const [sessions, setSessions] = useState<ArgusUserSession[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ArgusUserSession | null>(null);

  const {
    splitWidth: detailWidth,
    isDragging: isDetailDragging,
    handleMouseDown: handleDetailSplitterMouseDown,
    panelRef: detailPanelRef,
  } = useResizableSplit({
    storageKey: SPLIT_STORAGE_KEY,
    defaultWidth: DEFAULT_DETAIL_WIDTH,
    minWidth: MIN_DETAIL_WIDTH,
    maxWidth: MAX_DETAIL_WIDTH,
    invertDelta: true,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setSelectedSession(null);
    try {
      const result = await getUserSessions(projectId, userId, {
        limit: pageSize,
        offset: page * pageSize,
      });
      setSessions(result.data);
      setTotal(result.total || 0);
      setHasLoaded(true);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, userId, page, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sessionStats = useMemo(() => computeSessionStats(sessions), [sessions]);

  // ─── Stats Cards ───
  const renderStats = () => {
    if (!hasLoaded || sessions.length < 2) return null;
    const { avgDurSec, avgGapDays, trend } = sessionStats;
    const trendIcon =
      trend === 'up' ? '📈' : trend === 'down' ? '📉' : trend === 'stable' ? '➡️' : null;
    const trendLabel =
      trend === 'up'
        ? t('argus.userProfiles.trendUp', 'Increasing Sessions Trend')
        : trend === 'down'
          ? t('argus.userProfiles.trendDown', 'Shorter Sessions (Churn Risk)')
          : trend === 'stable'
            ? t('argus.userProfiles.trendStable', 'Stable')
            : null;

    return (
      <Box sx={{ display: 'flex', gap: 1.5, px: 1.5, pt: 1.5, flexWrap: 'wrap', flexShrink: 0 }}>
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
          <Typography sx={{ fontSize: 10, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
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
          <Typography sx={{ fontSize: 10, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
            {t('argus.userProfiles.avgReturn', 'Avg Return')}
          </Typography>
          <Typography sx={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2, mt: 0.5 }}>
            {avgGapDays < 1
              ? t('argus.userProfiles.lessThan1Day', '< 1 day')
              : t('argus.userProfiles.dayValue', '{{n}} days', { n: avgGapDays.toFixed(1) })}
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
            <Typography sx={{ fontSize: 10, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
              {t('argus.userProfiles.trendLabel', 'Trend')}
            </Typography>
            <Typography
              sx={{
                fontSize: 13,
                fontWeight: 700,
                lineHeight: 1.4,
                mt: 0.5,
                color: trend === 'down' ? 'warning.main' : trend === 'up' ? 'success.main' : 'text.secondary',
              }}
            >
              {trendIcon} {trendLabel}
            </Typography>
          </Paper>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageContentLoader loading={!hasLoaded} sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {renderStats()}

      {/* ═══════ SPLIT-PANEL: List + Detail (일체형) ═══════ */}
      <SplitContainer isDark={isDark} sx={{ mx: 1.5, mb: 1.5, mt: hasLoaded && sessions.length >= 2 ? 1.5 : 0 }}>
        {/* ─── LEFT: Session List ─── */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          <TableContainer
            sx={{
              flex: 1,
              overflow: 'auto',
              opacity: loading && hasLoaded ? 0.55 : 1,
              transition: 'opacity 0.15s ease',
              pointerEvents: loading && hasLoaded ? 'none' : 'auto',
            }}
          >
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'background.paper', minWidth: 140 }}>
                    {t('argus.userProfiles.sessionId', 'Session ID')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'background.paper', minWidth: 160 }}>
                    {t('argus.userProfiles.startTime', 'Start Time')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'background.paper', minWidth: 100 }}>
                    {t('argus.userProfiles.duration', 'Duration')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'background.paper', minWidth: 100 }}>
                    {t('argus.userProfiles.eventCount', 'Events')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'background.paper', minWidth: 80 }}>
                    {t('argus.userProfiles.platformLabel', 'Platform')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
                      {t('argus.userProfiles.noSessionLogs', 'No session logs found for this user.')}
                    </TableCell>
                  </TableRow>
                ) : (
                  sessions.map((s, i) => {
                    const isActive = selectedSession?.session_id === s.session_id;
                    return (
                      <TableRow
                        key={`${s.session_id}-${i}`}
                        hover
                        selected={isActive}
                        onClick={() => setSelectedSession(isActive ? null : s)}
                        sx={{
                          cursor: 'pointer',
                          ...(isActive && {
                            bgcolor: isDark
                              ? 'rgba(124,77,255,0.08)'
                              : 'rgba(124,77,255,0.06)',
                          }),
                        }}
                      >
                        <TableCell>
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            fontFamily="monospace"
                            fontSize={12}
                            sx={{
                              color: theme.palette.primary.main,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 180,
                            }}
                          >
                            {s.session_id}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary" fontSize={12}>
                            {new Date(s.start_time).toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={
                              s.duration_seconds === 0
                                ? t('argus.userProfiles.sessionSingleEvent', 'Single event')
                                : formatDuration(s.duration_seconds * 1000)
                            }
                            sx={{
                              height: 22,
                              fontSize: 11,
                              fontWeight: 600,
                              bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontSize={12}>
                            {s.event_count}
                            <Typography component="span" color="text.secondary" fontSize={11} sx={{ ml: 0.5 }}>
                              ({s.unique_events} unique)
                            </Typography>
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {s.platform ? (
                            <Chip label={s.platform} size="small" sx={{ height: 20, fontSize: 10 }} />
                          ) : (
                            <Typography variant="caption" color="text.disabled">—</Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <PaginationWrapper isDark={isDark}>
            <SimplePagination
              count={total}
              page={page}
              rowsPerPage={pageSize}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(0);
              }}
            />
          </PaginationWrapper>
        </Box>

        {/* ─── Splitter ─── */}
        <SplitterHandle
          isDragging={isDetailDragging}
          onMouseDown={handleDetailSplitterMouseDown}
        />

        {/* ─── RIGHT: Detail Panel (항상 표시) ─── */}
        <Box
          ref={detailPanelRef as React.Ref<HTMLDivElement>}
          sx={{
            width: detailWidth,
            minWidth: MIN_DETAIL_WIDTH,
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {selectedSession ? (
            <UserProfileSessionDetailPanel session={selectedSession} projectId={projectId} userId={userId} />
          ) : (
            <EmptyPlaceholder
              message={t(
                'argus.userProfiles.selectSessionForDetails',
                'Select a session to view details'
              )}
              sx={{ border: 'none', height: '100%' }}
            />
          )}
        </Box>
      </SplitContainer>
      </PageContentLoader>
    </Box>
  );
};

export default UserProfileSessionsTab;
