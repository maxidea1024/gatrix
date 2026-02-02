import { Router } from "express";
import serverLifecycleController from "../../controllers/ServerLifecycleController";
import { authenticate, requirePermission } from "../../middleware/auth";
import { PERMISSIONS } from "../../types/permissions";

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
  "/events",
  requirePermission(PERMISSIONS.SERVERS_VIEW) as any,
  serverLifecycleController.getEvents,
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
  "/summary",
  requirePermission(PERMISSIONS.SERVERS_VIEW) as any,
  serverLifecycleController.getRecentSummary,
);

export default router;
