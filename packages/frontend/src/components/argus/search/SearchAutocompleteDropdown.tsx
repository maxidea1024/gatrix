/**
 * SearchAutocompleteDropdown — Sentry-style 3-step autocomplete.
 *
 * Rendered absolutely inside the input container.
 * Parent FilterBar needs z-index to sit above the content area.
 *
 * Step 1: Field selection (grouped by category)
 * Step 2: Operator selection
 * Step 3: Value selection
 */

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { Box, Typography, alpha, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  FIELD_DEFINITIONS,
  CATEGORY_LABELS,
  getFieldDef,
  getOperatorsForField,
  RELATIVE_TIME_PRESETS,
  type FieldCategory,
} from '../FieldDefinitions';

// ─── Types ───────────────────────────────────────────────────────────────

type Step = 'field' | 'operator' | 'value';

interface FieldItem {
  key: string;
  description: string;
  category: FieldCategory;
}

type DropdownRow =
  | { kind: 'header'; label: string; category: FieldCategory }
  | {
      kind: 'item';
      id: string;
      primary: string;
      secondary: string;
      type: 'suggestion' | 'field' | 'operator' | 'value' | 'keyword';
      meta?: Record<string, any>;
    };

export interface AutocompleteSelection {
  field: string;
  operator: string;
  value: string;
}

export interface SearchAutocompleteDropdownHandle {
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
  reset: () => void;
  setEditState: (step: Step, field?: string, operator?: string) => void;
}

interface Props {
  composingText: string;
  fields: string[];
  facets: Record<string, { value: string; count: number }[]>;
  open: boolean;
  anchorEl: HTMLElement | null;
  isDark: boolean;
  onSelect: (selection: AutocompleteSelection) => void;
  onSelectField?: (field: string) => void;
  onSelectOperator?: (operator: string) => void;
  hasExplicitFields?: boolean;
  /** When editing a chip part, restricts dropdown to only that context */
  editingPart?: 'field' | 'operator' | 'value' | null;
  /** Whether there are existing tokens (chips). Keywords like AND/OR only show when true */
  hasTokens?: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<FieldCategory | 'logic', string> = {
  log: '#8b5cf6',
  resource: '#06b6d4',
  trace: '#f59e0b',
  event: '#ef4444',
  user: '#10b981',
  custom: '#6b7280',
  logic: '#f59e0b', // orange
};

const CATEGORY_ORDER: (FieldCategory | 'logic')[] = [
  'logic',
  'log',
  'resource',
  'trace',
  'event',
  'user',
  'custom',
];

// ─── Component ───────────────────────────────────────────────────────────

export const SearchAutocompleteDropdown = forwardRef<
  SearchAutocompleteDropdownHandle,
  Props
>(
  (
    {
      composingText,
      fields,
      facets,
      open,
      anchorEl,
      isDark,
      onSelect,
      onSelectField,
      onSelectOperator,
      hasExplicitFields,
      editingPart,
      hasTokens,
    },
    ref
  ) => {
    const theme = useTheme();
    const { t } = useTranslation();
    const [step, setStep] = useState<Step>('field');
    const [selectedField, setSelectedField] = useState('');
    const [selectedOperator, setSelectedOperator] = useState('');
    const [highlightIdx, setHighlightIdx] = useState(-1);
    const listRef = useRef<HTMLDivElement>(null);

    // Reset on reopen
    const prevOpenRef = useRef(open);
    useEffect(() => {
      if (open && !prevOpenRef.current) {
        setStep('field');
        setSelectedField('');
        setSelectedOperator('');
        setHighlightIdx(-1);
      }
      prevOpenRef.current = open;
    }, [open]);

    useEffect(() => {
      setHighlightIdx(-1);
    }, [composingText]);

    // ─── Field items ───
    const fieldItems = useMemo((): FieldItem[] => {
      const seen = new Set<string>();
      const items: FieldItem[] = [];
      for (const f of fields) {
        if (seen.has(f)) continue;
        seen.add(f);
        const def = getFieldDef(f);
        if (def.aliasFor) continue;
        items.push({
          key: f,
          description: t(def.description),
          category: def.category,
        });
      }

      // Only merge default predefined fields if the parent didn't pass explicit fields
      if (!hasExplicitFields) {
        for (const [key, def] of Object.entries(FIELD_DEFINITIONS)) {
          if (seen.has(key) || def.aliasFor) continue;
          seen.add(key);
          items.push({
            key,
            description: t(def.description),
            category: def.category,
          });
        }
      }
      return items;
    }, [fields, hasExplicitFields, t]);

    // ─── Build rows ───
    const { rows, selectableIndices } = useMemo(() => {
      // IME composition: composingText may contain "field:value" prefix.
      // In field step, use full text. In operator/value steps, extract just the part after ':'.
      const rawText = composingText.trim().toLowerCase();
      const trimmed =
        step === 'field'
          ? rawText
          : rawText.includes(':')
            ? rawText.slice(rawText.indexOf(':') + 1).replace(/^["']/, '')
            : rawText;
      const allRows: DropdownRow[] = [];
      const selectable: number[] = [];

      if (step === 'field') {
        // Message suggestions (non-empty, non-colon text)
        if (trimmed && !trimmed.includes(':')) {
          allRows.push({
            kind: 'item',
            id: 'msg-contains',
            primary: `message contains "${trimmed}"`,
            secondary: t(
              'argus.search.messageContains',
              'Search text contained in messages'
            ),
            type: 'suggestion',
          });
          selectable.push(allRows.length - 1);
        }

        // Group fields by category
        const filtered = trimmed
          ? fieldItems.filter(
              (f) =>
                f.key.toLowerCase().includes(trimmed) ||
                f.description.toLowerCase().includes(trimmed)
            )
          : fieldItems;

        const groups = new Map<FieldCategory, FieldItem[]>();
        for (const f of filtered) {
          if (!groups.has(f.category)) groups.set(f.category, []);
          groups.get(f.category)!.push(f);
        }

        for (const cat of CATEGORY_ORDER) {
          if (cat === 'logic') continue; // logic items are handled above, not from field groups
          const items = groups.get(cat as FieldCategory);
          if (!items || items.length === 0) continue;
          allRows.push({
            kind: 'header',
            label: t(CATEGORY_LABELS[cat as FieldCategory]),
            category: cat as FieldCategory,
          });
          for (const f of items) {
            allRows.push({
              kind: 'item',
              id: `field-${f.key}`,
              primary: f.key,
              secondary: f.description,
              type: 'field',
              meta: { category: f.category },
            });
            selectable.push(allRows.length - 1);
          }
        }
      } else if (step === 'operator') {
        const operators = getOperatorsForField(selectedField);
        for (const op of operators) {
          allRows.push({
            kind: 'item',
            id: `op-${op.value}`,
            primary: t(op.label),
            secondary: op.shortLabel,
            type: 'operator',
            meta: { value: op.value },
          });
          selectable.push(allRows.length - 1);
        }
      } else if (step === 'value') {
        const fieldDef = getFieldDef(selectedField);
        if (fieldDef.type === 'date') {
          for (const p of RELATIVE_TIME_PRESETS) {
            allRows.push({
              kind: 'item',
              id: `time-${p.value}`,
              primary: t(p.label),
              secondary: p.value,
              type: 'value',
            });
            selectable.push(allRows.length - 1);
          }
        } else if (fieldDef.type === 'boolean') {
          for (const v of ['true', 'false']) {
            allRows.push({
              kind: 'item',
              id: `val-${v}`,
              primary: v,
              secondary: '',
              type: 'value',
            });
            selectable.push(allRows.length - 1);
          }
        } else {
          const vals = facets[selectedField] || [];
          const total = vals.reduce((s, v) => s + v.count, 0);
          const filtered = trimmed
            ? vals.filter((v) => v.value.toLowerCase().includes(trimmed))
            : vals;
          for (const v of filtered.slice(0, 20)) {
            allRows.push({
              kind: 'item',
              id: `val-${v.value}`,
              primary: v.value,
              secondary:
                total > 0 ? `${((v.count / total) * 100).toFixed(0)}%` : '',
              type: 'value',
              meta: { count: v.count, total },
            });
            selectable.push(allRows.length - 1);
          }
          // If composingText has content, offer to use it directly
          if (
            trimmed &&
            !filtered.some((v) => v.value.toLowerCase() === trimmed)
          ) {
            allRows.push({
              kind: 'item',
              id: 'val-custom',
              primary: `"${composingText.trim()}"`,
              secondary: t('argus.search.useThisValue', 'Use this value'),
              type: 'value',
            });
            selectable.push(allRows.length - 1);
          }
        }
      }

      return { rows: allRows, selectableIndices: selectable };
    }, [
      step,
      composingText,
      selectedField,
      selectedOperator,
      fieldItems,
      facets,
      t,
    ]);

    useEffect(() => {
      if (highlightIdx >= selectableIndices.length) setHighlightIdx(-1);
    }, [selectableIndices.length, highlightIdx]);

    useEffect(() => {
      if (
        highlightIdx >= 0 &&
        listRef.current &&
        selectableIndices.length > 0
      ) {
        const rowIdx = selectableIndices[highlightIdx];
        const el = listRef.current.children[rowIdx] as HTMLElement;
        if (el) el.scrollIntoView({ block: 'nearest' });
      }
    }, [highlightIdx, selectableIndices]);

    // ─── Select ───
    const handleSelectItem = useCallback(
      (selectIdx: number) => {
        if (selectIdx < 0 || selectIdx >= selectableIndices.length) return;
        const rowIdx = selectableIndices[selectIdx];
        const row = rows[rowIdx];
        if (!row || row.kind !== 'item') return;

        const resetState = () => {
          setStep('field');
          setSelectedField('');
          setSelectedOperator('');
          setHighlightIdx(-1);
        };

        if (step === 'field') {
          if (row.type === 'keyword') {
            onSelect({ field: '__logic__', operator: '', value: row.primary });
            resetState();
            return;
          }
          if (row.type === 'suggestion') {
            const op = row.id === 'msg-contains' ? 'contains' : 'is';
            onSelect({
              field: 'message',
              operator: op,
              value: composingText.trim(),
            });
            resetState();
            return;
          }
          // Edit mode: only replace the field, don't advance
          if (editingPart === 'field') {
            onSelect({ field: row.primary, operator: '', value: '' });
            resetState();
            return;
          }
          setSelectedField(row.primary);
          setStep('operator');
          setHighlightIdx(-1);
          onSelectField?.(row.primary);
          return;
        }

        if (step === 'operator') {
          const opValue = row.meta?.value || row.primary;
          // Edit mode: only replace the operator, don't advance to value
          if (editingPart === 'operator') {
            onSelect({ field: selectedField, operator: opValue, value: '' });
            resetState();
            return;
          }
          setSelectedOperator(opValue);
          setStep('value');
          setHighlightIdx(-1);
          onSelectOperator?.(opValue);
          return;
        }

        if (step === 'value') {
          const value =
            getFieldDef(selectedField).type === 'date' && row.secondary
              ? row.secondary
              : row.primary;
          onSelect({ field: selectedField, operator: selectedOperator, value });
          resetState();
        }
      },
      [
        step,
        rows,
        selectableIndices,
        selectedField,
        selectedOperator,
        composingText,
        onSelect,
        onSelectField,
        onSelectOperator,
        editingPart,
      ]
    );

    // ─── Keyboard ───
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent): boolean => {
        if (!open || selectableIndices.length === 0) return false;

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setHighlightIdx((i) => (i + 1) % selectableIndices.length);
          return true;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setHighlightIdx((i) =>
            i <= 0 ? selectableIndices.length - 1 : i - 1
          );
          return true;
        }

        // Enter/Tab only intercept when something is highlighted
        if (e.key === 'Tab' && highlightIdx >= 0) {
          e.preventDefault();
          handleSelectItem(highlightIdx);
          return true;
        }
        if (e.key === 'Enter' && highlightIdx >= 0) {
          e.preventDefault();
          handleSelectItem(highlightIdx);
          return true;
        }

        if (e.key === 'Escape') {
          if (step === 'value') {
            setStep('operator');
            setHighlightIdx(-1);
            return true;
          }
          if (step === 'operator') {
            setStep('field');
            setSelectedField('');
            setHighlightIdx(-1);
            return true;
          }
          return true;
        }
        return false;
      },
      [open, selectableIndices.length, highlightIdx, handleSelectItem, step]
    );

    useImperativeHandle(ref, () => ({
      handleKeyDown,
      reset: () => {
        setStep('field');
        setSelectedField('');
        setSelectedOperator('');
        setHighlightIdx(-1);
      },
      setEditState: (s, f, o) => {
        setStep(s);
        if (f) setSelectedField(f);
        if (o) setSelectedOperator(o);
        setHighlightIdx(-1);
      },
    }));

    // On field step, hide if nothing to show. On operator/value steps, always show (breadcrumb + hint).
    if (!open || !anchorEl) return null;
    if (step === 'field' && selectableIndices.length === 0) return null;

    // ─── Breadcrumb ───
    const breadcrumb =
      step !== 'field' ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1.5,
            py: 0.6,
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}
        >
          <Box
            onClick={() => {
              if (step === 'value') {
                setStep('operator');
                setHighlightIdx(-1);
              } else {
                setStep('field');
                setSelectedField('');
                setHighlightIdx(-1);
              }
            }}
            sx={{
              cursor: 'pointer',
              color: 'text.disabled',
              fontSize: '0.72rem',
              '&:hover': { color: 'text.primary' },
              mr: 0.25,
            }}
          >
            ←
          </Box>
          <Box
            sx={{
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              fontWeight: 600,
              fontSize: '0.75rem',
              color:
                CATEGORY_COLORS[getFieldDef(selectedField).category] ||
                theme.palette.primary.main,
            }}
          >
            {selectedField}
          </Box>
          {step === 'value' && (
            <Box
              sx={{
                color: 'text.disabled',
                fontSize: '0.7rem',
                fontFamily: 'monospace',
              }}
            >
              {getOperatorsForField(selectedField).find(
                (o) => o.value === selectedOperator
              )?.shortLabel || selectedOperator}
            </Box>
          )}
          <Box sx={{ ml: 'auto', color: 'text.disabled', fontSize: '0.62rem' }}>
            {step === 'operator'
              ? t('argus.search.selectOperator', 'Select operator')
              : t('argus.search.enterValue', 'Enter value')}
          </Box>
        </Box>
      ) : null;

    return (
      <Box
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
        sx={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          mt: 0.5,
          zIndex: 9999,
          maxHeight: 360,
          overflow: 'auto',
          borderRadius: '8px',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          background: isDark ? '#1e1e1e' : '#ffffff',
          boxShadow: isDark
            ? '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)'
            : '0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
          py: 0.5,
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.12)'
              : 'rgba(0,0,0,0.12)',
            borderRadius: 2,
          },
          '&::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
        }}
      >
        {breadcrumb}

        <Box ref={listRef} sx={{ py: 0.25 }}>
          {rows.map((row, rowIdx) => {
            if (row.kind === 'header') {
              return (
                <Box
                  key={`hdr-${row.category}`}
                  sx={{
                    px: 1.5,
                    py: 0.35,
                    mt: rowIdx > 0 ? 0.4 : 0,
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: alpha(CATEGORY_COLORS[row.category], 0.7),
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.6,
                    userSelect: 'none',
                  }}
                >
                  <Box
                    sx={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      backgroundColor: CATEGORY_COLORS[row.category],
                      opacity: 0.5,
                    }}
                  />
                  {row.label}
                </Box>
              );
            }

            const selectIdx = selectableIndices.indexOf(rowIdx);
            const isHighlighted = selectIdx === highlightIdx;

            return (
              <Box
                key={row.id}
                onClick={() => handleSelectItem(selectIdx)}
                onMouseEnter={() => setHighlightIdx(selectIdx)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 1.5,
                  py: 0.45,
                  cursor: 'pointer',
                  borderRadius: '4px',
                  mx: 0.5,
                  backgroundColor: isHighlighted
                    ? isDark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(0,0,0,0.04)'
                    : 'transparent',
                  transition: 'background-color 0.06s',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.6,
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  {row.type === 'field' && row.meta?.category && (
                    <Box
                      sx={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        flexShrink: 0,
                        backgroundColor:
                          CATEGORY_COLORS[row.meta.category as FieldCategory] ||
                          '#888',
                      }}
                    />
                  )}
                  {row.type === 'keyword' && (
                    <Box
                      sx={{
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        color: '#f59e0b',
                        backgroundColor: 'rgba(245,158,11,0.1)',
                        px: 0.4,
                        borderRadius: '2px',
                        flexShrink: 0,
                      }}
                    >
                      KW
                    </Box>
                  )}
                  <Typography
                    component="span"
                    sx={{
                      fontFamily:
                        row.type === 'field' || row.type === 'keyword'
                          ? '"JetBrains Mono", "Fira Code", monospace'
                          : 'inherit',
                      fontWeight:
                        row.type === 'suggestion'
                          ? 500
                          : row.type === 'field'
                            ? 600
                            : 400,
                      fontSize: '0.76rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      color:
                        row.type === 'suggestion'
                          ? theme.palette.primary.main
                          : 'text.primary',
                    }}
                  >
                    {row.primary}
                  </Typography>
                  {row.secondary &&
                    row.type !== 'value' &&
                    row.type !== 'operator' && (
                      <Typography
                        component="span"
                        sx={{
                          color: 'text.disabled',
                          fontSize: '0.65rem',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flexShrink: 1,
                        }}
                      >
                        {row.secondary}
                      </Typography>
                    )}
                </Box>

                {row.type === 'operator' && row.secondary && (
                  <Box
                    sx={{
                      fontSize: '0.68rem',
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      color: 'text.disabled',
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(0,0,0,0.04)',
                      px: 0.6,
                      py: 0.1,
                      borderRadius: '3px',
                      ml: 1,
                    }}
                  >
                    {row.secondary}
                  </Box>
                )}

                {row.type === 'value' && row.meta?.total > 0 && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      flexShrink: 0,
                      ml: 1,
                    }}
                  >
                    <Box
                      sx={{
                        width: 36,
                        height: 3,
                        borderRadius: 2,
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(0,0,0,0.06)',
                        overflow: 'hidden',
                      }}
                    >
                      <Box
                        sx={{
                          width: `${(row.meta.count / row.meta.total) * 100}%`,
                          height: '100%',
                          borderRadius: 2,
                          backgroundColor: theme.palette.primary.main,
                        }}
                      />
                    </Box>
                    <Typography
                      sx={{
                        fontSize: '0.58rem',
                        color: 'text.disabled',
                        minWidth: 24,
                        textAlign: 'right',
                      }}
                    >
                      {row.secondary}
                    </Typography>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>

        {/* Footer keyboard hints */}
        <Box
          sx={{
            display: 'flex',
            gap: 1.5,
            px: 1.5,
            py: 0.4,
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            mt: 0.25,
          }}
        >
          {[
            { key: '↑↓', label: t('argus.search.hint.navigate', 'navigate') },
            { key: 'Tab', label: t('argus.search.hint.select', 'select') },
            {
              key: 'Esc',
              label:
                step !== 'field'
                  ? t('argus.search.hint.back', 'back')
                  : t('argus.search.hint.close', 'close'),
            },
          ].map((h) => (
            <Box
              key={h.key}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.35 }}
            >
              <Box
                sx={{
                  fontSize: '0.58rem',
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.07)'
                    : 'rgba(0,0,0,0.05)',
                  color: 'text.disabled',
                  px: 0.4,
                  py: 0.1,
                  borderRadius: '3px',
                  lineHeight: 1.3,
                }}
              >
                {h.key}
              </Box>
              <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>
                {h.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    );
  }
);

SearchAutocompleteDropdown.displayName = 'SearchAutocompleteDropdown';
export default SearchAutocompleteDropdown;
