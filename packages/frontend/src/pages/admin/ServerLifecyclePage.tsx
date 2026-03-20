import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableSortLabel,
  Chip,
  IconButton,
  Paper,
  Collapse,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import {
  Info as InfoIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  History as HistoryIcon,
  Cloud as CloudIcon,
  Code as CodeIcon,
  ErrorOutline as ErrorOutlineIcon,
  ViewColumn as ViewColumnIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import { copyToClipboardWithNotification } from '../../utils/clipboard';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import useSWR from 'swr';
import { RelativeTime } from '../../components/common/RelativeTime';
import serverLifecycleService, {
  ServerLifecycleEvent,
} from '../../services/serverLifecycleService';
import EmptyPagePlaceholder from '../../components/common/EmptyPagePlaceholder';
import SimplePagination from '../../components/common/SimplePagination';
import DynamicFilterBar, {
  FilterDefinition,
  ActiveFilter,
} from '../../components/common/DynamicFilterBar';
import { useDebounce } from '../../hooks/useDebounce';
import SearchTextField from '../../components/common/SearchTextField';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import ColumnSettingsDialog, {
  ColumnConfig,
} from '../../components/common/ColumnSettingsDialog';
import PageContentLoader from '@/components/common/PageContentLoader';



// Event row component
interface EventRowProps {
  event: ServerLifecycleEvent;
  visibleColumns: string[];
  index: number;
  enqueueSnackbar: (message: string, options?: any) => void;
}

const EventRow: React.FC<EventRowProps> = ({
  event,
  visibleColumns,
  index,
  enqueueSnackbar,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  // Copy helper function
  const handleCopy = (text: string) => {
    copyToClipboardWithNotification(
      text,
      () => enqueueSnackbar(t('common.copied'), { variant: 'success' }),
      () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
    );
  };

  // Event type color based on status
  const getEventColor = (type: string) => {
    switch (type.toUpperCase()) {
      case 'INITIALIZING':
        return 'info';
      case 'READY':
        return 'success';
      case 'SHUTTING_DOWN':
        return 'warning';
      case 'TERMINATED':
        return 'default';
      case 'ERROR':
        return 'error';
      case 'NO_RESPONSE':
        return 'warning';
      default:
        return 'primary';
    }
  };

  const formatUptime = (seconds: number) => {
    if (!seconds) return '-';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  // Get localized event type label
  const getEventTypeLabel = (eventType: string) => {
    return t(`serverList.status.${eventType}`, { defaultValue: eventType });
  };

  const renderCell = (columnId: string) => {
    switch (columnId) {
      case 'eventType':
        return (
          <Chip
            label={getEventTypeLabel(event.eventType)}
            color={getEventColor(event.eventType) as any}
            size="small"
            sx={{ fontWeight: 'bold', minWidth: 90 }}
          />
        );
      case 'service':
        return (
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {event.serviceType}
          </Typography>
        );
      case 'group':
        return (
          <Typography variant="body2">{event.serviceGroup || '-'}</Typography>
        );
      case 'hostname':
        return (
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {event.hostname || '-'}
          </Typography>
        );
      case 'externalAddress':
        return (
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {event.externalAddress || '-'}
          </Typography>
        );
      case 'internalAddress':
        return (
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {event.internalAddress || '-'}
          </Typography>
        );
      case 'cloudRegion':
        return (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {event.cloudRegion ? (
              <Chip
                icon={<CloudIcon style={{ fontSize: 14 }} />}
                label={event.cloudRegion}
                size="small"
                variant="outlined"
              />
            ) : (
              '-'
            )}
          </Box>
        );
      case 'appVersion':
        return (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {event.appVersion ? (
              <Chip
                icon={<CodeIcon style={{ fontSize: 14 }} />}
                label={event.appVersion}
                size="small"
                variant="outlined"
              />
            ) : (
              '-'
            )}
          </Box>
        );
      case 'environment':
        return (
          <Typography variant="body2">{event.environmentId || '-'}</Typography>
        );
      case 'instanceId':
        return (
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {event.instanceId}
          </Typography>
        );
      case 'ports':
        return (
          <Typography
            variant="body2"
            sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
          >
            {event.ports
              ? Object.entries(event.ports)
                  .map(([k, v]) => `${k}:${v}`)
                  .join(', ')
              : '-'}
          </Typography>
        );
      case 'cloudProvider':
        return (
          <Typography variant="body2">{event.cloudProvider || '-'}</Typography>
        );
      case 'cloudZone':
        return (
          <Typography variant="body2">{event.cloudZone || '-'}</Typography>
        );
      case 'labels':
        return (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {event.labels
              ? Object.entries(event.labels)
                  .filter(
                    ([k]) => !['service', 'group', 'environment'].includes(k)
                  )
                  .slice(0, 3)
                  .map(([k, v]) => (
                    <Chip
                      key={k}
                      label={`${k}: ${v}`}
                      size="small"
                      variant="outlined"
                    />
                  ))
              : '-'}
          </Box>
        );
      case 'uptime':
        return (
          <Typography variant="body2">
            {formatUptime(event.uptimeSeconds)}
          </Typography>
        );
      case 'timestamp':
        return <RelativeTime date={event.createdAt} />;
      default:
        return null;
    }
  };

  // Striped row background
  const isOdd = index % 2 === 1;

  return (
    <>
      <TableRow
        hover
        sx={{
          '& > *': { borderBottom: 'unset' },
          cursor: 'pointer',
          bgcolor: (theme) =>
            index % 2 === 0
              ? 'transparent'
              : theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.02)'
                : 'rgba(0, 0, 0, 0.02)',
        }}
        onClick={() => setOpen(!open)}
      >
        <TableCell width="50">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(!open);
            }}
          >
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        {visibleColumns.map((colId) => (
          <TableCell key={colId}>{renderCell(colId)}</TableCell>
        ))}
      </TableRow>
      <TableRow>
        <TableCell
          style={{ paddingBottom: 0, paddingTop: 0 }}
          colSpan={visibleColumns.length + 1}
        >
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 2 }}>
              <Typography
                variant="subtitle2"
                gutterBottom
                component="div"
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <InfoIcon fontSize="small" /> {t('serverLifecycle.details')}
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 2,
                  }}
                >
                  {/* Instance ID */}
                  <Box>
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      display="block"
                    >
                      {t('serverLifecycle.instanceId')}
                    </Typography>
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: 'monospace' }}
                      >
                        {event.instanceId}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => handleCopy(event.instanceId)}
                        sx={{ p: 0.25 }}
                      >
                        <ContentCopyIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  </Box>
                  {/* Service */}
                  <Box>
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      display="block"
                    >
                      {t('serverLifecycle.service')}
                    </Typography>
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <Typography variant="body2">
                        {event.serviceType}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => handleCopy(event.serviceType)}
                        sx={{ p: 0.25 }}
                      >
                        <ContentCopyIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  </Box>
                  {/* Group */}
                  <Box>
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      display="block"
                    >
                      {t('serverLifecycle.group')}
                    </Typography>
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <Typography variant="body2">
                        {event.serviceGroup || '-'}
                      </Typography>
                      {event.serviceGroup && (
                        <IconButton
                          size="small"
                          onClick={() => handleCopy(event.serviceGroup!)}
                          sx={{ p: 0.25 }}
                        >
                          <ContentCopyIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                  {/* Hostname */}
                  <Box>
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      display="block"
                    >
                      {t('serverList.hostname')}
                    </Typography>
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: 'monospace' }}
                      >
                        {event.hostname || '-'}
                      </Typography>
                      {event.hostname && (
                        <IconButton
                          size="small"
                          onClick={() => handleCopy(event.hostname!)}
                          sx={{ p: 0.25 }}
                        >
                          <ContentCopyIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                  {/* Environment */}
                  <Box>
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      display="block"
                    >
                      {t('serverLifecycle.environment')}
                    </Typography>
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <Typography variant="body2">
                        {event.environmentId || '-'}
                      </Typography>
                      {event.environmentId && (
                        <IconButton
                          size="small"
                          onClick={() => handleCopy(event.environmentId!)}
                          sx={{ p: 0.25 }}
                        >
                          <ContentCopyIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                  {/* External Address */}
                  <Box>
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      display="block"
                    >
                      {t('serverList.externalAddress')}
                    </Typography>
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: 'monospace' }}
                      >
                        {event.externalAddress || '-'}
                      </Typography>
                      {event.externalAddress && (
                        <IconButton
                          size="small"
                          onClick={() => handleCopy(event.externalAddress!)}
                          sx={{ p: 0.25 }}
                        >
                          <ContentCopyIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                  {/* Internal Address */}
                  <Box>
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      display="block"
                    >
                      {t('serverList.internalAddress')}
                    </Typography>
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: 'monospace' }}
                      >
                        {event.internalAddress || '-'}
                      </Typography>
                      {event.internalAddress && (
                        <IconButton
                          size="small"
                          onClick={() => handleCopy(event.internalAddress!)}
                          sx={{ p: 0.25 }}
                        >
                          <ContentCopyIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                  {/* Ports */}
                  <Box>
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      display="block"
                    >
                      {t('serverList.ports')}
                    </Typography>
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                      >
                        {event.ports
                          ? Object.entries(event.ports)
                              .map(([k, v]) => `${k}:${v}`)
                              .join(', ')
                          : '-'}
                      </Typography>
                      {event.ports && Object.keys(event.ports).length > 0 && (
                        <IconButton
                          size="small"
                          onClick={() =>
                            handleCopy(JSON.stringify(event.ports))
                          }
                          sx={{ p: 0.25 }}
                        >
                          <ContentCopyIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                  {/* Cloud Info */}
                  <Box>
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      display="block"
                    >
                      {t('serverLifecycle.cloudInfo')}
                    </Typography>
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <Typography variant="body2">
                        {event.cloudProvider || '-'} /{' '}
                        {event.cloudRegion || '-'} / {event.cloudZone || '-'}
                      </Typography>
                      {(event.cloudProvider ||
                        event.cloudRegion ||
                        event.cloudZone) && (
                        <IconButton
                          size="small"
                          onClick={() =>
                            handleCopy(
                              `${event.cloudProvider || ''} / ${event.cloudRegion || ''} / ${event.cloudZone || ''}`
                            )
                          }
                          sx={{ p: 0.25 }}
                        >
                          <ContentCopyIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                  {/* SDK Version */}
                  <Box>
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      display="block"
                    >
                      SDK Version
                    </Typography>
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <Typography variant="body2">
                        {event.sdkVersion || '-'}
                      </Typography>
                      {event.sdkVersion && (
                        <IconButton
                          size="small"
                          onClick={() => handleCopy(event.sdkVersion!)}
                          sx={{ p: 0.25 }}
                        >
                          <ContentCopyIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                  {/* App Version */}
                  <Box>
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      display="block"
                    >
                      {t('serverList.appVersion')}
                    </Typography>
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <Typography variant="body2">
                        {event.appVersion || '-'}
                      </Typography>
                      {event.appVersion && (
                        <IconButton
                          size="small"
                          onClick={() => handleCopy(event.appVersion!)}
                          sx={{ p: 0.25 }}
                        >
                          <ContentCopyIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                  {/* Uptime */}
                  <Box>
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      display="block"
                    >
                      {t('serverLifecycle.uptime')}
                    </Typography>
                    <Typography variant="body2">
                      {formatUptime(event.uptimeSeconds)}
                    </Typography>
                  </Box>
                  {/* Created At */}
                  <Box>
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      display="block"
                    >
                      {t('serverLifecycle.timestamp')}
                    </Typography>
                    <RelativeTime date={event.createdAt} />
                  </Box>
                  {/* Labels */}
                  {event.labels && Object.keys(event.labels).length > 0 && (
                    <Box sx={{ gridColumn: 'span 3' }}>
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        display="block"
                      >
                        {t('serverList.labels')}
                      </Typography>
                      <Box
                        sx={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 0.5,
                          mt: 0.5,
                        }}
                      >
                        {Object.entries(event.labels).map(([k, v]) => (
                          <Chip
                            key={k}
                            label={`${k}: ${v}`}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                        <IconButton
                          size="small"
                          onClick={() =>
                            handleCopy(JSON.stringify(event.labels, null, 2))
                          }
                          sx={{ p: 0.25 }}
                        >
                          <ContentCopyIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>
                    </Box>
                  )}
                  {/* Metadata */}
                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <Box sx={{ gridColumn: 'span 3' }}>
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        display="block"
                      >
                        {t('serverLifecycle.metadata')}
                      </Typography>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 0.5,
                          mt: 0.5,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {JSON.stringify(event.metadata, null, 2)}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() =>
                            handleCopy(JSON.stringify(event.metadata, null, 2))
                          }
                          sx={{ p: 0.25 }}
                        >
                          <ContentCopyIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>
                    </Box>
                  )}
                </Box>

                {event.errorMessage && (
                  <Box sx={{ mt: 2 }}>
                    <Typography
                      variant="subtitle2"
                      color="error.main"
                      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                    >
                      <ErrorOutlineIcon fontSize="small" />{' '}
                      {t('serverLifecycle.error')}
                    </Typography>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1,
                        mt: 0.5,
                        bgcolor: 'error.light',
                        color: 'error.contrastText',
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {event.errorMessage}
                      </Typography>
                    </Paper>
                  </Box>
                )}

                {event.errorStack && (
                  <Box sx={{ mt: 2 }}>
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      display="block"
                    >
                      {t('serverLifecycle.callStack')}
                    </Typography>
                    <Box
                      sx={{
                        mt: 0.5,
                        p: 1,
                        bgcolor: 'grey.900',
                        color: 'grey.100',
                        borderRadius: 1,
                        maxHeight: 200,
                        overflow: 'auto',
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {event.errorStack}
                    </Box>
                  </Box>
                )}
              </Paper>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

const ServerLifecyclePage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // Search with debounce
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // Dynamic filters with debouncing to prevent refresh during typing
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>(() => {
    // Check for URL instanceId parameter first
    const urlInstanceId = searchParams.get('instanceId');
    if (urlInstanceId) {
      return [{ key: 'instanceId', value: urlInstanceId }];
    }

    try {
      const saved = localStorage.getItem('serverLifecyclePage.activeFilters');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const debouncedActiveFilters = useDebounce(activeFilters, 500);

  // Clear URL params after initial load to avoid persisting in URL
  useEffect(() => {
    const urlInstanceId = searchParams.get('instanceId');
    if (urlInstanceId) {
      // Clear the URL parameter after applying filter
      setSearchParams({}, { replace: true });
    }
  }, []);

  // Sorting - default to timestamp descending (most recent first)
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Column settings - comprehensive list matching server list view
  const defaultColumns: ColumnConfig[] = [
    { id: 'eventType', labelKey: 'serverLifecycle.eventType', visible: true },
    { id: 'service', labelKey: 'serverLifecycle.service', visible: true },
    { id: 'group', labelKey: 'serverLifecycle.group', visible: true },
    {
      id: 'environment',
      labelKey: 'serverLifecycle.environment',
      visible: true,
    },
    { id: 'instanceId', labelKey: 'serverLifecycle.instanceId', visible: true },
    { id: 'hostname', labelKey: 'serverList.hostname', visible: true },
    {
      id: 'externalAddress',
      labelKey: 'serverList.externalAddress',
      visible: false,
    },
    {
      id: 'internalAddress',
      labelKey: 'serverList.internalAddress',
      visible: true,
    },
    { id: 'ports', labelKey: 'serverList.ports', visible: false },
    {
      id: 'cloudProvider',
      labelKey: 'serverList.cloudProvider',
      visible: false,
    },
    { id: 'cloudRegion', labelKey: 'serverList.cloudRegion', visible: false },
    { id: 'cloudZone', labelKey: 'serverList.cloudZone', visible: false },
    { id: 'appVersion', labelKey: 'serverList.appVersion', visible: true },
    { id: 'labels', labelKey: 'serverList.labels', visible: false },
    { id: 'uptime', labelKey: 'serverLifecycle.uptime', visible: true },
    { id: 'timestamp', labelKey: 'serverLifecycle.timestamp', visible: true },
  ];

  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('serverLifecycleColumns');
    if (saved) {
      try {
        const savedColumns = JSON.parse(saved);
        const mergedColumns = savedColumns.map((savedCol: ColumnConfig) => {
          const defaultCol = defaultColumns.find((c) => c.id === savedCol.id);
          return defaultCol ? { ...defaultCol, ...savedCol } : savedCol;
        });
        const savedIds = new Set(savedColumns.map((c: ColumnConfig) => c.id));
        const newColumns = defaultColumns.filter((c) => !savedIds.has(c.id));
        return [...mergedColumns, ...newColumns];
      } catch {
        return defaultColumns;
      }
    }
    return defaultColumns;
  });

  const [columnSettingsAnchor, setColumnSettingsAnchor] =
    useState<HTMLButtonElement | null>(null);

  const handleColumnsChange = useCallback(
    (newColumns: ColumnConfig[]) => {
      setColumns(newColumns);
      localStorage.setItem(
        'serverLifecycleColumns',
        JSON.stringify(newColumns)
      );
    },
    []
  );

  const handleResetColumns = useCallback(() => {
    setColumns(defaultColumns);
    localStorage.setItem(
      'serverLifecycleColumns',
      JSON.stringify(defaultColumns)
    );
  }, []);

  // Visible columns
  const visibleColumns = useMemo(
    () => columns.filter((c) => c.visible).map((c) => c.id),
    [columns]
  );

  // SWR fetcher
  const fetcher = useCallback(async () => {
    const params: any = { page: page + 1, limit: rowsPerPage };

    if (debouncedSearchQuery) {
      params.search = debouncedSearchQuery;
    }

    debouncedActiveFilters.forEach((f) => {
      if (f.value) params[f.key] = f.value;
    });

    // Add sorting
    params.sortBy = sortBy;
    params.sortOrder = sortOrder;

    return await serverLifecycleService.getEvents(projectApiPath, params);
  }, [
    page,
    rowsPerPage,
    debouncedSearchQuery,
    debouncedActiveFilters,
    sortBy,
    sortOrder,
  ]);

  const { data, isLoading, mutate } = useSWR(
    `server-lifecycle-events-${page}-${rowsPerPage}-${debouncedSearchQuery}-${JSON.stringify(debouncedActiveFilters)}-${sortBy}-${sortOrder}`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: 0,
    }
  );

  // Filter definitions
  const filterDefinitions: FilterDefinition[] = useMemo(
    () => [
      {
        key: 'serviceType',
        label: t('serverLifecycle.filters.serviceType'),
        type: 'text',
      },
      {
        key: 'eventType',
        label: t('serverLifecycle.filters.eventType'),
        type: 'multiselect',
        operator: 'any_of',
        allowOperatorToggle: false,
        options: [
          {
            label: t('serverList.status.initializing', {
              defaultValue: 'Initializing',
            }),
            value: 'INITIALIZING',
          },
          {
            label: t('serverList.status.ready', { defaultValue: 'Ready' }),
            value: 'READY',
          },
          {
            label: t('serverList.status.shuttingDown', {
              defaultValue: 'Shutting Down',
            }),
            value: 'SHUTTING_DOWN',
          },
          {
            label: t('serverList.status.error', { defaultValue: 'Error' }),
            value: 'ERROR',
          },
          {
            label: t('serverList.status.terminated', {
              defaultValue: 'Terminated',
            }),
            value: 'TERMINATED',
          },
          {
            label: t('serverList.status.noResponse', {
              defaultValue: 'No Response',
            }),
            value: 'NO_RESPONSE',
          },
        ],
      },
      {
        key: 'instanceId',
        label: t('serverLifecycle.instanceId'),
        type: 'text',
      },
      {
        key: 'hostname',
        label: t('serverList.hostname'),
        type: 'text',
      },
      {
        key: 'externalAddress',
        label: t('serverList.externalAddress'),
        type: 'text',
      },
      {
        key: 'internalAddress',
        label: t('serverList.internalAddress'),
        type: 'text',
      },
      {
        key: 'serviceGroup',
        label: t('serverLifecycle.group'),
        type: 'text',
      },
      {
        key: 'appVersion',
        label: t('serverList.appVersion'),
        type: 'text',
      },
      {
        key: 'cloudProvider',
        label: t('serverList.cloudProvider'),
        type: 'text',
      },
      {
        key: 'cloudRegion',
        label: t('serverList.cloudRegion'),
        type: 'text',
      },
    ],
    [t]
  );

  // Handlers
  const handleRefresh = useCallback(() => {
    mutate();
  }, [mutate]);

  const handleFilterAdd = useCallback(
    (filter: ActiveFilter) => {
      const newFilters = [...activeFilters, filter];
      setActiveFilters(newFilters);
      localStorage.setItem(
        'serverLifecyclePage.activeFilters',
        JSON.stringify(newFilters)
      );
      setPage(0);
    },
    [activeFilters]
  );

  const handleFilterRemove = useCallback(
    (filterKey: string) => {
      const newFilters = activeFilters.filter((f) => f.key !== filterKey);
      setActiveFilters(newFilters);
      localStorage.setItem(
        'serverLifecyclePage.activeFilters',
        JSON.stringify(newFilters)
      );
      setPage(0);
    },
    [activeFilters]
  );

  const handleFilterChange = useCallback(
    (filterKey: string, value: any) => {
      const newFilters = activeFilters.map((f) =>
        f.key === filterKey ? { ...f, value } : f
      );
      setActiveFilters(newFilters);
      localStorage.setItem(
        'serverLifecyclePage.activeFilters',
        JSON.stringify(newFilters)
      );
      setPage(0);
    },
    [activeFilters]
  );

  const handleOperatorChange = useCallback(
    (filterKey: string, operator: 'any_of' | 'include_all') => {
      const newFilters = activeFilters.map((f) =>
        f.key === filterKey ? { ...f, operator } : f
      );
      setActiveFilters(newFilters);
      localStorage.setItem(
        'serverLifecyclePage.activeFilters',
        JSON.stringify(newFilters)
      );
    },
    [activeFilters]
  );

  const handlePageChange = useCallback((_: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handleRowsPerPageChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newRowsPerPage = parseInt(event.target.value, 10);
      setRowsPerPage(newRowsPerPage);
      setPage(0);
    },
    []
  );

  // Column to API field mapping for sorting
  const columnToSortField: Record<string, string> = {
    eventType: 'eventType',
    service: 'serviceType',
    group: 'serviceGroup',
    hostname: 'hostname',
    cloudRegion: 'cloudRegion',
    appVersion: 'appVersion',
    uptime: 'uptimeSeconds',
    timestamp: 'createdAt',
  };

  const handleSort = useCallback(
    (columnId: string) => {
      const sortField = columnToSortField[columnId];
      if (!sortField) return; // Column not sortable

      if (sortBy === sortField) {
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        setSortBy(sortField);
        setSortOrder('desc');
      }
      setPage(0);
    },
    [sortBy, sortOrder]
  );

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <HistoryIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {t('serverLifecycle.title')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('serverLifecycle.subtitle')}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Filters */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          alignItems: 'center',
          flexWrap: 'nowrap',
          mb: 3,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            alignItems: 'center',
            flexWrap: 'nowrap',
            flexGrow: 1,
            minWidth: 0,
          }}
        >
          {/* Search */}
          <SearchTextField
            placeholder={t('serverLifecycle.searchPlaceholder')}
            value={searchQuery}
            onChange={setSearchQuery}
          />

          {/* Dynamic Filter Bar */}
          <DynamicFilterBar
            availableFilters={filterDefinitions}
            activeFilters={activeFilters}
            onFilterAdd={handleFilterAdd}
            onFilterRemove={handleFilterRemove}
            onFilterChange={handleFilterChange}
            onOperatorChange={handleOperatorChange}
            onRefresh={handleRefresh}
            refreshDisabled={isLoading}
            noWrap={true}
            afterFilterAddActions={
              <Tooltip title={t('common.columnSettings')}>
                <IconButton
                  onClick={(e) => setColumnSettingsAnchor(e.currentTarget)}
                  sx={{
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <ViewColumnIcon />
                </IconButton>
              </Tooltip>
            }
          />
        </Box>
      </Box>

      {/* Column Settings Dialog */}
      <ColumnSettingsDialog
        anchorEl={columnSettingsAnchor}
        columns={columns}
        onColumnsChange={handleColumnsChange}
        onReset={handleResetColumns}
        onClose={() => setColumnSettingsAnchor(null)}
      />

      {/* Table */}
      <PageContentLoader loading={isLoading}>
        {!data?.data || data.data.length === 0 ? (
          <EmptyPagePlaceholder message={t('serverLifecycle.noEvents')} />
        ) : (
          <Card variant="outlined">
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              <TableContainer>
                <Table aria-label="server lifecycle table" size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell width="50" />
                      {visibleColumns.map((colId) => {
                        const col = columns.find((c) => c.id === colId);
                        const sortField = columnToSortField[colId];
                        const isSortable = !!sortField;
                        const isActive = sortBy === sortField;
                        return col ? (
                          <TableCell key={colId}>
                            {isSortable ? (
                              <TableSortLabel
                                active={isActive}
                                direction={isActive ? sortOrder : 'desc'}
                                onClick={() => handleSort(colId)}
                              >
                                {t(col.labelKey)}
                              </TableSortLabel>
                            ) : (
                              t(col.labelKey)
                            )}
                          </TableCell>
                        ) : null;
                      })}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.data.map(
                      (event: ServerLifecycleEvent, index: number) => (
                        <EventRow
                          key={event.id}
                          event={event}
                          visibleColumns={visibleColumns}
                          index={index}
                          enqueueSnackbar={enqueueSnackbar}
                        />
                      )
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <SimplePagination
                count={data.total}
                page={page}
                rowsPerPage={rowsPerPage}
                onPageChange={handlePageChange}
                onRowsPerPageChange={handleRowsPerPageChange}
              />
            </CardContent>
          </Card>
        )}
      </PageContentLoader>
    </Box>
  );
};

export default ServerLifecyclePage;
