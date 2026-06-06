import Redis from 'ioredis';
import { Queue, Worker } from 'groupmq';
import { config } from '../config';
import { clickhouse } from '../config/clickhouse';
import { createLogger } from '../utils/logger';
import { normalizeErrorEvent, NormalizedError } from '../processing/normalizer';
import { computeFingerprint } from '../processing/fingerprinter';
import { groupIntoIssue } from '../processing/issue-grouper';
import { evaluateErrorAlerts } from '../utils/alert-evaluator';
import { ArgusErrorEvent } from '../types/events';
import { QUEUES } from '../config/redis-keys';
import { pipelineConfig } from '../config/pipeline-config';
import { recordEventForIssue } from '../utils/event-counter';

const logger = createLogger('error-worker');

export class ErrorWorker {
  private redis: Redis;
  private queue: Queue;
  private worker: Worker | null = null;

  // ClickHouse batch buffer (flushed periodically or when maxBatchSize is reached)
  private chBuffer: NormalizedError[] = [];
  private chFlushTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      db: config.redis.db,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      disableClientInfo: true,
    });

    this.queue = new Queue({
      redis: this.redis,
      namespace: QUEUES.ERROR_PROCESSING,
    });
  }

  async start(): Promise<void> {
    const { flushIntervalMs, maxBatchSize } = pipelineConfig.clickhouseBuffer;
    const { errorConcurrency } = pipelineConfig.groupmq;

    // Start periodic ClickHouse flush timer
    this.chFlushTimer = setInterval(
      () => this.flushClickHouse(),
      flushIntervalMs,
    );

    // Start GroupMQ worker — each groupId (projectId) is processed sequentially,
    // while different groups run in parallel.
    this.worker = new Worker({
      queue: this.queue,
      handler: async (job) => {
        const rawEvent = JSON.parse(job.data) as ArgusErrorEvent & {
          project_id: string;
          internal_project_id: number;
          dsn_key_id: number;
        };

        const processed = await this.processEvent(rawEvent);
        if (processed) {
          this.chBuffer.push(processed);

          // Flush immediately if buffer reaches max size
          if (this.chBuffer.length >= maxBatchSize) {
            await this.flushClickHouse();
          }
        }
      },
      concurrency: errorConcurrency,
    });

    await this.worker.run();

    logger.info('Error worker started (GroupMQ)', {
      namespace: QUEUES.ERROR_PROCESSING,
      concurrency: errorConcurrency,
      chFlushIntervalMs: flushIntervalMs,
      chMaxBatchSize: maxBatchSize,
    });
  }

  async close(): Promise<void> {
    // 1. Stop accepting new jobs
    if (this.worker) await this.worker.close();

    // 2. Flush remaining ClickHouse buffer
    if (this.chFlushTimer) clearInterval(this.chFlushTimer);
    await this.flushClickHouse();

    // 3. Close Redis connection
    await this.redis.quit();

    logger.info('Error worker stopped');
  }

  private async processEvent(
    rawEvent: ArgusErrorEvent & { project_id: string; internal_project_id: number; dsn_key_id: number }
  ): Promise<NormalizedError | null> {
    try {
      // 1. Normalize
      const normalized = normalizeErrorEvent(rawEvent, rawEvent.project_id);

      // 2. Fingerprint
      const { fingerprint, primary_hash } = computeFingerprint(rawEvent);

      // 3. Issue grouping (per-project FIFO guaranteed by GroupMQ — no lock contention)
      const groupResult = await groupIntoIssue(
        rawEvent.internal_project_id,
        rawEvent.project_id,
        rawEvent,
        primary_hash,
        fingerprint
      );

      // 4. Record event in Redis counters (for alert frequency evaluation)
      recordEventForIssue(
        rawEvent.project_id,
        groupResult.issue_id,
        rawEvent.event_id,
        (rawEvent as any).user?.id || (rawEvent as any).user_id
      ).catch(() => {}); // fire-and-forget

      // 5. Evaluate alert rules (fire-and-forget — never block event processing)
      evaluateErrorAlerts(
        {
          event_id: rawEvent.event_id,
          project_id: rawEvent.project_id,
          internal_project_id: rawEvent.internal_project_id,
          issue_id: groupResult.issue_id,
          level: rawEvent.level || 'error',
          environment: rawEvent.environment,
          platform: rawEvent.platform,
          release: rawEvent.release,
          title: rawEvent.exception?.type
            ? `${rawEvent.exception.type}: ${rawEvent.exception.value || ''}`
            : 'Unknown Error',
          culprit: rawEvent.exception?.stacktrace?.frames?.slice(-1)?.[0]?.function || '',
          tags: rawEvent.tags,
        },
        groupResult
      ).catch((e) => {
        logger.warn('Alert evaluation failed (non-blocking)', {
          eventId: rawEvent.event_id,
          error: e instanceof Error ? e.message : String(e),
        });
      });

      // 5. Assemble final record for ClickHouse
      const record: NormalizedError = {
        ...normalized,
        fingerprint,
        primary_hash,
        issue_id: groupResult.issue_id,
        dsn_key_id: rawEvent.dsn_key_id || 0,
      };

      return record;
    } catch (error) {
      logger.error('Failed to process event', {
        eventId: rawEvent.event_id,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Maximum number of buffered error records before dropping.
   * Prevents OOM when ClickHouse is unavailable for extended periods.
   */
  private readonly MAX_BUFFER_SIZE = 50_000;

  /**
   * Flush the accumulated ClickHouse buffer.
   * On failure, records are returned to the buffer (capped at MAX_BUFFER_SIZE).
   */
  private async flushClickHouse(): Promise<void> {
    if (this.chBuffer.length === 0) return;

    const batch = this.chBuffer.splice(0);

    try {
      await clickhouse.insert({
        table: 'argus.errors',
        values: batch,
        format: 'JSONEachRow',
      });

      logger.info('ClickHouse batch flushed', { count: batch.length });
    } catch (error) {
      logger.error('ClickHouse flush failed, will retry', {
        count: batch.length,
        error: error instanceof Error ? error.message : String(error),
      });

      // Put failed records back for retry, but cap total buffer size
      const spaceAvailable = this.MAX_BUFFER_SIZE - this.chBuffer.length;
      if (spaceAvailable >= batch.length) {
        this.chBuffer = batch.concat(this.chBuffer);
      } else if (spaceAvailable > 0) {
        const kept = batch.slice(batch.length - spaceAvailable);
        this.chBuffer = kept.concat(this.chBuffer);
        logger.warn('Error buffer overflow, dropped oldest entries', {
          dropped: batch.length - spaceAvailable,
          bufferSize: this.chBuffer.length,
        });
      } else {
        logger.warn('Error buffer full, dropped entire failed batch', {
          dropped: batch.length,
          bufferSize: this.chBuffer.length,
        });
      }
    }
  }
}
