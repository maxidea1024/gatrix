import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../types/permissions';
import {
    Box,
    Typography,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Chip,
    TextField,
    InputAdornment,
    Tooltip,
    Card,
    CardContent,
    TableSortLabel,
    FormControl,
    Select,
    MenuItem,
    InputLabel,
    Switch,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Autocomplete,
    Stack,
    CircularProgress,
    Checkbox,
} from '@mui/material';
import {
    Add as AddIcon,
    Search as SearchIcon,
    Flag as FlagIcon,
    Refresh as RefreshIcon,
    Archive as ArchiveIcon,
    Unarchive as UnarchiveIcon,
    Delete as DeleteIcon,
    ContentCopy as CopyIcon,
    Warning as WarningIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { parseApiErrorMessage } from '../../utils/errorUtils';
import featureFlagService, { FeatureFlag, FlagType } from '../../services/featureFlagService';
import SimplePagination from '../../components/common/SimplePagination';
import EmptyState from '../../components/common/EmptyState';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDateTimeDetailed, formatRelativeTime } from '../../utils/dateFormat';
import ConfirmDeleteDialog from '../../components/common/ConfirmDeleteDialog';
import { copyToClipboardWithNotification } from '../../utils/clipboard';
import { tagService, Tag } from '../../services/tagService';
import { getContrastColor } from '../../utils/colorUtils';
import { environmentService, Environment } from '../../services/environmentService';
import FeatureSwitch from '../../components/common/FeatureSwitch';
import api from '../../services/api';

interface FlagTypeInfo {
    flagType: string;
    lifetimeDays: number | null;
}

const FeatureFlagsPage: React.FC = () => {
    const { t } = useTranslation();
    const { enqueueSnackbar } = useSnackbar();
    const { hasPermission } = useAuth();
    const canManage = hasPermission([PERMISSIONS.FEATURE_FLAGS_MANAGE]);
    const navigate = useNavigate();

    // State
    const [flags, setFlags] = useState<FeatureFlag[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [loading, setLoading] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [flagTypeFilter, setFlagTypeFilter] = useState<FlagType | ''>('');
    const [showArchived, setShowArchived] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deletingFlag, setDeletingFlag] = useState<FeatureFlag | null>(null);
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [flagTypes, setFlagTypes] = useState<FlagTypeInfo[]>([]);
    const [environments, setEnvironments] = useState<Environment[]>([]);
    const [selectedFlags, setSelectedFlags] = useState<Set<string>>(new Set());

    // Create dialog state
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newFlag, setNewFlag] = useState({
        flagName: '',
        description: '',
        flagType: 'release' as FlagType,
        tags: [] as string[],
        impressionDataEnabled: false,
    });

    // Sorting state
    const [orderBy, setOrderBy] = useState<string>(() => {
        const saved = localStorage.getItem('featureFlagsSortBy');
        return saved || 'createdAt';
    });
    const [order, setOrder] = useState<'asc' | 'desc'>(() => {
        const saved = localStorage.getItem('featureFlagsSortOrder');
        return (saved as 'asc' | 'desc') || 'desc';
    });

    const debouncedSearchTerm = useDebounce(searchTerm, 500);

    // Load flags
    const loadFlags = async () => {
        setLoading(true);
        try {
            const result = await featureFlagService.getFeatureFlags({
                page: page + 1,
                limit: rowsPerPage,
                search: debouncedSearchTerm || undefined,
                flagType: flagTypeFilter || undefined,
                isArchived: showArchived,
                sortBy: orderBy,
                sortOrder: order,
            });

            if (result && typeof result === 'object' && 'flags' in result && Array.isArray(result.flags)) {
                setFlags(result.flags);
                const validTotal = typeof result.total === 'number' && !isNaN(result.total) ? result.total : 0;
                setTotal(validTotal);
            } else {
                console.error('Invalid response:', result);
                setFlags([]);
                setTotal(0);
            }
        } catch (error: any) {
            console.error('Failed to load feature flags:', error);
            enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.loadFailed'), { variant: 'error' });
            setFlags([]);
            setTotal(0);
        } finally {
            setLoading(false);
            setIsInitialLoad(false);
        }
    };

    const loadTags = async () => {
        try {
            const tags = await tagService.list();
            setAllTags(tags);
        } catch {
            setAllTags([]);
        }
    };

    useEffect(() => {
        loadFlags();
    }, [page, rowsPerPage, debouncedSearchTerm, orderBy, order, flagTypeFilter, showArchived]);

    useEffect(() => {
        loadTags();
        loadFlagTypes();
        loadEnvironments();
    }, []);

    const loadEnvironments = async () => {
        try {
            const envs = await environmentService.getEnvironments();
            // Filter only visible environments and sort by displayOrder
            setEnvironments(envs.filter(e => !e.isHidden).sort((a, b) => a.displayOrder - b.displayOrder));
        } catch {
            setEnvironments([]);
        }
    };

    const loadFlagTypes = async () => {
        try {
            const response = await api.get('/admin/features/types');
            setFlagTypes(response.data?.types || []);
        } catch {
            setFlagTypes([]);
        }
    };

    // Check if a flag is stale based on its type's lifetime
    const isStale = (flag: FeatureFlag): boolean => {
        if (!flag.createdAt) return false;
        const typeInfo = flagTypes.find(t => t.flagType === flag.flagType);
        if (!typeInfo || typeInfo.lifetimeDays === null) return false;
        const createdAt = new Date(flag.createdAt);
        const now = new Date();
        const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        return daysSinceCreation > typeInfo.lifetimeDays;
    };

    // Sort handler
    const handleSort = (colId: string) => {
        let newOrder: 'asc' | 'desc' = 'asc';
        if (orderBy === colId) {
            newOrder = order === 'asc' ? 'desc' : 'asc';
        }
        setOrderBy(colId);
        setOrder(newOrder);
        localStorage.setItem('featureFlagsSortBy', colId);
        localStorage.setItem('featureFlagsSortOrder', newOrder);
        setPage(0);
    };

    // Toggle flag for a specific environment
    const handleToggle = async (flag: FeatureFlag, environment: string, currentEnabled: boolean) => {
        const newEnabled = !currentEnabled;

        // Optimistic update - ensure environments array exists
        setFlags(prev => prev.map(f => {
            if (f.flagName !== flag.flagName) return f;

            // If environments array doesn't exist, create it with the toggled environment
            const existingEnvs = f.environments || [];
            const envExists = existingEnvs.some(e => e.environment === environment);

            let updatedEnvs;
            if (envExists) {
                updatedEnvs = existingEnvs.map(e =>
                    e.environment === environment ? { ...e, isEnabled: newEnabled } : e
                );
            } else {
                // Add new environment entry
                updatedEnvs = [...existingEnvs, { environment, isEnabled: newEnabled }];
            }

            return {
                ...f,
                environments: updatedEnvs,
            };
        }));

        try {
            await featureFlagService.toggleFeatureFlag(flag.flagName, newEnabled, environment);
            enqueueSnackbar(
                t(currentEnabled ? 'featureFlags.disableSuccess' : 'featureFlags.enableSuccess'),
                { variant: 'success' }
            );
        } catch (error: any) {
            // Rollback on error
            setFlags(prev => prev.map(f => {
                if (f.flagName !== flag.flagName) return f;

                const existingEnvs = f.environments || [];
                const updatedEnvs = existingEnvs.map(e =>
                    e.environment === environment ? { ...e, isEnabled: currentEnabled } : e
                );

                return {
                    ...f,
                    environments: updatedEnvs,
                };
            }));
            enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.toggleFailed'), { variant: 'error' });
        }
    };

    // Get environment-specific enabled state
    const getEnvEnabled = (flag: FeatureFlag, envName: string): boolean => {
        if (flag.environments) {
            const envData = flag.environments.find(e => e.environment === envName);
            return envData?.isEnabled ?? false;
        }
        // Fallback to legacy isEnabled
        return flag.isEnabled ?? false;
    };

    // Archive/Revive flag
    const handleArchiveToggle = async (flag: FeatureFlag) => {
        try {
            if (flag.isArchived) {
                await featureFlagService.reviveFeatureFlag(flag.flagName);
                enqueueSnackbar(t('featureFlags.reviveSuccess'), { variant: 'success' });
            } else {
                await featureFlagService.archiveFeatureFlag(flag.flagName);
                enqueueSnackbar(t('featureFlags.archiveSuccess'), { variant: 'success' });
            }
            loadFlags();
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.archiveFailed'), { variant: 'error' });
        }
    };

    // Delete flag
    const handleDelete = (flag: FeatureFlag) => {
        setDeletingFlag(flag);
        setDeleteConfirmOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!deletingFlag) return;
        try {
            await featureFlagService.deleteFeatureFlag(deletingFlag.flagName);
            enqueueSnackbar(t('featureFlags.deleteSuccess'), { variant: 'success' });
            loadFlags();
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.deleteFailed'), { variant: 'error' });
        } finally {
            setDeleteConfirmOpen(false);
            setDeletingFlag(null);
        }
    };

    const handleDeleteCancel = () => {
        setDeleteConfirmOpen(false);
        setDeletingFlag(null);
    };

    // Create flag handler
    const handleCreateFlag = async () => {
        if (!newFlag.flagName.trim()) {
            enqueueSnackbar(t('featureFlags.flagNameRequired'), { variant: 'warning' });
            return;
        }

        setCreating(true);
        try {
            // Create flag with empty strategies - user can add strategies manually
            await api.post('/admin/features', {
                flagName: newFlag.flagName.trim(),
                description: newFlag.description.trim(),
                flagType: newFlag.flagType,
                tags: newFlag.tags,
                impressionDataEnabled: newFlag.impressionDataEnabled,
                strategies: [],
            });

            enqueueSnackbar(t('featureFlags.createSuccess'), { variant: 'success' });
            setCreateDialogOpen(false);
            setNewFlag({ flagName: '', description: '', flagType: 'release', tags: [], impressionDataEnabled: false });
            loadFlags();
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.createFailed'), { variant: 'error' });
        } finally {
            setCreating(false);
        }
    };

    const handleOpenCreateDialog = () => {
        // Generate default flag name with timestamp
        const timestamp = Date.now().toString(36).slice(-4);
        setNewFlag({
            flagName: `new-feature-${timestamp}`,
            description: '',
            flagType: 'release',
            tags: [],
            impressionDataEnabled: false,
        });
        setCreateDialogOpen(true);
    };

    // Flag type chip color
    const getTypeColor = (type: FlagType): 'default' | 'primary' | 'secondary' | 'warning' => {
        switch (type) {
            case 'release': return 'primary';
            case 'experiment': return 'secondary';
            case 'operational': return 'warning';
            case 'permission': return 'default';
            default: return 'default';
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                <Box>
                    <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FlagIcon />
                        {t('featureFlags.title')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t('featureFlags.subtitle')}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    {canManage && (
                        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreateDialog}>
                            {t('featureFlags.createFlag')}
                        </Button>
                    )}
                </Box>
            </Box>

            {/* Search and Filters */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                            <TextField
                                placeholder={t('featureFlags.searchPlaceholder')}
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
                                sx={{
                                    minWidth: 200, flexGrow: 1, maxWidth: 320,
                                    '& .MuiOutlinedInput-root': {
                                        height: '40px', borderRadius: '20px', bgcolor: 'background.paper',
                                        transition: 'all 0.2s ease-in-out',
                                        '& fieldset': { borderColor: 'divider' },
                                        '&:hover': { bgcolor: 'action.hover', '& fieldset': { borderColor: 'primary.light' } },
                                        '&.Mui-focused': { bgcolor: 'background.paper', boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.1)', '& fieldset': { borderColor: 'primary.main', borderWidth: '1px' } }
                                    },
                                    '& .MuiInputBase-input': { fontSize: '0.875rem' }
                                }}
                                InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} /></InputAdornment>) }}
                                size="small"
                            />
                            <FormControl size="small" sx={{ minWidth: 150 }}>
                                <InputLabel>{t('featureFlags.typeFilter')}</InputLabel>
                                <Select
                                    value={flagTypeFilter}
                                    label={t('featureFlags.typeFilter')}
                                    onChange={(e) => { setFlagTypeFilter(e.target.value as FlagType | ''); setPage(0); }}
                                >
                                    <MenuItem value="">{t('common.all')}</MenuItem>
                                    <MenuItem value="release">{t('featureFlags.types.release')}</MenuItem>
                                    <MenuItem value="experiment">{t('featureFlags.types.experiment')}</MenuItem>
                                    <MenuItem value="operational">{t('featureFlags.types.operational')}</MenuItem>
                                    <MenuItem value="killSwitch">{t('featureFlags.types.killSwitch')}</MenuItem>
                                    <MenuItem value="permission">{t('featureFlags.types.permission')}</MenuItem>
                                </Select>
                            </FormControl>
                            <Tooltip title={t('featureFlags.showArchivedTooltip')}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Switch
                                        size="small"
                                        checked={showArchived}
                                        onChange={(e) => { setShowArchived(e.target.checked); setPage(0); }}
                                    />
                                    <Typography variant="body2">{t('featureFlags.showArchived')}</Typography>
                                </Box>
                            </Tooltip>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Tooltip title={t('common.refresh')}>
                                <span><IconButton size="small" onClick={loadFlags} disabled={loading}><RefreshIcon /></IconButton></span>
                            </Tooltip>
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                    {loading && isInitialLoad ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                            <Typography color="text.secondary">{t('common.loadingData')}</Typography>
                        </Box>
                    ) : flags.length === 0 ? (
                        <EmptyState
                            message={t('featureFlags.noFlagsFound')}
                            onAddClick={canManage ? () => navigate('/feature-flags/new') : undefined}
                            addButtonLabel={t('featureFlags.createFlag')}
                            subtitle={canManage ? t('common.addFirstItem') : undefined}
                        />
                    ) : (
                        <>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell padding="checkbox" sx={{ width: 48 }}>
                                                <Checkbox
                                                    indeterminate={selectedFlags.size > 0 && selectedFlags.size < flags.length}
                                                    checked={flags.length > 0 && selectedFlags.size === flags.length}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedFlags(new Set(flags.map(f => f.flagName)));
                                                        } else {
                                                            setSelectedFlags(new Set());
                                                        }
                                                    }}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <TableSortLabel active={orderBy === 'flagName'} direction={orderBy === 'flagName' ? order : 'asc'} onClick={() => handleSort('flagName')}>
                                                    {t('featureFlags.flagName')}
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>{t('featureFlags.displayName')}</TableCell>
                                            <TableCell>{t('featureFlags.type')}</TableCell>
                                            {environments.map(env => (
                                                <TableCell key={env.environment} align="center" sx={{ minWidth: 70, maxWidth: 100, px: 0.5 }}>
                                                    <Tooltip title={`${env.displayName} (${env.environment})`}>
                                                        <Chip
                                                            label={env.displayName}
                                                            size="small"
                                                            sx={{
                                                                bgcolor: env.color || '#888',
                                                                color: getContrastColor(env.color || '#888'),
                                                                fontSize: '0.7rem',
                                                                height: 20,
                                                                maxWidth: 90,
                                                                '& .MuiChip-label': {
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap',
                                                                },
                                                            }}
                                                        />
                                                    </Tooltip>
                                                </TableCell>
                                            ))}
                                            <TableCell>
                                                <TableSortLabel active={orderBy === 'createdAt'} direction={orderBy === 'createdAt' ? order : 'asc'} onClick={() => handleSort('createdAt')}>
                                                    {t('featureFlags.createdAt')}
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>{t('featureFlags.tags')}</TableCell>
                                            {canManage && <TableCell align="center">{t('common.actions')}</TableCell>}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {flags.map((flag) => (
                                            <TableRow
                                                key={flag.id}
                                                hover
                                                selected={selectedFlags.has(flag.flagName)}
                                                sx={{
                                                    ...(flag.isArchived ? { opacity: 0.6 } : {})
                                                }}
                                            >
                                                <TableCell padding="checkbox">
                                                    <Checkbox
                                                        checked={selectedFlags.has(flag.flagName)}
                                                        onChange={(e) => {
                                                            const newSelected = new Set(selectedFlags);
                                                            if (e.target.checked) {
                                                                newSelected.add(flag.flagName);
                                                            } else {
                                                                newSelected.delete(flag.flagName);
                                                            }
                                                            setSelectedFlags(newSelected);
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        size="small"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        {isStale(flag) && (
                                                            <Tooltip title={t('featureFlags.staleWarning')}>
                                                                <WarningIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                                                            </Tooltip>
                                                        )}
                                                        <Typography
                                                            fontWeight={500}
                                                            sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                                                            onClick={() => navigate(`/feature-flags/${flag.flagName}`)}
                                                        >
                                                            {flag.flagName}
                                                        </Typography>
                                                        <Tooltip title={t('common.copy')}>
                                                            <IconButton
                                                                size="small"
                                                                onClick={(e) => { e.stopPropagation(); copyToClipboardWithNotification(flag.flagName, enqueueSnackbar, t); }}
                                                                sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
                                                            >
                                                                <CopyIcon sx={{ fontSize: 14 }} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <Typography
                                                            sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                                                            onClick={() => navigate(`/feature-flags/${flag.flagName}`)}
                                                        >
                                                            {flag.displayName || '-'}
                                                        </Typography>
                                                        {flag.displayName && (
                                                            <Tooltip title={t('common.copy')}>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={(e) => { e.stopPropagation(); copyToClipboardWithNotification(flag.displayName!, enqueueSnackbar, t); }}
                                                                    sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
                                                                >
                                                                    <CopyIcon sx={{ fontSize: 14 }} />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip label={t(`featureFlags.types.${flag.flagType}`)} size="small" color={getTypeColor(flag.flagType)} />
                                                </TableCell>
                                                {environments.map(env => {
                                                    const isEnabled = getEnvEnabled(flag, env.environment);
                                                    const tooltipText = `${t('featureFlags.toggleTooltip', { env: env.displayName })}\n${isEnabled ? t('featureFlags.toggleTooltipEnabled') : t('featureFlags.toggleTooltipDisabled')}`;
                                                    return (
                                                        <TableCell key={env.environment} align="center">
                                                            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                                                <Tooltip
                                                                    title={<span style={{ whiteSpace: 'pre-line' }}>{tooltipText}</span>}
                                                                    arrow
                                                                    placement="top"
                                                                >
                                                                    <span>
                                                                        <FeatureSwitch
                                                                            key={`${flag.flagName}-${env.environment}-${isEnabled}`}
                                                                            size="small"
                                                                            checked={isEnabled}
                                                                            onChange={() => handleToggle(flag, env.environment, isEnabled)}
                                                                            disabled={flag.isArchived || !canManage}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            color={env.color}
                                                                        />
                                                                    </span>
                                                                </Tooltip>
                                                            </Box>
                                                        </TableCell>
                                                    );
                                                })}
                                                <TableCell>
                                                    <Tooltip title={formatDateTimeDetailed(flag.createdAt)}>
                                                        <span>{formatRelativeTime(flag.createdAt)}</span>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                        {flag.tags?.slice(0, 3).map((tagName) => {
                                                            const tagData = allTags.find(t => t.name === tagName);
                                                            const color = tagData?.color || '#888888';
                                                            return (
                                                                <Tooltip key={tagName} title={tagData?.description || ''} arrow>
                                                                    <Chip
                                                                        label={tagName}
                                                                        size="small"
                                                                        sx={{ height: 20, bgcolor: color, color: getContrastColor(color) }}
                                                                    />
                                                                </Tooltip>
                                                            );
                                                        })}
                                                        {flag.tags && flag.tags.length > 3 && (
                                                            <Chip label={`+${flag.tags.length - 3}`} size="small" sx={{ height: 20 }} />
                                                        )}
                                                    </Box>
                                                </TableCell>
                                                {canManage && (
                                                    <TableCell align="center">
                                                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                                            <Tooltip title={flag.isArchived ? t('featureFlags.revive') : t('featureFlags.archive')}>
                                                                <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleArchiveToggle(flag); }}>
                                                                    {flag.isArchived ? <UnarchiveIcon fontSize="small" /> : <ArchiveIcon fontSize="small" />}
                                                                </IconButton>
                                                            </Tooltip>
                                                            {flag.isArchived && (
                                                                <Tooltip title={t('common.delete')}>
                                                                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDelete(flag); }}>
                                                                        <DeleteIcon fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            )}
                                                        </Box>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            <SimplePagination
                                page={page}
                                rowsPerPage={rowsPerPage}
                                count={total}
                                onPageChange={(event, newPage) => setPage(newPage)}
                                onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }}
                            />
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Delete Confirmation Dialog */}
            <ConfirmDeleteDialog
                open={deleteConfirmOpen}
                onClose={handleDeleteCancel}
                onConfirm={handleDeleteConfirm}
                title={t('featureFlags.deleteConfirmTitle')}
                message={t('featureFlags.deleteConfirmMessage', { name: deletingFlag?.flagName || '' })}
            />

            {/* Create Feature Flag Dialog */}
            <Dialog
                open={createDialogOpen}
                onClose={() => setCreateDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { borderRadius: 2 } }}
            >
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FlagIcon color="primary" />
                    {t('featureFlags.createFlag')}
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        {/* Flag Name */}
                        <TextField
                            fullWidth
                            required
                            label={t('featureFlags.flagName')}
                            value={newFlag.flagName}
                            onChange={(e) => setNewFlag({ ...newFlag, flagName: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })}
                            helperText={t('featureFlags.flagNameHelp')}
                            inputProps={{ maxLength: 100 }}
                        />

                        {/* Description */}
                        <TextField
                            fullWidth
                            multiline
                            rows={2}
                            label={t('featureFlags.description')}
                            placeholder={t('featureFlags.descriptionPlaceholder')}
                            value={newFlag.description}
                            onChange={(e) => setNewFlag({ ...newFlag, description: e.target.value })}
                        />

                        {/* Chips row: Tags, Flag Type, Impression Data */}
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                            {/* Tags */}
                            <Autocomplete
                                multiple
                                size="small"
                                options={allTags.map(tag => tag.name)}
                                value={newFlag.tags}
                                onChange={(_, newValue) => setNewFlag({ ...newFlag, tags: newValue })}
                                renderInput={(params) => (
                                    <TextField {...params} label={t('featureFlags.tags')} sx={{ minWidth: 150 }} />
                                )}
                                renderTags={(value, getTagProps) =>
                                    value.map((option, index) => {
                                        const tag = allTags.find(t => t.name === option);
                                        return (
                                            <Chip
                                                {...getTagProps({ index })}
                                                key={option}
                                                label={option}
                                                size="small"
                                                sx={{
                                                    bgcolor: tag?.color || '#888',
                                                    color: getContrastColor(tag?.color || '#888'),
                                                }}
                                            />
                                        );
                                    })
                                }
                                sx={{ flex: 1, minWidth: 150 }}
                            />

                            {/* Flag Type */}
                            <FormControl size="small" sx={{ minWidth: 120 }}>
                                <InputLabel>{t('featureFlags.flagType')}</InputLabel>
                                <Select
                                    value={newFlag.flagType}
                                    label={t('featureFlags.flagType')}
                                    onChange={(e) => setNewFlag({ ...newFlag, flagType: e.target.value as FlagType })}
                                >
                                    <MenuItem value="release">{t('featureFlags.types.release')}</MenuItem>
                                    <MenuItem value="experiment">{t('featureFlags.types.experiment')}</MenuItem>
                                    <MenuItem value="operational">{t('featureFlags.types.operational')}</MenuItem>
                                    <MenuItem value="permission">{t('featureFlags.types.permission')}</MenuItem>
                                </Select>
                            </FormControl>

                            {/* Impression Data */}
                            <Chip
                                icon={<FlagIcon fontSize="small" />}
                                label={newFlag.impressionDataEnabled ? t('featureFlags.impressionDataOn') : t('featureFlags.impressionDataOff')}
                                variant={newFlag.impressionDataEnabled ? 'filled' : 'outlined'}
                                color={newFlag.impressionDataEnabled ? 'primary' : 'default'}
                                onClick={() => setNewFlag({ ...newFlag, impressionDataEnabled: !newFlag.impressionDataEnabled })}
                                sx={{ cursor: 'pointer' }}
                            />
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setCreateDialogOpen(false)} disabled={creating}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleCreateFlag}
                        disabled={creating || !newFlag.flagName.trim()}
                        startIcon={creating ? <CircularProgress size={20} /> : undefined}
                    >
                        {t('featureFlags.createFlag')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default FeatureFlagsPage;
