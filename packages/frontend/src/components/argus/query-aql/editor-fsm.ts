// ============================================================================
// AQL (Argus Query Language) Engine — Editor FSM (Finite State Machine)
// Spec: Section 8
// ============================================================================

import { TokenType, EditorState } from './types';
import type { Token } from './types';

export interface EditorFSMResult {
  state: EditorState;
  inAggregateParen: boolean;
  aggregateFunc?: string;
}

/**
 * Determine the current editor state based on tokens and cursor position.
 * The FSM walks tokens to determine what the user should type next.
 */
export function resolveEditorState(
  tokens: Token[],
  cursorOffset: number
): EditorFSMResult {
  let state = EditorState.EXPECT_FIELD;
  let parenDepth = 0;
  let inAggregateParen = false;
  let aggregateFunc: string | undefined;

  for (const token of tokens) {
    if (token.type === TokenType.EOF) break;
    if (token.start >= cursorOffset) break;

    switch (token.type) {
      case TokenType.FIELD:
        if (state === EditorState.EXPECT_FIELD) {
          state = EditorState.EXPECT_COLON;
        } else if (
          state === EditorState.EXPECT_OPERATOR_OR_VALUE ||
          state === EditorState.EXPECT_VALUE
        ) {
          state = EditorState.EXPECT_LOGICAL_OPERATOR;
        }
        break;

      case TokenType.COLON:
        if (state === EditorState.EXPECT_COLON) {
          state = EditorState.EXPECT_OPERATOR_OR_VALUE;
        }
        break;

      case TokenType.NE:
      case TokenType.GT:
      case TokenType.GTE:
      case TokenType.LT:
      case TokenType.LTE:
        if (state === EditorState.EXPECT_OPERATOR_OR_VALUE) {
          state = EditorState.EXPECT_VALUE;
        }
        break;

      case TokenType.CONTAINS:
      case TokenType.STARTS_WITH:
      case TokenType.ENDS_WITH:
      case TokenType.NOT_CONTAINS:
      case TokenType.NOT_STARTS_WITH:
      case TokenType.NOT_ENDS_WITH:
      case TokenType.BEFORE:
      case TokenType.AFTER:
        if (state === EditorState.EXPECT_OPERATOR_OR_VALUE) {
          state = EditorState.EXPECT_VALUE;
        }
        break;

      case TokenType.STRING:
      case TokenType.NUMBER:
      case TokenType.BOOLEAN:
        if (
          state === EditorState.EXPECT_OPERATOR_OR_VALUE ||
          state === EditorState.EXPECT_VALUE
        ) {
          state = EditorState.EXPECT_LOGICAL_OPERATOR;
        }
        break;

      case TokenType.AND:
      case TokenType.OR:
        state = EditorState.EXPECT_FIELD;
        break;

      case TokenType.NOT:
      case TokenType.BANG:
        if (state === EditorState.EXPECT_FIELD) {
          // Stay in EXPECT_FIELD
        }
        break;

      case TokenType.LPAREN:
        parenDepth++;
        if (state === EditorState.EXPECT_COLON) {
          // FIELD followed by LPAREN → aggregate function args (e.g., count(, avg(duration)
          // Stay in a state that will transition to EXPECT_COLON after RPAREN
          inAggregateParen = true;
          // Find the preceding FIELD token to get the aggregate function name
          for (let j = tokens.indexOf(token) - 1; j >= 0; j--) {
            if (tokens[j].type === TokenType.FIELD) {
              aggregateFunc = tokens[j].value;
              break;
            }
          }
        } else if (state === EditorState.EXPECT_FIELD) {
          state = EditorState.IN_PARENTHESIS;
          // Reset to expect field inside parens
          state = EditorState.EXPECT_FIELD;
        }
        break;

      case TokenType.LBRACKET:
        // [ starts a value list — expect values inside
        parenDepth++;
        break;

      case TokenType.RPAREN:
        parenDepth = Math.max(0, parenDepth - 1);
        if (inAggregateParen) {
          // Closing aggregate function paren → expect colon next (e.g., count():|)
          state = EditorState.EXPECT_COLON;
          inAggregateParen = false;
        } else {
          state = EditorState.EXPECT_LOGICAL_OPERATOR;
        }
        break;

      case TokenType.RBRACKET:
        parenDepth = Math.max(0, parenDepth - 1);
        state = EditorState.EXPECT_LOGICAL_OPERATOR;
        break;

      case TokenType.COMMA:
        // Inside function args, expect another value
        state = EditorState.EXPECT_VALUE;
        break;
    }
  }

  // If cursor is inside a quoted string, check by scanning raw input
  // This handles empty strings "" that token-based detection misses
  if (isInsideQuotedString(tokens, cursorOffset)) {
    state = EditorState.IN_QUOTED_STRING;
  }

  // If inside value list brackets/parens (e.g., :[...], contains(...)), force VALUE context
  if (isInsideValueListParens(tokens, cursorOffset)) {
    if (state !== EditorState.IN_QUOTED_STRING) {
      state = EditorState.EXPECT_VALUE;
    }
  }

  if (parenDepth > 0 && state === EditorState.EXPECT_FIELD) {
    state = EditorState.IN_PARENTHESIS;
  }

  return { state, inAggregateParen, aggregateFunc };
}

/**
 * Check if cursor is inside a quoted string by scanning tokens.
 * Handles empty strings "" where token.start === token.end - 2.
 */
function isInsideQuotedString(tokens: Token[], cursorOffset: number): boolean {
  for (const token of tokens) {
    if (token.type === TokenType.STRING) {
      // STRING tokens include quotes in their span
      // If cursor is anywhere within the token's character range, we're inside
      if (token.start < cursorOffset && cursorOffset < token.end) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if cursor is inside value list brackets/parens (e.g., field:[...], field:contains(...)).
 */
function isInsideValueListParens(
  tokens: Token[],
  cursorOffset: number
): boolean {
  let inValueList = false;
  let depth = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === TokenType.EOF) break;
    if (token.start >= cursorOffset) break;

    if (token.type === TokenType.LPAREN || token.type === TokenType.LBRACKET) {
      const prev = i > 0 ? tokens[i - 1] : null;
      if (
        prev &&
        (prev.type === TokenType.COLON ||
          prev.type === TokenType.NE ||
          prev.type === TokenType.GT ||
          prev.type === TokenType.GTE ||
          prev.type === TokenType.LT ||
          prev.type === TokenType.LTE ||
          prev.type === TokenType.CONTAINS ||
          prev.type === TokenType.STARTS_WITH ||
          prev.type === TokenType.ENDS_WITH ||
          prev.type === TokenType.NOT_CONTAINS ||
          prev.type === TokenType.NOT_STARTS_WITH ||
          prev.type === TokenType.NOT_ENDS_WITH ||
          prev.type === TokenType.BEFORE ||
          prev.type === TokenType.AFTER)
      ) {
        depth++;
        inValueList = true;
      } else if (inValueList) {
        depth++;
      }
    } else if (
      token.type === TokenType.RPAREN ||
      token.type === TokenType.RBRACKET
    ) {
      if (inValueList) {
        depth--;
        if (depth === 0) {
          inValueList = false;
        }
      }
    }
  }

  return inValueList && depth > 0;
}
