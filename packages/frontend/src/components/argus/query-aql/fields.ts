// ============================================================================
// AQL (Argus Query Language) Engine — Field Registry & Domain Configs
// Spec: Section 5
// ============================================================================

import type { QueryField, DomainConfig, AggregateFunctionDef } from './types';

// ─── Master Field Registry ───────────────────────────────────────────────────
// All available fields. Each domain uses a subset via DomainConfig.

export const ALL_QUERY_FIELDS: QueryField[] = [
  // ── Log fields ──
  {
    key: 'level',
    label: 'aql.field.level',
    type: 'string',
    category: 'log',
    operators: ['=', '!='],
    searchable: true,
    description: 'aql.field.level.desc',
    staticValues: ['debug', 'info', 'warning', 'error', 'fatal'],
  },
  {
    key: 'message',
    label: 'aql.field.message',
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
    description: 'aql.field.message.desc',
  },
  {
    key: 'body',
    label: 'aql.field.body',
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
    description: 'aql.field.body.desc',
  },
  {
    key: 'logger_name',
    label: 'aql.field.loggerName',
    type: 'string',
    category: 'log',
    operators: ['=', '!='],
    searchable: true,
    description: 'aql.field.loggerName.desc',
  },
  {
    key: 'timestamp',
    label: 'aql.field.timestamp',
    type: 'datetime',
    category: 'log',
    operators: ['=', '!=', 'before', 'after', 'between'],
    searchable: false,
    description: 'aql.field.timestamp.desc',
  },

  // ── Resource fields ──
  {
    key: 'service',
    label: 'aql.field.service',
    type: 'string',
    category: 'resource',
    operators: ['=', '!='],
    searchable: true,
    description: 'aql.field.service.desc',
  },
  {
    key: 'environment',
    label: 'aql.field.environment',
    type: 'string',
    category: 'resource',
    operators: ['=', '!='],
    searchable: true,
    description: 'aql.field.environment.desc',
  },
  {
    key: 'release',
    label: 'aql.field.release',
    type: 'string',
    category: 'resource',
    operators: ['=', '!='],
    searchable: true,
    description: 'aql.field.release.desc',
  },

  // ── Trace fields ──
  {
    key: 'trace_id',
    label: 'aql.field.traceId',
    type: 'string',
    category: 'trace',
    operators: ['=', '!='],
    searchable: true,
    description: 'aql.field.traceId.desc',
  },
  {
    key: 'span_id',
    label: 'aql.field.spanId',
    type: 'string',
    category: 'trace',
    operators: ['=', '!='],
    searchable: true,
    description: 'aql.field.spanId.desc',
  },
  {
    key: 'log_id',
    label: 'aql.field.logId',
    type: 'string',
    category: 'trace',
    operators: ['=', '!='],
    searchable: true,
    description: 'aql.field.logId.desc',
  },
  {
    key: 'issue_id',
    label: 'aql.field.issueId',
    type: 'number',
    category: 'trace',
    operators: ['=', '!=', '>', '>=', '<', '<='],
    searchable: true,
    description: 'aql.field.issueId.desc',
  },

  // ── Event/Issue fields ──
  {
    key: 'type',
    label: 'aql.field.type',
    type: 'string',
    category: 'event',
    operators: ['=', '!='],
    searchable: true,
    description: 'aql.field.type.desc',
  },
  {
    key: 'value',
    label: 'aql.field.value',
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
    description: 'aql.field.value.desc',
  },
  {
    key: 'handled',
    label: 'aql.field.handled',
    type: 'boolean',
    category: 'event',
    operators: ['=', '!='],
    searchable: false,
    description: 'aql.field.handled.desc',
  },
  {
    key: 'platform',
    label: 'aql.field.platform',
    type: 'string',
    category: 'event',
    operators: ['=', '!='],
    searchable: true,
    description: 'aql.field.platform.desc',
  },
  {
    key: 'status',
    label: 'aql.field.status',
    type: 'string',
    category: 'event',
    operators: ['=', '!='],
    searchable: true,
    description: 'aql.field.status.desc',
  },
  {
    key: 'assigned',
    label: 'aql.field.assigned',
    type: 'string',
    category: 'event',
    operators: ['=', '!='],
    searchable: true,
    description: 'aql.field.assigned.desc',
    staticValues: ['me', 'none', 'my_teams'],
  },

  // ── User fields ──
  {
    key: 'browser_name',
    label: 'aql.field.browserName',
    type: 'string',
    category: 'user',
    operators: ['=', '!='],
    searchable: true,
    description: 'aql.field.browserName.desc',
  },
  {
    key: 'os_name',
    label: 'aql.field.osName',
    type: 'string',
    category: 'user',
    operators: ['=', '!='],
    searchable: true,
    description: 'aql.field.osName.desc',
  },
  {
    key: 'device',
    label: 'aql.field.device',
    type: 'string',
    category: 'user',
    operators: ['=', '!='],
    searchable: true,
    description: 'aql.field.device.desc',
  },

  // ── Performance fields ──
  {
    key: 'transaction',
    label: 'aql.field.transaction',
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
    description: 'aql.field.transaction.desc',
  },
  {
    key: 'duration',
    label: 'aql.field.duration',
    type: 'number',
    category: 'event',
    operators: ['=', '!=', '>', '>=', '<', '<='],
    searchable: false,
    description: 'aql.field.duration.desc',
  },

  // ── Feedback fields ──
  {
    key: 'contact_email',
    label: 'aql.field.contactEmail',
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
    description: 'aql.field.contactEmail.desc',
  },
  {
    key: 'feedback',
    label: 'aql.field.feedback',
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
    description: 'aql.field.feedback.desc',
  },
  // ── Releases fields ──
  {
    key: 'crash_free',
    label: 'aql.field.crashFree',
    type: 'number',
    category: 'custom',
    operators: ['=', '!=', '>', '>=', '<', '<='],
    searchable: true,
    description: 'aql.field.crashFree.desc',
  },
  {
    key: 'sessions',
    label: 'aql.field.sessions',
    type: 'number',
    category: 'custom',
    operators: ['=', '!=', '>', '>=', '<', '<='],
    searchable: true,
    description: 'aql.field.sessions.desc',
  },
  {
    key: 'errors',
    label: 'aql.field.errors',
    type: 'number',
    category: 'custom',
    operators: ['=', '!=', '>', '>=', '<', '<='],
    searchable: true,
    description: 'aql.field.errors.desc',
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
        console.warn(
          `[pickFields] Unknown field key: "${key}" — check ALL_QUERY_FIELDS`
        );
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
  // Dot-notation aliases for underscore fields
  'trace.id': 'trace_id',
  'span.id': 'span_id',
  'log.id': 'log_id',
  'issue.id': 'issue_id',
  'logger.name': 'logger_name',
  'browser.name': 'browser_name',
  'os.name': 'os_name',
  'contact.email': 'contact_email',
  'crash.free': 'crash_free',
  traceid: 'trace_id',
  spanid: 'span_id',
  logid: 'log_id',
  issueid: 'issue_id',
};
// ─── Aggregate Operator Mapping ──────────────────────────────────────────────

/**
 * Valid comparison operators per aggregate returnType.
 * Numeric types (number, percentage, duration) support ordering operators.
 * String type only supports equality/containment.
 */
const AGGREGATE_OPERATORS_BY_RETURN_TYPE: Record<
  AggregateFunctionDef['returnType'],
  string[]
> = {
  number: ['=', '!=', '>', '>=', '<', '<='],
  percentage: ['=', '!=', '>', '>=', '<', '<='],
  duration: ['=', '!=', '>', '>=', '<', '<='],
  string: ['=', '!=', 'contains', '!contains'],
};

/**
 * Get the aggregate function definition by name from a DomainConfig.
 */
export function getAggregateDef(
  funcName: string,
  config: DomainConfig
): AggregateFunctionDef | undefined {
  return config.aggregates?.find((a) => a.name === funcName);
}

/**
 * Get valid operators for an aggregate function based on its returnType.
 * Falls back to numeric operators if the function is not found.
 */
export function getAggregateOperators(
  funcName: string,
  config: DomainConfig
): string[] {
  const def = getAggregateDef(funcName, config);
  const returnType = def?.returnType ?? 'number';
  return AGGREGATE_OPERATORS_BY_RETURN_TYPE[returnType];
}

/**
 * Map aggregate returnType → QueryField type for operator display.
 */
export function getAggregateFieldType(
  funcName: string,
  config: DomainConfig
): 'number' | 'string' {
  const def = getAggregateDef(funcName, config);
  return def?.returnType === 'string' ? 'string' : 'number';
}

// ─── Aggregate Function Definitions ─────────────────────────────────────────────

const AGG_COUNT: AggregateFunctionDef = {
  name: 'count',
  label: 'aql.aggregate.count',
  description: 'aql.aggregate.count.desc',
  args: [],
  returnType: 'number',
};

const AGG_AVG: AggregateFunctionDef = {
  name: 'avg',
  label: 'aql.aggregate.avg',
  description: 'aql.aggregate.avg.desc',
  args: [{ name: 'field', type: 'field', required: true }],
  returnType: 'number',
};

const AGG_SUM: AggregateFunctionDef = {
  name: 'sum',
  label: 'aql.aggregate.sum',
  description: 'aql.aggregate.sum.desc',
  args: [{ name: 'field', type: 'field', required: true }],
  returnType: 'number',
};

const AGG_MIN: AggregateFunctionDef = {
  name: 'min',
  label: 'aql.aggregate.min',
  description: 'aql.aggregate.min.desc',
  args: [{ name: 'field', type: 'field', required: true }],
  returnType: 'number',
};

const AGG_MAX: AggregateFunctionDef = {
  name: 'max',
  label: 'aql.aggregate.max',
  description: 'aql.aggregate.max.desc',
  args: [{ name: 'field', type: 'field', required: true }],
  returnType: 'number',
};

const AGG_UNIQ: AggregateFunctionDef = {
  name: 'uniq',
  label: 'aql.aggregate.uniq',
  description: 'aql.aggregate.uniq.desc',
  args: [{ name: 'field', type: 'field', required: true }],
  returnType: 'number',
};

const AGG_P50: AggregateFunctionDef = {
  name: 'p50',
  label: 'aql.aggregate.p50',
  description: 'aql.aggregate.p50.desc',
  args: [{ name: 'field', type: 'field', required: true }],
  returnType: 'duration',
};

const AGG_P75: AggregateFunctionDef = {
  name: 'p75',
  label: 'aql.aggregate.p75',
  description: 'aql.aggregate.p75.desc',
  args: [{ name: 'field', type: 'field', required: true }],
  returnType: 'duration',
};

const AGG_P95: AggregateFunctionDef = {
  name: 'p95',
  label: 'aql.aggregate.p95',
  description: 'aql.aggregate.p95.desc',
  args: [{ name: 'field', type: 'field', required: true }],
  returnType: 'duration',
};

const AGG_P99: AggregateFunctionDef = {
  name: 'p99',
  label: 'aql.aggregate.p99',
  description: 'aql.aggregate.p99.desc',
  args: [{ name: 'field', type: 'field', required: true }],
  returnType: 'duration',
};

const AGG_FAILURE_RATE: AggregateFunctionDef = {
  name: 'failure_rate',
  label: 'aql.aggregate.failureRate',
  description: 'aql.aggregate.failureRate.desc',
  args: [],
  returnType: 'percentage',
};

const AGG_APDEX: AggregateFunctionDef = {
  name: 'apdex',
  label: 'aql.aggregate.apdex',
  description: 'aql.aggregate.apdex.desc',
  args: [{ name: 'threshold', type: 'number', required: true }],
  returnType: 'number',
};

const AGG_TPM: AggregateFunctionDef = {
  name: 'tpm',
  label: 'aql.aggregate.tpm',
  description: 'aql.aggregate.tpm.desc',
  args: [],
  returnType: 'number',
};

const AGG_CRASH_FREE_RATE: AggregateFunctionDef = {
  name: 'crash_free_rate',
  label: 'aql.aggregate.crashFreeRate',
  description: 'aql.aggregate.crashFreeRate.desc',
  args: [],
  returnType: 'percentage',
};

// ─── Domain Configs ──────────────────────────────────────────────────────────

export const LOGS_CONFIG: DomainConfig = {
  name: 'logs',
  fields: pickFields([
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
  ]),
  aliases: SHARED_ALIASES,
  aggregates: [
    AGG_COUNT,
    AGG_AVG,
    AGG_SUM,
    AGG_MIN,
    AGG_MAX,
    AGG_UNIQ,
    AGG_P50,
    AGG_P75,
    AGG_P95,
    AGG_P99,
  ],
};

export const ISSUES_CONFIG: DomainConfig = {
  name: 'issues',
  fields: pickFields(
    [
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
      'status',
      'assigned',
    ],
    {
      status: {
        staticValues: [
          'resolved',
          'unresolved',
          'ignored',
          'archived',
          'regressed',
          'escalating',
        ],
      },
    }
  ),
  aliases: { severity: 'level' },
  aggregates: [AGG_COUNT, AGG_UNIQ, AGG_AVG, AGG_MIN, AGG_MAX],
};

export const DISCOVER_CONFIG: DomainConfig = {
  name: 'discover',
  fields: pickFields(
    ALL_QUERY_FIELDS.map((f) => f.key),
    {
      status: {
        staticValues: [
          'resolved',
          'unresolved',
          'ignored',
          'archived',
          'regressed',
          'escalating',
        ],
      },
    }
  ),
  aliases: SHARED_ALIASES,
  aggregates: [
    AGG_COUNT,
    AGG_AVG,
    AGG_SUM,
    AGG_MIN,
    AGG_MAX,
    AGG_UNIQ,
    AGG_P50,
    AGG_P75,
    AGG_P95,
    AGG_P99,
    AGG_FAILURE_RATE,
    AGG_APDEX,
    AGG_TPM,
  ],
};

export const FEEDBACK_CONFIG: DomainConfig = {
  name: 'feedback',
  fields: pickFields(
    [
      'feedback',
      'contact_email',
      'environment',
      'release',
      'service',
      'browser_name',
      'os_name',
      'device',
      'timestamp',
      'status',
      'assigned',
    ],
    {
      status: { staticValues: ['resolved', 'unresolved', 'spam'] },
    }
  ),
  freeTextField: 'feedback',
  aggregates: [AGG_COUNT, AGG_UNIQ, AGG_AVG],
};

export const PERFORMANCE_CONFIG: DomainConfig = {
  name: 'performance',
  fields: pickFields(
    [
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
    {
      status: {
        staticValues: ['ok', 'cancelled', 'unknown', 'invalid_argument'],
      },
    }
  ),
  aggregates: [
    AGG_COUNT,
    AGG_AVG,
    AGG_P50,
    AGG_P75,
    AGG_P95,
    AGG_P99,
    AGG_FAILURE_RATE,
    AGG_APDEX,
    AGG_TPM,
  ],
};

export const SESSIONS_CONFIG: DomainConfig = {
  name: 'sessions',
  fields: pickFields([
    'environment',
    'release',
    'service',
    'browser_name',
    'os_name',
    'device',
    'duration',
    'timestamp',
  ]),
  aliases: SHARED_ALIASES,
  aggregates: [AGG_COUNT, AGG_UNIQ, AGG_AVG, AGG_CRASH_FREE_RATE],
};

export const RELEASES_CONFIG: DomainConfig = {
  name: 'releases',
  fields: pickFields(
    ['release', 'environment', 'status', 'crash_free', 'sessions', 'errors'],
    {
      status: {
        staticValues: ['adopted', 'low'],
      },
    }
  ),
  aliases: SHARED_ALIASES,
  aggregates: [AGG_COUNT, AGG_UNIQ],
};

export const TRACES_CONFIG: DomainConfig = {
  name: 'traces',
  fields: pickFields(
    [
      'trace_id',
      'span_id',
      'transaction',
      'duration',
      'status',
      'service',
      'environment',
      'release',
      'timestamp',
      'level',
      'message',
    ],
    {
      status: {
        staticValues: [
          'ok',
          'cancelled',
          'unknown',
          'invalid_argument',
          'deadline_exceeded',
          'internal',
        ],
      },
    }
  ),
  aliases: SHARED_ALIASES,
  aggregates: [
    AGG_COUNT,
    AGG_AVG,
    AGG_P50,
    AGG_P75,
    AGG_P95,
    AGG_P99,
    AGG_UNIQ,
  ],
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
  // First try domain-specific fields (may have overrides like staticValues)
  const domainField = config.fields.find((f) => f.key === resolved);
  if (domainField) return domainField;
  // Fallback to global field registry so free-typed fields still get
  // correct operators, type, etc. even if not in this domain's config
  return getFieldMap().get(resolved);
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
  const lowerKey = key.toLowerCase();
  if (config.aliases) {
    for (const [alias, canonical] of Object.entries(config.aliases)) {
      if (alias.toLowerCase() === lowerKey) {
        return canonical;
      }
    }
  }
  return key;
}
