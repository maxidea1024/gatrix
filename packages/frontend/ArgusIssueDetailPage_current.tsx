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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  TextField,
  InputAdornment,
  Snackbar,
  Alert,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Avatar,
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
  Article as LogIcon,
  Search as SearchIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  FileDownload as ExportIcon,
  AccessTime as GotoTimeIcon,
  Close as CloseIcon,
  WrapText as WrapTextIcon,
} from '@mui/icons-material';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import argusService, {
  ArgusIssueDetail,
  ArgusErrorEvent,
  ArgusTraceDetail,
  ArgusLogEntry,
} from '@/services/argusService';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { rbacService } from '@/services/rbacService';
import PageHeader from '@/components/common/PageHeader';
import SegmentedTabs from '@/components/common/SegmentedTabs';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import { CopyButton } from '@/components/common/CopyButton';
import TraceWaterfall from '@/components/argus/TraceWaterfall';
import BreadcrumbsTimeline from '@/components/argus/BreadcrumbsTimeline';
import EventNavigator from '@/components/argus/EventNavigator';
import EventDistributionChart from '@/components/argus/EventDistributionChart';
import ActivityTimeline from '@/components/argus/ActivityTimeline';
import TagDistribution from '@/components/argus/TagDistribution';
import AiRootCausePanel from '@/components/argus/AiRootCausePanel';
import PresenceIndicator from '@/components/argus/PresenceIndicator';
import BusinessImpactWidget from '@/components/argus/BusinessImpactWidget';
import IssueTrackerWidget from '@/components/argus/IssueTrackerWidget';
import SuspectCommits from '@/components/argus/SuspectCommits';
import { useArgusUrlState } from '@/hooks/useArgusUrlState';

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#f44336',
    '#e91e63',
    '#9c27b0',
    '#673ab7',
    '#3f51b5',
    '#2196f3',
    '#00bcd4',
    '#009688',
    '#4caf50',
    '#ff9800',
  ];
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

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
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const { projectId, issueId } = useParams<{
    projectId: string;
    issueId: string;
  }>();

  const location = useLocation();
  const URL_PARAMS = React.useMemo(
    () => ({
      tab: { key: 'tab', default: 'details' },
    }),
    []
  );
  const [urlState, setUrlState] = useArgusUrlState(URL_PARAMS);
  const activeTab = urlState.tab;

  const [issue, setIssue] = useState<ArgusIssueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);
  const [assigneeAnchor, setAssigneeAnchor] = useState<HTMLElement | null>(
    null
  );
  const [priorityAnchor, setPriorityAnchor] = useState<HTMLElement | null>(
    null
  );
  const [currentEvent, setCurrentEvent] = useState<ArgusErrorEvent | null>(
    null
  );

  useEffect(() => {
    if (!projectId) return;
    const fetchMembers = async () => {
      try {
        const data = await rbacService.getProjectMembers(projectId);
        setMembers(data);
      } catch (error) {
        console.error('Failed to fetch project members:', error);
      }
    };
    fetchMembers();
  }, [projectId]);

  // Trace states
  const [traceDetail, setTraceDetail] = useState<ArgusTraceDetail | null>(null);
  const [loadingTrace, setLoadingTrace] = useState(false);
  const [showTrace, setShowTrace] = useState(false);

  // Logs state
  const [logs, setLogs] = useState<ArgusLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [logsHasMore, setLogsHasMore] = useState(false);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const [logsFullscreen, setLogsFullscreen] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [logGotoTime, setLogGotoTime] = useState('');
  const [wrapLines, setWrapLines] = useState(false);
  const [showLogGoto, setShowLogGoto] = useState(false);

  const logContainerRef = React.useRef<HTMLDivElement>(null);

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

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    status: string;
  }>({ open: false, status: '' });

  const executeStatusChange = async () => {
    if (!projectId || !issueId || !issue || !confirmDialog.status) return;
    try {
      await argusService.updateIssueStatus(
        projectId,
        issueId,
        confirmDialog.status
      );
      setIssue({ ...issue, status: confirmDialog.status });
      setConfirmDialog({ open: false, status: '' });
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const requestStatusChange = (status: string) => {
    setConfirmDialog({ open: true, status });
  };

  const handleAssign = async (assignee: string) => {
    if (!projectId || !issueId || !issue) return;
    try {
      await argusService.assignIssue(projectId, issueId, assignee || null);
      setIssue({ ...issue, assigned_to: assignee || null });
    } catch (error) {
      console.error('Failed to assign issue:', error);
    }
  };

  const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
    critical: { color: '#f44336', label: t('argus.issues.priority.critical') },
    high: { color: '#ff5722', label: t('argus.issues.priority.high') },
    medium: { color: '#ff9800', label: t('argus.issues.priority.medium') },
    low: { color: '#9e9e9e', label: t('argus.issues.priority.low') },
  };

  const handlePriorityChange = async (priority: string) => {
    if (!projectId || !issueId || !issue) return;
    try {
      // Use same patch endpoint as assignIssue (PATCH /issues/:id with field)
      await argusService.updateIssueStatus(projectId, issueId, issue.status);
      setIssue({ ...issue, priority: priority as any });
    } catch (error) {
      console.error('Failed to update priority:', error);
    }
    setPriorityAnchor(null);
  };

  const loadTrace = async (tid: string) => {
    if (!projectId) return;
    setLoadingTrace(true);
    setShowTrace(true);
    try {
      const data = await argusService.getTraceDetail(projectId, tid);
      setTraceDetail(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTrace(false);
    }
  };

  const latestEvent = currentEvent || issue?.latest_event;
  const levelColor =
    LEVEL_COLORS[issue?.level || 'error'] || LEVEL_COLORS.error;

  // Extract trace_id
  let traceId = null;
  if (latestEvent) {
    if (latestEvent.contexts) {
      try {
        const ctx =
          typeof latestEvent.contexts === 'string'
            ? JSON.parse(latestEvent.contexts)
            : latestEvent.contexts;
        traceId = ctx?.trace?.trace_id;
      } catch (e) {}
    }
    if (!traceId && latestEvent.tags) {
      try {
        const tags =
          typeof latestEvent.tags === 'string'
            ? JSON.parse(latestEvent.tags)
            : latestEvent.tags;
        traceId = tags?.trace_id || tags?.['sentry:trace'];
      } catch (e) {}
    }
  }

  return (
    <PageContentLoader loading={loading}>
      {!issue ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <BugReportIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">
            {t('argus.issues.issueNotFound')}
          </Typography>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
            sx={{ mt: 2 }}
          >
            {t('argus.issues.goBack')}
          </Button>
        </Box>
      ) : (
        <Box>
          {/* Header */}
          <PageHeader
            icon={
              <Box
                sx={{
                  width: 4,
                  height: 18,
                  borderRadius: 1,
                  backgroundColor: levelColor,
                  ml: 1,
                }}
              />
            }
            title={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  sx={{ lineHeight: 1.3 }}
                >
                  {issue.title}
                </Typography>
                <Chip
                  label={issue.level}
                  size="small"
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.65rem',
                    height: 18,
                    backgroundColor: alpha(levelColor, 0.12),
                    color: levelColor,
                    border: 'none',
                  }}
                />
              </Box>
            }
            subtitle={issue.culprit}
            enableAutoBack
            headerActions={
              <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography
                    variant="h6"
                    fontWeight={700}
                    sx={{ lineHeight: 1, fontSize: '1.2rem' }}
                  >
                    {issue.event_count?.toLocaleString() || '0'}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', fontSize: '0.65rem' }}
                  >
                    {t('argus.issues.events')}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography
                    variant="h6"
                    fontWeight={700}
                    sx={{ lineHeight: 1, fontSize: '1.2rem' }}
                  >
                    {issue.user_count?.toLocaleString() || '0'}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', fontSize: '0.65rem' }}
                  >
                    {t('argus.issues.users')}
                  </Typography>
                </Box>
              </Box>
            }
          />

          {/* Action Bar */}
          <Box
            sx={{
              py: 1.5,
              mb: 2,
              display: 'flex',
              gap: 1,
              alignItems: 'center',
              flexWrap: 'wrap',
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            }}
          >
            <Chip
              label={t(`argus.issues.${issue.status}`, issue.status)}
              size="small"
              sx={{
                fontWeight: 700,
                fontSize: '0.72rem',
                textTransform: 'capitalize',
                backgroundColor: alpha(
                  issue.status === 'resolved'
                    ? '#4caf50'
                    : issue.status === 'ignored'
                      ? '#9e9e9e'
                      : '#f44336',
                  0.12
                ),
                color:
                  issue.status === 'resolved'
                    ? '#4caf50'
                    : issue.status === 'ignored'
                      ? '#9e9e9e'
                      : '#f44336',
                border: 'none',
              }}
            />
            {issue.substatus === 'regressed' && (
              <Chip
                label={t('argus.issues.regressed', 'Regressed')}
                size="small"
                sx={{
                  fontWeight: 700,
                  fontSize: '0.68rem',
                  backgroundColor: alpha('#ff9800', 0.15),
                  color: '#ff9800',
                  border: 'none',
                }}
              />
            )}
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {issue.status !== 'resolved' && (
              <Button
                variant="outlined"
                size="small"
                color="success"
                startIcon={<CheckCircleIcon />}
                onClick={() => requestStatusChange('resolved')}
                sx={{
                  borderRadius: 1.5,
                  textTransform: 'none',
                  fontSize: '0.78rem',
                }}
              >
                {t('argus.issues.resolve')}
              </Button>
            )}
            {issue.status !== 'ignored' && (
              <Button
                variant="outlined"
                size="small"
                color="inherit"
                startIcon={<IgnoreIcon />}
                onClick={() => requestStatusChange('ignored')}
                sx={{
                  borderRadius: 1.5,
                  textTransform: 'none',
                  fontSize: '0.78rem',
                }}
              >
                {t('argus.issues.ignore')}
              </Button>
            )}
            {issue.status !== 'unresolved' && (
              <Button
                variant="outlined"
                size="small"
                color="error"
                startIcon={<ErrorIcon />}
                onClick={() => requestStatusChange('unresolved')}
                sx={{
                  borderRadius: 1.5,
                  textTransform: 'none',
                  fontSize: '0.78rem',
                }}
              >
                {t('argus.issues.reopen')}
              </Button>
            )}
            {issue.is_regression && (
              <Chip
                label={t('argus.issues.regression')}
                size="small"
                sx={{
                  fontWeight: 700,
                  fontSize: '0.68rem',
                  backgroundColor: alpha('#ff9800', 0.12),
                  color: '#ff9800',
                  border: 'none',
                }}
              />
            )}

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Priority */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Chip
                label={
                  PRIORITY_CONFIG[issue.priority || 'medium']?.label ||
                  t('argus.issues.priority.medium')
                }
                size="small"
                onClick={(e) => setPriorityAnchor(e.currentTarget)}
                sx={{
                  height: 22,
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: alpha(
                    PRIORITY_CONFIG[issue.priority || 'medium']?.color ||
                      '#ff9800',
                    0.12
                  ),
                  color:
                    PRIORITY_CONFIG[issue.priority || 'medium']?.color ||
                    '#ff9800',
                  border: 'none',
                }}
              />
            </Box>
            <Menu
              anchorEl={priorityAnchor}
              open={Boolean(priorityAnchor)}
              onClose={() => setPriorityAnchor(null)}
              slotProps={{
                paper: {
                  sx: {
                    borderRadius: 2,
                    minWidth: 140,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                  },
                },
              }}
            >
              {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                <MenuItem
                  key={key}
                  selected={issue.priority === key}
                  onClick={() => handlePriorityChange(key)}
                  sx={{ fontSize: '0.82rem' }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: cfg.color,
                      mr: 1,
                    }}
                  />
                  {cfg.label}
                </MenuItem>
              ))}
            </Menu>

            {/* Assignee */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <PersonIcon
                sx={{
                  fontSize: 16,
                  color: issue.assigned_to ? 'primary.main' : 'text.disabled',
                }}
              />
              {issue.assigned_to ? (
                <Chip
                  label={issue.assigned_to}
                  size="small"
                  onClick={(e) => setAssigneeAnchor(e.currentTarget)}
                  onDelete={() => handleAssign('')}
                  sx={{
                    height: 22,
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    backgroundColor: alpha(theme.palette.primary.main, 0.08),
                    color: 'primary.main',
                    border: 'none',
                  }}
                />
              ) : (
                <Tooltip title={t('argus.issues.assign', 'Assign')}>
                  <Chip
                    label={t('argus.issues.unassigned', 'Unassigned')}
                    size="small"
                    onClick={(e) => setAssigneeAnchor(e.currentTarget)}
                    sx={{
                      height: 22,
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.04)'
                        : 'rgba(0,0,0,0.04)',
                      border: 'none',
                    }}
                  />
                </Tooltip>
              )}
            </Box>

            <Box
              sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}
            >
              {/* Multiplayer Presence */}
              {projectId && issueId && (
                <PresenceIndicator
                  projectId={projectId}
                  resourceId={issueId}
                  resourceType="issue"
                  currentUser={{ id: 'current-user', name: 'You' }}
                  isDark={isDark}
                />
              )}
              <Divider orientation="vertical" flexItem sx={{ mx: 0.3 }} />
              {issue.fingerprint && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Chip
                    label={`FP: ${issue.fingerprint.slice(0, 8)}`}
                    size="small"
                    sx={{
                      cursor: 'default',
                      height: 22,
                      fontSize: '0.68rem',
                      fontFamily: 'monospace',
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.04)'
                        : 'rgba(0,0,0,0.04)',
                      border: 'none',
                    }}
                  />
                  <CopyButton text={issue.fingerprint} size={12} />
                </Box>
              )}
              {latestEvent?.event_id && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Chip
                    label={`ID: ${latestEvent.event_id.slice(0, 8)}`}
                    size="small"
                    sx={{
                      cursor: 'default',
                      height: 22,
                      fontSize: '0.68rem',
                      fontFamily: 'monospace',
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.04)'
                        : 'rgba(0,0,0,0.04)',
                      border: 'none',
                    }}
                  />
                  <CopyButton text={latestEvent.event_id} size={12} />
                </Box>
              )}
            </Box>
          </Box>

          {/* New Tabs Container */}
          <Box sx={{ mb: 3 }}>
            <SegmentedTabs
              items={[
                {
                  key: 'details',
                  label: t('argus.issues.tabs.details', 'Details'),
                },
                {
                  key: 'activity',
                  label: t('argus.issues.tabs.activity', 'Activity'),
                },
                {
                  key: 'feedback',
                  label: t('argus.issues.tabs.feedback', 'User Feedback'),
                },
                {
                  key: 'traces',
                  label: t('argus.issues.tabs.traces', 'Traces & Logs'),
                },
                { key: 'ai', label: t('argus.issues.tabs.ai', 'AI Analysis') },
              ]}
              value={activeTab}
              onChange={(k) => setUrlState({ tab: k })}
            />
          </Box>

          {activeTab === 'details' && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  md: '2fr 1fr',
                  xl: '3fr 1fr',
                },
                gap: 3,
                alignItems: 'stretch',
                position: 'relative',
                '&::before': {
                  content: '""',
                  display: { xs: 'none', md: 'block' },
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  right: { md: 'calc(33.333% - 12px)', xl: 'calc(25% - 12px)' },
                  width: '1px',
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.08)',
                },
              }}
            >
              {/* Left Column: Main Content */}
              <Box>
                {/* Activity Timeline — moved to sidebar in embedded mode */}

                {/* Event Highlights — Sentry-style promoted tags/context */}
                {latestEvent &&
                  (() => {
                    const highlights: { label: string; value: string }[] = [];
                    if (latestEvent.environment)
                      highlights.push({
                        label: t('argus.issues.environment'),
                        value: latestEvent.environment,
                      });
                    if (latestEvent.release)
                      highlights.push({
                        label: t('argus.issues.release'),
                        value: latestEvent.release,
                      });
                    if (latestEvent.browser)
                      highlights.push({
                        label: t('argus.issues.browser'),
                        value:
                          `${latestEvent.browser} ${latestEvent.browser_version || ''}`.trim(),
                      });
                    if (latestEvent.transaction)
                      highlights.push({
                        label: t('argus.issues.transaction'),
                        value: latestEvent.transaction,
                      });
                    if (highlights.length === 0) return null;
                    return (
                      <Box
                        sx={{
                          display: 'flex',
                          gap: 1.5,
                          flexWrap: 'wrap',
                          mb: 2,
                          p: 1.5,
                          borderRadius: 1.5,
                          backgroundColor: isDark
                            ? 'rgba(255,255,255,0.02)'
                            : 'rgba(0,0,0,0.015)',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                        }}
                      >
                        {highlights.map((h) => (
                          <Box
                            key={h.label}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                color: 'text.disabled',
                                fontSize: '0.68rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                              }}
                            >
                              {h.label}
                            </Typography>
                            <Chip
                              label={h.value}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                backgroundColor: isDark
                                  ? 'rgba(255,255,255,0.06)'
                                  : 'rgba(0,0,0,0.06)',
                                border: 'none',
                                borderRadius: 1,
                              }}
                            />
                          </Box>
                        ))}
                      </Box>
                    );
                  })()}

                {/* Latest Event */}
                {latestEvent && (
                  <Box
                    sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
                  >
                    {/* Exception + Stacktrace */}
                    <Paper
                      elevation={0}
                      sx={{
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}
                    >
                      {/* Exception header */}
                      <Box
                        sx={{
                          p: 2,
                          backgroundColor: alpha(levelColor, 0.06),
                          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                        }}
                      >
                        <Typography
                          variant="body1"
                          fontWeight={700}
                          sx={{ color: levelColor, fontFamily: 'monospace' }}
                        >
                          {latestEvent.exception_type}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ mt: 0.5, color: isDark ? '#aaa' : '#666' }}
                        >
                          {latestEvent.exception_value}
                        </Typography>
                      </Box>

                      {/* Stacktrace */}
                      <StacktraceView
                        stacktrace={latestEvent.stacktrace_raw}
                        isDark={isDark}
                      />
                    </Paper>

                    {/* Breadcrumbs */}
                    {latestEvent.breadcrumbs &&
                      Array.isArray(latestEvent.breadcrumbs) &&
                      latestEvent.breadcrumbs.length > 0 && (
                        <Box
                          sx={{
                            py: 2,
                            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            fontWeight={600}
                            sx={{
                              mb: 1.5,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                            }}
                          >
                            <FolderIcon
                              fontSize="small"
                              sx={{ color: theme.palette.warning.main }}
                            />
                            {t('argus.issues.breadcrumbs', 'Breadcrumbs')}
                            <Chip
                              label={latestEvent.breadcrumbs.length}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                ml: 0.5,
                              }}
                            />
                          </Typography>
                          <BreadcrumbsTimeline
                            breadcrumbs={latestEvent.breadcrumbs}
                          />
                        </Box>
                      )}

                    {/* Context Grid */}
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                        gap: 2,
                        py: 2,
                        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                      }}
                    >
                      {/* Environment Context */}
                      <Box>
                        <Typography
                          variant="subtitle2"
                          fontWeight={600}
                          sx={{
                            mb: 1.5,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                          }}
                        >
                          <DeviceIcon
                            fontSize="small"
                            sx={{ color: theme.palette.primary.main }}
                          />
                          {t('argus.issues.context')}
                        </Typography>
                        <ContextGrid
                          items={
                            [
                              latestEvent.environment && {
                                label: t('argus.issues.environment'),
                                value: latestEvent.environment,
                              },
                              latestEvent.release && {
                                label: t('argus.issues.release'),
                                value: latestEvent.release,
                              },
                              latestEvent.browser && {
                                label: t('argus.issues.browser'),
                                value: `${latestEvent.browser} ${latestEvent.browser_version || ''}`,
                              },
                              latestEvent.os && {
                                label: t('argus.issues.os'),
                                value: `${latestEvent.os} ${latestEvent.os_version || ''}`,
                              },
                              latestEvent.transaction && {
                                label: t('argus.issues.transaction'),
                                value: latestEvent.transaction,
                              },
                            ].filter(Boolean) as {
                              label: string;
                              value: string;
                            }[]
                          }
                          isDark={isDark}
                        />
                      </Box>

                      {/* User + Tags */}
                      <Box>
                        {(latestEvent.user_email || latestEvent.user_ip) && (
                          <>
                            <Typography
                              variant="subtitle2"
                              fontWeight={600}
                              sx={{
                                mb: 1.5,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                              }}
                            >
                              <PersonIcon
                                fontSize="small"
                                sx={{ color: theme.palette.warning.main }}
                              />
                              {t('argus.issues.user')}
                            </Typography>
                            <ContextGrid
                              items={
                                [
                                  latestEvent.user_email && {
                                    label: t('argus.issues.email'),
                                    value: latestEvent.user_email,
                                  },
                                  latestEvent.user_ip && {
                                    label: t('argus.issues.ip'),
                                    value: latestEvent.user_ip,
                                  },
                                ].filter(Boolean) as {
                                  label: string;
                                  value: string;
                                }[]
                              }
                              isDark={isDark}
                            />
                            <Divider sx={{ my: 1.5 }} />
                          </>
                        )}
                        {latestEvent.tags &&
                          Object.keys(
                            typeof latestEvent.tags === 'string'
                              ? JSON.parse(latestEvent.tags)
                              : latestEvent.tags
                          ).length > 0 && (
                            <>
                              <Typography
                                variant="subtitle2"
                                fontWeight={600}
                                sx={{
                                  mb: 1,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.5,
                                }}
                              >
                                <TagIcon
                                  fontSize="small"
                                  sx={{ color: theme.palette.info.main }}
                                />
                                {t('argus.issues.tags', 'Tags')}
                              </Typography>
                              <Box
                                sx={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: 0.5,
                                }}
                              >
                                {Object.entries(
                                  typeof latestEvent.tags === 'string'
                                    ? JSON.parse(latestEvent.tags)
                                    : latestEvent.tags
                                ).map(([key, val]) => (
                                  <Chip
                                    key={key}
                                    label={`${key}: ${String(val)}`}
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                      borderRadius: 1,
                                      fontSize: '0.72rem',
                                      height: 24,
                                      borderColor: isDark
                                        ? 'rgba(255,255,255,0.1)'
                                        : 'rgba(0,0,0,0.1)',
                                    }}
                                  />
                                ))}
                              </Box>
                            </>
                          )}
                      </Box>
                    </Box>

                    {/* Trace Waterfall */}
                    {traceId && (
                      <Box
                        sx={{
                          py: 2,
                          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            mb: showTrace ? 2 : 0,
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            fontWeight={600}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                            }}
                          >
                            <ScheduleIcon
                              fontSize="small"
                              sx={{ color: theme.palette.success.main }}
                            />
                            {t(
                              'argus.issues.transactionTrace',
                              'Transaction Trace'
                            )}
                          </Typography>
                          {!showTrace && (
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => loadTrace(traceId)}
                              disabled={loadingTrace}
                            >
                              {t('argus.issues.viewTrace', 'Trace 보기')}
                            </Button>
                          )}
                        </Box>
                        {showTrace && (
                          <Box>
                            {loadingTrace ? (
                              <Box
                                sx={{
                                  display: 'flex',
                                  justifyContent: 'center',
                                  p: 4,
                                }}
                              >
                                <CircularProgress size={24} />
                              </Box>
                            ) : traceDetail ? (
                              <TraceWaterfall
                                trace={traceDetail}
                                isDark={isDark}
                              />
                            ) : (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                textAlign="center"
                                py={4}
                              >
                                {t(
                                  'argus.issues.traceLoadFailed',
                                  'Trace 정보를 불러오지 못했습니다.'
                                )}
                              </Typography>
                            )}
                          </Box>
                        )}
                      </Box>
                    )}

                    {/* Extra Data */}
                    {latestEvent.extra &&
                      (() => {
                        const extraData =
                          typeof latestEvent.extra === 'string'
                            ? (() => {
                                try {
                                  return JSON.parse(latestEvent.extra);
                                } catch {
                                  return null;
                                }
                              })()
                            : latestEvent.extra;
                        if (!extraData || Object.keys(extraData).length === 0)
                          return null;
                        const jsonString = JSON.stringify(extraData, null, 2);

                        return (
                          <Box
                            sx={{
                              py: 2,
                              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                            }}
                          >
                            <Box
                              sx={{
                                mb: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <Typography
                                variant="subtitle2"
                                fontWeight={600}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.5,
                                }}
                              >
                                <InfoIcon
                                  fontSize="small"
                                  sx={{ color: theme.palette.secondary.main }}
                                />
                                {t('argus.issues.extraData', 'Additional Data')}
                              </Typography>
                              <CopyButton text={jsonString} />
                            </Box>
                            <Box
                              component="pre"
                              sx={{
                                margin: 0,
                                fontFamily: 'monospace',
                                fontSize: '0.8rem',
                                lineHeight: 1.5,
                                backgroundColor: isDark
                                  ? 'rgba(0,0,0,0.3)'
                                  : 'rgba(0,0,0,0.02)',
                                borderRadius: 1.5,
                                p: 2,
                                maxHeight: 350,
                                overflowY: 'auto',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all',
                                color: isDark ? '#e2e8f0' : '#334155',
                                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}`,
                                '&::-webkit-scrollbar': {
                                  width: '6px',
                                  height: '6px',
                                },
                                '&::-webkit-scrollbar-thumb': {
                                  backgroundColor: isDark
                                    ? 'rgba(255,255,255,0.2)'
                                    : 'rgba(0,0,0,0.2)',
                                  borderRadius: '3px',
                                },
                              }}
                            >
                              {(() => {
                                const colors = isDark
                                  ? {
                                      key: '#9cdcfe',
                                      str: '#ce9178',
                                      num: '#b5cea8',
                                      bool: '#569cd6',
                                      null: '#569cd6',
                                    }
                                  : {
                                      key: '#a31515',
                                      str: '#0451a5',
                                      num: '#098658',
                                      bool: '#0000ff',
                                      null: '#0000ff',
                                    };
                                const html = jsonString.replace(
                                  /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
                                  (match) => {
                                    let color = colors.num;
                                    if (/^"/.test(match)) {
                                      color = /:$/.test(match)
                                        ? colors.key
                                        : colors.str;
                                    } else if (/true|false/.test(match))
                                      color = colors.bool;
                                    else if (/null/.test(match))
                                      color = colors.null;
                                    return `<span style="color: ${color}">${match}</span>`;
                                  }
                                );
                                return (
                                  <code
                                    dangerouslySetInnerHTML={{ __html: html }}
                                  />
                                );
                              })()}
                            </Box>
                          </Box>
                        );
                      })()}

                    {/* Contexts */}
                    {latestEvent.contexts &&
                      (() => {
                        const ctxData =
                          typeof latestEvent.contexts === 'string'
                            ? (() => {
                                try {
                                  return JSON.parse(latestEvent.contexts);
                                } catch {
                                  return null;
                                }
                              })()
                            : latestEvent.contexts;
                        return ctxData && Object.keys(ctxData).length > 0 ? (
                          <Box sx={{ py: 2 }}>
                            <Typography
                              variant="subtitle2"
                              fontWeight={600}
                              sx={{
                                mb: 1.5,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                              }}
                            >
                              <DeviceIcon
                                fontSize="small"
                                sx={{ color: theme.palette.primary.main }}
                              />
                              {t('argus.issues.contexts', 'Contexts')}
                            </Typography>
                            {Object.entries(ctxData).map(
                              ([ctxKey, ctxVal]: [string, any]) => (
                                <Box key={ctxKey} sx={{ mb: 1.5 }}>
                                  <Typography
                                    variant="caption"
                                    fontWeight={700}
                                    sx={{
                                      color: theme.palette.primary.main,
                                      textTransform: 'capitalize',
                                      mb: 0.5,
                                      display: 'block',
                                    }}
                                  >
                                    {ctxKey}
                                  </Typography>
                                  {typeof ctxVal === 'object' &&
                                  ctxVal !== null ? (
                                    <ContextGrid
                                      items={Object.entries(ctxVal).map(
                                        ([k, v]) => ({
                                          label: k,
                                          value: String(v),
                                        })
                                      )}
                                      isDark={isDark}
                                    />
                                  ) : (
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        fontFamily: 'monospace',
                                        fontSize: '0.78rem',
                                      }}
                                    >
                                      {String(ctxVal)}
                                    </Typography>
                                  )}
                                </Box>
                              )
                            )}
                          </Box>
                        ) : null;
                      })()}
                  </Box>
                )}
              </Box>

              {/* Right Column: Sidebar — Sentry style: flat sections with Dividers */}
              <Box
                sx={{
                  pl: { md: 3 },
                }}
              >
                {/* Event Distribution Chart */}
                {projectId && issueId && (
                  <Box sx={{ mb: 2 }}>
                    <EventDistributionChart
                      projectId={projectId}
                      issueId={issueId}
                      isDark={isDark}
                    />
                  </Box>
                )}

                {/* Tag Distribution — sidebar */}
                {projectId && issueId && (
                  <TagDistribution
                    projectId={projectId}
                    issueId={issueId}
                    isDark={isDark}
                  />
                )}

                {/* Timing — Last/First Seen */}
                <Box sx={{ mb: 2 }}>
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    sx={{
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'text.secondary',
                      mb: 1,
                      display: 'block',
                    }}
                  >
                    {t('argus.issues.properties')}
                  </Typography>
                  <Box
                    sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary', fontSize: '0.72rem' }}
                      >
                        {t('argus.issues.lastSeen')}
                      </Typography>
                      <Typography
                        variant="caption"
                        fontWeight={600}
                        sx={{ fontSize: '0.72rem' }}
                      >
                        {issue.last_seen
                          ? formatRelative(issue.last_seen, t)
                          : '-'}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary', fontSize: '0.72rem' }}
                      >
                        {t('argus.issues.firstSeen')}
                      </Typography>
                      <Typography
                        variant="caption"
                        fontWeight={600}
                        sx={{ fontSize: '0.72rem' }}
                      >
                        {issue.first_seen
                          ? formatRelative(issue.first_seen, t)
                          : '-'}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary', fontSize: '0.72rem' }}
                      >
                        {t('argus.issues.events')}
                      </Typography>
                      <Typography
                        variant="caption"
                        fontWeight={600}
                        sx={{ fontSize: '0.72rem' }}
                      >
                        {issue.event_count?.toLocaleString() || '0'}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary', fontSize: '0.72rem' }}
                      >
                        {t('argus.issues.users')}
                      </Typography>
                      <Typography
                        variant="caption"
                        fontWeight={600}
                        sx={{ fontSize: '0.72rem' }}
                      >
                        {issue.user_count?.toLocaleString() || '0'}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* People — Presence */}
                {projectId && issueId && (
                  <Box>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      sx={{
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'text.secondary',
                        mb: 1,
                        display: 'block',
                      }}
                    >
                      {t('argus.issues.people', 'People')}
                    </Typography>
                    <PresenceIndicator
                      projectId={projectId}
                      resourceId={issueId}
                      resourceType="issue"
                      currentUser={{ id: 'current-user', name: 'You' }}
                      isDark={isDark}
                    />
                  </Box>
                )}
              </Box>

              {/* ====== END OF DETAILS TAB ====== */}
            </Box>
          )}

          {activeTab === 'activity' && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  md: '5fr 2fr',
                  xl: '5fr 2fr',
                },
                gap: 3,
                alignItems: 'stretch',
              }}
            >
              <Box
                sx={{
                  minWidth: 0,
                  pr: { md: 3 },
                  borderRight: {
                    xs: 'none',
                    md: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
                  },
                }}
              >
                {/* Event Navigator */}
                {projectId && issueId && (
                  <Box sx={{ mb: 2 }}>
                    <EventNavigator
                      projectId={projectId}
                      issueId={issueId}
                      currentEvent={latestEvent as ArgusErrorEvent | null}
                      onEventChange={(evt) => setCurrentEvent(evt)}
                      isDark={isDark}
                    />
                  </Box>
                )}
                {/* Activity — embedded mode */}
                {projectId && issueId && (
                  <Box sx={{ mb: 2 }}>
                    <ActivityTimeline
                      projectId={projectId}
                      issueId={issueId}
                      isDark={isDark}
                      embedded
                    />
                  </Box>
                )}
              </Box>
              <Box sx={{ minWidth: 0, overflow: 'hidden', height: '100%' }}>
                {/* Suspect Commits — renders null if no data */}
                {projectId && issueId && (
                  <SuspectCommits
                    projectId={projectId}
                    issueId={issueId}
                    isDark={isDark}
                  />
                )}
                {/* Issue Tracking */}
                {projectId && issueId && (
                  <Box sx={{ mb: 2 }}>
                    <IssueTrackerWidget
                      projectId={projectId}
                      issueId={issueId}
                      isDark={isDark}
                    />
                  </Box>
                )}
              </Box>
            </Box>
          )}

          {activeTab === 'feedback' && <Box></Box>}

          {activeTab === 'traces' && (
            <Box>
              {/* Structured Logs Section */}
              {issue && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    mt: 2,
                    mb: 2,
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                    borderRadius: 2,
                    ...(logsFullscreen
                      ? {
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          zIndex: 1300,
                          m: 0,
                          borderRadius: 0,
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                        }
                      : {}),
                  }}
                >
                  {!showLogs ? (
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        py: 5,
                      }}
                    >
                      <Button
                        variant="outlined"
                        startIcon={<LogIcon />}
                        onClick={async () => {
                          setShowLogs(true);
                          setLogsLoading(true);
                          try {
                            const result = await argusService.getLogs(
                              projectId!,
                              { issue_id: issueId, limit: 200, order: 'DESC' }
                            );
                            setLogs(result.data);
                            setLogsHasMore(result.meta.hasMore);
                          } catch (e) {
                            console.error('Failed to load logs:', e);
                          } finally {
                            setLogsLoading(false);
                          }
                        }}
                        sx={{
                          textTransform: 'none',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          borderRadius: '8px',
                          px: 3.5,
                          py: 1.2,
                          borderColor: theme.palette.info.main,
                          color: theme.palette.info.main,
                          '&:hover': {
                            borderColor: theme.palette.info.dark,
                            backgroundColor: alpha(
                              theme.palette.info.main,
                              0.04
                            ),
                          },
                        }}
                      >
                        {t('argus.issues.loadLogs', 'Load Logs')}
                      </Button>
                    </Box>
                  ) : (
                    <>
                      {/* Toolbar */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexShrink: 0,
                        }}
                      >
                        <Typography
                          variant="subtitle2"
                          fontWeight={600}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                          }}
                        >
                          <LogIcon
                            fontSize="small"
                            sx={{ color: theme.palette.info.main }}
                          />
                          {t('argus.issues.logs', 'Logs')}
                          {logs.length > 0 && (
                            <Chip
                              label={(() => {
                                const filtered = logSearch
                                  ? logs.filter(
                                      (l) =>
                                        l.message
                                          .toLowerCase()
                                          .includes(logSearch.toLowerCase()) ||
                                        l.logger_name
                                          ?.toLowerCase()
                                          .includes(logSearch.toLowerCase()) ||
                                        (l.attributes &&
                                          JSON.stringify(l.attributes)
                                            .toLowerCase()
                                            .includes(logSearch.toLowerCase()))
                                    )
                                  : logs;
                                return `${filtered.length}${logSearch ? '/' + logs.length : ''}`;
                              })()}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                ml: 0.5,
                              }}
                            />
                          )}
                        </Typography>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                          }}
                        >
                          {showLogs && logs.length > 0 && (
                            <>
                              {/* Search */}
                              <TextField
                                size="small"
                                placeholder={t('argus.logs.searchPlaceholder')}
                                value={logSearch}
                                onChange={(e) => setLogSearch(e.target.value)}
                                sx={{
                                  width: logsFullscreen ? 280 : 180,
                                  '& .MuiOutlinedInput-root': {
                                    height: 28,
                                    fontSize: '0.72rem',
                                    borderRadius: '6px',
                                    fontFamily: 'inherit',
                                  },
                                }}
                                InputProps={{
                                  startAdornment: (
                                    <InputAdornment position="start">
                                      <SearchIcon
                                        sx={{
                                          fontSize: 14,
                                          color: 'text.disabled',
                                        }}
                                      />
                                    </InputAdornment>
                                  ),
                                  endAdornment: logSearch ? (
                                    <InputAdornment position="end">
                                      <IconButton
                                        size="small"
                                        onClick={() => setLogSearch('')}
                                        sx={{ p: 0.2 }}
                                      >
                                        <CloseIcon sx={{ fontSize: 12 }} />
                                      </IconButton>
                                    </InputAdornment>
                                  ) : null,
                                }}
                              />
                              {/* Go-to time */}
                              {showLogGoto ? (
                                <TextField
                                  size="small"
                                  placeholder="HH:MM:SS"
                                  value={logGotoTime}
                                  onChange={(e) =>
                                    setLogGotoTime(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && logGotoTime) {
                                      const parts = logGotoTime
                                        .split(':')
                                        .map(Number);
                                      if (parts.length >= 2) {
                                        const targetH = parts[0] || 0;
                                        const targetM = parts[1] || 0;
                                        const targetS = parts[2] || 0;
                                        const targetMin =
                                          targetH * 3600 +
                                          targetM * 60 +
                                          targetS;
                                        // Find closest log
                                        let closestIdx = 0;
                                        let closestDiff = Infinity;
                                        logs.forEach((log, idx) => {
                                          const d = new Date(log.timestamp);
                                          const logMin =
                                            d.getHours() * 3600 +
                                            d.getMinutes() * 60 +
                                            d.getSeconds();
                                          const diff = Math.abs(
                                            logMin - targetMin
                                          );
                                          if (diff < closestDiff) {
                                            closestDiff = diff;
                                            closestIdx = idx;
                                          }
                                        });
                                        // Scroll to that row
                                        const container =
                                          logContainerRef.current;
                                        if (container) {
                                          const rows =
                                            container.querySelectorAll(
                                              '[data-log-row]'
                                            );
                                          if (rows[closestIdx]) {
                                            rows[closestIdx].scrollIntoView({
                                              behavior: 'smooth',
                                              block: 'center',
                                            });
                                            // Flash highlight
                                            (
                                              rows[closestIdx] as HTMLElement
                                            ).style.backgroundColor = isDark
                                              ? 'rgba(33,150,243,0.15)'
                                              : 'rgba(33,150,243,0.12)';
                                            setTimeout(() => {
                                              (
                                                rows[closestIdx] as HTMLElement
                                              ).style.backgroundColor = '';
                                            }, 1500);
                                          }
                                        }
                                      }
                                      setShowLogGoto(false);
                                      setLogGotoTime('');
                                    } else if (e.key === 'Escape') {
                                      setShowLogGoto(false);
                                      setLogGotoTime('');
                                    }
                                  }}
                                  autoFocus
                                  sx={{
                                    width: 100,
                                    '& .MuiOutlinedInput-root': {
                                      height: 28,
                                      fontSize: '0.72rem',
                                      borderRadius: '6px',
                                    },
                                  }}
                                />
                              ) : (
                                <Tooltip title={t('argus.logs.jumpToTime')}>
                                  <IconButton
                                    size="small"
                                    onClick={() => setShowLogGoto(true)}
                                    sx={{ p: 0.4 }}
                                  >
                                    <GotoTimeIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {/* Export */}
                              <Tooltip title={t('argus.logs.exportJson')}>
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    const dataStr = JSON.stringify(
                                      logs,
                                      null,
                                      2
                                    );
                                    const blob = new Blob([dataStr], {
                                      type: 'application/json',
                                    });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `logs-issue-${issueId}.json`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                  }}
                                  sx={{ p: 0.4 }}
                                >
                                  <ExportIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                              {/* Wrap Lines */}
                              <Tooltip
                                title={
                                  wrapLines
                                    ? t('argus.logs.unwrapLines', '줄바꿈 취소')
                                    : t('argus.logs.wrapLines', '줄바꿈')
                                }
                              >
                                <IconButton
                                  size="small"
                                  onClick={() => setWrapLines((w) => !w)}
                                  color={wrapLines ? 'primary' : 'default'}
                                  sx={{ p: 0.4 }}
                                >
                                  <WrapTextIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                              {/* Fullscreen */}
                              <Tooltip
                                title={
                                  logsFullscreen
                                    ? t('argus.logs.exitFullscreen')
                                    : t('argus.logs.fullscreen')
                                }
                              >
                                <IconButton
                                  size="small"
                                  onClick={() => setLogsFullscreen((f) => !f)}
                                  sx={{ p: 0.4 }}
                                >
                                  {logsFullscreen ? (
                                    <FullscreenExitIcon sx={{ fontSize: 16 }} />
                                  ) : (
                                    <FullscreenIcon sx={{ fontSize: 16 }} />
                                  )}
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </Box>
                      </Box>
                      {showLogs && (
                        <Box
                          sx={{
                            mt: 1.5,
                            flex: logsFullscreen ? 1 : 'none',
                            minHeight: 0,
                            display: 'flex',
                            flexDirection: 'column',
                          }}
                        >
                          {logsLoading ? (
                            <Box
                              sx={{
                                display: 'flex',
                                justifyContent: 'center',
                                p: 3,
                              }}
                            >
                              <CircularProgress size={20} />
                            </Box>
                          ) : logs.length === 0 ? (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              textAlign="center"
                              py={3}
                            >
                              {t(
                                'argus.issues.noLogs',
                                'No logs found for this issue'
                              )}
                            </Typography>
                          ) : (
                            (() => {
                              const searchLower = logSearch.toLowerCase();
                              const filteredLogs = logSearch
                                ? logs.filter(
                                    (l) =>
                                      l.message
                                        .toLowerCase()
                                        .includes(searchLower) ||
                                      l.logger_name
                                        ?.toLowerCase()
                                        .includes(searchLower) ||
                                      l.level
                                        .toLowerCase()
                                        .includes(searchLower) ||
                                      (l.attributes &&
                                        JSON.stringify(l.attributes)
                                          .toLowerCase()
                                          .includes(searchLower))
                                  )
                                : logs;
                              return (
                                <Box
                                  ref={logContainerRef}
                                  sx={{
                                    maxHeight: logsFullscreen ? 'none' : 650,
                                    flex: logsFullscreen ? 1 : 'none',
                                    overflowY: 'auto',
                                    fontFamily:
                                      '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
                                    fontSize: '0.73rem',
                                    backgroundColor: isDark
                                      ? '#0d1117'
                                      : '#fafbfc',
                                    borderRadius: 1,
                                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                                  }}
                                >
                                  {/* Header */}
                                  <Box
                                    sx={{
                                      display: 'grid',
                                      gridTemplateColumns:
                                        '16px 76px 52px 150px 1fr',
                                      gap: '0 8px',
                                      px: 1.5,
                                      py: 0.6,
                                      backgroundColor: isDark
                                        ? '#161b22'
                                        : '#f0f1f3',
                                      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                                      position: 'sticky',
                                      top: 0,
                                      zIndex: 2,
                                    }}
                                  >
                                    <Box />
                                    <Typography
                                      sx={{
                                        fontSize: '0.65rem',
                                        fontWeight: 700,
                                        color: 'text.disabled',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                      }}
                                    >
                                      {t('argus.logs.time')}
                                    </Typography>
                                    <Typography
                                      sx={{
                                        fontSize: '0.65rem',
                                        fontWeight: 700,
                                        color: 'text.disabled',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                      }}
                                    >
                                      {t('argus.logs.level')}
                                    </Typography>
                                    <Typography
                                      sx={{
                                        fontSize: '0.65rem',
                                        fontWeight: 700,
                                        color: 'text.disabled',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                      }}
                                    >
                                      {t('argus.logs.logger')}
                                    </Typography>
                                    <Typography
                                      sx={{
                                        fontSize: '0.65rem',
                                        fontWeight: 700,
                                        color: 'text.disabled',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                      }}
                                    >
                                      {t('argus.logs.message')}
                                    </Typography>
                                  </Box>
                                  {/* Rows */}
                                  {filteredLogs.map((log, i) => {
                                    const levelColors: Record<
                                      string,
                                      { bg: string; fg: string }
                                    > = {
                                      error: {
                                        bg: 'rgba(244,67,54,0.12)',
                                        fg: '#f44336',
                                      },
                                      warn: {
                                        bg: 'rgba(255,152,0,0.12)',
                                        fg: '#ff9800',
                                      },
                                      warning: {
                                        bg: 'rgba(255,152,0,0.12)',
                                        fg: '#ff9800',
                                      },
                                      info: {
                                        bg: 'rgba(33,150,243,0.10)',
                                        fg: '#64b5f6',
                                      },
                                      debug: {
                                        bg: 'rgba(158,158,158,0.10)',
                                        fg: '#9e9e9e',
                                      },
                                    };
                                    const lc =
                                      levelColors[log.level] ||
                                      levelColors.debug;
                                    const ts = new Date(log.timestamp);
                                    const timeStr = `${ts.getHours().toString().padStart(2, '0')}:${ts.getMinutes().toString().padStart(2, '0')}:${ts.getSeconds().toString().padStart(2, '0')}`;
                                    const logKey = log.log_id || String(i);
                                    const isExpanded =
                                      expandedLogIds.has(logKey);
                                    const toggleExpand = () => {
                                      setExpandedLogIds((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(logKey))
                                          next.delete(logKey);
                                        else next.add(logKey);
                                        return next;
                                      });
                                    };

                                    const allFields: {
                                      key: string;
                                      value: string;
                                    }[] = [
                                      {
                                        key: 'timestamp',
                                        value: new Date(
                                          log.timestamp
                                        ).toISOString(),
                                      },
                                      { key: 'level', value: log.level },
                                      {
                                        key: 'logger',
                                        value: log.logger_name || '',
                                      },
                                      {
                                        key: 'service',
                                        value: log.service || '',
                                      },
                                      {
                                        key: 'environment',
                                        value: log.environment || '',
                                      },
                                      {
                                        key: 'release',
                                        value: log.release || '',
                                      },
                                      {
                                        key: 'trace_id',
                                        value: log.trace_id || '',
                                      },
                                      {
                                        key: 'span_id',
                                        value: log.span_id || '',
                                      },
                                      { key: 'message', value: log.message },
                                    ];
                                    if (
                                      log.attributes &&
                                      typeof log.attributes === 'object'
                                    ) {
                                      Object.entries(log.attributes).forEach(
                                        ([k, v]) => {
                                          allFields.push({
                                            key: k,
                                            value: String(v),
                                          });
                                        }
                                      );
                                    }

                                    // Highlight search matches
                                    const highlightText = (text: string) => {
                                      if (!logSearch) return text;
                                      const idx = text
                                        .toLowerCase()
                                        .indexOf(searchLower);
                                      if (idx === -1) return text;
                                      return (
                                        <>
                                          {text.substring(0, idx)}
                                          <Box
                                            component="span"
                                            sx={{
                                              backgroundColor: isDark
                                                ? 'rgba(255,200,0,0.3)'
                                                : 'rgba(255,200,0,0.5)',
                                              borderRadius: '2px',
                                              px: '1px',
                                            }}
                                          >
                                            {text.substring(
                                              idx,
                                              idx + logSearch.length
                                            )}
                                          </Box>
                                          {text.substring(
                                            idx + logSearch.length
                                          )}
                                        </>
                                      );
                                    };

                                    return (
                                      <React.Fragment key={logKey}>
                                        <Box
                                          data-log-row
                                          onClick={toggleExpand}
                                          sx={{
                                            display: 'grid',
                                            gridTemplateColumns:
                                              '16px 76px 52px 150px 1fr',
                                            gap: '0 8px',
                                            px: 1.5,
                                            py: 0.4,
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                            userSelect: 'none',
                                            borderBottom: isExpanded
                                              ? 'none'
                                              : `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                                            backgroundColor: isExpanded
                                              ? isDark
                                                ? 'rgba(33,150,243,0.06)'
                                                : 'rgba(33,150,243,0.04)'
                                              : i % 2 === 0
                                                ? 'transparent'
                                                : isDark
                                                  ? 'rgba(255,255,255,0.015)'
                                                  : 'rgba(0,0,0,0.015)',
                                            '&:hover': {
                                              backgroundColor: isDark
                                                ? 'rgba(255,255,255,0.04)'
                                                : 'rgba(0,0,0,0.03)',
                                            },
                                            transition:
                                              'background-color 0.15s',
                                          }}
                                        >
                                          <Box
                                            sx={{
                                              color: 'text.disabled',
                                              display: 'flex',
                                              alignItems: 'center',
                                            }}
                                          >
                                            {isExpanded ? (
                                              <ExpandLessIcon
                                                sx={{ fontSize: 14 }}
                                              />
                                            ) : (
                                              <ExpandMoreIcon
                                                sx={{ fontSize: 14 }}
                                              />
                                            )}
                                          </Box>
                                          <Typography
                                            sx={{
                                              fontSize: '0.7rem',
                                              color: 'text.disabled',
                                              fontFamily: 'inherit',
                                              fontVariantNumeric:
                                                'tabular-nums',
                                            }}
                                          >
                                            {timeStr}
                                          </Typography>
                                          <Box
                                            sx={{
                                              px: 0.6,
                                              py: 0.15,
                                              borderRadius: '3px',
                                              backgroundColor: lc.bg,
                                              color: lc.fg,
                                              fontSize: '0.62rem',
                                              fontWeight: 700,
                                              textAlign: 'center',
                                              textTransform: 'uppercase',
                                              letterSpacing: '0.03em',
                                              lineHeight: 1.4,
                                            }}
                                          >
                                            {log.level === 'warning'
                                              ? 'warn'
                                              : log.level}
                                          </Box>
                                          <Typography
                                            sx={{
                                              fontSize: '0.7rem',
                                              color: isDark
                                                ? '#8b949e'
                                                : '#656d76',
                                              fontFamily: 'inherit',
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis',
                                              whiteSpace: 'nowrap',
                                            }}
                                          >
                                            {highlightText(
                                              log.logger_name || '\u2014'
                                            )}
                                          </Typography>
                                          <Typography
                                            sx={{
                                              fontSize: '0.72rem',
                                              color:
                                                log.level === 'error'
                                                  ? isDark
                                                    ? '#ffa4a2'
                                                    : '#d32f2f'
                                                  : log.level === 'warn' ||
                                                      log.level === 'warning'
                                                    ? isDark
                                                      ? '#ffd699'
                                                      : '#e65100'
                                                    : isDark
                                                      ? '#c9d1d9'
                                                      : '#24292f',
                                              fontFamily: 'inherit',
                                              ...(wrapLines
                                                ? {
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-all',
                                                  }
                                                : {
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                  }),
                                            }}
                                          >
                                            {highlightText(log.message)}
                                          </Typography>
                                        </Box>
                                        {isExpanded && (
                                          <Box
                                            sx={{
                                              px: 2,
                                              py: 1.2,
                                              ml: '16px',
                                              backgroundColor: isDark
                                                ? 'rgba(0,0,0,0.3)'
                                                : 'rgba(0,0,0,0.02)',
                                              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                                              borderLeft: `3px solid ${lc.fg}`,
                                            }}
                                          >
                                            {/* Prominent Full Message Block */}
                                            <Box
                                              sx={{
                                                mb: 2,
                                                p: 1.5,
                                                borderRadius: '4px',
                                                backgroundColor: isDark
                                                  ? 'rgba(0,0,0,0.4)'
                                                  : 'rgba(255,255,255,0.8)',
                                                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                                                position: 'relative',
                                              }}
                                            >
                                              <Typography
                                                sx={{
                                                  fontSize: '0.62rem',
                                                  fontWeight: 700,
                                                  color: 'text.disabled',
                                                  textTransform: 'uppercase',
                                                  letterSpacing: '0.05em',
                                                  mb: 0.8,
                                                }}
                                              >
                                                {t(
                                                  'argus.logs.fullMessage',
                                                  'Full Message'
                                                )}
                                              </Typography>
                                              <Typography
                                                sx={{
                                                  fontSize: '0.75rem',
                                                  color:
                                                    log.level === 'error'
                                                      ? isDark
                                                        ? '#ffa4a2'
                                                        : '#d32f2f'
                                                      : log.level === 'warn' ||
                                                          log.level ===
                                                            'warning'
                                                        ? isDark
                                                          ? '#ffd699'
                                                          : '#e65100'
                                                        : isDark
                                                          ? '#e6edf3'
                                                          : '#1f2328',
                                                  fontFamily: 'monospace',
                                                  whiteSpace: 'pre-wrap',
                                                  wordBreak: 'break-all',
                                                  pr: 4,
                                                }}
                                              >
                                                {highlightText(log.message)}
                                              </Typography>
                                              <CopyButton
                                                text={log.message}
                                                size={14}
                                                sx={{
                                                  position: 'absolute',
                                                  right: 8,
                                                  top: 8,
                                                  opacity: 0.4,
                                                  '&:hover': { opacity: 1 },
                                                }}
                                              />
                                            </Box>

                                            {/* Metadata Fields Grid */}
                                            <Box
                                              sx={{
                                                display: 'grid',
                                                gridTemplateColumns:
                                                  '180px 1fr auto',
                                                gap: '2px 12px',
                                                alignItems: 'center',
                                              }}
                                            >
                                              {allFields
                                                .filter(
                                                  (f) =>
                                                    f.key !== 'message' &&
                                                    f.value
                                                )
                                                .map((field) => (
                                                  <React.Fragment
                                                    key={field.key}
                                                  >
                                                    <Typography
                                                      sx={{
                                                        fontSize: '0.68rem',
                                                        fontWeight: 600,
                                                        color: isDark
                                                          ? '#58a6ff'
                                                          : '#0969da',
                                                        fontFamily: 'inherit',
                                                        py: 0.2,
                                                        overflow: 'hidden',
                                                        textOverflow:
                                                          'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                      }}
                                                    >
                                                      {field.key}
                                                    </Typography>
                                                    <Typography
                                                      sx={{
                                                        fontSize: '0.68rem',
                                                        color: isDark
                                                          ? '#c9d1d9'
                                                          : '#24292f',
                                                        fontFamily: 'inherit',
                                                        py: 0.2,
                                                        whiteSpace: 'pre-wrap',
                                                        wordBreak: 'break-all',
                                                      }}
                                                    >
                                                      {highlightText(
                                                        field.value
                                                      )}
                                                    </Typography>
                                                    <CopyButton
                                                      text={field.value}
                                                      size={12}
                                                      sx={{
                                                        p: 0.2,
                                                        opacity: 0.4,
                                                        '&:hover': {
                                                          opacity: 1,
                                                        },
                                                      }}
                                                    />
                                                  </React.Fragment>
                                                ))}
                                            </Box>
                                          </Box>
                                        )}
                                      </React.Fragment>
                                    );
                                  })}
                                  {filteredLogs.length === 0 && logSearch && (
                                    <Box sx={{ p: 3, textAlign: 'center' }}>
                                      <Typography
                                        variant="body2"
                                        color="text.disabled"
                                      >
                                        {t('argus.logs.noMatchingLogs', {
                                          query: logSearch,
                                        })}
                                      </Typography>
                                    </Box>
                                  )}
                                </Box>
                              );
                            })()
                          )}
                        </Box>
                      )}
                      {/* Load More */}
                      {logsHasMore && (
                        <Box
                          sx={{
                            py: 2,
                            textAlign: 'center',
                            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                          }}
                        >
                          <Button
                            variant="outlined"
                            size="small"
                            disabled={logsLoading}
                            startIcon={
                              logsLoading ? (
                                <CircularProgress size={14} color="inherit" />
                              ) : undefined
                            }
                            onClick={async () => {
                              setLogsLoading(true);
                              try {
                                const lastLog = logs[logs.length - 1];
                                const result = await argusService.getLogs(
                                  projectId!,
                                  {
                                    issue_id: issueId,
                                    limit: 200,
                                    order: 'DESC',
                                    cursor: lastLog?.timestamp,
                                  }
                                );
                                setLogs((prev) => [...prev, ...result.data]);
                                setLogsHasMore(result.meta.hasMore);
                              } catch (e) {
                                console.error('Failed to load more logs:', e);
                              } finally {
                                setLogsLoading(false);
                              }
                            }}
                            sx={{
                              textTransform: 'none',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              minWidth: 160,
                              borderColor: isDark
                                ? 'rgba(255,255,255,0.12)'
                                : 'rgba(0,0,0,0.12)',
                            }}
                          >
                            {t('argus.logs.loadMore', 'Load More Logs')}
                          </Button>
                        </Box>
                      )}
                    </>
                  )}
                </Paper>
              )}
            </Box>
          )}

          {activeTab === 'ai' && (
            <Box>
              {/* AI Root Cause — flat section */}
              {projectId && issueId && (
                <AiRootCausePanel
                  projectId={projectId}
                  issueId={issueId}
                  issueTitle={issue.title}
                  exceptionType={latestEvent?.exception_type}
                  exceptionValue={latestEvent?.exception_value}
                  stacktrace={latestEvent?.stacktrace_raw}
                  tags={
                    latestEvent?.tags
                      ? typeof latestEvent.tags === 'string'
                        ? (() => {
                            try {
                              return JSON.parse(latestEvent.tags);
                            } catch {
                              return undefined;
                            }
                          })()
                        : latestEvent.tags
                      : undefined
                  }
                  isDark={isDark}
                />
              )}
            </Box>
          )}
        </Box>
      )}

      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, status: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {confirmDialog.status === 'resolved' &&
            t('argus.issues.confirmResolveTitle', '이슈 해결 확인')}
          {confirmDialog.status === 'ignored' &&
            t('argus.issues.confirmIgnoreTitle', '이슈 무시 확인')}
          {confirmDialog.status === 'unresolved' &&
            t('argus.issues.confirmReopenTitle', '이슈 재오픈 확인')}
        </DialogTitle>
        <DialogContent>
          {issue && (
            <Box
              sx={{
                mb: 3,
                p: 2,
                mt: 1,
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.03)'
                  : 'rgba(0,0,0,0.02)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                borderRadius: 2,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: isDark ? '#888' : '#666',
                  mb: 1,
                  display: 'block',
                  fontWeight: 600,
                }}
              >
                {t('argus.issues.targetIssue', '대상 이슈')}
              </Typography>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}
              >
                <Box
                  sx={{
                    width: 4,
                    height: 18,
                    borderRadius: 1,
                    backgroundColor: levelColor,
                    flexShrink: 0,
                  }}
                />
                <Typography
                  variant="body1"
                  fontWeight={700}
                  sx={{ wordBreak: 'break-all', lineHeight: 1.3 }}
                >
                  {issue.title}
                </Typography>
              </Box>
              {issue.culprit && (
                <Typography
                  variant="body2"
                  sx={{
                    color: isDark ? '#aaa' : '#666',
                    ml: 1.5,
                    mb: 1.5,
                    fontSize: '0.8rem',
                  }}
                >
                  {issue.culprit}
                </Typography>
              )}
              <Box sx={{ display: 'flex', gap: 3, ml: 1.5, flexWrap: 'wrap' }}>
                <Typography
                  variant="caption"
                  sx={{ color: isDark ? '#ddd' : '#333' }}
                >
                  <strong style={{ color: isDark ? '#888' : '#666' }}>
                    {t('argus.issues.events', '발생 횟수')}:
                  </strong>{' '}
                  {issue.event_count?.toLocaleString() || 0}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: isDark ? '#ddd' : '#333' }}
                >
                  <strong style={{ color: isDark ? '#888' : '#666' }}>
                    {t('argus.issues.users', '사용자 수')}:
                  </strong>{' '}
                  {issue.user_count?.toLocaleString() || 0}
                </Typography>
              </Box>
            </Box>
          )}
          <DialogContentText sx={{ color: 'text.primary', fontWeight: 500 }}>
            {confirmDialog.status === 'resolved' &&
              t(
                'argus.issues.confirmResolveText',
                '위 이슈를 해결 처리하시겠습니까?'
              )}
            {confirmDialog.status === 'ignored' &&
              t(
                'argus.issues.confirmIgnoreText',
                '위 이슈를 앞으로 무시 처리하시겠습니까?'
              )}
            {confirmDialog.status === 'unresolved' &&
              t(
                'argus.issues.confirmReopenText',
                '위 이슈를 다시 미해결 상태로 변경하시겠습니까?'
              )}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button
            onClick={() => setConfirmDialog({ open: false, status: '' })}
            color="inherit"
            sx={{ textTransform: 'none' }}
          >
            {t('common.cancel', '취소')}
          </Button>
          <Button
            onClick={executeStatusChange}
            color={
              confirmDialog.status === 'resolved'
                ? 'success'
                : confirmDialog.status === 'ignored'
                  ? 'inherit'
                  : 'primary'
            }
            variant="contained"
            disableElevation
            sx={{ textTransform: 'none', fontWeight: 600, minWidth: 80 }}
          >
            {confirmDialog.status === 'resolved' &&
              t('argus.issues.resolve', '해결')}
            {confirmDialog.status === 'ignored' &&
              t('argus.issues.ignore', '무시')}
            {confirmDialog.status === 'unresolved' &&
              t('argus.issues.reopen', '재오픈')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assignee Menu */}
      <Menu
        anchorEl={assigneeAnchor}
        open={Boolean(assigneeAnchor)}
        onClose={() => setAssigneeAnchor(null)}
        slotProps={{
          paper: {
            sx: {
              borderRadius: 2,
              minWidth: 160,
              maxHeight: 300,
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            },
          },
        }}
      >
        <MenuItem
          onClick={() => {
            handleAssign('');
            setAssigneeAnchor(null);
          }}
        >
          <ListItemIcon>
            <PersonIcon sx={{ fontSize: 18 }} />
          </ListItemIcon>
          <ListItemText
            primary={t('argus.issues.unassigned', 'Unassigned')}
            primaryTypographyProps={{ fontSize: '0.82rem' }}
          />
        </MenuItem>
        <Divider />
        {members.map((member) => {
          const displayName = member.name || member.email || member.userId;
          return (
            <MenuItem
              key={member.userId}
              onClick={() => {
                handleAssign(displayName);
                setAssigneeAnchor(null);
              }}
            >
              <Avatar
                sx={{
                  width: 20,
                  height: 20,
                  mr: 1,
                  fontSize: '0.55rem',
                  fontWeight: 700,
                  backgroundColor: stringToColor(displayName),
                }}
              >
                {getInitials(displayName)}
              </Avatar>
              <ListItemText
                primary={displayName}
                primaryTypographyProps={{ fontSize: '0.82rem' }}
              />
            </MenuItem>
          );
        })}
      </Menu>
    </PageContentLoader>
  );
};

// --- Stacktrace Viewer ---
const StacktraceView: React.FC<{ stacktrace: any; isDark: boolean }> = ({
  stacktrace,
  isDark,
}) => {
  const [toggledFrames, setToggledFrames] = useState<Set<number>>(new Set());

  let frames: any[] = [];
  try {
    frames =
      typeof stacktrace === 'string'
        ? JSON.parse(stacktrace)
        : Array.isArray(stacktrace)
          ? stacktrace
          : [];
  } catch {
    frames = [];
  }

  if (frames.length === 0) return null;

  const toggleFrame = (idx: number) => {
    setToggledFrames((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  return (
    <Box>
      {frames.map((frame: any, idx: number) => {
        const isInApp = !!frame.in_app;
        const hasContext = !!frame.context_line;
        const isExpanded =
          hasContext && (toggledFrames.has(idx) ? !isInApp : isInApp);
        return (
          <Box key={idx}>
            <Box
              onClick={hasContext ? () => toggleFrame(idx) : undefined}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 2,
                py: 0.8,
                cursor: hasContext ? 'pointer' : 'default',
                backgroundColor: isInApp
                  ? alpha('#7c4dff', isDark ? 0.08 : 0.04)
                  : 'transparent',
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                '&:hover': {
                  backgroundColor: hasContext
                    ? isDark
                      ? 'rgba(255,255,255,0.03)'
                      : 'rgba(0,0,0,0.02)'
                    : undefined,
                },
                transition: 'background 0.15s',
              }}
            >
              {hasContext ? (
                isExpanded ? (
                  <ExpandLessIcon
                    sx={{ fontSize: 16, color: 'text.secondary' }}
                  />
                ) : (
                  <ExpandMoreIcon
                    sx={{ fontSize: 16, color: 'text.secondary' }}
                  />
                )
              ) : (
                <Box sx={{ width: 16 }} />
              )}
              {isInApp && (
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: '#7c4dff',
                    flexShrink: 0,
                  }}
                />
              )}
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.78rem',
                  color: isInApp
                    ? isDark
                      ? '#bb86fc'
                      : '#6200ea'
                    : isDark
                      ? '#777'
                      : '#999',
                  fontWeight: isInApp ? 600 : 400,
                }}
              >
                {frame.function || '<anonymous>'}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  ml: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.7rem',
                  color: isDark ? '#555' : '#bbb',
                  flexShrink: 0,
                }}
              >
                {frame.filename
                  ? `${frame.filename}:${frame.lineno || '?'}`
                  : ''}
              </Typography>
            </Box>
            <Collapse in={isExpanded}>
              {frame.context_line && (
                <Box
                  sx={{
                    px: 2,
                    py: 1,
                    mx: 2,
                    my: 0.5,
                    backgroundColor: isDark
                      ? 'rgba(0,0,0,0.3)'
                      : 'rgba(0,0,0,0.03)',
                    borderRadius: 1,
                    borderLeft: `3px solid ${isInApp ? '#7c4dff' : '#555'}`,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      color: isDark ? '#ddd' : '#333',
                      whiteSpace: 'pre',
                    }}
                  >
                    {frame.lineno && (
                      <Box
                        component="span"
                        sx={{
                          color: isDark ? '#555' : '#bbb',
                          mr: 1,
                          userSelect: 'none',
                        }}
                      >
                        {frame.lineno}
                      </Box>
                    )}
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

// --- Helpers ---

const ContextGrid: React.FC<{
  items: { label: string; value: string }[];
  isDark: boolean;
}> = ({ items, isDark }) => (
  <Box
    sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px' }}
  >
    {items.map((item, idx) => (
      <React.Fragment key={`${item.label}-${idx}`}>
        <Typography
          variant="caption"
          sx={{ color: isDark ? '#666' : '#999', fontWeight: 500 }}
        >
          {item.label}
        </Typography>
        <Typography
          variant="caption"
          sx={{ fontFamily: 'monospace', fontWeight: 500, fontSize: '0.78rem' }}
        >
          {item.value}
        </Typography>
      </React.Fragment>
    ))}
  </Box>
);

function formatRelative(dateStr: string, t: any): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);

    if (mins < 1) return t('common.time.justNow');
    if (mins < 60) return t('common.time.minutesAgo', { count: mins });
    if (hrs < 24) return t('common.time.hoursAgo', { count: hrs });
    if (days < 30) return t('common.time.daysAgo', { count: days });
    return d.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

export default ArgusIssueDetailPage;
