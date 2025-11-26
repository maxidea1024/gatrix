/**
 * GatrixServerSDK
 * Main SDK class that integrates all services
 */

import { Logger } from './utils/logger';
import { ErrorCode, createError } from './utils/errors';
import { GatrixSDKConfig } from './types/config';
import { ApiClient } from './client/ApiClient';
import { CouponService } from './services/CouponService';
import { GameWorldService } from './services/GameWorldService';
import { PopupNoticeService } from './services/PopupNoticeService';
import { SurveyService } from './services/SurveyService';
import { WhitelistService } from './services/WhitelistService';
import { ServiceMaintenanceService } from './services/ServiceMaintenanceService';
import { ServiceDiscoveryService } from './services/ServiceDiscoveryService';
import { CacheManager } from './cache/CacheManager';
import { EventListener } from './cache/EventListener';
import { EventCallback, SdkEvent } from './types/events';
import { SdkMetrics } from './utils/sdkMetrics';
import { MaintenanceEventData } from './cache/MaintenanceWatcher';
import {
  RedeemCouponRequest,
  RedeemCouponResponse,
  GameWorld,
  PopupNotice,
  Survey,
  SurveySettings,
  ServiceInstance,
  RegisterServiceInput,
  UpdateServiceStatusInput,
  GetServicesParams,
  MaintenanceInfo,
} from './types/api';

/**
 * GatrixServerSDK
 * Server-side SDK for game servers to interact with Gatrix backend
 */
export class GatrixServerSDK {
  private config: GatrixSDKConfig;
  private logger: Logger;
  private apiClient: ApiClient;
  private initialized: boolean = false;

  // Services
  public readonly coupon: CouponService;
  public readonly gameWorld: GameWorldService;
  public readonly popupNotice: PopupNoticeService;
  public readonly survey: SurveyService;
  public readonly whitelist: WhitelistService;
  public readonly serviceMaintenance: ServiceMaintenanceService;
  public readonly serviceDiscovery: ServiceDiscoveryService;

  // Cache and Events
  private cacheManager?: CacheManager;
  private eventListener?: EventListener;
  private metrics?: SdkMetrics;
  // Maintenance event listeners (separate from standard event listeners)
  private maintenanceEventListeners: Map<string, EventCallback[]> = new Map();

  constructor(config: GatrixSDKConfig) {
    // Set default API token if not provided (for testing)
    const configWithDefaults = {
      ...config,
      apiToken: config.apiToken || 'gatrix-unsecured-server-api-token',
    };

    // Validate config
    this.validateConfig(configWithDefaults);

    this.config = configWithDefaults;

    // Initialize logger
    this.logger = new Logger(configWithDefaults.logger);

    // Initialize metrics first
    this.metrics = new SdkMetrics({
      enabled: configWithDefaults.metrics?.enabled !== false,
      applicationName: configWithDefaults.applicationName,
      registry: configWithDefaults.metrics?.registry,
    });

    // Initialize API client (inject metrics for HTTP instrumentation)
    this.apiClient = new ApiClient({
      baseURL: configWithDefaults.gatrixUrl,
      apiToken: configWithDefaults.apiToken,
      applicationName: configWithDefaults.applicationName,
      logger: this.logger,
      retry: configWithDefaults.retry,
      metrics: this.metrics,
    });

    // Initialize services
    this.coupon = new CouponService(this.apiClient, this.logger);
    this.gameWorld = new GameWorldService(this.apiClient, this.logger);
    this.popupNotice = new PopupNoticeService(this.apiClient, this.logger);
    this.survey = new SurveyService(this.apiClient, this.logger);
    this.whitelist = new WhitelistService(this.apiClient, this.logger);
    this.serviceMaintenance = new ServiceMaintenanceService(this.apiClient, this.logger);
    this.serviceDiscovery = new ServiceDiscoveryService(this.apiClient, this.logger);

    this.logger.info('GatrixServerSDK created', {
      gatrixUrl: configWithDefaults.gatrixUrl,
      applicationName: configWithDefaults.applicationName,
      apiToken: configWithDefaults.apiToken === 'gatrix-unsecured-server-api-token' ? 'unsecured (testing)' : '***',
    });
  }

  /**
   * Validate SDK configuration
   */
  private validateConfig(config: GatrixSDKConfig): void {
    // Required fields
    if (!config.gatrixUrl) {
      throw createError(ErrorCode.INVALID_CONFIG, 'gatrixUrl is required');
    }

    if (!config.apiToken) {
      throw createError(ErrorCode.INVALID_CONFIG, 'apiToken is required');
    }

    if (!config.applicationName) {
      throw createError(ErrorCode.INVALID_CONFIG, 'applicationName is required');
    }

    // Validate URL format
    try {
      new URL(config.gatrixUrl);
    } catch (_error) {
      throw createError(ErrorCode.INVALID_CONFIG, 'gatrixUrl must be a valid URL');
    }

    // Validate worldId format if provided
    if (config.worldId !== undefined) {
      if (typeof config.worldId !== 'string' || config.worldId.trim() === '') {
        throw createError(ErrorCode.INVALID_CONFIG, 'worldId must be a non-empty string');
      }
    }

    // Validate metrics config
    if (config.metrics) {
      if (config.metrics.enabled !== undefined && typeof config.metrics.enabled !== 'boolean') {
        throw createError(ErrorCode.INVALID_CONFIG, 'metrics.enabled must be a boolean');
      }
    }

    // Validate serviceDiscovery config
    if (config.serviceDiscovery) {
      const sd = config.serviceDiscovery;

      // If autoRegister is enabled, validate required fields
      if (sd.autoRegister) {
        if (!sd.labels || !sd.labels.service) {
          throw createError(
            ErrorCode.INVALID_CONFIG,
            'serviceDiscovery.labels.service is required when autoRegister is enabled'
          );
        }

        if (!sd.ports || (!sd.ports.tcp?.length && !sd.ports.udp?.length && !sd.ports.http?.length)) {
          throw createError(
            ErrorCode.INVALID_CONFIG,
            'serviceDiscovery.ports must have at least one port when autoRegister is enabled'
          );
        }
      }
    }

    // Validate cache config
    if (config.cache) {
      if (config.cache.ttl !== undefined) {
        if (typeof config.cache.ttl !== 'number' || config.cache.ttl < 0) {
          throw createError(ErrorCode.INVALID_CONFIG, 'cache.ttl must be a non-negative number');
        }
      }

      if (config.cache.refreshMethod !== undefined) {
        if (!['polling', 'event'].includes(config.cache.refreshMethod)) {
          throw createError(ErrorCode.INVALID_CONFIG, 'cache.refreshMethod must be "polling" or "event"');
        }
      }
    }

    // Validate redis config if event-based refresh is used
    if (config.cache?.refreshMethod === 'event' && !config.redis) {
      throw createError(
        ErrorCode.INVALID_CONFIG,
        'redis config is required when cache.refreshMethod is "event"'
      );
    }
  }

  /**
   * Auto-register service to service discovery if configured
   */
  private async autoRegisterServiceIfConfigured(): Promise<void> {
    const serviceDiscoveryConfig = this.config.serviceDiscovery;
    if (!serviceDiscoveryConfig?.autoRegister) {
      return;
    }

    // Note: labels and ports are already validated in validateConfig()
    const { labels, hostname, internalAddress, ports, status, stats, meta } = serviceDiscoveryConfig;

    this.logger.info('Auto-registering service via serviceDiscovery config', {
      labels,
      ports,
      status: status ?? 'ready',
      hostname: hostname ?? 'auto',
      internalAddress: internalAddress ?? 'auto',
    });

    const result = await this.serviceDiscovery.register({
      labels: labels!, // Already validated in validateConfig()
      hostname,
      internalAddress,
      ports: ports!, // Already validated in validateConfig()
      status,
      stats,
      meta,
    });

    this.logger.info('Service auto-registered via serviceDiscovery config', {
      instanceId: result.instanceId,
      hostname: result.hostname,
      internalAddress: result.internalAddress,
      externalAddress: result.externalAddress,
    });
  }

  /**
   * Initialize SDK
   * - Initialize cache
   * - Initialize event listener
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('SDK already initialized');
      return;
    }

    this.logger.info('Initializing GatrixServerSDK...');
    // Log effective configuration at startup for visibility
    this.logger.info('SDK configuration', {
      refreshMethod: this.config.cache?.refreshMethod ?? 'polling',
      cache: {
        enabled: this.config.cache?.enabled !== false,
        ttl: this.config.cache?.ttl ?? 300,
      },
      redis: this.config.redis
        ? { host: this.config.redis.host, port: this.config.redis.port, db: this.config.redis.db ?? 0 }
        : 'disabled',
      retry: this.config.retry ?? 'default',
    });

    try {
      // Initialize cache manager
      const cacheConfig = this.config.cache || {};
      this.cacheManager = new CacheManager(
        cacheConfig,
        this.gameWorld,
        this.popupNotice,
        this.survey,
        this.whitelist,
        this.serviceMaintenance,
        this.apiClient,
        this.logger,
        this.metrics,
        this.config.worldId // Pass worldId for maintenance watcher
      );

      // Register maintenance state change listener to emit SDK events
      this.cacheManager.onMaintenanceChange((eventType, data) => {
        this.emitMaintenanceEvent(eventType, data);
      });

      await this.cacheManager.initialize();

      // Initialize event listener only if using event-based refresh method
      const refreshMethod = cacheConfig.refreshMethod ?? 'polling';
      if (this.config.redis && refreshMethod === 'event') {
        this.eventListener = new EventListener(this.config.redis, this.cacheManager, this.logger, this.metrics);
        await this.eventListener.initialize();
      }

      // Auto-register service discovery if configured
      await this.autoRegisterServiceIfConfigured();

      this.initialized = true;

      this.logger.info('GatrixServerSDK initialized successfully');
    } catch (error: any) {
      this.logger.error('Failed to initialize SDK', { error: error.message });
      throw error;
    }
  }

  /**
   * Check if SDK is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ============================================================================
  // Coupon Methods
  // ============================================================================

  /**
   * Redeem a coupon
   */
  async redeemCoupon(request: RedeemCouponRequest): Promise<RedeemCouponResponse> {
    return await this.coupon.redeem(request);
  }

  // ============================================================================
  // Game World Methods
  // ============================================================================

  /**
   * Fetch all game worlds
   */
  async fetchGameWorlds(): Promise<GameWorld[]> {
    return await this.gameWorld.list();
  }

  /**
   * Fetch game world by ID
   */
  async fetchGameWorldById(id: number): Promise<GameWorld> {
    return await this.gameWorld.getById(id);
  }

  /**
   * Fetch game world by worldId
   */
  async fetchGameWorldByWorldId(worldId: string): Promise<GameWorld> {
    return await this.gameWorld.getByWorldId(worldId);
  }

  /**
   * Get cached game worlds
   */
  getGameWorlds(): GameWorld[] {
    return this.gameWorld.getCached();
  }

  /**
   * Check if a world is in maintenance
   */
  isWorldInMaintenance(worldId: string): boolean {
    return this.gameWorld.isWorldInMaintenance(worldId);
  }

  /**
   * Get maintenance message for a world
   */
  getWorldMaintenanceMessage(worldId: string, lang: 'ko' | 'en' | 'zh' = 'en'): string | null {
    return this.gameWorld.getWorldMaintenanceMessage(worldId, lang);
  }

  /**
   * Fetch global service maintenance status
   */
  async fetchServiceMaintenanceStatus() {
    return await this.serviceMaintenance.getStatus();
  }

  /**
   * Get cached global service maintenance status
   */
  getServiceMaintenanceStatus() {
    return this.serviceMaintenance.getCached();
  }

  /**
   * Check if global service is currently in maintenance
   */
  isServiceInMaintenance(): boolean {
    return this.serviceMaintenance.isInMaintenance();
  }

  /**
   * Get localized maintenance message for global service
   */
  getServiceMaintenanceMessage(lang: 'ko' | 'en' | 'zh' = 'en'): string | null {
    return this.serviceMaintenance.getMessage(lang);
  }

  // ============================================================================
  // Integrated Maintenance Methods
  // ============================================================================

  /**
   * Check if the service is in maintenance (global or world-level)
   * Checks in order: global service maintenance → world-level maintenance
   *
   * Behavior:
   * - If worldId is provided: checks global service + that specific world
   * - If config.worldId is set: checks global service + that specific world
   * - If neither is set: checks global service + ALL worlds (returns true if any world is in maintenance)
   *
   * @param worldId Optional world ID to check (uses config.worldId if not provided)
   * @returns true if either global service or world(s) is in maintenance
   */
  isMaintenance(worldId?: string): boolean {
    // First check global service maintenance
    if (this.serviceMaintenance.isInMaintenance()) {
      return true;
    }

    // Determine target world ID
    const targetWorldId = worldId ?? this.config.worldId;

    // If specific worldId is specified, check only that world
    if (targetWorldId) {
      return this.gameWorld.isWorldInMaintenance(targetWorldId);
    }

    // If no worldId specified, check ALL worlds (world-wide service mode)
    const allWorlds = this.gameWorld.getCached();
    for (const world of allWorlds) {
      if (world.worldId && this.gameWorld.isWorldInMaintenance(world.worldId)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get comprehensive maintenance information
   * Returns detailed info about maintenance status including source, message, and options
   *
   * Behavior:
   * - If worldId is provided: returns info for global service or that specific world
   * - If config.worldId is set: returns info for global service or that specific world
   * - If neither is set: returns info for global service or the first world in maintenance
   *
   * @param worldId Optional world ID to check (uses config.worldId if not provided)
   * @param lang Language for maintenance message
   */
  getMaintenanceInfo(worldId?: string, lang: 'ko' | 'en' | 'zh' = 'en'): MaintenanceInfo {
    const targetWorldId = worldId ?? this.config.worldId;

    // Check global service maintenance first
    if (this.serviceMaintenance.isInMaintenance()) {
      const status = this.serviceMaintenance.getCached();
      return {
        isMaintenance: true,
        source: 'service',
        message: this.serviceMaintenance.getMessage(lang),
        forceDisconnect: status?.detail?.kickExistingPlayers ?? false,
        gracePeriodMinutes: status?.detail?.kickDelayMinutes ?? 0,
        startsAt: status?.detail?.startsAt ?? null,
        endsAt: status?.detail?.endsAt ?? null,
      };
    }

    // If specific worldId is specified, check that world
    if (targetWorldId && this.gameWorld.isWorldInMaintenance(targetWorldId)) {
      const world = this.gameWorld.getWorldByWorldId(targetWorldId);
      return {
        isMaintenance: true,
        source: 'world',
        worldId: targetWorldId,
        message: this.gameWorld.getWorldMaintenanceMessage(targetWorldId, lang),
        forceDisconnect: world?.forceDisconnect ?? false,
        gracePeriodMinutes: world?.gracePeriodMinutes ?? 0,
        startsAt: world?.maintenanceStartDate ?? null,
        endsAt: world?.maintenanceEndDate ?? null,
      };
    }

    // If no worldId specified, check ALL worlds and return first one in maintenance
    if (!targetWorldId) {
      const allWorlds = this.gameWorld.getCached();
      for (const world of allWorlds) {
        if (world.worldId && this.gameWorld.isWorldInMaintenance(world.worldId)) {
          return {
            isMaintenance: true,
            source: 'world',
            worldId: world.worldId,
            message: this.gameWorld.getWorldMaintenanceMessage(world.worldId, lang),
            forceDisconnect: world.forceDisconnect ?? false,
            gracePeriodMinutes: world.gracePeriodMinutes ?? 0,
            startsAt: world.maintenanceStartDate ?? null,
            endsAt: world.maintenanceEndDate ?? null,
          };
        }
      }
    }

    // Not in maintenance
    return {
      isMaintenance: false,
      source: null,
      message: null,
      forceDisconnect: false,
      gracePeriodMinutes: 0,
      startsAt: null,
      endsAt: null,
    };
  }

  // ============================================================================
  // Popup Notice Methods
  // ============================================================================

  /**
   * Fetch active popup notices
   */
  async fetchPopupNotices(): Promise<PopupNotice[]> {
    return await this.popupNotice.list();
  }

  /**
   * Get cached popup notices
   */
  getPopupNotices(): PopupNotice[] {
    return this.popupNotice.getCached();
  }

  /**
   * Get popup notices for a specific world
   */
  getPopupNoticesForWorld(worldId: string): PopupNotice[] {
    return this.popupNotice.getNoticesForWorld(worldId);
  }

  /**
   * Get active popup notices that are currently visible for the given context
   * Filters by date range (startDate/endDate) and targeting fields
   * Sorted by displayPriority (ascending, lower values mean higher priority)
   * @returns Array of active popup notices, empty array if none match
   */
  getActivePopupNotices(options?: {
    platform?: string;
    channel?: string;
    subChannel?: string;
    worldId?: string;
    userId?: string;
  }): PopupNotice[] {
    return this.popupNotice.getActivePopupNotices(options);
  }

  // ============================================================================
  // Survey Methods
  // ============================================================================

  /**
   * Fetch surveys with settings
   */
  async fetchSurveys(): Promise<{ surveys: Survey[]; settings: SurveySettings }> {
    return await this.survey.list({ isActive: true });
  }

  /**
   * Get cached surveys with settings
   */
  getSurveys(): { surveys: Survey[]; settings: SurveySettings | null } {
    return {
      surveys: this.survey.getCached(),
      settings: this.survey.getCachedSettings(),
    };
  }

  /**
   * Get surveys for a specific world
   */
  getSurveysForWorld(worldId: string): Survey[] {
    return this.survey.getSurveysForWorld(worldId);
  }

  /**
   * Update survey settings only
   * Called when survey settings change (e.g., survey configuration updates)
   */
  updateSurveySettings(newSettings: SurveySettings): void {
    this.survey.updateSettings(newSettings);
  }

  /**
   * Get filtered(active) surveys for a user based on their conditions
   * Filters surveys based on platform, channel, subchannel, world, and trigger conditions
   * @param platform User's platform (e.g., 'pc', 'ios', 'android')
   * @param channel User's channel (e.g., 'steam', 'epic')
   * @param subChannel User's subchannel (e.g., 'pc', 'ios')
   * @param worldId User's world ID
   * @param userLevel User's level
   * @param joinDays User's join days
   * @returns Array of appropriate surveys, empty array if none match
   */
  getActiveSurveys(
    platform: string,
    channel: string,
    subChannel: string,
    worldId: string,
    userLevel: number,
    joinDays: number
  ): Survey[] {
    return this.survey.getActiveSurveys(platform, channel, subChannel, worldId, userLevel, joinDays);
  }

  // ============================================================================
  // Cache Methods
  // ============================================================================

  /**
   * Refresh all caches
   */
  async refreshCache(): Promise<void> {
    if (!this.cacheManager) {
      throw createError(ErrorCode.NOT_INITIALIZED, 'Cache manager not initialized');
    }

    await this.cacheManager.refreshAll();
  }

  /**
   * Refresh game worlds cache
   */
  async refreshGameWorldsCache(): Promise<void> {
    if (!this.cacheManager) {
      throw createError(ErrorCode.NOT_INITIALIZED, 'Cache manager not initialized');
    }

    await this.cacheManager.refreshGameWorlds();
  }

  /**
   * Refresh popup notices cache
   */
  async refreshPopupNoticesCache(): Promise<void> {
    if (!this.cacheManager) {
      throw createError(ErrorCode.NOT_INITIALIZED, 'Cache manager not initialized');
    }

    await this.cacheManager.refreshPopupNotices();
  }

  /**
   * Refresh surveys cache
   */
  async refreshSurveysCache(): Promise<void> {
    if (!this.cacheManager) {
      throw createError(ErrorCode.NOT_INITIALIZED, 'Cache manager not initialized');
    }

    await this.cacheManager.refreshSurveys();
  }

  /**
   * Refresh service maintenance cache
   */
  async refreshServiceMaintenanceCache(): Promise<void> {
    if (!this.cacheManager) {
      throw createError(ErrorCode.NOT_INITIALIZED, 'Cache manager not initialized');
    }

    await this.cacheManager.refreshServiceMaintenance();
  }

  // ============================================================================
  // Event Methods
  // ============================================================================

  /**
   * Emit maintenance event to all registered listeners
   * Called by MaintenanceWatcher when maintenance state changes
   */
  private emitMaintenanceEvent(
    eventType: 'maintenance.started' | 'maintenance.ended',
    data: MaintenanceEventData
  ): void {
    const listeners = this.maintenanceEventListeners.get(eventType) || [];
    const event: SdkEvent = {
      type: eventType,
      data,
      timestamp: data.timestamp,
    };

    for (const callback of listeners) {
      try {
        callback(event);
      } catch (error: any) {
        this.logger.error('Error in maintenance event callback', { error: error.message });
      }
    }

    this.logger.info('Maintenance event emitted', { eventType, source: data.source, worldId: data.worldId });
  }

  /**
   * Register event listener
   * Works with both event-based and polling refresh methods
   * Also supports maintenance.started and maintenance.ended events
   * Returns a function to unregister the listener
   */
  on(eventType: string, callback: EventCallback): () => void {
    // Handle maintenance events separately (these are local events from MaintenanceWatcher)
    if (eventType === 'maintenance.started' || eventType === 'maintenance.ended') {
      const listeners = this.maintenanceEventListeners.get(eventType) || [];
      listeners.push(callback);
      this.maintenanceEventListeners.set(eventType, listeners);

      // Return unsubscribe function
      return () => {
        const currentListeners = this.maintenanceEventListeners.get(eventType) || [];
        this.maintenanceEventListeners.set(
          eventType,
          currentListeners.filter((cb) => cb !== callback)
        );
      };
    }

    const refreshMethod = this.config.cache?.refreshMethod ?? 'polling';

    // For event-based refresh, use EventListener
    if (refreshMethod === 'event') {
      if (!this.eventListener) {
        this.logger.warn('Event listener not initialized. Events will not be received.');
        return () => { }; // Return no-op function
      }
      return this.eventListener.on(eventType, callback);
    }
    // For polling refresh, register callback with CacheManager
    else if (refreshMethod === 'polling') {
      if (!this.cacheManager) {
        this.logger.warn('Cache manager not initialized.');
        return () => { }; // Return no-op function
      }
      const unsubscribe = this.cacheManager.onRefresh((type: string, data: any) => {
        // Convert cache refresh events to SDK events
        callback({
          type: type,
          data: data,
          timestamp: new Date().toISOString(),
        });
      });
      return unsubscribe;
    }

    return () => { }; // Return no-op function as fallback
  }

  /**
   * Unregister event listener
   */
  off(eventType: string, callback: EventCallback): void {
    // Handle maintenance events separately
    if (eventType === 'maintenance.started' || eventType === 'maintenance.ended') {
      const currentListeners = this.maintenanceEventListeners.get(eventType) || [];
      this.maintenanceEventListeners.set(
        eventType,
        currentListeners.filter((cb) => cb !== callback)
      );
      return;
    }

    const refreshMethod = this.config.cache?.refreshMethod ?? 'polling';

    // For event-based refresh, use EventListener
    if (refreshMethod === 'event') {
      if (!this.eventListener) {
        return;
      }
      this.eventListener.off(eventType, callback);
    }
    // For polling refresh, we don't have a way to unregister specific callbacks
    // This is a limitation of the current implementation
    // Consider using a callback registry if this becomes important
  }

  // ============================================================================
  // Service Discovery Methods (via Backend API)
  // ============================================================================

  /**
   * Register this service instance via Backend API
   */
  async registerService(input: RegisterServiceInput): Promise<{ instanceId: string; hostname: string; internalAddress: string; externalAddress: string }> {
    const result = await this.serviceDiscovery.register(input);
    return result;
  }

  /**
   * Unregister this service instance via Backend API
   */
  async unregisterService(): Promise<void> {
    await this.serviceDiscovery.unregister();
  }

  /**
   * Update service status via Backend API
   */
  async updateServiceStatus(input: UpdateServiceStatusInput): Promise<void> {
    await this.serviceDiscovery.updateStatus(input);
  }

  /**
   * Fetch services with filtering via Backend API
   * @param params - Filter parameters (serviceType, group, status, labels, excludeSelf)
   */
  async fetchServices(params?: GetServicesParams): Promise<ServiceInstance[]> {
    return await this.serviceDiscovery.fetchServices(params);
  }

  /**
   * Fetch a specific service instance via Backend API
   */
  async fetchService(serviceType: string, instanceId: string): Promise<ServiceInstance | null> {
    return await this.serviceDiscovery.fetchService(serviceType, instanceId);
  }

  /**
   * Get current service instance ID
   */
  getServiceInstanceId(): string | undefined {
    return this.serviceDiscovery.getInstanceId();
  }

  /**
   * Get current service type
   */
  getServiceType(): string | undefined {
    return this.serviceDiscovery.getServiceType();
  }

  /**
   * Get prom-client Registry used by SDK metrics (if enabled)
   * Useful to expose a single /metrics endpoint that includes SDK + HTTP metrics
   */
  getMetricsRegistry(): any | undefined {
    // Return underlying registry from SdkMetrics
    // Note: typed as any to avoid hard dependency on prom-client types
    return this.metrics?.getRegistry();
  }

  /**
   * Fetch whitelists (IP and Account)
   * Performs API call via WhitelistService and updates cache
   */
  async fetchWhitelists() {
    return await this.whitelist.list();
  }

  /**
   * Check if IP is whitelisted using cached data
   * Note: Uses WhitelistService cache; call fetchWhitelists or initialize cache beforehand.
   */
  async isIpWhitelisted(ip: string): Promise<boolean> {
    return this.whitelist.isIpWhitelisted(ip);
  }

  /**
   * Check if account is whitelisted using cached data
   * Note: Uses WhitelistService cache; call fetchWhitelists or initialize cache beforehand.
   */
  async isAccountWhitelisted(accountId: string): Promise<boolean> {
    return this.whitelist.isAccountWhitelisted(accountId);
  }

  // ============================================================================
  // Whitelist Cache Methods
  // ============================================================================

  /**
   * Get cached whitelists (IP and Account)
   * Returns cached data without making API call
   */
  getWhitelists() {
    if (!this.cacheManager) {
      this.logger.warn('Cache manager not initialized');
      return { ipWhitelist: [], accountWhitelist: [] };
    }
    return this.cacheManager.getWhitelists();
  }

  /**
   * Refresh whitelist cache
   */
  async refreshWhitelistCache(): Promise<void> {
    if (!this.cacheManager) {
      throw createError(ErrorCode.INVALID_CONFIG, 'Cache manager not initialized');
    }
    await this.cacheManager.refreshWhitelists();
  }

  // ============================================================================
  // Event Publishing Methods
  // ============================================================================

  /**
   * Publish a custom event to all SDK instances via Redis Pub/Sub
   * Custom events are prefixed with 'custom:' to distinguish from standard events
   *
   * @param eventType - Event type (will be prefixed with 'custom:' if not already)
   * @param data - Event data (any JSON-serializable object)
   *
   * @example
   * ```typescript
   * // Publish a custom player level up event
   * await sdk.publishCustomEvent('player.levelup', {
   *   playerId: 'player-123',
   *   newLevel: 50,
   *   timestamp: Date.now(),
   * });
   *
   * // Listen to the custom event
   * sdk.on('custom:player.levelup', (event) => {
   *   console.log('Player leveled up:', event.data);
   * });
   * ```
   */
  async publishCustomEvent(eventType: string, data: Record<string, any>): Promise<void> {
    if (!this.eventListener) {
      this.logger.warn('Event listener not initialized, custom event not published');
      return;
    }

    // Ensure event type is prefixed with 'custom:'
    const prefixedEventType = eventType.startsWith('custom:') ? eventType : `custom:${eventType}`;

    try {
      const timestamp = data.timestamp || Date.now();
      await this.eventListener.publishEvent({
        type: prefixedEventType,
        data,
        timestamp,
      });

      this.logger.debug('Custom event published', { type: prefixedEventType });
    } catch (error: any) {
      this.logger.error('Failed to publish custom event', {
        type: prefixedEventType,
        error: error.message,
      });
      throw error;
    }
  }

  // ============================================================================
  // Cleanup Methods
  // ============================================================================

  /**
   * Close SDK and cleanup all resources
   */
  async close(): Promise<void> {
    this.logger.info('Closing GatrixServerSDK...');

    try {
      // Stop cache auto-refresh
      if (this.cacheManager) {
        this.cacheManager.destroy();
      }

      // Close event listener
      if (this.eventListener) {
        await this.eventListener.close();
      }

      this.initialized = false;

      this.logger.info('GatrixServerSDK closed successfully');
    } catch (error: any) {
      this.logger.error('Error while closing SDK', { error: error.message });
      throw error;
    }
  }
}
