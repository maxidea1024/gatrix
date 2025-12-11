/**
 * Service Notice Service
 * Handles service notice list and retrieval
 * Supports both single-environment (default) and multi-environment (Edge) modes
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { ServiceNotice, ServiceNoticeListResponse, ServiceNoticeByEnvResponse, ServiceNoticeCategory } from '../types/api';

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
  // Target environments ('*' = all environments, string[] = specific, empty = single mode)
  // Note: environments are identified by environmentName
  private environments: string[] | '*';
  // Multi-environment cache: Map<environment (environmentName), ServiceNotice[]>
  private cachedNoticesByEnv: Map<string, ServiceNotice[]> = new Map();
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
   * Get all service notices
   * Single-env mode: GET /api/v1/server/service-notices -> { notices: [...] }
   * Multi-env mode: GET /api/v1/server/service-notices?environments=... -> { byEnvironment: { [env]: [...] } }
   * All-env mode: GET /api/v1/server/service-notices?environments=* -> { byEnvironment: { [env]: [...] } }
   */
  async list(): Promise<ServiceNotice[]> {
    let endpoint = `/api/v1/server/service-notices`;
    if (this.isAllEnvironments()) {
      endpoint += `?environments=*`;
    } else if (this.isMultiEnvironment()) {
      endpoint += `?environments=${(this.environments as string[]).join(',')}`;
    }

    this.logger.debug('Fetching service notices', { environments: this.environments });

    // Clear cache before fetching
    this.cachedNoticesByEnv.clear();

    if (this.isMultiEnvironment()) {
      // Multi-environment mode: backend returns { byEnvironment: { [env]: data[] } }
      const response = await this.apiClient.get<ServiceNoticeByEnvResponse>(endpoint);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch service notices');
      }

      const byEnvironment = response.data.byEnvironment;
      let totalCount = 0;

      // Store directly by environment key (already separated by backend)
      for (const [envName, notices] of Object.entries(byEnvironment)) {
        this.cachedNoticesByEnv.set(envName, notices);
        totalCount += notices.length;
      }

      this.logger.info('Service notices fetched', {
        count: totalCount,
        environmentCount: this.cachedNoticesByEnv.size,
        environments: this.environments,
      });

      // Return all notices as flat array for backward compatibility
      return Array.from(this.cachedNoticesByEnv.values()).flat();
    } else {
      // Single-environment mode: backend returns { notices: [...] }
      const response = await this.apiClient.get<ServiceNoticeListResponse>(endpoint);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch service notices');
      }

      const notices = response.data.notices;
      this.cachedNoticesByEnv.set(this.defaultEnvKey, notices);

      this.logger.info('Service notices fetched', {
        count: notices.length,
        environments: 'single',
      });

      return notices;
    }
  }

  /**
   * Get cached service notices
   * @param environment Environment name. Only used in multi-environment mode.
   *                    For game servers, can be omitted to use default environment.
   *                    For edge servers, must be provided from client request.
   */
  getCached(environment?: string): ServiceNotice[] {
    const envKey = this.isMultiEnvironment() ? (environment || this.defaultEnvKey) : this.defaultEnvKey;
    return this.cachedNoticesByEnv.get(envKey) || [];
  }

  /**
   * Get all cached service notices (all environments)
   * Only meaningful in multi-environment mode
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
   * Refresh cached service notices
   */
  async refresh(): Promise<ServiceNotice[]> {
    this.logger.info('Refreshing service notices cache');
    return await this.list();
  }

  /**
   * Update cache with new data
   * @param environment Environment name. Only used in multi-environment mode.
   */
  updateCache(notices: ServiceNotice[], environment?: string): void {
    const envKey = this.isMultiEnvironment() ? (environment || this.defaultEnvKey) : this.defaultEnvKey;
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

