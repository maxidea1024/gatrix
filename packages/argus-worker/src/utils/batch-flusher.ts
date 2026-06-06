import { redis, mysqlPool, COUNTERS, BUFFERS, pipelineConfig, createLogger } from '@gatrix/argus';

const logger = createLogger('batch-flusher');

/**
 * Lua script for atomic LRANGE + LTRIM.
 * Returns the first N elements and trims them from the list in one step,
 * preventing data loss from concurrent RPUSH between LRANGE and LTRIM.
 */
const ATOMIC_DRAIN_SCRIPT = `
  local key = KEYS[1]
  local count = redis.call('llen', key)
  if count == 0 then return {} end
  local items = redis.call('lrange', key, 0, count - 1)
  redis.call('ltrim', key, count, -1)
  return items
`;

/**
 * Periodic batch flusher: Redis buffers → MySQL.
 *
 * Moves high-frequency writes off the hot path into periodic bulk operations:
 * 1. times_seen: HINCRBY accumulates in Redis → periodic batch UPDATE to MySQL
 * 2. last_seen: HSET accumulates in Redis → periodic batch UPDATE to MySQL
 * 3. alert_history: RPUSH accumulates in Redis → periodic batch INSERT to MySQL
 *
 * This dramatically reduces MySQL write pressure under high event volumes.
 */
export class BatchFlusher {
  private issueStatsTimer: ReturnType<typeof setInterval> | null = null;
  private alertHistoryTimer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    const { issueStatsIntervalMs, alertHistoryIntervalMs } = pipelineConfig.batchFlush;

    this.issueStatsTimer = setInterval(
      () => this.flushIssueStats(),
      issueStatsIntervalMs
    );

    this.alertHistoryTimer = setInterval(
      () => this.flushAlertHistory(),
      alertHistoryIntervalMs
    );

    logger.info('BatchFlusher started', {
      issueStatsIntervalMs,
      alertHistoryIntervalMs,
    });
  }

  /**
   * Graceful shutdown: stop timers, flush remaining data.
   */
  async close(): Promise<void> {
    if (this.issueStatsTimer) clearInterval(this.issueStatsTimer);
    if (this.alertHistoryTimer) clearInterval(this.alertHistoryTimer);

    // Final flush before shutdown
    await this.flushIssueStats();
    await this.flushAlertHistory();

    logger.info('BatchFlusher stopped (final flush complete)');
  }

  /**
   * Flush accumulated times_seen increments and last_seen timestamps to MySQL.
   *
   * Strategy:
   * 1. HGETALL to snapshot current values
   * 2. MySQL batch UPDATE
   * 3. Only on SUCCESS → HINCRBY(-N) to deduct the flushed amount
   *    If MySQL fails, the values remain in Redis and will be retried next cycle.
   */
  private async flushIssueStats(): Promise<void> {
    try {
      // Snapshot current buffer values
      const [timesSeenEntries, lastSeenEntries] = await Promise.all([
        redis.hgetall(COUNTERS.ISSUE_TIMES_SEEN),
        redis.hgetall(BUFFERS.ISSUE_LAST_SEEN),
      ]);

      const timesSeenKeys = Object.keys(timesSeenEntries);
      const lastSeenKeys = Object.keys(lastSeenEntries);

      if (timesSeenKeys.length === 0 && lastSeenKeys.length === 0) return;

      // Parse and validate entries
      const validTimesSeen: { issueId: number; increment: number; key: string }[] = [];
      for (const key of timesSeenKeys) {
        const issueId = parseInt(key.replace('issue:', ''), 10);
        const increment = parseInt(timesSeenEntries[key], 10);
        if (!isNaN(issueId) && increment > 0) {
          validTimesSeen.push({ issueId, increment, key });
        }
      }

      const validLastSeen: { issueId: number; dateStr: string; key: string }[] = [];
      for (const key of lastSeenKeys) {
        const issueId = parseInt(key.replace('issue:', ''), 10);
        const timestampMs = parseInt(lastSeenEntries[key], 10);
        if (!isNaN(issueId) && timestampMs > 0) {
          const dateStr = new Date(timestampMs).toISOString().slice(0, 19).replace('T', ' ');
          validLastSeen.push({ issueId, dateStr, key });
        }
      }

      if (validTimesSeen.length === 0 && validLastSeen.length === 0) return;

      // MySQL batch UPDATE using parameterized queries to prevent SQL injection
      const connection = await mysqlPool.getConnection();
      try {
        // Batch update times_seen using single CASE WHEN query
        if (validTimesSeen.length > 0) {
          const caseWhen = validTimesSeen.map(() => 'WHEN id = ? THEN times_seen + ?').join(' ');
          const ids = validTimesSeen.map(v => v.issueId);
          const idPlaceholders = ids.map(() => '?').join(',');
          await connection.query(
            `UPDATE g_argus_issues SET times_seen = CASE ${caseWhen} ELSE times_seen END WHERE id IN (${idPlaceholders})`,
            [...validTimesSeen.flatMap(v => [v.issueId, v.increment]), ...ids]
          );
        }

        // Batch update last_seen using single CASE WHEN query
        if (validLastSeen.length > 0) {
          const caseWhen = validLastSeen.map(() => 'WHEN id = ? THEN ?').join(' ');
          const ids = validLastSeen.map(v => v.issueId);
          const idPlaceholders = ids.map(() => '?').join(',');
          await connection.query(
            `UPDATE g_argus_issues SET last_seen = CASE ${caseWhen} ELSE last_seen END WHERE id IN (${idPlaceholders})`,
            [...validLastSeen.flatMap(v => [v.issueId, v.dateStr]), ...ids]
          );
        }

        // SUCCESS: now deduct the flushed amounts from Redis
        const clearPipeline = redis.pipeline();
        for (const { key, increment } of validTimesSeen) {
          clearPipeline.hincrby(COUNTERS.ISSUE_TIMES_SEEN, key, -increment);
        }
        for (const { key } of validLastSeen) {
          clearPipeline.hdel(BUFFERS.ISSUE_LAST_SEEN, key);
        }
        await clearPipeline.exec();

        logger.info('Issue stats flushed', {
          timesSeenCount: validTimesSeen.length,
          lastSeenCount: validLastSeen.length,
        });
      } catch (mysqlError) {
        // MySQL failed — do NOT clear Redis. Values will be retried on next cycle.
        try { await connection.rollback(); } catch { /* ignore rollback errors */ }
        throw mysqlError;
      } finally {
        connection.release();
      }
    } catch (error) {
      logger.error('Issue stats flush failed (will retry next cycle)', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Flush accumulated alert history records from Redis to MySQL.
   *
   * Uses a Lua script to atomically LRANGE + LTRIM, preventing data loss
   * when new RPUSH commands arrive between the read and trim operations.
   */
  private async flushAlertHistory(): Promise<void> {
    try {
      // Atomic drain: read all + trim in one Lua call
      const records = await redis.eval(
        ATOMIC_DRAIN_SCRIPT,
        1,
        BUFFERS.ALERT_HISTORY
      ) as string[];

      if (!records || records.length === 0) return;

      // Parse and batch insert
      const values: any[][] = [];
      for (const raw of records) {
        try {
          const record = JSON.parse(raw);
          values.push([
            record.rule_id,
            record.project_id,
            record.issue_id || null,
            record.event_id || null,
            record.trigger_reason || '',
            record.notified_channels || '[]',
          ]);
        } catch {
          logger.warn('Skipping malformed alert history record');
        }
      }

      if (values.length > 0) {
        const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
        const flat = values.flat();

        try {
          await mysqlPool.query(
            `INSERT INTO g_argus_alert_history
             (rule_id, project_id, issue_id, event_id, trigger_reason, notified_channels)
             VALUES ${placeholders}`,
            flat
          );
          logger.info('Alert history flushed', { count: values.length });
        } catch (mysqlError) {
          // MySQL INSERT failed — push records back to Redis for retry
          const pushPipeline = redis.pipeline();
          for (const raw of records) {
            pushPipeline.rpush(BUFFERS.ALERT_HISTORY, raw);
          }
          await pushPipeline.exec();
          logger.error('Alert history MySQL insert failed, pushed back to Redis for retry', {
            count: records.length,
            error: mysqlError instanceof Error ? mysqlError.message : String(mysqlError),
          });
        }
      }
    } catch (error) {
      logger.error('Alert history flush failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const batchFlusher = new BatchFlusher();
