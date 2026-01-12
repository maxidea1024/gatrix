import React from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Chip,
    alpha,
} from '@mui/material';
import { ServiceInstance } from '../../services/serviceDiscoveryService';
import { GroupingField } from './types';

type ServiceStatus = 'initializing' | 'ready' | 'shutting_down' | 'terminated' | 'error' | 'no_response' | 'noResponse' | 'shuttingDown';

interface GroupedCardViewProps {
    services: ServiceInstance[];
    groupingLevels: GroupingField[];
    getGroupingLabel: (field: GroupingField) => string;
    t: (key: string) => string;
    updatedServiceIds: Map<string, ServiceStatus>;
    newServiceIds: Set<string>;
    onContextMenu: (event: React.MouseEvent, service: ServiceInstance) => void;
    renderServiceCard: (service: ServiceInstance) => React.ReactNode;
}

interface CardViewGroup {
    id: string;
    name: string;
    level: number;
    fieldName: GroupingField;
    instances: ServiceInstance[];
    children?: CardViewGroup[];
}

export const GroupedCardView: React.FC<GroupedCardViewProps> = ({
    services,
    groupingLevels,
    getGroupingLabel,
    t,
    updatedServiceIds,
    newServiceIds,
    onContextMenu,
    renderServiceCard,
}) => {
    // Build multi-level groups recursively
    const buildGroups = (items: ServiceInstance[], levels: GroupingField[], currentLevel: number = 0): CardViewGroup[] => {
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
    const collectInstances = (group: CardViewGroup): ServiceInstance[] => {
        if (group.children && group.children.length > 0) return group.children.flatMap(collectInstances);
        return group.instances;
    };

    // Render group recursively
    const renderGroup = (group: CardViewGroup): React.ReactNode => {
        const allInstances = collectInstances(group);
        const hasChildren = group.children && group.children.length > 0;

        return (
            <Box key={group.id} sx={{ mb: group.level === 0 ? 3 : 2, ml: group.level * 2 }}>
                {/* Group Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, gap: 1.5, pb: 1, borderBottom: 1, borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', alignItems: 'stretch', height: 28, borderRadius: 1, border: 1, borderColor: 'divider', overflow: 'hidden' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', px: 1, fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary', bgcolor: 'action.hover', textTransform: 'uppercase' }}>
                            {getGroupingLabel(group.fieldName)}
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, fontSize: '0.85rem', fontWeight: 700, color: (theme) => theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[100], bgcolor: (theme) => theme.palette.mode === 'dark' ? theme.palette.grey[200] : theme.palette.grey[700] }}>
                            {group.name}
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 28, px: 1, fontSize: '0.8rem', fontWeight: 700, color: 'primary.contrastText', bgcolor: 'primary.main' }}>
                            {allInstances.length}
                        </Box>
                    </Box>
                </Box>

                {/* Render children or cards */}
                {hasChildren ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {group.children!.map(child => renderGroup(child))}
                    </Box>
                ) : (
                    <Box sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 1.5,
                        '@media (max-width: 1200px)': { gridTemplateColumns: 'repeat(2, 1fr)' },
                        '@media (max-width: 768px)': { gridTemplateColumns: '1fr' },
                    }}>
                        {group.instances.map(service => renderServiceCard(service))}
                    </Box>
                )}
            </Box>
        );
    };

    const groups = groupingLevels.length > 0 ? buildGroups(services, groupingLevels) : [];

    // No grouping - render flat grid
    if (groupingLevels.length === 0) {
        return (
            <Box sx={{
                flex: 1,
                minHeight: 0,
                overflow: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 1.5,
                '@media (max-width: 1200px)': { gridTemplateColumns: 'repeat(2, 1fr)' },
                '@media (max-width: 768px)': { gridTemplateColumns: '1fr' },
            }}>
                {services.length === 0 ? (
                    <Card sx={{ gridColumn: '1 / -1' }}>
                        <CardContent sx={{ py: 4, textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                                {t('serverList.noData')}
                            </Typography>
                        </CardContent>
                    </Card>
                ) : (
                    services.map(service => renderServiceCard(service))
                )}
            </Box>
        );
    }

    // With grouping - render grouped cards
    return (
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {groups.map(group => renderGroup(group))}
        </Box>
    );
};

export default GroupedCardView;
