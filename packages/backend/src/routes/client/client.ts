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
/**
 * @openapi
 * /client/test:
 *   get:
 *     tags: [ClientSDK]
 *     summary: Test client SDK authentication
 *     description: Requires API token and application name. Use either Authorization: Bearer <token> or X-API-Token header, and X-Application-Name header.
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: false
 *         schema: { type: string, example: "Bearer <API_TOKEN>" }
 *       - in: header
 *         name: X-API-Token
 *         required: false
 *         schema: { type: string }
 *       - in: header
 *         name: X-Application-Name
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Authenticated successfully
 *
 * /client/remote-config/templates:
 *   get:
 *     tags: [ClientSDK, RemoteConfig]
 *     summary: Get published client templates (ETag-cached)
 *     description: Returns merged remote config templates for the environment associated with the API token. Supports ETag via If-None-Match.
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: false
 *         schema: { type: string, example: "Bearer <API_TOKEN>" }
 *       - in: header
 *         name: X-API-Token
 *         required: false
 *         schema: { type: string }
 *       - in: header
 *         name: X-Application-Name
 *         required: true
 *         schema: { type: string }
 *       - in: header
 *         name: If-None-Match
 *         required: false
 *         schema: { type: string }
 *         description: Provide previous ETag to receive 304 if unchanged
 *     responses:
 *       200:
 *         description: Combined templates
 *       304:
 *         description: Not Modified — Use cached response
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *

 * /client/remote-config/metrics:
 *   post:
 *     tags: [ClientSDK, RemoteConfig]
 *     summary: Submit SDK metrics
 *     description: Submit an array of metrics/events from the SDK.
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: false
 *         schema: { type: string, example: "Bearer <API_TOKEN>" }
 *       - in: header
 *         name: X-API-Token
 *         required: false
 *         schema: { type: string }
 *       - in: header
 *         name: X-Application-Name
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [metrics]
 *             properties:
 *               metrics:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     event: { type: string }
 *                     value: { type: number }
 *                     timestamp: { type: string, format: date-time }
 *           examples:
 *             default:
 *               value:
 *                 metrics:
 *                   - event: "login_success"
 *                     value: 1
 *                     timestamp: "2025-01-01T00:00:00.000Z"
 *     responses:
 *       200:
 *         description: Metrics accepted
 *
 * /client/crashes/upload:
 *   post:
 *     tags: [ClientSDK, Monitoring]
 *     summary: Upload crash information
 *     description: Requires API token and application name headers.
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: false
 *         schema: { type: string, example: "Bearer <API_TOKEN>" }
 *       - in: header
 *         name: X-API-Token
 *         required: false
 *         schema: { type: string }
 *       - in: header
 *         name: X-Application-Name
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [platform, branch, environment, stack]
 *             properties:
 *               platform: { type: string }
 *               branch: { type: string }
 *               environment: { type: string }
 *               stack: { type: string }
 *               marketType: { type: string }
 *               isEditor: { type: boolean }
 *               appVersion: { type: string }
 *               resVersion: { type: string }
 *               accountId: { type: string }
 *               characterId: { type: string }
 *               gameUserId: { type: string }
 *               userName: { type: string }
 *               gameServerId: { type: string }
 *               userMessage: { type: string }
 *               log: { type: string }
 *     responses:
 *       200:
 *         description: Crash registered
 */
/**
 * @openapi
 * /client/client-version:
 *   get:
 *     tags: [Client]
 *     summary: Get client version info and endpoints
 *     description: Returns current client status, endpoints, and metadata for a given platform and version. Requires X-Application-Name and X-API-Token headers.
 *     parameters:
 *       - in: query
 *         name: platform
 *         required: true
 *         schema: { type: string }
 *         description: Platform identifier (e.g., ios, android, windows)
 *       - in: query
 *         name: version
 *         required: true
 *         schema: { type: string }
 *         description: Client version (semver string)
 *       - in: query
 *         name: lang
 *         required: false
 *         schema: { type: string, example: ko }
 *         description: Preferred language for maintenance message
 *       - in: header
 *         name: X-Application-Name
 *         required: true
 *         schema: { type: string }
 *         description: Application identifier used for metrics and auth
 *       - in: header
 *         name: X-API-Token
 *         required: true
 *         schema: { type: string }
 *         description: API token for application
 *     responses:
 *       200:
 *         description: Client version info
 *         content:
 *           application/json:
 *             examples:
 *               default:
 *                 value:
 *                   success: true
 *                   data:
 *                     platform: android
 *                     clientVersion: 1.2.3
 *                     status: ACTIVE
 *                     gameServerAddress: https://game.example.com
 *                     patchAddress: https://patch.example.com
 *                     guestModeAllowed: true
 *                     externalClickLink: "https://example.com/news"
 *                     meta: { featureFlag: true }
 *                   cached: false
 *       400: { $ref: '#/components/responses/BadRequestError' }
 *       404: { description: Client version not found }
 *
 * /client/game-worlds:
 *   get:
 *     tags: [Client]
 *     summary: List visible game worlds
 *     responses:
 *       200:
 *         description: Public game worlds
 *         content:
 *           application/json:
 *             examples:
 *               default:
 *                 value:
 *                   success: true
 *                   data:
 *                     worlds:
 *                       - id: 1
 *                         worldId: "NA-1"
 *                         name: "North America 1"
 *                         description: "Primary world"
 *                         displayOrder: 1
 *                         createdAt: "2025-01-01T00:00:00.000Z"
 *                         updatedAt: "2025-01-01T00:00:00.000Z"
 *                     total: 1
 *                     timestamp: "2025-01-01T00:00:00.000Z"
 *                   cached: false
 *
 * /client/cache-stats:
 *   get:
 *     tags: [Client]
 *     summary: Get cache and queue stats (monitoring)
 *     responses:
 *       200:
 *         description: Cache, queue and pub/sub stats
 *         content:
 *           application/json:
 *             examples:
 *               default:
 *                 value:
 *                   success: true
 *                   data:
 *                     cache: { hits: 10, misses: 2 }
 *                     queue: { pending: 0 }
 *                     pubsub: { connected: true, timestamp: "2025-01-01T00:00:00.000Z" }
 *
 * /client/invalidate-cache:
 *   post:
 *     tags: [Client]
 *     summary: Invalidate game worlds cache (testing only)
 *     responses:
 *       200:
 *         description: Cache invalidated
 *         content:
 *           application/json:
 *             examples:
 *               default:
 *                 value:
 *                   success: true
 *                   message: "Game worlds cache invalidated successfully"
 *
 * /client/remote-config/evaluate:
 *   post:
 *     tags: [RemoteConfig]
 *     summary: Evaluate remote configs (server-side)
 *     description: Server-side evaluation to prevent tampering. Optionally restrict to specific keys.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               context:
 *                 type: object
 *                 description: Context for targeting and A/B
 *               keys:
 *                 type: array
 *                 items: { type: string }
 *                 description: Evaluate only these keys
 *           examples:
 *             default:
 *               value:
 *                 context: { userId: "u-123" }
 *                 keys: ["feature.newLobby", "ui.color"]
 *     responses:
 *       200:
 *         description: Evaluation result
 *         content:
 *           application/json:
 *             examples:
 *               default:
 *                 value:
 *                   success: true
 *                   data:
 *                     configs:
 *                       feature.newLobby: { value: true, source: "default", appliedAt: "2025-01-01T00:00:00.000Z" }
 *                     evaluatedAt: "2025-01-01T00:00:00.000Z"
 *                     context: { userId: "u-123" }
 *       400: { $ref: '#/components/responses/BadRequestError' }
 *
 * /client/remote-config/{key}:
 *   post:
 *     tags: [RemoteConfig]
 *     summary: Get single remote config value by key (server-side)
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               context: { type: object }
 *           examples:
 *             default:
 *               value:
 *                 context: { userId: "u-123" }
 *     responses:
 *       200:
 *         description: Single config value
 *         content:
 *           application/json:
 *             examples:
 *               default:
 *                 value:
 *                   success: true
 *                   data:
 *                     key: "feature.newLobby"
 *                     value: false
 *                     source: "variant"
 *                     variantId: 5
 *                     evaluatedAt: "2025-01-01T00:00:00.000Z"
 */

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
