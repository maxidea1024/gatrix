import { redis } from '../config/redis';
import { mysqlPool } from '../config/mysql';
import { createLogger } from './logger';
import { COUNTERS, BUFFERS } from '../config/redis-keys';
import { pipelineConfig } from '../config/pipeline-config';

const logger = createLogger('batch-flusher');

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
   * Redis structure:
   * - COUNTERS.ISSUE_TIMES_SEEN (Hash): field="issue:{id}", value=increment
   * - BUFFERS.ISSUE_LAST_SEEN (Hash): field="issue:{id}", value=timestamp_ms
   *
   * Strategy: HGETALL + DEL atomically, then batch UPDATE.
   */
  private async flushIssueStats(): Promise<void> {
    try {
      // Atomically read and clear times_seen buffer
      const [timesSeenEntries, lastSeenEntries] = await Promise.all([
        redis.hgetall(COUNTERS.ISSUE_TIMES_SEEN),
        redis.hgetall(BUFFERS.ISSUE_LAST_SEEN),
      ]);

      const timesSeenKeys = Object.keys(timesSeenEntries);
      const lastSeenKeys = Object.keys(lastSeenEntries);

      if (timesSeenKeys.length === 0 && lastSeenKeys.length === 0) return;

      // Clear Redis buffers (race-safe: new increments after HGETALL will be
      // picked up by the next flush cycle)
      const clearPipeline = redis.pipeline();
      for (const key of timesSeenKeys) {
        clearPipeline.hincrby(COUNTERS.ISSUE_TIMES_SEEN, key, -parseInt(timesSeenEntries[key], 10));
      }
      for (const key of lastSeenKeys) {
        clearPipeline.hdel(BUFFERS.ISSUE_LAST_SEEN, key);
      }
      await clearPipeline.exec();

      // Build batch SQL updates
      const connection = await mysqlPool.getConnection();
      try {
        // Batch update times_seen
        if (timesSeenKeys.length > 0) {
          const cases: string[] = [];
          const ids: number[] = [];

          for (const key of timesSeenKeys) {
            const issueId = parseInt(key.replace('issue:', ''), 10);
            const increment = parseInt(timesSeenEntries[key], 10);
            if (!isNaN(issueId) && increment > 0) {
              cases.push(`WHEN ${issueId} THEN times_seen + ${increment}`);
              ids.push(issueId);
            }
          }

          if (ids.length > 0) {
            await connection.query(
              `UPDATE g_argus_issues SET times_seen = CASE id ${cases.join(' ')} ELSE times_seen END WHERE id IN (${ids.join(',')})`
            );
          }
        }

        // Batch update last_seen
        if (lastSeenKeys.length > 0) {
          const cases: string[] = [];
          const ids: number[] = [];

          for (const key of lastSeenKeys) {
            const issueId = parseInt(key.replace('issue:', ''), 10);
            const timestampMs = parseInt(lastSeenEntries[key], 10);
            if (!isNaN(issueId) && timestampMs > 0) {
              const dateStr = new Date(timestampMs).toISOString().slice(0, 19).replace('T', ' ');
              cases.push(`WHEN ${issueId} THEN '${dateStr}'`);
              ids.push(issueId);
            }
          }

          if (ids.length > 0) {
            await connection.query(
              `UPDATE g_argus_issues SET last_seen = CASE id ${cases.join(' ')} ELSE last_seen END WHERE id IN (${ids.join(',')})`
            );
          }
        }

        logger.info('Issue stats flushed', {
          timesSeenCount: timesSeenKeys.length,
          lastSeenCount: lastSeenKeys.length,
        });
      } finally {
        connection.release();
      }
    } catch (error) {
      logger.error('Issue stats flush failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Flush accumulated alert history records from Redis to MySQL.
   *
   * Redis structure:
   * - BUFFERS.ALERT_HISTORY (List): each entry is a JSON-stringified alert record
   *
   * Strategy: LRANGE + LTRIM atomically, then batch INSERT.
   */
  private async flushAlertHistory(): Promise<void> {
    try {
      // Read all buffered records
      const records = await redis.lrange(BUFFERS.ALERT_HISTORY, 0, -1);
      if (records.length === 0) return;

      // Trim the list (new entries after LRANGE will remain)
      await redis.ltrim(BUFFERS.ALERT_HISTORY, records.length, -1);

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

        await mysqlPool.query(
          `INSERT INTO g_argus_alert_history
           (rule_id, project_id, issue_id, event_id, trigger_reason, notified_channels)
           VALUES ${placeholders}`,
          flat
        );

        logger.info('Alert history flushed', { count: values.length });
      }
    } catch (error) {
      logger.error('Alert history flush failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const batchFlusher = new BatchFlusher();
