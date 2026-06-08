// ============================================================================
// Query DSL Engine — Cursor Context Resolver
// Spec: Section 9
// ============================================================================

import { TokenType, EditorState } from './types';
import type { Token, CursorContext, CursorContextType } from './types';
import { resolveEditorState } from './editor-fsm';

/**
 * Resolve what the cursor is currently editing based on input, offset, and tokens.
 *
 * Spec Section 9.3 Examples:
 *   `|`           → FIELD
 *   `cou|`        → FIELD, prefix="cou"
 *   `country:|`   → OPERATOR, field=country, prefix=""
 *   `country:K|`  → VALUE, field=country, operator="=", prefix="K"
 *   `country:!=|` → VALUE, field=country, operator="!=", prefix=""
 *   `message:cont|` → OPERATOR, field=message, prefix="cont"
 *   `message:contains("|` → VALUE, field=message, operator="contains", prefix=""
 *   `country:KR |` → LOGICAL_OPERATOR
 */
export function resolveCursorContext(
  input: string,
  cursorOffset: number,
  tokens: Token[]
): CursorContext {
  const editorState = resolveEditorState(tokens, cursorOffset);

  // Find the token at or just before cursor
  let currentToken: Token | null = null;
  let prevToken: Token | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === TokenType.EOF) break;

    if (t.start <= cursorOffset && cursorOffset <= t.end) {
      currentToken = t;
      prevToken = i > 0 ? tokens[i - 1] : null;
      break;
    }

    if (t.end <= cursorOffset) {
      prevToken = t;
    }
  }

  // Determine the current field (walk backward to find most recent FIELD token)
  let field: string | undefined;
  let operator: string | undefined;

  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (t.type === TokenType.EOF) continue;
    if (t.start >= cursorOffset) continue;

    // Stop at logical operators or parens
    if (
      t.type === TokenType.AND ||
      t.type === TokenType.OR ||
      t.type === TokenType.NOT ||
      t.type === TokenType.BANG ||
      t.type === TokenType.LPAREN
    ) {
      break;
    }

    // Found comparison/function operator
    if (
      t.type === TokenType.NE ||
      t.type === TokenType.GT ||
      t.type === TokenType.GTE ||
      t.type === TokenType.LT ||
      t.type === TokenType.LTE
    ) {
      operator = t.value;
    }
    if (
      t.type === TokenType.CONTAINS ||
      t.type === TokenType.STARTS_WITH ||
      t.type === TokenType.ENDS_WITH ||
      t.type === TokenType.NOT_CONTAINS ||
      t.type === TokenType.NOT_STARTS_WITH ||
      t.type === TokenType.NOT_ENDS_WITH ||
      t.type === TokenType.IN ||
      t.type === TokenType.NOT_IN ||
      t.type === TokenType.BEFORE ||
      t.type === TokenType.AFTER
    ) {
      operator = t.value;
    }

    if (t.type === TokenType.FIELD) {
      field = t.value;
      break;
    }
  }

  // Determine prefix (what user is currently typing)
  // Structural tokens (COLON, LPAREN, COMMA) are NOT user-typed prefixes.
  // If cursor is right after a structural token, prefix is empty.
  let prefix = '';
  let tokenStart = cursorOffset;
  let tokenEnd = cursorOffset;

  // Structural and operator tokens should NOT become the user's typing prefix.
  // When the cursor is right after one of these, the user is starting fresh input.
  const nonPrefixTokens = new Set([
    // Structural
    TokenType.COLON,
    TokenType.LPAREN,
    TokenType.RPAREN,
    TokenType.COMMA,
    // Comparison operators
    TokenType.NE,
    TokenType.GT,
    TokenType.GTE,
    TokenType.LT,
    TokenType.LTE,
    // Function operators
    TokenType.CONTAINS,
    TokenType.STARTS_WITH,
    TokenType.ENDS_WITH,
    TokenType.NOT_CONTAINS,
    TokenType.NOT_STARTS_WITH,
    TokenType.NOT_ENDS_WITH,
    TokenType.BEFORE,
    TokenType.AFTER,
    // Logical operators (NOT and BANG are structural, but AND/OR may be user-typed prefixes)
    TokenType.NOT,
    TokenType.BANG,
  ]);

  if (
    currentToken &&
    currentToken.start < cursorOffset &&
    !nonPrefixTokens.has(currentToken.type)
  ) {
    prefix = input.slice(currentToken.start, cursorOffset);
    tokenStart = currentToken.start;
    tokenEnd = currentToken.end;
  }

  // ── Map editor state to context type ──
  //
  // Key logic per Spec Section 9.3:
  //   EXPECT_OPERATOR_OR_VALUE with empty prefix → OPERATOR (show operators + values)
  //   EXPECT_OPERATOR_OR_VALUE with prefix that looks like operator start → OPERATOR
  //   EXPECT_OPERATOR_OR_VALUE with prefix that looks like value → VALUE
  //
  // But we simplify: EXPECT_OPERATOR_OR_VALUE always returns OPERATOR,
  // and the SuggestionEngine handles showing both operators AND values for OPERATOR context.

  let type: CursorContextType;
  switch (editorState) {
    case EditorState.EXPECT_FIELD:
    case EditorState.IN_PARENTHESIS:
      type = 'FIELD';
      break;
    case EditorState.EXPECT_COLON:
      type = 'FIELD';
      break;
    case EditorState.EXPECT_OPERATOR_OR_VALUE:
      // Per Spec 9.3: country:| → OPERATOR, country:K| → VALUE
      // If we have a prefix and it's NOT a known operator prefix, it's VALUE
      if (prefix !== '' && !isOperatorPrefix(prefix)) {
        type = 'VALUE';
        operator = '='; // implicit = operator
      } else {
        type = 'OPERATOR';
      }
      break;
    case EditorState.EXPECT_VALUE:
      type = 'VALUE';
      break;
    case EditorState.EXPECT_LOGICAL_OPERATOR:
      // Only show logical operators if there's a space gap between cursor and previous token.
      // If cursor is right at the end of a value token (no space), user is still typing the value.
      if (
        prevToken &&
        cursorOffset === prevToken.end &&
        !nonPrefixTokens.has(prevToken.type)
      ) {
        type = 'VALUE';
        operator = '=';
        // Re-derive prefix from the previous token
        prefix = input.slice(prevToken.start, cursorOffset);
        tokenStart = prevToken.start;
        tokenEnd = prevToken.end;
      } else {
        type = 'LOGICAL_OPERATOR';
      }
      break;
    case EditorState.IN_QUOTED_STRING:
      type = 'VALUE';
      break;
    default:
      type = 'FIELD';
  }

  return {
    type,
    field,
    operator,
    prefix,
    tokenStart,
    tokenEnd,
    editorState,
    inQuotedString: editorState === EditorState.IN_QUOTED_STRING,
    inParenthesis: editorState === EditorState.IN_PARENTHESIS,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Check if prefix looks like the start of an operator token */
function isOperatorPrefix(prefix: string): boolean {
  const p = prefix.toLowerCase();
  // Comparison operators
  if (
    p === '!' ||
    p === '!=' ||
    p === '>' ||
    p === '>=' ||
    p === '<' ||
    p === '<='
  )
    return true;
  // Function operator prefixes
  const funcOps = [
    'contains',
    'startswith',
    'endswith',
    'before',
    'after',
    'in',
    '!contains',
    '!startswith',
    '!endswith',
    '!in',
  ];
  return funcOps.some((op) => op.startsWith(p));
}
