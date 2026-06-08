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
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { useTranslation } from 'react-i18next';

import type { FilterChip } from './useFilterChips';
import type { QueryDomain, QueryField } from './types';
import { getFieldsForDomain, getFieldByKey } from './fields';
import { getOperatorOptions } from './operator-labels';

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
  domain: QueryDomain;
  facets?: Map<string, string[]>;
  anchorEl: HTMLElement;
  /** Called when the chip should be updated */
  onUpdate: (updates: Partial<FilterChip>) => void;
  onClose: () => void;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function TokenEditDropdown({
  type,
  chip,
  domain,
  facets,
  anchorEl,
  onUpdate,
  onClose,
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

  return (
    <Popover
      open
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{
        paper: {
          sx: {
            mt: 0.5,
            minWidth: 200,
            borderRadius: '8px',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            backgroundColor: isDark
              ? 'rgba(24,28,36,0.98)'
              : 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(12px)',
            boxShadow: isDark
              ? '0 8px 32px rgba(0,0,0,0.5)'
              : '0 4px 20px rgba(0,0,0,0.12)',
          },
        },
      }}
    >
      {type === 'field' && (
        <FieldMenu
          domain={domain}
          currentField={chip.field ?? ''}
          onSelect={handleFieldSelect}
          isDark={isDark}
        />
      )}
      {type === 'operator' && (
        <OperatorMenu
          field={getFieldByKey(chip.field ?? '', domain)}
          currentOperator={chip.operator ?? '='}
          onSelect={handleOperatorSelect}
          isDark={isDark}
        />
      )}
      {type === 'value' && isHasChip && (
        <HasFieldSelector
          domain={domain}
          facets={facets}
          currentValue={chip.value ?? ''}
          onSelect={(v) => handleValueConfirm(v)}
          isDark={isDark}
        />
      )}
      {type === 'value' && !isHasChip && (
        <ValueEditor
          chip={chip}
          facets={facets}
          onConfirm={handleValueConfirm}
          onUpdate={onUpdate}
          isDark={isDark}
        />
      )}
    </Popover>
  );
}

// ─── Field Selection Menu ────────────────────────────────────────────────────

function FieldMenu({
  domain,
  currentField,
  onSelect,
  isDark,
}: {
  domain: QueryDomain;
  currentField: string;
  onSelect: (field: string) => void;
  isDark: boolean;
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);
  const allFields = getFieldsForDomain(domain);

  const filtered = filter
    ? allFields.filter((f) =>
        f.key.toLowerCase().includes(filter.toLowerCase())
      )
    : allFields;

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

// ─── Value Editor ────────────────────────────────────────────────────────────

function ValueEditor({
  chip,
  facets,
  onConfirm,
  onUpdate,
  isDark,
}: {
  chip: FilterChip;
  facets?: Map<string, string[]>;
  onConfirm: (v: string, nextValues?: string[]) => void;
  onUpdate: (updates: Partial<FilterChip>) => void;
  isDark: boolean;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);

  // Initialize valueInput from chip's current values
  const initialValue = useMemo(() => {
    if (chip.values && chip.values.length > 0) {
      return chip.values.join(', ');
    }
    return chip.value ?? '';
  }, [chip.value, chip.values]);

  const [valueInput, setValueInput] = useState(initialValue);

  const facetValues = facets?.get(chip.field ?? '') ?? [];
  const hasMultiValues = (chip.values?.length ?? 0) >= 1;

  // Parse current values from valueInput
  const currentSelected = useMemo(() => {
    return new Set(
      valueInput
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v !== '')
    );
  }, [valueInput]);

  const filterText = isDirty ? valueInput.trim() : '';

  // Stable initial sort order
  const initialOrderRef = useRef<string[] | null>(null);
  if (initialOrderRef.current === null && facetValues.length > 0) {
    const initSelected = new Set(
      (chip.values ?? [chip.value ?? '']).filter((v) => v !== '')
    );
    initialOrderRef.current = [...facetValues].sort((a, b) => {
      const aS = initSelected.has(a);
      const bS = initSelected.has(b);
      if (aS && !bS) return -1;
      if (!aS && bS) return 1;
      return a.localeCompare(b);
    });
  }

  const sorted =
    isDirty && filterText !== ''
      ? (initialOrderRef.current ?? facetValues).filter((v) =>
          v.toLowerCase().includes(filterText.toLowerCase())
        )
      : (initialOrderRef.current ?? facetValues);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [valueInput]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const items = list.querySelectorAll('div[role="button"]');
    const item = items[selectedIndex] as HTMLElement;
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setValueInput(e.target.value);
    setIsDirty(true);
  };

  const handleApplyMulti = () => {
    const vals = Array.from(currentSelected);
    onConfirm(vals.join(', '), vals);
  };

  const handleItemClick = (v: string, e?: React.MouseEvent) => {
    const isCtrlClick = !!(e?.ctrlKey || e?.metaKey);
    if (hasMultiValues || isCtrlClick) {
      // Toggle multi-select
      const nextSet = new Set(currentSelected);
      if (nextSet.has(v)) {
        nextSet.delete(v);
      } else {
        nextSet.add(v);
      }
      const vals = Array.from(nextSet);
      setValueInput(vals.join(', '));
      // Immediately update chip in real-time without closing the dropdown
      onUpdate({ value: vals[0] ?? '', values: vals });
    } else {
      onConfirm(v);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = sorted.slice(0, 30);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < items.length) {
        handleItemClick(items[selectedIndex]);
      } else {
        if (hasMultiValues) {
          handleApplyMulti();
        } else {
          onConfirm(valueInput || chip.value || '');
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onConfirm(chip.value || '', chip.values); // revert
    }
  };

  return (
    <Box sx={{ minWidth: 220 }}>
      {/* Input row for filtering values */}
      <Box
        sx={{
          px: 1,
          py: 0.75,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        }}
      >
        <InputBase
          ref={inputRef}
          value={valueInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          autoFocus
          fullWidth
          placeholder={
            chip.value || t('dsl.chip.filterValues', 'Filter values...')
          }
          sx={{
            fontSize: '0.8rem',
            '& input': { py: 0.25 },
          }}
        />
      </Box>
      {sorted.length > 0 && (
        <List
          ref={listRef}
          dense
          sx={{ py: 0.5, maxHeight: 240, overflow: 'auto' }}
        >
          {sorted.slice(0, 30).map((v, idx) => {
            const isSelected = currentSelected.has(v);
            const isHighlighted = idx === selectedIndex || isSelected;
            return (
              <ListItemButton
                key={v}
                onClick={(e) => handleItemClick(v, e)}
                selected={isHighlighted}
                sx={{
                  py: 0.25,
                  px: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  '&.Mui-selected': {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(0,0,0,0.04)',
                  },
                }}
              >
                {/* Selected indicator: checkmark badge */}
                {isSelected ? (
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 16,
                      height: 16,
                      flexShrink: 0,
                      borderRadius: '3px',
                      backgroundColor: isDark ? '#7c8aff' : '#5c6bc0',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    ✓
                  </Box>
                ) : (
                  <Box sx={{ width: 16, flexShrink: 0 }} />
                )}
                <ListItemText
                  primary={v}
                  primaryTypographyProps={{
                    fontSize: '0.8rem',
                    fontWeight: isHighlighted ? 600 : 400,
                  }}
                />
              </ListItemButton>
            );
          })}
        </List>
      )}
      {/* Multi-select hint footer */}
      {sorted.length >= 2 && (
        <Box
          sx={{
            px: 1.5,
            py: 0.5,
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}
        >
          <Typography
            sx={{
              fontSize: '11px',
              color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
            }}
          >
            {t('dsl.hint.multiSelect', 'Hold {{key}} to select multiple', {
              key: navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl',
            })}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// ─── Has Field Selector ──────────────────────────────────────────────────────

function HasFieldSelector({
  domain,
  facets,
  currentValue,
  onSelect,
  isDark,
}: {
  domain: QueryDomain;
  facets?: Map<string, string[]>;
  currentValue: string;
  onSelect: (v: string) => void;
  isDark: boolean;
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);
  const fields = getFieldsForDomain(domain);

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
          const fieldDef = getFieldByKey(key, domain);
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
