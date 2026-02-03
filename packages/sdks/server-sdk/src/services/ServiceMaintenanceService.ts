/**
 * Service Maintenance Service
 * Handles global service maintenance status retrieval and caching
 * Uses per-environment API pattern: GET /api/v1/server/:env/maintenance
 *
 * DESIGN PRINCIPLES:
 * - All methods that access cached data MUST receive environment explicitly in multi-env mode
 * - Environment resolution is delegated to EnvironmentResolver
 * - In multi-environment mode (edge), environment MUST always be provided
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { EnvironmentResolver } from '../utils/EnvironmentResolver';
import { MaintenanceStatus } from '../types/api';

export class ServiceMaintenanceService {
  private apiClient: ApiClient;
  private logger: Logger;
  private envResolver: EnvironmentResolver;
  // Multi-environment cache: Map<environment (environmentName), MaintenanceStatus>
  private cachedStatusByEnv: Map<string, MaintenanceStatus> = new Map();
  // Whether this feature is enabled
  private featureEnabled: boolean = true;

  constructor(apiClient: ApiClient, logger: Logger, envResolver: EnvironmentResolver) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.envResolver = envResolver;
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
   * Fetch service maintenance status for a specific environment
   * GET /api/v1/server/:env/maintenance
   */
  async getStatusByEnvironment(environment: string): Promise<MaintenanceStatus> {
    const endpoint = `/api/v1/server/${encodeURIComponent(environment)}/maintenance`;

    this.logger.debug('Fetching service maintenance status', { environment });

    const response = await this.apiClient.get<MaintenanceStatus>(endpoint);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch service maintenance status');
    }

    // Ensure isMaintenanceActive has a boolean value (for backward compatibility with older backend)
    const status: MaintenanceStatus = {
      ...response.data,
      isMaintenanceActive: response.data.isMaintenanceActive ?? false,
    };

    this.cachedStatusByEnv.set(environment, status);

    this.logger.info('Service maintenance status fetched', {
      environment,
      hasMaintenanceScheduled: status.hasMaintenanceScheduled,
      isMaintenanceActive: status.isMaintenanceActive,
    });

    return status;
  }

  /**
   * Fetch service maintenance status for multiple environments
   */
  async getStatusByEnvironments(environments: string[]): Promise<MaintenanceStatus[]> {
    this.logger.debug('Fetching service maintenance status for multiple environments', {
      environments,
    });

    const results: MaintenanceStatus[] = [];

    for (const env of environments) {
      try {
        const status = await this.getStatusByEnvironment(env);
        results.push(status);
      } catch (error) {
        this.logger.error(`Failed to fetch maintenance status for environment ${env}`, { error });
      }
    }

    return results;
  }

  /**
   * Refresh service maintenance cache for a specific environment
   * @param environment Environment name
   * @param suppressWarnings If true, suppress feature disabled warnings (used by refreshAll)
   */
  async refreshByEnvironment(
    environment: string,
    suppressWarnings?: boolean
  ): Promise<MaintenanceStatus> {
    if (!this.featureEnabled && !suppressWarnings) {
      this.logger.warn(
        'ServiceMaintenanceService.refreshByEnvironment() called but feature is disabled',
        { environment }
      );
    }
    return await this.getStatusByEnvironment(environment);
  }

  /**
   * Get cached service maintenance status
   * @param environment Environment name (required)
   */
  getCached(environment: string): MaintenanceStatus | null {
    return this.cachedStatusByEnv.get(environment) || null;
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
  clearCacheForEnvironment(environment: string): void {
    this.cachedStatusByEnv.delete(environment);
    this.logger.debug('Service maintenance cache cleared for environment', {
      environment,
    });
  }

  /**
   * Update cached service maintenance status
   * Used by cache manager or event listener when maintenance changes
   * @param status Maintenance status to cache
   * @param environment Environment name (required)
   */
  updateCache(status: MaintenanceStatus | null, environment: string): void {
    if (status) {
      this.cachedStatusByEnv.set(environment, status);
    } else {
      this.cachedStatusByEnv.delete(environment);
    }
  }

  /**
   * Check if service is currently in maintenance based on flag and time window
   * @param environment Environment name (required)
   */
  isMaintenanceActive(environment: string): boolean {
    const cachedStatus = this.cachedStatusByEnv.get(environment);
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
   * @param environment Environment name (required)
   */
  getMessage(lang: 'ko' | 'en' | 'zh' = 'en', environment: string): string | null {
    const cachedStatus = this.cachedStatusByEnv.get(environment);
    if (!this.isMaintenanceActive(environment) || !cachedStatus?.detail) {
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
  async listByEnvironments(environments: string[]): Promise<MaintenanceStatus[]> {
    return this.getStatusByEnvironments(environments);
  }
}
