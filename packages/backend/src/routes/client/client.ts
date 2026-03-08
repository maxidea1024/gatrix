import { Router } from 'express';
import { ClientController } from '../../controllers/client-controller';
import { ClientCrashController } from '../../controllers/client-crash-controller';
import { BannerClientController } from '../../controllers/banner-client-controller';
import { requestLogger } from '../../middleware/request-logger';
import { clientSDKAuth } from '../../middleware/api-token-auth';
import { body, param, validationResult } from 'express-validator';
import { GatrixError } from '../../middleware/error-handler';

const router = Router();

// Validation middleware
const validateRequest = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map((err: any) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    }));

    const errorMessage = errorDetails
      .map((err: any) => `${err.field}: ${err.message}`)
      .join(', ');

    const error = new GatrixError(`Validation failed: ${errorMessage}`, 400);
    (error as any).validationErrors = errorDetails;
    throw error;
  }
  next();
};

router.use(requestLogger);

router.get('/client-version', clientSDKAuth, ClientController.getClientVersion);

router.get('/game-worlds', clientSDKAuth, ClientController.getGameWorlds);

router.get('/cache-stats', clientSDKAuth, ClientController.getCacheStats);

router.post(
  '/invalidate-cache',
  clientSDKAuth,
  ClientController.invalidateCache
);

// Feature Flag evaluation routes (token determines environment)
router.post('/features/eval', clientSDKAuth, ClientController.evaluateFlags);
router.get('/features/eval', clientSDKAuth, ClientController.evaluateFlags);

// Feature Flag streaming route (SSE for real-time invalidation)
router.get('/features/stream/sse', clientSDKAuth, ClientController.streamFlags);

// Metrics route
router.post('/features/metrics', clientSDKAuth, ClientController.submitMetrics);

// Client SDK routes (with API token authentication)
router.get('/test', clientSDKAuth, (req: any, res: any) => {
  const apiToken = req.apiToken;

  res.json({
    success: true,
    message: 'Client SDK authentication successful',
    data: {
      tokenId: apiToken?.id,
      tokenName: apiToken?.tokenName,
      tokenType: apiToken?.tokenType,
      timestamp: new Date().toISOString(),
    },
  });
});

// Crash upload endpoint (requires client API token)
router.post(
  '/crashes/upload',
  clientSDKAuth,
  body('platform').isString().notEmpty(),
  body('branch').isString().notEmpty(),
  body('stack').isString().notEmpty(),
  body('marketType').optional({ nullable: true }).isString(),
  body('isEditor').optional({ nullable: true }).isBoolean(),
  body('appVersion').optional({ nullable: true }).isString(),
  body('resVersion').optional({ nullable: true }).isString(),
  body('accountId').optional({ nullable: true }).isString(),
  body('characterId').optional({ nullable: true }).isString(),
  body('gameUserId').optional({ nullable: true }).isString(),
  body('userName').optional({ nullable: true }).isString(),
  body('gameServerId').optional({ nullable: true }).isString(),
  body('userMessage').optional({ nullable: true }).isString(),
  body('log').optional({ nullable: true }).isString(),
  validateRequest,
  ClientCrashController.uploadCrash
);

// Banner routes for game client
router.get('/banners', clientSDKAuth, BannerClientController.getBanners);
router.get(
  '/banners/:bannerId',
  clientSDKAuth,
  BannerClientController.getBannerById
);

export default router;
