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
import { SdkMetrics } from '../utils/sdkMetrics';

export class EventListener {
  private logger: Logger;
  private redisConfig: RedisConfig;
  private subscriber?: Redis;
  private eventListeners: EventListenerMap = {};
  private cacheManager: CacheManager;
  private readonly CHANNEL_NAME = 'gatrix-sdk-events';
  private isConnected: boolean = false;
  // Flag to suppress noisy logs during intentional shutdown
  private isShuttingDown: boolean = false;
  private metrics?: SdkMetrics;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 60; // 30 seconds with 500ms interval
  private readonly RECONNECT_INTERVAL = 500; // milliseconds
  private reconnectTimer?: NodeJS.Timeout;

  constructor(redisConfig: RedisConfig, cacheManager: CacheManager, logger: Logger, metrics?: SdkMetrics) {
    this.redisConfig = redisConfig;
    this.cacheManager = cacheManager;
    this.logger = logger;
    this.metrics = metrics;
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
          // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
          const delay = Math.min(Math.pow(2, times - 1) * 1000, 30000);
          return delay;
        },
        lazyConnect: true,
        enableReadyCheck: false,
        // Keep commands during disconnects so we don't throw 'Connection is closed'
        enableOfflineQueue: true,
        maxRetriesPerRequest: null,
        // Ensure automatic re-subscription after reconnect
        autoResubscribe: true,
      });

      // Suppress ioredis internal logs
      this.subscriber.on('error', (error) => {
        if (this.isShuttingDown) {
          // Avoid noisy error logs during intentional shutdown
          this.isConnected = false;
          try { this.metrics?.setRedisConnected(false); } catch (_) { }
          return;
        }
        // Only log actual connection errors, not retry attempts
        if (!error.message.includes('ECONNREFUSED') && !error.message.includes('connect')) {
          this.logger.error('Subscriber error', { error: error.message });
        }
        // Mark as disconnected but do not attempt manual reconnect here
        // ioredis will handle reconnection automatically with retryStrategy
        this.isConnected = false;
        try { this.metrics?.setRedisConnected(false); } catch (_) { }
      });

      this.subscriber.on('close', () => {
        if (this.isShuttingDown) {
          // Avoid noisy close logs during intentional shutdown
          this.isConnected = false;
          try { this.metrics?.setRedisConnected(false); } catch (_) { }
          return;
        }
        this.logger.warn('Subscriber connection closed');
        // Mark as disconnected; rely on ioredis auto-reconnect
        this.isConnected = false;
        try { this.metrics?.setRedisConnected(false); } catch (_) { }
      });

      // Log reconnection attempts and refresh cache once reconnected
      this.subscriber.on('reconnecting', (time: number) => {
        this.logger.warn('Subscriber reconnecting...', { delay: time });
      });

      // Track if this is the first connection (to skip reinitializeCache on initial connect)
      let isFirstConnection = true;

      this.subscriber.on('ready', async () => {
        if (!this.isConnected) {
          this.isConnected = true;

          // Only reinitialize cache on reconnection, not on first connect
          // (CacheManager.initialize() already loads initial data)
          if (!isFirstConnection) {
            this.logger.info('Redis connection restored successfully');
            try { this.metrics?.setRedisConnected(true); this.metrics?.incRedisReconnect(); } catch (_) { }
            try {
              await this.reinitializeCache();
            } catch {
              // Errors are already logged inside reinitializeCache
            }
          }
        }
      });

      // Connect to Redis
      await this.subscriber.connect();
      isFirstConnection = false; // Mark first connection complete
      try { this.metrics?.setRedisConnected(true); } catch (_) { }

      // Subscribe to SDK events channel
      await this.subscriber.subscribe(this.CHANNEL_NAME);
      this.logger.info('Event listener connected and subscribed');

      // Handle incoming messages
      this.subscriber.on('message', async (channel, message) => {
        if (channel === this.CHANNEL_NAME) {
          try {
            const event = JSON.parse(message);
            this.logger.info('SDK Event received', { type: event.type, id: event.data?.id });
            try { this.metrics?.incEventReceived(event.type); } catch (_) { }
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
          } catch (_e) {
            // Ignore disconnect errors
          }
        }

        // Reinitialize connection
        await this.initialize();

        // After successful reconnection, reinitialize all cache data
        this.logger.info('Event listener reconnected. Reinitializing cache data...');
        await this.reinitializeCache();
      } catch (_error: any) {
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
      await this.cacheManager.refreshWhitelists();
      await this.cacheManager.refreshServiceMaintenance();

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
   * Note: maintenance.started and maintenance.ended are NOT included here
   * because they are local events emitted by MaintenanceWatcher, not backend events
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
      'maintenance.settings.updated',
      'whitelist.updated',
      'client_version.updated',
      'banner.created',
      'banner.updated',
      'banner.deleted',
      'service_notice.updated',
      'store_product.created',
      'store_product.updated',
      'store_product.deleted',
      'environment.created',
      'environment.deleted',
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
        await this.cacheManager.updateSingleGameWorld(Number(event.data.id), event.data.environment, gameWorldIsVisible);
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
        await this.cacheManager.updateSinglePopupNotice(Number(event.data.id), event.data.environment, popupIsVisible);
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
        await this.cacheManager.updateSingleSurvey(String(event.data.id), event.data.environment, surveyIsActive);
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

      case 'whitelist.updated':
        // Refresh whitelist cache when whitelist is updated
        this.logger.info('Whitelist updated event received, refreshing whitelist cache');
        try {
          await this.cacheManager.refreshWhitelists();
          this.logger.info('Whitelist cache refreshed successfully');
        } catch (error) {
          this.logger.error('Failed to refresh whitelist cache', { error });
        }
        break;

      case 'maintenance.settings.updated':
        // Refresh service maintenance cache when maintenance settings are updated
        // Note: This will also trigger MaintenanceWatcher to check state changes
        // and emit maintenance.started/maintenance.ended events if needed
        this.logger.info('Service maintenance settings updated event received, refreshing service maintenance cache');
        try {
          await this.cacheManager.refreshServiceMaintenance();
          this.logger.info('Service maintenance cache refreshed successfully');
        } catch (error) {
          this.logger.error('Failed to refresh service maintenance cache', { error });
        }
        break;

      case 'client_version.updated': {
        const features = this.cacheManager.getFeatures();
        if (features.clientVersion !== true) {
          this.logger.debug('Client version event ignored - feature is disabled', { event: event.type });
          break;
        }
        this.logger.info('Client version updated event received, refreshing client version cache', {
          id: event.data.id,
          environment: event.data.environment
        });
        try {
          await this.cacheManager.getClientVersionService()?.refresh();
          this.logger.info('Client version cache refreshed successfully');
        } catch (error: any) {
          this.logger.error('Failed to refresh client version cache', { error: error.message });
        }
        break;
      }

      case 'banner.created':
      case 'banner.updated': {
        const features = this.cacheManager.getFeatures();
        if (features.banner !== true) {
          this.logger.debug('Banner event ignored - feature is disabled', { event: event.type });
          break;
        }
        // Update only the affected banner (immutable)
        // Pass status from event data to avoid unnecessary API calls
        const bannerStatus = event.data.status as string | undefined;
        await this.cacheManager.updateSingleBanner(
          String(event.data.id),
          event.data.environment,
          bannerStatus
        );
        break;
      }

      case 'banner.deleted': {
        const features = this.cacheManager.getFeatures();
        if (features.banner !== true) {
          this.logger.debug('Banner event ignored - feature is disabled', { event: event.type });
          break;
        }
        // Remove the deleted banner from cache (immutable)
        this.cacheManager.removeBanner(String(event.data.id), event.data.environment);
        break;
      }

      case 'service_notice.updated': {
        const features = this.cacheManager.getFeatures();
        if (features.serviceNotice !== true) {
          this.logger.debug('Service notice event ignored - feature is disabled', { event: event.type });
          break;
        }
        this.logger.info('Service notice updated event received, refreshing service notice cache', {
          id: event.data.id,
          environment: event.data.environment
        });
        try {
          await this.cacheManager.getServiceNoticeService()?.refresh();
          this.logger.info('Service notice cache refreshed successfully');
        } catch (error: any) {
          this.logger.error('Failed to refresh service notice cache', { error: error.message });
        }
        break;
      }

      case 'store_product.created':
      case 'store_product.updated': {
        const features = this.cacheManager.getFeatures();
        if (features.storeProduct !== true) {
          this.logger.debug('Store product event ignored - feature is disabled', { event: event.type });
          break;
        }
        // Update only the affected store product (immutable)
        // Pass isActive from event data to avoid unnecessary API calls
        // Convert 0/1 to false/true (MySQL returns TINYINT as 0 or 1)
        const productIsActive = event.data.isActive === 0 ? false : (event.data.isActive === 1 ? true : event.data.isActive);
        await this.cacheManager.updateSingleStoreProduct(
          String(event.data.id),
          event.data.environment,
          productIsActive
        );
        break;
      }

      case 'store_product.deleted': {
        const features = this.cacheManager.getFeatures();
        if (features.storeProduct !== true) {
          this.logger.debug('Store product event ignored - feature is disabled', { event: event.type });
          break;
        }
        // Remove the deleted store product from cache (immutable)
        this.cacheManager.removeStoreProduct(String(event.data.id), event.data.environment);
        break;
      }

      case 'environment.created':
      case 'environment.deleted':
        // When environments are added or removed, refresh environment list and load/clear data
        // This is essential for "all environments" mode (environments: '*')
        this.logger.info('Environment change event received', {
          type: event.type,
          environment: event.data.environment
        });
        try {
          const result = await this.cacheManager.refreshEnvironmentList();
          this.logger.info('Environment list refreshed after environment change', {
            added: result.added,
            removed: result.removed
          });
        } catch (error: any) {
          this.logger.error('Failed to refresh environment list after environment change', { error: error.message });
        }
        break;

      // Note: maintenance.started and maintenance.ended are NOT handled here
      // They are local events emitted by MaintenanceWatcher based on cache state changes

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

    // Convert to SdkEvent format (timestamp as ISO8601 string)
    const sdkEvent = {
      type: event.type,
      data: event.data,
      timestamp: new Date().toISOString(),
    };

    for (const listener of allListeners) {
      try {
        await listener(sdkEvent);
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
   * Returns a function to unregister the listener
   */
  on(eventType: string, callback: EventCallback): () => void {
    if (!this.eventListeners[eventType]) {
      this.eventListeners[eventType] = [];
    }

    this.eventListeners[eventType].push(callback);

    this.logger.debug('Event listener registered', { eventType });

    // Return a function to unregister this specific listener
    return () => {
      this.off(eventType, callback);
    };
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
   * Publish an event to all SDK instances via Redis Pub/Sub
   * Used for custom events from game servers
   */
  async publishEvent(event: StandardEvent | CustomEvent): Promise<void> {
    if (!this.subscriber) {
      throw new Error('Event listener not initialized');
    }

    try {
      const message = JSON.stringify(event);
      await this.subscriber.publish(this.CHANNEL_NAME, message);
      this.logger.debug('Event published', { type: event.type });
      try { this.metrics?.incEventPublished(event.type); } catch (_) { }
    } catch (error: any) {
      this.logger.error('Failed to publish event', {
        type: event.type,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Check if service is currently in maintenance
   */
  /**
   * Close event listener and cleanup
   */
  async close(): Promise<void> {
    this.logger.info('Closing event listener...');

    // Mark as shutting down to suppress noisy connection logs
    this.isShuttingDown = true;
    this.isConnected = false;
    try { this.metrics?.setRedisConnected(false); } catch (_) { }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.subscriber) {
      await this.subscriber.unsubscribe(this.CHANNEL_NAME);
      await this.subscriber.quit();
      this.subscriber = undefined;
    }

    this.removeAllListeners();

    this.logger.info('Event listener closed');
  }
}
