import React, { useState, useEffect, useCallback } from 'react';
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
  ButtonGroup,
} from '@mui/material';
import ViewSidebarIcon from '@mui/icons-material/ViewSidebar';
import ViewSidebarOutlinedIcon from '@mui/icons-material/ViewSidebarOutlined';
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
  GitHub as GitHubIcon,
} from '@mui/icons-material';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const MIN_SPLIT_WIDTH = 250;
const MAX_SPLIT_WIDTH = 600;
const DEFAULT_SPLIT_WIDTH = 320;
const SPLIT_WIDTH_KEY = 'argus_issue_split_width';

import argusService, { ArgusIssueDetail, ArgusErrorEvent, ArgusTraceDetail, ArgusLogEntry } from '@/services/argusService';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { rbacService } from '@/services/rbacService';
import { formatCompactNumber } from '@/utils/numberFormat';
import { stringToColor, getInitials, formatRelative, LEVEL_COLORS } from '@/utils/argusHelpers';
import { useIssueDetailData, useTraceData, useLogsData } from '@/hooks/useIssueDetailData';
import { useIssueActions } from '@/hooks/useIssueActions';
import PageHeader from '@/components/common/PageHeader';
import { CopyButton } from '@/components/common/CopyButton';
import TraceWaterfall from '@/components/argus/TraceWaterfall';
import BreadcrumbsTimeline from '@/components/argus/BreadcrumbsTimeline';
import EventNavigator from '@/components/argus/EventNavigator';
import EventDistributionChart from '@/components/argus/EventDistributionChart';
import ActivityTimeline from '@/components/argus/ActivityTimeline';
import TagDistribution from '@/components/argus/TagDistribution';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import AiRootCausePanel from '@/components/argus/AiRootCausePanel';
import PresenceIndicator from '@/components/argus/PresenceIndicator';
import BusinessImpactWidget from '@/components/argus/BusinessImpactWidget';
import IssueTrackerWidget from '@/components/argus/IssueTrackerWidget';
import SuspectCommits from '@/components/argus/SuspectCommits';
import IssueDetailActions from '@/components/argus/IssueDetailActions';
import EventHighlights from '@/components/argus/EventHighlights';
import ExceptionChaining from '@/components/argus/ExceptionChaining';
import SimilarMergedIssues from '@/components/argus/SimilarMergedIssues';
import StacktraceView from '@/components/argus/StacktraceView';
import ContextGrid from '@/components/argus/ContextGrid';
import IssueLogsSection from '@/components/argus/IssueLogsSection';



const ArgusIssueDetailPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const { projectId, issueId } = useParams<{ projectId: string; issueId: string }>();

  // --- SWR Data Hooks ---
  const {
    issue,
    issueLoading: loading,
    members,
    updateIssueOptimistic,
    revalidateIssue,
  } = useIssueDetailData({ projectId, issueId });

  // --- UI State ---
  const [assigneeAnchor, setAssigneeAnchor] = useState<HTMLElement | null>(null);
  const [priorityAnchor, setPriorityAnchor] = useState<HTMLElement | null>(null);
  const [currentEvent, setCurrentEvent] = useState<ArgusErrorEvent | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Trace states
  const [showTrace, setShowTrace] = useState(false);

  // Other UI states
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);
  const [stacktraceMode, setStacktraceMode] = useState<'relevant' | 'full'>('relevant');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Splitter states
  const [splitWidth, setSplitWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem(SPLIT_WIDTH_KEY) || '', 10);
    return !isNaN(saved) && saved >= MIN_SPLIT_WIDTH && saved <= MAX_SPLIT_WIDTH ? saved : DEFAULT_SPLIT_WIDTH;
  });
  const [isSplitDragging, setIsSplitDragging] = useState(false);

  const handleSplitterMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsSplitDragging(true);
    const startX = e.clientX;
    const startWidth = splitWidth;

    const onMouseMove = (ev: MouseEvent) => {
      // Invert delta because the sidebar is on the right
      const delta = startX - ev.clientX;
      const newWidth = Math.min(MAX_SPLIT_WIDTH, Math.max(MIN_SPLIT_WIDTH, startWidth + delta));
      setSplitWidth(newWidth);
    };
    const onMouseUp = () => {
      setIsSplitDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [splitWidth]);

  useEffect(() => {
    localStorage.setItem(SPLIT_WIDTH_KEY, String(splitWidth));
  }, [splitWidth]);

  // --- SWR Trace (lazy) ---
  const latestEvent = currentEvent || issue?.latest_event;
  let traceId: string | null = null;
  if (latestEvent) {
    if (latestEvent.contexts) {
      try {
        const ctx = typeof latestEvent.contexts === 'string' ? JSON.parse(latestEvent.contexts) : latestEvent.contexts;
        traceId = ctx?.trace?.trace_id;
      } catch (e) {}
    }
    if (!traceId && latestEvent.tags) {
      try {
        const tags = typeof latestEvent.tags === 'string' ? JSON.parse(latestEvent.tags) : latestEvent.tags;
        traceId = tags?.trace_id || tags?.['sentry:trace'];
      } catch (e) {}
    }
  }

  const { traceDetail, traceLoading: loadingTrace } = useTraceData(projectId, traceId, showTrace);

  // --- Actions Hook ---
  const actions = useIssueActions({
    projectId,
    issueId,
    issue,
    updateIssueOptimistic,
    revalidateIssue,
  });

  const handleAssign = actions.assign;
  const handleSubscribe = async (sub: boolean) => { await actions.subscribe(sub); setIsSubscribed(sub); };
  const handleBookmark = async (bm: boolean) => { await actions.bookmark(bm); setIsBookmarked(bm); };
  const handleDeleteIssue = actions.deleteIssue;
  const handleDiscardIssue = actions.discardIssue;

  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; status: string }>({ open: false, status: '' });
  const [statusMenuAnchor, setStatusMenuAnchor] = useState<null | HTMLElement>(null);

  const requestStatusChange = (status: string) => {
    setConfirmDialog({ open: true, status });
    setStatusMenuAnchor(null);
  };

  const executeStatusChange = async () => {
    if (!confirmDialog.status) return;
    await actions.changeStatus(confirmDialog.status);
    setConfirmDialog({ open: false, status: '' });
  };

  const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
    critical: { color: '#f44336', label: t('argus.issues.priority.critical') },
    high: { color: '#ff5722', label: t('argus.issues.priority.high') },
    medium: { color: '#ff9800', label: t('argus.issues.priority.medium') },
    low: { color: '#9e9e9e', label: t('argus.issues.priority.low') },
  };

  const handlePriorityChange = async (priority: string) => {
    await actions.changePriority(priority);
    setPriorityAnchor(null);
  };


  const levelColor = LEVEL_COLORS[issue?.level || 'error'] || LEVEL_COLORS.error;


  return (
    <PageContentLoader loading={loading}>
      {!issue ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <BugReportIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">{t('argus.issues.issueNotFound')}</Typography>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
            {t('argus.issues.goBack')}
          </Button>
        </Box>
      ) : (
        <Box>
          {/* Header */}
          <PageHeader
            icon={<Box sx={{ width: 4, height: 18, borderRadius: 1, backgroundColor: levelColor, ml: 1 }} />}
            title={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ArgusBreadcrumbs
                  paths={[
                    { label: t('sidebar.argusIssues', 'Issues'), to: `/argus/issues` },
                    { label: issue.title }
                  ]}
                  size="title"
                />
                <Chip
                  label={issue.level}
                  size="small"
                  sx={{
                    fontWeight: 700, fontSize: '0.65rem', height: 18,
                    backgroundColor: alpha(levelColor, 0.12),
                    color: levelColor, border: 'none',
                  }}
                />
              </Box>
            }
            subtitle={issue.culprit}
            enableAutoBack={false}
            onBack={location.state?.allowBack ? () => navigate(-1) : undefined}
            actions={
              <Box sx={{ display: 'flex', gap: 3, pt: 0.5, pr: 1, alignItems: 'center' }}>
                <Box sx={{ display: 'flex', gap: 3 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Tooltip title={issue.event_count >= 1000 ? issue.event_count.toLocaleString() : ''} arrow placement="top">
                      <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1, fontSize: '1.2rem', cursor: issue.event_count >= 1000 ? 'help' : 'default' }}>
                        {formatCompactNumber(issue.event_count || 0)}
                      </Typography>
                    </Tooltip>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                      {t('argus.issues.events')}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Tooltip title={issue.user_count >= 1000 ? issue.user_count.toLocaleString() : ''} arrow placement="top">
                      <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1, fontSize: '1.2rem', cursor: issue.user_count >= 1000 ? 'help' : 'default' }}>
                        {formatCompactNumber(issue.user_count || 0)}
                      </Typography>
                    </Tooltip>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                      {t('argus.issues.users')}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            }
          />

          {/* Action Bar */}
          <Box
            sx={{
              py: 1.5, mb: 2, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap',
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            }}
          >
            {/* Status Section - Independent */}
            <Box sx={{
              px: 1.5, py: 0.8, display: 'flex', alignItems: 'center', gap: 1,
              backgroundColor: alpha(issue.status === 'resolved' ? '#4caf50' : issue.status === 'ignored' ? '#9e9e9e' : '#f44336', 0.12),
              color: issue.status === 'resolved' ? '#4caf50' : issue.status === 'ignored' ? '#9e9e9e' : '#f44336',
              borderRadius: 1.5,
            }}>
              <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t(`argus.issues.${issue.status}`, issue.status)}
              </Typography>
              {issue.substatus === 'regressed' && (
                <Chip
                  label={t('argus.issues.regressed', 'Regressed')}
                  size="small"
                  sx={{
                    fontWeight: 700, fontSize: '0.65rem', height: 18,
                    backgroundColor: alpha('#ff9800', 0.15),
                    color: '#ff9800', border: 'none',
                  }}
                />
              )}
              {issue.is_regression && (
                <Chip label={t('argus.issues.regression')} size="small" sx={{
                  fontWeight: 700, fontSize: '0.65rem', height: 18,
                  backgroundColor: alpha('#ff9800', 0.12), color: '#ff9800', border: 'none',
                }} />
              )}
            </Box>

            {/* Action Buttons Group (Split Button) */}
            <Box>
              <ButtonGroup size="small" variant="outlined" disableElevation sx={{ 
                height: 28,
                '& .MuiButton-root': {
                  fontSize: '0.78rem',
                  textTransform: 'none',
                  px: 2,
                  color: 'text.primary',
                  borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                  '&:hover': {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  }
                }
              }}>
                <Button 
                  onClick={() => requestStatusChange(issue.status === 'resolved' ? 'unresolved' : 'resolved')}
                  startIcon={issue.status === 'resolved' ? <ErrorIcon /> : <CheckCircleIcon />}
                  sx={{ borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }}
                >
                  {issue.status === 'resolved' ? t('argus.issues.reopen') : t('argus.issues.resolve')}
                </Button>
                <Button
                  size="small"
                  onClick={(e) => setStatusMenuAnchor(e.currentTarget)}
                  sx={{ px: 0.5, borderTopRightRadius: 6, borderBottomRightRadius: 6, minWidth: 0 }}
                >
                  <ExpandMoreIcon fontSize="small" />
                </Button>
              </ButtonGroup>
              <Menu
                anchorEl={statusMenuAnchor}
                open={Boolean(statusMenuAnchor)}
                onClose={() => setStatusMenuAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                sx={{ '& .MuiPaper-root': { minWidth: 150, mt: 0.5, borderRadius: 2, border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, backgroundImage: 'none', backgroundColor: isDark ? '#222' : '#fff' } }}
              >
                {issue.status !== 'resolved' && (
                  <MenuItem onClick={() => requestStatusChange('resolved')} sx={{ fontSize: '0.8rem', py: 1 }}>
                    <ListItemIcon><CheckCircleIcon fontSize="small" color="success" /></ListItemIcon>
                    <ListItemText primary={t('argus.issues.resolve')} primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: 500 }} />
                  </MenuItem>
                )}
                {issue.status !== 'resolved' && latestEvent?.release && (
                  <MenuItem
                    onClick={() => requestStatusChange('resolved')}
                    sx={{ fontSize: '0.8rem', py: 1, pl: 4 }}
                  >
                    <ListItemText
                      primary={t('argus.detail.resolveInCurrentRelease')}
                      secondary={latestEvent.release}
                      primaryTypographyProps={{ fontSize: '0.75rem', fontWeight: 500 }}
                      secondaryTypographyProps={{ fontSize: '0.65rem', fontFamily: 'monospace' }}
                    />
                  </MenuItem>
                )}
                {issue.status !== 'resolved' && (
                  <MenuItem
                    onClick={() => requestStatusChange('resolved')}
                    sx={{ fontSize: '0.8rem', py: 1, pl: 4 }}
                  >
                    <ListItemText
                      primary={t('argus.detail.resolveInNextRelease')}
                      primaryTypographyProps={{ fontSize: '0.75rem', fontWeight: 500 }}
                    />
                  </MenuItem>
                )}
                <Divider sx={{ my: 0.5 }} />
                {issue.status !== 'ignored' && (
                  <MenuItem onClick={() => requestStatusChange('ignored')} sx={{ fontSize: '0.8rem', py: 1 }}>
                    <ListItemIcon><IgnoreIcon fontSize="small" color="action" /></ListItemIcon>
                    <ListItemText primary={t('argus.issues.ignore')} primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: 500 }} />
                  </MenuItem>
                )}
                {issue.status !== 'archived' && (
                  <MenuItem onClick={() => requestStatusChange('archived')} sx={{ fontSize: '0.8rem', py: 1 }}>
                    <ListItemIcon><IgnoreIcon fontSize="small" sx={{ color: 'text.disabled' }} /></ListItemIcon>
                    <ListItemText primary={t('argus.detail.archive')} primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: 500 }} />
                  </MenuItem>
                )}
                <Divider sx={{ my: 0.5 }} />
                {issue.status !== 'unresolved' && (
                  <MenuItem onClick={() => requestStatusChange('unresolved')} sx={{ fontSize: '0.8rem', py: 1 }}>
                    <ListItemIcon><ErrorIcon fontSize="small" color="error" /></ListItemIcon>
                    <ListItemText primary={t('argus.issues.reopen')} primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: 500 }} />
                  </MenuItem>
                )}
              </Menu>
            </Box>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Unified Control: Priority & Assignee */}
            <ButtonGroup size="small" variant="outlined" sx={{ 
              height: 28,
              '& .MuiButton-root': {
                fontSize: '0.75rem',
                textTransform: 'none',
                px: 1.5,
                color: 'text.primary',
                borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                '&:hover': {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                }
              }
            }}>
              {/* Priority */}
              <Button onClick={(e) => setPriorityAnchor(e.currentTarget)}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: PRIORITY_CONFIG[issue.priority || 'medium']?.color || '#ff9800', mr: 1 }} />
                {PRIORITY_CONFIG[issue.priority || 'medium']?.label || t('argus.issues.priority.medium')}
              </Button>
              
              {/* Assignee */}
              <Button onClick={(e) => setAssigneeAnchor(e.currentTarget)}>
                <PersonIcon sx={{ fontSize: 14, mr: 0.5, color: issue.assigned_to ? 'primary.main' : 'text.disabled' }} />
                {issue.assigned_to ? issue.assigned_to : t('argus.issues.unassigned', 'Unassigned')}
              </Button>
            </ButtonGroup>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* AI Analysis (Independent Flat Button) */}
            <Button variant="outlined" size="small" onClick={() => setShowAiAnalysis(true)} 
              sx={{ 
                height: 28, fontSize: '0.75rem', 
                borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', 
                color: 'primary.main', fontWeight: 600,
                textTransform: 'none', px: 2,
                '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.08), borderColor: 'primary.main' } 
              }}
            >
              {t('argus.issues.aiAnalysis', 'AI 분석')}
            </Button>

            <Menu
              anchorEl={priorityAnchor}
              open={Boolean(priorityAnchor)}
              onClose={() => setPriorityAnchor(null)}
              slotProps={{ paper: { sx: { borderRadius: 2, minWidth: 140, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' } } }}
            >
              {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                <MenuItem
                  key={key}
                  selected={issue.priority === key}
                  onClick={() => handlePriorityChange(key)}
                  sx={{ fontSize: '0.82rem' }}
                >
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: cfg.color, mr: 1 }} />
                  {cfg.label}
                </MenuItem>
              ))}
            </Menu>

            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
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
                      cursor: 'default', height: 22, fontSize: '0.68rem',
                      fontFamily: 'monospace',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
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
                      cursor: 'default', height: 22, fontSize: '0.68rem',
                      fontFamily: 'monospace',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                      border: 'none',
                    }}
                  />
                  <CopyButton text={latestEvent.event_id} size={12} />
                </Box>
              )}
              <IssueDetailActions
                projectId={projectId || ''}
                issueId={issueId || ''}
                shortId={issue.short_id}
                isSubscribed={isSubscribed}
                isBookmarked={isBookmarked}
                onSubscribe={handleSubscribe}
                onBookmark={handleBookmark}
                onDelete={handleDeleteIssue}
                onDiscard={handleDiscardIssue}
                isDark={isDark}
              />
              <Tooltip title={sidebarCollapsed ? t('argus.detail.expandSidebar', '사이드바 열기') : t('argus.detail.collapseSidebar', '사이드바 닫기')}>
                <IconButton 
                  size="small" 
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  sx={{ 
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    backgroundColor: sidebarCollapsed ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)') : 'transparent',
                    ml: 0.5
                  }}
                >
                  {sidebarCollapsed ? <ViewSidebarIcon sx={{ transform: 'rotate(180deg)' }} /> : <ViewSidebarOutlinedIcon sx={{ transform: 'rotate(180deg)' }} />}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* First/Last Seen + Release Info */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>
                {t('argus.issues.firstSeen')}:
              </Typography>
              <Typography variant="caption" sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.secondary' }}>
                {issue.first_seen ? new Date(issue.first_seen).toLocaleString() : '—'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>
                {t('argus.issues.lastSeen')}:
              </Typography>
              <Typography variant="caption" sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.secondary' }}>
                {issue.last_seen ? new Date(issue.last_seen).toLocaleString() : '—'}
              </Typography>
            </Box>
            {latestEvent?.release && (
              <Chip
                label={`${t('argus.detail.release')}: ${latestEvent.release}`}
                size="small"
                sx={{
                  height: 20, fontSize: '0.65rem', fontWeight: 600,
                  fontFamily: 'monospace',
                  backgroundColor: alpha(theme.palette.info.main, 0.08),
                  color: theme.palette.info.main,
                  border: 'none',
                }}
              />
            )}
            {latestEvent?.environment && (
              <Chip
                label={latestEvent.environment}
                size="small"
                sx={{
                  height: 20, fontSize: '0.65rem', fontWeight: 600,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                  border: 'none',
                }}
              />
            )}
          </Box>

          <Box sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: 'stretch',
            position: 'relative',
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
          }}>
            {/* Left Column: Main Content */}
            <Box sx={{
              flex: 1,
              minWidth: 0,
              pr: { md: sidebarCollapsed ? 0 : 3 },
              py: 2,
              transition: 'padding 0.2s ease',
            }}>
              {/* AI Root Cause — Dialog */}
              <Dialog open={showAiAnalysis} onClose={() => setShowAiAnalysis(false)} maxWidth="md" fullWidth>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700 }}>
                  {t('argus.issues.aiAnalysis', 'AI Analysis')}
                  <IconButton onClick={() => setShowAiAnalysis(false)} size="small"><CloseIcon /></IconButton>
                </DialogTitle>
                <DialogContent sx={{ p: 0, overflowX: 'hidden' }}>
                  {projectId && issueId && (
                    <AiRootCausePanel
                      projectId={projectId}
                      issueId={issueId}
                      issueTitle={issue.title}
                      exceptionType={latestEvent?.exception_type}
                      exceptionValue={latestEvent?.exception_value}
                      stacktrace={latestEvent?.stacktrace_raw}
                      tags={latestEvent?.tags ? (typeof latestEvent.tags === 'string' ? (() => { try { return JSON.parse(latestEvent.tags); } catch { return undefined; } })() : latestEvent.tags) : undefined}
                      isDark={isDark}
                    />
                  )}
                </DialogContent>
              </Dialog>

              {/* Activity Timeline — moved to sidebar in embedded mode */}
              {/* Event Highlights */}
              <EventHighlights event={latestEvent} />

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

              {/* Event Distribution Chart */}
              {projectId && issueId && (
                <EventDistributionChart
                  projectId={projectId}
                  issueId={issueId}
                  isDark={isDark}
                />
              )}



          {/* Latest Event (Stack Trace) */}
          {latestEvent && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              
              {/* Stack Trace Header & Controls */}
              <Box>
                <Typography variant="h6" fontWeight={700} sx={{ mb: 1, color: isDark ? '#fff' : '#000' }}>
                  {t('argus.issues.stackTraceTitle', 'Stack Trace')}
                </Typography>
                {latestEvent.exception_value && (
                  <Typography variant="body1" sx={{ fontFamily: 'monospace', color: isDark ? '#ddd' : '#333', mb: 2 }}>
                    {latestEvent.exception_value}
                  </Typography>
                )}

                {/* Exception Chaining */}
                <ExceptionChaining
                  exceptionType={latestEvent.exception_type}
                  exceptionValue={latestEvent.exception_value}
                  isDark={isDark}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0 }}>
                  <Box sx={{ 
                    display: 'inline-flex', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', 
                    borderRadius: 2, overflow: 'hidden', p: 0.4, gap: 0.5
                  }}>
                    <Button size="small" 
                      onClick={() => setStacktraceMode('relevant')}
                      sx={{ 
                        fontSize: '0.75rem', py: 0.4, px: 2, borderRadius: 1.5, textTransform: 'none',
                        color: stacktraceMode === 'relevant' ? 'text.primary' : 'text.secondary', 
                        backgroundColor: stacktraceMode === 'relevant' ? (isDark ? 'rgba(255,255,255,0.1)' : '#fff') : 'transparent',
                        boxShadow: stacktraceMode === 'relevant' ? (isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.05)') : 'none',
                        fontWeight: stacktraceMode === 'relevant' ? 600 : 500,
                        '&:hover': { backgroundColor: stacktraceMode === 'relevant' ? (isDark ? 'rgba(255,255,255,0.15)' : '#fff') : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)') }
                      }}
                    >{t('argus.issues.mostRelevant', 'Most Relevant')}</Button>
                    <Button size="small" 
                      onClick={() => setStacktraceMode('full')}
                      sx={{ 
                        fontSize: '0.75rem', py: 0.4, px: 2, borderRadius: 1.5, textTransform: 'none',
                        color: stacktraceMode === 'full' ? 'text.primary' : 'text.secondary', 
                        backgroundColor: stacktraceMode === 'full' ? (isDark ? 'rgba(255,255,255,0.1)' : '#fff') : 'transparent',
                        boxShadow: stacktraceMode === 'full' ? (isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.05)') : 'none',
                        fontWeight: stacktraceMode === 'full' ? 600 : 500,
                        '&:hover': { backgroundColor: stacktraceMode === 'full' ? (isDark ? 'rgba(255,255,255,0.15)' : '#fff') : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)') }
                      }}
                    >{t('argus.issues.fullStackTrace', 'Full Stack Trace')}</Button>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" variant="outlined" endIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />} sx={{ textTransform: 'none', color: 'text.primary', borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)', fontSize: '0.75rem', height: 32, borderRadius: 1.5 }}>
                      <Typography component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 'inherit', fontWeight: 600 }}>
                        <span style={{ fontSize: '10px' }}>⇅</span> {t('argus.issues.mostRecent', 'Most Recent')}
                      </Typography>
                    </Button>
                    <Button size="small" variant="outlined" sx={{ minWidth: 0, px: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)', color: 'text.primary', height: 32, borderRadius: 1.5 }}>
                      <Typography component="span" sx={{ fontSize: '12px', lineHeight: 1 }}>•••</Typography>
                    </Button>
                  </Box>
                </Box>
              </Box>

              {/* Stacktrace Frames Wrapper */}
              <Paper elevation={0} sx={{
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                borderRadius: 2, overflow: 'hidden',
              }}>
                <StacktraceView stacktrace={latestEvent.stacktrace_raw} mode={stacktraceMode} isDark={isDark} />
              </Paper>

              {/* Context Grid */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, py: 2, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                {/* Environment Context */}
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <DeviceIcon fontSize="small" sx={{ color: theme.palette.primary.main }} />
                    {t('argus.issues.context')}
                  </Typography>
                  <ContextGrid items={[
                    latestEvent.environment && { label: t('argus.issues.environment'), value: latestEvent.environment },
                    latestEvent.release && { label: t('argus.issues.release'), value: latestEvent.release },
                    latestEvent.browser && { label: t('argus.issues.browser'), value: `${latestEvent.browser} ${latestEvent.browser_version || ''}` },
                    latestEvent.os && { label: t('argus.issues.os'), value: `${latestEvent.os} ${latestEvent.os_version || ''}` },
                    latestEvent.transaction && { label: t('argus.issues.transaction'), value: latestEvent.transaction },
                  ].filter(Boolean) as { label: string; value: string }[]} isDark={isDark} />
                </Box>

                {/* User + Tags */}
                <Box>
                  {(latestEvent.user_email || latestEvent.user_ip) && (
                    <>
                      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PersonIcon fontSize="small" sx={{ color: theme.palette.warning.main }} />
                        {t('argus.issues.user')}
                      </Typography>
                      <ContextGrid items={[
                        latestEvent.user_email && { label: t('argus.issues.email'), value: latestEvent.user_email },
                        latestEvent.user_ip && { label: t('argus.issues.ip'), value: latestEvent.user_ip },
                      ].filter(Boolean) as { label: string; value: string }[]} isDark={isDark} />
                      <Divider sx={{ my: 1.5 }} />
                    </>
                  )}
                  {latestEvent.tags && Object.keys(typeof latestEvent.tags === 'string' ? JSON.parse(latestEvent.tags) : latestEvent.tags).length > 0 && (
                    <>
                      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <TagIcon fontSize="small" sx={{ color: theme.palette.info.main }} />
                        {t('argus.issues.tags', 'Tags')}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {Object.entries(typeof latestEvent.tags === 'string' ? JSON.parse(latestEvent.tags) : latestEvent.tags)
                          .map(([key, val]) => (
                            <Chip
                              key={key}
                              label={`${key}: ${String(val)}`}
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
                </Box>
              </Box>

              {/* Trace Waterfall */}
              {traceId && (
                <Box sx={{ py: 2, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: showTrace ? 2 : 0 }}>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <ScheduleIcon fontSize="small" sx={{ color: theme.palette.success.main }} />
                      {t('argus.issues.transactionTrace', 'Transaction Trace')}
                    </Typography>
                    {!showTrace && (
                      <Button variant="outlined" size="small" onClick={() => setShowTrace(true)} disabled={loadingTrace}>
                        {t('argus.issues.viewTrace', 'Trace 보기')}
                      </Button>
                    )}
                  </Box>
                  {showTrace && (
                    <Box>
                      {loadingTrace ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                          <CircularProgress size={24} />
                        </Box>
                      ) : traceDetail ? (
                        <TraceWaterfall trace={traceDetail} isDark={isDark} />
                      ) : (
                        <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
                          {t('argus.issues.traceLoadFailed', 'Trace 정보를 불러오지 못했습니다.')}
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>
              )}

              {/* Breadcrumbs */}
              {latestEvent.breadcrumbs && Array.isArray(latestEvent.breadcrumbs) && latestEvent.breadcrumbs.length > 0 && (
                <Box sx={{ py: 2, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <FolderIcon fontSize="small" sx={{ color: theme.palette.warning.main }} />
                    {t('argus.issues.breadcrumbs', 'Breadcrumbs')}
                    <Chip label={latestEvent.breadcrumbs.length} size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, ml: 0.5 }} />
                  </Typography>
                  <BreadcrumbsTimeline breadcrumbs={latestEvent.breadcrumbs} />
                </Box>
              )}

              {/* Extra Data */}
              {latestEvent.extra && (() => {
                const extraData = typeof latestEvent.extra === 'string' ? (() => { try { return JSON.parse(latestEvent.extra); } catch { return null; } })() : latestEvent.extra;
                if (!extraData || Object.keys(extraData).length === 0) return null;
                const jsonString = JSON.stringify(extraData, null, 2);
                
                return (
                  <Box sx={{ py: 2, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                    <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="subtitle2" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <InfoIcon fontSize="small" sx={{ color: theme.palette.secondary.main }} />
                        {t('argus.issues.extraData', 'Additional Data')}
                      </Typography>
                      <CopyButton text={jsonString} />
                    </Box>
                    <Box component="pre" sx={{
                      margin: 0,
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      lineHeight: 1.5,
                      backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.02)',
                      borderRadius: 1.5,
                      p: 2,
                      maxHeight: 350,
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      color: isDark ? '#e2e8f0' : '#334155',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}`,
                      '&::-webkit-scrollbar': { width: '6px', height: '6px' },
                      '&::-webkit-scrollbar-thumb': { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', borderRadius: '3px' },
                    }}>
                      {(() => {
                        const colors = isDark 
                          ? { key: '#9cdcfe', str: '#ce9178', num: '#b5cea8', bool: '#569cd6', null: '#569cd6' }
                          : { key: '#a31515', str: '#0451a5', num: '#098658', bool: '#0000ff', null: '#0000ff' };
                        const html = jsonString.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
                          let color = colors.num;
                          if (/^"/.test(match)) {
                            color = /:$/.test(match) ? colors.key : colors.str;
                          } else if (/true|false/.test(match)) color = colors.bool;
                          else if (/null/.test(match)) color = colors.null;
                          return `<span style="color: ${color}">${match}</span>`;
                        });
                        return <code dangerouslySetInnerHTML={{ __html: html }} />;
                      })()}
                    </Box>
                  </Box>
                );
              })()}

              {/* Contexts */}
              {latestEvent.contexts && (() => {
                const ctxData = typeof latestEvent.contexts === 'string' ? (() => { try { return JSON.parse(latestEvent.contexts); } catch { return null; } })() : latestEvent.contexts;
                return ctxData && Object.keys(ctxData).length > 0 ? (
                  <Box sx={{ py: 2 }}>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <DeviceIcon fontSize="small" sx={{ color: theme.palette.primary.main }} />
                      {t('argus.issues.contexts', 'Contexts')}
                    </Typography>
                    {Object.entries(ctxData).map(([ctxKey, ctxVal]: [string, any]) => (
                      <Box key={ctxKey} sx={{ mb: 1.5 }}>
                        <Typography variant="caption" fontWeight={700} sx={{ color: theme.palette.primary.main, textTransform: 'capitalize', mb: 0.5, display: 'block' }}>
                          {ctxKey}
                        </Typography>
                        {typeof ctxVal === 'object' && ctxVal !== null ? (
                          <ContextGrid items={Object.entries(ctxVal).map(([k, v]) => ({
                            label: k,
                            value: String(v),
                          }))} isDark={isDark} />
                        ) : (
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{String(ctxVal)}</Typography>
                        )}
                      </Box>
                    ))}
                  </Box>
                ) : null;
              })()}
            </Box>
          )}
              {/* Structured Logs Section */}
              {issue && projectId && issueId && (
                <Box sx={{ mt: 4 }}>
                  <IssueLogsSection projectId={projectId} issueId={issueId} isDark={isDark} />
                </Box>
              )}
            </Box>

            {!sidebarCollapsed && (
              <>
                {/* ─── Resizable Splitter Handle ─── */}
                <Box
                  onMouseDown={handleSplitterMouseDown}
                  sx={{
                    width: '1px',
                    flexShrink: 0,
                    cursor: 'col-resize',
                    bgcolor: isSplitDragging ? 'primary.main' : 'divider',
                    position: 'relative',
                    zIndex: 10,
                    transition: 'background-color 0.15s, transform 0.15s',
                    transformOrigin: 'center',
                    ...(isSplitDragging && { 
                      bgcolor: 'primary.main',
                      transform: 'scaleX(4)',
                    }),
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: '-5px',
                      right: '-5px',
                      cursor: 'col-resize',
                    },
                    '&:hover, &:active': {
                      bgcolor: 'primary.main',
                      transform: 'scaleX(4)',
                    },
                  }}
                />

                {/* Right Column: Sidebar */}
                <Box sx={{
                  width: { xs: '100%', md: splitWidth },
                  minWidth: { md: MIN_SPLIT_WIDTH },
                  flexShrink: 0,
                  pl: { md: 3 },
                  py: 2,
                }}>


              {/* Suspect Commits — renders null if no data */}
              {projectId && issueId && (
                <SuspectCommits projectId={projectId} issueId={issueId} isDark={isDark} />
              )}

              {/* Issue Tracking */}
              {projectId && issueId && (
                <Box sx={{ mb: 2 }}>
                  <IssueTrackerWidget projectId={projectId} issueId={issueId} isDark={isDark} />
                </Box>
              )}

              <Divider sx={{ mb: 2 }} />

              {/* Similar / Merged Issues */}
              {projectId && issueId && issue.fingerprint && (
                <SimilarMergedIssues
                  projectId={projectId}
                  issueId={issueId}
                  fingerprint={issue.fingerprint}
                  isDark={isDark}
                />
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

              <Divider sx={{ mb: 2 }} />

              {/* People — Presence */}
              {projectId && issueId && (
                <Box>
                  <Typography variant="caption" fontWeight={700} sx={{
                    fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em',
                    color: 'text.secondary', mb: 1, display: 'block',
                  }}>
                    {t('argus.issues.people', 'People')}
                  </Typography>
                  <PresenceIndicator projectId={projectId} resourceId={issueId} resourceType="issue" currentUser={{ id: 'current-user', name: 'You' }} isDark={isDark} />
                </Box>
              )}

              <Divider sx={{ my: 2 }} />

              {/* Tag Distribution — sidebar */}
              {projectId && issueId && (
                <TagDistribution
                  projectId={projectId}
                  issueId={issueId}
                  isDark={isDark}
                />
              )}
            </Box>
          </>
        )}
        </Box>


      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ open: false, status: '' })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {confirmDialog.status === 'resolved' && t('argus.issues.confirmResolveTitle', '이슈 해결 확인')}
          {confirmDialog.status === 'ignored' && t('argus.issues.confirmIgnoreTitle', '이슈 무시 확인')}
          {confirmDialog.status === 'unresolved' && t('argus.issues.confirmReopenTitle', '이슈 재오픈 확인')}
        </DialogTitle>
        <DialogContent>
          {issue && (
            <Box sx={{ 
              mb: 3, p: 2, mt: 1,
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', 
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              borderRadius: 2 
            }}>
              <Typography variant="caption" sx={{ color: isDark ? '#888' : '#666', mb: 1, display: 'block', fontWeight: 600 }}>
                {t('argus.issues.targetIssue', '대상 이슈')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Box sx={{ width: 4, height: 18, borderRadius: 1, backgroundColor: levelColor, flexShrink: 0 }} />
                <Typography variant="body1" fontWeight={700} sx={{ wordBreak: 'break-all', lineHeight: 1.3 }}>
                  {issue.title}
                </Typography>
              </Box>
              {issue.culprit && (
                <Typography variant="body2" sx={{ color: isDark ? '#aaa' : '#666', ml: 1.5, mb: 1.5, fontSize: '0.8rem' }}>
                  {issue.culprit}
                </Typography>
              )}
              <Box sx={{ display: 'flex', gap: 3, ml: 1.5, flexWrap: 'wrap' }}>
                <Typography variant="caption" sx={{ color: isDark ? '#ddd' : '#333' }}>
                  <strong style={{ color: isDark ? '#888' : '#666' }}>{t('argus.issues.events', '발생 횟수')}:</strong> {issue.event_count?.toLocaleString() || 0}
                </Typography>
                <Typography variant="caption" sx={{ color: isDark ? '#ddd' : '#333' }}>
                  <strong style={{ color: isDark ? '#888' : '#666' }}>{t('argus.issues.users', '사용자 수')}:</strong> {issue.user_count?.toLocaleString() || 0}
                </Typography>
              </Box>
            </Box>
          )}
          <DialogContentText sx={{ color: 'text.primary', fontWeight: 500 }}>
            {confirmDialog.status === 'resolved' && t('argus.issues.confirmResolveText', '위 이슈를 해결 처리하시겠습니까?')}
            {confirmDialog.status === 'ignored' && t('argus.issues.confirmIgnoreText', '위 이슈를 앞으로 무시 처리하시겠습니까?')}
            {confirmDialog.status === 'unresolved' && t('argus.issues.confirmReopenText', '위 이슈를 다시 미해결 상태로 변경하시겠습니까?')}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setConfirmDialog({ open: false, status: '' })} color="inherit" sx={{ textTransform: 'none' }}>
            {t('common.cancel', '취소')}
          </Button>
          <Button 
            onClick={executeStatusChange} 
            color={confirmDialog.status === 'resolved' ? 'success' : confirmDialog.status === 'ignored' ? 'inherit' : 'primary'} 
            variant="contained"
            disableElevation
            sx={{ textTransform: 'none', fontWeight: 600, minWidth: 80 }}
          >
            {confirmDialog.status === 'resolved' && t('argus.issues.resolve', '해결')}
            {confirmDialog.status === 'ignored' && t('argus.issues.ignore', '무시')}
            {confirmDialog.status === 'unresolved' && t('argus.issues.reopen', '재오픈')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assignee Menu */}
      <Menu
        anchorEl={assigneeAnchor}
        open={Boolean(assigneeAnchor)}
        onClose={() => setAssigneeAnchor(null)}
        slotProps={{ paper: { sx: { borderRadius: 2, minWidth: 160, maxHeight: 300, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' } } }}
      >
        <MenuItem onClick={() => { handleAssign(''); setAssigneeAnchor(null); }}>
          <ListItemIcon><PersonIcon sx={{ fontSize: 18 }} /></ListItemIcon>
          <ListItemText primary={t('argus.issues.unassigned', 'Unassigned')} primaryTypographyProps={{ fontSize: '0.82rem' }} />
        </MenuItem>
        <Divider />
        {members.map(member => {
          const displayName = member.name || member.email || member.userId;
          return (
            <MenuItem key={member.userId} onClick={() => { handleAssign(displayName); setAssigneeAnchor(null); }}>
              <Avatar sx={{ width: 20, height: 20, mr: 1, fontSize: '0.55rem', fontWeight: 700, backgroundColor: stringToColor(displayName) }}>
                {getInitials(displayName)}
              </Avatar>
              <ListItemText primary={displayName} primaryTypographyProps={{ fontSize: '0.82rem' }} />
            </MenuItem>
          );
        })}
      </Menu>
        </Box>
      )}
    </PageContentLoader>
  );
};





export default ArgusIssueDetailPage;

