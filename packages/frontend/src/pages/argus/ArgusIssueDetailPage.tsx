import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Menu,
  MenuItem,
  Avatar,
  Divider,
  ListItemText,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  BugReport as BugReportIcon,
  Person as PersonIcon,
  Warning as SpanEvidenceIcon,
  Code as StackTraceIcon,
  Article as LogIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { ArgusErrorEvent } from '@/services/argusService';
import { useIssueDetailData, useTraceData } from '@/hooks/useIssueDetailData';
import { useIssueActions } from '@/hooks/useIssueActions';
import { useResizableSplit } from '@/hooks/useResizableSplit';
import { LEVEL_COLORS, stringToColor, getInitials } from '@/utils/argusHelpers';
import { useAuth } from '@/contexts/AuthContext';
import PageContentLoader from '@/components/common/PageContentLoader';
import EventNavigator from '@/components/argus/EventNavigator';
import EventDistributionChart from '@/components/argus/EventDistributionChart';
import AiRootCausePanel from '@/components/argus/AiRootCausePanel';
import IssueLogsSection from '@/components/argus/IssueLogsSection';
import CollapsibleSection from '@/components/argus/CollapsibleSection';

// Page-specific components
import IssueActionBar from './components/IssueActionBar';
import IssueStacktraceSection, {
  StacktraceControls,
  useStacktraceState,
} from './components/IssueStacktraceSection';
import IssueContextSection from './components/IssueContextSection';
import SpanEvidenceSection from '@/components/argus/SpanEvidenceSection';
import IssueDetailSidebar from './components/IssueDetailSidebar';
import PageHeader from '@/components/common/PageHeader';

const MIN_SPLIT_WIDTH = 250;
const MAX_SPLIT_WIDTH = 800;

const ArgusIssueDetailPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const isDark = theme.palette.mode === 'dark';
  const { projectId, issueId } = useParams<{
    projectId: string;
    issueId: string;
  }>();

  // --- Data Hooks ---
  const {
    issue,
    issueLoading: loading,
    members,
    updateIssueOptimistic,
    revalidateIssue,
  } = useIssueDetailData({ projectId, issueId });

  // --- UI State ---
  const [assigneeAnchor, setAssigneeAnchor] = useState<HTMLElement | null>(
    null
  );
  const [currentEvent, setCurrentEvent] = useState<ArgusErrorEvent | null>(
    null
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const {
    mode: stMode,
    setMode: setStMode,
    order: stOrder,
    setOrder: setStOrder,
  } = useStacktraceState();
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    status: string;
  }>({ open: false, status: '' });

  // --- Resizable Splitter ---
  const {
    splitWidth,
    isDragging: isSplitDragging,
    handleMouseDown: handleSplitterMouseDown,
    panelRef: splitPanelRef,
  } = useResizableSplit({
    storageKey: 'argus_issue_split_width',
    defaultWidth: 320,
    minWidth: MIN_SPLIT_WIDTH,
    maxWidth: MAX_SPLIT_WIDTH,
    invertDelta: true,
  });

  // --- Trace ---
  const latestEvent = currentEvent || issue?.latest_event;
  let traceId: string | null = null;
  if (latestEvent) {
    if (latestEvent.contexts) {
      try {
        const ctx =
          typeof latestEvent.contexts === 'string'
            ? JSON.parse(latestEvent.contexts)
            : latestEvent.contexts;
        traceId = ctx?.trace?.trace_id;
      } catch {}
    }
    if (!traceId && latestEvent.tags) {
      try {
        const tags =
          typeof latestEvent.tags === 'string'
            ? JSON.parse(latestEvent.tags)
            : latestEvent.tags;
        traceId = tags?.trace_id || tags?.['sentry:trace'];
      } catch {}
    }
  }

  const { traceDetail, traceLoading: loadingTrace } = useTraceData(
    projectId,
    traceId,
    !sidebarCollapsed
  );

  // --- Span Evidence ---
  const spanEvidence = useMemo(() => {
    if (!traceDetail || !traceDetail.spans) return [];

    const queryCounts: Record<
      string,
      { count: number; totalDuration: number; op: string }
    > = {};
    const evidence: any[] = [];

    traceDetail.spans.forEach((span) => {
      const isDb = span.op?.startsWith('db');
      const isHttp = span.op?.startsWith('http');
      const dur = span.duration || 0;

      if (isDb) {
        if (!queryCounts[span.description]) {
          queryCounts[span.description] = {
            count: 0,
            totalDuration: 0,
            op: span.op,
          };
        }
        queryCounts[span.description].count++;
        queryCounts[span.description].totalDuration += dur;
      }

      let problem_type;
      if (isDb && dur > 500) problem_type = 'slow_db_query';
      else if (isHttp && dur > 1000) problem_type = 'slow_http';
      else if (dur > 2000) problem_type = 'slow_resource';
      else if (span.status !== 'ok' && span.status !== 'unknown')
        problem_type = 'internal_error';

      if (problem_type) {
        evidence.push({
          op: span.op || 'unknown',
          description: span.description || '',
          duration_ms: dur,
          status: span.status || 'ok',
          problem_type,
          parent_span_id: span.parent_span_id,
        });
      }
    });

    Object.entries(queryCounts).forEach(([desc, stat]) => {
      if (stat.count >= 5 && stat.totalDuration > 100) {
        const existing = evidence.find((e) => e.description === desc);
        if (existing) {
          existing.problem_type = 'n_plus_one';
          existing.repeats = stat.count;
          existing.duration_ms = stat.totalDuration;
        } else {
          evidence.push({
            op: stat.op || 'db.query',
            description: desc,
            duration_ms: stat.totalDuration,
            status: 'ok',
            problem_type: 'n_plus_one',
            repeats: stat.count,
          });
        }
      }
    });

    return evidence.sort((a, b) => b.duration_ms - a.duration_ms).slice(0, 5);
  }, [traceDetail]);

  // --- Actions ---
  const actions = useIssueActions({
    projectId,
    issueId,
    issue,
    updateIssueOptimistic,
    revalidateIssue,
  });

  const handleAssign = async (assignee: string) => {
    await actions.assign(assignee);
    setAssigneeAnchor(null);
  };
  const handleSubscribe = async (sub: boolean) => {
    await actions.subscribe(sub);
    setIsSubscribed(sub);
  };
  const handleBookmark = async (bm: boolean) => {
    await actions.bookmark(bm);
    setIsBookmarked(bm);
  };

  const handleStatusChange = async (status: string) => {
    setConfirmDialog({ open: true, status });
  };

  const executeStatusChange = async () => {
    if (!confirmDialog.status) return;
    await actions.changeStatus(confirmDialog.status);
    setConfirmDialog({ open: false, status: '' });
  };

  const handlePriorityChange = async (priority: string) => {
    await actions.changePriority(priority);
  };

  const levelColor =
    LEVEL_COLORS[issue?.level || 'error'] || LEVEL_COLORS.error;

  // ─── Stable callback handlers (for React.memo) ─────────────────
  const handleAssigneeOpen = useCallback(
    (e: React.MouseEvent<HTMLElement>) => setAssigneeAnchor(e.currentTarget),
    []
  );
  const handleOpenAiAnalysis = useCallback(() => setShowAiAnalysis(true), []);
  const handleToggleSidebar = useCallback(
    () => setSidebarCollapsed((c) => !c),
    []
  );
  const handleEventChange = useCallback(
    (evt: ArgusErrorEvent | null) => setCurrentEvent(evt),
    []
  );

  // ─── RENDER ───
  return (
    <PageContentLoader loading={loading}>
      <PageHeader title={t('argus.issues.detail', 'Issue Detail')} />
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
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 96px)',
            mt: -0.5,
          }}
        >
          {/* Action Bar (Header + Controls) */}
          <IssueActionBar
            issue={issue}
            latestEvent={latestEvent as ArgusErrorEvent | null}
            projectId={projectId || ''}
            issueId={issueId || ''}
            isDark={isDark}
            onStatusChange={handleStatusChange}
            onPriorityChange={handlePriorityChange}
            onAssigneeClick={handleAssigneeOpen}
            isSubscribed={isSubscribed}
            isBookmarked={isBookmarked}
            onSubscribe={handleSubscribe}
            onBookmark={handleBookmark}
            onDelete={actions.deleteIssue}
            onDiscard={actions.discardIssue}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={handleToggleSidebar}
          />

          {/* AI Analysis Dialog */}
          <Dialog
            open={showAiAnalysis}
            onClose={() => setShowAiAnalysis(false)}
            maxWidth="md"
            fullWidth
            PaperProps={{
              sx: {
                borderRadius: 3,
                overflow: 'hidden',
                backgroundImage: 'none',
              },
            }}
          >
            <DialogContent sx={{ p: 0, overflowX: 'hidden' }}>
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
                  onClose={() => setShowAiAnalysis(false)}
                />
              )}
            </DialogContent>
          </Dialog>

          {/* ═══════ CARD CONTAINER ═══════ */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              overflow: 'hidden',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              borderRadius: 2,
            }}
          >
            {/* Left Column: Main Content */}
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                overflow: 'auto',
                px: 2.5,
                py: 2,
              }}
            >
              {/* Event Navigator */}
              {projectId && issueId && (
                <Box sx={{ mb: 2 }}>
                  <EventNavigator
                    projectId={projectId}
                    issueId={issueId}
                    currentEvent={latestEvent as ArgusErrorEvent | null}
                    onEventChange={handleEventChange}
                    isDark={isDark}
                  />
                </Box>
              )}

              {/* Event Distribution Chart — always visible, no collapse */}
              {projectId && issueId && (
                <EventDistributionChart
                  projectId={projectId}
                  issueId={issueId}
                  isDark={isDark}
                />
              )}

              {/* Context, Tags, Stacktrace */}
              {latestEvent && (
                <IssueContextSection
                  event={latestEvent}
                  highlightEvent={latestEvent}
                  traceId={traceId}
                  traceDetail={traceDetail}
                  loadingTrace={loadingTrace}
                  isDark={isDark}
                  stacktraceSlot={
                    <CollapsibleSection
                      title={t('argus.issues.stackTraceTitle', 'Stack Trace')}
                      icon={
                        <StackTraceIcon
                          fontSize="small"
                          sx={{ color: theme.palette.error.main }}
                        />
                      }
                      storageKey="stacktrace"
                      hideActionsOnCollapse
                      actions={
                        <Box
                          sx={{
                            display: 'flex',
                            gap: 0.75,
                            alignItems: 'center',
                          }}
                        >
                          <StacktraceControls
                            mode={stMode}
                            setMode={setStMode}
                            order={stOrder}
                            setOrder={setStOrder}
                            event={latestEvent}
                            isDark={isDark}
                          />
                        </Box>
                      }
                    >
                      <IssueStacktraceSection
                        event={latestEvent}
                        isDark={isDark}
                        mode={stMode}
                        order={stOrder}
                      />
                    </CollapsibleSection>
                  }
                />
              )}

              {/* Span Evidence */}
              <CollapsibleSection
                title={t('argus.spanEvidence.title', 'Span Evidence')}
                icon={
                  <SpanEvidenceIcon
                    fontSize="small"
                    sx={{ color: '#ff9800' }}
                  />
                }
                storageKey="span_evidence"
                hidden={spanEvidence.length === 0}
              >
                <SpanEvidenceSection spans={spanEvidence} />
              </CollapsibleSection>

              {/* Structured Logs */}
              {issue && projectId && issueId && (
                <CollapsibleSection
                  title={t('argus.issues.logs', 'Logs')}
                  icon={
                    <LogIcon
                      fontSize="small"
                      sx={{ color: theme.palette.info.main }}
                    />
                  }
                  storageKey="logs"
                >
                  <IssueLogsSection
                    projectId={projectId}
                    issueId={issueId}
                    isDark={isDark}
                  />
                </CollapsibleSection>
              )}
            </Box>

            {/* Sidebar */}
            {!sidebarCollapsed && (
              <>
                {/* Splitter Handle */}
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

                {/* Sidebar Panel */}
                <Box
                  ref={splitPanelRef as React.Ref<HTMLDivElement>}
                  sx={{
                    width: { xs: '100%', md: splitWidth },
                    minWidth: { md: MIN_SPLIT_WIDTH },
                    flexShrink: 0,
                    overflow: 'auto',
                    pl: 1.5,
                    pr: 2.5,
                    py: 2,
                  }}
                >
                  <IssueDetailSidebar
                    issue={issue}
                    latestEvent={latestEvent as ArgusErrorEvent | null}
                    projectId={projectId || ''}
                    issueId={issueId || ''}
                    isDark={isDark}
                    updateIssueOptimistic={updateIssueOptimistic}
                    revalidateIssue={revalidateIssue}
                  />
                </Box>
              </>
            )}
          </Box>

          {/* Status Change Confirm Dialog */}
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
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: 0.5,
                  }}
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
                <Box
                  sx={{ display: 'flex', gap: 3, ml: 1.5, flexWrap: 'wrap' }}
                >
                  <Typography
                    variant="caption"
                    sx={{ color: isDark ? '#ddd' : '#333' }}
                  >
                    <strong style={{ color: isDark ? '#888' : '#666' }}>
                      {t('argus.issues.events')}:
                    </strong>{' '}
                    {issue.event_count?.toLocaleString() || 0}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: isDark ? '#ddd' : '#333' }}
                  >
                    <strong style={{ color: isDark ? '#888' : '#666' }}>
                      {t('argus.issues.users')}:
                    </strong>{' '}
                    {issue.user_count?.toLocaleString() || 0}
                  </Typography>
                </Box>
              </Box>
              <DialogContentText
                sx={{ color: 'text.primary', fontWeight: 500 }}
              >
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
            <MenuItem onClick={() => handleAssign('')}>
              <PersonIcon sx={{ fontSize: 18, mr: 1 }} />
              <ListItemText
                primary={t('argus.issues.unassigned', 'Unassigned')}
                primaryTypographyProps={{ fontSize: '0.82rem' }}
              />
            </MenuItem>
            <Divider />
            {members.map((member) => {
              const displayName = member.name || member.email || member.userId;
              const memberIsMe =
                user &&
                (member.email === user.email ||
                  member.name === user.name ||
                  member.userId === String(user.id));
              const label = memberIsMe
                ? t('argus.issues.assigneeMe', { name: displayName })
                : displayName;
              return (
                <MenuItem
                  key={member.userId}
                  onClick={() => handleAssign(displayName)}
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
                    primary={label}
                    primaryTypographyProps={{
                      fontSize: '0.82rem',
                      fontWeight: memberIsMe ? 700 : 400,
                    }}
                  />
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
