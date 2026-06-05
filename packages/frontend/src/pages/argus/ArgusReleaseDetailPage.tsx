import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Tab,
  Tabs,
  useTheme,
  alpha,
  Skeleton,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  NewReleases as ReleaseIcon,
  BugReport as BugReportIcon,
  People as PeopleIcon,
  Speed as SpeedIcon,
  Devices as DevicesIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
  ErrorOutline as ErrorIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageContentLoader from '@/components/common/PageContentLoader';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import argusService, { ArgusIssue } from '@/services/argusService';
import PageHeader from '@/components/common/PageHeader';
import SimplePagination from '@/components/common/SimplePagination';
import { formatCompactNumber } from '@/utils/numberFormat';
import IssueListItem from '@/components/argus/IssueListItem';

const PAGE_SIZE_STORAGE_KEY = 'argus_release_issues_page_size';

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return dateStr; }
}

// --- Issue Tabs ---
type IssueTabType = 'all' | 'new' | 'unhandled' | 'regressed' | 'resolved';

const ISSUE_TABS: { key: IssueTabType; labelKey: string; fallback: string }[] = [
  { key: 'all', labelKey: 'argus.releaseDetail.allIssues', fallback: 'All' },
  { key: 'new', labelKey: 'argus.releaseDetail.newIssues', fallback: 'New' },
  { key: 'unhandled', labelKey: 'argus.releaseDetail.unhandledIssues', fallback: 'Unhandled' },
  { key: 'regressed', labelKey: 'argus.releaseDetail.regressedIssues', fallback: 'Regressed' },
  { key: 'resolved', labelKey: 'argus.releaseDetail.resolvedIssues', fallback: 'Resolved' },
];

// --- Mini Health Chart ---
const ReleaseHealthChart: React.FC<{
  data: { timestamp: string; crash_free_rate: number }[];
  isDark: boolean;
}> = ({ data, isDark }) => {
  if (!data || data.length < 2) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180 }}>
        <Typography variant="body2" color="text.disabled">No health data available</Typography>
      </Box>
    );
  }

  const maxVal = 100;
  const minVal = Math.min(...data.map(d => d.crash_free_rate), 90);
  const range = maxVal - minVal || 1;
  const chartWidth = 800;
  const chartHeight = 160;
  const padding = { top: 10, right: 40, bottom: 30, left: 50 };
  const innerW = chartWidth - padding.left - padding.right;
  const innerH = chartHeight - padding.top - padding.bottom;

  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * innerW,
    y: padding.top + (1 - (d.crash_free_rate - minVal) / range) * innerH,
    value: d.crash_free_rate,
    ts: d.timestamp,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + innerH} L ${points[0].x} ${padding.top + innerH} Z`;

  const lineColor = '#4caf50';
  const yTicks = [minVal, (minVal + maxVal) / 2, maxVal];
  const xLabels = data.length > 6
    ? [0, Math.floor(data.length / 3), Math.floor(2 * data.length / 3), data.length - 1]
    : data.map((_, i) => i);

  return (
    <Paper elevation={0} sx={{
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      borderRadius: 2, p: 2, mb: 3,
    }}>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <CheckIcon sx={{ fontSize: 16, color: lineColor }} />
        Crash Free Rate
      </Typography>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} width="100%" style={{ maxHeight: 180 }}>
        {/* Y-axis grid + labels */}
        {yTicks.map(tick => {
          const y = padding.top + (1 - (tick - minVal) / range) * innerH;
          return (
            <g key={tick}>
              <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y}
                stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'} strokeDasharray="3,3" />
              <text x={padding.left - 8} y={y + 4} textAnchor="end"
                fill={isDark ? '#888' : '#999'} fontSize={11}>{tick.toFixed(1)}%</text>
            </g>
          );
        })}
        {/* X-axis labels */}
        {xLabels.map(idx => {
          const p = points[idx as number];
          if (!p) return null;
          const label = new Date(data[idx as number].timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          return (
            <text key={idx} x={p.x} y={chartHeight - 5} textAnchor="middle"
              fill={isDark ? '#888' : '#999'} fontSize={10}>{label}</text>
          );
        })}
        {/* Area fill */}
        <path d={areaPath} fill={alpha(lineColor, 0.08)} />
        {/* Line */}
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" />
        {/* Dots */}
        {points.map((p, i) => (
          <Tooltip key={i} title={`${p.value.toFixed(2)}% — ${new Date(p.ts).toLocaleString()}`}>
            <circle cx={p.x} cy={p.y} r={3} fill={lineColor} stroke="#fff" strokeWidth={1.5}
              style={{ cursor: 'pointer' }} />
          </Tooltip>
        ))}
      </svg>
    </Paper>
  );
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
  const [issueTab, setIssueTab] = useState<IssueTabType>('all');
  const [healthData, setHealthData] = useState<{ timestamp: string; crash_free_rate: number }[]>([]);

  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1', 10);
  const [rowsPerPage, setRowsPerPage] = useState<number>(() => {
    const saved = localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    const parsed = parseInt(saved || '', 10);
    return !isNaN(parsed) && parsed > 0 ? parsed : 25;
  });
  const [totalIssues, setTotalIssues] = useState(0);

  useEffect(() => {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(rowsPerPage));
  }, [rowsPerPage]);

  const decodedRelease = release ? decodeURIComponent(release) : '';

  const fetchReleaseData = useCallback(async () => {
    if (!projectId || !decodedRelease) return;
    setLoading(true);
    try {
      const releases = await argusService.getReleases(projectId, '90d');
      const found = releases?.find((r: any) => r.release === decodedRelease);
      setReleaseData(found || null);
    } catch (error) {
      console.error('Failed to fetch release:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, decodedRelease]);

  const fetchHealthData = useCallback(async () => {
    if (!projectId || !decodedRelease) return;
    try {
      const data = await argusService.getReleaseHealth(projectId, decodedRelease, '30d');
      setHealthData(data || []);
    } catch {
      // API might not exist yet, silently fail
      setHealthData([]);
    }
  }, [projectId, decodedRelease]);

  const fetchIssues = useCallback(async () => {
    if (!projectId) return;
    setIssuesLoading(true);
    try {
      const params: Record<string, any> = {
        release: decodedRelease,
        sort: 'last_seen',
        limit: rowsPerPage,
        offset: (page - 1) * rowsPerPage,
      };

      // Map tab to API params
      switch (issueTab) {
        case 'new':
          params.substatus = 'new';
          break;
        case 'unhandled':
          params.is_unhandled = true;
          break;
        case 'regressed':
          params.substatus = 'regressed';
          break;
        case 'resolved':
          params.status = 'resolved';
          break;
        default:
          params.status = 'unresolved';
      }

      const result = await argusService.listIssues(projectId, params);
      setIssues(result.data);
      setTotalIssues(result.total || 0);
    } catch (error) {
      console.error('Failed to fetch issues:', error);
      setIssues([]);
      setTotalIssues(0);
    } finally {
      setIssuesLoading(false);
    }
  }, [projectId, decodedRelease, page, rowsPerPage, issueTab]);

  useEffect(() => { fetchReleaseData(); fetchHealthData(); }, [fetchReleaseData, fetchHealthData]);
  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  // Reset page when tab changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set('page', '1');
    setSearchParams(params);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueTab]);

  const r = releaseData;
  const crashFree = r ? Number(r.crash_free_rate) : 100;
  const statusColor = crashFree >= 99 ? '#4caf50' : crashFree >= 95 ? '#ff9800' : '#f44336';

  return (
    <Box>
      {/* Header */}
      <PageHeader
        icon={<ReleaseIcon />}
        title={
          <ArgusBreadcrumbs size="title" paths={[
            { label: t('argus.releases.title', 'Releases'), to: `/argus/releases` },
            { label: decodedRelease }
          ]} />
        }
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

            {/* Release Health Chart */}
            <ReleaseHealthChart data={healthData} isDark={isDark} />

            <Divider sx={{ mb: 3 }} />

            {/* Issues Section */}
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
              <Chip label={totalIssues} size="small" sx={{
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
                      return data.map((count: number, i: number) => {
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

            {/* Issue Tabs */}
            <Tabs
              value={issueTab}
              onChange={(_, v) => setIssueTab(v)}
              sx={{
                mb: 2, minHeight: 36,
                '& .MuiTab-root': {
                  minHeight: 36, py: 0.5, fontSize: '0.78rem', fontWeight: 600,
                  textTransform: 'none',
                },
                '& .MuiTabs-indicator': { height: 2.5, borderRadius: 1 },
              }}
            >
              {ISSUE_TABS.map(tab => (
                <Tab key={tab.key} label={t(tab.labelKey, tab.fallback)} value={tab.key} />
              ))}
            </Tabs>

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
                  {issues.map((issue, idx) => (
                    <IssueListItem
                      key={issue.id}
                      issue={issue}
                      onClick={() => navigate(`/argus/issues/${projectId}/${issue.id}`)}
                      showCheckbox={false}
                      showAssignee={false}
                      showSparkline
                      showLastSeen
                      isFirst={idx === 0}
                      isLast={idx === issues.length - 1}
                      showDivider={idx < issues.length - 1}
                    />
                  ))}
                </Paper>
              )}

              {totalIssues > 0 && (
                <Box sx={{ mt: 3 }}>
                  <SimplePagination
                    count={totalIssues}
                    page={page - 1}
                    rowsPerPage={rowsPerPage}
                    onPageChange={(_, newPage) => {
                      const params = new URLSearchParams(searchParams);
                      params.set('page', String(newPage + 1));
                      setSearchParams(params);
                    }}
                    onRowsPerPageChange={(e) => {
                      setRowsPerPage(Number(e.target.value));
                      const params = new URLSearchParams(searchParams);
                      params.set('page', '1');
                      setSearchParams(params);
                    }}
                    size="small"
                  />
                </Box>
              )}
            </PageContentLoader>
          </>
        )}
      </PageContentLoader>
    </Box>
  );
};

export default ArgusReleaseDetailPage;
