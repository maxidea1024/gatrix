import { Router } from 'express';
import { ClientController } from '../controllers/ClientController';
import RemoteConfigClientController from '../controllers/RemoteConfigClientController';
import { requestLogger } from '../middleware/requestLogger';
import { body, param, validationResult } from 'express-validator';
import { CustomError } from '../middleware/errorHandler';

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

// Apply request logging to all client routes
router.use(requestLogger);

/**
 * @swagger
 * /api/v1/client/client-version:
 *   get:
 *     summary: Get client version information
 *     description: Retrieve client version configurations for game clients. This endpoint is cached and optimized for high-volume requests.
 *     tags: [Client]
 *     parameters:
 *       - in: query
 *         name: platform
 *         schema:
 *           type: string
 *         description: Filter by platform (e.g., pc, ios, android, harmonyos)
 *     responses:
 *       200:
 *         description: Client version information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     versions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           channel:
 *                             type: string
 *                           subChannel:
 *                             type: string
 *                           clientVersion:
 *                             type: string
 *                           gameServerAddress:
 *                             type: string
 *                           gameServerAddressForWhiteList:
 *                             type: string
 *                           patchAddress:
 *                             type: string
 *                           patchAddressForWhiteList:
 *                             type: string
 *                           guestModeAllowed:
 *                             type: boolean
 *                           externalClickLink:
 *                             type: string
 *                           customPayload:
 *                             type: object
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                     total:
 *                       type: integer
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                 cached:
 *                   type: boolean
 *       500:
 *         description: Internal server error
 */
router.get('/client-version', ClientController.getClientVersion);

/**
 * @swagger
 * /api/v1/client/game-worlds:
 *   get:
 *     summary: Get all game worlds
 *     description: Retrieve all visible and non-maintenance game worlds. This endpoint is cached and optimized for high-volume requests.
 *     tags: [Client]
 *     responses:
 *       200:
 *         description: Game worlds retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     worlds:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           worldId:
 *                             type: string
 *                           name:
 *                             type: string
 *                           description:
 *                             type: string
 *                           displayOrder:
 *                             type: integer
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                     total:
 *                       type: integer
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                 cached:
 *                   type: boolean
 *       500:
 *         description: Internal server error
 */
router.get('/game-worlds', ClientController.getGameWorlds);

/**
 * @swagger
 * /api/v1/client/cache-stats:
 *   get:
 *     summary: Get cache statistics
 *     description: Retrieve cache performance statistics for monitoring purposes.
 *     tags: [Client]
 *     responses:
 *       200:
 *         description: Cache statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalItems:
 *                       type: integer
 *                     validItems:
 *                       type: integer
 *                     expiredItems:
 *                       type: integer
 *                     memoryUsage:
 *                       type: object
 */
router.get('/cache-stats', ClientController.getCacheStats);

// Cache invalidation endpoint (for testing)
router.post('/invalidate-cache', ClientController.invalidateCache);

/**
 * @swagger
 * /api/v1/client/remote-config/evaluate:
 *   post:
 *     summary: Evaluate remote configs
 *     description: Server-side evaluation of remote configs based on context. Returns evaluated values for all or specific configs.
 *     tags: [Client]
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
 *               keys:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Optional array of specific config keys to evaluate
 *     responses:
 *       200:
 *         description: Remote configs evaluated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     configs:
 *                       type: object
 *                     evaluatedAt:
 *                       type: string
 *                       format: date-time
 *                     context:
 *                       type: object
 */
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

// Simple test endpoint
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Client API is working without authentication'
  });
});

export default router;
