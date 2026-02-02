/**
 * Banner Service
 * Handles banner list and retrieval
 * Uses per-environment API pattern: GET /api/v1/server/:env/banners
 * Extends BaseEnvironmentService for common fetch/caching logic
 */

import { ApiClient } from "../client/ApiClient";
import { Logger } from "../utils/logger";
import { EnvironmentResolver } from "../utils/EnvironmentResolver";
import { Banner, BannerListResponse } from "../types/api";
import { BaseEnvironmentService } from "./BaseEnvironmentService";

export class BannerService extends BaseEnvironmentService<
  Banner,
  BannerListResponse,
  string
> {
  constructor(
    apiClient: ApiClient,
    logger: Logger,
    envResolver: EnvironmentResolver,
  ) {
    super(apiClient, logger, envResolver);
  }

  // ==================== Abstract Method Implementations ====================

  protected getEndpoint(environment: string): string {
    return `/api/v1/server/${encodeURIComponent(environment)}/banners`;
  }

  protected extractItems(response: BannerListResponse): Banner[] {
    return response.banners;
  }

  protected getServiceName(): string {
    return "banners";
  }

  protected getItemId(item: Banner): string {
    return item.bannerId;
  }

  // ==================== Override for ETag Invalidation ====================

  /**
   * Refresh cached banners for a specific environment
   */
  async refreshByEnvironment(environment: string): Promise<Banner[]> {
    this.logger.info("Refreshing banners cache", { environment });
    // Invalidate ETag cache to force fresh data fetch
    this.apiClient.invalidateEtagCache(this.getEndpoint(environment));
    return await this.listByEnvironment(environment);
  }

  // ==================== Domain-specific Methods ====================

  /**
   * Get a single banner by ID from API
   * Used for updating cache with fresh data
   * @param bannerId Banner ID
   * @param environment Environment name (required)
   */
  async fetchById(bannerId: string, environment: string): Promise<Banner> {
    const response = await this.apiClient.get<{ banner: Banner }>(
      `/api/v1/server/${encodeURIComponent(environment)}/banners/${bannerId}`,
    );
    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "Failed to fetch banner");
    }
    return response.data.banner;
  }

  /**
   * Update a single banner in cache (immutable)
   * If status is not 'published', removes the banner from cache (no API call needed)
   * If status is 'published' but not in cache, fetches and adds it to cache
   * If status is 'published' and in cache, fetches and updates it
   * @param bannerId Banner ID
   * @param environment Environment name (required)
   * @param status Optional status
   */
  async updateSingleBanner(
    bannerId: string,
    environment: string,
    status?: string,
  ): Promise<void> {
    try {
      this.logger.debug("Updating single banner in cache", {
        bannerId,
        environment,
        status,
      });

      // If status is not 'published', just remove from cache
      if (status && status !== "published") {
        this.logger.info("Banner is not published, removing from cache", {
          bannerId,
          environment,
          status,
        });
        this.removeFromCache(bannerId, environment);
        return;
      }

      // Otherwise, fetch from API and add/update
      // Add small delay to ensure backend transaction is committed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Invalidate ETag cache before fetching to ensure fresh data
      this.apiClient.invalidateEtagCache(`/banners/${bannerId}`);

      // Fetch the updated banner from backend
      const updatedBanner = await this.fetchById(bannerId, environment);
      this.updateItemInCache(updatedBanner, environment);
    } catch (error: any) {
      this.logger.error("Failed to update single banner in cache", {
        bannerId,
        environment,
        error: error.message,
      });
      // If update fails, fall back to full refresh
      await this.refreshByEnvironment(environment);
    }
  }

  /**
   * Get banner by ID from cache
   * @param bannerId Banner ID
   * @param environment Environment name (required)
   */
  getById(bannerId: string, environment: string): Banner | null {
    const banners = this.getCached(environment);
    return banners.find((b) => b.bannerId === bannerId) || null;
  }

  /**
   * Get banner by name
   * @param name Banner name
   * @param environment Environment name (required)
   */
  getByName(name: string, environment: string): Banner | null {
    const banners = this.getCached(environment);
    return banners.find((b) => b.name === name) || null;
  }

  /**
   * Get published banners only
   * @param environment Environment name (required)
   */
  getPublished(environment: string): Banner[] {
    const banners = this.getCached(environment);
    return banners.filter((b) => b.status === "published");
  }

  /**
   * Get banners by status
   * @param status Banner status
   * @param environment Environment name (required)
   */
  getByStatus(
    status: "draft" | "published" | "archived",
    environment: string,
  ): Banner[] {
    const banners = this.getCached(environment);
    return banners.filter((b) => b.status === status);
  }
}
