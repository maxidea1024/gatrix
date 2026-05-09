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
  LinearProgress,
  keyframes,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  HourglassEmpty as HourglassIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import rippleService, { RippleHistoryEvent } from '@/services/rippleService';

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
  onClose: () => void;
}

const RippleTrackingDialog: React.FC<RippleTrackingDialogProps> = ({
  open,
  requestId,
  pattern,
  matchedKeys,
  onClose,
}) => {
  const { t } = useTranslation();
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
        const result = await rippleService.getHistory(getProjectApiPath(), requestId, 10000);

        const fetchedEvents = result.items || [];
        const fetchedKeys = new Set(fetchedEvents.map(e => e.handlerKey));

        // Find keys that haven't responded yet
        const pendingEvents: RippleHistoryEvent[] = matchedKeys
          .filter(k => !fetchedKeys.has(k))
          .map(k => ({
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

        // Stabilization: stop polling when event count hasn't changed for 3 checks (6s)
        // This ensures all servers across the cluster have time to report back.
        const currentCount = fetchedEvents.length;
        if (currentCount > 0 && currentCount === lastEventCount) {
          stableChecks++;
          if (stableChecks >= 3) {
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
      setEvents(matchedKeys.map(k => ({
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
      })));
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

  const getStatusIcon = (status: string) => {
    const sx = { fontSize: 16 };
    switch (status) {
      case 'success':
        return <CheckCircleIcon color="success" sx={sx} />;
      case 'failure':
        return <CancelIcon color="error" sx={sx} />;
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
  const uniqueSuccessCount = [...keyStatusMap.values()].filter(s => s === 'success').length;
  const uniqueFailureCount = [...keyStatusMap.values()].filter(s => s === 'failure' || s === 'timeout').length;
  const uniquePendingCount = [...keyStatusMap.values()].filter(s => s === 'skipped').length;
  const uniqueTotal = keyStatusMap.size;
  const totalEvents = events.filter(e => e.status !== 'skipped').length;
  const progress = uniqueTotal > 0 ? ((uniqueSuccessCount + uniqueFailureCount) / uniqueTotal) * 100 : 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" fontWeight={600}>
            {t('ripple.tracking.title', 'Ripple 전파 추적')}
          </Typography>
          {isPolling && <CircularProgress size={16} />}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            {requestId} / {pattern}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 1.5 }}>
        {/* Summary */}
        <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
          <Chip size="small" label={`✓ ${uniqueSuccessCount}`} color="success" variant="outlined" sx={{ height: 22, fontWeight: 600 }} />
          <Chip size="small" label={`✕ ${uniqueFailureCount}`} color="error" variant="outlined" sx={{ height: 22, fontWeight: 600 }} />
          {uniquePendingCount > 0 && (
            <Chip size="small" label={`⏳ ${uniquePendingCount}`} variant="outlined" sx={{ height: 22 }} />
          )}
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            {uniqueSuccessCount + uniqueFailureCount} / {uniqueTotal} keys ({totalEvents} events)
          </Typography>
        </Box>

        {isPolling && <LinearProgress variant="determinate" value={progress} sx={{ mb: 1, borderRadius: 1 }} />}

        {/* Event List */}
        {loading && events.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : events.length === 0 ? (
          <Typography variant="caption" color="text.secondary" align="center" sx={{ display: 'block', p: 2 }}>
            {t('ripple.tracking.waiting', '응답을 기다리는 중입니다...')}
          </Typography>
        ) : (
          <TableContainer sx={{ maxHeight: 400 }}>
            <Table size="small" stickyHeader sx={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 28 }} />
                <col />
                <col style={{ width: 64 }} />
                <col style={{ width: 160 }} />
                <col style={{ width: 150 }} />
              </colgroup>
              <TableBody>
                {events.map((event, idx) => (
                  <TableRow
                    key={event.eventId}
                    sx={{
                      bgcolor: event.status === 'skipped' ? 'action.hover' : 'transparent',
                      animation: `${fadeSlideIn} 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both`,
                      animationDelay: `${Math.min(idx * 15, 500)}ms`,
                      '& td': { py: 0.25, px: 0.5, border: 0 },
                    }}
                  >
                    <TableCell sx={{ width: 28 }}>
                      {getStatusIcon(event.status)}
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: 'monospace',
                          fontWeight: 500,
                          color: event.status === 'skipped' ? 'text.disabled' : 'text.primary',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'block',
                        }}
                      >
                        {event.handlerKey}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {event.status !== 'skipped' && event.serviceType && (
                        <Typography variant="caption" color="info.main" sx={{ fontSize: '0.6rem', fontFamily: 'monospace', fontWeight: 600 }}>
                          {event.serviceType}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {event.status !== 'skipped' ? (
                        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6rem', fontFamily: 'monospace' }}>
                          {event.serverId}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell align="right">
                      {event.status === 'skipped' ? (
                        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
                          {t('ripple.tracking.pending', '대기 중')}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
                          {event.durationMs}ms ({event.delayMs}ms delay)
                        </Typography>
                      )}
                      {event.error && (
                        <Tooltip title={event.error}>
                          <WarningIcon color="error" sx={{ fontSize: 14, cursor: 'help', ml: 0.5, verticalAlign: 'middle' }} />
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 1.5, py: 1 }}>
        <Button onClick={onClose} variant="contained" size="small" color="primary">
          {t('common.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RippleTrackingDialog;
