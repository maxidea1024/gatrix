/**
 * Service Maintenance Service
 * Handles global service maintenance status retrieval and caching
 * Uses per-environment API pattern: GET /api/v1/server/:env/maintenance
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { MaintenanceStatus } from '../types/api';

export class ServiceMaintenanceService {
  private apiClient: ApiClient;
  private logger: Logger;
  // Default environment for single-environment mode
  private defaultEnvironment: string;
  // Multi-environment cache: Map<environment (environmentName), MaintenanceStatus>
  private cachedStatusByEnv: Map<string, MaintenanceStatus> = new Map();

  constructor(apiClient: ApiClient, logger: Logger, defaultEnvironment: string = 'development') {
    this.apiClient = apiClient;
    this.logger = logger;
    this.defaultEnvironment = defaultEnvironment;
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
    this.logger.debug('Fetching service maintenance status for multiple environments', { environments });

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
   * Fetch service maintenance status (uses default environment)
   * For backward compatibility
   */
  async getStatus(): Promise<MaintenanceStatus> {
    return this.getStatusByEnvironment(this.defaultEnvironment);
  }

  /**
   * Refresh service maintenance cache for a specific environment
   */
  async refreshByEnvironment(environment: string): Promise<MaintenanceStatus> {
    return await this.getStatusByEnvironment(environment);
  }

  /**
   * Refresh service maintenance cache (uses default environment)
   * For backward compatibility
   */
  async refresh(): Promise<MaintenanceStatus> {
    return this.refreshByEnvironment(this.defaultEnvironment);
  }

  /**
   * Get cached service maintenance status
   * @param environment Environment name. If omitted, returns default environment status.
   */
  getCached(environment?: string): MaintenanceStatus | null {
    const envKey = environment || this.defaultEnvironment;
    return this.cachedStatusByEnv.get(envKey) || null;
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
   * Update cached service maintenance status
   * Used by cache manager or event listener when maintenance changes
   */
  updateCache(status: MaintenanceStatus | null, environment?: string): void {
    const envKey = environment || this.defaultEnvironment;
    if (status) {
      this.cachedStatusByEnv.set(envKey, status);
    } else {
      this.cachedStatusByEnv.delete(envKey);
    }
  }

  /**
   * Check if service is currently in maintenance based on flag and time window
   */
  isMaintenanceActive(environment?: string): boolean {
    const cachedStatus = this.getCached(environment);
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
   */
  getMessage(lang: 'ko' | 'en' | 'zh' = 'en', environment?: string): string | null {
    const cachedStatus = this.getCached(environment);
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
}

