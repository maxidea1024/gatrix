import React, { useState, useEffect, useRef, useMemo, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Box, Typography, Popover, Divider, useTheme, alpha } from '@mui/material';
import { useTranslation } from 'react-i18next';

export interface SearchAutocompleteFacet {
  value: string;
  count: number;
}

export interface SearchAutocompletePopoverProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  query: string;
  fields: string[];
  facets: Record<string, SearchAutocompleteFacet[]>;
  isDark: boolean;
  onSelectTag: (field: string, value: string) => void;
  onSelectField: (field: string) => void;
  onSelectSyntax: (syntax: string) => void;
  onClose: () => void;
  recentSearches?: string[];
  onClearRecentSearches?: () => void;
  onSelectRecentSearch?: (query: string) => void;
}

/** Imperative handle for keyboard navigation from parent input */
export interface SearchAutocompletePopoverHandle {
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
}

/* ─── Item types for flat list ─── */
interface AutocompleteItem {
  key: string;
  type: 'recent' | 'syntax' | 'field' | 'value' | 'has-field';
  label: string;
  action: () => void;
  fieldKey?: string;
  count?: number;
  pct?: number;
  sublabel?: string;
}

const SearchAutocompletePopover = forwardRef<SearchAutocompletePopoverHandle, SearchAutocompletePopoverProps>((
  { open, anchorEl, query, fields, facets, isDark, onSelectTag, onSelectField, onSelectSyntax, onClose,
    recentSearches = [], onClearRecentSearches, onSelectRecentSearch },
  ref
) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const highlightedRef = useRef<HTMLDivElement>(null);

  // ─── Editing Context State Machine ───
  type EditingContext =
    | { state: 'empty' }
    | { state: 'typing_field'; partial: string }
    | { state: 'typing_value'; field: string; partial: string }
    | { state: 'has_field'; partial: string }
    | { state: 'after_condition' }
    | { state: 'after_operator' }
    | { state: 'completed_value' }

  const TOKEN_RE_SRC = /(!?[\w.-]+:(?:"[^"]*"|'[^']*'|"[^"]*$|'[^']*$|\S+))|(\bAND\b|\bOR\b)|(\S+)/g.source;

  const getEditingContext = useCallback((q: string): EditingContext => {
    if (!q.trim()) return { state: 'empty' };

    // Check for key:value at end (actively editing a value)
    const colonMatch = q.match(/([\w.-]+):([^\s]*)$/);
    if (colonMatch) {
      const [, field, val] = colonMatch;
      if ((val.startsWith('"') && val.endsWith('"') && val.length >= 2) ||
          (val.startsWith("'") && val.endsWith("'") && val.length >= 2)) {
        return { state: 'completed_value' };
      }
      if (field === 'has') return { state: 'has_field', partial: val.toLowerCase() };
      return { state: 'typing_value', field, partial: val.replace(/^["']/, '').toLowerCase() };
    }

    // Tokenize
    const tokens: string[] = [];
    let m: RegExpExecArray | null;
    const re = new RegExp(TOKEN_RE_SRC, 'g');
    while ((m = re.exec(q)) !== null) tokens.push(m[0]);

    if (/\s$/.test(q)) {
      // New token position (trailing space)
      const last = (tokens[tokens.length - 1] || '').toUpperCase();
      if (last === 'AND' || last === 'OR') return { state: 'after_operator' };
      if (tokens.length > 0) return { state: 'after_condition' };
      return { state: 'empty' };
    }

    // Typing something (no trailing space) → last token is being edited
    const lastToken = (tokens[tokens.length - 1] || '').toLowerCase();
    return { state: 'typing_field', partial: lastToken };
  }, []);

  const editingContext = useMemo(() => getEditingContext(query), [query, getEditingContext]);

  // ─── Should show popover ───
  const shouldShowPopover = useMemo(() => {
    if (!open || !anchorEl) return false;
    if (editingContext.state === 'completed_value') return false;
    // If typing a field and nothing matches, hide
    if (editingContext.state === 'typing_field') {
      const p = editingContext.partial;
      const anyField = fields.some(f => f.toLowerCase().includes(p));
      const anySyntax = ['and', 'or'].some(s => s.includes(p));
      const anyHas = 'has'.includes(p);
      if (!anyField && !anySyntax && !anyHas) return false;
    }
    return true;
  }, [open, anchorEl, editingContext, fields]);

  // ─── Compute items ───
  const items = useMemo((): AutocompleteItem[] => {
    if (!shouldShowPopover) return [];
    const result: AutocompleteItem[] = [];
    const ctx = editingContext;

    const addAllFields = () => {
      fields.forEach(f => result.push({ key: `field-${f}`, type: 'field', label: f, action: () => onSelectField(f) }));
      result.push({ key: 'field-has', type: 'has-field', label: 'has', sublabel: t('argus.discover.hasDesc', 'Find events with this tag'), action: () => onSelectField('has') });
    };

    switch (ctx.state) {
      case 'empty': {
        if (recentSearches.length > 0) {
          recentSearches.slice(0, 5).forEach((q, i) => {
            result.push({ key: `recent-${i}`, type: 'recent', label: q, action: () => onSelectRecentSearch?.(q) });
          });
        }
        addAllFields();
        break;
      }

      case 'typing_field': {
        const p = ctx.partial;
        // Tokenize to decide whether AND/OR is relevant
        const re = new RegExp(TOKEN_RE_SRC, 'g');
        const tokens: string[] = [];
        let m: RegExpExecArray | null;
        while ((m = re.exec(query)) !== null) tokens.push(m[0]);
        const completed = tokens.slice(0, -1);
        const lastCompUpper = (completed[completed.length - 1] || '').toUpperCase();
        const isAfterOp = lastCompUpper === 'AND' || lastCompUpper === 'OR';
        const isExactOp = p.toUpperCase() === 'AND' || p.toUpperCase() === 'OR';

        // AND/OR: show only if prior condition exists, prior isn't operator, and user hasn't fully typed it
        if (completed.length > 0 && !isAfterOp && !isExactOp) {
          ['AND', 'OR'].filter(s => s.toLowerCase().includes(p)).forEach(s => {
            result.push({ key: `syntax-${s}`, type: 'syntax', label: s, action: () => onSelectSyntax(s) });
          });
        }

        // Filtered fields
        fields.filter(f => f.toLowerCase().includes(p)).forEach(f => {
          result.push({ key: `field-${f}`, type: 'field', label: f, action: () => onSelectField(f) });
        });
        if ('has'.includes(p)) {
          result.push({ key: 'field-has', type: 'has-field', label: 'has', sublabel: t('argus.discover.hasDesc', 'Find events with this tag'), action: () => onSelectField('has') });
        }
        break;
      }

      case 'typing_value': {
        const values = (facets[ctx.field] || []) as SearchAutocompleteFacet[];
        const filtered = ctx.partial ? values.filter(v => v.value?.toLowerCase().includes(ctx.partial)) : values;
        const totalCount = filtered.reduce((s, x) => s + x.count, 0);
        filtered.slice(0, 15).forEach(v => {
          result.push({
            key: `val-${v.value}`, type: 'value' as const, label: v.value || '(empty)', fieldKey: ctx.field,
            count: v.count, pct: totalCount > 0 ? (v.count / totalCount) * 100 : 0,
            action: () => onSelectTag(ctx.field, v.value),
          });
        });
        break;
      }

      case 'has_field': {
        const matched = ctx.partial ? fields.filter(f => f.toLowerCase().includes(ctx.partial)) : fields;
        matched.forEach(f => result.push({ key: `has-${f}`, type: 'has-field' as const, label: f, action: () => onSelectTag('has', f) }));
        break;
      }

      case 'after_condition': {
        ['AND', 'OR'].forEach(s => result.push({ key: `syntax-${s}`, type: 'syntax', label: s, action: () => onSelectSyntax(s) }));
        addAllFields();
        break;
      }

      case 'after_operator': {
        addAllFields();
        break;
      }
    }

    return result;
  }, [shouldShowPopover, editingContext, query, fields, facets, recentSearches, t, onSelectTag, onSelectField, onSelectSyntax, onSelectRecentSearch]);

  // Reset highlight when query changes
  useEffect(() => setHighlightedIndex(-1), [query]);

  // Scroll highlighted item into view
  useEffect(() => {
    highlightedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  // ─── Keyboard handler (exposed via ref) ───
  useImperativeHandle(ref, () => ({
    handleKeyDown(e: React.KeyboardEvent): boolean {
      if (!shouldShowPopover || items.length === 0) return false;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex(i => (i + 1) % items.length);
        return true;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(i => (i <= 0 ? items.length - 1 : i - 1));
        return true;
      }
      if (e.key === 'Escape') {
        onClose();
        return true;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && highlightedIndex >= 0 && highlightedIndex < items.length) {
        e.preventDefault();
        items[highlightedIndex].action();
        setHighlightedIndex(-1);
        return true;
      }
      return false;
    }
  }), [shouldShowPopover, items, highlightedIndex, onClose]);

  // ─── Render helpers ───
  const itemBaseSx = {
    px: 1.5, py: 0.5, cursor: 'pointer', borderRadius: '4px', fontSize: '0.78rem',
    '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.08) },
  };

  const renderItemBox = (item: AutocompleteItem, idx: number, children: React.ReactNode, extraSx?: any) => (
    <Box
      key={item.key}
      ref={highlightedIndex === idx ? highlightedRef : undefined}
      onClick={item.action}
      sx={{
        ...itemBaseSx,
        ...(highlightedIndex === idx && { backgroundColor: alpha(theme.palette.primary.main, 0.12) }),
        ...extraSx,
      }}
    >
      {children}
    </Box>
  );

  // ─── Section header tracking for grouped rendering ───
  const renderItems = () => {
    if (items.length === 0) return null;

    const elements: React.ReactNode[] = [];
    let prevType: string | null = null;

    items.forEach((item, idx) => {
      // Insert section headers on type change
      if (item.type !== prevType) {
        if (prevType === 'recent') {
          elements.push(<Divider key="div-recent" sx={{ my: 0.5 }} />);
        }

        let headerText = '';
        switch (item.type) {
          case 'recent':
            // Recent header with clear button
            elements.push(
              <Box key="hdr-recent" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1, mb: 0.5, mt: 0.5 }}>
                <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600 }}>
                  {t('argus.logs.recentSearches', 'Recent searches')}
                </Typography>
                {onClearRecentSearches && (
                  <Typography variant="caption" onClick={onClearRecentSearches}
                    sx={{ color: theme.palette.primary.main, cursor: 'pointer', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}>
                    {t('argus.logs.clearAll', 'Clear all')}
                  </Typography>
                )}
              </Box>
            );
            break;
          case 'syntax':
            headerText = t('argus.discover.syntax', 'Syntax');
            break;
          case 'field':
            headerText = t('argus.discover.suggestions', 'Suggested Fields');
            break;
          case 'value':
            headerText = `${item.fieldKey} ${t('argus.discover.values', 'values')}`;
            break;
          case 'has-field':
            // Add divider before has section when it follows other items
            if (prevType && prevType !== 'has-field') {
              elements.push(<Divider key="div-has" sx={{ my: 0.5 }} />);
            }
            headerText = t('argus.discover.special', 'Special');
            break;
        }

        if (headerText) {
          elements.push(
            <Typography key={`hdr-${item.type}`} variant="caption"
              sx={{ px: 1, color: 'text.disabled', fontWeight: 600, display: 'block', mb: 0.5, mt: prevType ? 0.5 : 0 }}>
              {headerText}
            </Typography>
          );
        }
        prevType = item.type;
      }

      // Render item by type
      switch (item.type) {
        case 'recent':
          elements.push(renderItemBox(item, idx,
            <Typography sx={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.label}
            </Typography>,
          ));
          break;

        case 'syntax':
          elements.push(renderItemBox(item, idx,
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>{item.label}</Typography>,
            {
              display: 'inline-block', mr: 1,
              backgroundColor: highlightedIndex === idx
                ? alpha(theme.palette.primary.main, 0.2)
                : alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            },
          ));
          break;

        case 'field':
          elements.push(renderItemBox(item, idx, <>
            <span style={{ color: theme.palette.primary.main }}>{item.label}</span>:
            {item.sublabel && (
              <span style={{ color: 'inherit', fontSize: '0.7rem', marginLeft: 8, opacity: 0.5 }}>{item.sublabel}</span>
            )}
          </>));
          break;

        case 'has-field':
          elements.push(renderItemBox(item, idx,
            <span style={{ color: theme.palette.primary.main, fontWeight: 600 }}>{item.label}</span>,
          ));
          break;

        case 'value':
          elements.push(
            <Box
              key={item.key}
              ref={highlightedIndex === idx ? highlightedRef : undefined}
              onClick={item.action}
              sx={{
                position: 'relative', px: 1.5, py: 0.5, cursor: 'pointer', borderRadius: '4px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', overflow: 'hidden',
                ...(highlightedIndex === idx && { backgroundColor: alpha(theme.palette.primary.main, 0.12) }),
                '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.08) },
              }}
            >
              {/* Percentage bar */}
              <Box sx={{
                position: 'absolute', left: 8, top: 2, bottom: 2,
                width: `${item.pct || 0}%`, minWidth: (item.pct || 0) > 0 ? 4 : 0,
                backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.12),
                borderRadius: '0 3px 3px 0', transition: 'width 0.3s ease',
              }} />
              <Typography sx={{ zIndex: 1, fontSize: '0.78rem', color: theme.palette.primary.main, fontWeight: 600 }}>
                {item.label}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, zIndex: 1 }}>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: theme.palette.primary.main }}>
                  {(item.pct || 0).toFixed(0)}%
                </Typography>
                <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled' }}>
                  {(item.count || 0).toLocaleString()}
                </Typography>
              </Box>
            </Box>
          );
          break;
      }
    });

    // Wrap syntax items in a flex container
    // Find consecutive syntax items and wrap them
    const finalElements: React.ReactNode[] = [];
    let syntaxBuffer: React.ReactNode[] = [];
    let inSyntax = false;

    for (const el of elements) {
      const elKey = (el as any)?.key as string | undefined;
      if (elKey?.startsWith('syntax-')) {
        syntaxBuffer.push(el);
        inSyntax = true;
      } else {
        if (inSyntax && syntaxBuffer.length > 0) {
          finalElements.push(
            <Box key="syntax-wrap" sx={{ display: 'flex', gap: 1, px: 1, mb: 1 }}>
              {syntaxBuffer}
            </Box>
          );
          syntaxBuffer = [];
          inSyntax = false;
        }
        finalElements.push(el);
      }
    }
    // Flush remaining syntax items
    if (syntaxBuffer.length > 0) {
      finalElements.push(
        <Box key="syntax-wrap" sx={{ display: 'flex', gap: 1, px: 1, mb: 1 }}>
          {syntaxBuffer}
        </Box>
      );
    }

    return finalElements;
  };

  return (
    <Popover
      open={shouldShowPopover && items.length > 0}
      anchorEl={anchorEl}
      onClose={onClose}
      disableAutoFocus
      disableEnforceFocus
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{
        paper: {
          sx: {
            width: anchorEl?.offsetWidth || 300,
            mt: 0.5, borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            maxHeight: 320, overflow: 'auto',
          },
        },
      }}
    >
      <Box sx={{ p: 1 }}>
        {renderItems()}
      </Box>
    </Popover>
  );
});

SearchAutocompletePopover.displayName = 'SearchAutocompletePopover';

export default SearchAutocompletePopover;
