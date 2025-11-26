import { Response } from 'express';
import Joi from 'joi';
import { asyncHandler, GatrixError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../types/auth';
import { CouponSettingsService } from '../services/CouponSettingsService';

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
  codePattern: Joi.string().valid('ALPHANUMERIC_8', 'ALPHANUMERIC_16', 'ALPHANUMERIC_16_HYPHEN').optional(),
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
  code: Joi.alternatives().conditional('type', {
    is: 'SPECIAL',
    then: Joi.string().min(4).max(64),
    otherwise: Joi.string().max(64).allow(null, ''),
  }).optional(),
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

    const result = await CouponSettingsService.listSettings({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      search: search as string,
      type: type as any,
      status: status as any,
    });

    res.json({ success: true, data: result });
  });

  static getById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    if (!id) throw new GatrixError('id is required', 400);
    const setting = await CouponSettingsService.getSettingById(id);
    res.json({ success: true, data: { setting } });
  });

  static create = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { error, value } = createSchema.validate(req.body);
    if (error) {
      // Debug: log Joi validation error details
      console.warn('CouponSettingsController.create validation error', {
        message: error.message,
        details: error.details,
        payload: req.body,
      });
      throw new GatrixError(error.message, 400);
    }

    const authenticatedUserId = (req as any).userDetails?.id ?? (req as any).user?.id ?? (req as any).user?.userId;
    const setting = await CouponSettingsService.createSetting({ ...value, createdBy: authenticatedUserId ?? null });
    res.status(201).json({ success: true, data: { setting } });
  });

  static update = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    if (!id) throw new GatrixError('id is required', 400);

    const { error, value } = updateSchema.validate(req.body);
    if (error) throw new GatrixError(error.message, 400);

    const authenticatedUserId = (req as any).userDetails?.id ?? (req as any).user?.id ?? (req as any).user?.userId;
    const setting = await CouponSettingsService.updateSetting(id, { ...value, updatedBy: authenticatedUserId ?? null });
    res.json({ success: true, data: { setting } });
  });

  static remove = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    if (!id) throw new GatrixError('id is required', 400);
    await CouponSettingsService.deleteSetting(id);
    res.json({ success: true });
  });

  static usage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { page, limit, search, platform, channel, subChannel, gameWorldId, characterId, from, to } = req.query;

    // If id is provided, get usage for specific coupon setting
    // If id is not provided, get usage for all coupon settings
    const data = await CouponSettingsService.getUsageBySetting(id || undefined, {
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
    });
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
  static getIssuedCodesForExport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    if (!id) throw new GatrixError('id is required', 400);
    const { offset, limit, search } = req.query;
    const data = await CouponSettingsService.getIssuedCodesForExport(id, {
      offset: offset ? parseInt(offset as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      search: search as string,
    });
    res.json({ success: true, data });
  });

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
    res.json({ success: true, data: { mismatches, count: mismatches.length } });
  });

  // Recalculate cache for a specific coupon setting (admin only)
  static recalculateCacheForSetting = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    if (!id) throw new GatrixError('id is required', 400);
    const result = await CouponSettingsService.recalculateCacheForSetting(id);
    res.json({ success: true, data: result });
  });

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
      'Sequence': r.sequence || '-',
      'Used At': convertMySQLDateTimeToTimezone(r.usedAt, tz) || '-',
      'Coupon Start Date': convertMySQLDateTimeToTimezone(r.couponStartsAt, tz) || '-',
      'Coupon Expiry Date': convertMySQLDateTimeToTimezone(r.couponExpiresAt, tz) || '-',
      'Game World': r.gameWorldId || '-',
      'Platform': r.platform || '-',
      'Channel': r.channel || '-',
      'Sub Channel': r.subchannel || '-'
    }));

    // Return JSON data (frontend will format as CSV or XLSX)
    const timestamp = new Date().toISOString().slice(0, 10);
    res.json({
      success: true,
      data: {
        records: transformedRecords,
        filename: `coupon-usage-${timestamp}`
      }
    });
  });
}

