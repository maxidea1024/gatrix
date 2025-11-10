import { Request, Response } from 'express';
import { GameWorldService } from '../services/GameWorldService';
import logger from '../config/logger';

export interface SDKRequest extends Request {
  apiToken?: any;
}

/**
 * Server SDK Game World Controller
 * Handles game world list retrieval for server-side SDK
 */
export class ServerGameWorldController {
  /**
   * Get game worlds list
   * GET /api/v1/server/game-worlds?lang=ko
   * Returns all visible game worlds sorted by displayOrder with tags
   * Optional query parameter: lang (for maintenance message localization)
   */
  static async getGameWorlds(req: SDKRequest, res: Response) {
    try {
      // Get optional lang parameter for maintenance message localization
      const lang = (req.query.lang as string) || 'en';

      // Helper function to convert MySQL BOOLEAN (0/1) to boolean
      const toBoolean = (value: any): boolean => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value === 1;
        if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true';
        return false;
      };

      // Helper function to parse customPayload
      const parseCustomPayload = (payload: any): Record<string, any> | null => {
        if (!payload) return null;
        if (typeof payload === 'string') {
          try {
            return JSON.parse(payload);
          } catch {
            return null;
          }
        }
        if (typeof payload === 'object') return payload;
        return null;
      };

      // Fetch visible game worlds sorted by displayOrder ASC
      const allWorlds = await GameWorldService.getAllGameWorlds({
        isVisible: true
      });

      logger.debug(`Game worlds fetched. First world displayOrder: ${allWorlds[0]?.displayOrder}, Last world displayOrder: ${allWorlds[allWorlds.length - 1]?.displayOrder}`);

      // Fetch tags for each world
      const { TagService } = await import('../services/TagService');
      const worldsWithTags = await Promise.all(
        allWorlds.map(async (world) => {
          const tags = await TagService.listTagsForEntity('game_world', world.id);
          // Convert tags to array of tag names only
          const tagNames = tags ? tags.map((tag: any) => tag.name) : [];

          const worldData: any = {
            worldId: world.worldId,
            name: world.name,
            isMaintenance: toBoolean(world.isMaintenance),
            worldServerAddress: world.worldServerAddress || null,
            customPayload: parseCustomPayload(world.customPayload),
            tags: tagNames
          };

          // Add maintenanceMessage if in maintenance mode
          if (toBoolean(world.isMaintenance)) {
            // Get maintenance message in requested language
            const maintenanceMessage = await GameWorldService.getMaintenanceMessage(world.id, lang);
            if (maintenanceMessage) {
              worldData.maintenanceMessage = maintenanceMessage;
            }
          }

          return worldData;
        })
      );

      logger.info(`Server SDK: Retrieved ${worldsWithTags.length} visible game worlds (lang: ${lang})`);

      // Return response
      res.json({
        success: true,
        data: {
          worlds: worldsWithTags
        }
      });
    } catch (error) {
      logger.error('Error in ServerGameWorldController.getGameWorlds:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve game worlds'
        }
      });
    }
  }

  /**
   * Get specific game world by ID
   * GET /api/v1/server/game-worlds/:id
   */
  static async getGameWorldById(req: SDKRequest, res: Response) {
    try {
      const { id } = req.params;
      const worldId = parseInt(id);

      if (isNaN(worldId)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PARAMETERS',
            message: 'Invalid game world ID',
            details: { reason: 'ID must be a valid number' }
          }
        });
      }

      const world = await GameWorldService.getGameWorldById(worldId);

      logger.info(`Server SDK: Retrieved game world ${worldId}`);

      // Helper function to convert MySQL BOOLEAN (0/1) to boolean
      const toBoolean = (value: any): boolean => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value === 1;
        if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true';
        return false;
      };

      // Helper function to parse customPayload
      const parseCustomPayload = (payload: any): Record<string, any> | null => {
        if (!payload) return null;
        if (typeof payload === 'string') {
          try {
            return JSON.parse(payload);
          } catch {
            return null;
          }
        }
        if (typeof payload === 'object') return payload;
        return null;
      };

      res.json({
        success: true,
        data: {
          id: world.id,
          worldId: world.worldId,
          name: world.name,
          description: world.description,
          isVisible: toBoolean(world.isVisible),
          isMaintenance: toBoolean(world.isMaintenance),
          displayOrder: world.displayOrder,
          worldServerAddress: world.worldServerAddress || null,
          customPayload: parseCustomPayload(world.customPayload),
          createdAt: world.createdAt,
          updatedAt: world.updatedAt
        },
        meta: {
          timestamp: new Date().toISOString(),
          apiVersion: '1.0.0'
        }
      });
    } catch (error) {
      logger.error('Error in ServerGameWorldController.getGameWorldById:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve game world'
        }
      });
    }
  }

  /**
   * Get specific game world by worldId
   * GET /api/v1/server/game-worlds/world/:worldId
   */
  static async getGameWorldByWorldId(req: SDKRequest, res: Response) {
    try {
      const { worldId } = req.params;

      if (!worldId || typeof worldId !== 'string') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PARAMETERS',
            message: 'Invalid world ID',
            details: { reason: 'World ID must be a non-empty string' }
          }
        });
      }

      const world = await GameWorldService.getGameWorldByWorldId(worldId);

      logger.info(`Server SDK: Retrieved game world by worldId: ${worldId}`);

      // Helper function to convert MySQL BOOLEAN (0/1) to boolean
      const toBoolean = (value: any): boolean => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value === 1;
        if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true';
        return false;
      };

      // Helper function to parse customPayload
      const parseCustomPayload = (payload: any): Record<string, any> | null => {
        if (!payload) return null;
        if (typeof payload === 'string') {
          try {
            return JSON.parse(payload);
          } catch {
            return null;
          }
        }
        if (typeof payload === 'object') return payload;
        return null;
      };

      res.json({
        success: true,
        data: {
          id: world.id,
          worldId: world.worldId,
          name: world.name,
          description: world.description,
          isVisible: toBoolean(world.isVisible),
          isMaintenance: toBoolean(world.isMaintenance),
          displayOrder: world.displayOrder,
          worldServerAddress: world.worldServerAddress || null,
          customPayload: parseCustomPayload(world.customPayload),
          createdAt: world.createdAt,
          updatedAt: world.updatedAt
        },
        meta: {
          timestamp: new Date().toISOString(),
          apiVersion: '1.0.0'
        }
      });
    } catch (error) {
      logger.error('Error in ServerGameWorldController.getGameWorldByWorldId:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve game world'
        }
      });
    }
  }
}

export default ServerGameWorldController;

