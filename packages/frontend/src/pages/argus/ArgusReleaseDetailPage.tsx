import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  useTheme,
  alpha,
  Skeleton,
  IconButton,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  NewReleases as ReleaseIcon,
  BugReport as BugReportIcon,
  People as PeopleIcon,
  Speed as SpeedIcon,
  Devices as DevicesIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
  ErrorOutline as ErrorIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import PageContentLoader from '@/components/common/PageContentLoader';
import argusService, { ArgusIssue } from '@/services/argusService';
import PageHeader from '@/components/common/PageHeader';

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return dateStr; }
}

function formatCompactNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

const LEVEL_COLORS: Record<string, string> = {
  fatal: '#f44336',
  error: '#ff5722',
  warning: '#ff9800',
  info: '#2196f3',
  debug: '#9e9e9e',
};

const ArgusReleaseDetailPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { projectId, release } = useParams<{ projectId: string; release: string }>();
  const isDark = theme.palette.mode === 'dark';

  const [loading, setLoading] = useState(true);
  const [releaseData, setReleaseData] = useState<any>(null);
  const [issues, setIssues] = useState<ArgusIssue[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(true);

  const decodedRelease = release ? decodeURIComponent(release) : '';

  const fetchReleaseData = useCallback(async () => {
    if (!projectId || !decodedRelease) return;
    setLoading(true);
    try {
      // Fetch releases and find matching one
      const releases = await argusService.getReleases(projectId, '90d');
      const found = releases?.find((r: any) => r.release === decodedRelease);
      setReleaseData(found || null);
    } catch (error) {
      console.error('Failed to fetch release:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, decodedRelease]);

  const fetchIssues = useCallback(async () => {
    if (!projectId) return;
    setIssuesLoading(true);
    try {
      // TODO: Add release filter to issues API when backend supports it
      const result = await argusService.listIssues(projectId, {
        status: 'unresolved',
        sort: 'last_seen',
        limit: 20,
        offset: 0,
      });
      setIssues(result.data);
    } catch (error) {
      console.error('Failed to fetch issues:', error);
    } finally {
      setIssuesLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchReleaseData();
    fetchIssues();
  }, [fetchReleaseData, fetchIssues]);

  const r = releaseData;
  const crashFree = r ? Number(r.crash_free_rate) : 100;
  const statusColor = crashFree >= 99 ? '#4caf50' : crashFree >= 95 ? '#ff9800' : '#f44336';

  return (
    <Box>
      {/* Header */}
      <PageHeader
        icon={<ReleaseIcon />}
        title={decodedRelease}
        onBack={() => navigate('/argus/releases')}
        actions={
          r && (
            <Chip
              icon={<CheckIcon sx={{ fontSize: '14px !important' }} />}
              label={`${crashFree.toFixed(1)}% ${t('argus.releases.crashFreeRate', 'Crash Free')}`}
              size="small"
              sx={{
                height: 24, fontWeight: 700, fontSize: '0.72rem',
                backgroundColor: alpha(statusColor, isDark ? 0.15 : 0.08),
                color: statusColor, border: `1px solid ${alpha(statusColor, 0.3)}`,
                '& .MuiChip-icon': { color: statusColor },
              }}
            />
          )
        }
      />

      <PageContentLoader loading={loading}>
        {!r ? (
          <Paper elevation={0} sx={{
            py: 8, textAlign: 'center',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            borderRadius: 2,
          }}>
            <ReleaseIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">
              {t('argus.releaseDetail.notFound', 'Release not found')}
            </Typography>
          </Paper>
        ) : (
          <>
            {/* Summary Stats */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 2, mb: 3 }}>
              {[
                { icon: <BugReportIcon />, color: '#f44336', label: t('argus.releases.errors', 'Errors'), value: Number(r.error_count) },
                { icon: <WarningIcon />, color: '#d50000', label: t('argus.releases.fatal', 'Fatal'), value: Number(r.fatal_count || 0) },
                { icon: <PeopleIcon />, color: '#ff9800', label: t('argus.releases.affectedUsers', 'Users'), value: Number(r.affected_users) },
                { icon: <BugReportIcon />, color: '#2196f3', label: t('argus.releases.issues', 'Issues'), value: Number(r.issue_count) },
                { icon: <DevicesIcon />, color: '#7c4dff', label: t('argus.releases.sessions', 'Sessions'), value: Number(r.total_sessions) },
                { icon: <SpeedIcon />, color: '#00bcd4', label: t('argus.releases.p95Latency', 'P95'), value: `${Math.round(Number(r.p95 || 0))}ms` },
              ].map((card, idx) => (
                <Paper key={idx} elevation={0} sx={{
                  p: 2,
                  background: isDark
                    ? `linear-gradient(135deg, ${alpha(card.color, 0.12)}, ${alpha(card.color, 0.03)})`
                    : `linear-gradient(135deg, ${alpha(card.color, 0.06)}, ${alpha(card.color, 0.01)})`,
                  border: `1px solid ${alpha(card.color, 0.2)}`,
                  borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5,
                }}>
                  <Box sx={{
                    width: 32, height: 32, borderRadius: 1.5,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: alpha(card.color, isDark ? 0.2 : 0.1), color: card.color,
                  }}>
                    {React.cloneElement(card.icon, { sx: { fontSize: 16 } })}
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.2, fontSize: '1rem' }}>
                      {typeof card.value === 'number' ? formatCompactNumber(card.value) : card.value}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.6rem', color: isDark ? '#888' : '#777' }}>
                      {card.label}
                    </Typography>
                  </Box>
                </Paper>
              ))}
            </Box>

            {/* Time range */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <ScheduleIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                {t('argus.releaseDetail.timeRange', 'Period')}: {formatDate(r.first_seen)} → {formatDate(r.last_seen)}
              </Typography>
            </Box>

            <Divider sx={{ mb: 3 }} />



            {/* Issues in this release */}
            <Box sx={{
              mb: 2, display: 'flex', alignItems: 'center', gap: 1,
              px: 2, py: 0.8,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 1.5,
              backgroundColor: theme.palette.background.paper,
            }}>
              <ErrorIcon sx={{ fontSize: 20, color: '#f44336' }} />
              <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1rem' }}>
                {t('argus.releaseDetail.issuesTitle', 'Issues in this Release')}
              </Typography>
              <Chip label={issues.length} size="small" sx={{
                height: 20, fontSize: '0.7rem', fontWeight: 700,
                backgroundColor: alpha('#f44336', 0.1), color: '#f44336',
              }} />

              {/* Compact Error Trend */}
              {r.error_trend && r.error_trend.length > 1 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 'auto' }}>
                  <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.secondary', fontWeight: 600 }}>
                    {t('argus.releaseDetail.errorTrend', 'Error Trend')}
                  </Typography>
                  <Box sx={{
                    display: 'flex', alignItems: 'flex-end', gap: '1px',
                    height: 26,
                    p: '3px 5px',
                    borderRadius: 1.5,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                  }}>
                    {(() => {
                      const data = r.error_trend as number[];
                      const max = Math.max(...data, 1);
                      return data.map((count, i) => {
                        const pct = (count / max) * 100;
                        return (
                          <Box
                            key={i}
                            sx={{
                              width: 4, borderRadius: '1px 1px 0 0',
                              height: `${Math.max(pct, count > 0 ? 15 : 0)}%`,
                              minHeight: count > 0 ? 2 : 0,
                              backgroundColor: count > 0
                                ? alpha('#f44336', 0.5 + pct / 200)
                                : alpha(theme.palette.text.disabled, 0.15),
                              transition: 'height 0.2s',
                            }}
                          />
                        );
                      });
                    })()}
                  </Box>
                </Box>
              )}
            </Box>

            <PageContentLoader loading={issuesLoading}>
              {issues.length === 0 ? (
                <Paper elevation={0} sx={{
                  py: 4, textAlign: 'center',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  borderRadius: 2,
                }}>
                  <CheckIcon sx={{ fontSize: 36, color: '#4caf50', mb: 1 }} />
                  <Typography color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                    {t('argus.releaseDetail.noIssues', 'No issues found')}
                  </Typography>
                </Paper>
              ) : (
                <Paper elevation={0} sx={{
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  borderRadius: 2, overflow: 'hidden',
                }}>
                  {issues.map((issue, idx) => {
                    const levelColor = LEVEL_COLORS[issue.level] || LEVEL_COLORS.info;
                    return (
                      <Box
                        key={issue.id}
                        onClick={() => navigate(`/argus/issues/${projectId}/${issue.id}`)}
                        sx={{
                          display: 'flex', alignItems: 'center', px: 2, py: 1.5, gap: 2,
                          cursor: 'pointer',
                          borderBottom: idx < issues.length - 1
                            ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`
                            : 'none',
                          '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)' },
                        }}
                      >
                        <Box sx={{
                          width: 4, height: 32, borderRadius: 1,
                          backgroundColor: levelColor, flexShrink: 0,
                        }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: '0.82rem' }}>
                            {issue.title}
                          </Typography>
                          <Typography variant="caption" noWrap sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>
                            {issue.culprit || issue.fingerprint?.slice(0, 16)}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                          {/* Sparkline */}
                          {issue.stats_24h && issue.stats_24h.length > 0 && (() => {
                            const data = issue.stats_24h!;
                            const max = Math.max(...data, 1);
                            const w = 40, h = 16;
                            const points = data.map((v, i) =>
                              `${(i / (data.length - 1)) * w},${h - (v / max) * h}`
                            ).join(' ');
                            return (
                              <svg width={w} height={h} style={{ flexShrink: 0, opacity: 0.7 }}>
                                <polyline
                                  points={points}
                                  fill="none"
                                  stroke={levelColor}
                                  strokeWidth={1.2}
                                  strokeLinejoin="round"
                                  strokeLinecap="round"
                                />
                              </svg>
                            );
                          })()}
                          <Tooltip title={t('argus.issues.events', 'Events')}>
                            <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.8rem', minWidth: 35, textAlign: 'right' }}>
                              {formatCompactNumber(issue.event_count || 0)}
                            </Typography>
                          </Tooltip>
                          <Tooltip title={t('argus.issues.users', 'Users')}>
                            <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary', minWidth: 30, textAlign: 'right' }}>
                              {formatCompactNumber(issue.user_count || 0)}
                            </Typography>
                          </Tooltip>
                        </Box>
                      </Box>
                    );
                  })}
                </Paper>
              )}
            </PageContentLoader>
          </>
        )}
      </PageContentLoader>
    </Box>
  );
};

export default ArgusReleaseDetailPage;
