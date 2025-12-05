import { Router, Request, Response } from 'express';
import { clientAuth, ClientRequest } from '../middleware/clientAuth';
import { sdkManager } from '../services/sdkManager';
import logger from '../config/logger';
import { ClientVersion, Banner, GameWorld } from '@gatrix/server-sdk';

const router = Router();

// ============================================================================
// Helper Functions
// ============================================================================

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

// ============================================================================
// Public Routes (No Authentication Required - Same as Backend)
// ============================================================================

/**
 * Get client version information
 * GET /api/v1/client/client-version
 *
 * Query params:
 * - platform (required): Platform identifier (e.g., 'android', 'ios', 'windows')
 * - version (optional): Client version string. If omitted or 'latest', returns the latest version
 * - status (optional): Filter by status (e.g., 'ONLINE', 'MAINTENANCE')
 * - lang (optional): Language code for localized maintenance messages
 *
 * Headers:
 * - x-application-name (required)
 * - x-api-token (required)
 */
router.get('/client-version', async (req: Request, res: Response) => {
  try {
    const sdk = getSDKOrError(res);
    if (!sdk) return;

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

    // Get environment ID from header (Edge-specific)
    const environmentId = req.headers['x-environment-id'] as string;
    if (!environmentId) {
      return res.status(400).json({
        success: false,
        message: 'x-environment-id header is required',
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

    // Get all client versions from cache
    const allVersions = sdk.getClientVersions() as ClientVersion[];

    // Filter by environment
    const envVersions = allVersions.filter(
      (v) => v.environmentId === environmentId
    );

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
        b.clientVersion.localeCompare(a.clientVersion, undefined, { numeric: true })
      )[0];
    } else {
      // Get exact version match
      record = platformVersions.find((v) => v.clientVersion === version);
    }

    if (!record) {
      return res.status(404).json({
        success: false,
        message: isLatestRequest
          ? `No client version found for platform: ${platform}${statusFilter ? ` with status: ${statusFilter}` : ''}`
          : 'Client version not found',
      });
    }

    // Get maintenance message if status is MAINTENANCE
    let maintenanceMessage: string | undefined = record.maintenanceMessage;
    if (record.clientStatus === 'MAINTENANCE' && record.maintenanceLocales && record.maintenanceLocales.length > 0) {
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
      guestModeAllowed: record.clientStatus === 'MAINTENANCE' ? false : Boolean(record.guestModeAllowed),
      externalClickLink: record.externalClickLink,
      meta: record.customPayload || {},
    };

    // Add maintenance message if status is MAINTENANCE
    if (record.clientStatus === 'MAINTENANCE') {
      clientData.maintenanceMessage = maintenanceMessage || '';
    }

    logger.debug('Client version retrieved', {
      environmentId,
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
 * Get all game worlds
 * GET /api/v1/client/game-worlds
 */
router.get('/game-worlds', async (_req: Request, res: Response) => {
  try {
    const sdk = getSDKOrError(res);
    if (!sdk) return;

    // Get all game worlds from cache (using getGameWorlds() method)
    const allWorlds = sdk.getGameWorlds() as GameWorld[];

    // Filter visible, non-maintenance worlds (same as Backend)
    const visibleWorlds = allWorlds.filter(
      (w: GameWorld) => w.isMaintenance !== true
    );

    // Transform data for client consumption (same format as Backend)
    // Note: GameWorld type doesn't have description/updatedAt, but Backend returns them
    const clientData = {
      worlds: visibleWorlds.map((world: GameWorld) => ({
        id: world.id,
        worldId: world.worldId,
        name: world.name,
        description: (world as unknown as { description?: string }).description || '',
        displayOrder: world.displayOrder,
        createdAt: world.createdAt,
        updatedAt: (world as unknown as { updatedAt?: string }).updatedAt || world.createdAt,
      })),
      total: visibleWorlds.length,
      timestamp: new Date().toISOString(),
    };

    logger.debug('Game worlds retrieved', {
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
 * Get cache statistics (Edge-specific)
 * GET /api/v1/client/cache-stats
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
 * Test client SDK authentication
 * GET /api/v1/client/test
 */
router.get('/test', clientAuth, (req: ClientRequest, res: Response) => {
  const { applicationName, environmentId } = req.clientContext!;

  res.json({
    success: true,
    message: 'Client SDK authentication successful',
    data: {
      tokenId: 'edge-token', // Edge doesn't have token ID
      tokenName: applicationName,
      tokenType: 'client',
      environmentId,
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * Get all published banners for client
 * GET /api/v1/client/banners
 */
router.get('/banners', clientAuth, async (req: ClientRequest, res: Response) => {
  try {
    const sdk = getSDKOrError(res);
    if (!sdk) return;

    const { environmentId } = req.clientContext!;

    // Get all banners from cache
    const allBanners = sdk.getBanners() as Banner[];

    // Filter by environment
    const envBanners = allBanners.filter(
      (b) => b.environmentId === environmentId
    );

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
      environmentId,
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
 * Get published banner by ID for client
 * GET /api/v1/client/banners/:bannerId
 */
router.get('/banners/:bannerId', clientAuth, async (req: ClientRequest, res: Response) => {
  try {
    const sdk = getSDKOrError(res);
    if (!sdk) return;

    const { bannerId } = req.params;
    const { environmentId } = req.clientContext!;

    // Get all banners from cache
    const allBanners = sdk.getBanners() as Banner[];

    // Find the specific banner
    const banner = allBanners.find(
      (b) => b.bannerId === bannerId && b.environmentId === environmentId
    );

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
      environmentId,
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
});

// ============================================================================
// Edge-specific Routes (Not in Backend)
// ============================================================================

/**
 * Get client versions (Edge-specific list endpoint)
 * GET /api/v1/client/versions
 */
router.get('/versions', clientAuth, async (req: ClientRequest, res: Response) => {
  try {
    const sdk = getSDKOrError(res);
    if (!sdk) return;

    const { environmentId, platform } = req.clientContext!;

    // Get all client versions from cache
    const allVersions = sdk.getClientVersions() as ClientVersion[];

    // Filter by environment
    const envVersions = allVersions.filter(
      (v) => v.environmentId === environmentId
    );

    // Optionally filter by platform
    let filteredVersions = envVersions;
    if (platform) {
      filteredVersions = envVersions.filter(
        (v) => v.platform === platform || v.platform === 'all'
      );
    }

    logger.debug('Client versions retrieved', {
      environmentId,
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
});

/**
 * Get service notices (Edge-specific list endpoint)
 * GET /api/v1/client/notices
 */
router.get('/notices', clientAuth, async (req: ClientRequest, res: Response) => {
  try {
    const sdk = getSDKOrError(res);
    if (!sdk) return;

    const { environmentId, platform } = req.clientContext!;

    // Get all service notices from cache
    const allNotices = sdk.getServiceNotices();

    // Filter by environment
    const envNotices = allNotices.filter(
      (n: { environmentId?: string }) => n.environmentId === environmentId
    );

    // Optionally filter by platform
    let filteredNotices = envNotices;
    if (platform) {
      filteredNotices = envNotices.filter(
        (n: { platforms?: string[] }) => !n.platforms || n.platforms.length === 0 || n.platforms.includes(platform)
      );
    }

    logger.debug('Service notices retrieved', {
      environmentId,
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
});

export default router;

