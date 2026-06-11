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
import { Box, Typography, IconButton, Tooltip, useTheme } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';

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
  /** Currently selected values for pill tag display during inline editing */
  selectedValues?: Set<string>;
  /** Called when a value pill tag is removed */
  onValueTagRemove?: (chipId: string, value: string) => void;
  /** Index of the pill tag currently highlighted via keyboard (-1 = none) */
  highlightedPillIdx?: number;
  /** Called when ArrowLeft/Right changes the highlighted pill index */
  onPillNavigate?: (chipId: string, newIdx: number) => void;
  /** Called when Backspace/Delete pressed on a highlighted pill */
  onPillDelete?: (chipId: string, pillIdx: number) => void;
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
    selectedValues,
    onValueTagRemove,
    highlightedPillIdx = -1,
    onPillNavigate,
    onPillDelete,
  },
  ref
) {
  const theme = useTheme();
  const { t } = useTranslation();
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

    // Multi-value: show first value + count badge
    if (chip.values && chip.values.length > 1) {
      return (
        <>
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            {chip.values[0]}
          </span>
          <Typography
            component="span"
            sx={{
              ml: 0.5,
              px: 0.5,
              py: 0,
              borderRadius: '8px',
              fontSize: '0.6rem',
              fontWeight: 700,
              lineHeight: '16px',
              flexShrink: 0,
              backgroundColor: isDark
                ? 'rgba(251,191,36,0.2)'
                : 'rgba(217,119,6,0.15)',
              color: isDark ? '#fbbf24' : '#d97706',
            }}
          >
            +{chip.values.length - 1}
          </Typography>
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
        {chip.field === '!has' ? 'has not' : chip.field}
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
      {/* has/!has chips use HasFieldSelector Popover, not inline input */}
      {editingPart === 'value' && !isHasChip ? (
        <Box
          component="span"
          sx={{
            ...tokenStyle('value'),
            overflow: 'visible',
            cursor: 'text',
            display: 'inline-flex',
            flexWrap: 'wrap',
            gap: '2px',
            alignItems: 'center',
          }}
        >
          {/* Existing values as pill tags (Sentry style) */}
          {selectedValues &&
            Array.from(selectedValues).map((v, pillIdx) => {
              const isHighlighted = highlightedPillIdx === pillIdx;
              return (
                <Box
                  key={v}
                  component="span"
                  onMouseDown={(e: React.MouseEvent) => {
                    // Prevent blur on the inline input when clicking anywhere on a pill
                    e.preventDefault();
                  }}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    px: 0.5,
                    py: 0,
                    borderRadius: '3px',
                    fontSize: '0.75rem',
                    backgroundColor: isHighlighted
                      ? isDark
                        ? 'rgba(124,138,255,0.25)'
                        : 'rgba(92,107,192,0.20)'
                      : isDark
                        ? 'rgba(251,191,36,0.15)'
                        : 'rgba(217,119,6,0.10)',
                    color: valueColor,
                    maxWidth: 120,
                    lineHeight: 1.4,
                    border: isHighlighted
                      ? `1px solid ${isDark ? 'rgba(124,138,255,0.6)' : 'rgba(92,107,192,0.5)'}`
                      : '1px solid transparent',
                    transition: 'border 0.1s, background-color 0.1s',
                  }}
                >
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {v}
                  </span>
                  <Box
                    component="span"
                    onMouseDown={(e: React.MouseEvent) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onValueTagRemove?.(chip.id, v);
                    }}
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      cursor: 'pointer',
                      opacity: 0.5,
                      '&:hover': {
                        opacity: 1,
                        bgcolor: 'rgba(255,255,255,0.1)',
                      },
                      flexShrink: 0,
                    }}
                  >
                    <CloseIcon sx={{ fontSize: 10, pointerEvents: 'none' }} />
                  </Box>
                </Box>
              );
            })}
          {/* Text input for adding new values */}
          <input
            ref={valueInputRef}
            autoFocus
            value={editingValueText ?? ''}
            placeholder={selectedValues && selectedValues.size > 0 ? '' : '...'}
            onChange={(e) => onValueInputChange?.(chip.id, e.target.value)}
            onKeyDown={(e) => {
              // Block Enter/Tab during IME composition
              if (isIME && (e.key === 'Enter' || e.key === 'Tab')) {
                e.preventDefault();
                return;
              }
              const isEmpty = (editingValueText ?? '') === '';
              const pillCount = selectedValues?.size ?? 0;
              const cursorAtStart =
                (e.target as HTMLInputElement).selectionStart === 0;
              // ArrowLeft when cursor is at start with pills → select last pill
              if (
                e.key === 'ArrowLeft' &&
                cursorAtStart &&
                pillCount > 0 &&
                highlightedPillIdx === -1
              ) {
                e.preventDefault();
                onPillNavigate?.(chip.id, pillCount - 1);
                return;
              }
              // Backspace on empty input → select last pill first (if not already selected)
              if (e.key === 'Backspace' && isEmpty && pillCount > 0) {
                e.preventDefault();
                if (highlightedPillIdx >= 0) {
                  onPillDelete?.(chip.id, highlightedPillIdx);
                } else {
                  onPillNavigate?.(chip.id, pillCount - 1);
                }
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
              minWidth:
                selectedValues && selectedValues.size > 0 ? '20px' : '40px',
              maxWidth: '300px',
            }}
          />
        </Box>
      ) : (
        <Tooltip
          title={(() => {
            if (chip.values && chip.values.length > 1) {
              return (
                <Box sx={{ fontSize: '0.7rem', lineHeight: 1.6, py: 0.3 }}>
                  <Box
                    sx={{
                      fontWeight: 600,
                      opacity: 0.7,
                      mb: 0.3,
                      fontSize: '0.6rem',
                    }}
                  >
                    {t('aql.chip.valueCount', '{{count}} values', {
                      count: chip.values.length,
                    })}
                  </Box>
                  {chip.values.map((v, i) => (
                    <Box
                      key={v}
                      sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}
                    >
                      <span
                        style={{
                          opacity: 0.35,
                          fontSize: '0.6rem',
                          minWidth: 12,
                          textAlign: 'right',
                        }}
                      >
                        {i + 1}.
                      </span>
                      <span>{v}</span>
                    </Box>
                  ))}
                </Box>
              );
            }
            const text = chip.value ?? '';
            return text.length > 30 ? text : '';
          })()}
          placement="top"
          enterDelay={300}
          arrow
        >
          <Box
            ref={valueRef}
            component="span"
            sx={{
              ...tokenStyle('value'),
              display: 'inline-flex',
              alignItems: 'center',
              overflow: 'hidden',
              maxWidth: 240,
              minWidth: 0,
            }}
            onClick={(e: React.MouseEvent<HTMLSpanElement>) =>
              onPartClick(chip.id, 'value', e.currentTarget)
            }
          >
            {renderValueText()}
          </Box>
        </Tooltip>
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
