import { Router, Request, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { clientAuth, ClientRequest } from '../middleware/clientAuth';
import { sdkManager } from '../services/sdkManager';
import { config } from '../config/env';
import logger from '../config/logger';
import { ClientVersion, Banner, GameWorld } from '@gatrix/server-sdk';
import { metricsAggregator } from '../services/metricsAggregator';
import { cacheHitsTotal, cacheMissesTotal, cacheSize } from '../services/edgeMetrics';

const router = Router();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Record cache hit metric
 */
function recordCacheHit(cacheType: string): void {
  cacheHitsTotal?.labels(cacheType).inc();
}

/**
 * Record cache miss metric
 */
function recordCacheMiss(cacheType: string): void {
  cacheMissesTotal?.labels(cacheType).inc();
}

/**
 * Update cache size metrics from SDK
 * Uses getAllCachedData() to get counts across all environments
 */
function updateCacheSizeMetrics(): void {
  const sdk = sdkManager.getSDK();
  if (!sdk) return;

  // Get all cached data to count items across all environments
  // getAllCachedData() returns plain objects (not Maps) with environment keys
  const allData = sdk.getAllCachedData();

  // Helper to count items from environment-keyed object
  const countItems = (data: Record<string, unknown[]> | undefined): number => {
    if (!data || typeof data !== 'object') return 0;
    let count = 0;
    for (const key of Object.keys(data)) {
      const items = data[key];
      if (Array.isArray(items)) {
        count += items.length;
      }
    }
    return count;
  };

  const versionsCount = countItems(allData.clientVersions);
  const bannersCount = countItems(allData.banners);
  const noticesCount = countItems(allData.serviceNotices);
  const worldsCount = countItems(allData.gameWorlds);
  const surveysCount = countItems(allData.surveys);
  const popupNoticesCount = countItems(allData.popupNotices);
  const storeProductsCount = countItems(allData.storeProducts);

  // Helper to count items from environment-keyed object with non-array values (like WhitelistData)
  const countWhitelistItems = (
    data: Record<string, { ipWhitelist?: unknown[]; accountWhitelist?: unknown[] }> | undefined
  ): number => {
    if (!data || typeof data !== 'object') return 0;
    let count = 0;
    for (const key of Object.keys(data)) {
      const whitelist = data[key];
      if (whitelist) {
        if (Array.isArray(whitelist.ipWhitelist)) {
          count += whitelist.ipWhitelist.length;
        }
        if (Array.isArray(whitelist.accountWhitelist)) {
          count += whitelist.accountWhitelist.length;
        }
      }
    }
    return count;
  };
  const whitelistsCount = countWhitelistItems(allData.whitelists);

  cacheSize?.labels('client_versions').set(versionsCount);
  cacheSize?.labels('banners').set(bannersCount);
  cacheSize?.labels('service_notices').set(noticesCount);
  cacheSize?.labels('game_worlds').set(worldsCount);
  cacheSize?.labels('surveys').set(surveysCount);
  cacheSize?.labels('popup_notices').set(popupNoticesCount);
  cacheSize?.labels('store_products').set(storeProductsCount);
  cacheSize?.labels('whitelists').set(whitelistsCount);
  cacheSize
    ?.labels('total')
    .set(
      versionsCount +
      bannersCount +
      noticesCount +
      worldsCount +
      surveysCount +
      popupNoticesCount +
      storeProductsCount +
      whitelistsCount
    );
}

/**
 * Get SDK instance or return 503 error
 */
function getSDKOrError(res: Response): ReturnType<typeof sdkManager.getSDK> | null {
  const sdk = sdkManager.getSDK();
  if (!sdk) {
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'SDK not initialized',
      },
    });
    return null;
  }
  return sdk;
}

// Update cache size metrics periodically (every 30 seconds)
setInterval(() => {
  updateCacheSizeMetrics();
}, 30000);

// Initial update after a short delay (to allow SDK to initialize)
setTimeout(() => {
  updateCacheSizeMetrics();
}, 5000);

// ============================================================================
// Public Routes (No Authentication Required - Same as Backend)
// ============================================================================

/**
 * @openapi
 * /client/{environment}/client-version:
 *   get:
 *     tags: [EdgeClient]
 *     summary: Get client version information (Cached)
 *     description: Returns the latest client version info for the given platform. Filterable by status. Serves from edge cache.
 *     parameters:
 *       - in: path
 *         name: environment
 *         required: true
 *         schema: { type: string, example: 'production' }
 *         description: Environment name (e.g., 'staging', 'production')
 *       - in: query
 *         name: platform
 *         required: true
 *         schema: { type: string, example: 'android' }
 *         description: Platform identifier (e.g., 'android', 'ios', 'windows')
 *       - in: query
 *         name: version
 *         schema: { type: string, example: 'latest' }
 *         description: Client version string. If omitted or 'latest', returns the latest version.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ONLINE, OFFLINE, MAINTENANCE, UPDATE_REQUIRED], example: 'ONLINE' }
 *         description: Filter by status
 *       - in: query
 *         name: lang
 *         schema: { type: string, enum: [ko, en, zh], example: 'ko' }
 *         description: Language code for localized maintenance messages
 *       - in: header
 *         name: x-application-name
 *         required: true
 *         schema: { type: string, example: 'gatrix-app' }
 *       - in: header
 *         name: x-api-token
 *         required: true
 *         schema: { type: string, example: 'test-token-123' }
 *     responses:
 *       200:
 *         description: Client version information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/ClientVersion'
 *                 cached: { type: boolean, example: true }
 *       400:
 *         description: Bad Request (Missing parameters or invalid status)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { success: false, message: "platform is a required query parameter", error: "VALIDATION_ERROR" }
 *       404:
 *         description: Not Found (No client version matches)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { success: false, message: "Client version not found", error: "NOT_FOUND" }
 */
router.get('/:environment/client-version', async (req: Request, res: Response) => {
  try {
    const sdk = getSDKOrError(res);
    if (!sdk) return;

    const environment = req.params.environment;
    const { platform, version, status, lang } = req.query as {
      platform?: string;
      version?: string;
      status?: string;
      lang?: string;
    };

    // Validate required query params
    if (!platform) {
      return res.status(400).json({
        success: false,
        message: 'platform is a required query parameter',
      });
    }

    // Validate required headers (same as Backend)
    const appName = req.headers['x-application-name'];
    const apiToken = req.headers['x-api-token'];

    if (!appName || !apiToken) {
      return res.status(400).json({
        success: false,
        message: 'X-Application-Name and X-API-Token headers are required',
      });
    }

    // Validate status parameter if provided
    const validStatuses = ['ONLINE', 'OFFLINE', 'MAINTENANCE', 'UPDATE_REQUIRED'];
    let statusFilter: string | undefined;
    if (status) {
      const upperStatus = status.toUpperCase();
      if (!validStatuses.includes(upperStatus)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Valid values are: ${validStatuses.join(', ')}`,
        });
      }
      statusFilter = upperStatus;
    }

    // Get client versions from cache for this environment
    const envVersions = sdk.getClientVersions(environment) as ClientVersion[];

    // Filter by platform
    const platformVersions = envVersions.filter(
      (v) => v.platform === platform || v.platform === 'all'
    );

    // Determine if we should fetch the latest version
    const isLatestRequest = !version || version.toLowerCase() === 'latest';

    let record: ClientVersion | undefined;
    if (isLatestRequest) {
      // Get the latest version for the platform (with optional status filter)
      let candidates = platformVersions;
      if (statusFilter) {
        candidates = candidates.filter((v) => v.clientStatus === statusFilter);
      }
      // Sort by version descending and get the first one
      record = candidates.sort((a, b) =>
        b.clientVersion.localeCompare(a.clientVersion, undefined, {
          numeric: true,
        })
      )[0];
    } else {
      // Get exact version match
      record = platformVersions.find((v) => v.clientVersion === version);
    }

    if (!record) {
      recordCacheMiss('client_versions');
      return res.status(404).json({
        success: false,
        message: isLatestRequest
          ? `No client version found for platform: ${platform}${statusFilter ? ` with status: ${statusFilter}` : ''}`
          : 'Client version not found',
      });
    }

    // Record cache hit
    recordCacheHit('client_versions');

    // Get maintenance message if status is MAINTENANCE
    let maintenanceMessage: string | undefined = record.maintenanceMessage;
    if (
      record.clientStatus === 'MAINTENANCE' &&
      record.maintenanceLocales &&
      record.maintenanceLocales.length > 0
    ) {
      // Try to find message for requested language
      if (lang) {
        const localeMessage = record.maintenanceLocales.find((m) => m.lang === lang);
        if (localeMessage) {
          maintenanceMessage = localeMessage.message;
        }
      }
      // If no localized message found, use first available message
      if (!maintenanceMessage && record.maintenanceLocales.length > 0) {
        maintenanceMessage = record.maintenanceLocales[0].message;
      }
    }

    // Transform data for client consumption (same format as Backend)
    const clientData: Record<string, unknown> = {
      platform: record.platform,
      clientVersion: record.clientVersion,
      status: record.clientStatus,
      gameServerAddress: record.gameServerAddress,
      patchAddress: record.patchAddress,
      guestModeAllowed:
        record.clientStatus === 'MAINTENANCE' ? false : Boolean(record.guestModeAllowed),
      externalClickLink: record.externalClickLink,
      meta: record.customPayload || {},
    };

    // Add maintenance message if status is MAINTENANCE
    if (record.clientStatus === 'MAINTENANCE') {
      clientData.maintenanceMessage = maintenanceMessage || '';
    }

    logger.debug('Client version retrieved', {
      environment,
      platform,
      version: record.clientVersion,
    });

    return res.json({
      success: true,
      data: clientData,
      cached: true, // Edge always serves from cache
    });
  } catch (error) {
    logger.error('Error getting client version:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve client version',
      },
    });
  }
});

/**
 * @openapi
 * /client/{environment}/game-worlds:
 *   get:
 *     tags: [EdgeClient]
 *     summary: Get all game worlds (Cached)
 *     description: Returns list of visible game worlds served from edge cache.
 *     parameters:
 *       - in: path
 *         name: environment
 *         required: true
 *         schema: { type: string, example: 'production' }
 *         description: Environment name (e.g., 'staging', 'production')
 *     responses:
 *       200:
 *         description: List of game worlds
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     worlds:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/GameWorld' }
 *                     total: { type: integer, example: 1 }
 *                     timestamp: { type: string, format: date-time, example: '2025-12-12T12:00:00Z' }
 *                 cached: { type: boolean, example: true }
 */
router.get('/:environment/game-worlds', async (req: Request, res: Response) => {
  try {
    const sdk = getSDKOrError(res);
    if (!sdk) return;

    const environment = req.params.environment;

    // Get game worlds from cache for this environment
    const envWorlds = sdk.getGameWorlds(environment) as GameWorld[];

    // Record cache hit/miss
    if (envWorlds.length > 0) {
      recordCacheHit('game_worlds');
    } else {
      recordCacheMiss('game_worlds');
    }

    // Filter visible, non-maintenance worlds (same as Backend)
    const visibleWorlds = envWorlds.filter((w: GameWorld) => w.isMaintenance !== true);

    // Transform data for client consumption (same format as Backend)
    // Note: GameWorld type doesn't have description/updatedAt, but Backend returns them
    const clientData = {
      worlds: visibleWorlds.map((world: GameWorld) => ({
        id: world.id,
        worldId: world.worldId,
        name: world.name,
        description: (world as unknown as { description?: string }).description || '',
        displayOrder: world.displayOrder,
        meta: world.customPayload || {},
        createdAt: world.createdAt,
        updatedAt: (world as unknown as { updatedAt?: string }).updatedAt || world.createdAt,
      })),
      total: visibleWorlds.length,
      timestamp: new Date().toISOString(),
    };

    logger.debug('Game worlds retrieved', {
      environment,
      count: visibleWorlds.length,
    });

    res.json({
      success: true,
      data: clientData,
      cached: true, // Edge always serves from cache
    });
  } catch (error) {
    logger.error('Error getting game worlds:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve game worlds',
      },
    });
  }
});

/**
 * @openapi
 * /client/cache-stats:
 *   get:
 *     tags: [EdgeClient]
 *     summary: Get cache statistics
 *     description: Returns metrics about the edge cache status.
 *     responses:
 *       200:
 *         description: Cache statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     cache: { type: object, example: { initialized: true, type: 'edge-sdk-cache' } }
 *                     queue: { type: object, example: { pending: 0 } }
 *                     pubsub: { type: object, example: { connected: true, timestamp: '2025-12-12T12:00:00Z' } }
 */
router.get('/cache-stats', async (_req: Request, res: Response) => {
  try {
    const sdk = sdkManager.getSDK();
    const isInitialized = sdk !== null;

    res.json({
      success: true,
      data: {
        cache: {
          initialized: isInitialized,
          type: 'edge-sdk-cache',
        },
        queue: {
          pending: 0, // Edge doesn't have a queue
        },
        pubsub: {
          connected: isInitialized,
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Error getting cache stats:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve cache stats',
      },
    });
  }
});

// ============================================================================
// Authenticated Routes (Require clientAuth middleware)
// ============================================================================

/**
 * @openapi
 * /client/{environment}/test:
 *   get:
 *     tags: [EdgeClient]
 *     summary: Test client authentication
 *     description: Verifies client authentication and returns context.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: environment
 *         required: true
 *         schema: { type: string }
 *         description: Environment name (e.g., 'staging', 'production')
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Client SDK authentication successful' }
 *                 data:
 *                   type: object
 *                   example: { tokenId: 'edge-token', tokenName: 'app-1', tokenType: 'client', environment: 'production', timestamp: '2025-12-12T12:00:00Z' }
 */
router.get('/:environment/test', clientAuth, (req: ClientRequest, res: Response) => {
  const { applicationName, environment } = req.clientContext!;

  res.json({
    success: true,
    message: 'Client SDK authentication successful',
    data: {
      tokenId: 'edge-token', // Edge doesn't have token ID
      tokenName: applicationName,
      tokenType: 'client',
      environment,
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * @openapi
 * /client/{environment}/banners:
 *   get:
 *     tags: [EdgeClient]
 *     summary: Get all published banners
 *     description: Returns all published banners for the client's environment (Cached).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: environment
 *         required: true
 *         schema: { type: string }
 *         description: Environment name (e.g., 'staging', 'production')
 *     responses:
 *       200:
 *         description: List of banners
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     banners:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Banner' }
 *                     timestamp: { type: string, format: date-time, example: '2025-12-12T12:00:00Z' }
 */
router.get('/:environment/banners', clientAuth, async (req: ClientRequest, res: Response) => {
  try {
    const sdk = getSDKOrError(res);
    if (!sdk) return;

    const { environment } = req.clientContext!;

    // Get banners from cache for this environment
    const envBanners = sdk.getBanners(environment) as Banner[];

    // Record cache hit/miss
    if (envBanners.length > 0) {
      recordCacheHit('banners');
    } else {
      recordCacheMiss('banners');
    }

    // Transform for client (same format as Backend BannerClientController)
    const clientBanners = envBanners.map((banner) => ({
      bannerId: banner.bannerId,
      name: banner.name,
      width: banner.width,
      height: banner.height,
      playbackSpeed: banner.playbackSpeed,
      sequences: banner.sequences,
      metadata: banner.metadata,
      version: banner.version,
    }));

    logger.debug('Banners retrieved', {
      environment,
      count: clientBanners.length,
    });

    res.json({
      success: true,
      data: {
        banners: clientBanners,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error getting banners:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve banners',
      },
    });
  }
});

/**
 * @openapi
 * /client/{environment}/banners/{bannerId}:
 *   get:
 *     tags: [EdgeClient]
 *     summary: Get specific banner
 *     description: Returns a single banner by ID (Cached).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: environment
 *         required: true
 *         schema: { type: string }
 *         description: Environment name (e.g., 'staging', 'production')
 *       - in: path
 *         name: bannerId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Banner details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     banner: { $ref: '#/components/schemas/Banner' }
 *                     timestamp: { type: string, format: date-time }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 */
router.get(
  '/:environment/banners/:bannerId',
  clientAuth,
  async (req: ClientRequest, res: Response) => {
    try {
      const sdk = getSDKOrError(res);
      if (!sdk) return;

      const { bannerId } = req.params;
      const { environment } = req.clientContext!;

      // Get banners from cache for this environment
      const envBanners = sdk.getBanners(environment) as Banner[];

      // Find the specific banner
      const banner = envBanners.find((b) => b.bannerId === bannerId);

      if (!banner) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Banner not found',
          },
        });
      }

      // Transform for client (same format as Backend BannerClientController)
      const clientBanner = {
        bannerId: banner.bannerId,
        name: banner.name,
        width: banner.width,
        height: banner.height,
        playbackSpeed: banner.playbackSpeed,
        sequences: banner.sequences,
        metadata: banner.metadata,
        version: banner.version,
      };

      logger.debug('Banner retrieved', {
        environment,
        bannerId,
      });

      res.json({
        success: true,
        data: {
          banner: clientBanner,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Error getting banner:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve banner',
        },
      });
    }
  }
);

// ============================================================================
// Edge-specific Routes (Not in Backend)
// ============================================================================

/**
 * @openapi
 * /client/{environment}/client-versions:
 *   get:
 *     tags: [EdgeClient]
 *     summary: Get all client versions (List)
 *     description: Returns list of all client versions for the environment. Useful for patchers.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: environment
 *         required: true
 *         schema: { type: string }
 *         description: Environment name (e.g., 'staging', 'production')
 *     responses:
 *       200:
 *         description: List of client versions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     versions:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/ClientVersion' }
 *                     total: { type: integer, example: 5 }
 */
router.get(
  '/:environment/client-versions',
  clientAuth,
  async (req: ClientRequest, res: Response) => {
    try {
      const sdk = getSDKOrError(res);
      if (!sdk) return;

      const { environment, platform } = req.clientContext!;

      // Get client versions from cache for this environment
      const envVersions = sdk.getClientVersions(environment) as ClientVersion[];

      // Optionally filter by platform
      let filteredVersions = envVersions;
      if (platform) {
        filteredVersions = envVersions.filter(
          (v) => v.platform === platform || v.platform === 'all'
        );
      }

      // Record cache hit/miss
      if (filteredVersions.length > 0) {
        recordCacheHit('client_versions');
      } else {
        recordCacheMiss('client_versions');
      }

      logger.debug('Client versions retrieved', {
        environment,
        platform,
        count: filteredVersions.length,
      });

      res.json({
        success: true,
        data: {
          versions: filteredVersions,
          total: filteredVersions.length,
        },
      });
    } catch (error) {
      logger.error('Error getting client versions:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve client versions',
        },
      });
    }
  }
);

/**
 * @openapi
 * /client/{environment}/service-notices:
 *   get:
 *     tags: [EdgeClient]
 *     summary: Get service notices
 *     description: Returns list of active service notices.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: environment
 *         required: true
 *         schema: { type: string }
 *         description: Environment name (e.g., 'staging', 'production')
 *     responses:
 *       200:
 *         description: List of notices
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     notices:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/ServiceNotice' }
 *                     total: { type: integer, example: 3 }
 */
router.get(
  '/:environment/service-notices',
  clientAuth,
  async (req: ClientRequest, res: Response) => {
    try {
      const sdk = getSDKOrError(res);
      if (!sdk) return;

      const { environment, platform } = req.clientContext!;

      // Get service notices from cache for this environment
      const envNotices = sdk.getServiceNotices(environment);

      // Optionally filter by platform
      let filteredNotices = envNotices;
      if (platform) {
        filteredNotices = envNotices.filter(
          (n: { platforms?: string[] }) =>
            !n.platforms || n.platforms.length === 0 || n.platforms.includes(platform)
        );
      }

      // Record cache hit/miss
      if (filteredNotices.length > 0) {
        recordCacheHit('service_notices');
      } else {
        recordCacheMiss('service_notices');
      }

      logger.debug('Service notices retrieved', {
        environment,
        platform,
        count: filteredNotices.length,
      });

      res.json({
        success: true,
        data: {
          notices: filteredNotices,
          total: filteredNotices.length,
        },
      });
    } catch (error) {
      logger.error('Error getting service notices:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve service notices',
        },
      });
    }
  }
);

// ============================================================================
// Crash Upload Proxy (Forward to Backend)
// ============================================================================

/**
 * @openapi
 * /client/{environment}/crashes/upload:
 *   post:
 *     tags: [EdgeClient]
 *     summary: Upload crash report (Proxy)
 *     description: Proxies crash report to backend.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: environment
 *         required: true
 *         schema: { type: string }
 *         description: Environment name (e.g., 'staging', 'production')
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [platform, branch, stack]
 *             properties:
 *               platform: { type: string, example: 'android' }
 *               branch: { type: string, example: 'main' }
 *               stack: { type: string, example: 'Error at MainActivity.java:10' }
 *               marketType: { type: string, example: 'google' }
 *               isEditor: { type: boolean, example: false }
 *               appVersion: { type: string, example: '1.2.3' }
 *               resVersion: { type: string, example: '1.2.3.456' }
 *               accountId: { type: string, example: 'acc_123' }
 *               characterId: { type: string, example: 'char_456' }
 *               gameUserId: { type: string, example: 'user_789' }
 *               userName: { type: string, example: 'PlayerOne' }
 *               gameServerId: { type: string, example: 'S1' }
 *               userMessage: { type: string, example: 'Game crashed when opening inventory' }
 *               log: { type: string, example: 'System log content...' }
 *     responses:
 *       200:
 *         description: Crash reported successfully
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *             example: { success: true, message: "Crash uploaded successfully", data: { crashId: "crash_123" } }
 *       503:
 *         description: Service Unavailable (Backend unreachable)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { success: false, error: "SERVICE_UNAVAILABLE", message: "Failed to connect to backend server" }
 */
router.post(
  '/:environment/crashes/upload',
  clientAuth,
  async (req: ClientRequest, res: Response) => {
    try {
      const { environment } = req.clientContext!;

      // Get client IP and user agent to forward to backend
      const clientIp =
        (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      logger.debug('Proxying crash upload to backend', {
        environment,
        platform: req.body.platform,
        branch: req.body.branch,
        clientIp,
      });

      // Forward the request to backend
      const backendUrl = `${config.gatrixUrl}/api/v1/client/crashes/upload`;

      const response = await axios.post(backendUrl, req.body, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-token': config.apiToken,
          'x-application-name': config.applicationName,
          'x-environment': environment,
          'x-forwarded-for': clientIp,
          'user-agent': userAgent,
        },
        timeout: 30000, // 30 second timeout for crash uploads
      });

      logger.info('Crash upload proxied successfully', {
        environment,
        platform: req.body.platform,
        branch: req.body.branch,
        crashId: response.data?.data?.crashId,
        eventId: response.data?.data?.eventId,
        isNewCrash: response.data?.data?.isNewCrash,
      });

      // Return the backend response to the client
      res.status(response.status).json(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('Error proxying crash upload to backend:', {
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
          environment: req.clientContext?.environment,
          platform: req.body?.platform,
          branch: req.body?.branch,
        });

        // Forward backend error response if available
        if (error.response) {
          return res.status(error.response.status).json(error.response.data);
        }

        // Network or timeout error
        return res.status(503).json({
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Failed to connect to backend server',
          },
        });
      }

      logger.error('Unexpected error in crash upload proxy:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to process crash upload',
        },
      });
    }
  }
);

// ============================================================================
// Feature Flag Routes
// ============================================================================

/**
 * @openapi
 * /client/features/{environment}/eval:
 *   post:
 *     tags: [EdgeClient]
 *     summary: Evaluate feature flags (Local Evaluation)
 *     description: Evaluates feature flags for the given context using local cache.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: environment
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               context: { type: object }
 *               flagNames: { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: Evaluation result
 *   get:
 *     tags: [EdgeClient]
 *     summary: Evaluate feature flags (Local Evaluation - GET)
 *     description: Evaluates feature flags for the given context using local cache.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: environment
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: context
 *         schema: { type: string }
 *         description: Base64 encoded JSON string of the evaluation context.
 *       - in: query
 *         name: userId
 *         schema: { type: string }
 *         description: User ID for context.
 *       - in: query
 *         name: sessionId
 *         schema: { type: string }
 *         description: Session ID for context.
 *       - in: query
 *         name: remoteAddress
 *         schema: { type: string }
 *         description: Remote IP address for context.
 *       - in: query
 *         name: appName
 *         schema: { type: string }
 *         description: Application name for context.
 *       - in: query
 *         name: flagNames
 *         schema: { type: string }
 *         description: Comma-separated list of flag names to evaluate. If omitted, all flags are evaluated.
 *     responses:
 *       200:
 *         description: Evaluation result
 */
/**
 * Evaluation helper to reduce code duplication
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function performEvaluation(req: Request, res: Response, clientContext: any, isPost: boolean) {
  try {
    const sdk = getSDKOrError(res);
    if (!sdk) return;

    const { environment, applicationName } = clientContext;
    let context: any = {};
    let flagNames: string[] = [];

    if (isPost) {
      context = req.body.context || {};
      flagNames = req.body.flagNames || req.body.keys || [];
    } else {
      // GET: context from parameters (Unleash Proxy style) or header
      // 1. Try X-Gatrix-Feature-Context header (Base64 JSON)
      const contextHeader = req.headers['x-gatrix-feature-context'] as string;
      if (contextHeader) {
        try {
          const jsonStr = Buffer.from(contextHeader, 'base64').toString('utf-8');
          context = JSON.parse(jsonStr);
        } catch (error) {
          logger.warn('Failed to parse x-gatrix-feature-context header', {
            error,
          });
        }
      }

      // 2. Try 'context' query param (Base64 JSON)
      if (Object.keys(context).length === 0 && req.query.context) {
        try {
          const contextStr = req.query.context as string;
          const jsonStr = Buffer.from(contextStr, 'base64').toString('utf-8');
          context = JSON.parse(jsonStr);
        } catch (e) {
          try {
            context = JSON.parse(req.query.context as string);
          } catch (e2) {
            /* ignore */
          }
        }
      }

      // 3. Fallback: Parse individual query parameters
      if (!context.userId && req.query.userId) context.userId = req.query.userId as string;
      if (!context.sessionId && req.query.sessionId)
        context.sessionId = req.query.sessionId as string;
      if (!context.remoteAddress && req.query.remoteAddress)
        context.remoteAddress = req.query.remoteAddress as string;
      if (!context.appName && req.query.appName) context.appName = req.query.appName as string;

      const flagNamesParam = req.query.flagNames as string;
      if (flagNamesParam) {
        flagNames = flagNamesParam.split(',');
      }
    }

    // Default context values
    if (!context.appName) {
      context.appName = applicationName;
    }
    context.environment = environment;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: Record<string, any> = {};
    const evaluatedKeys: string[] = Array.isArray(flagNames) ? (flagNames as string[]) : [];

    // If no keys specified, evaluate ALL (matching backend behavior for client)
    let keysToEvaluate =
      evaluatedKeys.length > 0
        ? evaluatedKeys
        : sdk.featureFlag.getCached(environment).map((f) => f.name);

    // Sort keys to ensure consistent iteration order
    keysToEvaluate = [...keysToEvaluate].sort();

    for (const key of keysToEvaluate) {
      const result = sdk.featureFlag.evaluate(key, context, environment);
      const flagDef = sdk.featureFlag.getFlagByName(environment, key);

      // Build variant object according to SPEC_VALUE_RESOLUTION spec
      let variant: any = {
        name: result.variant?.name || (result.enabled ? '$default' : '$disabled'),
        enabled: result.enabled,
      };

      // The SDK evaluator already returns variant.value resolved per spec:
      // - Enabled + variant matched → variant.value
      // - Enabled + no variant → enabledValue (env override > global)
      // - Disabled → disabledValue (env override > global)
      if (result.variant?.value !== undefined && result.variant?.value !== null) {
        let resolvedValue = result.variant.value;
        const valueType = flagDef?.valueType || 'string';

        if (valueType === 'json') {
          if (typeof resolvedValue === 'string' && resolvedValue.trim() !== '') {
            try {
              resolvedValue = JSON.parse(resolvedValue);
            } catch (e) {
              /* ignore */
            }
          }
          variant.value = resolvedValue;
        } else if (valueType === 'number') {
          if (typeof resolvedValue === 'string') {
            const parsed = Number(resolvedValue);
            variant.value = isNaN(parsed) ? resolvedValue : parsed;
          } else {
            variant.value = resolvedValue;
          }
        } else {
          variant.value = resolvedValue;
        }
      }

      results[key] = {
        id: result.id,
        name: key,
        enabled: result.enabled,
        variant,
        valueType: flagDef?.valueType || 'string',
        version: flagDef?.version || 1,
        ...(flagDef?.impressionDataEnabled && { impressionData: true }),
      };
    }

    // Sort flags by id (ULID) DESCENDING to ensure consistent ETag generation and newest-first response
    // Fallback to empty string to prevent localeCompare crash if id is missing
    const flagsArray = Object.values(results).sort((a, b) =>
      (b.id || '').localeCompare(a.id || '')
    );

    const responseData = {
      success: true,
      data: {
        flags: flagsArray,
      },
      meta: {
        environment,
        evaluatedAt: new Date().toISOString(),
      },
    };

    // Generate ETag from flags data (hash of stringified flags with versions and variants)
    // We include name, version, enabled state, and variant name for a robust hash
    const etagSource = flagsArray
      .map((f: any) => {
        const variantPart = f.variant ? `${f.variant.name}:${f.variant.enabled}` : 'no-variant';
        return `${f.name}:${f.version}:${f.enabled}:${variantPart}`;
      })
      .join('|');
    const etag = `"${crypto.createHash('md5').update(etagSource).digest('hex')}"`;

    // Check If-None-Match header
    const requestEtag = req.headers['if-none-match'];
    if (requestEtag === etag) {
      return res.status(304).end();
    }

    res.set('ETag', etag);
    res.json(responseData);
  } catch (error) {
    logger.error('Error evaluating feature flags in edge:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to evaluate feature flags',
      },
    });
  }
}

router.post(
  '/features/:environment/eval',
  clientAuth,
  async (req: ClientRequest, res: Response) => {
    await performEvaluation(req, res, req.clientContext, true);
  }
);

router.get('/features/:environment/eval', clientAuth, async (req: ClientRequest, res: Response) => {
  await performEvaluation(req, res, req.clientContext, false);
});

/**
 * @openapi
 * /client/features/{environment}/stream:
 *   get:
 *     tags: [EdgeClient]
 *     summary: Stream feature flag changes (SSE)
 *     description: |
 *       Establishes a Server-Sent Events connection for real-time flag invalidation signals.
 *       Events: 'connected' (initial), 'flags_changed' (invalidation), 'heartbeat' (keepalive).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: environment
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: SSE stream established
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 */
router.get(
  '/features/:environment/stream',
  clientAuth,
  async (req: ClientRequest, res: Response) => {
    try {
      const { environment } = req.clientContext!;

      // Lazy-import to avoid import-time side effects
      const { flagStreamingService } = await import('../services/FlagStreamingService');

      // Generate unique client ID
      const clientId = `edge-flag-stream-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      // Register SSE client (sets headers, sends 'connected' event, handles cleanup on close)
      await flagStreamingService.addClient(clientId, environment, res);
    } catch (error) {
      logger.error('Error establishing flag streaming connection:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to establish streaming connection',
          },
        });
      }
    }
  }
);

/**
 * @openapi
 * /client/features/{environment}/metrics:
 *   post:
 *     tags: [EdgeClient]
 *     summary: Submit feature flag metrics (Buffered Aggregation)
 *     description: Buffers and aggregates metrics at edge before flushing to backend.
 */
router.post(
  '/features/:environment/metrics',
  clientAuth,
  async (req: ClientRequest, res: Response) => {
    try {
      const { environment, applicationName } = req.clientContext!;
      const { bucket } = req.body;
      const sdkVersion = (req.headers['x-sdk-version'] as string) || req.body.sdkVersion;

      if (!bucket) {
        return res.status(400).json({ success: false, error: 'bucket is required' });
      }

      // Add to aggregator for buffering
      metricsAggregator.addClientMetrics(environment, applicationName, bucket, sdkVersion);

      // Return success immediately (fire and forget from client perspective)
      res.json({ success: true, buffered: true });
    } catch (error) {
      logger.error('Error buffering feature metrics:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to process metrics',
        },
      });
    }
  }
);

export default router;
