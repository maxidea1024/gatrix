/**
 * Service Notice Service
 * Handles service notice list and retrieval
 * Uses per-environment API pattern: GET /api/v1/server/:env/service-notices
 *
 * DESIGN PRINCIPLES:
 * - All methods that access cached data MUST receive environment explicitly in multi-env mode
 * - Environment resolution is delegated to EnvironmentResolver
 * - In multi-environment mode (edge), environment MUST always be provided
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { EnvironmentResolver } from '../utils/EnvironmentResolver';
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
  private envResolver: EnvironmentResolver;
  // Multi-environment cache: Map<environment (environmentName), ServiceNotice[]>
  private cachedNoticesByEnv: Map<string, ServiceNotice[]> = new Map();
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
    this.logger.debug('Fetching service notices for multiple environments', {
      environments,
    });

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
   * Get cached service notices
   * @param environment Environment name (required)
   */
  getCached(environment: string): ServiceNotice[] {
    return this.cachedNoticesByEnv.get(environment) || [];
  }

  /**
   * Get all cached service notices (all environments)
   */
  getAllCached(): Map<string, ServiceNotice[]> {
    return this.cachedNoticesByEnv;
  }

  /**
   * Get all cached service notices as flat array (for internal use)
   */
  getAllCachedFlat(): ServiceNotice[] {
    return Array.from(this.cachedNoticesByEnv.values()).flat();
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
    this.logger.debug('Service notices cache cleared for environment', {
      environment,
    });
  }

  /**
   * Refresh cached service notices for a specific environment
   * @param environment Environment name
   * @param suppressWarnings If true, suppress feature disabled warnings (used by refreshAll)
   */
  async refreshByEnvironment(
    environment: string,
    suppressWarnings?: boolean
  ): Promise<ServiceNotice[]> {
    if (!this.featureEnabled && !suppressWarnings) {
      this.logger.warn(
        'ServiceNoticeService.refreshByEnvironment() called but feature is disabled',
        { environment }
      );
    }
    this.logger.info('Refreshing service notices cache', { environment });
    // Invalidate ETag cache to force fresh data fetch
    this.apiClient.invalidateEtagCache(
      `/api/v1/server/${encodeURIComponent(environment)}/service-notices`
    );
    return await this.listByEnvironment(environment);
  }

  /**
   * Update cache with new data
   * @param notices Service notices to cache
   * @param environment Environment name (required)
   */
  updateCache(notices: ServiceNotice[], environment: string): void {
    this.cachedNoticesByEnv.set(environment, notices);
    this.logger.debug('Service notices cache updated', {
      environment,
      count: notices.length,
    });
  }

  /**
   * Update a single service notice in cache (immutable)
   * @param notice Service notice to update
   * @param environment Environment name (required)
   */
  updateSingleServiceNotice(notice: ServiceNotice, environment: string): void {
    const shouldBeCached = notice.isActive && this.isWithinTimeWindow(notice, new Date());

    if (!shouldBeCached) {
      this.removeFromCache(notice.id, environment);
      return;
    }

    const currentItems = this.cachedNoticesByEnv.get(environment) || [];
    const itemId = notice.id;

    const existsInCache = currentItems.some((i) => i.id === itemId);

    let newItems: ServiceNotice[];

    if (existsInCache) {
      newItems = currentItems.map((i) => (i.id === itemId ? notice : i));
      this.logger.debug('Single service notice updated in cache', {
        id: itemId,
        environment,
      });
    } else {
      newItems = [...currentItems, notice];
      this.logger.debug('Single service notice added to cache', {
        id: itemId,
        environment,
      });
    }

    this.cachedNoticesByEnv.set(environment, this.sortNotices(newItems));
  }

  /**
   * Sort notices by isPinned (desc) and updatedAt (desc)
   */
  private sortNotices(notices: ServiceNotice[]): ServiceNotice[] {
    return notices.sort((a, b) => {
      // Sort by isPinned (true first)
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      // Then by updatedAt (newest first)
      const dateA = new Date(a.updatedAt).getTime();
      const dateB = new Date(b.updatedAt).getTime();
      return dateB - dateA;
    });
  }

  /**
   * Remove a service notice from cache (immutable)
   * @param id Service notice ID
   * @param environment Environment name (required)
   */
  removeFromCache(id: number, environment: string): void {
    const currentItems = this.cachedNoticesByEnv.get(environment) || [];
    const newItems = currentItems.filter((item) => item.id !== id);
    this.cachedNoticesByEnv.set(environment, newItems);
    this.logger.debug('Service notice removed from cache', { id, environment });
  }

  /**
   * Get service notice by ID
   * @param environment Environment name (required)
   */
  getById(id: number, environment: string): ServiceNotice | null {
    const notices = this.getCached(environment);
    return notices.find((n) => n.id === id) || null;
  }

  /**
   * Get active service notices with optional filters
   * @param environment Environment name (required)
   */
  getActive(environment: string, filters?: ServiceNoticeFilters): ServiceNotice[] {
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
   * @param category Notice category
   * @param environment Environment name (required)
   */
  getByCategory(category: ServiceNoticeCategory, environment: string): ServiceNotice[] {
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
