/**
 * Service Notice Service
 * Handles service notice list and retrieval
 * Supports both single-environment (default) and multi-environment (Edge) modes
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
  // Target environments (empty = single environment mode)
  private environments: string[];
  // Multi-environment cache: Map<environmentId, ServiceNotice[]>
  private cachedNoticesByEnv: Map<string, ServiceNotice[]> = new Map();
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
   * Get all service notices
   * Single-env mode: GET /api/v1/server/service-notices
   * Multi-env mode: GET /api/v1/server/service-notices?environments=env1,env2,env3
   */
  async list(): Promise<ServiceNotice[]> {
    let endpoint = `/api/v1/server/service-notices`;
    if (this.isMultiEnvironment()) {
      endpoint += `?environments=${this.environments.join(',')}`;
    }

    this.logger.debug('Fetching service notices', { environments: this.environments });

    const response = await this.apiClient.get<ServiceNoticeListResponse>(endpoint);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch service notices');
    }

    const notices = response.data.notices;

    // Group by environment
    this.cachedNoticesByEnv.clear();
    for (const notice of notices) {
      // In single-env mode, all data goes to 'default'
      const envId = this.isMultiEnvironment()
        ? (notice.environmentId || this.defaultEnvId)
        : this.defaultEnvId;
      if (!this.cachedNoticesByEnv.has(envId)) {
        this.cachedNoticesByEnv.set(envId, []);
      }
      this.cachedNoticesByEnv.get(envId)!.push(notice);
    }

    this.logger.info('Service notices fetched', {
      count: notices.length,
      environmentCount: this.cachedNoticesByEnv.size,
      environments: this.environments,
    });

    return notices;
  }

  /**
   * Get cached service notices
   * @param environmentId Only used in multi-environment mode
   */
  getCached(environmentId?: string): ServiceNotice[] {
    const envId = this.isMultiEnvironment() ? (environmentId || this.defaultEnvId) : this.defaultEnvId;
    return this.cachedNoticesByEnv.get(envId) || [];
  }

  /**
   * Get all cached service notices (all environments)
   * Only meaningful in multi-environment mode
   */
  getAllCached(): Map<string, ServiceNotice[]> {
    return this.cachedNoticesByEnv;
  }

  /**
   * Refresh cached service notices
   */
  async refresh(): Promise<ServiceNotice[]> {
    this.logger.info('Refreshing service notices cache');
    return await this.list();
  }

  /**
   * Update cache with new data
   * @param environmentId Only used in multi-environment mode
   */
  updateCache(notices: ServiceNotice[], environmentId?: string): void {
    const envId = this.isMultiEnvironment() ? (environmentId || this.defaultEnvId) : this.defaultEnvId;
    this.cachedNoticesByEnv.set(envId, notices);
    this.logger.debug('Service notices cache updated', { environmentId: envId, count: notices.length });
  }

  /**
   * Get service notice by ID
   */
  getById(id: number, environmentId?: string): ServiceNotice | null {
    const notices = this.getCached(environmentId);
    return notices.find((n) => n.id === id) || null;
  }

  /**
   * Get active service notices with optional filters
   */
  getActive(environmentId?: string, filters?: ServiceNoticeFilters): ServiceNotice[] {
    const notices = this.getCached(environmentId);
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
   */
  getByCategory(category: ServiceNoticeCategory, environmentId?: string): ServiceNotice[] {
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

