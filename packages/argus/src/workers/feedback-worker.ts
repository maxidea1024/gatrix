import Redis from 'ioredis';
import { config } from '../config';
import { clickhouse } from '../config/clickhouse';
import { createLogger } from '../utils/logger';
import { ArgusFeedbackEvent } from '../types/events';

const logger = createLogger('feedback-worker');

const STREAM_KEY_PATTERN = 'argus:feedback:*';
const CONSUMER_GROUP = 'argus-feedback-workers';
const CONSUMER_NAME = `worker-${process.pid}`;
const BLOCK_MS = 5000;
const BATCH_SIZE = 100;

interface NormalizedFeedback {
  feedback_id: string;
  project_id: string;
  event_id: string;
  timestamp: string;
  name: string;
  email: string;
  message: string;
  contact_email: string;
  url: string;
  environment: string;
  release: string;
  source: string;
  tags: Record<string, string>;
}

export class FeedbackWorker {
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
    logger.info('Feedback worker started', {
      consumerGroup: CONSUMER_GROUP,
      consumer: CONSUMER_NAME,
    });

    this.processLoop().catch((error) => {
      logger.error('Feedback worker loop crashed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  async close(): Promise<void> {
    this.running = false;
    await this.redis.quit();
    logger.info('Feedback worker stopped');
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
    const results = await this.redis.xreadgroup(
      'GROUP',
      CONSUMER_GROUP,
      CONSUMER_NAME,
      'COUNT',
      String(BATCH_SIZE),
      'BLOCK',
      '100',
      'STREAMS',
      streamKey,
      '>'
    );

    if (!results || results.length === 0) {
      return;
    }

    const batch: NormalizedFeedback[] = [];
    const ackIds: string[] = [];

    for (const streamResult of results as [string, [string, string[]][]][]) {
      const messages = streamResult[1];
      for (const message of messages) {
        const messageId = message[0];
        const fields = message[1];
        try {
          const dataIndex = fields.indexOf('data');
          if (dataIndex === -1 || dataIndex + 1 >= fields.length) {
            ackIds.push(messageId);
            continue;
          }

          const rawEvent = JSON.parse(fields[dataIndex + 1]) as ArgusFeedbackEvent & {
            project_id: string;
          };

          batch.push(this.normalize(rawEvent));
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

    if (batch.length > 0) {
      try {
        await clickhouse.insert({
          table: 'argus.user_feedback',
          values: batch,
          format: 'JSONEachRow',
        });
        logger.info('Feedback inserted', { count: batch.length });
      } catch (error) {
        logger.error('ClickHouse feedback insert failed', {
          count: batch.length,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (ackIds.length > 0) {
      await this.redis.xack(streamKey, CONSUMER_GROUP, ...ackIds);
    }
  }

  private normalize(event: ArgusFeedbackEvent & { project_id: string }): NormalizedFeedback {
    return {
      feedback_id: event.feedback_id || event.event_id,
      project_id: event.project_id,
      event_id: event.linked_event_id || '',
      timestamp: event.timestamp || new Date().toISOString(),
      name: event.name || '',
      email: event.email || '',
      message: event.message || '',
      contact_email: event.contact_email || '',
      url: event.url || '',
      environment: event.environment || '',
      release: event.release || '',
      source: event.source || 'widget',
      tags: event.tags || {},
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
