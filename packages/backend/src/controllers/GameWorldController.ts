import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import { GameWorldService } from '../services/GameWorldService';
import { TagService } from '../services/TagService';
import { GatrixError } from '../middleware/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../config/logger';
import Joi from 'joi';
import { pubSubService } from '../services/PubSubService';

// Allow full URLs (scheme://host[:port][...]) or host[:port] without scheme
// Examples: https://world.example.com, world.example.com:8080, world.example.com, 192.168.1.100:8080, 192.168.1.100
const WORLD_SERVER_ADDRESS_REGEX = /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:\/\/\S+|[a-zA-Z0-9.-]+(:\d+)?)$/;

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
  forceDisconnect: Joi.boolean().optional().default(false),
  gracePeriodMinutes: Joi.number().integer().min(0).max(60).optional().default(5),
  customPayload: Joi.object().unknown(true).optional().default({}),
  infraSettings: Joi.object().unknown(true).optional().allow(null).default(null),
  infraSettingsRaw: Joi.string().optional().allow(null, '').default(null),
  worldServerAddress: Joi.string().pattern(WORLD_SERVER_ADDRESS_REGEX).max(255).required().messages({
    'string.pattern.base': 'worldServerAddress must be a valid URL, domain, IP, or host:port (e.g., https://world.example.com, world.example.com, 192.168.1.100:8080)',
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
  forceDisconnect: Joi.boolean().optional().default(false),
  gracePeriodMinutes: Joi.number().integer().min(0).max(60).optional().default(5),
  customPayload: Joi.object().unknown(true).optional().allow(null),
  infraSettings: Joi.object().unknown(true).optional().allow(null),
  infraSettingsRaw: Joi.string().optional().allow(null, ''),
  worldServerAddress: Joi.string().pattern(WORLD_SERVER_ADDRESS_REGEX).max(255).optional().messages({
    'string.pattern.base': 'worldServerAddress must be a valid URL, domain, IP, or host:port (e.g., https://world.example.com, world.example.com, 192.168.1.100:8080)'
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
  forceDisconnect: Joi.boolean().optional().default(false),
  gracePeriodMinutes: Joi.number().integer().min(0).max(60).optional().default(5),
});

export class GameWorldController {
  static getGameWorlds = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = req.environment;

    // If no environment is provided, return empty list (happens during initial frontend load)
    if (!environment) {
      return res.json({
        success: true,
        data: {
          worlds: [],
          total: 0
        },
        message: 'No environment selected',
      });
    }

    const worlds = await GameWorldService.getGameWorlds({
      ...req.query,
      environment
    });

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
    const environment = req.environment;

    if (isNaN(id)) {
      throw new GatrixError('Invalid game world ID', 400);
    }

    if (!environment) {
      throw new GatrixError('Environment is required', 400);
    }

    const world = await GameWorldService.getGameWorldById(id, environment);
    const tags = await TagService.listTagsForEntity('game_world', id);

    res.json({
      success: true,
      data: { world: { ...world, tags } },
      message: 'Game world retrieved successfully',
    });
  });

  static getGameWorldByWorldId = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { worldId } = req.params;
    const environment = req.environment;

    if (!worldId) {
      throw new GatrixError('World ID is required', 400);
    }

    if (!environment) {
      throw new GatrixError('Environment is required', 400);
    }

    const world = await GameWorldService.getGameWorldByWorldId(worldId, environment);
    const tags = await TagService.listTagsForEntity('game_world', world.id);

    res.json({
      success: true,
      data: { world: { ...world, tags } },
      message: 'Game world retrieved successfully',
    });
  });

  static createGameWorld = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = req.environment;
    if (!environment) {
      throw new GatrixError('Environment is required', 400);
    }

    // Validate request body
    const { error, value } = createGameWorldSchema.validate(req.body);
    if (error) {
      throw new GatrixError(error.details[0].message, 400);
    }

    const { tagIds, ...worldValue } = value as any;

    // Validate time settings
    if (worldValue.isMaintenance) {
      const startsAt = worldValue.maintenanceStartDate ? new Date(worldValue.maintenanceStartDate) : null;
      const endsAt = worldValue.maintenanceEndDate ? new Date(worldValue.maintenanceEndDate) : null;
      const now = new Date();

      // If both times are set, endsAt must be after startsAt
      if (startsAt && endsAt && endsAt <= startsAt) {
        throw new GatrixError('End time must be after start time.', 400);
      }

      // If only endsAt is set, it must be in the future
      if (!startsAt && endsAt) {
        if (endsAt <= now) {
          throw new GatrixError('End time must be in the future.', 400);
        }
      }
    }

    // Resolve authenticated user id from middleware (supports both payload and loaded user)
    const authenticatedUserId = req.user?.userId;
    if (!authenticatedUserId) {
      throw new GatrixError('User authentication required', 401);
    }

    const worldData = {
      ...worldValue,
      createdBy: authenticatedUserId,
    };

    const world = await GameWorldService.createGameWorld(worldData, environment);
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

    res.status(201).json({
      success: true,
      data: { world: { ...world, tags } },
      message: 'Game world created successfully',
    });
  });

  static updateGameWorld = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const environment = req.environment;

    if (isNaN(id)) {
      throw new GatrixError('Invalid game world ID', 400);
    }

    if (!environment) {
      throw new GatrixError('Environment is required', 400);
    }

    // Validate request body
    const { error, value } = updateGameWorldSchema.validate(req.body);
    if (error) {
      throw new GatrixError(error.details[0].message, 400);
    }

    const { tagIds, ...updateValue } = value as any;

    // Validate time settings
    if (updateValue.isMaintenance) {
      const startsAt = updateValue.maintenanceStartDate ? new Date(updateValue.maintenanceStartDate) : null;
      const endsAt = updateValue.maintenanceEndDate ? new Date(updateValue.maintenanceEndDate) : null;
      const now = new Date();

      // If both times are set, endsAt must be after startsAt
      if (startsAt && endsAt && endsAt <= startsAt) {
        throw new GatrixError('End time must be after start time.', 400);
      }

      // If only endsAt is set, it must be in the future
      if (!startsAt && endsAt) {
        if (endsAt <= now) {
          throw new GatrixError('End time must be in the future.', 400);
        }
      }
    }

    // Add updatedBy from authenticated user session
    const authenticatedUserId = req.user?.userId;
    const updateData = {
      ...updateValue,
      updatedBy: authenticatedUserId
    };

    const world = await GameWorldService.updateGameWorld(id, updateData, environment);
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

    res.json({
      success: true,
      data: { world: { ...world, tags } },
      message: 'Game world updated successfully',
    });
  });

  static deleteGameWorld = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const environment = req.environment;

    if (isNaN(id)) {
      throw new GatrixError('Invalid game world ID', 400);
    }

    if (!environment) {
      throw new GatrixError('Environment is required', 400);
    }

    await GameWorldService.deleteGameWorld(id, environment);

    // Publish event for SDK real-time updates
    await pubSubService.publishNotification({
      type: 'gameworld.deleted',
      data: { worldId: id },
      targetChannels: ['gameworld', 'admin'],
    });

    res.json({
      success: true,
      message: 'Game world deleted successfully',
    });
  });

  static toggleVisibility = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const environment = req.environment;
    logger.info(`GameWorldController.toggleVisibility called for id: ${id}`);

    if (isNaN(id)) {
      throw new GatrixError('Invalid game world ID', 400);
    }

    if (!environment) {
      throw new GatrixError('Environment is required', 400);
    }

    const world = await GameWorldService.toggleVisibility(id, environment);

    res.json({
      success: true,
      data: { world },
      message: 'Game world visibility toggled successfully',
    });
  });

  static toggleMaintenance = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const environment = req.environment;

    if (isNaN(id)) {
      throw new GatrixError('Invalid game world ID', 400);
    }

    if (!environment) {
      throw new GatrixError('Environment is required', 400);
    }

    const world = await GameWorldService.toggleMaintenance(id, environment);

    res.json({
      success: true,
      data: { world },
      message: 'Game world maintenance status toggled successfully',
    });
  });

  static updateMaintenance = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const environment = req.environment;

    if (isNaN(id)) {
      throw new GatrixError('Invalid game world ID', 400);
    }

    if (!environment) {
      throw new GatrixError('Environment is required', 400);
    }

    // Validate request body
    const { error, value } = updateMaintenanceSchema.validate(req.body);
    if (error) {
      throw new GatrixError(error.details[0].message, 400);
    }

    // Validate time settings
    if (value.isMaintenance) {
      const startsAt = value.maintenanceStartDate ? new Date(value.maintenanceStartDate) : null;
      const endsAt = value.maintenanceEndDate ? new Date(value.maintenanceEndDate) : null;
      const now = new Date();

      // If both times are set, endsAt must be after startsAt
      if (startsAt && endsAt && endsAt <= startsAt) {
        throw new GatrixError('End time must be after start time.', 400);
      }

      // If only endsAt is set, it must be in the future
      if (!startsAt && endsAt) {
        if (endsAt <= now) {
          throw new GatrixError('End time must be in the future.', 400);
        }
      }

      // Validate minimum duration (5 minutes)
      if (endsAt) {
        const effectiveStart = startsAt || now;
        const durationMinutes = (endsAt.getTime() - effectiveStart.getTime()) / 60000;

        if (durationMinutes < 5) {
          throw new GatrixError(
            `Maintenance duration must be at least 5 minutes. (Current: ${Math.max(0, Math.floor(durationMinutes))} min)`,
            400
          );
        }

        // Validate grace period does not exceed duration
        if (value.forceDisconnect && value.gracePeriodMinutes !== undefined) {
          if (value.gracePeriodMinutes >= durationMinutes) {
            throw new GatrixError(
              `Grace period must be shorter than maintenance duration. (Duration: ${Math.floor(durationMinutes)} min, Grace period: ${value.gracePeriodMinutes} min)`,
              400
            );
          }
        }
      }
    }

    // Add updatedBy from authenticated user session
    const authenticatedUserId = req.user?.userId;
    const updateData = {
      ...value,
      updatedBy: authenticatedUserId
    };

    const world = await GameWorldService.updateGameWorld(id, updateData, environment);

    res.json({
      success: true,
      data: { world },
      message: 'Game world maintenance status updated successfully',
    });
  });

  static updateDisplayOrders = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { orderUpdates } = req.body;
    const environment = req.environment;

    if (!environment) {
      throw new GatrixError('Environment is required', 400);
    }

    if (!Array.isArray(orderUpdates)) {
      throw new GatrixError('Order updates must be an array', 400);
    }

    // Validate each update
    for (const update of orderUpdates) {
      if (!update.id || typeof update.displayOrder !== 'number') {
        throw new GatrixError('Each update must have id and displayOrder', 400);
      }
    }

    await GameWorldService.updateDisplayOrders(orderUpdates, environment);

    res.json({
      success: true,
      message: 'Display orders updated successfully',
    });
  });

  static moveUp = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const environment = req.environment;

    if (isNaN(id)) {
      throw new GatrixError('Invalid game world ID', 400);
    }

    if (!environment) {
      throw new GatrixError('Environment is required', 400);
    }

    const moved = await GameWorldService.moveUp(id, environment);

    res.json({
      success: true,
      data: { moved },
      message: moved ? 'Game world moved up successfully' : 'Game world is already at the top',
    });
  });

  static moveDown = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const environment = req.environment;

    if (isNaN(id)) {
      throw new GatrixError('Invalid game world ID', 400);
    }

    if (!environment) {
      throw new GatrixError('Environment is required', 400);
    }

    const moved = await GameWorldService.moveDown(id, environment);

    res.json({
      success: true,
      data: { moved },
      message: moved ? 'Game world moved down successfully' : 'Game world is already at the bottom',
    });
  });

  static invalidateCache = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = req.environment;

    if (!environment) {
      throw new GatrixError('Environment is required', 400);
    }

    await GameWorldService.invalidateCache(environment);

    res.json({
      success: true,
      message: 'Game worlds cache invalidated successfully'
    });
  });
}
