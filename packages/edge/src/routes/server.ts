import { Router, Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { sdkManager } from '../services/sdkManager';
import { config } from '../config/env';
import logger from '../config/logger';
import { tokenMirrorService } from '../services/tokenMirrorService';
import { metricsAggregator } from '../services/metricsAggregator';

const router = Router();

/**
 * Server SDK authentication middleware for Edge
 */
function serverAuth(req: Request, res: Response, next: NextFunction): void {
  const apiToken = req.headers['x-api-token'] as string;
  const environment = req.params.env;

  if (!apiToken) {
    res.status(401).json({ success: false, error: 'x-api-token header is required' });
    return;
  }

  const validation = tokenMirrorService.validateToken(apiToken, 'server', environment);
  if (!validation.valid) {
    res.status(401).json({ success: false, error: 'Invalid or unauthorized server API token' });
    return;
  }

  next();
}

/**
 * Get SDK instance or return 503 error
 */
function getSDKOrError(res: Response) {
  const sdk = sdkManager.getSDK();
  if (!sdk) {
    res.status(503).json({ success: false, error: 'SDK not initialized' });
    return null;
  }
  return sdk;
}

/**
 * GET /api/v1/server/:env/features
 * Returns cached feature flags and segments for the given environment
 */
router.get('/:env/features', serverAuth, async (req: Request, res: Response) => {
  try {
    const sdk = getSDKOrError(res);
    if (!sdk) return;

    const env = req.params.env;
    const flags = sdk.featureFlag.getCached(env);
    // segments are currently global in SDK
    const segments = Array.from(sdk.featureFlag.getAllSegments().values());

    res.json({
      success: true,
      data: {
        flags,
        segments,
      },
      cached: true,
    });
  } catch (error) {
    logger.error('Error serving server features from edge:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/server/segments
 * Returns all cached segments
 */
router.get('/segments', serverAuth, async (req: Request, res: Response) => {
  try {
    const sdk = getSDKOrError(res);
    if (!sdk) return;

    const segments = Array.from(sdk.featureFlag.getAllSegments().values());
    res.json({
      success: true,
      data: { segments },
      cached: true,
    });
  } catch (error) {
    logger.error('Error serving segments from edge:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/server/:env/features/metrics
 * Buffers and aggregates server metrics
 */
router.post('/:env/features/metrics', serverAuth, async (req: Request, res: Response) => {
  try {
    const env = req.params.env;
    const appName = (req.headers['x-application-name'] as string) || 'unknown';
    const { metrics } = req.body;

    if (!Array.isArray(metrics)) {
      return res.status(400).json({ success: false, error: 'metrics must be an array' });
    }

    metricsAggregator.addServerMetrics(env, appName, metrics);
    res.json({ success: true, buffered: true });
  } catch (error) {
    logger.error('Error buffering server metrics:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/server/:env/features/unknown
 * Buffers and aggregates unknown flag reporting
 */
router.post('/:env/features/unknown', serverAuth, async (req: Request, res: Response) => {
  try {
    const env = req.params.env;
    const appName = (req.headers['x-application-name'] as string) || 'unknown';
    const { flagName, count = 1 } = req.body;

    if (!flagName) {
      return res.status(400).json({ success: false, error: 'flagName is required' });
    }

    metricsAggregator.addServerUnknownReport(env, appName, flagName, count);
    res.json({ success: true, buffered: true });
  } catch (error) {
    logger.error('Error buffering server unknown flag report:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
