import Redis from 'ioredis';
import { config, createLogger, ArgusFeedbackEvent, KNOWN_STREAMS, CONSUMER_GROUPS, pipelineConfig } from '@gatrix/argus';
import { optic } from '@gatrix/argus-optic';

import { evaluateFeedbackAlerts } from '../utils/alert-evaluator';
import { classifyFeedback } from '../utils/ai-classifier';

const logger = createLogger('feedback-worker');

const CONSUMER_GROUP = CONSUMER_GROUPS.FEEDBACK;
const CONSUMER_NAME = `worker-${process.pid}`;
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
  attachments: string[];
  // Device context
  browser: string;
  browser_version: string;
  os: string;
  os_version: string;
  device: string;
  // User identity
  user_id: string;
  locale: string;
  // AI classification
  sentiment: string;
  category: string;
  is_spam: number;
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
          await this.sleep(pipelineConfig.worker.blockMs);
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
    const keys = await this.redis.smembers(KNOWN_STREAMS.FEEDBACK);
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
      // AI classification (non-blocking ??enrich before insert)
      try {
        await Promise.all(batch.map(async (item) => {
          const classification = await classifyFeedback(item.project_id, item.message);
          if (classification) {
            item.sentiment = classification.sentiment;
            item.category = classification.category;
            if (classification.spam_score > 0.7) {
              (item as any).is_spam = 1;
            }
          }
        }));
      } catch (e) {
        logger.warn('AI classification batch failed (non-fatal)', { error: (e as Error).message });
      }

      try {
        await optic.insert({
          table: 'argus.user_feedback',
          values: batch,
          format: 'JSONEachRow',
        });
        logger.info('Feedback inserted', { count: batch.length });

        // Evaluate feedback alert rules for each item
        for (const item of batch) {
          evaluateFeedbackAlerts({
            feedback_id: item.feedback_id,
            project_id: item.project_id,
            name: item.name,
            email: item.email,
            message: item.message,
            url: item.url,
            environment: item.environment,
            source: item.source,
            tags: item.tags,
          }).catch((e) => {
            logger.warn('Feedback alert evaluation failed', { feedbackId: item.feedback_id, error: (e as Error).message });
          });
        }
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
    const contexts = event.contexts || {};
    const user = event.user || {};

    return {
      feedback_id: event.feedback_id || event.event_id,
      project_id: event.project_id,
      event_id: event.linked_event_id || '',
      timestamp: event.timestamp || new Date().toISOString(),
      name: event.name || user.username || '',
      email: event.email || user.email || '',
      message: event.message || '',
      contact_email: event.contact_email || '',
      url: event.url || '',
      environment: event.environment || '',
      release: event.release || '',
      source: event.source || 'widget',
      tags: event.tags || {},
      attachments: (event as any).attachments || [],
      // Device context
      browser: (contexts.browser as any)?.name || '',
      browser_version: (contexts.browser as any)?.version || '',
      os: (contexts.os as any)?.name || '',
      os_version: (contexts.os as any)?.version || '',
      device: (contexts.device as any)?.family || (contexts.device as any)?.name || '',
      // User identity
      user_id: user.id || '',
      locale: event.tags?.locale || (contexts as any).locale || '',
      // AI classification (will be enriched by classifyFeedback before insert)
      sentiment: '',
      category: '',
      is_spam: 0,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
