/**
 * Gatrix Server SDK
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
import { ServiceDiscoveryService } from './services/ServiceDiscoveryService';
import { CacheManager } from './cache/CacheManager';
import { EventListener } from './cache/EventListener';
import { ServiceDiscovery } from './discovery/ServiceDiscovery';
import { EventCallback } from './types/events';
import {
  RedeemCouponRequest,
  RedeemCouponResponse,
  GameWorld,
  PopupNotice,
  Survey,
  ServiceInstance,
  RegisterServiceInput,
  UpdateServiceStatusInput,
  GetServicesParams,
} from './types/api';

export class GatrixSDK {
  private config: GatrixSDKConfig;
  private logger: Logger;
  private apiClient: ApiClient;
  private initialized: boolean = false;

  // Services
  public readonly coupon: CouponService;
  public readonly gameWorld: GameWorldService;
  public readonly popupNotice: PopupNoticeService;
  public readonly survey: SurveyService;
  public readonly serviceDiscoveryService: ServiceDiscoveryService;

  // Cache and Events
  private cacheManager?: CacheManager;
  private eventListener?: EventListener;

  // Service Discovery
  private serviceDiscovery?: ServiceDiscovery;

  constructor(config: GatrixSDKConfig) {
    // Validate config
    this.validateConfig(config);

    this.config = config;

    // Initialize logger
    this.logger = new Logger(config.logger);

    // Initialize API client
    this.apiClient = new ApiClient({
      baseURL: config.gatrixUrl,
      apiToken: config.apiToken,
      applicationName: config.applicationName,
      logger: this.logger,
    });

    // Initialize services
    this.coupon = new CouponService(this.apiClient, this.logger);
    this.gameWorld = new GameWorldService(this.apiClient, this.logger);
    this.popupNotice = new PopupNoticeService(this.apiClient, this.logger);
    this.survey = new SurveyService(this.apiClient, this.logger);
    this.serviceDiscoveryService = new ServiceDiscoveryService(this.apiClient, this.logger);

    this.logger.info('Gatrix SDK created', {
      gatrixUrl: config.gatrixUrl,
      applicationName: config.applicationName,
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
   * - Initialize service discovery
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('SDK already initialized');
      return;
    }

    this.logger.info('Initializing Gatrix SDK...');

    try {
      // Initialize cache manager
      const cacheConfig = this.config.cache || {};
      this.cacheManager = new CacheManager(
        cacheConfig,
        this.gameWorld,
        this.popupNotice,
        this.survey,
        this.logger
      );

      await this.cacheManager.initialize();

      // Initialize event listener if Redis config is provided
      if (this.config.redis && cacheConfig.autoRefresh !== false) {
        this.eventListener = new EventListener(this.config.redis, this.cacheManager, this.logger);
        await this.eventListener.initialize();
      }

      // Initialize service discovery if enabled
      if (this.config.serviceDiscovery?.enabled) {
        this.serviceDiscovery = new ServiceDiscovery(
          this.config.serviceDiscovery,
          this.config.redis,
          this.config.etcd,
          this.logger
        );
      }

      this.initialized = true;

      this.logger.info('Gatrix SDK initialized successfully');
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

  // ============================================================================
  // Survey Methods
  // ============================================================================

  /**
   * Get surveys
   */
  async getSurveys(): Promise<Survey[]> {
    return await this.survey.list({ isActive: true });
  }

  /**
   * Get cached surveys
   */
  getCachedSurveys(): Survey[] {
    return this.survey.getCached();
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
   */
  on(eventType: string, callback: EventCallback): void {
    if (!this.eventListener) {
      this.logger.warn('Event listener not initialized. Events will not be received.');
      return;
    }

    this.eventListener.on(eventType, callback);
  }

  /**
   * Unregister event listener
   */
  off(eventType: string, callback: EventCallback): void {
    if (!this.eventListener) {
      return;
    }

    this.eventListener.off(eventType, callback);
  }

  // ============================================================================
  // Service Discovery Methods
  // ============================================================================

  /**
   * Register this service instance
   */
  async registerService(input: RegisterServiceInput): Promise<string> {
    if (!this.serviceDiscovery) {
      throw createError(ErrorCode.NOT_INITIALIZED, 'Service discovery not initialized');
    }

    const instanceId = await this.serviceDiscovery.register(input);

    // Set instance ID for ServiceDiscoveryService (for excludeSelf filtering)
    this.serviceDiscoveryService.setInstanceId(instanceId);

    return instanceId;
  }

  /**
   * Unregister this service instance
   */
  async unregisterService(): Promise<void> {
    if (!this.serviceDiscovery) {
      return;
    }

    await this.serviceDiscovery.unregister();
  }

  /**
   * Update service status
   */
  async updateServiceStatus(input: UpdateServiceStatusInput): Promise<void> {
    if (!this.serviceDiscovery) {
      throw createError(ErrorCode.NOT_INITIALIZED, 'Service discovery not initialized');
    }

    await this.serviceDiscovery.updateStatus(input);
  }

  /**
   * Get all services or services of a specific type
   */
  async getServices(type?: string): Promise<ServiceInstance[]> {
    if (!this.serviceDiscovery) {
      throw createError(ErrorCode.NOT_INITIALIZED, 'Service discovery not initialized');
    }

    return await this.serviceDiscovery.getServices(type);
  }

  /**
   * Get services with filtering
   * @param params - Filter parameters (type, serviceGroup, status, excludeSelf)
   */
  async getServicesFiltered(params?: GetServicesParams): Promise<ServiceInstance[]> {
    if (!this.serviceDiscovery) {
      throw createError(ErrorCode.NOT_INITIALIZED, 'Service discovery not initialized');
    }

    return await this.serviceDiscovery.getServicesFiltered(params);
  }

  /**
   * Get a specific service instance
   */
  async getService(instanceId: string, type: string): Promise<ServiceInstance | null> {
    if (!this.serviceDiscovery) {
      throw createError(ErrorCode.NOT_INITIALIZED, 'Service discovery not initialized');
    }

    return await this.serviceDiscovery.getService(instanceId, type);
  }

  /**
   * Get services via Backend API (alternative to direct etcd/Redis access)
   * @param params - Filter parameters (type, serviceGroup, status, excludeSelf)
   */
  async getServicesViaAPI(params?: GetServicesParams): Promise<ServiceInstance[]> {
    return await this.serviceDiscoveryService.getServices(params);
  }

  /**
   * Get a specific service instance via Backend API
   */
  async getServiceViaAPI(type: string, instanceId: string): Promise<ServiceInstance | null> {
    return await this.serviceDiscoveryService.getService(type, instanceId);
  }

  /**
   * Get current service instance ID
   */
  getServiceInstanceId(): string | undefined {
    return this.serviceDiscovery?.getInstanceId();
  }

  /**
   * Get current service type
   */
  getServiceType(): string | undefined {
    return this.serviceDiscovery?.getServiceType();
  }

  // ============================================================================
  // Cleanup Methods
  // ============================================================================

  /**
   * Close SDK and cleanup all resources
   */
  async close(): Promise<void> {
    this.logger.info('Closing Gatrix SDK...');

    try {
      // Stop cache auto-refresh
      if (this.cacheManager) {
        this.cacheManager.destroy();
      }

      // Close event listener
      if (this.eventListener) {
        await this.eventListener.close();
      }

      // Close service discovery
      if (this.serviceDiscovery) {
        await this.serviceDiscovery.close();
      }

      this.initialized = false;

      this.logger.info('Gatrix SDK closed successfully');
    } catch (error: any) {
      this.logger.error('Error while closing SDK', { error: error.message });
      throw error;
    }
  }
}

