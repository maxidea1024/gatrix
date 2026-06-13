import React, { useMemo } from 'react';
import { Box, TextField, Typography, useTheme, alpha } from '@mui/material';
import { Functions as FxIcon } from '@mui/icons-material';

interface FormulaInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Available metric labels (e.g. ['A', 'B', 'C']) */
  availableLabels: string[];
  /** Error message from validation */
  error?: string;
}

/**
 * Validates a formula string.
 * Returns an error message or empty string if valid.
 */
export function validateFormula(
  formula: string,
  availableLabels: string[]
): string {
  if (!formula.trim()) return '';

  // Check balanced parentheses
  let depth = 0;
  for (const ch of formula) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth < 0) return 'Unmatched closing parenthesis';
  }
  if (depth !== 0) return 'Unmatched opening parenthesis';

  // Check for valid tokens: labels, numbers, operators, parentheses, whitespace
  const tokenPattern = /^[\s]*([A-Z]|[0-9]+\.?[0-9]*|[+\-*/()]|[\s])+[\s]*$/;
  if (!tokenPattern.test(formula)) {
    return 'Invalid characters in formula';
  }

  // Check that all letter references exist in availableLabels
  const referencedLabels = formula.match(/[A-Z]/g) || [];
  for (const label of referencedLabels) {
    if (!availableLabels.includes(label)) {
      return `Unknown metric "${label}". Available: ${availableLabels.join(', ')}`;
    }
  }

  return '';
}

const FormulaInput: React.FC<FormulaInputProps> = ({
  value,
  onChange,
  availableLabels,
  error: externalError,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const validationError = useMemo(
    () => externalError || validateFormula(value, availableLabels),
    [value, availableLabels, externalError]
  );

  const hasError = !!validationError && value.trim().length > 0;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <FxIcon sx={{ fontSize: 16, color: '#8b5cf6', opacity: 0.8 }} />
        <Typography
          variant="caption"
          sx={{ fontWeight: 600, color: '#8b5cf6', fontSize: '0.7rem' }}
        >
          Formula
        </Typography>
      </Box>
      <TextField
        size="small"
        fullWidth
        placeholder={`e.g. A / B * 100`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={hasError}
        helperText={hasError ? validationError : undefined}
        InputProps={{
          sx: {
            fontSize: '0.85rem',
            fontWeight: 500,
            height: 36,
            bgcolor: isDark ? 'rgba(139, 92, 246, 0.05)' : 'rgba(139, 92, 246, 0.03)',
            border: `1px solid ${
              hasError
                ? theme.palette.error.main
                : alpha('#8b5cf6', isDark ? 0.2 : 0.15)
            }`,
            borderRadius: 1.5,
            '& fieldset': { border: 'none' },
            '&:hover': {
              borderColor: hasError
                ? theme.palette.error.main
                : alpha('#8b5cf6', 0.4),
            },
            '&.Mui-focused': {
              borderColor: hasError
                ? theme.palette.error.main
                : '#8b5cf6',
            },
          },
        }}
        FormHelperTextProps={{
          sx: { fontSize: '0.65rem', mx: 0.5 },
        }}
      />
      {availableLabels.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.25 }}>
          {availableLabels.map((label) => (
            <Box
              key={label}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 20,
                height: 20,
                borderRadius: '4px',
                fontSize: '0.65rem',
                fontWeight: 800,
                color: '#8b5cf6',
                bgcolor: alpha('#8b5cf6', isDark ? 0.15 : 0.1),
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: alpha('#8b5cf6', 0.25),
                },
              }}
              onClick={() => {
                onChange(value ? `${value} ${label}` : label);
              }}
            >
              {label}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default FormulaInput;
