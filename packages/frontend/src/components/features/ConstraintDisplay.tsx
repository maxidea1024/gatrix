/**
 * ConstraintDisplay - Constraint display component with structured layout
 * Reusable component for displaying constraints in a clean, readable format
 */
import React from 'react';
import { Box, Typography, Chip, Paper, Stack, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '../../utils/dateFormat';
import { FlagImage } from '../common/CountrySelect';
import { getCountryByCode } from '../../utils/countries';
import FieldTypeIcon from '../common/FieldTypeIcon';
import OperatorIcon from '../common/OperatorIcon';
import ContextFieldChip from '../common/ContextFieldChip';

export interface ConstraintValue {
  contextName: string;
  operator: string;
  value?: string;
  values?: string[];
  inverted?: boolean;
  caseInsensitive?: boolean;
}

export interface ContextFieldInfo {
  fieldName: string;
  displayName?: string;
  description?: string;
  fieldType?: string;
  validationRules?: Record<string, any>;
}

interface ConstraintDisplayProps {
  constraint: ConstraintValue;
  compact?: boolean;
  contextFields?: ContextFieldInfo[];
  noBorder?: boolean;
}

// Format date using utility function
const formatDateValueDisplay = (value: string): string => {
  if (!value) return value;
  try {
    return formatDateTime(value);
  } catch {
    return value;
  }
};

// Check if operator is date-related
const isDateOperator = (op: string): boolean => {
  return op.startsWith('date_');
};

/**
 * Single constraint display row - structured 3-column layout
 */
export const ConstraintDisplay: React.FC<ConstraintDisplayProps> = ({
  constraint,
  compact = false,
  contextFields = [],
  noBorder = false,
}) => {
  const { t } = useTranslation();
  // Find context field info for tooltip
  const fieldsArray = Array.isArray(contextFields) ? contextFields : [];
  const contextFieldInfo = fieldsArray.find((f) => f.fieldName === constraint.contextName);
  const contextFieldDescription =
    contextFieldInfo?.description || contextFieldInfo?.displayName || '';
  const fieldType = contextFieldInfo?.fieldType || 'string';

  // Get constraint value display (for single values)
  const getSingleValueDisplay = (): string => {
    if (constraint.value !== undefined && constraint.value !== null) {
      if (typeof constraint.value === 'boolean') {
        return constraint.value ? 'true' : 'false';
      }
      const value = String(constraint.value);
      if (value === '') return t('common.emptyString');
      // Format date values
      if (isDateOperator(constraint.operator)) {
        return formatDateValueDisplay(value);
      }
      return value;
    }
    return '-';
  };

  const isMultiValue = constraint.values && constraint.values.length > 0;
  const showCaseSensitivity = constraint.operator?.startsWith('str_');
  const isCountryField = fieldType === 'country';

  if (compact) {
    const displayValue = isMultiValue ? constraint.values!.join(', ') : getSingleValueDisplay();
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <ContextFieldChip
          fieldName={constraint.contextName}
          fieldInfo={contextFieldInfo ? {
            fieldName: contextFieldInfo.fieldName,
            displayName: contextFieldInfo.displayName,
            description: contextFieldInfo.description,
            fieldType: contextFieldInfo.fieldType || 'string',
            validationRules: contextFieldInfo.validationRules,
          } : undefined}
          fieldType={fieldType}
        />
        <OperatorIcon operator={constraint.operator} inverted={constraint.inverted} size={16} />
        <Typography variant="caption" fontWeight={500}>
          {displayValue}
        </Typography>
      </Box>
    );
  }

  // Localized operator text, description and example
  const operatorText = t(`constraints.operators.${constraint.operator}`, constraint.operator);
  const operatorDesc = t(`constraints.operatorDesc.${constraint.operator}`, constraint.operator);
  const operatorExample = t(`constraints.operatorExample.${constraint.operator}`, '');
  const operatorTooltip = (
    <Box sx={{ maxWidth: 340 }}>
      <Box sx={{ fontWeight: 500, fontSize: '0.8rem', mb: operatorExample ? 0.75 : 0 }}>
        {operatorDesc}
      </Box>
      {operatorExample && (
        <Box
          sx={{
            bgcolor: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '4px',
            px: 1,
            py: 0.6,
            fontSize: '0.75rem',
            fontWeight: 500,
            fontFamily: "'Consolas','Monaco','Courier New',monospace",
            lineHeight: 1.5,
            opacity: 0.9,
          }}
        >
          {operatorExample}
        </Box>
      )}
    </Box>
  );

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        px: noBorder ? 0 : 2,
        py: noBorder ? 0 : 1.25,
        border: noBorder ? 0 : '1px solid',
        borderColor: noBorder ? 'transparent' : 'rgba(128,128,128,0.15)',
        borderRadius: noBorder ? 0 : '6px',
        bgcolor: noBorder ? 'transparent' : 'action.hover',
        gap: 0,
      }}
    >
      {/* Column 1: Field name with type icon */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          minWidth: 120,
          maxWidth: 200,
          flexShrink: 0,
          py: 0.25,
        }}
      >
        <ContextFieldChip
          fieldName={constraint.contextName}
          fieldInfo={contextFieldInfo ? {
            fieldName: contextFieldInfo.fieldName,
            displayName: contextFieldInfo.displayName,
            description: contextFieldInfo.description,
            fieldType: contextFieldInfo.fieldType || 'string',
            validationRules: contextFieldInfo.validationRules,
          } : undefined}
          fieldType={fieldType}
        />
      </Box>

      {/* Column 2: Operator area (NOT + unified operator chip) */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          width: 160,
          flexShrink: 0,
          px: 1,
          py: 0.25,
        }}
      >
        {/* NOT chip */}
        {constraint.inverted && (
          <Tooltip title={t('constraints.inverted')}>
            <Chip
              label="NOT"
              size="small"
              sx={{
                height: 22,
                fontSize: '0.65rem',
                fontWeight: 700,
                bgcolor: 'error.main',
                color: 'error.contrastText',
                borderRadius: 1.5,
                '& .MuiChip-label': {
                  px: 0.75,
                },
              }}
            />
          </Tooltip>
        )}

        {/* Unified operator + case sensitivity chip */}
        <Tooltip title={operatorTooltip} arrow>
          <Chip
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <OperatorIcon
                  operator={constraint.operator}
                  inverted={constraint.inverted}
                  size={16}
                  showTooltip={false}
                />
                <span>{operatorText}</span>
                {showCaseSensitivity && (
                  <Box
                    component="span"
                    sx={{
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      bgcolor: 'rgba(128,128,128,0.15)',
                      borderRadius: 0.5,
                      px: 0.5,
                      py: 0.125,
                      lineHeight: 1,
                    }}
                  >
                    {constraint.caseInsensitive ? 'Aa' : 'AA'}
                  </Box>
                )}
              </Box>
            }
            size="small"
            sx={{
              height: 22,
              fontSize: '0.75rem',
              fontWeight: 500,
              bgcolor: (theme) =>
                theme.palette.mode === 'dark'
                  ? 'rgba(129, 140, 248, 0.15)'
                  : 'rgba(79, 70, 229, 0.1)',
              color: 'text.secondary',
              border: 1,
              borderColor: (theme) =>
                theme.palette.mode === 'dark'
                  ? 'rgba(129, 140, 248, 0.25)'
                  : 'rgba(79, 70, 229, 0.2)',
              borderRadius: 1.5,
              cursor: 'help',
              '& .MuiChip-label': {
                px: 1,
              },
            }}
          />
        </Tooltip>
      </Box>

      {/* Column 3: Values */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 0.5,
          alignItems: 'center',
          flex: 1,
          minWidth: 100,
          py: 0.25,
        }}
      >
        {isMultiValue
          ? constraint.values!.map((val, idx) => {
            const countryInfo = isCountryField ? getCountryByCode(val) : null;
            const displayLabel = countryInfo
              ? `${countryInfo.name} (${val.toUpperCase()})`
              : val === ''
                ? t('common.emptyString')
                : val;
            return (
              <Chip
                key={idx}
                icon={isCountryField ? <FlagImage code={val} size={14} /> : undefined}
                label={displayLabel}
                size="small"
                sx={{
                  height: 22,
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  bgcolor: 'action.selected',
                  color: 'text.primary',
                  borderRadius: '4px',
                  ...(val === '' && { fontStyle: 'italic', color: 'text.secondary' }),
                  '& .MuiChip-icon': {
                    ml: 0.5,
                  },
                  '& .MuiChip-label': {
                    px: 1.25,
                  },
                }}
              />
            );
          })
          : (() => {
            const singleVal = getSingleValueDisplay();
            const countryCode = isCountryField ? constraint.value || '' : '';
            const countryInfo = isCountryField ? getCountryByCode(countryCode) : null;
            const displayLabel = countryInfo
              ? `${countryInfo.name} (${countryCode.toUpperCase()})`
              : singleVal;
            return (
              <Chip
                icon={
                  isCountryField && countryCode ? (
                    <FlagImage code={countryCode} size={14} />
                  ) : undefined
                }
                label={displayLabel}
                size="small"
                sx={{
                  height: 22,
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  bgcolor: 'action.selected',
                  color: 'text.primary',
                  borderRadius: '4px',
                  ...(singleVal === t('common.emptyString') && {
                    fontStyle: 'italic',
                    color: 'text.secondary',
                  }),
                  '& .MuiChip-icon': {
                    ml: 0.5,
                  },
                  '& .MuiChip-label': {
                    px: 1.25,
                  },
                }}
              />
            );
          })()}
      </Box>
    </Box>
  );
};

interface ConstraintListProps {
  constraints: ConstraintValue[];
  title?: string;
  contextFields?: ContextFieldInfo[];
}

/**
 * List of constraints with AND separators
 */
export const ConstraintList: React.FC<ConstraintListProps> = ({
  constraints,
  title,
  contextFields = [],
}) => {
  const { t } = useTranslation();

  if (!constraints || constraints.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary" fontStyle="italic">
        {t('featureFlags.noConstraints')}
      </Typography>
    );
  }

  return (
    <Stack spacing={0}>
      {title && (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
          {title}
        </Typography>
      )}
      {constraints.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                ml: 1,
                my: -0.5,
                position: 'relative',
                zIndex: 2,
              }}
            >
              <Chip
                label="AND"
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  bgcolor: 'background.paper',
                  color: 'text.secondary',
                  border: 1,
                  borderColor: 'divider',
                  '& .MuiChip-label': {
                    px: 0.75,
                  },
                }}
              />
            </Box>
          )}
          <ConstraintDisplay constraint={c} contextFields={contextFields} />
        </React.Fragment>
      ))}
    </Stack>
  );
};

interface SegmentPreviewProps {
  segmentName: string;
  displayName?: string;
  constraints: ConstraintValue[];
  onClose?: () => void;
}

/**
 * Segment preview card showing segment name and its constraints
 */
export const SegmentPreview: React.FC<SegmentPreviewProps> = ({
  segmentName,
  displayName,
  constraints,
}) => {
  const { t } = useTranslation();
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        mt: 1,
        bgcolor: 'background.default',
        borderColor: 'primary.light',
        borderWidth: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
          {t('featureFlags.segmentConditions')}
        </Typography>
      </Box>
      <ConstraintList constraints={constraints} />
    </Paper>
  );
};

export default ConstraintDisplay;
