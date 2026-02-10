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
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import JsonEditor from '../common/JsonEditor';
import ValueEditorField from '../common/ValueEditorField';

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
  flagUsage?: 'flag' | 'remoteConfig';
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
  flagUsage = 'flag',
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
    } else if (flagUsage === 'remoteConfig' && initialVariants.length > 0) {
      setExpanded(true);
    }
  }, [initialVariantsJson, flagUsage, initialVariants.length]);

  // --- Environment Values State & Logic ---
  const originalUseEnvOverride = useMemo(() => {
    return envEnabledValue !== undefined && envEnabledValue !== null;
  }, [envEnabledValue]);

  const [useEnvOverride, setUseEnvOverride] = useState(originalUseEnvOverride);
  const [editingEnabledValue, setEditingEnabledValue] = useState(envEnabledValue ?? enabledValue);
  const [editingDisabledValue, setEditingDisabledValue] = useState(envDisabledValue ?? disabledValue);
  const [valueJsonErrors, setValueJsonErrors] = useState<{
    enabledValue?: string | null;
    disabledValue?: string | null;
  }>({});

  const [prevOriginalOverride, setPrevOriginalOverride] = useState(originalUseEnvOverride);
  const [prevEnabledValue, setPrevEnabledValue] = useState(envEnabledValue ?? enabledValue);
  const [prevDisabledValue, setPrevDisabledValue] = useState(envDisabledValue ?? disabledValue);

  // Render-time Synchronization
  if (
    !isSavingRef.current &&
    (originalUseEnvOverride !== prevOriginalOverride ||
      (envEnabledValue ?? enabledValue) !== prevEnabledValue ||
      (envDisabledValue ?? disabledValue) !== prevDisabledValue)
  ) {
    setPrevOriginalOverride(originalUseEnvOverride);
    setPrevEnabledValue(envEnabledValue ?? enabledValue);
    setPrevDisabledValue(envDisabledValue ?? disabledValue);
    setUseEnvOverride(originalUseEnvOverride);
    setEditingEnabledValue(envEnabledValue ?? enabledValue);
    setEditingDisabledValue(envDisabledValue ?? disabledValue);
    setValueJsonErrors({});
  }

  const valuesHasChanges = useMemo(() => {
    return useEnvOverride !== originalUseEnvOverride ||
      JSON.stringify(editingEnabledValue) !== JSON.stringify(envEnabledValue ?? enabledValue) ||
      JSON.stringify(editingDisabledValue) !== JSON.stringify(envDisabledValue ?? disabledValue);
  }, [useEnvOverride, editingEnabledValue, editingDisabledValue, originalUseEnvOverride, envEnabledValue, enabledValue, envDisabledValue, disabledValue]);

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
        await onSaveValues(editingEnabledValue, editingDisabledValue, false);
      } else {
        // Clear env-specific, use global
        await onSaveValues(null, null, true);
      }
      isSavingRef.current = false;
    } catch (error) {
      isSavingRef.current = false;
    } finally {
      setSavingValues(false);
    }
  }, [onSaveValues, valueType, useEnvOverride, editingEnabledValue, editingDisabledValue, valueJsonErrors, t]);

  // Handle reset values
  const handleResetValues = useCallback(() => {
    setUseEnvOverride(originalUseEnvOverride);
    setEditingEnabledValue(envEnabledValue ?? enabledValue);
    setEditingDisabledValue(envDisabledValue ?? disabledValue);
    setValueJsonErrors({});
  }, [originalUseEnvOverride, envEnabledValue, enabledValue, envDisabledValue, disabledValue]);

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
        flagUsage === 'remoteConfig' && editingVariants.length === 0
          ? 'default'
          : `variant-${editingVariants.length + 1}`,
      weight: 0,
      weightLock: false,
      stickiness: 'default',
      value: defaultValue,
      valueType: valueType,
    };

    const updatedVariants = distributeWeights([...editingVariants, newVariant]);
    setEditingVariants(updatedVariants);
    setExpanded(true);
  }, [editingVariants, valueType, flagUsage]);

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
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={isEditing ? (value === true || value === 'true') : (globalValue === true || globalValue === 'true')}
              onChange={(e) => isEditing && updateValue(e.target.checked)}
              disabled={!isEditing || !canManage || isArchived}
            />
          }
          label={
            <Typography variant="body2">
              {isEditing ? (value === true || value === 'true' ? 'True' : 'False') : (globalValue === true || globalValue === 'true' ? 'True' : 'False')}
            </Typography>
          }
        />
      );
    }

    if (valueType === 'number') {
      return (
        <TextField
          fullWidth
          size="small"
          type="number"
          value={isEditing ? (value ?? '') : (globalValue ?? '')}
          onChange={(e) => isEditing && updateValue(e.target.value === '' ? undefined : Number(e.target.value))}
          disabled={!isEditing || !canManage || isArchived}
        />
      );
    }

    if (valueType === 'json') {
      return (
        <Box>
          <JsonEditor
            value={(() => {
              const val = isEditing ? value : globalValue;
              if (val === null || val === undefined) return '{}';
              if (typeof val === 'object') return JSON.stringify(val, null, 2);
              return String(val);
            })()}
            onChange={(val) => {
              if (isEditing) {
                try {
                  const parsed = JSON.parse(val);
                  updateValue(parsed);
                  setValueJsonErrors(prev => ({ ...prev, [field]: null }));
                } catch (e: any) {
                  setValueJsonErrors(prev => ({ ...prev, [field]: e.message || 'Invalid JSON' }));
                }
              }
            }}
            onValidation={(isValid, errorMsg) => {
              if (isEditing) {
                setValueJsonErrors(prev => ({ ...prev, [field]: isValid ? null : errorMsg || 'Invalid JSON' }));
              }
            }}
            readOnly={!isEditing || !canManage || isArchived}
            height={120}
          />
          {error && (
            <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
              {error}
            </Typography>
          )}
        </Box>
      );
    }

    return (
      <ValueEditorField
        value={isEditing ? (value ?? '') : (globalValue ?? '')}
        onChange={(val) => isEditing && updateValue(val)}
        valueType="string"
        disabled={!isEditing || !canManage || isArchived}
        label={field === 'enabledValue' ? t('featureFlags.enabledValue') : t('featureFlags.disabledValue')}
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
            {flagUsage === 'remoteConfig'
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
      {variantCount > 0 && flagUsage !== 'remoteConfig' && (
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
        {/* Variants Section - always shown to allow adding variants */}
        {(
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={600}>
                {flagUsage === 'remoteConfig' ? t('featureFlags.configuration') : t('featureFlags.variants')}
              </Typography>
              {variantCount === 0 && canManage && !isArchived && !(valueType === 'boolean' && variantCount >= 2) && (
                <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={addVariant} sx={{ ml: 2 }}>
                  {t('featureFlags.addConfiguration')}
                </Button>
              )}
            </Box>

            {variantCount === 0 && flagUsage !== 'remoteConfig' && (
              <Box sx={{ textAlign: 'center', py: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 1, mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  {t('featureFlags.noVariantsConfigured')}
                </Typography>
                {canManage && !isArchived && !(valueType === 'boolean' && variantCount >= 2) && (
                  <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={addVariant} sx={{ mt: 1 }}>
                    {t('featureFlags.addVariant')}
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
                      borderLeft: 4,
                      borderLeftColor: variantColor,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
                      <TextField
                        size="small"
                        label={t('featureFlags.variantName')}
                        value={variant.name}
                        onChange={(e) => updateVariant(index, { name: e.target.value })}
                        disabled={!canManage || isArchived}
                        error={isDuplicateName}
                        sx={{ flex: 1 }}
                      />
                      {showWeightControls && (
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
                      {canManage && !isArchived && (
                        <IconButton size="small" color="error" onClick={() => removeVariant(index)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <Box sx={{ mt: 1 }}>
                        {valueType === 'boolean' && <CheckCircleIcon sx={{ fontSize: 20, color: 'success.main' }} />}
                        {valueType === 'string' && <StringIcon sx={{ fontSize: 20, color: 'info.main' }} />}
                        {valueType === 'number' && <NumberIcon sx={{ fontSize: 20, color: 'success.main' }} />}
                        {valueType === 'json' && <JsonIcon sx={{ fontSize: 20, color: 'warning.main' }} />}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        {valueType === 'json' ? (
                          <JsonEditor
                            value={typeof variant.value === 'object' ? JSON.stringify(variant.value, null, 2) : variant.value || '{}'}
                            onChange={(val) => {
                              try {
                                const parsed = JSON.parse(val);
                                updateVariant(index, { value: parsed });
                                setJsonErrors(prev => ({ ...prev, [index]: null }));
                              } catch (e: any) {
                                setJsonErrors(prev => ({ ...prev, [index]: e.message || 'Invalid JSON' }));
                              }
                            }}
                            onValidationError={(error) => setJsonErrors(prev => ({ ...prev, [index]: error }))}
                            readOnly={!canManage || isArchived}
                            height={120}
                          />
                        ) : (
                          <TextField
                            fullWidth
                            size="small"
                            type={valueType === 'number' ? 'number' : 'text'}
                            value={variant.value ?? ''}
                            onChange={(e) => updateVariant(index, { value: valueType === 'number' ? Number(e.target.value) : e.target.value })}
                            disabled={!canManage || isArchived}
                          />
                        )}
                        {jsonErrors[index] && (
                          <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                            {jsonErrors[index]}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Paper>
                );
              })}
            </Stack>

            {canManage && !isArchived && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                {!(valueType === 'boolean' && variantCount >= 2) ? (
                  <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={addVariant}>
                    {flagUsage === 'remoteConfig' ? t('featureFlags.addConfiguration') : t('featureFlags.addVariant')}
                  </Button>
                ) : (
                  <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                    {t('featureFlags.booleanVariantLimit')}
                  </Typography>
                )}
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
        )}

        {/* Flag Values Section - shown for both types but more critical for 'flag' usage */}
        {onSaveValues && (
          <Box sx={{ mt: 2, pt: 2, borderTop: variantCount > 0 ? 1 : 0, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  {t('featureFlags.envValues')}
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={useEnvOverride}
                      onChange={(e) => setUseEnvOverride(e.target.checked)}
                      disabled={!canManage || isArchived}
                    />
                  }
                  label={
                    <Typography variant="body2" color="text.secondary">
                      {t('featureFlags.overrideForEnv')}
                    </Typography>
                  }
                  labelPlacement="end"
                />
              </Box>
              {!useEnvOverride && (
                <Typography variant="caption" color="text.secondary">
                  {t('featureFlags.usingGlobalDefault')}
                </Typography>
              )}
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block' }}>
                  {t('featureFlags.enabledValue')}
                </Typography>
                {renderValueInputField('enabledValue')}
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block' }}>
                  {t('featureFlags.disabledValue')}
                </Typography>
                {renderValueInputField('disabledValue')}
              </Grid>
            </Grid>

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
    </Paper>
  );
};

export default EnvironmentVariantsEditor;
