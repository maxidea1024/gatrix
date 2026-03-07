import { Router } from 'express';
import serverLifecycleController from '../../controllers/ServerLifecycleController';
import { authenticate, requireEnvPermission } from '../../middleware/auth';
import { P } from '@gatrix/shared/permissions';

const router = Router();

// All routes require authentication
router.use(authenticate as any);

/**
 * @swagger
 * /api/v1/admin/server-lifecycle/events:
 *   get:
 *     summary: Get server lifecycle events
 *     tags: [Server Lifecycle]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/events',
  requireEnvPermission(P.SERVERS_READ) as any,
  serverLifecycleController.getEvents
);

/**
 * @swagger
 * /api/v1/admin/server-lifecycle/summary:
 *   get:
 *     summary: Get recent server lifecycle events summary
 *     tags: [Server Lifecycle]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/summary',
  requireEnvPermission(P.SERVERS_READ) as any,
  serverLifecycleController.getRecentSummary
);

export default router;
