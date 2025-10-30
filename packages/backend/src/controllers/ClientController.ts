import { Request, Response } from 'express';
import { ClientVersionService } from '../services/ClientVersionService';
import { ClientVersionModel, ClientStatus } from '../models/ClientVersion';
import { GameWorldService } from '../services/GameWorldService';
import { cacheService } from '../services/CacheService';
import { pubSubService } from '../services/PubSubService';
import { GAME_WORLDS, DEFAULT_CONFIG } from '../constants/cacheKeys';
import logger from '../config/logger';
import { asyncHandler } from '../utils/asyncHandler';
import VarsModel from '../models/Vars';
import { IpWhitelistService } from '../services/IpWhitelistService';

export class ClientController {
  /**
   * Extract client IP address from request
   */
  private static getClientIp(req: Request): string {
    let clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
                   req.socket.remoteAddress ||
                   '';

    // Remove "::ffff:" prefix from IPv4-mapped IPv6 addresses
    if (clientIp.startsWith('::ffff:')) {
      clientIp = clientIp.substring(7);
    }

    return clientIp.trim();
  }

  /**
   * Get client version information
   * GET /api/v1/client/client-version
   */
  static getClientVersion = asyncHandler(async (req: Request, res: Response) => {
    const { platform, version, lang } = req.query as { platform?: string; version?: string; lang?: string };

    // Validate required query params
    if (!platform || !version) {
      return res.status(400).json({
        success: false,
        message: 'platform and version are required query parameters',
      });
    }

    // Validate required headers
    const appName = req.headers['x-application-name'];
    const apiToken = req.headers['x-api-token'];

    if (!appName || !apiToken) {
      return res.status(400).json({
        success: false,
        message: 'X-Application-Name and X-API-Token headers are required',
      });
    }

    // Create cache key for exact match (with language)
    // Cache separately for each language to ensure correct maintenance messages
    const cacheKey = `client_version:${platform}:${version}${lang ? `:${lang}` : ''}`;

    // Try to get from cache first
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      logger.debug(`Cache hit for client version: ${cacheKey}`);
      return res.json({
        success: true,
        data: cachedData,
        cached: true
      });
    }

    // If not in cache, fetch from database (exact match, any status)
    logger.debug(`Cache miss for client version: ${cacheKey}`);

    const record = await ClientVersionService.findByExact(platform, version);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Client version not found',
      });
    }

    // Get clientVersionPassiveData from KV settings
    let passiveData = {};
    try {
      const passiveDataStr = await VarsModel.get('$clientVersionPassiveData');
      if (passiveDataStr) {
        passiveData = JSON.parse(passiveDataStr);
      }
    } catch (error) {
      logger.warn('Failed to parse clientVersionPassiveData:', error);
    }

    // Parse customPayload
    let customPayload = {};
    try {
      if (record.customPayload) {
        customPayload = JSON.parse(record.customPayload);
      }
    } catch (error) {
      logger.warn('Failed to parse customPayload:', error);
    }

    // Merge meta: passiveData first, then customPayload (customPayload overwrites)
    const meta = { ...passiveData, ...customPayload };

    // Get client IP and check whitelist
    const clientIp = this.getClientIp(req);
    let gameServerAddress = record.gameServerAddress;
    let patchAddress = record.patchAddress;

    if (clientIp) {
      const isWhitelisted = await IpWhitelistService.isIpWhitelisted(clientIp);
      if (isWhitelisted) {
        // Use whitelist addresses if available
        if (record.gameServerAddressForWhiteList) {
          gameServerAddress = record.gameServerAddressForWhiteList;
        }
        if (record.patchAddressForWhiteList) {
          patchAddress = record.patchAddressForWhiteList;
        }
      }
    }

    // Get maintenance message if status is MAINTENANCE
    let maintenanceMessage: string | undefined = record.maintenanceMessage;
    if (record.clientStatus === ClientStatus.MAINTENANCE && record.id) {
      // Try to get localized maintenance message from database
      try {
        const maintenanceLocales = await ClientVersionModel.getMaintenanceLocales(record.id);
        if (maintenanceLocales && maintenanceLocales.length > 0) {
          // Try to find message for requested language
          if (lang) {
            const localeMessage = maintenanceLocales.find((m: any) => m.lang === lang);
            if (localeMessage) {
              maintenanceMessage = localeMessage.message;
            }
          }
          // If no localized message found, use first available message
          if (!maintenanceMessage) {
            maintenanceMessage = maintenanceLocales[0].message;
          }
        }
      } catch (error) {
        logger.warn('Failed to get maintenance locales:', error);
      }
    }

    // Transform data for client consumption (remove sensitive fields)
    const clientData: any = {
      platform: record.platform,
      clientVersion: record.clientVersion,
      status: record.clientStatus,
      gameServerAddress,
      patchAddress,
      guestModeAllowed: record.clientStatus === ClientStatus.MAINTENANCE ? false : Boolean(record.guestModeAllowed),
      externalClickLink: record.externalClickLink,
      meta,
    };

    // Add maintenance message if status is MAINTENANCE
    // Always include maintenanceMessage field when status is MAINTENANCE
    if (record.clientStatus === ClientStatus.MAINTENANCE) {
      clientData.maintenanceMessage = maintenanceMessage || '';
    }

    // Cache the result for 5 minutes
    await cacheService.set(cacheKey, clientData, 5 * 60 * 1000);

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
    const cachedData = await cacheService.get(cacheKey);
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

    // No pagination: fetch all visible, non-maintenance worlds ordered by displayOrder ASC
    const worlds = await GameWorldService.getAllGameWorlds({
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
    await cacheService.set(cacheKey, clientData, DEFAULT_CONFIG.GAME_WORLDS_PUBLIC_TTL);

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
