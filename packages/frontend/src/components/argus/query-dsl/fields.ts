// ============================================================================
// Query DSL Engine — Field Registry & Page-Specific Presets
// Spec: Section 5
// ============================================================================

import type { QueryField, QueryDomain, QueryFieldPreset } from './types';

// ─── Master Field Registry ───────────────────────────────────────────────────
// All available fields. Each page uses a subset via presets (Section 5.4).

export const ALL_QUERY_FIELDS: QueryField[] = [
  // ── Log fields ──
  {
    key: 'level',
    label: 'dsl.field.level',
    type: 'string',
    category: 'log',
    operators: ['=', '!='],
    searchable: true,
    description: 'dsl.field.level.desc',
  },
  {
    key: 'message',
    label: 'dsl.field.message',
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
    description: 'dsl.field.message.desc',
  },
  {
    key: 'body',
    label: 'dsl.field.body',
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
    description: 'dsl.field.body.desc',
  },
  {
    key: 'logger_name',
    label: 'dsl.field.loggerName',
    type: 'string',
    category: 'log',
    operators: ['=', '!='],
    searchable: true,
    description: 'dsl.field.loggerName.desc',
  },
  {
    key: 'timestamp',
    label: 'dsl.field.timestamp',
    type: 'datetime',
    category: 'log',
    operators: ['=', '!=', 'before', 'after'],
    searchable: false,
    description: 'dsl.field.timestamp.desc',
  },

  // ── Resource fields ──
  {
    key: 'service',
    label: 'dsl.field.service',
    type: 'string',
    category: 'resource',
    operators: ['=', '!='],
    searchable: true,
    description: 'dsl.field.service.desc',
  },
  {
    key: 'environment',
    label: 'dsl.field.environment',
    type: 'string',
    category: 'resource',
    operators: ['=', '!='],
    searchable: true,
    description: 'dsl.field.environment.desc',
  },
  {
    key: 'release',
    label: 'dsl.field.release',
    type: 'string',
    category: 'resource',
    operators: ['=', '!='],
    searchable: true,
    description: 'dsl.field.release.desc',
  },

  // ── Trace fields ──
  {
    key: 'trace_id',
    label: 'dsl.field.traceId',
    type: 'string',
    category: 'trace',
    operators: ['=', '!='],
    searchable: true,
    description: 'dsl.field.traceId.desc',
  },
  {
    key: 'span_id',
    label: 'dsl.field.spanId',
    type: 'string',
    category: 'trace',
    operators: ['=', '!='],
    searchable: true,
    description: 'dsl.field.spanId.desc',
  },
  {
    key: 'log_id',
    label: 'dsl.field.logId',
    type: 'string',
    category: 'trace',
    operators: ['=', '!='],
    searchable: true,
    description: 'dsl.field.logId.desc',
  },
  {
    key: 'issue_id',
    label: 'dsl.field.issueId',
    type: 'number',
    category: 'trace',
    operators: ['=', '!=', '>', '>=', '<', '<='],
    searchable: true,
    description: 'dsl.field.issueId.desc',
  },

  // ── Event/Issue fields ──
  {
    key: 'type',
    label: 'dsl.field.type',
    type: 'string',
    category: 'event',
    operators: ['=', '!='],
    searchable: true,
    description: 'dsl.field.type.desc',
  },
  {
    key: 'value',
    label: 'dsl.field.value',
    type: 'string',
    category: 'event',
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
    description: 'dsl.field.value.desc',
  },
  {
    key: 'handled',
    label: 'dsl.field.handled',
    type: 'boolean',
    category: 'event',
    operators: ['=', '!='],
    searchable: false,
    description: 'dsl.field.handled.desc',
  },
  {
    key: 'platform',
    label: 'dsl.field.platform',
    type: 'string',
    category: 'event',
    operators: ['=', '!='],
    searchable: true,
    description: 'dsl.field.platform.desc',
  },

  // ── User fields ──
  {
    key: 'browser_name',
    label: 'dsl.field.browserName',
    type: 'string',
    category: 'user',
    operators: ['=', '!='],
    searchable: true,
    description: 'dsl.field.browserName.desc',
  },
  {
    key: 'os_name',
    label: 'dsl.field.osName',
    type: 'string',
    category: 'user',
    operators: ['=', '!='],
    searchable: true,
    description: 'dsl.field.osName.desc',
  },
  {
    key: 'device',
    label: 'dsl.field.device',
    type: 'string',
    category: 'user',
    operators: ['=', '!='],
    searchable: true,
    description: 'dsl.field.device.desc',
  },

  // ── Performance fields ──
  {
    key: 'transaction',
    label: 'dsl.field.transaction',
    type: 'string',
    category: 'event',
    operators: ['=', '!=', 'contains'],
    searchable: true,
    description: 'dsl.field.transaction.desc',
  },
  {
    key: 'duration',
    label: 'dsl.field.duration',
    type: 'number',
    category: 'event',
    operators: ['=', '!=', '>', '>=', '<', '<='],
    searchable: false,
    description: 'dsl.field.duration.desc',
  },
  {
    key: 'status',
    label: 'dsl.field.status',
    type: 'string',
    category: 'event',
    operators: ['=', '!='],
    searchable: true,
    description: 'dsl.field.status.desc',
  },

  // ── Feedback fields ──
  {
    key: 'contact_email',
    label: 'dsl.field.contactEmail',
    type: 'string',
    category: 'user',
    operators: ['=', '!=', 'contains'],
    searchable: true,
    description: 'dsl.field.contactEmail.desc',
  },
  {
    key: 'feedback',
    label: 'dsl.field.feedback',
    type: 'string',
    category: 'event',
    operators: ['=', '!=', 'contains'],
    searchable: true,
    description: 'dsl.field.feedback.desc',
  },
];

// ─── Field lookup cache (built lazily) ───────────────────────────────────────

let _fieldMapCache: Map<string, QueryField> | null = null;

function getFieldMap(): Map<string, QueryField> {
  if (!_fieldMapCache) {
    _fieldMapCache = new Map(ALL_QUERY_FIELDS.map((f) => [f.key, f]));
  }
  return _fieldMapCache;
}

// ─── Page-Specific Field Presets ─────────────────────────────────────────────

export const FIELD_PRESETS: Record<QueryDomain, QueryFieldPreset> = {
  logs: {
    domain: 'logs',
    fields: [
      'level',
      'message',
      'body',
      'logger_name',
      'timestamp',
      'service',
      'environment',
      'release',
      'trace_id',
      'span_id',
      'log_id',
      'issue_id',
    ],
    aliases: { severity: 'level', logger: 'logger_name' },
    facetsEndpoint: '/logs/facets',
  },

  issues: {
    domain: 'issues',
    fields: [
      'type',
      'value',
      'message',
      'handled',
      'platform',
      'level',
      'environment',
      'release',
      'service',
      'browser_name',
      'os_name',
      'device',
      'timestamp',
      'trace_id',
      'issue_id',
    ],
    aliases: { severity: 'level' },
    facetsEndpoint: '/issues/facets',
  },

  performance: {
    domain: 'performance',
    fields: [
      'transaction',
      'duration',
      'status',
      'service',
      'environment',
      'release',
      'browser_name',
      'os_name',
      'timestamp',
      'trace_id',
      'span_id',
    ],
    aliases: {},
    facetsEndpoint: '/performance/facets',
  },

  discover: {
    domain: 'discover',
    fields: ALL_QUERY_FIELDS.map((f) => f.key),
    aliases: { severity: 'level', logger: 'logger_name' },
    facetsEndpoint: '/discover/facets',
  },

  feedback: {
    domain: 'feedback',
    fields: [
      'feedback',
      'contact_email',
      'environment',
      'release',
      'service',
      'browser_name',
      'os_name',
      'device',
      'timestamp',
    ],
    aliases: {},
    facetsEndpoint: '/feedback/facets',
  },

  sessions: {
    domain: 'sessions',
    fields: [
      'environment',
      'release',
      'service',
      'browser_name',
      'os_name',
      'device',
      'duration',
      'timestamp',
    ],
    aliases: {},
    facetsEndpoint: '/sessions/facets',
  },
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get QueryField objects for a specific domain.
 * Only returns fields included in the domain's preset.
 */
export function getFieldsForDomain(domain: QueryDomain): QueryField[] {
  const preset = FIELD_PRESETS[domain];
  const fieldMap = getFieldMap();
  const result: QueryField[] = [];

  for (const key of preset.fields) {
    const field = fieldMap.get(key);
    if (field) {
      result.push(field);
    }
  }

  return result;
}

/**
 * Get a single field by key, resolving aliases if necessary.
 * Returns undefined if the field is not in the domain's preset.
 */
export function getFieldByKey(
  key: string,
  domain: QueryDomain
): QueryField | undefined {
  const resolved = resolveAlias(key, domain);
  const preset = FIELD_PRESETS[domain];

  if (!preset.fields.includes(resolved)) {
    return undefined;
  }

  return getFieldMap().get(resolved);
}

/**
 * Check if a field key exists in a domain's preset (including aliases).
 */
export function isFieldInDomain(key: string, domain: QueryDomain): boolean {
  return getFieldByKey(key, domain) !== undefined;
}

/**
 * Resolve a field alias to its canonical key.
 * Returns the original key if no alias exists.
 */
export function resolveAlias(key: string, domain: QueryDomain): string {
  const preset = FIELD_PRESETS[domain];
  return preset.aliases[key] ?? key;
}

/**
 * Get all aliases for a domain.
 */
export function getAliases(domain: QueryDomain): Record<string, string> {
  return FIELD_PRESETS[domain].aliases;
}

/**
 * Get the facets endpoint for a domain.
 */
export function getFacetsEndpoint(domain: QueryDomain): string | undefined {
  return FIELD_PRESETS[domain].facetsEndpoint;
}
