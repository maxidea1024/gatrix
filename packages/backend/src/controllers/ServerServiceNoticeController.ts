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
      // '*' means all environments
      const environmentsParam = req.query.environments as string | undefined;
      const isAllEnvironments = environmentsParam === '*';
      const environments = environmentsParam && !isAllEnvironments
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
              const result = await ServiceNoticeService.getServiceNotices(
                1,
                1000,
                { environmentId: env.id, isActive: true }
              );

              const activeNotices = filterActiveNotices(result.notices);
              byEnvironment[env.environmentName] = activeNotices;
              totalCount += activeNotices.length;
            }

            logger.info(
              `Server SDK: Retrieved ${totalCount} active service notices across ${Object.keys(byEnvironment).length} environments`,
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
            // Use X-Environment header to determine environment (required for Server SDK)
            const envHeader = req.headers['x-environment'] as string | undefined;
            if (!envHeader) {
              return res.status(400).json({
                success: false,
                error: {
                  code: 'MISSING_ENVIRONMENT',
                  message: 'X-Environment header is required for single-environment mode',
                },
              });
            }

            // Resolve environment by name or ID
            let targetEnv = await Environment.query().findById(envHeader);
            if (!targetEnv) {
              targetEnv = await Environment.getByName(envHeader);
            }
            if (!targetEnv) {
              return res.status(400).json({
                success: false,
                error: {
                  code: 'INVALID_ENVIRONMENT',
                  message: `Environment '${envHeader}' not found`,
                },
              });
            }

            const result = await ServiceNoticeService.getServiceNotices(
              1,
              1000,
              { isActive: true, environmentId: targetEnv.id }
            );

            const activeNotices = filterActiveNotices(result.notices);

            logger.info(`Server SDK: Retrieved ${activeNotices.length} active service notices for environment ${targetEnv.environmentName}`);

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

