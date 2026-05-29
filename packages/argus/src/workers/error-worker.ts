import Redis from 'ioredis';
import { config } from '../config';
import { clickhouse } from '../config/clickhouse';
import { createLogger } from '../utils/logger';
import { normalizeErrorEvent, NormalizedError } from '../processing/normalizer';
import { computeFingerprint } from '../processing/fingerprinter';
import { groupIntoIssue } from '../processing/issue-grouper';
import { ArgusErrorEvent } from '../types/events';

const logger = createLogger('error-worker');

const STREAM_KEY_PATTERN = 'argus:errors:*';
const CONSUMER_GROUP = 'argus-error-workers';
const CONSUMER_NAME = `worker-${process.pid}`;
const BLOCK_MS = 5000;

export class ErrorWorker {
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
      disableClientInfo: true,
    });
  }

  async start(): Promise<void> {
    this.running = true;
    logger.info('Error worker started', {
      consumerGroup: CONSUMER_GROUP,
      consumer: CONSUMER_NAME,
      batchSize: config.worker.errorBatchSize,
    });

    // Main processing loop
    this.processLoop().catch((error) => {
      logger.error('Error worker loop crashed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  async close(): Promise<void> {
    this.running = false;
    await this.redis.quit();
    logger.info('Error worker stopped');
  }

  private async processLoop(): Promise<void> {
    while (this.running) {
      try {
        // Discover active streams
        await this.discoverStreams();

        if (this.knownStreams.size === 0) {
          // No active streams, wait before retrying
          await this.sleep(BLOCK_MS);
          continue;
        }

        // Read from all known streams
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

  /**
   * Discover streams matching argus:errors:* pattern.
   */
  private async discoverStreams(): Promise<void> {
    const keys = await this.redis.keys(STREAM_KEY_PATTERN);
    for (const key of keys) {
      if (!this.knownStreams.has(key)) {
        // Ensure consumer group exists
        try {
          await this.redis.xgroup(
            'CREATE',
            key,
            CONSUMER_GROUP,
            '0',
            'MKSTREAM'
          );
          logger.info('Consumer group created', { stream: key });
        } catch (error: any) {
          // BUSYGROUP means it already exists, which is fine
          if (!error.message?.includes('BUSYGROUP')) {
            throw error;
          }
        }
        this.knownStreams.add(key);
      }
    }
  }

  private async processStream(streamKey: string): Promise<void> {
    const batchSize = config.worker.errorBatchSize;

    // Read pending (unacknowledged) messages first, then new ones
    const results = await this.redis.xreadgroup(
      'GROUP',
      CONSUMER_GROUP,
      CONSUMER_NAME,
      'COUNT',
      String(batchSize),
      'BLOCK',
      '100', // Short block — we iterate over multiple streams
      'STREAMS',
      streamKey,
      '>' // Only new messages
    );

    if (!results || results.length === 0) {
      return;
    }

    const batch: NormalizedError[] = [];
    const ackIds: string[] = [];

    for (const streamResult of results as [string, [string, string[]][]][]) {
      const messages = streamResult[1];
      for (const message of messages) {
        const messageId = message[0];
        const fields = message[1];
        try {
          // fields is ['data', '{...json...}']
          const dataIndex = fields.indexOf('data');
          if (dataIndex === -1 || dataIndex + 1 >= fields.length) {
            logger.warn('Malformed stream message', { messageId });
            ackIds.push(messageId);
            continue;
          }

          const rawEvent = JSON.parse(fields[dataIndex + 1]) as ArgusErrorEvent & {
            project_id: string;
          };

          // Process the event
          const processed = await this.processEvent(rawEvent);
          if (processed) {
            batch.push(processed);
          }

          ackIds.push(messageId);
        } catch (error) {
          logger.error('Failed to process message', {
            messageId,
            error: error instanceof Error ? error.message : String(error),
          });
          // Still ACK to avoid infinite retry — dead letter handling can be added later
          ackIds.push(messageId);
        }
      }
    }

    // Batch insert into ClickHouse
    if (batch.length > 0) {
      await this.insertToClickHouse(batch);
    }

    // ACK processed messages
    if (ackIds.length > 0) {
      await this.redis.xack(streamKey, CONSUMER_GROUP, ...ackIds);
    }
  }

  private async processEvent(
    rawEvent: ArgusErrorEvent & { project_id: string }
  ): Promise<NormalizedError | null> {
    try {
      // 1. Normalize
      const normalized = normalizeErrorEvent(rawEvent, rawEvent.project_id);

      // 2. Fingerprint
      const { fingerprint, primary_hash } = computeFingerprint(rawEvent);

      // 3. Issue grouping
      const groupResult = await groupIntoIssue(
        parseInt(rawEvent.project_id, 10),
        rawEvent,
        primary_hash,
        fingerprint
      );

      // 4. Assemble final record
      const record: NormalizedError = {
        ...normalized,
        fingerprint,
        primary_hash,
        issue_id: groupResult.issue_id,
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

  private async insertToClickHouse(batch: NormalizedError[]): Promise<void> {
    try {
      await clickhouse.insert({
        table: 'argus.errors',
        values: batch,
        format: 'JSONEachRow',
      });

      logger.info('Batch inserted to ClickHouse', { count: batch.length });
    } catch (error) {
      logger.error('ClickHouse batch insert failed', {
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
