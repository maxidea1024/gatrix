import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import ClusterView from '../../components/server-list/ClusterView';
import CheckerboardView, {
  StatusStatsDisplay,
} from '../../components/server-list/CheckerboardView';
import {
  getStatusColor,
  HEARTBEAT_TTL_SECONDS,
} from '../../components/server-list/constants';
import { useAuth } from '../../hooks/useAuth';
import { P } from '@/types/permissions';
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
  Chip,
  Divider,
  TextField,
  InputAdornment,
  CircularProgress,
  LinearProgress,
  Alert,
  Badge,
  IconButton,
  Tooltip,
  Popover,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Checkbox,
  Button,
  ClickAwayListener,
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Menu,
  MenuItem,
  ListItemIcon,
  Paper,
  Select,
  useTheme,
} from '@mui/material';
import {
  Dns as DnsIcon,
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HourglassEmpty as HourglassEmptyIcon,
  PowerSettingsNew as PowerSettingsNewIcon,
  Warning as WarningIcon,
  ViewColumn as ViewColumnIcon,
  DragIndicator as DragIndicatorIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
  ViewComfy as ViewComfyIcon,
  BubbleChart as BubbleChartIcon,
  Pause as PauseIcon,
  PlayArrow as PlayArrowIcon,
  CleaningServices as CleaningServicesIcon,
  TouchApp as TouchAppIcon,
  Favorite as FavoriteIcon,
  Refresh as RefreshIcon,
  NetworkCheck as NetworkCheckIcon,
  FileDownload as FileDownloadIcon,
  Apps as AppsIcon,
  HelpOutline as HelpOutlineIcon,
  ContentCopy as ContentCopyIcon,
  OpenInNew as OpenInNewIcon,
  Info as InfoIcon,
  MoreVert as MoreVertIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Add as AddIcon,
  MonitorHeart as MonitorHeartIcon,
  Terminal as TerminalIcon,
} from '@mui/icons-material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import useSWR from 'swr';
import DynamicFilterBar, {
  FilterDefinition,
  ActiveFilter,
} from '../../components/common/DynamicFilterBar';
import { useDebounce } from '../../hooks/useDebounce';
import SearchTextField from '../../components/common/SearchTextField';
import serviceDiscoveryService, {
  ServiceInstance,
} from '../../services/serviceDiscoveryService';
import { formatDateTimeDetailed } from '../../utils/dateFormat';
import { RelativeTime } from '../../components/common/RelativeTime';
import { copyToClipboardWithNotification } from '../../utils/clipboard';
import PageContentLoader from '@/components/common/PageContentLoader';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import PageHeader from '@/components/common/PageHeader';

// View mode type
type ViewMode = 'list' | 'grid' | 'checkerboard' | 'card' | 'cluster';
type ServiceStatus = ServiceInstance['status'];

// Column definition interface
interface ColumnConfig {
  id: string;
  labelKey: string;
  visible: boolean;
  width?: string;
}

import type { GroupingField, GroupingOption } from '../../components/server-list/types';
import { TableVirtuoso, VirtuosoGrid } from 'react-virtuoso';


interface SortableColumnItemProps {
  column: ColumnConfig;
  onToggleVisibility: (id: string) => void;
}

const SortableColumnItem: React.FC<SortableColumnItemProps> = ({
  column,
  onToggleVisibility,
}) => {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <ListItem
      ref={setNodeRef}
      style={style}
      disablePadding
      secondaryAction={
        <Box
          {...attributes}
          {...listeners}
          sx={{
            cursor: 'grab',
            display: 'flex',
            alignItems: 'center',
            '&:active': { cursor: 'grabbing' },
          }}
        >
          <DragIndicatorIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
        </Box>
      }
    >
      <ListItemButton
        dense
        onClick={() => onToggleVisibility(column.id)}
        sx={{ pr: 6 }}
      >
        <Checkbox
          edge="start"
          checked={column.visible}
          tabIndex={-1}
          disableRipple
          size="small"
          icon={<VisibilityOffIcon fontSize="small" />}
          checkedIcon={<VisibilityIcon fontSize="small" />}
        />
        <ListItemText
          primary={t(column.labelKey)}
          slotProps={{ primary: { variant: 'body2' } }}
        />
      </ListItemButton>
    </ListItem>
  );
};

const ServerListPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { hasPermission } = useAuth();
  const theme = useTheme();
  const canManage = hasPermission([P.SERVERS_UPDATE]);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [services, setServices] = useState<ServiceInstance[]>([]);
  const [pendingUpdates, setPendingUpdates] = useState<ServiceInstance[]>([]);

  // Real-time view state (persisted in localStorage)
  const [isPaused, setIsPaused] = useState(() => {
    const saved = localStorage.getItem('serverListRealTimeEnabled');
    // Default to true (real-time enabled), so isPaused = false
    return saved === null ? false : saved === 'false';
  });

  // Track isPaused state in ref for use in SSE event handler
  const isPausedRef = useRef(false);
  useEffect(() => {
    isPausedRef.current = isPaused;
    // Save to localStorage (inverted: realTimeEnabled = !isPaused)
    localStorage.setItem('serverListRealTimeEnabled', (!isPaused).toString());
  }, [isPaused]);

  // Sort state (persisted in localStorage)
  const [sortBy, setSortBy] = useState<string>(() => {
    return localStorage.getItem('serverListSortBy') || 'createdAt';
  });
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => {
    return (
      (localStorage.getItem('serverListSortOrder') as 'asc' | 'desc') || 'asc'
    );
  });

  // View mode state (persisted in localStorage)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('serverListViewMode') as ViewMode) || 'list';
  });

  // Track updated service IDs for highlight effect (with status)
  const [updatedServiceIds, setUpdatedServiceIds] = useState<
    Map<string, ServiceStatus>
  >(new Map());

  // Track newly added service IDs for appearance animation
  const [newServiceIds, setNewServiceIds] = useState<Set<string>>(new Set());

  // Track heartbeat for pulse animation
  const [heartbeatIds, setHeartbeatIds] = useState<Set<string>>(new Set());

  // Cleanup confirmation dialog
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);

  // Health check state: Map<serviceKey, { loading: boolean, cooldown: boolean, fading: boolean, result?: { healthy: boolean, latency: number, error?: string } }>
  const [healthCheckStatus, setHealthCheckStatus] = useState<
    Map<
      string,
      {
        loading: boolean;
        cooldown: boolean;
        fading: boolean;
        result?: { healthy: boolean; latency: number; error?: string };
      }
    >
  >(new Map());

  // Bulk health check dialog state
  const [bulkHealthCheckOpen, setBulkHealthCheckOpen] = useState(false);
  const [bulkHealthCheckResults, setBulkHealthCheckResults] = useState<
    {
      serviceKey: string;
      service: string;
      instanceId: string;
      group?: string;
      env?: string;
      hostname?: string;
      internalIp?: string;
      healthPort?: number;
      status: 'pending' | 'checking' | 'success' | 'failed';
      latency?: number;
      error?: string;
    }[]
  >([]);
  const [bulkHealthCheckRunning, setBulkHealthCheckRunning] = useState(false);
  const [bulkHealthCheckSelected, setBulkHealthCheckSelected] = useState<
    Set<string>
  >(new Set());

  // Track expanded table cells (for labels and ports columns)
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());

  // Multi-level grouping state (persisted in localStorage)
  const [groupingLevels, setGroupingLevels] = useState<GroupingField[]>(() => {
    try {
      const saved = localStorage.getItem('serverListGroupingLevels');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((item) =>
            [
              'service',
              'group',
              'environment',
              'cloudProvider',
              'cloudRegion',
              'cloudZone',
            ].includes(item)
          );
        }
      }
    } catch (e) {
      // Fallback to old single grouping if exists
      const oldGrouping = localStorage.getItem('serverListGroupingBy');
      if (oldGrouping && oldGrouping !== 'none') {
        return [oldGrouping as GroupingField];
      }
    }
    return [];
  });

  // Save grouping levels to localStorage
  useEffect(() => {
    localStorage.setItem(
      'serverListGroupingLevels',
      JSON.stringify(groupingLevels)
    );
  }, [groupingLevels]);

  // Derived groupingBy for backward compatibility with views
  const groupingBy: GroupingOption =
    groupingLevels.length > 0 ? groupingLevels[0] : 'none';
  const setGroupingBy = (option: GroupingOption) => {
    if (option === 'none') {
      setGroupingLevels([]);
    } else {
      setGroupingLevels([option]);
    }
  };

  const [groupingMenuAnchor, setGroupingMenuAnchor] =
    useState<null | HTMLElement>(null);

  // Grouping label helper
  const getGroupingLabel = (field: GroupingField): string => {
    switch (field) {
      case 'service':
        return t('serverList.grouping.service');
      case 'group':
        return t('serverList.grouping.group');
      case 'environment':
        return t('serverList.grouping.environment');
      case 'cloudProvider':
        return t('serverList.grouping.cloudProvider');
      case 'cloudRegion':
        return t('serverList.grouping.cloudRegion');
      case 'cloudZone':
        return t('serverList.grouping.cloudZone');
      default:
        return field;
    }
  };

  // All available grouping fields
  const allGroupingFields: GroupingField[] = [
    'service',
    'group',
    'environment',
    'cloudProvider',
    'cloudRegion',
    'cloudZone',
  ];

  // Default column configuration
  const defaultColumns: ColumnConfig[] = [
    { id: 'status', labelKey: 'serverList.table.status', visible: true },
    { id: 'service', labelKey: 'serverList.table.service', visible: true },
    { id: 'group', labelKey: 'serverList.table.group', visible: true },
    {
      id: 'environment',
      labelKey: 'serverList.table.environment',
      visible: true,
    },
    {
      id: 'cloudProvider',
      labelKey: 'serverList.table.cloudProvider',
      visible: false,
    },
    {
      id: 'cloudRegion',
      labelKey: 'serverList.table.cloudRegion',
      visible: false,
    },
    { id: 'cloudZone', labelKey: 'serverList.table.cloudZone', visible: false },
    { id: 'labels', labelKey: 'serverList.table.labels', visible: true },
    {
      id: 'instanceId',
      labelKey: 'serverList.table.instanceId',
      visible: true,
    },
    { id: 'hostname', labelKey: 'serverList.table.hostname', visible: true },
    {
      id: 'externalAddress',
      labelKey: 'serverList.table.externalAddress',
      visible: false,
    },
    {
      id: 'internalAddress',
      labelKey: 'serverList.table.internalAddress',
      visible: true,
    },
    { id: 'ports', labelKey: 'serverList.table.ports', visible: true },
    { id: 'stats', labelKey: 'serverList.table.stats', visible: false },
    { id: 'meta', labelKey: 'serverList.table.meta', visible: false },
    { id: 'createdAt', labelKey: 'serverList.table.createdAt', visible: true },
    { id: 'updatedAt', labelKey: 'serverList.table.updatedAt', visible: true },
    { id: 'actions', labelKey: 'serverList.table.actions', visible: true },
  ];

  // Column configuration state (persisted in localStorage)
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('serverListColumns');
    if (saved) {
      try {
        const savedColumns = JSON.parse(saved);
        // Merge saved columns with defaults, preserving saved order
        const mergedColumns = savedColumns.map((savedCol: ColumnConfig) => {
          const defaultCol = defaultColumns.find((c) => c.id === savedCol.id);
          return defaultCol ? { ...defaultCol, ...savedCol } : savedCol;
        });

        // Add any new columns from defaults that aren't in saved
        const savedIds = new Set(savedColumns.map((c: ColumnConfig) => c.id));
        const newColumns = defaultColumns.filter((c) => !savedIds.has(c.id));

        return [...mergedColumns, ...newColumns];
      } catch {
        return defaultColumns;
      }
    }
    return defaultColumns;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      if (!isPaused) {
        setCurrentTime(Date.now());
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isPaused]);

  // Column settings popover state
  const [columnSettingsAnchor, setColumnSettingsAnchor] =
    useState<HTMLButtonElement | null>(null);

  // Service context menu state
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    service: ServiceInstance | null;
  } | null>(null);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch initial data (only once, SSE will handle updates)
  const { data, error, isLoading, mutate } = useSWR(
    '/admin/services',
    () => serviceDiscoveryService.getServices(),
    {
      revalidateOnFocus: true, // Refetch when page becomes visible (SSE may have missed events while in background)
      revalidateOnReconnect: true, // Refetch on reconnect
      refreshInterval: 0, // Disable auto-refresh, SSE handles real-time updates
      dedupingInterval: 2000, // Dedupe requests within 2 seconds
    }
  );

  // Fetch service types for filter
  const { data: serviceTypes } = useSWR('/admin/services/types', () =>
    serviceDiscoveryService.getServiceTypes()
  );

  // Sync services from SWR data
  // - On initial load: set services
  // - On focus revalidation: update services with fresh data (in case SSE missed events while in background)
  const initializedRef = useRef(false);

  useEffect(() => {
    if (data) {
      if (!initializedRef.current) {
        // First load
        setServices(data);
        initializedRef.current = true;
      } else {
        // Focus revalidation - merge with current state to preserve any pending animations
        // Replace entire list with fresh data from server
        setServices(data);
      }
    }
  }, [data]);

  // Setup SSE connection for real-time updates (only once on mount)
  useEffect(() => {
    let eventSource: EventSource | null = null;

    // Helper: process a single put/delete event against a services array (mutates nothing, returns new array or null)
    const applySingleEvent = (
      prev: ServiceInstance[],
      eventType: string,
      eventData: ServiceInstance,
      statusChanges: Map<string, ServiceInstance['status']>,
      heartbeats: string[],
      newKeys: string[]
    ): ServiceInstance[] => {
      if (eventType === 'delete') {
        return prev.filter(
          (s) =>
            !(
              s.instanceId === eventData.instanceId &&
              s.labels.service === eventData.labels.service
            )
        );
      }

      // put event
      const serviceKey = `${eventData.labels.service}-${eventData.instanceId}`;
      const index = prev.findIndex(
        (s) =>
          s.instanceId === eventData.instanceId &&
          s.labels.service === eventData.labels.service
      );

      if (index >= 0) {
        // Update existing
        const prevService = prev[index];
        if (prevService.status !== eventData.status) {
          statusChanges.set(serviceKey, eventData.status);
        }
        heartbeats.push(serviceKey);

        const newServices = [...prev];
        newServices[index] = eventData;
        return newServices;
      } else {
        // Add new service
        newKeys.push(serviceKey);
        const newServices = [...prev, eventData];
        newServices.sort((a, b) => {
          const aTime = new Date(a.createdAt).getTime();
          const bTime = new Date(b.createdAt).getTime();
          return aTime - bTime;
        });
        return newServices;
      }
    };

    // Helper: apply animation side effects after batch/single processing
    const applyAnimationEffects = (
      statusChanges: Map<string, ServiceInstance['status']>,
      heartbeats: string[],
      newKeys: string[]
    ) => {
      // Status change highlights
      if (statusChanges.size > 0) {
        setUpdatedServiceIds((prevIds) => {
          const newMap = new Map(prevIds);
          statusChanges.forEach((status, key) => newMap.set(key, status));
          return newMap;
        });
        setTimeout(() => {
          setUpdatedServiceIds((prevIds) => {
            const newMap = new Map(prevIds);
            statusChanges.forEach((_, key) => newMap.delete(key));
            return newMap;
          });
        }, 2000);
      }

      // Heartbeat pulse animations
      if (heartbeats.length > 0) {
        setHeartbeatIds((prevIds) => {
          const newSet = new Set(prevIds);
          heartbeats.forEach((key) => newSet.add(key));
          return newSet;
        });
        setTimeout(() => {
          setHeartbeatIds((prevIds) => {
            const newSet = new Set(prevIds);
            heartbeats.forEach((key) => newSet.delete(key));
            return newSet;
          });
        }, 600);
      }

      // New service appearance animations
      if (newKeys.length > 0) {
        setNewServiceIds((prevIds) => {
          const newSet = new Set(prevIds);
          newKeys.forEach((key) => newSet.add(key));
          return newSet;
        });
        setTimeout(() => {
          setNewServiceIds((prevIds) => {
            const newSet = new Set(prevIds);
            newKeys.forEach((key) => newSet.delete(key));
            return newSet;
          });
        }, 1000);
      }
    };

    try {
      eventSource = serviceDiscoveryService.createSSEConnection(
        (event) => {
          if (event.type === 'init') {
            // Initial/reconnection data - always apply to ensure fresh state
            // This handles both first connection and SSE reconnection after network issues
            setServices(event.data);
            setPendingUpdates([]);
          } else if (event.type === 'batch') {
            // --- Batch event: array of {type, data} entries ---
            // Process all events in a single setServices() call
            const batchEvents = event.data as Array<{
              type: string;
              data: ServiceInstance;
            }>;

            if (isPausedRef.current) {
              // If paused, add all to pending queue
              setPendingUpdates((prev) => {
                let updated = [...prev];
                for (const evt of batchEvents) {
                  if (evt.type === 'put') {
                    const idx = updated.findIndex(
                      (s) =>
                        s.instanceId === evt.data.instanceId &&
                        s.labels.service === evt.data.labels.service
                    );
                    if (idx >= 0) {
                      updated[idx] = evt.data;
                    } else {
                      updated.push(evt.data);
                    }
                  } else if (evt.type === 'delete') {
                    updated = updated.filter(
                      (s) =>
                        !(
                          s.instanceId === evt.data.instanceId &&
                          s.labels.service === evt.data.labels.service
                        )
                    );
                  }
                }
                return updated;
              });
            } else {
              // Not paused - apply all updates in a single setState
              const statusChanges = new Map<
                string,
                ServiceInstance['status']
              >();
              const heartbeats: string[] = [];
              const newKeys: string[] = [];

              setServices((prev) => {
                let current = prev;
                for (const evt of batchEvents) {
                  current = applySingleEvent(
                    current,
                    evt.type,
                    evt.data,
                    statusChanges,
                    heartbeats,
                    newKeys
                  );
                }
                return current;
              });

              applyAnimationEffects(statusChanges, heartbeats, newKeys);
            }
          } else if (isPausedRef.current) {
            // If paused, store updates in pending queue
            setPendingUpdates((prev) => {
              if (event.type === 'put') {
                const index = prev.findIndex(
                  (s) =>
                    s.instanceId === event.data.instanceId &&
                    s.labels.service === event.data.labels.service
                );
                if (index >= 0) {
                  const newPending = [...prev];
                  newPending[index] = event.data;
                  return newPending;
                } else {
                  return [...prev, event.data];
                }
              } else if (event.type === 'delete') {
                return prev.filter(
                  (s) =>
                    !(
                      s.instanceId === event.data.instanceId &&
                      s.labels.service === event.data.labels.service
                    )
                );
              }
              return prev;
            });
          } else {
            // Not paused - apply single update immediately
            const statusChanges = new Map<string, ServiceInstance['status']>();
            const heartbeats: string[] = [];
            const newKeys: string[] = [];

            if (event.type === 'put') {
              setServices((prev) =>
                applySingleEvent(
                  prev,
                  event.type,
                  event.data,
                  statusChanges,
                  heartbeats,
                  newKeys
                )
              );
              applyAnimationEffects(statusChanges, heartbeats, newKeys);
            } else if (event.type === 'delete') {
              // Service deleted/expired - remove from list immediately
              // Terminated services are kept for 5 minutes with TTL, so this only fires after TTL expires
              setServices((prev) =>
                prev.filter(
                  (s) =>
                    !(
                      s.instanceId === event.data.instanceId &&
                      s.labels.service === event.data.labels.service
                    )
                )
              );
            }
          }
        },
        (error) => {
          console.error('SSE error:', error);
        }
      );
    } catch (error) {
      console.error('Failed to create SSE connection:', error);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []); // Empty dependency array - only setup once on mount

  // Apply pending updates when unpausing
  const handleTogglePause = () => {
    if (isPaused && pendingUpdates.length > 0) {
      // Apply all pending updates
      setServices((prev) => {
        let updated = [...prev];
        pendingUpdates.forEach((pendingService) => {
          const index = updated.findIndex(
            (s) =>
              s.instanceId === pendingService.instanceId &&
              s.labels.service === pendingService.labels.service
          );
          if (index >= 0) {
            updated[index] = pendingService;
          } else {
            updated.push(pendingService);
          }
        });
        // Sort by createdAt (ascending - oldest first, newest last)
        updated.sort((a, b) => {
          const aTime = new Date(a.createdAt).getTime();
          const bTime = new Date(b.createdAt).getTime();
          return aTime - bTime;
        });
        return updated;
      });
      setPendingUpdates([]);
    }
    setIsPaused(!isPaused);
  };

  // View mode change handler
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('serverListViewMode', mode);
  };

  // Grouping change handler
  const handleGroupingChange = (option: GroupingOption) => {
    setGroupingBy(option);
    setGroupingMenuAnchor(null);
  };

  // Health check a service
  const handleHealthCheck = async (service: ServiceInstance) => {
    const serviceKey = `${service.labels.service}-${service.instanceId}`;

    // Set loading state
    setHealthCheckStatus((prev) =>
      new Map(prev).set(serviceKey, {
        loading: true,
        cooldown: false,
        fading: false,
      })
    );

    const startFadeOut = () => {
      // Start fading animation after 5 seconds
      setTimeout(() => {
        setHealthCheckStatus((prev) => {
          const current = prev.get(serviceKey);
          if (current) {
            return new Map(prev).set(serviceKey, { ...current, fading: true });
          }
          return prev;
        });
        // Clear result after fade animation (500ms)
        setTimeout(() => {
          setHealthCheckStatus((prev) => {
            const newMap = new Map(prev);
            newMap.delete(serviceKey);
            return newMap;
          });
        }, 500);
      }, 5000);
    };

    try {
      const result = await serviceDiscoveryService.healthCheck(
        service.labels.service,
        service.instanceId
      );

      // Set result and start cooldown
      setHealthCheckStatus((prev) =>
        new Map(prev).set(serviceKey, {
          loading: false,
          cooldown: true,
          fading: false,
          result: {
            healthy: result.healthy,
            latency: result.latency,
            error: result.error,
          },
        })
      );

      startFadeOut();
    } catch (error: any) {
      // Set error result and start cooldown
      setHealthCheckStatus((prev) =>
        new Map(prev).set(serviceKey, {
          loading: false,
          cooldown: true,
          fading: false,
          result: {
            healthy: false,
            latency: 0,
            error: error.message || 'Request failed',
          },
        })
      );

      startFadeOut();
    }
  };

  // Check if service has a web port for health check
  const hasWebPort = (service: ServiceInstance): boolean => {
    const ports = service.ports;
    return !!(
      ports?.internalApi ||
      ports?.externalApi ||
      ports?.web ||
      ports?.http ||
      ports?.api
    );
  };

  // Clean up terminated, error, and no-response servers
  const handleCleanupClick = () => {
    setCleanupDialogOpen(true);
  };

  const handleCleanupConfirm = async () => {
    try {
      console.log('??됰???Starting cleanup...');

      // Call backend cleanup endpoint (handles all terminated/error/no-response servers)
      const result = await serviceDiscoveryService.cleanupServices();

      console.log(
        `??Cleanup complete: ${result.deletedCount}/${result.totalCount} servers deleted`
      );

      // Remove from frontend state immediately
      setServices((prev) =>
        prev.filter(
          (s) =>
            s.status !== 'terminated' &&
            s.status !== 'error' &&
            s.status !== 'no-response'
        )
      );

      // Show success message
      enqueueSnackbar(
        t('serverList.cleanupSuccess', { count: result.deletedCount }),
        {
          variant: 'success',
        }
      );
    } catch (error) {
      console.error('??Cleanup failed:', error);
      enqueueSnackbar(t('serverList.cleanupFailed'), { variant: 'error' });
    } finally {
      // Always close dialog, regardless of success or failure
      setCleanupDialogOpen(false);
    }
  };

  const handleCleanupCancel = () => {
    setCleanupDialogOpen(false);
  };

  // Context menu handlers
  const handleContextMenu = (
    event: React.MouseEvent,
    service: ServiceInstance
  ) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX,
      mouseY: event.clientY,
      service,
    });
  };

  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  const handleCopyServiceJson = () => {
    if (!contextMenu?.service) return;
    const jsonStr = JSON.stringify(contextMenu.service, null, 2);
    copyToClipboardWithNotification(
      jsonStr,
      () =>
        enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
      () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
    );
    handleContextMenuClose();
  };

  const handleCopyInstanceId = () => {
    if (!contextMenu?.service) return;
    copyToClipboardWithNotification(
      contextMenu.service.instanceId,
      () =>
        enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
      () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
    );
    handleContextMenuClose();
  };

  const handleCopyHostname = () => {
    if (!contextMenu?.service) return;
    copyToClipboardWithNotification(
      contextMenu.service.hostname,
      () =>
        enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
      () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
    );
    handleContextMenuClose();
  };

  const handleCopyAddress = () => {
    if (!contextMenu?.service) return;
    copyToClipboardWithNotification(
      contextMenu.service.externalAddress ||
        contextMenu.service.internalAddress,
      () =>
        enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
      () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
    );
    handleContextMenuClose();
  };

  // Bulk health check handlers
  const handleBulkHealthCheckOpen = () => {
    // Filter only checkable services (those with API ports and active status)
    const checkableServices = services.filter((s) => {
      const ports = s.ports;
      const hasApiPort = !!(
        ports?.internalApi ||
        ports?.externalApi ||
        ports?.web ||
        ports?.http ||
        ports?.api
      );
      const isActive = s.status === 'ready' || s.status === 'initializing';
      return hasApiPort && isActive;
    });

    const results = checkableServices.map((s) => {
      const ports = s.ports;
      const healthPort =
        ports?.internalApi ||
        ports?.externalApi ||
        ports?.web ||
        ports?.http ||
        ports?.api;
      return {
        serviceKey: `${s.labels.service}-${s.instanceId}`,
        service: s.labels.service,
        instanceId: s.instanceId,
        group: s.labels.group,
        env: s.labels.environmentId || s.labels.environment,
        hostname: s.hostname,
        internalIp: s.internalAddress,
        healthPort: healthPort,
        status: 'pending' as const,
      };
    });

    setBulkHealthCheckResults(results);
    // Select all by default
    setBulkHealthCheckSelected(new Set(results.map((r) => r.serviceKey)));
    setBulkHealthCheckOpen(true);
  };

  const handleBulkHealthCheckToggle = (serviceKey: string) => {
    setBulkHealthCheckSelected((prev) => {
      const next = new Set(prev);
      if (next.has(serviceKey)) {
        next.delete(serviceKey);
      } else {
        next.add(serviceKey);
      }
      return next;
    });
  };

  const handleBulkHealthCheckSelectAll = () => {
    setBulkHealthCheckSelected(
      new Set(bulkHealthCheckResults.map((r) => r.serviceKey))
    );
  };

  const handleBulkHealthCheckDeselectAll = () => {
    setBulkHealthCheckSelected(new Set());
  };

  const handleBulkHealthCheckStart = async () => {
    setBulkHealthCheckRunning(true);

    const selectedKeys = new Set(bulkHealthCheckSelected);

    // Reset selected items to 'pending' status using functional update to ensure fresh state
    setBulkHealthCheckResults((prev) =>
      prev.map((item) =>
        selectedKeys.has(item.serviceKey)
          ? {
              ...item,
              status: 'pending' as const,
              latency: undefined,
              error: undefined,
            }
          : item
      )
    );

    // Create a list of items to check. We use the current state's list as source of truth.
    // Note: 'itemsToCheck' are just metadata objects provided to the loop.
    const itemsToCheck = bulkHealthCheckResults.filter((item) =>
      selectedKeys.has(item.serviceKey)
    );

    for (const item of itemsToCheck) {
      // Find current index dynamically for scrolling
      const currentIndex = bulkHealthCheckResults.findIndex(
        (r) => r.serviceKey === item.serviceKey
      );

      // Update status to 'checking'
      setBulkHealthCheckResults((prev) =>
        prev.map((r) =>
          r.serviceKey === item.serviceKey
            ? { ...r, status: 'checking' as const }
            : r
        )
      );

      // Auto-scroll logic
      if (currentIndex !== -1) {
        setTimeout(() => {
          const row = document.getElementById(
            `bulk-health-row-${currentIndex}`
          );
          const container = document.getElementById(
            'bulk-health-check-scroll-container'
          );
          if (row && container) {
            const rowTop = row.offsetTop;
            const containerHeight = container.clientHeight;
            const headerHeight = 40;
            const scrollTarget =
              rowTop -
              headerHeight -
              containerHeight / 2 +
              row.offsetHeight / 2;
            container.scrollTo({
              top: Math.max(0, scrollTarget),
              behavior: 'smooth',
            });
          }
        }, 50);
      }

      try {
        const result = await serviceDiscoveryService.healthCheck(
          item.service,
          item.instanceId
        );

        setBulkHealthCheckResults((prev) =>
          prev.map((r) =>
            r.serviceKey === item.serviceKey
              ? {
                  ...r,
                  status: 'success' as const,
                  latency: result.latency,
                  error: result.error,
                }
              : r
          )
        );
      } catch (error: any) {
        setBulkHealthCheckResults((prev) =>
          prev.map((r) =>
            r.serviceKey === item.serviceKey
              ? {
                  ...r,
                  status: 'failed' as const,
                  latency: 0,
                  error: error.message || 'Request failed',
                }
              : r
          )
        );
      }

      // Small delay for UI smoothness
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    setHasCompletedHealthCheck(true);
    setBulkHealthCheckRunning(false);
  };

  const handleBulkHealthCheckClose = () => {
    if (!bulkHealthCheckRunning) {
      setBulkHealthCheckOpen(false);
      setBulkHealthCheckResults([]);
      setBulkHealthCheckSelected(new Set());
      setHasCompletedHealthCheck(false);
    }
  };

  // State for tracking if health check has been completed at least once
  const [hasCompletedHealthCheck, setHasCompletedHealthCheck] = useState(false);

  // Export menu anchor
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(
    null
  );

  const handleExportMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setExportMenuAnchor(event.currentTarget);
  };

  const handleExportMenuClose = () => {
    setExportMenuAnchor(null);
  };

  const handleExportHealthCheck = (format: 'csv' | 'xlsx' | 'json') => {
    handleExportMenuClose();

    const exportData = bulkHealthCheckResults.map((item) => ({
      service: item.service,
      group: item.group || '',
      env: item.env || '',
      hostname: item.hostname || '',
      internalIp: item.internalIp || '',
      port: item.healthPort || '',
      status: item.status,
      latency: item.latency || '',
      error: item.error || '',
    }));

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);
    const filename = `health-check-${timestamp}`;

    if (format === 'json') {
      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'csv') {
      const headers = [
        'Service',
        'Group',
        'Environment',
        'Hostname',
        'Internal IP',
        'Port',
        'Status',
        'Latency (ms)',
        'Error',
      ];
      const csvRows = [
        headers.join(','),
        ...exportData.map((row) =>
          [
            row.service,
            row.group,
            row.env,
            row.hostname,
            row.internalIp,
            row.port,
            row.status,
            row.latency,
            `"${row.error}"`,
          ].join(',')
        ),
      ];
      const csvStr = csvRows.join('\n');
      const blob = new Blob(['\uFEFF' + csvStr], {
        type: 'text/csv;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'xlsx') {
      // For xlsx, we'll use a simple approach with csv-like data
      // In production, you might want to use a library like xlsx or exceljs
      import('xlsx')
        .then((XLSX) => {
          const ws = XLSX.utils.json_to_sheet(
            exportData.map((row) => ({
              Service: row.service,
              Group: row.group,
              Environment: row.env,
              Hostname: row.hostname,
              'Internal IP': row.internalIp,
              Port: row.port,
              Status: row.status,
              'Latency (ms)': row.latency,
              Error: row.error,
            }))
          );
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Health Check Results');
          XLSX.writeFile(wb, `${filename}.xlsx`);
        })
        .catch(() => {
          enqueueSnackbar(t('common.exportFailed'), { variant: 'error' });
        });
    }
  };

  // Bulk health check statistics
  const bulkHealthCheckStats = useMemo(() => {
    const total = bulkHealthCheckResults.length;
    const success = bulkHealthCheckResults.filter(
      (r) => r.status === 'success'
    ).length;
    const failed = bulkHealthCheckResults.filter(
      (r) => r.status === 'failed'
    ).length;
    const pending = bulkHealthCheckResults.filter(
      (r) => r.status === 'pending'
    ).length;
    const checking = bulkHealthCheckResults.filter(
      (r) => r.status === 'checking'
    ).length;
    const completed = success + failed;
    const avgLatency =
      bulkHealthCheckResults
        .filter((r) => r.status === 'success' && r.latency)
        .reduce((acc, r) => acc + (r.latency || 0), 0) / (success || 1);

    return { total, success, failed, pending, checking, completed, avgLatency };
  }, [bulkHealthCheckResults]);

  // Extract unique values from current services for filter options
  const uniqueServices = useMemo(
    () => [...new Set(services.map((s) => s.labels.service))].sort(),
    [services]
  );
  const uniqueInstanceIds = useMemo(
    () => [...new Set(services.map((s) => s.instanceId))].sort(),
    [services]
  );
  const uniqueStatuses = useMemo(
    () => [...new Set(services.map((s) => s.status))].sort(),
    [services]
  );
  const uniqueGroups = useMemo(
    () =>
      [
        ...new Set(services.map((s) => s.labels.group).filter(Boolean)),
      ].sort() as string[],
    [services]
  );
  const uniqueCloudProviders = useMemo(
    () =>
      [
        ...new Set(services.map((s) => s.labels.cloudProvider).filter(Boolean)),
      ].sort() as string[],
    [services]
  );
  const uniqueCloudRegions = useMemo(
    () =>
      [
        ...new Set(services.map((s) => s.labels.cloudRegion).filter(Boolean)),
      ].sort() as string[],
    [services]
  );
  const uniqueCloudZones = useMemo(
    () =>
      [
        ...new Set(services.map((s) => s.labels.cloudZone).filter(Boolean)),
      ].sort() as string[],
    [services]
  );
  const uniqueEnvs = useMemo(
    () =>
      [
        ...new Set(
          services
            .map((s) => s.labels.environmentId || s.labels.environment)
            .filter(Boolean)
        ),
      ].sort() as string[],
    [services]
  );
  const uniqueRoles = useMemo(
    () =>
      [
        ...new Set(services.map((s) => s.labels.role).filter(Boolean)),
      ].sort() as string[],
    [services]
  );
  const uniqueInternalAddresses = useMemo(
    () =>
      [
        ...new Set(services.map((s) => s.internalAddress).filter(Boolean)),
      ].sort(),
    [services]
  );
  const uniqueExternalAddresses = useMemo(
    () =>
      [
        ...new Set(services.map((s) => s.externalAddress).filter(Boolean)),
      ].sort(),
    [services]
  );
  const uniqueHostnames = useMemo(
    () => [...new Set(services.map((s) => s.hostname).filter(Boolean))].sort(),
    [services]
  );

  // Status label mapping
  const statusLabels: Record<string, string> = {
    initializing: t('serverList.status.initializing'),
    ready: t('serverList.status.ready'),
    shutting_down: t('serverList.status.shuttingDown'),
    error: t('serverList.status.error'),
    terminated: t('serverList.status.terminated'),
    'no-response': t('serverList.status.noResponse'),
    busy: t('serverList.status.busy'),
  };

  // Filter configuration
  const availableFilterDefinitions: FilterDefinition[] = [
    {
      key: 'service',
      label: t('serverList.filters.service'),
      type: 'select',
      options: uniqueServices.map((type) => ({ value: type, label: type })),
    },
    {
      key: 'status',
      label: t('serverList.filters.status'),
      type: 'select',
      options: uniqueStatuses.map((status) => ({
        value: status,
        label: statusLabels[status] || status,
      })),
    },
    {
      key: 'instanceId',
      label: t('serverList.filters.instanceId'),
      type: 'select',
      options: uniqueInstanceIds.map((id) => ({ value: id, label: id })),
    },
    {
      key: 'group',
      label: t('serverList.filters.group'),
      type: 'select',
      options: uniqueGroups.map((g) => ({ value: g, label: g })),
    },
    {
      key: 'cloudProvider',
      label: t('serverList.filters.cloudProvider'),
      type: 'select',
      options: uniqueCloudProviders.map((p) => ({ value: p, label: p })),
    },
    {
      key: 'cloudRegion',
      label: t('serverList.filters.cloudRegion'),
      type: 'select',
      options: uniqueCloudRegions.map((r) => ({ value: r, label: r })),
    },
    {
      key: 'cloudZone',
      label: t('serverList.filters.cloudZone'),
      type: 'select',
      options: uniqueCloudZones.map((z) => ({ value: z, label: z })),
    },
    {
      key: 'env',
      label: t('serverList.filters.env'),
      type: 'select',
      options: uniqueEnvs.map((e) => ({ value: e, label: e })),
    },
    {
      key: 'role',
      label: t('serverList.filters.role'),
      type: 'select',
      options: uniqueRoles.map((r) => ({ value: r, label: r })),
    },
    {
      key: 'hostname',
      label: t('serverList.filters.hostname'),
      type: 'select',
      options: uniqueHostnames.map((h) => ({ value: h, label: h })),
    },
    {
      key: 'internalAddress',
      label: t('serverList.filters.internalAddress'),
      type: 'select',
      options: uniqueInternalAddresses.map((a) => ({ value: a, label: a })),
    },
    {
      key: 'externalAddress',
      label: t('serverList.filters.externalAddress'),
      type: 'select',
      options: uniqueExternalAddresses.map((a) => ({ value: a, label: a })),
    },
  ];

  // Filter handlers - use functional updates to avoid stale closure issues
  const handleFilterAdd = (filter: ActiveFilter) => {
    setActiveFilters((prev) => [...prev, filter]);
  };

  const handleFilterRemove = (filterKey: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.key !== filterKey));
  };

  const handleFilterChange = (filterKey: string, value: any) => {
    setActiveFilters((prev) =>
      prev.map((f) => (f.key === filterKey ? { ...f, value } : f))
    );
  };

  // Column configuration handlers
  const handleToggleColumnVisibility = (columnId: string) => {
    const newColumns = columns.map((col) =>
      col.id === columnId ? { ...col, visible: !col.visible } : col
    );
    setColumns(newColumns);
    localStorage.setItem('serverListColumns', JSON.stringify(newColumns));
  };

  const handleResetColumns = () => {
    setColumns(defaultColumns);
    localStorage.setItem('serverListColumns', JSON.stringify(defaultColumns));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = columns.findIndex((col) => col.id === active.id);
      const newIndex = columns.findIndex((col) => col.id === over.id);

      const newColumns = arrayMove(columns, oldIndex, newIndex);
      setColumns(newColumns);
      localStorage.setItem('serverListColumns', JSON.stringify(newColumns));
    }
  };

  // Handle sort
  const handleSort = (columnId: string) => {
    if (sortBy === columnId) {
      const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      setSortOrder(newOrder);
      localStorage.setItem('serverListSortOrder', newOrder);
    } else {
      setSortBy(columnId);
      setSortOrder('asc');
      localStorage.setItem('serverListSortBy', columnId);
      localStorage.setItem('serverListSortOrder', 'asc');
    }
  };

  // Count inactive services (terminated, error, no-response)
  const inactiveCount = services.filter(
    (s) =>
      s.status === 'terminated' ||
      s.status === 'error' ||
      s.status === 'no-response'
  ).length;

  // Apply filters and search
  const filteredServices = services.filter((service) => {
    // Search filter
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      const matchesSearch =
        service.instanceId.toLowerCase().includes(searchLower) ||
        service.labels.service.toLowerCase().includes(searchLower) ||
        (service.labels.group &&
          service.labels.group.toLowerCase().includes(searchLower)) ||
        service.hostname.toLowerCase().includes(searchLower) ||
        service.externalAddress.toLowerCase().includes(searchLower) ||
        service.internalAddress.toLowerCase().includes(searchLower) ||
        Object.entries(service.labels).some(
          ([key, value]) => value && value.toLowerCase().includes(searchLower)
        ) ||
        // Search in ports (name:port format)
        Object.entries(service.ports || {}).some(
          ([name, port]) =>
            name.toLowerCase().includes(searchLower) ||
            String(port).includes(searchLower)
        );
      if (!matchesSearch) return false;
    }

    // Dynamic filters (all are now select type with exact match)
    for (const filter of activeFilters) {
      if (
        filter.key === 'service' &&
        filter.value &&
        service.labels.service !== filter.value
      ) {
        return false;
      }
      if (
        filter.key === 'status' &&
        filter.value &&
        service.status !== filter.value
      ) {
        return false;
      }
      if (
        filter.key === 'instanceId' &&
        filter.value &&
        service.instanceId !== filter.value
      ) {
        return false;
      }
      if (
        filter.key === 'group' &&
        filter.value &&
        service.labels.group !== filter.value
      ) {
        return false;
      }
      if (
        filter.key === 'region' &&
        filter.value &&
        service.labels.region !== filter.value
      ) {
        return false;
      }
      if (
        filter.key === 'env' &&
        filter.value &&
        (service.labels.environmentId || service.labels.environment) !==
          filter.value
      ) {
        return false;
      }
      if (
        filter.key === 'role' &&
        filter.value &&
        service.labels.role !== filter.value
      ) {
        return false;
      }
      if (
        filter.key === 'hostname' &&
        filter.value &&
        service.hostname !== filter.value
      ) {
        return false;
      }
      if (
        filter.key === 'internalAddress' &&
        filter.value &&
        service.internalAddress !== filter.value
      ) {
        return false;
      }
      if (
        filter.key === 'externalAddress' &&
        filter.value &&
        service.externalAddress !== filter.value
      ) {
        return false;
      }
    }

    return true;
  });

  // Status counters - computed from filtered services
  const statusCounts = useMemo(() => {
    const counts = {
      initializing: 0,
      ready: 0,
      shutting_down: 0,
      terminated: 0,
      error: 0,
    };
    filteredServices.forEach((s) => {
      if (s.status === 'initializing') counts.initializing++;
      else if (s.status === 'ready') counts.ready++;
      else if (s.status === 'shutting_down') counts.shutting_down++;
      else if (s.status === 'terminated') counts.terminated++;
      else if (s.status === 'error' || s.status === 'no-response')
        counts.error++;
    });
    return counts;
  }, [filteredServices]);

  // Apply sorting for table view
  const displayServices = [...filteredServices].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    // Handle labels fields
    if (sortBy === 'service') {
      aValue = a.labels.service;
      bValue = b.labels.service;
    } else if (sortBy === 'group') {
      aValue = a.labels.group;
      bValue = b.labels.group;
    } else {
      aValue = a[sortBy as keyof ServiceInstance];
      bValue = b[sortBy as keyof ServiceInstance];
    }

    // Handle special cases
    if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
      aValue = new Date(aValue).getTime();
      bValue = new Date(bValue).getTime();
    }

    if (aValue === undefined || aValue === null) return 1;
    if (bValue === undefined || bValue === null) return -1;

    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Grid/Card view always sorted by createdAt ascending (oldest first, newest last)
  // This prevents visual disruption when new servers are added
  const gridDisplayServices = [...filteredServices].sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return aTime - bTime;
  });

  // Status badge component
  const getStatusBadge = (status: ServiceInstance['status']) => {
    const statusConfig = {
      ready: {
        color: 'success' as const,
        icon: <CheckCircleIcon sx={{ fontSize: 16 }} />,
        label: t('serverList.status.ready'),
        tooltipKey: 'ready',
      },
      error: {
        color: 'error' as const,
        icon: <ErrorIcon sx={{ fontSize: 16 }} />,
        label: t('serverList.status.error'),
        tooltipKey: 'error',
      },
      initializing: {
        color: 'warning' as const,
        icon: (
          <SearchIcon
            sx={{
              fontSize: 16,
              animation: 'searchingAnimSmall 2s ease-in-out infinite',
              '@keyframes searchingAnimSmall': {
                '0%': { transform: 'translate(0, 0) rotate(0deg)' },
                '25%': { transform: 'translate(1px, -1px) rotate(10deg)' },
                '50%': { transform: 'translate(-1px, 1px) rotate(-10deg)' },
                '75%': { transform: 'translate(1px, 1px) rotate(10deg)' },
                '100%': { transform: 'translate(0, 0) rotate(0deg)' },
              },
            }}
          />
        ),
        label: t('serverList.status.initializing'),
        tooltipKey: 'initializing',
      },
      shutting_down: {
        color: 'info' as const,
        icon: <PowerSettingsNewIcon sx={{ fontSize: 16 }} />,
        label: t('serverList.status.shuttingDown'),
        tooltipKey: 'shuttingDown',
      },
      terminated: {
        color: 'default' as const,
        icon: <PowerSettingsNewIcon sx={{ fontSize: 16 }} />,
        label: t('serverList.status.terminated'),
        tooltipKey: 'terminated',
      },
      'no-response': {
        color: 'warning' as const,
        icon: <WarningIcon sx={{ fontSize: 16 }} />,
        label: t('serverList.status.noResponse'),
        tooltipKey: 'noResponse',
      },
    };

    const config = statusConfig[status];
    if (!config) {
      return (
        <Chip
          label={status}
          color="default"
          size="small"
          sx={{ fontWeight: 600 }}
        />
      );
    }

    return (
      <Tooltip
        title={t(`serverList.statusTooltip.${config.tooltipKey}`)}
        arrow
        placement="top"
      >
        <Chip
          icon={config.icon}
          label={config.label}
          color={config.color}
          size="small"
          sx={{ fontWeight: 600 }}
        />
      </Tooltip>
    );
  };
  // Refs for stable TableVirtuoso components (prevents unmount/remount on state changes)
  const updatedServiceIdsRef = useRef(updatedServiceIds);
  updatedServiceIdsRef.current = updatedServiceIds;
  const handleContextMenuRef = useRef(handleContextMenu);
  handleContextMenuRef.current = handleContextMenu;

  const virtuosoTableComponents = useMemo(
    () => ({
      Table: (props: React.HTMLAttributes<HTMLTableElement> & { style?: React.CSSProperties }) => (
        <Table
          {...props}
          stickyHeader
          size="small"
          style={{ ...props.style, borderCollapse: 'separate' }}
        />
      ),
      TableHead: React.forwardRef<HTMLTableSectionElement>((props, ref) => (
        <TableHead {...props} ref={ref} />
      )),
      TableRow: (props: any) => {
        const service = props.item as ServiceInstance | undefined;
        if (!service) return <TableRow {...props} />;
        const serviceKey = `${service.labels.service}-${service.instanceId}`;
        const updatedStatus = updatedServiceIdsRef.current.get(serviceKey);
        const isUpdated = updatedStatus !== undefined;
        const highlightStatus = updatedStatus || service.status;
        return (
          <TableRow
            {...props}
            hover
            onContextMenu={(e: React.MouseEvent) =>
              handleContextMenuRef.current(e, service)
            }
            sx={{
              bgcolor: isUpdated
                ? (t: any) => getHighlightColor(highlightStatus, t)
                : (t: any) => getStatusBgColor(service.status, t),
              transition: 'background-color 0.2s ease',
            }}
          />
        );
      },
      TableBody: React.forwardRef<HTMLTableSectionElement>((props, ref) => (
        <TableBody {...props} ref={ref} />
      )),
    }),
    [] // Empty deps = stable reference, uses refs for dynamic data
  );

  const renderHeartbeatIcon = (
    service: ServiceInstance,
    size = 26,
    iconSize = 14
  ) => {
    const serviceKey = `${service.labels.service}-${service.instanceId}`;
    const isActive = heartbeatIds.has(serviceKey);
    const statusColor = getStatusColor(service.status);

    // Determine which icon to show based on status
    const getIcon = () => {
      const sx = {
        fontSize: iconSize,
        color: statusColor,
      };
      switch (service.status) {
        case 'ready':
          return (
            <FavoriteIcon
              sx={{
                ...sx,
                color: isActive ? 'error.main' : statusColor,
                animation: isActive
                  ? 'heartbeat 0.6s ease-in-out infinite'
                  : 'none',
                '@keyframes heartbeat': {
                  '0%': { transform: 'scale(1)' },
                  '25%': { transform: 'scale(1.3)' },
                  '50%': { transform: 'scale(1)' },
                  '75%': { transform: 'scale(1.2)' },
                  '100%': { transform: 'scale(1)' },
                },
              }}
            />
          );
        case 'initializing':
          return <HourglassEmptyIcon sx={sx} />;
        case 'error':
          return <ErrorIcon sx={sx} />;
        case 'shutting_down':
          return <PowerSettingsNewIcon sx={sx} />;
        case 'terminated':
          return <PowerSettingsNewIcon sx={sx} />;
        case 'no-response':
          return <WarningIcon sx={sx} />;
        default:
          return <InfoIcon sx={sx} />;
      }
    };

    return (
      <Box
        sx={{
          width: size,
          height: size,
          borderRadius: '50% !important',
          border: '1px solid',
          borderColor:
            service.status === 'ready' && isActive
              ? 'error.main'
              : alpha(statusColor, 0.3),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.paper',
          flexShrink: 0,
        }}
      >
        {getIcon()}
      </Box>
    );
  };

  const getStatusLabelText = (status: ServiceStatus) => {
    switch (status) {
      case 'ready':
        return t('serverList.status.ready');
      case 'error':
        return t('serverList.status.error');
      case 'initializing':
        return t('serverList.status.initializing');
      case 'shutting_down':
        return t('serverList.status.shuttingDown');
      case 'terminated':
        return t('serverList.status.terminated');
      case 'no-response':
        return t('serverList.status.noResponse');
      default:
        return status;
    }
  };

  // Type chip component
  const getTypeChip = (type: string) => {
    return (
      <Chip
        label={type}
        size="small"
        variant="outlined"
        sx={{ fontWeight: 600 }}
      />
    );
  };

  // Get background color based on status (for normal state)
  const getStatusBgColor = (status: ServiceStatus, theme: any) => {
    const isDark = theme.palette.mode === 'dark';
    switch (status) {
      case 'ready':
        return 'transparent'; // Online - keep current color (no tint)
      case 'initializing':
        return isDark
          ? alpha(theme.palette.warning.main, 0.06)
          : alpha(theme.palette.warning.main, 0.04);
      case 'shutting_down':
        return isDark
          ? alpha(theme.palette.info.main, 0.06)
          : alpha(theme.palette.info.main, 0.04);
      case 'error':
        return isDark
          ? alpha(theme.palette.error.main, 0.08)
          : alpha(theme.palette.error.main, 0.05);
      case 'terminated':
        return isDark
          ? alpha(theme.palette.grey[500], 0.08)
          : alpha(theme.palette.grey[500], 0.05);
      case 'no-response':
        return isDark
          ? alpha(theme.palette.warning.main, 0.08)
          : alpha(theme.palette.warning.main, 0.05);
      default:
        return 'transparent';
    }
  };

  // Get highlight color based on status (for update animation)
  const getHighlightColor = (status: ServiceStatus, theme: any) => {
    const isDark = theme.palette.mode === 'dark';
    switch (status) {
      case 'initializing':
        return isDark
          ? alpha(theme.palette.warning.main, 0.12)
          : alpha(theme.palette.warning.main, 0.08);
      case 'ready':
        return isDark
          ? alpha(theme.palette.success.main, 0.12)
          : alpha(theme.palette.success.main, 0.08);
      case 'shutting_down':
        return isDark
          ? alpha(theme.palette.info.main, 0.12)
          : alpha(theme.palette.info.main, 0.08);
      case 'error':
        return isDark
          ? alpha(theme.palette.error.main, 0.12)
          : alpha(theme.palette.error.main, 0.08);
      case 'terminated':
        return isDark
          ? alpha(theme.palette.grey[500], 0.12)
          : alpha(theme.palette.grey[500], 0.08);
      default:
        return isDark
          ? alpha(theme.palette.primary.main, 0.12)
          : alpha(theme.palette.primary.main, 0.08);
    }
  };

  const getHighlightColorStart = (status: ServiceStatus, theme: any) => {
    const isDark = theme.palette.mode === 'dark';
    switch (status) {
      case 'initializing':
        return isDark
          ? alpha(theme.palette.warning.main, 0.2)
          : alpha(theme.palette.warning.main, 0.15);
      case 'ready':
        return isDark
          ? alpha(theme.palette.success.main, 0.2)
          : alpha(theme.palette.success.main, 0.15);
      case 'shutting_down':
        return isDark
          ? alpha(theme.palette.info.main, 0.2)
          : alpha(theme.palette.info.main, 0.15);
      case 'error':
        return isDark
          ? alpha(theme.palette.error.main, 0.2)
          : alpha(theme.palette.error.main, 0.15);
      case 'terminated':
        return isDark
          ? alpha(theme.palette.grey[500], 0.2)
          : alpha(theme.palette.grey[500], 0.15);
      default:
        return isDark
          ? alpha(theme.palette.primary.main, 0.2)
          : alpha(theme.palette.primary.main, 0.15);
    }
  };

  return (
    <Box
      sx={{
        p: 3,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <PageHeader
        icon={<DnsIcon />}
        title={t('serverList.title')}
        subtitle={t('serverList.subtitle')}
      />

      {/* Search and Filters */}
      <Card sx={{ mb: 3, flexShrink: 0 }}>
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* Row 1: Search & Filtering */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <SearchTextField
                placeholder={t('serverList.searchPlaceholder')}
                value={searchTerm}
                onChange={(value) => setSearchTerm(value)}
              />

              <DynamicFilterBar
                availableFilters={availableFilterDefinitions}
                activeFilters={activeFilters}
                onFilterAdd={handleFilterAdd}
                onFilterRemove={handleFilterRemove}
                onFilterChange={handleFilterChange}
              />
            </Box>

            {/* Row 2: Config Bar (Sort, Group, Columns, View Mode, Actions) */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1,
                bgcolor: (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'rgba(255,255,255,0.03)'
                    : 'rgba(0,0,0,0.02)',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                flexWrap: 'wrap',
              }}
            >
              {/* Sorting */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 800,
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                  }}
                >
                  {t('serverList.sort.label') || 'Sort'}
                </Typography>
                <Select
                  size="small"
                  value={sortBy}
                  onChange={(e) => handleSort(e.target.value as string)}
                  sx={{
                    height: 28,
                    fontSize: '0.75rem',
                    bgcolor: 'background.paper',
                    minWidth: 120,
                  }}
                >
                  {columns
                    .filter((c) => c.id !== 'actions')
                    .map((col) => (
                      <MenuItem
                        key={col.id}
                        value={col.id}
                        sx={{ fontSize: '0.75rem' }}
                      >
                        {t(col.labelKey)}
                      </MenuItem>
                    ))}
                </Select>
                <Tooltip title={t('common.sort')}>
                  <IconButton
                    size="small"
                    onClick={() =>
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                    }
                    sx={{
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    {sortOrder === 'asc' ? (
                      <ArrowUpwardIcon fontSize="small" />
                    ) : (
                      <ArrowDownwardIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
                <Tooltip title={t('common.columnSettings')}>
                  <IconButton
                    size="small"
                    onClick={(e) => setColumnSettingsAnchor(e.currentTarget)}
                    sx={{
                      height: 28,
                      width: 28,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'background.paper',
                    }}
                  >
                    <ViewColumnIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>

              <Divider orientation="vertical" flexItem />

              {/* Grouping Controls */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 800,
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                  }}
                >
                  {t('serverList.grouping.label')}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
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
                        fontWeight: 700,
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                      }}
                    />
                  ))}
                  {groupingLevels.length < allGroupingFields.length && (
                    <Button
                      size="small"
                      variant="contained"
                      onClick={(e) => setGroupingMenuAnchor(e.currentTarget)}
                      sx={{
                        height: 24,
                        minWidth: 'auto',
                        px: 1,
                        fontSize: '0.65rem',
                        borderStyle: 'dashed',
                      }}
                    >
                      {t('serverList.grouping.add')}
                    </Button>
                  )}
                  {groupingLevels.length > 0 && (
                    <Button
                      size="small"
                      onClick={() => setGroupingLevels([])}
                      sx={{
                        minWidth: 'auto',
                        px: 0.75,
                        height: 24,
                        fontSize: '0.65rem',
                        color: 'text.secondary',
                        textTransform: 'none',
                      }}
                    >
                      {t('common.clear')}
                    </Button>
                  )}
                </Box>
              </Box>

              <Divider orientation="vertical" flexItem />

              {/* View Mode */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box
                  sx={{
                    display: 'flex',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  {[
                    { mode: 'list', icon: <ViewListIcon fontSize="small" /> },
                    { mode: 'grid', icon: <ViewModuleIcon fontSize="small" /> },
                    { mode: 'card', icon: <ViewComfyIcon fontSize="small" /> },
                    {
                      mode: 'checkerboard',
                      icon: <AppsIcon fontSize="small" />,
                    },
                    {
                      mode: 'cluster',
                      icon: <BubbleChartIcon fontSize="small" />,
                    },
                  ].map((item) => (
                    <Tooltip
                      key={item.mode}
                      title={t(`serverList.viewMode.${item.mode}`)}
                    >
                      <IconButton
                        size="small"
                        onClick={() => handleViewModeChange(item.mode as any)}
                        sx={{
                          borderRadius: 0,
                          bgcolor:
                            viewMode === item.mode
                              ? 'primary.main'
                              : 'background.paper',
                          color:
                            viewMode === item.mode
                              ? 'primary.contrastText'
                              : 'inherit',
                          '&:hover': {
                            bgcolor:
                              viewMode === item.mode
                                ? 'primary.dark'
                                : 'action.hover',
                          },
                        }}
                      >
                        {item.icon}
                      </IconButton>
                    </Tooltip>
                  ))}
                </Box>
              </Box>

              <Divider orientation="vertical" flexItem />

              {/* Real-time Actions (Pause, Cleanup, HealthCheck) */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tooltip
                  title={
                    isPaused
                      ? t('serverList.resumeUpdates')
                      : t('serverList.pauseUpdates')
                  }
                >
                  <Badge
                    badgeContent={pendingUpdates.length}
                    color="warning"
                    invisible={!isPaused || pendingUpdates.length === 0}
                  >
                    <IconButton
                      size="small"
                      onClick={handleTogglePause}
                      sx={{
                        height: 28,
                        width: 28,
                        bgcolor: isPaused ? 'warning.main' : 'background.paper',
                        color: isPaused ? 'warning.contrastText' : 'inherit',
                        border: '1px solid',
                        borderColor: isPaused ? 'warning.main' : 'divider',
                        '&:hover': {
                          bgcolor: isPaused ? 'warning.dark' : 'action.hover',
                        },
                      }}
                    >
                      {isPaused ? (
                        <PlayArrowIcon fontSize="small" />
                      ) : (
                        <PauseIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Badge>
                </Tooltip>

                <Tooltip title={t('serverList.cleanup')}>
                  <span>
                    <IconButton
                      size="small"
                      onClick={handleCleanupClick}
                      disabled={inactiveCount === 0}
                      sx={{
                        height: 28,
                        width: 28,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                      }}
                    >
                      <CleaningServicesIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>

                <Tooltip title={t('serverList.bulkHealthCheck')}>
                  <span>
                    <IconButton
                      size="small"
                      onClick={handleBulkHealthCheckOpen}
                      disabled={
                        services.filter(
                          (s) =>
                            s.status === 'ready' || s.status === 'initializing'
                        ).length === 0
                      }
                      sx={{
                        height: 28,
                        width: 28,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                      }}
                    >
                      <MonitorHeartIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>

              <Box sx={{ flexGrow: 1 }} />
              <StatusStatsDisplay services={filteredServices} t={t} />
            </Box>
          </Box>
        </CardContent>
      </Card>

      <PageContentLoader
        loading={isLoading && services.length === 0}
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* List View */}
        {(services.length > 0 || !isLoading) &&
          viewMode === 'list' &&
          (() => {
            interface ListGroup {
              id: string;
              name: string;
              level: number;
              fieldName: GroupingField;
              instances: ServiceInstance[];
              children?: ListGroup[];
            }

            const buildListGroups = (
              items: ServiceInstance[],
              levels: GroupingField[],
              currentLevel: number = 0
            ): ListGroup[] => {
              if (levels.length === 0 || currentLevel >= levels.length)
                return [];
              const currentField = levels[currentLevel];
              const hasMoreLevels = currentLevel + 1 < levels.length;
              const groupMap = new Map<string, ServiceInstance[]>();
              items.forEach((service) => {
                const value = service.labels[currentField] || 'Unknown';
                if (!groupMap.has(value)) groupMap.set(value, []);
                groupMap.get(value)!.push(service);
              });
              return Array.from(groupMap.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([name, instances]) => ({
                  id: levels.slice(0, currentLevel + 1).join('-') + '-' + name,
                  name:
                    name === 'Unknown'
                      ? `(${getGroupingLabel(currentField)} N/A)`
                      : name,
                  level: currentLevel,
                  fieldName: currentField,
                  instances: hasMoreLevels ? [] : instances,
                  children: hasMoreLevels
                    ? buildListGroups(instances, levels, currentLevel + 1)
                    : undefined,
                }));
            };

            const collectListInstances = (
              group: ListGroup
            ): ServiceInstance[] => {
              if (group.children && group.children.length > 0)
                return group.children.flatMap(collectListInstances);
              return group.instances;
            };


            // Render service cells only (without TableRow wrapper) - used by TableVirtuoso
            const renderServiceRowCells = (
              service: ServiceInstance,
              depth: number
            ) => {
              const serviceKey = `${service.labels.service}-${service.instanceId}`;
              const visibleColumns = columns.filter((col) => col.visible);

              return (
                <>
                  {visibleColumns.map((column) => {
                    switch (column.id) {
                      case 'instanceId':
                        return (
                          <TableCell key={column.id} sx={{ pl: depth * 4 + 2 }}>
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                position: 'relative',
                              }}
                            >
                              {depth > 0 && (
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    left: -16,
                                    width: 12,
                                    height: 12,
                                    borderLeft: '2px solid',
                                    borderBottom: '2px solid',
                                    borderColor: 'primary.main',
                                    opacity: 0.5,
                                    borderRadius: '0 0 0 4px',
                                    top: 'calc(50% - 8px)',
                                  }}
                                />
                              )}
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                }}
                              >
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontFamily: '"D2Coding", monospace',
                                    fontWeight: 700,
                                  }}
                                >
                                  {service.instanceId}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                        );
                      case 'service':
                        return (
                          <TableCell key={column.id}>
                            {getTypeChip(service.labels.service)}
                          </TableCell>
                        );
                      case 'group':
                        return (
                          <TableCell key={column.id}>
                            {service.labels.group ? (
                              <Chip
                                label={service.labels.group}
                                size="small"
                                variant="outlined"
                                color="primary"
                                sx={{ fontWeight: 600 }}
                              />
                            ) : (
                              '-'
                            )}
                          </TableCell>
                        );
                      case 'environment':
                        return (
                          <TableCell key={column.id}>
                            {service.labels.environmentId ||
                            service.labels.environment ? (
                              <Chip
                                label={
                                  service.labels.environmentId ||
                                  service.labels.environment
                                }
                                size="small"
                                variant="outlined"
                                color="secondary"
                                sx={{ fontWeight: 600 }}
                              />
                            ) : (
                              '-'
                            )}
                          </TableCell>
                        );
                      case 'status':
                        return (
                          <TableCell key={column.id}>
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                              }}
                            >
                              {renderHeartbeatIcon(service, 20, 10)}
                              <Chip
                                label={getStatusLabelText(
                                  service.status
                                ).toUpperCase()}
                                size="small"
                                sx={{
                                  height: 20,
                                  minWidth: 70,
                                  fontSize: '0.65rem',
                                  fontWeight: 900,
                                  bgcolor: alpha(
                                    getStatusColor(service.status),
                                    0.1
                                  ),
                                  color: getStatusColor(service.status),
                                  border: '1px solid',
                                  borderColor: alpha(
                                    getStatusColor(service.status),
                                    0.2
                                  ),
                                }}
                              />
                            </Box>
                          </TableCell>
                        );
                      case 'hostname':
                        return (
                          <TableCell key={column.id}>
                            <Typography
                              variant="body2"
                              sx={{
                                fontFamily: '"D2Coding", monospace',
                                fontSize: '0.75rem',
                              }}
                            >
                              {service.hostname}
                            </Typography>
                          </TableCell>
                        );
                      case 'externalAddress':
                        return (
                          <TableCell key={column.id}>
                            <Typography
                              variant="body2"
                              sx={{
                                fontFamily: '"D2Coding", monospace',
                                fontSize: '0.75rem',
                                opacity: 0.8,
                              }}
                            >
                              {service.externalAddress}
                            </Typography>
                          </TableCell>
                        );
                      case 'internalAddress':
                        return (
                          <TableCell key={column.id}>
                            <Typography
                              variant="body2"
                              sx={{
                                fontFamily: '"D2Coding", monospace',
                                fontSize: '0.75rem',
                                opacity: 0.8,
                              }}
                            >
                              {service.internalAddress}
                            </Typography>
                          </TableCell>
                        );
                      case 'ports':
                        const portEntries = Object.entries(service.ports || {});
                        const portsExpanded = expandedCells.has(
                          `${serviceKey}-ports`
                        );
                        const visiblePorts = portsExpanded
                          ? portEntries
                          : portEntries.slice(0, 2);
                        const hiddenPortsCount = portEntries.length - 2;
                        return (
                          <TableCell key={column.id}>
                            <Box
                              sx={{
                                display: 'flex',
                                gap: 0.5,
                                flexWrap: 'wrap',
                                alignItems: 'center',
                              }}
                            >
                              {visiblePorts.map(([name, port]) => (
                                <Chip
                                  key={`${service.instanceId}-${name}`}
                                  label={`${name}:${port}`}
                                  size="small"
                                  sx={{
                                    fontFamily: '"D2Coding", monospace',
                                    fontSize: '0.7rem',
                                    height: '22px',
                                  }}
                                />
                              ))}
                              {hiddenPortsCount > 0 && !portsExpanded && (
                                <Typography
                                  variant="caption"
                                  color="primary"
                                  sx={{
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    '&:hover': { color: 'primary.dark' },
                                  }}
                                  onClick={() =>
                                    setExpandedCells((prev) =>
                                      new Set(prev).add(`${serviceKey}-ports`)
                                    )
                                  }
                                >
                                  +{hiddenPortsCount} {t('common.more')}
                                </Typography>
                              )}
                              {portsExpanded && hiddenPortsCount > 0 && (
                                <Typography
                                  variant="caption"
                                  color="primary"
                                  sx={{
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    '&:hover': { color: 'primary.dark' },
                                  }}
                                  onClick={() =>
                                    setExpandedCells((prev) => {
                                      const next = new Set(prev);
                                      next.delete(`${serviceKey}-ports`);
                                      return next;
                                    })
                                  }
                                >
                                  {t('common.showLess')}
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                        );
                      case 'stats':
                        return (
                          <TableCell key={column.id}>
                            {service.stats &&
                              Object.keys(service.stats).length > 0 && (
                                <Box
                                  sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 0.25,
                                  }}
                                >
                                  {Object.entries(service.stats).map(
                                    ([k, v]) => (
                                      <Typography
                                        key={k}
                                        variant="caption"
                                        sx={{
                                          fontSize: '0.65rem',
                                          color: 'text.secondary',
                                          fontFamily: '"D2Coding", monospace',
                                        }}
                                      >
                                        {k}:{' '}
                                        {typeof v === 'number'
                                          ? v.toFixed(2)
                                          : String(v)}
                                      </Typography>
                                    )
                                  )}
                                </Box>
                              )}
                          </TableCell>
                        );
                      case 'meta':
                        return (
                          <TableCell key={column.id}>
                            {service.meta &&
                              Object.keys(service.meta).length > 0 && (
                                <Box
                                  sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 0.25,
                                  }}
                                >
                                  {Object.entries(service.meta).map(
                                    ([k, v]) => (
                                      <Typography
                                        key={k}
                                        variant="caption"
                                        sx={{
                                          fontSize: '0.65rem',
                                          color: 'text.secondary',
                                        }}
                                      >
                                        {k}: {String(v)}
                                      </Typography>
                                    )
                                  )}
                                </Box>
                              )}
                          </TableCell>
                        );
                      case 'createdAt':
                        return (
                          <TableCell key={column.id}>
                            <RelativeTime
                              date={service.createdAt}
                              showSeconds
                            />
                          </TableCell>
                        );
                      case 'updatedAt':
                        return (
                          <TableCell key={column.id}>
                            <Box
                              sx={{
                                width: '100%',
                                minWidth: 100,
                                height: 20,
                                bgcolor: 'action.hover',
                                borderRadius: 1,
                                position: 'relative',
                                overflow: 'hidden',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid',
                                borderColor: 'divider',
                              }}
                            >
                              {(() => {
                                const lastUpdate = new Date(
                                  service.updatedAt
                                ).getTime();
                                const diff = Math.max(
                                  0,
                                  currentTime - lastUpdate
                                );
                                const ttlMs = HEARTBEAT_TTL_SECONDS * 1000;
                                const progress = Math.max(
                                  0,
                                  Math.min(100, (1 - diff / ttlMs) * 100)
                                );
                                const color =
                                  progress > 50
                                    ? 'success.main'
                                    : progress > 20
                                      ? 'warning.main'
                                      : 'error.main';

                                return (
                                  <>
                                    <Box
                                      sx={{
                                        position: 'absolute',
                                        left: 0,
                                        top: 0,
                                        bottom: 0,
                                        width: `${progress}%`,
                                        bgcolor: alpha(
                                          color === 'success.main'
                                            ? '#4caf50'
                                            : color === 'warning.main'
                                              ? '#ff9800'
                                              : '#f44336',
                                          0.15
                                        ),
                                        transition: 'width 1s linear',
                                      }}
                                    />
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        zIndex: 1,
                                        fontWeight: 700,
                                        fontSize: '0.65rem',
                                        color: 'text.secondary',
                                      }}
                                    >
                                      <RelativeTime
                                        date={service.updatedAt}
                                        showSeconds
                                        baseTime={currentTime}
                                      />
                                    </Typography>
                                  </>
                                );
                              })()}
                            </Box>
                          </TableCell>
                        );
                      case 'labels':
                        const labelEntries = Object.entries(service.labels);
                        const labelsExpanded = expandedCells.has(
                          `${serviceKey}-labels`
                        );
                        const visibleLabels = labelsExpanded
                          ? labelEntries
                          : labelEntries.slice(0, 2);
                        const hiddenLabelsCount = labelEntries.length - 2;
                        return (
                          <TableCell key={column.id}>
                            <Box
                              sx={{
                                display: 'flex',
                                gap: 0.5,
                                flexWrap: 'wrap',
                                alignItems: 'center',
                              }}
                            >
                              {visibleLabels.map(([k, v]) => (
                                <Chip
                                  key={k}
                                  label={`${k}=${v}`}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: '0.75rem', height: 22 }}
                                />
                              ))}
                              {hiddenLabelsCount > 0 && !labelsExpanded && (
                                <Typography
                                  variant="caption"
                                  color="primary"
                                  sx={{
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    '&:hover': { color: 'primary.dark' },
                                  }}
                                  onClick={() =>
                                    setExpandedCells((prev) =>
                                      new Set(prev).add(`${serviceKey}-labels`)
                                    )
                                  }
                                >
                                  +{hiddenLabelsCount} {t('common.more')}
                                </Typography>
                              )}
                              {labelsExpanded && hiddenLabelsCount > 0 && (
                                <Typography
                                  variant="caption"
                                  color="primary"
                                  sx={{
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    '&:hover': { color: 'primary.dark' },
                                  }}
                                  onClick={() =>
                                    setExpandedCells((prev) => {
                                      const next = new Set(prev);
                                      next.delete(`${serviceKey}-labels`);
                                      return next;
                                    })
                                  }
                                >
                                  {t('common.showLess')}
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                        );
                      case 'cloudProvider':
                        return (
                          <TableCell key={column.id}>
                            {service.labels.cloudProvider || '-'}
                          </TableCell>
                        );
                      case 'cloudRegion':
                        return (
                          <TableCell key={column.id}>
                            {service.labels.cloudRegion || '-'}
                          </TableCell>
                        );
                      case 'cloudZone':
                        return (
                          <TableCell key={column.id}>
                            {service.labels.cloudZone || '-'}
                          </TableCell>
                        );
                      case 'actions':
                        const rowHealthStatus =
                          healthCheckStatus.get(serviceKey);
                        return (
                          <TableCell key={column.id} align="center">
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                justifyContent: 'center',
                              }}
                            >
                              <IconButton
                                size="small"
                                onClick={(e) => handleContextMenu(e, service)}
                              >
                                <MoreVertIcon fontSize="small" />
                              </IconButton>
                              {rowHealthStatus?.loading && (
                                <CircularProgress size={16} />
                              )}
                              {rowHealthStatus?.cooldown &&
                                rowHealthStatus.result && (
                                  <Tooltip
                                    title={
                                      rowHealthStatus.result.healthy
                                        ? 'Healthy'
                                        : rowHealthStatus.result.error ||
                                          'Unknown error'
                                    }
                                    arrow
                                  >
                                    <Chip
                                      label={
                                        rowHealthStatus.result.healthy
                                          ? `${rowHealthStatus.result.latency}ms`
                                          : 'ERR'
                                      }
                                      size="small"
                                      sx={{
                                        height: 20,
                                        fontSize: '0.65rem',
                                        fontWeight: 800,
                                        bgcolor: rowHealthStatus.result.healthy
                                          ? 'success.main'
                                          : 'error.main',
                                        color: 'white',
                                        animation: rowHealthStatus.fading
                                          ? 'fadeOut 0.5s ease-out forwards'
                                          : 'none',
                                        '@keyframes fadeOut': {
                                          from: { opacity: 1 },
                                          to: { opacity: 0 },
                                        },
                                      }}
                                    />
                                  </Tooltip>
                                )}
                            </Box>
                          </TableCell>
                        );
                      default:
                        return null;
                    }
                  })}
                </>
              );
            };

            const renderServiceRow = (
              service: ServiceInstance,
              depth: number
            ) => {
              const serviceKey = `${service.labels.service}-${service.instanceId}`;
              const updatedStatus = updatedServiceIds.get(serviceKey);
              const isUpdated = updatedStatus !== undefined;
              const highlightStatus = updatedStatus || service.status;

              return (
                <TableRow
                  key={serviceKey}
                  hover
                  onContextMenu={(e) => handleContextMenu(e, service)}
                  sx={{
                    bgcolor: isUpdated
                      ? (t) => getHighlightColor(highlightStatus, t)
                      : (t) => getStatusBgColor(service.status, t),
                    transition: 'background-color 0.2s ease',
                  }}
                >
                  {renderServiceRowCells(service, depth)}
                </TableRow>
              );
            };

            const renderGroupRows = (group: ListGroup): React.ReactNode[] => {
              const allInstances = collectListInstances(group);
              const rows: React.ReactNode[] = [];
              const visibleColumns = columns.filter((col) => col.visible);

              rows.push(
                <TableRow
                  key={`group-${group.id}`}
                  sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}
                >
                  <TableCell
                    colSpan={visibleColumns.length}
                    sx={{
                      py: 1,
                      borderBottom: '2px solid',
                      borderColor: 'primary.main',
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        pl: group.level * 4,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 800,
                          color: 'primary.main',
                          textTransform: 'uppercase',
                        }}
                      >
                        {getGroupingLabel(group.fieldName)}
                      </Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        {group.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 700, opacity: 0.6 }}
                      >
                        ({allInstances.length})
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              );

              if (!group.children || group.children.length === 0) {
                rows.push(
                  <TableRow
                    key={`group-cols-${group.id}`}
                    sx={{ bgcolor: 'background.paper' }}
                  >
                    {visibleColumns.map((col) => (
                      <TableCell
                        key={`col-${group.id}-${col.id}`}
                        sx={{
                          py: 0.5,
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          color: 'text.disabled',
                          textTransform: 'uppercase',
                          bgcolor: 'background.paper',
                        }}
                      >
                        {t(col.labelKey)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              }

              if (group.children && group.children.length > 0) {
                group.children.forEach((child) =>
                  rows.push(...renderGroupRows(child))
                );
              } else {
                group.instances.forEach((service) =>
                  rows.push(renderServiceRow(service, group.level + 1))
                );
                rows.push(
                  <TableRow key={`spacer-${group.id}`} sx={{ height: 16 }}>
                    <TableCell
                      colSpan={visibleColumns.length}
                      sx={{ border: 'none' }}
                    />
                  </TableRow>
                );
              }
              return rows;
            };

            const listGroups =
              groupingLevels.length > 0
                ? buildListGroups(displayServices, groupingLevels)
                : [];
            const visibleColumnsHeader = columns.filter((col) => col.visible);

            return displayServices.length === 0 ? (
              <EmptyPagePlaceholder message={t('serverList.noData')} />
            ) : (
              <Card
                variant="outlined"
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                  overflow: 'hidden',
                }}
              >
                {groupingLevels.length > 0 ? (
                  /* Grouped view: standard table (group headers need special rendering) */
                  <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
                    <Table stickyHeader size="small">
                      <TableBody>
                        {listGroups.flatMap((group) => renderGroupRows(group))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  /* Ungrouped view: virtualized table for performance */
                  <TableVirtuoso
                    style={{ flex: 1 }}
                    data={displayServices}
                    computeItemKey={(_index, service) =>
                      `${service.labels.service}-${service.instanceId}`
                    }
                    fixedHeaderContent={() => (
                      <TableRow>
                        {visibleColumnsHeader.map((column) => (
                          <TableCell
                            key={column.id}
                            sx={{
                              fontWeight: 600,
                              bgcolor: 'background.paper',
                              borderBottom: '2px solid',
                              borderColor: 'divider',
                            }}
                          >
                            {t(column.labelKey)}
                          </TableCell>
                        ))}
                      </TableRow>
                    )}
                    itemContent={(_index, service) =>
                      renderServiceRowCells(service, 0)
                    }
                    components={virtuosoTableComponents}
                  />
                )}
              </Card>
            );
          })()}

        {/* Grid View - Compact uniform tiles */}
        {/* Grid View - Rectangular detailed cards */}
        {(services.length > 0 || !isLoading) &&
          viewMode === 'grid' &&
          (() => {
            interface GridGroup {
              id: string;
              name: string;
              level: number;
              fieldName: GroupingField;
              instances: ServiceInstance[];
              children?: GridGroup[];
            }

            const buildGridGroups = (
              items: ServiceInstance[],
              levels: GroupingField[],
              currentLevel: number = 0
            ): GridGroup[] => {
              if (levels.length === 0 || currentLevel >= levels.length)
                return [];
              const currentField = levels[currentLevel];
              const hasMoreLevels = currentLevel + 1 < levels.length;
              const groupMap = new Map<string, ServiceInstance[]>();
              items.forEach((service) => {
                const value = service.labels[currentField] || 'Unknown';
                if (!groupMap.has(value)) groupMap.set(value, []);
                groupMap.get(value)!.push(service);
              });
              return Array.from(groupMap.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([name, instances]) => ({
                  id: `grid-${levels.slice(0, currentLevel + 1).join('-')}-${name}`,
                  name:
                    name === 'Unknown'
                      ? `(${getGroupingLabel(currentField)} N/A)`
                      : name,
                  level: currentLevel,
                  fieldName: currentField,
                  instances: hasMoreLevels ? [] : instances,
                  children: hasMoreLevels
                    ? buildGridGroups(instances, levels, currentLevel + 1)
                    : undefined,
                }));
            };

            const collectGridInstances = (
              group: GridGroup
            ): ServiceInstance[] => {
              if (group.children && group.children.length > 0)
                return group.children.flatMap(collectGridInstances);
              return group.instances;
            };

            const renderDetailedGridCard = (service: ServiceInstance) => {
              const serviceKey = `${service.labels.service}-${service.instanceId}`;
              const updatedStatus = updatedServiceIds.get(serviceKey);
              const isUpdated = updatedStatus !== undefined;
              const ports = Object.entries(service.ports || {});

              return (
                <Box
                  key={serviceKey}
                  onContextMenu={(e) => handleContextMenu(e, service)}
                  sx={{
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'background.paper', // MONOCHROMATIC
                    transition: 'all 0.1s ease-in-out',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    '&:hover': {
                      borderColor: 'primary.main',
                      boxShadow: (theme) => theme.shadows[4],
                      zIndex: 1,
                    },
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Box
                      sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}
                    >
                      {getTypeChip(service.labels.service)}
                      <Chip
                        label={getStatusLabelText(service.status).toUpperCase()}
                        size="small"
                        sx={{
                          height: 18,
                          minWidth: 60,
                          fontSize: '0.6rem',
                          fontWeight: 900,
                          bgcolor: alpha(getStatusColor(service.status), 0.1),
                          color: getStatusColor(service.status),
                          border: '1px solid',
                          borderColor: alpha(
                            getStatusColor(service.status),
                            0.2
                          ),
                        }}
                      />
                    </Box>
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      {renderHeartbeatIcon(service, 20, 10)}
                      {hasWebPort(service) &&
                        (() => {
                          const gridHealthStatus =
                            healthCheckStatus.get(serviceKey);
                          if (gridHealthStatus?.loading)
                            return <CircularProgress size={12} />;
                          if (
                            gridHealthStatus?.cooldown &&
                            gridHealthStatus.result
                          ) {
                            return (
                              <Tooltip
                                title={
                                  gridHealthStatus.result.healthy
                                    ? 'Healthy'
                                    : gridHealthStatus.result.error ||
                                      'Unknown error'
                                }
                                arrow
                              >
                                <Chip
                                  label={
                                    gridHealthStatus.result.healthy
                                      ? `${gridHealthStatus.result.latency}ms`
                                      : 'ERR'
                                  }
                                  size="small"
                                  sx={{
                                    height: 18,
                                    fontSize: '0.6rem',
                                    fontWeight: 900,
                                    bgcolor: gridHealthStatus.result.healthy
                                      ? 'success.main'
                                      : 'error.main',
                                    color: 'white',
                                    animation: gridHealthStatus.fading
                                      ? 'fadeOut 0.5s ease-out forwards'
                                      : 'none',
                                  }}
                                />
                              </Tooltip>
                            );
                          }
                          return (
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleHealthCheck(service);
                              }}
                              sx={{ p: 0, width: 14, height: 14 }}
                            >
                              <TouchAppIcon
                                sx={{ fontSize: 10, opacity: 0.6 }}
                              />
                            </IconButton>
                          );
                        })()}
                      <IconButton
                        size="small"
                        onClick={(e) => handleContextMenu(e, service)}
                        sx={{ p: 0 }}
                      >
                        <MoreVertIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>
                  </Box>

                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: '"D2Coding", monospace',
                      fontWeight: 700,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {service.instanceId}
                  </Typography>

                  <Box
                    sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontWeight: 600 }}
                    >
                      {service.hostname}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ fontFamily: '"D2Coding", monospace', opacity: 0.7 }}
                    >
                      {service.externalAddress}
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 0.5,
                      mt: 'auto',
                      pt: 0.5,
                      borderTop: '1px dashed',
                      borderColor: 'divider',
                    }}
                  >
                    {ports.map(([n, p]) => (
                      <Typography
                        key={n}
                        variant="caption"
                        sx={{
                          fontFamily: '"D2Coding", monospace',
                          fontSize: '0.6rem',
                          color: 'text.secondary',
                        }}
                      >
                        {n}:{p}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              );
            };

            const renderGridGroupRecursive = (
              group: GridGroup
            ): React.ReactNode => {
              const allInstances = collectGridInstances(group);
              const hasChildren = group.children && group.children.length > 0;
              const colCount = 5;
              const emptyCount =
                allInstances.length > 0
                  ? (colCount - (allInstances.length % colCount)) % colCount
                  : 0;

              return (
                <Box key={group.id} sx={{ mb: 4 }}>
                  {/* Simple Group Header */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      mb: 1.5,
                      gap: 1,
                      pl: group.level * 2,
                      borderLeft: group.level > 0 ? '2px solid' : 'none',
                      borderColor: 'primary.main',
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 800,
                        color: 'text.secondary',
                        textTransform: 'uppercase',
                      }}
                    >
                      {getGroupingLabel(group.fieldName)}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800 }}>
                      {group.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.disabled' }}
                    >
                      ({allInstances.length})
                    </Typography>
                  </Box>

                  {hasChildren ? (
                    <Box
                      sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
                    >
                      {group.children!.map((child) =>
                        renderGridGroupRecursive(child)
                      )}
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(5, 1fr)',
                        gap: 1,
                        '@media (max-width: 1600px)': {
                          gridTemplateColumns: 'repeat(4, 1fr)',
                        },
                        '@media (max-width: 1200px)': {
                          gridTemplateColumns: 'repeat(3, 1fr)',
                        },
                        '@media (max-width: 900px)': {
                          gridTemplateColumns: 'repeat(2, 1fr)',
                        },
                        '@media (max-width: 600px)': {
                          gridTemplateColumns: '1fr',
                        },
                      }}
                    >
                      {group.instances.map((service) =>
                        renderDetailedGridCard(service)
                      )}
                      {/* Restore Empty Placeholders */}
                      {Array.from({ length: emptyCount }).map((_, idx) => (
                        <Box
                          key={`empty-${group.id}-${idx}`}
                          sx={{
                            border: '1px dashed',
                            borderColor: 'divider',
                            height: '100%',
                            minHeight: 120,
                            opacity: 0.3,
                          }}
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              );
            };

            const groups =
              groupingLevels.length > 0
                ? buildGridGroups(gridDisplayServices, groupingLevels)
                : [];

            if (groupingLevels.length === 0) {
              return (
                <VirtuosoGrid
                  style={{ flex: 1 }}
                  totalCount={gridDisplayServices.length}
                  itemContent={(index) =>
                    renderDetailedGridCard(gridDisplayServices[index])
                  }
                  components={{
                    List: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
                      <div
                        ref={ref}
                        {...props}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(5, 1fr)',
                          gap: 8,
                          alignContent: 'start',
                          ...props.style,
                        }}
                      />
                    )),
                    Item: (props: React.HTMLAttributes<HTMLDivElement>) => (
                      <div {...props} />
                    ),
                  }}
                />
              );
            }

            return (
              <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                {groups.map((group) => renderGridGroupRecursive(group))}
              </Box>
            );
          })()}

        {/* Checkerboard View - High density status grid */}
        {(services.length > 0 || !isLoading) && viewMode === 'checkerboard' && (
          <CheckerboardView
            services={gridDisplayServices}
            updatedServiceIds={updatedServiceIds}
            heartbeatIds={heartbeatIds}
            groupingLevels={groupingLevels}
            getGroupingLabel={getGroupingLabel}
            t={t}
            onContextMenu={handleContextMenu}
          />
        )}

        {/* Card View - Uniform detailed cards in grid layout */}
        {(services.length > 0 || !isLoading) &&
          viewMode === 'card' &&
          (() => {
            // Multi-level group structure for CardView
            interface CardGroup {
              id: string;
              name: string;
              level: number;
              fieldName: GroupingField;
              instances: ServiceInstance[];
              children?: CardGroup[];
            }

            // Build multi-level groups recursively
            const buildCardGroups = (
              items: ServiceInstance[],
              levels: GroupingField[],
              currentLevel: number = 0
            ): CardGroup[] => {
              if (levels.length === 0 || currentLevel >= levels.length)
                return [];
              const currentField = levels[currentLevel];
              const hasMoreLevels = currentLevel + 1 < levels.length;
              const groupMap = new Map<string, ServiceInstance[]>();
              items.forEach((service) => {
                const value = service.labels[currentField] || 'Unknown';
                if (!groupMap.has(value)) groupMap.set(value, []);
                groupMap.get(value)!.push(service);
              });
              return Array.from(groupMap.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([name, instances]) => ({
                  id: levels.slice(0, currentLevel + 1).join('-') + '-' + name,
                  name:
                    name === 'Unknown'
                      ? `(${getGroupingLabel(currentField)} N/A)`
                      : name,
                  level: currentLevel,
                  fieldName: currentField,
                  instances: hasMoreLevels ? [] : instances,
                  children: hasMoreLevels
                    ? buildCardGroups(instances, levels, currentLevel + 1)
                    : undefined,
                }));
            };

            // Collect all instances from a group recursively
            const collectCardInstances = (
              group: CardGroup
            ): ServiceInstance[] => {
              if (group.children && group.children.length > 0)
                return group.children.flatMap(collectCardInstances);
              return group.instances;
            };

            // Render a single service card
            const renderServiceCard = (service: ServiceInstance) => {
              const serviceKey = `${service.labels.service}-${service.instanceId}`;
              const updatedStatus = updatedServiceIds.get(serviceKey);
              const isUpdated = updatedStatus !== undefined;
              const isNew = newServiceIds.has(serviceKey);
              const highlightStatus = updatedStatus || service.status;
              const customLabels = Object.entries(service.labels).filter(
                ([key]) =>
                  key !== 'service' &&
                  key !== 'group' &&
                  key !== 'environment' &&
                  key !== 'environmentId' &&
                  key !== 'region'
              );
              const ports = Object.entries(service.ports || {});

              return (
                <Box
                  key={serviceKey}
                  onContextMenu={(e) => handleContextMenu(e, service)}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    p: 1.5,
                    gap: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: isUpdated
                      ? (theme) => getHighlightColor(highlightStatus, theme)
                      : 'background.paper',
                    transition: 'all 0.1s ease-in-out',
                    animation: isNew
                      ? 'appearEffect 0.5s ease-out'
                      : isUpdated
                        ? `flashEffect-${highlightStatus} 2s ease-out`
                        : 'none',
                    '&:hover': {
                      borderColor: 'primary.main',
                      boxShadow: (theme) => theme.shadows[4],
                      zIndex: 1,
                    },
                    '@keyframes appearEffect': {
                      '0%': { opacity: 0, transform: 'scale(0.9)' },
                      '100%': { opacity: 1, transform: 'scale(1)' },
                    },
                    [`@keyframes flashEffect-${highlightStatus}`]: {
                      '0%': {
                        bgcolor: (theme) =>
                          getHighlightColorStart(highlightStatus, theme),
                      },
                      '100%': {
                        bgcolor: (theme) =>
                          getStatusBgColor(service.status, theme) ||
                          'background.paper',
                      },
                    },
                  }}
                >
                  {/* Header: Type + Group + Status */}
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 1,
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        gap: 0.5,
                        flexWrap: 'wrap',
                        alignItems: 'center',
                      }}
                    >
                      {getTypeChip(service.labels.service)}
                      {service.labels.group && (
                        <Chip
                          label={service.labels.group}
                          size="small"
                          variant="outlined"
                          color="primary"
                          sx={{
                            fontWeight: 600,
                            height: 20,
                            fontSize: '0.7rem',
                            borderRadius: 1,
                          }}
                        />
                      )}
                      {(service.labels.environmentId ||
                        service.labels.environment) && (
                        <Chip
                          label={
                            service.labels.environmentId ||
                            service.labels.environment
                          }
                          size="small"
                          variant="outlined"
                          color="secondary"
                          sx={{
                            fontWeight: 600,
                            height: 20,
                            fontSize: '0.7rem',
                            borderRadius: 1,
                          }}
                        />
                      )}
                      {service.labels.region && (
                        <Chip
                          label={service.labels.region}
                          size="small"
                          variant="outlined"
                          color="info"
                          sx={{
                            fontWeight: 600,
                            height: 20,
                            fontSize: '0.7rem',
                            borderRadius: 1,
                          }}
                        />
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        {getStatusBadge(service.status)}
                      </Box>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                      >
                        {/* Only show heartbeat icon for initializing/ready status */}
                        {renderHeartbeatIcon(service, 26, 14)}
                        {/* Move health check button here */}
                        {hasWebPort(service) &&
                          (() => {
                            const cardHealthStatus =
                              healthCheckStatus.get(serviceKey);
                            if (cardHealthStatus?.loading)
                              return <CircularProgress size={16} />;
                            if (
                              cardHealthStatus?.cooldown &&
                              cardHealthStatus.result
                            ) {
                              return (
                                <Tooltip
                                  title={
                                    cardHealthStatus.result.healthy
                                      ? 'Healthy'
                                      : cardHealthStatus.result.error ||
                                        'Unknown error'
                                  }
                                  arrow
                                >
                                  <Chip
                                    label={
                                      cardHealthStatus.result.healthy
                                        ? `${cardHealthStatus.result.latency} ms`
                                        : '\u2715'
                                    }
                                    size="small"
                                    sx={{
                                      height: 22,
                                      fontSize: '0.7rem',
                                      fontWeight: 800,
                                      bgcolor: cardHealthStatus.result.healthy
                                        ? 'success.main'
                                        : 'error.main',
                                      color: 'white',
                                      animation: cardHealthStatus.fading
                                        ? 'wiggleFade 0.5s ease-out forwards'
                                        : 'none',
                                    }}
                                  />
                                </Tooltip>
                              );
                            }
                            return (
                              <Tooltip
                                title={t('serverList.healthCheck.tooltip')}
                                arrow
                              >
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleHealthCheck(service);
                                  }}
                                  sx={{
                                    width: 24,
                                    height: 24,
                                    p: 0,
                                    bgcolor: 'background.paper',
                                    border: 1,
                                    borderColor: 'divider',
                                    '&:hover': { bgcolor: 'action.hover' },
                                  }}
                                >
                                  <TouchAppIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            );
                          })()}
                      </Box>

                      <IconButton
                        size="small"
                        onClick={(e) => {
                          setContextMenu({
                            mouseX:
                              e.currentTarget.getBoundingClientRect().left,
                            mouseY:
                              e.currentTarget.getBoundingClientRect().bottom,
                            service,
                          });
                        }}
                        sx={{ p: 0.25 }}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Hostname */}
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: '"D2Coding", monospace',
                      fontWeight: 600,
                    }}
                  >
                    {service.hostname}
                  </Typography>

                  {/* Instance ID */}
                  <Typography
                    variant="body2"
                    color="text.disabled"
                    sx={{
                      fontFamily: '"D2Coding", monospace',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {service.instanceId}
                  </Typography>

                  {/* Info Grid */}
                  <Box
                    sx={{
                      mt: 1,
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr',
                      gap: 0.25,
                      '& .label': {
                        color: 'text.secondary',
                        fontSize: '0.875rem',
                        minWidth: 55,
                      },
                      '& .value': {
                        fontFamily: '"D2Coding", monospace',
                        fontSize: '0.875rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      },
                    }}
                  >
                    <Typography className="label">External</Typography>
                    <Typography className="value">
                      {service.externalAddress}
                    </Typography>
                    <Typography className="label">Internal</Typography>
                    <Typography className="value">
                      {service.internalAddress}
                    </Typography>
                  </Box>

                  {/* Ports - Compact inline chips */}
                  {ports.length > 0 && (
                    <Box
                      sx={{
                        mt: 0.5,
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 0.5,
                      }}
                    >
                      {ports.map(([name, port]) => (
                        <Chip
                          key={`${service.instanceId}-port-${name}`}
                          label={`${name}:${port}`}
                          size="small"
                          variant="outlined"
                          sx={{
                            height: 24,
                            fontSize: '0.8rem',
                            fontFamily: '"D2Coding", monospace',
                            '& .MuiChip-label': { px: 1 },
                          }}
                        />
                      ))}
                    </Box>
                  )}

                  {/* Custom labels */}
                  {customLabels.length > 0 && (
                    <Box
                      sx={{
                        display: 'flex',
                        gap: 0.5,
                        flexWrap: 'wrap',
                        mt: 0.5,
                      }}
                    >
                      {customLabels.map(([key, value]) => (
                        <Chip
                          key={`${service.instanceId}-${key}`}
                          label={`${key}=${value}`}
                          size="small"
                          variant="outlined"
                          sx={{
                            fontSize: '0.8rem',
                            height: 24,
                            fontFamily: '"D2Coding", monospace',
                          }}
                        />
                      ))}
                    </Box>
                  )}

                  {/* Spacer */}
                  <Box sx={{ flex: 1 }} />

                  {/* Stats */}
                  {service.stats && Object.keys(service.stats).length > 0 && (
                    <Box
                      sx={{
                        mt: 1,
                        p: 0.75,
                        bgcolor: 'action.hover',
                        display: 'flex',
                        gap: 2,
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                      }}
                    >
                      {Object.entries(service.stats).map(([key, value]) => (
                        <Box
                          key={`${service.instanceId}-${key}`}
                          sx={{ textAlign: 'center' }}
                        >
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block', fontSize: '0.6rem' }}
                          >
                            {key}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 600, fontSize: '0.8rem' }}
                          >
                            {typeof value === 'number'
                              ? value.toFixed(1)
                              : String(value)}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}

                  {/* Footer: Health + Updated time removed as redundant */}
                </Box>
              );
            };

            // Render group recursively
            const renderCardGroup = (group: CardGroup): React.ReactNode => {
              const allInstances = collectCardInstances(group);
              const hasChildren = group.children && group.children.length > 0;

              return (
                <Box
                  key={group.id}
                  sx={{ mb: group.level === 0 ? 4 : 3, ml: group.level * 2 }}
                >
                  {/* Premium Group Header */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      mb: 2.5,
                      gap: 1.5,
                      pb: 1,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      position: 'relative',
                    }}
                  >
                    {/* Visual Level indicator line */}
                    {group.level > 0 && (
                      <Box
                        sx={{
                          width: 3,
                          height: 28,
                          bgcolor: 'primary.main',
                          mr: 0.5,
                          opacity: 0.4,
                        }}
                      />
                    )}

                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        px: 2,
                        py: 0.75,
                        bgcolor:
                          group.level === 0
                            ? 'primary.main'
                            : 'action.selected',
                        color:
                          group.level === 0
                            ? 'primary.contrastText'
                            : 'text.primary',
                        boxShadow:
                          group.level === 0
                            ? (theme) =>
                                `0 4px 12px ${alpha(theme.palette.primary.main, 0.2)}`
                            : 'none',
                        border: group.level === 0 ? 'none' : '1px solid',
                        borderColor: 'divider',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          transform:
                            group.level === 0 ? 'translateY(-1px)' : 'none',
                          boxShadow:
                            group.level === 0
                              ? (theme) =>
                                  `0 6px 16px ${alpha(theme.palette.primary.main, 0.3)}`
                              : 'none',
                        },
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 800,
                          mr: 1.5,
                          opacity: 0.7,
                          textTransform: 'uppercase',
                          letterSpacing: '0.1em',
                        }}
                      >
                        {getGroupingLabel(group.fieldName)}
                      </Typography>
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 800, fontSize: '1rem' }}
                      >
                        {group.name}
                      </Typography>
                      <Box
                        sx={{
                          ml: 1.5,
                          px: 1,
                          py: 0.25,
                          bgcolor: (theme) =>
                            group.level === 0
                              ? alpha(theme.palette.common.white, 0.2)
                              : alpha(theme.palette.primary.main, 0.1),
                          color: group.level === 0 ? 'inherit' : 'primary.main',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                        }}
                      >
                        {allInstances.length}
                      </Box>
                    </Box>
                  </Box>

                  {/* Render children or cards */}
                  {hasChildren ? (
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1.5,
                      }}
                    >
                      {group.children!.map((child) => renderCardGroup(child))}
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 2,
                        '@media (max-width: 1400px)': {
                          gridTemplateColumns: 'repeat(2, 1fr)',
                        },
                        '@media (max-width: 900px)': {
                          gridTemplateColumns: '1fr',
                        },
                      }}
                    >
                      {group.instances.map((service) =>
                        renderServiceCard(service)
                      )}
                    </Box>
                  )}
                </Box>
              );
            };

            const groups =
              groupingLevels.length > 0
                ? buildCardGroups(gridDisplayServices, groupingLevels)
                : [];

            // No grouping - render virtualized flat grid
            if (groupingLevels.length === 0) {
              if (gridDisplayServices.length === 0) {
                return <EmptyPagePlaceholder message={t('serverList.noData')} />;
              }
              return (
                <VirtuosoGrid
                  style={{ flex: 1 }}
                  totalCount={gridDisplayServices.length}
                  itemContent={(index) =>
                    renderServiceCard(gridDisplayServices[index])
                  }
                  components={{
                    List: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
                      <div
                        ref={ref}
                        {...props}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: 12,
                          alignContent: 'start',
                          ...props.style,
                        }}
                      />
                    )),
                    Item: (props: React.HTMLAttributes<HTMLDivElement>) => (
                      <div {...props} />
                    ),
                  }}
                />
              );
            }

            // With grouping - render grouped view
            return (
              <Box
                sx={{
                  flex: 1,
                  minHeight: 0,
                  overflow: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {groups.map((group) => renderCardGroup(group))}
              </Box>
            );
          })()}

        {/* Cluster View - Force-directed grape cluster visualization */}
        {(services.length > 0 || !isLoading) && viewMode === 'cluster' && (
          <ClusterView
            services={gridDisplayServices}
            heartbeatIds={heartbeatIds}
            t={t}
            groupingLevels={groupingLevels}
            onContextMenu={handleContextMenu}
          />
        )}
      </PageContentLoader>

      {/* Column Settings Popover */}
      <Popover
        open={Boolean(columnSettingsAnchor)}
        anchorEl={columnSettingsAnchor}
        onClose={() => setColumnSettingsAnchor(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        hideBackdrop
        disableScrollLock
      >
        <ClickAwayListener onClickAway={() => setColumnSettingsAnchor(null)}>
          <Box sx={{ p: 2, minWidth: 280, maxWidth: 320 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 1,
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {t('serverList.columnSettings')}
              </Typography>
              <Button size="small" onClick={handleResetColumns} color="warning">
                {t('common.reset')}
              </Button>
            </Box>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis]}
            >
              <SortableContext
                items={columns.map((col) => col.id)}
                strategy={verticalListSortingStrategy}
              >
                <List dense disablePadding>
                  {columns.map((column) => (
                    <SortableColumnItem
                      key={column.id}
                      column={column}
                      onToggleVisibility={handleToggleColumnVisibility}
                    />
                  ))}
                </List>
              </SortableContext>
            </DndContext>
          </Box>
        </ClickAwayListener>
      </Popover>

      {/* Cleanup Confirmation Dialog */}
      <Dialog
        open={cleanupDialogOpen}
        onClose={handleCleanupCancel}
        aria-labelledby="cleanup-dialog-title"
        aria-describedby="cleanup-dialog-description"
      >
        <DialogTitle id="cleanup-dialog-title">
          {t('serverList.cleanupConfirmTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="cleanup-dialog-description">
            {t('serverList.cleanupConfirmMessage')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCleanupCancel} color="primary">
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleCleanupConfirm}
            color="error"
            variant="contained"
            autoFocus
          >
            {t('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Health Check Dialog */}
      <Dialog
        open={bulkHealthCheckOpen}
        onClose={handleBulkHealthCheckClose}
        maxWidth="xl"
        fullWidth
        aria-labelledby="bulk-health-check-dialog-title"
      >
        <DialogTitle
          id="bulk-health-check-dialog-title"
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <NetworkCheckIcon color="primary" />
          {t('serverList.bulkHealthCheck')}
        </DialogTitle>
        <DialogContent>
          {/* Subtitle */}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('serverList.bulkHealthCheck.subtitle')}
          </Typography>

          {/* Statistics Summary */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <Chip
              label={`${t('serverList.bulkHealthCheck.total')}: ${bulkHealthCheckStats.total}`}
              color="default"
              variant="outlined"
              sx={{ borderRadius: 1 }}
            />
            <Chip
              icon={<CheckCircleIcon />}
              label={`${t('serverList.bulkHealthCheck.success')}: ${bulkHealthCheckStats.success}`}
              color="success"
              variant={bulkHealthCheckStats.success > 0 ? 'filled' : 'outlined'}
              sx={{ borderRadius: 1 }}
            />
            <Chip
              icon={<ErrorIcon />}
              label={`${t('serverList.bulkHealthCheck.failed')}: ${bulkHealthCheckStats.failed}`}
              color="error"
              variant={bulkHealthCheckStats.failed > 0 ? 'filled' : 'outlined'}
              sx={{ borderRadius: 1 }}
            />
            {bulkHealthCheckStats.success > 0 && (
              <Chip
                label={`${t('serverList.bulkHealthCheck.avgLatency')}: ${Math.round(bulkHealthCheckStats.avgLatency)}ms`}
                color="info"
                variant="outlined"
                sx={{ borderRadius: 1 }}
              />
            )}
          </Box>

          {/* Progress Bar */}
          {bulkHealthCheckRunning && (
            <Box sx={{ mb: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  mb: 0.5,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {t('serverList.bulkHealthCheck.checking')}...
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {bulkHealthCheckStats.completed}/{bulkHealthCheckStats.total}
                </Typography>
              </Box>
              <Box
                sx={{
                  width: '100%',
                  height: 8,
                  bgcolor: 'grey.200',
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    width: `${(bulkHealthCheckStats.completed / bulkHealthCheckStats.total) * 100}%`,
                    height: '100%',
                    bgcolor: 'primary.main',
                    transition: 'width 0.3s ease',
                  }}
                />
              </Box>
            </Box>
          )}

          {/* Results List */}
          <Box
            id="bulk-health-check-scroll-container"
            sx={{
              maxHeight: 600,
              overflow: 'auto',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      width: 50,
                      bgcolor: 'background.paper',
                      padding: '4px 8px',
                    }}
                  >
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <Checkbox
                        size="small"
                        checked={
                          bulkHealthCheckSelected.size ===
                            bulkHealthCheckResults.length &&
                          bulkHealthCheckResults.length > 0
                        }
                        indeterminate={
                          bulkHealthCheckSelected.size > 0 &&
                          bulkHealthCheckSelected.size <
                            bulkHealthCheckResults.length
                        }
                        onChange={(e) =>
                          e.target.checked
                            ? handleBulkHealthCheckSelectAll()
                            : handleBulkHealthCheckDeselectAll()
                        }
                        disabled={bulkHealthCheckRunning}
                      />
                    </Box>
                  </TableCell>
                  <TableCell sx={{ width: 50, bgcolor: 'background.paper' }}>
                    {t('serverList.bulkHealthCheck.status')}
                  </TableCell>
                  <TableCell sx={{ bgcolor: 'background.paper' }}>
                    {t('serverList.table.service')}
                  </TableCell>
                  <TableCell sx={{ bgcolor: 'background.paper' }}>
                    {t('serverList.table.group')}
                  </TableCell>
                  <TableCell sx={{ bgcolor: 'background.paper' }}>
                    {t('serverList.filters.env')}
                  </TableCell>
                  <TableCell sx={{ bgcolor: 'background.paper' }}>
                    {t('serverList.table.hostname')}
                  </TableCell>
                  <TableCell sx={{ bgcolor: 'background.paper' }}>
                    {t('serverList.table.internalAddress')}
                  </TableCell>
                  <TableCell sx={{ width: 70, bgcolor: 'background.paper' }}>
                    {t('serverList.bulkHealthCheck.port')}
                  </TableCell>
                  <TableCell sx={{ width: 80, bgcolor: 'background.paper' }}>
                    {t('serverList.bulkHealthCheck.latency')}
                  </TableCell>
                  <TableCell sx={{ bgcolor: 'background.paper' }}>
                    {t('serverList.bulkHealthCheck.result')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bulkHealthCheckResults.map((item, index) => (
                  <TableRow
                    hover
                    key={item.serviceKey}
                    id={`bulk-health-row-${index}`}
                    sx={{
                      bgcolor:
                        item.status === 'checking'
                          ? alpha('#1976d2', 0.1)
                          : item.status === 'success'
                            ? alpha('#2e7d32', 0.05)
                            : item.status === 'failed'
                              ? alpha('#d32f2f', 0.05)
                              : 'transparent',
                      transition: 'background-color 0.3s ease',
                    }}
                  >
                    <TableCell sx={{ padding: '4px 8px' }}>
                      <Checkbox
                        size="small"
                        checked={bulkHealthCheckSelected.has(item.serviceKey)}
                        onChange={() =>
                          handleBulkHealthCheckToggle(item.serviceKey)
                        }
                        disabled={
                          bulkHealthCheckRunning || item.status !== 'pending'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {item.status === 'pending' && (
                        <HourglassEmptyIcon
                          sx={{ color: 'text.disabled', fontSize: 20 }}
                        />
                      )}
                      {item.status === 'checking' && (
                        <SearchIcon
                          sx={{
                            fontSize: 18,
                            animation:
                              'searchingAnimSmall 2s ease-in-out infinite',
                            '@keyframes searchingAnimSmall': {
                              '0%': {
                                transform: 'translate(0, 0) rotate(0deg)',
                              },
                              '25%': {
                                transform: 'translate(1px, -1px) rotate(10deg)',
                              },
                              '50%': {
                                transform:
                                  'translate(-1px, 1px) rotate(-10deg)',
                              },
                              '75%': {
                                transform: 'translate(1px, 1px) rotate(10deg)',
                              },
                              '100%': {
                                transform: 'translate(0, 0) rotate(0deg)',
                              },
                            },
                          }}
                        />
                      )}
                      {item.status === 'success' && (
                        <CheckCircleIcon
                          sx={{ color: 'success.main', fontSize: 20 }}
                        />
                      )}
                      {item.status === 'failed' && (
                        <ErrorIcon sx={{ color: 'error.main', fontSize: 20 }} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1,
                        }}
                      >
                        <Typography variant="body2" fontWeight="medium">
                          {item.service}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => {
                            if (item.service)
                              copyToClipboardWithNotification(
                                item.service as string,
                                () =>
                                  enqueueSnackbar(
                                    t('common.copiedToClipboard'),
                                    {
                                      variant: 'success',
                                    }
                                  ),
                                () => {}
                              );
                          }}
                          sx={{
                            opacity: 0.3,
                            '&:hover': { opacity: 1 },
                            p: 0.5,
                            visibility: item.service ? 'visible' : 'hidden',
                          }}
                        >
                          <ContentCopyIcon sx={{ fontSize: 13 }} />
                        </IconButton>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1,
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          {item.group || '-'}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => {
                            if (item.group)
                              copyToClipboardWithNotification(
                                item.group as string,
                                () =>
                                  enqueueSnackbar(
                                    t('common.copiedToClipboard'),
                                    {
                                      variant: 'success',
                                    }
                                  ),
                                () => {}
                              );
                          }}
                          sx={{
                            opacity: 0.3,
                            '&:hover': { opacity: 1 },
                            p: 0.5,
                            visibility: item.group ? 'visible' : 'hidden',
                          }}
                        >
                          <ContentCopyIcon sx={{ fontSize: 13 }} />
                        </IconButton>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1,
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          {item.env || '-'}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => {
                            if (item.env)
                              copyToClipboardWithNotification(
                                item.env as string,
                                () =>
                                  enqueueSnackbar(
                                    t('common.copiedToClipboard'),
                                    {
                                      variant: 'success',
                                    }
                                  ),
                                () => {}
                              );
                          }}
                          sx={{
                            opacity: 0.3,
                            '&:hover': { opacity: 1 },
                            p: 0.5,
                            visibility: item.env ? 'visible' : 'hidden',
                          }}
                        >
                          <ContentCopyIcon sx={{ fontSize: 13 }} />
                        </IconButton>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: 'D2Coding, monospace',
                            fontSize: '0.75rem',
                          }}
                        >
                          {item.hostname || '-'}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => {
                            if (item.hostname)
                              copyToClipboardWithNotification(
                                item.hostname as string,
                                () =>
                                  enqueueSnackbar(
                                    t('common.copiedToClipboard'),
                                    {
                                      variant: 'success',
                                    }
                                  ),
                                () => {}
                              );
                          }}
                          sx={{
                            opacity: 0.3,
                            '&:hover': { opacity: 1 },
                            p: 0.5,
                            visibility: item.hostname ? 'visible' : 'hidden',
                          }}
                        >
                          <ContentCopyIcon sx={{ fontSize: 13 }} />
                        </IconButton>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: 'D2Coding, monospace',
                            fontSize: '0.75rem',
                          }}
                        >
                          {item.internalIp || '-'}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => {
                            if (item.internalIp)
                              copyToClipboardWithNotification(
                                item.internalIp as string,
                                () =>
                                  enqueueSnackbar(
                                    t('common.copiedToClipboard'),
                                    {
                                      variant: 'success',
                                    }
                                  ),
                                () => {}
                              );
                          }}
                          sx={{
                            opacity: 0.3,
                            '&:hover': { opacity: 1 },
                            p: 0.5,
                            visibility: item.internalIp ? 'visible' : 'hidden',
                          }}
                        >
                          <ContentCopyIcon sx={{ fontSize: 13 }} />
                        </IconButton>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: 'D2Coding, monospace',
                            fontSize: '0.75rem',
                          }}
                        >
                          {item.healthPort || '-'}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => {
                            if (item.healthPort)
                              copyToClipboardWithNotification(
                                String(item.healthPort) as string,
                                () =>
                                  enqueueSnackbar(
                                    t('common.copiedToClipboard'),
                                    {
                                      variant: 'success',
                                    }
                                  ),
                                () => {}
                              );
                          }}
                          sx={{
                            opacity: 0.3,
                            '&:hover': { opacity: 1 },
                            p: 0.5,
                            visibility: item.healthPort ? 'visible' : 'hidden',
                          }}
                        >
                          <ContentCopyIcon sx={{ fontSize: 13 }} />
                        </IconButton>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {item.latency !== undefined && (
                        <Typography
                          variant="body2"
                          sx={{
                            color:
                              item.latency < 100
                                ? 'success.main'
                                : item.latency < 500
                                  ? 'warning.main'
                                  : 'error.main',
                          }}
                        >
                          {item.latency}ms
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.error && (
                        <Typography
                          variant="body2"
                          color="error.main"
                          sx={{ fontSize: '0.75rem' }}
                        >
                          {item.error}
                        </Typography>
                      )}
                      {item.status === 'success' && !item.error && (
                        <Typography
                          variant="body2"
                          color="success.main"
                          sx={{ fontSize: '0.75rem' }}
                        >
                          OK
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            {t('serverList.bulkHealthCheck.selected')}:{' '}
            {bulkHealthCheckSelected.size} / {bulkHealthCheckResults.length}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              onClick={handleBulkHealthCheckClose}
              disabled={bulkHealthCheckRunning}
            >
              {t('common.close')}
            </Button>
            <Button
              onClick={handleBulkHealthCheckStart}
              variant="contained"
              disabled={
                bulkHealthCheckRunning || bulkHealthCheckSelected.size === 0
              }
              startIcon={
                bulkHealthCheckRunning ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <NetworkCheckIcon />
                )
              }
            >
              {bulkHealthCheckRunning
                ? t('serverList.bulkHealthCheck.checking')
                : t('serverList.bulkHealthCheck.start')}
            </Button>
            <Box
              sx={{
                width: '1px',
                height: '24px',
                bgcolor: 'divider',
                mx: 1,
              }}
            />
            <Button
              onClick={handleExportMenuOpen}
              disabled={!hasCompletedHealthCheck || bulkHealthCheckRunning}
              startIcon={<FileDownloadIcon />}
            >
              {t('common.export')}
            </Button>
            <Menu
              anchorEl={exportMenuAnchor}
              open={Boolean(exportMenuAnchor)}
              onClose={handleExportMenuClose}
            >
              <MenuItem onClick={() => handleExportHealthCheck('csv')}>
                <ListItemIcon>
                  <FileDownloadIcon fontSize="small" />
                </ListItemIcon>
                CSV
              </MenuItem>
              <MenuItem onClick={() => handleExportHealthCheck('xlsx')}>
                <ListItemIcon>
                  <FileDownloadIcon fontSize="small" />
                </ListItemIcon>
                Excel (XLSX)
              </MenuItem>
              <MenuItem onClick={() => handleExportHealthCheck('json')}>
                <ListItemIcon>
                  <FileDownloadIcon fontSize="small" />
                </ListItemIcon>
                JSON
              </MenuItem>
            </Menu>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Service Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleContextMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handleCopyServiceJson}>
          <ListItemIcon>
            <ContentCopyIcon sx={{ fontSize: 13 }} />
          </ListItemIcon>
          {t('serverList.contextMenu.copyJson')}
        </MenuItem>
        <MenuItem onClick={handleCopyInstanceId}>
          <ListItemIcon>
            <ContentCopyIcon sx={{ fontSize: 13 }} />
          </ListItemIcon>
          {t('serverList.contextMenu.copyInstanceId')}
        </MenuItem>
        <MenuItem onClick={handleCopyHostname}>
          <ListItemIcon>
            <ContentCopyIcon sx={{ fontSize: 13 }} />
          </ListItemIcon>
          {t('serverList.contextMenu.copyHostname')}
        </MenuItem>
        <MenuItem onClick={handleCopyAddress}>
          <ListItemIcon>
            <ContentCopyIcon sx={{ fontSize: 13 }} />
          </ListItemIcon>
          {t('serverList.contextMenu.copyAddress')}
        </MenuItem>
        {contextMenu?.service && (
          <MenuItem
            onClick={() => {
              if (contextMenu?.service) {
                handleHealthCheck(contextMenu.service);
              }
              handleContextMenuClose();
            }}
          >
            <ListItemIcon>
              <NetworkCheckIcon fontSize="small" />
            </ListItemIcon>
            {t('serverList.contextMenu.healthCheck')}
          </MenuItem>
        )}
      </Menu>

      {/* Grouping Level Menu */}
      <Menu
        anchorEl={groupingMenuAnchor}
        open={Boolean(groupingMenuAnchor)}
        onClose={() => setGroupingMenuAnchor(null)}
      >
        {allGroupingFields
          .filter((field) => !groupingLevels.includes(field))
          .map((field) => (
            <MenuItem
              key={field}
              onClick={() => {
                setGroupingLevels([...groupingLevels, field]);
                setGroupingMenuAnchor(null);
              }}
            >
              {getGroupingLabel(field)}
            </MenuItem>
          ))}
      </Menu>
    </Box>
  );
};

export default ServerListPage;
