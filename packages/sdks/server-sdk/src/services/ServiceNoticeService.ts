/**
 * Service Notice Service
 * Handles service notice list and retrieval
 * Uses per-environment API pattern: GET /api/v1/server/:env/service-notices
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { ServiceNotice, ServiceNoticeListResponse, ServiceNoticeCategory } from '../types/api';

export interface ServiceNoticeFilters {
  isActive?: boolean;
  category?: ServiceNoticeCategory;
  platform?: string | string[];
  channel?: string | string[];
  subchannel?: string | string[];
}

export class ServiceNoticeService {
  private apiClient: ApiClient;
  private logger: Logger;
  // Default environment for single-environment mode
  private defaultEnvironment: string;
  // Multi-environment cache: Map<environment (environmentName), ServiceNotice[]>
  private cachedNoticesByEnv: Map<string, ServiceNotice[]> = new Map();

  constructor(apiClient: ApiClient, logger: Logger, defaultEnvironment: string = 'development') {
    this.apiClient = apiClient;
    this.logger = logger;
    this.defaultEnvironment = defaultEnvironment;
  }

  /**
   * Get service notices for a specific environment
   * GET /api/v1/server/:env/service-notices -> { notices: [...] }
   */
  async listByEnvironment(environment: string): Promise<ServiceNotice[]> {
    const endpoint = `/api/v1/server/${encodeURIComponent(environment)}/service-notices`;

    this.logger.debug('Fetching service notices', { environment });

    const response = await this.apiClient.get<ServiceNoticeListResponse>(endpoint);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch service notices');
    }

    const notices = response.data.notices;
    this.cachedNoticesByEnv.set(environment, notices);

    this.logger.info('Service notices fetched', {
      count: notices.length,
      environment,
    });

    return notices;
  }

  /**
   * Get service notices for multiple environments
   * Fetches each environment separately and caches results
   */
  async listByEnvironments(environments: string[]): Promise<ServiceNotice[]> {
    this.logger.debug('Fetching service notices for multiple environments', { environments });

    const results: ServiceNotice[] = [];

    for (const env of environments) {
      try {
        const notices = await this.listByEnvironment(env);
        results.push(...notices);
      } catch (error) {
        this.logger.error(`Failed to fetch service notices for environment ${env}`, { error });
      }
    }

    this.logger.info('Service notices fetched for all environments', {
      count: results.length,
      environmentCount: environments.length,
    });

    return results;
  }

  /**
   * Get all service notices (uses default environment for single-env mode)
   * For backward compatibility
   */
  async list(): Promise<ServiceNotice[]> {
    return this.listByEnvironment(this.defaultEnvironment);
  }

  /**
   * Get cached service notices
   * @param environment Environment name. If omitted, returns all notices as flat array.
   */
  getCached(environment?: string): ServiceNotice[] {
    if (environment) {
      return this.cachedNoticesByEnv.get(environment) || [];
    }
    // No environment specified: return all notices as flat array
    return Array.from(this.cachedNoticesByEnv.values()).flat();
  }

  /**
   * Get all cached service notices (all environments)
   */
  getAllCached(): Map<string, ServiceNotice[]> {
    return this.cachedNoticesByEnv;
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cachedNoticesByEnv.clear();
    this.logger.debug('Service notices cache cleared');
  }

  /**
   * Clear cached data for a specific environment
   */
  clearCacheForEnvironment(environment: string): void {
    this.cachedNoticesByEnv.delete(environment);
    this.logger.debug('Service notices cache cleared for environment', { environment });
  }

  /**
   * Refresh cached service notices for a specific environment
   */
  async refreshByEnvironment(environment: string): Promise<ServiceNotice[]> {
    this.logger.info('Refreshing service notices cache', { environment });
    // Invalidate ETag cache to force fresh data fetch
    this.apiClient.invalidateEtagCache(`/api/v1/server/${encodeURIComponent(environment)}/service-notices`);
    return await this.listByEnvironment(environment);
  }

  /**
   * Refresh cached service notices (uses default environment)
   * For backward compatibility
   */
  async refresh(): Promise<ServiceNotice[]> {
    return this.refreshByEnvironment(this.defaultEnvironment);
  }

  /**
   * Update cache with new data
   */
  updateCache(notices: ServiceNotice[], environment?: string): void {
    const envKey = environment || this.defaultEnvironment;
    this.cachedNoticesByEnv.set(envKey, notices);
    this.logger.debug('Service notices cache updated', { environment: envKey, count: notices.length });
  }

  /**
   * Get service notice by ID
   * @param environment Environment name. Only used in multi-environment mode.
   */
  getById(id: number, environment?: string): ServiceNotice | null {
    const notices = this.getCached(environment);
    return notices.find((n) => n.id === id) || null;
  }

  /**
   * Get active service notices with optional filters
   * @param environment Environment name. Only used in multi-environment mode.
   */
  getActive(environment?: string, filters?: ServiceNoticeFilters): ServiceNotice[] {
    const notices = this.getCached(environment);
    const now = new Date();

    return notices.filter((notice) => {
      // Must be active
      if (!notice.isActive) return false;

      // Check time window
      if (!this.isWithinTimeWindow(notice, now)) return false;

      // Apply filters
      if (filters) {
        if (filters.category && notice.category !== filters.category) return false;

        if (filters.platform) {
          const platforms = Array.isArray(filters.platform) ? filters.platform : [filters.platform];
          // Empty platforms array means all platforms
          if (notice.platforms.length > 0 && !platforms.some((p) => notice.platforms.includes(p))) {
            return false;
          }
        }

        if (filters.channel && notice.channels && notice.channels.length > 0) {
          const channels = Array.isArray(filters.channel) ? filters.channel : [filters.channel];
          if (!channels.some((c) => notice.channels!.includes(c))) {
            return false;
          }
        }

        if (filters.subchannel && notice.subchannels && notice.subchannels.length > 0) {
          const subchannels = Array.isArray(filters.subchannel)
            ? filters.subchannel
            : [filters.subchannel];
          if (!subchannels.some((s) => notice.subchannels!.includes(s))) {
            return false;
          }
        }
      }

      return true;
    });
  }

  /**
   * Get notices by category
   * @param environment Environment name. Only used in multi-environment mode.
   */
  getByCategory(category: ServiceNoticeCategory, environment?: string): ServiceNotice[] {
    return this.getActive(environment, { category });
  }

  /**
   * Check if notice is within its display time window
   */
  private isWithinTimeWindow(notice: ServiceNotice, now: Date): boolean {
    // Check if not started yet
    if (notice.startDate) {
      const startDate = new Date(notice.startDate);
      if (!Number.isNaN(startDate.getTime()) && now < startDate) {
        return false;
      }
    }

    // Check if already ended
    if (notice.endDate) {
      const endDate = new Date(notice.endDate);
      if (!Number.isNaN(endDate.getTime()) && now > endDate) {
        return false;
      }
    }

    return true;
  }
}

