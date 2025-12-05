import { Request, Response } from 'express';
import { BannerModel } from '../models/Banner';
import logger from '../config/logger';
import { DEFAULT_CONFIG, SERVER_SDK_ETAG } from '../constants/cacheKeys';
import { respondWithEtagCache } from '../utils/serverSdkEtagCache';

export interface SDKRequest extends Request {
  apiToken?: any;
}

/**
 * Server SDK Banner Controller
 * Handles banner list retrieval for server-side SDK (Edge)
 */
export class ServerBannerController {
  /**
   * Get banners list
   * GET /api/v1/server/banners
   * GET /api/v1/server/banners?environments=env1,env2,env3
   * Returns only published banners
   */
  static async getBanners(req: SDKRequest, res: Response) {
    try {
      // Parse environments query parameter
      const environmentsParam = req.query.environments as string | undefined;
      const environments = environmentsParam
        ? environmentsParam.split(',').map(e => e.trim()).filter(Boolean)
        : [];

      await respondWithEtagCache(res, {
        cacheKey: SERVER_SDK_ETAG.BANNERS,
        ttlMs: DEFAULT_CONFIG.BANNER_TTL,
        requestEtag: req.headers['if-none-match'],
        buildPayload: async () => {
          let banners: any[] = [];

          if (environments.length > 0) {
            // Multi-environment mode: fetch from all specified environments
            for (const envId of environments) {
              const envBanners = await BannerModel.findPublished(envId);

              // Add environmentId to each banner for client grouping
              const bannersWithEnv = envBanners.map((b: any) => ({
                ...b,
                environmentId: envId,
              }));
              banners.push(...bannersWithEnv);
            }
          } else {
            // Single-environment mode: use current environment (via context)
            banners = await BannerModel.findPublished();
          }

          logger.info(
            `Server SDK: Retrieved ${banners.length} published banners`,
            { environments: environments.length > 0 ? environments : 'current' }
          );

          return {
            success: true,
            data: {
              banners: banners,
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
   * GET /api/v1/server/banners/:bannerId
   */
  static async getBannerById(req: SDKRequest, res: Response) {
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
        data: banner,
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

