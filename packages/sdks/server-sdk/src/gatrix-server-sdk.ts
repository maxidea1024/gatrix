/**
 * GatrixServerSDK
 * Main SDK class that integrates all services
 */

import { Logger } from './utils/logger';
import { ErrorCode, createError } from './utils/errors';
import { GatrixSDKConfig, GatrixSDKInitOptions } from './types/config';
import { SDK_VERSION } from './version';
import { ApiClient } from './client/api-client';
import { CouponService } from './services/coupon-service';
import { GameWorldService } from './services/game-world-service';
import { PopupNoticeService } from './services/popup-notice-service';
import { SurveyService } from './services/survey-service';
import { WhitelistService } from './services/whitelist-service';
import { ServiceMaintenanceService } from './services/service-maintenance-service';
import { ServiceDiscoveryService } from './services/service-discovery-service';
import { StoreProductService } from './services/store-product-service';
import { FeatureFlagService } from './services/feature-flag-service';
import { VarsService } from './services/vars-service';
import { CacheManager } from './cache/cache-manager';
import { EventListener } from './cache/event-listener';
import { EventCallback, SdkEvent } from './types/events';
import { SdkMetrics } from './utils/sdk-metrics';
import {
  createMetricsServer,
  MetricsServerInstance,
} from './services/metrics-server';
import { createHttpMetricsMiddleware } from './utils/http-metrics';
import { MaintenanceEventData } from './cache/maintenance-watcher';
import { InMemoryMetricRegistry } from './impact-metrics/metric-types';
import type { ImpactMetricsDataSource } from './impact-metrics/metric-types';
import {
  MetricsAPI,
  ImpactMetricsStaticContext,
} from './impact-metrics/metric-api';
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
import {
  detectCloudMetadata,
  CloudMetadata,
  CloudProvider,
} from './utils/cloud-metadata';

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

  // Impact metrics (application-level metrics for safeguard evaluation)
  private impactMetricRegistry: InMemoryMetricRegistry;
  private impactMetricDataSource: ImpactMetricsDataSource;
  private _impactMetrics: MetricsAPI;

  // Maintenance event listeners (separate from standard event listeners)
  private maintenanceEventListeners: Map<string, EventCallback[]> = new Map();

  // Cloud metadata (auto-detected on initialization)
  private cloudMetadata: CloudMetadata = { provider: 'unknown' };

  // Connection recovery handling
  private connectionRecoveryUnsubscribe?: () => void;
  private isRefreshingAfterRecovery: boolean = false;
  private connectionEventListeners: Map<string, EventCallback[]> = new Map();

  // Impact metrics flush interval
  private impactMetricsFlushInterval: ReturnType<typeof setInterval> | null =
    null;

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
   *   apiUrl: 'https://api.gatrix.com',
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
  static createInstance(
    baseConfig: GatrixSDKConfig,
    overrides?: GatrixSDKInitOptions
  ): GatrixServerSDK {
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
  static mergeConfig(
    baseConfig: GatrixSDKConfig,
    overrides?: GatrixSDKInitOptions
  ): GatrixSDKConfig {
    if (!overrides) {
      return { ...baseConfig };
    }

    const merged: GatrixSDKConfig = { ...baseConfig };

    // Override simple fields if provided
    if (overrides.service !== undefined) merged.service = overrides.service;
    if (overrides.group !== undefined) merged.group = overrides.group;
    if (overrides.apiUrl !== undefined) merged.apiUrl = overrides.apiUrl;
    if (overrides.apiToken !== undefined) merged.apiToken = overrides.apiToken;
    if (overrides.applicationName !== undefined)
      merged.applicationName = overrides.applicationName;
    if (overrides.worldId !== undefined) merged.worldId = overrides.worldId;
    if (overrides.version !== undefined) merged.version = overrides.version;
    if (overrides.commitHash !== undefined)
      merged.commitHash = overrides.commitHash;
    if (overrides.gitBranch !== undefined)
      merged.gitBranch = overrides.gitBranch;
    if (overrides.tokenProvider !== undefined)
      merged.tokenProvider = overrides.tokenProvider;

    // Deep merge nested objects
    if (overrides.redis) {
      merged.redis = {
        ...baseConfig.redis,
        ...overrides.redis,
      } as typeof baseConfig.redis;
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
    if (overrides.uses) {
      merged.uses = { ...baseConfig.uses, ...overrides.uses };
    }
    if (overrides.featureFlags) {
      merged.featureFlags = {
        ...baseConfig.featureFlags,
        ...overrides.featureFlags,
      };
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
          service: configWithDefaults.service || '',
          group: configWithDefaults.group || '',
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
      service: configWithDefaults.service || '',
      group: configWithDefaults.group || '',
      applicationName: configWithDefaults.applicationName,
      registry: configWithDefaults.metrics?.registry,
    });

    // Initialize additional registries if metrics enabled
    if (configWithDefaults.metrics?.enabled !== false) {
      try {
        const promClient = require('prom-client');

        // Use the primary SDK metrics registry if available to avoid merge issues
        // All metrics will be in one place, distinguished by their names (sdk_ vs app_ vs game_)
        const mainRegistry =
          this.metrics?.getRegistry() || new promClient.Registry();

        // Registry for HTTP middleware metrics (both private/public)
        this.httpRegistry = mainRegistry;

        // Only set default labels if they haven't been set yet
        // SdkMetrics already sets them, so we skip if it's the same registry
        if (!this.metrics?.getRegistry()) {
          this.httpRegistry.setDefaultLabels({
            sdk: 'gatrix-server-sdk',
            service: configWithDefaults.service || '',
            group: configWithDefaults.group || '',

            application: configWithDefaults.applicationName,
          });
        }

        // Registry for user-specific custom metrics or default Node.js metrics
        if (
          configWithDefaults.metrics?.userMetricsEnabled ||
          configWithDefaults.metrics?.collectDefaultMetrics !== false
        ) {
          this.userRegistry = mainRegistry;
        }
      } catch (_e) {
        // Silently fail if prom-client is not available
      }
    }

    // Initialize API client (inject metrics for HTTP instrumentation)
    this.apiClient = new ApiClient({
      baseURL: configWithDefaults.apiUrl,
      apiToken: configWithDefaults.apiToken,
      applicationName: configWithDefaults.applicationName,
      logger: this.logger,
      retry: configWithDefaults.retry,
      metrics: this.metrics,
    });

    // Initialize non-cacheable services only
    // Cacheable services (gameWorld, popupNotice, survey, whitelist, serviceMaintenance, storeProduct, etc.)
    // are created by CacheManager based on feature flags
    this.coupon = new CouponService(this.apiClient, this.logger);
    this.serviceDiscovery = new ServiceDiscoveryService(
      this.apiClient,
      this.logger
    );

    // Initialize impact metrics registry + API
    this.impactMetricRegistry = new InMemoryMetricRegistry();
    this.impactMetricDataSource = this.impactMetricRegistry;
    const impactContext: ImpactMetricsStaticContext = {
      appName: configWithDefaults.applicationName,
      service: configWithDefaults.service || '',
    };
    this._impactMetrics = new MetricsAPI(
      this.impactMetricRegistry,
      impactContext,
      this.logger
    );

    this.logger.info('GatrixServerSDK created', {
      apiUrl: configWithDefaults.apiUrl,
      applicationName: configWithDefaults.applicationName,

      apiToken:
        configWithDefaults.apiToken === 'gatrix-unsecured-server-api-token'
          ? 'unsecured (testing)'
          : '***',
    });
  }

  /**
   * Validate SDK configuration
   */
  private validateConfig(config: GatrixSDKConfig): void {
    // Required fields
    if (!config.apiUrl) {
      throw createError(ErrorCode.INVALID_CONFIG, 'apiUrl is required');
    }

    if (!config.apiToken) {
      throw createError(ErrorCode.INVALID_CONFIG, 'apiToken is required');
    }

    if (!config.applicationName) {
      throw createError(
        ErrorCode.INVALID_CONFIG,
        'applicationName is required'
      );
    }

    // service and group are optional

    // environment is now optional (token handles it)
    // if (!config.environment) {
    //   throw createError(ErrorCode.INVALID_CONFIG, 'environment is required');
    // }

    // Validate URL format
    try {
      new URL(config.apiUrl);
    } catch (_error) {
      throw createError(ErrorCode.INVALID_CONFIG, 'apiUrl must be a valid URL');
    }

    // Validate worldId format if provided
    if (config.worldId !== undefined) {
      if (typeof config.worldId !== 'string' || config.worldId.trim() === '') {
        throw createError(
          ErrorCode.INVALID_CONFIG,
          'worldId must be a non-empty string'
        );
      }
    }

    // Validate metrics config
    if (config.metrics) {
      if (
        config.metrics.enabled !== undefined &&
        typeof config.metrics.enabled !== 'boolean'
      ) {
        throw createError(
          ErrorCode.INVALID_CONFIG,
          'metrics.enabled must be a boolean'
        );
      }
    }

    // Validate cache config
    if (config.cache) {
      if (config.cache.ttl !== undefined) {
        if (typeof config.cache.ttl !== 'number' || config.cache.ttl < 0) {
          throw createError(
            ErrorCode.INVALID_CONFIG,
            'cache.ttl must be a non-negative number'
          );
        }
      }

      if (config.cache.refreshMethod !== undefined) {
        if (!['polling', 'event'].includes(config.cache.refreshMethod)) {
          throw createError(
            ErrorCode.INVALID_CONFIG,
            'cache.refreshMethod must be "polling" or "event"'
          );
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

    // environments config removed - using tokenProvider instead
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
        ? {
            host: this.config.redis.host,
            port: this.config.redis.port,
            db: this.config.redis.db ?? 0,
          }
        : 'disabled',
      retry: this.config.retry ?? 'default',
    });

    try {
      // Auto-detect cloud provider and metadata (region, zone, instance ID, etc.)
      // This runs in the background and doesn't block initialization
      const cloudProvider = this.config.cloud?.provider as
        | CloudProvider
        | undefined;
      this.cloudMetadata = await detectCloudMetadata(cloudProvider);
      if (this.cloudMetadata.provider !== 'unknown') {
        this.logger.info('Cloud metadata detected', {
          provider: this.cloudMetadata.provider,
          region: this.cloudMetadata.region,
          zone: this.cloudMetadata.zone,
          instanceId: this.cloudMetadata.instanceId,
        });
      } else {
        this.logger.debug(
          'No cloud metadata detected (not running in a cloud environment)'
        );
      }

      // Initialize cache manager
      // CacheManager creates all services internally based on feature flags
      const cacheConfig = this.config.cache || {};
      this.cacheManager = new CacheManager(
        cacheConfig,
        this.apiClient,
        this.logger,
        this.config.apiToken,
        this.metrics,
        this.config.worldId,
        this.config.uses,
        this.config.tokenProvider,
        this.config.featureFlags
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
        this.eventListener = new EventListener(
          this.config.redis,
          this.cacheManager,
          this.logger,
          this.metrics
        );
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
        const additionalRegistries = Array.from(registrySet).filter(
          (reg) => reg !== primaryRegistry
        );

        this.metricsServer = createMetricsServer({
          port: this.config.metrics?.port,
          bindAddress: this.config.metrics?.bindAddress,
          collectDefaultMetrics: this.config.metrics?.collectDefaultMetrics,
          service: this.config.service,
          group: this.config.group,
          applicationName: this.config.applicationName,
          logger: this.logger,
          registry: primaryRegistry as any,
          additionalRegistries,
        });

        this.metricsServer.start();
        this.logger.info('Metrics server started');
      }

      // Auto-start feature flag metrics collection if enabled
      if (this.config.uses?.featureFlag !== false) {
        const featureFlagService = this.cacheManager?.getFeatureFlagService();
        if (
          featureFlagService &&
          featureFlagService.getMetricsConfig().enabled
        ) {
          featureFlagService.startMetricsCollection();
          this.logger.info(
            'Feature flag metrics collection started automatically'
          );
        }
      }

      // Auto-start impact metrics flush (every 60s)
      this.startImpactMetricsFlush();

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
    this.connectionRecoveryUnsubscribe = this.apiClient.onConnectionRecovered(
      () => {
        // Emit connection.restored event to listeners
        this.emitConnectionEvent('connection.restored');

        // Skip if already refreshing (prevents concurrent refresh attempts)
        if (this.isRefreshingAfterRecovery) {
          this.logger.debug('Skipping cache refresh - already in progress');
          return;
        }

        // Skip if cache manager is not available
        if (!this.cacheManager) {
          this.logger.debug(
            'Skipping cache refresh - cache manager not initialized'
          );
          return;
        }

        this.isRefreshingAfterRecovery = true;

        this.logger.info('Refreshing cache after connection recovery');

        // Refresh cache asynchronously - don't block the request completion
        this.cacheManager
          .refreshAll()
          .then(() => {
            this.logger.info(
              'Cache refreshed successfully after connection recovery'
            );
          })
          .catch((error: any) => {
            // Log error but don't throw - cache refresh failure should not affect server operation
            this.logger.warn(
              'Failed to refresh cache after connection recovery',
              {
                error: error.message,
              }
            );
          })
          .finally(() => {
            this.isRefreshingAfterRecovery = false;
          });
      }
    );

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
      throw new Error(
        'GameWorldService is not available. SDK may not be initialized or gameWorld feature is disabled.'
      );
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
      throw new Error(
        'PopupNoticeService is not available. SDK may not be initialized or popupNotice feature is disabled.'
      );
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
      throw new Error(
        'SurveyService is not available. SDK may not be initialized or survey feature is disabled.'
      );
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
      throw new Error(
        'WhitelistService is not available. SDK may not be initialized or whitelist feature is disabled.'
      );
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
      throw new Error(
        'ServiceMaintenanceService is not available. SDK may not be initialized or serviceMaintenance feature is disabled.'
      );
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
      throw new Error(
        'StoreProductService is not available. SDK may not be initialized or storeProduct feature is disabled.'
      );
    }
    return service;
  }

  /**
   * Get FeatureFlagService instance
   * @throws Error if SDK is not initialized or feature is disabled
   */
  get featureFlag(): FeatureFlagService {
    const service = this.cacheManager?.getFeatureFlagService();
    if (!service) {
      throw new Error(
        'FeatureFlagService is not available. SDK may not be initialized or featureFlag feature is disabled.'
      );
    }
    return service;
  }

  /**
   * Get VarsService instance
   * @throws Error if SDK is not initialized or feature is disabled
   */
  get vars(): VarsService {
    const service = this.cacheManager?.getVarsService();
    if (!service) {
      throw new Error(
        'VarsService is not available. SDK may not be initialized or vars feature is disabled.'
      );
    }
    return service;
  }

  /**
   * Get Impact Metrics API
   * Use this to define and record application-level metrics
   * that can be used for release flow safeguard evaluation.
   *
   * @example
   * ```typescript
   * // Define metrics
   * sdk.impactMetrics.defineCounter('http_errors', 'Count of HTTP errors');
   * sdk.impactMetrics.defineHistogram('response_time_ms', 'Response time', [10, 50, 100, 500, 1000]);
   *
   * // Record metrics during request handling
   * sdk.impactMetrics.incrementCounter('http_errors');
   * sdk.impactMetrics.observeHistogram('response_time_ms', 42);
   * ```
   */
  get impactMetrics(): MetricsAPI {
    return this._impactMetrics;
  }

  /**
   * Get impact metrics data source for internal use (metric flushing)
   * Returns collected metrics and allows restoring on failure
   */
  getImpactMetricsDataSource(): ImpactMetricsDataSource {
    return this.impactMetricDataSource;
  }

  /**
   * Start periodic impact metrics flushing
   * Collects from InMemoryMetricRegistry and sends to backend
   */
  private startImpactMetricsFlush(intervalMs: number = 60000): void {
    if (this.impactMetricsFlushInterval) {
      clearInterval(this.impactMetricsFlushInterval);
    }

    this.impactMetricsFlushInterval = setInterval(() => {
      this.flushImpactMetrics();
    }, intervalMs);

    this.logger.info('Impact metrics flush started', { intervalMs });
  }

  /**
   * Flush collected impact metrics to the backend
   * Collects from InMemoryMetricRegistry (resets counters after collection)
   * Sends to POST /api/v1/server/impact-metrics
   */
  private async flushImpactMetrics(): Promise<void> {
    try {
      const collectedMetrics = this.impactMetricDataSource.collect();

      if (collectedMetrics.length === 0) {
        return;
      }

      this.logger.debug('Flushing impact metrics', {
        metricsCount: collectedMetrics.length,
      });

      await this.apiClient.post(
        '/api/v1/server/impact-metrics',
        {
          impactMetrics: collectedMetrics,
          sdkVersion: SDK_VERSION,
        },
        {
          headers: {
            'X-SDK-Version': SDK_VERSION,
          },
        }
      );

      this.logger.debug('Impact metrics sent successfully');
    } catch (error: any) {
      this.logger.error('Failed to flush impact metrics', {
        error: error.message,
      });
      // On failure, metrics are already consumed from registry.
      // We could restore them, but for simplicity we just log the error.
      // In production, the next collection cycle will have fresh metrics.
    }
  }

  /**
   * Check if SDK is running in multi-environment mode
   * Multi-environment mode is enabled when:
   * - environments is set to '*' (wildcard mode)
   * - environments is an array with multiple values
   */
  isMultiTokenMode(): boolean {
    const provider = this.config.tokenProvider;
    return !!provider && provider.getTokens().length > 1;
  }

  /**
   * Get the default environment from SDK config
   * Used in single-environment mode (game servers)
   */
  getDefaultToken(): string {
    return this.config.apiToken;
  }

  /**
   * Resolve environment parameter
   * In single-environment mode: uses config.environment if not provided
   * In multi-environment mode: throws error if not provided
   *
   * @param environmentId Optional environment parameter
   * @param methodName Method name for error message
   * @returns Resolved environment ID
   */
  private resolveToken(token: string | undefined, methodName: string): string {
    if (token) {
      return token;
    }

    if (this.isMultiTokenMode()) {
      throw new Error(
        `GatrixServerSDK.${methodName}(): token parameter is required in multi-token mode`
      );
    }

    return this.config.apiToken;
  }

  // ============================================================================
  // Coupon Methods
  // ============================================================================

  /**
   * Redeem a coupon
   * @param request Coupon redemption request
   * @param environmentId Optional in single-env mode, required in multi-env mode
   */
  async redeemCoupon(
    request: RedeemCouponRequest,
    environmentId?: string
  ): Promise<RedeemCouponResponse> {
    const env = this.resolveToken(environmentId, 'redeemCoupon');
    return await this.coupon.redeem(request, env);
  }

  // ============================================================================
  // Game World Methods
  // ============================================================================

  /**
   * Fetch all game worlds
   * @param environmentId Optional in single-env mode, required in multi-env mode
   */
  async fetchGameWorlds(environmentId?: string): Promise<GameWorld[]> {
    const env = this.resolveToken(environmentId, 'fetchGameWorlds');
    return await this.gameWorld.listByEnvironment(env);
  }

  /**
   * Fetch game world by ID
   * @param id Game world ID
   * @param environmentId Optional in single-env mode, required in multi-env mode
   */
  async fetchGameWorldById(
    id: string,
    environmentId?: string
  ): Promise<GameWorld> {
    const env = this.resolveToken(environmentId, 'fetchGameWorldById');
    return await this.gameWorld.getById(id, env);
  }

  /**
   * Fetch game world by worldId
   * @param worldId World ID string
   * @param environmentId Optional in single-env mode, required in multi-env mode
   */
  async fetchGameWorldByWorldId(
    worldId: string,
    environmentId?: string
  ): Promise<GameWorld> {
    const env = this.resolveToken(environmentId, 'fetchGameWorldByWorldId');
    return await this.gameWorld.getByWorldId(worldId, env);
  }

  /**
   * Get cached game worlds
   * @param environmentId environment ID. Optional in single-env mode, required in multi-env mode.
   */
  getGameWorlds(environmentId?: string): GameWorld[] {
    const env = this.resolveToken(environmentId, 'getGameWorlds');
    return this.gameWorld.getCached(env);
  }

  /**
   * Check if a world is in maintenance (time-based check)
   * @param worldId World ID
   * @param environmentId environment ID. Optional in single-env mode, required in multi-env mode.
   */
  isWorldMaintenanceActive(worldId: string, environmentId?: string): boolean {
    const env = this.resolveToken(environmentId, 'isWorldMaintenanceActive');
    return this.gameWorld.isWorldMaintenanceActive(worldId, env);
  }

  /**
   * Get maintenance message for a world
   * @param worldId World ID
   * @param environmentId environment ID. Optional in single-env mode, required in multi-env mode.
   * @param lang Language code (default: 'en')
   */
  getWorldMaintenanceMessage(
    worldId: string,
    environmentId?: string,
    lang: 'ko' | 'en' | 'zh' = 'en'
  ): string | null {
    const env = this.resolveToken(environmentId, 'getWorldMaintenanceMessage');
    return this.gameWorld.getWorldMaintenanceMessage(worldId, env, lang);
  }

  /**
   * Fetch global service maintenance status
   * @param environmentId Optional in single-env mode, required in multi-env mode
   */
  async fetchServiceMaintenanceStatus(environmentId?: string) {
    const env = this.resolveToken(
      environmentId,
      'fetchServiceMaintenanceStatus'
    );
    return await this.serviceMaintenance.getStatusByEnvironment(env);
  }

  /**
   * Get cached global service maintenance status
   * @param environmentId Optional in single-env mode, required in multi-env mode
   */
  getServiceMaintenanceStatus(environmentId?: string) {
    const env = this.resolveToken(environmentId, 'getServiceMaintenanceStatus');
    return this.serviceMaintenance.getCached(env);
  }

  /**
   * Check if global service is currently in maintenance (time-based check)
   * @param environmentId Optional in single-env mode, required in multi-env mode
   */
  isServiceMaintenanceActive(environmentId?: string): boolean {
    const env = this.resolveToken(environmentId, 'isServiceMaintenanceActive');
    return this.serviceMaintenance.isMaintenanceActive(env);
  }

  /**
   * Get localized maintenance message for global service
   * @param lang Language code
   * @param environmentId Optional in single-env mode, required in multi-env mode
   */
  getServiceMaintenanceMessage(
    lang: 'ko' | 'en' | 'zh' = 'en',
    environmentId?: string
  ): string | null {
    const env = this.resolveToken(
      environmentId,
      'getServiceMaintenanceMessage'
    );
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
   * @param environmentId environment ID. Optional in single-env mode, required in multi-env mode.
   * @returns CurrentMaintenanceStatus with isMaintenanceActive, source, and detail
   */
  getCurrentMaintenanceStatus(
    environmentId?: string
  ): CurrentMaintenanceStatus {
    const env = this.resolveToken(environmentId, 'getCurrentMaintenanceStatus');

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

    if (
      targetWorldId &&
      this.gameWorld.isWorldMaintenanceActive(targetWorldId, env)
    ) {
      const world = this.gameWorld.getWorldByWorldId(targetWorldId, env);
      if (world) {
        // Convert maintenanceLocales array to localeMessages object
        const localeMessages: { ko?: string; en?: string; zh?: string } = {};
        if (world.maintenanceLocales) {
          for (const locale of world.maintenanceLocales) {
            if (
              locale.lang === 'ko' ||
              locale.lang === 'en' ||
              locale.lang === 'zh'
            ) {
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
            localeMessages:
              Object.keys(localeMessages).length > 0
                ? localeMessages
                : undefined,
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

  /**
   * Get maintenance status for a client, considering whitelist exemptions.
   * This method checks both IP and account whitelists to determine if the client
   * should be exempt from maintenance mode.
   *
   * Usage:
   * 1. Before auth (IP check only): getMaintenanceStatusForClient({ clientIp })
   * 2. After auth (IP + account check): getMaintenanceStatusForClient({ clientIp, accountId })
   *
   * When whitelisted:
   * - isMaintenanceActive = false (client can connect)
   * - isWhitelisted = true (indicates exemption reason)
   *
   * @param options.clientIp Client IP address (for IP whitelist check)
   * @param options.accountId Account ID (for account whitelist check, typically after auth)
   * @param options.environment environment ID. Optional in single-env mode, required in multi-env mode.
   * @returns CurrentMaintenanceStatus with isWhitelisted field
   */
  getMaintenanceStatusForClient(options: {
    clientIp?: string;
    accountId?: string;
    environmentId?: string;
  }): CurrentMaintenanceStatus {
    const { clientIp, accountId, environmentId } = options;
    const env = this.resolveToken(
      environmentId,
      'getMaintenanceStatusForClient'
    );

    // First get the raw maintenance status
    const status = this.getCurrentMaintenanceStatus(env);

    // If not in maintenance, return as-is
    if (!status.isMaintenanceActive) {
      return status;
    }

    // Check IP whitelist
    if (clientIp) {
      const isIpWhitelisted = this.whitelist.isIpWhitelisted(clientIp, env);
      if (isIpWhitelisted) {
        return {
          isMaintenanceActive: false,
          isWhitelisted: true,
        };
      }
    }

    // Check account whitelist
    if (accountId) {
      const isAccountWhitelisted = this.whitelist.isAccountWhitelisted(
        accountId,
        env
      );
      if (isAccountWhitelisted) {
        return {
          isMaintenanceActive: false,
          isWhitelisted: true,
        };
      }
    }

    // Not whitelisted, return original maintenance status
    return {
      ...status,
      isWhitelisted: false,
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
   * @param environmentId environment ID. Optional in single-env mode, required in multi-env mode.
   * @returns true if either global service or world(s) is in maintenance
   */
  isMaintenanceActive(worldId?: string, environmentId?: string): boolean {
    const env = this.resolveToken(environmentId, 'isMaintenanceActive');

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
      if (
        world.worldId &&
        this.gameWorld.isWorldMaintenanceActive(world.worldId, env)
      ) {
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
   * @param environmentId environment ID. Optional in single-env mode, required in multi-env mode.
   */
  getMaintenanceInfo(
    worldId?: string,
    lang: 'ko' | 'en' | 'zh' = 'en',
    environmentId?: string
  ): MaintenanceInfo {
    const env = this.resolveToken(environmentId, 'getMaintenanceInfo');
    const targetWorldId = worldId ?? this.config.worldId;

    // Check global service maintenance first
    if (this.serviceMaintenance.isMaintenanceActive(env)) {
      const status = this.serviceMaintenance.getCached(env);
      const actualStartTime =
        this.cacheManager?.getServiceMaintenanceActualStartTime() ?? null;
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
    if (
      targetWorldId &&
      this.gameWorld.isWorldMaintenanceActive(targetWorldId, env)
    ) {
      const world = this.gameWorld.getWorldByWorldId(targetWorldId, env);
      const actualStartTime =
        this.cacheManager?.getWorldMaintenanceActualStartTime(targetWorldId) ??
        null;
      return {
        isMaintenanceActive: true,
        source: 'world',
        worldId: targetWorldId,
        message: this.gameWorld.getWorldMaintenanceMessage(
          targetWorldId,
          env,
          lang
        ),
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
        if (
          world.worldId &&
          this.gameWorld.isWorldMaintenanceActive(world.worldId, env)
        ) {
          const actualStartTime =
            this.cacheManager?.getWorldMaintenanceActualStartTime(
              world.worldId
            ) ?? null;
          return {
            isMaintenanceActive: true,
            source: 'world',
            worldId: world.worldId,
            message: this.gameWorld.getWorldMaintenanceMessage(
              world.worldId,
              env,
              lang
            ),
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
   * @param environmentId Optional in single-env mode, required in multi-env mode
   */
  async fetchPopupNotices(environmentId?: string): Promise<PopupNotice[]> {
    const env = this.resolveToken(environmentId, 'fetchPopupNotices');
    return await this.popupNotice.listByEnvironment(env);
  }

  /**
   * Get cached popup notices
   * @param environmentId environment ID. Optional in single-env mode, required in multi-env mode.
   */
  getPopupNotices(environmentId?: string): PopupNotice[] {
    const env = this.resolveToken(environmentId, 'getPopupNotices');
    return this.popupNotice.getCached(env);
  }

  /**
   * Get popup notices for a specific world
   * @param worldId World ID
   * @param environmentId environment ID. Optional in single-env mode, required in multi-env mode.
   */
  getPopupNoticesForWorld(
    worldId: string,
    environmentId?: string
  ): PopupNotice[] {
    const env = this.resolveToken(environmentId, 'getPopupNoticesForWorld');
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
    environmentId?: string;
  }): PopupNotice[] {
    const env = this.resolveToken(
      options?.environmentId,
      'getActivePopupNotices'
    );
    return this.popupNotice.getActivePopupNotices({
      ...options,
      environmentId: env,
    });
  }

  // ============================================================================
  // Store Product Methods
  // ============================================================================

  /**
   * Fetch all store products
   * @param environmentId environment ID. Optional in single-env mode, required in multi-env mode.
   */
  async fetchStoreProducts(environmentId?: string): Promise<StoreProduct[]> {
    const env = this.resolveToken(environmentId, 'fetchStoreProducts');
    return await this.storeProduct.listByEnvironment(env);
  }

  /**
   * Get cached store products
   * @param environmentId environment ID. Optional in single-env mode, required in multi-env mode.
   */
  getStoreProducts(environmentId?: string): StoreProduct[] {
    const env = this.resolveToken(environmentId, 'getStoreProducts');
    return this.storeProduct.getCached(env);
  }

  /**
   * Get active store products (filtered by time and status)
   * @param environmentId environment ID. Optional in single-env mode, required in multi-env mode.
   */
  getActiveStoreProducts(environmentId?: string): StoreProduct[] {
    const env = this.resolveToken(environmentId, 'getActiveStoreProducts');
    return this.storeProduct.getActive(env);
  }

  /**
   * Get store product by ID
   * @param id Store product ID
   * @param environmentId environment ID. Optional in single-env mode, required in multi-env mode.
   */
  async getStoreProductById(
    id: string,
    environmentId?: string
  ): Promise<StoreProduct> {
    const env = this.resolveToken(environmentId, 'getStoreProductById');
    return await this.storeProduct.getById(id, env);
  }

  // ============================================================================
  // Survey Methods
  // ============================================================================

  /**
   * Fetch surveys with settings
   * @param environmentId Optional in single-env mode, required in multi-env mode
   */
  async fetchSurveys(
    environmentId?: string
  ): Promise<{ surveys: Survey[]; settings: SurveySettings }> {
    const env = this.resolveToken(environmentId, 'fetchSurveys');
    return await this.survey.listByEnvironment(env, { isActive: true });
  }

  /**
   * Get cached surveys with settings
   * @param environmentId environment ID. Only used in multi-environment mode (Edge).
   *                    For game servers, can be omitted to use default environment.
   *                    For edge servers, must be provided from client request.
   */
  getSurveys(environmentId?: string): {
    surveys: Survey[];
    settings: SurveySettings | null;
  } {
    const env = this.resolveToken(environmentId, 'getSurveys');
    return {
      surveys: this.survey.getCached(env),
      settings: this.survey.getCachedSettings(env),
    };
  }

  /**
   * Get surveys for a specific world
   * @param environmentId environment ID. Only used in multi-environment mode.
   */
  getSurveysForWorld(worldId: string, environmentId?: string): Survey[] {
    const env = this.resolveToken(environmentId, 'getSurveysForWorld');
    return this.survey.getSurveysForWorld(worldId, env);
  }

  /**
   * Update survey settings only
   * Called when survey settings change (e.g., survey configuration updates)
   * @param environmentId environment ID. Only used in multi-environment mode.
   */
  updateSurveySettings(
    newSettings: SurveySettings,
    environmentId?: string
  ): void {
    const env = this.resolveToken(environmentId, 'updateSurveySettings');
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
   * @param environmentId environment ID. Only used in multi-environment mode.
   * @returns Array of appropriate surveys, empty array if none match
   */
  getActiveSurveys(
    platform: string,
    channel: string,
    subChannel: string,
    worldId: string,
    userLevel: number,
    joinDays: number,
    environmentId?: string
  ): Survey[] {
    const env = this.resolveToken(environmentId, 'getActiveSurveys');
    return this.survey.getActiveSurveys(
      platform,
      channel,
      subChannel,
      worldId,
      userLevel,
      joinDays,
      env
    );
  }

  // ============================================================================
  // Cache Methods
  // ============================================================================

  /**
   * Refresh all caches
   */
  async refreshCache(): Promise<void> {
    if (!this.cacheManager) {
      throw createError(
        ErrorCode.NOT_INITIALIZED,
        'Cache manager not initialized'
      );
    }

    await this.cacheManager.refreshAll();
  }

  /**
   * Refresh game worlds cache
   * @param environmentId Optional in single-env mode, required in multi-env mode
   */
  async refreshGameWorldsCache(environmentId?: string): Promise<void> {
    if (!this.cacheManager) {
      throw createError(
        ErrorCode.NOT_INITIALIZED,
        'Cache manager not initialized'
      );
    }
    const env = this.resolveToken(environmentId, 'refreshGameWorldsCache');
    await this.cacheManager.refreshGameWorlds(env);
  }

  /**
   * Refresh popup notices cache
   * @param environmentId Optional in single-env mode, required in multi-env mode
   */
  async refreshPopupNoticesCache(environmentId?: string): Promise<void> {
    if (!this.cacheManager) {
      throw createError(
        ErrorCode.NOT_INITIALIZED,
        'Cache manager not initialized'
      );
    }
    const env = this.resolveToken(environmentId, 'refreshPopupNoticesCache');
    await this.cacheManager.refreshPopupNotices(env);
  }

  /**
   * Refresh surveys cache
   * @param environmentId Optional in single-env mode, required in multi-env mode
   */
  async refreshSurveysCache(environmentId?: string): Promise<void> {
    if (!this.cacheManager) {
      throw createError(
        ErrorCode.NOT_INITIALIZED,
        'Cache manager not initialized'
      );
    }
    const env = this.resolveToken(environmentId, 'refreshSurveysCache');
    await this.cacheManager.refreshSurveys(env);
  }

  /**
   * Refresh service maintenance cache
   * @param environmentId Optional in single-env mode, required in multi-env mode
   */
  async refreshServiceMaintenanceCache(environmentId?: string): Promise<void> {
    if (!this.cacheManager) {
      throw createError(
        ErrorCode.NOT_INITIALIZED,
        'Cache manager not initialized'
      );
    }
    const env = this.resolveToken(
      environmentId,
      'refreshServiceMaintenanceCache'
    );
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
    eventType:
      | 'local.maintenance.started'
      | 'local.maintenance.ended'
      | 'local.maintenance.updated'
      | 'local.maintenance.grace_period_expired',
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
        this.logger.error('Error in maintenance event callback', {
          error: error.message,
        });
      }
    }

    this.logger.info('Maintenance event emitted', {
      eventType,
      source: data.source,
      worldId: data.worldId,
    });
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
        const currentListeners =
          this.connectionEventListeners.get(eventType) || [];
        this.connectionEventListeners.set(
          eventType,
          currentListeners.filter((cb) => cb !== callback)
        );
      };
    }

    // Handle local maintenance events separately (these are local events from MaintenanceWatcher)
    if (
      eventType === 'local.maintenance.started' ||
      eventType === 'local.maintenance.ended' ||
      eventType === 'local.maintenance.updated' ||
      eventType === 'local.maintenance.grace_period_expired'
    ) {
      const listeners = this.maintenanceEventListeners.get(eventType) || [];
      listeners.push(callback);
      this.maintenanceEventListeners.set(eventType, listeners);

      // Return unsubscribe function
      return () => {
        const currentListeners =
          this.maintenanceEventListeners.get(eventType) || [];
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
        this.logger.warn(
          'Event listener not initialized. Events will not be received.'
        );
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
      const unsubscribe = this.cacheManager.onRefresh(
        (type: string, data: any) => {
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
        }
      );
      return unsubscribe;
    }

    return () => {}; // Return no-op function as fallback
  }

  /**
   * Unregister event listener
   */
  off(eventType: string, callback: EventCallback): void {
    // Handle maintenance events separately
    if (
      eventType === 'maintenance.started' ||
      eventType === 'maintenance.ended'
    ) {
      const currentListeners =
        this.maintenanceEventListeners.get(eventType) || [];
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
  async registerService(input: RegisterServiceInput): Promise<{
    instanceId: string;
    hostname: string;
    internalAddress: string;
    externalAddress: string;
    orgId: string | null;
    projectId: string | null;
    environmentId: string | null;
  }> {
    // Auto-add environment and region labels from SDK config if not already provided
    const enhancedLabels: RegisterServiceInput['labels'] = {
      ...input.labels,
    };

    // Add environment from SDK config if not provided in labels
    // environment label removed - token handles environment identification

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
      const metricsPort =
        this.config.metrics?.port ??
        parseInt(process.env.SDK_METRICS_PORT || '9337', 10);
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

    // After registration, subscribe to org/project channels for 3-level event delivery
    if (this.eventListener && (result.orgId || result.projectId)) {
      try {
        await this.eventListener.subscribeChannels({
          orgId: result.orgId || undefined,
          projectId: result.projectId || undefined,
        });
      } catch (error: any) {
        this.logger.warn(
          'Failed to subscribe to org/project channels after registration',
          {
            error: error.message,
          }
        );
      }
    }

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
  async fetchService(
    serviceType: string,
    instanceId: string
  ): Promise<ServiceInstance | null> {
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
  createHttpMetricsMiddleware(
    options: { scope?: 'private' | 'public' | string; prefix?: string } = {}
  ) {
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
  getUserMetricsProvider():
    | {
        createCounter: (
          name: string,
          help: string,
          labelNames?: string[]
        ) => any;
        createGauge: (name: string, help: string, labelNames?: string[]) => any;
        createHistogram: (
          name: string,
          help: string,
          labelNames?: string[],
          buckets?: number[]
        ) => any;
      }
    | undefined {
    if (!this.userRegistry) return undefined;

    // Lazy require to avoid hard dependency if not used
    const promClient = require('prom-client');
    const registry = this.userRegistry;

    return {
      createCounter(
        name: string,
        help: string,
        labelNames: string[] = []
      ): any {
        return new promClient.Counter({
          name,
          help,
          labelNames,
          registers: [registry],
        });
      },
      createGauge(name: string, help: string, labelNames: string[] = []): any {
        return new promClient.Gauge({
          name,
          help,
          labelNames,
          registers: [registry],
        });
      },
      createHistogram(
        name: string,
        help: string,
        labelNames: string[] = [],
        buckets: number[] = [0.005, 0.01, 0.05, 0.1, 0.3, 1, 3, 5, 10]
      ): any {
        return new promClient.Histogram({
          name,
          help,
          labelNames,
          buckets,
          registers: [registry],
        });
      },
    };
  }

  /**
   * Fetch whitelists (IP and Account)
   * Performs API call via WhitelistService and updates cache
   * @param environmentId Optional in single-env mode, required in multi-env mode
   */
  async fetchWhitelists(environmentId?: string) {
    const env = this.resolveToken(environmentId, 'fetchWhitelists');
    return await this.whitelist.listByEnvironment(env);
  }

  /**
   * Check if IP is whitelisted using cached data
   * Note: Uses WhitelistService cache; call fetchWhitelists or initialize cache beforehand.
   * @param ip IP address to check
   * @param environmentId Optional in single-env mode, required in multi-env mode
   */
  async isIpWhitelisted(ip: string, environmentId?: string): Promise<boolean> {
    const env = this.resolveToken(environmentId, 'isIpWhitelisted');
    return this.whitelist.isIpWhitelisted(ip, env);
  }

  /**
   * Check if account is whitelisted using cached data
   * Note: Uses WhitelistService cache; call fetchWhitelists or initialize cache beforehand.
   * @param accountId Account ID to check
   * @param environmentId Optional in single-env mode, required in multi-env mode
   */
  async isAccountWhitelisted(
    accountId: string,
    environmentId?: string
  ): Promise<boolean> {
    const env = this.resolveToken(environmentId, 'isAccountWhitelisted');
    return this.whitelist.isAccountWhitelisted(accountId, env);
  }

  // ============================================================================
  // Whitelist Cache Methods
  // ============================================================================

  /**
   * Get cached whitelists (IP and Account)
   * Returns cached data without making API call
   * @param environmentId Optional in single-env mode, required in multi-env mode
   */
  getWhitelists(environmentId?: string) {
    if (!this.cacheManager) {
      this.logger.warn('Cache manager not initialized');
      return { ipWhitelist: [], accountWhitelist: [] };
    }
    const env = this.resolveToken(environmentId, 'getWhitelists');
    return this.cacheManager.getWhitelists(env);
  }

  /**
   * Refresh whitelist cache
   * @param environmentId Optional in single-env mode, required in multi-env mode
   */
  async refreshWhitelistCache(environmentId?: string): Promise<void> {
    if (!this.cacheManager) {
      throw createError(
        ErrorCode.INVALID_CONFIG,
        'Cache manager not initialized'
      );
    }
    const env = this.resolveToken(environmentId, 'refreshWhitelistCache');
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
  async publishCustomEvent(
    eventType: string,
    data: Record<string, any>
  ): Promise<void> {
    if (!this.eventListener) {
      this.logger.warn(
        'Event listener not initialized, custom event not published'
      );
      return;
    }

    // Ensure event type is prefixed with 'custom:'
    const prefixedEventType = eventType.startsWith('custom:')
      ? eventType
      : `custom:${eventType}`;

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
   * @param environmentId environment ID. Optional in single-env mode, required in multi-env mode.
   */
  getClientVersions(environmentId?: string): ClientVersion[] {
    if (!this.cacheManager) {
      this.logger.warn('SDK not initialized');
      return [];
    }
    const env = this.resolveToken(environmentId, 'getClientVersions');
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
   * @param environmentId environment ID. Optional in single-env mode, required in multi-env mode.
   */
  getServiceNotices(environmentId?: string): ServiceNotice[] {
    if (!this.cacheManager) {
      this.logger.warn('SDK not initialized');
      return [];
    }
    const env = this.resolveToken(environmentId, 'getServiceNotices');
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
   * @param environmentId environment ID. Optional in single-env mode, required in multi-env mode.
   */
  getBanners(environmentId?: string): Banner[] {
    if (!this.cacheManager) {
      this.logger.warn('SDK not initialized');
      return [];
    }
    const env = this.resolveToken(environmentId, 'getBanners');
    return this.cacheManager.getBanners(env);
  }

  /**
   * Get BannerService for advanced operations
   * Returns undefined if features.banner is not enabled
   */
  getBannerService() {
    return this.cacheManager?.getBannerService();
  }

  // ============================================================================
  // Vars (KV) Methods
  // ============================================================================

  /**
   * Get all cached vars
   * @param environmentId environment ID. Optional in single-env mode, required in multi-env mode.
   */
  getVars(environmentId?: string): any[] {
    if (!this.cacheManager) {
      this.logger.warn('SDK not initialized');
      return [];
    }
    const env = this.resolveToken(environmentId, 'getVars');
    return this.cacheManager.getVars(env);
  }

  /**
   * Get a variable value by key from cache
   * @param key Variable key (e.g., '$channel', 'kv:some-setting')
   * @param environmentId environment ID. Optional in single-env mode, required in multi-env mode.
   */
  getVarValue(key: string, environmentId?: string): string | null {
    if (!this.cacheManager) return null;
    const env = this.resolveToken(environmentId, 'getVarValue');
    return this.vars.getValue(key, env);
  }

  /**
   * Get a variable value parsed as JSON if it's an object or array
   * @param key Variable key
   * @param environmentId environment ID. Optional in single-env mode, required in multi-env mode.
   */
  getVarParsedValue<T = any>(key: string, environmentId?: string): T | null {
    if (!this.cacheManager) return null;
    const env = this.resolveToken(environmentId, 'getVarParsedValue');
    return this.vars.getParsedValue<T>(key, env);
  }

  /**
   * Refresh vars cache
   * @param environmentId Optional in single-env mode, required in multi-env mode
   */
  async refreshVarsCache(environmentId?: string): Promise<void> {
    if (!this.cacheManager) {
      throw createError(
        ErrorCode.NOT_INITIALIZED,
        'Cache manager not initialized'
      );
    }
    const env = this.resolveToken(environmentId, 'refreshVarsCache');
    await this.vars.refreshByEnvironment(env);
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
   * Resolve an environment ID to the cache token key.
   * In multi-mode, cache keys differ from raw environment IDs.
   * @param environmentId Raw environment ID (ULID)
   * @returns The cache token key, or the original environmentId in single-mode
   */
  resolveTokenForEnvironmentId(environmentId: string): string {
    if (!this.cacheManager) {
      return environmentId;
    }
    return this.cacheManager.resolveTokenForEnvironmentId(environmentId);
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
