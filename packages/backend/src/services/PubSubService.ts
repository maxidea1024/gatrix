import { EventEmitter } from 'events';
import { Queue, Worker, Job } from 'bullmq';
import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import redisClient from '../config/redis';
import logger from '../config/logger';
import { cacheService } from './CacheService';

export interface CacheInvalidationMessage {
  type: 'invalidate' | 'clear';
  pattern?: string;
  key?: string;
  timestamp: number;
}

// Cross-instance SSE notification payload
export interface SSENotificationBusMessage {
  type: string;
  data: any;
  timestamp?: number; // epoch ms
  targetUsers?: number[];
  targetChannels?: string[];
  excludeUsers?: number[];
  originServerId?: string;
}

export class PubSubService extends EventEmitter {
  private cacheQueue: Queue | null = null;
  private cacheWorker: Worker | null = null;

  // SSE notification queue/worker (legacy - replaced by Redis Pub/Sub for broadcast)
  private sseQueue: Queue | null = null;
  private sseWorker: Worker | null = null;

  // SDK events queue
  private sdkEventsQueue: Queue | null = null;

  // Redis Pub/Sub for SSE broadcast
  private sseSubscriber: RedisClientType | null = null;
  private readonly SSE_CHANNEL = 'sse:notifications';

  private isConnected = false;
  private readonly QUEUE_NAME = 'cache-invalidation';
  private readonly SSE_QUEUE_NAME = 'sse-notifications';

  constructor() {
    super();
    // Don't initialize in constructor to avoid Promise issues
  }

  /**
   * Initialize BullMQ queue and worker
   */
  public async initialize(): Promise<void> {
    try {
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        // BullMQ requires maxRetriesPerRequest to be null on Node-Redis v4
        maxRetriesPerRequest: null as any,
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
      };

      // Create cache invalidation queue
      this.cacheQueue = new Queue(this.QUEUE_NAME, {
        connection: redisConfig,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      });

      // Create worker to process cache invalidation jobs
      this.cacheWorker = new Worker(
        this.QUEUE_NAME,
        async (job: Job<CacheInvalidationMessage>) => {
          await this.processCacheInvalidation(job.data);
        },
        {
          connection: redisConfig,
          concurrency: 5,
        }
      );

      // [Deprecated path] Create SSE notification queue (kept for backward compatibility; not used for broadcast)
      this.sseQueue = new Queue(this.SSE_QUEUE_NAME, {
        connection: redisConfig,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      });

      // [Deprecated path] Worker remains for compatibility but not relied on for broadcast
      this.sseWorker = new Worker(
        this.SSE_QUEUE_NAME,
        async (job: Job<SSENotificationBusMessage>) => {
          await this.processSSENotification(job.data);
        },
        {
          connection: redisConfig,
          concurrency: 10,
        }
      );

      // [Deprecated] SDK events queue replaced with Redis Pub/Sub
      // This ensures all SDK instances receive the same events in real-time
      // Previously: BullMQ queue (only one worker would process each job)
      // Now: Redis Pub/Sub (all subscribers receive the event)
      // this.sdkEventsQueue = new Queue(this.SDK_EVENTS_QUEUE_NAME, {
      //   connection: redisConfig,
      //   defaultJobOptions: {
      //     removeOnComplete: 100,
      //     removeOnFail: 50,
      //     attempts: 1,
      //   },
      // });

      logger.info('SDK events will be published via Redis Pub/Sub');

      // New: Redis Pub/Sub subscriber for true broadcast to all instances
      try {
        this.sseSubscriber = createClient({
          socket: { host: config.redis.host, port: config.redis.port },
          password: config.redis.password || undefined,
        });
        await this.sseSubscriber.connect();
        await this.sseSubscriber.subscribe(this.SSE_CHANNEL, (payload: string) => {
          try {
            const message = JSON.parse(payload) as SSENotificationBusMessage;
            this.emit('sse-notification', message);
          } catch (err) {
            logger.error('Failed to parse SSE Pub/Sub message:', err);
          }
        });
        logger.info(`Subscribed to Redis channel: ${this.SSE_CHANNEL}`);
      } catch (err) {
        logger.warn(
          'Failed to initialize Redis Pub/Sub for SSE; falling back to BullMQ path only',
          err
        );
      }

      // Setup event handlers - cache
      this.cacheQueue.on('error', (error: Error) => {
        logger.error('Cache queue error:', error);
      });
      this.cacheWorker.on('error', (error: Error) => {
        logger.error('Cache worker error:', error);
      });
      this.cacheWorker.on('completed', (job: Job) => {
        logger.debug('Cache invalidation job completed:', job.id);
      });
      this.cacheWorker.on('failed', (job: Job | undefined, error: Error) => {
        logger.error('Cache invalidation job failed:', {
          jobId: job?.id,
          error: error.message,
        });
      });

      // Setup event handlers - sse
      this.sseQueue.on('error', (error: Error) => {
        logger.error('SSE queue error:', error);
      });
      this.sseWorker.on('error', (error: Error) => {
        logger.error('SSE worker error:', error);
      });
      this.sseWorker.on('completed', (job: Job) => {
        logger.debug('SSE notification job completed:', job.id);
      });
      this.sseWorker.on('failed', (job: Job | undefined, error: Error) => {
        logger.error('SSE notification job failed:', {
          jobId: job?.id,
          error: error.message,
        });
      });

      this.isConnected = true;
      logger.info('PubSub service initialized successfully with BullMQ');
    } catch (error) {
      logger.error('Failed to initialize PubSub service:', error);
      // Continue without Redis - cache will still work locally
      this.isConnected = false;
    }
  }

  /**
   * Process cache invalidation job
   */
  private async processCacheInvalidation(data: CacheInvalidationMessage): Promise<void> {
    try {
      // Ignore old messages (older than 30 seconds)
      if (Date.now() - data.timestamp > 30_000) {
        logger.debug('Ignoring old cache invalidation message:', data);
        return;
      }

      switch (data.type) {
        case 'clear':
          await cacheService.clear();
          break;
        case 'invalidate':
          if (data.pattern) {
            await cacheService.deleteByPattern(data.pattern);
          } else if (data.key) {
            await cacheService.delete(data.key);
          }
          break;
      }

      logger.debug('Cache invalidation processed:', data);
    } catch (error: any) {
      logger.error('Failed to process cache invalidation message:', error);
      throw error; // Re-throw to trigger job retry
    }
  }

  /**
   * Process SSE notification job and emit locally
   */
  private async processSSENotification(message: SSENotificationBusMessage): Promise<void> {
    try {
      // Ignore very old messages (older than 2 minutes)
      const ts = message.timestamp ?? Date.now();
      if (Date.now() - ts > 120_000) {
        logger.debug('Ignoring old SSE notification:', message.type);
        return;
      }
      // Emit for local fan-out (index.ts will bridge to SSENotificationService)
      this.emit('sse-notification', message);
    } catch (error: any) {
      logger.error('Failed to process SSE notification message:', error);
      throw error;
    }
  }

  /**
   * Add cache invalidation job to queue
   */
  private async addCacheInvalidationJob(
    message: Omit<CacheInvalidationMessage, 'timestamp'>
  ): Promise<void> {
    if (!this.isConnected || !this.cacheQueue) {
      logger.warn('PubSub not connected, skipping cache invalidation broadcast');
      return;
    }

    try {
      const fullMessage: CacheInvalidationMessage = {
        ...message,
        timestamp: Date.now(),
      };

      await this.cacheQueue.add('invalidate-cache', fullMessage, {
        priority: 10, // High priority for cache invalidation
        delay: 0,
      });

      logger.debug('Cache invalidation job added:', fullMessage);
    } catch (error: any) {
      logger.error('Failed to add cache invalidation job:', error);
    }
  }

  /**
   * Add SSE notification job to queue
   */
  private async addSSEJob(message: SSENotificationBusMessage): Promise<void> {
    if (!this.isConnected || !this.sseQueue) {
      logger.warn('PubSub not connected, skipping SSE notification broadcast');
      return;
    }

    try {
      const fullMessage: SSENotificationBusMessage = {
        ...message,
        timestamp: message.timestamp ?? Date.now(),
      };

      await this.sseQueue.add('sse-notify', fullMessage, {
        priority: 5,
        delay: 0,
      });

      logger.debug('SSE notification job added:', { type: fullMessage.type });
    } catch (error: any) {
      logger.error('Failed to add SSE notification job:', error);
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateByPattern(pattern: string): Promise<void> {
    // Invalidate local cache immediately (L1 + Registry)
    await cacheService.deleteByPattern(pattern);

    // Direct Redis deletion to handle persistent keys that might not be in local registry (e.g. after restart)
    try {
      const client = redisClient.getClient();
      if (client && client.isOpen) {
        // Keyv default namespace is 'keyv'
        // We need to match 'keyv:pattern'
        // Note: This assumes default Keyv namespace. If CacheService changes, this needs update.
        const keyvPattern = `keyv:${pattern}`;

        // Use KEYS to find matching keys (Note: SCAN would be better for massive datasets but KEYS is acceptable here for administrative ops)
        const keys = await client.keys(keyvPattern);

        if (keys.length > 0) {
          await client.del(keys);
          logger.info(
            `Direct Redis invalidation: deleted ${keys.length} keys matching ${keyvPattern}`
          );
        }
      }
    } catch (error) {
      logger.error('Failed to perform direct Redis invalidation:', error);
    }

    // Broadcast to other instances via queue
    await this.addCacheInvalidationJob({
      type: 'invalidate',
      pattern,
    });
  }

  /**
   * Invalidate specific cache key
   */
  async invalidateKey(key: string): Promise<void> {
    logger.debug(`Cache invalidation requested for key: ${key}`);

    // Invalidate local cache immediately
    await cacheService.delete(key);
    logger.debug(`Local cache deleted for key: ${key}`);

    // Broadcast to other instances via queue
    await this.addCacheInvalidationJob({
      type: 'invalidate',
      key,
    });
    logger.debug(`Cache invalidation job queued for key: ${key}`);
  }

  /**
   * Clear all cache
   */
  async clearAll(): Promise<void> {
    // Clear local cache immediately
    await cacheService.clear();

    // Broadcast to other instances via queue
    await this.addCacheInvalidationJob({
      type: 'clear',
    });
  }

  /**
   * Publish SSE notification to all instances via Redis Pub/Sub (broadcast)
   */
  async publishNotification(message: Omit<SSENotificationBusMessage, 'timestamp'>): Promise<void> {
    try {
      const fullMessage: SSENotificationBusMessage = {
        ...message,
        timestamp: (message as any).timestamp ?? Date.now(),
      };
      const client = redisClient.getClient();
      await client.publish(this.SSE_CHANNEL, JSON.stringify(fullMessage));
      logger.debug('SSE notification published to channel', {
        type: fullMessage.type,
      });
    } catch (error: any) {
      logger.error('Failed to publish SSE notification via Redis Pub/Sub:', error);
      // Fallback: enqueue to BullMQ for at-least-once delivery (not broadcast)
      await this.addSSEJob(message as SSENotificationBusMessage);
    }
  }

  /**
   * Convert MySQL 0/1 to boolean for isVisible and isActive fields
   */
  private convertBooleanFields(data: any): any {
    const converted = { ...data };
    if (converted.isVisible !== undefined) {
      converted.isVisible = converted.isVisible === 1 || converted.isVisible === true;
    }
    if (converted.isActive !== undefined) {
      converted.isActive = converted.isActive === 1 || converted.isActive === true;
    }
    return converted;
  }

  /**
   * Publish SDK event to Redis Pub/Sub for real-time delivery to all SDK instances
   * Uses Pub/Sub instead of BullMQ queue to ensure all subscribers receive the event
   */
  async publishSDKEvent(event: { type: string; data: Record<string, any> }): Promise<void> {
    try {
      // Convert MySQL 0/1 to boolean
      const convertedEvent = {
        ...event,
        data: this.convertBooleanFields(event.data),
      };

      // Publish to Redis Pub/Sub channel so all SDK instances receive the event
      const client = redisClient.getClient();
      const eventJson = JSON.stringify(convertedEvent);

      logger.info('Publishing SDK event to Pub/Sub', {
        type: convertedEvent.type,
        id: convertedEvent.data.id,
        channel: 'gatrix-sdk-events',
      });

      const numSubscribers = await client.publish('gatrix-sdk-events', eventJson);

      logger.info('SDK event published to Pub/Sub', {
        type: convertedEvent.type,
        id: convertedEvent.data.id,
        numSubscribers,
        messageLength: eventJson.length,
      });
    } catch (error: any) {
      logger.error('Failed to publish SDK event:', error);
    }
  }

  /**
   * Publish standard event (for SDK real-time events like maintenance.started, maintenance.ended)
   */
  async publishEvent(event: {
    type: string;
    data: { id: number | string; timestamp: number; [key: string]: any };
  }): Promise<void> {
    try {
      const client = redisClient.getClient();
      const eventChannel = 'gatrix-sdk-events';
      await client.publish(eventChannel, JSON.stringify(event));
      logger.info('Standard event published to SDK channel', {
        type: event.type,
        id: event.data.id,
        channel: eventChannel,
      });
    } catch (error: any) {
      logger.error('Failed to publish standard event:', error);
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<any> {
    if (!this.cacheQueue) {
      return null;
    }

    try {
      const [waiting, active, completed, failed] = await Promise.all([
        this.cacheQueue.getWaiting(),
        this.cacheQueue.getActive(),
        this.cacheQueue.getCompleted(),
        this.cacheQueue.getFailed(),
      ]);

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        total: waiting.length + active.length + completed.length + failed.length,
      };
    } catch (error: any) {
      logger.error('Failed to get queue stats:', error);
      return null;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    try {
      if (this.cacheWorker) {
        await this.cacheWorker.close();
      }
      if (this.cacheQueue) {
        await this.cacheQueue.close();
      }

      if (this.sseWorker) {
        await this.sseWorker.close();
      }
      if (this.sseQueue) {
        await this.sseQueue.close();
      }

      if (this.sdkEventsQueue) {
        await this.sdkEventsQueue.close();
      }

      if (this.sseSubscriber) {
        try {
          await this.sseSubscriber.unsubscribe(this.SSE_CHANNEL);
        } catch (error: any) {
          // Ignore unsubscribe errors during shutdown
        }
        try {
          await this.sseSubscriber.disconnect();
        } catch (error: any) {
          // Ignore disconnect errors during shutdown
        }
        this.sseSubscriber = null;
      }

      this.isConnected = false;
      logger.info('PubSub service shutdown completed');
    } catch (error: any) {
      logger.error('Error during PubSub shutdown:', error);
    }
  }

  /**
   * Get connection status
   */
  isReady(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
export const pubSubService = new PubSubService();
