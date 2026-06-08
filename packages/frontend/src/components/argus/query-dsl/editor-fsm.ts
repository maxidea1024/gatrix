// ============================================================================
// Query DSL Engine — Editor FSM (Finite State Machine)
// Spec: Section 8
// ============================================================================

import { TokenType, EditorState } from './types';
import type { Token } from './types';

/**
 * Determine the current editor state based on tokens and cursor position.
 * The FSM walks tokens to determine what the user should type next.
 */
export function resolveEditorState(
  tokens: Token[],
  cursorOffset: number
): EditorState {
  let state = EditorState.EXPECT_FIELD;
  let parenDepth = 0;

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
        if (state === EditorState.EXPECT_FIELD) {
          state = EditorState.IN_PARENTHESIS;
          // Reset to expect field inside parens
          state = EditorState.EXPECT_FIELD;
        }
        break;

      case TokenType.RPAREN:
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

  // If inside function parentheses (e.g., contains(...)), force VALUE context
  if (isInsideFunctionParens(tokens, cursorOffset)) {
    if (state !== EditorState.IN_QUOTED_STRING) {
      state = EditorState.EXPECT_VALUE;
    }
  }

  if (parenDepth > 0 && state === EditorState.EXPECT_FIELD) {
    state = EditorState.IN_PARENTHESIS;
  }

  return state;
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
      if (token.start < cursorOffset && cursorOffset <= token.end) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if cursor is inside function parentheses (e.g., contains(...)).
 * Tracks LPAREN after function operator tokens.
 */
function isInsideFunctionParens(
  tokens: Token[],
  cursorOffset: number
): boolean {
  const funcOps = new Set([
    TokenType.CONTAINS,
    TokenType.STARTS_WITH,
    TokenType.ENDS_WITH,
    TokenType.NOT_CONTAINS,
    TokenType.NOT_STARTS_WITH,
    TokenType.NOT_ENDS_WITH,
    TokenType.BEFORE,
    TokenType.AFTER,
  ]);

  let afterFuncOp = false;
  let funcParenDepth = 0;

  for (const token of tokens) {
    if (token.type === TokenType.EOF) break;
    if (token.start >= cursorOffset) break;

    if (funcOps.has(token.type)) {
      afterFuncOp = true;
    } else if (token.type === TokenType.LPAREN && afterFuncOp) {
      funcParenDepth++;
    } else if (token.type === TokenType.RPAREN && funcParenDepth > 0) {
      funcParenDepth--;
      afterFuncOp = false;
    } else if (token.type !== TokenType.LPAREN) {
      afterFuncOp = false;
    }
  }

  return funcParenDepth > 0;
}
