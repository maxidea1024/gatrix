import db from '../config/knex';
import { createLogger } from '../config/logger';

const logger = createLogger('MediaAsset');

export interface MediaAssetAttributes {
  id: string;
  hash: string;
  storageKey: string;
  cdnUrl: string;
  fileName: string;
  contentType: string;
  size: number;
  width?: number | null;
  height?: number | null;
  refCount: number;
  gcEligibleAt?: Date | string | null;
  uploadedBy?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateMediaAssetInput {
  id: string;
  hash: string;
  storageKey: string;
  cdnUrl: string;
  fileName: string;
  contentType: string;
  size: number;
  width?: number | null;
  height?: number | null;
  uploadedBy?: string | null;
}

const TABLE = 'g_media_assets';

export class MediaAssetModel {
  /**
   * Find a media asset by its content hash (SHA-256)
   */
  static async findByHash(hash: string): Promise<MediaAssetAttributes | null> {
    try {
      const row = await db(TABLE).where({ hash }).first();
      return row || null;
    } catch (error) {
      logger.error('Failed to find media asset by hash', { error, hash });
      throw error;
    }
  }

  /**
   * Find a media asset by ID
   */
  static async findById(id: string): Promise<MediaAssetAttributes | null> {
    try {
      const row = await db(TABLE).where({ id }).first();
      return row || null;
    } catch (error) {
      logger.error('Failed to find media asset by id', { error, id });
      throw error;
    }
  }

  /**
   * Find a media asset by its CDN URL
   */
  static async findByCdnUrl(
    cdnUrl: string
  ): Promise<MediaAssetAttributes | null> {
    try {
      const row = await db(TABLE).where({ cdnUrl }).first();
      return row || null;
    } catch (error) {
      logger.error('Failed to find media asset by cdnUrl', { error, cdnUrl });
      throw error;
    }
  }

  /**
   * Create a new media asset record
   */
  static async create(
    input: CreateMediaAssetInput
  ): Promise<MediaAssetAttributes> {
    try {
      await db(TABLE).insert({
        id: input.id,
        hash: input.hash,
        storageKey: input.storageKey,
        cdnUrl: input.cdnUrl,
        fileName: input.fileName,
        contentType: input.contentType,
        size: input.size,
        width: input.width ?? null,
        height: input.height ?? null,
        refCount: 0,
        gcEligibleAt: null,
        uploadedBy: input.uploadedBy ?? null,
      });

      const asset = await this.findById(input.id);
      if (!asset) {
        throw new Error(
          `Media asset not found after creation: ${input.id}`
        );
      }
      return asset;
    } catch (error) {
      logger.error('Failed to create media asset', { error, input });
      throw error;
    }
  }

  /**
   * Increment the reference count for a media asset.
   * Clears gcEligibleAt since the asset is now actively referenced.
   */
  static async incrementRef(id: string): Promise<void> {
    try {
      const updated = await db(TABLE)
        .where({ id })
        .update({
          refCount: db.raw('refCount + 1'),
          gcEligibleAt: null,
        });

      if (updated === 0) {
        logger.warn('incrementRef: media asset not found', { id });
      }
    } catch (error) {
      logger.error('Failed to increment ref count', { error, id });
      throw error;
    }
  }

  /**
   * Decrement the reference count for a media asset.
   * Sets gcEligibleAt when refCount drops to 0.
   *
   * @param gracePeriodHours - hours before GC eligibility (default: 24)
   */
  static async decrementRef(
    id: string,
    gracePeriodHours: number = 24
  ): Promise<void> {
    try {
      // First decrement (floor at 0)
      await db(TABLE)
        .where({ id })
        .where('refCount', '>', 0)
        .update({
          refCount: db.raw('refCount - 1'),
        });

      // Then set gcEligibleAt if refCount is now 0
      await db(TABLE)
        .where({ id, refCount: 0 })
        .whereNull('gcEligibleAt')
        .update({
          gcEligibleAt: db.raw(
            `DATE_ADD(NOW(), INTERVAL ${Number(gracePeriodHours)} HOUR)`
          ),
        });
    } catch (error) {
      logger.error('Failed to decrement ref count', { error, id });
      throw error;
    }
  }

  /**
   * Find all media assets eligible for garbage collection.
   * Assets with refCount=0 and gcEligibleAt in the past.
   */
  static async findGarbageAssets(): Promise<MediaAssetAttributes[]> {
    try {
      const rows = await db(TABLE)
        .where({ refCount: 0 })
        .whereNotNull('gcEligibleAt')
        .where('gcEligibleAt', '<=', db.fn.now())
        .orderBy('gcEligibleAt', 'asc')
        .limit(500); // Process in batches to avoid OOM

      return rows;
    } catch (error) {
      logger.error('Failed to find garbage assets', { error });
      throw error;
    }
  }

  /**
   * Delete a media asset record by ID
   */
  static async delete(id: string): Promise<void> {
    try {
      await db(TABLE).where({ id }).delete();
    } catch (error) {
      logger.error('Failed to delete media asset', { error, id });
      throw error;
    }
  }

  /**
   * List media assets with pagination and filtering
   */
  static async findAll(params: {
    limit: number;
    offset: number;
    search?: string;
    contentType?: string;
    refStatus?: 'all' | 'referenced' | 'garbage';
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ assets: MediaAssetAttributes[]; total: number }> {
    try {
      let query = db(TABLE);
      let countQuery = db(TABLE);

      // Search filter (fileName, cdnUrl, hash)
      if (params.search) {
        const searchTerm = `%${params.search}%`;
        const searchCondition = function (this: any) {
          this.where('fileName', 'like', searchTerm)
            .orWhere('cdnUrl', 'like', searchTerm)
            .orWhere('hash', 'like', searchTerm);
        };
        query = query.where(searchCondition);
        countQuery = countQuery.where(searchCondition);
      }

      // Content type filter
      if (params.contentType) {
        query = query.where('contentType', params.contentType);
        countQuery = countQuery.where('contentType', params.contentType);
      }

      // Reference status filter
      if (params.refStatus === 'referenced') {
        query = query.where('refCount', '>', 0);
        countQuery = countQuery.where('refCount', '>', 0);
      } else if (params.refStatus === 'garbage') {
        query = query.where('refCount', 0);
        countQuery = countQuery.where('refCount', 0);
      }

      // Count
      const [{ count }] = await countQuery.count('* as count');
      const total = Number(count);

      // Sort
      const sortBy = params.sortBy || 'createdAt';
      const sortOrder = params.sortOrder || 'desc';
      const allowedSortColumns = [
        'createdAt',
        'size',
        'refCount',
        'fileName',
        'contentType',
      ];
      const safeSortBy = allowedSortColumns.includes(sortBy)
        ? sortBy
        : 'createdAt';

      const assets = await query
        .orderBy(safeSortBy, sortOrder)
        .limit(params.limit)
        .offset(params.offset);

      return { assets, total };
    } catch (error) {
      logger.error('Failed to list media assets', { error, params });
      throw error;
    }
  }
}
