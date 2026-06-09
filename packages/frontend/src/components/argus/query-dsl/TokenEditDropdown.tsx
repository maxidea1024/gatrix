// ============================================================================
// TokenEditDropdown — Unified editing dropdown for filter token parts
// Handles field, operator, and value editing via Popover
// Extracted from FilterTokenChip's FieldMenu, OperatorMenu, ValueEditor
// ============================================================================

import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Box,
  Popover,
  List,
  ListItemButton,
  ListItemText,
  InputBase,
  Typography,
  useTheme,
  CircularProgress,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { useTranslation } from 'react-i18next';

import type { FilterChip } from './useFilterChips';
import type { DomainConfig, QueryField } from './types';
import { getFieldByKey } from './fields';
import { getOperatorOptions } from './operator-labels';
import DatetimeValueEditor from './DatetimeValueEditor';

// ─── Category badges for HasFieldSelector ────────────────────────────────────

const HAS_CATEGORY_BADGES: Record<
  string,
  { label: string; color: string; bg: string; bgLight: string }
> = {
  log: {
    label: 'LOG',
    color: '#7c8aff',
    bg: 'rgba(124,138,255,0.12)',
    bgLight: 'rgba(92,107,192,0.10)',
  },
  resource: {
    label: 'RES',
    color: '#6ec87a',
    bg: 'rgba(110,200,122,0.12)',
    bgLight: 'rgba(56,142,60,0.10)',
  },
  trace: {
    label: 'TRC',
    color: '#e6994a',
    bg: 'rgba(230,153,74,0.12)',
    bgLight: 'rgba(230,81,0,0.10)',
  },
  event: {
    label: 'EVT',
    color: '#d97ce6',
    bg: 'rgba(217,124,230,0.12)',
    bgLight: 'rgba(156,39,176,0.10)',
  },
  user: {
    label: 'USR',
    color: '#4fc3f7',
    bg: 'rgba(79,195,247,0.12)',
    bgLight: 'rgba(2,136,209,0.10)',
  },
  attribute: {
    label: 'ATR',
    color: '#90a4ae',
    bg: 'rgba(144,164,174,0.12)',
    bgLight: 'rgba(96,125,139,0.10)',
  },
};

// ─── Types ───────────────────────────────────────────────────────────────────

export type EditingPart = 'field' | 'operator' | 'value';

export interface TokenEditDropdownProps {
  type: EditingPart;
  chip: FilterChip;
  domain: DomainConfig;
  facets?: Map<string, string[]>;
  anchorEl: HTMLElement;
  /** Called when the chip should be updated */
  onUpdate: (updates: Partial<FilterChip>) => void;
  onClose: () => void;
  /** Inline value editing mode props (value type only) */
  filterText?: string;
  selectedValues?: Set<string>;
  highlightIndex?: number;
  onCheckboxToggle?: (value: string) => void;
  onTextSelect?: (value: string) => void;
  /** Show loading spinner when facet values are being fetched */
  isLoading?: boolean;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function TokenEditDropdown({
  type,
  chip,
  domain: config,
  facets,
  anchorEl,
  onUpdate,
  onClose,
  filterText,
  selectedValues,
  highlightIndex,
  onCheckboxToggle,
  onTextSelect,
  isLoading = false,
}: TokenEditDropdownProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isHasChip = chip.field === 'has' || chip.field === '!has';

  const handleFieldSelect = (field: string) => {
    onUpdate({ field });
    onClose();
  };

  const handleOperatorSelect = (op: string) => {
    onUpdate({ operator: op });
    onClose();
  };

  const handleValueConfirm = (value: string, values?: string[]) => {
    if (values && values.length > 1) {
      onUpdate({ value: values[0], values, composingPart: undefined });
    } else {
      onUpdate({ value, values: values ?? [value], composingPart: undefined });
    }
    onClose();
  };

  // Value editing uses inline input — popover should not steal focus
  const isValueType = type === 'value' && !isHasChip;

  // Check if this is a datetime field
  const field = getFieldByKey(chip.field ?? '', config);
  const isDatetimeField = isValueType && field?.type === 'datetime';

  // Check if value suggestions have results — skip popover entirely if no facets
  // Datetime fields always show the popover (presets + DateTimePicker)
  const hasValueResults = (() => {
    if (!isValueType) return true;
    if (isDatetimeField) return true;
    const facetValues = facets?.get(chip.field ?? '') ?? [];
    const staticVals = field?.staticValues ?? [];
    return facetValues.length > 0 || staticVals.length > 0;
  })();

  // Don't render popover at all for value types with no facets AND not loading
  if (!hasValueResults && !isLoading) return null;

  return (
    <Popover
      open
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      {...(isValueType
        ? {
            disableAutoFocus: true,
            disableEnforceFocus: true,
            disableRestoreFocus: true,
          }
        : {})}
      slotProps={{
        paper: {
          sx: {
            mt: 0.5,
            minWidth: 200,
            borderRadius: '8px',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            backgroundColor: isDark ? '#1e1e1e' : '#fff',
            boxShadow: isDark
              ? '0 4px 20px rgba(0,0,0,0.6)'
              : '0 4px 20px rgba(0,0,0,0.1)',
          },
        },
      }}
    >
      {type === 'field' && (
        <FieldMenu
          config={config}
          currentField={chip.field ?? ''}
          onSelect={handleFieldSelect}
          isDark={isDark}
        />
      )}
      {type === 'operator' && (
        <OperatorMenu
          field={getFieldByKey(chip.field ?? '', config)}
          currentOperator={chip.operator ?? '='}
          onSelect={handleOperatorSelect}
          isDark={isDark}
        />
      )}
      {type === 'value' && isHasChip && (
        <HasFieldSelector
          domain={config}
          facets={facets}
          currentValue={chip.value ?? ''}
          onSelect={(v) => handleValueConfirm(v)}
          isDark={isDark}
        />
      )}
      {isDatetimeField && (
        <DatetimeValueEditor
          operator={chip.operator ?? '='}
          currentValue={chip.value}
          currentValueTo={chip.valueTo}
          highlightIndex={highlightIndex ?? -1}
          onSelect={(value, valueTo) => {
            onUpdate({
              value,
              valueTo,
              values: [value],
              composingPart: undefined,
            });
            onClose();
          }}
          isDark={isDark}
        />
      )}
      {isValueType &&
        !isDatetimeField &&
        (isLoading && !hasValueResults ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              px: 1.5,
              py: 1.5,
              minWidth: 160,
            }}
          >
            <CircularProgress
              size={14}
              thickness={5}
              sx={{
                color: isDark
                  ? 'rgba(124,138,255,0.7)'
                  : 'rgba(92,107,192,0.7)',
              }}
            />
            <Typography
              sx={{
                fontSize: '11px',
                color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
              }}
            >
              Loading...
            </Typography>
          </Box>
        ) : (
          <ValueSuggestionList
            chip={chip}
            field={field}
            facets={facets}
            filterText={filterText ?? ''}
            selectedValues={selectedValues ?? new Set()}
            highlightIndex={highlightIndex ?? -1}
            onCheckboxToggle={onCheckboxToggle ?? (() => {})}
            onTextSelect={onTextSelect ?? (() => {})}
            isDark={isDark}
          />
        ))}
    </Popover>
  );
}

// ─── Field Selection Menu ────────────────────────────────────────────────────

function FieldMenu({
  config,
  currentField,
  onSelect,
  isDark,
}: {
  config: DomainConfig;
  currentField: string;
  onSelect: (field: string) => void;
  isDark: boolean;
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);
  const allFields = config.fields;

  // When no filter text: show only current field + fields starting with currentField.
  // When filter text: search all fields
  const filtered = filter
    ? allFields.filter((f) =>
        f.key.toLowerCase().includes(filter.toLowerCase())
      )
    : allFields.filter(
        (f) => f.key === currentField || f.key.startsWith(currentField + '.')
      );

  useEffect(() => {
    setSelectedIndex(-1);
  }, [filter]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const items = list.querySelectorAll('div[role="button"]');
    const item = items[selectedIndex] as HTMLElement;
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < filtered.length) {
        onSelect(filtered[selectedIndex].key);
      } else if (filtered.length > 0) {
        onSelect(filtered[0].key);
      }
    }
  };

  return (
    <Box sx={{ minWidth: 200 }}>
      <Box
        sx={{
          px: 1,
          py: 0.75,
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        }}
      >
        <InputBase
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          fullWidth
          placeholder={t('dsl.chip.filterFields', 'Filter fields...')}
          sx={{
            fontSize: '0.8rem',
            '& input': { py: 0.25 },
          }}
        />
      </Box>
      <List
        ref={listRef}
        dense
        sx={{ py: 0.5, maxHeight: 280, overflow: 'auto' }}
      >
        {filtered.map((f, idx) => {
          const isSelected = idx === selectedIndex || f.key === currentField;
          return (
            <ListItemButton
              key={f.key}
              onClick={() => onSelect(f.key)}
              selected={isSelected}
              sx={{
                py: 0.5,
                px: 1.5,
                fontSize: '0.8rem',
                '&.Mui-selected': {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.04)',
                },
              }}
            >
              <ListItemText
                primary={f.key}
                primaryTypographyProps={{
                  fontSize: '0.8rem',
                  fontWeight: isSelected ? 600 : 400,
                }}
              />
              {f.key === currentField && (
                <CheckIcon
                  sx={{ fontSize: 14, ml: 1, color: 'primary.main' }}
                />
              )}
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
}

// ─── Operator Selection Menu ─────────────────────────────────────────────────

function OperatorMenu({
  field,
  currentOperator,
  onSelect,
  isDark,
}: {
  field: QueryField | undefined;
  currentOperator: string;
  onSelect: (op: string) => void;
  isDark: boolean;
}) {
  const operators = field?.operators ?? ['=', '!='];
  const fieldType = field?.type ?? 'string';
  const options = getOperatorOptions(operators, fieldType);

  const [selectedIndex, setSelectedIndex] = useState(() => {
    const idx = options.findIndex((o) => o.op === currentOperator);
    return idx >= 0 ? idx : 0;
  });

  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    listRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < options.length) {
        onSelect(options[selectedIndex].op);
      }
    }
  };

  return (
    <List
      ref={listRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      dense
      sx={{ py: 0.5, outline: 'none' }}
    >
      {options.map(({ op, label }, idx) => {
        const isSelected = idx === selectedIndex || op === currentOperator;
        return (
          <ListItemButton
            key={op}
            onClick={() => onSelect(op)}
            selected={isSelected}
            sx={{
              py: 0.5,
              px: 1.5,
              '&.Mui-selected': {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(0,0,0,0.04)',
              },
            }}
          >
            <ListItemText
              primary={label}
              primaryTypographyProps={{
                fontSize: '0.8rem',
                fontWeight: isSelected ? 600 : 400,
              }}
            />
            {op === currentOperator && (
              <CheckIcon sx={{ fontSize: 14, ml: 1, color: 'primary.main' }} />
            )}
          </ListItemButton>
        );
      })}
    </List>
  );
}

// ─── Value Suggestion List (pure display, no InputBase) ─────────────────────
// Replaces the old ValueEditor. All typing happens in the inline input in
// FilterTokenGroup. This component only renders the suggestion list.

function ValueSuggestionList({
  chip,
  field: fieldDef,
  facets,
  filterText,
  selectedValues,
  highlightIndex,
  onCheckboxToggle,
  onTextSelect,
  isDark,
}: {
  chip: FilterChip;
  field?: QueryField;
  facets?: Map<string, string[]>;
  filterText: string;
  selectedValues: Set<string>;
  highlightIndex: number;
  onCheckboxToggle: (value: string) => void;
  onTextSelect: (value: string) => void;
  isDark: boolean;
}) {
  const listRef = useRef<HTMLUListElement>(null);

  // Merge staticValues (highest priority) + facet values, deduplicated
  const allValues = (() => {
    const seen = new Set<string>();
    const result: string[] = [];
    const staticVals = fieldDef?.staticValues ?? [];
    const facetVals = facets?.get(chip.field ?? '') ?? [];
    for (const v of [...staticVals, ...facetVals]) {
      if (!seen.has(v)) {
        seen.add(v);
        result.push(v);
      }
    }
    return result;
  })();

  // Scroll highlighted item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list || highlightIndex < 0) return;
    const items = list.querySelectorAll('div[role="button"]');
    const item = items[highlightIndex] as HTMLElement;
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  if (allValues.length === 0) return null;

  return (
    <Box sx={{ minWidth: 220 }}>
      <List
        ref={listRef}
        dense
        sx={{ py: 0.5, maxHeight: 240, overflow: 'auto' }}
      >
        {allValues.slice(0, 30).map((v, idx) => {
          const isChecked = selectedValues.has(v);
          const isHighlighted = idx === highlightIndex;
          return (
            <ListItemButton
              key={v}
              onClick={(e) => {
                e.stopPropagation();
                onCheckboxToggle(v);
              }}
              selected={false}
              sx={{
                py: 0.25,
                px: 1.5,
                mx: 0.75,
                my: 0.25,
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                // Keyboard highlight: solid outline with slight rounding and a soft glow
                boxShadow: isHighlighted
                  ? `0 0 0 1px ${isDark ? '#7c8aff' : '#5c6bc0'}, 0 0 8px ${isDark ? 'rgba(124,138,255,0.4)' : 'rgba(92,107,192,0.3)'}`
                  : 'none',
                // Checked items: subtle background
                backgroundColor: isChecked
                  ? isDark
                    ? 'rgba(124,138,255,0.10)'
                    : 'rgba(92,107,192,0.08)'
                  : 'transparent',
                '&:hover': {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.04)',
                },
              }}
            >
              <ListItemText
                primary={v}
                primaryTypographyProps={{
                  fontSize: '0.8rem',
                  fontWeight: isChecked ? 600 : 400,
                }}
              />
              {/* Checkbox on the right */}
              <Box
                data-checkbox
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 14,
                  height: 14,
                  flexShrink: 0,
                  borderRadius: '3px',
                  border: `1px solid ${isChecked ? 'transparent' : isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}`,
                  backgroundColor: isChecked
                    ? isDark
                      ? '#7c8aff'
                      : '#5c6bc0'
                    : 'transparent',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                {isChecked && '✓'}
              </Box>
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
}

// ─── Has Field Selector ──────────────────────────────────────────────────────

function HasFieldSelector({
  domain: config,
  facets,
  currentValue,
  onSelect,
  isDark,
}: {
  domain: DomainConfig;
  facets?: Map<string, string[]>;
  currentValue: string;
  onSelect: (v: string) => void;
  isDark: boolean;
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);
  const fields = config.fields;

  // Build combined list: static fields + dynamic facet keys
  const allKeys: string[] = [];
  const staticKeys = new Set<string>();
  for (const f of fields) {
    allKeys.push(f.key);
    staticKeys.add(f.key);
  }
  if (facets) {
    for (const key of facets.keys()) {
      if (!staticKeys.has(key)) {
        allKeys.push(key);
      }
    }
  }

  const filtered = filter
    ? allKeys.filter((k) => k.toLowerCase().includes(filter.toLowerCase()))
    : allKeys;

  // Sort: current value first
  const sorted = [...filtered].sort((a, b) => {
    if (a === currentValue) return -1;
    if (b === currentValue) return 1;
    return a.localeCompare(b);
  });

  const displayItems = sorted.slice(0, 30);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [filter]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const items = list.querySelectorAll('div[role="button"]');
    const item = items[selectedIndex] as HTMLElement;
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, displayItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < displayItems.length) {
        onSelect(displayItems[selectedIndex]);
      } else if (displayItems.length > 0) {
        onSelect(displayItems[0]);
      }
    }
  };

  return (
    <Box sx={{ minWidth: 200 }}>
      <Box
        sx={{
          px: 1,
          py: 0.75,
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        }}
      >
        <InputBase
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          fullWidth
          placeholder={t('dsl.chip.filterFields', 'Filter fields...')}
          sx={{
            fontSize: '0.8rem',
            '& input': { py: 0.25 },
          }}
        />
      </Box>
      <List
        ref={listRef}
        dense
        sx={{ py: 0.5, maxHeight: 280, overflow: 'auto' }}
      >
        {displayItems.map((key, idx) => {
          const isCurrent = key === currentValue;
          const isSelected = idx === selectedIndex || isCurrent;
          const fieldDef = getFieldByKey(key, config);
          const cat = fieldDef?.category ?? 'attribute';
          const badge = HAS_CATEGORY_BADGES[cat];
          return (
            <ListItemButton
              key={key}
              onClick={() => onSelect(key)}
              selected={isSelected}
              sx={{
                py: 0.5,
                px: 1.5,
                gap: 1,
                '&.Mui-selected': {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.04)',
                },
              }}
            >
              {badge && (
                <Box
                  sx={{
                    fontSize: '8px',
                    fontWeight: 700,
                    flexShrink: 0,
                    fontFamily: '"JetBrains Mono", monospace',
                    color: badge.color,
                    backgroundColor: isDark ? badge.bg : badge.bgLight,
                    borderRadius: '3px',
                    px: '3px',
                    py: '1px',
                    lineHeight: 1.3,
                    letterSpacing: '0.02em',
                    minWidth: 22,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {badge.label}
                </Box>
              )}
              <ListItemText
                primary={key}
                primaryTypographyProps={{
                  fontSize: '0.8rem',
                  fontWeight: isSelected ? 600 : 400,
                }}
              />
              {isCurrent && (
                <CheckIcon
                  sx={{ fontSize: 14, ml: 1, color: 'primary.main' }}
                />
              )}
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
}
