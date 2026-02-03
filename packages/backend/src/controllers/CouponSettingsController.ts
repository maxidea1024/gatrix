import { Response } from 'express';
import Joi from 'joi';
import { asyncHandler, GatrixError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../types/auth';
import { CouponSettingsService } from '../services/CouponSettingsService';
import { UnifiedChangeGateway } from '../services/UnifiedChangeGateway';
import logger from '../config/logger';

// Validation schemas
const createSchema = Joi.object({
  code: Joi.alternatives().conditional('type', {
    is: 'SPECIAL',
    then: Joi.string().min(4).max(64).required(),
    otherwise: Joi.string().max(64).allow(null, ''),
  }),
  type: Joi.string().valid('SPECIAL', 'NORMAL').required(),
  name: Joi.string().max(128).required(),
  description: Joi.string().max(128).allow(null, ''),
  tags: Joi.alternatives(Joi.object(), Joi.array(), Joi.string()).optional().allow(null),
  maxTotalUses: Joi.number().integer().min(1).allow(null),
  perUserLimit: Joi.number().integer().min(1).default(1),
  usageLimitType: Joi.string().valid('USER', 'CHARACTER').optional().default('USER'),
  codePattern: Joi.string()
    .valid('ALPHANUMERIC_8', 'ALPHANUMERIC_16', 'ALPHANUMERIC_16_HYPHEN')
    .optional(),
  rewardTemplateId: Joi.string().length(26).allow(null),
  rewardData: Joi.alternatives(Joi.object(), Joi.array(), Joi.string()).allow(null),
  rewardEmailTitle: Joi.string().max(255).required(),
  rewardEmailBody: Joi.string().required(),
  startsAt: Joi.string().isoDate().allow(null, '').optional(),
  expiresAt: Joi.string().isoDate().required(),
  status: Joi.string().valid('ACTIVE', 'DISABLED', 'DELETED').default('ACTIVE'),
  quantity: Joi.number().integer().min(1).optional(),
  targetWorlds: Joi.array().items(Joi.string()).allow(null),
  targetPlatforms: Joi.array().items(Joi.string()).allow(null),
  targetChannels: Joi.array().items(Joi.string()).allow(null),
  targetSubchannels: Joi.array().items(Joi.string()).allow(null),
  targetUsers: Joi.array().items(Joi.string()).allow(null),
  targetPlatformsInverted: Joi.boolean().optional().default(false),
  targetChannelsInverted: Joi.boolean().optional().default(false),
  targetWorldsInverted: Joi.boolean().optional().default(false),
  targetUserIdsInverted: Joi.boolean().optional().default(false),
}).unknown(false);

// Update schema: make most fields optional, but forbid quantity
const updateSchema = Joi.object({
  code: Joi.alternatives()
    .conditional('type', {
      is: 'SPECIAL',
      then: Joi.string().min(4).max(64),
      otherwise: Joi.string().max(64).allow(null, ''),
    })
    .optional(),
  type: Joi.string().valid('SPECIAL', 'NORMAL').optional(),
  name: Joi.string().max(128).optional(),
  description: Joi.string().max(128).allow(null, '').optional(),
  tags: Joi.alternatives(Joi.object(), Joi.array(), Joi.string()).optional().allow(null),
  maxTotalUses: Joi.number().integer().min(1).allow(null).optional(),
  perUserLimit: Joi.number().integer().min(1).optional(),
  usageLimitType: Joi.string().valid('USER', 'CHARACTER').optional(),
  rewardTemplateId: Joi.string().length(26).allow(null).optional(),
  rewardData: Joi.alternatives(Joi.object(), Joi.array(), Joi.string()).allow(null).optional(),
  rewardEmailTitle: Joi.string().max(255).optional(),
  rewardEmailBody: Joi.string().optional(),
  startsAt: Joi.string().isoDate().allow(null, '').optional(),
  expiresAt: Joi.string().isoDate().optional(),
  status: Joi.string().valid('ACTIVE', 'DISABLED', 'DELETED').optional(),
  quantity: Joi.forbidden(), // quantity is NOT allowed in updates
  targetWorlds: Joi.array().items(Joi.string()).allow(null).optional(),
  targetPlatforms: Joi.array().items(Joi.string()).allow(null).optional(),
  targetChannels: Joi.array().items(Joi.string()).allow(null).optional(),
  targetSubchannels: Joi.array().items(Joi.string()).allow(null).optional(),
  targetUsers: Joi.array().items(Joi.string()).allow(null).optional(),
  targetPlatformsInverted: Joi.boolean().optional(),
  targetChannelsInverted: Joi.boolean().optional(),
  targetWorldsInverted: Joi.boolean().optional(),
  targetUserIdsInverted: Joi.boolean().optional(),
}).unknown(false);

export class CouponSettingsController {
  static list = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, search, type, status } = req.query;
    const environment = req.environment;
    if (!environment) throw new GatrixError('Environment is required', 400);

    const result = await CouponSettingsService.listSettings({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      search: search as string,
      type: type as any,
      status: status as any,
      environment,
    });

    res.json({ success: true, data: result });
  });

  static getById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const environment = req.environment;
    if (!id) throw new GatrixError('id is required', 400);
    if (!environment) throw new GatrixError('Environment is required', 400);

    const setting = await CouponSettingsService.getSettingById(id, environment);
    res.json({ success: true, data: { setting } });
  });

  static create = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = req.environment;
    if (!environment) throw new GatrixError('Environment is required', 400);

    const { error, value } = createSchema.validate(req.body);
    if (error) {
      throw new GatrixError(error.message, 400);
    }

    const authenticatedUserId = req.user?.userId;
    if (!authenticatedUserId) throw new GatrixError('User authentication required', 401);

    const result = await UnifiedChangeGateway.requestCreation(
      authenticatedUserId,
      environment,
      'g_coupon_settings',
      { ...value },
      async () => {
        return CouponSettingsService.createSetting(
          { ...value, createdBy: authenticatedUserId },
          environment
        );
      }
    );

    res.status(result.mode === 'CHANGE_REQUEST' ? 202 : 201).json({
      success: true,
      data:
        result.mode === 'CHANGE_REQUEST'
          ? { changeRequestId: result.changeRequestId }
          : { setting: result.data },
      message:
        result.mode === 'CHANGE_REQUEST'
          ? 'Coupon creation requested'
          : 'Coupon created successfully',
    });
  });

  static update = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const environment = req.environment;
    if (!id) throw new GatrixError('id is required', 400);
    if (!environment) throw new GatrixError('Environment is required', 400);

    const { error, value } = updateSchema.validate(req.body);
    if (error) throw new GatrixError(error.message, 400);

    const authenticatedUserId = req.user?.userId;
    if (!authenticatedUserId) throw new GatrixError('User authentication required', 401);

    const result = await UnifiedChangeGateway.processChange(
      authenticatedUserId,
      environment,
      'g_coupon_settings',
      id,
      { ...value },
      async (processedData: any) => {
        const setting = await CouponSettingsService.updateSetting(
          id,
          { ...processedData, updatedBy: authenticatedUserId },
          environment
        );
        return { setting };
      }
    );

    if (result.mode === 'DIRECT') {
      res.json({
        success: true,
        data: result.data,
        message: 'Coupon updated successfully',
      });
    } else {
      res.status(202).json({
        success: true,
        data: { changeRequestId: result.changeRequestId },
        message: 'Coupon update requested',
      });
    }
  });

  static remove = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const environment = req.environment;
    if (!id) throw new GatrixError('id is required', 400);
    if (!environment) throw new GatrixError('Environment is required', 400);

    const authenticatedUserId = req.user?.userId;
    if (!authenticatedUserId) throw new GatrixError('User authentication required', 401);

    const result = await UnifiedChangeGateway.requestDeletion(
      authenticatedUserId,
      environment,
      'g_coupon_settings',
      id,
      async () => {
        await CouponSettingsService.deleteSetting(id, environment);
      }
    );

    res.status(result.mode === 'CHANGE_REQUEST' ? 202 : 200).json({
      success: true,
      data: result.mode === 'CHANGE_REQUEST' ? { changeRequestId: result.changeRequestId } : null,
      message:
        result.mode === 'CHANGE_REQUEST'
          ? 'Coupon deletion requested'
          : 'Coupon deleted successfully',
    });
  });

  static usage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const environment = req.environment;
    if (!environment) throw new GatrixError('Environment is required', 400);

    const {
      page,
      limit,
      search,
      platform,
      channel,
      subChannel,
      gameWorldId,
      characterId,
      from,
      to,
    } = req.query;

    const data = await CouponSettingsService.getUsageBySetting(
      id || undefined,
      {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string,
        platform: platform as string,
        channel: channel as string,
        subChannel: subChannel as string,
        gameWorldId: gameWorldId as string,
        characterId: characterId as string,
        from: from as string,
        to: to as string,
      },
      environment
    );
    res.json({ success: true, data });
  });

  // Get status statistics for issued coupon codes
  static getIssuedCodesStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    if (!id) throw new GatrixError('id is required', 400);
    const stats = await CouponSettingsService.getIssuedCodesStats(id);
    res.json({ success: true, data: stats });
  });

  // Get issued codes for export (chunked)
  static getIssuedCodesForExport = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      if (!id) throw new GatrixError('id is required', 400);
      const { offset, limit, search } = req.query;
      const data = await CouponSettingsService.getIssuedCodesForExport(id, {
        offset: offset ? parseInt(offset as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string,
      });
      res.json({ success: true, data });
    }
  );

  // List issued codes for NORMAL type settings
  static getIssuedCodes = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    if (!id) throw new GatrixError('id is required', 400);
    const { page, limit, search } = req.query;
    const data = await CouponSettingsService.getIssuedCodes(id, {
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      search: search as string,
    });
    res.json({ success: true, data });
  });

  // Get generation status for async coupon code generation
  static getGenerationStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    if (!id) throw new GatrixError('id is required', 400);
    const status = await CouponSettingsService.getGenerationStatus(id);
    res.json({ success: true, data: status });
  });

  // Recalculate cache for all coupon settings (admin only)
  static recalculateCacheAll = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const mismatches = await CouponSettingsService.recalculateCacheForAll();
    res.json({
      success: true,
      data: { mismatches, count: mismatches.length },
    });
  });

  // Recalculate cache for a specific coupon setting (admin only)
  static recalculateCacheForSetting = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      if (!id) throw new GatrixError('id is required', 400);
      const result = await CouponSettingsService.recalculateCacheForSetting(id);
      res.json({ success: true, data: result });
    }
  );

  // Get coupon usage records for export (chunked)
  static getUsageForExport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { offset, limit, settingId, couponCode, platform, gameWorldId, characterId } = req.query;
    const data = await CouponSettingsService.getUsageForExportChunked({
      offset: offset ? parseInt(offset as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      settingId: settingId as string,
      couponCode: couponCode as string,
      platform: platform as string,
      gameWorldId: gameWorldId as string,
      characterId: characterId as string,
    } as any);
    res.json({ success: true, data });
  });

  // Export coupon usage records (returns JSON data for frontend to format as CSV/XLSX)
  static exportUsage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { settingId, couponCode, platform, gameWorldId, characterId, timezone } = req.query;

    // Get all usage records with filters
    const records = await CouponSettingsService.getUsageForExport({
      settingId: settingId as string,
      couponCode: couponCode as string,
      platform: platform as string,
      gameWorldId: gameWorldId as string,
      characterId: characterId as string,
    } as any);

    // Use provided timezone or default to Asia/Seoul
    const tz = (timezone as string) || 'Asia/Seoul';

    // Import timezone conversion function
    const { convertMySQLDateTimeToTimezone } = require('../utils/dateUtils');

    // Transform records with timezone conversion
    const transformedRecords = records.map((r: any) => ({
      'Coupon Name': r.couponName || '-',
      'Coupon Code': r.couponCode || '-',
      'User ID': r.userId || '-',
      'User Name': r.userName || '-',
      'Character ID': r.characterId || '-',
      Sequence: r.sequence || '-',
      'Used At': convertMySQLDateTimeToTimezone(r.usedAt, tz) || '-',
      'Coupon Start Date': convertMySQLDateTimeToTimezone(r.couponStartsAt, tz) || '-',
      'Coupon Expiry Date': convertMySQLDateTimeToTimezone(r.couponExpiresAt, tz) || '-',
      'Game World': r.gameWorldId || '-',
      Platform: r.platform || '-',
      Channel: r.channel || '-',
      'Sub Channel': r.subchannel || '-',
    }));

    // Return JSON data (frontend will format as CSV or XLSX)
    const timestamp = new Date().toISOString().slice(0, 10);
    res.json({
      success: true,
      data: {
        records: transformedRecords,
        filename: `coupon-usage-${timestamp}`,
      },
    });
  });
}
