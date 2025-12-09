import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../types/permissions';
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
  TextField,
  InputAdornment,
  CircularProgress,
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
  TableSortLabel,
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
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
  Pause as PauseIcon,
  PlayArrow as PlayArrowIcon,
  CleaningServices as CleaningServicesIcon,
  NetworkCheck as NetworkCheckIcon,
  Favorite as FavoriteIcon,
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
import DynamicFilterBar, { FilterDefinition, ActiveFilter } from '../../components/common/DynamicFilterBar';
import { useDebounce } from '../../hooks/useDebounce';
import serviceDiscoveryService, { ServiceInstance } from '../../services/serviceDiscoveryService';
import { formatDateTimeDetailed } from '../../utils/dateFormat';
import { RelativeTime } from '../../components/common/RelativeTime';

// View mode type
type ViewMode = 'list' | 'grid' | 'card';

// Column definition interface
interface ColumnConfig {
  id: string;
  labelKey: string;
  visible: boolean;
  width?: string;
}

// Sortable list item component for drag and drop
interface SortableColumnItemProps {
  column: ColumnConfig;
  onToggleVisibility: (id: string) => void;
}

const SortableColumnItem: React.FC<SortableColumnItemProps> = ({ column, onToggleVisibility }) => {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

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
        <Box {...attributes} {...listeners} sx={{ cursor: 'grab', display: 'flex', alignItems: 'center', '&:active': { cursor: 'grabbing' } }}>
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
  const canManage = hasPermission([PERMISSIONS.SERVERS_MANAGE]);
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
    return (localStorage.getItem('serverListSortOrder') as 'asc' | 'desc') || 'asc';
  });

  // View mode state (persisted in localStorage)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('serverListViewMode') as ViewMode) || 'list';
  });

  // Track updated service IDs for highlight effect (with status)
  const [updatedServiceIds, setUpdatedServiceIds] = useState<Map<string, ServiceStatus>>(new Map());

  // Track newly added service IDs for appearance animation
  const [newServiceIds, setNewServiceIds] = useState<Set<string>>(new Set());

  // Track heartbeat for pulse animation
  const [heartbeatIds, setHeartbeatIds] = useState<Set<string>>(new Set());

  // Cleanup confirmation dialog
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);

  // Health check state: Map<serviceKey, { loading: boolean, result?: { healthy: boolean, latency: number, error?: string } }>
  const [healthCheckStatus, setHealthCheckStatus] = useState<Map<string, {
    loading: boolean;
    result?: { healthy: boolean; latency: number; error?: string }
  }>>(new Map());

  // Default column configuration
  const defaultColumns: ColumnConfig[] = [
    { id: 'status', labelKey: 'serverList.table.status', visible: true },
    { id: 'service', labelKey: 'serverList.table.service', visible: true },
    { id: 'group', labelKey: 'serverList.table.group', visible: true },
    { id: 'labels', labelKey: 'serverList.table.labels', visible: true },
    { id: 'instanceId', labelKey: 'serverList.table.instanceId', visible: true },
    { id: 'hostname', labelKey: 'serverList.table.hostname', visible: true },
    { id: 'externalAddress', labelKey: 'serverList.table.externalAddress', visible: true },
    { id: 'internalAddress', labelKey: 'serverList.table.internalAddress', visible: true },
    { id: 'ports', labelKey: 'serverList.table.ports', visible: true },
    { id: 'stats', labelKey: 'serverList.table.stats', visible: true },
    { id: 'meta', labelKey: 'serverList.table.meta', visible: true },
    { id: 'createdAt', labelKey: 'serverList.table.createdAt', visible: true },
    { id: 'updatedAt', labelKey: 'serverList.table.updatedAt', visible: true },
    { id: 'actions', labelKey: 'serverList.table.actions', visible: true },
  ];

  // Column configuration state (persisted in localStorage)
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('serverListColumns');
    if (saved) {
      try {
        const savedColumns = JSON.parse(saved);
        // Merge saved columns with defaults, preserving saved order
        const mergedColumns = savedColumns.map((savedCol: ColumnConfig) => {
          const defaultCol = defaultColumns.find(c => c.id === savedCol.id);
          return defaultCol ? { ...defaultCol, ...savedCol } : savedCol;
        });

        // Add any new columns from defaults that aren't in saved
        const savedIds = new Set(savedColumns.map((c: ColumnConfig) => c.id));
        const newColumns = defaultColumns.filter(c => !savedIds.has(c.id));

        return [...mergedColumns, ...newColumns];
      } catch {
        return defaultColumns;
      }
    }
    return defaultColumns;
  });

  // Column settings popover state
  const [columnSettingsAnchor, setColumnSettingsAnchor] = useState<HTMLButtonElement | null>(null);

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
      revalidateOnFocus: false, // SSE handles real-time updates, no need to refetch on focus
      revalidateOnReconnect: true, // Refetch on reconnect
      refreshInterval: 0, // Disable auto-refresh, SSE handles real-time updates
      dedupingInterval: 0, // Don't dedupe requests
    }
  );

  // Fetch service types for filter
  const { data: serviceTypes } = useSWR(
    '/admin/services/types',
    () => serviceDiscoveryService.getServiceTypes()
  );

  // Initialize services from SWR data (only on initial load)
  // Use a ref to track if we've already initialized to prevent re-initialization on data changes
  const initializedRef = useRef(false);

  useEffect(() => {
    if (data && !initializedRef.current) {
      setServices(data);
      initializedRef.current = true;
    }
  }, []);

  // Setup SSE connection for real-time updates (only once on mount)
  useEffect(() => {
    let eventSource: EventSource | null = null;

    try {
      eventSource = serviceDiscoveryService.createSSEConnection(
        (event) => {
          if (event.type === 'init') {
            // Initial data - only apply if services is empty (first connection)
            // This prevents overwriting user's filtered/deleted servers on reconnection
            setServices((prev) => {
              if (prev.length === 0) {
                // First connection - apply initial data
                return event.data;
              }
              // Reconnection - ignore init event to preserve current state
              return prev;
            });
            setPendingUpdates([]);
          } else if (isPausedRef.current) {
            // If paused, store updates in pending queue
            setPendingUpdates((prev) => {
              if (event.type === 'put') {
                const index = prev.findIndex((s) => s.instanceId === event.data.instanceId && s.labels.service === event.data.labels.service);
                if (index >= 0) {
                  const newPending = [...prev];
                  newPending[index] = event.data;
                  return newPending;
                } else {
                  return [...prev, event.data];
                }
              } else if (event.type === 'delete') {
                return prev.filter((s) => !(s.instanceId === event.data.instanceId && s.labels.service === event.data.labels.service));
              }
              return prev;
            });
          } else {
            // Not paused - apply updates immediately
            if (event.type === 'put') {
              setServices((prev) => {
                const index = prev.findIndex((s) => s.instanceId === event.data.instanceId && s.labels.service === event.data.labels.service);
                const serviceKey = `${event.data.labels.service}-${event.data.instanceId}`;

                if (index >= 0) {
                  // Update existing - only highlight if status actually changed (not just heartbeat update)
                  const prevService = prev[index];
                  const statusChanged = prevService.status !== event.data.status;

                  if (statusChanged) {
                    setUpdatedServiceIds((prevIds) => new Map(prevIds).set(serviceKey, event.data.status));
                    setTimeout(() => {
                      setUpdatedServiceIds((prevIds) => {
                        const newMap = new Map(prevIds);
                        newMap.delete(serviceKey);
                        return newMap;
                      });
                    }, 2000);
                  }

                  // Trigger heartbeat pulse animation (for any update including heartbeat)
                  setHeartbeatIds((prevIds) => new Set(prevIds).add(serviceKey));
                  setTimeout(() => {
                    setHeartbeatIds((prevIds) => {
                      const newSet = new Set(prevIds);
                      newSet.delete(serviceKey);
                      return newSet;
                    });
                  }, 600); // Short pulse duration

                  const newServices = [...prev];
                  newServices[index] = event.data;
                  return newServices;
                } else {
                  // Add new service - trigger appearance animation
                  setNewServiceIds((prevIds) => new Set(prevIds).add(serviceKey));
                  setTimeout(() => {
                    setNewServiceIds((prevIds) => {
                      const newSet = new Set(prevIds);
                      newSet.delete(serviceKey);
                      return newSet;
                    });
                  }, 1000); // Animation duration

                  // Add new service and sort by createdAt (ascending - oldest first, newest last)
                  const newServices = [...prev, event.data];
                  newServices.sort((a, b) => {
                    const aTime = new Date(a.createdAt).getTime();
                    const bTime = new Date(b.createdAt).getTime();
                    return aTime - bTime;
                  });
                  return newServices;
                }
              });
            } else if (event.type === 'delete') {
              // Service deleted/expired - remove from list immediately
              // Terminated services are kept for 5 minutes with TTL, so this only fires after TTL expires
              setServices((prev) => prev.filter((s) => !(s.instanceId === event.data.instanceId && s.labels.service === event.data.labels.service)));
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
          const index = updated.findIndex((s) => s.instanceId === pendingService.instanceId && s.labels.service === pendingService.labels.service);
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

  // Health check a service
  const handleHealthCheck = async (service: ServiceInstance) => {
    const serviceKey = `${service.labels.service}-${service.instanceId}`;

    // Set loading state
    setHealthCheckStatus(prev => new Map(prev).set(serviceKey, { loading: true }));

    try {
      const result = await serviceDiscoveryService.healthCheck(service.labels.service, service.instanceId);

      setHealthCheckStatus(prev => new Map(prev).set(serviceKey, {
        loading: false,
        result: {
          healthy: result.healthy,
          latency: result.latency,
          error: result.error
        }
      }));

      // Show snackbar with result
      if (result.healthy) {
        enqueueSnackbar(
          t('serverList.healthCheck.success', { latency: result.latency }),
          { variant: 'success' }
        );
      } else {
        enqueueSnackbar(
          t('serverList.healthCheck.failed', { error: result.error || 'Unknown error' }),
          { variant: 'error' }
        );
      }

      // Clear result after 10 seconds
      setTimeout(() => {
        setHealthCheckStatus(prev => {
          const newMap = new Map(prev);
          newMap.delete(serviceKey);
          return newMap;
        });
      }, 10000);
    } catch (error: any) {
      setHealthCheckStatus(prev => new Map(prev).set(serviceKey, {
        loading: false,
        result: {
          healthy: false,
          latency: 0,
          error: error.message || 'Request failed'
        }
      }));

      enqueueSnackbar(
        t('serverList.healthCheck.error'),
        { variant: 'error' }
      );
    }
  };

  // Check if service has a web port for health check
  const hasWebPort = (service: ServiceInstance): boolean => {
    const ports = service.ports;
    return !!(ports?.web || ports?.http || ports?.api);
  };

  // Clean up terminated, error, and no-response servers
  const handleCleanupClick = () => {
    setCleanupDialogOpen(true);
  };

  const handleCleanupConfirm = async () => {
    try {
      console.log('🗑️ Starting cleanup...');

      // Call backend cleanup endpoint (handles all terminated/error/no-response servers)
      const result = await serviceDiscoveryService.cleanupServices();

      console.log(`✅ Cleanup complete: ${result.deletedCount}/${result.totalCount} servers deleted`);

      // Remove from frontend state immediately
      setServices((prev) => prev.filter((s) => s.status !== 'terminated' && s.status !== 'error' && s.status !== 'no-response'));

      // Show success message
      enqueueSnackbar(
        t('serverList.cleanupSuccess', { count: result.deletedCount }),
        { variant: 'success' }
      );
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      enqueueSnackbar(t('serverList.cleanupFailed'), { variant: 'error' });
    } finally {
      // Always close dialog, regardless of success or failure
      setCleanupDialogOpen(false);
    }
  };

  const handleCleanupCancel = () => {
    setCleanupDialogOpen(false);
  };

  // Extract unique values from current services for filter options
  const uniqueServices = useMemo(() =>
    [...new Set(services.map(s => s.labels.service))].sort(),
    [services]
  );
  const uniqueInstanceIds = useMemo(() =>
    [...new Set(services.map(s => s.instanceId))].sort(),
    [services]
  );
  const uniqueStatuses = useMemo(() =>
    [...new Set(services.map(s => s.status))].sort(),
    [services]
  );
  const uniqueGroups = useMemo(() =>
    [...new Set(services.map(s => s.labels.group).filter(Boolean))].sort() as string[],
    [services]
  );
  const uniqueRegions = useMemo(() =>
    [...new Set(services.map(s => s.labels.region).filter(Boolean))].sort() as string[],
    [services]
  );
  const uniqueEnvs = useMemo(() =>
    [...new Set(services.map(s => s.labels.env).filter(Boolean))].sort() as string[],
    [services]
  );
  const uniqueRoles = useMemo(() =>
    [...new Set(services.map(s => s.labels.role).filter(Boolean))].sort() as string[],
    [services]
  );
  const uniqueInternalAddresses = useMemo(() =>
    [...new Set(services.map(s => s.internalAddress).filter(Boolean))].sort(),
    [services]
  );
  const uniqueExternalAddresses = useMemo(() =>
    [...new Set(services.map(s => s.externalAddress).filter(Boolean))].sort(),
    [services]
  );
  const uniqueHostnames = useMemo(() =>
    [...new Set(services.map(s => s.hostname).filter(Boolean))].sort(),
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
        label: statusLabels[status] || status
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
      key: 'region',
      label: t('serverList.filters.region'),
      type: 'select',
      options: uniqueRegions.map((r) => ({ value: r, label: r })),
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

  // Filter handlers
  const handleFilterAdd = (filter: ActiveFilter) => {
    setActiveFilters([...activeFilters, filter]);
  };

  const handleFilterRemove = (filterKey: string) => {
    setActiveFilters(activeFilters.filter(f => f.key !== filterKey));
  };

  const handleFilterChange = (filterKey: string, value: any) => {
    setActiveFilters(activeFilters.map(f =>
      f.key === filterKey ? { ...f, value } : f
    ));
  };

  // Column configuration handlers
  const handleToggleColumnVisibility = (columnId: string) => {
    const newColumns = columns.map(col =>
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
  const inactiveCount = services.filter((s) => s.status === 'terminated' || s.status === 'error' || s.status === 'no-response').length;

  // Apply filters and search
  const filteredServices = services.filter((service) => {
    // Search filter
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      const matchesSearch =
        service.instanceId.toLowerCase().includes(searchLower) ||
        service.labels.service.toLowerCase().includes(searchLower) ||
        (service.labels.group && service.labels.group.toLowerCase().includes(searchLower)) ||
        service.hostname.toLowerCase().includes(searchLower) ||
        service.externalAddress.toLowerCase().includes(searchLower) ||
        service.internalAddress.toLowerCase().includes(searchLower) ||
        Object.entries(service.labels).some(([key, value]) =>
          value && value.toLowerCase().includes(searchLower)
        ) ||
        // Search in ports (name:port format)
        Object.entries(service.ports || {}).some(([name, port]) =>
          name.toLowerCase().includes(searchLower) ||
          String(port).includes(searchLower)
        );
      if (!matchesSearch) return false;
    }

    // Dynamic filters (all are now select type with exact match)
    for (const filter of activeFilters) {
      if (filter.key === 'service' && filter.value && service.labels.service !== filter.value) {
        return false;
      }
      if (filter.key === 'status' && filter.value && service.status !== filter.value) {
        return false;
      }
      if (filter.key === 'instanceId' && filter.value && service.instanceId !== filter.value) {
        return false;
      }
      if (filter.key === 'group' && filter.value && service.labels.group !== filter.value) {
        return false;
      }
      if (filter.key === 'region' && filter.value && service.labels.region !== filter.value) {
        return false;
      }
      if (filter.key === 'env' && filter.value && service.labels.env !== filter.value) {
        return false;
      }
      if (filter.key === 'role' && filter.value && service.labels.role !== filter.value) {
        return false;
      }
      if (filter.key === 'hostname' && filter.value && service.hostname !== filter.value) {
        return false;
      }
      if (filter.key === 'internalAddress' && filter.value && service.internalAddress !== filter.value) {
        return false;
      }
      if (filter.key === 'externalAddress' && filter.value && service.externalAddress !== filter.value) {
        return false;
      }
    }

    return true;
  });

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
      ready: { color: 'success' as const, icon: <CheckCircleIcon sx={{ fontSize: 16 }} />, label: t('serverList.status.ready'), tooltipKey: 'ready' },
      error: { color: 'error' as const, icon: <ErrorIcon sx={{ fontSize: 16 }} />, label: t('serverList.status.error'), tooltipKey: 'error' },
      initializing: { color: 'warning' as const, icon: <HourglassEmptyIcon sx={{ fontSize: 16 }} />, label: t('serverList.status.initializing'), tooltipKey: 'initializing' },
      shutting_down: { color: 'info' as const, icon: <PowerSettingsNewIcon sx={{ fontSize: 16 }} />, label: t('serverList.status.shuttingDown'), tooltipKey: 'shuttingDown' },
      terminated: { color: 'default' as const, icon: <PowerSettingsNewIcon sx={{ fontSize: 16 }} />, label: t('serverList.status.terminated'), tooltipKey: 'terminated' },
      'no-response': { color: 'warning' as const, icon: <WarningIcon sx={{ fontSize: 16 }} />, label: t('serverList.status.noResponse'), tooltipKey: 'noResponse' },
    };

    const config = statusConfig[status];
    if (!config) {
      // Fallback for unknown status
      return (
        <Chip
          label={status}
          color="default"
          size="small"
          sx={{ fontWeight: 600, borderRadius: 1 }}
        />
      );
    }

    return (
      <Tooltip title={t(`serverList.statusTooltip.${config.tooltipKey}`)} arrow placement="top">
        <Chip
          icon={config.icon}
          label={config.label}
          color={config.color}
          size="small"
          sx={{ fontWeight: 600, borderRadius: 1 }}
        />
      </Tooltip>
    );
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
        return isDark ? alpha(theme.palette.warning.main, 0.06) : alpha(theme.palette.warning.main, 0.04);
      case 'shutting_down':
        return isDark ? alpha(theme.palette.info.main, 0.06) : alpha(theme.palette.info.main, 0.04);
      case 'error':
        return isDark ? alpha(theme.palette.error.main, 0.08) : alpha(theme.palette.error.main, 0.05);
      case 'terminated':
        return isDark ? alpha(theme.palette.grey[500], 0.08) : alpha(theme.palette.grey[500], 0.05);
      case 'no-response':
        return isDark ? alpha(theme.palette.warning.main, 0.08) : alpha(theme.palette.warning.main, 0.05);
      default:
        return 'transparent';
    }
  };

  // Get highlight color based on status (for update animation)
  const getHighlightColor = (status: ServiceStatus, theme: any) => {
    const isDark = theme.palette.mode === 'dark';
    switch (status) {
      case 'initializing':
        return isDark ? alpha(theme.palette.warning.main, 0.12) : alpha(theme.palette.warning.main, 0.08);
      case 'ready':
        return isDark ? alpha(theme.palette.success.main, 0.12) : alpha(theme.palette.success.main, 0.08);
      case 'shutting_down':
        return isDark ? alpha(theme.palette.info.main, 0.12) : alpha(theme.palette.info.main, 0.08);
      case 'error':
        return isDark ? alpha(theme.palette.error.main, 0.12) : alpha(theme.palette.error.main, 0.08);
      case 'terminated':
        return isDark ? alpha(theme.palette.grey[500], 0.12) : alpha(theme.palette.grey[500], 0.08);
      default:
        return isDark ? alpha(theme.palette.primary.main, 0.12) : alpha(theme.palette.primary.main, 0.08);
    }
  };

  const getHighlightColorStart = (status: ServiceStatus, theme: any) => {
    const isDark = theme.palette.mode === 'dark';
    switch (status) {
      case 'initializing':
        return isDark ? alpha(theme.palette.warning.main, 0.2) : alpha(theme.palette.warning.main, 0.15);
      case 'ready':
        return isDark ? alpha(theme.palette.success.main, 0.2) : alpha(theme.palette.success.main, 0.15);
      case 'shutting_down':
        return isDark ? alpha(theme.palette.info.main, 0.2) : alpha(theme.palette.info.main, 0.15);
      case 'error':
        return isDark ? alpha(theme.palette.error.main, 0.2) : alpha(theme.palette.error.main, 0.15);
      case 'terminated':
        return isDark ? alpha(theme.palette.grey[500], 0.2) : alpha(theme.palette.grey[500], 0.15);
      default:
        return isDark ? alpha(theme.palette.primary.main, 0.2) : alpha(theme.palette.primary.main, 0.15);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <DnsIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {t('serverList.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('serverList.subtitle')}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {/* Search */}
            <TextField
              placeholder={t('serverList.searchPlaceholder')}
              size="small"
              sx={{
                minWidth: 450,
                flexGrow: 1,
                maxWidth: 450,
                '& .MuiOutlinedInput-root': {
                  height: '40px',
                  borderRadius: '20px',
                  bgcolor: 'background.paper',
                  transition: 'all 0.2s ease-in-out',
                  '& fieldset': {
                    borderColor: 'divider',
                  },
                  '&:hover': {
                    bgcolor: 'action.hover',
                    '& fieldset': {
                      borderColor: 'primary.light',
                    }
                  },
                  '&.Mui-focused': {
                    bgcolor: 'background.paper',
                    boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.1)',
                    '& fieldset': {
                      borderColor: 'primary.main',
                      borderWidth: '1px',
                    }
                  }
                },
                '& .MuiInputBase-input': {
                  fontSize: '0.875rem',
                }
              }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
            />

            {/* Dynamic Filter Bar */}
            <DynamicFilterBar
              availableFilters={availableFilterDefinitions}
              activeFilters={activeFilters}
              onFilterAdd={handleFilterAdd}
              onFilterRemove={handleFilterRemove}
              onFilterChange={handleFilterChange}
            />

            {/* Column Settings Button - Only show in list view */}
            {viewMode === 'list' && (
              <Tooltip title={t('serverList.columnSettings')}>
                <IconButton
                  onClick={(e) => setColumnSettingsAnchor(e.currentTarget)}
                  sx={{
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <ViewColumnIcon />
                </IconButton>
              </Tooltip>
            )}

            {/* Spacer to push right-side buttons to the right */}
            <Box sx={{ flexGrow: 1 }} />

            {/* Divider */}
            <Box
              sx={{
                width: '1px',
                height: '24px',
                bgcolor: (theme) => theme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.2)'
                  : 'rgba(0, 0, 0, 0.2)',
              }}
            />

            {/* View Mode Buttons */}
            <Tooltip title={t('serverList.viewMode.list')}>
              <IconButton
                onClick={() => handleViewModeChange('list')}
                sx={{
                  bgcolor: viewMode === 'list' ? 'primary.main' : 'background.paper',
                  color: viewMode === 'list' ? 'primary.contrastText' : 'text.primary',
                  border: 1,
                  borderColor: viewMode === 'list' ? 'primary.main' : 'divider',
                  '&:hover': {
                    bgcolor: viewMode === 'list' ? 'primary.dark' : 'action.hover',
                  },
                }}
              >
                <ViewListIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('serverList.viewMode.grid')}>
              <IconButton
                onClick={() => handleViewModeChange('grid')}
                sx={{
                  bgcolor: viewMode === 'grid' ? 'primary.main' : 'background.paper',
                  color: viewMode === 'grid' ? 'primary.contrastText' : 'text.primary',
                  border: 1,
                  borderColor: viewMode === 'grid' ? 'primary.main' : 'divider',
                  '&:hover': {
                    bgcolor: viewMode === 'grid' ? 'primary.dark' : 'action.hover',
                  },
                }}
              >
                <ViewModuleIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('serverList.viewMode.card')}>
              <IconButton
                onClick={() => handleViewModeChange('card')}
                sx={{
                  bgcolor: viewMode === 'card' ? 'primary.main' : 'background.paper',
                  color: viewMode === 'card' ? 'primary.contrastText' : 'text.primary',
                  border: 1,
                  borderColor: viewMode === 'card' ? 'primary.main' : 'divider',
                  '&:hover': {
                    bgcolor: viewMode === 'card' ? 'primary.dark' : 'action.hover',
                  },
                }}
              >
                <ViewComfyIcon />
              </IconButton>
            </Tooltip>

            {/* Divider */}
            <Box
              sx={{
                width: '1px',
                height: '24px',
                bgcolor: (theme) => theme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.2)'
                  : 'rgba(0, 0, 0, 0.2)',
              }}
            />

            {/* Pause/Resume Button */}
            <Tooltip title={isPaused ? t('serverList.resumeUpdates') : t('serverList.pauseUpdates')}>
              <Badge badgeContent={pendingUpdates.length} color="warning" invisible={!isPaused || pendingUpdates.length === 0}>
                <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                  {/* Rotating ring animation when real-time is active */}
                  {!isPaused && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: -4,
                        left: -4,
                        right: -4,
                        bottom: -4,
                        borderRadius: '50%',
                        border: '2px solid transparent',
                        borderTopColor: 'primary.main',
                        borderRightColor: 'primary.main',
                        animation: 'spin 1.5s linear infinite',
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
                  )}
                  <IconButton
                    onClick={handleTogglePause}
                    sx={{
                      bgcolor: isPaused ? 'warning.main' : 'background.paper',
                      color: isPaused ? 'warning.contrastText' : 'text.primary',
                      border: 1,
                      borderColor: isPaused ? 'warning.main' : 'divider',
                      '&:hover': {
                        bgcolor: isPaused ? 'warning.dark' : 'action.hover',
                      },
                    }}
                  >
                    {isPaused ? <PlayArrowIcon /> : <PauseIcon />}
                  </IconButton>
                </Box>
              </Badge>
            </Tooltip>

            {/* Divider */}
            <Box
              sx={{
                width: '1px',
                height: '24px',
                bgcolor: (theme) => theme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.2)'
                  : 'rgba(0, 0, 0, 0.2)',
              }}
            />

            {/* Cleanup Button */}
            <Tooltip title={inactiveCount === 0 ? t('serverList.noInactiveServers') : t('serverList.cleanup')}>
              <span>
                <IconButton
                  onClick={handleCleanupClick}
                  disabled={inactiveCount === 0}
                  sx={{
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    '&:hover': {
                      bgcolor: inactiveCount === 0 ? 'background.paper' : 'action.hover',
                    },
                  }}
                >
                  <CleaningServicesIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* List View */}
      {!isLoading && viewMode === 'list' && (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {columns.filter(col => col.visible).map((column) => (
                    <TableCell key={column.id}>
                      {column.id !== 'ports' && column.id !== 'stats' && column.id !== 'meta' && column.id !== 'labels' && column.id !== 'actions' ? (
                        <TableSortLabel
                          active={sortBy === column.id}
                          direction={sortBy === column.id ? sortOrder : 'asc'}
                          onClick={() => handleSort(column.id)}
                        >
                          {t(column.labelKey)}
                        </TableSortLabel>
                      ) : (
                        t(column.labelKey)
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {displayServices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.filter(col => col.visible).length} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                        {t('serverList.noData')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  displayServices.map((service) => {
                    const serviceKey = `${service.labels.service}-${service.instanceId}`;
                    const updatedStatus = updatedServiceIds.get(serviceKey);
                    const isUpdated = updatedStatus !== undefined;
                    const isNew = newServiceIds.has(serviceKey);
                    // Use service.status for highlight color (current status)
                    const highlightStatus = updatedStatus || service.status;
                    return (
                    <TableRow
                      key={serviceKey}
                      hover
                      sx={{
                        bgcolor: isUpdated
                          ? (theme) => getHighlightColor(highlightStatus, theme)
                          : (theme) => getStatusBgColor(service.status, theme),
                        animation: isNew
                          ? 'appearEffect 0.5s ease-out'
                          : isUpdated
                            ? `flashEffect-${highlightStatus} 2s ease-out`
                            : 'none',
                        '@keyframes appearEffect': {
                          '0%': { opacity: 0, transform: 'scale(0.95)' },
                          '100%': { opacity: 1, transform: 'scale(1)' },
                        },
                        [`@keyframes flashEffect-${highlightStatus}`]: {
                          '0%': {
                            bgcolor: (theme) => getHighlightColorStart(highlightStatus, theme),
                          },
                          '100%': {
                            bgcolor: (theme) => getStatusBgColor(service.status, theme),
                          },
                        },
                      }}
                    >
                      {columns.filter(col => col.visible).map((column) => {
                        switch (column.id) {
                          case 'instanceId':
                            return (
                              <TableCell key={column.id}>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                  {service.instanceId}
                                </Typography>
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
                                  <Typography variant="caption" color="text.disabled">-</Typography>
                                )}
                              </TableCell>
                            );
                          case 'labels':
                            return (
                              <TableCell key={column.id}>
                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                  {Object.entries(service.labels)
                                    .filter(([key]) => key !== 'service' && key !== 'group')
                                    .map(([key, value]) => (
                                      <Chip
                                        key={`${service.instanceId}-${key}`}
                                        label={`${key}=${value}`}
                                        size="small"
                                        variant="outlined"
                                        sx={{ fontSize: '0.7rem', height: '22px' }}
                                      />
                                    ))}
                                </Box>
                              </TableCell>
                            );
                          case 'hostname':
                            return (
                              <TableCell key={column.id}>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                  {service.hostname}
                                </Typography>
                              </TableCell>
                            );
                          case 'externalAddress':
                            return (
                              <TableCell key={column.id}>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                  {service.externalAddress}
                                </Typography>
                              </TableCell>
                            );
                          case 'internalAddress':
                            return (
                              <TableCell key={column.id}>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                  {service.internalAddress}
                                </Typography>
                              </TableCell>
                            );
                          case 'ports':
                            const portEntries = Object.entries(service.ports || {});
                            return (
                              <TableCell key={column.id}>
                                {portEntries.length > 0 && (
                                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                    {portEntries.map(([name, port]) => (
                                      <Chip
                                        key={`${service.instanceId}-${name}`}
                                        label={`${name}:${port}`}
                                        size="small"
                                        sx={{ fontFamily: 'monospace', fontSize: '0.7rem', height: '20px' }}
                                      />
                                    ))}
                                  </Box>
                                )}
                              </TableCell>
                            );
                          case 'status':
                            return (
                              <TableCell key={column.id}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  {getStatusBadge(service.status)}
                                  <FavoriteIcon
                                    sx={{
                                      fontSize: 12,
                                      color: heartbeatIds.has(serviceKey) ? 'error.main' : 'action.disabled',
                                      opacity: heartbeatIds.has(serviceKey) ? 1 : 0.3,
                                      animation: heartbeatIds.has(serviceKey) ? 'heartbeat 0.6s ease-in-out' : 'none',
                                      '@keyframes heartbeat': {
                                        '0%': { transform: 'scale(1)' },
                                        '25%': { transform: 'scale(1.3)' },
                                        '50%': { transform: 'scale(1)' },
                                        '75%': { transform: 'scale(1.2)' },
                                        '100%': { transform: 'scale(1)' },
                                      },
                                    }}
                                  />
                                </Box>
                              </TableCell>
                            );
                          case 'stats':
                            return (
                              <TableCell key={column.id}>
                                {service.stats && Object.keys(service.stats).length > 0 && (
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                    {Object.entries(service.stats).map(([key, value]) => (
                                      <Typography key={`${service.instanceId}-${key}`} variant="caption" color="text.secondary">
                                        {key}: {typeof value === 'number' ? value.toFixed(2) : String(value)}
                                      </Typography>
                                    ))}
                                  </Box>
                                )}
                              </TableCell>
                            );
                          case 'meta':
                            return (
                              <TableCell key={column.id}>
                                {service.meta && Object.keys(service.meta).length > 0 && (
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                    {Object.entries(service.meta).map(([key, value]) => (
                                      <Typography key={key} variant="caption" color="text.secondary">
                                        {key}: {String(value)}
                                      </Typography>
                                    ))}
                                  </Box>
                                )}
                              </TableCell>
                            );
                          case 'createdAt':
                            return (
                              <TableCell key={column.id}>
                                <RelativeTime date={service.createdAt} />
                              </TableCell>
                            );
                          case 'updatedAt':
                            return (
                              <TableCell key={column.id}>
                                <RelativeTime date={service.updatedAt} />
                              </TableCell>
                            );
                          case 'actions':
                            const actionsServiceKey = `${service.labels.service}-${service.instanceId}`;
                            const actionsHealthStatus = healthCheckStatus.get(actionsServiceKey);
                            return (
                              <TableCell key={column.id}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  {hasWebPort(service) && (
                                    <Tooltip title={
                                      actionsHealthStatus?.result
                                        ? (actionsHealthStatus.result.healthy
                                            ? t('serverList.healthCheck.healthyTooltip', { latency: actionsHealthStatus.result.latency })
                                            : t('serverList.healthCheck.unhealthyTooltip', { error: actionsHealthStatus.result.error }))
                                        : t('serverList.healthCheck.tooltip')
                                    } arrow>
                                      <IconButton
                                        size="small"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleHealthCheck(service);
                                        }}
                                        disabled={actionsHealthStatus?.loading}
                                        sx={{
                                          width: 28,
                                          height: 28,
                                          color: actionsHealthStatus?.result
                                            ? (actionsHealthStatus.result.healthy ? 'success.main' : 'error.main')
                                            : 'action.active',
                                        }}
                                      >
                                        {actionsHealthStatus?.loading ? (
                                          <CircularProgress size={14} />
                                        ) : (
                                          <NetworkCheckIcon fontSize="small" />
                                        )}
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                </Box>
                              </TableCell>
                            );
                          default:
                            return null;
                        }
                      })}
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Grid View - Compact uniform tiles */}
      {!isLoading && viewMode === 'grid' && (() => {
        const colCount = 5; // 5 columns
        const itemCount = gridDisplayServices.length;
        const emptyCount = itemCount > 0 ? (colCount - (itemCount % colCount)) % colCount : 0;

        return (
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 0.5,
            '@media (max-width: 1400px)': { gridTemplateColumns: 'repeat(4, 1fr)' },
            '@media (max-width: 1100px)': { gridTemplateColumns: 'repeat(3, 1fr)' },
            '@media (max-width: 800px)': { gridTemplateColumns: 'repeat(2, 1fr)' },
            '@media (max-width: 500px)': { gridTemplateColumns: '1fr' },
          }}>
            {gridDisplayServices.length === 0 ? (
              <Card sx={{ gridColumn: '1 / -1' }}>
                <CardContent sx={{ py: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('serverList.noData')}
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              <>
                {gridDisplayServices.map((service) => {
                  const serviceKey = `${service.labels.service}-${service.instanceId}`;
                  const updatedStatus = updatedServiceIds.get(serviceKey);
                  const isUpdated = updatedStatus !== undefined;
                  const isNew = newServiceIds.has(serviceKey);
                  const highlightStatus = updatedStatus || service.status;
                  const ports = Object.entries(service.ports || {});
                  return (
                    <Card
                      key={serviceKey}
                      sx={{
                        height: 110,
                        cursor: 'default',
                        transition: 'all 0.15s ease-in-out',
                        bgcolor: isUpdated
                          ? (theme) => getHighlightColor(highlightStatus, theme)
                          : (theme) => getStatusBgColor(service.status, theme) || 'background.paper',
                        animation: isNew
                          ? 'appearEffect 0.5s ease-out'
                          : isUpdated
                            ? `flashEffect-${highlightStatus} 2s ease-out`
                            : 'none',
                        '@keyframes appearEffect': {
                          '0%': { opacity: 0, transform: 'scale(0.9)' },
                          '100%': { opacity: 1, transform: 'scale(1)' },
                        },
                        [`@keyframes flashEffect-${highlightStatus}`]: {
                          '0%': { bgcolor: (theme) => getHighlightColorStart(highlightStatus, theme) },
                          '100%': { bgcolor: (theme) => getStatusBgColor(service.status, theme) || 'background.paper' },
                        },
                        '&:hover': {
                          boxShadow: 2,
                        },
                      }}
                    >
                      <CardContent sx={{ p: 1, '&:last-child': { pb: 1 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        {/* Header: Type + Status */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                          {getTypeChip(service.labels.service)}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {getStatusBadge(service.status)}
                            <FavoriteIcon
                              sx={{
                                fontSize: 10,
                                color: heartbeatIds.has(serviceKey) ? 'error.main' : 'action.disabled',
                                opacity: heartbeatIds.has(serviceKey) ? 1 : 0.3,
                                animation: heartbeatIds.has(serviceKey) ? 'heartbeat 0.6s ease-in-out' : 'none',
                                '@keyframes heartbeat': {
                                  '0%': { transform: 'scale(1)' },
                                  '25%': { transform: 'scale(1.3)' },
                                  '50%': { transform: 'scale(1)' },
                                  '75%': { transform: 'scale(1.2)' },
                                  '100%': { transform: 'scale(1)' },
                                },
                              }}
                            />
                          </Box>
                        </Box>
                        {/* Hostname */}
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {service.hostname}
                        </Typography>
                        {/* Group label if exists */}
                        {service.labels.group && (
                          <Typography variant="caption" color="primary.main" sx={{ fontSize: '0.65rem', fontWeight: 500 }}>
                            {service.labels.group}
                          </Typography>
                        )}
                        {/* Spacer */}
                        <Box sx={{ flex: 1 }} />
                        {/* Footer: IP + Ports */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                          <Typography sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'text.secondary' }}>
                            {service.externalAddress}
                          </Typography>
                          {ports.length > 0 && (
                            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'text.disabled', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ports.map(([n, p]) => `${n}:${p}`).join(' ')}
                            </Typography>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  );
                })}
                {/* Empty placeholder cards */}
                {Array.from({ length: emptyCount }).map((_, idx) => (
                  <Card
                    key={`empty-${idx}`}
                    variant="outlined"
                    sx={{
                      height: 110,
                      borderStyle: 'dashed',
                      borderColor: 'divider',
                      bgcolor: (theme) => theme.palette.mode === 'dark'
                        ? 'rgba(0, 0, 0, 0.2)'
                        : 'rgba(0, 0, 0, 0.04)',
                    }}
                  />
                ))}
              </>
            )}
          </Box>
        );
      })()}

      {/* Card View - Uniform detailed cards in grid layout */}
      {!isLoading && viewMode === 'card' && (() => {
        const colCount = 3;
        const itemCount = gridDisplayServices.length;
        const emptyCount = itemCount > 0 ? (colCount - (itemCount % colCount)) % colCount : 0;

        return (
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1.5,
            '@media (max-width: 1200px)': { gridTemplateColumns: 'repeat(2, 1fr)' },
            '@media (max-width: 768px)': { gridTemplateColumns: '1fr' },
          }}>
            {gridDisplayServices.length === 0 ? (
              <Card sx={{ gridColumn: '1 / -1' }}>
                <CardContent sx={{ py: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('serverList.noData')}
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              <>
                {gridDisplayServices.map((service) => {
                  const serviceKey = `${service.labels.service}-${service.instanceId}`;
                  const updatedStatus = updatedServiceIds.get(serviceKey);
                  const isUpdated = updatedStatus !== undefined;
                  const isNew = newServiceIds.has(serviceKey);
                  const highlightStatus = updatedStatus || service.status;
                  const customLabels = Object.entries(service.labels).filter(([key]) => key !== 'service' && key !== 'group');
                  const ports = Object.entries(service.ports || {});

                  return (
                    <Card
                      key={serviceKey}
                      sx={{
                        height: 200,
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'all 0.15s ease-in-out',
                        '&:hover': { boxShadow: 3 },
                        bgcolor: isUpdated
                          ? (theme) => getHighlightColor(highlightStatus, theme)
                          : (theme) => getStatusBgColor(service.status, theme) || 'background.paper',
                        animation: isNew
                          ? 'appearEffect 0.5s ease-out'
                          : isUpdated
                            ? `flashEffect-${highlightStatus} 2s ease-out`
                            : 'none',
                        '@keyframes appearEffect': {
                          '0%': { opacity: 0, transform: 'scale(0.9)' },
                          '100%': { opacity: 1, transform: 'scale(1)' },
                        },
                        [`@keyframes flashEffect-${highlightStatus}`]: {
                          '0%': { bgcolor: (theme) => getHighlightColorStart(highlightStatus, theme) },
                          '100%': { bgcolor: (theme) => getStatusBgColor(service.status, theme) || 'background.paper' },
                        },
                      }}
                    >
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 }, flex: 1, display: 'flex', flexDirection: 'column' }}>
                        {/* Header: Type + Group + Status */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                            {getTypeChip(service.labels.service)}
                            {service.labels.group && (
                              <Chip
                                label={service.labels.group}
                                size="small"
                                variant="outlined"
                                color="primary"
                                sx={{ fontWeight: 500, height: 20, fontSize: '0.7rem' }}
                              />
                            )}
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {getStatusBadge(service.status)}
                            <FavoriteIcon
                              sx={{
                                fontSize: 12,
                                color: heartbeatIds.has(serviceKey) ? 'error.main' : 'action.disabled',
                                opacity: heartbeatIds.has(serviceKey) ? 1 : 0.3,
                                animation: heartbeatIds.has(serviceKey) ? 'heartbeat 0.6s ease-in-out' : 'none',
                                '@keyframes heartbeat': {
                                  '0%': { transform: 'scale(1)' },
                                  '25%': { transform: 'scale(1.3)' },
                                  '50%': { transform: 'scale(1)' },
                                  '75%': { transform: 'scale(1.2)' },
                                  '100%': { transform: 'scale(1)' },
                                },
                              }}
                            />
                          </Box>
                        </Box>

                        {/* Hostname */}
                        <Typography
                          variant="body2"
                          sx={{ fontFamily: 'monospace', fontWeight: 600 }}
                        >
                          {service.hostname}
                        </Typography>

                        {/* Instance ID */}
                        <Typography
                          variant="caption"
                          color="text.disabled"
                          sx={{ fontFamily: 'monospace', fontSize: '0.65rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {service.instanceId}
                        </Typography>

                        {/* Info Grid */}
                        <Box sx={{
                          mt: 1,
                          display: 'grid',
                          gridTemplateColumns: 'auto 1fr',
                          gap: 0.25,
                          '& .label': { color: 'text.secondary', fontSize: '0.8rem', minWidth: 55 },
                          '& .value': { fontFamily: 'monospace', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
                        }}>
                          <Typography className="label">External</Typography>
                          <Typography className="value">{service.externalAddress}</Typography>
                          <Typography className="label">Internal</Typography>
                          <Typography className="value">{service.internalAddress}</Typography>
                          {ports.length > 0 && (
                            <>
                              <Typography className="label">Ports</Typography>
                              <Typography className="value">{ports.map(([n, p]) => `${n}:${p}`).join(', ')}</Typography>
                            </>
                          )}
                        </Box>

                        {/* Custom labels */}
                        {customLabels.length > 0 && (
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                            {customLabels.map(([key, value]) => (
                              <Chip
                                key={`${service.instanceId}-${key}`}
                                label={`${key}=${value}`}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.65rem', height: 18 }}
                              />
                            ))}
                          </Box>
                        )}

                        {/* Spacer */}
                        <Box sx={{ flex: 1 }} />

                        {/* Stats */}
                        {service.stats && Object.keys(service.stats).length > 0 && (
                          <Box sx={{
                            mt: 1,
                            p: 0.75,
                            bgcolor: 'action.hover',
                            borderRadius: 1,
                            display: 'flex',
                            gap: 2,
                            flexWrap: 'wrap',
                            justifyContent: 'center',
                          }}>
                            {Object.entries(service.stats).map(([key, value]) => (
                              <Box key={`${service.instanceId}-${key}`} sx={{ textAlign: 'center' }}>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.6rem' }}>
                                  {key}
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                                  {typeof value === 'number' ? value.toFixed(1) : String(value)}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        )}

                        {/* Footer: Updated time */}
                        <Box sx={{ mt: 0.5, pt: 0.5, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'flex-end' }}>
                          <RelativeTime date={service.updatedAt} variant="caption" color="text.disabled" />
                        </Box>
                      </CardContent>
                    </Card>
                  );
                })}
                {/* Empty placeholder cards */}
                {Array.from({ length: emptyCount }).map((_, idx) => (
                  <Card
                    key={`empty-card-${idx}`}
                    variant="outlined"
                    sx={{
                      height: 200,
                      borderStyle: 'dashed',
                      borderColor: 'divider',
                      bgcolor: (theme) => theme.palette.mode === 'dark'
                        ? 'rgba(0, 0, 0, 0.2)'
                        : 'rgba(0, 0, 0, 0.04)',
                    }}
                  />
                ))}
              </>
            )}
          </Box>
        );
      })()}

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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
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
                items={columns.map(col => col.id)}
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
          <Button onClick={handleCleanupConfirm} color="error" variant="contained" autoFocus>
            {t('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ServerListPage;

