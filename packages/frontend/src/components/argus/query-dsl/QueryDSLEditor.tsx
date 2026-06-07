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

  const refreshRecent = useCallback(() => {
    setRecentSearches(getRecentSearches(domain));
  }, [domain]);

  const handleSelectRecent = useCallback(
    (query: string) => {
      resetTo(queryToChips(query));
      setInputValue('');
      setShowDropdown(false);
      onSearch(query);
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
      getSuggestions(cursorContext, domain, normalizedFacets, maxSuggestions),
    [cursorContext, domain, normalizedFacets, maxSuggestions]
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

  const applySuggestion = useCallback(
    (item: SuggestionItem) => {
      const result = applyCompletion(inputValue, cursorContext, item);

      if (
        item.category === 'value' ||
        item.category === 'logical' ||
        item.category === 'paren'
      ) {
        // Value selected → try to create chip
        const completedChips = queryToChips(result.text);
        if (completedChips.length > 0) {
          // Chip created → close dropdown
          setChips((prev) => [...prev, ...completedChips]);
          setInputValue('');
          setShowDropdown(false);
          setSelectedIndex(-1);
        } else {
          // Value inserted but filter not yet complete → keep dropdown for more input
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
    [inputValue, cursorContext, setChips]
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
        if (showDropdown && suggestions.length > 0) {
          applySuggestion(suggestions[selectedIndex >= 0 ? selectedIndex : 0]);
        } else if (inputValue.trim()) {
          const parsed = queryToChips(inputValue);
          if (parsed.length > 0) {
            setChips((prev) => [...prev, ...parsed]);
            setInputValue('');
          }
          setShowDropdown(false);
        }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (showDropdown && selectedIndex >= 0 && suggestions.length > 0) {
          applySuggestion(suggestions[selectedIndex]);
        } else if (inputValue.trim()) {
          // Try to parse and create chip from current input
          const parsed = queryToChips(inputValue);
          if (parsed.length > 0) {
            setChips((prev) => [...prev, ...parsed]);
            setInputValue('');
          }
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
            />
          )}
      </Box>
    </ClickAwayListener>
  );
}
