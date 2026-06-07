/**
 * TokenChip — Individual token rendered as an interactive chip.
 *
 * Each chip is an independent object. Clicking on field/operator/value
 * opens inline editing for that specific part.
 */

import React from 'react';
import { Box, alpha, useTheme } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import type { SearchToken } from './useSearchQueryState';
import { getFieldDef, getOperatorsForField, type Operator } from '../FieldDefinitions';

interface TokenChipProps {
  token: SearchToken;
  isEditing: boolean;
  editingPart: 'field' | 'operator' | 'value' | null;
  isDark: boolean;
  onClickPart: (part: 'field' | 'operator' | 'value') => void;
  onDelete: () => void;
}

export const TokenChip: React.FC<TokenChipProps> = ({
  token,
  isEditing,
  editingPart,
  isDark,
  onClickPart,
  onDelete,
}) => {
  const theme = useTheme();

  if (token.type === 'logic') {
    return (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          px: 0.8,
          py: 0.15,
          borderRadius: '4px',
          fontSize: '0.72rem',
          fontWeight: 700,
          fontFamily: 'monospace',
          backgroundColor: alpha(theme.palette.warning.main, 0.1),
          color: theme.palette.warning.main,
          cursor: 'default',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        {token.raw}
      </Box>
    );
  }

  if (token.type === 'freetext') {
    return (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          px: 0.8,
          py: 0.15,
          borderRadius: '4px',
          fontSize: '0.75rem',
          fontWeight: 500,
          backgroundColor: alpha(theme.palette.text.primary, 0.06),
          color: theme.palette.text.secondary,
          cursor: 'pointer',
          flexShrink: 0,
          '&:hover': {
            backgroundColor: alpha(theme.palette.text.primary, 0.1),
          },
        }}
        onClick={() => onClickPart('value')}
      >
        {token.raw}
        <CloseIcon
          sx={{ fontSize: 12, ml: 0.3, cursor: 'pointer', opacity: 0.5 }}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        />
      </Box>
    );
  }

  // ─── Filter chip ───
  const isNegated = token.negated || token.operator === 'is_not';
  const baseColor = isNegated ? theme.palette.error : theme.palette.primary;
  const isHasFilter = token.field === 'has';

  // Get operator display label
  const operators = token.field ? getOperatorsForField(token.field) : [];
  const opDisplay = operators.find((o) => o.value === token.operator);
  const operatorLabel = opDisplay?.shortLabel || token.operator || ':';

  const partSx = (part: 'field' | 'operator' | 'value') => ({
    cursor: 'pointer',
    borderRadius: '2px',
    px: 0.3,
    transition: 'background-color 0.15s',
    ...(isEditing && editingPart === part
      ? {
          backgroundColor: alpha(baseColor.main, 0.25),
          outline: `1px solid ${alpha(baseColor.main, 0.5)}`,
        }
      : {
          '&:hover': {
            backgroundColor: alpha(baseColor.main, 0.15),
          },
        }),
  });

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0,
        px: 0.5,
        py: 0.15,
        borderRadius: '4px',
        fontSize: '0.75rem',
        fontWeight: 500,
        fontFamily: 'monospace',
        backgroundColor: alpha(
          isHasFilter ? theme.palette.success.main : baseColor.main,
          isDark ? 0.12 : 0.08
        ),
        border: `1px solid ${alpha(
          isHasFilter ? theme.palette.success.main : baseColor.main,
          0.2
        )}`,
        color: isDark
          ? (isHasFilter ? theme.palette.success.light : baseColor.light)
          : (isHasFilter ? theme.palette.success.dark : baseColor.dark),
        flexShrink: 0,
        userSelect: 'none',
        transition: 'all 0.15s',
      }}
    >
      {/* Field */}
      <Box
        component="span"
        onClick={(e: React.MouseEvent) => { e.stopPropagation(); onClickPart('field'); }}
        sx={partSx('field')}
      >
        {token.negated && '!'}
        {token.field}
      </Box>

      {/* Operator */}
      {!isHasFilter && (
        <Box
          component="span"
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); onClickPart('operator'); }}
          sx={{
            ...partSx('operator'),
            opacity: 0.7,
            fontSize: '0.68rem',
            mx: 0.2,
          }}
        >
          {operatorLabel}
        </Box>
      )}

      {/* Value */}
      <Box
        component="span"
        onClick={(e: React.MouseEvent) => { e.stopPropagation(); onClickPart('value'); }}
        sx={{
          ...partSx('value'),
          fontWeight: 600,
        }}
      >
        {token.value}
      </Box>

      {/* Delete */}
      <CloseIcon
        sx={{
          fontSize: 12,
          ml: 0.3,
          cursor: 'pointer',
          opacity: 0.4,
          '&:hover': { opacity: 1 },
          transition: 'opacity 0.15s',
        }}
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
      />
    </Box>
  );
};

export default TokenChip;
