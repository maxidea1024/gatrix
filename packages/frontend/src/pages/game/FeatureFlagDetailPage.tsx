/**
 * Feature Flag Detail Page - Unleash Style Layout
 * 
 * Layout:
 * - Left sidebar: Flag details (type, created, tags, etc.)
 * - Right main area: Environment cards (expandable with strategies)
 * 
 * Tabs: Overview, Metrics, Settings, Event Log
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    Stack,
    Paper,
    Chip,
    IconButton,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Tooltip,
    Tabs,
    Tab,
    Alert,
    List,
    ListItem,
    ListItemText,
    Divider,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    CircularProgress,
    FormControlLabel,
    Checkbox,
    Slider,
    Grid,
    Autocomplete,
    Switch,
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    Save as SaveIcon,
    Delete as DeleteIcon,
    Archive as ArchiveIcon,
    Add as AddIcon,
    Refresh as RefreshIcon,
    ContentCopy as CopyIcon,
    ExpandMore as ExpandMoreIcon,
    Edit as EditIcon,
    DragIndicator as DragIcon,
    ArrowUpward as ArrowUpIcon,
    ArrowDownward as ArrowDownIcon,
    Tune as TuneIcon,
    Timeline as TimelineIcon,
    Settings as SettingsIcon,
    History as HistoryIcon,
    MoreVert as MoreIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSIONS } from '../../types/permissions';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { parseApiErrorMessage } from '../../utils/errorUtils';
import api from '../../services/api';
import ConfirmDeleteDialog from '../../components/common/ConfirmDeleteDialog';
import ConstraintEditor, { Constraint, ContextField } from '../../components/features/ConstraintEditor';
import { ConstraintList } from '../../components/features/ConstraintDisplay';
import { formatDateTimeDetailed, formatRelativeTime } from '../../utils/dateFormat';
import { copyToClipboardWithNotification } from '../../utils/clipboard';
import ResizableDrawer from '../../components/common/ResizableDrawer';
import { tagService, Tag } from '../../services/tagService';
import { getContrastColor } from '../../utils/colorUtils';
import JsonEditor from '../../components/common/JsonEditor';
import EmptyState from '../../components/common/EmptyState';
import { environmentService, Environment } from '../../services/environmentService';
import FeatureSwitch from '../../components/common/FeatureSwitch';

// ==================== Types ====================

interface Strategy {
    id: string;
    name: string;
    title: string;
    parameters: Record<string, any>;
    constraints: Constraint[];
    segments?: string[];
    sortOrder: number;
    disabled?: boolean;
}

interface Variant {
    name: string;
    weight: number;
    weightLock?: boolean;
    stickiness?: string;
    payload?: {
        type: 'string' | 'json' | 'csv';
        value: string;
    };
    overrides?: {
        contextName: string;
        values: string[];
    }[];
}

interface FeatureFlagEnvironment {
    id: string;
    flagId: string;
    environment: string;
    isEnabled: boolean;
    lastSeenAt?: string;
}

interface FeatureFlag {
    id: string;
    environment: string;
    flagName: string;
    displayName?: string;
    description?: string;
    flagType: 'release' | 'experiment' | 'operational' | 'permission';
    isEnabled: boolean;
    isArchived: boolean;
    impressionDataEnabled: boolean;
    staleAfterDays?: number;
    tags?: string[];
    strategies?: Strategy[];
    variants?: Variant[];
    variantType?: 'string' | 'json' | 'number';
    environments?: FeatureFlagEnvironment[];
    lastSeenAt?: string;
    archivedAt?: string;
    createdBy?: number;
    updatedBy?: number;
    createdAt: string;
    updatedAt?: string;
}

// ==================== Strategy Types ====================

const STRATEGY_TYPES = [
    { name: 'default', titleKey: 'featureFlags.strategies.default.title', descKey: 'featureFlags.strategies.default.desc' },
    { name: 'userWithId', titleKey: 'featureFlags.strategies.userWithId.title', descKey: 'featureFlags.strategies.userWithId.desc' },
    { name: 'gradualRolloutRandom', titleKey: 'featureFlags.strategies.gradualRolloutRandom.title', descKey: 'featureFlags.strategies.gradualRolloutRandom.desc' },
    { name: 'gradualRolloutUserId', titleKey: 'featureFlags.strategies.gradualRolloutUserId.title', descKey: 'featureFlags.strategies.gradualRolloutUserId.desc' },
    { name: 'flexibleRollout', titleKey: 'featureFlags.strategies.flexibleRollout.title', descKey: 'featureFlags.strategies.flexibleRollout.desc' },
    { name: 'remoteAddress', titleKey: 'featureFlags.strategies.remoteAddress.title', descKey: 'featureFlags.strategies.remoteAddress.desc' },
    { name: 'applicationHostname', titleKey: 'featureFlags.strategies.applicationHostname.title', descKey: 'featureFlags.strategies.applicationHostname.desc' },
];

const FLAG_TYPES = [
    { value: 'release', labelKey: 'featureFlags.types.release' },
    { value: 'experiment', labelKey: 'featureFlags.types.experiment' },
    { value: 'operational', labelKey: 'featureFlags.types.operational' },
    { value: 'permission', labelKey: 'featureFlags.types.permission' },
];

// ==================== Components ====================

interface TabPanelProps {
    children?: React.ReactNode;
    value: number;
    index: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
    <Box role="tabpanel" hidden={value !== index} sx={{ py: 0 }}>
        {value === index && children}
    </Box>
);

// ==================== Main Page ====================

const FeatureFlagDetailPage: React.FC = () => {
    const { flagName } = useParams<{ flagName: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { enqueueSnackbar } = useSnackbar();
    const { hasPermission } = useAuth();
    const canManage = hasPermission([PERMISSIONS.FEATURE_FLAGS_MANAGE]);

    const isCreating = flagName === 'new';

    const generateDefaultFlagName = () => {
        const timestamp = Date.now().toString(36).slice(-4);
        return `new-feature-${timestamp}`;
    };

    // State
    const [flag, setFlag] = useState<FeatureFlag | null>(isCreating ? {
        id: '',
        environment: '',
        flagName: generateDefaultFlagName(),
        displayName: '',
        description: '',
        flagType: 'release',
        isEnabled: false,
        isArchived: false,
        impressionDataEnabled: false,
        staleAfterDays: undefined,
        tags: [],
        strategies: [{
            id: undefined as any,
            name: 'flexibleRollout',
            title: 'Flexible Rollout',
            parameters: { rollout: 100, stickiness: 'default', groupId: '' },
            constraints: [],
            segments: [],
            sortOrder: 0,
            disabled: false,
        }],
        variants: [],
        createdAt: new Date().toISOString(),
    } : null);
    const [loading, setLoading] = useState(!isCreating);
    const [saving, setSaving] = useState(false);
    const [tabValue, setTabValue] = useState(0);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [strategyDialogOpen, setStrategyDialogOpen] = useState(false);
    const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
    const [variantDialogOpen, setVariantDialogOpen] = useState(false);
    const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
    const [contextFields, setContextFields] = useState<ContextField[]>([]);
    const [segments, setSegments] = useState<any[]>([]);
    const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set());
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [originalFlag, setOriginalFlag] = useState<FeatureFlag | null>(null);
    const [jsonPayloadErrors, setJsonPayloadErrors] = useState<Record<number, string | null>>({});

    // Environment states
    const [environments, setEnvironments] = useState<Environment[]>([]);
    const [expandedEnvs, setExpandedEnvs] = useState<Set<string>>(new Set());
    const [selectedEnvForEdit, setSelectedEnvForEdit] = useState<string | null>(null);
    const [envSettingsDrawerOpen, setEnvSettingsDrawerOpen] = useState(false);

    // ==================== Data Loading ====================

    const loadFlag = useCallback(async () => {
        if (isCreating || !flagName) return;
        try {
            setLoading(true);
            const response = await api.get(`/admin/features/${flagName}`);
            // Backend returns { success: true, data: { flag } }
            // api.request() returns response.data, so we get { flag }
            const data = response.data?.flag || response.data;
            setFlag(data);
            setOriginalFlag(JSON.parse(JSON.stringify(data)));
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.loadFailed'), { variant: 'error' });
            navigate('/feature-flags');
        } finally {
            setLoading(false);
        }
    }, [flagName, isCreating, navigate, enqueueSnackbar]);

    const loadContextFields = useCallback(async () => {
        try {
            const response = await api.get('/admin/features/context-fields');
            setContextFields(response.data.data || response.data || []);
        } catch {
            setContextFields([]);
        }
    }, []);

    const loadSegments = useCallback(async () => {
        try {
            const response = await api.get('/admin/features/segments');
            setSegments(response.data.data || response.data || []);
        } catch {
            setSegments([]);
        }
    }, []);

    const loadTags = useCallback(async () => {
        try {
            const tags = await tagService.list();
            setAllTags(tags);
        } catch {
            setAllTags([]);
        }
    }, []);

    const loadEnvironments = useCallback(async () => {
        try {
            const envs = await environmentService.getEnvironments();
            setEnvironments(envs);
        } catch {
            setEnvironments([]);
        }
    }, []);

    useEffect(() => {
        if (!isCreating) {
            loadFlag();
        }
        loadContextFields();
        loadSegments();
        loadTags();
        loadEnvironments();
    }, [loadFlag, loadContextFields, loadSegments, loadTags, loadEnvironments, isCreating]);

    // ==================== Handlers ====================

    const handleToggle = async () => {
        if (!flag || !canManage) return;

        if (isCreating) {
            setFlag({ ...flag, isEnabled: !flag.isEnabled });
            return;
        }

        try {
            await api.post(`/admin/features/${flag.flagName}/toggle`, { isEnabled: !flag.isEnabled });
            setFlag({ ...flag, isEnabled: !flag.isEnabled });
            enqueueSnackbar(t(`featureFlags.${!flag.isEnabled ? 'enabled' : 'disabled'}`), { variant: 'success' });
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.toggleFailed'), { variant: 'error' });
        }
    };

    const handleEnvToggle = async (envKey: string, currentEnabled: boolean) => {
        if (!flag || !canManage) return;
        try {
            await api.post(`/admin/features/${flag.flagName}/toggle`, {
                isEnabled: !currentEnabled,
                environment: envKey,
            });
            loadFlag();
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.toggleFailed'), { variant: 'error' });
        }
    };

    const handleSave = async () => {
        if (!flag || !canManage) return;
        setSaving(true);
        try {
            if (isCreating) {
                await api.post('/admin/features', flag);
                enqueueSnackbar(t('featureFlags.createSuccess'), { variant: 'success' });
                navigate('/game/feature-flags');
            } else {
                await api.put(`/admin/features/${flag.flagName}`, {
                    displayName: flag.displayName,
                    description: flag.description,
                    impressionDataEnabled: flag.impressionDataEnabled,
                    tags: flag.tags,
                });
                setOriginalFlag(JSON.parse(JSON.stringify(flag)));
                enqueueSnackbar(t('featureFlags.updateSuccess'), { variant: 'success' });
            }
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.saveFailed'), { variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleArchive = async () => {
        if (!flag || !canManage) return;
        try {
            await api.put(`/admin/features/${flag.flagName}/archive`, { isArchived: !flag.isArchived });
            setFlag({ ...flag, isArchived: !flag.isArchived });
            enqueueSnackbar(t(`featureFlags.${!flag.isArchived ? 'archived' : 'revived'}`), { variant: 'success' });
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.archiveFailed'), { variant: 'error' });
        }
    };

    const handleDelete = async () => {
        if (!flag || !canManage) return;
        try {
            await api.delete(`/admin/features/${flag.flagName}`);
            enqueueSnackbar(t('featureFlags.deleteSuccess'), { variant: 'success' });
            navigate('/feature-flags');
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.deleteFailed'), { variant: 'error' });
        }
    };

    // Strategy handlers
    const handleAddStrategy = () => {
        setEditingStrategy({
            id: `new-${Date.now()}`,
            name: 'flexibleRollout',
            title: '',
            parameters: { rollout: 100, stickiness: 'default', groupId: '' },
            constraints: [],
            segments: [],
            sortOrder: (flag?.strategies?.length || 0),
            disabled: false,
        });
        setStrategyDialogOpen(true);
    };

    const handleEditStrategy = (strategy: Strategy) => {
        setEditingStrategy({ ...strategy });
        setStrategyDialogOpen(true);
    };

    const handleSaveStrategy = async () => {
        if (!flag || !editingStrategy) return;

        const isNew = editingStrategy.id?.startsWith('new-');
        let updatedStrategies: Strategy[];

        if (isNew) {
            const newStrategy = { ...editingStrategy, id: undefined as any };
            updatedStrategies = [...(flag.strategies || []), newStrategy];
        } else {
            updatedStrategies = (flag.strategies || []).map(s =>
                s.id === editingStrategy.id ? editingStrategy : s
            );
        }

        try {
            if (!isCreating) {
                await api.put(`/admin/features/${flag.flagName}/strategies`, { strategies: updatedStrategies });
            }
            setFlag({ ...flag, strategies: updatedStrategies });
            setOriginalFlag(prev => prev ? { ...prev, strategies: updatedStrategies } : null);
            setStrategyDialogOpen(false);
            setEditingStrategy(null);
            enqueueSnackbar(t('common.saveSuccess'), { variant: 'success' });
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'common.saveFailed'), { variant: 'error' });
        }
    };

    const handleDeleteStrategy = async (strategyId: string | undefined, index: number) => {
        if (!flag) return;
        const updatedStrategies = (flag.strategies || []).filter((_, i) => i !== index);

        try {
            if (!isCreating) {
                await api.put(`/admin/features/${flag.flagName}/strategies`, { strategies: updatedStrategies });
            }
            setFlag({ ...flag, strategies: updatedStrategies });
            setOriginalFlag(prev => prev ? { ...prev, strategies: updatedStrategies } : null);
            enqueueSnackbar(t('common.deleteSuccess'), { variant: 'success' });
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'common.deleteFailed'), { variant: 'error' });
        }
    };

    // Variant handlers (simplified)
    const handleAddVariant = () => {
        setEditingVariant({
            name: '',
            weight: 50,
            stickiness: 'userId',
            payload: { type: flag?.variantType === 'json' ? 'json' : 'string', value: '' },
        });
        setVariantDialogOpen(true);
    };

    const handleEditVariant = (variant: Variant) => {
        setEditingVariant({ ...variant });
        setVariantDialogOpen(true);
    };

    const handleSaveVariants = async () => {
        if (!flag || !editingVariant) return;

        let updatedVariants: Variant[];
        const existingIndex = (flag.variants || []).findIndex(v => v.name === editingVariant.name);

        if (existingIndex >= 0) {
            updatedVariants = (flag.variants || []).map((v, i) =>
                i === existingIndex ? editingVariant : v
            );
        } else {
            updatedVariants = [...(flag.variants || []), editingVariant];
        }

        try {
            if (!isCreating) {
                await api.put(`/admin/features/${flag.flagName}/variants`, { variants: updatedVariants });
            }
            setFlag({ ...flag, variants: updatedVariants });
            setOriginalFlag(prev => prev ? { ...prev, variants: updatedVariants } : null);
            setVariantDialogOpen(false);
            setEditingVariant(null);
            enqueueSnackbar(t('common.saveSuccess'), { variant: 'success' });
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'common.saveFailed'), { variant: 'error' });
        }
    };

    const handleDeleteVariant = async (index: number) => {
        if (!flag) return;
        const updatedVariants = (flag.variants || []).filter((_, i) => i !== index);

        try {
            if (!isCreating) {
                await api.put(`/admin/features/${flag.flagName}/variants`, { variants: updatedVariants });
            }
            setFlag({ ...flag, variants: updatedVariants });
            setOriginalFlag(prev => prev ? { ...prev, variants: updatedVariants } : null);
            enqueueSnackbar(t('common.deleteSuccess'), { variant: 'success' });
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'common.deleteFailed'), { variant: 'error' });
        }
    };

    // Helper functions
    const getStrategyTitle = (name: string) => {
        const strategyType = STRATEGY_TYPES.find(st => st.name === name);
        return strategyType ? t(strategyType.titleKey) : name;
    };

    const getSegmentNames = (segmentIds: string[] = []) => {
        const segmentsArray = Array.isArray(segments) ? segments : [];
        return segmentIds.map(id => segmentsArray.find(s => s.id === id)?.name || id).join(', ');
    };

    // ==================== Render ====================

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!flag) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">{t('featureFlags.notFound')}</Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <IconButton onClick={() => navigate('/feature-flags')}>
                    <ArrowBackIcon />
                </IconButton>
                <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h5" fontWeight={600}>
                            {flag.displayName || flag.flagName}
                        </Typography>
                        {flag.isArchived && (
                            <Chip label={t('featureFlags.archived')} size="small" color="warning" />
                        )}
                        <Tooltip title={t('common.copyToClipboard')}>
                            <IconButton
                                size="small"
                                onClick={() => copyToClipboardWithNotification(
                                    flag.flagName,
                                    () => enqueueSnackbar(t('common.copySuccess'), { variant: 'success' }),
                                    () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
                                )}
                            >
                                <CopyIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                    {flag.description && (
                        <Typography variant="body2" color="text.secondary">{flag.description}</Typography>
                    )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {canManage && (
                        <Button
                            variant="contained"
                            startIcon={<SaveIcon />}
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? <CircularProgress size={20} /> : t('common.save')}
                        </Button>
                    )}
                    {!isCreating && (
                        <Tooltip title={t('common.refresh')}>
                            <IconButton onClick={loadFlag}><RefreshIcon /></IconButton>
                        </Tooltip>
                    )}
                </Box>
            </Box>

            {/* Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
                    <Tab label={t('featureFlags.overview')} />
                    <Tab label={t('featureFlags.metrics')} disabled={isCreating} />
                    <Tab label={t('common.settings')} disabled={isCreating} />
                </Tabs>
            </Box>

            {/* Overview Tab */}
            <TabPanel value={tabValue} index={0}>
                <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
                    {/* Left Sidebar - Flag Details */}
                    <Box sx={{ width: { xs: '100%', md: 320 }, flexShrink: 0 }}>
                        {/* Flag Details Card */}
                        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                                {t('featureFlags.flagDetails')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                {flag.flagName}
                            </Typography>

                            <Stack spacing={1.5}>
                                {/* Flag Type */}
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="body2" color="text.secondary">
                                        {t('featureFlags.flagType')}
                                    </Typography>
                                    {isCreating ? (
                                        <FormControl size="small" sx={{ minWidth: 120 }}>
                                            <Select
                                                value={flag.flagType}
                                                onChange={(e) => setFlag({ ...flag, flagType: e.target.value as any })}
                                            >
                                                {FLAG_TYPES.map(type => (
                                                    <MenuItem key={type.value} value={type.value}>
                                                        {t(type.labelKey)}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    ) : (
                                        <Typography variant="body2">
                                            {t(`featureFlags.types.${flag.flagType}`)}
                                        </Typography>
                                    )}
                                </Box>

                                {/* Created At */}
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="body2" color="text.secondary">
                                        {t('featureFlags.createdAt')}
                                    </Typography>
                                    <Tooltip title={formatDateTimeDetailed(flag.createdAt)} arrow>
                                        <Typography variant="body2">
                                            {formatRelativeTime(flag.createdAt)}
                                        </Typography>
                                    </Tooltip>
                                </Box>

                                {/* Updated At */}
                                {flag.updatedAt && (
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography variant="body2" color="text.secondary">
                                            {t('featureFlags.updatedAt')}
                                        </Typography>
                                        <Tooltip title={formatDateTimeDetailed(flag.updatedAt)} arrow>
                                            <Typography variant="body2">
                                                {formatRelativeTime(flag.updatedAt)}
                                            </Typography>
                                        </Tooltip>
                                    </Box>
                                )}

                                <Divider />

                                {/* Tags */}
                                <Box>
                                    <Typography variant="body2" color="text.secondary" gutterBottom>
                                        {t('featureFlags.tags')}
                                    </Typography>
                                    {canManage && !isCreating ? (
                                        <Autocomplete
                                            multiple
                                            size="small"
                                            options={allTags.map(tag => tag.name)}
                                            value={flag.tags || []}
                                            onChange={(_, newValue) => setFlag({ ...flag, tags: newValue })}
                                            renderInput={(params) => (
                                                <TextField {...params} placeholder={t('featureFlags.selectTags')} />
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
                                        />
                                    ) : (
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                            {(flag.tags || []).map(tagName => {
                                                const tag = allTags.find(t => t.name === tagName);
                                                return (
                                                    <Chip
                                                        key={tagName}
                                                        label={tagName}
                                                        size="small"
                                                        sx={{
                                                            bgcolor: tag?.color || '#888',
                                                            color: getContrastColor(tag?.color || '#888'),
                                                        }}
                                                    />
                                                );
                                            })}
                                            {(flag.tags || []).length === 0 && (
                                                <Typography variant="caption" color="text.secondary">
                                                    {t('featureFlags.noTags')}
                                                </Typography>
                                            )}
                                        </Box>
                                    )}
                                </Box>

                                {/* Actions */}
                                {canManage && !isCreating && (
                                    <>
                                        <Divider />
                                        <Button
                                            variant="outlined"
                                            color={flag.isArchived ? 'success' : 'warning'}
                                            startIcon={<ArchiveIcon />}
                                            onClick={handleArchive}
                                            fullWidth
                                            size="small"
                                        >
                                            {flag.isArchived ? t('featureFlags.revive') : t('featureFlags.archive')}
                                        </Button>
                                        {flag.isArchived && (
                                            <Button
                                                variant="outlined"
                                                color="error"
                                                startIcon={<DeleteIcon />}
                                                onClick={() => setDeleteDialogOpen(true)}
                                                fullWidth
                                                size="small"
                                            >
                                                {t('common.delete')}
                                            </Button>
                                        )}
                                    </>
                                )}
                            </Stack>
                        </Paper>

                        {/* Basic Info - only in create mode */}
                        {isCreating && (
                            <Paper variant="outlined" sx={{ p: 2 }}>
                                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                                    {t('featureFlags.basicInfo')}
                                </Typography>
                                <Stack spacing={2}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        required
                                        label={t('featureFlags.flagName')}
                                        value={flag.flagName || ''}
                                        onChange={(e) => setFlag({ ...flag, flagName: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })}
                                        helperText={t('featureFlags.flagNameHelp')}
                                    />
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label={t('featureFlags.displayName')}
                                        value={flag.displayName || ''}
                                        onChange={(e) => setFlag({ ...flag, displayName: e.target.value })}
                                    />
                                    <TextField
                                        fullWidth
                                        size="small"
                                        multiline
                                        rows={2}
                                        label={t('featureFlags.description')}
                                        value={flag.description || ''}
                                        onChange={(e) => setFlag({ ...flag, description: e.target.value })}
                                    />
                                </Stack>
                            </Paper>
                        )}
                    </Box>

                    {/* Right Main Area - Environment Cards */}
                    <Box sx={{ flex: 1 }}>
                        <Stack spacing={2}>
                            {environments.map(env => {
                                // Get environment-specific isEnabled from flag.environments
                                const envSettings = flag.environments?.find(e => e.environment === env.environment);
                                const isEnabled = envSettings?.isEnabled ?? false;
                                const strategies = flag.strategies || [];
                                const strategiesCount = strategies.length;
                                const isExpanded = expandedEnvs.has(env.environment);

                                return (
                                    <Paper
                                        key={env.environment}
                                        variant="outlined"
                                        sx={{
                                            borderLeftWidth: 4,
                                            borderLeftColor: env.color || '#888',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        <Accordion
                                            expanded={isExpanded}
                                            onChange={(_, expanded) => {
                                                setExpandedEnvs(prev => {
                                                    const next = new Set(prev);
                                                    if (expanded) {
                                                        next.add(env.environment);
                                                    } else {
                                                        next.delete(env.environment);
                                                    }
                                                    return next;
                                                });
                                            }}
                                            disableGutters
                                            sx={{
                                                '&:before': { display: 'none' },
                                                bgcolor: 'transparent',
                                            }}
                                        >
                                            <AccordionSummary
                                                expandIcon={<ExpandMoreIcon />}
                                                sx={{
                                                    px: 2,
                                                    '& .MuiAccordionSummary-content': {
                                                        alignItems: 'center',
                                                        gap: 2,
                                                    },
                                                }}
                                            >
                                                {/* Toggle switch */}
                                                <Box onClick={(e) => e.stopPropagation()}>
                                                    <FeatureSwitch
                                                        size="small"
                                                        checked={isEnabled}
                                                        onChange={() => handleEnvToggle(env.environment, isEnabled)}
                                                        disabled={!canManage || flag.isArchived}
                                                    />
                                                </Box>

                                                {/* Environment info */}
                                                <Box sx={{ flex: 1 }}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {t('featureFlags.environment')}
                                                    </Typography>
                                                    <Typography variant="subtitle1" fontWeight={600}>
                                                        {env.displayName}
                                                    </Typography>
                                                </Box>

                                                {/* Strategy count chip */}
                                                <Chip
                                                    label={t('featureFlags.strategiesCount', { count: strategiesCount })}
                                                    size="small"
                                                    color="primary"
                                                    variant="outlined"
                                                />

                                                {/* Metrics placeholder */}
                                                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120, textAlign: 'right' }}>
                                                    {t('featureFlags.noMetricsYet')}
                                                </Typography>
                                            </AccordionSummary>

                                            <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
                                                {strategies.length === 0 ? (
                                                    <Box sx={{ py: 3, textAlign: 'center' }}>
                                                        <Typography color="text.secondary" gutterBottom>
                                                            {t('featureFlags.noStrategies')}
                                                        </Typography>
                                                        {canManage && (
                                                            <Button
                                                                variant="contained"
                                                                startIcon={<AddIcon />}
                                                                onClick={handleAddStrategy}
                                                                size="small"
                                                            >
                                                                {t('featureFlags.addStrategy')}
                                                            </Button>
                                                        )}
                                                    </Box>
                                                ) : (
                                                    <Stack spacing={2}>
                                                        {strategies.map((strategy, index) => (
                                                            <React.Fragment key={strategy.id || index}>
                                                                {/* OR divider */}
                                                                {index > 0 && (
                                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                        <Divider sx={{ flexGrow: 1 }} />
                                                                        <Chip
                                                                            label="OR"
                                                                            size="small"
                                                                            variant="outlined"
                                                                            color="secondary"
                                                                            sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                                                                        />
                                                                        <Divider sx={{ flexGrow: 1 }} />
                                                                    </Box>
                                                                )}

                                                                {/* Strategy card */}
                                                                <Paper variant="outlined" sx={{ p: 2 }}>
                                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                        <Box sx={{ flex: 1 }}>
                                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                                                <Typography fontWeight={600}>
                                                                                    {getStrategyTitle(strategy.name)}
                                                                                </Typography>
                                                                                {strategy.disabled && (
                                                                                    <Chip
                                                                                        label={t('featureFlags.strategyDisabled')}
                                                                                        size="small"
                                                                                        color="warning"
                                                                                    />
                                                                                )}
                                                                            </Box>

                                                                            {/* Segments */}
                                                                            {strategy.segments && strategy.segments.length > 0 && (
                                                                                <Box sx={{ mb: 1 }}>
                                                                                    <Typography variant="caption" color="text.secondary">
                                                                                        {t('featureFlags.segment')}:
                                                                                    </Typography>
                                                                                    <Typography variant="body2">
                                                                                        {getSegmentNames(strategy.segments)}
                                                                                    </Typography>
                                                                                </Box>
                                                                            )}

                                                                            {/* Rollout % */}
                                                                            {strategy.parameters?.rollout !== undefined && (
                                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                                    <Typography variant="caption" color="text.secondary">
                                                                                        {t('featureFlags.rollout')}:
                                                                                    </Typography>
                                                                                    <Chip
                                                                                        label={`${strategy.parameters.rollout}%`}
                                                                                        size="small"
                                                                                        variant="outlined"
                                                                                    />
                                                                                    <Typography variant="body2" color="text.secondary">
                                                                                        {t('featureFlags.ofYourBase')}
                                                                                    </Typography>
                                                                                </Box>
                                                                            )}

                                                                            {/* Constraints */}
                                                                            {strategy.constraints && strategy.constraints.length > 0 && (
                                                                                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                                                                    +{strategy.constraints.length} {t('featureFlags.constraints').toLowerCase()}
                                                                                </Typography>
                                                                            )}
                                                                        </Box>

                                                                        {/* Actions */}
                                                                        {canManage && (
                                                                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                                                <Tooltip title={t('common.edit')}>
                                                                                    <IconButton size="small" onClick={() => handleEditStrategy(strategy)}>
                                                                                        <EditIcon fontSize="small" />
                                                                                    </IconButton>
                                                                                </Tooltip>
                                                                                <Tooltip title={t('common.copy')}>
                                                                                    <IconButton size="small">
                                                                                        <CopyIcon fontSize="small" />
                                                                                    </IconButton>
                                                                                </Tooltip>
                                                                                <IconButton size="small" onClick={() => handleDeleteStrategy(strategy.id, index)}>
                                                                                    <DeleteIcon fontSize="small" />
                                                                                </IconButton>
                                                                            </Box>
                                                                        )}
                                                                    </Box>
                                                                </Paper>
                                                            </React.Fragment>
                                                        ))}

                                                        {/* Add strategy button */}
                                                        {canManage && (
                                                            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                                <Button
                                                                    variant="contained"
                                                                    startIcon={<AddIcon />}
                                                                    onClick={handleAddStrategy}
                                                                    size="small"
                                                                >
                                                                    {t('featureFlags.addStrategy')}
                                                                </Button>
                                                            </Box>
                                                        )}
                                                    </Stack>
                                                )}

                                                {/* Variants Section */}
                                                <Divider sx={{ my: 2 }} />
                                                <Box>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                                        <Typography variant="subtitle2" fontWeight={600}>
                                                            {t('featureFlags.variants')} ({(flag.variants || []).length})
                                                        </Typography>
                                                        {canManage && (
                                                            <Button
                                                                variant="outlined"
                                                                startIcon={<AddIcon />}
                                                                onClick={handleAddVariant}
                                                                size="small"
                                                            >
                                                                {t('featureFlags.addVariant')}
                                                            </Button>
                                                        )}
                                                    </Box>
                                                    {(flag.variants || []).length === 0 ? (
                                                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                                                            {t('featureFlags.noVariantsFound')}
                                                        </Typography>
                                                    ) : (
                                                        <Stack spacing={1}>
                                                            {(flag.variants || []).map((variant, vIndex) => (
                                                                <Paper key={variant.name || vIndex} variant="outlined" sx={{ p: 1.5 }}>
                                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                        <Box>
                                                                            <Typography fontWeight={500}>{variant.name}</Typography>
                                                                            <Typography variant="caption" color="text.secondary">
                                                                                {t('featureFlags.weight')}: {variant.weight}%
                                                                            </Typography>
                                                                        </Box>
                                                                        {canManage && (
                                                                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                                                <IconButton size="small" onClick={() => handleEditVariant(variant)}>
                                                                                    <EditIcon fontSize="small" />
                                                                                </IconButton>
                                                                                <IconButton size="small" onClick={() => handleDeleteVariant(vIndex)}>
                                                                                    <DeleteIcon fontSize="small" />
                                                                                </IconButton>
                                                                            </Box>
                                                                        )}
                                                                    </Box>
                                                                </Paper>
                                                            ))}
                                                        </Stack>
                                                    )}
                                                </Box>
                                            </AccordionDetails>
                                        </Accordion>
                                    </Paper>
                                );
                            })}
                        </Stack>
                    </Box>
                </Box>
            </TabPanel>

            {/* Metrics Tab */}
            <TabPanel value={tabValue} index={1}>
                <Alert severity="info">{t('featureFlags.metricsComingSoon')}</Alert>
            </TabPanel>

            {/* Settings Tab */}
            <TabPanel value={tabValue} index={2}>
                <Paper variant="outlined" sx={{ p: 3, maxWidth: 600 }}>
                    <Typography variant="h6" gutterBottom>{t('common.settings')}</Typography>
                    <Stack spacing={3}>
                        <TextField
                            fullWidth
                            label={t('featureFlags.displayName')}
                            value={flag.displayName || ''}
                            onChange={(e) => setFlag({ ...flag, displayName: e.target.value })}
                            disabled={!canManage}
                        />
                        <TextField
                            fullWidth
                            multiline
                            rows={3}
                            label={t('featureFlags.description')}
                            value={flag.description || ''}
                            onChange={(e) => setFlag({ ...flag, description: e.target.value })}
                            disabled={!canManage}
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={flag.impressionDataEnabled}
                                    onChange={(e) => setFlag({ ...flag, impressionDataEnabled: e.target.checked })}
                                    disabled={!canManage}
                                />
                            }
                            label={t('featureFlags.impressionData')}
                        />
                    </Stack>
                </Paper>
            </TabPanel>

            {/* Delete Confirmation Dialog */}
            <ConfirmDeleteDialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                onConfirm={handleDelete}
                title={t('featureFlags.deleteConfirmTitle')}
                message={t('featureFlags.deleteConfirmMessage', { name: flag.flagName })}
            />

            {/* Strategy Edit Drawer */}
            <ResizableDrawer
                open={strategyDialogOpen}
                onClose={() => setStrategyDialogOpen(false)}
                title={editingStrategy?.id?.startsWith('new-') ? t('featureFlags.addStrategy') : t('featureFlags.editStrategy')}
                storageKey="featureFlagStrategyDrawerWidth"
                defaultWidth={600}
            >
                <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
                    {editingStrategy && (
                        <Stack spacing={3}>
                            {/* Strategy Type Selection */}
                            <FormControl fullWidth>
                                <InputLabel>{t('featureFlags.strategyType')}</InputLabel>
                                <Select
                                    value={editingStrategy.name || 'flexibleRollout'}
                                    onChange={(e) => setEditingStrategy({ ...editingStrategy, name: e.target.value })}
                                    label={t('featureFlags.strategyType')}
                                >
                                    {STRATEGY_TYPES.map(type => (
                                        <MenuItem key={type.name} value={type.name}>
                                            {t(type.titleKey)}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            {/* Rollout % for flexible rollout */}
                            {(editingStrategy.name === 'flexibleRollout' || editingStrategy.name?.includes('Rollout')) && (
                                <Box>
                                    <Typography gutterBottom>{t('featureFlags.rollout')}</Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <Slider
                                            value={editingStrategy.parameters?.rollout || 100}
                                            onChange={(_, value) => setEditingStrategy({
                                                ...editingStrategy,
                                                parameters: { ...editingStrategy.parameters, rollout: value as number }
                                            })}
                                            valueLabelDisplay="auto"
                                            min={0}
                                            max={100}
                                            sx={{ flex: 1 }}
                                        />
                                        <Typography sx={{ width: 50 }}>{editingStrategy.parameters?.rollout || 100}%</Typography>
                                    </Box>
                                </Box>
                            )}

                            {/* Segments */}
                            <Autocomplete
                                multiple
                                options={Array.isArray(segments) ? segments : []}
                                getOptionLabel={(option) => option.name}
                                value={(Array.isArray(segments) ? segments : []).filter(s => (editingStrategy.segments || []).includes(s.id))}
                                onChange={(_, newValue) => setEditingStrategy({
                                    ...editingStrategy,
                                    segments: newValue.map(s => s.id)
                                })}
                                renderInput={(params) => (
                                    <TextField {...params} label={t('featureFlags.segments')} />
                                )}
                            />

                            {/* Constraints */}
                            <Box>
                                <Typography variant="subtitle2" gutterBottom>{t('featureFlags.constraints')}</Typography>
                                <ConstraintEditor
                                    constraints={editingStrategy.constraints || []}
                                    onChange={(constraints) => setEditingStrategy({ ...editingStrategy, constraints })}
                                    contextFields={Array.isArray(contextFields) ? contextFields : []}
                                />
                            </Box>
                        </Stack>
                    )}
                </Box>
                <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                    <Button onClick={() => setStrategyDialogOpen(false)}>{t('common.cancel')}</Button>
                    <Button variant="contained" onClick={handleSaveStrategy}>{t('common.save')}</Button>
                </Box>
            </ResizableDrawer>

            {/* Variant Edit Drawer */}
            <ResizableDrawer
                open={variantDialogOpen}
                onClose={() => setVariantDialogOpen(false)}
                title={t('featureFlags.editVariant')}
                storageKey="featureFlagVariantDrawerWidth"
                defaultWidth={500}
            >
                <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
                    {editingVariant && (
                        <Stack spacing={3}>
                            <TextField
                                fullWidth
                                required
                                label={t('featureFlags.variantName')}
                                value={editingVariant.name}
                                onChange={(e) => setEditingVariant({ ...editingVariant, name: e.target.value })}
                            />
                            <Box>
                                <Typography gutterBottom>{t('featureFlags.weight')}</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Slider
                                        value={editingVariant.weight}
                                        onChange={(_, value) => setEditingVariant({ ...editingVariant, weight: value as number })}
                                        valueLabelDisplay="auto"
                                        min={0}
                                        max={100}
                                        sx={{ flex: 1 }}
                                    />
                                    <Typography sx={{ width: 50 }}>{editingVariant.weight}%</Typography>
                                </Box>
                            </Box>
                        </Stack>
                    )}
                </Box>
                <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                    <Button onClick={() => setVariantDialogOpen(false)}>{t('common.cancel')}</Button>
                    <Button variant="contained" onClick={handleSaveVariants}>{t('common.save')}</Button>
                </Box>
            </ResizableDrawer>
        </Box>
    );
};

export default FeatureFlagDetailPage;
