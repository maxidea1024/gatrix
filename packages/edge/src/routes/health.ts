import { Router, Request, Response } from 'express';
import { sdkManager } from '../services/sdkManager';
import { tokenMirrorService } from '../services/tokenMirrorService';

const router = Router();

/**
 * Health check endpoint
 * GET /health
 */
router.get('/', (req: Request, res: Response) => {
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
 * Readiness check endpoint
 * GET /health/ready
 */
router.get('/ready', (req: Request, res: Response) => {
  const sdk = sdkManager.getSDK();
  const isReady = sdk !== null;

  if (isReady) {
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      status: 'not_ready',
      message: 'SDK not initialized',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Liveness check endpoint
 * GET /health/live
 */
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Cache status endpoint (for debugging)
 * GET /health/cache
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

  // Other cached data (not environment-specific)
  summary.gameWorlds = allCached.gameWorlds?.length || 0;
  summary.popupNotices = allCached.popupNotices?.length || 0;
  summary.surveys = allCached.surveys?.length || 0;

  res.json({
    status: 'ready',
    timestamp: new Date().toISOString(),
    summary,
    detail: allCached,
  });
});

export default router;

