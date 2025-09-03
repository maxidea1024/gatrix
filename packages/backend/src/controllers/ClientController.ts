import { Request, Response } from 'express';
import { ClientVersionService } from '../services/ClientVersionService';
import { GameWorldService } from '../services/GameWorldService';
import { cacheService } from '../services/CacheService';
import { pubSubService } from '../services/PubSubService';
import { GAME_WORLDS, DEFAULT_CONFIG } from '../constants/cacheKeys';
import logger from '../config/logger';
import { asyncHandler } from '../utils/asyncHandler';

export class ClientController {
  /**
   * Get client version information
   * GET /api/v1/client/client-version
   */
  static getClientVersion = asyncHandler(async (req: Request, res: Response) => {
    const { platform, version, environment } = req.query as { platform?: string; version?: string, environment?: string };

    // FGT, dev, live, production

    // Validate required query params
    if (!platform || !version || !environment) {
      return res.status(400).json({
        success: false,
        message: 'platform and version are required query parameters',
      });
    }

    // Create cache key for exact match
    const cacheKey = `client_version:${platform}:${version}:${environment}`;

    // Try to get from cache first
    const cachedData = cacheService.get(cacheKey);
    if (cachedData) {
      logger.debug(`Cache hit for client version: ${cacheKey}`);
      return res.json({
        success: true,
        data: cachedData,
        cached: true
      });
    }

    // If not in cache, fetch from database (exact match and ONLINE only)
    logger.debug(`Cache miss for client version: ${cacheKey}`);

    const record = await ClientVersionService.findOnlineByExact(platform, version);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Client version not found',
      });
    }

    // Transform data for client consumption (remove sensitive fields)
    const clientData = {
      id: record.id,
      platform: record.platform,
      clientVersion: record.clientVersion,
      environment,
      gameServerAddress: record.gameServerAddress,
      gameServerAddressForWhiteList: record.gameServerAddressForWhiteList,
      patchAddress: record.patchAddress,
      patchAddressForWhiteList: record.patchAddressForWhiteList,
      guestModeAllowed: record.guestModeAllowed,
      externalClickLink: record.externalClickLink,
      customPayload: record.customPayload ? JSON.parse(record.customPayload) : null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      timestamp: new Date().toISOString(),
      // areaId: '...',
      // groupId: '...'
    };

    // Cache the result for 5 minutes
    cacheService.set(cacheKey, clientData, 5 * 60 * 1000);

    return res.json({
      success: true,
      data: clientData,
      cached: false,
    });
  });

  /**
   * Get all game worlds
   * GET /api/v1/client/game-worlds
   */
  static getGameWorlds = asyncHandler(async (req: Request, res: Response) => {
    const cacheKey = GAME_WORLDS.PUBLIC;

    // Try to get from cache first
    const cachedData = cacheService.get(cacheKey);
    if (cachedData) {
      logger.debug(`Cache hit for game worlds: ${cacheKey}`);
      return res.json({
        success: true,
        data: cachedData,
        cached: true
      });
    }

    // If not in cache, fetch from database
    logger.debug(`Cache miss for game worlds: ${cacheKey}`);

    // No pagination: fetch all visible, non-maintenance worlds ordered by displayOrder
    const worlds = await GameWorldService.getAllGameWorlds({
      sortBy: 'displayOrder',
      sortOrder: 'ASC',
      isVisible: true,
      isMaintenance: false,
    });

    // Transform data for client consumption (remove sensitive fields)
    const clientData = {
      worlds: worlds.map(world => ({
        id: world.id,
        worldId: world.worldId,
        name: world.name,
        description: world.description,
        displayOrder: world.displayOrder,
        createdAt: world.createdAt,
        updatedAt: world.updatedAt
      })),
      total: worlds.length,
      timestamp: new Date().toISOString()
    };

    // Cache the result for 10 minutes (game worlds change less frequently)
    cacheService.set(cacheKey, clientData, DEFAULT_CONFIG.GAME_WORLDS_PUBLIC_TTL);

    res.json({
      success: true,
      data: clientData,
      cached: false
    });
  });

  /**
   * Get cache statistics (for monitoring)
   * GET /api/v1/client/cache-stats
   */
  static getCacheStats = asyncHandler(async (req: Request, res: Response) => {
    const cacheStats = cacheService.getStats();
    const queueStats = await pubSubService.getQueueStats();

    res.json({
      success: true,
      data: {
        cache: cacheStats,
        queue: queueStats,
        pubsub: {
          connected: pubSubService.isReady(),
          timestamp: new Date().toISOString()
        }
      }
    });
  });

  /**
   * Invalidate game worlds cache (for testing)
   * POST /api/v1/client/invalidate-cache
   */
  static invalidateCache = asyncHandler(async (req: Request, res: Response) => {
    await GameWorldService.invalidateCache();

    res.json({
      success: true,
      message: 'Game worlds cache invalidated successfully'
    });
  });
}
