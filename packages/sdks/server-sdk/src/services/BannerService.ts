/**
 * Banner Service
 * Handles banner list and retrieval
 * Uses per-environment API pattern: GET /api/v1/server/:env/banners
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { Banner, BannerListResponse } from '../types/api';

export class BannerService {
  private apiClient: ApiClient;
  private logger: Logger;
  // Default environment for single-environment mode
  private defaultEnvironment: string;
  // Multi-environment cache: Map<environment (environmentName), Banner[]>
  private cachedBannersByEnv: Map<string, Banner[]> = new Map();

  constructor(apiClient: ApiClient, logger: Logger, defaultEnvironment: string = 'development') {
    this.apiClient = apiClient;
    this.logger = logger;
    this.defaultEnvironment = defaultEnvironment;
  }

  /**
   * Get banners for a specific environment
   * GET /api/v1/server/:env/banners -> { banners: [...] }
   */
  async listByEnvironment(environment: string): Promise<Banner[]> {
    const endpoint = `/api/v1/server/${encodeURIComponent(environment)}/banners`;

    this.logger.debug('Fetching banners', { environment });

    const response = await this.apiClient.get<BannerListResponse>(endpoint);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch banners');
    }

    const banners = response.data.banners;
    this.cachedBannersByEnv.set(environment, banners);

    this.logger.info('Banners fetched', {
      count: banners.length,
      environment,
    });

    return banners;
  }

  /**
   * Get banners for multiple environments
   * Fetches each environment separately and caches results
   */
  async listByEnvironments(environments: string[]): Promise<Banner[]> {
    this.logger.debug('Fetching banners for multiple environments', { environments });

    const results: Banner[] = [];

    for (const env of environments) {
      try {
        const banners = await this.listByEnvironment(env);
        results.push(...banners);
      } catch (error) {
        this.logger.error(`Failed to fetch banners for environment ${env}`, { error });
      }
    }

    this.logger.info('Banners fetched for all environments', {
      count: results.length,
      environmentCount: environments.length,
    });

    return results;
  }

  /**
   * Get all banners (uses default environment for single-env mode)
   * For backward compatibility
   */
  async list(): Promise<Banner[]> {
    return this.listByEnvironment(this.defaultEnvironment);
  }

  /**
   * Get cached banners
   * @param environment Environment name. If omitted, returns all banners as flat array.
   */
  getCached(environment?: string): Banner[] {
    if (environment) {
      return this.cachedBannersByEnv.get(environment) || [];
    }
    // No environment specified: return all banners as flat array
    return Array.from(this.cachedBannersByEnv.values()).flat();
  }

  /**
   * Get all cached banners (all environments)
   */
  getAllCached(): Map<string, Banner[]> {
    return this.cachedBannersByEnv;
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cachedBannersByEnv.clear();
    this.logger.debug('Banners cache cleared');
  }

  /**
   * Clear cached data for a specific environment
   */
  clearCacheForEnvironment(environment: string): void {
    this.cachedBannersByEnv.delete(environment);
    this.logger.debug('Banners cache cleared for environment', { environment });
  }

  /**
   * Refresh cached banners for a specific environment
   */
  async refreshByEnvironment(environment: string): Promise<Banner[]> {
    this.logger.info('Refreshing banners cache', { environment });
    // Invalidate ETag cache to force fresh data fetch
    this.apiClient.invalidateEtagCache(`/api/v1/server/${encodeURIComponent(environment)}/banners`);
    return await this.listByEnvironment(environment);
  }

  /**
   * Refresh cached banners (uses default environment)
   * For backward compatibility
   */
  async refresh(): Promise<Banner[]> {
    return this.refreshByEnvironment(this.defaultEnvironment);
  }

  /**
   * Update cache with new data
   */
  updateCache(banners: Banner[], environment?: string): void {
    const envKey = environment || this.defaultEnvironment;
    this.cachedBannersByEnv.set(envKey, banners);
    this.logger.debug('Banners cache updated', { environment: envKey, count: banners.length });
  }

  /**
   * Get a single banner by ID from API
   * Used for updating cache with fresh data
   */
  async fetchById(bannerId: string, environment?: string): Promise<Banner> {
    const env = environment || this.defaultEnvironment;
    const response = await this.apiClient.get<{ banner: Banner }>(`/api/v1/server/${encodeURIComponent(env)}/banners/${bannerId}`);
    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch banner');
    }
    return response.data.banner;
  }

  /**
   * Update a single banner in cache (immutable)
   * If status is not 'published', removes the banner from cache (no API call needed)
   * If status is 'published' but not in cache, fetches and adds it to cache
   * If status is 'published' and in cache, fetches and updates it
   */
  async updateSingleBanner(bannerId: string, environment?: string, status?: string): Promise<void> {
    try {
      this.logger.debug('Updating single banner in cache', { bannerId, environment, status });

      const envKey = environment || this.defaultEnvironment;

      // If status is not 'published', just remove from cache
      if (status && status !== 'published') {
        this.logger.info('Banner is not published, removing from cache', { bannerId, environment: envKey, status });
        this.removeBanner(bannerId, environment);
        return;
      }

      // Otherwise, fetch from API and add/update
      // Add small delay to ensure backend transaction is committed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Fetch the updated banner from backend
      const updatedBanner = await this.fetchById(bannerId, environment);

      // Get current banners for this environment
      const currentBanners = this.cachedBannersByEnv.get(envKey) || [];

      // Check if banner already exists in cache
      const existsInCache = currentBanners.some(b => b.bannerId === bannerId);

      if (existsInCache) {
        // Immutable update: update existing banner
        const newBanners = currentBanners.map(b => b.bannerId === bannerId ? updatedBanner : b);
        this.cachedBannersByEnv.set(envKey, newBanners);
        this.logger.debug('Single banner updated in cache', { bannerId, environment: envKey });
      } else {
        // Banner not in cache but found in backend (e.g., status changed to published)
        // Add it to cache
        const newBanners = [...currentBanners, updatedBanner];
        this.cachedBannersByEnv.set(envKey, newBanners);
        this.logger.debug('Single banner added to cache', { bannerId, environment: envKey });
      }
    } catch (error: any) {
      this.logger.error('Failed to update single banner in cache', {
        bannerId,
        environment,
        error: error.message,
      });
      // If update fails, fall back to full refresh
      await this.refresh();
    }
  }

  /**
   * Remove a banner from cache (immutable)
   */
  removeBanner(bannerId: string, environment?: string): void {
    this.logger.debug('Removing banner from cache', { bannerId, environment });

    const envKey = environment || this.defaultEnvironment;
    const currentBanners = this.cachedBannersByEnv.get(envKey) || [];

    // Immutable update: create new array without the deleted banner
    const newBanners = currentBanners.filter(b => b.bannerId !== bannerId);
    this.cachedBannersByEnv.set(envKey, newBanners);

    this.logger.debug('Banner removed from cache', { bannerId, environment: envKey });
  }

  /**
   * Get banner by ID from cache
   * @param environment Environment name. Only used in multi-environment mode.
   */
  getById(bannerId: string, environment?: string): Banner | null {
    const banners = this.getCached(environment);
    return banners.find((b) => b.bannerId === bannerId) || null;
  }

  /**
   * Get banner by name
   * @param environment Environment name. Only used in multi-environment mode.
   */
  getByName(name: string, environment?: string): Banner | null {
    const banners = this.getCached(environment);
    return banners.find((b) => b.name === name) || null;
  }

  /**
   * Get published banners only
   * @param environment Environment name. Only used in multi-environment mode.
   */
  getPublished(environment?: string): Banner[] {
    const banners = this.getCached(environment);
    return banners.filter((b) => b.status === 'published');
  }

  /**
   * Get banners by status
   * @param environment Environment name. Only used in multi-environment mode.
   */
  getByStatus(status: 'draft' | 'published' | 'archived', environment?: string): Banner[] {
    const banners = this.getCached(environment);
    return banners.filter((b) => b.status === status);
  }
}

