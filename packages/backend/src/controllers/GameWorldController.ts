import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import { GameWorldService } from '../services/GameWorldService';
import { TagService } from '../services/TagService';
import { CustomError } from '../middleware/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../config/logger';
import Joi from 'joi';
import { pubSubService } from '../services/PubSubService';

// Validation schemas
const createGameWorldSchema = Joi.object({
  worldId: Joi.string().min(1).max(100).required(),
  name: Joi.string().min(1).max(255).required(),
  isVisible: Joi.boolean().optional(),
  isMaintenance: Joi.boolean().optional(),
  displayOrder: Joi.number().integer().optional(),
  description: Joi.string().max(1000).optional().allow(''),
  // 점검 관련 필드
  maintenanceStartDate: Joi.string().isoDate().optional().allow('').empty('').default(null),
  maintenanceEndDate: Joi.string().isoDate().optional().allow('').empty('').default(null),
  maintenanceMessage: Joi.when('isMaintenance', {
    is: true,
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().optional().allow('').empty('').default(null)
  }),
  supportsMultiLanguage: Joi.boolean().optional().default(false),
  maintenanceLocales: Joi.array().items(
    Joi.object({
      lang: Joi.string().valid('ko', 'en', 'zh').required(),
      message: Joi.string().required(),
    })
  ).optional().default([]),
  customPayload: Joi.object().unknown(true).optional().default({}),
  worldServerAddress: Joi.string().pattern(/^[\d.]+:\d+$/).max(255).required().messages({
    'string.pattern.base': 'worldServerAddress must be in ip:port format (e.g., 192.168.1.100:8080)',
    'any.required': 'worldServerAddress is required'
  }),
  tagIds: Joi.array().items(Joi.number().integer().min(1)).optional()
});

const updateGameWorldSchema = Joi.object({
  worldId: Joi.string().min(1).max(100).optional(),
  name: Joi.string().min(1).max(255).optional(),
  isVisible: Joi.boolean().optional(),
  isMaintenance: Joi.boolean().optional(),
  displayOrder: Joi.number().integer().optional(),
  description: Joi.string().max(1000).optional().allow(''),
  // 점검 관련 필드
  maintenanceStartDate: Joi.string().isoDate().optional().allow('').empty('').default(null),
  maintenanceEndDate: Joi.string().isoDate().optional().allow('').empty('').default(null),
  maintenanceMessage: Joi.when('isMaintenance', {
    is: true,
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().optional().allow('').empty('').default(null)
  }),
  supportsMultiLanguage: Joi.boolean().optional().default(false),
  maintenanceLocales: Joi.array().items(
    Joi.object({
      lang: Joi.string().valid('ko', 'en', 'zh').required(),
      message: Joi.string().required(),
    })
  ).optional().default([]),
  customPayload: Joi.object().unknown(true).optional().allow(null),
  worldServerAddress: Joi.string().pattern(/^[\d.]+:\d+$/).max(255).optional().messages({
    'string.pattern.base': 'worldServerAddress must be in ip:port format (e.g., 192.168.1.100:8080)'
  }),
  tagIds: Joi.array().items(Joi.number().integer().min(1)).optional()
});

// Update maintenance status schema
const updateMaintenanceSchema = Joi.object({
  isMaintenance: Joi.boolean().required(),
  maintenanceStartDate: Joi.string().isoDate().optional().allow('').empty('').default(null),
  maintenanceEndDate: Joi.string().isoDate().optional().allow('').empty('').default(null),
  maintenanceMessageTemplateId: Joi.number().integer().optional().allow(null),
  maintenanceMessage: Joi.when('maintenanceMessageTemplateId', {
    is: Joi.exist().not(null),
    then: Joi.string().optional().allow('').empty('').default(null),
    otherwise: Joi.when('isMaintenance', {
      is: true,
      then: Joi.string().min(1).required(),
      otherwise: Joi.string().optional().allow('').empty('').default(null)
    })
  }),
  supportsMultiLanguage: Joi.boolean().optional().default(false),
  maintenanceLocales: Joi.array().items(
    Joi.object({
      lang: Joi.string().valid('ko', 'en', 'zh').required(),
      message: Joi.string().required(),
    })
  ).optional().default([]),
});

// const listGameWorldsSchema = Joi.object({
//   search: Joi.string().max(255).optional().allow(''),
//   sortBy: Joi.string().valid('name', 'worldId', 'displayOrder', 'createdAt', 'updatedAt').optional(),
//   sortOrder: Joi.string().valid('ASC', 'DESC').optional(),
//   isVisible: Joi.boolean().optional(),
//   isMaintenance: Joi.boolean().optional(),
//   tags: Joi.string().optional().allow('')
// });

export class GameWorldController {
  static getGameWorlds = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Validate query parameters (optional)
    // const { error, value } = listGameWorldsSchema.validate(req.query);
    // if (error) {
    //   throw new CustomError(error.details[0].message, 400);
    // }

    // Use raw query params if validation is skipped
    const worlds = await GameWorldService.getGameWorlds(req.query as any);

    // Attach tags for each world
    const dataArray = Array.isArray((worlds as any)?.data) ? (worlds as any).data : (worlds as any);
    let withTags = await Promise.all(
      (dataArray as any[]).map(async (w: any) => {
        const tags = await TagService.listTagsForEntity('game_world', w.id);
        return { ...w, tags };
      })
    );

    // Filter by tagIds if provided
    const tagIdsParam = (req.query as any).tagIds as string | undefined;
    const tagsOperator = (req.query as any).tags_operator as 'any_of' | 'include_all' | undefined;
    if (tagIdsParam) {
      const requiredIds = tagIdsParam.split(',').map((s) => Number(s)).filter((n) => !isNaN(n));
      if (requiredIds.length > 0) {
        const operator = tagsOperator || 'include_all';

        if (operator === 'any_of') {
          // OR 조건: 선택한 태그 중 하나라도 가진 게임월드 반환
          withTags = withTags.filter((w: any) => {
            const ids = (w.tags || []).map((t: any) => Number(t.id));
            return requiredIds.some((rid) => ids.includes(rid));
          });
        } else {
          // AND 조건: 선택한 모든 태그를 가진 게임월드만 반환
          withTags = withTags.filter((w: any) => {
            const ids = (w.tags || []).map((t: any) => Number(t.id));
            return requiredIds.every((rid) => ids.includes(rid));
          });
        }
      }
    }

    res.json({
      success: true,
      data: {
        worlds: withTags,
        total: (worlds as any)?.total ?? ((withTags as any)?.length ?? 0)
      },
      message: 'Game worlds retrieved successfully',
    });
  });

  static getGameWorldById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      throw new CustomError('Invalid game world ID', 400);
    }

    const world = await GameWorldService.getGameWorldById(id);
    const tags = await TagService.listTagsForEntity('game_world', id);

    res.json({
      success: true,
      data: { world: { ...world, tags } },
      message: 'Game world retrieved successfully',
    });
  });

  static getGameWorldByWorldId = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { worldId } = req.params;

    if (!worldId) {
      throw new CustomError('World ID is required', 400);
    }

    const world = await GameWorldService.getGameWorldByWorldId(worldId);
    const tags = await TagService.listTagsForEntity('game_world', world.id);

    res.json({
      success: true,
      data: { world: { ...world, tags } },
      message: 'Game world retrieved successfully',
    });
  });

  static createGameWorld = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Validate request body
    const { error, value } = createGameWorldSchema.validate(req.body);
    if (error) {
      throw new CustomError(error.details[0].message, 400);
    }

    const { tagIds, ...worldValue } = value as any;

    // Resolve authenticated user id from middleware (supports both payload and loaded user)
    const authenticatedUserId = (req as any).userDetails?.id ?? (req as any).user?.id ?? (req as any).user?.userId;
    if (!authenticatedUserId) {
      throw new CustomError('User authentication required', 401);
    }

    const worldData = {
      ...worldValue,
      createdBy: authenticatedUserId,
    };

    const world = await GameWorldService.createGameWorld(worldData);
    if (Array.isArray(tagIds)) {
      await TagService.setTagsForEntity('game_world', world.id, tagIds, authenticatedUserId);
    }
    const tags = await TagService.listTagsForEntity('game_world', world.id);

    // Publish event for SDK real-time updates
    await pubSubService.publishNotification({
      type: 'gameworld.created',
      data: { world: { ...world, tags } },
      targetChannels: ['gameworld', 'admin'],
    });

    // Publish SDK event
    await pubSubService.publishSDKEvent({
      type: 'gameworld.created',
      data: { id: world.id, timestamp: Date.now() },
    });

    res.status(201).json({
      success: true,
      data: { world: { ...world, tags } },
      message: 'Game world created successfully',
    });
  });

  static updateGameWorld = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      throw new CustomError('Invalid game world ID', 400);
    }

    // Validate request body
    const { error, value } = updateGameWorldSchema.validate(req.body);
    if (error) {
      throw new CustomError(error.details[0].message, 400);
    }

    const { tagIds, ...updateValue } = value as any;

    // Add updatedBy from authenticated user session
    const authenticatedUserId = (req as any).userDetails?.id ?? (req as any).user?.id ?? (req as any).user?.userId;
    const updateData = {
      ...updateValue,
      updatedBy: authenticatedUserId
    };

    const world = await GameWorldService.updateGameWorld(id, updateData);
    if (Array.isArray(tagIds)) {
      await TagService.setTagsForEntity('game_world', id, tagIds, authenticatedUserId);
    }
    const tags = await TagService.listTagsForEntity('game_world', id);

    // Publish event for SDK real-time updates
    await pubSubService.publishNotification({
      type: 'gameworld.updated',
      data: { world: { ...world, tags } },
      targetChannels: ['gameworld', 'admin'],
    });

    // Publish SDK event
    await pubSubService.publishSDKEvent({
      type: 'gameworld.updated',
      data: { id: world.id, timestamp: Date.now() },
    });

    res.json({
      success: true,
      data: { world: { ...world, tags } },
      message: 'Game world updated successfully',
    });
  });

  static deleteGameWorld = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      throw new CustomError('Invalid game world ID', 400);
    }

    await GameWorldService.deleteGameWorld(id);

    // Publish event for SDK real-time updates
    await pubSubService.publishNotification({
      type: 'gameworld.deleted',
      data: { worldId: id },
      targetChannels: ['gameworld', 'admin'],
    });

    // Publish SDK event
    await pubSubService.publishSDKEvent({
      type: 'gameworld.deleted',
      data: { id, timestamp: Date.now() },
    });

    res.json({
      success: true,
      message: 'Game world deleted successfully',
    });
  });

  static toggleVisibility = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    logger.info(`GameWorldController.toggleVisibility called for id: ${id}`);

    if (isNaN(id)) {
      throw new CustomError('Invalid game world ID', 400);
    }

    const world = await GameWorldService.toggleVisibility(id);

    res.json({
      success: true,
      data: { world },
      message: 'Game world visibility toggled successfully',
    });
  });

  static toggleMaintenance = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      throw new CustomError('Invalid game world ID', 400);
    }

    const world = await GameWorldService.toggleMaintenance(id);

    res.json({
      success: true,
      data: { world },
      message: 'Game world maintenance status toggled successfully',
    });
  });

  static updateMaintenance = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      throw new CustomError('Invalid game world ID', 400);
    }

    // Validate request body
    const { error, value } = updateMaintenanceSchema.validate(req.body);
    if (error) {
      throw new CustomError(error.details[0].message, 400);
    }

    // Add updatedBy from authenticated user session
    const authenticatedUserId = (req as any).userDetails?.id ?? (req as any).user?.id ?? (req as any).user?.userId;
    const updateData = {
      ...value,
      updatedBy: authenticatedUserId
    };

    const world = await GameWorldService.updateGameWorld(id, updateData);

    res.json({
      success: true,
      data: { world },
      message: 'Game world maintenance status updated successfully',
    });
  });

  static updateDisplayOrders = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { orderUpdates } = req.body;

    if (!Array.isArray(orderUpdates)) {
      throw new CustomError('Order updates must be an array', 400);
    }

    // Validate each update
    for (const update of orderUpdates) {
      if (!update.id || typeof update.displayOrder !== 'number') {
        throw new CustomError('Each update must have id and displayOrder', 400);
      }
    }

    await GameWorldService.updateDisplayOrders(orderUpdates);

    res.json({
      success: true,
      message: 'Display orders updated successfully',
    });
  });

  static moveUp = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      throw new CustomError('Invalid game world ID', 400);
    }

    const moved = await GameWorldService.moveUp(id);

    res.json({
      success: true,
      data: { moved },
      message: moved ? 'Game world moved up successfully' : 'Game world is already at the top',
    });
  });

  static moveDown = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      throw new CustomError('Invalid game world ID', 400);
    }

    const moved = await GameWorldService.moveDown(id);

    res.json({
      success: true,
      data: { moved },
      message: moved ? 'Game world moved down successfully' : 'Game world is already at the bottom',
    });
  });

  static invalidateCache = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await GameWorldService.invalidateCache();

    res.json({
      success: true,
      message: 'Game worlds cache invalidated successfully'
    });
  });
}
