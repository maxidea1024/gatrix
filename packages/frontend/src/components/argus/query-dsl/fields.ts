// ============================================================================
// Query DSL Engine — Field Registry & Domain Configs
// Spec: Section 5
// ============================================================================

import type { QueryField, DomainConfig } from './types';

// ─── Master Field Registry ───────────────────────────────────────────────────
// All available fields. Each domain uses a subset via DomainConfig.

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
    staticValues: ['debug', 'info', 'warning', 'error', 'fatal'],
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
    operators: ['=', '!=', 'before', 'after', 'between'],
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
  {
    key: 'status',
    label: 'dsl.field.status',
    type: 'string',
    category: 'event',
    operators: ['=', '!='],
    searchable: true,
    description: 'dsl.field.status.desc',
  },
  {
    key: 'assigned',
    label: 'dsl.field.assigned',
    type: 'string',
    category: 'event',
    operators: ['=', '!='],
    searchable: true,
    description: 'dsl.field.assigned.desc',
    staticValues: ['me', 'none', 'my_teams'],
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

  // ── Feedback fields ──
  {
    key: 'contact_email',
    label: 'dsl.field.contactEmail',
    type: 'string',
    category: 'user',
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
    description: 'dsl.field.contactEmail.desc',
  },
  {
    key: 'feedback',
    label: 'dsl.field.feedback',
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

// Invalidate cache on HMR so new fields are picked up during development
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    _fieldMapCache = null;
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Pick fields from ALL_QUERY_FIELDS by keys, with optional per-field overrides.
 * Overrides let domain configs customize staticValues per field.
 * Unknown keys are warned in development mode to catch typos early.
 */
export function pickFields(
  keys: string[],
  overrides?: Record<string, Partial<QueryField>>
): QueryField[] {
  const fieldMap = getFieldMap();
  const result: QueryField[] = [];

  for (const key of keys) {
    const base = fieldMap.get(key);
    if (!base) {
      if (import.meta.env.DEV) {
        console.warn(`[pickFields] Unknown field key: "${key}" — check ALL_QUERY_FIELDS`);
      }
      continue;
    }
    const override = overrides?.[key];
    result.push(override ? { ...base, ...override } : base);
  }

  return result;
}

// Shared alias table
const SHARED_ALIASES: Record<string, string> = {
  severity: 'level',
  logger: 'logger_name',
};

// ─── Domain Configs ──────────────────────────────────────────────────────────

export const LOGS_CONFIG: DomainConfig = {
  name: 'logs',
  fields: pickFields([
    'level', 'message', 'body', 'logger_name', 'timestamp',
    'service', 'environment', 'release',
    'trace_id', 'span_id', 'log_id', 'issue_id',
  ]),
  aliases: SHARED_ALIASES,
};

export const ISSUES_CONFIG: DomainConfig = {
  name: 'issues',
  fields: pickFields(
    [
      'type', 'value', 'message', 'handled', 'platform',
      'level', 'environment', 'release', 'service',
      'browser_name', 'os_name', 'device',
      'timestamp', 'trace_id', 'issue_id',
      'status', 'assigned',
    ],
    {
      status: {
        staticValues: [
          'resolved', 'unresolved', 'ignored',
          'archived', 'regressed', 'escalating',
        ],
      },
    }
  ),
  aliases: { severity: 'level' },
};

export const DISCOVER_CONFIG: DomainConfig = {
  name: 'discover',
  fields: pickFields(
    ALL_QUERY_FIELDS.map((f) => f.key),
    {
      status: {
        staticValues: [
          'resolved', 'unresolved', 'ignored',
          'archived', 'regressed', 'escalating',
        ],
      },
    }
  ),
  aliases: SHARED_ALIASES,
};

export const FEEDBACK_CONFIG: DomainConfig = {
  name: 'feedback',
  fields: pickFields(
    [
      'feedback', 'contact_email',
      'environment', 'release', 'service',
      'browser_name', 'os_name', 'device',
      'timestamp', 'status', 'assigned',
    ],
    {
      status: { staticValues: ['resolved', 'unresolved', 'spam'] },
    }
  ),
  freeTextField: 'feedback',
};

export const PERFORMANCE_CONFIG: DomainConfig = {
  name: 'performance',
  fields: pickFields(
    [
      'transaction', 'duration', 'status',
      'service', 'environment', 'release',
      'browser_name', 'os_name',
      'timestamp', 'trace_id', 'span_id',
    ],
    {
      status: {
        staticValues: ['ok', 'cancelled', 'unknown', 'invalid_argument'],
      },
    }
  ),
};

export const SESSIONS_CONFIG: DomainConfig = {
  name: 'sessions',
  fields: pickFields([
    'environment', 'release', 'service',
    'browser_name', 'os_name', 'device',
    'duration', 'timestamp',
  ]),
  aliases: SHARED_ALIASES,
};

// ─── Public API (DomainConfig-based) ─────────────────────────────────────────

/**
 * Get a single field by key from a DomainConfig, resolving aliases.
 */
export function getFieldByKey(
  key: string,
  config: DomainConfig
): QueryField | undefined {
  const resolved = resolveAlias(key, config);
  return config.fields.find((f) => f.key === resolved);
}

/**
 * Check if a field key exists in a DomainConfig (including aliases).
 */
export function isFieldInDomain(key: string, config: DomainConfig): boolean {
  return getFieldByKey(key, config) !== undefined;
}

/**
 * Resolve a field alias to its canonical key.
 */
export function resolveAlias(key: string, config: DomainConfig): string {
  return config.aliases?.[key] ?? key;
}
