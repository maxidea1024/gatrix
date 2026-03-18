/**
 * Service Maintenance Service
 * Handles global service maintenance status retrieval and caching
 * Uses per-environment API pattern: GET /api/v1/server/maintenance
 *
 * DESIGN PRINCIPLES:
 * - All methods that access cached data MUST receive environment explicitly in multi-env mode
 * - Environment resolution is delegated to string
 * - In multi-environment mode (edge), environment MUST always be provided
 */

import { ApiClient } from '../client/api-client';
import { ApiClientFactory } from '../client/api-client-factory';
import { Logger } from '../utils/logger';
import { CacheStorageProvider } from '../cache/storage-provider';
import { MaintenanceStatus } from '../types/api';

export class ServiceMaintenanceService {
  private apiClient: ApiClient;
  private logger: Logger;
  private defaultEnvironmentId: string;
  private storage?: CacheStorageProvider;
  // Multi-environment cache: Map<environmentId, MaintenanceStatus>
  private cachedStatusByEnv: Map<string, MaintenanceStatus> = new Map();
  // Whether this feature is enabled
  private featureEnabled: boolean = true;
  // Optional factory for multi-environment mode
  private apiClientFactory?: ApiClientFactory;

  constructor(
    apiClient: ApiClient,
    logger: Logger,
    defaultEnvironmentId: string,
    storage?: CacheStorageProvider
  ) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.defaultEnvironmentId = defaultEnvironmentId;
    this.storage = storage;
  }

  /**
   * Initialize service and load data from local storage
   */
  async initializeAsync(environmentId?: string): Promise<void> {
    if (!this.storage) return;
    const resolvedEnv = environmentId || this.defaultEnvironmentId;

    try {
      const cachedJson = await this.storage.get(
        `ServiceMaintenance_${resolvedEnv}`
      );
      if (cachedJson) {
        this.cachedStatusByEnv.set(resolvedEnv, JSON.parse(cachedJson));
        this.logger.debug(
          'Loaded service maintenance status from local storage',
          {
            environmentId: resolvedEnv,
          }
        );
      }
    } catch (error: any) {
      this.logger.warn(
        'Failed to load service maintenance status from local storage',
        {
          environmentId: resolvedEnv,
          error: error.message,
        }
      );
    }
  }

  /**
   * Set feature enabled flag
   * When false, refresh methods will log a warning
   */
  setFeatureEnabled(enabled: boolean): void {
    this.featureEnabled = enabled;
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(): boolean {
    return this.featureEnabled;
  }

  /**
   * Set ApiClientFactory for multi-environment mode.
   * When set, API calls use the factory to get a per-environment ApiClient.
   */
  setApiClientFactory(factory: ApiClientFactory): void {
    this.apiClientFactory = factory;
  }

  /**
   * Get the appropriate ApiClient for a given environment.
   * Uses the factory if available, otherwise falls back to the default client.
   */
  private getApiClient(environmentId?: string): ApiClient {
    if (this.apiClientFactory) {
      return this.apiClientFactory.getClient(environmentId);
    }
    return this.apiClient;
  }

  /**
   * Fetch service maintenance status for a specific environment
   * GET /api/v1/server/maintenance
   */
  async getStatusByEnvironment(
    environmentId: string
  ): Promise<MaintenanceStatus> {
    const endpoint = `/api/v1/server/maintenance`;

    this.logger.debug('Fetching service maintenance status', { environmentId });

    const client = this.getApiClient(environmentId);
    const response = await client.get<MaintenanceStatus>(endpoint);

    if (!response.success || !response.data) {
      throw new Error(
        response.error?.message || 'Failed to fetch service maintenance status'
      );
    }

    // Ensure isMaintenanceActive has a boolean value (for backward compatibility with older backend)
    const status: MaintenanceStatus = {
      ...response.data,
      isMaintenanceActive: response.data.isMaintenanceActive ?? false,
    };

    this.cachedStatusByEnv.set(environmentId, status);

    // Save to local storage if available
    if (this.storage) {
      await this.storage.save(
        `ServiceMaintenance_${environmentId}`,
        JSON.stringify(status)
      );
    }

    this.logger.info('Service maintenance status fetched', {
      environmentId,
      hasMaintenanceScheduled: status.hasMaintenanceScheduled,
      isMaintenanceActive: status.isMaintenanceActive,
    });

    return status;
  }

  /**
   * Fetch service maintenance status for multiple environments
   */
  async getStatusByEnvironments(
    environmentIds: string[]
  ): Promise<MaintenanceStatus[]> {
    this.logger.debug(
      'Fetching service maintenance status for multiple environments',
      {
        environmentIds,
      }
    );

    const results: MaintenanceStatus[] = [];

    for (const env of environmentIds) {
      try {
        const status = await this.getStatusByEnvironment(env);
        results.push(status);
      } catch (error) {
        this.logger.error(
          `Failed to fetch maintenance status for environment ${env}`,
          { error }
        );
      }
    }

    return results;
  }

  /**
   * Refresh service maintenance cache for a specific environment
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   * @param suppressWarnings If true, suppress feature disabled warnings (used by refreshAll)
   */
  async refreshByEnvironment(
    suppressWarnings?: boolean,
    environmentId?: string
  ): Promise<MaintenanceStatus> {
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    if (!this.featureEnabled && !suppressWarnings) {
      this.logger.warn(
        'ServiceMaintenanceService.refreshByEnvironment() called but feature is disabled',
        { environmentId: resolvedEnv }
      );
    }
    return await this.getStatusByEnvironment(resolvedEnv);
  }

  /**
   * Get cached service maintenance status
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   */
  getCached(environmentId?: string): MaintenanceStatus | null {
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    return this.cachedStatusByEnv.get(resolvedEnv) || null;
  }

  /**
   * Get all cached maintenance statuses (all environments)
   */
  getAllCached(): Map<string, MaintenanceStatus> {
    return this.cachedStatusByEnv;
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cachedStatusByEnv.clear();
    this.logger.debug('Service maintenance cache cleared');
  }

  /**
   * Clear cached data for a specific environment
   */
  clearCacheForEnvironment(environmentId?: string): void {
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    this.cachedStatusByEnv.delete(resolvedEnv);
    this.logger.debug('Service maintenance cache cleared for environment', {
      environmentId: resolvedEnv,
    });
  }

  /**
   * Update cached service maintenance status
   * Used by cache manager or event listener when maintenance changes
   * @param status Maintenance status to cache
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   */
  updateCache(status: MaintenanceStatus | null, environmentId?: string): void {
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    if (status) {
      this.cachedStatusByEnv.set(resolvedEnv, status);
    } else {
      this.cachedStatusByEnv.delete(resolvedEnv);
    }
  }

  /**
   * Check if service is currently in maintenance based on flag and time window
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   */
  isMaintenanceActive(environmentId?: string): boolean {
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    const cachedStatus = this.cachedStatusByEnv.get(resolvedEnv);
    if (!cachedStatus) {
      return false;
    }

    const { hasMaintenanceScheduled, detail } = cachedStatus;

    if (!hasMaintenanceScheduled) {
      return false;
    }

    const now = new Date();

    // Check if maintenance has not started yet
    if (detail?.startsAt) {
      const startDate = new Date(detail.startsAt);
      if (!Number.isNaN(startDate.getTime()) && now < startDate) {
        return false;
      }
    }

    // Check if maintenance has already ended
    if (detail?.endsAt) {
      const endDate = new Date(detail.endsAt);
      if (!Number.isNaN(endDate.getTime()) && now > endDate) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get localized maintenance message for the service
   * Returns null when maintenance is not active
   * @param lang Language code
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   */
  getMessage(
    lang: 'ko' | 'en' | 'zh' = 'en',
    environmentId?: string
  ): string | null {
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    const cachedStatus = this.cachedStatusByEnv.get(resolvedEnv);
    if (!this.isMaintenanceActive(resolvedEnv) || !cachedStatus?.detail) {
      return null;
    }

    const detail = cachedStatus.detail;

    // Try localized message first
    const localized = detail.localeMessages?.[lang];
    if (localized && localized.trim().length > 0) {
      return localized;
    }

    // Fallback to default message
    return detail.message || null;
  }

  /**
   * Fetch service maintenance status for multiple environments
   * (Alias for getStatusByEnvironments for consistency with BaseEnvironmentService)
   */
  async listByEnvironments(
    environmentIds: string[]
  ): Promise<MaintenanceStatus[]> {
    return this.getStatusByEnvironments(environmentIds);
  }
}
