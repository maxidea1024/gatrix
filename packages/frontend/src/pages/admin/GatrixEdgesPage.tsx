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
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import Editor from '@monaco-editor/react';
import serviceDiscoveryService, { ServiceInstance } from '../../services/serviceDiscoveryService';
import { RelativeTime } from '../../components/common/RelativeTime';
import { copyToClipboardWithNotification } from '../../utils/clipboard';

// Grouping options
type GroupingField = 'group' | 'environment' | 'service' | 'cloudProvider' | 'cloudRegion';

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
    summary?: Record<string, Record<string, number>>;
    detail?: Record<string, any>;
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

    // Grouping - support multiple levels
    const [groupingLevels, setGroupingLevels] = useState<GroupingField[]>(['group']);

    // Cache status per instance
    const [cacheStatuses, setCacheStatuses] = useState<Map<string, CacheStatus>>(new Map());
    const cachePollingRef = useRef<NodeJS.Timeout | null>(null);

    // JSON Dialog
    const [jsonDialogOpen, setJsonDialogOpen] = useState(false);
    const [jsonDialogData, setJsonDialogData] = useState<any>(null);
    const [jsonDialogTitle, setJsonDialogTitle] = useState('');

    // Localized grouping options
    const getGroupingLabel = (field: GroupingField) => {
        const labels: Record<GroupingField, string> = {
            group: t('gatrixEdges.group'),
            environment: t('gatrixEdges.environment'),
            service: t('gatrixEdges.service'),
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

            const edgeServices = allServices.filter(s => s.labels.service === 'gatrix-edge' || s.labels.service === 'edge');

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
    const groupServicesMultiLevel = useCallback((services: ServiceInstance[], levels: GroupingField[]) => {
        if (levels.length === 0) {
            const flatGroup: EdgeGroup = {
                id: 'all',
                name: 'All Instances',
                instances: services.sort((a, b) => a.instanceId.localeCompare(b.instanceId)),
            };
            setGroups([flatGroup]);
            setExpandedGroups(new Set(['all']));
            return;
        }

        const buildGroups = (items: ServiceInstance[], remainingLevels: GroupingField[]): EdgeGroup[] => {
            if (remainingLevels.length === 0) {
                return [];
            }

            const currentLevel = remainingLevels[0];
            const nextLevels = remainingLevels.slice(1);

            const groupMap = new Map<string, ServiceInstance[]>();

            items.forEach(service => {
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
                        id: `${currentLevel}-${name}`,
                        name: name === 'unknown' ? `(${getGroupingLabel(currentLevel)} N/A)` : name,
                        instances: nextLevels.length === 0 ? instances.sort((a, b) => a.instanceId.localeCompare(b.instanceId)) : [],
                        children: nextLevels.length > 0 ? buildGroups(instances, nextLevels) : undefined,
                    };
                    return group;
                });
        };

        const newGroups = buildGroups(services, levels);
        setGroups(newGroups);

        const allGroupIds = new Set<string>();
        const collectIds = (groups: EdgeGroup[]) => {
            groups.forEach(g => {
                allGroupIds.add(g.id);
                if (g.children) collectIds(g.children);
            });
        };
        collectIds(newGroups);
        setExpandedGroups(allGroupIds);
    }, [t]);

    // Fetch cache status for an instance
    const fetchCacheStatus = useCallback(async (instance: ServiceInstance) => {
        const key = instance.instanceId;
        setCacheStatuses(prev => {
            const next = new Map(prev);
            const current = next.get(key) || { status: 'loading' };
            next.set(key, { ...current, loading: true });
            return next;
        });

        try {
            const serviceType = instance.labels.service;
            const result = await serviceDiscoveryService.getCacheStatus(serviceType, instance.instanceId);
            setCacheStatuses(prev => {
                const next = new Map(prev);
                next.set(key, { ...result, loading: false });
                return next;
            });
        } catch (err: any) {
            setCacheStatuses(prev => {
                const next = new Map(prev);
                const current = next.get(key) || { status: 'error' };
                next.set(key, { ...current, status: 'error', error: err.message, loading: false });
                return next;
            });
        }
    }, []);

    // Poll cache status for expanded instances
    useEffect(() => {
        if (cachePollingRef.current) {
            clearInterval(cachePollingRef.current);
        }

        const pollCacheStatuses = () => {
            expandedInstances.forEach(instanceId => {
                const instance = services.find(s => s.instanceId === instanceId);
                if (instance) {
                    fetchCacheStatus(instance);
                }
            });
        };

        if (expandedInstances.size > 0) {
            pollCacheStatuses();
            cachePollingRef.current = setInterval(pollCacheStatuses, 30000);
        }

        return () => {
            if (cachePollingRef.current) {
                clearInterval(cachePollingRef.current);
            }
        };
    }, [expandedInstances, services, fetchCacheStatus]);

    useEffect(() => {
        fetchServices();
    }, []);

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
        const available = (['group', 'environment', 'service', 'cloudProvider', 'cloudRegion'] as GroupingField[]).find(o => !usedLevels.has(o));
        if (available) {
            setGroupingLevels([...groupingLevels, available]);
        }
    };

    const openJsonDialog = (data: any, title: string) => {
        setJsonDialogData(data);
        setJsonDialogTitle(title);
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
    const renderCacheSummary = (cacheStatus: CacheStatus | undefined) => {
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
            Object.values(summary).forEach(envCounts => {
                Object.keys(envCounts as Record<string, number>).forEach(env => allEnvs.add(env));
            });
        }
        const sortedEnvs = Array.from(allEnvs).sort();

        return (
            <Box sx={{ position: 'relative' }}>
                {loading && (
                    <LinearProgress
                        sx={{
                            position: 'absolute',
                            top: -12,
                            left: -4,
                            right: -4,
                            height: 2,
                            borderRadius: 1
                        }}
                    />
                )}

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                    <Typography variant="subtitle2" fontWeight="bold">
                        {t('gatrixEdges.cacheStatus')}
                    </Typography>
                    <Stack direction="row" spacing={0.5}>
                        {latency !== undefined && (
                            <Chip label={`${latency}ms`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                        )}
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<CodeIcon sx={{ fontSize: 14 }} />}
                            onClick={() => openJsonDialog(cacheStatus, t('gatrixEdges.cacheStatus'))}
                            sx={{ height: 20, fontSize: '0.65rem', px: 1 }}
                        >
                            {t('gatrixEdges.viewJson')}
                        </Button>
                    </Stack>
                </Box>

                {error && (
                    <Alert severity="error" sx={{ py: 0.2, px: 1, mb: 1, '& .MuiAlert-message': { fontSize: '0.75rem' } }}>
                        {error}
                    </Alert>
                )}

                {lastRefreshedAt && (
                    <Box sx={{ mb: 1.5, p: 1, bgcolor: theme.palette.primary.main + '10', borderRadius: 1, border: `1px solid ${theme.palette.primary.main}30` }}>
                        <Typography variant="caption" color="primary" sx={{ display: 'block', fontWeight: 'bold' }}>
                            {t('gatrixEdges.lastRefreshed')}: <RelativeTime date={lastRefreshedAt} />
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>
                            ({new Date(lastRefreshedAt).toLocaleString()})
                        </Typography>
                    </Box>
                )}

                {summary && Object.keys(summary).length > 0 ? (
                    <Box sx={{
                        width: '100%',
                        overflowX: 'auto',
                        mt: 1,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 1,
                        bgcolor: theme.palette.background.paper
                    }}>
                        <Table size="small" sx={{
                            minWidth: 400,
                            '& th': { fontWeight: 'bold', bgcolor: theme.palette.action.selected, py: 1, fontSize: '0.75rem' }
                        }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Entity</TableCell>
                                    {sortedEnvs.map(env => (
                                        <TableCell key={env} align="center">{env}</TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {Object.entries(summary).map(([category, envCounts]) => (
                                    <TableRow key={category} sx={{
                                        '& td': { py: 0.75, fontSize: '0.75rem' },
                                        '&:nth-of-type(odd)': { bgcolor: theme.palette.action.hover }
                                    }}>
                                        <TableCell sx={{ color: 'text.secondary', textTransform: 'capitalize', fontWeight: 'bold' }}>
                                            {category}
                                        </TableCell>
                                        {sortedEnvs.map(env => (
                                            <TableCell key={env} align="center">
                                                {(envCounts as Record<string, number>)[env] ?? 0}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Box>
                ) : !loading && !error && (
                    <Typography variant="body2" color="text.secondary">
                        {t('gatrixEdges.noCacheData')}
                    </Typography>
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
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                        {t('gatrixEdges.basicInfo')}
                    </Typography>
                    <IconButton size="small" onClick={() => openJsonDialog(instance, t('gatrixEdges.basicInfo'))}>
                        <CodeIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                </Box>
                <Table size="small" sx={{ mb: 2 }}>
                    <TableBody>
                        <TableRow sx={{ '& td': { border: 0, py: 0.5 } }}>
                            <TableCell sx={{ pl: 0, width: '40%', color: 'text.secondary' }}>{t('gatrixEdges.instanceId')}</TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{instance.instanceId}</TableCell>
                        </TableRow>
                        <TableRow sx={{ '& td': { border: 0, py: 0.5 } }}>
                            <TableCell sx={{ pl: 0, color: 'text.secondary' }}>{t('gatrixEdges.hostname')}</TableCell>
                            <TableCell>{instance.hostname}</TableCell>
                        </TableRow>
                        {/* New version fields */}
                        {labels?.appVersion && (
                            <TableRow sx={{ '& td': { border: 0, py: 0.5 } }}>
                                <TableCell sx={{ pl: 0, color: 'text.secondary' }}>{t('gatrixEdges.appVersion')}</TableCell>
                                <TableCell><Chip label={labels.appVersion} size="small" sx={{ height: 20, fontSize: '0.75rem' }} /></TableCell>
                            </TableRow>
                        )}
                        {labels?.sdkVersion && (
                            <TableRow sx={{ '& td': { border: 0, py: 0.5 } }}>
                                <TableCell sx={{ pl: 0, color: 'text.secondary' }}>{t('gatrixEdges.sdkVersion')}</TableCell>
                                <TableCell><Chip label={labels.sdkVersion} size="small" sx={{ height: 20, fontSize: '0.75rem' }} /></TableCell>
                            </TableRow>
                        )}
                        <TableRow sx={{ '& td': { border: 0, py: 0.5 } }}>
                            <TableCell sx={{ pl: 0, color: 'text.secondary' }}>{t('gatrixEdges.externalAddress')}</TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{externalAddress}</TableCell>
                        </TableRow>
                        <TableRow sx={{ '& td': { border: 0, py: 0.5 } }}>
                            <TableCell sx={{ pl: 0, color: 'text.secondary' }}>{t('gatrixEdges.internalAddress')}</TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{internalAddress}</TableCell>
                        </TableRow>
                        <TableRow sx={{ '& td': { border: 0, py: 0.5 } }}>
                            <TableCell sx={{ pl: 0, color: 'text.secondary' }}>{t('gatrixEdges.created')}</TableCell>
                            <TableCell><RelativeTime date={createdAt} /></TableCell>
                        </TableRow>
                        <TableRow sx={{ '& td': { border: 0, py: 0.5 } }}>
                            <TableCell sx={{ pl: 0, color: 'text.secondary' }}>{t('gatrixEdges.lastUpdated')}</TableCell>
                            <TableCell><RelativeTime date={updatedAt} /></TableCell>
                        </TableRow>
                    </TableBody>
                </Table>

                {/* Ports */}
                {ports && Object.keys(ports).length > 0 && (
                    <>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', color: 'text.secondary' }}>
                            {t('gatrixEdges.ports')}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                            {Object.entries(ports).map(([name, port]) => (
                                <Chip
                                    key={name}
                                    label={`${name}: ${port}`}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontFamily: 'monospace', fontSize: '0.75rem', borderRadius: 1 }}
                                />
                            ))}
                        </Box>
                    </>
                )}

                {/* Labels */}
                {labels && Object.keys(labels).length > 0 && (
                    <>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', color: 'text.secondary' }}>
                            {t('gatrixEdges.labels')}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                            {Object.entries(labels)
                                .filter(([k, v]) => v && k !== 'appVersion' && k !== 'sdkVersion')
                                .map(([key, value]) => (
                                    <Chip
                                        key={key}
                                        label={`${key}: ${value}`}
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

                {/* Cache Status Section - Moved below Basic Info */}
                <Box sx={{ p: 1.5, bgcolor: theme.palette.background.paper, borderRadius: 1, border: `1px solid ${theme.palette.divider}` }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <CachedIcon fontSize="small" color="primary" />
                        <Typography variant="subtitle2" fontWeight="bold">
                            {t('gatrixEdges.cachingInfo')}
                        </Typography>
                        <Box sx={{ flexGrow: 1 }} />
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                fetchCacheStatus(instance);
                            }}
                            disabled={cacheStatus?.loading}
                            sx={{ p: 0.5 }}
                        >
                            <RefreshIcon fontSize="small" />
                        </IconButton>
                    </Box>
                    {renderCacheSummary(cacheStatus)}
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
                }
            }}
        >
            <Box
                sx={{
                    p: 1.25,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                }}
                onClick={() => toggleInstance(instance.instanceId)}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <CircleIcon sx={{ fontSize: 12, color: getStatusColor(instance.status) }} />
                    <Box>
                        <Typography variant="body2" fontWeight="bold">
                            {instance.hostname}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" title={instance.instanceId}>
                            ID: {instance.instanceId.substring(0, 8)}...
                        </Typography>
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {instance.status === 'ready' ? (
                        <Chip label={t('gatrixEdges.connected')} size="small" color="success" sx={{ height: 20, fontSize: '0.65rem' }} />
                    ) : (
                        <Chip label={instance.status} size="small" sx={{ height: 20, fontSize: '0.65rem' }} />
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
            <Box key={group.id} sx={{ ml: depth > 0 ? 3 : 0, mt: depth > 0 ? 1 : 0, position: 'relative' }}>
                {depth > 0 && (
                    <Box sx={{
                        position: 'absolute',
                        left: -12,
                        top: -8,
                        bottom: '50%',
                        width: 2,
                        bgcolor: theme.palette.divider
                    }} />
                )}
                {depth > 0 && (
                    <Box sx={{
                        position: 'absolute',
                        left: -12,
                        top: '50%',
                        width: 12,
                        height: 2,
                        bgcolor: theme.palette.divider
                    }} />
                )}

                <Card
                    sx={{
                        mb: 1,
                        border: `1px solid ${theme.palette.divider}`,
                        boxShadow: depth === 0 ? theme.shadows[1] : 'none'
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
                            }
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
                                    label={`${group.children!.length} ${t('gatrixEdges.subgroups')}`}
                                    size="small"
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: '0.7rem' }}
                                />
                            )}
                            {hasInstances && (
                                <Chip
                                    label={`${group.instances.length} ${t('gatrixEdges.instances')}`}
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
                            {hasChildren && group.children!.map(child => renderGroup(child, depth + 1))}

                            {/* Instances */}
                            {hasInstances && (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    {group.instances.map(renderInstanceCard)}
                                </Box>
                            )}

                            {!hasChildren && !hasInstances && (
                                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                                    {t('gatrixEdges.noInstances')}
                                </Typography>
                            )}
                        </CardContent>
                    </Collapse>
                </Card>
            </Box>
        );
    };

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                <Box>
                    <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 'bold' }}>
                        <HubIcon />
                        {t('gatrixEdges.title')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t('gatrixEdges.subtitle')}
                    </Typography>
                </Box>
                <Button
                    startIcon={isRefreshing ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                    variant="contained"
                    onClick={() => fetchServices(true)}
                    disabled={initialLoading || isRefreshing}
                >
                    {t('common.refresh')}
                </Button>
            </Box>

            {/* Grouping Controls */}
            <Card sx={{ mb: 3 }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 'bold' }}>
                        {t('gatrixEdges.groupBy')}
                    </Typography>
                    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
                        {groupingLevels.map((level, index) => (
                            <FormControl key={index} size="small" sx={{ minWidth: 140 }}>
                                <InputLabel>{t('gatrixEdges.groupingLevel')} {index + 1}</InputLabel>
                                <Select
                                    value={level}
                                    label={`${t('gatrixEdges.groupingLevel')} ${index + 1}`}
                                    onChange={(e: SelectChangeEvent) => handleGroupingChange(index, e.target.value as GroupingField | '')}
                                >
                                    <MenuItem value="">
                                        <em>{t('gatrixEdges.removeLevel')}</em>
                                    </MenuItem>
                                    {(['group', 'environment', 'service', 'cloudProvider', 'cloudRegion'] as GroupingField[])
                                        .filter(o => !groupingLevels.includes(o) || o === level)
                                        .map(option => (
                                            <MenuItem key={option} value={option}>
                                                {getGroupingLabel(option)}
                                            </MenuItem>
                                        ))}
                                </Select>
                            </FormControl>
                        ))}
                        {groupingLevels.length < 5 && (
                            <Button variant="outlined" size="small" onClick={addGroupingLevel}>
                                {t('gatrixEdges.addGroupBy')}
                            </Button>
                        )}
                    </Stack>
                </CardContent>
            </Card>

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
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                    {/* Root Node */}
                    <Card
                        sx={{
                            minWidth: 180,
                            textAlign: 'center',
                            border: `2px solid ${theme.palette.primary.main}`,
                            boxShadow: theme.shadows[2],
                            zIndex: 1,
                        }}
                    >
                        <CardContent sx={{ py: 2 }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                <Box
                                    sx={{
                                        width: 48,
                                        height: 48,
                                        bgcolor: 'primary.main',
                                        borderRadius: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white'
                                    }}
                                >
                                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>G</Typography>
                                </Box>
                                <Typography variant="h6" fontWeight="bold">Gatrix Core</Typography>
                            </Box>
                        </CardContent>
                    </Card>

                    {/* Groups container - Width reduced to 480 as requested */}
                    <Box sx={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        {groups.map((group, index) => (
                            <React.Fragment key={group.id}>
                                {/* Vertical line piece from previous to current group */}
                                <Box sx={{
                                    width: 2,
                                    height: index === 0 ? 32 : 16,
                                    bgcolor: theme.palette.divider,
                                    mb: index === 0 ? -0.5 : 0,
                                    mt: 0
                                }} />
                                <Box sx={{ width: '100%' }}>
                                    {renderGroup(group, 0)}
                                </Box>
                            </React.Fragment>
                        ))}

                        {groups.length === 0 && !initialLoading && (
                            <Box sx={{ p: 4, textAlign: 'center' }}>
                                <Typography color="text.secondary">
                                    {t('gatrixEdges.noEdges')}
                                </Typography>
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
                        borderRadius: 3,
                        minHeight: '70vh',
                        maxHeight: '90vh',
                        bgcolor: theme.palette.background.paper,
                        backgroundImage: 'none'
                    }
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
                        borderBottom: `1px solid ${theme.palette.divider}`,
                        bgcolor: theme.palette.background.default
                    }}
                >
                    <Box sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        bgcolor: theme.palette.primary.main,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <CodeIcon sx={{ color: '#fff', fontSize: 22 }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.25 }}>
                            {jsonDialogTitle || 'JSON Data'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {jsonDialogData ? `${(JSON.stringify(jsonDialogData).length / 1024).toFixed(1)} KB` : '—'}
                        </Typography>
                    </Box>
                </Box>

                {/* Monaco Editor Content */}
                <DialogContent sx={{
                    p: 0,
                    bgcolor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#ffffff',
                    overflow: 'hidden'
                }}>
                    <Box sx={{ height: 'calc(70vh - 160px)', minHeight: 400 }}>
                        <Editor
                            height="100%"
                            language="json"
                            theme={theme.palette.mode === 'dark' ? 'vs-dark' : 'light'}
                            value={JSON.stringify(jsonDialogData, null, 2)}
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
                                    horizontalScrollbarSize: 12
                                }
                            }}
                        />
                    </Box>
                </DialogContent>

                {/* Footer Actions */}
                <Box
                    sx={{
                        px: 3,
                        py: 2,
                        borderTop: `1px solid ${theme.palette.divider}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        bgcolor: theme.palette.background.default
                    }}
                >
                    <Typography variant="caption" color="text.secondary">
                        {t('gatrixEdges.viewJson')}
                    </Typography>
                    <Stack direction="row" spacing={1.5}>
                        <Button
                            variant="outlined"
                            startIcon={<CopyIcon />}
                            onClick={handleCopyJson}
                            sx={{
                                borderRadius: 1.5,
                                textTransform: 'none'
                            }}
                        >
                            {t('common.copy')}
                        </Button>
                        <Button
                            variant="contained"
                            onClick={() => setJsonDialogOpen(false)}
                            sx={{
                                borderRadius: 1.5,
                                textTransform: 'none'
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
