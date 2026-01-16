/**
 * GatrixServerSDK
 * Main SDK class that integrates all services
 */

import { Logger } from './utils/logger';
import { ErrorCode, createError } from './utils/errors';
import { GatrixSDKConfig, GatrixSDKInitOptions } from './types/config';
import { SDK_VERSION } from './version';
import { ApiClient } from './client/ApiClient';
import { CouponService } from './services/CouponService';
import { GameWorldService } from './services/GameWorldService';
import { PopupNoticeService } from './services/PopupNoticeService';
import { SurveyService } from './services/SurveyService';
import { WhitelistService } from './services/WhitelistService';
import { ServiceMaintenanceService } from './services/ServiceMaintenanceService';
import { ServiceDiscoveryService } from './services/ServiceDiscoveryService';
import { StoreProductService } from './services/StoreProductService';
import { CacheManager } from './cache/CacheManager';
import { EventListener } from './cache/EventListener';
import { EventCallback, SdkEvent } from './types/events';
import { SdkMetrics } from './utils/sdkMetrics';
import { createMetricsServer, MetricsServerInstance } from './services/MetricsServer';
import { createHttpMetricsMiddleware } from './utils/httpMetrics';
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
import { detectCloudMetadata, CloudMetadata, CloudProvider } from './utils/cloudMetadata';

/**
 * GatrixServerSDK
 * Server-side SDK for game servers to interact with Gatrix backend
 */
export class GatrixServerSDK {
  private config: GatrixSDKConfig;
  private logger: Logger;
  private apiClient: ApiClient;
  private initialized: boolean = false;

  // Services (non-cacheable - created directly in constructor)
  public readonly coupon: CouponService;
  public readonly serviceDiscovery: ServiceDiscoveryService;

  // Cache and Events
  private cacheManager?: CacheManager;
  private eventListener?: EventListener;
  private metrics?: SdkMetrics;
  private metricsServer?: MetricsServerInstance;
  private httpRegistry?: any; // prom-client Registry
  private userRegistry?: any; // prom-client Registry

  // Maintenance event listeners (separate from standard event listeners)
  private maintenanceEventListeners: Map<string, EventCallback[]> = new Map();

  // Cloud metadata (auto-detected on initialization)
  private cloudMetadata: CloudMetadata = { provider: 'unknown' };

  // Connection recovery handling
  private connectionRecoveryUnsubscribe?: () => void;
  private isRefreshingAfterRecovery: boolean = false;
  private connectionEventListeners: Map<string, EventCallback[]> = new Map();

  /**
   * Create SDK instance with optional overrides
   * Merges override options with base config, allowing per-program customization.
   *
   * @param baseConfig - Base SDK configuration (shared across programs)
   * @param overrides - Optional overrides for specific program/service
   * @returns New GatrixServerSDK instance with merged configuration
   *
   * @example
   * ```typescript
   * // Base config from config file
   * const baseConfig: GatrixSDKConfig = {
   *   gatrixUrl: 'https://api.gatrix.com',
   *   apiToken: 'my-token',
   *   applicationName: 'my-game',
   *   service: 'default-service',
   *   group: 'default-group',
   *   environment: 'production',
   * };
   *
   * // Create instance with overrides for billing worker
   * const sdk = GatrixServerSDK.createInstance(baseConfig, {
   *   service: 'billing-worker',
   *   group: 'payment',
   *   region: 'kr',
   *   logger: { level: 'debug' },
   * });
   * ```
   */
  static createInstance(baseConfig: GatrixSDKConfig, overrides?: GatrixSDKInitOptions): GatrixServerSDK {
    const mergedConfig = GatrixServerSDK.mergeConfig(baseConfig, overrides);
    return new GatrixServerSDK(mergedConfig);
  }

  /**
   * Merge base config with override options
   * Deep merges nested objects (redis, cache, logger, retry, metrics, features).
   *
   * @param baseConfig - Base SDK configuration
   * @param overrides - Optional overrides
   * @returns Merged configuration
   */
  static mergeConfig(baseConfig: GatrixSDKConfig, overrides?: GatrixSDKInitOptions): GatrixSDKConfig {
    if (!overrides) {
      return { ...baseConfig };
    }

    const merged: GatrixSDKConfig = { ...baseConfig };

    // Override simple fields if provided
    if (overrides.service !== undefined) merged.service = overrides.service;
    if (overrides.group !== undefined) merged.group = overrides.group;
    if (overrides.environment !== undefined) merged.environment = overrides.environment;
    if (overrides.gatrixUrl !== undefined) merged.gatrixUrl = overrides.gatrixUrl;
    if (overrides.apiToken !== undefined) merged.apiToken = overrides.apiToken;
    if (overrides.applicationName !== undefined) merged.applicationName = overrides.applicationName;
    if (overrides.worldId !== undefined) merged.worldId = overrides.worldId;
    if (overrides.version !== undefined) merged.version = overrides.version;
    if (overrides.commitHash !== undefined) merged.commitHash = overrides.commitHash;
    if (overrides.gitBranch !== undefined) merged.gitBranch = overrides.gitBranch;
    if (overrides.environments !== undefined) merged.environments = overrides.environments;

    // Deep merge nested objects
    if (overrides.redis) {
      merged.redis = { ...baseConfig.redis, ...overrides.redis } as typeof baseConfig.redis;
    }
    if (overrides.cache) {
      merged.cache = { ...baseConfig.cache, ...overrides.cache };
    }
    if (overrides.logger) {
      merged.logger = { ...baseConfig.logger, ...overrides.logger };
    }
    if (overrides.retry) {
      merged.retry = { ...baseConfig.retry, ...overrides.retry };
    }
    if (overrides.metrics) {
      merged.metrics = { ...baseConfig.metrics, ...overrides.metrics };
    }
    if (overrides.features) {
      merged.features = { ...baseConfig.features, ...overrides.features };
    }
    if (overrides.cloud) {
      merged.cloud = { ...baseConfig.cloud, ...overrides.cloud };
    }

    return merged;
  }

  constructor(config: GatrixSDKConfig) {
    // Set default API token if not provided (for testing)
    const configWithDefaults = {
      ...config,
      apiToken: config.apiToken || 'gatrix-unsecured-server-api-token',
      environment: config.environment || 'development', // Temporary fallback
    };

    // Auto-configure Loki from environment variables if enabled
    /*
    const lokiEnabled = process.env.GATRIX_LOKI_ENABLED === 'true';
    const lokiUrl = process.env.GATRIX_LOKI_URL;

    if (lokiEnabled && lokiUrl) {
      configWithDefaults.logger = {
        ...configWithDefaults.logger,
        loki: {
          enabled: true,
          url: lokiUrl,
          ...(configWithDefaults.logger?.loki || {}),
        }
      };
    }
    */

    // Validate config
    this.validateConfig(configWithDefaults);

    this.config = configWithDefaults;

    // Initialize logger with default Loki labels (inject SDK identity)
    const loggerConfig = { ...configWithDefaults.logger };
    if (loggerConfig.loki) {
      loggerConfig.loki = {
        ...loggerConfig.loki,
        labels: {
          job: 'gatrix',
          service: configWithDefaults.service,
          group: configWithDefaults.group,
          environment: configWithDefaults.environment,
          application: configWithDefaults.applicationName,
          hostname: require('os').hostname(),
          ...loggerConfig.loki.labels,
        },
      };
    }
    this.logger = new Logger(loggerConfig);

    // Initialize metrics first
    this.metrics = new SdkMetrics({
      enabled: configWithDefaults.metrics?.enabled !== false,
      service: configWithDefaults.service,
      group: configWithDefaults.group,
      environment: configWithDefaults.environment,
      applicationName: configWithDefaults.applicationName,
      registry: configWithDefaults.metrics?.registry,
    });

    // Initialize additional registries if metrics enabled
    if (configWithDefaults.metrics?.enabled !== false) {
      try {
        const promClient = require('prom-client');

        // Use the primary SDK metrics registry if available to avoid merge issues
        // All metrics will be in one place, distinguished by their names (sdk_ vs app_ vs game_)
        const mainRegistry = this.metrics?.getRegistry() || new promClient.Registry();

        // Registry for HTTP middleware metrics (both private/public)
        this.httpRegistry = mainRegistry;

        // Only set default labels if they haven't been set yet
        // SdkMetrics already sets them, so we skip if it's the same registry
        if (!this.metrics?.getRegistry()) {
          this.httpRegistry.setDefaultLabels({
            sdk: 'gatrix-server-sdk',
            service: configWithDefaults.service,
            group: configWithDefaults.group,
            environment: configWithDefaults.environment,
            application: configWithDefaults.applicationName,
          });
        }


        // Registry for user-specific custom metrics or default Node.js metrics
        if (configWithDefaults.metrics?.userMetricsEnabled || configWithDefaults.metrics?.collectDefaultMetrics !== false) {
          this.userRegistry = mainRegistry;
        }
      } catch (_e) {
        // Silently fail if prom-client is not available
      }
    }

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

    // Initialize non-cacheable services only
    // Cacheable services (gameWorld, popupNotice, survey, whitelist, serviceMaintenance, storeProduct, etc.)
    // are created by CacheManager based on feature flags
    this.coupon = new CouponService(this.apiClient, this.logger);
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

    // Validate environments config
    // - '*' means wildcard mode (fetch all environments from backend)
    // - Array of strings means explicit mode (use only specified environments)
    // - Cannot mix '*' with specific environments
    if (config.environments !== undefined) {
      if (Array.isArray(config.environments)) {
        if (config.environments.includes('*')) {
          if (config.environments.length > 1) {
            throw createError(
              ErrorCode.INVALID_CONFIG,
              'environments cannot mix "*" with specific environment names. Use either "*" for all environments or an array of specific environment names.'
            );
          }
        }
      } else if (config.environments !== '*') {
        throw createError(
          ErrorCode.INVALID_CONFIG,
          'environments must be "*" or an array of environment names'
        );
      }
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
      // Auto-detect cloud provider and metadata (region, zone, instance ID, etc.)
      // This runs in the background and doesn't block initialization
      const cloudProvider = this.config.cloud?.provider as CloudProvider | undefined;
      this.cloudMetadata = await detectCloudMetadata(cloudProvider);
      if (this.cloudMetadata.provider !== 'unknown') {
        this.logger.info('Cloud metadata detected', {
          provider: this.cloudMetadata.provider,
          region: this.cloudMetadata.region,
          zone: this.cloudMetadata.zone,
          instanceId: this.cloudMetadata.instanceId,
        });
      } else {
        this.logger.debug('No cloud metadata detected (not running in a cloud environment)');
      }

      // Initialize cache manager
      // CacheManager creates all services internally based on feature flags
      const cacheConfig = this.config.cache || {};
      const defaultEnv = this.config.environment || 'development';
      this.cacheManager = new CacheManager(
        cacheConfig,
        this.apiClient,
        this.logger,
        defaultEnv,
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

      // Register connection recovery callback to refresh stale cache data
      // When connection is restored after retries, cached data may be stale
      // This ensures cache is refreshed with latest data from backend
      this.registerConnectionRecoveryHandler();

      // Initialize event listener only if using event-based refresh method
      const refreshMethod = cacheConfig.refreshMethod ?? 'polling';
      if (this.config.redis && refreshMethod === 'event') {
        this.eventListener = new EventListener(this.config.redis, this.cacheManager, this.logger, this.metrics);
        await this.eventListener.initialize();
      }

      this.initialized = true;

      // Initialize metrics server if enabled
      if (this.config.metrics?.serverEnabled && !this.metricsServer) {
        // Collect unique registries to merge in MetricsServer
        const primaryRegistry = this.metrics?.getRegistry();
        const registrySet = new Set<any>();

        if (primaryRegistry) {
          registrySet.add(primaryRegistry);
        }

        if (this.httpRegistry) {
          registrySet.add(this.httpRegistry);
        }

        if (this.userRegistry) {
          registrySet.add(this.userRegistry);
        }

        // Remove the primary from additional before passing
        const additionalRegistries = Array.from(registrySet).filter(reg => reg !== primaryRegistry);

        this.metricsServer = createMetricsServer({
          port: this.config.metrics?.port,
          bindAddress: this.config.metrics?.bindAddress,
          collectDefaultMetrics: this.config.metrics?.collectDefaultMetrics,
          service: this.config.service,
          group: this.config.group,
          environment: this.config.environment,
          applicationName: this.config.applicationName,
          logger: this.logger,
          registry: primaryRegistry as any,
          additionalRegistries,
        });

        this.metricsServer.start();
        this.logger.info('Metrics server started');
      }

      this.logger.info('GatrixServerSDK initialized successfully');
    } catch (error: any) {
      this.logger.error('Failed to initialize SDK', { error: error.message });
      throw error;
    }
  }

  /**
   * Register connection recovery handler to refresh cache when connection is restored
   * This ensures cached data is up-to-date after connection issues
   */
  private registerConnectionRecoveryHandler(): void {
    // Unsubscribe from previous handler if exists (shouldn't happen, but defensive)
    if (this.connectionRecoveryUnsubscribe) {
      this.connectionRecoveryUnsubscribe();
    }

    // Register callback with ApiClient
    this.connectionRecoveryUnsubscribe = this.apiClient.onConnectionRecovered(() => {
      // Emit connection.restored event to listeners
      this.emitConnectionEvent('connection.restored');

      // Skip if already refreshing (prevents concurrent refresh attempts)
      if (this.isRefreshingAfterRecovery) {
        this.logger.debug('Skipping cache refresh - already in progress');
        return;
      }

      // Skip if cache manager is not available
      if (!this.cacheManager) {
        this.logger.debug('Skipping cache refresh - cache manager not initialized');
        return;
      }

      this.isRefreshingAfterRecovery = true;

      this.logger.info('Refreshing cache after connection recovery');

      // Refresh cache asynchronously - don't block the request completion
      this.cacheManager.refreshAll()
        .then(() => {
          this.logger.info('Cache refreshed successfully after connection recovery');
        })
        .catch((error: any) => {
          // Log error but don't throw - cache refresh failure should not affect server operation
          this.logger.warn('Failed to refresh cache after connection recovery', {
            error: error.message,
          });
        })
        .finally(() => {
          this.isRefreshingAfterRecovery = false;
        });
    });

    this.logger.debug('Connection recovery handler registered');
  }

  /**
   * Emit connection event to all registered listeners
   */
  private emitConnectionEvent(eventType: string): void {
    const listeners = this.connectionEventListeners.get(eventType) || [];
    if (listeners.length === 0) {
      return;
    }

    const event: SdkEvent = {
      type: eventType,
      data: {},
      timestamp: new Date().toISOString(),
    };

    for (const callback of listeners) {
      try {
        callback(event);
      } catch (error: any) {
        this.logger.error('Error in connection event callback', {
          eventType,
          error: error.message,
        });
      }
    }
  }

  /**
   * Get internal logger instance
   */
  getLogger(): Logger {
    return this.logger;
  }

  /**
   * Get SDK configuration
   */
  getConfig(): GatrixSDKConfig {
    return this.config;
  }

  /**
   * Get detected cloud metadata
   * Returns information about the cloud provider, region, zone, instance ID, etc.
   * This is auto-detected during SDK initialization.
   */
  getCloudMetadata(): CloudMetadata {
    return this.cloudMetadata;
  }

  /**
   * Get detected region from cloud metadata
   * Returns undefined if not running in a cloud environment or region detection failed
   */
  getRegion(): string | undefined {
    return this.cloudMetadata.region;
  }

  /**
   * Check if SDK is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ============================================================================
  // Service Getters (access services created by CacheManager)
  // ============================================================================

  /**
   * Get GameWorldService instance
   * @throws Error if SDK is not initialized or feature is disabled
   */
  get gameWorld(): GameWorldService {
    const service = this.cacheManager?.getGameWorldService();
    if (!service) {
      throw new Error('GameWorldService is not available. SDK may not be initialized or gameWorld feature is disabled.');
    }
    return service;
  }

  /**
   * Get PopupNoticeService instance
   * @throws Error if SDK is not initialized or feature is disabled
   */
  get popupNotice(): PopupNoticeService {
    const service = this.cacheManager?.getPopupNoticeService();
    if (!service) {
      throw new Error('PopupNoticeService is not available. SDK may not be initialized or popupNotice feature is disabled.');
    }
    return service;
  }

  /**
   * Get SurveyService instance
   * @throws Error if SDK is not initialized or feature is disabled
   */
  get survey(): SurveyService {
    const service = this.cacheManager?.getSurveyService();
    if (!service) {
      throw new Error('SurveyService is not available. SDK may not be initialized or survey feature is disabled.');
    }
    return service;
  }

  /**
   * Get WhitelistService instance
   * @throws Error if SDK is not initialized or feature is disabled
   */
  get whitelist(): WhitelistService {
    const service = this.cacheManager?.getWhitelistService();
    if (!service) {
      throw new Error('WhitelistService is not available. SDK may not be initialized or whitelist feature is disabled.');
    }
    return service;
  }

  /**
   * Get ServiceMaintenanceService instance
   * @throws Error if SDK is not initialized or feature is disabled
   */
  get serviceMaintenance(): ServiceMaintenanceService {
    const service = this.cacheManager?.getServiceMaintenanceService();
    if (!service) {
      throw new Error('ServiceMaintenanceService is not available. SDK may not be initialized or serviceMaintenance feature is disabled.');
    }
    return service;
  }

  /**
   * Get StoreProductService instance
   * @throws Error if SDK is not initialized or feature is disabled
   */
  get storeProduct(): StoreProductService {
    const service = this.cacheManager?.getStoreProductService();
    if (!service) {
      throw new Error('StoreProductService is not available. SDK may not be initialized or storeProduct feature is disabled.');
    }
    return service;
  }

  /**
   * Check if SDK is running in multi-environment mode
   * Multi-environment mode is enabled when:
   * - environments is set to '*' (wildcard mode)
   * - environments is an array with multiple values
   */
  isMultiEnvironmentMode(): boolean {
    return this.config.environments === '*' ||
      (Array.isArray(this.config.environments) && this.config.environments.length > 0);
  }

  /**
   * Get the default environment from SDK config
   * Used in single-environment mode (game servers)
   */
  getDefaultEnvironment(): string {
    return this.config.environment;
  }

  /**
   * Resolve environment parameter
   * In single-environment mode: uses config.environment if not provided
   * In multi-environment mode: throws error if not provided
   *
   * @param environment Optional environment parameter
   * @param methodName Method name for error message
   * @returns Resolved environment name
   */
  private resolveEnvironment(environment: string | undefined, methodName: string): string {
    if (environment) {
      return environment;
    }

    if (this.isMultiEnvironmentMode()) {
      throw new Error(
        `GatrixServerSDK.${methodName}(): environment parameter is required in multi-environment mode`
      );
    }

    return this.config.environment;
  }

  // ============================================================================
  // Coupon Methods
  // ============================================================================

  /**
   * Redeem a coupon
   * @param request Coupon redemption request
   * @param environment Optional in single-env mode, required in multi-env mode
   */
  async redeemCoupon(request: RedeemCouponRequest, environment?: string): Promise<RedeemCouponResponse> {
    const env = this.resolveEnvironment(environment, 'redeemCoupon');
    return await this.coupon.redeem(request, env);
  }

  // ============================================================================
  // Game World Methods
  // ============================================================================

  /**
   * Fetch all game worlds
   * @param environment Optional in single-env mode, required in multi-env mode
   */
  async fetchGameWorlds(environment?: string): Promise<GameWorld[]> {
    const env = this.resolveEnvironment(environment, 'fetchGameWorlds');
    return await this.gameWorld.listByEnvironment(env);
  }

  /**
   * Fetch game world by ID
   * @param id Game world ID
   * @param environment Optional in single-env mode, required in multi-env mode
   */
  async fetchGameWorldById(id: number, environment?: string): Promise<GameWorld> {
    const env = this.resolveEnvironment(environment, 'fetchGameWorldById');
    return await this.gameWorld.getById(id, env);
  }

  /**
   * Fetch game world by worldId
   * @param worldId World ID string
   * @param environment Optional in single-env mode, required in multi-env mode
   */
  async fetchGameWorldByWorldId(worldId: string, environment?: string): Promise<GameWorld> {
    const env = this.resolveEnvironment(environment, 'fetchGameWorldByWorldId');
    return await this.gameWorld.getByWorldId(worldId, env);
  }

  /**
   * Get cached game worlds
   * @param environment Environment name. Optional in single-env mode, required in multi-env mode.
   */
  getGameWorlds(environment?: string): GameWorld[] {
    const env = this.resolveEnvironment(environment, 'getGameWorlds');
    return this.gameWorld.getCached(env);
  }

  /**
   * Check if a world is in maintenance (time-based check)
   * @param worldId World ID
   * @param environment Environment name. Optional in single-env mode, required in multi-env mode.
   */
  isWorldMaintenanceActive(worldId: string, environment?: string): boolean {
    const env = this.resolveEnvironment(environment, 'isWorldMaintenanceActive');
    return this.gameWorld.isWorldMaintenanceActive(worldId, env);
  }

  /**
   * Get maintenance message for a world
   * @param worldId World ID
   * @param environment Environment name. Optional in single-env mode, required in multi-env mode.
   * @param lang Language code (default: 'en')
   */
  getWorldMaintenanceMessage(worldId: string, environment?: string, lang: 'ko' | 'en' | 'zh' = 'en'): string | null {
    const env = this.resolveEnvironment(environment, 'getWorldMaintenanceMessage');
    return this.gameWorld.getWorldMaintenanceMessage(worldId, env, lang);
  }

  /**
   * Fetch global service maintenance status
   * @param environment Optional in single-env mode, required in multi-env mode
   */
  async fetchServiceMaintenanceStatus(environment?: string) {
    const env = this.resolveEnvironment(environment, 'fetchServiceMaintenanceStatus');
    return await this.serviceMaintenance.getStatusByEnvironment(env);
  }

  /**
   * Get cached global service maintenance status
   * @param environment Optional in single-env mode, required in multi-env mode
   */
  getServiceMaintenanceStatus(environment?: string) {
    const env = this.resolveEnvironment(environment, 'getServiceMaintenanceStatus');
    return this.serviceMaintenance.getCached(env);
  }

  /**
   * Check if global service is currently in maintenance (time-based check)
   * @param environment Optional in single-env mode, required in multi-env mode
   */
  isServiceMaintenanceActive(environment?: string): boolean {
    const env = this.resolveEnvironment(environment, 'isServiceMaintenanceActive');
    return this.serviceMaintenance.isMaintenanceActive(env);
  }

  /**
   * Get localized maintenance message for global service
   * @param lang Language code
   * @param environment Optional in single-env mode, required in multi-env mode
   */
  getServiceMaintenanceMessage(lang: 'ko' | 'en' | 'zh' = 'en', environment?: string): string | null {
    const env = this.resolveEnvironment(environment, 'getServiceMaintenanceMessage');
    return this.serviceMaintenance.getMessage(lang, env);
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
   * @param environment Environment name. Optional in single-env mode, required in multi-env mode.
   * @returns CurrentMaintenanceStatus with isMaintenanceActive, source, and detail
   */
  getCurrentMaintenanceStatus(environment?: string): CurrentMaintenanceStatus {
    const env = this.resolveEnvironment(environment, 'getCurrentMaintenanceStatus');

    // Check global service maintenance first (uses time calculation internally)
    if (this.serviceMaintenance.isMaintenanceActive(env)) {
      const status = this.serviceMaintenance.getCached(env);
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

    if (targetWorldId && this.gameWorld.isWorldMaintenanceActive(targetWorldId, env)) {
      const world = this.gameWorld.getWorldByWorldId(targetWorldId, env);
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
   * @param environment Environment name. Optional in single-env mode, required in multi-env mode.
   * @returns true if either global service or world(s) is in maintenance
   */
  isMaintenanceActive(worldId?: string, environment?: string): boolean {
    const env = this.resolveEnvironment(environment, 'isMaintenanceActive');

    // First check global service maintenance
    if (this.serviceMaintenance.isMaintenanceActive(env)) {
      return true;
    }

    // Determine target world ID
    const targetWorldId = worldId ?? this.config.worldId;

    // If specific worldId is specified, check only that world
    if (targetWorldId) {
      return this.gameWorld.isWorldMaintenanceActive(targetWorldId, env);
    }

    // If no worldId specified, check ALL worlds (world-wide service mode)
    const allWorlds = this.gameWorld.getCached(env);
    for (const world of allWorlds) {
      if (world.worldId && this.gameWorld.isWorldMaintenanceActive(world.worldId, env)) {
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
   * @param environment Environment name. Optional in single-env mode, required in multi-env mode.
   */
  getMaintenanceInfo(worldId?: string, lang: 'ko' | 'en' | 'zh' = 'en', environment?: string): MaintenanceInfo {
    const env = this.resolveEnvironment(environment, 'getMaintenanceInfo');
    const targetWorldId = worldId ?? this.config.worldId;

    // Check global service maintenance first
    if (this.serviceMaintenance.isMaintenanceActive(env)) {
      const status = this.serviceMaintenance.getCached(env);
      const actualStartTime = this.cacheManager?.getServiceMaintenanceActualStartTime() ?? null;
      return {
        isMaintenanceActive: true,
        source: 'service',
        message: this.serviceMaintenance.getMessage(lang, env),
        forceDisconnect: status?.detail?.kickExistingPlayers ?? false,
        gracePeriodMinutes: status?.detail?.kickDelayMinutes ?? 0,
        startsAt: status?.detail?.startsAt ?? null,
        endsAt: status?.detail?.endsAt ?? null,
        actualStartTime,
      };
    }

    // If specific worldId is specified, check that world
    if (targetWorldId && this.gameWorld.isWorldMaintenanceActive(targetWorldId, env)) {
      const world = this.gameWorld.getWorldByWorldId(targetWorldId, env);
      const actualStartTime = this.cacheManager?.getWorldMaintenanceActualStartTime(targetWorldId) ?? null;
      return {
        isMaintenanceActive: true,
        source: 'world',
        worldId: targetWorldId,
        message: this.gameWorld.getWorldMaintenanceMessage(targetWorldId, env, lang),
        forceDisconnect: world?.forceDisconnect ?? false,
        gracePeriodMinutes: world?.gracePeriodMinutes ?? 0,
        startsAt: world?.maintenanceStartDate ?? null,
        endsAt: world?.maintenanceEndDate ?? null,
        actualStartTime,
      };
    }

    // If no worldId specified, check ALL worlds and return first one in maintenance
    if (!targetWorldId) {
      const allWorlds = this.gameWorld.getCached(env);
      for (const world of allWorlds) {
        if (world.worldId && this.gameWorld.isWorldMaintenanceActive(world.worldId, env)) {
          const actualStartTime = this.cacheManager?.getWorldMaintenanceActualStartTime(world.worldId) ?? null;
          return {
            isMaintenanceActive: true,
            source: 'world',
            worldId: world.worldId,
            message: this.gameWorld.getWorldMaintenanceMessage(world.worldId, env, lang),
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
   * @param environment Optional in single-env mode, required in multi-env mode
   */
  async fetchPopupNotices(environment?: string): Promise<PopupNotice[]> {
    const env = this.resolveEnvironment(environment, 'fetchPopupNotices');
    return await this.popupNotice.listByEnvironment(env);
  }

  /**
   * Get cached popup notices
   * @param environment Environment name. Optional in single-env mode, required in multi-env mode.
   */
  getPopupNotices(environment?: string): PopupNotice[] {
    const env = this.resolveEnvironment(environment, 'getPopupNotices');
    return this.popupNotice.getCached(env);
  }

  /**
   * Get popup notices for a specific world
   * @param worldId World ID
   * @param environment Environment name. Optional in single-env mode, required in multi-env mode.
   */
  getPopupNoticesForWorld(worldId: string, environment?: string): PopupNotice[] {
    const env = this.resolveEnvironment(environment, 'getPopupNoticesForWorld');
    return this.popupNotice.getNoticesForWorld(worldId, env);
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
    const env = this.resolveEnvironment(options?.environment, 'getActivePopupNotices');
    return this.popupNotice.getActivePopupNotices({ ...options, environment: env });
  }

  // ============================================================================
  // Store Product Methods
  // ============================================================================

  /**
   * Fetch all store products
   * @param environment Environment name. Optional in single-env mode, required in multi-env mode.
   */
  async fetchStoreProducts(environment?: string): Promise<StoreProduct[]> {
    const env = this.resolveEnvironment(environment, 'fetchStoreProducts');
    return await this.storeProduct.listByEnvironment(env);
  }

  /**
   * Get cached store products
   * @param environment Environment name. Optional in single-env mode, required in multi-env mode.
   */
  getStoreProducts(environment?: string): StoreProduct[] {
    const env = this.resolveEnvironment(environment, 'getStoreProducts');
    return this.storeProduct.getCached(env);
  }

  /**
   * Get active store products (filtered by time and status)
   * @param environment Environment name. Optional in single-env mode, required in multi-env mode.
   */
  getActiveStoreProducts(environment?: string): StoreProduct[] {
    const env = this.resolveEnvironment(environment, 'getActiveStoreProducts');
    return this.storeProduct.getActive(env);
  }

  /**
   * Get store product by ID
   * @param id Store product ID
   * @param environment Environment name. Optional in single-env mode, required in multi-env mode.
   */
  async getStoreProductById(id: string, environment?: string): Promise<StoreProduct> {
    const env = this.resolveEnvironment(environment, 'getStoreProductById');
    return await this.storeProduct.getById(id, env);
  }

  // ============================================================================
  // Survey Methods
  // ============================================================================

  /**
   * Fetch surveys with settings
   * @param environment Optional in single-env mode, required in multi-env mode
   */
  async fetchSurveys(environment?: string): Promise<{ surveys: Survey[]; settings: SurveySettings }> {
    const env = this.resolveEnvironment(environment, 'fetchSurveys');
    return await this.survey.listByEnvironment(env, { isActive: true });
  }

  /**
   * Get cached surveys with settings
   * @param environment Environment name. Only used in multi-environment mode (Edge).
   *                    For game servers, can be omitted to use default environment.
   *                    For edge servers, must be provided from client request.
   */
  getSurveys(environment?: string): { surveys: Survey[]; settings: SurveySettings | null } {
    const env = this.resolveEnvironment(environment, 'getSurveys');
    return {
      surveys: this.survey.getCached(env),
      settings: this.survey.getCachedSettings(env),
    };
  }

  /**
   * Get surveys for a specific world
   * @param environment Environment name. Only used in multi-environment mode.
   */
  getSurveysForWorld(worldId: string, environment?: string): Survey[] {
    const env = this.resolveEnvironment(environment, 'getSurveysForWorld');
    return this.survey.getSurveysForWorld(worldId, env);
  }

  /**
   * Update survey settings only
   * Called when survey settings change (e.g., survey configuration updates)
   * @param environment Environment name. Only used in multi-environment mode.
   */
  updateSurveySettings(newSettings: SurveySettings, environment?: string): void {
    const env = this.resolveEnvironment(environment, 'updateSurveySettings');
    this.survey.updateSettings(newSettings, env);
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
    const env = this.resolveEnvironment(environment, 'getActiveSurveys');
    return this.survey.getActiveSurveys(platform, channel, subChannel, worldId, userLevel, joinDays, env);
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
   * @param environment Optional in single-env mode, required in multi-env mode
   */
  async refreshGameWorldsCache(environment?: string): Promise<void> {
    if (!this.cacheManager) {
      throw createError(ErrorCode.NOT_INITIALIZED, 'Cache manager not initialized');
    }
    const env = this.resolveEnvironment(environment, 'refreshGameWorldsCache');
    await this.cacheManager.refreshGameWorlds(env);
  }

  /**
   * Refresh popup notices cache
   * @param environment Optional in single-env mode, required in multi-env mode
   */
  async refreshPopupNoticesCache(environment?: string): Promise<void> {
    if (!this.cacheManager) {
      throw createError(ErrorCode.NOT_INITIALIZED, 'Cache manager not initialized');
    }
    const env = this.resolveEnvironment(environment, 'refreshPopupNoticesCache');
    await this.cacheManager.refreshPopupNotices(env);
  }

  /**
   * Refresh surveys cache
   * @param environment Optional in single-env mode, required in multi-env mode
   */
  async refreshSurveysCache(environment?: string): Promise<void> {
    if (!this.cacheManager) {
      throw createError(ErrorCode.NOT_INITIALIZED, 'Cache manager not initialized');
    }
    const env = this.resolveEnvironment(environment, 'refreshSurveysCache');
    await this.cacheManager.refreshSurveys(env);
  }

  /**
   * Refresh service maintenance cache
   * @param environment Optional in single-env mode, required in multi-env mode
   */
  async refreshServiceMaintenanceCache(environment?: string): Promise<void> {
    if (!this.cacheManager) {
      throw createError(ErrorCode.NOT_INITIALIZED, 'Cache manager not initialized');
    }
    const env = this.resolveEnvironment(environment, 'refreshServiceMaintenanceCache');
    await this.cacheManager.refreshServiceMaintenance(env);
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
   * Also supports connection.restored event (triggered when API connection is recovered after retries)
   * Returns a function to unregister the listener
   */
  on(eventType: string, callback: EventCallback): () => void {
    // Handle connection events
    if (eventType === 'connection.restored') {
      const listeners = this.connectionEventListeners.get(eventType) || [];
      listeners.push(callback);
      this.connectionEventListeners.set(eventType, listeners);

      // Return unsubscribe function
      return () => {
        const currentListeners = this.connectionEventListeners.get(eventType) || [];
        this.connectionEventListeners.set(
          eventType,
          currentListeners.filter((cb) => cb !== callback)
        );
      };
    }

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
        // Wrap in try-catch to prevent user callback errors from affecting SDK
        try {
          callback({
            type: type,
            data: data,
            timestamp: new Date().toISOString(),
          });
        } catch (error: any) {
          this.logger.error('Error in user event callback', {
            eventType: type,
            error: error.message,
          });
        }
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
   * Note: metricsApi port is automatically added from SDK config (default: 9337) if not provided in input.ports
   * Note: environment and region labels are automatically added from SDK config if not provided
   * Note: version, commitHash, gitBranch are automatically added to meta from SDK config if provided
   */
  async registerService(input: RegisterServiceInput): Promise<{ instanceId: string; hostname: string; internalAddress: string; externalAddress: string }> {
    // Auto-add environment and region labels from SDK config if not already provided
    const enhancedLabels: RegisterServiceInput['labels'] = {
      ...input.labels,
    };

    // Add environment from SDK config if not provided in labels
    if (this.config.environment && !input.labels.environment) {
      enhancedLabels.environment = this.config.environment;
    }

    // Add cloud metadata labels (auto-detected, always override any input)
    // Use 'cloud' prefix to avoid conflicts with other fields (e.g., instanceId from service registration)
    if (this.cloudMetadata.provider !== 'unknown') {
      enhancedLabels.cloudProvider = this.cloudMetadata.provider;
    }
    if (this.cloudMetadata.region) {
      enhancedLabels.cloudRegion = this.cloudMetadata.region;
    }
    if (this.cloudMetadata.zone) {
      enhancedLabels.cloudZone = this.cloudMetadata.zone;
    }
    if (this.cloudMetadata.instanceId) {
      enhancedLabels.cloudInstanceId = this.cloudMetadata.instanceId;
    }

    // Always add SDK version to labels
    enhancedLabels.sdkVersion = SDK_VERSION;

    // Build ports with metricsApi fallback (use input.ports.metricsApi if provided, otherwise use SDK config default)
    const enhancedPorts = { ...input.ports };
    if (!enhancedPorts.metricsApi) {
      const metricsPort = this.config.metrics?.port ?? parseInt(process.env.SDK_METRICS_PORT || '9337', 10);
      enhancedPorts.metricsApi = metricsPort;
    }

    // Build meta with version info from SDK config (merged with input.meta)
    const enhancedMeta: Record<string, any> = { ...input.meta };
    if (this.config.version) {
      enhancedMeta.version = this.config.version;
    }
    if (this.config.commitHash) {
      enhancedMeta.commitHash = this.config.commitHash;
    }
    if (this.config.gitBranch) {
      enhancedMeta.gitBranch = this.config.gitBranch;
    }

    const inputWithEnhancements = {
      ...input,
      labels: enhancedLabels,
      ports: enhancedPorts,
      meta: Object.keys(enhancedMeta).length > 0 ? enhancedMeta : input.meta,
    };
    const result = await this.serviceDiscovery.register(inputWithEnhancements);
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
   * Create an HTTP metrics middleware for tracking express requests.
   * Supports 'scope' label to distinguish between interfaces (e.g. private, public).
   *
   * @param options - Middleware options
   * @returns Express middleware function
   */
  createHttpMetricsMiddleware(options: { scope?: 'private' | 'public' | string; prefix?: string } = {}) {
    if (!this.httpRegistry) {
      return (_req: any, _res: any, next: any) => next();
    }

    return createHttpMetricsMiddleware({
      registry: this.httpRegistry,
      scope: options.scope,
      prefix: options.prefix || 'game_', // Match dashboard expectation (sdk_http_...)
    });
  }

  /**
   * Get the user-specific metrics registry.
   * Use this to register custom application/game metrics that should be kept separate from SDK metrics.
   * Returns undefined if user metrics are not enabled in config.
   */
  getUserMetricsRegistry(): any | undefined {
    return this.userRegistry;
  }

  /**
   * Get a metrics provider for the user registry.
   * Provides convenient methods to create counters, gauges, and histograms.
   * Returns undefined if user metrics are not enabled in config.
   */
  getUserMetricsProvider(): {
    createCounter: (name: string, help: string, labelNames?: string[]) => any;
    createGauge: (name: string, help: string, labelNames?: string[]) => any;
    createHistogram: (name: string, help: string, labelNames?: string[], buckets?: number[]) => any;
  } | undefined {
    if (!this.userRegistry) return undefined;

    // Lazy require to avoid hard dependency if not used
    const promClient = require('prom-client');
    const registry = this.userRegistry;

    return {
      createCounter(name: string, help: string, labelNames: string[] = []): any {
        return new promClient.Counter({ name, help, labelNames, registers: [registry] });
      },
      createGauge(name: string, help: string, labelNames: string[] = []): any {
        return new promClient.Gauge({ name, help, labelNames, registers: [registry] });
      },
      createHistogram(name: string, help: string, labelNames: string[] = [], buckets: number[] = [0.005, 0.01, 0.05, 0.1, 0.3, 1, 3, 5, 10]): any {
        return new promClient.Histogram({ name, help, labelNames, buckets, registers: [registry] });
      },
    };
  }

  /**
   * Fetch whitelists (IP and Account)
   * Performs API call via WhitelistService and updates cache
   * @param environment Optional in single-env mode, required in multi-env mode
   */
  async fetchWhitelists(environment?: string) {
    const env = this.resolveEnvironment(environment, 'fetchWhitelists');
    return await this.whitelist.listByEnvironment(env);
  }

  /**
   * Check if IP is whitelisted using cached data
   * Note: Uses WhitelistService cache; call fetchWhitelists or initialize cache beforehand.
   * @param ip IP address to check
   * @param environment Optional in single-env mode, required in multi-env mode
   */
  async isIpWhitelisted(ip: string, environment?: string): Promise<boolean> {
    const env = this.resolveEnvironment(environment, 'isIpWhitelisted');
    return this.whitelist.isIpWhitelisted(ip, env);
  }

  /**
   * Check if account is whitelisted using cached data
   * Note: Uses WhitelistService cache; call fetchWhitelists or initialize cache beforehand.
   * @param accountId Account ID to check
   * @param environment Optional in single-env mode, required in multi-env mode
   */
  async isAccountWhitelisted(accountId: string, environment?: string): Promise<boolean> {
    const env = this.resolveEnvironment(environment, 'isAccountWhitelisted');
    return this.whitelist.isAccountWhitelisted(accountId, env);
  }

  // ============================================================================
  // Whitelist Cache Methods
  // ============================================================================

  /**
   * Get cached whitelists (IP and Account)
   * Returns cached data without making API call
   * @param environment Optional in single-env mode, required in multi-env mode
   */
  getWhitelists(environment?: string) {
    if (!this.cacheManager) {
      this.logger.warn('Cache manager not initialized');
      return { ipWhitelist: [], accountWhitelist: [] };
    }
    const env = this.resolveEnvironment(environment, 'getWhitelists');
    return this.cacheManager.getWhitelists(env);
  }

  /**
   * Refresh whitelist cache
   * @param environment Optional in single-env mode, required in multi-env mode
   */
  async refreshWhitelistCache(environment?: string): Promise<void> {
    if (!this.cacheManager) {
      throw createError(ErrorCode.INVALID_CONFIG, 'Cache manager not initialized');
    }
    const env = this.resolveEnvironment(environment, 'refreshWhitelistCache');
    await this.cacheManager.refreshWhitelists(env);
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
   * @param environment Environment name. Optional in single-env mode, required in multi-env mode.
   */
  getClientVersions(environment?: string): ClientVersion[] {
    if (!this.cacheManager) {
      this.logger.warn('SDK not initialized');
      return [];
    }
    const env = this.resolveEnvironment(environment, 'getClientVersions');
    return this.cacheManager.getClientVersions(env);
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
   * @param environment Environment name. Optional in single-env mode, required in multi-env mode.
   */
  getServiceNotices(environment?: string): ServiceNotice[] {
    if (!this.cacheManager) {
      this.logger.warn('SDK not initialized');
      return [];
    }
    const env = this.resolveEnvironment(environment, 'getServiceNotices');
    return this.cacheManager.getServiceNotices(env);
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
   * @param environment Environment name. Optional in single-env mode, required in multi-env mode.
   */
  getBanners(environment?: string): Banner[] {
    if (!this.cacheManager) {
      this.logger.warn('SDK not initialized');
      return [];
    }
    const env = this.resolveEnvironment(environment, 'getBanners');
    return this.cacheManager.getBanners(env);
  }

  /**
   * Get BannerService for advanced operations
   * Returns undefined if features.banner is not enabled
   */
  getBannerService() {
    return this.cacheManager?.getBannerService();
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

  /**
   * Get last cache refresh timestamp
   */
  getLastRefreshedAt(): Date | null {
    return this.cacheManager?.getLastRefreshedAt() ?? null;
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
      // Unsubscribe from connection recovery handler
      if (this.connectionRecoveryUnsubscribe) {
        this.connectionRecoveryUnsubscribe();
        this.connectionRecoveryUnsubscribe = undefined;
      }

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

      // Stop metrics server
      if (this.metricsServer) {
        await this.metricsServer.stop();
        this.metricsServer = undefined;
      }

      this.initialized = false;

      this.logger.info('GatrixServerSDK closed successfully');
    } catch (error: any) {
      this.logger.error('Error while closing SDK', { error: error.message });
      throw error;
    }
  }
}
