/**
 * Banner Service
 * Handles banner list and retrieval
 * Supports both single-environment (default) and multi-environment (Edge) modes
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { Banner, BannerListResponse, BannerByEnvResponse } from '../types/api';

export class BannerService {
  private apiClient: ApiClient;
  private logger: Logger;
  // Target environments ('*' = all environments, string[] = specific, empty = single mode)
  // Note: environments are identified by environmentName
  private environments: string[] | '*';
  // Multi-environment cache: Map<environment (environmentName), Banner[]>
  private cachedBannersByEnv: Map<string, Banner[]> = new Map();
  private defaultEnvKey: string = 'default';

  constructor(apiClient: ApiClient, logger: Logger, environments: string[] | '*' = []) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.environments = environments;
  }

  private isMultiEnvironment(): boolean {
    return this.environments === '*' || (Array.isArray(this.environments) && this.environments.length > 0);
  }

  private isAllEnvironments(): boolean {
    return this.environments === '*';
  }

  /**
   * Get all banners
   * Single-env mode: GET /api/v1/server/banners -> { banners: [...] }
   * Multi-env mode: GET /api/v1/server/banners?environments=... -> { byEnvironment: { [env]: [...] } }
   * All-env mode: GET /api/v1/server/banners?environments=* -> { byEnvironment: { [env]: [...] } }
   */
  async list(): Promise<Banner[]> {
    let endpoint = `/api/v1/server/banners`;
    if (this.isAllEnvironments()) {
      endpoint += `?environments=*`;
    } else if (this.isMultiEnvironment()) {
      endpoint += `?environments=${(this.environments as string[]).join(',')}`;
    }

    this.logger.debug('Fetching banners', { environments: this.environments });

    // Clear cache before fetching
    this.cachedBannersByEnv.clear();

    if (this.isMultiEnvironment()) {
      // Multi-environment mode: backend returns { byEnvironment: { [env]: data[] } }
      const response = await this.apiClient.get<BannerByEnvResponse>(endpoint);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch banners');
      }

      const byEnvironment = response.data.byEnvironment;
      let totalCount = 0;

      // Store directly by environment key (already separated by backend)
      for (const [envName, banners] of Object.entries(byEnvironment)) {
        this.cachedBannersByEnv.set(envName, banners);
        totalCount += banners.length;
      }

      this.logger.info('Banners fetched', {
        count: totalCount,
        environmentCount: this.cachedBannersByEnv.size,
        environments: this.environments,
      });

      // Return all banners as flat array for backward compatibility
      return Array.from(this.cachedBannersByEnv.values()).flat();
    } else {
      // Single-environment mode: backend returns { banners: [...] }
      const response = await this.apiClient.get<BannerListResponse>(endpoint);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch banners');
      }

      const banners = response.data.banners;
      this.cachedBannersByEnv.set(this.defaultEnvKey, banners);

      this.logger.info('Banners fetched', {
        count: banners.length,
        environments: 'single',
      });

      return banners;
    }
  }

  /**
   * Get cached banners
   * @param environment Environment name. Only used in multi-environment mode.
   *                    If omitted in multi-environment mode, returns all banners as flat array.
   */
  getCached(environment?: string): Banner[] {
    if (!this.isMultiEnvironment()) {
      // Single-environment mode: return default key
      return this.cachedBannersByEnv.get(this.defaultEnvKey) || [];
    }

    // Multi-environment mode
    if (environment) {
      // Specific environment requested
      return this.cachedBannersByEnv.get(environment) || [];
    }

    // No environment specified: return all banners as flat array
    return Array.from(this.cachedBannersByEnv.values()).flat();
  }

  /**
   * Get all cached banners (all environments)
   * Only meaningful in multi-environment mode
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
   * Refresh cached banners
   * Invalidates ETag cache first to ensure fresh data is fetched
   */
  async refresh(): Promise<Banner[]> {
    this.logger.info('Refreshing banners cache');
    // Invalidate ETag cache to force fresh data fetch
    this.apiClient.invalidateEtagCache('/api/v1/server/banners');
    return await this.list();
  }

  /**
   * Update cache with new data
   * @param environment Environment name. Only used in multi-environment mode.
   */
  updateCache(banners: Banner[], environment?: string): void {
    const envKey = this.isMultiEnvironment() ? (environment || this.defaultEnvKey) : this.defaultEnvKey;
    this.cachedBannersByEnv.set(envKey, banners);
    this.logger.debug('Banners cache updated', { environment: envKey, count: banners.length });
  }

  /**
   * Get a single banner by ID from API
   * Used for updating cache with fresh data
   */
  async fetchById(bannerId: string): Promise<Banner> {
    const response = await this.apiClient.get<{ banner: Banner }>(`/api/v1/server/banners/${bannerId}`);
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

      const envKey = this.isMultiEnvironment() ? (environment || this.defaultEnvKey) : this.defaultEnvKey;

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
      const updatedBanner = await this.fetchById(bannerId);

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

    const envKey = this.isMultiEnvironment() ? (environment || this.defaultEnvKey) : this.defaultEnvKey;
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

