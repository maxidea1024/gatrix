// ============================================================================
// Query DSL Engine — FilterChip Data Model & Serialization
// AST ↔ FilterChip[] conversion for tokenized grid editor
// ============================================================================

import { parse } from './parser';
import type { Expression, FilterExpression, QueryOperator } from './types';

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
  /** Internal operator (e.g., '=', '!=', 'contains') */
  operator?: QueryOperator | string;
  /** Filter value */
  value?: string;
  /** Whether the value was quoted */
  quoted?: boolean;

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

function collectChips(
  node: Expression,
  chips: FilterChip[],
): void {
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
        chips.push({ id: nextChipId(), type: 'logical', label: node.raw.toUpperCase() });
      } else if (node.raw === '(' || node.raw === ')') {
        chips.push({ id: nextChipId(), type: 'paren', label: node.raw });
      }
      break;
  }
}

function filterToChip(node: FilterExpression): FilterChip {
  return {
    id: nextChipId(),
    type: 'filter',
    field: node.field,
    operator: node.operator,
    value: String(node.value),
    quoted: node.quoted,
  };
}

function negateOperator(op: QueryOperator): QueryOperator {
  switch (op) {
    case '=': return '!=';
    case '!=': return '=';
    case 'contains': return 'contains'; // no negated form in our DSL yet
    default: return op;
  }
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
        if (i > 0 && chips[i - 1].label !== '(' && chips[i - 1].type !== 'logical') {
          parts.push(' ');
        }
        parts.push('(');
      } else {
        parts.push(')');
        if (i < chips.length - 1 && chips[i + 1].type !== 'logical' && chips[i + 1].label !== ')') {
          parts.push(' ');
        }
      }
    } else {
      // filter chip
      if (i > 0 && chips[i - 1].type !== 'logical' && chips[i - 1].label !== '(') {
        // implicitly insert space (AND) if not preceded by logical or (
        parts.push(' ');
      }
      parts.push(chipToQueryPart(chip));
    }
  }
  
  return parts.join('').replace(/\s+/g, ' ').trim();
}

function chipToQueryPart(chip: FilterChip): string {
  // Graceful fallback if type is filter but fields are missing
  const field = chip.field ?? '';
  const operator = chip.operator ?? '=';
  const value = chip.value ?? '';
  const quoted = chip.quoted ?? false;

  // Function operators: field:op("value")
  if (['contains', 'startsWith', 'endsWith', 'before', 'after'].includes(operator as string)) {
    return `${field}:${operator}("${escapeQuotes(value)}")`;
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
  return /[\s"(),]/.test(value) || value === '';
}

// ─── Query string → FilterChip[] (convenience) ──────────────────────────────

/**
 * Parse a DSL query string directly into FilterChips.
 */
export function queryToChips(query: string): FilterChip[] {
  const { ast } = parse(query);
  return astToChips(ast);
}
