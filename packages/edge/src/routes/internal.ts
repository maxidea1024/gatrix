import { Router, Request, Response } from 'express';
import { sdkManager } from '../services/sdkManager';

const router = Router();

/**
 * Build cache status response
 */
function buildCacheResponse(sdk: any): any {
  const allCached = sdk.getAllCachedData();

  // Build summary with counts per environment
  const summary: Record<string, any> = {};

  // Client versions by environment
  if (allCached.clientVersions) {
    summary.clientVersions = {};
    for (const [env, versions] of Object.entries(allCached.clientVersions)) {
      summary.clientVersions[env] = (versions as any[]).length;
    }
  }

  // Service notices by environment
  if (allCached.serviceNotices) {
    summary.serviceNotices = {};
    for (const [env, notices] of Object.entries(allCached.serviceNotices)) {
      summary.serviceNotices[env] = (notices as any[]).length;
    }
  }

  // Banners by environment
  if (allCached.banners) {
    summary.banners = {};
    for (const [env, banners] of Object.entries(allCached.banners)) {
      summary.banners[env] = (banners as any[]).length;
    }
  }

  // Store products by environment
  if (allCached.storeProducts) {
    summary.storeProducts = {};
    for (const [env, products] of Object.entries(allCached.storeProducts)) {
      summary.storeProducts[env] = (products as any[]).length;
    }
  }

  // Game worlds by environment
  if (allCached.gameWorlds) {
    summary.gameWorlds = {};
    for (const [env, worlds] of Object.entries(allCached.gameWorlds)) {
      summary.gameWorlds[env] = (worlds as any[]).length;
    }
  }

  // Popup notices by environment
  if (allCached.popupNotices) {
    summary.popupNotices = {};
    for (const [env, notices] of Object.entries(allCached.popupNotices)) {
      summary.popupNotices[env] = (notices as any[]).length;
    }
  }

  // Surveys by environment
  if (allCached.surveys) {
    summary.surveys = {};
    for (const [env, surveyList] of Object.entries(allCached.surveys)) {
      summary.surveys[env] = (surveyList as any[]).length;
    }
  }

  return {
    status: 'ready',
    timestamp: new Date().toISOString(),
    lastRefreshedAt: allCached.lastRefreshedAt || null,
    summary,
    detail: allCached,
  };
}

/**
 * Cache status endpoint (for debugging)
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

  const response = buildCacheResponse(sdk);
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
    await sdk.refreshCache();

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

export default router;
