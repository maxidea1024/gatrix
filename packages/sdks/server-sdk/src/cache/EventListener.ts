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
      // Refresh all cache data using refreshAll which handles all environments
      await this.cacheManager.refreshAll();

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
        // Update last refreshed timestamp since we successfully processed an event
        this.cacheManager.updateLastRefreshedAt();
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
    return !type.startsWith('local.') && !type.startsWith('custom.');
  }

  /**
   * Handle standard cache invalidation events
   * All event handlers check feature flags before processing
   */
  private async handleStandardEvent(event: StandardEvent): Promise<void> {
    this.logger.info('Handling standard event', { type: event.type, id: event.data.id });

    const features = this.cacheManager.getFeatures();

    switch (event.type) {
      case 'gameworld.created':
      case 'gameworld.updated': {
        if (features.gameWorld === false) {
          this.logger.debug('Game world event ignored - feature is disabled', { event: event.type });
          break;
        }
        // Update only the affected game world (immutable)
        // Pass isVisible from event data to avoid unnecessary API calls
        // Convert 0/1 to false/true (MySQL returns TINYINT as 0 or 1)
        const gwEnv = event.data.environment as string;
        if (!gwEnv) {
          this.logger.warn('Game world event missing environment', { event: event.type });
          break;
        }
        const gameWorldIsVisible = event.data.isVisible === 0 ? false : (event.data.isVisible === 1 ? true : event.data.isVisible);
        await this.cacheManager.updateSingleGameWorld(Number(event.data.id), gwEnv, gameWorldIsVisible);
        break;
      }

      case 'gameworld.deleted': {
        if (features.gameWorld === false) {
          this.logger.debug('Game world event ignored - feature is disabled', { event: event.type });
          break;
        }
        // Remove the deleted game world from cache (immutable)
        const gwDeleteEnv = event.data.environment as string;
        if (!gwDeleteEnv) {
          this.logger.warn('Game world deleted event missing environment', { event: event.type });
          break;
        }
        this.cacheManager.removeGameWorld(Number(event.data.id), gwDeleteEnv);
        break;
      }

      case 'gameworld.order_changed': {
        if (features.gameWorld === false) {
          this.logger.debug('Game world event ignored - feature is disabled', { event: event.type });
          break;
        }
        // Clear entire game worlds cache when order changes
        const gwOrderEnv = event.data.environment as string;
        if (!gwOrderEnv) {
          this.logger.warn('Game world order changed event missing environment', { event: event.type });
          break;
        }
        this.logger.info('Game world order changed, refreshing cache', { environment: gwOrderEnv });
        await this.cacheManager.refreshGameWorlds(gwOrderEnv);
        break;
      }

      case 'popup.created':
      case 'popup.updated': {
        if (features.popupNotice === false) {
          this.logger.debug('Popup notice event ignored - feature is disabled', { event: event.type });
          break;
        }
        // Update only the affected popup notice (immutable)
        // Pass isVisible from event data to avoid unnecessary API calls
        // Convert 0/1 to false/true (MySQL returns TINYINT as 0 or 1)
        const popupEnv = event.data.environment as string;
        if (!popupEnv) {
          this.logger.warn('Popup notice event missing environment', { event: event.type });
          break;
        }
        const popupIsVisible = event.data.isVisible === 0 ? false : (event.data.isVisible === 1 ? true : event.data.isVisible);
        await this.cacheManager.updateSinglePopupNotice(Number(event.data.id), popupEnv, popupIsVisible);
        break;
      }

      case 'popup.deleted': {
        if (features.popupNotice === false) {
          this.logger.debug('Popup notice event ignored - feature is disabled', { event: event.type });
          break;
        }
        // Remove the deleted popup notice from cache (immutable)
        const popupDeleteEnv = event.data.environment as string;
        if (!popupDeleteEnv) {
          this.logger.warn('Popup notice deleted event missing environment', { event: event.type });
          break;
        }
        this.cacheManager.removePopupNotice(Number(event.data.id), popupDeleteEnv);
        break;
      }

      case 'survey.created':
      case 'survey.updated': {
        if (features.survey === false) {
          this.logger.debug('Survey event ignored - feature is disabled', { event: event.type });
          break;
        }
        // Update only the affected survey (immutable)
        // Pass isActive from event data to avoid unnecessary API calls
        // Convert 0/1 to false/true (MySQL returns TINYINT as 0 or 1)
        const surveyEnv = event.data.environment as string;
        if (!surveyEnv) {
          this.logger.warn('Survey event missing environment', { event: event.type });
          break;
        }
        const surveyIsActive = event.data.isActive === 0 ? false : (event.data.isActive === 1 ? true : event.data.isActive);
        await this.cacheManager.updateSingleSurvey(String(event.data.id), surveyEnv, surveyIsActive);
        break;
      }

      case 'survey.deleted': {
        if (features.survey === false) {
          this.logger.debug('Survey event ignored - feature is disabled', { event: event.type });
          break;
        }
        // Remove the deleted survey from cache (immutable)
        const surveyDeleteEnv = event.data.environment as string;
        if (!surveyDeleteEnv) {
          this.logger.warn('Survey deleted event missing environment', { event: event.type });
          break;
        }
        this.cacheManager.removeSurvey(String(event.data.id), surveyDeleteEnv);
        break;
      }

      case 'survey.settings.updated': {
        if (features.survey === false) {
          this.logger.debug('Survey event ignored - feature is disabled', { event: event.type });
          break;
        }
        // Refresh survey settings only when configuration changes
        const surveySettingsEnv = event.data.environment as string;
        if (!surveySettingsEnv) {
          this.logger.warn('Survey settings updated event missing environment', { event: event.type });
          break;
        }
        this.logger.info('Survey settings updated event received, refreshing settings', {
          eventData: event.data,
          environment: surveySettingsEnv,
        });
        try {
          await this.cacheManager.refreshSurveySettings(surveySettingsEnv);
          this.logger.info('Survey settings refreshed successfully');
        } catch (error) {
          this.logger.error('Failed to refresh survey settings', { error });
        }
        break;
      }

      case 'whitelist.updated': {
        if (features.whitelist === false) {
          this.logger.debug('Whitelist event ignored - feature is disabled', { event: event.type });
          break;
        }
        // Refresh whitelist cache when whitelist is updated
        const whitelistEnv = event.data.environment as string;
        if (!whitelistEnv) {
          this.logger.warn('Whitelist updated event missing environment', { event: event.type });
          break;
        }
        this.logger.info('Whitelist updated event received, refreshing whitelist cache', { environment: whitelistEnv });
        try {
          await this.cacheManager.refreshWhitelists(whitelistEnv);
          this.logger.info('Whitelist cache refreshed successfully');
        } catch (error) {
          this.logger.error('Failed to refresh whitelist cache', { error });
        }
        break;
      }

      case 'maintenance.settings.updated': {
        if (features.serviceMaintenance === false) {
          this.logger.debug('Maintenance event ignored - feature is disabled', { event: event.type });
          break;
        }
        // Refresh service maintenance cache when maintenance settings are updated
        // Note: This will also trigger MaintenanceWatcher to check state changes
        // and emit maintenance.started/maintenance.ended events if needed
        const maintenanceEnv = event.data.environment as string;
        if (!maintenanceEnv) {
          this.logger.warn('Maintenance settings updated event missing environment', { event: event.type });
          break;
        }
        this.logger.info('Service maintenance settings updated event received, refreshing service maintenance cache', { environment: maintenanceEnv });
        try {
          await this.cacheManager.refreshServiceMaintenance(maintenanceEnv);
          this.logger.info('Service maintenance cache refreshed successfully');
        } catch (error) {
          this.logger.error('Failed to refresh service maintenance cache', { error });
        }
        break;
      }

      case 'client_version.created':
      case 'client_version.updated': {
        if (features.clientVersion !== true) {
          this.logger.debug('Client version event ignored - feature is disabled', { event: event.type });
          break;
        }
        const cvEnvironment = event.data.environment as string;
        if (!cvEnvironment) {
          this.logger.warn('Client version updated event missing environment', { event: event.type });
          break;
        }

        // Check if full data is available in event payload
        const clientVersionData = event.data.clientVersion;
        if (clientVersionData) {
          this.logger.info('Client version event received, updating cache directly', {
            id: event.data.id,
            environment: cvEnvironment
          });
          this.cacheManager.getClientVersionService()?.updateSingleClientVersion(clientVersionData, cvEnvironment);
        } else {
          // Fallback to refresh if full data not available
          this.logger.info('Client version event received (no full data), refreshing cache', {
            id: event.data.id,
            environment: cvEnvironment
          });
          try {
            await this.cacheManager.getClientVersionService()?.refreshByEnvironment(cvEnvironment);
            this.logger.info('Client version cache refreshed successfully');
          } catch (error: any) {
            this.logger.error('Failed to refresh client version cache', { error: error.message });
          }
        }
        break;
      }

      case 'client_version.deleted': {
        if (features.clientVersion !== true) {
          this.logger.debug('Client version event ignored - feature is disabled', { event: event.type });
          break;
        }
        const cvEnvironment = event.data.environment as string;
        if (!cvEnvironment) {
          this.logger.warn('Client version deleted event missing environment', { event: event.type });
          break;
        }
        const id = Number(event.data.id);
        this.logger.info('Client version deleted event received, removing from cache', {
          id: id,
          environment: cvEnvironment
        });

        this.cacheManager.getClientVersionService()?.removeFromCache(id, cvEnvironment);
        break;
      }

      case 'banner.created':
      case 'banner.updated': {
        if (features.banner !== true) {
          this.logger.debug('Banner event ignored - feature is disabled', { event: event.type });
          break;
        }
        // Update only the affected banner (immutable)
        // Pass status from event data to avoid unnecessary API calls
        const bannerEnv = event.data.environment as string;
        if (!bannerEnv) {
          this.logger.warn('Banner event missing environment', { event: event.type });
          break;
        }
        const bannerStatus = event.data.status as string | undefined;
        await this.cacheManager.updateSingleBanner(
          String(event.data.id),
          bannerEnv,
          bannerStatus
        );
        break;
      }

      case 'banner.deleted': {
        if (features.banner !== true) {
          this.logger.debug('Banner event ignored - feature is disabled', { event: event.type });
          break;
        }
        // Remove the deleted banner from cache (immutable)
        const bannerDeleteEnv = event.data.environment as string;
        if (!bannerDeleteEnv) {
          this.logger.warn('Banner deleted event missing environment', { event: event.type });
          break;
        }
        this.cacheManager.removeBanner(String(event.data.id), bannerDeleteEnv);
        break;
      }

      case 'service_notice.created':
      case 'service_notice.updated': {
        if (features.serviceNotice !== true) {
          this.logger.debug('Service notice event ignored - feature is disabled', { event: event.type });
          break;
        }
        const noticeEnvironment = event.data.environment as string;
        if (!noticeEnvironment) {
          this.logger.warn('Service notice updated event missing environment', { event: event.type });
          break;
        }

        // Check if full data is available in event payload
        const serviceNoticeData = event.data.serviceNotice;
        if (serviceNoticeData) {
          this.logger.info('Service notice event received, updating cache directly', {
            id: event.data.id,
            environment: noticeEnvironment,
            isActive: serviceNoticeData.isActive,
            updatedAt: serviceNoticeData.updatedAt
          });
          this.cacheManager.getServiceNoticeService()?.updateSingleServiceNotice(serviceNoticeData, noticeEnvironment);
        } else {
          // Fallback to refresh if full data not available
          this.logger.info('Service notice event received (no full data), refreshing cache', {
            id: event.data.id,
            environment: noticeEnvironment
          });
          try {
            await this.cacheManager.getServiceNoticeService()?.refreshByEnvironment(noticeEnvironment);
            this.logger.info('Service notice cache refreshed successfully');
          } catch (error: any) {
            this.logger.error('Failed to refresh service notice cache', { error: error.message });
          }
        }
        break;
      }

      case 'service_notice.deleted': {
        if (features.serviceNotice !== true) {
          this.logger.debug('Service notice event ignored - feature is disabled', { event: event.type });
          break;
        }
        const noticeEnvironment = event.data.environment as string;
        if (!noticeEnvironment) {
          this.logger.warn('Service notice deleted event missing environment', { event: event.type });
          break;
        }
        const id = Number(event.data.id);
        this.logger.info('Service notice deleted event received, removing from cache', {
          id: id,
          environment: noticeEnvironment
        });
        this.cacheManager.getServiceNoticeService()?.removeFromCache(id, noticeEnvironment);
        break;
      }

      case 'store_product.created':
      case 'store_product.updated': {
        if (features.storeProduct !== true) {
          this.logger.debug('Store product event ignored - feature is disabled', { event: event.type });
          break;
        }
        // Update only the affected store product (immutable)
        // Pass isActive from event data to avoid unnecessary API calls
        // Convert 0/1 to false/true (MySQL returns TINYINT as 0 or 1)
        const productEnv = event.data.environment as string;
        if (!productEnv) {
          this.logger.warn('Store product event missing environment', { event: event.type });
          break;
        }
        const productIsActive = event.data.isActive === 0 ? false : (event.data.isActive === 1 ? true : event.data.isActive);
        await this.cacheManager.updateSingleStoreProduct(
          String(event.data.id),
          productEnv,
          productIsActive
        );
        break;
      }

      case 'store_product.deleted': {
        if (features.storeProduct !== true) {
          this.logger.debug('Store product event ignored - feature is disabled', { event: event.type });
          break;
        }
        // Remove the deleted store product from cache (immutable)
        const productDeleteEnv = event.data.environment as string;
        if (!productDeleteEnv) {
          this.logger.warn('Store product deleted event missing environment', { event: event.type });
          break;
        }
        this.cacheManager.removeStoreProduct(String(event.data.id), productDeleteEnv);
        break;
      }

      case 'store_product.bulk_updated': {
        if (features.storeProduct !== true) {
          this.logger.debug('Store product bulk update event ignored - feature is disabled', { event: event.type });
          break;
        }
        // For bulk updates, refresh all store products for the environment
        const bulkEnv = event.data.environment as string;
        if (!bulkEnv) {
          this.logger.warn('Store product bulk update event missing environment', { event: event.type });
          break;
        }
        this.logger.info('Store product bulk update event received, refreshing cache', {
          count: event.data.count,
          environment: bulkEnv,
          isActive: event.data.isActive,
        });
        await this.cacheManager.refreshStoreProducts(bulkEnv);
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

      case 'feature_flag.changed':
      case 'feature_flag.created':
      case 'feature_flag.updated':
      case 'feature_flag.deleted': {
        if (features.featureFlag !== true) {
          this.logger.debug('Feature flag event ignored - feature is disabled', { event: event.type });
          break;
        }
        const ffEnv = event.data.environment as string;
        if (!ffEnv) {
          this.logger.warn('Feature flag event missing environment', { event: event.type });
          break;
        }
        this.logger.info('Feature flag event received, refreshing feature flags cache', {
          type: event.type,
          environment: ffEnv
        });
        try {
          await this.cacheManager.getFeatureFlagService()?.refreshByEnvironment(ffEnv);
          this.logger.info('Feature flags cache refreshed successfully');
        } catch (error: any) {
          this.logger.error('Failed to refresh feature flags cache', { error: error.message });
        }
        break;
      }

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
