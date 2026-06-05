import Redis from 'ioredis';
import { Queue, Worker } from 'groupmq';
import { config } from '../config';
import { clickhouse } from '../config/clickhouse';
import { createLogger } from '../utils/logger';
import {
  normalizeTransactionEvent,
  NormalizedTransaction,
  NormalizedSpan,
} from '../processing/transaction-normalizer';
import { ArgusTransactionEvent } from '../types/events';
import { QUEUES } from '../config/redis-keys';
import { pipelineConfig } from '../config/pipeline-config';

const logger = createLogger('txn-worker');

export class TransactionWorker {
  private redis: Redis;
  private queue: Queue;
  private worker: Worker | null = null;

  // ClickHouse batch buffers (transactions and spans flushed separately)
  private txnBuffer: NormalizedTransaction[] = [];
  private spanBuffer: NormalizedSpan[] = [];
  private chFlushTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      db: config.redis.db,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    this.queue = new Queue({
      redis: this.redis,
      namespace: QUEUES.TRANSACTION_PROCESSING,
    });
  }

  async start(): Promise<void> {
    const { flushIntervalMs, maxBatchSize } = pipelineConfig.clickhouseBuffer;
    const { txnConcurrency } = pipelineConfig.groupmq;

    // Start periodic ClickHouse flush timer
    this.chFlushTimer = setInterval(
      () => this.flushClickHouse(),
      flushIntervalMs,
    );

    // Start GroupMQ worker — per-project FIFO for future-proofing
    this.worker = new Worker({
      queue: this.queue,
      handler: async (job) => {
        const rawEvent = JSON.parse(job.data) as ArgusTransactionEvent & {
          project_id: string;
          dsn_key_id: number;
        };

        try {
          const { transaction, spans } = normalizeTransactionEvent(
            rawEvent,
            rawEvent.project_id,
            rawEvent.dsn_key_id || 0,
          );

          this.txnBuffer.push(transaction);
          if (spans.length > 0) {
            this.spanBuffer.push(...spans);
          }

          // Flush immediately if either buffer reaches max size
          if (this.txnBuffer.length >= maxBatchSize || this.spanBuffer.length >= maxBatchSize) {
            await this.flushClickHouse();
          }
        } catch (error) {
          logger.error('Failed to process transaction', {
            eventId: rawEvent.event_id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
      concurrency: txnConcurrency,
    });

    await this.worker.run();

    logger.info('Transaction worker started (GroupMQ)', {
      namespace: QUEUES.TRANSACTION_PROCESSING,
      concurrency: txnConcurrency,
      chFlushIntervalMs: flushIntervalMs,
      chMaxBatchSize: maxBatchSize,
    });
  }

  async close(): Promise<void> {
    // 1. Stop accepting new jobs
    if (this.worker) await this.worker.close();

    // 2. Flush remaining buffers
    if (this.chFlushTimer) clearInterval(this.chFlushTimer);
    await this.flushClickHouse();

    // 3. Close Redis connection
    await this.redis.quit();

    logger.info('Transaction worker stopped');
  }

  /**
   * Flush both transaction and span buffers to ClickHouse.
   * On failure, records are returned to buffers for the next attempt.
   */
  private async flushClickHouse(): Promise<void> {
    const txnBatch = this.txnBuffer.splice(0);
    const spanBatch = this.spanBuffer.splice(0);

    if (txnBatch.length === 0 && spanBatch.length === 0) return;

    try {
      const promises: Promise<void>[] = [];

      if (txnBatch.length > 0) {
        promises.push(
          clickhouse.insert({
            table: 'argus.transactions',
            values: txnBatch,
            format: 'JSONEachRow',
          }).then(() => {
            logger.info('Transactions flushed', { count: txnBatch.length });
          }),
        );
      }

      if (spanBatch.length > 0) {
        promises.push(
          clickhouse.insert({
            table: 'argus.spans',
            values: spanBatch,
            format: 'JSONEachRow',
          }).then(() => {
            logger.info('Spans flushed', { count: spanBatch.length });
          }),
        );
      }

      await Promise.all(promises);
    } catch (error) {
      // Put records back for retry
      this.txnBuffer.unshift(...txnBatch);
      this.spanBuffer.unshift(...spanBatch);
      logger.error('ClickHouse flush failed, will retry', {
        txnCount: txnBatch.length,
        spanCount: spanBatch.length,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
