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
import { alpha, styled } from '@mui/material/styles';
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
  Checkbox,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  HelpOutline as HelpOutlineIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import JsonEditor from '../common/JsonEditor';
import ValueEditorField from '../common/ValueEditorField';
import BooleanSwitch from '../common/BooleanSwitch';
import EmptyPlaceholder from '../common/EmptyPlaceholder';
import FieldTypeIcon from '../common/FieldTypeIcon';

// Compact override toggle with text inside the track
const OverrideSwitch = styled(Switch)(({ theme }) => ({
  width: 80,
  height: 24,
  padding: 0,
  '& .MuiSwitch-switchBase': {
    padding: 0,
    margin: 2,
    transitionDuration: '200ms',
    '& .MuiSwitch-input': {
      width: 80,
      left: -2,
      top: -2,
      height: 24,
      margin: 0,
    },
    '&.Mui-checked': {
      transform: 'translateX(56px)',
      color: '#fff',
      '& .MuiSwitch-input': {
        left: -58,
      },
      '& + .MuiSwitch-track': {
        backgroundColor: theme.palette.primary.main,
        opacity: 1,
        border: 0,
        '&:before': { opacity: 1 },
        '&:after': { opacity: 0 },
      },
    },
  },
  '& .MuiSwitch-thumb': {
    boxSizing: 'border-box',
    width: 20,
    height: 20,
  },
  '& .MuiSwitch-track': {
    borderRadius: 12,
    backgroundColor: theme.palette.mode === 'dark' ? '#616161' : '#bdbdbd',
    opacity: 1,
    position: 'relative',
    '&:before, &:after': {
      position: 'absolute',
      top: '50%',
      transform: 'translateY(-50%)',
      fontSize: 9,
      fontWeight: 600,
      fontFamily: theme.typography.fontFamily,
      transition: 'opacity 200ms',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
    },
    '&:before': {
      content: 'attr(data-label-on)',
      left: 8,
      color: '#fff',
      opacity: 0,
    },
    '&:after': {
      content: 'attr(data-label-off)',
      right: 8,
      color: '#fff',
      opacity: 1,
    },
  },
}));

export interface Variant {
  name: string;
  weight: number;
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
  overrideEnabledValue?: boolean; // Whether env-specific enabled value is active
  overrideDisabledValue?: boolean; // Whether env-specific disabled value is active
  useFixedWeightVariants?: boolean;
  onUseFixedWeightVariantsChange?: (value: boolean) => void;
  canManage: boolean;
  isArchived?: boolean;
  onSave: (variants: Variant[]) => Promise<void>;
  onSaveValues?: (
    enabledValue: any,
    disabledValue: any,
    overrideEnabledValue: boolean,
    overrideDisabledValue: boolean
  ) => Promise<void>;
  onGoToPayloadTab: () => void;
  defaultExpanded?: boolean;
}

// Helper function to distribute weights equally among variants
const distributeWeights = (variants: Variant[]): Variant[] => {
  if (variants.length === 0) return variants;

  const baseWeight = Math.floor(100 / variants.length);
  const remainder = 100 % variants.length;

  return variants.map((v, i) => ({
    ...v,
    weight: baseWeight + (i < remainder ? 1 : 0),
  }));
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
  overrideEnabledValue: propOverrideEnabledValue = false,
  overrideDisabledValue: propOverrideDisabledValue = false,
  useFixedWeightVariants = false,
  onUseFixedWeightVariantsChange,
  canManage,
  isArchived,
  onSave,
  onSaveValues,
  onGoToPayloadTab,
  defaultExpanded = false,
}) => {
  const { t } = useTranslation();

  // --- Variants State & Logic ---
  const initialVariantsJson = useMemo(() => JSON.stringify(initialVariants), [initialVariants]);

  const [editingVariants, setEditingVariants] = useState<Variant[]>(initialVariants);
  const [prevVariantsJson, setPrevVariantsJson] = useState(initialVariantsJson);

  const [saving, setSaving] = useState(false);
  const [savingValues, setSavingValues] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [jsonErrors, setJsonErrors] = useState<Record<number, string | null>>({});

  // Ref to preserve expanded state
  const preserveExpandedRef = React.useRef(false);
  // Ref to track saving status to prevent state reset during data reload
  const isSavingRef = React.useRef(false);
  // Ref to suppress unsaved changes badge on initial mount
  const [isInitialMount, setIsInitialMount] = useState(true);
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialMount(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Sync state if savingRef is true (meaning we just finished saving)
  useEffect(() => {
    if (!saving && !savingValues) {
      isSavingRef.current = false;
    }
  }, [saving, savingValues]);

  // --- Sync variations when props change ---
  useEffect(() => {
    if (initialVariantsJson !== prevVariantsJson) {
      setPrevVariantsJson(initialVariantsJson);
      setEditingVariants(initialVariants);
    }
  }, [initialVariantsJson, initialVariants, prevVariantsJson]);

  const hasChanges = useMemo(() => {
    return JSON.stringify(editingVariants) !== initialVariantsJson;
  }, [editingVariants, initialVariantsJson]);

  // --- Environment Values State & Logic ---
  // Use the explicit override flags from props
  const originalOverrideEnabled = propOverrideEnabledValue;
  const originalOverrideDisabled = propOverrideDisabledValue;

  // Canonicalize helper for robust comparison and display
  const canonicalize = useCallback(
    (val: any) => {
      // Basic null/undefined handling
      if (val === null || val === undefined) {
        if (valueType === 'json') return '{}';
        if (valueType === 'boolean') return 'false';
        return '';
      }

      // Fix for corrupted "[object Object]" strings
      if (val === '[object Object]') return '{}';

      if (valueType === 'json') {
        try {
          if (typeof val === 'string') {
            if (val.trim() === '') return '{}';
            return JSON.stringify(JSON.parse(val));
          }
          return JSON.stringify(val);
        } catch {
          return typeof val === 'object' ? JSON.stringify(val) : String(val);
        }
      }

      if (valueType === 'boolean') {
        return val === true || val === 'true' ? 'true' : 'false';
      }

      return typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
    },
    [valueType]
  );

  // Helper to prepare value for API
  const toApiValue = useCallback(
    (val: any) => {
      if (valueType === 'json') {
        try {
          if (typeof val === 'string') return JSON.parse(val === '' ? '{}' : val);
          return val ?? {};
        } catch {
          return {};
        }
      }
      return val;
    },
    [valueType]
  );

  // Unified props snapshot for synchronization
  const propsSnapshot = useMemo(
    () =>
      JSON.stringify({
        overrideEnabled: originalOverrideEnabled,
        overrideDisabled: originalOverrideDisabled,
        enabled: canonicalize(originalOverrideEnabled ? envEnabledValue : enabledValue),
        disabled: canonicalize(originalOverrideDisabled ? envDisabledValue : disabledValue),
      }),
    [
      originalOverrideEnabled,
      originalOverrideDisabled,
      envEnabledValue,
      enabledValue,
      envDisabledValue,
      disabledValue,
      canonicalize,
    ]
  );

  const [overrideEnabled, setOverrideEnabled] = useState(originalOverrideEnabled);
  const [overrideDisabled, setOverrideDisabled] = useState(originalOverrideDisabled);
  const [editingEnabledValue, setEditingEnabledValue] = useState(
    originalOverrideEnabled ? (envEnabledValue ?? enabledValue) : enabledValue
  );
  const [editingDisabledValue, setEditingDisabledValue] = useState(
    originalOverrideDisabled ? (envDisabledValue ?? disabledValue) : disabledValue
  );
  const [valueJsonErrors, setValueJsonErrors] = useState<{
    enabledValue?: string | null;
    disabledValue?: string | null;
  }>({});

  const [prevPropsSnapshot, setPrevPropsSnapshot] = useState(propsSnapshot);

  // Synchronize state when external fallback values or override status change
  useEffect(() => {
    // Check if anything fundamentally changed in the props compared to our tracking snapshot
    if (propsSnapshot !== prevPropsSnapshot) {
      setPrevPropsSnapshot(propsSnapshot);

      setOverrideEnabled(originalOverrideEnabled);
      setOverrideDisabled(originalOverrideDisabled);
      setEditingEnabledValue(
        originalOverrideEnabled ? (envEnabledValue ?? enabledValue) : enabledValue
      );
      setEditingDisabledValue(
        originalOverrideDisabled ? (envDisabledValue ?? disabledValue) : disabledValue
      );
      setValueJsonErrors({});
    }
  }, [
    propsSnapshot,
    prevPropsSnapshot,
    originalOverrideEnabled,
    originalOverrideDisabled,
    envEnabledValue,
    enabledValue,
    envDisabledValue,
    disabledValue,
  ]);

  const valuesHasChanges = useMemo(() => {
    // 1. If override toggle state differs from original
    if (overrideEnabled !== originalOverrideEnabled) return true;
    if (overrideDisabled !== originalOverrideDisabled) return true;

    // 2. Check enabled value if overridden
    if (overrideEnabled) {
      const currentE = canonicalize(editingEnabledValue);
      const serverE = canonicalize(envEnabledValue ?? enabledValue);
      if (currentE !== serverE) return true;
    }

    // 3. Check disabled value if overridden
    if (overrideDisabled) {
      const currentD = canonicalize(editingDisabledValue);
      const serverD = canonicalize(envDisabledValue ?? disabledValue);
      if (currentD !== serverD) return true;
    }

    return false;
  }, [
    overrideEnabled,
    overrideDisabled,
    editingEnabledValue,
    editingDisabledValue,
    originalOverrideEnabled,
    originalOverrideDisabled,
    envEnabledValue,
    enabledValue,
    envDisabledValue,
    disabledValue,
    canonicalize,
  ]);

  // Handle save fallback values
  const handleSaveValuesClick = useCallback(async () => {
    if (!onSaveValues) return;

    // Validate JSON if needed
    if (valueType === 'json') {
      if (
        (overrideEnabled && valueJsonErrors.enabledValue) ||
        (overrideDisabled && valueJsonErrors.disabledValue)
      ) {
        return;
      }
    }

    isSavingRef.current = true;
    setSavingValues(true);
    try {
      // Ensure non-null values when override is enabled.
      const ensureNonNull = (val: any) => {
        if (val !== null && val !== undefined) return val;
        switch (valueType) {
          case 'boolean':
            return false;
          case 'number':
            return 0;
          case 'json':
            return {};
          default:
            return '';
        }
      };

      // Send values with per-field override flags
      const sendEnabled = overrideEnabled
        ? ensureNonNull(toApiValue(editingEnabledValue))
        : toApiValue(editingEnabledValue);
      const sendDisabled = overrideDisabled
        ? ensureNonNull(toApiValue(editingDisabledValue))
        : toApiValue(editingDisabledValue);
      await onSaveValues(sendEnabled, sendDisabled, overrideEnabled, overrideDisabled);
    } catch (error) {
      // Error handled by parent or snackbar
      isSavingRef.current = false;
    } finally {
      setSavingValues(false);
      isSavingRef.current = false;
    }
  }, [
    onSaveValues,
    overrideEnabled,
    overrideDisabled,
    editingEnabledValue,
    editingDisabledValue,
    toApiValue,
    valueJsonErrors,
  ]);

  // Handle reset values
  const handleResetValues = useCallback(() => {
    setOverrideEnabled(originalOverrideEnabled);
    setOverrideDisabled(originalOverrideDisabled);
    setEditingEnabledValue(
      originalOverrideEnabled ? (envEnabledValue ?? enabledValue) : enabledValue
    );
    setEditingDisabledValue(
      originalOverrideDisabled ? (envDisabledValue ?? disabledValue) : disabledValue
    );
    setValueJsonErrors({});
  }, [
    originalOverrideEnabled,
    originalOverrideDisabled,
    envEnabledValue,
    enabledValue,
    envDisabledValue,
    disabledValue,
  ]);

  // Unwrap legacy wrapped values like {type: 'string', value: ''} from old clearVariantValues code
  const unwrapValue = useCallback((val: any): any => {
    if (
      val !== null &&
      typeof val === 'object' &&
      'type' in val &&
      'value' in val &&
      Object.keys(val).length === 2
    ) {
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
      name: flagType === 'remoteConfig' ? 'config' : `variant-${editingVariants.length + 1}`,
      weight: 100, // Will be recalculated by distributeWeights
      stickiness: 'default',
      value: defaultValue,
      valueType: valueType,
    };

    const updatedVariants = distributeWeights([...editingVariants, newVariant]);
    setEditingVariants(updatedVariants);
    setExpanded(true);
  }, [editingVariants, valueType, flagType, useFixedWeightVariants]);

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
    [editingVariants, useFixedWeightVariants]
  );

  const updateVariant = useCallback(
    (index: number, updates: Partial<Variant>) => {
      const updated = editingVariants.map((v, i) => (i === index ? { ...v, ...updates } : v));
      setEditingVariants(updated);
    },
    [editingVariants]
  );

  const updateVariantWeight = useCallback(
    (index: number, weight: number) => {
      const clampedWeight = Math.min(100, Math.max(0, weight));
      const currentVariants = [...editingVariants];
      currentVariants[index] = {
        ...currentVariants[index],
        weight: clampedWeight,
      };

      // Redistribute remaining weight among other variants
      const otherCount = currentVariants.length - 1;
      if (otherCount > 0) {
        const remaining = Math.max(0, 100 - clampedWeight);
        const baseWeight = Math.floor(remaining / otherCount);
        const remainder = remaining % otherCount;
        let otherIndex = 0;
        for (let i = 0; i < currentVariants.length; i++) {
          if (i !== index) {
            currentVariants[i] = {
              ...currentVariants[i],
              weight: baseWeight + (otherIndex < remainder ? 1 : 0),
            };
            otherIndex++;
          }
        }
      }

      setEditingVariants(currentVariants);
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
      isSavingRef.current = false;
      setSaving(false);
    }
  }, [editingVariants, jsonErrors, onSave]);

  const handleResetVariants = useCallback(() => {
    setEditingVariants(initialVariants);
    setJsonErrors({});
  }, [initialVariants]);

  const variantCount = editingVariants.length;

  // Check for duplicate names at component level for save button disabled state
  const variantNames = editingVariants.map((v) => v.name.trim().toLowerCase());
  const hasDuplicateNames = variantNames.some((name, i) => variantNames.indexOf(name) !== i);

  // Check for JSON errors
  const hasJsonErrors = Object.values(jsonErrors).some((e) => e !== null);

  const VARIANT_COLORS = ['#7C4DFF', '#448AFF', '#00BFA5', '#FF6D00', '#FF4081', '#536DFE'];

  const renderValueInputField = (field: 'enabledValue' | 'disabledValue') => {
    const isEditing = field === 'enabledValue' ? overrideEnabled : overrideDisabled;
    const isActuallyEditable = isEditing && canManage && !isArchived;

    const value = field === 'enabledValue' ? editingEnabledValue : editingDisabledValue;
    const globalValue = field === 'enabledValue' ? enabledValue : disabledValue;
    const error = valueJsonErrors[field];
    const updateValue = (val: any) => {
      if (field === 'enabledValue') setEditingEnabledValue(val);
      else setEditingDisabledValue(val);
    };

    const viewOnlyStyle = !isActuallyEditable
      ? {
          bgcolor: (theme: any) =>
            theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
          '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
          '&:hover .MuiOutlinedInput-notchedOutline': { border: 'none' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: 'none' },
          borderRadius: 1,
        }
      : {};

    if (valueType === 'boolean') {
      return (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            minHeight: 40,
            px: !isActuallyEditable ? 1 : 0,
            ...viewOnlyStyle,
          }}
        >
          <BooleanSwitch
            checked={
              isEditing
                ? value === true || value === 'true'
                : globalValue === true || globalValue === 'true'
            }
            onChange={(e) => isActuallyEditable && updateValue(e.target.checked)}
            disabled={!isActuallyEditable}
          />
          <Typography
            variant="body2"
            sx={{
              ml: 1,
              color: isActuallyEditable ? 'text.primary' : 'text.secondary',
              fontWeight: !isActuallyEditable ? 500 : 400,
            }}
          >
            {isEditing
              ? value === true || value === 'true'
                ? 'True'
                : 'False'
              : globalValue === true || globalValue === 'true'
                ? 'True'
                : 'False'}
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
          onChange={(e) =>
            isActuallyEditable && updateValue(e.target.value === '' ? 0 : Number(e.target.value))
          }
          disabled={!isActuallyEditable}
          sx={viewOnlyStyle}
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
              setValueJsonErrors((prev) => ({ ...prev, [field]: null }));
            } else {
              try {
                const parsed = JSON.parse(val);
                updateValue(parsed);
                setValueJsonErrors((prev) => ({ ...prev, [field]: null }));
              } catch (e: any) {
                updateValue(val);
                setValueJsonErrors((prev) => ({ ...prev, [field]: e.message || 'Invalid JSON' }));
              }
            }
          } else {
            updateValue(val);
          }
        }}
        valueType={valueType}
        disabled={!isActuallyEditable}
        label={
          field === 'enabledValue'
            ? t('featureFlags.enabledValue')
            : t('featureFlags.disabledValue')
        }
        onValidationError={(err) => setValueJsonErrors((prev) => ({ ...prev, [field]: err }))}
        sx={viewOnlyStyle}
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
              ? t('featureFlags.configurationValue')
              : t('featureFlags.envSpecificSettings')}
          </Typography>
          {!isInitialMount && (hasChanges || valuesHasChanges) && (
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
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      lineHeight: 1.2,
                    }}
                  >
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
        {flagType !== 'remoteConfig' && (
          <Box sx={{ mb: 3 }}>
            {variantCount === 0 && (
              <EmptyPlaceholder
                message={t('featureFlags.noVariantsConfigured')}
                description={t('featureFlags.noVariantsGuide')}
                onAddClick={canManage && !isArchived ? addVariant : undefined}
                addButtonLabel={t('featureFlags.addVariant')}
              />
            )}

            <Stack spacing={1}>
              {editingVariants.map((variant, index) => {
                const variantColor = VARIANT_COLORS[index % VARIANT_COLORS.length];
                const showWeightControls = variantCount > 1;
                const isDuplicateName = editingVariants.some(
                  (v, i) =>
                    i !== index && v.name.trim().toLowerCase() === variant.name.trim().toLowerCase()
                );

                return (
                  <Paper
                    key={index}
                    variant="outlined"
                    sx={{
                      px: 1.5,
                      py: 1,
                      borderRadius: 1.5,
                      borderColor:
                        flagType === 'remoteConfig' ? 'divider' : alpha(variantColor, 0.4),
                      boxShadow:
                        flagType === 'remoteConfig'
                          ? 'none'
                          : `0 0 8px ${alpha(variantColor, 0.25)}, inset 0 0 0 1px ${alpha(variantColor, 0.1)}`,
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      {/* Value type icon */}
                      <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        <FieldTypeIcon type={valueType} size={18} />
                      </Box>

                      {/* Variant name */}
                      {variant.name !== '$config' && flagType !== 'remoteConfig' && (
                        <TextField
                          size="small"
                          placeholder={t('featureFlags.variantName')}
                          value={variant.name}
                          onChange={(e) => updateVariant(index, { name: e.target.value })}
                          disabled={!canManage || isArchived}
                          error={isDuplicateName}
                          sx={{ flex: 1, minWidth: 120 }}
                          InputProps={{ sx: { height: 36 } }}
                        />
                      )}

                      {/* Variant value */}
                      <Box sx={{ flex: 2, minWidth: 150 }}>
                        {valueType === 'json' || valueType === 'string' ? (
                          <ValueEditorField
                            value={(() => {
                              const raw = unwrapValue(variant.value);
                              if (valueType === 'json') {
                                if (raw === null || raw === undefined) return '{}';
                                if (typeof raw === 'object') return JSON.stringify(raw, null, 2);
                                if (raw === '[object Object]') return '{}';
                                return String(raw);
                              }
                              if (typeof raw === 'object' && raw !== null)
                                return JSON.stringify(raw);
                              return raw ?? '';
                            })()}
                            onChange={(val) => {
                              if (valueType === 'json') {
                                if (typeof val === 'object' && val !== null) {
                                  updateVariant(index, { value: val });
                                  setJsonErrors((prev) => ({ ...prev, [index]: null }));
                                } else {
                                  try {
                                    const parsed = JSON.parse(val);
                                    updateVariant(index, { value: parsed });
                                    setJsonErrors((prev) => ({ ...prev, [index]: null }));
                                  } catch (e: any) {
                                    updateVariant(index, { value: val });
                                    setJsonErrors((prev) => ({
                                      ...prev,
                                      [index]: e.message || 'Invalid JSON',
                                    }));
                                  }
                                }
                              } else {
                                updateVariant(index, { value: val });
                              }
                            }}
                            valueType={valueType}
                            disabled={!canManage || isArchived}
                            label={
                              flagType === 'remoteConfig'
                                ? t('featureFlags.configuration')
                                : t('featureFlags.variantValue')
                            }
                            onValidationError={(error) =>
                              setJsonErrors((prev) => ({ ...prev, [index]: error }))
                            }
                          />
                        ) : valueType === 'boolean' ? (
                          <BooleanSwitch
                            checked={
                              unwrapValue(variant.value) === true ||
                              unwrapValue(variant.value) === 'true'
                            }
                            onChange={(e) => updateVariant(index, { value: e.target.checked })}
                            disabled={!canManage || isArchived}
                          />
                        ) : (
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            value={unwrapValue(variant.value) ?? ''}
                            onChange={(e) =>
                              updateVariant(index, {
                                value: e.target.value === '' ? 0 : Number(e.target.value),
                              })
                            }
                            disabled={!canManage || isArchived}
                            InputProps={{ sx: { height: 36 } }}
                          />
                        )}
                      </Box>

                      {/* Weight */}
                      {showWeightControls && flagType !== 'remoteConfig' && (
                        <TextField
                          size="small"
                          type="number"
                          value={variant.weight}
                          onChange={(e) =>
                            updateVariantWeight(index, parseInt(e.target.value) || 0)
                          }
                          disabled={!canManage || isArchived || !useFixedWeightVariants}
                          sx={{ width: 90, flexShrink: 0 }}
                          InputProps={{
                            endAdornment: <InputAdornment position="end">%</InputAdornment>,
                            sx: { height: 36 },
                          }}
                        />
                      )}

                      {/* Delete button */}
                      {canManage && !isArchived && flagType !== 'remoteConfig' && (
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeVariant(index)}
                          sx={{ flexShrink: 0 }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  </Paper>
                );
              })}
            </Stack>

            {/* Fixed weight checkbox - right-aligned below variants */}
            {flagType !== 'remoteConfig' && variantCount > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={useFixedWeightVariants}
                      onChange={(e) => {
                        const newValue = e.target.checked;
                        onUseFixedWeightVariantsChange?.(newValue);
                        if (!newValue) {
                          // When unchecking, redistribute weights equally
                          setEditingVariants(distributeWeights(editingVariants));
                        }
                      }}
                      disabled={!canManage || isArchived}
                    />
                  }
                  label={
                    <Typography variant="body2" color="text.secondary">
                      {t('featureFlags.useFixedWeightVariants')}
                    </Typography>
                  }
                />
              </Box>
            )}

            {canManage && !isArchived && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                {flagType !== 'remoteConfig' && variantCount > 0 ? (
                  !(valueType === 'boolean' && variantCount >= 2) ? (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={addVariant}
                    >
                      {t('featureFlags.addVariant')}
                    </Button>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      {t('featureFlags.booleanVariantLimit')}
                    </Typography>
                  )
                ) : (
                  <Box />
                )}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {hasChanges && (
                    <Button
                      variant="text"
                      size="small"
                      onClick={handleResetVariants}
                      disabled={saving}
                    >
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
        )}

        {/* Flag Values Section */}
        {onSaveValues && (
          <Box
            sx={{
              mt: flagType === 'remoteConfig' ? 0 : 2,
              pt: flagType === 'remoteConfig' ? 0 : 2,
              borderTop: flagType === 'remoteConfig' ? 0 : 1,
              borderColor: 'divider',
            }}
          >
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              {variantCount === 0 && (
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 600,
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                      minWidth: 120,
                    }}
                  >
                    {t('featureFlags.enabledValue')}
                  </Typography>
                  <Box sx={{ flex: 1 }}>{renderValueInputField('enabledValue')}</Box>
                  <OverrideSwitch
                    checked={overrideEnabled}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setOverrideEnabled(next);
                      if (next) {
                        setEditingEnabledValue(envEnabledValue ?? enabledValue);
                      } else {
                        setEditingEnabledValue(enabledValue);
                      }
                    }}
                    disabled={!canManage || isArchived}
                    slotProps={{
                      track: {
                        // @ts-expect-error data attributes are valid HTML but not typed
                        'data-label-on': t('featureFlags.overrideSwitchOn'),
                        'data-label-off': t('featureFlags.overrideSwitchOff'),
                      },
                    }}
                    sx={{ flexShrink: 0 }}
                  />
                </Box>
              )}

              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'transparent' : '#fff'),
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 600,
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    minWidth: 120,
                  }}
                >
                  {t('featureFlags.disabledValue')}
                </Typography>
                <Box sx={{ flex: 1 }}>{renderValueInputField('disabledValue')}</Box>
                <OverrideSwitch
                  checked={overrideDisabled}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setOverrideDisabled(next);
                    if (next) {
                      setEditingDisabledValue(envDisabledValue ?? disabledValue);
                    } else {
                      setEditingDisabledValue(disabledValue);
                    }
                  }}
                  disabled={!canManage || isArchived}
                  slotProps={{
                    track: {
                      // @ts-expect-error data attributes are valid HTML but not typed
                      'data-label-on': t('featureFlags.overrideSwitchOn'),
                      'data-label-off': t('featureFlags.overrideSwitchOff'),
                    },
                  }}
                  sx={{ flexShrink: 0 }}
                />
              </Box>
            </Stack>

            {canManage && !isArchived && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
                {valuesHasChanges && (
                  <Button
                    variant="text"
                    size="small"
                    onClick={handleResetValues}
                    disabled={savingValues}
                  >
                    {t('common.reset')}
                  </Button>
                )}
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveValuesClick}
                  disabled={
                    savingValues ||
                    !valuesHasChanges ||
                    !!valueJsonErrors.enabledValue ||
                    !!valueJsonErrors.disabledValue
                  }
                >
                  {savingValues ? t('common.saving') : t('common.save')}
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Collapse>
    </Paper>
  );
};

export default EnvironmentVariantsEditor;
