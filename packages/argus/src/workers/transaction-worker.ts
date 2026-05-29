import Redis from 'ioredis';
import { config } from '../config';
import { clickhouse } from '../config/clickhouse';
import { createLogger } from '../utils/logger';
import {
  normalizeTransactionEvent,
  NormalizedTransaction,
  NormalizedSpan,
} from '../processing/transaction-normalizer';
import { ArgusTransactionEvent } from '../types/events';

const logger = createLogger('txn-worker');

const STREAM_KEY_PATTERN = 'argus:txns:*';
const CONSUMER_GROUP = 'argus-txn-workers';
const CONSUMER_NAME = `worker-${process.pid}`;
const BLOCK_MS = 5000;

export class TransactionWorker {
  private redis: Redis;
  private running = false;
  private knownStreams: Set<string> = new Set();

  constructor() {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      db: config.redis.db,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }

  async start(): Promise<void> {
    this.running = true;
    logger.info('Transaction worker started', {
      consumerGroup: CONSUMER_GROUP,
      consumer: CONSUMER_NAME,
      batchSize: config.worker.transactionBatchSize,
    });

    this.processLoop().catch((error) => {
      logger.error('Transaction worker loop crashed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  async close(): Promise<void> {
    this.running = false;
    await this.redis.quit();
    logger.info('Transaction worker stopped');
  }

  private async processLoop(): Promise<void> {
    while (this.running) {
      try {
        await this.discoverStreams();

        if (this.knownStreams.size === 0) {
          await this.sleep(BLOCK_MS);
          continue;
        }

        for (const streamKey of this.knownStreams) {
          await this.processStream(streamKey);
        }
      } catch (error) {
        logger.error('Error in processing loop', {
          error: error instanceof Error ? error.message : String(error),
        });
        await this.sleep(1000);
      }
    }
  }

  private async discoverStreams(): Promise<void> {
    const keys = await this.redis.keys(STREAM_KEY_PATTERN);
    for (const key of keys) {
      if (!this.knownStreams.has(key)) {
        try {
          await this.redis.xgroup('CREATE', key, CONSUMER_GROUP, '0', 'MKSTREAM');
          logger.info('Consumer group created', { stream: key });
        } catch (error: any) {
          if (!error.message?.includes('BUSYGROUP')) {
            throw error;
          }
        }
        this.knownStreams.add(key);
      }
    }
  }

  private async processStream(streamKey: string): Promise<void> {
    const batchSize = config.worker.transactionBatchSize;

    const results = await this.redis.xreadgroup(
      'GROUP',
      CONSUMER_GROUP,
      CONSUMER_NAME,
      'COUNT',
      String(batchSize),
      'BLOCK',
      '100',
      'STREAMS',
      streamKey,
      '>'
    );

    if (!results || results.length === 0) {
      return;
    }

    const txnBatch: NormalizedTransaction[] = [];
    const spanBatch: NormalizedSpan[] = [];
    const ackIds: string[] = [];

    for (const streamResult of results as [string, [string, string[]][]][]) {
      const messages = streamResult[1];
      for (const message of messages) {
        const messageId = message[0];
        const fields = message[1];
        try {
          const dataIndex = fields.indexOf('data');
          if (dataIndex === -1 || dataIndex + 1 >= fields.length) {
            logger.warn('Malformed stream message', { messageId });
            ackIds.push(messageId);
            continue;
          }

          const rawEvent = JSON.parse(fields[dataIndex + 1]) as ArgusTransactionEvent & {
            project_id: string;
          };

          const { transaction, spans } = normalizeTransactionEvent(
            rawEvent,
            rawEvent.project_id
          );

          txnBatch.push(transaction);
          if (spans.length > 0) {
            spanBatch.push(...spans);
          }

          ackIds.push(messageId);
        } catch (error) {
          logger.error('Failed to process message', {
            messageId,
            error: error instanceof Error ? error.message : String(error),
          });
          ackIds.push(messageId);
        }
      }
    }

    // Batch insert transactions
    if (txnBatch.length > 0) {
      await this.insertTransactions(txnBatch);
    }

    // Batch insert spans
    if (spanBatch.length > 0) {
      await this.insertSpans(spanBatch);
    }

    // ACK
    if (ackIds.length > 0) {
      await this.redis.xack(streamKey, CONSUMER_GROUP, ...ackIds);
    }
  }

  private async insertTransactions(batch: NormalizedTransaction[]): Promise<void> {
    try {
      await clickhouse.insert({
        table: 'argus.transactions',
        values: batch,
        format: 'JSONEachRow',
      });
      logger.info('Transactions inserted', { count: batch.length });
    } catch (error) {
      logger.error('ClickHouse transactions insert failed', {
        count: batch.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async insertSpans(batch: NormalizedSpan[]): Promise<void> {
    try {
      await clickhouse.insert({
        table: 'argus.spans',
        values: batch,
        format: 'JSONEachRow',
      });
      logger.info('Spans inserted', { count: batch.length });
    } catch (error) {
      logger.error('ClickHouse spans insert failed', {
        count: batch.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
