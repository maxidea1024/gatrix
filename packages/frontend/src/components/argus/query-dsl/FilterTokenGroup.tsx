// ============================================================================
// FilterTokenGroup — Renders a single filter as 3 independent inline tokens
// Sentry-style: [field] [operator] [value]  each independently editable
// ============================================================================

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Box, Typography, IconButton, useTheme } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import type { FilterChip } from './useFilterChips';
import type { DomainConfig } from './types';
import { getFieldByKey } from './fields';
import { getOpLabel } from './operator-labels';

// ─── Types ───────────────────────────────────────────────────────────────────

export type TokenPart = 'field' | 'operator' | 'value';

export interface FilterTokenGroupProps {
  chip: FilterChip;
  domain: DomainConfig;
  /** Which part is currently keyboard-selected (highlighted) */
  selectedPart: TokenPart | null;
  /** Which part is currently being inline-edited (value only) */
  editingPart: TokenPart | null;
  /** Current inline editing text for the value cell */
  editingValueText?: string;
  /** Called when a token part is clicked */
  onPartClick: (chipId: string, part: TokenPart, el: HTMLElement) => void;
  onDelete: (chipId: string) => void;
  /** Inline value input callbacks */
  onValueInputChange?: (chipId: string, text: string) => void;
  onValueInputKeyDown?: (chipId: string, e: React.KeyboardEvent) => void;
  onValueInputBlur?: (chipId: string) => void;
}

/** Ref handle to access individual token DOM elements */
export interface FilterTokenGroupHandle {
  getPartEl: (part: TokenPart) => HTMLElement | null;
  focusValueInput: () => void;
  getChipEl: () => HTMLElement | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const FilterTokenGroup = forwardRef<
  FilterTokenGroupHandle,
  FilterTokenGroupProps
>(function FilterTokenGroup(
  {
    chip,
    domain,
    selectedPart,
    editingPart,
    editingValueText,
    onPartClick,
    onDelete,
    onValueInputChange,
    onValueInputKeyDown,
    onValueInputBlur,
  },
  ref
) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const chipContainerRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLElement>(null);
  const operatorRef = useRef<HTMLElement>(null);
  const valueRef = useRef<HTMLElement>(null);
  const valueInputRef = useRef<HTMLInputElement>(null);

  const field = getFieldByKey(chip.field ?? '', domain);
  const fieldType = field?.type ?? 'string';
  const opLabel = getOpLabel(chip.operator ?? '=', fieldType);
  const isHasChip = chip.field === 'has' || chip.field === '!has';

  // IME composition tracking (Korean, Japanese, etc.)
  const [isIME, setIsIME] = useState(false);

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
    focusValueInput: () => {
      valueInputRef.current?.focus();
    },
    getChipEl: () => {
      return chipContainerRef.current;
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
    const isEditing = editingPart === part;
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
      py: 0,
      cursor: 'pointer',
      borderRadius: '4px',
      fontSize: '0.8rem',
      fontWeight: part === 'field' ? 600 : 400,
      border:
        isSelected || isEditing ? selectedBorder : '1px solid transparent',
      backgroundColor: isSelected || isEditing ? selectedBg : 'transparent',
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
        backgroundColor:
          isSelected || isEditing
            ? selectedBg
            : isDark
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(0,0,0,0.06)',
      },
      transition: 'none',
      userSelect: 'none' as const,
      whiteSpace: 'nowrap' as const,
    };
  };

  // ─── Inline value input style ──────────────────────────────────────

  const valueColor = isDark ? '#fbbf24' : '#d97706';
  const inputWidth = Math.max(
    40,
    Math.min(300, (editingValueText?.length ?? 0) * 7.5 + 16)
  );

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <Box
      ref={chipContainerRef}
      data-chip
      data-chip-id={chip.id}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '1px',
        mr: 1,
        my: '1px',
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
        py: 0,
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

      {/* Value token — inline input mode or display mode */}
      {editingPart === 'value' ? (
        <Box
          component="span"
          sx={{
            ...tokenStyle('value'),
            overflow: 'visible',
            cursor: 'text',
          }}
        >
          <input
            ref={valueInputRef}
            autoFocus
            value={editingValueText ?? ''}
            placeholder="..."
            onChange={(e) => onValueInputChange?.(chip.id, e.target.value)}
            onKeyDown={(e) => {
              // Block Enter/Tab during IME composition
              if (isIME && (e.key === 'Enter' || e.key === 'Tab')) {
                e.preventDefault();
                return;
              }
              onValueInputKeyDown?.(chip.id, e);
            }}
            onBlur={() => onValueInputBlur?.(chip.id)}
            onCompositionStart={() => setIsIME(true)}
            onCompositionEnd={() => setIsIME(false)}
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: valueColor,
              fontSize: '0.8rem',
              fontFamily: 'inherit',
              fontWeight: 400,
              padding: 0,
              margin: 0,
              width: `${inputWidth}px`,
              minWidth: '40px',
              maxWidth: '300px',
            }}
          />
        </Box>
      ) : (
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
      )}

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
