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
  FormControl,
  Select,
  MenuItem,
  SelectChangeEvent,
  Tooltip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  KeyboardArrowDown,
  KeyboardArrowUp,
  Refresh as RefreshIcon,
  Circle as CircleIcon,
  Cached as CachedIcon,
  Dns as DnsIcon,
  Code as CodeIcon,
  ContentCopy as CopyIcon,
  BarChart as BarChartIcon,
  Stream as StreamIcon,
  DeleteSweep as InvalidateIcon,
} from '@mui/icons-material';

import { useTranslation } from 'react-i18next';
import Editor from '@monaco-editor/react';
import serviceDiscoveryService, {
  ServiceInstance,
} from '../../services/serviceDiscoveryService';
import { RelativeTime } from '../../components/common/RelativeTime';
import { useDebounce } from '../../hooks/useDebounce';
import SearchTextField from '../../components/common/SearchTextField';
import PageContentLoader from '../../components/common/PageContentLoader';
import { useSnackbar } from 'notistack';
import { copyToClipboardWithNotification } from '../../utils/clipboard';

// Grouping options - Cloud-related only
type GroupingField = 'cloudProvider' | 'cloudRegion';

interface EdgeGroup {
  id: string;
  name: string;
  instances: ServiceInstance[];
  children?: EdgeGroup[];
}

const GatrixEdgesPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  // States
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [services, setServices] = useState<ServiceInstance[]>([]);
  const [groups, setGroups] = useState<EdgeGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedInstances, setExpandedInstances] = useState<Set<string>>(
    new Set()
  );

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
          parsed.every((item) =>
            ['cloudProvider', 'cloudRegion'].includes(item)
          )
        ) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load grouping levels from localStorage:', e);
    }
    return [];
  });

  // JSON Dialog
  const [jsonDialogOpen, setJsonDialogOpen] = useState(false);
  const [jsonDialogData, setJsonDialogData] = useState<any>(null);
  const [jsonDialogTitle, setJsonDialogTitle] = useState('');
  const [fullJsonLoading, setFullJsonLoading] = useState<string | null>(null);

  // Cache invalidation
  const [cacheInvalidateDialogOpen, setCacheInvalidateDialogOpen] = useState(false);
  const [cacheInvalidateTarget, setCacheInvalidateTarget] = useState<ServiceInstance | null>(null);
  const [cacheInvalidating, setCacheInvalidating] = useState(false);

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
    const matches = model.findMatches(
      debouncedJsonSearchQuery,
      false,
      false,
      false,
      null,
      true
    );
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
    const prev =
      (jsonSearchIndex - 1 + jsonSearchMatches.length) %
      jsonSearchMatches.length;
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
              name:
                name === 'unknown'
                  ? `(${getGroupingLabel(currentLevel)} N / A)`
                  : name,
              instances:
                nextLevels.length === 0
                  ? instances.sort((a, b) =>
                      a.instanceId.localeCompare(b.instanceId)
                    )
                  : [],
              children:
                nextLevels.length > 0
                  ? buildGroups(instances, nextLevels)
                  : undefined,
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

  const handleViewFullJson = async (instance: ServiceInstance) => {
    setFullJsonLoading(instance.instanceId);
    try {
      const serviceType = instance.labels.service;
      const result = await serviceDiscoveryService.getCacheStatus(
        serviceType,
        instance.instanceId
      );
      openJsonDialog(result, t('gatrixEdges.cacheStatus'));
    } catch (err: any) {
      console.error('Failed to fetch full cache status:', err);
    } finally {
      setFullJsonLoading(null);
    }
  };

  // Fetch request stats for an instance and show in dialog
  const handleViewRequestStats = async (instance: ServiceInstance) => {
    try {
      const serviceType = instance.labels.service;
      const result = await serviceDiscoveryService.getRequestStats(
        serviceType,
        instance.instanceId
      );
      openJsonDialog(result, t('gatrixEdges.requestStats'));
    } catch (err: any) {
      console.error('Failed to fetch request stats:', err);
    }
  };

  // Fetch streaming stats for an instance and show in dialog
  const handleViewStreamingStats = async (instance: ServiceInstance) => {
    try {
      const serviceType = instance.labels.service;
      const result = await serviceDiscoveryService.getStreamingStats(
        serviceType,
        instance.instanceId
      );
      openJsonDialog(result, t('gatrixEdges.streamingStats'));
    } catch (err: any) {
      console.error('Failed to fetch streaming stats:', err);
    }
  };

  // Cache invalidation handler
  const handleCacheInvalidate = async () => {
    if (!cacheInvalidateTarget) return;
    setCacheInvalidating(true);
    try {
      const serviceType = cacheInvalidateTarget.labels.service;
      await serviceDiscoveryService.refreshCache(
        serviceType,
        cacheInvalidateTarget.instanceId
      );
      enqueueSnackbar(t('gatrixEdges.cacheInvalidateSuccess'), { variant: 'success' });
    } catch (err: any) {
      console.error('Failed to invalidate cache:', err);
      enqueueSnackbar(t('gatrixEdges.cacheInvalidateFailed'), { variant: 'error' });
    } finally {
      setCacheInvalidating(false);
      setCacheInvalidateDialogOpen(false);
      setCacheInvalidateTarget(null);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  // Save grouping levels to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(
        'gatrixEdges.groupingLevels',
        JSON.stringify(groupingLevels)
      );
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
    const available = (
      ['cloudProvider', 'cloudRegion'] as GroupingField[]
    ).find((o) => !usedLevels.has(o));
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
      copyToClipboardWithNotification(
        text,
        () =>
          enqueueSnackbar(t('common.copiedToClipboard'), {
            variant: 'success',
          }),
        () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
      );
    }
  };

  // Render instance details
  const renderInstanceDetails = (instance: ServiceInstance) => {
    const {
      ports,
      labels,
      externalAddress,
      internalAddress,
      createdAt,
      updatedAt,
    } = instance;

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
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 'bold', color: 'text.secondary' }}
          >
            {t('gatrixEdges.basicInfo')}
          </Typography>
          <Tooltip title={t('gatrixEdges.viewJson')} leaveDelay={0}>
            <IconButton
              size="small"
              onClick={() =>
                openJsonDialog(instance, t('gatrixEdges.basicInfo'))
              }
            >
              <CodeIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
        <Table size="small" sx={{ mb: 2 }}>
          <TableBody>
            <TableRow hover sx={{ '& td': { border: 0, py: 0.5 } }}>
              <TableCell sx={{ pl: 0, width: '40%', color: 'text.secondary' }}>
                {t('gatrixEdges.instanceId')}
              </TableCell>
              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                {instance.instanceId}
              </TableCell>
            </TableRow>
            <TableRow hover sx={{ '& td': { border: 0, py: 0.5 } }}>
              <TableCell sx={{ pl: 0, color: 'text.secondary' }}>
                {t('gatrixEdges.hostname')}
              </TableCell>
              <TableCell>{instance.hostname}</TableCell>
            </TableRow>
            {/* New version fields */}
            {labels?.appVersion && (
              <TableRow hover sx={{ '& td': { border: 0, py: 0.5 } }}>
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
              <TableRow hover sx={{ '& td': { border: 0, py: 0.5 } }}>
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
            <TableRow hover sx={{ '& td': { border: 0, py: 0.5 } }}>
              <TableCell sx={{ pl: 0, color: 'text.secondary' }}>
                {t('gatrixEdges.externalAddress')}
              </TableCell>
              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                {externalAddress}
              </TableCell>
            </TableRow>
            <TableRow hover sx={{ '& td': { border: 0, py: 0.5 } }}>
              <TableCell sx={{ pl: 0, color: 'text.secondary' }}>
                {t('gatrixEdges.internalAddress')}
              </TableCell>
              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                {internalAddress}
              </TableCell>
            </TableRow>
            <TableRow hover sx={{ '& td': { border: 0, py: 0.5 } }}>
              <TableCell sx={{ pl: 0, color: 'text.secondary' }}>
                {t('gatrixEdges.created')}
              </TableCell>
              <TableCell>
                <RelativeTime date={createdAt} />
              </TableCell>
            </TableRow>
            <TableRow hover sx={{ '& td': { border: 0, py: 0.5 } }}>
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
                .filter(
                  ([k, v]) => v && k !== 'appVersion' && k !== 'sdkVersion'
                )
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

        <Divider sx={{ my: 2 }} />

        {/* On-demand view buttons */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={
              fullJsonLoading === instance.instanceId ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <CachedIcon fontSize="small" />
              )
            }
            onClick={() => handleViewFullJson(instance)}
            disabled={fullJsonLoading === instance.instanceId}
            sx={{ fontSize: '0.75rem', textTransform: 'none' }}
          >
            {t('gatrixEdges.cachingInfo')}
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<BarChartIcon fontSize="small" />}
            onClick={() => handleViewRequestStats(instance)}
            sx={{ fontSize: '0.75rem', textTransform: 'none' }}
          >
            {t('gatrixEdges.requestStats')}
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<StreamIcon fontSize="small" />}
            onClick={() => handleViewStreamingStats(instance)}
            sx={{ fontSize: '0.75rem', textTransform: 'none' }}
          >
            {t('gatrixEdges.streamingStats')}
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="warning"
            startIcon={
              cacheInvalidating && cacheInvalidateTarget?.instanceId === instance.instanceId ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <InvalidateIcon fontSize="small" />
              )
            }
            onClick={() => {
              setCacheInvalidateTarget(instance);
              setCacheInvalidateDialogOpen(true);
            }}
            disabled={cacheInvalidating}
            sx={{ fontSize: '0.75rem', textTransform: 'none' }}
          >
            {t('gatrixEdges.cacheInvalidate')}
          </Button>
        </Box>
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
          <CircleIcon
            sx={{ fontSize: 12, color: getStatusColor(instance.status) }}
          />
          <Box>
            <Typography variant="body2" fontWeight="bold">
              {instance.hostname}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontFamily: 'monospace' }}
            >
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
                instance.status === 'no-response'
                  ? t('gatrixEdges.noResponse')
                  : instance.status
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
              bgcolor:
                depth === 0
                  ? theme.palette.background.paper
                  : theme.palette.action.hover,
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
              {expandedGroups.has(group.id) ? (
                <KeyboardArrowUp />
              ) : (
                <KeyboardArrowDown />
              )}
            </Box>
          </Box>

          <Collapse in={expandedGroups.has(group.id)}>
            <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
              {/* Child groups */}
              {hasChildren &&
                group.children!.map((child) => renderGroup(child, depth + 1))}

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
  const renderInstanceTreeItem = (
    instance: ServiceInstance,
    index: number,
    total: number
  ) => {
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
          width: 480, // Width for card readability
          minWidth: 480, // Prevent card from shrinking below readable size
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
              <DnsIcon />
              {t('gatrixEdges.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('gatrixEdges.subtitle')}
            </Typography>
          </Box>
          <Button
            startIcon={
              isRefreshing ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <RefreshIcon />
              )
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
            bgcolor:
              theme.palette.mode === 'dark'
                ? 'rgba(255,255,255,0.02)'
                : 'rgba(0,0,0,0.02)',
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
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 600, color: 'primary.main' }}
                    >
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

      <PageContentLoader loading={initialLoading}>
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
              justifyContent: 'flex-start', // Use flex-start to prevent left truncation on overflow
              overflowX: groupingLevels.length === 0 ? 'auto' : 'visible',
              px: groupingLevels.length === 0 ? 4 : 0, // Add padding to ensure cards don't touch edges
            }}
          >
            {groupingLevels.length === 0 ? (
              // Horizontal Tree Layout
              <Box sx={{ display: 'flex', gap: 0, pb: 2, m: '0 auto' }}>
                {[...services]
                  .sort((a, b) => a.instanceId.localeCompare(b.instanceId))
                  .map((service, index, arr) =>
                    renderInstanceTreeItem(service, index, arr.length)
                  )}
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
                <Typography color="text.secondary">
                  {t('gatrixEdges.noEdges')}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </PageContentLoader>

      {/* Cache Invalidation Confirmation Dialog */}
      <Dialog
        open={cacheInvalidateDialogOpen}
        onClose={() => {
          if (!cacheInvalidating) {
            setCacheInvalidateDialogOpen(false);
            setCacheInvalidateTarget(null);
          }
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <InvalidateIcon color="warning" />
          {t('gatrixEdges.cacheInvalidate')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {t('gatrixEdges.cacheInvalidateConfirm')}
          </Typography>
          {cacheInvalidateTarget && (
            <Chip
              label={`${cacheInvalidateTarget.hostname} (${cacheInvalidateTarget.instanceId})`}
              size="small"
              sx={{ mb: 2, fontFamily: 'monospace', fontSize: '0.75rem' }}
            />
          )}
          <Alert severity="warning" sx={{ mt: 1 }}>
            {t('gatrixEdges.cacheInvalidateWarning')}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setCacheInvalidateDialogOpen(false);
              setCacheInvalidateTarget(null);
            }}
            disabled={cacheInvalidating}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleCacheInvalidate}
            disabled={cacheInvalidating}
            startIcon={
              cacheInvalidating ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <InvalidateIcon />
              )
            }
          >
            {t('gatrixEdges.cacheInvalidate')}
          </Button>
        </DialogActions>
      </Dialog>

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

          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}
          >
            <SearchTextField
              value={jsonSearchQuery}
              onChange={setJsonSearchQuery}
              placeholder="Find..."
            />
            {jsonSearchMatches.length > 0 && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  bgcolor: theme.palette.action.hover,
                  borderRadius: 1,
                  px: 0.5,
                  height: 36,
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
                <IconButton
                  size="small"
                  onClick={handlePrevMatch}
                  sx={{ p: 0.5 }}
                >
                  <KeyboardArrowUp fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={handleNextMatch}
                  sx={{ p: 0.5 }}
                >
                  <KeyboardArrowDown fontSize="small" />
                </IconButton>
              </Box>
            )}
          </Box>
        </Box>

        {/* Content - JSON Only */}
        <DialogContent
          sx={{
            p: 0,
            bgcolor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#ffffff',
            overflow: 'auto',
          }}
        >
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
            <Button startIcon={<CopyIcon />} onClick={handleCopyJson}>
              {t('common.copy')}
            </Button>
            <Button
              variant="contained"
              onClick={() => setJsonDialogOpen(false)}
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
