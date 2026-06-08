// ============================================================================
// Query DSL Engine — Formatter (Pretty Print + Syntax Highlighting)
// Spec: Section 16
// ============================================================================

import { TokenType } from './types';
import type { Token, Expression, ValidationError } from './types';

// ─── Token Span Types ────────────────────────────────────────────────────────

export interface TokenSpan {
  text: string;
  className: string;
  start: number;
  end: number;
  errorMessage?: string;
  errorSeverity?: 'error' | 'warning';
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Pretty-print an AST to a formatted query string.
 */
export function formatQuery(ast: Expression | null): string {
  if (!ast) return '';
  return formatNode(ast);
}

/**
 * Convert tokens + validation errors into styled spans for syntax highlighting.
 * Each span has a CSS class and optional error info.
 */
export function renderTokensToSpans(
  input: string,
  tokens: Token[],
  errors: ValidationError[] = []
): TokenSpan[] {
  const spans: TokenSpan[] = [];
  let lastEnd = 0;

  for (const token of tokens) {
    if (token.type === TokenType.EOF) break;

    // Add whitespace span if there's a gap
    if (token.start > lastEnd) {
      spans.push({
        text: input.slice(lastEnd, token.start),
        className: 'token-whitespace',
        start: lastEnd,
        end: token.start,
      });
    }

    const className = getTokenClassName(token.type);
    const span: TokenSpan = {
      text: input.slice(token.start, token.end),
      className,
      start: token.start,
      end: token.end,
    };

    // Check if this token overlaps with any error
    const error = errors.find(
      (e) => e.start <= token.start && e.end >= token.end
    );
    if (error) {
      span.className += ` token-${error.severity}`;
      span.errorMessage = error.messageKey;
      span.errorSeverity = error.severity;
    }

    spans.push(span);
    lastEnd = token.end;
  }

  // Trailing whitespace
  if (lastEnd < input.length) {
    spans.push({
      text: input.slice(lastEnd),
      className: 'token-whitespace',
      start: lastEnd,
      end: input.length,
    });
  }

  return spans;
}

// ─── Formatting ──────────────────────────────────────────────────────────────

function formatNode(node: Expression): string {
  switch (node.type) {
    case 'Filter': {
      const { field, operator, value, values, funcOp } = node;
      if (operator === 'between' && values && values.length >= 2) {
        return `${field}:between("${values[0]}","${values[1]}")`;
      }
      if (funcOp) {
        return `${field}:${funcOp}("${value}")`;
      }
      if (operator === '=') {
        return `${field}:${formatValue(value)}`;
      }
      return `${field}:${operator}${formatValue(value)}`;
    }
    case 'FreeText':
      return node.quoted ? `"${node.value}"` : node.value;
    case 'Binary':
      return node.implicit
        ? `${formatNode(node.left)} ${formatNode(node.right)}`
        : `${formatNode(node.left)} ${node.operator} ${formatNode(node.right)}`;
    case 'Not':
      return node.usedBang
        ? `!${formatNode(node.expression)}`
        : `not ${formatNode(node.expression)}`;
    case 'Group':
      return `(${formatNode(node.expression)})`;
    case 'Partial':
      return node.raw;
    default:
      return '';
  }
}

function formatValue(value: string | number | boolean): string {
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (value.includes(' ')) return `"${value}"`;
  return value;
}

// ─── Token CSS classes ───────────────────────────────────────────────────────

function getTokenClassName(type: TokenType): string {
  switch (type) {
    case TokenType.FIELD:
      return 'token-field';
    case TokenType.STRING:
      return 'token-string';
    case TokenType.NUMBER:
      return 'token-number';
    case TokenType.BOOLEAN:
      return 'token-boolean';
    case TokenType.COLON:
      return 'token-colon';
    case TokenType.LPAREN:
    case TokenType.RPAREN:
      return 'token-paren';
    case TokenType.NE:
    case TokenType.GT:
    case TokenType.GTE:
    case TokenType.LT:
    case TokenType.LTE:
      return 'token-operator';
    case TokenType.CONTAINS:
    case TokenType.STARTS_WITH:
    case TokenType.ENDS_WITH:
    case TokenType.BEFORE:
    case TokenType.AFTER:
    case TokenType.BETWEEN:
      return 'token-function';
    case TokenType.AND:
    case TokenType.OR:
    case TokenType.NOT:
    case TokenType.BANG:
      return 'token-logical';
    case TokenType.COMMA:
      return 'token-comma';
    case TokenType.ERROR:
      return 'token-error';
    default:
      return 'token-unknown';
  }
}
