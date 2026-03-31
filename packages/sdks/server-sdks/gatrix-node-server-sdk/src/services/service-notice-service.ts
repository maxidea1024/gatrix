/**
 * Service Notice Service
 * Handles service notice list and retrieval
 * Uses per-environment API pattern: GET /api/v1/server/service-notices
 * Extends BaseEnvironmentService for common fetch/caching logic
 */

import { ApiClient } from '../client/api-client';
import { Logger } from '../utils/logger';
import { CacheStorageProvider } from '../cache/storage-provider';
import {
  ServiceNotice,
  ServiceNoticeListResponse,
  ServiceNoticeCategory,
} from '../types/api';
import { BaseEnvironmentService } from './base-environment-service';

export interface ServiceNoticeFilters {
  isActive?: boolean;
  category?: ServiceNoticeCategory;
  platform?: string | string[];
  channel?: string | string[];
  subchannel?: string | string[];
}

export class ServiceNoticeService extends BaseEnvironmentService<
  ServiceNotice,
  ServiceNoticeListResponse,
  string
> {
  constructor(
    apiClient: ApiClient,
    logger: Logger,
    defaultEnvironmentId: string,
    storage?: CacheStorageProvider
  ) {
    super(apiClient, logger, defaultEnvironmentId, storage);
  }

  // ==================== Abstract Method Implementations ====================

  protected getEndpoint(): string {
    return `/api/v1/server/service-notices`;
  }

  protected extractItems(response: ServiceNoticeListResponse): ServiceNotice[] {
    return response.notices;
  }

  protected getServiceName(): string {
    return 'serviceNotices';
  }

  protected getItemId(item: ServiceNotice): string {
    return item.id;
  }

  // ==================== Override for ETag Invalidation ====================

  /**
   * Refresh cached service notices for a specific environment
   */
  async refreshByEnvironment(
    suppressWarnings?: boolean,
    environmentId?: string
  ): Promise<ServiceNotice[]> {
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    this.logger.info('Refreshing service notices cache', {
      environmentId: resolvedEnv,
    });
    // Invalidate ETag cache to force fresh data fetch
    this.getApiClient(resolvedEnv).invalidateEtagCache(this.getEndpoint());
    return await this.listByEnvironment(resolvedEnv);
  }

  // ==================== Domain-specific Methods ====================

  /**
   * Update a single service notice in cache (immutable)
   * Checks isActive and time window before caching
   * @param notice Service notice to update
   * @param environmentId Environment ID
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

    this.updateItemInCache(notice, environmentId);

    // Re-sort after update
    const currentItems = this.cachedByEnv.get(environmentId) || [];
    this.cachedByEnv.set(environmentId, this.sortNotices(currentItems));
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
   * Get service notice by ID from cache
   * @param id Service notice ID
   * @param environmentId Environment ID (optional)
   */
  getById(id: string, environmentId?: string): ServiceNotice | null {
    const notices = this.getCached(environmentId);
    return notices.find((n) => String(n.id) === String(id)) || null;
  }

  /**
   * Get active service notices with optional filters
   * @param environmentId Environment ID (optional)
   * @param filters Optional filters
   */
  getActive(
    environmentId?: string,
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
   * @param environmentId Environment ID
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
