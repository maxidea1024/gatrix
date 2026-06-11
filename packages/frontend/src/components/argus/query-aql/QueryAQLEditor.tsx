/**
 * QueryAQLEditor — Sentry-style tokenized grid editor.
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
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  Box,
  IconButton,
  useTheme,
  ClickAwayListener,
  Popover,
  List,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  Check as CheckIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import SafeTooltip from '@/components/common/SafeTooltip';

import type { DomainConfig, SuggestionItem } from './types';
import { TokenType, EditorState } from './types';
import { tokenize } from './lexer';
import { resolveCursorContext } from './cursor-context';
import {
  getSuggestions,
  applyCompletion,
  isIncompleteQuery,
} from './suggestion-engine';
import { QuerySuggestionDropdown } from './QuerySuggestionDropdown';
import type { QuerySuggestionDropdownHandle } from './QuerySuggestionDropdown';
import {
  FilterTokenGroup,
  type FilterTokenGroupHandle,
  type TokenPart,
} from './FilterTokenGroup';
import { TokenEditDropdown, type EditingPart } from './TokenEditDropdown';
import { queryToChips, chipsToQuery, type FilterChip } from './useFilterChips';
import { getFieldByKey } from './fields';
import { useLazyFacets, type FetchFieldValues } from './useLazyFacets';
import {
  DATETIME_PRESET_COUNT,
  DATETIME_NAVIGABLE_COUNT,
  RELATIVE_PRESETS,
} from './DatetimeValueEditor';
import {
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  type RecentSearch,
} from './recent-searches';
import QueryBuilderPanel from '../QueryBuilderPanel';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface QueryAQLEditorProps {
  config: DomainConfig;
  initialQuery?: string;
  onSearch: (query: string) => void;
  /** Called whenever the query changes (for parent state sync) */
  onChange?: (query: string) => void;
  /** Lazy-loading callback: fetches values for a specific field on demand */
  fetchFieldValues?: FetchFieldValues;
  /** Pre-loaded facets from the page (e.g., discovered attribute facets).
   *  These are seeded into the suggestion cache so dynamic fields like
   *  game.shard, server.name appear in suggestions immediately. */
  initialFacets?: Map<string, string[]> | Record<string, any>;
  placeholder?: string;
  maxSuggestions?: number;
}

/** Imperative handle for external filter integration */
export interface QueryAQLEditorHandle {
  /** Set values for a field chip (add if missing, update if exists, remove if values empty) */
  upsertFieldChip: (field: string, values: string[], operator?: string) => void;
  /** Remove all chips matching a field key */
  removeFieldChip: (field: string) => void;
  /** Get current values for a field from chips */
  getFieldValues: (field: string) => string[];
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

export const QueryAQLEditor = forwardRef<
  QueryAQLEditorHandle,
  QueryAQLEditorProps
>(function QueryAQLEditor(
  {
    config,
    initialQuery = '',
    onSearch,
    onChange,
    fetchFieldValues,
    initialFacets,
    placeholder,
    maxSuggestions = 20,
  },
  ref
) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<QuerySuggestionDropdownHandle>(null);
  // Stable ref for onChange to avoid useEffect re-fire
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // ─── Aggregate function names set (for parser/chip disambiguation) ──
  const aggregateNames = useMemo(
    () => new Set(config.aggregates?.map((a) => a.name.toLowerCase()) ?? []),
    [config.aggregates]
  );

  // ─── State ───────────────────────────────────────────────────────────

  const { chips, setChips, undo, redo, resetTo } = useChipHistory(
    () => queryToChips(initialQuery, aggregateNames)
  );
  const [inputValue, setInputValue] = useState('');
  const [cursorOffset, setCursorOffset] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isComposing, setIsComposing] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  // ─── Token navigation state ───────────────────────────────────────
  const [selectedTokenIdx, setSelectedTokenIdx] = useState(-1); // -1 = input focused
  const [editingToken, setEditingToken] = useState<{
    chipId: string;
    part: EditingPart;
    anchorEl: HTMLElement;
  } | null>(null);
  const [logicalMenu, setLogicalMenu] = useState<{
    chipId: string;
    anchorEl: HTMLElement;
    highlightIdx: number;
  } | null>(null);
  const tokenGroupRefs = useRef<Map<string, FilterTokenGroupHandle>>(new Map());
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(() =>
    getRecentSearches(config.name)
  );

  // ─── Inline value editing state ──────────────────────────────────
  const [inlineValueText, setInlineValueText] = useState('');
  const [popoverHighlightIdx, setPopoverHighlightIdx] = useState(-1);
  const [highlightedPillIdx, setHighlightedPillIdx] = useState(-1);
  const originalValueRef = useRef<{ value: string; values: string[] }>({
    value: '',
    values: [],
  });
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inlineValueDirtyRef = useRef(false);

  const currentFilterInfo = useMemo(
    () => parseInputFilter(inputValue),
    [inputValue]
  );
  const selectedValues = useMemo(
    () => new Set(currentFilterInfo.values),
    [currentFilterInfo]
  );

  const refreshRecent = useCallback(() => {
    setRecentSearches(getRecentSearches(config.name));
  }, [config.name]);

  // Ref to suppress onChange during programmatic chip updates (e.g. recent selection)
  const suppressOnChangeRef = useRef(false);
  const lastInternalQueryRef = useRef<string | null>(null);

  const handleSelectRecent = useCallback(
    (query: string) => {
      // Suppress onChange to prevent it from sending empty query to URL
      // before resetTo commits the new chips
      suppressOnChangeRef.current = true;
      resetTo(queryToChips(query, aggregateNames));
      setInputValue('');
      setShowDropdown(false);
      // Track that this update was initiated internally so the sync effect won't re-reset
      lastInternalQueryRef.current = query;
      // Delay onSearch to next tick so chips state is committed first
      requestAnimationFrame(() => {
        suppressOnChangeRef.current = false;
        onSearch(query);
      });
    },
    [resetTo, onSearch, aggregateNames]
  );

  const handleRemoveRecent = useCallback(
    (query: string) => {
      removeRecentSearch(config.name, query);
      refreshRecent();
    },
    [config.name, refreshRecent]
  );

  // ─── Sync initialQuery → chips when it changes externally ──────────
  const prevInitialQuery = useRef(initialQuery);
  useEffect(() => {
    if (initialQuery !== prevInitialQuery.current) {
      const standardInitial = chipsToQuery(queryToChips(initialQuery, aggregateNames));
      const standardLastInternal = lastInternalQueryRef.current
        ? chipsToQuery(queryToChips(lastInternalQueryRef.current, aggregateNames))
        : null;
      const isInternalCatchUp = standardInitial === standardLastInternal;

      prevInitialQuery.current = initialQuery;
      if (isInternalCatchUp) {
        lastInternalQueryRef.current = null;
      } else {
        resetTo(queryToChips(initialQuery, aggregateNames));
        setInputValue('');
      }
    }
  }, [initialQuery, resetTo, aggregateNames]);

  const {
    getFieldValues,
    getCachedFacetMap,
    ensureFieldValues,
    isFieldLoading,
  } = useLazyFacets(fetchFieldValues, initialFacets);

  const normalizedFacets = getCachedFacetMap();

  // ─── Imperative handle for external filter integration ─────────────
  useImperativeHandle(
    ref,
    () => ({
      upsertFieldChip(field: string, values: string[], operator?: string) {
        if (values.length === 0) {
          // Remove all chips with this field
          setChips((prev) => {
            const next = prev.filter((c) => c.field !== field);
            requestAnimationFrame(() => {
              const query = chipsToQuery(next);
              prevInitialQuery.current = query;
              lastInternalQueryRef.current = query;
              onChangeRef.current?.(query);
              onSearch(query);
            });
            return next;
          });
          return;
        }
        setChips((prev) => {
          const existing = prev.find(
            (c) => c.type === 'filter' && c.field === field
          );
          let next: FilterChip[];
          if (existing) {
            next = prev.map((c) =>
              c.id === existing.id
                ? {
                    ...c,
                    value: values[0],
                    values,
                    operator:
                      operator ??
                      (values.length > 1 ? 'IN' : (c.operator ?? '=')),
                  }
                : c
            );
          } else {
            const newChip: FilterChip = {
              id: `chip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              type: 'filter',
              field,
              operator: operator ?? (values.length > 1 ? 'IN' : '='),
              value: values[0],
              values,
            };
            next = [...prev, newChip];
          }
          requestAnimationFrame(() => {
            const query = chipsToQuery(next);
            prevInitialQuery.current = query;
            lastInternalQueryRef.current = query;
            onChangeRef.current?.(query);
            onSearch(query);
          });
          return next;
        });
      },
      removeFieldChip(field: string) {
        setChips((prev) => {
          const next = prev.filter((c) => c.field !== field);
          requestAnimationFrame(() => {
            const query = chipsToQuery(next);
            prevInitialQuery.current = query;
            lastInternalQueryRef.current = query;
            onChangeRef.current?.(query);
            onSearch(query);
          });
          return next;
        });
      },
      getFieldValues(field: string): string[] {
        const chip = chips.find(
          (c) => c.type === 'filter' && c.field === field
        );
        if (!chip) return [];
        return (
          chip.values?.filter((v) => v !== '') ??
          (chip.value ? [chip.value] : [])
        );
      },
    }),
    [chips, setChips, onSearch]
  );

  // ─── Notify parent of chip changes ─────────────────────────────────

  useEffect(() => {
    // Skip onChange during programmatic updates (e.g. recent selection)
    // to prevent race condition where empty chips trigger URL clear
    if (suppressOnChangeRef.current) return;
    // Skip notifying parent while editing a chip to prevent external initialQuery sync from closing the dropdown
    if (chipEditingRef.current || editingToken !== null) return;
    // Skip notifying parent if there is an active composing chip (incomplete filter)
    if (chips.some((c) => c.composingPart !== undefined)) return;
    const query = chipsToQuery(chips);
    // Pre-update so the initialQuery sync effect won't re-reset
    // when parent echoes back the same query
    prevInitialQuery.current = query;
    lastInternalQueryRef.current = query;
    onChangeRef.current?.(query);
  }, [chips, editingToken]);

  // ─── Suggestion engine for inline input ────────────────────────────

  const tokens = useMemo(() => tokenize(inputValue), [inputValue]);
  const cursorContext = useMemo(
    () => resolveCursorContext(inputValue, cursorOffset, tokens),
    [inputValue, cursorOffset, tokens]
  );

  // Trigger lazy fetch when cursor context needs field values
  useEffect(() => {
    if (
      (cursorContext.type === 'VALUE' || cursorContext.type === 'OPERATOR') &&
      cursorContext.field
    ) {
      ensureFieldValues(cursorContext.field);
    }
  }, [cursorContext.type, cursorContext.field, ensureFieldValues]);

  // Support logical operator chips explicitly
  // Suppress suggestions when cursor is inside a quoted string (e.g., level:"")
  const suggestions = useMemo(() => {
    // Suppress suggestions when cursor is inside a quoted string,
    // EXCEPT for datetime fields which should show presets (now-1h, etc.)
    // and 'has'/'!has' fields which should suggest property keys.
    if (cursorContext.editorState === EditorState.IN_QUOTED_STRING) {
      const ctxField = cursorContext.field
        ? getFieldByKey(cursorContext.field, config)
        : null;
      const isHasField =
        cursorContext.field?.toLowerCase() === 'has' ||
        cursorContext.field?.toLowerCase() === '!has';
      if (ctxField?.type !== 'datetime' && !isHasField) {
        return [];
      }
    }
    return getSuggestions(
      cursorContext,
      config,
      normalizedFacets,
      maxSuggestions,
      chips
    );
  }, [cursorContext, config, normalizedFacets, maxSuggestions, chips]);

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
          'field' | 'operator' | 'value' | 'values' | 'composingPart' | 'label'
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

      if (part === 'value') {
        const chip = chips.find((c) => c.id === chipId);
        const isHas = chip?.field === 'has' || chip?.field === '!has';
        if (!isHas) {
          // Start inline value editing
          originalValueRef.current = {
            value: chip?.value ?? '',
            values: [...(chip?.values ?? [])],
          };
          const isComposingChip = !!chip?.composingPart;
          // Existing values are shown as pill tags; input starts empty for new values
          const textVal = '';
          setInlineValueText(textVal);
          setPopoverHighlightIdx(-1);
          inlineValueDirtyRef.current = false;
          // Use chip container as anchor for stability
          const chipEl =
            (anchorEl.closest('[data-chip]') as HTMLElement) || anchorEl;
          setEditingToken({ chipId, part, anchorEl: chipEl });
          setShowDropdown(false);
          chipEditingRef.current = true;
          return;
        }
      }

      setEditingToken({ chipId, part, anchorEl });
      setShowDropdown(false);
      chipEditingRef.current = true;

      // Lazy-load field values for the chip being edited
      const editChip = chips.find((c) => c.id === chipId);
      if (editChip?.field) {
        ensureFieldValues(editChip.field);
      }
    },
    [inputValue, chips, ensureFieldValues]
  );

  /** Handle update from TokenEditDropdown */
  const skipEditCloseRef = useRef(false);
  const skipDeleteOnCloseRef = useRef(false);

  const handleTokenUpdate = useCallback(
    (chipId: string, updates: Partial<FilterChip>) => {
      // Find the current chip to check composing state
      const chip = chips.find((c) => c.id === chipId);

      if (chip?.composingPart === 'operator' && updates.operator) {
        // Operator selected during step-by-step → chain to value
        updateChip(chipId, { ...updates, composingPart: 'value' });
        skipEditCloseRef.current = true;
        // useEffect will auto-open value dropdown after render
        return;
      }

      if (chip?.composingPart === 'value') {
        // Value selected during step-by-step → complete chip only if not a multi-value select in progress
        const shouldComplete = !updates.values || 'composingPart' in updates;
        if (shouldComplete) {
          skipDeleteOnCloseRef.current = true;
          updateChip(chipId, { ...updates, composingPart: undefined });
          return;
        }
      }

      // Normal (non-composing) update
      updateChip(chipId, updates);
    },
    [updateChip, chips]
  );

  /** Close token editing dropdown */
  const handleEditClose = useCallback(() => {
    // Skip close when chaining composing steps (operator → value)
    if (skipEditCloseRef.current) {
      skipEditCloseRef.current = false;
      return;
    }

    // If chip was composing and closed without completing, delete it
    if (editingToken) {
      const chip = chips.find((c) => c.id === editingToken.chipId);
      if (chip?.composingPart && !skipDeleteOnCloseRef.current) {
        const hasValue = chip.value || (chip.values && chip.values.length > 0);
        if (hasValue) {
          // Has selected values → finalize
          updateChip(editingToken.chipId, { composingPart: undefined });
        } else {
          // Truly empty/incomplete composing chip → delete
          deleteChip(editingToken.chipId);
        }
        setEditingToken(null);
        chipEditingRef.current = false;
        suppressDropdownRef.current = true;
        requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }
    }

    // Always reset the ref
    skipDeleteOnCloseRef.current = false;

    setEditingToken(null);
    chipEditingRef.current = false;
    suppressDropdownRef.current = true;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [editingToken, chips, deleteChip, updateChip]);

  // ─── Inline value editing handlers ──────────────────────────────────

  /** Set of currently selected values from the chip being edited.
   *  Uses chip.values directly — NOT comma-split from inlineValueText,
   *  because values themselves can contain commas (e.g., log messages). */
  const inlineSelectedValues = useMemo(() => {
    if (!editingToken) return new Set<string>();
    const chip = chips.find((c) => c.id === editingToken.chipId);
    const vals = chip?.values?.filter((v) => v !== '') ?? [];
    // Fallback: single-value chips may only have chip.value without chip.values
    if (vals.length === 0 && chip?.value) return new Set([chip.value]);
    return new Set(vals);
  }, [editingToken, chips]);

  /** Close inline editing and return focus to main input */
  const closeInlineEdit = useCallback(() => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setEditingToken(null);
    chipEditingRef.current = false;
    setInlineValueText('');
    setPopoverHighlightIdx(-1);
    setHighlightedPillIdx(-1);
    skipDeleteOnCloseRef.current = true;
    suppressDropdownRef.current = true;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  /** Commit inline edit: use chip.values as source of truth.
   *  If user manually typed (dirty), parse from inlineValueText;
   *  otherwise use chip.values directly to avoid comma-in-value issues. */
  const commitInlineEdit = useCallback(
    (chipId: string) => {
      let vals: string[];
      if (inlineValueDirtyRef.current) {
        // User manually typed → treat entire text as single value (no comma splitting)
        const trimmed = inlineValueText.trim();
        const chip = chips.find((c) => c.id === chipId);
        const existing = chip?.values?.filter((v) => v !== '') ?? [];
        if (trimmed) {
          if (!existing.includes(trimmed)) {
            vals = [...existing, trimmed];
          } else {
            vals = existing.length > 0 ? existing : [trimmed];
          }
        } else {
          vals = existing;
        }
      } else {
        // Checkbox-only edits → use chip.values directly
        const chip = chips.find((c) => c.id === chipId);
        vals = chip?.values?.filter((v) => v !== '') ?? [];
      }

      if (vals.length === 0) {
        // All values removed → delete the chip
        deleteChip(chipId);
        closeInlineEdit();
        return;
      }
      updateChip(chipId, {
        value: vals[0],
        values: vals,
        composingPart: undefined,
      });
      closeInlineEdit();
    },
    [inlineValueText, chips, updateChip, deleteChip, closeInlineEdit]
  );

  /** Revert inline edit: restore original values */
  const revertInlineEdit = useCallback(
    (chipId: string) => {
      const orig = originalValueRef.current;
      if (!orig.value && orig.values.length === 0) {
        // Composing with no original value → delete chip
        deleteChip(chipId);
      } else {
        updateChip(chipId, { value: orig.value, values: orig.values });
      }
      closeInlineEdit();
    },
    [updateChip, deleteChip, closeInlineEdit]
  );

  /** Handle inline text change */
  const handleInlineValueChange = useCallback(
    (_chipId: string, text: string) => {
      setInlineValueText(text);
      setPopoverHighlightIdx(-1);
      setHighlightedPillIdx(-1);
      inlineValueDirtyRef.current = true;
    },
    []
  );

  /** Handle inline input blur → commit (with cancellable timeout) */
  const handleInlineValueBlur = useCallback(
    (chipId: string) => {
      // Datetime fields: don't auto-commit on blur.
      // The DateTimePicker manages values via onSelect callback,
      // and blur fires when its calendar popup opens (stealing focus).
      const blurredChip = chips.find((c) => c.id === chipId);
      const blurredField = getFieldByKey(blurredChip?.field ?? '', config);
      if (blurredField?.type === 'datetime') return;

      // Cancel any previous pending blur
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
      // Small delay to allow click on popover list items to cancel this
      blurTimeoutRef.current = setTimeout(() => {
        blurTimeoutRef.current = null;
        // Check if we're still editing this chip
        if (chipEditingRef.current) {
          commitInlineEdit(chipId);
        }
      }, 200);
    },
    [chips, config, commitInlineEdit]
  );

  /** Toggle a value from popover checkbox or keyboard selection.
   *  Uses chip.values directly to avoid comma-in-value issues. */
  const handleInlineCheckboxToggle = useCallback(
    (value: string) => {
      if (!editingToken) return;
      // Cancel any pending blur timeout — user is actively interacting
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
      const chip = chips.find((c) => c.id === editingToken.chipId);
      const currentVals = chip?.values?.filter((v) => v !== '') ?? [];
      const valSet = new Set(currentVals);
      if (valSet.has(value)) {
        valSet.delete(value);
      } else {
        valSet.add(value);
      }
      const newVals = Array.from(valSet);
      // Don't update inline text — pill tags display the values
      setInlineValueText('');
      // Real-time chip update
      updateChip(editingToken.chipId, {
        value: newVals[0] ?? '',
        values: newVals,
      });
      // Re-focus inline input after popover click
      requestAnimationFrame(() => {
        const groupHandle = tokenGroupRefs.current.get(editingToken.chipId);
        groupHandle?.focusValueInput();
      });
    },
    [editingToken, chips, updateChip]
  );

  /** Remove a value pill tag during inline editing */
  const handleValueTagRemove = useCallback(
    (chipId: string, value: string) => {
      const chip = chips.find((c) => c.id === chipId);
      const newVals = chip?.values?.filter((v) => v !== value) ?? [];
      updateChip(chipId, {
        value: newVals[0] ?? '',
        values: newVals,
      });
      setHighlightedPillIdx(-1);
      // Cancel any pending blur
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
      // Re-focus inline input
      requestAnimationFrame(() => {
        tokenGroupRefs.current.get(chipId)?.focusValueInput();
      });
    },
    [chips, updateChip]
  );

  /** Navigate between pill tags via keyboard */
  const handlePillNavigate = useCallback((chipId: string, newIdx: number) => {
    if (newIdx === -1) {
      // Return focus to input
      setHighlightedPillIdx(-1);
      requestAnimationFrame(() => {
        tokenGroupRefs.current.get(chipId)?.focusValueInput();
      });
    } else {
      setHighlightedPillIdx(newIdx);
    }
  }, []);

  /** Delete a pill tag at specific index via keyboard */
  const handlePillDelete = useCallback(
    (chipId: string, pillIdx: number) => {
      const chip = chips.find((c) => c.id === chipId);
      const vals = chip?.values ?? [];
      if (pillIdx < 0 || pillIdx >= vals.length) return;
      const newVals = vals.filter((_, i) => i !== pillIdx);
      updateChip(chipId, {
        value: newVals[0] ?? '',
        values: newVals,
      });
      // Adjust highlight: stay at same index or move back
      if (newVals.length === 0) {
        setHighlightedPillIdx(-1);
      } else if (pillIdx >= newVals.length) {
        setHighlightedPillIdx(newVals.length - 1);
      } else {
        setHighlightedPillIdx(pillIdx);
      }
      // Cancel any pending blur
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
      // Keep input focused
      requestAnimationFrame(() => {
        tokenGroupRefs.current.get(chipId)?.focusValueInput();
      });
    },
    [chips, updateChip]
  );

  /** Handle inline input key events */
  const handleInlineValueKeyDown = useCallback(
    (chipId: string, e: React.KeyboardEvent) => {
      // IME composing → skip
      if (e.nativeEvent.isComposing) return;

      // ── Pill tag keyboard navigation (when a pill is selected) ──
      if (highlightedPillIdx >= 0) {
        const editedChip = chips.find((c) => c.id === chipId);
        const pillCount = editedChip?.values?.length ?? 0;

        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (highlightedPillIdx > 0) {
            setHighlightedPillIdx(highlightedPillIdx - 1);
          }
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          if (highlightedPillIdx < pillCount - 1) {
            setHighlightedPillIdx(highlightedPillIdx + 1);
          } else {
            // Last pill → return to input
            setHighlightedPillIdx(-1);
          }
          return;
        }
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          handlePillDelete(chipId, highlightedPillIdx);
          return;
        }
        // Any other key → deselect pill, fall through to normal key handling
        setHighlightedPillIdx(-1);
      }

      const editedChip = chips.find((c) => c.id === chipId);
      const editedField = getFieldByKey(editedChip?.field ?? '', config);
      const isDatetime = editedField?.type === 'datetime';

      // Datetime fields: navigate presets with arrows, Enter/Tab to commit
      if (isDatetime) {
        const navMaxIdx = DATETIME_NAVIGABLE_COUNT - 1;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setPopoverHighlightIdx((prev) => Math.min(prev + 1, navMaxIdx));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setPopoverHighlightIdx((prev) => Math.max(prev - 1, -1));
        } else if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          // If a preset is highlighted, apply it directly
          if (
            popoverHighlightIdx >= 0 &&
            popoverHighlightIdx < DATETIME_PRESET_COUNT
          ) {
            const preset = RELATIVE_PRESETS[popoverHighlightIdx];
            updateChip(chipId, {
              value: preset.value,
              values: [preset.value],
              composingPart: undefined,
            });
            closeInlineEdit();
          } else {
            commitInlineEdit(chipId);
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          revertInlineEdit(chipId);
        }
        return;
      }

      // Non-datetime: full popover navigation
      // Build merged value list matching ValueSuggestionList (staticValues first, then facets, deduplicated)
      const popoverValues = (() => {
        const seen = new Set<string>();
        const result: string[] = [];
        const statics = editedField?.staticValues ?? [];
        const facets = normalizedFacets?.get(editedChip?.field ?? '') ?? [];
        for (const v of [...statics, ...facets]) {
          if (!seen.has(v)) {
            seen.add(v);
            result.push(v);
          }
        }
        return result;
      })();
      const maxIdx = Math.min(popoverValues.length, 30) - 1;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setPopoverHighlightIdx((prev) => Math.min(prev + 1, maxIdx));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setPopoverHighlightIdx((prev) => Math.max(prev - 1, -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const currentChip = chips.find((c) => c.id === chipId);
        const currentVals = currentChip?.values?.filter((v) => v !== '') ?? [];

        // If nothing is checked yet and a suggestion is highlighted, select it directly
        if (
          currentVals.length === 0 &&
          popoverHighlightIdx >= 0 &&
          popoverHighlightIdx <= maxIdx
        ) {
          const highlightedValue = popoverValues[popoverHighlightIdx];
          updateChip(chipId, {
            value: highlightedValue,
            values: [highlightedValue],
            composingPart: undefined,
          });
          closeInlineEdit();
        } else if (inlineValueText.trim() && currentVals.length > 0) {
          // Typed text + existing values → add as new value (don't close editing)
          const trimmed = inlineValueText.trim();
          if (!currentVals.includes(trimmed)) {
            updateChip(chipId, {
              values: [...currentVals, trimmed],
              value: currentVals[0],
            });
          }
          setInlineValueText('');
          inlineValueDirtyRef.current = false;
          setPopoverHighlightIdx(-1);
        } else {
          commitInlineEdit(chipId);
        }
      } else if (
        e.key === ' ' &&
        popoverHighlightIdx >= 0 &&
        popoverHighlightIdx <= maxIdx
      ) {
        // Space toggles checkbox when an item is highlighted
        e.preventDefault();
        handleInlineCheckboxToggle(popoverValues[popoverHighlightIdx]);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        commitInlineEdit(chipId);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        revertInlineEdit(chipId);
      }
    },
    [
      chips,
      config,
      normalizedFacets,
      popoverHighlightIdx,
      highlightedPillIdx,
      handleInlineCheckboxToggle,
      handlePillDelete,
      commitInlineEdit,
      revertInlineEdit,
      updateChip,
      closeInlineEdit,
    ]
  );

  /** Select a single value from popover text click → commit and close */
  const handleInlineTextSelect = useCallback(
    (value: string) => {
      if (!editingToken) return;
      // Cancel any pending blur timeout
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
      updateChip(editingToken.chipId, {
        value,
        values: [value],
        composingPart: undefined,
      });
      closeInlineEdit();
    },
    [editingToken, updateChip, closeInlineEdit]
  );

  // ─── Auto-open dropdown for composing chips ────────────────────────
  // Runs after render so refs are guaranteed to be set.
  useEffect(() => {
    const composingChip = chips.find((c) => c.composingPart);
    if (!composingChip) return;

    // Already editing this chip's correct part
    if (
      editingToken?.chipId === composingChip.id &&
      editingToken?.part === composingChip.composingPart
    ) {
      return;
    }

    // Use rAF to ensure DOM layout is complete (ref callbacks have fired)
    const raf = requestAnimationFrame(() => {
      const groupHandle = tokenGroupRefs.current.get(composingChip.id);
      const part = composingChip.composingPart!;

      if (part === 'value') {
        // Value composing → start inline editing mode
        const isHas =
          composingChip.field === 'has' || composingChip.field === '!has';
        if (!isHas) {
          setInlineValueText('');
          setPopoverHighlightIdx(-1);
          inlineValueDirtyRef.current = false;
          originalValueRef.current = { value: '', values: [] };
          const chipEl = groupHandle?.getChipEl();
          if (chipEl) {
            setEditingToken({
              chipId: composingChip.id,
              part,
              anchorEl: chipEl,
            });
            chipEditingRef.current = true;
            setShowDropdown(false);
            // Lazy-load field values for inline editing
            if (composingChip.field) {
              ensureFieldValues(composingChip.field);
            }
            // Focus inline input after DOM update
            requestAnimationFrame(() => groupHandle?.focusValueInput());
          }
          return;
        }
      }

      // field/operator → existing popover behavior
      const el = groupHandle?.getPartEl(part);
      if (el) {
        setEditingToken({ chipId: composingChip.id, part, anchorEl: el });
        chipEditingRef.current = true;
        setShowDropdown(false);
      }
    });

    return () => cancelAnimationFrame(raf);
  }, [chips, editingToken, ensureFieldValues]);

  // ─── Input handlers ───────────────────────────────────────────────

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = e.target.value;
      let cursorPos = e.target.selectionStart ?? val.length;

      // Auto-insert quotes for has:/!has: → has:""|" / !has:""|"
      const lower = val.toLowerCase();
      if (lower === 'has:' || lower === '!has:') {
        val = val + '""';
        cursorPos = val.length - 1; // cursor between quotes
      }

      setInputValue(val);
      setCursorOffset(cursorPos);
      // Show dropdown when there's actual text (not just spaces)
      if (val.trim().length > 0) {
        setShowDropdown(true);
      }
      setSelectedIndex(-1);

      // Sync cursor position for auto-inserted quotes
      if (lower === 'has:' || lower === '!has:') {
        requestAnimationFrame(() => {
          const input = e.target;
          if (input) {
            input.setSelectionRange(cursorPos, cursorPos);
          }
        });
      }
    },
    []
  );

  // Helper: insert chips at the correct position
  // When selectedTokenIdx === -2, insert at the beginning; otherwise append at the end
  const insertChipsAtCursor = useCallback(
    (newChips: FilterChip[]) => {
      if (selectedTokenIdx === -2) {
        setChips((prev) => [...newChips, ...prev]);
        setSelectedTokenIdx(-1); // reset to end after inserting
      } else {
        setChips((prev) => [...prev, ...newChips]);
      }
    },
    [selectedTokenIdx, setChips]
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
          insertChipsAtCursor([
            {
              id: `chip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              type: 'logical' as const,
              label: lower.toUpperCase(),
            },
          ]);
        } else {
          // No preceding filter → free text message search
          insertChipsAtCursor([
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
        insertChipsAtCursor([
          {
            id: `chip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: 'paren' as const,
            label: lower,
          },
        ]);
        setInputValue('');
      } else {
        // Try to parse as filter, or fall through as free text
        const parsed = queryToChips(text, aggregateNames);
        if (parsed.length > 0) {
          insertChipsAtCursor(parsed);
          setInputValue('');
        }
      }
    },
    [chips, setChips, insertChipsAtCursor]
  );

  const applySuggestion = useCallback(
    (item: SuggestionItem, isMultiSelect?: boolean) => {
      // Discard clicks during browser window reactivation — the activation
      // click can land on a stale dropdown DOM that has silently re-rendered
      if (windowBlurRef.current) return;

      // Special case: recent search selection (e.g. from keyboard confirmation)
      if ((item as any).category === 'recent') {
        handleSelectRecent(item.label);
        return;
      }

      const result = applyCompletion(inputValue, cursorContext, item);

      if (item.category === 'logical') {
        // AND/OR: only valid after a filter chip or closing paren
        if (canInsertLogical(chips)) {
          insertChipsAtCursor([
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
          insertChipsAtCursor([freeTextChip]);
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
        insertChipsAtCursor([
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
        const isBracketedInProgress =
          inputValue.includes('[') || isMultiSelectingRef.current;
        if (isMultiSelect || isBracketedInProgress) {
          // Multi-select mode: toggle value in field:["val1", "val2"] list format
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
            // Preserve highlight position during multi-select toggle
            if (!isMultiSelect) {
              setSelectedIndex(-1);
            }

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
            !item.description?.startsWith('aql.smart.')
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
          const completedChips = queryToChips(finalInput, aggregateNames);
          if (completedChips.length > 0) {
            insertChipsAtCursor(completedChips);
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
        // Field, operator, or aggregate selected

        // Aggregate function selection → put text in input, keep dropdown open
        if (item.category === 'aggregate') {
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

        // Step-by-step creation: if this is a field selection from empty input,
        // create a composing chip instead of putting text in input
        if (item.category === 'field' && !inputValue.includes(':')) {
          // HAS suggestions (has:"fieldName") → immediately create complete chip
          if (item.fieldCategory === 'has' && item.insertText) {
            const completedChips = queryToChips(item.insertText, aggregateNames);
            if (completedChips.length > 0) {
              insertChipsAtCursor(completedChips);
              setInputValue('');
              setCursorOffset(0);
              setShowDropdown(false);
              setSelectedIndex(-1);
              suppressDropdownRef.current = true;
              requestAnimationFrame(() => {
                inputRef.current?.focus();
                inputRef.current?.setSelectionRange(0, 0);
              });
              return;
            }
          }
          const newChipId = `chip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          // Datetime fields default to 'after' operator
          const selectedField = getFieldByKey(item.label, config);
          const defaultOp = selectedField?.type === 'datetime' ? 'after' : '=';
          insertChipsAtCursor([
            {
              id: newChipId,
              type: 'filter' as const,
              field: item.label,
              operator: defaultOp,
              composingPart: 'value' as const,
            },
          ]);
          setInputValue('');
          setCursorOffset(0);
          setShowDropdown(false);
          setSelectedIndex(-1);
          // useEffect will auto-open value dropdown after render
          // Pre-fetch field values for lazy loading
          ensureFieldValues(item.label);
          return;
        }

        // Operator or other → keep dropdown open for next step (legacy flow)
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
    [
      inputValue,
      cursorContext,
      setChips,
      chips,
      currentFilterInfo,
      insertChipsAtCursor,
      handleSelectRecent,
    ]
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

      // ArrowDown when dropdown closed → open it (WAI-ARIA combobox pattern)
      // Only when no popover is open (suggestion, field edit, value edit)
      if (
        e.key === 'ArrowDown' &&
        !showDropdown &&
        !editingToken &&
        !chipEditingRef.current &&
        selectedTokenIdx < 0
      ) {
        e.preventDefault();
        setShowDropdown(true);
        setSelectedIndex(-1);
        return;
      }
      if (e.key === 'ArrowDown' && showDropdown && suggestions.length > 0) {
        e.preventDefault();
        const maxIdx =
          (dropdownRef.current?.getItemCount() ?? suggestions.length) - 1;
        setSelectedIndex((prev) => Math.min(prev + 1, maxIdx));
        return;
      }
      if (e.key === 'ArrowUp' && showDropdown && suggestions.length > 0) {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, -1));
        return;
      }
      // Space → toggle checkbox on highlighted value suggestion (multi-select)
      if (
        (e.key === ' ' || e.code === 'Space') &&
        showDropdown &&
        selectedIndex >= 0 &&
        selectedTokenIdx < 0
      ) {
        const spaceItem = dropdownRef.current?.getItemAtIndex(selectedIndex);
        if (spaceItem?.category === 'value') {
          e.preventDefault();
          applySuggestion(spaceItem, true);
          return;
        }
      }
      // Home → select first token position
      if (e.key === 'Home' && inputValue === '') {
        e.preventDefault();
        if (visualTokens.length > 0) {
          setShowDropdown(false);
          setSelectedTokenIdx(-2);
          suppressDropdownRef.current = true;
          requestAnimationFrame(() => inputRef.current?.focus());
        }
        return;
      }
      // End → focus input (rightmost position)
      if (e.key === 'End' && inputValue === '') {
        e.preventDefault();
        setShowDropdown(false);
        setSelectedTokenIdx(-1);
        suppressDropdownRef.current = true;
        requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }
      // Left/Right arrow keys → token navigation or tab switching (when input is empty)
      // When dropdown is open, prioritize tab switching over token navigation
      if (e.key === 'ArrowLeft' && inputValue === '') {
        e.preventDefault();
        if (showDropdown) {
          dropdownRef.current?.prevTab();
        } else if (visualTokens.length > 0) {
          setSelectedTokenIdx((prev) => {
            if (prev === -2) return -2; // already at before-all, stay put
            if (prev === -1) return visualTokens.length - 1; // input → last token
            if (prev <= 0) {
              // first token → before-all position
              suppressDropdownRef.current = true;
              requestAnimationFrame(() => inputRef.current?.focus());
              return -2;
            }
            return prev - 1;
          });
        }
        return;
      }
      if (e.key === 'ArrowRight' && inputValue === '') {
        e.preventDefault();
        if (showDropdown) {
          dropdownRef.current?.nextTab();
        } else if (visualTokens.length > 0) {
          setSelectedTokenIdx((prev) => {
            if (prev === -2) {
              // before-all → first token
              suppressDropdownRef.current = true;
              requestAnimationFrame(() => inputRef.current?.focus());
              return 0;
            }
            if (prev < 0) return -1; // clamp at input
            if (prev >= visualTokens.length - 1) return -1; // last → input
            return prev + 1;
          });
        }
        return;
      }
      // Enter or Space on selected token → open editing dropdown (same as click)
      if (
        (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') &&
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
        // Logical chip → open AND/OR selector menu (NOT chips are non-editable)
        if (token && token.part === 'logical') {
          const logicalChip = chips.find((c) => c.id === token.chipId);
          if (logicalChip?.label === 'AND' || logicalChip?.label === 'OR') {
            const chipEl = containerRef.current?.querySelector(
              `[data-chip-id="${token.chipId}"]`
            ) as HTMLElement;
            if (chipEl) {
              setLogicalMenu({
                chipId: token.chipId,
                anchorEl: chipEl,
                highlightIdx: logicalChip?.label === 'OR' ? 1 : 0,
              });
            }
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
        if (showDropdown && selectedIndex >= 0) {
          const tabItem = dropdownRef.current?.getItemAtIndex(selectedIndex);
          if (tabItem) {
            applySuggestion(tabItem);
          }
        } else if (showDropdown && selectedIndex < 0) {
          // Nothing selected — just close the dropdown
          setShowDropdown(false);
        } else if (inputValue.trim()) {
          if (isIncompleteQuery(inputValue)) {
            setInputValue('');
          } else {
            commitInputAsChip(inputValue.trim());
          }
          setShowDropdown(false);
        }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        // If multi-select is in progress, Enter = commit current input as chip
        if (isMultiSelectingRef.current || inputValue.includes('[')) {
          isMultiSelectingRef.current = false;
          if (inputValue.trim()) {
            if (isIncompleteQuery(inputValue)) {
              setInputValue('');
            } else {
              commitInputAsChip(inputValue.trim());
            }
          }
          setShowDropdown(false);
          return;
        }
        // Finalize multi-select composing state
        isMultiSelectingRef.current = false;
        if (showDropdown && selectedIndex >= 0) {
          const enterItem = dropdownRef.current?.getItemAtIndex(selectedIndex);
          if (enterItem) {
            applySuggestion(enterItem);
          }
        } else if (inputValue.trim()) {
          if (isIncompleteQuery(inputValue)) {
            setInputValue('');
          } else {
            commitInputAsChip(inputValue.trim());
          }
          setShowDropdown(false);
        } else {
          // No input text → execute search with current chips
          const query = chipsToQuery(chips);
          if (query.trim()) {
            addRecentSearch(config.name, query);
            refreshRecent();
          }
          onSearch(query);
          setShowDropdown(false);
        }
        return;
      }
      if (e.key === 'Escape') {
        // Cancel composing chip entirely
        const composingChip = chips.find((c) => c.composingPart);
        if (composingChip) {
          deleteChip(composingChip.id);
          setEditingToken(null);
          chipEditingRef.current = false;
        }
        // Clear any pending input text
        if (inputValue.trim()) {
          setInputValue('');
          setCursorOffset(0);
        }
        setShowDropdown(false);
        return;
      }
      // ( and ) → immediately create paren chip (Sentry-style)
      // But NOT when input is an aggregate function name (e.g., count, avg, p95)
      if ((e.key === '(' || e.key === ')') && !inputValue.includes(':')) {
        // Check if current input is an aggregate function name — if so, let the ( through as text
        if (e.key === '(' && inputValue.trim() && aggregateNames.has(inputValue.trim().toLowerCase())) {
          // Don't intercept — let the ( character be typed into the input naturally
          return;
        }
        // Check if ) is closing an aggregate function paren (e.g., count() or avg(duration))
        if (e.key === ')' && inputValue.includes('(')) {
          const funcName = inputValue.split('(')[0].trim().toLowerCase();
          if (aggregateNames.has(funcName)) {
            // Don't intercept — let the ) character complete the aggregate call
            return;
          }
        }
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
      config,
      refreshRecent,
      selectedTokenIdx,
      visualTokens,
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
  // Track window focus/blur status to prevent dropdown flash on reactivation
  const windowBlurRef = useRef(false);

  useEffect(() => {
    const handleWindowBlur = () => {
      windowBlurRef.current = true;
    };
    const handleWindowFocus = () => {
      // Reset windowBlurRef when the activation click cycle completes (mouseup)
      // or on next keyboard interaction — NOT on a timer.
      const resetOnInteraction = () => {
        windowBlurRef.current = false;
      };
      window.addEventListener('mouseup', resetOnInteraction, { once: true });
      window.addEventListener('keydown', resetOnInteraction, { once: true });
    };
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  // Force-commit pending input as chip(s)
  const commitPendingInput = useCallback(() => {
    const text = inputValue.trim();
    if (text) {
      if (isIncompleteQuery(text)) {
        setInputValue('');
      } else {
        commitInputAsChip(text);
      }
      setShowDropdown(false);
    }
  }, [inputValue, commitInputAsChip]);

  const handleFocus = useCallback(() => {
    // If focus was triggered by browser window reactivation, do not show dropdown
    if (windowBlurRef.current) {
      return;
    }
    if (suppressDropdownRef.current) {
      suppressDropdownRef.current = false;
      return;
    }
    // Don't show main dropdown while a chip is being edited
    if (chipEditingRef.current) return;
    // Clear token selection when input gains focus
    setSelectedTokenIdx(-1);
    // Always show dropdown on focus (disabled — dropdown now opens via ArrowDown only)
    // setShowDropdown(true);
    // setSelectedIndex(-1);
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

      // Do NOT commit while composing (IME) or if any chip is currently in step-by-step composition
      const hasComposingChip = chips.some((c) => c.composingPart);
      if (isComposing || hasComposingChip) {
        return;
      }

      // Real blur (focus left the editor) — finalize multi-select and commit
      isMultiSelectingRef.current = false;
      // Force-commit any composing input
      if (inputValue.trim()) {
        commitPendingInput();
      }
      justFocusedRef.current = false;
    },
    [inputValue, commitPendingInput, showDropdown, isComposing, chips]
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
      // If composing a filter (has colon), force commit it (unless incomplete)
      if (inputValue.includes(':')) {
        if (isIncompleteQuery(inputValue)) {
          return;
        }
        isMultiSelectingRef.current = false;
        commitPendingInput();
        return;
      }
      // Re-click on already-focused input → toggle (disabled — dropdown now opens via ArrowDown only)
      // setShowDropdown((prev) => !prev);
      // setSelectedIndex(-1);
    },
    [inputValue, commitPendingInput]
  );

  const handleClickAway = useCallback(() => {
    // Ignore click-away during multi-select composing or chip editing
    // (Popover/dropdown render via Portal, outside ClickAwayListener wrapper)
    if (isMultiSelectingRef.current) return;
    if (chipEditingRef.current) return;

    // Do NOT commit while composing (IME) or if any chip is currently in step-by-step composition
    const hasComposingChip = chips.some((c) => c.composingPart);
    if (isComposing || hasComposingChip) {
      setShowDropdown(false);
      justFocusedRef.current = false;
      return;
    }

    // Do NOT commit if suggestion dropdown is visible during click away (user cancelled selection)
    if (showDropdown) {
      setShowDropdown(false);
      justFocusedRef.current = false;
      return;
    }

    // Force-commit any composing input when clicking outside
    if (inputValue.trim()) {
      commitPendingInput();
    }
    setShowDropdown(false);
    justFocusedRef.current = false;
  }, [inputValue, commitPendingInput, isComposing, chips, showDropdown]);

  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      // Don't focus input if clicking on a chip (chip handles its own click)
      if ((e.target as HTMLElement).closest('[data-chip]')) return;
      // Force-complete any pending input
      if (inputValue.trim()) {
        commitPendingInput();
        setShowDropdown(false);
      }
      // Clear token selection and focus input
      setSelectedTokenIdx(-1);
      inputRef.current?.focus();
    },
    [inputValue, commitPendingInput]
  );

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

  const isAtFront = selectedTokenIdx === -2;

  const renderInput = () => (
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
        chips.length === 0 && !isAtFront
          ? (placeholder ?? t('aql.placeholder', 'Search with AQL...'))
          : ''
      }
      style={{
        flex: isAtFront ? '0 0 auto' : 1,
        minWidth: isAtFront ? 2 : 80,
        width: isAtFront
          ? inputValue
            ? `${Math.max(inputValue.length + 3, 1)}ch`
            : 2
          : undefined,
        border: 'none',
        outline: 'none',
        background: 'transparent',
        color: isDark ? '#ddd' : '#333',
        fontSize: '0.8rem',
        fontWeight: 500,
        fontFamily: 'inherit',
        lineHeight: '24px',
        padding: isAtFront && !inputValue ? '2px 0' : '2px 4px',
        caretColor: selectedTokenIdx >= 0 ? 'transparent' : undefined,
      }}
    />
  );

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
            gap: 0,
            px: 1,
            borderRadius: '6px',
            minHeight: 28,
            py: '1px',
            border: '1px solid',
            borderColor: 'divider',
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

          {/* Chips + input area (wraps independently) */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              flex: 1,
              gap: 0,
              minHeight: 0,
            }}
          >
            {/* Input rendered before chips when in before-all position */}
            {selectedTokenIdx === -2 && renderInput()}

            {/* Existing filter chips */}
            {chips.map((chip, chipIdx) => {
              if (chip.type === 'paren') {
                // Check if this paren is keyboard-selected
                const isParenSelected = (() => {
                  if (selectedTokenIdx < 0) return false;
                  const vt = visualTokens[selectedTokenIdx];
                  return vt?.chipId === chip.id && vt?.part === 'paren';
                })();
                // Compact paren chip: minimal style, X appears on hover overlaying the text
                return (
                  <Box
                    key={chip.id}
                    sx={{
                      position: 'relative',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      px: '1px',
                      py: '1px',
                      mx: '1px',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: isDark ? '#9e9e9e' : '#757575',
                      userSelect: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      minWidth: 0,
                      lineHeight: 1.2,
                      transition: 'background-color 0.15s',
                      '&:hover': {
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.1)'
                          : 'rgba(0,0,0,0.06)',
                      },
                      // Selection highlight
                      ...(isParenSelected && {
                        outline: `1px solid ${isDark ? 'rgba(124,138,255,0.6)' : 'rgba(92,107,192,0.5)'}`,
                        backgroundColor: isDark
                          ? 'rgba(124,138,255,0.12)'
                          : 'rgba(92,107,192,0.08)',
                      }),
                      '&:hover .paren-delete': {
                        display: 'flex',
                      },
                    }}
                  >
                    {chip.label}
                    <Box
                      className="paren-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChip(chip.id);
                      }}
                      sx={{
                        display: 'none',
                        position: 'absolute',
                        top: '-10px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: isDark ? '#ef5350' : '#e53935',
                        cursor: 'pointer',
                        color: '#fff',
                      }}
                    >
                      <CloseIcon sx={{ fontSize: 8 }} />
                    </Box>
                  </Box>
                );
              }

              if (chip.type === 'logical') {
                const isToggleable =
                  chip.label === 'AND' || chip.label === 'OR';
                const isLogicalSelected = (() => {
                  if (selectedTokenIdx < 0) return false;
                  const vt = visualTokens[selectedTokenIdx];
                  return vt?.chipId === chip.id && vt?.part === 'logical';
                })();
                return (
                  <Box
                    key={chip.id}
                    data-chip-id={chip.id}
                    sx={{
                      position: 'relative',
                      px: '4px',
                      py: '2px',
                      mx: '2px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color:
                        chip.label === 'OR'
                          ? isDark
                            ? '#e6994a'
                            : '#e65100'
                          : isDark
                            ? '#4dabf5'
                            : '#1976d2',
                      userSelect: 'none',
                      textTransform: 'uppercase',
                      borderRadius: '4px',
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(0,0,0,0.04)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s',
                      '&:hover': {
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.1)'
                          : 'rgba(0,0,0,0.08)',
                      },
                      ...(isLogicalSelected && {
                        outline: `1px solid ${isDark ? 'rgba(124,138,255,0.6)' : 'rgba(92,107,192,0.5)'}`,
                        backgroundColor: isDark
                          ? 'rgba(124,138,255,0.12)'
                          : 'rgba(92,107,192,0.08)',
                      }),
                      '&:hover .logical-delete': {
                        display: 'flex',
                      },
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLogicalMenu({
                        chipId: chip.id,
                        anchorEl: e.currentTarget as HTMLElement,
                        highlightIdx: chip.label === 'OR' ? 1 : 0,
                      });
                    }}
                  >
                    {chip.label}
                    <Box
                      className="logical-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChip(chip.id);
                      }}
                      sx={{
                        display: 'none',
                        position: 'absolute',
                        top: '-10px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: isDark ? '#ef5350' : '#e53935',
                        cursor: 'pointer',
                        color: '#fff',
                      }}
                    >
                      <CloseIcon sx={{ fontSize: 8 }} />
                    </Box>
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
                  domain={config}
                  selectedPart={chipSelectedPart}
                  editingPart={
                    editingToken?.chipId === chip.id
                      ? (editingToken.part as TokenPart)
                      : null
                  }
                  editingValueText={
                    editingToken?.chipId === chip.id &&
                    editingToken.part === 'value'
                      ? inlineValueText
                      : undefined
                  }
                  onPartClick={handlePartClick}
                  onDelete={deleteChip}
                  onValueInputChange={handleInlineValueChange}
                  onValueInputKeyDown={handleInlineValueKeyDown}
                  onValueInputBlur={handleInlineValueBlur}
                  selectedValues={
                    editingToken?.chipId === chip.id
                      ? inlineSelectedValues
                      : undefined
                  }
                  onValueTagRemove={handleValueTagRemove}
                  highlightedPillIdx={
                    editingToken?.chipId === chip.id ? highlightedPillIdx : -1
                  }
                  onPillNavigate={handlePillNavigate}
                  onPillDelete={handlePillDelete}
                />
              );
            })}

            {/* Input rendered after chips (normal position) */}
            {selectedTokenIdx !== -2 && renderInput()}
          </Box>

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

          {/* Builder toggle — inside the search bar, always visible */}
          <Box
            sx={{
              borderLeft: '1px solid',
              borderColor: 'divider',
              ml: 0.3,
              pl: 0.3,
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <SafeTooltip title={t('argus.builder.open', 'Open Query Builder')}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setBuilderOpen((prev) => !prev);
                }}
                sx={{
                  p: 0.3,
                  color: builderOpen ? 'primary.main' : 'text.disabled',
                  transition: 'color 0.15s',
                }}
              >
                <TuneIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </SafeTooltip>
          </Box>

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

        {/* Query Builder Panel (Dialog centered) */}
        <QueryBuilderPanel
          open={builderOpen}
          onClose={() => setBuilderOpen(false)}
          config={config}
          query={chipsToQuery(chips)}
          facets={Object.fromEntries(
            Array.from(normalizedFacets.entries()).map(([k, vals]) => [
              k,
              vals.map((v) => ({ value: v, count: 0 })),
            ])
          )}
          fetchFieldValues={fetchFieldValues}
          onApply={(q) => {
            // Apply the built query: reset chips from query, trigger search
            resetTo(queryToChips(q, aggregateNames));
            setInputValue('');
            setShowDropdown(false);
            setBuilderOpen(false);
            onSearch(q);
          }}
        />

        {/* Suggestion dropdown */}
        {showDropdown &&
          (suggestions.length > 0 ||
            recentSearches.length > 0 ||
            (cursorContext.field && isFieldLoading(cursorContext.field))) &&
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
              isLoading={
                !!(cursorContext.field && isFieldLoading(cursorContext.field))
              }
            />
          )}

        {/* Token edit dropdown (field/operator/value editing) */}
        {(() => {
          if (!editingToken) return null;
          const editedChip = chips.find((c) => c.id === editingToken.chipId);
          if (!editedChip) return null;
          return (
            <TokenEditDropdown
              type={editingToken.part}
              chip={editedChip}
              domain={config}
              facets={normalizedFacets}
              anchorEl={editingToken.anchorEl}
              onUpdate={(updates) =>
                handleTokenUpdate(editingToken.chipId, updates)
              }
              onClose={handleEditClose}
              filterText={inlineValueDirtyRef.current ? inlineValueText : ''}
              selectedValues={inlineSelectedValues}
              highlightIndex={popoverHighlightIdx}
              onCheckboxToggle={handleInlineCheckboxToggle}
              onTextSelect={handleInlineTextSelect}
              isLoading={
                !!(editedChip.field && isFieldLoading(editedChip.field))
              }
            />
          );
        })()}
        {/* Logical chip AND/OR selector menu */}
        <Popover
          open={!!logicalMenu}
          anchorEl={logicalMenu?.anchorEl ?? null}
          onClose={() => setLogicalMenu(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          transformOrigin={{ vertical: 'top', horizontal: 'center' }}
          disableAutoFocus={false}
          disableEnforceFocus
          slotProps={{
            paper: {
              sx: {
                mt: 0.5,
                borderRadius: '8px',
                minWidth: 80,
                boxShadow: isDark
                  ? '0 4px 20px rgba(0,0,0,0.5)'
                  : '0 4px 20px rgba(0,0,0,0.15)',
              },
            },
          }}
        >
          <List
            dense
            sx={{ py: 0.5, outline: 'none' }}
            tabIndex={0}
            ref={(el: HTMLUListElement | null) => {
              // Auto-focus the list when Popover opens
              if (el) requestAnimationFrame(() => el.focus());
            }}
            onKeyDown={(e) => {
              const ops = ['AND', 'OR'] as const;
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (logicalMenu) {
                  const nextIdx = logicalMenu.highlightIdx === 0 ? 1 : 0;
                  setLogicalMenu({ ...logicalMenu, highlightIdx: nextIdx });
                }
              } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                if (logicalMenu) {
                  const selected = ops[logicalMenu.highlightIdx];
                  updateChip(logicalMenu.chipId, { label: selected });
                }
                setLogicalMenu(null);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setLogicalMenu(null);
              }
            }}
          >
            {['AND', 'OR'].map((op, idx) => {
              const isHighlighted = logicalMenu?.highlightIdx === idx;
              const chipForMenu = logicalMenu
                ? chips.find((c) => c.id === logicalMenu.chipId)
                : null;
              const isCurrent = chipForMenu?.label === op;
              return (
                <ListItemButton
                  key={op}
                  onClick={() => {
                    if (logicalMenu) {
                      updateChip(logicalMenu.chipId, { label: op });
                    }
                    setLogicalMenu(null);
                  }}
                  selected={isHighlighted}
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
                    primary={op}
                    primaryTypographyProps={{
                      fontSize: '0.8rem',
                      fontWeight: isHighlighted ? 600 : 400,
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
        </Popover>
      </Box>
    </ClickAwayListener>
  );
});

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
 * e.g., 'level:["info", "warn"]' -> { field: 'level', operator: '=', values: ['info', 'warn'] }
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

  const fieldTokIdx = tokens.findIndex((t) => t.type === TokenType.FIELD);
  if (fieldTokIdx >= 0) {
    const fieldTok = tokens[fieldTokIdx];
    let isNegated = false;
    if (fieldTokIdx > 0) {
      const prevTok = tokens[fieldTokIdx - 1];
      if (prevTok.type === TokenType.BANG || prevTok.type === TokenType.NOT) {
        isNegated = true;
      }
    }
    field = isNegated ? `!${fieldTok.value}` : fieldTok.value;
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
