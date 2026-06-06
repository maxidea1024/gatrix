/**
 * Centralized Redis key constants for the Argus pipeline.
 *
 * ALL Redis keys, Pub/Sub channels, stream names, queue namespaces,
 * cache keys, counters, and buffer keys MUST be defined here.
 *
 * Rules:
 * 1. Never use inline Redis key strings in application code.
 *    Always import from this module.
 * 2. NEVER use the Redis KEYS command. It is O(N) and blocks the
 *    entire Redis instance. Use KNOWN_STREAMS sets with SMEMBERS
 *    or SSCAN instead.
 */

// ── Pub/Sub Channels ──

export const CHANNELS = {
  /** Single channel for all config change notifications */
  CONFIG_CHANGED: 'argus:config-changed',
} as const;

// ── Config Change Types (Pub/Sub payload.type values) ──

export const CONFIG_TYPES = {
  ALERT_RULES: 'alert_rules',
  DSN_KEYS: 'dsn_keys',
  ISSUE_STATUS: 'issue_status',
  PROJECT_SETTINGS: 'project_settings',
} as const;

// ── Redis Streams ──

export const STREAMS = {
  ERRORS: 'argus:errors',
  TRANSACTIONS: 'argus:txns',
  SESSIONS: 'argus:sessions',
  FEEDBACK: 'argus:feedback',
  METRICS: 'argus:metrics',
  LOGS: 'argus:logs',

  /** Build a per-project stream key: e.g. "argus:errors:proj_abc123" */
  streamKey: (base: string, projectId: string) => `${base}:${projectId}`,
} as const;

// ── Known Stream Sets (replaces KEYS command with O(1) SMEMBERS) ──

export const KNOWN_STREAMS = {
  ERRORS: 'argus:known-streams:errors',
  TRANSACTIONS: 'argus:known-streams:txns',
  SESSIONS: 'argus:known-streams:sessions',
  FEEDBACK: 'argus:known-streams:feedback',
  METRICS: 'argus:known-streams:metrics',
  LOGS: 'argus:known-streams:logs',
} as const;

// ── GroupMQ Queue Namespaces ──

export const QUEUES = {
  ERROR_PROCESSING: 'argus:q:errors',
  TRANSACTION_PROCESSING: 'argus:q:txns',
} as const;

// ── Consumer Groups ──

export const CONSUMER_GROUPS = {
  ERRORS: 'argus-error-workers',
  TRANSACTIONS: 'argus-txn-workers',
  SESSIONS: 'argus-session-workers',
  FEEDBACK: 'argus-feedback-workers',
  METRICS: 'argus-metric-workers',
  LOGS: 'argus-log-workers',
} as const;

// ── Cache Keys ──

export const CACHE = {
  /** Cached discover tag values per project */
  DISCOVER_TAGS: (projectId: string) =>
    `argus:cache:discover-tags:${projectId}`,

  /** Cached log facets per project and time period */
  LOG_FACETS: (projectId: string, period: string) =>
    `argus:cache:log-facets:${projectId}:${period}`,
} as const;

// ── Counters & Aggregations ──

export const COUNTERS = {
  /** Sorted Set for sliding window event count (score=timestamp, member=eventId) */
  EVENT_COUNT: (projectId: string, issueId: number) =>
    `argus:evt-count:${projectId}:${issueId}`,

  /** HyperLogLog for unique user count per issue */
  USER_COUNT: (projectId: string, issueId: number) =>
    `argus:usr-hll:${projectId}:${issueId}`,

  /** Simple counter for project-level event rate */
  PROJECT_EVENT_COUNT: (projectId: string) => `argus:proj-evt:${projectId}`,

  /** Hash: field="issue:{id}", value=pending increment (flushed periodically to MySQL) */
  ISSUE_TIMES_SEEN: 'argus:issue-times-seen',

  /** Hash: atomic short_id counter per project */
  ISSUE_SHORT_ID: (projectId: string) => `argus:issue-counter:${projectId}`,
} as const;

// ── Batch Flush Buffers ──

export const BUFFERS = {
  /** List: buffered alert history records awaiting batch INSERT */
  ALERT_HISTORY: 'argus:buf:alert-history',

  /** Hash: field="issue:{id}", value=last seen timestamp (ms) */
  ISSUE_LAST_SEEN: 'argus:buf:issue-last-seen',
} as const;
