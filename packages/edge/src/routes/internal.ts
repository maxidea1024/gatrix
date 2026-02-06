import { Router, Request, Response } from 'express';
import { sdkManager } from '../services/sdkManager';
import { tokenMirrorService } from '../services/tokenMirrorService';
import { requestStats } from '../services/requestStats';

const router = Router();

/**
 * Health status endpoint
 * GET /internal/health
 */
router.get('/health', (req: Request, res: Response) => {
  const sdk = sdkManager.getSDK();
  const isSdkReady = sdk !== null;
  const isTokenMirrorReady = tokenMirrorService.isInitialized();
  const isReady = isSdkReady && isTokenMirrorReady;

  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'healthy' : 'initializing',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    sdk: isSdkReady ? 'ready' : 'initializing',
    tokenMirror: isTokenMirrorReady ? 'ready' : 'initializing',
    tokenCount: tokenMirrorService.getTokenCount(),
  });
});

/**
 * Build cache status response
 */
function buildCacheResponse(sdk: any, includeDetail: boolean = true): any {
  const allCached = sdk.getAllCachedData();
  const INTERNAL_ENV = 'gatrix-env';

  // Build summary with counts per environment
  const summary: Record<string, any> = {};

  // Client versions by environment
  if (allCached.clientVersions) {
    summary.clientVersions = {};
    for (const [env, versions] of Object.entries(allCached.clientVersions)) {
      if (env === INTERNAL_ENV) continue;
      summary.clientVersions[env] = (versions as any[]).length;
    }
  }

  // Service notices by environment
  if (allCached.serviceNotices) {
    summary.serviceNotices = {};
    for (const [env, notices] of Object.entries(allCached.serviceNotices)) {
      if (env === INTERNAL_ENV) continue;
      summary.serviceNotices[env] = (notices as any[]).length;
    }
  }

  // Banners by environment
  if (allCached.banners) {
    summary.banners = {};
    for (const [env, banners] of Object.entries(allCached.banners)) {
      if (env === INTERNAL_ENV) continue;
      summary.banners[env] = (banners as any[]).length;
    }
  }

  // Store products by environment
  if (allCached.storeProducts) {
    summary.storeProducts = {};
    for (const [env, products] of Object.entries(allCached.storeProducts)) {
      if (env === INTERNAL_ENV) continue;
      summary.storeProducts[env] = (products as any[]).length;
    }
  }

  // Game worlds by environment
  if (allCached.gameWorlds) {
    summary.gameWorlds = {};
    for (const [env, worlds] of Object.entries(allCached.gameWorlds)) {
      if (env === INTERNAL_ENV) continue;
      summary.gameWorlds[env] = (worlds as any[]).length;
    }
  }

  // Popup notices by environment
  if (allCached.popupNotices) {
    summary.popupNotices = {};
    for (const [env, notices] of Object.entries(allCached.popupNotices)) {
      if (env === INTERNAL_ENV) continue;
      summary.popupNotices[env] = (notices as any[]).length;
    }
  }

  // Surveys by environment
  if (allCached.surveys) {
    summary.surveys = {};
    for (const [env, surveyList] of Object.entries(allCached.surveys)) {
      if (env === INTERNAL_ENV) continue;
      summary.surveys[env] = (surveyList as any[]).length;
    }
  }

  // Check if SDK is actually initialized for status reporting
  const isInitialized = typeof sdk.isInitialized === 'function' && sdk.isInitialized();

  const response: any = {
    status: isInitialized ? 'ready' : 'initializing',
    timestamp: new Date().toISOString(),
    lastRefreshedAt: allCached.lastRefreshedAt || null,
    invalidationCount: allCached.invalidationCount || 0,
    summary,
  };

  if (includeDetail) {
    // Filter raw detail data to remove internal env
    const filteredDetail: Record<string, any> = { ...allCached };
    const envKeyedProps = [
      'clientVersions',
      'serviceNotices',
      'banners',
      'storeProducts',
      'gameWorlds',
      'popupNotices',
      'surveys',
    ];

    for (const prop of envKeyedProps) {
      if (filteredDetail[prop]) {
        const filtered: Record<string, any> = {};
        for (const [env, data] of Object.entries(filteredDetail[prop])) {
          if (env !== INTERNAL_ENV) {
            filtered[env] = data;
          }
        }
        filteredDetail[prop] = filtered;
      }
    }
    response.detail = filteredDetail;
  }

  return response;
}

/**
 * Cache summary endpoint (lightweight)
 * GET /internal/cache/summary
 */
router.get('/cache/summary', (req: Request, res: Response) => {
  const sdk = sdkManager.getSDK();

  if (!sdk) {
    res.status(503).json({
      status: 'not_ready',
      message: 'SDK not initialized',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const response = buildCacheResponse(sdk, false);
  res.json(response);
});

/**
 * Cache status endpoint (for debugging, full data)
 * GET /internal/cache
 */
router.get('/cache', (req: Request, res: Response) => {
  const sdk = sdkManager.getSDK();

  if (!sdk) {
    res.status(503).json({
      status: 'not_ready',
      message: 'SDK not initialized',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const response = buildCacheResponse(sdk, true);
  res.json(response);
});

/**
 * Force cache refresh endpoint
 * POST /internal/cache/refresh
 */
router.post('/cache/refresh', async (req: Request, res: Response) => {
  const sdk = sdkManager.getSDK();

  if (!sdk) {
    res.status(503).json({
      status: 'not_ready',
      message: 'SDK not initialized',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  try {
    // Access cache manager directly to refresh all
    // Typescript might complain about private property but in JS runtime it's fine,
    // however clean way is to use sdk.cacheManager if exposed, or add refresh method to SDK.
    // Looking at GatrixServerSDK.ts, there is no public refreshAll method exposed directly that refreshes EVERYTHING.
    // Wait, sdk.refreshCache method? It wasn't in the file I viewed (GatrixServerSDK.ts).
    // Let's check GatrixServerSDK.ts again. I might have missed it or it's not there.
    // If not there, I should use cacheManager directly if accessible (it is private).
    // Or I should add a method to SDK. But I am editing edge code now.

    // In internal.ts original code: await sdk.refreshCache();
    // Does refreshCache exist on SDK?
    // I previously viewed GatrixServerSDK.ts and I didn't see refreshCache() method in the truncated view or full view?
    // Let's check the previous `view_file` output for `GatrixServerSDK.ts` (Step 354, lines 1200-1476).
    // I see `refreshWhitelistCache`. I don't see `refreshCache` or `refreshAll`.

    // Ah, I might need to cast to any to access cacheManager or add the method.
    // Since I cannot easily modify SDK types without rebuild/reinstall linking (it's a monorepo so maybe easy),
    // but the safest bet is to check if `refreshCache` exists or use `any`.

    if (typeof (sdk as any).refreshCache === 'function') {
      await (sdk as any).refreshCache();
    } else if ((sdk as any).cacheManager) {
      await (sdk as any).cacheManager.refreshAll();
    } else {
      throw new Error('Callback for refresh not found on SDK');
    }

    const response = buildCacheResponse(sdk);
    res.json(response);
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to refresh cache',
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================================================
// Request Statistics Endpoints
// ============================================================================

/**
 * Get request statistics snapshot
 * GET /internal/stats/requests
 */
router.get('/stats/requests', (req: Request, res: Response) => {
  const snapshot = requestStats.getSnapshot();
  res.json({
    success: true,
    data: snapshot,
    rateLimit: requestStats.getRateLimit(),
  });
});

/**
 * Reset request statistics
 * POST /internal/stats/requests/reset
 */
router.post('/stats/requests/reset', (req: Request, res: Response) => {
  requestStats.reset();
  res.json({
    success: true,
    message: 'Request statistics reset',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Get/Set rate limit for request logging
 * GET /internal/stats/rate-limit
 * POST /internal/stats/rate-limit { limit: number }
 */
router.get('/stats/rate-limit', (req: Request, res: Response) => {
  res.json({
    success: true,
    rateLimit: requestStats.getRateLimit(),
    description: 'Maximum request logs per second (0 = disabled)',
  });
});

router.post('/stats/rate-limit', (req: Request, res: Response) => {
  const { limit } = req.body;

  if (typeof limit !== 'number' || limit < 0) {
    res.status(400).json({
      success: false,
      error: 'Invalid limit. Must be a non-negative number.',
    });
    return;
  }

  requestStats.setRateLimit(limit);
  res.json({
    success: true,
    rateLimit: limit,
    message: limit === 0 ? 'Request logging disabled' : `Rate limit set to ${limit}/second`,
  });
});

export default router;
