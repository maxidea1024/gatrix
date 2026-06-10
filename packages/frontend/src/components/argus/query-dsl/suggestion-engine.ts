// ============================================================================
// Query DSL Engine — Suggestion Engine
// Spec: Section 10, 11
// ============================================================================

import type {
  CursorContext,
  DomainConfig,
  QueryField,
  SuggestionItem,
  SuggestionCategory,
} from './types';
import { TokenType } from './types';
import { tokenize } from './lexer';
import { getFieldByKey } from './fields';
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
  config: DomainConfig,
  facets?: Map<string, string[]>,
  maxSuggestions: number = DEFAULT_MAX_SUGGESTIONS,
  chips?: { type?: string; label?: string }[]
): SuggestionItem[] {
  switch (context.type) {
    case 'FIELD':
      return getFieldSuggestions(
        context,
        config,
        facets,
        maxSuggestions,
        chips
      );
    case 'OPERATOR':
      return getOperatorAndValueSuggestions(
        context,
        config,
        facets,
        maxSuggestions
      );
    case 'VALUE':
      return getValueSuggestions(context, config, facets, maxSuggestions);
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
  config: DomainConfig,
  facets?: Map<string, string[]>,
  max: number = DEFAULT_MAX_SUGGESTIONS,
  chips?: { type?: string; label?: string }[]
): SuggestionItem[] {
  const fields = config.fields;
  const prefix = context.prefix.toLowerCase();
  const originalPrefix = context.prefix; // preserve original casing for display

  // Static (registered) fields
  const results: SuggestionItem[] = fields
    .filter((f) => f.key.toLowerCase().startsWith(prefix) || prefix === '')
    .map((f) => fieldToSuggestion(f));

  // Registered aliases (e.g. trace.id for trace_id)
  if (config.aliases) {
    for (const [aliasKey, canonicalKey] of Object.entries(config.aliases)) {
      const canonicalField = fields.find((f) => f.key === canonicalKey);
      if (!canonicalField) continue;
      if (prefix === '' || aliasKey.toLowerCase().startsWith(prefix)) {
        if (
          !results.some((r) => r.label.toLowerCase() === aliasKey.toLowerCase())
        ) {
          results.push({
            label: aliasKey,
            insertText: `${aliasKey}:`,
            category: 'field',
            description: canonicalField.description,
            fieldType: canonicalField.type,
            fieldCategory: canonicalField.category,
          });
        }
      }
    }
  }

  // Dynamic fields from facets (e.g. game.shard, custom attributes)
  // Exclude 'has'/'!has' — they are special existence operators, not actual fields
  if (facets) {
    const staticKeys = new Set(fields.map((f) => f.key));
    const reservedKeys = new Set(['has', '!has']);
    for (const key of facets.keys()) {
      if (staticKeys.has(key)) continue; // already in static list
      if (reservedKeys.has(key.toLowerCase())) continue; // special operators
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

  // ── Logical operator and paren suggestions (context-aware) ──
  const lastChip = chips && chips.length > 0 ? chips[chips.length - 1] : null;
  const hasFilterChip = chips?.some(
    (c) => c.type === 'filter' || (c.type === 'paren' && c.label === ')')
  );

  // ── has / !has existence operators ──
  // Show in All + Logic tabs — push to appear at the bottom (after field list)
  if (context.isNegated) {
    if (prefix === '' || 'has'.startsWith(prefix)) {
      results.push({
        label: 'has not',
        insertText: 'has:',
        category: 'field',
        fieldCategory: 'logic',
        description: 'dsl.has.fieldNotExists',
      });
    }
  } else {
    if (prefix === '' || 'has'.startsWith(prefix)) {
      results.push({
        label: 'has',
        insertText: 'has:',
        category: 'field',
        fieldCategory: 'logic',
        description: 'dsl.has.fieldExists',
      });
    }
    if (
      prefix === '' ||
      '!has'.startsWith(prefix) ||
      'has not'.startsWith(prefix) ||
      'not'.startsWith(prefix)
    ) {
      results.push({
        label: 'has not',
        insertText: '!has:',
        category: 'field',
        fieldCategory: 'logic',
        description: 'dsl.has.fieldNotExists',
      });
    }
  }

  // '(': always available
  if (prefix === '' || '('.startsWith(prefix)) {
    results.push({
      label: '(',
      category: 'paren',
      fieldCategory: 'logic',
    });
  }

  // ')': available when there's an unmatched '(' in chips
  const openParens =
    chips?.filter((c) => c.type === 'paren' && c.label === '(').length ?? 0;
  const closeParens =
    chips?.filter((c) => c.type === 'paren' && c.label === ')').length ?? 0;
  if (openParens > closeParens && (prefix === '' || ')'.startsWith(prefix))) {
    results.push({
      label: ')',
      category: 'paren',
      fieldCategory: 'logic',
    });
  }

  // AND/OR: available when at least one filter/closeparen chip exists
  if (
    hasFilterChip &&
    (lastChip?.type === 'filter' ||
      (lastChip?.type === 'paren' && lastChip?.label === ')'))
  ) {
    if (prefix === '' || 'and'.startsWith(prefix)) {
      results.push({
        label: 'AND',
        category: 'logical' as SuggestionCategory,
        fieldCategory: 'logic',
      });
    }
    if (prefix === '' || 'or'.startsWith(prefix)) {
      results.push({
        label: 'OR',
        category: 'logical' as SuggestionCategory,
        fieldCategory: 'logic',
      });
    }
  }

  // Exact match prioritization:
  // Move ANY suggestion whose label matches prefix (case-insensitive) to the very top.
  // This ensures 'AND', 'OR', exact field names, etc. appear first.
  if (prefix !== '') {
    const targetMatch =
      context.isNegated && prefix === 'has' ? 'has not' : prefix;
    const exactMatchIndex = results.findIndex(
      (item) => item.label.toLowerCase() === targetMatch
    );
    if (exactMatchIndex > 0) {
      const [exactMatchItem] = results.splice(exactMatchIndex, 1);
      results.unshift(exactMatchItem);
    }
  }

  // ── has:fieldName shortcut — insert right after the exact-matched field ──
  if (prefix !== '') {
    const matchedField = fields.find((f) => f.key.toLowerCase() === prefix);
    if (matchedField) {
      // Find the field in results (should be at index 0 after exact match)
      const fieldIdx = results.findIndex(
        (r) =>
          r.category === 'field' &&
          r.label === matchedField.key &&
          r.fieldCategory !== 'has'
      );
      if (fieldIdx >= 0) {
        results.splice(fieldIdx + 1, 0, {
          label: matchedField.key,
          insertText: `has:"${matchedField.key}"`,
          category: 'field',
          fieldCategory: 'has',
          description: 'dsl.has.fieldExists',
        });
      }
    }
  }

  // Smart suggestions: when user types free text, suggest message operator variants
  // Use originalPrefix to preserve user's casing in displayed labels
  // Pushed to the end so they appear below matching fields and logic keywords
  if (prefix !== '' && !prefix.includes(':')) {
    const escapedPrefix = originalPrefix.replace(/"/g, '\\"');

    const smartSuggestions: {
      label: string;
      insertText: string;
      desc: string;
    }[] = [
      // Primary — most common
      {
        label: `message contains ${originalPrefix}`,
        insertText: `message:contains("${escapedPrefix}")`,
        desc: 'dsl.smart.messageContains',
      },
      {
        label: `message is ${originalPrefix}`,
        insertText: `message:"${escapedPrefix}"`,
        desc: 'dsl.smart.messageIs',
      },
      // Negation
      {
        label: `message not contains ${originalPrefix}`,
        insertText: `message:!contains("${escapedPrefix}")`,
        desc: 'dsl.smart.messageNotContains',
      },
      {
        label: `message is not ${originalPrefix}`,
        insertText: `message:!="${escapedPrefix}"`,
        desc: 'dsl.smart.messageIsNot',
      },
      // Prefix/suffix
      {
        label: `message starts with ${originalPrefix}`,
        insertText: `message:startsWith("${escapedPrefix}")`,
        desc: 'dsl.smart.messageStartsWith',
      },
      {
        label: `message ends with ${originalPrefix}`,
        insertText: `message:endsWith("${escapedPrefix}")`,
        desc: 'dsl.smart.messageEndsWith',
      },
      // Negated prefix/suffix
      {
        label: `message not starts with ${originalPrefix}`,
        insertText: `message:!startsWith("${escapedPrefix}")`,
        desc: 'dsl.smart.messageNotStartsWith',
      },
      {
        label: `message not ends with ${originalPrefix}`,
        insertText: `message:!endsWith("${escapedPrefix}")`,
        desc: 'dsl.smart.messageNotEndsWith',
      },
    ];

    for (const s of smartSuggestions) {
      results.push({
        label: s.label,
        insertText: s.insertText,
        category: 'value',
        description: s.desc,
      });
    }
  }

  return results.slice(0, max);
}

/**
 * Spec Section 11.2: After colon, show BOTH operators and values.
 * Operators come first (excluding implicit '='), then values from facets.
 */
function getOperatorAndValueSuggestions(
  context: CursorContext,
  config: DomainConfig,
  facets?: Map<string, string[]>,
  max: number = DEFAULT_MAX_SUGGESTIONS
): SuggestionItem[] {
  if (!context.field) return [];

  // ── has / !has: show field list as values ──
  const fieldLower = context.field.toLowerCase();
  if (fieldLower === 'has' || fieldLower === '!has') {
    return getHasFieldSuggestions(context, config, facets, max);
  }

  const field = getFieldByKey(context.field, config);
  // For dynamic facet fields not in registry, create a virtual string field
  const effectiveField =
    field ??
    ({
      key: context.field,
      label: context.field,
      type: 'string',
      category: 'log',
      operators: [
        '=',
        '!=',
        'contains',
        '!contains',
        'startsWith',
        '!startsWith',
        'endsWith',
        '!endsWith',
      ],
      searchable: true,
      description: '',
    } as QueryField);

  const prefix = context.prefix.toLowerCase();
  const suggestions: SuggestionItem[] = [];

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

  return suggestions.slice(0, max);
}

function getValueSuggestions(
  context: CursorContext,
  config: DomainConfig,
  facets?: Map<string, string[]>,
  max: number = DEFAULT_MAX_SUGGESTIONS
): SuggestionItem[] {
  if (!context.field) return [];

  // ── has / !has: show field list as values ──
  const fieldLower = context.field.toLowerCase();
  if (fieldLower === 'has' || fieldLower === '!has') {
    return getHasFieldSuggestions(context, config, facets, max);
  }

  const field = getFieldByKey(context.field, config);
  const effectiveField =
    field ??
    ({
      key: context.field,
      label: context.field,
      type: 'string',
      category: 'log',
      operators: [
        '=',
        '!=',
        'contains',
        '!contains',
        'startsWith',
        '!startsWith',
        'endsWith',
        '!endsWith',
      ],
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

  // 0. Static values from field definition (highest priority)
  if (field.staticValues && field.staticValues.length > 0) {
    for (const v of field.staticValues) {
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

  // 1. Facet values from backend
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
    '!contains': 'dsl.op.notContains',
    startsWith: 'dsl.op.startsWith',
    '!startsWith': 'dsl.op.notStartsWith',
    endsWith: 'dsl.op.endsWith',
    '!endsWith': 'dsl.op.notEndsWith',
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

/**
 * Suggest field names after has: or !has: prefix.
 * Shows all available fields (static + dynamic from facets).
 */
function getHasFieldSuggestions(
  context: CursorContext,
  config: DomainConfig,
  facets?: Map<string, string[]>,
  max: number = DEFAULT_MAX_SUGGESTIONS
): SuggestionItem[] {
  const prefix = context.prefix.toLowerCase();
  const results: SuggestionItem[] = [];
  const fields = config.fields;

  // Static fields
  for (const f of fields) {
    if (prefix === '' || f.key.toLowerCase().startsWith(prefix)) {
      results.push({
        label: f.key,
        insertText: f.key,
        category: 'value',
        fieldCategory: f.category,
        description: f.description,
      });
    }
  }

  // Dynamic fields from facets
  // Exclude 'has'/'!has' — nonsensical as has:has target
  if (facets) {
    const staticKeys = new Set(fields.map((f) => f.key));
    const reservedKeys = new Set(['has', '!has']);
    for (const key of facets.keys()) {
      if (staticKeys.has(key)) continue;
      if (reservedKeys.has(key.toLowerCase())) continue;
      if (prefix === '' || key.toLowerCase().startsWith(prefix)) {
        results.push({
          label: key,
          insertText: key,
          category: 'value',
          fieldCategory: 'attribute',
        });
      }
    }
  }

  return results.slice(0, max);
}

/**
 * Determine if the given input query string is incomplete or should not be committed/auto-completed.
 * E.g., standalone 'has', '!has', 'not', '!', or filters ending with operators/colons without values.
 */
export function isIncompleteQuery(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();
  // 1. Direct logical and logic existence keywords that should not be committed by themselves
  if (
    lower === '!' ||
    lower === 'not' ||
    lower === 'has' ||
    lower === '!has' ||
    lower === 'has not' ||
    lower === 'and' ||
    lower === 'or'
  ) {
    return true;
  }

  // 2. Tokenize and check the last active token
  const tokens = tokenize(trimmed);
  const activeTokens = tokens.filter((t) => t.type !== TokenType.EOF);
  if (activeTokens.length === 0) return false;

  // Check if the query is has:"" or !has:"" (empty field name for existence check)
  for (let i = 0; i < activeTokens.length; i++) {
    const tok = activeTokens[i];
    if (
      tok.type === TokenType.FIELD &&
      tok.value.toLowerCase() === 'has' &&
      activeTokens[i + 1]?.type === TokenType.COLON
    ) {
      const valTok = activeTokens[i + 2];
      if (valTok && valTok.type === TokenType.STRING && valTok.value === '') {
        return true;
      }
    }
  }

  const lastToken = activeTokens[activeTokens.length - 1];

  // If it ends with an operator, structural delimiter, or logical operator
  if (
    lastToken.type === TokenType.COLON ||
    lastToken.type === TokenType.NE ||
    lastToken.type === TokenType.GT ||
    lastToken.type === TokenType.GTE ||
    lastToken.type === TokenType.LT ||
    lastToken.type === TokenType.LTE ||
    lastToken.type === TokenType.LBRACKET ||
    lastToken.type === TokenType.COMMA ||
    lastToken.type === TokenType.BANG ||
    lastToken.type === TokenType.NOT ||
    lastToken.type === TokenType.AND ||
    lastToken.type === TokenType.OR
  ) {
    return true;
  }

  // If it ends with a function operator (e.g. level:contains)
  const functionOperators = new Set([
    TokenType.CONTAINS,
    TokenType.STARTS_WITH,
    TokenType.ENDS_WITH,
    TokenType.BEFORE,
    TokenType.AFTER,
    TokenType.BETWEEN,
    TokenType.NOT_CONTAINS,
    TokenType.NOT_STARTS_WITH,
    TokenType.NOT_ENDS_WITH,
  ]);
  if (functionOperators.has(lastToken.type)) {
    return true;
  }

  // If the last token is a STRING that matches a function operator keyword (missing parens/value)
  if (
    lastToken.type === TokenType.STRING &&
    (lastToken.value.toLowerCase() === 'contains' ||
      lastToken.value.toLowerCase() === 'startswith' ||
      lastToken.value.toLowerCase() === 'endswith' ||
      lastToken.value.toLowerCase() === 'before' ||
      lastToken.value.toLowerCase() === 'after' ||
      lastToken.value.toLowerCase() === 'between' ||
      lastToken.value.toLowerCase() === '!contains' ||
      lastToken.value.toLowerCase() === '!startswith' ||
      lastToken.value.toLowerCase() === '!endswith')
  ) {
    return true;
  }

  // If it ends with an open paren, check if it's a function argument paren or multi-value list
  if (lastToken.type === TokenType.LPAREN) {
    if (activeTokens.length > 1) {
      const prev = activeTokens[activeTokens.length - 2];
      if (prev.type === TokenType.COLON || functionOperators.has(prev.type)) {
        return true;
      }
    }
  }

  return false;
}
