import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCollide, SimulationNodeDatum, SimulationLinkDatum, ForceLink } from 'd3-force';
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
  Menu,
  MenuItem,
  ListItemIcon,
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
type ViewMode = 'list' | 'grid' | 'card' | 'cluster';

// Column definition interface
interface ColumnConfig {
  id: string;
  labelKey: string;
  visible: boolean;
  width?: string;
}

// Force simulation node interface
interface ClusterNode extends SimulationNodeDatum {
  id: string;
  service?: ServiceInstance;
  isCenter?: boolean;
  groupKey?: string; // For center nodes: the group key (e.g., 'development', 'production')
  radius: number;
  isNew?: boolean; // Track if node is newly added
  prevStatus?: string; // Track previous status for change detection
}

// Force simulation link interface
interface ClusterLink extends SimulationLinkDatum<ClusterNode> {
  source: ClusterNode | string;
  target: ClusterNode | string;
}

// Grouping option type
type GroupingOption = 'none' | 'service' | 'group' | 'environment' | 'region';

// ClusterView component with D3 force simulation
interface ClusterViewProps {
  services: ServiceInstance[];
  heartbeatIds: Set<string>;
  t: (key: string) => string;
  groupingBy?: GroupingOption;
}

// Heartbeat TTL in seconds - configurable via environment variable
const HEARTBEAT_TTL_SECONDS = parseInt(import.meta.env.VITE_HEARTBEAT_TTL_SECONDS || '30', 10);

const ClusterView: React.FC<ClusterViewProps> = ({ services, heartbeatIds, t, groupingBy = 'none' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<ClusterNode[]>([]);
  const [links, setLinks] = useState<ClusterLink[]>([]);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const simulationRef = useRef<ReturnType<typeof forceSimulation<ClusterNode>> | null>(null);
  const nodesRef = useRef<ClusterNode[]>([]);
  const linksRef = useRef<ClusterLink[]>([]);

  // Track rumble and heartbeat animation states
  const [rumbleNodes, setRumbleNodes] = useState<Set<string>>(new Set());
  const [heartbeatAnimNodes, setHeartbeatAnimNodes] = useState<Set<string>>(new Set());
  // Counter to force re-render of animate elements - Map<nodeId, counter>
  const [rumbleCounter, setRumbleCounter] = useState<Map<string, number>>(new Map());
  const prevStatusRef = useRef<Map<string, string>>(new Map());
  const prevHeartbeatRef = useRef<Set<string>>(new Set());

  // Ping gauge state: track last heartbeat time for each node
  const [lastHeartbeatTime, setLastHeartbeatTime] = useState<Map<string, number>>(new Map());
  const [pingProgress, setPingProgress] = useState<Map<string, number>>(new Map());

  // Pan and zoom state for infinite canvas
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 1200, height: 800 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, viewBoxX: 0, viewBoxY: 0 });
  // Store drag offset to prevent jumping when drag starts
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const nodeRadius = 32;
  const centerRadius = 50;

  // Get center position from current viewBox
  const viewCenterX = viewBox.x + viewBox.width / 2;
  const viewCenterY = viewBox.y + viewBox.height / 2;

  // Get status color for node
  const getNodeColor = (status: string) => {
    switch (status) {
      case 'ready': return '#4caf50';
      case 'initializing': return '#ffc107'; // Yellow for initializing
      case 'busy': return '#ff9800';
      case 'full': return '#f44336';
      case 'starting': return '#2196f3';
      case 'terminated': return '#9e9e9e';
      case 'error': return '#f44336';
      case 'no-response': return '#795548';
      default: return '#9e9e9e';
    }
  };

  // Create a stable service ID list to detect actual structure changes
  const serviceIds = useMemo(() => {
    return services.map(s => `${s.labels.service}-${s.instanceId}`).sort().join(',');
  }, [services]);

  // Create a service map for quick lookup (for UI updates without simulation restart)
  const serviceMap = useMemo(() => {
    const map = new Map<string, ServiceInstance>();
    services.forEach(s => {
      map.set(`${s.labels.service}-${s.instanceId}`, s);
    });
    return map;
  }, [services]);

  // LocalStorage keys
  const CLUSTER_CENTER_POS_KEY = 'clusterViewCenterPosition';
  const CLUSTER_VIEWBOX_KEY = 'clusterViewViewBox';

  // Get saved center position from localStorage
  const getSavedCenterPosition = useCallback(() => {
    try {
      const saved = localStorage.getItem(CLUSTER_CENTER_POS_KEY);
      if (saved) {
        const pos = JSON.parse(saved);
        if (typeof pos.x === 'number' && typeof pos.y === 'number') {
          return pos;
        }
      }
    } catch {
      // Ignore parse errors
    }
    return { x: viewCenterX, y: viewCenterY };
  }, [viewCenterX, viewCenterY]);

  // Save center position to localStorage
  const saveCenterPosition = useCallback((x: number, y: number) => {
    try {
      localStorage.setItem(CLUSTER_CENTER_POS_KEY, JSON.stringify({ x, y }));
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Reset view to default position and center all nodes
  const handleResetView = useCallback(() => {
    const defaultViewBox = { x: 0, y: 0, width: 1200, height: 800 };
    setViewBox(defaultViewBox);
    localStorage.removeItem(CLUSTER_VIEWBOX_KEY);
    localStorage.removeItem(CLUSTER_CENTER_POS_KEY);

    const centerX = defaultViewBox.width / 2;
    const centerY = defaultViewBox.height / 2;

    if (simulationRef.current && nodesRef.current.length > 0) {
      // Find all center nodes (could be multiple when grouping is enabled)
      const centerNodes = nodesRef.current.filter(n => n.isCenter);
      const serviceNodes = nodesRef.current.filter(n => !n.isCenter);

      if (centerNodes.length === 1) {
        // Single center node - place at screen center
        const centerNode = centerNodes[0];
        centerNode.x = centerX;
        centerNode.y = centerY;
        centerNode.fx = centerX;
        centerNode.fy = centerY;

        // Reposition all service nodes around the center
        serviceNodes.forEach(node => {
          const angle = Math.random() * 2 * Math.PI;
          const distance = 80 + Math.random() * 60;
          node.x = centerX + Math.cos(angle) * distance;
          node.y = centerY + Math.sin(angle) * distance;
          node.fx = null;
          node.fy = null;
        });
      } else if (centerNodes.length > 1) {
        // Multiple center nodes (grouping mode) - arrange in a circle around screen center
        const groupRadius = Math.min(centerNodes.length * 60, 250);
        centerNodes.forEach((node, index) => {
          const angle = (2 * Math.PI * index) / centerNodes.length - Math.PI / 2;
          const x = centerX + Math.cos(angle) * groupRadius;
          const y = centerY + Math.sin(angle) * groupRadius;
          node.x = x;
          node.y = y;
          node.fx = x;
          node.fy = y;
        });

        // Reposition service nodes around their respective center nodes
        serviceNodes.forEach(node => {
          // Find the linked center node
          const linkedCenter = centerNodes.find(c => c.groupKey === node.groupKey);
          const targetCenter = linkedCenter || { x: centerX, y: centerY };
          const angle = Math.random() * 2 * Math.PI;
          const distance = 80 + Math.random() * 60;
          node.x = (targetCenter.x || centerX) + Math.cos(angle) * distance;
          node.y = (targetCenter.y || centerY) + Math.sin(angle) * distance;
          node.fx = null;
          node.fy = null;
        });
      }

      simulationRef.current.alpha(0.8).restart();
    }
  }, []);

  // Detect status changes and trigger rumble effect
  useEffect(() => {
    const newRumbleNodes = new Set<string>();

    services.forEach(s => {
      const nodeId = `${s.labels.service}-${s.instanceId}`;
      const prevStatus = prevStatusRef.current.get(nodeId);

      // If status changed (and not first render), trigger rumble
      if (prevStatus !== undefined && prevStatus !== s.status) {
        newRumbleNodes.add(nodeId);
      }

      prevStatusRef.current.set(nodeId, s.status);
    });

    if (newRumbleNodes.size > 0) {
      setRumbleNodes(prev => new Set([...prev, ...newRumbleNodes]));

      // Increment rumble counter to force re-render of animate element
      setRumbleCounter(prev => {
        const next = new Map(prev);
        newRumbleNodes.forEach(id => next.set(id, (prev.get(id) || 0) + 1));
        return next;
      });

      // Clear rumble after animation
      setTimeout(() => {
        setRumbleNodes(prev => {
          const next = new Set(prev);
          newRumbleNodes.forEach(id => next.delete(id));
          return next;
        });
      }, 500);
    }
  }, [services]);

  // Detect heartbeat and trigger rumble animation
  useEffect(() => {
    const newHeartbeatNodes = new Set<string>();

    heartbeatIds.forEach(id => {
      if (!prevHeartbeatRef.current.has(id)) {
        newHeartbeatNodes.add(id);
      }
    });

    if (newHeartbeatNodes.size > 0) {
      setHeartbeatAnimNodes(prev => new Set([...prev, ...newHeartbeatNodes]));

      // Increment rumble counter to force re-render of animate element
      setRumbleCounter(prev => {
        const next = new Map(prev);
        newHeartbeatNodes.forEach(id => next.set(id, (prev.get(id) || 0) + 1));
        return next;
      });

      // Reset ping gauge: update lastHeartbeatTime for new heartbeats
      const now = Date.now();
      setLastHeartbeatTime(prev => {
        const next = new Map(prev);
        newHeartbeatNodes.forEach(id => next.set(id, now));
        return next;
      });

      // Clear animation after 600ms
      setTimeout(() => {
        setHeartbeatAnimNodes(prev => {
          const next = new Set(prev);
          newHeartbeatNodes.forEach(id => next.delete(id));
          return next;
        });
      }, 600);
    }

    prevHeartbeatRef.current = new Set(heartbeatIds);
  }, [heartbeatIds]);

  // Update ping progress every 100ms
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setPingProgress(prev => {
        const next = new Map<string, number>();
        services.forEach(service => {
          const serviceKey = `${service.labels.service}-${service.instanceId}`;
          const lastTime = lastHeartbeatTime.get(serviceKey);
          if (lastTime) {
            const elapsed = (now - lastTime) / 1000; // seconds
            const progress = Math.min(elapsed / HEARTBEAT_TTL_SECONDS, 1);
            next.set(serviceKey, progress);
          } else {
            // If no heartbeat yet, start from 0 (fresh state)
            next.set(serviceKey, 0);
          }
        });
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [services, lastHeartbeatTime]);

  // Initialize simulation once
  useEffect(() => {
    if (simulationRef.current) return; // Already initialized

    const savedPos = getSavedCenterPosition();

    // Create initial center node
    const centerNode: ClusterNode = {
      id: 'center',
      isCenter: true,
      radius: centerRadius,
      x: savedPos.x,
      y: savedPos.y,
      fx: savedPos.x,
      fy: savedPos.y,
    };

    nodesRef.current = [centerNode];
    linksRef.current = [];

    // Create simulation once
    const simulation = forceSimulation<ClusterNode>(nodesRef.current)
      .force('link', forceLink<ClusterNode, ClusterLink>(linksRef.current)
        .id(d => d.id)
        .distance(100)
        .strength(0.5))
      .force('charge', forceManyBody<ClusterNode>()
        .strength(-100))
      .force('collision', forceCollide<ClusterNode>()
        .radius(d => d.radius + 8)
        .strength(0.8))
      .alphaDecay(0.02) // Slower decay for smoother movement
      .velocityDecay(0.3)
      .on('tick', () => {
        setNodes([...nodesRef.current]);
        setLinks([...linksRef.current]);
      });

    simulationRef.current = simulation;

    return () => {
      simulation.stop();
      simulationRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper function to get group key from service based on grouping option
  const getGroupKey = useCallback((service: ServiceInstance): string => {
    switch (groupingBy) {
      case 'service':
        return service.labels.service || 'unknown';
      case 'group':
        return service.labels.group || 'unknown';
      case 'environment':
        return service.labels.environment || 'unknown';
      case 'region':
        return service.labels.region || 'unknown';
      default:
        return 'center';
    }
  }, [groupingBy]);

  // Track previous groupingBy to detect changes
  const prevGroupingByRef = useRef<GroupingOption>(groupingBy);

  // Auto-reset view when grouping changes
  useEffect(() => {
    if (prevGroupingByRef.current !== groupingBy) {
      // Reset viewBox and clear saved positions when grouping changes
      const defaultViewBox = { x: 0, y: 0, width: 1200, height: 800 };
      setViewBox(defaultViewBox);
      localStorage.removeItem(CLUSTER_VIEWBOX_KEY);
      localStorage.removeItem(CLUSTER_CENTER_POS_KEY);
    }
  }, [groupingBy]);

  // Update nodes when services change (add/remove) or grouping changes
  useEffect(() => {
    if (!simulationRef.current) return;

    const savedPos = getSavedCenterPosition();

    // Check if grouping mode changed
    const groupingChanged = prevGroupingByRef.current !== groupingBy;
    prevGroupingByRef.current = groupingBy;

    // Only use existing nodes if grouping didn't change
    const existingNodeMap = new Map<string, ClusterNode>();
    if (!groupingChanged) {
      nodesRef.current.forEach(n => existingNodeMap.set(n.id, n));
    } else {
      // Only keep service nodes when grouping changes, recreate center nodes
      nodesRef.current.filter(n => !n.isCenter).forEach(n => existingNodeMap.set(n.id, n));
    }

    // Track new nodes for rumble effect
    const newNodeIds: string[] = [];

    // Determine center nodes based on grouping
    const centerNodes: ClusterNode[] = [];

    if (groupingBy === 'none') {
      // Single center node - always create fresh when switching to 'none'
      const centerNode: ClusterNode = {
        id: 'center',
        isCenter: true,
        radius: centerRadius,
        x: savedPos.x,
        y: savedPos.y,
        fx: savedPos.x,
        fy: savedPos.y,
      };
      centerNodes.push(centerNode);
    } else {
      // Multiple center nodes based on grouping
      const groupKeys = new Set<string>();
      services.forEach(s => groupKeys.add(getGroupKey(s)));

      const groupArray = Array.from(groupKeys).sort();
      const groupCount = groupArray.length;

      groupArray.forEach((groupKey, index) => {
        const centerId = `center-${groupKey}`;
        let centerNode = existingNodeMap.get(centerId);

        if (!centerNode) {
          // Position group centers in a circle around the main center
          const angle = (2 * Math.PI * index) / Math.max(groupCount, 1);
          const distance = groupCount > 1 ? 200 : 0;
          const x = savedPos.x + Math.cos(angle) * distance;
          const y = savedPos.y + Math.sin(angle) * distance;

          centerNode = {
            id: centerId,
            isCenter: true,
            groupKey,
            radius: centerRadius,
            x,
            y,
            fx: x,
            fy: y,
          };
        } else {
          // Update groupKey in case it changed
          centerNode.groupKey = groupKey;
        }
        centerNodes.push(centerNode);
      });
    }

    // Create/update service nodes
    const serviceNodes: ClusterNode[] = services.map((service) => {
      const nodeId = `${service.labels.service}-${service.instanceId}`;
      const existing = existingNodeMap.get(nodeId);
      const groupKey = getGroupKey(service);
      const targetCenterId = groupingBy === 'none' ? 'center' : `center-${groupKey}`;
      const targetCenter = centerNodes.find(c => c.id === targetCenterId);

      if (existing) {
        // Update service data but keep position
        existing.service = service;
        return existing;
      }

      // New node - random position around its center
      const angle = Math.random() * 2 * Math.PI;
      const distance = 80 + Math.random() * 60;
      newNodeIds.push(nodeId);

      return {
        id: nodeId,
        service,
        isCenter: false,
        radius: nodeRadius,
        x: (targetCenter?.x ?? savedPos.x) + Math.cos(angle) * distance,
        y: (targetCenter?.y ?? savedPos.y) + Math.sin(angle) * distance,
        isNew: true,
      };
    });

    // Trigger rumble for new nodes
    if (newNodeIds.length > 0) {
      setRumbleNodes(prev => new Set([...prev, ...newNodeIds]));
      setTimeout(() => {
        setRumbleNodes(prev => {
          const next = new Set(prev);
          newNodeIds.forEach(id => next.delete(id));
          return next;
        });
      }, 500);
    }

    const allNodes = [...centerNodes, ...serviceNodes];
    nodesRef.current = allNodes;

    // Create links - each service links to its group center
    const newLinks: ClusterLink[] = serviceNodes.map(node => {
      const groupKey = getGroupKey(node.service!);
      const targetCenterId = groupingBy === 'none' ? 'center' : `center-${groupKey}`;
      return {
        source: targetCenterId,
        target: node.id,
      };
    });
    linksRef.current = newLinks;

    // Update simulation with new nodes/links (don't recreate)
    const simulation = simulationRef.current;
    simulation.nodes(allNodes);
    (simulation.force('link') as ForceLink<ClusterNode, ClusterLink>)?.links(newLinks);

    // Force re-render to show new state immediately
    setNodes([...allNodes]);
    setLinks([...newLinks]);

    // Restart simulation - stronger restart when grouping changes
    const hasChanges = newNodeIds.length > 0 || allNodes.length !== existingNodeMap.size || groupingChanged;
    if (hasChanges) {
      simulation.alpha(groupingChanged ? 0.8 : 0.3).restart();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceIds, getSavedCenterPosition, groupingBy, getGroupKey]);

  // Convert mouse position to SVG coordinates
  const mouseToSvgCoords = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };

    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();

    // Scale mouse position to SVG viewBox coordinates
    const scaleX = viewBox.width / rect.width;
    const scaleY = viewBox.height / rect.height;
    const x = viewBox.x + (e.clientX - rect.left) * scaleX;
    const y = viewBox.y + (e.clientY - rect.top) * scaleY;

    return { x, y };
  }, [viewBox]);

  // Handle drag start for nodes
  const handleMouseDown = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedNode(nodeId);

    const node = nodesRef.current.find(n => n.id === nodeId);
    if (node && simulationRef.current) {
      // Calculate offset between mouse position and node center
      const mousePos = mouseToSvgCoords(e.nativeEvent);
      dragOffsetRef.current = {
        x: (node.x || 0) - mousePos.x,
        y: (node.y || 0) - mousePos.y,
      };
      node.fx = node.x;
      node.fy = node.y;
      simulationRef.current.alphaTarget(0.3).restart();
    }
  }, [mouseToSvgCoords]);

  // Handle pan start (right-click or ctrl+click or empty space click)
  const handlePanStart = useCallback((e: React.MouseEvent) => {
    // Only start panning if not dragging a node
    if (draggedNode) return;

    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      viewBoxX: viewBox.x,
      viewBoxY: viewBox.y,
    };
  }, [draggedNode, viewBox]);

  // Handle mouse move for both dragging and panning
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!svgRef.current) return;

    if (draggedNode) {
      // Dragging a node - apply offset to keep node at same relative position to cursor
      const { x, y } = mouseToSvgCoords(e);
      const node = nodesRef.current.find(n => n.id === draggedNode);
      if (node) {
        node.fx = x + dragOffsetRef.current.x;
        node.fy = y + dragOffsetRef.current.y;
        // Force re-render
        setNodes([...nodesRef.current]);
      }
    } else if (isPanning) {
      // Panning the canvas
      const svg = svgRef.current;
      const rect = svg.getBoundingClientRect();
      const scaleX = viewBox.width / rect.width;
      const scaleY = viewBox.height / rect.height;

      const dx = (e.clientX - panStartRef.current.x) * scaleX;
      const dy = (e.clientY - panStartRef.current.y) * scaleY;

      setViewBox(prev => ({
        ...prev,
        x: panStartRef.current.viewBoxX - dx,
        y: panStartRef.current.viewBoxY - dy,
      }));
    }
  }, [draggedNode, isPanning, mouseToSvgCoords, viewBox.width, viewBox.height]);

  // Handle mouse up - global listener for proper capture
  const handleMouseUp = useCallback(() => {
    if (draggedNode && simulationRef.current) {
      const node = nodesRef.current.find(n => n.id === draggedNode);
      if (node) {
        // For center node, keep it fixed at current position and save to localStorage
        if (node.isCenter) {
          const posX = node.x || viewCenterX;
          const posY = node.y || viewCenterY;
          node.fx = posX;
          node.fy = posY;
          saveCenterPosition(posX, posY);
        } else {
          // For service nodes, release to let physics take over
          node.fx = null;
          node.fy = null;
        }
      }
      simulationRef.current.alphaTarget(0);
    }
    setDraggedNode(null);
    setIsPanning(false);
  }, [draggedNode, viewCenterX, viewCenterY, saveCenterPosition]);

  // Global mouse event listeners for proper capture outside SVG
  useEffect(() => {
    if (draggedNode || isPanning) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggedNode, isPanning, handleMouseMove, handleMouseUp]);

  // Handle wheel for zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();

    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    const { x: mouseX, y: mouseY } = mouseToSvgCoords(e);

    setViewBox(prev => {
      const newWidth = Math.max(400, Math.min(4000, prev.width * zoomFactor));
      const newHeight = Math.max(300, Math.min(3000, prev.height * zoomFactor));

      // Zoom toward mouse position
      const widthRatio = newWidth / prev.width;
      const heightRatio = newHeight / prev.height;

      const newX = mouseX - (mouseX - prev.x) * widthRatio;
      const newY = mouseY - (mouseY - prev.y) * heightRatio;

      return { x: newX, y: newY, width: newWidth, height: newHeight };
    });
  }, [mouseToSvgCoords]);

  // Get link positions
  const getNodeById = useCallback((id: string | ClusterNode): ClusterNode | undefined => {
    if (typeof id === 'object') return id;
    return nodes.find(n => n.id === id);
  }, [nodes]);

  return (
    <Card
      ref={containerRef}
      sx={{
        p: 2,
        overflow: 'hidden',
        width: '100%',
        height: 'calc(100vh - 220px)', // Fill available height with margin for header/toolbar
        minHeight: 400,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {services.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {t('serverList.noData')}
          </Typography>
        </Box>
      ) : (
        <>
          {/* Reset view button - floating top right */}
          <Tooltip title={t('common.reset')} placement="left">
            <IconButton
              onClick={handleResetView}
              sx={{
                position: 'absolute',
                top: 16,
                right: 16,
                zIndex: 10,
                bgcolor: 'background.paper',
                boxShadow: 2,
                '&:hover': {
                  bgcolor: 'action.hover',
                },
              }}
              size="small"
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: '100%',
              height: '100%',
              flex: 1,
              cursor: isPanning ? 'grabbing' : (draggedNode ? 'grabbing' : 'grab'),
            }}
            onMouseDown={handlePanStart}
          >
            <svg
              ref={svgRef}
              width="100%"
              height="100%"
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
              preserveAspectRatio="xMidYMid meet"
              style={{
                cursor: draggedNode ? 'grabbing' : (isPanning ? 'grabbing' : 'grab'),
                userSelect: 'none',
              }}
              onWheel={handleWheel}
            >
              {/* CSS keyframes for ball pulse animation */}
              <style>
                {`
                  .cluster-ball-pulse circle:first-child {
                    filter: brightness(1.3);
                    transition: filter 0.3s ease-out;
                  }
                `}
              </style>
              <defs>
                {/* Gradient definitions for animated links */}
                <linearGradient id="pulseGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#90a4ae">
                    <animate attributeName="stop-color" values="#90a4ae;#ff9800;#90a4ae" dur="1s" repeatCount="indefinite" />
                  </stop>
                  <stop offset="50%" stopColor="#ff9800">
                    <animate attributeName="stop-color" values="#ff9800;#ffb74d;#ff9800" dur="1s" repeatCount="indefinite" />
                  </stop>
                  <stop offset="100%" stopColor="#90a4ae">
                    <animate attributeName="stop-color" values="#90a4ae;#ff9800;#90a4ae" dur="1s" repeatCount="indefinite" />
                  </stop>
                </linearGradient>

                {/* Heartbeat border glow filter */}
                <filter id="heartbeatGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>

              {/* Links */}
              {links.map((link, idx) => {
                const source = getNodeById(link.source);
                const target = getNodeById(link.target);
                if (!source || !target) return null;

                // Check if this link's target node has heartbeat
                const targetId = typeof link.target === 'string' ? link.target : link.target.id;
                const hasHeartbeat = heartbeatIds.has(targetId);

                return (
                  <g key={`link-${idx}`}>
                    {/* Base line */}
                    <line
                      x1={source.x || 0}
                      y1={source.y || 0}
                      x2={target.x || 0}
                      y2={target.y || 0}
                      stroke={hasHeartbeat ? 'url(#pulseGradient)' : '#90a4ae'}
                      strokeWidth={hasHeartbeat ? 3 : 2}
                      strokeDasharray={hasHeartbeat ? '8,4' : '4,4'}
                      opacity={hasHeartbeat ? 0.8 : 0.5}
                    >
                      {hasHeartbeat && (
                        <animate
                          attributeName="stroke-dashoffset"
                          values="0;24"
                          dur="0.5s"
                          repeatCount="indefinite"
                        />
                      )}
                    </line>
                  </g>
                );
              })}

              {/* Nodes */}
              {nodes.map(node => {
                if (node.isCenter) {
                  // Center cluster node - draggable
                  // Calculate count for this center node
                  const centerCount = node.groupKey
                    ? services.filter(s => getGroupKey(s) === node.groupKey).length
                    : services.length;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x || 0}, ${node.y || 0})`}
                      style={{ cursor: 'grab' }}
                      onMouseDown={(e) => handleMouseDown(node.id, e)}
                  >
                    <defs>
                      <linearGradient id={`centerGradient-${node.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#667eea" />
                        <stop offset="100%" stopColor="#764ba2" />
                      </linearGradient>
                    </defs>
                    <circle
                      r={centerRadius}
                      fill={`url(#centerGradient-${node.id})`}
                      stroke="#fff"
                      strokeWidth="3"
                    />
                    {node.groupKey ? (
                      // Grouped center node - show group key and count
                      <>
                        <text
                          textAnchor="middle"
                          fill="#fff"
                          fontSize="12"
                          fontWeight="bold"
                          dy="-12"
                        >
                          {node.groupKey === 'unknown' ? '---' : node.groupKey.toUpperCase()}
                        </text>
                        <text
                          textAnchor="middle"
                          fill="#fff"
                          fontSize="20"
                          fontWeight="bold"
                          dy="8"
                        >
                          {centerCount}
                        </text>
                        <text
                          textAnchor="middle"
                          fill="rgba(255,255,255,0.8)"
                          fontSize="9"
                          dy="22"
                        >
                          INSTANCES
                        </text>
                      </>
                    ) : (
                      // Single center node - show total count
                      <>
                        <text
                          textAnchor="middle"
                          fill="#fff"
                          fontSize="24"
                          fontWeight="bold"
                          dy="-5"
                        >
                          {centerCount}
                        </text>
                        <text
                          textAnchor="middle"
                          fill="rgba(255,255,255,0.8)"
                          fontSize="11"
                          dy="12"
                        >
                          INSTANCES
                        </text>
                      </>
                    )}
                  </g>
                );
              }

              // Service node - use serviceMap to get latest service data
              const serviceKey = node.id;
              const service = serviceMap.get(serviceKey) || node.service!;
              const hasHeartbeat = heartbeatIds.has(serviceKey);
              const hasRumble = rumbleNodes.has(serviceKey);
              const hasHeartbeatAnim = heartbeatAnimNodes.has(serviceKey);
              const nodeColor = getNodeColor(service.status);

              // Combine rumble triggers: status change OR heartbeat
              const shouldRumble = hasRumble || hasHeartbeatAnim;

              // Get rumble count for this node to use as animation key
              const currentRumbleCount = rumbleCounter.get(serviceKey) || 0;

              // Ping gauge: calculate arc path
              const progress = pingProgress.get(serviceKey) || 0;
              const pingGaugeRadius = nodeRadius + 6;
              const circumference = 2 * Math.PI * pingGaugeRadius;
              const strokeDasharray = `${progress * circumference} ${circumference}`;
              // Color transitions from green (0%) to yellow (50%) to red (100%)
              const pingGaugeColor = progress >= 1
                ? '#f44336' // Red when fully elapsed
                : progress >= 0.7
                  ? '#ff9800' // Orange when near timeout
                  : progress >= 0.5
                    ? '#ffc107' // Yellow at half
                    : '#4caf50'; // Green when fresh

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x || 0}, ${node.y || 0})`}
                  style={{ cursor: 'grab' }}
                  onMouseDown={(e) => handleMouseDown(node.id, e)}
                >
                  {/* Subtle ripple effect on heartbeat/status change */}
                  {shouldRumble && (
                    <>
                      <circle
                        key={`ripple1-${currentRumbleCount}`}
                        r={nodeRadius}
                        fill="none"
                        stroke="rgba(255,255,255,0.6)"
                        strokeWidth="2"
                      >
                        <animate
                          attributeName="r"
                          from={`${nodeRadius}`}
                          to={`${nodeRadius + 15}`}
                          dur="0.6s"
                          fill="freeze"
                        />
                        <animate
                          attributeName="opacity"
                          from="0.6"
                          to="0"
                          dur="0.6s"
                          fill="freeze"
                        />
                      </circle>
                      <circle
                        key={`ripple2-${currentRumbleCount}`}
                        r={nodeRadius}
                        fill="none"
                        stroke="rgba(255,255,255,0.4)"
                        strokeWidth="1"
                      >
                        <animate
                          attributeName="r"
                          from={`${nodeRadius}`}
                          to={`${nodeRadius + 25}`}
                          dur="0.8s"
                          fill="freeze"
                        />
                        <animate
                          attributeName="opacity"
                          from="0.4"
                          to="0"
                          dur="0.8s"
                          fill="freeze"
                        />
                      </circle>
                    </>
                  )}

                  {/* Outer glow for active services */}
                  {service.status === 'ready' && (
                    <circle
                      r={nodeRadius + 5}
                      fill="none"
                      stroke={nodeColor}
                      strokeWidth="2"
                      opacity="0.4"
                    >
                      <animate
                        attributeName="r"
                        values={`${nodeRadius + 3};${nodeRadius + 8};${nodeRadius + 3}`}
                        dur="2s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.4;0.2;0.4"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}

                  {/* Main circle with glow effects */}
                  <circle
                    r={nodeRadius}
                    fill={nodeColor}
                    stroke="#fff"
                    strokeWidth="2"
                    style={{
                      filter: shouldRumble
                        ? 'drop-shadow(0 0 10px #e53935) drop-shadow(0 0 5px #ff6659)'
                        : 'none',
                      transition: 'filter 0.3s ease-out',
                    }}
                  >
                    {/* Soft breathing opacity animation for initializing services */}
                    {service.status === 'initializing' && (
                      <animate
                        attributeName="opacity"
                        values="1;0.5;1"
                        dur="2s"
                        repeatCount="indefinite"
                        calcMode="spline"
                        keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
                      />
                    )}
                  </circle>

                  {/* Ping gauge - circular progress indicator (only for normal states) */}
                  {(service.status === 'ready' || service.status === 'initializing') && (
                    <>
                      <circle
                        r={pingGaugeRadius}
                        fill="none"
                        stroke="rgba(128,128,128,0.3)"
                        strokeWidth="3"
                      />
                      <circle
                        r={pingGaugeRadius}
                        fill="none"
                        stroke={pingGaugeColor}
                        strokeWidth="3"
                        strokeDasharray={strokeDasharray}
                        strokeLinecap="round"
                        transform="rotate(-90)"
                        style={{
                          transition: 'stroke 0.3s ease-out',
                        }}
                      />
                    </>
                  )}

                  {/* Shine effect */}
                  <ellipse
                    cx={-10}
                    cy={-12}
                    rx="10"
                    ry="7"
                    fill="rgba(255,255,255,0.25)"
                  />

                  {/* Service type label */}
                  <text
                    y={-6}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="10"
                    fontWeight="bold"
                    fontFamily="D2Coding, monospace"
                  >
                    {(service.labels.service || '').substring(0, 7).toUpperCase()}
                  </text>

                  {/* Hostname */}
                  <text
                    y={10}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.9)"
                    fontSize="9"
                    fontFamily="D2Coding, monospace"
                  >
                    {(service.hostname || '').substring(0, 8)}
                  </text>
                </g>
              );
            })}
          </svg>
        </Box>
        </>
      )}
    </Card>
  );
};

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

  // Health check state: Map<serviceKey, { loading: boolean, cooldown: boolean, fading: boolean, result?: { healthy: boolean, latency: number, error?: string } }>
  const [healthCheckStatus, setHealthCheckStatus] = useState<Map<string, {
    loading: boolean;
    cooldown: boolean;
    fading: boolean;
    result?: { healthy: boolean; latency: number; error?: string }
  }>>(new Map());

  // Bulk health check dialog state
  const [bulkHealthCheckOpen, setBulkHealthCheckOpen] = useState(false);
  const [bulkHealthCheckResults, setBulkHealthCheckResults] = useState<{
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
  }[]>([]);
  const [bulkHealthCheckRunning, setBulkHealthCheckRunning] = useState(false);
  const [bulkHealthCheckSelected, setBulkHealthCheckSelected] = useState<Set<string>>(new Set());

  // Grouping state (persisted in localStorage)
  const [groupingBy, setGroupingBy] = useState<GroupingOption>(() => {
    return (localStorage.getItem('serverListGroupingBy') as GroupingOption) || 'none';
  });
  const [groupingMenuAnchor, setGroupingMenuAnchor] = useState<null | HTMLElement>(null);

  // Status counters - computed from services
  const statusCounts = useMemo(() => {
    const counts = {
      initializing: 0,
      ready: 0,
      shutting_down: 0,
      terminated: 0,
      error: 0,
    };
    services.forEach((s) => {
      if (s.status === 'initializing') counts.initializing++;
      else if (s.status === 'ready') counts.ready++;
      else if (s.status === 'shutting_down') counts.shutting_down++;
      else if (s.status === 'terminated') counts.terminated++;
      else if (s.status === 'error' || s.status === 'no-response') counts.error++;
    });
    return counts;
  }, [services]);

  // Default column configuration
  const defaultColumns: ColumnConfig[] = [
    { id: 'status', labelKey: 'serverList.table.status', visible: true },
    { id: 'service', labelKey: 'serverList.table.service', visible: true },
    { id: 'group', labelKey: 'serverList.table.group', visible: true },
    { id: 'environment', labelKey: 'serverList.table.environment', visible: true },
    { id: 'region', labelKey: 'serverList.table.region', visible: true },
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

  // Grouping change handler
  const handleGroupingChange = (option: GroupingOption) => {
    setGroupingBy(option);
    localStorage.setItem('serverListGroupingBy', option);
    setGroupingMenuAnchor(null);
  };

  // Health check a service
  const handleHealthCheck = async (service: ServiceInstance) => {
    const serviceKey = `${service.labels.service}-${service.instanceId}`;

    // Set loading state
    setHealthCheckStatus(prev => new Map(prev).set(serviceKey, { loading: true, cooldown: false, fading: false }));

    const startFadeOut = () => {
      // Start fading animation after 5 seconds
      setTimeout(() => {
        setHealthCheckStatus(prev => {
          const current = prev.get(serviceKey);
          if (current) {
            return new Map(prev).set(serviceKey, { ...current, fading: true });
          }
          return prev;
        });
        // Clear result after fade animation (500ms)
        setTimeout(() => {
          setHealthCheckStatus(prev => {
            const newMap = new Map(prev);
            newMap.delete(serviceKey);
            return newMap;
          });
        }, 500);
      }, 5000);
    };

    try {
      const result = await serviceDiscoveryService.healthCheck(service.labels.service, service.instanceId);

      // Set result and start cooldown
      setHealthCheckStatus(prev => new Map(prev).set(serviceKey, {
        loading: false,
        cooldown: true,
        fading: false,
        result: {
          healthy: result.healthy,
          latency: result.latency,
          error: result.error
        }
      }));

      startFadeOut();
    } catch (error: any) {
      // Set error result and start cooldown
      setHealthCheckStatus(prev => new Map(prev).set(serviceKey, {
        loading: false,
        cooldown: true,
        fading: false,
        result: {
          healthy: false,
          latency: 0,
          error: error.message || 'Request failed'
        }
      }));

      startFadeOut();
    }
  };

  // Check if service has a web port for health check
  const hasWebPort = (service: ServiceInstance): boolean => {
    const ports = service.ports;
    return !!(ports?.internalApi || ports?.externalApi || ports?.web || ports?.http || ports?.api);
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

  // Bulk health check handlers
  const handleBulkHealthCheckOpen = () => {
    // Filter only checkable services (those with API ports and active status)
    const checkableServices = services.filter(s => {
      const ports = s.ports;
      const hasApiPort = !!(ports?.internalApi || ports?.externalApi || ports?.web || ports?.http || ports?.api);
      const isActive = s.status === 'ready' || s.status === 'initializing';
      return hasApiPort && isActive;
    });

    const results = checkableServices.map(s => {
      const ports = s.ports;
      const healthPort = ports?.internalApi || ports?.externalApi || ports?.web || ports?.http || ports?.api;
      return {
        serviceKey: `${s.labels.service}-${s.instanceId}`,
        service: s.labels.service,
        instanceId: s.instanceId,
        group: s.labels.group,
        env: s.labels.environment,
        hostname: s.hostname,
        internalIp: s.internalAddress,
        healthPort: healthPort,
        status: 'pending' as const,
      };
    });

    setBulkHealthCheckResults(results);
    // Select all by default
    setBulkHealthCheckSelected(new Set(results.map(r => r.serviceKey)));
    setBulkHealthCheckOpen(true);
  };

  const handleBulkHealthCheckToggle = (serviceKey: string) => {
    setBulkHealthCheckSelected(prev => {
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
    setBulkHealthCheckSelected(new Set(bulkHealthCheckResults.map(r => r.serviceKey)));
  };

  const handleBulkHealthCheckDeselectAll = () => {
    setBulkHealthCheckSelected(new Set());
  };

  const handleBulkHealthCheckStart = async () => {
    setBulkHealthCheckRunning(true);

    // Reset selected items to 'pending' status first (for re-checking)
    setBulkHealthCheckResults(prev => prev.map(item =>
      bulkHealthCheckSelected.has(item.serviceKey)
        ? { ...item, status: 'pending' as const, latency: undefined, error: undefined }
        : item
    ));

    // Get only selected items to check
    const selectedItems = bulkHealthCheckResults
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => bulkHealthCheckSelected.has(item.serviceKey));

    for (let j = 0; j < selectedItems.length; j++) {
      const { item, idx: i } = selectedItems[j];

      // Update status to 'checking'
      setBulkHealthCheckResults(prev => prev.map((r, idx) =>
        idx === i ? { ...r, status: 'checking' as const } : r
      ));

      // Auto-scroll to current row (center it in the container)
      setTimeout(() => {
        const row = document.getElementById(`bulk-health-row-${i}`);
        const container = document.getElementById('bulk-health-check-scroll-container');
        if (row && container) {
          const rowTop = row.offsetTop;
          const rowHeight = row.offsetHeight;
          const containerHeight = container.clientHeight;
          const headerHeight = 40; // Approximate sticky header height
          // Scroll so the row is centered in the visible area
          const scrollTarget = rowTop - headerHeight - (containerHeight / 2) + (rowHeight / 2);
          container.scrollTo({
            top: Math.max(0, scrollTarget),
            behavior: 'smooth',
          });
        }
      }, 50);

      try {
        const result = await serviceDiscoveryService.healthCheck(item.service, item.instanceId);

        // Update with result
        setBulkHealthCheckResults(prev => prev.map((r, idx) =>
          idx === i ? {
            ...r,
            status: result.healthy ? 'success' as const : 'failed' as const,
            latency: result.latency,
            error: result.error,
          } : r
        ));
      } catch (error: any) {
        setBulkHealthCheckResults(prev => prev.map((r, idx) =>
          idx === i ? {
            ...r,
            status: 'failed' as const,
            error: error.message || 'Unknown error',
          } : r
        ));
      }

      // Small delay between checks to avoid overwhelming the servers
      if (j < selectedItems.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    setBulkHealthCheckRunning(false);
    setHasCompletedHealthCheck(true);
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
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);

  const handleExportMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setExportMenuAnchor(event.currentTarget);
  };

  const handleExportMenuClose = () => {
    setExportMenuAnchor(null);
  };

  const handleExportHealthCheck = (format: 'csv' | 'xlsx' | 'json') => {
    handleExportMenuClose();

    const exportData = bulkHealthCheckResults.map(item => ({
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

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
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
      const headers = ['Service', 'Group', 'Environment', 'Hostname', 'Internal IP', 'Port', 'Status', 'Latency (ms)', 'Error'];
      const csvRows = [
        headers.join(','),
        ...exportData.map(row =>
          [row.service, row.group, row.env, row.hostname, row.internalIp, row.port, row.status, row.latency, `"${row.error}"`].join(',')
        ),
      ];
      const csvStr = csvRows.join('\n');
      const blob = new Blob(['\uFEFF' + csvStr], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'xlsx') {
      // For xlsx, we'll use a simple approach with csv-like data
      // In production, you might want to use a library like xlsx or exceljs
      import('xlsx').then(XLSX => {
        const ws = XLSX.utils.json_to_sheet(exportData.map(row => ({
          Service: row.service,
          Group: row.group,
          Environment: row.env,
          Hostname: row.hostname,
          'Internal IP': row.internalIp,
          Port: row.port,
          Status: row.status,
          'Latency (ms)': row.latency,
          Error: row.error,
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Health Check Results');
        XLSX.writeFile(wb, `${filename}.xlsx`);
      }).catch(() => {
        enqueueSnackbar(t('common.exportFailed'), { variant: 'error' });
      });
    }
  };

  // Bulk health check statistics
  const bulkHealthCheckStats = useMemo(() => {
    const total = bulkHealthCheckResults.length;
    const success = bulkHealthCheckResults.filter(r => r.status === 'success').length;
    const failed = bulkHealthCheckResults.filter(r => r.status === 'failed').length;
    const pending = bulkHealthCheckResults.filter(r => r.status === 'pending').length;
    const checking = bulkHealthCheckResults.filter(r => r.status === 'checking').length;
    const completed = success + failed;
    const avgLatency = bulkHealthCheckResults
      .filter(r => r.status === 'success' && r.latency)
      .reduce((acc, r) => acc + (r.latency || 0), 0) / (success || 1);

    return { total, success, failed, pending, checking, completed, avgLatency };
  }, [bulkHealthCheckResults]);

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
    [...new Set(services.map(s => s.labels.environment).filter(Boolean))].sort() as string[],
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
      if (filter.key === 'env' && filter.value && service.labels.environment !== filter.value) {
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
                minWidth: 280,
                flexGrow: 1,
                maxWidth: 320,
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

            {/* Status Counters - wrapped in a box like StoreProducts */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0,
                ml: 1,
                borderRadius: 1,
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                overflow: 'hidden',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'info.main' }} />
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {t('serverList.stats.initializing')} <strong style={{ color: 'inherit' }}>{statusCounts.initializing}</strong>
                </Typography>
              </Box>
              <Box sx={{ width: '1px', height: 20, bgcolor: 'divider' }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} />
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {t('serverList.stats.ready')} <strong style={{ color: 'inherit' }}>{statusCounts.ready}</strong>
                </Typography>
              </Box>
              <Box sx={{ width: '1px', height: 20, bgcolor: 'divider' }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main' }} />
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {t('serverList.stats.shuttingDown')} <strong style={{ color: 'inherit' }}>{statusCounts.shutting_down}</strong>
                </Typography>
              </Box>
              <Box sx={{ width: '1px', height: 20, bgcolor: 'divider' }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'grey.500' }} />
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {t('serverList.stats.terminated')} <strong style={{ color: 'inherit' }}>{statusCounts.terminated}</strong>
                </Typography>
              </Box>
              <Box sx={{ width: '1px', height: 20, bgcolor: 'divider' }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'error.main' }} />
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {t('serverList.stats.error')} <strong style={{ color: 'inherit' }}>{statusCounts.error}</strong>
                </Typography>
              </Box>
            </Box>

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
            <Tooltip title={t('serverList.viewMode.cluster')}>
              <IconButton
                onClick={() => handleViewModeChange('cluster')}
                sx={{
                  bgcolor: viewMode === 'cluster' ? 'primary.main' : 'background.paper',
                  color: viewMode === 'cluster' ? 'primary.contrastText' : 'text.primary',
                  border: 1,
                  borderColor: viewMode === 'cluster' ? 'primary.main' : 'divider',
                  '&:hover': {
                    bgcolor: viewMode === 'cluster' ? 'primary.dark' : 'action.hover',
                  },
                }}
              >
                <BubbleChartIcon />
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

            {/* Grouping Button - Only show in cluster view */}
            {viewMode === 'cluster' && (
              <>
                <Tooltip title={t('serverList.grouping.label')}>
                  <Button
                    size="small"
                    variant={groupingBy !== 'none' ? 'contained' : 'outlined'}
                    onClick={(e) => setGroupingMenuAnchor(e.currentTarget)}
                    sx={{
                      minWidth: 'auto',
                      px: 1.5,
                      textTransform: 'none',
                      ...(groupingBy === 'none' && {
                        bgcolor: 'background.paper',
                        borderColor: 'divider',
                        color: 'text.primary',
                        '&:hover': {
                          bgcolor: 'action.hover',
                        },
                      }),
                    }}
                  >
                    {groupingBy === 'none'
                      ? t('serverList.grouping.label')
                      : t(`serverList.grouping.${groupingBy}`)}
                  </Button>
                </Tooltip>
                <Menu
                  anchorEl={groupingMenuAnchor}
                  open={Boolean(groupingMenuAnchor)}
                  onClose={() => setGroupingMenuAnchor(null)}
                >
                  <MenuItem
                    selected={groupingBy === 'none'}
                    onClick={() => handleGroupingChange('none')}
                  >
                    {t('serverList.grouping.none')}
                  </MenuItem>
                  <MenuItem
                    selected={groupingBy === 'service'}
                    onClick={() => handleGroupingChange('service')}
                  >
                    {t('serverList.grouping.service')}
                  </MenuItem>
                  <MenuItem
                    selected={groupingBy === 'group'}
                    onClick={() => handleGroupingChange('group')}
                  >
                    {t('serverList.grouping.group')}
                  </MenuItem>
                  <MenuItem
                    selected={groupingBy === 'environment'}
                    onClick={() => handleGroupingChange('environment')}
                  >
                    {t('serverList.grouping.environment')}
                  </MenuItem>
                  <MenuItem
                    selected={groupingBy === 'region'}
                    onClick={() => handleGroupingChange('region')}
                  >
                    {t('serverList.grouping.region')}
                  </MenuItem>
                </Menu>
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
              </>
            )}

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

            {/* Divider before Bulk Health Check */}
            <Box
              sx={{
                width: '1px',
                height: '24px',
                bgcolor: (theme) => theme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.2)'
                  : 'rgba(0, 0, 0, 0.2)',
              }}
            />

            {/* Bulk Health Check Button */}
            <Tooltip title={t('serverList.bulkHealthCheck')}>
              <span>
                <IconButton
                  onClick={handleBulkHealthCheckOpen}
                  disabled={services.filter(s => s.status === 'ready' || s.status === 'initializing').length === 0}
                  sx={{
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <NetworkCheckIcon />
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
                    <TableCell key={column.id} align={column.id === 'actions' ? 'center' : 'left'}>
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
                                <Typography variant="body2" sx={{ fontFamily: '"D2Coding", monospace' }}>
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
                          case 'environment':
                            return (
                              <TableCell key={column.id}>
                                {service.labels.environment ? (
                                  <Chip
                                    label={service.labels.environment}
                                    size="small"
                                    variant="outlined"
                                    color="secondary"
                                    sx={{ fontWeight: 600 }}
                                  />
                                ) : (
                                  <Typography variant="caption" color="text.disabled">-</Typography>
                                )}
                              </TableCell>
                            );
                          case 'region':
                            return (
                              <TableCell key={column.id}>
                                {service.labels.region ? (
                                  <Chip
                                    label={service.labels.region}
                                    size="small"
                                    variant="outlined"
                                    color="info"
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
                                    .filter(([key]) => key !== 'service' && key !== 'group' && key !== 'environment' && key !== 'region')
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
                                <Typography variant="body2" sx={{ fontFamily: '"D2Coding", monospace' }}>
                                  {service.hostname}
                                </Typography>
                              </TableCell>
                            );
                          case 'externalAddress':
                            return (
                              <TableCell key={column.id}>
                                <Typography variant="body2" sx={{ fontFamily: '"D2Coding", monospace' }}>
                                  {service.externalAddress}
                                </Typography>
                              </TableCell>
                            );
                          case 'internalAddress':
                            return (
                              <TableCell key={column.id}>
                                <Typography variant="body2" sx={{ fontFamily: '"D2Coding", monospace' }}>
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
                                        sx={{ fontFamily: '"D2Coding", monospace', fontSize: '0.875rem', height: '24px' }}
                                      />
                                    ))}
                                  </Box>
                                )}
                              </TableCell>
                            );
                          case 'status':
                            // Only show heartbeat icon for initializing/ready status
                            const showHeartbeatIcon = service.status === 'initializing' || service.status === 'ready';
                            return (
                              <TableCell key={column.id}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  {getStatusBadge(service.status)}
                                  {showHeartbeatIcon && (
                                    <Box
                                      sx={{
                                        width: 26,
                                        height: 26,
                                        borderRadius: '50%',
                                        border: 1,
                                        borderColor: heartbeatIds.has(serviceKey) ? 'error.main' : 'divider',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        bgcolor: 'background.paper',
                                      }}
                                    >
                                      <FavoriteIcon
                                        sx={{
                                          fontSize: 14,
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
                                  )}
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
                                <RelativeTime date={service.createdAt} showSeconds />
                              </TableCell>
                            );
                          case 'updatedAt':
                            return (
                              <TableCell key={column.id}>
                                <RelativeTime date={service.updatedAt} showSeconds />
                              </TableCell>
                            );
                          case 'actions':
                            const actionsServiceKey = `${service.labels.service}-${service.instanceId}`;
                            const actionsHealthStatus = healthCheckStatus.get(actionsServiceKey);
                            return (
                              <TableCell key={column.id} align="center">
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                  {hasWebPort(service) && (
                                    actionsHealthStatus?.cooldown && actionsHealthStatus.result ? (
                                      // Show result: ms or X
                                      <Box
                                        sx={{
                                          minWidth: 44,
                                          height: 24,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          borderRadius: 1,
                                          bgcolor: actionsHealthStatus.result.healthy ? 'success.main' : 'error.main',
                                          color: 'white',
                                          fontSize: '0.75rem',
                                          fontWeight: 600,
                                          px: 0.75,
                                          animation: actionsHealthStatus.fading ? 'wiggleFade 0.5s ease-out forwards' : 'none',
                                          '@keyframes wiggleFade': {
                                            '0%': { opacity: 1, transform: 'scale(1)' },
                                            '20%': { transform: 'scale(1.1) rotate(-3deg)' },
                                            '40%': { transform: 'scale(0.9) rotate(3deg)' },
                                            '60%': { transform: 'scale(1.05) rotate(-2deg)' },
                                            '80%': { opacity: 0.5, transform: 'scale(0.95) rotate(1deg)' },
                                            '100%': { opacity: 0, transform: 'scale(0.8)' },
                                          },
                                        }}
                                      >
                                        {actionsHealthStatus.result.healthy
                                          ? `${actionsHealthStatus.result.latency}ms`
                                          : '✕'}
                                      </Box>
                                    ) : (
                                      // Show button (rounded style like view mode buttons)
                                      <Tooltip title={t('serverList.healthCheck.tooltip')} arrow>
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
                                            bgcolor: 'background.paper',
                                            border: 1,
                                            borderColor: 'divider',
                                            '&:hover': {
                                              bgcolor: 'action.hover',
                                            },
                                          }}
                                        >
                                          {actionsHealthStatus?.loading ? (
                                            <CircularProgress size={14} />
                                          ) : (
                                            <TouchAppIcon fontSize="small" />
                                          )}
                                        </IconButton>
                                      </Tooltip>
                                    )
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
                        height: 130,
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
                            {/* Only show heartbeat icon for initializing/ready status */}
                            {(service.status === 'initializing' || service.status === 'ready') && (
                              <Box
                                sx={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: '50%',
                                  border: 1,
                                  borderColor: heartbeatIds.has(serviceKey) ? 'error.main' : 'divider',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  bgcolor: 'background.paper',
                                }}
                              >
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
                            )}
                          </Box>
                        </Box>
                        {/* Hostname */}
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: '"D2Coding", monospace',
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {service.hostname}
                        </Typography>
                        {/* Group label if exists */}
                        {service.labels.group && (
                          <Typography variant="caption" color="primary.main" sx={{ fontWeight: 500 }}>
                            {service.labels.group}
                          </Typography>
                        )}
                        {/* Spacer */}
                        <Box sx={{ flex: 1 }} />
                        {/* Footer: IP + Ports + Health */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" sx={{ fontFamily: '"D2Coding", monospace', color: 'text.secondary' }}>
                              {service.externalAddress}
                            </Typography>
                            {hasWebPort(service) && (() => {
                              const gridHealthStatus = healthCheckStatus.get(serviceKey);
                              return gridHealthStatus?.cooldown && gridHealthStatus.result ? (
                                <Box
                                  sx={{
                                    minWidth: 36,
                                    height: 18,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 0.5,
                                    bgcolor: gridHealthStatus.result.healthy ? 'success.main' : 'error.main',
                                    color: 'white',
                                    fontSize: '0.65rem',
                                    fontWeight: 600,
                                    px: 0.5,
                                    animation: gridHealthStatus.fading ? 'wiggleFade 0.5s ease-out forwards' : 'none',
                                    '@keyframes wiggleFade': {
                                      '0%': { opacity: 1, transform: 'scale(1)' },
                                      '20%': { transform: 'scale(1.1) rotate(-3deg)' },
                                      '40%': { transform: 'scale(0.9) rotate(3deg)' },
                                      '60%': { transform: 'scale(1.05) rotate(-2deg)' },
                                      '80%': { opacity: 0.5, transform: 'scale(0.95) rotate(1deg)' },
                                      '100%': { opacity: 0, transform: 'scale(0.8)' },
                                    },
                                  }}
                                >
                                  {gridHealthStatus.result.healthy
                                    ? `${gridHealthStatus.result.latency}ms`
                                    : '✕'}
                                </Box>
                              ) : (
                                <Tooltip title={t('serverList.healthCheck.tooltip')} arrow>
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleHealthCheck(service);
                                    }}
                                    disabled={gridHealthStatus?.loading}
                                    sx={{
                                      width: 20,
                                      height: 20,
                                      p: 0,
                                      bgcolor: 'background.paper',
                                      border: 1,
                                      borderColor: 'divider',
                                      '&:hover': {
                                        bgcolor: 'action.hover',
                                      },
                                    }}
                                  >
                                    {gridHealthStatus?.loading ? (
                                      <CircularProgress size={12} />
                                    ) : (
                                      <TouchAppIcon sx={{ fontSize: 14 }} />
                                    )}
                                  </IconButton>
                                </Tooltip>
                              );
                            })()}
                          </Box>
                          {ports.length > 0 && (
                            <Typography variant="body2" sx={{ fontFamily: '"D2Coding", monospace', color: 'text.disabled', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                      height: 130,
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
                        minHeight: 300,
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
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {getStatusBadge(service.status)}
                            {/* Only show heartbeat icon for initializing/ready status */}
                            {(service.status === 'initializing' || service.status === 'ready') && (
                              <Box
                                sx={{
                                  width: 26,
                                  height: 26,
                                  borderRadius: '50%',
                                  border: 1,
                                  borderColor: heartbeatIds.has(serviceKey) ? 'error.main' : 'divider',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  bgcolor: 'background.paper',
                                }}
                              >
                                <FavoriteIcon
                                  sx={{
                                    fontSize: 14,
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
                            )}
                          </Box>
                        </Box>

                        {/* Hostname */}
                        <Typography
                          variant="body2"
                          sx={{ fontFamily: '"D2Coding", monospace', fontWeight: 600 }}
                        >
                          {service.hostname}
                        </Typography>

                        {/* Instance ID */}
                        <Typography
                          variant="body2"
                          color="text.disabled"
                          sx={{ fontFamily: '"D2Coding", monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {service.instanceId}
                        </Typography>

                        {/* Info Grid */}
                        <Box sx={{
                          mt: 1,
                          display: 'grid',
                          gridTemplateColumns: 'auto 1fr',
                          gap: 0.25,
                          '& .label': { color: 'text.secondary', fontSize: '0.875rem', minWidth: 55 },
                          '& .value': { fontFamily: '"D2Coding", monospace', fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
                        }}>
                          <Typography className="label">External</Typography>
                          <Typography className="value">{service.externalAddress}</Typography>
                          <Typography className="label">Internal</Typography>
                          <Typography className="value">{service.internalAddress}</Typography>
                        </Box>

                        {/* Ports - Compact inline chips */}
                        {ports.length > 0 && (
                          <Box sx={{
                            mt: 0.5,
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 0.5,
                          }}>
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
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                            {customLabels.map(([key, value]) => (
                              <Chip
                                key={`${service.instanceId}-${key}`}
                                label={`${key}=${value}`}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.8rem', height: 24, fontFamily: '"D2Coding", monospace' }}
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

                        {/* Footer: Health + Updated time */}
                        <Box sx={{ mt: 0.5, pt: 0.5, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          {hasWebPort(service) ? (() => {
                            const cardHealthStatus = healthCheckStatus.get(serviceKey);
                            return cardHealthStatus?.cooldown && cardHealthStatus.result ? (
                              <Box
                                sx={{
                                  minWidth: 44,
                                  height: 22,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: 1,
                                  bgcolor: cardHealthStatus.result.healthy ? 'success.main' : 'error.main',
                                  color: 'white',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  px: 0.75,
                                  animation: cardHealthStatus.fading ? 'wiggleFade 0.5s ease-out forwards' : 'none',
                                  '@keyframes wiggleFade': {
                                    '0%': { opacity: 1, transform: 'scale(1)' },
                                    '20%': { transform: 'scale(1.1) rotate(-3deg)' },
                                    '40%': { transform: 'scale(0.9) rotate(3deg)' },
                                    '60%': { transform: 'scale(1.05) rotate(-2deg)' },
                                    '80%': { opacity: 0.5, transform: 'scale(0.95) rotate(1deg)' },
                                    '100%': { opacity: 0, transform: 'scale(0.8)' },
                                  },
                                }}
                              >
                                {cardHealthStatus.result.healthy
                                  ? `${cardHealthStatus.result.latency}ms`
                                  : '✕'}
                              </Box>
                            ) : (
                              <Tooltip title={t('serverList.healthCheck.tooltip')} arrow>
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleHealthCheck(service);
                                  }}
                                  disabled={cardHealthStatus?.loading}
                                  sx={{
                                    width: 24,
                                    height: 24,
                                    p: 0,
                                    bgcolor: 'background.paper',
                                    border: 1,
                                    borderColor: 'divider',
                                    '&:hover': {
                                      bgcolor: 'action.hover',
                                    },
                                  }}
                                >
                                  {cardHealthStatus?.loading ? (
                                    <CircularProgress size={14} />
                                  ) : (
                                    <TouchAppIcon sx={{ fontSize: 16 }} />
                                  )}
                                </IconButton>
                              </Tooltip>
                            );
                          })() : <Box />}
                          <RelativeTime date={service.updatedAt} variant="caption" color="text.disabled" showSeconds />
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
                      minHeight: 300,
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

      {/* Cluster View - Force-directed grape cluster visualization */}
      {!isLoading && viewMode === 'cluster' && (
        <ClusterView
          services={gridDisplayServices}
          heartbeatIds={heartbeatIds}
          t={t}
          groupingBy={groupingBy}
        />
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

      {/* Bulk Health Check Dialog */}
      <Dialog
        open={bulkHealthCheckOpen}
        onClose={handleBulkHealthCheckClose}
        maxWidth="xl"
        fullWidth
        aria-labelledby="bulk-health-check-dialog-title"
      >
        <DialogTitle id="bulk-health-check-dialog-title" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
            />
            <Chip
              icon={<CheckCircleIcon />}
              label={`${t('serverList.bulkHealthCheck.success')}: ${bulkHealthCheckStats.success}`}
              color="success"
              variant={bulkHealthCheckStats.success > 0 ? 'filled' : 'outlined'}
            />
            <Chip
              icon={<ErrorIcon />}
              label={`${t('serverList.bulkHealthCheck.failed')}: ${bulkHealthCheckStats.failed}`}
              color="error"
              variant={bulkHealthCheckStats.failed > 0 ? 'filled' : 'outlined'}
            />
            {bulkHealthCheckStats.success > 0 && (
              <Chip
                label={`${t('serverList.bulkHealthCheck.avgLatency')}: ${Math.round(bulkHealthCheckStats.avgLatency)}ms`}
                color="info"
                variant="outlined"
              />
            )}
          </Box>

          {/* Progress Bar */}
          {bulkHealthCheckRunning && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
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
                  <TableCell sx={{ width: 50, bgcolor: 'background.paper', padding: '4px 8px' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Checkbox
                        size="small"
                        checked={bulkHealthCheckSelected.size === bulkHealthCheckResults.length && bulkHealthCheckResults.length > 0}
                        indeterminate={bulkHealthCheckSelected.size > 0 && bulkHealthCheckSelected.size < bulkHealthCheckResults.length}
                        onChange={(e) => e.target.checked ? handleBulkHealthCheckSelectAll() : handleBulkHealthCheckDeselectAll()}
                        disabled={bulkHealthCheckRunning}
                      />
                    </Box>
                  </TableCell>
                  <TableCell sx={{ width: 50, bgcolor: 'background.paper' }}>{t('serverList.bulkHealthCheck.status')}</TableCell>
                  <TableCell sx={{ bgcolor: 'background.paper' }}>{t('serverList.table.service')}</TableCell>
                  <TableCell sx={{ bgcolor: 'background.paper' }}>{t('serverList.table.group')}</TableCell>
                  <TableCell sx={{ bgcolor: 'background.paper' }}>{t('serverList.filters.env')}</TableCell>
                  <TableCell sx={{ bgcolor: 'background.paper' }}>{t('serverList.table.hostname')}</TableCell>
                  <TableCell sx={{ bgcolor: 'background.paper' }}>{t('serverList.table.internalAddress')}</TableCell>
                  <TableCell sx={{ width: 70, bgcolor: 'background.paper' }}>{t('serverList.bulkHealthCheck.port')}</TableCell>
                  <TableCell sx={{ width: 80, bgcolor: 'background.paper' }}>{t('serverList.bulkHealthCheck.latency')}</TableCell>
                  <TableCell sx={{ bgcolor: 'background.paper' }}>{t('serverList.bulkHealthCheck.result')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bulkHealthCheckResults.map((item, index) => (
                  <TableRow
                    key={item.serviceKey}
                    id={`bulk-health-row-${index}`}
                    sx={{
                      bgcolor: item.status === 'checking' ? alpha('#1976d2', 0.1) :
                        item.status === 'success' ? alpha('#2e7d32', 0.05) :
                          item.status === 'failed' ? alpha('#d32f2f', 0.05) : 'transparent',
                      transition: 'background-color 0.3s ease',
                    }}
                  >
                    <TableCell sx={{ padding: '4px 8px' }}>
                      <Checkbox
                        size="small"
                        checked={bulkHealthCheckSelected.has(item.serviceKey)}
                        onChange={() => handleBulkHealthCheckToggle(item.serviceKey)}
                        disabled={bulkHealthCheckRunning || item.status !== 'pending'}
                      />
                    </TableCell>
                    <TableCell>
                      {item.status === 'pending' && (
                        <HourglassEmptyIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
                      )}
                      {item.status === 'checking' && (
                        <CircularProgress size={18} />
                      )}
                      {item.status === 'success' && (
                        <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
                      )}
                      {item.status === 'failed' && (
                        <ErrorIcon sx={{ color: 'error.main', fontSize: 20 }} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {item.service}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {item.group || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {item.env || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'D2Coding, monospace', fontSize: '0.75rem' }}>
                        {item.hostname || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'D2Coding, monospace', fontSize: '0.75rem' }}>
                        {item.internalIp || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'D2Coding, monospace', fontSize: '0.75rem' }}>
                        {item.healthPort || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {item.latency !== undefined && (
                        <Typography
                          variant="body2"
                          sx={{
                            color: item.latency < 100 ? 'success.main' :
                              item.latency < 500 ? 'warning.main' : 'error.main',
                          }}
                        >
                          {item.latency}ms
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.error && (
                        <Typography variant="body2" color="error.main" sx={{ fontSize: '0.75rem' }}>
                          {item.error}
                        </Typography>
                      )}
                      {item.status === 'success' && !item.error && (
                        <Typography variant="body2" color="success.main" sx={{ fontSize: '0.75rem' }}>
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
            {t('serverList.bulkHealthCheck.selected')}: {bulkHealthCheckSelected.size} / {bulkHealthCheckResults.length}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button onClick={handleBulkHealthCheckClose} disabled={bulkHealthCheckRunning}>
              {t('common.close')}
            </Button>
            <Button
              onClick={handleBulkHealthCheckStart}
              variant="contained"
              disabled={bulkHealthCheckRunning || bulkHealthCheckSelected.size === 0}
              startIcon={bulkHealthCheckRunning ? <CircularProgress size={16} color="inherit" /> : <NetworkCheckIcon />}
            >
              {bulkHealthCheckRunning ? t('serverList.bulkHealthCheck.checking') : t('serverList.bulkHealthCheck.start')}
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
    </Box>
  );
};

export default ServerListPage;

