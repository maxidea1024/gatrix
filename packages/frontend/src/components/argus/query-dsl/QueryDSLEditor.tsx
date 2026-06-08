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
  useLayoutEffect,
  useMemo,
} from 'react';
import { Box, IconButton, useTheme, ClickAwayListener } from '@mui/material';
import { Search as SearchIcon, Close as CloseIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

import type { QueryDomain, SuggestionItem } from './types';
import { TokenType, EditorState } from './types';
import { tokenize } from './lexer';
import { resolveCursorContext } from './cursor-context';
import { getSuggestions, applyCompletion } from './suggestion-engine';
import { QuerySuggestionDropdown } from './QuerySuggestionDropdown';
import type { QuerySuggestionDropdownHandle } from './QuerySuggestionDropdown';
import {
  FilterTokenGroup,
  type FilterTokenGroupHandle,
  type TokenPart,
} from './FilterTokenGroup';
import { TokenEditDropdown, type EditingPart } from './TokenEditDropdown';
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
  const [cursorOffset, setCursorOffset] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isComposing, setIsComposing] = useState(false);
  // ─── Token navigation state ───────────────────────────────────────
  const [selectedTokenIdx, setSelectedTokenIdx] = useState(-1); // -1 = input focused
  const [editingToken, setEditingToken] = useState<{
    chipId: string;
    part: EditingPart;
    anchorEl: HTMLElement;
  } | null>(null);
  const tokenGroupRefs = useRef<Map<string, FilterTokenGroupHandle>>(new Map());
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
    () => resolveCursorContext(inputValue, cursorOffset, tokens),
    [inputValue, cursorOffset, tokens]
  );

  // Support logical operator chips explicitly
  // Suppress suggestions when cursor is inside a quoted string (e.g., level:"")
  const suggestions = useMemo(() => {
    if (cursorContext.editorState === EditorState.IN_QUOTED_STRING) {
      return [];
    }
    return getSuggestions(
      cursorContext,
      domain,
      normalizedFacets,
      maxSuggestions,
      chips
    );
  }, [cursorContext, domain, normalizedFacets, maxSuggestions, chips]);

  // ─── Visual token index computation ─────────────────────────────────

  type VisualTokenRef = {
    chipId: string;
    part: 'field' | 'operator' | 'value' | 'logical' | 'paren';
  };

  const visualTokens: VisualTokenRef[] = useMemo(() => {
    return chips.flatMap((chip): VisualTokenRef[] => {
      if (chip.type === 'logical' || chip.type === 'paren') {
        return [{ chipId: chip.id, part: chip.type as 'logical' | 'paren' }];
      }
      const isHas = chip.field === 'has' || chip.field === '!has';
      if (isHas) {
        return [
          { chipId: chip.id, part: 'field' },
          { chipId: chip.id, part: 'value' },
        ];
      }
      return [
        { chipId: chip.id, part: 'field' },
        { chipId: chip.id, part: 'operator' },
        { chipId: chip.id, part: 'value' },
      ];
    });
  }, [chips]);

  // ─── Chip operations ──────────────────────────────────────────────

  const updateChip = useCallback(
    (
      chipId: string,
      updates: Partial<
        Pick<
          FilterChip,
          'field' | 'operator' | 'value' | 'values' | 'composingPart'
        >
      >
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
      setSelectedTokenIdx(-1);
      setEditingToken(null);
    },
    [setChips]
  );

  /** Handle click on a token part (field/operator/value) */
  const handlePartClick = useCallback(
    (chipId: string, part: TokenPart, anchorEl: HTMLElement) => {
      // Don't open while composing input
      if (inputValue.trim()) return;
      setEditingToken({ chipId, part, anchorEl });
      setShowDropdown(false);
      chipEditingRef.current = true;
    },
    [inputValue]
  );

  /** Handle update from TokenEditDropdown */
  const handleTokenUpdate = useCallback(
    (chipId: string, updates: Partial<FilterChip>) => {
      updateChip(chipId, updates);
    },
    [updateChip]
  );

  /** Close token editing dropdown */
  const handleEditClose = useCallback(() => {
    setEditingToken(null);
    chipEditingRef.current = false;
    // Suppress dropdown re-open on focus restoration
    suppressDropdownRef.current = true;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  // ─── Input handlers ───────────────────────────────────────────────

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInputValue(val);
      setCursorOffset(e.target.selectionStart ?? val.length);
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
      // Block auto-commit while multi-selecting values via checkboxes
      if (isMultiSelectingRef.current) return;
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
          setCursorOffset(0);
          setShowDropdown(false);
          setSelectedIndex(-1);

          suppressDropdownRef.current = true;
          requestAnimationFrame(() => {
            if (inputRef.current) {
              inputRef.current.focus();
              inputRef.current.setSelectionRange(0, 0);
            }
          });
          return;
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
          setCursorOffset(0);
          setShowDropdown(false);
          setSelectedIndex(-1);

          suppressDropdownRef.current = true;
          requestAnimationFrame(() => {
            if (inputRef.current) {
              inputRef.current.focus();
              inputRef.current.setSelectionRange(0, 0);
            }
          });
          return;
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
        setCursorOffset(0);
        setShowDropdown(false);
        setSelectedIndex(-1);

        suppressDropdownRef.current = true;
        requestAnimationFrame(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.setSelectionRange(0, 0);
          }
        });
        return;
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

            let nextOp = operator || '=';
            // Fallback for migrated old queries that might still have !in/in stored somehow
            if (nextOp === 'in') nextOp = '=';
            if (nextOp === '!in') nextOp = '!=';

            let nextInput = '';
            const quotedValues = nextValues.map((v) => `"${v}"`).join(', ');

            if (nextValues.length === 0) {
              nextInput =
                nextOp === '=' ? `${field}:[]` : `${field}:${nextOp}[]`;
            } else {
              // Always use bracketed form during multi-select to keep FSM in VALUE state.
              // Single-value without brackets (level:"debug") is only for final chip commit (single click).
              nextInput =
                nextOp === '='
                  ? `${field}:[${quotedValues}]`
                  : `${field}:${nextOp}[${quotedValues}]`;
            }

            const cursorPos =
              nextInput.length - (nextInput.endsWith(']') ? 1 : 0);

            setInputValue(nextInput);
            setCursorOffset(cursorPos);
            setShowDropdown(true);
            setSelectedIndex(-1);

            // Mark as composing multi-select
            isMultiSelectingRef.current = true;

            // Keep dropdown open — do NOT suppress
            requestAnimationFrame(() => {
              if (inputRef.current) {
                inputRef.current.focus();
                inputRef.current.setSelectionRange(cursorPos, cursorPos);
              }
            });
            return;
          }
        } else {
          // Single-value mode or fallback
          let finalInput = result.text;

          // Rebuild the filter to ensure any partial parenthesis or multi-value state is discarded
          if (
            currentFilterInfo.field &&
            !item.description?.startsWith('dsl.smart.')
          ) {
            const field = currentFilterInfo.field;
            let op = currentFilterInfo.operator || '=';
            if (op === 'in') op = '=';
            if (op === '!in') op = '!=';

            const funcOps = [
              'contains',
              '!contains',
              'startsWith',
              '!startsWith',
              'endsWith',
              '!endsWith',
              'before',
              'after',
            ];
            if (funcOps.includes(op)) {
              finalInput = `${field}:${op}("${item.label.replace(/"/g, '\\"')}")`;
            } else {
              const needsQuotes =
                item.label.includes(' ') ||
                item.label.includes('"') ||
                item.label.includes('(') ||
                item.label.includes(')') ||
                item.label === '';
              const escaped = needsQuotes
                ? `"${item.label.replace(/"/g, '\\"')}"`
                : item.label;
              finalInput =
                op === '=' ? `${field}:${escaped}` : `${field}:${op}${escaped}`;
            }
          }

          // Value → try to create filter chips
          const completedChips = queryToChips(finalInput);
          if (completedChips.length > 0) {
            setChips((prev) => [...prev, ...completedChips]);
            setInputValue('');
            setCursorOffset(0);
            setShowDropdown(false);
            setSelectedIndex(-1);

            suppressDropdownRef.current = true;
            requestAnimationFrame(() => {
              if (inputRef.current) {
                inputRef.current.focus();
                inputRef.current.setSelectionRange(0, 0);
              }
            });
            return;
          } else {
            setInputValue(finalInput);
            setCursorOffset(finalInput.length);
            setShowDropdown(true);
            setSelectedIndex(-1);

            suppressDropdownRef.current = true;
            requestAnimationFrame(() => {
              if (inputRef.current) {
                inputRef.current.focus();
                inputRef.current.setSelectionRange(
                  finalInput.length,
                  finalInput.length
                );
              }
            });
            return;
          }
        }
      } else {
        // Field or operator selected → keep dropdown open for next step
        setInputValue(result.text);
        setCursorOffset(result.cursorOffset);
        setShowDropdown(true);
        setSelectedIndex(-1);

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
        return;
      }
    },
    [inputValue, cursorContext, setChips, chips, currentFilterInfo]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Update cursor offset for navigation keys
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
        // Need to wait for browser to update selection
        requestAnimationFrame(() => {
          if (inputRef.current) {
            setCursorOffset(inputRef.current.selectionStart ?? 0);
          }
        });
      }

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
      // Left/Right arrow keys → token navigation (when input is empty)
      if (e.key === 'ArrowLeft' && inputValue === '') {
        e.preventDefault();
        if (showDropdown && selectedTokenIdx < 0) {
          dropdownRef.current?.prevTab();
          return;
        }
        if (visualTokens.length > 0) {
          setShowDropdown(false);
          setSelectedTokenIdx((prev) => {
            if (prev <= 0) return visualTokens.length - 1;
            return prev - 1;
          });
        }
        return;
      }
      if (e.key === 'ArrowRight' && inputValue === '') {
        e.preventDefault();
        if (showDropdown && selectedTokenIdx < 0) {
          dropdownRef.current?.nextTab();
          return;
        }
        if (visualTokens.length > 0) {
          setShowDropdown(false);
          if (selectedTokenIdx < 0) {
            // Start from first token
            setSelectedTokenIdx(0);
          } else if (selectedTokenIdx >= visualTokens.length - 1) {
            setSelectedTokenIdx(-1); // back to input
            inputRef.current?.focus();
          } else {
            setSelectedTokenIdx((prev) => prev + 1);
          }
        }
        return;
      }
      // Enter or Space on selected token → open editing dropdown (same as click)
      if (
        (e.key === 'Enter' || e.key === ' ') &&
        selectedTokenIdx >= 0 &&
        inputValue === ''
      ) {
        e.preventDefault();
        const token = visualTokens[selectedTokenIdx];
        if (
          token &&
          (token.part === 'field' ||
            token.part === 'operator' ||
            token.part === 'value')
        ) {
          const groupHandle = tokenGroupRefs.current.get(token.chipId);
          const el = groupHandle?.getPartEl(token.part);
          if (el) {
            handlePartClick(token.chipId, token.part, el);
          }
        }
        return;
      }
      // Escape on selected token → deselect
      if (e.key === 'Escape' && selectedTokenIdx >= 0) {
        e.preventDefault();
        setSelectedTokenIdx(-1);
        inputRef.current?.focus();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        // Finalize multi-select composing state
        isMultiSelectingRef.current = false;
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
        // Finalize multi-select composing state
        isMultiSelectingRef.current = false;
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
        e.preventDefault();
        if (selectedTokenIdx >= 0 && selectedTokenIdx < visualTokens.length) {
          // Delete selected token appropriately
          const token = visualTokens[selectedTokenIdx];
          if (
            token.part === 'field' ||
            token.part === 'logical' ||
            token.part === 'paren'
          ) {
            // Delete entire chip
            deleteChip(token.chipId);
          } else if (token.part === 'value') {
            // Clear value only
            updateChip(token.chipId, { value: '', values: [] });
          } else if (token.part === 'operator') {
            // Clear operator + value
            updateChip(token.chipId, { operator: '=', value: '', values: [] });
          }
          setSelectedTokenIdx(-1);
        } else {
          // No token selected → delete last chip
          setChips((prev) => prev.slice(0, -1));
        }
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
  const containerRef2 = useRef<HTMLDivElement>(null);
  // Stays true while any chip popover is open — blocks main dropdown entirely
  const chipEditingRef = useRef(false);
  // True while user is multi-selecting values via checkboxes (composing state)
  const isMultiSelectingRef = useRef(false);

  // Force-commit pending input as chip(s)
  const commitPendingInput = useCallback(() => {
    const text = inputValue.trim();
    if (text) {
      commitInputAsChip(text);
      setShowDropdown(false);
    }
  }, [inputValue, commitInputAsChip]);

  const handleFocus = useCallback(() => {
    if (suppressDropdownRef.current) {
      suppressDropdownRef.current = false;
      return;
    }
    // Don't show main dropdown while a chip is being edited
    if (chipEditingRef.current) return;
    // Clear token selection when input gains focus
    setSelectedTokenIdx(-1);
    // Always show dropdown on focus
    setShowDropdown(true);
    setSelectedIndex(-1);
    justFocusedRef.current = true;
  }, []);

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      // Don't do anything while a chip is being edited
      if (chipEditingRef.current) return;
      // Don't commit if focus moved to the dropdown (mouseDown on suggestion)
      const related = e.relatedTarget as HTMLElement | null;
      if (related && containerRef2.current?.contains(related)) {
        return;
      }
      // If dropdown is visible, the blur was likely caused by clicking inside
      // the dropdown area (which uses preventDefault). Don't commit here —
      // handleClickAway will handle real outside clicks.
      if (showDropdown) return;
      // Real blur (focus left the editor) — finalize multi-select and commit
      isMultiSelectingRef.current = false;
      // Force-commit any composing input
      if (inputValue.trim()) {
        commitPendingInput();
      }
      justFocusedRef.current = false;
    },
    [inputValue, commitPendingInput, showDropdown]
  );

  const handleInputClick = useCallback(
    (e: React.MouseEvent<HTMLInputElement>) => {
      setCursorOffset(
        (e.target as HTMLInputElement).selectionStart ?? inputValue.length
      );
      if (justFocusedRef.current) {
        justFocusedRef.current = false;
        return;
      }
      // If composing a filter (has colon), force commit it
      if (inputValue.includes(':')) {
        isMultiSelectingRef.current = false;
        commitPendingInput();
        return;
      }
      // Re-click on already-focused input → toggle
      setShowDropdown((prev) => !prev);
      setSelectedIndex(-1);
    },
    [inputValue, commitPendingInput]
  );

  const handleClickAway = useCallback(() => {
    // Ignore click-away during multi-select composing or chip editing
    // (Popover/dropdown render via Portal, outside ClickAwayListener wrapper)
    if (isMultiSelectingRef.current) return;
    if (chipEditingRef.current) return;
    // Force-commit any composing input when clicking outside
    if (inputValue.trim()) {
      commitPendingInput();
    }
    setShowDropdown(false);
    justFocusedRef.current = false;
  }, [inputValue, commitPendingInput]);

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    // Don't focus input if clicking on a chip (chip handles its own click)
    if ((e.target as HTMLElement).closest('[data-chip]')) return;
    // Clear token selection and focus input
    setSelectedTokenIdx(-1);
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

  // Mirror element for measuring cursor position → dropdown left offset
  const mirrorRef = useRef<HTMLSpanElement>(null);
  const [dropdownLeft, setDropdownLeft] = useState(0);
  useLayoutEffect(() => {
    // Lock position during multi-select to avoid jumping
    if (isMultiSelectingRef.current) return;
    if (!inputRef.current) {
      setDropdownLeft(0);
      return;
    }
    const inputLeft = inputRef.current.offsetLeft;
    if (!inputValue || !mirrorRef.current) {
      setDropdownLeft(inputLeft);
      return;
    }
    // Measure text width up to cursor
    mirrorRef.current.textContent = inputValue.slice(0, cursorOffset);
    const textWidth = mirrorRef.current.offsetWidth;
    setDropdownLeft(inputLeft + textWidth);
  }, [inputValue, cursorOffset, chips.length]);

  return (
    <ClickAwayListener onClickAway={handleClickAway}>
      <Box
        ref={containerRef2}
        sx={{ position: 'relative', flex: 1, minWidth: 0 }}
      >
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

            // Find which part of this chip is selected (if any)
            const chipSelectedPart = (() => {
              if (selectedTokenIdx < 0) return null;
              const vt = visualTokens[selectedTokenIdx];
              if (
                vt &&
                vt.chipId === chip.id &&
                (vt.part === 'field' ||
                  vt.part === 'operator' ||
                  vt.part === 'value')
              ) {
                return vt.part as TokenPart;
              }
              return null;
            })();

            return (
              <FilterTokenGroup
                key={chip.id}
                ref={(handle) => {
                  if (handle) {
                    tokenGroupRefs.current.set(chip.id, handle);
                  } else {
                    tokenGroupRefs.current.delete(chip.id);
                  }
                }}
                chip={chip}
                domain={domain}
                selectedPart={chipSelectedPart}
                onPartClick={handlePartClick}
                onDelete={deleteChip}
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
            onBlur={handleBlur}
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
              // Hide caret when a token is selected (token selection IS the cursor)
              caretColor: selectedTokenIdx >= 0 ? 'transparent' : undefined,
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

          {/* Hidden mirror span for cursor position measurement */}
          <span
            ref={mirrorRef}
            aria-hidden
            style={{
              position: 'absolute',
              visibility: 'hidden',
              whiteSpace: 'pre',
              fontSize: '0.8rem',
              fontWeight: 500,
              fontFamily: 'inherit',
              pointerEvents: 'none',
            }}
          />
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
              dropdownLeft={dropdownLeft}
            />
          )}

        {/* Token edit dropdown (field/operator/value editing) */}
        {editingToken && (
          <TokenEditDropdown
            type={editingToken.part}
            chip={chips.find((c) => c.id === editingToken.chipId)!}
            domain={domain}
            facets={normalizedFacets}
            anchorEl={editingToken.anchorEl}
            onUpdate={(updates) =>
              handleTokenUpdate(editingToken.chipId, updates)
            }
            onClose={handleEditClose}
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

  for (const t of tokens) {
    if (
      t.type === TokenType.NE ||
      t.type === TokenType.GT ||
      t.type === TokenType.GTE ||
      t.type === TokenType.LT ||
      t.type === TokenType.LTE ||
      t.type === TokenType.CONTAINS ||
      t.type === TokenType.STARTS_WITH ||
      t.type === TokenType.ENDS_WITH ||
      t.type === TokenType.NOT_CONTAINS ||
      t.type === TokenType.NOT_STARTS_WITH ||
      t.type === TokenType.NOT_ENDS_WITH ||
      t.type === TokenType.BEFORE ||
      t.type === TokenType.AFTER
    ) {
      operator = String(t.value);
    }
  }

  let foundColon = false;
  for (const t of tokens) {
    if (t.type === TokenType.COLON) {
      foundColon = true;
      continue;
    }
    if (!foundColon) continue;

    if (
      t.type === TokenType.LPAREN ||
      t.type === TokenType.RPAREN ||
      t.type === TokenType.LBRACKET ||
      t.type === TokenType.RBRACKET ||
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
