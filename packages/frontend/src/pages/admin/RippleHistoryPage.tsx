import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  Alert,
  Tooltip,
  Collapse,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  alpha,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  History as HistoryIcon,
  KeyboardArrowDown as ExpandIcon,
  KeyboardArrowUp as CollapseIcon,
  DeleteSweep as DeleteSweepIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';

import { useSearchParams } from 'react-router-dom';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { useEnvironment } from '@/contexts/EnvironmentContext';
import PageHeader from '@/components/common/PageHeader';
import PageContentLoader from '@/components/common/PageContentLoader';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import SimplePagination from '@/components/common/SimplePagination';
import rippleService, { RippleHistoryEvent } from '@/services/rippleService';
import { formatRelativeTime } from '@/utils/dateFormat';

const LS_PAGE_SIZE_KEY = 'rippleHistory.pageSize';

// ── Grouped data ──

interface RequestGroup {
  requestId: string;
  pattern: string;
  triggeredBy: string;
  time: number | string;
  events: RippleHistoryEvent[];
  successCount: number;
  warningCount: number;
  failureCount: number;
  maxDurationMs: number;
  maxDelayMs: number;
  handlerKeys: string[];
  services: string[];
  tableName: string | null;
}

function groupByRequest(items: RippleHistoryEvent[]): RequestGroup[] {
  const map = new Map<string, RippleHistoryEvent[]>();
  for (const item of items) {
    if (!map.has(item.requestId)) map.set(item.requestId, []);
    map.get(item.requestId)!.push(item);
  }

  const groups: RequestGroup[] = [];
  for (const [requestId, events] of map) {
    events.sort((a, b) => {
      const svcCmp = (a.serviceType || '').localeCompare(b.serviceType || '');
      return svcCmp !== 0
        ? svcCmp
        : (a.serverId || '').localeCompare(b.serverId || '');
    });
    const first = events[0];
    groups.push({
      requestId,
      pattern: first.pattern,
      triggeredBy: first.triggeredBy || '',
      time: first.finishedAt,
      events,
      successCount: events.filter((e) => e.status === 'success').length,
      warningCount: events.filter((e) => e.status === 'warning').length,
      failureCount: events.filter((e) => e.status !== 'success' && e.status !== 'warning').length,
      maxDurationMs: Math.max(...events.map((e) => e.durationMs || 0)),
      maxDelayMs: Math.max(...events.map((e) => e.delayMs || 0)),
      handlerKeys: [...new Set(events.map((e) => e.handlerKey))],
      services: [
        ...new Set(
          events.map((e) => e.serviceType).filter(Boolean) as string[]
        ),
      ].sort(),
      tableName: first.tableName || null,
    });
  }
  groups.sort((a, b) => String(b.time).localeCompare(String(a.time)));
  return groups;
}

// ── Expandable Group Row ──

const GroupRow: React.FC<{ group: RequestGroup; index: number }> = ({
  group,
  index,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [showAllTables, setShowAllTables] = useState(false);
  const allSuccess = group.failureCount === 0 && group.warningCount === 0;
  const hasWarningOnly = group.failureCount === 0 && group.warningCount > 0;

  return (
    <React.Fragment>
      <TableRow
        hover
        onClick={() => setExpanded(!expanded)}
        sx={{
          cursor: 'pointer',
          '& > td': { borderBottom: expanded ? 'none' : undefined },
          bgcolor:
            index % 2 === 1
              ? (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'rgba(255,255,255,0.02)'
                    : 'rgba(0,0,0,0.015)'
              : 'transparent',
        }}
      >
        {/* Expand */}
        <TableCell sx={{ width: 40, pr: 0 }}>
          <IconButton size="small">
            {expanded ? (
              <CollapseIcon fontSize="small" />
            ) : (
              <ExpandIcon fontSize="small" />
            )}
          </IconButton>
        </TableCell>

        {/* Status */}
        <TableCell sx={{ width: 40, pl: 0, pr: 0 }}>
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              bgcolor: allSuccess ? 'success.main' : hasWarningOnly ? 'warning.main' : 'error.main',
              boxShadow: (theme) =>
                `0 0 8px 1px ${alpha(
                  allSuccess
                    ? theme.palette.success.main
                    : hasWarningOnly
                      ? theme.palette.warning.main
                      : theme.palette.error.main,
                  0.4
                )}`,
            }}
          />
        </TableCell>

        {/* Request ID */}
        <TableCell>
          <Typography
            variant="body2"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.7rem',
              color: 'text.secondary',
            }}
          >
            {group.requestId.slice(0, 8)}
          </Typography>
        </TableCell>

        {/* Time */}
        <TableCell sx={{ minWidth: 100 }}>
          <Tooltip
            title={new Date(group.time).toLocaleString('ko-KR')}
            placement="top"
          >
            <Typography
              variant="body2"
              sx={{ fontSize: '0.8rem', cursor: 'help' }}
            >
              {formatRelativeTime(new Date(group.time))}
            </Typography>
          </Tooltip>
        </TableCell>

        {/* Pattern */}
        <TableCell>
          <Chip
            label={group.pattern}
            size="small"
            color="primary"
            sx={{
              fontFamily: 'monospace',
              fontWeight: 600,
              fontSize: '0.72rem',
              height: 22,
              borderRadius: 1,
            }}
          />
        </TableCell>

        {/* Handler keys */}
        <TableCell>
          <Typography
            variant="body2"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.78rem',
              color: 'text.primary',
            }}
          >
            {group.handlerKeys.join(', ')}
          </Typography>
        </TableCell>

        {/* Target table */}
        <TableCell>
          {group.tableName && group.tableName !== '*' ? (
            <Box
              sx={{
                display: 'flex',
                gap: 0.5,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              {group.tableName
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
                .map((t, idx, arr) => {
                  if (!showAllTables && idx > 2) {
                    if (idx === 3) {
                      return (
                        <Chip
                          key="more"
                          label={`+${arr.length - 3} 더보기`}
                          size="small"
                          variant="outlined"
                          sx={{
                            height: 20,
                            fontSize: '0.65rem',
                            cursor: 'pointer',
                            borderColor: 'divider',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowAllTables(true);
                          }}
                        />
                      );
                    }
                    return null;
                  }
                  return (
                    <Chip
                      key={t}
                      label={t}
                      size="small"
                      variant="outlined"
                      color="secondary"
                      sx={{
                        height: 20,
                        fontSize: '0.68rem',
                        fontFamily: 'monospace',
                      }}
                    />
                  );
                })}
            </Box>
          ) : (
            <Typography
              variant="body2"
              sx={{ fontSize: '0.75rem', color: 'text.secondary' }}
            >
              {group.tableName === '*' || !group.tableName
                ? 'ALL'
                : group.tableName}
            </Typography>
          )}
        </TableCell>

        {/* Services */}
        <TableCell>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {group.services.map((svc) => (
              <Chip
                key={svc}
                label={svc}
                size="small"
                variant="outlined"
                sx={{
                  height: 20,
                  fontSize: '0.68rem',
                  fontFamily: 'monospace',
                }}
              />
            ))}
          </Box>
        </TableCell>

        {/* Result */}
        <TableCell align="center">
          <Box sx={{ display: 'inline-flex', gap: 0.5, alignItems: 'center' }}>
            {group.successCount > 0 && (
              <Chip
                icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
                label={group.successCount}
                size="small"
                color="success"
                variant="filled"
                sx={{ height: 22, fontSize: '0.72rem', fontWeight: 600 }}
              />
            )}
            {group.warningCount > 0 && (
              <Chip
                icon={<WarningIcon sx={{ fontSize: '14px !important' }} />}
                label={group.warningCount}
                size="small"
                color="warning"
                variant="filled"
                sx={{ height: 22, fontSize: '0.72rem', fontWeight: 600 }}
              />
            )}
            {group.failureCount > 0 && (
              <Chip
                icon={<CancelIcon sx={{ fontSize: '14px !important' }} />}
                label={group.failureCount}
                size="small"
                color="error"
                variant="filled"
                sx={{ height: 22, fontSize: '0.72rem', fontWeight: 600 }}
              />
            )}
          </Box>
        </TableCell>

        {/* Duration */}
        <TableCell align="right">
          <Typography
            variant="body2"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              fontWeight: group.maxDelayMs > 3000 ? 700 : 400,
              color: group.maxDelayMs > 3000 ? 'warning.main' : 'text.primary',
            }}
          >
            {group.maxDelayMs != null && group.maxDelayMs >= 0
              ? `${group.maxDelayMs.toLocaleString()}ms`
              : '—'}
          </Typography>
        </TableCell>

        {/* Duration */}
        <TableCell align="right">
          <Typography
            variant="body2"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              fontWeight: group.maxDurationMs > 5000 ? 700 : 400,
              color:
                group.maxDurationMs > 5000 ? 'warning.main' : 'text.primary',
            }}
          >
            {group.maxDurationMs != null && group.maxDurationMs >= 0
              ? `${group.maxDurationMs.toLocaleString()}ms`
              : '—'}
          </Typography>
        </TableCell>
      </TableRow>

      {/* Detail sub-table */}
      <TableRow>
        <TableCell
          colSpan={11}
          sx={{ py: 0, borderBottom: expanded ? undefined : 'none' }}
        >
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box
              sx={{
                mt: 1.5,
                mb: 1,
                mx: 2,
              }}
            >
              <Paper
                variant="outlined"
                sx={{ borderRadius: 1.5, overflow: 'hidden' }}
              >
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow
                        sx={{
                          bgcolor: (theme) =>
                            theme.palette.mode === 'dark'
                              ? 'rgba(255,255,255,0.03)'
                              : 'grey.50',
                        }}
                      >
                        <TableCell
                          sx={{
                            fontWeight: 700,
                            fontSize: '0.7rem',
                            color: 'text.secondary',
                            py: 0.75,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t('ripple.history.col.status')}
                        </TableCell>
                        <TableCell
                          sx={{
                            fontWeight: 700,
                            fontSize: '0.7rem',
                            color: 'text.secondary',
                            py: 0.75,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t('ripple.history.col.service')}
                        </TableCell>
                        <TableCell
                          sx={{
                            fontWeight: 700,
                            fontSize: '0.7rem',
                            color: 'text.secondary',
                            py: 0.75,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t('ripple.history.col.serverId')}
                        </TableCell>
                        <TableCell
                          sx={{
                            fontWeight: 700,
                            fontSize: '0.7rem',
                            color: 'text.secondary',
                            py: 0.75,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t('ripple.history.col.error')}
                        </TableCell>
                        <TableCell
                          sx={{
                            fontWeight: 700,
                            fontSize: '0.7rem',
                            color: 'text.secondary',
                            py: 0.75,
                            whiteSpace: 'nowrap',
                          }}
                          align="right"
                        >
                          {t('ripple.history.col.delay')}
                        </TableCell>
                        <TableCell
                          sx={{
                            fontWeight: 700,
                            fontSize: '0.7rem',
                            color: 'text.secondary',
                            py: 0.75,
                            whiteSpace: 'nowrap',
                          }}
                          align="right"
                        >
                          {t('ripple.history.col.duration')}
                        </TableCell>
                        <TableCell
                          sx={{
                            fontWeight: 700,
                            fontSize: '0.7rem',
                            color: 'text.secondary',
                            py: 0.75,
                            whiteSpace: 'nowrap',
                          }}
                          align="center"
                        >
                          {t('ripple.history.col.retry')}
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {group.events.map((evt, idx) => (
                        <TableRow
                          key={evt.eventId}
                          sx={{
                            '&:last-child td': { border: 0 },
                            bgcolor:
                              idx % 2 === 1
                                ? (theme) =>
                                    theme.palette.mode === 'dark'
                                      ? 'rgba(255,255,255,0.02)'
                                      : 'rgba(0,0,0,0.015)'
                                : 'transparent',
                          }}
                        >
                          <TableCell sx={{ py: 0.5 }}>
                            {evt.status === 'success' ? (
                              <CheckCircleIcon
                                color="success"
                                sx={{ fontSize: 16 }}
                              />
                            ) : evt.status === 'warning' ? (
                              <WarningIcon color="warning" sx={{ fontSize: 16 }} />
                            ) : (
                              <CancelIcon color="error" sx={{ fontSize: 16 }} />
                            )}
                          </TableCell>
                          <TableCell sx={{ py: 0.5 }}>
                            <Typography
                              variant="body2"
                              sx={{
                                fontFamily: 'monospace',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                              }}
                            >
                              {evt.serviceType || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 0.5 }}>
                            <Typography
                              variant="body2"
                              sx={{
                                fontFamily: 'monospace',
                                fontSize: '0.72rem',
                                color: 'text.secondary',
                              }}
                            >
                              {evt.serverId || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 0.5, maxWidth: 400 }}>
                            {evt.error ? (
                              <Tooltip title={evt.error} placement="top">
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontSize: '0.7rem',
                                    color: evt.status === 'warning' ? 'warning.main' : 'error.main',
                                    fontFamily: 'monospace',
                                    maxWidth: 400,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    cursor: 'help',
                                  }}
                                >
                                  {evt.error}
                                </Typography>
                              </Tooltip>
                            ) : (
                              <Typography
                                variant="body2"
                                sx={{
                                  fontSize: '0.72rem',
                                  color: 'text.disabled',
                                }}
                              >
                                —
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right" sx={{ py: 0.5 }}>
                            <Typography
                              variant="body2"
                              sx={{
                                fontFamily: 'monospace',
                                fontSize: '0.75rem',
                                color: 'text.secondary',
                              }}
                            >
                              {evt.delayMs != null ? `${evt.delayMs}ms` : '—'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ py: 0.5 }}>
                            <Typography
                              variant="body2"
                              sx={{
                                fontFamily: 'monospace',
                                fontSize: '0.75rem',
                                fontWeight:
                                  (evt.durationMs || 0) > 5000 ? 700 : 400,
                                color:
                                  (evt.durationMs || 0) > 5000
                                    ? 'warning.main'
                                    : 'text.primary',
                              }}
                            >
                              {evt.durationMs != null
                                ? `${evt.durationMs.toLocaleString()}ms`
                                : '—'}
                            </Typography>
                          </TableCell>
                          <TableCell align="center" sx={{ py: 0.5 }}>
                            {evt.retryCount ? (
                              <Chip
                                label={evt.retryCount}
                                size="small"
                                color="warning"
                                sx={{
                                  fontSize: '0.7rem',
                                  height: 20,
                                  minWidth: 28,
                                }}
                              />
                            ) : (
                              <Typography
                                variant="body2"
                                sx={{
                                  fontSize: '0.72rem',
                                  color: 'text.disabled',
                                }}
                              >
                                —
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </React.Fragment>
  );
};

// ── Main Page ──

const RippleHistoryPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { getProjectApiPath } = useOrgProject();
  const { currentEnvironmentId } = useEnvironment();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<RippleHistoryEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [noAdmind, setNoAdmind] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [page, setPage] = useState(() => {
    const p = searchParams.get('page');
    return p ? Math.max(0, parseInt(p, 10) - 1) : 0;
  });
  const [rowsPerPage, setRowsPerPage] = useState(() => {
    const saved = localStorage.getItem(LS_PAGE_SIZE_KEY);
    return saved ? Number(saved) : 15;
  });

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const projectApiPath = getProjectApiPath();
      const result = await rippleService.getHistory(
        projectApiPath,
        undefined,
        5000
      );
      setHistory(result.items || []);
      setError(null);
      setNoAdmind(false);
    } catch (err: any) {
      const errorCode = err.error?.code || err.code;
      if (errorCode === 'SERVICE_NOT_FOUND') {
        setNoAdmind(true);
        setError(null);
      } else {
        setNoAdmind(false);
        setError(
          err.error?.message || err.message || 'Failed to fetch history'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [getProjectApiPath]);

  useEffect(() => {
    setHistory([]);
    setLoading(true);
    fetchHistory();
  }, [fetchHistory, currentEnvironmentId]);

  const handleReset = async () => {
    setResetting(true);
    try {
      const projectApiPath = getProjectApiPath();
      const result = await rippleService.clearHistory(projectApiPath, true);
      enqueueSnackbar(
        t('ripple.history.resetSuccess', {
          count: result.deletedExecutionLogs,
        }),
        { variant: 'success' }
      );
      setResetDialogOpen(false);
      setPage(0);
      await fetchHistory();
    } catch (err: any) {
      enqueueSnackbar(
        err.response?.data?.error ||
          err.message ||
          t('ripple.history.resetFailed'),
        { variant: 'error' }
      );
    } finally {
      setResetting(false);
    }
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('page', String(newPage + 1));
      return next;
    });
  };

  const handleChangeRowsPerPage = (event: any) => {
    const newSize = parseInt(event.target.value, 10);
    setRowsPerPage(newSize);
    setPage(0);
    localStorage.setItem(LS_PAGE_SIZE_KEY, String(newSize));
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('page');
      return next;
    });
  };

  const groups = groupByRequest(history);
  const paginatedGroups = groups.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        icon={<HistoryIcon />}
        title={t('ripple.history.title')}
        subtitle={t('ripple.history.subtitle')}
        actions={
          !loading && !noAdmind ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                color="error"
                size="small"
                startIcon={<DeleteSweepIcon />}
                onClick={() => setResetDialogOpen(true)}
                disabled={!history.length}
              >
                {t('ripple.history.reset')}
              </Button>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={fetchHistory}
              >
                {t('common.refresh')}
              </Button>
            </Box>
          ) : undefined
        }
      />

      <PageContentLoader loading={loading}>
        {noAdmind ? (
          <EmptyPlaceholder
            message={t('ripple.noAdmind.title')}
            description={t('ripple.noAdmind.description')}
            minHeight={300}
          />
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        ) : !groups.length ? (
          <EmptyPlaceholder
            message={t('ripple.history.empty')}
            minHeight={200}
          />
        ) : (
          <Paper variant="outlined">
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 40 }} />
                    <TableCell sx={{ width: 40 }} />
                    <TableCell sx={{ fontWeight: 700 }}>
                      {t('ripple.history.col.requestId')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {t('ripple.history.col.time')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {t('ripple.history.col.pattern')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {t('ripple.history.col.handler')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {t('ripple.history.col.target')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {t('ripple.history.col.service')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="center">
                      {t('ripple.history.col.result')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">
                      {t('ripple.history.col.maxDelay')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">
                      {t('ripple.history.col.maxDuration')}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedGroups.map((group, idx) => (
                    <GroupRow key={group.requestId} group={group} index={idx} />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <SimplePagination
              count={groups.length}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </Paper>
        )}
      </PageContentLoader>

      {/* Reset confirmation dialog */}
      <Dialog
        open={resetDialogOpen}
        onClose={() => !resetting && setResetDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle
          sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: (theme) => alpha(theme.palette.error.main, 0.1),
            }}
          >
            <DeleteSweepIcon sx={{ color: 'error.main' }} />
          </Box>
          {t('ripple.history.resetDialog.title')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('ripple.history.resetDialog.body')}
          </DialogContentText>
          <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
            {t('ripple.history.resetDialog.warning', {
              logCount: history.length.toLocaleString(),
              requestCount: groups.length.toLocaleString(),
            })}
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setResetDialogOpen(false)}
            disabled={resetting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleReset}
            disabled={resetting}
            startIcon={!resetting ? <DeleteSweepIcon /> : undefined}
          >
            {resetting
              ? t('common.deleting')
              : t('ripple.history.resetDialog.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RippleHistoryPage;
