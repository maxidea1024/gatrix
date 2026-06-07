/**
 * SearchQueryInput — Sentry-style search query builder.
 *
 * Replaces ArgusSearchInput with chip-centric architecture.
 *
 * Key principles:
 *   - Tokens (chips) are source of truth, not a flat string
 *   - Typing is composing state (like IME) — no side effects until commit
 *   - Only onSearch fires on explicit commit (Enter / autocomplete selection)
 *   - Each chip is independently editable (click to change field/operator/value)
 */

import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  Box,
  InputBase,
  IconButton,
  useTheme,
  ClickAwayListener,
} from '@mui/material';
import { Search as SearchIcon, Close as CloseIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

import { useSearchQueryState } from './useSearchQueryState';
import { TokenChip } from './TokenChip';
import {
  SearchAutocompleteDropdown,
  type SearchAutocompleteDropdownHandle,
  type AutocompleteSelection,
} from './SearchAutocompleteDropdown';
import { FIELD_DEFINITIONS } from '../FieldDefinitions';

// ─── Props ───────────────────────────────────────────────────────────────

export interface SearchQueryInputProps {
  /** Initial query string (from URL state, saved query, etc.) */
  initialQuery: string;
  /** Called ONLY when query is committed (Enter / autocomplete selection / chip delete) */
  onSearch: (query: string) => void;
  /** Available field names (from facets or config) */
  fields?: string[];
  /** Facet data for value suggestions */
  facets?: Record<string, { value: string; count: number }[]>;
  /** Dark mode flag */
  isDark: boolean;
  /** MUI theme */
  theme: any;
  /** Active filter chips from FilterBar (for display context) */
  activeFilters?: any[];
  /** Placeholder text override */
  placeholder?: string;
}

// ─── Recent searches ─────────────────────────────────────────────────────

const RECENT_KEY = 'argus_recent_searches';

function saveRecentSearch(q: string) {
  if (!q.trim()) return;
  try {
    const prev: string[] = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    const next = [q.trim(), ...prev.filter((p) => p !== q.trim())].slice(0, 10);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

// ─── Component ───────────────────────────────────────────────────────────

export const SearchQueryInput: React.FC<SearchQueryInputProps> = ({
  initialQuery,
  onSearch,
  fields: fieldsProp,
  facets = {},
  isDark,
  activeFilters,
  placeholder,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<SearchAutocompleteDropdownHandle>(null);

  // Fields derived from prop or facets
  const fields = useMemo(() => {
    // If parent explicitly passed fields, ONLY use those fields!
    if (fieldsProp && fieldsProp.length > 0) return fieldsProp;

    // Otherwise, merge backend facets with all predefined UI fields
    const predefinedKeys = Object.keys(FIELD_DEFINITIONS);
    return Array.from(new Set([...Object.keys(facets), ...predefinedKeys]));
  }, [fieldsProp, facets]);

  // ─── Core state ───
  const {
    state,
    setComposing,
    addToken,
    deleteToken,
    updateToken,
    startEditing,
    stopEditing,
    commitComposing,
    clear,
    commit,
  } = useSearchQueryState({
    initialQuery,
    onSearch: (query) => {
      saveRecentSearch(query);
      onSearch(query);
    },
  });

  // ─── Autocomplete visibility ───
  const [open, setOpen] = useState(false);
  const showAutocomplete = open;

  // ─── Handlers ───

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setComposing(e.target.value);
      // Re-open dropdown when user starts typing
      if (!open) {
        console.log('[UI] ⌨️ typing reopens dropdown', {
          text: e.target.value,
        });
        setOpen(true);
      }
    },
    [setComposing, open]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Backspace on empty composing → delete last token (no search)
      if (
        e.key === 'Backspace' &&
        state.composingText === '' &&
        state.tokens.length > 0
      ) {
        e.preventDefault();
        const lastToken = state.tokens[state.tokens.length - 1];
        console.log('[UI] ⌫ Backspace delete last token', {
          raw: lastToken.raw,
        });
        deleteToken(lastToken.id);
        return;
      }

      // Forward to autocomplete first
      if (autocompleteRef.current?.handleKeyDown(e)) {
        console.log('[UI] ⬇️ Key handled by autocomplete', { key: e.key });
        return;
      }

      // Enter → commit + search
      if (e.key === 'Enter') {
        e.preventDefault();
        console.log('[UI] ⏎ Enter → commitComposing + search', {
          composingText: state.composingText,
          tokenCount: state.tokens.length,
        });
        commitComposing();
        setOpen(false);
        inputRef.current?.blur();
      }

      // Escape → cancel composition entirely
      if (e.key === 'Escape') {
        console.log('[UI] Esc → cancel composition');
        setComposing('');
        autocompleteRef.current?.reset();
        setOpen(false);
        stopEditing();
      }
    },
    [
      state.composingText,
      state.tokens,
      deleteToken,
      commitComposing,
      stopEditing,
      setComposing,
    ]
  );

  const handleAutocompleteSelect = useCallback(
    (selection: AutocompleteSelection) => {
      console.log('[UI] 🎯 autocomplete select', {
        selection,
        editingTokenId: state.editingTokenId,
        editingPart: state.editingPart,
      });
      if (state.editingTokenId && state.editingPart) {
        // Partial edit: only update the part being edited (no search)
        const updates: Record<string, string> = {};
        if (state.editingPart === 'field') updates.field = selection.field;
        else if (state.editingPart === 'operator')
          updates.operator = selection.operator;
        else if (state.editingPart === 'value') updates.value = selection.value;
        console.log('[UI] ✏️ edit chip part', {
          tokenId: state.editingTokenId,
          updates,
        });
        updateToken(state.editingTokenId, updates);
        stopEditing();
      } else {
        // New chip (no search — search happens on Enter)
        console.log('[UI] ➕ new chip (no search)', {
          field: selection.field,
          operator: selection.operator,
          value: selection.value,
        });
        addToken({
          type: 'filter',
          field: selection.field,
          operator: selection.operator,
          value: selection.value,
        });
      }
      // Close dropdown after chip creation/edit
      setComposing('');
      console.log('[UI] 🚪 close dropdown after select');
      setOpen(false);
    },
    [
      state.editingTokenId,
      state.editingPart,
      addToken,
      updateToken,
      stopEditing,
      setComposing,
    ]
  );

  const handleChipClickPart = useCallback(
    (tokenId: string, part: 'field' | 'operator' | 'value') => {
      startEditing(tokenId, part);
      const token = state.tokens.find((t) => t.id === tokenId);
      if (token && autocompleteRef.current) {
        if (part === 'field') {
          autocompleteRef.current.setEditState('field');
        } else if (part === 'operator') {
          autocompleteRef.current.setEditState('operator', token.field);
        } else if (part === 'value') {
          autocompleteRef.current.setEditState(
            'value',
            token.field,
            token.operator
          );
        }
      }
      setOpen(true);
    },
    [startEditing, state.tokens]
  );

  const handleChipDelete = useCallback(
    (tokenId: string) => {
      deleteToken(tokenId);
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [deleteToken]
  );

  const handleFocus = useCallback(() => {
    console.log('[UI] 🎯 focus', { tokenCount: state.tokens.length, open });
    setOpen(true);
  }, [state.tokens.length, open]);

  const handleClickAway = useCallback(() => {
    console.log('[UI] 👈 clickAway → close');
    setOpen(false);
    stopEditing();
  }, [stopEditing]);

  const handleClear = useCallback(() => {
    console.log('[UI] 🗑️ clear');
    clear();
    commit(); // commit empty state to trigger search
    setOpen(false);
  }, [clear, commit]);

  // ─── Render ───

  const hasContent =
    state.tokens.length > 0 || state.composingText.trim().length > 0;

  return (
    <ClickAwayListener onClickAway={handleClickAway}>
      <Box
        ref={containerRef}
        onClick={() => {
          inputRef.current?.focus();
          setOpen(true);
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          flex: 1,
          flexWrap: 'nowrap',
          px: 1,
          py: 0.3,
          borderRadius: '6px',
          minWidth: 0,
          minHeight: 26,
          // Dropdown is absolute-positioned inside — needs visible overflow
          overflow: 'visible',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          transition: 'border-color 0.2s',
          cursor: 'text',
          backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#fff',
          position: 'relative',
          '&:focus-within': {
            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
          },
        }}
      >
        <SearchIcon
          sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0 }}
        />

        {/* Committed token chips */}
        {state.tokens.map((token) => (
          <TokenChip
            key={token.id}
            token={token}
            isEditing={state.editingTokenId === token.id}
            editingPart={
              state.editingTokenId === token.id ? state.editingPart : null
            }
            isDark={isDark}
            onClickPart={(part) => handleChipClickPart(token.id, part)}
            onDelete={() => handleChipDelete(token.id)}
          />
        ))}

        {/* Composing input */}
        <InputBase
          inputRef={inputRef}
          value={state.composingText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={
            state.tokens.length === 0
              ? placeholder ||
                t(
                  'argus.search.placeholder',
                  'Search by field:value or type to search messages...'
                )
              : ''
          }
          spellCheck={false}
          autoComplete="off"
          sx={{
            flex: 1,
            minWidth: 60,
            '& input': {
              padding: '2px 0',
              fontSize: '0.8rem',
              fontWeight: 500,
              fontFamily: 'inherit',
              '&::placeholder': { fontSize: '0.75rem', opacity: 0.5 },
            },
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

        {/* Autocomplete dropdown */}
        <SearchAutocompleteDropdown
          ref={autocompleteRef}
          composingText={state.composingText}
          fields={fields}
          facets={facets}
          open={showAutocomplete}
          anchorEl={containerRef.current}
          isDark={isDark}
          onSelect={handleAutocompleteSelect}
          onSelectField={(field) => setComposing(field + ':')}
          onSelectOperator={() => {
            /* keep composing as field: prefix */
          }}
          hasExplicitFields={!!(fieldsProp && fieldsProp.length > 0)}
          editingPart={state.editingTokenId ? state.editingPart || null : null}
          hasTokens={state.tokens.length > 0}
        />
      </Box>
    </ClickAwayListener>
  );
};

export default SearchQueryInput;
