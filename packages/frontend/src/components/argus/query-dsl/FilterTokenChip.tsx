// ============================================================================
// FilterTokenChip — Individual filter chip in the tokenized grid
// Renders: [field] [operator] [value] [×]
// Each part is clickable and opens a popover for editing
// ============================================================================

import React, { useState, useRef } from 'react';
import {
  Box,
  Popover,
  List,
  ListItemButton,
  ListItemText,
  IconButton,
  InputBase,
  Typography,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import { useTranslation } from 'react-i18next';

import type { FilterChip } from './useFilterChips';
import type { QueryDomain, QueryField, QueryOperator } from './types';
import { getFieldsForDomain, getFieldByKey } from './fields';
import { getOpLabel, getOperatorOptions } from './operator-labels';

// ─── Category badges for HasFieldSelector ────────────────────────────────────

const HAS_CATEGORY_BADGES: Record<string, { label: string; color: string; bg: string; bgLight: string }> = {
  log:       { label: 'LOG', color: '#7c8aff', bg: 'rgba(124,138,255,0.12)', bgLight: 'rgba(92,107,192,0.10)' },
  resource:  { label: 'RES', color: '#6ec87a', bg: 'rgba(110,200,122,0.12)', bgLight: 'rgba(56,142,60,0.10)' },
  trace:     { label: 'TRC', color: '#e6994a', bg: 'rgba(230,153,74,0.12)',  bgLight: 'rgba(230,81,0,0.10)' },
  event:     { label: 'EVT', color: '#d97ce6', bg: 'rgba(217,124,230,0.12)', bgLight: 'rgba(156,39,176,0.10)' },
  user:      { label: 'USR', color: '#4fc3f7', bg: 'rgba(79,195,247,0.12)',  bgLight: 'rgba(2,136,209,0.10)' },
  attribute: { label: 'ATR', color: '#90a4ae', bg: 'rgba(144,164,174,0.12)', bgLight: 'rgba(96,125,139,0.10)' },
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface FilterTokenChipProps {
  chip: FilterChip;
  domain: QueryDomain;
  facets?: Map<string, string[]>;
  onUpdate: (
    chipId: string,
    updates: Partial<Pick<FilterChip, 'field' | 'operator' | 'value'>>
  ) => void;
  onDelete: (chipId: string) => void;
  /** Called when chip editing starts (true) or ends (false) */
  onEditToggle?: (editing: boolean) => void;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function FilterTokenChip({
  chip,
  domain,
  facets,
  onUpdate,
  onDelete,
  onEditToggle,
}: FilterTokenChipProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation();

  const [editingPart, setEditingPart] = useState<
    'field' | 'operator' | 'value' | null
  >(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [valueInput, setValueInput] = useState(chip.value);

  const field = getFieldByKey(chip.field, domain);
  const fieldType = field?.type ?? 'string';
  const opLabel = getOpLabel(chip.operator, fieldType);
  const isHasChip = chip.field === 'has' || chip.field === '!has';

  const handlePartClick = (
    part: 'field' | 'operator' | 'value',
    el: HTMLElement
  ) => {
    // Toggle: clicking the same part again closes the popover
    if (editingPart === part) {
      handleClose();
      return;
    }
    if (part === 'value') {
      // Start empty so all facet values are visible; current value is highlighted
      setValueInput('');
    }
    setEditingPart(part);
    setAnchorEl(el);
    onEditToggle?.(true);
  };

  const handleClose = () => {
    setEditingPart(null);
    setAnchorEl(null);
    onEditToggle?.(false);
  };

  const handleFieldSelect = (newField: string) => {
    const newFieldMeta = getFieldByKey(newField, domain);
    const newOps = newFieldMeta?.operators ?? ['='];
    // Reset operator if current one isn't valid for new field
    const validOp = newOps.includes(chip.operator as QueryOperator)
      ? (chip.operator as QueryOperator)
      : ('=' as QueryOperator);
    onUpdate(chip.id, { field: newField, operator: validOp });
    handleClose();
  };

  const handleOperatorSelect = (newOp: string) => {
    onUpdate(chip.id, { operator: newOp as QueryOperator });
    handleClose();
  };

  const handleValueConfirm = (newValue: string) => {
    onUpdate(chip.id, { value: newValue });
    handleClose();
  };

  // ─── Styles ──────────────────────────────────────────────────────────

  const chipBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const chipBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

  const partStyle = (type: 'field' | 'operator' | 'value') => ({
    px: 0.75,
    py: 0.25,
    cursor: 'pointer',
    borderRadius: '3px',
    fontSize: '0.8rem',
    fontWeight: type === 'field' ? 600 : 400,
    color:
      type === 'field'
        ? isDark
          ? '#c4b5fd'
          : '#7c3aed'
        : type === 'operator'
          ? isDark
            ? '#94a3b8'
            : '#64748b'
          : isDark
            ? '#fbbf24'
            : '#d97706',
    '&:hover': {
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    transition: 'background-color 0.15s',
    userSelect: 'none' as const,
  });

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <>
      <Box
        data-chip
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0,
          backgroundColor: chipBg,
          border: `1px solid ${chipBorder}`,
          borderRadius: '6px',
          px: 0.25,
          py: 0.125,
          mr: 0.5,
          my: 0.25,
          maxWidth: '100%',
          overflow: 'hidden',
        }}
      >
        {/* Field part */}
        <Box
          component="span"
          sx={partStyle('field')}
          onClick={(e: React.MouseEvent<HTMLSpanElement>) =>
            handlePartClick('field', e.currentTarget)
          }
        >
          {chip.field === '!has' ? 'not has' : chip.field}
        </Box>

        {/* Operator part — hidden for has/!has */}
        {isHasChip ? null : (
          <Box
            component="span"
            sx={partStyle('operator')}
            onClick={(e: React.MouseEvent<HTMLSpanElement>) =>
              handlePartClick('operator', e.currentTarget)
            }
          >
            {opLabel}
          </Box>
        )}

        {/* Value part */}
        <Box
          component="span"
          sx={{
            ...partStyle('value'),
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 200,
            minWidth: 0,
          }}
          onClick={(e: React.MouseEvent<HTMLSpanElement>) =>
            handlePartClick('value', e.currentTarget)
          }
        >
          {chip.value || (
            <Typography
              component="span"
              sx={{ opacity: 0.4, fontSize: '0.8rem' }}
            >
              ...
            </Typography>
          )}
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
            opacity: 0.4,
            '&:hover': { opacity: 1 },
          }}
        >
          <CloseIcon sx={{ fontSize: 12 }} />
        </IconButton>
      </Box>

      {/* ── Popover for editing ── */}
      <Popover
        open={editingPart !== null}
        anchorEl={anchorEl}
        onClose={handleClose}
        disableRestoreFocus
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              minWidth: 160,
              maxHeight: 300,
              backgroundColor: isDark ? '#1e1e1e' : '#fff',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              borderRadius: '8px',
              boxShadow: isDark
                ? '0 8px 32px rgba(0,0,0,0.5)'
                : '0 8px 32px rgba(0,0,0,0.15)',
            },
          },
        }}
      >
        {editingPart === 'field' && (
          isHasChip ? (
            <List dense sx={{ py: 0.5 }}>
              {([['has', 'has'], ['!has', 'not has']] as const).map(([val, label]) => (
                <ListItemButton
                  key={val}
                  onClick={() => {
                    onUpdate(chip.id, { field: val });
                    handleClose();
                  }}
                  selected={chip.field === val}
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
                      fontWeight: chip.field === val ? 600 : 400,
                    }}
                  />
                  {chip.field === val && (
                    <CheckIcon sx={{ fontSize: 14, ml: 1, color: 'primary.main' }} />
                  )}
                </ListItemButton>
              ))}
            </List>
          ) : (
            <FieldMenu
              domain={domain}
              currentField={chip.field}
              onSelect={handleFieldSelect}
              isDark={isDark}
            />
          )
        )}
        {editingPart === 'operator' && (
          <OperatorMenu
            field={field}
            currentOperator={chip.operator}
            onSelect={handleOperatorSelect}
            isDark={isDark}
          />
        )}
        {editingPart === 'value' && (
          isHasChip ? (
            <HasFieldSelector
              domain={domain}
              facets={facets}
              currentValue={chip.value}
              onSelect={handleValueConfirm}
              isDark={isDark}
            />
          ) : (
            <ValueEditor
              chip={chip}
              facets={facets}
              valueInput={valueInput}
              setValueInput={setValueInput}
              onConfirm={handleValueConfirm}
              isDark={isDark}
            />
          )
        )}
      </Popover>
    </>
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
  const fields = getFieldsForDomain(domain);

  return (
    <List dense sx={{ py: 0.5, maxHeight: 280, overflow: 'auto' }}>
      {fields.map((f) => (
        <ListItemButton
          key={f.key}
          onClick={() => onSelect(f.key)}
          selected={f.key === currentField}
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
              fontWeight: f.key === currentField ? 600 : 400,
            }}
          />
          {f.key === currentField && (
            <CheckIcon sx={{ fontSize: 14, ml: 1, color: 'primary.main' }} />
          )}
        </ListItemButton>
      ))}
    </List>
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

  return (
    <List dense sx={{ py: 0.5 }}>
      {options.map(({ op, label }) => (
        <ListItemButton
          key={op}
          onClick={() => onSelect(op)}
          selected={op === currentOperator}
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
              fontWeight: op === currentOperator ? 600 : 400,
            }}
          />
          {op === currentOperator && (
            <CheckIcon sx={{ fontSize: 14, ml: 1, color: 'primary.main' }} />
          )}
        </ListItemButton>
      ))}
    </List>
  );
}

// ─── Value Editor ────────────────────────────────────────────────────────────

function ValueEditor({
  chip,
  facets,
  valueInput,
  setValueInput,
  onConfirm,
  isDark,
}: {
  chip: FilterChip;
  facets?: Map<string, string[]>;
  valueInput: string;
  setValueInput: (v: string) => void;
  onConfirm: (v: string) => void;
  isDark: boolean;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  // Track whether user has started typing (to decide filtering)
  const [isDirty, setIsDirty] = useState(false);

  const facetValues = facets?.get(chip.field) ?? [];

  // When popover opens, show all values. Once user types, filter by input.
  const filtered =
    isDirty && valueInput !== ''
      ? facetValues.filter((v) =>
          v.toLowerCase().includes(valueInput.toLowerCase())
        )
      : facetValues;

  // Sort: current value first, then rest alphabetically
  const sorted = [...filtered].sort((a, b) => {
    if (a === chip.value) return -1;
    if (b === chip.value) return 1;
    return a.localeCompare(b);
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setValueInput(e.target.value);
    setIsDirty(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onConfirm(valueInput || chip.value);
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onConfirm(chip.value); // revert
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
          ref={inputRef}
          value={valueInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          autoFocus
          fullWidth
          placeholder={chip.value || t('dsl.chip.filterValues', 'Filter values...')}
          sx={{
            fontSize: '0.8rem',
            '& input': { py: 0.25 },
          }}
        />
      </Box>
      {sorted.length > 0 && (
        <List dense sx={{ py: 0.5, maxHeight: 240, overflow: 'auto' }}>
          {sorted.slice(0, 30).map((v) => {
            const isCurrent = v === chip.value;
            return (
              <ListItemButton
                key={v}
                onClick={() => onConfirm(v)}
                selected={isCurrent}
                sx={{
                  py: 0.25,
                  px: 1.5,
                  '&.Mui-selected': {
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
          autoFocus
          fullWidth
          placeholder={t('dsl.chip.filterFields', 'Filter fields...')}
          sx={{
            fontSize: '0.8rem',
            '& input': { py: 0.25 },
          }}
        />
      </Box>
      <List dense sx={{ py: 0.5, maxHeight: 280, overflow: 'auto' }}>
        {sorted.slice(0, 30).map((key) => {
          const isCurrent = key === currentValue;
          const fieldDef = getFieldByKey(key, domain);
          const cat = fieldDef?.category ?? 'attribute';
          const badge = HAS_CATEGORY_BADGES[cat];
          return (
            <ListItemButton
              key={key}
              onClick={() => onSelect(key)}
              selected={isCurrent}
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
                <Box sx={{
                  fontSize: '8px', fontWeight: 700, flexShrink: 0,
                  fontFamily: '"JetBrains Mono", monospace',
                  color: badge.color,
                  backgroundColor: isDark ? badge.bg : badge.bgLight,
                  borderRadius: '3px', px: '3px', py: '1px',
                  lineHeight: 1.3, letterSpacing: '0.02em',
                  minWidth: 22, textAlign: 'center',
                  whiteSpace: 'nowrap',
                }}>
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
                <CheckIcon sx={{ fontSize: 14, ml: 1, color: 'primary.main' }} />
              )}
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
}
