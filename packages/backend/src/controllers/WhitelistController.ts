import { Response } from 'express';
import { WhitelistService } from '../services/WhitelistService';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import Joi from 'joi';

// Validation schemas
const createWhitelistSchema = Joi.object({
  nickname: Joi.string().min(1).max(100).required(),
  ipAddress: Joi.string().ip({ version: ['ipv4', 'ipv6'] }).optional().allow('').empty('').default(null),
  startDate: Joi.date().iso().optional().allow('').empty('').default(null),
  endDate: Joi.date().iso().optional().allow('').empty('').default(null),
  memo: Joi.string().max(1000).optional().allow('').empty('').default(null),
});

const updateWhitelistSchema = Joi.object({
  nickname: Joi.string().min(1).max(100).optional(),
  ipAddress: Joi.string().ip({ version: ['ipv4', 'ipv6'] }).optional().allow('').empty('').default(null),
  startDate: Joi.date().iso().optional().allow('').empty('').default(null),
  endDate: Joi.date().iso().optional().allow('').empty('').default(null),
  memo: Joi.string().max(1000).optional().allow('').empty('').default(null),
});

const bulkCreateSchema = Joi.object({
  entries: Joi.array().items(
    Joi.object({
      nickname: Joi.string().min(1).max(100).required(),
      ipAddress: Joi.string().ip({ version: ['ipv4', 'ipv6'] }).optional().allow('').empty('').default(null),
      startDate: Joi.date().iso().optional().allow('').empty('').default(null),
      endDate: Joi.date().iso().optional().allow('').empty('').default(null),
      memo: Joi.string().max(1000).optional().allow('').empty('').default(null),
    })
  ).min(1).max(1000).required(),
});

const getWhitelistsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  nickname: Joi.string().optional(),
  ipAddress: Joi.string().optional(),
  createdBy: Joi.number().integer().optional(),
  search: Joi.string().optional(),
  _t: Joi.string().optional(), // 캐시 방지용 타임스탬프
});

export class WhitelistController {
  static getWhitelists = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Validate query parameters
    const { error, value } = getWhitelistsQuerySchema.validate(req.query);
    if (error) {
      throw new CustomError(error.details[0].message, 400);
    }

    const { page, limit, nickname, ipAddress, createdBy, search } = value;
    
    const filters = { nickname, ipAddress, createdBy, search };
    const pagination = { page, limit };

    const result = await WhitelistService.getAllWhitelists(filters, pagination);

    res.json({
      success: true,
      data: result,
    });
  });

  static getWhitelistById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      throw new CustomError('Invalid whitelist ID', 400);
    }

    const whitelist = await WhitelistService.getWhitelistById(id);

    res.json({
      success: true,
      data: { whitelist },
    });
  });

  static createWhitelist = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new CustomError('User not authenticated', 401);
    }

    // Validate request body
    const { error, value } = createWhitelistSchema.validate(req.body);
    if (error) {
      throw new CustomError(error.details[0].message, 400);
    }

    const whitelistData = {
      ...value,
      createdBy: req.user.userId,
    };

    const whitelist = await WhitelistService.createWhitelist(whitelistData);

    res.status(201).json({
      success: true,
      data: { whitelist },
      message: 'Whitelist entry created successfully',
    });
  });

  static updateWhitelist = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      throw new CustomError('Invalid whitelist ID', 400);
    }

    // Validate request body
    const { error, value } = updateWhitelistSchema.validate(req.body);
    if (error) {
      throw new CustomError(error.details[0].message, 400);
    }

    const whitelist = await WhitelistService.updateWhitelist(id, value);

    res.json({
      success: true,
      data: { whitelist },
      message: 'Whitelist entry updated successfully',
    });
  });

  static deleteWhitelist = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      throw new CustomError('Invalid whitelist ID', 400);
    }

    await WhitelistService.deleteWhitelist(id);

    res.json({
      success: true,
      message: 'Whitelist entry deleted successfully',
    });
  });

  static bulkCreateWhitelists = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new CustomError('User not authenticated', 401);
    }

    // Validate request body
    const { error, value } = bulkCreateSchema.validate(req.body);
    if (error) {
      throw new CustomError(error.details[0].message, 400);
    }

    const createdCount = await WhitelistService.bulkCreateWhitelists(value.entries, req.user.userId);

    res.status(201).json({
      success: true,
      data: { 
        createdCount,
        requestedCount: value.entries.length,
      },
      message: `Successfully created ${createdCount} whitelist entries`,
    });
  });
}
