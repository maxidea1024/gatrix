/**
 * Pipeline optimization tuning parameters.
 *
 * All magic numbers for concurrency, batch sizes, flush intervals, etc.
 * are centralized here. Each parameter can be overridden via environment
 * variable (ARGUS_ prefix).
 *
 * When tuning the pipeline, modify ONLY this file — all consumers
 * import from here.
 */

function int(envKey: string, defaultValue: number): number {
  const v = process.env[envKey];
  return v ? parseInt(v, 10) : defaultValue;
}

export const pipelineConfig = {
  // ── GroupMQ ──
  groupmq: {
    /** Number of project groups processed concurrently by the error worker */
    errorConcurrency: int('ARGUS_GROUPMQ_ERROR_CONCURRENCY', 100),

    /** Number of project groups processed concurrently by the transaction worker */
    txnConcurrency: int('ARGUS_GROUPMQ_TXN_CONCURRENCY', 100),
  },

  // ── ClickHouse Batch Buffer ──
  clickhouseBuffer: {
    /** Interval (ms) between periodic ClickHouse flushes */
    flushIntervalMs: int('ARGUS_CH_FLUSH_INTERVAL_MS', 1000),

    /** Max buffer size that triggers an immediate flush */
    maxBatchSize: int('ARGUS_CH_MAX_BATCH_SIZE', 500),
  },

  // ── Batch Flusher (Redis → MySQL periodic writes) ──
  batchFlush: {
    /** Interval (ms) for flushing times_seen + last_seen to MySQL */
    issueStatsIntervalMs: int('ARGUS_FLUSH_ISSUE_STATS_MS', 30_000),

    /** Interval (ms) for flushing alert history buffer to MySQL */
    alertHistoryIntervalMs: int('ARGUS_FLUSH_ALERT_HISTORY_MS', 10_000),

    /** Interval (ms) for cleaning up expired event counter entries */
    counterCleanupIntervalMs: int('ARGUS_FLUSH_COUNTER_CLEANUP_MS', 300_000),

    /** Max age (ms) for event counter entries before cleanup */
    counterMaxAgeMs: int('ARGUS_COUNTER_MAX_AGE_MS', 24 * 60 * 60 * 1000),
  },

  // ── Discover / Facet Cache Cron ──
  discoverCache: {
    /** Interval (ms) for the Cron job that refreshes discover tag caches */
    refreshIntervalMs: int('ARGUS_DISCOVER_REFRESH_MS', 300_000),

    /** Hours of inactivity before a project is considered inactive (skipped by Cron) */
    activeProjectHours: int('ARGUS_DISCOVER_ACTIVE_HOURS', 1),
  },

  // ── Worker Common ──
  worker: {
    /** Block time (ms) for Redis stream workers waiting for new messages */
    blockMs: int('ARGUS_WORKER_BLOCK_MS', 5000),

    /** COUNT parameter for Redis SCAN operations */
    scanCount: int('ARGUS_SCAN_COUNT', 100),
  },

  // ── Benchmarking Tool Defaults ──
  bench: {
    /** Default duration (seconds) for the stress scenario */
    defaultStressDurationSec: int('ARGUS_BENCH_STRESS_DURATION', 300),

    /** Default number of events for benchmark scenarios */
    defaultEventCount: int('ARGUS_BENCH_DEFAULT_EVENTS', 10_000),

    /** Default concurrency for benchmark scenarios */
    defaultConcurrency: int('ARGUS_BENCH_DEFAULT_CONCURRENCY', 100),
  },
} as const;
