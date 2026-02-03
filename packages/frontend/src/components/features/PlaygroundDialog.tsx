/**
 * PlaygroundDialog - Feature Flag Playground Component
 * Allows testing feature flag evaluation with custom context
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    Box,
    Typography,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    IconButton,
    Autocomplete,
    TextField,
    Chip,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    CircularProgress,
    Collapse,
    Alert,
    Stack,
    Tooltip,
    Popover,
    FormHelperText,
    Select,
    MenuItem,
    FormControl,
} from '@mui/material';
import {
    Close as CloseIcon,
    PlayArrow as PlayIcon,
    Add as AddIcon,
    Delete as DeleteIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    CheckCircle as TrueIcon,
    Cancel as FalseIcon,
    HelpOutline as HelpIcon,
    OpenInNew as OpenInNewIcon,
    RocketLaunch as ReleaseIcon,
    Science as ExperimentIcon,
    Settings as OperationalIcon,
    PowerSettingsNew as KillSwitchIcon,
    Security as PermissionIcon,
    Flag as FlagIcon,
    Tune as RemoteConfigIcon,
    DataObject as JsonIcon,
    Code as CodeIcon,
    Abc as StringIcon,
    Numbers as NumberIcon,
    ToggleOn as BooleanIcon,
    Schedule as DateTimeIcon,
    LocalOffer as SemverIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import { parseApiErrorMessage } from '../../utils/errorUtils';
import { Environment, environmentService } from '../../services/environmentService';
import api from '../../services/api';
import ConstraintDisplay from './ConstraintDisplay';
import LocalizedDateTimePicker from '../common/LocalizedDateTimePicker';


interface ContextField {
    fieldName: string;
    displayName: string;
    description?: string;
    valueType: 'string' | 'number' | 'boolean' | 'date' | 'semver';
    legalValues?: string[];
}

interface ContextEntry {
    key: string;
    value: string;
    type: 'string' | 'number' | 'boolean' | 'date' | 'semver';
}

interface EvaluationResult {
    flagName: string;
    displayName?: string;
    flagUsage?: string;
    enabled: boolean;
    variant?: {
        name: string;
        payload?: any;
        payloadType?: string;
        payloadSource?: 'variant' | 'baseline';
    };
    reason: string;
    reasonDetails?: {
        strategyName?: string;
        strategyIndex?: number;
        constraints?: any[];
        segments?: string[];
        matchedSegment?: string;
        failedConstraint?: any;
        failedSegment?: string;
    };
    evaluationSteps?: EvaluationStep[];
}

interface EvaluationStep {
    step: string;
    passed: boolean | null;
    message?: string;
    strategyIndex?: number;
    strategyName?: string;
    isEnabled?: boolean;
    checks?: EvaluationCheck[];
}

interface EvaluationCheck {
    type: string;
    passed: boolean;
    segment?: string;
    constraint?: any;
    contextValue?: any;
    rollout?: number;
    percentage?: number;
    name?: string;
    message?: string;
}

interface PlaygroundDialogProps {
    open: boolean;
    onClose: () => void;
    /** Pre-select flags for evaluation */
    initialFlags?: string[];
    /** Pre-select environments for evaluation */
    initialEnvironments?: string[];
    /** Pre-set context values for evaluation */
    initialContext?: Record<string, any>;
    /** Auto-execute evaluation when dialog opens */
    autoExecute?: boolean;
}

const PlaygroundDialog: React.FC<PlaygroundDialogProps> = ({
    open,
    onClose,
    initialFlags,
    initialEnvironments,
    initialContext,
    autoExecute = false,
}) => {
    const { t } = useTranslation();
    const { enqueueSnackbar } = useSnackbar();
    const navigate = useNavigate();

    // State
    const [environments, setEnvironments] = useState<Environment[]>([]);
    const [selectedEnvironments, setSelectedEnvironments] = useState<string[]>([]);
    const [contextFields, setContextFields] = useState<ContextField[]>([]);
    const [contextEntries, setContextEntries] = useState<ContextEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<Record<string, EvaluationResult[]>>({});
    const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedFlags, setSelectedFlags] = useState<string[]>([]);
    const [availableFlags, setAvailableFlags] = useState<{ flagName: string; displayName?: string }[]>([]);
    const [autoExecutePending, setAutoExecutePending] = useState(false);;

    // Variant popover state
    const [variantPopoverAnchor, setVariantPopoverAnchor] = useState<HTMLElement | null>(null);
    const [selectedVariant, setSelectedVariant] = useState<EvaluationResult['variant'] | null>(null);

    // Evaluation details popover state
    const [evaluationPopoverAnchor, setEvaluationPopoverAnchor] = useState<HTMLElement | null>(null);
    const [selectedEvaluation, setSelectedEvaluation] = useState<{ env: string; result: EvaluationResult } | null>(null);

    // Load environments and context fields
    useEffect(() => {
        if (open) {
            loadEnvironments();
            loadContextFields();
            loadAvailableFlags();
            // Reset state when opening
            setResults({});
            setSearchTerm('');
            // Set initial flags if provided
            if (initialFlags && initialFlags.length > 0) {
                setSelectedFlags(initialFlags);
            } else {
                setSelectedFlags([]);
            }
            // Set initial environments if provided
            if (initialEnvironments && initialEnvironments.length > 0) {
                setSelectedEnvironments(initialEnvironments);
            } else {
                setSelectedEnvironments([]);
            }
            // Set initial context if provided
            if (initialContext && Object.keys(initialContext).length > 0) {
                const entries: ContextEntry[] = Object.entries(initialContext).map(([key, value]) => ({
                    key,
                    value: String(value),
                    type: typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string',
                }));
                setContextEntries(entries);
            } else {
                setContextEntries([]);
            }
            // Set auto-execute pending if requested
            setAutoExecutePending(autoExecute);
        }
    }, [open, initialFlags, initialEnvironments, initialContext, autoExecute]);

    const loadEnvironments = async () => {
        try {
            const envs = await environmentService.getEnvironments();
            setEnvironments(envs.filter((e) => !e.isHidden).sort((a, b) => a.displayOrder - b.displayOrder));
        } catch {
            setEnvironments([]);
        }
    };

    const loadContextFields = async () => {
        try {
            const response = await api.get('/admin/features/context-fields');
            setContextFields(response.data?.contextFields || []);
        } catch {
            setContextFields([]);
        }
    };

    const loadAvailableFlags = async () => {
        try {
            const response = await api.get('/admin/features', {
                params: { page: 1, limit: 1000, isArchived: false }
            });
            const flags = response.data?.data || [];
            setAvailableFlags(flags.map((f: any) => ({ flagName: f.flagName, displayName: f.displayName })));
        } catch {
            setAvailableFlags([]);
        }
    };

    // Auto-execute when initialFlagName is provided and environments are loaded
    useEffect(() => {
        if (autoExecutePending && environments.length > 0 && !loading) {
            handleEvaluate();
        }
    }, [autoExecutePending, environments.length]);

    // Add context entry
    const handleAddContextEntry = () => {
        setContextEntries([...contextEntries, { key: '', value: '', type: 'string' }]);
    };

    // Remove context entry
    const handleRemoveContextEntry = (index: number) => {
        const newEntries = [...contextEntries];
        newEntries.splice(index, 1);
        setContextEntries(newEntries);
    };

    // Update context entry
    const handleUpdateContextEntry = (index: number, field: 'key' | 'value' | 'type', value: string) => {
        const newEntries = [...contextEntries];
        newEntries[index] = { ...newEntries[index], [field]: value };

        // Auto-detect type when key changes
        if (field === 'key') {
            const contextField = contextFields.find(f => f.fieldName === value);
            if (contextField) {
                newEntries[index].type = contextField.valueType === 'datetime' ? 'date' : contextField.valueType;
            }
        }

        setContextEntries(newEntries);
    };

    // Get context field by key
    const getContextFieldByKey = (key: string): ContextField | undefined => {
        return contextFields.find(f => f.fieldName === key);
    };

    // Build context object
    const buildContext = () => {
        const context: Record<string, any> = {};
        for (const entry of contextEntries) {
            if (entry.key.trim()) {
                let value: any = entry.value;
                // Convert value based on type
                switch (entry.type) {
                    case 'number':
                        value = Number(entry.value) || 0;
                        break;
                    case 'boolean':
                        value = entry.value === 'true';
                        break;
                    default:
                        value = entry.value;
                }
                context[entry.key.trim()] = value;
            }
        }
        return context;
    };

    // Navigate to flag detail
    const handleFlagClick = (flagName: string) => {
        onClose();
        navigate(`/feature-flags/${encodeURIComponent(flagName)}`);
    };

    // Open variant popover
    const handleVariantClick = (event: React.MouseEvent<HTMLElement>, variant: EvaluationResult['variant']) => {
        setVariantPopoverAnchor(event.currentTarget);
        setSelectedVariant(variant || null);
    };

    // Close variant popover
    const handleVariantPopoverClose = () => {
        setVariantPopoverAnchor(null);
        setSelectedVariant(null);
    };

    // Close evaluation popover
    const handleEvaluationPopoverClose = () => {
        setEvaluationPopoverAnchor(null);
        setSelectedEvaluation(null);
    };

    // Evaluate
    const handleEvaluate = async () => {
        setLoading(true);
        setAutoExecutePending(false);
        try {
            // Add intentional delay for UX testing
            await new Promise((resolve) => setTimeout(resolve, 2000));

            const context = buildContext();
            // If no environments selected, use all available environments
            const envsToEvaluate = selectedEnvironments.length > 0
                ? selectedEnvironments
                : environments.map(e => e.environment);

            const requestBody: any = {
                environments: envsToEvaluate,
                context,
            };

            // If specific flags are selected, only evaluate those
            if (selectedFlags.length > 0) {
                requestBody.flagNames = selectedFlags;
            }

            const response = await api.post('/admin/features/playground', requestBody);

            setResults(response.data?.results || {});
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'playground.evaluationFailed'), {
                variant: 'error',
            });
        } finally {
            setLoading(false);
        }
    };

    // Toggle result expansion
    const toggleResultExpansion = (key: string) => {
        const newExpanded = new Set(expandedResults);
        if (newExpanded.has(key)) {
            newExpanded.delete(key);
        } else {
            newExpanded.add(key);
        }
        setExpandedResults(newExpanded);
    };

    // Filter results by search
    const filteredResults = useMemo(() => {
        if (!searchTerm.trim()) return results;
        const term = searchTerm.toLowerCase();
        const filtered: Record<string, EvaluationResult[]> = {};
        for (const [env, envResults] of Object.entries(results)) {
            const matchedResults = envResults.filter(
                (r) =>
                    r.flagName.toLowerCase().includes(term) ||
                    r.displayName?.toLowerCase().includes(term)
            );
            if (matchedResults.length > 0) {
                filtered[env] = matchedResults;
            }
        }
        return filtered;
    }, [results, searchTerm]);

    // Get reason text
    const getReasonText = (result: EvaluationResult) => {
        switch (result.reason) {
            case 'FLAG_DISABLED':
                return t('playground.reasons.flagDisabled');
            case 'FLAG_ARCHIVED':
                return t('playground.reasons.flagArchived');
            case 'NO_STRATEGIES':
                return t('playground.reasons.noStrategies');
            case 'STRATEGY_MATCHED':
                return t('playground.reasons.strategyMatched', {
                    strategy: result.reasonDetails?.strategyName || `#${(result.reasonDetails?.strategyIndex ?? 0) + 1}`,
                });
            case 'DEFAULT_STRATEGY':
                return t('playground.reasons.defaultStrategy');
            case 'NO_MATCHING_STRATEGY':
                return t('playground.reasons.noMatchingStrategy');
            case 'SEGMENT_MATCHED':
                return t('playground.reasons.segmentMatched', {
                    segment: result.reasonDetails?.matchedSegment,
                });
            case 'SEGMENT_NOT_MATCHED':
                return t('playground.reasons.segmentNotMatched', {
                    segment: result.reasonDetails?.failedSegment,
                });
            case 'CONSTRAINT_NOT_MATCHED':
                return t('playground.reasons.constraintNotMatched');
            case 'ROLLOUT_EXCLUDED':
                return t('playground.reasons.rolloutExcluded');
            case 'ROLLOUT_INCLUDED':
                return t('playground.reasons.rolloutIncluded');
            default:
                return result.reason;
        }
    };

    // Get type icon for flag type
    const getTypeIcon = (type: string) => {
        const iconProps = { sx: { fontSize: 16 } };
        switch (type) {
            case 'release':
                return <ReleaseIcon {...iconProps} color="primary" />;
            case 'experiment':
                return <ExperimentIcon {...iconProps} color="secondary" />;
            case 'operational':
                return <OperationalIcon {...iconProps} color="warning" />;
            case 'killSwitch':
                return <KillSwitchIcon {...iconProps} color="error" />;
            case 'permission':
                return <PermissionIcon {...iconProps} color="action" />;
            case 'remoteConfig':
                return <CodeIcon {...iconProps} color="info" />;
            default:
                return <FlagIcon {...iconProps} />;
        }
    };

    // Get total result count
    const totalResults = useMemo(() => {
        return Object.values(results).reduce((sum, arr) => sum + arr.length, 0);
    }, [results]);

    const canEvaluate = environments.length > 0;

    return (
        <>
            <Dialog
                open={open}
                onClose={onClose}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: { minHeight: '80vh' },
                }}
            >
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PlayIcon color="primary" />
                        <Box>
                            <Typography variant="h6">{t('playground.title')}</Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('playground.subtitle')}
                            </Typography>
                        </Box>
                    </Box>
                    <IconButton onClick={onClose} size="small">
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <DialogContent dividers>
                    <Stack spacing={3}>
                        {/* Configuration Section */}
                        <Paper variant="outlined" sx={{ p: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                                {t('playground.configuration')}
                            </Typography>

                            {/* Environment Selection */}
                            <Box sx={{ mb: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        {t('playground.selectEnvironments')}
                                    </Typography>
                                    <Tooltip title={t('playground.environmentHelp')}>
                                        <HelpIcon sx={{ fontSize: 16, color: 'text.disabled', cursor: 'help' }} />
                                    </Tooltip>
                                </Box>
                                <Autocomplete
                                    multiple
                                    options={environments.map((e) => e.environment)}
                                    value={selectedEnvironments}
                                    onChange={(_, value) => setSelectedEnvironments(value)}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            size="small"
                                            placeholder={t('playground.environmentPlaceholder')}
                                        />
                                    )}
                                    renderTags={(value, getTagProps) =>
                                        value.map((option, index) => (
                                            <Chip
                                                {...getTagProps({ index })}
                                                key={option}
                                                label={option}
                                                size="small"
                                                color="primary"
                                                variant="outlined"
                                                sx={{ borderRadius: '16px' }}
                                            />
                                        ))
                                    }
                                />
                                <FormHelperText>
                                    {t('playground.environmentHelpDetail')}
                                </FormHelperText>
                            </Box>

                            {/* Context Fields */}
                            <Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            {t('playground.contextFields')}
                                        </Typography>
                                        <Tooltip title={t('playground.contextFieldsHelp')}>
                                            <HelpIcon sx={{ fontSize: 16, color: 'text.disabled', cursor: 'help' }} />
                                        </Tooltip>
                                    </Box>
                                    <Button
                                        size="small"
                                        startIcon={<AddIcon />}
                                        onClick={handleAddContextEntry}
                                    >
                                        {t('common.add')}
                                    </Button>
                                </Box>

                                {contextEntries.length === 0 ? (
                                    <Alert severity="info" sx={{ mb: 2 }}>
                                        {t('playground.noContextFields')}
                                    </Alert>
                                ) : (
                                    <Stack spacing={1} sx={{ mb: 2 }}>
                                        {contextEntries.map((entry, index) => {
                                            const contextField = getContextFieldByKey(entry.key);
                                            const hasLegalValues = contextField?.legalValues && contextField.legalValues.length > 0;
                                            const fieldType = contextField?.valueType || 'string';

                                            // Get icon for field type
                                            const getTypeIcon = (type: string) => {
                                                switch (type) {
                                                    case 'string':
                                                        return <StringIcon sx={{ fontSize: 16, color: 'info.main' }} />;
                                                    case 'number':
                                                        return <NumberIcon sx={{ fontSize: 16, color: 'success.main' }} />;
                                                    case 'boolean':
                                                        return <BooleanIcon sx={{ fontSize: 16, color: 'warning.main' }} />;
                                                    case 'date':
                                                    case 'datetime':
                                                        return <DateTimeIcon sx={{ fontSize: 16, color: 'secondary.main' }} />;
                                                    case 'semver':
                                                        return <SemverIcon sx={{ fontSize: 16, color: 'primary.main' }} />;
                                                    default:
                                                        return <StringIcon sx={{ fontSize: 16, color: 'text.disabled' }} />;
                                                }
                                            };

                                            // Render value input based on field type
                                            const renderValueInput = () => {
                                                // Boolean type
                                                if (fieldType === 'boolean') {
                                                    return (
                                                        <FormControl size="small" fullWidth>
                                                            <Select
                                                                value={entry.value || 'true'}
                                                                onChange={(e) => handleUpdateContextEntry(index, 'value', e.target.value)}
                                                            >
                                                                <MenuItem value="true">True</MenuItem>
                                                                <MenuItem value="false">False</MenuItem>
                                                            </Select>
                                                        </FormControl>
                                                    );
                                                }

                                                // Date/datetime type
                                                if (fieldType === 'date' || fieldType === 'datetime') {
                                                    return (
                                                        <LocalizedDateTimePicker
                                                            value={entry.value || null}
                                                            onChange={(isoString: string) => handleUpdateContextEntry(index, 'value', isoString)}
                                                        />
                                                    );
                                                }

                                                // Legal values - use Select dropdown
                                                if (hasLegalValues) {
                                                    return (
                                                        <FormControl size="small" fullWidth>
                                                            <Select
                                                                value={entry.value || ''}
                                                                onChange={(e) => handleUpdateContextEntry(index, 'value', e.target.value)}
                                                                displayEmpty
                                                            >
                                                                <MenuItem value="" disabled>
                                                                    <em>{t('playground.selectValue')}</em>
                                                                </MenuItem>
                                                                {(contextField?.legalValues || []).map((lv) => (
                                                                    <MenuItem key={lv} value={lv}>{lv}</MenuItem>
                                                                ))}
                                                            </Select>
                                                        </FormControl>
                                                    );
                                                }

                                                // Number type
                                                if (fieldType === 'number') {
                                                    return (
                                                        <TextField
                                                            fullWidth
                                                            size="small"
                                                            type="number"
                                                            placeholder="0"
                                                            value={entry.value}
                                                            onChange={(e) => handleUpdateContextEntry(index, 'value', e.target.value)}
                                                        />
                                                    );
                                                }

                                                // Default text input
                                                return (
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        placeholder={fieldType === 'semver' ? 'e.g., 1.0.0' : t('playground.enterValue')}
                                                        value={entry.value}
                                                        onChange={(e) => handleUpdateContextEntry(index, 'value', e.target.value)}
                                                    />
                                                );
                                            };

                                            // Get used field names for duplicate prevention
                                            const usedFieldNames = contextEntries
                                                .filter((_, idx) => idx !== index)
                                                .map((e) => e.key)
                                                .filter(Boolean);

                                            return (
                                                <Paper key={index} variant="outlined" sx={{ p: 1.5 }}>
                                                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                                        {/* Context Field Selector */}
                                                        <FormControl size="small" sx={{ minWidth: 180, flex: '1 1 180px' }}>
                                                            <Select
                                                                value={entry.key}
                                                                onChange={(e) => handleUpdateContextEntry(index, 'key', e.target.value)}
                                                                displayEmpty
                                                                renderValue={(selected) => {
                                                                    if (!selected) {
                                                                        return <em style={{ color: 'gray' }}>{t('playground.selectField')}</em>;
                                                                    }
                                                                    const selectedField = contextFields.find((f) => f.fieldName === selected);
                                                                    return (
                                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                            {selectedField && getTypeIcon(selectedField.valueType)}
                                                                            {selectedField?.displayName || selected}
                                                                        </Box>
                                                                    );
                                                                }}
                                                            >
                                                                <MenuItem value="" disabled>
                                                                    <em>{t('playground.selectField')}</em>
                                                                </MenuItem>
                                                                {contextFields.map((field) => {
                                                                    const isUsed = usedFieldNames.includes(field.fieldName);
                                                                    return (
                                                                        <MenuItem
                                                                            key={field.fieldName}
                                                                            value={field.fieldName}
                                                                            disabled={isUsed}
                                                                            sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', py: 1 }}
                                                                        >
                                                                            <Tooltip title={field.valueType}>
                                                                                <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                                                                                    {getTypeIcon(field.valueType)}
                                                                                </Box>
                                                                            </Tooltip>
                                                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                                                <Typography variant="body2">
                                                                                    {field.displayName || field.fieldName}
                                                                                    {isUsed && ` (${t('featureFlags.alreadyUsed')})`}
                                                                                </Typography>
                                                                                {field.description && (
                                                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                                                                        {field.description}
                                                                                    </Typography>
                                                                                )}
                                                                            </Box>
                                                                        </MenuItem>
                                                                    );
                                                                })}
                                                            </Select>
                                                        </FormControl>

                                                        {/* Value Input */}
                                                        <Box sx={{ flex: '2 1 200px', minWidth: 150 }}>
                                                            {renderValueInput()}
                                                        </Box>

                                                        {/* Delete Button */}
                                                        <Tooltip title={t('common.delete')}>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleRemoveContextEntry(index)}
                                                                sx={{
                                                                    width: 32,
                                                                    height: 32,
                                                                    color: 'text.secondary',
                                                                    '&:hover': { bgcolor: 'action.hover', color: 'error.main' },
                                                                }}
                                                            >
                                                                <DeleteIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Box>
                                                </Paper>
                                            );
                                        })}
                                    </Stack>
                                )}
                            </Box>

                            {/* Flag Selection (Optional) */}
                            <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        {t('playground.flagSelection')}
                                    </Typography>
                                    <Tooltip title={t('playground.flagSelectionHelp')}>
                                        <HelpIcon sx={{ fontSize: 16, color: 'text.disabled', cursor: 'help' }} />
                                    </Tooltip>
                                </Box>
                                <Autocomplete
                                    multiple
                                    options={availableFlags.map(f => f.flagName)}
                                    value={selectedFlags}
                                    onChange={(_, values) => setSelectedFlags(values)}
                                    renderOption={(props, option) => {
                                        const flag = availableFlags.find(f => f.flagName === option);
                                        return (
                                            <li {...props}>
                                                <Box>
                                                    <Typography variant="body2">{option}</Typography>
                                                    {flag?.displayName && flag.displayName !== option && (
                                                        <Typography variant="caption" color="text.secondary">
                                                            {flag.displayName}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </li>
                                        );
                                    }}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            size="small"
                                            placeholder={selectedFlags.length === 0 ? t('playground.allFlags') : ''}
                                        />
                                    )}
                                    size="small"
                                />
                                <FormHelperText>
                                    {t('playground.flagSelectionDetail')}
                                </FormHelperText>
                            </Box>

                            {/* Evaluate Button */}
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <Button
                                    variant="contained"
                                    startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <PlayIcon />}
                                    onClick={handleEvaluate}
                                    disabled={!canEvaluate || loading}
                                >
                                    {loading ? t('playground.evaluating') : t('playground.tryConfiguration')}
                                </Button>
                            </Box>
                        </Paper>

                        {/* Results Section */}
                        {Object.keys(results).length > 0 && (
                            <Paper variant="outlined" sx={{ p: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="subtitle1" fontWeight={600}>
                                        {t('playground.results')} ({totalResults})
                                    </Typography>
                                    <TextField
                                        size="small"
                                        placeholder={t('common.search')}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        sx={{ width: 250 }}
                                    />
                                </Box>

                                {/* Results Table - Flag-based rows with environment columns */}
                                {(() => {
                                    // Get list of environments evaluated
                                    const evaluatedEnvs = Object.keys(results);

                                    // Group results by flagName
                                    const flagResultsMap: Record<string, Record<string, any>> = {};
                                    const flagInfoMap: Record<string, { flagUsage: string; displayName?: string }> = {};

                                    evaluatedEnvs.forEach((env) => {
                                        (filteredResults[env] || []).forEach((result: any) => {
                                            if (!flagResultsMap[result.flagName]) {
                                                flagResultsMap[result.flagName] = {};
                                                flagInfoMap[result.flagName] = {
                                                    flagUsage: result.flagUsage || 'flag',
                                                    displayName: result.displayName,
                                                };
                                            }
                                            flagResultsMap[result.flagName][env] = result;
                                        });
                                    });

                                    const flagNames = Object.keys(flagResultsMap).sort();

                                    return (
                                        <TableContainer component={Paper} variant="outlined">
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell>{t('featureFlags.flagName')}</TableCell>
                                                        <TableCell sx={{ width: 100 }}>{t('featureFlags.flagUsage')}</TableCell>
                                                        {evaluatedEnvs.map((env) => {
                                                            const envData = environments.find(e => e.environment === env);
                                                            return (
                                                                <TableCell key={env} align="center" sx={{ minWidth: 120 }}>
                                                                    <Chip
                                                                        label={envData?.displayName || env}
                                                                        size="small"
                                                                        sx={{
                                                                            bgcolor: envData?.color || '#888',
                                                                            color: '#fff',
                                                                            borderRadius: '12px',
                                                                            fontSize: '0.75rem'
                                                                        }}
                                                                    />
                                                                </TableCell>
                                                            );
                                                        })}
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {flagNames.map((flagName) => {
                                                        const flagInfo = flagInfoMap[flagName];
                                                        const envResults = flagResultsMap[flagName];

                                                        return (
                                                            <TableRow key={flagName} hover>
                                                                <TableCell>
                                                                    <Box
                                                                        sx={{
                                                                            cursor: 'pointer',
                                                                            '&:hover': { color: 'primary.main' }
                                                                        }}
                                                                        onClick={() => handleFlagClick(flagName)}
                                                                    >
                                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                            {flagInfo.flagUsage === 'remoteConfig' ? (
                                                                                <JsonIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                                                            ) : (
                                                                                <FlagIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                                                            )}
                                                                            <Typography variant="body2">
                                                                                {flagName}
                                                                            </Typography>
                                                                            <OpenInNewIcon sx={{ fontSize: 12, color: 'text.disabled', ml: 0.5 }} />
                                                                        </Box>
                                                                        {flagInfo.displayName && flagInfo.displayName !== flagName && (
                                                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                                                                {flagInfo.displayName}
                                                                            </Typography>
                                                                        )}
                                                                    </Box>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Chip
                                                                        label={flagInfo.flagUsage === 'remoteConfig' ? t('featureFlags.flagUsages.remoteConfig') : t('featureFlags.flagUsages.flag')}
                                                                        size="small"
                                                                        variant="outlined"
                                                                        sx={{ borderRadius: '12px' }}
                                                                    />
                                                                </TableCell>
                                                                {evaluatedEnvs.map((env) => {
                                                                    const result = envResults[env];
                                                                    if (!result) {
                                                                        return (
                                                                            <TableCell key={env} align="center">
                                                                                <Typography variant="caption" color="text.disabled">-</Typography>
                                                                            </TableCell>
                                                                        );
                                                                    }

                                                                    const hasDetails = result.evaluationSteps && result.evaluationSteps.length > 0;

                                                                    return (
                                                                        <TableCell key={env} align="center">
                                                                            <Box
                                                                                sx={{
                                                                                    display: 'flex',
                                                                                    flexDirection: 'column',
                                                                                    alignItems: 'center',
                                                                                    gap: 0.5,
                                                                                    cursor: hasDetails ? 'pointer' : 'default',
                                                                                    '&:hover': hasDetails ? { bgcolor: 'action.hover', borderRadius: 1 } : {},
                                                                                    p: 0.5,
                                                                                }}
                                                                                onClick={(e) => {
                                                                                    if (hasDetails) {
                                                                                        setEvaluationPopoverAnchor(e.currentTarget);
                                                                                        setSelectedEvaluation({ env, result });
                                                                                    }
                                                                                }}
                                                                            >
                                                                                <Chip
                                                                                    icon={result.enabled ? <TrueIcon /> : <FalseIcon />}
                                                                                    label={result.enabled ? 'true' : 'false'}
                                                                                    size="small"
                                                                                    color={result.enabled ? 'success' : 'default'}
                                                                                    sx={{ borderRadius: '16px' }}
                                                                                />
                                                                                {result.variant ? (
                                                                                    <Chip
                                                                                        label={result.variant.name}
                                                                                        size="small"
                                                                                        color="secondary"
                                                                                        variant="outlined"
                                                                                        sx={{
                                                                                            borderRadius: '12px',
                                                                                            fontSize: '0.7rem',
                                                                                            height: 20,
                                                                                            cursor: 'pointer',
                                                                                        }}
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            handleVariantClick(e, result.variant);
                                                                                        }}
                                                                                    />
                                                                                ) : (
                                                                                    <Typography variant="caption" color="text.disabled">
                                                                                        {t(flagInfo.flagUsage === 'remoteConfig' ? 'playground.noConfig' : 'playground.noVariant')}
                                                                                    </Typography>
                                                                                )}
                                                                            </Box>
                                                                        </TableCell>
                                                                    );
                                                                })}
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    );
                                })()}
                            </Paper>
                        )}
                    </Stack>
                </DialogContent >
            </Dialog >

            {/* Variant Payload Popover */}
            < Popover
                open={Boolean(variantPopoverAnchor)}
                anchorEl={variantPopoverAnchor}
                onClose={handleVariantPopoverClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                disableRestoreFocus
                disableScrollLock
                slotProps={{
                    paper: {
                        elevation: 8,
                        sx: { mt: 0.5 }
                    },
                    root: {
                        slotProps: {
                            backdrop: {
                                invisible: true
                            }
                        }
                    }
                }}
            >
                <Box sx={{ p: 2, minWidth: 300, maxWidth: 500 }}>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                        {t('playground.variantPayload')}
                    </Typography>

                    {selectedVariant && (
                        <Stack spacing={1.5}>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    {t('playground.variantName')}
                                </Typography>
                                <Typography variant="body2" fontWeight={500}>
                                    {selectedVariant.name}
                                </Typography>
                            </Box>

                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    {t('playground.payloadSource')}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Chip
                                        label={selectedVariant.payloadSource === 'baseline'
                                            ? t('playground.payloadSourceBaseline')
                                            : t('playground.payloadSourceVariant')}
                                        size="small"
                                        color={selectedVariant.payloadSource === 'baseline' ? 'info' : 'default'}
                                        sx={{ borderRadius: '16px' }}
                                    />
                                    {selectedVariant.payloadType && (
                                        <Chip
                                            label={selectedVariant.payloadType}
                                            size="small"
                                            variant="outlined"
                                            sx={{ borderRadius: '16px' }}
                                        />
                                    )}
                                </Box>
                            </Box>

                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    {t('playground.payloadValue')}
                                </Typography>
                                {selectedVariant.payload === undefined || selectedVariant.payload === null ? (
                                    <Typography variant="body2" color="text.disabled" fontStyle="italic">
                                        {t('common.noValue')}
                                    </Typography>
                                ) : selectedVariant.payloadType === 'json' ? (
                                    <Box sx={{
                                        mt: 0.5,
                                        p: 1,
                                        bgcolor: 'grey.900',
                                        borderRadius: 1,
                                        maxHeight: 200,
                                        overflow: 'auto'
                                    }}>
                                        <pre style={{
                                            margin: 0,
                                            fontSize: '12px',
                                            fontFamily: 'monospace',
                                            color: '#fff',
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word'
                                        }}>
                                            {typeof selectedVariant.payload === 'string'
                                                ? selectedVariant.payload
                                                : JSON.stringify(selectedVariant.payload, null, 2)}
                                        </pre>
                                    </Box>
                                ) : selectedVariant.payloadType === 'number' ? (
                                    <Typography variant="body1" fontFamily="monospace" color="primary.main">
                                        {selectedVariant.payload}
                                    </Typography>
                                ) : (
                                    <Typography variant="body2" sx={{
                                        mt: 0.5,
                                        p: 1,
                                        bgcolor: 'action.hover',
                                        borderRadius: 1,
                                        fontFamily: selectedVariant.payloadType === 'string' ? 'inherit' : 'monospace'
                                    }}>
                                        {String(selectedVariant.payload)}
                                    </Typography>
                                )}
                            </Box>
                        </Stack>
                    )}
                </Box>
            </Popover >

            {/* Evaluation Details Popover */}
            <Popover
                open={Boolean(evaluationPopoverAnchor)}
                anchorEl={evaluationPopoverAnchor}
                onClose={handleEvaluationPopoverClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'center',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'center',
                }}
                disableRestoreFocus
                disableScrollLock
                slotProps={{
                    paper: {
                        elevation: 8,
                        sx: { mt: 0.5, maxHeight: '70vh', overflow: 'auto' }
                    },
                    root: {
                        slotProps: {
                            backdrop: {
                                invisible: true
                            }
                        }
                    }
                }}
            >
                <Box sx={{ p: 2, minWidth: 400, maxWidth: 600 }}>
                    {selectedEvaluation && (
                        <>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="subtitle1" fontWeight={600}>
                                        {t('playground.evaluationProcess')}
                                    </Typography>
                                    {(() => {
                                        const envData = environments.find(e => e.environment === selectedEvaluation.env);
                                        return (
                                            <Chip
                                                label={envData?.displayName || selectedEvaluation.env}
                                                size="small"
                                                sx={{
                                                    bgcolor: envData?.color || '#888',
                                                    color: '#fff',
                                                    borderRadius: '12px',
                                                    fontSize: '0.75rem'
                                                }}
                                            />
                                        );
                                    })()}
                                </Box>
                                <Chip
                                    icon={selectedEvaluation.result.enabled ? <TrueIcon /> : <FalseIcon />}
                                    label={selectedEvaluation.result.enabled ? 'true' : 'false'}
                                    size="small"
                                    color={selectedEvaluation.result.enabled ? 'success' : 'default'}
                                    sx={{ borderRadius: '16px' }}
                                />
                            </Box>

                            {selectedEvaluation.result.reason && (
                                <Box sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        <strong>{t('playground.reason')}:</strong> {selectedEvaluation.result.reason}
                                    </Typography>
                                </Box>
                            )}

                            {selectedEvaluation.result.evaluationSteps && selectedEvaluation.result.evaluationSteps.length > 0 && (
                                <Box sx={{
                                    bgcolor: 'background.paper',
                                    borderRadius: 1,
                                    border: 1,
                                    borderColor: 'divider',
                                    overflow: 'hidden'
                                }}>
                                    {selectedEvaluation.result.evaluationSteps.map((step: any, stepIdx: number) => {
                                        const isStrategy = step.step === 'STRATEGY_EVALUATION';
                                        const stepBgColor = stepIdx % 2 === 0 ? 'transparent' : 'action.hover';

                                        return (
                                            <Box
                                                key={stepIdx}
                                                sx={{
                                                    borderBottom: stepIdx < (selectedEvaluation.result.evaluationSteps?.length || 1) - 1 ? 1 : 0,
                                                    borderColor: 'divider',
                                                    bgcolor: stepBgColor,
                                                }}
                                            >
                                                <Box sx={{
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    p: 1.5,
                                                    pl: isStrategy ? 3 : 1.5,
                                                    borderLeft: isStrategy ? 3 : 0,
                                                    borderColor: step.passed === true ? 'success.main' :
                                                        step.passed === false ? 'error.main' : 'grey.400',
                                                }}>
                                                    <Box sx={{ width: 24, flexShrink: 0, pt: 0.2 }}>
                                                        {step.passed === true && <TrueIcon color="success" fontSize="small" />}
                                                        {step.passed === false && <FalseIcon color="error" fontSize="small" />}
                                                        {step.passed === null && (
                                                            <Box sx={{
                                                                width: 20,
                                                                height: 20,
                                                                borderRadius: '50%',
                                                                bgcolor: 'grey.400',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}>
                                                                <Typography variant="caption" color="white">-</Typography>
                                                            </Box>
                                                        )}
                                                    </Box>

                                                    <Box sx={{ width: 140, flexShrink: 0 }}>
                                                        <Typography
                                                            variant="body2"
                                                            fontWeight={isStrategy ? 600 : 500}
                                                            color={isStrategy ? 'primary.main' : 'text.primary'}
                                                        >
                                                            {step.step === 'FLAG_STATUS' && t('playground.steps.flagStatus')}
                                                            {step.step === 'ENVIRONMENT_CHECK' && t('playground.steps.environmentCheck')}
                                                            {step.step === 'STRATEGY_COUNT' && t('playground.steps.strategyCount')}
                                                            {step.step === 'STRATEGY_EVALUATION' &&
                                                                t('playground.steps.strategy', { name: step.strategyName || `#${(step.strategyIndex ?? 0) + 1}` })
                                                            }
                                                        </Typography>
                                                    </Box>

                                                    <Box sx={{ flex: 1 }}>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {step.message}
                                                        </Typography>

                                                        {isStrategy && step.segmentName && (
                                                            <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {t('playground.segment')}:
                                                                </Typography>
                                                                <Chip
                                                                    label={step.segmentName}
                                                                    size="small"
                                                                    variant="outlined"
                                                                    sx={{ borderRadius: '12px' }}
                                                                />
                                                            </Box>
                                                        )}

                                                        {isStrategy && step.constraintResults && step.constraintResults.length > 0 && (
                                                            <Box sx={{ mt: 1.5, pl: 1, borderLeft: 2, borderColor: 'divider' }}>
                                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                                                    {t('playground.constraintEvaluation')}:
                                                                </Typography>
                                                                <Stack spacing={0.5}>
                                                                    {step.constraintResults.map((cr: any, crIdx: number) => (
                                                                        <Box key={crIdx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                            {cr.passed ? (
                                                                                <TrueIcon sx={{ fontSize: 14, color: 'success.main' }} />
                                                                            ) : (
                                                                                <FalseIcon sx={{ fontSize: 14, color: 'error.main' }} />
                                                                            )}
                                                                            <ConstraintDisplay constraint={cr.constraint} compact />
                                                                        </Box>
                                                                    ))}
                                                                </Stack>
                                                            </Box>
                                                        )}

                                                        {isStrategy && step.passed && step.variantName && (
                                                            <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {t('playground.determinedVariant')}:
                                                                </Typography>
                                                                <Chip
                                                                    label={step.variantName}
                                                                    size="small"
                                                                    color="secondary"
                                                                    variant="outlined"
                                                                    sx={{ borderRadius: '16px' }}
                                                                />
                                                            </Box>
                                                        )}
                                                    </Box>
                                                </Box>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            )}
                        </>
                    )}
                </Box>
            </Popover>
        </>
    );
};

export default PlaygroundDialog;
