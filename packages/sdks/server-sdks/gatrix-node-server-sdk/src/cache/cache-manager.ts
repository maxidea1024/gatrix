/**
 * Cache Manager
 * Manages in-memory caching for game worlds, popup notices, surveys, and Edge-specific data
 */

import { Logger } from '../utils/logger';
import { CacheConfig, UsesConfig, FeatureFlagConfig } from '../types/config';
import { GameWorldService } from '../services/game-world-service';
import { PopupNoticeService } from '../services/popup-notice-service';
import { SurveyService } from '../services/survey-service';
import { WhitelistService } from '../services/whitelist-service';
import { ServiceMaintenanceService } from '../services/service-maintenance-service';
import { ClientVersionService } from '../services/client-version-service';
import { ServiceNoticeService } from '../services/service-notice-service';
import { BannerService } from '../services/banner-service';
import { StoreProductService } from '../services/store-product-service';
import { FeatureFlagService } from '../services/feature-flag-service';
import { VarsService } from '../services/vars-service';
import {
  IEnvironmentProvider,
  SingleEnvironmentProvider,
} from '../utils/environment-provider';
import { ApiClient } from '../client/api-client';
import { ApiClientFactory } from '../client/api-client-factory';
import { SdkMetrics } from '../utils/sdk-metrics';
import {
  MaintenanceStatus,
  ClientVersion,
  ServiceNotice,
  Banner,
  StoreProduct,
} from '../types/api';
import { sleep } from '../utils/time';
import {
  MaintenanceWatcher,
  MaintenanceEventCallback,
} from './maintenance-watcher';
import {
  CacheStorageProvider,
  FileCacheStorageProvider,
} from './storage-provider';

export class CacheManager {
  private logger: Logger;
  private config: CacheConfig;
  private uses: UsesConfig;
  private storage: CacheStorageProvider;
  // Default environment ID (used as cache key in single-environment mode)
  private defaultEnvironmentId: string;
  private readonly multiMode: boolean;
  // Environment provider for multi-environment mode
  private environmentProvider: IEnvironmentProvider;
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
  private varsService?: VarsService;
  private apiClient: ApiClient;
  private apiClientFactory: ApiClientFactory;
  private refreshInterval?: NodeJS.Timeout;
  private refreshCallbacks: Array<(type: string, data: any) => void> = [];
  private metrics?: SdkMetrics;
  private maintenanceWatcher: MaintenanceWatcher;
  // Last cache refresh timestamp
  private lastRefreshedAt: Date | null = null;
  // Cache invalidation counter
  private invalidationCount: number = 0;
  // Environment ID resolved from backend /ready endpoint
  private resolvedEnvironmentId: string | null = null;
  private resolvedOrgId: string | null = null;
  private resolvedProjectId: string | null = null;

  constructor(
    config: CacheConfig,
    apiClient: ApiClient,
    logger: Logger,
    defaultEnvironmentId: string,
    metrics?: SdkMetrics,
    configWorldId?: string,
    uses?: UsesConfig,
    environmentProvider?: IEnvironmentProvider,
    featureFlagConfig?: FeatureFlagConfig
  ) {
    this.config = {
      enabled: config.enabled !== false,
      ttl: config.ttl || 300,
      refreshMethod: config.refreshMethod ?? 'polling', // Default: polling
      skipBackendReady: config.skipBackendReady ?? false, // Default: wait for backend
    };
    this.uses = uses || {};
    this.apiClient = apiClient;
    this.logger = logger;
    this.metrics = metrics;
    this.maintenanceWatcher = new MaintenanceWatcher(logger, configWorldId);
    this.storage = new FileCacheStorageProvider(logger);

    // Store default environment ID and environment provider
    this.defaultEnvironmentId = defaultEnvironmentId;
    this.multiMode = environmentProvider !== undefined;
    this.environmentProvider =
      environmentProvider ||
      new SingleEnvironmentProvider(defaultEnvironmentId);

    // Create ApiClientFactory for multi-environment ETag isolation
    this.apiClientFactory = new ApiClientFactory(
      apiClient,
      defaultEnvironmentId,
      {
        baseURL: apiClient.getAxiosInstance().defaults.baseURL || '',
        appName:
          (apiClient.getAxiosInstance().defaults.headers?.common?.[
            'X-Application-Name'
          ] as string) ||
          (apiClient.getAxiosInstance().defaults.headers?.[
            'X-Application-Name'
          ] as string) ||
          '',
        logger: logger,
        metrics: metrics,
      }
    );

    // Initialize ALL services internally based on feature flags
    // All services are optional and controlled by feature flags
    // Default features (gameWorld, popupNotice, survey, whitelist, serviceMaintenance) use !== false for backward compatibility
    // New features (clientVersion, serviceNotice, banner, storeProduct) require explicit === true
    if (this.uses.gameWorld !== false) {
      this.gameWorldService = new GameWorldService(
        apiClient,
        logger,
        this.defaultEnvironmentId,
        this.storage
      );
      this.gameWorldService.setFeatureEnabled(true);
      this.gameWorldService.setApiClientFactory(this.apiClientFactory);
    }
    if (this.uses.popupNotice !== false) {
      this.popupNoticeService = new PopupNoticeService(
        apiClient,
        logger,
        this.defaultEnvironmentId,
        this.storage
      );
      this.popupNoticeService.setFeatureEnabled(true);
      this.popupNoticeService.setApiClientFactory(this.apiClientFactory);
    }
    if (this.uses.survey !== false) {
      this.surveyService = new SurveyService(
        apiClient,
        logger,
        this.defaultEnvironmentId,
        this.storage
      );
      this.surveyService.setFeatureEnabled(true);
    }
    if (this.uses.whitelist !== false) {
      this.whitelistService = new WhitelistService(
        apiClient,
        logger,
        this.defaultEnvironmentId,
        this.storage
      );
      this.whitelistService.setFeatureEnabled(true);
    }
    if (this.uses.serviceMaintenance !== false) {
      this.serviceMaintenanceService = new ServiceMaintenanceService(
        apiClient,
        logger,
        this.defaultEnvironmentId,
        this.storage
      );
      this.serviceMaintenanceService.setFeatureEnabled(true);
      this.serviceMaintenanceService.setApiClientFactory(this.apiClientFactory);
    }
    if (this.uses.clientVersion === true) {
      // ClientVersion is project-scoped — uses empty projectId initially,
      // updated to resolvedProjectId after /ready
      this.clientVersionService = new ClientVersionService(
        apiClient,
        logger,
        '',
        this.storage
      );
      this.clientVersionService.setFeatureEnabled(true);
      this.clientVersionService.setApiClientFactory(this.apiClientFactory);
    }
    if (this.uses.serviceNotice === true) {
      this.serviceNoticeService = new ServiceNoticeService(
        apiClient,
        logger,
        this.defaultEnvironmentId,
        this.storage
      );
      this.serviceNoticeService.setFeatureEnabled(true);
      this.serviceNoticeService.setApiClientFactory(this.apiClientFactory);
    }
    if (this.uses.banner === true) {
      this.bannerService = new BannerService(
        apiClient,
        logger,
        this.defaultEnvironmentId,
        this.storage
      );
      this.bannerService.setFeatureEnabled(true);
      this.bannerService.setApiClientFactory(this.apiClientFactory);
    }
    if (this.uses.storeProduct === true) {
      this.storeProductService = new StoreProductService(
        apiClient,
        logger,
        this.defaultEnvironmentId,
        this.storage
      );
      this.storeProductService.setFeatureEnabled(true);
      this.storeProductService.setApiClientFactory(this.apiClientFactory);
    }
    if (this.uses.featureFlag === true) {
      this.featureFlagService = new FeatureFlagService(
        apiClient,
        logger,
        this.defaultEnvironmentId,
        this.storage
      );
      this.featureFlagService.setFeatureEnabled(true);
      this.featureFlagService.setApiClientFactory(this.apiClientFactory);
      // Apply feature flag specific config (compact defaults to true)
      this.featureFlagService.setCompactFlags(
        featureFlagConfig?.compact !== false
      );
    }
    if (this.uses.vars === true) {
      this.varsService = new VarsService(
        apiClient,
        logger,
        this.defaultEnvironmentId,
        this.storage
      );
      this.varsService.setFeatureEnabled(true);
      this.varsService.setApiClientFactory(this.apiClientFactory);
    }
  }

  /**
   * Get environment IDs from the environment provider.
   * Maps EnvironmentEntry[] to string[] of environmentIds.
   */
  private getEnvironmentIds(): string[] {
    return this.environmentProvider
      .getEnvironmentTokens()
      .map((e) => e.environmentId);
  }

  /**
   * Register all environments from the provider into ApiClientFactory.
   * Must be called before fetching data in multi-environment mode.
   */
  private registerEnvironments(): void {
    const entries = this.environmentProvider.getEnvironmentTokens();
    for (const entry of entries) {
      this.apiClientFactory.registerEnvironment(
        entry.environmentId,
        entry.token
      );
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
      this.refreshCallbacks = this.refreshCallbacks.filter(
        (cb) => cb !== callback
      );
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
        this.logger.error('Error in refresh callback', {
          error: error.message,
        });
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
        this.logger.info(
          'Skipping backend ready check (skipBackendReady: true)'
        );
      }

      // In single-env mode, update defaultEnvironmentId with the real value from /ready
      if (!this.multiMode && this.resolvedEnvironmentId) {
        this.defaultEnvironmentId = this.resolvedEnvironmentId;
        // Update SingleEnvironmentProvider so getEnvironmentTokens() returns real environmentId
        if (this.environmentProvider.updateEnvironmentId) {
          this.environmentProvider.updateEnvironmentId(
            this.resolvedEnvironmentId
          );
        }
        // Remap ApiClientFactory so the default client is accessible by real environmentId
        this.apiClientFactory.remapDefaultEnvironment(
          this.resolvedEnvironmentId
        );
        this.logger.info(
          'Default environment updated with resolved environmentId',
          {
            environmentId: this.resolvedEnvironmentId,
          }
        );
      }

      // Update project-scoped services with the resolved projectId
      if (this.resolvedProjectId && this.clientVersionService) {
        this.clientVersionService.setDefaultProjectId(this.resolvedProjectId);
        this.logger.info('ClientVersionService projectId updated', {
          projectId: this.resolvedProjectId,
        });
      }

      // Register environments to ApiClientFactory (environmentId → token mapping)
      if (this.multiMode) {
        this.registerEnvironments();
      }

      // 1. Initial load from local storage for ALL enabled services
      const initPromises: Promise<void>[] = [];
      const envList = this.getEnvironmentIds();

      if (envList.length > 0) {
        this.logger.debug(
          'Loading initial data from local storage for environments',
          { envList }
        );
        for (const env of envList) {
          if (this.gameWorldService)
            initPromises.push(this.gameWorldService.initializeAsync(env));
          if (this.popupNoticeService)
            initPromises.push(this.popupNoticeService.initializeAsync(env));
          if (this.surveyService)
            initPromises.push(this.surveyService.initializeAsync(env));
          if (this.whitelistService)
            initPromises.push(this.whitelistService.initializeAsync(env));
          if (this.serviceMaintenanceService)
            initPromises.push(
              this.serviceMaintenanceService.initializeAsync(env)
            );
          // clientVersion is project-scoped — initialized separately below
          if (this.serviceNoticeService)
            initPromises.push(this.serviceNoticeService.initializeAsync(env));
          if (this.bannerService)
            initPromises.push(this.bannerService.initializeAsync(env));
          if (this.storeProductService)
            initPromises.push(this.storeProductService.initializeAsync(env));
          if (this.featureFlagService)
            initPromises.push(this.featureFlagService.initializeAsync(env));
          if (this.varsService)
            initPromises.push(this.varsService.initializeAsync(env));
        }
        await Promise.all(initPromises);
        this.logger.debug('Local cache initialization completed');
      }

      // 2. Initialize project-scoped services from local storage
      if (this.clientVersionService && this.resolvedProjectId) {
        await this.clientVersionService
          .initializeAsync(this.resolvedProjectId)
          .catch(() => {});
      }

      // 3. Remote synchronization (in background, but wait for first result)
      const promises: Promise<any>[] = [];
      const featureTypes: string[] = [];

      // Get target environments for multi-environment mode
      const isMultiEnv = this.multiMode;

      // If multi-env mode but no environments available, skip remote sync
      if (isMultiEnv && envList.length === 0) {
        this.logger.warn(
          'Multi-environment mode enabled but no environments available. Skipping remote sync.',
          {
            mode: false ? 'wildcard' : 'explicit',
          }
        );
      }

      // Build synchronization promises...
      // (Rest of the method remains similar but wrapped in protective try-catch where needed)

      // All services use optional chaining since they are controlled by feature flags
      // Use !== false check to maintain backward compatibility
      // In multi-environment mode, use listByEnvironments for environment-specific features
      if (this.uses.gameWorld !== false && this.gameWorldService) {
        if (isMultiEnv) {
          if (envList.length > 0) {
            promises.push(
              this.gameWorldService
                .listByEnvironments(envList)
                .catch((error) => {
                  this.logger.warn('Failed to load game worlds', {
                    error: error.message,
                  });
                  return [];
                })
            );
            featureTypes.push('gameWorld');
          }
          // Skip if multi-env mode but no environments available
        } else {
          const defaultEnv = this.defaultEnvironmentId;
          promises.push(
            this.gameWorldService
              .listByEnvironment(defaultEnv)
              .catch((error) => {
                this.logger.warn('Failed to load game worlds', {
                  error: error.message,
                });
                return [];
              })
          );
          featureTypes.push('gameWorld');
        }
      }

      if (this.uses.popupNotice !== false && this.popupNoticeService) {
        if (isMultiEnv) {
          if (envList.length > 0) {
            promises.push(
              this.popupNoticeService
                .listByEnvironments(envList)
                .catch((error) => {
                  this.logger.warn('Failed to load popup notices', {
                    error: error.message,
                  });
                  return [];
                })
            );
            featureTypes.push('popupNotice');
          }
          // Skip if multi-env mode but no environments available
        } else {
          const defaultEnv = this.defaultEnvironmentId;
          promises.push(
            this.popupNoticeService
              .listByEnvironment(defaultEnv)
              .catch((error) => {
                this.logger.warn('Failed to load popup notices', {
                  error: error.message,
                });
                return [];
              })
          );
          featureTypes.push('popupNotice');
        }
      }

      if (this.uses.survey !== false && this.surveyService) {
        if (isMultiEnv) {
          if (envList.length > 0) {
            promises.push(
              this.surveyService
                .listByEnvironments(envList, { isActive: true })
                .catch((error) => {
                  this.logger.warn('Failed to load surveys', {
                    error: error.message,
                  });
                  return { surveys: [], settings: null };
                })
            );
            featureTypes.push('survey');
          }
          // Skip if multi-env mode but no environments available
        } else {
          const defaultEnv = this.defaultEnvironmentId;
          promises.push(
            this.surveyService
              .listByEnvironment({ isActive: true }, defaultEnv)
              .catch((error) => {
                this.logger.warn('Failed to load surveys', {
                  error: error.message,
                });
                return { surveys: [], settings: null };
              })
          );
          featureTypes.push('survey');
        }
      }

      if (this.uses.whitelist !== false && this.whitelistService) {
        if (isMultiEnv) {
          if (envList.length > 0) {
            promises.push(
              this.whitelistService
                .listByEnvironments(envList)
                .catch((error) => {
                  this.logger.warn('Failed to load whitelists', {
                    error: error.message,
                  });
                  return [];
                })
            );
            featureTypes.push('whitelist');
          }
          // Skip if multi-env mode but no environments available
        } else {
          const defaultEnv = this.defaultEnvironmentId;
          promises.push(
            this.whitelistService
              .listByEnvironment(defaultEnv)
              .catch((error) => {
                this.logger.warn('Failed to load whitelists', {
                  error: error.message,
                });
                return { ipWhitelist: [], accountWhitelist: [] };
              })
          );
          featureTypes.push('whitelist');
        }
      }

      if (
        this.uses.serviceMaintenance !== false &&
        this.serviceMaintenanceService
      ) {
        if (isMultiEnv) {
          if (envList.length > 0) {
            promises.push(
              this.serviceMaintenanceService
                .getStatusByEnvironments(envList)
                .catch((error) => {
                  this.logger.warn(
                    'Failed to load service maintenance status',
                    {
                      error: error.message,
                    }
                  );
                  return [];
                })
            );
            featureTypes.push('serviceMaintenance');
          }
          // Skip if multi-env mode but no environments available
        } else {
          const defaultEnv = this.defaultEnvironmentId;
          promises.push(
            this.refreshServiceMaintenanceInternal(defaultEnv).catch(
              (error) => {
                this.logger.warn('Failed to load service maintenance status', {
                  error: error.message,
                });
              }
            )
          );
          featureTypes.push('serviceMaintenance');
        }
      }

      // Project-scoped features: fetched per project, not per environment
      if (this.uses.clientVersion === true && this.clientVersionService) {
        if (this.multiMode) {
          promises.push(this.fetchDataForProjects());
          featureTypes.push('clientVersion');
        } else if (this.resolvedProjectId) {
          // Single-env: use resolvedProjectId from /ready
          promises.push(
            this.clientVersionService
              .listByProject(this.resolvedProjectId)
              .catch((error) => {
                this.logger.warn('Failed to load client versions', {
                  error: error.message,
                });
                return [];
              })
          );
          featureTypes.push('clientVersion');
        }
      }

      if (this.uses.serviceNotice === true && this.serviceNoticeService) {
        if (envList.length > 0) {
          promises.push(
            this.serviceNoticeService
              .listByEnvironments(envList)
              .catch((error) => {
                this.logger.warn('Failed to load service notices', {
                  error: error.message,
                });
                return [];
              })
          );
          featureTypes.push('serviceNotice');
        }
        // Skip if no environments available
      }

      if (this.uses.banner === true && this.bannerService) {
        if (envList.length > 0) {
          promises.push(
            this.bannerService.listByEnvironments(envList).catch((error) => {
              this.logger.warn('Failed to load banners', {
                error: error.message,
              });
              return [];
            })
          );
          featureTypes.push('banner');
        }
        // Skip if no environments available
      }

      if (this.uses.storeProduct === true && this.storeProductService) {
        if (isMultiEnv) {
          if (envList.length > 0) {
            promises.push(
              this.storeProductService
                .listByEnvironments(envList)
                .catch((error) => {
                  this.logger.warn('Failed to load store products', {
                    error: error.message,
                  });
                  return [];
                })
            );
            featureTypes.push('storeProduct');
          }
          // Skip if multi-env mode but no environments available
        } else {
          const defaultEnv = this.defaultEnvironmentId;
          promises.push(
            this.storeProductService
              .listByEnvironment(defaultEnv)
              .catch((error) => {
                this.logger.warn('Failed to load store products', {
                  error: error.message,
                });
                return [];
              })
          );
          featureTypes.push('storeProduct');
        }
      }

      // Feature flags - requires explicit opt-in
      if (this.uses.featureFlag === true && this.featureFlagService) {
        if (isMultiEnv) {
          if (envList.length > 0) {
            promises.push(
              this.featureFlagService
                .listByEnvironments(envList)
                .catch((error) => {
                  this.logger.warn('Failed to load feature flags', {
                    error: error.message,
                  });
                  return [];
                })
            );
            featureTypes.push('featureFlag');
          }
        } else {
          const defaultEnv = this.defaultEnvironmentId;
          promises.push(
            this.featureFlagService
              .listByEnvironment(defaultEnv)
              .catch((error) => {
                this.logger.warn('Failed to load feature flags', {
                  error: error.message,
                });
                return [];
              })
          );
          featureTypes.push('featureFlag');
        }
      }

      // Vars (KV) - requires explicit opt-in
      if (this.uses.vars === true && this.varsService) {
        if (isMultiEnv) {
          if (envList.length > 0) {
            promises.push(
              this.varsService.listByEnvironments(envList).catch((error) => {
                this.logger.warn('Failed to load vars', {
                  error: error.message,
                });
                return [];
              })
            );
            featureTypes.push('vars');
          }
        } else {
          const defaultEnv = this.defaultEnvironmentId;
          promises.push(
            this.varsService.listByEnvironment(defaultEnv).catch((error) => {
              this.logger.warn('Failed to load vars', {
                error: error.message,
              });
              return [];
            })
          );
          featureTypes.push('vars');
        }
      }

      // Load all enabled features in parallel
      await Promise.all(promises);

      // Record initial load timestamp
      this.lastRefreshedAt = new Date();
      this.invalidationCount++;

      this.logger.info('SDK cache initialized', {
        enabledFeatures: featureTypes,
        environments: false
          ? `* (${this.getEnvironmentIds().length} envs)`
          : null,
      });

      // Initialize maintenance watcher with current state (no events emitted on first check)
      if (
        this.uses.serviceMaintenance !== false ||
        this.uses.gameWorld !== false
      ) {
        this.checkMaintenanceStateChanges();
      }

      // Setup auto-refresh if using polling method
      if (this.config.refreshMethod === 'polling' && this.config.ttl) {
        this.startAutoRefresh();
      }

      // Subscribe to token changes (e.g., environment added/removed)
      if (this.environmentProvider.onEnvironmentsChanged) {
        this.environmentProvider.onEnvironmentsChanged((added, removed) => {
          this.logger.info('Environment list changed', {
            added: added.length,
            removed: removed.length,
          });

          // Remove cache for removed environments
          if (removed.length > 0) {
            this.clearDataForEnvironments(removed.map((e) => e.environmentId));
          }

          // Register new environments and fetch data
          if (added.length > 0) {
            for (const entry of added) {
              this.apiClientFactory.registerEnvironment(
                entry.environmentId,
                entry.token
              );
            }

            // Fetch environment-scoped data
            this.fetchDataForEnvironments(
              added.map((e) => e.environmentId)
            ).catch((error: any) => {
              this.logger.error('Failed to fetch data for new environments', {
                error: error.message,
              });
            });

            // Fetch project-scoped data
            this.fetchDataForProjects().catch((error: any) => {
              this.logger.error('Failed to fetch project-scoped data', {
                error: error.message,
              });
            });
          }
        });
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
        const response = await this.apiClient.get<{
          status: string;
          environmentId?: string;
          orgId?: string;
          projectId?: string;
        }>('/api/v1/ready');

        if (response.success && response.data?.status === 'ready') {
          this.logger.info('Gatrix backend is ready');

          // Extract environmentId, orgId, projectId from token-based lookup (single-env mode)
          if (response.data.environmentId) {
            this.resolvedEnvironmentId = response.data.environmentId;
            this.logger.info('Environment resolved from backend', {
              environmentId: this.resolvedEnvironmentId,
            });
          }
          if (response.data.orgId) {
            this.resolvedOrgId = response.data.orgId;
          }
          if (response.data.projectId) {
            this.resolvedProjectId = response.data.projectId;
          }
          return;
        }
      } catch (_error: any) {
        // Silently continue on connection errors during startup
      }

      if (attempt === maxAttempts) {
        this.logger.error(
          'Gatrix backend is not ready after maximum attempts',
          {
            attempts: maxAttempts,
            totalTime: `${(maxAttempts * retryInterval) / 1000}s`,
          }
        );
        throw new Error(
          'Gatrix backend failed to become ready within timeout period'
        );
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
   * Clear cached data for removed environments (ALL services)
   */
  private clearDataForEnvironments(environmentIds: string[]): void {
    this.logger.info('Clearing data for removed environments', {
      environmentIds,
    });

    for (const env of environmentIds) {
      // All services use optional chaining since they are controlled by feature flags
      this.gameWorldService?.clearCacheForEnvironment(env);
      this.popupNoticeService?.clearCacheForEnvironment(env);
      this.surveyService?.clearCacheForEnvironment(env);
      this.whitelistService?.clearCacheForEnvironment(env);
      this.serviceMaintenanceService?.clearCacheForEnvironment(env);
      // clientVersion is project-scoped — not affected by environment changes
      this.serviceNoticeService?.clearCacheForEnvironment(env);
      this.bannerService?.clearCacheForEnvironment(env);
      this.storeProductService?.clearCacheForEnvironment(env);
      this.varsService?.clearCacheForEnvironment(env);
    }
  }

  /**
   * Fetch data for newly added tokens (environments)
   */
  private async fetchDataForEnvironments(
    environmentIds: string[]
  ): Promise<void> {
    this.logger.info('Fetching data for new environments', {
      count: environmentIds.length,
    });

    for (const envId of environmentIds) {
      const promises: Promise<any>[] = [];

      if (this.gameWorldService)
        promises.push(
          this.gameWorldService.listByEnvironment(envId).catch(() => [])
        );
      if (this.popupNoticeService)
        promises.push(
          this.popupNoticeService.listByEnvironment(envId).catch(() => [])
        );
      if (this.surveyService)
        promises.push(
          this.surveyService.listByEnvironment(undefined, envId).catch(() => [])
        );
      if (this.whitelistService)
        promises.push(
          this.whitelistService.listByEnvironment(envId).catch(() => [])
        );
      if (this.serviceMaintenanceService)
        promises.push(
          this.serviceMaintenanceService
            .getStatusByEnvironment(envId)
            .catch(() => null)
        );
      // clientVersion is project-scoped — not fetched per environment
      if (this.serviceNoticeService)
        promises.push(
          this.serviceNoticeService.listByEnvironment(envId).catch(() => [])
        );
      if (this.bannerService)
        promises.push(
          this.bannerService.listByEnvironment(envId).catch(() => [])
        );
      if (this.storeProductService)
        promises.push(
          this.storeProductService.listByEnvironment(envId).catch(() => [])
        );
      if (this.featureFlagService)
        promises.push(
          this.featureFlagService.listByEnvironment(envId).catch(() => [])
        );
      if (this.varsService)
        promises.push(
          this.varsService.listByEnvironment(envId).catch(() => [])
        );

      await Promise.all(promises);
    }

    this.lastRefreshedAt = new Date();
    this.invalidationCount++;
    this.logger.info('Data fetched for new environments', {
      count: environmentIds.length,
    });
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

      // Get target environments for multi-environment mode
      const envList = this.getEnvironmentIds();
      const isMultiEnv = this.multiMode;

      // In multi-environment mode, if envList is empty, we should skip refresh
      // rather than falling back to default environment
      if (isMultiEnv && envList.length === 0) {
        this.logger.warn(
          'Multi-environment mode enabled but no environments available. Skipping refresh.',
          {
            mode: false ? 'wildcard' : 'explicit',
            configuredEnvironments: null,
          }
        );
      }

      // All services use optional chaining since they are controlled by feature flags
      // In multi-environment mode, use listByEnvironments for environment-specific features
      if (this.uses.gameWorld !== false && this.gameWorldService) {
        if (isMultiEnv) {
          if (envList.length > 0) {
            promises.push(
              this.gameWorldService
                .listByEnvironments(envList)
                .catch((error) => {
                  this.logger.warn('Failed to refresh game worlds', {
                    error: error.message,
                  });
                  return [];
                })
            );
            refreshedTypes.push('gameWorld');
          }
        } else {
          const defaultEnv = this.defaultEnvironmentId;
          promises.push(
            this.gameWorldService.refreshByEnvironment(true, defaultEnv)
          ); // suppressWarnings=true for refreshAll
          refreshedTypes.push('gameWorld');
        }
      }

      if (this.uses.popupNotice !== false && this.popupNoticeService) {
        if (isMultiEnv) {
          if (envList.length > 0) {
            promises.push(
              this.popupNoticeService
                .listByEnvironments(envList)
                .catch((error) => {
                  this.logger.warn('Failed to refresh popup notices', {
                    error: error.message,
                  });
                  return [];
                })
            );
            refreshedTypes.push('popupNotice');
          }
        } else {
          const defaultEnv = this.defaultEnvironmentId;
          promises.push(
            this.popupNoticeService.refreshByEnvironment(true, defaultEnv)
          ); // suppressWarnings=true for refreshAll
          refreshedTypes.push('popupNotice');
        }
      }

      if (this.uses.survey !== false && this.surveyService) {
        if (isMultiEnv) {
          if (envList.length > 0) {
            promises.push(
              this.surveyService
                .listByEnvironments(envList, { isActive: true })
                .catch((error) => {
                  this.logger.warn('Failed to refresh surveys', {
                    error: error.message,
                  });
                  return { surveys: [], settings: null };
                })
            );
            refreshedTypes.push('survey');
          }
        } else {
          const defaultEnv = this.defaultEnvironmentId;
          promises.push(
            this.surveyService
              .refreshByEnvironment({ isActive: true }, true, defaultEnv)
              .catch((error) => {
                // suppressWarnings=true for refreshAll
                this.logger.warn('Failed to refresh surveys', {
                  error: error.message,
                });
              })
          );
          refreshedTypes.push('survey');
        }
      }

      if (this.uses.whitelist !== false && this.whitelistService) {
        if (isMultiEnv) {
          if (envList.length > 0) {
            promises.push(
              this.whitelistService
                .listByEnvironments(envList)
                .catch((error) => {
                  this.logger.warn('Failed to refresh whitelists', {
                    error: error.message,
                  });
                  return [];
                })
            );
            refreshedTypes.push('whitelist');
          }
        } else {
          const defaultEnv = this.defaultEnvironmentId;
          promises.push(
            this.whitelistService
              .refreshByEnvironment(true, defaultEnv)
              .catch((error) => {
                // suppressWarnings=true for refreshAll
                this.logger.warn('Failed to refresh whitelists', {
                  error: error.message,
                });
              })
          );
          refreshedTypes.push('whitelist');
        }
      }

      if (
        this.uses.serviceMaintenance !== false &&
        this.serviceMaintenanceService
      ) {
        if (isMultiEnv) {
          if (envList.length > 0) {
            promises.push(
              this.serviceMaintenanceService
                .getStatusByEnvironments(envList)
                .catch((error) => {
                  this.logger.warn('Failed to refresh service maintenance', {
                    error: error.message,
                  });
                  return [];
                })
            );
            refreshedTypes.push('serviceMaintenance');
          }
        } else {
          const defaultEnv = this.defaultEnvironmentId;
          promises.push(
            this.refreshServiceMaintenanceInternal(defaultEnv).catch(
              (error) => {
                this.logger.warn('Failed to refresh service maintenance', {
                  error: error.message,
                });
              }
            )
          );
          refreshedTypes.push('serviceMaintenance');
        }
      }

      // Project-scoped features: refresh per project
      if (this.uses.clientVersion === true && this.clientVersionService) {
        if (this.multiMode) {
          promises.push(this.fetchDataForProjects());
          refreshedTypes.push('clientVersion');
        } else {
          promises.push(
            this.clientVersionService
              .refreshByProject(true)
              .catch((error) => {
                this.logger.warn('Failed to refresh client versions', {
                  error: error.message,
                });
              })
          );
          refreshedTypes.push('clientVersion');
        }
      }

      if (this.uses.serviceNotice === true && this.serviceNoticeService) {
        if (envList.length > 0) {
          promises.push(
            this.serviceNoticeService
              .listByEnvironments(envList)
              .catch((error) => {
                this.logger.warn('Failed to refresh service notices', {
                  error: error.message,
                });
              })
          );
          refreshedTypes.push('serviceNotice');
        }
      }

      if (this.uses.banner === true && this.bannerService) {
        if (envList.length > 0) {
          promises.push(
            this.bannerService.listByEnvironments(envList).catch((error) => {
              this.logger.warn('Failed to refresh banners', {
                error: error.message,
              });
            })
          );
          refreshedTypes.push('banner');
        }
      }

      if (this.uses.storeProduct === true && this.storeProductService) {
        if (isMultiEnv) {
          if (envList.length > 0) {
            promises.push(
              this.storeProductService
                .listByEnvironments(envList)
                .catch((error) => {
                  this.logger.warn('Failed to refresh store products', {
                    error: error.message,
                  });
                })
            );
            refreshedTypes.push('storeProduct');
          }
        } else {
          const defaultEnv = this.defaultEnvironmentId;
          promises.push(
            this.storeProductService
              .refreshByEnvironment(true, defaultEnv)
              .catch((error) => {
                this.logger.warn('Failed to refresh store products', {
                  error: error.message,
                });
              })
          );
          refreshedTypes.push('storeProduct');
        }
      }

      // Feature flags - requires explicit opt-in
      if (this.uses.featureFlag === true && this.featureFlagService) {
        if (isMultiEnv) {
          if (envList.length > 0) {
            promises.push(
              this.featureFlagService
                .listByEnvironments(envList)
                .catch((error) => {
                  this.logger.warn('Failed to refresh feature flags', {
                    error: error.message,
                  });
                })
            );
            refreshedTypes.push('featureFlag');
          }
        } else {
          const defaultEnv = this.defaultEnvironmentId;
          promises.push(
            this.featureFlagService
              .refreshByEnvironment(undefined, defaultEnv)
              .catch((error) => {
                this.logger.warn('Failed to refresh feature flags', {
                  error: error.message,
                });
              })
          );
          refreshedTypes.push('featureFlag');
        }
      }

      // Vars (KV) - requires explicit opt-in
      if (this.uses.vars === true && this.varsService) {
        if (isMultiEnv) {
          if (envList.length > 0) {
            promises.push(
              this.varsService.listByEnvironments(envList).catch((error) => {
                this.logger.warn('Failed to refresh vars', {
                  error: error.message,
                });
              })
            );
            refreshedTypes.push('vars');
          }
        } else {
          const defaultEnv = this.defaultEnvironmentId;
          promises.push(
            this.varsService
              .refreshByEnvironment(undefined, defaultEnv)
              .catch((error) => {
                this.logger.warn('Failed to refresh vars', {
                  error: error.message,
                });
              })
          );
          refreshedTypes.push('vars');
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
      } catch (_) {}

      this.logger.info('All caches refreshed successfully', {
        types: refreshedTypes,
      });
      this.lastRefreshedAt = new Date();
      this.invalidationCount++;

      // Check and emit maintenance state changes
      if (
        this.uses.serviceMaintenance !== false ||
        this.uses.gameWorld !== false
      ) {
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
      try {
        this.metrics?.incError('cache', 'refreshAll');
      } catch (_) {}
      throw error;
    }
  }

  /**
   * Refresh game worlds cache
   * Also checks and emits maintenance state change events
   * @param environmentId environment ID (required)
   */
  async refreshGameWorlds(environmentId: string): Promise<void> {
    if (!this.gameWorldService) return;
    const start = process.hrtime.bigint();
    await this.gameWorldService.refreshByEnvironment(undefined, environmentId);
    try {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics?.incRefresh('gameworlds');
      this.metrics?.observeRefresh('gameworlds', duration);
      this.metrics?.setLastRefresh('gameworlds');
    } catch (_) {}
    // Check maintenance state changes after refresh
    this.checkMaintenanceStateChanges();
  }

  /**
   * Refresh popup notices cache
   * @param environmentId environment ID (required)
   */
  async refreshPopupNotices(environmentId: string): Promise<void> {
    if (!this.popupNoticeService) return;
    const start = process.hrtime.bigint();
    await this.popupNoticeService.refreshByEnvironment(
      undefined,
      environmentId
    );
    try {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics?.incRefresh('popups');
      this.metrics?.observeRefresh('popups', duration);
      this.metrics?.setLastRefresh('popups');
    } catch (_) {}
  }

  /**
   * Refresh surveys cache
   * @param environmentId environment ID (required)
   */
  async refreshSurveys(environmentId: string): Promise<void> {
    if (!this.surveyService) return;
    const start = process.hrtime.bigint();
    await this.surveyService.refreshByEnvironment(
      { isActive: true },
      undefined,
      environmentId
    );
    try {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics?.incRefresh('surveys');
      this.metrics?.observeRefresh('surveys', duration);
      this.metrics?.setLastRefresh('surveys');
    } catch (_) {}
  }

  /**
   * Refresh survey settings only
   * @param environmentId environment ID (required)
   */
  async refreshSurveySettings(environmentId: string): Promise<void> {
    await this.surveyService?.refreshSettings(environmentId);
  }

  /**
   * Update a single game world in cache (immutable)
   * Also checks and emits maintenance state change events
   * @param id Game world ID
   * @param environmentId environment ID (required)
   * @param isVisible Optional visibility flag
   */
  async updateSingleGameWorld(
    id: string,
    isVisible?: boolean | number,
    environmentId?: string
  ): Promise<void> {
    await this.gameWorldService?.updateSingleWorld(
      id,
      isVisible,
      environmentId
    );
    // Check maintenance state changes after update
    this.checkMaintenanceStateChanges();
  }

  /**
   * Get all cached data (game worlds, popup notices, surveys)
   */
  getAllCachedData(): any {
    // Convert Map to plain object for JSON serialization
    const mapToObject = <T>(
      map: Map<string, T[]> | undefined
    ): Record<string, T[]> => {
      if (!map) return {};
      const obj: Record<string, T[]> = {};
      for (const [key, value] of map.entries()) {
        obj[key] = value;
      }
      return obj;
    };

    // Helper to convert Map<string, T> (non-array values like WhitelistData, MaintenanceStatus)
    const mapToObjectSingle = <T>(
      map: Map<string, T> | undefined
    ): Record<string, T> => {
      if (!map) return {};
      const obj: Record<string, T> = {};
      for (const [key, value] of map.entries()) {
        obj[key] = value;
      }
      return obj;
    };

    // Helper to convert Map<string, Map<string, T>> (nested maps like featureFlags)
    const nestedMapToObject = <T>(
      map: Map<string, Map<string, T>> | undefined
    ): Record<string, T[]> => {
      if (!map) return {};
      const obj: Record<string, T[]> = {};
      for (const [key, innerMap] of map.entries()) {
        obj[key] = Array.from(innerMap.values());
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
      serviceMaintenance: mapToObjectSingle(
        this.serviceMaintenanceService?.getAllCached()
      ),
      clientVersions: mapToObject(this.clientVersionService?.getAllCached()),
      serviceNotices: mapToObject(this.serviceNoticeService?.getAllCached()),
      banners: mapToObject(this.bannerService?.getAllCached()),
      storeProducts: mapToObject(this.storeProductService?.getAllCached()),
      featureFlags: nestedMapToObject(this.featureFlagService?.getAllCached()),
      vars: mapToObject(this.varsService?.getAllCached()),
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
   * @param environmentId environment ID (required)
   */
  getGameWorlds(environmentId: string): any[] {
    return this.gameWorldService?.getCached(environmentId) || [];
  }

  /**
   * Remove a game world from cache (immutable)
   * @param id Game world ID
   * @param environmentId environment ID (required)
   */
  removeGameWorld(id: string, environmentId: string): void {
    this.gameWorldService?.removeFromCache(id, environmentId);
  }

  /**
   * Update a single popup notice in cache (immutable)
   * @param id Popup notice ID
   * @param environmentId environment ID (required)
   * @param isVisible Optional visibility status
   */
  async updateSinglePopupNotice(
    id: string,
    isVisible?: boolean | number,
    environmentId?: string
  ): Promise<void> {
    await this.popupNoticeService?.updateSingleNotice(
      id,
      isVisible,
      environmentId
    );
  }

  /**
   * Remove a popup notice from cache (immutable)
   * @param id Popup notice ID
   * @param environmentId environment ID (required)
   */
  removePopupNotice(id: string, environmentId: string): void {
    this.popupNoticeService?.removeFromCache(id, environmentId);
  }

  /**
   * Update a single survey in cache (immutable)
   * @param id Survey ID
   * @param environmentId environment ID (required)
   * @param isActive Optional active status
   */
  async updateSingleSurvey(
    id: string,
    isActive?: boolean | number,
    environmentId?: string
  ): Promise<void> {
    await this.surveyService?.updateSingleSurvey(id, isActive, environmentId);
  }

  /**
   * Remove a survey from cache (immutable)
   * @param id Survey ID
   * @param environmentId environment ID (required)
   */
  removeSurvey(id: string, environmentId: string): void {
    this.surveyService?.removeSurvey(id, environmentId);
  }

  /**
   * Refresh whitelist cache only
   * @param environmentId environment ID (required)
   */
  async refreshWhitelists(environmentId: string): Promise<void> {
    if (!this.whitelistService) return;
    this.logger.info('Refreshing whitelist cache...');
    const start = process.hrtime.bigint();
    await this.whitelistService.refreshByEnvironment(undefined, environmentId);
    try {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics?.incRefresh('whitelists');
      this.metrics?.observeRefresh('whitelists', duration);
      this.metrics?.setLastRefresh('whitelists');
    } catch (_) {}
  }

  /**
   * Get cached whitelists
   * @param environmentId environment ID (required)
   */
  getWhitelists(environmentId: string) {
    return this.whitelistService?.getCached(environmentId);
  }

  /**
   * Internal service maintenance refresh (without maintenance state check)
   * Used by refreshAll() to avoid duplicate state checks
   * @param environmentId environment ID (required)
   */
  private async refreshServiceMaintenanceInternal(
    environmentId: string
  ): Promise<void> {
    if (!this.serviceMaintenanceService) return;
    this.logger.info('Refreshing service maintenance cache...');
    const start = process.hrtime.bigint();
    try {
      const status = await this.serviceMaintenanceService.refreshByEnvironment(
        true,
        environmentId
      ); // suppressWarnings=true for refreshAll
      this.emitRefreshEvent('serviceMaintenance', status);
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      try {
        this.metrics?.incRefresh('serviceMaintenance');
        this.metrics?.observeRefresh('serviceMaintenance', duration);
        this.metrics?.setLastRefresh('serviceMaintenance');
      } catch (_) {}
    } catch (error: any) {
      this.logger.warn('Failed to refresh service maintenance status', {
        error: error.message,
      });
    }
  }

  /**
   * Refresh service maintenance status
   * Also checks and emits maintenance state change events
   * @param environmentId environment ID (required)
   */
  async refreshServiceMaintenance(environmentId: string): Promise<void> {
    await this.refreshServiceMaintenanceInternal(environmentId);
    // Check maintenance state changes after refresh
    this.checkMaintenanceStateChanges(environmentId);
  }

  /**
   * Check and emit maintenance state change events
   * Compares current state with previous state and emits events if changed
   * @param environmentId Optional environment ID. If not provided, checks all cached environments.
   */
  private checkMaintenanceStateChanges(environmentId?: string): void {
    try {
      if (environmentId) {
        // Check specific environment
        const serviceStatus =
          this.serviceMaintenanceService?.getCached(environmentId) || null;
        const gameWorlds =
          this.gameWorldService?.getCached(environmentId) || [];
        this.maintenanceWatcher.checkAndEmitChanges(serviceStatus, gameWorlds);
      } else {
        // Check all cached environments (for multi-env mode or when environment is not specified)
        const allGameWorlds =
          this.gameWorldService?.getAllCached() || new Map();
        const allServiceStatus =
          this.serviceMaintenanceService?.getAllCached() || new Map();

        // Collect all environments from both services
        const allEnvs = new Set([
          ...allGameWorlds.keys(),
          ...allServiceStatus.keys(),
        ]);

        for (const env of allEnvs) {
          const serviceStatus = allServiceStatus.get(env) || null;
          const gameWorlds = allGameWorlds.get(env) || [];
          this.maintenanceWatcher.checkAndEmitChanges(
            serviceStatus,
            gameWorlds
          );
        }
      }
    } catch (error: any) {
      this.logger.error('Error checking maintenance state changes', {
        error: error.message,
      });
    }
  }

  /**
   * Get cached service maintenance status
   * @param environmentId environment ID (required)
   */
  getServiceMaintenanceStatus(environmentId: string): MaintenanceStatus | null {
    return this.serviceMaintenanceService?.getCached(environmentId) || null;
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
   * @param projectId project ID (required, client versions are project-scoped)
   */
  getClientVersions(projectId: string): ClientVersion[] {
    return this.clientVersionService?.getCached(projectId) || [];
  }

  /**
   * Update a single client version in cache (immutable)
   * @param item Client version to update
   * @param projectId project ID (required, client versions are project-scoped)
   */
  async updateSingleClientVersion(
    item: any,
    projectId: string
  ): Promise<void> {
    this.clientVersionService?.updateSingleClientVersion(item, projectId);
  }

  /**
   * Get cached service notices
   * @param environmentId environment ID (required)
   */
  getServiceNotices(environmentId: string): ServiceNotice[] {
    return this.serviceNoticeService?.getCached(environmentId) || [];
  }

  /**
   * Update a single service notice in cache (immutable)
   * @param notice Service notice to update
   * @param environmentId environment ID (required)
   */
  async updateSingleServiceNotice(
    notice: any,
    environmentId: string
  ): Promise<void> {
    this.serviceNoticeService?.updateSingleServiceNotice(notice, environmentId);
  }

  /**
   * Get cached banners
   * @param environmentId environment ID (required)
   */
  getBanners(environmentId: string): Banner[] {
    return this.bannerService?.getCached(environmentId) || [];
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
   * @param environmentId environment ID (required)
   */
  getStoreProducts(environmentId: string): StoreProduct[] {
    return this.storeProductService?.getCached(environmentId) || [];
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
   * Get VarsService instance
   */
  getVarsService(): VarsService | undefined {
    return this.varsService;
  }

  /**
   * Get cached vars
   * @param environmentId environment ID (required)
   */
  getVars(environmentId: string): any[] {
    return this.varsService?.getCached(environmentId) || [];
  }

  /**
   * Update a single store product in cache (immutable)
   * @param id Store product ID
   * @param environmentId environment ID (required)
   * @param isActive Optional active status
   */
  async updateSingleStoreProduct(
    id: string,
    isActive?: boolean | number,
    environmentId?: string
  ): Promise<void> {
    await this.storeProductService?.updateSingleProduct(
      id,
      isActive,
      environmentId
    );
  }

  /**
   * Remove a store product from cache (immutable)
   * @param id Store product ID
   * @param environmentId environment ID (required)
   */
  removeStoreProduct(id: string, environmentId: string): void {
    this.storeProductService?.removeFromCache(id, environmentId);
  }

  /**
   * Refresh store products cache for an environment
   * @param environmentId environment ID (required)
   */
  async refreshStoreProducts(environmentId: string): Promise<void> {
    await this.storeProductService?.refreshByEnvironment(
      undefined,
      environmentId
    );
  }

  /**
   * Update a single banner in cache (immutable)
   * @param bannerId Banner ID
   * @param environmentId environment ID (required)
   * @param status Optional status
   */
  async updateSingleBanner(
    bannerId: string,
    status?: string,
    environmentId?: string
  ): Promise<void> {
    await this.bannerService?.updateSingleBanner(
      bannerId,
      status,
      environmentId
    );
  }

  /**
   * Remove a banner from cache (immutable)
   * @param bannerId Banner ID
   * @param environmentId environment ID (required)
   */
  removeBanner(bannerId: string, environmentId: string): void {
    this.bannerService?.removeFromCache(bannerId, environmentId);
  }

  /**
   * Get features configuration
   */
  /**
   * Check if SDK is in multi-environment mode (tokenProvider was explicitly provided)
   */
  isMultiMode(): boolean {
    return this.multiMode;
  }

  /**
   * Get the list of environment IDs that are currently cached.
   * Available after initialize() has been called.
   */
  getKnownEnvironmentIds(): string[] {
    const envIds = new Set<string>();
    // Collect environment IDs from all active services
    const addEnvIds = (ids: string[]) => ids.forEach((id) => envIds.add(id));
    if (this.gameWorldService)
      addEnvIds(this.gameWorldService.getEnvironmentIds());
    if (this.popupNoticeService)
      addEnvIds(this.popupNoticeService.getEnvironmentIds());
    // clientVersion is project-scoped — not included in environment ID collection
    if (this.bannerService) addEnvIds(this.bannerService.getEnvironmentIds());
    if (this.storeProductService)
      addEnvIds(this.storeProductService.getEnvironmentIds());
    if (this.varsService) addEnvIds(this.varsService.getEnvironmentIds());
    // Include environment resolved from /ready endpoint (single-token mode)
    if (this.resolvedEnvironmentId) envIds.add(this.resolvedEnvironmentId);
    return Array.from(envIds);
  }

  /**
   * Get channel context resolved from /ready endpoint.
   * Used by EventListener for single-env channel subscription.
   */
  getChannelContext(): {
    orgId?: string;
    projectId?: string;
    environmentId?: string;
  } {
    return {
      orgId: this.resolvedOrgId || undefined,
      projectId: this.resolvedProjectId || undefined,
      environmentId: this.resolvedEnvironmentId || undefined,
    };
  }

  /**
   * Resolve an environment ID for cache lookup.
   * Previously mapped raw environmentIds to token strings used as cache keys.
   * Since the cache now uses environmentId as keys directly, this is an identity function.
   * Kept for backward compatibility with EventListener.
   *
   * @returns The environmentId as-is (no longer needs token resolution)
   */
  resolveTokenForEnvironmentId(environmentId: string): string {
    return environmentId;
  }

  /**
   * Build a projectId → representative environmentId mapping.
   * Groups environments by project so project-scoped services can fetch once per project.
   * Uses the first environment of each project as the representative for API calls.
   */
  private getProjectEnvironmentMap(): Map<string, string> {
    const projectEnvMap = new Map<string, string>();
    const entries = this.environmentProvider.getEnvironmentTokens();

    for (const entry of entries) {
      if (entry.projectId && !projectEnvMap.has(entry.projectId)) {
        projectEnvMap.set(entry.projectId, entry.environmentId);
      }
    }

    if (projectEnvMap.size === 0 && entries.length > 0) {
      this.logger.warn(
        'No projectId found in environment entries. Project-scoped services will not load data.',
        {
          envCount: entries.length,
          sampleKeys: Object.keys(entries[0] || {}),
        }
      );
    }

    return projectEnvMap;
  }

  /**
   * Fetch all project-scoped data.
   * Builds project list from environment entries and fetches data once per project.
   */
  private async fetchDataForProjects(): Promise<void> {
    const projectEnvMap = this.getProjectEnvironmentMap();
    if (projectEnvMap.size === 0) return;
    await this.fetchClientVersionsByProjects(projectEnvMap);
  }

  /**
   * Fetch client versions for each project using the project's representative environment.
   * Each project is fetched exactly once — no duplicate calls for environments in the same project.
   */
  private async fetchClientVersionsByProjects(
    projectEnvMap: Map<string, string>
  ): Promise<void> {
    if (!this.clientVersionService) return;

    for (const [projectId, envId] of projectEnvMap) {
      try {
        await this.clientVersionService.listByProject(projectId, envId);
      } catch (error: any) {
        this.logger.warn('Failed to load client versions for project', {
          projectId,
          error: error.message,
        });
      }
    }
  }

  /**
   * Get a representative environmentId for a given projectId.
   * Used by event handlers to get the correct API client for refresh in multi-tenant mode.
   * Returns undefined in single-env mode or if the project is not found.
   */
  getEnvironmentIdForProject(projectId: string): string | undefined {
    if (!this.multiMode) return undefined;
    const projectEnvMap = this.getProjectEnvironmentMap();
    return projectEnvMap.get(projectId);
  }

  getUses(): UsesConfig {
    return this.uses;
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
    this.varsService?.clearCache();
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
