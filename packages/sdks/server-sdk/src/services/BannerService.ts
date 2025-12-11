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
  // Target environments (empty = single environment mode)
  // Note: environments are identified by environmentName
  private environments: string[];
  // Multi-environment cache: Map<environment (environmentName), Banner[]>
  private cachedBannersByEnv: Map<string, Banner[]> = new Map();
  private defaultEnvKey: string = 'default';

  constructor(apiClient: ApiClient, logger: Logger, environments: string[] = []) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.environments = environments;
  }

  private isMultiEnvironment(): boolean {
    return this.environments.length > 0;
  }

  /**
   * Get all banners
   * Single-env mode: GET /api/v1/server/banners -> { banners: [...] }
   * Multi-env mode: GET /api/v1/server/banners?environments=... -> { byEnvironment: { [env]: [...] } }
   */
  async list(): Promise<Banner[]> {
    let endpoint = `/api/v1/server/banners`;
    if (this.isMultiEnvironment()) {
      endpoint += `?environments=${this.environments.join(',')}`;
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
   *                    For game servers, can be omitted to use default environment.
   *                    For edge servers, must be provided from client request.
   */
  getCached(environment?: string): Banner[] {
    const envKey = this.isMultiEnvironment() ? (environment || this.defaultEnvKey) : this.defaultEnvKey;
    return this.cachedBannersByEnv.get(envKey) || [];
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
   */
  async refresh(): Promise<Banner[]> {
    this.logger.info('Refreshing banners cache');
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
   * Get banner by ID
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

