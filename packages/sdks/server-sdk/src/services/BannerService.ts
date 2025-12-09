/**
 * Banner Service
 * Handles banner list and retrieval
 * Supports both single-environment (default) and multi-environment (Edge) modes
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { Banner, BannerListResponse } from '../types/api';

export class BannerService {
  private apiClient: ApiClient;
  private logger: Logger;
  // Target environments (empty = single environment mode)
  private environments: string[];
  // Multi-environment cache: Map<environmentId, Banner[]>
  private cachedBannersByEnv: Map<string, Banner[]> = new Map();
  private defaultEnvId: string = 'default';

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
   * Single-env mode: GET /api/v1/server/banners
   * Multi-env mode: GET /api/v1/server/banners?environments=env1,env2,env3
   */
  async list(): Promise<Banner[]> {
    let endpoint = `/api/v1/server/banners`;
    if (this.isMultiEnvironment()) {
      endpoint += `?environments=${this.environments.join(',')}`;
    }

    this.logger.debug('Fetching banners', { environments: this.environments });

    const response = await this.apiClient.get<BannerListResponse>(endpoint);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch banners');
    }

    const banners = response.data.banners;

    // Group by environment
    this.cachedBannersByEnv.clear();
    for (const banner of banners) {
      // In single-env mode, all data goes to 'default'
      let envKey = this.defaultEnvId;
      if (this.isMultiEnvironment()) {
        // Use environmentName if available (user preference), fallback to environmentId
        // Also check if the configured environments contain the name or ID to ensure consistency
        if (banner.environmentName && this.environments.includes(banner.environmentName)) {
          envKey = banner.environmentName;
        } else if (banner.environmentId && this.environments.includes(banner.environmentId)) {
          envKey = banner.environmentId;
        } else {
          // Fallback: prefer name if available
          envKey = banner.environmentName || banner.environmentId || this.defaultEnvId;
        }
      }

      if (!this.cachedBannersByEnv.has(envKey)) {
        this.cachedBannersByEnv.set(envKey, []);
      }
      this.cachedBannersByEnv.get(envKey)!.push(banner);
    }

    this.logger.info('Banners fetched', {
      count: banners.length,
      environmentCount: this.cachedBannersByEnv.size,
      environments: this.environments,
    });

    return banners;
  }

  /**
   * Get cached banners
   * @param environmentId Only used in multi-environment mode
   */
  getCached(environmentId?: string): Banner[] {
    const envId = this.isMultiEnvironment() ? (environmentId || this.defaultEnvId) : this.defaultEnvId;
    return this.cachedBannersByEnv.get(envId) || [];
  }

  /**
   * Get all cached banners (all environments)
   * Only meaningful in multi-environment mode
   */
  getAllCached(): Map<string, Banner[]> {
    return this.cachedBannersByEnv;
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
   * @param environmentId Only used in multi-environment mode
   */
  updateCache(banners: Banner[], environmentId?: string): void {
    const envId = this.isMultiEnvironment() ? (environmentId || this.defaultEnvId) : this.defaultEnvId;
    this.cachedBannersByEnv.set(envId, banners);
    this.logger.debug('Banners cache updated', { environmentId: envId, count: banners.length });
  }

  /**
   * Get banner by ID
   */
  getById(bannerId: string, environmentId?: string): Banner | null {
    const banners = this.getCached(environmentId);
    return banners.find((b) => b.bannerId === bannerId) || null;
  }

  /**
   * Get banner by name
   */
  getByName(name: string, environmentId?: string): Banner | null {
    const banners = this.getCached(environmentId);
    return banners.find((b) => b.name === name) || null;
  }

  /**
   * Get published banners only
   */
  getPublished(environmentId?: string): Banner[] {
    const banners = this.getCached(environmentId);
    return banners.filter((b) => b.status === 'published');
  }

  /**
   * Get banners by status
   */
  getByStatus(status: 'draft' | 'published' | 'archived', environmentId?: string): Banner[] {
    const banners = this.getCached(environmentId);
    return banners.filter((b) => b.status === status);
  }
}

