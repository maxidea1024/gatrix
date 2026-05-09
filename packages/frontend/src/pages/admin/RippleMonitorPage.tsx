import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ButtonGroup,
  Chip,
  TextField,
  Switch,
  FormControlLabel,
  CircularProgress,
  IconButton,
  Tooltip,
  Alert,
  Collapse,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  TableSortLabel,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  PlayArrow as PlayArrowIcon,
  AutorenewRounded,
  ArrowDropDown as ArrowDropDownIcon,
  MoreVert as MoreVertIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
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
import RippleTrackingDialog from '@/components/admin/RippleTrackingDialog';
import RippleIcon from '@/components/icons/RippleIcon';
import rippleService, {
  RippleStatusResponse,
  RippleHistoryEvent,
} from '@/services/rippleService';
import { formatRelativeTime } from '@/utils/dateFormat';

const REFRESH_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 3000, label: '3s' },
  { value: 5000, label: '5s' },
  { value: 10000, label: '10s' },
  { value: 30000, label: '30s' },
];

const PAGE_SIZE_OPTIONS = [10, 15, 25, 50, 100];
const LS_PAGE_SIZE_KEY = 'rippleMonitor.pageSize';

type SortField = 'key' | 'timeoutMs' | 'debounceMs' | 'serviceType';
type SortOrder = 'asc' | 'desc';

const RippleMonitorPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { getProjectApiPath } = useOrgProject();
  const { currentEnvironmentId } = useEnvironment();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RippleStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noAdmind, setNoAdmind] = useState(false);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(() => {
    const p = searchParams.get('page');
    return p ? Math.max(0, parseInt(p, 10) - 1) : 0;
  });
  const [rowsPerPage, setRowsPerPage] = useState(() => {
    const saved = localStorage.getItem(LS_PAGE_SIZE_KEY);
    return saved ? Number(saved) : 10;
  });

  // Sorting
  const [sortField, setSortField] = useState<SortField>('key');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Auto-refresh
  const [refreshInterval, setRefreshInterval] = useState(() => {
    const saved = localStorage.getItem('rippleMonitor.refreshInterval');
    return saved ? Number(saved) : 5000;
  });
  const [refreshMenuAnchor, setRefreshMenuAnchor] =
    useState<HTMLElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Refresh dialog state
  const [refreshDialogOpen, setRefreshDialogOpen] = useState(false);
  const [refreshPattern, setRefreshPattern] = useState('');
  const [refreshCascade, setRefreshCascade] = useState(false);

  // Confirm dialog for full refresh
  const [confirmRefreshOpen, setConfirmRefreshOpen] = useState(false);

  // Row context menu
  const [rowMenuAnchor, setRowMenuAnchor] = useState<HTMLElement | null>(null);
  const [rowMenuKey, setRowMenuKey] = useState<string | null>(null);

  // Row-level refresh confirm
  const [rowRefreshConfirmOpen, setRowRefreshConfirmOpen] = useState(false);
  const [rowRefreshKey, setRowRefreshKey] = useState<string | null>(null);
  const [rowRefreshCascade, setRowRefreshCascade] = useState(false);

  // Tracking dialog state
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false);
  const [trackingRequestId, setTrackingRequestId] = useState<string | null>(
    null
  );
  const [trackingPattern, setTrackingPattern] = useState<string | null>(null);
  const [trackingMatchedKeys, setTrackingMatchedKeys] = useState<string[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Last-acked info per handler key, per server (handlerKey → compositeKey → event)
  const [historyMap, setHistoryMap] = useState<
    Record<string, Record<string, RippleHistoryEvent>>
  >({});
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const projectApiPath = getProjectApiPath();
      const statusResult = await rippleService.getStatus(projectApiPath);
      setData(statusResult);
      setError(null);
      setNoAdmind(false);

      // Also pre-fetch global history to populate overview columns
      const historyResult = await rippleService.getHistory(
        projectApiPath,
        undefined,
        500
      );
      const newMap: Record<string, Record<string, RippleHistoryEvent>> = {};
      for (const evt of historyResult.items || []) {
        if (!evt.handlerKey) continue;
        if (!newMap[evt.handlerKey]) newMap[evt.handlerKey] = {};
        const serverKey = `${evt.serviceType || ''}:${evt.serverId || ''}:${evt.requestId || ''}`;
        newMap[evt.handlerKey][serverKey] = evt;
      }
      setHistoryMap(newMap);
    } catch (err: any) {
      const errorCode = err.error?.code || err.code;
      if (errorCode === 'SERVICE_NOT_FOUND') {
        setNoAdmind(true);
        setError(null);
      } else {
        setNoAdmind(false);
        setError(err.error?.message || err.message || 'Failed to fetch');
      }
    } finally {
      setLoading(false);
    }
  }, [getProjectApiPath]);

  // Lazy-load history for a specific handler key when expanded
  const fetchHandlerHistory = useCallback(
    async (handlerKey: string) => {
      setHistoryLoading(handlerKey);
      try {
        const projectApiPath = getProjectApiPath();
        const result = await rippleService.getHistory(
          projectApiPath,
          undefined,
          100,
          handlerKey
        );
        setHistoryMap((prev) => ({
          ...prev,
          [handlerKey]: (() => {
            const map: Record<string, RippleHistoryEvent> = {};
            for (const evt of result.items || []) {
              const serverKey = `${evt.serviceType || ''}:${evt.serverId || ''}:${evt.requestId || ''}`;
              map[serverKey] = evt;
            }
            return map;
          })(),
        }));
      } catch {
        // silent fail, user sees empty sub-table
      } finally {
        setHistoryLoading(null);
      }
    },
    [getProjectApiPath]
  );

  // Initial load + environment change
  useEffect(() => {
    setData(null);
    setHistoryMap({});
    setLoading(true);
    fetchStatus();
  }, [fetchStatus, currentEnvironmentId]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval > 0) {
      timerRef.current = setInterval(fetchStatus, refreshInterval);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refreshInterval, fetchStatus]);

  const handleSetRefreshInterval = (val: number) => {
    setRefreshInterval(val);
    localStorage.setItem('rippleMonitor.refreshInterval', val.toString());
  };

  const activeRefreshLabel =
    REFRESH_OPTIONS.find((o) => o.value === refreshInterval)?.label || 'Off';

  // Pagination handlers
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

  const handleSort = (field: SortField) => {
    const isAsc = sortField === field && sortOrder === 'asc';
    setSortOrder(isAsc ? 'desc' : 'asc');
    setSortField(field);
  };

  const handleRefresh = useCallback(
    async (pattern: string, cascade = false) => {
      setRefreshing(pattern);
      try {
        const projectApiPath = getProjectApiPath();
        const result = await rippleService.triggerRefresh(
          projectApiPath,
          pattern,
          cascade
        );
        enqueueSnackbar(
          t('ripple.refreshSuccess', { count: result?.matchedCount ?? 0 }),
          { variant: 'success' }
        );

        // Open tracking dialog
        setTrackingRequestId(result.requestId);
        setTrackingPattern(pattern);
        setTrackingMatchedKeys(result.matchedKeys || []);
        setTrackingDialogOpen(true);

        setTimeout(fetchStatus, 1000);
      } catch (err: any) {
        enqueueSnackbar(
          err.response?.data?.message ||
            err.message ||
            t('ripple.refreshFailed'),
          { variant: 'error' }
        );
      } finally {
        setRefreshing(null);
      }
    },
    [getProjectApiPath, enqueueSnackbar, fetchStatus, t]
  );

  const handleCustomRefresh = () => {
    if (!refreshPattern.trim()) return;
    handleRefresh(refreshPattern.trim(), refreshCascade);
    setRefreshDialogOpen(false);
    setRefreshPattern('');
    setRefreshCascade(false);
  };

  // Full refresh with confirm
  const handleConfirmFullRefresh = () => {
    setConfirmRefreshOpen(false);
    handleRefresh('**', true);
  };

  // Sort and paginate data
  const handlers = data?.refreshables ?? [];
  const sortedHandlers = [...handlers].sort((a, b) => {
    let aVal: any;
    let bVal: any;

    if (sortField === 'serviceType') {
      const aEntries = Object.values(historyMap[a.key] || {});
      const bEntries = Object.values(historyMap[b.key] || {});
      aVal = aEntries[0]?.[sortField] || '';
      bVal = bEntries[0]?.[sortField] || '';
    } else {
      aVal = a[sortField];
      bVal = b[sortField];
    }

    if (aVal == null) aVal = sortField === 'key' ? '' : -1;
    if (bVal == null) bVal = sortField === 'key' ? '' : -1;

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const paginatedHandlers = sortedHandlers.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        icon={<RippleIcon />}
        title={t('ripple.title')}
        subtitle={t('ripple.subtitle')}
        actions={
          !loading && !noAdmind ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {data?.admindUrl && (
                <>
                  <Chip
                    label={data.admindUrl}
                    size="small"
                    variant="outlined"
                    sx={{
                      color: 'text.secondary',
                      borderColor: 'divider',
                    }}
                  />
                  <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                </>
              )}
              <Button
                variant="contained"
                color="warning"
                size="small"
                startIcon={<AutorenewRounded />}
                onClick={() => setConfirmRefreshOpen(true)}
                disabled={!!refreshing}
              >
                {refreshing === '**'
                  ? t('ripple.processing')
                  : t('ripple.refreshAll')}
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={<PlayArrowIcon />}
                onClick={() => setRefreshDialogOpen(true)}
              >
                {t('ripple.refreshPattern')}
              </Button>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              <ButtonGroup
                variant="contained"
                size="small"
                sx={{ borderRadius: 1.5, overflow: 'hidden' }}
              >
                <Button startIcon={<RefreshIcon />} onClick={fetchStatus}>
                  {t('common.refresh')}
                </Button>
                <Button
                  size="small"
                  onClick={(e) => setRefreshMenuAnchor(e.currentTarget)}
                  sx={{
                    minWidth: 'auto',
                    px: 1,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  {activeRefreshLabel}
                  <ArrowDropDownIcon sx={{ ml: 0.25, fontSize: 18 }} />
                </Button>
              </ButtonGroup>
              <Menu
                anchorEl={refreshMenuAnchor}
                open={Boolean(refreshMenuAnchor)}
                onClose={() => setRefreshMenuAnchor(null)}
              >
                {REFRESH_OPTIONS.map((opt) => (
                  <MenuItem
                    key={opt.value}
                    selected={refreshInterval === opt.value}
                    onClick={() => {
                      handleSetRefreshInterval(opt.value);
                      setRefreshMenuAnchor(null);
                    }}
                  >
                    {opt.label}
                  </MenuItem>
                ))}
              </Menu>
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
        ) : (
        <>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {!handlers.length ? (
          <EmptyPlaceholder message={t('ripple.noHandlers')} minHeight={200} />
        ) : (
          <Paper variant="outlined">
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>
                      <TableSortLabel
                        active={sortField === 'key'}
                        direction={sortField === 'key' ? sortOrder : 'asc'}
                        onClick={() => handleSort('key')}
                      >
                        {t('ripple.key')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      <TableSortLabel
                        active={sortField === 'serviceType'}
                        direction={
                          sortField === 'serviceType' ? sortOrder : 'asc'
                        }
                        onClick={() => handleSort('serviceType')}
                      >
                        {t('ripple.history.column.serviceType', 'Service')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">
                      {t('ripple.history.column.serverCount', 'Servers')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {t('ripple.dependsOn')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">
                      <TableSortLabel
                        active={sortField === 'timeoutMs'}
                        direction={
                          sortField === 'timeoutMs' ? sortOrder : 'asc'
                        }
                        onClick={() => handleSort('timeoutMs')}
                      >
                        {t('ripple.timeout')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">
                      <TableSortLabel
                        active={sortField === 'debounceMs'}
                        direction={
                          sortField === 'debounceMs' ? sortOrder : 'asc'
                        }
                        onClick={() => handleSort('debounceMs')}
                      >
                        {t('ripple.debounce')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {t('ripple.history.column.lastAcked', '마지막 전파')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 32 }} />
                    <TableCell
                      sx={{ fontWeight: 700, width: 48 }}
                      align="center"
                    ></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedHandlers.map((handler) => (
                    <React.Fragment key={handler.key}>
                      <TableRow
                        hover
                        sx={{
                          '&:last-child td, &:last-child th': { border: 0 },
                        }}
                      >
                        <TableCell>
                          <Chip
                            label={handler.key}
                            size="small"
                            variant="outlined"
                            color={
                              handler.key.startsWith('cms/')
                                ? 'primary'
                                : 'default'
                            }
                            sx={{ fontFamily: 'monospace', fontWeight: 500 }}
                          />
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const entries = Object.values(
                              historyMap[handler.key] || {}
                            );
                            if (!entries.length)
                              return (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  —
                                </Typography>
                              );
                            const uniqueServices = [
                              ...new Set(
                                entries
                                  .map((e) => e.serviceType)
                                  .filter(Boolean)
                              ),
                            ].sort();
                            return (
                              <Box
                                sx={{
                                  display: 'flex',
                                  gap: 0.5,
                                  flexWrap: 'wrap',
                                }}
                              >
                                {uniqueServices.map((svc) => (
                                  <Chip
                                    key={svc}
                                    label={svc}
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                      fontSize: '0.7rem',
                                      fontFamily: 'monospace',
                                      height: 20,
                                    }}
                                  />
                                ))}
                              </Box>
                            );
                          })()}
                        </TableCell>
                        <TableCell align="right">
                          {(() => {
                            const entries = Object.values(
                              historyMap[handler.key] || {}
                            );
                            if (!entries.length)
                              return (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  —
                                </Typography>
                              );
                            const count = new Set(
                              entries.map((e) => e.serverId).filter(Boolean)
                            ).size;
                            return (
                              <Typography
                                variant="body2"
                                sx={{
                                  fontFamily: 'monospace',
                                  fontSize: '0.75rem',
                                }}
                              >
                                {count.toLocaleString()}
                              </Typography>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {(handler.dependsOn?.length ?? 0) > 0 ? (
                            <Box
                              sx={{
                                display: 'flex',
                                gap: 0.5,
                                flexWrap: 'wrap',
                              }}
                            >
                              {(handler.dependsOn ?? []).map((dep) => (
                                <Chip
                                  key={dep}
                                  label={dep}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: '0.7rem' }}
                                />
                              ))}
                            </Box>
                          ) : (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              —
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            sx={{ fontFamily: 'monospace' }}
                          >
                            {handler.timeoutMs != null
                              ? `${handler.timeoutMs}ms`
                              : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            sx={{ fontFamily: 'monospace' }}
                          >
                            {handler.debounceMs != null
                              ? `${handler.debounceMs}ms`
                              : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const entries = Object.values(
                              historyMap[handler.key] || {}
                            );
                            if (!entries.length)
                              return (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  —
                                </Typography>
                              );
                            const latest = entries.reduce((a, b) =>
                              String(a.finishedAt) > String(b.finishedAt)
                                ? a
                                : b
                            );
                            return (
                              <Tooltip
                                title={new Date(
                                  latest.finishedAt
                                ).toLocaleString('ko-KR')}
                              >
                                <Typography
                                  variant="body2"
                                  sx={{ fontSize: '0.75rem', cursor: 'help' }}
                                >
                                  {formatRelativeTime(
                                    new Date(latest.finishedAt)
                                  )}
                                </Typography>
                              </Tooltip>
                            );
                          })()}
                        </TableCell>
                        <TableCell sx={{ width: 32, px: 0 }}>
                          <IconButton
                            size="small"
                            onClick={() => {
                              if (expandedKey === handler.key) {
                                setExpandedKey(null);
                              } else {
                                setExpandedKey(handler.key);
                                fetchHandlerHistory(handler.key);
                              }
                            }}
                          >
                            {expandedKey === handler.key ? (
                              <KeyboardArrowUpIcon fontSize="small" />
                            ) : (
                              <KeyboardArrowDownIcon fontSize="small" />
                            )}
                          </IconButton>
                        </TableCell>
                        <TableCell align="center" sx={{ px: 0 }}>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              setRowMenuAnchor(e.currentTarget);
                              setRowMenuKey(handler.key);
                            }}
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                      {/* Collapsible detail row — per-server breakdown */}
                      <TableRow>
                        <TableCell
                          sx={{
                            py: 0,
                            border:
                              expandedKey === handler.key ? undefined : 'none',
                          }}
                          colSpan={9}
                        >
                          <Collapse
                            in={expandedKey === handler.key}
                            timeout="auto"
                            unmountOnExit
                          >
                            <Box sx={{ py: 1.5, px: 2 }}>
                              {historyLoading === handler.key ? (
                                <Box
                                  sx={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    py: 3,
                                  }}
                                >
                                  <CircularProgress size={24} />
                                </Box>
                              ) : (
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
                                        {(() => {
                                          const MAX_DISPLAY = 50;
                                          const allEntries = Object.values(
                                            historyMap[handler.key] || {}
                                          ).sort((a, b) =>
                                            String(b.finishedAt).localeCompare(
                                              String(a.finishedAt)
                                            )
                                          );
                                          const displayEntries =
                                            allEntries.slice(0, MAX_DISPLAY);
                                          const isTruncated =
                                            allEntries.length > MAX_DISPLAY;

                                          // Group by requestId
                                          const grouped: {
                                            requestId: string;
                                            events: typeof displayEntries;
                                          }[] = [];
                                          const groupMap = new Map<
                                            string,
                                            typeof displayEntries
                                          >();
                                          for (const evt of displayEntries) {
                                            const rid =
                                              evt.requestId ||
                                              `_no_rid_${evt.eventId}`;
                                            if (!groupMap.has(rid)) {
                                              const arr: typeof displayEntries =
                                                [];
                                              groupMap.set(rid, arr);
                                              grouped.push({
                                                requestId: rid,
                                                events: arr,
                                              });
                                            }
                                            groupMap.get(rid)!.push(evt);
                                          }

                                          return (
                                            <>
                                              {grouped.map((group, gi) => {
                                                const firstEvt =
                                                  group.events[0];
                                                const allSuccess =
                                                  group.events.every(
                                                    (e) =>
                                                      e.status === 'success'
                                                  );
                                                const borderColor = allSuccess
                                                  ? 'success.main'
                                                  : 'error.main';
                                                const isEven = gi % 2 === 0;
                                                return (
                                                  <React.Fragment
                                                    key={group.requestId}
                                                  >
                                                    {/* ── Request group header ── */}
                                                    <TableRow
                                                      sx={{
                                                        bgcolor: (theme) =>
                                                          theme.palette.mode ===
                                                          'dark'
                                                            ? isEven
                                                              ? 'rgba(66,165,245,0.08)'
                                                              : 'rgba(255,255,255,0.04)'
                                                            : isEven
                                                              ? 'rgba(25,118,210,0.05)'
                                                              : 'rgba(0,0,0,0.025)',
                                                      }}
                                                    >
                                                      <TableCell
                                                        colSpan={7}
                                                        sx={{
                                                          py: 0.5,
                                                          borderLeft:
                                                            '3px solid',
                                                          borderLeftColor:
                                                            borderColor,
                                                          borderBottom: 0,
                                                        }}
                                                      >
                                                        <Box
                                                          sx={{
                                                            display: 'flex',
                                                            alignItems:
                                                              'center',
                                                            gap: 1,
                                                          }}
                                                        >
                                                          {allSuccess ? (
                                                            <CheckCircleIcon
                                                              sx={{
                                                                fontSize: 14,
                                                                color:
                                                                  'success.main',
                                                              }}
                                                            />
                                                          ) : (
                                                            <CancelIcon
                                                              sx={{
                                                                fontSize: 14,
                                                                color:
                                                                  'error.main',
                                                              }}
                                                            />
                                                          )}
                                                          <Tooltip
                                                            title={
                                                              group.requestId.startsWith(
                                                                '_no_rid_'
                                                              )
                                                                ? ''
                                                                : group.requestId
                                                            }
                                                          >
                                                            <Typography
                                                              variant="caption"
                                                              sx={{
                                                                fontFamily:
                                                                  'monospace',
                                                                fontWeight: 700,
                                                                fontSize:
                                                                  '0.72rem',
                                                                color:
                                                                  'text.primary',
                                                                cursor:
                                                                  group.requestId.startsWith(
                                                                    '_no_rid_'
                                                                  )
                                                                    ? 'default'
                                                                    : 'help',
                                                              }}
                                                            >
                                                              {group.requestId.startsWith(
                                                                '_no_rid_'
                                                              )
                                                                ? '—'
                                                                : group.requestId.slice(
                                                                    0,
                                                                    10
                                                                  )}
                                                            </Typography>
                                                          </Tooltip>
                                                          <Typography
                                                            variant="caption"
                                                            sx={{
                                                              color:
                                                                'text.disabled',
                                                            }}
                                                          >
                                                            ·
                                                          </Typography>
                                                          <Tooltip
                                                            title={new Date(
                                                              firstEvt.finishedAt
                                                            ).toLocaleString(
                                                              'ko-KR'
                                                            )}
                                                          >
                                                            <Typography
                                                              variant="caption"
                                                              sx={{
                                                                color:
                                                                  'text.secondary',
                                                                cursor: 'help',
                                                                fontSize:
                                                                  '0.7rem',
                                                              }}
                                                            >
                                                              {formatRelativeTime(
                                                                new Date(
                                                                  firstEvt.finishedAt
                                                                )
                                                              )}
                                                            </Typography>
                                                          </Tooltip>
                                                          <Typography
                                                            variant="caption"
                                                            sx={{
                                                              color:
                                                                'text.disabled',
                                                            }}
                                                          >
                                                            ·
                                                          </Typography>
                                                          <Typography
                                                            variant="caption"
                                                            sx={{
                                                              color:
                                                                'text.disabled',
                                                              fontSize:
                                                                '0.68rem',
                                                            }}
                                                          >
                                                            {
                                                              group.events
                                                                .length
                                                            }{' '}
                                                            servers
                                                          </Typography>
                                                        </Box>
                                                      </TableCell>
                                                    </TableRow>
                                                    {/* ── Per-server rows ── */}
                                                    {group.events.map(
                                                      (evt, idx) => (
                                                        <TableRow
                                                          key={evt.eventId}
                                                          sx={{
                                                            bgcolor: (theme) =>
                                                              theme.palette
                                                                .mode === 'dark'
                                                                ? isEven
                                                                  ? 'rgba(66,165,245,0.04)'
                                                                  : 'transparent'
                                                                : isEven
                                                                  ? 'rgba(25,118,210,0.02)'
                                                                  : 'transparent',
                                                            // Add bottom spacing after last row of each group
                                                            ...(idx ===
                                                              group.events
                                                                .length -
                                                                1 && {
                                                              '& td': {
                                                                borderBottomWidth: 2,
                                                              },
                                                            }),
                                                          }}
                                                        >
                                                          <TableCell
                                                            sx={{
                                                              py: 0.5,
                                                              pl: 2,
                                                              borderLeft:
                                                                '3px solid',
                                                              borderLeftColor:
                                                                borderColor,
                                                            }}
                                                          >
                                                            {evt.status ===
                                                            'success' ? (
                                                              <CheckCircleIcon
                                                                color="success"
                                                                sx={{
                                                                  fontSize: 16,
                                                                }}
                                                              />
                                                            ) : (
                                                              <CancelIcon
                                                                color="error"
                                                                sx={{
                                                                  fontSize: 16,
                                                                }}
                                                              />
                                                            )}
                                                          </TableCell>
                                                          <TableCell
                                                            sx={{ py: 0.5 }}
                                                          >
                                                            <Typography
                                                              variant="body2"
                                                              sx={{
                                                                fontFamily:
                                                                  'monospace',
                                                                fontSize:
                                                                  '0.75rem',
                                                                fontWeight: 600,
                                                              }}
                                                            >
                                                              {evt.serviceType ||
                                                                '—'}
                                                            </Typography>
                                                          </TableCell>
                                                          <TableCell
                                                            sx={{ py: 0.5 }}
                                                          >
                                                            <Typography
                                                              variant="body2"
                                                              sx={{
                                                                fontFamily:
                                                                  'monospace',
                                                                fontSize:
                                                                  '0.72rem',
                                                                color:
                                                                  'text.secondary',
                                                              }}
                                                            >
                                                              {evt.serverId ||
                                                                '—'}
                                                            </Typography>
                                                          </TableCell>
                                                          <TableCell
                                                            sx={{ py: 0.5 }}
                                                          >
                                                            {evt.error ? (
                                                              <Tooltip
                                                                title={
                                                                  evt.error
                                                                }
                                                                placement="top"
                                                              >
                                                                <Typography
                                                                  variant="body2"
                                                                  sx={{
                                                                    fontSize:
                                                                      '0.7rem',
                                                                    color:
                                                                      'error.main',
                                                                    fontFamily:
                                                                      'monospace',
                                                                    maxWidth: 200,
                                                                    overflow:
                                                                      'hidden',
                                                                    textOverflow:
                                                                      'ellipsis',
                                                                    whiteSpace:
                                                                      'nowrap',
                                                                    cursor:
                                                                      'help',
                                                                  }}
                                                                >
                                                                  {evt.error}
                                                                </Typography>
                                                              </Tooltip>
                                                            ) : (
                                                              <Typography
                                                                variant="body2"
                                                                sx={{
                                                                  fontSize:
                                                                    '0.72rem',
                                                                  color:
                                                                    'text.disabled',
                                                                }}
                                                              >
                                                                —
                                                              </Typography>
                                                            )}
                                                          </TableCell>
                                                          <TableCell
                                                            align="right"
                                                            sx={{ py: 0.5 }}
                                                          >
                                                            <Typography
                                                              variant="body2"
                                                              sx={{
                                                                fontFamily:
                                                                  'monospace',
                                                                fontSize:
                                                                  '0.75rem',
                                                                color:
                                                                  'text.secondary',
                                                              }}
                                                            >
                                                              {evt.delayMs !=
                                                              null
                                                                ? `${evt.delayMs}ms`
                                                                : '—'}
                                                            </Typography>
                                                          </TableCell>
                                                          <TableCell
                                                            align="right"
                                                            sx={{ py: 0.5 }}
                                                          >
                                                            <Typography
                                                              variant="body2"
                                                              sx={{
                                                                fontFamily:
                                                                  'monospace',
                                                                fontSize:
                                                                  '0.75rem',
                                                                fontWeight:
                                                                  (evt.durationMs ||
                                                                    0) > 5000
                                                                    ? 700
                                                                    : 400,
                                                                color:
                                                                  (evt.durationMs ||
                                                                    0) > 5000
                                                                    ? 'warning.main'
                                                                    : 'text.primary',
                                                              }}
                                                            >
                                                              {evt.durationMs !=
                                                              null
                                                                ? `${evt.durationMs.toLocaleString()}ms`
                                                                : '—'}
                                                            </Typography>
                                                          </TableCell>
                                                          <TableCell
                                                            align="center"
                                                            sx={{ py: 0.5 }}
                                                          >
                                                            {evt.retryCount ? (
                                                              <Chip
                                                                label={
                                                                  evt.retryCount
                                                                }
                                                                size="small"
                                                                color="warning"
                                                                sx={{
                                                                  fontSize:
                                                                    '0.7rem',
                                                                  height: 20,
                                                                  minWidth: 28,
                                                                }}
                                                              />
                                                            ) : (
                                                              <Typography
                                                                variant="body2"
                                                                sx={{
                                                                  fontSize:
                                                                    '0.72rem',
                                                                  color:
                                                                    'text.disabled',
                                                                }}
                                                              >
                                                                —
                                                              </Typography>
                                                            )}
                                                          </TableCell>
                                                        </TableRow>
                                                      )
                                                    )}
                                                  </React.Fragment>
                                                );
                                              })}
                                              {isTruncated && (
                                                <TableRow>
                                                  <TableCell
                                                    colSpan={7}
                                                    align="center"
                                                    sx={{ py: 0.75, border: 0 }}
                                                  >
                                                    <Typography
                                                      variant="caption"
                                                      sx={{
                                                        color: 'text.secondary',
                                                      }}
                                                    >
                                                      {t(
                                                        'common.maxDisplayNotice',
                                                        {
                                                          max: MAX_DISPLAY,
                                                          total:
                                                            allEntries.length,
                                                        }
                                                      )}
                                                    </Typography>
                                                  </TableCell>
                                                </TableRow>
                                              )}
                                            </>
                                          );
                                        })()}
                                      </TableBody>
                                    </Table>
                                  </TableContainer>
                                </Paper>
                              )}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <SimplePagination
              count={handlers.length}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={PAGE_SIZE_OPTIONS}
            />
          </Paper>
        )}
        </>
        )}
      </PageContentLoader>

      {/* Row Context Menu */}
      <Menu
        anchorEl={rowMenuAnchor}
        open={Boolean(rowMenuAnchor)}
        onClose={() => {
          setRowMenuAnchor(null);
          setRowMenuKey(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          onClick={() => {
            setRowRefreshKey(rowMenuKey);
            setRowRefreshCascade(false);
            setRowRefreshConfirmOpen(true);
            setRowMenuAnchor(null);
            setRowMenuKey(null);
          }}
          disabled={!!refreshing}
        >
          <ListItemIcon>
            <RefreshIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('ripple.refresh')}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setRowRefreshKey(rowMenuKey);
            setRowRefreshCascade(true);
            setRowRefreshConfirmOpen(true);
            setRowMenuAnchor(null);
            setRowMenuKey(null);
          }}
          disabled={!!refreshing}
        >
          <ListItemIcon>
            <AutorenewRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('ripple.refreshCascade')}</ListItemText>
        </MenuItem>
      </Menu>

      {/* Confirm Full Refresh Dialog */}
      <Dialog
        open={confirmRefreshOpen}
        onClose={() => setConfirmRefreshOpen(false)}
      >
        <DialogTitle>{t('ripple.confirmRefresh.title')}</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {t('ripple.confirmRefresh.cascadeWarning')}
          </Alert>
          <DialogContentText>
            {t('ripple.confirmRefresh.message', {
              count: handlers.length,
            })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRefreshOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmFullRefresh}
          >
            {t('ripple.confirmRefresh.confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Pattern Refresh Dialog */}
      <Dialog
        open={refreshDialogOpen}
        onClose={() => setRefreshDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('ripple.refreshDialog.title')}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2, mt: 1, borderRadius: 2 }}>
            {t('ripple.refreshDialog.warning')}
          </Alert>
          <TextField
            autoFocus
            fullWidth
            label={t('ripple.refreshDialog.pattern')}
            placeholder={t('ripple.refreshDialog.patternPlaceholder')}
            value={refreshPattern}
            onChange={(e) => setRefreshPattern(e.target.value)}
            helperText={t('ripple.refreshDialog.patternHelp')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={refreshCascade}
                onChange={(e) => setRefreshCascade(e.target.checked)}
              />
            }
            label={t('ripple.refreshDialog.cascade')}
            sx={{ mt: 1 }}
          />
          {refreshCascade && (
            <Alert severity="error" sx={{ mt: 1, borderRadius: 2 }}>
              {t('ripple.refreshDialog.cascadeWarning')}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRefreshDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color={refreshCascade ? 'error' : 'warning'}
            onClick={handleCustomRefresh}
            disabled={!refreshPattern.trim()}
          >
            {t('ripple.refreshDialog.execute')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Row-level Refresh Confirm Dialog */}
      <Dialog
        open={rowRefreshConfirmOpen}
        onClose={() => setRowRefreshConfirmOpen(false)}
      >
        <DialogTitle>
          {rowRefreshCascade
            ? t('ripple.rowRefreshConfirm.cascadeTitle')
            : t('ripple.rowRefreshConfirm.title')}
        </DialogTitle>
        <DialogContent>
          <Alert
            severity={rowRefreshCascade ? 'error' : 'warning'}
            sx={{ mb: 2, borderRadius: 2 }}
          >
            {rowRefreshCascade
              ? t('ripple.rowRefreshConfirm.cascadeWarning')
              : t('ripple.rowRefreshConfirm.warning')}
          </Alert>
          <DialogContentText>
            {t('ripple.rowRefreshConfirm.message', { key: rowRefreshKey })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRowRefreshConfirmOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color={rowRefreshCascade ? 'error' : 'warning'}
            onClick={() => {
              if (rowRefreshKey)
                handleRefresh(rowRefreshKey, rowRefreshCascade);
              setRowRefreshConfirmOpen(false);
            }}
          >
            {t('ripple.rowRefreshConfirm.confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Real-Time Tracking Dialog */}
      <RippleTrackingDialog
        open={trackingDialogOpen}
        requestId={trackingRequestId}
        pattern={trackingPattern}
        matchedKeys={trackingMatchedKeys}
        onClose={() => setTrackingDialogOpen(false)}
      />
    </Box>
  );
};

export default RippleMonitorPage;
