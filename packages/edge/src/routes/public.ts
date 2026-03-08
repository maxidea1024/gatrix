import { Router, Request, Response } from 'express';
import { sdkManager } from '../services/sdk-manager';
import { createLogger } from '../config/logger';

const logger = createLogger('PublicRoute');
import { cacheHitsTotal, cacheMissesTotal } from '../services/edge-metrics';

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
 * Get SDK instance or return 503 error
 */
function getSDKOrError(
  res: Response
): ReturnType<typeof sdkManager.getSDK> | null {
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

router.get(
  '/:environment/service-notices',
  async (req: Request, res: Response) => {
    try {
      const sdk = getSDKOrError(res);
      if (!sdk) return;

      const environmentId = req.params.environment;
      const platform = req.query.platform as string | undefined;
      const fields = req.query.fields as string | undefined;

      // Get service notices from cache for this environment
      const envNotices = sdk.getServiceNotices(environmentId);

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

      // If fields=summary, exclude content for lighter payload (for list view)
      let responseNotices = filteredNotices;
      if (fields === 'summary') {
        responseNotices = filteredNotices.map((n: any) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { content, ...summary } = n;
          return summary;
        });
      }

      // Record cache hit/miss
      if (filteredNotices.length > 0) {
        recordCacheHit('public_service_notices');
      } else {
        recordCacheMiss('public_service_notices');
      }

      logger.debug('Public service notices retrieved', {
        environmentId,
        platform,
        fields,
        count: responseNotices.length,
      });

      // Disable HTTP caching so browser always gets fresh data from SDK cache
      res.set(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate'
      );
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.removeHeader('ETag');

      res.json({
        success: true,
        data: {
          notices: responseNotices,
          total: responseNotices.length,
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
  }
);

router.get(
  '/:environment/service-notices/:noticeId',
  async (req: Request, res: Response) => {
    try {
      const sdk = getSDKOrError(res);
      if (!sdk) return;

      const environmentId = req.params.environment;
      const noticeId = req.params.noticeId;

      if (!noticeId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PARAMETER',
            message: 'Invalid notice ID',
          },
        });
        return;
      }

      // Get service notices from cache for this environment
      const envNotices = sdk.getServiceNotices(environmentId);
      const notice = envNotices.find((n: { id: string }) => n.id === noticeId);

      if (!notice) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Service notice not found',
          },
        });
        return;
      }

      recordCacheHit('public_service_notice_detail');

      logger.debug('Public service notice detail retrieved', {
        environmentId,
        noticeId,
      });

      // Disable HTTP caching
      res.set(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate'
      );
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.removeHeader('ETag');

      res.json({
        success: true,
        data: notice,
      });
    } catch (error) {
      logger.error('Error getting service notice detail:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve service notice',
        },
      });
    }
  }
);

export default router;
