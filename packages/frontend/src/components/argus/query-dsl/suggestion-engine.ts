// ============================================================================
// Query DSL Engine — Suggestion Engine
// Spec: Section 10, 11
// ============================================================================

import type {
  CursorContext,
  QueryDomain,
  QueryField,
  SuggestionItem,
  SuggestionCategory,
} from './types';
import { getFieldsForDomain, getFieldByKey } from './fields';
import { getOpLabel } from './operator-labels';

/** Default max suggestions (Spec 11.1.1) */
const DEFAULT_MAX_SUGGESTIONS = 20;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get autocomplete suggestions based on cursor context.
 * Per Spec Section 10.6 Rule 1: Each state only shows its appropriate suggestions.
 */
export function getSuggestions(
  context: CursorContext,
  domain: QueryDomain,
  facets?: Map<string, string[]>,
  maxSuggestions: number = DEFAULT_MAX_SUGGESTIONS,
  chips?: { type?: string; label?: string }[]
): SuggestionItem[] {
  switch (context.type) {
    case 'FIELD':
      return getFieldSuggestions(context, domain, facets, maxSuggestions);
    case 'OPERATOR':
      // Spec 10.6 Rule 1: EXPECT_OPERATOR_OR_VALUE → show operators AND values
      return getOperatorAndValueSuggestions(
        context,
        domain,
        facets,
        maxSuggestions
      );
    case 'VALUE':
      return getValueSuggestions(context, domain, facets, maxSuggestions);
    case 'LOGICAL_OPERATOR':
      return getLogicalSuggestions(maxSuggestions, chips);
    default:
      return [];
  }
}

/**
 * Apply a suggestion to the current input.
 * Spec Section 10.1: Always REPLACE, never insert.
 * Returns new text and cursor offset after replacement.
 */
export function applyCompletion(
  input: string,
  context: CursorContext,
  item: SuggestionItem
): { text: string; cursorOffset: number } {
  const before = input.slice(0, context.tokenStart);
  const after = input.slice(context.tokenEnd);

  let insert = item.insertText ?? item.label;
  let cursorDelta = 0; // negative delta = move cursor back from end of insert

  // Spec 10.6 Rule 2: Field selection → auto-append colon
  if (item.category === 'field' && !insert.endsWith(':')) {
    insert += ':';
  }

  // Spec 10.6 Rule 5: Logical operator → auto-append space
  if (item.category === 'logical' && !insert.endsWith(' ')) {
    insert += ' ';
  }

  // Spec 10.6 Rule 3: Function operator → cursor inside quotes
  // e.g. contains("") → cursor between the quotes
  if (item.category === 'operator' && insert.endsWith('("")')) {
    cursorDelta = -2; // place cursor between the quotes: contains("|")
  }

  // '=' operator → insert "" with cursor between quotes
  if (item.category === 'operator' && insert === '""') {
    cursorDelta = -1; // place cursor between quotes: "|"
  }

  const text = before + insert + after;
  const cursorOffset = before.length + insert.length + cursorDelta;

  return { text, cursorOffset };
}

/**
 * Determine if the dropdown should stay open after a suggestion is applied.
 * Spec 10.6: field → show operators+values, operator → show values,
 * value/logical → close.
 */
export function shouldKeepDropdownOpen(item: SuggestionItem): boolean {
  return item.category === 'field' || item.category === 'operator';
}

// ─── Suggestion generators ───────────────────────────────────────────────────

function getFieldSuggestions(
  context: CursorContext,
  domain: QueryDomain,
  facets?: Map<string, string[]>,
  max: number = DEFAULT_MAX_SUGGESTIONS
): SuggestionItem[] {
  const fields = getFieldsForDomain(domain);
  const prefix = context.prefix.toLowerCase();

  // Static (registered) fields
  const results: SuggestionItem[] = fields
    .filter((f) => f.key.toLowerCase().startsWith(prefix) || prefix === '')
    .map((f) => fieldToSuggestion(f));

  // Dynamic fields from facets (e.g. game.shard, custom attributes)
  if (facets) {
    const staticKeys = new Set(fields.map((f) => f.key));
    for (const key of facets.keys()) {
      if (staticKeys.has(key)) continue; // already in static list
      if (prefix === '' || key.toLowerCase().startsWith(prefix)) {
        results.push({
          label: key,
          insertText: `${key}:`,
          category: 'field',
          fieldType: 'string',
          fieldCategory: 'attribute',
        });
      }
    }
  }

  // Smart suggestions: when user types free text, suggest message:contains("X") and message:"X"
  if (prefix !== '' && !prefix.includes(':')) {
    const escapedPrefix = prefix.replace(/"/g, '\\"');
    results.unshift({
      label: `message is ${prefix}`,
      insertText: `message:"${escapedPrefix}"`,
      category: 'value',
      description: 'dsl.smart.messageIs',
    });
    results.unshift({
      label: `message contains ${prefix}`,
      insertText: `message:contains("${escapedPrefix}")`,
      category: 'value',
      description: 'dsl.smart.messageContains',
    });
  }

  // Suggest '(' when user is just starting a new token
  if (prefix === '' || '('.startsWith(prefix)) {
    results.unshift({
      label: '(',
      category: 'paren',
      fieldCategory: 'logic',
    });
  }

  return results.slice(0, max);
}

/**
 * Spec Section 11.2: After colon, show BOTH operators and values.
 * Operators come first (excluding implicit '='), then values from facets.
 */
function getOperatorAndValueSuggestions(
  context: CursorContext,
  domain: QueryDomain,
  facets?: Map<string, string[]>,
  max: number = DEFAULT_MAX_SUGGESTIONS
): SuggestionItem[] {
  if (!context.field) return [];

  const field = getFieldByKey(context.field, domain);
  // For dynamic facet fields not in registry, create a virtual string field
  const effectiveField =
    field ??
    ({
      key: context.field,
      label: context.field,
      type: 'string',
      category: 'log',
      operators: ['=', '!=', 'contains', 'startsWith', 'endsWith'],
      searchable: true,
      description: '',
    } as QueryField);

  const prefix = context.prefix.toLowerCase();
  const suggestions: SuggestionItem[] = [];

  // ── Operators ──
  const ops = effectiveField.operators;
  for (const op of ops) {
    const label = getOpLabel(op, effectiveField.type);
    const labelLower = label.toLowerCase();
    const opLower = op.toLowerCase();

    if (
      prefix === '' ||
      labelLower.startsWith(prefix) ||
      opLower.startsWith(prefix) ||
      op.startsWith(prefix)
    ) {
      suggestions.push({
        label: op,
        insertText: formatOperatorInsert(op),
        category: 'operator',
        description: getOperatorDescriptionKey(op),
        fieldType: effectiveField.type,
      });
    }
  }

  // ── Values (from facets and type-specific) ──
  const valueSuggestions = buildValueSuggestions(
    effectiveField,
    context.field,
    '=',
    prefix,
    facets,
    max
  );
  suggestions.push(...valueSuggestions);

  return suggestions.slice(0, max);
}

function getValueSuggestions(
  context: CursorContext,
  domain: QueryDomain,
  facets?: Map<string, string[]>,
  max: number = DEFAULT_MAX_SUGGESTIONS
): SuggestionItem[] {
  if (!context.field) return [];

  const field = getFieldByKey(context.field, domain);
  const effectiveField =
    field ??
    ({
      key: context.field,
      label: context.field,
      type: 'string',
      category: 'log',
      operators: ['=', '!=', 'contains', 'startsWith', 'endsWith'],
      searchable: true,
      description: '',
    } as QueryField);

  const prefix = context.prefix.toLowerCase();
  const operator = context.operator ?? '=';

  return buildValueSuggestions(
    effectiveField,
    context.field,
    operator,
    prefix,
    facets,
    max
  );
}

function getLogicalSuggestions(
  max: number,
  chips?: { type?: string; label?: string }[]
): SuggestionItem[] {
  const results: SuggestionItem[] = [];

  // AND/OR only after a filter chip (key:value) or closing paren ')'
  const lastChip = chips && chips.length > 0 ? chips[chips.length - 1] : null;
  const allowLogical =
    lastChip != null &&
    (lastChip.type === 'filter' ||
      (lastChip.type === 'paren' && lastChip.label === ')'));

  if (allowLogical) {
    results.push(
      {
        label: 'AND',
        category: 'logical' as SuggestionCategory,
        fieldCategory: 'logic',
      },
      {
        label: 'OR',
        category: 'logical' as SuggestionCategory,
        fieldCategory: 'logic',
      }
    );
  }

  // Always allow closing paren
  results.push({
    label: ')',
    category: 'paren' as SuggestionCategory,
    fieldCategory: 'logic',
  });

  return results.slice(0, max);
}

// ─── Shared value builder ────────────────────────────────────────────────────

function buildValueSuggestions(
  field: QueryField,
  fieldKey: string,
  operator: string,
  prefix: string,
  facets?: Map<string, string[]>,
  max: number = DEFAULT_MAX_SUGGESTIONS
): SuggestionItem[] {
  const suggestions: SuggestionItem[] = [];
  const seen = new Set<string>();

  // 1. Facet values from backend (the ONLY source of field values)
  if (facets && facets.has(fieldKey)) {
    const values = facets.get(fieldKey)!;
    for (const v of values) {
      if (seen.has(v)) continue;
      if (prefix === '' || v.toLowerCase().startsWith(prefix)) {
        seen.add(v);
        suggestions.push({
          label: v,
          insertText: needsQuoting(v) ? `"${v}"` : v,
          category: 'value',
          fieldType: field.type,
        });
      }
      if (suggestions.length >= max) return suggestions;
    }
  }

  // 2. Boolean values for boolean-typed fields
  if (field.type === 'boolean') {
    for (const v of ['true', 'false']) {
      if (seen.has(v)) continue;
      if (prefix === '' || v.startsWith(prefix)) {
        seen.add(v);
        suggestions.push({
          label: v,
          category: 'value',
        });
      }
    }
  }

  // 3. Relative time hints for datetime fields (Spec Section 2.2)
  if (field.type === 'datetime') {
    const timeHints = ['now-1h', 'now-24h', 'now-7d', 'now-30d'];
    for (const h of timeHints) {
      if (prefix === '' || h.startsWith(prefix)) {
        suggestions.push({
          label: h,
          insertText: `"${h}"`,
          category: 'value',
        });
      }
    }
  }

  return suggestions.slice(0, max);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fieldToSuggestion(field: QueryField): SuggestionItem {
  return {
    label: field.key,
    insertText: `${field.key}:`,
    category: 'field',
    description: field.description,
    fieldType: field.type,
    fieldCategory: field.category,
  };
}

/**
 * Format operator insertText.
 * Spec Section 10.6 Rule 3: Function operators → auto-complete with ("") structure
 */
function formatOperatorInsert(op: string): string {
  // '=' is implicit — insert "" so user types value between quotes
  if (op === '=') {
    return '""';
  }
  const funcOps = [
    'contains',
    'startsWith',
    'endsWith',
    'before',
    'after',
    'in',
  ];
  if (funcOps.includes(op)) {
    // Insert full structure: contains("") — cursor goes between quotes
    return `${op}("")`;
  }
  // Comparison operators: just the operator symbol
  return op;
}

/** i18n key for operator description (translated in UI) */
function getOperatorDescriptionKey(op: string): string {
  const keys: Record<string, string> = {
    '=': 'dsl.op.equals',
    '!=': 'dsl.op.notEquals',
    '>': 'dsl.op.greaterThan',
    '>=': 'dsl.op.greaterOrEqual',
    '<': 'dsl.op.lessThan',
    '<=': 'dsl.op.lessOrEqual',
    contains: 'dsl.op.contains',
    startsWith: 'dsl.op.startsWith',
    endsWith: 'dsl.op.endsWith',
    before: 'dsl.op.before',
    after: 'dsl.op.after',
    in: 'dsl.op.in',
  };
  return keys[op] ?? op;
}

function needsQuoting(value: string): boolean {
  return (
    value.includes(' ') ||
    value.includes('"') ||
    value.includes('(') ||
    value.includes(')')
  );
}
