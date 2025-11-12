/**
 * Event Listener for Redis Pub/Sub
 * Listens to cache invalidation events from Gatrix backend
 * Uses Redis Pub/Sub to ensure all SDK instances receive the same events
 */

import Redis from 'ioredis';
import { Logger } from '../utils/logger';
import { RedisConfig } from '../types/config';
import { StandardEvent, CustomEvent, EventCallback, EventListenerMap } from '../types/events';
import { CacheManager } from './CacheManager';

export class EventListener {
  private logger: Logger;
  private redisConfig: RedisConfig;
  private subscriber?: Redis;
  private eventListeners: EventListenerMap = {};
  private cacheManager: CacheManager;
  private readonly CHANNEL_NAME = 'gatrix-sdk-events';
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 60; // 30 seconds with 500ms interval
  private readonly RECONNECT_INTERVAL = 500; // milliseconds
  private reconnectTimer?: NodeJS.Timeout;

  constructor(redisConfig: RedisConfig, cacheManager: CacheManager, logger: Logger) {
    this.redisConfig = redisConfig;
    this.cacheManager = cacheManager;
    this.logger = logger;
  }

  /**
   * Initialize event listener with retry logic
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing event listener...');

    try {
      // Create subscriber connection for Pub/Sub
      // Suppress ioredis debug logs
      this.subscriber = new Redis({
        host: this.redisConfig.host,
        port: this.redisConfig.port,
        password: this.redisConfig.password,
        db: this.redisConfig.db || 0,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        lazyConnect: true,
        enableReadyCheck: false,
        enableOfflineQueue: false,
        maxRetriesPerRequest: null,
      });

      // Suppress ioredis internal logs
      this.subscriber.on('error', (error) => {
        // Only log actual connection errors, not retry attempts
        if (!error.message.includes('ECONNREFUSED') && !error.message.includes('connect')) {
          this.logger.error('Subscriber error', { error: error.message });
        }
        this.isConnected = false;
        this.setupReconnect();
      });

      this.subscriber.on('close', () => {
        this.logger.warn('Subscriber connection closed');
        this.isConnected = false;
        this.setupReconnect();
      });

      // Connect to Redis
      await this.subscriber.connect();

      // Subscribe to SDK events channel
      await this.subscriber.subscribe(this.CHANNEL_NAME);
      this.logger.info('Event listener connected and subscribed');

      // Handle incoming messages
      this.subscriber.on('message', async (channel, message) => {
        if (channel === this.CHANNEL_NAME) {
          try {
            const event = JSON.parse(message);
            this.logger.info('SDK Event received', { type: event.type, id: event.data?.id });
            await this.processEvent(event);
          } catch (error: any) {
            this.logger.error('Failed to parse event message', { error: error.message });
          }
        }
      });

      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.logger.info('Event listener initialized successfully');
    } catch (error: any) {
      this.logger.error('Failed to initialize event listener', { error: error.message });
      throw error;
    }
  }

  /**
   * Setup reconnection logic
   */
  private setupReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      this.logger.error('Max reconnection attempts reached. Giving up.');
      return;
    }

    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(async () => {
      try {
        // Close existing connection if any
        if (this.subscriber) {
          try {
            this.subscriber.disconnect();
          } catch (e) {
            // Ignore disconnect errors
          }
        }

        // Reinitialize connection
        await this.initialize();

        // After successful reconnection, reinitialize all cache data
        this.logger.info('Event listener reconnected. Reinitializing cache data...');
        await this.reinitializeCache();
      } catch (error: any) {
        // Silently continue on reconnection failures
        this.setupReconnect();
      }
    }, this.RECONNECT_INTERVAL);
  }

  /**
   * Reinitialize all cache data after reconnection
   */
  private async reinitializeCache(): Promise<void> {
    try {
      // Refresh all cache data
      await this.cacheManager.refreshGameWorlds();
      await this.cacheManager.refreshPopupNotices();
      await this.cacheManager.refreshSurveys();

      this.logger.info('Cache reinitialized after reconnection');
    } catch (error: any) {
      this.logger.error('Failed to reinitialize cache', { error: error.message });
      throw error;
    }
  }

  /**
   * Process incoming event
   */
  private async processEvent(event: any): Promise<void> {

    this.logger.debug('Processing event', { type: event.type, data: event.data });

    // Handle standard events (cache invalidation)
    if (this.isStandardEvent(event.type)) {
      try {
        await this.handleStandardEvent(event);
      } catch (error: any) {
        this.logger.error('Failed to handle standard event', {
          type: event.type,
          error: error.message,
        });
        // Continue to emit event even if cache refresh fails
      }
    }

    // Emit to registered listeners
    await this.emitEvent(event);
  }

  /**
   * Check if event type is a standard event
   */
  private isStandardEvent(type: string): boolean {
    return [
      'gameworld.created',
      'gameworld.updated',
      'gameworld.deleted',
      'gameworld.order_changed',
      'popup.created',
      'popup.updated',
      'popup.deleted',
      'survey.created',
      'survey.updated',
      'survey.deleted',
      'survey.settings.updated',
      'maintenance.started',
      'maintenance.ended',
    ].includes(type);
  }

  /**
   * Handle standard cache invalidation events
   */
  private async handleStandardEvent(event: StandardEvent): Promise<void> {
    this.logger.info('Handling standard event', { type: event.type, id: event.data.id });

    switch (event.type) {
      case 'gameworld.created':
      case 'gameworld.updated':
        // Update only the affected game world (immutable)
        // Pass isVisible from event data to avoid unnecessary API calls
        // Convert 0/1 to false/true (MySQL returns TINYINT as 0 or 1)
        const gameWorldIsVisible = event.data.isVisible === 0 ? false : (event.data.isVisible === 1 ? true : event.data.isVisible);
        await this.cacheManager.updateSingleGameWorld(Number(event.data.id), gameWorldIsVisible);
        break;

      case 'gameworld.deleted':
        // Remove the deleted game world from cache (immutable)
        this.cacheManager.removeGameWorld(Number(event.data.id));
        break;

      case 'gameworld.order_changed':
        // Clear entire game worlds cache when order changes
        this.logger.info('Game world order changed, clearing entire cache');
        await this.cacheManager.refreshGameWorlds();
        break;

      case 'popup.created':
      case 'popup.updated':
        // Update only the affected popup notice (immutable)
        // Pass isVisible from event data to avoid unnecessary API calls
        // Convert 0/1 to false/true (MySQL returns TINYINT as 0 or 1)
        const popupIsVisible = event.data.isVisible === 0 ? false : (event.data.isVisible === 1 ? true : event.data.isVisible);
        await this.cacheManager.updateSinglePopupNotice(Number(event.data.id), popupIsVisible);
        break;

      case 'popup.deleted':
        // Remove the deleted popup notice from cache (immutable)
        this.cacheManager.removePopupNotice(Number(event.data.id));
        break;

      case 'survey.created':
      case 'survey.updated':
        // Update only the affected survey (immutable)
        // Pass isActive from event data to avoid unnecessary API calls
        // Convert 0/1 to false/true (MySQL returns TINYINT as 0 or 1)
        const surveyIsActive = event.data.isActive === 0 ? false : (event.data.isActive === 1 ? true : event.data.isActive);
        await this.cacheManager.updateSingleSurvey(String(event.data.id), surveyIsActive);
        break;

      case 'survey.deleted':
        // Remove the deleted survey from cache (immutable)
        this.cacheManager.removeSurvey(String(event.data.id));
        break;

      case 'survey.settings.updated':
        // Refresh survey settings only when configuration changes
        this.logger.info('Survey settings updated event received, refreshing settings', {
          eventData: event.data,
        });
        try {
          await this.cacheManager.refreshSurveySettings();
          this.logger.info('Survey settings refreshed successfully');
        } catch (error) {
          this.logger.error('Failed to refresh survey settings', { error });
        }
        break;

      case 'maintenance.started':
      case 'maintenance.ended':
        // Maintenance events don't require cache refresh
        this.logger.debug('Maintenance event received', { type: event.type });
        break;

      default:
        this.logger.warn('Unknown standard event type', { type: event.type });
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

    if (this.subscriber) {
      await this.subscriber.unsubscribe(this.CHANNEL_NAME);
      await this.subscriber.quit();
      this.subscriber = undefined;
    }

    this.removeAllListeners();

    this.logger.info('Event listener closed');
  }
}

