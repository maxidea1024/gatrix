/**
 * ContextFieldChip - Reusable chip component for displaying context field names
 * Shows field type icon, name, and opens a detail popover on click
 * Unified style across all usages for consistency
 */

import React, { useState } from 'react';
import { Box, Chip, Popover, Typography, IconButton, Tooltip } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import FieldTypeIcon from './FieldTypeIcon';

export interface ContextFieldInfo {
  fieldName: string;
  displayName?: string;
  description?: string;
  fieldType: string;
  validationRules?: {
    enabled?: boolean;
    legalValues?: string[];
    isRequired?: boolean;
    trimWhitespace?: string;
    pattern?: string;
    patternDescription?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    integerOnly?: boolean;
    [key: string]: any;
  };
}

interface ContextFieldChipProps {
  /** Field name to display */
  fieldName: string;
  /** Field info for the detail popover (if not provided, popover won't open) */
  fieldInfo?: ContextFieldInfo;
  /** Custom field type (used when fieldInfo is not available) */
  fieldType?: string;
}

const ContextFieldChip: React.FC<ContextFieldChipProps> = ({ fieldName, fieldInfo, fieldType }) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (fieldInfo) {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const resolvedType = fieldInfo?.fieldType || fieldType;

  const chipLabel = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {resolvedType && (
        <FieldTypeIcon type={resolvedType} sx={{ fontSize: 13, color: 'text.secondary' }} />
      )}
      <span>{fieldName}</span>
    </Box>
  );

  return (
    <>
      <Tooltip
        title={fieldInfo ? t('playground.viewFieldInfo') : ''}
        disableHoverListener={!fieldInfo}
      >
        <Chip
          label={chipLabel}
          size="small"
          variant="outlined"
          onClick={handleClick}
          sx={{
            height: 26,
            fontSize: '0.75rem',
            fontFamily: 'monospace',
            fontWeight: 500,
            cursor: fieldInfo ? 'pointer' : 'default',
            borderColor: 'divider',
            '& .MuiChip-label': {
              px: 0.75,
            },
          }}
        />
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        disableRestoreFocus
        slotProps={{
          paper: {
            elevation: 8,
            sx: { minWidth: 360, maxWidth: 500, borderRadius: 1.5 },
          },
        }}
      >
        {fieldInfo && (
          <Box sx={{ p: 2 }}>
            {/* Header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 1.5,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FieldTypeIcon
                  type={fieldInfo.fieldType}
                  sx={{ fontSize: 18, color: 'primary.main' }}
                />
                <Typography variant="subtitle2" fontWeight={600} sx={{ fontFamily: 'monospace' }}>
                  {fieldInfo.fieldName}
                </Typography>
              </Box>
              <IconButton size="small" onClick={handleClose}>
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>

            {/* Field info table */}
            <Box
              component="table"
              sx={{
                width: '100%',
                borderCollapse: 'collapse',
                tableLayout: 'fixed',
                '& td': {
                  py: 0.4,
                  verticalAlign: 'top',
                  fontSize: '0.8rem',
                  lineHeight: 1.5,
                },
                '& td:first-of-type': {
                  color: 'text.secondary',
                  pr: 2,
                  width: 120,
                  fontSize: '0.75rem',
                },
                '& td:last-of-type': {
                  wordBreak: 'break-word',
                },
              }}
            >
              <tbody>
                {fieldInfo.displayName && fieldInfo.displayName !== fieldInfo.fieldName && (
                  <tr>
                    <td>{t('common.displayName')}</td>
                    <td>{fieldInfo.displayName}</td>
                  </tr>
                )}
                <tr>
                  <td>{t('common.type')}</td>
                  <td>{fieldInfo.fieldType}</td>
                </tr>
                {fieldInfo.description && (
                  <tr>
                    <td>{t('common.description')}</td>
                    <td style={{ whiteSpace: 'pre-wrap' }}>{fieldInfo.description}</td>
                  </tr>
                )}
              </tbody>
            </Box>

            {/* Validation Rules */}
            {fieldInfo.validationRules && (
              <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed', borderColor: 'divider' }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight={600}
                  sx={{ display: 'block', mb: 0.5 }}
                >
                  {t('featureFlags.validation.validationRules')}
                </Typography>
                <Box
                  component="table"
                  sx={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    tableLayout: 'fixed',
                    '& td': {
                      py: 0.25,
                      verticalAlign: 'top',
                      fontSize: '0.75rem',
                      lineHeight: 1.5,
                    },
                    '& td:first-of-type': {
                      color: 'text.secondary',
                      pr: 2,
                      width: 120,
                    },
                    '& td:last-of-type': {
                      wordBreak: 'break-all',
                    },
                  }}
                >
                  <tbody>
                    {fieldInfo.validationRules.isRequired && (
                      <tr>
                        <td>{t('featureFlags.validation.isRequired')}</td>
                        <td>
                          <Typography
                            component="span"
                            variant="caption"
                            color="error.main"
                            fontWeight={600}
                          >
                            {t('common.yes')}
                          </Typography>
                        </td>
                      </tr>
                    )}
                    {fieldInfo.validationRules.legalValues &&
                      fieldInfo.validationRules.legalValues.length > 0 && (
                        <tr>
                          <td>{t('featureFlags.validation.legalValues')}</td>
                          <td>{fieldInfo.validationRules.legalValues.join(', ')}</td>
                        </tr>
                      )}
                    {fieldInfo.validationRules.pattern &&
                      (() => {
                        const desc = fieldInfo.validationRules!.patternDescription;
                        // Try to resolve as preset key (e.g. 'email' -> 'featureFlags.validation.presetEmail')
                        const presetLabelKey = desc
                          ? `featureFlags.validation.preset${desc.charAt(0).toUpperCase()}${desc.slice(1)}`
                          : '';
                        const resolvedLabel = desc ? t(presetLabelKey, { defaultValue: desc }) : '';
                        return (
                          <tr>
                            <td>
                              {resolvedLabel
                                ? `${resolvedLabel} (${t('featureFlags.validation.patternShort')})`
                                : t('featureFlags.validation.patternLabel')}
                            </td>
                            <td>
                              <code style={{ fontSize: '0.7rem' }}>
                                {fieldInfo.validationRules!.pattern}
                              </code>
                            </td>
                          </tr>
                        );
                      })()}
                    {fieldInfo.validationRules.minLength !== undefined && (
                      <tr>
                        <td>{t('featureFlags.validation.minLengthLabel')}</td>
                        <td>{fieldInfo.validationRules.minLength}</td>
                      </tr>
                    )}
                    {fieldInfo.validationRules.maxLength !== undefined && (
                      <tr>
                        <td>{t('featureFlags.validation.maxLengthLabel')}</td>
                        <td>{fieldInfo.validationRules.maxLength}</td>
                      </tr>
                    )}
                    {fieldInfo.validationRules.min !== undefined && (
                      <tr>
                        <td>{t('featureFlags.validation.minValueLabel')}</td>
                        <td>{fieldInfo.validationRules.min}</td>
                      </tr>
                    )}
                    {fieldInfo.validationRules.max !== undefined && (
                      <tr>
                        <td>{t('featureFlags.validation.maxValueLabel')}</td>
                        <td>{fieldInfo.validationRules.max}</td>
                      </tr>
                    )}
                    {fieldInfo.validationRules.integerOnly && (
                      <tr>
                        <td>{t('featureFlags.validation.integerOnlyLabel')}</td>
                        <td>
                          <Typography
                            component="span"
                            variant="caption"
                            color="primary.main"
                            fontWeight={600}
                          >
                            {t('common.yes')}
                          </Typography>
                        </td>
                      </tr>
                    )}
                    {fieldInfo.validationRules.trimWhitespace &&
                      fieldInfo.validationRules.trimWhitespace !== 'none' && (
                        <tr>
                          <td>{t('featureFlags.validation.trimWhitespace')}</td>
                          <td>{fieldInfo.validationRules.trimWhitespace}</td>
                        </tr>
                      )}
                  </tbody>
                </Box>
              </Box>
            )}
          </Box>
        )}
      </Popover>
    </>
  );
};

export default ContextFieldChip;
