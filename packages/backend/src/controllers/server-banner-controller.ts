import { Response } from 'express';
import { BannerModel } from '../models/banner';
import { DEFAULT_CONFIG, SERVER_SDK_ETAG } from '../constants/cache-keys';
import { respondWithEtagCache } from '../utils/server-sdk-etag-cache';
import { EnvironmentRequest } from '../middleware/environment-resolver';

import { createLogger } from '../config/logger';
const logger = createLogger('ServerBannerController');

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
      const environmentId = req.environmentId;

      if (!environmentId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_ENVIRONMENT',
            message: 'Environment is required',
          },
        });
      }

      await respondWithEtagCache(res, {
        cacheKey: `${SERVER_SDK_ETAG.BANNERS}:${environmentId}`,
        ttlMs: DEFAULT_CONFIG.BANNER_TTL,
        requestEtag: req.headers['if-none-match'],
        buildPayload: async () => {
          const banners = await BannerModel.findPublished(environmentId);

          logger.info(
            `Server SDK: Retrieved ${banners.length} published banners for environmentId ${environmentId}`
          );

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
      const environmentId = req.environmentId;

      if (!environmentId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_ENVIRONMENT',
            message: 'Environment is required',
          },
        });
      }

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

      const banner = await BannerModel.findById(bannerId, environmentId);

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

      logger.info(`Server SDK: Retrieved banner ${bannerId} for environmentId ${environmentId}`);

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
