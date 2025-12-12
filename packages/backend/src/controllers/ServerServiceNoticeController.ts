import { Response } from 'express';
import ServiceNoticeService from '../services/ServiceNoticeService';
import logger from '../config/logger';
import { DEFAULT_CONFIG, SERVER_SDK_ETAG } from '../constants/cacheKeys';
import { respondWithEtagCache } from '../utils/serverSdkEtagCache';
import { EnvironmentRequest } from '../middleware/environmentResolver';

/**
 * Server SDK Service Notice Controller
 * Handles service notice list retrieval for server-side SDK (Edge)
 */
export class ServerServiceNoticeController {
  /**
   * Get service notices for a specific environment
   * GET /api/v1/server/:env/service-notices
   * Returns all active service notices for the specified environment
   */
  static async getServiceNotices(req: EnvironmentRequest, res: Response) {
    try {
      const environment = req.environment!;

      await respondWithEtagCache(res, {
        cacheKey: `${SERVER_SDK_ETAG.SERVICE_NOTICES}:${environment.id}`,
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

          const result = await ServiceNoticeService.getServiceNotices(
            1,
            1000,
            { isActive: true, environmentId: environment.id }
          );

          const activeNotices = filterActiveNotices(result.notices);

          logger.info(`Server SDK: Retrieved ${activeNotices.length} active service notices for environment ${environment.environmentName}`);

          return {
            success: true,
            data: {
              notices: activeNotices,
              total: activeNotices.length,
            },
          };
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
   * GET /api/v1/server/:env/service-notices/:id
   */
  static async getServiceNoticeById(req: EnvironmentRequest, res: Response) {
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

