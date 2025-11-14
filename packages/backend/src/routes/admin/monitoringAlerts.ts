import { Router } from 'express';
import { query, param } from 'express-validator';
import { MonitoringAlertController } from '../../controllers/MonitoringAlertController';
import { validateRequest } from '../../middleware/validateRequest';

const router = Router();

/**
 * Admin monitoring alerts routes
 */

// GET /admin/monitoring/alerts
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('severity').optional().isString(),
    query('status').optional().isString(),
    validateRequest,
  ],
  MonitoringAlertController.getAlerts as any
);

// GET /admin/monitoring/alerts/:id
router.get(
  '/:id',
  [
    param('id').isString(),
    validateRequest,
  ],
  MonitoringAlertController.getAlertById as any
);

// PATCH /admin/monitoring/alerts/:id
router.patch(
  '/:id',
  [
    param('id').isString(),
    validateRequest,
  ],
  MonitoringAlertController.updateAlertStatus as any
);

export default router;

