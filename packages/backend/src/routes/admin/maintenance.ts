import { Router } from 'express';
import { MaintenanceController } from '../../controllers/MaintenanceController';

const router = Router();

// Status endpoint (will be available at /api/v1/admin/maintenance/isUnderMaintenance)
router.get('/isUnderMaintenance', MaintenanceController.getStatus as any);

// Admin endpoints (mounted under /api/v1/admin/maintenance)
router.get('/templates', MaintenanceController.templatesGet as any);
router.post('/templates', MaintenanceController.templatesSave as any);
router.post('/', MaintenanceController.setStatus as any);

export default router;
