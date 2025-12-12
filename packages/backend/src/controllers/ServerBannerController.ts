import { Response } from 'express';
import { BannerModel } from '../models/Banner';
import logger from '../config/logger';
import { DEFAULT_CONFIG, SERVER_SDK_ETAG } from '../constants/cacheKeys';
import { respondWithEtagCache } from '../utils/serverSdkEtagCache';
import { EnvironmentRequest } from '../middleware/environmentResolver';

/**
 * Server SDK Banner Controller
 * Handles banner list retrieval for server-side SDK (Edge)
 */
export class ServerBannerController {
  /**
   * Get banners for a specific environment
   * GET /api/v1/server/:env/banners
   * Returns only published banners for the specified environment
   */
  static async getBanners(req: EnvironmentRequest, res: Response) {
    try {
      const environment = req.environment!;

      await respondWithEtagCache(res, {
        cacheKey: `${SERVER_SDK_ETAG.BANNERS}:${environment.id}`,
        ttlMs: DEFAULT_CONFIG.BANNER_TTL,
        requestEtag: req.headers['if-none-match'],
        buildPayload: async () => {
          const banners = await BannerModel.findPublished(environment.id);

          logger.info(`Server SDK: Retrieved ${banners.length} published banners for environment ${environment.environmentName}`);

          return {
            success: true,
            data: {
              banners,
              total: banners.length,
            },
          };
        },
      });
    } catch (error) {
      logger.error('Error in ServerBannerController.getBanners:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve banners',
        },
      });
    }
  }

  /**
   * Get specific banner by ID
   * GET /api/v1/server/:env/banners/:bannerId
   */
  static async getBannerById(req: EnvironmentRequest, res: Response) {
    try {
      const { bannerId } = req.params;

      if (!bannerId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PARAMETERS',
            message: 'Invalid banner ID',
            details: { reason: 'Banner ID is required' },
          },
        });
      }

      const banner = await BannerModel.findById(bannerId);

      if (!banner) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Banner not found',
          },
        });
      }

      // Only return published banners for server SDK
      if (banner.status !== 'published') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Banner not found',
          },
        });
      }

      logger.info(`Server SDK: Retrieved banner ${bannerId}`);

      res.json({
        success: true,
        data: {
          banner,
        },
      });
    } catch (error) {
      logger.error('Error in ServerBannerController.getBannerById:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve banner',
        },
      });
    }
  }
}

export default ServerBannerController;

