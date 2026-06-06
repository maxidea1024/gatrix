import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Chip,
  Tooltip,
  Paper,
  IconButton,
  LinearProgress,
  keyframes,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  HourglassEmpty as HourglassIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { copyToClipboardWithNotification } from '@/utils/clipboard';
import rippleService, { RippleHistoryEvent } from '@/services/rippleService';
import { CopyButton } from '@/components/common/CopyButton';

const fadeSlideIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

interface RippleTrackingDialogProps {
  open: boolean;
  requestId: string | null;
  pattern: string | null;
  matchedKeys: string[];
  targetTables?: string[];
  onClose: () => void;
}

const RippleTrackingDialog: React.FC<RippleTrackingDialogProps> = ({
  open,
  requestId,
  pattern,
  matchedKeys,
  targetTables,
  onClose,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { getProjectApiPath } = useOrgProject();
  const [events, setEvents] = useState<RippleHistoryEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let timeoutId: NodeJS.Timeout;
    let lastEventCount = 0;
    let stableChecks = 0;

    const fetchEvents = async () => {
      if (!requestId) return;

      try {
        const result = await rippleService.getHistory(
          getProjectApiPath(),
          requestId,
          10000
        );

        const fetchedEvents = result.items || [];
        const fetchedKeys = new Set(fetchedEvents.map((e) => e.handlerKey));

        // Find keys that haven't responded yet
        const pendingEvents: RippleHistoryEvent[] = matchedKeys
          .filter((k) => !fetchedKeys.has(k))
          .map((k) => ({
            eventId: `pending-${k}`,
            serverId: '...',
            requestId: requestId,
            pattern: pattern || '',
            handlerKey: k,
            status: 'skipped' as const,
            durationMs: 0,
            delayMs: 0,
            createdAt: Date.now(),
            startedAt: 0,
            finishedAt: 0,
          }));

        setEvents([...fetchedEvents, ...pendingEvents]);

        // Stabilization: stop polling when event count hasn't changed for 1 check (2s)
        const currentCount = fetchedEvents.length;
        if (currentCount > 0 && currentCount === lastEventCount) {
          stableChecks++;
          if (stableChecks >= 1) {
            setIsPolling(false);
            clearInterval(intervalId);
          }
        } else {
          stableChecks = 0;
        }
        lastEventCount = currentCount;
      } catch (err) {
        console.error('Failed to fetch tracking history', err);
      }
    };

    if (open && requestId) {
      // Pre-populate with pending
      setEvents(
        matchedKeys.map((k) => ({
          eventId: `pending-${k}`,
          serverId: '...',
          requestId: requestId,
          pattern: pattern || '',
          handlerKey: k,
          status: 'skipped' as const,
          durationMs: 0,
          delayMs: 0,
          createdAt: Date.now(),
          startedAt: 0,
          finishedAt: 0,
        }))
      );
      setLoading(true);
      setIsPolling(true);
      fetchEvents().finally(() => setLoading(false));

      intervalId = setInterval(fetchEvents, 2000);

      // Auto-stop polling after 60 seconds
      timeoutId = setTimeout(() => {
        setIsPolling(false);
        clearInterval(intervalId);
      }, 60000);
    } else {
      setIsPolling(false);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [open, requestId, pattern, matchedKeys, getProjectApiPath]);

  const handleCopy = (text: string | undefined) => {
    if (!text) return;
    copyToClipboardWithNotification(
      text,
      () =>
        enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
      () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
    );
  };

  const getStatusIcon = (status: string) => {
    const sx = { fontSize: 18 };
    switch (status) {
      case 'success':
        return <CheckCircleIcon color="success" sx={sx} />;
      case 'failure':
        return <CancelIcon color="error" sx={sx} />;
      case 'warning':
        return <WarningIcon color="warning" sx={sx} />;
      case 'timeout':
        return <WarningIcon color="warning" sx={sx} />;
      default:
        return <HourglassIcon color="disabled" sx={sx} />;
    }
  };

  // Count by unique handler keys (not raw events) to avoid multi-server duplication
  const keyStatusMap = new Map<string, string>();
  for (const e of events) {
    const existing = keyStatusMap.get(e.handlerKey);
    // Keep the "most resolved" status per key: success > failure > timeout > skipped
    if (!existing || e.status !== 'skipped') {
      keyStatusMap.set(e.handlerKey, e.status);
    }
  }
  const uniqueSuccessCount = [...keyStatusMap.values()].filter(
    (s) => s === 'success'
  ).length;
  const uniqueWarningCount = [...keyStatusMap.values()].filter(
    (s) => s === 'warning'
  ).length;
  const uniqueFailureCount = [...keyStatusMap.values()].filter(
    (s) => s === 'failure' || s === 'timeout'
  ).length;
  const uniquePendingCount = [...keyStatusMap.values()].filter(
    (s) => s === 'skipped'
  ).length;
  const uniqueTotal = keyStatusMap.size;
  const totalEvents = events.filter((e) => e.status !== 'skipped').length;
  const progress =
    uniqueTotal > 0
      ? ((uniqueSuccessCount + uniqueFailureCount) / uniqueTotal) * 100
      : 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="subtitle1" fontWeight={600}>
            {t('ripple.tracking.title')}
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'flex',
            gap: 0.5,
            mt: 0.5,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {requestId} / {pattern}
          </Typography>
        </Box>
        {targetTables && targetTables.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              gap: 0.5,
              mt: 0.75,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mr: 0.5, fontSize: '0.65rem' }}
            >
              Tables:
            </Typography>
            {targetTables.map((name) => (
              <Chip
                key={name}
                label={name}
                size="small"
                variant="outlined"
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  fontWeight: 500,
                }}
              />
            ))}
          </Box>
        )}
      </DialogTitle>
      <DialogContent dividers sx={{ p: 1.5 }}>
        {/* Summary */}
        <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
          <Chip
            size="small"
            label={`✓ ${uniqueSuccessCount}`}
            color="success"
            variant="outlined"
            sx={{ height: 22, fontWeight: 600 }}
          />
          <Chip
            size="small"
            label={`✕ ${uniqueFailureCount}`}
            color="error"
            variant="outlined"
            sx={{ height: 22, fontWeight: 600 }}
          />
          {uniqueWarningCount > 0 && (
            <Chip
              size="small"
              label={`⚠ ${uniqueWarningCount}`}
              color="warning"
              variant="outlined"
              sx={{ height: 22, fontWeight: 600 }}
            />
          )}
          {uniquePendingCount > 0 && (
            <Chip
              size="small"
              label={`⏳ ${uniquePendingCount}`}
              variant="outlined"
              sx={{ height: 22 }}
            />
          )}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ ml: 'auto' }}
          >
            {t(
              'ripple.tracking.keys',
              '{{success}} / {{total}} keys ({{events}} events)',
              {
                success: uniqueSuccessCount + uniqueFailureCount,
                total: uniqueTotal,
                events: totalEvents,
              }
            )}
          </Typography>
        </Box>

        {/* Event List */}
        {loading && events.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : events.filter((e) => e.status !== 'skipped').length === 0 ? (
          <Typography
            variant="caption"
            color="text.secondary"
            align="center"
            sx={{ display: 'block', p: 3 }}
          >
            {t('ripple.tracking.noEvents')}
          </Typography>
        ) : (
          <Paper
            variant="outlined"
            sx={{ borderRadius: 1.5, overflow: 'hidden' }}
          >
            <TableContainer sx={{ maxHeight: 400 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow
                    sx={{
                      '& th': {
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        color: 'text.secondary',
                        py: 0.75,
                        px: 1,
                        whiteSpace: 'nowrap',
                        borderBottom: 2,
                        borderColor: 'divider',
                        bgcolor: (theme) =>
                          theme.palette.mode === 'dark'
                            ? 'grey.900'
                            : 'grey.100',
                      },
                    }}
                  >
                    <TableCell sx={{ width: 36 }} />
                    <TableCell>{t('ripple.tracking.col.handler')}</TableCell>
                    <TableCell>{t('ripple.tracking.col.service')}</TableCell>
                    <TableCell>{t('ripple.tracking.col.hostname')}</TableCell>
                    <TableCell>{t('ripple.tracking.col.instance')}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {t('ripple.tracking.col.result')}
                    </TableCell>
                    <TableCell>{t('ripple.tracking.col.message')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {events.map((event, idx) => (
                    <TableRow
                      key={event.eventId}
                      sx={{
                        bgcolor:
                          event.status === 'skipped'
                            ? 'action.hover'
                            : 'transparent',
                        animation: `${fadeSlideIn} 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both`,
                        animationDelay: `${Math.min(idx * 15, 500)}ms`,
                        '& td': { py: 0.5, px: 1 },
                        '&:last-child td': { borderBottom: 0 },
                      }}
                    >
                      <TableCell sx={{ width: 36 }}>
                        {getStatusIcon(event.status)}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontSize: '0.78rem',
                              fontWeight: 500,
                              color:
                                event.status === 'skipped'
                                  ? 'text.disabled'
                                  : 'text.primary',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {event.handlerKey}
                          </Typography>
                          {event.status !== 'skipped' && (
                            <CopyButton text={event.handlerKey} size={13} />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {event.status !== 'skipped' && event.serviceType ? (
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Typography
                              variant="body2"
                              color="info.main"
                              sx={{
                                fontSize: '0.78rem',
                                fontWeight: 600,
                              }}
                            >
                              {event.serviceType}
                            </Typography>
                            <CopyButton text={event.serviceType} size={13} />
                          </Box>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {event.status !== 'skipped' && event.hostname ? (
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                fontSize: '0.75rem',
                              }}
                            >
                              {event.hostname}
                            </Typography>
                            <CopyButton text={event.hostname} size={13} />
                          </Box>
                        ) : event.status !== 'skipped' ? (
                          <Typography
                            variant="body2"
                            color="text.disabled"
                            sx={{ fontSize: '0.75rem' }}
                          >
                            —
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {event.status !== 'skipped' && event.serverId ? (
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Typography
                              variant="body2"
                              color="text.disabled"
                              sx={{
                                fontSize: '0.75rem',
                              }}
                            >
                              {event.serverId}
                            </Typography>
                            <CopyButton text={event.serverId} size={13} />
                          </Box>
                        ) : event.status !== 'skipped' ? (
                          <Typography
                            variant="body2"
                            color="text.disabled"
                            sx={{ fontSize: '0.75rem' }}
                          >
                            —
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {event.status === 'skipped' ? (
                          <Typography
                            variant="body2"
                            color="text.disabled"
                            sx={{ fontSize: '0.75rem' }}
                          >
                            {t('ripple.tracking.pending')}
                          </Typography>
                        ) : (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                          >
                            {event.durationMs}ms ({event.delayMs}ms delay)
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {event.error ? (
                          <Typography
                            variant="body2"
                            sx={{
                              fontSize: '0.72rem',
                              color:
                                event.status === 'warning'
                                  ? 'warning.main'
                                  : 'error.main',
                              wordBreak: 'break-word',
                            }}
                          >
                            {event.error}
                          </Typography>
                        ) : event.status === 'success' ? (
                          <Typography
                            variant="body2"
                            color="success.main"
                            sx={{ fontSize: '0.72rem' }}
                          >
                            {t('ripple.tracking.success')}
                          </Typography>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 1.5, py: 1 }}>
        <Button
          onClick={onClose}
          variant="text"
          size="small"
          color="primary"
          startIcon={
            isPolling ? (
              <CircularProgress size={14} color="inherit" />
            ) : undefined
          }
        >
          {isPolling ? t('ripple.tracking.tracking') : t('common.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RippleTrackingDialog;
