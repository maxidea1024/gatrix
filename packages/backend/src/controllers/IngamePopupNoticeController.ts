import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import IngamePopupNoticeService, {
  CreateIngamePopupNoticeData,
  UpdateIngamePopupNoticeData,
  IngamePopupNoticeFilters
} from '../services/IngamePopupNoticeService';

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
  endDate: Joi.string().isoDate().optional(),
  messageTemplateId: Joi.number().integer().positive().optional().allow(null),
  useTemplate: Joi.boolean().optional(),
  description: Joi.string().max(1000).optional().allow(null, ''),
});

class IngamePopupNoticeController {
  /**
   * Get ingame popup notices with pagination and filters
   * GET /api/v1/admin/ingame-popup-notices
   */
  async getIngamePopupNotices(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const filters: IngamePopupNoticeFilters = {};

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

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get ingame popup notice by ID
   * GET /api/v1/admin/ingame-popup-notices/:id
   */
  async getIngamePopupNoticeById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const notice = await IngamePopupNoticeService.getIngamePopupNoticeById(id);

      if (!notice) {
        return res.status(404).json({
          success: false,
          error: { message: 'Ingame popup notice not found' }
        });
      }

      res.json({
        success: true,
        notice
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create ingame popup notice
   * POST /api/v1/admin/ingame-popup-notices
   */
  async createIngamePopupNotice(req: Request, res: Response, next: NextFunction) {
    try {
      const { error, value } = createIngamePopupNoticeSchema.validate(req.body);

      if (error) {
        return res.status(400).json({
          success: false,
          error: { message: error.details[0].message }
        });
      }

      const data: CreateIngamePopupNoticeData = value;
      const createdBy = (req as any).user?.userId;

      if (!createdBy) {
        return res.status(401).json({
          success: false,
          error: { message: 'Unauthorized' }
        });
      }

      const notice = await IngamePopupNoticeService.createIngamePopupNotice(data, createdBy);

      res.status(201).json({
        success: true,
        notice
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update ingame popup notice
   * PUT /api/v1/admin/ingame-popup-notices/:id
   */
  async updateIngamePopupNotice(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const { error, value } = updateIngamePopupNoticeSchema.validate(req.body);

      if (error) {
        return res.status(400).json({
          success: false,
          error: { message: error.details[0].message }
        });
      }

      const data: UpdateIngamePopupNoticeData = value;
      const updatedBy = (req as any).user?.userId;

      if (!updatedBy) {
        return res.status(401).json({
          success: false,
          error: { message: 'Unauthorized' }
        });
      }

      const notice = await IngamePopupNoticeService.updateIngamePopupNotice(id, data, updatedBy);

      res.json({
        success: true,
        notice
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete ingame popup notice
   * DELETE /api/v1/admin/ingame-popup-notices/:id
   */
  async deleteIngamePopupNotice(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      await IngamePopupNoticeService.deleteIngamePopupNotice(id);

      res.json({
        success: true,
        message: 'Ingame popup notice deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete multiple ingame popup notices
   * POST /api/v1/admin/ingame-popup-notices/bulk-delete
   */
  async deleteMultipleIngamePopupNotices(req: Request, res: Response, next: NextFunction) {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: { message: 'Invalid or empty ids array' }
        });
      }

      await IngamePopupNoticeService.deleteMultipleIngamePopupNotices(ids);

      res.json({
        success: true,
        message: `${ids.length} ingame popup notice(s) deleted successfully`
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Toggle active status
   * PATCH /api/v1/admin/ingame-popup-notices/:id/toggle-active
   */
  async toggleActive(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const notice = await IngamePopupNoticeService.toggleActive(id);

      res.json({
        success: true,
        notice
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get active ingame popup notices for Server SDK
   * GET /api/v1/server/ingame-popup-notices
   * Returns only active notices that are currently visible and not expired
   */
  async getServerIngamePopupNotices(req: Request, res: Response, next: NextFunction) {
    try {
      const filters: IngamePopupNoticeFilters = {
        isActive: true,
        currentlyVisible: true
      };

      const result = await IngamePopupNoticeService.getIngamePopupNotices(1, 1000, filters);

      // Filter out notices where endDate is in the past
      const now = new Date();
      const activeNotices = result.notices.filter(notice => {
        if (!notice.endDate) return true;
        const endDate = new Date(notice.endDate);
        return endDate > now;
      });

      // Format notices for Server SDK response
      const formattedNotices = activeNotices.map(notice =>
        IngamePopupNoticeService.formatNoticeForServerSDK(notice as any)
      );

      res.json({
        success: true,
        data: formattedNotices
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new IngamePopupNoticeController();

