/**
 * Environment Variants Editor - Inline variants editing within environment cards
 *
 * Features:
 * - Display variant weight distribution bar
 * - Add, edit, delete variants
 * - Explicit save button for applying changes
 * - Shows guidance to flag values tab when valueType is set
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { styled } from '@mui/material/styles';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  TextField,
  Tooltip,
  IconButton,
  Collapse,
  Chip,
  Switch,
  Divider,
  InputAdornment,
  Grid,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  HelpOutline as HelpOutlineIcon,
  Abc as StringIcon,
  Numbers as NumberIcon,
  DataObject as JsonIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import JsonEditor from '../common/JsonEditor';
import ValueEditorField from '../common/ValueEditorField';
import BooleanSwitch from '../common/BooleanSwitch';

const OverrideSwitch = styled(Switch)(({ theme }) => ({
  width: 100,
  height: 28,
  padding: 0,
  '& .MuiSwitch-switchBase': {
    padding: 0,
    margin: 2,
    transitionDuration: '200ms',
    // Expand input to cover the whole switch width (100px)
    '& .MuiSwitch-input': {
      width: 100,
      left: -2, // Adjusting for the margin: 2
      top: -2,
      height: 28,
      margin: 0,
    },
    '&.Mui-checked': {
      transform: 'translateX(72px)',
      color: '#fff',
      '& .MuiSwitch-input': {
        left: -74, // Compensate for translateX(72px) + margin: 2 to keep input at left: 0 relative to parent
      },
      '& + .MuiSwitch-track': {
        backgroundColor: theme.palette.primary.main,
        opacity: 1,
        border: 0,
        '&:before': {
          opacity: 1,
        },
        '&:after': {
          opacity: 0,
        },
      },
    },
  },
  '& .MuiSwitch-thumb': {
    boxSizing: 'border-box',
    width: 24,
    height: 24,
  },
  '& .MuiSwitch-track': {
    borderRadius: 14,
    backgroundColor: theme.palette.mode === 'dark' ? '#616161' : '#bdbdbd',
    opacity: 1,
    position: 'relative',
    '&:before, &:after': {
      position: 'absolute',
      top: '50%',
      transform: 'translateY(-50%)',
      fontSize: 10,
      fontWeight: 600,
      fontFamily: theme.typography.fontFamily,
      transition: 'opacity 200ms',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
    },
    '&:before': {
      content: '"개별 설정"',
      left: 10,
      color: '#fff',
      opacity: 0,
    },
    '&:after': {
      content: '"전역 설정"',
      right: 10,
      color: '#fff',
      opacity: 1,
    },
  },
}));

export interface Variant {
  name: string;
  weight: number;
  weightLock?: boolean;
  stickiness?: string;
  value?: any;
  valueType: 'boolean' | 'string' | 'json' | 'number';
}

interface EnvironmentVariantsEditorProps {
  environment: string;
  variants: Variant[];
  valueType: 'boolean' | 'string' | 'json' | 'number';
  flagType?: string;
  enabledValue: any; // Global enabled value
  disabledValue: any; // Global disabled value
  envEnabledValue?: any; // Environment-specific enabled value
  envDisabledValue?: any; // Environment-specific disabled value
  canManage: boolean;
  isArchived?: boolean;
  onSave: (variants: Variant[]) => Promise<void>;
  onSaveValues?: (enabledValue: any, disabledValue: any, useGlobal: boolean) => Promise<void>;
  onGoToPayloadTab: () => void;
}

// Helper function to distribute weights among variants
const distributeWeights = (variants: Variant[]): Variant[] => {
  if (variants.length === 0) return variants;

  const lockedVariants = variants.filter((v) => v.weightLock);
  const unlockedVariants = variants.filter((v) => !v.weightLock);
  const totalLockedWeight = lockedVariants.reduce((sum, v) => sum + (v.weight || 0), 0);

  const remainingWeight = Math.max(0, 100 - totalLockedWeight);

  if (unlockedVariants.length === 0) {
    return variants;
  }

  const baseWeight = Math.floor(remainingWeight / unlockedVariants.length);
  const remainder = remainingWeight % unlockedVariants.length;

  let unlockedIndex = 0;
  return variants.map((v) => {
    if (v.weightLock) {
      return v;
    }
    const weight = baseWeight + (unlockedIndex < remainder ? 1 : 0);
    unlockedIndex++;
    return { ...v, weight };
  });
};

const EnvironmentVariantsEditor: React.FC<EnvironmentVariantsEditorProps> = ({
  environment,
  variants: initialVariants,
  valueType,
  flagType = 'flag',
  enabledValue,
  disabledValue,
  envEnabledValue,
  envDisabledValue,
  canManage,
  isArchived,
  onSave,
  onSaveValues,
  onGoToPayloadTab,
}) => {
  const { t } = useTranslation();

  // --- Variants State & Logic ---
  const initialVariantsJson = useMemo(() => JSON.stringify(initialVariants), [initialVariants]);

  const [editingVariants, setEditingVariants] = useState<Variant[]>(initialVariants);
  const [prevVariantsJson, setPrevVariantsJson] = useState(initialVariantsJson);

  const [saving, setSaving] = useState(false);
  const [savingValues, setSavingValues] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [jsonErrors, setJsonErrors] = useState<Record<number, string | null>>({});

  // Ref to preserve expanded state
  const preserveExpandedRef = React.useRef(false);
  // Ref to track saving status to prevent state reset during data reload
  const isSavingRef = React.useRef(false);

  // Sync state if savingRef is true (meaning we just finished saving)
  useEffect(() => {
    if (!saving && !savingValues) {
      isSavingRef.current = false;
    }
  }, [saving, savingValues]);

  // Render-time Status Synchronization (prevents flicker)
  if (!isSavingRef.current && initialVariantsJson !== prevVariantsJson) {
    setPrevVariantsJson(initialVariantsJson);
    setEditingVariants(initialVariants);
  }

  const hasChanges = useMemo(() => {
    return JSON.stringify(editingVariants) !== initialVariantsJson;
  }, [editingVariants, initialVariantsJson]);

  // Effect to handle expansion logic on data reload
  useEffect(() => {
    if (preserveExpandedRef.current) {
      setExpanded(true);
      preserveExpandedRef.current = false;
    } else if (flagType === 'remoteConfig' && initialVariants.length > 0) {
      setExpanded(true);
    }
  }, [initialVariantsJson, flagType, initialVariants.length]);

  // --- Environment Values State & Logic ---
  const originalUseEnvOverride = useMemo(() => {
    return (envEnabledValue !== undefined && envEnabledValue !== null) ||
      (envDisabledValue !== undefined && envDisabledValue !== null);
  }, [envEnabledValue, envDisabledValue]);

  // Canonicalize helper for robust comparison and display
  const canonicalize = useCallback((val: any) => {
    // Basic null/undefined handling
    if (val === null || val === undefined) return valueType === 'json' ? '{}' : '';

    // Fix for corrupted "[object Object]" strings coming from server/previous state
    if (val === '[object Object]') return '{}';

    if (valueType === 'json') {
      try {
        // Normalize strings by parsing and re-stringifying
        if (typeof val === 'string') {
          if (val.trim() === '') return '{}';
          return JSON.stringify(JSON.parse(val));
        }
        // Objects are stringified directly
        return JSON.stringify(val);
      } catch {
        // Fallback for invalid JSON
        return typeof val === 'object' ? JSON.stringify(val) : String(val);
      }
    }
    // Avoid [object Object] for non-JSON types as well
    return typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
  }, [valueType]);

  // Helper to prepare value for API (ensures JSON fields receive objects, not strings)
  const toApiValue = useCallback((val: any) => {
    if (valueType === 'json') {
      try {
        if (typeof val === 'string') return JSON.parse(val === '' ? '{}' : val);
        return val ?? {};
      } catch {
        return {};
      }
    }
    return val;
  }, [valueType]);

  // Unified props snapshot for synchronization
  const propsSnapshot = useMemo(() => JSON.stringify({
    override: originalUseEnvOverride,
    enabled: canonicalize(envEnabledValue ?? enabledValue),
    disabled: canonicalize(envDisabledValue ?? disabledValue)
  }), [originalUseEnvOverride, envEnabledValue, enabledValue, envDisabledValue, disabledValue, canonicalize]);

  const [useEnvOverride, setUseEnvOverride] = useState(originalUseEnvOverride);
  const [editingEnabledValue, setEditingEnabledValue] = useState(envEnabledValue ?? enabledValue);
  const [editingDisabledValue, setEditingDisabledValue] = useState(envDisabledValue ?? disabledValue);
  const [valueJsonErrors, setValueJsonErrors] = useState<{
    enabledValue?: string | null;
    disabledValue?: string | null;
  }>({});

  const [prevPropsSnapshot, setPrevPropsSnapshot] = useState(propsSnapshot);

  // Sync state if props change (and we are not currently saving)
  if (!isSavingRef.current && propsSnapshot !== prevPropsSnapshot) {
    setPrevPropsSnapshot(propsSnapshot);
    setUseEnvOverride(originalUseEnvOverride);
    setEditingEnabledValue(envEnabledValue ?? enabledValue);
    setEditingDisabledValue(envDisabledValue ?? disabledValue);
    setValueJsonErrors({});
  }

  const valuesHasChanges = useMemo(() => {
    // 1. Toggle change is always a change
    if (useEnvOverride !== originalUseEnvOverride) return true;

    // 2. If overridden, compare current values with what's on server
    if (useEnvOverride) {
      return canonicalize(editingEnabledValue) !== canonicalize(envEnabledValue ?? enabledValue) ||
        canonicalize(editingDisabledValue) !== canonicalize(envDisabledValue ?? disabledValue);
    }

    return false;
  }, [useEnvOverride, editingEnabledValue, editingDisabledValue, originalUseEnvOverride, envEnabledValue, enabledValue, envDisabledValue, disabledValue, canonicalize]);

  // Handle save fallback values
  const handleSaveValuesClick = useCallback(async () => {
    if (!onSaveValues) return;

    // Validate JSON if needed
    if (valueType === 'json' && useEnvOverride) {
      if (valueJsonErrors.enabledValue || valueJsonErrors.disabledValue) {
        return;
      }
    }

    isSavingRef.current = true;
    setSavingValues(true);
    try {
      if (useEnvOverride) {
        // Send actual objects for JSON to backend
        await onSaveValues(toApiValue(editingEnabledValue), toApiValue(editingDisabledValue), false);
      } else {
        // Clear env-specific, use global
        await onSaveValues(null, null, true);
      }
    } catch (error) {
      // Error handled by parent or snackbar
      isSavingRef.current = false;
    } finally {
      setSavingValues(false);
      // Let the sync happen in a subsequent render after props are updated
      setTimeout(() => { isSavingRef.current = false; }, 100);
    }
  }, [onSaveValues, valueType, useEnvOverride, editingEnabledValue, editingDisabledValue, valueJsonErrors, t]);

  // Handle reset values
  const handleResetValues = useCallback(() => {
    setUseEnvOverride(originalUseEnvOverride);
    setEditingEnabledValue(envEnabledValue ?? enabledValue);
    setEditingDisabledValue(envDisabledValue ?? disabledValue);
    setValueJsonErrors({});
  }, [originalUseEnvOverride, envEnabledValue, enabledValue, envDisabledValue, disabledValue]);

  // Unwrap legacy wrapped values like {type: 'string', value: ''} from old clearVariantValues code
  const unwrapValue = useCallback((val: any): any => {
    if (val !== null && typeof val === 'object' && 'type' in val && 'value' in val && Object.keys(val).length === 2) {
      return val.value;
    }
    return val;
  }, []);

  const addVariant = useCallback(() => {
    const lastVariant = editingVariants[editingVariants.length - 1];
    let defaultValue: any;

    if (lastVariant?.value !== undefined) {
      defaultValue = lastVariant.value;
    } else if (valueType === 'number') {
      defaultValue = 0;
    } else if (valueType === 'json') {
      defaultValue = {};
    } else if (valueType === 'boolean') {
      defaultValue = false;
    } else {
      defaultValue = '';
    }

    const newVariant: Variant = {
      name:
        flagType === 'remoteConfig'
          ? 'config'
          : `variant-${editingVariants.length + 1}`,
      weight: 100, // Remote config variant always gets 100% weight as it's the only one
      weightLock: false,
      stickiness: 'default',
      value: defaultValue,
      valueType: valueType,
    };

    const updatedVariants = distributeWeights([...editingVariants, newVariant]);
    setEditingVariants(updatedVariants);
    setExpanded(true);
  }, [editingVariants, valueType, flagType]);

  const removeVariant = useCallback(
    (index: number) => {
      const remainingVariants = editingVariants.filter((_, i) => i !== index);
      const updatedVariants = distributeWeights(remainingVariants);
      setEditingVariants(updatedVariants);
      setJsonErrors((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    },
    [editingVariants]
  );

  const updateVariant = useCallback(
    (index: number, updates: Partial<Variant>) => {
      const updated = editingVariants.map((v, i) => (i === index ? { ...v, ...updates } : v));
      setEditingVariants(updated);
    },
    [editingVariants]
  );

  const updateVariantWeight = useCallback(
    (index: number, weight: number, locked: boolean) => {
      const currentVariants = [...editingVariants];
      currentVariants[index] = {
        ...currentVariants[index],
        weight: Math.min(100, Math.max(0, weight)),
        weightLock: locked,
      };
      const updatedVariants = distributeWeights(currentVariants);
      setEditingVariants(updatedVariants);
    },
    [editingVariants]
  );

  const toggleWeightLock = useCallback(
    (index: number, locked: boolean) => {
      const currentVariants = [...editingVariants];
      // If locking this variant, unlock all others
      if (locked) {
        currentVariants.forEach((v, i) => {
          if (i !== index) {
            currentVariants[i] = { ...v, weightLock: false };
          }
        });
      }
      currentVariants[index] = {
        ...currentVariants[index],
        weightLock: locked,
      };
      const updatedVariants = distributeWeights(currentVariants);
      setEditingVariants(updatedVariants);
    },
    [editingVariants]
  );

  const handleSaveVariants = useCallback(async () => {
    // Check for JSON validation errors
    const hasErrors = Object.values(jsonErrors).some((e) => e !== null);
    if (hasErrors) {
      return;
    }

    // Check for duplicate names
    const names = editingVariants.map((v) => v.name.trim().toLowerCase());
    const hasDuplicates = names.some((name, i) => names.indexOf(name) !== i);
    if (hasDuplicates) {
      return;
    }

    try {
      isSavingRef.current = true;
      setSaving(true);
      // Preserve expanded state so it remains open after data reload
      preserveExpandedRef.current = true;

      await onSave(editingVariants);
      isSavingRef.current = false;
    } catch (error) {
      isSavingRef.current = false;
      throw error;
    } finally {
      setSaving(false);
    }
  }, [editingVariants, jsonErrors, onSave]);

  const handleResetVariants = useCallback(() => {
    setEditingVariants(initialVariants);
    setJsonErrors({});
  }, [initialVariants]);

  const variantCount = editingVariants.length;
  const hasAnyLockedVariant = editingVariants.some((v) => v.weightLock);

  // Check for duplicate names at component level for save button disabled state
  const variantNames = editingVariants.map((v) => v.name.trim().toLowerCase());
  const hasDuplicateNames = variantNames.some((name, i) => variantNames.indexOf(name) !== i);

  // Check for JSON errors
  const hasJsonErrors = Object.values(jsonErrors).some((e) => e !== null);

  const VARIANT_COLORS = ['#7C4DFF', '#448AFF', '#00BFA5', '#FF6D00', '#FF4081', '#536DFE'];

  const renderValueInputField = (field: 'enabledValue' | 'disabledValue') => {
    const isEditing = useEnvOverride;
    const value = field === 'enabledValue' ? editingEnabledValue : editingDisabledValue;
    const globalValue = field === 'enabledValue' ? enabledValue : disabledValue;
    const error = valueJsonErrors[field];
    const updateValue = (val: any) => {
      if (field === 'enabledValue') setEditingEnabledValue(val);
      else setEditingDisabledValue(val);
    };

    if (valueType === 'boolean') {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 40 }}>
          <BooleanSwitch
            checked={isEditing ? (value === true || value === 'true') : (globalValue === true || globalValue === 'true')}
            onChange={(e) => isEditing && updateValue(e.target.checked)}
            disabled={!isEditing || !canManage || isArchived}
          />
          <Typography variant="body2" sx={{ ml: 1, color: isEditing ? 'text.primary' : 'text.secondary' }}>
            {isEditing ? (value === true || value === 'true' ? 'True' : 'False') : (globalValue === true || globalValue === 'true' ? 'True' : 'False')}
          </Typography>
        </Box>
      );
    }

    if (valueType === 'number') {
      return (
        <TextField
          fullWidth
          size="small"
          type="number"
          value={isEditing ? (value ?? '') : (globalValue ?? '')}
          onChange={(e) => isEditing && updateValue(e.target.value === '' ? 0 : Number(e.target.value))}
          disabled={!isEditing || !canManage || isArchived}
        />
      );
    }

    // JSON and String use ValueEditorField
    return (
      <ValueEditorField
        value={(() => {
          const val = isEditing ? value : globalValue;
          if (valueType === 'json') {
            if (val === null || val === undefined) return '{}';
            if (typeof val === 'object') return JSON.stringify(val, null, 2);
            if (val === '[object Object]') return '{}';
            return String(val);
          }
          return val ?? '';
        })()}
        onChange={(val) => {
          if (!isEditing) return;
          if (valueType === 'json') {
            if (typeof val === 'object' && val !== null) {
              updateValue(val);
              setValueJsonErrors(prev => ({ ...prev, [field]: null }));
            } else {
              try {
                const parsed = JSON.parse(val);
                updateValue(parsed);
                setValueJsonErrors(prev => ({ ...prev, [field]: null }));
              } catch (e: any) {
                updateValue(val);
                setValueJsonErrors(prev => ({ ...prev, [field]: e.message || 'Invalid JSON' }));
              }
            }
          } else {
            updateValue(val);
          }
        }}
        valueType={valueType}
        disabled={!isEditing || !canManage || isArchived}
        label={field === 'enabledValue' ? t('featureFlags.enabledValue') : t('featureFlags.disabledValue')}
        onValidationError={(err) => setValueJsonErrors(prev => ({ ...prev, [field]: err }))}
      />
    );
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      {/* Unified Header for Environment Settings */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: expanded ? 2 : 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle2" fontWeight={600}>
            {flagType === 'remoteConfig'
              ? t('featureFlags.fallbackAndConfiguration')
              : t('featureFlags.envSpecificSettings')}
          </Typography>
          {(hasChanges || valuesHasChanges) && (
            <Chip
              label={t('common.unsavedChanges')}
              size="small"
              color="warning"
              sx={{ fontWeight: 600, height: 20, borderRadius: '12px' }}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      {/* Weight Distribution Bar - hide for remoteConfig */}
      {variantCount > 0 && flagType !== 'remoteConfig' && (
        <Box
          sx={{
            height: 28,
            display: 'flex',
            borderRadius: 1,
            overflow: 'hidden',
            mb: 2,
          }}
        >
          {editingVariants.map((variant, index) => (
            <Tooltip key={index} title={`${variant.name}: ${variant.weight}%`}>
              <Box
                sx={{
                  width: `${variant.weight}%`,
                  bgcolor: VARIANT_COLORS[index % VARIANT_COLORS.length],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  transition: 'width 0.2s ease',
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
          ))}
        </Box>
      )}

      {/* Expanded content */}
      <Collapse in={expanded}>
        <Box sx={{ mb: 3 }}>
          {variantCount === 0 && (
            <Box sx={{ textAlign: 'center', py: 3, border: '1px dashed', borderColor: 'divider', borderRadius: 2, mb: 2, bgcolor: 'action.hover' }}>
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                {flagType === 'remoteConfig' ? t('featureFlags.noRemoteConfigValues') : t('featureFlags.noVariantsConfigured')}
              </Typography>
              {flagType === 'remoteConfig' && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, px: 2 }}>
                  {t('featureFlags.noRemoteConfigValuesGuide')}
                </Typography>
              )}
              {canManage && !isArchived && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={addVariant}
                  sx={{ mt: 1.5 }}
                >
                  {flagType === 'remoteConfig' ? t('featureFlags.setConfiguration') : t('featureFlags.addVariant')}
                </Button>
              )}
            </Box>
          )}

          <Stack spacing={2}>
            {editingVariants.map((variant, index) => {
              const variantColor = VARIANT_COLORS[index % VARIANT_COLORS.length];
              const isCurrentLocked = variant.weightLock;
              const showWeightControls = variantCount > 1;
              const isDuplicateName = editingVariants.some((v, i) => i !== index && v.name.trim().toLowerCase() === variant.name.trim().toLowerCase());

              return (
                <Paper
                  key={index}
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    borderLeft: flagType === 'remoteConfig' ? 1 : 4,
                    borderColor: flagType === 'remoteConfig' ? 'divider' : undefined,
                    borderLeftColor: flagType === 'remoteConfig' ? 'divider' : variantColor,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: variant.name === '$config' || flagType === 'remoteConfig' ? 0 : 1.5 }}>
                    {(variant.name !== '$config' && flagType !== 'remoteConfig') && (
                      <TextField
                        size="small"
                        label={t('featureFlags.variantName')}
                        value={variant.name}
                        onChange={(e) => updateVariant(index, { name: e.target.value })}
                        disabled={!canManage || isArchived}
                        error={isDuplicateName}
                        sx={{ flex: 1 }}
                      />
                    )}
                    {(showWeightControls && flagType !== 'remoteConfig') && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TextField
                          size="small"
                          label={t('featureFlags.weight')}
                          type="number"
                          value={variant.weight}
                          onChange={(e) => updateVariantWeight(index, parseInt(e.target.value) || 0, isCurrentLocked || false)}
                          disabled={!canManage || isArchived}
                          sx={{ width: 90 }}
                          InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                        />
                        <IconButton
                          size="small"
                          onClick={() => toggleWeightLock(index, !isCurrentLocked)}
                          disabled={!canManage || isArchived}
                          sx={{ color: isCurrentLocked ? 'warning.main' : 'action.disabled' }}
                        >
                          {isCurrentLocked ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
                        </IconButton>
                      </Box>
                    )}
                    {canManage && !isArchived && flagType !== 'remoteConfig' && (
                      <IconButton size="small" color="error" onClick={() => removeVariant(index)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    {(valueType === 'string' || valueType === 'json') && (
                      <Box sx={{ mt: 1 }}>
                        {valueType === 'string' && <StringIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
                        {valueType === 'json' && <JsonIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
                      </Box>
                    )}
                    <Box sx={{ flex: 1 }}>
                      {(valueType === 'json' || valueType === 'string') ? (
                        <ValueEditorField
                          value={(() => {
                            const raw = unwrapValue(variant.value);
                            if (valueType === 'json') {
                              if (raw === null || raw === undefined) return '{}';
                              if (typeof raw === 'object') return JSON.stringify(raw, null, 2);
                              if (raw === '[object Object]') return '{}';
                              return String(raw);
                            }
                            // For string type, if value is still an object somehow, stringify it
                            if (typeof raw === 'object' && raw !== null) return JSON.stringify(raw);
                            return raw ?? '';
                          })()}
                          onChange={(val) => {
                            if (valueType === 'json') {
                              // Value can be an object (from dialog) or a string (from inline)
                              if (typeof val === 'object' && val !== null) {
                                updateVariant(index, { value: val });
                                setJsonErrors(prev => ({ ...prev, [index]: null }));
                              } else {
                                try {
                                  const parsed = JSON.parse(val);
                                  updateVariant(index, { value: parsed });
                                  setJsonErrors(prev => ({ ...prev, [index]: null }));
                                } catch (e: any) {
                                  updateVariant(index, { value: val });
                                  setJsonErrors(prev => ({ ...prev, [index]: e.message || 'Invalid JSON' }));
                                }
                              }
                            } else {
                              updateVariant(index, { value: val });
                            }
                          }}
                          valueType={valueType}
                          disabled={!canManage || isArchived}
                          label={flagType === 'remoteConfig' ? t('featureFlags.configuration') : t('featureFlags.variantValue')}
                          onValidationError={(error) => setJsonErrors(prev => ({ ...prev, [index]: error }))}
                        />
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 40 }}>
                          {valueType === 'boolean' ? (
                            <BooleanSwitch
                              checked={unwrapValue(variant.value) === true || unwrapValue(variant.value) === 'true'}
                              onChange={(e) => updateVariant(index, { value: e.target.checked })}
                              disabled={!canManage || isArchived}
                            />
                          ) : (
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              value={unwrapValue(variant.value) ?? ''}
                              onChange={(e) => updateVariant(index, { value: e.target.value === '' ? 0 : Number(e.target.value) })}
                              disabled={!canManage || isArchived}
                            />
                          )}
                        </Box>
                      )}
                    </Box>
                  </Box>
                </Paper>
              );
            })}
          </Stack>

          {canManage && !isArchived && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
              {(flagType !== 'remoteConfig' && variantCount > 0) ? (
                !(valueType === 'boolean' && variantCount >= 2) ? (
                  <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={addVariant}>
                    {t('featureFlags.addVariant')}
                  </Button>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.5, borderRadius: 1, bgcolor: 'info.main', color: 'info.contrastText' }}>
                    <InfoIcon sx={{ fontSize: 16 }} />
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      {t('featureFlags.booleanVariantLimit')}
                    </Typography>
                  </Box>
                )
              ) : <Box />}
              <Box sx={{ display: 'flex', gap: 1 }}>
                {hasChanges && (
                  <Button variant="text" size="small" onClick={handleResetVariants} disabled={saving}>
                    {t('common.reset')}
                  </Button>
                )}
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveVariants}
                  disabled={saving || !hasChanges || hasDuplicateNames || hasJsonErrors}
                >
                  {saving ? t('common.saving') : t('common.save')}
                </Button>
              </Box>
            </Box>
          )}
        </Box>

        {/* Flag Values Section - shown for both types but more critical for 'flag' usage */}
        {onSaveValues && (
          <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <OverrideSwitch
                  checked={useEnvOverride}
                  onChange={(e) => setUseEnvOverride(e.target.checked)}
                  disabled={!canManage || isArchived}
                />
                <Typography variant="subtitle2" fontWeight={600} color={useEnvOverride ? 'primary.main' : 'text.secondary'}>
                  {useEnvOverride ? t('featureFlags.overrideForEnv') : t('featureFlags.usingGlobalDefault')}
                </Typography>
              </Box>
            </Box>

            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: variantCount > 0 ? 'action.hover' : 'transparent',
                  border: '1px solid',
                  borderStyle: variantCount > 0 ? 'dashed' : 'solid',
                  borderColor: variantCount > 0 ? 'warning.light' : 'divider',
                  position: 'relative'
                }}
              >
                <Typography
                  variant="subtitle2"
                  gutterBottom
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    color: variantCount > 0 ? 'text.secondary' : 'text.primary',
                    fontWeight: 600
                  }}
                >
                  {t('featureFlags.enabledValue')}
                </Typography>
                <Box sx={{ opacity: variantCount > 0 ? 0.5 : 1, pointerEvents: variantCount > 0 ? 'none' : 'auto' }}>
                  {renderValueInputField('enabledValue')}
                </Box>
                {variantCount > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mt: 1, color: 'warning.main' }}>
                    <InfoIcon sx={{ fontSize: 16, mt: 0.2 }} />
                    <Typography variant="caption" sx={{ fontWeight: 500, lineHeight: 1.4 }}>
                      {t('featureFlags.enabledValueRedundantHint')}
                    </Typography>
                  </Box>
                )}
              </Box>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'transparent'
                }}
              >
                <Typography
                  variant="subtitle2"
                  gutterBottom
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    fontWeight: 600
                  }}
                >
                  {t('featureFlags.disabledValue')}
                </Typography>
                {renderValueInputField('disabledValue')}
              </Box>
            </Stack>

            {canManage && !isArchived && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
                {valuesHasChanges && (
                  <Button variant="text" size="small" onClick={handleResetValues} disabled={savingValues}>
                    {t('common.reset')}
                  </Button>
                )}
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveValuesClick}
                  disabled={savingValues || !valuesHasChanges || !!valueJsonErrors.enabledValue || !!valueJsonErrors.disabledValue}
                >
                  {savingValues ? t('common.saving') : t('common.save')}
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Collapse>
    </Paper >
  );
};

export default EnvironmentVariantsEditor;
