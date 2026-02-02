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
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Collapse,
    useTheme,
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
    HelpOutline as HelpOutlineIcon,
    KeyboardArrowDown as KeyboardArrowDownIcon,
    KeyboardArrowUp as KeyboardArrowUpIcon,
    Link as LinkIcon,
    Abc as StringIcon,
    Numbers as NumberIcon,
    DataObject as JsonIcon,
    RocketLaunch as ReleaseIcon,
    Science as ExperimentIcon,
    Build as OperationalIcon,
    Security as PermissionIcon,
    PowerOff as KillSwitchIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSIONS } from '../../types/permissions';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { parseApiErrorMessage } from '../../utils/errorUtils';
import api from '../../services/api';
import ConfirmDeleteDialog from '../../components/common/ConfirmDeleteDialog';
import ConstraintEditor, { Constraint, ContextField } from '../../components/features/ConstraintEditor';
import { ConstraintList, ConstraintDisplay, ConstraintValue } from '../../components/features/ConstraintDisplay';
import { formatDateTimeDetailed, formatRelativeTime } from '../../utils/dateFormat';
import { copyToClipboardWithNotification } from '../../utils/clipboard';
import ResizableDrawer from '../../components/common/ResizableDrawer';
import { tagService, Tag } from '../../services/tagService';
import { getContrastColor } from '../../utils/colorUtils';
import JsonEditor from '../../components/common/JsonEditor';
import EmptyState from '../../components/common/EmptyState';
import { environmentService, Environment } from '../../services/environmentService';
import FeatureSwitch from '../../components/common/FeatureSwitch';
import FeatureFlagMetrics from '../../components/features/FeatureFlagMetrics';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ==================== Types ====================

interface Strategy {
    id: string;
    name: string;
    title: string;
    parameters: Record<string, any>;
    constraints: Constraint[];
    segments?: string[];
    variants?: Variant[];
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

interface FlagLink {
    url: string;
    title?: string;
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
    links?: FlagLink[];
    strategies?: Strategy[];
    variants?: Variant[]
    variantType?: 'string' | 'json' | 'number';
    environments?: FeatureFlagEnvironment[];
    lastSeenAt?: string;
    archivedAt?: string;
    createdBy?: number;
    createdByName?: string;
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
    { value: 'release', labelKey: 'featureFlags.types.release', descKey: 'featureFlags.flagTypes.release.desc' },
    { value: 'experiment', labelKey: 'featureFlags.types.experiment', descKey: 'featureFlags.flagTypes.experiment.desc' },
    { value: 'operational', labelKey: 'featureFlags.types.operational', descKey: 'featureFlags.flagTypes.operational.desc' },
    { value: 'killSwitch', labelKey: 'featureFlags.types.killSwitch', descKey: 'featureFlags.flagTypes.killSwitch.desc' },
    { value: 'permission', labelKey: 'featureFlags.types.permission', descKey: 'featureFlags.flagTypes.permission.desc' },
];

// Get icon for flag type
const getTypeIcon = (type: string, size: number = 16) => {
    const iconProps = { sx: { fontSize: size } };
    switch (type) {
        case 'release': return <ReleaseIcon {...iconProps} color="primary" />;
        case 'experiment': return <ExperimentIcon {...iconProps} color="secondary" />;
        case 'operational': return <OperationalIcon {...iconProps} color="warning" />;
        case 'killSwitch': return <KillSwitchIcon {...iconProps} color="error" />;
        case 'permission': return <PermissionIcon {...iconProps} color="action" />;
        default: return null;
    }
};

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

// Sortable wrapper component for strategy items
interface SortableStrategyItemProps {
    id: string;
    children: (props: { dragHandleProps: object | null }) => React.ReactNode;
    isDraggable: boolean;
}

const SortableStrategyItem: React.FC<SortableStrategyItemProps> = ({ id, children, isDraggable }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1 : 0,
        position: 'relative' as const,
    };

    return (
        <div ref={setNodeRef} style={style}>
            {children({ dragHandleProps: isDraggable ? { ...attributes, ...listeners } : null })}
        </div>
    );
};

// ==================== Main Page ====================

const FeatureFlagDetailPage: React.FC = () => {
    const { flagName } = useParams<{ flagName: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { t } = useTranslation();
    const theme = useTheme();
    const { enqueueSnackbar } = useSnackbar();
    const { hasPermission } = useAuth();
    const canManage = hasPermission([PERMISSIONS.FEATURE_FLAGS_MANAGE]);

    const isCreating = flagName === 'new';

    const generateDefaultFlagName = () => {
        const timestamp = Date.now().toString(36).slice(-4);
        return `new-feature-${timestamp}`;
    };

    // Get tab from URL query parameter, default to 0 (overview)
    const tabParam = searchParams.get('tab');
    const tabValue = tabParam === 'metrics' ? 1 : 0;

    const setTabValue = (newValue: number) => {
        const newParams = new URLSearchParams(searchParams);
        if (newValue === 1) {
            newParams.set('tab', 'metrics');
        } else {
            newParams.delete('tab');
        }
        setSearchParams(newParams, { replace: true });
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
        strategies: [],
        variants: [],
        createdAt: new Date().toISOString(),
    } : null);
    const [loading, setLoading] = useState(!isCreating);
    const [saving, setSaving] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [strategyDialogOpen, setStrategyDialogOpen] = useState(false);
    const [strategyTabValue, setStrategyTabValue] = useState(0);
    const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
    const [originalEditingStrategy, setOriginalEditingStrategy] = useState<Strategy | null>(null);
    const [strategyJsonErrors, setStrategyJsonErrors] = useState<Record<number, string | null>>({});
    const [editingEnv, setEditingEnv] = useState<string | null>(null); // Track which environment we're editing strategy for
    const [isAddingStrategy, setIsAddingStrategy] = useState(false); // Explicitly track if we're adding a new strategy
    const [variantDialogOpen, setVariantDialogOpen] = useState(false);
    const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
    const [contextFields, setContextFields] = useState<ContextField[]>([]);
    const [segments, setSegments] = useState<any[]>([]);
    const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set()); // For environment cards
    const [expandedSegmentsDialog, setExpandedSegmentsDialog] = useState<Set<string>>(new Set()); // For strategy editor dialog
    const [expandedConstraints, setExpandedConstraints] = useState<Set<string>>(new Set());
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [originalFlag, setOriginalFlag] = useState<FeatureFlag | null>(null);
    const [jsonPayloadErrors, setJsonPayloadErrors] = useState<Record<number, string | null>>({});
    // Environment-specific strategies - key is environment name, value is array of strategies
    const [envStrategies, setEnvStrategies] = useState<Record<string, Strategy[]>>({});

    // Drag and drop sensors for strategy reordering
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // Environment states
    const [environments, setEnvironments] = useState<Environment[]>([]);
    const [expandedEnvs, setExpandedEnvs] = useState<Set<string>>(new Set());
    const [selectedEnvForEdit, setSelectedEnvForEdit] = useState<string | null>(null);
    const [envSettingsDrawerOpen, setEnvSettingsDrawerOpen] = useState(false);

    // Edit flag dialog states
    const [editFlagDialogOpen, setEditFlagDialogOpen] = useState(false);
    const [editingFlagData, setEditingFlagData] = useState<{
        displayName: string;
        description: string;
        impressionDataEnabled: boolean;
        tags: string[];
    } | null>(null);

    // Link dialog states
    const [linkDialogOpen, setLinkDialogOpen] = useState(false);
    const [editingLink, setEditingLink] = useState<FlagLink>({ url: '', title: '' });
    const [editingLinkIndex, setEditingLinkIndex] = useState<number | null>(null);

    // Environment metrics for summary display in environment cards
    const [envMetrics, setEnvMetrics] = useState<Record<string, { totalYes: number; totalNo: number; total: number }>>({});

    // ==================== Data Loading ====================

    const loadFlag = useCallback(async () => {
        if (isCreating || !flagName) return;
        try {
            setLoading(true);
            const response = await api.get(`/admin/features/${flagName}`);
            // Backend returns { success: true, data: { flag } }
            // api.request() returns response.data, so we get { flag }
            const data = response.data?.flag || response.data;
            // Transform backend strategy format to frontend format
            if (data.strategies) {
                data.strategies = data.strategies.map((s: any) => ({
                    ...s,
                    name: s.strategyName || s.name, // Backend uses strategyName, frontend uses name
                    disabled: s.isEnabled === false,
                }));
            }
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
            // API returns { success: true, data: { contextFields } }
            const contextFieldsData = response.data?.contextFields || response.data?.data?.contextFields || [];
            setContextFields(contextFieldsData);
        } catch {
            setContextFields([]);
        }
    }, []);

    const loadSegments = useCallback(async () => {
        try {
            const response = await api.get('/admin/features/segments');
            // API returns { success: true, data: { segments } }
            const segmentsData = response.data?.segments || response.data?.data?.segments || [];
            setSegments(segmentsData);
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

    // Load metrics summary for each environment (24h period for quick summary)
    const loadEnvMetrics = useCallback(async (targetFlagName: string, envList: Environment[]) => {
        if (!targetFlagName || envList.length === 0) return;

        const metricsMap: Record<string, { totalYes: number; totalNo: number; total: number }> = {};
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours

        for (const env of envList) {
            try {
                const response = await api.get<{ metrics: Array<{ yesCount: number; noCount: number }> }>(
                    `/admin/features/${targetFlagName}/metrics`,
                    {
                        params: {
                            startDate: startDate.toISOString(),
                            endDate: endDate.toISOString(),
                        },
                        headers: {
                            'x-environment': env.environment,
                        },
                    }
                );
                const metrics = response.data?.metrics || [];
                const aggregated = metrics.reduce(
                    (acc, m) => ({
                        totalYes: acc.totalYes + (m.yesCount || 0),
                        totalNo: acc.totalNo + (m.noCount || 0),
                        total: acc.total + (m.yesCount || 0) + (m.noCount || 0),
                    }),
                    { totalYes: 0, totalNo: 0, total: 0 }
                );
                metricsMap[env.environment] = aggregated;
            } catch {
                metricsMap[env.environment] = { totalYes: 0, totalNo: 0, total: 0 };
            }
        }

        setEnvMetrics(metricsMap);
    }, []);

    // Load strategies for all environments
    const loadEnvStrategies = useCallback(async (envList: Environment[], targetFlagName: string) => {
        if (!targetFlagName || envList.length === 0) return;

        const strategiesMap: Record<string, Strategy[]> = {};
        for (const env of envList) {
            try {
                const response = await api.get(`/admin/features/${targetFlagName}`, {
                    headers: { 'x-environment': env.environment }
                });
                const data = response.data?.flag || response.data;

                // Get variants from flag level (they're stored at flag level, not strategy level)
                const flagVariants = (data.variants || []).map((v: any) => ({
                    name: v.variantName || v.name,
                    weight: v.weight,
                    payload: v.payload,
                    stickiness: v.stickiness || 'default',
                    weightLock: v.weightLock || false,
                }));

                const strategies = (data.strategies || []).map((s: any, index: number) => ({
                    ...s,
                    name: s.strategyName || s.name,
                    disabled: s.isEnabled === false,
                    // Attach variants to the first strategy (for UI editing purposes)
                    variants: index === 0 ? flagVariants : [],
                }));
                strategiesMap[env.environment] = strategies;
            } catch {
                strategiesMap[env.environment] = [];
            }
        }

        setEnvStrategies(strategiesMap);
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

    // Load environment-specific strategies after environments and flag are loaded
    useEffect(() => {
        if (!isCreating && flag?.flagName && environments.length > 0) {
            loadEnvStrategies(environments, flag.flagName);
        }
    }, [isCreating, flag?.flagName, environments, loadEnvStrategies]);

    // Load environment metrics for summary display in environment cards
    useEffect(() => {
        if (!isCreating && flag?.flagName && environments.length > 0) {
            loadEnvMetrics(flag.flagName, environments);
        }
    }, [isCreating, flag?.flagName, environments, loadEnvMetrics]);

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

        // Optimistic update - update UI immediately
        const updatedEnvironments = (flag.environments || []).map(env =>
            env.environment === envKey
                ? { ...env, isEnabled: !currentEnabled }
                : env
        );

        // If environment doesn't exist in the array yet, add it
        if (!updatedEnvironments.find(env => env.environment === envKey)) {
            updatedEnvironments.push({
                id: `temp-${envKey}`,
                flagId: flag.id,
                environment: envKey,
                isEnabled: !currentEnabled,
            });
        }

        setFlag({ ...flag, environments: updatedEnvironments });

        try {
            await api.post(`/admin/features/${flag.flagName}/toggle`, {
                isEnabled: !currentEnabled,
                environment: envKey,
            });
            enqueueSnackbar(t(`featureFlags.${!currentEnabled ? 'enabled' : 'disabled'}`), { variant: 'success' });
        } catch (error: any) {
            // Rollback on error
            setFlag({ ...flag, environments: flag.environments });
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
            const endpoint = flag.isArchived ? 'revive' : 'archive';
            await api.post(`/admin/features/${flag.flagName}/${endpoint}`);
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

    // Link handlers
    const handleOpenAddLink = () => {
        setEditingLink({ url: '', title: '' });
        setEditingLinkIndex(null);
        setLinkDialogOpen(true);
    };

    const handleOpenEditLink = (link: FlagLink, index: number) => {
        setEditingLink({ ...link });
        setEditingLinkIndex(index);
        setLinkDialogOpen(true);
    };

    const handleSaveLink = async () => {
        if (!flag || !editingLink.url) return;

        const currentLinks = flag.links || [];
        let updatedLinks: FlagLink[];

        if (editingLinkIndex !== null) {
            // Editing existing link
            updatedLinks = currentLinks.map((link, i) =>
                i === editingLinkIndex ? editingLink : link
            );
        } else {
            // Adding new link
            updatedLinks = [...currentLinks, editingLink];
        }

        try {
            if (!isCreating) {
                await api.put(`/admin/features/${flag.flagName}`, { links: updatedLinks });
            }
            setFlag({ ...flag, links: updatedLinks });
            setLinkDialogOpen(false);
            enqueueSnackbar(t('common.saveSuccess'), { variant: 'success' });
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'common.saveFailed'), { variant: 'error' });
        }
    };

    const handleDeleteLink = async (index: number) => {
        if (!flag) return;

        const updatedLinks = (flag.links || []).filter((_, i) => i !== index);

        try {
            if (!isCreating) {
                await api.put(`/admin/features/${flag.flagName}`, { links: updatedLinks });
            }
            setFlag({ ...flag, links: updatedLinks });
            enqueueSnackbar(t('common.deleteSuccess'), { variant: 'success' });
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'common.deleteFailed'), { variant: 'error' });
        }
    };

    // Helper function to distribute weights among variants (respecting locked weights)
    const distributeWeights = (variants: Variant[]): Variant[] => {
        if (variants.length === 0) return variants;

        // Calculate total locked weight
        const lockedVariants = variants.filter(v => v.weightLock);
        const unlockedVariants = variants.filter(v => !v.weightLock);
        const totalLockedWeight = lockedVariants.reduce((sum, v) => sum + (v.weight || 0), 0);

        // Remaining weight to distribute among unlocked variants
        const remainingWeight = Math.max(0, 100 - totalLockedWeight);

        if (unlockedVariants.length === 0) {
            return variants;
        }

        const baseWeight = Math.floor(remainingWeight / unlockedVariants.length);
        const remainder = remainingWeight % unlockedVariants.length;

        let unlockedIndex = 0;
        return variants.map(v => {
            if (v.weightLock) {
                return v;
            }
            const weight = baseWeight + (unlockedIndex < remainder ? 1 : 0);
            unlockedIndex++;
            return { ...v, weight };
        });
    };

    // Helper function to add a new variant with auto weight distribution
    const addVariantWithAutoDistribution = () => {
        const currentVariants = editingStrategy?.variants || [];
        const lastVariant = currentVariants[currentVariants.length - 1];
        const variantType = flag?.variantType || 'string';

        // Determine default payload value based on type and existing variants
        let defaultPayload: { type: string; value: string } | undefined = undefined;
        if (lastVariant?.payload?.value !== undefined) {
            // Copy last variant's payload
            defaultPayload = { type: lastVariant.payload.type || 'string', value: String(lastVariant.payload.value) };
        } else if (variantType === 'number') {
            // Default to '0' for number type
            defaultPayload = { type: 'string', value: '0' };
        }

        const newVariant: Variant = {
            name: `variant-${currentVariants.length + 1}`,
            weight: 0, // Will be recalculated
            weightLock: false,
            stickiness: 'default',
            payload: defaultPayload,
        };
        const updatedVariants = distributeWeights([...currentVariants, newVariant]);
        setEditingStrategy({
            ...editingStrategy!,
            variants: updatedVariants,
        });
    };

    // Helper function to remove a variant with auto weight redistribution
    const removeVariantWithAutoDistribution = (index: number) => {
        const currentVariants = editingStrategy?.variants || [];
        const remainingVariants = currentVariants.filter((_, i) => i !== index);
        const updatedVariants = distributeWeights(remainingVariants);
        setEditingStrategy({
            ...editingStrategy!,
            variants: updatedVariants,
        });
        // Clear JSON error for this index
        setStrategyJsonErrors(prev => {
            const next = { ...prev };
            delete next[index];
            return next;
        });
    };

    // Helper function to update a variant's fixed weight and redistribute
    const updateVariantWeight = (index: number, weight: number, locked: boolean) => {
        const currentVariants = [...(editingStrategy?.variants || [])];
        currentVariants[index] = {
            ...currentVariants[index],
            weight: Math.min(100, Math.max(0, weight)),
            weightLock: locked,
        };
        const updatedVariants = distributeWeights(currentVariants);
        setEditingStrategy({
            ...editingStrategy!,
            variants: updatedVariants,
        });
    };

    // Helper function to toggle weight lock for a variant
    const toggleWeightLock = (index: number, locked: boolean) => {
        const currentVariants = [...(editingStrategy?.variants || [])];
        currentVariants[index] = {
            ...currentVariants[index],
            weightLock: locked,
        };
        const updatedVariants = distributeWeights(currentVariants);
        setEditingStrategy({
            ...editingStrategy!,
            variants: updatedVariants,
        });
    };

    // Strategy handlers
    const handleAddStrategy = (envName: string) => {
        const envStrategyList = envStrategies[envName] || [];
        const newStrategy: Strategy = {
            id: `new-${Date.now()}`,
            name: 'flexibleRollout',
            title: '',
            parameters: { rollout: 100, stickiness: 'default', groupId: '' },
            constraints: [],
            segments: [],
            sortOrder: envStrategyList.length,
            disabled: true, // New strategies are disabled by default
        };
        setEditingStrategy(newStrategy);
        setOriginalEditingStrategy(JSON.parse(JSON.stringify(newStrategy)));
        setStrategyJsonErrors({});
        setStrategyTabValue(0);
        setEditingEnv(envName);
        setIsAddingStrategy(true);
        setStrategyDialogOpen(true);
    };

    const handleEditStrategy = (strategy: Strategy, envName: string) => {
        setEditingStrategy({ ...strategy });
        setOriginalEditingStrategy(JSON.parse(JSON.stringify(strategy)));
        setStrategyJsonErrors({});
        setStrategyTabValue(0);
        setEditingEnv(envName);
        setIsAddingStrategy(false);
        setStrategyDialogOpen(true);
    };

    const handleSaveStrategy = async () => {
        if (!flag || !editingStrategy || !editingEnv) return;

        const currentEnvStrategies = envStrategies[editingEnv] || [];
        const isNew = editingStrategy.id?.startsWith('new-');
        let updatedStrategies: Strategy[];

        if (isNew) {
            const newStrategy = { ...editingStrategy, id: undefined as any };
            updatedStrategies = [...currentEnvStrategies, newStrategy];
        } else {
            updatedStrategies = currentEnvStrategies.map(s =>
                s.id === editingStrategy.id ? editingStrategy : s
            );
        }

        try {
            if (!isCreating) {
                // Convert frontend Strategy format to backend API format
                const apiStrategies = updatedStrategies.map(s => ({
                    strategyName: s.name, // Backend expects strategyName, frontend uses name
                    parameters: s.parameters,
                    constraints: s.constraints,
                    segments: s.segments,
                    sortOrder: s.sortOrder,
                    isEnabled: !s.disabled,
                }));
                await api.put(`/admin/features/${flag.flagName}/strategies`, { strategies: apiStrategies }, {
                    headers: { 'x-environment': editingEnv }
                });

                // Save variants (including empty array to clear all variants)
                const apiVariants = (editingStrategy.variants || []).map(v => ({
                    variantName: v.name,
                    weight: v.weight,
                    payload: v.payload,
                    stickiness: v.stickiness || 'default',
                    weightLock: v.weightLock,
                }));
                await api.put(`/admin/features/${flag.flagName}/variants`, {
                    variants: apiVariants,
                    variantType: flag.variantType || 'string',
                }, {
                    headers: { 'x-environment': editingEnv }
                });

                // Reload strategies from server after save to ensure sync
                await loadEnvStrategies(environments, flag.flagName);
            } else {
                // Update environment-specific strategies for create mode
                setEnvStrategies(prev => ({
                    ...prev,
                    [editingEnv]: updatedStrategies,
                }));
            }
            setStrategyDialogOpen(false);
            setEditingStrategy(null);
            setEditingEnv(null);
            setIsAddingStrategy(false);
            setExpandedSegmentsDialog(new Set()); // Reset dialog-specific segment expansion
            enqueueSnackbar(t('common.saveSuccess'), { variant: 'success' });
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'common.saveFailed'), { variant: 'error' });
        }
    };

    const handleDeleteStrategy = async (strategyId: string | undefined, index: number, envName: string) => {
        if (!flag) return;
        const currentEnvStrategies = envStrategies[envName] || [];
        const updatedStrategies = currentEnvStrategies.filter((_, i) => i !== index);

        try {
            if (!isCreating) {
                // Convert frontend Strategy format to backend API format
                const apiStrategies = updatedStrategies.map(s => ({
                    strategyName: s.name,
                    parameters: s.parameters,
                    constraints: s.constraints,
                    segments: s.segments,
                    sortOrder: s.sortOrder,
                    isEnabled: !s.disabled,
                }));
                await api.put(`/admin/features/${flag.flagName}/strategies`, { strategies: apiStrategies }, {
                    headers: { 'x-environment': envName }
                });
                // Reload strategies from server after delete to ensure sync
                await loadEnvStrategies(environments, flag.flagName);
            } else {
                // Update environment-specific strategies for create mode
                setEnvStrategies(prev => ({
                    ...prev,
                    [envName]: updatedStrategies,
                }));
            }
            enqueueSnackbar(t('common.deleteSuccess'), { variant: 'success' });
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'common.deleteFailed'), { variant: 'error' });
        }
    };

    const handleReorderStrategies = async (envName: string, oldIndex: number, newIndex: number) => {
        if (!flag || oldIndex === newIndex) return;

        const currentEnvStrategies = envStrategies[envName] || [];
        const reorderedStrategies = arrayMove(currentEnvStrategies, oldIndex, newIndex);

        // Update sortOrder for all strategies
        const updatedStrategies = reorderedStrategies.map((s, idx) => ({
            ...s,
            sortOrder: idx,
        }));

        // Optimistically update UI
        setEnvStrategies(prev => ({
            ...prev,
            [envName]: updatedStrategies,
        }));

        try {
            if (!isCreating) {
                // Convert frontend Strategy format to backend API format
                const apiStrategies = updatedStrategies.map(s => ({
                    strategyName: s.name,
                    parameters: s.parameters,
                    constraints: s.constraints,
                    segments: s.segments,
                    sortOrder: s.sortOrder,
                    isEnabled: !s.disabled,
                }));
                await api.put(`/admin/features/${flag.flagName}/strategies`, { strategies: apiStrategies }, {
                    headers: { 'x-environment': envName }
                });
                enqueueSnackbar(t('featureFlags.strategyReordered'), { variant: 'success' });
            }
        } catch (error: any) {
            // Revert on error
            setEnvStrategies(prev => ({
                ...prev,
                [envName]: currentEnvStrategies,
            }));
            enqueueSnackbar(parseApiErrorMessage(error, 'common.saveFailed'), { variant: 'error' });
        }
    };

    // Variant handlers (simplified)
    const handleAddVariant = () => {
        const variants = flag?.variants || [];
        const lastVariant = variants[variants.length - 1];
        const variantType = flag?.variantType || 'string';

        // Determine default value based on type and existing variants
        let defaultValue = '';
        if (lastVariant?.payload?.value !== undefined) {
            // Copy last variant's value
            defaultValue = String(lastVariant.payload.value);
        } else if (variantType === 'number') {
            // Default to '0' for number type
            defaultValue = '0';
        }

        setEditingVariant({
            name: '',
            weight: 50,
            stickiness: 'userId',
            payload: { type: variantType === 'json' ? 'json' : 'string', value: defaultValue },
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
            </Box>

            {/* Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
                    <Tab label={t('featureFlags.overview')} />
                    <Tab label={t('featureFlags.metrics')} disabled={isCreating} />
                </Tabs>
            </Box>

            {/* Overview Tab */}
            <TabPanel value={tabValue} index={0}>
                <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
                    {/* Left Sidebar - Flag Details */}
                    <Box sx={{ width: { xs: '100%', md: 320 }, flexShrink: 0 }}>
                        {/* Flag Details Card */}
                        <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
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
                                        <FormControl size="small" sx={{ minWidth: 200 }}>
                                            <Select
                                                value={flag.flagType}
                                                onChange={(e) => setFlag({ ...flag, flagType: e.target.value as any })}
                                            >
                                                {FLAG_TYPES.map(type => (
                                                    <MenuItem key={type.value} value={type.value}>
                                                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                                            <Box sx={{ mt: 0.3 }}>{getTypeIcon(type.value)}</Box>
                                                            <Box>
                                                                <Typography variant="body2" fontWeight={500}>
                                                                    {t(type.labelKey)}
                                                                </Typography>
                                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                                                    {t(type.descKey)}
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    ) : (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            {getTypeIcon(flag.flagType)}
                                            <Typography variant="body2">
                                                {t(`featureFlags.types.${flag.flagType}`)}
                                            </Typography>
                                        </Box>
                                    )}
                                </Box>

                                {/* Created By */}
                                {flag.createdByName && (
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography variant="body2" color="text.secondary">
                                            {t('featureFlags.createdBy')}
                                        </Typography>
                                        <Typography variant="body2">
                                            {flag.createdByName}
                                        </Typography>
                                    </Box>
                                )}

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

                                {/* Last Seen At */}
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="body2" color="text.secondary">
                                        {t('featureFlags.lastSeenAt')}
                                    </Typography>
                                    {flag.lastSeenAt ? (
                                        <Tooltip title={formatDateTimeDetailed(flag.lastSeenAt)} arrow>
                                            <Typography variant="body2">
                                                {formatRelativeTime(flag.lastSeenAt)}
                                            </Typography>
                                        </Tooltip>
                                    ) : (
                                        <Typography variant="body2" color="text.secondary">-</Typography>
                                    )}
                                </Box>

                                <Divider />

                                {/* Tags */}
                                <Box>
                                    <Typography variant="body2" color="text.secondary" gutterBottom>
                                        {t('featureFlags.tags')}
                                    </Typography>
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
                                </Box>

                                {/* Settings Info - only in view mode */}
                                {!isCreating && (
                                    <>
                                        <Divider />
                                        <Box>
                                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                                {t('common.settings')}
                                            </Typography>
                                            <Stack spacing={1}>
                                                {/* Display Name */}
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {t('featureFlags.displayName')}
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        {flag.displayName || '-'}
                                                    </Typography>
                                                </Box>
                                                {/* Description */}
                                                {flag.description && (
                                                    <Box>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {t('featureFlags.description')}
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                                                            {flag.description}
                                                        </Typography>
                                                    </Box>
                                                )}
                                                {/* Impression Data */}
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {t('featureFlags.impressionData')}
                                                    </Typography>
                                                    <Chip
                                                        label={flag.impressionDataEnabled ? t('common.enabled') : t('common.disabled')}
                                                        size="small"
                                                        color={flag.impressionDataEnabled ? 'success' : 'default'}
                                                        variant="outlined"
                                                    />
                                                </Box>
                                            </Stack>
                                        </Box>
                                    </>
                                )}

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
                                        <Button
                                            variant="outlined"
                                            color="primary"
                                            startIcon={<EditIcon />}
                                            onClick={() => {
                                                setEditingFlagData({
                                                    displayName: flag.displayName || '',
                                                    description: flag.description || '',
                                                    impressionDataEnabled: flag.impressionDataEnabled,
                                                    tags: flag.tags || [],
                                                });
                                                setEditFlagDialogOpen(true);
                                            }}
                                            fullWidth
                                            size="small"
                                        >
                                            {t('common.edit')}
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

                        {/* Links Section */}
                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                {t('featureFlags.links.title')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                                {t('featureFlags.links.helpText')}
                            </Typography>

                            {(flag.links?.length || 0) > 0 ? (
                                <Stack spacing={1}>
                                    {flag.links?.map((link, index) => (
                                        <Box
                                            key={index}
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1,
                                                py: 0.5,
                                                '&:hover .link-actions': { opacity: 1 },
                                            }}
                                        >
                                            <Box
                                                component="a"
                                                href={link.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                sx={{
                                                    flex: 1,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 1,
                                                    textDecoration: 'none',
                                                    color: 'primary.main',
                                                    '&:hover': { textDecoration: 'underline' },
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                <LinkIcon fontSize="small" sx={{ color: 'text.secondary', mr: 0.5 }} />
                                                <Typography variant="body2" noWrap title={link.title || link.url}>
                                                    {link.title || link.url}
                                                </Typography>
                                            </Box>
                                            {canManage && (
                                                <Box className="link-actions" sx={{ opacity: 0, transition: 'opacity 0.2s', display: 'flex', gap: 0 }}>
                                                    <Tooltip title={t('common.edit')}>
                                                        <IconButton size="small" onClick={() => handleOpenEditLink(link, index)}>
                                                            <EditIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title={t('common.delete')}>
                                                        <IconButton size="small" onClick={() => handleDeleteLink(index)}>
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            )}
                                        </Box>
                                    ))}
                                </Stack>
                            ) : null}

                            {canManage && (
                                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                                    <Button
                                        size="small"
                                        startIcon={<AddIcon />}
                                        onClick={handleOpenAddLink}
                                    >
                                        {t('featureFlags.links.addLink')}
                                    </Button>
                                </Box>
                            )}
                        </Paper>
                    </Box>

                    {/* Right Main Area - Environment Cards */}
                    <Box sx={{ flex: 1 }}>
                        <Stack spacing={2}>
                            {environments.map((env, envIndex) => {
                                // Get environment-specific isEnabled from flag.environments
                                const envSettings = flag.environments?.find(e => e.environment === env.environment);
                                const isEnabled = envSettings?.isEnabled ?? false;
                                // Use environment-specific strategies
                                const strategies = envStrategies[env.environment] || [];
                                const strategiesCount = strategies.length;
                                const isExpanded = expandedEnvs.has(env.environment);

                                return (
                                    <React.Fragment key={env.environment}>
                                        {envIndex > 0 && (
                                            <Divider sx={{ borderStyle: 'dashed', my: 1 }} />
                                        )}
                                        <Box sx={{ display: 'flex', border: 1, borderColor: 'divider', overflow: 'hidden', borderRadius: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                                            {/* Color indicator bar */}
                                            <Box sx={{ width: 4, bgcolor: env.color || '#888', flexShrink: 0 }} />
                                            {/* Content */}
                                            <Box sx={{ flex: 1 }}>
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
                                                                color={env.color}
                                                            />
                                                        </Box>

                                                        {/* Environment info */}
                                                        <Box sx={{ flex: 1 }}>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {t('featureFlags.environment')}
                                                            </Typography>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <Typography variant="subtitle1" fontWeight={600}>
                                                                    {env.displayName}
                                                                </Typography>
                                                                {strategiesCount > 0 && (
                                                                    <Typography
                                                                        variant="caption"
                                                                        sx={{
                                                                            px: 1,
                                                                            py: 0.25,
                                                                            bgcolor: 'action.hover',
                                                                            borderRadius: '4px',
                                                                            color: 'text.secondary',
                                                                        }}
                                                                    >
                                                                        {t('featureFlags.strategiesCount', { count: strategiesCount })}
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                        </Box>

                                                        {/* Metrics mini pie chart */}
                                                        {(() => {
                                                            const metrics = envMetrics[env.environment];
                                                            // Only show chart if we have actual metrics data
                                                            if (metrics && metrics.total > 0) {
                                                                const yesPercent = Math.round((metrics.totalYes / metrics.total) * 100);
                                                                const noPercent = 100 - yesPercent;

                                                                // SVG-based mini pie chart - filled style
                                                                const radius = 24;
                                                                const cx = 26;
                                                                const cy = 26;

                                                                // Calculate arc path for pie chart
                                                                const getArcPath = (startAngle: number, endAngle: number, r: number) => {
                                                                    const startRad = (startAngle - 90) * Math.PI / 180;
                                                                    const endRad = (endAngle - 90) * Math.PI / 180;
                                                                    const x1 = cx + r * Math.cos(startRad);
                                                                    const y1 = cy + r * Math.sin(startRad);
                                                                    const x2 = cx + r * Math.cos(endRad);
                                                                    const y2 = cy + r * Math.sin(endRad);
                                                                    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
                                                                    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                                                                };

                                                                const yesAngle = (yesPercent / 100) * 360;

                                                                return (
                                                                    <Tooltip
                                                                        title={`${t('featureFlags.metrics.exposedTrue')}: ${metrics.totalYes} (${yesPercent}%) / ${t('featureFlags.metrics.exposedFalse')}: ${metrics.totalNo} (${noPercent}%)`}
                                                                        arrow
                                                                    >
                                                                        <Box sx={{
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: 1,
                                                                        }}>
                                                                            <svg width="52" height="52" viewBox="0 0 52 52">
                                                                                {/* No (red) - full circle background */}
                                                                                <circle
                                                                                    cx={cx}
                                                                                    cy={cy}
                                                                                    r={radius}
                                                                                    fill="#ef5350"
                                                                                />
                                                                                {/* Yes (green) - pie slice */}
                                                                                {yesPercent > 0 && yesPercent < 100 && (
                                                                                    <path
                                                                                        d={getArcPath(0, yesAngle, radius)}
                                                                                        fill="#4caf50"
                                                                                    />
                                                                                )}
                                                                                {yesPercent >= 100 && (
                                                                                    <circle
                                                                                        cx={cx}
                                                                                        cy={cy}
                                                                                        r={radius}
                                                                                        fill="#4caf50"
                                                                                    />
                                                                                )}
                                                                                {/* Center text */}
                                                                                <text
                                                                                    x={cx}
                                                                                    y={cy}
                                                                                    textAnchor="middle"
                                                                                    dominantBaseline="central"
                                                                                    fontSize="14"
                                                                                    fontWeight="bold"
                                                                                    fontFamily="system-ui, -apple-system, sans-serif"
                                                                                    fill="white"
                                                                                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                                                                                >
                                                                                    {yesPercent}%
                                                                                </text>
                                                                            </svg>
                                                                        </Box>
                                                                    </Tooltip>
                                                                );
                                                            }
                                                            return (
                                                                <Tooltip
                                                                    title={t('featureFlags.noMetricsYetHint')}
                                                                    arrow
                                                                >
                                                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                                        <svg width="52" height="52" viewBox="0 0 52 52">
                                                                            {/* Empty light circle for no metrics */}
                                                                            <circle
                                                                                cx={26}
                                                                                cy={26}
                                                                                r={24}
                                                                                fill={theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}
                                                                            />
                                                                        </svg>
                                                                    </Box>
                                                                </Tooltip>
                                                            );
                                                        })()}
                                                    </AccordionSummary>

                                                    <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
                                                        {strategies.length === 0 ? (
                                                            <Box
                                                                sx={{
                                                                    py: 4,
                                                                    px: 3,
                                                                    textAlign: 'center',
                                                                    border: '2px dashed',
                                                                    borderColor: 'divider',
                                                                    borderRadius: 1,
                                                                    bgcolor: 'action.hover',
                                                                }}
                                                            >
                                                                <Typography color="text.secondary" sx={{ mb: 2 }}>
                                                                    {t('featureFlags.noStrategies')}
                                                                </Typography>
                                                                {canManage && (
                                                                    <Button
                                                                        variant="contained"
                                                                        startIcon={<AddIcon />}
                                                                        onClick={() => handleAddStrategy(env.environment)}
                                                                        size="small"
                                                                    >
                                                                        {t('featureFlags.addStrategy')}
                                                                    </Button>
                                                                )}
                                                            </Box>
                                                        ) : (
                                                            <>
                                                                <DndContext
                                                                    sensors={sensors}
                                                                    collisionDetection={closestCenter}
                                                                    onDragEnd={(event: DragEndEvent) => {
                                                                        const { active, over } = event;
                                                                        if (over && active.id !== over.id) {
                                                                            const oldIndex = strategies.findIndex(s => s.id === active.id);
                                                                            const newIndex = strategies.findIndex(s => s.id === over.id);
                                                                            handleReorderStrategies(env.environment, oldIndex, newIndex);
                                                                        }
                                                                    }}
                                                                >
                                                                    <SortableContext items={strategies.map(s => s.id)} strategy={verticalListSortingStrategy}>
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

                                                                                    {/* Strategy card wrapped with sortable */}
                                                                                    <SortableStrategyItem id={strategy.id} isDraggable={strategies.length > 1}>
                                                                                        {({ dragHandleProps }) => (
                                                                                            <Paper variant="outlined" sx={{ p: 0, overflow: 'hidden' }}>
                                                                                                {/* Strategy Header */}
                                                                                                <Box sx={{
                                                                                                    display: 'flex',
                                                                                                    justifyContent: 'space-between',
                                                                                                    alignItems: 'center',
                                                                                                    p: 1.5,
                                                                                                    bgcolor: 'action.hover',
                                                                                                    borderBottom: 1,
                                                                                                    borderColor: 'divider',
                                                                                                }}>
                                                                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                                                                        {/* Drag handle */}
                                                                                                        {dragHandleProps && (
                                                                                                            <Box
                                                                                                                {...dragHandleProps}
                                                                                                                sx={{ color: 'text.disabled', cursor: 'grab', display: 'flex', alignItems: 'center', '&:active': { cursor: 'grabbing' } }}
                                                                                                            >
                                                                                                                <DragIcon fontSize="small" />
                                                                                                            </Box>
                                                                                                        )}
                                                                                                        {/* Strategy title with summary */}
                                                                                                        <Box>
                                                                                                            <Typography fontWeight={600} component="span">
                                                                                                                {strategy.title || getStrategyTitle(strategy.name)}
                                                                                                            </Typography>
                                                                                                            {/* Show rollout % for rollout strategies */}
                                                                                                            {(strategy.name === 'flexibleRollout' || strategy.name === 'gradualRolloutRandom' || strategy.name === 'gradualRolloutUserId') && strategy.parameters?.rollout !== undefined && (
                                                                                                                <Typography component="span" color="text.secondary">
                                                                                                                    : {strategy.parameters.rollout}% {t('featureFlags.ofAllUsers')}
                                                                                                                </Typography>
                                                                                                            )}
                                                                                                            {/* Show user count for userWithId strategy */}
                                                                                                            {strategy.name === 'userWithId' && (
                                                                                                                <Typography component="span" color="text.secondary">
                                                                                                                    : {(strategy.parameters?.userIds?.length || 0)} {t('featureFlags.users')}
                                                                                                                </Typography>
                                                                                                            )}
                                                                                                            {/* Show IP count for remoteAddress strategy */}
                                                                                                            {strategy.name === 'remoteAddress' && (
                                                                                                                <Typography component="span" color="text.secondary">
                                                                                                                    : {(strategy.parameters?.IPs?.length || 0)} {t('featureFlags.addresses')}
                                                                                                                </Typography>
                                                                                                            )}
                                                                                                            {/* Show hostname count for applicationHostname strategy */}
                                                                                                            {strategy.name === 'applicationHostname' && (
                                                                                                                <Typography component="span" color="text.secondary">
                                                                                                                    : {(strategy.parameters?.hostNames?.length || 0)} {t('featureFlags.hosts')}
                                                                                                                </Typography>
                                                                                                            )}
                                                                                                        </Box>
                                                                                                    </Box>
                                                                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                                                        {/* Strategy disabled badge */}
                                                                                                        {strategy.disabled && (
                                                                                                            <Chip
                                                                                                                label={t('featureFlags.strategyDisabled')}
                                                                                                                size="small"
                                                                                                                variant="outlined"
                                                                                                                color="warning"
                                                                                                                sx={{ fontWeight: 500 }}
                                                                                                            />
                                                                                                        )}
                                                                                                        {/* Actions */}
                                                                                                        {canManage && (
                                                                                                            <Box sx={{ display: 'flex', gap: 0 }}>
                                                                                                                <Tooltip title={t('common.edit')}>
                                                                                                                    <IconButton size="small" onClick={() => handleEditStrategy(strategy, env.environment)}>
                                                                                                                        <EditIcon fontSize="small" />
                                                                                                                    </IconButton>
                                                                                                                </Tooltip>
                                                                                                                <Tooltip title={strategies.length === 1 ? t('featureFlags.cannotDeleteLastStrategy') : t('common.delete')}>
                                                                                                                    <span>
                                                                                                                        <IconButton
                                                                                                                            size="small"
                                                                                                                            onClick={() => handleDeleteStrategy(strategy.id, index, env.environment)}
                                                                                                                            disabled={strategies.length === 1}
                                                                                                                        >
                                                                                                                            <DeleteIcon fontSize="small" />
                                                                                                                        </IconButton>
                                                                                                                    </span>
                                                                                                                </Tooltip>
                                                                                                            </Box>
                                                                                                        )}
                                                                                                    </Box>
                                                                                                </Box>

                                                                                                {/* Strategy Body - Clean Layout */}
                                                                                                <Box sx={{ px: 2, pt: 2, pb: 2 }}>
                                                                                                    {/* Segments Section */}
                                                                                                    {strategy.segments && strategy.segments.length > 0 && (
                                                                                                        <Box>
                                                                                                            {strategy.segments.map((segmentName: string, segIdx: number) => {
                                                                                                                const segmentData = segments.find(s => s.segmentName === segmentName);
                                                                                                                const isExpanded = expandedSegments.has(segmentName);
                                                                                                                return (
                                                                                                                    <Box key={segmentName} sx={{ position: 'relative' }}>
                                                                                                                        {/* Segment Box */}
                                                                                                                        <Paper
                                                                                                                            variant="outlined"
                                                                                                                            sx={{
                                                                                                                                p: 1.5,
                                                                                                                                bgcolor: 'background.paper',
                                                                                                                            }}
                                                                                                                        >
                                                                                                                            {/* Segment Header */}
                                                                                                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                                                                                                    <Typography variant="body2" color="primary.main" sx={{ fontWeight: 600, minWidth: 80 }}>
                                                                                                                                        {t('featureFlags.segment')}
                                                                                                                                    </Typography>
                                                                                                                                    <Chip
                                                                                                                                        label={segmentData?.displayName || segmentName}
                                                                                                                                        size="small"
                                                                                                                                        sx={{
                                                                                                                                            bgcolor: 'action.selected',
                                                                                                                                            color: 'text.primary',
                                                                                                                                            fontWeight: 500,
                                                                                                                                            borderRadius: '16px',
                                                                                                                                        }}
                                                                                                                                    />
                                                                                                                                </Box>
                                                                                                                                <Button
                                                                                                                                    variant="outlined"
                                                                                                                                    size="small"
                                                                                                                                    onClick={() => {
                                                                                                                                        const newSet = new Set(expandedSegments);
                                                                                                                                        if (isExpanded) {
                                                                                                                                            newSet.delete(segmentName);
                                                                                                                                        } else {
                                                                                                                                            newSet.add(segmentName);
                                                                                                                                        }
                                                                                                                                        setExpandedSegments(newSet);
                                                                                                                                    }}
                                                                                                                                    sx={{ textTransform: 'none', fontWeight: 500, minWidth: 70 }}
                                                                                                                                >
                                                                                                                                    {isExpanded ? t('featureFlags.hide') : t('featureFlags.preview')}
                                                                                                                                </Button>
                                                                                                                            </Box>
                                                                                                                            {/* Segment Preview (inside the box) with animation */}
                                                                                                                            <Collapse in={isExpanded && !!segmentData} timeout={200}>
                                                                                                                                <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
                                                                                                                                    <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                                                                                                                                        {segmentData?.displayName || segmentName}
                                                                                                                                    </Typography>
                                                                                                                                    {segmentData?.description && (
                                                                                                                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                                                                                                                            {segmentData.description}
                                                                                                                                        </Typography>
                                                                                                                                    )}
                                                                                                                                    <Box sx={{ pl: 2 }}>
                                                                                                                                        <ConstraintList
                                                                                                                                            constraints={segmentData?.constraints || []}
                                                                                                                                            contextFields={contextFields}
                                                                                                                                        />
                                                                                                                                    </Box>
                                                                                                                                </Box>
                                                                                                                            </Collapse>
                                                                                                                        </Paper>
                                                                                                                        {/* AND marker after segment */}
                                                                                                                        {segIdx < strategy.segments.length - 1 && (
                                                                                                                            <Box sx={{ display: 'flex', alignItems: 'center', ml: 2, my: -0.5, position: 'relative', zIndex: 2 }}>
                                                                                                                                <Chip label="AND" size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, bgcolor: 'background.paper', color: 'text.secondary', border: 1, borderColor: 'divider' }} />
                                                                                                                            </Box>
                                                                                                                        )}
                                                                                                                    </Box>
                                                                                                                );
                                                                                                            })}
                                                                                                        </Box>
                                                                                                    )}

                                                                                                    {/* AND marker between segments and constraints */}
                                                                                                    {strategy.segments && strategy.segments.length > 0 && strategy.constraints && strategy.constraints.length > 0 && (
                                                                                                        <Box sx={{ display: 'flex', alignItems: 'center', ml: 2, my: -0.5, position: 'relative', zIndex: 2 }}>
                                                                                                            <Chip label="AND" size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, bgcolor: 'background.paper', color: 'text.secondary', border: 1, borderColor: 'divider' }} />
                                                                                                        </Box>
                                                                                                    )}

                                                                                                    {/* Constraints Section - Individual constraints with outer box, no inner box */}
                                                                                                    {strategy.constraints && strategy.constraints.length > 0 && strategy.constraints.map((constraint: ConstraintValue, cIdx: number) => (
                                                                                                        <Box key={cIdx} sx={{ position: 'relative' }}>
                                                                                                            <Paper variant="outlined" sx={{ p: 1.5 }}>
                                                                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                                                                                    <Typography variant="body2" color="warning.main" sx={{ fontWeight: 600, minWidth: 80 }}>
                                                                                                                        {t('featureFlags.constraint')}
                                                                                                                    </Typography>
                                                                                                                    <ConstraintDisplay constraint={constraint} contextFields={contextFields} noBorder />
                                                                                                                </Box>
                                                                                                            </Paper>
                                                                                                            {/* AND marker after constraint */}
                                                                                                            {cIdx < strategy.constraints.length - 1 && (
                                                                                                                <Box sx={{ display: 'flex', alignItems: 'center', ml: 2, my: -0.5, position: 'relative', zIndex: 2 }}>
                                                                                                                    <Chip label="AND" size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, bgcolor: 'background.paper', color: 'text.secondary', border: 1, borderColor: 'divider' }} />
                                                                                                                </Box>
                                                                                                            )}
                                                                                                        </Box>
                                                                                                    ))}

                                                                                                    {/* AND marker before rollout */}
                                                                                                    {((strategy.segments && strategy.segments.length > 0) || (strategy.constraints && strategy.constraints.length > 0)) &&
                                                                                                        (strategy.name === 'flexibleRollout' || strategy.name === 'gradualRolloutRandom' || strategy.name === 'gradualRolloutUserId') &&
                                                                                                        strategy.parameters?.rollout !== undefined && (
                                                                                                            <Box sx={{ display: 'flex', alignItems: 'center', ml: 2, my: -0.5, position: 'relative', zIndex: 2 }}>
                                                                                                                <Chip label="AND" size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, bgcolor: 'background.paper', color: 'text.secondary', border: 1, borderColor: 'divider' }} />
                                                                                                            </Box>
                                                                                                        )}

                                                                                                    {/* Rollout % Section */}
                                                                                                    {(strategy.name === 'flexibleRollout' || strategy.name === 'gradualRolloutRandom' || strategy.name === 'gradualRolloutUserId') && strategy.parameters?.rollout !== undefined && (
                                                                                                        <Box sx={{ mb: 1.5 }}>
                                                                                                            <Paper variant="outlined" sx={{ p: 1.5 }}>
                                                                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                                                                                    <Typography variant="body2" color="info.main" sx={{ fontWeight: 600, minWidth: 80 }}>
                                                                                                                        {t('featureFlags.rollout')}
                                                                                                                    </Typography>
                                                                                                                    <Chip
                                                                                                                        label={`${strategy.parameters.rollout}%`}
                                                                                                                        size="small"
                                                                                                                        sx={{ bgcolor: 'action.selected', fontWeight: 600 }}
                                                                                                                    />
                                                                                                                    <Typography variant="body2" color="text.secondary">
                                                                                                                        {t('featureFlags.ofYourBaseMatching')}
                                                                                                                    </Typography>
                                                                                                                </Box>
                                                                                                            </Paper>
                                                                                                        </Box>
                                                                                                    )}

                                                                                                    {/* AND marker before userIds */}
                                                                                                    {((strategy.segments && strategy.segments.length > 0) || (strategy.constraints && strategy.constraints.length > 0)) &&
                                                                                                        strategy.name === 'userWithId' && strategy.parameters?.userIds?.length > 0 && (
                                                                                                            <Box sx={{ display: 'flex', alignItems: 'center', ml: 2, my: -0.5, position: 'relative', zIndex: 2 }}>
                                                                                                                <Chip label="AND" size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, bgcolor: 'background.paper', color: 'text.secondary', border: 1, borderColor: 'divider' }} />
                                                                                                            </Box>
                                                                                                        )}

                                                                                                    {/* User IDs for userWithId strategy */}
                                                                                                    {strategy.name === 'userWithId' && strategy.parameters?.userIds && (Array.isArray(strategy.parameters.userIds) ? strategy.parameters.userIds : String(strategy.parameters.userIds).split(',')).length > 0 && (
                                                                                                        <Box sx={{ mb: 1.5 }}>
                                                                                                            <Paper variant="outlined" sx={{ p: 1.5 }}>
                                                                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                                                                                                                    <Typography variant="body2" color="warning.main" sx={{ fontWeight: 600, minWidth: 80 }}>
                                                                                                                        {t('featureFlags.userIds')}
                                                                                                                    </Typography>
                                                                                                                    {(Array.isArray(strategy.parameters.userIds) ? strategy.parameters.userIds : String(strategy.parameters.userIds).split(',')).filter((id: string) => id.trim()).map((userId: string) => (
                                                                                                                        <Chip key={userId} label={userId.trim()} size="small" sx={{ bgcolor: 'action.selected', color: 'text.primary', fontWeight: 500, borderRadius: '16px' }} />
                                                                                                                    ))}
                                                                                                                </Box>
                                                                                                            </Paper>
                                                                                                        </Box>
                                                                                                    )}

                                                                                                    {/* AND marker before IPs */}
                                                                                                    {((strategy.segments && strategy.segments.length > 0) || (strategy.constraints && strategy.constraints.length > 0)) &&
                                                                                                        strategy.name === 'remoteAddress' && strategy.parameters?.IPs?.length > 0 && (
                                                                                                            <Box sx={{ display: 'flex', alignItems: 'center', ml: 2, my: -0.5, position: 'relative', zIndex: 2 }}>
                                                                                                                <Chip label="AND" size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, bgcolor: 'background.paper', color: 'text.secondary', border: 1, borderColor: 'divider' }} />
                                                                                                            </Box>
                                                                                                        )}

                                                                                                    {/* IP Addresses for remoteAddress strategy */}
                                                                                                    {strategy.name === 'remoteAddress' && strategy.parameters?.IPs?.length > 0 && (
                                                                                                        <Box sx={{ mb: 1.5 }}>
                                                                                                            <Paper variant="outlined" sx={{ p: 1.5 }}>
                                                                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                                                                                                                    <Typography variant="body2" color="warning.main" sx={{ fontWeight: 600, minWidth: 80 }}>
                                                                                                                        {t('featureFlags.remoteAddresses')}
                                                                                                                    </Typography>
                                                                                                                    {strategy.parameters.IPs.map((ip: string) => (
                                                                                                                        <Chip key={ip} label={ip} size="small" sx={{ bgcolor: 'action.selected', color: 'text.primary', fontWeight: 500, borderRadius: '16px' }} />
                                                                                                                    ))}
                                                                                                                </Box>
                                                                                                            </Paper>
                                                                                                        </Box>
                                                                                                    )}

                                                                                                    {/* AND marker before hostnames */}
                                                                                                    {((strategy.segments && strategy.segments.length > 0) || (strategy.constraints && strategy.constraints.length > 0)) &&
                                                                                                        strategy.name === 'applicationHostname' && strategy.parameters?.hostNames?.length > 0 && (
                                                                                                            <Box sx={{ display: 'flex', alignItems: 'center', ml: 2, my: -0.5, position: 'relative', zIndex: 2 }}>
                                                                                                                <Chip label="AND" size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, bgcolor: 'background.paper', color: 'text.secondary', border: 1, borderColor: 'divider' }} />
                                                                                                            </Box>
                                                                                                        )}

                                                                                                    {/* Hostnames for applicationHostname strategy */}
                                                                                                    {strategy.name === 'applicationHostname' && strategy.parameters?.hostNames?.length > 0 && (
                                                                                                        <Box sx={{ mb: 1.5 }}>
                                                                                                            <Paper variant="outlined" sx={{ p: 1.5 }}>
                                                                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                                                                                                                    <Typography variant="body2" color="warning.main" sx={{ fontWeight: 600, minWidth: 80 }}>
                                                                                                                        {t('featureFlags.hostnames')}
                                                                                                                    </Typography>
                                                                                                                    {strategy.parameters.hostNames.map((hostname: string) => (
                                                                                                                        <Chip key={hostname} label={hostname} size="small" sx={{ bgcolor: 'action.selected', color: 'text.primary', fontWeight: 500, borderRadius: '16px' }} />
                                                                                                                    ))}
                                                                                                                </Box>
                                                                                                            </Paper>
                                                                                                        </Box>
                                                                                                    )}

                                                                                                    {/* Variants Bar */}
                                                                                                    {strategy.variants && strategy.variants.length > 0 && (
                                                                                                        <Box sx={{ mb: 1 }}>
                                                                                                            <Paper variant="outlined" sx={{ p: 1.5 }}>
                                                                                                                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>
                                                                                                                    {t('featureFlags.variants')} ({strategy.variants.length})
                                                                                                                </Typography>
                                                                                                                <Box sx={{
                                                                                                                    height: 28,
                                                                                                                    display: 'flex',
                                                                                                                    overflow: 'hidden',
                                                                                                                }}>
                                                                                                                    {strategy.variants.map((variant, vIdx) => {
                                                                                                                        const colors = ['#5E35B1', '#1E88E5', '#00897B', '#F4511E', '#D81B60', '#3949AB'];
                                                                                                                        return (
                                                                                                                            <Tooltip key={vIdx} title={`${variant.name}: ${variant.weight}%`}>
                                                                                                                                <Box
                                                                                                                                    sx={{
                                                                                                                                        width: `${variant.weight}%`,
                                                                                                                                        bgcolor: colors[vIdx % colors.length],
                                                                                                                                        display: 'flex',
                                                                                                                                        alignItems: 'center',
                                                                                                                                        justifyContent: 'center',
                                                                                                                                        color: 'white',
                                                                                                                                        fontSize: '0.75rem',
                                                                                                                                        fontWeight: 600,
                                                                                                                                        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                                                                                                                    }}
                                                                                                                                >
                                                                                                                                    {variant.weight > 15 && (
                                                                                                                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.2 }}>
                                                                                                                                            <span style={{ fontSize: '0.65rem' }}>{variant.weight}%</span>
                                                                                                                                            <span>{variant.name}</span>
                                                                                                                                        </Box>
                                                                                                                                    )}
                                                                                                                                </Box>
                                                                                                                            </Tooltip>
                                                                                                                        );
                                                                                                                    })}
                                                                                                                </Box>
                                                                                                            </Paper>
                                                                                                        </Box>
                                                                                                    )}
                                                                                                </Box>
                                                                                            </Paper>
                                                                                        )}
                                                                                    </SortableStrategyItem>
                                                                                </React.Fragment>
                                                                            ))}
                                                                        </Stack>
                                                                    </SortableContext>
                                                                </DndContext>

                                                                {/* Add strategy button */}
                                                                {canManage && (
                                                                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                                                                        <Button
                                                                            variant="contained"
                                                                            startIcon={<AddIcon />}
                                                                            onClick={() => handleAddStrategy(env.environment)}
                                                                            size="small"
                                                                        >
                                                                            {t('featureFlags.addStrategy')}
                                                                        </Button>
                                                                    </Box>
                                                                )}
                                                            </>
                                                        )}
                                                    </AccordionDetails>
                                                </Accordion>
                                            </Box>
                                        </Box>
                                    </React.Fragment>
                                );
                            })}
                        </Stack>
                    </Box>
                </Box>
            </TabPanel>

            {/* Metrics Tab */}
            <TabPanel value={tabValue} index={1}>
                <FeatureFlagMetrics
                    flagName={flag.flagName}
                    environments={(flag.environments || []).map(e => ({ environment: e.environment, isEnabled: e.isEnabled }))}
                    currentEnvironment={flag.environments?.[0]?.environment || 'production'}
                />
            </TabPanel>

            {/* Delete Confirmation Dialog */}
            <ConfirmDeleteDialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                onConfirm={handleDelete}
                title={t('featureFlags.deleteConfirmTitle')}
                message={t('featureFlags.deleteConfirmMessage', { name: flag.flagName })}
            />

            {/* Edit Flag Settings Drawer */}
            <ResizableDrawer
                open={editFlagDialogOpen}
                onClose={() => setEditFlagDialogOpen(false)}
                title={t('featureFlags.editFlagSettings')}
                subtitle={t('featureFlags.editFlagSettingsSubtitle')}
                storageKey="featureFlagEditDrawerWidth"
                defaultWidth={500}
            >
                {editingFlagData && (
                    <>
                        <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
                            <Stack spacing={3}>
                                {/* Flag Name (read-only) */}
                                <TextField
                                    fullWidth
                                    label={t('featureFlags.flagName')}
                                    value={flag?.flagName || ''}
                                    InputProps={{ readOnly: true }}
                                    helperText={t('featureFlags.flagNameHelp')}
                                    sx={{
                                        '& .MuiInputBase-input': {
                                            color: 'text.secondary',
                                            cursor: 'default'
                                        }
                                    }}
                                />
                                <TextField
                                    fullWidth
                                    label={t('featureFlags.displayName')}
                                    value={editingFlagData.displayName}
                                    onChange={(e) => setEditingFlagData({ ...editingFlagData, displayName: e.target.value })}
                                    helperText={t('featureFlags.displayNameHelp')}
                                />
                                <TextField
                                    fullWidth
                                    multiline
                                    rows={3}
                                    label={t('featureFlags.description')}
                                    value={editingFlagData.description}
                                    onChange={(e) => setEditingFlagData({ ...editingFlagData, description: e.target.value })}
                                    helperText={t('featureFlags.descriptionHelp')}
                                />
                                <Box>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={editingFlagData.impressionDataEnabled}
                                                onChange={(e) => setEditingFlagData({ ...editingFlagData, impressionDataEnabled: e.target.checked })}
                                            />
                                        }
                                        label={t('featureFlags.impressionData')}
                                    />
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 6 }}>
                                        {t('featureFlags.impressionDataHelp')}
                                    </Typography>
                                </Box>
                                <Autocomplete
                                    multiple
                                    size="small"
                                    options={allTags.map(tag => tag.name)}
                                    value={editingFlagData.tags || []}
                                    onChange={(_, newValue) => setEditingFlagData({ ...editingFlagData, tags: newValue })}
                                    renderInput={(params) => (
                                        <TextField {...params} label={t('featureFlags.tags')} placeholder={t('featureFlags.selectTags')} helperText={t('featureFlags.tagsHelp')} />
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
                            </Stack>
                        </Box>
                        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                            <Button onClick={() => setEditFlagDialogOpen(false)}>{t('common.cancel')}</Button>
                            <Button
                                variant="contained"
                                onClick={async () => {
                                    if (!flag || !editingFlagData) return;
                                    try {
                                        setSaving(true);
                                        await api.put(`/admin/features/${flag.flagName}`, {
                                            displayName: editingFlagData.displayName,
                                            description: editingFlagData.description,
                                            impressionDataEnabled: editingFlagData.impressionDataEnabled,
                                            tags: editingFlagData.tags,
                                        });
                                        setFlag({
                                            ...flag,
                                            displayName: editingFlagData.displayName,
                                            description: editingFlagData.description,
                                            impressionDataEnabled: editingFlagData.impressionDataEnabled,
                                            tags: editingFlagData.tags,
                                        });
                                        setEditFlagDialogOpen(false);
                                        enqueueSnackbar(t('common.saveSuccess'), { variant: 'success' });
                                    } catch (error: any) {
                                        enqueueSnackbar(error.message || t('common.saveFailed'), { variant: 'error' });
                                    } finally {
                                        setSaving(false);
                                    }
                                }}
                                disabled={saving || (
                                    editingFlagData?.displayName === (flag?.displayName || '') &&
                                    editingFlagData?.description === (flag?.description || '') &&
                                    editingFlagData?.impressionDataEnabled === flag?.impressionDataEnabled &&
                                    JSON.stringify(editingFlagData?.tags || []) === JSON.stringify(flag?.tags || [])
                                )}
                            >
                                {saving ? <CircularProgress size={20} /> : t('common.save')}
                            </Button>
                        </Box>
                    </>
                )}
            </ResizableDrawer>

            {/* Strategy Edit Drawer */}
            <ResizableDrawer
                open={strategyDialogOpen}
                onClose={() => setStrategyDialogOpen(false)}
                title={editingStrategy?.id?.startsWith('new-') ? t('featureFlags.addStrategy') : t('featureFlags.editStrategy')}
                storageKey="featureFlagStrategyDrawerWidth"
                defaultWidth={600}
            >
                {editingStrategy && (
                    <>
                        {/* Tabs */}
                        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
                            <Tabs
                                value={strategyTabValue}
                                onChange={(_, v) => setStrategyTabValue(v)}
                                variant="standard"
                            >
                                <Tab label={t('featureFlags.strategyTabs.general')} />
                                <Tab
                                    label={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            {t('featureFlags.strategyTabs.targeting')}
                                            {((editingStrategy.segments?.length || 0) + (editingStrategy.constraints?.length || 0)) > 0 && (
                                                <Chip
                                                    label={(editingStrategy.segments?.length || 0) + (editingStrategy.constraints?.length || 0)}
                                                    size="small"
                                                    color="primary"
                                                    sx={{ height: 20, fontSize: '0.75rem' }}
                                                />
                                            )}
                                        </Box>
                                    }
                                />
                                <Tab
                                    label={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            {t('featureFlags.strategyTabs.variants')}
                                            {(editingStrategy.variants?.length || 0) > 0 && (
                                                <Chip
                                                    label={editingStrategy.variants?.length || 0}
                                                    size="small"
                                                    color="secondary"
                                                    sx={{ height: 20, fontSize: '0.75rem' }}
                                                />
                                            )}
                                        </Box>
                                    }
                                />
                            </Tabs>
                        </Box>

                        <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
                            {/* General Tab */}
                            {strategyTabValue === 0 && (
                                <Stack spacing={3}>
                                    {/* Strategy Type */}
                                    <FormControl fullWidth>
                                        <InputLabel>{t('featureFlags.strategyType')}</InputLabel>
                                        <Select
                                            value={editingStrategy.name || 'flexibleRollout'}
                                            onChange={(e) => setEditingStrategy({ ...editingStrategy, name: e.target.value })}
                                            label={t('featureFlags.strategyType')}
                                        >
                                            {STRATEGY_TYPES.map(type => (
                                                <MenuItem key={type.name} value={type.name}>
                                                    <Box>
                                                        <Typography>{t(type.titleKey)}</Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {t(type.descKey)}
                                                        </Typography>
                                                    </Box>
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>

                                    {/* Strategy Title (optional) */}
                                    <TextField
                                        fullWidth
                                        label={t('featureFlags.strategyTitle')}
                                        placeholder={t('featureFlags.strategyTitlePlaceholder')}
                                        value={editingStrategy.title || ''}
                                        onChange={(e) => setEditingStrategy({ ...editingStrategy, title: e.target.value })}
                                        helperText={t('featureFlags.strategyTitleHelp')}
                                    />

                                    {/* Rollout % for flexible rollout */}
                                    {(editingStrategy.name === 'flexibleRollout' || editingStrategy.name?.includes('Rollout')) && (
                                        <Paper variant="outlined" sx={{ p: 2 }}>
                                            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                {t('featureFlags.rollout')}
                                                <Tooltip title={t('featureFlags.rolloutTooltip')}>
                                                    <HelpOutlineIcon fontSize="small" color="action" />
                                                </Tooltip>
                                            </Typography>
                                            <Box sx={{ px: 2, pt: 3 }}>
                                                <Slider
                                                    value={editingStrategy.parameters?.rollout ?? 100}
                                                    onChange={(_, value) => setEditingStrategy({
                                                        ...editingStrategy,
                                                        parameters: { ...editingStrategy.parameters, rollout: value as number }
                                                    })}
                                                    valueLabelDisplay="on"
                                                    min={0}
                                                    max={100}
                                                    marks={[
                                                        { value: 0, label: '0%' },
                                                        { value: 25, label: '25%' },
                                                        { value: 50, label: '50%' },
                                                        { value: 75, label: '75%' },
                                                        { value: 100, label: '100%' },
                                                    ]}
                                                />
                                            </Box>

                                            {/* Stickiness & GroupId */}
                                            <Grid container spacing={2} sx={{ mt: 2 }}>
                                                <Grid item xs={6}>
                                                    <FormControl fullWidth size="small">
                                                        <InputLabel>{t('featureFlags.stickiness')}</InputLabel>
                                                        <Select
                                                            value={editingStrategy.parameters?.stickiness || 'default'}
                                                            onChange={(e) => setEditingStrategy({
                                                                ...editingStrategy,
                                                                parameters: { ...editingStrategy.parameters, stickiness: e.target.value }
                                                            })}
                                                            label={t('featureFlags.stickiness')}
                                                        >
                                                            <MenuItem value="default">{t('featureFlags.stickinessDefault')}</MenuItem>
                                                            <MenuItem value="userId">{t('featureFlags.stickinessUserId')}</MenuItem>
                                                            <MenuItem value="sessionId">{t('featureFlags.stickinessSessionId')}</MenuItem>
                                                            <MenuItem value="random">{t('featureFlags.stickinessRandom')}</MenuItem>
                                                        </Select>
                                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                                                            {t('featureFlags.stickinessHelp')}
                                                        </Typography>
                                                    </FormControl>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        label={t('featureFlags.groupId')}
                                                        value={editingStrategy.parameters?.groupId || flag?.flagName || ''}
                                                        onChange={(e) => setEditingStrategy({
                                                            ...editingStrategy,
                                                            parameters: { ...editingStrategy.parameters, groupId: e.target.value }
                                                        })}
                                                    />
                                                </Grid>
                                            </Grid>
                                        </Paper>
                                    )}

                                    {/* User IDs input for userWithId strategy */}
                                    {editingStrategy.name === 'userWithId' && (
                                        <Paper variant="outlined" sx={{ p: 2 }}>
                                            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                {t('featureFlags.userIds')} <Typography component="span" color="error.main">*</Typography>
                                                <Tooltip title={t('featureFlags.userIdsTooltip')}>
                                                    <HelpOutlineIcon fontSize="small" color="action" />
                                                </Tooltip>
                                            </Typography>
                                            <Autocomplete
                                                multiple
                                                freeSolo
                                                options={[]}
                                                value={editingStrategy.parameters?.userIds || []}
                                                onChange={(_, newValue) => setEditingStrategy({
                                                    ...editingStrategy,
                                                    parameters: { ...editingStrategy.parameters, userIds: newValue }
                                                })}
                                                renderInput={(params) => (
                                                    <TextField
                                                        {...params}
                                                        size="small"
                                                        required
                                                        error={!(editingStrategy.parameters?.userIds?.length > 0)}
                                                        placeholder={t('featureFlags.userIdsPlaceholder')}
                                                        helperText={t('featureFlags.userIdsHelp')}
                                                    />
                                                )}
                                                renderTags={(value, getTagProps) =>
                                                    value.map((option, index) => (
                                                        <Chip
                                                            {...getTagProps({ index })}
                                                            key={option}
                                                            label={option}
                                                            size="small"
                                                        />
                                                    ))
                                                }
                                            />
                                        </Paper>
                                    )}

                                    {/* Remote addresses input for remoteAddress strategy */}
                                    {editingStrategy.name === 'remoteAddress' && (
                                        <Paper variant="outlined" sx={{ p: 2 }}>
                                            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                {t('featureFlags.remoteAddresses')} <Typography component="span" color="error.main">*</Typography>
                                                <Tooltip title={t('featureFlags.remoteAddressesTooltip')}>
                                                    <HelpOutlineIcon fontSize="small" color="action" />
                                                </Tooltip>
                                            </Typography>
                                            <Autocomplete
                                                multiple
                                                freeSolo
                                                options={[]}
                                                value={editingStrategy.parameters?.IPs || []}
                                                onChange={(_, newValue) => setEditingStrategy({
                                                    ...editingStrategy,
                                                    parameters: { ...editingStrategy.parameters, IPs: newValue }
                                                })}
                                                renderInput={(params) => (
                                                    <TextField
                                                        {...params}
                                                        size="small"
                                                        required
                                                        error={!(editingStrategy.parameters?.IPs?.length > 0)}
                                                        placeholder={t('featureFlags.remoteAddressesPlaceholder')}
                                                        helperText={t('featureFlags.remoteAddressesHelp')}
                                                    />
                                                )}
                                                renderTags={(value, getTagProps) =>
                                                    value.map((option, index) => (
                                                        <Chip
                                                            {...getTagProps({ index })}
                                                            key={option}
                                                            label={option}
                                                            size="small"
                                                        />
                                                    ))
                                                }
                                            />
                                        </Paper>
                                    )}

                                    {/* Hostnames input for applicationHostname strategy */}
                                    {editingStrategy.name === 'applicationHostname' && (
                                        <Paper variant="outlined" sx={{ p: 2 }}>
                                            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                {t('featureFlags.hostnames')} <Typography component="span" color="error.main">*</Typography>
                                                <Tooltip title={t('featureFlags.hostnamesTooltip')}>
                                                    <HelpOutlineIcon fontSize="small" color="action" />
                                                </Tooltip>
                                            </Typography>
                                            <Autocomplete
                                                multiple
                                                freeSolo
                                                options={[]}
                                                value={editingStrategy.parameters?.hostNames || []}
                                                onChange={(_, newValue) => setEditingStrategy({
                                                    ...editingStrategy,
                                                    parameters: { ...editingStrategy.parameters, hostNames: newValue }
                                                })}
                                                renderInput={(params) => (
                                                    <TextField
                                                        {...params}
                                                        size="small"
                                                        required
                                                        error={!(editingStrategy.parameters?.hostNames?.length > 0)}
                                                        placeholder={t('featureFlags.hostnamesPlaceholder')}
                                                        helperText={t('featureFlags.hostnamesHelp')}
                                                    />
                                                )}
                                                renderTags={(value, getTagProps) =>
                                                    value.map((option, index) => (
                                                        <Chip
                                                            {...getTagProps({ index })}
                                                            key={option}
                                                            label={option}
                                                            size="small"
                                                        />
                                                    ))
                                                }
                                            />
                                        </Paper>
                                    )}

                                    {/* Strategy Status */}
                                    <Paper variant="outlined" sx={{ p: 2 }}>
                                        <Typography variant="subtitle2" gutterBottom>{t('featureFlags.strategyStatus')}</Typography>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={!editingStrategy.disabled}
                                                    onChange={(e) => setEditingStrategy({ ...editingStrategy, disabled: !e.target.checked })}
                                                />
                                            }
                                            label={
                                                <Box>
                                                    <Typography>{t('featureFlags.strategyActive')}</Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {t('featureFlags.strategyActiveHelp')}
                                                    </Typography>
                                                </Box>
                                            }
                                        />
                                    </Paper>
                                </Stack>
                            )}

                            {/* Targeting Tab */}
                            {strategyTabValue === 1 && (
                                <Stack spacing={3}>
                                    {/* Info Alert */}
                                    <Alert severity="info" sx={{ borderRadius: 2 }}>
                                        {t('featureFlags.targetingInfo')}
                                    </Alert>

                                    {/* Segments */}
                                    <Box>
                                        <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                                            {t('featureFlags.segments')}
                                            <Tooltip title={t('featureFlags.segmentsTooltip')}>
                                                <HelpOutlineIcon fontSize="small" color="action" />
                                            </Tooltip>
                                        </Typography>
                                        <Autocomplete
                                            multiple
                                            options={Array.isArray(segments) ? segments : []}
                                            getOptionLabel={(option) => option.displayName || option.segmentName || ''}
                                            value={(Array.isArray(segments) ? segments : []).filter(s => (editingStrategy.segments || []).includes(s.segmentName))}
                                            onChange={(_, newValue) => setEditingStrategy({
                                                ...editingStrategy,
                                                segments: newValue.map(s => s.segmentName)
                                            })}
                                            renderInput={(params) => (
                                                <TextField {...params} placeholder={t('featureFlags.selectSegments')} size="small" />
                                            )}
                                            renderTags={(value, getTagProps) =>
                                                value.map((option, index) => (
                                                    <Chip
                                                        {...getTagProps({ index })}
                                                        key={option.segmentName}
                                                        label={option.displayName || option.segmentName}
                                                        size="small"
                                                        onDelete={getTagProps({ index }).onDelete}
                                                    />
                                                ))
                                            }
                                        />

                                        {/* Selected Segments Preview */}
                                        {(editingStrategy.segments?.length || 0) > 0 && (
                                            <Stack spacing={1} sx={{ mt: 2 }}>
                                                {editingStrategy.segments?.map((segmentName) => {
                                                    const segment = segments.find(s => s.segmentName === segmentName);
                                                    if (!segment) return null;
                                                    return (
                                                        <Paper
                                                            key={segmentName}
                                                            variant="outlined"
                                                            sx={{
                                                                p: 1.5,
                                                                bgcolor: 'action.hover',
                                                                borderRadius: 1,
                                                            }}
                                                        >
                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                                <Typography variant="subtitle2" fontWeight={600}>
                                                                    {segment.displayName || segment.segmentName}
                                                                </Typography>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => {
                                                                        setExpandedSegmentsDialog(prev => {
                                                                            const next = new Set(prev);
                                                                            if (next.has(segmentName)) {
                                                                                next.delete(segmentName);
                                                                            } else {
                                                                                next.add(segmentName);
                                                                            }
                                                                            return next;
                                                                        });
                                                                    }}
                                                                >
                                                                    {expandedSegmentsDialog.has(segmentName) ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                                                                </IconButton>
                                                            </Box>
                                                            {segment.description && (
                                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                                                    {segment.description}
                                                                </Typography>
                                                            )}
                                                            {expandedSegmentsDialog.has(segmentName) && segment.constraints && segment.constraints.length > 0 && (
                                                                <Box sx={{ pl: 1, borderLeft: 2, borderColor: 'primary.main' }}>
                                                                    <ConstraintList
                                                                        constraints={segment.constraints}
                                                                        contextFields={contextFields}
                                                                    />
                                                                </Box>
                                                            )}
                                                            {expandedSegmentsDialog.has(segmentName) && (!segment.constraints || segment.constraints.length === 0) && (
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {t('featureFlags.noConstraintsInSegment')}
                                                                </Typography>
                                                            )}
                                                        </Paper>
                                                    );
                                                })}
                                            </Stack>
                                        )}
                                    </Box>

                                    {/* AND divider */}
                                    {(editingStrategy.segments?.length || 0) > 0 && (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Divider sx={{ flex: 1 }} />
                                            <Chip label="AND" size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, bgcolor: 'background.paper', color: 'text.secondary', border: 1, borderColor: 'divider' }} />
                                            <Divider sx={{ flex: 1 }} />
                                        </Box>
                                    )}

                                    {/* Constraints */}
                                    <Box>
                                        <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                                            {t('featureFlags.constraints')}
                                            <Tooltip title={t('featureFlags.constraintsTooltip')}>
                                                <HelpOutlineIcon fontSize="small" color="action" />
                                            </Tooltip>
                                        </Typography>
                                        <ConstraintEditor
                                            constraints={editingStrategy.constraints || []}
                                            onChange={(constraints) => setEditingStrategy({ ...editingStrategy, constraints })}
                                            contextFields={Array.isArray(contextFields) ? contextFields : []}
                                        />
                                    </Box>
                                </Stack>
                            )}

                            {/* Variants Tab */}
                            {strategyTabValue === 2 && (
                                <Stack spacing={3}>
                                    {/* Info Alert */}
                                    <Alert severity="info" sx={{ borderRadius: 2 }}>
                                        {t('featureFlags.variantsInfo')}
                                    </Alert>

                                    {/* Variant Type Selector */}
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            {t('featureFlags.variantType')}
                                            <Tooltip title={t('featureFlags.variantTypeHelp')}>
                                                <HelpOutlineIcon fontSize="small" color="action" />
                                            </Tooltip>
                                        </Typography>
                                        <FormControl size="small" sx={{ minWidth: 150 }}>
                                            <Select
                                                value={flag?.variantType || 'string'}
                                                onChange={(e) => {
                                                    const newType = e.target.value as 'string' | 'json' | 'number';
                                                    // Determine default value based on type
                                                    const defaultValue = newType === 'number' ? '0' : newType === 'json' ? '{}' : '';
                                                    // Reset all variant payload values when type changes
                                                    if (editingStrategy?.variants) {
                                                        const updatedVariants = editingStrategy.variants.map(v => ({
                                                            ...v,
                                                            payload: v.payload ? { ...v.payload, value: defaultValue } : { type: 'string', value: defaultValue }
                                                        }));
                                                        setEditingStrategy({ ...editingStrategy, variants: updatedVariants });
                                                    }
                                                    setFlag(prev => prev ? { ...prev, variantType: newType } : prev);
                                                }}
                                                renderValue={(value) => (
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        {value === 'string' && <StringIcon sx={{ fontSize: 16, color: 'info.main' }} />}
                                                        {value === 'number' && <NumberIcon sx={{ fontSize: 16, color: 'success.main' }} />}
                                                        {value === 'json' && <JsonIcon sx={{ fontSize: 16, color: 'warning.main' }} />}
                                                        {t(`featureFlags.variantTypes.${value}`)}
                                                    </Box>
                                                )}
                                            >
                                                <MenuItem value="string">
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <StringIcon sx={{ fontSize: 16, color: 'info.main' }} />
                                                        {t('featureFlags.variantTypes.string')}
                                                    </Box>
                                                </MenuItem>
                                                <MenuItem value="number">
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <NumberIcon sx={{ fontSize: 16, color: 'success.main' }} />
                                                        {t('featureFlags.variantTypes.number')}
                                                    </Box>
                                                </MenuItem>
                                                <MenuItem value="json">
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <JsonIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                                                        {t('featureFlags.variantTypes.json')}
                                                    </Box>
                                                </MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Box>

                                    {/* Payload Size Warning for string/json types */}
                                    {(flag?.variantType === 'string' || flag?.variantType === 'json') && (
                                        <Alert severity="warning" sx={{ borderRadius: 2 }}>
                                            {t('featureFlags.payloadSizeWarning')}
                                        </Alert>
                                    )}

                                    {/* Variants List */}
                                    <Box>
                                        <Box sx={{ mb: 2 }}>
                                            <Typography variant="subtitle2">
                                                {t('featureFlags.variants')} ({editingStrategy.variants?.length || 0})
                                            </Typography>
                                        </Box>

                                        {(!editingStrategy.variants || editingStrategy.variants.length === 0) ? (
                                            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
                                                <Typography color="text.secondary" sx={{ mb: 2 }}>
                                                    {t('featureFlags.noVariantsGuide')}
                                                </Typography>
                                                <Button
                                                    variant="contained"
                                                    size="small"
                                                    startIcon={<AddIcon />}
                                                    onClick={addVariantWithAutoDistribution}
                                                >
                                                    {t('featureFlags.addVariant')}
                                                </Button>
                                            </Paper>
                                        ) : (
                                            <Stack spacing={2}>
                                                {/* Weight Distribution Bar */}
                                                <Box sx={{ height: 24, display: 'flex', borderRadius: 1, overflow: 'hidden' }}>
                                                    {editingStrategy.variants.map((variant, index) => {
                                                        const colors = ['#7C4DFF', '#448AFF', '#00BFA5', '#FF6D00', '#FF4081', '#536DFE'];
                                                        return (
                                                            <Tooltip key={index} title={`${variant.name}: ${variant.weight}%`}>
                                                                <Box
                                                                    sx={{
                                                                        width: `${variant.weight}%`,
                                                                        bgcolor: colors[index % colors.length],
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        color: 'white',
                                                                        fontSize: '0.75rem',
                                                                        fontWeight: 500,
                                                                        minWidth: variant.weight > 10 ? 'auto' : 0,
                                                                    }}
                                                                >
                                                                    {variant.weight > 15 && `${variant.weight}%`}
                                                                </Box>
                                                            </Tooltip>
                                                        );
                                                    })}
                                                </Box>

                                                {/* Variant Cards */}
                                                {editingStrategy.variants.map((variant, index) => {
                                                    // Use flag's variantType for all variants
                                                    const payloadType = flag?.variantType || 'string';
                                                    const hasJsonError = strategyJsonErrors[index] !== undefined && strategyJsonErrors[index] !== null;
                                                    const colors = ['#7C4DFF', '#448AFF', '#00BFA5', '#FF6D00', '#FF4081', '#536DFE'];
                                                    const variantColor = colors[index % colors.length];
                                                    return (
                                                        <Box key={index} sx={{ display: 'flex', border: 1, borderColor: 'divider', overflow: 'hidden' }}>
                                                            {/* Color indicator bar */}
                                                            <Box sx={{ width: 4, bgcolor: variantColor, flexShrink: 0 }} />
                                                            {/* Content */}
                                                            <Box sx={{ p: 2, flex: 1 }}>
                                                                {/* Row 1: Name, Fixed Weight Checkbox, Weight, Delete */}
                                                                <Grid container spacing={2} alignItems="center">
                                                                    <Grid size={4}>
                                                                        <TextField
                                                                            fullWidth
                                                                            size="small"
                                                                            label={t('featureFlags.variantName')}
                                                                            value={variant.name}
                                                                            onChange={(e) => {
                                                                                const updated = [...(editingStrategy.variants || [])];
                                                                                updated[index] = { ...updated[index], name: e.target.value };
                                                                                setEditingStrategy({ ...editingStrategy, variants: updated });
                                                                            }}
                                                                        />
                                                                    </Grid>
                                                                    <Grid size={3}>
                                                                        <FormControlLabel
                                                                            control={
                                                                                <Checkbox
                                                                                    size="small"
                                                                                    checked={variant.weightLock || false}
                                                                                    onChange={(e) => toggleWeightLock(index, e.target.checked)}
                                                                                />
                                                                            }
                                                                            label={<Typography variant="body2">{t('featureFlags.fixedWeight')}</Typography>}
                                                                        />
                                                                    </Grid>
                                                                    <Grid size={3}>
                                                                        <TextField
                                                                            fullWidth
                                                                            size="small"
                                                                            type="number"
                                                                            label={t('featureFlags.weight')}
                                                                            value={variant.weight}
                                                                            disabled={!variant.weightLock}
                                                                            onChange={(e) => {
                                                                                if (variant.weightLock) {
                                                                                    updateVariantWeight(index, parseInt(e.target.value) || 0, true);
                                                                                }
                                                                            }}
                                                                            InputProps={{
                                                                                endAdornment: '%',
                                                                                readOnly: !variant.weightLock,
                                                                            }}
                                                                        />
                                                                    </Grid>
                                                                    <Grid size={2} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                                        <IconButton
                                                                            size="small"
                                                                            color="error"
                                                                            onClick={() => removeVariantWithAutoDistribution(index)}
                                                                        >
                                                                            <DeleteIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </Grid>
                                                                </Grid>

                                                                {/* Row 2: Payload Value Editor based on flag's variantType */}
                                                                <Box sx={{ mt: 2 }}>
                                                                    {payloadType === 'string' && (
                                                                        <TextField
                                                                            fullWidth
                                                                            size="small"
                                                                            label={t('featureFlags.payload')}
                                                                            value={variant.payload?.value || ''}
                                                                            onChange={(e) => {
                                                                                const updated = [...(editingStrategy.variants || [])];
                                                                                updated[index] = {
                                                                                    ...updated[index],
                                                                                    payload: { type: 'string', value: e.target.value },
                                                                                };
                                                                                setEditingStrategy({ ...editingStrategy, variants: updated });
                                                                            }}
                                                                        />
                                                                    )}
                                                                    {payloadType === 'number' && (
                                                                        <TextField
                                                                            fullWidth
                                                                            size="small"
                                                                            type="number"
                                                                            label={t('featureFlags.payload')}
                                                                            value={variant.payload?.value || ''}
                                                                            onChange={(e) => {
                                                                                const updated = [...(editingStrategy.variants || [])];
                                                                                updated[index] = {
                                                                                    ...updated[index],
                                                                                    payload: { type: 'number', value: e.target.value },
                                                                                };
                                                                                setEditingStrategy({ ...editingStrategy, variants: updated });
                                                                            }}
                                                                        />
                                                                    )}
                                                                    {payloadType === 'json' && (
                                                                        <Box>
                                                                            <JsonEditor
                                                                                value={variant.payload?.value || '{}'}
                                                                                onChange={(value) => {
                                                                                    const updated = [...(editingStrategy.variants || [])];
                                                                                    updated[index] = {
                                                                                        ...updated[index],
                                                                                        payload: { type: 'json', value },
                                                                                    };
                                                                                    setEditingStrategy({ ...editingStrategy, variants: updated });
                                                                                }}
                                                                                onValidation={(isValid, error) => {
                                                                                    setStrategyJsonErrors(prev => ({
                                                                                        ...prev,
                                                                                        [index]: isValid ? null : (error || 'Invalid JSON'),
                                                                                    }));
                                                                                }}
                                                                                height={150}
                                                                                label={t('featureFlags.payload')}
                                                                            />
                                                                            {hasJsonError && (
                                                                                <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                                                                                    {strategyJsonErrors[index]}
                                                                                </Typography>
                                                                            )}
                                                                        </Box>
                                                                    )}
                                                                </Box>
                                                            </Box>
                                                        </Box>
                                                    );
                                                })}

                                                {/* Total Weight Warning */}
                                                {(() => {
                                                    const total = editingStrategy.variants?.reduce((sum, v) => sum + (v.weight || 0), 0) || 0;
                                                    if (total !== 100) {
                                                        return (
                                                            <Alert severity="warning">
                                                                {t('featureFlags.weightWarning', { total })}
                                                            </Alert>
                                                        );
                                                    }
                                                    return null;
                                                })()}

                                                {/* Add Variant Button at bottom */}
                                                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                    <Button
                                                        size="small"
                                                        startIcon={<AddIcon />}
                                                        onClick={addVariantWithAutoDistribution}
                                                    >
                                                        {t('featureFlags.addVariant')}
                                                    </Button>
                                                </Box>
                                            </Stack>
                                        )
                                        }
                                    </Box>
                                </Stack>
                            )}
                        </Box>

                        {/* Footer */}
                        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                            <Button onClick={() => { setStrategyDialogOpen(false); setExpandedSegmentsDialog(new Set()); }}>{t('common.cancel')}</Button>
                            <Button
                                variant="contained"
                                onClick={handleSaveStrategy}
                                disabled={(() => {
                                    // When editing, require changes to be made (check both strategy and variantType)
                                    const strategyUnchanged = JSON.stringify(editingStrategy) === JSON.stringify(originalEditingStrategy);
                                    const variantTypeUnchanged = flag?.variantType === originalFlag?.variantType;
                                    if (!isAddingStrategy && strategyUnchanged && variantTypeUnchanged) {
                                        return true;
                                    }
                                    // Disable if any JSON errors
                                    if (Object.values(strategyJsonErrors).some(e => e !== null)) {
                                        return true;
                                    }
                                    // Validate list-based strategies require non-empty lists
                                    if (editingStrategy.name === 'userWithId') {
                                        const userIds = editingStrategy.parameters?.userIds;
                                        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
                                            return true;
                                        }
                                    }
                                    if (editingStrategy.name === 'remoteAddress') {
                                        const ips = editingStrategy.parameters?.IPs;
                                        if (!ips || !Array.isArray(ips) || ips.length === 0) {
                                            return true;
                                        }
                                    }
                                    if (editingStrategy.name === 'applicationHostname') {
                                        const hostNames = editingStrategy.parameters?.hostNames;
                                        if (!hostNames || !Array.isArray(hostNames) || hostNames.length === 0) {
                                            return true;
                                        }
                                    }
                                    return false;
                                })()}
                            >
                                {t('featureFlags.saveStrategy')}
                            </Button>
                        </Box>
                    </>
                )}
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

            {/* Link Add/Edit Dialog */}
            <Dialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {editingLinkIndex !== null ? t('featureFlags.links.editLink') : t('featureFlags.links.addLink')}
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            fullWidth
                            size="small"
                            label={t('featureFlags.links.url')}
                            placeholder="https://example.com"
                            value={editingLink.url}
                            onChange={(e) => setEditingLink({ ...editingLink, url: e.target.value })}
                            required
                        />
                        <TextField
                            fullWidth
                            size="small"
                            label={t('featureFlags.links.titleLabel')}
                            placeholder={t('featureFlags.links.titlePlaceholder')}
                            value={editingLink.title || ''}
                            onChange={(e) => setEditingLink({ ...editingLink, title: e.target.value })}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setLinkDialogOpen(false)}>{t('common.cancel')}</Button>
                    <Button
                        variant="contained"
                        onClick={handleSaveLink}
                        disabled={!editingLink.url}
                    >
                        {t('common.save')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default FeatureFlagDetailPage;
