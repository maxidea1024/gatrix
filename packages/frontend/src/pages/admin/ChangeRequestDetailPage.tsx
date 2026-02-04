import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Button,
  TextField,
  IconButton,
  Divider,
  Avatar,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Collapse,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ArrowBack as ArrowBackIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Undo as UndoIcon,
  PlayArrow as PlayArrowIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  Person as PersonIcon,
  MergeType as MergeIcon,
  DifferenceOutlined as DiffIcon,
  ChatBubbleOutline as ChatIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useHandleApiError } from '@/hooks/useHandleApiError';
import useSWR from 'swr';
import { useAuth } from '@/contexts/AuthContext';
import { RelativeTime } from '@/components/common/RelativeTime';
import ConfirmDeleteDialog from '@/components/common/ConfirmDeleteDialog';
import changeRequestService, {
  ChangeRequest,
  ChangeRequestStatus,
} from '@/services/changeRequestService';

// Status configuration
const STATUS_CONFIG: Record<
  ChangeRequestStatus,
  {
    color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
    labelKey: string;
    bgColor: string;
  }
> = {
  draft: {
    color: 'default',
    labelKey: 'changeRequest.status.draft',
    bgColor: '#6e7681',
  },
  open: {
    color: 'primary',
    labelKey: 'changeRequest.status.open',
    bgColor: '#238636',
  },
  approved: {
    color: 'success',
    labelKey: 'changeRequest.status.approved',
    bgColor: '#8957e5',
  },
  applied: {
    color: 'info',
    labelKey: 'changeRequest.status.applied',
    bgColor: '#a371f7',
  },
  rejected: {
    color: 'error',
    labelKey: 'changeRequest.status.rejected',
    bgColor: '#f85149',
  },
};

// Timeline event type
interface TimelineEvent {
  type: 'created' | 'submitted' | 'approved' | 'rejected' | 'reopened' | 'executed';
  timestamp: string;
  user?: { name?: string; email?: string };
  comment?: string;
  title?: string;
  reason?: string;
}

// Field Change
interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
  operation: 'added' | 'removed' | 'modified';
}

const ChangeRequestDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();

  const [actionLoading, setActionLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitTitle, setSubmitTitle] = useState('');
  const [submitReason, setSubmitReason] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [expandedReasons, setExpandedReasons] = useState<Record<number, boolean>>({});

  // Delete handler for error dialog
  const handleDeleteFromError = async () => {
    try {
      await changeRequestService.delete(id!);
      enqueueSnackbar(t('changeRequest.messages.deleted'), {
        variant: 'success',
      });
      navigate('/admin/change-requests');
    } catch (err: any) {
      enqueueSnackbar(t('changeRequest.errors.deleteFailed'), {
        variant: 'error',
      });
    }
  };

  const { handleApiError, ErrorDialog } = useHandleApiError({
    onDelete: handleDeleteFromError,
  });

  // Fetch change request
  const {
    data: cr,
    error,
    isLoading,
    mutate,
  } = useSWR(id ? `change-request-${id}` : null, () => changeRequestService.getById(id!), {
    revalidateOnFocus: false,
  });

  // Build timeline from CR data
  const timeline = useMemo<TimelineEvent[]>(() => {
    if (!cr) return [];
    const events: TimelineEvent[] = [];

    events.push({
      type: 'created',
      timestamp: cr.createdAt,
      user: cr.requester,
    });

    if (cr.status !== 'draft') {
      events.push({
        type: 'submitted',
        timestamp: cr.updatedAt,
        user: cr.requester,
        title: cr.title,
        reason: cr.reason,
      });
    }

    if (cr.approvals?.length) {
      cr.approvals.forEach((approval) => {
        events.push({
          type: 'approved',
          timestamp: approval.createdAt,
          user: approval.approver,
          comment: approval.comment,
        });
      });
    }

    if (cr.status === 'rejected' && cr.rejectedAt) {
      events.push({
        type: 'rejected',
        timestamp: cr.rejectedAt,
        user: cr.rejector,
        comment: cr.rejectionReason,
      });
    }

    if (cr.status === 'applied') {
      events.push({
        type: 'executed',
        timestamp: cr.updatedAt,
        user: cr.executor,
      });
    }

    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [cr]);

  // Compute all field changes
  const allChanges = useMemo(() => {
    if (!cr?.changeItems) return [];

    return cr.changeItems.map((item) => {
      const before = item.beforeData || {};
      const after = item.afterData || {};
      const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
      const changes: FieldChange[] = [];

      allKeys.forEach((key) => {
        const oldVal = before[key];
        const newVal = after[key];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          let operation: 'added' | 'removed' | 'modified' = 'modified';
          if (oldVal === undefined) operation = 'added';
          else if (newVal === undefined) operation = 'removed';
          changes.push({
            field: key,
            oldValue: oldVal,
            newValue: newVal,
            operation,
          });
        }
      });

      return {
        table: item.targetTable,
        targetId: item.targetId,
        operation: item.operation || 'update',
        changes,
      };
    });
  }, [cr]);

  const formatValue = (value: any): string => {
    if (value === null) return 'null';
    if (value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const hasApproved = useMemo(() => {
    return cr?.approvals?.some((a) => a.approverId === user?.id);
  }, [cr, user]);

  const requiredApprovals = cr?.environmentModel?.requiredApprovers ?? 1;
  const currentApprovals = cr?.approvals?.length ?? 0;

  // Actions
  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await changeRequestService.approve(id!, comment || undefined);
      enqueueSnackbar(t('changeRequest.messages.approved'), {
        variant: 'success',
      });
      setComment('');
      mutate();
    } catch (err: any) {
      handleApiError(err, 'changeRequest.errors.approveFailed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!comment.trim()) {
      enqueueSnackbar(t('changeRequest.errors.rejectCommentRequired'), {
        variant: 'warning',
      });
      return;
    }
    setActionLoading(true);
    try {
      await changeRequestService.reject(id!, comment);
      enqueueSnackbar(t('changeRequest.messages.rejected'), {
        variant: 'success',
      });
      setComment('');
      mutate();
    } catch (err: any) {
      handleApiError(err, 'changeRequest.errors.rejectFailed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopen = async () => {
    setActionLoading(true);
    try {
      await changeRequestService.reopen(id!);
      enqueueSnackbar(t('changeRequest.messages.reopened'), {
        variant: 'success',
      });
      mutate();
    } catch (err: any) {
      handleApiError(err, 'changeRequest.errors.reopenFailed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecute = async () => {
    setActionLoading(true);
    try {
      await changeRequestService.execute(id!);
      enqueueSnackbar(t('changeRequest.messages.executed'), {
        variant: 'success',
      });
      mutate();
    } catch (err: any) {
      if (handleApiError(err, 'changeRequest.errors.executeFailed')) {
        mutate(); // Refresh if it was a conflict
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    setActionLoading(true);
    try {
      await changeRequestService.delete(id!);
      enqueueSnackbar(t('changeRequest.messages.deleted'), {
        variant: 'success',
      });
      navigate('/admin/change-requests');
    } catch (err: any) {
      handleApiError(err, 'changeRequest.errors.deleteFailed');
      setIsDeleteDialogOpen(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!submitTitle.trim()) {
      enqueueSnackbar(t('changeRequest.errors.titleRequired'), {
        variant: 'warning',
      });
      return;
    }
    setActionLoading(true);
    try {
      await changeRequestService.submit(id!, {
        title: submitTitle.trim(),
        reason: submitReason.trim() || undefined,
      });
      enqueueSnackbar(t('changeRequest.messages.submitted'), {
        variant: 'success',
      });
      setShowSubmitForm(false);
      mutate();
    } catch (err: any) {
      handleApiError(err, 'changeRequest.errors.submitFailed');
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !cr) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{t('common.loadFailed')}</Alert>
      </Box>
    );
  }

  const statusConfig = STATUS_CONFIG[cr.status];
  const totalChanges = allChanges.reduce((sum, item) => sum + item.changes.length, 0);

  return (
    <Box sx={{ p: 3, bgcolor: 'background.default', minHeight: '100vh' }}>
      {/* GitHub-style Header */}
      <Box
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          borderRadius: 1,
          mb: 3,
        }}
      >
        <Box sx={{ px: 3, py: 2 }}>
          {/* Back + Title */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 1 }}>
            <IconButton
              size="small"
              onClick={() => navigate('/admin/change-requests')}
              sx={{ mt: 0.5 }}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                {cr.title || t('changeRequest.title')}
                <Typography
                  component="span"
                  sx={{ ml: 1, color: 'text.secondary', fontWeight: 400 }}
                >
                  #{cr.id.slice(0, 8)}
                </Typography>
              </Typography>
            </Box>
          </Box>

          {/* Status + Meta */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, pl: 6 }}>
            <Chip
              label={t(statusConfig.labelKey)}
              size="small"
              sx={{
                bgcolor: statusConfig.bgColor,
                color: '#fff',
                fontWeight: 600,
                borderRadius: '2em',
              }}
            />
            <Typography variant="body2" color="text.secondary">
              <strong>{cr.requester?.name || cr.requester?.email}</strong>{' '}
              {t('changeRequest.wantsToMerge')} {allChanges.length} {t('changeRequest.changes')}
            </Typography>
          </Box>

          {/* Tabs */}
          <Box sx={{ pl: 6, mt: 2 }}>
            <Tabs
              value={activeTab}
              onChange={(_, v) => setActiveTab(v)}
              sx={{
                minHeight: 40,
                '& .MuiTab-root': {
                  minHeight: 40,
                  textTransform: 'none',
                  fontWeight: 500,
                },
              }}
            >
              <Tab
                icon={<HistoryIcon sx={{ fontSize: 18 }} />}
                iconPosition="start"
                label={`${t('changeRequest.conversation')} (${timeline.length})`}
              />
              <Tab
                icon={<DiffIcon sx={{ fontSize: 18 }} />}
                iconPosition="start"
                label={`${t('changeRequest.filesChanged')} (${totalChanges})`}
              />
            </Tabs>
          </Box>
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ px: 0 }}>
        {/* Conversation Tab */}
        {activeTab === 0 && (
          <Box sx={{ display: 'flex', gap: 3 }}>
            {/* Main */}
            <Box sx={{ flex: 1 }}>
              {/* Initial Comment */}
              <Box sx={{ display: 'flex', mb: 2 }}>
                {/* Time column with triangle pointer */}
                <Box
                  sx={{
                    width: 72,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'flex-end',
                    pr: 1,
                    pt: 1.5,
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontWeight: 600, fontFamily: 'monospace' }}
                    >
                      {new Date(cr.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}
                    </Typography>
                    <Box
                      sx={{
                        width: 0,
                        height: 0,
                        borderTop: '6px solid transparent',
                        borderBottom: '6px solid transparent',
                        borderLeft: (theme) =>
                          `6px solid ${alpha(theme.palette.text.secondary, 0.3)}`,
                      }}
                    />
                  </Box>
                </Box>

                {/* Timeline connector column */}
                <Box
                  sx={{
                    width: 48,
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    position: 'relative',
                  }}
                >
                  <Avatar
                    sx={{
                      width: 32,
                      height: 32,
                      bgcolor: 'grey.500',
                      mt: 0.5,
                      zIndex: 1,
                    }}
                  >
                    <PersonIcon sx={{ fontSize: 18 }} />
                  </Avatar>
                  {timeline.filter((e) => e.type !== 'created').length > 0 && (
                    <Box
                      sx={{
                        flex: 1,
                        width: 2,
                        bgcolor: 'divider',
                        mt: 1,
                      }}
                    />
                  )}
                </Box>

                {/* Content column */}
                <Box sx={{ flex: 1, pl: 1.5 }}>
                  <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                    <Box
                      sx={{
                        bgcolor: 'action.hover',
                        px: 2,
                        py: 1,
                        borderBottom: cr.reason || cr.description ? 1 : 0,
                        borderColor: 'divider',
                      }}
                    >
                      <Typography variant="body2">
                        <strong>{cr.requester?.name || cr.requester?.email}</strong>{' '}
                        {t('changeRequest.opened')} <RelativeTime date={cr.createdAt} />
                      </Typography>
                    </Box>
                    {(cr.reason || cr.description) && (
                      <Box sx={{ p: 2 }}>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {cr.reason || cr.description}
                        </Typography>
                      </Box>
                    )}
                  </Paper>
                </Box>
              </Box>

              {/* Timeline Events */}
              {timeline
                .filter((e) => e.type !== 'created')
                .map((event, idx, arr) => (
                  <Box key={idx} sx={{ display: 'flex', mb: 2 }}>
                    {/* Time column with triangle pointer */}
                    <Box
                      sx={{
                        width: 72,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'flex-end',
                        pr: 1,
                        pt: 0.5,
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontWeight: 600, fontFamily: 'monospace' }}
                        >
                          {new Date(event.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          })}
                        </Typography>
                        <Box
                          sx={{
                            width: 0,
                            height: 0,
                            borderTop: '6px solid transparent',
                            borderBottom: '6px solid transparent',
                            borderLeft: (theme) =>
                              `6px solid ${
                                event.type === 'rejected'
                                  ? theme.palette.error.main
                                  : event.type === 'approved'
                                    ? theme.palette.success.main
                                    : event.type === 'executed'
                                      ? theme.palette.info.main
                                      : theme.palette.primary.main
                              }`,
                          }}
                        />
                      </Box>
                    </Box>

                    {/* Timeline connector column */}
                    <Box
                      sx={{
                        width: 48,
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        position: 'relative',
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor:
                            event.type === 'rejected'
                              ? 'error.main'
                              : event.type === 'approved'
                                ? 'success.main'
                                : event.type === 'executed'
                                  ? 'info.main'
                                  : 'primary.main',
                          zIndex: 1,
                        }}
                      >
                        {event.type === 'submitted' && <SendIcon sx={{ fontSize: 16 }} />}
                        {event.type === 'approved' && <CheckIcon sx={{ fontSize: 16 }} />}
                        {event.type === 'rejected' && <CloseIcon sx={{ fontSize: 16 }} />}
                        {event.type === 'executed' && <MergeIcon sx={{ fontSize: 16 }} />}
                      </Avatar>
                      {idx < arr.length - 1 && (
                        <Box
                          sx={{
                            flex: 1,
                            width: 2,
                            bgcolor: 'divider',
                            mt: 1,
                          }}
                        />
                      )}
                    </Box>

                    {/* Content column */}
                    <Box sx={{ flex: 1, pl: 1.5 }}>
                      <Typography variant="body2">
                        <strong>{event.user?.name || event.user?.email || 'System'}</strong>{' '}
                        {event.type === 'submitted' && t('changeRequest.timeline.submitted')}
                        {event.type === 'approved' && t('changeRequest.timeline.approved')}
                        {event.type === 'rejected' && t('changeRequest.timeline.rejected')}
                        {event.type === 'executed' && t('changeRequest.timeline.executed')}{' '}
                        <Typography component="span" color="text.secondary">
                          <RelativeTime date={event.timestamp} />
                        </Typography>
                      </Typography>

                      {/* Submitted event: show title with expandable reason */}
                      {event.type === 'submitted' && event.title && (
                        <Box sx={{ mt: 1 }}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              flexWrap: 'wrap',
                            }}
                          >
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {event.title}
                            </Typography>
                            {event.reason && (
                              <Chip
                                label={expandedReasons[idx] ? t('changeRequest.collapse') : '...'}
                                size="small"
                                onClick={() =>
                                  setExpandedReasons((prev) => ({
                                    ...prev,
                                    [idx]: !prev[idx],
                                  }))
                                }
                                sx={{
                                  height: 20,
                                  fontSize: 11,
                                  fontWeight: 500,
                                  bgcolor: (theme) => alpha(theme.palette.text.primary, 0.08),
                                  color: 'text.secondary',
                                  cursor: 'pointer',
                                  '&:hover': {
                                    bgcolor: (theme) => alpha(theme.palette.text.primary, 0.15),
                                  },
                                }}
                              />
                            )}
                          </Box>
                          <Collapse in={!!expandedReasons[idx]} timeout={200}>
                            {event.reason && (
                              <Paper
                                variant="outlined"
                                sx={{
                                  mt: 1,
                                  p: 1.5,
                                  bgcolor: 'action.hover',
                                }}
                              >
                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                  {event.reason}
                                </Typography>
                              </Paper>
                            )}
                          </Collapse>
                        </Box>
                      )}

                      {event.comment && (
                        <Paper
                          variant="outlined"
                          sx={{
                            mt: 1,
                            p: 1.5,
                            bgcolor:
                              event.type === 'rejected'
                                ? (theme) => alpha(theme.palette.error.main, 0.1)
                                : event.type === 'approved'
                                  ? (theme) => alpha(theme.palette.success.main, 0.1)
                                  : 'action.hover',
                            borderColor:
                              event.type === 'rejected'
                                ? 'error.main'
                                : event.type === 'approved'
                                  ? 'success.main'
                                  : 'divider',
                          }}
                        >
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                            {event.comment}
                          </Typography>
                        </Paper>
                      )}
                    </Box>
                  </Box>
                ))}

              <Divider sx={{ my: 3, borderStyle: 'dashed' }} />

              {/* Review Box */}
              {cr.status === 'open' && (
                <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                  <Box
                    sx={{
                      bgcolor: 'action.hover',
                      px: 2,
                      py: 1.5,
                      borderBottom: 1,
                      borderColor: 'divider',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Typography variant="subtitle2">{t('changeRequest.addReview')}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      {t('changeRequest.approvalProgress')}: {currentApprovals} /{' '}
                      {requiredApprovals}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 2 }}>
                    {!hasApproved && cr.requesterId !== user?.id ? (
                      <>
                        <TextField
                          autoFocus
                          fullWidth
                          multiline
                          rows={4}
                          placeholder={t('changeRequest.leaveComment')}
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          variant="outlined"
                          sx={{ mb: 2 }}
                        />
                        <Box
                          sx={{
                            display: 'flex',
                            gap: 1,
                            justifyContent: 'flex-end',
                          }}
                        >
                          <Button
                            variant="outlined"
                            color="error"
                            onClick={handleReject}
                            disabled={actionLoading || !comment.trim()}
                          >
                            {t('changeRequest.actions.reject')}
                          </Button>
                          <Button
                            variant="contained"
                            color="success"
                            startIcon={<CheckIcon />}
                            onClick={handleApprove}
                            disabled={actionLoading}
                          >
                            {t('changeRequest.actions.approve')}
                          </Button>
                        </Box>
                      </>
                    ) : (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          py: 2,
                          flexDirection: 'column',
                          gap: 1,
                        }}
                      >
                        {hasApproved ? (
                          <>
                            <CheckIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
                            <Typography variant="body2" color="text.secondary">
                              {t('errors.CR_ALREADY_APPROVED')}
                            </Typography>
                          </>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {t('errors.CR_SELF_APPROVAL_NOT_ALLOWED')}
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Box>
                </Paper>
              )}

              {/* Status Banners */}
              {cr.status === 'rejected' &&
                (cr.requesterId === user?.id || user?.role === 'admin' || user?.role === 0) && (
                  <Paper
                    sx={{
                      p: 2,
                      bgcolor: (theme) => alpha(theme.palette.error.main, 0.1),
                      border: 1,
                      borderColor: 'error.main',
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight={500} color="error.main">
                          {t('changeRequest.status.rejected')}
                        </Typography>
                        {cr.rejectionReason && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block', mt: 0.5 }}
                          >
                            {cr.rejectionReason}
                          </Typography>
                        )}
                      </Box>
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={handleDelete}
                        disabled={actionLoading}
                      >
                        {t('common.delete')}
                      </Button>
                    </Box>
                  </Paper>
                )}

              {cr.status === 'approved' && (
                <Paper
                  sx={{
                    p: 2,
                    bgcolor: (theme) => alpha(theme.palette.success.main, 0.1),
                    border: 1,
                    borderColor: 'success.main',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Box>
                      <Typography variant="body2" fontWeight={500} color="success.main">
                        ✓ {t('changeRequest.readyToMerge')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {cr.approvals?.length || 0} {t('changeRequest.approvals')}
                      </Typography>
                    </Box>
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={<MergeIcon />}
                      onClick={handleExecute}
                      disabled={actionLoading}
                    >
                      {t('changeRequest.actions.merge')}
                    </Button>
                  </Box>
                </Paper>
              )}

              {cr.status === 'draft' && !showSubmitForm && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {t('changeRequest.draftMessage')}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={handleDelete}
                        disabled={actionLoading}
                      >
                        {t('common.delete')}
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<SendIcon />}
                        onClick={() => setShowSubmitForm(true)}
                        disabled={actionLoading}
                      >
                        {t('changeRequest.actions.readyForReview')}
                      </Button>
                    </Box>
                  </Box>
                </Paper>
              )}

              {cr.status === 'draft' && showSubmitForm && (
                <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                  <Box
                    sx={{
                      bgcolor: 'action.hover',
                      px: 2,
                      py: 1.5,
                      borderBottom: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="subtitle2">
                      {t('changeRequest.submitDialog.title')}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 2 }}>
                    <TextField
                      autoFocus
                      fullWidth
                      label={t('changeRequest.submitDialog.titleField')}
                      value={submitTitle}
                      onChange={(e) => setSubmitTitle(e.target.value)}
                      sx={{ mb: 2 }}
                      required
                    />
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label={t('changeRequest.submitDialog.reason')}
                      value={submitReason}
                      onChange={(e) => setSubmitReason(e.target.value)}
                      sx={{ mb: 2 }}
                      helperText={t('changeRequest.submitDialog.reasonOptional')}
                    />
                    <Box
                      sx={{
                        display: 'flex',
                        gap: 1,
                        justifyContent: 'flex-end',
                      }}
                    >
                      <Button onClick={() => setShowSubmitForm(false)} disabled={actionLoading}>
                        {t('common.cancel')}
                      </Button>
                      <Button variant="contained" onClick={handleSubmit} disabled={actionLoading}>
                        {t('changeRequest.actions.submit')}
                      </Button>
                    </Box>
                  </Box>
                </Paper>
              )}
            </Box>

            {/* Sidebar */}
            <Box sx={{ width: 256, flexShrink: 0 }}>
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ textTransform: 'uppercase', fontWeight: 600 }}
                >
                  {t('changeRequest.requester')}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <Avatar sx={{ width: 20, height: 20 }}>
                    <PersonIcon sx={{ fontSize: 14 }} />
                  </Avatar>
                  <Typography variant="body2">
                    {cr.requester?.name || cr.requester?.email}
                  </Typography>
                </Box>
              </Paper>

              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ textTransform: 'uppercase', fontWeight: 600 }}
                >
                  {t('changeRequest.reviewers')}
                </Typography>
                {cr.approvals?.length ? (
                  <Box sx={{ mt: 1 }}>
                    {cr.approvals.map((a) => (
                      <Box
                        key={a.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          mb: 0.5,
                        }}
                      >
                        <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} />
                        <Typography variant="body2">
                          {a.approver?.name || a.approver?.email}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {t('changeRequest.noReviewersYet')}
                  </Typography>
                )}
              </Paper>

              {/* Executed By / Merged By */}
              {cr.status === 'applied' && (
                <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ textTransform: 'uppercase', fontWeight: 600 }}
                  >
                    {t('changeRequest.mergedBy')}
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mt: 1,
                    }}
                  >
                    <Avatar sx={{ width: 20, height: 20, bgcolor: 'info.main' }}>
                      <MergeIcon sx={{ fontSize: 14 }} />
                    </Avatar>
                    <Typography variant="body2">
                      {cr.executor?.name || cr.executor?.email || t('common.unknown')}
                    </Typography>
                  </Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.5, ml: 3.5 }}
                  >
                    <RelativeTime date={cr.updatedAt} />
                  </Typography>
                </Paper>
              )}
            </Box>
          </Box>
        )}

        {/* Files Changed Tab */}
        {activeTab === 1 && (
          <Box>
            {allChanges.map((item, idx) => (
              <Paper key={idx} variant="outlined" sx={{ mb: 2, overflow: 'hidden' }}>
                {/* File header */}
                <Box
                  sx={{
                    px: 2,
                    py: 1,
                    bgcolor: 'action.hover',
                    borderBottom: 1,
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {item.table}/{item.targetId}
                  </Typography>
                  <Chip
                    label={item.operation}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: 11,
                      bgcolor:
                        item.operation === 'create'
                          ? 'success.main'
                          : item.operation === 'delete'
                            ? 'error.main'
                            : 'primary.main',
                      color: '#fff',
                    }}
                  />
                </Box>

                {/* Diff content - Table style */}
                <Box
                  component="table"
                  sx={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 13,
                    fontFamily: 'monospace',
                  }}
                >
                  <Box component="thead">
                    <Box
                      component="tr"
                      sx={{
                        bgcolor: 'action.hover',
                        borderBottom: 1,
                        borderColor: 'divider',
                      }}
                    >
                      <Box
                        component="th"
                        sx={{
                          textAlign: 'left',
                          py: 1,
                          px: 2,
                          fontWeight: 600,
                          width: '20%',
                        }}
                      >
                        {t('changeRequest.field')}
                      </Box>
                      <Box
                        component="th"
                        sx={{
                          textAlign: 'left',
                          py: 1,
                          px: 2,
                          fontWeight: 600,
                          width: '40%',
                          color: 'error.main',
                        }}
                      >
                        {t('changeRequest.oldValue')}
                      </Box>
                      <Box
                        component="th"
                        sx={{
                          textAlign: 'left',
                          py: 1,
                          px: 2,
                          fontWeight: 600,
                          width: '40%',
                          color: 'success.main',
                        }}
                      >
                        {t('changeRequest.newValue')}
                      </Box>
                    </Box>
                  </Box>
                  <Box component="tbody">
                    {item.changes.map((change, i) => (
                      <Box
                        component="tr"
                        key={i}
                        sx={{
                          borderBottom: 1,
                          borderColor: 'divider',
                          '&:hover': { bgcolor: 'action.hover' },
                          bgcolor:
                            change.operation === 'added'
                              ? (theme) => alpha(theme.palette.success.main, 0.05)
                              : change.operation === 'removed'
                                ? (theme) => alpha(theme.palette.error.main, 0.05)
                                : 'transparent',
                        }}
                      >
                        <Box
                          component="td"
                          sx={{
                            py: 1,
                            px: 2,
                            fontWeight: 500,
                            verticalAlign: 'top',
                            borderRight: 1,
                            borderColor: 'divider',
                          }}
                        >
                          {change.field}
                        </Box>
                        <Box
                          component="td"
                          sx={{
                            py: 1,
                            px: 2,
                            verticalAlign: 'top',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            maxWidth: 0,
                            bgcolor:
                              change.operation !== 'added'
                                ? (theme) => alpha(theme.palette.error.main, 0.08)
                                : 'transparent',
                            color: change.operation !== 'added' ? 'error.main' : 'text.disabled',
                            borderRight: 1,
                            borderColor: 'divider',
                          }}
                        >
                          {change.operation === 'added' ? '-' : formatValue(change.oldValue)}
                        </Box>
                        <Box
                          component="td"
                          sx={{
                            py: 1,
                            px: 2,
                            verticalAlign: 'top',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            maxWidth: 0,
                            bgcolor:
                              change.operation !== 'removed'
                                ? (theme) => alpha(theme.palette.success.main, 0.08)
                                : 'transparent',
                            color:
                              change.operation !== 'removed' ? 'success.main' : 'text.disabled',
                          }}
                        >
                          {change.operation === 'removed' ? '-' : formatValue(change.newValue)}
                        </Box>
                      </Box>
                    ))}
                    {item.changes.length === 0 && (
                      <Box component="tr">
                        <Box
                          component="td"
                          colSpan={3}
                          sx={{
                            p: 2,
                            textAlign: 'center',
                            color: 'text.secondary',
                          }}
                        >
                          {t('changeRequest.noChanges')}
                        </Box>
                      </Box>
                    )}
                  </Box>
                </Box>
              </Paper>
            ))}

            {/* Sticky Review Bar */}
            {cr.status === 'open' && (
              <Paper
                variant="outlined"
                sx={{
                  position: 'sticky',
                  bottom: 16,
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  bgcolor: 'background.paper',
                  boxShadow: 3,
                }}
              >
                <TextField
                  placeholder={t('changeRequest.leaveComment')}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                  autoFocus
                />
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleReject}
                  disabled={actionLoading || !comment.trim()}
                >
                  {t('changeRequest.actions.reject')}
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckIcon />}
                  onClick={handleApprove}
                  disabled={actionLoading}
                >
                  {t('changeRequest.actions.approve')}
                </Button>
              </Paper>
            )}
          </Box>
        )}
      </Box>

      {/* Delete Confirmation */}
      <ConfirmDeleteDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title={t('changeRequest.deleteDialog.title')}
        message={t('changeRequest.deleteDialog.message')}
        loading={actionLoading}
      />
      <ErrorDialog />
    </Box>
  );
};

export default ChangeRequestDetailPage;
