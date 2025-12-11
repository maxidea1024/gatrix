import { Request, Response } from 'express';
import { Environment } from '../models/Environment';
import ServiceNoticeService from '../services/ServiceNoticeService';
import logger from '../config/logger';
import { DEFAULT_CONFIG, SERVER_SDK_ETAG } from '../constants/cacheKeys';
import { respondWithEtagCache } from '../utils/serverSdkEtagCache';

export interface SDKRequest extends Request {
  apiToken?: any;
}

/**
 * Server SDK Service Notice Controller
 * Handles service notice list retrieval for server-side SDK (Edge)
 */
export class ServerServiceNoticeController {
  /**
   * Get service notices list
   * GET /api/v1/server/service-notices
   * GET /api/v1/server/service-notices?environments=env1,env2,env3
   * Returns all active service notices
   */
  static async getServiceNotices(req: SDKRequest, res: Response) {
    try {
      // Parse environments query parameter
      const environmentsParam = req.query.environments as string | undefined;
      const environments = environmentsParam
        ? environmentsParam.split(',').map(e => e.trim()).filter(Boolean)
        : [];

      await respondWithEtagCache(res, {
        cacheKey: SERVER_SDK_ETAG.SERVICE_NOTICES,
        ttlMs: DEFAULT_CONFIG.SERVICE_NOTICE_TTL,
        requestEtag: req.headers['if-none-match'],
        buildPayload: async () => {
          // Helper function to filter active notices by time window
          const filterActiveNotices = (notices: any[]) => {
            const now = new Date();
            return notices.filter((notice: any) => {
              if (notice.startDate) {
                const startDate = new Date(notice.startDate);
                if (now < startDate) return false;
              }
              if (notice.endDate) {
                const endDate = new Date(notice.endDate);
                if (now > endDate) return false;
              }
              return true;
            });
          };

          if (environments.length > 0) {
            // Multi-environment mode: return data grouped by environment
            const byEnvironment: Record<string, any[]> = {};
            let totalCount = 0;

            for (const envParam of environments) {
              // Try to find environment by ID or Name
              let env = await Environment.query().findById(envParam);
              if (!env) {
                env = await Environment.getByName(envParam);
              }

              if (env) {
                const result = await ServiceNoticeService.getServiceNotices(
                  1,
                  1000,
                  { environmentId: env.id, isActive: true }
                );

                const activeNotices = filterActiveNotices(result.notices);
                // Store by environmentName (the standard external identifier)
                byEnvironment[env.environmentName] = activeNotices;
                totalCount += activeNotices.length;
              } else {
                logger.warn(`Server SDK: Environment not found for param '${envParam}'`);
              }
            }

            logger.info(
              `Server SDK: Retrieved ${totalCount} active service notices across ${Object.keys(byEnvironment).length} environments`,
              { environments }
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
            const result = await ServiceNoticeService.getServiceNotices(
              1,
              1000,
              { isActive: true }
            );

            const activeNotices = filterActiveNotices(result.notices);

            logger.info(`Server SDK: Retrieved ${activeNotices.length} active service notices`);

            return {
              success: true,
              data: {
                notices: activeNotices,
                total: activeNotices.length,
              },
            };
          }
        },
      });
    } catch (error) {
      logger.error('Error in ServerServiceNoticeController.getServiceNotices:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve service notices',
        },
      });
    }
  }

  /**
   * Get specific service notice by ID
   * GET /api/v1/server/service-notices/:id
   */
  static async getServiceNoticeById(req: SDKRequest, res: Response) {
    try {
      const { id } = req.params;
      const noticeId = parseInt(id);

      if (isNaN(noticeId)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PARAMETERS',
            message: 'Invalid service notice ID',
            details: { reason: 'ID must be a valid number' },
          },
        });
      }

      const notice = await ServiceNoticeService.getServiceNoticeById(noticeId);

      if (!notice) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Service notice not found',
          },
        });
      }

      logger.info(`Server SDK: Retrieved service notice ${noticeId}`);

      res.json({
        success: true,
        data: notice,
      });
    } catch (error) {
      logger.error('Error in ServerServiceNoticeController.getServiceNoticeById:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve service notice',
        },
      });
    }
  }
}

export default ServerServiceNoticeController;

