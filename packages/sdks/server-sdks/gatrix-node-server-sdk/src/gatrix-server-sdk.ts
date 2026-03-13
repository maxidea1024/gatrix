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
import { Survey, SurveySettings } from './types/api';
import { WhitelistService } from './services/whitelist-service';
import { ServiceMaintenanceService } from './services/service-maintenance-service';
import { ServiceDiscoveryService } from './services/service-discovery-service';
import { StoreProductService } from './services/store-product-service';
import { FeatureFlagService } from './services/feature-flag-service';
import { BannerService } from './services/banner-service';
import { ClientVersionService } from './services/client-version-service';
import { ServiceNoticeService } from './services/service-notice-service';
import { VarsService } from './services/vars-service';
import { WorldMaintenanceService } from './services/world-maintenance-service';
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

  // World maintenance (aggregates service + world + whitelist)
  private _worldMaintenance?: WorldMaintenanceService;

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
   *   appName: 'my-game',
   *   meta: { service: 'default-service', group: 'default-group' },
   * };
   *
   * // Create instance with overrides for billing worker
   * const sdk = GatrixServerSDK.createInstance(baseConfig, {
   *   meta: { service: 'billing-worker', group: 'payment' },
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
    if (overrides.apiUrl !== undefined) merged.apiUrl = overrides.apiUrl;
    if (overrides.apiToken !== undefined) merged.apiToken = overrides.apiToken;
    if (overrides.appName !== undefined) merged.appName = overrides.appName;
    if (overrides.environmentProvider !== undefined)
      merged.environmentProvider = overrides.environmentProvider;
    // Legacy alias
    if (overrides.tokenProvider !== undefined)
      merged.environmentProvider = overrides.tokenProvider as any;

    // Deep merge meta
    if (overrides.meta) {
      merged.meta = { ...baseConfig.meta, ...overrides.meta };
    }

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
    // Apply defaults
    const configWithDefaults = {
      ...config,
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
          service: configWithDefaults.meta?.service || '',
          group: configWithDefaults.meta?.group || '',
          application: configWithDefaults.appName,
          hostname: require('os').hostname(),
          ...loggerConfig.loki.labels,
        },
      };
    }
    this.logger = new Logger(loggerConfig);

    // Initialize metrics first
    this.metrics = new SdkMetrics({
      enabled: configWithDefaults.metrics?.enabled !== false,
      service: configWithDefaults.meta?.service || '',
      group: configWithDefaults.meta?.group || '',
      appName: configWithDefaults.appName,
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
            service: configWithDefaults.meta?.service || '',
            group: configWithDefaults.meta?.group || '',

            application: configWithDefaults.appName,
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
      appName: configWithDefaults.appName,
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
      appName: configWithDefaults.appName,
      service: configWithDefaults.meta?.service || '',
    };
    this._impactMetrics = new MetricsAPI(
      this.impactMetricRegistry,
      impactContext,
      this.logger
    );

    this.logger.info('GatrixServerSDK created', {
      apiUrl: configWithDefaults.apiUrl,
      appName: configWithDefaults.appName,

      apiToken:
        configWithDefaults.apiToken === 'unsecured-server-api-token'
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

    if (!config.appName) {
      throw createError(ErrorCode.INVALID_CONFIG, 'appName is required');
    }

    // service and group are optional

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
        if (
          !['polling', 'event', 'manual'].includes(config.cache.refreshMethod)
        ) {
          throw createError(
            ErrorCode.INVALID_CONFIG,
            'cache.refreshMethod must be "polling", "event", or "manual"'
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

    // environments config removed - using environmentProvider instead
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

      // Set enrichment config on service discovery for auto-enrichment of registration input
      this.serviceDiscovery.setEnrichmentConfig({
        cloudMetadata: this.cloudMetadata,
        sdkVersion: SDK_VERSION,
        metricsPort:
          this.config.metrics?.port ??
          parseInt(process.env.SDK_METRICS_PORT || '9337', 10),
        meta: this.config.meta,
        eventListener: this.eventListener,
      });

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
        this.config.environmentProvider || this.config.tokenProvider,
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
        await this.eventListener.initialize(
          this.cacheManager.getChannelContext()
        );
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
          service: this.config.meta?.service,
          group: this.config.meta?.group,
          appName: this.config.appName,
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
   * Get BannerService instance
   * @throws Error if SDK is not initialized or feature is disabled
   */
  get banner(): BannerService {
    const service = this.cacheManager?.getBannerService();
    if (!service) {
      throw new Error(
        'BannerService is not available. SDK may not be initialized or banner feature is disabled.'
      );
    }
    return service;
  }

  /**
   * Get ClientVersionService instance
   * @throws Error if SDK is not initialized or feature is disabled
   */
  get clientVersion(): ClientVersionService {
    const service = this.cacheManager?.getClientVersionService();
    if (!service) {
      throw new Error(
        'ClientVersionService is not available. SDK may not be initialized or clientVersion feature is disabled.'
      );
    }
    return service;
  }

  /**
   * Get ServiceNoticeService instance
   * @throws Error if SDK is not initialized or feature is disabled
   */
  get serviceNotice(): ServiceNoticeService {
    const service = this.cacheManager?.getServiceNoticeService();
    if (!service) {
      throw new Error(
        'ServiceNoticeService is not available. SDK may not be initialized or serviceNotice feature is disabled.'
      );
    }
    return service;
  }

  /**
   * Get WorldMaintenanceService instance
   * Aggregates service maintenance + world maintenance + whitelist checking
   */
  get worldMaintenance(): WorldMaintenanceService {
    if (!this._worldMaintenance) {
      this._worldMaintenance = new WorldMaintenanceService(
        this.logger,
        this.serviceMaintenance,
        this.gameWorld,
        this.whitelist,
        this.cacheManager || null,
        {
          worldId: this.config.worldId,
          resolveEnvironment: this.resolveEnvironment.bind(this),
        }
      );
    }
    return this._worldMaintenance;
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
   * Multi-environment mode is enabled when environmentProvider (or tokenProvider) is configured.
   * The number of environments does not matter — having a provider means multi-env mode.
   */
  isMultiEnvironmentMode(): boolean {
    const provider =
      this.config.environmentProvider || this.config.tokenProvider;
    return !!provider;
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
  private resolveEnvironment(
    environmentId: string | undefined,
    methodName: string
  ): string {
    if (environmentId) {
      return environmentId;
    }

    if (this.isMultiEnvironmentMode()) {
      throw new Error(
        `GatrixServerSDK.${methodName}(): environmentId parameter is required in multi-environment mode`
      );
    }

    return this.config.apiToken;
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
    const env = this.resolveEnvironment(environmentId, 'fetchSurveys');
    return await this.survey.listByEnvironment({ isActive: true }, env);
  }

  /**
   * Get cached surveys with settings
   * @param environmentId Environment ID. Only used in multi-environment mode (Edge).
   *                      For game servers, can be omitted to use default environment.
   *                      For edge servers, must be provided from client request.
   */
  getSurveys(environmentId?: string): {
    surveys: Survey[];
    settings: SurveySettings | null;
  } {
    const env = this.resolveEnvironment(environmentId, 'getSurveys');
    return {
      surveys: this.survey.getCached(env),
      settings: this.survey.getCachedSettings(env),
    };
  }

  /**
   * Get surveys for a specific world
   * @param worldId World ID
   * @param environmentId Environment ID. Only used in multi-environment mode.
   */
  getSurveysForWorld(worldId: string, environmentId?: string): Survey[] {
    const env = this.resolveEnvironment(environmentId, 'getSurveysForWorld');
    return this.survey.getSurveysForWorld(worldId, env);
  }

  /**
   * Update survey settings only
   * Called when survey settings change (e.g., survey configuration updates)
   * @param newSettings New survey settings
   * @param environmentId Environment ID. Only used in multi-environment mode.
   */
  updateSurveySettings(
    newSettings: SurveySettings,
    environmentId?: string
  ): void {
    const env = this.resolveEnvironment(
      environmentId,
      'updateSurveySettings'
    );
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
   * @param environmentId Environment ID. Only used in multi-environment mode.
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
    const env = this.resolveEnvironment(environmentId, 'getActiveSurveys');
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
    const env = this.resolveEnvironment(environmentId, 'refreshSurveysCache');
    await this.survey.refreshByEnvironment({ isActive: true }, false, env);
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
   * Resolve an environment ID.
   * With environmentId-based caching, this simply returns the environmentId as-is.
   * Kept for backward compatibility.
   * @param environmentId Environment ID
   * @returns The environmentId (passthrough)
   */
  resolveTokenForEnvironmentId(environmentId: string): string {
    return environmentId;
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
