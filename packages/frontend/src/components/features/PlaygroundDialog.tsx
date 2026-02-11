/**
 * PlaygroundDialog - Feature Flag Playground Component
 * Allows testing feature flag evaluation with custom context
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Divider,
  FormControlLabel,
  Checkbox,
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
  RemoveCircleOutline as RemoveCircleOutlineIcon,
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
  SportsEsports as JoystickIcon,
  ContentCopy as CopyIcon,
  DataArray as ArrayIcon,
  Public as CountryIcon,
} from '@mui/icons-material';
import CountrySelect from '../common/CountrySelect';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import { parseApiErrorMessage } from '../../utils/errorUtils';
import { Environment, environmentService } from '../../services/environmentService';
import featureFlagService from '../../services/featureFlagService';
import api from '../../services/api';
import ConstraintDisplay from './ConstraintDisplay';
import LocalizedDateTimePicker from '../common/LocalizedDateTimePicker';
import JsonEditor from '../common/JsonEditor';
import { copyToClipboardWithNotification } from '../../utils/clipboard';

interface ContextField {
  fieldName: string;
  displayName: string;
  description?: string;
  fieldType: 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'semver' | 'array' | 'country';
  legalValues?: string[];
}

interface ContextEntry {
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'semver' | 'array' | 'country';
}

interface EvaluationResult {
  flagName: string;
  displayName?: string;
  flagType?: string;
  enabled: boolean;
  variant?: {
    name: string;
    value?: any;
    valueType?: string;
    valueSource?: 'environment' | 'flag' | 'variant';
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
  /** Embedded mode - renders as inline Box instead of Dialog, hides flag/env selectors */
  embedded?: boolean;
  /** Pre-loaded flag details for embedded mode */
  initialFlagDetails?: any;
}

const PlaygroundDialog: React.FC<PlaygroundDialogProps> = ({
  open,
  onClose,
  initialFlags,
  initialEnvironments,
  initialContext,
  autoExecute = false,
  embedded = false,
  initialFlagDetails,
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
  const [availableFlags, setAvailableFlags] = useState<
    { flagName: string; displayName?: string }[]
  >([]);
  const [autoExecutePending, setAutoExecutePending] = useState(false);
  const [rememberContext, setRememberContext] = useState<boolean>(() => {
    return localStorage.getItem('gatrix_playground_remember_context') === 'true';
  });

  // Evaluation details popover state
  const [evaluationPopoverAnchor, setEvaluationPopoverAnchor] = useState<HTMLElement | null>(null);
  const [selectedEvaluation, setSelectedEvaluation] = useState<{
    flagName: string;
    env: string;
    result: EvaluationResult;
  } | null>(null);
  const [flagDetails, setFlagDetails] = useState<any | null>(null);
  const [loadingFlagDetails, setLoadingFlagDetails] = useState(false);

  // Track if initial setup has been done (to prevent re-initialization in embedded mode on parent re-render)
  const hasInitializedRef = useRef(false);

  // Load environments and context fields
  useEffect(() => {
    if (open) {
      // In embedded mode, only initialize once to prevent state reset on parent re-render
      if (embedded && hasInitializedRef.current) {
        return;
      }

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
      // Load remembered context if enabled
      if (rememberContext) {
        const saved = localStorage.getItem('gatrix_playground_saved_context');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              setContextEntries(parsed);
            }
          } catch (e) {
            console.error('Failed to load saved context', e);
          }
        }
      }

      // Set initial context if provided (overrides remembered)
      if (initialContext && Object.keys(initialContext).length > 0) {
        const entries: ContextEntry[] = Object.entries(initialContext).map(([key, value]) => ({
          key,
          value: String(value),
          type:
            typeof value === 'number'
              ? 'number'
              : typeof value === 'boolean'
                ? 'boolean'
                : 'string',
        }));
        setContextEntries(entries);
      }

      // Set auto-execute pending if requested
      setAutoExecutePending(autoExecute);

      // Mark as initialized
      hasInitializedRef.current = true;
    }
  }, [
    open,
    initialFlags,
    initialEnvironments,
    initialContext,
    autoExecute,
    embedded,
    rememberContext,
  ]);

  const loadEnvironments = async () => {
    try {
      const envs = await environmentService.getEnvironments();
      const filteredEnvs = envs
        .filter((e) => !e.isHidden)
        .sort((a, b) => a.displayOrder - b.displayOrder);
      setEnvironments(filteredEnvs);
      // In embedded mode, auto-select all environments
      if (embedded && filteredEnvs.length > 0 && selectedEnvironments.length === 0) {
        setSelectedEnvironments(filteredEnvs.map((e) => e.environment));
      }
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
        params: { page: 1, limit: 1000, isArchived: false },
      });
      const flags = response.data?.data || [];
      setAvailableFlags(
        flags.map((f: any) => ({ flagName: f.flagName, displayName: f.displayName }))
      );
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

  // Load flag details when evaluation popover opens
  useEffect(() => {
    if (selectedEvaluation?.flagName) {
      // Use initial details if they match the current flag
      if (initialFlagDetails && initialFlagDetails.flagName === selectedEvaluation.flagName) {
        setFlagDetails(initialFlagDetails);
        return;
      }

      setLoadingFlagDetails(true);
      setFlagDetails(null);
      featureFlagService
        .getFeatureFlag(selectedEvaluation.flagName)
        .then((flag) => {
          setFlagDetails(flag);
        })
        .catch((error) => {
          console.error('Failed to load flag details:', error);
        })
        .finally(() => {
          setLoadingFlagDetails(false);
        });
    } else {
      setFlagDetails(null);
    }
  }, [selectedEvaluation?.flagName, initialFlagDetails]);

  // Helper function to localize evaluation reason
  const getLocalizedReason = (reason: string, reasonDetails?: any): string => {
    // Helper to localize strategy name inline
    const localizeStrategyName = (name: string): string => {
      const key = `featureFlags.strategyTypes.${name}`;
      const localized = t(key);
      return localized !== key ? localized : name;
    };

    const reasonMap: Record<string, string> = {
      FLAG_DISABLED: t('playground.reasons.flagDisabled'),
      NO_STRATEGIES: t('playground.reasons.noStrategies'),
      ALL_STRATEGIES_DISABLED: t('playground.reasons.ALL_STRATEGIES_DISABLED'),
      STRATEGY_MATCHED: reasonDetails?.strategyName
        ? t('playground.reasons.strategyMatched', {
          strategy: localizeStrategyName(reasonDetails.strategyName),
        })
        : t('playground.reasons.defaultStrategy'),
      NO_MATCHING_STRATEGY: t('playground.reasons.NO_MATCHING_STRATEGY'),
    };
    return reasonMap[reason] || reason;
  };

  // Helper function to localize step message
  const getLocalizedStepMessage = (step: any, envName?: string): string => {
    const stepType = step.step;
    const message = step.message;

    // Map messages to localization keys
    if (stepType === 'ENVIRONMENT_CHECK') {
      if (message === 'Flag is enabled in this environment') {
        return envName
          ? t('playground.stepMessages.flagEnabledInEnvNamed', { env: envName })
          : t('playground.stepMessages.flagEnabledInEnv');
      }
      if (message === 'Flag is disabled in this environment') {
        return envName
          ? t('playground.stepMessages.flagDisabledInEnvNamed', { env: envName })
          : t('playground.stepMessages.flagDisabledInEnv');
      }
    }

    if (stepType === 'STRATEGY_COUNT') {
      if (message === 'No strategies defined - enabled by default') {
        return t('playground.stepMessages.noStrategiesDefault');
      }
      // Match "N strategy(s) to evaluate"
      const match = message?.match(/(\d+) strategy\(s\) to evaluate/);
      if (match) {
        return t('playground.stepMessages.strategiesToEvaluate', { count: match[1] });
      }
    }

    if (stepType === 'STRATEGY_EVALUATION') {
      if (message === 'Strategy is disabled - skipped') {
        return t('playground.stepMessages.strategyDisabledSkipped');
      }
      if (message === 'All conditions met') {
        return t('playground.stepMessages.allConditionsMet');
      }
      if (message === 'One or more conditions failed') {
        return t('playground.stepMessages.conditionsFailed');
      }
    }

    // Return original message if no localization found
    return message || '';
  };

  // Helper function to localize strategy names
  const getLocalizedStrategyName = (strategyName: string): string => {
    const key = `featureFlags.strategyTypes.${strategyName}`;
    const localized = t(key);
    // If the key doesn't exist, t() returns the key itself
    return localized !== key ? localized : strategyName;
  };

  // Add context entry
  const handleAddContextEntry = () => {
    const updated: ContextEntry[] = [
      ...contextEntries,
      { key: '', value: '', type: 'string' as 'string' },
    ];
    setContextEntries(updated);
    if (rememberContext) {
      localStorage.setItem('gatrix_playground_saved_context', JSON.stringify(updated));
    }
  };

  // Remove context entry
  const handleRemoveContextEntry = (index: number) => {
    const updated = contextEntries.filter((_, i) => i !== index);
    setContextEntries(updated);
    if (rememberContext) {
      localStorage.setItem('gatrix_playground_saved_context', JSON.stringify(updated));
    }
  };

  // Update context entry
  const handleUpdateContextEntry = (index: number, field: keyof ContextEntry, value: any) => {
    const updated = [...contextEntries];
    updated[index] = { ...updated[index], [field]: value };

    // Update type if key changes
    if (field === 'key') {
      const fieldDef = contextFields.find((f) => f.fieldName === value);
      if (fieldDef) {
        updated[index].type = fieldDef.fieldType;
      }
    }

    setContextEntries(updated);
    if (rememberContext) {
      localStorage.setItem('gatrix_playground_saved_context', JSON.stringify(updated));
    }
  };

  // Get context field by key
  const getContextFieldByKey = (key: string): ContextField | undefined => {
    return contextFields.find((f) => f.fieldName === key);
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
          case 'date':
          case 'datetime':
            if (entry.value && typeof entry.value === 'string') {
              const date = new Date(entry.value);
              if (!isNaN(date.getTime())) {
                value = date.toISOString().split('.')[0] + 'Z';
              }
            }
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

  // Close evaluation popover
  const handleEvaluationPopoverClose = () => {
    setEvaluationPopoverAnchor(null);
    setSelectedEvaluation(null);
  };

  // Evaluate
  const handleEvaluate = async () => {
    setResults({});
    setLoading(true);
    setAutoExecutePending(false);
    try {
      // Add intentional delay for UX testing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const context = buildContext();
      // If no environments selected, use all available environments
      const envsToEvaluate =
        selectedEnvironments.length > 0
          ? selectedEnvironments
          : environments.map((e) => e.environment);

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
          r.flagName.toLowerCase().includes(term) || r.displayName?.toLowerCase().includes(term)
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
          strategy:
            result.reasonDetails?.strategyName ||
            `#${(result.reasonDetails?.strategyIndex ?? 0) + 1}`,
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

  // Helper function to get context field type icon
  const getFieldTypeIcon = (type: string) => {
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
      case 'array':
        return <ArrayIcon sx={{ fontSize: 16, color: 'info.dark' }} />;
      case 'country':
        return <CountryIcon sx={{ fontSize: 16, color: 'success.dark' }} />;
      default:
        return <StringIcon sx={{ fontSize: 16, color: 'text.disabled' }} />;
    }
  };

  // Shared render function for context fields
  const renderContextFields = () => {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              {t('playground.contextFields')}
            </Typography>
            <Tooltip title={t('playground.contextFieldsHelp')}>
              <HelpIcon sx={{ fontSize: 16, color: 'text.disabled', cursor: 'help' }} />
            </Tooltip>
          </Box>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={rememberContext}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setRememberContext(checked);
                  localStorage.setItem('gatrix_playground_remember_context', String(checked));
                  if (!checked) {
                    localStorage.removeItem('gatrix_playground_saved_context');
                  } else {
                    localStorage.setItem(
                      'gatrix_playground_saved_context',
                      JSON.stringify(contextEntries)
                    );
                  }
                }}
              />
            }
            label={
              <Typography variant="caption" sx={{ color: 'text.secondary', userSelect: 'none' }}>
                {t('playground.rememberContext')}
              </Typography>
            }
            sx={{ m: 0 }}
          />
        </Box>

        {contextEntries.length === 0 ? (
          <Box
            sx={{
              p: 3,
              border: '1px dashed',
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'action.hover',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1.5,
              mb: 2,
            }}
          >
            <Typography variant="body2" color="text.secondary" textAlign="center">
              {t('playground.noContextProvidedDescription')}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddContextEntry}
              sx={{ borderRadius: '8px' }}
            >
              {t('playground.addContextField')}
            </Button>
          </Box>
        ) : (
          <>
            <Stack spacing={1} sx={{ mb: 1 }}>
              {contextEntries.map((entry, index) => {
                const contextField = getContextFieldByKey(entry.key);
                const hasLegalValues =
                  contextField?.legalValues && contextField.legalValues.length > 0;
                const fieldType = contextField?.fieldType || 'string';

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
                  if (fieldType === 'date' || (fieldType as string) === 'datetime') {
                    return (
                      <LocalizedDateTimePicker
                        value={entry.value || null}
                        onChange={(isoString: string) =>
                          handleUpdateContextEntry(index, 'value', isoString)
                        }
                      />
                    );
                  }

                  // Country type - use CountrySelect
                  if (fieldType === 'country') {
                    return (
                      <CountrySelect
                        value={entry.value || null}
                        onChange={(val) => handleUpdateContextEntry(index, 'value', val || '')}
                        size="small"
                        placeholder={t('playground.selectValue')}
                      />
                    );
                  }

                  // Array type - comma separated values
                  if (fieldType === 'array') {
                    return (
                      <TextField
                        fullWidth
                        size="small"
                        placeholder={t('playground.enterArrayValue', 'e.g., val1, val2, val3')}
                        value={entry.value}
                        onChange={(e) => handleUpdateContextEntry(index, 'value', e.target.value)}
                        helperText={t('playground.arrayHelp', 'Comma separated values')}
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
                            <MenuItem key={lv} value={lv}>
                              {lv}
                            </MenuItem>
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
                      placeholder={
                        fieldType === 'semver' ? 'e.g., 1.0.0' : t('playground.enterValue')
                      }
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
                    <Box
                      sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}
                    >
                      {/* Context Field Selector */}
                      <FormControl size="small" sx={{ minWidth: 180, flex: '1 1 180px' }}>
                        <Select
                          value={entry.key}
                          onChange={(e) => handleUpdateContextEntry(index, 'key', e.target.value)}
                          displayEmpty
                          renderValue={(selected) => {
                            if (!selected) {
                              return (
                                <em style={{ color: 'gray' }}>{t('playground.selectField')}</em>
                              );
                            }
                            const selectedField = contextFields.find(
                              (f) => f.fieldName === selected
                            );
                            return (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {selectedField && getFieldTypeIcon(selectedField.fieldType)}
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
                                <Tooltip title={field.fieldType}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                                    {getFieldTypeIcon(field.fieldType)}
                                  </Box>
                                </Tooltip>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography variant="body2">
                                    {field.displayName || field.fieldName}
                                    {isUsed && ` (${t('featureFlags.alreadyUsed')})`}
                                  </Typography>
                                  {field.description && (
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{ display: 'block' }}
                                    >
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
                      <Box sx={{ flex: '2 1 200px', minWidth: 150 }}>{renderValueInput()}</Box>

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
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button size="small" startIcon={<AddIcon />} onClick={handleAddContextEntry}>
                {t('common.add')}
              </Button>
            </Box>
          </>
        )}
      </Box>
    );
  };

  // Shared render function for results table
  const renderResultsTable = () => {
    // Show skeleton while evaluating
    if (loading) {
      return (
        <Paper
          variant="outlined"
          sx={{
            overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
            animation: 'evalFadeIn 0.3s ease-out',
            '@keyframes evalFadeIn': {
              from: { opacity: 0, transform: 'translateY(12px)' },
              to: { opacity: 1, transform: 'translateY(0)' },
            },
            '@keyframes evalShimmer': {
              '0%': { backgroundPosition: '-200% 0' },
              '100%': { backgroundPosition: '200% 0' },
            },
            '@keyframes evalGlow': {
              '0%, 100%': { opacity: 0.4, boxShadow: '0 0 4px currentColor' },
              '50%': { opacity: 1, boxShadow: '0 0 12px currentColor' },
            },
            '@keyframes evalBounce': {
              '0%, 80%, 100%': { transform: 'translateY(0)' },
              '40%': { transform: 'translateY(-4px)' },
            },
            '@keyframes evalScan': {
              '0%': { left: '-30%', opacity: 0 },
              '10%': { opacity: 1 },
              '90%': { opacity: 1 },
              '100%': { left: '130%', opacity: 0 },
            },
            '@keyframes evalBreathe': {
              '0%, 100%': { opacity: 0.6 },
              '50%': { opacity: 1 },
            },
          }}
        >
          {/* Top shimmer progress bar */}
          <Box sx={{
            height: 3,
            background: (theme) =>
              `linear-gradient(90deg, transparent 0%, ${theme.palette.primary.main}44 25%, ${theme.palette.primary.main} 50%, ${theme.palette.primary.main}44 75%, transparent 100%)`,
            backgroundSize: '200% 100%',
            animation: 'evalShimmer 1.2s infinite linear',
          }} />

          <Box sx={{ p: embedded ? 1.5 : 2 }}>
            {/* Header with glowing dot and bouncing dots text */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Box sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                color: 'primary.main',
                animation: 'evalGlow 1.2s infinite ease-in-out',
              }} />
              <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{ display: 'flex', alignItems: 'baseline', gap: '1px' }}
              >
                {t('playground.evaluating')}
                <Box component="span" sx={{ display: 'inline-flex', gap: '2px', ml: '2px' }}>
                  {[0, 1, 2].map((d) => (
                    <Box
                      key={d}
                      component="span"
                      sx={{
                        display: 'inline-block',
                        width: 3,
                        height: 3,
                        borderRadius: '50%',
                        bgcolor: 'text.secondary',
                        animation: `evalBounce 1.4s infinite ease-in-out ${d * 0.16}s`,
                      }}
                    />
                  ))}
                </Box>
              </Typography>
            </Box>

            {/* Animated rows with scanning highlight */}
            <Stack spacing={0.75}>
              {[0, 1, 2, 3].map((i) => (
                <Box
                  key={i}
                  sx={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    py: 1,
                    px: 1.5,
                    borderRadius: 1,
                    bgcolor: 'action.hover',
                    opacity: 0,
                    animation: `evalFadeIn 0.25s ease-out ${0.05 + i * 0.1}s forwards, evalBreathe 2.5s infinite ease-in-out ${i * 0.3}s`,
                    overflow: 'hidden',
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: '-30%',
                      width: '30%',
                      height: '100%',
                      background: (theme) =>
                        `linear-gradient(90deg, transparent, ${theme.palette.primary.main}15, transparent)`,
                      animation: `evalScan 2.5s infinite ease-in-out ${0.3 + i * 0.4}s`,
                    },
                  }}
                >
                  <Box sx={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border: '2px solid',
                    borderColor: 'divider',
                    background: (theme) =>
                      `linear-gradient(90deg, ${theme.palette.action.selected}, ${theme.palette.action.hover}, ${theme.palette.action.selected})`,
                    backgroundSize: '200% 100%',
                    animation: 'evalShimmer 2s infinite linear',
                    flexShrink: 0,
                  }} />
                  <Box sx={{
                    height: 12,
                    borderRadius: 1,
                    flex: `0 0 ${20 + i * 7}%`,
                    background: (theme) =>
                      `linear-gradient(90deg, ${theme.palette.action.selected}, ${theme.palette.action.hover}, ${theme.palette.action.selected})`,
                    backgroundSize: '200% 100%',
                    animation: `evalShimmer 2s infinite linear ${i * 0.15}s`,
                  }} />
                  <Box sx={{ ml: 'auto', display: 'flex', gap: 0.75 }}>
                    <Box sx={{
                      width: 48,
                      height: 20,
                      borderRadius: 2.5,
                      background: (theme) =>
                        `linear-gradient(90deg, ${theme.palette.action.selected}, ${theme.palette.action.hover}, ${theme.palette.action.selected})`,
                      backgroundSize: '200% 100%',
                      animation: `evalShimmer 2s infinite linear ${0.1 + i * 0.15}s`,
                    }} />
                    <Box sx={{
                      width: 64,
                      height: 20,
                      borderRadius: 2.5,
                      background: (theme) =>
                        `linear-gradient(90deg, ${theme.palette.action.selected}, ${theme.palette.action.hover}, ${theme.palette.action.selected})`,
                      backgroundSize: '200% 100%',
                      animation: `evalShimmer 2s infinite linear ${0.2 + i * 0.15}s`,
                    }} />
                  </Box>
                </Box>
              ))}
            </Stack>
          </Box>
        </Paper>
      );
    }

    if (Object.keys(results).length === 0) return null;

    // Get list of environments evaluated
    const evaluatedEnvs = Object.keys(results);

    // Group results by flagName
    const flagResultsMap: Record<string, Record<string, any>> = {};
    const flagInfoMap: Record<string, { flagType: string; displayName?: string }> = {};

    evaluatedEnvs.forEach((env) => {
      (filteredResults[env] || []).forEach((result: any) => {
        if (!flagResultsMap[result.flagName]) {
          flagResultsMap[result.flagName] = {};
          flagInfoMap[result.flagName] = {
            flagType: result.flagType || 'release',
            displayName: result.displayName,
          };
        }
        flagResultsMap[result.flagName][env] = result;
      });
    });

    const flagNames = Object.keys(flagResultsMap).sort();

    return (
      <Paper
        variant="outlined"
        sx={{
          p: embedded ? 1.5 : 2,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          animation: 'resultsAppear 0.4s ease-out',
          '@keyframes resultsAppear': {
            from: { opacity: 0, transform: 'translateY(8px)' },
            to: { opacity: 1, transform: 'translateY(0)' },
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: embedded ? 1.5 : 2,
          }}
        >
          <Typography variant="subtitle1" fontWeight={600}>
            {t('playground.results')} ({totalResults})
          </Typography>
          {/* Hide search in embedded mode (single flag) */}
          {!embedded && (
            <TextField
              size="small"
              placeholder={t('common.search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ width: 200 }}
            />
          )}
        </Box>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                {/* Hide flag name column in embedded mode (single flag) */}
                {!embedded && <TableCell>{t('featureFlags.flagName')}</TableCell>}
                {evaluatedEnvs.map((env) => {
                  const envData = environments.find((e) => e.environment === env);
                  const label = envData?.displayName || env;
                  return (
                    <TableCell
                      key={env}
                      align="center"
                      sx={{ minWidth: 40, maxWidth: 56, px: 0.25, py: 1 }}
                    >
                      <Tooltip title={label}>
                        <Chip
                          label={label}
                          size="small"
                          variant="outlined"
                          sx={{
                            borderColor: envData?.color || '#888',
                            color: envData?.color || '#888',
                            borderRadius: '4px',
                            borderWidth: 1,
                            fontSize: '10px',
                            fontWeight: 700,
                            maxWidth: 42,
                            height: 16,
                            '& .MuiChip-label': {
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              px: 0.5,
                            },
                          }}
                        />
                      </Tooltip>
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
                    {/* Hide flag name column in embedded mode (single flag) */}
                    {!embedded && (
                      <TableCell>
                        <Box
                          sx={{
                            cursor: 'pointer',
                            '&:hover': { color: 'primary.main' },
                          }}
                          onClick={() => handleFlagClick(flagName)}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {flagInfo.flagType === 'remoteConfig' ? (
                              <JsonIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                            ) : (
                              <FlagIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                            )}
                            <Typography variant="body2">{flagName}</Typography>
                            <OpenInNewIcon sx={{ fontSize: 12, color: 'text.disabled', ml: 0.5 }} />
                          </Box>
                          {flagInfo.displayName && flagInfo.displayName !== flagName && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: 'block' }}
                            >
                              {flagInfo.displayName}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                    )}
                    {evaluatedEnvs.map((env) => {
                      const result = envResults[env];
                      if (!result) {
                        return (
                          <TableCell
                            key={env}
                            align="center"
                            sx={{ minWidth: 40, maxWidth: 56, px: 0.25 }}
                          >
                            <Typography variant="caption" color="text.disabled">
                              -
                            </Typography>
                          </TableCell>
                        );
                      }

                      const hasDetails =
                        result.evaluationSteps && result.evaluationSteps.length > 0;

                      return (
                        <TableCell
                          key={env}
                          align="center"
                          sx={{ minWidth: 40, maxWidth: 56, px: 0.25 }}
                        >
                          <Tooltip
                            title={hasDetails ? t('playground.clickToViewEvaluationResult') : ''}
                          >
                            <Box
                              sx={{
                                display: 'inline-flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                cursor: hasDetails ? 'pointer' : 'default',
                                p: 1,
                                borderRadius: 1,
                                transition: 'all 0.2s',
                                '&:hover': hasDetails
                                  ? {
                                    bgcolor: 'action.hover',
                                    transform: 'scale(1.1)',
                                  }
                                  : {},
                              }}
                              onClick={(e) => {
                                if (hasDetails) {
                                  setEvaluationPopoverAnchor(e.currentTarget);
                                  setSelectedEvaluation({ flagName, env, result });
                                }
                              }}
                            >
                              {result.enabled ? (
                                <TrueIcon color="success" sx={{ fontSize: 24 }} />
                              ) : (
                                <FalseIcon color="error" sx={{ fontSize: 24 }} />
                              )}
                            </Box>
                          </Tooltip>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    );
  };
  // Detailed Evaluation Details Popover
  const renderDetailedEvaluationPopover = () => (
    <Popover
      open={Boolean(evaluationPopoverAnchor)}
      anchorEl={evaluationPopoverAnchor}
      onClose={handleEvaluationPopoverClose}
      anchorOrigin={{
        vertical: 'top',
        horizontal: 'center',
      }}
      transformOrigin={{
        vertical: 'bottom',
        horizontal: 'center',
      }}
      disableRestoreFocus
      marginThreshold={16}
      slotProps={{
        paper: {
          elevation: 8,
          sx: {
            mb: 0.5,
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 2,
            overflow: 'hidden',
            border: 2,
            borderColor: selectedEvaluation?.result?.enabled ? 'success.light' : 'error.light',
          },
        },
      }}
    >
      <Box
        sx={{
          minWidth: 800,
          maxWidth: 1050,
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {selectedEvaluation && (
          <>
            {/* FIXED HEADER */}
            <Box
              sx={{
                p: 2,
                pb: 1,
                bgcolor: 'background.paper',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  mb: 1.5,
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
                    {t('playground.evaluationProcess')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('playground.evaluationProcessSubtitle')}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={handleEvaluationPopoverClose} sx={{ mt: -0.5 }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>

              {/* SUMMARY TABLE */}
              <Box
                sx={{
                  mb: 2,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  overflow: 'hidden',
                  display: 'grid',
                  gridTemplateColumns: 'minmax(120px, 150px) 100px 1fr',
                  bgcolor: 'background.paper',
                }}
              >
                {/* Table Headers */}
                <Box
                  sx={{
                    bgcolor: 'action.hover',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    py: 0.5,
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="caption" fontWeight={700} color="text.secondary">
                    {t('playground.environment')}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    bgcolor: 'action.hover',
                    borderBottom: '1px solid',
                    borderLeft: '1px solid',
                    borderColor: 'divider',
                    py: 0.5,
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="caption" fontWeight={700} color="text.secondary">
                    {t('playground.result')}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    bgcolor: 'action.hover',
                    borderBottom: '1px solid',
                    borderLeft: '1px solid',
                    borderColor: 'divider',
                    py: 0.5,
                    pl: 2,
                  }}
                >
                  <Typography variant="caption" fontWeight={700} color="text.secondary">
                    {t('playground.reason')}
                  </Typography>
                </Box>

                {/* Table Body Cells */}
                <Box
                  sx={{
                    px: 1.5,
                    py: 1,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  {(() => {
                    const envData = environments.find(
                      (e) => e.environment === selectedEvaluation.env
                    );
                    return (
                      <Chip
                        label={envData?.displayName || selectedEvaluation.env}
                        size="small"
                        sx={{
                          bgcolor: envData?.color || '#888',
                          color: '#fff',
                          borderRadius: '4px',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          height: 20,
                        }}
                      />
                    );
                  })()}
                </Box>
                <Box
                  sx={{
                    px: 1.5,
                    py: 1,
                    borderLeft: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Chip
                    icon={
                      selectedEvaluation.result.enabled ? (
                        <TrueIcon fontSize="small" />
                      ) : (
                        <FalseIcon fontSize="small" />
                      )
                    }
                    label={selectedEvaluation.result.enabled ? 'true' : 'false'}
                    size="small"
                    color={selectedEvaluation.result.enabled ? 'success' : 'error'}
                    sx={{
                      borderRadius: '4px',
                      fontWeight: 800,
                      height: 20,
                      fontSize: '0.65rem',
                      '& .MuiChip-label': { px: 0.8 },
                    }}
                  />
                </Box>
                <Box
                  sx={{
                    px: 2,
                    py: 1,
                    borderLeft: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Typography
                    variant="body2"
                    color="text.primary"
                    sx={{ fontWeight: 500, lineHeight: 1.3 }}
                  >
                    {getLocalizedReason(
                      selectedEvaluation.result.reason,
                      selectedEvaluation.result.reasonDetails
                    )}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* SCROLLABLE BODY */}
            <Box sx={{ p: 2, pt: 1, overflow: 'auto', flex: 1 }}>
              {/* Flag Strategy Structure (Evaluation Blueprint) */}
              {loadingFlagDetails ? (
                <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={16} />
                  <Typography variant="caption" color="text.secondary">
                    {t('common.loading')}...
                  </Typography>
                </Box>
              ) : (
                flagDetails &&
                (() => {
                  // Find environment strategies
                  const envConfig = flagDetails.environments?.find(
                    (e: any) => e.environment === selectedEvaluation.env
                  );

                  // If there's an environment override, use its strategies.
                  // If no environment override exists, it might be using global strategies.
                  // But if the environment config exists and strategies is empty/null, it means NO strategies.
                  const strategies = envConfig
                    ? envConfig.strategies || []
                    : flagDetails.strategies || [];

                  if (strategies.length === 0) {
                    return null;
                  }

                  // Map strategy names from evaluation result to track which was matched
                  const matchedStrategyName = selectedEvaluation.result.reasonDetails?.strategyName;

                  return (
                    <Box sx={{ mb: 2 }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        fontWeight={600}
                        sx={{ display: 'block', mb: 1 }}
                      >
                        {t('playground.evaluationBlueprint')}:
                      </Typography>
                      <Box
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                          overflow: 'hidden',
                        }}
                      >
                        {strategies.map((strategy: any, stratIdx: number) => {
                          const strategyName = strategy.name || strategy.strategyName;
                          const localizedName = (() => {
                            const key = `featureFlags.strategyTypes.${strategyName}`;
                            const localized = t(key);
                            return localized !== key ? localized : strategyName;
                          })();

                          const isMatched = matchedStrategyName === strategyName;
                          const wasEvaluated = selectedEvaluation.result.evaluationSteps?.some(
                            (step: any) =>
                              step.type === 'STRATEGY' && step.strategyName === strategyName
                          );
                          const stepResult = selectedEvaluation.result.evaluationSteps?.find(
                            (step: any) =>
                              step.type === 'STRATEGY' && step.strategyName === strategyName
                          );

                          return (
                            <Box
                              key={stratIdx}
                              sx={{
                                p: 1.5,
                                borderBottom:
                                  stratIdx < strategies.length - 1 ? '1px solid' : 'none',
                                borderColor: 'divider',
                                bgcolor: isMatched
                                  ? 'success.50'
                                  : wasEvaluated
                                    ? stepResult?.passed
                                      ? 'success.50'
                                      : 'error.50'
                                    : 'action.hover',
                                position: 'relative',
                                '&::before': isMatched
                                  ? {
                                    content: '""',
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    bottom: 0,
                                    width: 4,
                                    bgcolor: 'success.main',
                                  }
                                  : wasEvaluated && !stepResult?.passed
                                    ? {
                                      content: '""',
                                      position: 'absolute',
                                      left: 0,
                                      top: 0,
                                      bottom: 0,
                                      width: 4,
                                      bgcolor: 'error.main',
                                    }
                                    : {},
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                {isMatched ? (
                                  <TrueIcon sx={{ fontSize: 16, color: 'success.main' }} />
                                ) : wasEvaluated ? (
                                  stepResult?.passed ? (
                                    <TrueIcon sx={{ fontSize: 16, color: 'success.main' }} />
                                  ) : (
                                    <FalseIcon sx={{ fontSize: 16, color: 'error.main' }} />
                                  )
                                ) : (
                                  <RemoveCircleOutlineIcon
                                    sx={{ fontSize: 16, color: 'grey.400' }}
                                  />
                                )}
                                <Typography variant="body2" fontWeight={600}>
                                  {t('playground.strategyLabel', { index: stratIdx + 1 })}:{' '}
                                  {localizedName}
                                </Typography>
                                {isMatched && (
                                  <Chip
                                    label={t('playground.matched')}
                                    size="small"
                                    color="success"
                                    sx={{ height: 18, fontSize: '0.65rem' }}
                                  />
                                )}
                                {!wasEvaluated && (
                                  <Chip
                                    label={t('playground.notEvaluated')}
                                    size="small"
                                    sx={{
                                      height: 18,
                                      fontSize: '0.65rem',
                                      bgcolor: 'grey.300',
                                      color: 'grey.600',
                                    }}
                                  />
                                )}
                              </Box>

                              {/* Strategy components preview */}
                              <Box
                                sx={{ pl: 3, display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}
                              >
                                {strategy.segments && strategy.segments.length > 0 && (
                                  <Chip
                                    label={`${strategy.segments.length} ${t('playground.segments')}`}
                                    size="small"
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: '0.65rem' }}
                                  />
                                )}
                                {strategy.constraints && strategy.constraints.length > 0 && (
                                  <Chip
                                    label={`${strategy.constraints.length} ${t('playground.constraints')}`}
                                    size="small"
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: '0.65rem' }}
                                  />
                                )}
                                {strategy.rollout !== undefined && strategy.rollout < 100 && (
                                  <Chip
                                    label={`${t('playground.rolloutLabel')}: ${strategy.rollout}%`}
                                    size="small"
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: '0.65rem' }}
                                  />
                                )}
                                {strategy.variants && strategy.variants.length > 0 && (
                                  <Chip
                                    label={`${strategy.variants.length} ${t('playground.variants')}`}
                                    size="small"
                                    variant="outlined"
                                    color="secondary"
                                    sx={{ height: 20, fontSize: '0.65rem' }}
                                  />
                                )}
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  );
                })()
              )}

              {/* Context Fields Used */}
              <Divider sx={{ borderStyle: 'dashed', my: 2.5 }} />
              {contextEntries.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mb: 0.5 }}
                  >
                    {t('playground.usedContext')}:
                  </Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 150 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell
                            sx={{ py: 0.5, fontWeight: 600, bgcolor: 'action.hover', width: '40%' }}
                          >
                            {t('playground.contextField')}
                          </TableCell>
                          <TableCell sx={{ py: 0.5, fontWeight: 600, bgcolor: 'action.hover' }}>
                            {t('playground.contextValue')}
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {contextEntries.map((entry, idx) => (
                          <TableRow key={idx} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                            <TableCell sx={{ py: 0.5 }}>
                              <Typography variant="caption" fontWeight={500}>
                                {entry.key}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ py: 0.5 }}>
                              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                {entry.value}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
              {contextEntries.length === 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mb: 0.5 }}
                  >
                    {t('playground.usedContext')}:
                  </Typography>
                  <Box
                    sx={{
                      p: 1,
                      border: '1px dashed',
                      borderColor: 'divider',
                      borderRadius: 1,
                      bgcolor: 'action.hover',
                      textAlign: 'center',
                    }}
                  >
                    <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                      {t('playground.noContextProvided')}
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Evaluation Steps Group */}
              <Divider sx={{ borderStyle: 'dashed', my: 2.5 }} />
              {selectedEvaluation.result.evaluationSteps &&
                selectedEvaluation.result.evaluationSteps.length > 0 && (
                  <>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      fontWeight={600}
                      sx={{ display: 'block', mb: 1 }}
                    >
                      {t('playground.evaluationSteps')}:
                    </Typography>
                    <Box
                      sx={{
                        bgcolor: 'background.paper',
                        borderRadius: 1,
                        border: 1,
                        borderColor: 'divider',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Summary Row */}
                      {(() => {
                        const steps = selectedEvaluation.result.evaluationSteps || [];
                        const totalSteps = steps.length;
                        const passedSteps = steps.filter((s: any) => s.passed === true).length;
                        const failedSteps = steps.filter((s: any) => s.passed === false).length;
                        const subChecks = steps.reduce(
                          (acc: number, s: any) => acc + (s.checks?.length || 0),
                          0
                        );
                        const totalChecks = totalSteps + subChecks;
                        const passedSubChecks = steps.reduce(
                          (acc: number, s: any) =>
                            acc + (s.checks?.filter((c: any) => c.passed).length || 0),
                          0
                        );
                        const passedChecks = passedSteps + passedSubChecks;

                        return (
                          <Box
                            sx={{
                              p: 1.5,
                              bgcolor: 'action.hover',
                              borderBottom: 1,
                              borderColor: 'divider',
                              display: 'flex',
                              gap: 2,
                              flexWrap: 'wrap',
                              alignItems: 'center',
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                {t('playground.summary.totalSteps')}:
                              </Typography>
                              <Chip
                                label={totalSteps}
                                size="small"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                {t('playground.summary.stepResults')}:
                              </Typography>
                              <Chip
                                label={`${passedSteps} ${t('playground.summary.passed')}`}
                                size="small"
                                color="success"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                              {failedSteps > 0 && (
                                <Chip
                                  label={`${failedSteps} ${t('playground.summary.failed')}`}
                                  size="small"
                                  color="error"
                                  variant="outlined"
                                  sx={{ height: 20, fontSize: '0.7rem' }}
                                />
                              )}
                            </Box>
                            {totalChecks > 0 && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography variant="caption" color="text.secondary">
                                  {t('playground.summary.totalChecks')}:
                                </Typography>
                                <Chip
                                  label={`${passedChecks}/${totalChecks}`}
                                  size="small"
                                  color={passedChecks === totalChecks ? 'success' : 'warning'}
                                  variant="outlined"
                                  sx={{
                                    height: 20,
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                  }}
                                />
                              </Box>
                            )}
                          </Box>
                        );
                      })()}

                      {/* Steps List */}
                      {selectedEvaluation.result.evaluationSteps.map(
                        (step: any, stepIdx: number) => {
                          const isStrategy = step.step === 'STRATEGY_EVALUATION';
                          const stepBgColor = stepIdx % 2 === 0 ? 'transparent' : 'action.hover';
                          const envDisplayName =
                            environments.find((e) => e.environment === selectedEvaluation.env)
                              ?.displayName || selectedEvaluation.env;

                          return (
                            <Box
                              key={stepIdx}
                              sx={{
                                borderBottom:
                                  stepIdx <
                                    (selectedEvaluation.result.evaluationSteps?.length || 1) - 1
                                    ? 1
                                    : 0,
                                borderColor: 'divider',
                                bgcolor: stepBgColor,
                              }}
                            >
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  p: 1.5,
                                }}
                              >
                                <Box sx={{ width: 24, flexShrink: 0, pt: 0.2 }}>
                                  {step.passed === true && (
                                    <TrueIcon color="success" fontSize="small" />
                                  )}
                                  {step.passed === false && (
                                    <FalseIcon color="error" fontSize="small" />
                                  )}
                                  {step.passed === null && (
                                    <Box
                                      sx={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: '50%',
                                        bgcolor: 'grey.400',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      <Typography variant="caption" color="white">
                                        -
                                      </Typography>
                                    </Box>
                                  )}
                                </Box>

                                <Box sx={{ width: 170, flexShrink: 0 }}>
                                  <Typography
                                    variant="body2"
                                    fontWeight={isStrategy ? 600 : 500}
                                    color={isStrategy ? 'primary.main' : 'text.primary'}
                                  >
                                    {step.step === 'FLAG_STATUS' &&
                                      t('playground.steps.flagStatus')}
                                    {step.step === 'ENVIRONMENT_CHECK' &&
                                      t('playground.steps.environmentCheck')}
                                    {step.step === 'STRATEGY_COUNT' &&
                                      t('playground.steps.strategyCount')}
                                    {step.step === 'STRATEGY_EVALUATION' &&
                                      t('playground.steps.strategy', {
                                        name: step.strategyName
                                          ? getLocalizedStrategyName(step.strategyName)
                                          : `#${(step.strategyIndex ?? 0) + 1}`,
                                      })}
                                  </Typography>
                                </Box>

                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="body2" color="text.secondary">
                                    {getLocalizedStepMessage(step, envDisplayName)}
                                  </Typography>

                                  {/* Show detailed checks for strategy evaluation */}
                                  {isStrategy && step.checks && step.checks.length > 0 && (
                                    <Box sx={{ mt: 1.5, pl: 1 }}>
                                      <Box
                                        sx={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 1,
                                          mb: 1,
                                        }}
                                      >
                                        <Typography variant="caption" color="text.secondary">
                                          {t('playground.detailedChecks')}:
                                        </Typography>
                                        {(() => {
                                          const firstFailedIdx = step.checks.findIndex(
                                            (c: any) => c.passed === false
                                          );
                                          const totalCount = step.checks.length;
                                          // Only count checks that were actually evaluated (up to and including first failure)
                                          const evaluatedCount =
                                            firstFailedIdx === -1 ? totalCount : firstFailedIdx + 1;
                                          const passedCount =
                                            firstFailedIdx === -1 ? totalCount : firstFailedIdx;
                                          const skippedCount = totalCount - evaluatedCount;
                                          const allPassed = passedCount === totalCount;
                                          return (
                                            <>
                                              <Chip
                                                label={t('playground.checkCountDetail', {
                                                  passed: passedCount,
                                                  total: totalCount,
                                                })}
                                                size="small"
                                                sx={{
                                                  height: 18,
                                                  fontSize: '0.65rem',
                                                  fontWeight: 600,
                                                  bgcolor: allPassed ? 'success.100' : 'error.100',
                                                  color: allPassed ? 'success.dark' : 'error.dark',
                                                  '& .MuiChip-label': { px: 1 },
                                                }}
                                              />
                                              {skippedCount > 0 && (
                                                <Chip
                                                  label={t('playground.checkSkippedCount', {
                                                    count: skippedCount,
                                                  })}
                                                  size="small"
                                                  sx={{
                                                    height: 18,
                                                    fontSize: '0.65rem',
                                                    fontWeight: 600,
                                                    bgcolor: 'grey.200',
                                                    color: 'grey.600',
                                                    '& .MuiChip-label': { px: 1 },
                                                  }}
                                                />
                                              )}
                                            </>
                                          );
                                        })()}
                                      </Box>
                                      <Stack spacing={0}>
                                        {(() => {
                                          // Find the first failed check index to determine skipped checks
                                          const firstFailedIdx = step.checks.findIndex(
                                            (c: any) => c.passed === false
                                          );

                                          return step.checks.map((check: any, checkIdx: number) => {
                                            // Determine if this check was skipped (came after first failure)
                                            const isSkipped =
                                              firstFailedIdx !== -1 && checkIdx > firstFailedIdx;

                                            // Determine the operator to show before this check
                                            const prevCheck =
                                              checkIdx > 0 ? step.checks[checkIdx - 1] : null;
                                            let showOperator = false;
                                            let operatorType: 'AND' | 'OR' | null = null;

                                            if (prevCheck) {
                                              // Same type constraints use AND
                                              if (check.type === prevCheck.type) {
                                                showOperator = true;
                                                operatorType = 'AND';
                                              }
                                              // Different check categories (segments -> constraints -> rollout)
                                              else if (
                                                (prevCheck.type === 'SEGMENTS_CHECK' ||
                                                  prevCheck.type === 'SEGMENT' ||
                                                  prevCheck.type === 'SEGMENT_CONSTRAINT') &&
                                                (check.type === 'CONSTRAINTS_CHECK' ||
                                                  check.type === 'STRATEGY_CONSTRAINT')
                                              ) {
                                                showOperator = true;
                                                operatorType = 'AND';
                                              } else if (
                                                (prevCheck.type === 'CONSTRAINTS_CHECK' ||
                                                  prevCheck.type === 'STRATEGY_CONSTRAINT') &&
                                                check.type === 'ROLLOUT'
                                              ) {
                                                showOperator = true;
                                                operatorType = 'AND';
                                              } else if (
                                                (prevCheck.type === 'SEGMENTS_CHECK' ||
                                                  prevCheck.type === 'SEGMENT' ||
                                                  prevCheck.type === 'SEGMENT_CONSTRAINT') &&
                                                check.type === 'ROLLOUT'
                                              ) {
                                                showOperator = true;
                                                operatorType = 'AND';
                                              }
                                            }
                                            // Map check types to localized labels
                                            let checkLabel = check.type;
                                            if (check.type === 'SEGMENT_CONSTRAINT') {
                                              checkLabel = `${t('playground.checkTypes.segmentConstraint')}: ${check.segment}`;
                                            } else if (check.type === 'STRATEGY_CONSTRAINT') {
                                              checkLabel = t(
                                                'playground.checkTypes.strategyConstraint'
                                              );
                                            } else if (check.type === 'ROLLOUT') {
                                              checkLabel = t('playground.checkTypes.rollout');
                                            } else if (check.type === 'SEGMENTS_CHECK') {
                                              checkLabel = t('playground.checkTypes.segmentsCheck');
                                            } else if (check.type === 'CONSTRAINTS_CHECK') {
                                              checkLabel = t(
                                                'playground.checkTypes.constraintsCheck'
                                              );
                                            } else if (check.type === 'SEGMENT') {
                                              checkLabel = `${t('playground.checkTypes.segment')}: ${check.name}`;
                                            }

                                            return (
                                              <React.Fragment key={checkIdx}>
                                                {showOperator && operatorType && (
                                                  <Box
                                                    sx={{
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      pl: 3,
                                                      my: '-5px',
                                                      position: 'relative',
                                                      zIndex: 1,
                                                    }}
                                                  >
                                                    <Chip
                                                      label={operatorType}
                                                      size="small"
                                                      sx={{
                                                        height: 18,
                                                        fontSize: '0.65rem',
                                                        fontWeight: 600,
                                                        bgcolor: 'grey.500',
                                                        color: 'common.white',
                                                        '& .MuiChip-label': { px: 1 },
                                                      }}
                                                    />
                                                  </Box>
                                                )}
                                                <Box
                                                  sx={{
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    gap: 1,
                                                    p: 1,
                                                    borderRadius: 1,
                                                    border: '1px dashed',
                                                    borderColor: isSkipped
                                                      ? 'action.disabled'
                                                      : check.passed
                                                        ? 'success.light'
                                                        : 'error.light',
                                                    bgcolor: isSkipped
                                                      ? 'action.disabledBackground'
                                                      : check.passed
                                                        ? 'success.50'
                                                        : 'error.50',
                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                                                    opacity: isSkipped ? 0.7 : 1,
                                                  }}
                                                >
                                                  <Box sx={{ pt: 0.3, flexShrink: 0 }}>
                                                    {isSkipped ? (
                                                      <RemoveCircleOutlineIcon
                                                        sx={{ fontSize: 16, color: 'grey.500' }}
                                                      />
                                                    ) : check.passed ? (
                                                      <TrueIcon
                                                        sx={{ fontSize: 16, color: 'success.main' }}
                                                      />
                                                    ) : (
                                                      <FalseIcon
                                                        sx={{ fontSize: 16, color: 'error.main' }}
                                                      />
                                                    )}
                                                  </Box>
                                                  <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Typography
                                                      variant="caption"
                                                      fontWeight={500}
                                                      color={
                                                        isSkipped ? 'text.disabled' : 'text.primary'
                                                      }
                                                    >
                                                      {checkLabel}
                                                      {isSkipped &&
                                                        ` (${t('playground.checkSkipped')})`}
                                                    </Typography>
                                                    {check.type === 'ROLLOUT' ? (
                                                      <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                        sx={{ display: 'block' }}
                                                      >
                                                        {check.rollout === 100
                                                          ? t('playground.checkMessages.rollout100')
                                                          : t('playground.rolloutDetail', {
                                                            percentage:
                                                              check.percentage?.toFixed(1) ?? '?',
                                                            rollout: check.rollout ?? 100,
                                                          })}
                                                      </Typography>
                                                    ) : check.constraint ? (
                                                      <Box sx={{ mt: 0.5 }}>
                                                        <ConstraintDisplay
                                                          constraint={check.constraint}
                                                          compact
                                                        />
                                                        {check.contextValue !== undefined && (
                                                          <Typography
                                                            variant="caption"
                                                            sx={{
                                                              display: 'block',
                                                              mt: 0.25,
                                                              color: check.passed
                                                                ? 'success.main'
                                                                : 'error.main',
                                                            }}
                                                          >
                                                            {t('playground.contextValue')}:{' '}
                                                            <code
                                                              style={{
                                                                fontFamily: 'monospace',
                                                                backgroundColor: 'rgba(0,0,0,0.1)',
                                                                padding: '1px 4px',
                                                                borderRadius: 2,
                                                              }}
                                                            >
                                                              {check.contextValue === ''
                                                                ? t('common.emptyString')
                                                                : String(
                                                                  check.contextValue ?? 'undefined'
                                                                )}
                                                            </code>
                                                          </Typography>
                                                        )}
                                                      </Box>
                                                    ) : check.type === 'SEGMENTS_CHECK' ? (
                                                      <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                        sx={{ display: 'block' }}
                                                      >
                                                        {t('playground.checkMessages.noSegments')}
                                                      </Typography>
                                                    ) : check.type === 'CONSTRAINTS_CHECK' ? (
                                                      <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                        sx={{ display: 'block' }}
                                                      >
                                                        {t(
                                                          'playground.checkMessages.noConstraints'
                                                        )}
                                                      </Typography>
                                                    ) : check.type === 'SEGMENT' ? (
                                                      <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                        sx={{ display: 'block' }}
                                                      >
                                                        {check.message ===
                                                          'Segment has no constraints - passed'
                                                          ? t(
                                                            'playground.checkMessages.segmentNoConstraints'
                                                          )
                                                          : check.message ===
                                                            'Segment not found - skipped'
                                                            ? t(
                                                              'playground.checkMessages.segmentNotFound'
                                                            )
                                                            : check.message}
                                                      </Typography>
                                                    ) : null}
                                                  </Box>
                                                </Box>
                                              </React.Fragment>
                                            );
                                          });
                                        })()}
                                      </Stack>
                                    </Box>
                                  )}

                                  {isStrategy && step.passed && step.variantName && (
                                    <Box
                                      sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}
                                    >
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
                        }
                      )}
                    </Box>
                  </>
                )}

              {/* Final Payload View (Integrated Variant View) */}
              <Divider sx={{ borderStyle: 'dashed', my: 2.5 }} />
              <Box
                sx={{
                  mt: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 1,
                }}
              >
                <Typography variant="subtitle2" color="text.secondary">
                  {t('playground.appliedVariant')}
                </Typography>
                {selectedEvaluation.result.variant && (
                  <Tooltip title={t('common.copy')}>
                    <IconButton
                      size="small"
                      onClick={() => {
                        const value = selectedEvaluation.result.variant?.value;
                        const valueToCopy =
                          typeof value === 'object' && value !== null && 'value' in value
                            ? String(value.value)
                            : typeof value === 'object'
                              ? JSON.stringify(value)
                              : String(value ?? '');
                        copyToClipboardWithNotification(
                          valueToCopy,
                          () =>
                            enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
                          () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
                        );
                      }}
                    >
                      <CopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'background.paper',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 1.5,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {selectedEvaluation.result.enabled ? (
                        <TrueIcon sx={{ fontSize: 20, color: 'success.main' }} />
                      ) : (
                        <FalseIcon sx={{ fontSize: 20, color: 'error.main' }} />
                      )}
                    </Box>

                    {selectedEvaluation.result.variant ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle2" fontWeight={600} color="text.primary">
                          {t('playground.appliedVariant')}:
                        </Typography>
                        <Chip
                          label={selectedEvaluation.result.variant.name}
                          size="small"
                          color="secondary"
                          sx={{
                            borderRadius: '4px',
                            fontWeight: 600,
                            height: 20,
                            fontSize: '0.75rem',
                          }}
                        />
                      </Box>
                    ) : (
                      <Typography variant="subtitle2" fontWeight={600} color="text.disabled">
                        {t('playground.noVariant')}
                      </Typography>
                    )}
                  </Box>
                </Box>

                {selectedEvaluation.result.variant ? (
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    {(() => {
                      const valueType = selectedEvaluation.result.variant?.valueType;
                      const iconSx = { fontSize: 20, color: 'text.secondary', mt: 0.3 };
                      if (valueType === 'json') return <JsonIcon sx={iconSx} />;
                      if (valueType === 'number') return <NumberIcon sx={iconSx} />;
                      if (valueType === 'string') return <StringIcon sx={iconSx} />;
                      return <CodeIcon sx={iconSx} />;
                    })()}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      {(() => {
                        const value = selectedEvaluation.result.variant?.value;
                        const valueType = selectedEvaluation.result.variant?.valueType;

                        // If it's the specific Gatrix JSON structure, extract just the value
                        if (typeof value === 'object' && value !== null && 'value' in value) {
                          const innerValue = (value as any).value;
                          if (valueType === 'json' || (value as any).type === 'json') {
                            return (
                              <Box
                                sx={{
                                  p: 1,
                                  bgcolor: 'action.hover',
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  borderRadius: 1,
                                  maxHeight: 200,
                                  overflow: 'auto',
                                }}
                              >
                                <pre
                                  style={{
                                    margin: 0,
                                    fontSize: '13px',
                                    fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
                                    fontWeight: 500,
                                    color: 'var(--mui-palette-text-primary)',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                  }}
                                >
                                  {(() => {
                                    try {
                                      return JSON.stringify(JSON.parse(innerValue), null, 2);
                                    } catch {
                                      return innerValue;
                                    }
                                  })()}
                                </pre>
                              </Box>
                            );
                          }
                          return (
                            <Typography
                              variant="body1"
                              sx={{
                                py: 1.5,
                                px: 2,
                                minHeight: 44,
                                display: 'flex',
                                alignItems: 'center',
                                bgcolor: 'action.hover',
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 1,
                                fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
                                fontWeight: 500,
                                wordBreak: 'break-all',
                                ...(innerValue === '' && { fontStyle: 'italic', color: 'text.disabled' }),
                              }}
                            >
                              {innerValue === ''
                                ? t('common.emptyString')
                                : (typeof innerValue === 'object' && innerValue !== null && Object.keys(innerValue).length === 0)
                                  ? t('common.emptyObject')
                                  : innerValue}
                            </Typography>
                          );
                        }

                        // Fallback for other formats
                        if (value === undefined || value === null) {
                          return (
                            <Typography variant="body2" color="text.disabled" fontStyle="italic">
                              {t('common.noValue')}
                            </Typography>
                          );
                        }

                        if (valueType === 'json') {
                          // Check if JSON value is an empty object
                          const isEmptyObj = typeof value === 'object' && value !== null && Object.keys(value).length === 0;
                          if (isEmptyObj) {
                            return (
                              <Typography
                                variant="body1"
                                sx={{
                                  py: 1.5,
                                  px: 2,
                                  minHeight: 44,
                                  display: 'flex',
                                  alignItems: 'center',
                                  bgcolor: 'action.hover',
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  borderRadius: 1,
                                  fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
                                  fontWeight: 500,
                                  fontStyle: 'italic',
                                  color: 'text.disabled',
                                }}
                              >
                                {t('common.emptyObject')}
                              </Typography>
                            );
                          }
                          return (
                            <Box
                              sx={{
                                p: 1,
                                bgcolor: 'action.hover',
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 1,
                                maxHeight: 200,
                                overflow: 'auto',
                              }}
                            >
                              <pre
                                style={{
                                  margin: 0,
                                  fontSize: '13px',
                                  fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
                                  fontWeight: 500,
                                  color: 'var(--mui-palette-text-primary)',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                }}
                              >
                                {JSON.stringify(value, null, 2)}
                              </pre>
                            </Box>
                          );
                        }

                        const displayValue = typeof value === 'object'
                          ? JSON.stringify(value)
                          : String(value);
                        const isEmpty = displayValue === '';
                        return (
                          <Typography
                            variant="body1"
                            sx={{
                              py: 1.5,
                              px: 2,
                              minHeight: 44,
                              display: 'flex',
                              alignItems: 'center',
                              bgcolor: 'action.hover',
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 1,
                              fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
                              fontWeight: 500,
                              wordBreak: 'break-all',
                              ...(isEmpty && { fontStyle: 'italic', color: 'text.disabled' }),
                            }}
                          >
                            {isEmpty ? t('common.emptyString') : displayValue}
                          </Typography>
                        );
                      })()}
                      {selectedEvaluation.result.variant.valueSource && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            display: 'block',
                            mt: 1,
                            fontStyle: 'italic',
                          }}
                        >
                          •{' '}
                          {selectedEvaluation.result.variant.valueSource === 'environment'
                            ? t('playground.valueSourceEnvironmentDesc')
                            : selectedEvaluation.result.variant.valueSource === 'flag'
                              ? t('playground.valueSourceFlagDesc')
                              : t('playground.valueSourceVariantDesc')}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      p: 2,
                      textAlign: 'center',
                      border: '1px dashed',
                      borderColor: 'divider',
                      borderRadius: 1,
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Typography variant="body2" color="text.disabled">
                      {t('playground.noVariantDeterminedDesc') ||
                        'No variant determined for this evaluation.'}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Raw Response JSON */}
              <Divider sx={{ borderStyle: 'dashed', my: 2.5 }} />
              <Box sx={{ mt: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 1,
                  }}
                >
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('playground.rawResponse')}
                  </Typography>
                  <Tooltip title={t('common.copyToClipboard')}>
                    <IconButton
                      size="small"
                      onClick={() => {
                        const jsonStr = JSON.stringify(
                          {
                            enabled: selectedEvaluation.result.enabled,
                            variant: selectedEvaluation.result.variant,
                            reason: selectedEvaluation.result.reason,
                          },
                          null,
                          2
                        );
                        copyToClipboardWithNotification(
                          jsonStr,
                          () =>
                            enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
                          () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
                        );
                      }}
                    >
                      <CopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <JsonEditor
                  value={JSON.stringify(
                    {
                      enabled: selectedEvaluation.result.enabled,
                      variant: selectedEvaluation.result.variant,
                      reason: selectedEvaluation.result.reason,
                    },
                    null,
                    2
                  )}
                  onChange={() => { }}
                  readOnly
                  height={200}
                />
              </Box>
            </Box>
          </>
        )}
      </Box>
    </Popover>
  );

  // Embedded mode: render content without Dialog wrapper
  if (embedded) {
    return (
      <Collapse in={open} timeout={400} unmountOnExit>
        <Box sx={{ py: 1, overflow: 'hidden' }}>
          <Stack spacing={1.5}>
            {/* Context Fields - Use shared render function */}
            {renderContextFields()}

            {/* Evaluate Button */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <PlayIcon />}
                onClick={handleEvaluate}
                disabled={!canEvaluate || loading}
              >
                {loading ? t('playground.evaluating') : t('playground.test')}
              </Button>
            </Box>

            {/* Results Table - Use shared render function */}
            {renderResultsTable()}
          </Stack>
          {renderDetailedEvaluationPopover()}
        </Box>
      </Collapse>
    );
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: '80vh' },
        }}
      >
        <DialogTitle
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <JoystickIcon color="primary" />
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
                <FormHelperText>{t('playground.environmentHelpDetail')}</FormHelperText>
              </Box>

              {/* Context Fields - Use shared render function */}
              {renderContextFields()}

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
                  options={availableFlags.map((f) => f.flagName)}
                  value={selectedFlags}
                  onChange={(_, values) => setSelectedFlags(values)}
                  renderOption={(props, option) => {
                    const flag = availableFlags.find((f) => f.flagName === option);
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
                <FormHelperText>{t('playground.flagSelectionDetail')}</FormHelperText>
              </Box>

              {/* Evaluate Button */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  startIcon={
                    loading ? <CircularProgress size={16} color="inherit" /> : <PlayIcon />
                  }
                  onClick={handleEvaluate}
                  disabled={!canEvaluate || loading}
                >
                  {loading ? t('playground.evaluating') : t('playground.test')}
                </Button>
              </Box>
            </Paper>

            {/* Results Section - Use shared render function */}
            {renderResultsTable()}
          </Stack>
        </DialogContent>
      </Dialog>

      {renderDetailedEvaluationPopover()}
    </>
  );
};

export default PlaygroundDialog;
