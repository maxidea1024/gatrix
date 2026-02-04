import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Collapse,
  Button,
  useTheme,
  CircularProgress,
  Alert,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableHead,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Stack,
  LinearProgress,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  KeyboardArrowDown,
  KeyboardArrowUp,
  Refresh as RefreshIcon,
  Circle as CircleIcon,
  Cached as CachedIcon,
  Hub as HubIcon,
  Code as CodeIcon,
  ContentCopy as CopyIcon,
  Close as CloseIcon,
  Search as SearchIcon,
  BarChart as BarChartIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  TableChart as TableChartIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import Editor from '@monaco-editor/react';
import serviceDiscoveryService, { ServiceInstance } from '../../services/serviceDiscoveryService';
import { RelativeTime } from '../../components/common/RelativeTime';
import { useDebounce } from '../../hooks/useDebounce';
import { copyToClipboardWithNotification } from '../../utils/clipboard';
import { formatDateTimeDetailed } from '../../utils/dateFormat';

// Grouping options - Cloud-related only
type GroupingField = 'cloudProvider' | 'cloudRegion';

interface EdgeGroup {
  id: string;
  name: string;
  instances: ServiceInstance[];
  children?: EdgeGroup[];
}

interface CacheStatus {
  status: string;
  timestamp?: string;
  lastRefreshedAt?: string | null;
  invalidationCount?: number;
  summary?: Record<string, Record<string, number>>;
  detail?: Record<string, any>;
  latency?: number;
  error?: string;
  loading?: boolean;
}

// Request statistics interface
interface RequestStats {
  startTime: string;
  snapshotTime: string;
  uptimeSeconds: number;
  totalRequests: number;
  statusCodes: Record<string, number>;
  endpoints: Record<
    string,
    {
      count: number;
      avgDurationMs: number;
      minDurationMs: number;
      maxDurationMs: number;
      p95DurationMs: number;
      p99DurationMs: number;
      bytesSent: number;
      bytesReceived: number;
    }
  >;
  totals: {
    bytesSent: number;
    bytesReceived: number;
    avgDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
  };
  rateLimit?: number;
  latency?: number;
  error?: string;
  loading?: boolean;
}

const GatrixEdgesPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();

  // States
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [services, setServices] = useState<ServiceInstance[]>([]);
  const [groups, setGroups] = useState<EdgeGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedInstances, setExpandedInstances] = useState<Set<string>>(new Set());

  // Grouping - support multiple levels (cloud-related only)
  // Load from localStorage or default to empty array
  const [groupingLevels, setGroupingLevels] = useState<GroupingField[]>(() => {
    try {
      const saved = localStorage.getItem('gatrixEdges.groupingLevels');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate that parsed values are valid GroupingField types
        if (
          Array.isArray(parsed) &&
          parsed.every((item) => ['cloudProvider', 'cloudRegion'].includes(item))
        ) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load grouping levels from localStorage:', e);
    }
    return [];
  });

  // Cache status per instance
  const [cacheStatuses, setCacheStatuses] = useState<Map<string, CacheStatus>>(new Map());
  const cachePollingRef = useRef<NodeJS.Timeout | null>(null);

  // Request stats per instance
  const [requestStats, setRequestStats] = useState<Map<string, RequestStats>>(new Map());
  const statsPollingRef = useRef<NodeJS.Timeout | null>(null);

  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState<Map<string, Set<string>>>(new Map());

  // Cache refresh interval state (persisted in localStorage)
  const [cacheRefreshInterval, setCacheRefreshInterval] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem('gatrix_edges_cache_refresh_interval');
      if (stored === 'off') return null;
      const parsed = parseInt(stored || '10', 10);
      return isNaN(parsed) ? 10 : parsed;
    } catch {
      return 10;
    }
  });

  // Stats refresh interval state (persisted in localStorage)
  const [statsRefreshInterval, setStatsRefreshInterval] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem('gatrix_edges_stats_refresh_interval');
      if (stored === 'off') return null;
      const parsed = parseInt(stored || '10', 10);
      return isNaN(parsed) ? 10 : parsed;
    } catch {
      return 10;
    }
  });

  // Save cache refresh interval to localStorage
  useEffect(() => {
    try {
      if (cacheRefreshInterval === null) {
        localStorage.setItem('gatrix_edges_cache_refresh_interval', 'off');
      } else {
        localStorage.setItem(
          'gatrix_edges_cache_refresh_interval',
          cacheRefreshInterval.toString()
        );
      }
    } catch (e) {
      console.error('Failed to save cache refresh interval to localStorage', e);
    }
  }, [cacheRefreshInterval]);

  // Save stats refresh interval to localStorage
  useEffect(() => {
    try {
      if (statsRefreshInterval === null) {
        localStorage.setItem('gatrix_edges_stats_refresh_interval', 'off');
      } else {
        localStorage.setItem(
          'gatrix_edges_stats_refresh_interval',
          statsRefreshInterval.toString()
        );
      }
    } catch (e) {
      console.error('Failed to save stats refresh interval to localStorage', e);
    }
  }, [statsRefreshInterval]);

  // JSON Dialog
  const [jsonDialogOpen, setJsonDialogOpen] = useState(false);
  const [jsonDialogData, setJsonDialogData] = useState<any>(null);
  const [jsonDialogTitle, setJsonDialogTitle] = useState('');
  const [fullJsonLoading, setFullJsonLoading] = useState<string | null>(null);
  const [detailViewMode, setDetailViewMode] = useState<'table' | 'json'>('table');

  // JSON Search State
  const [jsonSearchQuery, setJsonSearchQuery] = useState('');
  const debouncedJsonSearchQuery = useDebounce(jsonSearchQuery, 300);
  const [jsonSearchMatches, setJsonSearchMatches] = useState<any[]>([]);
  const [jsonSearchIndex, setJsonSearchIndex] = useState(0);
  const editorRef = useRef<any>(null);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  useEffect(() => {
    if (!editorRef.current) return;
    const model = editorRef.current.getModel();

    if (!debouncedJsonSearchQuery) {
      setJsonSearchMatches([]);
      setJsonSearchIndex(0);
      return;
    }

    // Search: case-insensitive
    const matches = model.findMatches(debouncedJsonSearchQuery, false, false, false, null, true);
    setJsonSearchMatches(matches);
    setJsonSearchIndex(0);

    if (matches.length > 0) {
      editorRef.current.setSelection(matches[0].range);
      editorRef.current.revealRangeInCenter(matches[0].range);
    }
  }, [debouncedJsonSearchQuery]);

  const handleNextMatch = () => {
    if (jsonSearchMatches.length === 0) return;
    const next = (jsonSearchIndex + 1) % jsonSearchMatches.length;
    setJsonSearchIndex(next);
    editorRef.current.setSelection(jsonSearchMatches[next].range);
    editorRef.current.revealRangeInCenter(jsonSearchMatches[next].range);
  };

  const handlePrevMatch = () => {
    if (jsonSearchMatches.length === 0) return;
    const prev = (jsonSearchIndex - 1 + jsonSearchMatches.length) % jsonSearchMatches.length;
    setJsonSearchIndex(prev);
    editorRef.current.setSelection(jsonSearchMatches[prev].range);
    editorRef.current.revealRangeInCenter(jsonSearchMatches[prev].range);
  };

  // Localized grouping options
  const getGroupingLabel = (field: GroupingField) => {
    const labels: Record<GroupingField, string> = {
      cloudProvider: t('gatrixEdges.cloudProvider'),
      cloudRegion: t('gatrixEdges.cloudRegion'),
    };
    return labels[field];
  };

  const fetchServices = async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setInitialLoading(true);
    }

    setError(null);
    try {
      const allServices = await serviceDiscoveryService.getServices();

      if (!allServices || !Array.isArray(allServices)) {
        console.warn('getServices returned invalid data:', allServices);
        if (!isRefresh) {
          setServices([]);
          setGroups([]);
        }
        return;
      }

      const edgeServices = allServices.filter(
        (s) => s.labels.service === 'gatrix-edge' || s.labels.service === 'edge'
      );

      setServices(edgeServices);
      groupServicesMultiLevel(edgeServices, groupingLevels);

      // If it's a manual refresh and we have expanded instances, refresh their cache status too
      if (isRefresh && expandedInstances.size > 0) {
        expandedInstances.forEach((instanceId) => {
          const instance = edgeServices.find((s) => s.instanceId === instanceId);
          if (instance) {
            fetchCacheStatus(instance);
          }
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch services');
    } finally {
      if (isRefresh) {
        setIsRefreshing(false);
      } else {
        setInitialLoading(false);
      }
    }
  };

  // Multi-level grouping
  const groupServicesMultiLevel = useCallback(
    (services: ServiceInstance[], levels: GroupingField[]) => {
      if (levels.length === 0) {
        setGroups([]);
        setExpandedGroups(new Set());
        return;
      }

      const buildGroups = (
        items: ServiceInstance[],
        remainingLevels: GroupingField[]
      ): EdgeGroup[] => {
        if (remainingLevels.length === 0) {
          return [];
        }

        const currentLevel = remainingLevels[0];
        const nextLevels = remainingLevels.slice(1);

        const groupMap = new Map<string, ServiceInstance[]>();

        items.forEach((service) => {
          const value = service.labels[currentLevel] || 'unknown';
          if (!groupMap.has(value)) {
            groupMap.set(value, []);
          }
          groupMap.get(value)?.push(service);
        });

        return Array.from(groupMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([name, instances]) => {
            const group: EdgeGroup = {
              id: `${currentLevel} -${name} `,
              name: name === 'unknown' ? `(${getGroupingLabel(currentLevel)} N / A)` : name,
              instances:
                nextLevels.length === 0
                  ? instances.sort((a, b) => a.instanceId.localeCompare(b.instanceId))
                  : [],
              children: nextLevels.length > 0 ? buildGroups(instances, nextLevels) : undefined,
            };
            return group;
          });
      };

      const newGroups = buildGroups(services, levels);
      setGroups(newGroups);

      const allGroupIds = new Set<string>();
      const collectIds = (groups: EdgeGroup[]) => {
        groups.forEach((g) => {
          allGroupIds.add(g.id);
          if (g.children) collectIds(g.children);
        });
      };
      collectIds(newGroups);
      setExpandedGroups(allGroupIds);
    },
    [t]
  );

  // Fetch cache status summary for an instance
  const fetchCacheStatus = useCallback(async (instance: ServiceInstance) => {
    const key = instance.instanceId;
    setCacheStatuses((prev) => {
      const next = new Map(prev);
      const current = next.get(key) || { status: 'loading' };
      next.set(key, { ...current, loading: true });
      return next;
    });

    try {
      const serviceType = instance.labels.service;
      const result = await serviceDiscoveryService.getCacheSummary(
        serviceType,
        instance.instanceId
      );
      setCacheStatuses((prev) => {
        const next = new Map(prev);
        next.set(key, { ...result, loading: false });
        return next;
      });
    } catch (err: any) {
      setCacheStatuses((prev) => {
        const next = new Map(prev);
        const current = next.get(key) || { status: 'error' };
        next.set(key, {
          ...current,
          status: 'error',
          error: err.message,
          loading: false,
        });
        return next;
      });
    }
  }, []);

  const handleViewFullJson = async (instance: ServiceInstance) => {
    setFullJsonLoading(instance.instanceId);
    try {
      const serviceType = instance.labels.service;
      const result = await serviceDiscoveryService.getCacheStatus(serviceType, instance.instanceId);
      openJsonDialog(result, t('gatrixEdges.cacheStatus'));
    } catch (err: any) {
      console.error('Failed to fetch full cache status:', err);
    } finally {
      setFullJsonLoading(null);
    }
  };

  // Poll cache status for expanded instances
  useEffect(() => {
    if (cachePollingRef.current) {
      clearInterval(cachePollingRef.current);
    }

    const pollCacheStatuses = () => {
      expandedInstances.forEach((instanceId) => {
        const instance = services.find((s) => s.instanceId === instanceId);
        if (instance) {
          fetchCacheStatus(instance);
        }
      });
    };

    if (expandedInstances.size > 0 && cacheRefreshInterval !== null) {
      pollCacheStatuses();
      cachePollingRef.current = setInterval(pollCacheStatuses, cacheRefreshInterval * 1000);
    }

    return () => {
      if (cachePollingRef.current) {
        clearInterval(cachePollingRef.current);
      }
    };
  }, [expandedInstances, services, fetchCacheStatus, cacheRefreshInterval]);

  // Fetch request stats for an instance
  const fetchRequestStats = useCallback(async (instance: ServiceInstance) => {
    const key = instance.instanceId;
    setRequestStats((prev) => {
      const next = new Map(prev);
      const current = next.get(key) || ({} as RequestStats);
      next.set(key, { ...current, loading: true });
      return next;
    });

    try {
      const serviceType = instance.labels.service;
      const result = await serviceDiscoveryService.getRequestStats(
        serviceType,
        instance.instanceId
      );
      setRequestStats((prev) => {
        const next = new Map(prev);
        next.set(key, {
          ...result.data,
          rateLimit: result.rateLimit,
          latency: result.latency,
          loading: false,
        });
        return next;
      });
    } catch (err: any) {
      setRequestStats((prev) => {
        const next = new Map(prev);
        const current = next.get(key) || ({} as RequestStats);
        next.set(key, { ...current, error: err.message, loading: false });
        return next;
      });
    }
  }, []);

  // Poll request stats for expanded instances
  useEffect(() => {
    if (statsPollingRef.current) {
      clearInterval(statsPollingRef.current);
    }

    const pollRequestStats = () => {
      expandedInstances.forEach((instanceId) => {
        const instance = services.find((s) => s.instanceId === instanceId);
        if (instance) {
          fetchRequestStats(instance);
        }
      });
    };

    if (expandedInstances.size > 0 && statsRefreshInterval !== null) {
      pollRequestStats();
      statsPollingRef.current = setInterval(pollRequestStats, statsRefreshInterval * 1000);
    }

    return () => {
      if (statsPollingRef.current) {
        clearInterval(statsPollingRef.current);
      }
    };
  }, [expandedInstances, services, fetchRequestStats, statsRefreshInterval]);

  // Toggle collapsible section
  const toggleSection = useCallback((instanceId: string, sectionName: string) => {
    setExpandedSections((prev) => {
      const next = new Map(prev);
      const sections = next.get(instanceId) || new Set(['cache', 'stats']); // Default: both expanded
      const newSections = new Set(sections);
      if (newSections.has(sectionName)) {
        newSections.delete(sectionName);
      } else {
        newSections.add(sectionName);
      }
      next.set(instanceId, newSections);
      return next;
    });
  }, []);

  // Check if section is expanded
  const isSectionExpanded = useCallback(
    (instanceId: string, sectionName: string) => {
      const sections = expandedSections.get(instanceId);
      // Default: both expanded if not set
      if (!sections) return true;
      return sections.has(sectionName);
    },
    [expandedSections]
  );

  useEffect(() => {
    fetchServices();
  }, []);

  // Save grouping levels to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('gatrixEdges.groupingLevels', JSON.stringify(groupingLevels));
    } catch (e) {
      console.warn('Failed to save grouping levels to localStorage:', e);
    }
  }, [groupingLevels]);

  useEffect(() => {
    if (services.length > 0) {
      groupServicesMultiLevel(services, groupingLevels);
    }
  }, [groupingLevels, services, groupServicesMultiLevel]);

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const toggleInstance = (instanceId: string) => {
    const newExpanded = new Set(expandedInstances);
    if (newExpanded.has(instanceId)) {
      newExpanded.delete(instanceId);
    } else {
      newExpanded.add(instanceId);
      // Load cache and stats immediately when expanded
      const instance = services.find((s) => s.instanceId === instanceId);
      if (instance) {
        fetchCacheStatus(instance);
        fetchRequestStats(instance);
      }
    }
    setExpandedInstances(newExpanded);
  };

  const handleGroupingChange = (index: number, value: GroupingField | '') => {
    const newLevels = [...groupingLevels];
    if (value === '') {
      newLevels.splice(index);
    } else {
      newLevels[index] = value;
      while (newLevels.length > index + 1) {
        newLevels.pop();
      }
    }
    setGroupingLevels(newLevels);
  };

  const addGroupingLevel = () => {
    const usedLevels = new Set(groupingLevels);
    const available = (['cloudProvider', 'cloudRegion'] as GroupingField[]).find(
      (o) => !usedLevels.has(o)
    );
    if (available) {
      setGroupingLevels([...groupingLevels, available]);
    }
  };

  const openJsonDialog = (data: any, title: string) => {
    setJsonDialogData(data);
    setJsonDialogTitle(title);
    setJsonSearchQuery('');
    setJsonSearchMatches([]);
    setJsonSearchIndex(0);
    setJsonDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
      case 'heartbeat':
        return theme.palette.success.main;
      case 'starting':
      case 'initializing':
        return theme.palette.warning.main;
      case 'error':
      case 'terminated':
        return theme.palette.error.main;
      default:
        return theme.palette.text.disabled;
    }
  };

  const handleCopyJson = () => {
    if (jsonDialogData) {
      const text = JSON.stringify(jsonDialogData, null, 2);
      copyToClipboardWithNotification(text, t('common.copiedToClipboard'));
    }
  };

  // Render cache summary
  const renderCacheSummary = (cacheStatus: CacheStatus | undefined, instance: ServiceInstance) => {
    if (!cacheStatus) {
      return (
        <Typography variant="body2" color="text.secondary">
          {t('gatrixEdges.cacheNotLoaded')}
        </Typography>
      );
    }

    const { summary, lastRefreshedAt, latency, loading, error } = cacheStatus;

    // Extract unique environments for columns
    const allEnvs = new Set<string>();
    if (summary) {
      Object.values(summary).forEach((envCounts) => {
        Object.keys(envCounts as Record<string, number>).forEach((env) => allEnvs.add(env));
      });
    }
    const sortedEnvs = Array.from(allEnvs).sort();

    return (
      <Box sx={{ position: 'relative' }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 1.5,
          }}
        >
          <Typography variant="subtitle2" fontWeight="bold">
            {t('gatrixEdges.cacheStatus')}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                {t('gatrixEdges.refreshInterval')}:
              </Typography>
              <FormControl size="small" sx={{ minWidth: 60 }}>
                <Select
                  value={cacheRefreshInterval === null ? 'off' : cacheRefreshInterval}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCacheRefreshInterval(val === 'off' ? null : Number(val));
                  }}
                  displayEmpty
                  variant="standard"
                  disableUnderline
                  sx={{
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    bgcolor: theme.palette.action.hover,
                    borderRadius: 0,
                    px: 1,
                    py: 0.25,
                    '& .MuiSelect-select': {
                      py: 0,
                      paddingRight: '24px !important',
                    },
                  }}
                >
                  <MenuItem value="off" sx={{ fontSize: '0.8rem' }}>
                    {t('gatrixEdges.refreshOff')}
                  </MenuItem>
                  <MenuItem value={5} sx={{ fontSize: '0.8rem' }}>
                    5{t('gatrixEdges.seconds')}
                  </MenuItem>
                  <MenuItem value={10} sx={{ fontSize: '0.8rem' }}>
                    10{t('gatrixEdges.seconds')}
                  </MenuItem>
                  <MenuItem value={30} sx={{ fontSize: '0.8rem' }}>
                    30{t('gatrixEdges.seconds')}
                  </MenuItem>
                  <MenuItem value={60} sx={{ fontSize: '0.8rem' }}>
                    60{t('gatrixEdges.seconds')}
                  </MenuItem>
                </Select>
              </FormControl>

              <Tooltip title={t('common.refresh')} leaveDelay={0}>
                <span>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      fetchCacheStatus(instance);
                    }}
                    disabled={loading}
                    sx={{ p: 0.5 }}
                  >
                    <RefreshIcon
                      fontSize="small"
                      sx={{
                        animation: loading ? 'spin 1s linear infinite' : 'none',
                        '@keyframes spin': {
                          '0%': {
                            transform: 'rotate(0deg)',
                          },
                          '100%': {
                            transform: 'rotate(360deg)',
                          },
                        },
                      }}
                    />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>

            {latency !== undefined && (
              <Tooltip
                title={
                  lastRefreshedAt
                    ? `${t('gatrixEdges.lastRefreshed')}: ${formatDateTimeDetailed(lastRefreshedAt)} `
                    : ''
                }
              >
                <Chip
                  label={`${latency} ms`}
                  size="small"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.65rem', cursor: 'help' }}
                />
              </Tooltip>
            )}

            <Tooltip title={t('gatrixEdges.viewDetails')} leaveDelay={0}>
              <span>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewFullJson(instance);
                  }}
                  disabled={fullJsonLoading === instance.instanceId}
                >
                  {fullJsonLoading === instance.instanceId ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <VisibilityIcon sx={{ fontSize: 16 }} />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Box>

        {error && (
          <Alert
            severity="error"
            sx={{
              py: 0.2,
              px: 1,
              mb: 1,
              '& .MuiAlert-message': { fontSize: '0.75rem' },
            }}
          >
            {error}
          </Alert>
        )}

        {lastRefreshedAt && (
          <Box
            sx={{
              mb: 1.5,
              p: 1,
              bgcolor: theme.palette.primary.main + '10',
              borderRadius: 0,
              border: `1px solid ${theme.palette.primary.main} 30`,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Typography variant="caption" color="primary" sx={{ fontWeight: 'bold' }}>
              {t('gatrixEdges.latestInvalidation')}: <RelativeTime date={lastRefreshedAt} />
              {cacheStatus.invalidationCount !== undefined && (
                <Box
                  component="span"
                  sx={{
                    fontWeight: 'normal',
                    opacity: 0.8,
                    ml: 0.5,
                    color: 'text.secondary',
                  }}
                >
                  (
                  {t('gatrixEdges.invalidationCountFormat', {
                    count: cacheStatus.invalidationCount,
                  })}
                  )
                </Box>
              )}
            </Typography>
          </Box>
        )}

        {summary && Object.keys(summary).length > 0 ? (
          <Box
            sx={{
              width: '100%',
              overflowX: 'auto',
              mt: 1,
              border: `1px solid ${theme.palette.divider} `,
              borderRadius: 0,
              bgcolor: theme.palette.background.paper,
            }}
          >
            <Table
              size="small"
              sx={{
                minWidth: 400,
                '& th': {
                  fontWeight: 'bold',
                  bgcolor: theme.palette.action.selected,
                  py: 1,
                  fontSize: '0.75rem',
                },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell>Entity</TableCell>
                  {sortedEnvs.map((env) => (
                    <TableCell key={env} align="center">
                      {env}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(summary).map(([category, envCounts]) => (
                  <TableRow
                    key={category}
                    sx={{
                      '& td': { py: 0.75, fontSize: '0.75rem' },
                      '&:nth-of-type(odd)': {
                        bgcolor: theme.palette.action.hover,
                      },
                    }}
                  >
                    <TableCell
                      sx={{
                        color: 'text.secondary',
                        textTransform: 'capitalize',
                        fontWeight: 'bold',
                      }}
                    >
                      {category}
                    </TableCell>
                    {sortedEnvs.map((env) => (
                      <TableCell key={env} align="center">
                        {(envCounts as Record<string, number>)[env] ?? 0}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ) : (
          !loading &&
          !error && (
            <Typography variant="body2" color="text.secondary">
              {t('gatrixEdges.noCacheData')}
            </Typography>
          )
        )}
      </Box>
    );
  };

  // Render instance details
  const renderInstanceDetails = (instance: ServiceInstance) => {
    const { ports, labels, externalAddress, internalAddress, createdAt, updatedAt } = instance;
    const cacheStatus = cacheStatuses.get(instance.instanceId);

    return (
      <Box sx={{ p: 2, bgcolor: theme.palette.action.hover }}>
        {/* Basic Info - Moved to top */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 1,
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
            {t('gatrixEdges.basicInfo')}
          </Typography>
          <Tooltip title={t('gatrixEdges.viewJson')} leaveDelay={0}>
            <IconButton
              size="small"
              onClick={() => openJsonDialog(instance, t('gatrixEdges.basicInfo'))}
            >
              <CodeIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
        <Table size="small" sx={{ mb: 2 }}>
          <TableBody>
            <TableRow sx={{ '& td': { border: 0, py: 0.5 } }}>
              <TableCell sx={{ pl: 0, width: '40%', color: 'text.secondary' }}>
                {t('gatrixEdges.instanceId')}
              </TableCell>
              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                {instance.instanceId}
              </TableCell>
            </TableRow>
            <TableRow sx={{ '& td': { border: 0, py: 0.5 } }}>
              <TableCell sx={{ pl: 0, color: 'text.secondary' }}>
                {t('gatrixEdges.hostname')}
              </TableCell>
              <TableCell>{instance.hostname}</TableCell>
            </TableRow>
            {/* New version fields */}
            {labels?.appVersion && (
              <TableRow sx={{ '& td': { border: 0, py: 0.5 } }}>
                <TableCell sx={{ pl: 0, color: 'text.secondary' }}>
                  {t('gatrixEdges.appVersion')}
                </TableCell>
                <TableCell>
                  <Chip
                    label={labels.appVersion}
                    size="small"
                    sx={{ height: 20, fontSize: '0.75rem' }}
                  />
                </TableCell>
              </TableRow>
            )}
            {labels?.sdkVersion && (
              <TableRow sx={{ '& td': { border: 0, py: 0.5 } }}>
                <TableCell sx={{ pl: 0, color: 'text.secondary' }}>
                  {t('gatrixEdges.sdkVersion')}
                </TableCell>
                <TableCell>
                  <Chip
                    label={labels.sdkVersion}
                    size="small"
                    sx={{ height: 20, fontSize: '0.75rem' }}
                  />
                </TableCell>
              </TableRow>
            )}
            <TableRow sx={{ '& td': { border: 0, py: 0.5 } }}>
              <TableCell sx={{ pl: 0, color: 'text.secondary' }}>
                {t('gatrixEdges.externalAddress')}
              </TableCell>
              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                {externalAddress}
              </TableCell>
            </TableRow>
            <TableRow sx={{ '& td': { border: 0, py: 0.5 } }}>
              <TableCell sx={{ pl: 0, color: 'text.secondary' }}>
                {t('gatrixEdges.internalAddress')}
              </TableCell>
              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                {internalAddress}
              </TableCell>
            </TableRow>
            <TableRow sx={{ '& td': { border: 0, py: 0.5 } }}>
              <TableCell sx={{ pl: 0, color: 'text.secondary' }}>
                {t('gatrixEdges.created')}
              </TableCell>
              <TableCell>
                <RelativeTime date={createdAt} />
              </TableCell>
            </TableRow>
            <TableRow sx={{ '& td': { border: 0, py: 0.5 } }}>
              <TableCell sx={{ pl: 0, color: 'text.secondary' }}>
                {t('gatrixEdges.lastUpdated')}
              </TableCell>
              <TableCell>
                <RelativeTime date={updatedAt} />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        {/* Ports */}
        {ports && Object.keys(ports).length > 0 && (
          <>
            <Typography
              variant="subtitle2"
              sx={{ mb: 1, fontWeight: 'bold', color: 'text.secondary' }}
            >
              {t('gatrixEdges.ports')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              {Object.entries(ports).map(([name, port]) => (
                <Chip
                  key={name}
                  label={`${name}: ${port} `}
                  size="small"
                  variant="outlined"
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    borderRadius: 0,
                  }}
                />
              ))}
            </Box>
          </>
        )}

        {/* Labels */}
        {labels && Object.keys(labels).length > 0 && (
          <>
            <Typography
              variant="subtitle2"
              sx={{ mb: 1, fontWeight: 'bold', color: 'text.secondary' }}
            >
              {t('gatrixEdges.labels')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
              {Object.entries(labels)
                .filter(([k, v]) => v && k !== 'appVersion' && k !== 'sdkVersion')
                .map(([key, value]) => (
                  <Chip
                    key={key}
                    label={`${key}: ${value} `}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ fontSize: '0.75rem' }}
                  />
                ))}
            </Box>
          </>
        )}

        <Divider sx={{ my: 3 }} />

        {/* Cache Status Section - Collapsible */}
        <Box
          sx={{
            mb: 2,
            bgcolor: theme.palette.background.paper,
            borderRadius: 0,
            border: `1px solid ${theme.palette.divider} `,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: 1.5,
              cursor: 'pointer',
              '&:hover': { bgcolor: theme.palette.action.hover },
            }}
            onClick={() => toggleSection(instance.instanceId, 'cache')}
          >
            <CachedIcon fontSize="small" color="primary" />
            <Typography variant="subtitle2" fontWeight="bold" sx={{ flex: 1 }}>
              {t('gatrixEdges.cachingInfo')}
            </Typography>
            {isSectionExpanded(instance.instanceId, 'cache') ? (
              <ExpandLessIcon />
            ) : (
              <ExpandMoreIcon />
            )}
          </Box>
          <Collapse in={isSectionExpanded(instance.instanceId, 'cache')}>
            <Box sx={{ p: 1.5, pt: 0 }}>{renderCacheSummary(cacheStatus, instance)}</Box>
          </Collapse>
        </Box>

        {/* Request Statistics Section - Collapsible */}
        <Box
          sx={{
            bgcolor: theme.palette.background.paper,
            borderRadius: 0,
            border: `1px solid ${theme.palette.divider} `,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: 1.5,
              cursor: 'pointer',
              '&:hover': { bgcolor: theme.palette.action.hover },
            }}
            onClick={() => toggleSection(instance.instanceId, 'stats')}
          >
            <BarChartIcon fontSize="small" color="secondary" />
            <Typography variant="subtitle2" fontWeight="bold" sx={{ flex: 1 }}>
              {t('gatrixEdges.requestStats')}
            </Typography>
            {isSectionExpanded(instance.instanceId, 'stats') ? (
              <ExpandLessIcon />
            ) : (
              <ExpandMoreIcon />
            )}
          </Box>
          <Collapse in={isSectionExpanded(instance.instanceId, 'stats')}>
            <Box sx={{ p: 1.5, pt: 0 }}>
              {renderRequestStatsSummary(requestStats.get(instance.instanceId), instance)}
            </Box>
          </Collapse>
        </Box>
      </Box>
    );
  };

  // Render request statistics summary
  const renderRequestStatsSummary = (
    stats: RequestStats | undefined,
    instance: ServiceInstance
  ) => {
    if (!stats) {
      return (
        <Typography variant="body2" color="text.secondary">
          {t('gatrixEdges.statsNotLoaded')}
        </Typography>
      );
    }

    const {
      endpoints,
      statusCodes,
      totals,
      uptimeSeconds,
      totalRequests,
      loading,
      error,
      latency,
    } = stats;

    // Format bytes
    const formatBytes = (bytes: number) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Format uptime
    const formatUptime = (seconds: number) => {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      if (days > 0) return `${days}d ${hours}h ${mins} m`;
      if (hours > 0) return `${hours}h ${mins} m`;
      return `${mins} m`;
    };

    return (
      <Box sx={{ position: 'relative' }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 1.5,
          }}
        >
          <Typography variant="subtitle2" fontWeight="bold">
            {t('gatrixEdges.requestStats')}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                {t('gatrixEdges.refreshInterval')}:
              </Typography>
              <FormControl size="small" sx={{ minWidth: 60 }}>
                <Select
                  value={statsRefreshInterval === null ? 'off' : statsRefreshInterval}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStatsRefreshInterval(val === 'off' ? null : Number(val));
                  }}
                  displayEmpty
                  variant="standard"
                  disableUnderline
                  sx={{
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    bgcolor: theme.palette.action.hover,
                    borderRadius: 0,
                    px: 1,
                    py: 0.25,
                    '& .MuiSelect-select': {
                      py: 0,
                      paddingRight: '24px !important',
                    },
                  }}
                >
                  <MenuItem value="off" sx={{ fontSize: '0.8rem' }}>
                    {t('gatrixEdges.refreshOff')}
                  </MenuItem>
                  <MenuItem value={5} sx={{ fontSize: '0.8rem' }}>
                    5{t('gatrixEdges.seconds')}
                  </MenuItem>
                  <MenuItem value={10} sx={{ fontSize: '0.8rem' }}>
                    10{t('gatrixEdges.seconds')}
                  </MenuItem>
                  <MenuItem value={30} sx={{ fontSize: '0.8rem' }}>
                    30{t('gatrixEdges.seconds')}
                  </MenuItem>
                  <MenuItem value={60} sx={{ fontSize: '0.8rem' }}>
                    60{t('gatrixEdges.seconds')}
                  </MenuItem>
                </Select>
              </FormControl>

              <Tooltip title={t('common.refresh')} leaveDelay={0}>
                <span>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      fetchRequestStats(instance);
                    }}
                    disabled={loading}
                    sx={{ p: 0.5 }}
                  >
                    <RefreshIcon
                      fontSize="small"
                      sx={{
                        animation: loading ? 'spin 1s linear infinite' : 'none',
                        '@keyframes spin': {
                          '0%': { transform: 'rotate(0deg)' },
                          '100%': { transform: 'rotate(360deg)' },
                        },
                      }}
                    />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>

            {latency !== undefined && (
              <Chip
                label={`${latency} ms`}
                size="small"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.65rem', cursor: 'help' }}
              />
            )}
            <Tooltip title={t('gatrixEdges.viewDetails')} leaveDelay={0}>
              <IconButton
                size="small"
                onClick={() => openJsonDialog(stats, t('gatrixEdges.requestStats'))}
              >
                <VisibilityIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        {error && (
          <Alert
            severity="error"
            sx={{
              py: 0.2,
              px: 1,
              mb: 1,
              '& .MuiAlert-message': { fontSize: '0.75rem' },
            }}
          >
            {error}
          </Alert>
        )}

        {/* Summary Table */}
        <Box
          sx={{
            width: '100%',
            overflowX: 'auto',
            mb: 2,
            border: `1px solid ${theme.palette.divider} `,
            borderRadius: 0,
            bgcolor: theme.palette.background.paper,
          }}
        >
          <Table
            size="small"
            sx={{
              '& th': {
                fontWeight: 'bold',
                bgcolor: theme.palette.action.selected,
                py: 1,
                fontSize: '0.75rem',
              },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell>{t('gatrixEdges.uptime')}</TableCell>
                <TableCell align="right">{t('gatrixEdges.totalRequests')}</TableCell>
                <TableCell align="right">{t('gatrixEdges.avgResponse')}</TableCell>
                <TableCell align="right">Min</TableCell>
                <TableCell align="right">Max</TableCell>
                <TableCell align="right">↑</TableCell>
                <TableCell align="right">↓</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow sx={{ '& td': { py: 0.75, fontSize: '0.75rem' } }}>
                <TableCell sx={{ fontWeight: 'bold' }}>
                  {formatUptime(uptimeSeconds || 0)}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontWeight: 'bold',
                    color: theme.palette.secondary.main,
                  }}
                >
                  {(totalRequests || 0).toLocaleString()}
                </TableCell>
                <TableCell align="right">{totals?.avgDurationMs || 0}ms</TableCell>
                <TableCell align="right">{totals?.minDurationMs || 0}ms</TableCell>
                <TableCell align="right">{totals?.maxDurationMs || 0}ms</TableCell>
                <TableCell align="right">{formatBytes(totals?.bytesSent || 0)}</TableCell>
                <TableCell align="right">{formatBytes(totals?.bytesReceived || 0)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>

        {/* Status Codes Table */}
        {statusCodes && Object.keys(statusCodes).length > 0 && (
          <Box
            sx={{
              width: '100%',
              overflowX: 'auto',
              mb: 2,
              border: `1px solid ${theme.palette.divider} `,
              borderRadius: 0,
              bgcolor: theme.palette.background.paper,
            }}
          >
            <Table
              size="small"
              sx={{
                '& th': {
                  fontWeight: 'bold',
                  bgcolor: theme.palette.action.selected,
                  py: 1,
                  fontSize: '0.75rem',
                },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell colSpan={Object.keys(statusCodes).length + 1}>
                    {t('gatrixEdges.statusCodes')}
                  </TableCell>
                </TableRow>
                <TableRow>
                  {Object.entries(statusCodes)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([code]) => (
                      <TableCell
                        key={code}
                        align="center"
                        sx={{
                          color: code.startsWith('2')
                            ? theme.palette.success.main
                            : code.startsWith('4')
                              ? theme.palette.warning.main
                              : code.startsWith('5')
                                ? theme.palette.error.main
                                : 'inherit',
                        }}
                      >
                        {code}
                      </TableCell>
                    ))}
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow sx={{ '& td': { py: 0.75, fontSize: '0.75rem' } }}>
                  {Object.entries(statusCodes)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([code, count]) => (
                      <TableCell key={code} align="center" sx={{ fontWeight: 'bold' }}>
                        {count.toLocaleString()}
                      </TableCell>
                    ))}
                </TableRow>
              </TableBody>
            </Table>
          </Box>
        )}

        {/* Endpoints Table */}
        {endpoints && Object.keys(endpoints).length > 0 && (
          <Box
            sx={{
              width: '100%',
              overflowX: 'auto',
              border: `1px solid ${theme.palette.divider} `,
              borderRadius: 0,
              bgcolor: theme.palette.background.paper,
            }}
          >
            <Table
              size="small"
              sx={{
                minWidth: 600,
                '& th': {
                  fontWeight: 'bold',
                  bgcolor: theme.palette.action.selected,
                  py: 1,
                  fontSize: '0.7rem',
                },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell>{t('gatrixEdges.endpoint')}</TableCell>
                  <TableCell align="right">{t('gatrixEdges.count')}</TableCell>
                  <TableCell>{t('gatrixEdges.statusCodes')}</TableCell>
                  <TableCell align="right">{t('gatrixEdges.avgMs')}</TableCell>
                  <TableCell align="right">P95</TableCell>
                  <TableCell align="right">P99</TableCell>
                  <TableCell align="right">↑ Sent</TableCell>
                  <TableCell align="right">↓ Recv</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(endpoints)
                  .sort(([, a], [, b]) => b.count - a.count)
                  .slice(0, 20) // Show top 20 endpoints
                  .map(([endpoint, data]) => (
                    <TableRow
                      key={endpoint}
                      sx={{
                        '& td': { py: 0.5, fontSize: '0.7rem' },
                        '&:nth-of-type(odd)': {
                          bgcolor: theme.palette.action.hover,
                        },
                      }}
                    >
                      <TableCell
                        sx={{
                          fontFamily: 'monospace',
                          maxWidth: 250,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <Tooltip title={endpoint}>
                          <span>{endpoint}</span>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        {data.count.toLocaleString()}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {(data as any).statusCodes &&
                          Object.entries((data as any).statusCodes)
                            .sort(([a], [b]) => parseInt(a) - parseInt(b))
                            .map(([code, count]) => (
                              <Chip
                                key={code}
                                label={`${code}: ${(count as number).toLocaleString()} `}
                                size="small"
                                color={
                                  code.startsWith('2')
                                    ? 'success'
                                    : code.startsWith('3')
                                      ? 'info'
                                      : code.startsWith('4')
                                        ? 'warning'
                                        : code.startsWith('5')
                                          ? 'error'
                                          : 'default'
                                }
                                variant="outlined"
                                sx={{
                                  mr: 0.3,
                                  fontSize: '0.6rem',
                                  height: 18,
                                  '& .MuiChip-label': { px: 0.5 },
                                }}
                              />
                            ))}
                      </TableCell>
                      <TableCell align="right">{data.avgDurationMs}</TableCell>
                      <TableCell align="right">{data.p95DurationMs}</TableCell>
                      <TableCell align="right">{data.p99DurationMs}</TableCell>
                      <TableCell align="right">{formatBytes(data.bytesSent)}</TableCell>
                      <TableCell align="right">{formatBytes(data.bytesReceived)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Box>
    );
  };

  // Render instance card
  const renderInstanceCard = (instance: ServiceInstance) => (
    <Card
      key={instance.instanceId}
      variant="outlined"
      sx={{
        borderColor: theme.palette.divider,
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: theme.palette.primary.light,
          boxShadow: theme.shadows[1],
        },
      }}
    >
      <Box
        sx={{
          p: 1.25,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
        onClick={() => toggleInstance(instance.instanceId)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <CircleIcon sx={{ fontSize: 12, color: getStatusColor(instance.status) }} />
          <Box>
            <Typography variant="body2" fontWeight="bold">
              {instance.hostname}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
              ID: {instance.instanceId}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {instance.status === 'ready' ? (
            <Chip
              label={t('gatrixEdges.connected')}
              size="small"
              color="success"
              sx={{ height: 20, fontSize: '0.65rem' }}
            />
          ) : (
            <Chip
              label={
                instance.status === 'no-response' ? t('gatrixEdges.noResponse') : instance.status
              }
              size="small"
              color={instance.status === 'no-response' ? 'error' : 'default'}
              sx={{ height: 20, fontSize: '0.65rem' }}
            />
          )}
          <IconButton size="small">
            {expandedInstances.has(instance.instanceId) ? (
              <KeyboardArrowUp fontSize="small" />
            ) : (
              <KeyboardArrowDown fontSize="small" />
            )}
          </IconButton>
        </Box>
      </Box>

      <Collapse in={expandedInstances.has(instance.instanceId)}>
        {renderInstanceDetails(instance)}
      </Collapse>
    </Card>
  );

  // Recursive group renderer
  const renderGroup = (group: EdgeGroup, depth: number = 0) => {
    const hasChildren = group.children && group.children.length > 0;
    const hasInstances = group.instances && group.instances.length > 0;

    return (
      <Box
        key={group.id}
        sx={{
          ml: depth > 0 ? 3 : 0,
          mt: depth > 0 ? 1 : 0,
          mb: depth === 0 ? 1 : 0,
          position: 'relative',
        }}
      >
        <Card
          sx={{
            border: `1px solid ${theme.palette.divider} `,
            boxShadow: depth === 0 ? theme.shadows[1] : 'none',
          }}
        >
          <Box
            sx={{
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              bgcolor: depth === 0 ? theme.palette.background.paper : theme.palette.action.hover,
              cursor: 'pointer',
              '&:hover': {
                bgcolor: theme.palette.action.selected,
              },
            }}
            onClick={() => toggleGroup(group.id)}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" fontWeight="bold">
                {group.name}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {hasChildren && (
                <Chip
                  label={`${group.children!.length} ${t('gatrixEdges.subgroups')} `}
                  size="small"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              )}
              {hasInstances && (
                <Chip
                  label={`${group.instances.length} ${t('gatrixEdges.instances')} `}
                  size="small"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              )}
              {expandedGroups.has(group.id) ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
            </Box>
          </Box>

          <Collapse in={expandedGroups.has(group.id)}>
            <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
              {/* Child groups */}
              {hasChildren && group.children!.map((child) => renderGroup(child, depth + 1))}

              {/* Instances */}
              {hasInstances && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {group.instances.map(renderInstanceCard)}
                </Box>
              )}

              {!hasChildren && !hasInstances && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ textAlign: 'center', py: 2 }}
                >
                  {t('gatrixEdges.noInstances')}
                </Typography>
              )}
            </CardContent>
          </Collapse>
        </Card>
      </Box>
    );
  };

  // Tree item renderer for flat instances
  const renderInstanceTreeItem = (instance: ServiceInstance, index: number, total: number) => {
    const isFirst = index === 0;
    const isLast = index === total - 1;
    const isOnly = total === 1;

    // Determine if it's the middle element (for odd total) or near middle
    const isMiddle = !isFirst && !isLast;

    return (
      <Box
        key={instance.instanceId}
        sx={{
          position: 'relative',
          px: 1.5, // Increased horizontal padding
          pt: 3, // Increased top space for curve
          width: 550, // Increased width for better readability
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Connector Lines */}
        {!isOnly && (
          <>
            {/* First Item: Curve from Right to Down */}
            {isFirst && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '50%',
                  height: 24,
                  borderTop: `2px solid ${theme.palette.divider} `,
                  borderLeft: `2px solid ${theme.palette.divider} `,
                  borderTopLeftRadius: 12,
                }}
              />
            )}

            {/* Last Item: Curve from Left to Down */}
            {isLast && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '50%',
                  height: 24,
                  borderTop: `2px solid ${theme.palette.divider} `,
                  borderRight: `2px solid ${theme.palette.divider} `,
                  borderTopRightRadius: 12,
                }}
              />
            )}

            {/* Middle Items: T-Shape (Horizontal Bar + Vertical Line) */}
            {isMiddle && (
              <>
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: 2,
                    bgcolor: 'divider',
                  }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 2,
                    height: 24,
                    bgcolor: 'divider',
                  }}
                />
              </>
            )}
          </>
        )}

        {/* Single Item: Straight Line */}
        {isOnly && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 2,
              height: 24,
              bgcolor: 'divider',
            }}
          />
        )}

        <Box sx={{ width: '100%' }}>{renderInstanceCard(instance)}</Box>
      </Box>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 1.5,
          }}
        >
          <Box>
            <Typography
              variant="h4"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                fontWeight: 'bold',
                mb: 0.5,
              }}
            >
              <HubIcon />
              {t('gatrixEdges.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('gatrixEdges.subtitle')}
            </Typography>
          </Box>
          <Button
            startIcon={
              isRefreshing ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />
            }
            variant="contained"
            onClick={() => fetchServices(true)}
            disabled={initialLoading || isRefreshing}
          >
            {t('common.refresh')}
          </Button>
        </Box>

        {/* Compact Grouping Controls - Integrated */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            py: 1.5,
            px: 2,
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
            borderRadius: 0,
            border: `1px solid ${theme.palette.divider} `,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              mr: 0.5,
            }}
          >
            {t('gatrixEdges.groupBy')}
          </Typography>

          {groupingLevels.map((level, index) => (
            <Chip
              key={index}
              label={getGroupingLabel(level)}
              onDelete={() => {
                const newLevels = [...groupingLevels];
                newLevels.splice(index, 1);
                setGroupingLevels(newLevels);
              }}
              size="small"
              sx={{
                height: 24,
                fontSize: '0.75rem',
                fontWeight: 600,
                bgcolor: theme.palette.primary.main,
                color: '#fff',
                '&:hover': {
                  bgcolor: theme.palette.primary.dark,
                },
                '& .MuiChip-deleteIcon': {
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '16px',
                  '&:hover': {
                    color: '#fff',
                  },
                },
              }}
            />
          ))}

          {groupingLevels.length < 2 && (
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value=""
                displayEmpty
                onChange={(e: SelectChangeEvent) => {
                  const value = e.target.value as GroupingField;
                  if (value) {
                    setGroupingLevels([...groupingLevels, value]);
                  }
                }}
                renderValue={() => (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main' }}>
                      {t('gatrixEdges.addGroupBy')}
                    </Typography>
                  </Box>
                )}
                sx={{
                  height: 24,
                  fontSize: '0.75rem',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'transparent',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.light',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                    borderWidth: 1,
                  },
                  '& .MuiSelect-select': {
                    py: 0.5,
                    px: 1,
                  },
                }}
              >
                {(['cloudProvider', 'cloudRegion'] as GroupingField[])
                  .filter((option) => !groupingLevels.includes(option))
                  .map((option) => (
                    <MenuItem key={option} value={option}>
                      {getGroupingLabel(option)}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {initialLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            gap: 0,
          }}
        >
          {/* Root Node with Connector Line Wrapper */}
          <Box
            sx={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              // Add padding bottom if there are services to make space for the line
              pb: services.length > 0 ? 4 : 0,
              // Draw line using pseudo-element for perfect alignment and overlap
              '&::after':
                services.length > 0
                  ? {
                      content: '""',
                      position: 'absolute',
                      bottom: 0,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 2,
                      // Height = padding(32px) + overlap(2px)
                      height: '34px',
                      bgcolor: 'divider',
                      zIndex: 0,
                    }
                  : undefined,
            }}
          >
            <Card
              sx={{
                minWidth: 180,
                textAlign: 'center',
                border: `2px solid ${theme.palette.primary.main} `,
                boxShadow: theme.shadows[2],
                // Ensure card sits on top of the line
                zIndex: 1,
                position: 'relative',
                mb: 0,
              }}
            >
              <CardContent sx={{ pt: 2, pb: 0, '&:last-child': { pb: 0 } }}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      bgcolor: 'primary.main',
                      borderRadius: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                    }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      G
                    </Typography>
                  </Box>
                  <Typography variant="h6" fontWeight="bold">
                    Gatrix Core
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Box>

          {/* Groups container */}
          <Box
            sx={{
              width: '100%',
              maxWidth: groupingLevels.length === 0 ? '100%' : 600,
              display: 'flex',
              flexDirection: groupingLevels.length === 0 ? 'row' : 'column',
              alignItems: groupingLevels.length === 0 ? 'flex-start' : 'center',
              justifyContent: groupingLevels.length === 0 ? 'center' : 'flex-start',
              overflowX: groupingLevels.length === 0 ? 'auto' : 'visible',
            }}
          >
            {groupingLevels.length === 0 ? (
              // Horizontal Tree Layout
              <Box sx={{ display: 'flex', gap: 0, pb: 2 }}>
                {[...services]
                  .sort((a, b) => a.instanceId.localeCompare(b.instanceId))
                  .map((service, index, arr) => renderInstanceTreeItem(service, index, arr.length))}
              </Box>
            ) : (
              groups.map((group, index) => (
                <React.Fragment key={group.id}>
                  <Box
                    sx={{
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 0,
                    }}
                  >
                    {/* Vertical line between groups (not for first group) */}
                    {index > 0 && (
                      <Box
                        sx={{
                          width: 2,
                          height: 16,
                          bgcolor: theme.palette.divider,
                          flexShrink: 0,
                        }}
                      />
                    )}
                    {renderGroup(group, 0)}
                  </Box>
                </React.Fragment>
              ))
            )}

            {services.length === 0 && !initialLoading && (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">{t('gatrixEdges.noEdges')}</Typography>
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* JSON View Dialog */}
      <Dialog
        open={jsonDialogOpen}
        onClose={() => setJsonDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 0,
            minHeight: '70vh',
            maxHeight: '90vh',
            bgcolor: theme.palette.background.paper,
            backgroundImage: 'none',
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 3,
            py: 2.5,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            borderBottom: `1px solid ${theme.palette.divider} `,
            bgcolor: theme.palette.background.default,
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 0,
              bgcolor: theme.palette.primary.main,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <CodeIcon sx={{ color: '#fff', fontSize: 22 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.25 }}>
              {jsonDialogTitle || 'JSON Data'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {jsonDialogData
                ? `${(JSON.stringify(jsonDialogData).length / 1024).toFixed(1)} KB`
                : '—'}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* View Mode Toggle */}
            <ToggleButtonGroup
              value={detailViewMode}
              exclusive
              onChange={(_, newMode) => newMode && setDetailViewMode(newMode)}
              size="small"
              sx={{
                height: 36,
                '& .MuiToggleButton-root': {
                  borderRadius: 0,
                  px: 1.5,
                  textTransform: 'none',
                  fontSize: '0.8rem',
                },
              }}
            >
              <ToggleButton value="table">
                <TableChartIcon sx={{ fontSize: 18, mr: 0.5 }} />
                {t('common.table')}
              </ToggleButton>
              <ToggleButton value="json">
                <CodeIcon sx={{ fontSize: 18, mr: 0.5 }} />
                JSON
              </ToggleButton>
            </ToggleButtonGroup>

            {/* Search - JSON mode only */}
            {detailViewMode === 'json' && (
              <>
                <TextField
                  size="small"
                  placeholder="Find..."
                  value={jsonSearchQuery}
                  onChange={(e) => setJsonSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                    sx: {
                      height: 36,
                      width: 180,
                      fontSize: '0.875rem',
                      bgcolor: theme.palette.background.paper,
                    },
                  }}
                />
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    bgcolor: theme.palette.action.hover,
                    borderRadius: 0,
                    px: 0.5,
                    height: 36,
                    visibility: jsonSearchMatches.length > 0 ? 'visible' : 'hidden',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      mx: 0.5,
                      minWidth: 40,
                      textAlign: 'center',
                      fontWeight: 'bold',
                    }}
                  >
                    {jsonSearchIndex + 1} / {jsonSearchMatches.length}
                  </Typography>
                  <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
                  <IconButton size="small" onClick={handlePrevMatch} sx={{ p: 0.5 }}>
                    <KeyboardArrowUp fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={handleNextMatch} sx={{ p: 0.5 }}>
                    <KeyboardArrowDown fontSize="small" />
                  </IconButton>
                </Box>
              </>
            )}
          </Box>
        </Box>

        {/* Content - Table or JSON */}
        <DialogContent
          sx={{
            p: detailViewMode === 'table' ? 2 : 0,
            bgcolor:
              detailViewMode === 'json'
                ? theme.palette.mode === 'dark'
                  ? '#1e1e1e'
                  : '#ffffff'
                : 'inherit',
            overflow: 'auto',
          }}
        >
          {detailViewMode === 'table' ? (
            <Box
              sx={{
                height: 'calc(70vh - 160px)',
                minHeight: 400,
                overflow: 'auto',
                p: 2,
              }}
            >
              {jsonDialogData &&
                (() => {
                  // Helper: Get color for status code chip
                  const getStatusColor = (
                    code: string
                  ): 'success' | 'info' | 'warning' | 'error' | 'default' => {
                    if (code.startsWith('2')) return 'success';
                    if (code.startsWith('3')) return 'info';
                    if (code.startsWith('4')) return 'warning';
                    if (code.startsWith('5')) return 'error';
                    return 'default';
                  };

                  // Helper: Format bytes
                  const formatBytesLocal = (bytes: number): string => {
                    if (bytes === 0) return '0 B';
                    const k = 1024;
                    const sizes = ['B', 'KB', 'MB', 'GB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                  };

                  // Render primitive value with formatting
                  const renderPrimitive = (val: any, key?: string): React.ReactNode => {
                    if (val === null || val === undefined) {
                      return (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ fontStyle: 'italic' }}
                        >
                          null
                        </Typography>
                      );
                    }
                    // Format based on key hints
                    if (key) {
                      const lowerKey = key.toLowerCase();
                      if (lowerKey.includes('bytes') && typeof val === 'number') {
                        return (
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {formatBytesLocal(val)}
                          </Typography>
                        );
                      }
                      if (
                        (lowerKey.includes('time') || lowerKey.includes('date')) &&
                        typeof val === 'string'
                      ) {
                        try {
                          const date = new Date(val);
                          if (!isNaN(date.getTime())) {
                            return (
                              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                {date.toLocaleString()}
                              </Typography>
                            );
                          }
                        } catch {}
                      }
                      if (lowerKey.includes('duration') && typeof val === 'number') {
                        return (
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {val} ms
                          </Typography>
                        );
                      }
                    }
                    return (
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          wordBreak: 'break-word',
                        }}
                      >
                        {String(val)}
                      </Typography>
                    );
                  };

                  // Render status codes as colored chips
                  const renderStatusCodes = (codes: Record<string, number>): React.ReactNode => {
                    const entries = Object.entries(codes).sort(
                      ([a], [b]) => parseInt(a) - parseInt(b)
                    );
                    return (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {entries.map(([code, count]) => (
                          <Chip
                            key={code}
                            label={`${code}: ${count.toLocaleString()}`}
                            size="small"
                            color={getStatusColor(code)}
                            variant="filled"
                            sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}
                          />
                        ))}
                      </Box>
                    );
                  };

                  // Render endpoints table with expandable rows
                  const renderEndpoints = (endpoints: Record<string, any>): React.ReactNode => {
                    const entries = Object.entries(endpoints).sort(
                      ([, a], [, b]) => (b.count || 0) - (a.count || 0)
                    );
                    return (
                      <Box sx={{ border: `1px solid ${theme.palette.divider}` }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: theme.palette.action.selected }}>
                              <TableCell sx={{ fontWeight: 'bold', width: '35%' }}>
                                {t('gatrixEdges.endpoint')}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                {t('gatrixEdges.count')}
                              </TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>
                                {t('gatrixEdges.statusCodes')}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                Avg
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                P95
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                ↑ Sent
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {entries.map(([endpoint, data]) => (
                              <TableRow
                                key={endpoint}
                                sx={{
                                  '&:nth-of-type(odd)': {
                                    bgcolor: theme.palette.action.hover,
                                  },
                                }}
                              >
                                <TableCell
                                  sx={{
                                    fontFamily: 'monospace',
                                    fontSize: '0.75rem',
                                  }}
                                >
                                  <Tooltip title={endpoint}>
                                    <span>{endpoint}</span>
                                  </Tooltip>
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                  {data.count?.toLocaleString() || 0}
                                </TableCell>
                                <TableCell>
                                  {data.statusCodes && Object.keys(data.statusCodes).length > 0 ? (
                                    renderStatusCodes(data.statusCodes)
                                  ) : (
                                    <Typography variant="caption" color="text.secondary">
                                      -
                                    </Typography>
                                  )}
                                </TableCell>
                                <TableCell align="right">{data.avgDurationMs ?? 0}ms</TableCell>
                                <TableCell align="right">{data.p95DurationMs ?? 0}ms</TableCell>
                                <TableCell align="right">
                                  {formatBytesLocal(data.bytesSent || 0)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Box>
                    );
                  };

                  // Render totals section
                  const renderTotals = (totals: Record<string, any>): React.ReactNode => {
                    return (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                        {Object.entries(totals).map(([key, val]) => (
                          <Box
                            key={key}
                            sx={{
                              p: 1.5,
                              bgcolor: theme.palette.action.hover,
                              border: `1px solid ${theme.palette.divider}`,
                              minWidth: 120,
                              textAlign: 'center',
                            }}
                          >
                            <Typography variant="caption" color="text.secondary" display="block">
                              {key}
                            </Typography>
                            <Typography
                              variant="h6"
                              sx={{
                                fontFamily: 'monospace',
                                fontWeight: 'bold',
                              }}
                            >
                              {key.toLowerCase().includes('bytes')
                                ? formatBytesLocal(val as number)
                                : key.toLowerCase().includes('duration')
                                  ? `${val}ms`
                                  : typeof val === 'number'
                                    ? val.toLocaleString()
                                    : String(val)}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    );
                  };

                  // Render generic object as table
                  const renderObject = (
                    obj: Record<string, any>,
                    level: number = 0
                  ): React.ReactNode => {
                    const entries = Object.entries(obj);
                    return (
                      <Table
                        size="small"
                        sx={{
                          ml: level * 2,
                          '& td': {
                            py: 0.75,
                            fontSize: '0.875rem',
                            borderBottom: `1px solid ${theme.palette.divider}`,
                          },
                        }}
                      >
                        <TableBody>
                          {entries.map(([key, val]) => (
                            <TableRow key={key}>
                              <TableCell
                                sx={{
                                  fontWeight: 'bold',
                                  width: '35%',
                                  fontSize: '0.875rem',
                                  bgcolor:
                                    level === 0
                                      ? theme.palette.action.selected
                                      : theme.palette.action.hover,
                                  verticalAlign: 'top',
                                }}
                              >
                                {key}
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.875rem' }}>
                                {renderAnyValue(val, key, level)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    );
                  };

                  // Main render function for any value
                  const renderAnyValue = (
                    val: any,
                    key?: string,
                    level: number = 0
                  ): React.ReactNode => {
                    // Null/undefined
                    if (val === null || val === undefined) {
                      return (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ fontStyle: 'italic' }}
                        >
                          null
                        </Typography>
                      );
                    }

                    // Primitives
                    if (typeof val !== 'object') {
                      return renderPrimitive(val, key);
                    }

                    // Arrays
                    if (Array.isArray(val)) {
                      if (val.length === 0) {
                        return (
                          <Typography variant="body2" color="text.secondary">
                            [ ]
                          </Typography>
                        );
                      }
                      if (val.every((v) => typeof v !== 'object')) {
                        return (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {val.slice(0, 20).map((item, i) => (
                              <Chip
                                key={i}
                                label={String(item)}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.8rem' }}
                              />
                            ))}
                            {val.length > 20 && (
                              <Chip
                                label={`+${val.length - 20} more`}
                                size="small"
                                color="default"
                              />
                            )}
                          </Box>
                        );
                      }
                      return (
                        <Box
                          component="pre"
                          sx={{
                            m: 0,
                            p: 1,
                            bgcolor: theme.palette.action.hover,
                            fontSize: '0.8rem',
                            fontFamily: 'monospace',
                            maxHeight: 150,
                            overflow: 'auto',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {JSON.stringify(val, null, 2)}
                        </Box>
                      );
                    }

                    // Special handling for known keys
                    const lowerKey = key?.toLowerCase() || '';

                    // Status codes
                    if (
                      lowerKey === 'statuscodes' &&
                      Object.keys(val).every((k) => /^\d+$/.test(k))
                    ) {
                      return renderStatusCodes(val);
                    }

                    // Endpoints
                    if (lowerKey === 'endpoints') {
                      return renderEndpoints(val);
                    }

                    // Totals
                    if (lowerKey === 'totals') {
                      return renderTotals(val);
                    }

                    // Generic objects - expand up to level 2
                    const entries = Object.entries(val);
                    if (entries.length === 0) {
                      return (
                        <Typography variant="body2" color="text.secondary">
                          {'{ }'}
                        </Typography>
                      );
                    }

                    // Small simple objects as chips
                    if (entries.length <= 4 && entries.every(([, v]) => typeof v !== 'object')) {
                      return (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {entries.map(([k, v]) => (
                            <Chip
                              key={k}
                              label={`${k}: ${v}`}
                              size="small"
                              variant="outlined"
                              sx={{
                                fontSize: '0.8rem',
                                fontFamily: 'monospace',
                              }}
                            />
                          ))}
                        </Box>
                      );
                    }

                    // Nested objects - show as collapsible or nested table
                    if (level < 2) {
                      return renderObject(val, level + 1);
                    }

                    // Deep nesting - show as JSON
                    return (
                      <Box
                        component="pre"
                        sx={{
                          m: 0,
                          p: 0.5,
                          bgcolor: theme.palette.action.hover,
                          fontSize: '0.8rem',
                          fontFamily: 'monospace',
                          maxHeight: 100,
                          overflow: 'auto',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {JSON.stringify(val, null, 2)}
                      </Box>
                    );
                  };

                  // Main render
                  return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {Object.entries(jsonDialogData).map(([key, value]) => {
                        const isComplex =
                          typeof value === 'object' &&
                          value !== null &&
                          !Array.isArray(value) &&
                          Object.keys(value).length > 4;

                        return (
                          <Box
                            key={key}
                            sx={{
                              border: `1px solid ${theme.palette.divider}`,
                            }}
                          >
                            <Box
                              sx={{
                                px: 2,
                                py: 1,
                                bgcolor: theme.palette.action.selected,
                                borderBottom: `1px solid ${theme.palette.divider}`,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <Typography variant="subtitle2" fontWeight="bold">
                                {key}
                              </Typography>
                              {typeof value === 'object' && value !== null && (
                                <Chip
                                  label={
                                    Array.isArray(value)
                                      ? `${value.length} items`
                                      : `${Object.keys(value).length} keys`
                                  }
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: '0.65rem', height: 20 }}
                                />
                              )}
                            </Box>
                            <Box sx={{ p: isComplex ? 0 : 2 }}>{renderAnyValue(value, key)}</Box>
                          </Box>
                        );
                      })}
                    </Box>
                  );
                })()}
            </Box>
          ) : (
            <Box sx={{ height: 'calc(70vh - 160px)', minHeight: 400 }}>
              <Editor
                height="100%"
                language="json"
                theme={theme.palette.mode === 'dark' ? 'vs-dark' : 'light'}
                value={JSON.stringify(jsonDialogData, null, 2)}
                onMount={handleEditorDidMount}
                options={{
                  readOnly: true,
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  fontSize: 13,
                  lineNumbers: 'on',
                  automaticLayout: true,
                  padding: { top: 16, bottom: 16 },
                  renderLineHighlight: 'all',
                  wordWrap: 'off',
                  folding: true,
                  scrollbar: {
                    verticalScrollbarSize: 12,
                    horizontalScrollbarSize: 12,
                  },
                }}
              />
            </Box>
          )}
        </DialogContent>

        {/* Footer Actions */}
        <Box
          sx={{
            px: 3,
            py: 2,
            borderTop: `1px solid ${theme.palette.divider} `,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            bgcolor: theme.palette.background.default,
          }}
        >
          <Box />
          {/* Spacer */}
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              startIcon={<CopyIcon />}
              onClick={handleCopyJson}
              sx={{
                borderRadius: 0,
                textTransform: 'none',
              }}
            >
              {t('common.copy')}
            </Button>
            <Button
              variant="contained"
              onClick={() => setJsonDialogOpen(false)}
              sx={{
                borderRadius: 0,
                textTransform: 'none',
              }}
            >
              {t('common.close')}
            </Button>
          </Stack>
        </Box>
      </Dialog>
    </Box>
  );
};

export default GatrixEdgesPage;
