/**
 * Environment Variants Editor - Inline variants editing within environment cards
 *
 * Features:
 * - Display variant weight distribution bar
 * - Add, edit, delete variants
 * - Explicit save button for applying changes
 * - Shows guidance to payload tab when variantType is "none"
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
  Checkbox,
  FormControlLabel,
  Alert,
  Slider,
  Collapse,
  Chip,
  Switch,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Block as BlockIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  HelpOutline as HelpOutlineIcon,
  Abc as StringIcon,
  Numbers as NumberIcon,
  DataObject as JsonIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import JsonEditor from '../common/JsonEditor';

export interface Variant {
  name: string;
  weight: number;
  weightLock?: boolean;
  stickiness?: string;
  payload?: {
    type: 'string' | 'json' | 'csv';
    value: string;
  };
}

interface EnvironmentVariantsEditorProps {
  environment: string;
  variants: Variant[];
  variantType: 'none' | 'string' | 'json' | 'number';
  flagUsage?: 'flag' | 'remoteConfig';
  baselinePayload?: any; // Global fallback value
  envFallbackValue?: any; // Environment-specific fallback value (null means use global)
  canManage: boolean;
  isArchived?: boolean;
  onSave: (variants: Variant[]) => Promise<void>;
  onSaveFallbackValue?: (value: any, useGlobal: boolean) => Promise<void>;
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
  variantType,
  flagUsage = 'flag',
  baselinePayload,
  envFallbackValue,
  canManage,
  isArchived,
  onSave,
  onSaveFallbackValue,
  onGoToPayloadTab,
}) => {
  const { t } = useTranslation();
  const [editingVariants, setEditingVariants] = useState<Variant[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [jsonErrors, setJsonErrors] = useState<Record<number, string | null>>({});

  // Fallback Value state
  const [useEnvOverride, setUseEnvOverride] = useState(false);
  const [editingFallback, setEditingFallback] = useState<string>('');
  const [fallbackHasChanges, setFallbackHasChanges] = useState(false);
  const [savingFallback, setSavingFallback] = useState(false);
  const [fallbackJsonError, setFallbackJsonError] = useState<string | null>(null);

  // Ref to preserve expanded state across data reloads
  const preserveExpandedRef = React.useRef(false);

  // Stabilize initialVariants reference to prevent infinite loop
  const initialVariantsJson = JSON.stringify(initialVariants);
  const prevInitialVariantsJsonRef = React.useRef<string>('');

  // Initialize editing variants from props - only when initialVariants actually changes (by value)
  useEffect(() => {
    if (initialVariantsJson !== prevInitialVariantsJsonRef.current) {
      prevInitialVariantsJsonRef.current = initialVariantsJson;
      setEditingVariants(initialVariants);
      setHasChanges(false);
      // Restore expanded state if it was preserved
      if (preserveExpandedRef.current) {
        setExpanded(true);
        preserveExpandedRef.current = false;
      } else if (flagUsage === 'remoteConfig' && initialVariants.length > 0) {
        // Auto expand for remote config if it has values
        setExpanded(true);
      }
    }
  }, [initialVariantsJson, initialVariants, flagUsage]);

  // Check for changes - use useMemo instead of useEffect to avoid render loop
  const computedHasChanges = useMemo(() => {
    return JSON.stringify(editingVariants) !== initialVariantsJson;
  }, [editingVariants, initialVariantsJson]);

  // Sync hasChanges state only when computedHasChanges changes
  useEffect(() => {
    setHasChanges(computedHasChanges);
  }, [computedHasChanges]);

  // Initialize fallback value from props
  useEffect(() => {
    const hasEnvOverride = envFallbackValue !== undefined && envFallbackValue !== null;
    setUseEnvOverride(hasEnvOverride);

    // Set initial editing value
    const initialValue = hasEnvOverride ? envFallbackValue : baselinePayload;
    if (variantType === 'json') {
      setEditingFallback(
        typeof initialValue === 'string' ? initialValue : JSON.stringify(initialValue ?? {}, null, 2)
      );
    } else {
      setEditingFallback(String(initialValue ?? ''));
    }
    setFallbackHasChanges(false);
    setFallbackJsonError(null);
  }, [envFallbackValue, baselinePayload, variantType]);

  // Check fallback changes
  const originalFallbackValue = useMemo(() => {
    const hasEnvOverride = envFallbackValue !== undefined && envFallbackValue !== null;
    const value = hasEnvOverride ? envFallbackValue : baselinePayload;
    if (variantType === 'json') {
      return typeof value === 'string' ? value : JSON.stringify(value ?? {}, null, 2);
    }
    return String(value ?? '');
  }, [envFallbackValue, baselinePayload, variantType]);

  const originalUseEnvOverride = useMemo(() => {
    return envFallbackValue !== undefined && envFallbackValue !== null;
  }, [envFallbackValue]);

  useEffect(() => {
    const valueChanged = editingFallback !== originalFallbackValue;
    const overrideChanged = useEnvOverride !== originalUseEnvOverride;
    setFallbackHasChanges(valueChanged || overrideChanged);
  }, [editingFallback, originalFallbackValue, useEnvOverride, originalUseEnvOverride]);

  // Handle save fallback value
  const handleSaveFallback = useCallback(async () => {
    if (!onSaveFallbackValue) return;

    // Validate JSON if needed
    if (variantType === 'json' && useEnvOverride) {
      try {
        JSON.parse(editingFallback);
      } catch (e) {
        setFallbackJsonError(t('featureFlags.errors.invalidJson'));
        return;
      }
    }

    setSavingFallback(true);
    try {
      if (useEnvOverride) {
        // Save env-specific value
        const valueToSave = variantType === 'json' ? editingFallback : editingFallback;
        await onSaveFallbackValue(valueToSave, false);
      } else {
        // Clear env-specific, use global
        await onSaveFallbackValue(null, true);
      }
      setFallbackHasChanges(false);
    } catch (error) {
      // Error handling done by parent
    } finally {
      setSavingFallback(false);
    }
  }, [onSaveFallbackValue, variantType, useEnvOverride, editingFallback, t]);

  // Handle reset fallback value
  const handleResetFallback = useCallback(() => {
    setUseEnvOverride(originalUseEnvOverride);
    setEditingFallback(originalFallbackValue);
    setFallbackJsonError(null);
  }, [originalUseEnvOverride, originalFallbackValue]);

  const addVariant = useCallback(() => {
    const lastVariant = editingVariants[editingVariants.length - 1];
    let defaultPayload: { type: 'string' | 'json' | 'csv'; value: string } | undefined;

    if (lastVariant?.payload?.value !== undefined) {
      defaultPayload = {
        type: lastVariant.payload.type || 'string',
        value: String(lastVariant.payload.value),
      };
    } else if (variantType === 'number') {
      defaultPayload = { type: 'string', value: '0' };
    } else if (variantType === 'json') {
      defaultPayload = { type: 'json', value: '{}' };
    } else {
      defaultPayload = { type: 'string', value: '' };
    }

    const newVariant: Variant = {
      name:
        flagUsage === 'remoteConfig' && editingVariants.length === 0
          ? 'default'
          : `variant-${editingVariants.length + 1}`,
      weight: 0,
      weightLock: false,
      stickiness: 'default',
      payload: defaultPayload,
    };

    const updatedVariants = distributeWeights([...editingVariants, newVariant]);
    setEditingVariants(updatedVariants);
    setExpanded(true);
  }, [editingVariants, variantType, flagUsage]);

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

  const handleSave = useCallback(async () => {
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
      setSaving(true);
      // Preserve expanded state so it remains open after data reload
      preserveExpandedRef.current = true;
      await onSave(editingVariants);
    } finally {
      setSaving(false);
    }
  }, [editingVariants, jsonErrors, onSave]);

  const handleReset = useCallback(() => {
    setEditingVariants(initialVariants);
    setJsonErrors({});
  }, [initialVariants]);

  // If variantType is "none", show guidance
  if (variantType === 'none') {
    return (
      <Box
        sx={{
          py: 4,
          px: 3,
          mt: 2,
          textAlign: 'center',
          border: '2px dashed',
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'action.hover',
        }}
      >
        <Typography
          variant="body1"
          fontWeight="medium"
          color="text.secondary"
          sx={{ mb: 1 }}
        >
          {t('featureFlags.variantTypeNoneTitle')}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2 }}
        >
          {t('featureFlags.variantTypeNoneCannotAddVariantsText')}
        </Typography>
        <Button
          variant="contained"
          size="small"
          onClick={onGoToPayloadTab}
        >
          {t('featureFlags.goToPayloadTab')}
        </Button>
      </Box>
    );
  }

  const variantCount = editingVariants.length;
  const hasAnyLockedVariant = editingVariants.some((v) => v.weightLock);

  // Check for duplicate names at component level for save button disabled state
  const variantNames = editingVariants.map((v) => v.name.trim().toLowerCase());
  const hasDuplicateNames = variantNames.some((name, i) => variantNames.indexOf(name) !== i);

  // Check for JSON errors
  const hasJsonErrors = Object.values(jsonErrors).some((e) => e !== null);

  const VARIANT_COLORS = ['#7C4DFF', '#448AFF', '#00BFA5', '#FF6D00', '#FF4081', '#536DFE'];

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      {/* Fallback Value Section */}
      {onSaveFallbackValue && variantType !== 'none' && (
        <Box sx={{ mb: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 1.5,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2" fontWeight={600}>
                {t('featureFlags.fallbackValue')}
              </Typography>
              <Tooltip title={t('featureFlags.fallbackValueDesc')}>
                <HelpOutlineIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              </Tooltip>
              {fallbackHasChanges && (
                <Chip
                  label={t('common.unsavedChanges')}
                  size="small"
                  color="warning"
                  sx={{ fontWeight: 600, height: 20, borderRadius: '12px' }}
                />
              )}
            </Box>
          </Box>

          {/* Override Toggle - Right aligned */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
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
              labelPlacement="start"
            />
          </Box>

          {/* Input Field - Same editor for both states, with type icon on left */}
          <Box sx={{ mb: 1.5 }}>
            {!useEnvOverride && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                {t('featureFlags.usingGlobalDefault')}
              </Typography>
            )}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              {/* Type Icon with Tooltip */}
              <Box sx={{ mt: variantType === 'json' ? 1 : 0.75, display: 'flex', alignItems: 'center' }}>
                <Tooltip title={variantType === 'json' ? 'JSON' : variantType === 'number' ? 'Number' : 'String'}>
                  {variantType === 'json' ? (
                    <JsonIcon sx={{ fontSize: 20, color: 'secondary.main' }} />
                  ) : variantType === 'number' ? (
                    <NumberIcon sx={{ fontSize: 20, color: 'info.main' }} />
                  ) : (
                    <StringIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                  )}
                </Tooltip>
              </Box>
              {/* Editor */}
              <Box sx={{ flex: 1 }}>
                {variantType === 'json' ? (
                  <JsonEditor
                    value={useEnvOverride ? editingFallback : (typeof baselinePayload === 'string' ? baselinePayload : JSON.stringify(baselinePayload ?? {}, null, 2))}
                    onChange={(val) => {
                      if (useEnvOverride) {
                        setEditingFallback(val);
                        setFallbackJsonError(null);
                      }
                    }}
                    onValidationError={(error) => useEnvOverride && setFallbackJsonError(error)}
                    readOnly={!useEnvOverride || !canManage || isArchived}
                    height={120}
                  />
                ) : (
                  <TextField
                    fullWidth
                    size="small"
                    type={variantType === 'number' ? 'number' : 'text'}
                    value={useEnvOverride ? editingFallback : String(baselinePayload ?? '')}
                    onChange={(e) => useEnvOverride && setEditingFallback(e.target.value)}
                    disabled={!useEnvOverride || !canManage || isArchived}
                    placeholder={t('featureFlags.fallbackValuePlaceholder')}
                  />
                )}
                {fallbackJsonError && (
                  <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                    {fallbackJsonError}
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>

          {/* Actions */}
          {canManage && !isArchived && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              {fallbackHasChanges && (
                <Button
                  variant="text"
                  size="small"
                  onClick={handleResetFallback}
                  disabled={savingFallback}
                >
                  {t('common.reset')}
                </Button>
              )}
              <Button
                variant="contained"
                size="small"
                startIcon={<SaveIcon />}
                onClick={handleSaveFallback}
                disabled={savingFallback || !fallbackHasChanges || !!fallbackJsonError}
              >
                {savingFallback ? t('common.saving') : t('common.save')}
              </Button>
            </Box>
          )}

          <Divider sx={{ mt: 2 }} />
        </Box>
      )}

      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: variantCount > 0 ? 2 : 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle2" fontWeight={600}>
            {flagUsage === 'remoteConfig'
              ? t('featureFlags.configuration')
              : t('featureFlags.variants')}
          </Typography>
          {variantCount > 0 && flagUsage !== 'remoteConfig' && (
            <Typography variant="caption" color="text.secondary">
              ({variantCount})
            </Typography>
          )}
          {hasChanges && (
            <Chip
              label={t('common.unsavedChanges')}
              size="small"
              color="warning"
              sx={{ fontWeight: 600, height: 20, borderRadius: '12px' }}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {variantCount > 0 && (
            <IconButton size="small" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          )}
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
                  minWidth: variant.weight > 10 ? 'auto' : 0,
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)',
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

      {/* No variants message */}
      {variantCount === 0 && (
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {flagUsage === 'remoteConfig'
              ? t('featureFlags.noRemoteConfigValues')
              : t('featureFlags.noVariantsGuide')}
          </Typography>
          {canManage && !isArchived && (
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={addVariant}
            >
              {flagUsage === 'remoteConfig'
                ? t('featureFlags.addConfiguration')
                : t('featureFlags.addVariant')}
            </Button>
          )}
        </Box>
      )}

      {/* Expanded variant editing */}
      <Collapse in={expanded && variantCount > 0}>
        <Stack spacing={2}>
          {editingVariants.map((variant, index) => {
            const variantColor = VARIANT_COLORS[index % VARIANT_COLORS.length];
            const isCurrentLocked = variant.weightLock;
            const showWeightControls = variantCount > 1;
            const showFixedCheckbox =
              showWeightControls && (!hasAnyLockedVariant || isCurrentLocked);
            const hasJsonError = jsonErrors[index] !== undefined && jsonErrors[index] !== null;
            // Check for duplicate name
            const isDuplicateName = editingVariants.some(
              (v, i) => i !== index && v.name.trim().toLowerCase() === variant.name.trim().toLowerCase()
            );

            return (
              <Paper
                key={index}
                variant={flagUsage === 'remoteConfig' ? undefined : 'outlined'}
                elevation={0}
                sx={{
                  p: flagUsage === 'remoteConfig' ? 0 : 2,
                  borderRadius: flagUsage === 'remoteConfig' ? 0 : 2,
                  borderLeft: flagUsage === 'remoteConfig' ? 0 : 4,
                  borderLeftColor: flagUsage === 'remoteConfig' ? 'transparent' : variantColor,
                  backgroundColor: 'transparent',
                  border: flagUsage === 'remoteConfig' ? 'none' : undefined,
                }}
              >
                {flagUsage !== 'remoteConfig' && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      mb: 2,
                    }}
                  >
                    {/* Variant Name */}
                    <TextField
                      size="small"
                      label={t('featureFlags.variantName')}
                      value={variant.name}
                      onChange={(e) => updateVariant(index, { name: e.target.value })}
                      disabled={!canManage || isArchived}
                      error={isDuplicateName}
                      helperText={
                        isDuplicateName ? t('featureFlags.duplicateVariantName') : undefined
                      }
                      sx={{ flex: 1, mr: 2 }}
                    />

                    {/* Delete button - hidden for remoteConfig since it has exactly 1 variant */}
                    {canManage && !isArchived && (
                      <IconButton size="small" color="error" onClick={() => removeVariant(index)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                )}

                {/* Weight controls */}
                {showWeightControls && (
                  <Box sx={{ mb: 2 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mb: 1,
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        {t('featureFlags.weight')}:
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {variant.weight}%
                      </Typography>
                      {isCurrentLocked && (
                        <Tooltip title={t('featureFlags.weightLocked')}>
                          <LockIcon fontSize="small" sx={{ color: 'warning.main' }} />
                        </Tooltip>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Slider
                        value={variant.weight}
                        onChange={(_, value) =>
                          updateVariantWeight(index, value as number, variant.weightLock || false)
                        }
                        disabled={!canManage || isArchived}
                        min={0}
                        max={100}
                        sx={{ flex: 1 }}
                      />
                      {showFixedCheckbox && (
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              checked={isCurrentLocked}
                              onChange={(e) => toggleWeightLock(index, e.target.checked)}
                              disabled={!canManage || isArchived}
                              icon={<LockOpenIcon fontSize="small" />}
                              checkedIcon={<LockIcon fontSize="small" />}
                            />
                          }
                          label={
                            <Typography variant="caption">
                              {t('featureFlags.fixedWeight')}
                            </Typography>
                          }
                        />
                      )}
                    </Box>
                  </Box>
                )}

                {/* Payload */}
                <Box>
                  {flagUsage !== 'remoteConfig' && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        {t('featureFlags.payload')}
                      </Typography>
                      {variantType === 'none' ? (
                        <BlockIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                      ) : variantType === 'json' ? (
                        <JsonIcon sx={{ fontSize: 16, color: 'secondary.main' }} />
                      ) : variantType === 'number' ? (
                        <NumberIcon sx={{ fontSize: 16, color: 'info.main' }} />
                      ) : (
                        <StringIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      )}
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    {flagUsage === 'remoteConfig' && (
                      <Box sx={{ mt: 1, display: 'flex', alignItems: 'center' }}>
                        {variantType === 'none' ? (
                          <BlockIcon sx={{ fontSize: 20, color: 'text.disabled' }} />
                        ) : variantType === 'json' ? (
                          <JsonIcon sx={{ fontSize: 20, color: 'secondary.main' }} />
                        ) : variantType === 'number' ? (
                          <NumberIcon sx={{ fontSize: 20, color: 'info.main' }} />
                        ) : (
                          <StringIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                        )}
                      </Box>
                    )}
                    <Box sx={{ flex: 1 }}>
                      {variantType === 'json' ? (
                        <JsonEditor
                          value={variant.payload?.value || '{}'}
                          onChange={(val) =>
                            updateVariant(index, {
                              payload: {
                                type: 'json',
                                value: val,
                              },
                            })
                          }
                          onValidationError={(error) =>
                            setJsonErrors((prev) => ({ ...prev, [index]: error }))
                          }
                          readOnly={!canManage || isArchived}
                          height={120}
                        />
                      ) : (
                        <TextField
                          fullWidth
                          size="small"
                          type={variantType === 'number' ? 'number' : 'text'}
                          value={variant.payload?.value || ''}
                          onChange={(e) =>
                            updateVariant(index, {
                              payload: {
                                type: 'string',
                                value: e.target.value,
                              },
                            })
                          }
                          disabled={!canManage || isArchived}
                        />
                      )}
                      <Box sx={{ mt: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', minHeight: '20px' }}>
                        {hasJsonError ? (
                          <Typography variant="caption" color="error" sx={{ display: 'block' }}>
                            {jsonErrors[index]}
                          </Typography>
                        ) : (
                          (variantType === 'string' || variantType === 'json') &&
                          (variant.payload?.value || '').length > 0 && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ ml: 'auto', display: 'block' }}
                            >
                              {t('featureFlags.payloadSize', {
                                size: new TextEncoder().encode(variant.payload?.value || '').length,
                              })}
                            </Typography>
                          )
                        )}
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Paper>
            );
          })}
        </Stack>
      </Collapse>

      {/* Actions - only show when expanded */}
      {canManage && !isArchived && variantCount > 0 && expanded && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mt: 2,
            pt: 2,
            borderTop: flagUsage === 'remoteConfig' ? 0 : 1,
            borderColor: 'divider',
          }}
        >
          {flagUsage !== 'remoteConfig' && (
            <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={addVariant}>
              {t('featureFlags.addVariant')}
            </Button>
          )}
          {flagUsage === 'remoteConfig' && <Box />}
          <Box sx={{ display: 'flex', gap: 1 }}>
            {hasChanges && (
              <Button variant="text" size="small" onClick={handleReset} disabled={saving}>
                {t('common.reset')}
              </Button>
            )}
            <Button
              variant="contained"
              size="small"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving || !hasChanges || hasDuplicateNames || hasJsonErrors}
            >
              {saving
                ? t('common.saving')
                : flagUsage === 'remoteConfig'
                  ? t('featureFlags.saveConfiguration')
                  : t('featureFlags.saveVariants')}
            </Button>
          </Box>
        </Box>
      )}
    </Paper>
  );
};

export default EnvironmentVariantsEditor;
