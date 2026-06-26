import Redis from 'ioredis';
import {
  config,
  createLogger,
  ArgusActivityEvent,
  KNOWN_STREAMS,
  CONSUMER_GROUPS,
  pipelineConfig,
} from '@gatrix/argus';
import { optic } from '@gatrix/argus-optic';

const logger = createLogger('activity-worker');

const CONSUMER_GROUP = CONSUMER_GROUPS.ACTIVITIES;
const CONSUMER_NAME = `worker-${process.pid}`;

const EXCHANGE_RATES_TO_USD: Record<string, number> = {
  USD: 1.0,
  KRW: 0.00077,  // 1,300 KRW = 1 USD
  EUR: 1.08,     // 1 EUR = 1.08 USD
  JPY: 0.0064,   // 156 JPY = 1 USD
};

function convertToUsd(amount: number, currency: string): number {
  const rate = EXCHANGE_RATES_TO_USD[currency.toUpperCase()] || 1.0;
  return amount * rate;
}

interface NormalizedActivity {
  event_id: string;
  project_id: string;
  timestamp: string;
  event_name: string;
  user_id: string;
  device_id: string;
  session_id: string;
  platform: string;
  environment: string;
  release: string;
  country: string;
  city: string;
  os: string;
  app_version: string;
  properties: Record<string, string>;
  numeric_properties: Record<string, number>;
  dsn_key_id: number;
  currency: string;
  amount_usd: number;
}

export class ActivityWorker {
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
    logger.info('Activity worker started', {
      consumerGroup: CONSUMER_GROUP,
      consumer: CONSUMER_NAME,
      batchSize: config.worker.activityBatchSize,
    });

    this.processLoop().catch((error) => {
      logger.error('Activity worker loop crashed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  async close(): Promise<void> {
    this.running = false;
    await this.redis.quit();
    logger.info('Activity worker stopped');
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
    const keys = await this.redis.smembers(KNOWN_STREAMS.ACTIVITIES);
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
    const batchSize = config.worker.activityBatchSize;

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

    const batch: NormalizedActivity[] = [];
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
          ) as ArgusActivityEvent & {
            project_id: string;
            dsn_key_id?: number;
          };

          batch.push(this.normalizeActivity(rawEvent));
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
      await this.insertActivities(batch);
      await this.upsertProfiles(batch);
    }

    if (ackIds.length > 0) {
      await this.redis.xack(streamKey, CONSUMER_GROUP, ...ackIds);
    }
  }

  private normalizeActivity(
    event: ArgusActivityEvent & { project_id: string; dsn_key_id?: number }
  ): NormalizedActivity {
    const rawCurrency = event.currency || event.properties?.currency || 'USD';
    const rawAmount = event.amount_usd || event.numeric_properties?.amount || 0;
    
    let amountUsd = 0;
    if (event.event_name === 'purchase' || event.event_name === 'item_purchased') {
      amountUsd = convertToUsd(rawAmount, rawCurrency);
    }

    return {
      event_id: event.event_id,
      project_id: event.project_id,
      timestamp: event.timestamp || new Date().toISOString(),
      event_name: event.event_name || '',
      user_id: event.user_id || event.user?.id || '',
      device_id: event.device_id || '',
      session_id: event.session_id || '',
      platform: event.platform || '',
      environment: event.environment || '',
      release: event.release || '',
      country: event.country || '',
      city: event.city || '',
      os: event.os || '',
      app_version: event.app_version || '',
      properties: event.properties || {},
      numeric_properties: event.numeric_properties || {},
      dsn_key_id: event.dsn_key_id || 0,
      currency: rawCurrency,
      amount_usd: amountUsd,
    };
  }

  private async insertActivities(batch: NormalizedActivity[]): Promise<void> {
    try {
      await optic.insert({
        table: 'argus.activities',
        values: batch,
        format: 'JSONEachRow',
      });
      logger.info('Activities inserted', { count: batch.length });
    } catch (error) {
      logger.error('ClickHouse activities insert failed', {
        count: batch.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Extract profile data from activities and upsert into argus.profiles.
   * Only inserts rows when profile-relevant fields are present.
   * ReplacingMergeTree(updated_at) keeps only the latest row per (project_id, user_id).
   */
  private async upsertProfiles(batch: NormalizedActivity[]): Promise<void> {
    const PROFILE_FIELDS = ['avatar_url', 'email', 'first_name', 'last_name'];

    const profileRows: Array<{
      project_id: string;
      user_id: string;
      avatar_url: string;
      email: string;
      first_name: string;
      last_name: string;
      properties: Record<string, string>;
      updated_at: string;
    }> = [];

    // Deduplicate: keep only the latest event per user_id within this batch
    const latestByUser = new Map<string, NormalizedActivity>();
    for (const act of batch) {
      if (!act.user_id) continue;
      const hasProfileField = PROFILE_FIELDS.some((f) => act.properties[f]);
      if (!hasProfileField) continue;

      const key = `${act.project_id}:${act.user_id}`;
      const existing = latestByUser.get(key);
      if (!existing || act.timestamp > existing.timestamp) {
        latestByUser.set(key, act);
      }
    }

    for (const act of latestByUser.values()) {
      profileRows.push({
        project_id: act.project_id,
        user_id: act.user_id,
        avatar_url: act.properties['avatar_url'] || '',
        email: act.properties['email'] || '',
        first_name: act.properties['first_name'] || '',
        last_name: act.properties['last_name'] || '',
        properties: {},
        updated_at: act.timestamp,
      });
    }

    if (profileRows.length === 0) return;

    try {
      await optic.insert({
        table: 'argus.profiles',
        values: profileRows,
        format: 'JSONEachRow',
      });
      logger.debug('Profiles upserted', { count: profileRows.length });
    } catch (error) {
      // Profile upsert failure should not block activity processing
      logger.error('ClickHouse profiles upsert failed', {
        count: profileRows.length,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
