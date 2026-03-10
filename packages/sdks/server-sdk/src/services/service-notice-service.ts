/**
 * Service Notice Service
 * Handles service notice list and retrieval
 * Uses per-environment API pattern: GET /api/v1/server/service-notices
 *
 * DESIGN PRINCIPLES:
 * - All methods that access cached data MUST receive environment explicitly in multi-env mode
 * - Environment resolution is delegated to string
 * - In multi-environment mode (edge), environment MUST always be provided
 */

import { ApiClient } from '../client/api-client';
import { Logger } from '../utils/logger';
import { CacheStorageProvider } from '../cache/storage-provider';
import {
  ServiceNotice,
  ServiceNoticeListResponse,
  ServiceNoticeCategory,
} from '../types/api';

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
  private defaultEnvironmentId: string;
  private storage?: CacheStorageProvider;
  // Multi-environment cache: Map<environmentId, ServiceNotice[]>
  private cachedNoticesByEnv: Map<string, ServiceNotice[]> = new Map();
  // Whether this feature is enabled
  private featureEnabled: boolean = true;

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
  async initializeAsync(environmentId: string): Promise<void> {
    if (!this.storage) return;

    try {
      const cachedJson = await this.storage.get(
        `ServiceNotices_${environmentId}`
      );
      if (cachedJson) {
        this.cachedNoticesByEnv.set(environmentId, JSON.parse(cachedJson));
        this.logger.debug('Loaded service notices from local storage', {
          environmentId,
        });
      }
    } catch (error: any) {
      this.logger.warn('Failed to load service notices from local storage', {
        environmentId,
        error: error.message,
      });
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
   * Get service notices for a specific environment
   * GET /api/v1/server/service-notices -> { notices: [...] }
   */
  async listByEnvironment(environmentId: string): Promise<ServiceNotice[]> {
    const endpoint = `/api/v1/server/service-notices`;

    this.logger.debug('Fetching service notices', { environmentId });

    const response =
      await this.apiClient.get<ServiceNoticeListResponse>(endpoint);

    if (!response.success || !response.data) {
      throw new Error(
        response.error?.message || 'Failed to fetch service notices'
      );
    }

    const notices = response.data.notices;
    this.cachedNoticesByEnv.set(environmentId, notices);

    // Save to local storage if available
    if (this.storage) {
      await this.storage.save(
        `ServiceNotices_${environmentId}`,
        JSON.stringify(notices)
      );
    }

    this.logger.info('Service notices fetched', {
      count: notices.length,
      environmentId,
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
        this.logger.error(
          `Failed to fetch service notices for environment ${env}`,
          { error }
        );
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
   * @param environmentId environment ID (required)
   */
  getCached(environmentId: string): ServiceNotice[] {
    return this.cachedNoticesByEnv.get(environmentId) || [];
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
  clearCacheForEnvironment(environmentId: string): void {
    this.cachedNoticesByEnv.delete(environmentId);
    this.logger.debug('Service notices cache cleared for environment', {
      environmentId,
    });
  }

  /**
   * Refresh cached service notices for a specific environment
   * @param environmentId environment ID
   * @param suppressWarnings If true, suppress feature disabled warnings (used by refreshAll)
   */
  async refreshByEnvironment(
    environmentId: string,
    suppressWarnings?: boolean
  ): Promise<ServiceNotice[]> {
    if (!this.featureEnabled && !suppressWarnings) {
      this.logger.warn(
        'ServiceNoticeService.refreshByEnvironment() called but feature is disabled',
        { environmentId }
      );
    }
    this.logger.info('Refreshing service notices cache', { environmentId });
    return await this.listByEnvironment(environmentId);
  }

  /**
   * Update cache with new data
   * @param notices Service notices to cache
   * @param environmentId environment ID (required)
   */
  updateCache(notices: ServiceNotice[], environmentId: string): void {
    this.cachedNoticesByEnv.set(environmentId, notices);
    this.logger.debug('Service notices cache updated', {
      environmentId,
      count: notices.length,
    });
  }

  /**
   * Update a single service notice in cache (immutable)
   * @param notice Service notice to update
   * @param environmentId environment ID (required)
   */
  updateSingleServiceNotice(
    notice: ServiceNotice,
    environmentId: string
  ): void {
    const shouldBeCached =
      notice.isActive && this.isWithinTimeWindow(notice, new Date());

    if (!shouldBeCached) {
      this.removeFromCache(notice.id, environmentId);
      return;
    }

    const currentItems = this.cachedNoticesByEnv.get(environmentId) || [];
    const itemId = notice.id;

    const existsInCache = currentItems.some((i) => i.id === itemId);

    let newItems: ServiceNotice[];

    if (existsInCache) {
      newItems = currentItems.map((i) => (i.id === itemId ? notice : i));
      this.logger.debug('Single service notice updated in cache', {
        id: itemId,
        environmentId,
      });
    } else {
      newItems = [...currentItems, notice];
      this.logger.debug('Single service notice added to cache', {
        id: itemId,
        environmentId,
      });
    }

    this.cachedNoticesByEnv.set(environmentId, this.sortNotices(newItems));
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
   * @param environmentId environment ID (required)
   */
  removeFromCache(id: string, environmentId: string): void {
    const currentItems = this.cachedNoticesByEnv.get(environmentId) || [];
    const newItems = currentItems.filter(
      (item) => String(item.id) !== String(id)
    );
    this.cachedNoticesByEnv.set(environmentId, newItems);
    this.logger.debug('Service notice removed from cache', {
      id,
      environmentId,
    });
  }

  /**
   * Get service notice by ID
   * @param environmentId environment ID (required)
   */
  getById(id: string, environmentId: string): ServiceNotice | null {
    const notices = this.getCached(environmentId);
    return notices.find((n) => String(n.id) === String(id)) || null;
  }

  /**
   * Get active service notices with optional filters
   * @param environmentId environment ID (required)
   */
  getActive(
    environmentId: string,
    filters?: ServiceNoticeFilters
  ): ServiceNotice[] {
    const notices = this.getCached(environmentId);
    const now = new Date();

    return notices.filter((notice) => {
      // Must be active
      if (!notice.isActive) return false;

      // Check time window
      if (!this.isWithinTimeWindow(notice, now)) return false;

      // Apply filters
      if (filters) {
        if (filters.category && notice.category !== filters.category)
          return false;

        if (filters.platform) {
          const platforms = Array.isArray(filters.platform)
            ? filters.platform
            : [filters.platform];
          // Empty platforms array means all platforms
          if (
            notice.platforms.length > 0 &&
            !platforms.some((p) => notice.platforms.includes(p))
          ) {
            return false;
          }
        }

        if (filters.channel && notice.channels && notice.channels.length > 0) {
          const channels = Array.isArray(filters.channel)
            ? filters.channel
            : [filters.channel];
          if (!channels.some((c) => notice.channels!.includes(c))) {
            return false;
          }
        }

        if (
          filters.subchannel &&
          notice.subchannels &&
          notice.subchannels.length > 0
        ) {
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
   * @param environmentId environment ID (required)
   */
  getByCategory(
    category: ServiceNoticeCategory,
    environmentId: string
  ): ServiceNotice[] {
    return this.getActive(environmentId, { category });
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
