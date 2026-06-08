// ============================================================================
// FilterTokenGroup — Renders a single filter as 3 independent inline tokens
// Sentry-style: [field] [operator] [value]  each independently editable
// ============================================================================

import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Box, Typography, IconButton, useTheme } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import type { FilterChip } from './useFilterChips';
import type { QueryDomain } from './types';
import { getFieldByKey } from './fields';
import { getOpLabel } from './operator-labels';

// ─── Types ───────────────────────────────────────────────────────────────────

export type TokenPart = 'field' | 'operator' | 'value';

export interface FilterTokenGroupProps {
  chip: FilterChip;
  domain: QueryDomain;
  /** Which part is currently keyboard-selected (highlighted) */
  selectedPart: TokenPart | null;
  /** Called when a token part is clicked */
  onPartClick: (chipId: string, part: TokenPart, el: HTMLElement) => void;
  onDelete: (chipId: string) => void;
}

/** Ref handle to access individual token DOM elements */
export interface FilterTokenGroupHandle {
  getPartEl: (part: TokenPart) => HTMLElement | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const FilterTokenGroup = forwardRef<
  FilterTokenGroupHandle,
  FilterTokenGroupProps
>(function FilterTokenGroup(
  { chip, domain, selectedPart, onPartClick, onDelete },
  ref
) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const fieldRef = useRef<HTMLElement>(null);
  const operatorRef = useRef<HTMLElement>(null);
  const valueRef = useRef<HTMLElement>(null);

  const field = getFieldByKey(chip.field ?? '', domain);
  const fieldType = field?.type ?? 'string';
  const opLabel = getOpLabel(chip.operator ?? '=', fieldType);
  const isHasChip = chip.field === 'has' || chip.field === '!has';

  useImperativeHandle(ref, () => ({
    getPartEl: (part: TokenPart) => {
      switch (part) {
        case 'field':
          return fieldRef.current;
        case 'operator':
          return operatorRef.current;
        case 'value':
          return valueRef.current;
        default:
          return null;
      }
    },
  }));

  // ─── Value display ──────────────────────────────────────────────────

  const renderValueText = () => {
    if (!chip.value && !(chip.values && chip.values.length > 0)) {
      return (
        <Typography component="span" sx={{ opacity: 0.4, fontSize: '0.8rem' }}>
          ...
        </Typography>
      );
    }

    // Multi-value: "debug or info" style (Sentry pattern)
    if (chip.values && chip.values.length > 1) {
      const joiner = chip.operator === '!=' ? 'and' : 'or';
      return (
        <>
          {chip.values.map((v, i) => (
            <React.Fragment key={v}>
              <span>{v}</span>
              {i < chip.values!.length - 1 && (
                <Typography
                  component="span"
                  sx={{
                    mx: 0.5,
                    fontSize: '0.7rem',
                    fontWeight: 500,
                    opacity: 0.5,
                    fontStyle: 'italic',
                  }}
                >
                  {joiner}
                </Typography>
              )}
            </React.Fragment>
          ))}
        </>
      );
    }

    return <span>{chip.value}</span>;
  };

  // ─── Styles ─────────────────────────────────────────────────────────

  const selectedBorder = isDark
    ? '1px solid rgba(124,138,255,0.6)'
    : '1px solid rgba(92,107,192,0.5)';
  const selectedBg = isDark
    ? 'rgba(124,138,255,0.12)'
    : 'rgba(92,107,192,0.08)';

  const tokenStyle = (part: TokenPart) => {
    const isSelected = selectedPart === part;
    const isComposing = chip.composingPart !== undefined;

    // Dim incomplete parts during composing
    const isIncomplete =
      isComposing &&
      ((part === 'operator' && chip.composingPart === 'operator') ||
        (part === 'value' &&
          (chip.composingPart === 'operator' ||
            chip.composingPart === 'value')));

    return {
      display: 'inline-flex',
      alignItems: 'center',
      px: 0.5,
      py: 0.25,
      cursor: 'pointer',
      borderRadius: '4px',
      fontSize: '0.8rem',
      fontWeight: part === 'field' ? 600 : 400,
      border: isSelected ? selectedBorder : '1px solid transparent',
      backgroundColor: isSelected
        ? selectedBg
        : 'transparent',
      color: isIncomplete
        ? isDark
          ? 'rgba(255,255,255,0.25)'
          : 'rgba(0,0,0,0.25)'
        : part === 'field'
          ? isDark
            ? '#c4b5fd'
            : '#7c3aed'
          : part === 'operator'
            ? isDark
              ? '#94a3b8'
              : '#64748b'
            : isDark
              ? '#fbbf24'
              : '#d97706',
      '&:hover': {
        backgroundColor: isSelected
          ? selectedBg
          : isDark
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(0,0,0,0.06)',
      },
      transition: 'all 0.15s',
      userSelect: 'none' as const,
      whiteSpace: 'nowrap' as const,
    };
  };

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <Box
      data-chip
      data-chip-id={chip.id}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '1px',
        mr: 1,
        my: 0.25,
        maxWidth: '100%',
        backgroundColor: isDark
          ? 'rgba(255, 255, 255, 0.04)'
          : 'rgba(0, 0, 0, 0.02)',
        border: `1px solid ${
          isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'
        }`,
        borderRadius: '6px',
        pl: 0.5,
        pr: 0.25,
        py: 0.25,
      }}
    >
      {/* Field token */}
      <Box
        ref={fieldRef}
        component="span"
        sx={tokenStyle('field')}
        onClick={(e: React.MouseEvent<HTMLSpanElement>) =>
          onPartClick(chip.id, 'field', e.currentTarget)
        }
      >
        {chip.field === '!has' ? 'not has' : chip.field}
      </Box>

      {/* Operator token — hidden for has/!has */}
      {!isHasChip && (
        <Box
          ref={operatorRef}
          component="span"
          sx={tokenStyle('operator')}
          onClick={(e: React.MouseEvent<HTMLSpanElement>) =>
            onPartClick(chip.id, 'operator', e.currentTarget)
          }
        >
          {opLabel}
        </Box>
      )}

      {/* Value token */}
      <Box
        ref={valueRef}
        component="span"
        sx={{
          ...tokenStyle('value'),
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: 240,
          minWidth: 0,
        }}
        onClick={(e: React.MouseEvent<HTMLSpanElement>) =>
          onPartClick(chip.id, 'value', e.currentTarget)
        }
      >
        {renderValueText()}
      </Box>

      {/* Delete button */}
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(chip.id);
        }}
        sx={{
          p: 0.25,
          ml: 0.25,
          opacity: 0.3,
          '&:hover': { opacity: 1 },
        }}
      >
        <CloseIcon sx={{ fontSize: 12 }} />
      </IconButton>
    </Box>
  );
});
