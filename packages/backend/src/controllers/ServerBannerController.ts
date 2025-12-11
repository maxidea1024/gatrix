import { Request, Response } from 'express';
import { Environment } from '../models/Environment';
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
      // '*' means all environments
      const environmentsParam = req.query.environments as string | undefined;
      const isAllEnvironments = environmentsParam === '*';
      const environments = environmentsParam && !isAllEnvironments
        ? environmentsParam.split(',').map(e => e.trim()).filter(Boolean)
        : [];

      await respondWithEtagCache(res, {
        cacheKey: SERVER_SDK_ETAG.BANNERS,
        ttlMs: DEFAULT_CONFIG.BANNER_TTL,
        requestEtag: req.headers['if-none-match'],
        buildPayload: async () => {
          // All environments mode or specific environments mode
          if (isAllEnvironments || environments.length > 0) {
            const byEnvironment: Record<string, any[]> = {};
            let totalCount = 0;

            // Get target environments
            let targetEnvs: any[];
            if (isAllEnvironments) {
              targetEnvs = await Environment.query().where('isActive', true);
            } else {
              targetEnvs = [];
              for (const envParam of environments) {
                let env = await Environment.query().findById(envParam);
                if (!env) {
                  env = await Environment.getByName(envParam);
                }
                if (env) {
                  targetEnvs.push(env);
                } else {
                  logger.warn(`Server SDK: Environment not found for param '${envParam}'`);
                }
              }
            }

            for (const env of targetEnvs) {
              const envBanners = await BannerModel.findPublished(env.id);
              byEnvironment[env.environmentName] = envBanners;
              totalCount += envBanners.length;
            }

            logger.info(
              `Server SDK: Retrieved ${totalCount} published banners across ${Object.keys(byEnvironment).length} environments`,
              { mode: isAllEnvironments ? 'all' : 'specific', environments: Object.keys(byEnvironment) }
            );

            return {
              success: true,
              data: {
                byEnvironment,
                total: totalCount,
              },
            };
          } else {
            // Single-environment mode: return flat array
            const banners = await BannerModel.findPublished();

            logger.info(`Server SDK: Retrieved ${banners.length} published banners`);

            return {
              success: true,
              data: {
                banners,
                total: banners.length,
              },
            };
          }
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

