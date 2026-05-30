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
import { useTranslation } from 'react-i18next';
import argusService, { ArgusIssueDetail, ArgusTraceDetail } from '@/services/argusService';
import TraceWaterfall from '@/components/argus/TraceWaterfall';
import BreadcrumbsTimeline from '@/components/argus/BreadcrumbsTimeline';


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
  const { projectId, issueId } = useParams<{ projectId: string; issueId: string }>();

  const [issue, setIssue] = useState<ArgusIssueDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Trace states
  const [traceDetail, setTraceDetail] = useState<ArgusTraceDetail | null>(null);
  const [loadingTrace, setLoadingTrace] = useState(false);
  const [showTrace, setShowTrace] = useState(false);

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

  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; status: string }>({ open: false, status: '' });

  const executeStatusChange = async () => {
    if (!projectId || !issueId || !issue || !confirmDialog.status) return;
    try {
      await argusService.updateIssueStatus(projectId, issueId, confirmDialog.status);
      setIssue({ ...issue, status: confirmDialog.status });
      setConfirmDialog({ open: false, status: '' });
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const requestStatusChange = (status: string) => {
    setConfirmDialog({ open: true, status });
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

  const latestEvent = issue?.latest_event;
  const levelColor = LEVEL_COLORS[issue?.level || 'error'] || LEVEL_COLORS.error;

  // Extract trace_id
  let traceId = null;
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
                onClick={() => requestStatusChange('resolved')}
                sx={{ borderRadius: 1.5, textTransform: 'none', fontSize: '0.78rem' }}
              >
                {t('argus.issues.resolve')}
              </Button>
            )}
            {issue.status !== 'ignored' && (
              <Button variant="outlined" size="small" color="inherit" startIcon={<IgnoreIcon />}
                onClick={() => requestStatusChange('ignored')}
                sx={{ borderRadius: 1.5, textTransform: 'none', fontSize: '0.78rem' }}
              >
                {t('argus.issues.ignore')}
              </Button>
            )}
            {issue.status !== 'unresolved' && (
              <Button variant="outlined" size="small" color="error" startIcon={<ErrorIcon />}
                onClick={() => requestStatusChange('unresolved')}
                sx={{ borderRadius: 1.5, textTransform: 'none', fontSize: '0.78rem' }}
              >
                {t('argus.issues.reopen')}
              </Button>
            )}
            {issue.is_regression && (
              <Chip label={t('argus.issues.regression')} size="small" sx={{
                fontWeight: 700, fontSize: '0.68rem',
                backgroundColor: alpha('#ff9800', 0.12), color: '#ff9800', border: 'none',
              }} />
            )}
            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {issue.fingerprint && (
                <Tooltip title={t('argus.issues.copyFingerprint')}>
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
                <Tooltip title={t('argus.issues.copyEventId')}>
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
            <StatMini label={t('argus.issues.events')} value={issue.event_count?.toLocaleString() || '0'} color={levelColor} />
            <StatMini label={t('argus.issues.users')} value={issue.user_count?.toLocaleString() || '0'} color="#ff9800" />
            <StatMini label={t('argus.issues.firstSeen')} value={issue.first_seen ? formatRelative(issue.first_seen, t) : '-'} color="#7c4dff" />
            <StatMini label={t('argus.issues.lastSeen')} value={issue.last_seen ? formatRelative(issue.last_seen, t) : '-'} color="#2196f3" />
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
                    {t('argus.issues.context')}
                  </Typography>
                  <ContextGrid items={[
                    latestEvent.environment && { label: t('argus.issues.environment'), value: latestEvent.environment },
                    latestEvent.release && { label: t('argus.issues.release'), value: latestEvent.release },
                    latestEvent.browser && { label: t('argus.issues.browser'), value: `${latestEvent.browser} ${latestEvent.browser_version || ''}` },
                    latestEvent.os && { label: t('argus.issues.os'), value: `${latestEvent.os} ${latestEvent.os_version || ''}` },
                    latestEvent.transaction && { label: t('argus.issues.transaction'), value: latestEvent.transaction },
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
                        Tags
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
                </Paper>
              </Box>

              {/* Trace Waterfall */}
              {traceId && (
                <Paper elevation={0} sx={{
                  p: 2, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  borderRadius: 2,
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: showTrace ? 2 : 0 }}>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <ScheduleIcon fontSize="small" sx={{ color: theme.palette.success.main }} />
                      {t('argus.issues.transactionTrace', 'Transaction Trace')}
                    </Typography>
                    {!showTrace && (
                      <Button variant="outlined" size="small" onClick={() => loadTrace(traceId)} disabled={loadingTrace}>
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
                          Trace 정보를 불러오지 못했습니다.
                        </Typography>
                      )}
                    </Box>
                  )}
                </Paper>
              )}

              {/* Breadcrumbs */}
              {latestEvent.breadcrumbs && Array.isArray(latestEvent.breadcrumbs) && latestEvent.breadcrumbs.length > 0 && (
                <Paper elevation={0} sx={{
                  p: 2, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  borderRadius: 2,
                }}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <FolderIcon fontSize="small" sx={{ color: theme.palette.warning.main }} />
                    {t('argus.issues.breadcrumbs', 'Breadcrumbs')}
                    <Chip label={latestEvent.breadcrumbs.length} size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, ml: 0.5 }} />
                  </Typography>
                  <BreadcrumbsTimeline breadcrumbs={latestEvent.breadcrumbs} />
                </Paper>
              )}
            </Box>
          )}
        </Box>
      )}

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
    </PageContentLoader>
  );
};

// --- Stacktrace Viewer ---
const StacktraceView: React.FC<{ stacktrace: any; isDark: boolean }> = ({ stacktrace, isDark }) => {
  const [toggledFrames, setToggledFrames] = useState<Set<number>>(new Set());

  let frames: any[] = [];
  try {
    frames = typeof stacktrace === 'string' ? JSON.parse(stacktrace) : (Array.isArray(stacktrace) ? stacktrace : []);
  } catch { frames = []; }

  if (frames.length === 0) return null;

  const toggleFrame = (idx: number) => {
    setToggledFrames(prev => {
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
        const isExpanded = hasContext && (toggledFrames.has(idx) ? !isInApp : isInApp);
        return (
          <Box key={idx}>
            <Box
              onClick={hasContext ? () => toggleFrame(idx) : undefined}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: 2, py: 0.8,
                cursor: hasContext ? 'pointer' : 'default',
                backgroundColor: isInApp ? alpha('#7c4dff', isDark ? 0.08 : 0.04) : 'transparent',
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                '&:hover': { backgroundColor: hasContext ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)') : undefined },
                transition: 'background 0.15s',
              }}
            >
              {hasContext ? (
                isExpanded ? <ExpandLessIcon sx={{ fontSize: 16, color: 'text.secondary' }} /> : <ExpandMoreIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              ) : (
                <Box sx={{ width: 16 }} />
              )}
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
    {items.map((item, idx) => (
      <React.Fragment key={`${item.label}-${idx}`}>
        <Typography variant="caption" sx={{ color: isDark ? '#666' : '#999', fontWeight: 500 }}>{item.label}</Typography>
        <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 500, fontSize: '0.78rem' }}>{item.value}</Typography>
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
