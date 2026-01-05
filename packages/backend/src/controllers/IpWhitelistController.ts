import { Response } from 'express';
import { IpWhitelistService } from '../services/IpWhitelistService';
import { asyncHandler, GatrixError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import Joi from 'joi';
import { isValidIPOrCIDR } from '../utils/ipValidation';
import { UnifiedChangeGateway } from '../services/UnifiedChangeGateway';

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
    const environment = req.environment;
    if (!environment) {
      throw new GatrixError('Environment not specified', 400);
    }

    // Validate query parameters
    const { error, value } = getIpWhitelistsQuerySchema.validate(req.query);
    if (error) {
      throw new GatrixError(error.details[0].message, 400);
    }

    const { page, limit, ipAddress, purpose, isEnabled, createdBy, search, tags } = value;

    const filters = { ipAddress, purpose, isEnabled, createdBy, search };
    const pagination = { page, limit };

    const result = await IpWhitelistService.getAllIpWhitelists(environment, filters, pagination);

    res.json({
      success: true,
      data: result,
    });
  });

  static getIpWhitelistById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const environment = req.environment;

    if (isNaN(id)) {
      throw new GatrixError('Invalid IP whitelist ID', 400);
    }
    if (!environment) {
      throw new GatrixError('Environment not specified', 400);
    }

    const ipWhitelist = await IpWhitelistService.getIpWhitelistById(id, environment);

    res.json({
      success: true,
      data: ipWhitelist,
    });
  });

  static createIpWhitelist = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = req.environment;
    if (!environment) {
      throw new GatrixError('Environment not specified', 400);
    }

    // Validate request body
    const { error, value } = createIpWhitelistSchema.validate(req.body);
    if (error) {
      throw new GatrixError(error.details[0].message, 400);
    }

    const createData: any = {
      ipAddress: value.ipAddress,
      purpose: value.purpose,
      isEnabled: value.isEnabled ?? true,
      createdBy: req.user?.userId,
    };

    // Only include date fields if they are provided and valid
    if (value.startDate) {
      createData.startDate = value.startDate;
    }

    if (value.endDate) {
      createData.endDate = value.endDate;
    }

    // Use UnifiedChangeGateway for CR support
    const gatewayResult = await UnifiedChangeGateway.requestCreation(
      req.user?.userId || 0,
      environment,
      'g_ip_whitelist',
      { ...createData, environment },
      async () => {
        return await IpWhitelistService.createIpWhitelist(environment, createData);
      }
    );

    if (gatewayResult.mode === 'DIRECT') {
      res.status(201).json({
        success: true,
        data: gatewayResult.data,
      });
    } else {
      res.status(202).json({
        success: true,
        data: {
          changeRequestId: gatewayResult.changeRequestId,
          status: gatewayResult.status,
        },
        message: 'Change request created. The IP whitelist entry will be created after approval.',
      });
    }
  });

  static updateIpWhitelist = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const environment = req.environment;

    if (isNaN(id)) {
      throw new GatrixError('Invalid IP whitelist ID', 400);
    }
    if (!environment) {
      throw new GatrixError('Environment not specified', 400);
    }

    // Validate request body
    const { error, value } = updateIpWhitelistSchema.validate(req.body);
    if (error) {
      throw new GatrixError(error.details[0].message, 400);
    }

    const updateData = {
      ...value,
      updatedBy: req.user?.userId,
    };

    // Resolve authenticated user id
    const userId = req.user?.userId;
    if (!userId) {
      throw new GatrixError('User authentication required', 401);
    }

    // Use UnifiedChangeGateway for CR support
    const gatewayResult = await UnifiedChangeGateway.processChange(
      userId,
      environment,
      'g_ip_whitelist',
      String(id),
      updateData,
      async (processedData) => {
        return await IpWhitelistService.updateIpWhitelist(id, environment, processedData as any);
      }
    );

    if (gatewayResult.mode === 'DIRECT') {
      res.json({
        success: true,
        data: gatewayResult.data,
      });
    } else {
      res.status(202).json({
        success: true,
        data: {
          changeRequestId: gatewayResult.changeRequestId,
          status: gatewayResult.status,
        },
        message: 'Change request created. The update will be applied after approval.',
      });
    }
  });

  static deleteIpWhitelist = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const environment = req.environment;

    if (isNaN(id)) {
      throw new GatrixError('Invalid IP whitelist ID', 400);
    }
    if (!environment) {
      throw new GatrixError('Environment not specified', 400);
    }

    // Resolve authenticated user id
    const userId = req.user?.userId;
    if (!userId) {
      throw new GatrixError('User authentication required', 401);
    }

    // Use UnifiedChangeGateway for CR support
    const gatewayResult = await UnifiedChangeGateway.requestDeletion(
      userId,
      environment,
      'g_ip_whitelist',
      String(id),
      async () => {
        await IpWhitelistService.deleteIpWhitelist(id, environment);
      }
    );

    if (gatewayResult.mode === 'DIRECT') {
      res.json({
        success: true,
        message: 'IP whitelist entry deleted successfully',
      });
    } else {
      res.status(202).json({
        success: true,
        data: {
          changeRequestId: gatewayResult.changeRequestId,
          status: gatewayResult.status,
        },
        message: 'Change request created. The deletion will be applied after approval.',
      });
    }
  });

  static toggleIpWhitelistStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const environment = req.environment;

    if (isNaN(id)) {
      throw new GatrixError('Invalid IP whitelist ID', 400);
    }
    if (!environment) {
      throw new GatrixError('Environment not specified', 400);
    }

    // Resolve authenticated user id
    const userId = req.user?.userId;
    if (!userId) {
      throw new GatrixError('User authentication required', 401);
    }

    // Use UnifiedChangeGateway for CR support
    const gatewayResult = await UnifiedChangeGateway.processChange(
      userId,
      environment,
      'g_ip_whitelist',
      String(id),
      async (currentData: any) => {
        return { isEnabled: !currentData.isEnabled };
      },
      async (processedData: any) => {
        return await IpWhitelistService.updateIpWhitelist(id, environment, {
          ...processedData as any,
          updatedBy: userId
        });
      }
    );

    if (gatewayResult.mode === 'DIRECT') {
      res.json({
        success: true,
        data: gatewayResult.data,
      });
    } else {
      res.status(202).json({
        success: true,
        data: {
          changeRequestId: gatewayResult.changeRequestId,
          status: gatewayResult.status,
        },
        message: 'Change request created. Toggle will be applied after approval.',
      });
    }
  });

  static bulkCreateIpWhitelists = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = req.environment;
    if (!environment) {
      throw new GatrixError('Environment not specified', 400);
    }

    const userId = req.user?.userId;
    if (!userId) {
      throw new GatrixError('User authentication required', 401);
    }

    // Validate request body
    const { error, value } = bulkCreateSchema.validate(req.body);
    if (error) {
      throw new GatrixError(error.details[0].message, 400);
    }

    // Use UnifiedChangeGateway for CR support
    // Since requestCreation and bulkCreate are different patterns, we check approval requirement first
    const requiresApproval = await UnifiedChangeGateway.requiresApproval(environment);

    if (requiresApproval) {
      // For bulk creation in CR, we wrap the whole operation or individual items?
      // Conventionally, bulk creations are handled as a single CR with multiple items if possible,
      // but UnifiedChangeGateway.requestCreation is designed for single table/item.
      // However, we can pass the whole array as createData.
      const gatewayResult = await UnifiedChangeGateway.requestCreation(
        userId,
        environment,
        'g_ip_whitelist',
        { entries: value.entries, bulk: true },
        async () => {
          return await IpWhitelistService.bulkCreateIpWhitelists(
            environment,
            value.entries,
            userId
          );
        }
      );

      res.status(202).json({
        success: true,
        data: {
          changeRequestId: gatewayResult.changeRequestId,
          status: gatewayResult.status,
        },
        message: 'Change request created. IP whitelists will be created after approval.',
      });
    } else {
      const createdCount = await IpWhitelistService.bulkCreateIpWhitelists(
        environment,
        value.entries,
        userId
      );

      res.status(201).json({
        success: true,
        data: {
          requestedCount: value.entries.length,
          createdCount,
        },
        message: `Successfully created ${createdCount} out of ${value.entries.length} IP whitelist entries`,
      });
    }
  });

  static checkIpWhitelist = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { ipAddress } = req.query;
    const environment = req.environment;

    if (!ipAddress || typeof ipAddress !== 'string') {
      throw new GatrixError('IP address is required', 400);
    }
    if (!environment) {
      throw new GatrixError('Environment not specified', 400);
    }

    const isWhitelisted = await IpWhitelistService.isIpWhitelisted(ipAddress, environment);

    res.json({
      success: true,
      data: {
        ipAddress,
        isWhitelisted,
      },
    });
  });
}
