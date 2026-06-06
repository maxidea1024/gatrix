import Redis from 'ioredis';
import {
  config,
  createLogger,
  ArgusMetricEvent,
  KNOWN_STREAMS,
  CONSUMER_GROUPS,
  pipelineConfig,
} from '@gatrix/argus';
import { optic } from '@gatrix/argus-optic';

const logger = createLogger('metric-worker');

const CONSUMER_GROUP = CONSUMER_GROUPS.METRICS;
const CONSUMER_NAME = `worker-${process.pid}`;
const BATCH_SIZE = 500;

interface NormalizedMetric {
  project_id: string;
  metric_type: string;
  name: string;
  unit: string;
  timestamp: string;
  value_counter: number;
  value_gauge: number;
  value_distribution: number[];
  value_set: string[];
  environment: string;
  release: string;
  tags: Record<string, string>;
}

export class MetricWorker {
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
    logger.info('Metric worker started', {
      consumerGroup: CONSUMER_GROUP,
      consumer: CONSUMER_NAME,
    });

    this.processLoop().catch((error) => {
      logger.error('Metric worker loop crashed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  async close(): Promise<void> {
    this.running = false;
    await this.redis.quit();
    logger.info('Metric worker stopped');
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
    const keys = await this.redis.smembers(KNOWN_STREAMS.METRICS);
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

    const batch: NormalizedMetric[] = [];
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

          const rawEvent = JSON.parse(
            fields[dataIndex + 1]
          ) as ArgusMetricEvent & {
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
        await optic.insert({
          table: 'argus.metrics',
          values: batch,
          format: 'JSONEachRow',
        });
        logger.info('Metrics inserted', { count: batch.length });
      } catch (error) {
        logger.error('ClickHouse metrics insert failed', {
          count: batch.length,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (ackIds.length > 0) {
      await this.redis.xack(streamKey, CONSUMER_GROUP, ...ackIds);
    }
  }

  private normalize(
    event: ArgusMetricEvent & { project_id: string }
  ): NormalizedMetric {
    const value = event.value;

    // Dispatch value into the correct column based on metric_type
    let valueCounter = 0;
    let valueGauge = 0;
    let valueDistribution: number[] = [];
    let valueSet: string[] = [];

    switch (event.metric_type) {
      case 'counter':
        valueCounter = typeof value === 'number' ? value : 0;
        break;
      case 'gauge':
        valueGauge = typeof value === 'number' ? value : 0;
        break;
      case 'distribution':
        valueDistribution = Array.isArray(value) ? (value as number[]) : [];
        break;
      case 'set':
        valueSet = Array.isArray(value) ? (value as string[]) : [];
        break;
    }

    return {
      project_id: event.project_id,
      metric_type: event.metric_type,
      name: event.name,
      unit: event.unit || '',
      timestamp: event.timestamp || new Date().toISOString(),
      value_counter: valueCounter,
      value_gauge: valueGauge,
      value_distribution: valueDistribution,
      value_set: valueSet,
      environment: event.environment || '',
      release: event.release || '',
      tags: event.tags || {},
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
