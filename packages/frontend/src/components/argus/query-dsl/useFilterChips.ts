// ============================================================================
// Query DSL Engine — FilterChip Data Model & Serialization
// AST ↔ FilterChip[] conversion for tokenized grid editor
// ============================================================================

import { tokenize } from './lexer';
import { TokenType } from './types';
import type {
  Token,
  Expression,
  FilterExpression,
  QueryOperator,
} from './types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ChipType = 'filter' | 'logical' | 'paren';

export interface FilterChip {
  /** Unique identifier for React key and editing reference */
  id: string;
  /** Chip type. Undefined defaults to 'filter' for backward compatibility */
  type?: ChipType;
  /** For logical or paren chips: 'AND', 'OR', '(', ')' */
  label?: string;

  /** Field name (e.g., 'level', 'message') */
  field?: string;
  /** Internal operator (e.g., '=', '!=', 'contains', 'in') */
  operator?: QueryOperator | string;
  /** Filter value (first value for in/!in) */
  value?: string;
  /** Multiple values for in/!in operators */
  values?: string[];
  /** End value for 'between' operator (datetime range) */
  valueTo?: string;
  /** Whether the value was quoted */
  quoted?: boolean;
  /** Which part is currently being composed during step-by-step creation */
  composingPart?: 'operator' | 'value';
}

let _chipIdCounter = 0;

function nextChipId(): string {
  return `chip_${++_chipIdCounter}`;
}

// ─── AST → FilterChip[] ──────────────────────────────────────────────────────

/**
 * Convert a parsed AST into a flat array of FilterChip objects.
 * Binary (and/or) operators are flattened into explicit 'logical' chips.
 * Group nodes are flattened into explicit '(' and ')' chips.
 * FreeText nodes become message:contains("text") chips.
 */
export function astToChips(ast: Expression | null): FilterChip[] {
  if (!ast) return [];
  const chips: FilterChip[] = [];
  collectChips(ast, chips);
  return chips;
}

function collectChips(node: Expression, chips: FilterChip[]): void {
  switch (node.type) {
    case 'Filter':
      chips.push(filterToChip(node));
      break;
    case 'FreeText':
      chips.push({
        id: nextChipId(),
        type: 'filter',
        field: 'message',
        operator: 'contains',
        value: node.value,
        quoted: true,
      });
      break;
    case 'Binary': {
      collectChips(node.left, chips);
      if (!node.implicit) {
        chips.push({
          id: nextChipId(),
          type: 'logical',
          label: node.operator.toUpperCase(),
        });
      }
      collectChips(node.right, chips);
      break;
    }
    case 'Not':
      if (node.expression.type === 'Filter') {
        const chip = filterToChip(node.expression);
        chip.operator = negateOperator(chip.operator as QueryOperator);
        chips.push(chip);
      } else {
        chips.push({ id: nextChipId(), type: 'logical', label: 'NOT' });
        collectChips(node.expression, chips);
      }
      break;
    case 'Group':
      chips.push({ id: nextChipId(), type: 'paren', label: '(' });
      collectChips(node.expression, chips);
      chips.push({ id: nextChipId(), type: 'paren', label: ')' });
      break;
    case 'Partial':
      // Support building logical operators/parens sequentially chip-by-chip
      if (node.raw.toUpperCase() === 'AND' || node.raw.toUpperCase() === 'OR') {
        chips.push({
          id: nextChipId(),
          type: 'logical',
          label: node.raw.toUpperCase(),
        });
      } else if (node.raw === '(' || node.raw === ')') {
        chips.push({ id: nextChipId(), type: 'paren', label: node.raw });
      }
      break;
  }
}

function filterToChip(node: FilterExpression): FilterChip {
  const chip: FilterChip = {
    id: nextChipId(),
    type: 'filter',
    field: node.field,
    operator: node.operator,
    value: String(node.value),
    quoted: node.quoted,
  };
  // Populate values for multi-value operators
  if (node.values && node.values.length > 0) {
    chip.values = node.values.map(String);
    chip.value = chip.values.join(', ');
  }
  return chip;
}

function negateOperator(op: QueryOperator): QueryOperator {
  const negMap: Record<string, QueryOperator> = {
    '=': '!=',
    '!=': '=',
    contains: '!contains',
    '!contains': 'contains',
    startsWith: '!startsWith',
    '!startsWith': 'startsWith',
    endsWith: '!endsWith',
    '!endsWith': 'endsWith',
  };
  return negMap[op] ?? op;
}

// ─── FilterChip[] → DSL string ───────────────────────────────────────────────

/**
 * Serialize an array of FilterChips back to a DSL query string.
 */
export function chipsToQuery(chips: FilterChip[]): string {
  if (chips.length === 0) return '';
  const parts: string[] = [];

  for (let i = 0; i < chips.length; i++) {
    const chip = chips[i];

    if (chip.type === 'logical') {
      parts.push(` ${chip.label} `);
    } else if (chip.type === 'paren') {
      if (chip.label === '(') {
        if (
          i > 0 &&
          chips[i - 1].label !== '(' &&
          chips[i - 1].type !== 'logical'
        ) {
          parts.push(' ');
        }
        parts.push('(');
      } else {
        parts.push(')');
        if (
          i < chips.length - 1 &&
          chips[i + 1].type !== 'logical' &&
          chips[i + 1].label !== ')'
        ) {
          parts.push(' ');
        }
      }
    } else {
      // filter chip
      if (
        i > 0 &&
        chips[i - 1].type !== 'logical' &&
        chips[i - 1].label !== '('
      ) {
        // implicitly insert space (AND) if not preceded by logical or (
        parts.push(' ');
      }
      parts.push(chipToQueryPart(chip));
    }
  }

  return parts.join('').replace(/\s+/g, ' ').trim();
}

export function chipToQueryPart(chip: FilterChip): string {
  // Graceful fallback if type is filter but fields are missing
  const field = chip.field ?? '';
  const operator = chip.operator ?? '=';
  const value = chip.value ?? '';
  const quoted = chip.quoted ?? false;

  // has / !has operators: has:field or !has:field
  if (field === 'has' || field === '!has') {
    return `${field}:${value}`;
  }

  // Function operators: field:op("value") — including negated forms
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
  if (funcOps.includes(operator as string)) {
    return `${field}:${operator}("${escapeQuotes(value)}")`;
  }

  // Multi-value (in / not in): field:["v1", "v2"], field:!=["v1", "v2"]
  // Only use array form when there are 2+ values; single value falls through below
  if (chip.values && chip.values.length > 1) {
    const vals = chip.values;
    const quotedVals = vals.map((v) => `"${escapeQuotes(v)}"`).join(', ');

    // Explicit functions
    if (funcOps.includes(operator as string)) {
      return `${field}:${operator}(${quotedVals})`;
    }

    // Comparison ops (explicit)
    if (operator !== '=') {
      return `${field}:${operator}[${quotedVals}]`;
    }

    // Implicit '='
    return `${field}:[${quotedVals}]`;
  }

  // Comparison operators: field:!=value, field:>value
  if (operator !== '=') {
    if (quoted || needsQuoting(value)) {
      return `${field}:${operator}"${escapeQuotes(value)}"`;
    }
    return `${field}:${operator}${value}`;
  }

  // Simple equals: field:value or field:"value"
  if (quoted || needsQuoting(value)) {
    return `${field}:"${escapeQuotes(value)}"`;
  }
  return `${field}:${value}`;
}

function escapeQuotes(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function needsQuoting(value: string): boolean {
  return /[\s"(),\[\]]/.test(value) || value === '';
}

// ─── Query string → FilterChip[] (convenience) ──────────────────────────────

const COMPARE_OPS = new Set([
  TokenType.NE,
  TokenType.GT,
  TokenType.GTE,
  TokenType.LT,
  TokenType.LTE,
]);

const FUNC_OPS: Record<string, QueryOperator> = {
  [TokenType.CONTAINS]: 'contains',
  [TokenType.STARTS_WITH]: 'startsWith',
  [TokenType.ENDS_WITH]: 'endsWith',
  [TokenType.NOT_CONTAINS]: '!contains',
  [TokenType.NOT_STARTS_WITH]: '!startsWith',
  [TokenType.NOT_ENDS_WITH]: '!endsWith',
  [TokenType.BEFORE]: 'before',
  [TokenType.AFTER]: 'after',
};

const VALUE_TYPES = new Set([
  TokenType.STRING,
  TokenType.NUMBER,
  TokenType.BOOLEAN,
  TokenType.FIELD,
]);

/**
 * Parse a DSL query string directly into FilterChips.
 * Uses token-based reconstruction for perfect roundtrip fidelity.
 * Each token maps directly to a chip — parens/AND/OR are never auto-paired.
 */
export function queryToChips(query: string): FilterChip[] {
  if (!query.trim()) return [];
  const tokens = tokenize(query);
  const chips: FilterChip[] = [];
  let i = 0;

  const tok = (offset = 0): Token =>
    tokens[i + offset] ?? tokens[tokens.length - 1];
  const advance = () => {
    i++;
  };

  const parseMultiValueList = (): string[] => {
    advance(); // skip ( or [
    const values: string[] = [];
    while (
      tok().type !== TokenType.RPAREN &&
      tok().type !== TokenType.RBRACKET &&
      tok().type !== TokenType.EOF
    ) {
      const valTok = tok();
      if (VALUE_TYPES.has(valTok.type) || valTok.type === TokenType.FIELD) {
        values.push(valTok.value);
        advance();
      } else if (valTok.type === TokenType.COMMA) {
        advance(); // skip comma
      } else {
        advance(); // skip unexpected
      }
    }
    if (tok().type === TokenType.RPAREN || tok().type === TokenType.RBRACKET)
      advance(); // skip ) or ]
    return values;
  };

  while (tok().type !== TokenType.EOF) {
    const t = tok();

    // ── !has:field pattern → !has filter chip ──
    if (
      (t.type === TokenType.BANG || t.type === TokenType.NOT) &&
      tok(1)?.type === TokenType.FIELD &&
      tok(1)?.value.toLowerCase() === 'has' &&
      tok(2)?.type === TokenType.COLON
    ) {
      advance(); // skip BANG/NOT
      advance(); // skip 'has' FIELD
      advance(); // skip COLON
      const valTok = tok();
      if (VALUE_TYPES.has(valTok.type) || valTok.type === TokenType.FIELD) {
        chips.push({
          id: nextChipId(),
          type: 'filter',
          field: '!has',
          operator: '=',
          value: valTok.value,
          quoted: false,
        });
        advance();
      } else {
        chips.push({
          id: nextChipId(),
          type: 'filter',
          field: '!has',
          operator: '=',
          value: '',
          quoted: false,
        });
      }
      continue;
    }

    // ── FIELD:value pattern → filter chip ──
    if (t.type === TokenType.FIELD && tok(1)?.type === TokenType.COLON) {
      const field = t.value;

      // ── has:field pattern → has filter chip ──
      if (field.toLowerCase() === 'has') {
        advance(); // skip 'has' FIELD
        advance(); // skip COLON
        const valTok = tok();
        if (VALUE_TYPES.has(valTok.type) || valTok.type === TokenType.FIELD) {
          chips.push({
            id: nextChipId(),
            type: 'filter',
            field: 'has',
            operator: '=',
            value: valTok.value,
            quoted: false,
          });
          advance();
        } else {
          chips.push({
            id: nextChipId(),
            type: 'filter',
            field: 'has',
            operator: '=',
            value: '',
            quoted: false,
          });
        }
        continue;
      }

      advance(); // skip FIELD
      advance(); // skip COLON

      const opTok = tok();

      // Comparison operator: field:!=value, field:>value
      if (COMPARE_OPS.has(opTok.type)) {
        const operator = opTok.value as QueryOperator;
        advance(); // skip operator

        if (
          tok().type === TokenType.LPAREN ||
          tok().type === TokenType.LBRACKET
        ) {
          const values = parseMultiValueList();
          chips.push({
            id: nextChipId(),
            type: 'filter',
            field,
            operator,
            value: values.join(', '),
            values,
            quoted: true,
          });
          continue;
        }

        const valTok = tok();
        if (VALUE_TYPES.has(valTok.type)) {
          const rawChar = query[valTok.start];
          chips.push({
            id: nextChipId(),
            type: 'filter',
            field,
            operator,
            value: valTok.value,
            quoted: rawChar === '"',
          });
          advance();
        } else {
          chips.push({
            id: nextChipId(),
            type: 'filter',
            field,
            operator,
            value: '',
            quoted: false,
          });
        }
        continue;
      }

      // Function operator: field:contains("value"), field:startsWith("value"), etc.
      const funcOp = FUNC_OPS[opTok.type];
      if (funcOp) {
        advance(); // skip function name
        if (
          tok().type === TokenType.LPAREN ||
          tok().type === TokenType.LBRACKET
        ) {
          // parseMultiValueList already advances past the opening ( or [
          const values = parseMultiValueList();
          chips.push({
            id: nextChipId(),
            type: 'filter',
            field,
            operator: funcOp,
            value: values.length > 0 ? values[0] : '',
            values,
            quoted: true,
          });
          continue;

          // Single-value function: contains("value"), startsWith("value"), etc.
          const valTok = tok();
          if (VALUE_TYPES.has(valTok.type)) {
            chips.push({
              id: nextChipId(),
              type: 'filter',
              field,
              operator: funcOp,
              value: valTok.value,
              quoted: true,
            });
            advance();
          } else {
            chips.push({
              id: nextChipId(),
              type: 'filter',
              field,
              operator: funcOp,
              value: '',
              quoted: false,
            });
          }
          if (tok().type === TokenType.RPAREN) advance(); // skip )
        } else {
          // Function without parens (e.g., field:contains value)
          const valTok = tok();
          if (VALUE_TYPES.has(valTok.type)) {
            chips.push({
              id: nextChipId(),
              type: 'filter',
              field,
              operator: funcOp,
              value: valTok.value,
              quoted: true,
            });
            advance();
          } else {
            chips.push({
              id: nextChipId(),
              type: 'filter',
              field,
              operator: funcOp,
              value: '',
              quoted: false,
            });
          }
        }
        continue;
      }

      // Implicit '=' with multiple values
      if (
        opTok.type === TokenType.LPAREN ||
        opTok.type === TokenType.LBRACKET
      ) {
        const values = parseMultiValueList();
        chips.push({
          id: nextChipId(),
          type: 'filter',
          field,
          operator: '=',
          value: values.join(', '),
          values,
          quoted: true,
        });
        continue;
      }

      // Implicit '=' with value
      if (VALUE_TYPES.has(opTok.type)) {
        const rawChar = query[opTok.start];
        chips.push({
          id: nextChipId(),
          type: 'filter',
          field,
          operator: '=',
          value: opTok.value,
          quoted: rawChar === '"',
        });
        advance();
        continue;
      }

      // Incomplete: field: (no value)
      chips.push({
        id: nextChipId(),
        type: 'filter',
        field,
        operator: '=',
        value: '',
        quoted: false,
      });
      continue;
    }

    // ── AND / OR → logical chip ──
    if (t.type === TokenType.AND || t.type === TokenType.OR) {
      chips.push({
        id: nextChipId(),
        type: 'logical',
        label: t.value.toUpperCase(),
      });
      advance();
      continue;
    }

    // ── NOT → logical chip ──
    if (t.type === TokenType.NOT || t.type === TokenType.BANG) {
      chips.push({ id: nextChipId(), type: 'logical', label: 'NOT' });
      advance();
      continue;
    }

    // ── ( → paren chip ──
    if (t.type === TokenType.LPAREN) {
      chips.push({ id: nextChipId(), type: 'paren', label: '(' });
      advance();
      continue;
    }

    // ── ) → paren chip ──
    if (t.type === TokenType.RPAREN) {
      chips.push({ id: nextChipId(), type: 'paren', label: ')' });
      advance();
      continue;
    }

    // ── Standalone string/field → free text message search ──
    if (t.type === TokenType.STRING || t.type === TokenType.FIELD) {
      chips.push({
        id: nextChipId(),
        type: 'filter',
        field: 'message',
        operator: 'contains',
        value: t.value,
        quoted: true,
      });
      advance();
      continue;
    }

    // Skip unhandled tokens
    advance();
  }

  return chips;
}
