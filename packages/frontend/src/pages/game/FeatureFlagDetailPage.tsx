/**
 * Feature Flag Detail Page - Unleash-style
 * 
 * Complete feature flag management with:
 * - Overview: Basic info, enable/disable toggle
 * - Strategies: Multiple activation strategies with constraints
 * - Variants: A/B testing variants
 * - Metrics: Usage statistics
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../types/permissions';
import {
    Box,
    Typography,
    Button,
    Card,
    CardContent,
    CardHeader,
    Switch,
    Tabs,
    Tab,
    TextField,
    IconButton,
    Chip,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    InputAdornment,
    Tooltip,
    Divider,
    Alert,
    LinearProgress,
    Paper,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    Slider,
    FormControlLabel,
    Checkbox,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Stack,
    Grid,
    FormHelperText,
    Autocomplete,
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    Flag as FlagIcon,
    Save as SaveIcon,
    Delete as DeleteIcon,
    Archive as ArchiveIcon,
    Refresh as RefreshIcon,
    Add as AddIcon,
    Edit as EditIcon,
    ExpandMore as ExpandMoreIcon,
    PlayArrow as PlayArrowIcon,
    Pause as PauseIcon,
    Group as GroupIcon,
    Tune as TuneIcon,
    Timeline as TimelineIcon,
    ContentCopy as CopyIcon,
    DragIndicator as DragIcon,
    Remove as RemoveIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    Warning as WarningIcon,
    Abc as StringTypeIcon,
    Numbers as NumberTypeIcon,
    DataObject as JsonTypeIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { parseApiErrorMessage } from '../../utils/errorUtils';
import api from '../../services/api';
import ConfirmDeleteDialog from '../../components/common/ConfirmDeleteDialog';
import ConstraintEditor, { Constraint, ContextField } from '../../components/features/ConstraintEditor';
import { formatDateTimeDetailed, formatRelativeTime } from '../../utils/dateFormat';
import { copyToClipboardWithNotification } from '../../utils/clipboard';
import ResizableDrawer from '../../components/common/ResizableDrawer';
import { tagService, Tag } from '../../services/tagService';
import { getContrastColor } from '../../utils/colorUtils';

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
    weightLock?: boolean; // If true, weight is manually set; otherwise auto-distributed
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
    variantType?: 'string' | 'json' | 'number'; // All variants share this type
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

// ==================== Components ====================

interface TabPanelProps {
    children?: React.ReactNode;
    value: number;
    index: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
    <Box role="tabpanel" hidden={value !== index} sx={{ py: 3 }}>
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

    // Check if we're creating a new flag
    const isCreating = flagName === 'new';

    // Generate a default flag name for new flags
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
            id: undefined,
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

    // Check if there are unsaved changes
    const hasChanges = (): boolean => {
        if (!flag) return false;
        if (isCreating) return true; // Always allow save for new flags
        if (!originalFlag) return false;
        return (
            flag.displayName !== originalFlag.displayName ||
            flag.description !== originalFlag.description ||
            flag.impressionDataEnabled !== originalFlag.impressionDataEnabled ||
            JSON.stringify(flag.tags || []) !== JSON.stringify(originalFlag.tags || [])
        );
    };

    // Check if strategies have changed
    const hasStrategyChanges = (): boolean => {
        if (!flag || !originalFlag) return false;
        return JSON.stringify(flag.strategies || []) !== JSON.stringify(originalFlag.strategies || []);
    };

    // Load data
    const loadFlag = useCallback(async () => {
        if (!flagName || isCreating) return;
        setLoading(true);
        try {
            const response = await api.get(`/admin/features/${flagName}`);
            const loadedFlag = response.data?.flag || null;

            // Transform strategies - map strategyName to name and set title
            if (loadedFlag?.strategies) {
                loadedFlag.strategies = loadedFlag.strategies.map((s: any) => {
                    const strategyType = STRATEGY_TYPES.find(st => st.name === s.strategyName || st.name === s.name);
                    return {
                        ...s,
                        name: s.strategyName || s.name,
                        title: s.title || (strategyType ? strategyType.titleKey : s.strategyName || s.name),
                        disabled: s.isEnabled === false,
                    };
                });
            }

            setFlag(loadedFlag);
            setOriginalFlag(loadedFlag ? JSON.parse(JSON.stringify(loadedFlag)) : null);
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, t('featureFlags.loadFailed')), { variant: 'error' });
            navigate('/game/feature-flags');
        } finally {
            setLoading(false);
        }
    }, [flagName, isCreating, navigate, t, enqueueSnackbar]);

    const loadContextFields = useCallback(async () => {
        try {
            const response = await api.get('/admin/features/context-fields');
            const fields = response.data?.contextFields || [];
            setContextFields(fields
                .filter((f: any) => f.isEnabled !== false)
                .map((f: any) => ({
                    fieldName: f.fieldName,
                    displayName: f.displayName || f.fieldName,
                    description: f.description || '',
                    fieldType: f.fieldType || 'string',
                    legalValues: f.legalValues || [],
                })));
        } catch {
            // Use defaults if API fails
            setContextFields([
                { fieldName: 'userId', displayName: 'User ID', fieldType: 'string' },
                { fieldName: 'sessionId', displayName: 'Session ID', fieldType: 'string' },
                { fieldName: 'appName', displayName: 'App Name', fieldType: 'string' },
                { fieldName: 'environment', displayName: 'Environment', fieldType: 'string' },
            ]);
        }
    }, []);

    const loadSegments = useCallback(async () => {
        try {
            const response = await api.get('/admin/features/segments');
            const allSegments = response.data?.segments || [];
            setSegments(allSegments.filter((s: any) => s.isActive !== false));
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

    useEffect(() => {
        if (!isCreating) {
            loadFlag();
        }
        loadContextFields();
        loadSegments();
        loadTags();
    }, [loadFlag, loadContextFields, loadSegments, loadTags, isCreating]);

    // Handlers
    const handleToggle = async () => {
        if (!flag || !canManage) return;

        if (isCreating) {
            // In create mode, just update local state
            setFlag({ ...flag, isEnabled: !flag.isEnabled });
        } else {
            // In edit mode, call API
            try {
                const response = await api.post(`/admin/features/${flag.flagName}/toggle`, {
                    isEnabled: !flag.isEnabled,
                });
                setFlag(response.data?.flag || flag);
                enqueueSnackbar(
                    flag.isEnabled ? t('featureFlags.disabled') : t('featureFlags.enabled'),
                    { variant: 'success' }
                );
            } catch (error: any) {
                enqueueSnackbar(parseApiErrorMessage(error, t('featureFlags.toggleFailed')), { variant: 'error' });
            }
        }
    };

    const handleSave = async () => {
        if (!flag || !canManage) return;

        // Validate flagName for new flags
        if (isCreating && !flag.flagName?.trim()) {
            enqueueSnackbar(t('featureFlags.flagNameRequired'), { variant: 'error' });
            return;
        }

        setSaving(true);
        try {
            if (isCreating) {
                // Create new flag with strategies and variants
                // Transform strategies to backend format
                const cleanStrategies = (flag.strategies || []).map(s => ({
                    strategyName: s.name,
                    parameters: s.parameters,
                    constraints: s.constraints,
                    sortOrder: s.sortOrder,
                    isEnabled: !s.disabled,
                }));

                // Transform variants to backend format
                const cleanVariants = (flag.variants || []).map(v => ({
                    variantName: v.name,
                    weight: v.weight,
                    stickiness: v.stickiness,
                    payload: v.payload?.value,
                    payloadType: v.payload?.type,
                    overrides: v.overrides,
                }));

                const response = await api.post('/admin/features', {
                    flagName: flag.flagName,
                    displayName: flag.displayName,
                    description: flag.description,
                    flagType: flag.flagType,
                    impressionDataEnabled: flag.impressionDataEnabled,
                    tags: flag.tags,
                    strategies: cleanStrategies,
                    variants: cleanVariants,
                });
                enqueueSnackbar(t('featureFlags.createSuccess'), { variant: 'success' });
                // Navigate back to list page
                navigate('/game/feature-flags');
            } else {
                // Update existing flag
                const response = await api.put(`/admin/features/${flag.flagName}`, {
                    displayName: flag.displayName,
                    description: flag.description,
                    impressionDataEnabled: flag.impressionDataEnabled,
                    tags: flag.tags,
                });
                setFlag(response.data?.flag || flag);
                setOriginalFlag(response.data?.flag || flag);
                enqueueSnackbar(t('featureFlags.updateSuccess'), { variant: 'success' });
                navigate('/game/feature-flags');
            }
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, isCreating ? t('featureFlags.createFailed') : t('featureFlags.updateFailed')), { variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleArchive = async () => {
        if (!flag || !canManage) return;
        try {
            const endpoint = flag.isArchived ? 'revive' : 'archive';
            const response = await api.post(`/admin/features/${flag.flagName}/${endpoint}`);
            setFlag(response.data?.flag || flag);
            enqueueSnackbar(
                flag.isArchived ? t('featureFlags.revived') : t('featureFlags.archived'),
                { variant: 'success' }
            );
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, t('featureFlags.archiveFailed')), { variant: 'error' });
        }
    };

    const handleDelete = async () => {
        if (!flag || !canManage) return;
        try {
            await api.delete(`/admin/features/${flag.flagName}`);
            enqueueSnackbar(t('featureFlags.deleteSuccess'), { variant: 'success' });
            navigate('/game/feature-flags');
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, t('featureFlags.deleteFailed')), { variant: 'error' });
        } finally {
            setDeleteDialogOpen(false);
        }
    };

    // Strategy Handlers
    const handleAddStrategy = () => {
        setEditingStrategy({
            id: '',
            name: 'flexibleRollout',
            title: 'Flexible Rollout',
            parameters: { rollout: 100, stickiness: 'default', groupId: '' },
            constraints: [],
            segments: [],
            sortOrder: (flag?.strategies?.length || 0) + 1,
        });
        setStrategyDialogOpen(true);
    };


    const handleEditStrategy = (strategy: Strategy) => {
        setEditingStrategy({ ...strategy });
        setStrategyDialogOpen(true);
    };

    const handleSaveStrategy = async () => {
        if (!flag || !editingStrategy) return;

        if (isCreating) {
            // In create mode, just update local state
            const strategies = [...(flag.strategies || [])];
            if (editingStrategy.id) {
                // Edit existing
                const idx = strategies.findIndex(s => s.id === editingStrategy.id);
                if (idx !== -1) strategies[idx] = editingStrategy;
            } else {
                // Add new with temp ID
                strategies.push({ ...editingStrategy, id: `temp-${Date.now()}` });
            }
            setFlag({ ...flag, strategies });
            setStrategyDialogOpen(false);
            setEditingStrategy(null);
        } else {
            // In edit mode, call API
            try {
                // Transform frontend format to backend format
                const strategyData = {
                    strategyName: editingStrategy.name,
                    parameters: editingStrategy.parameters,
                    constraints: editingStrategy.constraints,
                    sortOrder: editingStrategy.sortOrder,
                    isEnabled: !editingStrategy.disabled,
                };
                if (editingStrategy.id) {
                    await api.put(`/admin/features/${flag.flagName}/strategies/${editingStrategy.id}`, strategyData);
                } else {
                    await api.post(`/admin/features/${flag.flagName}/strategies`, strategyData);
                }
                enqueueSnackbar(t('featureFlags.strategySaved'), { variant: 'success' });
                setStrategyDialogOpen(false);
                setEditingStrategy(null);
                loadFlag();
            } catch (error: any) {
                enqueueSnackbar(parseApiErrorMessage(error, t('featureFlags.strategySaveFailed')), { variant: 'error' });
            }
        }
    };

    const handleDeleteStrategy = (_strategyId: string, strategyIndex: number) => {
        if (!flag) return;

        // Always update local state - changes are saved when user clicks "Save Strategies"
        const strategies = (flag.strategies || []).filter((_, idx) => idx !== strategyIndex);
        setFlag({ ...flag, strategies });
    };

    // Move strategy up/down for reordering
    const handleMoveStrategy = (fromIndex: number, toIndex: number) => {
        if (!flag || !flag.strategies) return;
        if (toIndex < 0 || toIndex >= flag.strategies.length) return;

        const strategies = [...flag.strategies];
        const [movedItem] = strategies.splice(fromIndex, 1);
        strategies.splice(toIndex, 0, movedItem);

        // Update sortOrder values
        const updatedStrategies = strategies.map((s, idx) => ({ ...s, sortOrder: idx }));
        setFlag({ ...flag, strategies: updatedStrategies });
    };

    const handleSaveStrategies = async () => {
        if (!flag) return;

        if (isCreating) {
            // In create mode, strategies are already in local state
            return;
        } else {
            // In edit mode, call API to save all strategies
            try {
                await api.put(`/admin/features/${flag.flagName}/strategies`, {
                    strategies: flag.strategies || [],
                });
                enqueueSnackbar(t('featureFlags.strategiesSaved'), { variant: 'success' });
                loadFlag();
            } catch (error: any) {
                enqueueSnackbar(parseApiErrorMessage(error, t('featureFlags.strategiesSaveFailed')), { variant: 'error' });
            }
        }
    };
    // Variant Handlers
    // Utility function to distribute weights
    const distributeVariantWeights = (variants: Variant[]) => {
        if (variants.length === 0) return;
        if (variants.length === 1) {
            variants[0].weight = 100;
            variants[0].weightLock = false;
            return;
        }

        // Calculate locked weight total - only count weightLock=true variants
        let lockedTotal = 0;
        let unlockedCount = 0;

        for (const v of variants) {
            if (v.weightLock === true) {
                lockedTotal += v.weight || 0;
            } else {
                unlockedCount++;
            }
        }

        // Distribute remaining to unlocked variants
        const remaining = Math.max(0, 100 - lockedTotal);

        if (unlockedCount > 0) {
            const equalWeight = Math.floor(remaining / unlockedCount);
            const remainder = remaining - (equalWeight * unlockedCount);
            let unlockedIndex = 0;

            for (const v of variants) {
                if (v.weightLock !== true) {
                    v.weight = equalWeight + (unlockedIndex < remainder ? 1 : 0);
                    unlockedIndex++;
                }
            }
        }
    };

    const handleAddVariant = () => {
        setEditingVariant({
            name: '',
            weight: 0,
            weightLock: false,
            stickiness: 'userId',
        });
        setVariantDialogOpen(true);
    };

    const handleSaveVariant = () => {
        if (!flag || !editingVariant || !editingVariant.name) return;

        const variants = [...(flag.variants || [])];
        const existingIdx = variants.findIndex(v => v.name === editingVariant.name);

        if (existingIdx !== -1) {
            variants[existingIdx] = editingVariant;
        } else {
            variants.push({ ...editingVariant, weightLock: false });
        }

        distributeVariantWeights(variants);
        setFlag({ ...flag, variants });
        setVariantDialogOpen(false);
        setEditingVariant(null);
    };

    const handleDeleteVariant = (variantName: string) => {
        if (!flag) return;
        const variants = (flag.variants || []).filter(v => v.name !== variantName);
        distributeVariantWeights(variants);
        setFlag({ ...flag, variants });
    };

    const handleSaveVariants = async () => {
        if (!flag) return;

        if (isCreating) {
            // In create mode, variants are already in local state, just close dialog
            setVariantDialogOpen(false);
            setEditingVariant(null);
        } else {
            // In edit mode, call API
            try {
                // Map frontend field names to backend field names
                const mappedVariants = (flag.variants || []).map(v => ({
                    variantName: v.name,
                    weight: v.weight,
                    stickiness: v.stickiness,
                    payload: v.payload,
                    payloadType: v.payload?.type || 'string',
                    overrides: v.overrides,
                }));
                await api.put(`/admin/features/${flag.flagName}/variants`, {
                    variants: mappedVariants,
                });
                enqueueSnackbar(t('featureFlags.variantsSaved'), { variant: 'success' });
                setVariantDialogOpen(false);
                setEditingVariant(null);
            } catch (error: any) {
                enqueueSnackbar(parseApiErrorMessage(error, t('featureFlags.variantsSaveFailed')), { variant: 'error' });
            }
        }
    };


    if (loading) {
        return (
            <Box sx={{ p: 3 }}>
                <LinearProgress />
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
                <IconButton onClick={() => navigate('/game/feature-flags')}>
                    <ArrowBackIcon />
                </IconButton>
                <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FlagIcon color={flag.isEnabled ? 'success' : 'disabled'} />
                        <Typography variant="h5" fontWeight={600}>
                            {flag.displayName || flag.flagName}
                        </Typography>
                        <Chip
                            size="small"
                            label={flag.flagType}
                            color={flag.flagType === 'release' ? 'primary' : flag.flagType === 'experiment' ? 'secondary' : 'default'}
                        />
                        {flag.isArchived && <Chip size="small" label={t('featureFlags.archived')} color="warning" />}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                            {flag.flagName}
                        </Typography>
                        <Tooltip title={t('common.copy')}>
                            <IconButton size="small" onClick={() => copyToClipboardWithNotification(flag.flagName, enqueueSnackbar, t)}>
                                <CopyIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>

                {/* Enable Toggle */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={flag.isEnabled}
                                onChange={handleToggle}
                                disabled={!canManage || flag.isArchived}
                                color="success"
                            />
                        }
                        label={flag.isEnabled ? t('featureFlags.enabled') : t('featureFlags.disabled')}
                        labelPlacement="start"
                    />
                    {!isCreating && (
                        <Tooltip title={t('common.refresh')}>
                            <IconButton onClick={loadFlag}><RefreshIcon /></IconButton>
                        </Tooltip>
                    )}
                </Box>
            </Box>

            {/* Tabs */}
            <Card>
                <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
                    <Tab icon={<TuneIcon />} iconPosition="start" label={t('featureFlags.overview')} />
                    <Tab icon={<GroupIcon />} iconPosition="start" label={t('featureFlags.targeting')} />
                    <Tab icon={<PlayArrowIcon />} iconPosition="start" label={t('featureFlags.variants')} />
                    <Tab icon={<TimelineIcon />} iconPosition="start" label={t('featureFlags.metrics')} />
                </Tabs>

                {/* Overview Tab */}
                <TabPanel value={tabValue} index={0}>
                    <CardContent>
                        <Box sx={{ display: 'flex', gap: 4, flexDirection: isCreating ? 'column' : { xs: 'column', md: 'row' } }}>
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="subtitle2" gutterBottom>{t('featureFlags.basicInfo')}</Typography>
                                <Stack spacing={3}>
                                    {/* Flag Name - only editable in create mode */}
                                    <TextField
                                        fullWidth
                                        required
                                        label={t('featureFlags.flagName')}
                                        value={flag.flagName || ''}
                                        onChange={(e) => setFlag({ ...flag, flagName: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })}
                                        helperText={t('featureFlags.flagNameHelp')}
                                        placeholder="my-feature-flag"
                                        disabled={!isCreating}
                                    />

                                    <TextField
                                        fullWidth
                                        label={t('featureFlags.displayName')}
                                        value={flag.displayName || ''}
                                        onChange={(e) => setFlag({ ...flag, displayName: e.target.value })}
                                        disabled={!canManage}
                                        helperText={t('featureFlags.displayNameHelp')}
                                    />

                                    <TextField
                                        fullWidth
                                        multiline
                                        rows={3}
                                        label={t('featureFlags.description')}
                                        value={flag.description || ''}
                                        onChange={(e) => setFlag({ ...flag, description: e.target.value })}
                                        disabled={!canManage}
                                        helperText={t('featureFlags.descriptionHelp')}
                                    />

                                    {/* Flag Type + Stale Days Row */}
                                    <Box sx={{ display: 'flex', gap: 2 }}>
                                        <FormControl sx={{ flex: 1 }} disabled={!isCreating}>
                                            <InputLabel>{t('featureFlags.flagType')}</InputLabel>
                                            <Select
                                                value={flag.flagType}
                                                label={t('featureFlags.flagType')}
                                                onChange={(e) => setFlag({ ...flag, flagType: e.target.value as any })}
                                            >
                                                <MenuItem value="release">{t('featureFlags.flagTypes.release')}</MenuItem>
                                                <MenuItem value="experiment">{t('featureFlags.flagTypes.experiment')}</MenuItem>
                                                <MenuItem value="operational">{t('featureFlags.flagTypes.operational')}</MenuItem>
                                                <MenuItem value="killSwitch">{t('featureFlags.flagTypes.killSwitch')}</MenuItem>
                                                <MenuItem value="permission">{t('featureFlags.flagTypes.permission')}</MenuItem>
                                            </Select>
                                            <FormHelperText>{t('featureFlags.flagTypeHelp')}</FormHelperText>
                                        </FormControl>
                                    </Box>

                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={flag.impressionDataEnabled}
                                                onChange={(e) => setFlag({ ...flag, impressionDataEnabled: e.target.checked })}
                                                disabled={!canManage}
                                            />
                                        }
                                        label={
                                            <Box>
                                                <Typography variant="body1">{t('featureFlags.impressionDataEnabled')}</Typography>
                                                <Typography variant="caption" color="text.secondary">{t('featureFlags.impressionDataEnabledHelp')}</Typography>
                                            </Box>
                                        }
                                    />

                                    {/* Tags */}
                                    <Divider sx={{ my: 3 }} />
                                    <Typography variant="subtitle2" gutterBottom>{t('featureFlags.tags')}</Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                                        {flag.tags?.map((tagName) => {
                                            const tagData = allTags.find(t => t.name === tagName);
                                            const color = tagData?.color || '#888888';
                                            return (
                                                <Tooltip key={tagName} title={tagData?.description || ''} arrow>
                                                    <Chip
                                                        label={tagName}
                                                        onDelete={canManage ? () => setFlag({ ...flag, tags: flag.tags?.filter(t => t !== tagName) }) : undefined}
                                                        size="small"
                                                        sx={{ bgcolor: color, color: getContrastColor(color) }}
                                                    />
                                                </Tooltip>
                                            );
                                        })}
                                    </Box>
                                    {canManage && (
                                        <Autocomplete
                                            size="small"
                                            sx={{ maxWidth: 300 }}
                                            options={allTags.filter(t => !(flag.tags || []).includes(t.name))}
                                            getOptionLabel={(option) => option.name}
                                            value={null}
                                            onChange={(_, selected) => {
                                                if (selected) {
                                                    setFlag({ ...flag, tags: [...(flag.tags || []), selected.name] });
                                                }
                                            }}
                                            renderOption={(props, option) => (
                                                <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Box
                                                        sx={{
                                                            width: 16,
                                                            height: 16,
                                                            borderRadius: '50%',
                                                            bgcolor: option.color || '#888888',
                                                            flexShrink: 0,
                                                        }}
                                                    />
                                                    <Box>
                                                        <Typography variant="body2">{option.name}</Typography>
                                                        {option.description && (
                                                            <Typography variant="caption" color="text.secondary">{option.description}</Typography>
                                                        )}
                                                    </Box>
                                                </Box>
                                            )}
                                            renderInput={(params) => (
                                                <TextField {...params} placeholder={t('featureFlags.selectTags')} size="small" />
                                            )}
                                            disabled={allTags.length === 0}
                                            noOptionsText={t('featureFlags.noTagsAvailable')}
                                            clearOnBlur
                                            blurOnSelect
                                        />
                                    )}

                                    {canManage && (
                                        <Box sx={{ mt: 3 }}>
                                            <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving || !hasChanges()}>
                                                {isCreating ? t('common.create') : t('common.save')}
                                            </Button>
                                        </Box>
                                    )}
                                </Stack>
                            </Box>

                            {/* Metadata - only show in edit mode */}
                            {!isCreating && (
                                <Box sx={{ minWidth: 280 }}>
                                    <Paper variant="outlined" sx={{ p: 2 }}>
                                        <Typography variant="subtitle2" gutterBottom>{t('featureFlags.metadata')}</Typography>
                                        <List dense>
                                            <ListItem>
                                                <ListItemText
                                                    primary={t('featureFlags.createdAt')}
                                                    secondary={
                                                        <Tooltip title={formatDateTimeDetailed(flag.createdAt)} arrow>
                                                            <span>{formatRelativeTime(flag.createdAt)}</span>
                                                        </Tooltip>
                                                    }
                                                />
                                            </ListItem>
                                            {flag.updatedAt && (
                                                <ListItem>
                                                    <ListItemText
                                                        primary={t('featureFlags.updatedAt')}
                                                        secondary={
                                                            <Tooltip title={formatDateTimeDetailed(flag.updatedAt)} arrow>
                                                                <span>{formatRelativeTime(flag.updatedAt)}</span>
                                                            </Tooltip>
                                                        }
                                                    />
                                                </ListItem>
                                            )}
                                            {flag.lastSeenAt && (
                                                <ListItem>
                                                    <ListItemText
                                                        primary={t('featureFlags.lastSeenAt')}
                                                        secondary={
                                                            <Tooltip title={formatDateTimeDetailed(flag.lastSeenAt)} arrow>
                                                                <span>{formatRelativeTime(flag.lastSeenAt)}</span>
                                                            </Tooltip>
                                                        }
                                                    />
                                                </ListItem>
                                            )}
                                        </List>

                                        {canManage && (
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
                                                <Button
                                                    variant="outlined"
                                                    color={flag.isArchived ? 'success' : 'warning'}
                                                    startIcon={<ArchiveIcon />}
                                                    onClick={handleArchive}
                                                    fullWidth
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
                                                    >
                                                        {t('common.delete')}
                                                    </Button>
                                                )}
                                            </Box>
                                        )}
                                    </Paper>
                                </Box>
                            )}
                        </Box>
                    </CardContent>
                </TabPanel>

                {/* Strategies Tab */}
                <TabPanel value={tabValue} index={1}>
                    <CardContent>
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="h6">{t('featureFlags.activationStrategies')}</Typography>
                            <Typography variant="body2" color="text.secondary">
                                {(() => {
                                    const strategies = flag.strategies || [];
                                    const totalSegments = strategies.reduce((sum, s) => sum + (s.segments?.length || 0), 0);
                                    const totalConstraints = strategies.reduce((sum, s) => sum + (s.constraints?.length || 0), 0);

                                    if (totalSegments === 0 && totalConstraints === 0) {
                                        return t('featureFlags.strategiesDescriptionEmpty');
                                    }
                                    return t('featureFlags.strategiesDescriptionWithCount', {
                                        segmentCount: totalSegments,
                                        constraintCount: totalConstraints
                                    });
                                })()}
                            </Typography>
                        </Box>

                        {/* Inline Strategies Editor */}
                        <Stack spacing={0}>
                            {(flag.strategies || []).map((strategy, index) => (
                                <React.Fragment key={strategy.id || index}>
                                    {/* OR divider between strategies */}
                                    {index > 0 && (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                                            <Divider sx={{ flexGrow: 1 }} />
                                            <Chip label="OR" size="small" variant="outlined" color="secondary" sx={{ fontWeight: 600 }} />
                                            <Divider sx={{ flexGrow: 1 }} />
                                        </Box>
                                    )}
                                    <Accordion defaultExpanded>
                                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                                                {/* Move up/down buttons - only show when more than 1 strategy */}
                                                {canManage && (flag.strategies?.length || 0) > 1 && (
                                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }} onClick={(e) => e.stopPropagation()}>
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleMoveStrategy(index, index - 1)}
                                                            disabled={index === 0}
                                                            sx={{ p: 0.25 }}
                                                        >
                                                            <ExpandMoreIcon sx={{ transform: 'rotate(180deg)', fontSize: 18 }} />
                                                        </IconButton>
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleMoveStrategy(index, index + 1)}
                                                            disabled={index === (flag.strategies?.length || 0) - 1}
                                                            sx={{ p: 0.25 }}
                                                        >
                                                            <ExpandMoreIcon sx={{ fontSize: 18 }} />
                                                        </IconButton>
                                                    </Box>
                                                )}
                                                <Box sx={{ flex: 1 }}>
                                                    <Typography fontWeight={500}>
                                                        {(() => {
                                                            const strategyType = STRATEGY_TYPES.find(st => st.name === strategy.name);
                                                            if (strategyType) return t(strategyType.titleKey);
                                                            return strategy.title || strategy.name;
                                                        })()}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {strategy.constraints?.length || 0} {t('featureFlags.constraints')}
                                                    </Typography>
                                                </Box>
                                                <FormControlLabel
                                                    control={
                                                        <Switch
                                                            size="small"
                                                            checked={!strategy.disabled}
                                                            onChange={(e) => {
                                                                e.stopPropagation();
                                                                const strategies = [...(flag.strategies || [])];
                                                                strategies[index] = { ...strategies[index], disabled: !e.target.checked };
                                                                setFlag({ ...flag, strategies });
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                            disabled={!canManage}
                                                        />
                                                    }
                                                    label=""
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </Box>
                                        </AccordionSummary>
                                        <AccordionDetails>
                                            <Stack spacing={2}>
                                                {/* Strategy Type Select */}
                                                <FormControl fullWidth size="small">
                                                    <InputLabel>{t('featureFlags.strategyType')}</InputLabel>
                                                    <Select
                                                        value={strategy.name || 'default'}
                                                        label={t('featureFlags.strategyType')}
                                                        onChange={(e) => {
                                                            const strategyType = STRATEGY_TYPES.find(s => s.name === e.target.value);
                                                            const strategies = [...(flag.strategies || [])];
                                                            strategies[index] = {
                                                                ...strategies[index],
                                                                name: e.target.value,
                                                                title: strategyType?.titleKey ? t(strategyType.titleKey) : e.target.value,
                                                            };
                                                            setFlag({ ...flag, strategies });
                                                        }}
                                                        disabled={!canManage}
                                                    >
                                                        {STRATEGY_TYPES.map((s) => (
                                                            <MenuItem key={s.name} value={s.name}>
                                                                <Box>
                                                                    <Typography variant="body2">{t(s.titleKey)}</Typography>
                                                                    <Typography variant="caption" color="text.secondary">{t(s.descKey)}</Typography>
                                                                </Box>
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                </FormControl>

                                                {/* Strategy Parameters */}
                                                {strategy.name === 'gradualRolloutRandom' && (
                                                    <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                                                        <Typography variant="subtitle2" gutterBottom>
                                                            {t('featureFlags.rolloutPercentage')}
                                                        </Typography>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                            <Box sx={{ flex: 1, pr: 3 }}>
                                                                <Slider
                                                                    value={strategy.parameters?.percentage || 0}
                                                                    onChange={(_, value) => {
                                                                        const strategies = [...(flag.strategies || [])];
                                                                        strategies[index] = {
                                                                            ...strategies[index],
                                                                            parameters: { ...strategies[index].parameters, percentage: value as number }
                                                                        };
                                                                        setFlag({ ...flag, strategies });
                                                                    }}
                                                                    disabled={!canManage}
                                                                    valueLabelDisplay="auto"
                                                                    marks={[
                                                                        { value: 0, label: '0%' },
                                                                        { value: 25, label: '25%' },
                                                                        { value: 50, label: '50%' },
                                                                        { value: 75, label: '75%' },
                                                                        { value: 100, label: '100%' },
                                                                    ]}
                                                                />
                                                            </Box>
                                                            <TextField
                                                                size="small"
                                                                type="number"
                                                                value={strategy.parameters?.percentage || 0}
                                                                onChange={(e) => {
                                                                    const value = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                                                    const strategies = [...(flag.strategies || [])];
                                                                    strategies[index] = {
                                                                        ...strategies[index],
                                                                        parameters: { ...strategies[index].parameters, percentage: value }
                                                                    };
                                                                    setFlag({ ...flag, strategies });
                                                                }}
                                                                disabled={!canManage}
                                                                InputProps={{
                                                                    endAdornment: <Typography>%</Typography>,
                                                                    inputProps: { min: 0, max: 100 }
                                                                }}
                                                                sx={{ width: 100 }}
                                                            />
                                                        </Box>
                                                    </Box>
                                                )}

                                                {strategy.name === 'userWithId' && (
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        multiline
                                                        rows={2}
                                                        label={t('featureFlags.userIds')}
                                                        value={strategy.parameters?.userIds || ''}
                                                        onChange={(e) => {
                                                            const strategies = [...(flag.strategies || [])];
                                                            strategies[index] = {
                                                                ...strategies[index],
                                                                parameters: { ...strategies[index].parameters, userIds: e.target.value }
                                                            };
                                                            setFlag({ ...flag, strategies });
                                                        }}
                                                        disabled={!canManage}
                                                        helperText={t('featureFlags.userIdsHelp')}
                                                    />
                                                )}

                                                {/* Gradual Rollout (Sticky) Parameters */}
                                                {strategy.name === 'gradualRolloutUserId' && (
                                                    <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                                                        <Typography variant="subtitle2" gutterBottom>
                                                            {t('featureFlags.rolloutPercentage')}
                                                        </Typography>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                                                            <Box sx={{ flex: 1, pr: 3 }}>
                                                                <Slider
                                                                    value={strategy.parameters?.percentage || 0}
                                                                    onChange={(_, value) => {
                                                                        const strategies = [...(flag.strategies || [])];
                                                                        strategies[index] = {
                                                                            ...strategies[index],
                                                                            parameters: { ...strategies[index].parameters, percentage: value as number }
                                                                        };
                                                                        setFlag({ ...flag, strategies });
                                                                    }}
                                                                    disabled={!canManage}
                                                                    valueLabelDisplay="auto"
                                                                    marks={[
                                                                        { value: 0, label: '0%' },
                                                                        { value: 25, label: '25%' },
                                                                        { value: 50, label: '50%' },
                                                                        { value: 75, label: '75%' },
                                                                        { value: 100, label: '100%' },
                                                                    ]}
                                                                />
                                                            </Box>
                                                            <TextField
                                                                size="small"
                                                                type="number"
                                                                value={strategy.parameters?.percentage || 0}
                                                                onChange={(e) => {
                                                                    const value = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                                                    const strategies = [...(flag.strategies || [])];
                                                                    strategies[index] = {
                                                                        ...strategies[index],
                                                                        parameters: { ...strategies[index].parameters, percentage: value }
                                                                    };
                                                                    setFlag({ ...flag, strategies });
                                                                }}
                                                                disabled={!canManage}
                                                                InputProps={{
                                                                    endAdornment: <Typography>%</Typography>,
                                                                    inputProps: { min: 0, max: 100 }
                                                                }}
                                                                sx={{ width: 100 }}
                                                            />
                                                        </Box>
                                                        <TextField
                                                            fullWidth
                                                            size="small"
                                                            label={t('featureFlags.groupId')}
                                                            value={strategy.parameters?.groupId || flag.flagName || ''}
                                                            onChange={(e) => {
                                                                const strategies = [...(flag.strategies || [])];
                                                                strategies[index] = {
                                                                    ...strategies[index],
                                                                    parameters: { ...strategies[index].parameters, groupId: e.target.value }
                                                                };
                                                                setFlag({ ...flag, strategies });
                                                            }}
                                                            disabled={!canManage}
                                                        />
                                                    </Box>
                                                )}

                                                {/* Flexible Rollout Parameters - Unleash Style */}
                                                {strategy.name === 'flexibleRollout' && (
                                                    <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                                                        {/* Rollout Section */}
                                                        <Typography variant="subtitle2" gutterBottom>
                                                            {t('featureFlags.rolloutPercentage')}
                                                        </Typography>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                                                            <Box sx={{ flex: 1, pr: 3 }}>
                                                                <Slider
                                                                    value={strategy.parameters?.rollout || 0}
                                                                    onChange={(_, value) => {
                                                                        const strategies = [...(flag.strategies || [])];
                                                                        strategies[index] = {
                                                                            ...strategies[index],
                                                                            parameters: { ...strategies[index].parameters, rollout: value as number }
                                                                        };
                                                                        setFlag({ ...flag, strategies });
                                                                    }}
                                                                    disabled={!canManage}
                                                                    valueLabelDisplay="auto"
                                                                    marks={[
                                                                        { value: 0, label: '0%' },
                                                                        { value: 25, label: '25%' },
                                                                        { value: 50, label: '50%' },
                                                                        { value: 75, label: '75%' },
                                                                        { value: 100, label: '100%' },
                                                                    ]}
                                                                />
                                                            </Box>
                                                            <TextField
                                                                size="small"
                                                                type="number"
                                                                value={strategy.parameters?.rollout || 0}
                                                                onChange={(e) => {
                                                                    const value = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                                                    const strategies = [...(flag.strategies || [])];
                                                                    strategies[index] = {
                                                                        ...strategies[index],
                                                                        parameters: { ...strategies[index].parameters, rollout: value }
                                                                    };
                                                                    setFlag({ ...flag, strategies });
                                                                }}
                                                                disabled={!canManage}
                                                                InputProps={{
                                                                    endAdornment: <Typography>%</Typography>,
                                                                    inputProps: { min: 0, max: 100 }
                                                                }}
                                                                sx={{ width: 100 }}
                                                            />
                                                        </Box>

                                                        {/* Stickiness + groupId Row */}
                                                        <Box sx={{ display: 'flex', gap: 2 }}>
                                                            <FormControl size="small" sx={{ flex: 1 }}>
                                                                <InputLabel>{t('featureFlags.stickiness')}</InputLabel>
                                                                <Select
                                                                    value={strategy.parameters?.stickiness || 'default'}
                                                                    label={t('featureFlags.stickiness')}
                                                                    onChange={(e) => {
                                                                        const strategies = [...(flag.strategies || [])];
                                                                        strategies[index] = {
                                                                            ...strategies[index],
                                                                            parameters: { ...strategies[index].parameters, stickiness: e.target.value }
                                                                        };
                                                                        setFlag({ ...flag, strategies });
                                                                    }}
                                                                    disabled={!canManage}
                                                                >
                                                                    <MenuItem value="default">
                                                                        <Box>
                                                                            <Typography variant="body2">Default</Typography>
                                                                            <Typography variant="caption" color="text.secondary">
                                                                                {t('featureFlags.stickinessDefaultHelp')}
                                                                            </Typography>
                                                                        </Box>
                                                                    </MenuItem>
                                                                    <MenuItem value="userId">User ID</MenuItem>
                                                                    <MenuItem value="sessionId">Session ID</MenuItem>
                                                                    <MenuItem value="random">Random</MenuItem>
                                                                </Select>
                                                            </FormControl>
                                                            <TextField
                                                                size="small"
                                                                label={t('featureFlags.groupId')}
                                                                value={strategy.parameters?.groupId || flag.flagName || ''}
                                                                onChange={(e) => {
                                                                    const strategies = [...(flag.strategies || [])];
                                                                    strategies[index] = {
                                                                        ...strategies[index],
                                                                        parameters: { ...strategies[index].parameters, groupId: e.target.value }
                                                                    };
                                                                    setFlag({ ...flag, strategies });
                                                                }}
                                                                disabled={!canManage}
                                                                placeholder="feature-flag-1"
                                                                sx={{ flex: 1 }}
                                                            />
                                                        </Box>
                                                    </Box>
                                                )}

                                                {/* IP Address Parameters */}
                                                {strategy.name === 'remoteAddress' && (
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        multiline
                                                        rows={2}
                                                        label={t('featureFlags.ipAddresses')}
                                                        value={strategy.parameters?.IPs || ''}
                                                        onChange={(e) => {
                                                            const strategies = [...(flag.strategies || [])];
                                                            strategies[index] = {
                                                                ...strategies[index],
                                                                parameters: { ...strategies[index].parameters, IPs: e.target.value }
                                                            };
                                                            setFlag({ ...flag, strategies });
                                                        }}
                                                        disabled={!canManage}
                                                        helperText={t('featureFlags.ipAddressesHelp')}
                                                    />
                                                )}

                                                {/* Hostname Parameters */}
                                                {strategy.name === 'applicationHostname' && (
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        multiline
                                                        rows={2}
                                                        label={t('featureFlags.hostnames')}
                                                        value={strategy.parameters?.hostNames || ''}
                                                        onChange={(e) => {
                                                            const strategies = [...(flag.strategies || [])];
                                                            strategies[index] = {
                                                                ...strategies[index],
                                                                parameters: { ...strategies[index].parameters, hostNames: e.target.value }
                                                            };
                                                            setFlag({ ...flag, strategies });
                                                        }}
                                                        disabled={!canManage}
                                                        helperText={t('featureFlags.hostnamesHelp')}
                                                    />
                                                )}

                                                {/* Segment & Constraints Section - separated from strategy params */}
                                                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
                                                    {/* Segment Selector */}
                                                    <Box sx={{ mb: 2 }}>
                                                        <Typography variant="subtitle2" gutterBottom>{t('featureFlags.segments')}</Typography>
                                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                                            {t('featureFlags.segmentSelectorHelp')}
                                                        </Typography>

                                                        {/* Selected Segments + Add Selector in a row */}
                                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'flex-start' }}>
                                                            {(strategy.segments || []).map((segName: string) => {
                                                                const seg = segments.find((s: any) => s.segmentName === segName);
                                                                const isExpanded = expandedSegments.has(`${index}-${segName}`);
                                                                const isEmpty = !seg?.constraints || seg.constraints.length === 0;

                                                                // Format operator for display - universal symbols
                                                                const getOperatorLabel = (op: string): string => {
                                                                    const opLabels: Record<string, string> = {
                                                                        'str_eq': '=',
                                                                        'str_neq': '≠',
                                                                        'str_contains': 'contains',
                                                                        'str_starts_with': 'starts with',
                                                                        'str_ends_with': 'ends with',
                                                                        'str_in': 'is one of',
                                                                        'str_not_in': 'is not one of',
                                                                        'num_eq': '=',
                                                                        'num_gt': '>',
                                                                        'num_gte': '≥',
                                                                        'num_lt': '<',
                                                                        'num_lte': '≤',
                                                                        'bool_is': '=',
                                                                        'date_gt': '>',
                                                                        'date_gte': '≥',
                                                                        'date_lt': '<',
                                                                        'date_lte': '≤',
                                                                        'semver_eq': '=',
                                                                        'semver_gt': '>',
                                                                        'semver_gte': '≥',
                                                                        'semver_lt': '<',
                                                                        'semver_lte': '≤',
                                                                    };
                                                                    return opLabels[op] || op;
                                                                };

                                                                // Get constraint value display
                                                                const getValueDisplay = (c: any): string => {
                                                                    if (c.values && c.values.length > 0) {
                                                                        return c.values.join(', ');
                                                                    }
                                                                    if (c.value !== undefined && c.value !== null) {
                                                                        if (typeof c.value === 'boolean') {
                                                                            return c.value ? 'True' : 'False';
                                                                        }
                                                                        return String(c.value);
                                                                    }
                                                                    return '-';
                                                                };

                                                                return (
                                                                    <Box key={segName} sx={{ maxWidth: isExpanded ? 500 : 'auto' }}>
                                                                        <Chip
                                                                            label={
                                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                                    <GroupIcon sx={{ fontSize: 14 }} />
                                                                                    <span>{seg?.displayName || segName}</span>
                                                                                    <IconButton
                                                                                        size="small"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            const key = `${index}-${segName}`;
                                                                                            setExpandedSegments(prev => {
                                                                                                const next = new Set(prev);
                                                                                                if (next.has(key)) next.delete(key);
                                                                                                else next.add(key);
                                                                                                return next;
                                                                                            });
                                                                                        }}
                                                                                        sx={{ p: 0, ml: 0.5, color: 'inherit' }}
                                                                                    >
                                                                                        {isExpanded ? <VisibilityOffIcon sx={{ fontSize: 14 }} /> : <VisibilityIcon sx={{ fontSize: 14 }} />}
                                                                                    </IconButton>
                                                                                </Box>
                                                                            }
                                                                            size="small"
                                                                            color={isEmpty ? 'warning' : 'default'}
                                                                            variant="outlined"
                                                                            onDelete={canManage ? () => {
                                                                                const strategies = [...(flag.strategies || [])];
                                                                                strategies[index] = {
                                                                                    ...strategies[index],
                                                                                    segments: (strategy.segments || []).filter((s: string) => s !== segName)
                                                                                };
                                                                                setFlag({ ...flag, strategies });
                                                                            } : undefined}
                                                                            sx={{
                                                                                borderWidth: isEmpty ? 2 : 1,
                                                                                '& .MuiChip-label': { pr: 0.5 }
                                                                            }}
                                                                        />

                                                                        {/* Expanded segment details */}
                                                                        {isExpanded && seg && (
                                                                            <Paper
                                                                                sx={{
                                                                                    mt: 1,
                                                                                    p: 2,
                                                                                    bgcolor: 'background.default',
                                                                                    border: 1,
                                                                                    borderColor: isEmpty ? 'warning.main' : 'divider',
                                                                                    borderRadius: 1
                                                                                }}
                                                                                elevation={0}
                                                                            >
                                                                                {isEmpty ? (
                                                                                    <Alert severity="warning" icon={<WarningIcon />}>
                                                                                        <Typography variant="body2">
                                                                                            {t('featureFlags.emptySegmentWarning', { name: seg.displayName || segName })}
                                                                                        </Typography>
                                                                                    </Alert>
                                                                                ) : (
                                                                                    <Box>
                                                                                        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                                                                                            📋 {t('featureFlags.segmentConditions')}
                                                                                        </Typography>
                                                                                        <Stack spacing={1}>
                                                                                            {seg.constraints.map((c: any, ci: number) => (
                                                                                                <React.Fragment key={ci}>
                                                                                                    {ci > 0 && (
                                                                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                                                                                                            <Divider sx={{ flexGrow: 1 }} />
                                                                                                            <Chip
                                                                                                                label="AND"
                                                                                                                size="small"
                                                                                                                sx={{
                                                                                                                    height: 22,
                                                                                                                    fontSize: '0.7rem',
                                                                                                                    bgcolor: 'action.selected',
                                                                                                                    fontWeight: 600
                                                                                                                }}
                                                                                                            />
                                                                                                            <Divider sx={{ flexGrow: 1 }} />
                                                                                                        </Box>
                                                                                                    )}
                                                                                                    {/* Unleash-style constraint row */}
                                                                                                    <Box
                                                                                                        sx={{
                                                                                                            display: 'flex',
                                                                                                            alignItems: 'center',
                                                                                                            gap: 1,
                                                                                                            p: 1,
                                                                                                            border: 1,
                                                                                                            borderColor: 'primary.main',
                                                                                                            borderRadius: 1,
                                                                                                            bgcolor: 'background.paper'
                                                                                                        }}
                                                                                                    >
                                                                                                        {/* Field Name */}
                                                                                                        <Box
                                                                                                            sx={{
                                                                                                                px: 1.5,
                                                                                                                py: 0.5,
                                                                                                                bgcolor: 'primary.main',
                                                                                                                color: 'primary.contrastText',
                                                                                                                borderRadius: 0.5
                                                                                                            }}
                                                                                                        >
                                                                                                            <Typography variant="body2" fontWeight={600}>
                                                                                                                {c.contextName}
                                                                                                            </Typography>
                                                                                                        </Box>

                                                                                                        {/* Operator Chip */}
                                                                                                        <Chip
                                                                                                            label={getOperatorLabel(c.operator)}
                                                                                                            size="small"
                                                                                                            variant="outlined"
                                                                                                            sx={{ fontWeight: 500, fontSize: '0.75rem' }}
                                                                                                        />

                                                                                                        {/* Case sensitivity indicator for string operators */}
                                                                                                        {c.operator?.startsWith('str_') && (
                                                                                                            <Chip
                                                                                                                label={c.caseInsensitive ? 'Aa' : 'AA'}
                                                                                                                size="small"
                                                                                                                variant="outlined"
                                                                                                                sx={{
                                                                                                                    height: 22,
                                                                                                                    fontSize: '0.7rem',
                                                                                                                    minWidth: 32
                                                                                                                }}
                                                                                                            />
                                                                                                        )}

                                                                                                        {/* Value */}
                                                                                                        <Box
                                                                                                            sx={{
                                                                                                                px: 1.5,
                                                                                                                py: 0.5,
                                                                                                                bgcolor: 'primary.main',
                                                                                                                color: 'primary.contrastText',
                                                                                                                borderRadius: 0.5
                                                                                                            }}
                                                                                                        >
                                                                                                            <Typography variant="body2" fontWeight={600}>
                                                                                                                {getValueDisplay(c)}
                                                                                                            </Typography>
                                                                                                        </Box>
                                                                                                    </Box>
                                                                                                </React.Fragment>
                                                                                            ))}
                                                                                        </Stack>
                                                                                    </Box>
                                                                                )}
                                                                            </Paper>
                                                                        )}
                                                                    </Box>
                                                                );
                                                            })}

                                                            {/* Add segment selector - inline with chips */}
                                                            <Autocomplete
                                                                size="small"
                                                                sx={{ minWidth: 200, flexShrink: 0 }}
                                                                options={segments.filter((s: any) => !(strategy.segments || []).includes(s.segmentName))}
                                                                getOptionLabel={(option: any) => option.displayName || option.segmentName}
                                                                value={null}
                                                                onChange={(_, selected) => {
                                                                    if (selected) {
                                                                        const strategies = [...(flag.strategies || [])];
                                                                        strategies[index] = {
                                                                            ...strategies[index],
                                                                            segments: [...(strategy.segments || []), selected.segmentName]
                                                                        };
                                                                        setFlag({ ...flag, strategies });
                                                                    }
                                                                }}
                                                                renderInput={(params) => (
                                                                    <TextField {...params} placeholder={t('featureFlags.selectSegments')} size="small" />
                                                                )}
                                                                disabled={!canManage || segments.length === 0}
                                                                noOptionsText={t('featureFlags.noSegments')}
                                                                clearOnBlur
                                                                blurOnSelect
                                                            />
                                                        </Box>
                                                    </Box>

                                                    {/* AND Indicator between segments and constraints */}
                                                    {(strategy.segments?.length > 0 || (strategy.constraints?.length > 0)) && (
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                                                            <Divider sx={{ flexGrow: 1 }} />
                                                            <Chip label="AND" size="small" variant="outlined" sx={{ fontWeight: 600 }} />
                                                            <Divider sx={{ flexGrow: 1 }} />
                                                        </Box>
                                                    )}

                                                    {/* Constraints - AFTER segments */}
                                                    <Box>
                                                        <Typography variant="subtitle2" gutterBottom>{t('featureFlags.constraints')}</Typography>
                                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                                            {t('featureFlags.constraintsHelp')}
                                                        </Typography>
                                                        <ConstraintEditor
                                                            constraints={strategy.constraints || []}
                                                            onChange={(constraints) => {
                                                                const strategies = [...(flag.strategies || [])];
                                                                strategies[index] = { ...strategies[index], constraints };
                                                                setFlag({ ...flag, strategies });
                                                            }}
                                                            contextFields={contextFields}
                                                            disabled={!canManage}
                                                        />
                                                    </Box>
                                                </Paper>

                                                {/* Delete Button - only show if there are 2+ strategies */}
                                                {canManage && (flag.strategies?.length || 0) > 1 && (
                                                    <Box>
                                                        <Button
                                                            size="small"
                                                            color="error"
                                                            startIcon={<DeleteIcon />}
                                                            onClick={() => handleDeleteStrategy(strategy.id, index)}
                                                        >
                                                            {t('featureFlags.removeStrategy')}
                                                        </Button>
                                                    </Box>
                                                )}
                                            </Stack>
                                        </AccordionDetails>
                                    </Accordion>
                                </React.Fragment>
                            ))}

                            {/* Add Strategy Button */}
                            {canManage && (
                                <Button
                                    variant="outlined"
                                    startIcon={<AddIcon />}
                                    onClick={() => {
                                        const newStrategy = {
                                            id: undefined,
                                            name: 'flexibleRollout',
                                            title: 'Flexible Rollout',
                                            parameters: { rollout: 100, stickiness: 'default', groupId: '' },
                                            constraints: [],
                                            segments: [],
                                            sortOrder: (flag?.strategies?.length || 0),
                                            disabled: false,
                                        };
                                        setFlag({ ...flag, strategies: [...(flag.strategies || []), newStrategy] });
                                    }}
                                    sx={{ alignSelf: 'flex-start' }}
                                >
                                    {t('featureFlags.addStrategy')}
                                </Button>
                            )}

                            {/* Save Button */}
                            {canManage && (flag.strategies?.length || 0) > 0 && !isCreating && (
                                <Box sx={{ mt: 2 }}>
                                    <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSaveStrategies} disabled={!hasStrategyChanges()}>
                                        {t('featureFlags.saveStrategies')}
                                    </Button>
                                </Box>
                            )}
                        </Stack>
                    </CardContent>
                </TabPanel>

                {/* Variants Tab */}
                <TabPanel value={tabValue} index={2}>
                    <CardContent>
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="h6">{t('featureFlags.variants')}</Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('featureFlags.variantsDescription')}
                            </Typography>
                        </Box>

                        {/* Variant Type Selector - applies to ALL variants */}
                        <Box sx={{ mb: 3 }}>
                            <FormControl size="small" sx={{ minWidth: 200 }}>
                                <InputLabel>{t('featureFlags.variantType')}</InputLabel>
                                <Select
                                    value={flag.variantType || 'string'}
                                    onChange={(e) => setFlag({ ...flag, variantType: e.target.value as FeatureFlag['variantType'] })}
                                    label={t('featureFlags.variantType')}
                                    disabled={!canManage}
                                    renderValue={(selected) => {
                                        const getIcon = () => {
                                            switch (selected) {
                                                case 'string': return <StringTypeIcon sx={{ fontSize: 18, color: 'info.main', mr: 1 }} />;
                                                case 'number': return <NumberTypeIcon sx={{ fontSize: 18, color: 'success.main', mr: 1 }} />;
                                                case 'json': return <JsonTypeIcon sx={{ fontSize: 18, color: 'warning.main', mr: 1 }} />;
                                                default: return <StringTypeIcon sx={{ fontSize: 18, color: 'text.disabled', mr: 1 }} />;
                                            }
                                        };
                                        return (
                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                {getIcon()}
                                                {t(`featureFlags.variantTypes.${selected}`)}
                                            </Box>
                                        );
                                    }}
                                >
                                    <MenuItem value="string" sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                                        <StringTypeIcon sx={{ fontSize: 18, color: 'info.main' }} />
                                        {t('featureFlags.variantTypes.string')}
                                    </MenuItem>
                                    <MenuItem value="number" sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                                        <NumberTypeIcon sx={{ fontSize: 18, color: 'success.main' }} />
                                        {t('featureFlags.variantTypes.number')}
                                    </MenuItem>
                                    <MenuItem value="json" sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                                        <JsonTypeIcon sx={{ fontSize: 18, color: 'warning.main' }} />
                                        {t('featureFlags.variantTypes.json')}
                                    </MenuItem>
                                </Select>
                                <FormHelperText>{t('featureFlags.variantTypeHelp')}</FormHelperText>
                            </FormControl>
                        </Box>

                        {/* Weight Distribution Info */}
                        {(flag.variants?.length || 0) > 1 && (() => {
                            const variants = flag.variants || [];
                            const lockedVariants = variants.filter(v => v.weightLock === true);
                            const totalLocked = lockedVariants.reduce((sum, v) => sum + (v.weight || 0), 0);
                            const remaining = Math.max(0, 100 - totalLocked);
                            const autoCount = variants.length - lockedVariants.length;
                            return (
                                <Alert severity="info" sx={{ mb: 2 }}>
                                    {t('featureFlags.weightDistribution', {
                                        fixed: totalLocked,
                                        remaining: remaining,
                                        autoCount: autoCount
                                    })}
                                </Alert>
                            );
                        })()}
                        {/* Inline Variants Editor */}
                        <Stack spacing={2}>
                            {(flag.variants || []).map((variant, index) => {
                                // Color palette for variant tips
                                const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#06b6d4', '#3b82f6', '#f59e0b'];
                                const tipColor = colors[index % colors.length];

                                return (
                                    <Paper
                                        key={index}
                                        variant="outlined"
                                        sx={{
                                            p: 0,
                                            overflow: 'hidden',
                                            display: 'flex',
                                        }}
                                    >
                                        {/* Left color tip */}
                                        <Box sx={{ width: 6, bgcolor: tipColor, flexShrink: 0 }} />

                                        {/* Content */}
                                        <Box sx={{ flex: 1, p: 2.5 }}>
                                            {/* Row 1: Header - Label left, Delete right */}
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                                                {/* Left: Label + Help */}
                                                <Box>
                                                    <Typography variant="subtitle2" fontWeight={600}>
                                                        {t('featureFlags.variantName')}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {t('featureFlags.variantNameHelp')}
                                                    </Typography>
                                                </Box>

                                                {/* Right: Delete only */}
                                                {canManage && (
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleDeleteVariant(variant.name)}
                                                        sx={{ color: 'text.secondary' }}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                )}
                                            </Box>

                                            {/* Row 2: Name input + Switch + Weight input */}
                                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                                                <TextField
                                                    size="small"
                                                    value={variant.name || ''}
                                                    onChange={(e) => {
                                                        const variants = [...(flag.variants || [])];
                                                        variants[index] = { ...variants[index], name: e.target.value };
                                                        setFlag({ ...flag, variants });
                                                    }}
                                                    disabled={!canManage}
                                                    sx={{ flex: 1 }}
                                                    placeholder={`variant-${index + 1}`}
                                                />
                                                {(flag.variants?.length || 0) > 1 && (
                                                    <>
                                                        <FormControlLabel
                                                            control={
                                                                <Switch
                                                                    size="small"
                                                                    checked={variant.weightLock || false}
                                                                    onChange={(e) => {
                                                                        const variants = [...(flag.variants || [])];
                                                                        variants[index] = { ...variants[index], weightLock: e.target.checked };
                                                                        distributeVariantWeights(variants);
                                                                        setFlag({ ...flag, variants });
                                                                    }}
                                                                    disabled={!canManage}
                                                                />
                                                            }
                                                            label={<Typography variant="body2">{t('featureFlags.customWeight')}</Typography>}
                                                            labelPlacement="start"
                                                            sx={{ ml: 0, mr: 0 }}
                                                        />
                                                        <TextField
                                                            size="small"
                                                            type="number"
                                                            label={t('featureFlags.variantWeight')}
                                                            value={variant.weight || 0}
                                                            onChange={(e) => {
                                                                const value = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                                                const variants = [...(flag.variants || [])];
                                                                variants[index] = { ...variants[index], weight: value };
                                                                distributeVariantWeights(variants);
                                                                setFlag({ ...flag, variants });
                                                            }}
                                                            disabled={!canManage || !variant.weightLock}
                                                            InputProps={{
                                                                endAdornment: <Typography variant="body2">%</Typography>,
                                                                inputProps: { min: 0, max: 100 }
                                                            }}
                                                            sx={{ width: 130 }}
                                                        />
                                                    </>
                                                )}
                                            </Box>

                                            {/* Row 3: Payload */}
                                            <Box sx={{ mt: 2 }}>
                                                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                                                    {t('featureFlags.payload')}
                                                </Typography>
                                                {(flag.variantType || 'string') === 'number' ? (
                                                    <TextField
                                                        size="small"
                                                        type="number"
                                                        value={variant.payload?.value || ''}
                                                        onChange={(e) => {
                                                            const variants = [...(flag.variants || [])];
                                                            variants[index] = {
                                                                ...variants[index],
                                                                payload: { type: 'string', value: e.target.value }
                                                            };
                                                            setFlag({ ...flag, variants });
                                                        }}
                                                        disabled={!canManage}
                                                        fullWidth
                                                        placeholder="0"
                                                        helperText={t('featureFlags.payloadHelp')}
                                                    />
                                                ) : (flag.variantType || 'string') === 'json' ? (
                                                    <TextField
                                                        size="small"
                                                        multiline
                                                        rows={3}
                                                        value={variant.payload?.value || ''}
                                                        onChange={(e) => {
                                                            const variants = [...(flag.variants || [])];
                                                            variants[index] = {
                                                                ...variants[index],
                                                                payload: { type: 'json', value: e.target.value }
                                                            };
                                                            setFlag({ ...flag, variants });
                                                        }}
                                                        disabled={!canManage}
                                                        fullWidth
                                                        placeholder='{"key": "value"}'
                                                        sx={{ fontFamily: 'monospace' }}
                                                        InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.875rem' } }}
                                                        helperText={t('featureFlags.payloadHelp')}
                                                    />
                                                ) : (
                                                    <TextField
                                                        size="small"
                                                        value={variant.payload?.value || ''}
                                                        onChange={(e) => {
                                                            const variants = [...(flag.variants || [])];
                                                            variants[index] = {
                                                                ...variants[index],
                                                                payload: { type: 'string', value: e.target.value }
                                                            };
                                                            setFlag({ ...flag, variants });
                                                        }}
                                                        disabled={!canManage}
                                                        fullWidth
                                                        placeholder={t('featureFlags.payloadPlaceholder')}
                                                        helperText={t('featureFlags.payloadHelp')}
                                                    />
                                                )}
                                            </Box>
                                        </Box>
                                    </Paper>
                                );
                            })}

                            {/* Add Variant Button */}
                            {canManage && (
                                <Button
                                    variant="outlined"
                                    startIcon={<AddIcon />}
                                    onClick={() => {
                                        const variantType = flag.variantType || 'string';
                                        const defaultValue = variantType === 'number' ? '0' : '';
                                        const newVariant: Variant = {
                                            name: `variant-${(flag.variants?.length || 0) + 1}`,
                                            weight: 0,
                                            weightLock: false,
                                            payload: { type: variantType === 'json' ? 'json' : 'string', value: defaultValue },
                                            stickiness: 'default',
                                        };
                                        const updatedVariants = [...(flag.variants || []), newVariant];
                                        distributeVariantWeights(updatedVariants);
                                        setFlag({ ...flag, variants: updatedVariants });
                                    }}
                                    sx={{ alignSelf: 'flex-start' }}
                                >
                                    {t('featureFlags.addVariant')}
                                </Button>
                            )}

                            {/* Weight Distribution Bar */}
                            {(flag.variants?.length || 0) > 1 && (
                                <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {t('featureFlags.flagVariants')} ({flag.variants?.length})
                                    </Typography>
                                    <Box sx={{ display: 'flex', width: '100%', height: 24, overflow: 'hidden' }}>
                                        {(flag.variants || []).map((variant, index) => {
                                            const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#06b6d4', '#3b82f6', '#f59e0b'];
                                            const barColor = colors[index % colors.length];
                                            const weight = variant.weight || 0;

                                            if (weight === 0) return null;

                                            return (
                                                <Tooltip
                                                    key={index}
                                                    title={`${variant.name}: ${weight}%`}
                                                    arrow
                                                >
                                                    <Box
                                                        sx={{
                                                            width: `${weight}%`,
                                                            bgcolor: barColor,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: 'white',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 500,
                                                            cursor: 'pointer',
                                                            transition: 'opacity 0.2s',
                                                            '&:hover': { opacity: 0.8 },
                                                            borderRight: index < (flag.variants?.length || 0) - 1 ? '1px solid rgba(255,255,255,0.3)' : 'none',
                                                        }}
                                                    >
                                                        {weight >= 10 ? `${weight}%` : ''}
                                                    </Box>
                                                </Tooltip>
                                            );
                                        })}
                                    </Box>
                                </Paper>
                            )}
                            {/* Save Button */}
                            {canManage && (flag.variants?.length || 0) > 0 && !isCreating && (
                                <Box sx={{ mt: 2 }}>
                                    <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSaveVariants}>
                                        {t('featureFlags.saveVariants')}
                                    </Button>
                                </Box>
                            )}
                        </Stack>
                    </CardContent>
                </TabPanel>

                {/* Metrics Tab */}
                <TabPanel value={tabValue} index={3}>
                    <CardContent>
                        <Alert severity="info">{t('featureFlags.metricsComingSoon')}</Alert>
                    </CardContent>
                </TabPanel>
            </Card >

            {/* Delete Confirmation Dialog */}
            < ConfirmDeleteDialog
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
                title={editingStrategy?.id ? t('featureFlags.editStrategy') : t('featureFlags.addStrategy')}
                subtitle={t('featureFlags.strategiesDescription')}
                storageKey="featureFlagStrategyDrawerWidth"
                defaultWidth={600}
            >
                <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
                    <Stack spacing={3}>
                        <FormControl fullWidth>
                            <InputLabel>{t('featureFlags.strategyType')}</InputLabel>
                            <Select
                                value={editingStrategy?.name || 'default'}
                                onChange={(e) => {
                                    const strategyType = STRATEGY_TYPES.find(s => s.name === e.target.value);
                                    setEditingStrategy({
                                        ...editingStrategy!,
                                        name: e.target.value,
                                        title: strategyType?.title || e.target.value,
                                    });
                                }}
                                label={t('featureFlags.strategyType')}
                            >
                                {STRATEGY_TYPES.map((s) => (
                                    <MenuItem key={s.name} value={s.name}>
                                        <Box>
                                            <Typography>{s.title}</Typography>
                                            <Typography variant="caption" color="text.secondary">{s.description}</Typography>
                                        </Box>
                                    </MenuItem>
                                ))}
                            </Select>
                            <FormHelperText>{t('featureFlags.strategyTypeHelp')}</FormHelperText>
                        </FormControl>

                        {/* Strategy-specific parameters */}
                        {editingStrategy?.name === 'gradualRolloutRandom' && (
                            <Box>
                                <Typography gutterBottom>{t('featureFlags.rolloutPercentage')}</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Slider
                                        value={editingStrategy.parameters?.percentage || 0}
                                        onChange={(_, value) => setEditingStrategy({
                                            ...editingStrategy,
                                            parameters: { ...editingStrategy.parameters, percentage: value as number }
                                        })}
                                        valueLabelDisplay="auto"
                                    />
                                    <Typography sx={{ width: 50 }}>{editingStrategy.parameters?.percentage || 0}%</Typography>
                                </Box>
                                <Typography variant="caption" color="text.secondary">{t('featureFlags.rolloutPercentageHelp')}</Typography>
                            </Box>
                        )}

                        {editingStrategy?.name === 'userWithId' && (
                            <TextField
                                fullWidth
                                multiline
                                rows={3}
                                label={t('featureFlags.userIds')}
                                value={editingStrategy.parameters?.userIds || ''}
                                onChange={(e) => setEditingStrategy({
                                    ...editingStrategy,
                                    parameters: { ...editingStrategy.parameters, userIds: e.target.value }
                                })}
                                helperText={t('featureFlags.userIdsHelp')}
                            />
                        )}

                        {/* Constraints */}
                        <Divider />
                        <Box>
                            <Typography variant="subtitle2" gutterBottom>{t('featureFlags.constraints')}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                                {t('featureFlags.constraintsHelp')}
                            </Typography>
                            <ConstraintEditor
                                constraints={editingStrategy?.constraints || []}
                                onChange={(constraints) => setEditingStrategy({
                                    ...editingStrategy!,
                                    constraints
                                })}
                                contextFields={contextFields}
                            />
                        </Box>
                    </Stack>
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
                title={editingVariant?.name ? t('featureFlags.editVariant') : t('featureFlags.addVariant')}
                subtitle={t('featureFlags.variantsDescription')}
                storageKey="featureFlagVariantDrawerWidth"
                defaultWidth={500}
            >
                <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label={t('featureFlags.variantName')}
                                value={editingVariant?.name || ''}
                                onChange={(e) => setEditingVariant({ ...editingVariant!, name: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Typography gutterBottom>{t('featureFlags.weight')}</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Slider
                                    value={editingVariant?.weight || 50}
                                    onChange={(_, value) => setEditingVariant({ ...editingVariant!, weight: value as number })}
                                    valueLabelDisplay="auto"
                                />
                                <Typography sx={{ width: 50 }}>{editingVariant?.weight || 50}%</Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={12}>
                            <FormControl fullWidth>
                                <InputLabel>{t('featureFlags.stickiness')}</InputLabel>
                                <Select
                                    value={editingVariant?.stickiness || 'userId'}
                                    onChange={(e) => setEditingVariant({ ...editingVariant!, stickiness: e.target.value })}
                                    label={t('featureFlags.stickiness')}
                                >
                                    <MenuItem value="userId">User ID</MenuItem>
                                    <MenuItem value="sessionId">Session ID</MenuItem>
                                    <MenuItem value="random">Random</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </Box>
                <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                    <Button onClick={() => setVariantDialogOpen(false)}>{t('common.cancel')}</Button>
                    <Button variant="contained" onClick={handleSaveVariants}>{t('common.save')}</Button>
                </Box>
            </ResizableDrawer>
        </Box >
    );
};

export default FeatureFlagDetailPage;
