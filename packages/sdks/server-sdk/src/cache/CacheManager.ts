/**
 * Cache Manager
 * Manages in-memory caching for game worlds, popup notices, surveys, and Edge-specific data
 */

import { Logger } from '../utils/logger';
import { CacheConfig, FeaturesConfig } from '../types/config';
import { GameWorldService } from '../services/GameWorldService';
import { PopupNoticeService } from '../services/PopupNoticeService';
import { SurveyService } from '../services/SurveyService';
import { WhitelistService } from '../services/WhitelistService';
import { ServiceMaintenanceService } from '../services/ServiceMaintenanceService';
import { ClientVersionService } from '../services/ClientVersionService';
import { ServiceNoticeService } from '../services/ServiceNoticeService';
import { BannerService } from '../services/BannerService';
import { StoreProductService } from '../services/StoreProductService';
import { FeatureFlagService } from '../services/FeatureFlagService';
import { EnvironmentService } from '../services/EnvironmentService';
import { EnvironmentResolver } from '../utils/EnvironmentResolver';
import { ApiClient } from '../client/ApiClient';
import { SdkMetrics } from '../utils/sdkMetrics';
import { MaintenanceStatus, ClientVersion, ServiceNotice, Banner, StoreProduct } from '../types/api';
import { sleep } from '../utils/time';
import { MaintenanceWatcher, MaintenanceEventCallback } from './MaintenanceWatcher';

export class CacheManager {
  private logger: Logger;
  private config: CacheConfig;
  private features: FeaturesConfig;
  // Environment resolver for all services
  private envResolver: EnvironmentResolver;
  // All services are optional - controlled by feature flags
  private gameWorldService?: GameWorldService;
  private popupNoticeService?: PopupNoticeService;
  private surveyService?: SurveyService;
  private whitelistService?: WhitelistService;
  private serviceMaintenanceService?: ServiceMaintenanceService;
  private clientVersionService?: ClientVersionService;
  private serviceNoticeService?: ServiceNoticeService;
  private bannerService?: BannerService;
  private storeProductService?: StoreProductService;
  private featureFlagService?: FeatureFlagService;
  private apiClient: ApiClient;
  private refreshInterval?: NodeJS.Timeout;
  private refreshCallbacks: Array<(type: string, data: any) => void> = [];
  private metrics?: SdkMetrics;
  private maintenanceWatcher: MaintenanceWatcher;
  // Multi-environment mode: list of environments to cache
  private environments?: string[] | '*';
  // Environment service for wildcard mode
  private environmentService?: EnvironmentService;
  // Cached environment list (for '*' mode)
  private cachedEnvironmentList: string[] = [];
  // Last cache refresh timestamp
  private lastRefreshedAt: Date | null = null;
  // Cache invalidation counter
  private invalidationCount: number = 0;

  constructor(
    config: CacheConfig,
    apiClient: ApiClient,
    logger: Logger,
    defaultEnvironment: string = 'development',
    metrics?: SdkMetrics,
    configWorldId?: string,
    features?: FeaturesConfig,
    environments?: string[] | '*'
  ) {
    this.config = {
      enabled: config.enabled !== false,
      ttl: config.ttl || 300,
      refreshMethod: config.refreshMethod ?? 'polling', // Default: polling
      skipBackendReady: config.skipBackendReady ?? false, // Default: wait for backend
    };
    this.features = features || {};
    this.apiClient = apiClient;
    this.logger = logger;
    this.metrics = metrics;
    this.maintenanceWatcher = new MaintenanceWatcher(logger, configWorldId);

    // Store environments for multi-environment mode
    this.environments = environments;

    // Create environment service for wildcard mode
    if (environments === '*') {
      this.environmentService = new EnvironmentService(apiClient, logger);
    }

    // Determine if we're in multi-environment mode
    const isMultiEnvMode = environments === '*' || (Array.isArray(environments) && environments.length > 0);

    // Create EnvironmentResolver for all services
    this.envResolver = new EnvironmentResolver(defaultEnvironment);
    if (isMultiEnvMode) {
      this.envResolver.setMultiEnvironmentMode(true);
    }

    // Initialize ALL services internally based on feature flags
    // All services are optional and controlled by feature flags
    // Default features (gameWorld, popupNotice, survey, whitelist, serviceMaintenance) use !== false for backward compatibility
    // New features (clientVersion, serviceNotice, banner, storeProduct) require explicit === true
    if (this.features.gameWorld !== false) {
      this.gameWorldService = new GameWorldService(apiClient, logger, this.envResolver);
      this.gameWorldService.setFeatureEnabled(true);
    }
    if (this.features.popupNotice !== false) {
      this.popupNoticeService = new PopupNoticeService(apiClient, logger, this.envResolver);
      this.popupNoticeService.setFeatureEnabled(true);
    }
    if (this.features.survey !== false) {
      this.surveyService = new SurveyService(apiClient, logger, this.envResolver);
      this.surveyService.setFeatureEnabled(true);
    }
    if (this.features.whitelist !== false) {
      this.whitelistService = new WhitelistService(apiClient, logger, this.envResolver);
      this.whitelistService.setFeatureEnabled(true);
    }
    if (this.features.serviceMaintenance !== false) {
      this.serviceMaintenanceService = new ServiceMaintenanceService(apiClient, logger, this.envResolver);
      this.serviceMaintenanceService.setFeatureEnabled(true);
    }
    if (this.features.clientVersion === true) {
      this.clientVersionService = new ClientVersionService(apiClient, logger, this.envResolver);
      this.clientVersionService.setFeatureEnabled(true);
    }
    if (this.features.serviceNotice === true) {
      this.serviceNoticeService = new ServiceNoticeService(apiClient, logger, this.envResolver);
      this.serviceNoticeService.setFeatureEnabled(true);
    }
    if (this.features.banner === true) {
      this.bannerService = new BannerService(apiClient, logger, this.envResolver);
      this.bannerService.setFeatureEnabled(true);
    }
    if (this.features.storeProduct === true) {
      this.storeProductService = new StoreProductService(apiClient, logger, this.envResolver);
      this.storeProductService.setFeatureEnabled(true);
    }
    if (this.features.featureFlag === true) {
      this.featureFlagService = new FeatureFlagService(apiClient, logger, this.envResolver);
      this.featureFlagService.setFeatureEnabled(true);
    }
  }

  /**
   * Register callback for cache refresh events
   * Returns a function to unregister the callback
   */
  onRefresh(callback: (type: string, data: any) => void): () => void {
    this.refreshCallbacks.push(callback);

    // Return a function to unregister this specific callback
    return () => {
      this.refreshCallbacks = this.refreshCallbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * Manually update the last refreshed timestamp
   * Used by EventListener when cache is updated via events
   */
  updateLastRefreshedAt(): void {
    this.lastRefreshedAt = new Date();
    this.invalidationCount++;
  }

  /**
   * Register callback for maintenance state change events
   * Returns a function to unregister the callback
   */
  onMaintenanceChange(callback: MaintenanceEventCallback): () => void {
    return this.maintenanceWatcher.onMaintenanceChange(callback);
  }

  /**
   * Emit refresh event to all registered callbacks
   */
  private emitRefreshEvent(type: string, data: any): void {
    for (const callback of this.refreshCallbacks) {
      try {
        callback(type, data);
      } catch (error: any) {
        this.logger.error('Error in refresh callback', { error: error.message });
      }
    }
  }

  /**
   * Initialize cache by loading all data with retry logic
   * Respects features config for conditional loading
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('Cache is disabled');
      return;
    }

    try {
      // Wait for backend to be ready with retry logic (unless skipped)
      if (!this.config.skipBackendReady) {
        await this.waitForBackendReady();
      } else {
        this.logger.info('Skipping backend ready check (skipBackendReady: true)');
      }

      // For wildcard mode, fetch environment list first
      if (this.environments === '*' && this.environmentService) {
        const environments = await this.environmentService.fetchEnvironments();
        this.cachedEnvironmentList = environments.map(e => e.environment);
        this.logger.info('Multi-environment mode (*): fetched environment list from backend', {
          count: this.cachedEnvironmentList.length,
          environments: this.cachedEnvironmentList,
        });
      } else if (Array.isArray(this.environments) && this.environments.length > 0) {
        this.logger.info('Multi-environment mode (explicit): using configured environments', {
          count: this.environments.length,
          environments: this.environments,
        });
      }

      // Build list of promises based on enabled features
      const promises: Promise<any>[] = [];
      const featureTypes: string[] = [];

      // Get target environments for multi-environment mode
      const envList = this.getTargetEnvironments();
      const isMultiEnvMode = this.environments === '*' || (Array.isArray(this.environments) && this.environments.length > 0);

      // In multi-environment mode (environments='*' or explicit list), if envList is empty,
      // we should skip loading data rather than falling back to default environment
      // This prevents calling APIs with invalid environment names like 'gatrix-env'
      if (isMultiEnvMode && envList.length === 0) {
        this.logger.warn('Multi-environment mode enabled but no environments available. Skipping initial data load.', {
          mode: this.environments === '*' ? 'wildcard' : 'explicit',
          configuredEnvironments: this.environments,
        });
      }

      // All services use optional chaining since they are controlled by feature flags
      // Use !== false check to maintain backward compatibility
      // In multi-environment mode, use listByEnvironments for environment-specific features
      if (this.features.gameWorld !== false && this.gameWorldService) {
        if (isMultiEnvMode) {
          if (envList.length > 0) {
            promises.push(
              this.gameWorldService.listByEnvironments(envList).catch((error) => {
                this.logger.warn('Failed to load game worlds', { error: error.message });
                return [];
              })
            );
            featureTypes.push('gameWorld');
          }
          // Skip if multi-env mode but no environments available
        } else {
          const defaultEnv = this.envResolver.getDefaultEnvironment();
          promises.push(this.gameWorldService.listByEnvironment(defaultEnv));
          featureTypes.push('gameWorld');
        }
      }

      if (this.features.popupNotice !== false && this.popupNoticeService) {
        if (isMultiEnvMode) {
          if (envList.length > 0) {
            promises.push(
              this.popupNoticeService.listByEnvironments(envList).catch((error) => {
                this.logger.warn('Failed to load popup notices', { error: error.message });
                return [];
              })
            );
            featureTypes.push('popupNotice');
          }
          // Skip if multi-env mode but no environments available
        } else {
          const defaultEnv = this.envResolver.getDefaultEnvironment();
          promises.push(this.popupNoticeService.listByEnvironment(defaultEnv));
          featureTypes.push('popupNotice');
        }
      }

      if (this.features.survey !== false && this.surveyService) {
        if (isMultiEnvMode) {
          if (envList.length > 0) {
            promises.push(
              this.surveyService.listByEnvironments(envList, { isActive: true }).catch((_error) => {
                return { surveys: [], settings: null };
              })
            );
            featureTypes.push('survey');
          }
          // Skip if multi-env mode but no environments available
        } else {
          const defaultEnv = this.envResolver.getDefaultEnvironment();
          promises.push(
            this.surveyService.listByEnvironment(defaultEnv, { isActive: true }).catch((_error) => {
              return { surveys: [], settings: null };
            })
          );
          featureTypes.push('survey');
        }
      }

      if (this.features.whitelist !== false && this.whitelistService) {
        if (isMultiEnvMode) {
          if (envList.length > 0) {
            promises.push(
              this.whitelistService.listByEnvironments(envList).catch((error) => {
                this.logger.warn('Failed to load whitelists', { error: error.message });
                return [];
              })
            );
            featureTypes.push('whitelist');
          }
          // Skip if multi-env mode but no environments available
        } else {
          const defaultEnv = this.envResolver.getDefaultEnvironment();
          promises.push(
            this.whitelistService.listByEnvironment(defaultEnv).catch((error) => {
              this.logger.warn('Failed to load whitelists', { error: error.message });
              return { ipWhitelist: [], accountWhitelist: [] };
            })
          );
          featureTypes.push('whitelist');
        }
      }

      if (this.features.serviceMaintenance !== false && this.serviceMaintenanceService) {
        if (isMultiEnvMode) {
          if (envList.length > 0) {
            promises.push(
              this.serviceMaintenanceService.getStatusByEnvironments(envList).catch((error) => {
                this.logger.warn('Failed to load service maintenance status', { error: error.message });
                return [];
              })
            );
            featureTypes.push('serviceMaintenance');
          }
          // Skip if multi-env mode but no environments available
        } else {
          const defaultEnv = this.envResolver.getDefaultEnvironment();
          promises.push(
            this.refreshServiceMaintenanceInternal(defaultEnv).catch((error) => {
              this.logger.warn('Failed to load service maintenance status', { error: error.message });
            })
          );
          featureTypes.push('serviceMaintenance');
        }
      }

      // Edge-specific features: these always use multi-environment APIs
      // Only load if we have environments available
      if (this.features.clientVersion === true && this.clientVersionService) {
        if (envList.length > 0) {
          promises.push(
            this.clientVersionService.listByEnvironments(envList).catch((error) => {
              this.logger.warn('Failed to load client versions', { error: error.message });
              return [];
            })
          );
          featureTypes.push('clientVersion');
        }
        // Skip if no environments available
      }

      if (this.features.serviceNotice === true && this.serviceNoticeService) {
        if (envList.length > 0) {
          promises.push(
            this.serviceNoticeService.listByEnvironments(envList).catch((error) => {
              this.logger.warn('Failed to load service notices', { error: error.message });
              return [];
            })
          );
          featureTypes.push('serviceNotice');
        }
        // Skip if no environments available
      }

      if (this.features.banner === true && this.bannerService) {
        if (envList.length > 0) {
          promises.push(
            this.bannerService.listByEnvironments(envList).catch((error) => {
              this.logger.warn('Failed to load banners', { error: error.message });
              return [];
            })
          );
          featureTypes.push('banner');
        }
        // Skip if no environments available
      }

      if (this.features.storeProduct === true && this.storeProductService) {
        if (isMultiEnvMode) {
          if (envList.length > 0) {
            promises.push(
              this.storeProductService.listByEnvironments(envList).catch((error) => {
                this.logger.warn('Failed to load store products', { error: error.message });
                return [];
              })
            );
            featureTypes.push('storeProduct');
          }
          // Skip if multi-env mode but no environments available
        } else {
          const defaultEnv = this.envResolver.getDefaultEnvironment();
          promises.push(
            this.storeProductService.listByEnvironment(defaultEnv).catch((error) => {
              this.logger.warn('Failed to load store products', { error: error.message });
              return [];
            })
          );
          featureTypes.push('storeProduct');
        }
      }

      // Load all enabled features in parallel
      await Promise.all(promises);

      // Record initial load timestamp
      this.lastRefreshedAt = new Date();
      this.invalidationCount++;

      this.logger.info('SDK cache initialized', {
        enabledFeatures: featureTypes,
        environments: this.environments === '*' ? `* (${this.cachedEnvironmentList.length} envs)` : this.environments
      });

      // Initialize maintenance watcher with current state (no events emitted on first check)
      if (this.features.serviceMaintenance !== false || this.features.gameWorld !== false) {
        this.checkMaintenanceStateChanges();
      }

      // Setup auto-refresh if using polling method
      if (this.config.refreshMethod === 'polling' && this.config.ttl) {
        this.startAutoRefresh();
      }
    } catch (error: any) {
      this.logger.error('Failed to initialize cache', { error: error.message });
      throw error;
    }
  }

  /**
   * Wait for backend to be ready with retry logic
   * Attempts to connect for up to 30 seconds using /api/v1/ready endpoint
   */
  private async waitForBackendReady(): Promise<void> {
    const maxAttempts = 60; // 30 seconds with 500ms interval
    const retryInterval = 500; // milliseconds

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Check backend ready status via dedicated endpoint
        const response = await this.apiClient.get<{ status: string }>('/api/v1/ready');

        if (response.success && response.data?.status === 'ready') {
          this.logger.info('Gatrix backend is ready');
          return;
        }
      } catch (_error: any) {
        // Silently continue on connection errors during startup
      }

      if (attempt === maxAttempts) {
        this.logger.error('Gatrix backend is not ready after maximum attempts', {
          attempts: maxAttempts,
          totalTime: `${maxAttempts * retryInterval / 1000}s`,
        });
        throw new Error('Gatrix backend failed to become ready within timeout period');
      }

      // Wait before retrying
      await sleep(retryInterval);
    }
  }

  /**
   * Start auto-refresh interval
   */
  private startAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    const intervalMs = (this.config.ttl || 300) * 1000;

    this.refreshInterval = setInterval(async () => {
      this.logger.debug('Auto-refreshing cache...');
      await this.refreshAll();
    }, intervalMs);

    this.logger.info('Auto-refresh started', { intervalMs });
  }

  /**
   * Stop auto-refresh interval
   */
  stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = undefined;
      this.logger.info('Auto-refresh stopped');
    }
  }

  /**
   * Get target environments for multi-environment mode
   * Returns the cached environment list for '*' mode, or the explicit list
   */
  private getTargetEnvironments(): string[] {
    if (this.environments === '*') {
      return this.cachedEnvironmentList;
    }
    if (Array.isArray(this.environments)) {
      return this.environments;
    }
    // Default: single environment mode
    return ['development'];
  }

  /**
   * Refresh environment list and load data for new environments
   * Used when environment.created event is received
   */
  async refreshEnvironmentList(): Promise<{ added: string[]; removed: string[] }> {
    if (this.environments !== '*' || !this.environmentService) {
      return { added: [], removed: [] };
    }

    const oldEnvList = [...this.cachedEnvironmentList];
    const environments = await this.environmentService.fetchEnvironments();
    this.cachedEnvironmentList = environments.map(e => e.environment);

    const added = this.cachedEnvironmentList.filter(e => !oldEnvList.includes(e));
    const removed = oldEnvList.filter(e => !this.cachedEnvironmentList.includes(e));

    this.logger.info('Environment list refreshed', {
      total: this.cachedEnvironmentList.length,
      added,
      removed
    });

    // Load data for newly added environments
    if (added.length > 0) {
      await this.loadDataForEnvironments(added);
    }

    // Remove cached data for removed environments
    if (removed.length > 0) {
      this.clearDataForEnvironments(removed);
    }

    return { added, removed };
  }

  /**
   * Load data for specific environments (ALL features, not just Edge-specific ones)
   * This ensures full data synchronization when new environments are added
   */
  private async loadDataForEnvironments(environments: string[]): Promise<void> {
    this.logger.info('Loading data for new environments', { environments });

    const promises: Promise<any>[] = [];

    // All services use optional chaining since they are controlled by feature flags
    // gameWorld - uses !== false check for backward compatibility
    if (this.features.gameWorld !== false && this.gameWorldService) {
      promises.push(
        this.gameWorldService.listByEnvironments(environments).catch((error) => {
          this.logger.warn('Failed to load game worlds for new environments', { error: error.message });
        })
      );
    }

    // popupNotice - uses !== false check for backward compatibility
    if (this.features.popupNotice !== false && this.popupNoticeService) {
      promises.push(
        this.popupNoticeService.listByEnvironments(environments).catch((error) => {
          this.logger.warn('Failed to load popup notices for new environments', { error: error.message });
        })
      );
    }

    // survey - uses !== false check for backward compatibility
    if (this.features.survey !== false && this.surveyService) {
      promises.push(
        this.surveyService.listByEnvironments(environments).catch((error) => {
          this.logger.warn('Failed to load surveys for new environments', { error: error.message });
        })
      );
    }

    // whitelist - uses !== false check for backward compatibility
    if (this.features.whitelist !== false && this.whitelistService) {
      promises.push(
        this.whitelistService.listByEnvironments(environments).catch((error) => {
          this.logger.warn('Failed to load whitelists for new environments', { error: error.message });
        })
      );
    }

    // serviceMaintenance - uses !== false check for backward compatibility
    if (this.features.serviceMaintenance !== false && this.serviceMaintenanceService) {
      promises.push(
        this.serviceMaintenanceService.listByEnvironments(environments).catch((error) => {
          this.logger.warn('Failed to load service maintenance for new environments', { error: error.message });
        })
      );
    }

    // Edge-specific features (default: false, must be explicitly enabled)
    if (this.features.clientVersion === true && this.clientVersionService) {
      promises.push(
        this.clientVersionService.listByEnvironments(environments).catch((error) => {
          this.logger.warn('Failed to load client versions for new environments', { error: error.message });
        })
      );
    }

    if (this.features.serviceNotice === true && this.serviceNoticeService) {
      promises.push(
        this.serviceNoticeService.listByEnvironments(environments).catch((error) => {
          this.logger.warn('Failed to load service notices for new environments', { error: error.message });
        })
      );
    }

    if (this.features.banner === true && this.bannerService) {
      promises.push(
        this.bannerService.listByEnvironments(environments).catch((error) => {
          this.logger.warn('Failed to load banners for new environments', { error: error.message });
        })
      );
    }

    if (this.features.storeProduct === true && this.storeProductService) {
      promises.push(
        this.storeProductService.listByEnvironments(environments).catch((error) => {
          this.logger.warn('Failed to load store products for new environments', { error: error.message });
        })
      );
    }

    await Promise.all(promises);
    this.logger.info('Data loaded for new environments', { environments });
  }

  /**
   * Clear cached data for removed environments (ALL services)
   */
  private clearDataForEnvironments(environments: string[]): void {
    this.logger.info('Clearing data for removed environments', { environments });

    for (const env of environments) {
      // All services use optional chaining since they are controlled by feature flags
      this.gameWorldService?.clearCacheForEnvironment(env);
      this.popupNoticeService?.clearCacheForEnvironment(env);
      this.surveyService?.clearCacheForEnvironment(env);
      this.whitelistService?.clearCacheForEnvironment(env);
      this.serviceMaintenanceService?.clearCacheForEnvironment(env);
      this.clientVersionService?.clearCacheForEnvironment(env);
      this.serviceNoticeService?.clearCacheForEnvironment(env);
      this.bannerService?.clearCacheForEnvironment(env);
      this.storeProductService?.clearCacheForEnvironment(env);
    }
  }

  /**
   * Refresh all cached data based on enabled features
   */
  async refreshAll(): Promise<void> {
    this.logger.info('Refreshing all caches...');

    const start = process.hrtime.bigint();
    try {
      const promises: Promise<any>[] = [];
      const refreshedTypes: string[] = [];

      // For wildcard mode, refresh environment list first
      if (this.environments === '*' && this.environmentService) {
        const environments = await this.environmentService.fetchEnvironments();
        this.cachedEnvironmentList = environments.map(e => e.environment);
      }

      // Get target environments for multi-environment mode
      const envList = this.getTargetEnvironments();
      const isMultiEnvMode = this.environments === '*' || (Array.isArray(this.environments) && this.environments.length > 0);

      // In multi-environment mode, if envList is empty, we should skip refresh
      // rather than falling back to default environment
      if (isMultiEnvMode && envList.length === 0) {
        this.logger.warn('Multi-environment mode enabled but no environments available. Skipping refresh.', {
          mode: this.environments === '*' ? 'wildcard' : 'explicit',
          configuredEnvironments: this.environments,
        });
      }

      // All services use optional chaining since they are controlled by feature flags
      // In multi-environment mode, use listByEnvironments for environment-specific features
      if (this.features.gameWorld !== false && this.gameWorldService) {
        if (isMultiEnvMode) {
          if (envList.length > 0) {
            promises.push(
              this.gameWorldService.listByEnvironments(envList).catch((error) => {
                this.logger.warn('Failed to refresh game worlds', { error: error.message });
                return [];
              })
            );
            refreshedTypes.push('gameWorld');
          }
        } else {
          const defaultEnv = this.envResolver.getDefaultEnvironment();
          promises.push(this.gameWorldService.refreshByEnvironment(defaultEnv, true)); // suppressWarnings=true for refreshAll
          refreshedTypes.push('gameWorld');
        }
      }

      if (this.features.popupNotice !== false && this.popupNoticeService) {
        if (isMultiEnvMode) {
          if (envList.length > 0) {
            promises.push(
              this.popupNoticeService.listByEnvironments(envList).catch((error) => {
                this.logger.warn('Failed to refresh popup notices', { error: error.message });
                return [];
              })
            );
            refreshedTypes.push('popupNotice');
          }
        } else {
          const defaultEnv = this.envResolver.getDefaultEnvironment();
          promises.push(this.popupNoticeService.refreshByEnvironment(defaultEnv, true)); // suppressWarnings=true for refreshAll
          refreshedTypes.push('popupNotice');
        }
      }

      if (this.features.survey !== false && this.surveyService) {
        if (isMultiEnvMode) {
          if (envList.length > 0) {
            promises.push(
              this.surveyService.listByEnvironments(envList, { isActive: true }).catch((error) => {
                this.logger.warn('Failed to refresh surveys', { error: error.message });
                return { surveys: [], settings: null };
              })
            );
            refreshedTypes.push('survey');
          }
        } else {
          const defaultEnv = this.envResolver.getDefaultEnvironment();
          promises.push(
            this.surveyService.refreshByEnvironment(defaultEnv, { isActive: true }, true).catch((error) => { // suppressWarnings=true for refreshAll
              this.logger.warn('Failed to refresh surveys', { error: error.message });
            })
          );
          refreshedTypes.push('survey');
        }
      }

      if (this.features.whitelist !== false && this.whitelistService) {
        if (isMultiEnvMode) {
          if (envList.length > 0) {
            promises.push(
              this.whitelistService.listByEnvironments(envList).catch((error) => {
                this.logger.warn('Failed to refresh whitelists', { error: error.message });
                return [];
              })
            );
            refreshedTypes.push('whitelist');
          }
        } else {
          const defaultEnv = this.envResolver.getDefaultEnvironment();
          promises.push(
            this.whitelistService.refreshByEnvironment(defaultEnv, true).catch((error) => { // suppressWarnings=true for refreshAll
              this.logger.warn('Failed to refresh whitelists', { error: error.message });
            })
          );
          refreshedTypes.push('whitelist');
        }
      }

      if (this.features.serviceMaintenance !== false && this.serviceMaintenanceService) {
        if (isMultiEnvMode) {
          if (envList.length > 0) {
            promises.push(
              this.serviceMaintenanceService.getStatusByEnvironments(envList).catch((error) => {
                this.logger.warn('Failed to refresh service maintenance', { error: error.message });
                return [];
              })
            );
            refreshedTypes.push('serviceMaintenance');
          }
        } else {
          const defaultEnv = this.envResolver.getDefaultEnvironment();
          promises.push(
            this.refreshServiceMaintenanceInternal(defaultEnv).catch((error) => {
              this.logger.warn('Failed to refresh service maintenance', { error: error.message });
            })
          );
          refreshedTypes.push('serviceMaintenance');
        }
      }

      // Edge-specific features: these always use multi-environment APIs
      // Only refresh if we have environments available
      if (this.features.clientVersion === true && this.clientVersionService) {
        if (envList.length > 0) {
          promises.push(
            this.clientVersionService.listByEnvironments(envList).catch((error) => {
              this.logger.warn('Failed to refresh client versions', { error: error.message });
            })
          );
          refreshedTypes.push('clientVersion');
        }
      }

      if (this.features.serviceNotice === true && this.serviceNoticeService) {
        if (envList.length > 0) {
          promises.push(
            this.serviceNoticeService.listByEnvironments(envList).catch((error) => {
              this.logger.warn('Failed to refresh service notices', { error: error.message });
            })
          );
          refreshedTypes.push('serviceNotice');
        }
      }

      if (this.features.banner === true && this.bannerService) {
        if (envList.length > 0) {
          promises.push(
            this.bannerService.listByEnvironments(envList).catch((error) => {
              this.logger.warn('Failed to refresh banners', { error: error.message });
            })
          );
          refreshedTypes.push('banner');
        }
      }

      if (this.features.storeProduct === true && this.storeProductService) {
        if (isMultiEnvMode) {
          if (envList.length > 0) {
            promises.push(
              this.storeProductService.listByEnvironments(envList).catch((error) => {
                this.logger.warn('Failed to refresh store products', { error: error.message });
              })
            );
            refreshedTypes.push('storeProduct');
          }
        } else {
          const defaultEnv = this.envResolver.getDefaultEnvironment();
          promises.push(
            this.storeProductService.refreshByEnvironment(defaultEnv, true).catch((error) => {
              this.logger.warn('Failed to refresh store products', { error: error.message });
            })
          );
          refreshedTypes.push('storeProduct');
        }
      }

      await Promise.all(promises);

      // Record last refresh timestamp
      this.lastRefreshedAt = new Date();

      try {
        const duration = Number(process.hrtime.bigint() - start) / 1e9;
        this.metrics?.incRefresh('all');
        this.metrics?.observeRefresh('all', duration);
        this.metrics?.setLastRefresh('all');
      } catch (_) { }

      this.logger.info('All caches refreshed successfully', { types: refreshedTypes });
      this.lastRefreshedAt = new Date();
      this.invalidationCount++;

      // Check and emit maintenance state changes
      if (this.features.serviceMaintenance !== false || this.features.gameWorld !== false) {
        this.checkMaintenanceStateChanges();
      }

      // Emit refresh events for polling method
      if (this.config.refreshMethod === 'polling') {
        this.emitRefreshEvent('cache.refreshed', {
          timestamp: new Date().toISOString(),
          types: refreshedTypes,
        });
      }
    } catch (error: any) {
      this.logger.error('Failed to refresh caches', { error: error.message });
      try { this.metrics?.incError('cache', 'refreshAll'); } catch (_) { }
      throw error;
    }
  }

  /**
   * Refresh game worlds cache
   * Also checks and emits maintenance state change events
   * @param environment Environment name (required)
   */
  async refreshGameWorlds(environment: string): Promise<void> {
    if (!this.gameWorldService) return;
    const start = process.hrtime.bigint();
    await this.gameWorldService.refreshByEnvironment(environment);
    try {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics?.incRefresh('gameworlds');
      this.metrics?.observeRefresh('gameworlds', duration);
      this.metrics?.setLastRefresh('gameworlds');
    } catch (_) { }
    // Check maintenance state changes after refresh
    this.checkMaintenanceStateChanges();
  }

  /**
   * Refresh popup notices cache
   * @param environment Environment name (required)
   */
  async refreshPopupNotices(environment: string): Promise<void> {
    if (!this.popupNoticeService) return;
    const start = process.hrtime.bigint();
    await this.popupNoticeService.refreshByEnvironment(environment);
    try {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics?.incRefresh('popups');
      this.metrics?.observeRefresh('popups', duration);
      this.metrics?.setLastRefresh('popups');
    } catch (_) { }
  }

  /**
   * Refresh surveys cache
   * @param environment Environment name (required)
   */
  async refreshSurveys(environment: string): Promise<void> {
    if (!this.surveyService) return;
    const start = process.hrtime.bigint();
    await this.surveyService.refreshByEnvironment(environment, { isActive: true });
    try {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics?.incRefresh('surveys');
      this.metrics?.observeRefresh('surveys', duration);
      this.metrics?.setLastRefresh('surveys');
    } catch (_) { }
  }

  /**
   * Refresh survey settings only
   * @param environment Environment name (required)
   */
  async refreshSurveySettings(environment: string): Promise<void> {
    await this.surveyService?.refreshSettings(environment);
  }

  /**
   * Update a single game world in cache (immutable)
   * Also checks and emits maintenance state change events
   * @param id Game world ID
   * @param environment Environment name (required)
   * @param isVisible Optional visibility flag
   */
  async updateSingleGameWorld(id: number, environment: string, isVisible?: boolean | number): Promise<void> {
    await this.gameWorldService?.updateSingleWorld(id, environment, isVisible);
    // Check maintenance state changes after update
    this.checkMaintenanceStateChanges();
  }

  /**
   * Get all cached data (game worlds, popup notices, surveys)
   */
  getAllCachedData(): any {
    // Convert Map to plain object for JSON serialization
    const mapToObject = <T>(map: Map<string, T[]> | undefined): Record<string, T[]> => {
      if (!map) return {};
      const obj: Record<string, T[]> = {};
      for (const [key, value] of map.entries()) {
        obj[key] = value;
      }
      return obj;
    };

    // Helper to convert Map<string, T> (non-array values like WhitelistData, MaintenanceStatus)
    const mapToObjectSingle = <T>(map: Map<string, T> | undefined): Record<string, T> => {
      if (!map) return {};
      const obj: Record<string, T> = {};
      for (const [key, value] of map.entries()) {
        obj[key] = value;
      }
      return obj;
    };

    return {
      lastRefreshedAt: this.lastRefreshedAt?.toISOString() || null,
      invalidationCount: this.invalidationCount,
      gameWorlds: mapToObject(this.gameWorldService?.getAllCached()),
      popupNotices: mapToObject(this.popupNoticeService?.getAllCached()),
      surveys: mapToObject(this.surveyService?.getAllCached()),
      whitelists: mapToObjectSingle(this.whitelistService?.getAllCached()),
      serviceMaintenance: mapToObjectSingle(this.serviceMaintenanceService?.getAllCached()),
      clientVersions: mapToObject(this.clientVersionService?.getAllCached()),
      serviceNotices: mapToObject(this.serviceNoticeService?.getAllCached()),
      banners: mapToObject(this.bannerService?.getAllCached()),
      storeProducts: mapToObject(this.storeProductService?.getAllCached()),
    };
  }

  /**
   * Get last cache refresh timestamp
   */
  getLastRefreshedAt(): Date | null {
    return this.lastRefreshedAt;
  }

  /**
   * Get cached game worlds
   * @param environment Environment name (required)
   */
  getGameWorlds(environment: string): any[] {
    return this.gameWorldService?.getCached(environment) || [];
  }

  /**
   * Remove a game world from cache (immutable)
   * @param id Game world ID
   * @param environment Environment name (required)
   */
  removeGameWorld(id: number, environment: string): void {
    this.gameWorldService?.removeFromCache(id, environment);
  }

  /**
   * Update a single popup notice in cache (immutable)
   * @param id Popup notice ID
   * @param environment Environment name (required)
   * @param isVisible Optional visibility status
   */
  async updateSinglePopupNotice(id: number, environment: string, isVisible?: boolean | number): Promise<void> {
    await this.popupNoticeService?.updateSingleNotice(id, environment, isVisible);
  }

  /**
   * Remove a popup notice from cache (immutable)
   * @param id Popup notice ID
   * @param environment Environment name (required)
   */
  removePopupNotice(id: number, environment: string): void {
    this.popupNoticeService?.removeFromCache(id, environment);
  }

  /**
   * Update a single survey in cache (immutable)
   * @param id Survey ID
   * @param environment Environment name (required)
   * @param isActive Optional active status
   */
  async updateSingleSurvey(id: string, environment: string, isActive?: boolean | number): Promise<void> {
    await this.surveyService?.updateSingleSurvey(id, environment, isActive);
  }

  /**
   * Remove a survey from cache (immutable)
   * @param id Survey ID
   * @param environment Environment name (required)
   */
  removeSurvey(id: string, environment: string): void {
    this.surveyService?.removeSurvey(id, environment);
  }

  /**
   * Refresh whitelist cache only
   * @param environment Environment name (required)
   */
  async refreshWhitelists(environment: string): Promise<void> {
    if (!this.whitelistService) return;
    this.logger.info('Refreshing whitelist cache...');
    const start = process.hrtime.bigint();
    await this.whitelistService.refreshByEnvironment(environment);
    try {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics?.incRefresh('whitelists');
      this.metrics?.observeRefresh('whitelists', duration);
      this.metrics?.setLastRefresh('whitelists');
    } catch (_) { }
  }

  /**
   * Get cached whitelists
   * @param environment Environment name (required)
   */
  getWhitelists(environment: string) {
    return this.whitelistService?.getCached(environment);
  }

  /**
   * Internal service maintenance refresh (without maintenance state check)
   * Used by refreshAll() to avoid duplicate state checks
   * @param environment Environment name (required)
   */
  private async refreshServiceMaintenanceInternal(environment: string): Promise<void> {
    if (!this.serviceMaintenanceService) return;
    this.logger.info('Refreshing service maintenance cache...');
    const start = process.hrtime.bigint();
    try {
      const status = await this.serviceMaintenanceService.refreshByEnvironment(environment, true); // suppressWarnings=true for refreshAll
      this.emitRefreshEvent('serviceMaintenance', status);
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      try {
        this.metrics?.incRefresh('serviceMaintenance');
        this.metrics?.observeRefresh('serviceMaintenance', duration);
        this.metrics?.setLastRefresh('serviceMaintenance');
      } catch (_) { }
    } catch (error: any) {
      this.logger.warn('Failed to refresh service maintenance status', { error: error.message });
    }
  }

  /**
   * Refresh service maintenance status
   * Also checks and emits maintenance state change events
   * @param environment Environment name (required)
   */
  async refreshServiceMaintenance(environment: string): Promise<void> {
    await this.refreshServiceMaintenanceInternal(environment);
    // Check maintenance state changes after refresh
    this.checkMaintenanceStateChanges(environment);
  }

  /**
   * Check and emit maintenance state change events
   * Compares current state with previous state and emits events if changed
   * @param environment Optional environment name. If not provided, checks all cached environments.
   */
  private checkMaintenanceStateChanges(environment?: string): void {
    try {
      if (environment) {
        // Check specific environment
        const serviceStatus = this.serviceMaintenanceService?.getCached(environment) || null;
        const gameWorlds = this.gameWorldService?.getCached(environment) || [];
        this.maintenanceWatcher.checkAndEmitChanges(serviceStatus, gameWorlds);
      } else {
        // Check all cached environments (for multi-env mode or when environment is not specified)
        const allGameWorlds = this.gameWorldService?.getAllCached() || new Map();
        const allServiceStatus = this.serviceMaintenanceService?.getAllCached() || new Map();

        // Collect all environments from both services
        const allEnvs = new Set([...allGameWorlds.keys(), ...allServiceStatus.keys()]);

        for (const env of allEnvs) {
          const serviceStatus = allServiceStatus.get(env) || null;
          const gameWorlds = allGameWorlds.get(env) || [];
          this.maintenanceWatcher.checkAndEmitChanges(serviceStatus, gameWorlds);
        }
      }
    } catch (error: any) {
      this.logger.error('Error checking maintenance state changes', { error: error.message });
    }
  }

  /**
   * Get cached service maintenance status
   * @param environment Environment name (required)
   */
  getServiceMaintenanceStatus(environment: string): MaintenanceStatus | null {
    return this.serviceMaintenanceService?.getCached(environment) || null;
  }

  /**
   * Get actual start time for service maintenance
   * Used by getMaintenanceInfo() to provide actualStartTime to clients
   */
  getServiceMaintenanceActualStartTime(): string | undefined {
    const state = this.maintenanceWatcher.getCurrentState();
    return state?.serviceActualStartTime;
  }

  /**
   * Get actual start time for world maintenance
   * @param worldId The world ID to check
   */
  getWorldMaintenanceActualStartTime(worldId: string): string | undefined {
    const state = this.maintenanceWatcher.getCurrentState();
    return state?.worldActualStartTimes.get(worldId);
  }

  // ==================== NEW SERVICE GETTERS (Edge features) ====================

  /**
   * Get cached client versions
   * @param environment Environment name (required)
   */
  getClientVersions(environment: string): ClientVersion[] {
    return this.clientVersionService?.getCached(environment) || [];
  }

  /**
   * Update a single client version in cache (immutable)
   * @param item Client version to update
   * @param environment Environment name (required)
   */
  async updateSingleClientVersion(item: any, environment: string): Promise<void> {
    this.clientVersionService?.updateSingleClientVersion(item, environment);
  }

  /**
   * Get cached service notices
   * @param environment Environment name (required)
   */
  getServiceNotices(environment: string): ServiceNotice[] {
    return this.serviceNoticeService?.getCached(environment) || [];
  }

  /**
   * Update a single service notice in cache (immutable)
   * @param notice Service notice to update
   * @param environment Environment name (required)
   */
  async updateSingleServiceNotice(notice: any, environment: string): Promise<void> {
    this.serviceNoticeService?.updateSingleServiceNotice(notice, environment);
  }

  /**
   * Get cached banners
   * @param environment Environment name (required)
   */
  getBanners(environment: string): Banner[] {
    return this.bannerService?.getCached(environment) || [];
  }

  // ==================== SERVICE GETTERS ====================

  /**
   * Get GameWorldService instance
   */
  getGameWorldService(): GameWorldService | undefined {
    return this.gameWorldService;
  }

  /**
   * Get PopupNoticeService instance
   */
  getPopupNoticeService(): PopupNoticeService | undefined {
    return this.popupNoticeService;
  }

  /**
   * Get SurveyService instance
   */
  getSurveyService(): SurveyService | undefined {
    return this.surveyService;
  }

  /**
   * Get WhitelistService instance
   */
  getWhitelistService(): WhitelistService | undefined {
    return this.whitelistService;
  }

  /**
   * Get ServiceMaintenanceService instance
   */
  getServiceMaintenanceService(): ServiceMaintenanceService | undefined {
    return this.serviceMaintenanceService;
  }

  /**
   * Get ClientVersionService instance
   */
  getClientVersionService(): ClientVersionService | undefined {
    return this.clientVersionService;
  }

  /**
   * Get ServiceNoticeService instance
   */
  getServiceNoticeService(): ServiceNoticeService | undefined {
    return this.serviceNoticeService;
  }

  /**
   * Get BannerService instance
   */
  getBannerService(): BannerService | undefined {
    return this.bannerService;
  }

  /**
   * Get cached store products
   * @param environment Environment name (required)
   */
  getStoreProducts(environment: string): StoreProduct[] {
    return this.storeProductService?.getCached(environment) || [];
  }

  /**
   * Get StoreProductService instance
   */
  getStoreProductService(): StoreProductService | undefined {
    return this.storeProductService;
  }

  /**
   * Get FeatureFlagService instance
   */
  getFeatureFlagService(): FeatureFlagService | undefined {
    return this.featureFlagService;
  }

  /**
   * Update a single store product in cache (immutable)
   * @param id Store product ID
   * @param environment Environment name (required)
   * @param isActive Optional active status
   */
  async updateSingleStoreProduct(id: string, environment: string, isActive?: boolean | number): Promise<void> {
    await this.storeProductService?.updateSingleProduct(id, environment, isActive);
  }

  /**
   * Remove a store product from cache (immutable)
   * @param id Store product ID
   * @param environment Environment name (required)
   */
  removeStoreProduct(id: string, environment: string): void {
    this.storeProductService?.removeFromCache(id, environment);
  }

  /**
   * Refresh store products cache for an environment
   * @param environment Environment name (required)
   */
  async refreshStoreProducts(environment: string): Promise<void> {
    await this.storeProductService?.refreshByEnvironment(environment);
  }

  /**
   * Update a single banner in cache (immutable)
   * @param bannerId Banner ID
   * @param environment Environment name (required)
   * @param status Optional status
   */
  async updateSingleBanner(bannerId: string, environment: string, status?: string): Promise<void> {
    await this.bannerService?.updateSingleBanner(bannerId, environment, status);
  }

  /**
   * Remove a banner from cache (immutable)
   * @param bannerId Banner ID
   * @param environment Environment name (required)
   */
  removeBanner(bannerId: string, environment: string): void {
    this.bannerService?.removeFromCache(bannerId, environment);
  }

  /**
   * Get features configuration
   */
  getFeatures(): FeaturesConfig {
    return this.features;
  }

  // ==================== CACHE MANAGEMENT ====================

  /**
   * Clear all caches
   */
  clear(): void {
    this.logger.info('Clearing all caches');
    // All services use optional chaining since they are controlled by feature flags
    this.gameWorldService?.clearCache();
    this.popupNoticeService?.clearCache();
    this.surveyService?.clearCache();
    this.whitelistService?.clearCache();
    this.serviceMaintenanceService?.clearCache();
    this.clientVersionService?.clearCache();
    this.serviceNoticeService?.clearCache();
    this.bannerService?.clearCache();
    this.storeProductService?.clearCache();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopAutoRefresh();
    this.clear();
    this.logger.info('Cache manager destroyed');
  }
}
