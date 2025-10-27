import { Response } from 'express';
import Joi from 'joi';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
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
  rewardTemplateId: Joi.string().length(26).allow(null),
  rewardData: Joi.alternatives(Joi.object(), Joi.array(), Joi.string()).allow(null),
  startsAt: Joi.string().isoDate().required(),
  expiresAt: Joi.string().isoDate().required(),
  status: Joi.string().valid('ACTIVE', 'DISABLED', 'DELETED').default('ACTIVE'),
  quantity: Joi.number().integer().min(1).optional().when('type', { is: 'NORMAL', then: Joi.optional(), otherwise: Joi.forbidden() }),
  targetWorlds: Joi.array().items(Joi.string()).allow(null),
  targetPlatforms: Joi.array().items(Joi.string()).allow(null),
  targetChannels: Joi.array().items(Joi.string()).allow(null),
  targetSubchannels: Joi.array().items(Joi.string()).allow(null),
});

const updateSchema = createSchema.fork([
  'type','name','startsAt','expiresAt'
], (s) => s.optional());

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
    if (!id) throw new CustomError('id is required', 400);
    const setting = await CouponSettingsService.getSettingById(id);
    res.json({ success: true, data: { setting } });
  });

  static create = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { error, value } = createSchema.validate(req.body);
    if (error) throw new CustomError(error.message, 400);

    const authenticatedUserId = (req as any).userDetails?.id ?? (req as any).user?.id ?? (req as any).user?.userId;
    const setting = await CouponSettingsService.createSetting({ ...value, createdBy: authenticatedUserId ?? null });
    res.status(201).json({ success: true, data: { setting } });
  });

  static update = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    if (!id) throw new CustomError('id is required', 400);

    const { error, value } = updateSchema.validate(req.body);
    if (error) throw new CustomError(error.message, 400);

    const authenticatedUserId = (req as any).userDetails?.id ?? (req as any).user?.id ?? (req as any).user?.userId;
    const setting = await CouponSettingsService.updateSetting(id, { ...value, updatedBy: authenticatedUserId ?? null });
    res.json({ success: true, data: { setting } });
  });

  static remove = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    if (!id) throw new CustomError('id is required', 400);
    await CouponSettingsService.deleteSetting(id);
    res.json({ success: true });
  });

  static usage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    if (!id) throw new CustomError('id is required', 400);
    const { page, limit, search, platform, gameWorldId, from, to } = req.query;
    const data = await CouponSettingsService.getUsageBySetting(id, {
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      search: search as string,
      platform: platform as string,
      gameWorldId: gameWorldId as string,
      from: from as string,
      to: to as string,
    });
    res.json({ success: true, data });
  });
}

