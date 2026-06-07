// ============================================================================
// Query DSL Engine — Operator Display Labels
// Sentry-style human-readable operator names
// ============================================================================

import type { QueryOperator } from './types';

// ─── Standard operator labels (string / number / boolean) ────────────────────

export const OP_LABELS: Record<string, string> = {
  '=': 'is',
  '!=': 'is not',
  '>': '>',
  '>=': '>=',
  '<': '<',
  '<=': '<=',
  contains: 'contains',
  '!contains': 'does not contain',
  startsWith: 'starts with',
  '!startsWith': 'does not start with',
  endsWith: 'ends with',
  '!endsWith': 'does not end with',
};

// ─── Date-specific operator labels ───────────────────────────────────────────

export const DATE_OP_LABELS: Record<string, string> = {
  '=': 'is',
  '>': 'is after',
  '>=': 'is on or after',
  '<': 'is before',
  '<=': 'is on or before',
  before: 'is before',
  after: 'is after',
};

// ─── Reverse lookup (label → operator) ───────────────────────────────────────

const _reverseLookupCache = new Map<string, Map<string, string>>();

function buildReverseMap(labels: Record<string, string>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [op, label] of Object.entries(labels)) {
    map.set(label, op);
  }
  return map;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get human-readable label for an operator, based on field type.
 */
export function getOpLabel(op: string, fieldType: string): string {
  if (fieldType === 'datetime') {
    return DATE_OP_LABELS[op] ?? OP_LABELS[op] ?? op;
  }
  return OP_LABELS[op] ?? op;
}

/**
 * Get the internal operator from a display label, based on field type.
 */
export function getOpFromLabel(label: string, fieldType: string): string {
  const cacheKey = fieldType === 'datetime' ? 'date' : 'standard';

  if (!_reverseLookupCache.has(cacheKey)) {
    const source = fieldType === 'datetime' ? DATE_OP_LABELS : OP_LABELS;
    _reverseLookupCache.set(cacheKey, buildReverseMap(source));
  }

  return _reverseLookupCache.get(cacheKey)!.get(label) ?? label;
}

/**
 * Get all available operator options for a field, with labels.
 * Uses the field's operators array from fields.ts.
 */
export function getOperatorOptions(
  operators: QueryOperator[],
  fieldType: string
): { op: string; label: string }[] {
  return operators.map((op) => ({
    op,
    label: getOpLabel(op, fieldType),
  }));
}
