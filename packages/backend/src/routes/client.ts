import { Router } from 'express';
import { ClientController } from '../controllers/ClientController';
import { requestLogger } from '../middleware/requestLogger';

const router = Router();

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

// Simple test endpoint
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Client API is working without authentication'
  });
});

export default router;
