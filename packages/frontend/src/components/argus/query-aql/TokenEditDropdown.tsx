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
import {
  getFieldByKey,
  getAggregateOperators,
  getAggregateFieldType,
} from './fields';
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

export type EditingPart = 'field' | 'operator' | 'value' | 'aggregateArg';

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
  const { t } = useTranslation();
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
      {type === 'field' && !isHasChip && !chip.aggregateFunc && (
        <FieldMenu
          config={config}
          currentField={chip.field ?? ''}
          facets={facets}
          onSelect={handleFieldSelect}
          isDark={isDark}
        />
      )}
      {type === 'field' && chip.aggregateFunc && (
        <AggregateFieldMenu
          config={config}
          chip={chip}
          onUpdate={onUpdate}
          onClose={onClose}
          isDark={isDark}
        />
      )}
      {type === 'field' && isHasChip && (
        <HasToggleMenu
          currentField={chip.field ?? 'has'}
          onSelect={handleFieldSelect}
          isDark={isDark}
        />
      )}
      {type === 'aggregateArg' && (
        <AggregateArgMenu
          config={config}
          chip={chip}
          onUpdate={onUpdate}
          onClose={onClose}
          isDark={isDark}
        />
      )}
      {type === 'operator' && (
        <OperatorMenu
          field={
            chip.aggregateFunc
              ? ({
                  key: chip.aggregateFunc,
                  label: chip.aggregateFunc,
                  type: getAggregateFieldType(chip.aggregateFunc, config),
                  category: 'log',
                  operators: getAggregateOperators(chip.aggregateFunc, config),
                  searchable: false,
                  description: '',
                } as QueryField)
              : getFieldByKey(chip.field ?? '', config)
          }
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
              {t('aql.chip.loading', 'Loading...')}
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
  facets,
  onSelect,
  isDark,
}: {
  config: DomainConfig;
  currentField: string;
  facets?: Map<string, string[]>;
  onSelect: (field: string) => void;
  isDark: boolean;
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);

  // Build combined field list: static fields + discovered facet keys
  const allKeys = useMemo(() => {
    const seen = new Set<string>();
    const result: { key: string; isDynamic: boolean }[] = [];

    // 1. Static domain fields
    for (const f of config.fields) {
      if (!seen.has(f.key)) {
        seen.add(f.key);
        result.push({ key: f.key, isDynamic: false });
      }
    }

    // 2. Discovered facet keys not already in static fields
    if (facets) {
      const reservedKeys = new Set(['has', '!has']);
      for (const key of facets.keys()) {
        if (!seen.has(key) && !reservedKeys.has(key.toLowerCase())) {
          seen.add(key);
          result.push({ key, isDynamic: true });
        }
      }
    }

    // 3. If currentField is not in the list at all, add it (edge case)
    if (currentField && !seen.has(currentField)) {
      result.push({ key: currentField, isDynamic: true });
    }

    return result;
  }, [config.fields, facets, currentField]);

  // When no filter text: show current field + sub-fields (e.g. message, message.template)
  // When filter text: search all fields
  const filtered = useMemo(() => {
    if (filter) {
      const lowerFilter = filter.toLowerCase();
      return allKeys.filter((f) => f.key.toLowerCase().includes(lowerFilter));
    }
    return allKeys.filter(
      (f) => f.key === currentField || f.key.startsWith(currentField + '.')
    );
  }, [allKeys, filter, currentField]);

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
          autoComplete="new-password"
          placeholder={t('aql.chip.filterFields', 'Filter fields...')}
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
          const isCurrent = f.key === currentField;
          const isKeyboardHighlighted = idx === selectedIndex;
          return (
            <ListItemButton
              key={f.key}
              onClick={() => onSelect(f.key)}
              selected={isKeyboardHighlighted}
              sx={{
                py: 0.5,
                px: 1.5,
                fontSize: '0.8rem',
                '&.Mui-selected': {
                  backgroundColor: isDark
                    ? 'rgba(124,138,255,0.15)'
                    : 'rgba(92,107,192,0.12)',
                },
                '&.Mui-selected:hover': {
                  backgroundColor: isDark
                    ? 'rgba(124,138,255,0.20)'
                    : 'rgba(92,107,192,0.16)',
                },
              }}
            >
              <ListItemText
                primary={f.key}
                primaryTypographyProps={{
                  fontSize: '0.8rem',
                  fontWeight: isCurrent ? 600 : 400,
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
        const isCurrent = op === currentOperator;
        const isKeyboardHighlighted = idx === selectedIndex;
        return (
          <ListItemButton
            key={op}
            onClick={() => onSelect(op)}
            selected={isKeyboardHighlighted}
            sx={{
              py: 0.5,
              px: 1.5,
              '&.Mui-selected': {
                backgroundColor: isDark
                  ? 'rgba(124,138,255,0.15)'
                  : 'rgba(92,107,192,0.12)',
              },
              '&.Mui-selected:hover': {
                backgroundColor: isDark
                  ? 'rgba(124,138,255,0.20)'
                  : 'rgba(92,107,192,0.16)',
              },
            }}
          >
            <ListItemText
              primary={label}
              primaryTypographyProps={{
                fontSize: '0.8rem',
                fontWeight: isCurrent ? 600 : 400,
              }}
            />
            {isCurrent && (
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

  // Merge staticValues + facet values (stable order) + any selected values not in those lists
  const allValues = (() => {
    const seen = new Set<string>();
    const result: string[] = [];

    // 1. Static values + facet values in their original order (stable)
    const staticVals = fieldDef?.staticValues ?? [];
    const facetVals = facets?.get(chip.field ?? '') ?? [];
    for (const v of [...staticVals, ...facetVals]) {
      if (!seen.has(v)) {
        seen.add(v);
        result.push(v);
      }
    }

    // 2. Any currently selected values not already in the list (appended at end)
    for (const sv of selectedValues) {
      if (sv && !seen.has(sv)) {
        seen.add(sv);
        result.push(sv);
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
                backgroundColor: isHighlighted
                  ? isDark
                    ? 'rgba(124,138,255,0.15)'
                    : 'rgba(92,107,192,0.12)'
                  : isChecked
                    ? isDark
                      ? 'rgba(124,138,255,0.10)'
                      : 'rgba(92,107,192,0.08)'
                    : 'transparent',
                '&:hover': {
                  backgroundColor: isDark
                    ? 'rgba(124,138,255,0.12)'
                    : 'rgba(92,107,192,0.08)',
                },
              }}
            >
              <ListItemText
                primary={v}
                primaryTypographyProps={{
                  fontSize: '0.8rem',
                  fontWeight: isChecked ? 600 : 400,
                  noWrap: true,
                  title: v.length > 40 ? v : undefined,
                }}
                sx={{ overflow: 'hidden', minWidth: 0 }}
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
    const reservedKeys = new Set(['has', '!has']);
    for (const key of facets.keys()) {
      if (!staticKeys.has(key) && !reservedKeys.has(key.toLowerCase())) {
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
          autoComplete="new-password"
          placeholder={t('aql.chip.filterFields', 'Filter fields...')}
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
          const isKeyboardHighlighted = idx === selectedIndex;
          const fieldDef = getFieldByKey(key, config);
          const cat = fieldDef?.category ?? 'attribute';
          const badge = HAS_CATEGORY_BADGES[cat];
          return (
            <ListItemButton
              key={key}
              onClick={() => onSelect(key)}
              selected={isKeyboardHighlighted}
              sx={{
                py: 0.5,
                px: 1.5,
                gap: 1,
                '&.Mui-selected': {
                  backgroundColor: isDark
                    ? 'rgba(124,138,255,0.15)'
                    : 'rgba(92,107,192,0.12)',
                },
                '&.Mui-selected:hover': {
                  backgroundColor: isDark
                    ? 'rgba(124,138,255,0.20)'
                    : 'rgba(92,107,192,0.16)',
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
                  fontWeight: isCurrent ? 600 : 400,
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

// ─── Has Toggle Menu (has ↔ has not) ─────────────────────────────────────────

function HasToggleMenu({
  currentField,
  onSelect,
  isDark,
}: {
  currentField: string;
  onSelect: (field: string) => void;
  isDark: boolean;
}) {
  const options = [
    { key: 'has', label: 'has' },
    { key: '!has', label: 'has not' },
  ];

  const [selectedIndex, setSelectedIndex] = useState(() => {
    const idx = options.findIndex((o) => o.key === currentField);
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
        onSelect(options[selectedIndex].key);
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
      {options.map(({ key, label }, idx) => {
        const isCurrent = key === currentField;
        const isKeyboardHighlighted = idx === selectedIndex;
        return (
          <ListItemButton
            key={key}
            onClick={() => onSelect(key)}
            selected={isKeyboardHighlighted}
            sx={{
              py: 0.5,
              px: 1.5,
              '&.Mui-selected': {
                backgroundColor: isDark
                  ? 'rgba(124,138,255,0.15)'
                  : 'rgba(92,107,192,0.12)',
              },
              '&.Mui-selected:hover': {
                backgroundColor: isDark
                  ? 'rgba(124,138,255,0.20)'
                  : 'rgba(92,107,192,0.16)',
              },
            }}
          >
            <ListItemText
              primary={label}
              primaryTypographyProps={{
                fontSize: '0.8rem',
                fontWeight: isCurrent ? 600 : 400,
              }}
            />
            {isCurrent && (
              <CheckIcon sx={{ fontSize: 14, ml: 1, color: 'primary.main' }} />
            )}
          </ListItemButton>
        );
      })}
    </List>
  );
}

// ─── Aggregate Field Menu (change aggregate function) ────────────────────────

function AggregateFieldMenu({
  config,
  chip,
  onUpdate,
  onClose,
  isDark,
}: {
  config: DomainConfig;
  chip: FilterChip;
  onUpdate: (updates: Partial<FilterChip>) => void;
  onClose: () => void;
  isDark: boolean;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const aggregates = config.aggregates ?? [];
  const currentFunc = chip.aggregateFunc ?? '';

  useEffect(() => {
    requestAnimationFrame(() => searchRef.current?.focus());
  }, []);

  const filtered = aggregates.filter(
    (agg) => !search || agg.name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(-1);
  }, [search]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const items = list.querySelectorAll('div[role="button"]');
    const item = items[selectedIndex] as HTMLElement;
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const selectAgg = (agg: (typeof aggregates)[0]) => {
    const needsArgs = agg.args.length > 0;
    const hasCurrentArgs = chip.aggregateArgs && chip.aggregateArgs.length > 0;
    onUpdate({
      aggregateFunc: agg.name,
      aggregateArgs: needsArgs
        ? hasCurrentArgs
          ? chip.aggregateArgs
          : [] // empty — parent will chain to aggregateArg selection
        : [],
    });
    onClose();
  };

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
        selectAgg(filtered[selectedIndex]);
      } else if (filtered.length > 0) {
        selectAgg(filtered[0]);
      }
    }
  };

  return (
    <Box
      sx={{
        maxHeight: 280,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ px: 1, pt: 1, pb: 0.5 }}>
        <InputBase
          inputRef={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="new-password"
          placeholder={t('aql.chip.filterAggregates', 'Search aggregates…')}
          fullWidth
          sx={{
            fontSize: '0.8rem',
            px: 1,
            py: 0.3,
            borderRadius: '6px',
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(0,0,0,0.04)',
          }}
        />
      </Box>
      <List ref={listRef} dense sx={{ overflow: 'auto', py: 0.5 }}>
        {filtered.map((agg, idx) => {
          const isCurrent = agg.name === currentFunc;
          const isHighlighted = idx === selectedIndex;
          const label =
            agg.args.length === 0 ? `${agg.name}()` : `${agg.name}(field)`;
          return (
            <ListItemButton
              key={agg.name}
              onClick={() => selectAgg(agg)}
              selected={isHighlighted || isCurrent}
              sx={{
                py: 0.5,
                px: 1.5,
                '&.Mui-selected': {
                  backgroundColor: isHighlighted
                    ? isDark
                      ? 'rgba(124,138,255,0.15)'
                      : 'rgba(92,107,192,0.12)'
                    : isDark
                      ? 'rgba(0,188,212,0.12)'
                      : 'rgba(0,151,167,0.08)',
                },
              }}
            >
              <Box
                component="span"
                sx={{
                  fontSize: '8px',
                  fontWeight: 700,
                  fontFamily: '"JetBrains Mono", monospace',
                  color: '#4dd0e1',
                  backgroundColor: isDark
                    ? 'rgba(0,188,212,0.12)'
                    : 'rgba(0,151,167,0.10)',
                  borderRadius: '3px',
                  px: '3px',
                  py: '1px',
                  mr: 1,
                  lineHeight: 1.3,
                  minWidth: 16,
                  textAlign: 'center',
                }}
              >
                Σ
              </Box>
              <ListItemText
                primary={label}
                primaryTypographyProps={{
                  fontSize: '0.8rem',
                  fontWeight: isCurrent ? 600 : 400,
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

// ─── Aggregate Arg (Field) Selection Menu ─────────────────────────────────────

function AggregateArgMenu({
  config,
  chip,
  onUpdate,
  onClose,
  isDark,
}: {
  config: DomainConfig;
  chip: FilterChip;
  onUpdate: (updates: Partial<FilterChip>) => void;
  onClose: () => void;
  isDark: boolean;
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const currentArg = chip.aggregateArgs?.[0] ?? '';

  // Gather all numeric/applicable fields from the domain
  const fields = useMemo(() => {
    const allFields = config.fields ?? [];
    // For aggregate arg, show all fields (aggregates can apply to various types)
    return allFields.filter(
      (f) => f.type === 'number' || f.type === 'string' || f.type === 'datetime'
    );
  }, [config.fields]);

  const filtered = useMemo(() => {
    if (!filter) return fields;
    const lower = filter.toLowerCase();
    return fields.filter(
      (f) =>
        f.key.toLowerCase().includes(lower) ||
        f.label.toLowerCase().includes(lower)
    );
  }, [fields, filter]);

  useEffect(() => {
    requestAnimationFrame(() => searchRef.current?.focus());
  }, []);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [filter]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const items = list.querySelectorAll('li');
    const item = items[selectedIndex] as HTMLElement;
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const selectField = (fieldKey: string) => {
    onUpdate({ aggregateArgs: [fieldKey] });
    onClose();
  };

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
        selectField(filtered[selectedIndex].key);
      } else if (filtered.length > 0) {
        selectField(filtered[0].key);
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
          inputRef={searchRef}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          fullWidth
          autoComplete="new-password"
          placeholder={t('aql.chip.filterFields', 'Filter fields...')}
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
          const isCurrent = f.key === currentArg;
          const isHighlighted = idx === selectedIndex;
          return (
            <ListItemButton
              key={f.key}
              onClick={() => selectField(f.key)}
              selected={isHighlighted || isCurrent}
              sx={{
                py: 0.5,
                px: 1.5,
                fontSize: '0.8rem',
                '&.Mui-selected': {
                  backgroundColor: isHighlighted
                    ? isDark
                      ? 'rgba(124,138,255,0.15)'
                      : 'rgba(92,107,192,0.12)'
                    : isDark
                      ? 'rgba(0,188,212,0.12)'
                      : 'rgba(0,151,167,0.08)',
                },
              }}
            >
              <ListItemText
                primary={f.key}
                primaryTypographyProps={{
                  fontSize: '0.8rem',
                  fontWeight: isCurrent ? 600 : 400,
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
