/**
 * Field Definitions for Argus Search
 *
 * Defines field types, categories, descriptions, and available operators
 * for the search query builder. Unknown fields discovered dynamically
 * from facets default to type: 'string'.
 */

// ─── Types ───────────────────────────────────────────────────────────────

export type FieldType = 'string' | 'number' | 'date' | 'boolean';
export type FieldCategory =
  | 'log'
  | 'resource'
  | 'trace'
  | 'event'
  | 'user'
  | 'custom';

export interface Operator {
  /** Internal value sent to backend (e.g. 'is', 'contains', 'starts_with') */
  value: string;
  /** Display label for UI */
  label: string;
  /** Short label for chip display */
  shortLabel: string;
  /** The query syntax produced: 'key:value', 'key.contains:value', '!key:value' */
  queryFormat: 'colon' | 'dot' | 'negated';
}

export interface FieldDefinition {
  type: FieldType;
  category: FieldCategory;
  description: string;
  /** Optional: if true, this field is an alias (e.g., severity → level) */
  aliasFor?: string;
}

// ─── Operators by Type ───────────────────────────────────────────────────

export const OPERATORS_BY_TYPE: Record<FieldType, Operator[]> = {
  string: [
    {
      value: 'is',
      label: 'argus.search.op.is',
      shortLabel: 'is',
      queryFormat: 'colon',
    },
    {
      value: 'is_not',
      label: 'argus.search.op.isNot',
      shortLabel: '≠',
      queryFormat: 'negated',
    },
    {
      value: 'contains',
      label: 'argus.search.op.contains',
      shortLabel: 'contains',
      queryFormat: 'dot',
    },
    {
      value: 'not_contains',
      label: 'argus.search.op.notContains',
      shortLabel: '!contains',
      queryFormat: 'dot',
    },
    {
      value: 'starts_with',
      label: 'argus.search.op.startsWith',
      shortLabel: 'starts',
      queryFormat: 'dot',
    },
    {
      value: 'ends_with',
      label: 'argus.search.op.endsWith',
      shortLabel: 'ends',
      queryFormat: 'dot',
    },
  ],
  number: [
    {
      value: 'is',
      label: 'argus.search.op.equal',
      shortLabel: '=',
      queryFormat: 'colon',
    },
    {
      value: '!=',
      label: 'argus.search.op.notEqual',
      shortLabel: '≠',
      queryFormat: 'negated',
    },
    {
      value: '>',
      label: 'argus.search.op.greaterThan',
      shortLabel: '>',
      queryFormat: 'colon',
    },
    {
      value: '>=',
      label: 'argus.search.op.greaterEqual',
      shortLabel: '≥',
      queryFormat: 'colon',
    },
    {
      value: '<',
      label: 'argus.search.op.lessThan',
      shortLabel: '<',
      queryFormat: 'colon',
    },
    {
      value: '<=',
      label: 'argus.search.op.lessEqual',
      shortLabel: '≤',
      queryFormat: 'colon',
    },
  ],
  date: [
    {
      value: 'is',
      label: 'argus.search.op.is',
      shortLabel: 'is',
      queryFormat: 'colon',
    },
    {
      value: '>',
      label: 'argus.search.op.after',
      shortLabel: 'after',
      queryFormat: 'colon',
    },
    {
      value: '<',
      label: 'argus.search.op.before',
      shortLabel: 'before',
      queryFormat: 'colon',
    },
    {
      value: '>=',
      label: 'argus.search.op.onOrAfter',
      shortLabel: '≥',
      queryFormat: 'colon',
    },
    {
      value: '<=',
      label: 'argus.search.op.onOrBefore',
      shortLabel: '≤',
      queryFormat: 'colon',
    },
  ],
  boolean: [
    {
      value: 'is',
      label: 'argus.search.op.is',
      shortLabel: 'is',
      queryFormat: 'colon',
    },
    {
      value: 'is_not',
      label: 'argus.search.op.isNot',
      shortLabel: '≠',
      queryFormat: 'negated',
    },
  ],
};

// ─── Known Field Definitions ─────────────────────────────────────────────

export const FIELD_DEFINITIONS: Record<string, FieldDefinition> = {
  // Log fields
  level: {
    type: 'string',
    category: 'log',
    description: 'argus.search.field.level',
  },
  severity: {
    type: 'string',
    category: 'log',
    description: 'argus.search.field.severity',
    aliasFor: 'level',
  },
  message: {
    type: 'string',
    category: 'log',
    description: 'argus.search.field.message',
  },
  body: {
    type: 'string',
    category: 'log',
    description: 'argus.search.field.body',
  },
  logger_name: {
    type: 'string',
    category: 'log',
    description: 'argus.search.field.loggerName',
  },
  logger: {
    type: 'string',
    category: 'log',
    description: 'argus.search.field.logger',
    aliasFor: 'logger_name',
  },
  timestamp: {
    type: 'date',
    category: 'log',
    description: 'argus.search.field.timestamp',
  },

  // Resource fields
  service: {
    type: 'string',
    category: 'resource',
    description: 'argus.search.field.service',
  },
  environment: {
    type: 'string',
    category: 'resource',
    description: 'argus.search.field.environment',
  },
  release: {
    type: 'string',
    category: 'resource',
    description: 'argus.search.field.release',
  },

  // Trace fields
  trace_id: {
    type: 'string',
    category: 'trace',
    description: 'argus.search.field.traceId',
  },
  'trace.id': {
    type: 'string',
    category: 'trace',
    description: 'argus.search.field.traceId',
    aliasFor: 'trace_id',
  },
  span_id: {
    type: 'string',
    category: 'trace',
    description: 'argus.search.field.spanId',
  },
  'span.id': {
    type: 'string',
    category: 'trace',
    description: 'argus.search.field.spanId',
    aliasFor: 'span_id',
  },
  log_id: {
    type: 'string',
    category: 'trace',
    description: 'argus.search.field.logId',
  },
  'log.id': {
    type: 'string',
    category: 'trace',
    description: 'argus.search.field.logId',
    aliasFor: 'log_id',
  },
  issue_id: {
    type: 'number',
    category: 'trace',
    description: 'argus.search.field.issueId',
  },

  // Event fields (for Issues/Discover)
  type: {
    type: 'string',
    category: 'event',
    description: 'argus.search.field.type',
  },
  value: {
    type: 'string',
    category: 'event',
    description: 'argus.search.field.value',
  },
  transaction: {
    type: 'string',
    category: 'event',
    description: 'argus.search.field.transaction',
  },
  platform: {
    type: 'string',
    category: 'event',
    description: 'argus.search.field.platform',
  },
  status: {
    type: 'string',
    category: 'event',
    description: 'argus.search.field.status',
  },
  priority: {
    type: 'string',
    category: 'event',
    description: 'argus.search.field.priority',
  },
  assigned_to: {
    type: 'string',
    category: 'event',
    description: 'argus.search.field.assignedTo',
  },

  // User fields
  browser: {
    type: 'string',
    category: 'user',
    description: 'argus.search.field.browser',
  },
  os: {
    type: 'string',
    category: 'user',
    description: 'argus.search.field.os',
  },
  device: {
    type: 'string',
    category: 'user',
    description: 'argus.search.field.device',
  },
  url: {
    type: 'string',
    category: 'user',
    description: 'argus.search.field.url',
  },

  // Special
  age: { type: 'date', category: 'log', description: 'argus.search.field.age' },
};

// ─── Category Labels ─────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<FieldCategory, string> = {
  log: 'argus.search.category.log',
  resource: 'argus.search.category.resource',
  trace: 'argus.search.category.trace',
  event: 'argus.search.category.event',
  user: 'argus.search.category.user',
  custom: 'argus.search.category.custom',
};

// ─── Helper Functions ────────────────────────────────────────────────────

/**
 * Get the FieldDefinition for a field name.
 * Returns a default 'string' definition for unknown fields.
 */
export function getFieldDef(fieldName: string): FieldDefinition {
  return (
    FIELD_DEFINITIONS[fieldName] || {
      type: 'string' as FieldType,
      category: 'custom' as FieldCategory,
      description: fieldName,
    }
  );
}

/**
 * Get available operators for a given field name.
 */
export function getOperatorsForField(fieldName: string): Operator[] {
  const def = getFieldDef(fieldName);
  return OPERATORS_BY_TYPE[def.type];
}

/**
 * Build query syntax for a field + operator + value combination.
 *
 * Examples:
 *   buildQueryToken('level', 'is', 'error')       → 'level:"error"'
 *   buildQueryToken('level', 'is_not', 'error')    → '!level:"error"'
 *   buildQueryToken('message', 'contains', 'timeout') → 'message.contains:"timeout"'
 *   buildQueryToken('count()', '>', '100')          → 'count():>100'
 */
export function buildQueryToken(
  field: string,
  operatorValue: string,
  value: string
): string {
  const operators = getOperatorsForField(field);
  const op = operators.find((o) => o.value === operatorValue);

  if (!op) {
    // Fallback: raw comparison operators (>, <, >=, <=)
    if (['>', '<', '>=', '<='].includes(operatorValue)) {
      return `${field}:${operatorValue}${value}`;
    }
    return `${field}:"${value}"`;
  }

  const quotedVal =
    value.includes(' ') || value.length === 0 ? `"${value}"` : `"${value}"`;

  switch (op.queryFormat) {
    case 'colon':
      if (['>', '<', '>=', '<='].includes(op.value)) {
        return `${field}:${op.value}${value}`;
      }
      return `${field}:${quotedVal}`;
    case 'negated':
      return `!${field}:${quotedVal}`;
    case 'dot':
      return `${field}.${op.value}:${quotedVal}`;
    default:
      return `${field}:${quotedVal}`;
  }
}

// ─── Field Navigation (Hyperlink Targets) ───────────────────────────────

export interface FieldNavLink {
  /** i18n key for the tooltip displayed on hover */
  tooltip: string;
  /** Build navigation path from field value and project ID */
  buildPath: (value: string, projectId: string) => string;
}

/**
 * Maps field names to their navigation target pages.
 * Only fields that navigate to a **distinct page** should be listed here.
 * Fields that merely apply a filter (service, environment, logger_name)
 * are intentionally excluded — the existing filter buttons handle those.
 */
export const FIELD_NAVIGATIONS: Record<string, FieldNavLink> = {
  trace_id: {
    tooltip: 'argus.logs.nav.viewTrace',
    buildPath: (v) => `/argus/performance?trace=${v}`,
  },
  span_id: {
    tooltip: 'argus.logs.nav.viewSpan',
    buildPath: (v) =>
      `/argus/explore/traces?search=${encodeURIComponent(`span_id:${v}`)}`,
  },
  release: {
    tooltip: 'argus.logs.nav.viewRelease',
    buildPath: (v, pid) =>
      `/argus/releases/${pid}/${encodeURIComponent(v)}`,
  },
  issue_id: {
    tooltip: 'argus.logs.nav.viewIssue',
    buildPath: (v, pid) => `/argus/issues/${pid}/${v}`,
  },
};

/**
 * Get the navigation link path for a field value.
 * Returns null if the field has no navigation mapping or value is empty.
 */
export function getFieldLink(
  fieldName: string,
  value: string,
  projectId: string
): string | null {
  const nav = FIELD_NAVIGATIONS[fieldName];
  if (!nav || !value) return null;
  return nav.buildPath(value, projectId);
}

/**
 * Get the tooltip i18n key for a navigable field.
 * Returns null if the field has no navigation mapping.
 */
export function getFieldNavTooltip(fieldName: string): string | null {
  return FIELD_NAVIGATIONS[fieldName]?.tooltip ?? null;
}

/**
 * Relative time presets for date-type fields.
 */
export const RELATIVE_TIME_PRESETS = [
  { label: 'argus.search.time.5m', value: '5m' },
  { label: 'argus.search.time.15m', value: '15m' },
  { label: 'argus.search.time.30m', value: '30m' },
  { label: 'argus.search.time.1h', value: '1h' },
  { label: 'argus.search.time.4h', value: '4h' },
  { label: 'argus.search.time.24h', value: '24h' },
  { label: 'argus.search.time.3d', value: '3d' },
  { label: 'argus.search.time.7d', value: '7d' },
  { label: 'argus.search.time.14d', value: '14d' },
  { label: 'argus.search.time.30d', value: '30d' },
];
