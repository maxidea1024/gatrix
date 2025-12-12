import { Router, Request, Response } from 'express';
import { sdkManager } from '../services/sdkManager';
import logger from '../config/logger';
import { cacheHitsTotal, cacheMissesTotal } from '../services/metricsServer';

const router = Router();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Record cache hit metric
 */
function recordCacheHit(cacheType: string): void {
  cacheHitsTotal.labels(cacheType).inc();
}

/**
 * Record cache miss metric
 */
function recordCacheMiss(cacheType: string): void {
  cacheMissesTotal.labels(cacheType).inc();
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

// ============================================================================
// Public Routes (No Authentication Required)
// ============================================================================

/**
 * @openapi
 * /public/{environment}/service-notices:
 *   get:
 *     tags: [EdgePublic]
 *     summary: Get public service notices
 *     description: Returns list of active service notices. No authentication required.
 *     parameters:
 *       - in: path
 *         name: environment
 *         required: true
 *         schema: { type: string }
 *         description: Environment name (e.g., 'staging', 'production')
 *       - in: query
 *         name: platform
 *         schema: { type: string }
 *         description: Platform filter (e.g., 'android', 'ios')
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100 }
 *         description: Maximum number of notices to return
 *     responses:
 *       200:
 *         description: List of service notices
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
router.get('/:environment/service-notices', async (req: Request, res: Response) => {
  try {
    const sdk = getSDKOrError(res);
    if (!sdk) return;

    const environment = req.params.environment;
    const platform = req.query.platform as string | undefined;

    // Get service notices from cache for this environment
    const envNotices = sdk.getServiceNotices(environment);

    // Optionally filter by platform
    let filteredNotices = envNotices;
    if (platform) {
      filteredNotices = envNotices.filter(
        (n: { platforms?: string[] }) => !n.platforms || n.platforms.length === 0 || n.platforms.includes(platform)
      );
    }

    // Record cache hit/miss
    if (filteredNotices.length > 0) {
      recordCacheHit('public_service_notices');
    } else {
      recordCacheMiss('public_service_notices');
    }

    logger.debug('Public service notices retrieved', {
      environment,
      platform,
      count: filteredNotices.length,
    });

    // Disable HTTP caching so browser always gets fresh data from SDK cache
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.removeHeader('ETag');

    res.json({
      success: true,
      data: {
        notices: filteredNotices,
        total: filteredNotices.length,
      },
    });
  } catch (error) {
    logger.error('Error getting public service notices:', error);
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

