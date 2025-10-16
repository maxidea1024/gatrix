import { Router } from 'express';
import { ClientController } from '../../controllers/ClientController';
import RemoteConfigClientController from '../../controllers/RemoteConfigClientController';
import RemoteConfigSDKController from '../../controllers/RemoteConfigSDKController';
import { ClientCrashController } from '../../controllers/ClientCrashController';
import { requestLogger } from '../../middleware/requestLogger';
import { clientSDKAuth } from '../../middleware/apiTokenAuth';
import { body, param, validationResult } from 'express-validator';
import { CustomError } from '../../middleware/errorHandler';

const router = Router();

// Validation middleware
const validateRequest = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map((err: any) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value
    }));

    const errorMessage = errorDetails
      .map((err: any) => `${err.field}: ${err.message}`)
      .join(', ');

    const error = new CustomError(`Validation failed: ${errorMessage}`, 400);
    (error as any).validationErrors = errorDetails;
    throw error;
  }
  next();
};

router.use(requestLogger);

router.get('/client-version', ClientController.getClientVersion);

router.get('/game-worlds', ClientController.getGameWorlds);

router.get('/cache-stats', ClientController.getCacheStats);

router.post('/invalidate-cache', ClientController.invalidateCache);

router.post('/remote-config/evaluate',
  body('context').optional().isObject(),
  body('keys').optional().isArray(),
  validateRequest,
  RemoteConfigClientController.evaluate
);

router.post('/remote-config/:key',
  param('key').isString().isLength({ min: 1, max: 255 }),
  body('context').optional().isObject(),
  validateRequest,
  RemoteConfigClientController.getConfigByKey
);

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
      timestamp: new Date().toISOString()
    }
  });
});
router.get('/remote-config/templates', clientSDKAuth, RemoteConfigSDKController.getClientTemplates);
router.post('/remote-config/evaluate', clientSDKAuth, RemoteConfigSDKController.evaluateConfig);
router.post('/remote-config/metrics', clientSDKAuth, RemoteConfigSDKController.submitMetrics);

// Crash upload endpoint (requires client API token)
router.post('/crashes/upload',
  clientSDKAuth,
  body('platform').isString().notEmpty(),
  body('branch').isString().notEmpty(),
  body('environment').isString().notEmpty(),
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

export default router;
