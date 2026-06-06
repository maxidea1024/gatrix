import Redis from 'ioredis';
import {
  config,
  createLogger,
  ArgusSessionEvent,
  KNOWN_STREAMS,
  CONSUMER_GROUPS,
  pipelineConfig,
} from '@gatrix/argus';
import { optic } from '@gatrix/argus-optic';

const logger = createLogger('session-worker');

const CONSUMER_GROUP = CONSUMER_GROUPS.SESSIONS;
const CONSUMER_NAME = `worker-${process.pid}`;

interface NormalizedSession {
  session_id: string;
  project_id: string;
  timestamp: string;
  started: string;
  status: string;
  seq: number;
  duration: number | null;
  errors: number;
  environment: string;
  release: string;
  distinct_id: string;
  user_agent: string;
}

export class SessionWorker {
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
    logger.info('Session worker started', {
      consumerGroup: CONSUMER_GROUP,
      consumer: CONSUMER_NAME,
      batchSize: config.worker.sessionBatchSize,
    });

    this.processLoop().catch((error) => {
      logger.error('Session worker loop crashed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  async close(): Promise<void> {
    this.running = false;
    await this.redis.quit();
    logger.info('Session worker stopped');
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
    const keys = await this.redis.smembers(KNOWN_STREAMS.SESSIONS);
    for (const key of keys) {
      if (!this.knownStreams.has(key)) {
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
          if (!error.message?.includes('BUSYGROUP')) {
            throw error;
          }
        }
        this.knownStreams.add(key);
      }
    }
  }

  private async processStream(streamKey: string): Promise<void> {
    const batchSize = config.worker.sessionBatchSize;

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

    const batch: NormalizedSession[] = [];
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

          const rawEvent = JSON.parse(
            fields[dataIndex + 1]
          ) as ArgusSessionEvent & {
            project_id: string;
          };

          batch.push(this.normalizeSession(rawEvent));
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
      await this.insertSessions(batch);
    }

    if (ackIds.length > 0) {
      await this.redis.xack(streamKey, CONSUMER_GROUP, ...ackIds);
    }
  }

  private normalizeSession(
    event: ArgusSessionEvent & { project_id: string }
  ): NormalizedSession {
    return {
      session_id: event.session_id,
      project_id: event.project_id,
      timestamp: event.timestamp || new Date().toISOString(),
      started: event.started || event.timestamp || new Date().toISOString(),
      status: event.status || 'ok',
      seq: event.seq || 0,
      duration: event.duration ?? null,
      errors: event.errors || 0,
      environment: event.environment || '',
      release: event.release || '',
      distinct_id: event.distinct_id || event.user?.id || '',
      user_agent: event.user_agent || '',
    };
  }

  private async insertSessions(batch: NormalizedSession[]): Promise<void> {
    try {
      await optic.insert({
        table: 'argus.sessions',
        values: batch,
        format: 'JSONEachRow',
      });
      logger.info('Sessions inserted', { count: batch.length });
    } catch (error) {
      logger.error('ClickHouse sessions insert failed', {
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
