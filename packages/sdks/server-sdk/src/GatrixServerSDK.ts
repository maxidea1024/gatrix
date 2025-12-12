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
  CurrentMaintenanceStatus,
  ClientVersion,
  ServiceNotice,
  Banner,
  StoreProduct,
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
      service: configWithDefaults.service,
      group: configWithDefaults.group,
      environment: configWithDefaults.environment,
      applicationName: configWithDefaults.applicationName,
      registry: configWithDefaults.metrics?.registry,
    });

    // Initialize API client (inject metrics for HTTP instrumentation)
    this.apiClient = new ApiClient({
      baseURL: configWithDefaults.gatrixUrl,
      apiToken: configWithDefaults.apiToken,
      applicationName: configWithDefaults.applicationName,
      environment: configWithDefaults.environment, // Pass environment for X-Environment header
      logger: this.logger,
      retry: configWithDefaults.retry,
      metrics: this.metrics,
    });

    // Initialize services with default environment
    const defaultEnv = configWithDefaults.environment || 'development';
    this.coupon = new CouponService(this.apiClient, this.logger, defaultEnv);
    this.gameWorld = new GameWorldService(this.apiClient, this.logger, defaultEnv);
    this.popupNotice = new PopupNoticeService(this.apiClient, this.logger, defaultEnv);
    this.survey = new SurveyService(this.apiClient, this.logger, defaultEnv);
    this.whitelist = new WhitelistService(this.apiClient, this.logger, defaultEnv);
    this.serviceMaintenance = new ServiceMaintenanceService(this.apiClient, this.logger, defaultEnv);
    this.serviceDiscovery = new ServiceDiscoveryService(this.apiClient, this.logger);

    this.logger.info('GatrixServerSDK created', {
      gatrixUrl: configWithDefaults.gatrixUrl,
      applicationName: configWithDefaults.applicationName,
      environment: configWithDefaults.environment,
      environments: configWithDefaults.environments,
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

    if (!config.service) {
      throw createError(ErrorCode.INVALID_CONFIG, 'service is required');
    }

    if (!config.group) {
      throw createError(ErrorCode.INVALID_CONFIG, 'group is required');
    }

    if (!config.environment) {
      throw createError(ErrorCode.INVALID_CONFIG, 'environment is required');
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
        this.config.worldId, // Pass worldId for maintenance watcher
        this.config.features, // Pass features config for conditional loading
        this.config.environments // Pass target environments for Edge mode
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
   * @param environment Environment name. Only used in multi-environment mode (Edge).
   *                    For game servers, can be omitted to use default environment.
   *                    For edge servers, must be provided from client request.
   */
  getGameWorlds(environment?: string): GameWorld[] {
    return this.gameWorld.getCached(environment);
  }

  /**
   * Check if a world is in maintenance (time-based check)
   * @param environment Environment name. Only used in multi-environment mode.
   */
  isWorldMaintenanceActive(worldId: string, environment?: string): boolean {
    return this.gameWorld.isWorldMaintenanceActive(worldId, environment);
  }

  /**
   * Get maintenance message for a world
   * @param environment Environment name. Only used in multi-environment mode.
   */
  getWorldMaintenanceMessage(worldId: string, lang: 'ko' | 'en' | 'zh' = 'en', environment?: string): string | null {
    return this.gameWorld.getWorldMaintenanceMessage(worldId, lang, environment);
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
   * Check if global service is currently in maintenance (time-based check)
   */
  isServiceMaintenanceActive(): boolean {
    return this.serviceMaintenance.isMaintenanceActive();
  }

  /**
   * Get localized maintenance message for global service
   */
  getServiceMaintenanceMessage(lang: 'ko' | 'en' | 'zh' = 'en'): string | null {
    return this.serviceMaintenance.getMessage(lang);
  }

  /**
   * Get current maintenance status for client delivery
   * Returns the ACTUAL maintenance status after checking time ranges
   *
   * Behavior:
   * - Global service maintenance is always checked first
   * - If worldId is configured in SDK, only that world is checked
   * - Time-based maintenance (startsAt/endsAt) is calculated to determine actual status
   *
   * @returns CurrentMaintenanceStatus with isMaintenanceActive, source, and detail
   */
  getCurrentMaintenanceStatus(): CurrentMaintenanceStatus {
    // Check global service maintenance first (uses time calculation internally)
    if (this.serviceMaintenance.isMaintenanceActive()) {
      const status = this.serviceMaintenance.getCached();
      return {
        isMaintenanceActive: true,
        source: 'service',
        detail: {
          startsAt: status?.detail?.startsAt,
          endsAt: status?.detail?.endsAt,
          message: status?.detail?.message,
          localeMessages: status?.detail?.localeMessages,
          forceDisconnect: status?.detail?.kickExistingPlayers,
          gracePeriodMinutes: status?.detail?.kickDelayMinutes,
        },
      };
    }

    // Check world-level maintenance
    const targetWorldId = this.config.worldId;

    if (targetWorldId && this.gameWorld.isWorldMaintenanceActive(targetWorldId)) {
      const world = this.gameWorld.getWorldByWorldId(targetWorldId);
      if (world) {
        // Convert maintenanceLocales array to localeMessages object
        const localeMessages: { ko?: string; en?: string; zh?: string } = {};
        if (world.maintenanceLocales) {
          for (const locale of world.maintenanceLocales) {
            if (locale.lang === 'ko' || locale.lang === 'en' || locale.lang === 'zh') {
              localeMessages[locale.lang] = locale.message;
            }
          }
        }

        return {
          isMaintenanceActive: true,
          source: 'world',
          worldId: targetWorldId,
          detail: {
            startsAt: world.maintenanceStartDate,
            endsAt: world.maintenanceEndDate,
            message: world.maintenanceMessage,
            localeMessages: Object.keys(localeMessages).length > 0 ? localeMessages : undefined,
            forceDisconnect: world.forceDisconnect,
            gracePeriodMinutes: world.gracePeriodMinutes,
          },
        };
      }
    }

    // Not in maintenance
    return {
      isMaintenanceActive: false,
    };
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
  isMaintenanceActive(worldId?: string): boolean {
    // First check global service maintenance
    if (this.serviceMaintenance.isMaintenanceActive()) {
      return true;
    }

    // Determine target world ID
    const targetWorldId = worldId ?? this.config.worldId;

    // If specific worldId is specified, check only that world
    if (targetWorldId) {
      return this.gameWorld.isWorldMaintenanceActive(targetWorldId);
    }

    // If no worldId specified, check ALL worlds (world-wide service mode)
    const allWorlds = this.gameWorld.getCached();
    for (const world of allWorlds) {
      if (world.worldId && this.gameWorld.isWorldMaintenanceActive(world.worldId)) {
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
    if (this.serviceMaintenance.isMaintenanceActive()) {
      const status = this.serviceMaintenance.getCached();
      const actualStartTime = this.cacheManager?.getServiceMaintenanceActualStartTime() ?? null;
      return {
        isMaintenanceActive: true,
        source: 'service',
        message: this.serviceMaintenance.getMessage(lang),
        forceDisconnect: status?.detail?.kickExistingPlayers ?? false,
        gracePeriodMinutes: status?.detail?.kickDelayMinutes ?? 0,
        startsAt: status?.detail?.startsAt ?? null,
        endsAt: status?.detail?.endsAt ?? null,
        actualStartTime,
      };
    }

    // If specific worldId is specified, check that world
    if (targetWorldId && this.gameWorld.isWorldMaintenanceActive(targetWorldId)) {
      const world = this.gameWorld.getWorldByWorldId(targetWorldId);
      const actualStartTime = this.cacheManager?.getWorldMaintenanceActualStartTime(targetWorldId) ?? null;
      return {
        isMaintenanceActive: true,
        source: 'world',
        worldId: targetWorldId,
        message: this.gameWorld.getWorldMaintenanceMessage(targetWorldId, lang),
        forceDisconnect: world?.forceDisconnect ?? false,
        gracePeriodMinutes: world?.gracePeriodMinutes ?? 0,
        startsAt: world?.maintenanceStartDate ?? null,
        endsAt: world?.maintenanceEndDate ?? null,
        actualStartTime,
      };
    }

    // If no worldId specified, check ALL worlds and return first one in maintenance
    if (!targetWorldId) {
      const allWorlds = this.gameWorld.getCached();
      for (const world of allWorlds) {
        if (world.worldId && this.gameWorld.isWorldMaintenanceActive(world.worldId)) {
          const actualStartTime = this.cacheManager?.getWorldMaintenanceActualStartTime(world.worldId) ?? null;
          return {
            isMaintenanceActive: true,
            source: 'world',
            worldId: world.worldId,
            message: this.gameWorld.getWorldMaintenanceMessage(world.worldId, lang),
            forceDisconnect: world.forceDisconnect ?? false,
            gracePeriodMinutes: world.gracePeriodMinutes ?? 0,
            startsAt: world.maintenanceStartDate ?? null,
            endsAt: world.maintenanceEndDate ?? null,
            actualStartTime,
          };
        }
      }
    }

    // Not in maintenance
    return {
      isMaintenanceActive: false,
      source: null,
      message: null,
      forceDisconnect: false,
      gracePeriodMinutes: 0,
      startsAt: null,
      endsAt: null,
      actualStartTime: null,
    };
  }

  // ============================================================================
  // Popup Notice Methods
  // ============================================================================

  /**
   * Fetch active popup notices
   * @param environment Environment name. Only used in multi-environment mode.
   */
  async fetchPopupNotices(environment?: string): Promise<PopupNotice[]> {
    if (environment) {
      return await this.popupNotice.listByEnvironment(environment);
    }
    return await this.popupNotice.list();
  }

  /**
   * Get cached popup notices
   * @param environment Environment name. Only used in multi-environment mode (Edge).
   *                    For game servers, can be omitted to use default environment.
   *                    For edge servers, must be provided from client request.
   */
  getPopupNotices(environment?: string): PopupNotice[] {
    return this.popupNotice.getCached(environment);
  }

  /**
   * Get popup notices for a specific world
   * @param environment Environment name. Only used in multi-environment mode.
   */
  getPopupNoticesForWorld(worldId: string, environment?: string): PopupNotice[] {
    return this.popupNotice.getNoticesForWorld(worldId, environment);
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
    environment?: string;
  }): PopupNotice[] {
    return this.popupNotice.getActivePopupNotices(options);
  }

  // ============================================================================
  // Survey Methods
  // ============================================================================

  /**
   * Fetch surveys with settings
   * @param environment Environment name. Only used in multi-environment mode.
   */
  async fetchSurveys(environment?: string): Promise<{ surveys: Survey[]; settings: SurveySettings }> {
    if (environment) {
      return await this.survey.listByEnvironment(environment, { isActive: true });
    }
    return await this.survey.list({ isActive: true });
  }

  /**
   * Get cached surveys with settings
   * @param environment Environment name. Only used in multi-environment mode (Edge).
   *                    For game servers, can be omitted to use default environment.
   *                    For edge servers, must be provided from client request.
   */
  getSurveys(environment?: string): { surveys: Survey[]; settings: SurveySettings | null } {
    return {
      surveys: this.survey.getCached(environment),
      settings: this.survey.getCachedSettings(environment),
    };
  }

  /**
   * Get surveys for a specific world
   * @param environment Environment name. Only used in multi-environment mode.
   */
  getSurveysForWorld(worldId: string, environment?: string): Survey[] {
    return this.survey.getSurveysForWorld(worldId, environment);
  }

  /**
   * Update survey settings only
   * Called when survey settings change (e.g., survey configuration updates)
   * @param environment Environment name. Only used in multi-environment mode.
   */
  updateSurveySettings(newSettings: SurveySettings, environment?: string): void {
    this.survey.updateSettings(newSettings, environment);
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
   * @param environment Environment name. Only used in multi-environment mode.
   * @returns Array of appropriate surveys, empty array if none match
   */
  getActiveSurveys(
    platform: string,
    channel: string,
    subChannel: string,
    worldId: string,
    userLevel: number,
    joinDays: number,
    environment?: string
  ): Survey[] {
    return this.survey.getActiveSurveys(platform, channel, subChannel, worldId, userLevel, joinDays, environment);
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
   * Local events are prefixed with 'local.' to distinguish from backend events
   */
  private emitMaintenanceEvent(
    eventType: 'local.maintenance.started' | 'local.maintenance.ended' | 'local.maintenance.updated' | 'local.maintenance.grace_period_expired',
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
   * Also supports local.maintenance.started, local.maintenance.ended, and local.maintenance.updated events
   * Returns a function to unregister the listener
   */
  on(eventType: string, callback: EventCallback): () => void {
    // Handle local maintenance events separately (these are local events from MaintenanceWatcher)
    if (eventType === 'local.maintenance.started' || eventType === 'local.maintenance.ended' || eventType === 'local.maintenance.updated' || eventType === 'local.maintenance.grace_period_expired') {
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
   * Note: metricsApi port is automatically added from SDK config (default: 9337)
   */
  async registerService(input: RegisterServiceInput): Promise<{ instanceId: string; hostname: string; internalAddress: string; externalAddress: string }> {
    // Auto-add metricsApi port from metrics config (default: 9337)
    const metricsPort = this.config.metrics?.port ?? parseInt(process.env.SDK_METRICS_PORT || '9337', 10);
    const inputWithMetrics = {
      ...input,
      ports: {
        ...input.ports,
        metricsApi: metricsPort,
      },
    };
    const result = await this.serviceDiscovery.register(inputWithMetrics);
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
  // Client Version Methods (Edge feature)
  // ============================================================================

  /**
   * Get cached client versions
   * Only available when features.clientVersion is enabled
   * @param environment Environment name. Only used in multi-environment mode (Edge).
   *                    For game servers, can be omitted to use default environment.
   *                    For edge servers, must be provided from client request.
   */
  getClientVersions(environment?: string): ClientVersion[] {
    if (!this.cacheManager) {
      this.logger.warn('SDK not initialized');
      return [];
    }
    return this.cacheManager.getClientVersions(environment);
  }

  /**
   * Get ClientVersionService for advanced operations
   * Returns undefined if features.clientVersion is not enabled
   */
  getClientVersionService() {
    return this.cacheManager?.getClientVersionService();
  }

  // ============================================================================
  // Service Notice Methods (Edge feature)
  // ============================================================================

  /**
   * Get cached service notices
   * Only available when features.serviceNotice is enabled
   * @param environment Environment name. Only used in multi-environment mode (Edge).
   *                    For game servers, can be omitted to use default environment.
   *                    For edge servers, must be provided from client request.
   */
  getServiceNotices(environment?: string): ServiceNotice[] {
    if (!this.cacheManager) {
      this.logger.warn('SDK not initialized');
      return [];
    }
    return this.cacheManager.getServiceNotices(environment);
  }

  /**
   * Get ServiceNoticeService for advanced operations
   * Returns undefined if features.serviceNotice is not enabled
   */
  getServiceNoticeService() {
    return this.cacheManager?.getServiceNoticeService();
  }

  // ============================================================================
  // Banner Methods (Edge feature)
  // ============================================================================

  /**
   * Get cached banners
   * Only available when features.banner is enabled
   * @param environment Environment name. Only used in multi-environment mode (Edge).
   *                    For game servers, can be omitted to use default environment.
   *                    For edge servers, must be provided from client request.
   */
  getBanners(environment?: string): Banner[] {
    if (!this.cacheManager) {
      this.logger.warn('SDK not initialized');
      return [];
    }
    return this.cacheManager.getBanners(environment);
  }

  /**
   * Get BannerService for advanced operations
   * Returns undefined if features.banner is not enabled
   */
  getBannerService() {
    return this.cacheManager?.getBannerService();
  }

  // ============================================================================
  // Store Product Methods
  // ============================================================================

  /**
   * Get cached store products
   * Only available when features.storeProduct is enabled
   * @param environment Environment name. Only used in multi-environment mode.
   *                    For game servers, can be omitted to use default environment.
   */
  getStoreProducts(environment?: string): StoreProduct[] {
    if (!this.cacheManager) {
      this.logger.warn('SDK not initialized');
      return [];
    }
    return this.cacheManager.getStoreProducts(environment);
  }

  /**
   * Get StoreProductService for advanced operations
   * Returns undefined if features.storeProduct is not enabled
   */
  getStoreProductService() {
    return this.cacheManager?.getStoreProductService();
  }

  /**
   * Get all cached data (for debugging/monitoring)
   * Returns all cached data organized by type and environment
   */
  getAllCachedData(): any {
    if (!this.cacheManager) {
      this.logger.warn('SDK not initialized');
      return {};
    }
    return this.cacheManager.getAllCachedData();
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
        this.cacheManager = undefined;
      }

      // Close event listener
      if (this.eventListener) {
        await this.eventListener.close();
        this.eventListener = undefined;
      }

      this.initialized = false;

      this.logger.info('GatrixServerSDK closed successfully');
    } catch (error: any) {
      this.logger.error('Error while closing SDK', { error: error.message });
      throw error;
    }
  }
}
