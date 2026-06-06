// ─────────────────────────────────────────────────────────────────────────────
// Shared modules re-exported for @gatrix/argus-worker
//
// This file provides the public API surface of argus internals that the
// argus-worker package needs. Only modules used by both API and Worker
// are exported here.
// ─────────────────────────────────────────────────────────────────────────────

// ── Config ───────────────────────────────────────────────────────────────────
export { config } from './config';
export { default as db } from './config/knex';
/** @deprecated Use `db` (knex) instead. Will be removed after full migration. */
export { mysqlPool, testMySQLConnection } from './config/mysql';
export { redis } from './config/redis';
export {
  CHANNELS,
  CONFIG_TYPES,
  STREAMS,
  KNOWN_STREAMS,
  QUEUES,
  CONSUMER_GROUPS,
  CACHE,
  COUNTERS,
  BUFFERS,
} from './config/redis-keys';
export { pipelineConfig } from './config/pipeline-config';

// ── Utils ────────────────────────────────────────────────────────────────────
export { createLogger } from './utils/logger';
export { dsnStore } from './utils/dsn-store';
export { buildScheduleConfig, getNextSchedule } from './utils/cron-schedule';

// ── Types ────────────────────────────────────────────────────────────────────
export type {
  ArgusBaseEvent,
  ArgusEventType,
  ArgusErrorEvent,
  ArgusLevel,
  ArgusException,
  ArgusStacktrace,
  ArgusStackFrame,
  ArgusBreadcrumb,
  ArgusTransactionEvent,
  ArgusSpan,
  ArgusSessionEvent,
  ArgusFeedbackEvent,
  ArgusCheckinEvent,
  ArgusMetricEvent,
  ArgusUser,
  ArgusContexts,
  ArgusBatchPayload,
  ArgusEvent,
} from './types/events';
