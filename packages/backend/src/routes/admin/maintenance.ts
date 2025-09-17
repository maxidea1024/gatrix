import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { MaintenanceController } from '../../controllers/MaintenanceController';

const router = Router();

// Public endpoint for clients
router.get('/isUnderMaintenance', MaintenanceController.getStatus as any);

// Admin endpoints (scope auth only to /maintenance/* paths)
router.use('/maintenance', authenticate as any);
router.use('/maintenance', requireAdmin as any);
router.get('/maintenance/templates', MaintenanceController.templatesGet as any);
router.post('/maintenance/templates', MaintenanceController.templatesSave as any);
router.post('/maintenance', MaintenanceController.setStatus as any);

export default router;
