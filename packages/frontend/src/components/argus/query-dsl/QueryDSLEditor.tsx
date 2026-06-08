/**
 * QueryDSLEditor — Sentry-style tokenized grid editor.
 *
 * Each filter is rendered as a clickable chip: [field] [op] [value] [×]
 * New filters are added via an inline input at the end.
 * Existing filters can be edited by clicking any part.
 * Ctrl+Z / Ctrl+Y for undo/redo of chip state.
 */

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { Box, IconButton, useTheme, ClickAwayListener } from '@mui/material';
import { Search as SearchIcon, Close as CloseIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

import type { QueryDomain, SuggestionItem } from './types';
import { TokenType } from './types';
import { tokenize } from './lexer';
import { resolveCursorContext } from './cursor-context';
import { getSuggestions, applyCompletion } from './suggestion-engine';
import { QuerySuggestionDropdown } from './QuerySuggestionDropdown';
import type { QuerySuggestionDropdownHandle } from './QuerySuggestionDropdown';
import { FilterTokenChip } from './FilterTokenChip';
import { queryToChips, chipsToQuery, type FilterChip } from './useFilterChips';
import {
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  type RecentSearch,
} from './recent-searches';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface QueryDSLEditorProps {
  domain: QueryDomain;
  initialQuery?: string;
  onSearch: (query: string) => void;
  /** Called whenever the query changes (for parent state sync) */
  onChange?: (query: string) => void;
  /** Accepts Map<string, string[]> or Record<string, {value,count}[]> */
  facets?:
    | Map<string, string[]>
    | Record<string, { value: string; count: number }[]>
    | Record<string, string[]>;
  placeholder?: string;
  maxSuggestions?: number;
}

// ─── Undo/Redo Hook ──────────────────────────────────────────────────────────

const MAX_HISTORY = 50;

function useChipHistory(initial: FilterChip[] | (() => FilterChip[])) {
  const [chips, setChipsRaw] = useState<FilterChip[]>(initial);
  const undoStack = useRef<FilterChip[][]>([]);
  const redoStack = useRef<FilterChip[][]>([]);
  const chipsRef = useRef<FilterChip[]>(
    typeof initial === 'function' ? initial() : initial
  );

  // Keep chipsRef in sync
  chipsRef.current = chips;

  const setChips = useCallback(
    (updater: FilterChip[] | ((prev: FilterChip[]) => FilterChip[])) => {
      const prev = chipsRef.current;
      const next = typeof updater === 'function' ? updater(prev) : updater;

      // Only push to history if chips actually changed
      if (JSON.stringify(prev) !== JSON.stringify(next)) {
        undoStack.current.push(prev);
        if (undoStack.current.length > MAX_HISTORY) {
          undoStack.current.shift();
        }
        redoStack.current = []; // clear redo on new action
        setChipsRaw(next);
      }
    },
    []
  );

  const undo = useCallback(() => {
    const prevState = undoStack.current.pop();
    if (prevState === undefined) return;
    redoStack.current.push(chipsRef.current);
    setChipsRaw(prevState);
  }, []);

  const redo = useCallback(() => {
    const nextState = redoStack.current.pop();
    if (nextState === undefined) return;
    undoStack.current.push(chipsRef.current);
    setChipsRaw(nextState);
  }, []);

  const resetTo = useCallback((newChips: FilterChip[]) => {
    undoStack.current = [];
    redoStack.current = [];
    setChipsRaw(newChips);
  }, []);

  return { chips, setChips, undo, redo, resetTo };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function QueryDSLEditor({
  domain,
  initialQuery = '',
  onSearch,
  onChange,
  facets,
  placeholder,
  maxSuggestions = 20,
}: QueryDSLEditorProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<QuerySuggestionDropdownHandle>(null);
  // Stable ref for onChange to avoid useEffect re-fire
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // ─── State ───────────────────────────────────────────────────────────

  const { chips, setChips, undo, redo, resetTo } = useChipHistory(
    queryToChips(initialQuery)
  );
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isComposing, setIsComposing] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(() =>
    getRecentSearches(domain)
  );

  const currentFilterInfo = useMemo(
    () => parseInputFilter(inputValue),
    [inputValue]
  );
  const selectedValues = useMemo(
    () => new Set(currentFilterInfo.values),
    [currentFilterInfo]
  );

  const refreshRecent = useCallback(() => {
    setRecentSearches(getRecentSearches(domain));
  }, [domain]);

  // Ref to suppress onChange during programmatic chip updates (e.g. recent selection)
  const suppressOnChangeRef = useRef(false);

  const handleSelectRecent = useCallback(
    (query: string) => {
      // Suppress onChange to prevent it from sending empty query to URL
      // before resetTo commits the new chips
      suppressOnChangeRef.current = true;
      resetTo(queryToChips(query));
      setInputValue('');
      setShowDropdown(false);
      // Delay onSearch to next tick so chips state is committed first
      requestAnimationFrame(() => {
        suppressOnChangeRef.current = false;
        onSearch(query);
      });
    },
    [resetTo, onSearch]
  );

  const handleRemoveRecent = useCallback(
    (query: string) => {
      removeRecentSearch(domain, query);
      refreshRecent();
    },
    [domain, refreshRecent]
  );

  // ─── Sync initialQuery → chips when it changes externally ──────────
  const prevInitialQuery = useRef(initialQuery);
  useEffect(() => {
    if (initialQuery !== prevInitialQuery.current) {
      prevInitialQuery.current = initialQuery;
      resetTo(queryToChips(initialQuery));
      setInputValue('');
    }
  }, [initialQuery, resetTo]);

  // ─── Normalize facets ──────────────────────────────────────────────

  const normalizedFacets = useMemo((): Map<string, string[]> | undefined => {
    if (!facets) return undefined;
    if (facets instanceof Map) return facets;
    const map = new Map<string, string[]>();
    for (const [key, values] of Object.entries(facets)) {
      if (Array.isArray(values)) {
        if (values.length === 0) {
          map.set(key, []);
        } else if (typeof values[0] === 'string') {
          map.set(key, values as string[]);
        } else {
          map.set(
            key,
            (values as { value: string; count: number }[]).map((v) => v.value)
          );
        }
      }
    }
    return map;
  }, [facets]);

  // ─── Notify parent of chip changes ─────────────────────────────────

  useEffect(() => {
    // Skip onChange during programmatic updates (e.g. recent selection)
    // to prevent race condition where empty chips trigger URL clear
    if (suppressOnChangeRef.current) return;
    onChangeRef.current?.(chipsToQuery(chips));
  }, [chips]);

  // ─── Suggestion engine for inline input ────────────────────────────

  const tokens = useMemo(() => tokenize(inputValue), [inputValue]);
  const cursorContext = useMemo(
    () => resolveCursorContext(inputValue, inputValue.length, tokens),
    [inputValue, tokens]
  );

  // Support logical operator chips explicitly
  const suggestions = useMemo(
    () =>
      getSuggestions(
        cursorContext,
        domain,
        normalizedFacets,
        maxSuggestions,
        chips
      ),
    [cursorContext, domain, normalizedFacets, maxSuggestions, chips]
  );

  // ─── Chip operations ──────────────────────────────────────────────

  const updateChip = useCallback(
    (
      chipId: string,
      updates: Partial<Pick<FilterChip, 'field' | 'operator' | 'value'>>
    ) => {
      setChips((prev) =>
        prev.map((c) => (c.id === chipId ? { ...c, ...updates } : c))
      );
    },
    [setChips]
  );

  const deleteChip = useCallback(
    (chipId: string) => {
      setChips((prev) => prev.filter((c) => c.id !== chipId));
    },
    [setChips]
  );

  // ─── Input handlers ───────────────────────────────────────────────

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInputValue(val);
      // Show dropdown when there's actual text (not just spaces)
      if (val.trim().length > 0) {
        setShowDropdown(true);
      }
      setSelectedIndex(-1);
    },
    []
  );

  /** Commit typed text in the input field as chip(s) */
  const commitInputAsChip = useCallback(
    (text: string) => {
      const lower = text.toLowerCase();
      if (lower === 'and' || lower === 'or') {
        if (canInsertLogical(chips)) {
          // Valid position → logical chip
          setChips((prev) => [
            ...prev,
            {
              id: `chip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              type: 'logical' as const,
              label: lower.toUpperCase(),
            },
          ]);
        } else {
          // No preceding filter → free text message search
          setChips((prev) => [
            ...prev,
            {
              id: `chip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              type: 'filter' as const,
              field: 'message',
              operator: 'contains',
              value: text,
              quoted: true,
            },
          ]);
        }
        setInputValue('');
      } else if (lower === '(' || lower === ')') {
        // Paren → paren chip
        setChips((prev) => [
          ...prev,
          {
            id: `chip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: 'paren' as const,
            label: lower,
          },
        ]);
        setInputValue('');
      } else {
        // Try to parse as filter, or fall through as free text
        const parsed = queryToChips(text);
        if (parsed.length > 0) {
          setChips((prev) => [...prev, ...parsed]);
          setInputValue('');
        }
      }
    },
    [chips, setChips]
  );

  const applySuggestion = useCallback(
    (item: SuggestionItem, isMultiSelect?: boolean) => {
      const result = applyCompletion(inputValue, cursorContext, item);

      if (item.category === 'logical') {
        // AND/OR: only valid after a filter chip or closing paren
        if (canInsertLogical(chips)) {
          setChips((prev) => [
            ...prev,
            {
              id: `chip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              type: 'logical' as const,
              label: item.label.toUpperCase(),
            },
          ]);
          setInputValue('');
          setShowDropdown(false);
          setSelectedIndex(-1);
        } else {
          // No valid preceding filter → treat as free text message search
          const freeTextChip: FilterChip = {
            id: `chip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: 'filter',
            field: 'message',
            operator: 'contains',
            value: item.label,
            quoted: true,
          };
          setChips((prev) => [...prev, freeTextChip]);
          setInputValue('');
          setShowDropdown(false);
          setSelectedIndex(-1);
        }
      } else if (item.category === 'paren') {
        // (/) → immediately create a chip (Sentry-style)
        setChips((prev) => [
          ...prev,
          {
            id: `chip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: 'paren' as const,
            label: item.label,
          },
        ]);
        setInputValue('');
        setShowDropdown(false);
        setSelectedIndex(-1);
      } else if (item.category === 'value') {
        if (isMultiSelect) {
          // Multi-select mode: toggle value in field:in("val1", "val2") list format
          const { field, operator, values: currentValues } = currentFilterInfo;
          if (field) {
            let nextValues = [...currentValues];
            const itemValue = item.label;

            if (nextValues.includes(itemValue)) {
              nextValues = nextValues.filter((v) => v !== itemValue);
            } else {
              nextValues.push(itemValue);
            }

            let nextOp = 'in';
            if (operator === '!=' || operator === '!in') {
              nextOp = '!in';
            }

            let nextInput = '';
            if (nextValues.length === 0) {
              nextInput = `${field}:${nextOp}()`;
            } else {
              const quotedValues = nextValues.map((v) => `"${v}"`).join(', ');
              nextInput = `${field}:${nextOp}(${quotedValues})`;
            }

            setInputValue(nextInput);
            setShowDropdown(true);
            setSelectedIndex(-1);

            // Adjust cursor position to be inside the parentheses
            requestAnimationFrame(() => {
              if (inputRef.current) {
                inputRef.current.focus();
                const cursorPos =
                  nextInput.length - (nextInput.endsWith(')') ? 1 : 0);
                inputRef.current.setSelectionRange(cursorPos, cursorPos);
              }
            });
            return;
          }
        }

        // Single-value mode or fallback
        // Value → try to create filter chips
        const completedChips = queryToChips(result.text);
        if (completedChips.length > 0) {
          setChips((prev) => [...prev, ...completedChips]);
          setInputValue('');
          setShowDropdown(false);
          setSelectedIndex(-1);
        } else {
          setInputValue(result.text);
          setShowDropdown(true);
          setSelectedIndex(-1);
        }
      } else {
        // Field or operator selected → keep dropdown open for next step
        setInputValue(result.text);
        setShowDropdown(true);
        setSelectedIndex(-1);
      }

      // Re-focus input (suppress dropdown from the focus event to prevent double-open)
      suppressDropdownRef.current = true;
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(
            result.cursorOffset,
            result.cursorOffset
          );
        }
      });
    },
    [inputValue, cursorContext, setChips, chips, currentFilterInfo]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (isComposing) return;

      // ── Undo / Redo ──
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        // Only intercept Ctrl+Z when input is empty (for chip undo)
        // Otherwise let browser handle native input undo
        if (inputValue === '') {
          e.preventDefault();
          undo();
          return;
        }
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'y' || (e.key === 'z' && e.shiftKey))
      ) {
        if (inputValue === '') {
          e.preventDefault();
          redo();
          return;
        }
      }

      if (e.key === 'ArrowDown' && showDropdown && suggestions.length > 0) {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp' && showDropdown && suggestions.length > 0) {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, -1));
        return;
      }
      // Left/Right arrow keys → tab switching (when dropdown is open)
      if (e.key === 'ArrowLeft' && showDropdown && inputValue === '') {
        e.preventDefault();
        dropdownRef.current?.prevTab();
        return;
      }
      if (e.key === 'ArrowRight' && showDropdown && inputValue === '') {
        e.preventDefault();
        dropdownRef.current?.nextTab();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        // If user typed a structural keyword, handle it directly (don't pick dropdown suggestion)
        if (inputValue.trim()) {
          const lower = inputValue.trim().toLowerCase();
          if (
            lower === 'and' ||
            lower === 'or' ||
            lower === '(' ||
            lower === ')'
          ) {
            commitInputAsChip(inputValue.trim());
            setShowDropdown(false);
            return;
          }
        }
        if (showDropdown && suggestions.length > 0 && selectedIndex >= 0) {
          applySuggestion(suggestions[selectedIndex]);
        } else if (showDropdown && selectedIndex < 0) {
          // Nothing selected — just close the dropdown
          setShowDropdown(false);
        } else if (inputValue.trim()) {
          commitInputAsChip(inputValue.trim());
          setShowDropdown(false);
        }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (showDropdown && selectedIndex >= 0 && suggestions.length > 0) {
          applySuggestion(suggestions[selectedIndex]);
        } else if (inputValue.trim()) {
          commitInputAsChip(inputValue.trim());
          setShowDropdown(false);
        } else {
          // No input text → execute search with current chips
          const query = chipsToQuery(chips);
          if (query.trim()) {
            addRecentSearch(domain, query);
            refreshRecent();
          }
          onSearch(query);
          setShowDropdown(false);
        }
        return;
      }
      if (e.key === 'Escape') {
        setShowDropdown(false);
        return;
      }
      // ( and ) → immediately create paren chip (Sentry-style)
      if ((e.key === '(' || e.key === ')') && !inputValue.includes(':')) {
        e.preventDefault();
        // Commit any existing input text first
        if (inputValue.trim()) {
          commitInputAsChip(inputValue.trim());
        }
        setChips((prev) => [
          ...prev,
          {
            id: `chip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: 'paren' as const,
            label: e.key,
          },
        ]);
        setInputValue('');
        setShowDropdown(false);
        return;
      }
      if (e.key === 'Backspace' && inputValue === '' && chips.length > 0) {
        // Delete last chip when backspace on empty input
        e.preventDefault();
        setChips((prev) => prev.slice(0, -1));
        return;
      }
    },
    [
      isComposing,
      showDropdown,
      suggestions,
      selectedIndex,
      inputValue,
      chips,
      undo,
      redo,
      applySuggestion,
      setChips,
      onSearch,
      domain,
      refreshRecent,
    ]
  );

  const suppressDropdownRef = useRef(false);
  // Prevents click handler from toggling right after focus showed the dropdown
  const justFocusedRef = useRef(false);

  const handleFocus = useCallback(() => {
    if (suppressDropdownRef.current) {
      suppressDropdownRef.current = false;
      return;
    }
    // Always show dropdown on focus
    setShowDropdown(true);
    setSelectedIndex(-1);
    justFocusedRef.current = true;
  }, []);

  const handleInputClick = useCallback(() => {
    if (justFocusedRef.current) {
      // This click is the one that triggered focus → don't toggle
      justFocusedRef.current = false;
      return;
    }
    // Re-click on already-focused input → toggle
    setShowDropdown((prev) => !prev);
    setSelectedIndex(-1);
  }, []);

  const handleClickAway = useCallback(() => {
    setShowDropdown(false);
    justFocusedRef.current = false;
  }, []);

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    // Don't focus input if clicking on a chip (chip handles its own click)
    if ((e.target as HTMLElement).closest('[data-chip]')) return;
    inputRef.current?.focus();
  }, []);

  const handleClear = useCallback(() => {
    setChips([]);
    setInputValue('');
    setShowDropdown(false);
    // Suppress the dropdown that handleFocus would re-open
    suppressDropdownRef.current = true;
    inputRef.current?.focus();
  }, [setChips]);

  // ─── Render ────────────────────────────────────────────────────────

  const hasContent = chips.length > 0 || inputValue !== '';

  return (
    <ClickAwayListener onClickAway={handleClickAway}>
      <Box sx={{ position: 'relative', flex: 1, minWidth: 0 }}>
        {/* Main tokenized grid */}
        <Box
          ref={containerRef}
          onClick={handleContainerClick}
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 0,
            px: 1,
            py: '3px',
            borderRadius: '6px',
            minHeight: 32,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#fff',
            transition: 'border-color 0.2s',
            cursor: 'text',
          }}
        >
          <SearchIcon
            sx={{
              fontSize: 14,
              color: 'text.disabled',
              flexShrink: 0,
              mr: 0.5,
            }}
          />

          {/* Existing filter chips */}
          {chips.map((chip, chipIdx) => {
            if (chip.type === 'logical' || chip.type === 'paren') {
              return (
                <Box
                  key={chip.id}
                  sx={{
                    px: '6px',
                    py: '2px',
                    mx: '2px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color:
                      chip.type === 'logical'
                        ? chip.label === 'OR'
                          ? isDark
                            ? '#e6994a'
                            : '#e65100'
                          : isDark
                            ? '#4dabf5'
                            : '#1976d2'
                        : isDark
                          ? '#9e9e9e'
                          : '#757575',
                    userSelect: 'none',
                    textTransform: 'uppercase',
                    borderRadius: '4px',
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(0,0,0,0.04)',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {chip.label}
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChip(chip.id);
                    }}
                    sx={{
                      p: 0,
                      ml: 0.5,
                      opacity: 0.5,
                      '&:hover': { opacity: 1 },
                    }}
                  >
                    <CloseIcon sx={{ fontSize: 10 }} />
                  </IconButton>
                </Box>
              );
            }

            return (
              <FilterTokenChip
                key={chip.id}
                chip={chip}
                domain={domain}
                facets={normalizedFacets}
                onUpdate={updateChip}
                onDelete={deleteChip}
                onEditToggle={(editing) => {
                  if (editing) {
                    setShowDropdown(false);
                  } else {
                    // Suppress the dropdown that focus restoration would re-open
                    suppressDropdownRef.current = true;
                  }
                }}
              />
            );
          })}

          {/* Inline input for new filters */}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onClick={handleInputClick}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            spellCheck={false}
            autoComplete="off"
            placeholder={
              chips.length === 0
                ? (placeholder ?? t('dsl.placeholder', 'Search with DSL...'))
                : ''
            }
            style={{
              flex: 1,
              minWidth: 80,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: isDark ? '#ddd' : '#333',
              fontSize: '0.8rem',
              fontWeight: 500,
              fontFamily: 'inherit',
              lineHeight: '24px',
              padding: '2px 4px',
            }}
          />

          {/* Clear button */}
          {hasContent && (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              sx={{ p: 0.2, flexShrink: 0 }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          )}
        </Box>

        {/* Suggestion dropdown */}
        {showDropdown &&
          (suggestions.length > 0 || recentSearches.length > 0) &&
          !isComposing && (
            <QuerySuggestionDropdown
              ref={dropdownRef}
              suggestions={suggestions}
              selectedIndex={selectedIndex}
              onSelect={applySuggestion}
              onSelectedIndexChange={setSelectedIndex}
              isDark={isDark}
              inputPrefix={inputValue}
              recentSearches={recentSearches}
              onSelectRecent={handleSelectRecent}
              onRemoveRecent={handleRemoveRecent}
              selectedValues={selectedValues}
            />
          )}
      </Box>
    </ClickAwayListener>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * AND/OR is only valid after a filter chip (key:value) or closing paren ')'.
 * At the start of the query or after '(' or another logical chip, AND/OR is
 * invalid and should be treated as free text message search.
 */
function canInsertLogical(chips: FilterChip[]): boolean {
  if (chips.length === 0) return false;
  const last = chips[chips.length - 1];
  if (last.type === 'filter') return true;
  if (last.type === 'paren' && last.label === ')') return true;
  return false;
}

/**
 * Parse the current typing filter input to extract its field, operator, and values.
 * e.g., 'level:in("info", "warn")' -> { field: 'level', operator: 'in', values: ['info', 'warn'] }
 */
function parseInputFilter(input: string): {
  field: string;
  operator: string;
  values: string[];
} {
  const tokens = tokenize(input);
  let field = '';
  let operator = '=';
  const values: string[] = [];

  const fieldTok = tokens.find((t) => t.type === TokenType.FIELD);
  if (fieldTok) {
    field = fieldTok.value;
  }

  const hasNotIn = tokens.some((t) => t.type === TokenType.NOT_IN);
  const hasIn = tokens.some((t) => t.type === TokenType.IN);
  const hasNe = tokens.some((t) => t.type === TokenType.NE);

  if (hasNotIn) {
    operator = '!in';
  } else if (hasIn) {
    operator = 'in';
  } else if (hasNe) {
    operator = '!=';
  } else {
    operator = '=';
  }

  let foundColon = false;
  for (const t of tokens) {
    if (t.type === TokenType.COLON) {
      foundColon = true;
      continue;
    }
    if (!foundColon) continue;

    if (t.type === TokenType.IN || t.type === TokenType.NOT_IN) {
      continue;
    }
    if (
      t.type === TokenType.LPAREN ||
      t.type === TokenType.RPAREN ||
      t.type === TokenType.COMMA
    ) {
      continue;
    }

    if (
      t.type === TokenType.STRING ||
      t.type === TokenType.NUMBER ||
      t.type === TokenType.BOOLEAN ||
      t.type === TokenType.FIELD
    ) {
      values.push(t.value);
    }
  }

  return { field, operator, values };
}
