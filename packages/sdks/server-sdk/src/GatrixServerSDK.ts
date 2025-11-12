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
import { ServiceDiscoveryService } from './services/ServiceDiscoveryService';
import { CacheManager } from './cache/CacheManager';
import { EventListener } from './cache/EventListener';
import { EventCallback } from './types/events';
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
  public readonly serviceDiscovery: ServiceDiscoveryService;

  // Cache and Events
  private cacheManager?: CacheManager;
  private eventListener?: EventListener;

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

    // Initialize API client
    this.apiClient = new ApiClient({
      baseURL: configWithDefaults.gatrixUrl,
      apiToken: configWithDefaults.apiToken,
      applicationName: configWithDefaults.applicationName,
      logger: this.logger,
      retry: configWithDefaults.retry,
    });

    // Initialize services
    this.coupon = new CouponService(this.apiClient, this.logger);
    this.gameWorld = new GameWorldService(this.apiClient, this.logger);
    this.popupNotice = new PopupNoticeService(this.apiClient, this.logger);
    this.survey = new SurveyService(this.apiClient, this.logger);
    this.whitelist = new WhitelistService(this.apiClient, this.logger);
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
    } catch (error) {
      throw createError(ErrorCode.INVALID_CONFIG, 'gatrixUrl must be a valid URL');
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

    try {
      // Initialize cache manager
      const cacheConfig = this.config.cache || {};
      this.cacheManager = new CacheManager(
        cacheConfig,
        this.gameWorld,
        this.popupNotice,
        this.survey,
        this.whitelist,
        this.apiClient,
        this.logger
      );

      await this.cacheManager.initialize();

      // Initialize event listener only if using event-based refresh method
      const refreshMethod = cacheConfig.refreshMethod ?? 'polling';
      if (this.config.redis && refreshMethod === 'event') {
        this.eventListener = new EventListener(this.config.redis, this.cacheManager, this.logger);
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
   * Get all game worlds
   */
  async getGameWorlds(lang: string = 'en'): Promise<GameWorld[]> {
    return await this.gameWorld.list(lang);
  }

  /**
   * Get game world by ID
   */
  async getGameWorldById(id: number): Promise<GameWorld> {
    return await this.gameWorld.getById(id);
  }

  /**
   * Get game world by worldId
   */
  async getGameWorldByWorldId(worldId: string): Promise<GameWorld> {
    return await this.gameWorld.getByWorldId(worldId);
  }

  /**
   * Get cached game worlds
   */
  getCachedGameWorlds(): GameWorld[] {
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
  getMaintenanceMessage(worldId: string): string | undefined {
    return this.gameWorld.getMaintenanceMessage(worldId);
  }

  // ============================================================================
  // Popup Notice Methods
  // ============================================================================

  /**
   * Get active popup notices
   */
  async getPopupNotices(): Promise<PopupNotice[]> {
    return await this.popupNotice.list();
  }

  /**
   * Get cached popup notices
   */
  getCachedPopupNotices(): PopupNotice[] {
    return this.popupNotice.getCached();
  }

  /**
   * Get popup notices for a specific world
   */
  getPopupNoticesForWorld(worldId: string): PopupNotice[] {
    return this.popupNotice.getNoticesForWorld(worldId);
  }

  /**
   * Get active popup notices that are currently visible
   * Filters by isActive status and date range (startDate/endDate)
   * Sorted by displayPriority
   * @returns Array of active popup notices, empty array if none match
   */
  getActivePopupNotices(): PopupNotice[] {
    return this.popupNotice.getActivePopupNotices();
  }

  // ============================================================================
  // Survey Methods
  // ============================================================================

  /**
   * Get surveys with settings
   */
  async getSurveys(): Promise<{ surveys: Survey[]; settings: SurveySettings }> {
    return await this.survey.list({ isActive: true });
  }

  /**
   * Get cached surveys with settings
   */
  getCachedSurveys(): { surveys: Survey[]; settings: SurveySettings | null } {
    return {
      surveys: this.survey.getCached(),
      settings: this.survey.getCachedSettings(),
    };
  }

  /**
   * Get active surveys
   */
  getActiveSurveys(): Survey[] {
    return this.survey.getActiveSurveys();
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
   * Check appropriate surveys for a user based on their conditions
   * Filters surveys based on platform, channel, subchannel, world, and trigger conditions
   * @param platform User's platform (e.g., 'pc', 'ios', 'android')
   * @param channel User's channel (e.g., 'steam', 'epic')
   * @param subChannel User's subchannel (e.g., 'pc', 'ios')
   * @param worldId User's world ID
   * @param userLevel User's level
   * @param joinDays User's join days
   * @returns Array of appropriate surveys, empty array if none match
   */
  checkAppropriateSurveys(
    platform: string,
    channel: string,
    subChannel: string,
    worldId: string,
    userLevel: number,
    joinDays: number
  ): Survey[] {
    return this.survey.checkAppropriateSurveys(platform, channel, subChannel, worldId, userLevel, joinDays);
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

  // ============================================================================
  // Event Methods
  // ============================================================================

  /**
   * Register event listener
   * Works with both event-based and polling refresh methods
   * Returns a function to unregister the listener
   */
  on(eventType: string, callback: EventCallback): () => void {
    const refreshMethod = this.config.cache?.refreshMethod ?? 'polling';

    // For event-based refresh, use EventListener
    if (refreshMethod === 'event') {
      if (!this.eventListener) {
        this.logger.warn('Event listener not initialized. Events will not be received.');
        return () => {}; // Return no-op function
      }
      return this.eventListener.on(eventType, callback);
    }
    // For polling refresh, register callback with CacheManager
    else if (refreshMethod === 'polling') {
      if (!this.cacheManager) {
        this.logger.warn('Cache manager not initialized.');
        return () => {}; // Return no-op function
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

    return () => {}; // Return no-op function as fallback
  }

  /**
   * Unregister event listener
   */
  off(eventType: string, callback: EventCallback): void {
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
   * Get services with filtering via Backend API
   * @param params - Filter parameters (serviceType, group, status, labels, excludeSelf)
   */
  async getServices(params?: GetServicesParams): Promise<ServiceInstance[]> {
    return await this.serviceDiscovery.getServices(params);
  }

  /**
   * Get a specific service instance via Backend API
   */
  async getService(serviceType: string, instanceId: string): Promise<ServiceInstance | null> {
    return await this.serviceDiscovery.getService(serviceType, instanceId);
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
   * Check if service type is in maintenance
   */
  async isServiceInMaintenance(serviceType: string): Promise<boolean> {
    return await this.serviceDiscovery.isServiceInMaintenance(serviceType);
  }

  /**
   * Get maintenance message for service type
   */
  async getServiceMaintenanceMessage(serviceType: string, lang?: 'ko' | 'en' | 'zh'): Promise<string | null> {
    return await this.serviceDiscovery.getServiceMaintenanceMessage(serviceType, lang);
  }

  /**
   * Get whitelists (IP and Account)
   */
  async getWhitelists() {
    return await this.serviceDiscovery.getWhitelists();
  }

  /**
   * Check if IP is whitelisted
   */
  async isIpWhitelisted(ip: string): Promise<boolean> {
    return await this.serviceDiscovery.isIpWhitelisted(ip);
  }

  /**
   * Check if account is whitelisted
   */
  async isAccountWhitelisted(accountId: string): Promise<boolean> {
    return await this.serviceDiscovery.isAccountWhitelisted(accountId);
  }

  // ============================================================================
  // Whitelist Cache Methods
  // ============================================================================

  /**
   * Get cached whitelists (IP and Account)
   * Returns cached data without making API call
   */
  getCachedWhitelists() {
    if (!this.cacheManager) {
      this.logger.warn('Cache manager not initialized');
      return { ipWhitelist: [], accountWhitelist: [] };
    }
    return this.cacheManager.getCachedWhitelists();
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
      this.logger.info('SDK가 종료되었습니다.');
    } catch (error: any) {
      this.logger.error('Error while closing SDK', { error: error.message });
      throw error;
    }
  }
}

// Backward compatibility: export as GatrixSDK as well
export { GatrixServerSDK as GatrixSDK };

