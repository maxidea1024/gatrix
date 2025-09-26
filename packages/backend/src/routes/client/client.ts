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
    const errorMessages = errors.array().map((err: any) => err.msg).join(', ');
    throw new CustomError(`Validation failed: ${errorMessages}`, 400);
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
  body('pubId').isString().notEmpty(),
  body('userId').isInt(),
  body('platform').isInt(),
  body('branch').isInt(),
  body('majorVer').isInt(),
  body('minorVer').isInt(),
  body('buildNum').isInt(),
  body('patchNum').isInt(),
  body('stack').isString().notEmpty(),
  body('userMsg').optional().isString(),
  body('log').optional().isString(),
  body('serverGroup').optional().isString(),
  body('marketType').optional().isString(),
  validateRequest,
  clientSDKAuth,
  ClientCrashController.uploadCrash
);

export default router;
