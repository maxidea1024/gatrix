import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  SimulationNodeDatum,
  SimulationLinkDatum,
  ForceLink,
} from 'd3-force';
import { Box, Card, IconButton, Tooltip } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { ServiceInstance } from '../../services/serviceDiscoveryService';
import EmptyPagePlaceholder from '../common/EmptyPagePlaceholder';
import { HEARTBEAT_TTL_SECONDS } from './constants';
import type { GroupingField, GroupingOption } from './types';

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

// ClusterView component props
interface ClusterViewProps {
  services: ServiceInstance[];
  heartbeatIds: Set<string>;
  t: (key: string) => string;
  groupingLevels?: GroupingField[];
  onContextMenu?: (event: React.MouseEvent, service: ServiceInstance) => void;
}

const ClusterView: React.FC<ClusterViewProps> = ({
  services,
  heartbeatIds,
  t,
  groupingLevels = [],
  onContextMenu,
}) => {
  // ClusterView uses first grouping level only for now
  const groupingBy: GroupingOption =
    groupingLevels.length > 0 ? groupingLevels[0] : 'none';
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<ClusterNode[]>([]);
  const [links, setLinks] = useState<ClusterLink[]>([]);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const simulationRef = useRef<ReturnType<
    typeof forceSimulation<ClusterNode>
  > | null>(null);
  const nodesRef = useRef<ClusterNode[]>([]);
  const linksRef = useRef<ClusterLink[]>([]);
  const rafPendingRef = useRef(false);

  // Track rumble and heartbeat animation states
  const [rumbleNodes, setRumbleNodes] = useState<Set<string>>(new Set());
  const [heartbeatAnimNodes, setHeartbeatAnimNodes] = useState<Set<string>>(
    new Set()
  );
  // Counter to force re-render of animate elements - Map<nodeId, counter>
  const [rumbleCounter, setRumbleCounter] = useState<Map<string, number>>(
    new Map()
  );
  const prevStatusRef = useRef<Map<string, string>>(new Map());
  const prevHeartbeatRef = useRef<Set<string>>(new Set());

  // Ping gauge state: track last heartbeat time for each node
  const [lastHeartbeatTime, setLastHeartbeatTime] = useState<
    Map<string, number>
  >(new Map());
  const [pingProgress, setPingProgress] = useState<Map<string, number>>(
    new Map()
  );

  // Pan and zoom state for infinite canvas
  const [viewBox, setViewBox] = useState({
    x: 0,
    y: 0,
    width: 1200,
    height: 800,
  });
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
      case 'ready':
        return '#4caf50';
      case 'initializing':
        return '#ffc107'; // Yellow for initializing
      case 'busy':
        return '#ff9800';
      case 'full':
        return '#f44336';
      case 'starting':
        return '#2196f3';
      case 'terminated':
        return '#9e9e9e';
      case 'error':
        return '#f44336';
      case 'no-response':
        return '#795548';
      default:
        return '#9e9e9e';
    }
  };

  // Create a stable service ID list to detect actual structure changes
  const serviceIds = useMemo(() => {
    return services
      .map((s) => `${s.labels.service}-${s.instanceId}`)
      .sort()
      .join(',');
  }, [services]);

  // Create a service map for quick lookup (for UI updates without simulation restart)
  const serviceMap = useMemo(() => {
    const map = new Map<string, ServiceInstance>();
    services.forEach((s) => {
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
      const centerNodes = nodesRef.current.filter((n) => n.isCenter);
      const serviceNodes = nodesRef.current.filter((n) => !n.isCenter);

      if (centerNodes.length === 1) {
        // Single center node - place at screen center
        const centerNode = centerNodes[0];
        centerNode.x = centerX;
        centerNode.y = centerY;
        centerNode.fx = centerX;
        centerNode.fy = centerY;

        // Reposition all service nodes around the center
        serviceNodes.forEach((node) => {
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
          const angle =
            (2 * Math.PI * index) / centerNodes.length - Math.PI / 2;
          const x = centerX + Math.cos(angle) * groupRadius;
          const y = centerY + Math.sin(angle) * groupRadius;
          node.x = x;
          node.y = y;
          node.fx = x;
          node.fy = y;
        });

        // Reposition service nodes around their respective center nodes
        serviceNodes.forEach((node) => {
          // Find the linked center node
          const linkedCenter = centerNodes.find(
            (c) => c.groupKey === node.groupKey
          );
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

    services.forEach((s) => {
      const nodeId = `${s.labels.service}-${s.instanceId}`;
      const prevStatus = prevStatusRef.current.get(nodeId);

      // If status changed (and not first render), trigger rumble
      if (prevStatus !== undefined && prevStatus !== s.status) {
        newRumbleNodes.add(nodeId);
      }

      prevStatusRef.current.set(nodeId, s.status);
    });

    if (newRumbleNodes.size > 0) {
      setRumbleNodes((prev) => new Set([...prev, ...newRumbleNodes]));

      // Increment rumble counter to force re-render of animate element
      setRumbleCounter((prev) => {
        const next = new Map(prev);
        newRumbleNodes.forEach((id) => next.set(id, (prev.get(id) || 0) + 1));
        return next;
      });

      // Clear rumble after animation
      setTimeout(() => {
        setRumbleNodes((prev) => {
          const next = new Set(prev);
          newRumbleNodes.forEach((id) => next.delete(id));
          return next;
        });
      }, 500);
    }
  }, [services]);

  // Detect heartbeat and trigger rumble animation
  useEffect(() => {
    const newHeartbeatNodes = new Set<string>();

    heartbeatIds.forEach((id) => {
      if (!prevHeartbeatRef.current.has(id)) {
        newHeartbeatNodes.add(id);
      }
    });

    if (newHeartbeatNodes.size > 0) {
      setHeartbeatAnimNodes((prev) => new Set([...prev, ...newHeartbeatNodes]));

      // Increment rumble counter to force re-render of animate element
      setRumbleCounter((prev) => {
        const next = new Map(prev);
        newHeartbeatNodes.forEach((id) =>
          next.set(id, (prev.get(id) || 0) + 1)
        );
        return next;
      });

      // Reset ping gauge: update lastHeartbeatTime for new heartbeats
      const now = Date.now();
      setLastHeartbeatTime((prev) => {
        const next = new Map(prev);
        newHeartbeatNodes.forEach((id) => next.set(id, now));
        return next;
      });

      // Clear animation after 600ms
      setTimeout(() => {
        setHeartbeatAnimNodes((prev) => {
          const next = new Set(prev);
          newHeartbeatNodes.forEach((id) => next.delete(id));
          return next;
        });
      }, 600);
    }

    prevHeartbeatRef.current = new Set(heartbeatIds);
  }, [heartbeatIds]);

  // Refs for stable interval access (avoids recreating interval on every heartbeat)
  const servicesRef = useRef(services);
  servicesRef.current = services;
  const lastHeartbeatTimeRef = useRef(lastHeartbeatTime);
  lastHeartbeatTimeRef.current = lastHeartbeatTime;

  // Update ping progress every 1000ms using refs to avoid interval recreation
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const currentServices = servicesRef.current;
      const currentLastHeartbeat = lastHeartbeatTimeRef.current;
      setPingProgress(() => {
        const next = new Map<string, number>();
        currentServices.forEach((service) => {
          const serviceKey = `${service.labels.service}-${service.instanceId}`;
          const lastTime = currentLastHeartbeat.get(serviceKey);
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
    }, 1000);

    return () => clearInterval(interval);
  }, []); // Empty deps - interval created once, reads from refs

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
      .force(
        'link',
        forceLink<ClusterNode, ClusterLink>(linksRef.current)
          .id((d) => d.id)
          .distance(100)
          .strength(0.5)
      )
      .force('charge', forceManyBody<ClusterNode>().strength(-100))
      .force(
        'collision',
        forceCollide<ClusterNode>()
          .radius((d) => d.radius + 8)
          .strength(0.8)
      )
      .alphaDecay(0.02) // Slower decay for smoother movement
      .velocityDecay(0.3)
      .on('tick', () => {
        // Throttle React state updates via requestAnimationFrame
        // D3 tick fires frequently; coalesce into a single frame update
        if (!rafPendingRef.current) {
          rafPendingRef.current = true;
          requestAnimationFrame(() => {
            rafPendingRef.current = false;
            setNodes([...nodesRef.current]);
            setLinks([...linksRef.current]);
          });
        }
      });

    simulationRef.current = simulation;

    return () => {
      simulation.stop();
      simulationRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper function to get group key from service based on grouping option
  const getGroupKey = useCallback(
    (service: ServiceInstance): string => {
      switch (groupingBy) {
        case 'service':
          return service.labels.service || 'unknown';
        case 'group':
          return service.labels.group || 'unknown';
        case 'environment':
          return (
            service.labels.environmentId ||
            service.labels.environment ||
            'unknown'
          );
        case 'cloudProvider':
          return service.labels.cloudProvider || 'unknown';
        case 'cloudRegion':
          return service.labels.cloudRegion || 'unknown';
        case 'cloudZone':
          return service.labels.cloudZone || 'unknown';
        default:
          return 'center';
      }
    },
    [groupingBy]
  );

  // Pre-compute center node instance counts (avoids O(N*M) filter inside render loop)
  const centerCounts = useMemo(() => {
    const counts = new Map<string, number>();
    counts.set('__all__', services.length);
    services.forEach((s) => {
      const key = getGroupKey(s);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [services, getGroupKey]);

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
      nodesRef.current.forEach((n) => existingNodeMap.set(n.id, n));
    } else {
      // Only keep service nodes when grouping changes, recreate center nodes
      nodesRef.current
        .filter((n) => !n.isCenter)
        .forEach((n) => existingNodeMap.set(n.id, n));
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
      services.forEach((s) => groupKeys.add(getGroupKey(s)));

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
      const targetCenterId =
        groupingBy === 'none' ? 'center' : `center-${groupKey}`;
      const targetCenter = centerNodes.find((c) => c.id === targetCenterId);

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
      setRumbleNodes((prev) => new Set([...prev, ...newNodeIds]));
      setTimeout(() => {
        setRumbleNodes((prev) => {
          const next = new Set(prev);
          newNodeIds.forEach((id) => next.delete(id));
          return next;
        });
      }, 500);
    }

    const allNodes = [...centerNodes, ...serviceNodes];
    nodesRef.current = allNodes;

    // Create links - each service links to its group center
    const newLinks: ClusterLink[] = serviceNodes.map((node) => {
      const groupKey = getGroupKey(node.service!);
      const targetCenterId =
        groupingBy === 'none' ? 'center' : `center-${groupKey}`;
      return {
        source: targetCenterId,
        target: node.id,
      };
    });
    linksRef.current = newLinks;

    // Update simulation with new nodes/links (don't recreate)
    const simulation = simulationRef.current;
    simulation.nodes(allNodes);
    (simulation.force('link') as ForceLink<ClusterNode, ClusterLink>)?.links(
      newLinks
    );

    // Force re-render to show new state immediately
    setNodes([...allNodes]);
    setLinks([...newLinks]);

    // Restart simulation - stronger restart when grouping changes
    const hasChanges =
      newNodeIds.length > 0 ||
      allNodes.length !== existingNodeMap.size ||
      groupingChanged;
    if (hasChanges) {
      simulation.alpha(groupingChanged ? 0.8 : 0.3).restart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceIds, getSavedCenterPosition, groupingBy, getGroupKey]);

  // Convert mouse position to SVG coordinates
  const mouseToSvgCoords = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      if (!svgRef.current) return { x: 0, y: 0 };

      const svg = svgRef.current;
      const rect = svg.getBoundingClientRect();

      // Scale mouse position to SVG viewBox coordinates
      const scaleX = viewBox.width / rect.width;
      const scaleY = viewBox.height / rect.height;
      const x = viewBox.x + (e.clientX - rect.left) * scaleX;
      const y = viewBox.y + (e.clientY - rect.top) * scaleY;

      return { x, y };
    },
    [viewBox]
  );

  // Handle drag start for nodes
  const handleMouseDown = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDraggedNode(nodeId);

      const node = nodesRef.current.find((n) => n.id === nodeId);
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
    },
    [mouseToSvgCoords]
  );

  // Handle pan start (right-click or ctrl+click or empty space click)
  const handlePanStart = useCallback(
    (e: React.MouseEvent) => {
      // Only start panning if not dragging a node
      if (draggedNode) return;

      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        viewBoxX: viewBox.x,
        viewBoxY: viewBox.y,
      };
    },
    [draggedNode, viewBox]
  );

  // Handle mouse move for both dragging and panning
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!svgRef.current) return;

      if (draggedNode) {
        // Dragging a node - apply offset to keep node at same relative position to cursor
        const { x, y } = mouseToSvgCoords(e);
        const node = nodesRef.current.find((n) => n.id === draggedNode);
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

        setViewBox((prev) => ({
          ...prev,
          x: panStartRef.current.viewBoxX - dx,
          y: panStartRef.current.viewBoxY - dy,
        }));
      }
    },
    [draggedNode, isPanning, mouseToSvgCoords, viewBox.width, viewBox.height]
  );

  // Handle mouse up - global listener for proper capture
  const handleMouseUp = useCallback(() => {
    if (draggedNode && simulationRef.current) {
      const node = nodesRef.current.find((n) => n.id === draggedNode);
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
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();

      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
      const { x: mouseX, y: mouseY } = mouseToSvgCoords(e);

      setViewBox((prev) => {
        const newWidth = Math.max(400, Math.min(4000, prev.width * zoomFactor));
        const newHeight = Math.max(
          300,
          Math.min(3000, prev.height * zoomFactor)
        );

        // Zoom toward mouse position
        const widthRatio = newWidth / prev.width;
        const heightRatio = newHeight / prev.height;

        const newX = mouseX - (mouseX - prev.x) * widthRatio;
        const newY = mouseY - (mouseY - prev.y) * heightRatio;

        return { x: newX, y: newY, width: newWidth, height: newHeight };
      });
    },
    [mouseToSvgCoords]
  );

  // Get link positions
  const getNodeById = useCallback(
    (id: string | ClusterNode): ClusterNode | undefined => {
      if (typeof id === 'object') return id;
      return nodes.find((n) => n.id === id);
    },
    [nodes]
  );

  return (
    <Card
      ref={containerRef}
      sx={{
        p: 2,
        overflow: 'hidden',
        width: '100%',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {services.length === 0 ? (
        <EmptyPagePlaceholder message={t('serverList.noData')} />
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
              cursor: isPanning
                ? 'grabbing'
                : draggedNode
                  ? 'grabbing'
                  : 'grab',
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
                cursor: draggedNode
                  ? 'grabbing'
                  : isPanning
                    ? 'grabbing'
                    : 'grab',
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
                <linearGradient
                  id="pulseGradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="#90a4ae">
                    <animate
                      attributeName="stop-color"
                      values="#90a4ae;#ff9800;#90a4ae"
                      dur="1s"
                      repeatCount="indefinite"
                    />
                  </stop>
                  <stop offset="50%" stopColor="#ff9800">
                    <animate
                      attributeName="stop-color"
                      values="#ff9800;#ffb74d;#ff9800"
                      dur="1s"
                      repeatCount="indefinite"
                    />
                  </stop>
                  <stop offset="100%" stopColor="#90a4ae">
                    <animate
                      attributeName="stop-color"
                      values="#90a4ae;#ff9800;#90a4ae"
                      dur="1s"
                      repeatCount="indefinite"
                    />
                  </stop>
                </linearGradient>

                {/* Heartbeat border glow filter */}
                <filter
                  id="heartbeatGlow"
                  x="-50%"
                  y="-50%"
                  width="200%"
                  height="200%"
                >
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Links - with viewport culling */}
              {links.map((link, idx) => {
                const source = getNodeById(link.source);
                const target = getNodeById(link.target);
                if (!source || !target) return null;

                // Viewport culling: skip links where both endpoints are outside visible area
                const sx = source.x || 0;
                const sy = source.y || 0;
                const tx = target.x || 0;
                const ty = target.y || 0;
                const margin = 50;
                const bothOutside =
                  (sx < viewBox.x - margin && tx < viewBox.x - margin) ||
                  (sx > viewBox.x + viewBox.width + margin &&
                    tx > viewBox.x + viewBox.width + margin) ||
                  (sy < viewBox.y - margin && ty < viewBox.y - margin) ||
                  (sy > viewBox.y + viewBox.height + margin &&
                    ty > viewBox.y + viewBox.height + margin);
                if (bothOutside) return null;

                // Check if this link's target node has heartbeat
                const targetId =
                  typeof link.target === 'string'
                    ? link.target
                    : link.target.id;
                const hasHeartbeat = heartbeatIds.has(targetId);

                return (
                  <g key={`link-${idx}`}>
                    {/* Base line */}
                    <line
                      x1={sx}
                      y1={sy}
                      x2={tx}
                      y2={ty}
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
              {nodes.map((node) => {
                // Viewport culling: skip nodes outside visible area (with generous margin)
                const nx = node.x || 0;
                const ny = node.y || 0;
                const margin = 100; // generous margin for animations/labels
                if (
                  nx < viewBox.x - margin ||
                  nx > viewBox.x + viewBox.width + margin ||
                  ny < viewBox.y - margin ||
                  ny > viewBox.y + viewBox.height + margin
                ) {
                  return null;
                }

                if (node.isCenter) {
                  // Center cluster node - draggable
                  const centerCount =
                    centerCounts.get(node.groupKey ?? '__all__') ??
                    services.length;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x || 0}, ${node.y || 0})`}
                      style={{ cursor: 'grab' }}
                      onMouseDown={(e) => handleMouseDown(node.id, e)}
                    >
                      <defs>
                        <linearGradient
                          id={`centerGradient-${node.id}`}
                          x1="0%"
                          y1="0%"
                          x2="100%"
                          y2="100%"
                        >
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
                            {node.groupKey === 'unknown'
                              ? '---'
                              : node.groupKey.toUpperCase()}
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
                // When progress is 0 (or very small), make it transparent
                const pingGaugeColor =
                  progress < 0.01
                    ? 'transparent'
                    : progress >= 1
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
                    onContextMenu={(e) => {
                      if (onContextMenu && service) {
                        e.preventDefault();
                        onContextMenu(
                          e as unknown as React.MouseEvent,
                          service
                        );
                      }
                    }}
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
                    {(service.status === 'ready' ||
                      service.status === 'initializing') && (
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
                      {(service.labels.service || '')
                        .substring(0, 7)
                        .toUpperCase()}
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
export default ClusterView;
