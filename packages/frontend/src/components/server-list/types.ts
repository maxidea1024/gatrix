import { ServiceInstance } from '../../../services/serviceDiscoveryService';

// Service status type
export type ServiceStatus =
  | 'initializing'
  | 'ready'
  | 'shutting_down'
  | 'terminated'
  | 'error'
  | 'no_response'
  | 'noResponse'
  | 'shuttingDown';

// View mode type
export type ViewMode = 'list' | 'grid' | 'card' | 'cluster' | 'checkerboard';

// Grouping field type for multi-level grouping
export type GroupingField =
  | 'service'
  | 'group'
  | 'environment'
  | 'cloudProvider'
  | 'cloudRegion'
  | 'cloudZone';

// Grouping option type (includes 'none' for single-level compatibility)
export type GroupingOption = 'none' | GroupingField;

// Multi-level hierarchical group structure
export interface ServerGroup {
  id: string;
  name: string;
  level: number;
  fieldName: GroupingField;
  instances: ServiceInstance[];
  children?: ServerGroup[];
}

// Build hierarchical groups from services based on grouping levels
export const buildServerGroups = (
  items: ServiceInstance[],
  levels: GroupingField[],
  getLabel: (field: GroupingField) => string,
  currentLevel: number = 0
): ServerGroup[] => {
  if (levels.length === 0 || currentLevel >= levels.length) {
    return [];
  }

  const currentField = levels[currentLevel];
  const nextLevel = currentLevel + 1;
  const hasMoreLevels = nextLevel < levels.length;

  const groupMap = new Map<string, ServiceInstance[]>();

  items.forEach((service) => {
    const value = service.labels[currentField] || 'Unknown';
    if (!groupMap.has(value)) {
      groupMap.set(value, []);
    }
    groupMap.get(value)?.push(service);
  });

  return Array.from(groupMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, instances]) => {
      const group: ServerGroup = {
        id: levels.slice(0, currentLevel + 1).join('-') + '-' + name,
        name: name === 'Unknown' ? `(${getLabel(currentField)} N/A)` : name,
        level: currentLevel,
        fieldName: currentField,
        instances: hasMoreLevels
          ? []
          : instances.sort((a, b) => a.instanceId.localeCompare(b.instanceId)),
        children: hasMoreLevels
          ? buildServerGroups(instances, levels, getLabel, nextLevel)
          : undefined,
      };
      return group;
    });
};

// Helper to collect all instances from a group (including nested children)
export const collectAllInstances = (group: ServerGroup): ServiceInstance[] => {
  if (group.children && group.children.length > 0) {
    return group.children.flatMap(collectAllInstances);
  }
  return group.instances;
};

// Column configuration for list view
export interface ColumnConfig {
  id: string;
  labelKey: string;
  visible: boolean;
}

// Common props for all view components
export interface ServerViewBaseProps {
  services: ServiceInstance[];
  updatedServiceIds: Map<string, ServiceStatus>;
  heartbeatIds: Set<string>;
  newServiceIds: Set<string>;
  groupingLevels: GroupingField[];
  getGroupingLabel: (field: GroupingField) => string;
  t: (key: string) => string;
  onContextMenu: (event: React.MouseEvent, service: ServiceInstance) => void;
}
