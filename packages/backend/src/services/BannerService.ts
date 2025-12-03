import { ulid } from 'ulid';
import { BannerModel, BannerAttributes, BannerFilters, BannerStatus, Sequence } from '../models/Banner';
import { GatrixError } from '../middleware/errorHandler';
import logger from '../config/logger';
import { cacheService } from './CacheService';
import { pubSubService } from './PubSubService';

const CACHE_PREFIX = 'banners';
const CACHE_TTL = 300; // 5 minutes

export interface CreateBannerInput {
  name: string;
  description?: string;
  width: number;
  height: number;
  metadata?: Record<string, any>;
  playbackSpeed?: number;
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
  sequences?: Sequence[];
  updatedBy?: number;
}

export interface GetBannersParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: BannerStatus | BannerStatus[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
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
  static async getBanners(params?: GetBannersParams): Promise<GetBannersResponse> {
    const page = params?.page || 1;
    const limit = params?.limit || 10;
    const offset = (page - 1) * limit;

    try {
      const filters: BannerFilters = {
        search: params?.search,
        status: params?.status,
        limit,
        offset,
        sortBy: params?.sortBy || 'createdAt',
        sortOrder: (params?.sortOrder?.toUpperCase() as 'ASC' | 'DESC') || 'DESC',
      };

      const result = await BannerModel.findAll(filters);

      return {
        banners: result.banners,
        total: result.total,
        page,
        limit,
      };
    } catch (error) {
      logger.error('Failed to get banners', { error });
      throw new GatrixError('Failed to get banners', 500);
    }
  }

  /**
   * Get banner by ID
   */
  static async getBannerById(bannerId: string): Promise<BannerAttributes> {
    try {
      const banner = await BannerModel.findById(bannerId);

      if (!banner) {
        throw new GatrixError('Banner not found', 404);
      }

      return banner;
    } catch (error) {
      if (error instanceof GatrixError) throw error;
      logger.error('Failed to get banner', { error, bannerId });
      throw new GatrixError('Failed to get banner', 500);
    }
  }

  /**
   * Create a new banner
   */
  static async createBanner(input: CreateBannerInput): Promise<BannerAttributes> {
    // Validate name format (identifier style)
    if (!this.isValidBannerName(input.name)) {
      throw new GatrixError('Banner name must be a valid identifier (lowercase letters, numbers, underscore, hyphen, starting with a letter)', 400, 'INVALID_NAME_FORMAT');
    }

    // Check for duplicate name
    const existing = await BannerModel.findByName(input.name);
    if (existing) {
      throw new GatrixError('A banner with this name already exists', 409, 'DUPLICATE_NAME');
    }

    try {
      const bannerId = ulid();

      const banner = await BannerModel.create({
        bannerId,
        name: input.name,
        description: input.description,
        width: input.width || 1024,
        height: input.height || 512,
        metadata: input.metadata,
        playbackSpeed: input.playbackSpeed || 1.0,
        sequences: input.sequences || [],
        version: 1,
        status: 'draft',
        createdBy: input.createdBy,
        updatedBy: input.createdBy,
      });

      return banner;
    } catch (error) {
      logger.error('Failed to create banner', { error, input });
      throw new GatrixError('Failed to create banner', 500);
    }
  }

  /**
   * Update a banner
   */
  static async updateBanner(bannerId: string, input: UpdateBannerInput): Promise<BannerAttributes> {
    // If name is being updated, validate format and check for duplicates
    if (input.name) {
      if (!this.isValidBannerName(input.name)) {
        throw new GatrixError('Banner name must be a valid identifier (lowercase letters, numbers, underscore, hyphen, starting with a letter)', 400, 'INVALID_NAME_FORMAT');
      }

      const existing = await BannerModel.findByName(input.name, bannerId);
      if (existing) {
        throw new GatrixError('A banner with this name already exists', 409, 'DUPLICATE_NAME');
      }
    }

    try {
      // Check if banner exists
      await this.getBannerById(bannerId);

      const banner = await BannerModel.update(bannerId, input);

      // Invalidate cache
      await this.invalidateCache();

      // Notify via PubSub
      await pubSubService.publishNotification({
        type: 'banner_change',
        data: { bannerId, action: 'updated' },
        targetChannels: ['banner', 'admin']
      });

      return banner;
    } catch (error) {
      if (error instanceof GatrixError) throw error;
      logger.error('Failed to update banner', { error, bannerId, input });
      throw new GatrixError('Failed to update banner', 500);
    }
  }

  /**
   * Delete a banner
   */
  static async deleteBanner(bannerId: string): Promise<void> {
    try {
      // Check if banner exists
      await this.getBannerById(bannerId);

      await BannerModel.delete(bannerId);

      // Invalidate cache
      await this.invalidateCache();

      // Notify via PubSub
      await pubSubService.publishNotification({
        type: 'banner_change',
        data: { bannerId, action: 'deleted' },
        targetChannels: ['banner', 'admin']
      });
    } catch (error) {
      if (error instanceof GatrixError) throw error;
      logger.error('Failed to delete banner', { error, bannerId });
      throw new GatrixError('Failed to delete banner', 500);
    }
  }

  /**
   * Publish a banner
   */
  static async publishBanner(bannerId: string, updatedBy?: number): Promise<BannerAttributes> {
    try {
      const banner = await BannerModel.updateStatus(bannerId, 'published', updatedBy);

      // Invalidate cache
      await this.invalidateCache();

      // Notify via PubSub
      await pubSubService.publishNotification({
        type: 'banner_change',
        data: { bannerId, action: 'published' },
        targetChannels: ['banner', 'admin', 'client']
      });

      return banner;
    } catch (error) {
      logger.error('Failed to publish banner', { error, bannerId });
      throw new GatrixError('Failed to publish banner', 500);
    }
  }

  /**
   * Archive a banner
   */
  static async archiveBanner(bannerId: string, updatedBy?: number): Promise<BannerAttributes> {
    try {
      const banner = await BannerModel.updateStatus(bannerId, 'archived', updatedBy);

      // Invalidate cache
      await this.invalidateCache();

      // Notify via PubSub
      await pubSubService.publishNotification({
        type: 'banner_change',
        data: { bannerId, action: 'archived' },
        targetChannels: ['banner', 'admin', 'client']
      });

      return banner;
    } catch (error) {
      logger.error('Failed to archive banner', { error, bannerId });
      throw new GatrixError('Failed to archive banner', 500);
    }
  }

  /**
   * Duplicate a banner
   */
  static async duplicateBanner(bannerId: string, createdBy?: number): Promise<BannerAttributes> {
    try {
      const newBannerId = ulid();
      const banner = await BannerModel.duplicate(bannerId, newBannerId, createdBy);

      return banner;
    } catch (error) {
      logger.error('Failed to duplicate banner', { error, bannerId });
      throw new GatrixError('Failed to duplicate banner', 500);
    }
  }

  // ==================== Client API Methods ====================

  /**
   * Get published banners for client
   */
  static async getPublishedBanners(): Promise<BannerAttributes[]> {
    try {
      // Try cache first
      const cacheKey = `${CACHE_PREFIX}:published`;
      const cached = await cacheService.get<BannerAttributes[]>(cacheKey);

      if (cached) {
        return cached;
      }

      const banners = await BannerModel.findPublished();

      // Cache the result
      await cacheService.set(cacheKey, banners, CACHE_TTL);

      return banners;
    } catch (error) {
      logger.error('Failed to get published banners', { error });
      throw new GatrixError('Failed to get published banners', 500);
    }
  }

  /**
   * Get published banner by ID for client
   */
  static async getPublishedBannerById(bannerId: string): Promise<BannerAttributes> {
    try {
      const cacheKey = `${CACHE_PREFIX}:published:${bannerId}`;
      const cached = await cacheService.get<BannerAttributes>(cacheKey);

      if (cached) {
        return cached;
      }

      const banner = await BannerModel.findById(bannerId);

      if (!banner || banner.status !== 'published') {
        throw new GatrixError('Banner not found', 404);
      }

      // Cache the result
      await cacheService.set(cacheKey, banner, CACHE_TTL);

      return banner;
    } catch (error) {
      if (error instanceof GatrixError) throw error;
      logger.error('Failed to get published banner', { error, bannerId });
      throw new GatrixError('Failed to get published banner', 500);
    }
  }

  /**
   * Invalidate banner cache
   */
  static async invalidateCache(): Promise<void> {
    try {
      await cacheService.deleteByPattern(`${CACHE_PREFIX}:*`);
      logger.info('Banner cache invalidated');
    } catch (error) {
      logger.error('Failed to invalidate banner cache', { error });
    }
  }
}

export default BannerService;

