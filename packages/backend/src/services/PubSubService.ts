import { EventEmitter } from 'events';
import { Queue, Worker, Job } from 'bullmq';
import logger from '../config/logger';
import { cacheService } from './CacheService';

export interface CacheInvalidationMessage {
  type: 'invalidate' | 'clear';
  pattern?: string;
  key?: string;
  timestamp: number;
}

export class PubSubService extends EventEmitter {
  private cacheQueue: Queue | null = null;
  private cacheWorker: Worker | null = null;
  private isConnected = false;
  private readonly QUEUE_NAME = 'cache-invalidation';

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

      // Setup event handlers
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
        logger.error('Cache invalidation job failed:', { jobId: job?.id, error: error.message });
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
          cacheService.clear();
          break;
        case 'invalidate':
          if (data.pattern) {
            cacheService.deleteByPattern(data.pattern);
          } else if (data.key) {
            cacheService.delete(data.key);
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
   * Add cache invalidation job to queue
   */
  private async addCacheInvalidationJob(message: Omit<CacheInvalidationMessage, 'timestamp'>): Promise<void> {
    if (!this.isConnected || !this.cacheQueue) {
      logger.warn('PubSub not connected, skipping cache invalidation broadcast');
      return;
    }

    try {
      const fullMessage: CacheInvalidationMessage = {
        ...message,
        timestamp: Date.now()
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
   * Invalidate cache by pattern
   */
  async invalidateByPattern(pattern: string): Promise<void> {
    // Invalidate local cache immediately
    cacheService.deleteByPattern(pattern);

    // Broadcast to other instances via queue
    await this.addCacheInvalidationJob({
      type: 'invalidate',
      pattern
    });
  }

  /**
   * Invalidate specific cache key
   */
  async invalidateKey(key: string): Promise<void> {
    logger.debug(`Cache invalidation requested for key: ${key}`);

    // Invalidate local cache immediately
    cacheService.delete(key);
    logger.debug(`Local cache deleted for key: ${key}`);

    // Broadcast to other instances via queue
    await this.addCacheInvalidationJob({
      type: 'invalidate',
      key
    });
    logger.debug(`Cache invalidation job queued for key: ${key}`);
  }

  /**
   * Clear all cache
   */
  async clearAll(): Promise<void> {
    // Clear local cache immediately
    cacheService.clear();

    // Broadcast to other instances via queue
    await this.addCacheInvalidationJob({
      type: 'clear'
    });
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
