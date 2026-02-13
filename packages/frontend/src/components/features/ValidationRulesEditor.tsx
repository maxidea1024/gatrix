/**
 * ValidationRulesEditor component
 * Displays and edits per-type validation rules for feature flags.
 * Includes an enable/disable toggle (FormControlLabel with Switch).
 * Returns null for boolean type.
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
    Box,
    Typography,
    TextField,
    Checkbox,
    FormControlLabel,
    Select,
    MenuItem,
    Chip,
    FormControl,
    InputLabel,
    FormHelperText,
    Autocomplete,
    Stack,
    Paper,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { ValidationRules } from '../../services/featureFlagService';
import FeatureSwitch from '../common/FeatureSwitch';

// Predefined regex pattern presets
const PATTERN_PRESETS = [
    {
        key: 'email',
        pattern: '^[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$',
        labelKey: 'featureFlags.validation.presetEmail',
        tooltipKey: 'featureFlags.validation.presetEmailTooltip',
    },
    {
        key: 'domain',
        pattern: '^([a-zA-Z0-9]([a-zA-Z0-9\\-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}$',
        labelKey: 'featureFlags.validation.presetDomain',
        tooltipKey: 'featureFlags.validation.presetDomainTooltip',
    },
    {
        key: 'url',
        pattern: '^https?://[^\\s]+$',
        labelKey: 'featureFlags.validation.presetUrl',
        tooltipKey: 'featureFlags.validation.presetUrlTooltip',
    },
    {
        key: 'ipv4',
        pattern: '^((25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(25[0-5]|2[0-4]\\d|[01]?\\d\\d?)$',
        labelKey: 'featureFlags.validation.presetIpv4',
        tooltipKey: 'featureFlags.validation.presetIpv4Tooltip',
    },
    {
        key: 'ipv6',
        pattern: '^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$',
        labelKey: 'featureFlags.validation.presetIpv6',
        tooltipKey: 'featureFlags.validation.presetIpv6Tooltip',
    },
    {
        key: 'alphanumericId',
        pattern: '^[a-zA-Z0-9_\\-]+$',
        labelKey: 'featureFlags.validation.presetAlphanumericId',
        tooltipKey: 'featureFlags.validation.presetAlphanumericIdTooltip',
    },
    {
        key: 'slug',
        pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
        labelKey: 'featureFlags.validation.presetSlug',
        tooltipKey: 'featureFlags.validation.presetSlugTooltip',
    },
    {
        key: 'semver',
        pattern: '^\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9.]+)?(\\+[a-zA-Z0-9.]+)?$',
        labelKey: 'featureFlags.validation.presetSemver',
        tooltipKey: 'featureFlags.validation.presetSemverTooltip',
    },
    {
        key: 'uuid',
        pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        labelKey: 'featureFlags.validation.presetUuid',
        tooltipKey: 'featureFlags.validation.presetUuidTooltip',
    },
    {
        key: 'hexColor',
        pattern: '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$',
        labelKey: 'featureFlags.validation.presetHexColor',
        tooltipKey: 'featureFlags.validation.presetHexColorTooltip',
    },
    {
        key: 'phone',
        pattern: '^\\+?[0-9\\-\\s()]{7,20}$',
        labelKey: 'featureFlags.validation.presetPhone',
        tooltipKey: 'featureFlags.validation.presetPhoneTooltip',
    },
    {
        key: 'dateIso',
        pattern: '^\\d{4}-\\d{2}-\\d{2}(T\\d{2}:\\d{2}(:\\d{2})?(\\.\\d+)?(Z|[+-]\\d{2}:\\d{2})?)?$',
        labelKey: 'featureFlags.validation.presetDateIso',
        tooltipKey: 'featureFlags.validation.presetDateIsoTooltip',
    },
    {
        key: 'jsonPath',
        pattern: '^\\$(\\.([a-zA-Z_][a-zA-Z0-9_]*|\\*)|(\\[\\d+\\])|(\\[\\*\\]))*$',
        labelKey: 'featureFlags.validation.presetJsonPath',
        tooltipKey: 'featureFlags.validation.presetJsonPathTooltip',
    },
];

interface ValidationRulesEditorProps {
    valueType: 'string' | 'number' | 'boolean' | 'json' | 'semver' | 'date' | 'country' | 'countryCode3' | 'languageCode' | 'localeCode' | 'timezone';
    rules: ValidationRules | undefined;
    onChange: (rules: ValidationRules | undefined) => void;
    disabled?: boolean;
}

const ValidationRulesEditor: React.FC<ValidationRulesEditorProps> = ({
    valueType,
    rules,
    onChange,
    disabled = false,
}) => {
    const { t } = useTranslation();
    const { enqueueSnackbar } = useSnackbar();

    // Enable toggle: rules object exists and has enabled: true
    const isEnabled = !!rules?.enabled;
    const currentRules = useMemo(() => rules || {}, [rules]);

    // Track custom pattern mode
    const [showCustomPattern, setShowCustomPattern] = useState(false);

    // Auto-detect custom pattern mode on mount/rules change
    useEffect(() => {
        if (currentRules.pattern) {
            const matchesPreset = PATTERN_PRESETS.some((p) => p.pattern === currentRules.pattern);
            if (!matchesPreset) {
                setShowCustomPattern(true);
            }
        }
    }, [currentRules.pattern]);

    const handleToggle = useCallback(
        (enabledValue: boolean) => {
            if (enabledValue) {
                // When enabling, preserve existing rules but set enabled: true
                // If rules was undefined, start with { enabled: true }
                onChange({ ...currentRules, enabled: true });
            } else {
                // When disabling, set enabled: false so backend receives and persists the change.
                // Using undefined would cause JSON serialization to omit the field entirely,
                // leaving the old (enabled) value in the database.
                onChange({ enabled: false });
            }
        },
        [currentRules, onChange]
    );

    const handleChange = useCallback(
        (field: keyof ValidationRules, value: any) => {
            const updated = { ...currentRules, [field]: value, enabled: true };
            const cleaned = Object.fromEntries(
                Object.entries(updated).filter(([, v]) => v !== undefined && v !== null && v !== '')
            ) as ValidationRules;
            onChange(Object.keys(cleaned).length > 0 ? cleaned : undefined);
        },
        [currentRules, onChange]
    );

    // Batch update multiple fields at once (avoids stale closure issues)
    const handleBatchUpdate = useCallback(
        (changes: Partial<ValidationRules>) => {
            const updated = { ...currentRules, ...changes };
            const cleaned = Object.fromEntries(
                Object.entries(updated).filter(([, v]) => v !== undefined && v !== null && v !== '')
            ) as ValidationRules;
            onChange(Object.keys(cleaned).length > 0 ? cleaned : {});
        },
        [currentRules, onChange]
    );

    // Batch remove multiple fields at once
    const handleBatchRemove = useCallback(
        (fields: (keyof ValidationRules)[]) => {
            const updated = { ...currentRules };
            fields.forEach((f) => delete updated[f]);
            onChange(Object.keys(updated).length > 0 ? updated : {});
        },
        [currentRules, onChange]
    );

    // Find the matching preset for the current pattern
    const currentPreset = useMemo(() => {
        if (!currentRules.pattern) return null;
        return PATTERN_PRESETS.find((p) => p.pattern === currentRules.pattern) || null;
    }, [currentRules.pattern]);

    // Boolean type doesn't need detailed validation rules as common rules (isRequired) are moved out
    if (valueType === 'boolean') return null;

    return (
        <Stack spacing={1}>
            {/* Enable/Disable Toggle - pill style, right-aligned */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <FeatureSwitch
                    checked={isEnabled}
                    onChange={() => handleToggle(!isEnabled)}
                    size="large"
                    disabled={disabled}
                    label={t('featureFlags.validationRules')}
                />
            </Box>

            {/* Rules editor - only shown when enabled, grouped in a bordered box */}
            {isEnabled && (
                <Paper
                    variant="outlined"
                    sx={{
                        p: 2,
                        borderRadius: 1,
                        borderColor: 'divider',
                    }}
                >
                    <Stack spacing={2}>
                        {/* String-specific rules */}
                        {valueType === 'string' && (
                            <Stack spacing={2}>

                                {/* minLength / maxLength */}
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <TextField
                                        label={t('featureFlags.validation.minLengthLabel')}
                                        type="number"
                                        size="small"
                                        fullWidth
                                        value={currentRules.minLength ?? ''}
                                        onChange={(e) =>
                                            handleChange('minLength', e.target.value ? Number(e.target.value) : undefined)
                                        }
                                        disabled={disabled}
                                        inputProps={{ min: 0 }}
                                    />
                                    <TextField
                                        label={t('featureFlags.validation.maxLengthLabel')}
                                        type="number"
                                        size="small"
                                        fullWidth
                                        value={currentRules.maxLength ?? ''}
                                        onChange={(e) =>
                                            handleChange('maxLength', e.target.value ? Number(e.target.value) : undefined)
                                        }
                                        disabled={disabled}
                                        inputProps={{ min: 0 }}
                                        helperText={t('featureFlags.validation.lengthRangeHelp')}
                                    />
                                </Box>

                                {/* Pattern presets */}
                                <FormControl size="small" fullWidth disabled={disabled}>
                                    <InputLabel>{t('featureFlags.validation.patternLabel')}</InputLabel>
                                    <Select
                                        value={
                                            showCustomPattern && !currentPreset
                                                ? '__custom__'
                                                : currentPreset?.key || ''
                                        }
                                        label={t('featureFlags.validation.patternLabel')}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '') {
                                                // None selected - clear pattern
                                                handleBatchRemove(['pattern', 'patternDescription']);
                                                setShowCustomPattern(false);
                                            } else if (val === '__custom__') {
                                                // Custom selected
                                                handleBatchRemove(['pattern', 'patternDescription']);
                                                setShowCustomPattern(true);
                                            } else {
                                                // Preset selected
                                                const preset = PATTERN_PRESETS.find((p) => p.key === val);
                                                if (preset) {
                                                    handleBatchUpdate({
                                                        pattern: preset.pattern,
                                                        patternDescription: preset.key,
                                                    });
                                                    setShowCustomPattern(false);
                                                }
                                            }
                                        }}
                                        renderValue={(selected) => {
                                            if (selected === '__custom__') return t('featureFlags.validation.presetCustom');
                                            const preset = PATTERN_PRESETS.find((p) => p.key === selected);
                                            return preset ? t(preset.labelKey) : t('featureFlags.validation.patternNone');
                                        }}
                                    >
                                        <MenuItem value="">
                                            <Typography variant="body2" color="text.secondary">
                                                {t('featureFlags.validation.patternNone')}
                                            </Typography>
                                        </MenuItem>
                                        {PATTERN_PRESETS.map((preset) => (
                                            <MenuItem key={preset.key} value={preset.key} sx={{ py: 1 }}>
                                                <Box>
                                                    <Typography variant="body2">
                                                        {t(preset.labelKey)}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                                        {t(preset.tooltipKey)}
                                                    </Typography>
                                                </Box>
                                            </MenuItem>
                                        ))}
                                        <MenuItem value="__custom__" sx={{ py: 1 }}>
                                            <Box>
                                                <Typography variant="body2">
                                                    {t('featureFlags.validation.presetCustom')}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                                    {t('featureFlags.validation.presetCustomTooltip')}
                                                </Typography>
                                            </Box>
                                        </MenuItem>
                                    </Select>
                                    <FormHelperText>{t('featureFlags.validation.patternHelp')}</FormHelperText>
                                </FormControl>

                                {/* Custom pattern input - only visible when Custom is selected */}
                                {showCustomPattern && !currentPreset && (
                                    <Stack spacing={1}>
                                        <TextField
                                            label={t('featureFlags.validation.customPattern')}
                                            size="small"
                                            fullWidth
                                            value={currentRules.pattern ?? ''}
                                            onChange={(e) => handleChange('pattern', e.target.value || undefined)}
                                            disabled={disabled}
                                            placeholder="^[a-z]+$"
                                            helperText={
                                                currentRules.pattern
                                                    ? (() => {
                                                        try {
                                                            new RegExp(currentRules.pattern);
                                                            return undefined;
                                                        } catch {
                                                            return t('featureFlags.validation.invalidPattern');
                                                        }
                                                    })()
                                                    : undefined
                                            }
                                            error={
                                                currentRules.pattern
                                                    ? (() => {
                                                        try {
                                                            new RegExp(currentRules.pattern);
                                                            return false;
                                                        } catch {
                                                            return true;
                                                        }
                                                    })()
                                                    : false
                                            }
                                        />
                                        <TextField
                                            label={t('featureFlags.validation.patternDescription')}
                                            size="small"
                                            fullWidth
                                            value={currentRules.patternDescription ?? ''}
                                            onChange={(e) =>
                                                handleChange('patternDescription', e.target.value || undefined)
                                            }
                                            disabled={disabled}
                                            placeholder={t('featureFlags.validation.patternDescriptionPlaceholder')}
                                        />
                                    </Stack>
                                )}

                                {/* legalValues */}
                                <Autocomplete
                                    multiple
                                    freeSolo
                                    options={[]}
                                    value={currentRules.legalValues || []}
                                    onChange={(_, newValue) => {
                                        // Validate new entries against active rules
                                        const existingValues = currentRules.legalValues || [];
                                        const addedValues = newValue.filter((v) => !existingValues.includes(v));
                                        const invalidValues: string[] = [];
                                        let reason = '';

                                        for (const val of addedValues) {
                                            if (currentRules.minLength !== undefined && val.length < currentRules.minLength) {
                                                invalidValues.push(val);
                                                reason = t('featureFlags.validation.legalValueTooShort', { min: currentRules.minLength });
                                                continue;
                                            }
                                            if (currentRules.maxLength !== undefined && val.length > currentRules.maxLength) {
                                                invalidValues.push(val);
                                                reason = t('featureFlags.validation.legalValueTooLong', { max: currentRules.maxLength });
                                                continue;
                                            }
                                            if (currentRules.pattern) {
                                                try {
                                                    const regex = new RegExp(currentRules.pattern);
                                                    if (!regex.test(val)) {
                                                        invalidValues.push(val);
                                                        // Show preset name instead of regex
                                                        const desc = currentRules.patternDescription;
                                                        const presetKey = desc
                                                            ? `featureFlags.validation.preset${desc.charAt(0).toUpperCase()}${desc.slice(1)}`
                                                            : '';
                                                        const patternName = desc
                                                            ? t(presetKey, { defaultValue: desc })
                                                            : t('featureFlags.validation.patternLabel');
                                                        reason = t('featureFlags.validation.legalValuePatternMismatch', { pattern: patternName });
                                                        continue;
                                                    }
                                                } catch {
                                                    // Invalid regex, skip validation
                                                }
                                            }
                                        }

                                        if (invalidValues.length > 0) {
                                            // Show friendly feedback
                                            enqueueSnackbar(reason, { variant: 'info' });
                                            // Filter out invalid values
                                            const validNewValue = newValue.filter((v) => !invalidValues.includes(v));
                                            handleChange('legalValues', validNewValue.length > 0 ? validNewValue : undefined);
                                            return;
                                        }

                                        handleChange('legalValues', newValue.length > 0 ? newValue : undefined);
                                    }}
                                    disabled={disabled}
                                    renderTags={(value, getTagProps) =>
                                        value.map((option, index) => (
                                            <Chip
                                                variant="outlined"
                                                label={option}
                                                size="small"
                                                {...getTagProps({ index })}
                                                key={option}
                                            />
                                        ))
                                    }
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            size="small"
                                            label={t('featureFlags.validation.legalValues')}
                                            placeholder={t('featureFlags.validation.legalValuesPlaceholder')}
                                            helperText={t('featureFlags.validation.legalValuesHelp')}
                                        />
                                    )}
                                />
                            </Stack>
                        )}

                        {/* Number-specific rules */}
                        {valueType === 'number' && (
                            <Stack spacing={2}>
                                <Box>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={currentRules.integerOnly === true}
                                                onChange={(e) =>
                                                    handleChange('integerOnly', e.target.checked ? true : undefined)
                                                }
                                                size="small"
                                                disabled={disabled}
                                            />
                                        }
                                        label={
                                            <Typography variant="body2">
                                                {t('featureFlags.validation.integerOnlyLabel')}
                                            </Typography>
                                        }
                                    />
                                    <FormHelperText sx={{ ml: 4, mt: -0.5 }}>
                                        {t('featureFlags.validation.integerOnlyHelp')}
                                    </FormHelperText>
                                </Box>

                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <TextField
                                        label={t('featureFlags.validation.minValueLabel')}
                                        type="number"
                                        size="small"
                                        fullWidth
                                        value={currentRules.min ?? ''}
                                        onChange={(e) =>
                                            handleChange('min', e.target.value !== '' ? Number(e.target.value) : undefined)
                                        }
                                        disabled={disabled}
                                    />
                                    <TextField
                                        label={t('featureFlags.validation.maxValueLabel')}
                                        type="number"
                                        size="small"
                                        fullWidth
                                        value={currentRules.max ?? ''}
                                        onChange={(e) =>
                                            handleChange('max', e.target.value !== '' ? Number(e.target.value) : undefined)
                                        }
                                        disabled={disabled}
                                        helperText={t('featureFlags.validation.valueRangeHelp')}
                                    />
                                </Box>

                                {/* legalValues for numbers */}
                                <Autocomplete
                                    multiple
                                    freeSolo
                                    options={[]}
                                    value={currentRules.legalValues || []}
                                    onChange={(_, newValue) =>
                                        handleChange('legalValues', newValue.length > 0 ? newValue : undefined)
                                    }
                                    disabled={disabled}
                                    renderTags={(value, getTagProps) =>
                                        value.map((option, index) => (
                                            <Chip
                                                variant="outlined"
                                                label={option}
                                                size="small"
                                                {...getTagProps({ index })}
                                                key={option}
                                            />
                                        ))
                                    }
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            size="small"
                                            label={t('featureFlags.validation.legalValues')}
                                            placeholder={t('featureFlags.validation.legalValuesPlaceholder')}
                                            helperText={t('featureFlags.validation.legalValuesHelp')}
                                        />
                                    )}
                                />
                            </Stack>
                        )}

                        {/* Semver-specific rules */}
                        {valueType === 'semver' && (
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
                                {t('featureFlags.validation.semverFormatInfo')}
                            </Typography>
                        )}

                        {/* Date-specific rules */}
                        {valueType === 'date' && (
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
                                {t('featureFlags.validation.dateFormatInfo')}
                            </Typography>
                        )}

                        {/* ISO/Timezone format info */}
                        {(['country', 'countryCode3', 'languageCode', 'localeCode', 'timezone'] as string[]).includes(valueType) && (
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
                                {t(`featureFlags.validation.${valueType}FormatInfo`)}
                            </Typography>
                        )}

                        {/* JSON-specific rules */}
                        {valueType === 'json' && (
                            <TextField
                                label={t('featureFlags.validation.jsonSchema')}
                                size="small"
                                fullWidth
                                multiline
                                rows={4}
                                value={currentRules.jsonSchema ?? ''}
                                onChange={(e) =>
                                    handleChange('jsonSchema', e.target.value || undefined)
                                }
                                disabled={disabled}
                                placeholder='{ "type": "object", "required": ["name"], "properties": { "name": { "type": "string" } } }'
                                helperText={
                                    currentRules.jsonSchema
                                        ? (() => {
                                            try {
                                                JSON.parse(currentRules.jsonSchema);
                                                return t('featureFlags.validation.jsonSchemaHelp');
                                            } catch {
                                                return t('featureFlags.validation.invalidJsonSchema');
                                            }
                                        })()
                                        : t('featureFlags.validation.jsonSchemaHelp')
                                }
                                error={
                                    currentRules.jsonSchema
                                        ? (() => {
                                            try {
                                                JSON.parse(currentRules.jsonSchema);
                                                return false;
                                            } catch {
                                                return true;
                                            }
                                        })()
                                        : false
                                }
                            />
                        )}
                    </Stack>
                </Paper>
            )}
        </Stack>
    );
};

export default ValidationRulesEditor;
