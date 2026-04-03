/**
 * Event Listener for Redis Pub/Sub
 * Listens to cache invalidation events from Gatrix backend
 * Uses Redis Pub/Sub to ensure all SDK instances receive the same events
 */

import Redis from 'ioredis';
import { Logger } from '../utils/logger';
import { RedisConfig } from '../types/config';
import {
  StandardEvent,
  CustomEvent,
  EventCallback,
  EventListenerMap,
} from '../types/events';
import { CacheManager } from './cache-manager';
import {
  IEventHandler,
  GameWorldEventHandler,
  PopupNoticeEventHandler,
  SurveyEventHandler,
  WhitelistEventHandler,
  MaintenanceEventHandler,
  ClientVersionEventHandler,
  ServiceNoticeEventHandler,
  BannerEventHandler,
  StoreProductEventHandler,
  FeatureFlagEventHandler,
  VarsEventHandler,
} from './event-handlers';
import { SdkMetrics } from '../utils/sdk-metrics';

export class EventListener {
  private logger: Logger;
  private redisConfig: RedisConfig;
  private subscriber?: Redis;
  private eventListeners: EventListenerMap = {};
  private cacheManager: CacheManager;
  private readonly CHANNEL_PREFIX = 'gatrix-sdk-events';
  private isConnected: boolean = false;
  // Flag to suppress noisy logs during intentional shutdown
  private isShuttingDown: boolean = false;
  private metrics?: SdkMetrics;
  private handlers: Map<string, IEventHandler> = new Map();
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 60; // 30 seconds with 500ms interval
  private readonly RECONNECT_INTERVAL = 500; // milliseconds
  private reconnectTimer?: NodeJS.Timeout;

  constructor(
    redisConfig: RedisConfig,
    cacheManager: CacheManager,
    logger: Logger,
    metrics?: SdkMetrics
  ) {
    this.redisConfig = redisConfig;
    this.cacheManager = cacheManager;
    this.logger = logger;
    this.metrics = metrics;

    // Register domain-specific event handlers
    this.registerHandlers();
  }

  /**
   * Register all domain-specific event handlers
   * Each handler declares the event types it supports
   */
  private registerHandlers(): void {
    const handlers: IEventHandler[] = [
      new GameWorldEventHandler(this.cacheManager, this.logger),
      new PopupNoticeEventHandler(this.cacheManager, this.logger),
      new SurveyEventHandler(this.cacheManager, this.logger),
      new WhitelistEventHandler(this.cacheManager, this.logger),
      new MaintenanceEventHandler(this.cacheManager, this.logger),
      new ClientVersionEventHandler(this.cacheManager, this.logger),
      new ServiceNoticeEventHandler(this.cacheManager, this.logger),
      new BannerEventHandler(this.cacheManager, this.logger),
      new StoreProductEventHandler(this.cacheManager, this.logger),
      new FeatureFlagEventHandler(this.cacheManager, this.logger),
      new VarsEventHandler(this.cacheManager, this.logger),
    ];

    for (const handler of handlers) {
      for (const eventType of handler.eventTypes) {
        this.handlers.set(eventType, handler);
      }
    }
  }

  /**
   * Initialize event listener with retry logic
   * @param channelContext - org/project/env IDs for 3-level channel subscription (single-env mode)
   */
  async initialize(channelContext?: {
    orgId?: string;
    projectId?: string;
    environmentId?: string;
  }): Promise<void> {
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
          try {
            this.metrics?.setRedisConnected(false);
          } catch (_) {}
          return;
        }
        // Only log actual connection errors, not retry attempts
        if (
          !error.message.includes('ECONNREFUSED') &&
          !error.message.includes('connect')
        ) {
          this.logger.error('Subscriber error', { error: error.message });
        }
        // Mark as disconnected but do not attempt manual reconnect here
        // ioredis will handle reconnection automatically with retryStrategy
        this.isConnected = false;
        try {
          this.metrics?.setRedisConnected(false);
        } catch (_) {}
      });

      this.subscriber.on('close', () => {
        if (this.isShuttingDown) {
          // Avoid noisy close logs during intentional shutdown
          this.isConnected = false;
          try {
            this.metrics?.setRedisConnected(false);
          } catch (_) {}
          return;
        }
        this.logger.warn('Subscriber connection closed');
        // Mark as disconnected; rely on ioredis auto-reconnect
        this.isConnected = false;
        try {
          this.metrics?.setRedisConnected(false);
        } catch (_) {}
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
            try {
              this.metrics?.setRedisConnected(true);
              this.metrics?.incRedisReconnect();
            } catch (_) {}
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
      try {
        this.metrics?.setRedisConnected(true);
      } catch (_) {}

      // Subscribe to SDK events channel based on mode
      const isMulti = this.cacheManager.isMultiMode();
      if (isMulti) {
        // Multi-environment mode (Edge): subscribe to all channels via pattern
        await this.subscriber.psubscribe(`${this.CHANNEL_PREFIX}:*`);
        this.logger.info(
          'Event listener connected (multi-env, pattern subscribe)',
          {
            pattern: `${this.CHANNEL_PREFIX}:*`,
          }
        );
      } else {
        // Single-environment mode: subscribe to unified channel
        // Pattern: gatrix-sdk-events:{orgId|-}:{projId|-}:{envId|-}
        const channels: string[] = [];

        if (
          channelContext?.orgId ||
          channelContext?.projectId ||
          channelContext?.environmentId
        ) {
          const org = channelContext?.orgId || '-';
          const proj = channelContext?.projectId || '-';
          const env = channelContext?.environmentId || '-';
          // Subscribe to the full environment-level channel
          channels.push(`${this.CHANNEL_PREFIX}:${org}:${proj}:${env}`);

          // Also subscribe to env-only channel for backend services that publish
          // with only environmentId (no orgId/projectId context)
          // Backend resolveChannels produces: gatrix-sdk-events:-:-:{envId}
          if (channelContext?.environmentId) {
            const envOnlyChannel = `${this.CHANNEL_PREFIX}:-:-:${env}`;
            if (!channels.includes(envOnlyChannel)) {
              channels.push(envOnlyChannel);
            }
          }

          // Also subscribe to project-level channel for project-scoped events
          // (e.g., client_version events published with { projectId } only)
          if (channelContext?.projectId) {
            const projChannel = `${this.CHANNEL_PREFIX}:-:${proj}:-`;
            if (!channels.includes(projChannel)) {
              channels.push(projChannel);
            }
          }
        }

        // Fallback: subscribe using known environment IDs from cache if no context provided
        if (channels.length === 0) {
          const envIds = this.cacheManager.getKnownEnvironmentIds();
          for (const envId of envIds) {
            channels.push(`${this.CHANNEL_PREFIX}:-:-:${envId}`);
          }
        }

        if (channels.length > 0) {
          await this.subscriber.subscribe(...channels);
        }
        this.logger.info(
          'Event listener connected (single-env, specific channels)',
          {
            channels,
          }
        );
      }

      // Common event processing function for both subscribe and psubscribe
      const handleIncomingMessage = async (message: string) => {
        try {
          const event = JSON.parse(message);
          this.logger.info('SDK Event received', {
            type: event.type,
            id: event.data?.id || event.data?.key || 'N/A',
          });
          try {
            this.metrics?.incEventReceived(event.type);
          } catch (_) {}
          await this.processEvent(event);
        } catch (error: any) {
          this.logger.error('Failed to parse event message', {
            error: error.message,
          });
        }
      };

      // Handle incoming messages from subscribe (single-env mode)
      this.subscriber.on('message', async (_channel, message) => {
        await handleIncomingMessage(message);
      });

      // Handle incoming messages from psubscribe (multi-env mode)
      this.subscriber.on('pmessage', async (_pattern, _channel, message) => {
        await handleIncomingMessage(message);
      });

      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.logger.info('Event listener initialized successfully');
    } catch (error: any) {
      this.logger.error('Failed to initialize event listener', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Dynamically subscribe to additional channels
   * Used after registerService() to add org/project channels
   */
  async subscribeChannels(channelContext: {
    orgId?: string;
    projectId?: string;
    environmentId?: string;
  }): Promise<void> {
    if (!this.subscriber || !this.isConnected) {
      this.logger.warn('Cannot subscribe to channels - not connected');
      return;
    }

    // Multi-mode already subscribes to everything via psubscribe
    if (this.cacheManager.isMultiMode()) {
      return;
    }

    // Build unified channel: gatrix-sdk-events:{orgId|-}:{projId|-}:{envId|-}
    const channels: string[] = [];
    if (
      channelContext.orgId ||
      channelContext.projectId ||
      channelContext.environmentId
    ) {
      const org = channelContext.orgId || '-';
      const proj = channelContext.projectId || '-';
      const env = channelContext.environmentId || '-';
      channels.push(`${this.CHANNEL_PREFIX}:${org}:${proj}:${env}`);
    }

    if (channels.length > 0) {
      await this.subscriber.subscribe(...channels);
      this.logger.info('Subscribed to additional channels', { channels });
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
        this.logger.info(
          'Event listener reconnected. Reinitializing cache data...'
        );
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
      this.logger.error('Failed to reinitialize cache', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process incoming event
   */
  private async processEvent(event: any): Promise<void> {
    this.logger.debug('Processing event', {
      type: event.type,
      data: event.data,
    });

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
  /**
   * Handle standard cache invalidation events
   * Delegates to domain-specific event handlers via handler map
   */
  private async handleStandardEvent(event: StandardEvent): Promise<void> {
    this.logger.info('Handling standard event', {
      type: event.type,
      id: event.data.id || event.data.key || 'N/A',
    });

    // Dispatch to domain handler
    const handler = this.handlers.get(event.type);
    if (!handler) {
      this.logger.warn('Unknown standard event type', { type: event.type });
      return;
    }

    // Check if the handler's feature is enabled
    const uses = this.cacheManager.getUses();
    if (!handler.isEnabled(uses)) {
      this.logger.debug('Event ignored - feature is disabled', {
        event: event.type,
      });
      return;
    }

    // Extract and validate scope ID based on handler scope
    let scopeId = '';

    if (handler.scope === 'environment') {
      // Environment-scoped events require environmentId
      scopeId = (event.data.environmentId || '') as string;
      if (!scopeId) {
        this.logger.warn('Event missing environmentId', {
          event: event.type,
        });
        return;
      }
      // Resolve raw environment ID to cache key
      scopeId = this.cacheManager.resolveTokenForEnvironmentId(scopeId);
    } else if (handler.scope === 'project') {
      // Project-scoped events use projectId from event data or resolved context
      scopeId = (event.data.projectId || '') as string;
      if (!scopeId) {
        scopeId = this.cacheManager.getChannelContext().projectId || '';
      }
    } else if (handler.scope === 'org') {
      // Org-scoped events use orgId from event data or resolved context
      scopeId = (event.data.orgId || '') as string;
      if (!scopeId) {
        scopeId = this.cacheManager.getChannelContext().orgId || '';
      }
    }

    await handler.handle(event, scopeId);
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
      await this.subscriber.publish(`${this.CHANNEL_PREFIX}:global`, message);
      this.logger.debug('Event published', { type: event.type });
      try {
        this.metrics?.incEventPublished(event.type);
      } catch (_) {}
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
    try {
      this.metrics?.setRedisConnected(false);
    } catch (_) {}

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.subscriber) {
      await this.subscriber.unsubscribe();
      await this.subscriber.punsubscribe();
      await this.subscriber.quit();
      this.subscriber = undefined;
    }

    this.removeAllListeners();

    this.logger.info('Event listener closed');
  }
}
