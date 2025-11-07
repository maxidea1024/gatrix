/**
 * Event Listener for BullMQ
 * Listens to cache invalidation events from Gatrix backend
 */

import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { Logger } from '../utils/logger';
import { RedisConfig } from '../types/config';
import { StandardEvent, CustomEvent, EventCallback, EventListenerMap } from '../types/events';
import { CacheManager } from './CacheManager';

export class EventListener {
  private logger: Logger;
  private redisConfig: RedisConfig;
  private worker?: Worker;
  private eventListeners: EventListenerMap = {};
  private cacheManager: CacheManager;

  constructor(redisConfig: RedisConfig, cacheManager: CacheManager, logger: Logger) {
    this.redisConfig = redisConfig;
    this.cacheManager = cacheManager;
    this.logger = logger;
  }

  /**
   * Initialize event listener
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing event listener...');

    try {
      const connection = new Redis({
        host: this.redisConfig.host,
        port: this.redisConfig.port,
        password: this.redisConfig.password,
        db: this.redisConfig.db || 0,
        maxRetriesPerRequest: null,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      // Create worker to listen to SDK events queue
      this.worker = new Worker(
        'gatrix-sdk-events',
        async (job: Job) => {
          await this.processEvent(job);
        },
        {
          connection,
          concurrency: 5,
        }
      );

      this.worker.on('completed', (job) => {
        this.logger.debug('Event processed', { jobId: job.id });
      });

      this.worker.on('failed', (job, error) => {
        this.logger.error('Event processing failed', {
          jobId: job?.id,
          error: error.message,
        });
      });

      this.worker.on('error', (error) => {
        this.logger.error('Worker error', { error: error.message });
      });

      this.logger.info('Event listener initialized successfully');
    } catch (error: any) {
      this.logger.error('Failed to initialize event listener', { error: error.message });
      throw error;
    }
  }

  /**
   * Process incoming event
   */
  private async processEvent(job: Job): Promise<void> {
    const event = job.data;

    this.logger.debug('Processing event', { type: event.type, data: event.data });

    // Handle standard events (cache invalidation)
    if (this.isStandardEvent(event.type)) {
      await this.handleStandardEvent(event);
    }

    // Emit to registered listeners
    await this.emitEvent(event);
  }

  /**
   * Check if event type is a standard event
   */
  private isStandardEvent(type: string): boolean {
    return [
      'gameworld.updated',
      'gameworld.deleted',
      'popup.updated',
      'popup.deleted',
      'survey.updated',
      'survey.deleted',
    ].includes(type);
  }

  /**
   * Handle standard cache invalidation events
   */
  private async handleStandardEvent(event: StandardEvent): Promise<void> {
    this.logger.info('Handling standard event', { type: event.type, id: event.data.id });

    try {
      switch (event.type) {
        case 'gameworld.updated':
        case 'gameworld.deleted':
          await this.cacheManager.refreshGameWorlds();
          break;

        case 'popup.updated':
        case 'popup.deleted':
          await this.cacheManager.refreshPopupNotices();
          break;

        case 'survey.updated':
        case 'survey.deleted':
          await this.cacheManager.refreshSurveys();
          break;

        default:
          this.logger.warn('Unknown standard event type', { type: event.type });
      }
    } catch (error: any) {
      this.logger.error('Failed to handle standard event', {
        type: event.type,
        error: error.message,
      });
    }
  }

  /**
   * Emit event to registered listeners
   */
  private async emitEvent(event: StandardEvent | CustomEvent): Promise<void> {
    const listeners = this.eventListeners[event.type] || [];
    const wildcardListeners = this.eventListeners['*'] || [];

    const allListeners = [...listeners, ...wildcardListeners];

    if (allListeners.length === 0) {
      return;
    }

    this.logger.debug('Emitting event to listeners', {
      type: event.type,
      listenerCount: allListeners.length,
    });

    for (const listener of allListeners) {
      try {
        await listener(event);
      } catch (error: any) {
        this.logger.error('Event listener error', {
          type: event.type,
          error: error.message,
        });
      }
    }
  }

  /**
   * Register event listener
   */
  on(eventType: string, callback: EventCallback): void {
    if (!this.eventListeners[eventType]) {
      this.eventListeners[eventType] = [];
    }

    this.eventListeners[eventType].push(callback);

    this.logger.debug('Event listener registered', { eventType });
  }

  /**
   * Unregister event listener
   */
  off(eventType: string, callback: EventCallback): void {
    if (!this.eventListeners[eventType]) {
      return;
    }

    this.eventListeners[eventType] = this.eventListeners[eventType].filter(
      (cb) => cb !== callback
    );

    this.logger.debug('Event listener unregistered', { eventType });
  }

  /**
   * Unregister all listeners for an event type
   */
  removeAllListeners(eventType?: string): void {
    if (eventType) {
      delete this.eventListeners[eventType];
      this.logger.debug('All listeners removed for event type', { eventType });
    } else {
      this.eventListeners = {};
      this.logger.debug('All event listeners removed');
    }
  }

  /**
   * Close event listener and cleanup
   */
  async close(): Promise<void> {
    this.logger.info('Closing event listener...');

    if (this.worker) {
      await this.worker.close();
      this.worker = undefined;
    }

    this.removeAllListeners();

    this.logger.info('Event listener closed');
  }
}

