import { Response, NextFunction } from 'express';
import Joi from 'joi';
import IngamePopupNoticeService, {
  CreateIngamePopupNoticeData,
  UpdateIngamePopupNoticeData,
  IngamePopupNoticeFilters
} from '../services/IngamePopupNoticeService';
import { pubSubService } from '../services/PubSubService';
import { DEFAULT_CONFIG, SERVER_SDK_ETAG } from '../constants/cacheKeys';
import { respondWithEtagCache } from '../utils/serverSdkEtagCache';
import { EnvironmentRequest } from '../middleware/environmentResolver';
import { AuthenticatedRequest } from '../types/auth';
import { GatrixError } from '../middleware/errorHandler';
import {
  sendBadRequest,
  sendNotFound,
  sendUnauthorized,
  sendSuccessResponse,
  ErrorCodes,
} from '../utils/apiResponse';

// Validation schemas
const createIngamePopupNoticeSchema = Joi.object({
  isActive: Joi.boolean().required(),
  content: Joi.string().min(1).required(),
  targetWorlds: Joi.array().items(Joi.string()).optional().allow(null),
  targetWorldsInverted: Joi.boolean().optional().default(false),
  targetPlatforms: Joi.array().items(Joi.string()).optional().allow(null),
  targetPlatformsInverted: Joi.boolean().optional().default(false),
  targetChannels: Joi.array().items(Joi.string()).optional().allow(null),
  targetChannelsInverted: Joi.boolean().optional().default(false),
  targetSubchannels: Joi.array().items(Joi.string()).optional().allow(null),
  targetSubchannelsInverted: Joi.boolean().optional().default(false),
  targetUserIds: Joi.string().optional().allow(null, ''),
  targetUserIdsInverted: Joi.boolean().optional().default(false),
  displayPriority: Joi.number().integer().min(0).optional(),
  showOnce: Joi.boolean().optional(),
  startDate: Joi.string().isoDate().optional().allow(null, ''),
  endDate: Joi.string().isoDate().optional().allow(null, ''),
  messageTemplateId: Joi.number().integer().positive().optional().allow(null),
  useTemplate: Joi.boolean().optional(),
  description: Joi.string().max(1000).optional().allow(null, ''),
});

const updateIngamePopupNoticeSchema = Joi.object({
  isActive: Joi.boolean().optional(),
  content: Joi.string().min(1).optional(),
  targetWorlds: Joi.array().items(Joi.string()).optional().allow(null),
  targetWorldsInverted: Joi.boolean().optional(),
  targetPlatforms: Joi.array().items(Joi.string()).optional().allow(null),
  targetPlatformsInverted: Joi.boolean().optional(),
  targetChannels: Joi.array().items(Joi.string()).optional().allow(null),
  targetChannelsInverted: Joi.boolean().optional(),
  targetSubchannels: Joi.array().items(Joi.string()).optional().allow(null),
  targetSubchannelsInverted: Joi.boolean().optional(),
  targetUserIds: Joi.string().optional().allow(null, ''),
  targetUserIdsInverted: Joi.boolean().optional(),
  displayPriority: Joi.number().integer().min(0).optional(),
  showOnce: Joi.boolean().optional(),
  startDate: Joi.string().isoDate().optional().allow(null, ''),
  endDate: Joi.string().isoDate().optional().allow(null, ''),
  messageTemplateId: Joi.number().integer().positive().optional().allow(null),
  useTemplate: Joi.boolean().optional(),
  description: Joi.string().max(1000).optional().allow(null, ''),
});

class IngamePopupNoticeController {
  /**
   * Get ingame popup notices with pagination and filters
   * GET /api/v1/admin/ingame-popup-notices
   */
  async getIngamePopupNotices(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const environment = req.environment;

      if (!environment) {
        throw new GatrixError('Environment is required', 400);
      }

      const filters: IngamePopupNoticeFilters = { environment };

      if (req.query.isActive !== undefined) {
        filters.isActive = req.query.isActive === 'true';
      }

      if (req.query.currentlyVisible !== undefined) {
        filters.currentlyVisible = req.query.currentlyVisible === 'true';
      }

      if (req.query.world) {
        filters.world = req.query.world as string;
      }

      if (req.query.market) {
        filters.market = req.query.market as string;
      }

      if (req.query.platform) {
        const platformParam = req.query.platform as string;
        filters.platform = platformParam.includes(',') ? platformParam.split(',') : platformParam;
      }

      if (req.query.platformOperator) {
        filters.platformOperator = req.query.platformOperator as 'any_of' | 'include_all';
      }

      if (req.query.clientVersion) {
        filters.clientVersion = req.query.clientVersion as string;
      }

      if (req.query.accountId) {
        filters.accountId = req.query.accountId as string;
      }

      if (req.query.search) {
        filters.search = req.query.search as string;
      }

      const result = await IngamePopupNoticeService.getIngamePopupNotices(page, limit, filters);

      return sendSuccessResponse(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get ingame popup notice by ID
   * GET /api/v1/admin/ingame-popup-notices/:id
   */
  async getIngamePopupNoticeById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const environment = req.environment;

      if (!environment) {
        throw new GatrixError('Environment is required', 400);
      }

      const notice = await IngamePopupNoticeService.getIngamePopupNoticeById(id, environment);

      if (!notice) {
        return sendNotFound(res, 'Ingame popup notice not found', ErrorCodes.RESOURCE_NOT_FOUND);
      }

      return sendSuccessResponse(res, { notice });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create ingame popup notice
   * POST /api/v1/admin/ingame-popup-notices
   */
  async createIngamePopupNotice(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const environment = req.environment;

      if (!environment) {
        throw new GatrixError('Environment is required', 400);
      }

      const { error, value } = createIngamePopupNoticeSchema.validate(req.body);

      if (error) {
        return sendBadRequest(res, error.details[0].message, { validation: error.details });
      }

      const data: CreateIngamePopupNoticeData = value;
      const createdBy = req.user?.userId;

      if (!createdBy) {
        return sendUnauthorized(res, 'Unauthorized', ErrorCodes.UNAUTHORIZED);
      }

      const notice = await IngamePopupNoticeService.createIngamePopupNotice(data, createdBy, environment);

      // Publish event for SDK real-time updates
      await pubSubService.publishNotification({
        type: 'popup.created',
        data: { notice },
        targetChannels: ['popup', 'admin'],
      });

      await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.POPUP_NOTICES}:${environment}`);

      return sendSuccessResponse(res, { notice }, 'Ingame popup notice created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update ingame popup notice
   * PUT /api/v1/admin/ingame-popup-notices/:id
   */
  async updateIngamePopupNotice(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const environment = req.environment;

      if (!environment) {
        throw new GatrixError('Environment is required', 400);
      }

      const { error, value } = updateIngamePopupNoticeSchema.validate(req.body);

      if (error) {
        return sendBadRequest(res, error.details[0].message, { validation: error.details });
      }

      const data: UpdateIngamePopupNoticeData = value;
      const updatedBy = req.user?.userId;

      if (!updatedBy) {
        return sendUnauthorized(res, 'Unauthorized', ErrorCodes.UNAUTHORIZED);
      }

      const notice = await IngamePopupNoticeService.updateIngamePopupNotice(id, data, updatedBy, environment);

      // Publish event for SDK real-time updates
      await pubSubService.publishNotification({
        type: 'popup.updated',
        data: { notice },
        targetChannels: ['popup', 'admin'],
      });

      await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.POPUP_NOTICES}:${environment}`);

      return sendSuccessResponse(res, { notice }, 'Ingame popup notice updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete ingame popup notice
   * DELETE /api/v1/admin/ingame-popup-notices/:id
   */
  async deleteIngamePopupNotice(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const environment = req.environment;

      if (!environment) {
        throw new GatrixError('Environment is required', 400);
      }

      await IngamePopupNoticeService.deleteIngamePopupNotice(id, environment);

      // Publish event for SDK real-time updates
      await pubSubService.publishNotification({
        type: 'popup.deleted',
        data: { noticeId: id },
        targetChannels: ['popup', 'admin'],
      });

      await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.POPUP_NOTICES}:${environment}`);

      return sendSuccessResponse(res, undefined, 'Ingame popup notice deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete multiple ingame popup notices
   * POST /api/v1/admin/ingame-popup-notices/bulk-delete
   */
  async deleteMultipleIngamePopupNotices(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { ids } = req.body;
      const environment = req.environment;

      if (!environment) {
        throw new GatrixError('Environment is required', 400);
      }

      if (!Array.isArray(ids) || ids.length === 0) {
        return sendBadRequest(res, 'Invalid or empty ids array', { field: 'ids' });
      }

      await IngamePopupNoticeService.deleteMultipleIngamePopupNotices(ids, environment);

      await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.POPUP_NOTICES}:${environment}`);

      return sendSuccessResponse(res, undefined, `${ids.length} ingame popup notice(s) deleted successfully`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Toggle active status
   * PATCH /api/v1/admin/ingame-popup-notices/:id/toggle-active
   */
  async toggleActive(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const environment = req.environment;

      if (!environment) {
        throw new GatrixError('Environment is required', 400);
      }

      const notice = await IngamePopupNoticeService.toggleActive(id, environment);

      await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.POPUP_NOTICES}:${environment}`);

      return sendSuccessResponse(res, { notice }, 'Ingame popup notice status toggled successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get active ingame popup notices for Server SDK
   * GET /api/v1/server/:env/ingame-popup-notices
   * Returns only active notices that are currently visible and not expired
   */
  async getServerIngamePopupNotices(req: EnvironmentRequest, res: Response, next: NextFunction) {
    try {
      const environment = req.environment!;
      const filters: IngamePopupNoticeFilters = {
        environment,
        isActive: true,
        currentlyVisible: true,
      };

      await respondWithEtagCache(res, {
        cacheKey: `${SERVER_SDK_ETAG.POPUP_NOTICES}:${environment}`,
        ttlMs: DEFAULT_CONFIG.POPUP_NOTICE_TTL,
        requestEtag: req.headers['if-none-match'],
        buildPayload: async () => {
          const result = await IngamePopupNoticeService.getIngamePopupNotices(1, 1000, filters);

          // Filter out notices where endDate is in the past
          const now = new Date();
          const activeNotices = result.notices.filter((notice) => {
            if (!notice.endDate) return true;
            const endDate = new Date(notice.endDate);
            return endDate > now;
          });

          // Format notices for Server SDK response
          const formattedNotices = activeNotices.map((notice) =>
            IngamePopupNoticeService.formatNoticeForServerSDK(notice as any),
          );

          return {
            success: true,
            data: formattedNotices,
          };
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get ingame popup notice by ID for Server SDK
   * GET /api/v1/server/:env/ingame-popup-notices/:id
   * Returns notice formatted for Server SDK
   */
  async getServerIngamePopupNoticeById(req: EnvironmentRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const environment = req.environment!;
      const notice = await IngamePopupNoticeService.getIngamePopupNoticeById(id, environment);

      if (!notice) {
        return sendNotFound(res, 'Ingame popup notice not found', ErrorCodes.RESOURCE_NOT_FOUND);
      }

      // Format notice for Server SDK response
      const formattedNotice = IngamePopupNoticeService.formatNoticeForServerSDK(notice);

      return sendSuccessResponse(res, { notice: formattedNotice });
    } catch (error) {
      next(error);
    }
  }
}

export default new IngamePopupNoticeController();
