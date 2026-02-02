import { ulid } from "ulid";
import {
  BannerModel,
  BannerAttributes,
  BannerFilters,
  BannerStatus,
  Sequence,
} from "../models/Banner";
import { GatrixError } from "../middleware/errorHandler";
import logger from "../config/logger";
import { cacheService } from "./CacheService";
import { pubSubService } from "./PubSubService";
import { SERVER_SDK_ETAG } from "../constants/cacheKeys";

const CACHE_PREFIX = "banners";
const CACHE_TTL = 300; // 5 minutes

export interface CreateBannerInput {
  environment: string;
  name: string;
  description?: string;
  width: number;
  height: number;
  metadata?: Record<string, any>;
  playbackSpeed?: number;
  shuffle?: boolean;
  sequences?: Sequence[];
  createdBy?: number;
}

export interface UpdateBannerInput {
  name?: string;
  description?: string;
  width?: number;
  height?: number;
  metadata?: Record<string, any>;
  playbackSpeed?: number;
  shuffle?: boolean;
  sequences?: Sequence[];
  updatedBy?: number;
}

export interface GetBannersParams {
  environment: string;
  page?: number;
  limit?: number;
  search?: string;
  status?: BannerStatus | BannerStatus[];
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface GetBannersResponse {
  banners: BannerAttributes[];
  total: number;
  page: number;
  limit: number;
}

// Regex for valid identifier: lowercase letters, numbers, underscore, hyphen (must start with letter)
const BANNER_NAME_REGEX = /^[a-z][a-z0-9_-]*$/;

class BannerService {
  /**
   * Validate banner name format (identifier style)
   */
  static isValidBannerName(name: string): boolean {
    return BANNER_NAME_REGEX.test(name);
  }

  /**
   * Get all banners with pagination
   */
  static async getBanners(
    params: GetBannersParams,
  ): Promise<GetBannersResponse> {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const offset = (page - 1) * limit;

    try {
      const filters: BannerFilters = {
        environment: params.environment,
        search: params.search,
        status: params.status,
        limit,
        offset,
        sortBy: params.sortBy || "createdAt",
        sortOrder:
          (params.sortOrder?.toUpperCase() as "ASC" | "DESC") || "DESC",
      };

      const result = await BannerModel.findAll(filters);

      return {
        banners: result.banners,
        total: result.total,
        page,
        limit,
      };
    } catch (error) {
      logger.error("Failed to get banners", { error });
      throw new GatrixError("Failed to get banners", 500);
    }
  }

  /**
   * Get banner by ID
   */
  static async getBannerById(
    bannerId: string,
    environment: string,
  ): Promise<BannerAttributes> {
    try {
      const banner = await BannerModel.findById(bannerId, environment);

      if (!banner) {
        throw new GatrixError("Banner not found", 404);
      }

      return banner;
    } catch (error) {
      if (error instanceof GatrixError) throw error;
      logger.error("Failed to get banner", { error, bannerId, environment });
      throw new GatrixError("Failed to get banner", 500);
    }
  }

  /**
   * Create a new banner
   */
  static async createBanner(
    input: CreateBannerInput,
  ): Promise<BannerAttributes> {
    // Validate name format (identifier style)
    if (!this.isValidBannerName(input.name)) {
      throw new GatrixError(
        "Banner name must be a valid identifier (lowercase letters, numbers, underscore, hyphen, starting with a letter)",
        400,
        true,
        "INVALID_NAME_FORMAT",
      );
    }

    // Check for duplicate name
    const existing = await BannerModel.findByName(
      input.name,
      input.environment,
    );
    if (existing) {
      throw new GatrixError(
        "A banner with this name already exists",
        409,
        true,
        "DUPLICATE_NAME",
      );
    }

    try {
      const bannerId = ulid();

      const banner = await BannerModel.create({
        bannerId,
        environment: input.environment,
        name: input.name,
        description: input.description,
        width: input.width || 1024,
        height: input.height || 512,
        metadata: input.metadata,
        playbackSpeed: input.playbackSpeed || 1.0,
        shuffle: input.shuffle ?? false,
        sequences: input.sequences || [],
        version: 1,
        status: "draft",
        createdBy: input.createdBy,
      });

      // Publish SDK Event
      try {
        const environment = banner.environment;

        // Invalidate cache (including ETag cache for SDK)
        await this.invalidateCache(banner.environment);

        await pubSubService.publishSDKEvent({
          type: "banner.created",
          data: {
            id: banner.bannerId,
            environment,
            status: banner.status,
            timestamp: Date.now(),
          },
        });
      } catch (err) {
        logger.error("Failed to publish banner event", err);
      }

      return banner;
    } catch (error) {
      logger.error("Failed to create banner", { error, input });
      throw new GatrixError("Failed to create banner", 500);
    }
  }

  /**
   * Update a banner
   */
  static async updateBanner(
    bannerId: string,
    environment: string,
    input: UpdateBannerInput,
  ): Promise<BannerAttributes> {
    // If name is being updated, validate format and check for duplicates
    if (input.name) {
      if (!this.isValidBannerName(input.name)) {
        throw new GatrixError(
          "Banner name must be a valid identifier (lowercase letters, numbers, underscore, hyphen, starting with a letter)",
          400,
          true,
          "INVALID_NAME_FORMAT",
        );
      }

      const existing = await BannerModel.findByName(
        input.name,
        environment,
        bannerId,
      );
      if (existing) {
        throw new GatrixError(
          "A banner with this name already exists",
          409,
          true,
          "DUPLICATE_NAME",
        );
      }
    }

    try {
      // Check if banner exists
      await this.getBannerById(bannerId, environment);

      const banner = await BannerModel.update(bannerId, input, environment);

      // Invalidate cache (including ETag cache for SDK)
      await this.invalidateCache(banner.environment);

      // Notify via PubSub
      await pubSubService.publishNotification({
        type: "banner_change",
        data: { bannerId, action: "updated" },
        targetChannels: ["banner", "admin"],
      });

      // Publish SDK Event
      try {
        await pubSubService.publishSDKEvent({
          type: "banner.updated",
          data: {
            id: banner.bannerId,
            environment: banner.environment,
            status: banner.status,
            timestamp: Date.now(),
          },
        });
      } catch (err) {
        logger.error("Failed to publish banner event", err);
      }

      return banner;
    } catch (error) {
      if (error instanceof GatrixError) throw error;
      logger.error("Failed to update banner", {
        error,
        bannerId,
        environment,
        input,
      });
      throw new GatrixError("Failed to update banner", 500);
    }
  }

  /**
   * Delete a banner
   */
  static async deleteBanner(
    bannerId: string,
    environment: string,
  ): Promise<void> {
    try {
      // Check if banner exists
      const banner = await this.getBannerById(bannerId, environment);

      await BannerModel.delete(bannerId, environment);

      // Invalidate cache (including ETag cache for SDK)
      await this.invalidateCache(banner.environment);

      // Notify via PubSub
      await pubSubService.publishNotification({
        type: "banner_change",
        data: { bannerId, action: "deleted" },
        targetChannels: ["banner", "admin"],
      });

      // Publish SDK Event (Deletion)
      try {
        await pubSubService.publishSDKEvent({
          type: "banner.deleted",
          data: {
            id: bannerId,
            environment: banner.environment,
            timestamp: Date.now(),
          },
        });
      } catch (err) {
        logger.error("Failed to publish banner event", err);
      }
    } catch (error) {
      if (error instanceof GatrixError) throw error;
      logger.error("Failed to delete banner", { error, bannerId, environment });
      throw new GatrixError("Failed to delete banner", 500);
    }
  }

  /**
   * Publish a banner
   */
  static async publishBanner(
    bannerId: string,
    environment: string,
    updatedBy?: number,
  ): Promise<BannerAttributes> {
    try {
      const banner = await BannerModel.updateStatus(
        bannerId,
        "published",
        environment,
        updatedBy,
      );

      // Invalidate cache (including ETag cache for SDK)
      await this.invalidateCache(banner.environment);

      // Notify via PubSub
      await pubSubService.publishNotification({
        type: "banner_change",
        data: { bannerId, action: "published" },
        targetChannels: ["banner", "admin", "client"],
      });

      // Publish SDK Event
      try {
        await pubSubService.publishSDKEvent({
          type: "banner.updated",
          data: {
            id: banner.bannerId,
            environment: banner.environment,
            status: banner.status,
            timestamp: Date.now(),
          },
        });
      } catch (err) {
        logger.error("Failed to publish banner event", err);
      }

      return banner;
    } catch (error) {
      logger.error("Failed to publish banner", {
        error,
        bannerId,
        environment,
      });
      throw new GatrixError("Failed to publish banner", 500);
    }
  }

  /**
   * Archive a banner
   */
  static async archiveBanner(
    bannerId: string,
    environment: string,
    updatedBy?: number,
  ): Promise<BannerAttributes> {
    try {
      const banner = await BannerModel.updateStatus(
        bannerId,
        "archived",
        environment,
        updatedBy,
      );

      // Invalidate cache (including ETag cache for SDK)
      await this.invalidateCache(banner.environment);

      // Notify via PubSub
      await pubSubService.publishNotification({
        type: "banner_change",
        data: { bannerId, action: "archived" },
        targetChannels: ["banner", "admin", "client"],
      });

      // Publish SDK Event
      try {
        await pubSubService.publishSDKEvent({
          type: "banner.updated",
          data: {
            id: banner.bannerId,
            environment: banner.environment,
            status: banner.status,
            timestamp: Date.now(),
          },
        });
      } catch (err) {
        logger.error("Failed to publish banner event", err);
      }

      return banner;
    } catch (error) {
      logger.error("Failed to archive banner", {
        error,
        bannerId,
        environment,
      });
      throw new GatrixError("Failed to archive banner", 500);
    }
  }

  /**
   * Duplicate a banner
   */
  static async duplicateBanner(
    bannerId: string,
    environment: string,
    createdBy?: number,
  ): Promise<BannerAttributes> {
    try {
      const newBannerId = ulid();
      const banner = await BannerModel.duplicate(
        bannerId,
        newBannerId,
        environment,
        createdBy,
      );

      // Invalidate cache (including ETag cache for SDK)
      await this.invalidateCache(banner.environment);

      return banner;
    } catch (error) {
      logger.error("Failed to duplicate banner", {
        error,
        bannerId,
        environment,
      });
      throw new GatrixError("Failed to duplicate banner", 500);
    }
  }

  // ==================== Client API Methods ====================

  /**
   * Get published banners for client
   */
  static async getPublishedBanners(
    environment: string,
  ): Promise<BannerAttributes[]> {
    try {
      // Try cache first
      const cacheKey = `${CACHE_PREFIX}:published:${environment}`;
      const cached = await cacheService.get<BannerAttributes[]>(cacheKey);

      if (cached) {
        return cached;
      }

      const banners = await BannerModel.findPublished(environment);

      // Cache the result
      await cacheService.set(cacheKey, banners, CACHE_TTL);

      return banners;
    } catch (error) {
      logger.error("Failed to get published banners", { error, environment });
      throw new GatrixError("Failed to get published banners", 500);
    }
  }

  /**
   * Get published banner by ID for client
   */
  static async getPublishedBannerById(
    bannerId: string,
    environment: string,
  ): Promise<BannerAttributes> {
    try {
      const cacheKey = `${CACHE_PREFIX}:published:${bannerId}:${environment}`;
      const cached = await cacheService.get<BannerAttributes>(cacheKey);

      if (cached) {
        return cached;
      }

      const banner = await BannerModel.findById(bannerId, environment);

      if (!banner || banner.status !== "published") {
        throw new GatrixError("Banner not found", 404);
      }

      // Cache the result
      await cacheService.set(cacheKey, banner, CACHE_TTL);

      return banner;
    } catch (error) {
      if (error instanceof GatrixError) throw error;
      logger.error("Failed to get published banner", {
        error,
        bannerId,
        environment,
      });
      throw new GatrixError("Failed to get published banner", 500);
    }
  }

  /**
   * Invalidate banner cache
   */
  static async invalidateCache(environment?: string): Promise<void> {
    try {
      await cacheService.deleteByPattern(`${CACHE_PREFIX}:*`);

      // Also invalidate ETag cache for SDK
      if (environment) {
        await pubSubService.invalidateKey(
          `${SERVER_SDK_ETAG.BANNERS}:${environment}`,
        );
      } else {
        // Invalidate all banner ETag caches
        await pubSubService.invalidateByPattern(`${SERVER_SDK_ETAG.BANNERS}:*`);
      }

      logger.info("Banner cache invalidated", { environment });
    } catch (error) {
      logger.error("Failed to invalidate banner cache", { error });
    }
  }
}

export default BannerService;
