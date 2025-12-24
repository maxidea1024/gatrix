import { Request, Response } from 'express';
import { ClientVersionService } from '../services/ClientVersionService';
import { ClientVersionModel, ClientStatus } from '../models/ClientVersion';
import { GameWorldService } from '../services/GameWorldService';
import { cacheService } from '../services/CacheService';
import { pubSubService } from '../services/PubSubService';
import { GAME_WORLDS, DEFAULT_CONFIG, withEnvironment } from '../constants/cacheKeys';
import logger from '../config/logger';
import { asyncHandler } from '../utils/asyncHandler';
import VarsModel from '../models/Vars';
import { IpWhitelistService } from '../services/IpWhitelistService';
import { SDKRequest } from '../middleware/apiTokenAuth';

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
   *
   * Query params:
   * - platform (required): Platform identifier (e.g., 'android', 'ios', 'windows')
   * - version (optional): Client version string. If omitted or 'latest', returns the latest version for the platform
   * - status (optional): Filter by status (e.g., 'ONLINE', 'MAINTENANCE'). Only applied when fetching latest version.
   * - lang (optional): Language code for localized maintenance messages
   */
  static getClientVersion = asyncHandler(async (req: SDKRequest, res: Response) => {
    const { platform, version, status, lang } = req.query as {
      platform?: string;
      version?: string;
      status?: string;
      lang?: string;
    };

    // Validate required query params - platform is always required
    if (!platform) {
      return res.status(400).json({
        success: false,
        message: 'platform is a required query parameter',
      });
    }

    // Environment is resolved by clientSDKAuth middleware
    const environment = req.environment;
    const envId = environment?.id;

    // Validate status parameter if provided
    const validStatuses = Object.values(ClientStatus);
    let statusFilter: ClientStatus | undefined;
    if (status) {
      const upperStatus = status.toUpperCase() as ClientStatus;
      if (!validStatuses.includes(upperStatus)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Valid values are: ${validStatuses.join(', ')}`,
        });
      }
      statusFilter = upperStatus;
    }

    // Determine if we should fetch the latest version
    const isLatestRequest = !version || version.toLowerCase() === 'latest';

    // Create cache key (use 'latest' for latest requests)
    const versionKey = isLatestRequest ? 'latest' : version;
    const statusKey = statusFilter ? `:${statusFilter}` : '';
    const baseCacheKey = `client_version:${platform}:${versionKey}${statusKey}${lang ? `:${lang}` : ''}`;

    // Scoping cache by environment ID
    const cacheKey = envId ? withEnvironment(envId, baseCacheKey) : baseCacheKey;

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

    // If not in cache, fetch from database
    logger.debug(`Cache miss for client version: ${cacheKey}`);

    let record;
    if (isLatestRequest) {
      // Get the latest version for the platform (with optional status filter and environment)
      record = await ClientVersionService.findLatestByPlatform(platform, statusFilter, envId);
    } else {
      // Get exact version match
      record = await ClientVersionService.findByExact(platform, version, envId);
    }

    if (!record) {
      return res.status(404).json({
        success: false,
        message: isLatestRequest
          ? `No client version found for platform: ${platform} in environment: ${environment?.environmentName || 'default'}${statusFilter ? ` with status: ${statusFilter}` : ''}`
          : 'Client version not found',
      });
    }

    // Get clientVersionPassiveData from KV settings for the specific environment
    let passiveData = {};
    try {
      const passiveDataStr = await VarsModel.get('$clientVersionPassiveData', envId);
      if (passiveDataStr) {
        let parsed = JSON.parse(passiveDataStr);
        // Handle double-encoded JSON string
        if (typeof parsed === 'string') {
          try {
            parsed = JSON.parse(parsed);
          } catch (e) {
            // ignore
          }
        }
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          passiveData = parsed;
        }
      }
    } catch (error) {
      logger.warn(`Failed to parse clientVersionPassiveData for environment ${envId || 'default'}:`, error);
    }

    // Parse customPayload
    let customPayload = {};
    try {
      if (record.customPayload) {
        let parsed = typeof record.customPayload === 'string'
          ? JSON.parse(record.customPayload)
          : record.customPayload;

        // Handle double-encoded JSON string
        if (typeof parsed === 'string') {
          try {
            parsed = JSON.parse(parsed);
          } catch (e) {
            // ignore
          }
        }

        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          customPayload = parsed;
        }
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
  static getGameWorlds = asyncHandler(async (req: SDKRequest, res: Response) => {
    const envId = req.environment?.id;
    const cacheKey = envId ? withEnvironment(envId, GAME_WORLDS.PUBLIC) : GAME_WORLDS.PUBLIC;

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

    // If not in cache, fetch from database for the specific environment
    logger.debug(`Cache miss for game worlds: ${cacheKey}`);

    // No pagination: fetch all visible, non-maintenance worlds ordered by displayOrder ASC
    const worlds = await GameWorldService.getAllGameWorlds({
      isVisible: true,
      isMaintenance: false,
      environmentId: envId,
    });

    // Transform data for client consumption (remove sensitive fields)
    const clientData = {
      worlds: worlds.map(world => ({
        id: world.id,
        worldId: world.worldId,
        name: world.name,
        description: world.description,
        displayOrder: world.displayOrder,
        meta: world.customPayload || {},
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
  static getCacheStats = asyncHandler(async (req: SDKRequest, res: Response) => {
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
  static invalidateCache = asyncHandler(async (req: SDKRequest, res: Response) => {
    await GameWorldService.invalidateCache();

    res.json({
      success: true,
      message: 'Game worlds cache invalidated successfully'
    });
  });
}
