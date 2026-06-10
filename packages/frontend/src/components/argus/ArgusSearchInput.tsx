import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  InputBase,
  alpha,
  Tooltip,
  IconButton,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Search as SearchIcon, Close as CloseIcon } from '@mui/icons-material';
import SafeTooltip from '@/components/common/SafeTooltip';
import QueryBuilderPanel from '@/components/argus/QueryBuilderPanel';
import { Tune as TuneIcon } from '@mui/icons-material';

import SearchAutocompletePopover, {
  SearchAutocompletePopoverHandle,
} from './SearchAutocompletePopover';

const RECENT_KEY = 'argusLogs.recentSearch';

export const ArgusSearchInput: React.FC<{
  initialValue: string;
  onSubmit: (val: string) => void;
  isDark: boolean;
  theme: any;
  mappedFacets: any;
  activeFilters?: any[];
  fields?: string[];
}> = ({
  initialValue,
  onSubmit,
  isDark,
  theme,
  mappedFacets,
  activeFilters,
  fields: fieldsProp,
}) => {
  // Derive fields from prop or facet keys
  const fields = useMemo(() => {
    if (fieldsProp && fieldsProp.length > 0) return fieldsProp;
    return Object.keys(mappedFacets || {});
  }, [fieldsProp, mappedFacets]);
  const { t } = useTranslation();
  const [localSearch, setLocalSearch] = useState(initialValue);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<SearchAutocompletePopoverHandle>(null);
  const [builderOpen, setBuilderOpen] = useState(false);

  // Recent searches (persisted in localStorage)
  const RECENT_KEY = 'argus_recent_log_searches';
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    } catch {
      return [];
    }
  });

  const saveRecentSearch = (q: string) => {
    if (!q.trim()) return;
    setRecentSearches((prev) => {
      const next = [q.trim(), ...prev.filter((p) => p !== q.trim())].slice(
        0,
        10
      );
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_KEY);
  };

  // Track the last value we submitted so we don't reset local state
  // when the parent echoes it back as initialValue.
  const lastSubmittedRef = useRef<string>(initialValue);

  useEffect(() => {
    // Only reset if this is a genuinely NEW external value
    // (e.g. loading a saved query, navigating back), not our own submit echoing back.
    if (initialValue !== lastSubmittedRef.current) {
      setLocalSearch(initialValue);
      lastSubmittedRef.current = initialValue;
    }
  }, [initialValue]);

  // NOTE: Input is composing state (like IME).
  // Only onSubmit fires when the query is committed.
  // No debounce, no intermediate callbacks.

  /** Commit a completed query to the parent */
  const submitQuery = (query: string) => {
    lastSubmittedRef.current = query;
    onSubmit(query);
  };

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
    const re =
      /(!?[\w.-]+:(?:"[^"]*"|'[^']*'|"[^"]*$|'[^']*$|\S+))|(\bAND\b|\bOR\b)/g;
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
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        )
          val = val.slice(1, -1);

        if (key === 'has') {
          chipList.push({ type: 'has', raw: tok, key: 'has', value: val });
        } else {
          // Completed if: quoted value OR unquoted value (no opening quote) followed by space
          const rawVal = clean.slice(ci + 1);
          const isQuoted =
            (rawVal.startsWith('"') &&
              rawVal.endsWith('"') &&
              rawVal.length >= 2) ||
            (rawVal.startsWith("'") &&
              rawVal.endsWith("'") &&
              rawVal.length >= 2);
          const startsWithQuote =
            rawVal.startsWith('"') || rawVal.startsWith("'");
          const matchEnd = match.index + match[0].length;
          const hasTrailingSpace =
            matchEnd < text.length && text[matchEnd] === ' ';
          const isComplete =
            isQuoted ||
            (!startsWithQuote && rawVal.length > 0 && hasTrailingSpace);
          if (isComplete) {
            chipList.push({
              type: isNeg ? 'negated' : 'filter',
              raw: tok,
              key,
              value: val,
            });
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
    const ct = chipList.map((c) => c.raw).join(' ');
    return { chips: chipList, remainder: rem, chipsText: ct };
  }, [localSearch]);

  /** Remove a chip by index */
  const removeChip = (idx: number) => {
    const newChips = chips.filter((_, i) => i !== idx);
    const newChipsText = newChips.map((c) => c.raw).join(' ');
    const newQuery = (newChipsText ? newChipsText + ' ' : '') + remainder;
    const final = newQuery.trim();
    setLocalSearch(final);
    submitQuery(final);
  };

  /** Reconstruct localSearch from chips + remainder */
  const buildQuery = (newRemainder: string): string => {
    const base = chipsText ? chipsText + ' ' : '';
    return (base + newRemainder).replace(/ {2,}/g, ' ').trimStart();
  };

  /** Update localSearch by replacing the remainder portion */
  const updateRemainder = (newRemainder: string) => {
    setLocalSearch(buildQuery(newRemainder));
    setSearchFocused(true);
  };

  /** Get word boundaries at cursor position within REMAINDER only */
  const getWordAtCursor = (): { word: string; start: number; end: number } => {
    const cursor = inputRef.current?.selectionStart ?? remainder.length;
    const text = remainder;

    let start = cursor;
    while (start > 0 && text[start - 1] !== ' ') start--;
    let end = cursor;
    while (end < text.length && text[end] !== ' ') end++;

    return { word: text.slice(start, end), start, end };
  };

  /** Replace the word at cursor within REMAINDER, then rebuild localSearch */
  const replaceWordAtCursor = (
    replacement: string,
    moveCursorToEnd = true
  ): string => {
    const { start, end } = getWordAtCursor();
    const before = remainder.slice(0, start);
    const after = remainder.slice(end);
    // Don't add space after ':' — user is about to type a value
    const needsTrailingSpace = !replacement.endsWith(':');
    let newRemainder: string;
    if (needsTrailingSpace) {
      newRemainder =
        before +
        replacement +
        (after.startsWith(' ') ? after : after ? ' ' + after : '');
    } else {
      newRemainder = before + replacement + after;
    }
    newRemainder = newRemainder.replace(/ {2,}/g, ' ');

    const result = buildQuery(newRemainder);
    setLocalSearch(result);

    if (moveCursorToEnd) {
      // Calculate cursor position within the NEW remainder after re-parse
      const cursorTarget =
        (before + replacement).length + (needsTrailingSpace && !after ? 0 : 0);
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          // After React re-render, the input value will be the new remainder.
          // Place cursor at end of the replacement within remainder.
          const inputLen = inputRef.current.value.length;
          const pos = Math.min(cursorTarget, inputLen);
          inputRef.current.selectionStart = inputRef.current.selectionEnd = pos;
        }
      });
    }
    return result;
  };

  const addSearchTag = (key: string, value: string, op: string = 'is') => {
    let tag: string;
    switch (op) {
      case 'is':
        tag = `${key}:"${value}"`;
        break;
      case 'is_not':
      case '!=':
        tag = `!${key}:"${value}"`;
        break;
      case 'contains':
        tag = `${key}.contains:"${value}"`;
        break;
      case 'not_contains':
        tag = `${key}.not_contains:"${value}"`;
        break;
      case 'starts_with':
        tag = `${key}.starts_with:"${value}"`;
        break;
      case 'ends_with':
        tag = `${key}.ends_with:"${value}"`;
        break;
      default:
        // Numeric / comparison operators: >, <, >=, <=
        if (['>', '<', '>=', '<='].includes(op)) {
          tag = `${key}:${op}${value}`;
        } else {
          tag = `${key}:"${value}"`;
        }
    }
    const result = replaceWordAtCursor(tag, true);
    submitQuery(result.trim());
    // Keep searchFocused true so that autocomplete suggests AND/OR
    setSearchFocused(true);
  };

  const handleSearchKey = (e: React.KeyboardEvent) => {
    // Backspace on empty remainder → delete last chip
    if (e.key === 'Backspace' && remainder === '' && chips.length > 0) {
      e.preventDefault();
      const newChips = chips.slice(0, -1);
      const newChipsText = newChips.map((c) => c.raw).join(' ');
      setLocalSearch(newChipsText ? newChipsText + ' ' : '');
      return;
    }
    // Forward to autocomplete for arrow/enter/tab navigation
    if (autocompleteRef.current?.handleKeyDown(e)) return;
    if (e.key === 'Enter') {
      // If there's a plain text remainder (not a key:value pair),
      // auto-wrap it as message:"text" before submitting.
      let finalQuery = localSearch.trim();
      if (remainder.trim()) {
        const plainText = remainder.trim();
        // Check if it looks like a partial key:value — if not, wrap as message search
        if (!plainText.includes(':')) {
          const messageTag = `message:"${plainText}"`;
          const base = chipsText ? chipsText + ' ' : '';
          finalQuery = (base + messageTag).trim();
          setLocalSearch(finalQuery);
        }
      }
      saveRecentSearch(finalQuery);
      submitQuery(finalQuery);
      setSearchFocused(false);
    }
  };

  /* ─── Chip color helpers ─── */
  const chipColor = (chip: SearchChip) => {
    switch (chip.type) {
      case 'filter':
        return {
          bg: alpha(theme.palette.primary.main, 0.12),
          border: alpha(theme.palette.primary.main, 0.3),
          color: isDark
            ? theme.palette.primary.light
            : theme.palette.primary.dark,
        };
      case 'negated':
        return {
          bg: alpha(theme.palette.error.main, 0.12),
          border: alpha(theme.palette.error.main, 0.3),
          color: isDark ? theme.palette.error.light : theme.palette.error.dark,
        };
      case 'has':
        return {
          bg: alpha(theme.palette.success.main, 0.12),
          border: alpha(theme.palette.success.main, 0.3),
          color: isDark
            ? theme.palette.success.light
            : theme.palette.success.dark,
        };
      case 'operator':
        return {
          bg: alpha(theme.palette.warning.main, 0.1),
          border: 'transparent',
          color: theme.palette.warning.main,
        };
      default:
        return {
          bg: alpha(theme.palette.text.primary, 0.08),
          border: alpha(theme.palette.text.primary, 0.15),
          color: theme.palette.text.primary,
        };
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {/* Search bar container — visual border wraps everything */}
      <Box
        ref={searchContainerRef}
        sx={{
          display: 'flex',
          alignItems: 'center',
          borderRadius: '6px',
          minHeight: 26,
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          transition: 'border-color 0.2s',
          backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#fff',
          '&:focus-within': {
            borderColor: theme.palette.primary.main,
            boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`,
          },
        }}
      >
        {/* Scrollable chips + input area */}
        <Box
          onClick={() => inputRef.current?.focus()}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            flex: 1,
            flexWrap: 'nowrap',
            px: 1,
            py: 0.3,
            minWidth: 0,
            overflowX: 'auto',
            overflowY: 'hidden',
            cursor: 'text',
          }}
        >
          <SearchIcon
            sx={{
              fontSize: 16,
              color: 'text.disabled',
              flexShrink: 0,
              ml: 0.5,
            }}
          />

          {/* Rendered chips */}
          {chips.map((chip, i) => {
            const cc = chipColor(chip);
            if (chip.type === 'operator') {
              return (
                <Typography
                  key={i}
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    px: 0.5,
                    color: cc.color,
                    userSelect: 'none',
                  }}
                >
                  {chip.raw}
                </Typography>
              );
            }
            return (
              <Chip
                key={i}
                size="small"
                label={
                  chip.type === 'has'
                    ? `has:${chip.value}`
                    : `${chip.key}:${chip.value}`
                }
                onDelete={() => removeChip(i)}
                sx={{
                  height: 22,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: cc.bg,
                  color: cc.color,
                  border: `1px solid ${cc.border}`,
                  '& .MuiChip-deleteIcon': {
                    fontSize: 14,
                    color: cc.color,
                    opacity: 0.6,
                    '&:hover': { opacity: 1 },
                  },
                }}
              />
            );
          })}

          {/* Editable input for remainder */}
          <Box
            component="input"
            ref={inputRef}
            value={remainder}
            spellCheck={false}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              updateRemainder(e.target.value)
            }
            onKeyDown={handleSearchKey as any}
            onFocus={() => setSearchFocused(true)}
            placeholder={
              chips.length === 0
                ? t(
                    'argus.discover.searchPlaceholder',
                    'Search for events, users, tags (e.g. level:error OR browser:Chrome)'
                  )
                : ''
            }
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              color: 'inherit',
              fontFamily: 'inherit',
              fontSize: '0.85rem',
              fontWeight: 500,
              minWidth: 120,
              padding: '6px 4px',
            }}
          />
          {localSearch && (
            <IconButton
              size="small"
              onClick={() => {
                setLocalSearch('');
                onSubmit('');
                setSearchFocused(false);
              }}
              sx={{ p: 0.2, flexShrink: 0 }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          )}
        </Box>

        {/* Builder toggle — pinned right, always visible */}
        <Box
          sx={{
            borderLeft: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            px: 0.5,
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <SafeTooltip title={t('argus.builder.open', 'Open Query Builder')}>
            <IconButton
              size="small"
              onClick={() => setBuilderOpen((prev) => !prev)}
              sx={{
                p: 0.3,
                color: builderOpen
                  ? theme.palette.primary.main
                  : 'text.disabled',
                transition: 'color 0.15s',
              }}
            >
              <TuneIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </SafeTooltip>
        </Box>
      </Box>

      {/* Query Builder Panel (Dialog) */}
      <QueryBuilderPanel
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        config={{
          name: 'search',
          fields: fields.map((f) => ({
            key: f,
            label: f,
            type: 'string' as const,
            searchable: true,
            operators: [
              '=',
              '!=',
              'contains',
              '!contains',
              'startsWith',
              '!startsWith',
              'endsWith',
              '!endsWith',
            ] as any,
            category: 'log' as const,
            description: f,
          })),
        }}
        query={localSearch}
        facets={mappedFacets}
        onApply={(q) => {
          setLocalSearch(q);
          onSubmit(q);
        }}
      />

      {/* Search Autocomplete Popover */}
      <SearchAutocompletePopover
        ref={autocompleteRef}
        open={searchFocused}
        anchorEl={searchContainerRef.current}
        query={
          chipsText ? chipsText + ' ' + remainder : remainder || localSearch
        }
        fields={fields}
        facets={mappedFacets}
        isDark={isDark}
        onSelectTag={(field, value, op) => {
          addSearchTag(field, value, op);
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
