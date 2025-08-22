import {
  GameWorldModel,
  GameWorld,
  CreateGameWorldData,
  UpdateGameWorldData,
  GameWorldListParams
} from '../models/GameWorld';
import { CustomError } from '../middleware/errorHandler';
import logger from '../config/logger';

export class GameWorldService {
  static async getGameWorlds(params: GameWorldListParams): Promise<GameWorld[]> {
    try {
      return await GameWorldModel.list(params);
    } catch (error) {
      logger.error('Error in getGameWorlds service:', error);
      throw new CustomError('Failed to fetch game worlds', 500);
    }
  }

  static async getGameWorldById(id: number): Promise<GameWorld> {
    try {
      const world = await GameWorldModel.findById(id);
      if (!world) {
        throw new CustomError('Game world not found', 404);
      }
      return world;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Error in getGameWorldById service:', error);
      throw new CustomError('Failed to fetch game world', 500);
    }
  }

  static async getGameWorldByWorldId(worldId: string): Promise<GameWorld> {
    try {
      const world = await GameWorldModel.findByWorldId(worldId);
      if (!world) {
        throw new CustomError('Game world not found', 404);
      }
      return world;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Error in getGameWorldByWorldId service:', error);
      throw new CustomError('Failed to fetch game world', 500);
    }
  }

  static async createGameWorld(worldData: CreateGameWorldData): Promise<GameWorld> {
    try {
      // Check if worldId already exists
      const existingWorld = await GameWorldModel.findByWorldId(worldData.worldId);
      if (existingWorld) {
        throw new CustomError('Game world with this world ID already exists', 409);
      }

      return await GameWorldModel.create(worldData);
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Error in createGameWorld service:', error);
      throw new CustomError('Failed to create game world', 500);
    }
  }

  static async updateGameWorld(id: number, worldData: UpdateGameWorldData): Promise<GameWorld> {
    try {
      // Check if game world exists
      const existingWorld = await GameWorldModel.findById(id);
      if (!existingWorld) {
        throw new CustomError('Game world not found', 404);
      }

      // Check if worldId is being updated and if it conflicts with existing ones
      if (worldData.worldId && worldData.worldId !== existingWorld.worldId) {
        const worldIdExists = await GameWorldModel.exists(worldData.worldId, id);
        if (worldIdExists) {
          throw new CustomError('Game world with this world ID already exists', 409);
        }
      }

      const updatedWorld = await GameWorldModel.update(id, worldData);
      if (!updatedWorld) {
        throw new CustomError('Failed to update game world', 500);
      }

      return updatedWorld;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Error in updateGameWorld service:', error);
      throw new CustomError('Failed to update game world', 500);
    }
  }

  static async deleteGameWorld(id: number): Promise<void> {
    try {
      // Check if game world exists
      const existingWorld = await GameWorldModel.findById(id);
      if (!existingWorld) {
        throw new CustomError('Game world not found', 404);
      }

      const deleted = await GameWorldModel.delete(id);
      if (!deleted) {
        throw new CustomError('Failed to delete game world', 500);
      }
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Error in deleteGameWorld service:', error);
      throw new CustomError('Failed to delete game world', 500);
    }
  }

  static async toggleVisibility(id: number): Promise<GameWorld> {
    try {
      const world = await GameWorldModel.findById(id);
      if (!world) {
        throw new CustomError('Game world not found', 404);
      }

      const updatedWorld = await GameWorldModel.update(id, {
        isVisible: !world.isVisible
      });

      if (!updatedWorld) {
        throw new CustomError('Failed to toggle visibility', 500);
      }

      return updatedWorld;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Error in toggleVisibility service:', error);
      throw new CustomError('Failed to toggle visibility', 500);
    }
  }

  static async toggleMaintenance(id: number): Promise<GameWorld> {
    try {
      const world = await GameWorldModel.findById(id);
      if (!world) {
        throw new CustomError('Game world not found', 404);
      }

      const updatedWorld = await GameWorldModel.update(id, {
        isMaintenance: !world.isMaintenance
      });

      if (!updatedWorld) {
        throw new CustomError('Failed to toggle maintenance status', 500);
      }

      return updatedWorld;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Error in toggleMaintenance service:', error);
      throw new CustomError('Failed to toggle maintenance status', 500);
    }
  }

  static async updateDisplayOrders(orderUpdates: { id: number; displayOrder: number }[]): Promise<void> {
    try {
      await GameWorldModel.updateDisplayOrders(orderUpdates);
    } catch (error) {
      logger.error('Error in updateDisplayOrders service:', error);
      throw new CustomError('Failed to update display orders', 500);
    }
  }

  static async moveUp(id: number): Promise<boolean> {
    try {
      return await GameWorldModel.moveUp(id);
    } catch (error) {
      logger.error('Error in moveUp service:', error);
      throw new CustomError('Failed to move world up', 500);
    }
  }

  static async moveDown(id: number): Promise<boolean> {
    try {
      return await GameWorldModel.moveDown(id);
    } catch (error) {
      logger.error('Error in moveDown service:', error);
      throw new CustomError('Failed to move world down', 500);
    }
  }
}
