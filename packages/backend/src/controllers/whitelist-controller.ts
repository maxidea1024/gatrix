import { Response } from 'express';
import { WhitelistService } from '../services/whitelist-service';
import { asyncHandler, GatrixError } from '../middleware/error-handler';
import { AuthenticatedRequest } from '../middleware/auth';
import Joi from 'joi';
import { WhitelistModel } from '../models/account-whitelist';

// Validation schemas
const createWhitelistSchema = Joi.object({
  accountId: Joi.string()
    .min(4)
    .max(36)
    .pattern(/^[a-zA-Z0-9]+$/)
    .required()
    .messages({
      'string.min': 'Account ID must be at least 4 characters',
      'string.max': 'Account ID must be at most 36 characters',
      'string.pattern.base':
        'Account ID must contain only alphanumeric characters',
    }),
  ipAddress: Joi.string()
    .ip({ version: ['ipv4', 'ipv6'] })
    .optional()
    .allow('')
    .empty('')
    .default(null),
  startDate: Joi.date().iso().optional().allow('').empty('').default(null),
  endDate: Joi.date().iso().optional().allow('').empty('').default(null),
  purpose: Joi.string().max(1000).optional().allow('').empty('').default(null),
  tags: Joi.array().items(Joi.string().max(50)).max(20).optional(),
});

const updateWhitelistSchema = Joi.object({
  accountId: Joi.string()
    .min(4)
    .max(36)
    .pattern(/^[a-zA-Z0-9]+$/)
    .optional()
    .messages({
      'string.min': 'Account ID must be at least 4 characters',
      'string.max': 'Account ID must be at most 36 characters',
      'string.pattern.base':
        'Account ID must contain only alphanumeric characters',
    }),
  ipAddress: Joi.string()
    .ip({ version: ['ipv4', 'ipv6'] })
    .optional()
    .allow('')
    .empty('')
    .default(null),
  startDate: Joi.date().iso().optional().allow('').empty('').default(null),
  endDate: Joi.date().iso().optional().allow('').empty('').default(null),
  purpose: Joi.string().max(1000).optional().allow('').empty('').default(null),
  tags: Joi.array().items(Joi.string().max(50)).max(20).optional(),
});

const testWhitelistSchema = Joi.object({
  accountId: Joi.string()
    .min(4)
    .max(36)
    .pattern(/^[a-zA-Z0-9]+$/)
    .optional()
    .messages({
      'string.min': 'Account ID must be at least 4 characters',
      'string.max': 'Account ID must be at most 36 characters',
      'string.pattern.base':
        'Account ID must contain only alphanumeric characters',
    }),
  ipAddress: Joi.string()
    .ip({ version: ['ipv4', 'ipv6'] })
    .optional(),
}).or('accountId', 'ipAddress');

const bulkCreateSchema = Joi.object({
  entries: Joi.array()
    .items(
      Joi.object({
        accountId: Joi.string()
          .min(4)
          .max(36)
          .pattern(/^[a-zA-Z0-9]+$/)
          .required()
          .messages({
            'string.min': 'Account ID must be at least 4 characters',
            'string.max': 'Account ID must be at most 36 characters',
            'string.pattern.base':
              'Account ID must contain only alphanumeric characters',
          }),
        ipAddress: Joi.string()
          .ip({ version: ['ipv4', 'ipv6'] })
          .optional()
          .allow('')
          .empty('')
          .default(null),
        startDate: Joi.date()
          .iso()
          .optional()
          .allow('')
          .empty('')
          .default(null),
        endDate: Joi.date().iso().optional().allow('').empty('').default(null),
        purpose: Joi.string()
          .max(1000)
          .optional()
          .allow('')
          .empty('')
          .default(null),
        tags: Joi.array().items(Joi.string().max(50)).max(20).optional(),
      })
    )
    .min(1)
    .max(1000)
    .required(),
});

const getWhitelistsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  accountId: Joi.string().optional(),
  ipAddress: Joi.string().optional(),
  createdBy: Joi.string().optional(),
  search: Joi.string().optional(),
  tags: Joi.alternatives()
    .try(Joi.string(), Joi.array().items(Joi.string()))
    .optional(),
  _t: Joi.string().optional(), // Cache-busting timestamp
}).options({ stripUnknown: true });

export class WhitelistController {
  static getWhitelists = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const environmentId = req.environmentId;
      if (!environmentId) {
        throw new GatrixError('Environment not specified', 400);
      }

      // Validate query parameters
      const { error, value } = getWhitelistsQuerySchema.validate(req.query);
      if (error) {
        throw new GatrixError(error.details[0].message, 400);
      }

      const { page, limit, accountId, ipAddress, createdBy, search, tags } =
        value;

      // Handle tags parameter (can be string or array)
      let tagsArray: string[] | undefined;
      if (tags) {
        if (typeof tags === 'string') {
          tagsArray = [tags];
        } else if (Array.isArray(tags)) {
          tagsArray = tags;
        }
      }

      const filters = {
        accountId,
        ipAddress,
        createdBy,
        search,
        tags: tagsArray,
      };
      const pagination = { page, limit };

      const result = await WhitelistService.getAllWhitelists(
        environmentId,
        filters,
        pagination
      );

      res.json({
        success: true,
        data: result,
      });
    }
  );

  static getWhitelistById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const id = req.params.id;
      const environmentId = req.environmentId;

      if (!id) {
        throw new GatrixError('Invalid whitelist ID', 400);
      }
      if (!environmentId) {
        throw new GatrixError('Environment not specified', 400);
      }

      const whitelist = await WhitelistService.getWhitelistById(
        id,
        environmentId
      );

      res.json({
        success: true,
        data: { whitelist },
      });
    }
  );

  static createWhitelist = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const environmentId = req.environmentId;
      if (!req.user) {
        throw new GatrixError('User not authenticated', 401);
      }
      if (!environmentId) {
        throw new GatrixError('Environment not specified', 400);
      }

      // Validate request body
      const { error, value } = createWhitelistSchema.validate(req.body);
      if (error) {
        throw new GatrixError(error.details[0].message, 400);
      }

      const whitelistData = {
        ...value,
        createdBy: req.user.userId,
      };

      const whitelist = await WhitelistService.createWhitelist(
        environmentId,
        whitelistData
      );

      res.status(201).json({
        success: true,
        data: { whitelist },
        message: 'Whitelist entry created successfully',
      });
    }
  );

  static updateWhitelist = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const id = req.params.id;
      const environmentId = req.environmentId;

      if (!id) {
        throw new GatrixError('Invalid whitelist ID', 400);
      }
      if (!environmentId) {
        throw new GatrixError('Environment not specified', 400);
      }

      // Validate request body
      const { error, value } = updateWhitelistSchema.validate(req.body);
      if (error) {
        throw new GatrixError(error.details[0].message, 400);
      }

      const whitelist = await WhitelistService.updateWhitelist(
        id,
        environmentId,
        value
      );

      res.json({
        success: true,
        data: { whitelist },
        message: 'Whitelist entry updated successfully',
      });
    }
  );

  static deleteWhitelist = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const id = req.params.id;
      const environmentId = req.environmentId;

      if (!id) {
        throw new GatrixError('Invalid whitelist ID', 400);
      }
      if (!environmentId) {
        throw new GatrixError('Environment not specified', 400);
      }

      await WhitelistService.deleteWhitelist(id, environmentId);

      res.json({
        success: true,
        message: 'Whitelist entry deleted successfully',
      });
    }
  );

  static bulkCreateWhitelists = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const environmentId = req.environmentId;
      if (!req.user) {
        throw new GatrixError('User not authenticated', 401);
      }
      if (!environmentId) {
        throw new GatrixError('Environment not specified', 400);
      }

      // Validate request body
      const { error, value } = bulkCreateSchema.validate(req.body);
      if (error) {
        throw new GatrixError(error.details[0].message, 400);
      }

      const createdCount = await WhitelistService.bulkCreateWhitelists(
        environmentId,
        value.entries,
        req.user.userId!
      );

      res.status(201).json({
        success: true,
        data: {
          createdCount,
          requestedCount: value.entries.length,
        },
        message: `Successfully created ${createdCount} whitelist entries`,
      });
    }
  );

  static toggleWhitelistStatus = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const id = req.params.id;
      const environmentId = req.environmentId;

      if (!id) {
        throw new GatrixError('Invalid whitelist ID', 400);
      }
      if (!environmentId) {
        throw new GatrixError('Environment not specified', 400);
      }

      const updated = await WhitelistService.toggleWhitelistStatus(
        id,
        environmentId,
        req.user?.userId!
      );

      res.json({
        success: true,
        data: updated,
      });
    }
  );

  // Test whitelist
  static testWhitelist = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const environmentId = req.environmentId;
      if (!environmentId) {
        throw new GatrixError('Environment not specified', 400);
      }

      const { error, value } = testWhitelistSchema.validate(req.body);
      if (error) {
        throw new GatrixError(error.details[0].message, 400);
      }

      const { accountId, ipAddress } = value;
      const result = await WhitelistService.testWhitelist(
        environmentId,
        accountId,
        ipAddress
      );

      res.json({
        success: true,
        data: result,
      });
    }
  );
}
