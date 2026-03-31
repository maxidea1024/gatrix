import { Router, Request, Response } from 'express';
import axios from 'axios';
import { clientAuth, ClientRequest } from '../middleware/client-auth';
import { sdkManager } from '../services/sdk-manager';
import { config } from '../config/env';
import logger from '../config/logger';
import { environmentRegistry } from '../services/environment-registry';
import {
  ClientVersion,
  Banner,
  GameWorld,
} from '@gatrix/gatrix-node-server-sdk';
import { metricsAggregator } from '../services/metrics-aggregator';
import {
  cacheHitsTotal,
  cacheMissesTotal,
  cacheSize,
} from '../services/edge-metrics';
import { performEvaluation, getSDKOrError } from '../utils/evaluation-helper';

const router = Router();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Compare two version strings by splitting on '.' and comparing segments numerically.
 * Returns: negative if a < b, 0 if equal, positive if a > b
 */
function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const aVal = aParts[i] || 0;
    const bVal = bParts[i] || 0;
    if (aVal !== bVal) return aVal - bVal;
  }
  return 0;
}

/**
 * Extract client IP address from request
 */
function getClientIp(req: Request): string {
  let clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    req.socket.remoteAddress ||
    '';

  // Remove "::ffff:" prefix from IPv4-mapped IPv6 addresses
  if (clientIp.startsWith('::ffff:')) {
    clientIp = clientIp.substring(7);
  }

  return clientIp.trim();
}

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
    data:
      | Record<
          string,
          { ipWhitelist?: unknown[]; accountWhitelist?: unknown[] }
        >
      | undefined
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

router.get(
  '/client-version',
  clientAuth,
  async (req: ClientRequest, res: Response) => {
    try {
      const sdk = getSDKOrError(res);
      if (!sdk) return;

      const { environmentId, cacheKey } = req.clientContext!;
      const {
        platform,
        version,
        status,
        lang,
        channel,
        subChannel,
        patchVersion,
        accountId,
      } = req.query as {
        platform?: string;
        version?: string;
        status?: string;
        lang?: string;
        channel?: string;
        subChannel?: string;
        patchVersion?: string;
        accountId?: string;
      };

      // Validate required query params
      if (!platform) {
        return res.status(400).json({
          success: false,
          message: 'platform is a required query parameter',
        });
      }

      // Validate status parameter if provided
      const validStatuses = [
        'ONLINE',
        'OFFLINE',
        'MAINTENANCE',
        'UPDATE_REQUIRED',
        'RECOMMENDED_UPDATE',
        'FORCED_UPDATE',
      ];
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

      // Client versions are cached by projectId, resolve from environment context
      const envContext = environmentRegistry.getEnvironmentContext(environmentId);
      if (!envContext) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to resolve project for environment',
          },
        });
      }
      const allProjectVersions = sdk.clientVersion.getCached(
        envContext.projectId
      ) as ClientVersion[];

      // Filter by platform
      const platformVersions = allProjectVersions.filter(
        (v) => v.platform === platform || v.platform === 'all'
      );

      // Determine if we should fetch the latest version
      const isLatestRequest = !version || version.toLowerCase() === 'latest';

      let record: ClientVersion | undefined;
      if (isLatestRequest) {
        // Get the latest version for the platform (with optional status filter)
        let candidates = platformVersions;
        if (statusFilter) {
          candidates = candidates.filter(
            (v) => v.clientStatus === statusFilter
          );
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
          const localeMessage = record.maintenanceLocales.find(
            (m) => m.lang === lang
          );
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
      const meta = { ...(record.customPayload || {}) };

      // Handle channel/subChannel appUpdateUrl for forced/recommended updates
      if (
        channel &&
        (record.clientStatus === 'FORCED_UPDATE' ||
          record.clientStatus === 'RECOMMENDED_UPDATE')
      ) {
        try {
          const channels = sdk.vars.getParsedValue<any[]>(
            '$channels',
            environmentId
          );
          if (Array.isArray(channels)) {
            const channelData = channels.find((c) => c.value === channel);
            if (channelData) {
              let targetSubChannel = subChannel;
              if (targetSubChannel && Array.isArray(channelData.subChannels)) {
                const subChannelData = channelData.subChannels.find(
                  (sc: any) => sc.value === targetSubChannel
                );
                if (subChannelData && subChannelData.appUpdateUrl) {
                  (meta as any).appUpdateUrl = subChannelData.appUpdateUrl;
                  logger.info('appUpdateUrl successfully merged', {
                    channel,
                    subChannel,
                    url: subChannelData.appUpdateUrl,
                  });
                } else {
                  logger.warn(
                    'subChannelData not found or appUpdateUrl missing',
                    {
                      subChannel,
                      availableSubChannels: channelData.subChannels.map(
                        (sc: any) => sc.value
                      ),
                    }
                  );
                }
              } else {
                logger.warn(
                  'targetSubChannel not provided or subChannels array missing',
                  {
                    subChannel,
                    hasSubChannels: !!channelData.subChannels,
                  }
                );
              }
            } else {
              logger.warn('channelData not found in $channels', {
                channel,
                availableChannels: channels.map((c) => c.value),
              });
            }
          } else {
            logger.warn('$channels KV not found or not an array', {
              environmentId,
              found: !!channels,
            });
          }
        } catch (e) {
          logger.warn('Failed to process $channel KV for appUpdateUrl', {
            error: e,
            environmentId,
            channel,
            subChannel,
          });
        }
      }

      // Check if service-level maintenance is active (overrides client version status)
      let isServiceMaintenanceActive = false;
      let serviceMaintenanceMsg: string | undefined;
      try {
        isServiceMaintenanceActive =
          sdk.serviceMaintenance.isMaintenanceActive(environmentId);
        if (isServiceMaintenanceActive) {
          serviceMaintenanceMsg =
            sdk.serviceMaintenance.getMessage(
              (lang as 'ko' | 'en' | 'zh') || 'en',
              environmentId
            ) || '';
        }
      } catch (e) {
        logger.warn('Failed to check service maintenance status:', e);
      }

      // Determine effective status (service maintenance overrides client version status)
      let effectiveStatus = isServiceMaintenanceActive
        ? 'MAINTENANCE'
        : record.clientStatus;

      // Check minimum patch version requirement
      if (
        (record as any).minPatchVersion &&
        effectiveStatus !== 'MAINTENANCE'
      ) {
        if (
          !patchVersion ||
          compareVersions(patchVersion, (record as any).minPatchVersion) < 0
        ) {
          effectiveStatus = 'FORCED_UPDATE';
        }
      }

      // Check whitelist (IP + account): whitelisted clients bypass MAINTENANCE status
      let gameServerAddress = record.gameServerAddress;
      let patchAddress = record.patchAddress;
      let isWhitelisted = false;

      if (effectiveStatus === 'MAINTENANCE') {
        try {
          // Check IP whitelist
          const clientIp = getClientIp(req);
          if (clientIp) {
            isWhitelisted = sdk.whitelist.isIpWhitelisted(
              clientIp,
              environmentId
            );
          }

          // Check account whitelist (if accountId provided and not already whitelisted)
          if (!isWhitelisted && accountId) {
            isWhitelisted = sdk.whitelist.isAccountWhitelisted(
              accountId,
              environmentId
            );
          }

          if (isWhitelisted) {
            // Whitelisted client: override MAINTENANCE to ONLINE
            effectiveStatus = 'ONLINE';
            // Use whitelist-specific addresses if available
            if (record.gameServerAddressForWhiteList) {
              gameServerAddress = record.gameServerAddressForWhiteList;
            }
            if (record.patchAddressForWhiteList) {
              patchAddress = record.patchAddressForWhiteList;
            }
            logger.info('Whitelist bypass: MAINTENANCE -> ONLINE', {
              clientIp,
              accountId,
              environmentId,
              platform,
              version: record.clientVersion,
            });
          }
        } catch (e) {
          logger.warn('Failed to check whitelist:', e);
        }
      }

      // Inject serviceNoticeUrl into meta using actual ULID environmentId
      const edgeBaseUrl = `${req.protocol}://${req.get('host')}`;
      (meta as Record<string, unknown>).serviceNoticeUrl =
        `${edgeBaseUrl}/game-service-notices.html?environmentId=${environmentId}`;

      const clientData: Record<string, unknown> = {
        platform: record.platform,
        clientVersion: record.clientVersion,
        status: effectiveStatus,
        gameServerAddress,
        patchAddress,
        guestModeAllowed:
          effectiveStatus === 'MAINTENANCE' ||
          effectiveStatus === 'FORCED_UPDATE'
            ? false
            : Boolean(record.guestModeAllowed),
        externalClickLink: record.externalClickLink,
        tags: Array.isArray(record.tags)
          ? record.tags.map((t: any) => (typeof t === 'string' ? t : t.name))
          : [],
        meta,
      };

      // Add maintenance message if status is MAINTENANCE
      if (effectiveStatus === 'MAINTENANCE') {
        // Service maintenance message takes priority over client version maintenance message
        clientData.maintenanceMessage = isServiceMaintenanceActive
          ? serviceMaintenanceMsg || ''
          : maintenanceMessage || '';
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
  }
);

router.get(
  '/game-worlds',
  clientAuth,
  async (req: ClientRequest, res: Response) => {
    try {
      const sdk = getSDKOrError(res);
      if (!sdk) return;

      const { environmentId, cacheKey } = req.clientContext!;

      // Get game worlds from cache for this environment
      const envWorlds = sdk.gameWorld.getCached(
        cacheKey || environmentId
      ) as GameWorld[];

      // Record cache hit/miss
      if (envWorlds.length > 0) {
        recordCacheHit('game_worlds');
      } else {
        recordCacheMiss('game_worlds');
      }

      // Filter visible, non-maintenance worlds (same as Backend)
      const visibleWorlds = envWorlds.filter(
        (w: GameWorld) => w.isMaintenance !== true
      );

      // Transform data for client consumption (same format as Backend)
      // Note: GameWorld type doesn't have description/updatedAt, but Backend returns them
      const clientData = {
        worlds: visibleWorlds.map((world: GameWorld) => ({
          id: world.id,
          worldId: world.worldId,
          name: world.name,
          displayOrder: world.displayOrder,
          tags: (world as unknown as { tags?: string | null }).tags || null,
          meta: world.customPayload || {},
        })),
      };

      logger.debug('Game worlds retrieved', {
        environmentId,
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
  }
);

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

router.get(
  '/banners',
  clientAuth,
  async (req: ClientRequest, res: Response) => {
    try {
      const sdk = getSDKOrError(res);
      if (!sdk) return;

      const { environmentId } = req.clientContext!;

      // Get banners from cache for this environment
      const envBanners = sdk.banner.getCached(environmentId) as Banner[];

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
  }
);

router.get(
  '/banners/:bannerId',
  clientAuth,
  async (req: ClientRequest, res: Response) => {
    try {
      const sdk = getSDKOrError(res);
      if (!sdk) return;

      const { bannerId } = req.params;
      const { environmentId } = req.clientContext!;

      // Get banners from cache for this environment
      const envBanners = sdk.banner.getCached(environmentId) as Banner[];

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
  }
);

// ============================================================================
// Edge-specific Routes (Not in Backend)
// ============================================================================

router.get(
  '/client-versions',
  clientAuth,
  async (req: ClientRequest, res: Response) => {
    try {
      const sdk = getSDKOrError(res);
      if (!sdk) return;

      const { environmentId, platform } = req.clientContext!;

      // Client versions are cached by projectId, resolve from environment context
      const envContext = environmentRegistry.getEnvironmentContext(environmentId);
      if (!envContext) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to resolve project for environment',
          },
        });
      }
      const projectVersions = sdk.clientVersion.getCached(
        envContext.projectId
      ) as ClientVersion[];

      // Optionally filter by platform
      let filteredVersions = projectVersions;
      if (platform) {
        filteredVersions = projectVersions.filter(
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
        environmentId,
        platform,
        count: filteredVersions.length,
      });

      // Transform to client-friendly format (same as /client-version single endpoint)
      const clientVersions = filteredVersions.map((v: any) => ({
        platform: v.platform,
        clientVersion: v.clientVersion,
        status: v.clientStatus,
        gameServerAddress: v.gameServerAddress,
        patchAddress: v.patchAddress,
        guestModeAllowed: Boolean(v.guestModeAllowed),
        externalClickLink: v.externalClickLink,
        tags: Array.isArray(v.tags)
          ? v.tags.map((t: any) => (typeof t === 'string' ? t : t.name))
          : [],
        meta: v.customPayload || {},
      }));

      res.json({
        success: true,
        data: {
          versions: clientVersions,
          total: clientVersions.length,
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

router.get(
  '/service-notices',
  clientAuth,
  async (req: ClientRequest, res: Response) => {
    try {
      const sdk = getSDKOrError(res);
      if (!sdk) return;

      const { environmentId, platform } = req.clientContext!;

      // Get service notices from cache for this environment
      const envNotices = sdk.serviceNotice.getCached(environmentId);

      // Optionally filter by platform
      let filteredNotices = envNotices;
      if (platform) {
        filteredNotices = envNotices.filter(
          (n: { platforms?: string[] }) =>
            !n.platforms ||
            n.platforms.length === 0 ||
            n.platforms.includes(platform)
        );
      }

      // Record cache hit/miss
      if (filteredNotices.length > 0) {
        recordCacheHit('service_notices');
      } else {
        recordCacheMiss('service_notices');
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
  }
);

// ============================================================================
// Crash Upload Proxy (Forward to Backend)
// Backend generates presigned upload URL in response
// ============================================================================

router.post(
  '/crashes',
  clientAuth,
  async (req: ClientRequest, res: Response) => {
    try {
      const { environmentId } = req.clientContext!;

      // Get client IP and user agent to forward to backend
      const clientIp =
        (req.headers['x-forwarded-for'] as string) ||
        req.socket.remoteAddress ||
        'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      logger.debug('Proxying crash upload to backend', {
        environmentId,
        platform: req.body.platform,
        branch: req.body.branch,
        clientIp,
      });

      // Forward the request to backend
      const backendUrl = `${config.gatrixUrl}/api/v1/client/crashes`;

      const response = await axios.post(backendUrl, req.body, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-token': config.apiToken,
          'x-application-name': config.appName,
          'x-environment-id': environmentId,
          'x-forwarded-for': clientIp,
          'user-agent': userAgent,
        },
        timeout: 30000, // 30 second timeout for crash uploads
      });

      logger.info('Crash upload proxied successfully', {
        environmentId,
        platform: req.body.platform,
        branch: req.body.branch,
        crashId: response.data?.data?.crashId,
        eventId: response.data?.data?.eventId,
        isNewCrash: response.data?.data?.isNewCrash,
      });

      // Return the backend response to the client (includes logUploadUrl)
      res.status(response.status).json(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('Error proxying crash upload to backend:', {
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
          environment: req.clientContext?.environmentId,
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

router.post(
  '/features/eval',
  clientAuth,
  async (req: ClientRequest, res: Response) => {
    await performEvaluation(req, res, req.clientContext, true);
  }
);

router.get(
  '/features/eval',
  clientAuth,
  async (req: ClientRequest, res: Response) => {
    await performEvaluation(req, res, req.clientContext, false);
  }
);

router.get(
  '/features/stream/sse',
  clientAuth,
  async (req: ClientRequest, res: Response) => {
    try {
      const { environmentId } = req.clientContext!;

      // Lazy-import to avoid import-time side effects
      const { flagStreamingService } =
        await import('../services/flag-streaming-service');

      // Generate unique client ID
      const clientId = `edge-flag-stream-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      // Register SSE client (sets headers, sends 'connected' event, handles cleanup on close)
      await flagStreamingService.addClient(clientId, environmentId, res);
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

router.post(
  '/features/metrics',
  clientAuth,
  async (req: ClientRequest, res: Response) => {
    try {
      const { environmentId, applicationName } = req.clientContext!;
      const { bucket } = req.body;
      const sdkVersion =
        (req.headers['x-sdk-version'] as string) || req.body.sdkVersion;

      if (!bucket) {
        return res
          .status(400)
          .json({ success: false, error: 'bucket is required' });
      }

      // Add to aggregator for buffering
      metricsAggregator.addClientMetrics(
        environmentId,
        applicationName,
        bucket,
        sdkVersion
      );

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
