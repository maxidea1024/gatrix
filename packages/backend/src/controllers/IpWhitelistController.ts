import { Response } from 'express';
import { IpWhitelistService } from '../services/IpWhitelistService';
import { asyncHandler, GatrixError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import Joi from 'joi';
import { isValidIPOrCIDR } from '../utils/ipValidation';

// Custom IP/CIDR validation for Joi
const ipOrCidrValidator = (value: string, helpers: any) => {
  if (!isValidIPOrCIDR(value)) {
    return helpers.error('any.invalid');
  }
  return value;
};

// Validation schemas
const createIpWhitelistSchema = Joi.object({
  ipAddress: Joi.string().custom(ipOrCidrValidator, 'IP or CIDR validation').required()
    .messages({
      'any.invalid': 'Invalid IP address or CIDR notation',
      'any.required': 'IP address is required'
    }),
  purpose: Joi.string().min(1).max(500).required(),
  isEnabled: Joi.boolean().optional().default(true),
  startDate: Joi.date().optional().allow(null).empty(''),
  endDate: Joi.date().optional().allow(null).empty('').when('startDate', {
    is: Joi.exist(),
    then: Joi.date().min(Joi.ref('startDate')).messages({
      'date.min': 'End date must be after start date'
    })
  }),
  tags: Joi.array().items(Joi.string().max(50)).max(20).optional(),
}).options({ stripUnknown: true });

const updateIpWhitelistSchema = Joi.object({
  ipAddress: Joi.string().custom(ipOrCidrValidator, 'IP or CIDR validation').optional()
    .messages({
      'any.invalid': 'Invalid IP address or CIDR notation'
    }),
  purpose: Joi.string().min(1).max(500).optional(),
  isEnabled: Joi.boolean().optional(),
  startDate: Joi.date().optional().allow(null).empty(''),
  endDate: Joi.date().optional().allow(null).empty('').when('startDate', {
    is: Joi.exist(),
    then: Joi.date().min(Joi.ref('startDate')).messages({
      'date.min': 'End date must be after start date'
    })
  }),
  tags: Joi.array().items(Joi.string().max(50)).max(20).optional(),
}).options({ stripUnknown: true });

const getIpWhitelistsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(10),
  ipAddress: Joi.string().optional(),
  purpose: Joi.string().optional(),
  isEnabled: Joi.boolean().optional(),
  createdBy: Joi.number().integer().optional(),
  search: Joi.string().optional(),
  tags: Joi.alternatives().try(
    Joi.string(),
    Joi.array().items(Joi.string())
  ).optional(),
  _t: Joi.string().optional(), // Cache busting parameter
}).options({ stripUnknown: true });

const bulkCreateSchema = Joi.object({
  entries: Joi.array().items(
    Joi.object({
      ipAddress: Joi.string().custom(ipOrCidrValidator, 'IP or CIDR validation').required()
        .messages({
          'any.invalid': 'Invalid IP address or CIDR notation',
          'any.required': 'IP address is required'
        }),
      purpose: Joi.string().min(1).max(500).required(),
      isEnabled: Joi.boolean().optional().default(true),
      startDate: Joi.date().optional().allow(null),
      endDate: Joi.date().optional().allow(null).when('startDate', {
        is: Joi.exist(),
        then: Joi.date().min(Joi.ref('startDate')).messages({
          'date.min': 'End date must be after start date'
        })
      }),
    })
  ).min(1).max(100).required(),
});

export class IpWhitelistController {
  static getIpWhitelists = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Validate query parameters
    const { error, value } = getIpWhitelistsQuerySchema.validate(req.query);
    if (error) {
      throw new GatrixError(error.details[0].message, 400);
    }

    const { page, limit, ipAddress, purpose, isEnabled, createdBy, search, tags } = value;

    // Handle tags parameter (can be string or array)
    let tagsArray: string[] | undefined;
    if (tags) {
      if (typeof tags === 'string') {
        tagsArray = [tags];
      } else if (Array.isArray(tags)) {
        tagsArray = tags;
      }
    }

    const filters = { ipAddress, purpose, isEnabled, createdBy, search };
    const pagination = { page, limit };

    const result = await IpWhitelistService.getAllIpWhitelists(filters, pagination);

    res.json({
      success: true,
      data: result,
    });
  });

  static getIpWhitelistById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      throw new GatrixError('Invalid IP whitelist ID', 400);
    }

    const ipWhitelist = await IpWhitelistService.getIpWhitelistById(id);

    res.json({
      success: true,
      data: ipWhitelist,
    });
  });

  static createIpWhitelist = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Validate request body
    const { error, value } = createIpWhitelistSchema.validate(req.body);
    if (error) {
      throw new GatrixError(error.details[0].message, 400);
    }

    // Clean up the validated data to remove any undefined values
    console.log('req.user:', req.user);
    console.log('req.user.userId:', (req.user as any)?.userId);

    const createData: any = {
      ipAddress: value.ipAddress,
      purpose: value.purpose,
      isEnabled: value.isEnabled ?? true,
      createdBy: (req.user as any)?.userId,
    };

    // Only include date fields if they are provided and valid
    if (value.startDate) {
      createData.startDate = value.startDate;
    }

    if (value.endDate) {
      createData.endDate = value.endDate;
    }

    console.log('Controller createData:', createData);
    const created = await IpWhitelistService.createIpWhitelist(createData);

    res.status(201).json({
      success: true,
      data: created,
    });
  });

  static updateIpWhitelist = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      throw new GatrixError('Invalid IP whitelist ID', 400);
    }

    // Validate request body
    const { error, value } = updateIpWhitelistSchema.validate(req.body);
    if (error) {
      throw new GatrixError(error.details[0].message, 400);
    }

    const updateData = {
      ...value,
      updatedBy: (req.user as any).userId,
    };

    const updated = await IpWhitelistService.updateIpWhitelist(id, updateData);

    res.json({
      success: true,
      data: updated,
    });
  });

  static deleteIpWhitelist = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      throw new GatrixError('Invalid IP whitelist ID', 400);
    }

    await IpWhitelistService.deleteIpWhitelist(id);

    res.json({
      success: true,
      message: 'IP whitelist entry deleted successfully',
    });
  });

  static toggleIpWhitelistStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      throw new GatrixError('Invalid IP whitelist ID', 400);
    }

    const updated = await IpWhitelistService.toggleIpWhitelistStatus(id, (req.user as any).userId);

    res.json({
      success: true,
      data: updated,
    });
  });

  static bulkCreateIpWhitelists = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Validate request body
    const { error, value } = bulkCreateSchema.validate(req.body);
    if (error) {
      throw new GatrixError(error.details[0].message, 400);
    }

    const createdCount = await IpWhitelistService.bulkCreateIpWhitelists(
      value.entries,
      (req.user as any).userId
    );

    res.status(201).json({
      success: true,
      data: {
        requestedCount: value.entries.length,
        createdCount,
      },
      message: `Successfully created ${createdCount} out of ${value.entries.length} IP whitelist entries`,
    });
  });

  static checkIpWhitelist = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { ipAddress } = req.query;

    if (!ipAddress || typeof ipAddress !== 'string') {
      throw new GatrixError('IP address is required', 400);
    }

    const isWhitelisted = await IpWhitelistService.isIpWhitelisted(ipAddress);

    res.json({
      success: true,
      data: {
        ipAddress,
        isWhitelisted,
      },
    });
  });
}
