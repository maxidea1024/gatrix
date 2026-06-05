import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Box, Typography, Paper, Chip, InputBase, alpha, Tooltip, IconButton, Popover } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Search as SearchIcon, Close as CloseIcon } from '@mui/icons-material';
import SafeTooltip from '@/components/common/SafeTooltip';
import ArgusQueryBuilder from '@/components/argus/ArgusQueryBuilder';
import { FilterList as FilterIcon } from '@mui/icons-material';

import SearchAutocompletePopover, { SearchAutocompletePopoverHandle } from './SearchAutocompletePopover';

const RECENT_KEY = 'argusLogs.recentSearch';

export const ArgusSearchInput: React.FC<{
  initialValue: string;
  onDebouncedChange: (val: string) => void;
  onSubmit: (val: string) => void;
  isDark: boolean;
  theme: any;
  mappedFacets: any;
  activeFilters?: any[];
}> = ({ initialValue, onDebouncedChange, onSubmit, isDark, theme, mappedFacets, activeFilters }) => {
  const { t } = useTranslation();
  const [localSearch, setLocalSearch] = useState(initialValue);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<SearchAutocompletePopoverHandle>(null);
  const [builderAnchorEl, setBuilderAnchorEl] = useState<HTMLElement | null>(null);

  // Recent searches (persisted in localStorage)
  const RECENT_KEY = 'argus_recent_log_searches';
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    } catch { return []; }
  });

  const saveRecentSearch = (q: string) => {
    if (!q.trim()) return;
    setRecentSearches(prev => {
      const next = [q.trim(), ...prev.filter(p => p !== q.trim())].slice(0, 10);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_KEY);
  };

  useEffect(() => {
    setLocalSearch(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onDebouncedChange(localSearch);
    }, 400);
    return () => clearTimeout(timer);
  }, [localSearch, onDebouncedChange]);

  /* ─── Chip-based search input ─── */
  const inputRef = useRef<HTMLInputElement>(null);

  /** Tokenize query into completed chips + editable remainder */
  interface SearchChip {
    type: 'filter' | 'negated' | 'has' | 'operator' | 'text';
    raw: string;
    key?: string;
    value?: string;
  }

  const { chips, remainder, chipsText } = useMemo(() => {
    const chipList: SearchChip[] = [];
    // Match key:"complete", key:'complete', key:"incomplete..., key:unquoted, AND, OR
    const re = /(!?[\w.-]+:(?:"[^"]*"|'[^']*'|"[^"]*$|'[^']*$|\S+))|(\bAND\b|\bOR\b)/g;
    let lastIdx = 0;
    let match: RegExpExecArray | null;
    const text = localSearch;

    while ((match = re.exec(text)) !== null) {
      // Free text between tokens
      const gap = text.slice(lastIdx, match.index).trim();
      if (gap) chipList.push({ type: 'text', raw: gap });

      if (match[1]) {
        const tok = match[1];
        const isNeg = tok.startsWith('!') || tok.startsWith('-');
        const clean = isNeg ? tok.slice(1) : tok;
        const ci = clean.indexOf(':');
        const key = clean.slice(0, ci);
        let val = clean.slice(ci + 1);
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);

        if (key === 'has') {
          chipList.push({ type: 'has', raw: tok, key: 'has', value: val });
        } else {
          // Completed if: quoted value OR unquoted value (no opening quote) followed by space
          const rawVal = clean.slice(ci + 1);
          const isQuoted = (rawVal.startsWith('"') && rawVal.endsWith('"') && rawVal.length >= 2)
            || (rawVal.startsWith("'") && rawVal.endsWith("'") && rawVal.length >= 2);
          const startsWithQuote = rawVal.startsWith('"') || rawVal.startsWith("'");
          const matchEnd = match.index + match[0].length;
          const hasTrailingSpace = matchEnd < text.length && text[matchEnd] === ' ';
          const isComplete = isQuoted || (!startsWithQuote && rawVal.length > 0 && hasTrailingSpace);
          if (isComplete) {
            chipList.push({ type: isNeg ? 'negated' : 'filter', raw: tok, key, value: val });
          } else {
            // Not completed yet (e.g. severity: with no value) — leave as remainder
            break;
          }
        }
      } else if (match[2]) {
        chipList.push({ type: 'operator', raw: match[2] });
      }
      lastIdx = match.index + match[0].length;
    }

    const rem = text.slice(lastIdx).trimStart();
    const ct = chipList.map(c => c.raw).join(' ');
    return { chips: chipList, remainder: rem, chipsText: ct };
  }, [localSearch]);

  /** Remove a chip by index */
  const removeChip = (idx: number) => {
    const newChips = chips.filter((_, i) => i !== idx);
    const newChipsText = newChips.map(c => c.raw).join(' ');
    const newQuery = (newChipsText ? newChipsText + ' ' : '') + remainder;
    const final = newQuery.trim();
    setLocalSearch(final);
    onSubmit(final);
  };

  /** Update localSearch by replacing the remainder portion */
  const updateRemainder = (newRemainder: string) => {
    const newQuery = ((chipsText ? chipsText + ' ' : '') + newRemainder).replace(/ {2,}/g, ' ');
    setLocalSearch(newQuery);
    setSearchFocused(true);
  };

  // If the remainder is empty but we have chips, the cursor is conceptually resting on the trailing space after the chips.
  const normalizedQuery = (chipsText && !remainder) ? chipsText + ' ' : localSearch;

  /** Get cursor-adjusted word position in full localSearch */
  const getWordAtCursor = (): { word: string; start: number; end: number } => {
    const el = inputRef.current;
    const inputCursor = el?.selectionStart ?? remainder.length;
    // Offset: chips text + separator space
    const offset = chipsText ? chipsText.length + 1 : 0;
    const cursor = offset + inputCursor;
    const text = normalizedQuery;

    let start = cursor;
    while (start > 0 && text[start - 1] !== ' ') start--;
    let end = cursor;
    while (end < text.length && text[end] !== ' ') end++;

    return { word: text.slice(start, end), start, end };
  };

  const replaceWordAtCursor = (replacement: string, moveCursorToEnd = true): string => {
    const { start, end } = getWordAtCursor();
    const before = normalizedQuery.slice(0, start);
    const after = normalizedQuery.slice(end);
    // Don't add space after ':' — user is about to type a value
    const needsTrailingSpace = !replacement.endsWith(':');
    const joined = needsTrailingSpace
      ? before + replacement + (after.startsWith(' ') ? after : ' ' + after.trimStart())
      : before + replacement + after;
    const result = joined.replace(/^ +/, '').replace(/ {2,}/g, ' ');

    setLocalSearch(result);
    if (moveCursorToEnd) {
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          // Cursor at end of input
          const newLen = result.length;
          inputRef.current.selectionStart = inputRef.current.selectionEnd = newLen;
        }
      });
    }
    return result;
  };

  const addSearchTag = (key: string, value: string, op: string = 'is') => {
    const opStr = op === '!=' ? '!=' : ':';
    const tag = `${key}${opStr}"${value}"`;
    const result = replaceWordAtCursor(tag, true);
    onSubmit(result.trim());
    // Keep searchFocused true so that autocomplete suggests AND/OR
    setSearchFocused(true);
  };

  const handleSearchKey = (e: React.KeyboardEvent) => {
    // Backspace on empty remainder → delete last chip
    if (e.key === 'Backspace' && remainder === '' && chips.length > 0) {
      e.preventDefault();
      const newChips = chips.slice(0, -1);
      const newChipsText = newChips.map(c => c.raw).join(' ');
      setLocalSearch(newChipsText ? newChipsText + ' ' : '');
      return;
    }
    // Forward to autocomplete for arrow/enter/tab navigation
    if (autocompleteRef.current?.handleKeyDown(e)) return;
    if (e.key === 'Enter') {
      saveRecentSearch(localSearch.trim());
      onSubmit(localSearch.trim());
      setSearchFocused(false);
    }
  };

  /* ─── Chip color helpers ─── */
  const chipColor = (chip: SearchChip) => {
    switch (chip.type) {
      case 'filter': return { bg: alpha(theme.palette.primary.main, 0.12), border: alpha(theme.palette.primary.main, 0.3), color: isDark ? theme.palette.primary.light : theme.palette.primary.dark };
      case 'negated': return { bg: alpha(theme.palette.error.main, 0.12), border: alpha(theme.palette.error.main, 0.3), color: isDark ? theme.palette.error.light : theme.palette.error.dark };
      case 'has': return { bg: alpha(theme.palette.success.main, 0.12), border: alpha(theme.palette.success.main, 0.3), color: isDark ? theme.palette.success.light : theme.palette.success.dark };
      case 'operator': return { bg: alpha(theme.palette.warning.main, 0.10), border: 'transparent', color: theme.palette.warning.main };
      default: return { bg: alpha(theme.palette.text.primary, 0.08), border: alpha(theme.palette.text.primary, 0.15), color: theme.palette.text.primary };
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box
        ref={searchContainerRef}
        onClick={() => inputRef.current?.focus()}
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, flexWrap: 'wrap',
          px: 1, py: 0.3, borderRadius: '6px', minWidth: 500, minHeight: 30,
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          transition: 'border-color 0.2s', cursor: 'text',
          backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#fff',
          '&:focus-within': { borderColor: theme.palette.primary.main, boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}` },
        }}
      >
        <SearchIcon sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0, ml: 0.5 }} />

        {/* Rendered chips */}
        {chips.map((chip, i) => {
          const cc = chipColor(chip);
          if (chip.type === 'operator') {
            return (
              <Typography key={i} sx={{
                fontSize: '0.7rem', fontWeight: 700, px: 0.5,
                color: cc.color, userSelect: 'none',
              }}>
                {chip.raw}
              </Typography>
            );
          }
          return (
            <Chip
              key={i}
              size="small"
              label={chip.type === 'has' ? `has:${chip.value}` : `${chip.key}:${chip.value}`}
              onDelete={() => removeChip(i)}
              sx={{
                height: 22, fontSize: '0.75rem', fontWeight: 600,
                backgroundColor: cc.bg, color: cc.color,
                border: `1px solid ${cc.border}`,
                '& .MuiChip-deleteIcon': { fontSize: 14, color: cc.color, opacity: 0.6, '&:hover': { opacity: 1 } },
              }}
            />
          );
        })}

        {/* Editable input for remainder */}
        <Box component="input"
          ref={inputRef}
          value={remainder}
          spellCheck={false}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateRemainder(e.target.value)}
          onKeyDown={handleSearchKey as any}
          onFocus={() => setSearchFocused(true)}
          placeholder={chips.length === 0 ? t('argus.discover.searchPlaceholder', 'Search for events, users, tags (e.g. level:error OR browser:Chrome)') : ''}
          style={{
            flex: 1, border: 'none', outline: 'none', backgroundColor: 'transparent',
            color: 'inherit', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 500, minWidth: 120, padding: '6px 4px'
          }}
        />
        {localSearch && (
          <IconButton size="small" onClick={() => { setLocalSearch(''); onSubmit(''); setSearchFocused(false); }} sx={{ p: 0.2, mr: 0.5 }}>
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        )}
      </Box>

      <SafeTooltip title={t('argus.builder.open', 'Open Query Builder')}>
        <IconButton
          size="small"
          onClick={(e) => setBuilderAnchorEl(e.currentTarget)}
          sx={{
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            borderRadius: '6px', height: 30, width: 30,
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
          }}
        >
          <FilterIcon sx={{ fontSize: 15 }} />
        </IconButton>
      </SafeTooltip>

      <ArgusQueryBuilder
        fields={['severity', 'service', 'environment', 'logger_name', 'trace_id', 'release']}
        query={localSearch}
        facets={mappedFacets}
        activeFilters={activeFilters}
        onApply={(q) => { setLocalSearch(q); onSubmit(q); }}
        anchorEl={builderAnchorEl}
        onClose={() => setBuilderAnchorEl(null)}
      />

      {/* Search Autocomplete Popover */}
      <SearchAutocompletePopover
        ref={autocompleteRef}
        open={searchFocused}
        anchorEl={searchContainerRef.current}
        query={normalizedQuery}
        fields={['severity', 'service', 'environment', 'logger', 'trace_id', 'message']}
        facets={mappedFacets}
        isDark={isDark}
        onSelectTag={(field, value) => {
          addSearchTag(field, value);
        }}
        onSelectField={(field) => {
          replaceWordAtCursor(field + ':');
        }}
        onSelectSyntax={(syntax) => {
          replaceWordAtCursor(syntax);
        }}
        onClose={() => setSearchFocused(false)}
        recentSearches={recentSearches}
        onClearRecentSearches={clearRecentSearches}
        onSelectRecentSearch={(q) => {
          setLocalSearch(q);
          onSubmit(q);
          setSearchFocused(false);
        }}
      />
    </Box>
  );
};

/* ─── Main Component ─── */

/**
 * Extract free-text search terms from a query string (ignoring key:value pairs)
 * and wrap matching substrings in the text with a highlighted <mark> element.
 *
 * - key:"value" and key:value patterns are skipped (they are field filters, not text searches)
 * - AND/OR operators are skipped
 * - Remaining tokens are treated as free-text search terms to highlight
 */
function highlightSearchTerms(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;

  // Tokenize query: extract tokens that are NOT key:value pairs and NOT logical operators
  const tokens = query.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  const freeTextTerms = tokens
    .filter(t => !/^[\w.-]+[:!=]/.test(t))  // skip key:value, key!=value
    .filter(t => !['AND', 'OR', 'NOT'].includes(t.toUpperCase()))
    .map(t => t.replace(/^"|"$/g, '').trim())  // strip quotes
    .filter(t => t.length > 0);

  if (freeTextTerms.length === 0) return text;

  // Build regex from terms, escaping special chars
  const escaped = freeTextTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');

  const parts = text.split(regex);
  if (parts.length === 1) return text;

  // When splitting by a capturing group regex, matched segments appear
  // at odd indices (1, 3, 5, ...) in the resulting array.
  return parts.map((part, i) =>
    i % 2 === 1
      ? <mark key={i} style={{ backgroundColor: 'rgba(255,213,79,0.4)', borderRadius: 2, padding: '0 1px' }}>{part}</mark>
      : part
  );
}

