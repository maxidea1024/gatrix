import {
  GameWorldModel,
  GameWorld,
  CreateGameWorldData,
  UpdateGameWorldData,
  GameWorldListParams,
} from "../models/GameWorld";
import { GatrixError } from "../middleware/errorHandler";
import { ENV_SCOPED, allEnvironmentsPattern } from "../constants/cacheKeys";
import { createLogger } from "../config/logger";
import { pubSubService } from "./PubSubService";

const logger = createLogger("GameWorldService");

export class GameWorldService {
  // Deprecated: kept for backward compatibility if referenced elsewhere
  static async getGameWorlds(
    filters: any = {},
    pagination: { page?: number; limit?: number } = {},
  ): Promise<{ data: GameWorld[]; total: number }> {
    try {
      const params: GameWorldListParams = {
        ...filters,
      } as any;

      const data = await GameWorldModel.list(params);
      // Return worlds as-is without modifying isMaintenance
      // isMaintenance represents whether maintenance is configured, not whether it's currently active
      return { data, total: data.length };
    } catch (error) {
      logger.error("Error in getGameWorlds service:", error);
      throw new GatrixError("Failed to fetch game worlds", 500);
    }
  }

  static async getAllGameWorlds(
    params: GameWorldListParams,
  ): Promise<GameWorld[]> {
    try {
      const worlds = await GameWorldModel.list(params);
      // Return worlds as-is without modifying isMaintenance
      // isMaintenance represents whether maintenance is configured, not whether it's currently active
      return worlds;
    } catch (error) {
      logger.error("Error in getAllGameWorlds service:", error);
      throw new GatrixError("Failed to fetch game worlds", 500);
    }
  }

  static async getGameWorldById(
    id: number,
    environment: string,
  ): Promise<GameWorld> {
    try {
      const world = await GameWorldModel.findById(id, environment);
      if (!world) {
        throw new GatrixError("Game world not found", 404);
      }
      // Return world as-is without modifying isMaintenance
      // isMaintenance represents whether maintenance is configured, not whether it's currently active
      return world;
    } catch (error) {
      if (error instanceof GatrixError) {
        throw error;
      }
      logger.error("Error in getGameWorldById service:", error);
      throw new GatrixError("Failed to fetch game world", 500);
    }
  }

  static async getGameWorldByWorldId(
    worldId: string,
    environment: string,
  ): Promise<GameWorld> {
    try {
      const world = await GameWorldModel.findByWorldId(worldId, environment);
      if (!world) {
        throw new GatrixError("Game world not found", 404);
      }
      return world;
    } catch (error) {
      if (error instanceof GatrixError) {
        throw error;
      }
      logger.error("Error in getGameWorldByWorldId service:", error);
      throw new GatrixError("Failed to fetch game world", 500);
    }
  }

  static async createGameWorld(
    worldData: CreateGameWorldData,
    environment: string,
  ): Promise<GameWorld> {
    try {
      const normalized: CreateGameWorldData = {
        ...worldData,
      };

      // Check if worldId already exists
      const existingWorld = await GameWorldModel.findByWorldId(
        worldData.worldId,
        environment,
      );
      if (existingWorld) {
        throw new GatrixError(
          "Game world with this world ID already exists",
          409,
        );
      }

      const result = await GameWorldModel.create(normalized, environment);

      // Invalidate game worlds cache (environment-scoped)
      await pubSubService.invalidateKey(
        `${ENV_SCOPED.GAME_WORLDS.PUBLIC}:${environment}`,
      );
      await pubSubService.invalidateKey(
        `${ENV_SCOPED.SDK_ETAG.GAME_WORLDS}:${environment}`,
      );

      // Publish event for SDK real-time updates
      await pubSubService.publishSDKEvent({
        type: "gameworld.created",
        data: {
          id: result.id,
          timestamp: Date.now(),
          isVisible: result.isVisible,
          environment: environment,
        },
      });

      return result;
    } catch (error) {
      if (error instanceof GatrixError) {
        throw error;
      }
      logger.error("Error in createGameWorld service:", error);
      throw new GatrixError("Failed to create game world", 500);
    }
  }

  static async updateGameWorld(
    id: number,
    worldData: UpdateGameWorldData,
    environment: string,
  ): Promise<GameWorld> {
    try {
      // Check if game world exists
      const existingWorld = await GameWorldModel.findById(id, environment);
      if (!existingWorld) {
        throw new GatrixError("Game world not found", 404);
      }

      // Check if worldId is being updated and if it conflicts with existing ones
      if (worldData.worldId && worldData.worldId !== existingWorld.worldId) {
        const worldIdExists = await GameWorldModel.exists(
          worldData.worldId,
          id,
          environment,
        );
        if (worldIdExists) {
          throw new GatrixError(
            "Game world with this world ID already exists",
            409,
          );
        }
      }

      const updatedWorld = await GameWorldModel.update(
        id,
        worldData,
        environment,
      );
      if (!updatedWorld) {
        throw new GatrixError("Failed to update game world", 500);
      }

      // Invalidate game worlds cache (environment-scoped)
      await pubSubService.invalidateKey(
        `${ENV_SCOPED.GAME_WORLDS.PUBLIC}:${environment}`,
      );
      await pubSubService.invalidateKey(
        `${ENV_SCOPED.SDK_ETAG.GAME_WORLDS}:${environment}`,
      );

      // Publish event for SDK real-time updates
      await pubSubService.publishSDKEvent({
        type: "gameworld.updated",
        data: {
          id: updatedWorld.id,
          timestamp: Date.now(),
          isVisible: updatedWorld.isVisible,
          environment: environment,
        },
      });

      return updatedWorld;
    } catch (error) {
      if (error instanceof GatrixError) {
        throw error;
      }
      logger.error("Error in updateGameWorld service:", error);
      throw new GatrixError("Failed to update game world", 500);
    }
  }

  static async deleteGameWorld(id: number, environment: string): Promise<void> {
    try {
      // Check if game world exists
      const existingWorld = await GameWorldModel.findById(id, environment);
      if (!existingWorld) {
        throw new GatrixError("Game world not found", 404);
      }

      const deleted = await GameWorldModel.delete(id, environment);
      if (!deleted) {
        throw new GatrixError("Failed to delete game world", 500);
      }

      // Invalidate game worlds cache (environment-scoped)
      await pubSubService.invalidateKey(
        `${ENV_SCOPED.GAME_WORLDS.PUBLIC}:${environment}`,
      );
      await pubSubService.invalidateKey(
        `${ENV_SCOPED.SDK_ETAG.GAME_WORLDS}:${environment}`,
      );

      // Publish event for SDK real-time updates
      await pubSubService.publishSDKEvent({
        type: "gameworld.deleted",
        data: {
          id,
          timestamp: Date.now(),
          environment: environment,
        },
      });
    } catch (error) {
      if (error instanceof GatrixError) {
        throw error;
      }
      logger.error("Error in deleteGameWorld service:", error);
      throw new GatrixError("Failed to delete game world", 500);
    }
  }

  static async toggleVisibility(
    id: number,
    environment: string,
  ): Promise<GameWorld> {
    logger.info(`toggleVisibility called for id: ${id}`);
    try {
      const world = await GameWorldModel.findById(id, environment);
      if (!world) {
        throw new GatrixError("Game world not found", 404);
      }

      logger.info(
        `Current visibility for ${world.worldId}: ${world.isVisible}`,
      );

      const updatedWorld = await GameWorldModel.update(
        id,
        {
          isVisible: !world.isVisible,
        },
        environment,
      );

      if (!updatedWorld) {
        throw new GatrixError("Failed to toggle visibility", 500);
      }

      logger.info(
        `Visibility toggled for ${world.worldId}: ${world.isVisible} -> ${!world.isVisible}`,
      );

      // Invalidate game worlds cache (environment-scoped)
      const cacheKey = `${ENV_SCOPED.GAME_WORLDS.PUBLIC}:${environment}`;
      logger.info(`Calling cache invalidation for ${cacheKey}`);
      await pubSubService.invalidateKey(cacheKey);
      await pubSubService.invalidateKey(
        `${ENV_SCOPED.SDK_ETAG.GAME_WORLDS}:${environment}`,
      );
      logger.info("Cache invalidation completed");

      // Publish event for SDK real-time updates
      await pubSubService.publishSDKEvent({
        type: "gameworld.updated",
        data: {
          id: updatedWorld.id,
          timestamp: Date.now(),
          isVisible: updatedWorld.isVisible,
          environment: environment,
        },
      });

      return updatedWorld;
    } catch (error) {
      if (error instanceof GatrixError) {
        throw error;
      }
      logger.error("Error in toggleVisibility service:", error);
      throw new GatrixError("Failed to toggle visibility", 500);
    }
  }

  static async toggleMaintenance(
    id: number,
    environment: string,
  ): Promise<GameWorld> {
    try {
      const world = await GameWorldModel.findById(id, environment);
      if (!world) {
        throw new GatrixError("Game world not found", 404);
      }

      const updatedWorld = await GameWorldModel.update(
        id,
        {
          isMaintenance: !world.isMaintenance,
        },
        environment,
      );

      if (!updatedWorld) {
        throw new GatrixError("Failed to toggle maintenance status", 500);
      }

      // Invalidate game worlds cache (environment-scoped)
      await pubSubService.invalidateKey(
        `${ENV_SCOPED.GAME_WORLDS.PUBLIC}:${environment}`,
      );
      await pubSubService.invalidateKey(
        `${ENV_SCOPED.SDK_ETAG.GAME_WORLDS}:${environment}`,
      );

      // Publish event for SDK real-time updates
      await pubSubService.publishSDKEvent({
        type: "gameworld.updated",
        data: {
          id: updatedWorld.id,
          timestamp: Date.now(),
          environment: environment,
        },
      });

      return updatedWorld;
    } catch (error) {
      if (error instanceof GatrixError) {
        throw error;
      }
      logger.error("Error in toggleMaintenance service:", error);
      throw new GatrixError("Failed to toggle maintenance status", 500);
    }
  }

  static async updateDisplayOrders(
    orderUpdates: { id: number; displayOrder: number }[],
    environment: string,
  ): Promise<void> {
    try {
      await GameWorldModel.updateDisplayOrders(orderUpdates, environment);

      // Invalidate all game worlds cache (both public and admin, environment-scoped)
      await pubSubService.invalidateKey(
        `${ENV_SCOPED.GAME_WORLDS.PUBLIC}:${environment}`,
      );
      await pubSubService.invalidateKey(
        `${ENV_SCOPED.GAME_WORLDS.ADMIN}:${environment}`,
      );
      await pubSubService.invalidateKey(
        `${ENV_SCOPED.SDK_ETAG.GAME_WORLDS}:${environment}`,
      );

      // Publish event for SDK to clear entire game worlds cache
      await pubSubService.publishSDKEvent({
        type: "gameworld.order_changed",
        data: {
          id: 0, // Dummy id for order_changed event
          timestamp: Date.now(),
          environment: environment,
        },
      });
    } catch (error) {
      logger.error("Error in updateDisplayOrders service:", error);
      throw new GatrixError("Failed to update display orders", 500);
    }
  }

  static async moveUp(id: number, environment: string): Promise<boolean> {
    try {
      const result = await GameWorldModel.moveUp(id, environment);

      // Invalidate game worlds cache (environment-scoped)
      await pubSubService.invalidateKey(
        `${ENV_SCOPED.GAME_WORLDS.PUBLIC}:${environment}`,
      );
      await pubSubService.invalidateKey(
        `${ENV_SCOPED.SDK_ETAG.GAME_WORLDS}:${environment}`,
      );

      return result;
    } catch (error) {
      logger.error("Error in moveUp service:", error);
      throw new GatrixError("Failed to move world up", 500);
    }
  }

  static async moveDown(id: number, environment: string): Promise<boolean> {
    try {
      const result = await GameWorldModel.moveDown(id, environment);

      // Invalidate game worlds cache (environment-scoped)
      await pubSubService.invalidateKey(
        `${ENV_SCOPED.GAME_WORLDS.PUBLIC}:${environment}`,
      );
      await pubSubService.invalidateKey(
        `${ENV_SCOPED.SDK_ETAG.GAME_WORLDS}:${environment}`,
      );

      return result;
    } catch (error) {
      logger.error("Error in moveDown service:", error);
      throw new GatrixError("Failed to move world down", 500);
    }
  }

  static async invalidateCache(environment: string): Promise<void> {
    try {
      // Invalidate game worlds cache (environment-scoped)
      await pubSubService.invalidateKey(
        `${ENV_SCOPED.GAME_WORLDS.PUBLIC}:${environment}`,
      );
      await pubSubService.invalidateKey(
        `${ENV_SCOPED.SDK_ETAG.GAME_WORLDS}:${environment}`,
      );
    } catch (error) {
      logger.error("Error in invalidateCache service:", error);
      throw new GatrixError("Failed to invalidate cache", 500);
    }
  }

  /**
   * Invalidate cache for all environments
   * Used when data changes affect all environments
   */
  static async invalidateCacheAllEnvironments(): Promise<void> {
    try {
      // Invalidate game worlds cache for all environments
      await pubSubService.invalidateByPattern(
        allEnvironmentsPattern("game_world*"),
      );
      await pubSubService.invalidateByPattern(
        allEnvironmentsPattern("server_sdk:etag:game_worlds"),
      );
    } catch (error) {
      logger.error("Error in invalidateCacheAllEnvironments service:", error);
      throw new GatrixError(
        "Failed to invalidate cache for all environments",
        500,
      );
    }
  }

  /**
   * Get maintenance message for a game world in specified language
   * @param worldId - Game world ID
   * @param environment - Environment name
   * @param lang - Language code (ko, en, zh)
   * @returns Maintenance message or null if not found
   */
  static async getMaintenanceMessage(
    worldId: number,
    environment: string,
    lang: string = "en",
  ): Promise<string | null> {
    try {
      const world = await GameWorldModel.findById(worldId, environment);
      if (!world) {
        return null;
      }

      // If world has multi-language support, try to get localized message
      if (
        world.supportsMultiLanguage &&
        world.maintenanceLocales &&
        Array.isArray(world.maintenanceLocales)
      ) {
        const locale = world.maintenanceLocales.find(
          (l: any) => l.lang === lang,
        );
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
      logger.error(
        `Error in getMaintenanceMessage service for world ${worldId}:`,
        error,
      );
      return null;
    }
  }
}
