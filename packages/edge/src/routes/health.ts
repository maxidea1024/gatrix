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

export default router;
