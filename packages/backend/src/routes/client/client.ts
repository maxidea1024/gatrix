import { Router } from 'express';
import { ClientController } from '../../controllers/ClientController';
import RemoteConfigClientController from '../../controllers/RemoteConfigClientController';
import RemoteConfigSDKController from '../../controllers/RemoteConfigSDKController';
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

/**
 * @swagger
 * /api/v1/client/remote-config/{key}:
 *   post:
 *     summary: Get single remote config by key
 *     description: Server-side evaluation of a single remote config by key.
 *     tags: [Client]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: Config key name
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               context:
 *                 type: object
 *                 properties:
 *                   userId:
 *                     type: string
 *                   userSegment:
 *                     type: string
 *                   appVersion:
 *                     type: string
 *                   platform:
 *                     type: string
 *                   country:
 *                     type: string
 *                   language:
 *                     type: string
 *                   customFields:
 *                     type: object
 *     responses:
 *       200:
 *         description: Remote config evaluated successfully
 *       404:
 *         description: Config not found or inactive
 */
router.post('/remote-config/:key',
  param('key').isString().isLength({ min: 1, max: 255 }),
  body('context').optional().isObject(),
  validateRequest,
  RemoteConfigClientController.getConfigByKey
);

// Client SDK routes (with API token authentication)
router.get('/test', clientSDKAuth, RemoteConfigSDKController.testAuth);
router.get('/remote-config/templates', clientSDKAuth, RemoteConfigSDKController.getClientTemplates);
router.post('/remote-config/evaluate', clientSDKAuth, RemoteConfigSDKController.evaluateConfig);
router.post('/remote-config/metrics', clientSDKAuth, RemoteConfigSDKController.submitMetrics);

export default router;
