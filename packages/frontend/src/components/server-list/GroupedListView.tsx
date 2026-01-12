import React from 'react';
import {
    Box,
    Card,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TableSortLabel,
    Typography,
    Chip,
    IconButton,
    Tooltip,
    alpha,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { ServiceInstance } from '../../services/serviceDiscoveryService';
import { GroupingField, ColumnConfig } from './types';

// Service status type
type ServiceStatus = 'initializing' | 'ready' | 'shutting_down' | 'terminated' | 'error' | 'no_response' | 'noResponse' | 'shuttingDown';

interface GroupedListViewProps {
    services: ServiceInstance[];
    columns: ColumnConfig[];
    groupingLevels: GroupingField[];
    getGroupingLabel: (field: GroupingField) => string;
    t: (key: string) => string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    onSort: (columnId: string) => void;
    updatedServiceIds: Map<string, ServiceStatus>;
    newServiceIds: Set<string>;
    onContextMenu: (event: React.MouseEvent, service: ServiceInstance) => void;
    onHealthCheck?: (service: ServiceInstance) => void;
    healthCheckResults?: Map<string, { loading: boolean; success?: boolean; latency?: number; error?: string }>;
    renderServiceRow: (service: ServiceInstance, depth: number) => React.ReactNode;
}

// Multi-level group structure
interface ListViewGroup {
    id: string;
    name: string;
    level: number;
    fieldName: GroupingField;
    instances: ServiceInstance[];
    children?: ListViewGroup[];
}

export const GroupedListView: React.FC<GroupedListViewProps> = ({
    services,
    columns,
    groupingLevels,
    getGroupingLabel,
    t,
    sortBy,
    sortOrder,
    onSort,
    updatedServiceIds,
    newServiceIds,
    onContextMenu,
    renderServiceRow,
}) => {
    const visibleColumns = columns.filter(col => col.visible);

    // Build multi-level groups recursively
    const buildGroups = (items: ServiceInstance[], levels: GroupingField[], currentLevel: number = 0): ListViewGroup[] => {
        if (levels.length === 0 || currentLevel >= levels.length) return [];
        const currentField = levels[currentLevel];
        const hasMoreLevels = currentLevel + 1 < levels.length;
        const groupMap = new Map<string, ServiceInstance[]>();
        items.forEach(service => {
            const value = service.labels[currentField] || 'Unknown';
            if (!groupMap.has(value)) groupMap.set(value, []);
            groupMap.get(value)!.push(service);
        });
        return Array.from(groupMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, instances]) => ({
                id: levels.slice(0, currentLevel + 1).join('-') + '-' + name,
                name: name === 'Unknown' ? `(${getGroupingLabel(currentField)} N/A)` : name,
                level: currentLevel,
                fieldName: currentField,
                instances: hasMoreLevels ? [] : instances,
                children: hasMoreLevels ? buildGroups(instances, levels, currentLevel + 1) : undefined,
            }));
    };

    // Collect all instances from group recursively
    const collectInstances = (group: ListViewGroup): ServiceInstance[] => {
        if (group.children && group.children.length > 0) return group.children.flatMap(collectInstances);
        return group.instances;
    };

    // Render group rows recursively
    const renderGroupRows = (group: ListViewGroup): React.ReactNode[] => {
        const allInstances = collectInstances(group);
        const rows: React.ReactNode[] = [];

        // Group header row
        rows.push(
            <TableRow key={`group-${group.id}`} sx={{ bgcolor: (theme) => alpha(theme.palette.action.hover, 0.5 + group.level * 0.15) }}>
                <TableCell colSpan={visibleColumns.length} sx={{ py: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pl: group.level * 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'stretch', height: 24, borderRadius: 1, border: 1, borderColor: 'divider', overflow: 'hidden' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', px: 0.75, fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', bgcolor: 'background.paper', textTransform: 'uppercase' }}>
                                {getGroupingLabel(group.fieldName)}
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', px: 1, fontSize: '0.8rem', fontWeight: 700, color: (theme) => theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[100], bgcolor: (theme) => theme.palette.mode === 'dark' ? theme.palette.grey[200] : theme.palette.grey[700] }}>
                                {group.name}
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 24, px: 0.75, fontSize: '0.75rem', fontWeight: 700, color: 'primary.contrastText', bgcolor: 'primary.main' }}>
                                {allInstances.length}
                            </Box>
                        </Box>
                    </Box>
                </TableCell>
            </TableRow>
        );

        // Render children or service rows
        if (group.children && group.children.length > 0) {
            group.children.forEach(child => rows.push(...renderGroupRows(child)));
        } else {
            group.instances.forEach((service) => {
                rows.push(renderServiceRow(service, group.level + 1));
            });
        }

        return rows;
    };

    const groups = groupingLevels.length > 0 ? buildGroups(services, groupingLevels) : [];

    return (
        <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
                <Table>
                    <TableHead>
                        <TableRow>
                            {visibleColumns.map((column) => (
                                <TableCell key={column.id} align={column.id === 'actions' ? 'center' : 'left'}>
                                    {column.id !== 'ports' && column.id !== 'stats' && column.id !== 'meta' && column.id !== 'labels' && column.id !== 'actions' ? (
                                        <TableSortLabel
                                            active={sortBy === column.id}
                                            direction={sortBy === column.id ? sortOrder : 'asc'}
                                            onClick={() => onSort(column.id)}
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
                        {services.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={visibleColumns.length} align="center">
                                    <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                                        {t('serverList.noData')}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : groupingLevels.length > 0 ? (
                            // Grouped view
                            groups.flatMap(group => renderGroupRows(group))
                        ) : (
                            // Ungrouped view - render all services directly
                            services.map((service) => renderServiceRow(service, 0))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Card>
    );
};

export default GroupedListView;
