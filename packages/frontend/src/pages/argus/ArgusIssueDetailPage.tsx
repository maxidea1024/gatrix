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
  alpha,
  Tooltip,
  Collapse,
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
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  FolderOpen as FolderIcon,
  Schedule as ScheduleIcon,
  DeviceHub as DeviceIcon,
  Language as LanguageIcon,
  Person as PersonIcon,
  Sell as TagIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import argusService, { ArgusIssueDetail } from '@/services/argusService';

const LEVEL_COLORS: Record<string, string> = {
  fatal: '#f44336',
  error: '#ff5722',
  warning: '#ff9800',
  info: '#2196f3',
  debug: '#9e9e9e',
};

const ArgusIssueDetailPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isDark = theme.palette.mode === 'dark';
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
  const levelColor = LEVEL_COLORS[issue?.level || 'error'] || LEVEL_COLORS.error;

  return (
    <PageContentLoader loading={loading}>
      {!issue ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <BugReportIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">Issue not found</Typography>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
            Go Back
          </Button>
        </Box>
      ) : (
        <Box>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
            <IconButton onClick={() => navigate(-1)} size="small" sx={{ mt: 0.3 }}>
              <ArrowBackIcon />
            </IconButton>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Box sx={{ width: 4, height: 24, borderRadius: 1, backgroundColor: levelColor }} />
                <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.3 }}>
                  {issue.title}
                </Typography>
                <Chip
                  label={issue.level}
                  size="small"
                  sx={{
                    fontWeight: 700, fontSize: '0.68rem', height: 20,
                    backgroundColor: alpha(levelColor, 0.12),
                    color: levelColor, border: 'none',
                  }}
                />
              </Box>
              {issue.culprit && (
                <Typography variant="body2" sx={{ color: isDark ? '#777' : '#999', ml: 2, fontSize: '0.85rem' }}>
                  {issue.culprit}
                </Typography>
              )}
            </Box>
          </Box>

          {/* Action Bar */}
          <Paper
            elevation={0}
            sx={{
              p: 1.5, mb: 3, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              borderRadius: 2,
            }}
          >
            <Chip
              label={issue.status}
              size="small"
              sx={{
                fontWeight: 700, fontSize: '0.72rem', textTransform: 'capitalize',
                backgroundColor: alpha(
                  issue.status === 'resolved' ? '#4caf50' : issue.status === 'ignored' ? '#9e9e9e' : '#f44336', 0.12
                ),
                color: issue.status === 'resolved' ? '#4caf50' : issue.status === 'ignored' ? '#9e9e9e' : '#f44336',
                border: 'none',
              }}
            />
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {issue.status !== 'resolved' && (
              <Button variant="outlined" size="small" color="success" startIcon={<CheckCircleIcon />}
                onClick={() => handleStatusChange('resolved')}
                sx={{ borderRadius: 1.5, textTransform: 'none', fontSize: '0.78rem' }}
              >
                Resolve
              </Button>
            )}
            {issue.status !== 'ignored' && (
              <Button variant="outlined" size="small" color="inherit" startIcon={<IgnoreIcon />}
                onClick={() => handleStatusChange('ignored')}
                sx={{ borderRadius: 1.5, textTransform: 'none', fontSize: '0.78rem' }}
              >
                Ignore
              </Button>
            )}
            {issue.status !== 'unresolved' && (
              <Button variant="outlined" size="small" color="error" startIcon={<ErrorIcon />}
                onClick={() => handleStatusChange('unresolved')}
                sx={{ borderRadius: 1.5, textTransform: 'none', fontSize: '0.78rem' }}
              >
                Reopen
              </Button>
            )}
            {issue.is_regression && (
              <Chip label="Regression" size="small" sx={{
                fontWeight: 700, fontSize: '0.68rem',
                backgroundColor: alpha('#ff9800', 0.12), color: '#ff9800', border: 'none',
              }} />
            )}
            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {issue.fingerprint && (
                <Tooltip title="핑거프린트 복사">
                  <Chip
                    icon={<CopyIcon sx={{ fontSize: '12px !important' }} />}
                    label={`FP: ${issue.fingerprint.slice(0, 8)}`}
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(issue.fingerprint);
                    }}
                    sx={{
                      cursor: 'pointer', height: 22, fontSize: '0.68rem',
                      fontFamily: 'monospace',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                      '& .MuiChip-icon': { color: isDark ? '#555' : '#bbb' },
                      border: 'none',
                    }}
                  />
                </Tooltip>
              )}
              {latestEvent?.event_id && (
                <Tooltip title="이벤트 ID 복사">
                  <Chip
                    icon={<CopyIcon sx={{ fontSize: '12px !important' }} />}
                    label={`ID: ${latestEvent.event_id.slice(0, 8)}`}
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(latestEvent.event_id);
                    }}
                    sx={{
                      cursor: 'pointer', height: 22, fontSize: '0.68rem',
                      fontFamily: 'monospace',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                      '& .MuiChip-icon': { color: isDark ? '#555' : '#bbb' },
                      border: 'none',
                    }}
                  />
                </Tooltip>
              )}
            </Box>
          </Paper>

          {/* Summary Stats */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 2, mb: 3 }}>
            <StatMini label="Events" value={issue.event_count?.toLocaleString() || '0'} color={levelColor} />
            <StatMini label="Users Affected" value={issue.user_count?.toLocaleString() || '0'} color="#ff9800" />
            <StatMini label="First Seen" value={issue.first_seen ? formatRelative(issue.first_seen) : '-'} color="#7c4dff" />
            <StatMini label="Last Seen" value={issue.last_seen ? formatRelative(issue.last_seen) : '-'} color="#2196f3" />
          </Box>

          {/* Latest Event */}
          {latestEvent && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Exception + Stacktrace */}
              <Paper elevation={0} sx={{
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                borderRadius: 2, overflow: 'hidden',
              }}>
                {/* Exception header */}
                <Box sx={{
                  p: 2, backgroundColor: alpha(levelColor, 0.06),
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                }}>
                  <Typography variant="body1" fontWeight={700} sx={{ color: levelColor, fontFamily: 'monospace' }}>
                    {latestEvent.exception_type}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, color: isDark ? '#aaa' : '#666' }}>
                    {latestEvent.exception_value}
                  </Typography>
                </Box>

                {/* Stacktrace */}
                <StacktraceView stacktrace={latestEvent.stacktrace_raw} isDark={isDark} />
              </Paper>

              {/* Context Grid */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                {/* Environment Context */}
                <Paper elevation={0} sx={{
                  p: 2, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  borderRadius: 2,
                }}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <DeviceIcon fontSize="small" sx={{ color: theme.palette.primary.main }} />
                    Context
                  </Typography>
                  <ContextGrid items={[
                    latestEvent.environment && { label: 'Environment', value: latestEvent.environment },
                    latestEvent.release && { label: 'Release', value: latestEvent.release },
                    latestEvent.browser && { label: 'Browser', value: `${latestEvent.browser} ${latestEvent.browser_version || ''}` },
                    latestEvent.os && { label: 'OS', value: `${latestEvent.os} ${latestEvent.os_version || ''}` },
                    latestEvent.transaction && { label: 'Transaction', value: latestEvent.transaction },
                  ].filter(Boolean) as { label: string; value: string }[]} isDark={isDark} />
                </Paper>

                {/* User + Tags */}
                <Paper elevation={0} sx={{
                  p: 2, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  borderRadius: 2,
                }}>
                  {(latestEvent.user_email || latestEvent.user_ip) && (
                    <>
                      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PersonIcon fontSize="small" sx={{ color: theme.palette.warning.main }} />
                        User
                      </Typography>
                      <ContextGrid items={[
                        latestEvent.user_email && { label: 'Email', value: latestEvent.user_email },
                        latestEvent.user_ip && { label: 'IP', value: latestEvent.user_ip },
                      ].filter(Boolean) as { label: string; value: string }[]} isDark={isDark} />
                      <Divider sx={{ my: 1.5 }} />
                    </>
                  )}
                  {latestEvent.tags && Object.keys(typeof latestEvent.tags === 'string' ? JSON.parse(latestEvent.tags) : latestEvent.tags).length > 0 && (
                    <>
                      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <TagIcon fontSize="small" sx={{ color: theme.palette.info.main }} />
                        Tags
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {Object.entries(typeof latestEvent.tags === 'string' ? JSON.parse(latestEvent.tags) : latestEvent.tags)
                          .map(([key, val]) => (
                            <Chip
                              key={key}
                              label={`${key}: ${val}`}
                              size="small"
                              variant="outlined"
                              sx={{
                                borderRadius: 1, fontSize: '0.72rem', height: 24,
                                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                              }}
                            />
                          ))}
                      </Box>
                    </>
                  )}
                </Paper>
              </Box>

              {/* Breadcrumbs */}
              {latestEvent.breadcrumbs && (
                <BreadcrumbsTimeline breadcrumbs={latestEvent.breadcrumbs} isDark={isDark} />
              )}
            </Box>
          )}
        </Box>
      )}
    </PageContentLoader>
  );
};

// --- Stacktrace Viewer ---
const StacktraceView: React.FC<{ stacktrace: any; isDark: boolean }> = ({ stacktrace, isDark }) => {
  const [expandedFrames, setExpandedFrames] = useState<Set<number>>(new Set());

  let frames: any[] = [];
  try {
    frames = typeof stacktrace === 'string' ? JSON.parse(stacktrace) : (Array.isArray(stacktrace) ? stacktrace : []);
  } catch { frames = []; }

  if (frames.length === 0) return null;

  // Show in-app frames expanded by default
  const inAppIndices = new Set(frames.map((f: any, i: number) => f.in_app ? i : -1).filter((i: number) => i >= 0));

  const toggleFrame = (idx: number) => {
    setExpandedFrames(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  return (
    <Box>
      {frames.map((frame: any, idx: number) => {
        const isInApp = frame.in_app;
        const isExpanded = expandedFrames.has(idx) || inAppIndices.has(idx);
        return (
          <Box key={idx}>
            <Box
              onClick={() => toggleFrame(idx)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: 2, py: 0.8,
                cursor: 'pointer',
                backgroundColor: isInApp ? alpha('#7c4dff', isDark ? 0.08 : 0.04) : 'transparent',
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' },
                transition: 'background 0.15s',
              }}
            >
              {isExpanded ? <ExpandLessIcon sx={{ fontSize: 16, color: 'text.secondary' }} /> : <ExpandMoreIcon sx={{ fontSize: 16, color: 'text.secondary' }} />}
              {isInApp && <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#7c4dff', flexShrink: 0 }} />}
              <Typography variant="body2" sx={{
                fontFamily: 'monospace', fontSize: '0.78rem',
                color: isInApp ? (isDark ? '#bb86fc' : '#6200ea') : (isDark ? '#777' : '#999'),
                fontWeight: isInApp ? 600 : 400,
              }}>
                {frame.function || '<anonymous>'}
              </Typography>
              <Typography variant="caption" sx={{ ml: 'auto', fontFamily: 'monospace', fontSize: '0.7rem', color: isDark ? '#555' : '#bbb', flexShrink: 0 }}>
                {frame.filename ? `${frame.filename}:${frame.lineno || '?'}` : ''}
              </Typography>
            </Box>
            <Collapse in={isExpanded}>
              {frame.context_line && (
                <Box sx={{
                  px: 2, py: 1, mx: 2, my: 0.5,
                  backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.03)',
                  borderRadius: 1, borderLeft: `3px solid ${isInApp ? '#7c4dff' : '#555'}`,
                }}>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: isDark ? '#ddd' : '#333', whiteSpace: 'pre' }}>
                    {frame.lineno && <Box component="span" sx={{ color: isDark ? '#555' : '#bbb', mr: 1, userSelect: 'none' }}>{frame.lineno}</Box>}
                    {frame.context_line}
                  </Typography>
                </Box>
              )}
            </Collapse>
          </Box>
        );
      })}
    </Box>
  );
};

// --- Breadcrumbs Timeline ---
const BreadcrumbsTimeline: React.FC<{ breadcrumbs: any; isDark: boolean }> = ({ breadcrumbs, isDark }) => {
  let items: any[] = [];
  try {
    items = typeof breadcrumbs === 'string' ? JSON.parse(breadcrumbs) : (Array.isArray(breadcrumbs) ? breadcrumbs : []);
  } catch { items = []; }

  if (items.length === 0) return null;

  const categoryIcons: Record<string, React.ReactElement> = {
    navigation: <LanguageIcon sx={{ fontSize: 14 }} />,
    http: <DeviceIcon sx={{ fontSize: 14 }} />,
    'ui.click': <InfoIcon sx={{ fontSize: 14 }} />,
    console: <WarningIcon sx={{ fontSize: 14 }} />,
  };
  const categoryColors: Record<string, string> = {
    navigation: '#2196f3',
    http: '#7c4dff',
    'ui.click': '#4caf50',
    console: '#ff9800',
    default: '#9e9e9e',
  };

  return (
    <Paper elevation={0} sx={{
      p: 2, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      borderRadius: 2,
    }}>
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <ScheduleIcon fontSize="small" sx={{ color: '#7c4dff' }} />
        Breadcrumbs
      </Typography>
      <Box>
        {items.map((bc: any, idx: number) => {
          const color = categoryColors[bc.category] || categoryColors.default;
          const icon = categoryIcons[bc.category] || <InfoIcon sx={{ fontSize: 14 }} />;
          return (
            <Box key={idx} sx={{ display: 'flex', gap: 1.5, position: 'relative' }}>
              {/* Timeline line */}
              <Box sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0,
              }}>
                <Box sx={{
                  width: 20, height: 20, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: alpha(color, isDark ? 0.2 : 0.1), color,
                }}>
                  {icon}
                </Box>
                {idx < items.length - 1 && (
                  <Box sx={{ width: 1, flex: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />
                )}
              </Box>
              {/* Content */}
              <Box sx={{ pb: 1.5, flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip label={bc.category} size="small" sx={{
                    height: 18, fontSize: '0.62rem', fontWeight: 600,
                    backgroundColor: alpha(color, isDark ? 0.15 : 0.08), color,
                    border: 'none',
                  }} />
                  {bc.timestamp && (
                    <Typography variant="caption" sx={{ color: isDark ? '#555' : '#bbb', fontSize: '0.65rem' }}>
                      {new Date(bc.timestamp).toLocaleTimeString()}
                    </Typography>
                  )}
                </Box>
                <Typography variant="body2" sx={{ mt: 0.3, fontSize: '0.8rem', color: isDark ? '#aaa' : '#555' }}>
                  {bc.message}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
};

// --- Helpers ---
const StatMini: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => {
  const isDark = useTheme().palette.mode === 'dark';
  return (
    <Paper elevation={0} sx={{
      p: 2, textAlign: 'center',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      borderRadius: 2,
      borderTop: `3px solid ${alpha(color, 0.6)}`,
    }}>
      <Typography variant="h6" fontWeight={700}>{value}</Typography>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Paper>
  );
};

const ContextGrid: React.FC<{ items: { label: string; value: string }[]; isDark: boolean }> = ({ items, isDark }) => (
  <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px' }}>
    {items.map((item) => (
      <React.Fragment key={item.label}>
        <Typography variant="caption" sx={{ color: isDark ? '#666' : '#999', fontWeight: 500 }}>{item.label}</Typography>
        <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 500, fontSize: '0.78rem' }}>{item.value}</Typography>
      </React.Fragment>
    ))}
  </Box>
);

function formatRelative(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);

    if (mins < 1) return '방금';
    if (mins < 60) return `${mins}분 전`;
    if (hrs < 24) return `${hrs}시간 전`;
    if (days < 30) return `${days}일 전`;
    return d.toLocaleDateString('ko-KR');
  } catch {
    return dateStr;
  }
}

export default ArgusIssueDetailPage;
