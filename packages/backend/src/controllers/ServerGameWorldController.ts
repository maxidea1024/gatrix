import { Response } from "express";
import { GameWorldService } from "../services/GameWorldService";
import logger from "../config/logger";
import { DEFAULT_CONFIG, SERVER_SDK_ETAG } from "../constants/cacheKeys";
import { respondWithEtagCache } from "../utils/serverSdkEtagCache";
import { EnvironmentRequest } from "../middleware/environmentResolver";

/**
 * Server SDK Game World Controller
 * Handles game world list retrieval for server-side SDK
 */
export class ServerGameWorldController {
  /**
   * Get game worlds for a specific environment
   * GET /api/v1/server/:env/game-worlds
   * Returns all visible game worlds sorted by displayOrder with tags and all maintenance messages
   */
  static async getGameWorlds(req: EnvironmentRequest, res: Response) {
    const environment = req.environment;
    try {
      if (!environment) {
        return res.status(400).json({
          success: false,
          error: {
            code: "MISSING_ENVIRONMENT",
            message: "Environment is required",
          },
        });
      }

      // Helper function to convert MySQL BOOLEAN (0/1) to boolean
      const toBoolean = (value: any): boolean => {
        if (typeof value === "boolean") return value;
        if (typeof value === "number") return value === 1;
        if (typeof value === "string")
          return value === "1" || value.toLowerCase() === "true";
        return false;
      };

      // Helper function to parse JSON field
      const parseJsonField = (payload: any): Record<string, any> | null => {
        if (!payload) return null;
        if (typeof payload === "string") {
          try {
            return JSON.parse(payload);
          } catch {
            return null;
          }
        }
        if (typeof payload === "object") return payload;
        return null;
      };

      await respondWithEtagCache(res, {
        cacheKey: `${SERVER_SDK_ETAG.GAME_WORLDS}:${environment}`,
        ttlMs: DEFAULT_CONFIG.GAME_WORLDS_PUBLIC_TTL,
        requestEtag: req.headers["if-none-match"],
        buildPayload: async () => {
          // Fetch visible game worlds sorted by displayOrder ASC for this environment
          const allWorlds = await GameWorldService.getAllGameWorlds({
            environment: environment,
            isVisible: true,
          });

          logger.debug(
            `Game worlds fetched. First world displayOrder: ${allWorlds[0]?.displayOrder}, Last world displayOrder: ${allWorlds[allWorlds.length - 1]?.displayOrder}`,
          );

          // Fetch tags for each world
          const { TagService } = await import("../services/TagService");
          const worldsWithTags = await Promise.all(
            allWorlds.map(async (world) => {
              const tags = await TagService.listTagsForEntity(
                "game_world",
                world.id,
              );
              // Convert tags to array of tag names only
              const tagNames = tags ? tags.map((tag: any) => tag.name) : [];

              const worldData: any = {
                id: world.id,
                worldId: world.worldId,
                name: world.name,
                isMaintenance: toBoolean(world.isMaintenance),
                displayOrder: world.displayOrder,
                worldServerAddress: world.worldServerAddress || null,
                customPayload: parseJsonField(world.customPayload),
                infraSettings: parseJsonField(world.infraSettings),
                tags: tagNames,
                createdAt: world.createdAt,
              };

              // Add maintenance info if in maintenance mode
              if (toBoolean(world.isMaintenance)) {
                if (world.maintenanceStartDate) {
                  worldData.maintenanceStartDate = world.maintenanceStartDate;
                }
                if (world.maintenanceEndDate) {
                  worldData.maintenanceEndDate = world.maintenanceEndDate;
                }
                if (world.maintenanceMessage) {
                  worldData.maintenanceMessage = world.maintenanceMessage;
                }
                // Include all maintenance locales if they exist
                if (
                  world.maintenanceLocales &&
                  world.maintenanceLocales.length > 0
                ) {
                  worldData.maintenanceLocales = world.maintenanceLocales.map(
                    (locale: any) => ({
                      lang: locale.lang,
                      message: locale.message,
                    }),
                  );
                }
              }

              return worldData;
            }),
          );

          logger.info(
            `Server SDK: Retrieved ${worldsWithTags.length} visible game worlds for environment ${environment}`,
          );

          return {
            success: true,
            data: {
              worlds: worldsWithTags,
            },
          };
        },
      });
    } catch (error) {
      logger.error("Error in ServerGameWorldController.getGameWorlds:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve game worlds",
        },
      });
    }
  }

  /**
   * Get specific game world by ID
   * GET /api/v1/server/:env/game-worlds/:id
   */
  static async getGameWorldById(req: EnvironmentRequest, res: Response) {
    try {
      const { id } = req.params;
      const environment = req.environment;
      const worldId = parseInt(id);

      if (!environment) {
        return res.status(400).json({
          success: false,
          error: {
            code: "MISSING_ENVIRONMENT",
            message: "Environment is required",
          },
        });
      }

      if (isNaN(worldId)) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_PARAMETERS",
            message: "Invalid game world ID",
            details: { reason: "ID must be a valid number" },
          },
        });
      }

      const world = await GameWorldService.getGameWorldById(
        worldId,
        environment,
      );

      logger.info(
        `Server SDK: Retrieved game world ${worldId} for environment ${environment}`,
      );

      // Helper function to convert MySQL BOOLEAN (0/1) to boolean
      const toBoolean = (value: any): boolean => {
        if (typeof value === "boolean") return value;
        if (typeof value === "number") return value === 1;
        if (typeof value === "string")
          return value === "1" || value.toLowerCase() === "true";
        return false;
      };

      // Helper function to parse JSON field
      const parseJsonField = (payload: any): Record<string, any> | null => {
        if (!payload) return null;
        if (typeof payload === "string") {
          try {
            return JSON.parse(payload);
          } catch {
            return null;
          }
        }
        if (typeof payload === "object") return payload;
        return null;
      };

      // Fetch tags for the world
      const { TagService } = await import("../services/TagService");
      const tags = await TagService.listTagsForEntity("game_world", world.id);
      const tagNames = tags ? tags.map((tag: any) => tag.name) : [];

      const worldData: any = {
        id: world.id,
        worldId: world.worldId,
        name: world.name,
        isMaintenance: toBoolean(world.isMaintenance),
        displayOrder: world.displayOrder,
        worldServerAddress: world.worldServerAddress || null,
        customPayload: parseJsonField(world.customPayload),
        infraSettings: parseJsonField(world.infraSettings),
        tags: tagNames,
        createdAt: world.createdAt,
      };

      // Add maintenance info if in maintenance mode
      if (toBoolean(world.isMaintenance)) {
        if (world.maintenanceStartDate) {
          worldData.maintenanceStartDate = world.maintenanceStartDate;
        }
        if (world.maintenanceEndDate) {
          worldData.maintenanceEndDate = world.maintenanceEndDate;
        }
        if (world.maintenanceMessage) {
          worldData.maintenanceMessage = world.maintenanceMessage;
        }
        // Include all maintenance locales if they exist
        if (world.maintenanceLocales && world.maintenanceLocales.length > 0) {
          worldData.maintenanceLocales = world.maintenanceLocales.map(
            (locale: any) => ({
              lang: locale.lang,
              message: locale.message,
            }),
          );
        }
      }

      res.json({
        success: true,
        data: worldData,
        meta: {
          timestamp: new Date().toISOString(),
          apiVersion: "1.0.0",
        },
      });
    } catch (error) {
      logger.error(
        "Error in ServerGameWorldController.getGameWorldById:",
        error,
      );
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve game world",
        },
      });
    }
  }

  /**
   * Get specific game world by worldId
   * GET /api/v1/server/:env/game-worlds/world/:worldId
   */
  static async getGameWorldByWorldId(req: EnvironmentRequest, res: Response) {
    try {
      const { worldId } = req.params;
      const environment = req.environment;

      if (!environment) {
        return res.status(400).json({
          success: false,
          error: {
            code: "MISSING_ENVIRONMENT",
            message: "Environment is required",
          },
        });
      }

      if (!worldId || typeof worldId !== "string") {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_PARAMETERS",
            message: "Invalid world ID",
            details: { reason: "World ID must be a non-empty string" },
          },
        });
      }

      const world = await GameWorldService.getGameWorldByWorldId(
        worldId,
        environment,
      );

      logger.info(
        `Server SDK: Retrieved game world by worldId: ${worldId} for environment ${environment}`,
      );

      // Helper function to convert MySQL BOOLEAN (0/1) to boolean
      const toBoolean = (value: any): boolean => {
        if (typeof value === "boolean") return value;
        if (typeof value === "number") return value === 1;
        if (typeof value === "string")
          return value === "1" || value.toLowerCase() === "true";
        return false;
      };

      // Helper function to parse JSON field
      const parseJsonField = (payload: any): Record<string, any> | null => {
        if (!payload) return null;
        if (typeof payload === "string") {
          try {
            return JSON.parse(payload);
          } catch {
            return null;
          }
        }
        if (typeof payload === "object") return payload;
        return null;
      };

      const worldData: any = {
        id: world.id,
        worldId: world.worldId,
        name: world.name,
        isMaintenance: toBoolean(world.isMaintenance),
        displayOrder: world.displayOrder,
        worldServerAddress: world.worldServerAddress || null,
        customPayload: parseJsonField(world.customPayload),
        infraSettings: parseJsonField(world.infraSettings),
        createdAt: world.createdAt,
      };

      // Add maintenance info if in maintenance mode
      if (toBoolean(world.isMaintenance)) {
        if (world.maintenanceStartDate) {
          worldData.maintenanceStartDate = world.maintenanceStartDate;
        }
        if (world.maintenanceEndDate) {
          worldData.maintenanceEndDate = world.maintenanceEndDate;
        }
        if (world.maintenanceMessage) {
          worldData.maintenanceMessage = world.maintenanceMessage;
        }
        // Include all maintenance locales if they exist
        if (world.maintenanceLocales && world.maintenanceLocales.length > 0) {
          worldData.maintenanceLocales = world.maintenanceLocales.map(
            (locale: any) => ({
              lang: locale.lang,
              message: locale.message,
            }),
          );
        }
      }

      res.json({
        success: true,
        data: worldData,
        meta: {
          timestamp: new Date().toISOString(),
          apiVersion: "1.0.0",
        },
      });
    } catch (error) {
      logger.error(
        "Error in ServerGameWorldController.getGameWorldByWorldId:",
        error,
      );
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve game world",
        },
      });
    }
  }
}

export default ServerGameWorldController;
