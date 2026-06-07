/**
 * useSearchQueryState — Core state management for the search query builder.
 *
 * Architecture:
 *   tokens (SearchToken[]) = source of truth
 *   query = derived from tokens + composingText
 *   committedQuery = last confirmed query (sent to parent via onSearch)
 *
 * Follows IME-like composing/committed pattern:
 *   - Typing = composing (local only, no side effects)
 *   - Selecting autocomplete / pressing Enter = commit (fires onSearch)
 */

import { useReducer, useCallback, useRef, useEffect, useMemo } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────

export interface SearchToken {
  /** Unique ID for React key and dispatch targeting */
  id: string;
  type: 'filter' | 'freetext' | 'logic';
  /** Field name (e.g., 'level', 'message') */
  field?: string;
  /** Operator (e.g., 'is', 'contains', 'starts_with') */
  operator?: string;
  /** Filter value (e.g., 'error', 'timeout') */
  value?: string;
  /** Whether this is a negated filter (!field:value) */
  negated?: boolean;
  /** Serialized string representation */
  raw: string;
}

export interface SearchQueryState {
  tokens: SearchToken[];
  /** Derived: serialization of tokens + composingText */
  query: string;
  /** Last confirmed query string (search execution target) */
  committedQuery: string;
  /** Free text being typed (not yet a token) */
  composingText: string;
  /** Token ID currently being edited inline, or null */
  editingTokenId: string | null;
  /** Which part of the editing token is being edited */
  editingPart: 'field' | 'operator' | 'value' | null;
}

// ─── Actions ─────────────────────────────────────────────────────────────

type Action =
  | { type: 'INIT'; query: string }
  | { type: 'ADD_TOKEN'; token: SearchToken }
  | { type: 'UPDATE_TOKEN'; id: string; updates: Partial<SearchToken> }
  | { type: 'DELETE_TOKEN'; id: string }
  | { type: 'SET_COMPOSING'; text: string }
  | {
      type: 'START_EDITING';
      tokenId: string;
      part: 'field' | 'operator' | 'value';
    }
  | { type: 'STOP_EDITING' }
  | { type: 'COMMIT' }
  | { type: 'CLEAR' };

// ─── Helpers ─────────────────────────────────────────────────────────────

let _idCounter = 0;
export function generateTokenId(): string {
  return `tok_${++_idCounter}_${Date.now().toString(36)}`;
}

/** Serialize a single token to its query string form */
export function serializeToken(token: SearchToken): string {
  if (token.type === 'logic') return token.raw;
  if (token.type === 'freetext') return token.raw;

  const { field, operator, value, negated } = token;
  if (!field || value === undefined) return token.raw;

  const prefix = negated ? '!' : '';

  switch (operator) {
    case 'is':
    case undefined:
      return `${prefix}${field}:"${value}"`;
    case 'is_not':
      return `!${field}:"${value}"`;
    case 'contains':
      return `${prefix}${field}.contains:"${value}"`;
    case 'not_contains':
      return `${prefix}${field}.not_contains:"${value}"`;
    case 'starts_with':
      return `${prefix}${field}.starts_with:"${value}"`;
    case 'ends_with':
      return `${prefix}${field}.ends_with:"${value}"`;
    case '>':
    case '<':
    case '>=':
    case '<=':
      return `${prefix}${field}:${operator}${value}`;
    default:
      return `${prefix}${field}:"${value}"`;
  }
}

/** Serialize all tokens + composing text to a full query string */
function buildQueryString(
  tokens: SearchToken[],
  composingText: string
): string {
  const parts = tokens.map((t) => t.raw);
  if (composingText.trim()) parts.push(composingText.trim());
  return parts.join(' ');
}

/** Parse a raw query string into tokens */
export function parseQueryToTokens(query: string): SearchToken[] {
  if (!query.trim()) return [];

  const tokens: SearchToken[] = [];
  // Match: !?key(.operator)?:("quoted"|'quoted'|unquoted) OR AND|OR keywords
  const re =
    /(!?[\w.-]+(?:\.(?:contains|not_contains|starts_with|ends_with))?:(?:"[^"]*"|'[^']*'|\S+))|(\bAND\b|\bOR\b)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(query)) !== null) {
    // Free text between tokens
    const gap = query.slice(lastIdx, match.index).trim();
    if (gap) {
      tokens.push({
        id: generateTokenId(),
        type: 'freetext',
        raw: gap,
      });
    }

    if (match[1]) {
      const tok = match[1];
      const isNeg = tok.startsWith('!');
      const clean = isNeg ? tok.slice(1) : tok;

      // Split at the FIRST colon that's not part of the operator suffix
      const colonIdx = clean.indexOf(':');
      const fullKey = clean.slice(0, colonIdx);
      let rawVal = clean.slice(colonIdx + 1);

      // Remove quotes from value
      if (
        (rawVal.startsWith('"') && rawVal.endsWith('"')) ||
        (rawVal.startsWith("'") && rawVal.endsWith("'"))
      ) {
        rawVal = rawVal.slice(1, -1);
      }

      // Parse compound key: message.contains → field=message, operator=contains
      let field = fullKey;
      let operator = 'is';
      const dotOps = ['contains', 'not_contains', 'starts_with', 'ends_with'];
      for (const op of dotOps) {
        if (fullKey.endsWith('.' + op)) {
          field = fullKey.slice(0, -(op.length + 1));
          operator = op;
          break;
        }
      }

      // Check for comparison operators in value: field:>100
      if (operator === 'is' && /^[><=!]+/.test(rawVal)) {
        const opMatch = rawVal.match(/^([><=!]+)/);
        if (opMatch) {
          operator = opMatch[1];
          rawVal = rawVal.slice(opMatch[1].length);
        }
      }

      if (isNeg && operator === 'is') operator = 'is_not';

      tokens.push({
        id: generateTokenId(),
        type: fullKey === 'has' ? 'filter' : 'filter',
        field: fullKey === 'has' ? 'has' : field,
        operator: fullKey === 'has' ? 'is' : operator,
        value: rawVal,
        negated: isNeg,
        raw: tok,
      });
    } else if (match[2]) {
      tokens.push({
        id: generateTokenId(),
        type: 'logic',
        raw: match[2],
      });
    }

    lastIdx = match.index + match[0].length;
  }

  // Trailing free text
  const trailing = query.slice(lastIdx).trim();
  if (trailing) {
    tokens.push({
      id: generateTokenId(),
      type: 'freetext',
      raw: trailing,
    });
  }

  return tokens;
}

// ─── Reducer ─────────────────────────────────────────────────────────────

function reducer(state: SearchQueryState, action: Action): SearchQueryState {
  switch (action.type) {
    case 'INIT': {
      const tokens = parseQueryToTokens(action.query);
      const query = buildQueryString(tokens, '');
      console.log('[SQ] 🔄 INIT dispatch', {
        query: action.query,
        tokenCount: tokens.length,
        tokens: tokens.map((t) => t.raw),
      });
      return {
        tokens,
        query,
        committedQuery: query,
        composingText: '',
        editingTokenId: null,
        editingPart: null,
      };
    }

    case 'ADD_TOKEN': {
      const newToken = { ...action.token, raw: serializeToken(action.token) };
      const tokens = [...state.tokens, newToken];
      const query = buildQueryString(tokens, '');
      console.log('[SQ] ➕ ADD_TOKEN', {
        raw: newToken.raw,
        totalTokens: tokens.length,
      });
      return {
        ...state,
        tokens,
        query,
        composingText: '', // Clear composing after adding token
        editingTokenId: null,
        editingPart: null,
      };
    }

    case 'UPDATE_TOKEN': {
      const tokens = state.tokens.map((t) => {
        if (t.id !== action.id) return t;
        const updated = { ...t, ...action.updates };
        updated.raw = serializeToken(updated);
        return updated;
      });
      const query = buildQueryString(tokens, state.composingText);
      return { ...state, tokens, query };
    }

    case 'DELETE_TOKEN': {
      const tokens = state.tokens.filter((t) => t.id !== action.id);
      const query = buildQueryString(tokens, state.composingText);
      return {
        ...state,
        tokens,
        query,
        editingTokenId:
          state.editingTokenId === action.id ? null : state.editingTokenId,
        editingPart:
          state.editingTokenId === action.id ? null : state.editingPart,
      };
    }

    case 'SET_COMPOSING': {
      const query = buildQueryString(state.tokens, action.text);
      return { ...state, composingText: action.text, query };
    }

    case 'START_EDITING': {
      return {
        ...state,
        editingTokenId: action.tokenId,
        editingPart: action.part,
      };
    }

    case 'STOP_EDITING': {
      return { ...state, editingTokenId: null, editingPart: null };
    }

    case 'COMMIT': {
      // Finalize: convert any freetext tokens to message filters
      const finalTokens = state.tokens.map((t) => {
        if (t.type !== 'freetext') return t;
        // Convert freetext → message:"text"
        return {
          ...t,
          type: 'filter' as const,
          field: 'message',
          operator: 'is',
          value: t.raw,
          raw: `message:"${t.raw}"`,
        };
      });
      const committedQuery = buildQueryString(finalTokens, '');
      console.log('[SQ] ✅ COMMIT', {
        committedQuery,
        tokenCount: finalTokens.length,
        tokens: finalTokens.map((t) => t.raw),
      });
      return {
        ...state,
        tokens: finalTokens,
        query: committedQuery,
        committedQuery,
        composingText: '',
        editingTokenId: null,
        editingPart: null,
      };
    }

    case 'CLEAR': {
      console.log('[SQ] 🗑️ CLEAR');
      return {
        tokens: [],
        query: '',
        committedQuery: '',
        composingText: '',
        editingTokenId: null,
        editingPart: null,
      };
    }

    default:
      return state;
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────

interface UseSearchQueryStateOptions {
  initialQuery: string;
  onSearch: (query: string) => void;
}

export function useSearchQueryState({
  initialQuery,
  onSearch,
}: UseSearchQueryStateOptions) {
  const initialTokens = useMemo(() => parseQueryToTokens(initialQuery), []);
  const initialQueryStr = useMemo(
    () => buildQueryString(initialTokens, ''),
    []
  );

  const [state, dispatch] = useReducer(reducer, {
    tokens: initialTokens,
    query: initialQueryStr,
    committedQuery: initialQueryStr,
    composingText: '',
    editingTokenId: null,
    editingPart: null,
  });

  // Track last external initialQuery to detect external changes (e.g., loading saved query)
  const lastExternalQueryRef = useRef(initialQuery);
  // Counter-based INIT defense: incremented on every internal COMMIT.
  // When initialQuery changes from our own commit echoing back via URL,
  // the counter mismatch tells us to skip INIT.
  const commitCounterRef = useRef(0);
  const lastInitCounterRef = useRef(0);

  useEffect(() => {
    if (initialQuery !== lastExternalQueryRef.current) {
      lastExternalQueryRef.current = initialQuery;

      // If there's a pending self-commit, skip INIT (our own query echoing back from URL)
      if (commitCounterRef.current > lastInitCounterRef.current) {
        console.log('[SQ] ⏭️ INIT skipped (self-commit echo)', {
          initialQuery,
          commitCounter: commitCounterRef.current,
          initCounter: lastInitCounterRef.current,
        });
        lastInitCounterRef.current = commitCounterRef.current;
        return;
      }

      console.log('[SQ] 🔄 INIT triggered (external change)', {
        initialQuery,
        commitCounter: commitCounterRef.current,
        initCounter: lastInitCounterRef.current,
      });
      dispatch({ type: 'INIT', query: initialQuery });
    }
  }, [initialQuery]);

  // Fire onSearch when committedQuery changes (but not on initial mount)
  const isFirstRender = useRef(true);
  const prevCommittedRef = useRef(state.committedQuery);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (state.committedQuery !== prevCommittedRef.current) {
      prevCommittedRef.current = state.committedQuery;
      lastExternalQueryRef.current = state.committedQuery;
      // Increment counter so next initialQuery change from URL echo is skipped
      commitCounterRef.current++;
      console.log('[SQ] 📤 onSearch fired', {
        committedQuery: state.committedQuery,
        commitCounter: commitCounterRef.current,
      });
      onSearch(state.committedQuery);
    }
  }, [state.committedQuery, onSearch]);

  // ─── Convenience methods ───

  const addToken = useCallback(
    (token: Omit<SearchToken, 'id' | 'raw'> & { raw?: string }) => {
      const id = generateTokenId();
      const fullToken: SearchToken = {
        ...token,
        id,
        raw: token.raw || '',
      };
      fullToken.raw = serializeToken(fullToken);
      dispatch({ type: 'ADD_TOKEN', token: fullToken });
    },
    []
  );

  const updateToken = useCallback(
    (id: string, updates: Partial<SearchToken>) => {
      dispatch({ type: 'UPDATE_TOKEN', id, updates });
    },
    []
  );

  const deleteToken = useCallback((id: string) => {
    dispatch({ type: 'DELETE_TOKEN', id });
  }, []);

  const setComposing = useCallback((text: string) => {
    dispatch({ type: 'SET_COMPOSING', text });
  }, []);

  const startEditing = useCallback(
    (tokenId: string, part: 'field' | 'operator' | 'value') => {
      dispatch({ type: 'START_EDITING', tokenId, part });
    },
    []
  );

  const stopEditing = useCallback(() => {
    dispatch({ type: 'STOP_EDITING' });
  }, []);

  const commit = useCallback(() => {
    dispatch({ type: 'COMMIT' });
  }, []);

  const clear = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  /** Add token + immediately commit (common pattern for autocomplete selection) */
  const addTokenAndCommit = useCallback(
    (token: Omit<SearchToken, 'id' | 'raw'> & { raw?: string }) => {
      const id = generateTokenId();
      const fullToken: SearchToken = {
        ...token,
        id,
        raw: token.raw || '',
      };
      fullToken.raw = serializeToken(fullToken);
      dispatch({ type: 'ADD_TOKEN', token: fullToken });
      dispatch({ type: 'COMMIT' });
    },
    []
  );

  /** Delete token + immediately commit */
  const deleteTokenAndCommit = useCallback((id: string) => {
    dispatch({ type: 'DELETE_TOKEN', id });
    dispatch({ type: 'COMMIT' });
  }, []);

  /** Update token + immediately commit */
  const updateTokenAndCommit = useCallback(
    (id: string, updates: Partial<SearchToken>) => {
      dispatch({ type: 'UPDATE_TOKEN', id, updates });
      dispatch({ type: 'COMMIT' });
    },
    []
  );

  /** Commit composing text as a message filter if it's plain text */
  const commitComposing = useCallback(() => {
    const text = state.composingText.trim();
    if (!text) {
      dispatch({ type: 'COMMIT' });
      return;
    }

    // If it contains ':', treat as a raw token
    if (text.includes(':')) {
      const parsed = parseQueryToTokens(text);
      parsed.forEach((t) => dispatch({ type: 'ADD_TOKEN', token: t }));
    } else {
      // Plain text → message:"text"
      const token: SearchToken = {
        id: generateTokenId(),
        type: 'filter',
        field: 'message',
        operator: 'is',
        value: text,
        raw: `message:"${text}"`,
      };
      dispatch({ type: 'ADD_TOKEN', token });
    }
    dispatch({ type: 'COMMIT' });
  }, [state.composingText]);

  return {
    state,
    dispatch,
    // Convenience methods
    addToken,
    updateToken,
    deleteToken,
    setComposing,
    startEditing,
    stopEditing,
    commit,
    clear,
    addTokenAndCommit,
    deleteTokenAndCommit,
    updateTokenAndCommit,
    commitComposing,
  };
}
