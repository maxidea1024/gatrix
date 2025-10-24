import React, { useState, useEffect, useCallback } from 'react';
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
import useSWR from 'swr';
import DynamicFilterBar, { FilterDefinition, ActiveFilter } from '../../components/common/DynamicFilterBar';
import { useDebounce } from '../../hooks/useDebounce';
import serviceDiscoveryService, { ServiceInstance } from '../../services/serviceDiscoveryService';
import { formatDateTimeDetailed } from '../../utils/dateFormat';

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
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [services, setServices] = useState<ServiceInstance[]>([]);
  const [pendingUpdates, setPendingUpdates] = useState<ServiceInstance[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  // Sort state (persisted in localStorage)
  const [sortBy, setSortBy] = useState<string>(() => {
    return localStorage.getItem('serverListSortBy') || 'updatedAt';
  });
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => {
    return (localStorage.getItem('serverListSortOrder') as 'asc' | 'desc') || 'desc';
  });

  // View mode state (persisted in localStorage)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('serverListViewMode') as ViewMode) || 'list';
  });

  // Track updated service IDs for highlight effect (with status)
  const [updatedServiceIds, setUpdatedServiceIds] = useState<Map<string, ServiceStatus>>(new Map());

  // Cleanup confirmation dialog
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);

  // Default column configuration
  const defaultColumns: ColumnConfig[] = [
    { id: 'status', labelKey: 'serverList.table.status', visible: true },
    { id: 'type', labelKey: 'serverList.table.type', visible: true },
    { id: 'instanceId', labelKey: 'serverList.table.instanceId', visible: true },
    { id: 'hostname', labelKey: 'serverList.table.hostname', visible: true },
    { id: 'externalAddress', labelKey: 'serverList.table.externalAddress', visible: true },
    { id: 'internalAddress', labelKey: 'serverList.table.internalAddress', visible: true },
    { id: 'ports', labelKey: 'serverList.table.ports', visible: true },
    { id: 'instanceStats', labelKey: 'serverList.table.instanceStats', visible: true },
    { id: 'meta', labelKey: 'serverList.table.meta', visible: true },
    { id: 'updatedAt', labelKey: 'serverList.table.updatedAt', visible: true },
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
      revalidateOnFocus: false, // Don't refetch on window focus
      revalidateOnReconnect: false, // Don't refetch on reconnect
      refreshInterval: 0, // Disable auto-refresh, SSE handles real-time updates
    }
  );

  // Fetch service types for filter
  const { data: serviceTypes } = useSWR(
    '/admin/services/types',
    () => serviceDiscoveryService.getServiceTypes()
  );

  // Initialize services from SWR data (only on initial load)
  useEffect(() => {
    if (data && services.length === 0) {
      setServices(data);
    }
  }, [data]);

  // Setup SSE connection for real-time updates
  useEffect(() => {
    let eventSource: EventSource | null = null;

    try {
      eventSource = serviceDiscoveryService.createSSEConnection(
        (event) => {
          if (event.type === 'init') {
            // Initial data - always apply
            setServices(event.data);
            setPendingUpdates([]);
          } else if (isPaused) {
            // If paused, store updates in pending queue
            setPendingUpdates((prev) => {
              if (event.type === 'put') {
                const index = prev.findIndex((s) => s.instanceId === event.data.instanceId && s.type === event.data.type);
                if (index >= 0) {
                  const newPending = [...prev];
                  newPending[index] = event.data;
                  return newPending;
                } else {
                  return [...prev, event.data];
                }
              } else if (event.type === 'delete') {
                return prev.filter((s) => !(s.instanceId === event.data.instanceId && s.type === event.data.type));
              }
              return prev;
            });
          } else {
            // Not paused - apply updates immediately
            if (event.type === 'put') {
              setServices((prev) => {
                const index = prev.findIndex((s) => s.instanceId === event.data.instanceId && s.type === event.data.type);
                if (index >= 0) {
                  // Update existing - highlight the updated service with status color
                  const serviceKey = `${event.data.type}-${event.data.instanceId}`;
                  setUpdatedServiceIds((prev) => new Map(prev).set(serviceKey, event.data.status));
                  setTimeout(() => {
                    setUpdatedServiceIds((prev) => {
                      const newMap = new Map(prev);
                      newMap.delete(serviceKey);
                      return newMap;
                    });
                  }, 2000);

                  const newServices = [...prev];
                  newServices[index] = event.data;
                  return newServices;
                } else {
                  // Add new service at the end (bottom)
                  return [...prev, event.data];
                }
              });
            } else if (event.type === 'delete') {
              // Service removed
              setServices((prev) => prev.filter((s) => !(s.instanceId === event.data.instanceId && s.type === event.data.type)));
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
  }, [isPaused]);

  // Apply pending updates when unpausing
  const handleTogglePause = () => {
    if (isPaused && pendingUpdates.length > 0) {
      // Apply all pending updates
      setServices((prev) => {
        let updated = [...prev];
        pendingUpdates.forEach((pendingService) => {
          const index = updated.findIndex((s) => s.instanceId === pendingService.instanceId && s.type === pendingService.type);
          if (index >= 0) {
            updated[index] = pendingService;
          } else {
            updated.push(pendingService);
          }
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

  // Clean up terminated and error servers
  const handleCleanupClick = () => {
    setCleanupDialogOpen(true);
  };

  const handleCleanupConfirm = () => {
    setServices((prev) => prev.filter((s) => s.status !== 'terminated' && s.status !== 'error'));
    setCleanupDialogOpen(false);
  };

  const handleCleanupCancel = () => {
    setCleanupDialogOpen(false);
  };

  // Filter configuration
  const availableFilterDefinitions: FilterDefinition[] = [
    {
      key: 'type',
      label: t('serverList.filters.type'),
      type: 'select',
      options: (serviceTypes || []).map((type) => ({ value: type, label: type })),
    },
    {
      key: 'status',
      label: t('serverList.filters.status'),
      type: 'select',
      options: [
        { value: 'initializing', label: t('serverList.status.initializing') },
        { value: 'ready', label: t('serverList.status.ready') },
        { value: 'shutting_down', label: t('serverList.status.shuttingDown') },
        { value: 'error', label: t('serverList.status.error') },
        { value: 'terminated', label: t('serverList.status.terminated') },
      ],
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

  // Apply filters and search
  const filteredServices = services.filter((service) => {
    // Search filter
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      const matchesSearch =
        service.instanceId.toLowerCase().includes(searchLower) ||
        service.type.toLowerCase().includes(searchLower) ||
        service.hostname.toLowerCase().includes(searchLower) ||
        service.externalAddress.toLowerCase().includes(searchLower) ||
        service.internalAddress.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Dynamic filters
    for (const filter of activeFilters) {
      if (filter.key === 'type' && filter.value && service.type !== filter.value) {
        return false;
      }
      if (filter.key === 'status' && filter.value && service.status !== filter.value) {
        return false;
      }
    }

    return true;
  });

  // Apply sorting
  const displayServices = [...filteredServices].sort((a, b) => {
    let aValue: any = a[sortBy as keyof ServiceInstance];
    let bValue: any = b[sortBy as keyof ServiceInstance];

    // Handle special cases
    if (sortBy === 'updatedAt') {
      aValue = new Date(aValue).getTime();
      bValue = new Date(bValue).getTime();
    }

    if (aValue === undefined || aValue === null) return 1;
    if (bValue === undefined || bValue === null) return -1;

    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Status badge component
  const getStatusBadge = (status: ServiceInstance['status']) => {
    const statusConfig = {
      ready: { color: 'success' as const, icon: <CheckCircleIcon sx={{ fontSize: 16 }} />, label: t('serverList.status.ready') },
      error: { color: 'error' as const, icon: <ErrorIcon sx={{ fontSize: 16 }} />, label: t('serverList.status.error') },
      initializing: { color: 'warning' as const, icon: <HourglassEmptyIcon sx={{ fontSize: 16 }} />, label: t('serverList.status.initializing') },
      shutting_down: { color: 'info' as const, icon: <PowerSettingsNewIcon sx={{ fontSize: 16 }} />, label: t('serverList.status.shuttingDown') },
      terminated: { color: 'default' as const, icon: <PowerSettingsNewIcon sx={{ fontSize: 16 }} />, label: t('serverList.status.terminated') },
    };

    const config = statusConfig[status];
    return (
      <Chip
        icon={config.icon}
        label={config.label}
        color={config.color}
        size="small"
        sx={{ fontWeight: 600 }}
      />
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

  // Get highlight color based on status
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
            <Tooltip title={t('serverList.cleanup')}>
              <IconButton
                onClick={handleCleanupClick}
                sx={{
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <CleaningServicesIcon />
              </IconButton>
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
                      {column.id !== 'ports' && column.id !== 'instanceStats' && column.id !== 'meta' ? (
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
                    const serviceKey = `${service.type}-${service.instanceId}`;
                    const updatedStatus = updatedServiceIds.get(serviceKey);
                    const isUpdated = updatedStatus !== undefined;
                    // Use service.status for highlight color (current status)
                    const highlightStatus = updatedStatus || service.status;
                    return (
                    <TableRow
                      key={serviceKey}
                      hover
                      sx={{
                        bgcolor: isUpdated
                          ? (theme) => getHighlightColor(highlightStatus, theme)
                          : 'transparent',
                        animation: isUpdated ? `flashEffect-${highlightStatus} 2s ease-out` : 'none',
                        [`@keyframes flashEffect-${highlightStatus}`]: {
                          '0%': {
                            bgcolor: (theme) => getHighlightColorStart(highlightStatus, theme),
                          },
                          '100%': {
                            bgcolor: 'transparent',
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
                          case 'type':
                            return (
                              <TableCell key={column.id}>
                                {getTypeChip(service.type)}
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
                            return (
                              <TableCell key={column.id}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                  {service.ports.tcp && service.ports.tcp.length > 0 && (
                                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                      <Typography variant="caption" color="text.secondary" sx={{ minWidth: '35px' }}>TCP:</Typography>
                                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                        {service.ports.tcp.map((port) => (
                                          <Chip key={`tcp-${port}`} label={port} size="small" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', height: '20px' }} />
                                        ))}
                                      </Box>
                                    </Box>
                                  )}
                                  {service.ports.udp && service.ports.udp.length > 0 && (
                                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                      <Typography variant="caption" color="text.secondary" sx={{ minWidth: '35px' }}>UDP:</Typography>
                                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                        {service.ports.udp.map((port) => (
                                          <Chip key={`udp-${port}`} label={port} size="small" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', height: '20px' }} />
                                        ))}
                                      </Box>
                                    </Box>
                                  )}
                                  {service.ports.http && service.ports.http.length > 0 && (
                                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                      <Typography variant="caption" color="text.secondary" sx={{ minWidth: '35px' }}>HTTP:</Typography>
                                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                        {service.ports.http.map((port) => (
                                          <Chip key={`http-${port}`} label={port} size="small" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', height: '20px' }} />
                                        ))}
                                      </Box>
                                    </Box>
                                  )}
                                </Box>
                              </TableCell>
                            );
                          case 'status':
                            return (
                              <TableCell key={column.id}>
                                {getStatusBadge(service.status)}
                              </TableCell>
                            );
                          case 'instanceStats':
                            return (
                              <TableCell key={column.id}>
                                {service.instanceStats && (
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                    {service.instanceStats.cpuUsage !== undefined && (
                                      <Typography variant="caption" color="text.secondary">
                                        CPU: {service.instanceStats.cpuUsage}%
                                      </Typography>
                                    )}
                                    {service.instanceStats.memoryUsage !== undefined && service.instanceStats.memoryTotal !== undefined && (
                                      <Typography variant="caption" color="text.secondary">
                                        MEM: {service.instanceStats.memoryUsage}MB / {service.instanceStats.memoryTotal}MB
                                      </Typography>
                                    )}
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
                          case 'updatedAt':
                            return (
                              <TableCell key={column.id}>
                                <Typography variant="body2" color="text.secondary">
                                  {formatDateTimeDetailed(service.updatedAt)}
                                </Typography>
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

      {/* Grid View - Table-like grid layout */}
      {!isLoading && viewMode === 'grid' && (
        <Card>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: 0,
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 1,
            overflow: 'hidden',
          }}>
          {displayServices.length === 0 ? (
            <Box sx={{ p: 4, gridColumn: '1 / -1', textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {t('serverList.noData')}
              </Typography>
            </Box>
          ) : (
            displayServices.map((service) => {
              const serviceKey = `${service.type}-${service.instanceId}`;
              const updatedStatus = updatedServiceIds.get(serviceKey);
              const isUpdated = updatedStatus !== undefined;
              // Use service.status for highlight color (current status)
              const highlightStatus = updatedStatus || service.status;
              const label = `${service.type}:${service.instanceId.substring(0, 8)}... | ${service.hostname} | ${getStatusBadge(service.status).props.label}`;
              return (
                <Tooltip key={serviceKey} title={
                  <Box>
                    <Typography variant="caption" sx={{ display: 'block' }}>ID: {service.instanceId}</Typography>
                    <Typography variant="caption" sx={{ display: 'block' }}>Type: {service.type}</Typography>
                    <Typography variant="caption" sx={{ display: 'block' }}>Hostname: {service.hostname}</Typography>
                    <Typography variant="caption" sx={{ display: 'block' }}>External: {service.externalAddress}</Typography>
                    <Typography variant="caption" sx={{ display: 'block' }}>Internal: {service.internalAddress}</Typography>
                    {service.instanceStats && (
                      <>
                        <Typography variant="caption" sx={{ display: 'block' }}>CPU: {service.instanceStats.cpuUsage}%</Typography>
                        <Typography variant="caption" sx={{ display: 'block' }}>MEM: {service.instanceStats.memoryUsage}MB / {service.instanceStats.memoryTotal}MB</Typography>
                      </>
                    )}
                    <Typography variant="caption" sx={{ display: 'block' }}>Updated: {formatDateTimeDetailed(service.updatedAt)}</Typography>
                  </Box>
                } arrow>
                  <Box
                    sx={{
                      p: 1,
                      borderRight: '1px dashed',
                      borderBottom: '1px dashed',
                      borderColor: 'divider',
                      fontSize: '0.8125rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      cursor: 'default',
                      bgcolor: isUpdated
                        ? (theme) => getHighlightColor(highlightStatus, theme)
                        : 'transparent',
                      animation: isUpdated ? `flashEffect-${highlightStatus} 2s ease-out` : 'none',
                      [`@keyframes flashEffect-${highlightStatus}`]: {
                        '0%': {
                          bgcolor: (theme) => getHighlightColorStart(highlightStatus, theme),
                        },
                        '100%': {
                          bgcolor: 'transparent',
                        },
                      },
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                      {getTypeChip(service.type)}
                      {getStatusBadge(service.status)}
                    </Box>
                    <Typography variant="caption" sx={{ display: 'block', fontFamily: 'monospace' }}>
                      {service.hostname}
                    </Typography>
                  </Box>
                </Tooltip>
              );
            })
          )}
          </Box>
        </Card>
      )}

      {/* Card View - Cards in grid layout */}
      {!isLoading && viewMode === 'card' && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 2 }}>
          {displayServices.length === 0 ? (
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary" align="center">
                  {t('serverList.noData')}
                </Typography>
              </CardContent>
            </Card>
          ) : (
            displayServices.map((service) => {
              const serviceKey = `${service.type}-${service.instanceId}`;
              const updatedStatus = updatedServiceIds.get(serviceKey);
              const isUpdated = updatedStatus !== undefined;
              // Use service.status for highlight color (current status)
              const highlightStatus = updatedStatus || service.status;
              return (
              <Card
                key={serviceKey}
                sx={{
                  '&:hover': { boxShadow: 3 },
                  bgcolor: isUpdated
                    ? (theme) => getHighlightColor(highlightStatus, theme)
                    : 'background.paper',
                  animation: isUpdated ? `flashEffect-${highlightStatus} 2s ease-out` : 'none',
                  [`@keyframes flashEffect-${highlightStatus}`]: {
                    '0%': {
                      bgcolor: (theme) => getHighlightColorStart(highlightStatus, theme),
                    },
                    '100%': {
                      bgcolor: 'background.paper',
                    },
                  },
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    {getTypeChip(service.type)}
                    {getStatusBadge(service.status)}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    {service.instanceId}
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1 }}>
                    {service.hostname}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      External: {service.externalAddress}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Internal: {service.internalAddress}
                    </Typography>
                    {service.ports.tcp && service.ports.tcp.length > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        TCP: {service.ports.tcp.join(', ')}
                      </Typography>
                    )}
                    {service.ports.udp && service.ports.udp.length > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        UDP: {service.ports.udp.join(', ')}
                      </Typography>
                    )}
                    {service.ports.http && service.ports.http.length > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        HTTP: {service.ports.http.join(', ')}
                      </Typography>
                    )}
                    {service.instanceStats && (
                      <>
                        <Typography variant="caption" color="text.secondary">
                          CPU: {service.instanceStats.cpuUsage}%
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          MEM: {service.instanceStats.memoryUsage}MB / {service.instanceStats.memoryTotal}MB
                        </Typography>
                      </>
                    )}
                    {service.meta && Object.keys(service.meta).length > 0 && (
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                        {Object.entries(service.meta).map(([key, value]) => (
                          <Chip key={key} label={`${key}: ${value}`} size="small" variant="outlined" />
                        ))}
                      </Box>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                      {formatDateTimeDetailed(service.updatedAt)}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
              );
            })
          )}
            </Box>
          </CardContent>
        </Card>
      )}

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

