import {
  GameWorldModel,
  GameWorld,
  CreateGameWorldData,
  UpdateGameWorldData,
  GameWorldListParams
} from '../models/GameWorld';
import { GatrixError } from '../middleware/errorHandler';
import { GAME_WORLDS } from '../constants/cacheKeys';
import { createLogger } from '../config/logger';
import { pubSubService } from './PubSubService';
import { applyMaintenanceStatusCalculationToArray, applyMaintenanceStatusCalculation } from '../utils/maintenanceUtils';

const logger = createLogger('GameWorldService');

export class GameWorldService {
  // Deprecated: kept for backward compatibility if referenced elsewhere
  static async getGameWorlds(
    filters: any = {},
    pagination: { page?: number; limit?: number } = {}
  ): Promise<{ data: GameWorld[], total: number }> {
    try {
      const params: GameWorldListParams = {
        ...filters
      } as any;

      const data = await GameWorldModel.list(params);
      // Apply maintenance status calculation based on time constraints
      const processedData = applyMaintenanceStatusCalculationToArray(data);
      return { data: processedData, total: processedData.length };
    } catch (error) {
      logger.error('Error in getGameWorlds service:', error);
      throw new GatrixError('Failed to fetch game worlds', 500);
    }
  }

  static async getAllGameWorlds(params: GameWorldListParams): Promise<GameWorld[]> {
    try {
      const worlds = await GameWorldModel.list(params);
      // Apply maintenance status calculation based on time constraints
      return applyMaintenanceStatusCalculationToArray(worlds);
    } catch (error) {
      logger.error('Error in getAllGameWorlds service:', error);
      throw new GatrixError('Failed to fetch game worlds', 500);
    }
  }

  static async getGameWorldById(id: number): Promise<GameWorld> {
    try {
      const world = await GameWorldModel.findById(id);
      if (!world) {
        throw new GatrixError('Game world not found', 404);
      }
      // Apply maintenance status calculation based on time constraints
      return applyMaintenanceStatusCalculation(world);
    } catch (error) {
      if (error instanceof GatrixError) {
        throw error;
      }
      logger.error('Error in getGameWorldById service:', error);
      throw new GatrixError('Failed to fetch game world', 500);
    }
  }

  static async getGameWorldByWorldId(worldId: string): Promise<GameWorld> {
    try {
      const world = await GameWorldModel.findByWorldId(worldId);
      if (!world) {
        throw new GatrixError('Game world not found', 404);
      }
      return world;
    } catch (error) {
      if (error instanceof GatrixError) {
        throw error;
      }
      logger.error('Error in getGameWorldByWorldId service:', error);
      throw new GatrixError('Failed to fetch game world', 500);
    }
  }

  static async createGameWorld(worldData: CreateGameWorldData): Promise<GameWorld> {
    try {
      const normalized: CreateGameWorldData = {
        ...worldData,
      };

      // Check if worldId already exists
      const existingWorld = await GameWorldModel.findByWorldId(worldData.worldId);
      if (existingWorld) {
        throw new GatrixError('Game world with this world ID already exists', 409);
      }

      const result = await GameWorldModel.create(normalized);

      // Invalidate game worlds cache
      await pubSubService.invalidateKey(GAME_WORLDS.PUBLIC);

      // Publish event for SDK real-time updates
      await pubSubService.publishSDKEvent({
        type: 'gameworld.created',
        data: {
          id: result.id,
          timestamp: Date.now(),
          isVisible: result.isVisible
        },
      });

      return result;
    } catch (error) {
      if (error instanceof GatrixError) {
        throw error;
      }
      logger.error('Error in createGameWorld service:', error);
      throw new GatrixError('Failed to create game world', 500);
    }
  }

  static async updateGameWorld(id: number, worldData: UpdateGameWorldData): Promise<GameWorld> {
    try {
      // Check if game world exists
      const existingWorld = await GameWorldModel.findById(id);
      if (!existingWorld) {
        throw new GatrixError('Game world not found', 404);
      }

      // Check if worldId is being updated and if it conflicts with existing ones
      if (worldData.worldId && worldData.worldId !== existingWorld.worldId) {
        const worldIdExists = await GameWorldModel.exists(worldData.worldId, id);
        if (worldIdExists) {
          throw new GatrixError('Game world with this world ID already exists', 409);
        }
      }

      const updatedWorld = await GameWorldModel.update(id, worldData);
      if (!updatedWorld) {
        throw new GatrixError('Failed to update game world', 500);
      }

      // Invalidate game worlds cache
      await pubSubService.invalidateKey(GAME_WORLDS.PUBLIC);

      // Publish event for SDK real-time updates
      await pubSubService.publishSDKEvent({
        type: 'gameworld.updated',
        data: {
          id: updatedWorld.id,
          timestamp: Date.now(),
          isVisible: updatedWorld.isVisible
        },
      });

      return updatedWorld;
    } catch (error) {
      if (error instanceof GatrixError) {
        throw error;
      }
      logger.error('Error in updateGameWorld service:', error);
      throw new GatrixError('Failed to update game world', 500);
    }
  }

  static async deleteGameWorld(id: number): Promise<void> {
    try {
      // Check if game world exists
      const existingWorld = await GameWorldModel.findById(id);
      if (!existingWorld) {
        throw new GatrixError('Game world not found', 404);
      }

      const deleted = await GameWorldModel.delete(id);
      if (!deleted) {
        throw new GatrixError('Failed to delete game world', 500);
      }

      // Invalidate game worlds cache
      await pubSubService.invalidateKey(GAME_WORLDS.PUBLIC);

      // Publish event for SDK real-time updates
      await pubSubService.publishSDKEvent({
        type: 'gameworld.deleted',
        data: { id, timestamp: Date.now() },
      });
    } catch (error) {
      if (error instanceof GatrixError) {
        throw error;
      }
      logger.error('Error in deleteGameWorld service:', error);
      throw new GatrixError('Failed to delete game world', 500);
    }
  }

  static async toggleVisibility(id: number): Promise<GameWorld> {
    logger.info(`toggleVisibility called for id: ${id}`);
    try {
      const world = await GameWorldModel.findById(id);
      if (!world) {
        throw new GatrixError('Game world not found', 404);
      }

      logger.info(`Current visibility for ${world.worldId}: ${world.isVisible}`);

      const updatedWorld = await GameWorldModel.update(id, {
        isVisible: !world.isVisible
      });

      if (!updatedWorld) {
        throw new GatrixError('Failed to toggle visibility', 500);
      }

      logger.info(`Visibility toggled for ${world.worldId}: ${world.isVisible} -> ${!world.isVisible}`);

      // Invalidate game worlds cache
      logger.info(`Calling cache invalidation for ${GAME_WORLDS.PUBLIC}`);
      await pubSubService.invalidateKey(GAME_WORLDS.PUBLIC);
      logger.info('Cache invalidation completed');

      // Publish event for SDK real-time updates
      await pubSubService.publishSDKEvent({
        type: 'gameworld.updated',
        data: {
          id: updatedWorld.id,
          timestamp: Date.now(),
          isVisible: updatedWorld.isVisible
        },
      });

      return updatedWorld;
    } catch (error) {
      if (error instanceof GatrixError) {
        throw error;
      }
      logger.error('Error in toggleVisibility service:', error);
      throw new GatrixError('Failed to toggle visibility', 500);
    }
  }

  static async toggleMaintenance(id: number): Promise<GameWorld> {
    try {
      const world = await GameWorldModel.findById(id);
      if (!world) {
        throw new GatrixError('Game world not found', 404);
      }

      const updatedWorld = await GameWorldModel.update(id, {
        isMaintenance: !world.isMaintenance
      });

      if (!updatedWorld) {
        throw new GatrixError('Failed to toggle maintenance status', 500);
      }

      // Invalidate game worlds cache
      await pubSubService.invalidateKey(GAME_WORLDS.PUBLIC);

      // Publish event for SDK real-time updates
      await pubSubService.publishSDKEvent({
        type: 'gameworld.updated',
        data: { id: updatedWorld.id, timestamp: Date.now() },
      });

      return updatedWorld;
    } catch (error) {
      if (error instanceof GatrixError) {
        throw error;
      }
      logger.error('Error in toggleMaintenance service:', error);
      throw new GatrixError('Failed to toggle maintenance status', 500);
    }
  }

  static async updateDisplayOrders(orderUpdates: { id: number; displayOrder: number }[]): Promise<void> {
    try {
      await GameWorldModel.updateDisplayOrders(orderUpdates);

      // Invalidate all game worlds cache (both public and admin)
      await pubSubService.invalidateKey(GAME_WORLDS.PUBLIC);
      await pubSubService.invalidateKey(GAME_WORLDS.ADMIN);

      // Publish event for SDK to clear entire game worlds cache
      await pubSubService.publishSDKEvent({
        type: 'gameworld.order_changed',
        data: {
          id: 0, // Dummy id for order_changed event
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      logger.error('Error in updateDisplayOrders service:', error);
      throw new GatrixError('Failed to update display orders', 500);
    }
  }

  static async moveUp(id: number): Promise<boolean> {
    try {
      const result = await GameWorldModel.moveUp(id);

      // Invalidate game worlds cache
      await pubSubService.invalidateKey(GAME_WORLDS.PUBLIC);

      return result;
    } catch (error) {
      logger.error('Error in moveUp service:', error);
      throw new GatrixError('Failed to move world up', 500);
    }
  }

  static async moveDown(id: number): Promise<boolean> {
    try {
      const result = await GameWorldModel.moveDown(id);

      // Invalidate game worlds cache
      await pubSubService.invalidateKey(GAME_WORLDS.PUBLIC);

      return result;
    } catch (error) {
      logger.error('Error in moveDown service:', error);
      throw new GatrixError('Failed to move world down', 500);
    }
  }

  static async invalidateCache(): Promise<void> {
    try {
      // Invalidate game worlds cache
      await pubSubService.invalidateKey(GAME_WORLDS.PUBLIC);
    } catch (error) {
      logger.error('Error in invalidateCache service:', error);
      throw new GatrixError('Failed to invalidate cache', 500);
    }
  }

  /**
   * Get maintenance message for a game world in specified language
   * @param worldId - Game world ID
   * @param lang - Language code (ko, en, zh)
   * @returns Maintenance message or null if not found
   */
  static async getMaintenanceMessage(worldId: number, lang: string = 'en'): Promise<string | null> {
    try {
      const world = await GameWorldModel.findById(worldId);
      if (!world) {
        return null;
      }

      // If world has multi-language support, try to get localized message
      if (world.supportsMultiLanguage && world.maintenanceLocales && Array.isArray(world.maintenanceLocales)) {
        const locale = world.maintenanceLocales.find((l: any) => l.lang === lang);
        if (locale) {
          return locale.message;
        }
        // Fallback to first available locale if requested language not found
        if (world.maintenanceLocales.length > 0) {
          return world.maintenanceLocales[0].message;
        }
      }

      // Return default maintenance message if available
      return world.maintenanceMessage || null;
    } catch (error) {
      logger.error(`Error in getMaintenanceMessage service for world ${worldId}:`, error);
      return null;
    }
  }
}
