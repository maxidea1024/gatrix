/**
 * Media Asset Controller
 *
 * Handles admin API endpoints for media asset management:
 * - Upload images (multipart/form-data)
 * - List/search assets with pagination
 * - Get asset details with referencing banners
 * - Force-delete assets
 */
import { Response } from 'express';
import { asyncHandler, GatrixError } from '../middleware/error-handler';
import { AuthenticatedRequest } from '../middleware/auth';
import { MediaAssetService } from '../services/media-asset-service';
import { MediaAssetModel } from '../models/media-asset';
import { createLogger } from '../config/logger';

const logger = createLogger('MediaAssetController');

export class MediaAssetController {
  /**
   * Upload a media asset
   * POST /admin/media-assets/upload
   *
   * Expects multipart/form-data with a single file field named "file".
   */
  static uploadImage = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const file = (req as any).file;

      if (!file) {
        throw new GatrixError(
          'No file uploaded. Please select a file to upload.',
          400,
          true,
          'NO_FILE'
        );
      }

      // multer memoryStorage stores the file in req.file.buffer
      const fileBuffer: Buffer = file.buffer;
      if (!fileBuffer || fileBuffer.length === 0) {
        throw new GatrixError(
          'Uploaded file is empty.',
          400,
          true,
          'EMPTY_FILE'
        );
      }

      const uploadedBy =
        req.user?.email || req.user?.name || String(req.user?.id || 'unknown');

      const result = await MediaAssetService.uploadImage(
        fileBuffer,
        file.originalname || 'unknown',
        uploadedBy
      );

      res.status(result.isDuplicate ? 200 : 201).json({
        success: true,
        data: result,
      });
    }
  );

  /**
   * List media assets with pagination, search, and filtering
   * GET /admin/media-assets
   */
  static listAssets = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = Math.min(
        parseInt(req.query.limit as string, 10) || 20,
        100
      );
      const offset = (page - 1) * limit;

      const search = (req.query.search as string) || undefined;
      const contentType = (req.query.contentType as string) || undefined;
      const refStatus =
        (req.query.refStatus as 'all' | 'referenced' | 'garbage') || 'all';
      const sortBy = (req.query.sortBy as string) || 'createdAt';
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';

      const result = await MediaAssetModel.findAll({
        limit,
        offset,
        search,
        contentType,
        refStatus,
        sortBy,
        sortOrder,
      });

      res.json({
        success: true,
        data: {
          assets: result.assets,
          total: result.total,
          page,
          limit,
        },
      });
    }
  );

  /**
   * Get a single media asset with referencing banners
   * GET /admin/media-assets/:id
   */
  static getAsset = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;

      const asset = await MediaAssetModel.findById(id);
      if (!asset) {
        throw new GatrixError('Media asset not found', 404);
      }

      // Find which banners reference this asset
      const referencingBanners = await MediaAssetService.findReferencingBanners(
        asset.cdnUrl
      );

      res.json({
        success: true,
        data: {
          asset,
          referencingBanners,
        },
      });
    }
  );

  /**
   * Force-delete a media asset (admin action)
   * DELETE /admin/media-assets/:id
   */
  static deleteAsset = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;

      const asset = await MediaAssetModel.findById(id);
      if (!asset) {
        throw new GatrixError('Media asset not found', 404);
      }

      logger.info('Force-deleting media asset via admin API', {
        id,
        storageKey: asset.storageKey,
        refCount: asset.refCount,
        userId: req.user?.id,
      });

      await MediaAssetService.forceDelete(id);

      res.json({
        success: true,
        data: { id },
      });
    }
  );

  /**
   * Bulk-delete all unreferenced media assets (refCount = 0)
   * DELETE /admin/media-assets/bulk/unreferenced
   */
  static bulkDeleteUnreferenced = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      logger.info('Bulk-deleting unreferenced media assets', {
        userId: req.user?.id,
      });

      const result = await MediaAssetService.bulkDeleteUnreferenced();

      res.json({
        success: true,
        data: result,
      });
    }
  );
}
