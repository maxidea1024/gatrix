import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import { GameWorldService } from '../services/GameWorldService';
import { CustomError } from '../middleware/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import Joi from 'joi';

// Validation schemas
const createGameWorldSchema = Joi.object({
  worldId: Joi.string().min(1).max(100).required(),
  name: Joi.string().min(1).max(255).required(),
  isVisible: Joi.boolean().optional(),
  isMaintenance: Joi.boolean().optional(),
  displayOrder: Joi.number().integer().optional(),
  description: Joi.string().max(1000).optional().allow('')
});

const updateGameWorldSchema = Joi.object({
  worldId: Joi.string().min(1).max(100).optional(),
  name: Joi.string().min(1).max(255).optional(),
  isVisible: Joi.boolean().optional(),
  isMaintenance: Joi.boolean().optional(),
  displayOrder: Joi.number().integer().optional(),
  description: Joi.string().max(1000).optional().allow('')
});

const listGameWorldsSchema = Joi.object({
  search: Joi.string().max(255).optional().allow(''),
  sortBy: Joi.string().valid('name', 'worldId', 'displayOrder', 'createdAt', 'updatedAt').optional(),
  sortOrder: Joi.string().valid('ASC', 'DESC').optional(),
  isVisible: Joi.boolean().optional(),
  isMaintenance: Joi.boolean().optional()
});

export class GameWorldController {
  static getGameWorlds = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Validate query parameters
    const { error, value } = listGameWorldsSchema.validate(req.query);
    if (error) {
      throw new CustomError(error.details[0].message, 400);
    }

    const worlds = await GameWorldService.getGameWorlds(value);

    res.json({
      success: true,
      data: {
        worlds,
        total: worlds.length
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

    res.json({
      success: true,
      data: { world },
      message: 'Game world retrieved successfully',
    });
  });

  static getGameWorldByWorldId = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { worldId } = req.params;

    if (!worldId) {
      throw new CustomError('World ID is required', 400);
    }

    const world = await GameWorldService.getGameWorldByWorldId(worldId);

    res.json({
      success: true,
      data: { world },
      message: 'Game world retrieved successfully',
    });
  });

  static createGameWorld = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Validate request body
    const { error, value } = createGameWorldSchema.validate(req.body);
    if (error) {
      throw new CustomError(error.details[0].message, 400);
    }

    const world = await GameWorldService.createGameWorld(value);

    res.status(201).json({
      success: true,
      data: { world },
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

    const world = await GameWorldService.updateGameWorld(id, value);

    res.json({
      success: true,
      data: { world },
      message: 'Game world updated successfully',
    });
  });

  static deleteGameWorld = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      throw new CustomError('Invalid game world ID', 400);
    }

    await GameWorldService.deleteGameWorld(id);

    res.json({
      success: true,
      message: 'Game world deleted successfully',
    });
  });

  static toggleVisibility = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);

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

  static updateDisplayOrders = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { orderUpdates } = req.body;

    console.log('Received order updates request:', { orderUpdates, userId: req.user?.id });

    if (!Array.isArray(orderUpdates)) {
      throw new CustomError('Order updates must be an array', 400);
    }

    // Validate each update
    for (const update of orderUpdates) {
      if (!update.id || typeof update.displayOrder !== 'number') {
        throw new CustomError('Each update must have id and displayOrder', 400);
      }
    }

    console.log('Validation passed, updating display orders...');
    await GameWorldService.updateDisplayOrders(orderUpdates);
    console.log('Display orders updated successfully');

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
}
